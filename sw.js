// sw.js - Service Worker
const CACHE_NAME = 'dilharita-v1';
const ASSETS = [
  '/',
  '/index-app.html',
  '/assets/app.js',
  '/assets/app.css',
  '/data/sentences.json'
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cache açıldı');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  return self.clients.claim();
});

// Fetch
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          });
      })
  );
});

// Message (cache temizleme için)
self.addEventListener('message', event => {
  if (event.data === 'clearCache') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('🗑️ Cache temizlendi');
      event.ports[0].postMessage({ success: true });
    });
  }
});
