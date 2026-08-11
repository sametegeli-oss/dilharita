/* ═══════════════════════════════════════════════════════════════
   ATLAS · METİN KAYNAKLARI
   Kütüphane (Gutenberg) · OCR (fotoğraftan cümle) · PDF okuma
   Ortak fikir: her ekran sonunda "cümleyi listeme ekle" düğmesi
   çıkar; toplanan cümle aynı SRS motoruna girer. Okumak tek
   başına öğrenme değil; okunanın çalışma döngüsüne girmesi lazım.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  /* dış kütüphaneleri yalnız gerekince indir */
  function betikYukle(url, global_ad) {
    if (global_ad && global[global_ad]) return Promise.resolve(global[global_ad]);
    return new Promise(function (coz, red) {
      var s = document.createElement('script');
      s.src = url; s.async = true;
      s.onload = function () { coz(global_ad ? global[global_ad] : true); };
      s.onerror = function () { red(new Error(url + ' yüklenemedi')); };
      document.head.appendChild(s);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     ORTAK OKUYUCU — metni cümlelere böl, tıklanabilir yap
     ═══════════════════════════════════════════════════════════ */
  function cumlelereBol(metin) {
    return String(metin || '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+(?=[A-Z"“'])/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 8; });
  }

  function okuyucuCiz(kap, metin, secenek) {
    secenek = secenek || {};
    var secili = [];
    UI.bosalt(kap);
    var govde = e('div', 'okuyucu');
    var paragraflar = String(metin).split(/\n\s*\n/).filter(function (p) { return p.trim(); });

    paragraflar.forEach(function (p) {
      var pd = e('p');
      cumlelereBol(p).forEach(function (c) {
        var s = e('span', { class: 'cumle' }, [
          UI.kelimelestir(c, function (w, ev) { ev.stopPropagation(); UI.kelimeBalonu(w, ev); })
        ]);
        s.appendChild(document.createTextNode(' '));
        s.addEventListener('click', function () {
          var i = secili.indexOf(c);
          if (i > -1) { secili.splice(i, 1); s.classList.remove('secili'); }
          else { secili.push(c); s.classList.add('secili'); }
          yenile();
        });
        s.addEventListener('dblclick', function () { Ses.konus(c, { baglam: 'en' }); });
        pd.appendChild(s);
      });
      if (pd.hasChildNodes()) govde.appendChild(pd);
    });
    kap.appendChild(govde);

    var arac = e('div', 'okuyucu-arac');
    var bilgi = e('span', { class: 'kucuk-yazi', style: 'flex:1;align-self:center' });
    var okuDugme = e('button', { class: 'dg kucuk' }, '🔊 Seçilenleri oku');
    var ekleDugme = e('button', { class: 'dg kucuk ana' }, '➕ Listeme ekle');
    arac.appendChild(bilgi); arac.appendChild(okuDugme); arac.appendChild(ekleDugme);
    kap.appendChild(arac);

    okuDugme.onclick = function () {
      if (!secili.length) return;
      var i = 0;
      (function sonraki() {
        if (i >= secili.length) return;
        Ses.konus(secili[i++], { baglam: 'en', bitti: sonraki });
      })();
    };
    ekleDugme.onclick = function () {
      if (!secili.length) { UI.bildir('Önce cümlelere dokunup seç', 'bad'); return; }
      var liste = secili.map(function (c) {
        return { en: c, tr: '', module: secenek.kaynak || 'Okuduklarım' };
      });
      Atlas.Ozel.coklaEkle(liste);
      Veri.indexBellek = null;
      UI.bildir(liste.length + ' cümle “Kendi Cümlelerim” listene eklendi', 'ok', 3500);
      if (AI.anahtarVar()) ceviriDoldur(liste.length);
      secili = [];
      UI.qq('.cumle.secili', kap).forEach(function (x) { x.classList.remove('secili'); });
      yenile();
    };

    function yenile() {
      bilgi.textContent = secili.length ? secili.length + ' cümle seçildi' : 'Cümlelere dokunarak seç · çift dokunuş: dinle';
      okuDugme.disabled = ekleDugme.disabled = !secili.length;
    }
    yenile();

    /* eklenen cümlelerin çevirisini arka planda doldur */
    function ceviriDoldur(adet) {
      var hepsi = Atlas.Ozel.hepsi().slice(0, adet).filter(function (c) { return !c.tr; });
      if (!hepsi.length) return;
      var girdi = hepsi.map(function (c, i) { return (i + 1) + ') ' + c.en; }).join('\n');
      AI.cagir([
        { role: 'system', content: 'Her satırı doğal Türkçeye çevir. Sadece "numara) çeviri" biçiminde satırlar döndür, başka hiçbir şey yazma.' },
        { role: 'user', content: girdi }
      ], { sicaklik: 0.2, uzunluk: 1400 }).then(function (m) {
        var satirlar = m.split('\n');
        var depo = Atlas.Ozel.hepsi();
        satirlar.forEach(function (s) {
          var eslesme = s.match(/^\s*(\d+)\)\s*(.+)$/);
          if (!eslesme) return;
          var c = hepsi[+eslesme[1] - 1];
          if (!c) return;
          var hedef = depo.find(function (x) { return x.id === c.id; });
          if (hedef) hedef.tr = eslesme[2].trim();
        });
        Atlas.yaz('ozel-cumle', depo);
        UI.bildir('Çeviriler dolduruldu', 'ok', 2000);
      }).catch(function () {});
    }
  }

  /* ═══════════════════════════════════════════════════════════
     KÜTÜPHANE — Project Gutenberg
     ═══════════════════════════════════════════════════════════ */
  var ONERILEN = [
    { id: 11339, ad: "Aesop's Fables", yazar: 'Aesop', lvl: 'A2', not: 'Kısa fabllar, basit cümle yapısı' },
    { id: 14838, ad: 'The Tale of Peter Rabbit', yazar: 'Beatrix Potter', lvl: 'A2', not: 'Çok kısa çocuk hikâyesi' },
    { id: 11, ad: "Alice's Adventures in Wonderland", yazar: 'Lewis Carroll', lvl: 'B1', not: 'Diyalog ağırlıklı, hayal gücü yüksek' },
    { id: 55, ad: 'The Wonderful Wizard of Oz', yazar: 'L. Frank Baum', lvl: 'B1', not: 'Net sahneler, tekrar eden yapılar' },
    { id: 113, ad: 'The Secret Garden', yazar: 'F. H. Burnett', lvl: 'B1', not: 'Akıcı roman dili' },
    { id: 120, ad: 'Treasure Island', yazar: 'R. L. Stevenson', lvl: 'B2', not: 'Macera, anlatı paragrafları' },
    { id: 1342, ad: 'Pride and Prejudice', yazar: 'Jane Austen', lvl: 'B2', not: 'Klasik edebi İngilizce' },
    { id: 84, ad: 'Frankenstein', yazar: 'Mary Shelley', lvl: 'C1', not: 'Uzun cümleler, zengin kelime' },
    { id: 2701, ad: 'Moby-Dick', yazar: 'Herman Melville', lvl: 'C1', not: 'Yoğun edebi dil' },
    { id: 1661, ad: 'Sherlock Holmes', yazar: 'A. Conan Doyle', lvl: 'B2', not: 'Diyalog ve betimleme dengeli' }
  ];

  Ekran.kutuphane = function (g, arg) {
    if (arg[0]) { kitapOku(g, arg[0]); return; }

    Uygulama.baslik(g, 'Kütüphane', 'Project Gutenberg · telifsiz kitaplar', '#/menu');

    var arama = e('input', { class: 'alan', placeholder: '🔍 Kitap veya yazar ara…', style: 'margin-bottom:12px' });
    g.appendChild(arama);
    var sonucKap = e('div');
    g.appendChild(sonucKap);

    var son = Atlas.oku('kitap-son', null);
    if (son) {
      g.appendChild(e('div', 'bolum-ad', 'Kaldığın yer'));
      g.appendChild(e('button', {
        class: 'kart tikla parlak', style: 'width:100%;text-align:left;margin-bottom:6px',
        onclick: function () { Uygulama.git('#/kutuphane/' + son.id); }
      }, [
        e('div', { style: 'display:flex;align-items:center;gap:12px' }, [
          e('span', { style: 'font-size:26px' }, '📖'),
          e('span', { style: 'flex:1' }, [
            e('b', { style: 'display:block;font-size:15px' }, son.ad),
            e('span', 'kucuk-yazi', 'Bölüm ' + ((son.bolum || 0) + 1) + ' · devam et')
          ]),
          e('span', { style: 'color:var(--ink-3)' }, '→')
        ])
      ]));
    }

    g.appendChild(e('div', 'bolum-ad', 'Seviyene göre öneriler'));
    var oneriKap = e('div', { style: 'display:grid;gap:8px' });
    g.appendChild(oneriKap);
    var pr = Atlas.Profil.al();
    var sirali = ONERILEN.slice().sort(function (a, b) {
      var d = function (x) { return Math.abs(Atlas.SEVIYELER.indexOf(x.lvl) - Atlas.SEVIYELER.indexOf(pr.seviye || 'A2')); };
      return d(a) - d(b);
    });
    sirali.forEach(function (k, i) { oneriKap.appendChild(kitapSatiri(k, i)); });

    var zaman;
    arama.addEventListener('input', function () {
      clearTimeout(zaman);
      var q = arama.value.trim();
      if (q.length < 3) { UI.bosalt(sonucKap); return; }
      zaman = setTimeout(function () {
        UI.bosalt(sonucKap);
        sonucKap.appendChild(UI.yukleniyor(3));
        fetch('https://gutendex.com/books?languages=en&search=' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (j) {
            UI.bosalt(sonucKap);
            var bulunan = (j.results || []).slice(0, 12);
            if (!bulunan.length) { sonucKap.appendChild(e('p', 'kucuk-yazi', 'Sonuç yok.')); return; }
            sonucKap.appendChild(e('div', 'bolum-ad', 'Arama sonuçları'));
            var l = e('div', { style: 'display:grid;gap:8px' });
            bulunan.forEach(function (b, i) {
              l.appendChild(kitapSatiri({
                id: b.id, ad: b.title,
                yazar: (b.authors[0] || {}).name || '',
                not: (b.subjects || []).slice(0, 2).join(' · ')
              }, i));
            });
            sonucKap.appendChild(l);
          })
          .catch(function () {
            UI.bosalt(sonucKap);
            sonucKap.appendChild(e('p', 'kucuk-yazi', 'Gutendex’e ulaşılamadı. Çevrimdışıysan öneri listesinden devam edebilirsin.'));
          });
      }, 350);
    });

    function kitapSatiri(k, i) {
      return e('button', {
        class: 'satir-kart gir gir-' + Math.min(6, i % 6 + 1),
        style: 'cursor:pointer;text-align:left;width:100%',
        onclick: function () { Uygulama.git('#/kutuphane/' + k.id); }
      }, [
        e('span', { style: 'font-size:21px;width:30px;flex:0 0 30px;text-align:center' }, '📕'),
        e('span', { style: 'flex:1;min-width:0' }, [
          e('b', { style: 'display:block;font-size:14.5px;font-weight:750' }, k.ad),
          e('span', 'kucuk-yazi', [k.yazar, k.not].filter(Boolean).join(' — '))
        ]),
        k.lvl ? e('span', 'et ' + k.lvl, k.lvl) : null
      ]);
    }
  };

  function kitapOku(g, id) {
    g.appendChild(UI.yukleniyor(4));
    var url = 'https://www.gutenberg.org/cache/epub/' + id + '/pg' + id + '.txt';
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error('indirilemedi');
      return r.text();
    }).then(function (metin) {
      UI.bosalt(g);
      /* Gutenberg başlık/lisans bloklarını at */
      var bas = metin.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG/i);
      var son = metin.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
      var govde = metin.slice(bas > -1 ? metin.indexOf('\n', bas) + 1 : 0, son > -1 ? son : undefined);
      var baslik = (metin.match(/Title:\s*(.+)/) || [, 'Kitap'])[1].trim();

      /* bölümlere ayır — bir seferde ~7000 karakter */
      var parcalar = [];
      var paragraflar = govde.split(/\n\s*\n/);
      var suan = '';
      paragraflar.forEach(function (p) {
        suan += p + '\n\n';
        if (suan.length > 7000) { parcalar.push(suan); suan = ''; }
      });
      if (suan.trim()) parcalar.push(suan);

      var kayit = Atlas.oku('kitap-son', {});
      var bolum = (kayit && kayit.id == id) ? (kayit.bolum || 0) : 0;
      ciz();

      function ciz() {
        UI.bosalt(g);
        Atlas.yaz('kitap-son', { id: id, ad: baslik, bolum: bolum });
        var ust = e('div', { style: 'display:flex;align-items:center;gap:10px;margin:8px 0 14px' }, [
          e('button', { class: 'dg yuvarlak sade', onclick: function () { Uygulama.git('#/kutuphane'); } }, '←'),
          e('div', { style: 'flex:1;min-width:0' }, [
            e('b', { style: 'display:block;font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, baslik),
            e('span', 'kucuk-yazi', 'Bölüm ' + (bolum + 1) + ' / ' + parcalar.length)
          ])
        ]);
        g.appendChild(ust);
        g.appendChild(UI.cubuk((bolum + 1) / parcalar.length * 100));

        var okuKap = e('div', { style: 'margin-top:16px' });
        g.appendChild(okuKap);
        okuyucuCiz(okuKap, parcalar[bolum], { kaynak: baslik });

        g.appendChild(e('div', { style: 'display:flex;gap:8px;margin-top:14px' }, [
          e('button', {
            class: 'dg', style: 'flex:1', disabled: bolum === 0 ? 'disabled' : null,
            onclick: function () { bolum--; ciz(); scrollTo({ top: 0 }); }
          }, '← Önceki'),
          e('button', {
            class: 'dg ana', style: 'flex:1', disabled: bolum >= parcalar.length - 1 ? 'disabled' : null,
            onclick: function () { bolum++; ciz(); scrollTo({ top: 0 }); }
          }, 'Sonraki →')
        ]));
      }
    }).catch(function () {
      UI.bosalt(g);
      g.appendChild(UI.bos('📡', 'Kitap indirilemedi',
        'Gutenberg sunucusuna ulaşılamadı. Bağlantını kontrol edip tekrar dene.',
        { ad: 'Kütüphaneye dön', fn: function () { Uygulama.git('#/kutuphane'); } }));
    });
  }

  /* ═══════════════════════════════════════════════════════════
     OCR — fotoğraftan cümle
     Tesseract.js tarayıcıda çalışır, anahtar gerekmez.
     Ayarlarda AI anahtarı varsa çıkan metni AI temizler
     (satır kırıkları, tireli bölünmeler, OCR gürültüsü).
     ═══════════════════════════════════════════════════════════ */
  Ekran.foto = function (g) {
    Uygulama.baslik(g, 'Fotoğraftan ekle', 'Kitap sayfası, tabela, ekran görüntüsü', '#/menu');

    var onizleme = e('div', { style: 'margin-bottom:12px' });
    var durum = e('div', { class: 'kucuk-yazi', style: 'margin-bottom:10px;min-height:20px' });
    var sonuc = e('div');

    var dosya = e('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    var kamera = e('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });

    g.appendChild(e('div', { class: 'kart parlak', style: 'margin-bottom:14px' }, [
      e('p', { class: 'kucuk-yazi', style: 'margin:0 0 12px' },
        'Görseldeki İngilizce metin tarayıcıda okunur — resim hiçbir yere gönderilmez. ' +
        'İlk kullanımda tanıma motoru (~2 MB) indirilir, sonra çevrimdışı da çalışır.'),
      e('div', { style: 'display:flex;gap:8px' }, [
        e('button', { class: 'dg ana', style: 'flex:1', onclick: function () { kamera.click(); } }, '📷 Fotoğraf çek'),
        e('button', { class: 'dg', style: 'flex:1', onclick: function () { dosya.click(); } }, '🖼️ Dosya seç')
      ]),
      dosya, kamera
    ]));
    g.appendChild(onizleme);
    g.appendChild(durum);
    g.appendChild(sonuc);

    dosya.onchange = kamera.onchange = function () {
      var f = this.files[0];
      if (f) isle(f);
      this.value = '';
    };

    function isle(f) {
      UI.bosalt(onizleme); UI.bosalt(sonuc);
      var img = e('img', {
        src: URL.createObjectURL(f),
        style: 'width:100%;max-height:280px;object-fit:contain;border-radius:var(--r-l);border:1px solid var(--line)'
      });
      onizleme.appendChild(img);
      durum.textContent = 'Tanıma motoru yükleniyor…';

      betikYukle('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', 'Tesseract')
        .then(function (T) {
          durum.textContent = 'Metin okunuyor… %0';
          return T.recognize(f, 'eng', {
            logger: function (m) {
              if (m.status === 'recognizing text') {
                durum.textContent = 'Metin okunuyor… %' + Math.round((m.progress || 0) * 100);
              } else if (m.status) durum.textContent = m.status + '…';
            }
          });
        })
        .then(function (r) {
          var metin = (r.data && r.data.text || '').trim();
          durum.textContent = '';
          if (!metin) {
            sonuc.appendChild(UI.bos('🔍', 'Metin bulunamadı',
              'Işık, netlik ve açı önemli. Sayfayı düz tutup tekrar dene.'));
            return;
          }
          metinGoster(metin);
        })
        .catch(function (err) {
          durum.textContent = '';
          sonuc.appendChild(UI.bos('📡', 'Tanıma motoru yüklenemedi',
            'İnternet bağlantısı gerekiyor (ilk kullanımda). ' + (err.message || '')));
        });
    }

    function metinGoster(metin) {
      UI.bosalt(sonuc);
      var alan = e('textarea', { class: 'alan', rows: '8' });
      alan.value = metin;
      sonuc.appendChild(e('div', 'bolum-ad', 'Okunan metin · düzeltebilirsin'));
      sonuc.appendChild(alan);

      var araclar = e('div', { style: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap' });
      if (AI.anahtarVar()) {
        araclar.appendChild(e('button', {
          class: 'dg kucuk', onclick: function () {
            var d = this;
            d.disabled = true; d.textContent = '⏳ Temizleniyor…';
            AI.cagir([
              {
                role: 'system', content: 'OCR ile okunmuş İngilizce metni temizle: satır kırıklarını birleştir, ' +
                  'tireyle bölünmüş kelimeleri düzelt, açık OCR hatalarını (rn→m, 0→O gibi) onar. ' +
                  'İçeriği DEĞİŞTİRME, cümle ekleme. Sadece temizlenmiş metni döndür.'
              },
              { role: 'user', content: alan.value }
            ], { sicaklik: 0.1, uzunluk: 1800 }).then(function (m) {
              alan.value = m; d.textContent = '✓ Temizlendi';
              okuyucuYenile();
            }).catch(function (h) {
              d.disabled = false; d.textContent = '🤖 AI ile temizle';
              UI.bildir(AI.hataMesaji(h), 'bad');
            });
          }
        }, '🤖 AI ile temizle'));
      }
      araclar.appendChild(e('button', {
        class: 'dg kucuk', onclick: okuyucuYenile
      }, '↻ Cümleleri yenile'));
      sonuc.appendChild(araclar);

      var okuKap = e('div', { style: 'margin-top:14px' });
      sonuc.appendChild(okuKap);
      okuyucuYenile();

      function okuyucuYenile() {
        okuyucuCiz(okuKap, alan.value, { kaynak: 'Fotoğraftan' });
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════
     PDF OKUMA
     ═══════════════════════════════════════════════════════════ */
  Ekran.pdf = function (g) {
    Uygulama.baslik(g, 'PDF oku', 'Ders kitabı, makale, not', '#/menu');

    var dosya = e('input', { type: 'file', accept: 'application/pdf', style: 'display:none' });
    var durum = e('div', { class: 'kucuk-yazi', style: 'margin:10px 0;min-height:20px' });
    var sonuc = e('div');

    g.appendChild(e('div', { class: 'kart parlak' }, [
      e('p', { class: 'kucuk-yazi', style: 'margin:0 0 12px' },
        'PDF tarayıcıda açılır, hiçbir yere yüklenmez. Sayfa sayfa okuyup beğendiğin cümleleri ' +
        'listene ekleyebilirsin. Taranmış (görsel) PDF’lerde metin çıkmaz — onlar için “Fotoğraftan ekle” ekranını kullan.'),
      e('button', { class: 'dg ana tam', onclick: function () { dosya.click(); } }, '📄 PDF seç'),
      dosya
    ]));
    g.appendChild(durum);
    g.appendChild(sonuc);

    dosya.onchange = function () {
      var f = this.files[0]; this.value = '';
      if (!f) return;
      UI.bosalt(sonuc);
      durum.textContent = 'PDF motoru yükleniyor…';
      betikYukle('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib')
        .then(function (lib) {
          lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          durum.textContent = 'PDF açılıyor…';
          return f.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf }).promise; });
        })
        .then(function (pdf) {
          durum.textContent = '';
          sayfaGoster(pdf, f.name);
        })
        .catch(function (err) {
          durum.textContent = '';
          sonuc.appendChild(UI.bos('📡', 'PDF açılamadı',
            'PDF.js yüklenemedi ya da dosya okunamadı. ' + (err.message || '')));
        });
    };

    function sayfaGoster(pdf, ad) {
      var sayfa = 1;
      ciz();
      function ciz() {
        UI.bosalt(sonuc);
        sonuc.appendChild(e('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px' }, [
          e('b', { style: 'flex:1;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, ad),
          e('span', 'et', sayfa + ' / ' + pdf.numPages)
        ]));
        sonuc.appendChild(UI.cubuk(sayfa / pdf.numPages * 100));
        var okuKap = e('div', { style: 'margin-top:14px' });
        okuKap.appendChild(UI.yukleniyor(3));
        sonuc.appendChild(okuKap);

        pdf.getPage(sayfa).then(function (p) { return p.getTextContent(); })
          .then(function (icerik) {
            var metin = icerik.items.map(function (i) { return i.str; }).join(' ')
              .replace(/\s{2,}/g, ' ').trim();
            if (!metin) {
              UI.bosalt(okuKap);
              okuKap.appendChild(e('p', 'kucuk-yazi',
                'Bu sayfada metin katmanı yok — muhtemelen taranmış görüntü. “Fotoğraftan ekle” ekranı bu tür sayfaları okuyabilir.'));
            } else okuyucuCiz(okuKap, metin, { kaynak: ad });
          });

        sonuc.appendChild(e('div', { style: 'display:flex;gap:8px;margin-top:14px' }, [
          e('button', {
            class: 'dg', style: 'flex:1', disabled: sayfa === 1 ? 'disabled' : null,
            onclick: function () { sayfa--; ciz(); scrollTo({ top: 0 }); }
          }, '← Önceki'),
          e('button', {
            class: 'dg ana', style: 'flex:1', disabled: sayfa >= pdf.numPages ? 'disabled' : null,
            onclick: function () { sayfa++; ciz(); scrollTo({ top: 0 }); }
          }, 'Sonraki →')
        ]));
      }
    }
  };

  global.okuyucuCiz = okuyucuCiz;
  global.betikYukle = betikYukle;
})(window);
