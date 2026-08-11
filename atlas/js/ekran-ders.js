/* ═══════════════════════════════════════════════════════════════
   ATLAS · DERS MOTORU ve GÜNLÜK İÇERİK
     #/ders      bugünkü yapılandırılmış ders (AI'sız da çalışır)
     #/hikaye    modül hikâyesi + podcast dinleme
     #/gunsonu   karma gün sonu pratiği
     #/konusma   günün konuşma malzemesi

   Ders motorunun ilkesi: AI olmadan da tam bir ders çıkarabilmeli.
   Yapı veri setinden gelir (modül · gramer · sık hata · kalıplar),
   AI yalnızca anlatımı zenginleştirir. Anahtar yoksa ders kısalmaz,
   sadece açıklamalar hazır alanlardan gelir.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  /* ═══════════════════════════════════════════════════════════
     BUGÜNKÜ DERS
     ═══════════════════════════════════════════════════════════ */
  Ekran.ders = function (g) {
    var bugun = Atlas.bugun();
    var kayit = Atlas.oku('ders:' + bugun, null);

    Uygulama.baslik(g, 'Bugünkü dersim', 'Öğretmen bugünün dersini hazırladı', '#/');

    if (kayit && kayit.bitti) {
      g.appendChild(e('div', { class: 'kart parlak', style: 'text-align:center;margin-bottom:14px' }, [
        e('div', { style: 'font-size:44px' }, '✅'),
        e('b', { style: 'display:block;font-size:17px;margin-top:6px' }, 'Bugünün dersini tamamladın'),
        e('p', { class: 'kucuk-yazi', style: 'margin-top:6px' }, kayit.konu + ' · ' + (kayit.adim || 0) + ' adım')
      ]));
    }

    g.appendChild(UI.yukleniyor(4));
    dersHazirla().then(function (ders) {
      UI.bosalt(g);
      Uygulama.baslik(g, 'Bugünkü dersim', ders.konu, '#/');
      cizDers(g, ders);
    }).catch(function (err) {
      UI.bosalt(g);
      g.appendChild(UI.bos('📡', 'Ders hazırlanamadı', String(err && err.message || err),
        { ad: 'Modül haritasına git', fn: function () { Uygulama.git('#/ogren'); } }));
    });
  };

  /* dersin iskeleti: hangi modül, hangi gramer, hangi hatalar */
  function dersHazirla() {
    return Veri.siradakiModul().then(function (m) {
      return Veri.modul(m.f).then(function (cumleler) {
        var srs = Atlas.SRS.tumu();
        var yeni = cumleler.filter(function (c) { return !srs['c:' + c.id]; });
        var vade = cumleler.filter(function (c) {
          var k = srs['c:' + c.id]; return k && k.vade <= Date.now();
        });
        var hatalar = Atlas.Hata.hepsi().filter(function (h) { return h.tip === 'c'; }).slice(0, 4);

        /* konu: modüldeki en sık gramer etiketi */
        var sayac = {};
        cumleler.forEach(function (c) {
          (String(c.grammarTags || c.grammar || '').split(/[,·]/)).forEach(function (t) {
            t = t.trim(); if (t) sayac[t] = (sayac[t] || 0) + 1;
          });
        });
        var konular = Object.keys(sayac).sort(function (a, b) { return sayac[b] - sayac[a]; });

        return {
          modul: m,
          konu: m.mod,
          gramerKonu: konular[0] || (cumleler[0] && cumleler[0].grammar) || '',
          isinma: (vade.length ? vade : cumleler).slice(0, 4),
          sunum: cumleler.slice(0, 3),
          alistirma: (yeni.length ? yeni : cumleler).slice(0, 8),
          hatalar: hatalar,
          kapanis: (yeni.length ? yeni : cumleler).slice(0, 5),
          cumleler: cumleler
        };
      });
    });
  }

  function cizDers(g, ders) {
    var kayit = Atlas.oku('ders:' + Atlas.bugun(), { adim: 0 });

    /* ── öğretmen kartı ── */
    var av = UI.avatar(96);
    av.style.margin = '0 auto 12px';
    g.appendChild(av);

    var girisKart = e('div', { class: 'kart parlak', style: 'margin-bottom:14px' });
    g.appendChild(girisKart);
    var girisMetin = 'Bugün ' + ders.konu + ' üzerinde çalışacağız.' +
      (ders.gramerKonu ? ' Odak konumuz: ' + ders.gramerKonu + '.' : '') +
      (ders.hatalar.length ? ' Ayrıca son günlerde takıldığın ' + ders.hatalar.length + ' cümleyi de araya sıkıştıracağım.' : '');
    girisKart.appendChild(e('p', { style: 'margin:0;font-size:15px;line-height:1.7' }, girisMetin));
    girisKart.appendChild(e('button', {
      class: 'dg kucuk', style: 'margin-top:10px',
      onclick: function () {
        av.konusuyor(true);
        Ses.konus(girisMetin, {
          baglam: 'tr', agiz: function (k) { av.agiz(k); },
          bitti: function () { av.konusuyor(false); }
        });
      }
    }, '🔊 Öğretmeni dinle'));

    if (AI.anahtarVar()) {
      var aiDugme = e('button', { class: 'dg kucuk', style: 'margin-top:10px;margin-left:6px' }, '🤖 Konuyu anlat');
      girisKart.appendChild(aiDugme);
      aiDugme.onclick = function () {
        aiDugme.disabled = true; aiDugme.textContent = '⏳ Hazırlanıyor…';
        AI.cagir([
          {
            role: 'system', content: [
              'Sen bir İngilizce öğretmenisin, öğrencin Türk, seviyesi ' + (Atlas.Profil.al().seviye || 'A2') + '.',
              'Verilen konuyu 5-7 cümlelik kısa bir ders anlatımıyla açıkla.',
              'Kuralı ve NEDENİNİ anlat, sonra iki örnek ver: [[İngilizce]] ve altında Türkçesi.',
              'Anlatımın tamamı Türkçe. Sadece Türkçe ve İngilizce kullan.'
            ].join(' ')
          },
          { role: 'user', content: ders.gramerKonu + ' — örnek cümleler: ' + ders.sunum.map(function (c) { return c.en; }).join(' | ') }
        ], { sicaklik: 0.4, uzunluk: 700 }).then(function (m) {
          aiDugme.remove();
          var d = AI.balonMetni(m);
          d.style.cssText = 'font-size:14.5px;line-height:1.8;margin-top:12px;white-space:pre-wrap;color:var(--ink-2)';
          girisKart.appendChild(d);
          girisKart.appendChild(e('button', {
            class: 'dg kucuk', style: 'margin-top:8px',
            onclick: function () {
              av.konusuyor(true);
              Ses.konus(m, { baglam: 'tr', agiz: function (k) { av.agiz(k); }, bitti: function () { av.konusuyor(false); } });
            }
          }, '🔊 Sesli anlat'));
        }).catch(function (h) {
          aiDugme.disabled = false; aiDugme.textContent = '🤖 Konuyu anlat';
          UI.bildir(AI.hataMesaji(h), 'bad');
        });
      };
    }

    /* ── ders adımları ── */
    var adimlar = [
      {
        ikon: '🔥', ad: 'Isınma', alt: ders.isinma.length + ' cümle · tanıma kipi',
        fn: function () { oturum(ders.isinma, 'tanima', 0); }
      },
      {
        ikon: '📖', ad: 'Sunum', alt: 'Bugünün yapısı ' + ders.sunum.length + ' cümlede',
        fn: function () { sunumGoster(ders); }
      },
      {
        ikon: '⌨️', ad: 'Alıştırma', alt: ders.alistirma.length + ' cümle · üretim kipi',
        fn: function () { oturum(ders.alistirma, 'uretim', 2); }
      },
      {
        ikon: '🧯', ad: 'Hata onarımı', alt: ders.hatalar.length ? ders.hatalar.length + ' eski hata' : 'Hata yok — atlanabilir',
        fn: function () { ders.hatalar.length ? Uygulama.git('#/antrenman') : UI.bildir('Hata defterin boş', 'ok'); }
      },
      {
        ikon: '🎙️', ad: 'Kapanış', alt: 'Sesli oku · ' + ders.kapanis.length + ' cümle',
        fn: function () { oturum(ders.kapanis, 'telaffuz', 4); }
      }
    ];

    g.appendChild(e('div', 'bolum-ad', 'Ders akışı'));
    var liste = e('div', { style: 'display:grid;gap:9px' });
    adimlar.forEach(function (a, i) {
      var yapildi = (kayit.adim || 0) > i;
      liste.appendChild(e('button', {
        class: 'satir-kart gir gir-' + Math.min(6, i + 1),
        style: 'cursor:pointer;text-align:left;width:100%;' + (yapildi ? 'border-color:rgba(52,226,160,.4)' : ''),
        onclick: a.fn
      }, [
        e('span', { style: 'font-size:22px;width:34px;flex:0 0 34px;text-align:center' }, yapildi ? '✓' : a.ikon),
        e('span', { style: 'flex:1' }, [
          e('b', { style: 'display:block;font-size:15px;font-weight:750' }, (i + 1) + '. ' + a.ad),
          e('span', 'kucuk-yazi', a.alt)
        ]),
        e('span', { style: 'color:var(--ink-3)' }, '→')
      ]));
    });
    g.appendChild(liste);

    /* ── ders sonrası ── */
    g.appendChild(e('div', 'bolum-ad', 'Ders sonrası'));
    var ek = e('div', 'izgara iz-3');
    [['📻', 'Modül hikâyesi', '#/hikaye/' + ders.modul.f],
     ['🌙', 'Gün sonu karma', '#/gunsonu'],
     ['💬', 'Günün konuşması', '#/konusma']].forEach(function (o) {
      ek.appendChild(e('button', {
        class: 'kart tikla', style: 'text-align:center;padding:16px 10px',
        onclick: function () { Uygulama.git(o[2]); }
      }, [
        e('div', { style: 'font-size:24px;margin-bottom:5px' }, o[0]),
        e('div', { style: 'font-size:12.5px;font-weight:700' }, o[1])
      ]));
    });
    g.appendChild(ek);

    function oturum(liste2, kip, adimNo) {
      if (!liste2.length) { UI.bildir('Bu adımda cümle yok', 'bad'); return; }
      UI.bosalt(g);
      Atlas.yaz('ders:' + Atlas.bugun(), Object.assign(kayit, {
        konu: ders.konu, adim: Math.max(kayit.adim || 0, adimNo + 1),
        bitti: adimNo >= 4
      }));
      oturumBaslat(g, { liste: liste2, kip: kip, geriYol: '#/ders', kaynak: 'ders' });
    }
  }

  /* ── sunum: yapıyı üç cümlede göster ── */
  function sunumGoster(ders) {
    var kap = e('div', { style: 'display:grid;gap:10px' });
    ders.sunum.forEach(function (c) {
      kap.appendChild(e('div', { class: 'kart', style: 'padding:14px' }, [
        e('div', { class: 'en-metin', style: 'font-size:19px' }, c.en),
        e('div', { class: 'kucuk-yazi', style: 'margin:4px 0 8px' }, c.tr),
        c.pattern ? e('div', { class: 'et', style: 'margin-bottom:6px' }, c.pattern) : null,
        c.aiExplain ? e('p', { style: 'margin:0;font-size:13.5px;line-height:1.65;color:var(--ink-2)' }, c.aiExplain) : null,
        e('button', {
          class: 'dg kucuk', style: 'margin-top:8px',
          onclick: function () { Ses.konus(c.en, { baglam: 'en' }); }
        }, '🔊 Dinle')
      ]));
    });
    UI.pencere(kap, { baslik: 'Sunum', alt: ders.gramerKonu || ders.konu });
  }

  /* ═══════════════════════════════════════════════════════════
     MODÜL HİKÂYESİ + PODCAST
     Modülün cümlelerinden bağlantılı bir metin kurulur; art arda
     dinlenir. Cümleler tek tek değil bir hikâye içinde geçince
     akılda daha iyi kalıyor.
     ═══════════════════════════════════════════════════════════ */
  Ekran.hikaye = function (g, arg) {
    var f = arg[0];
    g.appendChild(UI.yukleniyor(3));

    var kaynak = f
      ? Promise.all([Veri.modul(f), Veri.modulBul(f)])
      : Veri.siradakiModul().then(function (m) {
          return Promise.all([Veri.modul(m.f), Promise.resolve(m)]);
        });

    kaynak.then(function (r) {
      UI.bosalt(g);
      var cumleler = r[0], m = r[1];
      Uygulama.baslik(g, 'Modül hikâyesi', (m && m.mod) || '', '#/ders');
      hikayeCiz(g, cumleler, m);
    }).catch(function () {
      UI.bosalt(g);
      g.appendChild(UI.bos('📡', 'Hikâye hazırlanamadı', ''));
    });
  };

  function hikayeCiz(g, cumleler, m) {
    var anahtar = 'hikaye:' + (m ? m.f : 'x');
    var kayitli = Atlas.oku(anahtar, null);

    var oynatKap = e('div', { class: 'kart parlak', style: 'margin-bottom:12px' });
    g.appendChild(oynatKap);
    var metinKap = e('div');
    g.appendChild(metinKap);

    if (kayitli) ciz(kayitli);
    else ciz({ tur: 'ham', parcalar: cumleler.slice(0, 12).map(function (c) { return { en: c.en, tr: c.tr }; }) });

    function ciz(hikaye) {
      UI.bosalt(oynatKap); UI.bosalt(metinKap);

      var i = -1, calisiyor = false;
      var oynatDugme = e('button', { class: 'dg ana tam' }, '▶️ Podcast olarak dinle');
      var durumEl = e('div', { class: 'kucuk-yazi', style: 'text-align:center;margin-top:8px;min-height:20px' },
        hikaye.tur === 'ai' ? 'AI ile kurulmuş hikâye' : 'Modül cümleleri sırayla');
      oynatKap.appendChild(oynatDugme);
      oynatKap.appendChild(durumEl);

      oynatKap.appendChild(e('div', { style: 'display:flex;gap:8px;margin-top:10px' }, [
        AI.anahtarVar() ? e('button', {
          class: 'dg kucuk', style: 'flex:1', onclick: aiHikaye
        }, '✨ Hikâyeye çevir') : null,
        e('button', {
          class: 'dg kucuk', style: 'flex:1',
          onclick: function () {
            var liste = cumleler.slice(0, 12);
            UI.bosalt(g);
            oturumBaslat(g, { liste: liste, kip: 'dinleme', geriYol: '#/hikaye', kaynak: 'hikaye' });
          }
        }, '🎧 Dinleyerek çalış')
      ].filter(Boolean)));

      oynatDugme.onclick = function () {
        if (calisiyor) { Ses.dur(); calisiyor = false; i = -1; oynatDugme.textContent = '▶️ Podcast olarak dinle'; vurgula(-1); return; }
        calisiyor = true; oynatDugme.textContent = '⏹ Durdur';
        sonraki();
      };
      Uygulama.temizlemeEkle(function () { calisiyor = false; Ses.dur(); });

      function sonraki() {
        if (!calisiyor) return;
        i++;
        if (i >= hikaye.parcalar.length) {
          calisiyor = false; i = -1; vurgula(-1);
          oynatDugme.textContent = '▶️ Podcast olarak dinle';
          durumEl.textContent = 'Bitti';
          Atlas.Gunluk.ekle('sayac', hikaye.parcalar.length, 'hikaye');
          return;
        }
        var p = hikaye.parcalar[i];
        vurgula(i);
        durumEl.textContent = (i + 1) + ' / ' + hikaye.parcalar.length;
        Ses.konus(p.en, {
          baglam: 'en',
          bitti: function () { setTimeout(sonraki, 420); }
        });
      }

      var satirlar = [];
      hikaye.parcalar.forEach(function (p, n) {
        var s = e('div', {
          class: 'kart', style: 'padding:13px 15px;margin-bottom:8px;cursor:pointer;transition:all .3s var(--ez)',
          onclick: function () { Ses.konus(p.en, { baglam: 'en' }); }
        }, [
          e('div', { class: 'en-metin', style: 'font-size:16.5px;text-align:left' },
            UI.kelimelestir(p.en, function (w, ev) { ev.stopPropagation(); UI.kelimeBalonu(w, ev); })),
          p.tr ? e('div', { class: 'kucuk-yazi', style: 'margin-top:4px' }, p.tr) : null
        ]);
        satirlar.push(s);
        metinKap.appendChild(s);
      });

      function vurgula(n) {
        satirlar.forEach(function (s, k) {
          s.style.borderColor = k === n ? 'var(--brand)' : '';
          s.style.background = k === n ? 'rgba(124,92,255,.12)' : '';
          if (k === n) s.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      function aiHikaye() {
        var d = this;
        d.disabled = true; d.textContent = '⏳ Kuruluyor…';
        AI.cagir([
          {
            role: 'system', content: [
              'Aşağıdaki İngilizce cümleleri kullanarak kısa, bağlantılı bir hikâye kur.',
              'Cümleleri olabildiğince aynen kullan, gerekiyorsa aralarına bağlayıcı kısa cümle ekle.',
              'Sadece geçerli JSON dizisi döndür: [{"en":"...","tr":"..."}]',
              '"tr" Türkçe çeviri. Seviye: ' + (Atlas.Profil.al().seviye || 'A2') + '.'
            ].join(' ')
          },
          { role: 'user', content: cumleler.slice(0, 12).map(function (c) { return c.en; }).join('\n') }
        ], { sicaklik: 0.7, uzunluk: 2000 }).then(function (mtn) {
          var t = mtn.replace(/```json?/gi, '').replace(/```/g, '');
          var a = t.indexOf('['), b = t.lastIndexOf(']');
          var parcalar = JSON.parse(t.slice(a, b + 1));
          var hik = { tur: 'ai', parcalar: parcalar };
          Atlas.yaz(anahtar, hik);
          ciz(hik);
          UI.bildir('Hikâye kuruldu', 'ok');
        }).catch(function (h) {
          d.disabled = false; d.textContent = '✨ Hikâyeye çevir';
          UI.bildir(AI.hataMesaji(h), 'bad');
        });
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
     GÜN SONU KARMA PRATİK
     Günün her türünden birer parça: bugün çalışılan cümleler,
     kelimeler, phrasal ve bir konuşma sorusu. Kısa ve karışık —
     karışık pratik (interleaving) blok pratiğinden iyi tutuyor.
     ═══════════════════════════════════════════════════════════ */
  Ekran.gunsonu = function (g) {
    Uygulama.baslik(g, 'Gün sonu', 'Bugün dokunduğun her şeyden birer parça', '#/');

    var d = Atlas.Gunluk.gun();
    if (!d.sayac) {
      g.appendChild(UI.bos('🌙', 'Bugün henüz çalışmadın',
        'Gün sonu pratiği, gün içinde dokunduğun malzemeyi karıştırıp tekrar sorar. Önce biraz çalış.',
        { ad: 'Bugünün planı', fn: function () { Uygulama.git('#/'); } }));
      return;
    }

    g.appendChild(e('div', { class: 'kart parlak', style: 'margin-bottom:14px' }, [
      e('div', { class: 'izgara iz-3', style: 'margin-bottom:12px' }, [
        UI.ist(d.sayac || 0, 'tekrar'),
        UI.ist(d.dogru || 0, 'doğru', 'var(--ok)'),
        UI.ist(d.yanlis || 0, 'yanlış', d.yanlis ? 'var(--bad)' : null)
      ]),
      e('p', { class: 'kucuk-yazi', style: 'margin:0' },
        'Gün sonu turu bugün dokunduğun kalemleri karıştırarak sorar. Karışık pratik, aynı konuyu ' +
        'blok blok çalışmaktan daha zor gelir ama kalıcılığı belirgin biçimde artırır.')
    ]));

    g.appendChild(UI.yukleniyor(3));
    karmaListe().then(function (liste) {
      UI.bosalt(g);
      Uygulama.baslik(g, 'Gün sonu', liste.length + ' kalem hazır', '#/');
      if (!liste.length) {
        g.appendChild(UI.bos('🌙', 'Karma liste boş', 'Bugün SRS kaydı oluşan bir kalem bulamadım.'));
        return;
      }
      g.appendChild(e('button', {
        class: 'dg ana tam', style: 'margin-bottom:12px',
        onclick: function () {
          UI.bosalt(g);
          oturumBaslat(g, { liste: Veri.karistir(liste), geriYol: '#/gunsonu', kaynak: 'gunsonu' });
        }
      }, '🌙 Gün sonu turunu başlat'));

      var onizleme = e('div', { style: 'display:grid;gap:6px' });
      liste.slice(0, 10).forEach(function (c) {
        onizleme.appendChild(e('div', { class: 'satir-kart' }, [
          e('span', { style: 'flex:1;min-width:0' }, [
            e('b', { style: 'display:block;font-size:14px' }, c.en),
            e('span', 'kucuk-yazi', c.tr || '')
          ])
        ]));
      });
      g.appendChild(onizleme);
    });

    function karmaListe() {
      var h = Atlas.SRS.tumu(), bugun = Atlas.bugun();
      var bugunkuler = [];
      for (var k in h) {
        if (k.indexOf('c:') !== 0) continue;
        if (Atlas.bugun(h[k].son) === bugun) bugunkuler.push(k.slice(2));
      }
      if (!bugunkuler.length) {
        /* bugün cümle çalışılmadıysa vadesi gelenlerden al */
        bugunkuler = Atlas.SRS.vadesiGelen('c').slice(0, 12).map(function (v) { return v.id; });
      }
      return Veri.cumlelerByIds(bugunkuler.slice(0, 15));
    }
  };

  /* ═══════════════════════════════════════════════════════════
     GÜNÜN KONUŞMA MALZEMESİ
     Her gün bir konu, üç soru, kalıp cümleler ve kelime desteği.
     Konu günün tarihinden türetilir — herkeste aynı, her gün farklı.
     ═══════════════════════════════════════════════════════════ */
  var KONULAR = [
    { ad: 'Sabah rutinin', ikon: '☀️', sorular: ['What time do you usually wake up?', 'What is the first thing you do in the morning?', 'Do you prefer tea or coffee, and why?'], kalip: ['I usually wake up at…', 'The first thing I do is…', 'I would rather… than…'] },
    { ad: 'İş ve okul', ikon: '💼', sorular: ['What do you do for a living?', 'What is the hardest part of your job?', 'How has your work changed in the last few years?'], kalip: ['I work as a…', 'The hardest part is…', 'It used to be… but now…'] },
    { ad: 'Seyahat', ikon: '✈️', sorular: ['What is the best place you have visited?', 'Do you prefer travelling alone or with friends?', 'Where would you go if money was not a problem?'], kalip: ['The best place I have been to is…', 'I would rather travel…', 'If I had…, I would…'] },
    { ad: 'Yemek', ikon: '🍽️', sorular: ['What is your favourite dish to cook?', 'Is there a food you could never eat?', 'How often do you eat out?'], kalip: ['My favourite dish is…', 'I could never eat…', 'I eat out about… a week'] },
    { ad: 'Teknoloji', ikon: '📱', sorular: ['Which app do you use the most?', 'Has technology made life easier or harder?', 'What device could you not live without?'], kalip: ['The app I use most is…', 'On the one hand… on the other hand…', "I could not live without…"] },
    { ad: 'Boş zaman', ikon: '🎬', sorular: ['What did you do last weekend?', 'What kind of films do you enjoy?', 'Do you have a hobby you would like to start?'], kalip: ['Last weekend I…', 'I am really into…', 'I have always wanted to…'] },
    { ad: 'Gelecek planların', ikon: '🎯', sorular: ['What are you planning to do this year?', 'Where do you see yourself in five years?', 'Is there a skill you want to learn?'], kalip: ['I am planning to…', 'In five years I hope to…', 'I would like to learn how to…'] }
  ];

  Ekran.konusma = function (g) {
    var gunNo = Math.floor(new Date(Atlas.bugun() + 'T00:00').getTime() / 86400000);
    var konu = KONULAR[gunNo % KONULAR.length];

    Uygulama.baslik(g, 'Günün konuşması', konu.ikon + '  ' + konu.ad, '#/');

    var av = UI.avatar(104);
    av.style.margin = '0 auto 14px';
    g.appendChild(av);

    g.appendChild(e('div', 'bolum-ad', 'Bugünün soruları'));
    var sorularKap = e('div', { style: 'display:grid;gap:9px;margin-bottom:16px' });
    konu.sorular.forEach(function (s, i) {
      var cevapKap = e('div', { style: 'margin-top:10px;display:none' });
      var kart = e('div', { class: 'kart gir gir-' + (i + 1) }, [
        e('div', { style: 'display:flex;align-items:flex-start;gap:10px' }, [
          e('span', { style: 'font-size:19px' }, ['1️⃣', '2️⃣', '3️⃣'][i] || '·'),
          e('div', { class: 'en-metin', style: 'flex:1;font-size:16.5px;text-align:left' },
            UI.kelimelestir(s, function (w, ev) { ev.stopPropagation(); UI.kelimeBalonu(w, ev); })),
          e('button', {
            class: 'dg kucuk', onclick: function () {
              av.konusuyor(true);
              Ses.konus(s, { baglam: 'en', agiz: function (k) { av.agiz(k); }, bitti: function () { av.konusuyor(false); } });
            }
          }, '🔊')
        ]),
        cevapKap
      ]);
      kart.appendChild(e('button', {
        class: 'dg kucuk tam', style: 'margin-top:10px',
        onclick: function () { cevapla(s, cevapKap, this); }
      }, Ses.destek().stt ? '🎙️ Sesli cevapla' : '⌨️ Yazarak cevapla'));
      sorularKap.appendChild(kart);
    });
    g.appendChild(sorularKap);

    g.appendChild(e('div', 'bolum-ad', 'İşine yarayacak kalıplar'));
    var kalipKap = e('div', { style: 'display:grid;gap:7px;margin-bottom:16px' });
    konu.kalip.forEach(function (k) {
      kalipKap.appendChild(e('div', {
        class: 'satir-kart', style: 'cursor:pointer',
        onclick: function () { Ses.konus(k.replace('…', ''), { baglam: 'en' }); }
      }, [
        e('span', { style: 'flex:1;font-size:14.5px;font-weight:650' }, k),
        e('span', { style: 'color:var(--ink-3)' }, '🔊')
      ]));
    });
    g.appendChild(kalipKap);

    g.appendChild(e('div', { style: 'display:grid;gap:8px' }, [
      e('button', {
        class: 'dg ana tam',
        onclick: function () { Uygulama.git('#/sohbet/arkadas'); }
      }, '💬 Bu konuyu sohbette aç'),
      e('button', {
        class: 'dg tam',
        onclick: function () { Uygulama.git('#/studyo'); }
      }, '🌊 Cevabını stüdyoda çöz')
    ]));

    function cevapla(soru, kap, dugme) {
      kap.style.display = 'block';
      UI.bosalt(kap);
      if (Ses.destek().stt) {
        dugme.disabled = true; dugme.textContent = '🎙️ Dinliyorum…';
        var durum = e('div', { class: 'kucuk-yazi' }, 'Konuş…');
        kap.appendChild(durum);
        Ses.dinle({ dil: 'en', kismi: function (t) { durum.textContent = '“' + t + '”'; } })
          .then(function (metin) {
            dugme.disabled = false; dugme.textContent = '🎙️ Tekrar cevapla';
            if (!metin) { durum.textContent = 'Ses alınamadı'; return; }
            degerlendir(soru, metin, kap);
          }).catch(function () {
            dugme.disabled = false; dugme.textContent = '🎙️ Sesli cevapla';
            durum.textContent = 'Tanıma çalışmadı';
          });
      } else {
        var alan = e('textarea', { class: 'alan', rows: '2', placeholder: 'Your answer in English…' });
        kap.appendChild(alan);
        kap.appendChild(e('button', {
          class: 'dg ana tam', style: 'margin-top:8px',
          onclick: function () { if (alan.value.trim()) degerlendir(soru, alan.value.trim(), kap); }
        }, 'Gönder'));
      }
    }

    function degerlendir(soru, cevap, kap) {
      UI.bosalt(kap);
      kap.appendChild(e('div', { class: 'balon ben', style: 'justify-self:stretch;max-width:100%' }, cevap));
      Atlas.Gunluk.ekle('sayac', 1, 'konusma');
      Mastery.kaydet('konusma:' + Atlas.bugun(), 'akicilik', cevap.split(/\s+/).length >= 5, { kaynak: 'konusma' });

      if (!AI.anahtarVar()) {
        kap.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin-top:8px' },
          'Cevabın kaydedildi. Geri bildirim için Ayarlar’dan bir AI anahtarı ekleyebilirsin.'));
        return;
      }
      var y = e('div', { class: 'balon o yaziyor' }, [e('i'), e('i'), e('i')]);
      kap.appendChild(y);
      AI.cagir([
        {
          role: 'system', content: [
            'Öğrenci bir İngilizce konuşma sorusuna cevap verdi. Seviyesi ' + (Atlas.Profil.al().seviye || 'A2') + '.',
            'Kısa geri bildirim ver, Türkçe: 1) iyi olan ne, 2) bir düzeltme (varsa) kural ve nedeniyle,',
            '3) aynı cevabın daha doğal bir söyleyişi [[böyle işaretle]].',
            'En fazla 5 satır. Sadece Türkçe ve İngilizce kullan.'
          ].join(' ')
        },
        { role: 'user', content: 'SORU: ' + soru + '\nCEVAP: ' + cevap }
      ], { sicaklik: 0.4, uzunluk: 500 }).then(function (m) {
        y.remove();
        var b = e('div', { class: 'balon o', style: 'justify-self:stretch;max-width:100%' });
        b.appendChild(AI.balonMetni(m));
        kap.appendChild(b);
      }).catch(function (h) {
        y.remove();
        kap.appendChild(e('p', 'kucuk-yazi', AI.hataMesaji(h)));
      });
    }
  };
})(window);
