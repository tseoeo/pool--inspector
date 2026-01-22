import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";

/**
 * Transformer for Mecklenburg County NC CDP Portal data
 *
 * Data comes from NC Environmental Health public portal with fields:
 * - stateId: State permit ID (e.g., "2060530230")
 * - facilityName: Premises name
 * - address: Street address
 * - establishmentType: e.g., "53 - Year-Round Swimming Pool"
 * - inspectionDate: MM/DD/YYYY format
 * - score: Numeric score (lower is better for demerits)
 * - grade: Letter grade (A, B, C, or N/A)
 */
export function transformMecklenburg(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data as Record<string, string | null>;

  // Parse date - format is MM/DD/YYYY
  const dateStr = d.inspectionDate || "";
  let inspectionDate: Date;

  if (dateStr) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      inspectionDate = new Date(year, month, day);
    } else {
      inspectionDate = new Date(dateStr);
    }
  } else {
    inspectionDate = new Date();
  }

  if (isNaN(inspectionDate.getTime())) {
    inspectionDate = new Date();
  }

  // Use state ID as facility external ID
  const stateId = d.stateId || "";
  const facilityExternalId = `mecklenburg-${stateId || raw.externalId}`.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Parse score (numeric)
  let rawScore: number | null = null;
  if (d.score) {
    const parsed = parseFloat(d.score);
    if (!isNaN(parsed)) {
      rawScore = parsed;
    }
  }

  // Map grade to result
  let rawResult: string | null = null;
  const grade = (d.grade || "").toUpperCase().trim();
  if (grade === "A") {
    rawResult = "Pass - Grade A";
  } else if (grade === "B") {
    rawResult = "Pass - Grade B";
  } else if (grade === "C") {
    rawResult = "Conditional - Grade C";
  } else if (grade === "N/A" || grade === "") {
    rawResult = "Inspected";
  } else {
    rawResult = `Grade: ${grade}`;
  }

  // Extract city from address if possible, default to Charlotte
  let city = "Charlotte";
  const address = d.address || "";
  // NC addresses often end with city, state zip
  const cityMatch = address.match(/,\s*([^,]+),?\s*NC/i);
  if (cityMatch) {
    city = cityMatch[1].trim();
  }

  return {
    externalId: raw.externalId,

    facility: {
      externalId: facilityExternalId,
      rawName: d.facilityName || "Unknown Pool",
      rawAddress: address,
      rawCity: city,
      rawState: "NC",
      rawZip: null, // Would need to extract from address
      latitude: null,
      longitude: null,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.establishmentType || "Pool Inspection",
      rawResult,
      rawScore,
      demerits: rawScore, // NC uses demerit system (lower is better)
      sourceUrl: d.detailUrl || null,
      reportUrl: d.detailUrl || null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}
