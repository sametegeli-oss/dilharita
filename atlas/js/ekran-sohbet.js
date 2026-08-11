/* ═══════════════════════════════════════════════════════════════
   ATLAS · SOHBET · ÖĞRETMEN · KENDİ CÜMLELERİM · MODÜL ÜRETİMİ
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  /* ═══════════════════════════════════════════════════════════
     SENARYO SEÇİMİ
     ═══════════════════════════════════════════════════════════ */
  Ekran.sohbet = function (g, arg) {
    if (arg[0]) { sohbetOturumu(g, AI.senaryoBul(arg[0])); return; }

    Uygulama.baslik(g, 'Konuşma', 'Gerçek bir durumu canlandır, İngilizce konuş', '#/');

    if (!AI.anahtarVar()) {
      g.appendChild(e('div', {
        class: 'kart', style: 'border-color:rgba(255,200,87,.35);background:rgba(255,200,87,.06);margin-bottom:14px'
      }, [
        e('b', { style: 'display:block;margin-bottom:5px' }, '🔑 Konuşma için bir AI anahtarı gerekiyor'),
        e('p', { class: 'kucuk-yazi', style: 'margin:0 0 10px' },
          'Sohbet karşı tarafı bir dil modeli. Ücretsiz bir Groq anahtarı yeter. Uygulamanın geri kalanı anahtarsız da tam çalışır.'),
        e('button', { class: 'dg kucuk ana', onclick: function () { Uygulama.git('#/ayarlar'); } }, 'Anahtar ekle')
      ]));
    }

    var iz = e('div', { class: 'izgara', style: 'grid-template-columns:repeat(auto-fill,minmax(155px,1fr))' });
    AI.SENARYOLAR.forEach(function (s, i) {
      var gecmis = Atlas.oku('sohbet-gecmis', {})[s.kod] || [];
      iz.appendChild(e('button', {
        class: 'kart tikla gir gir-' + Math.min(6, i + 1), style: 'text-align:left;padding:17px',
        onclick: function () { Uygulama.git('#/sohbet/' + s.kod); }
      }, [
        e('div', { style: 'font-size:32px;margin-bottom:8px' }, s.ikon),
        e('b', { style: 'display:block;font-size:15.5px;margin-bottom:3px' }, s.ad),
        e('span', 'kucuk-yazi', s.alt),
        gecmis.length ? e('div', { class: 'et', style: 'margin-top:8px' }, gecmis.length + ' mesaj') : null
      ]));
    });
    g.appendChild(iz);

    g.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-top:18px;text-align:center;max-width:420px;margin-left:auto;margin-right:auto' },
      'Rol yapma senaryoları İngilizce kalır — Türkçeye çevirmek alıştırmanın kendisini yok eder. ' +
      'Türkçe anlatım istiyorsan “İngilizce Öğretmeni” senaryosunu seç.'));
  };

  /* ═══════════════════════════════════════════════════════════
     SOHBET OTURUMU
     ═══════════════════════════════════════════════════════════ */
  function sohbetOturumu(g, senaryo) {
    var depo = Atlas.oku('sohbet-gecmis', {});
    var gecmis = depo[senaryo.kod] || [];

    var ust = e('div', { style: 'display:flex;align-items:center;gap:10px;margin:8px 0 14px' }, [
      e('button', { class: 'dg yuvarlak sade', onclick: function () { Uygulama.git('#/sohbet'); } }, '←'),
      e('span', { style: 'font-size:26px' }, senaryo.ikon),
      e('div', { style: 'flex:1;min-width:0' }, [
        e('b', { style: 'display:block;font-size:16px;font-weight:800;letter-spacing:-.01em' }, senaryo.ad),
        e('span', 'kucuk-yazi', senaryo.ogretmen ? 'Türkçe anlatır' : 'İngilizce konuşur')
      ]),
      e('button', {
        class: 'dg yuvarlak sade', title: 'Sohbeti bitir ve puanla',
        onclick: function () { sohbetPuanla(); }
      }, '🏁'),
      e('button', {
        class: 'dg yuvarlak sade', title: 'Sohbeti temizle',
        onclick: function () {
          UI.onay('Bu senaryodaki tüm mesajlar silinsin mi?', function () {
            gecmis = []; kaydet(); Uygulama.yonlendir();
          }, { tehlike: true, tamamMetni: 'Sil' });
        }
      }, '🗑')
    ]);
    g.appendChild(ust);

    /* ortam görseli — bağlam görsel olunca kelimeler bağlamla kodlanıyor */
    var sahneKap = e('div', { class: 'sohbet-sahne' });
    g.appendChild(sahneKap);
    OrtamFon.uygula(sahneKap, senaryo.kod);

    var av = UI.avatar(104);
    av.style.margin = '0 auto 14px';
    sahneKap.appendChild(av);

    var akis = e('div', 'sohbet-akis');
    g.appendChild(akis);

    if (!gecmis.length) {
      gecmis.push({ ben: false, metin: senaryo.acilis });
      kaydet();
    }
    gecmis.forEach(function (m) { balonEkle(m, false); });
    setTimeout(function () { scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }, 120);

    /* giriş */
    var girisKap = e('div', { style: 'position:sticky;bottom:calc(84px + env(safe-area-inset-bottom));z-index:50;padding-top:8px' });
    var kutu = e('div', {
      class: 'kart', style: 'display:flex;gap:8px;align-items:flex-end;padding:10px;border-radius:22px'
    });
    var alan = e('textarea', {
      class: 'alan', rows: '1', placeholder: senaryo.ogretmen ? 'Sorunu yaz ya da bir cümle dene…' : 'Type your reply…',
      style: 'min-height:46px;max-height:130px;border:0;background:transparent;padding:10px 6px;resize:none'
    });
    alan.addEventListener('input', function () {
      alan.style.height = 'auto';
      alan.style.height = Math.min(130, alan.scrollHeight) + 'px';
    });
    alan.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); gonder(); }
    });
    var mikDugme = e('button', { class: 'dg yuvarlak sade', title: 'Sesle söyle' }, '🎙️');
    var gonderDugme = e('button', { class: 'dg yuvarlak ana', title: 'Gönder' }, '↑');
    gonderDugme.onclick = gonder;
    kutu.appendChild(alan); kutu.appendChild(mikDugme); kutu.appendChild(gonderDugme);
    girisKap.appendChild(kutu);
    g.appendChild(girisKap);

    /* hızlı yanıt önerileri */
    var oneriKap = e('div', { style: 'display:flex;gap:6px;overflow-x:auto;padding:8px 0 0;scrollbar-width:none' });
    girisKap.appendChild(oneriKap);
    oneriCiz();

    function oneriCiz() {
      UI.bosalt(oneriKap);
      var oneriler = senaryo.ogretmen
        ? ['Bunu neden böyle diyoruz?', 'Başka bir örnek ver', 'Bu kelimenin eş anlamlısı ne?', 'Daha kolay bir yol var mı?']
        : ['Sorry, could you repeat that?', 'How do you say this in English?', "I don't understand.", 'Can you say it slower?'];
      oneriler.forEach(function (o) {
        oneriKap.appendChild(e('button', {
          class: 'cip', style: 'flex:0 0 auto',
          onclick: function () { alan.value = o; gonder(); }
        }, o));
      });
    }

    var mikAktif = null;
    mikDugme.onclick = function () {
      if (mikAktif) { mikAktif(); return; }
      if (!Ses.destek().stt) { UI.bildir('Bu tarayıcı ses tanımayı desteklemiyor', 'bad'); return; }
      mikDugme.textContent = '⏹';
      mikDugme.classList.add('ana');
      Ses.dinle({
        dil: senaryo.ogretmen ? 'tr' : 'en',
        kismi: function (t) { alan.value = t; },
        durdurucu: function (f) { mikAktif = f; }
      }).then(function (t) {
        mikAktif = null; mikDugme.textContent = '🎙️'; mikDugme.classList.remove('ana');
        if (t) { alan.value = t; gonder(); }
      }).catch(function () {
        mikAktif = null; mikDugme.textContent = '🎙️'; mikDugme.classList.remove('ana');
        UI.bildir('Ses alınamadı', 'bad');
      });
    };

    function kaydet() {
      depo[senaryo.kod] = gecmis.slice(-60);
      Atlas.yaz('sohbet-gecmis', depo);
    }

    function balonEkle(m, animasyon) {
      var b = e('div', 'balon ' + (m.ben ? 'ben' : 'o'));
      if (m.ben) b.textContent = m.metin;
      else b.appendChild(AI.balonMetni(m.metin));
      if (!animasyon) b.style.animation = 'none';
      akis.appendChild(b);
      if (!m.ben) {
        var araclar = e('div', { style: 'display:flex;gap:6px;justify-self:start;margin-top:-4px' });
        araclar.appendChild(e('button', {
          class: 'dg kucuk sade',
          onclick: function () {
            av.konusuyor(true);
            Ses.konus(m.metin, {
              baglam: senaryo.ogretmen ? 'tr' : 'en',
              agiz: function (k) { av.agiz(k); },
              bitti: function () { av.konusuyor(false); }
            });
          }
        }, '🔊'));
        if (!senaryo.ogretmen) {
          araclar.appendChild(e('button', {
            class: 'dg kucuk sade',
            onclick: function () { ceviriGoster(m.metin, araclar); }
          }, '🇹🇷 Çevir'));
        }
        akis.appendChild(araclar);
      }
      return b;
    }

    function ceviriGoster(metin, kap) {
      if (!AI.anahtarVar()) { UI.bildir('Çeviri için AI anahtarı gerekli', 'bad'); return; }
      AI.cagir([
        { role: 'system', content: 'Verilen İngilizce metni doğal Türkçeye çevir. Sadece çeviriyi yaz, başka hiçbir şey yazma.' },
        { role: 'user', content: metin }
      ], { sicaklik: 0.2, uzunluk: 300 }).then(function (t) {
        kap.parentNode.insertBefore(
          e('div', { class: 'kucuk-yazi', style: 'justify-self:start;max-width:84%;padding:0 4px' }, t),
          kap.nextSibling
        );
      }).catch(function (h) { UI.bildir(AI.hataMesaji(h), 'bad'); });
    }

    /* ═══ sohbet sonu analiz ve puanlama ═══
       Konuşma pratiğinin sonunda "ne kadar iyiydim" sorusunun
       cevabı yoksa kullanıcı ilerlediğini göremiyor. Üç ölçü
       yerel olarak hesaplanıyor; AI varsa üstüne yorum ekliyor. */
    function sohbetPuanla() {
      var benim = gecmis.filter(function (m) { return m.ben; });
      if (benim.length < 2) { UI.bildir('Puanlamak için en az iki mesaj gerekli', 'bad'); return; }

      var kelimeler = benim.reduce(function (a, m) { return a + m.metin.split(/\s+/).filter(Boolean).length; }, 0);
      var ortUzunluk = Math.round(kelimeler / benim.length);
      var essiz = {};
      benim.forEach(function (m) {
        m.metin.toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/).forEach(function (w) {
          if (w.length > 2) essiz[w] = 1;
        });
      });
      var cesitlilik = Object.keys(essiz).length;

      /* akıcılık: ortalama cümle uzunluğu (5 kelime = zayıf, 14+ = iyi) */
      var akicilik = Math.max(0, Math.min(100, Math.round((ortUzunluk - 3) / 11 * 100)));
      /* kelime zenginliği: farklı kelime / toplam kelime */
      var zenginlik = kelimeler ? Math.min(100, Math.round(cesitlilik / kelimeler * 160)) : 0;
      /* katılım: kaç tur konuştun */
      var katilim = Math.min(100, Math.round(benim.length / 8 * 100));
      var genel = Math.round(akicilik * 0.4 + zenginlik * 0.3 + katilim * 0.3);

      Mastery.kaydet('sohbet:' + senaryo.kod, 'akicilik', genel >= 60, { kaynak: 'sohbet' });
      Atlas.Gunluk.ekle('sayac', benim.length, 'sohbet');

      var kap = e('div');
      kap.appendChild(e('div', { style: 'display:flex;align-items:center;gap:16px;margin-bottom:14px' }, [
        UI.halka(genel, { boy: 92, kalinlik: 9, sayi: genel, etiket: 'genel' }),
        e('div', { style: 'flex:1' }, [
          e('b', { style: 'display:block;font-size:16px' },
            genel >= 75 ? 'İyi bir tur' : genel >= 50 ? 'Fena değil' : 'Daha uzun konuşmayı dene'),
          e('span', 'kucuk-yazi', benim.length + ' mesaj · ' + kelimeler + ' kelime · ' + cesitlilik + ' farklı kelime')
        ])
      ]));
      kap.appendChild(e('div', { class: 'izgara iz-3', style: 'margin-bottom:12px' }, [
        UI.ist('%' + akicilik, 'akıcılık'),
        UI.ist('%' + zenginlik, 'kelime çeşidi'),
        UI.ist('%' + katilim, 'katılım')
      ]));
      kap.appendChild(e('p', { class: 'kucuk-yazi', style: 'line-height:1.7' },
        ortUzunluk < 6
          ? 'Cevapların kısa. Tek kelimelik cevap yerine bir sebep ya da örnek eklemeyi dene — akıcılık uzunlukla gelişiyor.'
          : 'Cümle uzunluğun makul. Bir sonraki turda aynı şeyi farklı kelimelerle söylemeyi deneyebilirsin.'));

      var aiKap = e('div');
      kap.appendChild(aiKap);
      if (AI.anahtarVar()) {
        var d = e('button', { class: 'dg tam', style: 'margin-top:10px' }, '🤖 Ayrıntılı öğretmen raporu');
        aiKap.appendChild(d);
        d.onclick = function () {
          d.disabled = true; d.textContent = '⏳ Hazırlanıyor…';
          AI.cagir([
            {
              role: 'system', content: [
                'Öğrencinin İngilizce rol yapma sohbetindeki KENDİ mesajlarını değerlendir.',
                'Türkçe yaz. Şu başlıklarla, her biri 1-3 cümle:',
                'GÜÇLÜ:', 'TEKRARLAYAN HATA:', 'DAHA DOĞAL SÖYLEYİŞ:', 'SIRADAKİ ADIM:',
                'Düzelttiğin İngilizce cümleleri [[ ]] içine al. Sadece Türkçe ve İngilizce kullan.'
              ].join('\n')
            },
            { role: 'user', content: benim.map(function (m, i) { return (i + 1) + ') ' + m.metin; }).join('\n') }
          ], { sicaklik: 0.4, uzunluk: 800 }).then(function (m) {
            UI.bosalt(aiKap);
            var kart = e('div', { class: 'kart', style: 'margin-top:10px' });
            var gg = AI.balonMetni(m);
            gg.style.cssText = 'font-size:14px;line-height:1.75;white-space:pre-wrap;color:var(--ink-2)';
            kart.appendChild(gg);
            aiKap.appendChild(kart);
          }).catch(function (h) {
            d.disabled = false; d.textContent = '🤖 Ayrıntılı öğretmen raporu';
            UI.bildir(AI.hataMesaji(h), 'bad');
          });
        };
      } else {
        aiKap.appendChild(e('button', {
          class: 'dg tam', style: 'margin-top:10px',
          onclick: function () {
            Kopru.ac({
              baslik: 'Sohbet raporu',
              prompt: 'Aşağıda bir İngilizce öğrencisinin rol yapma sohbetindeki mesajları var. ' +
                'Türkçe kısa bir değerlendirme yaz: güçlü yanı, tekrarlayan hatası, daha doğal söyleyiş önerisi ve sıradaki adım.\n\n' +
                benim.map(function (m, i) { return (i + 1) + ') ' + m.metin; }).join('\n'),
              geri: function (t) {
                UI.bosalt(aiKap);
                aiKap.appendChild(e('div', {
                  class: 'kart', style: 'margin-top:10px;font-size:14px;line-height:1.75;white-space:pre-wrap;color:var(--ink-2)'
                }, t));
              }
            });
          }
        }, '🔗 AI köprüsüyle rapor al'));
      }

      UI.pencere(kap, { baslik: senaryo.ikon + ' Sohbet raporu', alt: senaryo.ad });
    }

    function gonder() {
      var metin = alan.value.trim();
      if (!metin) return;
      alan.value = ''; alan.style.height = 'auto';
      var m = { ben: true, metin: metin };
      gecmis.push(m); kaydet();
      balonEkle(m, true);
      scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

      Atlas.Gunluk.ekle('sayac', 1, 'sohbet');

      if (!AI.anahtarVar()) {
        var uyari = { ben: false, metin: 'AI anahtarı tanımlı değil, bu yüzden cevap veremiyorum. Ayarlar → Yapay zekâ bölümünden ücretsiz bir anahtar ekleyebilirsin.' };
        gecmis.push(uyari); kaydet(); balonEkle(uyari, true);
        return;
      }

      var yaziyor = e('div', { class: 'balon o yaziyor' }, [e('i'), e('i'), e('i')]);
      akis.appendChild(yaziyor);
      scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      av.konusuyor(true);

      AI.sohbet(senaryo, gecmis.slice(0, -1), metin).then(function (cevap) {
        yaziyor.remove();
        var c = { ben: false, metin: cevap };
        gecmis.push(c); kaydet();
        balonEkle(c, true);
        scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        if (Atlas.Ayar.al().otoSes) {
          Ses.konus(cevap, {
            baglam: senaryo.ogretmen ? 'tr' : 'en',
            agiz: function (k) { av.agiz(k); },
            bitti: function () { av.konusuyor(false); }
          });
        } else av.konusuyor(false);
      }).catch(function (h) {
        yaziyor.remove(); av.konusuyor(false);
        var c2 = { ben: false, metin: AI.hataMesaji(h) };
        balonEkle(c2, true);
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     ÖĞRETMEN — cümle çözümleme
     ═══════════════════════════════════════════════════════════ */
  Ekran.ogretmen = function (g) {
    Uygulama.baslik(g, 'Öğretmen', 'Bir cümle yapıştır, Türkçe anlatayım', '#/menu');

    var av = UI.avatar(118);
    av.style.margin = '0 auto 16px';
    g.appendChild(av);

    var alan = e('textarea', { class: 'alan', placeholder: 'Çözümlemek istediğin İngilizce cümle…' });
    g.appendChild(alan);

    var satir = e('div', { style: 'display:flex;gap:8px;margin-top:10px' });
    var coz = e('button', { class: 'dg ana', style: 'flex:1' }, '🔍 Çözümle');
    satir.appendChild(coz);
    satir.appendChild(e('button', {
      class: 'dg', onclick: function () { Ses.konus(alan.value, { baglam: 'en' }); }
    }, '🔊'));
    g.appendChild(satir);

    var sonuc = e('div', { style: 'margin-top:16px' });
    g.appendChild(sonuc);

    coz.onclick = function () {
      var c = alan.value.trim();
      if (!c) return;
      UI.bosalt(sonuc);
      if (!AI.anahtarVar()) {
        sonuc.appendChild(e('div', { class: 'kart', style: 'border-color:rgba(255,200,87,.35)' }, [
          e('b', { style: 'display:block;margin-bottom:6px' }, '🔑 Anahtar gerekli'),
          e('p', { class: 'kucuk-yazi', style: 'margin:0 0 10px' },
            'Serbest cümle çözümlemesi için bir AI anahtarı gerekiyor. Veri setindeki cümleler için hazır açıklamalar anahtarsız da çalışıyor — çalışma ekranında görebilirsin.'),
          e('button', { class: 'dg kucuk ana', onclick: function () { Uygulama.git('#/ayarlar'); } }, 'Anahtar ekle')
        ]));
        return;
      }
      sonuc.appendChild(UI.yukleniyor(3));
      av.konusuyor(true);
      AI.analiz(c).then(function (m) {
        UI.bosalt(sonuc);
        var kart = e('div', 'kart parlak');
        var d = AI.balonMetni(m);
        d.style.cssText = 'font-size:14.5px;line-height:1.85;white-space:pre-wrap;color:var(--ink-2)';
        kart.appendChild(d);
        kart.appendChild(e('div', { style: 'display:flex;gap:8px;margin-top:14px;flex-wrap:wrap' }, [
          e('button', {
            class: 'dg kucuk',
            onclick: function () {
              Ses.konus(m, {
                baglam: 'tr', agiz: function (k) { av.agiz(k); },
                bitti: function () { av.konusuyor(false); }
              });
              av.konusuyor(true);
            }
          }, '🔊 Sesli anlat'),
          e('button', {
            class: 'dg kucuk',
            onclick: function () {
              var yeni = Atlas.Ozel.ekle({ en: c, tr: '', aiExplain: m.replace(/\[\[|\]\]/g, '') });
              Veri.indexBellek = null;
              UI.bildir('Cümle “Kendi Cümlelerim” listene eklendi', 'ok');
            }
          }, '➕ Listeme ekle')
        ]));
        sonuc.appendChild(kart);
        av.konusuyor(false);
      }).catch(function (h) {
        UI.bosalt(sonuc); av.konusuyor(false);
        sonuc.appendChild(e('p', 'kucuk-yazi', AI.hataMesaji(h)));
      });
    };

    /* hızlı örnekler */
    g.appendChild(e('div', 'bolum-ad', 'Hızlı dene'));
    var ornekler = ['If I had known, I would have come earlier.',
      'She has been working here since 2019.',
      'Not only did he apologise, but he also paid for it.'];
    var oz = e('div', { style: 'display:grid;gap:6px' });
    ornekler.forEach(function (o) {
      oz.appendChild(e('button', {
        class: 'satir-kart', style: 'cursor:pointer;font-size:13.5px;text-align:left;width:100%',
        onclick: function () { alan.value = o; coz.click(); }
      }, o));
    });
    g.appendChild(oz);
  };

  /* ═══════════════════════════════════════════════════════════
     KENDİ CÜMLELERİM
     ═══════════════════════════════════════════════════════════ */
  Ekran.kendi = function (g) {
    var liste = Atlas.Ozel.hepsi();
    Uygulama.baslik(g, 'Kendi cümlelerim', liste.length + ' cümle', '#/menu');

    var ekleKart = e('div', { class: 'kart parlak', style: 'margin-bottom:16px' });
    var enAlan = e('input', { class: 'alan', placeholder: 'İngilizce cümle', style: 'margin-bottom:8px' });
    var trAlan = e('input', { class: 'alan', placeholder: 'Türkçesi (boş bırakırsan AI çevirir)', style: 'margin-bottom:10px' });
    ekleKart.appendChild(enAlan); ekleKart.appendChild(trAlan);
    ekleKart.appendChild(e('div', { style: 'display:flex;gap:8px' }, [
      e('button', {
        class: 'dg ana', style: 'flex:1',
        onclick: function () {
          var en = enAlan.value.trim();
          if (!en) return;
          var tr = trAlan.value.trim();
          if (!tr && AI.anahtarVar()) {
            UI.bildir('Çevriliyor…', 'bilgi', 1500);
            AI.cagir([
              { role: 'system', content: 'İngilizce cümleyi doğal Türkçeye çevir. Sadece çeviriyi yaz.' },
              { role: 'user', content: en }
            ], { sicaklik: 0.2, uzunluk: 200 }).then(function (t) { ekle(en, t); })
              .catch(function () { ekle(en, ''); });
          } else ekle(en, tr);
        }
      }, '➕ Ekle'),
      e('button', { class: 'dg', onclick: topluEkle }, '📋 Toplu')
    ]));
    g.appendChild(ekleKart);

    function ekle(en, tr) {
      Atlas.Ozel.ekle({ en: en, tr: tr });
      Veri.indexBellek = null;
      enAlan.value = ''; trAlan.value = '';
      UI.bildir('Eklendi', 'ok');
      Uygulama.yonlendir();
    }

    function topluEkle() {
      var alan = e('textarea', {
        class: 'alan', rows: '9',
        placeholder: 'Her satıra bir cümle.\nTürkçesini eklemek istersen:\nI am happy. = Mutluyum.'
      });
      var kap = e('div', null, [
        e('p', { class: 'kucuk-yazi', style: 'margin-bottom:10px' },
          'Bir metinden, kitaptan veya fotoğraftan kopyaladığın cümleleri buraya yapıştır. ' +
          'Her satır bir cümle olur; “=” işaretinden sonrasını Türkçe kabul ederim.'),
        alan,
        e('button', {
          class: 'dg ana tam', style: 'margin-top:10px',
          onclick: function () {
            var satirlar = alan.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
            if (!satirlar.length) return;
            var cumleler = satirlar.map(function (s) {
              var p = s.split(/\s*[=|·]\s*/);
              return { en: p[0], tr: p[1] || '' };
            });
            Atlas.Ozel.coklaEkle(cumleler);
            Veri.indexBellek = null;
            UI.pencereKapat();
            UI.bildir(cumleler.length + ' cümle eklendi', 'ok');
            Uygulama.yonlendir();
          }
        }, 'Hepsini ekle')
      ]);
      UI.pencere(kap, { baslik: 'Toplu ekle', dugmesiz: true });
    }

    if (!liste.length) {
      g.appendChild(UI.bos('✍️', 'Henüz kendi cümlen yok',
        'Dizide duyduğun, kitapta gördüğün, işte kullandığın cümleleri buraya ekle. Aynı SRS motoruyla çalışırlar.'));
      return;
    }

    g.appendChild(e('button', {
      class: 'dg ana tam', style: 'margin-bottom:14px',
      onclick: function () {
        UI.bosalt(g);
        oturumBaslat(g, {
          liste: liste.map(function (c) { return Object.assign({ level: c.level, module: 'Kendi Cümlelerim' }, c); }),
          geriYol: '#/kendi'
        });
      }
    }, '📘 Bu listeyi çalış'));

    var lk = e('div', { style: 'display:grid;gap:8px' });
    liste.forEach(function (c) {
      lk.appendChild(e('div', { class: 'satir-kart' }, [
        e('div', { style: 'flex:1;min-width:0' }, [
          e('b', { style: 'display:block;font-size:14.5px' }, c.en),
          e('span', 'kucuk-yazi', c.tr || '(çeviri yok)')
        ]),
        e('button', { class: 'dg kucuk', onclick: function () { Ses.konus(c.en, { baglam: 'en' }); } }, '🔊'),
        e('button', {
          class: 'dg kucuk sade', onclick: function () {
            Atlas.Ozel.sil(c.id); Veri.indexBellek = null; Uygulama.yonlendir();
          }
        }, '✕')
      ]));
    });
    g.appendChild(lk);
  };

  /* ═══════════════════════════════════════════════════════════
     MODÜL ÜRETİMİ (AI)
     ═══════════════════════════════════════════════════════════ */
  Ekran.uret = function (g) {
    Uygulama.baslik(g, 'Kendine modül üret', 'İlgi alanına özel cümleler', '#/menu');

    if (!AI.anahtarVar()) {
      g.appendChild(UI.bos('🔑', 'AI anahtarı gerekli',
        'Bu ekran modele cümle ürettiriyor. Ücretsiz bir Groq anahtarı yeterli.',
        { ad: 'Ayarlara git', fn: function () { Uygulama.git('#/ayarlar'); } }));
      return;
    }

    var konu = e('input', { class: 'alan', placeholder: 'Konu: yazılım mülakatı, kahve siparişi, futbol…', style: 'margin-bottom:10px' });
    var seviye = e('select', { class: 'alan', style: 'margin-bottom:10px' });
    Atlas.SEVIYELER.forEach(function (s) {
      seviye.appendChild(e('option', { value: s, selected: s === Atlas.Profil.al().seviye ? '' : null }, s));
    });
    var adet = e('select', { class: 'alan', style: 'margin-bottom:12px' });
    [8, 12, 16, 20].forEach(function (n) { adet.appendChild(e('option', { value: n }, n + ' cümle')); });

    var kart = e('div', 'kart parlak');
    kart.appendChild(konu); kart.appendChild(seviye); kart.appendChild(adet);
    var uretDugme = e('button', { class: 'dg ana tam' }, '✨ Üret');
    kart.appendChild(uretDugme);
    g.appendChild(kart);

    var sonuc = e('div', { style: 'margin-top:16px' });
    g.appendChild(sonuc);

    uretDugme.onclick = function () {
      var k = konu.value.trim();
      if (!k) { konu.focus(); return; }
      UI.bosalt(sonuc);
      sonuc.appendChild(UI.yukleniyor(4));
      uretDugme.disabled = true; uretDugme.textContent = '⏳ Üretiliyor…';
      AI.modulUret(k, seviye.value, +adet.value).then(function (liste) {
        uretDugme.disabled = false; uretDugme.textContent = '✨ Üret';
        UI.bosalt(sonuc);
        sonuc.appendChild(e('div', { style: 'display:flex;gap:8px;margin-bottom:12px' }, [
          e('button', {
            class: 'dg ana', style: 'flex:1',
            onclick: function () {
              var cumleler = liste.map(function (c) {
                return {
                  en: c.en, tr: c.tr, grammar: c.grammar, aiExplain: c.aiExplain,
                  commonMistake: c.commonMistake, level: seviye.value, module: k
                };
              });
              Atlas.Ozel.coklaEkle(cumleler);
              Veri.indexBellek = null;
              UI.bildir(cumleler.length + ' cümle listene eklendi', 'ok');
            }
          }, '💾 Listeme kaydet'),
          e('button', {
            class: 'dg',
            onclick: function () {
              UI.bosalt(g);
              oturumBaslat(g, {
                liste: liste.map(function (c, n) {
                  return Object.assign({ id: 'URT-' + Date.now() + '-' + n, level: seviye.value, module: k }, c);
                }),
                geriYol: '#/uret'
              });
            }
          }, '▶️ Hemen çalış')
        ]));
        liste.forEach(function (c, n) {
          sonuc.appendChild(e('div', { class: 'kart gir gir-' + Math.min(6, n % 6 + 1), style: 'margin-bottom:8px;padding:14px' }, [
            e('b', { style: 'display:block;font-size:15px' }, c.en),
            e('div', { class: 'kucuk-yazi', style: 'margin-bottom:6px' }, c.tr),
            c.aiExplain ? e('p', { style: 'margin:0;font-size:13px;line-height:1.6;color:var(--ink-2)' }, c.aiExplain) : null
          ]));
        });
      }).catch(function (h) {
        uretDugme.disabled = false; uretDugme.textContent = '✨ Üret';
        UI.bosalt(sonuc);
        sonuc.appendChild(e('p', 'kucuk-yazi', AI.hataMesaji(h)));
      });
    };

    g.appendChild(e('div', 'bolum-ad', 'Fikir mi lazım'));
    var fikirler = ['iş toplantısında fikir belirtmek', 'doktorda ağrı anlatmak', 'kira sözleşmesi konuşmak',
      'restoranda alerji belirtmek', 'e-postada kibarca reddetmek', 'takım halinde kod incelemesi'];
    var fk = e('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' });
    fikirler.forEach(function (f) {
      fk.appendChild(e('button', { class: 'cip', onclick: function () { konu.value = f; } }, f));
    });
    g.appendChild(fk);
  };
})(window);
