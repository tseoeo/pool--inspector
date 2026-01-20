/**
 * Source Health Check Script
 *
 * Checks connectivity to all configured data sources and reports their status.
 * Can optionally update the database with health status.
 *
 * Usage:
 *   npm run sources:check           # Check all sources
 *   npm run sources:check -- --fix  # Check and update database status
 */

import "dotenv/config";
import { PrismaClient, type Source } from "@prisma/client";

const prisma = new PrismaClient();

interface HealthResult {
  sourceId: string;
  name: string;
  endpoint: string;
  healthy: boolean;
  responseTime?: number;
  error?: string;
  httpStatus?: number;
}

async function checkSourceHealth(source: Source): Promise<HealthResult> {
  const result: HealthResult = {
    sourceId: source.id,
    name: source.name,
    endpoint: source.endpoint,
    healthy: false,
  };

  const startTime = Date.now();

  try {
    // Build test URL based on adapter type
    let testUrl: string;

    if (source.adapterType === "SOCRATA") {
      // Socrata: query with limit=1 to test connectivity
      const url = new URL(source.endpoint);
      url.searchParams.set("$limit", "1");
      testUrl = url.toString();
    } else if (source.adapterType === "ARCGIS") {
      // ArcGIS: query the layer info endpoint
      testUrl = `${source.endpoint}?f=json`;
    } else {
      // For other types, just HEAD the endpoint
      testUrl = source.endpoint;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(testUrl, {
      method: source.adapterType === "SOCRATA" || source.adapterType === "ARCGIS" ? "GET" : "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "PoolInspectionIndex/1.0 HealthCheck",
      },
    });

    clearTimeout(timeout);

    result.responseTime = Date.now() - startTime;
    result.httpStatus = response.status;

    if (response.ok) {
      // For ArcGIS, verify we got valid JSON
      if (source.adapterType === "ARCGIS") {
        const data = await response.json();
        if (data.error) {
          result.error = `ArcGIS error: ${data.error.message || "Unknown error"}`;
        } else {
          result.healthy = true;
        }
      } else {
        result.healthy = true;
      }
    } else {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (err) {
    result.responseTime = Date.now() - startTime;

    if (err instanceof Error) {
      if (err.name === "AbortError") {
        result.error = "Connection timed out (15s)";
      } else if (err.message.includes("fetch failed")) {
        result.error = "Connection failed - server unreachable";
      } else {
        result.error = err.message;
      }
    } else {
      result.error = "Unknown error";
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes("--fix");
  const onlyInactive = args.includes("--inactive");

  console.log("=== Source Health Check ===\n");

  // Get sources
  const whereClause = onlyInactive ? { isActive: false } : {};
  const sources = await prisma.source.findMany({
    where: whereClause,
    include: { jurisdiction: true },
    orderBy: { name: "asc" },
  });

  if (sources.length === 0) {
    console.log("No sources found.");
    return;
  }

  console.log(`Checking ${sources.length} source(s)...\n`);

  const results: HealthResult[] = [];

  for (const source of sources) {
    process.stdout.write(`  ${source.name}... `);
    const result = await checkSourceHealth(source);
    results.push(result);

    if (result.healthy) {
      console.log(`✓ OK (${result.responseTime}ms)`);
    } else {
      console.log(`✗ FAILED - ${result.error}`);
    }
  }

  // Summary
  const healthy = results.filter((r) => r.healthy);
  const unhealthy = results.filter((r) => !r.healthy);

  console.log("\n=== Summary ===");
  console.log(`  Healthy: ${healthy.length}/${results.length}`);
  console.log(`  Unhealthy: ${unhealthy.length}/${results.length}`);

  if (unhealthy.length > 0) {
    console.log("\nUnhealthy Sources:");
    for (const r of unhealthy) {
      console.log(`  - ${r.name}: ${r.error}`);
    }
  }

  // Update database if --fix flag is set
  if (shouldFix) {
    console.log("\n=== Updating Database ===");

    for (const result of results) {
      const source = sources.find((s) => s.id === result.sourceId)!;

      if (result.healthy && !source.isActive) {
        // Source recovered - mark as active
        await prisma.source.update({
          where: { id: result.sourceId },
          data: {
            isActive: true,
            lastSyncError: null,
          },
        });
        console.log(`  ✓ ${result.name}: Marked ACTIVE (recovered)`);
      } else if (!result.healthy && source.isActive) {
        // Source failed - mark as inactive
        await prisma.source.update({
          where: { id: result.sourceId },
          data: {
            isActive: false,
            lastSyncStatus: "FAILED",
            lastSyncError: result.error,
          },
        });
        console.log(`  ✗ ${result.name}: Marked INACTIVE (${result.error})`);
      }
    }
  }

  await prisma.$disconnect();

  // Exit with error code if any sources are unhealthy
  if (unhealthy.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
