import type { APIRoute } from 'astro';
import { fetchStream } from '../../../../lib/sportivo';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  if (!params.source || !params.id) {
    return Response.json({ error: 'Stream source not found' }, { status: 404 });
  }

  try {
    const data = await fetchStream(params.source, params.id);
    return Response.json(data, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return Response.json(
      { error: 'Stream is temporarily unavailable' },
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};