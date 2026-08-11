/* ═══════════════════════════════════════════════════════════════
   ATLAS · EKLENTİLER
   Küçük ama vazgeçilmez katmanlar. Her biri kendi kendine kurulur,
   hiçbiri diğerine bağlı değildir.

   1  SesKilidi   iOS'ta ilk dokunuşta sesi açar
   2  GozKirpma   avatarlara doğal göz kırpma
   3  Kurulum     "ana ekrana ekle" istemi
   4  Cikti       PDF / yazdırma çıktısı
   5  Kopru       AI anahtarı olmayanlar için kopyala-yapıştır köprüsü
   6  AIDurum     sağlayıcı durum merkezi
   7  OturumHafiza yarıda kalan oturumu geri yükler
   8  OrtamFon    sohbet ekranına ortam görseli
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  /* ═══ 1 · iOS SES KİLİDİ ═══════════════════════════════════
     iOS Safari, kullanıcı dokunmadan ses çalmaya izin vermez.
     İlk dokunuşta sessiz bir utterance ve bir AudioContext
     başlatıp kilidi açıyoruz. Bu yapılmazsa kullanıcı ilk
     "Dinle"ye bastığında hiçbir şey duymuyor ve uygulama
     bozuk sanılıyor. */
  var SesKilidi = {
    acik: false,
    kur: function () {
      if (SesKilidi.acik) return;
      var ac = function () {
        if (SesKilidi.acik) return;
        SesKilidi.acik = true;
        try {
          if ('speechSynthesis' in global) {
            var u = new SpeechSynthesisUtterance(' ');
            u.volume = 0; u.rate = 10;
            speechSynthesis.speak(u);
          }
        } catch (x) {}
        try {
          var C = global.AudioContext || global.webkitAudioContext;
          if (C) {
            var ctx = new C();
            var o = ctx.createOscillator(), gn = ctx.createGain();
            gn.gain.value = 0;
            o.connect(gn); gn.connect(ctx.destination);
            o.start(0); o.stop(ctx.currentTime + 0.01);
            if (ctx.state === 'suspended') ctx.resume();
            setTimeout(function () { try { ctx.close(); } catch (y) {} }, 400);
          }
        } catch (x) {}
        ['touchstart', 'touchend', 'click', 'keydown'].forEach(function (t) {
          document.removeEventListener(t, ac, true);
        });
      };
      ['touchstart', 'touchend', 'click', 'keydown'].forEach(function (t) {
        document.addEventListener(t, ac, true);
      });
    }
  };

  /* ═══ 2 · GÖZ KIRPMA ═══════════════════════════════════════
     Avatar konuşmadığında düzenli aralıklarla göz kırpar.
     Konuşurken ağız kareleri devrede olduğu için karışmaz. */
  var GozKirpma = {
    bagla: function (avatar) {
      if (!avatar || avatar.__kirpma) return avatar;
      avatar.__kirpma = true;
      var zaman = null;
      function plan() {
        var gecikme = 2600 + Math.random() * 4200;
        zaman = setTimeout(function () {
          if (!document.body.contains(avatar)) { clearTimeout(zaman); return; }
          if (!avatar.classList.contains('konusuyor')) {
            avatar.agiz('goz');
            setTimeout(function () { avatar.agiz('idle'); }, 130);
            /* çift kırpma bazen */
            if (Math.random() < 0.25) {
              setTimeout(function () { avatar.agiz('goz'); }, 260);
              setTimeout(function () { avatar.agiz('idle'); }, 380);
            }
          }
          plan();
        }, gecikme);
      }
      plan();
      if (global.Uygulama) Uygulama.temizlemeEkle(function () { clearTimeout(zaman); });
      return avatar;
    },
    kur: function () {
      if (!global.UI || !UI.avatar || UI.avatar.__sarmali) return;
      var eski = UI.avatar;
      var yeni = function (boy) { return GozKirpma.bagla(eski(boy)); };
      yeni.__sarmali = true;
      UI.avatar = yeni;
    }
  };

  /* ═══ 3 · ANA EKRANA EKLE ══════════════════════════════════ */
  var Kurulum = {
    olay: null,
    kur: function () {
      addEventListener('beforeinstallprompt', function (ev) {
        ev.preventDefault();
        Kurulum.olay = ev;
        if (Atlas.oku('kurulum-reddedildi', false)) return;
        setTimeout(Kurulum.goster, 25000);
      });
      addEventListener('appinstalled', function () {
        Kurulum.olay = null;
        UI.bildir('Uygulama ana ekranına eklendi', 'ok');
      });
    },
    destekleniyorMu: function () {
      return !!Kurulum.olay || (/iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone);
    },
    goster: function () {
      if (global.matchMedia && matchMedia('(display-mode: standalone)').matches) return;
      if (navigator.standalone) return;

      /* iOS'ta beforeinstallprompt yok — elle anlatmak gerekiyor */
      if (!Kurulum.olay) {
        if (!/iphone|ipad|ipod/i.test(navigator.userAgent)) return;
        UI.pencere(e('div', null, [
          e('p', { class: 'altbaslik' },
            'Safari’de alttaki paylaş düğmesine bas, sonra “Ana Ekrana Ekle” seçeneğini seç. ' +
            'Uygulama tam ekran açılır, çevrimdışı çalışır ve bildirimler daha güvenilir olur.'),
          e('div', { style: 'display:flex;gap:10px;align-items:center;justify-content:center;font-size:26px;margin:16px 0' },
            [e('span', null, '􀈂'), e('span', { style: 'font-size:16px;color:var(--ink-3)' }, '→'), e('span', null, '➕')]),
          e('button', {
            class: 'dg sade tam', onclick: function () {
              Atlas.yaz('kurulum-reddedildi', true); UI.pencereKapat();
            }
          }, 'Bir daha sorma')
        ]), { baslik: '📲 Ana ekrana ekle' });
        return;
      }

      UI.pencere(e('div', null, [
        e('p', { class: 'altbaslik' },
          'Uygulamayı ana ekranına ekleyebilirsin: tam ekran açılır, çevrimdışı çalışır, ' +
          'tarayıcı sekmesi arasında kaybolmaz.'),
        e('button', {
          class: 'dg ana tam', style: 'margin-bottom:8px',
          onclick: function () {
            UI.pencereKapat();
            Kurulum.olay.prompt();
            Kurulum.olay.userChoice.then(function () { Kurulum.olay = null; });
          }
        }, '📲 Ana ekrana ekle'),
        e('button', {
          class: 'dg sade tam', onclick: function () {
            Atlas.yaz('kurulum-reddedildi', true); UI.pencereKapat();
          }
        }, 'Bir daha sorma')
      ]), { baslik: 'Uygulamayı yükle' });
    }
  };

  /* ═══ 4 · ÇIKTI (PDF / yazdırma) ═══════════════════════════ */
  var Cikti = {
    /* verilen cümlelerden yazdırılabilir çalışma kâğıdı üretir */
    calismaKagidi: function (liste, baslik, secenek) {
      secenek = secenek || {};
      var w = global.open('', '_blank');
      if (!w) { UI.bildir('Açılır pencere engellendi', 'bad'); return; }
      var satirlar = liste.map(function (c, i) {
        return '<tr><td class="n">' + (i + 1) + '</td>' +
          '<td class="tr">' + kacir(c.tr || '') + '</td>' +
          '<td class="en">' + (secenek.cevapsiz ? '<span class="bosluk"></span>' : kacir(c.en || '')) + '</td></tr>';
      }).join('');
      var cevapAnahtari = secenek.cevapsiz
        ? '<div class="sayfa-kir"></div><h2>Cevap anahtarı</h2><ol>' +
          liste.map(function (c) { return '<li>' + kacir(c.en) + '</li>'; }).join('') + '</ol>'
        : '';
      w.document.write([
        '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' + kacir(baslik) + '</title>',
        '<style>',
        'body{font-family:Georgia,serif;color:#111;margin:28px;line-height:1.55}',
        'h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:20px 0 8px}',
        '.ust{color:#666;font-size:12px;margin-bottom:18px;border-bottom:1px solid #ddd;padding-bottom:10px}',
        'table{width:100%;border-collapse:collapse;font-size:13px}',
        'td{border-bottom:1px solid #eee;padding:9px 6px;vertical-align:top}',
        '.n{width:26px;color:#999}.tr{width:44%}.en{width:50%}',
        '.bosluk{display:inline-block;width:100%;border-bottom:1px dotted #999;height:15px}',
        '.sayfa-kir{page-break-before:always}',
        'ol{font-size:13px;padding-left:22px}li{margin-bottom:4px}',
        '@media print{body{margin:12mm}}',
        '</style></head><body>',
        '<h1>' + kacir(baslik) + '</h1>',
        '<div class="ust">Dil Harita · Atlas — ' + new Date().toLocaleDateString('tr-TR') +
        ' · ' + liste.length + ' cümle' + (secenek.cevapsiz ? ' · boşluklu çalışma kâğıdı' : '') + '</div>',
        '<table>' + satirlar + '</table>',
        cevapAnahtari,
        '<script>setTimeout(function(){window.print()},500)<\/script>',
        '</body></html>'
      ].join(''));
      w.document.close();
    },
    menu: function (liste, baslik) {
      UI.pencere(e('div', { style: 'display:grid;gap:8px' }, [
        e('button', {
          class: 'dg ana tam', onclick: function () {
            UI.pencereKapat(); Cikti.calismaKagidi(liste, baslik, { cevapsiz: false });
          }
        }, '📄 Cümle listesi (TR + EN)'),
        e('button', {
          class: 'dg tam', onclick: function () {
            UI.pencereKapat(); Cikti.calismaKagidi(liste, baslik, { cevapsiz: true });
          }
        }, '✏️ Boşluklu çalışma kâğıdı + cevap anahtarı'),
        e('p', { class: 'kucuk-yazi', style: 'margin:6px 0 0' },
          'Yazdırma penceresinde hedef olarak “PDF olarak kaydet”i seçersen dosya olarak alırsın.')
      ]), { baslik: 'Çıktı al', alt: baslik, dugmesiz: true });
    }
  };
  function kacir(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ═══ 5 · KOPYALA-YAPIŞTIR KÖPRÜSÜ ═════════════════════════
     AI anahtarı olmayan ya da kotası biten kullanıcı için:
     hazır promptu panoya kopyalar, seçtiği sohbet sitesini açar,
     dönen cevabı yapıştırıp uygulamaya geri sokar. */
  var SAGLAYICI_URL = {
    gemini: 'https://gemini.google.com/app',
    chatgpt: 'https://chatgpt.com/',
    claude: 'https://claude.ai/new'
  };
  var Kopru = {
    ac: function (o) {
      /* o: {prompt, baslik, geri(fn metin)} */
      var alan = e('textarea', { class: 'alan', rows: '6', readonly: 'readonly' });
      alan.value = o.prompt;
      var cevapAlan = e('textarea', { class: 'alan', rows: '5', placeholder: 'Aldığın cevabı buraya yapıştır…' });

      var kap = e('div', null, [
        e('p', { class: 'kucuk-yazi', style: 'margin:0 0 10px' },
          'AI anahtarın yoksa da kullanabilirsin: aşağıdaki metni kopyala, açılan sohbete yapıştır, ' +
          'gelen cevabı buraya geri yapıştır. Uygulama cevabı normal şekilde işler.'),
        alan,
        e('div', { style: 'display:flex;gap:6px;margin:10px 0' }, [
          e('button', {
            class: 'dg kucuk ana', style: 'flex:1',
            onclick: function () {
              kopyala(o.prompt).then(function () { UI.bildir('Kopyalandı', 'ok', 1500); });
            }
          }, '📋 Kopyala'),
          e('button', { class: 'dg kucuk', style: 'flex:1', onclick: function () { git('gemini'); } }, 'Gemini'),
          e('button', { class: 'dg kucuk', style: 'flex:1', onclick: function () { git('chatgpt'); } }, 'ChatGPT'),
          e('button', { class: 'dg kucuk', style: 'flex:1', onclick: function () { git('claude'); } }, 'Claude')
        ]),
        e('div', { class: 'bolum-ad', style: 'margin:12px 0 6px' }, 'Cevabı yapıştır'),
        cevapAlan,
        e('button', {
          class: 'dg ana tam', style: 'margin-top:10px',
          onclick: function () {
            var t = cevapAlan.value.trim();
            if (!t) { cevapAlan.focus(); return; }
            UI.pencereKapat();
            Atlas.yaz('kopru-son', { prompt: o.prompt, cevap: t, t: Date.now() });
            o.geri(t);
          }
        }, 'Uygulamaya aktar')
      ]);
      UI.pencere(kap, { baslik: o.baslik || 'AI köprüsü', dugmesiz: true });

      function git(saglayici) {
        kopyala(o.prompt).then(function () {
          UI.bildir('Kopyalandı — sekme açılıyor, yapıştır', 'ok', 2600);
          global.open(SAGLAYICI_URL[saglayici], '_blank');
        });
      }
    },
    /* AI çağrısı yapılamıyorsa köprüyü öner */
    gerekiyorMu: function () { return !AI.anahtarVar(); }
  };
  function kopyala(metin) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(metin).catch(function () { return eskiKopya(metin); });
    }
    return Promise.resolve(eskiKopya(metin));
  }
  function eskiKopya(metin) {
    try {
      var t = document.createElement('textarea');
      t.value = metin; t.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
      return true;
    } catch (x) { return false; }
  }

  /* ═══ 6 · AI DURUM MERKEZİ ═════════════════════════════════ */
  var AIDurum = {
    son: null,
    kaydet: function (ok, hata) {
      AIDurum.son = { ok: ok, hata: hata, t: Date.now() };
      Atlas.yaz('ai-durum', AIDurum.son);
      Atlas.olay('ai-durum', AIDurum.son);
    },
    al: function () { return AIDurum.son || Atlas.oku('ai-durum', null); },
    rozet: function () {
      var d = AIDurum.al();
      if (!AI.anahtarVar()) return { ad: 'Anahtar yok', renk: 'var(--ink-3)', ikon: '○' };
      if (!d) return { ad: 'Denenmedi', renk: 'var(--ink-3)', ikon: '○' };
      if (d.ok) return { ad: 'Çalışıyor', renk: 'var(--ok)', ikon: '●' };
      return { ad: AI.hataMesaji(d.hata).slice(0, 34), renk: 'var(--bad)', ikon: '●' };
    },
    kur: function () {
      if (!global.AI || AI.cagir.__izlenen) return;
      var eski = AI.cagir;
      var yeni = function () {
        return eski.apply(null, arguments).then(function (r) {
          AIDurum.kaydet(true, null); return r;
        }).catch(function (h) {
          AIDurum.kaydet(false, h); throw h;
        });
      };
      yeni.__izlenen = true;
      AI.cagir = yeni;
    }
  };

  /* ═══ 7 · OTURUM HAFIZASI ══════════════════════════════════
     Yarıda bırakılan çalışma oturumunu hatırlar. Telefonu
     cebe koyup ertesi gün açan kullanıcı kaldığı yerden devam
     eder; bu olmadan her kesinti baştan başlamak demek. */
  var OturumHafiza = {
    kaydet: function (o) {
      Atlas.yaz('oturum-yarim', {
        idler: o.idler, i: o.i, kip: o.kip, kaynak: o.kaynak,
        geriYol: o.geriYol, t: Date.now()
      });
    },
    al: function () {
      var o = Atlas.oku('oturum-yarim', null);
      if (!o) return null;
      if (Date.now() - (o.t || 0) > 3 * 86400000) { OturumHafiza.temizle(); return null; }
      if (!o.idler || o.i >= o.idler.length - 1) return null;
      return o;
    },
    temizle: function () { Atlas.sil('oturum-yarim'); },
    devamKarti: function () {
      var o = OturumHafiza.al();
      if (!o) return null;
      var kalan = o.idler.length - o.i;
      return e('button', {
        class: 'kart tikla parlak', style: 'width:100%;text-align:left;margin-bottom:14px;border-color:rgba(255,200,87,.4)',
        onclick: function () {
          Veri.cumlelerByIds(o.idler.slice(o.i)).then(function (liste) {
            if (!liste.length) { OturumHafiza.temizle(); UI.bildir('Oturum bulunamadı', 'bad'); return; }
            var g = Uygulama.govde;
            UI.bosalt(g);
            oturumBaslat(g, { liste: liste, kip: o.kip, geriYol: o.geriYol || '#/', kaynak: o.kaynak });
          });
        }
      }, [
        e('div', { style: 'display:flex;align-items:center;gap:12px' }, [
          e('span', { style: 'font-size:26px' }, '⏸️'),
          e('span', { style: 'flex:1' }, [
            e('b', { style: 'display:block;font-size:15px' }, 'Yarım kalan oturum'),
            e('span', 'kucuk-yazi', kalan + ' cümle kaldı · ' +
              new Date(o.t).toLocaleDateString('tr-TR'))
          ]),
          e('span', { style: 'color:var(--ink-3)' }, '→')
        ])
      ]);
    }
  };

  /* ═══ 8 · ORTAM FONU ═══════════════════════════════════════
     Sohbet senaryosuna uygun arka plan görseli. Havaalanında
     havaalanı, otelde otel — bağlam görsel olunca kelimeler
     bağlamla birlikte kodlanıyor. */
  var ORTAM_SORGU = {
    havaalani: 'airport check-in counter', otel: 'hotel reception lobby',
    doktor: "doctor's office consultation", restoran: 'restaurant table dining',
    is: 'job interview office meeting', arkadas: 'friends talking cafe',
    alisveris: 'clothing shop interior', ogretmen: 'classroom desk english'
  };
  var OrtamFon = {
    uygula: function (kap, senaryoKod) {
      if (!Gorsel.acik()) return;
      var q = ORTAM_SORGU[senaryoKod];
      if (!q) return;
      Gorsel.bul(q).then(function (g2) {
        if (!g2 || !g2.url) return;
        var fon = e('div', { class: 'ortam-fon' });
        fon.style.backgroundImage = 'url(' + g2.url + ')';
        kap.insertBefore(fon, kap.firstChild);
      }).catch(function () {});
    }
  };

  /* ═══ KURULUM ══════════════════════════════════════════════ */
  global.SesKilidi = SesKilidi;
  global.GozKirpma = GozKirpma;
  global.Kurulum = Kurulum;
  global.Cikti = Cikti;
  global.Kopru = Kopru;
  global.AIDurum = AIDurum;
  global.OturumHafiza = OturumHafiza;
  global.OrtamFon = OrtamFon;

  SesKilidi.kur();
  GozKirpma.kur();
  Kurulum.kur();
  AIDurum.kur();
})(window);
