/* ═══════════════════════════════════════════════════════════════
   ATLAS · ZENGİN KELİME BALONCUĞU
   Her ekranda İngilizce bir kelimeye dokun → tam donanımlı panel.

   İçerik: anlamlar · okunuş · heceleme · seviye · korpus frekansı ·
   eş anlamlılar (GERÇEK kullanım sıklığına göre sıralı) ·
   üç hızda dinleme · telaffuz denemesi · AI açıklaması ·
   geçtiği örnek cümleler · listeye ekleme · çeviri köprüsü

   ── EŞ ANLAMLI SIRALAMASI ────────────────────────────────────
   Liste kelimelerin gerçek kullanım sıklığına göre çoktan aza
   sıralanır. Kaynak önceliği:
     1) Google Books Ngram — CANLI. Google bu uç noktada CORS
        başlığı döndürmediği için tarayıcıdan doğrudan çağrılamaz;
        araya kendi proxy'in girer:
          localStorage["atlas:ngram-proxy"]  ya da  window.ATLAS_NGRAM_PROXY
        Alınan değerler 30 gün önbelleklenir — aynı kelimeye ikinci
        dokunuşta ağa hiç çıkılmaz. Google arka arkaya istekleri
        engellediği için önbellek şart.
     2) data/ngram-yedek.json — proxy yoksa ya da çevrimdışıysan.
        Aynı birimde ama yaklaşık; arayüzde "~" ile işaretlenir.

   Sözlükteki `frekans` alanı ayrıca gösterilir: bu kelimenin BU
   uygulamanın kendi cümle korpusunda kaç kez geçtiği. Genel
   İngilizce sıklığı DEĞİLDİR, o yüzden sıralamada kullanılmaz —
   "yaygın ama ben hiç görmedim" ayrımını göstermek için durur.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  var NG_TTL = 30 * 24 * 3600 * 1000;
  var ngYedek = null;
  var acik = null;

  /* ───── ngram önbelleği ────────────────────────────────────── */
  function ngProxy() {
    return global.ATLAS_NGRAM_PROXY || Atlas.oku('ngram-proxy', '') || '';
  }
  function ngCacheOku() { return Atlas.oku('ngram-cache', {}); }
  function ngCacheYaz(c) {
    /* önbellek şişmesin: en eski kayıtları at */
    var k = Object.keys(c);
    if (k.length > 3000) {
      k.sort(function (a, b) { return (c[a].t || 0) - (c[b].t || 0); });
      k.slice(0, k.length - 3000).forEach(function (x) { delete c[x]; });
    }
    Atlas.yaz('ngram-cache', c);
  }
  function yedekYukle() {
    if (ngYedek) return Promise.resolve(ngYedek);
    return fetch('./data/ngram-yedek.json')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { ngYedek = j; return j; })
      .catch(function () { ngYedek = {}; return ngYedek; });
  }

  /* kelime listesi → {deger:{kelime:sıklık}, kaynak:'canli'|'yedek'|'karma'} */
  function ngramGetir(kelimeler) {
    var cache = ngCacheOku(), simdi = Date.now();
    var sonuc = {}, eksik = [];
    kelimeler.forEach(function (k) {
      var c = cache[k];
      if (c && (simdi - (c.t || 0)) < NG_TTL) { if (typeof c.v === 'number') sonuc[k] = c.v; }
      else eksik.push(k);
    });
    if (!eksik.length) return Promise.resolve({ deger: sonuc, kaynak: 'canli' });

    var proxy = ngProxy();
    if (!proxy || !navigator.onLine) {
      return yedekYukle().then(function (y) {
        eksik.forEach(function (k) { if (typeof y[k] === 'number') sonuc[k] = y[k]; });
        return { deger: sonuc, kaynak: Object.keys(cache).length ? 'karma' : 'yedek' };
      });
    }

    var url = proxy + (proxy.indexOf('?') < 0 ? '?' : '&') + 'content=' +
      encodeURIComponent(eksik.join(',')) +
      '&year_start=2015&year_end=2019&corpus=en-2019&smoothing=3';
    return fetch(url).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (arr) {
        if (!Array.isArray(arr)) throw 0;
        var yeni = ngCacheOku();
        arr.forEach(function (it) {
          var ad = String((it && it.ngram) || '').replace(/_[A-Z]+$/, '').toLowerCase();
          var ts = it && it.timeseries;
          if (!ad || !Array.isArray(ts) || !ts.length) return;
          var v = Number(ts[ts.length - 1]) || 0;
          sonuc[ad] = v; yeni[ad] = { v: v, t: simdi };
        });
        ngCacheYaz(yeni);
        return { deger: sonuc, kaynak: 'canli' };
      })
      .catch(function () {
        return yedekYukle().then(function (y) {
          eksik.forEach(function (k) { if (typeof y[k] === 'number') sonuc[k] = y[k]; });
          return { deger: sonuc, kaynak: 'yedek' };
        });
      });
  }

  /* ───── heceleme ───────────────────────────────────────────── */
  function heceler(kelime) {
    var w = String(kelime || '').toLowerCase();
    if (w.length <= 3) return w;
    var parca = [], i = 0;
    var unlu = function (c) { return 'aeiouy'.indexOf(c) >= 0; };
    while (i < w.length) {
      var seg = w[i]; i++;
      while (i < w.length && !unlu(w[i]) && !unlu(seg[seg.length - 1])) { seg += w[i]; i++; }
      while (i < w.length && unlu(w[i])) { seg += w[i]; i++; }
      parca.push(seg);
    }
    var birlesik = [];
    parca.forEach(function (p) {
      if (!/[aeiouy]/.test(p) && birlesik.length) birlesik[birlesik.length - 1] += p;
      else birlesik.push(p);
    });
    return birlesik.join(' · ') || w;
  }

  /* ───── AI açıklaması + IndexedDB önbellek ─────────────────── */
  var DB = 'atlas-kelime', DEPO = 'kv';
  function dbAc() {
    return new Promise(function (coz) {
      if (!global.indexedDB) return coz(null);
      var r; try { r = indexedDB.open(DB, 1); } catch (x) { return coz(null); }
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains(DEPO)) d.createObjectStore(DEPO);
      };
      r.onsuccess = function () { coz(r.result); };
      r.onerror = function () { coz(null); };
    });
  }
  function kaGet(k) {
    return dbAc().then(function (d) {
      if (!d) return null;
      return new Promise(function (coz) {
        try {
          var t = d.transaction(DEPO, 'readonly').objectStore(DEPO).get(k);
          t.onsuccess = function () { d.close(); coz(t.result || null); };
          t.onerror = function () { d.close(); coz(null); };
        } catch (x) { try { d.close(); } catch (y) {} coz(null); }
      });
    });
  }
  function kaPut(k, v) {
    return dbAc().then(function (d) {
      if (!d) return;
      try {
        var t = d.transaction(DEPO, 'readwrite');
        t.objectStore(DEPO).put(v, k);
        t.oncomplete = function () { d.close(); };
        t.onerror = function () { d.close(); };
      } catch (x) { try { d.close(); } catch (y) {} }
    });
  }

  /* ───── çeviri köprüsü ─────────────────────────────────────── */
  function panoyaYaz(metin) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(metin).catch(function () { return eskiKopya(metin); });
    }
    return Promise.resolve(eskiKopya(metin));
  }
  function eskiKopya(metin) {
    try {
      var t = document.createElement('textarea');
      t.value = metin;
      t.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(t); t.select();
      document.execCommand('copy'); t.remove();
      return true;
    } catch (x) { return false; }
  }

  /* ═══════════════════════════════════════════════════════════
     BALONCUK
     ═══════════════════════════════════════════════════════════ */
  function ac(kelime, ev) {
    kapat();
    var b = e('div', { id: 'balon-kelime' });
    b.appendChild(e('div', { class: 'iskelet', style: 'height:96px' }));
    document.body.appendChild(b);
    acik = b;
    yerlestir(b, ev);
    setTimeout(function () { document.addEventListener('click', disari); }, 40);

    Promise.all([
      Veri.kelimeBilgi(kelime),
      Veri.kelimeOrnekleri(kelime, 4),
      Veri.esanlam().catch(function () { return {}; })
    ]).then(function (r) {
      ciz(b, kelime, r[0], r[1], r[2], ev);
    }).catch(function () {
      UI.bosalt(b);
      b.appendChild(e('p', 'kucuk-yazi', 'Kelime bilgisi yüklenemedi.'));
    });

    function disari(ev2) {
      if (acik && !acik.contains(ev2.target)) kapat();
      else setTimeout(function () { document.addEventListener('click', disari, { once: true }); }, 0);
    }
  }

  function ciz(b, sorgu, bilgi, ornekler, esanlam, ev) {
    UI.bosalt(b);
    var w = bilgi ? bilgi.kelime : sorgu;
    var oge = 'k:' + w;

    /* ── başlık ── */
    b.appendChild(e('div', { style: 'display:flex;align-items:flex-start;gap:8px;margin-bottom:6px' }, [
      e('div', { style: 'flex:1;min-width:0' }, [
        e('b', { style: 'font-size:21px;letter-spacing:-.02em;display:block;line-height:1.2' }, w),
        e('div', { class: 'okunus', style: 'margin-top:2px' }, heceler(w))
      ]),
      bilgi && bilgi.seviye ? e('span', 'et ' + bilgi.seviye, bilgi.seviye) : null,
      e('button', { class: 'dg kucuk sade', title: 'Kapat', onclick: kapat }, '✕')
    ]));

    if (bilgi && bilgi.oku) {
      b.appendChild(e('div', { class: 'ipa', style: 'margin-bottom:8px' }, bilgi.oku));
    }
    if (bilgi && bilgi.kokBulundu) {
      b.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-bottom:6px' },
        '“' + bilgi.kokBulundu + '” → kök: ' + w));
    }

    /* ── üç hızda dinleme + telaffuz denemesi ── */
    var sesSatir = e('div', { style: 'display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap' });
    [['🔊 Dinle', 0.95], ['🐢 Yavaş', 0.55], ['🐇 Hızlı', 1.25]].forEach(function (o) {
      sesSatir.appendChild(e('button', {
        class: 'dg kucuk', style: 'flex:1;min-width:74px',
        onclick: function () { Ses.konus(w, { baglam: 'en', hiz: o[1] }); }
      }, o[0]));
    });
    b.appendChild(sesSatir);

    var telaffuzKap = e('div', { style: 'margin-bottom:10px' });
    b.appendChild(telaffuzKap);
    if (Ses.destek().stt) {
      var telDugme = e('button', { class: 'dg kucuk tam' }, '🎙️ Telaffuzunu dene');
      telaffuzKap.appendChild(telDugme);
      telDugme.onclick = function () {
        telDugme.disabled = true; telDugme.textContent = '🎙️ Dinliyorum…';
        Ses.dinle({ dil: 'en' }).then(function (metin) {
          telDugme.disabled = false; telDugme.textContent = '🎙️ Telaffuzunu dene';
          if (!metin) { UI.bildir('Ses alınamadı', 'bad'); return; }
          var skor = Atlas.benzerlik(w, metin);
          var ok = skor >= 75;
          Mastery.kaydet(oge, 'akicilik', ok, { kaynak: 'baloncuk' });
          Atlas.SRS.kaydet('k', w, !ok, skor);
          UI.bosalt(telaffuzKap);
          telaffuzKap.appendChild(e('div', {
            class: 'kart', style: 'padding:10px 12px;border-color:' + (ok ? 'rgba(52,226,160,.45)' : 'rgba(255,95,126,.45)')
          }, [
            e('div', { style: 'display:flex;align-items:center;gap:10px' }, [
              e('b', { style: 'font-size:22px;color:' + (ok ? 'var(--ok)' : 'var(--bad)') }, '%' + skor),
              e('div', { style: 'flex:1' }, [
                e('div', { style: 'font-size:13px;font-weight:650' }, ok ? 'Tuttu' : 'Duyduğum: “' + metin + '”'),
                e('div', 'kucuk-yazi', ok ? 'Kayıt tekrar listene işlendi' : 'Yavaş düğmesiyle dinleyip yeniden dene')
              ])
            ])
          ]));
        }).catch(function () {
          telDugme.disabled = false; telDugme.textContent = '🎙️ Telaffuzunu dene';
          UI.bildir('Tanıma çalışmadı', 'bad');
        });
      };
    }

    /* ── anlamlar ── */
    if (!bilgi) {
      b.appendChild(e('p', 'kucuk-yazi', 'Sözlükte bulunamadı. Cümledeki kullanımına bakabilirsin.'));
    } else {
      var anlamKap = e('div', { style: 'margin-bottom:8px' });
      (bilgi.anlamlar || []).slice(0, 5).forEach(function (a) {
        anlamKap.appendChild(e('div', { style: 'font-size:14.5px;line-height:1.65;color:var(--ink-2)' }, '· ' + a));
      });
      b.appendChild(anlamKap);
      if (bilgi.frekans) {
        b.appendChild(e('div', {
          class: 'kucuk-yazi', style: 'margin-bottom:8px',
          title: 'Bu kelimenin bu uygulamanın cümle korpusunda kaç kez geçtiği. Genel İngilizce sıklığı değildir.'
        }, 'Bu uygulamanın cümlelerinde ' + bilgi.frekans + ' kez geçiyor'));
      }
    }

    /* ── eş anlamlılar (sıklığa göre) ── */
    var es = (esanlam && esanlam[w]) || [];
    if (es.length) {
      var esKap = e('div', { style: 'margin-bottom:10px' });
      esKap.appendChild(e('div', { class: 'bolum-ad', style: 'margin:8px 0 6px;font-size:10.5px' }, 'Eş anlamlılar'));
      var yukleniyor = e('div', { class: 'kucuk-yazi' }, 'Kullanım sıklığına göre sıralanıyor…');
      esKap.appendChild(yukleniyor);
      b.appendChild(esKap);

      ngramGetir([w].concat(es)).then(function (ng) {
        yukleniyor.remove();
        var sirali = es.slice().sort(function (a, c) {
          return (ng.deger[c] || 0) - (ng.deger[a] || 0);
        });
        var mx = Math.max.apply(null, sirali.map(function (x) { return ng.deger[x] || 0; }).concat([ng.deger[w] || 0, 1e-9]));
        var isaret = ng.kaynak === 'canli' ? '' : '~';
        sirali.forEach(function (x) {
          var v = ng.deger[x] || 0;
          esKap.appendChild(e('div', {
            style: 'display:flex;align-items:center;gap:8px;margin-bottom:5px;cursor:pointer',
            onclick: function () { ac(x, { clientX: innerWidth / 2, clientY: 120 }); }
          }, [
            e('span', { style: 'font-size:13.5px;font-weight:650;min-width:88px' }, x),
            e('div', { style: 'flex:1' }, [UI.cubuk(v / mx * 100)]),
            e('span', { class: 'kucuk-yazi', style: 'min-width:56px;text-align:right' },
              v ? isaret + (v * 1e6).toFixed(1) : '—')
          ]));
        });
        esKap.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-top:6px' },
          ng.kaynak === 'canli'
            ? 'Kaynak: Google Books Ngram (canlı, 30 gün önbellekli)'
            : 'Kaynak: yerel yedek tablo (~ yaklaşık). Canlı veri için ayarlardan Ngram proxy tanımlayabilirsin.'));
      });
    }

    /* ── AI kelime açıklaması ── */
    var aiKap = e('div', { style: 'margin-bottom:10px' });
    b.appendChild(aiKap);
    kaGet('ai:' + w).then(function (onbellek) {
      if (onbellek && onbellek.metin) { aiCiz(onbellek.metin, true); return; }
      if (!AI.anahtarVar()) return;
      var d = e('button', { class: 'dg kucuk tam' }, '🤖 Bu kelimeyi açıkla');
      aiKap.appendChild(d);
      d.onclick = function () {
        d.disabled = true; d.textContent = '⏳ Açıklanıyor…';
        AI.cagir([
          {
            role: 'system', content: [
              'Bir İngilizce kelimeyi Türk öğrenciye açıkla. En fazla 6 satır.',
              'Sırayla: 1) temel anlam, 2) hangi bağlamda kullanılır, 3) yakın kelimelerden farkı,',
              '4) bir örnek cümle [[böyle işaretle]] ve altında Türkçesi.',
              'Sadece Türkçe ve İngilizce kullan, üçüncü dilden tek kelime bile yazma.'
            ].join(' ')
          },
          { role: 'user', content: w }
        ], { sicaklik: 0.4, uzunluk: 500 }).then(function (m) {
          kaPut('ai:' + w, { metin: m, t: Date.now() });
          aiCiz(m, false);
        }).catch(function (h) {
          d.disabled = false; d.textContent = '🤖 Bu kelimeyi açıkla';
          UI.bildir(AI.hataMesaji(h), 'bad');
        });
      };
    });

    function aiCiz(metin, onbellekten) {
      UI.bosalt(aiKap);
      var kart = e('div', { class: 'kart', style: 'padding:11px 13px' });
      kart.appendChild(e('div', {
        class: 'bolum-ad', style: 'margin:0 0 6px;font-size:10.5px'
      }, '🤖 Açıklama' + (onbellekten ? ' · önbellekten' : '')));
      var g = AI.balonMetni(metin);
      g.style.cssText = 'font-size:13.5px;line-height:1.7;color:var(--ink-2);white-space:pre-wrap';
      kart.appendChild(g);
      kart.appendChild(e('button', {
        class: 'dg kucuk', style: 'margin-top:8px',
        onclick: function () { Ses.konus(metin, { baglam: 'tr' }); }
      }, '🔊 Sesli oku'));
      aiKap.appendChild(kart);
    }

    /* ── geçtiği cümleler ── */
    if (ornekler.length) {
      b.appendChild(e('div', { class: 'bolum-ad', style: 'margin:10px 0 6px;font-size:10.5px' }, 'Geçtiği cümleler'));
      ornekler.forEach(function (o) {
        b.appendChild(e('div', {
          style: 'padding:8px 10px;border-radius:12px;background:var(--glass);margin-bottom:5px;cursor:pointer',
          onclick: function () { Ses.konus(o.en, { baglam: 'en' }); }
        }, [
          e('div', { style: 'font-size:13.5px;font-weight:650' }, vurgula(o.en, w)),
          e('div', 'kucuk-yazi', o.tr)
        ]));
      });
    }

    /* ── alt araçlar ── */
    var l = Atlas.oku('kelime-liste', []);
    var listede = l.indexOf(w) > -1;
    b.appendChild(e('div', { style: 'display:flex;gap:6px;margin-top:12px;flex-wrap:wrap' }, [
      e('button', {
        class: 'dg kucuk ' + (listede ? 'iyi' : 'ana'), style: 'flex:1;min-width:120px',
        onclick: function () {
          var liste = Atlas.oku('kelime-liste', []);
          if (liste.indexOf(w) < 0) {
            liste.push(w); Atlas.yaz('kelime-liste', liste);
            Atlas.SRS.kaydet('k', w, false, 60);
            UI.bildir('“' + w + '” tekrar listene eklendi', 'ok');
          } else UI.bildir('Zaten listende', 'bilgi', 1600);
          kapat();
        }
      }, listede ? '✓ Listende' : '➕ Listeme ekle'),
      e('button', {
        class: 'dg kucuk', title: 'Panoya kopyala ve çeviriyi aç',
        onclick: function () {
          panoyaYaz(w).then(function () {
            UI.bildir('Kopyalandı — çeviri sekmesi açılıyor', 'ok', 2000);
            global.open('https://translate.google.com/?sl=en&tl=tr&op=translate&text=' + encodeURIComponent(w), '_blank');
          });
        }
      }, '🌐'),
      e('button', {
        class: 'dg kucuk', title: 'Bu kelimeyi videoda duy',
        onclick: function () { kapat(); Uygulama.git('#/video/' + encodeURIComponent(w)); }
      }, '📺')
    ]));

    /* ustalık şeridi */
    if (Mastery.al(oge).genel > 0) {
      b.appendChild(UI.masteryCubuk(oge, { sade: true, stil: 'margin-top:10px;padding:10px' }));
    }

    yerlestir(b, ev);
  }

  function vurgula(cumle, kelime) {
    var kap = e('span');
    var re = new RegExp('(' + kelime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    String(cumle).split(re).forEach(function (p) {
      if (p.toLowerCase() === kelime.toLowerCase()) {
        kap.appendChild(e('mark', { style: 'background:rgba(255,200,87,.28);color:inherit;border-radius:4px;padding:0 2px' }, p));
      } else kap.appendChild(document.createTextNode(p));
    });
    return kap;
  }

  function yerlestir(b, ev) {
    var g = b.getBoundingClientRect();
    var x = ((ev && ev.clientX) || innerWidth / 2) - g.width / 2;
    var y = ((ev && ev.clientY) || innerHeight / 2) + 18;
    x = Math.max(10, Math.min(innerWidth - g.width - 10, x));
    if (y + g.height > innerHeight - 10) {
      y = Math.max(10, ((ev && ev.clientY) || 100) - g.height - 14);
    }
    if (g.height > innerHeight - 24) { y = 12; b.style.maxHeight = (innerHeight - 32) + 'px'; b.style.overflowY = 'auto'; }
    b.style.left = x + 'px'; b.style.top = y + 'px';
  }

  function kapat() { if (acik) { acik.remove(); acik = null; } }

  /* UI'daki basit sürümün yerine geç */
  UI.kelimeBalonu = ac;
  UI.balonKapat = kapat;

  global.KelimeBalonu = { ac: ac, kapat: kapat, heceler: heceler, ngramGetir: ngramGetir };
})(window);
