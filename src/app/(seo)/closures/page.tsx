import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import Link from "next/link";

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1 hour

export const metadata: Metadata = {
  title: "Recent Pool Closures | Pool Inspection Index",
  description:
    "View pools and spas that have been closed or failed inspection in the last 90 days.",
};

async function getRecentClosures() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  return prisma.inspectionEvent.findMany({
    where: {
      isClosure: true,
      inspectionDate: { gte: ninetyDaysAgo },
    },
    orderBy: { inspectionDate: "desc" },
    take: 100,
    include: {
      facility: {
        include: {
          jurisdiction: true,
        },
      },
    },
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default async function ClosuresPage() {
  const closures = await getRecentClosures();

  // Group by jurisdiction
  const byJurisdiction = closures.reduce(
    (acc, closure) => {
      const key = closure.facility.jurisdiction.slug;
      if (!acc[key]) {
        acc[key] = {
          jurisdiction: closure.facility.jurisdiction,
          closures: [],
        };
      }
      acc[key].closures.push(closure);
      return acc;
    },
    {} as Record<
      string,
      {
        jurisdiction: (typeof closures)[0]["facility"]["jurisdiction"];
        closures: typeof closures;
      }
    >
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <nav className="text-sm mb-6 text-[var(--foreground-muted)]">
        <Link href="/" className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors duration-150">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span>Recent Closures</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Recent Pool Closures</h1>
        <p className="text-[var(--foreground-secondary)]">
          Pools and spas closed or failed inspection in the last 90 days.
        </p>
      </header>

      {closures.length === 0 ? (
        <div className="border border-[var(--border)] rounded-lg p-6 text-center bg-[var(--success-bg)]">
          <p className="text-[var(--success)] font-medium">
            No closures reported in the last 90 days.
          </p>
        </div>
      ) : (
        <>
          <div className="border border-[var(--border)] rounded-lg p-4 mb-8 bg-[var(--danger-bg)]">
            <p className="text-[var(--danger)]">
              <span className="font-mono tabular-nums font-semibold">{closures.length}</span> closures across{" "}
              <span className="font-mono tabular-nums font-semibold">{Object.keys(byJurisdiction).length}</span> jurisdictions
              in the last 90 days.
            </p>
          </div>

          {Object.values(byJurisdiction).map(({ jurisdiction, closures }) => (
            <section key={jurisdiction.slug} className="mb-8">
              <h2 className="text-lg font-semibold mb-3 flex items-baseline gap-2">
                <Link
                  href={`/jurisdictions/${jurisdiction.slug}`}
                  className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors duration-150"
                >
                  {jurisdiction.name}
                </Link>
                <span className="text-sm text-[var(--foreground-muted)] font-normal">
                  {closures.length} closures
                </span>
              </h2>

              <div className="space-y-2">
                {closures.map((closure) => (
                  <div
                    key={closure.id}
                    className="border border-[var(--border)] rounded-lg p-4 hover:border-[var(--foreground-faint)] transition-colors duration-150"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/facilities/${closure.facility.slug}`}
                          className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium text-[15px] transition-colors duration-150"
                        >
                          {closure.facility.displayName}
                        </Link>
                        <p className="text-sm text-[var(--foreground-muted)] mt-1 truncate">
                          {closure.facility.displayAddress}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono tabular-nums text-[var(--foreground-secondary)]">
                          {formatDate(closure.inspectionDate)}
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-[var(--danger-bg)] text-[var(--danger)] rounded text-xs font-medium">
                          {closure.rawResult || "Closed"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
