import crypto from "crypto";

export function hashPayload(payload: Record<string, unknown>): string {
  const sorted = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash("sha256").update(sorted).digest("hex");
}
