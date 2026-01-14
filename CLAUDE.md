# Pool Inspection Index - Project Documentation

> **Note:** Keep this file updated when making significant changes to the project structure, adding new features, or modifying deployment configuration.

> **For collaboration guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md)**
> **For data structure details, see [DATA.md](./DATA.md)**

## Current Status

**Last updated:** 2025-01-14

| Item | Status |
|------|--------|
| Current branch | `ivan` (data/backend work) |
| Main branch | Up to date, deployed |
| Railway | Deployed, production running |
| Database | PostgreSQL on Railway |

**Recent changes:**
- Added data explorer page (`/explore`) with filters and CSV export
- Added project documentation (`CLAUDE.md`, `CONTRIBUTING.md`, `DATA.md`)
- Set up branch workflow for parallel development

**Active data sources:**
- Austin, TX (Socrata) - transformer ready
- Webster, TX (ArcGIS) - transformer ready

**Next steps:**
- Run initial data ingestion (`npm run ingest:backfill`)
- Add more jurisdictions/data sources
- Frontend improvements (colleague's work)

---

## Overview

Pool Inspection Index aggregates public pool and spa inspection records from municipal health departments across the United States. Data is sourced from official government APIs (Socrata, ArcGIS) and updated daily.

**Live Site:** Deployed on Railway (auto-deploy not configured - use `railway up` to deploy)

## Tech Stack

- **Framework:** Next.js 16.1.1 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma 7.2
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
│   └── backfill.ts        # Historical data import script
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
| `Source` | API endpoints with sync metadata |
| `Facility` | Individual pools/spas with location |
| `InspectionEvent` | Inspection records with results/scores |
| `Violation` | Categorized violations with severity |
| `RawRecord` | Raw JSON payloads (data lake) |
| `SyncLog` | Ingestion tracking and monitoring |

## Key Features

- **Homepage:** Stats overview, jurisdiction list, recent activity
- **Explore Page:** Filter by jurisdiction, date range, result type; paginated table; CSV export
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
