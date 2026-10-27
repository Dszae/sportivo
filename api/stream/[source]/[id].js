export default async function handler(request, response) {
  const source = String(request.query?.source || '').trim();
  const id = String(request.query?.id || '').trim();

  if (!source || !id) {
    response.status(400).json({ error: 'Source and id parameters are required' });
    return;
  }

  if (source === 'direct') {
    response.status(200).json([{ embedUrl: id, hd: true, language: 'English' }]);
    return;
  }

  if (source === 'strmfree') {
    try {
      const res = await fetch(`https://strmfree.st/api/v1/sources/${encodeURIComponent(id)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        const sources = data?.sources || [];
        if (sources.length > 0) {
          response.status(200).json(
            sources.map((url) => ({
              embedUrl: url,
              hd: url.includes('1080p') || url.includes('720p'),
              language: 'English',
            }))
          );
          return;
        }
      }
    } catch {}

    response.status(200).json([
      {
        embedUrl: `https://strmfree.st/embed/soccer/${encodeURIComponent(id)}1080p`,
        hd: true,
        language: 'English',
      },
    ]);
    return;
  }

  if (source === 'timst') {
    response.status(200).json([
      {
        embedUrl: id.startsWith('http') ? id : `https://timst.top/${id}`,
        hd: true,
        language: 'English',
      },
    ]);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const upstreamUrl = `https://streamed.pk/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`;
    const upstream = await fetch(upstreamUrl, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    if (upstream.ok) {
      const data = await upstream.json();
      response
        .status(200)
        .setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
        .json(data);
      return;
    }
  } catch {} finally {
    clearTimeout(timeout);
  }

  // Graceful fallback
  response.status(200).json([{ embedUrl: id, hd: true, language: 'English' }]);
}
