const categories = new Set(['football', 'cricket', 'basketball']);

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

export default async function handler(request, response) {
  const category = String(request.query?.category || '').toLowerCase();
  const slug = String(request.query?.slug || '');

  if (!categories.has(category) || !slug) {
    response.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').end('<h1>Fixture not found</h1>');
    return;
  }

  try {
    const upstream = await fetch(`https://streamed.pk/api/matches/${category}`, {
      headers: { accept: 'application/json' },
    });
    if (!upstream.ok) throw new Error(`Upstream returned ${upstream.status}`);
    const matches = await upstream.json();
    const match = Array.isArray(matches)
      ? matches.find((item) => slugify(item?.title || item?.name) === slug)
      : null;

    if (!match) {
      response.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').end('<h1>Fixture not found</h1><p>This Sportivo match URL does not identify a current public fixture.</p>');
      return;
    }

    const title = match.title || match.name || 'Sportivo fixture';
    response
      .status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
      .end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)} | Sportivo</title><meta name="robots" content="index,follow"></head><body><nav><a href="/">Sportivo</a> / <a href="/${category}/">${escapeHtml(category)} fixtures</a></nav><main><h1>${escapeHtml(title)}</h1><p>This public Sportivo fixture is available at the current upstream data source. Open the page in a JavaScript-enabled browser for the interactive fixture experience.</p></main></body></html>`);
  } catch {
    response.status(503).setHeader('Retry-After', '60').setHeader('Content-Type', 'text/plain; charset=utf-8').end('Fixture data is temporarily unavailable.');
  }
}
