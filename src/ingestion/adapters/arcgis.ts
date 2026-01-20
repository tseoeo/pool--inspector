import type { Source } from "@prisma/client";
import { BaseAdapter } from "./base";
import type {
  CursorState,
  FetchResult,
  AdapterConfig,
  RawPayload,
} from "@/types/ingestion";
import { withRetry } from "../utils/retry";

interface ArcGISConfig extends AdapterConfig {
  layerId: number;
  maxRecordCount: number;
  objectIdField: string;
  whereClause?: string;
}

interface ArcGISFeature {
  attributes: Record<string, unknown>;
  geometry?: {
    x?: number;
    y?: number;
  };
}

interface ArcGISResponse {
  features?: ArcGISFeature[];
  exceededTransferLimit?: boolean;
  error?: {
    message: string;
    code: number;
  };
}

export class ArcGISAdapter extends BaseAdapter {
  protected config: ArcGISConfig;

  constructor(source: Source) {
    super(source);
    this.config = this.parseConfig(source.config);
  }

  parseConfig(raw: unknown): ArcGISConfig {
    const config = (raw || {}) as Record<string, unknown>;
    return {
      layerId: (config.layerId as number) || 0,
      maxRecordCount: (config.maxRecordCount as number) || 1000,
      objectIdField: (config.objectIdField as string) || "OBJECTID",
      whereClause: (config.whereClause as string) || undefined,
      batchSize: Math.min((config.batchSize as number) || 1000, 1000),
      timeout: (config.timeout as number) || 30000,
      retryAttempts: (config.retryAttempts as number) || 3,
    };
  }

  async fetch(cursor: CursorState | null): Promise<FetchResult> {
    // Build where clause: combine custom filter with pagination
    const baseWhere = this.config.whereClause || "1=1";
    let whereClause = baseWhere;
    if (cursor && cursor.type === "objectid") {
      whereClause = `(${baseWhere}) AND ${this.config.objectIdField} > ${cursor.value}`;
    }

    const params = new URLSearchParams({
      where: whereClause,
      outFields: "*",
      f: "json",
      resultRecordCount: String(this.config.batchSize),
      orderByFields: this.config.objectIdField,
      returnGeometry: "true",
    });

    // Ensure endpoint ends with /query or add it
    let endpoint = this.source.endpoint;
    if (!endpoint.endsWith("/query")) {
      endpoint = endpoint.replace(/\/$/, "") + "/query";
    }

    const url = `${endpoint}?${params.toString()}`;

    const data = await withRetry(
      async () => {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          throw new Error(`ArcGIS API error: ${response.status}`);
        }

        return response.json() as Promise<ArcGISResponse>;
      },
      { attempts: this.config.retryAttempts }
    );

    if (data.error) {
      throw new Error(`ArcGIS API error: ${data.error.message}`);
    }

    const records: RawPayload[] = (data.features || []).map((feature) => {
      const objectId = feature.attributes[this.config.objectIdField];

      // Merge geometry coordinates into attributes if available
      const mergedData: Record<string, unknown> = {
        ...feature.attributes,
      };

      if (feature.geometry) {
        mergedData._geometry_x = feature.geometry.x;
        mergedData._geometry_y = feature.geometry.y;
      }

      return {
        externalId: String(objectId),
        data: mergedData,
      };
    });

    // Use exceededTransferLimit to determine if more records exist
    const hasMore = data.exceededTransferLimit === true || records.length === this.config.batchSize;

    const lastObjectId =
      records.length > 0
        ? records[records.length - 1].data[this.config.objectIdField]
        : null;

    const nextCursor: CursorState | null =
      hasMore && lastObjectId
        ? { type: "objectid", value: lastObjectId as number }
        : null;

    return {
      records,
      nextCursor,
      hasMore,
      metadata: { fetchedAt: new Date() },
    };
  }

  getInitialCursor(): CursorState {
    return { type: "objectid", value: 0 };
  }

  getIncrementalCursor(): CursorState {
    // ArcGIS doesn't have reliable updated_at, so we re-fetch all
    // The 365-day rolling window handles this naturally
    return { type: "objectid", value: 0 };
  }

  async healthCheck(): Promise<boolean> {
    try {
      let endpoint = this.source.endpoint;
      if (endpoint.endsWith("/query")) {
        endpoint = endpoint.replace("/query", "");
      }
      const url = `${endpoint}?f=json`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
