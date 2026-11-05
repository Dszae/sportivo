import type { APIRoute } from 'astro';
import { streamService } from '../../../lib/nplStreamService';

export const prerender = false;

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
    const alive = await streamService.isStreamAlive(targetUrl);
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
