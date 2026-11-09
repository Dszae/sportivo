import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: 'https://github.com/Dszae/sportivo/releases/latest/download/app-release.apk',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
