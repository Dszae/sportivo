import { defineMiddleware } from 'astro:middleware';

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

  const response = await next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'no-referrer-when-downgrade');
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
  return response;
});
