import type { Source } from "@prisma/client";
import { BaseAdapter } from "./base";
import type {
  CursorState,
  FetchResult,
  AdapterConfig,
  RawPayload,
} from "@/types/ingestion";
import { withRetry } from "../utils/retry";

interface GeorgiaTylerConfig extends AdapterConfig {
  permitTypeFilter: string; // Base64 encoded filter value
  pageSize: number;
}

interface GeorgiaFacility {
  id: string; // Base64 encoded facility ID
  name: string;
  mapAddress: string;
  columns: {
    "0": string; // Address
    "1": string; // Phone
    "2": string; // Permit Type
    "3": string; // Permit Number
    "4": string; // Last Inspection Score
    "5": string; // Last Inspection Date
    "6": string; // Contact info
  };
}

/**
 * Adapter for Georgia Tyler Technologies Environmental Health API
 *
 * This API uses Base64-encoded filter values and returns paginated results.
 * The search endpoint returns facilities with their most recent inspection.
 *
 * API endpoints:
 * - GET /search/{filters}/page - List facilities with latest inspection
 * - GET /inspectionsData/{facilityId} - Full inspection history (not used in this adapter)
 */
export class GeorgiaTylerAdapter extends BaseAdapter {
  protected config: GeorgiaTylerConfig;

  constructor(source: Source) {
    super(source);
    this.config = this.parseConfig(source.config);
  }

  parseConfig(raw: unknown): GeorgiaTylerConfig {
    const config = (raw || {}) as Record<string, unknown>;
    return {
      // "Swimming Pool" base64 encoded = U3dpbW1pbmcgUG9vbA==
      permitTypeFilter: (config.permitTypeFilter as string) || "U3dpbW1pbmcgUG9vbA==",
      pageSize: (config.pageSize as number) || 5, // API returns 5 per page
      batchSize: (config.batchSize as number) || 5,
      timeout: (config.timeout as number) || 30000,
      retryAttempts: (config.retryAttempts as number) || 3,
    };
  }

  async fetch(cursor: CursorState | null): Promise<FetchResult> {
    const page = cursor?.type === "offset" ? (cursor.value as number) : 0;

    // Build filter object with Base64-encoded permit type
    const filterObj = {
      permitType: this.config.permitTypeFilter,
      keyword: "",
    };
    const encodedFilter = encodeURIComponent(JSON.stringify(filterObj));

    const url = `${this.source.endpoint}/API/index.cfm/search/${encodedFilter}/${page}`;

    const data = await withRetry(
      async () => {
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          throw new Error(`Georgia Tyler API error: ${response.status}`);
        }

        return response.json() as Promise<GeorgiaFacility[]>;
      },
      { attempts: this.config.retryAttempts }
    );

    const records: RawPayload[] = data.map((facility) => {
      // Parse inspection date from "Last Inspection Date: MM-DD-YYYY"
      const dateMatch = facility.columns["5"]?.match(/(\d{2}-\d{2}-\d{4})/);
      const inspectionDate = dateMatch ? dateMatch[1] : null;

      // Create unique external ID from facility ID + inspection date
      const externalId = `${facility.id}_${inspectionDate || "unknown"}`;

      // Parse address components from mapAddress
      // Format: "123 MAIN ST \r\nCITY, GA 30000"
      const addressParts = facility.mapAddress.split(/\r?\n/);
      const streetAddress = addressParts[0]?.trim() || "";
      const cityStateZip = addressParts[1]?.trim() || "";

      // Parse city, state, zip from "CITY, GA 30000"
      const cityStateMatch = cityStateZip.match(/^(.+),\s*(\w{2})\s*(\d{5}(?:-\d{4})?)?$/);
      const city = cityStateMatch?.[1] || "";
      const state = cityStateMatch?.[2] || "GA";
      const zip = cityStateMatch?.[3] || null;

      // Parse score from "Last Inspection Score: 100"
      const scoreMatch = facility.columns["4"]?.match(/(\d+)/);
      const score = scoreMatch ? scoreMatch[1] : null;

      // Parse permit number from "Permit Number: XXX"
      const permitMatch = facility.columns["3"]?.match(/Permit Number:\s*(.+)/);
      const permitNumber = permitMatch?.[1]?.trim() || null;

      // Decode facility ID from base64 for internal use
      let decodedFacilityId = facility.id;
      try {
        decodedFacilityId = Buffer.from(facility.id, "base64").toString("utf8");
      } catch {
        // Keep original if decode fails
      }

      return {
        externalId,
        data: {
          facilityId: decodedFacilityId,
          facilityIdEncoded: facility.id,
          facilityName: facility.name,
          streetAddress,
          city,
          state,
          zip,
          phone: facility.columns["1"]?.replace("Phone Number: ", "").trim() || null,
          permitType: facility.columns["2"]?.replace("Permit Type: ", "").trim() || null,
          permitNumber,
          inspectionDate,
          score,
          rawMapAddress: facility.mapAddress,
          rawColumns: facility.columns,
        },
      };
    });

    const hasMore = records.length === this.config.pageSize;
    const nextCursor: CursorState | null = hasMore
      ? {
          type: "offset",
          value: page + 1,
        }
      : null;

    return {
      records,
      nextCursor,
      hasMore,
      metadata: { fetchedAt: new Date() },
    };
  }

  getInitialCursor(): CursorState {
    return { type: "offset", value: 0 };
  }

  getIncrementalCursor(_lastSync: Date | null): CursorState {
    // For incremental, start from page 0 since results are ordered by most recent
    // The Tyler API doesn't support date filtering, so we fetch recent pages
    return { type: "offset", value: 0 };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const filterObj = {
        permitType: this.config.permitTypeFilter,
        keyword: "",
      };
      const encodedFilter = encodeURIComponent(JSON.stringify(filterObj));
      const url = `${this.source.endpoint}/API/index.cfm/search/${encodedFilter}/0`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return false;

      const data = await response.json();
      return Array.isArray(data) && data.length > 0;
    } catch {
      return false;
    }
  }
}
