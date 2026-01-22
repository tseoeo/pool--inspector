import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ============================================
// CONFIGURATION
// ============================================

const PLACES_API_URL = "https://places.googleapis.com/v1/places:searchText";
const RATE_LIMIT_MS = 100; // 10 requests/second
const PROGRESS_FILE = path.join(process.cwd(), "enrichment_progress.json");
const BATCH_SIZE = 50;
const MAX_MATCH_DISTANCE_M = 500; // Reject matches further than 500m
const COST_PER_REQUEST = 0.04; // Enterprise + Atmosphere tier

// Field mask for all useful data (Enterprise + Atmosphere tier)
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.reviews",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.currentOpeningHours",
  "places.photos",
  "places.types",
  "places.businessStatus",
  "places.editorialSummary",
  "places.goodForChildren",
  "places.goodForGroups",
  "places.accessibilityOptions",
  "places.allowsDogs",
  "places.restroom",
].join(",");

// Commercial/public facility patterns (high confidence)
const COMMERCIAL_PATTERNS = [
  /hotel/i, /marriott/i, /hilton/i, /hyatt/i, /sheraton/i, /westin/i, /inn\b/i, /suites/i, /resort/i, /lodge/i,
  /ymca/i, /ywca/i, /gym/i, /fitness/i, /health club/i, /athletic/i, /recreation/i, /rec center/i,
  /country club/i, /golf/i, /tennis/i, /swim club/i, /aquatic/i, /natatorium/i,
  /six flags/i, /water ?park/i, /splash/i, /waterworld/i, /hurricane harbor/i,
  /city of/i, /municipal/i, /community center/i, /public pool/i, /city pool/i,
  /school/i, /university/i, /college/i, /high school/i, /elementary/i, /academy/i,
  /park district/i, /parks? (and|&) rec/i, /sports complex/i,
];

// Residential patterns (exclude these)
const RESIDENTIAL_PATTERNS = [
  /apartment/i, /apts?\.?$/i, /residences/i, /residential/i,
  /villa/i, /villas/i, /manor/i, /estates/i, /terrace/i,
  /condo/i, /condominiums/i, /townhome/i, /townhouse/i,
  /hoa/i, /homeowners/i, /property management/i,
  /living/i, /senior living/i, /assisted/i, /retirement/i,
];

// ============================================
// TYPES
// ============================================

interface Progress {
  lastProcessedId: string | null;
  totalProcessed: number;
  totalEnriched: number;
  totalNoMatch: number;
  totalTooFar: number;
  totalFailed: number;
  totalCost: number;
  apiKeyStats: Record<string, { requests: number; errors: number }>;
  startedAt: string;
}

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{
    rating: number;
    text?: { text: string };
    authorAttribution?: { displayName: string };
    relativePublishTimeDescription?: string;
  }>;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  currentOpeningHours?: {
    weekdayDescriptions?: string[];
    openNow?: boolean;
  };
  photos?: Array<{ name: string; widthPx: number; heightPx: number }>;
  types?: string[];
  businessStatus?: string;
  editorialSummary?: { text: string };
  goodForChildren?: boolean;
  goodForGroups?: boolean;
  accessibilityOptions?: {
    wheelchairAccessibleEntrance?: boolean;
  };
  allowsDogs?: boolean;
  restroom?: boolean;
}

// ============================================
// API KEY MANAGER
// ============================================

class ApiKeyManager {
  private keys: Array<{
    key: string;
    name: string;
    requests: number;
    errors: number;
    disabled: boolean;
  }> = [];
  private currentIndex = 0;
  private requestsPerKey = 0;
  private rotationThreshold = 100;

  constructor() {
    const key1 = process.env.GOOGLE_PLACES_API_KEY_1;
    const key2 = process.env.GOOGLE_PLACES_API_KEY_2;

    if (key1) this.keys.push({ key: key1, name: "Account1", requests: 0, errors: 0, disabled: false });
    if (key2) this.keys.push({ key: key2, name: "Account2", requests: 0, errors: 0, disabled: false });

    if (this.keys.length === 0) {
      throw new Error("No GOOGLE_PLACES_API_KEY_1 or _2 configured in .env");
    }
    console.log(`Loaded ${this.keys.length} API key(s)`);
  }

  getKey(): string {
    const available = this.keys.filter((k) => !k.disabled);
    if (available.length === 0) throw new Error("All API keys exhausted");

    this.requestsPerKey++;
    if (this.requestsPerKey >= this.rotationThreshold) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      this.requestsPerKey = 0;
      console.log(`\n🔄 Rotating to API key: ${this.keys[this.currentIndex].name}`);
    }

    while (this.keys[this.currentIndex].disabled) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    }

    this.keys[this.currentIndex].requests++;
    return this.keys[this.currentIndex].key;
  }

  markError(key: string): void {
    const k = this.keys.find((x) => x.key === key);
    if (k) {
      k.errors++;
      if (k.errors >= 5) {
        k.disabled = true;
        console.warn(`⚠️  API key ${k.name} disabled after 5 consecutive errors`);
      }
    }
  }

  resetError(key: string): void {
    const k = this.keys.find((x) => x.key === key);
    if (k) k.errors = 0;
  }

  getStats(): Record<string, { requests: number; errors: number }> {
    return Object.fromEntries(this.keys.map((k) => [k.name, { requests: k.requests, errors: k.errors }]));
  }
}

// ============================================
// HELPERS
// ============================================

function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isCommercialFacility(name: string): boolean {
  const isCommercial = COMMERCIAL_PATTERNS.some((p) => p.test(name));
  const isResidential = RESIDENTIAL_PATTERNS.some((p) => p.test(name));
  return isCommercial && !isResidential;
}

function loadProgress(): Progress | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    }
  } catch {
    // Ignore
  }
  return null;
}

function saveProgress(progress: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ============================================
// API CALL
// ============================================

async function searchPlace(
  apiKey: string,
  query: string,
  lat: number,
  lng: number
): Promise<GooglePlace | null> {
  const response = await fetch(PLACES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 5,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 500.0,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.places?.[0] || null;
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let dryRun = false;
  let resume = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--resume") {
      resume = true;
    }
  }

  console.log("=== Google Places Enrichment (High-Confidence Commercial) ===\n");
  if (dryRun) console.log("🔸 DRY RUN MODE - No database changes\n");
  if (limit) console.log(`🔸 Limit: ${limit} facilities\n`);

  const apiKeyManager = new ApiKeyManager();

  // Load or init progress
  let progress: Progress;
  if (resume) {
    const saved = loadProgress();
    if (saved) {
      progress = saved;
      console.log(`📂 Resuming from previous run (processed: ${progress.totalProcessed})\n`);
    } else {
      console.log("📂 No progress file found, starting fresh\n");
      progress = {
        lastProcessedId: null,
        totalProcessed: 0,
        totalEnriched: 0,
        totalNoMatch: 0,
        totalTooFar: 0,
        totalFailed: 0,
        totalCost: 0,
        apiKeyStats: {},
        startedAt: new Date().toISOString(),
      };
    }
  } else {
    progress = {
      lastProcessedId: null,
      totalProcessed: 0,
      totalEnriched: 0,
      totalNoMatch: 0,
      totalTooFar: 0,
      totalFailed: 0,
      totalCost: 0,
      apiKeyStats: {},
      startedAt: new Date().toISOString(),
    };
  }

  // Get high-confidence commercial facilities with coords, not yet enriched
  const whereClause: Record<string, unknown> = {
    latitude: { not: null },
    longitude: { not: null },
    googlePlaceId: null, // Not yet enriched
  };

  if (progress.lastProcessedId) {
    whereClause.id = { gt: progress.lastProcessedId };
  }

  // First count total eligible
  const allFacilities = await prisma.facility.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      googlePlaceId: null,
    },
    select: { id: true, displayName: true },
  });

  const eligibleIds = allFacilities
    .filter((f) => isCommercialFacility(f.displayName))
    .map((f) => f.id);

  console.log(`📊 Total eligible (commercial + coords + not enriched): ${eligibleIds.length}`);
  console.log(`💰 Estimated cost: $${(eligibleIds.length * COST_PER_REQUEST).toFixed(2)}\n`);

  if (eligibleIds.length === 0) {
    console.log("No facilities to process.");
    await prisma.$disconnect();
    return;
  }

  const effectiveLimit = limit ?? eligibleIds.length;
  let processed = 0;

  // Process in batches
  while (processed < effectiveLimit) {
    const facilities = await prisma.facility.findMany({
      where: {
        id: { in: eligibleIds, ...(progress.lastProcessedId ? { gt: progress.lastProcessedId } : {}) },
      },
      orderBy: { id: "asc" },
      take: Math.min(BATCH_SIZE, effectiveLimit - processed),
    });

    if (facilities.length === 0) break;

    for (const facility of facilities) {
      if (!isCommercialFacility(facility.displayName)) {
        // Skip (shouldn't happen but safety check)
        progress.lastProcessedId = facility.id;
        continue;
      }

      const pct = ((processed / Math.min(effectiveLimit, eligibleIds.length)) * 100).toFixed(1);
      console.log(`[${processed + 1}/${Math.min(effectiveLimit, eligibleIds.length)}] (${pct}%) ${facility.displayName}`);

      // Skip facilities with invalid coordinates
      const lat = facility.latitude!;
      const lng = facility.longitude!;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.log(`   ⏭️  Skipping: Invalid coords (${lat}, ${lng})`);
        processed++;
        progress.totalProcessed++;
        progress.lastProcessedId = facility.id;
        progress.totalFailed++;
        continue;
      }

      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));

      const apiKey = apiKeyManager.getKey();
      progress.totalCost += COST_PER_REQUEST;

      try {
        const query = `${facility.displayName} ${facility.city} ${facility.state}`;
        const place = await searchPlace(apiKey, query, lat, lng);

        apiKeyManager.resetError(apiKey);

        if (!place) {
          console.log(`   ❌ No results`);
          progress.totalNoMatch++;
        } else if (!place.location) {
          console.log(`   ❌ No location in result`);
          progress.totalNoMatch++;
        } else {
          const distance = haversineDistanceM(
            facility.latitude!,
            facility.longitude!,
            place.location.latitude,
            place.location.longitude
          );

          if (distance > MAX_MATCH_DISTANCE_M) {
            console.log(`   ⚠️  Too far: ${distance.toFixed(0)}m (>${MAX_MATCH_DISTANCE_M}m) - ${place.displayName?.text}`);
            progress.totalTooFar++;
          } else {
            console.log(`   ✅ Matched: ${place.displayName?.text} (${distance.toFixed(0)}m)`);
            if (place.rating) console.log(`      ⭐ ${place.rating} (${place.userRatingCount} reviews)`);

            if (!dryRun) {
              await prisma.facility.update({
                where: { id: facility.id },
                data: {
                  googlePlaceId: place.id,
                  googleMatchDistance: distance,
                  googleRating: place.rating,
                  googleReviewCount: place.userRatingCount,
                  googleReviews: place.reviews?.slice(0, 5).map((r) => ({
                    rating: r.rating,
                    text: r.text?.text,
                    author: r.authorAttribution?.displayName,
                    date: r.relativePublishTimeDescription,
                  })),
                  googlePhone: place.internationalPhoneNumber || place.nationalPhoneNumber,
                  googleWebsite: place.websiteUri,
                  googleHours: place.currentOpeningHours
                    ? {
                        weekdayText: place.currentOpeningHours.weekdayDescriptions,
                        openNow: place.currentOpeningHours.openNow,
                      }
                    : undefined,
                  googlePhotos: place.photos?.slice(0, 5).map((p) => ({ name: p.name, width: p.widthPx, height: p.heightPx })),
                  googleTypes: place.types || [],
                  goodForChildren: place.goodForChildren,
                  goodForGroups: place.goodForGroups,
                  wheelchairAccessible: place.accessibilityOptions?.wheelchairAccessibleEntrance,
                  allowsDogs: place.allowsDogs,
                  restroom: place.restroom,
                  googleEditorialSummary: place.editorialSummary?.text,
                  googleEnrichedAt: new Date(),
                },
              });
            }
            progress.totalEnriched++;
          }
        }
      } catch (error) {
        const errorMsg = String(error);
        // Don't count 400 errors (bad request) as API key failures - those are data issues
        if (errorMsg.includes("400") || errorMsg.includes("INVALID_ARGUMENT")) {
          console.log(`   ⏭️  Bad request (data issue), skipping`);
        } else {
          console.error(`   ❌ Error: ${error}`);
          apiKeyManager.markError(apiKey);
        }
        progress.totalFailed++;
      }

      processed++;
      progress.totalProcessed++;
      progress.lastProcessedId = facility.id;

      // Save progress every 10 facilities
      if (processed % 10 === 0 && !dryRun) {
        progress.apiKeyStats = apiKeyManager.getStats();
        saveProgress(progress);
      }
    }
  }

  // Final save
  if (!dryRun) {
    progress.apiKeyStats = apiKeyManager.getStats();
    saveProgress(progress);
  }

  console.log("\n=== Summary ===");
  console.log(`Total processed: ${progress.totalProcessed}`);
  console.log(`✅ Enriched: ${progress.totalEnriched}`);
  console.log(`❌ No match: ${progress.totalNoMatch}`);
  console.log(`⚠️  Too far (>${MAX_MATCH_DISTANCE_M}m): ${progress.totalTooFar}`);
  console.log(`💥 Failed: ${progress.totalFailed}`);
  console.log(`💰 Cost: $${progress.totalCost.toFixed(2)}`);
  console.log("\nAPI Key Usage:");
  for (const [name, stats] of Object.entries(apiKeyManager.getStats())) {
    console.log(`  ${name}: ${stats.requests} requests, ${stats.errors} errors`);
  }

  if (dryRun) console.log("\n(DRY RUN - no changes made)");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Enrichment failed:", error);
  process.exit(1);
});
