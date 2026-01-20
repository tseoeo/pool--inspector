/**
 * Match discovered datasets to TargetJurisdiction records
 */

import type { ScoredCandidate, MatchedCandidate } from "./types";
import type { TargetJurisdiction } from "@prisma/client";

// US state codes
const STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};

// Reverse lookup: code to full name
const STATE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_CODES).map(([name, code]) => [code, name])
);

// Common city/domain patterns
const DOMAIN_PATTERNS = [
  // data.cityname.gov
  /^data\.([a-z]+)\.gov$/,
  // data.cityofXXX.gov
  /^data\.cityof([a-z]+)\.gov$/,
  // data.statename.gov
  /^data\.([a-z]+)\.us$/,
  // cityname.data.socrata.com
  /^([a-z]+)\.data\.socrata\.com$/,
  // data.cityname-state.gov
  /^data\.([a-z]+)-([a-z]{2})\.gov$/,
];

// Known city-to-state mappings for common cities
const KNOWN_CITIES: Record<string, string> = {
  austin: "TX", houston: "TX", dallas: "TX", "san antonio": "TX",
  "fort worth": "TX", webster: "TX", plano: "TX",
  "new york": "NY", "los angeles": "CA", chicago: "IL", phoenix: "AZ",
  philadelphia: "PA", "san diego": "CA", "san jose": "CA", denver: "CO",
  seattle: "WA", boston: "MA", atlanta: "GA", miami: "FL",
  detroit: "MI", minneapolis: "MN", "kansas city": "MO",
  "san francisco": "CA", portland: "OR", sacramento: "CA",
  "las vegas": "NV", baltimore: "MD", milwaukee: "WI",
  albuquerque: "NM", tucson: "AZ", fresno: "CA", mesa: "AZ",
  "oklahoma city": "OK", omaha: "NE", raleigh: "NC", "virginia beach": "VA",
  "colorado springs": "CO", oakland: "CA", tulsa: "OK", arlington: "TX",
  tampa: "FL", "new orleans": "LA", cleveland: "OH", henderson: "NV",
  "montgomery county": "MD",
};

/**
 * Extract state code from domain or publisher
 */
function extractState(domain: string, publisher: string): string | null {
  const text = `${domain} ${publisher}`.toLowerCase();

  // Check for state code patterns (e.g., "TX", "California")
  for (const [stateName, stateCode] of Object.entries(STATE_CODES)) {
    if (text.includes(stateName)) {
      return stateCode;
    }
  }

  // Check for two-letter state codes
  const stateCodeMatch = text.match(/\b([a-z]{2})\b/g);
  if (stateCodeMatch) {
    for (const code of stateCodeMatch) {
      const upperCode = code.toUpperCase();
      if (STATE_NAMES[upperCode]) {
        return upperCode;
      }
    }
  }

  // Check for known cities
  for (const [city, state] of Object.entries(KNOWN_CITIES)) {
    if (text.includes(city)) {
      return state;
    }
  }

  return null;
}

/**
 * Extract jurisdiction name from domain or publisher
 */
function extractJurisdictionName(
  domain: string,
  publisher: string,
  title: string
): string | null {
  // Try domain patterns first
  for (const pattern of DOMAIN_PATTERNS) {
    const match = domain.match(pattern);
    if (match) {
      // Capitalize first letter of each word
      return match[1]
        .split(/[\s-_]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  // Try to extract from publisher
  const publisherLower = publisher.toLowerCase();

  // "City of X" pattern
  const cityOfMatch = publisherLower.match(/city of ([a-z\s]+)/);
  if (cityOfMatch) {
    return cityOfMatch[1]
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // "X County" pattern
  const countyMatch = publisherLower.match(/([a-z\s]+) county/);
  if (countyMatch) {
    const countyName = countyMatch[1]
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return `${countyName} County`;
  }

  // Extract from domain if it looks like a city name
  const domainParts = domain.split(".");
  if (domainParts.length >= 2) {
    const firstPart = domainParts[0].replace(/^data/, "");
    if (firstPart && firstPart.length > 2) {
      return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
    }
  }

  return null;
}

/**
 * Normalize string for fuzzy matching
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate similarity between two strings (Jaccard-like)
 */
function similarity(a: string, b: string): number {
  const setA = new Set(normalize(a).split(" "));
  const setB = new Set(normalize(b).split(" "));

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Find best matching TargetJurisdiction for a candidate
 */
export function findMatch(
  candidate: ScoredCandidate,
  targets: TargetJurisdiction[]
): {
  target: TargetJurisdiction | null;
  confidence: "high" | "medium" | "low" | "none";
  inferredState: string | null;
  inferredName: string | null;
} {
  const inferredState = extractState(candidate.domain, candidate.publisher);
  const inferredName = extractJurisdictionName(
    candidate.domain,
    candidate.publisher,
    candidate.title
  );

  // No name? Can't match
  if (!inferredName) {
    return {
      target: null,
      confidence: "none",
      inferredState,
      inferredName: null,
    };
  }

  // Filter targets by state if we have one
  let candidateTargets = targets;
  if (inferredState) {
    const stateMatches = targets.filter((t) => t.state === inferredState);
    if (stateMatches.length > 0) {
      candidateTargets = stateMatches;
    }
  }

  // Find best match by name similarity
  let bestMatch: TargetJurisdiction | null = null;
  let bestSimilarity = 0;

  for (const target of candidateTargets) {
    const sim = similarity(inferredName, target.name);

    // Also check if target name appears in the domain or publisher
    const exactInDomain =
      normalize(candidate.domain).includes(normalize(target.name)) ||
      normalize(candidate.publisher).includes(normalize(target.name));

    const adjustedSim = exactInDomain ? Math.max(sim, 0.8) : sim;

    if (adjustedSim > bestSimilarity) {
      bestSimilarity = adjustedSim;
      bestMatch = target;
    }
  }

  // Determine confidence
  let confidence: "high" | "medium" | "low" | "none";
  if (bestSimilarity >= 0.8) {
    confidence = "high";
  } else if (bestSimilarity >= 0.5) {
    confidence = "medium";
  } else if (bestSimilarity >= 0.3) {
    confidence = "low";
  } else {
    confidence = "none";
    bestMatch = null;
  }

  return {
    target: bestMatch,
    confidence,
    inferredState,
    inferredName,
  };
}

/**
 * Match a scored candidate to jurisdiction
 */
export function matchCandidate(
  candidate: ScoredCandidate,
  targets: TargetJurisdiction[]
): MatchedCandidate {
  const { target, confidence, inferredState, inferredName } = findMatch(
    candidate,
    targets
  );

  return {
    ...candidate,
    matched_jurisdiction: {
      target_jurisdiction_id: target?.id || null,
      jurisdiction_id: target?.jurisdictionId || null,
      matched_name: target?.name || null,
      matched_state: target?.state || null,
      match_confidence: confidence,
      inferred_state: inferredState,
      inferred_name: inferredName,
    },
  };
}

/**
 * Match multiple candidates
 */
export function matchCandidates(
  candidates: ScoredCandidate[],
  targets: TargetJurisdiction[]
): MatchedCandidate[] {
  return candidates.map((c) => matchCandidate(c, targets));
}
