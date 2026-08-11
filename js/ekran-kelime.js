/* ═══════════════════════════════════════════════════════════════
   ATLAS · KELİME ve PHRASAL VERB EKRANLARI
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  /* ═══════════════════════════════════════════════════════════
     KELİME ANA EKRANI
     ═══════════════════════════════════════════════════════════ */
  Ekran.kelime = function (g, arg) {
    if (arg[0] === 'tekrar') { kelimeTekrar(g); return; }
    if (arg[0] === 'kart') { kartTuru(g, arg[1]); return; }
    if (arg[0] === 'quiz') { quizTuru(g, arg[1]); return; }
    if (arg[0] === 'liste') { kendiListem(g); return; }

    Uygulama.baslik(g, 'Kelime', 'Sözlükte 10.000+ kelime · frekansa göre sıralı', '#/');

    var s = Atlas.SRS.sayim();
    var vadeK = Atlas.SRS.vadesiGelen('k').length;
    var iz = e('div', { class: 'izgara iz-2', style: 'margin-bottom:16px' });
    iz.appendChild(UI.ist(s.kelime, 'çalışılan'));
    iz.appendChild(UI.ist(vadeK, 'vadesi gelen', vadeK ? 'var(--brand-2)' : null));
    iz.appendChild(UI.ist(Atlas.oku('kelime-liste', []).length, 'listemde'));
    iz.appendChild(UI.ist(Atlas.Profil.al().seviye || '—', 'seviye'));
    g.appendChild(iz);

    /* arama */
    var aramaKap = e('div', { style: 'margin-bottom:16px' });
    var arama = e('input', { class: 'alan', placeholder: '🔍 Kelime ara (İngilizce)…', autocomplete: 'off' });
    var sonucKap = e('div', { style: 'margin-top:9px' });
    aramaKap.appendChild(arama); aramaKap.appendChild(sonucKap);
    g.appendChild(aramaKap);
    var zaman;
    arama.addEventListener('input', function () {
      clearTimeout(zaman);
      var q = arama.value.trim();
      if (q.length < 2) { UI.bosalt(sonucKap); return; }
      zaman = setTimeout(function () {
        Veri.kelimeAra(q).then(function (r) {
          UI.bosalt(sonucKap);
          if (!r.length) { sonucKap.appendChild(e('p', 'kucuk-yazi', 'Bulunamadı.')); return; }
          r.slice(0, 12).forEach(function (k) {
            sonucKap.appendChild(kelimeSatiri(k));
          });
        });
      }, 200);
    });

    if (vadeK) {
      g.appendChild(e('button', {
        class: 'kart tikla parlak', style: 'width:100%;text-align:left;margin-bottom:14px;border-color:rgba(34,211,238,.4)',
        onclick: function () { Uygulama.git('#/kelime/tekrar'); }
      }, [
        e('div', { style: 'display:flex;align-items:center;gap:12px' }, [
          e('span', { style: 'font-size:26px' }, '🔁'),
          e('span', { style: 'flex:1' }, [
            e('b', { style: 'display:block;font-size:16px' }, vadeK + ' kelime tekrarı bekliyor'),
            e('span', 'kucuk-yazi', 'Vadesi gelenleri şimdi tazele')
          ]),
          e('span', { style: 'color:var(--ink-3)' }, '→')
        ])
      ]));
    }

    g.appendChild(e('div', 'bolum-ad', 'Çalışma yolları'));
    var yollar = [
      ['🃏', 'Kelime kartları', 'Çevirmeli kart · kendi kendini yokla', '#/kelime/kart'],
      ['❓', 'Çoktan seçmeli quiz', 'Hızlı tanıma testi · 10 soru', '#/kelime/quiz'],
      ['⭐', 'Kendi listem', 'Baloncuktan eklediğin kelimeler', '#/kelime/liste']
    ];
    var yl = e('div', { style: 'display:grid;gap:9px' });
    yollar.forEach(function (y, i) {
      yl.appendChild(e('button', {
        class: 'satir-kart gir gir-' + (i + 1), style: 'cursor:pointer;text-align:left;width:100%',
        onclick: function () { Uygulama.git(y[3]); }
      }, [
        e('span', { style: 'font-size:23px;width:34px;flex:0 0 34px;text-align:center' }, y[0]),
        e('span', { style: 'flex:1' }, [
          e('b', { style: 'display:block;font-size:15px;font-weight:750' }, y[1]),
          e('span', 'kucuk-yazi', y[2])
        ]),
        e('span', { style: 'color:var(--ink-3)' }, '→')
      ]));
    });
    g.appendChild(yl);

    /* seviyeye göre giriş */
    g.appendChild(e('div', 'bolum-ad', 'Seviyeye göre'));
    var sv = e('div', { class: 'izgara iz-3' });
    Atlas.SEVIYELER.forEach(function (lv) {
      sv.appendChild(e('button', {
        class: 'kart tikla', style: 'text-align:center;padding:16px 10px',
        onclick: function () { Uygulama.git('#/kelime/kart/' + lv); }
      }, [
        e('div', { class: 'et ' + lv, style: 'margin-bottom:6px' }, lv),
        e('div', 'kucuk-yazi', 'kart çalış')
      ]));
    });
    g.appendChild(sv);
  };

  function kelimeSatiri(k) {
    return e('div', { class: 'satir-kart', style: 'margin-bottom:6px;cursor:pointer' }, [
      e('span', { style: 'flex:1;min-width:0' }, [
        e('b', { style: 'font-size:15px;display:block' }, k.kelime),
        e('span', { class: 'okunus', style: 'display:block' }, k.oku || ''),
        e('span', 'kucuk-yazi', (k.anlamlar || []).slice(0, 3).join(' · '))
      ]),
      k.seviye ? e('span', 'et ' + k.seviye, k.seviye) : null,
      e('button', {
        class: 'dg kucuk', onclick: function (ev) { ev.stopPropagation(); Ses.konus(k.kelime, { baglam: 'en' }); }
      }, '🔊'),
      e('button', {
        class: 'dg kucuk', onclick: function (ev) {
          ev.stopPropagation();
          var l = Atlas.oku('kelime-liste', []);
          if (l.indexOf(k.kelime) < 0) { l.push(k.kelime); Atlas.yaz('kelime-liste', l); }
          Atlas.SRS.kaydet('k', k.kelime, false, 60);
          UI.bildir('Listene eklendi', 'ok', 1600);
        }
      }, '➕')
    ]);
  }

  /* ═══════════════════════════════════════════════════════════
     KELİME KARTLARI (3B çevirme)
     ═══════════════════════════════════════════════════════════ */
  function kartTuru(g, seviye) {
    g.appendChild(UI.yukleniyor(3));
    Veri.kelimeListesi(seviye).then(function (hepsi) {
      UI.bosalt(g);
      var srs = Atlas.SRS.tumu();
      /* önce hiç görülmemişler, frekansa göre */
      var liste = hepsi.filter(function (k) { return !srs['k:' + k.kelime]; }).slice(0, 20);
      if (liste.length < 20) {
        liste = liste.concat(hepsi.filter(function (k) {
          var n = srs['k:' + k.kelime];
          return n && n.vade <= Date.now();
        }).slice(0, 20 - liste.length));
      }
      if (!liste.length) liste = hepsi.slice(0, 20);
      kartOturumu(g, liste, seviye ? seviye + ' kelimeleri' : 'Kelime kartları');
    });
  }

  function kelimeTekrar(g) {
    var vade = Atlas.SRS.vadesiGelen('k');
    if (!vade.length) {
      Uygulama.baslik(g, 'Kelime tekrarı', null, '#/kelime');
      g.appendChild(UI.bos('✨', 'Kelime tekrarı yok', 'Vadesi gelen kelime bulunmuyor.',
        { ad: 'Yeni kelime çalış', fn: function () { Uygulama.git('#/kelime/kart'); } }));
      return;
    }
    g.appendChild(UI.yukleniyor(3));
    Veri.sozluk().then(function (d) {
      UI.bosalt(g);
      var liste = vade.map(function (v) {
        var k = d[v.id];
        return k ? Object.assign({ kelime: v.id }, k) : { kelime: v.id, anlamlar: [], oku: '' };
      });
      kartOturumu(g, liste.slice(0, 30), 'Kelime tekrarı');
    });
  }

  function kendiListem(g) {
    var l = Atlas.oku('kelime-liste', []);
    Uygulama.baslik(g, 'Kendi listem', l.length + ' kelime', '#/kelime');
    if (!l.length) {
      g.appendChild(UI.bos('⭐', 'Liste boş',
        'Çalışırken bir kelimeye dokunduğunda açılan baloncuktan “Listeme ekle” diyebilirsin.',
        { ad: 'Cümle çalış', fn: function () { Uygulama.git('#/ogren'); } }));
      return;
    }
    g.appendChild(e('button', {
      class: 'dg ana tam', style: 'margin-bottom:14px',
      onclick: function () {
        g.innerHTML = '';
        Veri.sozluk().then(function (d) {
          var liste = l.map(function (w) { return Object.assign({ kelime: w }, d[w] || { anlamlar: [] }); });
          kartOturumu(g, Veri.karistir(liste), 'Kendi listem');
        });
      }
    }, '🃏 Bu listeyi çalış'));
    var kap = e('div', { style: 'display:grid;gap:6px' });
    g.appendChild(kap);
    Veri.sozluk().then(function (d) {
      l.forEach(function (w) {
        var k = Object.assign({ kelime: w }, d[w] || { anlamlar: [] });
        var satir = kelimeSatiri(k);
        satir.appendChild(e('button', {
          class: 'dg kucuk sade', onclick: function () {
            var yeni = Atlas.oku('kelime-liste', []).filter(function (x) { return x !== w; });
            Atlas.yaz('kelime-liste', yeni); satir.remove();
          }
        }, '✕'));
        kap.appendChild(satir);
      });
    });
  }

  function kartOturumu(g, liste, baslik) {
    var i = 0, dogru = 0, yanlis = 0;
    var ust = e('div', 'sahne-ust');
    var cubukEl = UI.cubuk(0);
    var sayac = e('span', { style: 'font-size:13px;font-weight:800;color:var(--ink-3);min-width:52px;text-align:right' });
    ust.appendChild(e('button', { class: 'dg yuvarlak sade', onclick: function () { Uygulama.git('#/kelime'); } }, '←'));
    ust.appendChild(cubukEl); ust.appendChild(sayac);
    g.appendChild(ust);
    g.appendChild(e('h2', { style: 'font-size:15px;font-weight:750;color:var(--ink-3);margin:0 0 12px' }, baslik));
    var sahne = e('div');
    g.appendChild(sahne);
    ciz();

    function ciz() {
      if (i >= liste.length) { bitir(); return; }
      var k = liste[i];
      sayac.textContent = (i + 1) + '/' + liste.length;
      cubukEl.querySelector('i').style.width = (i / liste.length * 100) + '%';
      UI.bosalt(sahne);

      var kart = e('div', 'cevir');
      var on = e('div', 'yuz-on', [
        e('div', null, [
          e('div', { style: 'font-size:clamp(26px,8vw,40px);font-weight:850;letter-spacing:-.03em' }, k.kelime),
          k.oku ? e('div', { class: 'okunus', style: 'margin-top:8px' }, k.oku) : null,
          k.seviye ? e('div', { style: 'margin-top:12px' }, [e('span', 'et ' + k.seviye, k.seviye)]) : null,
          e('div', { class: 'kucuk-yazi', style: 'margin-top:18px' }, 'Karta dokun → anlamı gör')
        ])
      ]);
      var arka = e('div', 'yuz-arka', [
        e('div', null, [
          e('div', { style: 'font-size:20px;font-weight:750;line-height:1.5' },
            (k.anlamlar || []).slice(0, 3).join('\n') || '—'),
          e('div', { class: 'kucuk-yazi', style: 'margin-top:14px' }, k.kelime)
        ])
      ]);
      kart.appendChild(on); kart.appendChild(arka);
      var sahne3b = e('div', 'cevir-sahne', [kart]);
      sahne.appendChild(sahne3b);

      var acildi = false;
      kart.onclick = function () {
        kart.classList.toggle('acik');
        if (!acildi) { acildi = true; cevaplar.style.display = ''; }
      };
      /* açılışta İngilizceyi oku */
      Ses.konus(k.kelime, { baglam: 'en' });

      var araclar = e('div', { style: 'display:flex;gap:8px;justify-content:center;margin:10px 0' }, [
        e('button', { class: 'dg kucuk', onclick: function () { Ses.konus(k.kelime, { baglam: 'en' }); } }, '🔊 Dinle'),
        e('button', {
          class: 'dg kucuk', onclick: function () {
            Veri.kelimeOrnekleri(k.kelime, 3).then(function (o) {
              var kap = e('div');
              if (!o.length) kap.appendChild(e('p', 'kucuk-yazi', 'Bu kelime için hazır örnek cümle yok.'));
              o.forEach(function (c) {
                kap.appendChild(e('div', {
                  class: 'satir-kart', style: 'margin-bottom:6px;cursor:pointer;display:block',
                  onclick: function () { Ses.konus(c.en, { baglam: 'en' }); }
                }, [
                  e('div', { style: 'font-size:14.5px;font-weight:650' }, c.en),
                  e('div', 'kucuk-yazi', c.tr)
                ]));
              });
              UI.pencere(kap, { baslik: k.kelime, alt: 'Örnek cümleler' });
            });
          }
        }, '📄 Örnekler')
      ]);
      sahne.appendChild(araclar);

      var cevaplar = e('div', { style: 'display:none;grid-template-columns:repeat(3,1fr);gap:8px' });
      cevaplar.style.display = 'none';
      [['kotu', 'Bilmiyordum', true, 25], ['', 'Zor hatırladım', false, 65], ['iyi', 'Biliyordum', false, 95]].forEach(function (o) {
        cevaplar.appendChild(e('button', {
          class: 'dg ' + o[0],
          onclick: function () {
            Atlas.SRS.kaydet('k', k.kelime, o[2], o[3]);
            Atlas.Gunluk.ekle('sayac', 1, 'k');
            Atlas.Gunluk.ekle(o[2] ? 'yanlis' : 'dogru', 1);
            if (o[2]) { yanlis++; Atlas.Hata.ekle({ tip: 'k', id: k.kelime, en: k.kelime, tr: (k.anlamlar || [])[0] || '' }); }
            else { dogru++; Atlas.Hata.coz('k', k.kelime); }
            i++; ciz();
          }
        }, o[1]));
      });
      cevaplar.style.display = 'none';
      sahne.appendChild(cevaplar);
      var goster = function () { cevaplar.style.display = 'grid'; };
      kart.addEventListener('click', goster, { once: true });
    }

    function bitir() {
      cubukEl.querySelector('i').style.width = '100%';
      Atlas.Rozet.denetle();
      UI.bosalt(sahne);
      UI.kutla({
        ikon: '🔤', baslik: 'Kelime turu bitti',
        alt: 'Bildiklerin uzun aralığa, bilmediklerin yarına yazıldı.',
        istatistik: [[dogru, 'biliyordum', 'var(--ok)'], [yanlis, 'yeni', 'var(--warn)'], [liste.length, 'kart']],
        dugmeler: [
          { ad: 'Yeni tur', ana: true, fn: function () { Uygulama.yonlendir(); } },
          { ad: 'Kelime ekranına dön', fn: function () { Uygulama.git('#/kelime'); } }
        ]
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     KELİME QUIZ
     ═══════════════════════════════════════════════════════════ */
  function quizTuru(g, seviye) {
    g.appendChild(UI.yukleniyor(3));
    Veri.kelimeListesi(seviye).then(function (hepsi) {
      UI.bosalt(g);
      var havuz = hepsi.filter(function (k) { return (k.anlamlar || []).length; });
      var srs = Atlas.SRS.tumu();
      var oncelik = havuz.filter(function (k) { var n = srs['k:' + k.kelime]; return !n || n.vade <= Date.now(); });
      var kaynak = oncelik.length >= 10 ? oncelik : havuz;
      var sorular = Veri.karistir(kaynak.slice(0, 300)).slice(0, 10).map(function (k) {
        var celdirici = Veri.karistir(havuz.slice()).filter(function (x) { return x.kelime !== k.kelime && (x.anlamlar || []).length; })
          .slice(0, 3).map(function (x) { return x.anlamlar[0]; });
        var secenekler = Veri.karistir(celdirici.concat([k.anlamlar[0]]));
        return { kelime: k.kelime, oku: k.oku, dogru: k.anlamlar[0], secenekler: secenekler };
      });
      quizOturumu(g, sorular);
    });
  }

  function quizOturumu(g, sorular) {
    var i = 0, dogru = 0;
    var ust = e('div', 'sahne-ust');
    var cubukEl = UI.cubuk(0);
    var sayac = e('span', { style: 'font-size:13px;font-weight:800;color:var(--ink-3);min-width:52px;text-align:right' });
    ust.appendChild(e('button', { class: 'dg yuvarlak sade', onclick: function () { Uygulama.git('#/kelime'); } }, '←'));
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
      var kart = e('div', { class: 'cumle-kart', style: 'padding:24px 18px' }, [
        e('div', { style: 'font-size:clamp(26px,7vw,38px);font-weight:850;letter-spacing:-.03em' }, s.kelime),
        s.oku ? e('div', 'okunus', s.oku) : null,
        e('button', {
          class: 'dg kucuk', style: 'margin-top:10px',
          onclick: function () { Ses.konus(s.kelime, { baglam: 'en' }); }
        }, '🔊 Dinle')
      ]);
      sahne.appendChild(kart);
      Ses.konus(s.kelime, { baglam: 'en' });

      var liste = e('div', { style: 'display:grid;gap:9px;margin-top:16px' });
      s.secenekler.forEach(function (sec, n) {
        var d = e('button', {
          class: 'secenek', style: 'animation-delay:' + (n * 55) + 'ms',
          onclick: function () { sec2(d, sec, s); }
        }, [
          e('span', 'harf', String.fromCharCode(65 + n)),
          e('span', { style: 'flex:1' }, sec)
        ]);
        liste.appendChild(d);
      });
      sahne.appendChild(liste);

      function sec2(dugme, secilen, soru) {
        var ok = secilen === soru.dogru;
        UI.qq('.secenek', liste).forEach(function (b) {
          b.disabled = true;
          if (b.textContent.indexOf(soru.dogru) > -1) b.classList.add('dogru');
        });
        if (!ok) dugme.classList.add('yanlis');
        UI.titre(ok ? 15 : [25, 35, 25]);
        if (ok) dogru++;
        Atlas.cevapla({
          tip: 'k', id: soru.kelime, dogruMu: ok, skor: ok ? 92 : 30,
          en: soru.kelime, tr: soru.dogru, cevap: secilen
        });
        setTimeout(function () { i++; ciz(); }, ok ? 620 : 1500);
      }
    }

    function bitir() {
      cubukEl.querySelector('i').style.width = '100%';
      var yuzde = Math.round(dogru / sorular.length * 100);
      UI.kutla({
        ikon: yuzde >= 80 ? '🏆' : yuzde >= 50 ? '👍' : '📚',
        baslik: '%' + yuzde + ' doğru',
        alt: dogru + '/' + sorular.length + ' soruyu bildin.',
        dugmeler: [
          { ad: 'Yeni quiz', ana: true, fn: function () { Uygulama.yonlendir(); } },
          { ad: 'Kelime ekranı', fn: function () { Uygulama.git('#/kelime'); } }
        ]
      });
      UI.bosalt(sahne);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     PHRASAL VERBS
     ═══════════════════════════════════════════════════════════ */
  Ekran.phrasal = function (g, arg) {
    if (arg[0] === 'pratik' || arg[0] === 'tekrar') { pvPratik(g, arg[0] === 'tekrar'); return; }

    Uygulama.baslik(g, 'Phrasal verbs', '881 öbek fiil · anlam, örnek, pratik', '#/menu');
    var vadeP = Atlas.SRS.vadesiGelen('p').length;

    g.appendChild(e('div', { style: 'display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap' }, [
      e('button', { class: 'dg ana', style: 'flex:1', onclick: function () { Uygulama.git('#/phrasal/pratik'); } }, '🎯 Pratik yap'),
      vadeP ? e('button', { class: 'dg', onclick: function () { Uygulama.git('#/phrasal/tekrar'); } }, '🔁 Tekrar (' + vadeP + ')') : null
    ]));

    var arama = e('input', { class: 'alan', placeholder: '🔍 Öbek fiil ara…', style: 'margin-bottom:12px' });
    g.appendChild(arama);
    var kap = e('div', { style: 'display:grid;gap:8px' });
    kap.appendChild(UI.yukleniyor(5));
    g.appendChild(kap);

    Veri.phrasal().then(function (hepsi) {
      var gosterilen = hepsi.slice(0, 40);
      ciz(gosterilen);
      var t;
      arama.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () {
          var q = arama.value.trim().toLowerCase();
          if (!q) { ciz(hepsi.slice(0, 40)); return; }
          ciz(hepsi.filter(function (p) {
            return p.pv.indexOf(q) > -1 || (p.tr || '').toLowerCase().indexOf(q) > -1;
          }).slice(0, 60));
        }, 180);
      });

      function ciz(liste) {
        UI.bosalt(kap);
        if (!liste.length) { kap.appendChild(e('p', 'kucuk-yazi', 'Sonuç yok.')); return; }
        liste.forEach(function (p) {
          var acik = false;
          var ic = e('div', { style: 'display:none;margin-top:10px' });
          var kart = e('div', {
            class: 'kart tikla', style: 'padding:14px',
            onclick: function () {
              acik = !acik;
              ic.style.display = acik ? 'block' : 'none';
              if (acik && !ic.hasChildNodes()) doldur(p, ic);
            }
          }, [
            e('div', { style: 'display:flex;align-items:center;gap:10px' }, [
              e('b', { style: 'flex:1;font-size:16px;font-weight:750;letter-spacing:-.01em' }, p.pv),
              e('span', { class: 'kucuk-yazi', style: 'text-align:right;max-width:45%' }, p.tr || ''),
              e('button', {
                class: 'dg kucuk', onclick: function (ev) { ev.stopPropagation(); Ses.konus(p.pv, { baglam: 'en' }); }
              }, '🔊')
            ]),
            ic
          ]);
          kap.appendChild(kart);
        });
      }

      function doldur(p, ic) {
        (p.meanings || []).forEach(function (m, n) {
          ic.appendChild(e('div', { style: 'padding:9px 11px;border-radius:12px;background:var(--glass);margin-bottom:6px' }, [
            e('div', { style: 'font-size:14px;font-weight:650' }, m),
            (p.meanings_tr || [])[n] ? e('div', 'kucuk-yazi', (p.meanings_tr || [])[n]) : null
          ]));
        });
        (p.examples || []).slice(0, 3).forEach(function (o, n) {
          ic.appendChild(e('div', {
            style: 'padding:9px 11px;border-radius:12px;background:var(--glass);margin-bottom:6px;cursor:pointer',
            onclick: function (ev) { ev.stopPropagation(); Ses.konus(o, { baglam: 'en' }); }
          }, [
            e('div', { style: 'font-size:13.5px' }, '“' + o + '”'),
            (p.examples_tr || [])[n] ? e('div', 'kucuk-yazi', (p.examples_tr || [])[n]) : null
          ]));
        });
        ic.appendChild(e('button', {
          class: 'dg kucuk tam', style: 'margin-top:6px',
          onclick: function (ev) {
            ev.stopPropagation();
            Atlas.SRS.kaydet('p', p.pv, false, 60);
            UI.bildir('“' + p.pv + '” tekrar listene eklendi', 'ok');
          }
        }, '➕ Tekrar listeme ekle'));
      }
    }).catch(function () {
      UI.bosalt(kap);
      kap.appendChild(UI.bos('📡', 'Phrasal verb verisi yüklenemedi', ''));
    });
  };

  function pvPratik(g, sadeceTekrar) {
    g.appendChild(UI.yukleniyor(3));
    Veri.phrasal().then(function (hepsi) {
      UI.bosalt(g);
      var havuz = hepsi.filter(function (p) { return (p.examples || []).length && (p.meanings || []).length; });
      var liste;
      if (sadeceTekrar) {
        var vade = Atlas.SRS.vadesiGelen('p').map(function (v) { return v.id; });
        liste = havuz.filter(function (p) { return vade.indexOf(p.pv) > -1; });
        if (!liste.length) {
          g.appendChild(UI.bos('✨', 'Phrasal tekrarı yok', 'Vadesi gelen öbek fiil bulunmuyor.',
            { ad: 'Pratik yap', fn: function () { Uygulama.git('#/phrasal/pratik'); } }));
          return;
        }
      } else {
        liste = Veri.karistir(havuz.slice()).slice(0, 12);
      }
      pvOturumu(g, liste, havuz);
    });
  }

  function pvOturumu(g, liste, havuz) {
    var i = 0, dogru = 0;
    var kipler = ['secme', 'bosluk', 'dinle'];
    var ust = e('div', 'sahne-ust');
    var cubukEl = UI.cubuk(0);
    var sayac = e('span', { style: 'font-size:13px;font-weight:800;color:var(--ink-3);min-width:52px;text-align:right' });
    ust.appendChild(e('button', { class: 'dg yuvarlak sade', onclick: function () { Uygulama.git('#/phrasal'); } }, '←'));
    ust.appendChild(cubukEl); ust.appendChild(sayac);
    g.appendChild(ust);
    var sahne = e('div'); g.appendChild(sahne);
    ciz();

    function ciz() {
      if (i >= liste.length) { bitir(); return; }
      var p = liste[i];
      var kip = kipler[i % kipler.length];
      sayac.textContent = (i + 1) + '/' + liste.length;
      cubukEl.querySelector('i').style.width = (i / liste.length * 100) + '%';
      UI.bosalt(sahne);

      if (kip === 'secme') soruSecme(p);
      else if (kip === 'bosluk') soruBosluk(p);
      else soruDinle(p);
    }

    function kartBasi(ust1, alt1) {
      return e('div', { class: 'cumle-kart', style: 'padding:24px 18px' }, [
        e('div', { style: 'font-size:clamp(22px,6vw,32px);font-weight:850;letter-spacing:-.03em' }, ust1),
        alt1 ? e('div', { class: 'altbaslik', style: 'margin:8px 0 0' }, alt1) : null
      ]);
    }

    function soruSecme(p) {
      sahne.appendChild(kartBasi(p.pv, 'Bu öbek fiil ne anlama geliyor?'));
      Ses.konus(p.pv, { baglam: 'en' });
      var celdirici = Veri.karistir(havuz.slice()).filter(function (x) { return x.pv !== p.pv; })
        .slice(0, 3).map(function (x) { return x.meanings_tr && x.meanings_tr[0] || x.tr; });
      var dogruCevap = (p.meanings_tr && p.meanings_tr[0]) || p.tr;
      cevapListesi(Veri.karistir(celdirici.concat([dogruCevap])), dogruCevap, p);
    }

    function soruBosluk(p) {
      var ornek = p.examples[0];
      var gizli = ornek.replace(new RegExp(p.pv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '______');
      sahne.appendChild(kartBasi('______', gizli));
      var celdirici = Veri.karistir(havuz.slice()).filter(function (x) { return x.pv !== p.pv; })
        .slice(0, 3).map(function (x) { return x.pv; });
      cevapListesi(Veri.karistir(celdirici.concat([p.pv])), p.pv, p);
    }

    function soruDinle(p) {
      var kart = kartBasi('🎧', 'Duyduğun öbek fiil hangisi?');
      sahne.appendChild(kart);
      kart.appendChild(e('button', {
        class: 'dg', style: 'margin-top:12px', onclick: function () { Ses.konus(p.pv, { baglam: 'en' }); }
      }, '🔊 Tekrar dinle'));
      setTimeout(function () { Ses.konus(p.pv, { baglam: 'en' }); }, 300);
      var celdirici = Veri.karistir(havuz.slice()).filter(function (x) { return x.pv !== p.pv; })
        .slice(0, 3).map(function (x) { return x.pv; });
      cevapListesi(Veri.karistir(celdirici.concat([p.pv])), p.pv, p);
    }

    function cevapListesi(secenekler, dogruCevap, p) {
      var kap = e('div', { style: 'display:grid;gap:9px;margin-top:16px' });
      secenekler.forEach(function (s, n) {
        var d = e('button', {
          class: 'secenek', style: 'animation-delay:' + (n * 55) + 'ms',
          onclick: function () {
            var ok = s === dogruCevap;
            UI.qq('.secenek', kap).forEach(function (b) {
              b.disabled = true;
              if (b.dataset.deger === dogruCevap) b.classList.add('dogru');
            });
            if (!ok) d.classList.add('yanlis');
            UI.titre(ok ? 15 : [25, 35, 25]);
            if (ok) dogru++;
            Atlas.cevapla({
              tip: 'p', id: p.pv, dogruMu: ok, skor: ok ? 92 : 30,
              en: p.pv, tr: p.tr, cevap: s
            });
            if (!ok) {
              kap.appendChild(e('div', { class: 'kart gir', style: 'margin-top:8px;text-align:left' }, [
                e('b', { style: 'display:block;margin-bottom:5px' }, p.pv + ' — ' + (p.tr || '')),
                e('p', { style: 'margin:0;font-size:13.5px;color:var(--ink-2);line-height:1.6' },
                  (p.meanings || [])[0] || ''),
                (p.examples || [])[0] ? e('p', { class: 'kucuk-yazi', style: 'margin:6px 0 0' }, '“' + p.examples[0] + '”') : null
              ]));
            }
            setTimeout(function () { i++; ciz(); }, ok ? 700 : 2400);
          }
        }, [e('span', 'harf', String.fromCharCode(65 + n)), e('span', { style: 'flex:1' }, s)]);
        d.dataset.deger = s;
        kap.appendChild(d);
      });
      sahne.appendChild(kap);
    }

    function bitir() {
      cubukEl.querySelector('i').style.width = '100%';
      UI.bosalt(sahne);
      UI.kutla({
        ikon: '🧩', baslik: 'Phrasal turu bitti',
        alt: dogru + '/' + liste.length + ' doğru.',
        dugmeler: [
          { ad: 'Yeni tur', ana: true, fn: function () { Uygulama.yonlendir(); } },
          { ad: 'Listeye dön', fn: function () { Uygulama.git('#/phrasal'); } }
        ]
      });
    }
  }
})(window);
