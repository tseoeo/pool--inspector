import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import Link from "next/link";
import { Prisma, InspectionResult } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore Inspection Data | Pool Inspection Index",
  description:
    "Search, filter, and export pool and spa inspection records from across the USA.",
};

interface SearchParams {
  jurisdiction?: string;
  from?: string;
  to?: string;
  result?: string;
  q?: string;
  page?: string;
}

async function getJurisdictions() {
  return prisma.jurisdiction.findMany({
    orderBy: [{ state: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, state: true },
  });
}

async function getInspections(params: SearchParams) {
  const page = parseInt(params.page || "1");
  const limit = 25;
  const offset = (page - 1) * limit;

  const where: Prisma.InspectionEventWhereInput = {};

  if (params.jurisdiction) {
    where.facility = { jurisdiction: { slug: params.jurisdiction } };
  }

  if (params.from) {
    where.inspectionDate = { ...((where.inspectionDate as object) || {}), gte: new Date(params.from) };
  }

  if (params.to) {
    where.inspectionDate = { ...((where.inspectionDate as object) || {}), lte: new Date(params.to + "T23:59:59") };
  }

  if (params.result && params.result !== "ALL") {
    where.result = params.result as InspectionResult;
  }

  if (params.q) {
    where.facility = {
      ...((where.facility as object) || {}),
      displayName: { contains: params.q, mode: "insensitive" },
    };
  }

  const [inspections, total] = await Promise.all([
    prisma.inspectionEvent.findMany({
      where,
      include: {
        facility: {
          select: {
            displayName: true,
            displayAddress: true,
            city: true,
            state: true,
            zipCode: true,
            slug: true,
            jurisdiction: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { inspectionDate: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.inspectionEvent.count({ where }),
  ]);

  return {
    inspections,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getResultBadge(result: string | null) {
  switch (result) {
    case "PASS":
      return { bg: "bg-[var(--success-bg)]", text: "text-[var(--success)]" };
    case "FAIL":
    case "CLOSED":
      return { bg: "bg-[var(--danger-bg)]", text: "text-[var(--danger)]" };
    case "CONDITIONAL_PASS":
    case "PENDING":
      return { bg: "bg-[var(--warning-bg)]", text: "text-[var(--warning)]" };
    default:
      return { bg: "bg-[var(--background-subtle)]", text: "text-[var(--foreground-muted)]" };
  }
}

function buildExportUrl(params: SearchParams): string {
  const url = new URLSearchParams();
  if (params.jurisdiction) url.set("jurisdiction", params.jurisdiction);
  if (params.from) url.set("from", params.from);
  if (params.to) url.set("to", params.to);
  if (params.result && params.result !== "ALL") url.set("result", params.result);
  if (params.q) url.set("q", params.q);
  return `/api/export/csv?${url.toString()}`;
}

function buildPageUrl(params: SearchParams, page: number): string {
  const url = new URLSearchParams();
  if (params.jurisdiction) url.set("jurisdiction", params.jurisdiction);
  if (params.from) url.set("from", params.from);
  if (params.to) url.set("to", params.to);
  if (params.result) url.set("result", params.result);
  if (params.q) url.set("q", params.q);
  url.set("page", page.toString());
  return `/explore?${url.toString()}`;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [jurisdictions, { inspections, pagination }] = await Promise.all([
    getJurisdictions(),
    getInspections(params),
  ]);

  const resultOptions = ["ALL", "PASS", "FAIL", "CONDITIONAL_PASS", "CLOSED", "PENDING", "OTHER"];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <nav className="text-sm mb-6 text-[var(--foreground-muted)]">
        <Link
          href="/"
          className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors duration-150"
        >
          Home
        </Link>
        <span className="mx-2">/</span>
        <span>Explore Data</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Explore Inspection Data
        </h1>
        <p className="text-[var(--foreground-secondary)]">
          Search, filter, and export inspection records.
        </p>
      </header>

      {/* Filters */}
      <form method="get" className="border border-[var(--border)] rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label
              htmlFor="jurisdiction"
              className="block text-sm text-[var(--foreground-muted)] mb-1"
            >
              Jurisdiction
            </label>
            <select
              id="jurisdiction"
              name="jurisdiction"
              defaultValue={params.jurisdiction || ""}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">All Jurisdictions</option>
              {jurisdictions.map((j) => (
                <option key={j.id} value={j.slug}>
                  {j.name}, {j.state}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="from"
              className="block text-sm text-[var(--foreground-muted)] mb-1"
            >
              From Date
            </label>
            <input
              type="date"
              id="from"
              name="from"
              defaultValue={params.from || ""}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div>
            <label
              htmlFor="to"
              className="block text-sm text-[var(--foreground-muted)] mb-1"
            >
              To Date
            </label>
            <input
              type="date"
              id="to"
              name="to"
              defaultValue={params.to || ""}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div>
            <label
              htmlFor="result"
              className="block text-sm text-[var(--foreground-muted)] mb-1"
            >
              Result
            </label>
            <select
              id="result"
              name="result"
              defaultValue={params.result || "ALL"}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {resultOptions.map((r) => (
                <option key={r} value={r}>
                  {r === "ALL" ? "All Results" : r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="q"
              className="block text-sm text-[var(--foreground-muted)] mb-1"
            >
              Facility Name
            </label>
            <input
              type="text"
              id="q"
              name="q"
              placeholder="Search..."
              defaultValue={params.q || ""}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors duration-150"
          >
            Apply Filters
          </button>
          <Link
            href="/explore"
            className="px-4 py-2 border border-[var(--border)] rounded-md text-sm text-[var(--foreground-secondary)] hover:border-[var(--foreground-faint)] transition-colors duration-150"
          >
            Reset
          </Link>
          <a
            href={buildExportUrl(params)}
            className="ml-auto px-4 py-2 border border-[var(--border)] rounded-md text-sm font-medium text-[var(--foreground-secondary)] hover:border-[var(--foreground-faint)] transition-colors duration-150 flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </a>
        </div>
      </form>

      {/* Results Summary */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--foreground-muted)]">
          <span className="font-mono tabular-nums font-medium text-[var(--foreground)]">
            {pagination.total.toLocaleString()}
          </span>{" "}
          inspections found
        </p>
        <p className="text-sm text-[var(--foreground-muted)]">
          Page{" "}
          <span className="font-mono tabular-nums">{pagination.page}</span> of{" "}
          <span className="font-mono tabular-nums">{pagination.totalPages || 1}</span>
        </p>
      </div>

      {/* Data Table */}
      {inspections.length === 0 ? (
        <div className="border border-[var(--border)] rounded-lg p-8 text-center">
          <p className="text-[var(--foreground-muted)]">
            No inspections found matching your criteria.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
          <table className="w-full">
            <thead className="bg-[var(--background-subtle)]">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-[var(--foreground-secondary)]">
                  Facility
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[var(--foreground-secondary)]">
                  Jurisdiction
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[var(--foreground-secondary)]">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-[var(--foreground-secondary)]">
                  Result
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-[var(--foreground-secondary)]">
                  Score
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-[var(--foreground-secondary)]">
                  Closure
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {inspections.map((inspection) => {
                const badge = getResultBadge(inspection.result);
                return (
                  <tr
                    key={inspection.id}
                    className="hover:bg-[var(--background-subtle)] transition-colors duration-150"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/facilities/${inspection.facility.slug}`}
                        className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium text-[15px] transition-colors duration-150"
                      >
                        {inspection.facility.displayName}
                      </Link>
                      <p className="text-xs text-[var(--foreground-muted)] mt-0.5 truncate max-w-xs">
                        {inspection.facility.city}, {inspection.facility.state}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)]">
                      <Link
                        href={`/jurisdictions/${inspection.facility.jurisdiction.slug}`}
                        className="hover:text-[var(--foreground)] transition-colors duration-150"
                      >
                        {inspection.facility.jurisdiction.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono tabular-nums text-[var(--foreground-secondary)] whitespace-nowrap">
                      {formatDate(inspection.inspectionDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}
                      >
                        {inspection.result?.replace(/_/g, " ") || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-sm text-[var(--foreground-secondary)]">
                      {inspection.score ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {inspection.isClosure ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-[var(--danger)]" />
                      ) : (
                        <span className="text-[var(--foreground-muted)]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {pagination.page > 1 ? (
            <Link
              href={buildPageUrl(params, pagination.page - 1)}
              className="px-4 py-2 border border-[var(--border)] rounded-md text-sm hover:border-[var(--foreground-faint)] transition-colors duration-150"
            >
              Previous
            </Link>
          ) : (
            <span className="px-4 py-2 border border-[var(--border)] rounded-md text-sm text-[var(--foreground-muted)] cursor-not-allowed">
              Previous
            </span>
          )}

          <span className="px-4 py-2 text-sm text-[var(--foreground-secondary)]">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          {pagination.page < pagination.totalPages ? (
            <Link
              href={buildPageUrl(params, pagination.page + 1)}
              className="px-4 py-2 border border-[var(--border)] rounded-md text-sm hover:border-[var(--foreground-faint)] transition-colors duration-150"
            >
              Next
            </Link>
          ) : (
            <span className="px-4 py-2 border border-[var(--border)] rounded-md text-sm text-[var(--foreground-muted)] cursor-not-allowed">
              Next
            </span>
          )}
        </div>
      )}
    </div>
  );
}
