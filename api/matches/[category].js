const categories = new Set(['football', 'cricket', 'basketball', 'live']);

export default async function handler(request, response) {
  const category = String(request.query?.category || '').toLowerCase();

  if (!categories.has(category)) {
    response.status(404).json({ error: 'Unsupported sport category' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    let matches = [];

    // Try streamed.pk first
    try {
      const upstream = await fetch(`https://streamed.pk/api/matches/${category}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      const ct = upstream.headers.get('content-type') || '';
      if (upstream.ok && ct.includes('application/json')) {
        const data = await upstream.json();
        if (Array.isArray(data)) matches = data;
      }
    } catch {}

    // Fallback to strmfree if streamed.pk is offline/closed
    if (matches.length === 0) {
      const fixCat = category === 'football' ? 'soccer' : category;
      const [streamRes, fixRes] = await Promise.allSettled([
        fetch('https://strmfree.st/streams', {
          headers: { 'User-Agent': 'Mozilla/5.0', accept: 'application/json' },
          signal: controller.signal,
        }),
        fetch(`https://strmfree.st/fixtures/${fixCat}`, {
          headers: { 'User-Agent': 'Mozilla/5.0', accept: 'application/json' },
          signal: controller.signal,
        }),
      ]);

      const seen = new Set();
      const add = (m) => {
        const id = m.id || m.title;
        if (!id || seen.has(id)) return;
        seen.add(id);
        matches.push(m);
      };

      if (streamRes.status === 'fulfilled' && streamRes.value.ok) {
        const data = await streamRes.value.json().catch(() => ({}));
        for (const item of data?.streams?.[fixCat] || []) {
          add({
            id: item.stream_key || item.id,
            title: item.name,
            category,
            status: 'live',
            date: item.match_timestamp ? item.match_timestamp * 1000 : Date.now(),
            poster: item.thumbnail_url ? `https://strmfree.st${item.thumbnail_url}` : undefined,
            sources: [{ source: 'strmfree', id: item.stream_key || item.id }],
          });
        }
      }

      if (fixRes.status === 'fulfilled' && fixRes.value.ok) {
        const data = await fixRes.value.json().catch(() => ({}));
        const dates = Object.keys(data?.fixtures || {}).slice(0, 2);
        for (const d of dates) {
          if (matches.length >= 25) break;
          for (const item of (data.fixtures[d]?.fixtures || []).slice(0, 15)) {
            if (matches.length >= 25) break;
            const raw = item.event_name || '';
            const title = raw.includes(' at ') ? raw.replace(' at ', ' vs ') : raw;
            add({
              id: item.event_name,
              title,
              category,
              status: item.date_unix && item.date_unix * 1000 <= Date.now() ? 'live' : 'upcoming',
              date: item.date_unix ? item.date_unix * 1000 : d,
              poster: item.team1?.logo || item.team2?.logo || undefined,
              sources: [{ source: 'strmfree', id: item.event_name }],
            });
          }
        }
      }

      if (category === 'cricket' && matches.length < 5) {
        try {
          const cRes = await fetch('https://timst.top/api/channels', { signal: controller.signal });
          if (cRes.ok) {
            const cData = await cRes.json();
            for (const c of (cData.channels || []).filter(c => c.name?.toLowerCase().includes('cricket') || c.name?.toLowerCase().includes('willow'))) {
              add({
                id: c.url,
                title: c.name,
                category: 'cricket',
                status: 'live',
                date: 0,
                poster: c.logo,
                sources: [{ source: 'direct', id: c.streams?.[0]?.url }],
              });
            }
          }
        } catch {}
      }
    }

    response
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
      .json(matches.slice(0, 30));
  } catch (error) {
    response
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json([]);
  } finally {
    clearTimeout(timeout);
  }
}
