import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";

/**
 * Transformer for San Diego County CA Accela Citizen Access data
 *
 * Data comes from permit records with fields:
 * - recordId: Permit number (e.g., "DEH2025-FPOOL-001234")
 * - recordType: "Pool - Parent", "Pool - Body of Water"
 * - facilityName: Project name or description
 * - description: Permit description
 * - status: "Issued", "Approved", "Pending Inspection", etc.
 * - dateStr: Date string
 */
export function transformSanDiego(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data as Record<string, string | null>;

  // Parse date - Accela dates are typically MM/DD/YYYY
  const dateStr = d.dateStr || "";
  let inspectionDate: Date;

  if (dateStr) {
    // Try MM/DD/YYYY format
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
    // Use current date if no date provided
    inspectionDate = new Date();
  }

  if (isNaN(inspectionDate.getTime())) {
    inspectionDate = new Date(); // Fallback to now
  }

  // Use record ID as facility external ID
  const recordId = d.recordId || raw.externalId;
  const facilityExternalId = `sandiego-${recordId}`.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Extract facility name from project name or description
  const facilityName = d.facilityName || d.description || "Unknown Pool Facility";

  // Map status to inspection result
  let rawResult: string | null = null;
  const status = (d.status || "").toLowerCase();
  if (status.includes("approved") || status.includes("issued")) {
    rawResult = "Pass";
  } else if (status.includes("pending")) {
    rawResult = "Pending";
  } else if (status.includes("denied") || status.includes("expired")) {
    rawResult = "Fail";
  } else if (status) {
    rawResult = d.status;
  }

  return {
    externalId: raw.externalId,

    facility: {
      externalId: facilityExternalId,
      rawName: facilityName,
      rawAddress: "", // Address not available in search results
      rawCity: "San Diego",
      rawState: "CA",
      rawZip: null,
      latitude: null,
      longitude: null,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.recordType || "Pool Permit",
      rawResult,
      rawScore: null, // Accela doesn't provide scores in search results
      demerits: null,
      sourceUrl: d.recordUrl || null,
      reportUrl: d.recordUrl || null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}
