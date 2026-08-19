/* dh-plan-kopru.js — index-app.html <-> DHPlan koprusu
   ---------------------------------------------------------------
   COZULEN HATA
   "Modulun son cumlesini yapiyorum ama modul bir turlu bitmiyor."

   index-app.html DERLENMIS bir React uygulamasi (assets/app.js) ve
   DHPlan'i hic bilmiyor. Gun plani adimlari iki yoldan bitmis sayiliyordu:
     a) DHPlan defterinde yapilan >= hedef
     b) dh-koc-steps-done isareti (SAYFA ziyareti)

   Plan ayni sayfaya giden IKI adim icerebiliyor:
       "Yeni cumleler: B1-M02"        -> index-app.html?mod=B1-M02
       "Eksik kalan A1: Demonstratives" -> index-app.html?mod=A1-M07
   Sayfa isareti ikisini AYIRT EDEMEDIGI icin biri acilinca oteki de
   bitmis gorunuyordu. Bu duzeltilince (isaret yalnizca ilk adima sayilir)
   ikinci adimi ilerletecek KIMSE kalmadi — sonsuza kadar 0/10.

   BU DOSYA o boslugu doldurur: React'e hic dokunmadan, modulun bugun
   calisilan cumlelerini sayip ilgili DHPlan adimina yazar.

   NASIL SAYIYOR
   IndexedDB "sentence-mode" > kv deposundaki uc kayit turunden
   herhangi biri BUGUN guncellenmisse o cumle "bugun calisildi" sayilir:
       prog:sentence:<id>  {status, streak, updated}
       sentence:<id>       [status, updated]        (kompakt ayna)
       srs:<id>            {rep, ef, interval, due, last}
   Uc bicimin de tolere edilmesi gerekiyor cunku farkli ekranlar farkli
   bicimde yaziyor (profile.js de ayni toleransi uyguluyor).

   NE ZAMAN OLCUYOR
   Acilista, gorunurluk degisiminde, sayfadan ayrilirken ve 8 saniyede
   bir. Olcum MUTLAK deger yazar (DHPlan.ayarla), artirmaz — yoksa her
   tazelemede birikirdi.
*/
(function (global) {
  "use strict";

  var DB = "sentence-mode", STORE = "kv";
  var PERIYOT = 8000;

  function bugunISO() {
    var t = new Date();
    return t.getFullYear() + "-" +
      String(t.getMonth() + 1).padStart(2, "0") + "-" +
      String(t.getDate()).padStart(2, "0");
  }
  function ayniGunMu(ts) {
    if (!ts) return false;
    var d = new Date(ts);
    if (isNaN(d.getTime())) return false;
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0") === bugunISO();
  }

  /* Adres cubugundaki modul */
  function aktifModul() {
    /* Liste ekranindan acilan modul URL'ye ?mod= yazmaz. Bu nedenle
       ilerlemeyi ekranda acik olan gercek modul basligiyla eslestir. */
    try {
      var el = document.querySelector(".study-title");
      var t = el ? String(el.textContent || "").trim() : "";
      if (t === "Bugün tekrar") return "";
      if (t) return t;
    } catch (e) {}
    try { return new URLSearchParams(location.search).get("mod") || ""; }
    catch (e) { return ""; }
  }

  /* Bu modulun DHPlan adimi — href icindeki mod= ile eslestirilir.
     Ayni sayfaya giden iki adim oldugu icin kimlikle degil MODULLE
     eslestirmek zorundayiz. */
  function planAdimi(mod) {
    if (!global.DHPlan || !global.DHPlan.bugun) return null;
    var p = global.DHPlan.bugun();
    if (!p || !p.adimlar) return null;
    for (var i = 0; i < p.adimlar.length; i++) {
      var h = String(p.adimlar[i].href || "");
      if (h.indexOf("index-app") < 0) continue;
      var m = h.match(/[?&]mod=([^&]*)/);
      if (!m) continue;
      var adimMod = "";
      try { adimMod = decodeURIComponent(m[1]); } catch (e) { adimMod = m[1]; }
      if (adimMod === mod) return p.adimlar[i];
    }
    return null;
  }

  /* Modulun cumle kimlikleri */
  function modulKimlikleri(mod) {
    if (!global.DHSent || !global.DHSent.index) return Promise.resolve([]);
    return global.DHSent.index().then(function (ix) {
      if (!ix || !ix.modules) return [];
      for (var i = 0; i < ix.modules.length; i++) {
        if (ix.modules[i].mod === mod) return ix.modules[i].ids || [];
      }
      return [];
    }).catch(function () { return []; });
  }

  /* kv deposunu tek gecisde oku */
  function depoOku() {
    return new Promise(function (res) {
      var out = { prog: {}, sent: {}, srs: {} };
      try {
        if (!global.indexedDB) return res(out);
        var r = global.indexedDB.open(DB, 1);
        r.onerror = function () { res(out); };
        r.onsuccess = function () {
          var db = r.result;
          if (!db.objectStoreNames.contains(STORE)) {
            try { db.close(); } catch (e) {}
            return res(out);
          }
          try {
            var q = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
            q.onsuccess = function (e) {
              var c = e.target.result;
              if (!c) { try { db.close(); } catch (e2) {} return res(out); }
              var k = String(c.key);
              if (k.indexOf("prog:sentence:") === 0) out.prog[k.slice(14)] = c.value;
              else if (k.indexOf("sentence:") === 0) out.sent[k.slice(9)] = c.value;
              else if (k.indexOf("srs:") === 0) out.srs[k.slice(4)] = c.value;
              c.continue();
            };
            q.onerror = function () { try { db.close(); } catch (e3) {} res(out); };
          } catch (e4) { res(out); }
        };
      } catch (e5) { res(out); }
    });
  }

  /* Bir cumle bugun calisildi mi — uc bicimi de tolere eder */
  function bugunCalisildi(D, id) {
    var p = D.prog[id];
    if (p && ayniGunMu(p.updated)) return true;

    var m = D.sent[id];
    if (m) {
      if (Array.isArray(m) && ayniGunMu(m[1])) return true;
      if (!Array.isArray(m) && ayniGunMu(m.updated)) return true;
    }

    var s = D.srs[id];
    if (s && ayniGunMu(s.last)) return true;

    return false;
  }

  /* Modulun TAMAMI islenmis mi (adimi erken kapatmak icin) */
  function modulBitti(D, ids) {
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (!(D.prog[id] || D.sent[id] || D.srs[id])) return false;
    }
    return ids.length > 0;
  }

  var sonYazilan = -1;

  function olc() {
    var mod = aktifModul();
    if (!mod) return Promise.resolve();

    var adim = planAdimi(mod);
    if (!adim) return Promise.resolve();          /* bu modul planda degil */

    return Promise.all([modulKimlikleri(mod), depoOku()]).then(function (a) {
      var ids = a[0], D = a[1];
      if (!ids.length) return;

      var n = 0;
      for (var i = 0; i < ids.length; i++) if (bugunCalisildi(D, ids[i])) n++;

      /* Modulun tamami islenmisse adim hedefine cekilir: kullanici
         "son cumleyi yaptim ama bitmedi" durumuna dusmesin. */
      if (modulBitti(D, ids)) n = adim.hedef;

      if (n === sonYazilan) return;
      sonYazilan = n;
      try { global.DHPlan.ayarla(adim.id, n); } catch (e) {}
    }).catch(function () {});
  }

  function baslat() {
    if (!global.DHPlan) return;                   /* dh-plan.js yuklenmemis */
    olc();
    setInterval(olc, PERIYOT);
    global.addEventListener("pagehide", olc);
    global.document.addEventListener("visibilitychange", function () {
      if (global.document.visibilityState === "hidden") olc();
      else olc();
    });
  }

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", baslat, { once: true });
  } else {
    baslat();
  }

  global.DHPlanKopru = { olc: olc, _bugunCalisildi: bugunCalisildi, _planAdimi: planAdimi };
})(typeof window !== "undefined" ? window : globalThis);
