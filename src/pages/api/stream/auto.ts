import type { APIRoute } from 'astro';
import { streamService } from '../../../lib/nplStreamService';
import { getSafeCorsHeaders } from '../../../lib/security';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const corsHeaders = getSafeCorsHeaders(request);
  try {
    const stream = await streamService.getAutoStream();
    return Response.json(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        ...corsHeaders,
      },
    });
  } catch (err: any) {
    return Response.json(
      { error: 'Failed to resolve auto live stream', message: err?.message },
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};
