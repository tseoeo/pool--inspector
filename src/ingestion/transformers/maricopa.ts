import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";
import { parseDate } from "../utils";

export function transformMaricopa(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data;

  // Parse date in M/D/YYYY format
  const inspectionDate = parseDate(d.inspectionDate);
  if (!inspectionDate) {
    throw new Error(`Invalid inspectionDate: ${d.inspectionDate}`);
  }

  // Determine result based on violations
  let result = "PASS";
  const violations = String(d.violations || "");
  const notes = String(d.inspectionNotes || "").toLowerCase();

  if (violations && violations.trim().length > 0) {
    result = "VIOLATIONS";
  }
  if (notes.includes("closure") || notes.includes("closed")) {
    result = "CLOSURE";
  }
  if (notes.includes("no violations noted")) {
    result = "PASS";
  }

  return {
    externalId: raw.externalId,

    facility: {
      externalId: String(d.permitId || ""),
      rawName: String(d.businessName || "Unknown Facility"),
      rawAddress: String(d.street || d.businessAddress || ""),
      rawCity: d.city ? String(d.city) : null,
      rawState: d.state ? String(d.state) : "AZ",
      rawZip: d.zip ? String(d.zip) : null,
      latitude: null, // Maricopa doesn't provide coordinates
      longitude: null,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.inspectionPurpose ? String(d.inspectionPurpose) : null,
      rawResult: result,
      rawScore: null, // Maricopa doesn't use numeric scores
      demerits: null,
      sourceUrl: d.sourceUrl ? String(d.sourceUrl) : null,
      reportUrl: d.sourceUrl ? String(d.sourceUrl) : null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}
