/**
 * Mecklenburg County NC Scraper Adapter
 *
 * Scrapes pool inspection records from the NC CDP Environmental Health portal.
 * URL: https://public.cdpehs.com/NCENVPBL/
 *
 * This is a statewide NC system - Mecklenburg County is ESTTST_CTY=60
 *
 * Pool establishment types include:
 * - 53: Year-Round Swimming Pool
 * - 54: Seasonal Swimming Pool (likely)
 * - Other spa/pool types
 *
 * The portal shows:
 * - Facility name, address, state ID
 * - Inspection date, score, grade
 * - Links to violation details and PDF reports
 */

import type { Source } from "@prisma/client";
import { BaseAdapter } from "./base";
import type {
  CursorState,
  FetchResult,
  AdapterConfig,
  RawPayload,
} from "@/types/ingestion";
import { chromium, type Browser, type Page } from "playwright";

interface MecklenburgConfig extends AdapterConfig {
  countyCode: string; // ESTTST_CTY value (60 for Mecklenburg)
  poolTypes: string[]; // Establishment type names to filter for
  searchTimeout: number;
}

interface MecklenburgCursor {
  pageIndex: number;
  totalProcessed: number;
}

const BASE_URL = "https://public.cdpehs.com/NCENVPBL/ESTABLISHMENT";
const LIST_URL = `${BASE_URL}/ShowESTABLISHMENTTablePage.aspx`;

export class MecklenburgScraperAdapter extends BaseAdapter {
  protected config: MecklenburgConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(source: Source) {
    super(source);
    this.config = this.parseConfig(source.config);
  }

  parseConfig(raw: unknown): MecklenburgConfig {
    const config = (raw || {}) as Record<string, unknown>;
    return {
      countyCode: (config.countyCode as string) || "60", // Mecklenburg = 60
      poolTypes: (config.poolTypes as string[]) || [
        "Swimming Pool",
        "Pool",
        "Spa",
        "Aquatic",
      ],
      searchTimeout: (config.searchTimeout as number) || 60000,
      batchSize: (config.batchSize as number) || 50,
      timeout: (config.timeout as number) || 90000,
      retryAttempts: (config.retryAttempts as number) || 3,
    };
  }

  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ["--disable-blink-features=AutomationControlled"],
      });
      const context = await this.browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 900 },
      });
      this.page = await context.newPage();
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async navigateToPoolResults(pageIndex: number = 0): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");

    const url = `${LIST_URL}?ESTTST_CTY=${this.config.countyCode}`;
    console.log(`Navigating to: ${url}`);

    await this.page.goto(url, {
      waitUntil: "networkidle",
      timeout: this.config.timeout,
    });

    await this.sleep(2000);

    // Try to filter by establishment type containing "Pool"
    // First, let's try to select pool-related types from the dropdown
    try {
      const estTypeDropdown = await this.page.$(
        "select[id*='ESTTYP'], select[name*='ESTTYP'], select[id*='EstablishmentType']"
      );
      if (estTypeDropdown) {
        // Get all options and find pool-related ones
        const options = await estTypeDropdown.$$("option");
        for (const option of options) {
          const text = ((await option.textContent()) || "").toLowerCase();
          if (
            text.includes("pool") ||
            text.includes("swimming") ||
            text.includes("aquatic")
          ) {
            const value = await option.getAttribute("value");
            if (value) {
              console.log(`Found pool type: ${text} (value: ${value})`);
              await this.page.selectOption(
                "select[id*='ESTTYP'], select[name*='ESTTYP'], select[id*='EstablishmentType']",
                value
              );
              break;
            }
          }
        }
      }
    } catch (e) {
      console.log("Could not filter by establishment type dropdown");
    }

    // Click search button
    const searchBtn = await this.page.$(
      "input[value='Search'], button:has-text('Search'), a:has-text('Search')"
    );
    if (searchBtn) {
      await searchBtn.click();
      await this.sleep(3000);
    }

    // Wait for results table
    await this.page.waitForSelector("table, .grid, [id*='Grid']", {
      timeout: this.config.searchTimeout,
    });

    // Navigate to specific page if needed
    if (pageIndex > 0) {
      await this.goToPage(pageIndex);
    }
  }

  private async goToPage(pageIndex: number): Promise<void> {
    if (!this.page || pageIndex === 0) return;

    console.log(`Navigating to page ${pageIndex + 1}...`);

    // Try different pagination approaches
    const pageNum = pageIndex + 1;

    // Look for page number links
    const pageLink = await this.page.$(
      `a:has-text('${pageNum}'), [onclick*='${pageNum}']`
    );
    if (pageLink) {
      await pageLink.click();
      await this.sleep(2000);
      return;
    }

    // Try "Next" button multiple times
    for (let i = 0; i < pageIndex; i++) {
      const nextBtn = await this.page.$(
        "a:has-text('Next'), a:has-text('>'), [id*='Next']"
      );
      if (nextBtn) {
        await nextBtn.click();
        await this.sleep(1500);
      }
    }
  }

  private async parseResultsPage(): Promise<ParsedInspection[]> {
    if (!this.page) throw new Error("Browser not initialized");

    const inspections: ParsedInspection[] = [];

    // Find the main data table
    const tables = await this.page.$$("table");
    let dataTable = null;

    for (const table of tables) {
      const rows = await table.$$("tr");
      if (rows.length > 5) {
        // Likely the data table
        dataTable = table;
        break;
      }
    }

    if (!dataTable) {
      console.log("No data table found");
      return inspections;
    }

    const rows = await dataTable.$$("tr");
    console.log(`Found ${rows.length} rows in table`);

    // Skip header row(s)
    for (let i = 1; i < rows.length; i++) {
      try {
        const row = rows[i];
        const cells = await row.$$("td");

        if (cells.length < 5) continue;

        // Parse cell contents
        const cellTexts: string[] = [];
        for (const cell of cells) {
          cellTexts.push(((await cell.textContent()) || "").trim());
        }

        // Expected structure:
        // [Inspection Date, Premises Name, Address, State ID, Est Type, Score, Grade, Inspector, Links]
        const inspectionDate = cellTexts[0] || "";
        const premisesName = cellTexts[1] || "";
        const address = cellTexts[2] || "";
        const stateId = cellTexts[3] || "";
        const estType = cellTexts[4] || "";
        const score = cellTexts[5] || "";
        const grade = cellTexts[6] || "";

        // Filter for pool-related establishments
        const isPool = this.config.poolTypes.some(
          (type) =>
            estType.toLowerCase().includes(type.toLowerCase()) ||
            premisesName.toLowerCase().includes(type.toLowerCase())
        );

        if (!isPool) continue;

        // Skip if no valid data
        if (!premisesName || premisesName.length < 3) continue;

        // Generate external ID
        const externalId = `meck_${stateId || premisesName.replace(/\s+/g, "_")}_${inspectionDate.replace(/\//g, "-")}`;

        // Try to get detail link
        let detailUrl: string | null = null;
        try {
          const link = await cells[1]?.$("a");
          if (link) {
            detailUrl = await link.getAttribute("href");
          }
        } catch (e) {
          // No link
        }

        inspections.push({
          externalId,
          premisesName,
          address,
          stateId,
          establishmentType: estType,
          inspectionDate,
          score,
          grade,
          detailUrl,
        });
      } catch (e) {
        // Skip problematic rows
      }
    }

    return inspections;
  }

  private async hasNextPage(): Promise<boolean> {
    if (!this.page) return false;

    // Look for "Next" link or more pages indicator
    const nextLink = await this.page.$(
      "a:has-text('Next'), a:has-text('>'), [id*='Next']:not([disabled])"
    );
    return nextLink !== null;
  }

  private async getTotalCount(): Promise<number> {
    if (!this.page) return 0;

    try {
      const pageText = await this.page.textContent("body");
      // Look for patterns like "of 1234" or "1234 Items"
      const match = pageText?.match(/of\s+(\d+)|(\d+)\s+Items/i);
      if (match) {
        return parseInt(match[1] || match[2], 10);
      }
    } catch (e) {
      // Ignore
    }

    return 0;
  }

  async fetch(cursor: CursorState | null): Promise<FetchResult> {
    await this.initBrowser();

    let state: MecklenburgCursor;
    if (cursor?.type === "objectid" && typeof cursor.value === "string") {
      state = JSON.parse(cursor.value) as MecklenburgCursor;
    } else {
      state = {
        pageIndex: 0,
        totalProcessed: 0,
      };
    }

    const records: RawPayload[] = [];

    try {
      // Navigate to results
      console.log(`Fetching page ${state.pageIndex + 1}...`);
      await this.navigateToPoolResults(state.pageIndex);

      // Get total count for progress tracking
      const totalCount = await this.getTotalCount();
      if (totalCount > 0) {
        console.log(`Total records in database: ${totalCount}`);
      }

      // Parse current page
      const pageInspections = await this.parseResultsPage();
      console.log(
        `Found ${pageInspections.length} pool inspections on page ${state.pageIndex + 1}`
      );

      // Convert to RawPayload format
      for (const insp of pageInspections) {
        records.push({
          externalId: insp.externalId,
          data: {
            stateId: insp.stateId,
            facilityName: insp.premisesName,
            address: insp.address,
            city: "Charlotte", // Mecklenburg County encompasses Charlotte
            state: "NC",
            establishmentType: insp.establishmentType,
            inspectionDate: insp.inspectionDate,
            score: insp.score,
            grade: insp.grade,
            detailUrl: insp.detailUrl
              ? `https://public.cdpehs.com${insp.detailUrl}`
              : null,
          },
        });

        state.totalProcessed++;
      }

      // Check for more pages
      const hasMore = await this.hasNextPage();
      let nextCursor: CursorState | null = null;

      if (hasMore && pageInspections.length > 0) {
        state.pageIndex++;
        nextCursor = {
          type: "objectid",
          value: JSON.stringify(state),
        };
        console.log(`Has more pages, next: ${state.pageIndex + 1}`);
      }

      return {
        records,
        nextCursor,
        hasMore: hasMore && pageInspections.length > 0,
        metadata: {
          fetchedAt: new Date(),
          pageIndex: state.pageIndex,
          totalProcessed: state.totalProcessed,
          totalInDatabase: totalCount,
        },
      };
    } catch (error) {
      console.error("Error during fetch:", error);
      return {
        records,
        nextCursor: null,
        hasMore: false,
        metadata: {
          fetchedAt: new Date(),
          error: String(error),
        },
      };
    }
  }

  getInitialCursor(): CursorState {
    return { type: "offset", value: 0 };
  }

  getIncrementalCursor(_lastSync: Date | null): CursorState {
    return this.getInitialCursor();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.initBrowser();
      await this.page!.goto(
        `${LIST_URL}?ESTTST_CTY=${this.config.countyCode}`,
        {
          waitUntil: "networkidle",
          timeout: 30000,
        }
      );

      const hasTable = await this.page!.$("table");
      await this.cleanup();
      return !!hasTable;
    } catch (error) {
      console.error("Health check failed:", error);
      await this.cleanup();
      return false;
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

// Internal types
interface ParsedInspection {
  externalId: string;
  premisesName: string;
  address: string;
  stateId: string;
  establishmentType: string;
  inspectionDate: string;
  score: string;
  grade: string;
  detailUrl: string | null;
}
