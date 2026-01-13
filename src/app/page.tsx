import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pool Inspection Index | Public Pool & Spa Inspection Records',
  description: 'Search and view public pool and spa inspection records from cities across the USA.',
};

async function getStats() {
  const [jurisdictionCount, facilityCount, inspectionCount, recentClosures] = await Promise.all([
    prisma.jurisdiction.count(),
    prisma.facility.count(),
    prisma.inspectionEvent.count(),
    prisma.inspectionEvent.count({
      where: {
        isClosure: true,
        inspectionDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  return { jurisdictionCount, facilityCount, inspectionCount, recentClosures };
}

async function getJurisdictions() {
  return prisma.jurisdiction.findMany({
    include: { _count: { select: { facilities: true } } },
    orderBy: { name: 'asc' },
  });
}

async function getRecentActivity() {
  return prisma.inspectionEvent.findMany({
    orderBy: { inspectionDate: 'desc' },
    take: 10,
    include: {
      facility: {
        select: {
          displayName: true,
          slug: true,
          jurisdiction: { select: { name: true } },
        },
      },
    },
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

export default async function HomePage() {
  const [stats, jurisdictions, recentActivity] = await Promise.all([
    getStats(),
    getJurisdictions(),
    getRecentActivity(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <header className="text-center mb-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-3">Public Pool & Spa Inspections</h1>
        <p className="text-[var(--foreground-secondary)] max-w-xl mx-auto">
          Search inspection records from health departments across the United States.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="border border-[var(--border)] rounded-lg p-4">
          <p className="text-2xl font-semibold font-mono tabular-nums">{stats.jurisdictionCount}</p>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">Jurisdictions</p>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-4">
          <p className="text-2xl font-semibold font-mono tabular-nums">{stats.facilityCount.toLocaleString()}</p>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">Facilities</p>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-4">
          <p className="text-2xl font-semibold font-mono tabular-nums">{stats.inspectionCount.toLocaleString()}</p>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">Inspections</p>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-4">
          <p className="text-2xl font-semibold font-mono tabular-nums text-[var(--danger)]">{stats.recentClosures}</p>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">Closures (30d)</p>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Covered Jurisdictions</h2>
          {jurisdictions.length === 0 ? (
            <p className="text-[var(--foreground-muted)]">No jurisdictions yet. Run the ingestion to populate data.</p>
          ) : (
            <ul className="space-y-2">
              {jurisdictions.map((j) => (
                <li key={j.id}>
                  <Link
                    href={"/jurisdictions/" + j.slug}
                    className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg hover:border-[var(--foreground-faint)] transition-colors duration-150"
                  >
                    <div>
                      <p className="font-medium text-[15px]">{j.name}</p>
                      <p className="text-sm text-[var(--foreground-muted)]">{j.state}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono tabular-nums font-medium">{j._count.facilities}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">facilities</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <Link
              href="/closures"
              className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors duration-150"
            >
              View closures
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-[var(--foreground-muted)]">No inspection records yet. Run the ingestion to populate data.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {recentActivity.map((i) => (
                <li key={i.id} className="py-3 first:pt-0">
                  <Link
                    href={"/facilities/" + i.facility.slug}
                    className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium text-[15px] transition-colors duration-150"
                  >
                    {i.facility.displayName}
                  </Link>
                  <div className="flex justify-between text-sm text-[var(--foreground-muted)] mt-1">
                    <span>{i.facility.jurisdiction.name}</span>
                    <span className="font-mono tabular-nums text-xs">{formatDate(i.inspectionDate)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10 border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-base font-semibold mb-3">About</h2>
        <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
          Pool Inspection Index aggregates public pool and spa inspection records from municipal health departments across the United States. Data is sourced directly from official government APIs and updated daily.
        </p>
      </section>
    </div>
  );
}
