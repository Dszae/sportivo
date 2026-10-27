import type { APIRoute } from 'astro';
import { fetchLiveMatches, fetchMatches, isCategory } from '../../../lib/sportivo';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const category = params.category || '';
  if (category === 'live') {
    try {
      const live = await fetchLiveMatches();
      return Response.json(live, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      return Response.json([], {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  if (!isCategory(category)) {
    return Response.json(
      { error: 'Unsupported sport category' },
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
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
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return Response.json([], {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};