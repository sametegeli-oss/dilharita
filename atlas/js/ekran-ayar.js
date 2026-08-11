/* ═══════════════════════════════════════════════════════════════
   ATLAS · AYARLAR ve VERİ
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  function bolum(baslik, alt) {
    var k = e('div', { class: 'kart', style: 'margin-bottom:12px' });
    k.appendChild(e('b', { style: 'display:block;font-size:16px;font-weight:800;letter-spacing:-.01em;margin-bottom:' + (alt ? '4px' : '12px') }, baslik));
    if (alt) k.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin:0 0 12px' }, alt));
    return k;
  }

  function satir(etiket, kontrol, aciklama) {
    return e('div', { style: 'margin-bottom:12px' }, [
      e('label', { style: 'display:block;font-size:13px;font-weight:700;color:var(--ink-2);margin-bottom:6px' }, etiket),
      kontrol,
      aciklama ? e('div', { class: 'kucuk-yazi', style: 'margin-top:5px' }, aciklama) : null
    ]);
  }

  function anahtarDugme(etiket, deger, degisti, aciklama) {
    var d = e('button', {
      class: 'satir-kart', style: 'width:100%;cursor:pointer;text-align:left;margin-bottom:8px'
    }, [
      e('div', { style: 'flex:1' }, [
        e('b', { style: 'display:block;font-size:14px;font-weight:700' }, etiket),
        aciklama ? e('span', 'kucuk-yazi', aciklama) : null
      ]),
      e('div', {
        class: 'anahtar',
        style: 'width:46px;height:26px;border-radius:99px;position:relative;flex:0 0 46px;transition:background .3s var(--ez);' +
          'background:' + (deger ? 'var(--brand)' : 'var(--line-2)')
      }, [
        e('div', {
          style: 'position:absolute;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;' +
            'transition:left .3s var(--sp);left:' + (deger ? '23px' : '3px')
        })
      ])
    ]);
    d.onclick = function () {
      deger = !deger;
      var a = d.querySelector('.anahtar');
      a.style.background = deger ? 'var(--brand)' : 'var(--line-2)';
      a.firstChild.style.left = deger ? '23px' : '3px';
      degisti(deger);
    };
    return d;
  }

  /* ═══════════════════════════════════════════════════════════
     AYARLAR
     ═══════════════════════════════════════════════════════════ */
  Ekran.ayarlar = function (g) {
    Uygulama.baslik(g, 'Ayarlar', 'Uygulamayı kendine göre ayarla', '#/menu');
    var a = Atlas.Ayar.al();
    var pr = Atlas.Profil.al();

    /* ── profil ── */
    var b1 = bolum('Profil');
    var adAlan = e('input', { class: 'alan', value: pr.ad || '', placeholder: 'Adın' });
    adAlan.onchange = function () { Atlas.Profil.kur({ ad: adAlan.value.trim() }); };
    b1.appendChild(satir('Ad', adAlan));

    var svSecim = e('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
    Atlas.SEVIYELER.forEach(function (s) {
      svSecim.appendChild(e('button', {
        class: 'cip', style: 'border-color:' + (pr.seviye === s ? 'var(--brand)' : '') + ';color:' + (pr.seviye === s ? 'var(--brand)' : ''),
        onclick: function () {
          Atlas.Profil.kur({ seviye: s });
          Atlas.yaz('secili-seviye', s);
          Uygulama.yonlendir();
        }
      }, s));
    });
    svSecim.appendChild(e('button', {
      class: 'cip', onclick: function () { Uygulama.git('#/seviye-testi'); }
    }, '📝 Test et'));
    b1.appendChild(satir('Seviye', svSecim, 'Modül sıralaması ve AI’ın kullandığı dil zorluğu buna göre ayarlanır.'));

    var hedefAlan = e('input', { class: 'alan', type: 'number', min: '5', max: '200', value: pr.hedef || 20 });
    hedefAlan.onchange = function () {
      Atlas.Profil.kur({ hedef: Math.max(5, Math.min(200, +hedefAlan.value || 20)) });
      Uygulama.ustYenile();
    };
    b1.appendChild(satir('Günlük hedef (kalem)', hedefAlan, 'Aralıklı tekrarda süreklilik miktardan önemli. Kaçırdığın gün yığılmayı büyütür.'));
    g.appendChild(b1);

    /* ── görünüm ── */
    var b2 = bolum('Görünüm');
    var temaSecim = e('div', { style: 'display:flex;gap:8px' });
    [['gece', '🌙 Gece'], ['isik', '☀️ Işık']].forEach(function (t) {
      temaSecim.appendChild(e('button', {
        class: 'dg', style: 'flex:1;border-color:' + (a.tema === t[0] ? 'var(--brand)' : ''),
        onclick: function () { Atlas.Ayar.kur({ tema: t[0] }); Uygulama.yonlendir(); }
      }, t[1]));
    });
    b2.appendChild(satir('Tema', temaSecim));
    b2.appendChild(anahtarDugme('Okuma kolaylığı', a.okuma, function (v) { Atlas.Ayar.kur({ okuma: v }); }, 'Serif yazı tipi, daha geniş harf aralığı'));
    b2.appendChild(anahtarDugme('Klavye kısayolları', a.klavye, function (v) { Atlas.Ayar.kur({ klavye: v }); }, '1–5 tuşlarıyla ekran değiştir, Esc ile kapat'));
    g.appendChild(b2);

    /* ── ses ── */
    var b3 = bolum('Ses', 'Türkçe anlatım Türkçe sesle, [[İngilizce]] parçalar İngilizce sesle okunur.');
    var hiz = e('input', { class: 'alan', type: 'range', min: '0.5', max: '1.3', step: '0.05', value: a.sesHiz });
    var hizEtiket = e('span', { class: 'kucuk-yazi' }, '×' + a.sesHiz);
    hiz.oninput = function () { hizEtiket.textContent = '×' + hiz.value; };
    hiz.onchange = function () { Atlas.Ayar.kur({ sesHiz: +hiz.value }); };
    b3.appendChild(satir('Konuşma hızı', e('div', null, [hiz, hizEtiket])));

    var enSecim = e('select', 'alan');
    var trSecim = e('select', 'alan');
    function sesDoldur() {
      [['en', enSecim, a.sesEn], ['tr', trSecim, a.sesTr]].forEach(function (o) {
        UI.bosalt(o[1]);
        o[1].appendChild(e('option', { value: '' }, 'Otomatik seç'));
        Ses.sesListesi(o[0]).forEach(function (v) {
          o[1].appendChild(e('option', { value: v.name, selected: v.name === o[2] ? '' : null }, v.name + ' (' + v.lang + ')'));
        });
      });
    }
    sesDoldur();
    setTimeout(sesDoldur, 700);
    enSecim.onchange = function () { Atlas.Ayar.kur({ sesEn: enSecim.value }); };
    trSecim.onchange = function () { Atlas.Ayar.kur({ sesTr: trSecim.value }); };
    b3.appendChild(satir('İngilizce ses', enSecim));
    b3.appendChild(satir('Türkçe ses', trSecim));
    b3.appendChild(anahtarDugme('Otomatik seslendirme', a.otoSes, function (v) { Atlas.Ayar.kur({ otoSes: v }); }, 'Cümle ekranda belirince kendiliğinden okunsun'));
    b3.appendChild(e('button', {
      class: 'dg tam', onclick: function () {
        Ses.konus('Merhaba, bu bir deneme. Şimdi İngilizce: [[This is a test sentence.]] Duyduysan ayarlar doğru.', { baglam: 'tr' });
      }
    }, '🔊 Sesi dene'));
    var destek = Ses.destek();
    b3.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-top:10px' },
      'Bu tarayıcıda: seslendirme ' + (destek.tts ? '✅' : '❌') +
      ' · ses tanıma ' + (destek.stt ? '✅' : '❌ (gölgeleme kipi devrede)') +
      ' · kayıt ' + (destek.kayit ? '✅' : '❌')));
    g.appendChild(b3);

    /* ── yapay zekâ ── */
    var b4 = bolum('Yapay zekâ', 'İsteğe bağlı. Anahtar yoksa uygulama tam çalışır; açıklamalar veri setinden gelir.');
    var sagSecim = e('select', 'alan');
    Object.keys(AI.SAGLAYICI).forEach(function (k) {
      sagSecim.appendChild(e('option', { value: k, selected: a.aiSaglayici === k ? '' : null }, AI.SAGLAYICI[k].ad));
    });
    var modelSecim = e('select', 'alan');
    function modelDoldur() {
      UI.bosalt(modelSecim);
      (AI.SAGLAYICI[sagSecim.value] || {}).modeller.forEach(function (m) {
        modelSecim.appendChild(e('option', { value: m, selected: a.aiModel === m ? '' : null }, m));
      });
    }
    modelDoldur();
    sagSecim.onchange = function () {
      modelDoldur();
      Atlas.Ayar.kur({ aiSaglayici: sagSecim.value, aiModel: modelSecim.value });
      Uygulama.yonlendir();
    };
    modelSecim.onchange = function () { Atlas.Ayar.kur({ aiModel: modelSecim.value }); };
    var anahtar = e('input', { class: 'alan', type: 'password', value: a.aiAnahtar || '', placeholder: 'gsk_… / AIza…' });
    anahtar.onchange = function () { Atlas.Ayar.kur({ aiAnahtar: anahtar.value.trim() }); };

    b4.appendChild(satir('Sağlayıcı', sagSecim));
    b4.appendChild(satir('Model', modelSecim));
    b4.appendChild(satir('API anahtarı', anahtar,
      'Anahtar yalnızca senin tarayıcında saklanır, hiçbir yere gönderilmez. ' +
      ((AI.SAGLAYICI[a.aiSaglayici] || {}).anahtarYeri ? 'Ücretsiz almak için: ' + AI.SAGLAYICI[a.aiSaglayici].anahtarYeri : '')));
    var denemeSonuc = e('div', { class: 'kucuk-yazi', style: 'margin-top:8px' });
    b4.appendChild(e('button', {
      class: 'dg tam', onclick: function () {
        denemeSonuc.textContent = '⏳ Deneniyor…';
        AI.cagir([{ role: 'user', content: 'Tek kelimeyle cevap ver: TAMAM' }], { uzunluk: 20 })
          .then(function (m) { denemeSonuc.textContent = '✅ Bağlantı çalışıyor — model dedi ki: ' + m.slice(0, 40); })
          .catch(function (h) { denemeSonuc.textContent = '❌ ' + AI.hataMesaji(h); });
      }
    }, '🔌 Bağlantıyı dene'));
    b4.appendChild(denemeSonuc);
    g.appendChild(b4);

    /* ── görsel ── */
    var b5 = bolum('Cümle görselleri', 'Cümlenin sahnesini gösteren resim, kelimeyi çeviriye değil anlama bağlar.');
    b5.appendChild(anahtarDugme('Görselleri göster', a.gorsel !== false,
      function (v) { Atlas.Ayar.kur({ gorsel: v }); },
      'Kapalıyken hiç istek atılmaz, veri harcanmaz'));
    var pexels = e('input', { class: 'alan', type: 'password', value: a.gorselAnahtar || '', placeholder: 'Pexels API anahtarı (isteğe bağlı)' });
    pexels.onchange = function () { Atlas.Ayar.kur({ gorselAnahtar: pexels.value.trim() }); };
    b5.appendChild(satir('Pexels anahtarı', pexels,
      'Boş bırakırsan Openverse → Wikimedia Commons → Wikipedia sırasıyla anahtarsız aranır. ' +
      'Anahtar girersen önce Pexels denenir, sonuçlar daha isabetli olur. pexels.com/api adresinden ücretsiz alınır.'));
    b5.appendChild(e('button', {
      class: 'dg tam', onclick: function () {
        Gorsel.onbellegiTemizle().then(function () { UI.bildir('Görsel önbelleği temizlendi', 'ok'); });
      }
    }, '🧹 Görsel önbelleğini temizle'));
    g.appendChild(b5);

    /* ── hatırlatma ── */
    var b6 = bolum('Hatırlatma', 'Sunucu yok — bildirim yalnız uygulama açıkken ya da açtığında gösterilir.');
    if (!Hatirlatma.destek()) {
      b6.appendChild(e('p', 'kucuk-yazi', 'Bu tarayıcı bildirimleri desteklemiyor.'));
    } else {
      var saat = e('input', { class: 'alan', type: 'time', value: a.gunlukHatirlatma || '' });
      saat.onchange = function () {
        if (saat.value && Hatirlatma.durum() !== 'granted') {
          Hatirlatma.izinIste().then(function (d) {
            if (d === 'granted') { Hatirlatma.kur(saat.value); UI.bildir('Hatırlatma kuruldu', 'ok'); }
            else { saat.value = ''; UI.bildir('Bildirim izni verilmedi', 'bad'); }
          });
        } else { Hatirlatma.kur(saat.value); }
      };
      b6.appendChild(satir('Günlük saat', saat,
        'O saatten sonra uygulamayı açtığında, o gün henüz çalışmadıysan hatırlatır. ' +
        'Hedefini tamamladıysan hiç rahatsız etmez.'));
      b6.appendChild(e('button', {
        class: 'dg tam', onclick: function () {
          if (Hatirlatma.durum() !== 'granted') {
            Hatirlatma.izinIste().then(function (d) {
              if (d === 'granted') Hatirlatma.dene(); else UI.bildir('İzin verilmedi', 'bad');
            });
          } else if (!Hatirlatma.dene()) UI.bildir('Bildirim gösterilemedi', 'bad');
        }
      }, '🔔 Bildirimi dene'));
    }
    g.appendChild(b6);

    /* ── veri ── */
    g.appendChild(e('button', {
      class: 'dg tam', style: 'margin-bottom:8px',
      onclick: function () { Uygulama.git('#/hesap'); }
    }, '☁️ Hesap ve bulut senkron →'));
    g.appendChild(e('button', {
      class: 'dg tam', style: 'margin-bottom:8px',
      onclick: function () { Uygulama.git('#/ses-teshis'); }
    }, '🔬 Ses teşhis →'));
    g.appendChild(e('button', {
      class: 'dg tam', style: 'margin-bottom:12px',
      onclick: function () { Uygulama.git('#/veri'); }
    }, '💾 Veri ve yedek →'));
    g.appendChild(e('button', {
      class: 'dg sade tam', style: 'margin-bottom:8px',
      onclick: function () { Uygulama.git('#/kilavuz'); }
    }, '📘 Kullanım kılavuzu'));
    g.appendChild(e('button', {
      class: 'dg sade tam',
      onclick: function () { Uygulama.git('#/hakkinda'); }
    }, 'ℹ️ Nasıl çalışır'));
  };

  /* ═══════════════════════════════════════════════════════════
     HESAP ve BULUT SENKRON
     ═══════════════════════════════════════════════════════════ */
  Ekran.hesap = function (g) {
    Uygulama.baslik(g, 'Hesap ve bulut', 'İsteğe bağlı — kendi Firebase projenle', '#/ayarlar');

    g.appendChild(e('div', { class: 'kart', style: 'margin-bottom:12px;border-color:rgba(255,200,87,.3)' }, [
      e('b', { style: 'display:block;margin-bottom:6px' }, 'Neden hesap yok?'),
      e('p', { class: 'kucuk-yazi', style: 'margin:0' },
        'Atlas’ın sunucusu yok; verin tarayıcında duruyor. İki cihaz arasında senkron istersen ' +
        'kendi Firebase projeni bağlayabilirsin — veri senin projende kalır, bende hiçbir şey durmaz. ' +
        'Tek cihaz kullanıyorsan bunun yerine Veri ekranından yedek almak daha basit.')
    ]));

    /* ── yapılandırma ── */
    var b1 = bolum('Firebase yapılandırması');
    var mevcut = Bulut.yapilandirma();
    var alan = e('textarea', {
      class: 'alan', rows: '7',
      placeholder: '{\n  "apiKey": "...",\n  "authDomain": "proje.firebaseapp.com",\n  "projectId": "proje",\n  "appId": "..."\n}'
    });
    if (mevcut) alan.value = JSON.stringify(mevcut, null, 2);
    b1.appendChild(alan);
    b1.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin:8px 0' },
      'Firebase konsolunda proje oluştur → Web uygulaması ekle → firebaseConfig nesnesini buraya yapıştır. ' +
      'Authentication (Anonim ve/veya E-posta) ile Firestore’u etkinleştirmen gerekir.'));
    b1.appendChild(e('button', {
      class: 'dg ana tam', onclick: function () {
        var t = alan.value.trim();
        if (!t) { Atlas.yaz('firebase', null); UI.bildir('Yapılandırma silindi', 'ok'); Uygulama.yonlendir(); return; }
        try {
          /* hem JSON hem "const firebaseConfig = {...}" biçimini kabul et */
          var j = t.indexOf('{') >= 0 ? t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1) : t;
          var o = JSON.parse(j.replace(/(\w+)\s*:/g, '"$1":').replace(/"{2,}/g, '"').replace(/'/g, '"').replace(/,\s*}/g, '}'));
          if (!o.apiKey || !o.projectId) throw new Error('apiKey ve projectId gerekli');
          Atlas.yaz('firebase', o);
          UI.bildir('Yapılandırma kaydedildi', 'ok');
          Uygulama.yonlendir();
        } catch (err) { UI.bildir('Okunamadı: ' + err.message, 'bad', 5000); }
      }
    }, 'Kaydet'));
    g.appendChild(b1);

    if (!Bulut.yapilandirildiMi()) return;

    /* ── oturum ── */
    var b2 = bolum('Oturum');
    var durumEl = e('div', { class: 'kucuk-yazi', style: 'margin-bottom:10px' }, 'Bağlantı kontrol ediliyor…');
    b2.appendChild(durumEl);
    g.appendChild(b2);

    Bulut.yukle().then(function () {
      setTimeout(cizOturum, 400);
    }).catch(function (h) {
      durumEl.textContent = Bulut.hataMesaji(h);
    });

    function cizOturum() {
      UI.bosalt(b2);
      b2.appendChild(e('b', { style: 'display:block;font-size:16px;font-weight:800;margin-bottom:12px' }, 'Oturum'));
      if (Bulut.kullanici) {
        var son = Atlas.oku('bulut-son', 0);
        b2.appendChild(e('div', { class: 'satir-kart', style: 'margin-bottom:10px' }, [
          e('span', { style: 'font-size:22px' }, Bulut.kullanici.isAnonymous ? '👤' : '✉️'),
          e('span', { style: 'flex:1;min-width:0' }, [
            e('b', { style: 'display:block;font-size:14px' },
              Bulut.kullanici.isAnonymous ? 'Anonim oturum' : Bulut.kullanici.email),
            e('span', 'kucuk-yazi', son ? 'Son senkron: ' + new Date(son).toLocaleString('tr-TR') : 'Henüz senkron yapılmadı')
          ])
        ]));
        b2.appendChild(anahtarDugme('Otomatik senkron', Atlas.Ayar.al().otoSenkron !== false,
          function (v) { Atlas.Ayar.kur({ otoSenkron: v }); },
          'Veri değişince 2,5 saniye sonra sessizce gönderilir'));
        b2.appendChild(e('button', {
          class: 'dg ana tam', style: 'margin-bottom:8px',
          onclick: function () {
            var d = this; d.disabled = true; d.textContent = '⏳ Senkronize ediliyor…';
            Bulut.tamSenkron().then(function () {
              UI.bildir('Senkron tamam — iki taraftaki yeni kayıtlar birleştirildi', 'ok', 4000);
              Uygulama.yonlendir();
            }).catch(function (h) {
              d.disabled = false; d.textContent = '🔄 Şimdi senkronize et';
              UI.bildir(Bulut.hataMesaji(h), 'bad', 5000);
            });
          }
        }, '🔄 Şimdi senkronize et'));
        b2.appendChild(e('button', {
          class: 'dg sade tam',
          onclick: function () { Bulut.cikis().then(function () { Uygulama.yonlendir(); }); }
        }, 'Çıkış yap'));
        return;
      }

      var eposta = e('input', { class: 'alan', type: 'email', placeholder: 'E-posta', style: 'margin-bottom:8px' });
      var sifre = e('input', { class: 'alan', type: 'password', placeholder: 'Şifre (en az 6 karakter)', style: 'margin-bottom:10px' });
      b2.appendChild(eposta); b2.appendChild(sifre);
      b2.appendChild(e('div', { style: 'display:flex;gap:8px;margin-bottom:8px' }, [
        e('button', {
          class: 'dg ana', style: 'flex:1',
          onclick: function () { gir(false); }
        }, 'Giriş yap'),
        e('button', {
          class: 'dg', style: 'flex:1',
          onclick: function () { gir(true); }
        }, 'Kayıt ol')
      ]));
      b2.appendChild(e('button', {
        class: 'dg sade tam',
        onclick: function () {
          Bulut.girisAnonim().then(function () {
            UI.bildir('Anonim oturum açıldı', 'ok'); Uygulama.yonlendir();
          }).catch(function (h) { UI.bildir(Bulut.hataMesaji(h), 'bad', 5000); });
        }
      }, 'E-postasız devam et (anonim)'));
      b2.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin-top:8px' },
        'Anonim oturum bu tarayıcıya bağlıdır; tarayıcı verisini silersen erişimi kaybedersin. ' +
        'Cihaz değiştirecekseniz e-postayla kaydolmak daha güvenli.'));

      function gir(yeni) {
        if (!eposta.value || sifre.value.length < 6) { UI.bildir('E-posta ve en az 6 karakter şifre gerekli', 'bad'); return; }
        Bulut.girisEposta(eposta.value.trim(), sifre.value, yeni).then(function () {
          UI.bildir(yeni ? 'Hesap oluşturuldu' : 'Giriş yapıldı', 'ok');
          return Bulut.tamSenkron();
        }).then(function () { Uygulama.yonlendir(); })
          .catch(function (h) { UI.bildir(Bulut.hataMesaji(h), 'bad', 5000); });
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════
     KULLANIM KILAVUZU
     ═══════════════════════════════════════════════════════════ */
  Ekran.kilavuz = function (g) {
    Uygulama.baslik(g, 'Kullanım kılavuzu', 'Hangi ekran ne işe yarar', '#/menu');

    var bolumler = [
      {
        ikon: '🌅', ad: 'Günlük akış', metin:
          'Uygulamayı açtığında “Bugün” ekranı sana tek bir sonraki adım verir. Sıralama sabit değil: ' +
          'vadesi gelen tekrar varsa o öne geçer, yoksa hata defteri, yoksa yeni modül. ' +
          'Kararsız kaldığın gün “Akıllı tekrar”a bas; ne çalışacağına motor karar versin.'
      },
      {
        ikon: '⌨️', ad: 'Beş çalışma kipi', metin:
          'Çalışma ekranında sağ üstteki dişliden kip değiştirebilirsin. Aynı cümleyi farklı yollarla ' +
          'çalışmak hafızayı güçlendirir: üretim en zoru, tanıma en kolayı. Motor senin hangi beceride ' +
          'zayıf olduğunu takip eder ve akıllı tekrarda o kipi öne çıkarır.'
      },
      {
        ikon: '◈', ad: 'Ustalık şeridi', metin:
          'Her cevaptan sonra beş çubuklu bir şerit görürsün: tanıma, dinleme, hatırlama, üretim, akıcılık. ' +
          'Yüksek tanıma + düşük üretim, klasik “anlıyorum ama konuşamıyorum” tablosudur. ' +
          'Şeridi görmek, hangi beceriye yüklenmen gerektiğini söyler.'
      },
      {
        ikon: '🏋️', ad: 'Hata antrenmanı', metin:
          'Hata defterindeki her madde üç aşamadan geçer: önce kuralı okursun, sonra kelimeleri sıraya ' +
          'dizersin, en sonda ipucusuz kendin yazarsın. Üçünü de geçen madde defterden çıkar. ' +
          'Üretimde yanlış yaparsan madde kuyruğun sonuna gider — aynı anda ısrar etmek işe yaramıyor.'
      },
      {
        ikon: '🔁', ad: 'Aralıklı tekrar', metin:
          'Doğru bildiğin cümlenin tekrar aralığı uzar, yanıldığın sıfırlanır. Aralık 21 günü geçtiğinde ' +
          'o cümleyi “kalıcı” sayıyoruz. Bir günü kaçırmak felaket değil ama iki gün üst üste kaçırırsan ' +
          'ertesi gün yığılmayı görürsün; rapor ekranındaki “tekrar yükü” grafiği bunu önceden gösterir.'
      },
      {
        ikon: '📸', ad: 'Kendi malzemen', metin:
          'Dizide duyduğun cümleyi, kitaptaki paragrafı, işteki e-postayı uygulamaya sokabilirsin: ' +
          '“Fotoğraftan ekle” ile tarayabilir, “PDF oku” ile dosyadan seçebilir, “Kütüphane”de kitap ' +
          'okurken cümlelere dokunabilirsin. Toplanan her cümle aynı SRS motoruna girer.'
      },
      {
        ikon: '🗣️', ad: 'Konuşma', metin:
          'Rol yapma senaryoları İngilizce kalır — Türkçeye çevirmek alıştırmanın kendisini yok eder. ' +
          'Türkçe anlatım istiyorsan “İngilizce Öğretmeni” senaryosunu seç. Mikrofona basıp konuşabilir, ' +
          'anlamadığın cevabın altındaki çeviri düğmesini kullanabilirsin.'
      },
      {
        ikon: '🎙️', ad: 'Telaffuz', metin:
          'Telaffuz kipinde cümleyi sesli okursun, tanınan metin hedefle karşılaştırılır. ' +
          'iPhone’da ses tanıma yoktur; orada gölgeleme paneli açılır: dinle, kendini kaydet, ' +
          'ikisini arka arkaya dinle, kendini puanla. “Akustik artikülasyon” ekranı ise sesini ' +
          'dalga, spektrum ve ünlü haritası olarak gösterir.'
      },
      {
        ikon: '⌨️', ad: 'Kısayollar', metin:
          '1–5 tuşları ana ekranlar arasında geçirir. Cevap alanında Enter kontrol eder. ' +
          'Esc açık pencereyi kapatır. Bunları Ayarlar’dan kapatabilirsin.'
      },
      {
        ikon: '💾', ad: 'Verini kaybetme', metin:
          'Her şey tarayıcında; tarayıcı verisini silmek ilerlemeni de siler. Ayda bir Veri ekranından ' +
          'yedek indir. İki cihaz kullanıyorsan Hesap ekranından kendi Firebase projenle senkron kurabilirsin.'
      }
    ];

    bolumler.forEach(function (b, i) {
      var acik = false;
      var ic = e('p', {
        style: 'display:none;margin:10px 0 0;font-size:14px;line-height:1.75;color:var(--ink-2)'
      }, b.metin);
      g.appendChild(e('div', {
        class: 'kart tikla gir gir-' + Math.min(6, i % 6 + 1), style: 'margin-bottom:8px',
        onclick: function () { acik = !acik; ic.style.display = acik ? 'block' : 'none'; }
      }, [
        e('div', { style: 'display:flex;align-items:center;gap:11px' }, [
          e('span', { style: 'font-size:21px' }, b.ikon),
          e('b', { style: 'flex:1;font-size:15.5px;font-weight:750' }, b.ad),
          e('span', { style: 'color:var(--ink-3)' }, '⌄')
        ]),
        ic
      ]));
    });
  };

  /* ═══════════════════════════════════════════════════════════
     VERİ ve YEDEK
     ═══════════════════════════════════════════════════════════ */
  Ekran.veri = function (g) {
    Uygulama.baslik(g, 'Veri ve yedek', 'Her şey tarayıcında; sunucu yok', '#/ayarlar');

    /* kullanım */
    var boyut = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        boyut += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
    } catch (e2) {}
    var s = Atlas.SRS.sayim();

    var iz = e('div', { class: 'izgara iz-2', style: 'margin-bottom:16px' });
    iz.appendChild(UI.ist(s.toplam, 'SRS kaydı'));
    iz.appendChild(UI.ist(Object.keys(Atlas.Gunluk.hepsi()).length, 'günlük kaydı'));
    iz.appendChild(UI.ist(Atlas.Hata.hepsi().length, 'hata kaydı'));
    iz.appendChild(UI.ist(Math.round(boyut / 1024) + ' KB', 'kullanım'));
    g.appendChild(iz);

    /* yedek */
    var b1 = bolum('Yedek', 'Tüm ilerlemeni tek bir JSON dosyasına indirir. Başka cihazda geri yükleyebilirsin.');
    b1.appendChild(e('button', {
      class: 'dg ana tam', style: 'margin-bottom:8px',
      onclick: function () { Atlas.Yedek.indir(); UI.bildir('Yedek indiriliyor', 'ok'); }
    }, '⬇️ Yedeği indir'));

    var dosya = e('input', { type: 'file', accept: '.json', style: 'display:none' });
    dosya.onchange = function () {
      var f = dosya.files[0]; if (!f) return;
      var okuyucu = new FileReader();
      okuyucu.onload = function () {
        try {
          var obj = JSON.parse(okuyucu.result);
          UI.onay('Yedeği nasıl yükleyeyim? “Birleştir” mevcut ilerlemeni korur ve daha yeni kayıtları alır.',
            function () { yukle(obj, true); },
            { baslik: 'Geri yükleme', tamamMetni: 'Birleştir' });
          /* ikinci seçenek */
          setTimeout(function () {
            var p = UI.q('.pencere');
            if (p) p.appendChild(e('button', {
              class: 'dg kotu tam', style: 'margin-top:8px',
              onclick: function () { UI.pencereKapat(); yukle(obj, false); }
            }, 'Üzerine yaz (mevcut veri silinir)'));
          }, 60);
        } catch (err) { UI.bildir('Dosya okunamadı: ' + err.message, 'bad'); }
      };
      okuyucu.readAsText(f);
      dosya.value = '';
    };
    function yukle(obj, birlestir) {
      try {
        Atlas.Yedek.yukle(obj, birlestir);
        UI.bildir('Yedek yüklendi', 'ok');
        setTimeout(function () { Uygulama.git('#/'); }, 600);
      } catch (err) { UI.bildir(err.message, 'bad', 5000); }
    }
    b1.appendChild(dosya);
    b1.appendChild(e('button', {
      class: 'dg tam', onclick: function () { dosya.click(); }
    }, '⬆️ Yedekten geri yükle'));
    g.appendChild(b1);

    /* eski uygulamadan aktarım */
    var b2 = bolum('Eski Dil Harita verisi', 'Bu tarayıcıda eski uygulamanın kayıtları varsa (srs:, dh-profile-v1, dh-study-tracker-v1) buraya taşınabilir.');
    b2.appendChild(e('button', {
      class: 'dg tam', onclick: function () {
        var r = Atlas.Yedek.eskidenAl();
        if (r.srs || r.seviye || r.gunluk) {
          UI.bildir('Aktarıldı: ' + r.srs + ' SRS kaydı, ' + r.gunluk + ' gün' + (r.seviye ? ', seviye ' + r.seviye : ''), 'ok', 5000);
          setTimeout(function () { Uygulama.yonlendir(); }, 800);
        } else UI.bildir('Eski veri bulunamadı', 'bad');
      }
    }, '🔄 Eski verimi aktar'));
    g.appendChild(b2);

    /* bakım */
    var b3 = bolum('Bakım');
    b3.appendChild(e('button', {
      class: 'dg tam', style: 'margin-bottom:8px',
      onclick: function () {
        var n = Atlas.Gunluk.temizle(400);
        UI.bildir(n ? n + ' eski günlük kaydı silindi' : 'Silinecek eski kayıt yok', 'ok');
      }
    }, '🧹 400 günden eski günlükleri sil'));
    b3.appendChild(e('button', {
      class: 'dg tam', style: 'margin-bottom:8px',
      onclick: function () {
        if ('caches' in window) {
          caches.keys().then(function (k) { return Promise.all(k.map(function (x) { return caches.delete(x); })); })
            .then(function () {
              if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(function (r) {
                r.forEach(function (x) { x.unregister(); });
                UI.bildir('Önbellek temizlendi, sayfa yenileniyor', 'ok');
                setTimeout(function () { location.reload(); }, 900);
              });
            });
        } else location.reload();
      }
    }, '♻️ Önbelleği temizle ve yenile'));
    b3.appendChild(e('button', {
      class: 'dg kotu tam',
      onclick: function () {
        UI.onay('TÜM ilerlemen silinecek: SRS kayıtları, günlükler, hata defteri, kendi cümlelerin. Bu geri alınamaz. Önce yedek almak ister misin?',
          function () { Atlas.Yedek.hepsiniSil(); UI.bildir('Her şey silindi', 'ok'); setTimeout(function () { location.hash = '#/'; location.reload(); }, 700); },
          { baslik: 'Her şeyi sil', tehlike: true, tamamMetni: 'Evet, sil' });
      }
    }, '🗑 Tüm verimi sil'));
    g.appendChild(b3);

    /* dışa aktarım */
    var b4 = bolum('Dışa aktar', 'Çalıştığın cümleleri başka araçlara taşımak için.');
    b4.appendChild(e('button', {
      class: 'dg tam', style: 'margin-bottom:8px',
      onclick: function () {
        var vade = Object.keys(Atlas.SRS.tumu()).filter(function (k) { return k.indexOf('c:') === 0; })
          .map(function (k) { return k.slice(2); });
        if (!vade.length) { UI.bildir('Dışa aktarılacak cümle yok', 'bad'); return; }
        UI.bildir('Hazırlanıyor…', 'bilgi');
        Veri.cumlelerByIds(vade).then(function (liste) {
          var csv = 'en;tr;seviye;modul\n' + liste.map(function (c) {
            return [c.en, c.tr, c.level, c.module].map(function (x) { return String(x || '').replace(/;/g, ','); }).join(';');
          }).join('\n');
          indir(csv, 'atlas-cumleler.csv', 'text/csv');
        });
      }
    }, '📄 Çalıştığım cümleleri CSV olarak indir'));
    b4.appendChild(e('button', {
      class: 'dg tam',
      onclick: function () {
        var h = Atlas.Hata.hepsi();
        if (!h.length) { UI.bildir('Hata defteri boş', 'bad'); return; }
        var csv = 'en;tr;cevabim;kez;konu\n' + h.map(function (x) {
          return [x.en, x.tr, x.cevap, x.kez, x.etiket].map(function (y) { return String(y || '').replace(/;/g, ','); }).join(';');
        }).join('\n');
        indir(csv, 'atlas-hatalar.csv', 'text/csv');
      }
    }, '🧯 Hata defterini CSV olarak indir'));
    g.appendChild(b4);

    function indir(icerik, ad, tip) {
      var b = new Blob(['﻿' + icerik], { type: tip + ';charset=utf-8' });
      var a = e('a', { href: URL.createObjectURL(b), download: ad });
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }
  };
})(window);
