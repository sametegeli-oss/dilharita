/* ═══════════════════════════════════════════════════════════════
   ATLAS · KOÇ BALONU · ÖĞRETMEN ANAYASASI · TELAFİ
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  /* ═══════════════════════════════════════════════════════════
     ÖĞRETMEN ANAYASASI
     Öğretmenin her AI çağrısında uyacağı kalıcı kurallar.
     Kullanıcı burayı değiştirebilir; değiştirmediği sürece
     varsayılan davranış geçerli. Ayrı bir katman olmasının sebebi:
     prompt her yerde yeniden yazılmasın, tek yerden yönetilsin.
     ═══════════════════════════════════════════════════════════ */
  var VARSAYILAN_ANAYASA = {
    dil: 'tr',              /* anlatım dili */
    uzunluk: 'orta',        /* kisa | orta | uzun */
    ton: 'sicak',           /* sicak | notr | sert */
    duzeltme: 'yapisal',    /* hizli | yapisal */
    ornekSayisi: 2,
    hedefOdak: '',          /* kullanıcının kendi yazdığı odak */
    tabular: 'Öğrenciyi asla küçümseme. Hata sayısını sayma, ne yapacağını söyle.'
  };

  var Anayasa = {
    al: function () { return Object.assign({}, VARSAYILAN_ANAYASA, Atlas.oku('anayasa', {})); },
    kur: function (y) {
      var a = Object.assign(Anayasa.al(), y || {});
      Atlas.yaz('anayasa', a);
      Atlas.olay('anayasa', a);
      return a;
    },
    sifirla: function () { Atlas.sil('anayasa'); Atlas.olay('anayasa', Anayasa.al()); },

    /* AI'ya eklenecek metin */
    metin: function () {
      var a = Anayasa.al();
      var p = [];
      p.push(a.dil === 'en'
        ? 'Explain in English; keep target sentences marked with [[ ]].'
        : 'Anlatım, düzeltme ve övgünün tamamı Türkçe olacak.');
      p.push({ kisa: 'Cevapların çok kısa olsun: en fazla 3 satır.',
        orta: 'Cevapların orta uzunlukta olsun: 4-7 satır.',
        uzun: 'Ayrıntılı anlat: gerekiyorsa 10 satıra kadar çıkabilirsin.' }[a.uzunluk] || '');
      p.push({ sicak: 'Ton: sıcak ve cesaretlendirici, ama abartılı övgü yok.',
        notr: 'Ton: nötr ve doğrudan.',
        sert: 'Ton: net ve talepkâr; hatayı yumuşatmadan söyle.' }[a.ton] || '');
      p.push(a.duzeltme === 'hizli'
        ? 'Düzeltmede yalnız doğrusunu ver, uzun kural anlatma.'
        : 'Düzeltme yapısı: ne yanlış → kural ve NEDENİ (2-3 cümle) → doğru cümle → aynı kuralla ikinci örnek → öğrenciden yeni bir cümle iste.');
      p.push('Her açıklamada en fazla ' + (a.ornekSayisi || 2) + ' örnek ver.');
      if (a.hedefOdak) p.push('Öğrencinin özel odağı: ' + a.hedefOdak + '. Mümkün olduğunca buna bağla.');
      if (a.tabular) p.push(a.tabular);
      return p.filter(Boolean).join(' ');
    }
  };
  global.Anayasa = Anayasa;

  /* AI katmanına bağla — öğretmen çağrılarına anayasa eklenir */
  if (global.AI && AI.sohbet) {
    var eskiSohbet = AI.sohbet;
    AI.sohbet = function (senaryo, gecmis, mesaj) {
      if (senaryo && senaryo.ogretmen) {
        var eskiSistem = senaryo.sistem;
        senaryo = Object.assign({}, senaryo, { sistem: eskiSistem + '\n\n' + Anayasa.metin() });
      }
      return eskiSohbet(senaryo, gecmis, mesaj);
    };
  }

  /* ═══════════════════════════════════════════════════════════
     TELAFİ — geri kalmış seviye
     Kullanıcı B1 çalışırken A2'de boşluk bırakmışsa, bu boşluk
     ilerledikçe büyür. Telafi motoru alt seviyelerdeki eksik
     modülleri bulup araya karıştırıyor.
     ═══════════════════════════════════════════════════════════ */
  var Telafi = {
    tespit: function () {
      var im = Veri.indexBellek;
      if (!im) return null;
      var pr = Atlas.Profil.al();
      var suanI = Math.max(0, Atlas.SEVIYELER.indexOf(pr.seviye || 'A1'));
      var srs = Atlas.SRS.tumu();
      var eksikler = [];
      im.modules.forEach(function (m) {
        if (m.ozel) return;
        var i = Atlas.SEVIYELER.indexOf(m.lvl);
        if (i >= suanI) return;                    /* alt seviye değil */
        var p = Atlas.Ilerleme.modul(m.ids, srs);
        if (p.oran < 50) eksikler.push({ modul: m, oran: p.oran });
      });
      eksikler.sort(function (a, b) { return a.oran - b.oran; });
      return eksikler;
    },
    ozet: function () {
      var eksik = Telafi.tespit();
      if (!eksik || !eksik.length) return null;
      var seviyeler = {};
      eksik.forEach(function (x) { seviyeler[x.modul.lvl] = (seviyeler[x.modul.lvl] || 0) + 1; });
      return { adet: eksik.length, seviyeler: seviyeler, ilk: eksik.slice(0, 5) };
    }
  };
  global.Telafi = Telafi;

  Ekran.telafi = function (g) {
    Uygulama.baslik(g, 'Telafi', 'Alt seviyelerde bıraktığın boşluklar', '#/ilerleme');
    g.appendChild(UI.yukleniyor(3));
    Veri.index().then(function () {
      UI.bosalt(g);
      Uygulama.baslik(g, 'Telafi', 'Alt seviyelerde bıraktığın boşluklar', '#/ilerleme');
      var o = Telafi.ozet();
      if (!o) {
        g.appendChild(UI.bos('✨', 'Boşluk yok',
          'Bulunduğun seviyenin altında yarım kalmış modül bulamadım. Temiz ilerliyorsun.',
          { ad: 'Modül haritası', fn: function () { Uygulama.git('#/ogren'); } }));
        return;
      }
      g.appendChild(e('div', { class: 'kart parlak', style: 'margin-bottom:14px' }, [
        e('b', { style: 'display:block;font-size:16px;margin-bottom:6px' }, o.adet + ' modülde boşluk var'),
        e('p', { class: 'kucuk-yazi', style: 'margin:0 0 10px' },
          'Şu an ' + (Atlas.Profil.al().seviye || 'A1') + ' çalışıyorsun ama alt seviyelerde yarım kalmış modüller var. ' +
          'Dilbilgisi katmanlı ilerler: alttaki boşluk üstte hata olarak geri döner. ' +
          'Telafi turu bu modüllerden karışık bir liste kurar.'),
        e('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' },
          Object.keys(o.seviyeler).map(function (lv) {
            return e('span', 'et ' + lv, lv + ' · ' + o.seviyeler[lv] + ' modül');
          }))
      ]));

      g.appendChild(e('button', {
        class: 'dg ana tam', style: 'margin-bottom:14px',
        onclick: function () {
          UI.bosalt(g);
          g.appendChild(UI.yukleniyor(3));
          Promise.all(o.ilk.slice(0, 3).map(function (x) { return Veri.modul(x.modul.f); }))
            .then(function (paketler) {
              UI.bosalt(g);
              var srs = Atlas.SRS.tumu();
              var liste = [];
              paketler.forEach(function (p) {
                liste = liste.concat(p.filter(function (c) { return !srs['c:' + c.id]; }).slice(0, 6));
              });
              if (!liste.length) liste = paketler[0].slice(0, 12);
              oturumBaslat(g, { liste: Veri.karistir(liste), geriYol: '#/telafi', kaynak: 'telafi' });
            });
        }
      }, '🩹 Telafi turunu başlat'));

      g.appendChild(e('div', 'bolum-ad', 'Eksik modüller'));
      var l = e('div', { style: 'display:grid;gap:8px' });
      o.ilk.forEach(function (x) {
        l.appendChild(e('button', {
          class: 'satir-kart', style: 'cursor:pointer;text-align:left;width:100%',
          onclick: function () { Uygulama.git('#/calis/' + x.modul.f); }
        }, [
          e('span', 'et ' + x.modul.lvl, x.modul.lvl),
          e('span', { style: 'flex:1;min-width:0' }, [
            e('b', { style: 'display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, x.modul.mod),
            e('span', 'kucuk-yazi', '%' + x.oran + ' tamamlandı')
          ]),
          e('span', { style: 'color:var(--ink-3)' }, '→')
        ]));
      });
      g.appendChild(l);
    });
  };

  /* ═══════════════════════════════════════════════════════════
     SERİ EKRANI
     ═══════════════════════════════════════════════════════════ */
  Ekran.seri = function (g) {
    var s = Atlas.Seri.al();
    var canli = Atlas.Seri.canli();
    Uygulama.baslik(g, 'Öğrenme çizgin', canli + ' gündür aralıksız', '#/ilerleme');

    /* büyük alev */
    g.appendChild(e('div', { class: 'kart parlak', style: 'text-align:center;padding:28px 20px;margin-bottom:14px' }, [
      e('div', {
        style: 'font-size:76px;line-height:1;animation:nefes 2.4s var(--ez) infinite alternate;display:inline-block;' +
          'filter:drop-shadow(0 0 26px rgba(255,215,110,.55))'
      }, canli > 0 ? '🔥' : '💤'),
      e('div', {
        style: 'font-size:clamp(40px,12vw,64px);font-weight:850;letter-spacing:-.05em;line-height:1;margin-top:8px;' +
          'background:linear-gradient(120deg,var(--gold),#ff9d5c);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent'
      }, String(canli)),
      e('div', { class: 'kucuk-yazi', style: 'font-size:13px;margin-top:2px' }, 'günlük seri'),
      e('p', { class: 'altbaslik', style: 'margin:14px 0 0' }, seriMesaj(canli, s))
    ]));

    /* haftalık şerit */
    g.appendChild(e('div', 'bolum-ad', 'Bu hafta'));
    var son7 = Atlas.Gunluk.son(7);
    var GUNAD = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    var serit = e('div', { class: 'kart', style: 'display:flex;gap:6px;justify-content:space-between' });
    son7.forEach(function (x) {
      var gd = new Date(x.gun + 'T00:00');
      var aktif = (x.veri.sayac || 0) > 0;
      var hedefTam = (x.veri.sayac || 0) >= (Atlas.Profil.al().hedef || 20);
      serit.appendChild(e('div', { style: 'flex:1;text-align:center' }, [
        e('div', {
          style: 'width:100%;aspect-ratio:1;max-width:44px;margin:0 auto 6px;border-radius:13px;display:grid;place-items:center;' +
            'font-size:19px;transition:all .4s var(--sp);' +
            (hedefTam ? 'background:linear-gradient(135deg,var(--gold),#ff9d5c);box-shadow:0 0 18px rgba(255,215,110,.4)'
              : aktif ? 'background:rgba(124,92,255,.28);border:1px solid rgba(124,92,255,.5)'
                : 'background:var(--line)')
        }, hedefTam ? '🔥' : aktif ? '·' : ''),
        e('div', { class: 'kucuk-yazi', style: 'font-size:10.5px' }, GUNAD[gd.getDay()]),
        e('div', { class: 'kucuk-yazi', style: 'font-size:10px' }, String(x.veri.sayac || 0))
      ]));
    });
    g.appendChild(serit);

    /* kilometre taşları */
    g.appendChild(e('div', 'bolum-ad', 'Kilometre taşları'));
    var tas = [3, 7, 14, 30, 60, 100, 200, 365];
    var tk = e('div', 'izgara iz-4');
    tas.forEach(function (n) {
      var ulasildi = (s.enIyi || 0) >= n;
      var suanki = canli >= n;
      tk.appendChild(e('div', {
        class: 'kart', style: 'text-align:center;padding:14px 6px;opacity:' + (ulasildi ? 1 : .38) +
          ';border-color:' + (suanki ? 'rgba(255,215,110,.5)' : '')
      }, [
        e('div', { style: 'font-size:22px' }, ulasildi ? '🏅' : '🔒'),
        e('div', { style: 'font-size:15px;font-weight:850;margin-top:4px' }, n),
        e('div', { class: 'kucuk-yazi', style: 'font-size:10px' }, 'gün')
      ]));
    });
    g.appendChild(tk);

    /* seri koruma */
    g.appendChild(e('div', 'bolum-ad', 'Seri koruma'));
    g.appendChild(e('div', 'kart', [
      e('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:10px' }, [
        e('span', { style: 'font-size:26px' }, '🛡️'),
        e('div', { style: 'flex:1' }, [
          e('b', { style: 'display:block;font-size:15px' }, (s.dondurma || 0) + ' koruma hakkın var'),
          e('span', 'kucuk-yazi', 'Bir gün kaçırırsan seri kırılmaz, hak harcanır')
        ])
      ]),
      e('p', { class: 'kucuk-yazi', style: 'margin:0' },
        'İki gün üst üste kaçırırsan seri sıfırlanır. Bu bir ceza değil ölçüm: aralıklı tekrarın ' +
        'işe yaraması gerçekten süreklilik gerektiriyor. Yoğun bir gününde 5 kalem bile seriyi ayakta tutar.')
    ]));

    /* en iyi */
    g.appendChild(e('div', { class: 'izgara iz-3', style: 'margin-top:14px' }, [
      UI.ist(s.enIyi || 0, 'en iyi seri', 'var(--gold)'),
      UI.ist(Object.keys(Atlas.Gunluk.hepsi()).filter(function (k) {
        return (Atlas.Gunluk.hepsi()[k].sayac || 0) > 0;
      }).length, 'toplam aktif gün'),
      UI.ist(Atlas.SRS.sayim().toplam, 'kalem')
    ]));

    function seriMesaj(n, s2) {
      if (n === 0) return s2.enIyi ? 'Seri kırıldı — en iyin ' + s2.enIyi + ' gündü. Bugün çalışırsan yeniden başlar.'
        : 'Henüz seri başlamadı. Bugün bir tur yaparsan sayaç 1 olur.';
      if (n === 1) return 'İlk gün. Yarın da gelirsen 2 olur; asıl zor kısım ilk hafta.';
      if (n < 7) return n + ' gün oldu. Yedi günü geçen serilerin devam etme olasılığı belirgin biçimde artıyor.';
      if (n < 30) return 'Bir haftayı geçtin. Artık alışkanlık kuruluyor — bu aralıkta kaçırılan gün en pahalıya mal olan gün.';
      if (n < 100) return n + ' gün. Bu noktada uygulama sana değil, sen uygulamaya alıştın.';
      return n + ' gün. Bu, çoğu dil öğrenme uygulamasının kullanıcılarının ulaşamadığı bir yer.';
    }
  };

  /* ═══════════════════════════════════════════════════════════
     KOÇ BALONU — her ekranda kayan öğretmen
     ═══════════════════════════════════════════════════════════ */
  var Balon = {
    el: null,
    kapali: function () { return Atlas.oku('koc-balon-kapali', false); },

    goster: function (o) {
      /* o: {metin, ikon, dugme:{ad,fn}, kalici} */
      Balon.kapat();
      if (Balon.kapali() && !o.zorla) return null;
      var av = UI.avatar(46);
      var b = e('div', { class: 'koc-balon' }, [
        av,
        e('div', { style: 'flex:1;min-width:0' }, [
          e('p', { style: 'margin:0;font-size:13.5px;line-height:1.55' }, o.metin),
          o.dugme ? e('button', {
            class: 'dg kucuk ana', style: 'margin-top:8px',
            onclick: function () { Balon.kapat(); o.dugme.fn(); }
          }, o.dugme.ad) : null
        ]),
        e('button', {
          class: 'koc-kapat', title: 'Kapat',
          onclick: function (ev) { ev.stopPropagation(); Balon.kapat(); }
        }, '✕')
      ]);
      document.body.appendChild(b);
      Balon.el = b;
      if (o.sesli !== false && Atlas.Ayar.al().otoSes) {
        av.konusuyor(true);
        Ses.konus(o.metin, {
          baglam: 'tr', agiz: function (k) { av.agiz(k); },
          bitti: function () { av.konusuyor(false); }
        });
      }
      if (!o.kalici) setTimeout(function () { if (Balon.el === b) Balon.kapat(); }, 14000);
      return b;
    },

    kapat: function () {
      if (Balon.el) {
        var b = Balon.el; Balon.el = null;
        b.style.animation = 'cik .3s var(--ez) forwards';
        setTimeout(function () { b.remove(); }, 320);
      }
    },

    /* duruma göre kendiliğinden konuşur */
    denetle: function (ekran) {
      if (Balon.kapali()) return;
      var bugunGosterildi = Atlas.oku('koc-balon-gun', '');
      var s = Atlas.SRS.sayim();
      var g = Atlas.Gunluk.gun();
      var pr = Atlas.Profil.al();

      /* günde bir kez ana ekranda karşıla */
      if (ekran === 'ev' && bugunGosterildi !== Atlas.bugun()) {
        Atlas.yaz('koc-balon-gun', Atlas.bugun());
        var telafi = Telafi.ozet && Telafi.ozet();
        if (s.vade > 30) {
          Balon.goster({
            metin: s.vade + ' tekrar birikmiş. Bugün yeni cümleye hiç girmeden sadece bunları eritsek, yarın çok daha rahat olursun.',
            dugme: { ad: 'Tekrara git', fn: function () { Uygulama.git('#/tekrar'); } }
          });
        } else if (telafi && telafi.adet >= 3) {
          Balon.goster({
            metin: 'Alt seviyelerde ' + telafi.adet + ' modülde boşluk görüyorum. Dilbilgisi katmanlı ilerler; alttaki boşluk üstte hata olarak geri döner.',
            dugme: { ad: 'Telafi turu', fn: function () { Uygulama.git('#/telafi'); } }
          });
        } else if (Atlas.Seri.canli() >= 7) {
          Balon.goster({
            metin: Atlas.Seri.canli() + ' gündür aralıksız çalışıyorsun. Aralıklı tekrarın işe yaraması tam da bu sürekliliğe bağlı.',
            dugme: { ad: 'Çizgimi gör', fn: function () { Uygulama.git('#/seri'); } }, sesli: false
          });
        } else if (!g.sayac) {
          Balon.goster({
            metin: 'Bugüne başlamadın. Hedefin ' + (pr.hedef || 20) + ' kalem; istersen küçük bir turla ısınalım.',
            dugme: { ad: 'Başla', fn: function () { Uygulama.git(Atlas.Koc.plan().adimlar[0].yol); } }
          });
        }
      }
    },

    /* elle çağrı — her ekranda sağ alttaki düğme */
    sor: function () {
      var s = Atlas.SRS.sayim();
      var zayif = Mastery.profilZayifi();
      var metin = Atlas.Koc.tavsiye();
      if (!AI.anahtarVar()) {
        Balon.goster({ metin: metin, kalici: true, zorla: true });
        return;
      }
      var b = Balon.goster({ metin: 'Bir saniye, durumuna bakıyorum…', kalici: true, zorla: true, sesli: false });
      AI.cagir([
        {
          role: 'system', content: 'Sen kısa konuşan bir çalışma koçusun. Türkçe yaz, en fazla 3 cümle. ' +
            'Somut bir sonraki adım öner. Klişe kullanma. ' + Anayasa.metin()
        },
        {
          role: 'user', content: 'Durum: ' + s.toplam + ' kalem, ' + s.ogrenildi + ' kalıcı, ' + s.vade + ' vadesi gelmiş. ' +
            'Seri ' + Atlas.Seri.canli() + ' gün. Bugün ' + (Atlas.Gunluk.gun().sayac || 0) + ' tekrar. ' +
            (zayif ? 'En zayıf beceri: ' + Mastery.beceriAdi(zayif) + '.' : '')
        }
      ], { sicaklik: 0.6, uzunluk: 260 }).then(function (m) {
        Balon.kapat();
        Balon.goster({ metin: m, kalici: true, zorla: true });
      }).catch(function () {
        Balon.kapat();
        Balon.goster({ metin: metin, kalici: true, zorla: true });
      });
    }
  };
  global.KocBalon = Balon;

  /* yönlendirme sonrası denetle */
  if (global.Atlas) {
    var eskiYonlendir = null;
    setTimeout(function () {
      if (!global.Uygulama) return;
      eskiYonlendir = Uygulama.yonlendir;
      Uygulama.yonlendir = function () {
        Balon.kapat();
        eskiYonlendir.apply(Uygulama, arguments);
        setTimeout(function () { Balon.denetle(Uygulama.suanki); }, 900);
      };
      /* açılıştaki ilk ekran için de çalıştır */
      setTimeout(function () { Balon.denetle(Uygulama.suanki); }, 1400);
    }, 300);
  }

  /* ═══════════════════════════════════════════════════════════
     ÖĞRETMEN ANAYASASI EKRANI
     ═══════════════════════════════════════════════════════════ */
  Ekran.anayasa = function (g) {
    Uygulama.baslik(g, 'Öğretmen anayasası', 'Öğretmenin her cevapta uyacağı kurallar', '#/ayarlar');
    var a = Anayasa.al();

    function bolum(ad, alt) {
      var k = e('div', { class: 'kart', style: 'margin-bottom:12px' });
      k.appendChild(e('b', { style: 'display:block;font-size:15px;font-weight:800;margin-bottom:' + (alt ? '4px' : '10px') }, ad));
      if (alt) k.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin:0 0 10px' }, alt));
      return k;
    }
    function secim(secenekler, mevcut, fn) {
      var kap = e('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
      secenekler.forEach(function (o) {
        kap.appendChild(e('button', {
          class: 'cip', style: mevcut === o[0] ? 'border-color:var(--brand);color:var(--brand)' : '',
          onclick: function () { fn(o[0]); Uygulama.yonlendir(); }
        }, o[1]));
      });
      return kap;
    }

    var b1 = bolum('Anlatım dili', 'Öğretilen malzeme her hâlükârda İngilizce kalır.');
    b1.appendChild(secim([['tr', '🇹🇷 Türkçe'], ['en', '🇬🇧 İngilizce']], a.dil, function (v) { Anayasa.kur({ dil: v }); }));
    g.appendChild(b1);

    var b2 = bolum('Cevap uzunluğu');
    b2.appendChild(secim([['kisa', 'Kısa'], ['orta', 'Orta'], ['uzun', 'Ayrıntılı']], a.uzunluk, function (v) { Anayasa.kur({ uzunluk: v }); }));
    g.appendChild(b2);

    var b3 = bolum('Ton');
    b3.appendChild(secim([['sicak', 'Sıcak'], ['notr', 'Nötr'], ['sert', 'Talepkâr']], a.ton, function (v) { Anayasa.kur({ ton: v }); }));
    g.appendChild(b3);

    var b4 = bolum('Düzeltme biçimi',
      '“Yapısal” beş adımlı: ne yanlış → kural ve nedeni → doğrusu → ikinci örnek → senden yeni cümle.');
    b4.appendChild(secim([['yapisal', 'Yapısal (önerilen)'], ['hizli', 'Sadece doğrusu']], a.duzeltme, function (v) { Anayasa.kur({ duzeltme: v }); }));
    g.appendChild(b4);

    var b5 = bolum('Kendi odağın', 'Öğretmen mümkün olduğunca buna bağlayacak. Örnek: “yazılım mülakatları”, “tıp İngilizcesi”.');
    var odak = e('input', { class: 'alan', value: a.hedefOdak || '', placeholder: 'İsteğe bağlı' });
    odak.onchange = function () { Anayasa.kur({ hedefOdak: odak.value.trim() }); };
    b5.appendChild(odak);
    g.appendChild(b5);

    var b6 = bolum('Değişmez kural', 'Bu satır her çağrıya aynen eklenir.');
    var tabu = e('textarea', { class: 'alan', rows: '3' });
    tabu.value = a.tabular || '';
    tabu.onchange = function () { Anayasa.kur({ tabular: tabu.value.trim() }); };
    b6.appendChild(tabu);
    g.appendChild(b6);

    g.appendChild(e('div', 'bolum-ad', 'Oluşan talimat'));
    g.appendChild(e('div', { class: 'kart', style: 'font-size:12.5px;line-height:1.7;color:var(--ink-2);white-space:pre-wrap;font-family:var(--mono)' },
      Anayasa.metin()));

    g.appendChild(e('button', {
      class: 'dg sade tam', style: 'margin-top:12px',
      onclick: function () {
        UI.onay('Anayasa varsayılana dönsün mü?', function () { Anayasa.sifirla(); Uygulama.yonlendir(); });
      }
    }, '↺ Varsayılana dön'));
  };
})(window);
