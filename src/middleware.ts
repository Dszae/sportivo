import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://strmfree.st https://*.strmfree.st https://timst.top https://*.timst.top https://thedaddy.pk https://*.thedaddy.pk https://site.api.espn.com https://ehgembxe.cfd https://*.ehgembxe.cfd https://api.ppv.st https://*.ppv.st https://taifood-blog.asia https://*.taifood-blog.asia https://static.ppvservices.st https://*.ppvservices.st https://nepalpremierleague.org https://*.nettvstreamz.com https://*.cdn.rumble.cloud https://*.pages.dev https://*.onrender.com https://*.railway.app https://*.up.railway.app; img-src 'self' data: https:; media-src 'self' https://commondatastorage.googleapis.com https://timst.top https://*.timst.top https://ehgembxe.cfd https://*.ehgembxe.cfd https://*.nettvstreamz.com https://*.cdn.rumble.cloud https:; frame-src 'self' https://thedaddy.pk https://*.thedaddy.pk https://strmfree.st https://*.strmfree.st https://wigilive.top https://*.wigilive.top https://timst.top https://*.timst.top https://ehgembxe.cfd https://*.ehgembxe.cfd https://taifood-blog.asia https://*.taifood-blog.asia https://ppv.st https://*.ppv.st https://commondatastorage.googleapis.com https://stream.mux.com https://www.youtube.com https://*.youtube.com https://www.youtube-nocookie.com https://*.youtube-nocookie.com https://rumble.com https://*.rumble.com https://nepalpremierleague.org https://*.pages.dev; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  );
  return response;
});
