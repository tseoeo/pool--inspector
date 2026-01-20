# Backfill Status Tracker

> **Last Updated:** 2026-01-20 14:05 EET
> **Total Inspections in DB:** ~90,500

## Active Backfills

| Source | Task ID | Status | Progress | Started | Notes |
|--------|---------|--------|----------|---------|-------|
| Georgia | `bd2b472` | ✅ Running | 4,325 fetched | 2026-01-20 13:46 | Almost complete |

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
| Georgia | 4,369+ | Tyler Technologies portal |
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

2. **Houston Low Record Count** - Only 204 records for a major city
   - May need to adjust search parameters or date range
   - Possible: Many pools managed by Harris County instead

3. **LA County Limited Results** - Only 100 facilities returned
   - Site pagination may need investigation

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
