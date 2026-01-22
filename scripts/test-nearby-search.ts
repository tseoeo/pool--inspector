import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.businessStatus",
  "places.primaryType",
].join(",");

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function searchNearby(apiKey: string, lat: number, lng: number, radiusM: number) {
  const response = await fetch(NEARBY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ["swimming_pool"],
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusM,
        },
      },
      maxResultCount: 10,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY_1;
  if (!apiKey) {
    console.error("No API key");
    process.exit(1);
  }

  console.log("=== Nearby Search Test (GPS-only matching) ===\n");

  // Test with a few different facility types
  const testCases = [
    { name: "McCormick", type: "apartment pool" },
    { name: "Six Flags", type: "water park" },
    { name: "Golfland", type: "commercial" },
  ];

  for (const test of testCases) {
    const facility = await prisma.facility.findFirst({
      where: { displayName: { contains: test.name } },
    });

    if (!facility || !facility.latitude || !facility.longitude) {
      console.log(`Skipping ${test.name} - no coords`);
      continue;
    }

    console.log(`\n📍 ${facility.displayName} (${test.type})`);
    console.log(`   Our coords: ${facility.latitude.toFixed(6)}, ${facility.longitude.toFixed(6)}`);

    // Try different radii
    for (const radius of [200, 500, 1000]) {
      try {
        const data = await searchNearby(apiKey, facility.latitude, facility.longitude, radius);

        if (!data.places || data.places.length === 0) {
          console.log(`   ${radius}m: No pools found`);
        } else {
          console.log(`   ${radius}m: Found ${data.places.length} pool(s):`);
          for (const place of data.places) {
            const dist = haversineDistance(
              facility.latitude!,
              facility.longitude!,
              place.location.latitude,
              place.location.longitude
            );
            console.log(`      - ${place.displayName?.text} (${(dist * 1000).toFixed(0)}m away)`);
            console.log(`        ${place.formattedAddress}`);
          }
          break; // Found results, no need for larger radius
        }
      } catch (error) {
        console.error(`   ${radius}m: Error - ${error}`);
      }

      await new Promise((r) => setTimeout(r, 100));
    }

    console.log("---");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
