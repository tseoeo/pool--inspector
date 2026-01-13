import "dotenv/config";
import { runIngestion } from "../src/ingestion";

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let sourceId: string | undefined;
  let maxRecords: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      sourceId = args[i + 1];
      i++;
    } else if (args[i] === "--max" && args[i + 1]) {
      maxRecords = parseInt(args[i + 1], 10);
      i++;
    }
  }

  if (!sourceId) {
    console.error("Usage: npm run ingest:backfill -- --source <sourceId> [--max <records>]");
    console.error("\nExample:");
    console.error("  npm run ingest:backfill -- --source austin-socrata-source");
    console.error("  npm run ingest:backfill -- --source webster-arcgis-source --max 100");
    process.exit(1);
  }

  console.log(`Starting backfill for source: ${sourceId}`);
  if (maxRecords) {
    console.log(`Max records: ${maxRecords}`);
  }

  const startTime = Date.now();

  try {
    const result = await runIngestion({
      sourceId,
      syncType: "BACKFILL",
      maxRecords,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n=== Backfill Complete ===");
    console.log(`Duration: ${duration}s`);
    console.log(`Records fetched: ${result.recordsFetched}`);
    console.log(`Records created: ${result.recordsCreated}`);
    console.log(`Records updated: ${result.recordsUpdated}`);
    console.log(`Records skipped: ${result.recordsSkipped}`);
    console.log(`Records failed: ${result.recordsFailed}`);

    if (result.error) {
      console.error(`\nError: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exit(1);
  }
}

main();
