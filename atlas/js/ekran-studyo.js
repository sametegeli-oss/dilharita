/* ═══════════════════════════════════════════════════════════════
   ATLAS · SES DALGA STÜDYOSU  (eski sesdalga.html)
   Üç adımlı gölgeleme atölyesi:
     1  Hoca çizdirir  — cümle seslendirilirken ses zarfı kaydedilir
     2  Sen okursun    — mikrofonla aynı cümle, aynı ölçüm
     3  Kıyaslanır     — iki eğri üst üste, üç ayrı puan

   Puanlama üç bileşenli, çünkü "yanlış telaffuz" tek bir şey değil:
     söz    %30  doğru kelimeleri söyledin mi        (tanıma + fark)
     tempo  %40  toplam süre ve duraklar tuttu mu    (süre oranı)
     vurgu  %30  enerji zarfı aynı yerlerde mi yükseldi (normalize sapma)

   Kelime bazlı çalışma: cümledeki her kelime tıklanabilir; hocanın
   ve senin kaydından o kelimeye denk gelen dilim ayrı ayrı çalınır.
   Sınırlar süreye orantılı tahmin edilir (harf uzunluğuna göre) ve
   kaydırıcıyla elle düzeltilebilir — konuşma tanıma zaman damgası
   vermediği için bu tahmin şart.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var e = UI.e;

  Ekran.studyo = function (g, arg) {
    var durum = {
      cumle: null,
      hoca: null,     /* {zarf:[], sure, blob} */
      ben: null,      /* {zarf:[], sure, blob, metin} */
      sinirlar: null, /* kelime sınırları (oran) */
      secili: null
    };

    Uygulama.baslik(g, 'Ses dalga stüdyosu', 'Hoca çizdir → sen oku → kıyasla', '#/menu');

    /* ── cümle seçimi ── */
    var cumleKart = e('div', { class: 'kart parlak', style: 'margin-bottom:12px' });
    g.appendChild(cumleKart);

    var adimKap = e('div', 'asama');
    g.appendChild(adimKap);

    var tuvalKart = e('div', { class: 'tuval-kart', style: 'margin-bottom:12px' });
    var tuval = e('canvas', { height: 200 });
    tuvalKart.appendChild(e('span', 'tuval-ad', 'Ses zarfı · mavi hoca, mor sen'));
    tuvalKart.appendChild(tuval);
    g.appendChild(tuvalKart);

    var kontrolKap = e('div', { style: 'display:grid;gap:8px;margin-bottom:12px' });
    g.appendChild(kontrolKap);

    var skorKap = e('div');
    g.appendChild(skorKap);

    var kelimeKap = e('div');
    g.appendChild(kelimeKap);

    /* başlangıç cümlesi */
    if (arg[0]) {
      Veri.cumlelerByIds([decodeURIComponent(arg[0])]).then(function (l) {
        durum.cumle = l[0] || { en: decodeURIComponent(arg[0]), tr: '' };
        cizHepsi();
      });
    } else {
      var son = Atlas.oku('studyo-cumle', null);
      durum.cumle = son || { en: 'She has been working here since last summer.', tr: 'Geçen yazdan beri burada çalışıyor.' };
      cizHepsi();
    }

    function cizHepsi() { cizCumle(); cizAdim(); cizKontrol(); cizTuval(); }

    /* ── cümle kartı ── */
    function cizCumle() {
      UI.bosalt(cumleKart);
      var c = durum.cumle;
      cumleKart.appendChild(e('div', { style: 'display:flex;align-items:flex-start;gap:10px' }, [
        e('div', { style: 'flex:1;min-width:0' }, [
          e('b', { style: 'display:block;font-size:16px;font-weight:750;line-height:1.45' }, c.en),
          c.tr ? e('div', { class: 'kucuk-yazi', style: 'margin-top:3px' }, c.tr) : null,
          c.ipa ? e('div', 'ipa', c.ipa) : null
        ])
      ]));
      cumleKart.appendChild(e('div', { style: 'display:flex;gap:6px;margin-top:10px;flex-wrap:wrap' }, [
        e('button', { class: 'dg kucuk', style: 'flex:1', onclick: rastgele }, '↻ Başka cümle'),
        e('button', { class: 'dg kucuk', style: 'flex:1', onclick: vadeliCumle }, '🔁 Tekrardan'),
        e('button', { class: 'dg kucuk', style: 'flex:1', onclick: kendiCumlesi }, '✍️ Kendi')
      ]));
    }

    function rastgele() {
      Veri.ornekler().then(function (ex) {
        durum.cumle = ex[Math.floor(Math.random() * ex.length)];
        sifirla(); cizHepsi();
      });
    }
    function vadeliCumle() {
      var v = Atlas.SRS.vadesiGelen('c');
      if (!v.length) { UI.bildir('Vadesi gelen cümle yok', 'bad'); return; }
      Veri.cumlelerByIds([v[Math.floor(Math.random() * v.length)].id]).then(function (l) {
        if (l[0]) { durum.cumle = l[0]; sifirla(); cizHepsi(); }
      });
    }
    function kendiCumlesi() {
      var alan = e('input', { class: 'alan', value: durum.cumle.en });
      UI.pencere(e('div', null, [alan, e('button', {
        class: 'dg ana tam', style: 'margin-top:10px',
        onclick: function () {
          durum.cumle = { en: alan.value.trim() || durum.cumle.en, tr: '' };
          Atlas.yaz('studyo-cumle', durum.cumle);
          UI.pencereKapat(); sifirla(); cizHepsi();
        }
      }, 'Kaydet')]), { baslik: 'Çalışılacak cümle', dugmesiz: true });
    }
    function sifirla() {
      durum.hoca = null; durum.ben = null; durum.sinirlar = null; durum.secili = null;
      UI.bosalt(skorKap); UI.bosalt(kelimeKap);
    }

    /* ── adım göstergesi ── */
    function cizAdim() {
      UI.bosalt(adimKap);
      adimKap.appendChild(e('div', { class: durum.hoca ? 'bitti' : 'aktif' }, '🎓 Hoca çizdir'));
      adimKap.appendChild(e('div', { class: durum.ben ? 'bitti' : durum.hoca ? 'aktif' : '' }, '🎙️ Sen oku'));
      adimKap.appendChild(e('div', { class: (durum.hoca && durum.ben) ? 'aktif' : '' }, '🔍 Kıyasla'));
    }

    /* ── kontroller ── */
    function cizKontrol() {
      UI.bosalt(kontrolKap);
      kontrolKap.appendChild(e('button', {
        class: 'dg ' + (durum.hoca ? '' : 'ana') + ' tam', onclick: hocaCizdir
      }, durum.hoca ? '↻ Hocayı yeniden çizdir' : '🎓 1. Hoca çizdirsin'));

      kontrolKap.appendChild(e('button', {
        class: 'dg ' + (durum.hoca && !durum.ben ? 'ana' : '') + ' tam',
        disabled: durum.hoca ? null : 'disabled',
        onclick: benOku
      }, durum.ben ? '↻ Yeniden oku' : '🎙️ 2. Mikrofonla oku'));

      if (durum.hoca && durum.ben) {
        kontrolKap.appendChild(e('div', { style: 'display:flex;gap:8px' }, [
          e('button', { class: 'dg', style: 'flex:1', onclick: duetOynat }, '▶ Düet oynat'),
          e('button', { class: 'dg', style: 'flex:1', onclick: function () { oynatBlob(durum.ben.blob); } }, '▶ Sadece sesim'),
          e('button', { class: 'dg', style: 'flex:1', onclick: function () { seslendir(); } }, '🔊 Hoca')
        ]));
      }
    }

    /* ── 1. hoca çizdir ─────────────────────────────────────────
       Seslendirme sırasında hoparlörden çıkan sesi ölçemeyiz
       (tarayıcı çıkışı geri vermez). Bunun yerine zarfı metinden
       üretiyoruz: her kelimenin harf uzunluğu ve ünlü yoğunluğu
       süre ve enerji tahminini verir. Kaba ama tempo/vurgu
       karşılaştırması için yeterli ve her cihazda aynı çalışır. */
    function hocaCizdir() {
      var c = durum.cumle;
      var a = Atlas.Ayar.al();
      var kelimeler = c.en.split(/\s+/).filter(Boolean);
      var hiz = a.sesHiz || 0.9;

      var sureler = kelimeler.map(function (w) {
        var temiz = w.replace(/[^A-Za-z']/g, '');
        var unlu = (temiz.match(/[aeiouy]/gi) || []).length || 1;
        /* hece sayısı ≈ ünlü kümesi; kelime başına taban süre + hece süresi */
        return (0.09 + unlu * 0.13) / hiz;
      });
      /* noktalama duraklaması */
      kelimeler.forEach(function (w, i) {
        if (/[,;:]$/.test(w)) sureler[i] += 0.18 / hiz;
        if (/[.!?]$/.test(w)) sureler[i] += 0.32 / hiz;
      });
      var toplam = sureler.reduce(function (x, y) { return x + y; }, 0);

      /* sınırlar (oran olarak) */
      var sinir = [], birikim = 0;
      kelimeler.forEach(function (w, i) {
        var bas = birikim / toplam;
        birikim += sureler[i];
        sinir.push({ kelime: w, bas: bas, son: birikim / toplam });
      });
      durum.sinirlar = sinir;

      /* zarf: her kelime bir tepe, ünlü yoğunluğu genlik */
      var N = 220;
      var zarf = new Array(N).fill(0.04);
      kelimeler.forEach(function (w, i) {
        var s = sinir[i];
        var temiz = w.replace(/[^A-Za-z']/g, '').toLowerCase();
        var unlu = (temiz.match(/[aeiouy]/gi) || []).length || 1;
        var vurguluMu = temiz.length > 4 || /^(the|a|an|of|to|in|is|are)$/.test(temiz) === false;
        var tepe = Math.min(1, (vurguluMu ? 0.62 : 0.34) + unlu * 0.07);
        var b = Math.floor(s.bas * N), so = Math.max(b + 1, Math.floor(s.son * N));
        for (var k = b; k < so && k < N; k++) {
          var t = (k - b) / Math.max(1, so - b - 1);
          /* kelime içi zarf: hızlı yüksel, yavaş sön */
          zarf[k] = Math.max(zarf[k], tepe * Math.sin(Math.pow(t, 0.7) * Math.PI));
        }
      });

      durum.hoca = { zarf: zarf, sure: toplam };
      Atlas.yaz('studyo-cumle', c);
      seslendir();
      cizAdim(); cizKontrol(); cizTuval();
      UI.bildir('Hoca zarfı çizildi — şimdi sen oku', 'ok', 2600);
    }

    function seslendir() {
      Ses.konus(durum.cumle.en, { baglam: 'en' });
    }

    /* ── 2. mikrofonla oku ── */
    function benOku() {
      if (!navigator.mediaDevices || !(global.AudioContext || global.webkitAudioContext)) {
        UI.bildir('Bu tarayıcıda mikrofon kullanılamıyor', 'bad'); return;
      }
      UI.bosalt(kontrolKap);
      var sayacEl = e('div', { class: 'kart', style: 'text-align:center;padding:18px' }, [
        e('div', { style: 'font-size:34px;margin-bottom:6px' }, '🎙️'),
        e('b', { style: 'font-size:16px' }, 'Cümleyi oku'),
        e('div', { class: 'kucuk-yazi', style: 'margin-top:4px' }, durum.cumle.en)
      ]);
      var dalgaKap = e('div', { class: 'dalga', style: 'margin:12px 0' });
      var bitirDugme = e('button', { class: 'dg ana tam' }, '⏹ Bitir');
      kontrolKap.appendChild(sayacEl);
      kontrolKap.appendChild(dalgaKap);
      kontrolKap.appendChild(bitirDugme);

      var zarf = [], baslangic = Date.now();
      var akis, ctx, analiz, raf, rec, parcalar = [];
      var cubuklar = [];
      for (var i = 0; i < 28; i++) { var b = e('i'); dalgaKap.appendChild(b); cubuklar.push(b); }

      var stt = null, sttMetin = '';
      if (Ses.destek().stt) {
        Ses.dinle({ dil: 'en', durdurucu: function (f) { stt = f; } })
          .then(function (m) { sttMetin = m; }).catch(function () {});
      }

      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } })
        .then(function (s) {
          akis = s;
          ctx = new (global.AudioContext || global.webkitAudioContext)();
          var kaynak = ctx.createMediaStreamSource(s);
          analiz = ctx.createAnalyser();
          analiz.fftSize = 1024;
          analiz.smoothingTimeConstant = 0.5;
          kaynak.connect(analiz);
          var veri = new Uint8Array(analiz.fftSize);

          if (global.MediaRecorder) {
            var tipler = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''];
            var tip = tipler.find(function (t) { return !t || MediaRecorder.isTypeSupported(t); });
            try {
              rec = new MediaRecorder(s, tip ? { mimeType: tip } : undefined);
              rec.ondataavailable = function (ev) { if (ev.data.size) parcalar.push(ev.data); };
              rec.start();
            } catch (x) { rec = null; }
          }

          (function tik() {
            analiz.getByteTimeDomainData(veri);
            var rms = 0;
            for (var k = 0; k < veri.length; k++) { var d = (veri[k] - 128) / 128; rms += d * d; }
            rms = Math.sqrt(rms / veri.length);
            zarf.push(rms);
            for (var j = 0; j < cubuklar.length; j++) {
              cubuklar[j].style.height = Math.max(5, Math.min(36, rms * 260 * (0.6 + Math.random() * 0.7))) + 'px';
            }
            raf = requestAnimationFrame(tik);
          })();
        })
        .catch(function () { UI.bildir('Mikrofona erişilemedi', 'bad'); cizKontrol(); });

      Uygulama.temizlemeEkle(temizle);
      bitirDugme.onclick = function () {
        var sure = (Date.now() - baslangic) / 1000;
        if (stt) try { stt(); } catch (x) {}
        if (rec && rec.state === 'recording') {
          rec.onstop = function () { tamamla(sure, new Blob(parcalar, { type: rec.mimeType || 'audio/webm' })); };
          try { rec.stop(); } catch (x) { tamamla(sure, null); }
        } else tamamla(sure, null);
      };

      function temizle() {
        if (raf) cancelAnimationFrame(raf);
        if (akis) akis.getTracks().forEach(function (t) { t.stop(); });
        if (ctx) try { ctx.close(); } catch (x) {}
        raf = null; akis = null; ctx = null;
      }

      function tamamla(sure, blob) {
        temizle();
        /* sessizlikleri kırp */
        var esik = 0.02;
        var bas = zarf.findIndex(function (v) { return v > esik; });
        var son = zarf.length - 1 - zarf.slice().reverse().findIndex(function (v) { return v > esik; });
        if (bas < 0 || son <= bas) { bas = 0; son = zarf.length - 1; }
        var kirpik = zarf.slice(bas, son + 1);
        var kirpikSure = sure * (kirpik.length / Math.max(1, zarf.length));

        durum.ben = {
          zarf: yenidenOrnekle(kirpik, 220),
          sure: kirpikSure || sure,
          blob: blob,
          metin: sttMetin
        };
        setTimeout(function () {
          if (!durum.ben.metin && sttMetin) durum.ben.metin = sttMetin;
          cizAdim(); cizKontrol(); cizTuval(); kiyasla();
        }, 350);
      }
    }

    /* ── yeniden örnekleme ── */
    function yenidenOrnekle(dizi, n) {
      if (!dizi.length) return new Array(n).fill(0);
      var out = new Array(n);
      for (var i = 0; i < n; i++) {
        var p = i / (n - 1) * (dizi.length - 1);
        var a = Math.floor(p), b = Math.min(dizi.length - 1, a + 1);
        out[i] = dizi[a] + (dizi[b] - dizi[a]) * (p - a);
      }
      return out;
    }
    function normalize(dizi) {
      var mn = Infinity, mx = -Infinity;
      dizi.forEach(function (v) { if (v < mn) mn = v; if (v > mx) mx = v; });
      var r = (mx - mn) || 1;
      return dizi.map(function (v) { return (v - mn) / r; });
    }

    /* ── tuval ── */
    function cizTuval() {
      var o = Math.min(2, devicePixelRatio || 1);
      if (tuval.width !== tuval.clientWidth * o) {
        tuval.width = tuval.clientWidth * o;
        tuval.height = 200 * o;
      }
      var ctx = tuval.getContext('2d');
      ctx.setTransform(o, 0, 0, o, 0, 0);
      var W = tuval.clientWidth, H = 200;
      ctx.clearRect(0, 0, W, H);
      var renk = function (v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); };

      /* seçili kelime dilimi */
      if (durum.secili !== null && durum.sinirlar) {
        var s = durum.sinirlar[durum.secili];
        if (s) {
          ctx.fillStyle = 'rgba(56,189,248,.15)';
          ctx.fillRect(s.bas * W, 0, (s.son - s.bas) * W, H);
        }
      }
      /* orta çizgi ve ızgara */
      ctx.strokeStyle = renk('--line'); ctx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(function (y) {
        ctx.beginPath(); ctx.moveTo(0, H * y); ctx.lineTo(W, H * y); ctx.stroke();
      });

      if (!durum.hoca) {
        ctx.fillStyle = renk('--ink-3'); ctx.font = '13px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('Önce "Hoca çizdirsin" düğmesine bas', W / 2, H / 2);
        ctx.textAlign = 'left';
        return;
      }

      egriCiz(ctx, normalize(durum.hoca.zarf), W, H, renk('--brand-2') || '#22d3ee', true);
      if (durum.ben) egriCiz(ctx, normalize(durum.ben.zarf), W, H, renk('--brand') || '#7c5cff', false);

      /* kelime sınırları */
      if (durum.sinirlar) {
        ctx.strokeStyle = renk('--line-2'); ctx.setLineDash([3, 4]);
        durum.sinirlar.forEach(function (s) {
          ctx.beginPath(); ctx.moveTo(s.son * W, 0); ctx.lineTo(s.son * W, H); ctx.stroke();
        });
        ctx.setLineDash([]);
      }
    }

    function egriCiz(ctx, veri, W, H, renk, dolgu) {
      var n = veri.length;
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var x = i / (n - 1) * W, y = H - 10 - veri[i] * (H - 26);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      if (dolgu) {
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle = renk + '22'; ctx.fill();
        ctx.beginPath();
        for (var j = 0; j < n; j++) {
          var x2 = j / (n - 1) * W, y2 = H - 10 - veri[j] * (H - 26);
          j ? ctx.lineTo(x2, y2) : ctx.moveTo(x2, y2);
        }
      }
      ctx.strokeStyle = renk; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();
    }

    /* ── 3. kıyasla ── */
    function kiyasla() {
      if (!durum.hoca || !durum.ben) return;
      var c = durum.cumle;

      /* söz puanı */
      var sozSkor;
      if (durum.ben.metin) sozSkor = Atlas.benzerlik(c.en, durum.ben.metin);
      else sozSkor = -1;   /* tanıma yoksa bu bileşen ölçülemez */

      /* tempo puanı */
      var oran = durum.ben.sure / Math.max(0.1, durum.hoca.sure);
      var tempoSkor = Math.max(0, Math.round(100 * (1 - Math.min(1, Math.abs(1 - oran) / 0.6))));

      /* vurgu puanı — normalize zarf sapması */
      var nH = normalize(durum.hoca.zarf), nB = normalize(durum.ben.zarf);
      var N = Math.min(nH.length, nB.length), sapma = 0;
      for (var i = 0; i < N; i++) sapma += Math.abs(nH[i] - nB[i]);
      var ortSapma = N ? sapma / N : 1;
      var vurguSkor = Math.max(0, Math.round(100 * (1 - ortSapma)));

      var genel = sozSkor >= 0
        ? Math.round(sozSkor * 0.3 + tempoSkor * 0.4 + vurguSkor * 0.3)
        : Math.round(tempoSkor * 0.55 + vurguSkor * 0.45);

      var rozet = genel >= 85 ? { ad: 'Kusursuz 🌟', renk: 'var(--ok)' }
        : genel >= 65 ? { ad: 'İyi 👍', renk: 'var(--warn)' }
          : { ad: 'Gelişmeli 🎯', renk: 'var(--bad)' };

      UI.bosalt(skorKap);
      skorKap.appendChild(e('div', { class: 'kart parlak', style: 'margin-bottom:12px' }, [
        e('div', { style: 'display:flex;align-items:center;gap:16px;margin-bottom:14px' }, [
          UI.halka(genel, { boy: 92, kalinlik: 9, sayi: genel, etiket: 'genel' }),
          e('div', { style: 'flex:1' }, [
            e('b', { style: 'display:block;font-size:18px;font-weight:800;color:' + rozet.renk }, rozet.ad),
            e('div', 'kucuk-yazi', durum.ben.metin ? 'Duyduğum: “' + durum.ben.metin + '”' : 'Ses tanıma yok — söz puanı ölçülemedi')
          ])
        ]),
        e('div', { class: 'izgara iz-3' }, [
          UI.ist(sozSkor >= 0 ? '%' + sozSkor : '—', 'söz · %30'),
          UI.ist('%' + tempoSkor, 'tempo · %40'),
          UI.ist('%' + vurguSkor, 'vurgu · %30')
        ]),
        e('div', { class: 'kucuk-yazi', style: 'margin-top:12px;line-height:1.7' }, tavsiye()),
        durum.ben.metin ? UI.farkGoster(c.en, durum.ben.metin) : null
      ]));

      /* kayıtla */
      if (c.id) {
        Atlas.cevapla({
          tip: 'c', id: c.id, dogruMu: genel >= 70, skor: genel, kip: 'telaffuz',
          en: c.en, tr: c.tr, cevap: durum.ben.metin || '(gölgeleme)', mod: c.module, lvl: c.level
        });
      }
      Atlas.Gunluk.ekle('sayac', 1, 'studyo');

      cizKelimeler();

      function tavsiye() {
        var t = [];
        if (tempoSkor < 60) {
          t.push(oran > 1
            ? 'Hocadan belirgin biçimde YAVAŞ okudun. Kelimeler arasında beklemek doğal duyulmuyor; cümleyi tek nefeste bitirmeyi dene.'
            : 'Hocadan HIZLI okudun. Acele edince ünlüler kısalıyor ve vurgu kayboluyor.');
        }
        if (vurguSkor < 60) {
          t.push('Enerji eğrin hocanınkiyle aynı yerlerde yükselmiyor — yani vurguyu farklı heceye koyuyorsun. ' +
            'Grafikte iki tepe noktasının kaydığı yeri bul, o kelimeyi tek tek çalış.');
        }
        if (sozSkor >= 0 && sozSkor < 70) t.push('Bazı kelimeler tanınmadı; aşağıdan tek tek dinleyip tekrarla.');
        if (!t.length) t.push('Üç ölçüde de hocaya yakınsın. Aynı cümleyi bir kez daha, biraz daha hızlı deneyebilirsin.');
        return t.join(' ');
      }
    }

    /* ── kelime bazlı çalışma ── */
    function cizKelimeler() {
      UI.bosalt(kelimeKap);
      if (!durum.sinirlar) return;
      kelimeKap.appendChild(e('div', 'bolum-ad', 'Kelime kelime çalış'));
      kelimeKap.appendChild(e('p', { class: 'kucuk-yazi', style: 'margin:0 0 10px' },
        'Bir kelimeye dokun: hocanın ve senin kaydından o dilim ayrı ayrı çalınır. ' +
        'Sınırlar süreye orantılı tahmindir; kayarsa aşağıdaki kaydırıcıyla düzeltebilirsin.'));

      var satir = e('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px' });
      durum.sinirlar.forEach(function (s, i) {
        satir.appendChild(e('button', {
          class: 'dizi-parca',
          style: durum.secili === i ? 'border-color:var(--brand);background:rgba(124,92,255,.2)' : '',
          onclick: function () { durum.secili = durum.secili === i ? null : i; cizTuval(); cizKelimeler(); }
        }, s.kelime));
      });
      kelimeKap.appendChild(satir);

      if (durum.secili === null) return;
      var s = durum.sinirlar[durum.secili];
      var panel = e('div', { class: 'kart parlak' });
      panel.appendChild(e('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px' }, [
        e('b', { style: 'flex:1;font-size:19px' }, s.kelime),
        e('span', 'kucuk-yazi', (s.bas * durum.hoca.sure).toFixed(2) + 's → ' + (s.son * durum.hoca.sure).toFixed(2) + 's')
      ]));
      panel.appendChild(e('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px' }, [
        e('button', {
          class: 'dg kucuk', style: 'flex:1',
          onclick: function () { Ses.konus(s.kelime.replace(/[^A-Za-z']/g, ''), { baglam: 'en', hiz: 0.7 }); }
        }, '🔊 Hoca'),
        e('button', {
          class: 'dg kucuk', style: 'flex:1', disabled: durum.ben && durum.ben.blob ? null : 'disabled',
          onclick: function () { dilimOynat(s.bas, s.son); }
        }, '▶ Sen'),
        e('button', {
          class: 'dg kucuk', style: 'flex:1', disabled: durum.ben && durum.ben.blob ? null : 'disabled',
          onclick: function () {
            Ses.konus(s.kelime.replace(/[^A-Za-z']/g, ''), {
              baglam: 'en', hiz: 0.7,
              bitti: function () { setTimeout(function () { dilimOynat(s.bas, s.son); }, 320); }
            });
          }
        }, '🔁 Kıyasla')
      ]));

      /* sınır ayarı */
      var kay = e('input', {
        type: 'range', class: 'alan', min: '-0.2', max: '0.2', step: '0.01', value: '0',
        style: 'padding:6px'
      });
      kay.oninput = function () {
        var d = parseFloat(kay.value);
        s.bas = Math.max(0, Math.min(0.98, (s.__bas === undefined ? (s.__bas = s.bas) : s.__bas) + d));
        s.son = Math.max(s.bas + 0.02, Math.min(1, (s.__son === undefined ? (s.__son = s.son) : s.__son) + d));
        cizTuval();
      };
      panel.appendChild(e('label', { class: 'kucuk-yazi', style: 'display:block;margin-bottom:4px' }, 'Dilimi kaydır'));
      panel.appendChild(kay);
      panel.appendChild(e('button', {
        class: 'dg kucuk tam', style: 'margin-top:10px',
        onclick: function () { Uygulama.git('#/video/' + encodeURIComponent(s.kelime.replace(/[^A-Za-z']/g, ''))); }
      }, '📺 Bu kelimeyi videoda duy'));
      kelimeKap.appendChild(panel);
    }

    /* ── oynatma ── */
    var suAnkiSes = null;
    function oynatBlob(blob, bas, son) {
      if (!blob) return;
      if (suAnkiSes) { try { suAnkiSes.pause(); } catch (x) {} }
      var a = new Audio(URL.createObjectURL(blob));
      suAnkiSes = a;
      a.onloadedmetadata = function () {
        var sure = isFinite(a.duration) ? a.duration : durum.ben.sure;
        if (bas !== undefined) {
          a.currentTime = bas * sure;
          var bitis = son * sure;
          var kontrol = setInterval(function () {
            if (a.currentTime >= bitis || a.paused) { a.pause(); clearInterval(kontrol); }
          }, 30);
        }
        a.play().catch(function () {});
      };
      /* metadata gelmezse yine de çal */
      a.play().catch(function () {});
      Uygulama.temizlemeEkle(function () { try { a.pause(); } catch (x) {} });
    }
    function dilimOynat(bas, son) { oynatBlob(durum.ben && durum.ben.blob, bas, son); }

    function duetOynat() {
      Ses.konus(durum.cumle.en, {
        baglam: 'en',
        bitti: function () { setTimeout(function () { oynatBlob(durum.ben.blob); }, 400); }
      });
    }

    addEventListener('resize', cizTuval);
    Uygulama.temizlemeEkle(function () { removeEventListener('resize', cizTuval); });
  };
})(window);
