#!/usr/bin/env tsx
/**
 * Socrata Discovery Tool
 *
 * Automatically discovers pool/spa inspection datasets from the Socrata catalog
 * and imports them into the database.
 *
 * Usage:
 *   npm run socrata:discover                    # Full run (crawl + filter + import)
 *   npm run socrata:discover -- crawl           # Just crawl
 *   npm run socrata:discover -- filter          # Just filter
 *   npm run socrata:discover -- import          # Just import
 *   npm run socrata:discover -- report          # Show report from files
 *   npm run socrata:discover -- --dry-run       # Don't write to DB
 *   npm run socrata:discover -- --resume        # Resume interrupted crawl
 *   npm run socrata:discover -- --verbose       # Verbose output
 */

import "dotenv/config";
import * as fs from "fs";
import { crawl, readCandidatesFromJsonl } from "./crawler";
import { scoreCandidates, filterVerified, sortByScore } from "./scorer";
import { matchCandidates } from "./matcher";
import {
  importCandidates,
  getAllTargetJurisdictions,
  disconnect,
} from "./importer";
import type { ScoredCandidate, MatchedCandidate, DiscoverySummary } from "./types";

// Default file paths
const DEFAULT_CANDIDATES_FILE = "socrata_candidates.jsonl";
const DEFAULT_VERIFIED_FILE = "socrata_verified.jsonl";
const DEFAULT_MATCHED_FILE = "socrata_matched.jsonl";

/**
 * Parse command line arguments
 */
function parseArgs(): {
  command: string;
  dryRun: boolean;
  resume: boolean;
  verbose: boolean;
  minStatus: "VERIFIED" | "MAYBE";
  input?: string;
  output?: string;
} {
  const args = process.argv.slice(2);
  const result: {
    command: string;
    dryRun: boolean;
    resume: boolean;
    verbose: boolean;
    minStatus: "VERIFIED" | "MAYBE";
    input: string | undefined;
    output: string | undefined;
  } = {
    command: "run-all",
    dryRun: false,
    resume: false,
    verbose: false,
    minStatus: "VERIFIED",
    input: undefined,
    output: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--resume") {
      result.resume = true;
    } else if (arg === "--verbose" || arg === "-v") {
      result.verbose = true;
    } else if (arg === "--min-status" && args[i + 1]) {
      const status = args[++i].toUpperCase();
      if (status === "MAYBE") {
        result.minStatus = "MAYBE";
      }
    } else if (arg === "--input" && args[i + 1]) {
      result.input = args[++i];
    } else if (arg === "--output" && args[i + 1]) {
      result.output = args[++i];
    } else if (!arg.startsWith("-")) {
      result.command = arg;
    }
  }

  return result;
}

/**
 * Write candidates to JSONL file
 */
function writeJsonl(path: string, items: unknown[]): void {
  fs.writeFileSync(path, items.map((i) => JSON.stringify(i)).join("\n") + "\n");
}

/**
 * Read JSONL file
 */
function readJsonl<T>(path: string): T[] {
  if (!fs.existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const content = fs.readFileSync(path, "utf-8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

/**
 * Crawl command - fetch datasets from Socrata Discovery API
 */
async function runCrawl(options: {
  output: string;
  resume: boolean;
  verbose: boolean;
}): Promise<void> {
  console.log("\n=== Crawling Socrata Discovery API ===\n");

  const result = await crawl({
    outputPath: options.output,
    resume: options.resume,
    verbose: options.verbose,
  });

  console.log(`\nResults written to: ${options.output}`);
  console.log(`  Total fetched: ${result.total}`);
  console.log(`  Unique datasets: ${result.unique}`);
}

/**
 * Filter command - score and filter candidates
 */
async function runFilter(options: {
  input: string;
  output: string;
  minStatus: "VERIFIED" | "MAYBE";
  verbose: boolean;
}): Promise<void> {
  console.log("\n=== Filtering Candidates ===\n");

  const candidates = readCandidatesFromJsonl(options.input);
  console.log(`Loaded ${candidates.length} candidates from ${options.input}`);

  const scored = scoreCandidates(candidates);
  const filtered = filterVerified(scored, options.minStatus);
  const sorted = sortByScore(filtered);

  // Count by status
  const verified = scored.filter((s) => s.verification_status === "VERIFIED").length;
  const maybe = scored.filter((s) => s.verification_status === "MAYBE").length;
  const rejected = scored.filter((s) => s.verification_status === "REJECT").length;

  console.log(`\nScoring results:`);
  console.log(`  VERIFIED: ${verified}`);
  console.log(`  MAYBE: ${maybe}`);
  console.log(`  REJECT: ${rejected}`);

  writeJsonl(options.output, sorted);
  console.log(`\nFiltered results written to: ${options.output}`);
  console.log(`  Total passed: ${sorted.length} (min status: ${options.minStatus})`);

  // Show top 10
  console.log(`\nTop 10 by score:`);
  for (const candidate of sorted.slice(0, 10)) {
    console.log(
      `  [${candidate.match_signals.score}] ${candidate.title} (${candidate.domain})`
    );
  }
}

/**
 * Import command - import matched candidates to database
 */
async function runImport(options: {
  input: string;
  dryRun: boolean;
  verbose: boolean;
}): Promise<void> {
  console.log("\n=== Importing to Database ===\n");

  if (options.dryRun) {
    console.log("DRY RUN - no database changes will be made\n");
  }

  // Load scored candidates
  const scored = readJsonl<ScoredCandidate>(options.input);
  console.log(`Loaded ${scored.length} candidates from ${options.input}`);

  // Get existing TargetJurisdictions
  const targets = await getAllTargetJurisdictions();
  console.log(`Found ${targets.length} existing TargetJurisdictions`);

  // Match candidates to jurisdictions
  console.log(`\nMatching candidates to jurisdictions...`);
  const matched = matchCandidates(scored, targets);

  // Write matched file for audit
  const matchedFile = options.input.replace(".jsonl", "_matched.jsonl");
  writeJsonl(matchedFile, matched);
  console.log(`Matched results written to: ${matchedFile}`);

  // Count match confidence
  const highConf = matched.filter(
    (m) => m.matched_jurisdiction.match_confidence === "high"
  ).length;
  const medConf = matched.filter(
    (m) => m.matched_jurisdiction.match_confidence === "medium"
  ).length;
  const lowConf = matched.filter(
    (m) => m.matched_jurisdiction.match_confidence === "low"
  ).length;
  const noConf = matched.filter(
    (m) => m.matched_jurisdiction.match_confidence === "none"
  ).length;

  console.log(`\nMatch confidence:`);
  console.log(`  High: ${highConf}`);
  console.log(`  Medium: ${medConf}`);
  console.log(`  Low: ${lowConf}`);
  console.log(`  None: ${noConf}`);

  // Import
  console.log(`\nImporting to database...`);
  const { results, summary } = await importCandidates(matched, {
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  console.log(`\nImport summary:`);
  console.log(`  TargetJurisdictions updated: ${summary.updated}`);
  console.log(`  TargetJurisdictions created: ${summary.created}`);
  console.log(`  Sources created: ${summary.sources}`);
  console.log(`  Skipped: ${summary.skipped}`);
  console.log(`  Errors: ${summary.errors}`);

  await disconnect();
}

/**
 * Report command - show summary from existing files
 */
async function runReport(options: {
  candidatesFile: string;
  verifiedFile: string;
}): Promise<void> {
  console.log("\n=== Discovery Report ===\n");

  // Check files exist
  if (!fs.existsSync(options.candidatesFile)) {
    console.log(`Candidates file not found: ${options.candidatesFile}`);
    console.log("Run 'crawl' first to generate candidates.");
    return;
  }

  const candidates = readCandidatesFromJsonl(options.candidatesFile);
  console.log(`Total candidates: ${candidates.length}`);

  if (fs.existsSync(options.verifiedFile)) {
    const verified = readJsonl<ScoredCandidate>(options.verifiedFile);

    const verifiedCount = verified.filter(
      (v) => v.verification_status === "VERIFIED"
    ).length;
    const maybeCount = verified.filter(
      (v) => v.verification_status === "MAYBE"
    ).length;

    console.log(`\nFiltered results (${options.verifiedFile}):`);
    console.log(`  VERIFIED: ${verifiedCount}`);
    console.log(`  MAYBE: ${maybeCount}`);

    // Show top 20
    const sorted = sortByScore(verified);
    console.log(`\nTop 20 VERIFIED datasets:`);
    for (const c of sorted.filter((s) => s.verification_status === "VERIFIED").slice(0, 20)) {
      console.log(
        `  [${c.match_signals.score.toString().padStart(2)}] ${c.title.substring(0, 50)}...`
      );
      console.log(`      ${c.domain}/${c.resource_id}`);
    }
  } else {
    console.log(`\nVerified file not found: ${options.verifiedFile}`);
    console.log("Run 'filter' to generate verified list.");
  }

  // Check for known datasets (sanity check)
  console.log(`\n=== Sanity Check ===`);
  const knownDatasets = [
    { domain: "datahub.austintexas.gov", id: "peux-uuwu", name: "Austin" },
    { domain: "data.cityofnewyork.us", id: "3kfa-rvez", name: "NYC" },
    { domain: "data.montgomerycountymd.gov", id: "k35y-k582", name: "Montgomery County" },
  ];

  for (const known of knownDatasets) {
    const found = candidates.find(
      (c) => c.domain === known.domain && c.resource_id === known.id
    );
    if (found) {
      console.log(`  ✓ ${known.name}: Found`);
    } else {
      console.log(`  ✗ ${known.name}: NOT FOUND (${known.domain}/${known.id})`);
    }
  }
}

/**
 * Full run - crawl, filter, and import
 */
async function runAll(options: {
  dryRun: boolean;
  resume: boolean;
  verbose: boolean;
  minStatus: "VERIFIED" | "MAYBE";
}): Promise<void> {
  console.log("=== Socrata Pool Inspection Discovery Tool ===");
  console.log(`Mode: ${options.dryRun ? "DRY RUN" : "LIVE"}`);

  // Step 1: Crawl
  await runCrawl({
    output: DEFAULT_CANDIDATES_FILE,
    resume: options.resume,
    verbose: options.verbose,
  });

  // Step 2: Filter
  await runFilter({
    input: DEFAULT_CANDIDATES_FILE,
    output: DEFAULT_VERIFIED_FILE,
    minStatus: options.minStatus,
    verbose: options.verbose,
  });

  // Step 3: Import
  await runImport({
    input: DEFAULT_VERIFIED_FILE,
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  // Step 4: Report
  await runReport({
    candidatesFile: DEFAULT_CANDIDATES_FILE,
    verifiedFile: DEFAULT_VERIFIED_FILE,
  });

  console.log("\n=== Discovery Complete ===\n");
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs();

  try {
    switch (args.command) {
      case "crawl":
        await runCrawl({
          output: args.output || DEFAULT_CANDIDATES_FILE,
          resume: args.resume,
          verbose: args.verbose,
        });
        break;

      case "filter":
        await runFilter({
          input: args.input || DEFAULT_CANDIDATES_FILE,
          output: args.output || DEFAULT_VERIFIED_FILE,
          minStatus: args.minStatus,
          verbose: args.verbose,
        });
        break;

      case "import":
        await runImport({
          input: args.input || DEFAULT_VERIFIED_FILE,
          dryRun: args.dryRun,
          verbose: args.verbose,
        });
        break;

      case "report":
        await runReport({
          candidatesFile: args.input || DEFAULT_CANDIDATES_FILE,
          verifiedFile: args.output || DEFAULT_VERIFIED_FILE,
        });
        break;

      case "run-all":
      default:
        await runAll({
          dryRun: args.dryRun,
          resume: args.resume,
          verbose: args.verbose,
          minStatus: args.minStatus,
        });
        break;
    }
  } catch (err) {
    console.error("\nError:", err);
    process.exit(1);
  }
}

main();
