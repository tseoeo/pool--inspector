import { prisma } from "../../src/lib/prisma";
import { runIngestion } from "../../src/ingestion";

async function main() {
  console.log("Starting daily incremental ingestion...");
  console.log(`Time: ${new Date().toISOString()}`);
  const startTime = Date.now();

  try {
    // Get all active sources
    const sources = await prisma.source.findMany({
      where: { isActive: true },
      include: { jurisdiction: true },
    });

    console.log(`Found ${sources.length} active sources`);

    const results: Array<{
      source: string;
      status: string;
      recordsFetched?: number;
      recordsCreated?: number;
      error?: string;
    }> = [];

    for (const source of sources) {
      console.log(`\n----------------------------------------`);
      console.log(`Processing source: ${source.name}`);
      console.log(`Jurisdiction: ${source.jurisdiction.name}`);
      console.log(`----------------------------------------`);

      try {
        const result = await runIngestion({
          sourceId: source.id,
          syncType: "INCREMENTAL",
        });

        results.push({
          source: source.name,
          status: result.success ? "success" : "failed",
          recordsFetched: result.recordsFetched,
          recordsCreated: result.recordsCreated,
          error: result.error,
        });

        console.log(`Result: ${result.success ? "SUCCESS" : "FAILED"}`);
        console.log(`  Fetched: ${result.recordsFetched}`);
        console.log(`  Created: ${result.recordsCreated}`);
        console.log(`  Updated: ${result.recordsUpdated}`);
        console.log(`  Skipped: ${result.recordsSkipped}`);
        console.log(`  Failed: ${result.recordsFailed}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to sync ${source.name}:`, errorMessage);
        results.push({
          source: source.name,
          status: "failed",
          error: errorMessage,
        });
      }
    }

    // Trigger revalidation for updated content
    await triggerRevalidation();

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n========================================`);
    console.log(`Daily ingestion completed in ${duration.toFixed(1)}s`);
    console.log(`========================================`);
    console.log("\nResults:");
    for (const r of results) {
      const status = r.status === "success" ? "✓" : "✗";
      console.log(`  ${status} ${r.source}: ${r.recordsFetched || 0} fetched, ${r.recordsCreated || 0} created`);
      if (r.error) {
        console.log(`    Error: ${r.error}`);
      }
    }

    // Exit successfully
    process.exit(0);
  } catch (error) {
    console.error("Fatal error during daily ingestion:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function triggerRevalidation() {
  const revalidationUrl = process.env.REVALIDATION_URL;
  const revalidationSecret = process.env.REVALIDATION_SECRET;

  if (!revalidationUrl || !revalidationSecret) {
    console.log("Revalidation URL or secret not configured, skipping revalidation");
    return;
  }

  try {
    const response = await fetch(revalidationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${revalidationSecret}`,
      },
      body: JSON.stringify({ type: "closures" }),
    });

    if (response.ok) {
      console.log("Triggered revalidation for closures page");
    } else {
      console.warn(`Revalidation failed: ${response.status}`);
    }
  } catch (error) {
    console.warn("Failed to trigger revalidation:", error);
  }
}

main();
