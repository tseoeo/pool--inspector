# Backfill Status Tracker

> **Last Updated:** 2026-01-20 21:00 EET
> **Total Inspections in DB:** 92,145
> **Total Facilities:** 16,618
> **Total Jurisdictions:** 12

## Active Backfills

| Source | Task ID | Status | Progress | Estimate | Notes |
|--------|---------|--------|----------|----------|-------|
| Georgia | `b2c143b` | ✅ Running | 5,875+ records | ~1,200 pages | Using `--resume` flag; nearing completion |

## Current Database Counts

| Jurisdiction | Inspections | Notes |
|--------------|-------------|-------|
| Maricopa County | 57,124 | Largest dataset |
| Montgomery County | 10,865 | Socrata API |
| City of Austin | 5,972 | Socrata API |
| New York City | 5,747 | Socrata API |
| State of Georgia | 5,875 | Tyler portal (backfill in progress) |
| Louisville Metro | 3,889 | ArcGIS |
| City of Arlington | 1,693 | ArcGIS |
| City of Houston | 358 | Tyler portal (**needs full backfill**) |
| Tarrant County | 291 | Playwright scraper |
| Jackson County | 207 | ArcGIS |
| Los Angeles County | 100 | Playwright (**needs full backfill**) |
| City of Webster | 24 | ArcGIS (server offline) |

## Pending Backfills

| Source | Current | Estimated Total | Status | Notes |
|--------|---------|-----------------|--------|-------|
| Houston | 358 | **~3,500+** | 🔧 Ready | Pagination fixed; site has start=3481 |
| LA County | 100 | **~300** | 🔧 Ready | JS pagination fixed; 3 pages × 100 facilities |

## Recently Fixed (2026-01-20)

| Issue | Fix |
|-------|-----|
| Houston pagination | Was checking for next page after navigating away from results |
| LA County pagination | Added `goPageIndex(n)` JS function call via Playwright evaluate |
| Backfill resume | Added `--resume` flag to continue from saved cursor after DB drops |

## Known Issues

1. **Railway Database Connectivity** - Intermittent connection drops
   - Backfills use cursor-based pagination, can resume after drops
   - Monitor: `railway logs`

2. ~~**Houston Low Record Count**~~ - **FIXED** (2026-01-20)
   - Was checking pagination after navigating away from search results
   - Now properly continues to all ~3,500 facilities

3. ~~**LA County Limited Results**~~ - **FIXED** (2026-01-20)
   - Site uses JavaScript pagination (`goPageIndex(n)`)
   - Added pagination handling via `page.evaluate()` to call JS function directly
   - Now properly processes all 3 pages (~300 facilities)

## Commands

```bash
# Start fresh backfill
npm run ingest:backfill -- --source <source-id>

# Resume backfill from saved cursor (after DB drop)
npm run ingest:backfill -- --source <source-id> --resume

# Check active backfill progress
tail -f /private/tmp/claude/-Users-ivandimitrov-Projects-pool--inspector/tasks/<task-id>.output

# Check database counts by jurisdiction
npx tsx -e 'import { PrismaClient } from "@prisma/client"; const p = new PrismaClient(); p.$queryRaw`SELECT j.name, COUNT(ie.id)::int as c FROM "Jurisdiction" j LEFT JOIN "Facility" f ON f."jurisdictionId" = j.id LEFT JOIN "InspectionEvent" ie ON ie."facilityId" = f.id GROUP BY j.name ORDER BY c DESC`.then(console.log).finally(() => p.$disconnect())'

# Check total counts
npx tsx -e 'import { PrismaClient } from "@prisma/client"; const p = new PrismaClient(); Promise.all([p.inspectionEvent.count(), p.facility.count()]).then(([i,f]) => console.log("Inspections:", i, "Facilities:", f)).finally(() => p.$disconnect())'

# Kill zombie processes
pkill -f "backfill.*<source-id>"
```

## Source IDs Reference

| Source ID | Jurisdiction | Type |
|-----------|--------------|------|
| `georgia-statewide-tyler-source` | Georgia (statewide) | Tyler scraper |
| `houston-tx-scraper-source` | Houston, TX | Tyler scraper |
| `la-county-ca-scraper-source` | Los Angeles County, CA | Playwright |
| `maricopa-az-scraper-source` | Maricopa County, AZ | API scraper |
| `tarrant-county-tx-scraper-source` | Tarrant County, TX | Playwright |
| `austin-socrata-source` | Austin, TX | Socrata |
| `montgomery-md-socrata-source` | Montgomery County, MD | Socrata |
| `nyc-socrata-source` | New York City, NY | Socrata |
| `louisville-ky-arcgis-source` | Louisville, KY | ArcGIS |
| `arlington-tx-arcgis-source` | Arlington, TX | ArcGIS |
| `jackson-county-or-arcgis-source` | Jackson County, OR | ArcGIS |
| `webster-arcgis-source` | Webster, TX | ArcGIS (offline) |
