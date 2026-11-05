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

export const GET: APIRoute = async () => {
  try {
    if (!streamService || typeof streamService.getAllActiveStreams !== 'function') {
      return Response.json(
        { error: 'StreamService module is unavailable' },
        { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const streams = await streamService.getAllActiveStreams();
    return Response.json(
      { total: streams.length, streams },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err: any) {
    return Response.json(
      { error: 'Failed to list active streams', message: err?.message },
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
};

