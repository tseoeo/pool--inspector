import { prisma } from "@/lib/prisma";
import { SyncType, SyncStatus } from "@prisma/client";
import type { IngestionOptions, IngestionResult, CanonicalRecord, CursorState } from "@/types/ingestion";
import { getAdapter, getTransformer } from "./registry";
import { hashPayload, generateUniqueSlug, sleep } from "./utils";
import {
  normalizeAddress,
  normalizeFacilityName,
  formatDisplayAddress,
  formatDisplayName,
  normalizeInspectionResult,
  normalizeInspectionType,
  isClosure,
  isPassing,
} from "./normalizers";

export async function runIngestion(options: IngestionOptions): Promise<IngestionResult> {
  const { sourceId, syncType, maxRecords } = options;

  const source = await prisma.source.findUniqueOrThrow({
    where: { id: sourceId },
    include: { jurisdiction: true },
  });

  const adapter = getAdapter(source);
  const transformer = getTransformer(source.jurisdiction.slug);

  // Create sync log
  const syncLog = await prisma.syncLog.create({
    data: {
      sourceId,
      syncType: syncType as SyncType,
      status: SyncStatus.PARTIAL,
    },
  });

  let cursor: CursorState | null;
  if (syncType === "BACKFILL") {
    cursor = adapter.getInitialCursor();
  } else if (syncType === "RESUME" && source.cursor) {
    // Resume from saved cursor position
    cursor = source.cursor as unknown as CursorState;
    console.log(`Resuming from saved cursor:`, cursor);
  } else {
    cursor = adapter.getIncrementalCursor(source.lastSyncAt);
  }

  const cursorBefore = cursor ? JSON.parse(JSON.stringify(cursor)) : null;
  let totalFetched = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    while (true) {
      console.log(`Fetching batch from cursor:`, cursor);
      const result = await adapter.fetch(cursor);
      totalFetched += result.records.length;

      console.log(`Fetched ${result.records.length} records (total: ${totalFetched})`);

      for (const raw of result.records) {
        try {
          const canonical = transformer(raw, source);
          const outcome = await processRecord(source.id, source.jurisdiction.slug, canonical);
          if (outcome === "created") created++;
          else if (outcome === "updated") updated++;
          else skipped++;
        } catch (error) {
          failed++;
          console.error(`Failed to process record ${raw.externalId}:`, error);
        }
      }

      // Update source cursor
      if (result.nextCursor) {
        await prisma.source.update({
          where: { id: sourceId },
          data: { cursor: JSON.parse(JSON.stringify(result.nextCursor)) },
        });
      }

      cursor = result.nextCursor;

      if (!result.hasMore || (maxRecords && totalFetched >= maxRecords)) {
        break;
      }

      // Rate limiting - wait between batches
      const delayMs = Math.ceil(60000 / source.requestsPerMinute);
      await sleep(delayMs);
    }

    // Success
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: failed > 0 ? SyncStatus.PARTIAL : SyncStatus.SUCCESS,
        completedAt: new Date(),
        recordsFetched: totalFetched,
        recordsCreated: created,
        recordsUpdated: updated,
        recordsSkipped: skipped,
        recordsFailed: failed,
        cursorBefore,
        cursorAfter: cursor ? JSON.parse(JSON.stringify(cursor)) : null,
      },
    });

    await prisma.source.update({
      where: { id: sourceId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: failed > 0 ? SyncStatus.PARTIAL : SyncStatus.SUCCESS,
        lastRecordCount: totalFetched,
        lastSyncError: null,
      },
    });

    return {
      success: true,
      recordsFetched: totalFetched,
      recordsCreated: created,
      recordsUpdated: updated,
      recordsSkipped: skipped,
      recordsFailed: failed,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: SyncStatus.FAILED,
        completedAt: new Date(),
        recordsFetched: totalFetched,
        recordsCreated: created,
        recordsUpdated: updated,
        recordsSkipped: skipped,
        recordsFailed: failed,
        errorMessage,
        errorStack,
      },
    });

    await prisma.source.update({
      where: { id: sourceId },
      data: {
        lastSyncStatus: SyncStatus.FAILED,
        lastSyncError: errorMessage,
      },
    });

    return {
      success: false,
      recordsFetched: totalFetched,
      recordsCreated: created,
      recordsUpdated: updated,
      recordsSkipped: skipped,
      recordsFailed: failed,
      error: errorMessage,
    };
  }
}

async function processRecord(
  sourceId: string,
  jurisdictionSlug: string,
  canonical: CanonicalRecord
): Promise<"created" | "updated" | "skipped"> {
  const payloadHash = hashPayload(canonical.rawPayload);

  // Check if we already have this record
  const existing = await prisma.rawRecord.findUnique({
    where: {
      sourceId_externalId: {
        sourceId,
        externalId: canonical.externalId,
      },
    },
  });

  if (existing && existing.payloadHash === payloadHash) {
    return "skipped"; // No change
  }

  // Get source with jurisdiction
  const source = await prisma.source.findUniqueOrThrow({
    where: { id: sourceId },
    include: { jurisdiction: true },
  });

  // Upsert raw record
  const rawRecord = await prisma.rawRecord.upsert({
    where: {
      sourceId_externalId: {
        sourceId,
        externalId: canonical.externalId,
      },
    },
    create: {
      sourceId,
      externalId: canonical.externalId,
      payload: JSON.parse(JSON.stringify(canonical.rawPayload)),
      payloadHash,
    },
    update: {
      payload: JSON.parse(JSON.stringify(canonical.rawPayload)),
      payloadHash,
      processedAt: null, // Mark for reprocessing
    },
  });

  // Find or create facility
  const facility = await findOrCreateFacility(source.jurisdiction.id, canonical);

  // Normalize inspection values
  const normalizedResult = normalizeInspectionResult(canonical.inspection.rawResult);
  const normalizedType = normalizeInspectionType(canonical.inspection.rawInspectionType);
  const isClosureValue = isClosure(normalizedResult, canonical.inspection.rawResult);
  const isPassingValue = isPassing(normalizedResult);

  // Create or update inspection event
  await prisma.inspectionEvent.upsert({
    where: { rawRecordId: rawRecord.id },
    create: {
      facilityId: facility.id,
      rawRecordId: rawRecord.id,
      inspectionDate: canonical.inspection.inspectionDate,
      rawInspectionType: canonical.inspection.rawInspectionType,
      rawResult: canonical.inspection.rawResult,
      rawScore: canonical.inspection.rawScore,
      inspectionType: normalizedType,
      result: normalizedResult,
      demerits: canonical.inspection.demerits,
      isClosure: isClosureValue,
      isPassing: isPassingValue,
      sourceUrl: canonical.inspection.sourceUrl,
      reportUrl: canonical.inspection.reportUrl,
    },
    update: {
      inspectionDate: canonical.inspection.inspectionDate,
      rawInspectionType: canonical.inspection.rawInspectionType,
      rawResult: canonical.inspection.rawResult,
      rawScore: canonical.inspection.rawScore,
      inspectionType: normalizedType,
      result: normalizedResult,
      demerits: canonical.inspection.demerits,
      isClosure: isClosureValue,
      isPassing: isPassingValue,
      sourceUrl: canonical.inspection.sourceUrl,
      reportUrl: canonical.inspection.reportUrl,
    },
  });

  // Update facility stats
  await updateFacilityStats(facility.id);

  // Mark raw record as processed
  await prisma.rawRecord.update({
    where: { id: rawRecord.id },
    data: { processedAt: new Date() },
  });

  return existing ? "updated" : "created";
}

async function findOrCreateFacility(jurisdictionId: string, canonical: CanonicalRecord) {
  const normalizedName = normalizeFacilityName(canonical.facility.rawName);
  const normalizedAddress = normalizeAddress(canonical.facility.rawAddress);

  // Try to find existing facility by normalized name + address
  let facility = await prisma.facility.findFirst({
    where: {
      jurisdictionId,
      normalizedName,
      normalizedAddress,
    },
  });

  if (facility) {
    // Update external IDs if new source
    const externalIds = (facility.externalIds || []) as Array<{
      sourceId: string;
      externalId: string;
    }>;
    const hasExternalId = externalIds.some(
      (e) => e.externalId === canonical.facility.externalId
    );

    if (!hasExternalId && canonical.facility.externalId) {
      // We don't have source ID here, so we'll just add the facility external ID
      // In a more complete implementation, you'd pass sourceId through
      await prisma.facility.update({
        where: { id: facility.id },
        data: {
          // Update coordinates if we have them and didn't before
          latitude: facility.latitude || canonical.facility.latitude,
          longitude: facility.longitude || canonical.facility.longitude,
        },
      });
    }

    return facility;
  }

  // Create new facility - use try/catch to handle race conditions
  const slug = await generateUniqueSlug(canonical.facility.rawName, jurisdictionId);
  const displayAddress = formatDisplayAddress({
    rawAddress: canonical.facility.rawAddress,
    rawCity: canonical.facility.rawCity,
    rawState: canonical.facility.rawState,
    rawZip: canonical.facility.rawZip,
  });

  try {
    return await prisma.facility.create({
      data: {
        jurisdictionId,
        externalIds: canonical.facility.externalId
          ? [{ externalId: canonical.facility.externalId }]
          : [],
        rawName: canonical.facility.rawName,
        rawAddress: canonical.facility.rawAddress,
        rawCity: canonical.facility.rawCity,
        rawState: canonical.facility.rawState,
        rawZip: canonical.facility.rawZip,
        normalizedName,
        normalizedAddress,
        displayName: formatDisplayName(canonical.facility.rawName),
        displayAddress,
        city: canonical.facility.rawCity || "Unknown",
        state: canonical.facility.rawState || "TX",
        zipCode: canonical.facility.rawZip,
        latitude: canonical.facility.latitude,
        longitude: canonical.facility.longitude,
        slug,
      },
    });
  } catch (error: unknown) {
    // Handle unique constraint violation (race condition)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      // Check if it's a name+address collision - return existing facility
      const existingFacility = await prisma.facility.findFirst({
        where: { jurisdictionId, normalizedName, normalizedAddress },
      });
      if (existingFacility) return existingFacility;

      // If it's a slug collision, retry with a random suffix
      const randomSlug = `${slug}-${Date.now().toString(36)}`;
      return await prisma.facility.create({
        data: {
          jurisdictionId,
          externalIds: canonical.facility.externalId
            ? [{ externalId: canonical.facility.externalId }]
            : [],
          rawName: canonical.facility.rawName,
          rawAddress: canonical.facility.rawAddress,
          rawCity: canonical.facility.rawCity,
          rawState: canonical.facility.rawState,
          rawZip: canonical.facility.rawZip,
          normalizedName,
          normalizedAddress,
          displayName: formatDisplayName(canonical.facility.rawName),
          displayAddress,
          city: canonical.facility.rawCity || "Unknown",
          state: canonical.facility.rawState || "TX",
          zipCode: canonical.facility.rawZip,
          latitude: canonical.facility.latitude,
          longitude: canonical.facility.longitude,
          slug: randomSlug,
        },
      });
    }
    throw error;
  }
}

async function updateFacilityStats(facilityId: string): Promise<void> {
  // Get latest inspection
  const latestInspection = await prisma.inspectionEvent.findFirst({
    where: { facilityId },
    orderBy: { inspectionDate: "desc" },
    select: {
      inspectionDate: true,
      rawResult: true,
    },
  });

  // Count total inspections
  const totalInspections = await prisma.inspectionEvent.count({
    where: { facilityId },
  });

  await prisma.facility.update({
    where: { id: facilityId },
    data: {
      lastInspectionDate: latestInspection?.inspectionDate,
      lastInspectionResult: latestInspection?.rawResult,
      totalInspections,
    },
  });
}

// Export for use in workers
export { getAdapter, getTransformer } from "./registry";
