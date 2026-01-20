# Backfill Status Tracker

> **Last Updated:** 2026-01-20 18:30 EET
> **Total Inspections in DB:** ~91,300

## Active Backfills

| Source | Task ID | Status | Progress | Estimate | Notes |
|--------|---------|--------|----------|----------|-------|
| Georgia | `bb991c3` | ✅ Running | Page 34+ | ~1,100 pages | Using new `--resume` flag to continue from saved cursor |

## Estimates

| Source | Current in DB | Estimated Total | Notes |
|--------|---------------|-----------------|-------|
| Georgia | 5,125 | ~5,500-6,000 | Tyler portal, statewide. May have more pages beyond offset 1025 |
| Houston | ~200 | **~3,500+** | **FIXED** - site has start=3481. Bug was checking pagination after navigating away |
| LA County | ~100 | **~300** | **FIXED** - 3 pages × 100 facilities. Site uses JS pagination (goPageIndex) |

## Previous Run

| Source | Task ID | Status | Progress | Notes |
|--------|---------|--------|----------|-------|
| Georgia | `bd2b472` | ⚠️ Failed (DB timeout) | 5,125 records | Got 756 new records before connection pool timeout |

## Recently Completed (2026-01-20)

| Source | Task ID | Records | New/Updated | Duration | Notes |
|--------|---------|---------|-------------|----------|-------|
| Houston | `b8fcc30` | 204 | 0 new, 6 updated | 393s | Only ~40 facilities found - needs investigation |
| LA County | `bbedda7` | 100 | 5 new | 306s | Site only returned 100 facilities |
| Tarrant County | `bf8f9b2` | 1,012 | 291 new | 1816s | Completed successfully |

## Completed Backfills (Historical)

| Source | Records in DB | Notes |
|--------|---------------|-------|
| Maricopa County | 57,124 | Largest dataset |
| Montgomery County | 10,865 | Socrata API |
| Austin | 5,972 | Socrata API |
| NYC | 5,747 | Socrata API |
| Georgia | 5,125 | Tyler Technologies portal |
| Louisville | 3,889 | ArcGIS |
| Arlington | 1,693 | ArcGIS |
| Tarrant County | 291 | Playwright scraper |
| Jackson County | 207 | ArcGIS |
| Houston | 201 | Tyler Technologies portal |
| LA County | 99 | Playwright scraper |
| Webster | 24 | ArcGIS (server offline) |

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
# Check active backfill progress
tail -f /private/tmp/claude/-Users-ivandimitrov-Projects-pool--inspector/tasks/bd2b472.output

# Restart a backfill
npm run ingest:backfill -- --source <source-id>

# Check database counts
npx tsx -e 'import { PrismaClient } from "@prisma/client"; const p = new PrismaClient(); p.$queryRaw`SELECT j.name, COUNT(ie.id)::int as c FROM "Jurisdiction" j LEFT JOIN "Facility" f ON f."jurisdictionId" = j.id LEFT JOIN "InspectionEvent" ie ON ie."facilityId" = f.id GROUP BY j.name ORDER BY c DESC`.then(console.log).finally(() => p.$disconnect())'

# Kill zombie processes
ps aux | grep backfill | grep -v grep
kill <pid>
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
