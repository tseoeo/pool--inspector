import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";

/**
 * Transform Houston TX pool inspection data to canonical format
 *
 * Raw data structure (from scraper):
 * {
 *   facilityId: string (GUID),
 *   facilityName: string,
 *   address: string,
 *   city: string,
 *   state: string,
 *   zip: string,
 *   inspectionDate: string (MM/DD/YYYY),
 *   inspectionId: string,
 *   violations: string[],
 *   violationCount: number,
 *   result: string (Pass, Violations Found)
 * }
 */
export function transformHouston(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data;

  // Parse date from MM/DD/YYYY format
  const dateStr = String(d.inspectionDate || "");
  const dateParts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  let inspectionDate: Date;

  if (dateParts) {
    const [, month, day, year] = dateParts;
    inspectionDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } else {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  if (isNaN(inspectionDate.getTime())) {
    throw new Error(`Invalid inspection date: ${dateStr}`);
  }

  // Determine result based on violations
  const violations = d.violations as string[] || [];
  const violationCount = violations.length;
  let normalizedResult = violationCount === 0 ? 'Pass' : 'Violations Found';

  return {
    externalId: raw.externalId,

    facility: {
      externalId: String(d.facilityId || raw.externalId),
      rawName: String(d.facilityName || "Unknown Facility"),
      rawAddress: String(d.address || ""),
      rawCity: d.city ? String(d.city) : "HOUSTON",
      rawState: "TX",
      rawZip: d.zip ? String(d.zip) : null,
      latitude: null,
      longitude: null,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: "Routine", // Houston doesn't specify type
      rawResult: normalizedResult,
      rawScore: violationCount > 0 ? String(violationCount) : null,
      demerits: violationCount,
      sourceUrl: `https://tx.healthinspections.us/houston/estab.cfm?facilityID=${d.facilityId}`,
      reportUrl: null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}
