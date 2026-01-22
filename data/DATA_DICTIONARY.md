# Pool Inspection Index - Data Dictionary

Generated: 2026-01-22

## Summary

| Entity | Total Records |
|--------|--------------|
| Facilities | 22,732 |
| Inspections | 104,898 |
| Violations | 0 |
| Google Enriched | 1,968 (8.7%) |

---

## Facility Fields

### Core Identification

| Field | Description | Coverage | Notes |
|-------|-------------|----------|-------|
| `id` | Unique internal ID (cuid) | 100% | Primary key |
| `slug` | URL-friendly identifier | 100% | e.g., `mesa-golfland-maricopa-county-az` |
| `jurisdictionId` | Link to jurisdiction | 100% | Foreign key |
| `externalIds` | IDs from source systems | 100% | JSON array, e.g., `[{"externalId": "SP-00322"}]` |

### Raw Data (from source)

| Field | Description | Coverage | Notes |
|-------|-------------|----------|-------|
| `rawName` | Original facility name | 100% | As received from source |
| `rawAddress` | Original street address | 100% | As received from source |
| `rawCity` | Original city | 99.95% | 11 missing |
| `rawState` | Original state | 100% | |
| `rawZip` | Original ZIP code | 82.25% | 4,035 missing |

### Display Data (normalized)

| Field | Description | Coverage | Notes |
|-------|-------------|----------|-------|
| `normalizedName` | Uppercase name for matching | 100% | |
| `normalizedAddress` | Uppercase address for matching | 100% | |
| `displayName` | Human-readable name | 100% | Cleaned and formatted |
| `displayAddress` | Full formatted address | 100% | Includes city, state, ZIP |
| `city` | City name | 100% | |
| `state` | State code | 100% | e.g., `AZ`, `TX` |
| `zipCode` | ZIP code | 82.25% | 4,035 missing |

### Location

| Field | Description | Coverage | Notes |
|-------|-------------|----------|-------|
| `latitude` | GPS latitude | 81.15% | WGS84 coordinate |
| `longitude` | GPS longitude | 81.15% | WGS84 coordinate |

### Classification

| Field | Description | Coverage | Notes |
|-------|-------------|----------|-------|
| `facilityType` | Type of facility | 0% | Enum: PUBLIC_POOL, PRIVATE_POOL, SPA, HOT_TUB, SPLASH_PAD, WADING_POOL, WATERPARK, UNKNOWN |
| `status` | Operating status | 100% | Enum: ACTIVE, CLOSED_PERMANENT, CLOSED_TEMPORARY, UNKNOWN |

### Inspection Summary

| Field | Description | Coverage | Notes |
|-------|-------------|----------|-------|
| `lastInspectionDate` | Date of most recent inspection | 99.86% | |
| `lastInspectionResult` | Result of most recent inspection | 65.98% | e.g., `PASS`, `FAIL` |
| `totalInspections` | Count of all inspections | 99.86% | |

### Google Places Data

Enriched from Google Places API for commercial/public facilities.

| Field | Description | Coverage | Notes |
|-------|-------------|----------|-------|
| `googlePlaceId` | Google's unique Place ID | 8.66% | For future API calls |
| `googleMatchDistance` | Distance from our coords to Google's | 8.66% | In meters |
| `googleEnrichedAt` | When enrichment occurred | 8.66% | Timestamp |
| `googleRating` | Average rating | 8.22% | 1.0 - 5.0 scale |
| `googleReviewCount` | Number of reviews | 8.22% | |
| `googleReviews` | Sample reviews | 8.22% | JSON: `[{author, text, rating, date}]` (up to 5) |
| `googlePhone` | Phone number | 8.36% | e.g., `+1 480-834-8319` |
| `googleWebsite` | Website URL | 8.28% | |
| `googleHours` | Operating hours | 4.15% | JSON: `{weekdayText: string[], openNow?: boolean}` |
| `googlePhotos` | Photo references | 8.44% | JSON array with photo IDs, dimensions |
| `googleTypes` | Business categories | 8.66% | Array: e.g., `["water_park", "amusement_park"]` |
| `googleEditorialSummary` | Google's description | 4.79% | Brief summary of the place |

### Google Attributes

| Field | Description | Coverage | Notes |
|-------|-------------|----------|-------|
| `goodForChildren` | Family-friendly | 5.13% | Boolean |
| `goodForGroups` | Group-friendly | 0% | Never populated by Google for pools |
| `wheelchairAccessible` | Accessibility | 8.29% | Boolean |
| `allowsDogs` | Pet policy | 3.41% | Boolean (775 facilities: 382 true, 393 false) |
| `restroom` | Has restrooms | 1.49% | Boolean |

---

## Inspection Event Fields

### Core

| Field | Description | Coverage | Notes |
|-------|-------------|----------|-------|
| `id` | Unique ID | 100% | Primary key |
| `facilityId` | Link to facility | 100% | Foreign key |
| `inspectionDate` | Date of inspection | 100% | |
| `rawRecordId` | Link to raw data | 100% | Foreign key |

### Details

| Field | Description | Coverage | Notes |
|-------|-------------|----------|-------|
| `rawInspectionType` | Original inspection type | 99.95% | e.g., `Compliance Inspection` |
| `rawResult` | Original result string | 92.37% | e.g., `PASS`, `FAIL` |
| `rawScore` | Original score if provided | 17.39% | |
| `inspectionType` | Normalized type | 99.95% | Enum: ROUTINE, FOLLOW_UP, COMPLAINT, OPENING, CLOSING, REINSPECTION, OTHER |
| `result` | Normalized result | 92.37% | Enum: PASS, FAIL, CONDITIONAL_PASS, CLOSED, NOT_INSPECTED, PENDING, OTHER |
| `score` | Numeric score | 0% | Not populated |
| `demerits` | Demerit points | 7.77% | Lower is better |
| `isPassing` | Pass/fail boolean | 90.77% | |
| `isClosure` | Was pool closed | 1.29% | 1,353 closures |
| `inspectorName` | Inspector's name | 0% | Not available from sources |
| `inspectorId` | Inspector ID | 0% | Not available from sources |
| `notes` | Inspection notes | 0% | Not available from sources |
| `followUpRequired` | Needs follow-up | 0% | Not tracked |
| `followUpDate` | Follow-up date | 0% | Not tracked |
| `sourceUrl` | URL to original record | 72.97% | |
| `reportUrl` | URL to PDF report | 54.76% | |

---

## Violation Fields

*Note: Violation parsing not yet implemented - table is empty*

### Core

| Field | Description | Coverage | Notes |
|-------|-------------|----------|-------|
| `id` | Unique ID | - | Primary key |
| `inspectionId` | Link to inspection | - | Foreign key |
| `rawDescription` | Original violation text | - | |
| `description` | Cleaned description | - | |

### Details

| Field | Description | Coverage | Notes |
|-------|-------------|----------|-------|
| `rawCode` | Original violation code | - | |
| `code` | Normalized code | - | |
| `category` | Violation category | - | Enum: WATER_QUALITY, SAFETY_EQUIPMENT, STRUCTURAL, SANITATION, DOCUMENTATION, SIGNAGE, MECHANICAL, OTHER |
| `severity` | Severity level | - | Enum: CRITICAL, MAJOR, MINOR, OBSERVATION |
| `isCritical` | Critical violation flag | - | Boolean |
| `correctedAt` | When corrected | - | |
| `correctionNotes` | Correction details | - | |

---

## Data Quality Notes

1. **GPS Coordinates**: 81% coverage. Missing for facilities where source doesn't provide location data.

2. **Facility Type**: 0% coverage. Schema supports classification but transformers don't extract this yet.

3. **Google Enrichment**: Only 8.7% of facilities enriched. Focused on commercial/public facilities (hotels, water parks, YMCAs, etc.) where Google Places has data.

4. **Violations**: Not yet implemented. Violation data exists in source records but parsers haven't been built.

5. **Inspector Info**: Source APIs don't expose inspector names/IDs.

6. **allowsDogs**: Only populated for hotels/resorts. Public pools typically don't have this in Google.
