import type { Source } from "@prisma/client";
import { BaseAdapter } from "./base";
import type {
  CursorState,
  FetchResult,
  RawPayload,
} from "@/types/ingestion";
import { chromium, Browser, Page, BrowserContext } from 'playwright';

interface TarrantConfig {
  batchSize: number;
  timeout: number;
  retryAttempts: number;
}

interface TarrantCursorData {
  city: string;
  cityIndex: number;
  page: number;
  poolIndex: number;
}

// Cities covered by Tarrant County Public Health
const TARRANT_CITIES = [
  "Azle", "Bedford", "Benbrook", "Blue Mound", "Burleson", "Colleyville",
  "Crowley", "Dalworthington Gardens", "Everman", "Forest Hill", "Grapevine",
  "Haltom City", "Haslet", "Hurst", "Keller", "Lake Worth", "Mansfield",
  "Pantego", "Richland Hills", "River Oaks", "Saginaw", "Sansom Park",
  "Southlake", "Watauga", "Westlake", "Westworth Village", "White Settlement"
];

export class TarrantScraperAdapter extends BaseAdapter {
  protected config: TarrantConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(source: Source) {
    super(source);
    this.config = this.parseConfig(source.config);
  }

  parseConfig(raw: unknown): TarrantConfig {
    const config = (raw || {}) as Record<string, unknown>;
    return {
      batchSize: (config.batchSize as number) || 50,
      timeout: (config.timeout as number) || 30000,
      retryAttempts: (config.retryAttempts as number) || 3,
    };
  }

  private async initBrowser(): Promise<Page> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      });
    }
    return this.context!.newPage();
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
    }
  }

  private parseCursor(cursor: CursorState | null): TarrantCursorData {
    if (!cursor || cursor.type !== "offset") {
      return { city: TARRANT_CITIES[0], cityIndex: 0, page: 1, poolIndex: 0 };
    }
    try {
      const data = JSON.parse(String(cursor.value)) as TarrantCursorData;
      return data;
    } catch {
      return { city: TARRANT_CITIES[0], cityIndex: 0, page: 1, poolIndex: 0 };
    }
  }

  private createCursor(data: TarrantCursorData): CursorState {
    return { type: "offset", value: JSON.stringify(data) };
  }

  async fetch(cursor: CursorState | null): Promise<FetchResult> {
    const cursorData = this.parseCursor(cursor);
    const cityIndex = cursorData.cityIndex;
    const currentPage = cursorData.page;
    const poolIndex = cursorData.poolIndex;
    const city = TARRANT_CITIES[cityIndex];

    if (cityIndex >= TARRANT_CITIES.length) {
      return {
        records: [],
        nextCursor: null,
        hasMore: false,
        metadata: { fetchedAt: new Date() },
      };
    }

    const records: RawPayload[] = [];
    let page: Page | null = null;

    try {
      page = await this.initBrowser();

      // Navigate to search page
      await page.goto('https://poolinspection.tarrantcounty.com/Search.aspx', {
        waitUntil: 'networkidle',
        timeout: this.config.timeout
      });

      // Enter city and search
      await page.fill('input[name="ctl00$ContentPlaceHolder1$ContentPH1$txtCity"]', city);
      await page.click('input[value="Search"]');
      await page.waitForLoadState('networkidle');

      // Navigate to the correct page if not on page 1
      if (currentPage > 1) {
        const pageLink = page.locator(`a:has-text("${currentPage}")`).first();
        if (await pageLink.count() > 0) {
          await pageLink.click();
          await page.waitForLoadState('networkidle');
        }
      }

      // Get all pool links on current page
      const poolLinks = await page.locator('a[href*="lnkpool"]').all();
      console.log(`City: ${city}, Page: ${currentPage}, Pool links: ${poolLinks.length}`);

      // Process pools starting from poolIndex
      for (let i = poolIndex; i < poolLinks.length && records.length < this.config.batchSize; i++) {
        try {
          // Re-query the links (they may have been refreshed)
          const currentPoolLinks = await page.locator('a[href*="lnkpool"]').all();
          if (i >= currentPoolLinks.length) break;

          const poolName = await currentPoolLinks[i].textContent();

          // Click on the pool to get details
          await currentPoolLinks[i].click();
          await page.waitForLoadState('networkidle');

          // Extract pool details from the detail page (returns array of inspections)
          const inspections = await this.extractPoolDetails(page);

          if (inspections && inspections.length > 0) {
            for (const inspection of inspections) {
              // Create unique ID from facility ID + inspection date
              const dateStr = (inspection.inspectionDate as string)?.replace(/\//g, '-') || Date.now();
              const externalId = `tarrant-${inspection.facilityId}-${dateStr}`;

              records.push({
                externalId,
                data: inspection,
              });
            }
          }

          // Go back to results
          await page.goBack();
          await page.waitForLoadState('networkidle');

          // Small delay to be respectful
          await page.waitForTimeout(500);

        } catch (err) {
          console.error(`Error processing pool ${i} in ${city}:`, err);
          // Try to recover by going back to search
          await page.goto('https://poolinspection.tarrantcounty.com/Search.aspx', {
            waitUntil: 'networkidle'
          });
          await page.fill('input[name="ctl00$ContentPlaceHolder1$ContentPH1$txtCity"]', city);
          await page.click('input[value="Search"]');
          await page.waitForLoadState('networkidle');
        }
      }

      // Determine next cursor
      let nextCursor: CursorState | null = null;
      const hasNextPage = await page.locator('a:has-text("Next"), a:has-text(">")').count() > 0;

      if (poolIndex + records.length < poolLinks.length) {
        // More pools on current page
        nextCursor = this.createCursor({
          city,
          cityIndex,
          page: currentPage,
          poolIndex: poolIndex + records.length
        });
      } else if (hasNextPage) {
        // Move to next page
        nextCursor = this.createCursor({
          city,
          cityIndex,
          page: currentPage + 1,
          poolIndex: 0
        });
      } else if (cityIndex + 1 < TARRANT_CITIES.length) {
        // Move to next city
        nextCursor = this.createCursor({
          city: TARRANT_CITIES[cityIndex + 1],
          cityIndex: cityIndex + 1,
          page: 1,
          poolIndex: 0
        });
      }

      return {
        records,
        nextCursor,
        hasMore: nextCursor !== null,
        metadata: {
          fetchedAt: new Date(),
          city,
          page: currentPage,
        },
      };

    } catch (error) {
      console.error(`Error fetching from Tarrant County:`, error);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private async extractPoolDetails(page: Page): Promise<Record<string, unknown>[] | null> {
    try {
      await page.waitForSelector('table', { timeout: 5000 });

      // Parse URL parameters for additional data
      const url = new URL(page.url());
      const urlId = url.searchParams.get('ID');
      const urlResult = url.searchParams.get('Result');
      const invDesc = url.searchParams.get('InvDesc'); // Spa, Pool, etc.

      // Extract facility info from spans
      const facilityName = await page.locator('span[id*="lblSiteName"]').textContent().catch(() => null);
      const address = await page.locator('span[id*="lblAddress"]').textContent().catch(() => null);
      const cityStateZip = await page.locator('span[id*="lblCityStateZip"]').textContent().catch(() => null);

      // Parse city, state, zip
      let city = '', state = '', zip = '';
      if (cityStateZip) {
        const match = cityStateZip.match(/^([^,]+),\s*([A-Z]{2})\s*(\d{5})/);
        if (match) {
          city = match[1].trim();
          state = match[2];
          zip = match[3];
        }
      }

      // Extract inspection history from the table
      const inspections: Record<string, unknown>[] = [];

      // Find the inspection history table (has headers: Service Date, Service Type, Result)
      // Look at all tables and find the one with the inspection history
      const tables = await page.locator('table').all();

      for (const table of tables) {
        const rows = await table.locator('tr').all();
        let inHistoryTable = false;

        for (const row of rows) {
          // Check both td and th cells (header might use th)
          const cells = await row.locator('td, th').all();
          if (cells.length >= 3) {
            const cellTexts = await Promise.all(cells.map(c => c.textContent()));

            // Check for header row
            if (cellTexts[0]?.includes('Service Date') && cellTexts[1]?.includes('Service Type')) {
              inHistoryTable = true;
              continue;
            }

            // Parse data rows (only if we found the header)
            if (inHistoryTable && cellTexts[0]?.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
              const dateStr = cellTexts[0]?.trim();
              const inspType = cellTexts[1]?.trim();
              const result = cellTexts[2]?.trim();

              inspections.push({
                facilityId: urlId,
                facilityName: facilityName?.trim(),
                facilityType: invDesc,
                address: address?.trim(),
                city,
                state,
                zip,
                inspectionDate: dateStr,
                inspectionType: inspType,
                result,
              });
            }
          }
        }

        // If we found inspections in this table, stop looking
        if (inspections.length > 0) break;
      }

      return inspections.length > 0 ? inspections : null;
    } catch (err) {
      console.error('Error extracting pool details:', err);
      return null;
    }
  }

  getInitialCursor(): CursorState {
    return this.createCursor({
      city: TARRANT_CITIES[0],
      cityIndex: 0,
      page: 1,
      poolIndex: 0
    });
  }

  getIncrementalCursor(): CursorState {
    // For incremental, start from beginning but only get recent inspections
    return this.getInitialCursor();
  }

  async healthCheck(): Promise<boolean> {
    let page: Page | null = null;
    try {
      page = await this.initBrowser();
      await page.goto('https://poolinspection.tarrantcounty.com/', {
        waitUntil: 'networkidle',
        timeout: 10000
      });
      const title = await page.title();
      return title.includes('Tarrant');
    } catch {
      return false;
    } finally {
      if (page) await page.close();
      await this.closeBrowser();
    }
  }
}
