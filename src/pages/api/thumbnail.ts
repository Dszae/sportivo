import type { APIRoute } from 'astro';

export const prerender = false;

// 1x1 transparent PNG fallback if an image fails or is missing
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

const ALLOWED_THUMBNAIL_HOSTS = [
  'strmfree.st',
  'timst.top',
  'a.espncdn.com',
  'i.ibb.co',
  'e0.365dm.com',
  'cdn.jsdelivr.net',
  'd229kpbsb5jevy.cloudfront.net',
  'mgpindia.com',
];

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(TRANSPARENT_PNG, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response(TRANSPARENT_PNG, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  }

  const isAllowed = ALLOWED_THUMBNAIL_HOSTS.some(
    (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
  );

  if (!isAllowed || parsed.protocol !== 'https:') {
    return new Response(TRANSPARENT_PNG, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  }

  try {
    const upstreamRes = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(3500),
    });

    if (!upstreamRes.ok) {
      return new Response(TRANSPARENT_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
      });
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await upstreamRes.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response(TRANSPARENT_PNG, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    });
  }
};

