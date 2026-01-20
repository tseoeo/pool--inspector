# Pool Inspection Data Sources

> **Last Updated:** 2026-01-20
>
> This file tracks all known and potential pool inspection data sources, their integration status, and notes on accessibility.

## Summary

| Status | Count |
|--------|-------|
| **Active** | 10 |
| **Inactive** | 1 |
| **Blocked** | 3 |
| **Potential** | 15+ |

---

## Active Sources

Sources that are integrated and working.

| Jurisdiction | Type | Adapter | Records | Notes |
|-------------|------|---------|---------|-------|
| Austin, TX | Socrata | `SocrataAdapter` | ~6,000 insp | Stable, good data quality |
| Montgomery County, MD | Socrata | `SocrataAdapter` | ~11,000 insp | Slow API (~10s response) |
| New York City, NY | Socrata | `SocrataAdapter` | ~5,700 insp | Large dataset |
| Maricopa County, AZ | Scraper | `MaricopaScraperAdapter` | ~56,000 insp | Custom scraper for county portal |
| Los Angeles County, CA | Scraper | `LACountyScraperAdapter` | ~100 insp | Web scraper, limited data |
| State of Georgia | Scraper | `GeorgiaTylerAdapter` | ~8,000 insp | Tyler/MHD platform, pagination-based |
| Louisville Metro, KY | ArcGIS | `ArcGISAdapter` | ~2,000 insp | FeatureServer with chemistry data |
| Arlington, TX | ArcGIS | `ArcGISAdapter` | ~1,700 insp | Score-based system |
| Jackson County, OR | ArcGIS | `ArcGISAdapter` | ~200 insp | Uses whereClause filter for pools |
| Webster, TX | ArcGIS | `ArcGISAdapter` | ~25 insp | Small city, 365-day rolling window |

---

## Inactive Sources

Sources that were working but are currently unavailable.

| Jurisdiction | Type | Reason | Last Checked | Notes |
|-------------|------|--------|--------------|-------|
| Webster, TX | ArcGIS | Server was offline | 2026-01-15 | Back online as of 2026-01-19, reactivated |

---

## Blocked Sources

Sources we've investigated but cannot access programmatically.

| Jurisdiction | Type | Blocker | Details |
|-------------|------|---------|---------|
| **MyHealthDepartment (general)** | Tyler Tech | 403 Forbidden | Bot detection (Cloudflare). Most MHD portals block automated access. Workaround: scrape individual facility pages like Georgia adapter does. |
| **San Luis Obispo County, CA** | MHD | 403 Forbidden | Uses SwimSafeSLO map + MHD backend. Same blocker as other MHD sites. |
| **Michigan EGLE** | Portal | Account required | MiEHDWIS system requires registration/login to access data |

---

## Potential Sources - API Based

Sources with known APIs that could be integrated.

### High Priority (Large jurisdictions, confirmed APIs)

| Jurisdiction | Type | Endpoint | Est. Size | Status | Notes |
|-------------|------|----------|-----------|--------|-------|
| Houston, TX | Web Portal | houstonconsumer.org | Large | **To investigate** | Search by name/zip/letter. Would need scraper. |
| San Diego County, CA | Unknown | data.sandiegocounty.gov | ~4,000 pools | **Not found** | Has pool program but no open data API found |
| Clark County, NV (Las Vegas) | Unknown | clarkcountynv.gov | Large | **Not found** | Southern Nevada Health District handles pools |
| Miami-Dade County, FL | Unknown | opendata.miamidade.gov | Large | **Not found** | Has open data portal but no pool inspections |

### Medium Priority

| Jurisdiction | Type | Endpoint | Est. Size | Status | Notes |
|-------------|------|----------|-----------|--------|-------|
| Wake County, NC (Raleigh) | Power BI | powerbigov.us | ~1,400 pools | **No API** | Data in Power BI dashboard, no export |
| King County, WA (Seattle) | Unknown | data.kingcounty.gov | Unknown | **Not found** | Has food inspections but not pools |
| Hillsborough County, FL (Tampa) | eBridge | floridahealth.gov | Unknown | **Account req** | Uses eBridge system, needs credentials |
| Orange County, FL (Orlando) | Unknown | ocgis-datahub-ocfl.hub.arcgis.com | Unknown | **Not found** | GIS data but no pool inspections |
| Fairfax County, VA | ArcGIS | data-fairfaxcountygis.opendata.arcgis.com | Unknown | **Location only** | Has pool locations, not inspections |
| Travis County, TX (Austin area) | Unknown | traviscountytx.gov | Unknown | **Not found** | Texas DSHS delegates to local authorities |
| Pima County, AZ (Tucson) | Unknown | gisopendata.pima.gov | Unknown | **Not found** | Has pool program but no open data |
| Snohomish County, WA | Web | snohd.org | Unknown | **Web only** | Inspection reports viewable online, no API |
| Denver, CO | Unknown | data.colorado.gov | Unknown | **Not found** | State portal exists but no pool data |
| Philadelphia, PA | Unknown | opendataphilly.org | Unknown | **Location only** | Has pool locations (Parks & Rec), not inspections |

### Lower Priority / Smaller Jurisdictions

| Jurisdiction | Type | Notes |
|-------------|------|-------|
| Bexar County, TX (San Antonio) | Unknown | No open data found |
| Duval County, FL (Jacksonville) | Unknown | No open data found |
| Hamilton County, OH (Cincinnati) | Unknown | No open data found |
| San Francisco, CA | Unknown | No open data found |
| Riverside County, CA | Unknown | No open data found |
| Oklahoma (statewide) | Unknown | No open data found |

---

## Potential Sources - Web Scraping Required

Sources where data is available but requires custom scraping.

| Jurisdiction | Data Format | Difficulty | Est. Size | Notes |
|-------------|-------------|------------|-----------|-------|
| **Houston, TX** | Web search portal | Medium | Large | Search by name, zip, letter. Could enumerate by zip code. |
| **Cobb & Douglas County, GA** | Web lookup | Medium | Unknown | Same platform as Georgia statewide (Tyler/MHD) |
| **Florida (67 counties)** | Per-county portals | Hard | Very large | Each county has own contact; no centralized API |
| **Various MHD jurisdictions** | Tyler Tech pages | Medium | Varies | Could adapt Georgia scraper pattern to other MHD sites |

---

## Potential Sources - Aggregate/Statistics Only

Sources that provide summary statistics but not individual records.

| Source | Data Available | Format | Notes |
|--------|---------------|--------|-------|
| **Florida Health CHARTS** | Unsatisfactory inspection % by county | Excel export | 2005-2024 data. Good for coverage stats, not facility-level. |
| **CDC Data** | National statistics | Reports/PDF | Policy-level data, not facility inspections |

---

## Potential Sources - PDF/Document Based

Sources where inspection reports are published as documents.

| Jurisdiction | Format | Difficulty | Notes |
|-------------|--------|------------|-------|
| Various counties | PDF reports | Very Hard | Individual inspection certificates. Would need PDF parsing + OCR. |
| State health depts | Monthly reports | Hard | Aggregate PDF reports, not machine-readable |

---

## Platform Notes

### Socrata
- **Best option** when available
- Clean API, well-documented
- Common endpoint pattern: `data.{city/county}.gov`
- Already integrated: Austin, Montgomery County, NYC

### ArcGIS FeatureServer/MapServer
- **Second best option**
- REST API with JSON output
- Can filter with `where` clauses
- Already integrated: Louisville, Arlington, Jackson County, Webster
- Search pattern: Look for `/FeatureServer/` or `/MapServer/` endpoints on `*.arcgis.com` hubs

### Tyler Technologies / MyHealthDepartment
- **Most common platform** for health departments
- Aggressive bot protection (403 errors)
- **Workaround**: Scrape individual facility pages (see Georgia adapter)
- URL pattern: `healthspace.com` or `*.healthspace.com`

### Custom Government Portals
- **Case-by-case** implementation
- Examples: Maricopa County, LA County
- Requires inspecting network requests, building custom scrapers

---

## Discovery Resources

Tools and sites for finding new sources:

1. **Socrata Discovery API**: `api.us.socrata.com/api/catalog/v1`
   - Search for "pool inspection" across all Socrata portals

2. **ArcGIS Hub Search**: `hub.arcgis.com/search`
   - Search for pool/swimming/aquatic datasets

3. **Open Data Network**: `opendatanetwork.com`
   - Cross-catalog search

4. **Data.gov**: `catalog.data.gov`
   - Federal catalog, includes some local data

5. **Google**: `site:*.gov "pool inspection" data`
   - Find government pages mentioning pool inspection data

---

## Integration Checklist

When adding a new source:

- [ ] Identify data format (API, scraping, PDF)
- [ ] Test endpoint accessibility
- [ ] Document field mappings
- [ ] Create transformer in `src/ingestion/transformers/`
- [ ] Register in `src/ingestion/registry.ts`
- [ ] Add Source record to `prisma/seed.ts`
- [ ] Run backfill: `npm run ingest:backfill -- --source {source-id}`
- [ ] Update this file

---

## Contact / Public Records

For jurisdictions without open APIs, consider:

1. **Email the health department** - Ask about data availability
2. **FOIA/Public Records Request** - Formal request for bulk data
3. **Ask about API access** - Some have internal APIs they may share
4. **Partnership inquiry** - For public interest projects

---

## Change Log

| Date | Change |
|------|--------|
| 2026-01-20 | Initial creation of SOURCES.md |
| 2026-01-20 | Added Louisville, Arlington, Jackson County as active |
| 2026-01-20 | Documented MHD/Tyler blocking and workarounds |
| 2026-01-20 | Added Houston, Florida aggregate as potential sources |
