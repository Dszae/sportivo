// Sportivo Service Worker: Background Match Alerts & Offline Support
const CACHE_NAME = 'sportivo-pwa-v3';
const STATIC_ASSETS = [
  '/',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/icon-192x192.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate Event
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

// 1. Web Push Notification Event (Fires when website tab is closed / browser in background)
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: '🔔 Sportivo Match Alert', message: event.data.text() };
    }
  }

  const title = payload.title || '🔔 Sportivo Match Alert';
  const options = {
    body: payload.message || 'Live match moment from your watchlist!',
    icon: payload.icon || '/icon-192x192.png',
    badge: '/favicon-48x48.png',
    tag: payload.key || payload.tag || `sportivo-alert-${Date.now()}`,
    data: {
      url: payload.matchUrl || payload.url || '/',
      timestamp: Date.now()
    },
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      { action: 'open_match', title: '📺 View Match' },
      { action: 'dismiss', title: 'Close' }
    ]
  };

  // Only display OS notification if user is NOT actively focused on the site
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const isUserActivelyFocused = clientList.some(
        (client) => client.focused && client.visibilityState === 'visible'
      );
      if (isUserActivelyFocused) {
        // User is already watching / actively interacting with the tab. Silence notification!
        return;
      }
      return self.registration.showNotification(title, options);
    })
  );
});

// 2. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a Sportivo window/tab is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new browser window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 3. Periodic Background Sync (For supported Chromium browsers even if all tabs closed)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sportivo-match-check') {
    event.waitUntil(
      fetch('/api/cron/match-alerts')
        .then((res) => res.json())
        .catch(() => {})
    );
  }
});

// 4. Client Communication: Allow page to show notifications directly through Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
});

// 5. Fetch Event Handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept cross-origin CDN requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never intercept API endpoints, push routes, or streaming routes
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/stream/')) {
    return;
  }

  // Network-first for navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) || (await cache.match('/'));
      })
    );
    return;
  }

  // For same-origin images: Network-first, fallback to cache
  if (request.destination === 'image') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static local fonts & stylesheets
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
