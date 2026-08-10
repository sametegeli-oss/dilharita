/* dh-ses-kilit.js — iOS'ta sesin ilk dokunuşta açılması
   ====================================================================
   SORUN
   iOS Safari, speechSynthesis ve AudioContext'i kullanıcı bir şeye
   DOKUNANA kadar kilitli tutar. Uygulama sohbet açılışında karşılama
   cümlesini kendiliğinden seslendiriyor (chat-core.js > speakText),
   ama o an henüz dokunuş olmadığı için iPhone'da cümle SESSİZ geçiyor —
   üstelik hata da vermiyor, kullanıcı avatarın ağzının oynadığını görüp
   sesi kapalı sanıyor.

   ÇÖZÜM
   1) İlk dokunuşta sessiz bir seslendirme yapıp motoru aç, AudioContext'i
      resume et.
   2) Kilitliyken yapılan İLK seslendirmeyi sakla; kilit açılınca onu bir
      kez tekrar oynat. Böylece açılış cümlesi kaybolmaz.
   3) Yalnızca iOS/iPadOS'ta devreye girer — diğer platformlarda hiçbir
      şeye dokunmaz, çift konuşma olmaz.

   iPadOS 13+ kendini "Mac" diye tanıttığı için dokunma noktası sayısı da
   kontrol edilir.
   ==================================================================== */
(function (global) {
  "use strict";
  if (global.__dhSesKilit) return;
  global.__dhSesKilit = true;

  function iOSmu() {
    try {
      var ua = navigator.userAgent || "";
      if (/iPad|iPhone|iPod/.test(ua)) return true;
      /* iPadOS 13+ : "Macintosh" der ama dokunmatiktir */
      if (/Mac/.test(navigator.platform || ua) && (navigator.maxTouchPoints || 0) > 1) return true;
    } catch (e) {}
    return false;
  }

  if (!iOSmu() || !global.speechSynthesis || !global.SpeechSynthesisUtterance) {
    global.DHSesKilit = { gerekli: false, acik: true, ac: function () {} };
    return;
  }

  var acik = false;
  var bekleyen = null;          /* kilitliyken kaçırılan İLK seslendirme */
  var asilSpeak = global.speechSynthesis.speak.bind(global.speechSynthesis);

  global.speechSynthesis.speak = function (u) {
    if (!acik && u && u.text) {
      /* Kilitliyken çağrıldı: motor sesi çıkarmayacak. İlkini sakla. */
      if (!bekleyen) bekleyen = u;
      /* Yine de çağır — bazı sürümlerde kuyruğa girer ve kilit açılınca
         kendiliğinden çalar; çift çalmayı aşağıdaki bayrak engeller. */
    }
    return asilSpeak(u);
  };

  function kilidiAc() {
    if (acik) return;
    acik = true;
    try {
      var sessiz = new global.SpeechSynthesisUtterance(" ");
      sessiz.volume = 0; sessiz.rate = 1;
      asilSpeak(sessiz);
    } catch (e) {}
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (AC) {
        var ctx = new AC();
        if (ctx.state === "suspended" && ctx.resume) ctx.resume();
        /* kısa sessiz tampon — bazı sürümler bunu şart koşuyor */
        try {
          var b = ctx.createBuffer(1, 1, 22050);
          var s = ctx.createBufferSource();
          s.buffer = b; s.connect(ctx.destination); s.start(0);
        } catch (e2) {}
      }
    } catch (e) {}

    /* kaçırılan açılış cümlesini bir kez oynat */
    if (bekleyen) {
      var metin = bekleyen.text;
      bekleyen = null;
      setTimeout(function () {
        try {
          /* kuyrukta kalmış olabilir; temizleyip tek seferde söyle */
          global.speechSynthesis.cancel();
          var u2 = new global.SpeechSynthesisUtterance(metin);
          u2.lang = "en-US";
          asilSpeak(u2);
        } catch (e) {}
      }, 260);
    }
    try { console.log("[dh-ses-kilit] iOS ses kilidi açıldı."); } catch (e) {}
    kaldir();
  }

  var OLAYLAR = ["touchend", "pointerup", "click", "keydown"];
  function kaldir() {
    OLAYLAR.forEach(function (o) {
      try { document.removeEventListener(o, kilidiAc, true); } catch (e) {}
    });
  }
  OLAYLAR.forEach(function (o) {
    try { document.addEventListener(o, kilidiAc, true); } catch (e) {}
  });

  global.DHSesKilit = {
    gerekli: true,
    get acik() { return acik; },
    ac: kilidiAc,
    bekleyenVar: function () { return !!bekleyen; }
  };
})(window);
