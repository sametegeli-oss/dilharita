/* dh-odak.js — ODAK MODU (tam ekran mantığı, 28 Kasım)
   Bütün sayfalarda tek düğmeyle: alt çubuk (Geri/Ana Sayfa/Menü/Düğmeler), üst menü ve süsler gizlenir;
   sayfanın kendi çalışma düğmeleri yerinde kalır. Seçim localStorage "dh-odak-v1" ("1" açık) ile hatırlanır,
   sayfadan sayfaya geçince sürer. Açıkken:
   - sol kenarda küçük ⛶ tutamaç: Ana Sayfa / Menü / Odak modundan çık
   - tarayıcıda (ana ekrana yüklenmemişse) sayfadaki ilk dokunuşta tarayıcı tam ekranı istenir
     (tarayıcı tam ekranı her sayfa değişiminde kapanır; yüklü uygulamada adres çubuğu zaten yoktur).
   Açma: kolay-kullanim menüsünde "⛶ Odak modu" ya da window.DHOdak.ac(). auth-guard her sayfaya ekler. */
(function (g) {
  "use strict";
  if (g.DHOdak) return;
  var d = g.document, K = "dh-odak-v1";
  function acikMi() { try { return localStorage.getItem(K) === "1"; } catch (e) { return false; } }
  function ayarla(v) { try { localStorage.setItem(K, v ? "1" : "0"); } catch (e) {} }
  var sayfa = decodeURIComponent((location.pathname.split("/").pop() || "index.html")).toLowerCase();
  /* kendi tam ekran düzeni olan ya da giriş sayfaları */
  var HARIC = /^(login|basla|pwa-reset|pwa-hard-reset|google-donus|veri-gizlilik)\.html?$/.test(sayfa);
  var yuklu = false;
  try { yuklu = matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches || !!navigator.standalone; } catch (e) {}

  g.DHOdak = {
    acik: acikMi,
    ac: function () { ayarla(true); location.reload(); },
    kapat: function () { ayarla(false); try { if (d.fullscreenElement && d.exitFullscreen) d.exitFullscreen().catch(function () {}); } catch (e) {} location.reload(); },
    degistir: function () { if (acikMi()) g.DHOdak.kapat(); else g.DHOdak.ac(); }
  };
  if (HARIC || !acikMi()) return;

  d.documentElement.classList.add("dh-odak");
  var st = d.createElement("style");
  st.textContent =
    "html.dh-odak .kk-alt,html.dh-odak .kk-ust-menu,html.dh-odak .kk-bosluk,html.dh-odak .dh-primary-nav,html.dh-odak .dh-app-nav," +
    "html.dh-odak .dh-mobile-menu-button,html.dh-odak .dh-mobile-menu,html.dh-odak #atlas-aurora,html.dh-odak #atlas-stars,html.dh-odak .atlas-controls{display:none!important}" +
    "html.dh-odak body,html.dh-odak body.dh-has-app-nav{padding-bottom:env(safe-area-inset-bottom)!important}" +
    ".dh-odak-tut{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:2147483000;width:30px;height:54px;border:1px solid #334155;border-left:0;" +
    "border-radius:0 12px 12px 0;background:rgba(15,23,42,.72);color:#e2e8f0;font:800 16px system-ui,sans-serif;padding:0;cursor:pointer;opacity:.75;-webkit-tap-highlight-color:transparent}" +
    ".dh-odak-pano{position:fixed;left:36px;top:50%;transform:translateY(-50%);z-index:2147483001;display:flex;flex-direction:column;gap:8px;padding:10px;" +
    "background:#0b1220;border:1px solid #334155;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.55)}" +
    ".dh-odak-pano button{border:0;border-radius:10px;padding:12px 14px;font:800 15px system-ui,sans-serif;color:#fff;background:#1e293b;text-align:left;cursor:pointer;white-space:nowrap}" +
    ".dh-odak-pano .cik{background:#2563eb}";
  (d.head || d.documentElement).appendChild(st);

  function tamEkranIste() {
    if (yuklu) return;
    try {
      var el = d.documentElement;
      if (!d.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: "hide" }).catch(function () {});
    } catch (e) {}
  }
  /* tarayıcı tam ekranı kullanıcı dokunuşu ister: sayfadaki ilk dokunuşta */
  if (!yuklu) {
    var ilk = function () { d.removeEventListener("pointerup", ilk, true); tamEkranIste(); };
    d.addEventListener("pointerup", ilk, true);
  }

  function pano() {
    var p = d.querySelector(".dh-odak-pano"); if (p) { p.remove(); return; }
    p = d.createElement("div"); p.className = "kk-ui dh-odak-pano"; p.setAttribute("data-kk-atla", "");
    var menuVar = !!d.querySelector("[data-kk-menu]");
    p.innerHTML = '<button type="button" data-o="ev">🏠 Ana Sayfa</button>' +
      (menuVar ? '<button type="button" data-o="menu">☰ Menü</button>' : "") +
      '<button type="button" data-o="geri">◀ Geri</button>' +
      '<button type="button" class="cik" data-o="cik">⛶ Odak modundan çık</button>';
    p.onclick = function (e) {
      var b = e.target.closest("button[data-o]"); if (!b) return;
      var o = b.getAttribute("data-o"); p.remove();
      if (o === "ev") location.href = "./index.html";
      else if (o === "geri") history.back();
      else if (o === "menu") { var m = d.querySelector("[data-kk-menu]"); if (m) m.click(); }
      else if (o === "cik") g.DHOdak.kapat();
    };
    d.body.appendChild(p);
    setTimeout(function () {
      var kapat = function (e) { if (!p.contains(e.target) && !e.target.closest(".dh-odak-tut")) { p.remove(); d.removeEventListener("pointerdown", kapat, true); } };
      d.addEventListener("pointerdown", kapat, true);
    }, 0);
  }
  function tutamac() {
    if (!d.body || d.querySelector(".dh-odak-tut")) return;
    var b = d.createElement("button"); b.type = "button"; b.className = "kk-ui dh-odak-tut"; b.setAttribute("data-kk-atla", "");
    b.title = "Odak modu: Ana Sayfa, Menü, çık"; b.setAttribute("aria-label", "Odak modu seçenekleri"); b.textContent = "⛶";
    b.onclick = pano;
    d.body.appendChild(b);
  }
  if (d.body) tutamac(); else d.addEventListener("DOMContentLoaded", tutamac);
})(window);
