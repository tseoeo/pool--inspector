import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";
import { parseNumber } from "../utils";

/**
 * Transform Louisville Metro KY ArcGIS data to canonical format
 *
 * Raw data structure:
 * {
 *   InspectionID: number,
 *   Facility_ID: number,
 *   Facility_Name: string,
 *   Facility_Address: string,
 *   Facility_City: string,
 *   Facility_State: string,
 *   Facility_Postal_Code: number,
 *   Facility_County: string,
 *   Venue_Type: string ("HOT TUB / SPA", "POOL", etc.),
 *   Inspection_Date: number (epoch ms),
 *   Inspection_Score: number,
 *   Inspection_Purpose: string ("ROUTINE", etc.),
 *   Inspection_Passed: string ("TRUE"/"FALSE"),
 *   No_Imminent_Health_Hazards: string,
 *   Disinfectant: string,
 *   Free_Chlorine: number,
 *   pH: number,
 *   Inspection_Notes: string,
 *   ObjectId: number
 * }
 */
export function transformLouisville(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data;

  // Louisville uses epoch milliseconds for Inspection_Date
  const inspectionDateMs = parseNumber(d.Inspection_Date);
  if (!inspectionDateMs) {
    throw new Error(`Invalid Inspection_Date: ${d.Inspection_Date}`);
  }
  const inspectionDate = new Date(inspectionDateMs);
  if (isNaN(inspectionDate.getTime())) {
    throw new Error(`Invalid Inspection_Date: ${d.Inspection_Date}`);
  }

  // Determine result based on Inspection_Passed and No_Imminent_Health_Hazards
  let rawResult = "UNKNOWN";
  if (d.Inspection_Passed === "TRUE") {
    rawResult = "PASS";
  } else if (d.No_Imminent_Health_Hazards === "FALSE") {
    rawResult = "FAIL - IMMINENT HEALTH HAZARD";
  } else {
    rawResult = "FAIL";
  }

  // Get coordinates from geometry if available
  const latitude = parseNumber(d._geometry_y);
  const longitude = parseNumber(d._geometry_x);

  return {
    externalId: raw.externalId,

    facility: {
      externalId: String(d.Facility_ID || d.InspectionID || ""),
      rawName: String(d.Facility_Name || "Unknown Facility"),
      rawAddress: String(d.Facility_Address || ""),
      rawCity: d.Facility_City ? String(d.Facility_City) : "Louisville",
      rawState: d.Facility_State ? String(d.Facility_State) : "KY",
      rawZip: d.Facility_Postal_Code ? String(d.Facility_Postal_Code) : null,
      latitude,
      longitude,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.Venue_Type ? String(d.Venue_Type) : null,
      rawResult,
      rawScore: d.Inspection_Score != null ? String(d.Inspection_Score) : null,
      demerits: null,
      sourceUrl: null,
      reportUrl: null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}
