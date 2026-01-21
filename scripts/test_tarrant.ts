import * as cheerio from 'cheerio';

// Simple cookie store
let cookies: Map<string, string> = new Map();

function parseCookies(setCookieHeaders: string[] | null) {
  if (!setCookieHeaders) return;
  for (const header of setCookieHeaders) {
    const match = header.match(/^([^=]+)=([^;]*)/);
    if (match) {
      cookies.set(match[1], match[2]);
    }
  }
}

function getCookieHeader(): string {
  return Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function testTarrantSearch() {
  const baseUrl = 'https://poolinspection.tarrantcounty.com';
  cookies.clear();

  // Step 1: Get the search page to capture form tokens and cookies
  console.log('Step 1: Fetching search page...');
  const pageResp = await fetch(`${baseUrl}/Search.aspx`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  });

  // Store cookies
  const setCookies = pageResp.headers.getSetCookie?.() || [];
  parseCookies(setCookies);
  console.log('Cookies received:', cookies.size);

  const pageHtml = await pageResp.text();
  const $ = cheerio.load(pageHtml);

  const viewState = $('#__VIEWSTATE').val() as string;
  const viewStateGen = $('#__VIEWSTATEGENERATOR').val() as string;
  const eventValidation = $('#__EVENTVALIDATION').val() as string;

  console.log('Form tokens:');
  console.log('  VIEWSTATE:', viewState?.length, 'chars');
  console.log('  VIEWSTATEGENERATOR:', viewStateGen);
  console.log('  EVENTVALIDATION:', eventValidation?.length, 'chars');

  // Step 2: Submit search form with cookies
  console.log('\nStep 2: Submitting search...');
  const formData = new URLSearchParams();
  formData.append('__VIEWSTATE', viewState);
  formData.append('__VIEWSTATEGENERATOR', viewStateGen);
  formData.append('__EVENTVALIDATION', eventValidation);
  formData.append('ctl00$ContentPlaceHolder1$ContentPH1$RadioButtonList1', 'Pool/Spa');
  formData.append('ctl00$ContentPlaceHolder1$ContentPH1$txtName', '');
  formData.append('ctl00$ContentPlaceHolder1$ContentPH1$txtAddress', '');
  formData.append('ctl00$ContentPlaceHolder1$ContentPH1$txtCity', 'Mansfield');
  formData.append('ctl00$ContentPlaceHolder1$ContentPH1$txtZip', '');
  formData.append('ctl00$ContentPlaceHolder1$ContentPH1$InResult', '');
  formData.append('ctl00$ContentPlaceHolder1$ContentPH1$datetimepicker1', '');
  formData.append('ctl00$ContentPlaceHolder1$ContentPH1$datetimepicker2', '');
  formData.append('ctl00$ContentPlaceHolder1$ContentPH1$btnSearch', 'Search');

  const searchResp = await fetch(`${baseUrl}/Search.aspx`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': `${baseUrl}/Search.aspx`,
      'Origin': baseUrl,
      'Cookie': getCookieHeader(),
    },
    body: formData.toString(),
  });

  const resultHtml = await searchResp.text();
  console.log('\nSearch response:', searchResp.status);
  console.log('Response length:', resultHtml.length);

  // Check for error
  if (resultHtml.includes('Runtime Error') || resultHtml.includes('Server Error')) {
    console.log('\n*** Server returned an error ***');
    console.log(resultHtml.substring(0, 1000));
    return;
  }

  // Parse results
  const $result = cheerio.load(resultHtml);
  const tables = $result('table').length;
  const gridView = $result('[id*="GridView"]').length;

  console.log('Tables found:', tables);
  console.log('GridView found:', gridView);

  // Look for result links
  const detailLinks = $result('a[href*="detail"], a[href*="Detail"]').toArray();
  console.log('Detail links found:', detailLinks.length);

  if (detailLinks.length > 0) {
    console.log('\nFirst few links:');
    detailLinks.slice(0, 5).forEach(link => {
      const href = $result(link).attr('href');
      const text = $result(link).text().trim();
      console.log(`  ${text}: ${href}`);
    });
  }

  // Show sample of HTML if no results
  if (detailLinks.length === 0) {
    console.log('\n--- Sample of response body ---');
    console.log(resultHtml.substring(0, 2000));
  }
}

testTarrantSearch().catch(console.error);
