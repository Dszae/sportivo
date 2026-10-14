import type { APIRoute } from 'astro';
import { fetchStream } from '../../../../lib/sportivo';

export const GET: APIRoute = async ({ params }) => {
  if (!params.source || !params.id) return Response.json({ error: 'Stream source not found' }, { status: 404 });
  try { return Response.json(await fetchStream(params.source, params.id)); } catch { return Response.json({ error: 'Stream is temporarily unavailable' }, { status: 502, headers: { 'Retry-After': '60' } }); }
};