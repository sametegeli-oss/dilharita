/* dh-modul-bitir.js — index-app.html: MODUL BITISI ve PLANDA SIRADAKINE GECIS
   ================================================================
   COZULEN SORUN
   Modulun son cumlesi notlaniyor, "Sonraki →" devre disi kaliyor ve
   HICBIR SEY olmuyor. Modul kapanmiyor, plan ilerlemiyor, kullanici
   ekranda takili kaliyor. Gunun plani "3/4" derken hangi 4'uncu adima
   gidecegi de soylenmiyor.

   NEDEN BU DOSYA (React'e dokunulmaz)
   index-app.html DERLENMIS bir React paketi (assets/app.js). Yerlesik
   desen: eklenti betigi + DOM sonradan-isleme. Bu dosya da oyle calisir.

   ── KESIN VERI KAYNAGI (olculdu, varsayilmadi) ──
   React'in kendi kodu her notlamada su iki kaydi yaziyor:
       srs:<cumleId>          {rep, ef, interval, due, last}
       prog:<MODUL ADI>       {idx, seen:{<cumleId>:true, ...}}
   Ikincisi modulun GERCEK tamamlanma defteri: hangi cumle gorulmus,
   kacinci kartta kalinmis. Bugune kadar bunu okuyan olmadi —
   dh-plan-kopru.js "prog:sentence:<id>" arıyor, oyle bir anahtari
   HICBIR dosya yazmiyor (profile.js de ayni yanlisi yapiyor). Bu dosya
   dogru anahtari okur.

   ── DAVRANIS ──
   1) Modulun TUM cumleleri notlanmissa:
        "Modul bitti 🎉" paneli · 5 sn geri sayim · sonra otomatik gecis.
        Gecmeden once DHPlan defterindeki ilgili adim TAMAMLANIR.
   2) Son karta gelinmis ama arada ATLANAN cumle varsa:
        "N cumle atladin" paneli · otomatik gecis YOK · buton kullaniciyi
        ilk atlanan cumleye goturur (prog:<mod>.idx yazilip sayfa yenilenir;
        React acilista T() ile o indexten basliyor — metin arama yok).
   3) Sirdaki hedef GUNUN PLANINDAN secilir:
        a) plandaki bitmemis bir sonraki index-app adimi (or. telafi modulu)
        b) yoksa plandaki bitmemis ilk adim (or. "1 dakika konus")
        c) plan bittiyse ana ekran (index.html)

   ── DOKUNULMAYANLAR ──
   koc.js (analiz zinciri), assets/app.js, dh-plan.js API'si. Bu dosya
   yalnizca OKUR ve DHPlan.tamamla / prog:<mod>.idx yazar.
*/
(function (global) {
  "use strict";
  if (global.__dhModulBitir) return;
  global.__dhModulBitir = true;

  var DB = "sentence-mode", STORE = "kv";
  var GERI_SAYIM = 5;                 /* saniye */
  var PERIYOT = 3000;                 /* guvenlik agi taramasi */
  var ISARET = "dh-modul-bitti-v1";   /* {<modul>: "YYYY-MM-DD"} — gunde bir kez */

  /* koc.js ve index.html ile AYNI gun anahtari (toISOString) — plan
     anahtarlari onlarla eslesmek zorunda. */
  function gun() { return new Date().toISOString().slice(0, 10); }

  /* ───────────────────────── IndexedDB ───────────────────────── */
  function ac() {
    return new Promise(function (res, rej) {
      try {
        var r = global.indexedDB.open(DB, 1);
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
  }
  function kvOku(anahtar) {
    return ac().then(function (d) {
      return new Promise(function (res) {
        try {
          var q = d.transaction(STORE, "readonly").objectStore(STORE).get(anahtar);
          q.onsuccess = function () { try { d.close(); } catch (e) {} res(q.result || null); };
          q.onerror = function () { try { d.close(); } catch (e) {} res(null); };
        } catch (e) { try { d.close(); } catch (e2) {} res(null); }
      });
    }).catch(function () { return null; });
  }
  function kvYaz(anahtar, deger) {
    return ac().then(function (d) {
      return new Promise(function (res) {
        try {
          var t = d.transaction(STORE, "readwrite");
          t.objectStore(STORE).put(deger, anahtar);
          t.oncomplete = function () { try { d.close(); } catch (e) {} res(true); };
          t.onerror = function () { try { d.close(); } catch (e) {} res(false); };
        } catch (e) { try { d.close(); } catch (e2) {} res(false); }
      });
    }).catch(function () { return false; });
  }

  /* ─────────────────────── aktif modul ──────────────────────── */
  /* Once EKRANDAKI baslik (React'in kendi study-title'i = modul adi),
     sonra adres cubugu. Boylece kullanici modulu listeden actiginda da
     (URL'de ?mod= olmadan) calisir. */
  function aktifModul() {
    try {
      var el = document.querySelector(".study-title");
      var t = el ? String(el.textContent || "").trim() : "";
      /* Tekrar oturumu modul DEGILDIR (React basligi "Bugün tekrar" yapar).
         Bu durumda URL yedegine de DUSULMEZ — kullanici modulden tekrara
         gecmis olabilir ve adres cubugunda eski ?mod= duruyor olabilir. */
      if (t === "Bugün tekrar") return "";
      if (t) return t;
    } catch (e) {}
    try { return new URLSearchParams(location.search).get("mod") || ""; }
    catch (e) { return ""; }
  }

  /* Son kartta miyiz — React "Sonraki →" dugmesini h>=t-1 iken disable eder */
  function sonKartta() {
    var b = document.querySelector(".study-nav .btn-primary");
    if (b) return !!b.disabled;
    var p = document.querySelector("#dhNavTrio .dh-nav-next");
    return !!(p && p.disabled);
  }
  /* Bu kart notlandi mi — React notlayinca grade-bar yerine grade-done basar */
  function notlandi() { return !!document.querySelector(".grade-done"); }

  /* ────────────────────── modul durumu ─────────────────────── */
  function kimlikler(mod) {
    if (!(global.DHSent && global.DHSent.index)) return Promise.resolve([]);
    return global.DHSent.index().then(function (ix) {
      var ms = (ix && ix.modules) || [];
      for (var i = 0; i < ms.length; i++) if (ms[i].mod === mod) return ms[i].ids || [];
      return [];
    }).catch(function () { return []; });
  }
  function durum(mod) {
    return Promise.all([kimlikler(mod), kvOku("prog:" + mod)]).then(function (a) {
      var ids = a[0], p = a[1] || {}, seen = p.seen || {};
      var eksik = [];
      for (var i = 0; i < ids.length; i++) if (!seen[ids[i]]) eksik.push(i);
      return { ids: ids, idx: p.idx || 0, eksik: eksik, bitti: ids.length > 0 && eksik.length === 0 };
    });
  }

  /* ───────────────────────── gunun plani ───────────────────── */
  function kocPlan() {
    try { return JSON.parse(localStorage.getItem("dh-koc-plan-" + gun()) || "null"); }
    catch (e) { return null; }
  }
  function adimModulu(href) {
    var m = String(href || "").match(/[?&]mod=([^&]*)/);
    if (!m) return "";
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }
  /* Defterdeki adim — dh-plan.js'in KENDI href eslestirmesi kullanilir
     (adimHref tam href karsilastirir; tip bazli kimlik cakismasi yasanmaz). */
  function defterAdimi(href) {
    try { return (global.DHPlan && global.DHPlan.adimHref) ? global.DHPlan.adimHref(href) : null; }
    catch (e) { return null; }
  }
  function defterBittiMi(href) {
    var a = defterAdimi(href);
    return !!(a && a.hedef && a.yapilan >= a.hedef);
  }

  /* Plandaki bir sonraki hedef. index-app adimlari icin "bitti" olcusu
     GERCEK modul durumudur (prog:<mod>.seen), defter degil. */
  function siradaki(mevcutMod) {
    var plan = kocPlan();
    var adimlar = (plan && plan.steps) || [];
    if (!adimlar.length) return Promise.resolve(null);

    var isler = adimlar.map(function (s) {
      var m = adimModulu(s.href);
      if (m && m !== mevcutMod) {
        return durum(m).then(function (d) { return { adim: s, mod: m, bitti: d.bitti }; });
      }
      return Promise.resolve({
        adim: s, mod: m,
        bitti: (m === mevcutMod) ? true : defterBittiMi(s.href)
      });
    });

    return Promise.all(isler).then(function (liste) {
      var kalan = liste.filter(function (x) { return !x.bitti; });
      /* once bir sonraki MODUL adimi (telafi vb.), yoksa ilk bitmemis adim */
      var modAdimi = kalan.filter(function (x) { return !!x.mod; })[0];
      var hedef = modAdimi || kalan[0];
      if (!hedef) return null;
      return { href: hedef.adim.href, etiket: hedef.adim.label || hedef.adim.href, modul: hedef.mod };
    });
  }

  /* ───────────────────────── isaretler ─────────────────────── */
  function isaretliMi(mod) {
    try {
      var s = JSON.parse(localStorage.getItem(ISARET) || "{}") || {};
      return s[mod] === gun();
    } catch (e) { return false; }
  }
  function isaretle(mod) {
    try {
      var s = JSON.parse(localStorage.getItem(ISARET) || "{}") || {};
      s[mod] = gun();
      localStorage.setItem(ISARET, JSON.stringify(s));
    } catch (e) {}
  }

  /* ───────────────────────── panel ─────────────────────────── */
  function stil() {
    if (document.getElementById("dh-mb-css")) return;
    var s = document.createElement("style");
    s.id = "dh-mb-css";
    s.textContent =
      ".dh-mb{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483000;"
      + "width:min(520px,94vw);background:#0b1a33;border:1px solid #2563eb;border-radius:16px;"
      + "padding:14px 16px;box-shadow:0 18px 50px rgba(0,0,0,.55);color:#e8eef7;"
      + "font:600 13.5px Nunito,system-ui,sans-serif}"
      + ".dh-mb--eksik{border-color:#f59e0b}"
      + ".dh-mb__bas{font:900 15px Nunito,system-ui,sans-serif;margin-bottom:4px}"
      + ".dh-mb__alt{color:#9fb3d9;font-size:12.5px;margin-bottom:10px}"
      + ".dh-mb__sira{display:flex;gap:8px}"
      + ".dh-mb__btn{flex:1;min-height:40px;border-radius:11px;border:0;cursor:pointer;"
      + "font:800 13px Nunito,system-ui,sans-serif;background:#2563eb;color:#fff}"
      + ".dh-mb__btn:hover{background:#2f6fe0}"
      + ".dh-mb__btn--sade{flex:0 0 auto;padding:0 14px;background:#1a2942;color:#cfe0ff;"
      + "border:1px solid rgba(255,255,255,.14)}";
    document.head.appendChild(s);
  }

  var acikPanel = null, sayacId = null;
  function paneliKapat() {
    if (sayacId) { clearInterval(sayacId); sayacId = null; }
    if (acikPanel && acikPanel.parentNode) acikPanel.remove();
    acikPanel = null;
  }
  /* otomatik: sayi ise geri sayim baslar, 0 ise yalnizca buton */
  function panelAc(o) {
    stil();
    paneliKapat();
    var k = document.createElement("div");
    k.className = "dh-mb" + (o.uyari ? " dh-mb--eksik" : "");
    k.id = "dhModulBitirPanel";

    var bas = document.createElement("div");
    bas.className = "dh-mb__bas"; bas.textContent = o.baslik;

    var alt = document.createElement("div");
    alt.className = "dh-mb__alt"; alt.textContent = o.alt || "";

    var sira = document.createElement("div"); sira.className = "dh-mb__sira";
    var git = document.createElement("button");
    git.className = "dh-mb__btn"; git.type = "button";
    git.textContent = o.btn;
    git.onclick = function () { paneliKapat(); o.git(); };

    var kal = document.createElement("button");
    kal.className = "dh-mb__btn dh-mb__btn--sade"; kal.type = "button";
    kal.textContent = "Burada kal";
    kal.onclick = paneliKapat;

    sira.appendChild(git); sira.appendChild(kal);
    k.appendChild(bas); k.appendChild(alt); k.appendChild(sira);
    document.body.appendChild(k);
    acikPanel = k;

    if (o.otomatik) {
      var n = o.otomatik;
      var yaz = function () { git.textContent = o.btn + " (" + n + ")"; };
      yaz();
      sayacId = setInterval(function () {
        n--;
        if (n <= 0) { clearInterval(sayacId); sayacId = null; paneliKapat(); o.git(); return; }
        yaz();
      }, 1000);
    }
    return k;
  }

  function gitHref(href) { location.href = "./" + href; }

  /* ─────────────────── 1) MODUL BITTI AKISI ────────────────── */
  function modulBitti(mod) {
    if (isaretliMi(mod)) return;
    isaretle(mod);

    /* Defterdeki adim kapatilir — plan sayaci gercek bitisle ayni olsun. */
    try {
      var plan = kocPlan(), adimlar = (plan && plan.steps) || [];
      for (var i = 0; i < adimlar.length; i++) {
        if (adimModulu(adimlar[i].href) !== mod) continue;
        var a = defterAdimi(adimlar[i].href);
        if (a && global.DHPlan && global.DHPlan.tamamla) global.DHPlan.tamamla(a.id);
      }
    } catch (e) {}

    siradaki(mod).then(function (h) {
      if (!h) {
        panelAc({
          baslik: "Modül bitti 🎉",
          alt: "Bugünün planında başka adım kalmadı.",
          btn: "Ana ekrana dön", otomatik: GERI_SAYIM,
          git: function () { gitHref("index.html"); }
        });
        return;
      }
      panelAc({
        baslik: "Modül bitti 🎉  " + kisa(mod),
        alt: "Sırada: " + h.etiket,
        btn: h.modul ? "Sıradaki modüle geç" : "Devam et",
        otomatik: GERI_SAYIM,
        git: function () { gitHref(h.href); }
      });
    }).catch(function () {});
  }
  function kisa(mod) { return String(mod || "").replace(/^[A-C][12]-M\d+\s*/, ""); }

  /* ────────────── 2) ATLANAN CUMLE VAR AKISI ───────────────── */
  var eksikGosterildi = false;
  function eksikVar(mod, d) {
    if (eksikGosterildi) return;
    eksikGosterildi = true;
    var ilk = d.eksik[0];
    panelAc({
      uyari: true,
      baslik: "Modülün sonundasın ama " + d.eksik.length + " cümle atlanmış",
      alt: "Modül ancak tüm cümleler notlanınca biter. Atlanan ilk cümleye götüreyim mi?",
      btn: "Atlanan cümleye git",
      otomatik: 0,                       /* burada otomatik gecis YOK */
      git: function () {
        kvOku("prog:" + mod).then(function (p) {
          var y = p || { idx: 0, seen: {} };
          y.idx = ilk;                   /* React acilista T() ile bu indexten basliyor */
          return kvYaz("prog:" + mod, y);
        }).then(function () {
          gitHref("index-app.html?mod=" + encodeURIComponent(mod));
        });
      }
    });
  }

  /* ───────────────────────── denetim ───────────────────────── */
  var mesgul = false;
  function kontrol() {
    if (mesgul || acikPanel) return Promise.resolve();
    var mod = aktifModul();
    if (!mod) return Promise.resolve();
    mesgul = true;
    return durum(mod).then(function (d) {
      if (!d.ids.length) return;
      if (d.bitti) { modulBitti(mod); return; }
      if (sonKartta() && notlandi()) eksikVar(mod, d);
    }).catch(function () {}).then(function () { mesgul = false; });
  }

  function baslat() {
    /* notlama → React once srs, sonra prog:<mod> yaziyor; kisa bekleme */
    document.addEventListener("click", function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest(".grade-bar")) {
          setTimeout(kontrol, 450);
          setTimeout(kontrol, 1200);      /* yavas cihaz icin ikinci deneme */
        }
      } catch (err) {}
    }, true);

    /* guvenlik agi: baska yoldan notlanirsa da yakalansin */
    setInterval(kontrol, PERIYOT);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") kontrol();
    });
    setTimeout(kontrol, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", baslat, { once: true });
  } else { baslat(); }

  /* test yuzeyi */
  global.DHModulBitir = {
    kontrol: kontrol, durum: durum, siradaki: siradaki,
    _aktifModul: aktifModul, _modulBitti: modulBitti, _panelAc: panelAc, _kapat: paneliKapat
  };
})(typeof window !== "undefined" ? window : globalThis);
