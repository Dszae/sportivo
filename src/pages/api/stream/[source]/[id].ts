import type { APIRoute } from 'astro';
import { resolveUnifiedPlayback, sanitizeIdentifier } from '../../../../lib/providers';
import { getSafeCorsHeaders } from '../../../../lib/security';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const corsHeaders = getSafeCorsHeaders(request);
  const sourceParam = params.source;
  const idParam = params.id;

  const source = sanitizeIdentifier(sourceParam);
  const id = sanitizeIdentifier(idParam);

  if (!source || !id) {
    return Response.json(
      { error: 'Invalid or missing stream parameters' },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  try {
    const resolution = await resolveUnifiedPlayback(source, id);

    if (resolution.status === 'ready' && resolution.streams.length > 0) {
      return Response.json(resolution.streams, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          ...corsHeaders,
        },
      });
    }

    const statusCode = resolution.status === 'unsupported' ? 400 : resolution.status === 'unavailable' ? 404 : 502;
    return Response.json(
      {
        error: resolution.error || 'Stream feed is currently offline or waiting for pre-match broadcast signal.',
        status: resolution.status,
        provider: resolution.provider,
      },
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          ...corsHeaders,
        },
      }
    );
  } catch {
    return Response.json(
      { error: 'Stream resolution failed temporarily' },
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
