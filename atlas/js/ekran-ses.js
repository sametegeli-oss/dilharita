/* ═══════════════════════════════════════════════════════════════
   ATLAS · SES EKRANLARI
   Akustik artikülasyon · video pratik (YouGlish) · ses teşhis
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  /* ═══════════════════════════════════════════════════════════
     AKUSTİK ARTİKÜLASYON
     Üç görselleştirme aynı mikrofon akışından besleniyor:
       dalga     — zaman ekseni, ritim ve vurgu burada görünür
       spektrum  — frekans dağılımı, tizlik/pesletme
       formant   — F1/F2 tahmini; ünlü sesin ağızdaki yeri
     Formant tahmini kaba: spektrumdaki ilk iki belirgin tepe.
     Laboratuvar ölçümü değil; amaç öğrencinin ağzını GÖRMESİ.
     ═══════════════════════════════════════════════════════════ */

  /* İngilizce ünlülerin yaklaşık F1/F2 değerleri (Hz, erkek ortalaması) */
  var UNLULER = [
    { s: 'iː', ad: 'see', f1: 280, f2: 2250 },
    { s: 'ɪ', ad: 'sit', f1: 400, f2: 1920 },
    { s: 'e', ad: 'bed', f1: 550, f2: 1770 },
    { s: 'æ', ad: 'cat', f1: 690, f2: 1660 },
    { s: 'ɑː', ad: 'car', f1: 710, f2: 1100 },
    { s: 'ɒ', ad: 'hot', f1: 590, f2: 880 },
    { s: 'ɔː', ad: 'saw', f1: 450, f2: 740 },
    { s: 'ʊ', ad: 'put', f1: 380, f2: 950 },
    { s: 'uː', ad: 'too', f1: 310, f2: 870 },
    { s: 'ʌ', ad: 'cup', f1: 640, f2: 1190 },
    { s: 'ɜː', ad: 'bird', f1: 490, f2: 1350 },
    { s: 'ə', ad: 'about', f1: 500, f2: 1500 }
  ];

  Ekran.akustik = function (g) {
    Uygulama.baslik(g, 'Akustik artikülasyon', 'Sesini gör — dalga, spektrum, ağız pozisyonu', '#/menu');

    if (!navigator.mediaDevices || !(global.AudioContext || global.webkitAudioContext)) {
      g.appendChild(UI.bos('🎤', 'Bu tarayıcı desteklemiyor',
        'Mikrofon ve Web Audio API gerekiyor. Chrome, Edge veya Safari’nin güncel sürümünü dene.'));
      return;
    }

    /* hedef cümle */
    var hedef = { en: 'The quick brown fox jumps over the lazy dog.', ipa: '' };
    var hedefKart = e('div', { class: 'kart parlak', style: 'margin-bottom:12px' });
    g.appendChild(hedefKart);
    hedefCiz();

    function hedefCiz() {
      UI.bosalt(hedefKart);
      hedefKart.appendChild(e('div', { style: 'display:flex;align-items:center;gap:10px' }, [
        e('div', { style: 'flex:1;min-width:0' }, [
          e('b', { style: 'display:block;font-size:15.5px;font-weight:750;line-height:1.4' }, hedef.en),
          hedef.ipa ? e('div', 'ipa', hedef.ipa) : null
        ]),
        e('button', { class: 'dg kucuk', onclick: function () { Ses.konus(hedef.en, { baglam: 'en' }); } }, '🔊')
      ]));
      hedefKart.appendChild(e('div', { style: 'display:flex;gap:8px;margin-top:10px' }, [
        e('button', { class: 'dg kucuk', style: 'flex:1', onclick: cumleSec }, '↻ Başka cümle'),
        e('button', { class: 'dg kucuk', style: 'flex:1', onclick: kendiCumlesi }, '✍️ Kendi cümlem')
      ]));
    }
    function cumleSec() {
      Veri.ornekler().then(function (ex) {
        var c = ex[Math.floor(Math.random() * ex.length)];
        hedef = { en: c.en, ipa: '' }; hedefCiz();
      });
    }
    function kendiCumlesi() {
      var alan = e('input', { class: 'alan', value: hedef.en });
      UI.pencere(e('div', null, [alan, e('button', {
        class: 'dg ana tam', style: 'margin-top:10px',
        onclick: function () { hedef = { en: alan.value.trim() || hedef.en, ipa: '' }; UI.pencereKapat(); hedefCiz(); }
      }, 'Kaydet')]), { baslik: 'Çalışılacak cümle', dugmesiz: true });
    }

    /* tuvaller */
    var dalgaT = e('canvas', { height: 130 });
    var spektrumT = e('canvas', { height: 130 });
    var formantT = e('canvas', { height: 240 });
    g.appendChild(e('div', { class: 'tuval-kart', style: 'margin-bottom:10px' },
      [e('span', 'tuval-ad', 'Dalga · ritim ve vurgu'), dalgaT]));
    g.appendChild(e('div', { class: 'tuval-kart', style: 'margin-bottom:10px' },
      [e('span', 'tuval-ad', 'Spektrum · frekans dağılımı'), spektrumT]));
    g.appendChild(e('div', { class: 'tuval-kart', style: 'margin-bottom:12px' },
      [e('span', 'tuval-ad', 'Ünlü haritası · F1 / F2'), formantT]));

    var olcum = e('div', { class: 'izgara iz-3', style: 'margin-bottom:12px' });
    g.appendChild(olcum);
    var enYakinEl = e('div', { class: 'kart', style: 'margin-bottom:12px;text-align:center' },
      [e('p', { class: 'kucuk-yazi', style: 'margin:0' }, 'Konuşmaya başlayınca çıkardığın ünlüyü tahmin edeceğim.')]);
    g.appendChild(enYakinEl);

    var mikDugme = e('button', { class: 'dg ana tam' }, '🎙️  Mikrofonu aç');
    g.appendChild(mikDugme);
    g.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin-top:12px;line-height:1.7' },
      'Formant tahmini kaba bir hesap: spektrumdaki ilk iki belirgin tepe alınıyor. ' +
      'Laboratuvar ölçümü değil — amacı, ağzının nerede olduğunu görebilmen. ' +
      'F1 ağız açıklığıyla (yüksek F1 = açık ağız), F2 dilin öne/geriye konumuyla ilgilidir.'));

    var akis = null, ctx = null, analiz = null, raf = null;

    mikDugme.onclick = function () { if (akis) durdur(); else basla(); };
    Uygulama.temizlemeEkle(function () { durdur(); });

    function basla() {
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } })
        .then(function (s) {
          akis = s;
          ctx = new (global.AudioContext || global.webkitAudioContext)();
          var kaynak = ctx.createMediaStreamSource(s);
          analiz = ctx.createAnalyser();
          analiz.fftSize = 4096;
          analiz.smoothingTimeConstant = 0.6;
          kaynak.connect(analiz);
          mikDugme.textContent = '⏹  Durdur';
          mikDugme.classList.remove('ana');
          ciz();
        })
        .catch(function () { UI.bildir('Mikrofona erişilemedi', 'bad'); });
    }

    function durdur() {
      if (raf) cancelAnimationFrame(raf);
      if (akis) akis.getTracks().forEach(function (t) { t.stop(); });
      if (ctx) try { ctx.close(); } catch (x) {}
      akis = null; ctx = null; analiz = null; raf = null;
      mikDugme.textContent = '🎙️  Mikrofonu aç';
      mikDugme.classList.add('ana');
    }

    function tuvalKur(c) {
      var o = Math.min(2, devicePixelRatio || 1);
      var g2 = c.getContext('2d');
      if (c.width !== c.clientWidth * o) {
        c.width = c.clientWidth * o;
        c.height = parseInt(c.getAttribute('height'), 10) * o;
      }
      g2.setTransform(o, 0, 0, o, 0, 0);
      return g2;
    }
    function renk(ad) {
      return getComputedStyle(document.documentElement).getPropertyValue(ad).trim() || '#7c5cff';
    }

    function ciz() {
      if (!analiz) return;
      var zaman = new Uint8Array(analiz.fftSize);
      var frekans = new Uint8Array(analiz.frequencyBinCount);
      analiz.getByteTimeDomainData(zaman);
      analiz.getByteFrequencyData(frekans);

      /* — dalga — */
      var g1 = tuvalKur(dalgaT), w1 = dalgaT.clientWidth, h1 = dalgaT.height / (Math.min(2, devicePixelRatio || 1));
      g1.clearRect(0, 0, w1, h1);
      g1.lineWidth = 2; g1.strokeStyle = renk('--brand-2'); g1.beginPath();
      for (var i = 0; i < zaman.length; i += 4) {
        var x = i / zaman.length * w1, y = (zaman[i] / 128 - 1) * (h1 / 2 * 0.9) + h1 / 2;
        i ? g1.lineTo(x, y) : g1.moveTo(x, y);
      }
      g1.stroke();

      /* — spektrum — */
      var g2 = tuvalKur(spektrumT), w2 = spektrumT.clientWidth, h2 = spektrumT.height / (Math.min(2, devicePixelRatio || 1));
      g2.clearRect(0, 0, w2, h2);
      var gorunur = Math.floor(frekans.length * 0.22);   /* ~0–5 kHz konuşma bandı */
      var bw = w2 / gorunur;
      for (var j = 0; j < gorunur; j++) {
        var v = frekans[j] / 255;
        var gr = g2.createLinearGradient(0, h2, 0, h2 - v * h2);
        gr.addColorStop(0, renk('--brand'));
        gr.addColorStop(1, renk('--brand-3'));
        g2.fillStyle = gr;
        g2.fillRect(j * bw, h2 - v * h2, Math.max(1, bw - 0.5), v * h2);
      }

      /* — formant — */
      var oran = ctx.sampleRate / analiz.fftSize;
      var tepeler = tepeBul(frekans, oran);
      var g3 = tuvalKur(formantT), w3 = formantT.clientWidth, h3 = formantT.height / (Math.min(2, devicePixelRatio || 1));
      g3.clearRect(0, 0, w3, h3);
      var pad = 34;
      /* eksen: x = F2 (2600→600, ters), y = F1 (200→800) */
      function px(f2) { return pad + (2600 - Math.max(600, Math.min(2600, f2))) / 2000 * (w3 - pad * 2); }
      function py(f1) { return pad + (Math.max(200, Math.min(800, f1)) - 200) / 600 * (h3 - pad * 2); }
      g3.strokeStyle = renk('--line'); g3.lineWidth = 1;
      g3.strokeRect(pad, pad, w3 - pad * 2, h3 - pad * 2);
      g3.font = '10px system-ui'; g3.fillStyle = renk('--ink-3');
      g3.fillText('ön ←  F2  → arka', pad, pad - 12);
      g3.save(); g3.translate(12, h3 / 2); g3.rotate(-Math.PI / 2);
      g3.fillText('kapalı ←  F1  → açık', -40, 0); g3.restore();

      UNLULER.forEach(function (u) {
        var x = px(u.f2), y = py(u.f1);
        g3.fillStyle = renk('--ink-3');
        g3.font = '13px system-ui';
        g3.fillText(u.s, x - 4, y + 4);
        g3.font = '9px system-ui';
        g3.fillStyle = renk('--line-2');
        g3.fillText(u.ad, x - 8, y + 15);
      });

      var seviye = 0;
      for (var k = 0; k < frekans.length; k++) seviye += frekans[k];
      seviye = seviye / frekans.length;

      if (tepeler.f1 && tepeler.f2 && seviye > 18) {
        var cx = px(tepeler.f2), cy = py(tepeler.f1);
        g3.beginPath(); g3.arc(cx, cy, 11, 0, 6.284);
        g3.fillStyle = renk('--brand'); g3.globalAlpha = 0.85; g3.fill();
        g3.globalAlpha = 1;
        g3.beginPath(); g3.arc(cx, cy, 18, 0, 6.284);
        g3.strokeStyle = renk('--brand'); g3.lineWidth = 2; g3.stroke();

        var yakin = enYakinUnlu(tepeler.f1, tepeler.f2);
        UI.bosalt(enYakinEl);
        enYakinEl.appendChild(e('div', { style: 'display:flex;align-items:center;gap:14px;justify-content:center' }, [
          e('div', { style: 'font-size:34px;font-weight:800;color:var(--brand-2)' }, yakin.s),
          e('div', { style: 'text-align:left' }, [
            e('b', { style: 'display:block;font-size:15px' }, 'as in "' + yakin.ad + '"'),
            e('span', 'kucuk-yazi', 'F1 ' + Math.round(tepeler.f1) + ' Hz · F2 ' + Math.round(tepeler.f2) + ' Hz')
          ])
        ]));
        UI.bosalt(olcum);
        olcum.appendChild(UI.ist(Math.round(tepeler.f1), 'F1 Hz'));
        olcum.appendChild(UI.ist(Math.round(tepeler.f2), 'F2 Hz'));
        olcum.appendChild(UI.ist(Math.round(seviye), 'seviye'));
      }

      raf = requestAnimationFrame(ciz);
    }

    /* spektrumda ilk iki belirgin tepe */
    function tepeBul(frekans, oran) {
      var altSinir = Math.floor(180 / oran), ustSinir = Math.floor(3200 / oran);
      var tepe = [];
      for (var i = altSinir + 2; i < ustSinir - 2; i++) {
        var v = frekans[i];
        if (v < 60) continue;
        if (v >= frekans[i - 1] && v >= frekans[i + 1] && v > frekans[i - 2] && v > frekans[i + 2]) {
          tepe.push({ f: i * oran, v: v });
          i += 3;
        }
      }
      tepe.sort(function (a, b) { return b.v - a.v; });
      var ilk = tepe.slice(0, 6).sort(function (a, b) { return a.f - b.f; });
      var f1 = ilk[0] && ilk[0].f;
      var f2 = null;
      for (var j = 1; j < ilk.length; j++) {
        if (ilk[j].f > (f1 || 0) * 1.35) { f2 = ilk[j].f; break; }
      }
      return { f1: f1, f2: f2 };
    }

    function enYakinUnlu(f1, f2) {
      var en = UNLULER[0], min = Infinity;
      UNLULER.forEach(function (u) {
        var d = Math.pow((u.f1 - f1) / 300, 2) + Math.pow((u.f2 - f2) / 800, 2);
        if (d < min) { min = d; en = u; }
      });
      return en;
    }
  };

  /* ═══════════════════════════════════════════════════════════
     VİDEO PRATİK — YouGlish
     Bir kelimenin gerçek konuşmada nasıl söylendiğini gösterir.
     ═══════════════════════════════════════════════════════════ */
  Ekran.video = function (g, arg) {
    Uygulama.baslik(g, 'Video pratik', 'Bir kelimeyi gerçek konuşmalarda duy', '#/menu');

    var kelime = arg[0] ? decodeURIComponent(arg[0]) : (Atlas.oku('video-son', '') || 'because');
    var aksan = Atlas.oku('video-aksan', 'us');

    var arama = e('input', { class: 'alan', value: kelime, placeholder: 'Kelime veya kısa ifade' });
    g.appendChild(e('div', { class: 'kart parlak', style: 'margin-bottom:12px' }, [
      arama,
      e('div', { class: 'seviye-serit', style: 'margin-top:10px;padding-bottom:0' }, [
        aksanDugme('us', '🇺🇸 Amerikan'),
        aksanDugme('uk', '🇬🇧 İngiliz'),
        aksanDugme('aus', '🇦🇺 Avustralya'),
        aksanDugme('all', '🌍 Hepsi')
      ]),
      e('button', {
        class: 'dg ana tam', style: 'margin-top:10px',
        onclick: function () { kelime = arama.value.trim() || kelime; Atlas.yaz('video-son', kelime); goster(); }
      }, '▶️ Videoları getir')
    ]));

    function aksanDugme(kod, ad) {
      return e('button', {
        class: aksan === kod ? 'aktif' : '',
        onclick: function () {
          aksan = kod; Atlas.yaz('video-aksan', kod);
          UI.qq('.seviye-serit button', g).forEach(function (b) { b.classList.remove('aktif'); });
          this.classList.add('aktif');
          goster();
        }
      }, ad);
    }

    var cerceve = e('div', { style: 'margin-bottom:12px' });
    g.appendChild(cerceve);
    goster();

    function goster() {
      UI.bosalt(cerceve);
      var kap = e('div', {
        style: 'position:relative;width:100%;padding-top:62%;border-radius:var(--r-l);overflow:hidden;' +
          'border:1px solid var(--line-2);background:#000'
      });
      var iframe = e('iframe', {
        src: 'https://youglish.com/pronounce/' + encodeURIComponent(kelime) + '/english/' + aksan + '?',
        style: 'position:absolute;inset:0;width:100%;height:100%;border:0',
        allow: 'autoplay; encrypted-media',
        loading: 'lazy',
        title: 'YouGlish · ' + kelime
      });
      kap.appendChild(iframe);
      cerceve.appendChild(kap);
      cerceve.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin-top:10px' },
        'YouGlish, kelimenin geçtiği YouTube anlarını arka arkaya oynatır. ' +
        'Aynı kelimeyi 5–10 farklı ağızdan duymak, tek bir doğru telaffuz ezberlemekten daha işe yarar. ' +
        'Video yüklenmiyorsa tarayıcın üçüncü taraf çerçeveleri engelliyor olabilir.'));
    }

    /* çalıştığın zor kelimeler */
    var zorlar = Mastery.zayifOgeler('akicilik', 8)
      .map(function (z) { return z.oge.replace(/^k:/, ''); })
      .filter(function (x) { return /^[a-z' ]+$/i.test(x); });
    if (zorlar.length) {
      g.appendChild(e('div', 'bolum-ad', 'Telaffuzda zorlandıkların'));
      var kap2 = e('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' });
      zorlar.forEach(function (w) {
        kap2.appendChild(e('button', {
          class: 'cip', onclick: function () { arama.value = w; kelime = w; goster(); scrollTo({ top: 0, behavior: 'smooth' }); }
        }, w));
      });
      g.appendChild(kap2);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     SES TEŞHİS — hangi ses nerede çalışıyor
     ═══════════════════════════════════════════════════════════ */
  Ekran['ses-teshis'] = function (g) {
    Uygulama.baslik(g, 'Ses teşhis', 'Cihazında hangi ses ne yapıyor', '#/ayarlar');

    var d = Ses.destek();
    g.appendChild(e('div', { class: 'kart parlak', style: 'margin-bottom:14px' }, [
      e('div', { class: 'izgara iz-3' }, [
        UI.ist(d.tts ? '✓' : '✕', 'seslendirme', d.tts ? 'var(--ok)' : 'var(--bad)'),
        UI.ist(d.stt ? '✓' : '✕', 'ses tanıma', d.stt ? 'var(--ok)' : 'var(--bad)'),
        UI.ist(d.kayit ? '✓' : '✕', 'kayıt', d.kayit ? 'var(--ok)' : 'var(--bad)')
      ]),
      !d.stt ? e('p', { class: 'kucuk-yazi', style: 'margin:12px 0 0' },
        'Ses tanıma yok (iOS Safari böyledir). Telaffuz alıştırmaları yazı kutusuna düşmez; ' +
        'gölgeleme kipi devreye girer: dinle → kendini kaydet → karşılaştır → değerlendir.') : null
    ]));

    /* deneme metni */
    var deneme = e('input', {
      class: 'alan', style: 'margin-bottom:12px',
      value: 'Merhaba, bu bir deneme. [[This is an English test sentence.]]'
    });
    g.appendChild(e('div', 'bolum-ad', 'Deneme metni'));
    g.appendChild(deneme);
    g.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin:6px 0 14px' },
      '[[ ]] içine aldığın kısım İngilizce sesle okunur, gerisi Türkçe sesle. ' +
      'Motorun dili nasıl ayırdığını burada test edebilirsin.'));

    /* ses listesi */
    var liste = e('div', { style: 'display:grid;gap:8px' });
    g.appendChild(e('div', 'bolum-ad', 'Cihazındaki sesler'));
    g.appendChild(liste);
    doldur();
    setTimeout(doldur, 800);

    function doldur() {
      var sesler = Ses.sesListesi();
      UI.bosalt(liste);
      if (!sesler.length) {
        liste.appendChild(e('p', 'kucuk-yazi', 'Ses listesi henüz yüklenmedi. Sayfayı yenilemeyi dene.'));
        return;
      }
      var a = Atlas.Ayar.al();
      var ilgili = sesler.filter(function (v) {
        var l = (v.lang || '').toLowerCase();
        return l.indexOf('tr') === 0 || l.indexOf('en') === 0;
      });
      (ilgili.length ? ilgili : sesler).forEach(function (v) {
        var dil = (v.lang || '').toLowerCase().indexOf('tr') === 0 ? 'tr' : 'en';
        var secili = (dil === 'en' ? a.sesEn : a.sesTr) === v.name;
        liste.appendChild(e('div', {
          class: 'satir-kart', style: secili ? 'border-color:var(--brand)' : ''
        }, [
          e('span', { style: 'flex:1;min-width:0' }, [
            e('b', { style: 'display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, v.name),
            e('span', 'kucuk-yazi', v.lang + (v.localService ? ' · cihazda' : ' · ağdan') +
              (/natural|neural|premium|enhanced/i.test(v.name) ? ' · gelişmiş' : ''))
          ]),
          e('button', {
            class: 'dg kucuk',
            onclick: function () {
              var u = new SpeechSynthesisUtterance(
                dil === 'tr' ? 'Merhaba, ben bu sesim.' : 'Hello, this is my voice.');
              u.voice = v; u.lang = v.lang; u.rate = a.sesHiz;
              speechSynthesis.cancel(); speechSynthesis.speak(u);
            }
          }, '🔊'),
          e('button', {
            class: 'dg kucuk ' + (secili ? 'iyi' : ''),
            onclick: function () {
              var y = {}; y[dil === 'en' ? 'sesEn' : 'sesTr'] = v.name;
              Atlas.Ayar.kur(y);
              Uygulama.yonlendir();
            }
          }, secili ? '✓' : 'Seç')
        ]));
      });
    }

    g.appendChild(e('button', {
      class: 'dg ana tam', style: 'margin-top:14px',
      onclick: function () {
        var av = UI.avatar(0);
        Ses.konus(deneme.value, { baglam: 'tr' });
      }
    }, '▶️ Deneme metnini oku'));

    /* ağız haritası önizlemesi */
    g.appendChild(e('div', 'bolum-ad', 'Ağız haritası'));
    var av = UI.avatar(120);
    av.style.margin = '0 auto 12px';
    g.appendChild(av);
    var kareBilgi = e('div', { class: 'kucuk-yazi', style: 'text-align:center;min-height:20px;margin-bottom:10px' });
    g.appendChild(kareBilgi);
    g.appendChild(e('div', { style: 'display:flex;gap:8px' }, [
      e('button', {
        class: 'dg', style: 'flex:1',
        onclick: function () { kareOynat('Şu anda Türkçe okuyorum, ağzım Türkçe haritasını kullanıyor.', 'tr'); }
      }, 'Türkçe ağız'),
      e('button', {
        class: 'dg', style: 'flex:1',
        onclick: function () { kareOynat('This is the English mouth map with th and round r.', 'en'); }
      }, 'İngilizce ağız')
    ]));
    g.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin-top:10px;line-height:1.7' },
      'İki dilin ağzı gerçekten farklı: İngilizcede r yuvarlaktır, Türkçede nötr; ' +
      'ö ve ü İngilizcede yoktur; ğ ağzı değiştirmez, ünlüyü uzatır; ' +
      'th İngilizceye özgü ayrı bir şekildir; kelime sonundaki e İngilizcede okunmaz, ağız açılmaz.'));

    function kareOynat(metin, dil) {
      av.konusuyor(true);
      var kareler = Ses.kareler(metin, dil);
      kareBilgi.textContent = kareler.length + ' ağız karesi · ' + kareler.slice(0, 12).join(' → ');
      Ses.konus(metin, {
        baglam: dil,
        agiz: function (k) { av.agiz(k); },
        bitti: function () { av.konusuyor(false); }
      });
    }
  };
})(window);
