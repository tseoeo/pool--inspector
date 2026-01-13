# Pool Inspection Index

A USA-wide public pool and spa inspection aggregation system. Currently supports Austin, TX (Socrata) and Webster, TX (ArcGIS REST).

## Tech Stack

- **Framework**: Next.js 14+ with App Router, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Deployment**: Railway

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

Create a PostgreSQL database (locally or on Railway) and update `.env`:

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL
```

### 3. Run Migrations

```bash
npm run db:push
```

### 4. Seed Jurisdictions & Sources

```bash
npm run db:seed
```

### 5. Run Development Server

```bash
npm run dev
```

## Data Ingestion

### Initial Backfill

Run backfill for each source:

```bash
# Austin (Socrata) - ~3 years of data
npm run ingest:backfill -- --source austin-socrata-source

# Webster (ArcGIS) - ~365 days of data
npm run ingest:backfill -- --source webster-arcgis-source
```

### Daily Incremental Sync

```bash
npm run ingest:daily
```

On Railway, set up a cron service with schedule `0 6 * * *` (6 AM UTC daily).

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed jurisdictions and sources |
| `npm run ingest:backfill` | Run backfill ingestion |
| `npm run ingest:daily` | Run daily incremental sync |
| `npm run typecheck` | Run TypeScript type check |

## Adding New Sources

1. Create a new adapter in `src/ingestion/adapters/` (extend `BaseAdapter`)
2. Create a transformer in `src/ingestion/transformers/`
3. Register the transformer in `src/ingestion/registry.ts`
4. Add the jurisdiction and source to `prisma/seed.ts`
5. Run `npm run db:seed` then `npm run ingest:backfill -- --source <source-id>`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_BASE_URL` | Public URL (for sitemap) |
| `REVALIDATION_SECRET` | Secret for ISR webhook |
| `SOCRATA_APP_TOKEN` | Optional Socrata API token |
