const baseUrl = (process.env.SPORTIVO_URL || 'http://127.0.0.1:4321').replace(/\/$/, '');
const routes = ['/', '/football/', '/cricket/', '/basketball/', '/about-dipesh-sapkota/', '/api-docs/'];
const failures = [];
const results = [];

function fail(message) { failures.push(message); }
function absolute(path) { return new URL(path, `${baseUrl}/`).toString(); }
function htmlValue(body, pattern) { return body.match(pattern)?.[1]?.trim() || ''; }

async function request(path, userAgent = 'SportivoAudit/1.0', accept = 'text/html,application/xhtml+xml') {
  const response = await fetch(absolute(path), { headers: { 'user-agent': userAgent, accept } });
  const body = await response.text();
  results.push({ path, status: response.status, bytes: body.length });
  return { response, body };
}

for (const path of routes) {
  try {
    const { response, body } = await request(path);
    if (response.status !== 200) fail(`${path}: expected 200, got ${response.status}`);
    if (!body.includes('<h1')) fail(`${path}: missing H1 in raw HTML`);
    if (!htmlValue(body, /<title[^>]*>([^<]+)<\/title>/i)) fail(`${path}: missing title`);
    if (!htmlValue(body, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)) fail(`${path}: missing description`);
    if (!htmlValue(body, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)) fail(`${path}: missing canonical`);
    if (!body.includes('Sportivo')) fail(`${path}: missing meaningful Sportivo content`);
  } catch (error) { fail(`${path}: ${error.message}`); }
}

try {
  const { response, body } = await request('/football/');
  const links = [...body.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]).filter((href) => href.startsWith('/'));
  for (const link of [...new Set(links)].slice(0, 20)) {
    const linkResponse = await fetch(absolute(link), { redirect: 'manual' });
    if (![200, 301, 302, 307, 308].includes(linkResponse.status)) fail(`internal link ${link}: got ${linkResponse.status}`);
  }
  if (!body.includes('/football/match/')) fail('/football/: no crawlable match links found in raw HTML');
  for (const header of ['x-content-type-options', 'x-frame-options', 'referrer-policy']) if (!response.headers.get(header)) fail(`/football/: missing ${header}`);
} catch (error) { fail(`/football/ links: ${error.message}`); }

try {
  const { response, body } = await request('/robots.txt', 'SportivoAudit/1.0', 'text/plain,*/*');
  if (!response.headers.get('content-type')?.includes('text/plain')) fail('/robots.txt: wrong content type');
  for (const token of ['User-agent: Googlebot', 'User-agent: OAI-SearchBot', 'Sitemap:']) if (!body.includes(token)) fail(`/robots.txt: missing ${token}`);
} catch (error) { fail(`/robots.txt: ${error.message}`); }

try {
  const { response, body } = await request('/sitemap.xml', 'SportivoAudit/1.0', 'application/xml,text/xml,*/*');
  if (!response.headers.get('content-type')?.includes('xml')) fail('/sitemap.xml: wrong content type');
  if (!body.includes('<urlset') || !body.includes('<loc>')) fail('/sitemap.xml: invalid or empty sitemap');
  const sitemapUrls = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  for (const url of sitemapUrls.slice(0, 20)) {
    const sitemapResponse = await fetch(url, { redirect: 'manual' });
    if (![200, 301, 302, 307, 308].includes(sitemapResponse.status)) fail(`sitemap URL ${url}: got ${sitemapResponse.status}`);
  }
} catch (error) { fail(`/sitemap.xml: ${error.message}`); }

try {
  const { response } = await request('/this-route-does-not-exist/');
  if (response.status !== 404) fail(`/this-route-does-not-exist/: expected 404, got ${response.status}`);
} catch (error) { fail(`/this-route-does-not-exist/: ${error.message}`); }

try {
  const { body } = await request('/about-dipesh-sapkota/');
  if (!body.includes('dipesh-sapkota-profile.webp')) fail('/about-dipesh-sapkota/: missing profile image');
  if (!body.includes('ImageObject')) fail('/about-dipesh-sapkota/: missing ImageObject structured data');
  if (!body.includes('https://schema.org')) fail('/about-dipesh-sapkota/: missing schema.org context');
  if (!body.includes('og:image') || !body.includes('dipesh-sapkota-profile.webp')) fail('/about-dipesh-sapkota/: missing og:image profile tag');
} catch (error) { fail(`/about-dipesh-sapkota/ image audit: ${error.message}`); }

try {
  const { response, body } = await request('/', 'Googlebot');
  if (response.status !== 200 || !body.includes('<h1')) fail('Googlebot homepage access failed');
} catch (error) { fail(`Googlebot homepage: ${error.message}`); }

let browserAudit = 'not run (install Playwright to compare rendered DOM and interactions)';
try {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(absolute('/football/'), { waitUntil: 'networkidle' });
  const cards = await page.locator('a[href*="/football/match/"]').count();
  const input = page.locator('input[placeholder*="Search"]');
  await input.fill('zzzz-no-match');
  await page.waitForTimeout(300);
  const emptyState = await page.getByText('No fixtures found for this sport.').count();
  if (cards === 0 || emptyState === 0) fail(`browser audit: expected cards and search empty state, got cards=${cards}, empty=${emptyState}`);
  await browser.close();
  browserAudit = 'passed';
} catch (error) { browserAudit = `not run (${error.code === 'ERR_MODULE_NOT_FOUND' ? 'Playwright is not installed' : error.message})`; }

console.log(JSON.stringify({ baseUrl, results, browserAudit, failures }, null, 2));
if (failures.length) process.exitCode = 1;