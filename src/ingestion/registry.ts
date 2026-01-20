import { AdapterType, Source } from "@prisma/client";
import { BaseAdapter } from "./adapters/base";
import { SocrataAdapter } from "./adapters/socrata";
import { ArcGISAdapter } from "./adapters/arcgis";
import { MaricopaScraperAdapter } from "./adapters/maricopa-scraper";
import { LACountyScraperAdapter } from "./adapters/la-county-scraper";
import { GeorgiaTylerAdapter } from "./adapters/georgia-tyler";
import type { TransformerFunction } from "@/types/ingestion";
import { transformAustin } from "./transformers/austin";
import { transformWebster } from "./transformers/webster";
import { transformMontgomeryMD } from "./transformers/montgomery-md";
import { transformNYC } from "./transformers/nyc";
import { transformMaricopa } from "./transformers/maricopa";
import { transformLACounty } from "./transformers/la-county";
import { transformGeorgia } from "./transformers/georgia";
import { transformLouisville } from "./transformers/louisville";
import { transformArlington } from "./transformers/arlington";
import { transformJacksonCountyOR } from "./transformers/jackson-county-or";

type AdapterClass = new (source: Source) => BaseAdapter;

const adapterMap: Record<AdapterType, AdapterClass> = {
  SOCRATA: SocrataAdapter,
  ARCGIS: ArcGISAdapter,
  CSV: SocrataAdapter, // Placeholder - TODO: implement CSV adapter
  MANUAL: SocrataAdapter, // Placeholder - TODO: implement manual adapter
  SCRAPER: MaricopaScraperAdapter, // Web scraper for Maricopa County
};

// Map jurisdiction slugs to transformers
const transformerMap: Record<string, TransformerFunction> = {
  "austin-tx": transformAustin,
  "webster-tx": transformWebster,
  "montgomery-county-md": transformMontgomeryMD,
  "new-york-city-ny": transformNYC,
  "maricopa-county-az": transformMaricopa,
  "la-county-ca": transformLACounty,
  "georgia-statewide": transformGeorgia,
  "louisville-ky": transformLouisville,
  "arlington-tx": transformArlington,
  "jackson-county-or": transformJacksonCountyOR,
};

// Map specific source IDs to scraper adapters (for SCRAPER type sources)
const scraperMap: Record<string, new (source: Source) => BaseAdapter> = {
  "maricopa-az-scraper-source": MaricopaScraperAdapter,
  "la-county-ca-scraper-source": LACountyScraperAdapter,
  "georgia-statewide-tyler-source": GeorgiaTylerAdapter,
};

export function getAdapter(source: Source): BaseAdapter {
  // For SCRAPER type, check if there's a specific adapter mapped by source ID
  if (source.adapterType === "SCRAPER") {
    const ScraperClass = scraperMap[source.id];
    if (ScraperClass) {
      return new ScraperClass(source);
    }
    // Fall back to Maricopa scraper as default (legacy behavior)
    return new MaricopaScraperAdapter(source);
  }

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
