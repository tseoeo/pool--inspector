/**
 * Keyword-based scoring for pool/spa inspection dataset candidates
 */

import type {
  SocrataCandidate,
  ScoredCandidate,
  VerificationStatus,
} from "./types";

// Positive keywords with weights
const POSITIVE_KEYWORDS: Record<string, number> = {
  pool: 2,
  spa: 2,
  swimming: 1,
  aquatic: 1,
  bathing: 1,
  inspection: 3,
  inspections: 3,
  violation: 2,
  violations: 2,
  demerit: 2,
  demerits: 2,
  score: 1,
  closure: 2,
  closed: 2,
  health: 2,
  sanitation: 1,
  "public pool": 3,
  "environmental health": 2,
  "pool inspection": 4,
  "spa inspection": 4,
  "swimming pool": 2,
};

// Negative keywords with weights (negative values)
const NEGATIVE_KEYWORDS: Record<string, number> = {
  permit: -3,
  permits: -3,
  building: -3,
  construction: -3,
  "work order": -3,
  maintenance: -2,
  revenue: -3,
  fee: -2,
  fees: -2,
  tax: -3,
  property: -2,
  backflow: -2,
  fire: -2,
  restaurant: -2,
  food: -2,
  septic: -2,
  well: -2,
  license: -2,
  licensing: -2,
};

// Keywords required for base requirement
const INSPECTION_KEYWORDS = ["inspection", "inspections"];
const FACILITY_KEYWORDS = ["pool", "spa", "bathing", "aquatic", "swimming"];

/**
 * Combines title, description, tags, and categories into searchable text
 */
function getCombinedText(candidate: SocrataCandidate): string {
  const parts = [
    candidate.title,
    candidate.description,
    ...candidate.tags,
    ...candidate.categories,
    candidate.publisher,
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/**
 * Check if text passes base requirement:
 * Must contain (inspection OR inspections) AND (pool OR spa OR bathing OR aquatic)
 */
function passesBaseRequirement(text: string): boolean {
  const hasInspection = INSPECTION_KEYWORDS.some((kw) => text.includes(kw));
  const hasFacility = FACILITY_KEYWORDS.some((kw) => text.includes(kw));
  return hasInspection && hasFacility;
}

/**
 * Calculate score and find keyword matches
 */
function calculateScore(text: string): {
  score: number;
  keywordHits: string[];
  negativeHits: string[];
} {
  const keywordHits: string[] = [];
  const negativeHits: string[] = [];
  let score = 0;

  // Check positive keywords (longer phrases first to avoid double-counting)
  const sortedPositive = Object.entries(POSITIVE_KEYWORDS).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [keyword, weight] of sortedPositive) {
    if (text.includes(keyword)) {
      score += weight;
      keywordHits.push(keyword);
    }
  }

  // Check negative keywords
  const sortedNegative = Object.entries(NEGATIVE_KEYWORDS).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [keyword, weight] of sortedNegative) {
    if (text.includes(keyword)) {
      score += weight; // weight is already negative
      negativeHits.push(keyword);
    }
  }

  return { score, keywordHits, negativeHits };
}

/**
 * Determine verification status based on score and base requirement
 */
function getVerificationStatus(
  score: number,
  passesBase: boolean,
  negativeSum: number
): VerificationStatus {
  // If negative keywords dominate, reject unless strong positives
  if (negativeSum <= -5 && score < 10) {
    return "REJECT";
  }

  if (!passesBase) {
    return "REJECT";
  }

  if (score >= 8) {
    return "VERIFIED";
  }

  if (score >= 5) {
    return "MAYBE";
  }

  return "REJECT";
}

/**
 * Score a single candidate
 */
export function scoreCandidate(candidate: SocrataCandidate): ScoredCandidate {
  const text = getCombinedText(candidate);
  const passesBase = passesBaseRequirement(text);
  const { score, keywordHits, negativeHits } = calculateScore(text);

  const negativeSum = negativeHits.reduce(
    (sum, kw) => sum + (NEGATIVE_KEYWORDS[kw] || 0),
    0
  );

  const status = getVerificationStatus(score, passesBase, negativeSum);

  return {
    ...candidate,
    match_signals: {
      keyword_hits: keywordHits,
      negative_hits: negativeHits,
      score,
      passes_base_requirement: passesBase,
    },
    verification_status: status,
  };
}

/**
 * Score multiple candidates
 */
export function scoreCandidates(
  candidates: SocrataCandidate[]
): ScoredCandidate[] {
  return candidates.map(scoreCandidate);
}

/**
 * Filter to only VERIFIED and MAYBE candidates
 */
export function filterVerified(
  candidates: ScoredCandidate[],
  minStatus: "VERIFIED" | "MAYBE" = "VERIFIED"
): ScoredCandidate[] {
  if (minStatus === "VERIFIED") {
    return candidates.filter((c) => c.verification_status === "VERIFIED");
  }
  return candidates.filter((c) => c.verification_status !== "REJECT");
}

/**
 * Sort candidates by score descending
 */
export function sortByScore(candidates: ScoredCandidate[]): ScoredCandidate[] {
  return [...candidates].sort(
    (a, b) => b.match_signals.score - a.match_signals.score
  );
}
