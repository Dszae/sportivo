export default async function handler(request, response) {
  const { source, id } = request.query || {};

  if (!source || !id) {
    response.status(400).json({ error: 'Missing stream source or stream id' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const upstream = await fetch(
      `https://streamed.pk/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
      {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      }
    );

    if (!upstream.ok) {
      response
        .status(502)
        .setHeader('Retry-After', '60')
        .json({ error: 'Stream provider unavailable' });
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
      .json({ error: 'Stream is temporarily unavailable' });
  } finally {
    clearTimeout(timeout);
  }
}

