/* ═══════════════════════════════════════════════════════════════
   ATLAS · SES
   1) Seslendirme — çift dilli. [[İngilizce]] blokları İngilizce sesle,
      gerisi Türkçe sesle okunur. Ağız hareketleri metne göre üretilir.
   2) Tanıma — SpeechRecognition. iOS'ta yoksa yazı kutusuna DÜŞÜLMEZ;
      gölgeleme paneli açılır (dinle → kaydet → karşılaştır → puanla).
      Telaffuz alıştırmasını yazıya çevirmek alıştırmayı yok eder.
   3) Ağız haritası — Türkçe ve İngilizce ayrı. İki dilin ağzı
      gerçekten farklı: r yuvarlaklığı, ö/ü, ş/ç, th, sondaki sessiz e.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ───── ağız (viseme) haritaları ───────────────────────────── */
  var KARE = './assets/avatar/';
  var GORSEL = {
    idle: KARE + 'idle.webp',
    a: KARE + 'mouth-a.webp', e: KARE + 'mouth-e.webp', i: KARE + 'mouth-i.webp',
    o: KARE + 'mouth-o.webp', u: KARE + 'mouth-u.webp',
    mbp: KARE + 'mouth-mbp.webp', fv: KARE + 'mouth-fv.webp',
    l: KARE + 'mouth-l.webp', th: KARE + 'mouth-th.webp',
    kucuk: KARE + 'mouth-small.webp', orta: KARE + 'mouth-medium.webp',
    acik: KARE + 'mouth-open.webp', goz: KARE + 'blink.webp', dinle: KARE + 'listen.webp'
  };

  var TR_HARITA = {
    'a': 'a', 'e': 'e', 'ı': 'i', 'i': 'i', 'o': 'o', 'ö': 'o', 'u': 'u', 'ü': 'u',
    'm': 'mbp', 'b': 'mbp', 'p': 'mbp',
    'f': 'fv', 'v': 'fv',
    'l': 'l', 'r': 'kucuk', 'n': 'l', 'd': 'l', 't': 'l', 's': 'kucuk', 'z': 'kucuk',
    'ş': 'orta', 'ç': 'orta', 'c': 'orta', 'j': 'orta',
    'k': 'kucuk', 'g': 'kucuk', 'ğ': null, 'h': 'acik', 'y': 'i'
  };
  var EN_HARITA = {
    'a': 'a', 'e': 'e', 'i': 'i', 'o': 'o', 'u': 'u',
    'm': 'mbp', 'b': 'mbp', 'p': 'mbp',
    'f': 'fv', 'v': 'fv',
    'l': 'l', 'r': 'u', 'w': 'u',
    'n': 'l', 'd': 'l', 't': 'l', 's': 'kucuk', 'z': 'kucuk',
    'c': 'kucuk', 'k': 'kucuk', 'g': 'kucuk', 'h': 'acik',
    'y': 'i', 'j': 'orta', 'q': 'u', 'x': 'kucuk'
  };

  /* dil tahmini — sadece güçlü işaretlerde konuşur, yoksa bağlam dili */
  var EN_ISARET = /\b(the|and|is|are|was|were|have|has|do|does|did|will|would|can|could|should|of|to|in|on|at|for|with|that|this|it|you|they|we|he|she|not|but|from)\b/i;
  var TR_HARF = /[çğıöşüÇĞİÖŞÜ]/;
  function dilTahmin(metin, baglam) {
    if (TR_HARF.test(metin)) return 'tr';
    if (/\b\w*(th|sh|oo|ea|ough|tion)\w*\b/i.test(metin)) return 'en';
    if (EN_ISARET.test(metin)) return 'en';
    if (/[qwx]/i.test(metin)) return 'en';
    return baglam || 'tr';
  }

  /* metni [[EN]] bloklarına göre parçalara ayır */
  function parcala(metin, baglam) {
    var out = [], re = /\[\[([\s\S]*?)\]\]/g, son = 0, m;
    while ((m = re.exec(metin))) {
      if (m.index > son) {
        var t = metin.slice(son, m.index);
        if (t.trim()) out.push({ metin: t, dil: dilTahmin(t, baglam) });
      }
      if (m[1].trim()) out.push({ metin: m[1], dil: 'en' });
      son = re.lastIndex;
    }
    if (son < metin.length) {
      var k = metin.slice(son);
      if (k.trim()) out.push({ metin: k, dil: dilTahmin(k, baglam) });
    }
    return out.length ? out : [{ metin: metin, dil: baglam || 'tr' }];
  }

  /* metin → ağız kareleri (süreye yayılmış) */
  function kareler(metin, dil) {
    var h = dil === 'en' ? EN_HARITA : TR_HARITA;
    var s = String(metin).toLowerCase();
    var out = [], onceki = null;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (dil === 'en' && c === 't' && s[i + 1] === 'h') { out.push('th'); i++; onceki = 'th'; continue; }
      if (dil === 'en' && c === 's' && s[i + 1] === 'h') { out.push('orta'); i++; onceki = 'orta'; continue; }
      if (dil === 'en' && c === 'c' && s[i + 1] === 'h') { out.push('orta'); i++; onceki = 'orta'; continue; }
      /* İngilizcede kelime sonundaki e sessizdir → ağız açılmaz */
      if (dil === 'en' && c === 'e' && (i === s.length - 1 || /[\s.,!?]/.test(s[i + 1])) && i > 2) continue;
      if (!(c in h)) { if (/\s/.test(c) && onceki !== 'idle') { out.push('idle'); onceki = 'idle'; } continue; }
      var k = h[c];
      if (k === null) continue;              /* ğ: ağız değişmez, ünlüyü uzatır */
      if (k === onceki) continue;
      out.push(k); onceki = k;
    }
    return out.length ? out : ['idle'];
  }

  /* ───── seslendirme motoru ─────────────────────────────────── */
  var sesler = [];
  var hazir = false;
  function sesleriYukle() {
    if (!('speechSynthesis' in global)) return;
    sesler = speechSynthesis.getVoices() || [];
    hazir = sesler.length > 0;
  }
  if ('speechSynthesis' in global) {
    sesleriYukle();
    speechSynthesis.onvoiceschanged = sesleriYukle;
  }

  function sesSec(dil) {
    var a = Atlas.Ayar.al();
    var istenen = dil === 'en' ? a.sesEn : a.sesTr;
    if (istenen) {
      var s = sesler.find(function (v) { return v.name === istenen; });
      if (s) return s;
    }
    var kod = dil === 'en' ? 'en' : 'tr';
    var uygun = sesler.filter(function (v) { return (v.lang || '').toLowerCase().indexOf(kod) === 0; });
    /* doğal/gelişmiş sesleri öne al */
    uygun.sort(function (x, y) {
      var p = function (v) {
        var n = (v.name || '').toLowerCase();
        return (/natural|neural|premium|enhanced|google/.test(n) ? -2 : 0) + (v.localService ? -1 : 0);
      };
      return p(x) - p(y);
    });
    return uygun[0] || sesler[0] || null;
  }

  var suAn = null;

  var Ses = {
    GORSEL: GORSEL,
    parcala: parcala,
    kareler: kareler,
    dilTahmin: dilTahmin,
    sesListesi: function (dil) {
      if (!dil) return sesler;
      return sesler.filter(function (v) { return (v.lang || '').toLowerCase().indexOf(dil) === 0; });
    },
    destek: function () {
      return {
        tts: 'speechSynthesis' in global,
        stt: !!(global.SpeechRecognition || global.webkitSpeechRecognition),
        kayit: !!(navigator.mediaDevices && global.MediaRecorder)
      };
    },

    dur: function () {
      try { speechSynthesis.cancel(); } catch (e) {}
      if (suAn && suAn.agiz) { clearInterval(suAn.agiz); }
      if (suAn && suAn.bitti) suAn.bitti();
      suAn = null;
    },

    /* konuş — çift dilli, ağız senkronlu.
       secenek: {baglam:'tr'|'en', agiz:fn(kareAdi), bitti:fn(), hiz:number} */
    konus: function (metin, secenek) {
      secenek = secenek || {};
      Ses.dur();
      if (!('speechSynthesis' in global)) { if (secenek.bitti) secenek.bitti(); return Promise.resolve(); }
      var a = Atlas.Ayar.al();
      var parcalar = parcala(String(metin || '').trim(), secenek.baglam || 'tr');
      var durum = { agiz: null, bitti: secenek.bitti };
      suAn = durum;

      return new Promise(function (coz) {
        var i = 0;
        function sonraki() {
          if (i >= parcalar.length || suAn !== durum) {
            if (durum.agiz) clearInterval(durum.agiz);
            if (secenek.agiz) secenek.agiz('idle');
            if (secenek.bitti) secenek.bitti();
            suAn = null; coz();
            return;
          }
          var p = parcalar[i++];
          var u = new SpeechSynthesisUtterance(p.metin.replace(/\s+/g, ' ').trim());
          var v = sesSec(p.dil);
          if (v) { u.voice = v; u.lang = v.lang; }
          else u.lang = p.dil === 'en' ? 'en-US' : 'tr-TR';
          u.rate = secenek.hiz || a.sesHiz || 0.9;
          u.pitch = 1;

          if (secenek.agiz) {
            var kr = kareler(p.metin, p.dil);
            var n = 0;
            var sure = Math.max(55, 1000 / (u.rate * 13));
            if (durum.agiz) clearInterval(durum.agiz);
            durum.agiz = setInterval(function () {
              secenek.agiz(kr[n % kr.length]); n++;
            }, sure);
          }
          u.onend = function () { if (durum.agiz) clearInterval(durum.agiz); sonraki(); };
          u.onerror = function () { if (durum.agiz) clearInterval(durum.agiz); sonraki(); };
          try { speechSynthesis.speak(u); }
          catch (e) { sonraki(); }
        }
        sonraki();
      });
    },

    /* ───── tanıma ──────────────────────────────────────────── */
    dinle: function (secenek) {
      secenek = secenek || {};
      var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
      if (!SR) return Promise.reject({ kod: 'destek-yok' });
      return new Promise(function (coz, red) {
        var r = new SR();
        r.lang = secenek.dil === 'tr' ? 'tr-TR' : 'en-US';
        r.interimResults = true;
        r.continuous = false;
        r.maxAlternatives = 3;
        var sonuc = '', kismiSon = '';
        r.onresult = function (e) {
          var ara = '';
          for (var i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) sonuc += e.results[i][0].transcript + ' ';
            else ara += e.results[i][0].transcript;
          }
          kismiSon = (sonuc + ara).trim();
          if (secenek.kismi) secenek.kismi(kismiSon);
        };
        r.onerror = function (e) { red({ kod: e.error || 'hata' }); };
        r.onend = function () { coz((sonuc || kismiSon).trim()); };
        r.onstart = function () { if (secenek.basladi) secenek.basladi(r); };
        try { r.start(); } catch (e) { red({ kod: 'baslatilamadi' }); }
        if (secenek.durdurucu) secenek.durdurucu(function () { try { r.stop(); } catch (e) {} });
      });
    },

    /* ───── mikrofon seviyesi (dalga çubukları) ─────────────── */
    dalgaBaslat: function (kap, cubukSayi) {
      cubukSayi = cubukSayi || 28;
      kap.innerHTML = '';
      var cubuklar = [];
      for (var i = 0; i < cubukSayi; i++) {
        var b = document.createElement('i'); kap.appendChild(b); cubuklar.push(b);
      }
      var akis, ctx, analiz, raf, kapali = false;
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        if (kapali) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        akis = s;
        ctx = new (global.AudioContext || global.webkitAudioContext)();
        var kaynak = ctx.createMediaStreamSource(s);
        analiz = ctx.createAnalyser();
        analiz.fftSize = 128;
        kaynak.connect(analiz);
        var veri = new Uint8Array(analiz.frequencyBinCount);
        (function tik() {
          if (kapali) return;
          analiz.getByteFrequencyData(veri);
          for (var i = 0; i < cubuklar.length; i++) {
            var v = veri[Math.floor(i * veri.length / cubuklar.length)] || 0;
            cubuklar[i].style.height = Math.max(5, v / 255 * 36) + 'px';
          }
          raf = requestAnimationFrame(tik);
        })();
      }).catch(function () {});
      return function () {
        kapali = true;
        if (raf) cancelAnimationFrame(raf);
        if (akis) akis.getTracks().forEach(function (t) { t.stop(); });
        if (ctx) try { ctx.close(); } catch (e) {}
      };
    },

    /* ───── gölgeleme kaydı (iOS düşüşü) ───────────────────── */
    kayit: function () {
      if (!navigator.mediaDevices || !global.MediaRecorder) return Promise.reject('destek-yok');
      var tipler = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', ''];
      return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (akis) {
        var tip = tipler.find(function (t) { return !t || MediaRecorder.isTypeSupported(t); });
        var rec = new MediaRecorder(akis, tip ? { mimeType: tip } : undefined);
        var parcalar = [];
        rec.ondataavailable = function (e) { if (e.data.size) parcalar.push(e.data); };
        rec.start();
        return {
          durdur: function () {
            return new Promise(function (coz) {
              rec.onstop = function () {
                akis.getTracks().forEach(function (t) { t.stop(); });
                coz(new Blob(parcalar, { type: rec.mimeType || 'audio/webm' }));
              };
              try { rec.stop(); } catch (e) { coz(null); }
            });
          },
          iptal: function () {
            try { rec.stop(); } catch (e) {}
            akis.getTracks().forEach(function (t) { t.stop(); });
          }
        };
      });
    }
  };

  global.Ses = Ses;
})(window);
