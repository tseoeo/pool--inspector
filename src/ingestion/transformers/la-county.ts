import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";
import { parseDate } from "../utils";

export function transformLACounty(raw: RawPayload, _source: Source): CanonicalRecord {
  const d = raw.data;

  // Parse inspection date
  const inspectionDate = parseDate(d.inspectionDate);
  if (!inspectionDate) {
    throw new Error(`Invalid inspectionDate: ${d.inspectionDate}`);
  }

  // Normalize the result
  const result = normalizeResult(
    d.inspectionResult ? String(d.inspectionResult) : null,
    d.inspectionScore ? String(d.inspectionScore) : null
  );

  return {
    externalId: raw.externalId,

    facility: {
      externalId: String(d.facilityId || ""),
      rawName: String(d.facilityName || "Unknown Pool"),
      rawAddress: String(d.street || d.facilityAddress || ""),
      rawCity: d.city ? String(d.city) : "Los Angeles",
      rawState: d.state ? String(d.state) : "CA",
      rawZip: d.zip ? String(d.zip) : null,
      latitude: null, // LA County eCompliance doesn't provide coordinates
      longitude: null,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.poolType ? String(d.poolType) : null,
      rawResult: result,
      rawScore: d.inspectionScore ? String(d.inspectionScore) : null,
      demerits: null,
      sourceUrl: d.sourceUrl ? String(d.sourceUrl) : null,
      reportUrl: null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}

function normalizeResult(
  result: string | null,
  score: string | null
): string {
  const resultLower = (result || "").toLowerCase();
  const scoreNum = parseFloat(score || "0");

  // Common LA County result types
  if (resultLower.includes("pass") || resultLower.includes("approved")) {
    return "PASS";
  }
  if (
    resultLower.includes("fail") ||
    resultLower.includes("closed") ||
    resultLower.includes("unsatisfactory")
  ) {
    return "FAIL";
  }
  if (
    resultLower.includes("violation") ||
    resultLower.includes("corrective")
  ) {
    return "VIOLATIONS";
  }
  if (
    resultLower.includes("re-inspect") ||
    resultLower.includes("follow")
  ) {
    return "REINSPECTION";
  }

  // Score-based determination (if available)
  if (scoreNum > 0) {
    if (scoreNum >= 90) return "PASS";
    if (scoreNum >= 70) return "VIOLATIONS";
    return "FAIL";
  }

  // Default to pass if no clear indicator
  return "PASS";
}
