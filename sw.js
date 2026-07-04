/* sw.js — Dil Harita service worker
   v3: AĞ-ÖNCELİKLİ + ÖNBELLEK YEDEĞİ.
   - Her istek önce AĞDAN alınır (dosyalar her zaman güncel — "yükledim ama değişmedi" biter).
   - Başarılı yanıtlar önbelleğe kopyalanır; ağ yoksa önbellekten sunulur (offline çalışır,
     eski 503 hatası biter).
   - Bildirim tıklama/push davranışı v2 ile aynı.
*/
var SW_VERSION = "dh-sw-v3";
var CACHE = SW_VERSION;

self.addEventListener("install", function(event){
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil((async function(){
    try{
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){ return k===CACHE ? null : caches.delete(k); }));
    }catch(e){}
    try{ await self.clients.claim(); }catch(e){}
  })());
});

self.addEventListener("fetch", function(event){
  var req = event.request;
  // yalnız GET ve http(s) — Firestore/analytics POST'larına karışma
  if (req.method !== "GET" || req.url.indexOf("http") !== 0) return;
  event.respondWith((async function(){
    try{
      var res = await fetch(req);
      // yalnız kendi origin'imizin başarılı yanıtlarını önbelleğe al
      try{
        if (res && res.ok && new URL(req.url).origin === self.location.origin){
          var c = await caches.open(CACHE);
          c.put(req, res.clone());
        }
      }catch(e){}
      return res;
    }catch(e){
      var hit = await caches.match(req, { ignoreSearch:true });
      if (hit) return hit;
      return new Response("", { status: 503, statusText: "offline" });
    }
  })());
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
