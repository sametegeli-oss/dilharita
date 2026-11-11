/* dh-sesli-modul.js — her modül ekranına "Bu modülü sesli çalış" düğmesi
   ====================================================================
   Modülün çalışıldığı üç ekran:
     index-app.html     (Cümle Çalış)       başlık: .study-title (tam modül adı)
     ogren.html         (Görselle Öğren)    başlık: h1 (kısa ad), #replayBtn var
     videopractice.html (Videoyla Okuma)    aynı yapı
   ogren/videopractice'te tam ad başlıkta yok; modül kutucuğundaki data-mod
   dokunulduğu anda saklanır (ya da adresteki ?module=).

   Düğme sesli-calis.html?mod=<TAM MODÜL ADI> açar. Sayfaların kendi
   çizimine dokunulmaz; başlığın hemen altına eklenir, sayfa yeniden
   çizince MutationObserver yeniden ekler.
*/
(function () {
  "use strict";
  if (window.__dhSesliModul) return;
  window.__dhSesliModul = true;

  var SON = "dh-sesli-modul-son";

  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest("[data-mod]");
    if (t) { try { sessionStorage.setItem(SON, t.getAttribute("data-mod") || ""); } catch (x) {} }
  }, true);

  function gorunur(el) { return !!(el && el.offsetParent); }

  function aktifModul() {
    var st = document.querySelector(".study-title");
    if (gorunur(st)) {
      var ad = (st.textContent || "").trim();
      try { ad = new URLSearchParams(location.search).get("mod") || ad; } catch (e) {}
      /* başlık daha güncelse onu kullan (modül değiştirilmiş olabilir) */
      if ((st.textContent || "").trim() && ad !== (st.textContent || "").trim()) ad = (st.textContent || "").trim();
      /* başlık dar bir yatay satırın içinde: düğme o satırın ALTINA girer */
      var satir = st.parentElement;
      var yer = (satir && getComputedStyle(satir).display.indexOf("flex") >= 0) ? satir : st;
      return ad ? { ad: ad, yer: yer } : null;
    }
    var rb = document.getElementById("replayBtn");
    if (!gorunur(rb)) return null;
    var adaylar = [];
    try { adaylar.push(new URLSearchParams(location.search).get("module") || ""); } catch (e) {}
    try { adaylar.push(sessionStorage.getItem(SON) || ""); } catch (e) {}
    /* sayfada birden çok h1 olabilir (sayfa başlığı + modül başlığı) */
    var h1ler = document.querySelectorAll("h1");
    for (var i = 0; i < h1ler.length; i++) {
      var h1 = h1ler[i], kisa = (h1.textContent || "").trim();
      if (!kisa || !gorunur(h1)) continue;
      for (var j = 0; j < adaylar.length; j++)
        /* başlık alanı dar ve sabit yükseklikte: düğme alttaki kontrol
           satırının üstüne, tam genişlikte bir satır olarak girer */
        if (adaylar[j] && adaylar[j].indexOf(kisa) >= 0) return { ad: adaylar[j], yuzen: rb.closest(".video-page") || document.body };
    }
    return null;
  }

  function stil() {
    if (document.getElementById("dhSesliModulCss")) return;
    var s = document.createElement("style");
    s.id = "dhSesliModulCss";
    s.textContent =
      ".dh-sesli-modul-btn{display:flex;align-items:center;justify-content:center;gap:8px;" +
      "min-height:52px;margin:8px 0 10px;padding:10px 16px;border-radius:14px;" +
      "background:#0f766e;border:2px solid #5eead4;color:#fff!important;text-decoration:none!important;" +
      "font:800 18px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;box-sizing:border-box;width:100%;max-width:520px}" +
      ".dh-sesli-modul-btn:focus-visible{outline:3px solid #fff;outline-offset:2px}" +
      ".dh-sesli-modul-btn--yuzen{position:fixed;left:16px;z-index:6;width:auto;max-width:60%;min-height:48px;margin:0;font-size:17px;box-shadow:0 6px 18px rgba(0,0,0,.45)}";
    document.head.appendChild(s);
  }

  /* Bu iki sayfada her şey ekrana sabit (position:fixed). Hap, sol sütunda
     üstteki sabit öğelerin (Fotoğraf, Resim/Video, Önceki…) altına ve
     ortadaki bilgi kutusunun üstüne yerleşir. */
  function konumla(b) {
    var alt = 70, sinir = 9999;
    var st = document.getElementById("videoStatus");
    if (st && getComputedStyle(st).display !== "none" && st.getBoundingClientRect().height > 0) sinir = st.getBoundingClientRect().top;
    Array.prototype.forEach.call(document.querySelectorAll("body > *, body > * > *, .video-page > *, .video-page > * > *"), function (x) {
      if (x === b || b.contains(x)) return;
      var cs = getComputedStyle(x);
      if (cs.position !== "fixed" && cs.position !== "absolute") return;
      if (cs.display === "none" || cs.visibility === "hidden") return;
      if (x.closest(".kk-alt,.kk-ui")) return;
      var r = x.getBoundingClientRect();
      if (r.width < 20 || r.height < 20 || r.width > 300) return;
      if (r.left < 190 && r.top < sinir - 10 && r.top > 40 && r.bottom > alt && r.bottom < sinir) alt = r.bottom;
    });
    var y = Math.round(Math.min(alt + 8, (sinir < 9999 ? sinir : 320) - 56));
    b.style.top = y + "px";
  }
  setInterval(function () {
    var b = document.getElementById("dhSesliModulBtn");
    if (b && b.classList.contains("dh-sesli-modul-btn--yuzen") && b.parentElement) konumla(b);
  }, 1000);

  var bekliyor = false;
  function ciz() {
    bekliyor = false;
    var a = aktifModul(), b = document.getElementById("dhSesliModulBtn");
    if (!a) { if (b) b.remove(); return; }
    var yerinde = a.yuzen ? (b && b.parentElement === a.yuzen)
                          : (b && b.previousElementSibling === a.yer);
    if (b && b.getAttribute("data-mod") === a.ad && yerinde){ if (a.yuzen) konumla(b); return; }
    if (b) b.remove();
    stil();
    b = document.createElement("a");
    b.id = "dhSesliModulBtn";
    b.className = "dh-sesli-modul-btn";
    b.setAttribute("data-mod", a.ad);
    b.href = "./sesli-calis.html?mod=" + encodeURIComponent(a.ad);
    b.textContent = "🎧 Bu modülü sesli çalış";
    b.setAttribute("aria-label", "Bu modülü sesli çalış: ekrana bakmadan, dinleyip söyleyerek");
    if (a.yuzen){
      /* Görselle Öğren / Videoyla Okuma: ekran tam yükseklikte ve sıkışık;
         düğme videonun üstünde, başlığın hemen altında küçük bir hap olarak durur */
      b.classList.add("dh-sesli-modul-btn--yuzen");
      b.textContent = "🎧 Sesli çalış";
      a.yuzen.appendChild(b);
      konumla(b);
    }
    else a.yer.insertAdjacentElement("afterend", b);
  }
  function planla() { if (!bekliyor) { bekliyor = true; requestAnimationFrame(ciz); } }

  function basla() {
    ciz();
    new MutationObserver(planla).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", basla);
  else basla();
})();
