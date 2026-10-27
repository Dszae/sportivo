import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const siteUrl = 'https://sportivo.dipeshsapkota7.com.np';
const categories = ['football', 'cricket', 'basketball'];
const maxMatches = 100;

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const slugify = (value) => String(value || 'fixture')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 100) || 'fixture';

const titleOf = (match) => match?.title || match?.name || 'Untitled fixture';
const statusOf = (match) => {
  const status = String(match?.status || '').toLowerCase();
  const time = String(match?.time || '').toLowerCase();
  if (['live', 'inplay', 'in-play', 'ongoing'].includes(status) || time === 'live') return 'Live';
  if (['finished', 'complete', 'completed', 'ended', 'result'].includes(status)) return 'Final';
  return 'Upcoming';
};

const timeOf = (match) => {
  const value = match?.date || match?.startTime || match?.start_at || match?.timestamp;
  if (!value) return match?.time || 'Time TBA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() === 1970) return match?.time || 'Time TBA';
  return new Intl.DateTimeFormat('en-NP', {
    timeZone: 'Asia/Kathmandu',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const normalize = (match, category) => ({
  ...match,
  title: titleOf(match),
  category: match?.category || category,
  status: statusOf(match),
  displayTime: timeOf(match),
  slug: slugify(titleOf(match)),
});

async function fetchCategory(category) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://streamed.pk/api/matches/${category}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data.slice(0, maxMatches).map((match) => normalize(match, category)) : [];
  } catch (error) {
    console.warn(`[prerender] ${category}: ${error.message}`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function replaceMetadata(html, { title, description, canonical }) {
  return html
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/(<meta name="title" content=")[^"]*(")/, `$1${escapeHtml(title)}$2`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapeHtml(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`)
    .replace(/(<meta name="twitter:url" content=")[^"]*(")/, `$1${canonical}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escapeHtml(title)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escapeHtml(description)}$2`);
}

function fixtureLink(match, category) {
  const href = `/${category}/match/${encodeURIComponent(match.slug)}/`;
  return `<li><a href="${href}">${escapeHtml(match.title)}</a> <span>${escapeHtml(match.status)} · ${escapeHtml(match.displayTime)} Nepal Standard Time</span></li>`;
}

function fixtureList(category, matches) {
  if (matches.length === 0) {
    return `<p>No ${category} fixtures are available from the upstream provider at prerender time. The interactive schedule checks again when JavaScript loads.</p>`;
  }
  return `<ul>${matches.map((match) => fixtureLink(match, category)).join('')}</ul>`;
}

function categoryBlock(category, matches) {
  const label = category[0].toUpperCase() + category.slice(1);
  return `<section id="${category}-fixtures"><p><a href="${siteUrl}/">Sportivo home</a> / ${label} fixtures</p><h2>${label} fixtures and live scores</h2><p>Browse ${label.toLowerCase()} schedules, statuses, and kickoff times in Nepal Standard Time.</p>${fixtureList(category, matches)}</section>`;
}

function inject(html, content) {
  return html.replace('<div id="root"></div>', `<div id="root"></div><div id="prerendered-content">${content}</div>`);
}

async function writePage(relativePath, html) {
  const destination = join(dist, relativePath, 'index.html');
  await mkdir(join(dist, relativePath), { recursive: true });
  await writeFile(destination, html, 'utf8');
}

const template = await readFile(join(dist, 'index.html'), 'utf8');
const data = Object.fromEntries(await Promise.all(categories.map(async (category) => [category, await fetchCategory(category)])));
const generatedAt = new Date().toISOString();

const homeHtml = replaceMetadata(template, {
  title: 'Sportivo by Dipesh Sapkota | Live Scores, Fixtures & Sports News',
  description: 'Sportivo by Dipesh Sapkota: live scores, football, cricket, and basketball fixtures, Nepal kickoff times, sports schedules, and available stream sources.',
  canonical: `${siteUrl}/`,
});
await writePage('', inject(homeHtml, `<p><strong>Pre-rendered fixture index.</strong> Updated ${escapeHtml(generatedAt)}.</p>${categories.map((category) => categoryBlock(category, data[category])).join('')}`));

for (const category of categories) {
  const label = category[0].toUpperCase() + category.slice(1);
  const canonical = `${siteUrl}/${category}/`;
  const html = replaceMetadata(template, {
    title: `${label} Fixtures, Live Scores & Schedule | Sportivo by Dipesh Sapkota`,
    description: `Browse ${category} fixtures, live scores, results, and Nepal Standard Time schedules on Sportivo by Dipesh Sapkota.`,
    canonical,
  });
  const categoryBreadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Sportivo', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: label, item: canonical },
    ],
  };
  await writePage(category, inject(html, `<p><strong>Pre-rendered ${escapeHtml(category)} fixture page.</strong> Updated ${escapeHtml(generatedAt)}.</p>${categoryBlock(category, data[category])}<script type="application/ld+json">${JSON.stringify(categoryBreadcrumbs)}</script>`));

  for (const match of data[category]) {
    const matchCanonical = `${siteUrl}/${category}/match/${encodeURIComponent(match.slug)}/`;
    const startDate = match?.date || match?.startTime || match?.start_at || match?.timestamp;
    const eventStatus = match.status === 'Live'
      ? 'https://schema.org/EventInProgress'
      : match.status === 'Final'
        ? 'https://schema.org/EventCompleted'
        : 'https://schema.org/EventScheduled';
    const matchHtml = replaceMetadata(template, {
      title: `${match.title} | ${label} Fixture | Sportivo`,
      description: `${match.title}: ${match.status} ${category} fixture scheduled for ${match.displayTime} Nepal Standard Time on Sportivo.`,
      canonical: matchCanonical,
    });
    const sportsEvent = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: match.title,
      url: matchCanonical,
      sport: match.category,
      eventStatus,
      ...(startDate ? { startDate } : {}),
      organizer: { '@type': 'Organization', name: 'Sportivo by Dipesh Sapkota', url: siteUrl },
    };
    const matchBreadcrumbs = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Sportivo', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: label, item: `${siteUrl}/${category}/` },
        { '@type': 'ListItem', position: 3, name: match.title, item: matchCanonical },
      ],
    };
    const body = `<article><nav aria-label="Breadcrumb"><a href="/">Sportivo</a> / <a href="/${category}/">${label} fixtures</a> / Match details</nav><h2>${escapeHtml(match.title)}</h2><p><strong>Status:</strong> ${escapeHtml(match.status)}</p><p><strong>Scheduled time:</strong> <time>${escapeHtml(match.displayTime)}</time> Nepal Standard Time</p><p><strong>Sport:</strong> ${escapeHtml(match.category)}</p><p>Sportivo by Dipesh Sapkota presents this fixture with current information supplied by its upstream sports data provider. Stream availability is requested separately and is not guaranteed.</p></article><script type="application/ld+json">${JSON.stringify(sportsEvent)}</script><script type="application/ld+json">${JSON.stringify(matchBreadcrumbs)}</script>`;
    await writePage(join(category, 'match', match.slug), inject(matchHtml, body));
  }
}

const sitemapUrls = [
  `${siteUrl}/`,
  `${siteUrl}/about-dipesh-sapkota/`,
  ...categories.map((category) => `${siteUrl}/${category}/`),
  ...categories.flatMap((category) => data[category].map((match) => `${siteUrl}/${category}/match/${encodeURIComponent(match.slug)}/`)),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls.map((url) => `<url><loc>${escapeHtml(url)}</loc><changefreq>hourly</changefreq></url>`).join('')}</urlset>\n`;
await writeFile(join(dist, 'sitemap.xml'), sitemap, 'utf8');

console.log(`[prerender] generated ${categories.length} category pages and ${categories.reduce((total, category) => total + data[category].length, 0)} match pages`);
