/* dh-modul-vitrin.js — kullanici modullerine index-app icinde kendi bolumu
   ===============================================================
   NEDEN
   dh-modul-enjekte.js kullanici cumlelerini verinin icine soktugu icin
   moduller index-app listesinde ZATEN gorunuyor. Ama uygulama modulleri
   SEVIYEYE gore gruplayip alfabetik siraliyor; "Comparatives · P1 ·
   Finans ve muhasebe" B2 basligi altinda elli modulun arasina karisiyor.
   Yani sorun varlik degil, GORUNURLUK.

   NE YAPAR
   Liste ekrani cizildikten sonra kullanici modullerinin kutucuklarini
   bulur, en uste kendi bolumune TASIR (kopyalamaz — iki kez gorunmesin)
   ve sonuna "yeni modul uret" kutucugu ekler.

   GORUNUM
   Uygulamanin KENDI siniflari kullanilir:
     .level-section .level-title .level-badge .level-count
     .module-grid .module-tile .module-name .module-count
   Boylece bolum, resmi seviye bolumleriyle birebir ayni gorunur;
   ayri bir tasarim dili sokusturmus olmayiz.

   REACT'E DOKUNULMAZ
   Uygulama yeniden cizim yapinca degisiklik silinir; MutationObserver
   ile tekrar uygulanir. index-app-layout.js ve mod-autopen.js de ayni
   yaklasimi kullaniyor — bu sayfada yerlesmis bir desen.

   BAGIMLILIK: dh-modul.js
*/
(function (global) {
  "use strict";
  if (global.__dhVitrin) return;
  global.__dhVitrin = true;

  var BOLUM_ID = "dhModullerimBolum";
  var zamanlayici = null;

  function modulAdlari() {
    try {
      if (!global.DHModul || !global.DHModul.liste) return {};
      var m = {};
      global.DHModul.liste().forEach(function (x) { if (x && x.ad) m[x.ad] = x; });
      return m;
    } catch (e) { return {}; }
  }

  /* Uygulamanin kendi bolum iskeleti — sinifları birebir ayni */
  function bolumKur(adet) {
    var sec = document.createElement("section");
    sec.className = "level-section";
    sec.id = BOLUM_ID;

    var h2 = document.createElement("h2");
    h2.className = "level-title";

    var rozet = document.createElement("span");
    rozet.className = "level-badge";
    rozet.textContent = "Benim";

    var sayi = document.createElement("span");
    sayi.className = "level-count";
    sayi.textContent = adet + " modül";

    h2.appendChild(rozet);
    h2.appendChild(sayi);

    var izgara = document.createElement("div");
    izgara.className = "module-grid";

    sec.appendChild(h2);
    sec.appendChild(izgara);
    return sec;
  }

  /* "Yeni modül üret" kutucugu — ayni gorunumde ama link */
  function uretKutucugu() {
    var a = document.createElement("a");
    a.className = "module-tile";
    a.href = "./modullerim.html";
    a.setAttribute("data-dh-uret", "1");
    a.style.textDecoration = "none";
    a.style.borderStyle = "dashed";

    var ad = document.createElement("span");
    ad.className = "module-name";
    ad.textContent = "＋ Yeni modül üret";

    var alt = document.createElement("span");
    alt.className = "module-count";
    alt.textContent = "kendi ilgi alanında";

    a.appendChild(ad);
    a.appendChild(alt);
    return a;
  }

  function uygula() {
    var adlar = modulAdlari();
    var anahtarlar = Object.keys(adlar);
    if (!anahtarlar.length) return;              /* modul yoksa hic dokunma */

    var izgaralar = document.querySelectorAll(".module-grid");
    if (!izgaralar.length) return;               /* liste henuz cizilmedi */

    /* Zaten kurulmus ve dolu mu? */
    var mevcut = document.getElementById(BOLUM_ID);
    if (mevcut && mevcut.querySelectorAll(".module-tile[data-dh-usr]").length === anahtarlar.length) {
      return;
    }
    if (mevcut && mevcut.parentNode) mevcut.parentNode.removeChild(mevcut);

    /* Kullanici kutucuklarini bul */
    var bulunan = [];
    for (var g = 0; g < izgaralar.length; g++) {
      var kutucuklar = izgaralar[g].querySelectorAll(".module-tile");
      for (var i = 0; i < kutucuklar.length; i++) {
        var isim = kutucuklar[i].querySelector(".module-name");
        var ad = isim ? String(isim.textContent || "").trim() : "";
        if (adlar[ad]) bulunan.push(kutucuklar[i]);
      }
    }
    if (!bulunan.length) return;                 /* veri henuz gelmemis */

    var bolum = bolumKur(bulunan.length);
    var izgara = bolum.querySelector(".module-grid");

    /* TASI — kopyalama. Kopyalasaydik React'in tikla dinleyicisi
       kaybolur ve modul iki kez gorunurdu. */
    bulunan.forEach(function (el) {
      el.setAttribute("data-dh-usr", "1");
      izgara.appendChild(el);
    });
    izgara.appendChild(uretKutucugu());

    /* Bolumu listenin EN USTUNE koy */
    var ilkBolum = document.querySelector(".level-section");
    if (ilkBolum && ilkBolum.parentNode) {
      ilkBolum.parentNode.insertBefore(bolum, ilkBolum);
    } else if (izgaralar[0] && izgaralar[0].parentNode && izgaralar[0].parentNode.parentNode) {
      izgaralar[0].parentNode.parentNode.insertBefore(bolum, izgaralar[0].parentNode);
    }

    /* Bosalan seviye basliklarindaki sayilari duzelt */
    document.querySelectorAll(".level-section").forEach(function (s) {
      if (s.id === BOLUM_ID) return;
      var n = s.querySelectorAll(".module-tile").length;
      var c = s.querySelector(".level-count");
      if (c) c.textContent = n + " modül";
      s.hidden = (n === 0);
    });
  }

  function planla() {
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(function () {
      try { uygula(); } catch (e) {}
    }, 120);
  }

  function baslat() {
    /* Moduller IndexedDB'den geliyor: ilk cizimi ayna yuklenince yap. */
    try {
      if (global.DHModul && global.DHModul.hazir) global.DHModul.hazir().then(planla);
    } catch (e) {}
    planla();
    try {
      var g = new MutationObserver(planla);
      g.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    /* Guvenlik agi: ilk veri gec gelirse */
    setTimeout(planla, 800);
    setTimeout(planla, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", baslat, { once: true });
  } else {
    baslat();
  }

  global.DHModulVitrin = { uygula: uygula, _BOLUM_ID: BOLUM_ID };
})(typeof window !== "undefined" ? window : globalThis);
