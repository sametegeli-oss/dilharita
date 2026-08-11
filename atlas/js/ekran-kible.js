/* ═══════════════════════════════════════════════════════════════
   ATLAS · NAMAZ VAKİTLERİ ve KIBLE
   Eski projede kıblenamaz.html olarak duruyordu. Dil öğrenmeyle
   ilgisi yok ama kullanıcının uygulaması, aynen taşındı.

   Hesap tamamen yerel — internet gerekmez, konum hiçbir yere
   gönderilmez. Yöntem: güneş konumu (NOAA yaklaşımı) + seçilen
   fıkhî açılar. Kıble yönü büyük daire (great circle) yönüdür.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  var KABE = { lat: 21.4224779, lon: 39.6317013 };

  /* hesaplama yöntemleri — fıkhî açı farkları */
  var YONTEMLER = {
    diyanet: { ad: 'Diyanet (Türkiye)', fecr: 18, yatsi: 17, asir: 1 },
    mwl: { ad: 'Muslim World League', fecr: 18, yatsi: 17, asir: 1 },
    isna: { ad: 'ISNA (Kuzey Amerika)', fecr: 15, yatsi: 15, asir: 1 },
    egypt: { ad: 'Mısır Genel Otoritesi', fecr: 19.5, yatsi: 17.5, asir: 1 },
    makkah: { ad: 'Ümmü’l-Kurâ (Mekke)', fecr: 18.5, yatsi: 'ISHA90', asir: 1 },
    karachi: { ad: 'Karaçi', fecr: 18, yatsi: 18, asir: 1 },
    hanefi: { ad: 'Hanefî ikindi (gölge ×2)', fecr: 18, yatsi: 17, asir: 2 }
  };

  var D2R = Math.PI / 180, R2D = 180 / Math.PI;

  /* ── güneş konumu (Julian gün üzerinden) ── */
  function julian(d) {
    return d.getTime() / 86400000 + 2440587.5;
  }
  function gunesParam(jd) {
    var D = jd - 2451545.0;
    var g = (357.529 + 0.98560028 * D) % 360;              /* ortalama anomali */
    var q = (280.459 + 0.98564736 * D) % 360;              /* ortalama boylam */
    var L = (q + 1.915 * Math.sin(g * D2R) + 0.020 * Math.sin(2 * g * D2R)) % 360;
    var eps = 23.439 - 0.00000036 * D;                      /* eğiklik */
    var dec = Math.asin(Math.sin(eps * D2R) * Math.sin(L * D2R)) * R2D;
    var ra = Math.atan2(Math.cos(eps * D2R) * Math.sin(L * D2R), Math.cos(L * D2R)) * R2D / 15;
    if (ra < 0) ra += 24;
    var eqt = q / 15 - ra;                                  /* zaman denklemi (saat) */
    if (eqt > 12) eqt -= 24; if (eqt < -12) eqt += 24;
    return { dec: dec, eqt: eqt };
  }
  /* güneşin belirli bir yükseklikte olduğu saat açısı */
  function saatAcisi(aci, lat, dec) {
    var c = (Math.sin(aci * D2R) - Math.sin(lat * D2R) * Math.sin(dec * D2R)) /
      (Math.cos(lat * D2R) * Math.cos(dec * D2R));
    if (c > 1 || c < -1) return null;                       /* kutup bölgesi */
    return Math.acos(c) * R2D / 15;
  }

  function vakitler(tarih, lat, lon, yontem, dilim) {
    var y = YONTEMLER[yontem] || YONTEMLER.diyanet;
    var d0 = new Date(tarih.getFullYear(), tarih.getMonth(), tarih.getDate(), 12, 0, 0);
    var p = gunesParam(julian(d0));
    var oglenUTC = 12 - lon / 15 - p.eqt;

    function saatEkle(h) { return oglenUTC + h + dilim; }

    var gunesAci = -0.833;                                   /* kırılma + yarıçap */
    var hGunes = saatAcisi(gunesAci, lat, p.dec);
    var hFecr = saatAcisi(-y.fecr, lat, p.dec);
    var hYatsi = y.yatsi === 'ISHA90' ? null : saatAcisi(-y.yatsi, lat, p.dec);

    /* ikindi: gölge boyu = kat × cisim + öğle gölgesi */
    var oglenGolge = Math.abs(lat - p.dec);
    var asirAci = R2D * Math.atan(1 / (y.asir + Math.tan(oglenGolge * D2R)));
    var hAsir = saatAcisi(asirAci, lat, p.dec);

    var out = {
      imsak: hFecr === null ? null : saatEkle(-hFecr),
      gunes: hGunes === null ? null : saatEkle(-hGunes),
      ogle: saatEkle(0) + 1 / 60,                            /* zeval + 1 dk ihtiyat */
      ikindi: hAsir === null ? null : saatEkle(hAsir),
      aksam: hGunes === null ? null : saatEkle(hGunes),
      yatsi: null
    };
    out.yatsi = y.yatsi === 'ISHA90'
      ? (out.aksam === null ? null : out.aksam + 1.5)
      : (hYatsi === null ? null : saatEkle(hYatsi));
    return out;
  }

  function saatMetin(h) {
    if (h === null || h === undefined || !isFinite(h)) return '—';
    h = ((h % 24) + 24) % 24;
    var s = Math.floor(h), dk = Math.round((h - s) * 60);
    if (dk === 60) { dk = 0; s = (s + 1) % 24; }
    return String(s).padStart(2, '0') + ':' + String(dk).padStart(2, '0');
  }

  /* ── kıble yönü (büyük daire) ── */
  function kibleYonu(lat, lon) {
    var f1 = lat * D2R, f2 = KABE.lat * D2R;
    var dl = (KABE.lon - lon) * D2R;
    var y = Math.sin(dl);
    var x = Math.cos(f1) * Math.tan(f2) - Math.sin(f1) * Math.cos(dl);
    var b = Math.atan2(y, x) * R2D;
    return (b + 360) % 360;
  }
  function mesafe(lat, lon) {
    var f1 = lat * D2R, f2 = KABE.lat * D2R;
    var df = (KABE.lat - lat) * D2R, dl = (KABE.lon - lon) * D2R;
    var a = Math.sin(df / 2) * Math.sin(df / 2) +
      Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  var SEHIRLER = [
    { ad: 'İstanbul', lat: 41.0082, lon: 28.9784 }, { ad: 'Ankara', lat: 39.9334, lon: 32.8597 },
    { ad: 'İzmir', lat: 38.4237, lon: 27.1428 }, { ad: 'Bursa', lat: 40.1826, lon: 29.0665 },
    { ad: 'Antalya', lat: 36.8969, lon: 30.7133 }, { ad: 'Adana', lat: 37.0000, lon: 35.3213 },
    { ad: 'Konya', lat: 37.8746, lon: 32.4932 }, { ad: 'Gaziantep', lat: 37.0662, lon: 37.3833 },
    { ad: 'Trabzon', lat: 41.0027, lon: 39.7168 }, { ad: 'Erzurum', lat: 39.9000, lon: 41.2700 },
    { ad: 'Diyarbakır', lat: 37.9144, lon: 40.2306 }, { ad: 'Van', lat: 38.4891, lon: 43.4089 },
    { ad: 'Berlin', lat: 52.5200, lon: 13.4050 }, { ad: 'Londra', lat: 51.5074, lon: -0.1278 },
    { ad: 'Mekke', lat: 21.4225, lon: 39.6317 }, { ad: 'Medine', lat: 24.4686, lon: 39.6142 }
  ];

  var VAKIT_AD = [
    ['imsak', 'İmsak', '🌌'], ['gunes', 'Güneş', '🌅'], ['ogle', 'Öğle', '☀️'],
    ['ikindi', 'İkindi', '🌤️'], ['aksam', 'Akşam', '🌇'], ['yatsi', 'Yatsı', '🌙']
  ];

  Ekran.kible = function (g, arg) {
    var konum = Atlas.oku('konum', null) || { ad: 'İstanbul', lat: 41.0082, lon: 28.9784 };
    var yontem = Atlas.oku('namaz-yontem', 'diyanet');
    var dilim = -new Date().getTimezoneOffset() / 60;

    Uygulama.baslik(g, 'Namaz vakitleri ve kıble', konum.ad, '#/menu');

    /* ── konum ve yöntem ── */
    var ayarKart = e('div', { class: 'kart', style: 'margin-bottom:12px' });
    g.appendChild(ayarKart);
    cizAyar();

    var vakitKap = e('div');
    g.appendChild(vakitKap);
    var kibleKap = e('div');
    g.appendChild(kibleKap);
    var yillikKap = e('div');
    g.appendChild(yillikKap);

    cizVakit();
    cizKible();
    cizYillik();

    function cizAyar() {
      UI.bosalt(ayarKart);
      var sehirSec = e('select', 'alan');
      SEHIRLER.forEach(function (s) {
        sehirSec.appendChild(e('option', {
          value: s.ad, selected: s.ad === konum.ad ? '' : null
        }, s.ad));
      });
      sehirSec.onchange = function () {
        var s = SEHIRLER.find(function (x) { return x.ad === sehirSec.value; });
        if (s) { konum = s; Atlas.yaz('konum', s); yenile(); }
      };
      ayarKart.appendChild(e('label', { class: 'kucuk-yazi', style: 'display:block;margin-bottom:5px' }, 'Şehir'));
      ayarKart.appendChild(sehirSec);

      ayarKart.appendChild(e('button', {
        class: 'dg kucuk tam', style: 'margin-top:8px',
        onclick: function () {
          var d = this;
          if (!navigator.geolocation) { UI.bildir('Konum desteklenmiyor', 'bad'); return; }
          d.disabled = true; d.textContent = '⏳ Konum alınıyor…';
          navigator.geolocation.getCurrentPosition(function (p) {
            konum = { ad: 'Bulunduğun yer', lat: p.coords.latitude, lon: p.coords.longitude };
            Atlas.yaz('konum', konum);
            UI.bildir('Konum alındı', 'ok');
            yenile();
          }, function () {
            d.disabled = false; d.textContent = '📍 Konumumu kullan';
            UI.bildir('Konum alınamadı', 'bad');
          }, { timeout: 10000 });
        }
      }, '📍 Konumumu kullan'));

      var yontemSec = e('select', { class: 'alan', style: 'margin-top:8px' });
      Object.keys(YONTEMLER).forEach(function (k) {
        yontemSec.appendChild(e('option', {
          value: k, selected: k === yontem ? '' : null
        }, YONTEMLER[k].ad));
      });
      yontemSec.onchange = function () { yontem = yontemSec.value; Atlas.yaz('namaz-yontem', yontem); yenile(); };
      ayarKart.appendChild(e('label', { class: 'kucuk-yazi', style: 'display:block;margin:10px 0 5px' }, 'Hesaplama yöntemi'));
      ayarKart.appendChild(yontemSec);
      ayarKart.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-top:6px' },
        konum.lat.toFixed(4) + '° , ' + konum.lon.toFixed(4) + '° · UTC' + (dilim >= 0 ? '+' : '') + dilim));
    }

    function yenile() { cizAyar(); cizVakit(); cizKible(); cizYillik(); }

    /* ── bugünün vakitleri ── */
    function cizVakit() {
      UI.bosalt(vakitKap);
      var v = vakitler(new Date(), konum.lat, konum.lon, yontem, dilim);
      var simdi = new Date();
      var suanSaat = simdi.getHours() + simdi.getMinutes() / 60;

      /* sıradaki vakit */
      var sonraki = null, sonrakiAd = '';
      VAKIT_AD.forEach(function (x) {
        var h = v[x[0]];
        if (h !== null && h > suanSaat && sonraki === null) { sonraki = h; sonrakiAd = x[1]; }
      });
      if (sonraki === null) { sonraki = (v.imsak || 0) + 24; sonrakiAd = 'İmsak'; }
      var kalan = sonraki - suanSaat;
      var kalanSaat = Math.floor(kalan), kalanDk = Math.round((kalan - kalanSaat) * 60);

      vakitKap.appendChild(e('div', { class: 'kahraman', style: 'margin-bottom:12px' }, [
        e('div', 'satir', [
          e('div', { style: 'flex:1;min-width:180px' }, [
            e('h1', { style: 'font-size:clamp(20px,5vw,28px)' }, sonrakiAd + ' vaktine'),
            e('p', { style: 'margin:0' }, kalanSaat + ' saat ' + kalanDk + ' dakika kaldı')
          ]),
          e('div', { style: 'font-size:clamp(34px,9vw,52px);font-weight:850;letter-spacing:-.04em' },
            saatMetin(sonraki))
        ])
      ]));

      var l = e('div', { style: 'display:grid;gap:8px' });
      VAKIT_AD.forEach(function (x) {
        var h = v[x[0]];
        var gecti = h !== null && h < suanSaat;
        var aktif = x[1] === sonrakiAd;
        l.appendChild(e('div', {
          class: 'satir-kart',
          style: 'opacity:' + (gecti ? .5 : 1) + ';' + (aktif ? 'border-color:var(--brand);background:rgba(124,92,255,.1)' : '')
        }, [
          e('span', { style: 'font-size:20px;width:30px;flex:0 0 30px;text-align:center' }, x[2]),
          e('b', { style: 'flex:1;font-size:15px;font-weight:700' }, x[1]),
          e('span', {
            style: 'font-size:17px;font-weight:800;letter-spacing:-.02em;font-family:var(--mono)'
          }, saatMetin(h))
        ]));
      });
      vakitKap.appendChild(l);
    }

    /* ── kıble pusulası ── */
    function cizKible() {
      UI.bosalt(kibleKap);
      var yon = kibleYonu(konum.lat, konum.lon);
      var uzaklik = mesafe(konum.lat, konum.lon);

      kibleKap.appendChild(e('div', 'bolum-ad', 'Kıble'));
      var kart = e('div', { class: 'kart', style: 'text-align:center' });

      var boy = 220;
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + boy + ' ' + boy);
      svg.setAttribute('style', 'width:100%;max-width:230px;margin:0 auto;display:block');

      var mrk = boy / 2, r = boy / 2 - 22;
      function daire(rr, sinif) {
        var c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', mrk); c.setAttribute('cy', mrk); c.setAttribute('r', rr);
        c.setAttribute('fill', 'none');
        c.setAttribute('stroke', sinif === 'ic' ? 'var(--line)' : 'var(--line-2)');
        c.setAttribute('stroke-width', '1');
        return c;
      }
      svg.appendChild(daire(r));
      svg.appendChild(daire(r * 0.66, 'ic'));
      svg.appendChild(daire(r * 0.33, 'ic'));

      /* yön harfleri */
      [['K', 0], ['D', 90], ['G', 180], ['B', 270]].forEach(function (o) {
        var a = (o[1] - 90) * D2R;
        var t = document.createElementNS(ns, 'text');
        t.setAttribute('x', mrk + Math.cos(a) * (r + 12));
        t.setAttribute('y', mrk + Math.sin(a) * (r + 12));
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('dominant-baseline', 'middle');
        t.setAttribute('fill', 'var(--ink-3)');
        t.setAttribute('style', 'font-size:12px;font-weight:800');
        t.textContent = o[0];
        svg.appendChild(t);
      });

      /* kıble oku */
      var grup = document.createElementNS(ns, 'g');
      grup.setAttribute('id', 'kible-ok');
      grup.setAttribute('style', 'transition:transform .5s var(--ez);transform-origin:' + mrk + 'px ' + mrk + 'px');
      grup.setAttribute('transform', 'rotate(' + yon + ' ' + mrk + ' ' + mrk + ')');
      var ok = document.createElementNS(ns, 'path');
      ok.setAttribute('d', 'M' + mrk + ' ' + (mrk - r + 6) +
        ' L' + (mrk + 11) + ' ' + (mrk + 16) +
        ' L' + mrk + ' ' + (mrk + 6) +
        ' L' + (mrk - 11) + ' ' + (mrk + 16) + ' Z');
      ok.setAttribute('fill', 'var(--brand)');
      grup.appendChild(ok);
      var kabe = document.createElementNS(ns, 'text');
      kabe.setAttribute('x', mrk); kabe.setAttribute('y', mrk - r + 2);
      kabe.setAttribute('text-anchor', 'middle');
      kabe.setAttribute('style', 'font-size:15px');
      kabe.textContent = '🕋';
      grup.appendChild(kabe);
      svg.appendChild(grup);

      var merkez = document.createElementNS(ns, 'circle');
      merkez.setAttribute('cx', mrk); merkez.setAttribute('cy', mrk); merkez.setAttribute('r', '4');
      merkez.setAttribute('fill', 'var(--ink-3)');
      svg.appendChild(merkez);

      kart.appendChild(svg);
      kart.appendChild(e('div', { class: 'izgara iz-3', style: 'margin-top:12px' }, [
        UI.ist(yon.toFixed(1) + '°', 'kuzeyden'),
        UI.ist(Math.round(uzaklik).toLocaleString('tr-TR'), 'km'),
        UI.ist(yonAdi(yon), 'yön')
      ]));

      /* cihaz pusulası */
      var pusulaDurum = e('div', { class: 'kucuk-yazi', style: 'margin-top:10px' },
        'Ok, coğrafi kuzeye göre kıble yönünü gösteriyor. Telefonunu döndürerek hizalamak için pusulayı aç.');
      kart.appendChild(pusulaDurum);
      kart.appendChild(e('button', {
        class: 'dg kucuk tam', style: 'margin-top:8px',
        onclick: function () { pusulaAc(grup, yon, pusulaDurum, mrk); }
      }, '🧭 Cihaz pusulasını kullan'));

      kibleKap.appendChild(kart);
    }

    function yonAdi(a) {
      var adlar = ['Kuzey', 'KKD', 'Kuzeydoğu', 'DKD', 'Doğu', 'DGD', 'Güneydoğu', 'GGD',
        'Güney', 'GGB', 'Güneybatı', 'BGB', 'Batı', 'BKB', 'Kuzeybatı', 'KKB'];
      return adlar[Math.round(a / 22.5) % 16];
    }

    function pusulaAc(grup, kible, durumEl, mrk) {
      function dinle() {
        addEventListener('deviceorientationabsolute', tepki, true);
        addEventListener('deviceorientation', tepki, true);
        durumEl.textContent = 'Pusula açık — telefonu düz tut, ok Kâbe’yi gösterene kadar döndür.';
        if (global.Uygulama) Uygulama.temizlemeEkle(function () {
          removeEventListener('deviceorientationabsolute', tepki, true);
          removeEventListener('deviceorientation', tepki, true);
        });
      }
      function tepki(ev) {
        var yon = ev.webkitCompassHeading !== undefined
          ? ev.webkitCompassHeading
          : (ev.alpha !== null ? 360 - ev.alpha : null);
        if (yon === null) return;
        grup.setAttribute('transform', 'rotate(' + (kible - yon) + ' ' + mrk + ' ' + mrk + ')');
      }
      if (global.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(function (d) {
          if (d === 'granted') dinle();
          else durumEl.textContent = 'Pusula izni verilmedi.';
        }).catch(function () { durumEl.textContent = 'Pusula açılamadı.'; });
      } else if (global.DeviceOrientationEvent) dinle();
      else durumEl.textContent = 'Bu cihazda pusula sensörü yok.';
    }

    /* ── yıllık tablo ── */
    function cizYillik() {
      UI.bosalt(yillikKap);
      yillikKap.appendChild(e('div', 'bolum-ad', 'Yıllık hesaplama'));
      var kart = e('div', 'kart');
      kart.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin:0 0 10px' },
        'Seçili şehir ve yöntem için tüm yılın vakitleri yerel olarak hesaplanır. ' +
        'CSV olarak indirip takvim uygulamana veya yazıcıya alabilirsin.'));
      kart.appendChild(e('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [
        e('button', { class: 'dg kucuk', style: 'flex:1', onclick: function () { ayGoster(); } }, '📅 Bu ay'),
        e('button', { class: 'dg kucuk', style: 'flex:1', onclick: function () { csvIndir(); } }, '⬇️ Yıllık CSV')
      ]));
      yillikKap.appendChild(kart);
    }

    function ayGoster() {
      var simdi = new Date();
      var yil = simdi.getFullYear(), ay = simdi.getMonth();
      var gunSayisi = new Date(yil, ay + 1, 0).getDate();
      var tablo = e('div', { style: 'display:grid;gap:4px;font-size:12px' });
      tablo.appendChild(e('div', {
        style: 'display:grid;grid-template-columns:34px repeat(6,1fr);gap:4px;font-weight:800;color:var(--ink-3);font-size:10.5px'
      }, ['Gün'].concat(VAKIT_AD.map(function (x) { return x[1]; })).map(function (t) { return e('span', null, t); })));
      for (var d = 1; d <= gunSayisi; d++) {
        var v = vakitler(new Date(yil, ay, d), konum.lat, konum.lon, yontem, dilim);
        var bugunMu = d === simdi.getDate();
        tablo.appendChild(e('div', {
          style: 'display:grid;grid-template-columns:34px repeat(6,1fr);gap:4px;padding:5px 0;' +
            'border-bottom:1px solid var(--line);font-family:var(--mono);' +
            (bugunMu ? 'background:rgba(124,92,255,.14);border-radius:6px' : '')
        }, [e('span', { style: 'font-weight:800' }, String(d))].concat(
          VAKIT_AD.map(function (x) { return e('span', null, saatMetin(v[x[0]])); })
        )));
      }
      UI.pencere(tablo, {
        baslik: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz',
          'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][ay] + ' ' + yil,
        alt: konum.ad + ' · ' + YONTEMLER[yontem].ad
      });
    }

    function csvIndir() {
      var yil = new Date().getFullYear();
      var satirlar = ['tarih;imsak;gunes;ogle;ikindi;aksam;yatsi'];
      var d = new Date(yil, 0, 1);
      while (d.getFullYear() === yil) {
        var v = vakitler(d, konum.lat, konum.lon, yontem, dilim);
        satirlar.push([
          d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
          saatMetin(v.imsak), saatMetin(v.gunes), saatMetin(v.ogle),
          saatMetin(v.ikindi), saatMetin(v.aksam), saatMetin(v.yatsi)
        ].join(';'));
        d.setDate(d.getDate() + 1);
      }
      var b = new Blob(['﻿' + satirlar.join('\n')], { type: 'text/csv;charset=utf-8' });
      var a = e('a', {
        href: URL.createObjectURL(b),
        download: 'namaz-vakitleri-' + konum.ad.toLowerCase().replace(/\s/g, '-') + '-' + yil + '.csv'
      });
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      UI.bildir(yil + ' yılı vakitleri indiriliyor', 'ok');
    }
  };

  global.Namaz = { vakitler: vakitler, kibleYonu: kibleYonu, mesafe: mesafe, saatMetin: saatMetin, YONTEMLER: YONTEMLER };
})(window);
