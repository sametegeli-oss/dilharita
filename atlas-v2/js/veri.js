/* ═══════════════════════════════════════════════════════════════
   ATLAS · VERİ KATMANI
   Kural: hiçbir ekran 8 MB'lık tek dosyayı indirmez.
   Modül seçimi 28 KB indeksle, çalışma o modülün ~5 KB'ıyla açılır.
   Her indirme bir kez yapılır, bellekte ve service worker'da tutulur.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var YOL = './data/';
  var bellek = {};      /* url -> Promise */
  var modulBellek = {}; /* dosya -> cümle dizisi */

  function ilerlemeBaslat() {
    var c = document.getElementById('ustCubuk');
    if (!c) return function () {};
    c.style.opacity = '1'; c.style.width = '12%';
    var p = 12, t = setInterval(function () {
      p = Math.min(90, p + (90 - p) * .16);
      c.style.width = p + '%';
    }, 220);
    return function () {
      clearInterval(t); c.style.width = '100%';
      setTimeout(function () { c.style.opacity = '0'; setTimeout(function () { c.style.width = '0'; }, 350); }, 220);
    };
  }

  function getir(url, sessiz) {
    if (bellek[url]) return bellek[url];
    var bitir = sessiz ? function () {} : ilerlemeBaslat();
    bellek[url] = fetch(url, { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error(url + ' → ' + r.status);
        return r.json();
      })
      .then(function (j) { bitir(); return j; })
      .catch(function (e) { bitir(); delete bellek[url]; throw e; });
    return bellek[url];
  }

  var Veri = {
    indexBellek: null,

    /* ── modül indeksi ─────────────────────────────────────── */
    index: function () {
      return getir(YOL + 'sentences/index.json').then(function (ham) {
        /* NOT: `ham` önbellekteki tek nesne. Üstüne yazarsak
           "Kendi Cümlelerim" her çağrıda bir kez daha eklenir.
           Bu yüzden her seferinde yeni bir kabuk kuruluyor. */
        if (!Veri.indexBellek) {
          var moduller = ham.modules.slice();
          var oz = Atlas.Ozel.hepsi();
          if (oz.length) {
            moduller.push({
              lvl: Atlas.Profil.al().seviye || 'A2',
              mod: 'Kendi Cümlelerim',
              f: '__ozel__',
              n: oz.length,
              ids: oz.map(function (c) { return c.id; }),
              ozel: true
            });
          }
          Veri.indexBellek = { v: ham.v, total: ham.total, levels: ham.levels, modules: moduller };
        }
        return Veri.indexBellek;
      });
    },

    modulListesi: function (seviye) {
      return Veri.index().then(function (j) {
        return seviye ? j.modules.filter(function (m) { return m.lvl === seviye; }) : j.modules;
      });
    },

    modulBul: function (f) {
      return Veri.index().then(function (j) {
        return j.modules.find(function (m) { return m.f === f; }) || null;
      });
    },

    /* ── bir modülün cümleleri ─────────────────────────────── */
    modul: function (f) {
      if (f === '__ozel__') {
        return Promise.resolve(Atlas.Ozel.hepsi().map(function (c) {
          return Object.assign({ module: 'Kendi Cümlelerim', level: c.level }, c);
        }));
      }
      if (modulBellek[f]) return Promise.resolve(modulBellek[f]);
      return getir(YOL + 'sentences/mod/' + f + '.json').then(function (a) {
        modulBellek[f] = a; return a;
      });
    },

    /* ── id listesinden cümleler (tekrar ekranı) ───────────── */
    cumlelerByIds: function (idler) {
      var ozel = Atlas.Ozel.hepsi();
      var ozelMap = {}; ozel.forEach(function (c) { ozelMap[c.id] = c; });
      var kalan = idler.filter(function (i) { return !ozelMap[i]; });

      return Veri.index().then(function (j) {
        /* hangi id hangi dosyada */
        var gerekli = {};
        j.modules.forEach(function (m) {
          if (m.f === '__ozel__') return;
          for (var i = 0; i < m.ids.length; i++) {
            if (kalan.indexOf(m.ids[i]) > -1) { gerekli[m.f] = 1; break; }
          }
        });
        return Promise.all(Object.keys(gerekli).map(function (f) {
          return Veri.modul(f).catch(function () { return []; });
        }));
      }).then(function (paketler) {
        var harita = {};
        paketler.forEach(function (p) { p.forEach(function (c) { harita[c.id] = c; }); });
        ozel.forEach(function (c) { harita[c.id] = c; });
        return idler.map(function (i) { return harita[i]; }).filter(Boolean);
      });
    },

    /* ── hafif örnek havuzu (id/en/tr) — kelime baloncuğu ──── */
    ornekler: function () { return getir(YOL + 'sentences/examples.json', true); },
    kelimeIndeksi: function () { return getir(YOL + 'sentences/word-index.json', true); },

    /* kelime → örnek cümleler (senkron değil, ama tek indirmeden sonra hızlı) */
    kelimeOrnekleri: function (kelime, adet) {
      adet = adet || 4;
      return Promise.all([Veri.kelimeIndeksi(), Veri.ornekler()]).then(function (r) {
        var idx = r[0], ex = r[1];
        var liste = idx.w[String(kelime || '').toLowerCase()] || [];
        return liste.slice(0, adet).map(function (n) { return ex[n]; }).filter(Boolean);
      }).catch(function () { return []; });
    },

    /* ── sözlük · eş anlam · phrasal ───────────────────────── */
    sozluk: function () { return getir(YOL + 'dictionary.json'); },
    esanlam: function () { return getir(YOL + 'synonyms.json', true); },
    phrasal: function () { return getir(YOL + 'phrasal-verbs.json'); },
    testHavuzu: function () { return getir(YOL + 'sentences/test-pool.json'); },
    gorselSorgu: function () { return getir(YOL + 'sentences/img-queries.json', true); },

    /* ── sözlükten sıralı kelime listesi (frekansa göre) ───── */
    kelimeListesi: function (seviye) {
      return Veri.sozluk().then(function (d) {
        var out = [];
        for (var k in d) {
          var v = d[k];
          if (seviye && v.seviye && v.seviye !== seviye) continue;
          out.push({
            kelime: k, oku: v.oku || '', anlamlar: v.anlamlar || [],
            seviye: v.seviye || '', frekans: v.frekans || 0
          });
        }
        out.sort(function (a, b) { return b.frekans - a.frekans; });
        return out;
      });
    },

    kelimeAra: function (q) {
      q = String(q || '').toLowerCase().trim();
      if (!q) return Promise.resolve([]);
      return Veri.sozluk().then(function (d) {
        var tam = [], bas = [], ic = [];
        for (var k in d) {
          if (k === q) tam.push(k);
          else if (k.indexOf(q) === 0) { if (bas.length < 30) bas.push(k); }
          else if (bas.length + ic.length < 40 && k.indexOf(q) > 0) ic.push(k);
        }
        return tam.concat(bas, ic).slice(0, 40).map(function (k) {
          return Object.assign({ kelime: k }, d[k]);
        });
      });
    },

    kelimeBilgi: function (w) {
      w = String(w || '').toLowerCase().replace(/[^a-z']/g, '');
      return Veri.sozluk().then(function (d) {
        if (d[w]) return Object.assign({ kelime: w }, d[w]);
        /* basit kök denemeleri */
        var adaylar = [
          w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, ''),
          w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/ied$/, 'y'),
          w.replace(/ed$/, ''), w.replace(/ed$/, 'e'), w.replace(/(.)\1ing$/, '$1'),
          w.replace(/(.)\1ed$/, '$1')
        ];
        for (var i = 0; i < adaylar.length; i++) {
          var a = adaylar[i];
          if (a && a !== w && d[a]) return Object.assign({ kelime: a, kokBulundu: w }, d[a]);
        }
        return null;
      });
    },

    /* ── sıradaki modül önerisi ────────────────────────────── */
    siradakiModul: function () {
      return Veri.index().then(function (j) {
        var pr = Atlas.Profil.al();
        var basI = Math.max(0, Atlas.SEVIYELER.indexOf(pr.seviye || 'A1'));
        var sirali = j.modules.filter(function (m) { return !m.ozel; }).slice();
        var puan = function (m) {
          var i = Atlas.SEVIYELER.indexOf(m.lvl);
          return (i < basI ? 100 : 0) + i;
        };
        sirali.sort(function (a, b) { return puan(a) - puan(b); });
        /* en son çalışılan modül yarım kaldıysa onu öner */
        var son = Atlas.Ilerleme.sonModul();
        if (son) {
          var sm = j.modules.find(function (m) { return m.f === son; });
          if (sm && Atlas.Ilerleme.modul(sm.ids).oran < 100) return sm;
        }
        for (var i = 0; i < sirali.length; i++) {
          if (Atlas.Ilerleme.modul(sirali[i].ids).oran < 100) return sirali[i];
        }
        return sirali[0];
      });
    },

    /* ── seviye testi soruları ─────────────────────────────── */
    seviyeSorulari: function (adet) {
      adet = adet || 24;
      return Veri.testHavuzu().then(function (havuz) {
        var seviyeBazli = {};
        havuz.forEach(function (s) { (seviyeBazli[s.level] = seviyeBazli[s.level] || []).push(s); });
        var perSeviye = Math.ceil(adet / Atlas.SEVIYELER.length);
        var sorular = [];
        Atlas.SEVIYELER.forEach(function (lv) {
          var liste = (seviyeBazli[lv] || []).slice();
          karistir(liste);
          liste.slice(0, perSeviye).forEach(function (s) {
            /* çeldirici: aynı seviyeden başka cümlelerin çevirisi */
            var celdirici = [];
            var kopya = liste.filter(function (x) { return x.id !== s.id; });
            karistir(kopya);
            for (var i = 0; i < kopya.length && celdirici.length < 3; i++) {
              if (kopya[i].tr && kopya[i].tr !== s.tr) celdirici.push(kopya[i].tr);
            }
            var secenekler = celdirici.concat([s.tr]);
            karistir(secenekler);
            sorular.push({ id: s.id, level: lv, en: s.en, dogru: s.tr, secenekler: secenekler, grammar: s.grammar });
          });
        });
        karistir(sorular);
        return sorular.slice(0, adet);
      });
    }
  };

  function karistir(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  Veri.karistir = karistir;

  global.Veri = Veri;
})(window);
