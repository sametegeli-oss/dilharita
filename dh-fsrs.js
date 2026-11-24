/* dh-fsrs.js — Dil Harita'nın tek aralıklı tekrar hesabı (FSRS-5)
   ----------------------------------------------------------------
   Eskiden SM-2'nin sekiz ayrı kopyası vardı (tekrar, practice, cümle çalış,
   video, sesli çalış, kelime, hata defteri...). Hepsi artık bunu çağırır;
   bu dosya yüklenmemişse kendi eski SM-2 hesaplarına düşerler.

   Kayıt biçimi DEĞİŞMEZ: rep, ef, interval, due, last, lapses alanları
   eskisi gibi yazılır (okuyan her ekran çalışmaya devam eder). FSRS'in
   kendi durumu kaydın içinde: f = { s: kararlılık (gün), d: zorluk 1–10 }.

   Geçiş TEMBEL: eski kartlar toplu dönüştürülmez, vadeleri değişmez.
   Bir kart ilk kez FSRS ile notlanınca eski bilgisinden başlatılır:
     kararlılık ← eski aralık (gün), zorluk ← eski kolaylık katsayısı (ef).
   Notlar: "hard" (bilemedim) → Tekrar(1), zor ama bildim → Zor(2),
           "good" → İyi(3), "easy" → Kolay(4).
   Hedef hatırlama oranı %90 (localStorage "dh-fsrs-hedef" ile 0.80–0.95). */
(function (global) {
  "use strict";
  var GUN = 86400000;
  /* FSRS-5 varsayılan ağırlıkları (open-spaced-repetition, 19 parametre) */
  var W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
           1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
  var DECAY = -0.5, FACTOR = 19 / 81, S_MIN = 0.1, S_MAX = 36500, ARALIK_MAX = 3650;

  function sinirla(x, a, b) { return Math.min(b, Math.max(a, x)); }
  function hedef() {
    var h = 0.9;
    try { var v = parseFloat(localStorage.getItem("dh-fsrs-hedef")); if (v >= 0.8 && v <= 0.95) h = v; } catch (e) {}
    return h;
  }
  function hatirlama(t, s) { return Math.pow(1 + FACTOR * t / s, DECAY); }
  function aralikGun(s, r) { return s / FACTOR * (Math.pow(r, 1 / DECAY) - 1); }
  function d0(g) { return sinirla(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10); }
  function yeniD(d, g) {
    var delta = -W[6] * (g - 3);
    var d2 = d + delta * (10 - d) / 9;                 /* doğrusal sönümleme */
    return sinirla(W[7] * d0(4) + (1 - W[7]) * d2, 1, 10); /* ortalamaya dönüş */
  }
  function hatirlamaS(d, s, r, g) {
    var zor = g === 2 ? W[15] : 1, kolay = g === 4 ? W[16] : 1;
    return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * zor * kolay);
  }
  function unutmaS(d, s, r) {
    var y = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
    return Math.min(y, s);
  }
  function kisaS(s, g) { return s * Math.exp(W[17] * (g - 3 + W[18])); }

  /* eski ef ↔ FSRS zorluğu (ef 2.5 ≈ yeni kartın "İyi" zorluğu 5.3) */
  function efdenD(ef) { return sinirla(5.3 - ((+ef || 2.5) - 2.5) * 3.5, 1, 10); }
  function ddenEf(d) { return Math.round(sinirla(2.5 - (d - 5.3) / 3.5, 1.3, 3.0) * 100) / 100; }

  function notSayisi(g) {
    if (typeof g === "number") return sinirla(Math.round(g), 1, 4);
    if (g === "hard" || g === "again" || g === false) return 1;
    if (g === "zor" || g === "hard-ok") return 2;
    if (g === "easy") return 4;
    return 3;
  }

  /* Bir kartı notla.
     onceki: eski kayıt (ya da boş); not: "hard"/"good"/"easy" ya da 1–4.
     sec: { simdi, alan: {aralik,vade,son,hata} (farklı alan adları için),
            hataAralik: bilemeyince kaç gün sonra (vars. 0 = hemen),
            ilkIyi: yeni kartta "İyi" sonrası ilk aralık (vars. 1 gün),
            ilkKolay: yeni kartta "Kolay" sonrası ilk aralık (vars. 4 gün) } */
  function notla(onceki, not, sec) {
    sec = sec || {};
    var A = Object.assign({ aralik: "interval", vade: "due", son: "last", hata: "lapses" }, sec.alan || {});
    var n = Object.assign({ rep: 0, ef: 2.5 }, onceki && typeof onceki === "object" ? onceki : {});
    n[A.aralik] = +n[A.aralik] || 0; n[A.vade] = +n[A.vade] || 0; n[A.son] = +n[A.son] || 0;
    var simdi = sec.simdi || Date.now(), g = notSayisi(not), r = hedef();
    var f = n.f && n.f.s > 0 ? { s: +n.f.s, d: +n.f.d || 5 } : null;
    var gecmis = n[A.son] > 0 && ((n.rep || 0) > 0 || (n[A.hata] || 0) > 0 || n[A.aralik] > 0);
    var gecis = !f && gecmis;
    if (gecis) f = { s: sinirla(n[A.aralik] || 0.6, 0.6, S_MAX), d: efdenD(n.ef) }; /* tembel geçiş */

    var s, d, ilk = !f, gun;
    if (ilk) {
      s = W[g - 1]; d = d0(g);
    } else {
      var t = Math.max(0, (simdi - n[A.son]) / GUN);
      var R = hatirlama(t, f.s);
      d = yeniD(f.d, g);
      if (t < 1) s = kisaS(f.s, g);                 /* aynı gün içinde tekrar */
      else if (g === 1) s = unutmaS(f.d, f.s, R);
      else s = hatirlamaS(f.d, f.s, R, g);
    }
    s = sinirla(s, S_MIN, S_MAX);

    if (g === 1) {
      gun = +sec.hataAralik || 0;
      n.rep = 0; n[A.hata] = (n[A.hata] || 0) + 1;
    } else {
      gun = Math.round(aralikGun(s, r));
      if (ilk && g === 3) gun = Math.min(gun, sec.ilkIyi != null ? sec.ilkIyi : 1);
      if (ilk && g === 4) gun = Math.min(gun, sec.ilkKolay != null ? sec.ilkKolay : 4);
      if (ilk && g === 2) gun = Math.min(gun, 1);
      /* Geçişte temkin: eski kartın ilk FSRS aralığı, SM-2'nin vereceğinin 2 katını geçmez.
         (Kullanıcının kartlarında çok gecikmiş olanlar FSRS'te bir anda aylar sonraya atlıyordu.) */
      if (gecis) { var rp = (n.rep || 0) + 1, eskiAr = rp === 1 ? 1 : rp === 2 ? 4 : Math.round((n[A.aralik] || 4) * Math.max(1.3, +n.ef || 2.5) * (g === 4 ? 1.3 : 1));
        gun = Math.min(gun, Math.max(2, eskiAr * 2)); }
      gun = sinirla(gun, 1, ARALIK_MAX);
      n.rep = (n.rep || 0) + 1;
    }
    n.f = { s: Math.round(s * 1000) / 1000, d: Math.round(d * 1000) / 1000 };
    n.ef = ddenEf(d);
    n.alg = "fsrs5";
    n[A.aralik] = gun; n[A.son] = simdi; n[A.vade] = simdi + gun * GUN;
    return n;
  }

  /* Bugün hatırlama olasılığı (0–1); panel ve koç için */
  function olasilik(kart, simdi, alan) {
    if (!kart) return 0;
    alan = Object.assign({ aralik: "interval", son: "last" }, alan || {});
    var s = kart.f && kart.f.s > 0 ? kart.f.s : (+kart[alan.aralik] || 0);
    var son = +kart[alan.son] || 0;
    if (!s || !son) return 0;
    return hatirlama(Math.max(0, ((simdi || Date.now()) - son) / GUN), s);
  }

  global.DHFSRS = {
    SURUM: "fsrs5-1", W: W.slice(), notla: notla, grade: notla, olasilik: olasilik,
    hatirlama: hatirlama, aralikGun: aralikGun, hedef: hedef, efdenD: efdenD, ddenEf: ddenEf
  };
})(typeof window !== "undefined" ? window : globalThis);
