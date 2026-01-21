import { chromium } from 'playwright';

async function testTarrantSearch() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('Step 1: Navigate to search page...');
    await page.goto('https://poolinspection.tarrantcounty.com/Search.aspx', {
      waitUntil: 'networkidle'
    });

    console.log('Page title:', await page.title());

    // Select Pool/Spa radio button (should be default)
    const poolRadio = page.locator('input[value="Pool/Spa"]');
    await poolRadio.check();

    // Enter city name
    console.log('\nStep 2: Entering search criteria...');
    await page.fill('input[name="ctl00$ContentPlaceHolder1$ContentPH1$txtCity"]', 'Mansfield');

    // Click search button
    console.log('Step 3: Clicking search...');
    await page.click('input[value="Search"]');

    // Wait for results
    await page.waitForLoadState('networkidle');
    console.log('Page after search:', await page.title());

    // Check for error
    const pageContent = await page.content();
    if (pageContent.includes('Runtime Error') || pageContent.includes('Server Error')) {
      console.log('\n*** Server returned an error ***');
      console.log(pageContent.substring(0, 1000));
      return;
    }

    // Look for results
    const tables = await page.locator('table').count();
    console.log('Tables found:', tables);

    // Find links to detail pages
    const detailLinks = await page.locator('a[href*="detail"], a[href*="Detail"]').all();
    console.log('Detail links found:', detailLinks.length);

    // Check for GridView results
    const rows = await page.locator('table tr').count();
    console.log('Table rows:', rows);

    // Get all links
    const allLinks = await page.locator('a').all();
    console.log('\nAll links on page:');
    for (const link of allLinks.slice(0, 15)) {
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      if (href && !href.startsWith('#') && !href.includes('javascript')) {
        console.log(`  ${text?.trim()}: ${href}`);
      }
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: '/tmp/tarrant_search_result.png', fullPage: true });
    console.log('\nScreenshot saved to /tmp/tarrant_search_result.png');

    // Get page HTML structure
    console.log('\n--- Page structure ---');
    const html = await page.content();
    console.log('HTML length:', html.length);

    // Look for any result indicators
    const resultText = await page.locator('body').textContent();
    if (resultText?.includes('No records')) {
      console.log('Page indicates: No records found');
    } else if (resultText?.includes('records')) {
      const match = resultText.match(/(\d+)\s*records?/i);
      if (match) {
        console.log(`Found ${match[1]} records`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testTarrantSearch().catch(console.error);
