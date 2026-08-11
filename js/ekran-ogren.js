/* ═══════════════════════════════════════════════════════════════
   ATLAS · ÖĞRENME EKRANLARI
   Modül haritası · çalışma oturumu · tekrar · telaffuz · dinleme
   Tek bir "oturum motoru" var; beş kip de onu kullanıyor.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  /* ═══════════════════════════════════════════════════════════
     MODÜL HARİTASI
     ═══════════════════════════════════════════════════════════ */
  Ekran.ogren = function (g) {
    var pr = Atlas.Profil.al();
    var seciliSeviye = Atlas.oku('secili-seviye', pr.seviye || 'A1');

    Uygulama.baslik(g, 'Modül haritası', 'Cümle cümle ilerle. Her modül 25 cümle.', '#/');

    var serit = e('div', 'seviye-serit');
    g.appendChild(serit);
    var ozetKap = e('div', { style: 'margin-bottom:16px' });
    g.appendChild(ozetKap);
    var listeKap = e('div');
    listeKap.appendChild(UI.yukleniyor(6));
    g.appendChild(listeKap);

    Veri.index().then(function () {
      var ozet = Atlas.Ilerleme.seviyeOzeti();
      UI.bosalt(serit);
      Atlas.SEVIYELER.forEach(function (s) {
        var o = ozet[s] || { modul: 0, biten: 0 };
        serit.appendChild(e('button', {
          class: seciliSeviye === s ? 'aktif' : '',
          onclick: function () {
            seciliSeviye = s; Atlas.yaz('secili-seviye', s);
            UI.qq('.seviye-serit button').forEach(function (b) { b.classList.remove('aktif'); });
            this.classList.add('aktif');
            ciz();
          }
        }, s + ' · ' + o.biten + '/' + o.modul));
      });
      ciz();
    }).catch(function (err) {
      UI.bosalt(listeKap);
      listeKap.appendChild(UI.bos('📡', 'Modül listesi yüklenemedi', String(err.message || err)));
    });

    function ciz() {
      Veri.modulListesi(seciliSeviye).then(function (mods) {
        var ozet = Atlas.Ilerleme.seviyeOzeti()[seciliSeviye] || {};
        UI.bosalt(ozetKap);
        var oran = ozet.cumle ? Math.round(ozet.calisilan / ozet.cumle * 100) : 0;
        ozetKap.appendChild(e('div', { class: 'kart parlak' }, [
          e('div', { style: 'display:flex;align-items:center;gap:16px' }, [
            UI.halka(oran, { boy: 78, kalinlik: 8, sayi: oran + '%' }),
            e('div', { style: 'flex:1' }, [
              e('b', { style: 'display:block;font-size:17px;font-weight:800' }, seciliSeviye + ' seviyesi'),
              e('div', { class: 'kucuk-yazi', style: 'margin-top:4px' },
                (ozet.biten || 0) + ' modül bitti · ' + (ozet.calisilan || 0) + '/' + (ozet.cumle || 0) + ' cümle çalışıldı')
            ])
          ])
        ]));

        UI.bosalt(listeKap);
        var patika = e('div', 'patika');
        var ilkYarim = true;
        mods.forEach(function (m, i) {
          var p = Atlas.Ilerleme.modul(m.ids);
          var bitti = p.oran >= 100;
          var suan = !bitti && ilkYarim;
          if (suan) ilkYarim = false;
          var d = e('div', {
            class: 'durak' + (bitti ? ' bitti' : suan ? ' suan' : ''),
            style: 'animation-delay:' + Math.min(500, i * 22) + 'ms'
          });
          d.appendChild(e('div', {
            class: 'modul',
            onclick: function () { Uygulama.git('#/calis/' + m.f); }
          }, [
            e('div', 'no', bitti ? '✓' : (m.mod.match(/M(\d+)/) ? 'M' + m.mod.match(/M(\d+)/)[1] : String(i + 1))),
            e('div', 'gvd', [
              e('b', null, m.mod.replace(/^[A-C]\d-M\d+\s*/, '')),
              UI.cubuk(p.oran)
            ]),
            e('div', 'yuzde', p.oran + '%')
          ]));
          patika.appendChild(d);
        });
        listeKap.appendChild(patika);
      });
    }
  };

  /* ═══════════════════════════════════════════════════════════
     OTURUM MOTORU
     kip: 'uretim' | 'tanima' | 'dinleme' | 'telaffuz' | 'bosluk'
     ═══════════════════════════════════════════════════════════ */
  function oturumBaslat(g, ayar) {
    /* ayar: {liste, baslik, alt, kip, geriYol, bitti(fn), kaynak} */
    var liste = ayar.liste.slice();
    if (!liste.length) {
      g.appendChild(UI.bos('🎉', 'Burada iş kalmamış', 'Bu listede çalışılacak bir şey yok.',
        { ad: 'Geri dön', fn: function () { Uygulama.git(ayar.geriYol || '#/'); } }));
      return;
    }

    var kip = ayar.kip || Atlas.oku('son-kip', 'uretim');
    var i = 0, dogru = 0, yanlis = 0, hatasiz = true;
    var baslangic = Date.now();
    var skorlar = [];

    var ust = e('div', 'sahne-ust');
    var geri = e('button', {
      class: 'dg yuvarlak sade', title: 'Çık',
      onclick: function () { Uygulama.git(ayar.geriYol || '#/'); }
    }, '←');
    var sayac = e('span', { style: 'font-size:13px;font-weight:800;color:var(--ink-3);min-width:52px;text-align:right' });
    var ilerlemeCubugu = UI.cubuk(0);
    ust.appendChild(geri);
    ust.appendChild(ilerlemeCubugu);
    ust.appendChild(sayac);
    ust.appendChild(e('button', {
      class: 'dg yuvarlak sade', title: 'Çalışma kipi',
      onclick: kipSec
    }, '⚙'));
    g.appendChild(ust);

    var sahne = e('div');
    g.appendChild(sahne);

    ciz();

    function kipSec() {
      var kipler = [
        ['uretim', '⌨️', 'Üretim', 'Türkçesini gör, İngilizcesini yaz'],
        ['tanima', '👁️', 'Tanıma', 'İngilizceyi gör, anlamını hatırla'],
        ['dinleme', '🎧', 'Dinleme', 'Duy ve yaz'],
        ['telaffuz', '🎙️', 'Telaffuz', 'Sesli oku, karşılaştır'],
        ['bosluk', '🧩', 'Boşluk', 'Eksik kelimeyi tamamla']
      ];
      var kap = e('div', { style: 'display:grid;gap:8px' });
      kipler.forEach(function (k) {
        kap.appendChild(e('button', {
          class: 'satir-kart', style: 'cursor:pointer;text-align:left;width:100%;border-color:' + (kip === k[0] ? 'var(--brand)' : ''),
          onclick: function () {
            kip = k[0]; Atlas.yaz('son-kip', kip); UI.pencereKapat(); ciz();
          }
        }, [
          e('span', { style: 'font-size:21px;width:30px;flex:0 0 30px;text-align:center' }, k[1]),
          e('span', { style: 'flex:1' }, [
            e('b', { style: 'display:block;font-size:14.5px' }, k[2]),
            e('span', 'kucuk-yazi', k[3])
          ])
        ]));
      });
      UI.pencere(kap, { baslik: 'Çalışma kipi', alt: 'Aynı cümleyi farklı yollarla çalışmak hafızayı güçlendirir.', dugmesiz: true });
    }

    function ciz() {
      if (i >= liste.length) { bitir(); return; }
      var c = liste[i];
      sayac.textContent = (i + 1) + '/' + liste.length;
      ilerlemeCubugu.querySelector('i').style.width = (i / liste.length * 100) + '%';

      UI.bosalt(sahne);
      var kart = e('div', 'cumle-kart');
      sahne.appendChild(kart);

      var av = UI.avatar(96);
      av.style.margin = '0 auto 10px';

      /* ── ÜST: soru ── */
      if (kip === 'tanima') {
        kart.appendChild(av);
        kart.appendChild(e('div', { style: 'display:flex;gap:6px;justify-content:center;margin-bottom:4px' }, [
          e('span', 'et ' + (c.level || ''), c.level || ''),
          c.tense ? e('span', 'et', c.tense) : null
        ]));
        var enSatir = e('div', 'en-metin');
        enSatir.appendChild(UI.kelimelestir(c.en, function (w, ev) { UI.kelimeBalonu(w, ev); }));
        kart.appendChild(enSatir);
        if (c.ipa) kart.appendChild(e('div', 'ipa', c.ipa));
        kart.appendChild(sesDugmesi(c, av));
        kart.appendChild(e('button', {
          class: 'dg ana tam', style: 'margin-top:16px',
          onclick: function () { tanimaCevap(c, kart); }
        }, 'Anlamını göster'));
        seslendir(c, av);
      } else if (kip === 'dinleme') {
        kart.appendChild(av);
        kart.appendChild(e('div', { style: 'font-size:44px;margin:6px 0 12px' }, '🎧'));
        kart.appendChild(e('p', { class: 'altbaslik', style: 'margin-bottom:6px' }, 'Dinle ve duyduğunu yaz'));
        kart.appendChild(sesDugmesi(c, av, true));
        kart.appendChild(cevapAlani(c, kart, 'Duyduğunu yaz…'));
        setTimeout(function () { seslendir(c, av); }, 350);
      } else if (kip === 'telaffuz') {
        kart.appendChild(av);
        var en2 = e('div', 'en-metin');
        en2.appendChild(UI.kelimelestir(c.en, function (w, ev) { UI.kelimeBalonu(w, ev); }));
        kart.appendChild(en2);
        if (c.ipa) kart.appendChild(e('div', 'ipa', c.ipa));
        if (c.trPron) kart.appendChild(e('div', 'okunus', c.trPron));
        kart.appendChild(sesDugmesi(c, av));
        kart.appendChild(telaffuzPaneli(c, kart, av));
      } else if (kip === 'bosluk') {
        kart.appendChild(e('div', { style: 'display:flex;gap:6px;justify-content:center;margin-bottom:10px' }, [
          e('span', 'et ' + (c.level || ''), c.level || '')
        ]));
        kart.appendChild(e('div', 'tr-metin', c.tr));
        var kelimeler = c.en.split(/\s+/);
        var gizliIdx = secGizli(kelimeler);
        var gosterim = kelimeler.map(function (w, n) { return n === gizliIdx ? '_'.repeat(Math.max(3, w.replace(/[^\w']/g, '').length)) : w; }).join(' ');
        kart.appendChild(e('div', { class: 'en-metin', style: 'margin-top:6px' }, gosterim));
        kart.appendChild(cevapAlani(c, kart, 'Eksik kelime…', kelimeler[gizliIdx].replace(/[^\w']/g, '')));
      } else {
        /* üretim */
        kart.appendChild(e('div', { style: 'display:flex;gap:6px;justify-content:center;margin-bottom:8px' }, [
          e('span', 'et ' + (c.level || ''), c.level || ''),
          c.grammar ? e('span', 'et', kisalt(c.grammar, 34)) : null
        ]));
        kart.appendChild(e('div', 'tr-metin', c.tr));
        if (c.pattern) kart.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-bottom:6px' }, 'İpucu: ' + c.pattern));
        kart.appendChild(cevapAlani(c, kart, 'İngilizcesini yaz…'));
      }
    }

    function secGizli(kelimeler) {
      var adaylar = [];
      kelimeler.forEach(function (w, n) { if (w.replace(/[^\w']/g, '').length >= 3) adaylar.push(n); });
      if (!adaylar.length) return 0;
      return adaylar[Math.floor(Math.random() * adaylar.length)];
    }

    function kisalt(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

    function sesDugmesi(c, av, buyuk) {
      var d = e('button', {
        class: 'dg ' + (buyuk ? 'ana' : ''), style: 'margin-top:12px',
        onclick: function () { seslendir(c, av); }
      }, buyuk ? '🔊  Tekrar dinle' : '🔊 Dinle');
      return d;
    }

    function seslendir(c, av) {
      if (!Atlas.Ayar.al().otoSes && !arguments[2]) { /* elle çağrıldıysa yine oku */ }
      av.konusuyor(true);
      Ses.konus(c.en, {
        baglam: 'en',
        agiz: function (k) { av.agiz(k); },
        bitti: function () { av.konusuyor(false); }
      });
    }

    /* ── cevap alanı (üretim/dinleme/boşluk) ── */
    function cevapAlani(c, kart, yerTutucu, hedefKelime) {
      var kap = e('div', { style: 'margin-top:16px' });
      var alan = e('input', { class: 'alan', placeholder: yerTutucu, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      kap.appendChild(alan);
      var satir = e('div', { style: 'display:flex;gap:8px;margin-top:10px' });
      satir.appendChild(e('button', {
        class: 'dg sade', style: 'flex:0 0 auto',
        onclick: function () { kontrol(true); }
      }, 'Bilmiyorum'));
      satir.appendChild(e('button', {
        class: 'dg ana', style: 'flex:1',
        onclick: function () { kontrol(false); }
      }, 'Kontrol et'));
      kap.appendChild(satir);
      setTimeout(function () { try { alan.focus(); } catch (e) {} }, 120);
      alan.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') kontrol(false); });

      function kontrol(pasGec) {
        var cevap = alan.value.trim();
        if (!cevap && !pasGec) { alan.focus(); return; }
        var hedef = hedefKelime || c.en;
        var skor = pasGec ? 0 : Atlas.benzerlik(hedef, cevap);
        sonucGoster(c, kart, skor, cevap, hedef, pasGec);
      }
      return kap;
    }

    /* ── tanıma: kendini değerlendir ── */
    function tanimaCevap(c, kart) {
      var kap = e('div', { class: 'gir', style: 'margin-top:14px' });
      kap.appendChild(e('div', { class: 'tr-metin', style: 'margin:0 0 14px' }, c.tr));
      kap.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin-bottom:10px' }, 'Ne kadar rahat hatırladın?'));
      var s = e('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px' });
      [['kotu', 'Zor', 30], ['', 'Orta', 70], ['iyi', 'Kolay', 95]].forEach(function (o) {
        s.appendChild(e('button', {
          class: 'dg ' + o[0], onclick: function () { sonucGoster(c, kart, o[2], '', c.en, false, true); }
        }, o[1]));
      });
      kap.appendChild(s);
      kart.appendChild(kap);
      /* soruyu bir kez daha sormamak için düğmeyi gizle */
      var eskiDugme = kart.querySelector('.dg.ana.tam');
      if (eskiDugme) eskiDugme.remove();
    }

    /* ── telaffuz paneli ── */
    function telaffuzPaneli(c, kart, av) {
      var kap = e('div', { style: 'margin-top:16px' });
      var destek = Ses.destek();

      if (destek.stt) {
        var dalgaKap = e('div', { class: 'dalga', style: 'margin-bottom:12px' });
        var durum = e('div', { class: 'kucuk-yazi', style: 'margin-bottom:10px;min-height:20px' }, 'Mikrofona bas ve cümleyi sesli oku');
        kap.appendChild(dalgaKap); kap.appendChild(durum);
        var mikrofon = e('button', { class: 'dg ana tam' }, '🎙️  Konuşmaya başla');
        var durdur = null, dalgaKapat = null;
        mikrofon.onclick = function () {
          if (durdur) { durdur(); return; }
          mikrofon.textContent = '⏹  Bitir';
          durum.textContent = 'Dinliyorum…';
          dalgaKapat = Ses.dalgaBaslat(dalgaKap);
          Uygulama.temizlemeEkle(function () { if (dalgaKapat) dalgaKapat(); });
          Ses.dinle({
            dil: 'en',
            kismi: function (t) { durum.textContent = '“' + t + '”'; },
            durdurucu: function (f) { durdur = f; }
          }).then(function (metin) {
            if (dalgaKapat) dalgaKapat();
            durdur = null;
            if (!metin) { durum.textContent = 'Ses alınamadı, tekrar dene'; mikrofon.textContent = '🎙️  Konuşmaya başla'; return; }
            var skor = Atlas.benzerlik(c.en, metin);
            sonucGoster(c, kart, skor, metin, c.en);
          }).catch(function (h) {
            if (dalgaKapat) dalgaKapat();
            durdur = null;
            mikrofon.textContent = '🎙️  Konuşmaya başla';
            durum.textContent = h.kod === 'not-allowed' ? 'Mikrofon izni verilmedi' : 'Tanıma çalışmadı, tekrar dene';
          });
        };
        kap.appendChild(mikrofon);
      } else if (destek.kayit) {
        /* iOS düşüşü: gölgeleme — yazı kutusuna DÜŞÜLMEZ */
        kap.appendChild(e('div', { class: 'kart', style: 'text-align:left;margin-bottom:12px' }, [
          e('b', { style: 'display:block;font-size:14px;margin-bottom:4px' }, '🎧 Gölgeleme kipi'),
          e('p', { class: 'kucuk-yazi', style: 'margin:0' },
            'Tarayıcın ses tanımayı desteklemiyor. Onun yerine: önce cümleyi dinle, sonra kendini kaydet, ikisini arka arkaya dinle ve kendini değerlendir. Alıştırma sesli kalır.')
        ]));
        var kayitDurum = e('div', { class: 'kucuk-yazi', style: 'margin-bottom:10px' }, '');
        var oynatKap = e('div', { style: 'margin-bottom:10px' });
        kap.appendChild(kayitDurum); kap.appendChild(oynatKap);
        var kayitci = null;
        var kayitDugme = e('button', { class: 'dg ana tam' }, '⏺  Kendini kaydet');
        kayitDugme.onclick = function () {
          if (kayitci) {
            kayitci.durdur().then(function (blob) {
              kayitci = null;
              kayitDugme.textContent = '⏺  Yeniden kaydet';
              kayitDurum.textContent = 'Kaydın hazır. Karşılaştır ve kendini değerlendir.';
              UI.bosalt(oynatKap);
              var ses = e('audio', { controls: '', style: 'width:100%' });
              ses.src = URL.createObjectURL(blob);
              oynatKap.appendChild(ses);
              oynatKap.appendChild(e('button', {
                class: 'dg tam', style: 'margin-top:8px',
                onclick: function () {
                  Ses.konus(c.en, { baglam: 'en', bitti: function () { setTimeout(function () { ses.play(); }, 400); } });
                }
              }, '🔁  Arka arkaya dinle'));
              var puanlar = e('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px' });
              [['kotu', 'Tutmadı', 35], ['', 'Yakın', 72], ['iyi', 'Aynı gibi', 94]].forEach(function (o) {
                puanlar.appendChild(e('button', {
                  class: 'dg ' + o[0], onclick: function () { sonucGoster(c, kart, o[2], '(gölgeleme)', c.en, false, true); }
                }, o[1]));
              });
              oynatKap.appendChild(puanlar);
            });
            return;
          }
          Ses.kayit().then(function (k) {
            kayitci = k;
            kayitDugme.textContent = '⏹  Kaydı bitir';
            kayitDurum.textContent = 'Kaydediyorum…';
          }).catch(function () { kayitDurum.textContent = 'Mikrofona erişilemedi.'; });
        };
        kap.appendChild(kayitDugme);
      } else {
        kap.appendChild(e('p', 'kucuk-yazi', 'Bu tarayıcıda mikrofon kullanılamıyor. Telaffuz kipi yerine üretim kipini deneyebilirsin.'));
      }
      return kap;
    }

    /* ── sonuç ── */
    function sonucGoster(c, kart, skor, cevap, hedef, pasGec, kendiPuan) {
      var basarili = skor >= 70;
      kart.classList.add(basarili ? 'dogru' : 'yanlis');
      UI.titre(basarili ? 18 : [30, 40, 30]);
      if (basarili) dogru++; else { yanlis++; hatasiz = false; }
      skorlar.push(skor);

      Atlas.cevapla({
        tip: 'c', id: c.id, dogruMu: basarili, skor: skor,
        en: c.en, tr: c.tr, cevap: cevap, mod: c.module, lvl: c.level,
        etiket: c.grammarTags || c.grammar
      });

      /* soruyu kilitle */
      UI.qq('input,button', kart).forEach(function (x) {
        if (!x.classList.contains('kelime')) x.disabled = true;
      });

      var alt = e('div', { class: 'gir', style: 'margin-top:16px;text-align:left' });

      /* skor bandı */
      if (!kendiPuan) {
        alt.appendChild(e('div', 'skor-bant', [
          e('div', {
            class: 'sayi',
            style: 'color:' + (skor >= 90 ? 'var(--ok)' : skor >= 70 ? 'var(--warn)' : 'var(--bad)')
          }, pasGec ? '—' : '%' + skor),
          e('div', { style: 'flex:1' }, [
            e('b', { style: 'display:block;font-size:14px;margin-bottom:3px' },
              pasGec ? 'Pas geçtin' : skor >= 95 ? 'Kusursuz' : skor >= 90 ? 'Çok iyi' : skor >= 70 ? 'Yakın' : 'Tekrar bakalım'),
            cevap && !pasGec ? UI.farkGoster(hedef, cevap) : e('span', 'kucuk-yazi', 'Doğrusunu aşağıda görüyorsun')
          ])
        ]));
      }

      /* doğru cümle */
      var dogruKart = e('div', { class: 'kart', style: 'margin-top:10px;text-align:center' });
      var enS = e('div', 'en-metin');
      enS.appendChild(UI.kelimelestir(c.en, function (w, ev) { UI.kelimeBalonu(w, ev); }));
      dogruKart.appendChild(enS);
      if (c.ipa) dogruKart.appendChild(e('div', 'ipa', c.ipa));
      if (c.trPron) dogruKart.appendChild(e('div', 'okunus', c.trPron));
      dogruKart.appendChild(e('div', { style: 'font-size:15px;color:var(--ink-2);margin-top:8px' }, c.tr));
      dogruKart.appendChild(e('button', {
        class: 'dg kucuk', style: 'margin-top:10px',
        onclick: function () { Ses.konus(c.en, { baglam: 'en' }); }
      }, '🔊 Dinle'));
      alt.appendChild(dogruKart);

      /* bilgi katmanı */
      var bilgi = e('div', 'bilgi');
      function kutu(baslik, metin, uyari) {
        if (!metin) return;
        bilgi.appendChild(e('div', { class: 'kutu' + (uyari ? ' uyari' : '') }, [
          e('h4', null, baslik), e('p', null, metin)
        ]));
      }
      kutu('Neden böyle', c.aiExplain);
      kutu('Yapı', [c.grammar, c.tense].filter(Boolean).join(' · '));
      kutu('Sık yapılan hata', c.commonMistake, true);
      kutu('Birlikte kullanımlar', c.collocations);
      kutu('Eş / karşıt anlam', [c.synonyms, c.antonyms].filter(Boolean).join('  ·  '));
      kutu('Bağlam', [c.topic, c.scenario].filter(Boolean).join(' — '));
      var kendiNot = Atlas.Not.al(c.id);
      if (kendiNot) kutu('Kendi notun', kendiNot);
      alt.appendChild(bilgi);

      /* ek araçlar */
      var araclar = e('div', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap' });
      araclar.appendChild(e('button', {
        class: 'dg kucuk sade',
        onclick: function () { notPenceresi(c); }
      }, '📝 Not ekle'));
      if (!basarili && AI.anahtarVar() && cevap && !pasGec) {
        araclar.appendChild(e('button', {
          class: 'dg kucuk',
          onclick: function () { hakemSor(this, c, cevap, alt); }
        }, '⚖️ Cevabım geçerli mi?'));
      }
      if (AI.anahtarVar()) {
        araclar.appendChild(e('button', {
          class: 'dg kucuk',
          onclick: function () { aiAnaliz(this, c, alt); }
        }, '🤖 Ayrıntılı çözümle'));
      }
      araclar.appendChild(e('button', {
        class: 'dg kucuk sade',
        onclick: function () { Atlas.SRS.unut('c', c.id); UI.bildir('Bu cümle listeden çıkarıldı', 'ok'); }
      }, '🚫 Bir daha sorma'));
      alt.appendChild(araclar);

      /* zorluk geri bildirimi + ileri */
      alt.appendChild(e('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px' }, [
        e('button', { class: 'dg kotu', onclick: function () { ileri(true, 30); } }, 'Zordu'),
        e('button', { class: 'dg', onclick: function () { ileri(false, 75); } }, 'Normal'),
        e('button', { class: 'dg iyi', onclick: function () { ileri(false, 96); } }, 'Kolaydı')
      ]));
      alt.appendChild(e('button', {
        class: 'dg ana tam', style: 'margin-top:8px',
        onclick: function () { ileri(null, null); }
      }, i + 1 >= liste.length ? 'Oturumu bitir →' : 'Sonraki cümle →'));

      kart.appendChild(alt);
      alt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      function ileri(zor, yeniSkor) {
        if (zor !== null) {
          /* kullanıcı kendi zorluk hissini verdi — SRS'i ona göre güncelle */
          Atlas.SRS.kaydet('c', c.id, zor, yeniSkor, { mod: c.module, lvl: c.level });
        }
        i++; ciz();
      }
    }

    function notPenceresi(c) {
      var alan = e('textarea', { class: 'alan', placeholder: 'Bu cümleyle ilgili kendi notun…' });
      alan.value = Atlas.Not.al(c.id);
      var kap = e('div', null, [alan, e('button', {
        class: 'dg ana tam', style: 'margin-top:10px',
        onclick: function () { Atlas.Not.kur(c.id, alan.value.trim()); UI.pencereKapat(); UI.bildir('Not kaydedildi', 'ok'); }
      }, 'Kaydet')]);
      UI.pencere(kap, { baslik: 'Kendi notun', alt: c.en, dugmesiz: true });
    }

    function hakemSor(dugme, c, cevap, kap) {
      dugme.disabled = true; dugme.textContent = '⏳ Soruluyor…';
      AI.hakem(c.en, cevap).then(function (r) {
        dugme.remove();
        var renk = r.karar === 'evet' ? 'var(--ok)' : r.karar === 'yazim' ? 'var(--warn)' : 'var(--bad)';
        var baslik = r.karar === 'evet' ? 'Cevabın geçerli' : r.karar === 'yazim' ? 'Doğru, sadece yazım hatası' : 'Bu haliyle olmuyor';
        kap.appendChild(e('div', {
          class: 'kart gir', style: 'margin-top:12px;border-color:' + renk
        }, [
          e('b', { style: 'display:block;color:' + renk + ';margin-bottom:6px;font-size:15px' }, baslik),
          e('p', { style: 'margin:0;font-size:14px;line-height:1.75;white-space:pre-wrap;color:var(--ink-2)' }, r.not)
        ]));
        if (r.karar !== 'hayir') {
          Atlas.SRS.kaydet('c', c.id, false, 88, { mod: c.module, lvl: c.level });
          Atlas.Hata.coz('c', c.id);
          UI.bildir('Cevabın kabul edildi, kayıt güncellendi', 'ok');
        }
      }).catch(function (h) {
        dugme.disabled = false; dugme.textContent = '⚖️ Cevabım geçerli mi?';
        UI.bildir(AI.hataMesaji(h), 'bad', 5000);
      });
    }

    function aiAnaliz(dugme, c, kap) {
      dugme.disabled = true; dugme.textContent = '⏳ Çözümleniyor…';
      AI.analiz(c.en).then(function (m) {
        dugme.remove();
        var d = e('div', { class: 'kart gir', style: 'margin-top:12px' });
        d.appendChild(e('b', { style: 'display:block;margin-bottom:8px;font-size:15px' }, '🤖 Ayrıntılı çözümleme'));
        var g2 = AI.balonMetni(m);
        g2.style.cssText = 'font-size:14px;line-height:1.8;white-space:pre-wrap;color:var(--ink-2)';
        d.appendChild(g2);
        d.appendChild(e('button', {
          class: 'dg kucuk', style: 'margin-top:10px',
          onclick: function () { Ses.konus(m, { baglam: 'tr' }); }
        }, '🔊 Sesli dinle'));
        kap.appendChild(d);
      }).catch(function (h) {
        dugme.disabled = false; dugme.textContent = '🤖 Ayrıntılı çözümle';
        UI.bildir(AI.hataMesaji(h), 'bad', 5000);
      });
    }

    function bitir() {
      ilerlemeCubugu.querySelector('i').style.width = '100%';
      var dk = Math.max(1, Math.round((Date.now() - baslangic) / 60000));
      var ortSkor = skorlar.length ? Math.round(skorlar.reduce(function (a, b) { return a + b; }, 0) / skorlar.length) : 0;
      if (hatasiz && liste.length >= 5) Atlas.Rozet.denetle({ kusursuzTur: true });
      UI.bosalt(sahne);

      UI.kutla({
        ikon: hatasiz ? '💎' : dogru > yanlis ? '🎉' : '💪',
        baslik: hatasiz ? 'Kusursuz tur!' : dogru > yanlis ? 'Oturum bitti' : 'Bitti — zorluydu',
        alt: hatasiz ? 'Tek hata yapmadın. Bu cümleler artık uzun aralıklara geçiyor.'
          : 'Yanlışlar hata defterine işlendi; yarın tekrar karşına gelecekler.',
        istatistik: [
          [dogru, 'doğru', 'var(--ok)'],
          [yanlis, 'yanlış', yanlis ? 'var(--bad)' : null],
          ['%' + ortSkor, 'ortalama'],
          [dk + '′', 'süre']
        ],
        dugmeler: [
          { ad: 'Devam et', ana: true, fn: function () { if (ayar.bitti) ayar.bitti(); else Uygulama.git(ayar.geriYol || '#/'); } },
          { ad: 'Aynı listeyi tekrar çalış', fn: function () { Uygulama.yonlendir(); } }
        ]
      });

      /* özet ekranı arka planda */
      sahne.appendChild(e('div', { class: 'kart parlak', style: 'text-align:center' }, [
        e('div', { style: 'font-size:44px;margin-bottom:8px' }, '✅'),
        e('b', { style: 'font-size:19px' }, 'Oturum tamamlandı'),
        e('p', { class: 'kucuk-yazi', style: 'margin-top:6px' }, dogru + ' doğru · ' + yanlis + ' yanlış · %' + ortSkor + ' ortalama'),
        e('button', {
          class: 'dg ana', style: 'margin-top:14px',
          onclick: function () { Uygulama.git(ayar.geriYol || '#/'); }
        }, 'Geri dön')
      ]));
    }
  }
  global.oturumBaslat = oturumBaslat;

  /* ═══════════════════════════════════════════════════════════
     ÇALIŞMA — bir modül
     ═══════════════════════════════════════════════════════════ */
  Ekran.calis = function (g, arg) {
    var f = arg[0];
    if (!f) { Uygulama.git('#/ogren'); return; }
    Atlas.Ilerleme.sonModul(f);
    g.appendChild(UI.yukleniyor(4));
    Promise.all([Veri.modul(f), Veri.modulBul(f)]).then(function (r) {
      UI.bosalt(g);
      var cumleler = r[0], m = r[1];
      /* önce çalışılmamışlar, sonra vadesi gelenler */
      var srs = Atlas.SRS.tumu(), simdi = Date.now();
      cumleler.sort(function (a, b) {
        var ka = srs['c:' + a.id], kb = srs['c:' + b.id];
        var pa = !ka ? 0 : (ka.vade <= simdi ? 1 : 2);
        var pb = !kb ? 0 : (kb.vade <= simdi ? 1 : 2);
        return pa - pb || (a.order || 0) - (b.order || 0);
      });
      oturumBaslat(g, {
        liste: cumleler,
        geriYol: '#/ogren',
        kaynak: 'modul:' + f,
        bitti: function () { Uygulama.git('#/ogren'); }
      });
    }).catch(function (err) {
      UI.bosalt(g);
      g.appendChild(UI.bos('📡', 'Modül yüklenemedi', String(err.message || err),
        { ad: 'Haritaya dön', fn: function () { Uygulama.git('#/ogren'); } }));
    });
  };

  /* ═══════════════════════════════════════════════════════════
     TEKRAR — vadesi gelenler
     ═══════════════════════════════════════════════════════════ */
  Ekran.tekrar = function (g) {
    var vade = Atlas.SRS.vadesiGelen();
    Uygulama.baslik(g, 'Tekrar', vade.length ? vade.length + ' kalem vadesi geldi' : 'Şimdilik hepsi tazelendi', '#/');

    if (!vade.length) {
      var s = Atlas.SRS.sayim();
      g.appendChild(UI.bos('🌤️', 'Bugünlük tekrar yok',
        s.toplam ? 'Toplam ' + s.toplam + ' kalemin var; en yakın tekrar zamanı geldiğinde burada görünecek. Bu arada yeni bir modüle başlayabilirsin.'
          : 'Henüz hiç kalem yok. Bir modül çalıştıkça tekrarlar birikir.',
        { ad: 'Modül haritasına git', fn: function () { Uygulama.git('#/ogren'); } }));

      if (s.toplam) {
        var dagilim = Atlas.SRS.vadeDagilimi(14);
        g.appendChild(e('div', 'bolum-ad', 'Önümüzdeki 14 gün'));
        var k = e('div', 'kart');
        k.appendChild(UI.sutunGrafik(dagilim, dagilim.map(function (_, i) { return i === 0 ? 'bugün' : '+' + i + ' gün'; })));
        k.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-top:10px' },
          'Aralıklı tekrarın yükü zamana yayılır; bir gün kaçırırsan ertesi gün yığılır.'));
        g.appendChild(k);
      }
      return;
    }

    /* tür kırılımı ve seçenekler */
    var cumleler = vade.filter(function (v) { return v.tip === 'c'; });
    var kelimeler = vade.filter(function (v) { return v.tip === 'k'; });
    var pvler = vade.filter(function (v) { return v.tip === 'p'; });

    var iz = e('div', { class: 'izgara iz-2', style: 'margin-bottom:16px' });
    iz.appendChild(UI.ist(cumleler.length, 'cümle'));
    iz.appendChild(UI.ist(kelimeler.length, 'kelime'));
    iz.appendChild(UI.ist(pvler.length, 'phrasal'));
    iz.appendChild(UI.ist(vade.filter(function (v) { return (v.kayit.hata || 0) > 0; }).length, 'zorlanılan'));
    g.appendChild(iz);

    var secenekler = e('div', { style: 'display:grid;gap:9px' });
    if (cumleler.length) {
      secenekler.appendChild(kartSecenek('📘', 'Cümle tekrarı', cumleler.length + ' cümle', function () {
        cumleTekrar(cumleler.slice(0, 40));
      }));
    }
    if (kelimeler.length) {
      secenekler.appendChild(kartSecenek('🔤', 'Kelime tekrarı', kelimeler.length + ' kelime', function () {
        Uygulama.git('#/kelime/tekrar');
      }));
    }
    if (pvler.length) {
      secenekler.appendChild(kartSecenek('🧩', 'Phrasal verb tekrarı', pvler.length + ' öbek', function () {
        Uygulama.git('#/phrasal/tekrar');
      }));
    }
    var zorlar = vade.filter(function (v) { return v.tip === 'c' && (v.kayit.hata || 0) >= 2; });
    if (zorlar.length) {
      secenekler.appendChild(kartSecenek('🔥', 'Sadece zorlandıklarım', zorlar.length + ' kalem · en çok takıldıkların', function () {
        cumleTekrar(zorlar);
      }));
    }
    g.appendChild(secenekler);

    function kartSecenek(ikon, ad, alt, fn) {
      return e('button', { class: 'satir-kart', style: 'cursor:pointer;text-align:left;width:100%', onclick: fn }, [
        e('span', { style: 'font-size:24px;width:36px;flex:0 0 36px;text-align:center' }, ikon),
        e('span', { style: 'flex:1' }, [
          e('b', { style: 'display:block;font-size:15px;font-weight:750' }, ad),
          e('span', 'kucuk-yazi', alt)
        ]),
        e('span', { style: 'color:var(--ink-3)' }, '→')
      ]);
    }

    function cumleTekrar(kalemler) {
      UI.bosalt(g);
      g.appendChild(UI.yukleniyor(4));
      Veri.cumlelerByIds(kalemler.map(function (k) { return k.id; })).then(function (liste) {
        UI.bosalt(g);
        if (!liste.length) {
          g.appendChild(UI.bos('🧹', 'Bu kayıtların cümlesi bulunamadı',
            'Muhtemelen eski bir veri setinden kalmışlar. Temizleyebilirim.',
            {
              ad: 'Kayıtları temizle', fn: function () {
                kalemler.forEach(function (k) { Atlas.SRS.unut(k.tip, k.id); });
                Uygulama.git('#/tekrar');
              }
            }));
          return;
        }
        oturumBaslat(g, { liste: liste, geriYol: '#/tekrar', kaynak: 'tekrar' });
      });
    }
  };

  /* ═══════════════════════════════════════════════════════════
     TELAFFUZ STÜDYOSU
     ═══════════════════════════════════════════════════════════ */
  Ekran.telaffuz = function (g) {
    Uygulama.baslik(g, 'Telaffuz stüdyosu', 'Dinle, söyle, karşılaştır', '#/menu');
    Atlas.yaz('son-kip', 'telaffuz');
    g.appendChild(UI.yukleniyor(3));
    kaynakSec().then(function (liste) {
      UI.bosalt(g);
      Uygulama.baslik(g, 'Telaffuz stüdyosu', liste.length + ' cümle hazır', '#/menu');
      oturumBaslat(g, { liste: liste, kip: 'telaffuz', geriYol: '#/menu' });
    });
  };

  Ekran.dinleme = function (g) {
    Uygulama.baslik(g, 'Dinleme', 'Duyduğunu yaz', '#/menu');
    g.appendChild(UI.yukleniyor(3));
    kaynakSec().then(function (liste) {
      UI.bosalt(g);
      oturumBaslat(g, { liste: liste, kip: 'dinleme', geriYol: '#/menu' });
    });
  };

  /* vadesi gelenler varsa onlar, yoksa sıradaki modül */
  function kaynakSec() {
    var vade = Atlas.SRS.vadesiGelen('c').slice(0, 25);
    if (vade.length >= 8) return Veri.cumlelerByIds(vade.map(function (v) { return v.id; }));
    return Veri.siradakiModul().then(function (m) { return Veri.modul(m.f); });
  }
})(window);
