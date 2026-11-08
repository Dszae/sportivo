import type { APIRoute } from 'astro';
import { fetchLiveMatches, fetchMatches, isCategory } from '../../../lib/sportivo';
import { getSafeCorsHeaders } from '../../../lib/security';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const corsHeaders = getSafeCorsHeaders(request);
  const category = params.category || '';
  if (category === 'live') {
    try {
      const live = await fetchLiveMatches();
      return Response.json(live, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          ...corsHeaders,
        },
      });
    } catch {
      return Response.json(
        { error: 'Live fixtures are temporarily unavailable' },
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  }

  if (!isCategory(category)) {
    return Response.json(
      { error: 'Unsupported sport category' },
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  try {
    const matches = await fetchMatches(category);
    return Response.json(matches, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        ...corsHeaders,
      },
    });
  } catch {
    return Response.json(
      { error: 'Fixture data is temporarily unavailable' },
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          ...corsHeaders,
        },
      }
    );
  }
};