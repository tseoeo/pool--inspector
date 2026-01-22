import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import Link from "next/link";

export const dynamic = 'force-dynamic';
export const revalidate = 21600; // 6 hours

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface GoogleReview {
  author: string;
  text: string;
  rating: number;
  date: string;
}

interface GoogleHours {
  weekdayText?: string[];
  openNow?: boolean;
}

interface GooglePhoto {
  name: string;
  width: number;
  height: number;
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

          {/* Google Rating if available */}
          {facility.googleRating && (
            <div className="mt-6 pt-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-semibold">{facility.googleRating.toFixed(1)}</span>
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                {facility.googleReviewCount && (
                  <span className="text-sm text-[var(--foreground-muted)]">
                    {facility.googleReviewCount.toLocaleString()} reviews
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Photo Gallery */}
        {facility.googlePhotos && Array.isArray(facility.googlePhotos) && (facility.googlePhotos as unknown as GooglePhoto[]).length > 0 && (
          <section className="mb-8">
            <h2 className="text-base font-semibold mb-4">Photos</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(facility.googlePhotos as unknown as GooglePhoto[]).slice(0, 4).map((photo, i) => (
                <div
                  key={i}
                  className={`relative overflow-hidden rounded-lg bg-[var(--background-subtle)] ${
                    i === 0 ? 'col-span-2 row-span-2 aspect-[4/3]' : 'aspect-square'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos?ref=${encodeURIComponent(photo.name)}&maxWidth=${i === 0 ? '800' : '400'}&maxHeight=${i === 0 ? '600' : '400'}`}
                    alt={`${facility.displayName} photo ${i + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </div>
              ))}
            </div>
            {(facility.googlePhotos as unknown as GooglePhoto[]).length > 4 && (
              <p className="text-xs text-[var(--foreground-muted)] mt-2">
                +{(facility.googlePhotos as unknown as GooglePhoto[]).length - 4} more photos available on Google
              </p>
            )}
          </section>
        )}

        {/* Google Places Info */}
        {facility.googleEnrichedAt && (
          <section className="border border-[var(--border)] rounded-lg p-6 mb-8">
            <h2 className="text-base font-semibold mb-4">Details</h2>

            {/* Contact & Links */}
            <div className="space-y-3 mb-6">
              {facility.googlePhone && (
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${facility.googlePhone}`} className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
                    {facility.googlePhone}
                  </a>
                </div>
              )}
              {facility.googleWebsite && (
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <a href={facility.googleWebsite} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:text-[var(--accent-hover)] truncate max-w-[300px]">
                    {facility.googleWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </div>
              )}
              {facility.latitude && facility.longitude && (
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${facility.latitude},${facility.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
                  >
                    View on Google Maps
                  </a>
                </div>
              )}
            </div>

            {/* Attributes */}
            <div className="flex flex-wrap gap-2 mb-6">
              {facility.wheelchairAccessible === true && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--background-subtle)] rounded text-xs">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Wheelchair Accessible
                </span>
              )}
              {facility.goodForChildren === true && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--background-subtle)] rounded text-xs">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Good for Children
                </span>
              )}
              {facility.allowsDogs === true && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--background-subtle)] rounded text-xs">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Dogs Allowed
                </span>
              )}
              {facility.allowsDogs === false && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--background-subtle)] rounded text-xs text-[var(--foreground-muted)]">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  No Dogs
                </span>
              )}
              {facility.restroom === true && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--background-subtle)] rounded text-xs">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Restrooms
                </span>
              )}
            </div>

            {/* Hours */}
            {facility.googleHours && (facility.googleHours as GoogleHours).weekdayText && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-2">Hours</h3>
                <div className="text-sm text-[var(--foreground-secondary)] space-y-1">
                  {(facility.googleHours as GoogleHours).weekdayText!.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Editorial Summary */}
            {facility.googleEditorialSummary && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-2">About</h3>
                <p className="text-sm text-[var(--foreground-secondary)]">{facility.googleEditorialSummary}</p>
              </div>
            )}

            {/* Google Types */}
            {facility.googleTypes && facility.googleTypes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Categories</h3>
                <div className="flex flex-wrap gap-1">
                  {facility.googleTypes.map((type) => (
                    <span key={type} className="px-2 py-0.5 bg-[var(--background-subtle)] rounded text-xs text-[var(--foreground-muted)]">
                      {type.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Reviews Section */}
        {facility.googleReviews && Array.isArray(facility.googleReviews) && (facility.googleReviews as unknown as GoogleReview[]).length > 0 && (
          <section className="border border-[var(--border)] rounded-lg p-6 mb-8">
            <h2 className="text-base font-semibold mb-4">Recent Reviews</h2>
            <div className="space-y-4">
              {(facility.googleReviews as unknown as GoogleReview[]).slice(0, 5).map((review, i) => (
                <div key={i} className="border-b border-[var(--border)] pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-500' : 'text-gray-300'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-sm font-medium">{review.author}</span>
                    <span className="text-xs text-[var(--foreground-muted)]">{review.date}</span>
                  </div>
                  <p className="text-sm text-[var(--foreground-secondary)] line-clamp-3">{review.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

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
