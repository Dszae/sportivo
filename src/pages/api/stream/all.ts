import type { APIRoute } from 'astro';
import { streamService } from '../../../lib/nplStreamService';
import { getSafeCorsHeaders } from '../../../lib/security';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const corsHeaders = getSafeCorsHeaders(request);
  try {
    const streams = await streamService.getAllActiveStreams();
    return Response.json(
      { total: streams.length, streams },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          ...corsHeaders,
        },
      }
    );
  } catch (err: any) {
    return Response.json(
      { error: 'Failed to list active streams', message: err?.message },
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
