import type { APIRoute } from 'astro';

export const prerender = false;

let streamService: any = null;
try {
  streamService = require('../../../../npl/streamService');
} catch {
  try {
    streamService = require('../../../../../mobile/npl/streamService');
  } catch {}
}

export const GET: APIRoute = async ({ request }) => {
  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    return Response.json(
      { error: "Query parameter 'url' is required" },
      { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    let alive = false;
    if (streamService && typeof streamService.isStreamAlive === 'function') {
      alive = await streamService.isStreamAlive(targetUrl);
    } else {
      const probe = await fetch(targetUrl, { method: 'HEAD', signal: AbortSignal.timeout(3500) });
      alive = probe.ok || probe.status === 200 || probe.status === 206;
    }

    return Response.json(
      { url: targetUrl, alive, status: alive ? 200 : 503 },
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch {
    return Response.json(
      { url: targetUrl, alive: false, status: 503 },
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};

