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

const nowIso = new Date().toISOString();

// Clean permanent sitemap: Homepage, Creator About page, Core Sport Category hubs, Dashboard, and Developer API
const staticRoutes = [
  {
    url: `${siteUrl}/`,
    priority: '1.0',
    changefreq: 'daily',
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
    changefreq: 'monthly',
    image: {
      loc: `${siteUrl}/dipesh-sapkota-profile.webp`,
      title: 'Dipesh Sapkota - Official Portrait & Profile Photo',
      caption: 'Official portrait and profile photo of Dipesh Sapkota, engineering student and creator of Sportivo.',
      license: `${siteUrl}/about-dipesh-sapkota/`,
    },
  },
  {
    url: `${siteUrl}/football/`,
    priority: '0.90',
    changefreq: 'daily',
  },
  {
    url: `${siteUrl}/cricket/`,
    priority: '0.90',
    changefreq: 'daily',
  },
  {
    url: `${siteUrl}/basketball/`,
    priority: '0.90',
    changefreq: 'daily',
  },
  {
    url: `${siteUrl}/dashboard/`,
    priority: '0.80',
    changefreq: 'weekly',
  },
  {
    url: `${siteUrl}/api-docs/`,
    priority: '0.70',
    changefreq: 'monthly',
  },
];

await mkdir('public', { recursive: true });

const urlEntries = staticRoutes
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

console.log(`[sitemap] generated ${staticRoutes.length} permanent URLs in public/sitemap.xml and public/sitemap-index.xml`);