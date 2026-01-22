# Pool Inspection Index - Database Schema Reference

This document describes all database fields and how to use them. Intended for developers building applications on top of this data.

## Quick Start

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get a facility with all data
const facility = await prisma.facility.findUnique({
  where: { slug: 'mesa-golfland-maricopa-county-az' },
  include: {
    jurisdiction: true,
    inspections: { orderBy: { inspectionDate: 'desc' }, take: 10 }
  }
});
```

---

## Facility Model

The main entity representing a pool, spa, or aquatic facility.

### Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique identifier (cuid) |
| `slug` | String | URL-friendly identifier, e.g., `mesa-golfland-maricopa-county-az` |
| `jurisdictionId` | String | Foreign key to Jurisdiction |
| `externalIds` | JSON | Array of IDs from source systems: `[{"externalId": "SP-00322"}]` |

### Location Fields

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | String | Human-readable facility name |
| `displayAddress` | String | Full formatted address with city, state, ZIP |
| `city` | String | City name |
| `state` | String | Two-letter state code (e.g., `TX`, `AZ`) |
| `zipCode` | String? | ZIP code (nullable) |
| `latitude` | Float? | GPS latitude in WGS84 |
| `longitude` | Float? | GPS longitude in WGS84 |

### Raw Data Fields

Original data as received from source systems (useful for debugging/auditing):

| Field | Type | Description |
|-------|------|-------------|
| `rawName` | String | Original facility name |
| `rawAddress` | String | Original street address |
| `rawCity` | String? | Original city |
| `rawState` | String? | Original state |
| `rawZip` | String? | Original ZIP |
| `normalizedName` | String | Uppercase name for deduplication |
| `normalizedAddress` | String | Uppercase address for deduplication |

### Classification Fields

| Field | Type | Values |
|-------|------|--------|
| `facilityType` | Enum? | `PUBLIC_POOL`, `PRIVATE_POOL`, `SPA`, `HOT_TUB`, `SPLASH_PAD`, `WADING_POOL`, `WATERPARK`, `UNKNOWN` |
| `status` | Enum | `ACTIVE`, `CLOSED_PERMANENT`, `CLOSED_TEMPORARY`, `UNKNOWN` |

### Inspection Summary Fields

| Field | Type | Description |
|-------|------|-------------|
| `totalInspections` | Int | Count of all inspection records |
| `lastInspectionDate` | DateTime? | Date of most recent inspection |
| `lastInspectionResult` | String? | Result of most recent inspection (e.g., `PASS`, `FAIL`) |

---

## Google Places Enrichment Fields

Facilities enriched from Google Places API have additional data. Check `googleEnrichedAt` to see if enrichment data is available.

### Basic Google Fields

| Field | Type | Description |
|-------|------|-------------|
| `googlePlaceId` | String? | Google's unique Place ID (use for future API calls) |
| `googleMatchDistance` | Float? | Distance in meters between our coords and Google's |
| `googleEnrichedAt` | DateTime? | When enrichment was performed |

### Business Information

| Field | Type | Description |
|-------|------|-------------|
| `googleRating` | Float? | Average rating (1.0 - 5.0) |
| `googleReviewCount` | Int? | Total number of reviews |
| `googlePhone` | String? | Phone number, e.g., `+1 480-834-8319` |
| `googleWebsite` | String? | Website URL |
| `googleEditorialSummary` | String? | Google's description of the place |
| `googleTypes` | String[] | Business categories, e.g., `["water_park", "amusement_park"]` |

### Operating Hours

| Field | Type | Description |
|-------|------|-------------|
| `googleHours` | JSON? | Operating hours object |

**Structure:**
```typescript
interface GoogleHours {
  weekdayText?: string[];  // ["Monday: 10:00 AM – 10:00 PM", ...]
  openNow?: boolean;       // Current open status (may be stale)
}
```

**Usage:**
```typescript
const hours = facility.googleHours as { weekdayText?: string[] };
hours?.weekdayText?.forEach(day => console.log(day));
```

### Reviews

| Field | Type | Description |
|-------|------|-------------|
| `googleReviews` | JSON? | Array of up to 5 recent reviews |

**Structure:**
```typescript
interface GoogleReview {
  author: string;   // Reviewer name
  text: string;     // Review text
  rating: number;   // 1-5 stars
  date: string;     // Relative date, e.g., "2 months ago"
}
```

**Usage:**
```typescript
const reviews = facility.googleReviews as GoogleReview[];
reviews?.forEach(r => console.log(`${r.author}: ${r.rating}★ - ${r.text}`));
```

### Amenity Attributes

| Field | Type | Description |
|-------|------|-------------|
| `goodForChildren` | Boolean? | Family-friendly venue |
| `goodForGroups` | Boolean? | Suitable for groups (rarely populated) |
| `wheelchairAccessible` | Boolean? | Wheelchair accessibility |
| `allowsDogs` | Boolean? | Pet policy (`true` = dogs allowed, `false` = no dogs) |
| `restroom` | Boolean? | Has restroom facilities |

---

## Photos

### How Photos Are Stored

| Field | Type | Description |
|-------|------|-------------|
| `googlePhotos` | JSON? | Array of photo references |

**Structure:**
```typescript
interface GooglePhoto {
  name: string;    // Photo reference path (NOT a URL)
  width: number;   // Original photo width in pixels
  height: number;  // Original photo height in pixels
}
```

**Example data:**
```json
[
  {
    "name": "places/ChIJpZWRoxOoK4cR6oh5AKdy82M/photos/AcnlKN3roBSY...",
    "width": 4000,
    "height": 3000
  }
]
```

### How to Download/Display Photos

Photos are stored as **references**, not URLs. You must call the Google Places Photo API to get the actual image.

#### Option 1: Direct Google API Call (requires API key)

```typescript
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

function getPhotoUrl(photoName: string, maxWidth = 400, maxHeight = 300): string {
  return `https://places.googleapis.com/v1/${photoName}/media?key=${GOOGLE_API_KEY}&maxWidthPx=${maxWidth}&maxHeightPx=${maxHeight}`;
}

// Usage
const photos = facility.googlePhotos as GooglePhoto[];
const imageUrl = getPhotoUrl(photos[0].name, 800, 600);
// Returns actual image binary when fetched
```

#### Option 2: Server-Side Proxy (recommended for web apps)

To avoid exposing your API key client-side, create a proxy endpoint:

```typescript
// /api/photos/route.ts (Next.js example)
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const photoRef = request.nextUrl.searchParams.get("ref");
  const maxWidth = request.nextUrl.searchParams.get("maxWidth") || "400";
  const maxHeight = request.nextUrl.searchParams.get("maxHeight") || "300";

  if (!photoRef) {
    return NextResponse.json({ error: "Missing ref" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const url = `https://places.googleapis.com/v1/${photoRef}/media?key=${apiKey}&maxWidthPx=${maxWidth}&maxHeightPx=${maxHeight}`;

  const response = await fetch(url);
  const imageBuffer = await response.arrayBuffer();

  return new NextResponse(imageBuffer, {
    headers: {
      "Content-Type": response.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400", // Cache 1 day
    },
  });
}
```

**Client usage:**
```html
<img src="/api/photos?ref=places/ChIJ.../photos/AcnlKN3...&maxWidth=800" alt="Pool photo" />
```

#### Option 3: Pre-download and Store (for offline/static sites)

```typescript
import fs from 'fs';

async function downloadPhotos(facility: Facility, outputDir: string) {
  const photos = facility.googlePhotos as GooglePhoto[];
  if (!photos?.length) return;

  for (let i = 0; i < photos.length; i++) {
    const url = `https://places.googleapis.com/v1/${photos[i].name}/media?key=${API_KEY}&maxWidthPx=1200`;
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    fs.writeFileSync(
      `${outputDir}/${facility.slug}-${i}.jpg`,
      Buffer.from(buffer)
    );
  }
}
```

### Photo API Costs

- Google Places Photo API: ~$7 per 1,000 requests
- Implement caching to minimize costs
- Consider downloading once and storing in your own CDN for production

---

## Inspection Event Model

Individual inspection records linked to facilities.

### Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique identifier |
| `facilityId` | String | Foreign key to Facility |
| `inspectionDate` | DateTime | When inspection occurred |
| `rawRecordId` | String? | Link to raw data record |

### Inspection Details

| Field | Type | Description |
|-------|------|-------------|
| `rawInspectionType` | String? | Original type from source, e.g., `"Compliance Inspection"` |
| `rawResult` | String? | Original result string, e.g., `"PASS"`, `"FAIL"` |
| `rawScore` | String? | Original score if provided |
| `inspectionType` | Enum? | Normalized: `ROUTINE`, `FOLLOW_UP`, `COMPLAINT`, `OPENING`, `CLOSING`, `REINSPECTION`, `OTHER` |
| `result` | Enum? | Normalized: `PASS`, `FAIL`, `CONDITIONAL_PASS`, `CLOSED`, `NOT_INSPECTED`, `PENDING`, `OTHER` |
| `score` | Int? | Numeric score (rarely populated) |
| `demerits` | Int? | Demerit points (lower is better) |
| `isPassing` | Boolean? | Whether inspection passed |
| `isClosure` | Boolean | Whether pool was closed |

### Additional Fields

| Field | Type | Description |
|-------|------|-------------|
| `inspectorName` | String? | Inspector's name (rarely available) |
| `inspectorId` | String? | Inspector ID (rarely available) |
| `notes` | String? | Inspection notes |
| `sourceUrl` | String? | URL to original record |
| `reportUrl` | String? | URL to PDF report |

---

## Jurisdiction Model

Geographic regions (cities, counties, health districts).

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique identifier |
| `slug` | String | URL-friendly identifier, e.g., `austin-tx` |
| `name` | String | Display name, e.g., `"Austin"` |
| `state` | String | State code |
| `type` | Enum | `CITY`, `COUNTY`, `HEALTH_DISTRICT`, `STATE` |
| `timezone` | String | IANA timezone, e.g., `America/Chicago` |
| `website` | String? | Official website |

---

## Example Queries

### Get all dog-friendly pools in a city

```typescript
const dogFriendlyPools = await prisma.facility.findMany({
  where: {
    city: "Austin",
    state: "TX",
    allowsDogs: true,
  },
  select: {
    displayName: true,
    displayAddress: true,
    googleRating: true,
    googlePhone: true,
    googlePhotos: true,
  },
});
```

### Get facilities with recent failed inspections

```typescript
const failedInspections = await prisma.facility.findMany({
  where: {
    lastInspectionResult: "FAIL",
    lastInspectionDate: {
      gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
    },
  },
  include: {
    inspections: {
      where: { result: "FAIL" },
      orderBy: { inspectionDate: "desc" },
      take: 1,
    },
  },
});
```

### Get facilities with photos and good ratings

```typescript
const topRatedWithPhotos = await prisma.facility.findMany({
  where: {
    googleRating: { gte: 4.0 },
    googlePhotos: { not: null },
  },
  orderBy: { googleRating: "desc" },
  take: 20,
});
```

---

## Data Coverage Statistics

As of last update:

| Metric | Value |
|--------|-------|
| Total Facilities | ~22,700 |
| With GPS Coordinates | ~81% |
| Google Enriched | ~8.7% (1,968) |
| With Photos | ~8.4% |
| With allowsDogs data | ~3.4% |
| Total Inspections | ~105,000 |

---

## Environment Variables Required

```env
DATABASE_URL=postgresql://...
GOOGLE_PLACES_API_KEY_1=AIzaSy...  # For photo proxy
```

---

## Related Files

- `/prisma/schema.prisma` - Full Prisma schema
- `/data/field_coverage_report.json` - Detailed coverage stats
- `/data/DATA_DICTIONARY.md` - Field descriptions with coverage percentages
