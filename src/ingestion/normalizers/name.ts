export function normalizeFacilityName(raw: string): string {
  if (!raw) return "";

  return raw
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/['"]/g, "")
    .replace(/^THE\s+/i, "")
    .replace(/\s+(POOL|SPA|HOT TUB|SWIMMING POOL|AQUATIC CENTER)$/i, "")
    .replace(/\bL\.?L\.?C\.?/g, "LLC")
    .replace(/\bINC\.?/g, "INC")
    .replace(/\bCORP\.?/g, "CORP")
    .replace(/\bCO\.?/g, "CO")
    .replace(/\bL\.?P\.?/g, "LP")
    .trim();
}

export function formatDisplayName(raw: string): string {
  if (!raw) return "";

  return raw
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\b(Llc|Inc|Lp|Corp|Co)\b/gi, (match) => match.toUpperCase())
    .replace(/\bMc(\w)/gi, (_, char) => `Mc${char.toUpperCase()}`)
    .replace(/\bO'(\w)/gi, (_, char) => `O'${char.toUpperCase()}`)
    .replace(/\b(Hoa)\b/gi, "HOA")
    .replace(/\b(Ymca)\b/gi, "YMCA")
    .trim();
}
