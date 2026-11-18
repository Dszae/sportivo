import { defineMiddleware } from 'astro:middleware';
import { keepAlive } from './lib/edgeCache';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const host = url.hostname;
  const proto = context.request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');

  // 1. Force Canonical Host & HTTPS:
  // Redirect www.* to non-www and enforce HTTPS with permanent 301
  const isWww = host.startsWith('www.');
  const isHttp = proto === 'http';

  if (isWww || isHttp) {
    const cleanHost = isWww ? host.replace(/^www\./, '') : host;
    const destination = `https://${cleanHost}${url.pathname}${url.search}`;
    return context.redirect(destination, 301);
  }

  // 2. Edge cache: responses that declare `public, s-maxage=N` are kept in the colo cache
  //    for N seconds, so repeat visits are answered in milliseconds without re-rendering.
  const cache = edgePageCache(context.request);
  if (cache) {
    const hit = await cache.match(context.request).catch(() => undefined);
    if (hit) {
      const res = new Response(hit.body, hit);
      const original = res.headers.get('X-Origin-Cache-Control');
      if (original) res.headers.set('Cache-Control', original);
      res.headers.delete('X-Origin-Cache-Control');
      res.headers.set('X-Edge-Cache', 'HIT');
      return res;
    }
  }

  const response = await next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Robots-Tag', 'index, follow');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), autoplay=*');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self' https: data: blob:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https:; " +
    "worker-src 'self' blob: data:; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https:; " +
    "font-src 'self' https://fonts.gstatic.com data: https:; " +
    "connect-src 'self' https: wss: blob: data:; " +
    "img-src 'self' data: blob: https:; " +
    "media-src 'self' blob: data: https:; " +
    "frame-src 'self' blob: data: https:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "frame-ancestors 'self' https:;"
  );
  if (cache) storeInEdgeCache(cache, context.request, response);
  return response;
});

function edgePageCache(request: Request): Cache | null {
  if (import.meta.env.DEV || request.method !== 'GET') return null;
  // Pages do not read cookies, but requests with explicit credentials are never shared.
  if (request.headers.has('authorization')) return null;
  const store = (globalThis as any).caches?.default as Cache | undefined;
  return store && typeof store.match === 'function' ? store : null;
}

function storeInEdgeCache(cache: Cache, request: Request, response: Response): void {
  if (response.status !== 200 || response.headers.has('set-cookie')) return;
  const control = response.headers.get('cache-control') || '';
  const maxAge = /\bpublic\b/.test(control) ? Number(/s-maxage=(\d+)/.exec(control)?.[1]) : 0;
  if (!maxAge) return;

  const copy = new Response(response.clone().body, response);
  // Cache API expiry follows Cache-Control; browsers still get the page's own header.
  copy.headers.set('X-Origin-Cache-Control', control);
  copy.headers.set('Cache-Control', `public, max-age=${maxAge}`);
  copy.headers.set('X-Edge-Cache-Stored', new Date().toISOString());
  const put = cache.put(request, copy).catch(() => {});
  keepAlive(put);
}
