/**
 * WashGuard Service Worker (v2.0)
 * Network-First strategy with offline fallback so updates are always seen immediately.
 */

const CACHE_NAME = 'washguard-cache-v2.9';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/icons/icon.svg',
  './assets/js/app.js',
  './assets/js/engine/washSaleEngine.js',
  './assets/js/engine/parser.js',
  './assets/js/engine/export.js',
  './assets/js/ui/timeline.js',
  './assets/js/ui/monetization.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Network-First strategy: Always fetch latest from server/filesystem, fallback to cache if offline
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => cached || caches.match('./index.html'));
      })
  );
});
