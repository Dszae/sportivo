export default async function handler(request, response) {
  const source = String(request.query?.source || '').trim();
  const id = String(request.query?.id || '').trim();

  if (!source || !id) {
    response.status(400).json({ error: 'Source and id parameters are required' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const upstreamUrl = `https://streamed.pk/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`;
    const upstream = await fetch(upstreamUrl, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      response
        .status(upstream.status === 404 ? 404 : 502)
        .setHeader('Retry-After', '60')
        .json({ error: 'Stream source unavailable or offline' });
      return;
    }

    const data = await upstream.json();
    response
      .status(200)
      .setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
      .json(data);
  } catch (error) {
    response
      .status(error.name === 'AbortError' ? 504 : 502)
      .setHeader('Retry-After', '60')
      .json({ error: 'Stream data is temporarily unavailable' });
  } finally {
    clearTimeout(timeout);
  }
}
