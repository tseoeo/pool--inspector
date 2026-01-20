import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";

/**
 * Transformer for Hillsborough County FL eBridge data
 *
 * eBridge provides document index data with fields:
 * - permitNumber: e.g., "29-60-1580304"
 * - facilityName: e.g., "Ballentrae Swimming Pool"
 * - address: e.g., "11864 Thicket Wood Drive"
 * - zipCode: e.g., "33579"
 * - inspectionDate: YYYYMMDD format, e.g., "20250411"
 * - documentType: e.g., "Inspection Report"
 */
export function transformHillsborough(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data as Record<string, string>;

  // Parse date from YYYYMMDD format
  const dateStr = d.inspectionDate || d.docDate || "";
  let inspectionDate: Date;

  if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
    // YYYYMMDD format
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1; // JS months are 0-indexed
    const day = parseInt(dateStr.substring(6, 8), 10);
    inspectionDate = new Date(year, month, day);
  } else {
    // Try standard date parsing
    inspectionDate = new Date(dateStr);
  }

  if (isNaN(inspectionDate.getTime())) {
    throw new Error(`Invalid inspection date: ${dateStr}`);
  }

  // Use permit number as facility external ID
  const permitNumber = d.permitNumber || "";
  const facilityExternalId = `hillsborough-${permitNumber}`;

  return {
    externalId: raw.externalId,

    facility: {
      externalId: facilityExternalId,
      rawName: d.facilityName || "Unknown Facility",
      rawAddress: d.address || "",
      rawCity: "Tampa", // Hillsborough County encompasses Tampa
      rawState: "FL",
      rawZip: d.zipCode || null,
      latitude: null, // eBridge doesn't provide coordinates
      longitude: null,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.documentType || "Inspection",
      rawResult: null, // eBridge indexes documents, not inspection results
      rawScore: null,
      demerits: null,
      sourceUrl: null,
      reportUrl: null, // Could construct eBridge document URL if needed
    },

    rawPayload: d as Record<string, unknown>,
  };
}
