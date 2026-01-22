import "dotenv/config";
import { PrismaClient, JurisdictionType, AdapterType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Adding Pinellas County FL...");

  // Create Pinellas County FL jurisdiction
  const pinellas = await prisma.jurisdiction.upsert({
    where: { slug: "pinellas-county-fl" },
    update: {},
    create: {
      slug: "pinellas-county-fl",
      name: "Pinellas County",
      state: "FL",
      type: JurisdictionType.COUNTY,
      timezone: "America/New_York",
      website: "https://pinellas.gov",
    },
  });
  console.log(`Created jurisdiction: ${pinellas.name} (${pinellas.id})`);

  // Create Pinellas County eBridge source
  // Credentials found: public/public, File Cabinet: PINCHD
  const pinellasSource = await prisma.source.upsert({
    where: {
      id: "pinellas-county-fl-ebridge-source",
    },
    update: {
      name: "Pinellas County Pool Inspections (eBridge)",
      endpoint: "https://s2.ebridge.com/ebridge/3.0/default.aspx",
      config: {
        username: "public",
        password: "public",
        fileCabinet: "PINCHD",
        program: "Swimming Pool",
        documentTypes: ["Inspection"], // Only fetch actual inspections (learned from Hillsborough)
        batchSize: 100,
        timeout: 60000,
        retryAttempts: 3,
      },
    },
    create: {
      id: "pinellas-county-fl-ebridge-source",
      jurisdictionId: pinellas.id,
      name: "Pinellas County Pool Inspections (eBridge)",
      adapterType: AdapterType.SCRAPER, // eBridge uses Playwright scraper
      endpoint: "https://s2.ebridge.com/ebridge/3.0/default.aspx",
      isActive: true,
      config: {
        username: "public",
        password: "public",
        fileCabinet: "PINCHD",
        program: "Swimming Pool",
        documentTypes: ["Inspection"], // Only fetch actual inspections
        batchSize: 100,
        timeout: 60000,
        retryAttempts: 3,
      },
      requestsPerMinute: 10, // Be respectful with scraping
    },
  });
  console.log(`Created source: ${pinellasSource.name} (${pinellasSource.id})`);

  // Link to target jurisdiction if exists
  const target = await prisma.targetJurisdiction.findFirst({
    where: {
      state: "FL",
      name: { contains: "Pinellas", mode: "insensitive" },
    },
  });

  if (target) {
    await prisma.targetJurisdiction.update({
      where: { id: target.id },
      data: {
        jurisdictionId: pinellas.id,
        status: "INTEGRATED",
      },
    });
    console.log(`Linked to target jurisdiction: ${target.name}`);
  }

  console.log("\nDone! To run backfill:");
  console.log(`  npm run ingest:backfill -- --source ${pinellasSource.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
