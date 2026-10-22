/* idb-uyum.js — "sentence-mode" veritabanı sürüm uyumu (her sayfada İLK betik)
   ------------------------------------------------------------------------
   SORUN: Programın 15'ten fazla yeri bu veritabanını indexedDB.open(ad, 1)
   ile açıyor. dh-modul.js ise sürüm vermeden açıp "kv" deposu yoksa sürümü
   bir artırıyordu. Yeni bir tarayıcıda veritabanını ilk açan dh-modul.js
   olursa veritabanı 2. sürüme çıkıyor; o andan sonra open(ad, 1) çağrıları
   VersionError ile sessizce düşüyor: tekrar listesi boş görünüyor, ilerleme,
   koç ve günlük plan veri okuyamıyordu.

   ÇÖZÜM: Bu ad için istenen sürüm 1 ise sürümsüz açılır. Sürümsüz açış
   veritabanı yoksa onu 1. sürümle oluşturur ve onupgradeneeded'i yine
   tetikler (depoyu çağıran kod kurar); varsa hangi sürümdeyse onu açar.
   Başka veritabanlarına ve 1'den büyük açık sürüm isteklerine dokunulmaz. */
(function () {
  "use strict";
  try {
    var F = window.IDBFactory && IDBFactory.prototype;
    if (!F || F.__dhIdbUyum) return;
    var asil = F.open;
    F.open = function (ad, surum) {
      if (ad === "sentence-mode" && (surum === 1 || surum === "1")) return asil.call(this, ad);
      return arguments.length > 1 ? asil.call(this, ad, surum) : asil.call(this, ad);
    };
    F.__dhIdbUyum = true;
  } catch (e) {}
})();
