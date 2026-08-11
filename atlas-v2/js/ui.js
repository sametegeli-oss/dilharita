/* ═══════════════════════════════════════════════════════════════
   ATLAS · ARAYÜZ KİTAPLIĞI
   Küçük, bağımlılıksız bileşenler. Hepsi DOM düğümü döndürür.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ───── DOM ────────────────────────────────────────────────── */
  function e(etiket, ozellik, cocuklar) {
    var d = document.createElement(etiket);
    if (typeof ozellik === 'string') d.className = ozellik;
    else if (ozellik) {
      for (var k in ozellik) {
        var v = ozellik[k];
        if (k === 'class') d.className = v;
        else if (k === 'html') d.innerHTML = v;
        else if (k === 'text') d.textContent = v;
        else if (k === 'style') d.setAttribute('style', v);
        else if (k.indexOf('on') === 0 && typeof v === 'function') d.addEventListener(k.slice(2), v);
        else if (k === 'data') { for (var dk in v) d.dataset[dk] = v[dk]; }
        else if (v !== null && v !== undefined && v !== false) d.setAttribute(k, v);
      }
    }
    if (cocuklar != null) {
      (Array.isArray(cocuklar) ? cocuklar : [cocuklar]).forEach(function (c) {
        if (c == null || c === false) return;
        d.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return d;
  }
  function q(s, k) { return (k || document).querySelector(s); }
  function qq(s, k) { return Array.prototype.slice.call((k || document).querySelectorAll(s)); }
  function bosalt(d) { while (d && d.firstChild) d.removeChild(d.firstChild); return d; }
  function kacis(s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }

  /* ───── bildirim ───────────────────────────────────────────── */
  function bildir(metin, tip, sure) {
    var t = q('#tepsi'); if (!t) return;
    var ikon = tip === 'ok' ? '✅' : tip === 'bad' ? '⚠️' : tip === 'bilgi' ? 'ℹ️' : '💬';
    var d = e('div', 'bildirim ' + (tip || ''), [e('span', { style: 'font-size:17px' }, ikon), e('span', null, metin)]);
    t.appendChild(d);
    setTimeout(function () {
      d.classList.add('giden');
      setTimeout(function () { d.remove(); }, 320);
    }, sure || 3200);
    return d;
  }

  /* ───── pencere ────────────────────────────────────────────── */
  function pencere(icerik, secenek) {
    secenek = secenek || {};
    var perde = q('#perde');
    bosalt(perde);
    var p = e('div', 'pencere');
    if (secenek.baslik) p.appendChild(e('h3', { style: 'margin:0 0 4px;font-size:21px;font-weight:800;letter-spacing:-.02em' }, secenek.baslik));
    if (secenek.alt) p.appendChild(e('p', { class: 'altbaslik', style: 'margin-bottom:14px' }, secenek.alt));
    p.appendChild(icerik);
    if (!secenek.dugmesiz) {
      p.appendChild(e('div', { style: 'display:flex;gap:8px;margin-top:18px' }, [
        e('button', { class: 'dg sade tam', onclick: kapat }, secenek.kapatMetni || 'Kapat')
      ]));
    }
    perde.appendChild(p);
    perde.classList.add('acik');
    perde.onclick = function (ev) { if (ev.target === perde && !secenek.zorunlu) kapat(); };
    return { govde: p, kapat: kapat };
    function kapat() { perde.classList.remove('acik'); bosalt(perde); }
  }
  function pencereKapat() { var p = q('#perde'); if (p) { p.classList.remove('acik'); bosalt(p); } }

  function onay(soru, tamam, secenek) {
    secenek = secenek || {};
    var g = e('div');
    g.appendChild(e('p', { class: 'altbaslik', style: 'margin-bottom:16px' }, soru));
    var sat = e('div', { style: 'display:flex;gap:8px' });
    sat.appendChild(e('button', { class: 'dg sade', style: 'flex:1', onclick: pencereKapat }, 'Vazgeç'));
    sat.appendChild(e('button', {
      class: 'dg ' + (secenek.tehlike ? 'kotu' : 'ana'), style: 'flex:1',
      onclick: function () { pencereKapat(); tamam(); }
    }, secenek.tamamMetni || 'Evet'));
    g.appendChild(sat);
    return pencere(g, { baslik: secenek.baslik || 'Emin misin?', dugmesiz: true });
  }

  /* ───── halka gösterge ─────────────────────────────────────── */
  function halka(oran, secenek) {
    secenek = secenek || {};
    var boy = secenek.boy || 108, kalinlik = secenek.kalinlik || 9;
    var r = (boy - kalinlik) / 2, cevre = 2 * Math.PI * r;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', boy); svg.setAttribute('height', boy);
    var g1 = document.createElementNS(ns, 'defs');
    var gid = 'g' + Math.random().toString(36).slice(2, 7);
    /* NOT: stop-color bir sunum niteliği; var() orada çalışmaz.
       CSS özelliği olarak style içinde yazınca değişken çözülür. */
    g1.innerHTML = '<linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" style="stop-color:' + (secenek.renk1 || 'var(--brand)') + '"/>' +
      '<stop offset="100%" style="stop-color:' + (secenek.renk2 || 'var(--brand-2)') + '"/></linearGradient>';
    svg.appendChild(g1);
    var iz = document.createElementNS(ns, 'circle');
    iz.setAttribute('class', 'iz-cizgi');
    iz.setAttribute('cx', boy / 2); iz.setAttribute('cy', boy / 2); iz.setAttribute('r', r);
    iz.setAttribute('stroke-width', kalinlik);
    svg.appendChild(iz);
    var dl = document.createElementNS(ns, 'circle');
    dl.setAttribute('class', 'dolgu');
    dl.setAttribute('cx', boy / 2); dl.setAttribute('cy', boy / 2); dl.setAttribute('r', r);
    dl.setAttribute('stroke-width', kalinlik);
    dl.setAttribute('stroke', 'url(#' + gid + ')');
    dl.setAttribute('stroke-dasharray', cevre);
    dl.setAttribute('stroke-dashoffset', cevre);
    svg.appendChild(dl);
    var kap = e('div', 'halka', [svg]);
    if (secenek.sayi !== undefined || secenek.etiket) {
      kap.appendChild(e('div', 'orta', [
        e('b', null, secenek.sayi !== undefined ? secenek.sayi : Math.round(oran) + '%'),
        secenek.etiket ? e('span', null, secenek.etiket) : null
      ]));
    }
    requestAnimationFrame(function () {
      setTimeout(function () {
        dl.setAttribute('stroke-dashoffset', cevre * (1 - Math.max(0, Math.min(1, oran / 100))));
      }, 60);
    });
    return kap;
  }

  /* ───── çubuk ──────────────────────────────────────────────── */
  function cubuk(oran, renk) {
    var i = e('i');
    var c = e('div', 'cubuk', [i]);
    if (renk) i.style.background = renk;
    requestAnimationFrame(function () { setTimeout(function () { i.style.width = Math.max(0, Math.min(100, oran)) + '%'; }, 40); });
    return c;
  }

  /* ───── istatistik ─────────────────────────────────────────── */
  function ist(sayi, etiket, renk) {
    return e('div', 'ist', [
      e('b', renk ? { style: 'color:' + renk } : null, sayi),
      e('span', null, etiket)
    ]);
  }

  /* ───── çizgi grafiği ──────────────────────────────────────── */
  function cizgiGrafik(veri, secenek) {
    secenek = secenek || {};
    var g = 300, y = 100, kn = 6;
    var mx = Math.max.apply(null, veri.concat([1]));
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'grafik');
    svg.setAttribute('viewBox', '0 0 ' + g + ' ' + y);
    svg.setAttribute('preserveAspectRatio', 'none');
    var gid = 'gr' + Math.random().toString(36).slice(2, 7);
    var defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" style="stop-color:' + (secenek.renk || '#7c5cff') + '"/>' +
      '<stop offset="100%" style="stop-color:' + (secenek.renk || '#7c5cff') + ';stop-opacity:0"/></linearGradient>';
    svg.appendChild(defs);
    var n = veri.length;
    var noktalar = veri.map(function (v, i) {
      return [kn + i * (g - kn * 2) / Math.max(1, n - 1), y - kn - (v / mx) * (y - kn * 2)];
    });
    var d = noktalar.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var alan = document.createElementNS(ns, 'path');
    alan.setAttribute('d', d + ' L' + noktalar[n - 1][0] + ' ' + y + ' L' + noktalar[0][0] + ' ' + y + ' Z');
    alan.setAttribute('fill', 'url(#' + gid + ')');
    alan.setAttribute('class', 'alan-dolgu');
    svg.appendChild(alan);
    var yol = document.createElementNS(ns, 'path');
    yol.setAttribute('d', d);
    yol.setAttribute('class', 'cizgi');
    yol.setAttribute('stroke', secenek.renk || '#7c5cff');
    yol.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(yol);
    return svg;
  }

  /* ───── sütun grafiği ──────────────────────────────────────── */
  function sutunGrafik(veri, etiketler, secenek) {
    secenek = secenek || {};
    var mx = Math.max.apply(null, veri.concat([1]));
    var kap = e('div', { style: 'display:flex;align-items:flex-end;gap:3px;height:' + (secenek.boy || 130) + 'px' });
    veri.forEach(function (v, i) {
      var yuzde = v / mx * 100;
      var s = e('div', {
        class: 'sutun',
        style: 'flex:1;min-width:0;height:' + Math.max(2, yuzde) + '%;border-radius:5px 5px 2px 2px;' +
          'background:linear-gradient(180deg,var(--brand-2),var(--brand));opacity:' + (v ? 1 : .22) + ';' +
          'animation-delay:' + (i * 18) + 'ms',
        title: (etiketler ? etiketler[i] + ': ' : '') + v
      });
      kap.appendChild(s);
    });
    return kap;
  }

  /* ───── ısı takvimi ────────────────────────────────────────── */
  function isiTakvim(gunler) {
    var kap = e('div', 'takvim');
    var mx = Math.max.apply(null, gunler.map(function (g) { return g.veri.sayac || 0; }).concat([1]));
    gunler.forEach(function (g) {
      var v = g.veri.sayac || 0;
      var s = v === 0 ? '' : v / mx > .75 ? 's4' : v / mx > .5 ? 's3' : v / mx > .25 ? 's2' : 's1';
      kap.appendChild(e('i', { class: s, title: g.gun + ' · ' + v + ' tekrar' }));
    });
    return kap;
  }

  /* ───── konfeti ────────────────────────────────────────────── */
  function konfeti(adet) {
    adet = adet || 90;
    var tuval = q('#konfeti');
    if (!tuval) return;
    var ctx = tuval.getContext('2d');
    tuval.width = innerWidth; tuval.height = innerHeight;
    var renkler = ['#7c5cff', '#22d3ee', '#ff5ca8', '#34e2a0', '#ffd76e'];
    var p = [];
    for (var i = 0; i < adet; i++) {
      p.push({
        x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .4,
        b: 5 + Math.random() * 7, h: 8 + Math.random() * 10,
        hz: 1.6 + Math.random() * 3.4, don: Math.random() * 6.28,
        dh: (Math.random() - .5) * .3, sag: (Math.random() - .5) * 1.8,
        r: renkler[(Math.random() * renkler.length) | 0]
      });
    }
    var kare = 0;
    (function ciz() {
      ctx.clearRect(0, 0, tuval.width, tuval.height);
      var canli = 0;
      p.forEach(function (o) {
        o.y += o.hz; o.x += o.sag; o.don += o.dh;
        if (o.y < tuval.height + 30) canli++;
        ctx.save();
        ctx.translate(o.x, o.y); ctx.rotate(o.don);
        ctx.fillStyle = o.r; ctx.globalAlpha = .92;
        ctx.fillRect(-o.b / 2, -o.h / 2, o.b, o.h);
        ctx.restore();
      });
      kare++;
      if (canli && kare < 460) requestAnimationFrame(ciz);
      else ctx.clearRect(0, 0, tuval.width, tuval.height);
    })();
  }

  /* ───── kutlama ekranı ─────────────────────────────────────── */
  function kutla(o) {
    /* o: {ikon, baslik, alt, dugmeler:[{ad,fn,ana}]} */
    var mevcut = q('.kutlama'); if (mevcut) mevcut.remove();
    var k = e('div', 'kutlama');
    var ic = e('div', { style: 'max-width:420px' }, [
      e('div', 'rozet-buyuk', o.ikon || '🎉'),
      e('h2', { style: 'font-size:29px;font-weight:850;letter-spacing:-.03em;margin:0 0 8px' }, o.baslik),
      e('p', { class: 'altbaslik', style: 'margin-bottom:22px' }, o.alt || '')
    ]);
    if (o.istatistik) {
      var iz = e('div', { class: 'izgara iz-3', style: 'margin-bottom:22px' });
      o.istatistik.forEach(function (s) { iz.appendChild(ist(s[0], s[1], s[2])); });
      ic.appendChild(iz);
    }
    var dg = e('div', { style: 'display:grid;gap:8px' });
    (o.dugmeler || [{ ad: 'Devam', ana: true }]).forEach(function (d) {
      dg.appendChild(e('button', {
        class: 'dg ' + (d.ana ? 'ana' : 'sade') + ' tam',
        onclick: function () { k.remove(); if (d.fn) d.fn(); }
      }, d.ad));
    });
    ic.appendChild(dg);
    k.appendChild(ic);
    document.body.appendChild(k);
    if (o.konfeti !== false) konfeti(110);
    return k;
  }

  /* ───── yıldız alanı (arka plan) ───────────────────────────── */
  function yildizlar() {
    var c = q('#yildizlar'); if (!c) return;
    var ctx = c.getContext('2d');
    var n, boyut;
    function kur() {
      c.width = innerWidth; c.height = innerHeight;
      boyut = Math.min(120, Math.round(innerWidth * innerHeight / 14000));
      n = [];
      for (var i = 0; i < boyut; i++) {
        n.push({
          x: Math.random() * c.width, y: Math.random() * c.height,
          r: Math.random() * 1.3 + .3, hz: Math.random() * .16 + .03,
          p: Math.random() * 6.28
        });
      }
    }
    kur();
    addEventListener('resize', kur);
    var acikTema = function () { return document.documentElement.dataset.tema === 'isik'; };
    (function ciz(t) {
      ctx.clearRect(0, 0, c.width, c.height);
      var renk = acikTema() ? '20,24,60' : '255,255,255';
      n.forEach(function (s) {
        s.y -= s.hz;
        if (s.y < -2) { s.y = c.height + 2; s.x = Math.random() * c.width; }
        var alfa = (.28 + .3 * Math.sin(t / 900 + s.p)) * (acikTema() ? .35 : 1);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.284);
        ctx.fillStyle = 'rgba(' + renk + ',' + alfa.toFixed(3) + ')';
        ctx.fill();
      });
      requestAnimationFrame(ciz);
    })(0);
  }

  /* ───── tıklanabilir kelimeler ─────────────────────────────── */
  function kelimelestir(metin, tiklandi, vurgular) {
    var kap = e('span');
    var parcalar = String(metin).split(/(\s+)/);
    parcalar.forEach(function (p) {
      if (/^\s+$/.test(p)) { kap.appendChild(document.createTextNode(p)); return; }
      var temiz = p.replace(/[^A-Za-zÀ-ÿ']/g, '');
      if (!temiz) { kap.appendChild(document.createTextNode(p)); return; }
      var s = e('span', {
        class: 'kelime' + (vurgular && vurgular.indexOf(temiz.toLowerCase()) > -1 ? ' vurgu' : ''),
        onclick: function (ev) { ev.stopPropagation(); tiklandi(temiz, ev); }
      }, p);
      kap.appendChild(s);
    });
    return kap;
  }

  /* ───── kelime baloncuğu ───────────────────────────────────── */
  var acikBalon = null;
  function kelimeBalonu(kelime, ev) {
    balonKapat();
    var b = e('div', { id: 'balon-kelime' });
    b.appendChild(e('div', 'iskelet', { style: 'height:80px' }));
    document.body.appendChild(b);
    acikBalon = b;
    yerlestir(b, ev);
    setTimeout(function () {
      document.addEventListener('click', disariTikla, { once: true });
    }, 30);

    Promise.all([
      Veri.kelimeBilgi(kelime),
      Veri.kelimeOrnekleri(kelime, 3),
      Veri.esanlam().catch(function () { return {}; })
    ]).then(function (r) {
      var bilgi = r[0], ornekler = r[1], esanlam = r[2];
      bosalt(b);
      var ust = e('div', { style: 'display:flex;align-items:center;gap:9px;margin-bottom:8px' }, [
        e('b', { style: 'font-size:20px;letter-spacing:-.02em;flex:1' }, bilgi ? bilgi.kelime : kelime),
        bilgi && bilgi.seviye ? e('span', 'et ' + bilgi.seviye, bilgi.seviye) : null,
        e('button', {
          class: 'dg kucuk', title: 'Seslendir',
          onclick: function () { Ses.konus(bilgi ? bilgi.kelime : kelime, { baglam: 'en' }); }
        }, '🔊')
      ]);
      b.appendChild(ust);

      if (!bilgi) {
        b.appendChild(e('p', 'kucuk-yazi', 'Sözlükte bulunamadı. Cümledeki kullanımına bakabilirsin.'));
      } else {
        if (bilgi.oku) b.appendChild(e('div', { class: 'okunus', style: 'margin-bottom:8px' }, bilgi.oku));
        if (bilgi.kokBulundu) b.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-bottom:6px' }, '“' + bilgi.kokBulundu + '” → kök: ' + bilgi.kelime));
        (bilgi.anlamlar || []).slice(0, 4).forEach(function (a) {
          b.appendChild(e('div', { style: 'font-size:14.5px;line-height:1.6;color:var(--ink-2)' }, '· ' + a));
        });
        var es = esanlam[bilgi.kelime];
        if (es && es.length) {
          b.appendChild(e('div', { class: 'kucuk-yazi', style: 'margin-top:8px' }, 'Eş anlam: ' + es.slice(0, 5).join(', ')));
        }
      }
      if (ornekler.length) {
        b.appendChild(e('div', { class: 'bolum-ad', style: 'margin:12px 0 6px;font-size:10.5px' }, 'Örnekler'));
        ornekler.forEach(function (o) {
          b.appendChild(e('div', {
            style: 'padding:8px 10px;border-radius:12px;background:var(--glass);margin-bottom:5px;cursor:pointer',
            onclick: function () { Ses.konus(o.en, { baglam: 'en' }); }
          }, [
            e('div', { style: 'font-size:13.5px;font-weight:650' }, o.en),
            e('div', { class: 'kucuk-yazi' }, o.tr)
          ]));
        });
      }
      var alt = e('div', { style: 'display:flex;gap:6px;margin-top:12px;flex-wrap:wrap' }, [
        e('button', {
          class: 'dg kucuk', style: 'flex:1',
          onclick: function () {
            var l = Atlas.oku('kelime-liste', []);
            var w = bilgi ? bilgi.kelime : kelime;
            if (l.indexOf(w) < 0) { l.push(w); Atlas.yaz('kelime-liste', l); }
            Atlas.SRS.kaydet('k', w, false, 60);
            bildir('“' + w + '” tekrar listene eklendi', 'ok');
            balonKapat();
          }
        }, '➕ Listeme ekle'),
        e('button', {
          class: 'dg kucuk', title: 'YouGlish’te gerçek videolarda dinle',
          onclick: function () {
            var w = bilgi ? bilgi.kelime : kelime;
            window.open('https://youglish.com/pronounce/' + encodeURIComponent(w) + '/english', '_blank', 'noopener,noreferrer');
          }
        }, '🎬 YouGlish'),
        e('button', { class: 'dg kucuk sade', onclick: balonKapat }, 'Kapat')
      ]);
      b.appendChild(alt);
      yerlestir(b, ev);
    }).catch(function () {
      bosalt(b);
      b.appendChild(e('b', { style: 'display:block;margin-bottom:7px' }, kelime));
      b.appendChild(e('p', 'kucuk-yazi', location.protocol === 'file:'
        ? 'Sözlük yerel dosya kipinde yüklenemiyor. Uygulamayı küçük bir yerel sunucuyla aç.'
        : 'Kelime bilgisi şu anda yüklenemedi. Bağlantını kontrol edip tekrar dene.'));
      b.appendChild(e('button', { class: 'dg kucuk sade tam', onclick: balonKapat }, 'Kapat'));
      yerlestir(b, ev);
    });

    function disariTikla(ev2) { if (acikBalon && !acikBalon.contains(ev2.target)) balonKapat(); }
  }
  function yerlestir(b, ev) {
    var g = b.getBoundingClientRect();
    var x = (ev && ev.clientX || innerWidth / 2) - g.width / 2;
    var y = (ev && ev.clientY || innerHeight / 2) + 18;
    x = Math.max(10, Math.min(innerWidth - g.width - 10, x));
    if (y + g.height > innerHeight - 10) y = Math.max(10, (ev && ev.clientY || 100) - g.height - 14);
    b.style.left = x + 'px'; b.style.top = y + 'px';
  }
  function balonKapat() { if (acikBalon) { acikBalon.remove(); acikBalon = null; } }

  /* Bütün ekranlarda düz İngilizce metin de tıklanabilir. Ders motorunun
     oluşturduğu .kelime düğümleri kendi işleyicisini kullanmaya devam eder. */
  function genelKelimeTiklama() {
    document.addEventListener('click', function (ev) {
      if (ev.defaultPrevented || ev.target.closest('#balon-kelime,.kelime,button,a,input,textarea,select,[contenteditable="true"]')) return;
      var range = null;
      if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(ev.clientX, ev.clientY);
      else if (document.caretPositionFromPoint) {
        var pos = document.caretPositionFromPoint(ev.clientX, ev.clientY);
        if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); }
      }
      if (!range || !range.startContainer || range.startContainer.nodeType !== 3) return;
      var metin = range.startContainer.nodeValue || '', i = Math.min(range.startOffset, metin.length - 1);
      if (/\s/.test(metin.charAt(i)) && i > 0) i--;
      var sol=i, sag=i+1;
      while (sol>0 && /[A-Za-z'’-]/.test(metin.charAt(sol-1))) sol--;
      while (sag<metin.length && /[A-Za-z'’-]/.test(metin.charAt(sag))) sag++;
      var kelime = metin.slice(sol,sag).replace(/^[^A-Za-z]+|[^A-Za-z]+$/g,'');
      if (kelime.length < 2 || !/[A-Za-z]/.test(kelime)) return;
      kelimeBalonu(kelime, ev);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', genelKelimeTiklama, { once: true });
  else genelKelimeTiklama();

  /* ───── avatar ─────────────────────────────────────────────── */
  function avatar(boy) {
    var img = e('img', { src: Ses.GORSEL.idle, alt: 'öğretmen', width: boy || 132, height: boy || 132 });
    img.onerror = function () {
      img.style.display = 'none';
      yuz.textContent = '👩‍🏫';
      yuz.style.cssText += ';display:grid;place-items:center;font-size:' + ((boy || 132) * .5) + 'px';
    };
    var yuz = e('div', 'yuz', [img]);
    var kap = e('div', 'avatar-sarma', [e('div', 'halo'), yuz]);
    if (boy) { kap.style.width = kap.style.height = boy + 'px'; kap.style.flexBasis = boy + 'px'; }
    kap.agiz = function (kare) {
      var src = Ses.GORSEL[kare] || Ses.GORSEL.idle;
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    };
    kap.konusuyor = function (b) { kap.classList.toggle('konusuyor', !!b); if (!b) kap.agiz('idle'); };
    return kap;
  }

  /* ───── fark gösterimi ─────────────────────────────────────── */
  function farkGoster(dogru, cevap) {
    var p = Atlas.fark(dogru, cevap);
    var g = e('div', { class: 'fark', style: 'font-size:15px;line-height:1.9' });
    p.forEach(function (o) {
      if (o.t === '=') g.appendChild(document.createTextNode(o.s + ' '));
      else if (o.t === '-') g.appendChild(e('del', null, o.s + ' '));
      else g.appendChild(e('ins', null, o.s + ' '));
    });
    return g;
  }

  /* ───── boş durum ──────────────────────────────────────────── */
  function bos(ikon, baslik, alt, dugme) {
    return e('div', 'bos', [
      e('div', 'yuz-ifade', ikon),
      e('div', { style: 'font-size:17px;font-weight:750;color:var(--ink-2);margin-bottom:6px' }, baslik),
      alt ? e('div', { class: 'kucuk-yazi', style: 'max-width:340px;margin:0 auto 16px' }, alt) : null,
      dugme ? e('button', { class: 'dg ana', onclick: dugme.fn }, dugme.ad) : null
    ]);
  }

  /* ───── iskelet yükleyici ──────────────────────────────────── */
  function yukleniyor(satir) {
    var g = e('div', { style: 'display:grid;gap:10px' });
    for (var i = 0; i < (satir || 5); i++) {
      g.appendChild(e('div', { class: 'iskelet', style: 'height:' + (i === 0 ? 88 : 62) + 'px' }));
    }
    return g;
  }

  /* ───── titreşim ───────────────────────────────────────────── */
  function titre(desen) { try { if (navigator.vibrate) navigator.vibrate(desen); } catch (e) {} }

  global.UI = {
    e: e, q: q, qq: qq, bosalt: bosalt, kacis: kacis,
    bildir: bildir, pencere: pencere, pencereKapat: pencereKapat, onay: onay,
    halka: halka, cubuk: cubuk, ist: ist,
    cizgiGrafik: cizgiGrafik, sutunGrafik: sutunGrafik, isiTakvim: isiTakvim,
    konfeti: konfeti, kutla: kutla, yildizlar: yildizlar,
    kelimelestir: kelimelestir, kelimeBalonu: kelimeBalonu, balonKapat: balonKapat,
    avatar: avatar, farkGoster: farkGoster, bos: bos, yukleniyor: yukleniyor, titre: titre
  };
})(window);
