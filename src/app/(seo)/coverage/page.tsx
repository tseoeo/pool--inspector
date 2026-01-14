import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import Link from "next/link";
import { US_STATES } from "@/lib/us-states";
import { USCoverageMap } from "./USCoverageMap";
import { TargetStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1 hour

export const metadata: Metadata = {
  title: "Data Coverage | Pool Inspection Index",
  description:
    "Track our progress collecting pool inspection data across the United States. See which states and regions have data and where we need to expand.",
};

export interface StateCoverage {
  stateCode: string;
  stateName: string;
  // Target-based coverage
  targetCount: number;
  integratedCount: number;
  coveragePercent: number;
  // Actual data counts
  facilityCount: number;
  inspectionCount: number;
  // Target details
  targets: {
    name: string;
    status: TargetStatus;
    hasData: boolean;
  }[];
}

async function getCoverageData(): Promise<StateCoverage[]> {
  // Get all target jurisdictions with their linked jurisdiction data
  const targets = await prisma.targetJurisdiction.findMany({
    include: {
      jurisdiction: {
        include: {
          _count: {
            select: { facilities: true },
          },
        },
      },
    },
    orderBy: [{ state: "asc" }, { priority: "desc" }, { name: "asc" }],
  });

  // Get inspection counts grouped by state
  const stateInspectionCounts = await prisma.$queryRaw<
    { state: string; count: bigint }[]
  >`
    SELECT j.state, COUNT(ie.id) as count
    FROM "InspectionEvent" ie
    JOIN "Facility" f ON ie."facilityId" = f.id
    JOIN "Jurisdiction" j ON f."jurisdictionId" = j.id
    GROUP BY j.state
  `;

  const inspectionsByState: Record<string, number> = {};
  for (const row of stateInspectionCounts) {
    inspectionsByState[row.state] = Number(row.count);
  }

  // Get facility counts grouped by state
  const stateFacilityCounts = await prisma.$queryRaw<
    { state: string; count: bigint }[]
  >`
    SELECT j.state, COUNT(f.id) as count
    FROM "Facility" f
    JOIN "Jurisdiction" j ON f."jurisdictionId" = j.id
    GROUP BY j.state
  `;

  const facilitiesByState: Record<string, number> = {};
  for (const row of stateFacilityCounts) {
    facilitiesByState[row.state] = Number(row.count);
  }

  // Group targets by state
  const targetsByState: Record<
    string,
    {
      targets: typeof targets;
      integratedCount: number;
    }
  > = {};

  for (const target of targets) {
    if (!targetsByState[target.state]) {
      targetsByState[target.state] = { targets: [], integratedCount: 0 };
    }
    targetsByState[target.state].targets.push(target);
    if (target.status === TargetStatus.INTEGRATED) {
      targetsByState[target.state].integratedCount++;
    }
  }

  // Build full coverage list with all 50 states
  return US_STATES.map((state) => {
    const stateTargets = targetsByState[state.code];
    const targetCount = stateTargets?.targets.length || 0;
    const integratedCount = stateTargets?.integratedCount || 0;
    const coveragePercent =
      targetCount > 0 ? Math.round((integratedCount / targetCount) * 100) : 0;

    return {
      stateCode: state.code,
      stateName: state.name,
      targetCount,
      integratedCount,
      coveragePercent,
      facilityCount: facilitiesByState[state.code] || 0,
      inspectionCount: inspectionsByState[state.code] || 0,
      targets: (stateTargets?.targets || []).map((t) => ({
        name: t.name,
        status: t.status,
        hasData: t.status === TargetStatus.INTEGRATED,
      })),
    };
  });
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return n.toString();
}

// Get color based on coverage percentage
function getCoverageColor(percent: number): string {
  if (percent === 0) return "#e2e8f0"; // gray
  if (percent <= 25) return "#bbf7d0"; // light green
  if (percent <= 50) return "#86efac";
  if (percent <= 75) return "#4ade80";
  if (percent < 100) return "#22c55e";
  return "#16a34a"; // full green
}

export default async function CoveragePage() {
  const coverage = await getCoverageData();

  // Sort states: those with targets first (by coverage %), then those without
  const statesWithTargets = coverage
    .filter((s) => s.targetCount > 0)
    .sort((a, b) => b.coveragePercent - a.coveragePercent);
  const statesWithoutTargets = coverage.filter((s) => s.targetCount === 0);

  const totalTargets = coverage.reduce((sum, s) => sum + s.targetCount, 0);
  const totalIntegrated = coverage.reduce((sum, s) => sum + s.integratedCount, 0);
  const totalFacilities = coverage.reduce((sum, s) => sum + s.facilityCount, 0);
  const totalInspections = coverage.reduce((sum, s) => sum + s.inspectionCount, 0);
  const overallPercent =
    totalTargets > 0 ? Math.round((totalIntegrated / totalTargets) * 100) : 0;

  // Convert to a map for the client component
  const coverageMap: Record<string, StateCoverage> = {};
  for (const state of coverage) {
    coverageMap[state.stateCode] = state;
  }

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
        <span>Coverage</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Data Coverage
        </h1>
        <p className="text-[var(--foreground-secondary)]">
          Track our progress collecting pool inspection data across the United
          States. Each state has target jurisdictions we aim to collect.
        </p>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="border border-[var(--border)] rounded-lg p-4">
          <p className="text-sm text-[var(--foreground-muted)] mb-1">
            Jurisdictions
          </p>
          <p className="text-2xl font-semibold font-mono tabular-nums">
            {totalIntegrated}
            <span className="text-[var(--foreground-muted)] text-base font-normal">
              {" "}
              / {totalTargets}
            </span>
          </p>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-4">
          <p className="text-sm text-[var(--foreground-muted)] mb-1">
            Coverage
          </p>
          <p className="text-2xl font-semibold font-mono tabular-nums">
            {overallPercent}%
          </p>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-4">
          <p className="text-sm text-[var(--foreground-muted)] mb-1">
            Facilities
          </p>
          <p className="text-2xl font-semibold font-mono tabular-nums">
            {formatNumber(totalFacilities)}
          </p>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-4">
          <p className="text-sm text-[var(--foreground-muted)] mb-1">
            Inspections
          </p>
          <p className="text-2xl font-semibold font-mono tabular-nums">
            {formatNumber(totalInspections)}
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="border border-[var(--border)] rounded-lg p-6 mb-8">
        <USCoverageMap coverageData={coverageMap} />

        {/* Legend - gradient */}
        <div className="flex justify-center items-center gap-2 mt-4 text-sm">
          <span className="text-[var(--foreground-muted)]">0%</span>
          <div className="flex h-4 rounded overflow-hidden">
            <span className="w-6 bg-[#e2e8f0]"></span>
            <span className="w-6 bg-[#bbf7d0]"></span>
            <span className="w-6 bg-[#86efac]"></span>
            <span className="w-6 bg-[#4ade80]"></span>
            <span className="w-6 bg-[#22c55e]"></span>
            <span className="w-6 bg-[#16a34a]"></span>
          </div>
          <span className="text-[var(--foreground-muted)]">100%</span>
        </div>
      </div>

      {/* State Lists */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Coverage by State</h2>

        {/* States with targets */}
        <div className="border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
          {statesWithTargets.map((state) => (
            <div
              key={state.stateCode}
              className="p-4 hover:bg-[var(--background-subtle)] transition-colors duration-150"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-medium">{state.stateName}</span>
                  <span className="text-[var(--foreground-muted)] ml-2 text-sm">
                    ({state.stateCode})
                  </span>
                </div>
                <div className="text-right text-sm">
                  <span
                    className="font-mono tabular-nums font-medium"
                    style={{ color: getCoverageColor(state.coveragePercent) }}
                  >
                    {state.coveragePercent}%
                  </span>
                  <span className="text-[var(--foreground-muted)] ml-2">
                    ({state.integratedCount}/{state.targetCount})
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-[var(--background-subtle)] rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${state.coveragePercent}%`,
                    backgroundColor: getCoverageColor(state.coveragePercent),
                  }}
                />
              </div>

              {/* Target jurisdictions */}
              <div className="flex flex-wrap gap-2 text-xs">
                {state.targets.map((target) => (
                  <span
                    key={target.name}
                    className={`px-2 py-1 rounded ${
                      target.hasData
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-[var(--background-subtle)] text-[var(--foreground-muted)]"
                    }`}
                  >
                    {target.hasData ? "✓ " : ""}
                    {target.name}
                  </span>
                ))}
              </div>

              {/* Stats if has data */}
              {state.facilityCount > 0 && (
                <div className="mt-2 text-xs text-[var(--foreground-muted)]">
                  {formatNumber(state.facilityCount)} facilities,{" "}
                  {formatNumber(state.inspectionCount)} inspections
                </div>
              )}
            </div>
          ))}
        </div>

        {/* States without targets */}
        {statesWithoutTargets.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--foreground-muted)] mb-3">
              States without target jurisdictions ({statesWithoutTargets.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {statesWithoutTargets.map((state) => (
                <span
                  key={state.stateCode}
                  className="px-2 py-1 text-xs rounded bg-[var(--background-subtle)] text-[var(--foreground-muted)]"
                >
                  {state.stateName}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
