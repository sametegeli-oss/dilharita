/* ═══════════════════════════════════════════════════════════════
   ATLAS · HATA ANTRENMANI · MODÜL SINAVI · AKILLI TEKRAR · ÖĞRENME YOLU
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  /* ═══════════════════════════════════════════════════════════
     HATA ANTRENMANI
     Her hata için üç aşamalı mikro döngü:
       📖 DERS      yanlış/doğru farkı, kural, neden
       🎯 REHBERLİ  kolay alıştırma — kelimeleri sıraya diz
       ✍️ ÜRETİM    zor alıştırma — Türkçesinden yaz
     USTALIK KURALI: üretimde yanlış → madde kuyruğa geri girer
     (en fazla 2 kez). İki aşamayı da geçen madde SRS'te ileri itilir.
     ═══════════════════════════════════════════════════════════ */
  Ekran.antrenman = function (g, arg) {
    var hepsi = Atlas.Hata.hepsi().filter(function (h) { return h.tip === 'c' && h.en; });
    if (arg[0] === 'konu') {
      hepsi = hepsi.filter(function (h) { return String(h.etiket || '').indexOf(arg[1]) > -1; });
    }
    if (!hepsi.length) {
      Uygulama.baslik(g, 'Hata antrenmanı', null, '#/hatalar');
      g.appendChild(UI.bos('🧼', 'Antrenman edilecek hata yok',
        'Hata defterin boş. Bir oturum çalış, yanlışlar buraya düşsün.',
        { ad: 'Çalışmaya git', fn: function () { Uygulama.git('#/ogren'); } }));
      return;
    }

    g.appendChild(UI.yukleniyor(3));
    Veri.cumlelerByIds(hepsi.slice(0, 12).map(function (h) { return h.id; })).then(function (liste) {
      UI.bosalt(g);
      if (!liste.length) { Uygulama.git('#/hatalar'); return; }
      drillOturumu(g, liste);
    });
  };

  function drillOturumu(g, liste) {
    /* kuyruk: her madde {c, tur (0/1/2), deneme} */
    var kuyruk = liste.map(function (c) { return { c: c, asama: 0, deneme: 0 }; });
    var toplam = kuyruk.length, ustalasan = 0, baslangic = Date.now();
    var aiDers = {};   /* id → AI'ın ürettiği ders metni */

    var ust = e('div', 'sahne-ust');
    var cubukEl = UI.cubuk(0);
    var sayac = e('span', { style: 'font-size:13px;font-weight:800;color:var(--ink-3);min-width:56px;text-align:right' });
    ust.appendChild(e('button', { class: 'dg yuvarlak sade', onclick: function () { Uygulama.git('#/hatalar'); } }, '←'));
    ust.appendChild(cubukEl); ust.appendChild(sayac);
    g.appendChild(ust);
    var sahne = e('div'); g.appendChild(sahne);

    /* AI varsa tüm maddelerin ders içeriğini TEK çağrıda üret */
    if (AI.anahtarVar()) {
      sahne.appendChild(UI.yukleniyor(2));
      topluDers(liste).then(function (h) { aiDers = h; UI.bosalt(sahne); ciz(); })
        .catch(function () { UI.bosalt(sahne); ciz(); });
    } else ciz();

    function topluDers(l) {
      var girdi = l.map(function (c, i) { return (i + 1) + ') ' + c.en + ' — TR: ' + c.tr; }).join('\n');
      var sistem = [
        'Öğrenci bu cümlelerde hata yaptı. Her biri için kısa bir ders yaz.',
        'Sadece geçerli JSON dizisi döndür, başka hiçbir şey yazma.',
        'Her öğe: {"n":1,"kural":"...","neden":"...","ipucu":"..."}',
        '"kural" tek cümle Türkçe: hangi dilbilgisi kuralı işliyor.',
        '"neden" 2 cümle Türkçe: Türk öğrenciler burada neden yanılır.',
        '"ipucu" tek kısa Türkçe cümle: hatırlamak için pratik bir yol.',
        'Üçüncü bir dil kullanma.'
      ].join('\n');
      return AI.cagir([{ role: 'system', content: sistem }, { role: 'user', content: girdi }],
        { sicaklik: 0.4, uzunluk: 2200 }).then(function (m) {
          var t = m.replace(/```json?/gi, '').replace(/```/g, '');
          var a = t.indexOf('['), b = t.lastIndexOf(']');
          var dizi = JSON.parse(t.slice(a, b + 1));
          var h = {};
          dizi.forEach(function (o) { var c = l[(o.n || 1) - 1]; if (c) h[c.id] = o; });
          return h;
        });
    }

    function ciz() {
      if (!kuyruk.length) { bitir(); return; }
      var m = kuyruk[0];
      var c = m.c;
      sayac.textContent = ustalasan + '/' + toplam;
      cubukEl.querySelector('i').style.width = (ustalasan / toplam * 100) + '%';
      UI.bosalt(sahne);

      sahne.appendChild(e('div', 'asama', [
        e('div', { class: m.asama === 0 ? 'aktif' : 'bitti' }, '📖 Ders'),
        e('div', { class: m.asama === 1 ? 'aktif' : m.asama > 1 ? 'bitti' : '' }, '🎯 Rehberli'),
        e('div', { class: m.asama === 2 ? 'aktif' : '' }, '✍️ Üretim')
      ]));

      if (m.asama === 0) ders(m);
      else if (m.asama === 1) rehberli(m);
      else uretim(m);
    }

    /* ── 1. aşama: ders ── */
    function ders(m) {
      var c = m.c;
      var hata = Atlas.Hata.hepsi().find(function (h) { return h.id === c.id; }) || {};
      var d = aiDers[c.id];

      var kart = e('div', 'cumle-kart');
      kart.appendChild(Gorsel.kutu(c));
      kart.appendChild(e('div', 'tr-metin', c.tr));
      var enS = e('div', 'en-metin');
      enS.appendChild(UI.kelimelestir(c.en, function (w, ev) { UI.kelimeBalonu(w, ev); }));
      kart.appendChild(enS);
      if (c.ipa) kart.appendChild(e('div', 'ipa', c.ipa));
      kart.appendChild(e('button', {
        class: 'dg kucuk', style: 'margin-top:10px',
        onclick: function () { Ses.konus(c.en, { baglam: 'en' }); }
      }, '🔊 Dinle'));
      sahne.appendChild(kart);

      if (hata.cevap) {
        sahne.appendChild(e('div', { class: 'kart gir', style: 'margin-top:12px' }, [
          e('h4', { style: 'margin:0 0 6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)' },
            'Ne yazmıştın · ' + (hata.kez || 1) + ' kez yanıldın'),
          UI.farkGoster(c.en, hata.cevap)
        ]));
      }

      var bilgi = e('div', 'bilgi');
      function kutu(b, metin, uyari) {
        if (!metin) return;
        bilgi.appendChild(e('div', { class: 'kutu' + (uyari ? ' uyari' : '') },
          [e('h4', null, b), e('p', null, metin)]));
      }
      kutu('Kural', (d && d.kural) || c.grammar);
      kutu('Neden yanılıyoruz', (d && d.neden) || c.aiExplain);
      kutu('Sık yapılan hata', c.commonMistake, true);
      kutu('Hatırlama ipucu', d && d.ipucu);
      sahne.appendChild(bilgi);

      sahne.appendChild(e('button', {
        class: 'dg ana tam', style: 'margin-top:14px',
        onclick: function () { m.asama = 1; ciz(); }
      }, 'Anladım, alıştırmaya geç →'));
    }

    /* ── 2. aşama: rehberli — kelimeleri sıraya diz ── */
    function rehberli(m) {
      var c = m.c;
      var dogruDizi = c.en.split(/\s+/);
      var karisik = Veri.karistir(dogruDizi.slice());
      /* aynı sıraya denk gelirse bir daha karıştır */
      if (karisik.join(' ') === dogruDizi.join(' ') && dogruDizi.length > 2) Veri.karistir(karisik);

      sahne.appendChild(e('div', { class: 'cumle-kart', style: 'padding:22px 18px' }, [
        e('div', 'tr-metin', c.tr),
        e('p', { class: 'kucuk-yazi', style: 'margin:8px 0 0' }, 'Kelimelere dokunup doğru sıraya diz')
      ]));

      var secilen = [];
      var hedefAlan = e('div', { class: 'dizi-alan', style: 'margin-top:14px' });
      var havuzAlan = e('div', { class: 'dizi-alan', style: 'margin-top:10px;border-style:solid' });
      sahne.appendChild(hedefAlan);
      sahne.appendChild(havuzAlan);

      karisik.forEach(function (w, i) {
        havuzAlan.appendChild(e('button', {
          class: 'dizi-parca', data: { i: i },
          onclick: function () {
            this.remove();
            secilen.push(w);
            var b = this;
            hedefAlan.appendChild(e('button', {
              class: 'dizi-parca',
              onclick: function () {
                this.remove();
                secilen.splice(secilen.indexOf(w), 1);
                havuzAlan.appendChild(b);
              }
            }, w));
            kontrolDugmesi.disabled = secilen.length !== dogruDizi.length;
          }
        }, w));
      });

      var kontrolDugmesi = e('button', {
        class: 'dg ana tam', style: 'margin-top:12px', disabled: 'disabled',
        onclick: function () {
          var skor = Atlas.benzerlik(c.en, secilen.join(' '));
          var ok = skor >= 95;
          UI.titre(ok ? 18 : [25, 35, 25]);
          Mastery.kaydet('c:' + c.id, 'hatirlama', ok, { kaynak: 'antrenman' });
          if (ok) {
            UI.bildir('Doğru sıra ✓', 'ok', 1500);
            m.asama = 2; ciz();
          } else {
            sahne.appendChild(e('div', { class: 'kart gir', style: 'margin-top:10px;border-color:rgba(255,95,126,.4)' }, [
              e('b', { style: 'display:block;color:var(--bad);margin-bottom:6px' }, 'Sıra tutmadı'),
              UI.farkGoster(c.en, secilen.join(' ')),
              e('button', {
                class: 'dg tam', style: 'margin-top:10px',
                onclick: function () { ciz(); }
              }, 'Tekrar dene')
            ]));
            this.disabled = true;
          }
        }
      }, 'Kontrol et');
      sahne.appendChild(kontrolDugmesi);
      sahne.appendChild(e('button', {
        class: 'dg sade tam', style: 'margin-top:8px',
        onclick: function () { m.asama = 0; ciz(); }
      }, '← Dersi tekrar oku'));
    }

    /* ── 3. aşama: üretim — Türkçesinden yaz ── */
    function uretim(m) {
      var c = m.c;
      sahne.appendChild(e('div', { class: 'cumle-kart', style: 'padding:22px 18px' }, [
        e('div', 'tr-metin', c.tr),
        e('p', { class: 'kucuk-yazi', style: 'margin:8px 0 0' }, 'Şimdi kendin yaz — ipucu yok')
      ]));
      var alan = e('input', { class: 'alan', style: 'margin-top:14px', placeholder: 'İngilizcesi…', autocomplete: 'off', spellcheck: 'false' });
      sahne.appendChild(alan);
      setTimeout(function () { try { alan.focus(); } catch (x) {} }, 120);
      alan.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') kontrol(); });
      sahne.appendChild(e('button', { class: 'dg ana tam', style: 'margin-top:10px', onclick: kontrol }, 'Kontrol et'));

      function kontrol() {
        var cevap = alan.value.trim();
        if (!cevap) return;
        var skor = Atlas.benzerlik(c.en, cevap);
        var ok = skor >= 85;
        m.deneme++;
        Mastery.kaydet('c:' + c.id, 'uretim', ok, { kaynak: 'antrenman' });
        Atlas.Gunluk.ekle('sayac', 1, 'drill');
        Atlas.Gunluk.ekle(ok ? 'dogru' : 'yanlis', 1);
        UI.titre(ok ? 18 : [25, 35, 25]);

        UI.bosalt(sahne);
        var kart = e('div', { class: 'cumle-kart ' + (ok ? 'dogru' : 'yanlis'), style: 'padding:22px 18px' });
        kart.appendChild(e('div', {
          style: 'font-size:36px;font-weight:850;color:' + (ok ? 'var(--ok)' : 'var(--bad)')
        }, ok ? '✓' : '✕'));
        kart.appendChild(e('div', { class: 'en-metin', style: 'margin-top:8px' }, c.en));
        kart.appendChild(UI.farkGoster(c.en, cevap));
        sahne.appendChild(kart);

        if (ok) {
          /* iki aşamayı da geçti → ustalaşıldı, SRS'te ileri it */
          Atlas.SRS.kaydet('c', c.id, false, 92, { mod: c.module, lvl: c.level });
          Atlas.Hata.coz('c', c.id);
          ustalasan++;
          kuyruk.shift();
          sahne.appendChild(e('div', { class: 'esdeger-not', style: 'margin-top:12px' }, [
            e('span', { style: 'font-size:16px' }, '🏅'),
            e('span', null, 'Ustalaşıldı — hata defterinden çıkarıldı ve tekrar aralığı uzatıldı.')
          ]));
          sahne.appendChild(e('button', {
            class: 'dg ana tam', style: 'margin-top:12px', onclick: ciz
          }, kuyruk.length ? 'Sonraki hata →' : 'Antrenmanı bitir →'));
        } else {
          /* kuyruğa geri gönder, en fazla 2 kez */
          kuyruk.shift();
          if (m.deneme < 2) {
            m.asama = 0;
            kuyruk.push(m);
            sahne.appendChild(e('div', { class: 'kart', style: 'margin-top:12px;border-color:rgba(255,200,87,.35)' }, [
              e('p', { style: 'margin:0;font-size:13.5px;color:var(--ink-2);line-height:1.6' },
                'Bu madde kuyruğun sonuna gitti; oturumun sonunda tekrar karşına gelecek. ' +
                'Aralarda başka maddeler görmek unutmayı yavaşlatır.')
            ]));
          } else {
            Atlas.SRS.kaydet('c', c.id, true, 30, { mod: c.module, lvl: c.level });
            sahne.appendChild(e('div', { class: 'kart', style: 'margin-top:12px;border-color:rgba(255,95,126,.3)' }, [
              e('p', { style: 'margin:0;font-size:13.5px;color:var(--ink-2);line-height:1.6' },
                'İki denemede olmadı — bu maddeyi bugünlük bırakıyoruz. Yarın tekrar karşına gelecek; ' +
                'aynı gün üstüne gitmek genelde işe yaramıyor.')
            ]));
          }
          /* pekiştirme: doğrusunu bir kez yaz */
          var pekAlan = e('input', { class: 'alan', style: 'margin-top:12px', placeholder: 'Doğrusunu bir kez yaz…' });
          sahne.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin:12px 0 0' }, 'Pekiştirme: doğru cümleyi bir kez yaz'));
          sahne.appendChild(pekAlan);
          var ileri = e('button', { class: 'dg ana tam', style: 'margin-top:10px', disabled: 'disabled', onclick: ciz },
            kuyruk.length ? 'Devam →' : 'Bitir →');
          pekAlan.addEventListener('input', function () {
            ileri.disabled = Atlas.benzerlik(c.en, pekAlan.value) < 95;
          });
          sahne.appendChild(ileri);
          sahne.appendChild(e('button', { class: 'dg sade tam', style: 'margin-top:8px', onclick: ciz }, 'Atla'));
        }
      }
    }

    function bitir() {
      cubukEl.querySelector('i').style.width = '100%';
      UI.bosalt(sahne);
      var dk = Math.max(1, Math.round((Date.now() - baslangic) / 60000));
      UI.kutla({
        ikon: ustalasan === toplam ? '🏆' : '🏋️',
        baslik: 'Antrenman bitti',
        alt: ustalasan + '/' + toplam + ' madde ustalaşıldı ve hata defterinden çıkarıldı.',
        istatistik: [[ustalasan, 'ustalaşan', 'var(--ok)'], [toplam - ustalasan, 'kalan'], [dk + '′', 'süre']],
        dugmeler: [
          { ad: 'Hata defterine dön', ana: true, fn: function () { Uygulama.git('#/hatalar'); } },
          { ad: 'Yeni antrenman', fn: function () { Uygulama.yonlendir(); } }
        ]
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     MODÜL SINAVI — modül sonu ölçme
     ═══════════════════════════════════════════════════════════ */
  Ekran.sinav = function (g, arg) {
    var f = arg[0];
    if (!f) { Uygulama.git('#/ogren'); return; }
    g.appendChild(UI.yukleniyor(3));
    Promise.all([Veri.modul(f), Veri.modulBul(f)]).then(function (r) {
      UI.bosalt(g);
      var cumleler = r[0], m = r[1];
      if (!cumleler.length) { Uygulama.git('#/ogren'); return; }
      sinavGiris(g, cumleler, m, f);
    });
  };

  function sinavGiris(g, cumleler, m, f) {
    var p = Atlas.Ilerleme.modul(m ? m.ids : []);
    Uygulama.baslik(g, 'Modül sınavı', (m && m.mod) || '', '#/calis/' + f);
    g.appendChild(e('div', { class: 'kart parlak' }, [
      e('p', { class: 'altbaslik' },
        'Bu modülden 10 soru: yarısı tanıma, yarısı üretim. Not: sınav sonucu SRS’i etkiler — ' +
        'bildiklerin uzun aralığa gider, bilemediklerin yarına döner.'),
      e('div', { class: 'izgara iz-3', style: 'margin-bottom:14px' }, [
        UI.ist(cumleler.length, 'cümle'),
        UI.ist(p.oran + '%', 'çalışıldı'),
        UI.ist(p.ogrenildi, 'kalıcı')
      ]),
      e('button', {
        class: 'dg ana tam',
        onclick: function () { UI.bosalt(g); sinavOturumu(g, cumleler, m, f); }
      }, 'Sınava başla →')
    ]));
  }

  function sinavOturumu(g, cumleler, m, f) {
    var havuz = Veri.karistir(cumleler.slice()).slice(0, 10);
    var i = 0, dogru = 0, cevaplar = [];
    var ust = e('div', 'sahne-ust');
    var cubukEl = UI.cubuk(0);
    var sayac = e('span', { style: 'font-size:13px;font-weight:800;color:var(--ink-3);min-width:52px;text-align:right' });
    ust.appendChild(cubukEl); ust.appendChild(sayac);
    g.appendChild(ust);
    var sahne = e('div'); g.appendChild(sahne);
    ciz();

    function ciz() {
      if (i >= havuz.length) { bitir(); return; }
      var c = havuz[i];
      sayac.textContent = (i + 1) + '/' + havuz.length;
      cubukEl.querySelector('i').style.width = (i / havuz.length * 100) + '%';
      UI.bosalt(sahne);
      if (i % 2 === 0) tanimaSorusu(c); else uretimSorusu(c);
    }

    function tanimaSorusu(c) {
      sahne.appendChild(e('div', { class: 'cumle-kart', style: 'padding:24px 18px' }, [
        e('div', 'en-metin', c.en),
        e('p', { class: 'kucuk-yazi', style: 'margin:10px 0 0' }, 'Türkçesi hangisi?')
      ]));
      var celdirici = Veri.karistir(cumleler.filter(function (x) { return x.id !== c.id; }))
        .slice(0, 3).map(function (x) { return x.tr; });
      var secenekler = Veri.karistir(celdirici.concat([c.tr]));
      var kap = e('div', { style: 'display:grid;gap:9px;margin-top:16px' });
      secenekler.forEach(function (s, n) {
        var d = e('button', {
          class: 'secenek', style: 'animation-delay:' + (n * 50) + 'ms',
          onclick: function () {
            var ok = s === c.tr;
            UI.qq('.secenek', kap).forEach(function (b) {
              b.disabled = true;
              if (b.dataset.deger === c.tr) b.classList.add('dogru');
            });
            if (!ok) d.classList.add('yanlis');
            kayit(c, ok, ok ? 92 : 25, 'tanima', s);
            setTimeout(function () { i++; ciz(); }, ok ? 620 : 1400);
          }
        }, [e('span', 'harf', String.fromCharCode(65 + n)), e('span', { style: 'flex:1' }, s)]);
        d.dataset.deger = s;
        kap.appendChild(d);
      });
      sahne.appendChild(kap);
    }

    function uretimSorusu(c) {
      sahne.appendChild(e('div', { class: 'cumle-kart', style: 'padding:24px 18px' }, [
        e('div', 'tr-metin', c.tr),
        e('p', { class: 'kucuk-yazi', style: 'margin:8px 0 0' }, 'İngilizcesini yaz')
      ]));
      var alan = e('input', { class: 'alan', style: 'margin-top:14px', placeholder: 'İngilizcesi…', spellcheck: 'false' });
      sahne.appendChild(alan);
      setTimeout(function () { try { alan.focus(); } catch (x) {} }, 120);
      alan.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') kontrol(); });
      sahne.appendChild(e('button', { class: 'dg ana tam', style: 'margin-top:10px', onclick: kontrol }, 'Cevapla'));
      function kontrol() {
        var skor = Atlas.benzerlik(c.en, alan.value.trim());
        var ok = skor >= 80;
        kayit(c, ok, skor, 'uretim', alan.value.trim());
        UI.bosalt(sahne);
        sahne.appendChild(e('div', { class: 'cumle-kart ' + (ok ? 'dogru' : 'yanlis'), style: 'padding:22px 18px' }, [
          e('div', { style: 'font-size:32px;color:' + (ok ? 'var(--ok)' : 'var(--bad)') }, ok ? '✓' : '✕'),
          e('div', { class: 'en-metin', style: 'margin-top:8px' }, c.en),
          UI.farkGoster(c.en, alan.value.trim())
        ]));
        setTimeout(function () { i++; ciz(); }, ok ? 900 : 1900);
      }
    }

    function kayit(c, ok, skor, beceri, cevap) {
      if (ok) dogru++;
      cevaplar.push({ c: c, ok: ok, skor: skor, cevap: cevap });
      Atlas.cevapla({
        tip: 'c', id: c.id, dogruMu: ok, skor: skor, kip: 'sinav',
        en: c.en, tr: c.tr, cevap: cevap, mod: c.module, lvl: c.level,
        etiket: c.grammarTags || c.grammar
      });
      Mastery.kaydet('c:' + c.id, beceri, ok, { kaynak: 'sinav' });
    }

    function bitir() {
      cubukEl.querySelector('i').style.width = '100%';
      var yuzde = Math.round(dogru / havuz.length * 100);
      var gecti = yuzde >= 70;
      Atlas.yaz('sinav:' + f, { yuzde: yuzde, tarih: Atlas.bugun() });
      UI.bosalt(sahne);

      sahne.appendChild(e('div', { class: 'kart parlak orta', style: 'padding:26px' }, [
        e('div', { style: 'font-size:54px;margin-bottom:6px' }, gecti ? '🎓' : '📚'),
        e('h2', { style: 'font-size:26px;font-weight:850;margin:0 0 6px' }, '%' + yuzde),
        e('p', { class: 'altbaslik' }, gecti
          ? 'Modülü geçtin. Bir sonraki modüle geçebilirsin.'
          : 'Henüz olmadı — %70 gerekiyor. Yanlışların hata defterine işlendi, önce onları antrenman et.')
      ]));

      var yanlislar = cevaplar.filter(function (x) { return !x.ok; });
      if (yanlislar.length) {
        sahne.appendChild(e('div', 'bolum-ad', 'Yanlışların'));
        var l = e('div', { style: 'display:grid;gap:8px' });
        yanlislar.forEach(function (x) {
          l.appendChild(e('div', { class: 'satir-kart', style: 'display:block' }, [
            e('b', { style: 'display:block;font-size:14.5px' }, x.c.en),
            e('div', 'kucuk-yazi', x.c.tr),
            x.cevap ? UI.farkGoster(x.c.en, x.cevap) : null
          ]));
        });
        sahne.appendChild(l);
      }

      sahne.appendChild(e('div', { style: 'display:grid;gap:8px;margin-top:16px' }, [
        yanlislar.length ? e('button', {
          class: 'dg ana tam', onclick: function () { Uygulama.git('#/antrenman'); }
        }, '🏋️ Yanlışları antrenman et') : null,
        e('button', { class: 'dg tam', onclick: function () { Uygulama.git('#/ogren'); } }, 'Modül haritasına dön')
      ]));
      if (gecti) UI.konfeti(90);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     AKILLI TEKRAR — ne çalışacağına motor karar verir
     ═══════════════════════════════════════════════════════════ */
  Ekran['akilli'] = function (g) {
    Uygulama.baslik(g, 'Akıllı tekrar', 'Ne çalışacağını sen seçme — motor seçsin', '#/tekrar');

    var vade = Atlas.SRS.vadesiGelen('c');
    var hatalar = Atlas.Hata.hepsi().filter(function (h) { return h.tip === 'c'; });
    var zayifBeceri = Mastery.profilZayifi();
    var ozet = Mastery.ozet();

    var kart = e('div', { class: 'kahraman', style: 'margin-bottom:16px' });
    kart.appendChild(e('div', 'satir', [
      e('div', { style: 'flex:1;min-width:210px' }, [
        e('h1', { style: 'font-size:clamp(21px,5.4vw,30px)' },
          zayifBeceri ? Mastery.beceriAdi(zayifBeceri) + ' zayıf' : 'Karışık oturum'),
        e('p', null, zayifBeceri
          ? 'Beş becerin içinde en düşüğü bu: %' + ozet.beceri[zayifBeceri] + '. ' +
            'Oturumu ağırlıklı olarak bu beceriyi ölçen kiple kuracağım — ' + Mastery.beceriAciklama(zayifBeceri).toLowerCase() + '.'
          : 'Henüz beceri profili çıkaracak kadar veri yok. Karışık bir oturumla başlayalım; birkaç turdan sonra burası kişiselleşir.')
      ]),
      ozet.oge ? UI.halka(ozet.genel, { boy: 108, kalinlik: 9, sayi: '%' + ozet.genel, etiket: 'ustalık' }) : null
    ]));
    g.appendChild(kart);

    if (ozet.oge) {
      g.appendChild(e('div', 'bolum-ad', 'Beceri profilin'));
      g.appendChild(e('div', 'kart', [UI.beceriRadar(ozet)]));
    }

    g.appendChild(e('div', 'bolum-ad', 'Bugün için karışım'));
    var karisim = [];
    if (vade.length) karisim.push({ ad: 'Vadesi gelen', n: Math.min(12, vade.length), ikon: '🔁' });
    if (hatalar.length) karisim.push({ ad: 'Hata defterinden', n: Math.min(5, hatalar.length), ikon: '🧯' });
    karisim.push({ ad: 'Yeni cümle', n: Math.max(3, 15 - vade.length), ikon: '📘' });

    var l = e('div', { style: 'display:grid;gap:8px' });
    karisim.forEach(function (k) {
      l.appendChild(e('div', 'satir-kart', [
        e('span', { style: 'font-size:20px;width:30px;flex:0 0 30px;text-align:center' }, k.ikon),
        e('b', { style: 'flex:1;font-size:14.5px;font-weight:700' }, k.ad),
        e('span', 'et', k.n + ' kalem')
      ]));
    });
    g.appendChild(l);

    g.appendChild(e('button', {
      class: 'dg ana tam', style: 'margin-top:16px',
      onclick: function () { basla(); }
    }, '▶️ Akıllı oturumu başlat'));

    function basla() {
      UI.bosalt(g);
      g.appendChild(UI.yukleniyor(3));
      var idler = vade.slice(0, 12).map(function (v) { return v.id; })
        .concat(hatalar.slice(0, 5).map(function (h) { return h.id; }));
      var essiz = idler.filter(function (x, n) { return idler.indexOf(x) === n; });

      var yeniAl = essiz.length >= 15
        ? Promise.resolve([])
        : Veri.siradakiModul().then(function (m) {
            return Veri.modul(m.f).then(function (cl) {
              var srs = Atlas.SRS.tumu();
              return cl.filter(function (c) { return !srs['c:' + c.id]; }).slice(0, 15 - essiz.length);
            });
          }).catch(function () { return []; });

      Promise.all([
        essiz.length ? Veri.cumlelerByIds(essiz) : Promise.resolve([]),
        yeniAl
      ]).then(function (r) {
        UI.bosalt(g);
        var liste = Veri.karistir(r[0].concat(r[1]));
        if (!liste.length) {
          g.appendChild(UI.bos('🌤️', 'Çalışacak bir şey bulamadım', 'Bugünlük her şey tazelenmiş görünüyor.',
            { ad: 'Modül seç', fn: function () { Uygulama.git('#/ogren'); } }));
          return;
        }
        oturumBaslat(g, {
          liste: liste,
          kip: zayifBeceri ? Mastery.onerilenKip('') : undefined,
          geriYol: '#/akilli', kaynak: 'akilli'
        });
      });
    }
  };

  /* ═══════════════════════════════════════════════════════════
     ÖĞRENME YOLU — nereden nereye
     ═══════════════════════════════════════════════════════════ */
  Ekran.yol = function (g) {
    Uygulama.baslik(g, 'Öğrenme yolu', 'Bugüne kadar nereden geçtin, sırada ne var', '#/ilerleme');
    g.appendChild(UI.yukleniyor(4));

    Veri.index().then(function (j) {
      UI.bosalt(g);
      Uygulama.baslik(g, 'Öğrenme yolu', 'Bugüne kadar nereden geçtin, sırada ne var', '#/ilerleme');
      var srs = Atlas.SRS.tumu();
      var pr = Atlas.Profil.al();

      /* seviye seviye durum */
      var basI = Math.max(0, Atlas.SEVIYELER.indexOf(pr.seviye || 'A1'));
      var patika = e('div', 'patika');

      Atlas.SEVIYELER.forEach(function (lv, li) {
        var mods = j.modules.filter(function (m) { return m.lvl === lv && !m.ozel; });
        var biten = 0, calisilan = 0, toplamCumle = 0;
        mods.forEach(function (m) {
          var p = Atlas.Ilerleme.modul(m.ids, srs);
          if (p.oran >= 100) biten++;
          calisilan += p.n; toplamCumle += m.ids.length;
        });
        var oran = toplamCumle ? Math.round(calisilan / toplamCumle * 100) : 0;
        var durum = oran >= 95 ? 'bitti' : (li === basI || (oran > 0 && oran < 95)) ? 'suan' : '';

        var d = e('div', {
          class: 'durak ' + durum, style: 'animation-delay:' + (li * 70) + 'ms'
        });
        d.appendChild(e('div', {
          class: 'kart tikla', onclick: function () { Atlas.yaz('secili-seviye', lv); Uygulama.git('#/ogren'); }
        }, [
          e('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px' }, [
            e('span', 'et ' + lv, lv),
            e('b', { style: 'flex:1;font-size:15px;font-weight:750' }, biten + ' / ' + mods.length + ' modül'),
            e('span', { style: 'font-size:13px;font-weight:800;color:var(--ink-3)' }, oran + '%')
          ]),
          UI.cubuk(oran, 'linear-gradient(90deg,var(--lv-' + lv + '),var(--brand-2))'),
          e('div', { class: 'kucuk-yazi', style: 'margin-top:8px' },
            durum === 'bitti' ? '✓ Bu seviyeyi bitirdin'
              : durum === 'suan' ? 'Şu an buradasın · ' + calisilan + '/' + toplamCumle + ' cümle'
                : 'Henüz başlamadın')
        ]));
        patika.appendChild(d);
      });
      g.appendChild(patika);

      /* sıradaki üç modül */
      g.appendChild(e('div', 'bolum-ad', 'Sırada ne var'));
      var sirali = j.modules.filter(function (m) { return !m.ozel; });
      var puan = function (m) {
        var i2 = Atlas.SEVIYELER.indexOf(m.lvl);
        return (i2 < basI ? 100 : 0) + i2;
      };
      sirali = sirali.slice().sort(function (a, b) { return puan(a) - puan(b); });
      var sonraki = sirali.filter(function (m) { return Atlas.Ilerleme.modul(m.ids, srs).oran < 100; }).slice(0, 3);
      var sl = e('div', { style: 'display:grid;gap:8px' });
      sonraki.forEach(function (m, n) {
        var p = Atlas.Ilerleme.modul(m.ids, srs);
        sl.appendChild(e('button', {
          class: 'satir-kart gir gir-' + (n + 1), style: 'cursor:pointer;text-align:left;width:100%',
          onclick: function () { Uygulama.git('#/calis/' + m.f); }
        }, [
          e('span', { style: 'font-size:19px;width:30px;flex:0 0 30px;text-align:center' }, n === 0 ? '▶️' : '·'),
          e('span', { style: 'flex:1;min-width:0' }, [
            e('b', { style: 'display:block;font-size:14.5px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, m.mod),
            e('span', 'kucuk-yazi', p.oran + '% · ' + m.n + ' cümle')
          ]),
          e('span', 'et ' + m.lvl, m.lvl)
        ]));
      });
      g.appendChild(sl);

      /* tahmini bitiş */
      var gunler = Atlas.Gunluk.son(14);
      var gunlukOrt = gunler.reduce(function (a, b) { return a + (b.veri.sayac || 0); }, 0) / 14;
      var kalanCumle = 0;
      j.modules.forEach(function (m) {
        if (m.ozel) return;
        var p = Atlas.Ilerleme.modul(m.ids, srs);
        kalanCumle += p.toplam - p.n;
      });
      g.appendChild(e('div', 'bolum-ad', 'Tempo'));
      g.appendChild(e('div', 'kart', [
        e('div', { class: 'izgara iz-3', style: 'margin-bottom:12px' }, [
          UI.ist(Math.round(gunlukOrt), 'günlük ort.'),
          UI.ist(kalanCumle, 'kalan cümle'),
          UI.ist(gunlukOrt >= 1 ? Math.ceil(kalanCumle / gunlukOrt / 30) + ' ay' : '—', 'tahmini')
        ]),
        e('p', { class: 'kucuk-yazi', style: 'margin:0' }, gunlukOrt >= 1
          ? 'Son 14 günün temposuyla tüm külliyatı bitirmen yaklaşık ' +
            Math.ceil(kalanCumle / gunlukOrt / 30) + ' ay sürer. Tempoyu artırmak süreyi kısaltır ama ' +
            'aralıklı tekrarın işleyişi için süreklilik hızdan önemli.'
          : 'Tempo hesabı için birkaç gün daha çalışman gerek.')
      ]));
    }).catch(function () {
      UI.bosalt(g);
      g.appendChild(UI.bos('📡', 'Yol haritası yüklenemedi', ''));
    });
  };
})(window);
