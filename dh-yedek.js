/* dh-yedek.js — TAM YEDEK: TÜM IndexedDB verisi tek JSON dosyasında
   ====================================================================
   İSTEK: "IndexedDB'deki tüm veri yedek json dosyasıyla aktarılmalı."

   ── ÖNCEKİ DURUM ──
   menu.html'deki yedek yalnızca ŞUNU alıyordu:
     · sentence-mode / kv          (img: hariç)
     · beyaz listedeki localStorage anahtarları
     · LearningErrorDB kayıtları
   Uygulamada bunun dışında en az beş veritabanı daha var ve hiçbiri
   yedeğe girmiyordu:
     AzarGrammarStorage · sentence-learning-system · DilHaritaAI_DB
     DilharitaDB · dh-kelime-analiz · dh-snap · sentenceLibraryCacheV2
   Yani "tam yedek" adı altında alınan dosyayla cihaz değiştiren
   kullanıcı gramer çalışmalarını, hata defterinin ham deposunu ve
   Gemini kelime analizlerini kaybediyordu.

   ── BU DOSYA ──
   Veritabanlarını ADINI BİLMEDEN keşfeder (indexedDB.databases()),
   her deponun kayıtlarını ANAHTARIYLA birlikte yazar ve geri yüklerken
   depoları gerektiği gibi yeniden oluşturur.

   Firefox indexedDB.databases() desteklemiyor; orada bilinen ad listesi
   kullanılır. Liste eksik kalırsa yedek sessizce küçülmesin diye
   sonuçta hangi veritabanının kaç kayıtla alındığı raporlanır.

   ── GÖRSEL ÖNBELLEĞİ ──
   img:* kayıtları ve sentenceLibraryCacheV2 varsayılan olarak ATLANIR:
   yüzlerce MB tutabilir ve yeniden indirilebilir veridir. {gorseller:true}
   ile dahil edilebilir.

   API
     DHYedek.olustur(opt)   -> Promise<{app,version,dbs,...}>
     DHYedek.uygula(veri)   -> Promise<rapor>
     DHYedek.dbListesi()    -> Promise<[ad,...]>
   ==================================================================== */
(function (global) {
  "use strict";
  if (global.DHYedek) return;

  var SURUM = 5;

  /* Firefox yedegi: indexedDB.databases() yoksa bunlar denenir. */
  var BILINEN = [
    "sentence-mode",              /* modul ilerlemesi, srs, kelime durumu */
    "sentence-learning-system",   /* LearningErrorDB — hata defteri */
    "AzarGrammarStorage",         /* gramer calismalari */
    "DilHaritaAI_DB",
    "DilharitaDB",
    "dh-kelime-analiz",           /* Gemini kelime analizleri */
    "dh-snap"                     /* gunluk anlik goruntuler */
  ];
  /* Yeniden uretilebilir onbellekler — varsayilan olarak alinmaz */
  var ONBELLEK_DB = { sentenceLibraryCacheV2: 1 };

  function dbListesi() {
    if (global.indexedDB && global.indexedDB.databases) {
      return global.indexedDB.databases()
        .then(function (l) {
          var adlar = (l || []).map(function (d) { return d && d.name; }).filter(Boolean);
          /* Kesif calissa bile bilinen adlari ekle: bazi tarayicilar
             yalnizca bu oturumda acilmis veritabanlarini dondurur. */
          BILINEN.forEach(function (a) { if (adlar.indexOf(a) < 0) adlar.push(a); });
          return adlar;
        })
        .catch(function () { return BILINEN.slice(); });
    }
    return Promise.resolve(BILINEN.slice());
  }

  function ac(ad, surum) {
    return new Promise(function (res) {
      try {
        var r = surum ? global.indexedDB.open(ad, surum) : global.indexedDB.open(ad);
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
        r.onblocked = function () { res(null); };
        /* Var olmayan bir veritabanini surumsuz acmak onu OLUSTURUR.
           Bos olusan veritabanini isaretleyip sonra silmek icin: */
        r.onupgradeneeded = function () { try { r.result.__dhYeni = true; } catch (e) {} };
      } catch (e) { res(null); }
    });
  }

  function depoOku(db, depoAd, gorseller) {
    return new Promise(function (res) {
      var kayitlar = [];
      try {
        var st = db.transaction(depoAd, "readonly").objectStore(depoAd);
        var bilgi = {
          keyPath: st.keyPath === undefined ? null : st.keyPath,
          autoIncrement: !!st.autoIncrement,
          indexler: []
        };
        try {
          for (var i = 0; i < st.indexNames.length; i++) {
            var ix = st.index(st.indexNames[i]);
            bilgi.indexler.push({ ad: ix.name, keyPath: ix.keyPath, unique: !!ix.unique, multiEntry: !!ix.multiEntry });
          }
        } catch (e) {}

        var q = st.openCursor();
        q.onsuccess = function (e) {
          var c = e.target.result;
          if (!c) { bilgi.kayitlar = kayitlar; return res(bilgi); }
          var k = c.key;
          /* gorsel onbellegi: buyuk ve yeniden indirilebilir */
          if (!gorseller && typeof k === "string" && k.indexOf("img:") === 0) { c.continue(); return; }
          if (!gorseller && typeof k === "string" && k.indexOf("video-practice-video:") === 0) { c.continue(); return; }
          /* keyPath varsa anahtar kaydin icindedir; yoksa ayrica yazilir */
          kayitlar.push(bilgi.keyPath == null ? { k: k, v: c.value } : { v: c.value });
          c.continue();
        };
        q.onerror = function () { bilgi.kayitlar = kayitlar; res(bilgi); };
      } catch (e) { res({ keyPath: null, autoIncrement: false, indexler: [], kayitlar: [] }); }
    });
  }

  function dbOku(ad, gorseller) {
    if (ONBELLEK_DB[ad] && !gorseller) return Promise.resolve(null);
    return ac(ad).then(function (db) {
      if (!db) return null;
      /* Acarken olusturulmus bos veritabani: yedege girmesin, silinsin */
      if (db.__dhYeni && db.objectStoreNames.length === 0) {
        try { db.close(); global.indexedDB.deleteDatabase(ad); } catch (e) {}
        return null;
      }
      var depolar = Array.prototype.slice.call(db.objectStoreNames);
      if (!depolar.length) { try { db.close(); } catch (e) {} return null; }
      var out = { surum: db.version, depolar: {} };
      return depolar.reduce(function (zincir, d) {
        return zincir.then(function () {
          return depoOku(db, d, gorseller).then(function (bilgi) { out.depolar[d] = bilgi; });
        });
      }, Promise.resolve()).then(function () {
        try { db.close(); } catch (e) {}
        return out;
      });
    });
  }

  function olustur(opt) {
    opt = opt || {};
    /* Tam yedek varsayılanı: hiçbir çevrimdışı veri dışarıda kalmasın.
       Yalnız açıkça {gorseller:false} isteyen teknik çağrılar küçültebilir. */
    var gorseller = opt.gorseller !== false;
    return dbListesi().then(function (adlar) {
      var dbs = {};
      return adlar.reduce(function (zincir, ad) {
        return zincir.then(function () {
          return dbOku(ad, gorseller).then(function (v) { if (v) dbs[ad] = v; });
        });
      }, Promise.resolve()).then(function () {
        var ozet = {};
        Object.keys(dbs).forEach(function (ad) {
          var n = 0;
          Object.keys(dbs[ad].depolar).forEach(function (d) { n += dbs[ad].depolar[d].kayitlar.length; });
          ozet[ad] = n;
        });
        return { dbs: dbs, ozet: ozet, gorseller: gorseller };
      });
    });
  }

  /* ---------- GERİ YÜKLEME ---------- */
  function depolariKur(ad, sema) {
    /* Eksik depolari eklemek icin surum yukseltmek gerekir. */
    return ac(ad).then(function (db) {
      var eksik = [];
      var mevcutSurum = 1;
      if (db) {
        mevcutSurum = db.version;
        Object.keys(sema.depolar).forEach(function (d) {
          if (!db.objectStoreNames.contains(d)) eksik.push(d);
        });
        try { db.close(); } catch (e) {}
      } else {
        eksik = Object.keys(sema.depolar);
      }
      if (!eksik.length) return true;
      return new Promise(function (res) {
        try {
          var r = global.indexedDB.open(ad, mevcutSurum + 1);
          r.onupgradeneeded = function () {
            var d2 = r.result;
            eksik.forEach(function (dep) {
              var b = sema.depolar[dep] || {};
              try {
                var st = d2.createObjectStore(dep,
                  b.keyPath != null ? { keyPath: b.keyPath, autoIncrement: !!b.autoIncrement }
                                    : { autoIncrement: !!b.autoIncrement });
                (b.indexler || []).forEach(function (ix) {
                  try { st.createIndex(ix.ad, ix.keyPath, { unique: !!ix.unique, multiEntry: !!ix.multiEntry }); }
                  catch (e) {}
                });
              } catch (e) {}
            });
          };
          r.onsuccess = function () { try { r.result.close(); } catch (e) {} res(true); };
          r.onerror = function () { res(false); };
          r.onblocked = function () { res(false); };
        } catch (e) { res(false); }
      });
    });
  }

  function depoYaz(db, depoAd, bilgi) {
    return new Promise(function (res) {
      var n = 0;
      try {
        var tx = db.transaction(depoAd, "readwrite");
        var st = tx.objectStore(depoAd);
        (bilgi.kayitlar || []).forEach(function (r) {
          try {
            if (bilgi.keyPath == null && "k" in r) st.put(r.v, r.k);
            else st.put(r.v);
            n++;
          } catch (e) {}
        });
        tx.oncomplete = function () { res(n); };
        tx.onerror = function () { res(n); };
        tx.onabort = function () { res(0); };
      } catch (e) { res(0); }
    });
  }

  function uygula(veri) {
    var dbs = (veri && veri.dbs) || {};
    var rapor = { yazilan: {}, atlanan: [] };
    return Object.keys(dbs).reduce(function (zincir, ad) {
      return zincir.then(function () {
        var sema = dbs[ad];
        return depolariKur(ad, sema).then(function (ok) {
          if (!ok) { rapor.atlanan.push(ad); return; }
          return ac(ad).then(function (db) {
            if (!db) { rapor.atlanan.push(ad); return; }
            var depolar = Object.keys(sema.depolar).filter(function (d) {
              return db.objectStoreNames.contains(d);
            });
            return depolar.reduce(function (z2, d) {
              return z2.then(function () {
                return depoYaz(db, d, sema.depolar[d]).then(function (n) {
                  rapor.yazilan[ad] = (rapor.yazilan[ad] || 0) + n;
                });
              });
            }, Promise.resolve()).then(function () { try { db.close(); } catch (e) {} });
          });
        });
      });
    }, Promise.resolve()).then(function () { return rapor; });
  }

  global.DHYedek = {
    SURUM: SURUM,
    olustur: olustur,
    uygula: uygula,
    dbListesi: dbListesi,
    BILINEN: BILINEN
  };
})(window);
