/* ════════════════════════════════════════════════════════════════════
   Service Worker — WordMode
   - Kod dosyaları (HTML/JS/CSS) NETWORK-FIRST: her açılışta GitHub'dan taze
     gelir. Güncelleme anında görünür. Ağ yoksa cache'ten (offline) çalışır.
   - Diğer varlıklar (json/resim/font) CACHE-FIRST: hızlı + offline.
   - DİKKAT: Kullanıcı verisi (ilerleme, resimler, ayarlar) IndexedDB'dedir;
     bu SW ona DOKUNMAZ. Cache temizliği sadece kod dosyalarını etkiler.
   ════════════════════════════════════════════════════════════════════ */
const CACHE = 'wordmode-free-v4-20260604';   // sürüm artınca eski kod cache'i otomatik silinir
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/vocab-data.js', './js/legacy-app.js', './js/sentence-mode-core.js', './js/app.js', './js/free_features.js', './js/fixes.js',
  './data/sozluk.json', './manifest.webmanifest'
];

// Kod dosyası mı? (network-first uygulanacaklar)
function isCodeAsset(url) {
  return /\.(?:html|js|css)(?:\?.*)?$/i.test(url) ||
         url.endsWith('/') ||
         /\/index\.html$/i.test(url);
}

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  if (isCodeAsset(url)) {
    // NETWORK-FIRST: önce ağdan (en yeni kod), olmazsa cache (offline yedek)
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // CACHE-FIRST: varlıklar (json/resim) — hızlı, ağ varsa arka planda günceller
    e.respondWith(
      caches.match(e.request).then(c =>
        c || fetch(e.request).then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(cc => cc.put(e.request, copy)).catch(() => {});
          return r;
        }).catch(() => c)
      )
    );
  }
});
