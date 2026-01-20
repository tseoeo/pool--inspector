import "dotenv/config";
import { runIngestion } from "../src/ingestion";

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let sourceId: string | undefined;
  let maxRecords: number | undefined;
  let resume = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      sourceId = args[i + 1];
      i++;
    } else if (args[i] === "--max" && args[i + 1]) {
      maxRecords = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--resume") {
      resume = true;
    }
  }

  if (!sourceId) {
    console.error("Usage: npm run ingest:backfill -- --source <sourceId> [--max <records>] [--resume]");
    console.error("\nOptions:");
    console.error("  --source <id>  Source ID to backfill (required)");
    console.error("  --max <n>      Maximum records to fetch");
    console.error("  --resume       Resume from saved cursor instead of starting fresh");
    console.error("\nExample:");
    console.error("  npm run ingest:backfill -- --source austin-socrata-source");
    console.error("  npm run ingest:backfill -- --source georgia-statewide-tyler-source --resume");
    process.exit(1);
  }

  console.log(`Starting backfill for source: ${sourceId}`);
  if (maxRecords) {
    console.log(`Max records: ${maxRecords}`);
  }
  if (resume) {
    console.log(`Resuming from saved cursor`);
  }

  const startTime = Date.now();

  try {
    const result = await runIngestion({
      sourceId,
      syncType: resume ? "RESUME" : "BACKFILL",
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
