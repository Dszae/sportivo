import type { APIRoute } from 'astro';
import { fetchLiveBallMoments } from '../../../lib/scoreService';

export const prerender = false;

export const GET: APIRoute = async () => {
  const result = await fetchLiveBallMoments();

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
      },
    }
  );
};

