import type { Source } from "@prisma/client";

export interface CursorState {
  type: "offset" | "timestamp" | "objectid";
  value: string | number;
  field?: string;
}

export interface RawPayload {
  externalId: string;
  data: Record<string, unknown>;
}

export interface FetchResult {
  records: RawPayload[];
  nextCursor: CursorState | null;
  hasMore: boolean;
  metadata: {
    totalAvailable?: number;
    fetchedAt: Date;
  };
}

export interface AdapterConfig {
  batchSize: number;
  timeout: number;
  retryAttempts: number;
}

export interface CanonicalFacility {
  externalId: string;
  rawName: string;
  rawAddress: string;
  rawCity: string | null;
  rawState: string | null;
  rawZip: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface CanonicalInspection {
  inspectionDate: Date;
  rawInspectionType: string | null;
  rawResult: string | null;
  rawScore: string | null;
  demerits: number | null;
  sourceUrl: string | null;
  reportUrl: string | null;
}

export interface CanonicalRecord {
  externalId: string;
  facility: CanonicalFacility;
  inspection: CanonicalInspection;
  rawPayload: Record<string, unknown>;
}

export interface IngestionOptions {
  sourceId: string;
  syncType: "BACKFILL" | "INCREMENTAL" | "MANUAL";
  maxRecords?: number;
}

export interface IngestionResult {
  success: boolean;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  error?: string;
}

export type TransformerFunction = (raw: RawPayload, source: Source) => CanonicalRecord;
