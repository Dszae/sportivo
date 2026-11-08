import type { APIRoute } from 'astro';
import { streamService } from '../../../lib/nplStreamService';
import { isAllowedPlaybackDomain } from '../../../lib/providers/allowlist';
import { getSafeCorsHeaders } from '../../../lib/security';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const corsHeaders = getSafeCorsHeaders(request);
  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    return Response.json(
      { error: "Query parameter 'url' is required" },
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Prevent SSRF: only allow probe of approved stream domains
  try {
    const parsed = new URL(targetUrl);
    if (!isAllowedPlaybackDomain(parsed.hostname)) {
      return Response.json(
        { error: 'Probing disallowed domain' },
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  } catch {
    return Response.json(
      { error: 'Invalid url target' },
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const alive = await streamService.isStreamAlive(targetUrl);
    return Response.json(
      { url: targetUrl, alive, status: alive ? 200 : 503 },
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch {
    return Response.json(
      { url: targetUrl, alive: false, status: 503 },
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
};
