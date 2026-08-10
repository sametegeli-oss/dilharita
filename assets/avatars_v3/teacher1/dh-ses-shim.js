/* dh-ses-shim.js — iPhone'da ses tanımayı ÇALIŞIR hale getirir
   ====================================================================
   SORUN
   webkitSpeechRecognition iOS Safari'de YOK. iOS'ta bütün tarayıcılar
   (Chrome, Firefox dahil) Safari motorunu kullanmak zorunda olduğu için
   iPhone'da hiçbir tarayıcıda çalışmıyor. Uygulamadaki 16 sayfa bu API'ye
   dayanıyor ve hepsi şu kalıpla başlıyor:

       var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
       if(!SR){ "Bu cihaz/tarayıcı ses tanımayı desteklemiyor"; return; }

   iPhone kullanıcısı bu mesajı görüp orada kalıyordu: telaffuz alıştırması,
   mikrofonla cevap, sohbetteki 🎙 düğmesi — hepsi ölü.

   speech-fallback.js bunun için yazılmış (gölgeleme: dinle → kendini
   kaydet → karşılaştır → kendini değerlendir) ama sayfaların kendi
   "desteklemiyor" dalında ÇAĞIRILMASI gerekiyor ve yalnızca 2 sayfada
   çağrılıyordu.

   ÇÖZÜM
   Bu dosya, yerel API yoksa onun yerine geçen bir nesne kurar. Sayfalar
   değişmez: `if(!SR)` denetimi artık geçer, `.start()` çağrısı gölgeleme
   panelini açar, kullanıcının kendi değerlendirmesi standart `onresult`
   olayıyla geri döner. 14 sayfaya tek satır script etiketi yeter.

   HEDEF CÜMLE NEREDEN BULUNUR
   Sayfalar hedefi bize vermiyor; sıralı olarak denenir:
     1. rec.__dhHedef            (açıkça atanmışsa)
     2. window.DHSesHedef        (metin veya fonksiyon)
     3. speechSynthesis'e EN SON söyletilen İngilizce metin
        — bu akışların neredeyse hepsi hedefi önce sesli okutuyor,
          o yüzden en güvenilir kaynak bu
     4. bilinen DOM seçicileri
   Bulunan hedef panelde AÇIKÇA gösterilir; kullanıcı neyle
   karşılaştırıldığını görür. Hiçbiri tutmazsa panel yine açılır ama
   sonuç "değerlendirilemedi" olarak döner — uydurma yapılmaz.

   Gerekli: speech-fallback.js (DHSpeech) — bundan ÖNCE yüklenmeli.
   ==================================================================== */
(function (global) {
  "use strict";
  if (global.__dhSesShim) return;
  global.__dhSesShim = true;

  var YERLI = global.SpeechRecognition || global.webkitSpeechRecognition;
  var GECER_PUAN = 60;          /* "Yaklaştım" ve üstü doğru sayılır */

  /* ---------- son seslendirilen İngilizce metin ---------- */
  var sonSoylenen = "";
  function ingilizceMi(t) {
    t = String(t || "");
    if (t.length < 2) return false;
    if (/[çğıöşüÇĞİÖŞÜ]/.test(t)) return false;      /* Türkçe */
    return /[a-zA-Z]/.test(t);
  }
  try {
    if (global.speechSynthesis && global.SpeechSynthesisUtterance) {
      var asilSpeak = global.speechSynthesis.speak.bind(global.speechSynthesis);
      global.speechSynthesis.speak = function (u) {
        try {
          var t = u && u.text;
          /* [[ ]] içindeki İngilizce parçalar öğretmen konuşmasında geçer */
          var kose = String(t || "").match(/\[\[([^\]]+)\]\]/);
          if (kose && ingilizceMi(kose[1])) sonSoylenen = kose[1].trim();
          else if (ingilizceMi(t)) sonSoylenen = String(t).trim();
        } catch (e) {}
        return asilSpeak(u);
      };
    }
  } catch (e) {}

  var DOM_SECICI = [
    ".dh-wp-word",           /* kelime popup'ı */
    ".card-en",              /* index-app cümle kartı */
    ".drill-en", "#targetEn", "#sentEn", ".sent-en", ".q-en",
    ".phrase-card .en", ".target-sentence", ".dhsp .target"
  ];
  function domdanHedef() {
    for (var i = 0; i < DOM_SECICI.length; i++) {
      try {
        var el = document.querySelector(DOM_SECICI[i]);
        if (el) {
          var t = String(el.textContent || "").trim();
          if (ingilizceMi(t) && t.length < 300) return t;
        }
      } catch (e) {}
    }
    return "";
  }
  function hedefBul(rec) {
    if (rec && rec.__dhHedef) return String(rec.__dhHedef);
    try {
      var g = global.DHSesHedef;
      if (typeof g === "function") g = g();
      if (g) return String(g);
    } catch (e) {}
    if (sonSoylenen) return sonSoylenen;
    return domdanHedef();
  }

  /* ---------- SpeechRecognition taklidi ---------- */
  function Taklit() {
    this.lang = "en-US";
    this.continuous = false;
    this.interimResults = false;
    this.maxAlternatives = 1;
    this.__acik = false;
    this.__dinleyici = {};
  }
  Taklit.prototype.addEventListener = function (tur, fn) {
    (this.__dinleyici[tur] = this.__dinleyici[tur] || []).push(fn);
  };
  Taklit.prototype.removeEventListener = function (tur, fn) {
    var l = this.__dinleyici[tur] || [];
    var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
  };
  Taklit.prototype.__yay = function (tur, olay) {
    olay = olay || {}; olay.type = tur;
    try { if (typeof this["on" + tur] === "function") this["on" + tur].call(this, olay); } catch (e) {}
    (this.__dinleyici[tur] || []).forEach(function (fn) {
      try { fn.call(this, olay); } catch (e) {}
    }, this);
  };
  Taklit.prototype.__sonuc = function (metin) {
    /* Yerel API'nin döndürdüğü yapıyı birebir taklit et:
       e.results[0][0].transcript · e.results[0].length · e.resultIndex */
    var alt = { transcript: String(metin || ""), confidence: 0.9 };
    var kume = [alt];
    kume.isFinal = true;
    kume.item = function (i) { return this[i]; };
    var sonuclar = [kume];
    sonuclar.item = function (i) { return this[i]; };
    this.__yay("result", { results: sonuclar, resultIndex: 0, __dhKendi: true });
  };
  Taklit.prototype.start = function () {
    if (this.__acik) return;
    this.__acik = true;
    var self = this;

    if (!(global.DHSpeech && global.DHSpeech.shadow)) {
      setTimeout(function () {
        self.__acik = false;
        self.__yay("error", { error: "service-not-allowed",
          message: "speech-fallback.js yüklenmedi" });
        self.__yay("end", {});
      }, 0);
      return;
    }

    var hedef = hedefBul(self);
    self.__yay("start", {});
    global.DHSpeech.shadow(hedef, function (r) {
      self.__acik = false;
      if (!r) {                                   /* kullanıcı kapattı */
        self.__yay("error", { error: "aborted" });
        self.__yay("end", {});
        return;
      }
      if (!hedef) {
        /* Hedef çözülemedi — uydurma metin döndürmek yerine dürüstçe
           "değerlendirilemedi" de. Sayfa kendi hata dalını gösterir. */
        self.__yay("error", { error: "no-speech", __dhSebep: "hedef-yok" });
        self.__yay("end", {});
        return;
      }
      self.__sonuc((r.puan || 0) >= GECER_PUAN ? hedef : "");
      self.__yay("end", {});
    });
  };
  Taklit.prototype.stop = function () {
    if (!this.__acik) return;
    this.__acik = false;
    this.__yay("end", {});
  };
  Taklit.prototype.abort = Taklit.prototype.stop;

  if (!YERLI) {
    global.SpeechRecognition = Taklit;
    global.webkitSpeechRecognition = Taklit;
    try {
      console.log("[dh-ses-shim] Yerel ses tanıma yok — gölgeleme moduna geçildi "
        + "(iPhone/iPad). Sayfalar değişmeden çalışır.");
    } catch (e) {}
  }

  global.DHSesShim = {
    kuruldu: !YERLI,
    yerli: !!YERLI,
    hedefBul: hedefBul,
    sonSoylenen: function () { return sonSoylenen; },
    Taklit: Taklit
  };
})(window);
