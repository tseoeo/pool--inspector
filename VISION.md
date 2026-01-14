# Pool Inspection Index - Vision Document

> **Last Updated:** 2025-01-14

---

## Goal

Build a USA-wide public pool + spa inspection index. The end-state is a national system that ingests heterogeneous inspection data from many jurisdictions, normalizes it into a unified structure, and makes it searchable (facility pages, inspection timelines, and aggregate views).

Right now we are taking the first steps in Texas with two "easy" sources (Austin via Socrata, Webster via ArcGIS REST) to:
- prove the unified data structure works,
- prove ingestion patterns (backfill + incremental updates),
- and establish the "source registry + adapters" approach that will scale nationwide.

## Critical Requirement

The system must be SEO-friendly by design: it should create large numbers of indexable, useful pages that match real search intent and compound traffic as coverage expands across the USA.

---

## 1. Ingestion Plan: Austin (Socrata) + Webster (ArcGIS)

### A) What We Cover (Jurisdictions and Scope)

**1. Austin (Socrata)**
- **Jurisdiction:** City of Austin, Texas
- **Coverage:** Pool inspection records published by Austin's open data portal
- **Scope note:** This is not "Travis County" and not "Texas." It is one city's jurisdictional reporting, used as a starter dataset to validate the pipeline.

**2. Webster (ArcGIS REST)**
- **Jurisdiction:** City of Webster, Texas
- **Coverage:** An ArcGIS service named "Swimming_Pool_Inspections," with a layer labeled "Pool Spa Inspections in Last 365 Days"
- **Scope note:** The layer name suggests this may be a rolling 365-day window. Confirm whether older history exists in other layers/endpoints. If not, treat this as "Webster, last 365 days" by design.

### B) Why These Are the Beginning (Bigger National Picture)

The end state is NOT "one dataset." It is:
- a national "source registry" that tracks every jurisdiction/source
- and a set of ingestion adapters that can ingest and map each source type

Austin (Socrata) and Webster (ArcGIS REST) are chosen because they represent two of the most common public-data stacks in US municipal open data:
- **Socrata:** clean JSON rows, stable paging, often multi-year history
- **ArcGIS REST Feature/MapServer:** query endpoints, stable OBJECTID paging, often includes lat/lon and edit timestamps

Once the schema + ingestion loop works for these two, we expand to:
- more Texas jurisdictions (more ArcGIS/Socrata endpoints, plus portal-based systems)
- then to other states using the same pattern: register the source, write an adapter, map into the unified schema

### C) How Much Data to Ingest, How Far Back, and Update Regularity

We use two modes: **INITIAL BACKFILL + INCREMENTAL UPDATES**.

**1. Initial Backfill**
- **Austin:** Ingest as far back as the dataset provides
  - If the dataset is huge, set an initial cap like 5–10 years or "earliest available," whichever is smaller, but default to full history if feasible
  - Rationale: facility history is what makes the product valuable (and indexable)
- **Webster:** Ingest all records exposed by the service
  - If only a 365-day layer exists, ingest the full 365-day window and accept that limitation
  - If older layers exist, backfill as far back as available

**2. Incremental Updates**

Default: run daily. Weekly is possible but creates staleness and misses edits.

Incremental policy by platform:
- **Socrata:**
  - Prefer incremental by `:updated_at` if present
  - Otherwise incremental by newest `inspection_date` and re-pull a rolling 30–60 day window each run to capture corrections
- **ArcGIS REST:**
  - Prefer incremental by `last_edited_date` if present
  - Otherwise incremental by `Inspect_Date` and re-pull a rolling 30 day window

### D) "Success" Criteria for This First Milestone

After Austin + Webster are ingested, we should be able to:
- render a facility page with inspection timeline
- show "recent inspections" feed per jurisdiction
- search by facility name and/or address within ingested jurisdictions
- demonstrate handling of:
  - different field names
  - different scoring systems (score vs demerits vs pass/fail)
  - missing fields (no violations, no scores, no coordinates)

This milestone is about proving the national approach works on two easy sources before we scale to harder portals and more states.

---

## 2. Unified Data Structure (Canonical Model)

### A) Why a Unified Structure Is Required (National Reality)

US pool/spa inspection data is fragmented:
- different jurisdictions publish different fields and scoring systems
- portals vary widely (Socrata, ArcGIS, vendor systems, ASP.NET portals, PDFs)
- many sources are updated irregularly and sometimes corrected retroactively

The unified structure is the translation layer that allows:
- consistent entity pages and search
- reliable provenance
- future expansion nationwide without rewriting everything

**Key rule:**
- store raw values as provided (never lose fidelity)
- normalize only where safe and defensible
- compute derived values separately and label them as derived

### B) Canonical Entities (Must Exist for Any Source, Any State)

#### 1. JURISDICTION

Represents the authority publishing/owning the inspection process.

| Field | Description |
|-------|-------------|
| jurisdiction_id | internal |
| name | e.g., "City of Austin", "City of Webster" |
| state | e.g., TX |
| level | city \| county \| health district \| state agency |
| website_url | |

**Why it matters:**
- prevents false "national coverage" claims when coverage is partial
- enables nationwide growth while preserving provenance

#### 2. SOURCE

Represents a specific ingestible endpoint/portal for a jurisdiction.

| Field | Description |
|-------|-------------|
| source_id | |
| jurisdiction_id | |
| source_type | socrata \| arcgis_rest \| portal_html \| vendor_portal \| pdf |
| base_url | |
| terms_url | if known |
| cursor_type | updated_at \| last_edited_date \| inspection_date \| objectid \| none |
| cursor_value | watermark |
| last_success_at | |

**Why it matters:**
- this is the control plane for national scaling
- new jurisdiction = new SOURCE row + adapter mapping

#### 3. FACILITY (Pool/Spa Entity)

Represents a physical facility that can have many inspections over time.

| Field | Description |
|-------|-------------|
| facility_id | |
| jurisdiction_id | |
| source_facility_id | if provided; nullable |
| name | |
| facility_type_raw | as published |
| facility_type_norm | pool \| spa \| splash_pad \| water_feature \| water_park \| unknown |
| address_raw | |
| address_norm | optional structured components |
| lat, lon | nullable |
| status | active \| inactive \| unknown |
| first_seen_at, last_seen_at | |

**Facility identity / dedupe (within a jurisdiction):**
- internal `facility_key = hash(normalized_name + normalized_address + jurisdiction_id)`
- do not attempt cross-jurisdiction dedupe initially; that's a later problem

#### 4. INSPECTION_EVENT (Time-Series Record)

Represents one inspection occurrence.

| Field | Description |
|-------|-------------|
| inspection_id | |
| facility_id | |
| inspection_date | |
| inspection_type_raw | routine/follow-up/complaint, if available |
| result_raw | Pass/Fail/ReOpened/etc. |
| result_norm | pass \| fail \| closed \| reopened \| unknown |
| score | numeric, nullable |
| demerits | numeric, nullable |
| source_url | details page if exists |
| report_url | PDF/HTML report if exists |
| source_updated_at | nullable |
| created_at, updated_at | system timestamps |

**How Austin and Webster map:**
- **Austin:** each Socrata row becomes an inspection_event with fields mapped to inspection_date/result/score fields as present
- **Webster:** `Inspect_Date` → inspection_date; `Demerits` → demerits; `Hyperlink` → source_url/report_url

#### 5. VIOLATION (Optional Table)

Represents a violation item tied to an inspection event (when available).

| Field | Description |
|-------|-------------|
| violation_id | |
| inspection_id | |
| code_raw | nullable |
| description_raw | |
| severity_raw / is_critical | nullable |
| points_or_demerits | nullable |
| corrected_on_site | nullable |

Many sources won't expose structured violations. That's fine. Don't force it.

#### 6. ATTACHMENT (PDFs, Original Reports)

Represents source artifacts tied to an inspection.

| Field | Description |
|-------|-------------|
| attachment_id | |
| inspection_id | |
| url | |
| type | pdf \| html \| image |
| parsed_json | optional |

### C) Raw-Data Retention (National Scaling Safety Net)

Add **RAW_RECORD** (data lake) for every fetched item.

| Field | Description |
|-------|-------------|
| raw_id | |
| source_id | |
| external_record_id | OBJECTID, Socrata row id, portal key |
| fetched_at | |
| payload_json | or metadata for HTML/PDF |
| payload_hash | |
| source_updated_at | nullable |

**Why it matters nationally:**
- you will encounter schema drift and occasional parser bugs
- raw retention lets you re-parse without re-scraping
- provenance and auditability become essential as you scale

### D) How Ingestion Adapters Fit This Unified Structure (Now and Later)

Each source adapter follows: **Extract → Transform → Load**.

**1. Extract**
- fetch records using the source's native pagination method
- incremental based on cursor_type/cursor_value + rolling window re-pulls

**2. Transform (Two-Stage Mapping)**

*Stage 1: raw field mapping*
- populate canonical fields from source fields without reinterpretation

*Stage 2: safe normalization*
- facility_type_norm from a controlled mapping dictionary
- result_norm from a controlled mapping dictionary
- address_norm optional best-effort, but always keep address_raw

**3. Load**
- upsert facility by facility_key within jurisdiction
- insert inspection_event with dedupe logic (facility_id + date + result/score signature + source)
- insert violations if available
- insert attachments if present
- always store raw_record

### E) How This Unified Structure Will Be Used (Product + SEO)

- **Facility pages:** inspection timeline, last inspection status, links to reports
- **Jurisdiction pages:** recent inspections, distributions of outcomes, trends
- **Search:** name/address across ingested jurisdictions
- **Filters:** facility_type_norm, result_norm, date range, jurisdiction
- **Derived (explicitly labeled):** recency/trend/risk metrics (start within-jurisdiction only)

---

## 3. SEO Plan (How This Compounds Traffic Nationwide)

### A) SEO Principle

We are not targeting "near me" service keywords. We are targeting **"lookup and verification intent"** that Google does not satisfy well with a Local Pack:
- "inspection score"
- "inspection report"
- "health inspection"
- "pool inspection"
- "pool closed"
- "pool violations"
- "pool permit inspection" (where applicable)

This maps naturally to dataset-driven pages.

### B) Page Types to Generate (Indexable at Scale, Non-Doorway)

#### 1. Facility Pages (Primary SEO Unit)

- URL should be stable, human-readable, and canonical
- Content includes:
  - facility name, address, jurisdiction
  - latest inspection summary (date + result)
  - inspection timeline table
  - links to source report(s) / attachments
  - plain-language explanation of common violation categories (tied to this facility/jurisdiction)
- These pages capture:
  - branded + semi-branded queries ("[pool name] inspection")
  - address queries ("[pool address] inspection")
  - long-tail inspection intent

#### 2. Jurisdiction Hub Pages (City/County/Health District)

- recent inspections feed
- filters (pool/spa/splash pad; pass/fail; date range)
- "most common issues" in that jurisdiction based on the data
- These pages capture:
  - "pool inspection [city/county]"
  - "public pool inspection report [city]"
  - "pool violations [city]"

#### 3. "Recent Closures / Failures" Pages (High Intent)

- "Pools closed after inspection in [jurisdiction] (last 30/90 days)"
- Captures queries like:
  - "pool closed health inspection [city]"
  - "pool failed inspection [city]"

#### 4. Topic Explainer Pages (Supporting Internal Linking)

- "How pool inspection scoring works in [jurisdiction]"
- "What demerits mean in [jurisdiction]"
- "Common pool violations and fixes"

### C) Why This Will Catch Lots of Traffic (Compounding Mechanics)

Traffic compounds via:
- multiplying entity pages (each facility becomes an indexable page)
- multiplying jurisdiction pages (each city/county becomes a hub)
- multiplying time-based pages (recent inspections, closures)
- multiplying long-tail coverage (unique facility name + address combinations)

As we expand to more states:
- total facility count rises
- total jurisdiction hub count rises
- total long-tail coverage rises

### D) Required SEO Hygiene (To Avoid Thin/Duplicate Risk)

- Every page must show:
  - unique data (the actual inspection history) and provenance
  - last updated timestamp (based on source_updated_at or ingestion time)
  - clear jurisdiction labeling
- **Canonicals:**
  - one canonical URL per facility (avoid duplicates from name variations)
- **No auto-generated fluff:**
  - only include text that helps interpret THIS dataset/jurisdiction and is reusable without becoming generic spam
- **Index control:**
  - if a facility has too little data, consider noindex until it meets a minimum completeness threshold

### E) The Texas-First SEO Milestone

Once Austin + Webster are live, validate SEO by checking:
- facility pages index and get impressions for facility-name and "inspection" related queries
- jurisdiction pages rank for "pool inspection [city]"
- "recent failures/closures" pages attract long-tail clicks

### F) Scaling SEO Nationwide

- Each new SOURCE adds:
  - new facility pages
  - new jurisdiction hubs
  - new "recent activity" pages
- The unified structure ensures these are consistent and crawlable across the USA
- The source registry becomes the coverage map and a navigation layer for internal linking (state → jurisdiction → facilities)

**The SEO system is not separate. It is an output of the data model: canonical entities + event history + provenance + crawlable hubs.**
