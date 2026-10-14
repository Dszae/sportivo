import { mkdir, writeFile } from 'node:fs/promises';

const siteUrl = 'https://sportivo.dipeshsapkota7.com.np';
const categories = ['football', 'cricket', 'basketball'];
const escapeXml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const slugify = (value) =>
  String(value || 'fixture')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'fixture';

const nowIso = new Date().toISOString();

const staticRoutes = [
  {
    url: `${siteUrl}/`,
    priority: '1.0',
    changefreq: 'hourly',
    image: {
      loc: `${siteUrl}/dipesh-sapkota-profile.webp`,
      title: 'Dipesh Sapkota - Creator and Publisher of Sportivo',
      caption: 'Dipesh Sapkota, engineering student, software developer, and the creator and publisher of Sportivo.',
      license: `${siteUrl}/about-dipesh-sapkota/`,
    },
  },
  {
    url: `${siteUrl}/about-dipesh-sapkota/`,
    priority: '0.95',
    changefreq: 'daily',
    image: {
      loc: `${siteUrl}/dipesh-sapkota-profile.webp`,
      title: 'Dipesh Sapkota - Official Portrait & Profile Photo',
      caption: 'Official portrait and profile photo of Dipesh Sapkota, engineering student and creator of Sportivo.',
      license: `${siteUrl}/about-dipesh-sapkota/`,
    },
  },
  { url: `${siteUrl}/api-docs/`, priority: '0.70', changefreq: 'weekly' },
  { url: `${siteUrl}/dashboard/`, priority: '0.90', changefreq: 'daily' },
  ...categories.map((category) => ({
    url: `${siteUrl}/${category}/`,
    priority: '0.85',
    changefreq: 'hourly',
  })),
];

const matchRoutes = [];

for (const category of categories) {
  try {
    const response = await fetch(`https://streamed.pk/api/matches/${category}`, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) continue;
    const matches = await response.json();
    if (Array.isArray(matches)) {
      for (const match of matches) {
        const slug = slugify(match?.title || match?.name);
        matchRoutes.push({
          url: `${siteUrl}/${category}/match/${encodeURIComponent(slug)}/`,
          priority: '0.60',
          changefreq: 'hourly',
        });
      }
    }
  } catch (error) {
    console.warn(`[sitemap] ${category}: ${error.message}`);
  }
}

await mkdir('public', { recursive: true });

const allRoutes = [...staticRoutes, ...matchRoutes];
const seenUrls = new Set();
const uniqueRoutes = allRoutes.filter((r) => {
  if (seenUrls.has(r.url)) return false;
  seenUrls.add(r.url);
  return true;
});

const urlEntries = uniqueRoutes
  .map((route) => {
    let entry = `<url><loc>${escapeXml(route.url)}</loc><lastmod>${nowIso}</lastmod><changefreq>${route.changefreq}</changefreq><priority>${route.priority}</priority>`;
    if (route.image) {
      entry += `<image:image><image:loc>${escapeXml(route.image.loc)}</image:loc><image:title>${escapeXml(route.image.title)}</image:title><image:caption>${escapeXml(route.image.caption)}</image:caption><image:license>${escapeXml(route.image.license)}</image:license></image:image>`;
    }
    entry += '</url>';
    return entry;
  })
  .join('');

const sitemapBody = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urlEntries}\n</urlset>`;
await writeFile('public/sitemap.xml', sitemapBody, 'utf8');

const sitemapIndexBody = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<sitemap>\n<loc>${siteUrl}/sitemap.xml</loc>\n<lastmod>${nowIso}</lastmod>\n</sitemap>\n</sitemapindex>`;
await writeFile('public/sitemap-index.xml', sitemapIndexBody, 'utf8');

console.log(`[sitemap] generated ${uniqueRoutes.length} URLs in public/sitemap.xml and public/sitemap-index.xml with Google Image & Priority metadata`);