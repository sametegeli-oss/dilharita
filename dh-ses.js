/* dh-ses.js — Tarayıcı sesi sağlığı (DHSes) ve bütün sitede bozuk ses koruması
   ====================================================================
   SORUN
   Bazı bilgisayarlarda Chrome'da Windows'un yerel sesleri (Microsoft
   David, Zira, Tolga…) bozuk: cümle hiç başlamadan "bitti" der, ses
   çıkmaz. Ses seçmeyen kodlar (kelime penceresi vb.) Chrome'un varsayılanı
   olan bu bozuk sese düşüyor ve hiç ses gelmiyordu.

   ÇÖZÜM
   1) Bozuk görülen ses 3 gün "bozuk" işaretlenir (dh-ses-saglik-v1).
   2) speechSynthesis.speak sarılır: ses seçilmemişse ya da seçilen ses
      bozuksa o dilde çalışan bir ses atanır (İngilizcede Google sesleri,
      Deniz için erkek sesler önce). Başlamadan biten ses işaretlenir.
   3) Kendi yeniden denemesini yapan kodlar (avatar motoru, Konuşkan)
      cümleye __dhSesYonetimli = true koyar; onlara dokunulmaz.
   Sayfanın <head> bölümünde, seslendirme yapan betiklerden ÖNCE yüklenir.
   ==================================================================== */
(function (global) {
  "use strict";
  if (global.DHSes && global.DHSes.__dosya) return;
  var SES_SAGLIK = "dh-ses-saglik-v1", SES_BOZUK_MS = 3 * 864e5;
  function ss() { return global.speechSynthesis; }
  function sesSaglikOku() { try { return JSON.parse(localStorage.getItem(SES_SAGLIK) || "{}") || {}; } catch (e) { return {}; } }
  function sesBozukMu(ad) { var k = sesSaglikOku()[ad]; return !!(k && k.bozuk && Date.now() - (k.at || 0) < SES_BOZUK_MS); }
  function sesIsaretle(ad, bozuk) { if (!ad) return; var k = sesSaglikOku(); if (bozuk) k[ad] = { bozuk: true, at: Date.now() }; else if (k[ad]) delete k[ad]; else return; try { localStorage.setItem(SES_SAGLIK, JSON.stringify(k)); } catch (e) {} }
  function sesAday(dil, tercihAd) {
    var vs = []; try { vs = ss().getVoices() || []; } catch (e) {}
    var re = dil === "tr" ? /^tr/i : /^en/i, uygun = vs.filter(function (v) { return re.test(v.lang) && !sesBozukMu(v.name); });
    var sira = [];
    function ekle(v) { if (v && sira.indexOf(v) < 0) sira.push(v); }
    if (tercihAd) ekle(uygun.find(function (v) { return v.name === tercihAd; }));
    if (dil !== "tr") { try { var g = JSON.parse(localStorage.getItem("dh-voice:__global__") || "null"); if (g && g.name) ekle(uygun.find(function (v) { return v.name === g.name; })); } catch (e) {} }
    var ana = dil === "tr" ? /tr-TR/i : /en-US/i;
    var erkek = /\bmale\b|david|mark|george|guy|ryan|james|daniel|tolga|ahmet|piper/i, kadin = /female|zira|hazel|susan|samantha|karen|libby|aria|jenny|emel|filiz/i;
    /* Microsoft (Windows) sesleri en sona: bazı Chrome kurulumlarında bozuklar; çalışıyorsa yine de seçilebilir */
    var ms = /Microsoft/i, erk = function (v) { return erkek.test(v.name) && !kadin.test(v.name); };
    uygun.filter(function (v) { return /Google/i.test(v.name) && erk(v); }).forEach(ekle);
    uygun.filter(function (v) { return !ms.test(v.name) && erk(v); }).forEach(ekle);
    uygun.filter(function (v) { return /Google/i.test(v.name) && ana.test(v.lang); }).forEach(ekle);
    uygun.filter(function (v) { return /Google/i.test(v.name); }).forEach(ekle);
    uygun.filter(function (v) { return !ms.test(v.name) && ana.test(v.lang); }).forEach(ekle);
    uygun.filter(function (v) { return !ms.test(v.name); }).forEach(ekle);
    uygun.filter(erk).forEach(ekle);
    uygun.filter(function (v) { return ana.test(v.lang); }).forEach(ekle);
    uygun.forEach(ekle);
    return sira;
  }
  /* bir cümlenin sonucu: başladıysa ses sağlam; başlamadan hemen bittiyse ya da sentez hatasıysa bozuk */
  function sesSonuc(ad, basladi, gecenMs, hata) {
    if (!ad) return false;
    if (basladi) { sesIsaretle(ad, false); return false; }
    if ((hata && /synthesis|voice|audio-hardware|language-unavailable/.test(hata)) || (!hata && gecenMs < 400)) { sesIsaretle(ad, true); try { console.warn("[DHSes] bozuk ses atlandı:", ad); } catch (e) {} return true; }
    return false;
  }
  /* ses düzeyi dengesi: internetten gelen Google sesleri yerel/eklenti seslerinden belirgin kısık çıkar */
  function sesHacim(v) { return v && (/Google/i.test(v.name) || v.localService === false) ? 1 : 0.72; }

  global.DHSes = { __dosya: true, hacim: sesHacim, aday: sesAday, sec: function (dil, ad) { return sesAday(dil, ad)[0] || null; }, bozukMu: sesBozukMu, isaretle: sesIsaretle, sonuc: sesSonuc,
    sifirla: function () { try { localStorage.removeItem(SES_SAGLIK); } catch (e) {} } };

  /* ── bütün sitede: speechSynthesis.speak koruması ── */
  try {
    var S = ss(); if (!S || !global.SpeechSynthesisUtterance || S.__dhSesSarildi) return;
    var asil = S.speak.bind(S);
    S.speak = function (u) {
      try {
        if (u && !u.__dhSesYonetimli) {
          var lang = String(u.lang || (u.voice && u.voice.lang) || "en-US"), dil = /^tr/i.test(lang) ? "tr" : /^en/i.test(lang) ? "en" : null;
          if (dil && (!u.voice || sesBozukMu(u.voice.name))) {
            var v = sesAday(dil, u.voice && u.voice.name)[0];
            if (v) { u.voice = v; u.lang = v.lang; if (u.volume === 1) u.volume = sesHacim(v); }
          }
          if (dil && u.voice) {
            var ad = u.voice.name, t0 = performance.now(), basladi = false;
            u.addEventListener("start", function () { basladi = true; sesSonuc(ad, true); });
            u.addEventListener("end", function () { if (!basladi) sesSonuc(ad, false, performance.now() - t0); });
            u.addEventListener("error", function (e) { if (!basladi && e && e.error && !/interrupted|canceled/.test(e.error)) sesSonuc(ad, false, performance.now() - t0, e.error); });
          }
        }
      } catch (e) {}
      return asil(u);
    };
    S.__dhSesSarildi = true;
  } catch (e) {}
})(window);
