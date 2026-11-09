import type { APIRoute } from 'astro';
import { fetchLiveBallMoments } from '../../../../lib/scoreService';
import { getSafeCorsHeaders } from '../../../../lib/security';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const preferredMatch = url.searchParams.get('match') || url.searchParams.get('slug') || undefined;
  const result = await fetchLiveBallMoments(preferredMatch);
  const corsHeaders = getSafeCorsHeaders(request);

  return new Response(
    JSON.stringify(
      result || {
        score: '',
        overs: '',
        moments: [],
      }
    ),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
        ...corsHeaders,
      },
    }
  );
};

