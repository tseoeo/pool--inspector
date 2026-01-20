import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";
import { parseNumber } from "../utils";

/**
 * Transform Jackson County OR ArcGIS Environmental Health data to canonical format
 *
 * Raw data structure:
 * {
 *   OBJECTID: number,
 *   Name: string,
 *   PhysicalAddress: string,
 *   PhysicalCity: string,
 *   PhysicalPostalCode: number,
 *   InspectionDate: number (epoch ms),
 *   Type_1: string (inspection type),
 *   module_1: string ("Pool"),
 *   InspectionOutcome: string | null,
 *   TotalViolations: number,
 *   Link: string (report URL)
 * }
 */
export function transformJacksonCountyOR(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data;

  // Jackson County uses epoch milliseconds for InspectionDate
  const inspectionDateMs = parseNumber(d.InspectionDate);
  if (!inspectionDateMs) {
    throw new Error(`Invalid InspectionDate: ${d.InspectionDate}`);
  }
  const inspectionDate = new Date(inspectionDateMs);
  if (isNaN(inspectionDate.getTime())) {
    throw new Error(`Invalid InspectionDate: ${d.InspectionDate}`);
  }

  // Determine result based on violations
  const totalViolations = parseNumber(d.TotalViolations) || 0;
  let rawResult = d.InspectionOutcome ? String(d.InspectionOutcome) : null;
  if (!rawResult) {
    rawResult = totalViolations === 0 ? "PASS" : "VIOLATIONS FOUND";
  }

  // Get coordinates from geometry if available
  const latitude = parseNumber(d._geometry_y);
  const longitude = parseNumber(d._geometry_x);

  return {
    externalId: raw.externalId,

    facility: {
      externalId: String(d.OBJECTID || ""),
      rawName: String(d.Name || "Unknown Pool"),
      rawAddress: String(d.PhysicalAddress || ""),
      rawCity: d.PhysicalCity ? String(d.PhysicalCity) : null,
      rawState: "OR",
      rawZip: d.PhysicalPostalCode ? String(d.PhysicalPostalCode) : null,
      latitude,
      longitude,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.Type_1 ? String(d.Type_1) : null,
      rawResult,
      rawScore: null,
      demerits: totalViolations > 0 ? totalViolations : null,
      sourceUrl: d.Link ? String(d.Link) : null,
      reportUrl: d.Link ? String(d.Link) : null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}
