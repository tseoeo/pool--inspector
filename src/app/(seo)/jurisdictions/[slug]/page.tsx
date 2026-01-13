import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import Link from "next/link";

export const dynamic = 'force-dynamic';
export const revalidate = 21600; // 6 hours

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getJurisdiction(slug: string) {
  return prisma.jurisdiction.findUnique({
    where: { slug },
    include: {
      sources: {
        select: {
          name: true,
          lastSyncAt: true,
          lastSyncStatus: true,
        },
      },
      _count: {
        select: { facilities: true },
      },
    },
  });
}

async function getJurisdictionStats(jurisdictionId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const [recentInspections, closures, topFacilities, recentActivity] = await Promise.all([
    prisma.inspectionEvent.count({
      where: {
        facility: { jurisdictionId },
        inspectionDate: { gte: thirtyDaysAgo },
      },
    }),
    prisma.inspectionEvent.count({
      where: {
        facility: { jurisdictionId },
        isClosure: true,
        inspectionDate: { gte: yearAgo },
      },
    }),
    prisma.facility.findMany({
      where: { jurisdictionId },
      orderBy: { totalInspections: "desc" },
      take: 10,
    }),
    prisma.inspectionEvent.findMany({
      where: {
        facility: { jurisdictionId },
      },
      orderBy: { inspectionDate: "desc" },
      take: 10,
      include: {
        facility: {
          select: {
            displayName: true,
            slug: true,
          },
        },
      },
    }),
  ]);

  return { recentInspections, closures, topFacilities, recentActivity };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const jurisdiction = await getJurisdiction(slug);
  if (!jurisdiction) return {};

  const title = `Pool Inspections in ${jurisdiction.name} | Pool Inspection Index`;
  const description = `View pool and spa inspection records for ${jurisdiction.name}, ${jurisdiction.state}. ${jurisdiction._count.facilities} facilities tracked.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}

export async function generateStaticParams() {
  try {
    const jurisdictions = await prisma.jurisdiction.findMany({
      select: { slug: true },
    });
    return jurisdictions.map((j) => ({ slug: j.slug }));
  } catch {
    return [];
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getSyncStatusBadge(status: string) {
  if (status === "SUCCESS") {
    return { bg: "bg-[var(--success-bg)]", text: "text-[var(--success)]" };
  }
  if (status === "PARTIAL") {
    return { bg: "bg-[var(--warning-bg)]", text: "text-[var(--warning)]" };
  }
  return { bg: "bg-[var(--danger-bg)]", text: "text-[var(--danger)]" };
}

export default async function JurisdictionPage({ params }: PageProps) {
  const { slug } = await params;
  const jurisdiction = await getJurisdiction(slug);

  if (!jurisdiction) {
    notFound();
  }

  const stats = await getJurisdictionStats(jurisdiction.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <nav className="text-sm mb-6 text-[var(--foreground-muted)]">
        <Link href="/" className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors duration-150">Home</Link>
        <span className="mx-2">/</span>
        <span>{jurisdiction.name}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Pool Inspections in {jurisdiction.name}
        </h1>
        <p className="text-[var(--foreground-secondary)]">
          {jurisdiction.state} - {jurisdiction.type.toLowerCase().replace("_", " ")}
        </p>
      </header>

      <section className="border border-[var(--border)] rounded-lg p-6 mb-8">
        <h2 className="text-base font-semibold mb-4">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-[var(--foreground-muted)]">Total Facilities</p>
            <p className="text-xl font-semibold font-mono tabular-nums mt-1">{jurisdiction._count.facilities}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--foreground-muted)]">Inspections (30d)</p>
            <p className="text-xl font-semibold font-mono tabular-nums mt-1">{stats.recentInspections}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--foreground-muted)]">Closures (12mo)</p>
            <p className="text-xl font-semibold font-mono tabular-nums mt-1 text-[var(--danger)]">{stats.closures}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--foreground-muted)]">Data Sources</p>
            <p className="text-xl font-semibold font-mono tabular-nums mt-1">{jurisdiction.sources.length}</p>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          {stats.recentActivity.length === 0 ? (
            <p className="text-[var(--foreground-muted)]">No recent inspections.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {stats.recentActivity.map((inspection) => (
                <li key={inspection.id} className="py-3 first:pt-0">
                  <Link
                    href={`/facilities/${inspection.facility.slug}`}
                    className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium text-[15px] transition-colors duration-150"
                  >
                    {inspection.facility.displayName}
                  </Link>
                  <div className="text-sm text-[var(--foreground-muted)] mt-1">
                    <span className="font-mono tabular-nums text-xs">{formatDate(inspection.inspectionDate)}</span>
                    <span className="mx-1">-</span>
                    <span>{inspection.rawResult || "No result"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Top Facilities</h2>
          {stats.topFacilities.length === 0 ? (
            <p className="text-[var(--foreground-muted)]">No facilities found.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {stats.topFacilities.map((facility) => (
                <li key={facility.id} className="py-3 first:pt-0">
                  <Link
                    href={`/facilities/${facility.slug}`}
                    className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium text-[15px] transition-colors duration-150"
                  >
                    {facility.displayName}
                  </Link>
                  <div className="text-sm text-[var(--foreground-muted)] mt-1">
                    <span className="font-mono tabular-nums">{facility.totalInspections}</span> inspections
                    {facility.lastInspectionDate && (
                      <span className="ml-1">
                        - Last: <span className="font-mono tabular-nums text-xs">{formatDate(facility.lastInspectionDate)}</span>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Data Sources</h2>
        <div className="space-y-2">
          {jurisdiction.sources.map((source) => {
            const badge = source.lastSyncStatus ? getSyncStatusBadge(source.lastSyncStatus) : null;
            return (
              <div key={source.name} className="border border-[var(--border)] rounded-lg p-4">
                <p className="font-medium text-[15px]">{source.name}</p>
                <p className="text-sm text-[var(--foreground-muted)] mt-1">
                  Last sync: <span className="font-mono tabular-nums text-xs">{source.lastSyncAt ? formatDate(source.lastSyncAt) : "Never"}</span>
                  {badge && (
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {source.lastSyncStatus}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {jurisdiction.website && (
        <p className="mt-8 text-sm text-[var(--foreground-muted)]">
          <a
            href={jurisdiction.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors duration-150"
          >
            Visit official website
          </a>
        </p>
      )}
    </div>
  );
}
