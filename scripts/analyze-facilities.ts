import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const facilities = await prisma.facility.findMany({
    select: { displayName: true, latitude: true, longitude: true }
  });

  const commercialPatterns = [
    /hotel/i, /marriott/i, /hilton/i, /hyatt/i, /sheraton/i, /westin/i, /inn/i, /suites/i, /resort/i, /lodge/i,
    /ymca/i, /ywca/i, /gym/i, /fitness/i, /health club/i, /athletic/i, /recreation/i, /rec center/i,
    /country club/i, /golf/i, /tennis/i, /swim club/i, /aquatic/i, /natatorium/i,
    /six flags/i, /water ?park/i, /splash/i, /waterworld/i, /hurricane harbor/i,
    /city of/i, /municipal/i, /community/i, /public pool/i, /city pool/i, /county/i,
    /school/i, /university/i, /college/i, /high school/i, /elementary/i, /academy/i,
    /park district/i, /parks? (and|&) rec/i, /sports complex/i,
  ];

  const residentialPatterns = [
    /apartment/i, /apts?\.?$/i, /residences/i, /residential/i,
    /villa/i, /villas/i, /manor/i, /estates/i, /terrace/i,
    /condo/i, /condominiums/i, /townhome/i, /townhouse/i,
    /hoa/i, /homeowners/i, /property/i, /management/i,
    /living/i, /senior living/i, /assisted/i, /retirement/i,
  ];

  let commercialWithCoords = 0;
  let unclearWithCoords = 0;
  let residentialWithCoords = 0;
  let noCoords = 0;

  for (const f of facilities) {
    const hasCoords = f.latitude !== null && f.longitude !== null;
    const isCommercial = commercialPatterns.some(p => p.test(f.displayName));
    const isResidential = residentialPatterns.some(p => p.test(f.displayName));

    if (!hasCoords) {
      noCoords++;
    } else if (isCommercial && !isResidential) {
      commercialWithCoords++;
    } else if (isResidential && !isCommercial) {
      residentialWithCoords++;
    } else {
      unclearWithCoords++;
    }
  }

  console.log("=== Cost Estimate for Google Places Enrichment ===\n");
  console.log("Facilities by category (with GPS coords):\n");

  console.log(`  🎯 HIGH CONFIDENCE (Commercial/Public + coords): ${commercialWithCoords}`);
  console.log("     Hotels, YMCAs, schools, water parks, rec centers");
  console.log();
  console.log(`  ⚠️  MEDIUM (Unclear names + coords): ${unclearWithCoords}`);
  console.log("     Could try matching, may get ~50% hit rate");
  console.log();
  console.log(`  ❌ LOW (Residential + coords): ${residentialWithCoords}`);
  console.log("     Apartments/condos - unlikely to be in Google");
  console.log();
  console.log(`  ❌ NO COORDS: ${noCoords}`);
  console.log("     Cannot do GPS-based matching");

  console.log("\n=== COST ESTIMATE ===\n");
  console.log("Google Places API pricing: $0.032 - $0.040 per request");
  console.log("(Text Search with full field mask)\n");

  const pricePerReq = 0.04; // worst case

  console.log("Option 1: HIGH CONFIDENCE ONLY");
  console.log(`  Facilities: ${commercialWithCoords.toLocaleString()}`);
  console.log(`  API calls: ${commercialWithCoords.toLocaleString()} (1 per facility)`);
  console.log(`  Cost: $${(commercialWithCoords * pricePerReq).toFixed(2)}`);
  console.log();

  console.log("Option 2: HIGH + MEDIUM CONFIDENCE");
  const option2 = commercialWithCoords + unclearWithCoords;
  console.log(`  Facilities: ${option2.toLocaleString()}`);
  console.log(`  Cost: $${(option2 * pricePerReq).toFixed(2)}`);
  console.log();

  console.log("Option 3: ALL WITH COORDS");
  const option3 = commercialWithCoords + unclearWithCoords + residentialWithCoords;
  console.log(`  Facilities: ${option3.toLocaleString()}`);
  console.log(`  Cost: $${(option3 * pricePerReq).toFixed(2)}`);

  console.log("\n=== YOUR BUDGET ===");
  console.log("2 accounts × $200 credit = $400 total");
  console.log();
  console.log(`Option 1: $${(commercialWithCoords * pricePerReq).toFixed(2)} (${((commercialWithCoords * pricePerReq / 400) * 100).toFixed(1)}% of budget) ✅ RECOMMENDED`);
  console.log(`Option 2: $${(option2 * pricePerReq).toFixed(2)} (${((option2 * pricePerReq / 400) * 100).toFixed(1)}% of budget)`);
  console.log(`Option 3: $${(option3 * pricePerReq).toFixed(2)} (${((option3 * pricePerReq / 400) * 100).toFixed(1)}% of budget)`);

  await prisma.$disconnect();
}

main();
