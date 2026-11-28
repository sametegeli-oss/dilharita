/* dh-ders-defteri.js — Öğretmen sayfası (teacher.html) ile Deniz'in görüntülü dersi
   (konuskan.html) arasında ORTAK ve KALICI ders defteri.
   - Etkin defter: localStorage "dh-ders-defteri-v1" (iki sayfa arasında anında paylaşım)
     { id, cumle, tr, aciklama (Markdown), mesajlar: [{ kim: "Sen"|"Öğretmen"|"Deniz", metin, yer, t }], bas, guncel }
   - ARŞİV: IndexedDB "dh-ders-defteri" / "defterler" — her cümlenin defteri ayrı kayıt; HİÇBİR ZAMAN SİLİNMEZ
     (bu dosyada silme yok). Aynı cümleye dönülünce eski konuşmalar geri gelir ve üstüne eklenir.
   - Geçmiş: ders-defteri.html (DHDefter.listele / ac). */
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
  function arsivYaz(d) {
    if (!d || !d.id) return Promise.resolve();
    return db().then(function (x) { return new Promise(function (ok) {
      var tx = x.transaction(ST, "readwrite"); tx.objectStore(ST).put(JSON.parse(JSON.stringify(d))); tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok;
    }); }).catch(function () {});
  }
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
  (function () { var d = oku(); if (d && d._bekliyor) { arsivAl(d.id).then(function (e) { birlestir(e, d.id); }); } else if (d && d.cumle && !d.id) yaz(d); else if (d && d.id) arsivYaz(d); })();

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
      if (!d || d.id !== id) {
        if (d && d.id && !d._bekliyor) arsivYaz(d);
        d = { id: id, cumle: cumle, tr: tr || "", aciklama: "", mesajlar: [], bas: Date.now(), _bekliyor: true };
        yaz(d);
        arsivAl(id).then(function (eski) { birlestir(eski, id); });
      } else if (tr && !d.tr) { d.tr = tr; yaz(d); }
      return d;
    },
    aciklama: function (t) { var d = oku(); if (!d) return null; d.aciklama = String(t || ""); return yaz(d); },
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
