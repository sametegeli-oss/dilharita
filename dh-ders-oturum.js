/* dh-ders-oturum.js — Dil Harita ders oturumu kaliciligi
   ---------------------------------------------------------------
   COZULEN SORUN
   ders.html'de start() her acilista "idx=0" yapip DHLesson.build()'i
   SIFIRDAN cagiriyordu. 12 adimlik dersin 7'sini yapip sayfayi kapatan
   kullanici basa donuyordu. Ustelik plan yeniden URETILDIGI icin icerik
   de degisiyordu: lesson-engine.js icindeki pickLearned() diziyi
   rastgele karistiriyor, pickNew() ise o an "yeni" olan ogeleri
   yeniden seciyor. Yani ayni gun icinde ayni ders bir daha gelmiyordu.

   Tek kurtarma sessionStorage["dh-ders-return"] idi ve o da yalnizca
   videopractice sapmasindan donus icindi; sekme kapaninca gidiyordu.

   COZUM
   Ders bir kez uretilir ve GUN ICINDE DONAR. Yeniden uretilmez,
   depodan geri yuklenir. Boylece:
     - kaldigin adimdan devam edersin
     - icerik degismez (ayni cumleler, ayni sirada)
     - "planlanan / yapilan / kalan" anlamli hale gelir

   LESSON-ENGINE'E DOKUNULMAZ. Bu modul yalnizca DHLesson.build()'in
   URETTIGI sonucu saklar. Pedagojik karar (evre oranlari, gunluk yeni
   siniri, seviye filtresi, hata defteri onceligi) aynen lesson-engine.js
   ve teacher-policy.js'te kalir.

   DEPO
     dh-ders-oturum-<YYYY-MM-DD> = { olusturuldu, idx, ders }
   "ders" = DHLesson.build() ciktisi, _pool haric (o her acilista
   yeniden yuklenir cunku buyuk ve zaten onbellekli).

   API
     DHDers.yukle()          -> {ders, idx} | null   (bugune ait, bitmemis)
     DHDers.kaydet(ders,idx) -> bool
     DHDers.ilerlet(idx)     -> bool
     DHDers.temizle()        -> void   (yeni ders istenince)
     DHDers.ozet(idx,toplam) -> {yapilan, kalan, yuzde, bittiMi}
     DHDers.evreSayilari(ders) -> {gramer:2, tekrar:3, ...}
*/
(function (global) {
  "use strict";
  if (global.DHDers) return;

  var ONEK = "dh-ders-oturum-";
  var OTURUM_SURUMU = 2;
  var ICERIK_GECMISI = "dh-lesson-item-history-v1";

  /* Bu surumden once hazirlanmis bugunku ders de yeni secimde tekrar
     gelmesin. Eski oturumun ogelerini bir kez secim gecmisine aktaririz. */
  function eskiDersiGecmiseYaz(kayit) {
    try {
      var adimlar = kayit && kayit.ders && kayit.ders.steps;
      if (!adimlar || !adimlar.length) return;
      var gecmis = JSON.parse(localStorage.getItem(ICERIK_GECMISI) || "{}") || {};
      var simdi = Date.now();
      adimlar.forEach(function (adim) {
        if (adim && adim.itemId) gecmis[adim.itemId] = simdi;
      });
      localStorage.setItem(ICERIK_GECMISI, JSON.stringify(gecmis));
    } catch (e) {}
  }

  /* Yerel gune gore ISO. toISOString UTC'ye kayar ve gece yarisi
     civarinda gunu bir gun geri alabilir. */
  function iso(d) {
    var t = d || new Date();
    return t.getFullYear() + "-" +
      String(t.getMonth() + 1).padStart(2, "0") + "-" +
      String(t.getDate()).padStart(2, "0");
  }

  function anahtar() { return ONEK + iso(); }

  /* _pool derse degil onbellege ait: buyuk (binlerce cumle) ve
     DHLesson._loadData zaten kendi icinde onbellekliyor. */
  function temizKopya(ders) {
    var o = {};
    for (var k in ders) {
      if (k === "_pool") continue;
      o[k] = ders[k];
    }
    return o;
  }

  function kaydet(ders, idx) {
    if (!ders || !ders.steps || !ders.steps.length) return false;
    try {
      localStorage.setItem(anahtar(), JSON.stringify({
        olusturuldu: Date.now(),
        surum: OTURUM_SURUMU,
        gun: iso(),
        idx: Math.max(0, idx | 0),
        ders: temizKopya(ders)
      }));
      eskileriSil();
      return true;
    } catch (e) {
      /* Kota dolduysa oturumu saklamaktansa dersi calistirmak yeglenir;
         eski davranisa (her acilista yeniden uretim) duser. */
      return false;
    }
  }

  function yukle() {
    var kayit = null;
    try {
      var ham = localStorage.getItem(anahtar());
      kayit = ham ? JSON.parse(ham) : null;
    } catch (e) { return null; }

    if (kayit && kayit.surum !== OTURUM_SURUMU) {
      eskiDersiGecmiseYaz(kayit);
      return null;
    }
    if (!kayit || !kayit.ders || !kayit.ders.steps || !kayit.ders.steps.length) {
      return null;
    }
    var toplam = kayit.ders.steps.length;
    var idx = Math.max(0, Math.min(toplam, kayit.idx | 0));

    /* Ders bitmisse geri yukleme — kullanici "yeni ders" isteyebilmeli. */
    if (idx >= toplam) return null;

    return { ders: kayit.ders, idx: idx };
  }

  function ilerlet(idx) {
    try {
      var ham = localStorage.getItem(anahtar());
      if (!ham) return false;
      var kayit = JSON.parse(ham);
      kayit.idx = Math.max(0, idx | 0);
      localStorage.setItem(anahtar(), JSON.stringify(kayit));
      return true;
    } catch (e) { return false; }
  }

  function temizle() {
    try { localStorage.removeItem(anahtar()); } catch (e) {}
  }

  function eskileriSil() {
    try {
      var bugun = anahtar();
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf(ONEK) === 0 && k !== bugun) localStorage.removeItem(k);
      }
    } catch (e) {}
  }

  function ozet(idx, toplam) {
    var t = Math.max(0, toplam | 0);
    var y = Math.max(0, Math.min(t, idx | 0));
    return {
      yapilan: y,
      kalan: Math.max(0, t - y),
      yuzde: t ? Math.round((100 * y) / t) : 0,
      bittiMi: t > 0 && y >= t
    };
  }

  /* lesson-engine.js buildIntro() icinde bu sayilari zaten hesapliyor
     (intro.breakdown) ama ders.html onlari yalnizca "bu evre var mi"
     filtresi olarak kullaniyordu; sayilar hic ekrana basilmiyordu.
     Burada hem intro'dakini kullaniriz hem de yoksa yeniden sayariz. */
  function evreSayilari(ders) {
    if (ders && ders.intro && ders.intro.breakdown) {
      var b = ders.intro.breakdown, dolu = false;
      for (var k in b) { if (b[k]) { dolu = true; break; } }
      if (dolu) return b;
    }
    var say = {};
    ((ders && ders.steps) || []).forEach(function (s) {
      say[s.phase] = (say[s.phase] || 0) + 1;
    });
    return say;
  }

  global.DHDers = {
    yukle: yukle,
    kaydet: kaydet,
    ilerlet: ilerlet,
    temizle: temizle,
    ozet: ozet,
    evreSayilari: evreSayilari,
    _iso: iso
  };
})(typeof window !== "undefined" ? window : globalThis);
