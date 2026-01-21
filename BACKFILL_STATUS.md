# Backfill Status Tracker

> **Last Updated:** 2026-01-21 07:30 EET
> **Total Inspections in DB:** 93,957
> **Total Facilities:** 18,388
> **Total Jurisdictions:** 13
> **Geocoded Facilities:** 72% (13,235/18,388)

## Active Backfills

| Source | Status | Progress | Notes |
|--------|--------|----------|-------|
| Geocoding | 🔄 Running | 8,280/12,042 (69%) | ~1 hour remaining at 1 req/sec |

## Recently Completed (2026-01-21)

| Source | Records | Duration | Notes |
|--------|---------|----------|-------|
| Georgia | 7,594 inspections | ~2.4 hours | Tyler portal, full backfill complete |
| Hillsborough FL | 93 inspections | ~7 hours | eBridge document system (see note below) |

### Why Hillsborough Had High Traffic But Low Records

The eBridge system is a **document management portal**, not an inspection database. It indexes ALL documents related to pool permits:
- Applications
- Correspondence
- Complaints
- Enforcement notices
- Inspection reports

**What happened:**
- Scraper fetched 28,371 document references across 285+ pages
- Only 64 were actual "Inspection" documents
- Ingestion system deduplicated by content hash:
  - 25,813 skipped (identical to existing records from retry attempts)
  - 2,552 updated (same permit, different content)
  - 0 new unique records created
- Final result: 93 unique inspection-related documents

**Lesson learned:** eBridge sources will have high fetch-to-insert ratios due to document diversity. Consider filtering by document type at scrape time for efficiency.

## Current Database Counts

| Jurisdiction | Facilities | Inspections | Notes |
|--------------|------------|-------------|-------|
| Maricopa County | 5,192 | 57,124 | Largest dataset |
| State of Georgia | 7,433 | 7,594 | ✅ Backfill complete |
| Montgomery County | 595 | 10,865 | Socrata API |
| City of Austin | 2,316 | 5,972 | Socrata API |
| New York City | 1,614 | 5,747 | Socrata API |
| Louisville Metro | 430 | 3,889 | ArcGIS |
| City of Arlington | 360 | 1,693 | ArcGIS |
| City of Houston | 53 | 358 | Tyler portal (**needs full backfill**) |
| Tarrant County | 37 | 291 | Playwright scraper |
| Jackson County | 167 | 207 | ArcGIS |
| Los Angeles County | 97 | 100 | Playwright (**needs full backfill**) |
| Hillsborough County | 72 | 93 | eBridge (document types: Inspection, Application, etc.) |
| City of Webster | 22 | 24 | ArcGIS (server offline) |

## Pending Backfills

| Source | Current | Estimated Total | Status | Notes |
|--------|---------|-----------------|--------|-------|
| Houston | 358 | **~3,500+** | 🔧 Ready | Pagination fixed; site has start=3481 |
| LA County | 100 | **~300** | 🔧 Ready | JS pagination fixed; 3 pages × 100 facilities |
| Geocoding | 8,280 | 12,042 | 🔄 Running | Nominatim API, ~1 req/sec rate limit |

## Overnight Runner

For long-running backfills, use the auto-retry script:

```bash
# Start all three tasks with auto-retry (up to 10 retries each)
./scripts/overnight-runner.sh

# Monitor progress
tail -f logs/*.log

# Check if still running
ps aux | grep overnight
```

The overnight runner:
- Runs geocode, Georgia, and Hillsborough backfills in parallel
- Auto-retries on failure (30s delay, max 10 attempts)
- Logs to `logs/<process>_<timestamp>.log`
- All processes support `--resume` to continue from last cursor

## Commands

```bash
# Start fresh backfill
npm run ingest:backfill -- --source <source-id>

# Resume backfill from saved cursor (after DB drop)
npm run ingest:backfill -- --source <source-id> --resume

# Run geocoding
npm run geocode -- --resume

# Check database counts by jurisdiction
npx tsx -e 'import { PrismaClient } from "@prisma/client"; const p = new PrismaClient(); p.$queryRaw`SELECT j.name, COUNT(DISTINCT f.id)::int as facilities, COUNT(ie.id)::int as inspections FROM "Jurisdiction" j LEFT JOIN "Facility" f ON f."jurisdictionId" = j.id LEFT JOIN "InspectionEvent" ie ON ie."facilityId" = f.id GROUP BY j.name ORDER BY inspections DESC`.then(console.log).finally(() => p.$disconnect())'

# Check total counts
npx tsx -e 'import { PrismaClient } from "@prisma/client"; const p = new PrismaClient(); Promise.all([p.inspectionEvent.count(), p.facility.count()]).then(([i,f]) => console.log("Inspections:", i, "Facilities:", f)).finally(() => p.$disconnect())'
```

## Source IDs Reference

| Source ID | Jurisdiction | Type |
|-----------|--------------|------|
| `georgia-statewide-tyler-source` | Georgia (statewide) | Tyler scraper |
| `hillsborough-county-fl-ebridge-source` | Hillsborough County, FL | eBridge scraper |
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

## Known Issues

1. **Railway Database Connectivity** - Intermittent connection drops
   - Backfills use cursor-based pagination, can resume after drops
   - Overnight runner handles auto-retry
   - Monitor: `railway logs`

2. **eBridge High Traffic** - Document management systems fetch many non-inspection records
   - Consider filtering by documentType at scrape time
   - Current approach: fetch all, dedupe at ingestion
