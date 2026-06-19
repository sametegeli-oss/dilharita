self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch(e) {}
    try { await self.registration.unregister(); } catch(e) {}
    const clientsList = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    clientsList.forEach(client => client.navigate(client.url));
  })());
});
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
