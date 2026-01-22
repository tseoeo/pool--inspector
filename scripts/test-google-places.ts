import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Google Places API (New) Text Search endpoint
const PLACES_API_URL = "https://places.googleapis.com/v1/places:searchText";

// Field mask - request ALL potentially useful fields for pools
const FIELD_MASK = [
  // Identity
  "places.id",
  "places.displayName",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",

  // Location & Address
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.addressComponents",

  // Contact
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",

  // Business Info
  "places.businessStatus",
  "places.priceLevel",
  "places.priceRange",

  // Ratings & Reviews
  "places.rating",
  "places.userRatingCount",
  "places.reviews",
  "places.editorialSummary",

  // Hours
  "places.regularOpeningHours",
  "places.currentOpeningHours",

  // Media
  "places.photos",

  // Amenities - Pool relevant
  "places.allowsDogs",
  "places.restroom",
  "places.goodForChildren",
  "places.goodForGroups",
  "places.outdoorSeating",
  "places.reservable",

  // Accessibility & Parking
  "places.accessibilityOptions",
  "places.parkingOptions",
  "places.paymentOptions",

  // AI Summaries
  "places.generativeSummary",
  "places.editorialSummary",
].join(",");

interface GooglePlace {
  id: string;
  displayName?: { text: string; languageCode?: string };
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  priceLevel?: string;
  priceRange?: {
    startPrice?: { currencyCode: string; units: string };
    endPrice?: { currencyCode: string; units: string };
  };
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{
    name: string;
    rating: number;
    text?: { text: string };
    authorAttribution?: { displayName: string };
    relativePublishTimeDescription?: string;
  }>;
  editorialSummary?: { text: string };
  generativeSummary?: { overview?: { text: string } };
  currentOpeningHours?: {
    weekdayDescriptions?: string[];
    openNow?: boolean;
    periods?: Array<{
      open: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
  };
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
  photos?: Array<{
    name: string;
    widthPx: number;
    heightPx: number;
    authorAttributions: Array<{ displayName: string }>;
  }>;
  // Amenities
  allowsDogs?: boolean;
  restroom?: boolean;
  goodForChildren?: boolean;
  goodForGroups?: boolean;
  outdoorSeating?: boolean;
  reservable?: boolean;
  // Accessibility & Parking
  accessibilityOptions?: {
    wheelchairAccessibleEntrance?: boolean;
    wheelchairAccessibleParking?: boolean;
    wheelchairAccessibleRestroom?: boolean;
    wheelchairAccessibleSeating?: boolean;
  };
  parkingOptions?: {
    freeParkingLot?: boolean;
    paidParkingLot?: boolean;
    freeStreetParking?: boolean;
    paidStreetParking?: boolean;
    valetParking?: boolean;
    freeGarageParking?: boolean;
    paidGarageParking?: boolean;
  };
  paymentOptions?: {
    acceptsCreditCards?: boolean;
    acceptsDebitCards?: boolean;
    acceptsCashOnly?: boolean;
    acceptsNfc?: boolean;
  };
}

interface PlacesResponse {
  places?: GooglePlace[];
}

async function searchPlaces(
  apiKey: string,
  query: string,
  locationBias?: { lat: number; lng: number }
): Promise<PlacesResponse> {
  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: 5,
  };

  // Add location bias if coordinates available (improves match accuracy)
  if (locationBias) {
    body.locationBias = {
      circle: {
        center: {
          latitude: locationBias.lat,
          longitude: locationBias.lng,
        },
        radius: 2000.0, // 2km radius
      },
    };
  }

  const response = await fetch(PLACES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Places API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function main() {
  // Check for API key
  const apiKey = process.env.GOOGLE_PLACES_API_KEY_1;
  if (!apiKey) {
    console.error("❌ Error: GOOGLE_PLACES_API_KEY_1 not set in .env");
    console.error("\nTo set up:");
    console.error("1. Go to https://console.cloud.google.com/");
    console.error("2. Create a project and enable billing");
    console.error("3. Enable 'Places API (New)'");
    console.error("4. Create an API key");
    console.error("5. Add to .env: GOOGLE_PLACES_API_KEY_1=your_key_here");
    process.exit(1);
  }

  console.log("=== Google Places API Test ===\n");
  console.log(`API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`);
  console.log(`Endpoint: ${PLACES_API_URL}`);
  console.log(`Field mask: ${FIELD_MASK.split(",").length} fields requested\n`);

  // Get sample facilities with coordinates
  const facilities = await prisma.facility.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
    take: 3,
    orderBy: { totalInspections: "desc" }, // Pick facilities with most inspections (more likely to be real)
    include: {
      jurisdiction: { select: { name: true, state: true } },
    },
  });

  if (facilities.length === 0) {
    console.error("❌ No facilities with coordinates found in database");
    process.exit(1);
  }

  console.log(`Testing with ${facilities.length} sample facilities...\n`);
  console.log("=".repeat(60));

  for (const facility of facilities) {
    console.log(`\n📍 FACILITY: ${facility.displayName}`);
    console.log(`   Address: ${facility.displayAddress}, ${facility.city}, ${facility.state}`);
    console.log(`   Coords: ${facility.latitude}, ${facility.longitude}`);
    console.log(`   Inspections: ${facility.totalInspections}`);

    // Build search query
    const query = `${facility.displayName} pool ${facility.city} ${facility.state}`;
    console.log(`\n   🔍 Search query: "${query}"`);

    try {
      const result = await searchPlaces(
        apiKey,
        query,
        facility.latitude && facility.longitude
          ? { lat: facility.latitude, lng: facility.longitude }
          : undefined
      );

      if (!result.places || result.places.length === 0) {
        console.log("   ⚠️  No results found\n");
        continue;
      }

      console.log(`\n   ✅ Found ${result.places.length} results:\n`);

      for (let i = 0; i < Math.min(result.places.length, 2); i++) {
        const place = result.places[i];
        const distance =
          facility.latitude && facility.longitude && place.location
            ? haversineDistance(
                facility.latitude,
                facility.longitude,
                place.location.latitude,
                place.location.longitude
              )
            : null;

        console.log(`   ┌─ [${i + 1}] ${place.displayName?.text || "No name"}`);
        console.log(`   │  Place ID: ${place.id}`);
        console.log(`   │  Primary Type: ${place.primaryTypeDisplayName?.text || place.primaryType || "N/A"}`);
        console.log(`   │  Address: ${place.formattedAddress || "N/A"}`);
        if (distance !== null) {
          console.log(`   │  Distance: ${distance.toFixed(2)} km from facility`);
        }

        console.log(`   │`);
        console.log(`   │  ⭐ RATINGS & REVIEWS`);
        console.log(`   │     Rating: ${place.rating || "N/A"} (${place.userRatingCount || 0} reviews)`);
        if (place.editorialSummary?.text) {
          console.log(`   │     Summary: ${place.editorialSummary.text.slice(0, 100)}...`);
        }
        if (place.generativeSummary?.overview?.text) {
          console.log(`   │     AI Summary: ${place.generativeSummary.overview.text.slice(0, 100)}...`);
        }
        if (place.reviews && place.reviews.length > 0) {
          const review = place.reviews[0];
          console.log(`   │     Latest Review (${review.rating}★): "${review.text?.text?.slice(0, 80) || "No text"}..."`);
        }

        console.log(`   │`);
        console.log(`   │  📞 CONTACT`);
        console.log(`   │     Phone: ${place.nationalPhoneNumber || place.internationalPhoneNumber || "N/A"}`);
        console.log(`   │     Website: ${place.websiteUri || "N/A"}`);
        console.log(`   │     Maps: ${place.googleMapsUri || "N/A"}`);

        console.log(`   │`);
        console.log(`   │  🏢 BUSINESS`);
        console.log(`   │     Status: ${place.businessStatus || "N/A"}`);
        console.log(`   │     Price Level: ${place.priceLevel || "N/A"}`);
        if (place.currentOpeningHours?.weekdayDescriptions) {
          console.log(`   │     Hours: ${place.currentOpeningHours.openNow ? "✅ Open now" : "❌ Closed"}`);
          place.currentOpeningHours.weekdayDescriptions.slice(0, 3).forEach(day => {
            console.log(`   │       ${day}`);
          });
        }

        console.log(`   │`);
        console.log(`   │  🏊 AMENITIES (Pool-relevant)`);
        console.log(`   │     🐕 Allows Dogs: ${place.allowsDogs ?? "Not specified"}`);
        console.log(`   │     👶 Good for Children: ${place.goodForChildren ?? "Not specified"}`);
        console.log(`   │     👥 Good for Groups: ${place.goodForGroups ?? "Not specified"}`);
        console.log(`   │     🚻 Restroom: ${place.restroom ?? "Not specified"}`);
        console.log(`   │     🌳 Outdoor Seating: ${place.outdoorSeating ?? "Not specified"}`);
        console.log(`   │     📅 Reservable: ${place.reservable ?? "Not specified"}`);

        console.log(`   │`);
        console.log(`   │  ♿ ACCESSIBILITY`);
        if (place.accessibilityOptions) {
          console.log(`   │     Wheelchair Entrance: ${place.accessibilityOptions.wheelchairAccessibleEntrance ?? "N/A"}`);
          console.log(`   │     Wheelchair Parking: ${place.accessibilityOptions.wheelchairAccessibleParking ?? "N/A"}`);
          console.log(`   │     Wheelchair Restroom: ${place.accessibilityOptions.wheelchairAccessibleRestroom ?? "N/A"}`);
        } else {
          console.log(`   │     No accessibility data`);
        }

        console.log(`   │`);
        console.log(`   │  🚗 PARKING`);
        if (place.parkingOptions) {
          const parking = place.parkingOptions;
          const opts = [];
          if (parking.freeParkingLot) opts.push("Free lot");
          if (parking.paidParkingLot) opts.push("Paid lot");
          if (parking.freeStreetParking) opts.push("Free street");
          if (parking.valetParking) opts.push("Valet");
          if (parking.freeGarageParking) opts.push("Free garage");
          if (parking.paidGarageParking) opts.push("Paid garage");
          console.log(`   │     ${opts.length > 0 ? opts.join(", ") : "No parking data"}`);
        } else {
          console.log(`   │     No parking data`);
        }

        console.log(`   │`);
        console.log(`   │  💳 PAYMENT`);
        if (place.paymentOptions) {
          const pay = place.paymentOptions;
          const opts = [];
          if (pay.acceptsCreditCards) opts.push("Credit cards");
          if (pay.acceptsDebitCards) opts.push("Debit cards");
          if (pay.acceptsNfc) opts.push("NFC/Tap");
          if (pay.acceptsCashOnly) opts.push("Cash only");
          console.log(`   │     ${opts.length > 0 ? opts.join(", ") : "No payment data"}`);
        } else {
          console.log(`   │     No payment data`);
        }

        console.log(`   │`);
        console.log(`   │  📷 PHOTOS: ${place.photos?.length || 0} available`);
        console.log(`   │  🏷️  Types: ${place.types?.slice(0, 5).join(", ") || "N/A"}`);
        console.log(`   └────────────────────────────────────────`);
        console.log();
      }

      if (result.places.length > 2) {
        console.log(`   ... and ${result.places.length - 2} more results`);
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
    }

    console.log("-".repeat(60));

    // Rate limit between requests
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("\n=== Test Complete ===");
  console.log("\nNext steps:");
  console.log("1. Review the results above to see what data Google returns");
  console.log("2. If results look good, proceed with schema changes and full enrichment");
  console.log("3. Run: npx prisma migrate dev --name add_google_places");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
