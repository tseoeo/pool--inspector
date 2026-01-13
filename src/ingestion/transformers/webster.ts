import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";
import { parseDate, parseNumber } from "../utils";

export function transformWebster(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data;

  // Webster uses Inspect_Date - could be timestamp or string
  const inspectionDate = parseDate(d.Inspect_Date);
  if (!inspectionDate) {
    throw new Error(`Invalid Inspect_Date: ${d.Inspect_Date}`);
  }

  // Note: Webster has a typo in field name "Facilty_Name"
  const facilityName = String(
    d.Facilty_Name || d.Facility_Name || d.FacilityName || "Unknown Facility"
  );

  // Try to extract address from various possible field names
  const address = String(
    d.Address || d.STREET_ADDRESS || d.Location || ""
  );

  // Get coordinates from geometry if available
  const latitude = parseNumber(d._geometry_y) || parseNumber(d.Latitude);
  const longitude = parseNumber(d._geometry_x) || parseNumber(d.Longitude);

  return {
    externalId: raw.externalId,

    facility: {
      externalId: String(d.OBJECTID || ""),
      rawName: facilityName,
      rawAddress: address,
      rawCity: d.City ? String(d.City) : "Webster",
      rawState: d.State ? String(d.State) : "TX",
      rawZip: d.Zip ? String(d.Zip) : null,
      latitude,
      longitude,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.Inspection_Type ? String(d.Inspection_Type) : null,
      rawResult: d.Result || d.Status ? String(d.Result || d.Status) : null,
      rawScore: d.Score ? String(d.Score) : null,
      demerits: parseNumber(d.Demerits),
      sourceUrl: d.Hyperlink ? String(d.Hyperlink) : null,
      reportUrl: d.Report_URL || d.Hyperlink ? String(d.Report_URL || d.Hyperlink) : null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}
