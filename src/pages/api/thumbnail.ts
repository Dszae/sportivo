import type { APIRoute } from 'astro';

export const prerender = false;

function isSafePublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  if (!host) return false;

  // Reject loopbacks, private subnets, and cloud metadata
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '169.254.169.254' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  ) {
    return false;
  }

  // Must have valid public domain format
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host);
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing url parameter', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response('Invalid url', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || !isSafePublicHost(parsed.hostname)) {
    return new Response('Disallowed host or protocol', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  try {
    const upstreamRes = await fetch(parsed.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!upstreamRes.ok) {
      return new Response('Upstream returned error', {
        status: 404,
        headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=300' },
      });
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return new Response('Not an image', {
        status: 404,
        headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=300' },
      });
    }

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
    return new Response('Failed to retrieve image', {
      status: 404,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=60' },
    });
  }
};
