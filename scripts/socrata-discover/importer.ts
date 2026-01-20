/**
 * Import matched candidates into the database
 *
 * Updates TargetJurisdiction and creates Source records
 */

import { PrismaClient, JurisdictionType, AdapterType, TargetStatus } from "@prisma/client";
import type { MatchedCandidate, ImportResult } from "./types";

const prisma = new PrismaClient();

/**
 * Determine JurisdictionType from name
 */
function inferJurisdictionType(name: string): JurisdictionType {
  const lower = name.toLowerCase();
  if (lower.includes("county")) return JurisdictionType.COUNTY;
  if (lower.includes("district")) return JurisdictionType.HEALTH_DISTRICT;
  if (lower.includes("state")) return JurisdictionType.STATE;
  return JurisdictionType.CITY;
}

/**
 * Import a single matched candidate
 */
export async function importCandidate(
  candidate: MatchedCandidate,
  options: { dryRun?: boolean } = {}
): Promise<ImportResult> {
  const { dryRun = false } = options;
  const result: ImportResult = {
    candidate,
    target_jurisdiction_updated: false,
    target_jurisdiction_created: false,
    source_created: false,
  };

  try {
    const { matched_jurisdiction } = candidate;

    // Case 1: Matched to existing TargetJurisdiction
    if (matched_jurisdiction.target_jurisdiction_id) {
      if (!dryRun) {
        await prisma.targetJurisdiction.update({
          where: { id: matched_jurisdiction.target_jurisdiction_id },
          data: {
            status: TargetStatus.DATA_FOUND,
            dataPortal: candidate.landing_url,
            apiType: "socrata",
            notes: `Auto-discovered. Score: ${candidate.match_signals.score}. Title: ${candidate.title}`,
          },
        });
      }
      result.target_jurisdiction_updated = true;

      // If this TargetJurisdiction has a linked Jurisdiction, create Source
      if (matched_jurisdiction.jurisdiction_id) {
        // Check if source already exists
        const existingSource = await prisma.source.findFirst({
          where: {
            jurisdictionId: matched_jurisdiction.jurisdiction_id,
            endpoint: candidate.soda_url,
          },
        });

        if (!existingSource && !dryRun) {
          await prisma.source.create({
            data: {
              jurisdictionId: matched_jurisdiction.jurisdiction_id,
              name: `${candidate.title} (Socrata - Auto-discovered)`,
              adapterType: AdapterType.SOCRATA,
              endpoint: candidate.soda_url,
              isActive: false, // Needs transformer before activation
              config: {
                resource: candidate.resource_id,
                discovered: true,
                discoveryScore: candidate.match_signals.score,
                discoveredAt: new Date().toISOString(),
              },
            },
          });
          result.source_created = true;
        }
      }
    }
    // Case 2: No match but we have inferred state and name - create new TargetJurisdiction
    else if (
      matched_jurisdiction.inferred_state &&
      matched_jurisdiction.inferred_name &&
      matched_jurisdiction.match_confidence === "none"
    ) {
      // Check if this combination already exists
      const existing = await prisma.targetJurisdiction.findUnique({
        where: {
          state_name: {
            state: matched_jurisdiction.inferred_state,
            name: matched_jurisdiction.inferred_name,
          },
        },
      });

      if (!existing && !dryRun) {
        await prisma.targetJurisdiction.create({
          data: {
            state: matched_jurisdiction.inferred_state,
            name: matched_jurisdiction.inferred_name,
            type: inferJurisdictionType(matched_jurisdiction.inferred_name),
            status: TargetStatus.DATA_FOUND,
            dataPortal: candidate.landing_url,
            apiType: "socrata",
            notes: `Auto-discovered. Score: ${candidate.match_signals.score}. Title: ${candidate.title}`,
          },
        });
        result.target_jurisdiction_created = true;
      } else if (existing && !dryRun) {
        // Update existing
        await prisma.targetJurisdiction.update({
          where: { id: existing.id },
          data: {
            status: TargetStatus.DATA_FOUND,
            dataPortal: candidate.landing_url,
            apiType: "socrata",
            notes: `Auto-discovered. Score: ${candidate.match_signals.score}. Title: ${candidate.title}`,
          },
        });
        result.target_jurisdiction_updated = true;
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Unknown error";
  }

  return result;
}

/**
 * Import multiple matched candidates
 */
export async function importCandidates(
  candidates: MatchedCandidate[],
  options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<{
  results: ImportResult[];
  summary: {
    updated: number;
    created: number;
    sources: number;
    errors: number;
    skipped: number;
  };
}> {
  const { verbose = false } = options;
  const results: ImportResult[] = [];
  const summary = {
    updated: 0,
    created: 0,
    sources: 0,
    errors: 0,
    skipped: 0,
  };

  for (const candidate of candidates) {
    if (verbose) {
      console.log(`  Importing: ${candidate.title} (${candidate.domain})`);
    }

    const result = await importCandidate(candidate, options);
    results.push(result);

    if (result.error) {
      summary.errors++;
      if (verbose) {
        console.log(`    Error: ${result.error}`);
      }
    } else if (result.target_jurisdiction_updated) {
      summary.updated++;
    } else if (result.target_jurisdiction_created) {
      summary.created++;
    } else {
      summary.skipped++;
    }

    if (result.source_created) {
      summary.sources++;
    }
  }

  return { results, summary };
}

/**
 * Get all TargetJurisdictions from DB
 */
export async function getAllTargetJurisdictions() {
  return prisma.targetJurisdiction.findMany({
    orderBy: [{ state: "asc" }, { name: "asc" }],
  });
}

/**
 * Disconnect from database
 */
export async function disconnect() {
  await prisma.$disconnect();
}
