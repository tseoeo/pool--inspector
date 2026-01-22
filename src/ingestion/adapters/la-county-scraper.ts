import type { Source } from "@prisma/client";
import { BaseAdapter } from "./base";
import type {
  CursorState,
  FetchResult,
  AdapterConfig,
  RawPayload,
} from "@/types/ingestion";
import { chromium, type Browser, type Page } from "playwright";

interface LACountyConfig extends AdapterConfig {
  searchTimeout: number;
  pageSize: number;
}

interface LACountyCursor {
  pageIndex: number;
  facilityIndex: number;
  totalProcessed: number;
}

// LA County eCompliance entry point
const GUEST_URL = "/servlet/guest?service=1&enterprise=1&qbItem=5";

export class LACountyScraperAdapter extends BaseAdapter {
  protected config: LACountyConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(source: Source) {
    super(source);
    this.config = this.parseConfig(source.config);
  }

  parseConfig(raw: unknown): LACountyConfig {
    const config = (raw || {}) as Record<string, unknown>;
    return {
      searchTimeout: (config.searchTimeout as number) || 30000,
      pageSize: (config.pageSize as number) || 50,
      batchSize: (config.batchSize as number) || 20,
      timeout: (config.timeout as number) || 60000,
      retryAttempts: (config.retryAttempts as number) || 3,
    };
  }

  private getBaseUrl(): string {
    return this.source.endpoint.replace(/\/$/, "");
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
        viewport: { width: 1280, height: 800 },
      });
      this.page = await context.newPage();
    }
  }

  private async navigateToResults(pageIndex: number = 0): Promise<void> {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }

    const url = `${this.getBaseUrl()}${GUEST_URL}`;
    console.log(`Navigating to: ${url}`);

    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: this.config.timeout,
    });

    // Wait for redirect to /ezsearch
    await this.page.waitForURL("**/ezsearch**", { timeout: this.config.searchTimeout });
    console.log("Redirected to:", this.page.url());

    // Wait for the data table to load
    await this.page.waitForSelector("table.table-bordered", {
      timeout: this.config.searchTimeout,
    });

    console.log("Results table loaded");

    // Navigate to the correct page if not on first page
    if (pageIndex > 0) {
      console.log(`Navigating to page ${pageIndex + 1}...`);
      await this.goToPage(pageIndex);
    }
  }

  private async goToPage(pageIndex: number): Promise<void> {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }

    // LA County uses JavaScript pagination: goPageIndex(n) where n is 0-indexed
    // We need to click through pages or call the JS function directly
    await this.page.evaluate((idx) => {
      // goPageIndex is a global function on the page
      const win = window as unknown as { goPageIndex?: (n: number) => void };
      if (typeof win.goPageIndex === "function") {
        win.goPageIndex(idx);
      }
    }, pageIndex);

    // Wait for table to reload
    await this.page.waitForTimeout(1000);
    await this.page.waitForSelector("table.table-bordered", {
      timeout: this.config.searchTimeout,
    });

    console.log(`Now on page ${pageIndex + 1}`);
  }

  private async hasNextPage(): Promise<boolean> {
    if (!this.page) {
      return false;
    }

    // Check for "Next" link or pagination indicator
    // LA County uses goPageIndex(n) links - check if there's a link to a higher page
    const paginationLinks = await this.page.$$("a[href*='goPageIndex']");
    if (paginationLinks.length === 0) {
      // Also check for onclick handlers
      const nextLink = await this.page.$("a:has-text('Next'), a:has-text('>')");
      return nextLink !== null;
    }

    // Find the highest page index available
    let maxPageIndex = 0;
    for (const link of paginationLinks) {
      const onclick = await link.getAttribute("onclick");
      const href = await link.getAttribute("href");
      const text = onclick || href || "";
      const match = text.match(/goPageIndex\((\d+)\)/);
      if (match) {
        const idx = parseInt(match[1], 10);
        if (idx > maxPageIndex) {
          maxPageIndex = idx;
        }
      }
    }

    // Get current page from URL or page state
    const currentUrl = this.page.url();
    const currentMatch = currentUrl.match(/pageIndex=(\d+)/);
    const currentPage = currentMatch ? parseInt(currentMatch[1], 10) : 0;

    return maxPageIndex > currentPage;
  }

  private async parseFacilityRows(): Promise<ParsedFacility[]> {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }

    const facilities: ParsedFacility[] = [];

    // Find the main data table with bordered class
    const dataTable = await this.page.$("table.table-bordered");
    if (!dataTable) {
      console.log("Data table not found");
      return facilities;
    }

    const rows = await dataTable.$$("tr");
    console.log(`Found ${rows.length} rows in data table`);

    // Skip header row and spacer rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Get cells - structure is: [Inspections button, Name, Date, Score, Address, City]
        const cells = await row.$$("td");

        // Skip rows with less than 6 cells (header/spacer rows)
        if (cells.length < 6) continue;

        // Parse each cell
        const name = ((await cells[1].textContent()) || "").trim();
        const dateStr = ((await cells[2].textContent()) || "").trim();
        const score = ((await cells[3].textContent()) || "").trim();
        const address = ((await cells[4].textContent()) || "").trim();
        const city = ((await cells[5].textContent()) || "").trim();

        // Skip rows without a valid name
        if (!name || name.length < 3) continue;

        // Get the inspections link (onclick handler from button)
        const inspButton = await cells[0].$("button, a.btn, input[type=button]");
        let detailUrl: string | null = null;
        if (inspButton) {
          const onclick = await inspButton.getAttribute("onclick");
          if (onclick) {
            // Extract URL from onclick like "window.location='/ezsearch?...';"
            const urlMatch = onclick.match(/window\.location\s*=\s*['"]([^'"]+)['"]/);
            if (urlMatch) {
              detailUrl = urlMatch[1];
            }
          }
        }

        // Generate external ID from name and address
        const externalId = `lac_${name}_${address}`.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 100);

        facilities.push({
          externalId,
          name,
          address,
          city,
          inspectionDate: dateStr,
          score,
          detailUrl,
        });
      } catch (error) {
        // Skip problematic rows
        console.error(`Error parsing row ${i}:`, error);
      }
    }

    return facilities;
  }

  private async getInspectionHistory(facility: ParsedFacility): Promise<InspectionRecord[]> {
    if (!this.page || !facility.detailUrl) {
      // Return a single record based on the main page data
      if (facility.inspectionDate) {
        return [{
          date: facility.inspectionDate,
          result: "Routine Inspection",
          score: facility.score || null,
        }];
      }
      return [];
    }

    try {
      const url = facility.detailUrl.startsWith("http")
        ? facility.detailUrl
        : `${this.getBaseUrl()}${facility.detailUrl}`;

      await this.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: this.config.searchTimeout,
      });

      // Wait for inspection table
      await this.page.waitForSelector("table", { timeout: 10000 });

      const inspections: InspectionRecord[] = [];

      // Parse inspection history table
      const tables = await this.page.$$("table.table-bordered, table.table-striped");
      for (const table of tables) {
        const rows = await table.$$("tr");
        for (const row of rows) {
          const cells = await row.$$("td");
          if (cells.length >= 2) {
            const dateText = (await cells[0].textContent()) || "";
            const resultText = (await cells[1]?.textContent()) || "";
            const scoreText = cells.length > 2 ? (await cells[2]?.textContent()) || "" : "";

            // Parse date
            const dateMatch = dateText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
            if (dateMatch) {
              inspections.push({
                date: dateMatch[1],
                result: resultText.trim(),
                score: scoreText.trim() || null,
              });
            }
          }
        }
      }

      return inspections.length > 0 ? inspections : [{
        date: facility.inspectionDate || "",
        result: "Routine Inspection",
        score: facility.score || null,
      }];
    } catch (error) {
      console.error(`Error getting inspection history for ${facility.name}:`, error);
      // Return single record from main page
      if (facility.inspectionDate) {
        return [{
          date: facility.inspectionDate,
          result: "Routine Inspection",
          score: facility.score || null,
        }];
      }
      return [];
    }
  }

  async fetch(cursor: CursorState | null): Promise<FetchResult> {
    await this.initBrowser();

    let state: LACountyCursor;
    if (cursor?.type === "objectid" && typeof cursor.value === "string") {
      state = JSON.parse(cursor.value) as LACountyCursor;
    } else {
      state = {
        pageIndex: 0,
        facilityIndex: 0,
        totalProcessed: 0,
      };
    }

    const records: RawPayload[] = [];

    try {
      // Navigate to results page (with pagination if needed)
      console.log(`Fetching LA County page ${state.pageIndex + 1}, facility index ${state.facilityIndex}`);
      await this.navigateToResults(state.pageIndex);

      // Parse facilities from the current page
      const facilities = await this.parseFacilityRows();
      console.log(`Parsed ${facilities.length} facilities on page ${state.pageIndex + 1}`);

      // Check if there's a next page BEFORE processing (similar to Houston fix)
      const nextPageExists = await this.hasNextPage();
      console.log(`Has next page: ${nextPageExists}`);

      // Process facilities starting from where we left off
      const startIndex = state.facilityIndex;
      const endIndex = Math.min(startIndex + this.config.batchSize, facilities.length);

      for (let i = startIndex; i < endIndex; i++) {
        const facility = facilities[i];

        // For now, just use the data from the main page
        const inspections = [{
          date: facility.inspectionDate,
          result: "Routine Inspection",
          score: facility.score || null,
        }];

        for (const inspection of inspections) {
          if (!inspection.date) continue;

          const externalId = `${facility.externalId}_${inspection.date.replace(/\//g, "-")}`;
          records.push({
            externalId,
            data: {
              facilityId: facility.externalId,
              facilityName: facility.name,
              facilityAddress: `${facility.address}, ${facility.city}`.trim().replace(/^,\s*|,\s*$/g, ""),
              street: facility.address,
              city: facility.city || "Los Angeles",
              state: "CA",
              zip: "", // LA County doesn't provide zip on main page
              poolType: "Pool",
              inspectionDate: inspection.date,
              inspectionResult: inspection.result,
              inspectionScore: inspection.score,
              sourceUrl: `${this.getBaseUrl()}/ezsearch`,
            },
          });
        }

        state.totalProcessed++;

        // Small delay between facilities
        await new Promise((r) => setTimeout(r, 100));
      }

      // Update cursor state
      state.facilityIndex = endIndex;

      // Determine if there's more data
      const finishedCurrentPage = endIndex >= facilities.length;
      let hasMore = false;
      let nextCursor: CursorState | null = null;

      if (!finishedCurrentPage) {
        // More facilities on this page
        hasMore = true;
        nextCursor = {
          type: "objectid",
          value: JSON.stringify(state),
        };
      } else if (nextPageExists) {
        // Move to next page
        hasMore = true;
        state.pageIndex++;
        state.facilityIndex = 0;
        nextCursor = {
          type: "objectid",
          value: JSON.stringify(state),
        };
        console.log(`Moving to page ${state.pageIndex + 1}`);
      }

      return {
        records,
        nextCursor,
        hasMore,
        metadata: {
          fetchedAt: new Date(),
          pageIndex: state.pageIndex,
          totalProcessed: state.totalProcessed,
          facilitiesOnPage: facilities.length,
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
      await this.page!.goto(`${this.getBaseUrl()}${GUEST_URL}`, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      // Wait for redirect
      await this.page!.waitForURL("**/ezsearch**", { timeout: 15000 });
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

// Type definitions for internal use
interface ParsedFacility {
  externalId: string;
  name: string;
  address: string;
  city: string;
  inspectionDate: string;
  score: string;
  detailUrl: string | null;
}

interface InspectionRecord {
  date: string;
  result: string;
  score: string | null;
}
