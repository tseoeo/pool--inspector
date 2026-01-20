/**
 * Socrata Discovery API crawler
 *
 * Fetches pool/spa inspection datasets from the global Socrata catalog
 */

import * as fs from "fs";
import type {
  SocrataCandidate,
  SocrataDiscoveryResult,
  CrawlerState,
} from "./types";

// Socrata Discovery API endpoint
const DISCOVERY_API = "https://api.us.socrata.com/api/catalog/v1";

// Search queries to run (union results)
const SEARCH_QUERIES = [
  "pool inspections",
  "pool inspection",
  "swimming pool inspection",
  "spa inspection",
  "public pool inspection",
  "bathing establishment inspection",
  "aquatic facility inspection",
  "pool violations",
  "pool closure",
  "pool health inspection",
];

// Configuration
const BATCH_SIZE = 100;
const REQUEST_DELAY_MS = 200;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with retry and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "PoolInspectionIndex/1.0 Discovery",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (response.status === 429) {
        // Rate limited - wait longer
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt + 2);
        console.log(`  Rate limited, waiting ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      if (response.status >= 500) {
        // Server error - retry
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`  Server error ${response.status}, retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      return response;
    } catch (err) {
      lastError = err as Error;
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      console.log(`  Fetch error: ${lastError.message}, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Transform raw API result into our candidate format
 */
function transformResult(
  result: SocrataDiscoveryResult,
  query: string
): SocrataCandidate {
  const domain = result.metadata.domain;
  const resourceId = result.resource.id;

  return {
    source_type: "socrata",
    domain,
    resource_id: resourceId,
    title: result.resource.name || "",
    description: result.resource.description || "",
    publisher: result.owner?.display_name || result.resource.attribution || "",
    landing_url: `https://${domain}/d/${resourceId}`,
    soda_url: `https://${domain}/resource/${resourceId}.json`,
    categories: [
      ...(result.classification.categories || []),
      ...(result.classification.domain_category ? [result.classification.domain_category] : []),
    ],
    tags: [
      ...(result.classification.tags || []),
      ...(result.classification.domain_tags || []),
    ],
    updated_at: result.resource.updatedAt || null,
    created_at: result.resource.createdAt || null,
    provenance: {
      discovery_queries: [query],
      discovery_fetched_at: new Date().toISOString(),
      raw_result: result,
    },
  };
}

/**
 * Fetch a single page of results for a query
 */
async function fetchPage(
  query: string,
  offset: number,
  verbose: boolean
): Promise<SocrataDiscoveryResult[]> {
  const params = new URLSearchParams({
    only: "datasets",
    q: query,
    limit: BATCH_SIZE.toString(),
    offset: offset.toString(),
  });

  const url = `${DISCOVERY_API}?${params}`;

  if (verbose) {
    console.log(`  Fetching: ${url}`);
  }

  const response = await fetchWithRetry(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.results || [];
}

/**
 * Fetch all results for a single query
 */
async function fetchAllForQuery(
  query: string,
  verbose: boolean,
  onProgress?: (count: number) => void
): Promise<SocrataCandidate[]> {
  const candidates: SocrataCandidate[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const results = await fetchPage(query, offset, verbose);

    for (const result of results) {
      // Only include datasets (not charts, maps, etc.)
      if (result.resource.type === "dataset") {
        candidates.push(transformResult(result, query));
      }
    }

    if (verbose) {
      console.log(`  Fetched ${results.length} results (offset ${offset})`);
    }

    onProgress?.(candidates.length);

    hasMore = results.length === BATCH_SIZE;
    offset += BATCH_SIZE;

    // Rate limit
    if (hasMore) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return candidates;
}

/**
 * Deduplicate candidates by domain + resource_id
 */
function deduplicateCandidates(
  candidates: SocrataCandidate[]
): SocrataCandidate[] {
  const seen = new Map<string, SocrataCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.domain}:${candidate.resource_id}`;
    const existing = seen.get(key);

    if (existing) {
      // Merge discovery queries
      const queries = new Set([
        ...existing.provenance.discovery_queries,
        ...candidate.provenance.discovery_queries,
      ]);
      existing.provenance.discovery_queries = Array.from(queries);
    } else {
      seen.set(key, candidate);
    }
  }

  return Array.from(seen.values());
}

/**
 * Save crawler state for resumability
 */
function saveState(statePath: string, state: CrawlerState): void {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Load crawler state if exists
 */
function loadState(statePath: string): CrawlerState | null {
  if (fs.existsSync(statePath)) {
    const content = fs.readFileSync(statePath, "utf-8");
    return JSON.parse(content);
  }
  return null;
}

/**
 * Append candidate to JSONL file
 */
function appendToJsonl(filePath: string, candidate: SocrataCandidate): void {
  fs.appendFileSync(filePath, JSON.stringify(candidate) + "\n");
}

/**
 * Main crawler function
 */
export async function crawl(options: {
  outputPath: string;
  resume?: boolean;
  verbose?: boolean;
}): Promise<{ total: number; unique: number }> {
  const { outputPath, resume = false, verbose = false } = options;
  const statePath = outputPath + ".state";

  let state: CrawlerState = {
    query_index: 0,
    offset: 0,
    total_fetched: 0,
    last_updated: new Date().toISOString(),
  };

  // Resume from saved state if requested
  if (resume) {
    const savedState = loadState(statePath);
    if (savedState) {
      state = savedState;
      console.log(`Resuming from query ${state.query_index}, offset ${state.offset}`);
    }
  } else {
    // Start fresh - clear output file
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  }

  const allCandidates: SocrataCandidate[] = [];

  console.log(`\nCrawling Socrata Discovery API with ${SEARCH_QUERIES.length} queries...\n`);

  for (let i = state.query_index; i < SEARCH_QUERIES.length; i++) {
    const query = SEARCH_QUERIES[i];
    console.log(`[${i + 1}/${SEARCH_QUERIES.length}] Query: "${query}"`);

    try {
      const candidates = await fetchAllForQuery(query, verbose, (count) => {
        state.total_fetched = allCandidates.length + count;
        state.query_index = i;
        state.last_updated = new Date().toISOString();
        saveState(statePath, state);
      });

      console.log(`  Found ${candidates.length} datasets`);

      // Append to JSONL as we go (for large result sets)
      for (const candidate of candidates) {
        appendToJsonl(outputPath, candidate);
      }

      allCandidates.push(...candidates);
    } catch (err) {
      console.error(`  Error fetching query "${query}":`, err);
      // Save state so we can resume
      saveState(statePath, state);
      throw err;
    }

    // Rate limit between queries
    if (i < SEARCH_QUERIES.length - 1) {
      await sleep(REQUEST_DELAY_MS * 2);
    }
  }

  // Clean up state file on successful completion
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }

  // Deduplicate
  const uniqueCandidates = deduplicateCandidates(allCandidates);

  // Write deduplicated results
  fs.writeFileSync(
    outputPath,
    uniqueCandidates.map((c) => JSON.stringify(c)).join("\n") + "\n"
  );

  console.log(`\nCrawl complete!`);
  console.log(`  Total fetched: ${allCandidates.length}`);
  console.log(`  Unique datasets: ${uniqueCandidates.length}`);

  return {
    total: allCandidates.length,
    unique: uniqueCandidates.length,
  };
}

/**
 * Read candidates from JSONL file
 */
export function readCandidatesFromJsonl(filePath: string): SocrataCandidate[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n").filter(Boolean);

  return lines.map((line) => JSON.parse(line) as SocrataCandidate);
}
