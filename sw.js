/* sw.js — Dil Harita service worker
   v2: Kalıcı SW. Bildirim tıklama desteği eklendi.

   NOT: Önceki sürüm her açılışta cache'i silip kendini unregister eden
   bir "kill switch" idi (eski bozuk cache sorununu çözmek için). Artık
   bildirimler için kalıcı bir SW gerektiğinden o davranış kaldırıldı.
   Yine de güvenli geçiş için: aktivasyonda ESKİ cache'ler temizlenir,
   ama SW kendini SİLMEZ (kayıtlı kalır). Offline cache bilinçli olarak
   eklenmedi (mevcut mimaride fetch doğrudan ağa gider).
*/
var SW_VERSION = "dh-sw-v2";

self.addEventListener("install", function(event){
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil((async function(){
    try{
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){ return caches.delete(k); }));
    }catch(e){}
    try{ await self.clients.claim(); }catch(e){}
  })());
});

self.addEventListener("fetch", function(event){
  event.respondWith(fetch(event.request).catch(function(){
    return new Response("", { status: 503, statusText: "offline" });
  }));
});

self.addEventListener("notificationclick", function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "./index.html";
  event.waitUntil(
    self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(function(list){
      for(var i=0;i<list.length;i++){
        var c = list[i];
        if(c.url && c.url.indexOf("index.html")!==-1 && "focus" in c) return c.focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("push", function(event){
  var payload = {};
  try{ payload = event.data ? event.data.json() : {}; }catch(e){ payload = {}; }
  var n = payload.notification || payload || {};
  var title = n.title || "Dil Harita";
  var options = {
    body: n.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: (payload.data && payload.data.tag) || "dh-push",
    renotify: true,
    data: { url: (payload.data && payload.data.url) || "./index.html" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
