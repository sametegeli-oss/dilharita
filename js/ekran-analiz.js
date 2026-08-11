/* ═══════════════════════════════════════════════════════════════
   ATLAS · İLERLEME · RAPOR · HATA DEFTERİ · AKTİVİTE · SEVİYE TESTİ
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  /* ═══════════════════════════════════════════════════════════
     İLERLEME HARİTASI
     ═══════════════════════════════════════════════════════════ */
  Ekran.ilerleme = function (g) {
    Uygulama.baslik(g, 'İlerleme', 'Nerede olduğunu tek ekranda gör', '#/');

    var s = Atlas.SRS.sayim();
    var seri = Atlas.Seri.al();
    var son30 = Atlas.Gunluk.son(30);
    var toplamTekrar = son30.reduce(function (a, b) { return a + (b.veri.sayac || 0); }, 0);

    /* üst özet */
    var kah = e('div', { class: 'kahraman', style: 'margin-bottom:16px' });
    var kalicilik = s.toplam ? Math.round(s.ogrenildi / s.toplam * 100) : 0;
    kah.appendChild(e('div', 'satir', [
      e('div', { style: 'flex:1;min-width:200px' }, [
        e('h1', { style: 'font-size:clamp(22px,5.6vw,32px)' }, s.toplam + ' kalem hafızanda'),
        e('p', null, s.ogrenildi + ' tanesi 21 günden uzun aralıklara geçmiş — yani kalıcı sayılır. ' +
          s.vade + ' tanesi şu an vadesi gelmiş durumda.')
      ]),
      UI.halka(kalicilik, { boy: 118, kalinlik: 10, sayi: '%' + kalicilik, etiket: 'kalıcı' })
    ]));
    g.appendChild(kah);

    var iz = e('div', { class: 'izgara iz-2', style: 'margin-bottom:8px' });
    iz.appendChild(UI.ist(seri.gun || 0, 'güncel seri', 'var(--gold)'));
    iz.appendChild(UI.ist(seri.enIyi || 0, 'en iyi seri'));
    iz.appendChild(UI.ist(toplamTekrar, '30 günde tekrar'));
    iz.appendChild(UI.ist(Atlas.Ilerleme.bitenModulSayisi(), 'biten modül'));
    g.appendChild(iz);

    /* seviye çubukları */
    g.appendChild(e('div', 'bolum-ad', 'Seviyeler'));
    var svKap = e('div', { style: 'display:grid;gap:10px' });
    svKap.appendChild(UI.yukleniyor(3));
    g.appendChild(svKap);

    Veri.index().then(function () {
      var ozet = Atlas.Ilerleme.seviyeOzeti();
      UI.bosalt(svKap);
      Atlas.SEVIYELER.forEach(function (lv, n) {
        var o = ozet[lv];
        var oran = o.cumle ? Math.round(o.calisilan / o.cumle * 100) : 0;
        svKap.appendChild(e('div', {
          class: 'kart tikla gir gir-' + Math.min(6, n + 1),
          onclick: function () { Atlas.yaz('secili-seviye', lv); Uygulama.git('#/ogren'); }
        }, [
          e('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px' }, [
            e('span', 'et ' + lv, lv),
            e('b', { style: 'flex:1;font-size:14.5px;font-weight:700' }, o.biten + ' / ' + o.modul + ' modül'),
            e('span', { style: 'font-size:13px;font-weight:800;color:var(--ink-3)' }, oran + '%')
          ]),
          UI.cubuk(oran, 'linear-gradient(90deg,var(--lv-' + lv + '),var(--brand-2))'),
          e('div', { class: 'kucuk-yazi', style: 'margin-top:8px' }, o.calisilan + ' / ' + o.cumle + ' cümle')
        ]));
      });
    });

    /* rozet duvarı */
    g.appendChild(e('div', 'bolum-ad', 'Rozetler'));
    var kz = Atlas.Rozet.kazanilan();
    var rz = e('div', 'izgara iz-4');
    Atlas.Rozet.TANIM.forEach(function (r) {
      var var_ = !!kz[r.id];
      rz.appendChild(e('div', {
        class: 'kart', title: r.aciklama,
        style: 'text-align:center;padding:14px 8px;opacity:' + (var_ ? 1 : .35) +
          ';border-color:' + (var_ ? 'rgba(255,215,110,.35)' : '')
      }, [
        e('div', { style: 'font-size:28px;filter:' + (var_ ? 'none' : 'grayscale(1)') }, r.ikon),
        e('div', { style: 'font-size:11.5px;font-weight:750;margin-top:5px' }, r.ad),
        e('div', { class: 'kucuk-yazi', style: 'font-size:10.5px;margin-top:2px' }, r.aciklama)
      ]));
    });
    g.appendChild(rz);

    /* kısayollar */
    g.appendChild(e('div', 'bolum-ad', 'Daha derine in'));
    var kisa = e('div', 'izgara iz-3');
    [['📊', '30 günlük rapor', '#/rapor'], ['🧯', 'Hata defteri', '#/hatalar'],
     ['⏱️', 'Bugünkü aktivite', '#/aktivite'], ['📝', 'Seviye testi', '#/seviye-testi']].forEach(function (k) {
      kisa.appendChild(e('button', {
        class: 'kart tikla', style: 'text-align:center;padding:18px 10px',
        onclick: function () { Uygulama.git(k[2]); }
      }, [
        e('div', { style: 'font-size:26px;margin-bottom:6px' }, k[0]),
        e('div', { style: 'font-size:13px;font-weight:700' }, k[1])
      ]));
    });
    g.appendChild(kisa);
  };

  /* ═══════════════════════════════════════════════════════════
     30 GÜNLÜK RAPOR
     ═══════════════════════════════════════════════════════════ */
  Ekran.rapor = function (g) {
    Uygulama.baslik(g, '30 günlük rapor', 'Ne çalıştın, nerede takıldın, ne unutacaksın', '#/ilerleme');

    var son = Atlas.Gunluk.son(30);
    var sayilar = son.map(function (x) { return x.veri.sayac || 0; });
    var dogrular = son.map(function (x) { return x.veri.dogru || 0; });
    var yanlislar = son.map(function (x) { return x.veri.yanlis || 0; });
    var toplam = sayilar.reduce(function (a, b) { return a + b; }, 0);
    var tD = dogrular.reduce(function (a, b) { return a + b; }, 0);
    var tY = yanlislar.reduce(function (a, b) { return a + b; }, 0);
    var basari = (tD + tY) ? Math.round(tD / (tD + tY) * 100) : 0;
    var aktifGun = sayilar.filter(Boolean).length;

    var iz = e('div', { class: 'izgara iz-2', style: 'margin-bottom:16px' });
    iz.appendChild(UI.ist(toplam, 'tekrar'));
    iz.appendChild(UI.ist(aktifGun, 'aktif gün'));
    iz.appendChild(UI.ist('%' + basari, 'başarı', basari >= 75 ? 'var(--ok)' : basari >= 50 ? 'var(--warn)' : 'var(--bad)'));
    iz.appendChild(UI.ist(aktifGun ? Math.round(toplam / aktifGun) : 0, 'gün ortalaması'));
    g.appendChild(iz);

    /* günlük aktivite */
    g.appendChild(e('div', 'bolum-ad', 'Günlük aktivite'));
    var k1 = e('div', 'kart');
    k1.appendChild(UI.sutunGrafik(sayilar, son.map(function (x) { return x.gun; })));
    k1.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-top:10px;display:flex;justify-content:space-between' }, [
      e('span', null, son[0].gun.slice(5)),
      e('span', null, 'bugün')
    ]));
    g.appendChild(k1);

    /* doğru/yanlış eğilimi */
    g.appendChild(e('div', 'bolum-ad', 'Doğruluk eğilimi'));
    var k2 = e('div', 'kart');
    var oranlar = son.map(function (x) {
      var d = x.veri.dogru || 0, y = x.veri.yanlis || 0;
      return (d + y) ? Math.round(d / (d + y) * 100) : 0;
    });
    k2.appendChild(UI.cizgiGrafik(oranlar, { renk: '#34e2a0' }));
    k2.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-top:8px' },
      'Yükselen eğri, aralıkların doğru ayarlandığını gösterir. Sürekli %60 altındaysa günlük hedefi düşürmek daha iyi sonuç verir.'));
    g.appendChild(k2);

    /* unutma eğrisi / gelecek yük */
    g.appendChild(e('div', 'bolum-ad', 'Önümüzdeki 30 gün · tekrar yükü'));
    var dagilim = Atlas.SRS.vadeDagilimi(30);
    var k3 = e('div', 'kart');
    k3.appendChild(UI.sutunGrafik(dagilim, dagilim.map(function (_, i) { return i === 0 ? 'bugün' : '+' + i; })));
    var enYogun = dagilim.indexOf(Math.max.apply(null, dagilim));
    k3.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-top:10px' },
      'En yoğun gün: ' + (enYogun === 0 ? 'bugün' : enYogun + ' gün sonra') + ' · ' + dagilim[enYogun] + ' kalem. ' +
      'Yığılma büyükse birkaç günü öne çekip eritmek işi kolaylaştırır.'));
    g.appendChild(k3);

    /* hata eğilimi */
    var egilim = Atlas.Hata.egilim().slice(0, 10);
    if (egilim.length) {
      g.appendChild(e('div', 'bolum-ad', 'En çok takıldığın konular'));
      var k4 = e('div', { class: 'kart', style: 'display:grid;gap:10px' });
      var mx = egilim[0].n;
      egilim.forEach(function (x, n) {
        k4.appendChild(e('div', { class: 'gir gir-' + Math.min(6, n + 1) }, [
          e('div', { style: 'display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:5px' }, [
            e('span', { style: 'font-weight:650' }, x.ad),
            e('span', { style: 'color:var(--ink-3);font-weight:800' }, x.n)
          ]),
          UI.cubuk(x.n / mx * 100, 'linear-gradient(90deg,var(--bad),var(--warn))')
        ]));
      });
      k4.appendChild(e('button', {
        class: 'dg tam', style: 'margin-top:6px',
        onclick: function () { Uygulama.git('#/hatalar'); }
      }, 'Hata defterini aç →'));
      g.appendChild(k4);
    }

    /* tür dağılımı */
    var s = Atlas.SRS.sayim();
    g.appendChild(e('div', 'bolum-ad', 'Ne çalışıyorsun'));
    var k5 = e('div', { class: 'kart', style: 'display:grid;gap:10px' });
    [['Cümle', s.cumle, 'var(--brand)'], ['Kelime', s.kelime, 'var(--brand-2)'], ['Phrasal verb', s.pv, 'var(--brand-3)']].forEach(function (t) {
      var oran = s.toplam ? t[1] / s.toplam * 100 : 0;
      k5.appendChild(e('div', null, [
        e('div', { style: 'display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:5px' }, [
          e('span', { style: 'font-weight:650' }, t[0]),
          e('span', { style: 'color:var(--ink-3);font-weight:800' }, t[1])
        ]),
        UI.cubuk(oran, t[2])
      ]));
    });
    g.appendChild(k5);

    /* AI özeti */
    if (AI.anahtarVar()) {
      var ozetKart = e('div', { class: 'kart parlak', style: 'margin-top:14px' });
      var dugme = e('button', { class: 'dg ana tam' }, '🤖 Koç yorumu al');
      dugme.onclick = function () {
        dugme.disabled = true; dugme.textContent = '⏳ Yazılıyor…';
        AI.gunOzeti().then(function (m) {
          UI.bosalt(ozetKart);
          ozetKart.appendChild(e('b', { style: 'display:block;margin-bottom:8px' }, '🤖 Koç yorumu'));
          var d = AI.balonMetni(m);
          d.style.cssText = 'font-size:14.5px;line-height:1.75;color:var(--ink-2);white-space:pre-wrap';
          ozetKart.appendChild(d);
        }).catch(function (h) {
          dugme.disabled = false; dugme.textContent = '🤖 Koç yorumu al';
          UI.bildir(AI.hataMesaji(h), 'bad', 5000);
        });
      };
      ozetKart.appendChild(dugme);
      g.appendChild(ozetKart);
    }

    g.appendChild(e('button', {
      class: 'dg sade tam', style: 'margin-top:14px',
      onclick: function () { print(); }
    }, '🖨️ Raporu yazdır / PDF kaydet'));
  };

  /* ═══════════════════════════════════════════════════════════
     HATA DEFTERİ
     ═══════════════════════════════════════════════════════════ */
  Ekran.hatalar = function (g) {
    var hepsi = Atlas.Hata.hepsi();
    Uygulama.baslik(g, 'Hata defteri', hepsi.length + ' kayıt', '#/ilerleme');

    if (!hepsi.length) {
      g.appendChild(UI.bos('🧼', 'Defter temiz', 'Yanlış yaptığın her cümle buraya düşer ve doğru yaptığında kendiliğinden silinir.',
        { ad: 'Çalışmaya başla', fn: function () { Uygulama.git('#/ogren'); } }));
      return;
    }

    /* filtreler */
    var filtre = 'hepsi';
    var egilim = Atlas.Hata.egilim().slice(0, 8);
    var serit = e('div', 'seviye-serit');
    var secenekler = [['hepsi', 'Hepsi']].concat(egilim.map(function (x) { return [x.ad, x.ad + ' (' + x.n + ')']; }));
    secenekler.forEach(function (o) {
      serit.appendChild(e('button', {
        class: filtre === o[0] ? 'aktif' : '',
        onclick: function () {
          filtre = o[0];
          UI.qq('.seviye-serit button').forEach(function (b) { b.classList.remove('aktif'); });
          this.classList.add('aktif');
          ciz();
        }
      }, o[1]));
    });
    g.appendChild(serit);

    g.appendChild(e('button', {
      class: 'dg ana tam', style: 'margin-bottom:14px',
      onclick: function () {
        var idler = suanki().filter(function (h) { return h.tip === 'c'; }).map(function (h) { return h.id; });
        if (!idler.length) { UI.bildir('Bu filtrede cümle yok', 'bad'); return; }
        UI.bosalt(g);
        g.appendChild(UI.yukleniyor(3));
        Veri.cumlelerByIds(idler).then(function (liste) {
          UI.bosalt(g);
          if (!liste.length) { Uygulama.git('#/hatalar'); return; }
          oturumBaslat(g, { liste: liste, geriYol: '#/hatalar', kaynak: 'hata' });
        });
      }
    }, '🎯 Sadece hatalarımı çalış'));

    var liste = e('div', { style: 'display:grid;gap:9px' });
    g.appendChild(liste);
    ciz();

    function suanki() {
      return filtre === 'hepsi' ? hepsi : hepsi.filter(function (h) {
        return String(h.etiket || '').indexOf(filtre) > -1;
      });
    }

    function ciz() {
      UI.bosalt(liste);
      var l = suanki();
      if (!l.length) { liste.appendChild(e('p', 'kucuk-yazi', 'Bu filtrede kayıt yok.')); return; }
      l.slice(0, 120).forEach(function (h, n) {
        var acik = false;
        var ic = e('div', { style: 'display:none;margin-top:10px' });
        liste.appendChild(e('div', {
          class: 'kart tikla gir gir-' + Math.min(6, (n % 6) + 1), style: 'padding:14px',
          onclick: function () { acik = !acik; ic.style.display = acik ? 'block' : 'none'; }
        }, [
          e('div', { style: 'display:flex;align-items:flex-start;gap:10px' }, [
            e('span', { style: 'font-size:19px' }, h.tip === 'k' ? '🔤' : h.tip === 'p' ? '🧩' : '📘'),
            e('div', { style: 'flex:1;min-width:0' }, [
              e('b', { style: 'display:block;font-size:15px;font-weight:750' }, h.en || h.id),
              e('div', 'kucuk-yazi', h.tr || '')
            ]),
            (h.kez || 1) > 1 ? e('span', { class: 'et', style: 'color:var(--bad);border-color:rgba(255,95,126,.4)' }, h.kez + '×') : null
          ]),
          ic
        ]));
        if (h.cevap) ic.appendChild(e('div', { style: 'margin-bottom:8px' }, [
          e('div', { class: 'kucuk-yazi', style: 'margin-bottom:4px' }, 'Senin cevabın:'),
          UI.farkGoster(h.en || '', h.cevap)
        ]));
        if (h.etiket) ic.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-bottom:8px' }, 'Konu: ' + h.etiket));
        ic.appendChild(e('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, [
          e('button', {
            class: 'dg kucuk', onclick: function (ev) { ev.stopPropagation(); Ses.konus(h.en, { baglam: 'en' }); }
          }, '🔊 Dinle'),
          e('button', {
            class: 'dg kucuk sade', onclick: function (ev) {
              ev.stopPropagation();
              hepsi = Atlas.Hata.coz(h.tip, h.id);
              UI.bildir('Kayıt kapatıldı', 'ok');
              ciz();
            }
          }, '✓ Çözdüm')
        ]));
      });
    }
  };

  /* ═══════════════════════════════════════════════════════════
     BUGÜNKÜ AKTİVİTE
     ═══════════════════════════════════════════════════════════ */
  Ekran.aktivite = function (g) {
    var d = Atlas.Gunluk.gun();
    Uygulama.baslik(g, 'Bugünkü aktivite', 'Saat saat ne yaptın', '#/ilerleme');

    var iz = e('div', { class: 'izgara iz-2', style: 'margin-bottom:16px' });
    iz.appendChild(UI.ist(d.sayac || 0, 'tekrar'));
    iz.appendChild(UI.ist(d.dogru || 0, 'doğru', 'var(--ok)'));
    iz.appendChild(UI.ist(d.yanlis || 0, 'yanlış', (d.yanlis ? 'var(--bad)' : null)));
    var hedef = Atlas.Profil.al().hedef || 20;
    iz.appendChild(UI.ist(Math.min(100, Math.round((d.sayac || 0) / hedef * 100)) + '%', 'hedef'));
    g.appendChild(iz);

    g.appendChild(e('div', 'bolum-ad', 'Saatlere göre'));
    var saatler = [];
    for (var i = 0; i < 24; i++) saatler.push((d.saat || {})[i] || 0);
    var k = e('div', 'kart');
    k.appendChild(UI.sutunGrafik(saatler, saatler.map(function (_, i) { return i + ':00'; })));
    k.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-top:10px;display:flex;justify-content:space-between' }, [
      e('span', null, '00:00'), e('span', null, '12:00'), e('span', null, '23:00')
    ]));
    var enYogun = saatler.indexOf(Math.max.apply(null, saatler));
    if (saatler[enYogun]) {
      k.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-top:8px' },
        'En verimli saatin: ' + enYogun + ':00–' + (enYogun + 1) + ':00 · ' + saatler[enYogun] + ' tekrar'));
    }
    g.appendChild(k);

    var tur = d.tur || {};
    var turAd = { c: 'Cümle', k: 'Kelime', p: 'Phrasal verb' };
    var anahtarlar = Object.keys(tur);
    if (anahtarlar.length) {
      g.appendChild(e('div', 'bolum-ad', 'Tür dağılımı'));
      var k2 = e('div', { class: 'kart', style: 'display:grid;gap:10px' });
      var t = anahtarlar.reduce(function (a, x) { return a + tur[x]; }, 0);
      anahtarlar.forEach(function (x) {
        k2.appendChild(e('div', null, [
          e('div', { style: 'display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:5px' }, [
            e('span', { style: 'font-weight:650' }, turAd[x] || x),
            e('span', { style: 'color:var(--ink-3);font-weight:800' }, tur[x])
          ]),
          UI.cubuk(tur[x] / t * 100)
        ]));
      });
      g.appendChild(k2);
    }

    /* son 7 gün karşılaştırma */
    g.appendChild(e('div', 'bolum-ad', 'Son 7 gün'));
    var son7 = Atlas.Gunluk.son(7);
    var k3 = e('div', { class: 'kart', style: 'display:grid;gap:8px' });
    var GUNAD = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    var mx = Math.max.apply(null, son7.map(function (x) { return x.veri.sayac || 0; }).concat([1]));
    son7.forEach(function (x) {
      var gd = new Date(x.gun + 'T00:00');
      k3.appendChild(e('div', { style: 'display:flex;align-items:center;gap:10px' }, [
        e('span', { style: 'width:38px;font-size:12.5px;font-weight:700;color:var(--ink-3)' }, GUNAD[gd.getDay()]),
        e('div', { style: 'flex:1' }, [UI.cubuk((x.veri.sayac || 0) / mx * 100)]),
        e('span', { style: 'width:34px;text-align:right;font-size:12.5px;font-weight:800' }, x.veri.sayac || 0)
      ]));
    });
    g.appendChild(k3);
  };

  /* ═══════════════════════════════════════════════════════════
     SEVİYE TESTİ
     ═══════════════════════════════════════════════════════════ */
  Ekran['seviye-testi'] = function (g) {
    var donusKurulum = Atlas.oku('kurulum-donus', false);
    Uygulama.baslik(g, 'Seviye testi', '24 soru · yaklaşık 3 dakika', donusKurulum ? false : '#/ilerleme');

    var basla = e('div', { class: 'kart parlak' }, [
      e('p', { class: 'altbaslik', style: 'margin-bottom:14px' },
        'Sana A1’den C1’e karışık cümleler göstereceğim; her birinin Türkçe karşılığını seçeceksin. ' +
        'Bilmediğine “bilmiyorum” demen sonucu bozmaz — tersine daha doğru ölçer.'),
      e('button', { class: 'dg ana tam', onclick: baslat }, 'Teste başla →')
    ]);
    g.appendChild(basla);

    var sonSeviye = Atlas.Profil.al().seviye;
    if (sonSeviye) {
      g.appendChild(e('div', { class: 'kucuk-yazi', style: 'text-align:center;margin-top:12px' },
        'Kayıtlı seviyen: ' + sonSeviye));
    }

    function baslat() {
      UI.bosalt(g);
      g.appendChild(UI.yukleniyor(3));
      Veri.seviyeSorulari(24).then(function (sorular) {
        UI.bosalt(g);
        testOturumu(g, sorular);
      });
    }

    function testOturumu(g, sorular) {
      var i = 0;
      var puan = {}; Atlas.SEVIYELER.forEach(function (s) { puan[s] = { dogru: 0, toplam: 0 }; });
      var ust = e('div', 'sahne-ust');
      var cubukEl = UI.cubuk(0);
      var sayac = e('span', { style: 'font-size:13px;font-weight:800;color:var(--ink-3);min-width:52px;text-align:right' });
      ust.appendChild(cubukEl); ust.appendChild(sayac);
      g.appendChild(ust);
      var sahne = e('div'); g.appendChild(sahne);
      ciz();

      function ciz() {
        if (i >= sorular.length) { bitir(); return; }
        var s = sorular[i];
        sayac.textContent = (i + 1) + '/' + sorular.length;
        cubukEl.querySelector('i').style.width = (i / sorular.length * 100) + '%';
        UI.bosalt(sahne);
        sahne.appendChild(e('div', { class: 'cumle-kart', style: 'padding:26px 18px' }, [
          e('div', 'en-metin', s.en),
          e('button', {
            class: 'dg kucuk', style: 'margin-top:12px',
            onclick: function () { Ses.konus(s.en, { baglam: 'en' }); }
          }, '🔊 Dinle')
        ]));
        var kap = e('div', { style: 'display:grid;gap:9px;margin-top:16px' });
        s.secenekler.forEach(function (sec, n) {
          kap.appendChild(e('button', {
            class: 'secenek', style: 'animation-delay:' + (n * 50) + 'ms',
            onclick: function () { cevapla(sec === s.dogru, s); }
          }, [e('span', 'harf', String.fromCharCode(65 + n)), e('span', { style: 'flex:1' }, sec)]));
        });
        kap.appendChild(e('button', {
          class: 'dg sade tam', style: 'margin-top:4px',
          onclick: function () { cevapla(false, s); }
        }, 'Bilmiyorum'));
        sahne.appendChild(kap);
      }

      function cevapla(ok, s) {
        puan[s.level].toplam++;
        if (ok) puan[s.level].dogru++;
        i++; ciz();
      }

      function bitir() {
        cubukEl.querySelector('i').style.width = '100%';
        /* en yüksek seviye ki başarı ≥ %60 */
        var sonuc = 'A1';
        Atlas.SEVIYELER.forEach(function (lv) {
          var p = puan[lv];
          if (p.toplam && p.dogru / p.toplam >= 0.6) sonuc = lv;
        });
        var toplamD = 0, toplamT = 0;
        Atlas.SEVIYELER.forEach(function (lv) { toplamD += puan[lv].dogru; toplamT += puan[lv].toplam; });

        Atlas.Profil.kur({ seviye: sonuc });
        Atlas.yaz('secili-seviye', sonuc);

        UI.bosalt(sahne);
        sahne.appendChild(e('div', { class: 'kart parlak orta', style: 'padding:26px' }, [
          e('div', { style: 'font-size:56px;margin-bottom:8px' }, '🎓'),
          e('div', { class: 'et ' + sonuc, style: 'font-size:16px;padding:8px 20px;margin-bottom:12px' }, sonuc),
          e('h2', { style: 'font-size:22px;font-weight:800;margin:0 0 8px' }, 'Seviyen: ' + sonuc),
          e('p', { class: 'altbaslik' }, toplamD + '/' + toplamT + ' doğru. Seviyen profiline kaydedildi; modül haritası ve öğretmen artık buna göre davranacak.')
        ]));

        var detay = e('div', { class: 'kart', style: 'margin-top:12px;display:grid;gap:10px' });
        Atlas.SEVIYELER.forEach(function (lv) {
          var p = puan[lv];
          var oran = p.toplam ? Math.round(p.dogru / p.toplam * 100) : 0;
          detay.appendChild(e('div', null, [
            e('div', { style: 'display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:5px' }, [
              e('span', { class: 'et ' + lv }, lv),
              e('span', { style: 'color:var(--ink-3);font-weight:800' }, p.dogru + '/' + p.toplam)
            ]),
            UI.cubuk(oran, 'linear-gradient(90deg,var(--lv-' + lv + '),var(--brand-2))')
          ]));
        });
        sahne.appendChild(detay);

        sahne.appendChild(e('button', {
          class: 'dg ana tam', style: 'margin-top:14px',
          onclick: function () {
            if (Atlas.oku('kurulum-donus', false)) {
              Atlas.sil('kurulum-donus');
              Atlas.Profil.kur({ kurulum: true });
              Uygulama.git('#/');
            } else Uygulama.git('#/ogren');
          }
        }, 'Seviyeme uygun modüle git →'));

        UI.konfeti(80);
      }
    }
  };
})(window);
