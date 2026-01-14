"use client";

import { useState, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import type { StateCoverage } from "./page";

// TopoJSON for US states from a CDN
const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// Map of state FIPS codes to state abbreviations
const FIPS_TO_STATE: Record<string, string> = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  "10": "DE",
  "11": "DC",
  "12": "FL",
  "13": "GA",
  "15": "HI",
  "16": "ID",
  "17": "IL",
  "18": "IN",
  "19": "IA",
  "20": "KS",
  "21": "KY",
  "22": "LA",
  "23": "ME",
  "24": "MD",
  "25": "MA",
  "26": "MI",
  "27": "MN",
  "28": "MS",
  "29": "MO",
  "30": "MT",
  "31": "NE",
  "32": "NV",
  "33": "NH",
  "34": "NJ",
  "35": "NM",
  "36": "NY",
  "37": "NC",
  "38": "ND",
  "39": "OH",
  "40": "OK",
  "41": "OR",
  "42": "PA",
  "44": "RI",
  "45": "SC",
  "46": "SD",
  "47": "TN",
  "48": "TX",
  "49": "UT",
  "50": "VT",
  "51": "VA",
  "53": "WA",
  "54": "WV",
  "55": "WI",
  "56": "WY",
};

interface USCoverageMapProps {
  coverageData: Record<string, StateCoverage>;
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

// Get darker hover color
function getHoverColor(percent: number): string {
  if (percent === 0) return "#cbd5e1"; // darker gray
  if (percent <= 25) return "#86efac";
  if (percent <= 50) return "#4ade80";
  if (percent <= 75) return "#22c55e";
  if (percent < 100) return "#16a34a";
  return "#15803d"; // darker full green
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return n.toString();
}

export const USCoverageMap = memo(function USCoverageMap({
  coverageData,
}: USCoverageMapProps) {
  const [tooltipContent, setTooltipContent] = useState<string>("");
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (
    geo: { id: string },
    event: React.MouseEvent<SVGPathElement>
  ) => {
    const stateCode = FIPS_TO_STATE[geo.id];
    if (!stateCode) return;

    const coverage = coverageData[stateCode];
    if (coverage) {
      if (coverage.targetCount > 0) {
        setTooltipContent(
          `${coverage.stateName}: ${coverage.coveragePercent}% (${coverage.integratedCount}/${coverage.targetCount} jurisdictions)`
        );
      } else {
        setTooltipContent(`${coverage.stateName}: No targets defined`);
      }
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseLeave = () => {
    setTooltipContent("");
  };

  const handleMouseMove = (event: React.MouseEvent<SVGPathElement>) => {
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  };

  return (
    <div className="relative">
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{
          scale: 1000,
        }}
        style={{
          width: "100%",
          height: "auto",
        }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const stateCode = FIPS_TO_STATE[geo.id];
              const coverage = stateCode ? coverageData[stateCode] : null;
              const percent = coverage?.coveragePercent || 0;
              const fillColor = getCoverageColor(percent);
              const hoverColor = getHoverColor(percent);

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onMouseEnter={(event) => handleMouseEnter(geo, event)}
                  onMouseLeave={handleMouseLeave}
                  onMouseMove={handleMouseMove}
                  style={{
                    default: {
                      fill: fillColor,
                      stroke: "#ffffff",
                      strokeWidth: 0.5,
                      outline: "none",
                    },
                    hover: {
                      fill: hoverColor,
                      stroke: "#ffffff",
                      strokeWidth: 0.5,
                      outline: "none",
                      cursor: "pointer",
                    },
                    pressed: {
                      fill: hoverColor,
                      stroke: "#ffffff",
                      strokeWidth: 0.5,
                      outline: "none",
                    },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Tooltip */}
      {tooltipContent && (
        <div
          className="fixed z-50 px-3 py-2 text-sm bg-[var(--foreground)] text-[var(--background)] rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 30,
          }}
        >
          {tooltipContent}
        </div>
      )}
    </div>
  );
});
