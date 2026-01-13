import { AdapterType, Source } from "@prisma/client";
import { BaseAdapter } from "./adapters/base";
import { SocrataAdapter } from "./adapters/socrata";
import { ArcGISAdapter } from "./adapters/arcgis";
import type { TransformerFunction } from "@/types/ingestion";
import { transformAustin } from "./transformers/austin";
import { transformWebster } from "./transformers/webster";

type AdapterClass = new (source: Source) => BaseAdapter;

const adapterMap: Record<AdapterType, AdapterClass> = {
  SOCRATA: SocrataAdapter,
  ARCGIS: ArcGISAdapter,
  CSV: SocrataAdapter, // Placeholder - TODO: implement CSV adapter
  MANUAL: SocrataAdapter, // Placeholder - TODO: implement manual adapter
};

// Map jurisdiction slugs to transformers
const transformerMap: Record<string, TransformerFunction> = {
  "austin-tx": transformAustin,
  "webster-tx": transformWebster,
};

export function getAdapter(source: Source): BaseAdapter {
  const AdapterClass = adapterMap[source.adapterType];
  if (!AdapterClass) {
    throw new Error(`Unknown adapter type: ${source.adapterType}`);
  }
  return new AdapterClass(source);
}

export function getTransformer(jurisdictionSlug: string): TransformerFunction {
  const transformer = transformerMap[jurisdictionSlug];
  if (!transformer) {
    throw new Error(`Unknown jurisdiction slug: ${jurisdictionSlug}. No transformer registered.`);
  }
  return transformer;
}

export function registerTransformer(
  jurisdictionSlug: string,
  transformer: TransformerFunction
): void {
  transformerMap[jurisdictionSlug] = transformer;
}

export function getAllActiveAdapters(sources: Source[]): BaseAdapter[] {
  return sources.filter((s) => s.isActive).map((s) => getAdapter(s));
}
