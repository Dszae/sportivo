import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://strmfree.st https://timst.top https://thedaddy.pk https://site.api.espn.com; img-src 'self' data: https:; media-src 'self' https://commondatastorage.googleapis.com https://timst.top https:; frame-src 'self' https://thedaddy.pk https://strmfree.st https://wigilive.top https://timst.top https://commondatastorage.googleapis.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  );
  return response;
});
