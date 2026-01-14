import type { Source } from "@prisma/client";
import type { RawPayload, CanonicalRecord } from "@/types/ingestion";
import { parseDate, parseNumber } from "../utils";

interface Geolocation {
  latitude?: string;
  longitude?: string;
  human_address?: string;
}

export function transformMontgomeryMD(raw: RawPayload, source: Source): CanonicalRecord {
  const d = raw.data;

  const inspectionDate = parseDate(d.inspection_date);
  if (!inspectionDate) {
    throw new Error(`Invalid inspection_date: ${d.inspection_date}`);
  }

  // Extract geolocation if available
  const geo = d.geolocation as Geolocation | undefined;
  const latitude = geo?.latitude ? parseNumber(geo.latitude) : null;
  const longitude = geo?.longitude ? parseNumber(geo.longitude) : null;

  // Determine result - if no inspection_results field, check compliance fields
  let rawResult = d.inspection_results ? String(d.inspection_results) : null;
  if (!rawResult) {
    // If all compliance fields are "In Compliance", it's a pass
    const complianceFields = [
      d.lifeguard_on_deck,
      d.main_drains_visible,
      d.recirculation_system_operating,
      d.water_level_adequate,
      d.disinfection_system_operating,
      d.bathhouse_operational,
      d.dhhs_permitted_entry,
      d.immediate_hazard_absent,
      d.cpr_certified_personnel,
      d.water_chemistry,
    ];

    const allCompliant = complianceFields.every(
      (f) => !f || f === "In Compliance"
    );
    rawResult = allCompliant ? "In Compliance" : "Violation Found";
  }

  return {
    externalId: raw.externalId,

    facility: {
      externalId: String(d.establishmentid || ""),
      rawName: String(d.establishment_name || "Unknown Facility"),
      rawAddress: String(d.street_address || ""),
      rawCity: d.city ? String(d.city) : null,
      rawState: "MD",
      rawZip: d.zip_code ? String(d.zip_code) : null,
      latitude,
      longitude,
    },

    inspection: {
      inspectionDate,
      rawInspectionType: d.inspection_type ? String(d.inspection_type) : null,
      rawResult,
      rawScore: null, // Montgomery County doesn't use numeric scores
      demerits: null,
      sourceUrl: null,
      reportUrl: null,
    },

    rawPayload: d as Record<string, unknown>,
  };
}
