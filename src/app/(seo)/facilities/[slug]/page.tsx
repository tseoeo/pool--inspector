import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import Link from "next/link";

export const dynamic = 'force-dynamic';
export const revalidate = 21600; // 6 hours

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getFacility(slug: string) {
  return prisma.facility.findUnique({
    where: { slug },
    include: {
      jurisdiction: true,
      inspections: {
        orderBy: { inspectionDate: "desc" },
        take: 50,
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const facility = await getFacility(slug);
  if (!facility) return {};

  const title = `${facility.displayName} Pool Inspections | Pool Inspection Index`;
  const description = `View inspection history and results for ${facility.displayName} at ${facility.displayAddress}. ${facility.totalInspections} inspections on record.`;

  return {
    title,
    description,
    openGraph: {
      title: facility.displayName,
      description,
    },
  };
}

export async function generateStaticParams() {
  try {
    const facilities = await prisma.facility.findMany({
      select: { slug: true },
      orderBy: { totalInspections: "desc" },
      take: 100,
    });
    return facilities.map((f) => ({ slug: f.slug }));
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

function getResultBadge(result: string | null): { bg: string; text: string; label: string } {
  if (!result) return { bg: "bg-[var(--background-subtle)]", text: "text-[var(--foreground-muted)]", label: "Unknown" };

  const upper = result.toUpperCase();
  if (upper.includes("PASS") || upper.includes("COMPLIANT")) {
    return { bg: "bg-[var(--success-bg)]", text: "text-[var(--success)]", label: result };
  }
  if (upper.includes("FAIL") || upper.includes("NON") || upper.includes("CLOSED")) {
    return { bg: "bg-[var(--danger-bg)]", text: "text-[var(--danger)]", label: result };
  }
  return { bg: "bg-[var(--warning-bg)]", text: "text-[var(--warning)]", label: result };
}

export default async function FacilityPage({ params }: PageProps) {
  const { slug } = await params;
  const facility = await getFacility(slug);

  if (!facility) {
    notFound();
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: facility.displayName,
    address: {
      "@type": "PostalAddress",
      streetAddress: facility.displayAddress,
      addressLocality: facility.city,
      addressRegion: facility.state,
      postalCode: facility.zipCode,
    },
    ...(facility.latitude && facility.longitude
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: facility.latitude,
            longitude: facility.longitude,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <nav className="text-sm mb-6 text-[var(--foreground-muted)]">
          <Link href="/" className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors duration-150">Home</Link>
          <span className="mx-2">/</span>
          <Link href={`/jurisdictions/${facility.jurisdiction.slug}`} className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors duration-150">
            {facility.jurisdiction.name}
          </Link>
          <span className="mx-2">/</span>
          <span>{facility.displayName}</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-2">{facility.displayName}</h1>
          <p className="text-[var(--foreground-secondary)]">{facility.displayAddress}</p>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            {facility.jurisdiction.name}, {facility.state}
          </p>
        </header>

        <section className="border border-[var(--border)] rounded-lg p-6 mb-8">
          <h2 className="text-base font-semibold mb-4">Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Total Inspections</p>
              <p className="text-xl font-semibold font-mono tabular-nums mt-1">{facility.totalInspections}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Last Inspection</p>
              <p className="text-base font-medium font-mono tabular-nums mt-1">
                {facility.lastInspectionDate
                  ? formatDate(facility.lastInspectionDate)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Last Result</p>
              {facility.lastInspectionResult ? (
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                    getResultBadge(facility.lastInspectionResult).bg
                  } ${getResultBadge(facility.lastInspectionResult).text}`}
                >
                  {facility.lastInspectionResult}
                </span>
              ) : (
                <p className="text-base mt-1">-</p>
              )}
            </div>
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Status</p>
              <p className="text-base font-medium capitalize mt-1">
                {facility.status.toLowerCase().replace("_", " ")}
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Inspection History</h2>
          {facility.inspections.length === 0 ? (
            <p className="text-[var(--foreground-muted)]">No inspection records available.</p>
          ) : (
            <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--foreground-secondary)]">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--foreground-secondary)]">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--foreground-secondary)]">Result</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--foreground-secondary)]">Score/Demerits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {facility.inspections.map((inspection) => {
                    const badge = getResultBadge(inspection.rawResult);
                    return (
                      <tr key={inspection.id} className="hover:bg-[var(--background-subtle)] transition-colors duration-150">
                        <td className="py-3 px-4 font-mono tabular-nums text-sm">
                          {formatDate(inspection.inspectionDate)}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--foreground-secondary)]">
                          {inspection.rawInspectionType || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm font-mono tabular-nums text-[var(--foreground-secondary)]">
                          {inspection.demerits !== null
                            ? `${inspection.demerits}`
                            : inspection.rawScore || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
