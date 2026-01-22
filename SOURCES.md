# Pool Inspection Data Sources

> **Last Updated:** 2026-01-21
> **Total Target Jurisdictions:** 247
> **Currently Integrated:** 19

## Quick Summary

| Status | Count |
|--------|-------|
| **Integrated** | 19 targets (16 jurisdictions) |
| **Researched (no public data)** | 15+ |
| **Not researched** | 200+ |

### Active Sources by Type

| Type | Count | Examples |
|------|-------|----------|
| Socrata API | 3 | Austin, NYC, Montgomery MD |
| ArcGIS | 4 | Louisville, Arlington, Jackson County, Webster |
| Tyler/MHD Scraper | 2 | Georgia statewide, Houston |
| Playwright Scraper | 4 | Maricopa, LA County, Tarrant, San Diego |
| eBridge Scraper | 2 | Hillsborough FL, Pinellas FL |
| NC CDP Portal | 1 | Mecklenburg NC |

---

## Coverage by State

### Arizona (AZ) - 6 targets
| Jurisdiction | Status | Source Type | Records | Notes |
|--------------|--------|-------------|---------|-------|
| Maricopa County | ✅ | API Scraper | 57,124 | Largest dataset |
| Mesa | ✅ | - | - | Covered by Maricopa |
| Phoenix | ✅ | - | - | Covered by Maricopa |
| Pima County | ⬜ | | | |
| Scottsdale | ✅ | - | - | Covered by Maricopa |
| Tucson | ⬜ | | | |

### California (CA) - 10 targets
| Jurisdiction | Status | Source Type | Records | Notes |
|--------------|--------|-------------|---------|-------|
| Los Angeles County | ✅ | Playwright | 1,173 | Backfill running |
| San Diego County | ✅ | Accela Scraper | 90 | Permit data |
| Alameda County | ⬜ | | | |
| Fresno County | ⬜ | | | |
| Orange County | ⬜ | | | |
| Riverside County | ⬜ | | | |
| Sacramento County | ⬜ | | | |
| San Bernardino County | ⬜ | | | |
| San Francisco | ⬜ | | | |
| Santa Clara County | ⬜ | | | |

### Colorado (CO) - 6 targets
| Jurisdiction | Status | Source Type | Notes |
|--------------|--------|-------------|-------|
| Arapahoe County | 🔍 | MyHealthDepartment | Proprietary SaaS |
| Aurora | ⬜ | | |
| Colorado Springs | ⬜ | | |
| Denver | 🔍 | MyHealthDepartment | Proprietary SaaS |
| El Paso County | ⬜ | | |
| Jefferson County | ⬜ | | |

### Florida (FL) - 8 targets
| Jurisdiction | Status | Source Type | Records | Notes |
|--------------|--------|-------------|---------|-------|
| Hillsborough County | ✅ | eBridge | 93 | Document system |
| Pinellas County | ✅ | eBridge | 98 | Backfill running |
| Broward County | 🔍 | None | | No public portal |
| Duval County | 🔍 | None | | No public portal |
| Lee County | 🔍 | None | | No public portal |
| Miami-Dade County | 🔍 | None | | Email-based only |
| Orange County | 🔍 | None | | No public portal |
| Palm Beach County | 🔍 | None | | No public portal |

### Georgia (GA) - 6 targets
| Jurisdiction | Status | Source Type | Records | Notes |
|--------------|--------|-------------|---------|-------|
| State of Georgia | ✅ | Tyler Scraper | 7,594 | Covers all GA targets |
| Atlanta | ✅ | - | - | Covered by state |
| Cobb County | ✅ | - | - | Covered by state |
| DeKalb County | ✅ | - | - | Covered by state |
| Fulton County | ✅ | - | - | Covered by state |
| Gwinnett County | ✅ | - | - | Covered by state |
| Savannah | ✅ | - | - | Covered by state |

### Illinois (IL) - 6 targets
| Jurisdiction | Status | Source Type | Notes |
|--------------|--------|-------------|-------|
| Chicago | 🔍 | None | data.cityofchicago.org has no pool data |
| Cook County | 🔍 | None | CCDPH - no public portal |
| DuPage County | ⬜ | | |
| Kane County | ⬜ | | |
| Lake County | ⬜ | | |
| Will County | ⬜ | | |

### Kentucky (KY) - 4 targets
| Jurisdiction | Status | Source Type | Records | Notes |
|--------------|--------|-------------|---------|-------|
| Louisville | ✅ | ArcGIS | 3,889 | |
| Fayette County | ⬜ | | | |
| Jefferson County | ⬜ | | | |
| Lexington | ⬜ | | | |

### Maryland (MD) - 6 targets
| Jurisdiction | Status | Source Type | Records | Notes |
|--------------|--------|-------------|---------|-------|
| Montgomery County | ✅ | Socrata | 10,865 | |
| Anne Arundel County | ⬜ | | | |
| Baltimore | ⬜ | | | |
| Baltimore County | ⬜ | | | |
| Howard County | ⬜ | | | |
| Prince George's County | ⬜ | | | |

### Nevada (NV) - 5 targets
| Jurisdiction | Status | Source Type | Notes |
|--------------|--------|-------------|-------|
| Clark County | 🔍 | Records request | SNHD - no public portal |
| Henderson | 🔍 | See Clark | Covered by SNHD |
| Las Vegas | 🔍 | See Clark | Covered by SNHD |
| Reno | ⬜ | | |
| Washoe County | ⬜ | | |

### New York (NY) - 7 targets
| Jurisdiction | Status | Source Type | Records | Notes |
|--------------|--------|-------------|---------|-------|
| New York City | ✅ | Socrata | 5,747 | |
| Buffalo | ⬜ | | | |
| Erie County | ⬜ | | | |
| Nassau County | ⬜ | | | |
| Rochester | ⬜ | | | |
| Suffolk County | ⬜ | | | |
| Westchester County | ⬜ | | | |

### North Carolina (NC) - 6 targets
| Jurisdiction | Status | Source Type | Records | Notes |
|--------------|--------|-------------|---------|-------|
| Mecklenburg County | ✅ | NC CDP Portal | 28 fac | Includes Charlotte |
| Charlotte | ✅ | - | - | Covered by Mecklenburg |
| Greensboro | ⬜ | | | |
| Guilford County | ⬜ | | | |
| Raleigh | ⬜ | | | |
| Wake County | ⬜ | | | |

### Oregon (OR) - 5 targets
| Jurisdiction | Status | Source Type | Records | Notes |
|--------------|--------|-------------|---------|-------|
| Jackson County | ✅ | ArcGIS | 207 | Not in target list but integrated |
| Eugene | ⬜ | | | |
| Multnomah County | ⬜ | | | |
| Portland | ⬜ | | | |
| Salem | ⬜ | | | |
| Washington County | ⬜ | | | |

### Pennsylvania (PA) - 6 targets
| Jurisdiction | Status | Source Type | Notes |
|--------------|--------|-------------|-------|
| Philadelphia | 🔍 | None | OpenDataPhilly has no pool data |
| Allegheny County | ⬜ | | |
| Bucks County | ⬜ | | |
| Delaware County | ⬜ | | |
| Montgomery County | ⬜ | | |
| Pittsburgh | ⬜ | | |

### Texas (TX) - 11 targets
| Jurisdiction | Status | Source Type | Records | Notes |
|--------------|--------|-------------|---------|-------|
| Austin | ✅ | Socrata | 5,972 | |
| Houston | ✅ | Tyler Scraper | 3,357 | Backfill running |
| Tarrant County | ✅ | Playwright | 291 | Covers DFW cities |
| Arlington | ✅ | ArcGIS | 1,693 | Not in target list |
| Webster | ✅ | ArcGIS | 24 | Server intermittent |
| Bexar County | 🔍 | None | San Antonio - no portal |
| Dallas | 🔍 | None | dallasopendata.com - nothing |
| Dallas County | 🔍 | None | |
| El Paso | ⬜ | | |
| Fort Worth | 🔍 | MyHealthDepartment | Proprietary SaaS |
| Harris County | 🔍 | Inspect2GO | Proprietary system |
| San Antonio | 🔍 | None | No public portal |

### Washington (WA) - 6 targets
| Jurisdiction | Status | Source Type | Notes |
|--------------|--------|-------------|-------|
| King County | 🔍 | None | Requires phone request |
| Seattle | 🔍 | See King | Covered by King County |
| Pierce County | ⬜ | | |
| Snohomish County | ⬜ | | |
| Spokane | ⬜ | | |
| Tacoma | ⬜ | | |

---

## Other States (Not Detailed)

States with targets but no integrated sources yet:

| State | Targets | Notes |
|-------|---------|-------|
| Alabama | 5 | Not researched |
| Alaska | 3 | Not researched |
| Arkansas | 4 | Not researched |
| Connecticut | 5 | Not researched |
| Delaware | 3 | Not researched |
| Hawaii | 3 | Not researched |
| Idaho | 4 | Not researched |
| Indiana | 5 | Not researched |
| Iowa | 4 | Not researched |
| Kansas | 5 | Not researched |
| Louisiana | 5 | Not researched |
| Maine | 3 | Not researched |
| Massachusetts | 5 | Not researched |
| Michigan | 6 | Not researched |
| Minnesota | 5 | Not researched |
| Mississippi | 4 | Not researched |
| Missouri | 5 | Not researched |
| Montana | 4 | Not researched |
| Nebraska | 4 | Not researched |
| New Hampshire | 3 | Not researched |
| New Jersey | 7 | Not researched |
| New Mexico | 4 | Not researched |
| North Dakota | 3 | Not researched |
| Ohio | 6 | Not researched |
| Oklahoma | 4 | Not researched |
| Rhode Island | 3 | Not researched |
| South Carolina | 5 | Not researched |
| South Dakota | 3 | Not researched |
| Tennessee | 6 | Not researched |
| Utah | 4 | Not researched |
| Vermont | 2 | Not researched |
| Virginia | 6 | Not researched |
| West Virginia | 3 | Not researched |
| Wisconsin | 5 | Not researched |
| Wyoming | 3 | Not researched |

---

## Blocked / No Public Data

Jurisdictions researched but cannot access:

| Jurisdiction | Reason |
|--------------|--------|
| Chicago, IL | No pool data on data.cityofchicago.org |
| Philadelphia, PA | No pool data on OpenDataPhilly |
| Dallas, TX | No pool data on dallasopendata.com |
| Las Vegas / Clark County, NV | SNHD requires phone records request |
| King County, WA | Requires phone request |
| Miami-Dade, FL | Email-based applications only |
| Fort Worth, TX | MyHealthDepartment (proprietary SaaS) |
| Denver, CO | MyHealthDepartment (proprietary SaaS) |
| Harris County, TX | Inspect2GO (proprietary) |

---

## Platform Reference

### Easy to Integrate
| Platform | Difficulty | Examples |
|----------|------------|----------|
| **Socrata** | Easy | Austin, NYC, Montgomery MD |
| **ArcGIS FeatureServer** | Easy-Medium | Louisville, Arlington |

### Requires Scraping
| Platform | Difficulty | Examples |
|----------|------------|----------|
| **Tyler/MHD** | Medium | Georgia, Houston |
| **eBridge** | Medium | Hillsborough, Pinellas (FL) |
| **Accela Citizen Access** | Medium | San Diego |
| **Custom portals** | Medium-Hard | Maricopa, LA County |

### Proprietary (Difficult)
| Platform | Issue |
|----------|-------|
| **MyHealthDepartment.com** | SaaS, no public API |
| **Inspect2GO** | Proprietary, no public access |

---

## Discovery Resources

1. **Socrata Discovery**: `api.us.socrata.com/api/catalog/v1`
2. **ArcGIS Hub**: `hub.arcgis.com/search`
3. **Google**: `site:*.gov "pool inspection" data`

---

## Integration Checklist

When adding a new source:

- [ ] Research portal structure
- [ ] Create adapter in `src/ingestion/adapters/`
- [ ] Create transformer in `src/ingestion/transformers/`
- [ ] Register in `src/ingestion/registry.ts`
- [ ] Add setup script in `scripts/add-{jurisdiction}.ts`
- [ ] Run backfill: `npm run ingest:backfill -- --source {source-id}`
- [ ] Update this file
