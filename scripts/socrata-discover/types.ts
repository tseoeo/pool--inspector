/**
 * Type definitions for Socrata Discovery Tool
 */

// Verification status for discovered datasets
export type VerificationStatus = "VERIFIED" | "MAYBE" | "REJECT";

// Raw response from Socrata Discovery API
export interface SocrataDiscoveryResult {
  resource: {
    id: string;
    name: string;
    description?: string;
    attribution?: string;
    type: string;
    updatedAt?: string;
    createdAt?: string;
    columns_name?: string[];
    columns_field_name?: string[];
    download_count?: number;
  };
  classification: {
    domain_category?: string;
    domain_tags?: string[];
    categories?: string[];
    tags?: string[];
  };
  metadata: {
    domain: string;
  };
  permalink: string;
  link: string;
  owner?: {
    display_name?: string;
  };
}

// Processed candidate from discovery
export interface SocrataCandidate {
  source_type: "socrata";
  domain: string;
  resource_id: string;
  title: string;
  description: string;
  publisher: string;
  landing_url: string;
  soda_url: string;
  categories: string[];
  tags: string[];
  updated_at: string | null;
  created_at: string | null;
  provenance: {
    discovery_queries: string[];
    discovery_fetched_at: string;
    raw_result: SocrataDiscoveryResult;
  };
}

// Scored candidate with match signals
export interface ScoredCandidate extends SocrataCandidate {
  match_signals: {
    keyword_hits: string[];
    negative_hits: string[];
    score: number;
    passes_base_requirement: boolean;
  };
  verification_status: VerificationStatus;
}

// Matched candidate ready for import
export interface MatchedCandidate extends ScoredCandidate {
  matched_jurisdiction: {
    target_jurisdiction_id: string | null;
    jurisdiction_id: string | null;
    matched_name: string | null;
    matched_state: string | null;
    match_confidence: "high" | "medium" | "low" | "none";
    inferred_state: string | null;
    inferred_name: string | null;
  };
}

// Import result for a single candidate
export interface ImportResult {
  candidate: MatchedCandidate;
  target_jurisdiction_updated: boolean;
  target_jurisdiction_created: boolean;
  source_created: boolean;
  error?: string;
}

// CLI options
export interface DiscoverOptions {
  command: "crawl" | "filter" | "import" | "report" | "run-all";
  input?: string;
  output?: string;
  dryRun: boolean;
  resume: boolean;
  minStatus: "VERIFIED" | "MAYBE";
  verbose: boolean;
}

// Crawler state for resumability
export interface CrawlerState {
  query_index: number;
  offset: number;
  total_fetched: number;
  last_updated: string;
}

// Summary statistics
export interface DiscoverySummary {
  total_discovered: number;
  unique_datasets: number;
  verified_count: number;
  maybe_count: number;
  rejected_count: number;
  matched_to_existing: number;
  new_jurisdictions: number;
  sources_created: number;
  errors: number;
  top_verified: Array<{
    title: string;
    domain: string;
    resource_id: string;
    score: number;
  }>;
}
