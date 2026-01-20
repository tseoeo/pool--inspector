import type { Source } from "@prisma/client";
import { BaseAdapter } from "./base";
import type {
  CursorState,
  FetchResult,
  AdapterConfig,
  RawPayload,
} from "@/types/ingestion";
import { withRetry } from "../utils/retry";

interface MaricopaConfig extends AdapterConfig {
  searchEndpoint: string;
  permitEndpoint: string;
  inspectionEndpoint: string;
  searchPatterns: string[];
}

interface MaricopaFacility {
  permitId: string;
  permitType: string;
  businessName: string;
  businessAddressConcat: string;
  notes: string;
}

interface MaricopaSearchResponse {
  data: MaricopaFacility[];
}

interface MaricopaCursor {
  patternIndex: number;
  facilityIndex: number;
  facilities: MaricopaFacility[];
  currentPattern: string;
  seenPermitIds: string[];
}

// Search patterns to find all facilities
// Using single letters as wildcards gets comprehensive coverage
const SEARCH_PATTERNS = ["a", "e", "i", "o", "u", "1", "2", "3", "4", "5"];

export class MaricopaScraperAdapter extends BaseAdapter {
  protected config: MaricopaConfig;
  private cookieJar: string = "";

  constructor(source: Source) {
    super(source);
    this.config = this.parseConfig(source.config);
  }

  parseConfig(raw: unknown): MaricopaConfig {
    const config = (raw || {}) as Record<string, unknown>;
    return {
      searchEndpoint: "/Search/ResultsSP",
      permitEndpoint: "/Permit/PermitResultsSP",
      inspectionEndpoint: "/InspectionSP",
      searchPatterns: (config.searchPatterns as string[]) || SEARCH_PATTERNS,
      batchSize: (config.batchSize as number) || 100,
      timeout: (config.timeout as number) || 60000,
      retryAttempts: (config.retryAttempts as number) || 3,
    };
  }

  private getBaseUrl(): string {
    return this.source.endpoint.replace(/\/$/, "");
  }

  private async initSession(): Promise<void> {
    const response = await fetch(
      `${this.getBaseUrl()}/WaterWaste/SwimmingPool`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PoolInspector/1.0)",
        },
      }
    );

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/\.AspNetCore\.Session=([^;]+)/);
      if (match) {
        this.cookieJar = `.AspNetCore.Session=${match[1]}`;
      }
    }
  }

  private async searchFacilities(pattern: string): Promise<MaricopaFacility[]> {
    const url = `${this.getBaseUrl()}${this.config.searchEndpoint}`;

    // Search by business name pattern (wildcards like "a" return comprehensive results)
    const params = new URLSearchParams({
      "licenseSearchParams[BusinessName]": pattern,
      "licenseSearchParams[AddressNum]": "",
      "licenseSearchParams[StreetName]": "",
      "licenseSearchParams[PreDirection]": "",
      "licenseSearchParams[StreetType]": "",
      "licenseSearchParams[City]": "",
      "licenseSearchParams[Zip]": "",
      draw: "1",
      start: "0",
      length: "10000",
    });

    const response = await withRetry(
      async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (compatible; PoolInspector/1.0)",
            Accept: "application/json",
            Cookie: this.cookieJar,
          },
          body: params.toString(),
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!res.ok) {
          throw new Error(`Search failed: ${res.status}`);
        }

        return res.json() as Promise<MaricopaSearchResponse>;
      },
      { attempts: this.config.retryAttempts }
    );

    return response.data || [];
  }

  private async getInspections(
    permitId: string
  ): Promise<{ date: string; purpose: string; status: string; inspectionId: string }[]> {
    const url = `${this.getBaseUrl()}${this.config.permitEndpoint}/${encodeURIComponent(permitId)}`;

    const response = await withRetry(
      async () => {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; PoolInspector/1.0)",
            Cookie: this.cookieJar,
          },
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!res.ok) {
          throw new Error(`Permit page failed: ${res.status}`);
        }

        return res.text();
      },
      { attempts: this.config.retryAttempts }
    );

    const inspections: { date: string; purpose: string; status: string; inspectionId: string }[] = [];

    // Match inspection rows from HTML table
    const rowRegex = /<tr>\s*<td[^>]*>\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*<\/td>\s*<td>\s*([^<]+)\s*<\/td>\s*<td>\s*([^<]+)\s*<\/td>\s*<td>\s*<a[^>]*href="\/InspectionSP\/[^"]*\/([^"]+)"[^>]*>/gi;

    let match;
    while ((match = rowRegex.exec(response)) !== null) {
      inspections.push({
        date: match[1].trim(),
        purpose: match[2].trim(),
        status: match[3].trim(),
        inspectionId: match[4].trim(),
      });
    }

    return inspections;
  }

  private async getInspectionDetails(
    permitId: string,
    inspectionId: string
  ): Promise<{ violations: string; notes: string }> {
    const url = `${this.getBaseUrl()}${this.config.inspectionEndpoint}/${encodeURIComponent(permitId)}/${encodeURIComponent(inspectionId)}`;

    const response = await withRetry(
      async () => {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; PoolInspector/1.0)",
            Cookie: this.cookieJar,
          },
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!res.ok) {
          throw new Error(`Inspection page failed: ${res.status}`);
        }

        return res.text();
      },
      { attempts: this.config.retryAttempts }
    );

    const detailsMatch = response.match(
      /<div[^>]*class="inspectionDetailsText"[^>]*>([\s\S]*?)<\/div>/i
    );

    const details = detailsMatch
      ? detailsMatch[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim()
      : "";

    const hasViolations = !details.toLowerCase().includes("no violations noted");

    return {
      violations: hasViolations ? details : "",
      notes: details,
    };
  }

  private parseAddress(addressConcat: string): {
    street: string;
    city: string;
    state: string;
    zip: string;
  } {
    const parts = addressConcat.trim().split(/\s+/);
    const zip = parts.pop() || "";
    const state = parts.pop() || "AZ";

    const streetTypes = ["Ave", "St", "Blvd", "Dr", "Rd", "Ln", "Way", "Ct", "Pl", "Cir", "Pkwy"];
    let streetEndIndex = parts.length;

    for (let i = parts.length - 1; i >= 0; i--) {
      if (streetTypes.includes(parts[i])) {
        streetEndIndex = i + 1;
        break;
      }
    }

    const street = parts.slice(0, streetEndIndex).join(" ");
    const city = parts.slice(streetEndIndex).join(" ");

    return { street, city: city || "Unknown", state, zip };
  }

  async fetch(cursor: CursorState | null): Promise<FetchResult> {
    if (!this.cookieJar) {
      await this.initSession();
    }

    let state: MaricopaCursor;
    if (cursor?.type === "objectid" && typeof cursor.value === "string") {
      state = JSON.parse(cursor.value) as MaricopaCursor;
    } else {
      // Start with first search pattern
      const firstPattern = this.config.searchPatterns[0];
      console.log(`Searching facilities with pattern "${firstPattern}"...`);
      const facilities = await this.searchFacilities(firstPattern);
      console.log(`Found ${facilities.length} facilities with pattern "${firstPattern}"`);

      state = {
        patternIndex: 0,
        facilityIndex: 0,
        facilities,
        currentPattern: firstPattern,
        seenPermitIds: [],
      };
    }

    const records: RawPayload[] = [];
    let processedCount = 0;
    const maxPerBatch = this.config.batchSize;

    while (
      processedCount < maxPerBatch &&
      state.facilityIndex < state.facilities.length
    ) {
      const facility = state.facilities[state.facilityIndex];

      // Skip if we've already processed this facility (from a previous search pattern)
      if (state.seenPermitIds.includes(facility.permitId)) {
        state.facilityIndex++;
        continue;
      }

      state.seenPermitIds.push(facility.permitId);

      try {
        const inspections = await this.getInspections(facility.permitId);
        const address = this.parseAddress(facility.businessAddressConcat);

        for (const insp of inspections) {
          // Skip fetching individual inspection details for speed
          // We can enrich with violation details later if needed
          const externalId = `${facility.permitId}_${insp.inspectionId}`;
          records.push({
            externalId,
            data: {
              permitId: facility.permitId,
              permitType: facility.permitType,
              businessName: facility.businessName,
              businessAddress: facility.businessAddressConcat,
              street: address.street,
              city: address.city,
              state: address.state,
              zip: address.zip,
              poolNotes: facility.notes,
              inspectionId: insp.inspectionId,
              inspectionDate: insp.date,
              inspectionPurpose: insp.purpose,
              inspectionStatus: insp.status,
              violations: "", // Will be empty for now
              inspectionNotes: "",
              sourceUrl: `${this.getBaseUrl()}/InspectionSP/${facility.permitId}/${insp.inspectionId}`,
            },
          });
        }

        // Small delay to be respectful to the server
        await new Promise((r) => setTimeout(r, 100));
      } catch (error) {
        console.error(`Error processing facility ${facility.permitId}:`, error);
      }

      state.facilityIndex++;
      processedCount++;
    }

    let hasMore = true;
    if (state.facilityIndex >= state.facilities.length) {
      // Move to next search pattern
      state.patternIndex++;
      if (state.patternIndex < this.config.searchPatterns.length) {
        const nextPattern = this.config.searchPatterns[state.patternIndex];
        console.log(`Moving to pattern "${nextPattern}"...`);
        state.facilities = await this.searchFacilities(nextPattern);
        state.facilityIndex = 0;
        state.currentPattern = nextPattern;
        console.log(`Found ${state.facilities.length} facilities with pattern "${nextPattern}"`);
      } else {
        // All patterns processed
        hasMore = false;
      }
    }

    const nextCursor: CursorState | null = hasMore
      ? {
          type: "objectid",
          value: JSON.stringify(state),
        }
      : null;

    return {
      records,
      nextCursor,
      hasMore,
      metadata: {
        fetchedAt: new Date(),
        totalAvailable: state.facilities.length,
      },
    };
  }

  getInitialCursor(): CursorState {
    return { type: "offset", value: 0 };
  }

  getIncrementalCursor(_lastSync: Date | null): CursorState {
    return this.getInitialCursor();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.getBaseUrl()}/WaterWaste/SwimmingPool`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; PoolInspector/1.0)" },
          signal: AbortSignal.timeout(10000),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
