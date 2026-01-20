import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";
import { parseNumber } from "../utils";

/**
 * Transform Arlington TX ArcGIS data to canonical format
 *
 * Raw data structure:
 * {
 *   OBJECTID: number,
 *   FOLDERRSN: number,
 *   FacilityName: string,
 *   PoolType: string ("Apartment", etc.),
 *   PoolDescription: string ("Year-Round Pool", etc.),
 *   PropertyAddress: string,
 *   Inspection: string (inspection type),
 *   InspectionDateString: string,
 *   InspectionScore: string,
 *   Attempt: string,
 *   Status: string,
 *   PROPHOUSE: string,
 *   STREET: string,
 *   TYPE: string (street type),
 *   CITY: string,
 *   STATE: string,
 *   ZIPCODE: string,
 *   InspectionDate: number (epoch ms),
 *   XCoord: number,
 *   YCoord: number
 * }
 */
export function transformArlington(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data;

  // Arlington uses epoch milliseconds for InspectionDate
  const inspectionDateMs = parseNumber(d.InspectionDate);
  if (!inspectionDateMs) {
    throw new Error(`Invalid InspectionDate: ${d.InspectionDate}`);
  }
  const inspectionDate = new Date(inspectionDateMs);
  if (isNaN(inspectionDate.getTime())) {
    throw new Error(`Invalid InspectionDate: ${d.InspectionDate}`);
  }

  // Build address from components
  const address = d.PropertyAddress
    ? String(d.PropertyAddress).trim()
    : [d.PROPHOUSE, d.DIR, d.STREET, d.TYPE]
        .filter(Boolean)
        .map((s) => String(s).trim())
        .filter((s) => s.length > 0)
        .join(" ");

  // Parse inspection score as number for result determination
  const score = parseNumber(d.InspectionScore);
  let rawResult = d.Status ? String(d.Status) : null;
  if (score !== null) {
    // Scores 70+ typically pass in Texas
    rawResult = score >= 70 ? "PASS" : "FAIL";
  }

  // Note: Arlington uses state plane coordinates (XCoord/YCoord), not lat/lon
  // Would need projection conversion - for now, use _geometry_x/_geometry_y if available
  const latitude = parseNumber(d._geometry_y);
  const longitude = parseNumber(d._geometry_x);

  return {
    externalId: raw.externalId,

    facility: {
      externalId: String(d.FOLDERRSN || d.OBJECTID || ""),
      rawName: String(d.FacilityName || "Unknown Pool"),
      rawAddress: address,
      rawCity: d.CITY ? String(d.CITY).trim() : "Arlington",
      rawState: d.STATE ? String(d.STATE).trim() : "TX",
      rawZip: d.ZIPCODE ? String(d.ZIPCODE).trim() : null,
      latitude,
      longitude,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.Inspection ? String(d.Inspection) : d.PoolType ? String(d.PoolType) : null,
      rawResult,
      rawScore: d.InspectionScore != null ? String(d.InspectionScore) : null,
      demerits: null,
      sourceUrl: null,
      reportUrl: null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}
