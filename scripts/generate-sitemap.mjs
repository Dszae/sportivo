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

const urlEntries = [...new Set(urls)].map((url) => {
  if (url === `${siteUrl}/about-dipesh-sapkota/`) {
    return `<url><loc>${escapeXml(url)}</loc><image:image><image:loc>${siteUrl}/dipesh-sapkota-profile.webp</image:loc><image:title>Dipesh Sapkota - Creator and Publisher of Sportivo</image:title><image:caption>Official profile photograph of Dipesh Sapkota, engineering student and creator of Sportivo.</image:caption><image:license>${siteUrl}/about-dipesh-sapkota/</image:license></image:image></url>`;
  }
  return `<url><loc>${escapeXml(url)}</loc></url>`;
}).join('');

const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urlEntries}</urlset>`;
await writeFile('public/sitemap.xml', body, 'utf8');
console.log(`[sitemap] generated ${new Set(urls).size} URLs with Google Image Sitemap metadata`);