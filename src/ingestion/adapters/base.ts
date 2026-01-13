import type { Source } from "@prisma/client";
import type {
  CursorState,
  FetchResult,
  AdapterConfig,
} from "@/types/ingestion";

export abstract class BaseAdapter {
  protected source: Source;
  protected config: AdapterConfig;

  constructor(source: Source) {
    this.source = source;
    this.config = this.parseConfig(source.config);
  }

  abstract parseConfig(config: unknown): AdapterConfig;

  // Fetch a batch of records starting from cursor
  abstract fetch(cursor: CursorState | null): Promise<FetchResult>;

  // Get initial cursor for backfill
  abstract getInitialCursor(): CursorState;

  // Get cursor for incremental (e.g., last 24 hours)
  abstract getIncrementalCursor(lastSync: Date | null): CursorState;

  // Validate source is accessible
  abstract healthCheck(): Promise<boolean>;

  // Get source info
  getSource(): Source {
    return this.source;
  }

  // Get adapter config
  getConfig(): AdapterConfig {
    return this.config;
  }
}
