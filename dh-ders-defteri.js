/* dh-ders-defteri.js — Öğretmen sayfası (teacher.html) ile Deniz'in görüntülü dersi
   (konuskan.html) arasında ORTAK ve KALICI ders defteri.
   - Etkin defter: localStorage "dh-ders-defteri-v1" (iki sayfa arasında anında paylaşım)
     { id, cumle, tr, aciklama (Markdown), mesajlar: [{ kim: "Sen"|"Öğretmen"|"Deniz", metin, yer, t }], bas, guncel }
   - ARŞİV: IndexedDB "dh-ders-defteri" / "defterler" — her cümlenin defteri ayrı kayıt. Yalnız kullanıcı
     ders-defteri.html'de "Sil" derse silinir (DHDefter.sil). Aynı cümleye dönülünce eski konuşmalar geri gelir.
   - BULUT (28 Kasım): Firestore users/{uid}/ders_defteri/{id} (DHCloudSync.defter). Her değişiklik 4 sn sonra yazılır;
     açılışta yalnız "guncel" alanı son çekişten yeni belgeler okunur (dh-defter-cek-v1). Silme = {silindi:true} işareti,
     öbür cihazlar da siler. Belge 1 MB sınırı: 900 KB'ı aşan defterin bulut kopyasında en eski mesajlar kırpılır (yerelde hepsi kalır).
   - Deniz'in serbest sohbeti: günlük "Deniz sohbeti · <tarih>" defterine (tur:"sohbet") yazılır (DHDefter.sohbet).
   - Geçmiş: ders-defteri.html (DHDefter.listele / ac / sil). */
(function (g) {
  "use strict";
  if (g.DHDefter) return;
  var K = "dh-ders-defteri-v1", DBAD = "dh-ders-defteri", ST = "defterler";

  /* ---------- IndexedDB arşivi ---------- */
  var dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise(function (ok, no) {
      try {
        var r = indexedDB.open(DBAD, 1);
        r.onupgradeneeded = function () { var d = r.result; if (!d.objectStoreNames.contains(ST)) d.createObjectStore(ST, { keyPath: "id" }); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { no(r.error); };
      } catch (e) { no(e); }
    });
    return dbP;
  }
  function arsivYaz(d, buluttan) {
    if (!d || !d.id) return Promise.resolve();
    if (silinenMi(d.id)) return Promise.resolve();
    var p = db().then(function (x) { return new Promise(function (ok) {
      var tx = x.transaction(ST, "readwrite"); tx.objectStore(ST).put(JSON.parse(JSON.stringify(d))); tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok;
    }); }).catch(function () {});
    if (!buluttan) bulutaSirala(d.id);
    return p;
  }
  function arsivSil(id) {
    return db().then(function (x) { return new Promise(function (ok) {
      var tx = x.transaction(ST, "readwrite"); tx.objectStore(ST).delete(id); tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok;
    }); }).catch(function () {});
  }

  /* ---------- bulut ---------- */
  var KB = "dh-defter-bekleyen-v1", KC = "dh-defter-cek-v1", KS = "dh-defter-silinen-v1";
  function jl(k, v) { try { return JSON.parse(localStorage.getItem(k) || "null") || v; } catch (e) { return v; } }
  function js(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function silinenMi(id) { return !!jl(KS, {})[id]; }
  function bulut() { var c = g.DHCloudSync; return c && c.defter && c.defter.hazir() ? c.defter : null; }
  var yazZ = null;
  function bulutaSirala(id) {
    var b = jl(KB, {}); b[id] = 1; js(KB, b);
    clearTimeout(yazZ); yazZ = setTimeout(bulutaYaz, 4000);
  }
  function bulutKopya(d) {
    var c = JSON.parse(JSON.stringify(d)); delete c._bekliyor; delete c.id;
    c.mesajlar = c.mesajlar || [];
    var n = 0; while (JSON.stringify(c).length > 900000 && c.mesajlar.length) { c.mesajlar.shift(); n++; }
    if (n) c.kirpik = n;
    return c;
  }
  var yaziyor = false;
  function bulutaYaz() {
    var bl = bulut(); if (!bl || yaziyor) { if (!bl) clearTimeout(yazZ); return Promise.resolve(); }
    var b = jl(KB, {}), ids = Object.keys(b); if (!ids.length) return Promise.resolve();
    yaziyor = true;
    var s = jl(KS, {});
    return ids.reduce(function (p, id) {
      return p.then(function () {
        if (s[id]) return bl.yaz(id, { silindi: true, guncel: s[id] }).then(function (ok) { if (ok) { var x = jl(KB, {}); delete x[id]; js(KB, x); } });
        return arsivAl(id).then(function (d) {
          if (!d) { var x = jl(KB, {}); delete x[id]; js(KB, x); return; }
          return bl.yaz(id, bulutKopya(d)).then(function (ok) { if (ok) { var x = jl(KB, {}); delete x[id]; js(KB, x); } });
        });
      }).catch(function () {});
    }, Promise.resolve()).then(function () { yaziyor = false; }, function () { yaziyor = false; });
  }
  function mesajBirlesik(a, b) {
    var gor = {}, out = [];
    (a || []).concat(b || []).forEach(function (m) { var k = (m.t || 0) + "|" + m.metin; if (!gor[k]) { gor[k] = 1; out.push(m); } });
    return out.sort(function (x, y) { return (x.t || 0) - (y.t || 0); });
  }
  /* buluttan yeni gelenleri yerel arşive kat (yerelde fazlası varsa birleşik hali buluta geri yazılır) */
  function buluttanCek() {
    var bl = bulut(); if (!bl) return Promise.resolve(false);
    var son = +jl(KC, 0) || 0;
    return bl.cek(son).then(function (liste) {
      if (!liste) return false;
      var enYeni = son;
      return liste.reduce(function (p, r) {
        return p.then(function () {
          enYeni = Math.max(enYeni, +r.guncel || 0);
          var id = r.id;
          if (r.silindi) {
            var s = jl(KS, {}); s[id] = r.guncel || Date.now(); js(KS, s);
            var a = oku(); if (a && a.id === id) { try { localStorage.removeItem(K); } catch (e) {} }
            return arsivSil(id);
          }
          return arsivAl(id).then(function (yer) {
            var d = JSON.parse(JSON.stringify(r)); d.id = id; delete d.kirpik;
            if (yer) {
              d.mesajlar = mesajBirlesik(yer.mesajlar, r.mesajlar);
              if ((yer.guncel || 0) > (r.guncel || 0)) { d.aciklama = yer.aciklama || d.aciklama; d.tr = yer.tr || d.tr; }
              d.guncel = Math.max(yer.guncel || 0, r.guncel || 0);
              if (d.mesajlar.length > (r.mesajlar || []).length && !r.kirpik) bulutaSirala(id);
            }
            var a = oku();
            if (a && a.id === id && !a._bekliyor) { a.mesajlar = mesajBirlesik(a.mesajlar, d.mesajlar); if (!a.aciklama) a.aciklama = d.aciklama; try { localStorage.setItem(K, JSON.stringify(a)); } catch (e) {} d = a; }
            return arsivYaz(d, true);
          });
        });
      }, Promise.resolve()).then(function () { js(KC, enYeni); if (liste.length) { try { g.dispatchEvent(new CustomEvent("dh-defter-bulut", { detail: { n: liste.length } })); } catch (e) {} } return true; });
    }).catch(function () { return false; });
  }
  /* bulut hazır olunca (oturum açılınca) bir kez çek, bekleyenleri yaz */
  (function bekle(n) {
    if (bulut()) {
      /* ilk kez: bu cihazdaki eski defterlerin hepsi buluta gönderilsin */
      var ilk = jl("dh-defter-ilk-v1", 0) ? Promise.resolve() : arsivHepsi().then(function (a) { var b = jl(KB, {}); a.forEach(function (d) { if (d && d.id) b[d.id] = 1; }); js(KB, b); js("dh-defter-ilk-v1", Date.now()); });
      ilk.then(buluttanCek).then(function () { return bulutaYaz(); }); return;
    }
    if (n < 60) setTimeout(function () { bekle(n + 1); }, 1000);
  })(0);
  g.addEventListener("pagehide", function () { try { bulutaYaz(); } catch (e) {} });
  function arsivAl(id) {
    return db().then(function (x) { return new Promise(function (ok) {
      var q = x.transaction(ST, "readonly").objectStore(ST).get(id); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { ok(null); };
    }); }).catch(function () { return null; });
  }
  function arsivHepsi() {
    return db().then(function (x) { return new Promise(function (ok) {
      var q = x.transaction(ST, "readonly").objectStore(ST).getAll(); q.onsuccess = function () { ok(q.result || []); }; q.onerror = function () { ok([]); };
    }); }).catch(function () { return []; });
  }

  /* ---------- etkin defter ---------- */
  function kimlik(cumle) {   /* aynı cümle → aynı defter */
    var s = String(cumle || "").trim().toLowerCase().replace(/\s+/g, " "), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return "d" + h.toString(36) + "-" + s.length;
  }
  function oku() { try { return JSON.parse(localStorage.getItem(K) || "null"); } catch (e) { return null; } }
  function yaz(d) {
    d.guncel = Date.now();
    if (!d.id && d.cumle) d.id = kimlik(d.cumle);
    try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {}
    /* her değişiklik kalıcı arşive de gider — ama arşivdeki eski kayıt henüz okunup birleştirilmediyse
       BEKLE: yoksa boş yeni defter eski kaydın üstüne yazılır ve eski konuşmalar kaybolur */
    if (!d._bekliyor) arsivYaz(d);
    return d;
  }
  /* arşivdeki eski kaydı etkin deftere kat (eski mesajlar önce, aynıları tekrar eklenmez) */
  function birlestir(eski, id) {
    var d = oku(); if (!d || d.id !== id) return;
    delete d._bekliyor;
    if (!eski) { yaz(d); return; }
    var gor = {}; (d.mesajlar || []).forEach(function (m) { gor[(m.t || 0) + "|" + m.metin] = 1; });
    var once = (eski.mesajlar || []).filter(function (m) { return !gor[(m.t || 0) + "|" + m.metin]; });
    d.mesajlar = once.concat(d.mesajlar || []).sort(function (a, b) { return (a.t || 0) - (b.t || 0); });
    if (!d.aciklama && eski.aciklama) d.aciklama = eski.aciklama;
    if (!d.tr && eski.tr) d.tr = eski.tr;
    d.bas = Math.min(d.bas || Date.now(), eski.bas || Date.now());
    yaz(d);
    try { g.dispatchEvent(new CustomEvent("dh-defter-birlesti", { detail: d })); } catch (e) {}
  }
  /* eski sürümden kalan kimliksiz etkin defter de arşive girsin */
  (function () { var d = oku(); if (d && d._bekliyor) { arsivAl(d.id).then(function (e) { birlestir(e, d.id); }); } else if (d && d.cumle && !d.id) yaz(d); else if (d && d.id) arsivYaz(d, true); })();

  /* Markdown açıklamayı sesli okunacak satırlara çevirir: başlık → cümle, tablo satırı → "Başlık: değer — …" */
  function konusulabilir(md) {
    var satirlar = String(md || "").replace(/\r/g, "").split("\n"), out = [], basliklar = null;
    function temiz(s) { return String(s).replace(/\[\[|\]\]/g, "").replace(/`/g, "").replace(/\*\*|__/g, "").replace(/(^|\s)[*_]([^*_]+)[*_]/g, "$1$2").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }
    function hucre(l) { return l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return temiz(c); }); }
    satirlar.forEach(function (l) {
      if (/^\s*\|.*\|\s*$/.test(l)) {
        if (/^\s*\|?\s*:?-{2,}/.test(l)) return;
        var c = hucre(l);
        if (!basliklar) { basliklar = c; return; }
        var parca = c.map(function (x, i) { return x ? ((basliklar[i] ? basliklar[i] + ": " : "") + x) : ""; }).filter(Boolean);
        if (parca.length) { var tum = parca.join(" — "); out.push(/[.!?…]$/.test(tum) ? tum : tum + "."); }
        return;
      }
      basliklar = null;
      var m = l.match(/^\s*#{1,6}\s+(.+)$/); if (m) { var b = temiz(m[1]); if (b) out.push(/[.!?…:]$/.test(b) ? b : b + "."); return; }
      if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(l)) return;
      var t = temiz(l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").replace(/^\s*>\s?/, ""));
      if (t) out.push(t);
    });
    return out;
  }

  g.DHDefter = {
    al: oku,
    /* yeni cümle → o cümlenin defteri (arşivde varsa eski konuşmalarıyla); aynı cümle → sürer */
    baslat: function (cumle, tr) {
      cumle = String(cumle || "").trim(); if (!cumle) return oku();
      var d = oku(), id = kimlik(cumle);
      if (silinenMi(id)) { var sl = jl(KS, {}); delete sl[id]; js(KS, sl); }
      if (!d || d.id !== id) {
        if (d && d.id && !d._bekliyor) arsivYaz(d);
        d = { id: id, cumle: cumle, tr: tr || "", aciklama: "", mesajlar: [], bas: Date.now(), _bekliyor: true };
        yaz(d);
        arsivAl(id).then(function (eski) { birlestir(eski, id); });
      } else if (tr && !d.tr) { d.tr = tr; yaz(d); }
      return d;
    },
    aciklama: function (t) { var d = oku(); if (!d) return null; d.aciklama = String(t || ""); return yaz(d); },
    /* Deniz'in serbest sohbeti: etkin defteri değiştirmeden günün "Deniz sohbeti" defterine yazar */
    sohbet: function (kim, metin) {
      if (!metin) return Promise.resolve(null);
      var gun = new Date(), baslik = "Deniz sohbeti · " + gun.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
      var id = kimlik(baslik);
      return arsivAl(id).then(function (d) {
        d = d || { id: id, cumle: baslik, tr: "", aciklama: "", mesajlar: [], bas: Date.now(), tur: "sohbet" };
        if (silinenMi(id)) { var s = jl(KS, {}); delete s[id]; js(KS, s); }
        d.mesajlar = d.mesajlar || [];
        d.mesajlar.push({ kim: kim, metin: String(metin).slice(0, 8000), yer: "Deniz", t: Date.now() });
        d.guncel = Date.now();
        return arsivYaz(d).then(function () { return d; });
      });
    },
    /* kullanıcı isteğiyle bir defteri sil (yerel + bulut, öbür cihazlar da siler) */
    sil: function (id) {
      if (!id) return Promise.resolve(false);
      var s = jl(KS, {}); s[id] = Date.now(); js(KS, s);
      var a = oku(); if (a && a.id === id) { try { localStorage.removeItem(K); } catch (e) {} }
      return arsivSil(id).then(function () { var b = jl(KB, {}); b[id] = 1; js(KB, b); return bulutaYaz(); }).then(function () { return true; });
    },
    bulut: { cek: buluttanCek, yaz: bulutaYaz },
    ekle: function (kim, metin, yer) {
      var d = oku(); if (!d || !metin) return null;
      d.mesajlar = d.mesajlar || [];
      d.mesajlar.push({ kim: kim, metin: String(metin).slice(0, 8000), yer: yer || "", t: Date.now() });
      return yaz(d);   /* sınır yok: kayıtlar hiç kırpılmaz */
    },
    /* geçmiş: bütün defterler, en son çalışılan önce */
    listele: function () { return arsivHepsi().then(function (a) { return a.sort(function (x, y) { return (y.guncel || 0) - (x.guncel || 0); }); }); },
    /* arşivden bir defteri etkin yap (öğretmen/Deniz onunla açılır) */
    ac: function (id) { return arsivAl(id).then(function (d) { if (d) { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {} } return d; }); },
    kimlik: kimlik,
    konusulabilir: konusulabilir
  };
})(window);
