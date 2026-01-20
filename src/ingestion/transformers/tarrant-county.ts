import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";

/**
 * Transform Tarrant County TX pool inspection data to canonical format
 *
 * Raw data structure (from scraper):
 * {
 *   facilityId: string,
 *   facilityName: string,
 *   facilityType: string (Spa, Pool, etc.),
 *   address: string,
 *   city: string,
 *   state: string,
 *   zip: string,
 *   inspectionDate: string (MM/DD/YYYY),
 *   inspectionType: string (Regular Inspection, Followup Inspection, etc.),
 *   result: string (Pass, Fail, etc.)
 * }
 */
export function transformTarrantCounty(raw: RawPayload, source: Source): CanonicalRecord {
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

  // Determine result - Tarrant uses Pass/Fail
  const rawResult = String(d.result || "");
  let normalizedResult = rawResult;

  // Build full address
  const addressParts = [d.address, d.city, d.state, d.zip].filter(Boolean);
  const fullAddress = addressParts.join(", ");

  return {
    externalId: raw.externalId,

    facility: {
      externalId: String(d.facilityId || raw.externalId),
      rawName: String(d.facilityName || "Unknown Facility"),
      rawAddress: String(d.address || ""),
      rawCity: d.city ? String(d.city) : null,
      rawState: "TX",
      rawZip: d.zip ? String(d.zip) : null,
      latitude: null,
      longitude: null,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.inspectionType ? String(d.inspectionType) : null,
      rawResult: normalizedResult,
      rawScore: null,
      demerits: null,
      sourceUrl: `https://poolinspection.tarrantcounty.com/detail.aspx?ID=${d.facilityId}`,
      reportUrl: null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}
