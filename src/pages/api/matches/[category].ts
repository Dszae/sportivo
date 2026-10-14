import type { APIRoute } from 'astro';
import { fetchMatches, isCategory } from '../../../lib/sportivo';

export const GET: APIRoute = async ({ params }) => {
  const category = params.category || '';
  if (!isCategory(category)) return Response.json({ error: 'Unsupported sport category' }, { status: 404 });
  try {
    const matches = await fetchMatches(category);
    return Response.json(matches, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch {
    return Response.json({ error: 'Fixture data is temporarily unavailable' }, { status: 502, headers: { 'Retry-After': '60' } });
  }
};