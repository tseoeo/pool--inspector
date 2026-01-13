import type { Source } from "@prisma/client";
import { BaseAdapter } from "./base";
import type {
  CursorState,
  FetchResult,
  AdapterConfig,
  RawPayload,
} from "@/types/ingestion";
import { withRetry } from "../utils/retry";

interface SocrataConfig extends AdapterConfig {
  resource: string;
  updatedAtField: string;
  orderByField: string;
  idField: string;
}

interface SocrataRecord {
  [key: string]: unknown;
}

export class SocrataAdapter extends BaseAdapter {
  protected config: SocrataConfig;

  constructor(source: Source) {
    super(source);
    this.config = this.parseConfig(source.config);
  }

  parseConfig(raw: unknown): SocrataConfig {
    const config = (raw || {}) as Record<string, unknown>;
    return {
      resource: (config.resource as string) || "",
      updatedAtField: (config.updatedAtField as string) || ":updated_at",
      orderByField: (config.orderByField as string) || "inspection_date",
      idField: (config.idField as string) || "facility_id",
      batchSize: (config.batchSize as number) || 1000,
      timeout: (config.timeout as number) || 30000,
      retryAttempts: (config.retryAttempts as number) || 3,
    };
  }

  async fetch(cursor: CursorState | null): Promise<FetchResult> {
    const params = new URLSearchParams({
      $limit: String(this.config.batchSize),
      $order: this.config.orderByField,
    });

    if (cursor) {
      if (cursor.type === "offset") {
        params.set("$offset", String(cursor.value));
      } else if (cursor.type === "timestamp" && cursor.field) {
        params.set("$where", `${cursor.field} > '${cursor.value}'`);
        params.set("$order", cursor.field);
      }
    }

    const url = `${this.source.endpoint}?${params.toString()}`;

    const data = await withRetry(
      async () => {
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            "X-App-Token": process.env.SOCRATA_APP_TOKEN || "",
          },
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          throw new Error(`Socrata API error: ${response.status}`);
        }

        return response.json() as Promise<SocrataRecord[]>;
      },
      { attempts: this.config.retryAttempts }
    );

    const records: RawPayload[] = data.map((record) => {
      // Create a unique external ID from facility_id + inspection_date
      const facilityId = record[this.config.idField] || record.facility_id;
      const inspectionDate = record.inspection_date;
      const externalId = `${facilityId}_${inspectionDate}`;

      return {
        externalId,
        data: record,
      };
    });

    const hasMore = records.length === this.config.batchSize;
    const currentOffset =
      cursor?.type === "offset" ? (cursor.value as number) : 0;

    const nextCursor: CursorState | null = hasMore
      ? {
          type: "offset",
          value: currentOffset + records.length,
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

  getIncrementalCursor(lastSync: Date | null): CursorState {
    // Default to 48 hours ago to handle any missed records
    const since = lastSync
      ? new Date(lastSync.getTime() - 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 48 * 60 * 60 * 1000);

    return {
      type: "timestamp",
      value: since.toISOString(),
      field: this.config.updatedAtField,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.source.endpoint}?$limit=1`;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
