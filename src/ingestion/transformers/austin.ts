import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";
import { parseDate, parseNumber } from "../utils";

export function transformAustin(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data;

  const inspectionDate = parseDate(d.inspection_date);
  if (!inspectionDate) {
    throw new Error(`Invalid inspection_date: ${d.inspection_date}`);
  }

  return {
    externalId: raw.externalId,

    facility: {
      externalId: String(d.facility_id || ""),
      rawName: String(d.facility_name || "Unknown Facility"),
      rawAddress: String(d.street_address || ""),
      rawCity: d.city_desc ? String(d.city_desc) : "Austin",
      rawState: d.state_desc ? String(d.state_desc) : "TX",
      rawZip: d.zip_code ? String(d.zip_code) : null,
      latitude: parseNumber(d.latitude),
      longitude: parseNumber(d.longitude),
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.inspection_type ? String(d.inspection_type) : null,
      rawResult: d.inspection_result ? String(d.inspection_result) : null,
      rawScore: d.score ? String(d.score) : null,
      demerits: null,
      sourceUrl: null,
      reportUrl: null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}
