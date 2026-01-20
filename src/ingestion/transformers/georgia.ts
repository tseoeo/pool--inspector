import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";

/**
 * Parse Georgia date format (MM-DD-YYYY) to Date object
 */
function parseGeorgiaDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  // Format: MM-DD-YYYY
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;

  const [, month, day, year] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Transform Georgia Tyler Technologies data to canonical format
 *
 * Raw data structure:
 * {
 *   facilityId: string,
 *   facilityIdEncoded: string,
 *   facilityName: string,
 *   streetAddress: string,
 *   city: string,
 *   state: string,
 *   zip: string | null,
 *   phone: string | null,
 *   permitType: string | null,
 *   permitNumber: string | null,
 *   inspectionDate: string (MM-DD-YYYY),
 *   score: string | null,
 *   rawMapAddress: string,
 *   rawColumns: object
 * }
 */
export function transformGeorgia(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data;

  const inspectionDate = parseGeorgiaDate(d.inspectionDate as string);
  if (!inspectionDate) {
    throw new Error(`Invalid inspection date: ${d.inspectionDate}`);
  }

  // Build source URL for the facility
  const facilityIdEncoded = d.facilityIdEncoded as string;
  const sourceUrl = `https://ga.healthinspections.us/stateofgeorgia/#facility/${facilityIdEncoded}`;

  return {
    externalId: raw.externalId,

    facility: {
      externalId: String(d.facilityId || d.facilityIdEncoded || ""),
      rawName: String(d.facilityName || "Unknown Pool"),
      rawAddress: String(d.streetAddress || ""),
      rawCity: d.city ? String(d.city) : null,
      rawState: d.state ? String(d.state) : "GA",
      rawZip: d.zip ? String(d.zip) : null,
      latitude: null, // API doesn't provide coordinates
      longitude: null,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.permitType ? String(d.permitType) : "Swimming Pool",
      rawResult: null, // API doesn't provide pass/fail, only score
      rawScore: d.score ? String(d.score) : null,
      demerits: null,
      sourceUrl,
      reportUrl: null, // Report URLs require authentication
    },

    rawPayload: d as Record<string, unknown>,
  };
}
