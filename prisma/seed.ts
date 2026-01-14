import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, JurisdictionType, AdapterType, TargetStatus } from "@prisma/client";
import { TARGET_JURISDICTIONS } from "../src/lib/target-jurisdictions";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

async function main() {
  console.log("Seeding database...");

  // Create Austin jurisdiction
  const austin = await prisma.jurisdiction.upsert({
    where: { slug: "austin-tx" },
    update: {},
    create: {
      slug: "austin-tx",
      name: "City of Austin",
      state: "TX",
      type: JurisdictionType.CITY,
      timezone: "America/Chicago",
      website: "https://www.austintexas.gov",
    },
  });
  console.log(`Created jurisdiction: ${austin.name} (${austin.id})`);

  // Create Webster jurisdiction
  const webster = await prisma.jurisdiction.upsert({
    where: { slug: "webster-tx" },
    update: {},
    create: {
      slug: "webster-tx",
      name: "City of Webster",
      state: "TX",
      type: JurisdictionType.CITY,
      timezone: "America/Chicago",
      website: "https://www.cityofwebster.com",
    },
  });
  console.log(`Created jurisdiction: ${webster.name} (${webster.id})`);

  // Create Austin Socrata source
  const austinSource = await prisma.source.upsert({
    where: {
      id: "austin-socrata-source",
    },
    update: {
      name: "Austin Pool Inspections (Socrata)",
      endpoint: "https://data.austintexas.gov/resource/peux-uuwu.json",
      config: {
        resource: "peux-uuwu",
        updatedAtField: ":updated_at",
        orderByField: "inspection_date",
        idField: "facility_id",
        batchSize: 1000,
      },
    },
    create: {
      id: "austin-socrata-source",
      jurisdictionId: austin.id,
      name: "Austin Pool Inspections (Socrata)",
      adapterType: AdapterType.SOCRATA,
      endpoint: "https://data.austintexas.gov/resource/peux-uuwu.json",
      isActive: true,
      config: {
        resource: "peux-uuwu",
        updatedAtField: ":updated_at",
        orderByField: "inspection_date",
        idField: "facility_id",
        batchSize: 1000,
      },
      requestsPerMinute: 60,
    },
  });
  console.log(`Created source: ${austinSource.name} (${austinSource.id})`);

  // Create Webster ArcGIS source
  const websterSource = await prisma.source.upsert({
    where: {
      id: "webster-arcgis-source",
    },
    update: {
      name: "Webster Pool/Spa Inspections (ArcGIS)",
      endpoint:
        "https://www1.cityofwebster.com/arcgis/rest/services/Landbase/Swimming_Pool_Inspections/MapServer/0",
      config: {
        layerId: 0,
        maxRecordCount: 1000,
        objectIdField: "OBJECTID",
        batchSize: 1000,
      },
    },
    create: {
      id: "webster-arcgis-source",
      jurisdictionId: webster.id,
      name: "Webster Pool/Spa Inspections (ArcGIS)",
      adapterType: AdapterType.ARCGIS,
      endpoint:
        "https://www1.cityofwebster.com/arcgis/rest/services/Landbase/Swimming_Pool_Inspections/MapServer/0",
      isActive: true,
      config: {
        layerId: 0,
        maxRecordCount: 1000,
        objectIdField: "OBJECTID",
        batchSize: 1000,
      },
      requestsPerMinute: 30,
    },
  });
  console.log(`Created source: ${websterSource.name} (${websterSource.id})`);

  // Create Montgomery County MD jurisdiction
  const montgomeryMD = await prisma.jurisdiction.upsert({
    where: { slug: "montgomery-county-md" },
    update: {},
    create: {
      slug: "montgomery-county-md",
      name: "Montgomery County",
      state: "MD",
      type: JurisdictionType.COUNTY,
      timezone: "America/New_York",
      website: "https://www.montgomerycountymd.gov",
    },
  });
  console.log(`Created jurisdiction: ${montgomeryMD.name} (${montgomeryMD.id})`);

  // Create Montgomery County MD Socrata source
  const montgomeryMDSource = await prisma.source.upsert({
    where: {
      id: "montgomery-md-socrata-source",
    },
    update: {
      name: "Montgomery County Pool Inspections (Socrata)",
      endpoint: "https://data.montgomerycountymd.gov/resource/k35y-k582.json",
      config: {
        resource: "k35y-k582",
        updatedAtField: ":updated_at",
        orderByField: "inspection_date",
        idField: "establishmentid",
        batchSize: 1000,
      },
    },
    create: {
      id: "montgomery-md-socrata-source",
      jurisdictionId: montgomeryMD.id,
      name: "Montgomery County Pool Inspections (Socrata)",
      adapterType: AdapterType.SOCRATA,
      endpoint: "https://data.montgomerycountymd.gov/resource/k35y-k582.json",
      isActive: true,
      config: {
        resource: "k35y-k582",
        updatedAtField: ":updated_at",
        orderByField: "inspection_date",
        idField: "establishmentid",
        batchSize: 1000,
      },
      requestsPerMinute: 60,
    },
  });
  console.log(`Created source: ${montgomeryMDSource.name} (${montgomeryMDSource.id})`);

  // Seed target jurisdictions for coverage tracking
  console.log("\nSeeding target jurisdictions...");

  // First, get all existing jurisdictions for linking
  const existingJurisdictions = await prisma.jurisdiction.findMany({
    select: { id: true, name: true, state: true },
  });

  // Create a map for quick lookup (normalize names for matching)
  const jurisdictionMap = new Map<string, string>();
  for (const j of existingJurisdictions) {
    // Map by "state-normalizedName" for matching
    const key = `${j.state}-${j.name.toLowerCase().replace(/city of |county of /gi, "").trim()}`;
    jurisdictionMap.set(key, j.id);
  }

  // Batch create all target jurisdictions
  const targetData = TARGET_JURISDICTIONS.map((target) => {
    const normalizedName = target.name.toLowerCase().replace(/city of |county of /gi, "").trim();
    const lookupKey = `${target.state}-${normalizedName}`;
    const matchedJurisdictionId = jurisdictionMap.get(lookupKey);

    return {
      state: target.state,
      name: target.name,
      type: target.type as JurisdictionType,
      priority: target.priority || 0,
      status: matchedJurisdictionId ? TargetStatus.INTEGRATED : TargetStatus.NOT_RESEARCHED,
      jurisdictionId: matchedJurisdictionId || null,
    };
  });

  // Delete existing and recreate for simplicity
  await prisma.targetJurisdiction.deleteMany({});
  const result = await prisma.targetJurisdiction.createMany({
    data: targetData,
    skipDuplicates: true,
  });

  const linked = targetData.filter((t) => t.jurisdictionId).length;
  console.log(`Seeded ${result.count} target jurisdictions (${linked} linked to existing data)`);

  console.log("\nSeeding complete!");
  console.log("\nTo run ingestion:");
  console.log(
    `  Austin:         npm run ingest:backfill -- --source ${austinSource.id}`
  );
  console.log(
    `  Webster:        npm run ingest:backfill -- --source ${websterSource.id}`
  );
  console.log(
    `  Montgomery MD:  npm run ingest:backfill -- --source ${montgomeryMDSource.id}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
