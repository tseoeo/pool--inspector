import "dotenv/config";
import { PrismaClient, JurisdictionType, AdapterType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Adding San Diego County CA...");

  // Create San Diego County CA jurisdiction
  const sanDiego = await prisma.jurisdiction.upsert({
    where: { slug: "san-diego-county-ca" },
    update: {},
    create: {
      slug: "san-diego-county-ca",
      name: "San Diego County",
      state: "CA",
      type: JurisdictionType.COUNTY,
      timezone: "America/Los_Angeles",
      website: "https://www.sandiegocounty.gov/deh",
    },
  });
  console.log(`Created jurisdiction: ${sanDiego.name} (${sanDiego.id})`);

  // Create San Diego County Accela scraper source
  const sanDiegoSource = await prisma.source.upsert({
    where: {
      id: "san-diego-county-ca-scraper-source",
    },
    update: {
      name: "San Diego County Pool Inspections (Accela Citizen Access)",
      endpoint: "https://publicservices.sandiegocounty.gov/CitizenAccess",
      config: {
        recordType: "Pool - Parent",
        searchTimeout: 60000,
        pageSize: 10,
        batchSize: 100,
        timeout: 90000,
        retryAttempts: 3,
      },
    },
    create: {
      id: "san-diego-county-ca-scraper-source",
      jurisdictionId: sanDiego.id,
      name: "San Diego County Pool Inspections (Accela Citizen Access)",
      adapterType: AdapterType.SCRAPER,
      endpoint: "https://publicservices.sandiegocounty.gov/CitizenAccess",
      isActive: true,
      config: {
        recordType: "Pool - Parent",
        searchTimeout: 60000,
        pageSize: 10, // Accela default is 10 per page
        batchSize: 100,
        timeout: 90000,
        retryAttempts: 3,
      },
      requestsPerMinute: 10, // Be respectful with scraping
    },
  });
  console.log(`Created source: ${sanDiegoSource.name} (${sanDiegoSource.id})`);

  // Link to target jurisdiction if exists
  const target = await prisma.targetJurisdiction.findFirst({
    where: {
      state: "CA",
      name: { contains: "San Diego", mode: "insensitive" },
    },
  });

  if (target) {
    await prisma.targetJurisdiction.update({
      where: { id: target.id },
      data: {
        jurisdictionId: sanDiego.id,
        status: "INTEGRATED",
      },
    });
    console.log(`Linked to target jurisdiction: ${target.name}`);
  }

  console.log("\nDone! To run backfill:");
  console.log(`  npm run ingest:backfill -- --source ${sanDiegoSource.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
