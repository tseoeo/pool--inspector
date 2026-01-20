/**
 * eBridge Scraper - Hillsborough County FL Pool Inspections
 *
 * Successfully navigates eBridge to search for Swimming Pool/Spa records
 */

import "dotenv/config";
import { chromium, Frame } from 'playwright';

const EBRIDGE_URL = 'https://s1.ebridge.com/ebridge/3.0/default.aspx';
const CREDENTIALS = {
  username: 'public',
  password: 'publicuser',
  fileCabinet: 'HCHD'
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getSearchFrame(frames: Frame[]): Promise<Frame | null> {
  for (const frame of frames) {
    const url = frame.url();
    if (url.includes('search.aspx')) {
      return frame;
    }
  }
  return null;
}

async function exploreEbridge() {
  console.log('=== eBridge Pool Scraper ===\n');

  const browser = await chromium.launch({
    headless: true,
    slowMo: 50
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  const page = await context.newPage();

  try {
    // Step 1: Login
    console.log('1. Logging in...');
    await page.goto(EBRIDGE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#tbUserName', CREDENTIALS.username);
    await page.fill('#tbPassword', CREDENTIALS.password);
    await page.fill('#tbFileCabinet', CREDENTIALS.fileCabinet);
    await page.click('#btnLogin');
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    console.log('   ✓ Logged in\n');

    // Step 2: Click Retrieve (it's in a <LI> element)
    console.log('2. Clicking Retrieve...');
    const frames = page.frames();
    for (const frame of frames) {
      const retrieveLi = frame.locator('li:has-text("Retrieve")').first();
      if (await retrieveLi.count() > 0) {
        await retrieveLi.click();
        break;
      }
    }
    await page.waitForLoadState('networkidle');
    await sleep(2000);
    console.log('   ✓ Clicked Retrieve\n');

    // Step 3: Find the search frame
    console.log('3. Finding search form...');
    const allFrames = page.frames();
    const searchFrame = await getSearchFrame(allFrames);

    if (!searchFrame) {
      console.log('   Search frame not found!');
      await page.screenshot({ path: 'ebridge-no-search.png' });
      return;
    }
    console.log(`   ✓ Found search frame: ${searchFrame.url()}\n`);

    // Step 4: Explore the Program dropdown
    console.log('4. Exploring Program dropdown...');

    // The Program dropdown might be a custom combobox (dhtmlXCombo)
    // Let's click on it to expand and see options
    const programDropdown = searchFrame.locator('#index1, select[id*="Program"], [id*="program"]').first();

    if (await programDropdown.count() > 0) {
      console.log('   Found program dropdown element');

      // Check if it's a select or custom widget
      const tagName = await programDropdown.evaluate(el => el.tagName);
      console.log(`   Element type: <${tagName}>`);

      if (tagName === 'SELECT') {
        const options = await programDropdown.locator('option').allTextContents();
        console.log(`   Options (${options.length}):`);
        for (const opt of options) {
          console.log(`     - "${opt}"`);
          if (opt.toLowerCase().includes('pool') || opt.toLowerCase().includes('swim')) {
            console.log(`       >>> POOL OPTION FOUND!`);
          }
        }
      } else {
        // Custom widget - try clicking to expand
        await programDropdown.click();
        await sleep(500);

        // Look for dropdown list items
        const listItems = await searchFrame.locator('.dhx_combo_list div, .combo_option, [class*="option"]').all();
        console.log(`   Dropdown items: ${listItems.length}`);

        for (const item of listItems) {
          const text = await item.textContent();
          if (text?.trim()) {
            console.log(`     - "${text.trim()}"`);
          }
        }
      }
    }

    // Try to find any visible dropdown options
    await page.screenshot({ path: 'ebridge-dropdown.png' });
    console.log('   Screenshot: ebridge-dropdown.png\n');

    // Step 5: Look for pool program by typing
    console.log('5. Searching for Swimming Pool program...');

    // The combobox might support typing to filter
    const comboInput = searchFrame.locator('input[id*="index1"], input.dhx_combo_input').first();
    if (await comboInput.count() > 0) {
      console.log('   Found combo input, typing "swim"...');
      await comboInput.fill('swim');
      await sleep(1000);
      await page.screenshot({ path: 'ebridge-swim-typed.png' });

      // Check for filtered options
      const filteredItems = await searchFrame.locator('.dhx_combo_list div:visible, [class*="combo"] [class*="option"]:visible').all();
      console.log(`   Filtered items: ${filteredItems.length}`);
      for (const item of filteredItems.slice(0, 10)) {
        const text = await item.textContent();
        console.log(`     - "${text?.trim()}"`);
      }

      // Clear and try "pool"
      await comboInput.fill('');
      await sleep(300);
      await comboInput.fill('pool');
      await sleep(1000);
      await page.screenshot({ path: 'ebridge-pool-typed.png' });
    }

    // Step 6: Select Swimming Pool program and search
    console.log('\n6. Selecting Swimming Pool program...');

    // Clear any text in Program and type the exact program name
    const programInput = searchFrame.locator('input.dhx_combo_input, input[type="text"]').first();
    if (await programInput.count() > 0) {
      await programInput.fill('');
      await programInput.fill('Swimming');
      await sleep(1500);
      await page.screenshot({ path: 'ebridge-swimming-typed.png' });

      // Try to click the dropdown option
      const dropdownOption = searchFrame.locator('.dhx_combo_list div:has-text("Swimming"), [class*="option"]:has-text("Swimming")').first();
      if (await dropdownOption.count() > 0) {
        console.log('   Found Swimming option, clicking...');
        await dropdownOption.click();
        await sleep(500);
      } else {
        // Press down arrow and enter to select first match
        await programInput.press('ArrowDown');
        await sleep(200);
        await programInput.press('Enter');
        await sleep(500);
      }
    }

    await page.screenshot({ path: 'ebridge-program-selected.png' });

    // Click Search button
    const searchBtn = searchFrame.locator('input[value="Search"], button:has-text("Search")').first();
    if (await searchBtn.count() > 0) {
      console.log('   Clicking Search...');
      await searchBtn.click();

      // Wait longer for results (eBridge can be slow)
      console.log('   Waiting for results (up to 30s)...');
      await sleep(5000);

      // Check if still loading
      for (let i = 0; i < 5; i++) {
        const loadingIndicator = await page.locator('.loading, [class*="loading"], [class*="spinner"]').count();
        if (loadingIndicator === 0) {
          console.log('   Results loaded!');
          break;
        }
        console.log(`   Still loading... (${(i+1)*5}s)`);
        await sleep(5000);
      }

      await page.screenshot({ path: 'ebridge-search-results.png', fullPage: true });
      console.log('   Screenshot: ebridge-search-results.png\n');
    }

    // Step 7: Analyze search results and extract data
    console.log('7. Extracting data from results...');

    const extractedRecords: Array<Record<string, string>> = [];

    // Look for result table in search frame
    const allRows = await searchFrame.locator('tr').all();
    console.log(`   Total rows: ${allRows.length}`);

    // Find header row to understand column structure
    let columnMap: Record<number, string> = {};
    let dataStartIndex = 0;

    for (let i = 0; i < Math.min(10, allRows.length); i++) {
      const cells = await allRows[i].locator('td, th').allTextContents();
      const cleanCells = cells.map(c => c.trim()).filter(c => c);

      // Check if this looks like a header
      if (cleanCells.includes('Program') && cleanCells.includes('Permit number')) {
        console.log(`   Header row ${i}: ${cleanCells.join(' | ')}`);
        cleanCells.forEach((cell, idx) => {
          columnMap[idx] = cell;
        });
        dataStartIndex = i + 1;
        break;
      }
    }

    // Extract data rows
    console.log(`   Extracting data starting from row ${dataStartIndex}...`);
    for (let i = dataStartIndex; i < allRows.length && extractedRecords.length < 20; i++) {
      const cells = await allRows[i].locator('td').allTextContents();
      const cleanCells = cells.map(c => c.trim());

      // Skip rows that don't look like data (need permit number pattern)
      const hasPermitNumber = cleanCells.some(c => /^\d{2}-\d+/.test(c));
      if (!hasPermitNumber) continue;

      // Map cells to column names
      const record: Record<string, string> = {};
      cleanCells.forEach((cell, idx) => {
        const colName = columnMap[idx] || `col${idx}`;
        if (cell && colName !== 'VIEW' && !cell.includes('window.')) {
          record[colName] = cell;
        }
      });

      if (Object.keys(record).length > 3) {
        extractedRecords.push(record);
      }
    }

    console.log(`\n   Extracted ${extractedRecords.length} sample records:`);
    for (let i = 0; i < Math.min(10, extractedRecords.length); i++) {
      const r = extractedRecords[i];
      // Columns appear to be: (hidden), VIEW, Program, Permit#, Name, Address, Zip, DocDate, DocType
      // The values array is offset, so let's show raw values
      const vals = Object.values(r);
      console.log(`   [${i}] ${vals.slice(0, 6).join(' | ')}`);
    }

    // Summary
    console.log(`\n   === Summary ===`);
    console.log(`   Total searchable records: ~${allRows.length - dataStartIndex}`);
    console.log(`   Sample extracted: ${extractedRecords.length}`);
    if (extractedRecords.length > 0) {
      console.log(`   Columns found: ${Object.keys(columnMap).map(k => columnMap[parseInt(k)]).join(', ')}`);
    }

    // Final screenshot
    await page.screenshot({ path: 'ebridge-final.png', fullPage: true });
    console.log('\n   Final screenshot: ebridge-final.png');

  } catch (error) {
    console.error('\nError:', error);
    await page.screenshot({ path: 'ebridge-error.png' });
  } finally {
    await browser.close();
  }
}

exploreEbridge().catch(console.error);
