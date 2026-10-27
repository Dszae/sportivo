const categories = new Set(['football', 'cricket', 'basketball', 'live']);

export default async function handler(request, response) {
  const category = String(request.query?.category || '').toLowerCase();

  if (!categories.has(category)) {
    response.status(404).json({ error: 'Unsupported sport category' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const upstream = await fetch(`https://streamed.pk/api/matches/${category}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      response
        .status(502)
        .setHeader('Retry-After', '60')
        .json({ error: 'Fixture provider unavailable' });
      return;
    }

    const matches = await upstream.json();
    if (!Array.isArray(matches)) {
      response
        .status(502)
        .setHeader('Retry-After', '60')
        .json({ error: 'Fixture provider returned an invalid response' });
      return;
    }

    response
      .status(200)
      .setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
      .json(matches);
  } catch (error) {
    response
      .status(error.name === 'AbortError' ? 504 : 502)
      .setHeader('Retry-After', '60')
      .json({ error: 'Fixture data is temporarily unavailable' });
  } finally {
    clearTimeout(timeout);
  }
}