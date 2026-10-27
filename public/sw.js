const CACHE_NAME = 'sportivo-pwa-v2';
const STATIC_ASSETS = [
  '/',
  '/offline/',
  '/favicon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. NEVER intercept cross-origin CDN requests (e.g. Unsplash images, external player streams, CDN crests)
  // Let the browser fetch them directly with standard HTTP caching
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. Never intercept API endpoints or dynamic streaming routes
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/stream/')) {
    return;
  }

  // 3. Network-first for navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) || (await cache.match('/offline/'));
      })
    );
    return;
  }

  // 4. For same-origin images: Network-first to guarantee fresh assets, fallback to cache if offline
  if (request.destination === 'image') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // 5. Cache-first only for static local fonts & stylesheets
  if (request.destination === 'font' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => caches.match(request));
      })
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
