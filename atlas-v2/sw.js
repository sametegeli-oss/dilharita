/* ═══════════════════════════════════════════════════════════════
   ATLAS · SERVICE WORKER  (v1)
   Strateji:
   · HTML  → ağ önce. Yüklediğin değişiklik anında görünür.
   · JS/CSS/görsel/JSON → stale-while-revalidate. Sayfa anında
     önbellekten açılır, yeni sürüm arka planda iner.
   · Dış origin (fonts, AI sağlayıcıları) → hiç karışılmaz.
   ═══════════════════════════════════════════════════════════════ */
var SURUM = 'atlas-v6';
var KABUK = SURUM + '-kabuk';
var VARLIK = SURUM + '-varlik';

var ONBELLEK = [
  './',
  './index.html',
  './css/atlas.css',
  './js/core.js',
  './js/veri.js',
  './js/ses.js',
  './js/ai.js',
  './js/ui.js',
  './js/result-effects.js',
  './js/app.js',
  './js/ekran-ogren.js',
  './js/ekran-kelime.js',
  './js/ekran-analiz.js',
  './js/ekran-sohbet.js',
  './js/ekran-ayar.js',
  './manifest.webmanifest',
  './data/sentences/index.json',
  './assets/avatar/idle.webp'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(KABUK).then(function (c) {
      /* tek tek ekle — biri düşerse kurulum komple çökmesin */
      return Promise.all(ONBELLEK.map(function (u) {
        return c.add(u).catch(function () { });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (anahtarlar) {
      return Promise.all(anahtarlar.map(function (k) {
        if (k.indexOf(SURUM) !== 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (ev) {
  var istek = ev.request;
  if (istek.method !== 'GET') return;

  var url = new URL(istek.url);
  if (url.origin !== location.origin) return;   /* dış origin'e karışma */

  var htmlMi = istek.mode === 'navigate' ||
    (istek.headers.get('accept') || '').indexOf('text/html') > -1;

  if (htmlMi) {
    ev.respondWith(
      fetch(istek).then(function (y) {
        var kopya = y.clone();
        caches.open(KABUK).then(function (c) { c.put(istek, kopya); });
        return y;
      }).catch(function () {
        return caches.match(istek).then(function (c) {
          return c || caches.match('./index.html');
        });
      })
    );
    return;
  }

  ev.respondWith(
    caches.match(istek).then(function (onbellek) {
      var ag = fetch(istek).then(function (y) {
        if (y && y.status === 200) {
          var kopya = y.clone();
          caches.open(VARLIK).then(function (c) { c.put(istek, kopya); });
        }
        return y;
      }).catch(function () { return onbellek; });
      return onbellek || ag;
    })
  );
});

self.addEventListener('message', function (ev) {
  if (ev.data === 'atla') self.skipWaiting();
});
