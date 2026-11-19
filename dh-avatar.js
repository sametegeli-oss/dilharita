/* dh-avatar.js — Dil Harita akici avatar motoru
   ---------------------------------------------------------------
   MEVCUT YAKLASIMIN UC YAPISAL SINIRI (index.html, avatar.js)
     1) Her karede <img>.src degistiriliyor -> tarayici yeniden decode
        eder, takilma buradan gelir.
     2) Kareler ayrik; aralarinda ara deger yok -> agiz sicrar.
     3) setInterval surüklenir ve speechSynthesis.onboundary her
        platformda tetiklenmez (iOS Safari'de guvenilmez).

   BU MOTORUN COZUMU
     1) Tum kareler BASTA yuklenip decode edilir (img.decode()).
        Calisma aninda decode yok.
     2) Iki katman ust uste; kare degisimi opacity ile capraz gecis
        (60ms). Agiz sekli sicramaz, akar.
     3) Zamanlama requestAnimationFrame + performance.now() ile
        surdurulur. onboundary BIRINCIL kaynak degil, yalnizca
        duzeltici olarak kullanilir (sapma 2 kareyi asarsa hizalar).

   AKICILIK HISSININ COGU AGIZDA DEGIL, BOSTA DURUSTA
     - nefes: CSS animasyonu (dh-ui.css .dh-avatar__nefes)
     - goz kirpma: DUZENSIZ aralik (2.8-6.2sn) ve UC kare
       (yarim -> kapali -> yarim), toplam ~120ms
     - konusma sonu: idle'a sicramaz, yumusak kapanir

   KARE SAYISI
     15 viseme yerine iyi harmanlanmis 8 kare gozle daha akici gorunur.
     Eksik kare varsa en yakin komsuya duser (KOMSU haritasi).

   KULLANIM
     <div class="dh-avatar" id="koc"></div>

     var av = DHAvatar.olustur(document.getElementById("koc"), {
       yol: "./assets/avatars_v3/teacher/",
       nefes: true
     });
     av.hazir.then(function(){ av.konus("Bugun tekrar gunu."); });

   API
     DHAvatar.olustur(el, secenek) -> {
       hazir, konus, sustur, bosaCik, yikil, kareGoster
     }
*/
(function (global) {
  "use strict";
  if (global.DHAvatar) return;

  /* Dosya adlari mevcut repodaki assets/avatars_v3/teacher/ ile ayni. */
  var KARELER = {
    idle: "idle.webp",
    blink: "blink.webp",
    kucuk: "mouth-small.webp",
    orta: "mouth-medium.webp",
    acik: "mouth-open.webp",
    a: "mouth-a.webp",
    e: "mouth-e.webp",
    i: "mouth-i.webp",
    o: "mouth-o.webp",
    u: "mouth-u.webp",
    mbp: "mouth-mbp.webp",
    fv: "mouth-fv.webp",
    l: "mouth-l.webp",
    th: "mouth-th.webp",
    listen: "listen.webp"   /* dinlerken (öğretmenle çalış ekranı) */
  };

  /* Kare yoksa nereye dusulecek. 8 cekirdek kare yeterlidir. */
  var KOMSU = {
    a: ["acik", "orta"], e: ["orta", "kucuk"], i: ["kucuk", "orta"],
    o: ["acik", "orta"], u: ["kucuk", "orta"],
    mbp: ["idle", "kucuk"], fv: ["kucuk", "orta"],
    l: ["orta", "kucuk"], th: ["kucuk", "orta"],
    kucuk: ["orta"], orta: ["kucuk", "acik"], acik: ["orta"],
    blink: ["idle"], listen: ["idle"]
  };

  /* Turkce + Ingilizce harf -> viseme. Koc Turkce anlatir, Ingilizce
     malzeme arada gecer; ikisi de ayni haritadan beslenir. */
  var HARF = {
    a: "a", "â": "a",
    e: "e",
    i: "i", "ı": "i", "î": "i", y: "i",
    o: "o", "ö": "o",
    u: "u", "ü": "u", "û": "u", w: "u",
    m: "mbp", b: "mbp", p: "mbp",
    f: "fv", v: "fv",
    l: "l", r: "l",
    t: "th", d: "th", n: "th", s: "th", z: "th",
    "ş": "th", "ç": "th", c: "th", j: "th",
    k: "orta", g: "orta", "ğ": "orta", h: "orta",
    q: "orta", x: "orta"
  };

  function reduceMotion() {
    try {
      return global.matchMedia &&
        global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { return false; }
  }

  /* Metinden viseme zaman cizgisi.
     Her viseme'ye metindeki harf konumu (charIndex) iliştirilir; boylece
     onboundary geldiginde oran degil KONUM uzerinden hizalanabilir. */
  function zamanCizgisi(metin) {
    var s = String(metin || "");
    var kareler = [];
    var oncekiV = null;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i].toLowerCase();
      var v = HARF[ch];
      if (!v) {
        // sessizlik: bosluk ve noktalama agzi kapatir
        if (/[\s.,;:!?—-]/.test(ch) && oncekiV !== "idle") {
          kareler.push({ v: "idle", ci: i });
          oncekiV = "idle";
        }
        continue;
      }
      // ayni viseme ust uste gelirse tekrar etme — sicrama yaratir
      if (v === oncekiV) continue;
      kareler.push({ v: v, ci: i });
      oncekiV = v;
    }
    if (!kareler.length) kareler.push({ v: "orta", ci: 0 });
    return kareler;
  }

  /* ===================================================================
     CANLI YÜZ KÖPRÜSÜ (18 Kasım)
     "teacher" avatarı artık Konuşkan'daki canlı yüz motoruyla (dh-canli-yuz.js)
     çiziliyor: duygular, jestler, yumuşak ağız. Sayfalar aynı API'yi kullanır
     (hazir, konus, sustur, bosaCik, kareGoster, yikil). WebGL yoksa ya da
     motor açılamazsa sessizce eski kare kare avatara döner.
     Doğal (Gemini) ses yalnız { dogalSes:true } verilen yerde kullanılır
     (Özel Ders); çok cümle okuyan sayfalar tarayıcı sesiyle kalır (kota).
     =================================================================== */
  function webglVar() {
    try { var c = document.createElement("canvas"); return !!(c.getContext("webgl") || c.getContext("experimental-webgl")); } catch (e) { return false; }
  }
  var betikler = {};
  function betikYukle(src) {
    if (betikler[src]) return betikler[src];
    betikler[src] = new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    return betikler[src];
  }
  function canliHazirla() {
    var adimlar = [];
    if (!global.DHViseme) adimlar.push(betikYukle("./viseme-lang.js"));
    return Promise.all(adimlar).then(function () { return global.DHCanliYuz ? null : betikYukle("./dh-canli-yuz.js?v=21"); });
  }
  var stilVar = false;
  function stilEkle() {
    if (stilVar) return; stilVar = true;
    var st = document.createElement("style");
    st.textContent = ".dh-avatar__canli{position:absolute;inset:0;overflow:hidden;border-radius:inherit}" +
      ".dh-avatar__canli canvas{position:absolute;width:122%;height:122%;left:-11%;top:-3%;display:block}";
    document.head.appendChild(st);
  }
  function canliOlustur(el, s) {
    stilEkle();
    var kap = document.createElement("div"); kap.className = "dh-avatar__canli"; kap.setAttribute("aria-hidden", "true");
    var cv = document.createElement("canvas"); kap.appendChild(cv); el.appendChild(kap);
    var yuz = null, eski = null, gozcu = null;
    function gorunurluk() {
      if (!yuz) return;
      var gizli = document.hidden || !el.isConnected;
      yuz.duraklat(gizli || el.__dhGorunmez === true);
    }
    var hazir = canliHazirla().then(function () {
      yuz = global.DHCanliYuz.olustur(cv, { yol: "./assets/avatars_v4/teacher/" });
      return yuz.hazir;
    }).then(function () {
      var w = el.getBoundingClientRect().width || 96;
      yuz.cizimHizi(w < 150 ? 30 : 0);
      yuz.profil({ ifade: 0.7, enerji: 0.5, jest: 0.5 });
      yuz.duygu("cesaret", 0.4);
      try {
        gozcu = new IntersectionObserver(function (g) { el.__dhGorunmez = !g[0].isIntersecting; gorunurluk(); });
        gozcu.observe(el);
      } catch (e) {}
      document.addEventListener("visibilitychange", gorunurluk);
      return true;
    }).catch(function () {
      /* yeni yüz açılamadı: eski avatara dön */
      try { kap.remove(); } catch (e) {}
      try { if (yuz) yuz.yikil(); } catch (e) {}
      yuz = null;
      var o = {}; Object.keys(s).forEach(function (k) { o[k] = s[k]; }); o.klasik = true;
      eski = olustur(el, o);
      return eski.hazir;
    });
    function dil(a) { var d = String((a && a.dil) || "").toLowerCase(); return d.indexOf("en") === 0 ? "en" : d.indexOf("tr") === 0 ? "tr" : null; }
    function konus(metin, ayar) {
      var a = ayar || {};
      if (eski) return eski.konus(metin, a);
      if (!yuz) { hazir.then(function () { konus(metin, a); }); return; }
      var temiz = String(metin || "").replace(/[\u{1F000}-\u{1FFFF}☀-➿]/gu, "").trim();
      if (!temiz) { if (a.bitti) a.bitti(); return; }
      /* metni cümlelere böl, her cümleye duygu ve jest seç (kurallı etiketleyici) */
      var d = dil(a), parcalar = global.DHCanliYuz.etiketle(temiz);
      var sessiz = a.ses === false, toplamSure = a.sure || 0, harf = temiz.length || 1;
      var liste = parcalar.map(function (c) {
        var o = { metin: c.metin, duygu: c.duygu, guc: Math.min(0.7, c.guc || 0.5), jest: c.jest };
        if (d) o.dil = d;
        if (sessiz) { o.sessiz = true; o.sureMs = toplamSure ? Math.round(toplamSure * c.metin.length / harf) : c.metin.length * 62; }
        return o;
      });
      var p = yuz.konus(liste, { hiz: a.hiz || 1, sonDuygu: "cesaret", dogal: !!s.dogalSes && !sessiz });
      p.then(function () { if (a.bitti) a.bitti(); });
      return p;
    }
    return {
      hazir: hazir,
      konus: konus,
      sustur: function () { if (eski) return eski.sustur(); if (yuz) yuz.sustur(); },
      bosaCik: function () { if (eski) return eski.bosaCik(); if (yuz) { yuz.dinle(false); } },
      kareGoster: function (ad) {
        if (eski) return eski.kareGoster(ad);
        if (!yuz) return;
        if (ad === "listen") { yuz.dinle(true); yuz.duygu("merak", 0.4); }
        else if (ad === "idle") { yuz.dinle(false); }
      },
      yikil: function () {
        if (eski) return eski.yikil();
        try { if (gozcu) gozcu.disconnect(); } catch (e) {}
        document.removeEventListener("visibilitychange", gorunurluk);
        try { if (yuz) yuz.yikil(); } catch (e) {}
        try { kap.remove(); } catch (e) {}
      },
      canli: true
    };
  }

  function olustur(el, secenek) {
    if (!el) throw new Error("DHAvatar: kap eleman gerekli");
    var s = secenek || {};
    var yol = s.yol || "./assets/avatars_v3/teacher/";
    /* öğretmen avatarı: yeni canlı yüz (WebGL varsa) */
    if (!s.klasik && /avatars_v3\/teacher\/?$/.test(yol) && webglVar()) return canliOlustur(el, s);
    var nefesAcik = s.nefes !== false;

    /* ---- DOM: nefes sarmalayici + iki capraz gecis katmani ---- */
    var sarmal = document.createElement("div");
    sarmal.className = nefesAcik && !reduceMotion() ? "dh-avatar__nefes" : "";
    sarmal.style.position = "relative";

    var katA = document.createElement("img");
    var katB = document.createElement("img");
    katA.className = "dh-avatar__kat dh-avatar__kat--on";
    katB.className = "dh-avatar__kat";
    katA.alt = s.alt || "";
    katB.alt = "";
    katA.setAttribute("aria-hidden", "true");
    katB.setAttribute("aria-hidden", "true");
    katA.decoding = "async";
    katB.decoding = "async";

    sarmal.appendChild(katA);
    sarmal.appendChild(katB);
    el.appendChild(sarmal);

    var onKat = katA, arkaKat = katB;
    var yuklu = {};   // ad -> src (decode edilmis)
    var suAnki = null;

    /* ---- on yukleme: hepsi bir kez decode edilir ---- */
    function yukle(ad) {
      return new Promise(function (res) {
        var img = new Image();
        img.src = yol + KARELER[ad];
        var bitir = function () { yuklu[ad] = img.src; res(true); };
        var hata = function () { res(false); };
        if (img.decode) {
          img.decode().then(bitir, function () {
            // decode reddederse onload'a dus
            img.onload = bitir; img.onerror = hata;
          });
        } else {
          img.onload = bitir; img.onerror = hata;
        }
      });
    }

    var hazir = Promise.all(Object.keys(KARELER).map(yukle)).then(function () {
      kareGoster("idle", true);
      bosaCik();
      return true;
    });

    /* Kare adini mevcut olana cozer (eksikse komsuya duser). */
    function coz(ad) {
      if (yuklu[ad]) return ad;
      var alt = KOMSU[ad] || [];
      for (var i = 0; i < alt.length; i++) {
        if (yuklu[alt[i]]) return alt[i];
      }
      return yuklu.idle ? "idle" : null;
    }

    /* Capraz gecisli kare degisimi. src ONCEDEN decode edildigi icin
       atama aninda decode maliyeti yok. */
    function kareGoster(ad, aniden) {
      var gercek = coz(ad);
      if (!gercek || gercek === suAnki) return;
      suAnki = gercek;

      if (aniden) {
        onKat.src = yuklu[gercek];
        return;
      }
      arkaKat.src = yuklu[gercek];
      arkaKat.classList.add("dh-avatar__kat--on");
      onKat.classList.remove("dh-avatar__kat--on");
      var t = onKat; onKat = arkaKat; arkaKat = t;
    }

    /* ---- goz kirpma: duzensiz aralik, uc kare ---- */
    var kirpZaman = null;
    var kirpAcik = false;
    var konusuyor = false;

    function kirpPlanla() {
      if (!kirpAcik) return;
      // duzensiz: 2.8-6.2sn. Sabit aralik makine ritmi gibi okunur.
      var sonra = 2800 + Math.random() * 3400;
      kirpZaman = setTimeout(function () {
        if (!konusuyor && kirpAcik) kirpDizisi();
        kirpPlanla();
      }, sonra);
    }

    /* Tek kare degil uc asama: yarim -> kapali -> yarim (~120ms).
       Tek kare kirpma "goz atlatma" gibi gorunur. */
    function kirpDizisi() {
      var geriDon = suAnki;
      kareGoster("kucuk");
      setTimeout(function () {
        if (konusuyor) return;
        kareGoster("blink");
        setTimeout(function () {
          if (konusuyor) return;
          kareGoster("kucuk");
          setTimeout(function () {
            if (!konusuyor) kareGoster(geriDon || "idle");
          }, 40);
        }, 60);
      }, 30);
    }

    function bosaCik() {
      konusuyor = false;
      kirpAcik = true;
      kareGoster("idle");
      clearTimeout(kirpZaman);
      kirpPlanla();
    }

    function kirpDurdur() {
      kirpAcik = false;
      clearTimeout(kirpZaman);
      kirpZaman = null;
    }

    /* ---- konusma: rAF surucu ---- */
    var rafId = null;
    var utter = null;

    function durdurRaf() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    /* Konusma bitince agiz idle'a SICRAMAZ; 200ms'de kapanir. */
    function yumusakKapat() {
      kareGoster("kucuk");
      setTimeout(function () { kareGoster("idle"); }, 120);
      setTimeout(function () { bosaCik(); }, 200);
    }

    /* metin  : ekranda gorunen/soylenen metin
       ayar   : { ses:true, dil:"tr-TR", hiz:1, sure:ms, bitti:fn }
       Ses kapaliysa da agiz oynar (sessiz mod okuma ritmini korur). */
    function konus(metin, ayar) {
      var a = ayar || {};
      sustur();

      var cizgi = zamanCizgisi(metin);
      /* Metin boşsa ya da yalnız simge/noktalama ise çizgi boş gelir;
         cizgi[-1].v hatası vermemesi için tek kareli çizgi kullan. */
      if (!cizgi || !cizgi.length) cizgi = [{ v: "kucuk", ci: 0 }];
      var sesMetni = String(metin || "").replace(
        /[\u{1F000}-\u{1FFFF}☀-➿]/gu, ""
      );

      // Sure tahmini: TTS onend gelene kadar gecerli olan taban.
      var toplam = Math.max(700, a.sure || sesMetni.length * 62);

      konusuyor = true;
      kirpDurdur();

      var t0 = performance.now();
      var sonIndeks = -1;
      var hizalamaKaymasi = 0; // onboundary'den gelen duzeltme (ms)

      function adim(now) {
        var gecen = now - t0 - hizalamaKaymasi;
        /* rAF zamanı t0'dan önce olabilir (kare, konus() çağrısından önce başlamış):
           oran eksiye düşüp i=-1 olmasın. */
        var oran = Math.max(0, Math.min(1, gecen / toplam));
        var i = Math.max(0, Math.min(cizgi.length - 1, Math.floor(oran * cizgi.length)));

        if (i !== sonIndeks) {
          sonIndeks = i;
          kareGoster(cizgi[i].v);
        }
        if (oran >= 1) { rafId = null; return; }
        rafId = requestAnimationFrame(adim);
      }

      if (reduceMotion()) {
        // hareket azaltmada agiz oynatilmaz; yalnizca konusma durumu
        kareGoster("orta");
      } else {
        rafId = requestAnimationFrame(adim);
      }

      var sesVar = false;
      if (a.ses !== false && global.speechSynthesis) {
        try {
          speechSynthesis.cancel();
          utter = new SpeechSynthesisUtterance(sesMetni);
          utter.lang = a.dil || "tr-TR";
          utter.rate = a.hiz || 1;

          /* onboundary BIRINCIL kaynak degil. Yalnizca sapma buyukse
             duzeltir; her platformda tetiklenmedigi icin ona bagimli
             bir tasarim iOS'ta bozulur. */
          utter.onboundary = function (ev) {
            if (!ev || (ev.name && ev.name !== "word")) return;
            var ci = ev.charIndex || 0;
            var hedefI = 0;
            for (var k = 0; k < cizgi.length; k++) {
              if (cizgi[k].ci <= ci) hedefI = k; else break;
            }
            var beklenenGecen = (hedefI / cizgi.length) * toplam;
            var gercekGecen = performance.now() - t0 - hizalamaKaymasi;
            var sapma = gercekGecen - beklenenGecen;
            // 2 kareden fazla sapma varsa hizala
            if (Math.abs(sapma) > (toplam / cizgi.length) * 2) {
              hizalamaKaymasi += sapma;
            }
          };
          utter.onend = function () { durdurRaf(); yumusakKapat(); if (a.bitti) a.bitti(); };
          utter.onerror = function () { durdurRaf(); yumusakKapat(); if (a.bitti) a.bitti(); };
          speechSynthesis.speak(utter);
          sesVar = true;
        } catch (e) { sesVar = false; }
      }

      if (!sesVar) {
        setTimeout(function () {
          durdurRaf(); yumusakKapat(); if (a.bitti) a.bitti();
        }, toplam);
      }
    }

    function sustur() {
      durdurRaf();
      try { if (global.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
      utter = null;
      konusuyor = false;
    }

    function yikil() {
      sustur();
      kirpDurdur();
      try { el.removeChild(sarmal); } catch (e) {}
    }

    return {
      hazir: hazir,
      konus: konus,
      sustur: function () { sustur(); yumusakKapat(); },
      bosaCik: bosaCik,
      kareGoster: kareGoster,
      yikil: yikil
    };
  }

  global.DHAvatar = { olustur: olustur, _zamanCizgisi: zamanCizgisi };
})(typeof window !== "undefined" ? window : globalThis);
