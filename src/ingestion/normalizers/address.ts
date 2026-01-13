const STREET_ABBREVIATIONS: Record<string, string> = {
  STREET: "ST",
  AVENUE: "AVE",
  BOULEVARD: "BLVD",
  DRIVE: "DR",
  ROAD: "RD",
  LANE: "LN",
  COURT: "CT",
  CIRCLE: "CIR",
  PLACE: "PL",
  PARKWAY: "PKWY",
  HIGHWAY: "HWY",
  TERRACE: "TER",
  TRAIL: "TRL",
  WAY: "WAY",
  NORTH: "N",
  SOUTH: "S",
  EAST: "E",
  WEST: "W",
  NORTHEAST: "NE",
  NORTHWEST: "NW",
  SOUTHEAST: "SE",
  SOUTHWEST: "SW",
  APARTMENT: "APT",
  SUITE: "STE",
  BUILDING: "BLDG",
  FLOOR: "FL",
  UNIT: "UNIT",
};

export function normalizeAddress(raw: string): string {
  if (!raw) return "";

  let normalized = raw
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/[.,#]/g, "") // Remove punctuation
    .replace(/\bSUITE\s*/gi, "STE ")
    .replace(/\bAPT\.?\s*/gi, "APT ")
    .replace(/\bUNIT\s*/gi, "UNIT ")
    .replace(/\bBLDG\.?\s*/gi, "BLDG ");

  // Apply abbreviations
  for (const [full, abbr] of Object.entries(STREET_ABBREVIATIONS)) {
    normalized = normalized.replace(new RegExp(`\\b${full}\\b`, "g"), abbr);
  }

  return normalized.trim();
}

export function formatDisplayAddress(parts: {
  rawAddress: string;
  rawCity?: string | null;
  rawState?: string | null;
  rawZip?: string | null;
}): string {
  const address = toTitleCase(parts.rawAddress || "");
  const city = toTitleCase(parts.rawCity || "");
  const state = (parts.rawState || "").toUpperCase();
  const zip = parts.rawZip || "";

  const cityStateZip = [city, state].filter(Boolean).join(", ");
  const fullCityStateZip = [cityStateZip, zip].filter(Boolean).join(" ");

  return fullCityStateZip ? `${address}, ${fullCityStateZip}` : address;
}

export function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\b(Llc|Inc|Lp|Corp)\b/gi, (match) => match.toUpperCase())
    .replace(/\bMc(\w)/gi, (_, char) => `Mc${char.toUpperCase()}`)
    .replace(/\bO'(\w)/gi, (_, char) => `O'${char.toUpperCase()}`);
}
