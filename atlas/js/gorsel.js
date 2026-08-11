/* ═══════════════════════════════════════════════════════════════
   ATLAS · CÜMLE GÖRSELİ
   Veri setindeki her cümlenin bir `imgQuery` alanı var
   (data/sentences/img-queries.json — 8.900 eşleme). Bu dosya
   projede duruyordu ama hiç kullanılmıyordu; artık kullanılıyor.

   Kaynak sırası (ilki cevap verirse diğerlerine gidilmez):
     1. Pexels        — yalnız ayarlarda anahtar varsa, en iyi sonuç
     2. Openverse     — anahtarsız, açık lisanslı
     3. Wikimedia Commons
     4. Wikipedia sayfa görseli
   Bulunan URL IndexedDB'ye yazılır; aynı cümle bir daha aranmaz.
   Görsel bulunamazsa hiçbir şey gösterilmez — boş kutu, kırık ikon yok.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var DB_ADI = 'atlas-gorsel', DEPO = 'kv';
  var bellek = {};        /* sorgu → url (oturum içi) */
  var sorguHaritasi = null;

  /* ───── IndexedDB önbellek ─────────────────────────────────── */
  function dbAc() {
    return new Promise(function (coz) {
      if (!global.indexedDB) return coz(null);
      var istek;
      try { istek = indexedDB.open(DB_ADI, 1); } catch (e) { return coz(null); }
      istek.onupgradeneeded = function () {
        var db = istek.result;
        if (!db.objectStoreNames.contains(DEPO)) db.createObjectStore(DEPO);
      };
      istek.onsuccess = function () { coz(istek.result); };
      istek.onerror = function () { coz(null); };
    });
  }
  function kvAl(anahtar) {
    return dbAc().then(function (db) {
      if (!db) return null;
      return new Promise(function (coz) {
        try {
          var t = db.transaction(DEPO, 'readonly').objectStore(DEPO).get(anahtar);
          t.onsuccess = function () { db.close(); coz(t.result || null); };
          t.onerror = function () { db.close(); coz(null); };
        } catch (e) { try { db.close(); } catch (x) {} coz(null); }
      });
    });
  }
  function kvYaz(anahtar, deger) {
    return dbAc().then(function (db) {
      if (!db) return;
      try {
        var t = db.transaction(DEPO, 'readwrite');
        t.objectStore(DEPO).put(deger, anahtar);
        t.oncomplete = function () { db.close(); };
        t.onerror = function () { db.close(); };
      } catch (e) { try { db.close(); } catch (x) {} }
    });
  }

  /* ───── kaynaklar ──────────────────────────────────────────── */
  function pexels(q) {
    var anahtar = (Atlas.Ayar.al().gorselAnahtar || '').trim();
    if (!anahtar) return Promise.resolve(null);
    return fetch('https://api.pexels.com/v1/search?per_page=1&query=' + encodeURIComponent(q),
      { headers: { Authorization: anahtar } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var f = j && j.photos && j.photos[0];
        return f ? { url: f.src.large, kaynak: 'Pexels', sahip: f.photographer, sayfa: f.url } : null;
      }).catch(function () { return null; });
  }

  function openverse(q) {
    return fetch('https://api.openverse.org/v1/images/?page_size=1&mature=false&q=' + encodeURIComponent(q),
      { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var f = j && j.results && j.results[0];
        return f ? { url: f.thumbnail || f.url, kaynak: 'Openverse', sahip: f.creator || '', sayfa: f.foreign_landing_url } : null;
      }).catch(function () { return null; });
  }

  function commons(q) {
    return fetch('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
      '&generator=search&gsrlimit=1&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=700' +
      '&gsrsearch=' + encodeURIComponent('filetype:bitmap ' + q))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var s = j && j.query && j.query.pages;
        if (!s) return null;
        var ilk = s[Object.keys(s)[0]];
        var bilgi = ilk && ilk.imageinfo && ilk.imageinfo[0];
        return bilgi ? { url: bilgi.thumburl || bilgi.url, kaynak: 'Wikimedia Commons', sayfa: bilgi.descriptionurl } : null;
      }).catch(function () { return null; });
  }

  function wikipedia(q) {
    return fetch('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srlimit=1&srsearch=' + encodeURIComponent(q))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var h = j && j.query && j.query.search && j.query.search[0];
        if (!h) return null;
        return fetch('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=700&pageids=' + h.pageid)
          .then(function (r2) { return r2.ok ? r2.json() : null; })
          .then(function (j2) {
            var s = j2 && j2.query && j2.query.pages && j2.query.pages[h.pageid];
            var t = s && s.thumbnail;
            return t ? { url: t.source, kaynak: 'Wikipedia', sayfa: 'https://en.wikipedia.org/?curid=' + h.pageid } : null;
          });
      }).catch(function () { return null; });
  }

  function sirayla(q) {
    return pexels(q)
      .then(function (r) { return r || openverse(q); })
      .then(function (r) { return r || commons(q); })
      .then(function (r) { return r || wikipedia(q); });
  }

  /* ───── dış yüz ────────────────────────────────────────────── */
  var Gorsel = {
    acik: function () { return Atlas.Ayar.al().gorsel !== false; },

    /* cümle → arama sorgusu. Önce hazır eşleme, yoksa cümleden türet. */
    sorgu: function (cumle) {
      if (!cumle) return Promise.resolve('');
      if (cumle.imgQuery) return Promise.resolve(cumle.imgQuery);
      var yukle = sorguHaritasi
        ? Promise.resolve(sorguHaritasi)
        : Veri.gorselSorgu().then(function (h) { sorguHaritasi = h; return h; }).catch(function () { return {}; });
      return yukle.then(function (h) {
        return h[cumle.en] || h[cumle.id] || Gorsel.cumledenSorgu(cumle.en);
      });
    },

    /* eşleme yoksa: işlev kelimelerini at, en uzun 3 kelimeyi al */
    cumledenSorgu: function (en) {
      var dur = /^(a|an|the|is|are|was|were|am|be|been|do|does|did|have|has|had|will|would|can|could|should|of|to|in|on|at|for|with|that|this|it|i|you|he|she|we|they|my|your|his|her|its|and|but|or|not|very|so|as|from|by)$/i;
      var kelimeler = String(en || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
        .filter(function (w) { return w.length > 2 && !dur.test(w); });
      kelimeler.sort(function (a, b) { return b.length - a.length; });
      return kelimeler.slice(0, 3).join(' ');
    },

    /* sorgu → {url, kaynak, sahip, sayfa} | null */
    bul: function (sorgu) {
      sorgu = String(sorgu || '').trim();
      if (!sorgu) return Promise.resolve(null);
      if (bellek[sorgu] !== undefined) return Promise.resolve(bellek[sorgu]);
      return kvAl('img:' + sorgu).then(function (onbellek) {
        if (onbellek) { bellek[sorgu] = onbellek.yok ? null : onbellek; return bellek[sorgu]; }
        if (!navigator.onLine) return null;
        return sirayla(sorgu).then(function (sonuc) {
          bellek[sorgu] = sonuc;
          kvYaz('img:' + sorgu, sonuc || { yok: 1 });
          return sonuc;
        });
      });
    },

    /* cümle için görsel kutusu — bulunana kadar hiçbir yer kaplamaz */
    kutu: function (cumle) {
      var kap = document.createElement('div');
      kap.className = 'gorsel-kutu';
      if (!Gorsel.acik()) return kap;
      Gorsel.sorgu(cumle).then(function (q) {
        if (!q) return;
        return Gorsel.bul(q).then(function (g) {
          if (!g || !g.url) return;
          var img = document.createElement('img');
          img.alt = cumle.en || '';
          img.loading = 'lazy';
          img.onload = function () { kap.classList.add('geldi'); };
          img.onerror = function () { kap.remove(); };
          img.src = g.url;
          kap.appendChild(img);
          if (g.kaynak) {
            var k = document.createElement('span');
            k.className = 'gorsel-kaynak';
            k.textContent = g.kaynak + (g.sahip ? ' · ' + g.sahip : '');
            kap.appendChild(k);
          }
        });
      }).catch(function () { kap.remove(); });
      return kap;
    },

    /* görsel eşleme oyunu için: 4 cümlenin görselini önden getir */
    onIndir: function (cumleler) {
      return Promise.all((cumleler || []).slice(0, 8).map(function (c) {
        return Gorsel.sorgu(c).then(function (q) { return q ? Gorsel.bul(q) : null; })
          .then(function (g) { return { cumle: c, gorsel: g }; })
          .catch(function () { return { cumle: c, gorsel: null }; });
      }));
    },

    onbellegiTemizle: function () {
      bellek = {};
      return dbAc().then(function (db) {
        if (!db) return;
        try {
          var t = db.transaction(DEPO, 'readwrite');
          t.objectStore(DEPO).clear();
          t.oncomplete = function () { db.close(); };
        } catch (e) { try { db.close(); } catch (x) {} }
      });
    }
  };

  global.Gorsel = Gorsel;
})(window);
