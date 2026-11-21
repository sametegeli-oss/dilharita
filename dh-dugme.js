/* dh-dugme.js — Bütün düğmeleri tek, kompakt boyuta getirir (bkz. dh-dugme.css).
   Kullanıcı isteği: programdaki istisnasız bütün düğmeler sohbetteki küçük
   düğmeler boyutunda olsun.
   - Yalnız simge (yazısı yok, aria-label/title ile adlandırılmış) → .dh-ikon-dugme (28 px yuvarlak)
   - Yazılı düğme → .dh-kucuk-dugme (28 px yükseklik, kompakt)
   - Düğme olarak kodlanmış büyük KARTLAR (içinde başlık/paragraf/resim/blok
     ya da doğal yüksekliği 64 px'ten fazla, yazılı) dokunulmadan kalır:
     küçültülürse içerikleri kesilir.
   Sonradan eklenen düğmeler MutationObserver ile anında sınıflandırılır.
   Sayfanın <head> bölümünde yüklenir; stil dosyasını head'in SONUNA ekler. */
(function (global) {
  "use strict";
  if (global.__dhDugme) return; global.__dhDugme = true;
  var SECICI = "button, .btn, input[type=button], input[type=submit], input[type=reset]";
  var KART_ICI = "h1,h2,h3,h4,h5,h6,p,div,img,canvas,video,ul,ol,table,section,article,figure";
  function stilEkle() {
    if (document.getElementById("dh-dugme-css")) return;
    var l = document.createElement("link"); l.id = "dh-dugme-css"; l.rel = "stylesheet"; l.href = "./dh-dugme.css?v=5";
    (document.head || document.documentElement).appendChild(l);
  }
  function yaziVarMi(el) {
    if (el.tagName === "INPUT") return !!String(el.value || "").trim();
    var t = ""; try { t = el.textContent || ""; } catch (e) {}
    /* emoji/simge karakterleri tek başına yazı sayılmaz (ör. "✕", "🔊") */
    return /[\p{L}\p{N}]/u.test(t.replace(/[​-‍️]/g, ""));
  }
  function sinifla(el) {
    if (!el || el.nodeType !== 1 || el.dataset.dhDugme) return;
    if (!el.matches(SECICI)) return;
    var ikon = !yaziVarMi(el);
    if (ikon) { el.dataset.dhDugme = "ikon"; el.classList.add("dh-ikon-dugme"); return; }
    /* yazılı: kart mı? */
    var kart = false;
    try { if (el.tagName !== "INPUT" && el.querySelector(KART_ICI)) kart = true; } catch (e) {}
    if (!kart) { var h = el.offsetHeight; if (h > 64) kart = true; }
    el.dataset.dhDugme = kart ? "kart" : "kucuk";
    if (!kart) { el.classList.add("dh-kucuk-dugme"); tekSatir(el); }
  }
  /* alt alta iki satırlı yazılı düğme (ör. "A1 / Başlangıç"): parçalarını yan yana al, 28 px'e insin */
  function tekSatir(el) {
    (global.requestAnimationFrame || setTimeout)(function () {
      try {
        if (!el.isConnected || el.offsetHeight <= 34) return;
        var ch = el.children;
        for (var i = 0; i < ch.length; i++) {
          var c = ch[i], cs = getComputedStyle(c);
          if (cs.display === "none" || cs.position === "absolute" || cs.position === "fixed" || c.tagName === "svg" || c.tagName === "SVG") continue;
          if (/^(block|flex|grid|list-item|table)$/.test(cs.display)) c.style.setProperty("display", /flex|grid/.test(cs.display) ? "inline-flex" : "inline", "important");
        }
        el.dataset.dhSatir = "1";
      } catch (e) {}
    });
  }
  function tara(kok) {
    if (!kok || kok.nodeType !== 1 && kok.nodeType !== 9) return;
    if (kok.nodeType === 1 && kok.matches && kok.matches(SECICI)) sinifla(kok);
    var l = kok.querySelectorAll ? kok.querySelectorAll(SECICI) : [];
    for (var i = 0; i < l.length; i++) sinifla(l[i]);
  }
  var bekleyen = [], zaman = null;
  function sirala(n) { bekleyen.push(n); if (!zaman) zaman = (global.requestAnimationFrame || setTimeout)(function () { zaman = null; var b = bekleyen; bekleyen = []; for (var i = 0; i < b.length; i++) tara(b[i]); }); }
  function basla() {
    stilEkle(); tara(document);
    try {
      new MutationObserver(function (ml) {
        for (var i = 0; i < ml.length; i++) {
          var m = ml[i];
          if (m.type === "childList") { for (var j = 0; j < m.addedNodes.length; j++) if (m.addedNodes[j].nodeType === 1) sirala(m.addedNodes[j]); }
          /* yazısı sonradan gelen ya da değişen düğme: simge/yazılı durumunu yeniden değerlendir */
          var b = (m.target.nodeType === 1 ? m.target : m.target.parentElement); b = b && b.closest && b.closest(SECICI);
          if (b && b.dataset.dhDugme) { var tur = b.dataset.dhDugme, yazi = yaziVarMi(b);
            if ((tur === "ikon" && yazi) || (tur === "kucuk" && !yazi)) { delete b.dataset.dhDugme; b.classList.remove("dh-ikon-dugme", "dh-kucuk-dugme"); sirala(b); } }
        }
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", basla, { once: true }); else basla();
})(window);
