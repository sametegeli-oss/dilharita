/* dh-avatar-dil.js — Dil Harita
   ÖĞRETMEN İNGİLİZCE CÜMLEYİ OKURKEN teacher2 AVATARI GÖRÜNÜR.

   Neden ayrı dosya:
   chat-core.js ağız karelerini konuşma BAŞLARKEN tek seferde bir zaman
   çizelgesine döküyor (PhotoAvatar.speakText → DHViseme.timeline). Kare
   kümesini konuşmanın ortasında değiştirmek o çizelgeyi geçersiz kılar ve
   uzun uğraşla oturtulmuş ağız senkronunu bozar. Ayrıca kareyi yalnızca
   chat-core yazmıyor: tts-avatar-long-sync-fix.js ve avatar-blink-sync.js
   de doğrudan img.src atıyor (ölçüldü).

   Bu yüzden zincire hiç dokunulmuyor. Burada yapılan tek şey: #avatarImg'in
   src'si HANGİ koddan yazılırsa yazılsın, konuşulan parça İngilizceyse
   klasör adı teacher2 ile değiştiriliyor. Zamanlama, ağız dizisi, göz kırpma
   aynen kalıyor — yalnızca karenin çekildiği klasör değişiyor.

   chat-core.js her parçadan önce "dh-konusma-dili" olayını yolluyor,
   konuşma bitince "dh-konusma-bitti".
*/
(function (global) {
  "use strict";
  if (global.DHAvatarDil) return;

  var KOK = "assets/avatars_v3/";
  var INGILIZCE_AVATAR = "teacher2";

  function ogretmenSayfasi() {
    try {
      var s = global.CHAT_SCENARIO || {};
      return /teacher|öğretmen|ogretmen/i.test((s.title || "") + " " + (s.role || ""));
    } catch (e) { return false; }
  }
  function secili() {
    try { return localStorage.getItem("selectedTeacherAvatar") || "teacher1"; }
    catch (e) { return "teacher1"; }
  }

  /* o an gösterilmesi gereken klasör adı; "" = karışma */
  var _aktif = "";

  /* "assets/avatars_v3/teacher1/mouth-a.webp" → hedef klasöre çevirir.
     Yalnızca teacher* klasörleri dokunulur; senaryo avatarları (restaurant,
     hotel...) hiç etkilenmez. */
  function yolCevir(url, hedef) {
    var u = String(url || "");
    if (!hedef || !u) return u;
    return u.replace(/(assets\/avatars_v3\/)teacher\d+(\/)/i, "$1" + hedef + "$2");
  }

  var _img = null, _gozlemci = null, _kendi = false;

  function uygula() {
    /* #avatarImg chat-core.buildUI() içinde sonradan yaratılıyor; ilk
       aramada bulunamamış olabilir. Her seferinde tazele. */
    if (!_img) _img = document.getElementById("avatarImg");
    if (!_img || !_aktif) return;
    gozle();
    var yeni = yolCevir(_img.getAttribute("src") || "", _aktif);
    if (yeni && yeni !== _img.getAttribute("src")) {
      _kendi = true;                 // kendi yazdığımız değişikliği tekrar işleme
      _img.setAttribute("src", yeni);
      _kendi = false;
    }
  }

  function gozle() {
    if (_gozlemci || !_img || !global.MutationObserver) return;
    _gozlemci = new MutationObserver(function () {
      if (_kendi) return;
      uygula();
    });
    _gozlemci.observe(_img, { attributes: true, attributeFilter: ["src"] });
  }

  /* teacher2 kareleri önceden indirilir, geçişte boş kare görünmesin */
  var _onIndirildi = false;
  function onIndir() {
    if (_onIndirildi) return;
    _onIndirildi = true;
    try {
      var fr = (global.CHAT_SCENARIO && global.CHAT_SCENARIO.frames) || {};
      Object.keys(fr).forEach(function (k) {
        var im = new Image();
        im.src = KOK + INGILIZCE_AVATAR + "/" + fr[k];
      });
    } catch (e) {}
  }

  function dil(lang) {
    if (!ogretmenSayfasi()) return;
    var hedef = /^en/i.test(String(lang || "")) ? INGILIZCE_AVATAR : secili();
    if (hedef === _aktif) return;
    _aktif = hedef;
    uygula();
  }
  function birak() {
    if (!ogretmenSayfasi()) return;
    _aktif = secili();
    uygula();
  }

  function baslat() {
    _img = document.getElementById("avatarImg");
    if (!_img) return;
    if (!ogretmenSayfasi()) return;
    /* DOMContentLoaded gecikmeli gelirse baslat() konuşma başladıktan SONRA
       çalışabiliyor; o an seçili avatara geri dönmek İngilizce parçanın
       ortasında teacher2'yi kapatıyordu. Zaten belirlenmişse dokunma. */
    if (!_aktif) _aktif = secili();
    onIndir();
    gozle();
    uygula();
  }

  global.addEventListener("dh-konusma-dili", function (e) {
    dil(e && e.detail && e.detail.lang);
  });
  global.addEventListener("dh-konusma-bitti", birak);

  /* chat-core #avatarImg'i buildUI() içinde sonradan yaratıyor; ilk denemede
     bulunamazsa kısa aralıklarla tekrar bakılır. */
  function bekle(kalan) {
    baslat();
    if (!_img && kalan > 0) setTimeout(function () { bekle(kalan - 1); }, 200);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { bekle(15); }, { once: true });
  } else { bekle(15); }

  global.DHAvatarDil = {
    dil: dil, birak: birak, baslat: baslat,
    _yolCevir: yolCevir, _aktif: function () { return _aktif; },
    _ogretmenSayfasi: ogretmenSayfasi
  };
})(window);
