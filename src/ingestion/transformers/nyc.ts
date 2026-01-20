import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";
import { parseDate, parseNumber } from "../utils";

// Map NYC borough codes to readable names
const BOROUGH_NAMES: Record<string, string> = {
  MA: "Manhattan",
  BX: "Bronx",
  QU: "Queens",
  BK: "Brooklyn",
  SI: "Staten Island",
};

/**
 * Infer pass/fail result from violation counts
 * NYC doesn't provide explicit pass/fail, so we derive it
 */
function inferResult(data: Record<string, unknown>): string {
  const allViolations = parseNumber(data.of_all_violations) || 0;
  const criticalViolations = parseNumber(data.of_critical_violations) || 0;
  const phhViolations = parseNumber(data.of_phh_violations) || 0;

  if (allViolations === 0) {
    return "Pass";
  }

  if (criticalViolations > 0 || phhViolations > 0) {
    return "Fail - Critical Violations";
  }

  return "Fail - Violations Found";
}

export function transformNYC(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data;

  const inspectionDate = parseDate(d.inspection_date);
  if (!inspectionDate) {
    throw new Error(`Invalid inspection_date: ${d.inspection_date}`);
  }

  // Map borough code to city name
  const boroughCode = String(d.bo || "").toUpperCase();
  const city = BOROUGH_NAMES[boroughCode] || "New York";

  // Combine address parts
  const addressParts = [d.address_no, d.address_st].filter(Boolean);
  const address = addressParts.join(" ").trim();

  // Infer result from violation counts
  const rawResult = inferResult(d as Record<string, unknown>);

  return {
    externalId: raw.externalId,

    facility: {
      externalId: String(d.accela || ""),
      rawName: String(d.facility_name || "Unknown Facility"),
      rawAddress: address || "Unknown Address",
      rawCity: city,
      rawState: "NY",
      rawZip: d.zip ? String(d.zip) : null,
      latitude: parseNumber(d.lat),
      longitude: parseNumber(d.long),
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.inspection_type ? String(d.inspection_type) : null,
      rawResult,
      rawScore: null, // NYC doesn't provide numeric scores
      demerits: null,
      sourceUrl: null,
      reportUrl: null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}
