/* ═══════════════════════════════════════════════════════════════
   ATLAS · UYGULAMA KABUĞU
   Tek sayfa, hash yönlendirme. Her ekran window.Ekran'a kaydolur.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e, q = UI.q;

  var Ekran = {};
  global.Ekran = Ekran;

  var GEZINME = [
    { yol: '#/', ikon: '🏠', ad: 'Bugün' },
    { yol: '#/ogren', ikon: '🗺️', ad: 'Öğren' },
    { yol: '#/tekrar', ikon: '🔁', ad: 'Tekrar' },
    { yol: '#/kelime', ikon: '🔤', ad: 'Kelime' },
    { yol: '#/sohbet', ikon: '💬', ad: 'Konuş' },
    { yol: '#/ilerleme', ikon: '📈', ad: 'İlerleme' },
    { yol: '#/menu', ikon: '⋯', ad: 'Tümü' }
  ];

  var Uygulama = {
    govde: null,
    suanki: '',
    temizleyiciler: [],

    /* ekran değişirken açık kalan zamanlayıcı/akış kapatılır */
    temizlemeEkle: function (fn) { Uygulama.temizleyiciler.push(fn); },
    temizle: function () {
      Uygulama.temizleyiciler.forEach(function (f) { try { f(); } catch (e) {} });
      Uygulama.temizleyiciler = [];
      Ses.dur();
      UI.balonKapat();
      UI.pencereKapat();
    },

    git: function (yol) { location.hash = yol; },

    yonlendir: function () {
      var h = (location.hash || '#/').replace(/^#/, '');
      var parca = h.split('/').filter(Boolean);
      var ad = parca[0] || 'ev';
      var arg = parca.slice(1).map(decodeURIComponent);

      Uygulama.temizle();
      var kur = Ekran[ad];
      if (!kur) { kur = Ekran.ev; ad = 'ev'; arg = []; }

      var g = Uygulama.govde;
      UI.bosalt(g);
      g.className = 'sayfa';
      scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });

      try { kur(g, arg); }
      catch (err) {
        console.error(err);
        g.appendChild(UI.bos('💥', 'Bir şeyler ters gitti', String(err && err.message || err),
          { ad: 'Ana sayfaya dön', fn: function () { Uygulama.git('#/'); } }));
      }
      Uygulama.suanki = ad;
      Uygulama.gezinmeYenile();
      Uygulama.ustYenile();
    },

    gezinmeYenile: function () {
      var kok = '#/' + (Uygulama.suanki === 'ev' ? '' : Uygulama.suanki);
      UI.qq('.alt a').forEach(function (a) {
        var eslesme = a.getAttribute('href') === kok ||
          (a.getAttribute('href') === '#/' && Uygulama.suanki === 'ev');
        a.classList.toggle('aktif', eslesme);
      });
    },

    ustYenile: function () {
      var s = Atlas.SRS.sayim();
      var seri = Atlas.Seri.canli();
      var g = Atlas.Gunluk.gun();
      var hedef = Atlas.Profil.al().hedef || 20;
      var c = q('#ustCipler');
      if (!c) return;
      UI.bosalt(c);
      c.appendChild(e('button', {
        class: 'cip seri', title: 'Çalışma serisi',
        onclick: function () { Uygulama.git('#/ilerleme'); }
      }, '🔥 ' + seri));
      c.appendChild(e('button', {
        class: 'cip', title: 'Bugünkü hedef',
        onclick: function () { Uygulama.git('#/'); }
      }, '🎯 ' + (g.sayac || 0) + '/' + hedef));
      if (s.vade) {
        c.appendChild(e('button', {
          class: 'cip vade', title: 'Vadesi gelen tekrarlar',
          onclick: function () { Uygulama.git('#/tekrar'); }
        }, '🔁 ' + s.vade));
      }
    },

    /* ekran başlığı + geri düğmesi */
    baslik: function (govde, baslik, alt, geriYol) {
      var ust = e('div', { style: 'display:flex;align-items:flex-start;gap:12px;margin:8px 0 18px' });
      if (geriYol !== false) {
        ust.appendChild(e('button', {
          class: 'dg yuvarlak sade', title: 'Geri',
          onclick: function () { if (geriYol) Uygulama.git(geriYol); else history.back(); }
        }, '←'));
      }
      ust.appendChild(e('div', { style: 'flex:1;min-width:0' }, [
        e('h1', 'baslik', baslik),
        alt ? e('p', { class: 'altbaslik', style: 'margin:0' }, alt) : null
      ]));
      govde.appendChild(ust);
      return ust;
    }
  };
  global.Uygulama = Uygulama;

  /* ═══════════════════════════════════════════════════════════
     KURULUM (ilk açılış)
     ═══════════════════════════════════════════════════════════ */
  var AMACLAR = [
    { kod: 'is', ikon: '💼', ad: 'İş ve kariyer', alt: 'Toplantı, e-posta, mülakat' },
    { kod: 'seyahat', ikon: '✈️', ad: 'Seyahat', alt: 'Havaalanı, otel, yol tarifi' },
    { kod: 'sinav', ikon: '🎓', ad: 'Sınav', alt: 'YDS, IELTS, TOEFL hazırlık' },
    { kod: 'gunluk', ikon: '☕', ad: 'Günlük konuşma', alt: 'Sohbet, film, dizi' },
    { kod: 'akademik', ikon: '🔬', ad: 'Akademik', alt: 'Makale, sunum, yazışma' },
    { kod: 'sifirdan', ikon: '🌱', ad: 'Sıfırdan başlıyorum', alt: 'Temelden, adım adım' }
  ];

  Ekran.kurulum = function (g) {
    var adim = 0, secim = { amac: '', seviye: '', hedef: 20, ad: '' };
    var kap = e('div', { style: 'max-width:560px;margin:0 auto;padding-top:20px' });
    g.appendChild(kap);

    ciz();

    function ciz() {
      UI.bosalt(kap);
      /* adım göstergesi */
      var nokta = e('div', { style: 'display:flex;gap:6px;justify-content:center;margin-bottom:26px' });
      for (var i = 0; i < 4; i++) {
        nokta.appendChild(e('div', {
          style: 'height:4px;border-radius:9px;transition:all .5s var(--ez);' +
            'width:' + (i === adim ? 34 : 18) + 'px;background:' + (i <= adim ? 'var(--brand)' : 'var(--line)')
        }));
      }
      kap.appendChild(nokta);

      if (adim === 0) adimHosgeldin();
      else if (adim === 1) adimAmac();
      else if (adim === 2) adimSeviye();
      else adimHedef();
    }

    function adimHosgeldin() {
      kap.appendChild(e('div', { class: 'orta gir' }, [
        e('div', { style: 'font-size:76px;margin-bottom:10px;animation:sallan 4s var(--ez) infinite;display:inline-block' }, '🗺️'),
        e('h1', { style: 'font-size:clamp(30px,8vw,46px);font-weight:850;letter-spacing:-.04em;margin:0 0 10px;line-height:1.05' }, 'Dil Harita'),
        e('p', { class: 'altbaslik', style: 'max-width:400px;margin:0 auto 26px' },
          'İngilizceyi cümle cümle, aralıklı tekrarla öğrenirsin. Ne çalıştığını, ne unuttuğunu ve sırada ne olduğunu uygulama takip eder — sen sadece gel ve çalış.')
      ]));
      var ad = e('input', { class: 'alan', placeholder: 'Adın (isteğe bağlı)', style: 'margin-bottom:12px' });
      kap.appendChild(ad);
      kap.appendChild(e('button', {
        class: 'dg ana tam', onclick: function () { secim.ad = ad.value.trim(); adim = 1; ciz(); }
      }, 'Başlayalım →'));
      kap.appendChild(e('button', {
        class: 'dg sade tam', style: 'margin-top:8px',
        onclick: function () {
          var s = Atlas.Yedek.eskidenAl();
          if (s.srs || s.seviye) {
            UI.bildir('Eski verin aktarıldı: ' + s.srs + ' kayıt' + (s.seviye ? ', seviye ' + s.seviye : ''), 'ok', 5000);
            Atlas.Profil.kur({ kurulum: true });
            Uygulama.git('#/');
          } else UI.bildir('Bu tarayıcıda eski Dil Harita verisi bulunamadı.', 'bad');
        }
      }, 'Eski Dil Harita verimi aktar'));
    }

    function adimAmac() {
      kap.appendChild(e('h2', { class: 'baslik gir' }, 'Neden öğreniyorsun?'));
      kap.appendChild(e('p', { class: 'altbaslik gir gir-1' }, 'Buna göre hangi modülleri önce göstereceğimi seçiyorum.'));
      var iz = e('div', { class: 'izgara', style: 'grid-template-columns:repeat(auto-fill,minmax(150px,1fr))' });
      AMACLAR.forEach(function (a, i) {
        iz.appendChild(e('button', {
          class: 'kart tikla gir gir-' + Math.min(6, i + 1),
          style: 'text-align:left;padding:16px;border-color:' + (secim.amac === a.kod ? 'var(--brand)' : ''),
          onclick: function () { secim.amac = a.kod; adim = 2; ciz(); }
        }, [
          e('div', { style: 'font-size:30px;margin-bottom:8px' }, a.ikon),
          e('b', { style: 'display:block;font-size:15px;margin-bottom:3px' }, a.ad),
          e('span', 'kucuk-yazi', a.alt)
        ]));
      });
      kap.appendChild(iz);
      geriDugme(1);
    }

    function adimSeviye() {
      kap.appendChild(e('h2', { class: 'baslik gir' }, 'Seviyen nedir?'));
      kap.appendChild(e('p', { class: 'altbaslik gir gir-1' }, 'Emin değilsen 3 dakikalık testi çöz; sonucu buraya döner.'));
      var tanim = {
        A1: 'Yeni başlayan · temel kalıplar', A2: 'Basit günlük konuşma',
        B1: 'Kendi konularımda rahatım', B2: 'Akıcıya yakın, soyut konular',
        C1: 'İleri · nüans ve akademik dil'
      };
      var liste = e('div', { style: 'display:grid;gap:9px;margin-bottom:14px' });
      Atlas.SEVIYELER.forEach(function (s, i) {
        liste.appendChild(e('button', {
          class: 'satir-kart gir gir-' + Math.min(6, i + 1),
          style: 'cursor:pointer;text-align:left;width:100%;border-color:' + (secim.seviye === s ? 'var(--brand)' : ''),
          onclick: function () { secim.seviye = s; adim = 3; ciz(); }
        }, [
          e('span', 'et ' + s, s),
          e('span', { style: 'flex:1;font-size:14px;color:var(--ink-2)' }, tanim[s]),
          e('span', { style: 'color:var(--ink-3)' }, '→')
        ]));
      });
      kap.appendChild(liste);
      kap.appendChild(e('button', {
        class: 'dg tam', onclick: function () {
          Atlas.Profil.kur({ amac: secim.amac, ad: secim.ad });
          Atlas.yaz('kurulum-donus', true);
          Uygulama.git('#/seviye-testi');
        }
      }, '📝 Seviye testini çöz (3 dk)'));
      geriDugme(1);
    }

    function adimHedef() {
      kap.appendChild(e('h2', { class: 'baslik gir' }, 'Günde kaç kalem?'));
      kap.appendChild(e('p', { class: 'altbaslik gir gir-1' },
        'Aralıklı tekrarda süreklilik, miktardan önemli. Küçük başla — istersen sonra artırırsın.'));
      var secenekler = [
        { n: 10, ad: 'Rahat', alt: '~5 dakika' },
        { n: 20, ad: 'Dengeli', alt: '~10 dakika' },
        { n: 35, ad: 'İstekli', alt: '~18 dakika' },
        { n: 60, ad: 'Yoğun', alt: '~30 dakika' }
      ];
      var iz = e('div', { class: 'izgara iz-2', style: 'margin-bottom:18px' });
      secenekler.forEach(function (o, i) {
        iz.appendChild(e('button', {
          class: 'kart tikla gir gir-' + (i + 1),
          style: 'text-align:center;border-color:' + (secim.hedef === o.n ? 'var(--brand)' : ''),
          onclick: function () { secim.hedef = o.n; bitir(); }
        }, [
          e('b', { style: 'display:block;font-size:26px;font-weight:850' }, o.n),
          e('div', { style: 'font-size:13px;font-weight:700;margin-top:2px' }, o.ad),
          e('div', 'kucuk-yazi', o.alt)
        ]));
      });
      kap.appendChild(iz);
      geriDugme(2);
    }

    function geriDugme(hedefAdim) {
      kap.appendChild(e('button', {
        class: 'dg sade tam', style: 'margin-top:14px',
        onclick: function () { adim = hedefAdim - 1 < 0 ? 0 : hedefAdim - 1; ciz(); }
      }, '← Geri'));
    }

    function bitir() {
      Atlas.Profil.kur({
        ad: secim.ad, amac: secim.amac, seviye: secim.seviye || 'A1',
        hedef: secim.hedef, kurulum: true
      });
      UI.kutla({
        ikon: '🚀', baslik: 'Hazırsın' + (secim.ad ? ', ' + secim.ad : ''),
        alt: 'Seviyene uygun ilk modülü açıyorum. Bugünün hedefi ' + secim.hedef + ' kalem.',
        dugmeler: [{ ad: 'İlk modüle git', ana: true, fn: function () { Uygulama.git('#/ogren'); } }]
      });
    }
  };

  /* ═══════════════════════════════════════════════════════════
     EV · bugünün planı
     ═══════════════════════════════════════════════════════════ */
  Ekran.ev = function (g) {
    var pr = Atlas.Profil.al();
    if (!pr.kurulum) { Ekran.kurulum(g); return; }

    var plan = Atlas.Koc.plan();
    var oran = Math.min(100, Math.round(plan.yapilan / Math.max(1, plan.hedef) * 100));
    var saat = new Date().getHours();
    var selam = saat < 6 ? 'İyi geceler' : saat < 12 ? 'Günaydın' : saat < 18 ? 'İyi günler' : 'İyi akşamlar';

    /* ── kahraman ── */
    var kah = e('div', { class: 'kahraman gir' });
    var sol = e('div', { style: 'flex:1;min-width:220px' }, [
      e('h1', null, selam + (pr.ad ? ', ' + pr.ad : '')),
      e('p', null, Atlas.Koc.tavsiye())
    ]);
    var dugmeler = e('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' });
    var ilk = plan.adimlar[0];
    dugmeler.appendChild(e('button', {
      class: 'dg ana', onclick: function () { Uygulama.git(ilk.yol); }
    }, ilk.ikon + '  ' + ilk.ad));
    dugmeler.appendChild(e('button', {
      class: 'dg', onclick: function () { Uygulama.git('#/ogren'); }
    }, 'Modül seç'));
    sol.appendChild(dugmeler);
    kah.appendChild(e('div', 'satir', [
      sol,
      e('div', { style: 'display:grid;place-items:center' }, [
        UI.halka(oran, { boy: 132, kalinlik: 11, sayi: plan.yapilan + '/' + plan.hedef, etiket: 'bugün' })
      ])
    ]));
    g.appendChild(kah);

    /* ── hızlı sayılar ── */
    var s = plan.sayim;
    var iz = e('div', { class: 'izgara iz-2 gir gir-1', style: 'margin-top:14px' });
    iz.appendChild(UI.ist(Atlas.Seri.canli(), 'gün seri', 'var(--gold)'));
    iz.appendChild(UI.ist(s.vade, 'vadesi gelen', s.vade ? 'var(--brand-2)' : null));
    iz.appendChild(UI.ist(s.ogrenildi, 'kalıcı', 'var(--ok)'));
    iz.appendChild(UI.ist(s.toplam, 'toplam kalem'));
    g.appendChild(iz);

    /* ── bugünün planı ── */
    g.appendChild(e('div', 'bolum-ad', 'Bugünün planı'));
    var liste = e('div', { style: 'display:grid;gap:9px' });
    plan.adimlar.forEach(function (a, i) {
      liste.appendChild(e('button', {
        class: 'satir-kart gir gir-' + Math.min(6, i + 1),
        style: 'cursor:pointer;text-align:left;width:100%',
        onclick: function () { Uygulama.git(a.yol); }
      }, [
        e('span', { style: 'font-size:23px;width:34px;text-align:center;flex:0 0 34px' }, a.ikon),
        e('span', { style: 'flex:1;min-width:0' }, [
          e('b', { style: 'display:block;font-size:15px;font-weight:750' }, a.ad),
          e('span', 'kucuk-yazi', a.alt)
        ]),
        a.n ? e('span', 'et', String(a.n)) : null,
        e('span', { style: 'color:var(--ink-3)' }, '→')
      ]));
    });
    g.appendChild(liste);

    /* ── sıradaki modül önizleme ── */
    var modulKap = e('div', { class: 'gir gir-3', style: 'margin-top:20px' });
    g.appendChild(modulKap);
    Veri.siradakiModul().then(function (m) {
      if (!m) return;
      var p = Atlas.Ilerleme.modul(m.ids);
      modulKap.appendChild(e('div', 'bolum-ad', 'Kaldığın yer'));
      modulKap.appendChild(e('div', {
        class: 'kart tikla parlak',
        onclick: function () { Uygulama.git('#/calis/' + m.f); }
      }, [
        e('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:12px' }, [
          e('span', 'et ' + m.lvl, m.lvl),
          e('b', { style: 'flex:1;font-size:16px;font-weight:750;letter-spacing:-.01em' }, m.mod),
          e('span', { style: 'font-size:13px;font-weight:800;color:var(--ink-3)' }, p.oran + '%')
        ]),
        UI.cubuk(p.oran),
        e('div', { class: 'kucuk-yazi', style: 'margin-top:9px' },
          p.n + ' / ' + p.toplam + ' cümle çalışıldı · ' + p.ogrenildi + ' kalıcı hafızada')
      ]));
    });

    /* ── ısı takvimi ── */
    var son = Atlas.Gunluk.son(70);
    g.appendChild(e('div', 'bolum-ad', 'Son 10 hafta'));
    var tk = e('div', { class: 'kart gir gir-4' });
    tk.appendChild(UI.isiTakvim(son));
    var toplam = son.reduce(function (a, b) { return a + (b.veri.sayac || 0); }, 0);
    var aktifGun = son.filter(function (x) { return x.veri.sayac; }).length;
    tk.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-top:11px' },
      toplam + ' tekrar · ' + aktifGun + ' aktif gün · en iyi seri ' + (Atlas.Seri.al().enIyi || 0) + ' gün'));
    g.appendChild(tk);

    /* ── rozetler ── */
    var kz = Atlas.Rozet.kazanilan();
    var kazanilanlar = Atlas.Rozet.TANIM.filter(function (r) { return kz[r.id]; });
    if (kazanilanlar.length) {
      g.appendChild(e('div', 'bolum-ad', 'Rozetlerin · ' + kazanilanlar.length + '/' + Atlas.Rozet.TANIM.length));
      var rz = e('div', { class: 'izgara iz-4 gir gir-5' });
      kazanilanlar.slice(0, 8).forEach(function (r) {
        rz.appendChild(e('div', { class: 'kart', style: 'text-align:center;padding:14px 8px', title: r.aciklama }, [
          e('div', { style: 'font-size:30px' }, r.ikon),
          e('div', { style: 'font-size:11.5px;font-weight:750;margin-top:5px' }, r.ad)
        ]));
      });
      rz.appendChild(e('button', {
        class: 'kart tikla', style: 'text-align:center;padding:14px 8px;color:var(--ink-3)',
        onclick: function () { Uygulama.git('#/ilerleme'); }
      }, [e('div', { style: 'font-size:30px' }, '⋯'), e('div', { style: 'font-size:11.5px;margin-top:5px' }, 'Tümü')]));
      g.appendChild(rz);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     MENÜ · tüm ekranlar
     ═══════════════════════════════════════════════════════════ */
  Ekran.menu = function (g) {
    Uygulama.baslik(g, 'Tüm ekranlar', 'Uygulamanın her köşesi', '#/');
    var gruplar = [
      {
        ad: 'Öğren', oge: [
          ['#/ogren', '🗺️', 'Modül haritası', '506 modül · A1’den C1’e'],
          ['#/kelime', '🔤', 'Kelime öğren', '10.000+ kelime · kart ve quiz'],
          ['#/phrasal', '🧩', 'Phrasal verbs', '881 öbek fiil · pratik'],
          ['#/ogretmen', '👩‍🏫', 'Öğretmen', 'Cümle çözümleme · Türkçe anlatım'],
          ['#/kendi', '✍️', 'Kendi cümlelerim', 'Kendi listeni oluştur ve çalış'],
          ['#/uret', '✨', 'Modül üret', 'İlgi alanına özel modül (AI)']
        ]
      },
      {
        ad: 'Pratik', oge: [
          ['#/tekrar', '🔁', 'Tekrar', 'Vadesi gelen cümle ve kelimeler'],
          ['#/sohbet', '💬', 'Konuşma senaryoları', 'Havaalanı, otel, doktor, mülakat'],
          ['#/telaffuz', '🎙️', 'Telaffuz stüdyosu', 'Dinle · söyle · karşılaştır'],
          ['#/dinleme', '🎧', 'Dinleme', 'Duyduğunu yaz'],
          ['../sesdalga.html', '🌊', 'Ses Dalgası', 'Akustik analiz · ağız ve ses eşleme', 'sayfa'],
          ['https://youglish.com/', '🎬', 'YouGlish', 'Gerçek videolarda İngilizce telaffuz', 'dis']
        ]
      },
      {
        ad: 'İlerleme', oge: [
          ['#/ilerleme', '📈', 'İlerleme haritası', 'Tüm seviyelerde ne kadar yol'],
          ['#/rapor', '📊', '30 günlük rapor', 'Aktivite, hata eğilimi, unutma eğrisi'],
          ['#/hatalar', '🧯', 'Hata defteri', 'Yanlış yaptıkların ve nedenleri'],
          ['#/aktivite', '⏱️', 'Bugünkü aktivite', 'Saat saat ne yaptın'],
          ['#/seviye-testi', '📝', 'Seviye testi', 'Kısa testle seviyeni ölç']
        ]
      },
      {
        ad: 'Ayarlar', oge: [
          ['#/ayarlar', '⚙️', 'Ayarlar', 'Tema, ses, hedef, yapay zekâ'],
          ['#/veri', '💾', 'Veri ve yedek', 'Yedek al, geri yükle, aktar'],
          ['#/hakkinda', 'ℹ️', 'Nasıl çalışır', 'Aralıklı tekrar ve tasarım notları']
        ]
      },
      {
        ad: 'Klasik araçlar', oge: [
          ['../ders.html', '🎓', 'Bugünkü dersim', 'Öğretmenin hazırladığı günlük ders', 'sayfa'],
          ['../library.html', '📚', 'Kütüphane', 'Kitap ve metin okuma', 'sayfa'],
          ['../foto-ekle.html', '📷', 'Fotoğraftan ekle', 'Fotoğraftaki cümleleri tara ve çevir', 'sayfa'],
          ['../ocr-sentence.html', '🔎', 'OCR cümle modu', 'Taranan cümleleri zengin modda çalış', 'sayfa'],
          ['../videopractice.html', '🎞️', 'Video pratiği', 'Video ile dinleme ve telaffuz çalış', 'sayfa'],
          ['../practice.html', '🗣️', 'Serbest cümle pratiği', 'Kendi cümlelerinle üretim çalışması', 'sayfa'],
          ['../akilli-tekrar.html', '🧠', 'Akıllı tekrar', 'Ayrıntılı eski tekrar ekranı', 'sayfa'],
          ['../ses-secim.html', '🔊', 'Avatar sesi', 'Avatar sesini seç ve dene', 'sayfa'],
          ['../ses-esleme.html', '🎚️', 'Ses eşleme', 'Türkçe sesleri karşılaştır ve eşle', 'sayfa'],
          ['../ses-teshis.html', '🩺', 'Ses teşhisi', 'Tarayıcı ses özelliklerini kontrol et', 'sayfa'],
          ['../modullerim.html', '🧱', 'Eski modüllerim', 'Özel modül üretme ve çalışma araçları', 'sayfa'],
          ['../ogrenme-yolu.html', '🛤️', 'Öğrenme yolu', 'Kişisel çalışma yolunu görüntüle', 'sayfa'],
          ['../gunluk-takip.html', '📅', 'Günlük takip', 'Günlük çalışma geçmişini incele', 'sayfa'],
          ['../koc-modu.html', '🧭', 'Koç modu', 'Çalışma koçunu aç', 'sayfa'],
          ['../kilavuz.html', '📖', 'Kullanım kılavuzu', 'Uygulamanın ayrıntılı rehberi', 'sayfa'],
          ['../veri-gizlilik.html', '🔒', 'Gizlilik ve veri', 'Veri kontrollerini yönet', 'sayfa']
        ]
      }
    ];
    gruplar.forEach(function (gr, gi) {
      g.appendChild(e('div', 'bolum-ad', gr.ad));
      var liste = e('div', { style: 'display:grid;gap:8px' });
      gr.oge.forEach(function (o, i) {
        liste.appendChild(e('button', {
          class: 'satir-kart gir gir-' + Math.min(6, i + 1),
          style: 'cursor:pointer;text-align:left;width:100%',
          onclick: function () {
            if (o[4] === 'dis') window.open(o[0], '_blank', 'noopener,noreferrer');
            else if (o[4] === 'sayfa') location.href = o[0];
            else Uygulama.git(o[0]);
          }
        }, [
          e('span', { style: 'font-size:21px;width:32px;text-align:center;flex:0 0 32px' }, o[1]),
          e('span', { style: 'flex:1;min-width:0' }, [
            e('b', { style: 'display:block;font-size:14.5px;font-weight:750' }, o[2]),
            e('span', 'kucuk-yazi', o[3])
          ]),
          e('span', { style: 'color:var(--ink-3)' }, '→')
        ]));
      });
      g.appendChild(liste);
    });
  };

  /* ═══════════════════════════════════════════════════════════
     HAKKINDA
     ═══════════════════════════════════════════════════════════ */
  Ekran.hakkinda = function (g) {
    Uygulama.baslik(g, 'Nasıl çalışır', 'Kısa ve dürüst açıklama', '#/menu');
    var bolumler = [
      ['🧠', 'Aralıklı tekrar (SM-2)', 'Her cümle ve kelime için bir "kolaylık katsayısı" tutulur. Doğru bildiğinde aralık uzar, yanıldığında sıfırlanır. Kalite puanı senin benzerlik yüzdenden türetilir — sabit değil. Bu önemli: sabit q=4 kullanan bir SM-2 uygulamasında katsayı hiç artmaz, sadece düşer; zamanla iyi bildiğin cümleler bile sürekli karşına çıkar.'],
      ['📦', 'Veri neden hızlı', 'Cümleler 500+ küçük parçaya bölünmüş. Modül listesi 28 KB’lık bir indeksle çiziliyor, bir modüle girdiğinde sadece o modülün ~5 KB’ı iniyor. İlerleme çubukları hiç cümle indirmeden hesaplanıyor, çünkü indeks her modülün id listesini taşıyor.'],
      ['🗣️', 'Ses ve ağız', 'Seslendirme çift dilli: Türkçe anlatım Türkçe sesle, [[İngilizce]] parçalar İngilizce sesle okunur. Ağız hareketleri iki ayrı haritadan gelir — Türkçe ve İngilizcenin ağzı gerçekten farklı (r yuvarlaklığı, ö/ü, ş/ç, th, kelime sonundaki sessiz e).'],
      ['🎤', 'iPhone’da telaffuz', 'iOS Safari’de ses tanıma yok. Bu durumda yazı kutusuna düşmek alıştırmanın amacını bitirir; onun yerine gölgeleme paneli açılır: dinle → kendini kaydet → ikisini arka arkaya dinle → kendini değerlendir. Puan yine SRS’e işlenir.'],
      ['🤖', 'Yapay zekâ isteğe bağlı', 'Anahtar eklersen öğretmen, hakemlik ve modül üretimi açılır. Eklemezsen uygulama tam çalışır; açıklamalar veri setindeki hazır alanlardan gelir. Öğretmen promptu rol yapma senaryolarına asla karışmaz — doktorla konuşurken karşına öğretmen çıkmaz.'],
      ['🔒', 'Verin nerede', 'Her şey tarayıcında. Sunucu yok, hesap yok, takip yok. Yedeğini JSON olarak indirip başka cihaza taşıyabilirsin.']
    ];
    bolumler.forEach(function (b, i) {
      g.appendChild(e('div', { class: 'kart parlak gir gir-' + Math.min(6, i + 1), style: 'margin-bottom:10px' }, [
        e('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:8px' }, [
          e('span', { style: 'font-size:22px' }, b[0]),
          e('b', { style: 'font-size:16px;font-weight:800;letter-spacing:-.01em' }, b[1])
        ]),
        e('p', { style: 'margin:0;font-size:14px;line-height:1.7;color:var(--ink-2)' }, b[2])
      ]));
    });
    g.appendChild(e('p', { class: 'kucuk-yazi', style: 'text-align:center;margin-top:24px' },
      'Dil Harita · Atlas — verisi mevcut Dil Harita projesinden, arayüzü ve motoru sıfırdan.'));
  };

  /* ═══════════════════════════════════════════════════════════
     BAŞLATMA
     ═══════════════════════════════════════════════════════════ */
  function kabukKur() {
    document.body.appendChild(e('div', { id: 'sahne' }, [
      e('div', 'kure k1'), e('div', 'kure k2'), e('div', 'kure k3')
    ]));
    document.body.appendChild(e('canvas', { id: 'yildizlar' }));
    document.body.appendChild(e('div', { id: 'ustCubuk' }));
    document.body.appendChild(e('div', { id: 'tepsi' }));
    document.body.appendChild(e('div', { id: 'perde' }));
    document.body.appendChild(e('canvas', { id: 'konfeti' }));

    var kabuk = e('div', 'kabuk');
    var ust = e('header', 'ust', [
      e('a', { class: 'marka', href: '#/' }, [e('span', 'rozet', '🗺️'), e('span', null, 'Dil Harita')]),
      e('div', 'bosluk'),
      e('div', { id: 'ustCipler', style: 'display:flex;gap:6px' }),
      e('button', {
        class: 'cip', title: 'Tema değiştir',
        onclick: function () {
          var a = Atlas.Ayar.al();
          Atlas.Ayar.kur({ tema: a.tema === 'isik' ? 'gece' : 'isik' });
        }
      }, '◐')
    ]);
    kabuk.appendChild(ust);
    var govde = e('main', { id: 'govde' });
    kabuk.appendChild(govde);
    document.body.appendChild(kabuk);

    var alt = e('nav', 'alt');
    GEZINME.forEach(function (n) {
      alt.appendChild(e('a', { href: n.yol }, [
        e('span', 'ikon', n.ikon), e('span', null, n.ad)
      ]));
    });
    document.body.appendChild(alt);

    Uygulama.govde = govde;
  }

  function baslat() {
    Atlas.Ayar.uygula();
    kabukKur();
    UI.yildizlar();

    addEventListener('hashchange', Uygulama.yonlendir);
    Atlas.on('srs', Uygulama.ustYenile);
    Atlas.on('gunluk', Uygulama.ustYenile);
    Atlas.on('ayar', function () { UI.bildir('Ayar kaydedildi', 'ok', 1400); });
    Atlas.on('rozet', function (yeni) {
      yeni.forEach(function (r, i) {
        setTimeout(function () {
          UI.kutla({
            ikon: r.ikon, baslik: 'Yeni rozet: ' + r.ad, alt: r.aciklama,
            dugmeler: [{ ad: 'Devam et', ana: true }]
          });
        }, i * 900);
      });
    });
    Atlas.on('depo-doldu', function () {
      UI.bildir('Tarayıcı deposu doldu. Veri ekranından eski günlükleri temizleyebilirsin.', 'bad', 6000);
    });

    /* klavye kısayolları */
    addEventListener('keydown', function (ev) {
      if (/input|textarea|select/i.test((ev.target.tagName || ''))) return;
      if (!Atlas.Ayar.al().klavye) return;
      var h = { '1': '#/', '2': '#/ogren', '3': '#/tekrar', '4': '#/kelime', '5': '#/sohbet' };
      if (h[ev.key]) { Uygulama.git(h[ev.key]); ev.preventDefault(); }
      if (ev.key === 'Escape') { UI.pencereKapat(); UI.balonKapat(); }
    });

    Uygulama.yonlendir();

    /* çevrimdışı / çevrimiçi */
    addEventListener('offline', function () { UI.bildir('Çevrimdışısın — indirilmiş modüller çalışmaya devam eder', 'bilgi', 4000); });
    addEventListener('online', function () { UI.bildir('Bağlantı geri geldi', 'ok', 2000); });

    /* service worker */
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(function (r) {
        r.addEventListener('updatefound', function () {
          var y = r.installing;
          if (!y) return;
          y.addEventListener('statechange', function () {
            if (y.state === 'installed' && navigator.serviceWorker.controller) {
              var b = UI.bildir('Yeni sürüm hazır', 'bilgi', 12000);
              if (b) {
                b.style.cursor = 'pointer';
                b.appendChild(e('button', { class: 'dg kucuk ana', onclick: function () { location.reload(); } }, 'Yenile'));
              }
            }
          });
        });
      }).catch(function () {});
    }
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', baslat);
  else baslat();
})(window);
