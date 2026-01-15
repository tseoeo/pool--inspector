# Data Structure

> **Note:** Update this file when changing the database schema in `prisma/schema.prisma`

## Overview

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│  Jurisdiction   │────▶│   Source    │────▶│  RawRecord  │
│  (City/County)  │     │  (API URL)  │     │ (Raw JSON)  │
└────────┬────────┘     └──────┬──────┘     └──────┬──────┘
         │                     │                   │
         │                     │                   │ processed into
         │                     ▼                   ▼
         │              ┌─────────────┐     ┌─────────────────┐
         └─────────────▶│  Facility   │◀────│ InspectionEvent │
                        │ (Pool/Spa)  │     │   (Visit)       │
                        └─────────────┘     └────────┬────────┘
                                                     │
                                          ┌──────────┴──────────┐
                                          ▼                     ▼
                                   ┌─────────────┐       ┌─────────────┐
                                   │  Violation  │       │ Attachment  │
                                   └─────────────┘       └─────────────┘
```

## Data Flow

1. **Source** defines where to fetch data (API endpoint)
2. **RawRecord** stores the original JSON from the API
3. **Transformer** converts raw data into normalized **InspectionEvent**
4. **Facility** is created/matched based on name + address
5. **Violations** and **Attachments** are linked to inspections

---

## Models

### Jurisdiction

A city, county, or health district that publishes inspection data.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID |
| slug | string | URL-friendly name (e.g., "austin-tx") |
| name | string | Display name (e.g., "Austin") |
| state | string | State code (e.g., "TX") |
| type | enum | CITY, COUNTY, HEALTH_DISTRICT, STATE |
| timezone | string | Timezone (default: "America/Chicago") |
| website | string? | Official website URL |

**Relationships:**
- Has many **Sources**
- Has many **Facilities**
- Has one **TargetJurisdiction** (optional, for coverage tracking)

---

### TargetJurisdiction

Tracks jurisdictions we want to collect data from (coverage goals). Used by the `/coverage` page to show progress.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID |
| state | string | State code (e.g., "TX") |
| name | string | Jurisdiction name (e.g., "Houston") |
| type | enum | CITY, COUNTY, HEALTH_DISTRICT, STATE |
| dataPortal | string? | Known data portal URL if found |
| apiType | string? | "socrata", "arcgis", "none", "unknown" |
| notes | string? | Research notes |
| jurisdictionId | string? | Link to actual Jurisdiction if integrated |
| status | enum | NOT_RESEARCHED, NO_PUBLIC_DATA, DATA_FOUND, INTEGRATED |
| priority | int | Higher = more important (default: 0) |

**Target Statuses:**
- NOT_RESEARCHED - Haven't looked for data yet
- NO_PUBLIC_DATA - Researched but no public API available
- DATA_FOUND - Found data source, not yet integrated
- INTEGRATED - Fully integrated (has linked Jurisdiction)

**Relationships:**
- Belongs to **Jurisdiction** (optional)

**Uniqueness:** `state + name`

**Seeded Data:** 247 target jurisdictions based on US population (top cities/counties per state)

---

### Source

An API endpoint that provides inspection data.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID |
| jurisdictionId | string | Parent jurisdiction |
| name | string | Descriptive name |
| adapterType | enum | SOCRATA, ARCGIS, CSV, MANUAL |
| endpoint | string | API URL |
| isActive | boolean | Whether to sync this source |
| config | json | Adapter-specific settings |
| cursor | json? | Pagination state for incremental sync |
| lastSyncAt | datetime? | Last successful sync time |
| lastSyncStatus | enum? | SUCCESS, PARTIAL, FAILED |
| lastSyncError | string? | Error message if failed |
| lastRecordCount | int? | Records from last sync |
| requestsPerMinute | int | Rate limit (default: 60) |

**Relationships:**
- Belongs to **Jurisdiction**
- Has many **RawRecords**
- Has many **SyncLogs**

---

### Facility

A pool, spa, or water feature location.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID |
| jurisdictionId | string | Parent jurisdiction |
| externalIds | json | Array of IDs from source systems |
| rawName | string | Original name from source |
| rawAddress | string | Original address from source |
| rawCity | string? | Original city |
| rawState | string? | Original state |
| rawZip | string? | Original ZIP |
| normalizedName | string | Cleaned name for matching |
| normalizedAddress | string | Cleaned address for matching |
| displayName | string | Name shown to users |
| displayAddress | string | Address shown to users |
| city | string | City |
| state | string | State code |
| zipCode | string? | ZIP code |
| latitude | float? | GPS latitude |
| longitude | float? | GPS longitude |
| facilityType | enum? | Type of facility (see below) |
| status | enum | ACTIVE, CLOSED_PERMANENT, CLOSED_TEMPORARY, UNKNOWN |
| slug | string | URL-friendly identifier |
| lastInspectionDate | datetime? | Most recent inspection |
| lastInspectionResult | string? | Result of last inspection |
| totalInspections | int | Count of all inspections |

**Facility Types:**
- PUBLIC_POOL
- PRIVATE_POOL
- SPA
- HOT_TUB
- SPLASH_PAD
- WADING_POOL
- WATERPARK
- UNKNOWN

**Relationships:**
- Belongs to **Jurisdiction**
- Has many **InspectionEvents**

**Uniqueness:** A facility is unique by `jurisdictionId + normalizedName + normalizedAddress`

---

### InspectionEvent

A single inspection visit to a facility.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID |
| facilityId | string | Parent facility |
| rawRecordId | string? | Link to original raw data |
| inspectionDate | datetime | When inspection occurred |
| rawInspectionType | string? | Original type from source |
| rawResult | string? | Original result from source |
| rawScore | string? | Original score from source |
| inspectionType | enum? | Normalized type (see below) |
| result | enum? | Normalized result (see below) |
| score | int? | Numeric score (if applicable) |
| demerits | int? | Demerit points (if applicable) |
| isPassing | boolean? | Did it pass? |
| isClosure | boolean | Was facility closed? |
| inspectorName | string? | Inspector's name |
| inspectorId | string? | Inspector's ID |
| notes | string? | Additional notes |
| followUpRequired | boolean | Is follow-up needed? |
| followUpDate | datetime? | When follow-up is due |
| sourceUrl | string? | Link to source data |
| reportUrl | string? | Link to full report |

**Inspection Types:**
- ROUTINE - Regular scheduled inspection
- FOLLOW_UP - Follow-up to previous issues
- COMPLAINT - Response to a complaint
- OPENING - Pre-opening inspection
- CLOSING - Seasonal closing inspection
- REINSPECTION - Re-check after violations
- OTHER

**Inspection Results:**
- PASS - Met all requirements
- FAIL - Did not meet requirements
- CONDITIONAL_PASS - Passed with conditions
- CLOSED - Facility was closed
- NOT_INSPECTED - Could not complete inspection
- PENDING - Awaiting final determination
- OTHER

**Relationships:**
- Belongs to **Facility**
- Belongs to **RawRecord** (optional)
- Has many **Violations**
- Has many **Attachments**

---

### Violation

A specific issue found during inspection.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID |
| inspectionId | string | Parent inspection |
| rawCode | string? | Original violation code |
| rawDescription | string | Original description |
| code | string? | Normalized code |
| category | enum? | Category (see below) |
| description | string | Cleaned description |
| severity | enum? | CRITICAL, MAJOR, MINOR, OBSERVATION |
| isCritical | boolean | Is this critical? |
| correctedAt | datetime? | When fixed |
| correctionNotes | string? | How it was fixed |

**Violation Categories:**
- WATER_QUALITY - pH, chlorine, clarity issues
- SAFETY_EQUIPMENT - Missing/broken safety gear
- STRUCTURAL - Physical damage, cracks
- SANITATION - Cleanliness issues
- DOCUMENTATION - Missing records/permits
- SIGNAGE - Missing/incorrect signs
- MECHANICAL - Pump, filter, equipment issues
- OTHER

**Relationships:**
- Belongs to **InspectionEvent**

---

### Attachment

A file attached to an inspection (report, photo, etc.).

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID |
| inspectionId | string | Parent inspection |
| type | enum | INSPECTION_REPORT, PHOTO, CERTIFICATE, PERMIT, OTHER |
| filename | string | Original filename |
| mimeType | string | File type (e.g., "application/pdf") |
| sizeBytes | int | File size |
| url | string | URL to download file |
| extractedText | string? | Text extracted from document |

**Relationships:**
- Belongs to **InspectionEvent**

---

### RawRecord

Original data from source API (data lake).

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID |
| sourceId | string | Which source this came from |
| externalId | string | ID from the source system |
| payload | json | Complete original data |
| payloadHash | string | SHA256 hash for change detection |
| processedAt | datetime? | When converted to InspectionEvent |
| processingError | string? | Error if processing failed |
| schemaVersion | int | For future schema migrations |
| fetchedAt | datetime | When data was fetched |

**Relationships:**
- Belongs to **Source**
- Has one **InspectionEvent** (optional)

**Uniqueness:** `sourceId + externalId` (prevents duplicate imports)

---

### SyncLog

Record of each data sync attempt.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID |
| sourceId | string | Which source was synced |
| syncType | enum | BACKFILL, INCREMENTAL, MANUAL |
| status | enum | SUCCESS, PARTIAL, FAILED |
| startedAt | datetime | When sync started |
| completedAt | datetime? | When sync finished |
| recordsFetched | int | Total records from API |
| recordsCreated | int | New records created |
| recordsUpdated | int | Existing records updated |
| recordsSkipped | int | Unchanged records skipped |
| recordsFailed | int | Records that failed processing |
| cursorBefore | json? | Pagination state before sync |
| cursorAfter | json? | Pagination state after sync |
| errorMessage | string? | Error message if failed |
| errorStack | string? | Full error stack trace |

**Relationships:**
- Belongs to **Source**

---

## Adding a New Data Source

1. **Create Jurisdiction** (if new city/county):
   ```sql
   INSERT INTO Jurisdiction (id, slug, name, state, type)
   VALUES (cuid(), 'houston-tx', 'Houston', 'TX', 'CITY');
   ```

2. **Create Source**:
   ```sql
   INSERT INTO Source (id, jurisdictionId, name, adapterType, endpoint)
   VALUES (cuid(), '<jurisdiction-id>', 'Houston Pool Inspections', 'SOCRATA', 'https://...');
   ```

3. **Create Transformer** in `src/ingestion/transformers/houston.ts`

4. **Register Transformer** in `src/ingestion/registry.ts`:
   ```typescript
   const transformerMap = {
     "houston-tx": transformHouston,
   };
   ```

5. **Run Backfill**:
   ```bash
   npm run ingest:backfill
   ```
