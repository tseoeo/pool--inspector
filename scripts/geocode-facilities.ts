import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface GeocodeResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  displayName?: string;
  query?: string;
}

interface Progress {
  lastProcessedId: string | null;
  totalProcessed: number;
  totalGeocoded: number;
  totalFailed: number;
  startedAt: string;
}

const PROGRESS_FILE = path.join(process.cwd(), "geocode_progress.json");
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const RATE_LIMIT_MS = 1100; // 1.1 seconds between requests

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadProgress(): Progress | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveProgress(progress: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  zip?: string | null
): Promise<GeocodeResult> {
  // Try different query strategies with fallbacks
  const queries = [
    // Full address with zip
    zip ? `${address}, ${city}, ${state} ${zip}` : null,
    // Address without zip
    `${address}, ${city}, ${state}`,
    // Just city and state (last resort)
    `${city}, ${state}`,
  ].filter(Boolean) as string[];

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        limit: "1",
        countrycodes: "us",
      });

      const response = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: {
          "User-Agent": "PoolInspectionIndex/1.0 (https://poolinspections.us)",
        },
      });

      if (!response.ok) {
        console.error(`  Nominatim error: ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        return {
          success: true,
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          displayName: result.display_name,
          query,
        };
      }
    } catch (error) {
      console.error(`  Geocoding error for "${query}":`, error);
    }
  }

  return { success: false };
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let limit: number | undefined;
  let jurisdiction: string | undefined;
  let dryRun = false;
  let resume = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--jurisdiction" && args[i + 1]) {
      jurisdiction = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--resume") {
      resume = true;
    }
  }

  console.log("=== Facility Geocoding ===");
  if (dryRun) console.log("Mode: DRY RUN (no database changes)");
  if (limit) console.log(`Limit: ${limit} facilities`);
  if (jurisdiction) console.log(`Jurisdiction: ${jurisdiction}`);

  // Load or initialize progress
  let progress: Progress;
  if (resume) {
    const savedProgress = loadProgress();
    if (savedProgress) {
      progress = savedProgress;
      console.log(`Resuming from previous run (processed: ${progress.totalProcessed})`);
    } else {
      console.log("No previous progress found, starting fresh");
      progress = {
        lastProcessedId: null,
        totalProcessed: 0,
        totalGeocoded: 0,
        totalFailed: 0,
        startedAt: new Date().toISOString(),
      };
    }
  } else {
    progress = {
      lastProcessedId: null,
      totalProcessed: 0,
      totalGeocoded: 0,
      totalFailed: 0,
      startedAt: new Date().toISOString(),
    };
  }

  // Build query for facilities missing coordinates
  const whereClause: Record<string, unknown> = {
    latitude: null,
  };

  if (jurisdiction) {
    whereClause.jurisdiction = {
      slug: jurisdiction,
    };
  }

  // If resuming, start after the last processed ID
  if (progress.lastProcessedId) {
    whereClause.id = {
      gt: progress.lastProcessedId,
    };
  }

  // Count total facilities to process
  const totalToProcess = await prisma.facility.count({
    where: whereClause,
  });

  console.log(`\nFacilities to process: ${totalToProcess}`);
  if (limit && totalToProcess > limit) {
    console.log(`(limited to ${limit})`);
  }

  // Fetch facilities in batches
  const batchSize = 100;
  let processed = 0;
  const effectiveLimit = limit ?? totalToProcess;

  while (processed < effectiveLimit) {
    const facilities = await prisma.facility.findMany({
      where: whereClause,
      orderBy: { id: "asc" },
      take: Math.min(batchSize, effectiveLimit - processed),
      include: {
        jurisdiction: {
          select: { slug: true, name: true },
        },
      },
    });

    if (facilities.length === 0) break;

    for (const facility of facilities) {
      console.log(`\n[${processed + 1}/${Math.min(effectiveLimit, totalToProcess)}] ${facility.displayName}`);
      console.log(`  Address: ${facility.displayAddress}, ${facility.city}, ${facility.state} ${facility.zipCode || ""}`);

      // Rate limiting
      await sleep(RATE_LIMIT_MS);

      const result = await geocodeAddress(
        facility.displayAddress,
        facility.city,
        facility.state,
        facility.zipCode
      );

      if (result.success && result.latitude && result.longitude) {
        console.log(`  ✓ Geocoded: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`);
        console.log(`  Query used: "${result.query}"`);

        if (!dryRun) {
          await prisma.facility.update({
            where: { id: facility.id },
            data: {
              latitude: result.latitude,
              longitude: result.longitude,
            },
          });
        }
        progress.totalGeocoded++;
      } else {
        console.log(`  ✗ Failed to geocode`);
        progress.totalFailed++;
      }

      processed++;
      progress.totalProcessed++;
      progress.lastProcessedId = facility.id;

      // Update where clause for next batch
      whereClause.id = { gt: facility.id };

      // Save progress periodically
      if (processed % 10 === 0 && !dryRun) {
        saveProgress(progress);
      }
    }
  }

  // Final progress save
  if (!dryRun) {
    saveProgress(progress);
  }

  console.log("\n=== Summary ===");
  console.log(`Total processed: ${progress.totalProcessed}`);
  console.log(`Successfully geocoded: ${progress.totalGeocoded}`);
  console.log(`Failed: ${progress.totalFailed}`);
  console.log(`Success rate: ${((progress.totalGeocoded / progress.totalProcessed) * 100).toFixed(1)}%`);

  if (dryRun) {
    console.log("\n(DRY RUN - no changes made)");
  } else {
    console.log(`\nProgress saved to: ${PROGRESS_FILE}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Geocoding failed:", error);
  process.exit(1);
});
