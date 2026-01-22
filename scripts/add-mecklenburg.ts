import "dotenv/config";
import { PrismaClient, JurisdictionType, AdapterType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Adding Mecklenburg County NC...");

  // Create Mecklenburg County NC jurisdiction
  const mecklenburg = await prisma.jurisdiction.upsert({
    where: { slug: "mecklenburg-county-nc" },
    update: {},
    create: {
      slug: "mecklenburg-county-nc",
      name: "Mecklenburg County",
      state: "NC",
      type: JurisdictionType.COUNTY,
      timezone: "America/New_York",
      website: "https://www.mecknc.gov/HealthDepartment",
    },
  });
  console.log(`Created jurisdiction: ${mecklenburg.name} (${mecklenburg.id})`);

  // Create Mecklenburg County scraper source (NC CDP Portal)
  const mecklenburgSource = await prisma.source.upsert({
    where: {
      id: "mecklenburg-county-nc-scraper-source",
    },
    update: {
      name: "Mecklenburg County Pool Inspections (NC CDP Portal)",
      endpoint: "https://public.cdpehs.com/NCENVPBL",
      config: {
        countyCode: "60", // Mecklenburg County = 60 in NC system
        poolTypes: ["Swimming Pool", "Pool", "Spa", "Aquatic"],
        searchTimeout: 60000,
        batchSize: 50,
        timeout: 90000,
        retryAttempts: 3,
      },
    },
    create: {
      id: "mecklenburg-county-nc-scraper-source",
      jurisdictionId: mecklenburg.id,
      name: "Mecklenburg County Pool Inspections (NC CDP Portal)",
      adapterType: AdapterType.SCRAPER,
      endpoint: "https://public.cdpehs.com/NCENVPBL",
      isActive: true,
      config: {
        countyCode: "60", // Mecklenburg County = 60 in NC system
        poolTypes: ["Swimming Pool", "Pool", "Spa", "Aquatic"],
        searchTimeout: 60000,
        batchSize: 50,
        timeout: 90000,
        retryAttempts: 3,
      },
      requestsPerMinute: 10,
    },
  });
  console.log(`Created source: ${mecklenburgSource.name} (${mecklenburgSource.id})`);

  // Link to target jurisdiction if exists
  const target = await prisma.targetJurisdiction.findFirst({
    where: {
      state: "NC",
      name: { contains: "Mecklenburg", mode: "insensitive" },
    },
  });

  if (target) {
    await prisma.targetJurisdiction.update({
      where: { id: target.id },
      data: {
        jurisdictionId: mecklenburg.id,
        status: "INTEGRATED",
      },
    });
    console.log(`Linked to target jurisdiction: ${target.name}`);
  }

  console.log("\nDone! To run backfill:");
  console.log(`  npm run ingest:backfill -- --source ${mecklenburgSource.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
