import { mkdir, writeFile } from 'node:fs/promises';

const siteUrl = 'https://sportivo.dipeshsapkota7.com.np';
const categories = ['football', 'cricket', 'basketball'];
const escapeXml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const slugify = (value) => String(value || 'fixture').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'fixture';

const urls = [`${siteUrl}/`, `${siteUrl}/about-dipesh-sapkota/`, `${siteUrl}/api-docs/`, ...categories.map((category) => `${siteUrl}/${category}/`)];
for (const category of categories) {
  try {
    const response = await fetch(`https://streamed.pk/api/matches/${category}`, { headers: { accept: 'application/json' } });
    if (!response.ok) continue;
    const matches = await response.json();
    if (Array.isArray(matches)) for (const match of matches) urls.push(`${siteUrl}/${category}/match/${encodeURIComponent(slugify(match?.title || match?.name))}/`);
  } catch (error) {
    console.warn(`[sitemap] ${category}: ${error.message}`);
  }
}

await mkdir('public', { recursive: true });
const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(urls)].map((url) => `<url><loc>${escapeXml(url)}</loc></url>`).join('')}</urlset>`;
await writeFile('public/sitemap.xml', body, 'utf8');
console.log(`[sitemap] generated ${new Set(urls).size} URLs`);