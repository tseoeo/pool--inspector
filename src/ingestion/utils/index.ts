export { hashPayload } from "./hash";
export { withRetry } from "./retry";
export { generateSlug, generateUniqueSlug } from "./slug";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  if (typeof value === "number") {
    // Could be Unix timestamp (seconds or milliseconds)
    const ts = value > 1e12 ? value : value * 1000;
    return new Date(ts);
  }

  return null;
}

export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}
