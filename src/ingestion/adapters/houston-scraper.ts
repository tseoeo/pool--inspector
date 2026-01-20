import type { Source } from "@prisma/client";
import { BaseAdapter } from "./base";
import type {
  CursorState,
  FetchResult,
  RawPayload,
} from "@/types/ingestion";
import { chromium, Browser, Page, BrowserContext } from 'playwright';

interface HoustonConfig {
  batchSize: number;
  timeout: number;
  retryAttempts: number;
}

interface HoustonCursorData {
  start: number;
  facilityIndex: number;
}

export class HoustonScraperAdapter extends BaseAdapter {
  protected config: HoustonConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private baseUrl = 'https://tx.healthinspections.us/houston';

  constructor(source: Source) {
    super(source);
    this.config = this.parseConfig(source.config);
  }

  parseConfig(raw: unknown): HoustonConfig {
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

  private parseCursor(cursor: CursorState | null): HoustonCursorData {
    if (!cursor || cursor.type !== "offset") {
      return { start: 1, facilityIndex: 0 };
    }
    try {
      const data = JSON.parse(String(cursor.value)) as HoustonCursorData;
      return data;
    } catch {
      return { start: 1, facilityIndex: 0 };
    }
  }

  private createCursor(data: HoustonCursorData): CursorState {
    return { type: "offset", value: JSON.stringify(data) };
  }

  async fetch(cursor: CursorState | null): Promise<FetchResult> {
    const cursorData = this.parseCursor(cursor);
    const records: RawPayload[] = [];
    let page: Page | null = null;

    try {
      page = await this.initBrowser();

      // Build search URL for pools - simplified to just facType and pagination
      const searchUrl = `${this.baseUrl}/search.cfm?start=${cursorData.start}&1=1&facType=Pool`;

      console.log(`Fetching Houston pools from start=${cursorData.start}`);
      await page.goto(searchUrl, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout
      });

      // Get all facility links on this page
      const facilityLinks = await page.locator('a[href*="facilityID="]').all();
      const uniqueFacilities = new Map<string, string>();

      for (const link of facilityLinks) {
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        const match = href?.match(/facilityID=([^&]+)/);
        if (match && text && !href?.includes('inspectionID')) {
          uniqueFacilities.set(match[1], text.trim());
        }
      }

      console.log(`Found ${uniqueFacilities.size} facilities on page`);

      // Check for next page BEFORE navigating away from search results
      const nextPageLink = await page.locator(`a[href*="start=${cursorData.start + 10}"]`).first();
      const hasNextPage = await nextPageLink.count() > 0;
      const facilitiesOnPage = uniqueFacilities.size;

      // Process each facility
      let facilityCount = 0;
      for (const [facilityId, facilityName] of uniqueFacilities) {
        if (records.length >= this.config.batchSize) break;

        try {
          // Navigate to facility page
          const facilityUrl = `${this.baseUrl}/estab.cfm?facilityID=${facilityId}`;
          await page.goto(facilityUrl, {
            waitUntil: 'networkidle',
            timeout: this.config.timeout
          });

          // Extract facility details
          const facilityData = await this.extractFacilityData(page, facilityId, facilityName);

          if (facilityData && facilityData.length > 0) {
            for (const record of facilityData) {
              records.push(record);
            }
          }

          facilityCount++;

          // Small delay to be respectful
          await page.waitForTimeout(300);

        } catch (err) {
          console.error(`Error processing facility ${facilityId}:`, err);
        }
      }

      // Determine next cursor - use pagination check from BEFORE we navigated away
      let nextCursor: CursorState | null = null;

      if (hasNextPage || facilitiesOnPage === 10) {
        // Move to next page
        nextCursor = this.createCursor({
          start: cursorData.start + 10,
          facilityIndex: 0
        });
      }

      return {
        records,
        nextCursor,
        hasMore: nextCursor !== null,
        metadata: {
          fetchedAt: new Date(),
          start: cursorData.start,
          facilitiesProcessed: facilityCount,
        },
      };

    } catch (error) {
      console.error(`Error fetching from Houston:`, error);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private async extractFacilityData(page: Page, facilityId: string, facilityName: string): Promise<RawPayload[] | null> {
    try {
      const records: RawPayload[] = [];

      // Extract address from the demographic div
      const demographicText = await page.locator('#demographic').textContent().catch(() => null);
      let address = '';
      let city = 'HOUSTON';
      let state = 'TX';
      let zip = '';

      if (demographicText) {
        const lines = demographicText.split('\n').map(l => l.trim()).filter(l => l);
        // Usually: [name, street address, city state zip]
        if (lines.length >= 2) {
          address = lines[1] || '';
        }
        // Look for city, state zip pattern
        for (const line of lines) {
          const match = line.match(/([A-Z\s]+),\s*([A-Z]{2})\s*(\d{5})/);
          if (match) {
            city = match[1].trim();
            state = match[2];
            zip = match[3];
            break;
          }
        }
      }

      // Get page text to extract inspections
      const pageText = await page.textContent('body') || '';

      // Find all inspection dates and their violations
      // Pattern: "Date: MM/DD/YYYY" followed by violations until "View Full Inspection Report"
      const datePattern = /Date:\s*(\d{2}\/\d{2}\/\d{4})/g;
      let match;
      const dates: string[] = [];

      while ((match = datePattern.exec(pageText)) !== null) {
        dates.push(match[1]);
      }

      // Get inspection links for more details
      const inspectionLinks = await page.locator('a[href*="inspectionID"]').all();
      const inspectionIds: string[] = [];

      for (const link of inspectionLinks) {
        const href = await link.getAttribute('href');
        const idMatch = href?.match(/inspectionID=([^&]+)/);
        if (idMatch && !inspectionIds.includes(idMatch[1])) {
          inspectionIds.push(idMatch[1]);
        }
      }

      // Extract violations for each inspection by parsing page sections
      // The page shows violations grouped by date
      const sections = pageText.split(/Date:\s*\d{2}\/\d{2}\/\d{4}/);

      for (let i = 0; i < dates.length; i++) {
        const inspectionDate = dates[i];
        const inspectionId = inspectionIds[i] || `${facilityId}-${inspectionDate.replace(/\//g, '-')}`;

        // Extract violations from section (if available)
        const section = sections[i + 1] || '';
        const violations: string[] = [];

        // Look for violation codes (pattern like "757.004 Gates -")
        const violationPattern = /(\d+\.\d+[^\n-]*)/g;
        let violationMatch;
        while ((violationMatch = violationPattern.exec(section)) !== null) {
          const violation = violationMatch[1].trim();
          if (violation && !violation.includes('View Full')) {
            violations.push(violation);
          }
        }

        const externalId = `houston-${facilityId}-${inspectionDate.replace(/\//g, '-')}`;

        records.push({
          externalId,
          data: {
            facilityId,
            facilityName,
            address,
            city,
            state,
            zip,
            inspectionDate,
            inspectionId,
            violations,
            violationCount: violations.length,
            result: violations.length === 0 ? 'Pass' : 'Violations Found',
          },
        });
      }

      return records.length > 0 ? records : null;
    } catch (err) {
      console.error('Error extracting facility data:', err);
      return null;
    }
  }

  getInitialCursor(): CursorState {
    return this.createCursor({
      start: 1,
      facilityIndex: 0
    });
  }

  getIncrementalCursor(): CursorState {
    return this.getInitialCursor();
  }

  async healthCheck(): Promise<boolean> {
    let page: Page | null = null;
    try {
      page = await this.initBrowser();
      await page.goto(`${this.baseUrl}/index.cfm`, {
        waitUntil: 'networkidle',
        timeout: 10000
      });
      const title = await page.title();
      return title.includes('Houston');
    } catch {
      return false;
    } finally {
      if (page) await page.close();
      await this.closeBrowser();
    }
  }
}
