/**
 * San Diego County Scraper Adapter
 *
 * Scrapes pool permit/inspection records from the Accela Citizen Access portal.
 * URL: https://publicservices.sandiegocounty.gov/CitizenAccess/
 * Module: LUEG-DEH (Department of Environmental Health)
 *
 * Record types:
 * - "Pool - Parent" - Main pool facility records
 * - "Pool - Body of Water" - Individual pool/spa records
 *
 * The portal shows permit status but detailed inspection results require
 * clicking into individual records.
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

interface SanDiegoConfig extends AdapterConfig {
  searchTimeout: number;
  pageSize: number;
  recordType: string; // "Pool - Parent" or "Pool - Body of Water"
}

interface SanDiegoCursor {
  pageIndex: number;
  totalProcessed: number;
  searchExecuted: boolean;
}

const BASE_URL = "https://publicservices.sandiegocounty.gov/CitizenAccess";
const SEARCH_URL = `${BASE_URL}/Cap/CapHome.aspx?module=LUEG-DEH&TabName=LUEG-DEH`;

export class SanDiegoScraperAdapter extends BaseAdapter {
  protected config: SanDiegoConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(source: Source) {
    super(source);
    this.config = this.parseConfig(source.config);
  }

  parseConfig(raw: unknown): SanDiegoConfig {
    const config = (raw || {}) as Record<string, unknown>;
    return {
      searchTimeout: (config.searchTimeout as number) || 60000,
      pageSize: (config.pageSize as number) || 10, // Accela shows 10 per page
      batchSize: (config.batchSize as number) || 50,
      timeout: (config.timeout as number) || 90000,
      retryAttempts: (config.retryAttempts as number) || 3,
      recordType: (config.recordType as string) || "Pool - Parent",
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

  private async executeSearch(): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");

    console.log("Navigating to search page...");
    await this.page.goto(SEARCH_URL, {
      waitUntil: "networkidle",
      timeout: this.config.timeout,
    });

    await this.sleep(2000);

    // Wait for the search form to load
    console.log("Waiting for search form...");
    await this.page.waitForSelector("#ctl00_PlaceHolderMain_generalSearchForm_txtGSPermitNumber", {
      timeout: this.config.searchTimeout,
    }).catch(() => {
      console.log("Main search form not found, trying alternative selectors...");
    });

    // Try to find and select record type dropdown
    console.log(`Setting record type to: ${this.config.recordType}`);

    // Accela has multiple possible form layouts - try different selectors
    const recordTypeSelectors = [
      "#ctl00_PlaceHolderMain_generalSearchForm_ddlGSPermitType",
      "select[id*='PermitType']",
      "select[id*='RecordType']",
    ];

    let recordTypeSelected = false;
    for (const selector of recordTypeSelectors) {
      try {
        const dropdown = await this.page.$(selector);
        if (dropdown) {
          // First, try to select by visible text
          await this.page.selectOption(selector, { label: this.config.recordType });
          recordTypeSelected = true;
          console.log(`Selected record type using selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!recordTypeSelected) {
      console.log("Could not find record type dropdown, proceeding with general search");
    }

    await this.sleep(1000);

    // Click search button
    console.log("Clicking search button...");
    const searchButtonSelectors = [
      "#ctl00_PlaceHolderMain_btnNewSearch",
      "a[id*='btnNewSearch']",
      "input[value='Search']",
      "button:has-text('Search')",
      "a:has-text('Search')",
    ];

    let searchClicked = false;
    for (const selector of searchButtonSelectors) {
      try {
        const btn = await this.page.$(selector);
        if (btn) {
          await btn.click();
          searchClicked = true;
          console.log(`Clicked search using selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!searchClicked) {
      // Try pressing Enter on a form field
      await this.page.keyboard.press("Enter");
      console.log("Pressed Enter to submit form");
    }

    // Wait for results to load
    console.log("Waiting for search results...");
    await this.sleep(3000);

    // Wait for results table or "no results" message
    try {
      await Promise.race([
        this.page.waitForSelector("table[id*='GridView']", { timeout: 30000 }),
        this.page.waitForSelector(".ACA_TabRow", { timeout: 30000 }),
        this.page.waitForSelector("#ctl00_PlaceHolderMain_dgvPermitList", { timeout: 30000 }),
      ]);
      console.log("Results loaded");
    } catch (e) {
      console.log("No standard results table found, checking page content...");
    }
  }

  private async goToPage(pageIndex: number): Promise<void> {
    if (!this.page || pageIndex === 0) return;

    console.log(`Navigating to page ${pageIndex + 1}...`);

    // Accela pagination is typically at the bottom with page numbers
    // Try to find and click the specific page number
    const pageNum = pageIndex + 1;

    const paginationSelectors = [
      `a[href*='Page$${pageNum}']`,
      `a:has-text('${pageNum}')`,
      `span:has-text('${pageNum}')`,
    ];

    for (const selector of paginationSelectors) {
      try {
        // Look within pagination area
        const paginationArea = await this.page.$(".aca_pagination, .ACA_Pagination, [id*='Pager']");
        if (paginationArea) {
          const pageLink = await paginationArea.$(selector);
          if (pageLink) {
            await pageLink.click();
            await this.sleep(2000);
            console.log(`Navigated to page ${pageNum}`);
            return;
          }
        }
      } catch (e) {
        // Try next approach
      }
    }

    // Try using JavaScript postback if available
    try {
      await this.page.evaluate((pn) => {
        // Accela often uses __doPostBack for pagination
        // @ts-ignore
        if (typeof __doPostBack === "function") {
          // @ts-ignore
          __doPostBack("ctl00$PlaceHolderMain$dgvPermitList", `Page$${pn}`);
        }
      }, pageNum);
      await this.sleep(2000);
    } catch (e) {
      console.log(`Could not navigate to page ${pageNum}`);
    }
  }

  private async parseResultsPage(): Promise<ParsedRecord[]> {
    if (!this.page) throw new Error("Browser not initialized");

    const records: ParsedRecord[] = [];

    // Try multiple table selectors that Accela might use
    const tableSelectors = [
      "#ctl00_PlaceHolderMain_dgvPermitList",
      "table[id*='GridView']",
      "table[id*='PermitList']",
      ".ACA_Grid_Row",
    ];

    let table = null;
    for (const selector of tableSelectors) {
      table = await this.page.$(selector);
      if (table) {
        console.log(`Found results table: ${selector}`);
        break;
      }
    }

    if (!table) {
      // Try to find data rows directly
      const rows = await this.page.$$("tr.ACA_TabRow_Odd, tr.ACA_TabRow_Even, tr[class*='Row']");
      if (rows.length > 0) {
        console.log(`Found ${rows.length} data rows`);
        for (const row of rows) {
          try {
            const record = await this.parseRow(row);
            if (record) records.push(record);
          } catch (e) {
            // Skip problematic rows
          }
        }
        return records;
      }

      console.log("No results table found on page");
      return records;
    }

    // Parse table rows
    const rows = await table.$$("tr");
    console.log(`Found ${rows.length} rows in table`);

    for (let i = 1; i < rows.length; i++) {
      // Skip header row
      try {
        const record = await this.parseRow(rows[i]);
        if (record) records.push(record);
      } catch (e) {
        // Skip problematic rows
      }
    }

    return records;
  }

  private async parseRow(row: any): Promise<ParsedRecord | null> {
    const cells = await row.$$("td");
    if (cells.length < 4) return null;

    // Accela typical columns: Date, Record Number, Record Type, Description, Project Name, Status
    // Get text content from cells
    const cellTexts: string[] = [];
    for (const cell of cells) {
      const text = ((await cell.textContent()) || "").trim();
      cellTexts.push(text);
    }

    // Skip if this looks like a header row
    if (cellTexts[0]?.toLowerCase().includes("date") ||
        cellTexts[1]?.toLowerCase().includes("record")) {
      return null;
    }

    // Try to extract record link for more details
    let recordUrl: string | null = null;
    try {
      const link = await cells[1]?.$("a");
      if (link) {
        recordUrl = await link.getAttribute("href");
      }
    } catch (e) {
      // No link found
    }

    // Parse fields based on typical Accela structure
    const dateStr = cellTexts[0] || "";
    const recordId = cellTexts[1] || "";
    const recordType = cellTexts[2] || "";
    const description = cellTexts[3] || "";
    const projectName = cellTexts[4] || "";
    const status = cellTexts[5] || "";

    // Skip if no valid record ID
    if (!recordId || recordId.length < 5) return null;

    // Generate external ID
    const externalId = `sd_${recordId}`.replace(/[^a-zA-Z0-9_-]/g, "_");

    return {
      externalId,
      recordId,
      recordType,
      date: dateStr,
      description,
      projectName,
      status,
      recordUrl,
    };
  }

  private async getTotalPages(): Promise<number> {
    if (!this.page) return 1;

    try {
      // Look for pagination info like "Page 1 of 100" or total count
      const pageText = await this.page.textContent(".aca_pagination, [id*='Pager'], .ACA_Pagination");
      if (pageText) {
        const match = pageText.match(/of\s+(\d+)/i);
        if (match) {
          return parseInt(match[1], 10);
        }
      }

      // Count pagination links
      const pageLinks = await this.page.$$(".aca_pagination a, [id*='Pager'] a");
      if (pageLinks.length > 0) {
        let maxPage = 1;
        for (const link of pageLinks) {
          const text = (await link.textContent()) || "";
          const pageNum = parseInt(text, 10);
          if (!isNaN(pageNum) && pageNum > maxPage) {
            maxPage = pageNum;
          }
        }
        return maxPage;
      }
    } catch (e) {
      // Fall back to 1
    }

    return 1;
  }

  private async hasNextPage(currentPage: number): Promise<boolean> {
    const totalPages = await this.getTotalPages();
    return currentPage < totalPages - 1;
  }

  async fetch(cursor: CursorState | null): Promise<FetchResult> {
    await this.initBrowser();

    let state: SanDiegoCursor;
    if (cursor?.type === "objectid" && typeof cursor.value === "string") {
      state = JSON.parse(cursor.value) as SanDiegoCursor;
    } else {
      state = {
        pageIndex: 0,
        totalProcessed: 0,
        searchExecuted: false,
      };
    }

    const records: RawPayload[] = [];

    try {
      // Execute search if not done yet or if we need to re-navigate
      if (!state.searchExecuted || state.pageIndex === 0) {
        await this.executeSearch();
        state.searchExecuted = true;
      } else {
        // Navigate to the correct page
        await this.page!.goto(SEARCH_URL, {
          waitUntil: "networkidle",
          timeout: this.config.timeout,
        });
        await this.executeSearch();
        if (state.pageIndex > 0) {
          await this.goToPage(state.pageIndex);
        }
      }

      // Parse current page
      console.log(`Parsing page ${state.pageIndex + 1}...`);
      const pageRecords = await this.parseResultsPage();
      console.log(`Found ${pageRecords.length} records on page ${state.pageIndex + 1}`);

      // Convert to RawPayload format
      for (const record of pageRecords) {
        // Try to determine if this is a pool-related record
        const isPool =
          record.recordType?.toLowerCase().includes("pool") ||
          record.description?.toLowerCase().includes("pool") ||
          record.projectName?.toLowerCase().includes("pool");

        if (!isPool && this.config.recordType.toLowerCase().includes("pool")) {
          continue; // Skip non-pool records if we're specifically looking for pools
        }

        records.push({
          externalId: record.externalId,
          data: {
            recordId: record.recordId,
            recordType: record.recordType,
            facilityName: record.projectName || record.description || "Unknown Pool",
            description: record.description,
            status: record.status,
            dateStr: record.date,
            recordUrl: record.recordUrl ? `${BASE_URL}${record.recordUrl}` : null,
            state: "CA",
            county: "San Diego",
          },
        });

        state.totalProcessed++;
      }

      // Determine if there are more pages
      const hasMore = await this.hasNextPage(state.pageIndex);
      let nextCursor: CursorState | null = null;

      if (hasMore) {
        state.pageIndex++;
        nextCursor = {
          type: "objectid",
          value: JSON.stringify(state),
        };
        console.log(`Has more pages, next page: ${state.pageIndex + 1}`);
      }

      return {
        records,
        nextCursor,
        hasMore,
        metadata: {
          fetchedAt: new Date(),
          pageIndex: state.pageIndex,
          totalProcessed: state.totalProcessed,
          recordsOnPage: pageRecords.length,
        },
      };
    } catch (error) {
      console.error("Error during fetch:", error);
      // Return what we have so far
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
      await this.page!.goto(SEARCH_URL, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Check if the page has the search form
      const hasForm = await this.page!.$("form, #ctl00_PlaceHolderMain_generalSearchForm");
      await this.cleanup();
      return !!hasForm;
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
interface ParsedRecord {
  externalId: string;
  recordId: string;
  recordType: string;
  date: string;
  description: string;
  projectName: string;
  status: string;
  recordUrl: string | null;
}
