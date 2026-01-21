/**
 * eBridge Scraper Adapter
 *
 * Scrapes pool inspection records from eBridge document management systems
 * used by Florida county health departments.
 *
 * Currently supports: Hillsborough County, FL
 *
 * eBridge is a document management system that stores ALL permit-related documents:
 * - Inspection reports
 * - Applications
 * - Correspondence
 * - Complaints
 * - Enforcement notices
 *
 * Config options:
 * - documentTypes: string[] - Filter to specific document types (e.g., ["Inspection"])
 *   If not set, all document types are fetched (can be 100x more records!)
 *
 * Example config:
 * {
 *   "fileCabinet": "HCHD",
 *   "program": "Swimming Pool",
 *   "documentTypes": ["Inspection"]  // Only fetch actual inspections
 * }
 */

import type { Source } from "@prisma/client";
import { BaseAdapter } from "./base";
import type {
  CursorState,
  FetchResult,
  RawPayload,
} from "@/types/ingestion";
import { chromium, Browser, Page, BrowserContext, Frame } from 'playwright';

interface EbridgeConfig {
  username: string;
  password: string;
  fileCabinet: string;
  program: string; // e.g., "Swimming Pool"
  documentTypes?: string[]; // Filter to specific types: ["Inspection"], ["Inspection", "Enforcement"], etc.
  batchSize: number;
  timeout: number;
  retryAttempts: number;
}

interface EbridgeCursorData {
  page: number;
  lastPermitNumber: string | null;
}

const DEFAULT_CONFIG: Partial<EbridgeConfig> = {
  username: 'public',
  password: 'publicuser',
  batchSize: 100,
  timeout: 60000,
};

export class EbridgeScraperAdapter extends BaseAdapter {
  protected config: EbridgeConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(source: Source) {
    super(source);
    this.config = this.parseConfig(source.config);
  }

  parseConfig(raw: unknown): EbridgeConfig {
    const config = (raw || {}) as Record<string, unknown>;
    return {
      username: (config.username as string) || DEFAULT_CONFIG.username!,
      password: (config.password as string) || DEFAULT_CONFIG.password!,
      fileCabinet: (config.fileCabinet as string) || '',
      program: (config.program as string) || 'Swimming Pool',
      documentTypes: config.documentTypes as string[] | undefined, // undefined = all types
      batchSize: (config.batchSize as number) || DEFAULT_CONFIG.batchSize!,
      timeout: (config.timeout as number) || DEFAULT_CONFIG.timeout!,
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

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private parseCursor(cursor: CursorState | null): EbridgeCursorData {
    if (!cursor || cursor.type !== "offset") {
      return { page: 1, lastPermitNumber: null };
    }
    try {
      return JSON.parse(String(cursor.value)) as EbridgeCursorData;
    } catch {
      return { page: 1, lastPermitNumber: null };
    }
  }

  private createCursor(data: EbridgeCursorData): CursorState {
    return { type: "offset", value: JSON.stringify(data) };
  }

  private async getSearchFrame(page: Page): Promise<Frame | null> {
    const frames = page.frames();
    for (const frame of frames) {
      if (frame.url().includes('search.aspx')) {
        return frame;
      }
    }
    return null;
  }

  private async getResultsFrame(page: Page): Promise<Frame | null> {
    const frames = page.frames();
    for (const frame of frames) {
      const url = frame.url();
      if (url.includes('results.aspx') || url.includes('search.aspx')) {
        // Check if this frame has result rows
        const rows = await frame.locator('tr[onclick], tr.row, tr[class*="Row"]').count();
        if (rows > 0) return frame;
      }
    }
    return null;
  }

  async fetch(cursor: CursorState | null): Promise<FetchResult> {
    const cursorData = this.parseCursor(cursor);
    const records: RawPayload[] = [];
    let page: Page | null = null;

    try {
      page = await this.initBrowser();

      // Step 1: Login
      console.log('Logging in to eBridge...');
      await page.goto(this.source.endpoint, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout
      });

      await page.fill('#tbUserName', this.config.username);
      await page.fill('#tbPassword', this.config.password);
      await page.fill('#tbFileCabinet', this.config.fileCabinet);
      await page.click('#btnLogin');
      await page.waitForLoadState('networkidle');
      await this.sleep(1000);

      // Step 2: Click Retrieve
      console.log('Clicking Retrieve...');
      const frames = page.frames();
      for (const frame of frames) {
        const retrieveLi = frame.locator('li:has-text("Retrieve")').first();
        if (await retrieveLi.count() > 0) {
          await retrieveLi.click();
          break;
        }
      }
      await page.waitForLoadState('networkidle');
      await this.sleep(2000);

      // Step 3: Find search frame and select program
      const searchFrame = await this.getSearchFrame(page);
      if (!searchFrame) {
        throw new Error('Search frame not found');
      }

      console.log(`Selecting program: ${this.config.program}...`);
      const programInput = searchFrame.locator('input.dhx_combo_input, input[type="text"]').first();
      if (await programInput.count() > 0) {
        await programInput.fill('');
        await programInput.fill(this.config.program);
        await this.sleep(1500);

        // Try clicking dropdown option or press Enter
        const dropdownOption = searchFrame.locator(`.dhx_combo_list div:has-text("${this.config.program}")`).first();
        if (await dropdownOption.count() > 0) {
          await dropdownOption.click();
        } else {
          await programInput.press('ArrowDown');
          await this.sleep(200);
          await programInput.press('Enter');
        }
        await this.sleep(500);
      }

      // Step 4: Execute search
      console.log('Executing search...');
      const searchBtn = searchFrame.locator('input[value="Search"]').first();
      await searchBtn.click();

      // Wait for results (eBridge can be slow)
      console.log('Waiting for results...');
      for (let i = 0; i < 6; i++) {
        await this.sleep(5000);
        const resultsFrame = await this.getResultsFrame(page);
        if (resultsFrame) {
          const rowCount = await resultsFrame.locator('tr').count();
          if (rowCount > 5) {
            console.log(`Found ${rowCount} rows`);
            break;
          }
        }
      }

      // Step 5: Extract data from results
      const resultsFrame = await this.getResultsFrame(page) || searchFrame;

      // Get all data rows (skip header rows)
      const allRows = await resultsFrame.locator('tr').all();
      console.log(`Processing ${allRows.length} rows...`);

      let headerFound = false;
      let startIndex = 0;

      // Find where actual data starts (after header)
      for (let i = 0; i < allRows.length; i++) {
        const cells = await allRows[i].locator('td').allTextContents();
        // Look for a row that has permit number format or actual data
        if (cells.length >= 6 && cells.some(c => /^\d{2}-\d+/.test(c.trim()))) {
          startIndex = i;
          break;
        }
      }

      // Extract records
      let skippedByFilter = 0;
      const docTypeCounts: Record<string, number> = {};

      for (let i = startIndex; i < allRows.length && records.length < this.config.batchSize; i++) {
        try {
          const row = allRows[i];
          const cells = await row.locator('td').allTextContents();

          if (cells.length < 6) continue;

          // Parse cells based on observed structure:
          // [checkbox, VIEW, Program, Permit number, Name, Address, ZipCode, Doc Date, Doc Type, ...]
          const permitNumber = cells[3]?.trim() || cells[2]?.trim();
          const name = cells[4]?.trim() || cells[3]?.trim();
          const address = cells[5]?.trim() || cells[4]?.trim();
          const zipCode = cells[6]?.trim() || cells[5]?.trim();
          const docDate = cells[7]?.trim() || cells[6]?.trim();
          const docType = cells[8]?.trim() || cells[7]?.trim();

          // Skip if no valid permit number
          if (!permitNumber || permitNumber === 'Permit number') continue;

          // Track document type counts for logging
          docTypeCounts[docType || 'Unknown'] = (docTypeCounts[docType || 'Unknown'] || 0) + 1;

          // Filter by document type if configured
          if (this.config.documentTypes && this.config.documentTypes.length > 0) {
            const normalizedDocType = docType?.toLowerCase().trim() || '';
            const matchesFilter = this.config.documentTypes.some(
              t => normalizedDocType.includes(t.toLowerCase())
            );
            if (!matchesFilter) {
              skippedByFilter++;
              continue; // Skip non-matching document types
            }
          }

          const externalId = `ebridge-${this.config.fileCabinet}-${permitNumber}-${docDate}`.replace(/\s+/g, '-');

          records.push({
            externalId,
            data: {
              permitNumber,
              facilityName: name,
              address,
              zipCode,
              inspectionDate: docDate,
              documentType: docType,
              program: this.config.program,
              fileCabinet: this.config.fileCabinet,
              source: 'ebridge',
            },
          });
        } catch (err) {
          console.error(`Error parsing row ${i}:`, err);
        }
      }

      // Log extraction results with filter info
      if (this.config.documentTypes?.length) {
        console.log(`Extracted ${records.length} records (filtered to: ${this.config.documentTypes.join(', ')})`);
        console.log(`  Skipped ${skippedByFilter} records not matching filter`);
        console.log(`  Document types found:`, docTypeCounts);
      } else {
        console.log(`Extracted ${records.length} records (all document types)`);
      }

      // Determine if there are more results
      // eBridge shows all results on one page (up to 1000), so we need to check pagination
      const hasMore = records.length >= this.config.batchSize;
      const lastRecord = records[records.length - 1];
      const nextCursor = hasMore ? this.createCursor({
        page: cursorData.page + 1,
        lastPermitNumber: (lastRecord?.data as Record<string, string>)?.permitNumber || null,
      }) : null;

      return {
        records,
        nextCursor,
        hasMore,
        metadata: {
          fetchedAt: new Date(),
          program: this.config.program,
          fileCabinet: this.config.fileCabinet,
          documentTypesFilter: this.config.documentTypes || 'all',
          skippedByFilter,
          docTypeCounts,
        },
      };

    } catch (error) {
      console.error('eBridge fetch error:', error);
      throw error;
    } finally {
      if (page) await page.close();
    }
  }

  getInitialCursor(): CursorState {
    return this.createCursor({ page: 1, lastPermitNumber: null });
  }

  getIncrementalCursor(): CursorState {
    return this.getInitialCursor();
  }

  async healthCheck(): Promise<boolean> {
    let page: Page | null = null;
    try {
      page = await this.initBrowser();
      await page.goto(this.source.endpoint, {
        waitUntil: 'networkidle',
        timeout: 15000
      });
      const title = await page.title();
      return title.toLowerCase().includes('ebridge');
    } catch {
      return false;
    } finally {
      if (page) await page.close();
      await this.closeBrowser();
    }
  }
}
