/* dh-ders-defteri.js — Öğretmen sayfası (teacher.html) ile Deniz'in görüntülü dersi
   (konuskan.html) arasında ORTAK ders defteri.
   Aynı cihazda localStorage "dh-ders-defteri-v1":
     { cumle, tr, aciklama (öğretmenin yazılı açıklaması, Markdown),
       mesajlar: [{ kim: "Sen"|"Öğretmen"|"Deniz", metin, yer: "Öğretmen"|"Deniz", t }], guncel }
   Öğretmen yazar → Deniz açılınca okur; Deniz yazar → "Öğretmene dön" ile öğretmen gösterir. */
(function (g) {
  "use strict";
  if (g.DHDefter) return;
  var K = "dh-ders-defteri-v1";
  function oku() { try { return JSON.parse(localStorage.getItem(K) || "null"); } catch (e) { return null; } }
  function yaz(d) {
    d.guncel = Date.now();
    try { localStorage.setItem(K, JSON.stringify(d)); }
    catch (e) { d.mesajlar = (d.mesajlar || []).slice(-20); try { localStorage.setItem(K, JSON.stringify(d)); } catch (e2) {} }
    return d;
  }
  /* Markdown açıklamayı sesli okunacak satırlara çevirir: başlık → cümle, tablo satırı → "Başlık: değer, …" */
  function konusulabilir(md) {
    var satirlar = String(md || "").replace(/\r/g, "").split("\n"), out = [], basliklar = null;
    function temiz(s) { return String(s).replace(/\[\[|\]\]/g, "").replace(/`/g, "").replace(/\*\*|__/g, "").replace(/(^|\s)[*_]([^*_]+)[*_]/g, "$1$2").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }
    function hucre(l) { return l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return temiz(c); }); }
    satirlar.forEach(function (l) {
      if (/^\s*\|.*\|\s*$/.test(l)) {
        if (/^\s*\|?\s*:?-{2,}/.test(l)) return;                 /* ayraç satırı */
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
    /* yeni cümle → yeni defter; aynı cümle → var olan defter sürer */
    baslat: function (cumle, tr) {
      cumle = String(cumle || "").trim(); var d = oku();
      if (!d || d.cumle !== cumle) d = { cumle: cumle, tr: tr || "", aciklama: "", mesajlar: [] };
      else if (tr) d.tr = tr;
      return yaz(d);
    },
    aciklama: function (t) { var d = oku(); if (!d) return null; d.aciklama = String(t || ""); return yaz(d); },
    ekle: function (kim, metin, yer) {
      var d = oku(); if (!d || !metin) return null;
      d.mesajlar = d.mesajlar || [];
      d.mesajlar.push({ kim: kim, metin: String(metin).slice(0, 6000), yer: yer || "", t: Date.now() });
      if (d.mesajlar.length > 60) d.mesajlar = d.mesajlar.slice(-60);
      return yaz(d);
    },
    konusulabilir: konusulabilir
  };
})(window);
