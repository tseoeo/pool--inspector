import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import Link from "next/link";

export const dynamic = 'force-dynamic';
export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: "Dog-Friendly Pools in Austin, TX | Are Dogs Allowed?",
  description: "Find out which pools in Austin, Texas allow dogs. Complete list of pet-friendly and no-dogs-allowed swimming pools with ratings, addresses, and inspection history.",
  keywords: ["dog friendly pools Austin", "pets allowed pools Texas", "Austin TX swimming pools dogs", "can I bring my dog to the pool Austin"],
  openGraph: {
    title: "Dog-Friendly Pools in Austin, TX",
    description: "Complete guide to pet policies at Austin swimming pools. Find which pools allow dogs and which don't.",
  },
};

interface PoolWithDogPolicy {
  id: string;
  slug: string;
  displayName: string;
  displayAddress: string;
  allowsDogs: boolean | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  totalInspections: number;
  lastInspectionResult: string | null;
}

async function getAustinPools(): Promise<PoolWithDogPolicy[]> {
  const pools = await prisma.facility.findMany({
    where: {
      OR: [
        { city: "Austin", state: "TX" },
        { city: "AUSTIN", state: "TX" },
      ],
      allowsDogs: { not: null },
    },
    select: {
      id: true,
      slug: true,
      displayName: true,
      displayAddress: true,
      allowsDogs: true,
      googleRating: true,
      googleReviewCount: true,
      totalInspections: true,
      lastInspectionResult: true,
    },
    orderBy: [
      { allowsDogs: 'desc' }, // Dogs allowed first
      { googleRating: 'desc' },
    ],
  });

  return pools;
}

function DogBadge({ allowed }: { allowed: boolean }) {
  if (allowed) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Dogs Allowed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
      No Dogs
    </span>
  );
}

function StarRating({ rating, count }: { rating: number; count: number | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span className="text-sm font-medium text-[var(--foreground)]">{rating.toFixed(1)}</span>
      </div>
      {count && (
        <span className="text-xs text-[var(--foreground-muted)]">
          ({count.toLocaleString()})
        </span>
      )}
    </div>
  );
}

export default async function DogFriendlyPoolsPage() {
  const pools = await getAustinPools();

  const dogFriendly = pools.filter(p => p.allowsDogs === true);
  const noDogs = pools.filter(p => p.allowsDogs === false);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Dog-Friendly Pools in Austin, TX",
    description: "Swimming pools in Austin, Texas that allow dogs",
    numberOfItems: dogFriendly.length,
    itemListElement: dogFriendly.map((pool, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "LocalBusiness",
        name: pool.displayName,
        address: pool.displayAddress,
        ...(pool.googleRating && { aggregateRating: { "@type": "AggregateRating", ratingValue: pool.googleRating } }),
      },
    })),
  };

  return (
    <>
      {/* JSON-LD structured data for SEO - content is server-generated, safe from XSS */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumb */}
        <nav className="text-sm mb-6 text-[var(--foreground-muted)]">
          <Link href="/" className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/jurisdictions/austin-tx" className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">Austin, TX</Link>
          <span className="mx-2">/</span>
          <span>Dog-Friendly Pools</span>
        </nav>

        {/* Hero Section */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Dog-Friendly Pools in Austin, TX</h1>
          </div>
          <p className="text-[var(--foreground-secondary)] max-w-2xl">
            Planning to bring your furry friend for a swim? Here&apos;s a complete list of {pools.length} Austin pools
            with known pet policies — {dogFriendly.length} allow dogs, {noDogs.length} don&apos;t.
          </p>
        </header>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-emerald-700">Dogs Allowed</span>
            </div>
            <p className="text-3xl font-semibold text-emerald-900 tabular-nums">{dogFriendly.length}</p>
            <p className="text-xs text-emerald-600 mt-1">pools welcome pets</p>
          </div>
          <div className="border border-[var(--border)] bg-[var(--background-subtle)] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm font-medium text-[var(--foreground-secondary)]">No Dogs</span>
            </div>
            <p className="text-3xl font-semibold text-[var(--foreground)] tabular-nums">{noDogs.length}</p>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">pools don&apos;t allow pets</p>
          </div>
        </div>

        {/* Dog-Friendly Section */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold">Pools That Allow Dogs</h2>
            <span className="text-xs text-[var(--foreground-muted)] bg-[var(--background-subtle)] px-2 py-0.5 rounded-full">
              {dogFriendly.length}
            </span>
          </div>

          <div className="space-y-3">
            {dogFriendly.map((pool) => (
              <Link
                key={pool.id}
                href={`/facilities/${pool.slug}`}
                className="block border border-[var(--border)] rounded-lg p-4 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-[var(--foreground)] truncate">{pool.displayName}</h3>
                      <DogBadge allowed={true} />
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)] truncate">{pool.displayAddress}</p>
                    <div className="flex items-center gap-4 mt-2">
                      {pool.googleRating && (
                        <StarRating rating={pool.googleRating} count={pool.googleReviewCount} />
                      )}
                      <span className="text-xs text-[var(--foreground-muted)]">
                        {pool.totalInspections} inspections
                      </span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-[var(--foreground-faint)] flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* No Dogs Section */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold">Pools That Don&apos;t Allow Dogs</h2>
            <span className="text-xs text-[var(--foreground-muted)] bg-[var(--background-subtle)] px-2 py-0.5 rounded-full">
              {noDogs.length}
            </span>
          </div>

          <div className="space-y-3">
            {noDogs.map((pool) => (
              <Link
                key={pool.id}
                href={`/facilities/${pool.slug}`}
                className="block border border-[var(--border)] rounded-lg p-4 hover:border-[var(--foreground-faint)] hover:bg-[var(--background-subtle)] transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-[var(--foreground)] truncate">{pool.displayName}</h3>
                      <DogBadge allowed={false} />
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)] truncate">{pool.displayAddress}</p>
                    <div className="flex items-center gap-4 mt-2">
                      {pool.googleRating && (
                        <StarRating rating={pool.googleRating} count={pool.googleReviewCount} />
                      )}
                      <span className="text-xs text-[var(--foreground-muted)]">
                        {pool.totalInspections} inspections
                      </span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-[var(--foreground-faint)] flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ Section for SEO */}
        <section className="border-t border-[var(--border)] pt-8">
          <h2 className="text-lg font-semibold mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-[var(--foreground)] mb-1">Can I bring my dog to a pool in Austin?</h3>
              <p className="text-sm text-[var(--foreground-secondary)]">
                Yes, {dogFriendly.length} pools in Austin, TX allow dogs. Most dog-friendly pools are hotel pools
                that welcome guests with pets. Public municipal pools typically don&apos;t allow dogs for health and safety reasons.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-[var(--foreground)] mb-1">Which types of pools allow dogs in Austin?</h3>
              <p className="text-sm text-[var(--foreground-secondary)]">
                Hotels, resorts, and some private facilities are most likely to allow dogs. These include pet-friendly
                hotel chains like La Quinta, Hampton Inn, and various boutique hotels in the Austin area.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-[var(--foreground)] mb-1">How is this data collected?</h3>
              <p className="text-sm text-[var(--foreground-secondary)]">
                Pet policy information is sourced from Google Places data for facilities in our database.
                We recommend calling ahead to confirm current policies before visiting with your pet.
              </p>
            </div>
          </div>
        </section>

        {/* Data Source Note */}
        <footer className="mt-8 pt-6 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--foreground-muted)]">
            Data sourced from health inspection records and Google Places. Pet policies may change —
            please verify with the facility before visiting. Last updated based on available records.
          </p>
        </footer>
      </div>
    </>
  );
}
