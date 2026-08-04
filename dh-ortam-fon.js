/* dh-ortam-fon.js — SOHBET ARKA PLANI: gunun ortamini temsil eden gorsel
   ================================================================
   ISTEK
   "chat'te ortamı temsil eden arkada dönen varsa video, yoksa resim olsun."

   ── NEDEN YENI INDIRME YOK (olculdu) ──
   Uygulamada bu medya ZATEN var ve ZATEN onbelleklenmis durumda:

     video-practice-video:<cumleId>   videopractice.html'in Pexels'ten alip
                                      kv'ye yazdigi kayit
                                      {videoUrl, posterUrl, query, ...}
     img:<normEn(cumle)>              image-addon.js'in Openverse/Wikimedia
                                      Commons/Wikipedia'dan bulup kv'ye
                                      yazdigi resim URL'si ("NONE" = bulunamadi)

   Bu dosya ONCE o onbellekleri tarar. Kullanici bugun calistigi cumlelerin
   videosunu videopractice'te acmissa arka plan ANINDA ve BEDAVA gelir.
   Hicbiri yoksa sirayla:
     3) Pexels (yalnizca kv'de "pexels-api-key" varsa) — videopractice ile
        AYNI anahtar, ayrica bir sey istenmez
     4) Openverse (anahtarsiz) — image-addon ile ayni kaynak
     5) hicbiri olmazsa arka plan cizilmez, sayfa bugunku haliyle kalir

   ── GUN ICINDE DONAR ──
   dh-ortam-fon-<YYYY-MM-DD>. Her sohbet acilisinda yeniden aranmaz;
   dh-konusma.js ve dh-telafi.js ile ayni disiplin. Bulunamadiysa "yok"
   olarak donar ki her acilista bosuna ag istegi yapilmasin.

   ── NEREYE CIZILIR ──
   .avatar-stage (position:relative, overflow:hidden) — avatarin ARKASINA,
   sohbet metnine hic dokunmadan. Ustune okunabilirlik icin perde konur.
*/
(function (global) {
  "use strict";
  if (global.__dhOrtamFon) return;
  global.__dhOrtamFon = true;

  var DB = "sentence-mode", STORE = "kv";
  var FON_ONEK = "dh-ortam-fon-";
  var VIDEO_ONEK = "video-practice-video:";
  var IMG_ONEK = "img:";
  var PEXELS_ANAHTAR = "pexels-api-key";
  /* SURUM: bkz. dh-konusma.js. Video onceligi ve imgQuery sorgulari
     eklendiginde artirildi; boylece gun icinde donmus ESKI secim
     (or. video yerine resim) bayat sayilip yeniden hesaplanir. */
  var SURUM = 2;

  function gunISO() { return new Date().toISOString().slice(0, 10); }
  function fonKey() { return FON_ONEK + gunISO(); }
  /* image-addon.js ile AYNI normalizasyon — anahtarlar tutsun */
  function normEn(s) {
    return (s || "").toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9' ]/g, "").trim();
  }

  /* ───────────────────────── kv okuma ───────────────────────── */
  function kvGet(anahtar) {
    return new Promise(function (res) {
      try {
        if (!global.indexedDB) return res(null);
        var r = global.indexedDB.open(DB, 1);
        r.onerror = function () { res(null); };
        r.onsuccess = function () {
          var db = r.result;
          if (!db.objectStoreNames.contains(STORE)) { try { db.close(); } catch (e) {} return res(null); }
          try {
            var q = db.transaction(STORE, "readonly").objectStore(STORE).get(anahtar);
            q.onsuccess = function () { try { db.close(); } catch (e) {} res(q.result || null); };
            q.onerror = function () { try { db.close(); } catch (e) {} res(null); };
          } catch (e) { try { db.close(); } catch (e2) {} res(null); }
        };
      } catch (e) { res(null); }
    });
  }

  function kvYaz(anahtar, deger) {
    return new Promise(function (res) {
      try {
        if (!global.indexedDB) return res(false);
        var r = global.indexedDB.open(DB, 1);
        r.onerror = function () { res(false); };
        r.onsuccess = function () {
          var db = r.result;
          if (!db.objectStoreNames.contains(STORE)) { try { db.close(); } catch (e) {} return res(false); }
          try {
            var t = db.transaction(STORE, "readwrite");
            t.objectStore(STORE).put(deger, anahtar);
            t.oncomplete = function () { try { db.close(); } catch (e) {} res(true); };
            t.onerror = function () { try { db.close(); } catch (e) {} res(false); };
          } catch (e) { try { db.close(); } catch (e2) {} res(false); }
        };
      } catch (e) { res(false); }
    });
  }

  /* ───────────────────── gunun malzemesi ────────────────────── */
  function malzeme() {
    try {
      var ham = localStorage.getItem("dh-konusma-gun-" + gunISO());
      if (!ham) return null;
      var m = JSON.parse(ham);
      /* Kayit bicimi dh-konusma.js tarafindan {s:<surum>, v:<malzeme>}
         olarak sarmalandi. Sarmali ac; eski duz kayitlar da calissin. */
      if (m && typeof m === "object" && m.s && m.v !== undefined) m = m.v;
      return (m && m.cumleler && m.cumleler.length) ? m : null;
    } catch (e) { return null; }
  }

  /* ── 1) ONBELLEKTEKI VIDEO ── */
  function onbellekVideo(m) {
    var ids = m.cumleler.map(function (c) { return c.id; });
    var i = 0;
    function sonraki() {
      if (i >= ids.length) return Promise.resolve(null);
      var id = ids[i++];
      return kvGet(VIDEO_ONEK + id).then(function (ham) {
        if (!ham) return sonraki();
        try {
          var p = (typeof ham === "string") ? JSON.parse(ham) : ham;
          if (p && p.videoUrl) {
            return { tur: "video", url: p.videoUrl, poster: p.posterUrl || "", kaynak: "önbellek" };
          }
        } catch (e) {}
        return sonraki();
      });
    }
    return sonraki();
  }

  /* ── 2) ONBELLEKTEKI RESIM ── */
  function onbellekResim(m) {
    var i = 0;
    function sonraki() {
      if (i >= m.cumleler.length) return Promise.resolve(null);
      var c = m.cumleler[i++];
      return kvGet(IMG_ONEK + normEn(c.en)).then(function (u) {
        if (!u || u === "NONE" || typeof u !== "string") return sonraki();
        return { tur: "resim", url: u, poster: "", kaynak: "önbellek" };
      });
    }
    return sonraki();
  }

  /* ── SORGU ADAYLARI ────────────────────────────────────────────
     Stok video aramasi ORTAM metniyle iyi sonuc vermiyor
     ("Restaurant — Arrival" diye bir stok video yok). Veride her cumlenin
     ELLE YAZILMIS imgQuery'si var ve tam bu is icin: "restaurant entrance,
     host stand, couple waiting". videopractice.html de Pexels'i bununla
     ariyor. Kayitlarin %96.1'i kullanilabilir; kalanini eliyoruz (olculdu):
       · %3.8'i Turkce ("resmî hasta yatağı, doktor steteskoplu")
       · %0.2'si sozluk listesi ("fill in (v), form (n), filler (n)")
     Ayrica uzun virgullu terimden ILK IKI parca alinir; Pexels kisa
     sorgularda belirgin sekilde daha isabetli. */
  function sorguTemiz(q) {
    q = String(q || "").trim();
    if (!q) return "";
    if (/[ğüşöçıİĞÜŞÖÇ]/.test(q)) return "";           /* Turkce: stokta aranmaz */
    if (/\((v|n|adj|adv)\)/i.test(q)) return "";       /* sozluk listesi */
    var p = q.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    return p.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
  }
  function sorguAdaylari(m) {
    var out = [], gorulen = {};
    function ekle(q) {
      q = sorguTemiz(q);
      if (q && !gorulen[q.toLowerCase()]) { gorulen[q.toLowerCase()] = 1; out.push(q); }
    }
    (m.cumleler || []).forEach(function (c) { ekle(c.imgQuery); });
    ekle(m.ortam);
    ekle(m.konu);
    return out;
  }

  /* ── 3) PEXELS (yalnizca anahtar varsa) ── */
  /* Anahtar videopractice.html tarafindan kv'ye yaziliyor; bazi eski
     kurulumlarda localStorage'da kalmis olabilir — ikisine de bakilir. */
  function pexelsAnahtari() {
    return kvGet(PEXELS_ANAHTAR).then(function (k) {
      if (k) return k;
      try { return localStorage.getItem(PEXELS_ANAHTAR) || null; } catch (e) { return null; }
    }).catch(function () {
      try { return localStorage.getItem(PEXELS_ANAHTAR) || null; } catch (e) { return null; }
    });
  }
  function pexelsAra(sorgu, key) {
    var u = "https://api.pexels.com/videos/search?per_page=5&orientation=landscape&query="
          + encodeURIComponent(sorgu);
    return fetch(u, { headers: { Authorization: key } }).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).then(function (d) {
      var vs = (d && d.videos) || [];
      for (var i = 0; i < vs.length; i++) {
        var fl = (vs[i].video_files || []).filter(function (f) {
          return f.file_type === "video/mp4" && f.link;
        }).sort(function (a, b) {   /* videopractice ile ayni tercih: 1280'e yakin */
          return Math.abs(1280 - (a.width || 0)) - Math.abs(1280 - (b.width || 0));
        });
        if (fl[0]) {
          return { tur: "video", url: fl[0].link, poster: vs[i].image || "",
                   kaynak: "pexels", sorgu: sorgu, pexelsId: vs[i].id || "" };
        }
      }
      return null;
    }).catch(function () { return null; });
  }
  function pexelsVideo(m) {
    return pexelsAnahtari().then(function (key) {
      if (!key) return null;                     /* anahtar yok: hic istek atma */
      var adaylar = sorguAdaylari(m), i = 0;
      function sonraki() {
        if (i >= adaylar.length) return Promise.resolve(null);
        var q = adaylar[i++];
        return pexelsAra(q, key).then(function (r) { return r || sonraki(); });
      }
      return sonraki();
    }).catch(function () { return null; });
  }

  /* Bulunan videoyu videopractice.html ile AYNI anahtara yazar: bir kez
     indirilen video iki ekranda da kullanilir, ikinci kez aranmaz. */
  function videoyuPaylas(m, f) {
    try {
      if (!f || f.tur !== "video" || f.kaynak !== "pexels") return Promise.resolve();
      var c = (m.cumleler || [])[0];
      if (!c || !c.id) return Promise.resolve();
      return kvYaz(VIDEO_ONEK + c.id, JSON.stringify({
        source: "pexels", id: f.pexelsId || "", videoUrl: f.url, posterUrl: f.poster || "",
        query: f.sorgu || "", sentence: c.en || "", savedAt: new Date().toISOString()
      }));
    } catch (e) { return Promise.resolve(); }
  }

  /* ── 4) OPENVERSE (anahtarsiz, image-addon ile ayni kaynak) ── */
  function openverseResim(sorgu) {
    var u = "https://api.openverse.org/v1/images/?page_size=5&license_type=all&q="
          + encodeURIComponent(sorgu);
    return fetch(u).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).then(function (d) {
      var rs = (d && d.results) || [];
      for (var i = 0; i < rs.length; i++) {
        var url = rs[i].url || rs[i].thumbnail;
        if (url) return { tur: "resim", url: url, poster: "", kaynak: "openverse" };
      }
      return null;
    }).catch(function () { return null; });
  }

  /* ───────────────────── secim + dondurma ───────────────────── */
  function donmusOku() {
    try {
      var ham = localStorage.getItem(fonKey());
      if (ham === null) return undefined;
      var o = JSON.parse(ham);
      if (!o || typeof o !== "object" || o.s !== SURUM) return undefined;  /* bayat */
      return o.v;
    } catch (e) { return undefined; }
  }
  function dondur(v) {
    try {
      localStorage.setItem(fonKey(), JSON.stringify({ s: SURUM, v: (v || null) }));
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf(FON_ONEK) === 0 && k !== fonKey()) localStorage.removeItem(k);
      }
    } catch (e) {}
  }

  function sec() {
    var m = malzeme();
    if (!m) return Promise.resolve(null);
    var sorgu = sorguTemiz(m.ortam) || sorguTemiz(m.konu) || m.modul;
    /* ONCE VIDEO, SONRA RESIM. Once onbellekteki video, o yoksa Pexels'ten
       video; video hicbir sekilde bulunamazsa resme dusulur. (Eski sira
       onbellekteki resmi Pexels videosunun ONUNE koyuyordu ve ekranda
       hareketsiz bir kare kaliyordu.) */
    return onbellekVideo(m)
      .then(function (r) { return r || pexelsVideo(m); })
      .then(function (r) { return videoyuPaylas(m, r).then(function () { return r; }); })
      .then(function (r) { return r || onbellekResim(m); })
      .then(function (r) { return r || openverseResim(sorgu); })
      .catch(function () { return null; });
  }

  var _ucus = null;
  function bul() {
    var d = donmusOku();
    if (d !== undefined) return Promise.resolve(d);
    if (_ucus) return _ucus;
    _ucus = sec().then(function (r) {
      var son = donmusOku();
      if (son !== undefined) { _ucus = null; return son; }
      dondur(r || null);
      _ucus = null;
      return r || null;
    }).catch(function () { _ucus = null; return null; });
    return _ucus;
  }
  function sifirla() { try { localStorage.removeItem(fonKey()); } catch (e) {} _ucus = null; }

  /* ───────────────────────── cizim ──────────────────────────── */
  function stil() {
    if (document.getElementById("dh-fon-css")) return;
    var s = document.createElement("style");
    s.id = "dh-fon-css";
    /* KRITIK (olculdu): chat-style.css'te
         .avatar-stage > img,#avatarImg{position:relative!important;width:auto!important;
                                        height:100%!important;object-fit:contain!important}
       kurali var. Arka plani DOGRUDAN <img> olarak koyunca bu kural onu da
       yakaliyor, mutlak konumlandirma eziliyor ve resim avatarin ARKASINA
       degil YANINA diziliyordu (flex ogesi olarak). Cozum: medya bir
       SARMALAYICI div icine konur — ".avatar-stage > img" artik eslesmez —
       ve kendi kurallarimiz !important ile yazilir. */
    s.textContent =
      ".dh-fon-kap{position:absolute!important;inset:0!important;width:100%!important;"
      + "height:100%!important;z-index:0!important;overflow:hidden!important;"
      + "pointer-events:none!important;margin:0!important;padding:0!important;flex:none!important}"
      + ".dh-fon-kap > .dh-fon{position:absolute!important;inset:0!important;"
      + "width:100%!important;height:100%!important;object-fit:cover!important;"
      + "object-position:center center!important;max-width:none!important;"
      + "max-height:none!important;margin:0!important;border:0!important;display:block!important;"
      + "opacity:0;transition:opacity .8s ease;background:transparent!important}"
      /* KARARTMA YOK: ortam hissi asil deger, %50 saydamlik goruntuyu
         oldurüyordu. Tam opak gosterilir. */
      + ".dh-fon-kap > .dh-fon.dh-fon--acik{opacity:1}"
      /* Perde: avatar ve yazi okunur kalsin diye ustte koyu bir gecis */
      /* Perde yalnizca avatarin oldugu SAG kenarda ve alt seritte hafif bir
         gecis birakir; ortamin ustune tam ekran koyu katman KOYULMAZ. */
      + ".dh-fon-perde{position:absolute!important;inset:0;z-index:1;pointer-events:none;flex:none!important;"
      + "background:linear-gradient(90deg,rgba(5,11,22,0) 0%,rgba(5,11,22,0) 55%,rgba(5,11,22,.35) 100%)}"
      /* Avatar her halukarda perdenin USTUNDE */
      + ".avatar-stage > #avatarImg,.avatar-stage > .avatar-box,.avatar-stage > img,"
      + ".avatar-stage > .avatar-base{position:relative;z-index:2}";
    document.head.appendChild(s);
  }

  function ciz(f) {
    if (!f || !f.url) return null;
    var sahne = document.querySelector(".avatar-stage");
    if (!sahne) return null;
    if (document.getElementById("dhOrtamFon")) return null;   /* zaten var */
    stil();

    var el;
    if (f.tur === "video") {
      el = document.createElement("video");
      el.autoplay = true; el.loop = true; el.muted = true;
      el.defaultMuted = true; el.playsInline = true;
      el.setAttribute("muted", "");
      el.setAttribute("playsinline", "");
      if (f.poster) el.poster = f.poster;
      el.src = f.url;
      /* Otomatik oynatma engellenirse (bazi mobil tarayicilar) poster kalir;
         hata sessizce yutulur, sayfa bozulmaz. */
      try { var p = el.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    } else {
      el = document.createElement("img");
      el.alt = "";
      el.src = f.url;
    }
    el.id = "dhOrtamFon";
    el.className = "dh-fon";
    el.setAttribute("aria-hidden", "true");

    var perde = document.createElement("div");
    perde.className = "dh-fon-perde";
    perde.setAttribute("aria-hidden", "true");

    /* medya sarmalayici icinde: ".avatar-stage > img" kurali eslesmesin */
    var kap = document.createElement("div");
    kap.className = "dh-fon-kap";
    kap.setAttribute("aria-hidden", "true");
    kap.appendChild(el);

    sahne.insertBefore(perde, sahne.firstChild);
    sahne.insertBefore(kap, sahne.firstChild);
    /* yuklenince yumusak ac; yuklenemezse hic gosterme */
    var ac = function () { el.classList.add("dh-fon--acik"); };
    if (f.tur === "video") el.addEventListener("loadeddata", ac, { once: true });
    else el.addEventListener("load", ac, { once: true });
    el.addEventListener("error", function () {
      try { kap.remove(); perde.remove(); } catch (e) {}
    }, { once: true });
    return el;
  }

  function baslat() {
    bul().then(function (f) { if (f) ciz(f); }).catch(function () {});
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", baslat, { once: true });
  } else { baslat(); }

  global.DHOrtamFon = {
    bul: bul, sec: sec, ciz: ciz, sifirla: sifirla,
    _normEn: normEn, _anahtar: fonKey,
    _sorguTemiz: sorguTemiz, _sorguAdaylari: sorguAdaylari
  };
})(typeof window !== "undefined" ? window : globalThis);
