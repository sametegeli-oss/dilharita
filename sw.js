/* sw.js — Dil Harita service worker
   v4: HIZ + GÜNCELLİK DENGESİ
   ------------------------------------------------------------------
   v3'te HER istek ağdan alınıyordu; bu yüzden mobilde her açılış ağı
   beklemek zorundaydı ve hiç açılmamış bir sayfa çevrimdışı çalışmıyordu.

   v4 stratejisi:
   1) KURULUMDA kabuk dosyaları önbelleğe alınır → ilk çevrimdışı açılış da çalışır.
   2) HTML sayfaları: AĞ-ÖNCELİKLİ (yüklediğiniz değişiklik anında görünür,
      "yükledim ama değişmedi" olmaz), ağ yoksa önbellekten.
   3) JS/CSS/görsel/font/JSON: ÖNBELLEK-ÖNCELİKLİ + ARKA PLANDA TAZELEME
      (stale-while-revalidate). Sayfa anında açılır, yeni sürüm sessizce
      indirilip bir sonraki açılışta devreye girer.
   4) Bildirim tıklama / push davranışı v3 ile aynı.
*/
var SW_VERSION = "dh-sw-v30";
var CACHE = SW_VERSION;

/* İlk açılışta hazır olması gereken minimum kabuk. Listeyi kısa tutun:
   büyük veri dosyaları buraya GİRMEZ, onlar ilk kullanımda önbelleğe alınır. */
var SHELL = [
  "./index.html",
  "./menu.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./auth-guard.js",
  "./study-tracker.js",
  "./learning-error-system.js",
  "./ux-boost.js",
  "./sentences-loader.js",
  "./profile.js",
  "./speech-fallback.js",
  "./viseme-lang.js",
  "./word-popup.js",
  "./ai-providers.js",
  "./onboarding-guard.js",
  "./dh-modul.js",
  "./dh-modul-enjekte.js",
  "./dh-modul-vitrin.js",
  "./basla.html",
  "./data/sentences/index.json",
  "./data/sentences/examples.json",
  "./icons/icon-192.png",
  "./assets/avatars_v3/teacher/idle.webp",
  "./assets/avatars_v3/teacher/blink.webp",
  "./assets/avatars_v3/teacher/mouth-small.webp",
  "./assets/avatars_v3/teacher/mouth-medium.webp",
  "./assets/avatars_v3/teacher/mouth-open.webp",
  /* Sesbirim (viseme) kareleri — dh-avatar.js bunlari agiz senkronu icin
     kullanir. Onbellekte YOKKEN cevrimdisi acilirsa KOMSU haritasi en
     yakin kareye duser: cokme olmaz ama agiz kaba oynar. Toplam ~580 KB (9 x ~65 KB);
     kurulum bir kez agir, sonrasi tamamen cevrimdisi. */
  "./assets/avatars_v3/teacher/mouth-a.webp",
  "./assets/avatars_v3/teacher/mouth-e.webp",
  "./assets/avatars_v3/teacher/mouth-i.webp",
  "./assets/avatars_v3/teacher/mouth-o.webp",
  "./assets/avatars_v3/teacher/mouth-u.webp",
  "./assets/avatars_v3/teacher/mouth-mbp.webp",
  "./assets/avatars_v3/teacher/mouth-fv.webp",
  "./assets/avatars_v3/teacher/mouth-l.webp",
  "./assets/avatars_v3/teacher/mouth-th.webp"
];

self.addEventListener("install", function(event){
  event.waitUntil((async function(){
    try{
      var c = await caches.open(CACHE);
      // tek tek ekle: biri 404 olsa bile kurulum çökmesin
      await Promise.all(SHELL.map(function(u){
        return c.add(new Request(u, {cache:"reload"})).catch(function(){});
      }));
    }catch(e){}
    try{ await self.skipWaiting(); }catch(e){}
  })());
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

/* stale-while-revalidate: önbellekteki varsa hemen dön, arka planda tazele */
async function swr(event, req){
  var cached = await caches.match(req, { ignoreSearch:true });
  var refresh = fetch(req).then(async function(r){
    if(r && r.ok){
      try{ (await caches.open(CACHE)).put(req, r.clone()); }catch(e){}
    }
    return r;
  }).catch(function(){ return null; });

  if(cached){
    // kullanıcıyı bekletme, tazelemeyi arka plana at
    try{ event.waitUntil(refresh); }catch(e){}
    return cached;
  }
  var fresh = await refresh;
  if(fresh) return fresh;
  return new Response("", { status:503, statusText:"offline" });
}

/* ağ-öncelikli + önbellek yedeği (HTML sayfaları için) */
async function networkFirst(req){
  try{
    var res = await fetch(req);
    try{
      if(res && res.ok && new URL(req.url).origin === self.location.origin){
        (await caches.open(CACHE)).put(req, res.clone());
      }
    }catch(e){}
    return res;
  }catch(e){
    var hit = await caches.match(req, { ignoreSearch:true });
    if(hit) return hit;
    // çevrimdışı ve önbellekte yok → ana sayfayı ver
    var shell = await caches.match("./index.html", { ignoreSearch:true });
    if(shell) return shell;
    return new Response("Çevrimdışısın ve bu sayfa henüz indirilmemiş.", {
      status:503, headers:{"Content-Type":"text/plain; charset=utf-8"}
    });
  }
}

var STATIC_RE = /\.(?:js|mjs|css|json|webp|png|jpe?g|svg|gif|woff2?|ttf|mp3|wav|ico)$/i;

self.addEventListener("fetch", function(event){
  var req = event.request;
  // yalnız GET ve http(s) — Firestore/analytics POST'larına karışma
  if (req.method !== "GET" || req.url.indexOf("http") !== 0) return;

  var url;
  try{ url = new URL(req.url); }catch(e){ return; }

  // dış origin (Firebase, AI sağlayıcıları, CDN) → dokunma
  if (url.origin !== self.location.origin) return;

  // service worker dosyaları asla önbellekten sunulmaz
  if (url.pathname.indexOf("/sw.js") !== -1 ||
      url.pathname.indexOf("firebase-messaging-sw.js") !== -1) return;

  var isDoc = req.mode === "navigate" ||
              /\.html?$/i.test(url.pathname) ||
              url.pathname.endsWith("/");

  event.respondWith(isDoc ? networkFirst(req)
                          : (STATIC_RE.test(url.pathname) ? swr(event, req) : networkFirst(req)));
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

/* sayfadan "hemen güncelle": reg.waiting.postMessage("skip-waiting") */
self.addEventListener("message", function(e){
  if(e.data === "skip-waiting"){ self.skipWaiting(); }
});
