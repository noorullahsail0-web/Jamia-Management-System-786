const CACHE_NAME = 'jamia-system-v6';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Robust caching: attempt to cache each asset individually so one error doesn't break the installation
      return Promise.all(
        ASSETS.map((asset) => 
          cache.add(asset).catch((err) => 
            console.log(`Failed to cache asset ${asset} during install:`, err)
          )
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
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

self.addEventListener('fetch', (e) => {
  // Only cache GET requests and skip Firebase Auth / Firestore / external API URLs
  if (e.request.method !== 'GET' || 
      e.request.url.includes('firestore') || 
      e.request.url.includes('identitytoolkit') || 
      e.request.url.includes('googleapis.com') ||
      e.request.url.includes('chrome-extension')) {
    return;
  }

  // Handle same-origin assets caching safely
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((response) => {
        // Caching successful responses
        if (!response || response.status !== 200) {
          return response;
        }
        
        // Cache same-origin responses
        const url = new URL(e.request.url);
        if (url.origin === self.location.origin) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      }).catch((err) => {
        // Return cached index.html for SPA navigation requests when offline
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html').then((cachedIndex) => {
            return cachedIndex || caches.match('/');
          });
        }
        // Throw error to browser instead of returning undefined
        throw err;
      });
    })
  );
});

