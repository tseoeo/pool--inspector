import { InspectionResult, InspectionType } from "@prisma/client";

const RESULT_MAPPINGS: Record<string, InspectionResult> = {
  PASS: InspectionResult.PASS,
  PASSED: InspectionResult.PASS,
  COMPLIANT: InspectionResult.PASS,
  APPROVED: InspectionResult.PASS,
  SATISFACTORY: InspectionResult.PASS,
  "IN COMPLIANCE": InspectionResult.PASS,
  ADEQUATE: InspectionResult.PASS,

  FAIL: InspectionResult.FAIL,
  FAILED: InspectionResult.FAIL,
  "NON-COMPLIANT": InspectionResult.FAIL,
  "NON COMPLIANT": InspectionResult.FAIL,
  NONCOMPLIANT: InspectionResult.FAIL,
  "NOT IN COMPLIANCE": InspectionResult.FAIL,
  UNSATISFACTORY: InspectionResult.FAIL,
  VIOLATION: InspectionResult.FAIL,

  CLOSED: InspectionResult.CLOSED,
  CLOSURE: InspectionResult.CLOSED,
  "CLOSED FOR INSPECTION": InspectionResult.CLOSED,
  SUSPENDED: InspectionResult.CLOSED,

  CONDITIONAL: InspectionResult.CONDITIONAL_PASS,
  "CONDITIONAL PASS": InspectionResult.CONDITIONAL_PASS,
  "CONDITIONALLY APPROVED": InspectionResult.CONDITIONAL_PASS,
  "PASS WITH CONDITIONS": InspectionResult.CONDITIONAL_PASS,

  "NOT INSPECTED": InspectionResult.NOT_INSPECTED,
  "NO INSPECTION": InspectionResult.NOT_INSPECTED,
  CANCELLED: InspectionResult.NOT_INSPECTED,
  CANCELED: InspectionResult.NOT_INSPECTED,
  "NO ACCESS": InspectionResult.NOT_INSPECTED,

  PENDING: InspectionResult.PENDING,
  "IN PROGRESS": InspectionResult.PENDING,
  SCHEDULED: InspectionResult.PENDING,
};

const TYPE_MAPPINGS: Record<string, InspectionType> = {
  ROUTINE: InspectionType.ROUTINE,
  REGULAR: InspectionType.ROUTINE,
  ANNUAL: InspectionType.ROUTINE,
  SCHEDULED: InspectionType.ROUTINE,

  "FOLLOW-UP": InspectionType.FOLLOW_UP,
  FOLLOW_UP: InspectionType.FOLLOW_UP,
  FOLLOWUP: InspectionType.FOLLOW_UP,
  "FOLLOW UP": InspectionType.FOLLOW_UP,
  REINSPECTION: InspectionType.REINSPECTION,
  "RE-INSPECTION": InspectionType.REINSPECTION,

  COMPLAINT: InspectionType.COMPLAINT,
  "COMPLAINT BASED": InspectionType.COMPLAINT,

  OPENING: InspectionType.OPENING,
  "PRE-OPENING": InspectionType.OPENING,
  "NEW CONSTRUCTION": InspectionType.OPENING,
  INITIAL: InspectionType.OPENING,

  CLOSING: InspectionType.CLOSING,
  CLOSURE: InspectionType.CLOSING,
};

export function normalizeInspectionResult(
  raw: string | null
): InspectionResult | null {
  if (!raw) return null;

  const normalized = raw.toUpperCase().trim();

  // Direct match
  if (RESULT_MAPPINGS[normalized]) {
    return RESULT_MAPPINGS[normalized];
  }

  // Partial match
  for (const [key, value] of Object.entries(RESULT_MAPPINGS)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  return InspectionResult.OTHER;
}

export function normalizeInspectionType(
  raw: string | null
): InspectionType | null {
  if (!raw) return null;

  const normalized = raw.toUpperCase().trim();

  // Direct match
  if (TYPE_MAPPINGS[normalized]) {
    return TYPE_MAPPINGS[normalized];
  }

  // Partial match
  for (const [key, value] of Object.entries(TYPE_MAPPINGS)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  return InspectionType.OTHER;
}

export function isClosure(
  result: InspectionResult | null,
  rawResult: string | null
): boolean {
  if (result === InspectionResult.CLOSED) return true;
  if (!rawResult) return false;

  const upper = rawResult.toUpperCase();
  return (
    upper.includes("CLOSED") ||
    upper.includes("CLOSURE") ||
    upper.includes("SUSPENDED")
  );
}

export function isPassing(result: InspectionResult | null): boolean | null {
  if (!result) return null;

  switch (result) {
    case InspectionResult.PASS:
    case InspectionResult.CONDITIONAL_PASS:
      return true;
    case InspectionResult.FAIL:
    case InspectionResult.CLOSED:
      return false;
    default:
      return null;
  }
}
