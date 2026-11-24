/* dh-olay.js — TEK AKTİVİTE KAYDI (koç planı, 1. aşama · 24 Kasım 2026)
   ====================================================================
   Deniz'in (merkez koç) programın tamamını görebilmesi için her ekran
   aynı kayda yazar. auth-guard.js bu dosyayı her korumalı sayfaya ekler.

   NE KAYDEDER
   1) Etkin çalışma süresi: sayfa görünürken ve son 90 sn içinde dokunma/
      yazma/kaydırma ya da ses/video çalıyorsa, sayfanın becerisine 5 sn eklenir.
   2) Cevaplar: dhCoachEvaluate (tekrar, pratik, kelime, öğretmen, video,
      hata defteri…) ve Konuşkan düzeltmeleri → doğru/yanlış, beceri, konu.

   NEREYE
   - Ham olaylar: IndexedDB "dh-olay" (yalnız bu cihaz, 30 gün).
   - Günlük özet: localStorage "dh-gun-ozet-v1" (buluta senkron, süresiz).
       { v:1, gun: { "YYYY-MM-DD": { by: { <cihaz>: {
           s:{beceri:sn}, d:{beceri:adet}, y:{beceri:adet},
           k:{konu:[doğru,yanlış]}, e:{ekran:sn} } } } } }
     Cihaz kovası: aynı gün iki cihazda çalışınca toplam doğru çıksın;
     birleştirmede aynı cihazın kopyalarından büyük olan alınır (cloud-sync).
     90 günden eski günler tek kovaya ("_") sıkıştırılır, ekran ayrıntısı atılır.

   SAKLAMA BAKIMI (günde bir kez)
   - Ham olaylar 30 günden eskiyse silinir.
   - dh-study-tracker-v1: 30 günden eski günlerin olay listesi silinir
     (sayılar kalır) — buluttaki ilerleme belgesi 1 MB sınırına dayanmasın.

   API (window.DHOlay)
     cevap({ok, beceri?, konular?, ekran?, kaynak?})
     kaydet(tur, veri)                 ham olay
     gunler(n)                         son n günün cihazlar toplanmış özeti
     beceri(sayfa?)                    sayfanın becerisi
     BECERILER                         ["kelime","dilbilgisi","dinleme","konusma","okuma","yazma"]
   ==================================================================== */
(function (global) {
  "use strict";
  if (global.DHOlay) return;

  var OZET = "dh-gun-ozet-v1";
  var BAKIM = "dh-olay-bakim";
  var HAM_GUN = 30, SIKISTIR_GUN = 90, TRACKER_GUN = 30;
  var BECERILER = ["kelime", "dilbilgisi", "dinleme", "konusma", "okuma", "yazma"];

  /* Sayfa → beceri. Listede olmayan sayfa (menü, ilerleme, ayarlar…) süre saymaz. */
  var SAYFA = {
    "kelime-ogren.html": "kelime", "phrasal-verbs.html": "kelime", "pv-practice.html": "kelime",
    "akilli-tekrar.html": "yazma", "tekrar.html": "yazma", "practice.html": "yazma", "index-app.html": "yazma",
    "ogren.html": "yazma", "hata-defteri.html": "yazma", "ocr-sentence.html": "yazma", "foto-ekle.html": "yazma",
    "videopractice.html": "dinleme", "youtube-egitim.html": "dinleme", "youtube-pratik.html": "dinleme",
    "immersive.html": "dinleme", "sesdalga.html": "konusma", "sesli-calis.html": "konusma",
    "konuskan.html": "konusma", "chat.html": "konusma", "chatmodul.html": "konusma", "chatairport.html": "konusma",
    "chatdoctor.html": "konusma", "chathotel.html": "konusma", "chatrestaurant.html": "konusma",
    "chatteacher1.html": "konusma", "teacher.html": "konusma", "teacher1.html": "konusma", "teacher-chat.html": "konusma",
    "ozel-ders.html": "konusma", "library.html": "okuma",
    "ders.html": "dilbilgisi", "nasil-derim.html": "dilbilgisi", "modul-testi.html": "dilbilgisi",
    "seviye-testi.html": "dilbilgisi", "kilavuz.html": "dilbilgisi"
  };

  function sayfaAdi() {
    var p = (location.pathname.split("/").pop() || "index.html");
    try { p = decodeURIComponent(p); } catch (e) {}
    return p.toLowerCase();
  }
  var SAYFAM = sayfaAdi();
  function beceri(s) { return SAYFA[s || SAYFAM] || null; }

  function gunAnahtari(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function cihaz() {
    /* coach-bubble.js ile aynı kimlik (senkron listesinde YOK → her cihazda farklı) */
    var k = "dh-device-id";
    try {
      var v = localStorage.getItem(k);
      if (!v) { v = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return "d0"; }
  }
  function oku() {
    try { var o = JSON.parse(localStorage.getItem(OZET) || "null"); if (o && o.gun) return o; } catch (e) {}
    return { v: 1, gun: {} };
  }
  function yaz(o) { try { localStorage.setItem(OZET, JSON.stringify(o)); return true; } catch (e) { return false; } }

  /* Bekleyen artışlar belleğe toplanır, en geç 30 sn'de bir (ve sayfadan çıkarken) yazılır. */
  var bekleyen = null;
  function kova() {
    if (!bekleyen) bekleyen = { gun: gunAnahtari(), s: {}, d: {}, y: {}, k: {}, e: {} };
    return bekleyen;
  }
  function ekle(nesne, anahtar, n) { nesne[anahtar] = (nesne[anahtar] || 0) + n; }
  function bosalt() {
    if (!bekleyen) return;
    var b = bekleyen; bekleyen = null;
    var o = oku(), g = o.gun[b.gun] || (o.gun[b.gun] = { by: {} });
    if (!g.by) g.by = {};
    var dv = cihaz(), c = g.by[dv] || (g.by[dv] = {});
    ["s", "d", "y", "e"].forEach(function (alan) {
      var kaynak = b[alan], hedef = c[alan] || (c[alan] = {});
      for (var a in kaynak) if (kaynak.hasOwnProperty(a)) hedef[a] = Math.round((hedef[a] || 0) + kaynak[a]);
      if (!Object.keys(hedef).length) delete c[alan];
    });
    var kk = c.k || (c.k = {});
    for (var konu in b.k) if (b.k.hasOwnProperty(konu)) {
      var eski = kk[konu] || [0, 0];
      kk[konu] = [eski[0] + b.k[konu][0], eski[1] + b.k[konu][1]];
    }
    if (!Object.keys(kk).length) delete c.k;
    yaz(o);
  }

  /* ---------- ham olaylar: IndexedDB (yalnız bu cihaz) ---------- */
  var dbSoz = null;
  function db() {
    if (dbSoz) return dbSoz;
    dbSoz = new Promise(function (res, rej) {
      try {
        var r = indexedDB.open("dh-olay", 1);
        r.onupgradeneeded = function () {
          var d = r.result;
          if (!d.objectStoreNames.contains("olaylar")) d.createObjectStore("olaylar", { autoIncrement: true }).createIndex("t", "t");
        };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
    dbSoz.catch(function () { dbSoz = null; });
    return dbSoz;
  }
  function kaydet(tur, veri) {
    var kayit = { t: Date.now(), g: gunAnahtari(), tur: String(tur || "bilgi"), s: SAYFAM };
    if (veri) for (var a in veri) if (veri.hasOwnProperty(a) && veri[a] != null) kayit[a] = veri[a];
    return db().then(function (d) {
      return new Promise(function (res) {
        var tx = d.transaction("olaylar", "readwrite"); tx.objectStore("olaylar").add(kayit);
        tx.oncomplete = function () { res(true); }; tx.onerror = tx.onabort = function () { res(false); };
      });
    }).catch(function () { return false; });
  }

  /* ---------- cevaplar ---------- */
  function konuAdi(k) {
    return String(k || "").toLowerCase().replace(/[^a-z0-9çğıöşü_ -]/g, "").replace(/[ -]+/g, "_").slice(0, 40);
  }
  function cevap(o) {
    o = o || {};
    var ok = !!o.ok, bec = BECERILER.indexOf(o.beceri) >= 0 ? o.beceri : (beceri(o.ekran) || "yazma");
    var b = kova();
    if (b.gun !== gunAnahtari()) { bosalt(); b = kova(); }
    ekle(ok ? b.d : b.y, bec, 1);
    var konular = (o.konular || []).map(konuAdi).filter(Boolean).slice(0, 4);
    konular.forEach(function (k) { var v = b.k[k] || (b.k[k] = [0, 0]); v[ok ? 0 : 1]++; });
    kaydet("cevap", { ok: ok, b: bec, k: konular.length ? konular : null, kaynak: o.kaynak || null });
    zamanla();
  }

  /* ---------- etkin süre ---------- */
  var sonEtkinlik = Date.now(), ADIM = 5;
  ["pointerdown", "keydown", "touchstart", "wheel", "scroll"].forEach(function (ev) {
    try { global.addEventListener(ev, function () { sonEtkinlik = Date.now(); }, { passive: true, capture: true }); } catch (e) {}
  });
  function medyaCaliyor() {
    try {
      if (global.speechSynthesis && speechSynthesis.speaking) return true;
      var m = document.querySelectorAll("audio,video");
      for (var i = 0; i < m.length; i++) if (!m[i].paused && !m[i].ended && m[i].readyState > 2) return true;
    } catch (e) {}
    return false;
  }
  var yazmaSayaci = null;
  function zamanla() { if (!yazmaSayaci) yazmaSayaci = setTimeout(function () { yazmaSayaci = null; bosalt(); }, 30000); }
  var bec0 = beceri();
  if (bec0) {
    setInterval(function () {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - sonEtkinlik > 90000 && !medyaCaliyor()) return;
      var b = kova();
      if (b.gun !== gunAnahtari()) { bosalt(); b = kova(); }
      ekle(b.s, bec0, ADIM); ekle(b.e, SAYFAM, ADIM);
      zamanla();
    }, ADIM * 1000);
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") bosalt(); });
  global.addEventListener("pagehide", bosalt);

  /* Merkezî cevap değerlendirmesi (coach-bubble.js dhCoachEvaluate) bu olayı yayar. */
  global.addEventListener("dh-cevap", function (ev) { try { cevap(ev.detail || {}); } catch (e) {} });

  /* ---------- okuma: son n günün özeti (cihazlar toplanmış) ---------- */
  function topla(g) {
    var out = { s: {}, d: {}, y: {}, k: {}, e: {} };
    var by = (g && g.by) || {};
    for (var dv in by) if (by.hasOwnProperty(dv)) {
      var c = by[dv] || {};
      ["s", "d", "y", "e"].forEach(function (a) { var x = c[a] || {}; for (var n in x) if (x.hasOwnProperty(n)) out[a][n] = (out[a][n] || 0) + (+x[n] || 0); });
      var k = c.k || {};
      for (var konu in k) if (k.hasOwnProperty(konu)) { var v = out.k[konu] || (out.k[konu] = [0, 0]); v[0] += +k[konu][0] || 0; v[1] += +k[konu][1] || 0; }
    }
    return out;
  }
  function gunler(n) {
    bosalt();
    var o = oku(), arr = [], d = new Date();
    for (var i = 0; i < (n || 7); i++) {
      var k = gunAnahtari(d);
      var t = topla(o.gun[k]); t.tarih = k;
      arr.push(t);
      d.setDate(d.getDate() - 1);
    }
    return arr.reverse();
  }

  /* ---------- saklama bakımı (günde bir kez) ---------- */
  function bakim() {
    var bugun = gunAnahtari();
    try { if (localStorage.getItem(BAKIM) === bugun) return; } catch (e) { return; }
    function sinir(gun) { var d = new Date(); d.setDate(d.getDate() - gun); return gunAnahtari(d); }
    /* 1) Günlük özet: 90 günden eskiler tek kovaya sıkıştırılır, ekran ayrıntısı atılır. */
    try {
      var o = oku(), s90 = sinir(SIKISTIR_GUN), degisti = false;
      for (var g in o.gun) if (o.gun.hasOwnProperty(g) && g < s90) {
        var by = (o.gun[g] && o.gun[g].by) || {};
        if (Object.keys(by).length === 1 && by._) continue;
        var t = topla(o.gun[g]); delete t.e;
        ["s", "d", "y", "k"].forEach(function (a) { if (!Object.keys(t[a]).length) delete t[a]; });
        o.gun[g] = { by: { _: t } }; degisti = true;
      }
      if (degisti) yaz(o);
    } catch (e) {}
    /* 2) Çalışma sayacı: 30 günden eski günlerin olay listesi silinir, sayılar kalır. */
    try {
      var K = "dh-study-tracker-v1", tr = JSON.parse(localStorage.getItem(K) || "null");
      if (tr && tr.days) {
        var s30 = sinir(TRACKER_GUN), sil = 0;
        for (var gun in tr.days) if (tr.days.hasOwnProperty(gun) && gun < s30 && tr.days[gun] && tr.days[gun].events && tr.days[gun].events.length) { delete tr.days[gun].events; sil++; }
        if (sil) localStorage.setItem(K, JSON.stringify(tr));
      }
    } catch (e) {}
    /* 3) Ham olaylar: 30 günden eskiler silinir. */
    db().then(function (d) {
      var tx = d.transaction("olaylar", "readwrite");
      var aralik = IDBKeyRange.upperBound(Date.now() - HAM_GUN * 864e5);
      var r = tx.objectStore("olaylar").index("t").openCursor(aralik);
      r.onsuccess = function () { var c = r.result; if (c) { c.delete(); c.continue(); } };
    }).catch(function () {});
    try { localStorage.setItem(BAKIM, bugun); } catch (e) {}
  }
  setTimeout(bakim, 4000);

  global.DHOlay = { cevap: cevap, kaydet: kaydet, gunler: gunler, beceri: beceri, bosalt: bosalt, BECERILER: BECERILER, _topla: topla };
})(window);
