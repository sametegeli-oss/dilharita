/* dh-modul-enjekte.js — kullanici modullerini index-app.html'e sokar
   ===============================================================
   SORUN
   index-app.html derlenmis bir React uygulamasi (assets/app.js) ve
   kendi verisini SU SATIRLA cekiyor:

       fetch("./data/sentences.json")

   Donen diziyi `module` alanina gore gruplayip modul listesini
   kuruyor. Yani uygulama, localStorage'daki kullanici modullerini
   bilmiyor ve bilemez — derlenmis kodun icine giremeyiz.

   COZUM
   Uygulamadan ONCE calisip window.fetch'i sarmalariz. Istek
   data/sentences.json'a gidiyorsa gercek yaniti aliriz, kullanici
   cumlelerini dizinin SONUNA ekleriz ve yeni bir Response dondururuz.

   Uygulama farki anlamaz: kayitlar resmi verinin 23 alaniyla birebir
   ayni sekle sahip (dh-modul.js bunu garanti ediyor). Modul listesinde
   yeni bir modul olarak belirir, resmi modullerle ayni ekranda,
   ayni gorsel/IPA/kelime araclariyla calisilir.

   YUKLEME SIRASI KRITIK
   index-app.html icinde app.js su sekilde:
       <script type="module" crossorigin src="./assets/app.js">
   type="module" varsayilan olarak DEFER'lidir. Bu dosya klasik bir
   <script> olarak ONUNDE durursa app.js'ten once calisir ve fetch
   yamasi yerine oturur.

   BAGIMLILIK: dh-modul.js bundan once yuklenmeli.
*/
(function (global) {
  "use strict";
  if (global.__dhModulEnjekte) return;
  global.__dhModulEnjekte = true;

  var HEDEF = /data\/sentences\.json(\?|$)/;

  function kullaniciCumleleri() {
    try {
      if (!global.DHModul || !global.DHModul.liste) return [];
      var out = [];
      global.DHModul.liste().forEach(function (m) {
        var kayitlar = global.DHModul.getir(m.id) || [];
        kayitlar.forEach(function (k) { if (k && k.en && k.id) out.push(k); });
      });
      return out;
    } catch (e) { return []; }
  }

  var orijinalFetch = global.fetch ? global.fetch.bind(global) : null;
  if (!orijinalFetch) return;

  global.fetch = function (girdi, secenek) {
    var url = "";
    try {
      url = (typeof girdi === "string") ? girdi
          : (girdi && girdi.url) ? girdi.url : String(girdi);
    } catch (e) { url = ""; }

    if (!HEDEF.test(url)) return orijinalFetch(girdi, secenek);

    return orijinalFetch(girdi, secenek).then(function (yanit) {
      if (!yanit || !yanit.ok) return yanit;

      var ek = kullaniciCumleleri();
      if (!ek.length) return yanit;               /* modul yoksa dokunma */

      return yanit.json().then(function (veri) {
        if (!Array.isArray(veri)) return yeniYanit(veri, yanit);

        /* Ayni id iki kez girmesin (senkron sonrasi tekrar acilislar) */
        var varOlan = {};
        for (var i = 0; i < veri.length; i++) varOlan[String(veri[i].id)] = 1;

        var eklenen = 0;
        for (var j = 0; j < ek.length; j++) {
          if (varOlan[String(ek[j].id)]) continue;
          veri.push(ek[j]);
          eklenen++;
        }
        try {
          if (eklenen) console.log("[dh] " + eklenen + " kullanıcı cümlesi eklendi");
        } catch (e) {}
        return yeniYanit(veri, yanit);
      }).catch(function () {
        /* JSON okunamadiysa orijinali bozmadan geri ver */
        return orijinalFetch(girdi, secenek);
      });
    });
  };

  function yeniYanit(veri, eski) {
    var govde = JSON.stringify(veri);
    try {
      return new Response(govde, {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      /* Response kurucusu yoksa (cok eski tarayici) sahte nesne */
      return {
        ok: true, status: 200,
        json: function () { return Promise.resolve(veri); },
        text: function () { return Promise.resolve(govde); }
      };
    }
  }

  global.DHModulEnjekte = {
    cumleler: kullaniciCumleleri,
    _hedef: HEDEF
  };
})(typeof window !== "undefined" ? window : globalThis);
