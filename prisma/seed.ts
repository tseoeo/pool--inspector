import "dotenv/config";
import { PrismaClient, JurisdictionType, AdapterType, TargetStatus } from "@prisma/client";
import { TARGET_JURISDICTIONS } from "../src/lib/target-jurisdictions";

const prisma = new PrismaClient({
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

  // Create NYC jurisdiction
  const nyc = await prisma.jurisdiction.upsert({
    where: { slug: "new-york-city-ny" },
    update: {},
    create: {
      slug: "new-york-city-ny",
      name: "New York City",
      state: "NY",
      type: JurisdictionType.CITY,
      timezone: "America/New_York",
      website: "https://www.nyc.gov",
    },
  });
  console.log(`Created jurisdiction: ${nyc.name} (${nyc.id})`);

  // Create NYC Socrata source
  const nycSource = await prisma.source.upsert({
    where: {
      id: "nyc-socrata-source",
    },
    update: {
      name: "NYC Pool Inspections (Socrata)",
      endpoint: "https://data.cityofnewyork.us/resource/3kfa-rvez.json",
      config: {
        resource: "3kfa-rvez",
        updatedAtField: ":updated_at",
        orderByField: "inspection_date",
        idField: "accela",
        batchSize: 1000,
      },
    },
    create: {
      id: "nyc-socrata-source",
      jurisdictionId: nyc.id,
      name: "NYC Pool Inspections (Socrata)",
      adapterType: AdapterType.SOCRATA,
      endpoint: "https://data.cityofnewyork.us/resource/3kfa-rvez.json",
      isActive: true,
      config: {
        resource: "3kfa-rvez",
        updatedAtField: ":updated_at",
        orderByField: "inspection_date",
        idField: "accela",
        batchSize: 1000,
      },
      requestsPerMinute: 60,
    },
  });
  console.log(`Created source: ${nycSource.name} (${nycSource.id})`);

  // Create Maricopa County AZ jurisdiction
  const maricopaAZ = await prisma.jurisdiction.upsert({
    where: { slug: "maricopa-county-az" },
    update: {},
    create: {
      slug: "maricopa-county-az",
      name: "Maricopa County",
      state: "AZ",
      type: JurisdictionType.COUNTY,
      timezone: "America/Phoenix",
      website: "https://www.maricopa.gov",
    },
  });
  console.log(`Created jurisdiction: ${maricopaAZ.name} (${maricopaAZ.id})`);

  // Create Maricopa County AZ scraper source
  const maricopaSource = await prisma.source.upsert({
    where: {
      id: "maricopa-az-scraper-source",
    },
    update: {
      name: "Maricopa County Pool Inspections (Scraper)",
      endpoint: "https://envapp.maricopa.gov",
      config: {
        batchSize: 20, // Process 20 facilities per batch (slower due to scraping)
      },
    },
    create: {
      id: "maricopa-az-scraper-source",
      jurisdictionId: maricopaAZ.id,
      name: "Maricopa County Pool Inspections (Scraper)",
      adapterType: AdapterType.SCRAPER,
      endpoint: "https://envapp.maricopa.gov",
      isActive: true,
      config: {
        batchSize: 20, // Process 20 facilities per batch
      },
      requestsPerMinute: 10, // Be respectful with scraping
    },
  });
  console.log(`Created source: ${maricopaSource.name} (${maricopaSource.id})`);

  // Create LA County CA jurisdiction
  const laCountyCA = await prisma.jurisdiction.upsert({
    where: { slug: "la-county-ca" },
    update: {},
    create: {
      slug: "la-county-ca",
      name: "Los Angeles County",
      state: "CA",
      type: JurisdictionType.COUNTY,
      timezone: "America/Los_Angeles",
      website: "https://publichealth.lacounty.gov",
    },
  });
  console.log(`Created jurisdiction: ${laCountyCA.name} (${laCountyCA.id})`);

  // Create LA County CA scraper source (Playwright-based)
  const laCountySource = await prisma.source.upsert({
    where: {
      id: "la-county-ca-scraper-source",
    },
    update: {
      name: "LA County Pool Inspections (Scraper)",
      endpoint: "https://ehservices.publichealth.lacounty.gov",
      config: {
        batchSize: 10, // Process 10 facilities per batch (browser-based scraping is slower)
        searchTimeout: 30000,
        pageSize: 50,
      },
    },
    create: {
      id: "la-county-ca-scraper-source",
      jurisdictionId: laCountyCA.id,
      name: "LA County Pool Inspections (Scraper)",
      adapterType: AdapterType.SCRAPER,
      endpoint: "https://ehservices.publichealth.lacounty.gov",
      isActive: true,
      config: {
        batchSize: 10, // Process 10 facilities per batch (browser-based scraping is slower)
        searchTimeout: 30000,
        pageSize: 50,
      },
      requestsPerMinute: 5, // Be very respectful with browser-based scraping
    },
  });
  console.log(`Created source: ${laCountySource.name} (${laCountySource.id})`);

  // Create Georgia Statewide jurisdiction
  const georgiaStatewide = await prisma.jurisdiction.upsert({
    where: { slug: "georgia-statewide" },
    update: {},
    create: {
      slug: "georgia-statewide",
      name: "State of Georgia",
      state: "GA",
      type: JurisdictionType.STATE,
      timezone: "America/New_York",
      website: "https://dph.georgia.gov",
    },
  });
  console.log(`Created jurisdiction: ${georgiaStatewide.name} (${georgiaStatewide.id})`);

  // Create Georgia Tyler source (statewide environmental health portal)
  const georgiaSource = await prisma.source.upsert({
    where: {
      id: "georgia-statewide-tyler-source",
    },
    update: {
      name: "Georgia Pool Inspections (Tyler Technologies)",
      endpoint: "https://ga.healthinspections.us/stateofgeorgia",
      config: {
        permitTypeFilter: "U3dpbW1pbmcgUG9vbA==", // Base64 encoded "Swimming Pool"
        pageSize: 5, // API returns 5 results per page
        batchSize: 5,
      },
    },
    create: {
      id: "georgia-statewide-tyler-source",
      jurisdictionId: georgiaStatewide.id,
      name: "Georgia Pool Inspections (Tyler Technologies)",
      adapterType: AdapterType.SCRAPER, // Using SCRAPER type for custom adapters
      endpoint: "https://ga.healthinspections.us/stateofgeorgia",
      isActive: true,
      config: {
        permitTypeFilter: "U3dpbW1pbmcgUG9vbA==", // Base64 encoded "Swimming Pool"
        pageSize: 5, // API returns 5 results per page
        batchSize: 5,
      },
      requestsPerMinute: 30, // Respectful rate limiting
    },
  });
  console.log(`Created source: ${georgiaSource.name} (${georgiaSource.id})`);

  // Create Louisville Metro KY jurisdiction
  const louisville = await prisma.jurisdiction.upsert({
    where: { slug: "louisville-ky" },
    update: {},
    create: {
      slug: "louisville-ky",
      name: "Louisville Metro",
      state: "KY",
      type: JurisdictionType.COUNTY,
      timezone: "America/New_York",
      website: "https://louisvilleky.gov",
    },
  });
  console.log(`Created jurisdiction: ${louisville.name} (${louisville.id})`);

  // Create Louisville Metro ArcGIS source
  const louisvilleSource = await prisma.source.upsert({
    where: {
      id: "louisville-ky-arcgis-source",
    },
    update: {
      name: "Louisville Metro Pool Inspections (ArcGIS)",
      endpoint:
        "https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/Louisville_Metro_KY_Pool_Inspections/FeatureServer/0",
      config: {
        layerId: 0,
        maxRecordCount: 2000,
        objectIdField: "ObjectId",
        batchSize: 1000,
      },
    },
    create: {
      id: "louisville-ky-arcgis-source",
      jurisdictionId: louisville.id,
      name: "Louisville Metro Pool Inspections (ArcGIS)",
      adapterType: AdapterType.ARCGIS,
      endpoint:
        "https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/Louisville_Metro_KY_Pool_Inspections/FeatureServer/0",
      isActive: true,
      config: {
        layerId: 0,
        maxRecordCount: 2000,
        objectIdField: "ObjectId",
        batchSize: 1000,
      },
      requestsPerMinute: 60,
    },
  });
  console.log(`Created source: ${louisvilleSource.name} (${louisvilleSource.id})`);

  // Create Arlington TX jurisdiction
  const arlington = await prisma.jurisdiction.upsert({
    where: { slug: "arlington-tx" },
    update: {},
    create: {
      slug: "arlington-tx",
      name: "City of Arlington",
      state: "TX",
      type: JurisdictionType.CITY,
      timezone: "America/Chicago",
      website: "https://www.arlingtontx.gov",
    },
  });
  console.log(`Created jurisdiction: ${arlington.name} (${arlington.id})`);

  // Create Arlington TX ArcGIS source
  const arlingtonSource = await prisma.source.upsert({
    where: {
      id: "arlington-tx-arcgis-source",
    },
    update: {
      name: "Arlington Pool Inspections (ArcGIS)",
      endpoint:
        "https://gis2.arlingtontx.gov/agsext2/rest/services/OpenData/OD_Community/MapServer/11",
      config: {
        layerId: 11,
        maxRecordCount: 1000,
        objectIdField: "OBJECTID",
        batchSize: 1000,
      },
    },
    create: {
      id: "arlington-tx-arcgis-source",
      jurisdictionId: arlington.id,
      name: "Arlington Pool Inspections (ArcGIS)",
      adapterType: AdapterType.ARCGIS,
      endpoint:
        "https://gis2.arlingtontx.gov/agsext2/rest/services/OpenData/OD_Community/MapServer/11",
      isActive: true,
      config: {
        layerId: 11,
        maxRecordCount: 1000,
        objectIdField: "OBJECTID",
        batchSize: 1000,
      },
      requestsPerMinute: 60,
    },
  });
  console.log(`Created source: ${arlingtonSource.name} (${arlingtonSource.id})`);

  // Create Jackson County OR jurisdiction
  const jacksonCountyOR = await prisma.jurisdiction.upsert({
    where: { slug: "jackson-county-or" },
    update: {},
    create: {
      slug: "jackson-county-or",
      name: "Jackson County",
      state: "OR",
      type: JurisdictionType.COUNTY,
      timezone: "America/Los_Angeles",
      website: "https://jacksoncountyor.gov",
    },
  });
  console.log(`Created jurisdiction: ${jacksonCountyOR.name} (${jacksonCountyOR.id})`);

  // Create Jackson County OR ArcGIS source
  const jacksonCountyORSource = await prisma.source.upsert({
    where: {
      id: "jackson-county-or-arcgis-source",
    },
    update: {
      name: "Jackson County Pool Inspections (ArcGIS)",
      endpoint:
        "https://services1.arcgis.com/DwYBkWQPdaJNWrPG/arcgis/rest/services/Environmental_Health_Inspections_View/FeatureServer/0",
      config: {
        layerId: 0,
        maxRecordCount: 1000,
        objectIdField: "OBJECTID",
        batchSize: 500,
        whereClause: "module_1='Pool'",
      },
    },
    create: {
      id: "jackson-county-or-arcgis-source",
      jurisdictionId: jacksonCountyOR.id,
      name: "Jackson County Pool Inspections (ArcGIS)",
      adapterType: AdapterType.ARCGIS,
      endpoint:
        "https://services1.arcgis.com/DwYBkWQPdaJNWrPG/arcgis/rest/services/Environmental_Health_Inspections_View/FeatureServer/0",
      isActive: true,
      config: {
        layerId: 0,
        maxRecordCount: 1000,
        objectIdField: "OBJECTID",
        batchSize: 500,
        whereClause: "module_1='Pool'",
      },
      requestsPerMinute: 60,
    },
  });
  console.log(`Created source: ${jacksonCountyORSource.name} (${jacksonCountyORSource.id})`);

  // Create Tarrant County TX jurisdiction (covers 27+ cities in DFW area)
  const tarrantCounty = await prisma.jurisdiction.upsert({
    where: { slug: "tarrant-county-tx" },
    update: {},
    create: {
      slug: "tarrant-county-tx",
      name: "Tarrant County",
      state: "TX",
      type: JurisdictionType.COUNTY,
      timezone: "America/Chicago",
      website: "https://www.tarrantcounty.com",
    },
  });
  console.log(`Created jurisdiction: ${tarrantCounty.name} (${tarrantCounty.id})`);

  // Create Tarrant County TX scraper source
  const tarrantCountySource = await prisma.source.upsert({
    where: {
      id: "tarrant-county-tx-scraper-source",
    },
    update: {
      name: "Tarrant County Pool Inspections (Web Scraper)",
      endpoint: "https://poolinspection.tarrantcounty.com",
      config: {
        batchSize: 50,
        timeout: 30000,
      },
    },
    create: {
      id: "tarrant-county-tx-scraper-source",
      jurisdictionId: tarrantCounty.id,
      name: "Tarrant County Pool Inspections (Web Scraper)",
      adapterType: AdapterType.SCRAPER,
      endpoint: "https://poolinspection.tarrantcounty.com",
      isActive: true,
      config: {
        batchSize: 50,
        timeout: 30000,
      },
      requestsPerMinute: 20, // Respectful rate limiting for web scraping
    },
  });
  console.log(`Created source: ${tarrantCountySource.name} (${tarrantCountySource.id})`);

  // Create Houston TX jurisdiction
  const houston = await prisma.jurisdiction.upsert({
    where: { slug: "houston-tx" },
    update: {},
    create: {
      slug: "houston-tx",
      name: "City of Houston",
      state: "TX",
      type: JurisdictionType.CITY,
      timezone: "America/Chicago",
      website: "https://www.houstontx.gov",
    },
  });
  console.log(`Created jurisdiction: ${houston.name} (${houston.id})`);

  // Create Houston TX scraper source (Tyler Technologies portal)
  const houstonSource = await prisma.source.upsert({
    where: {
      id: "houston-tx-scraper-source",
    },
    update: {
      name: "Houston Pool Inspections (Web Scraper)",
      endpoint: "https://tx.healthinspections.us/houston",
      config: {
        batchSize: 50,
        timeout: 30000,
        retryAttempts: 3,
      },
    },
    create: {
      id: "houston-tx-scraper-source",
      jurisdictionId: houston.id,
      name: "Houston Pool Inspections (Web Scraper)",
      adapterType: AdapterType.SCRAPER,
      endpoint: "https://tx.healthinspections.us/houston",
      isActive: true,
      config: {
        batchSize: 50,
        timeout: 30000,
        retryAttempts: 3,
      },
      requestsPerMinute: 10, // Respectful rate limiting for web scraping
    },
  });
  console.log(`Created source: ${houstonSource.name} (${houstonSource.id})`);

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
  console.log(
    `  NYC:            npm run ingest:backfill -- --source ${nycSource.id}`
  );
  console.log(
    `  Maricopa AZ:    npm run ingest:backfill -- --source ${maricopaSource.id}`
  );
  console.log(
    `  LA County CA:   npm run ingest:backfill -- --source ${laCountySource.id}`
  );
  console.log(
    `  Georgia:        npm run ingest:backfill -- --source ${georgiaSource.id}`
  );
  console.log(
    `  Louisville:     npm run ingest:backfill -- --source ${louisvilleSource.id}`
  );
  console.log(
    `  Arlington TX:   npm run ingest:backfill -- --source ${arlingtonSource.id}`
  );
  console.log(
    `  Jackson Co OR:  npm run ingest:backfill -- --source ${jacksonCountyORSource.id}`
  );
  console.log(
    `  Tarrant Co TX:  npm run ingest:backfill -- --source ${tarrantCountySource.id}`
  );
  console.log(
    `  Houston TX:     npm run ingest:backfill -- --source ${houstonSource.id}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
