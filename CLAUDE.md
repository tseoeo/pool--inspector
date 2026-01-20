# Pool Inspection Index - Project Documentation

> **Note:** Keep this file updated when making significant changes to the project structure, adding new features, or modifying deployment configuration.

> **For collaboration guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md)**
> **For data structure details, see [DATA.md](./DATA.md)**

## Current Status

**Last updated:** 2026-01-15

| Item | Status |
|------|--------|
| Current branch | `main` |
| Main branch | Up to date, deployed |
| Railway | Deployed, production running |
| Database | PostgreSQL on Railway (`postgres-8mb0` service) |
| Live URL | https://poolinspections.us |

**Recent changes:**
- Added coverage page (`/coverage`) with US map showing jurisdiction coverage
- Added `TargetJurisdiction` model for tracking coverage goals (247 targets)
- Downgraded Prisma from 7.x to 6.x (7.x had breaking changes with adapters)
- Recreated Postgres database (old service had networking issues)
- Backfilled data for Austin, Montgomery County

**Active data sources:**
| Source | Type | Status | Notes |
|--------|------|--------|-------|
| Austin, TX | Socrata | ✅ Active | ~950 facilities |
| Montgomery County, MD | Socrata | ✅ Active | ~450 facilities (slow ~10s response) |
| Webster, TX | ArcGIS | ❌ Inactive | Server offline (see investigation below) |

**Webster Investigation (2026-01-15):**
- `www1.cityofwebster.com` (72.20.140.78 on PS Lightwave) is unreachable
- TCP connections timeout - server appears decommissioned
- Main city website migrated to CivicPlus cloud, but ArcGIS stayed on old infrastructure
- No alternative endpoint found on ArcGIS Hub/Online
- Source marked inactive; use `npm run sources:check` to monitor recovery

**Next steps:**
- Contact City of Webster about ArcGIS data availability
- Add more jurisdictions/data sources (check `/coverage` for targets)
- Frontend improvements

---

## Overview

Pool Inspection Index aggregates public pool and spa inspection records from municipal health departments across the United States. Data is sourced from official government APIs (Socrata, ArcGIS) and updated daily.

**Live Site:** Deployed on Railway (auto-deploy not configured - use `railway up` to deploy)

## Tech Stack

- **Framework:** Next.js 16.1.1 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma 6.x (downgraded from 7.x due to breaking changes)
- **Styling:** Tailwind CSS 4 with CSS custom properties
- **Fonts:** Geist Sans & Geist Mono
- **Deployment:** Railway

## Project Structure

```
pool-inspection/
├── prisma/
│   ├── schema.prisma      # Database schema (all models)
│   └── seed.ts            # Database seeding script
├── scripts/
│   ├── backfill.ts        # Historical data import script
│   ├── check-sources.ts   # Source health monitoring
│   └── socrata-discover/  # Socrata dataset discovery tool
│       ├── index.ts       # CLI entry point
│       ├── crawler.ts     # Discovery API client
│       ├── scorer.ts      # Keyword scoring
│       ├── matcher.ts     # Jurisdiction matching
│       ├── importer.ts    # DB import
│       └── types.ts       # Type definitions
├── workers/
│   └── daily-ingestion/
│       └── index.ts       # Daily incremental sync worker
├── src/
│   ├── app/
│   │   ├── layout.tsx     # Root layout with nav header
│   │   ├── page.tsx       # Homepage with stats & recent activity
│   │   ├── globals.css    # Design system (CSS variables)
│   │   ├── (seo)/
│   │   │   ├── closures/page.tsx           # Recent closures list
│   │   │   ├── coverage/page.tsx           # US coverage map
│   │   │   ├── explore/page.tsx            # Data explorer with filters
│   │   │   ├── facilities/[slug]/page.tsx  # Facility detail page
│   │   │   └── jurisdictions/[slug]/page.tsx # Jurisdiction detail
│   │   └── api/
│   │       ├── facilities/route.ts     # Facilities API
│   │       ├── jurisdictions/route.ts  # Jurisdictions API
│   │       ├── health/route.ts         # Health check endpoint
│   │       ├── revalidate/route.ts     # Cache revalidation
│   │       └── export/csv/route.ts     # CSV export endpoint
│   ├── ingestion/
│   │   ├── index.ts           # Main ingestion orchestrator
│   │   ├── registry.ts        # Adapter & transformer registry
│   │   ├── adapters/
│   │   │   ├── base.ts        # Base adapter interface
│   │   │   ├── socrata.ts     # Socrata API adapter
│   │   │   └── arcgis.ts      # ArcGIS REST adapter
│   │   ├── transformers/
│   │   │   ├── austin.ts      # Austin, TX data transformer
│   │   │   └── webster.ts     # Webster, TX data transformer
│   │   ├── normalizers/       # Data normalization utilities
│   │   └── utils/             # Hash, retry, slug utilities
│   ├── lib/
│   │   └── prisma.ts          # Prisma client singleton
│   └── types/
│       └── ingestion.ts       # Ingestion type definitions
└── CLAUDE.md                  # This file
```

## Database Schema

Key models in `prisma/schema.prisma`:

| Model | Purpose |
|-------|---------|
| `Jurisdiction` | Cities/counties/health districts |
| `TargetJurisdiction` | Coverage tracking - 247 US jurisdictions we want to collect |
| `Source` | API endpoints with sync metadata |
| `Facility` | Individual pools/spas with location |
| `InspectionEvent` | Inspection records with results/scores |
| `Violation` | Categorized violations with severity |
| `RawRecord` | Raw JSON payloads (data lake) |
| `SyncLog` | Ingestion tracking and monitoring |

## Key Features

- **Homepage:** Stats overview, jurisdiction list, recent activity
- **Explore Page:** Filter by jurisdiction, date range, result type; paginated table; CSV export
- **Coverage Page:** US map showing data coverage by state with progress percentages
- **Closures Page:** Recent pool closures (last 90 days)
- **Facility Pages:** Inspection history for individual facilities
- **Jurisdiction Pages:** Stats and facilities per jurisdiction
- **CSV Export:** Download filtered inspection data

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build (runs prisma generate first)
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking

# Database
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed initial data
npm run db:studio    # Open Prisma Studio

# Ingestion
npm run ingest:backfill  # Import historical data
npm run ingest:daily     # Run incremental daily sync
npm run sources:check    # Check health of all source endpoints
npm run sources:check -- --fix  # Check and auto-update database status

# Discovery
npm run socrata:discover              # Full run: crawl → filter → import
npm run socrata:discover -- crawl     # Just crawl Socrata API
npm run socrata:discover -- filter    # Score and filter candidates
npm run socrata:discover -- import    # Import to database
npm run socrata:discover -- report    # Show summary report
npm run socrata:discover -- --dry-run # Preview without DB changes
npm run socrata:discover -- --verbose # Verbose output
```

## Deployment (Railway)

The project is deployed on Railway. Auto-deploy from GitHub is **not** configured.

**Project links:**
- Railway Dashboard: https://railway.com/project/dc717d4d-c3d8-4728-838e-a439e6a44f53
- GitHub Repo: https://github.com/tseoeo/pool--inspector

**To deploy:**
```bash
railway up
```

**To check status:**
```bash
railway status
railway logs
```

**Environment variables required on Railway:**
- `DATABASE_URL` - PostgreSQL connection string (Railway provides this)

## Adding New Data Sources

1. **Create transformer** in `src/ingestion/transformers/[jurisdiction].ts`
2. **Register transformer** in `src/ingestion/registry.ts`
3. **Add Source record** to database with:
   - `adapterType`: SOCRATA, ARCGIS, CSV, or MANUAL
   - `endpoint`: API URL
   - `config`: Any adapter-specific configuration
4. **Run backfill** to import historical data

## Design System

Colors and styling use CSS custom properties defined in `globals.css`:
- Light/dark mode support via `prefers-color-scheme`
- Consistent border radius: `--radius` (8px), `--radius-sm` (4px)
- Status colors: success (green), warning (yellow), danger (red)
- Accent color: blue (#2563eb)

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/facilities` | GET | List facilities with filters & pagination |
| `/api/jurisdictions` | GET | List jurisdictions with facility counts |
| `/api/export/csv` | GET | Export filtered inspections as CSV |
| `/api/health` | GET | Database health check |
| `/api/revalidate` | POST | Trigger cache revalidation (requires auth) |
