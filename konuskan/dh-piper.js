/* dh-piper.js — Deniz için CİHAZDA SES (Piper, rhasspy/piper; tarayıcıda WebAssembly).
   Neden: bazı telefonlarda tarayıcının ses motoru Türkçe ↔ İngilizce her geçişte 3-6 sn bekliyor
   (ölçüm: Ayarlar → Deniz'in sesi → Ses ölçümü). Piper sesi sayfanın içinde üretir, Web Audio ile çalar:
   dil geçişinde bekleme olmaz, ağız sesin kendisiyle oynar, ses modelleri indirildikten sonra internetsiz çalışır.

   Parçalar:
   - onnxruntime-web 1.18.0 (jsDelivr) — sinir ağı modeli
   - piper_phonemize (espeak-ng, ./piper-phonemize.js + wasm/veri jsDelivr'den) — metin → fonem
   - ses modelleri: huggingface.co/diffusionstudio/piper-voices (rhasspy/piper-voices kopyası)
   İndirilen dosyalar Cache Storage'da "dh-kalici-piper-v1" kasasında durur (sw.js bu kasayı silmez).

   API (window.DHPiper):
     SESLER                      — seçilebilir sesler { id: { dil, ad, yol } }
     secili(dil) / sec(dil, id)  — dil başına seçili ses (bu cihazda)
     hazirMi(dil)                — model belleğe yüklü mü
     indirildiMi(dil)            — Promise<bool> model kasada mı
     hazirla(dil, ilerle)        — indir + yükle (ilerle({yuzde, mb, toplamMb, asama}))
     sentezle(metin, dil, hiz)   — Promise<AudioBuffer>; istekler sırayla işlenir (önce gelen önce)
     sil()                       — indirilen sesleri cihazdan kaldır */
(function (global) {
  'use strict';
  var ORT_DIR = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
  var PH_DIR = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/';
  var HF = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/';
  var KASA = 'dh-kalici-piper-v1', SECIM = 'dh-piper-ses-v1';
  /* test için yollar değiştirilebilir (window.DH_PIPER_YOL = { ort, ph, hf }) */
  var Y = global.DH_PIPER_YOL || {};
  if (Y.ort) ORT_DIR = Y.ort; if (Y.ph) PH_DIR = Y.ph; if (Y.hf) HF = Y.hf;
  var BU = (document.currentScript && document.currentScript.src) || location.href;

  var SESLER = {
    'tr_TR-dfki-medium': { dil: 'tr', ad: 'Türkçe · dfki (erkek)', yol: 'tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx' },
    'tr_TR-fahrettin-medium': { dil: 'tr', ad: 'Türkçe · Fahrettin (erkek)', yol: 'tr/tr_TR/fahrettin/medium/tr_TR-fahrettin-medium.onnx' },
    'tr_TR-fettah-medium': { dil: 'tr', ad: 'Türkçe · Fettah (erkek)', yol: 'tr/tr_TR/fettah/medium/tr_TR-fettah-medium.onnx' },
    'en_GB-alan-low': { dil: 'en', ad: 'İngilizce (UK) · Alan (erkek, hafif)', yol: 'en/en_GB/alan/low/en_GB-alan-low.onnx' },
    'en_GB-alan-medium': { dil: 'en', ad: 'İngilizce (UK) · Alan (erkek)', yol: 'en/en_GB/alan/medium/en_GB-alan-medium.onnx' },
    'en_GB-northern_english_male-medium': { dil: 'en', ad: 'İngilizce (UK) · Kuzey (erkek)', yol: 'en/en_GB/northern_english_male/medium/en_GB-northern_english_male-medium.onnx' },
    'en_US-ryan-medium': { dil: 'en', ad: 'İngilizce (US) · Ryan (erkek)', yol: 'en/en_US/ryan/medium/en_US-ryan-medium.onnx' },
    'en_US-joe-medium': { dil: 'en', ad: 'İngilizce (US) · Joe (erkek)', yol: 'en/en_US/joe/medium/en_US-joe-medium.onnx' }
  };
  var VARSAYILAN = { tr: 'tr_TR-dfki-medium', en: 'en_GB-alan-low' };

  function secimOku() { try { return JSON.parse(localStorage.getItem(SECIM) || '{}') || {}; } catch (e) { return {}; } }
  function secili(dil) { var s = secimOku()[dil]; return SESLER[s] && SESLER[s].dil === dil ? s : VARSAYILAN[dil]; }
  function sec(dil, id) { if (!SESLER[id] || SESLER[id].dil !== dil) return; var s = secimOku(); s[dil] = id; try { localStorage.setItem(SECIM, JSON.stringify(s)); } catch (e) {} }

  /* ---------- indirme + kasa ---------- */
  async function kasa() { try { return await caches.open(KASA); } catch (e) { return null; } }
  async function kasadaMi(url) { var k = await kasa(); if (!k) return false; try { return !!(await k.match(url)); } catch (e) { return false; } }
  async function indir(url, ilerle) {
    var k = await kasa();
    if (k) { try { var r0 = await k.match(url); if (r0) return await r0.arrayBuffer(); } catch (e) {} }
    var r = await fetch(url, { mode: 'cors' });
    if (!r.ok) throw new Error('İndirilemedi (' + r.status + '): ' + url.split('/').pop());
    var toplam = +(r.headers.get('Content-Length') || 0), gelen = 0, parcalar = [];
    if (r.body && r.body.getReader) {
      var okur = r.body.getReader();
      for (;;) { var x = await okur.read(); if (x.done) break; parcalar.push(x.value); gelen += x.value.length; if (ilerle) ilerle(gelen, toplam); }
    } else { var ab0 = await r.arrayBuffer(); parcalar.push(new Uint8Array(ab0)); gelen = ab0.byteLength; if (ilerle) ilerle(gelen, toplam || gelen); }
    var tum = new Uint8Array(gelen), o = 0; parcalar.forEach(function (p) { tum.set(p, o); o += p.length; });
    if (k) { try { await k.put(url, new Response(tum.buffer, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(gelen) } })); } catch (e) {} }
    return tum.buffer;
  }

  /* ---------- onnxruntime ---------- */
  var ortSoz = null;
  function ortYukle() {
    if (ortSoz) return ortSoz;
    ortSoz = new Promise(function (ok, hata) {
      if (global.ort && global.ort.InferenceSession) return ok(global.ort);
      var s = document.createElement('script'); s.src = ORT_DIR + 'ort.wasm.min.js'; s.async = true;
      s.onload = function () { global.ort ? ok(global.ort) : hata(new Error('onnxruntime yüklenemedi')); };
      s.onerror = function () { ortSoz = null; hata(new Error('onnxruntime indirilemedi (internet?)')); };
      document.head.appendChild(s);
    }).then(function (ort) {
      ort.env.wasm.wasmPaths = ORT_DIR;
      /* çok iş parçacığı yalnız "cross-origin isolated" sayfada çalışır (GitHub Pages değil) */
      ort.env.wasm.numThreads = global.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
      return ort;
    });
    return ortSoz;
  }

  /* ---------- fonemleyici (espeak-ng): tek modül, tekrar tekrar çalıştırılır ---------- */
  var phSoz = null, phCikti = null;
  function phYeni() {
    return import(new URL('./piper-phonemize.js', BU).href).then(function (m) {
      return Promise.all([indir(PH_DIR + 'piper_phonemize.wasm'), indir(PH_DIR + 'piper_phonemize.data')]).then(function (r) {
        var veri = r[1];
        return m.createPiperPhonemize({
          wasmBinary: r[0],
          getPreloadedPackage: function () { return veri; },
          locateFile: function (u) { return PH_DIR + u; },
          print: function (s) { if (phCikti) { var f = phCikti; phCikti = null; f(s); } },
          printErr: function () {}
        });
      });
    });
  }
  function phHazir() { if (!phSoz) phSoz = phYeni().catch(function (e) { phSoz = null; throw e; }); return phSoz; }
  async function fonemler(metin, espeakSes) {
    var dene = async function () {
      var mod = await phHazir();
      return await new Promise(function (ok, hata) {
        phCikti = function (s) { try { ok(JSON.parse(s).phoneme_ids); } catch (e) { hata(e); } };
        try { mod.callMain(['-l', espeakSes, '--input', JSON.stringify([{ text: metin }]), '--espeak_data', '/espeak-ng-data']); }
        catch (e) { phCikti = null; hata(e); }
        setTimeout(function () { if (phCikti) { phCikti = null; hata(new Error('fonem çıkmadı')); } }, 4000);
      });
    };
    try { return await dene(); }
    catch (e) { phSoz = null; return await dene(); }   /* modül bozulduysa bir kez yeniden kur */
  }

  /* ---------- modeller ---------- */
  var oturumlar = {};   /* id → Promise<{ ort, oturum, ayar }> */
  function oturum(id, ilerle) {
    if (oturumlar[id]) return oturumlar[id];
    var s = SESLER[id]; if (!s) return Promise.reject(new Error('Bilinmeyen ses: ' + id));
    oturumlar[id] = (async function () {
      var ort = await ortYukle();
      var ayar = JSON.parse(new TextDecoder().decode(await indir(HF + s.yol + '.json')));
      var model = await indir(HF + s.yol, function (g, t) { if (ilerle) ilerle({ asama: 'indir', yuzde: t ? Math.round(g / t * 100) : null, mb: +(g / 1048576).toFixed(1), toplamMb: t ? +(t / 1048576).toFixed(1) : null }); });
      if (ilerle) ilerle({ asama: 'yukle' });
      var o = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
      await phHazir();
      return { ort: ort, oturum: o, ayar: ayar };
    })().catch(function (e) { delete oturumlar[id]; throw e; });
    return oturumlar[id];
  }
  /* ---------- ayrı iş parçacığı (Web Worker): ses üretimi sayfayı dondurmasın ---------- */
  var isci = null, isciNo = 0, bekleyen = {};
  function isciAl() {
    if (isci === false) return null; if (isci) return isci;
    try {
      isci = new Worker(new URL('./dh-piper-isci.js?v=2', BU).href);
      isci.onmessage = function (e) {
        var d = e.data || {}, b = bekleyen[d.no]; if (!b) return;
        if (d.tip === 'ilerle') { if (b.ilerle) b.ilerle(d); return; }
        delete bekleyen[d.no]; if (d.hata) b.hata(new Error(d.hata)); else b.ok(d);
      };
      isci.onerror = function (ev) { var hata = new Error('ses iş parçacığı: ' + ((ev && ev.message) || 'hata')); isci = false; Object.keys(bekleyen).forEach(function (k) { bekleyen[k].hata(hata); }); bekleyen = {}; };
      isci.postMessage({ no: 0, tip: 'kur', yol: { ort: ORT_DIR, ph: PH_DIR, hf: HF, phJs: new URL('./piper-phonemize.js', BU).href } });
    } catch (e) { isci = false; return null; }
    return isci;
  }
  function isciIs(msg, ilerle) {
    return new Promise(function (ok, hata) { var no = ++isciNo; bekleyen[no] = { ok: ok, hata: hata, ilerle: ilerle }; msg.no = no; isci.postMessage(msg); });
  }
  /* iş parçacığında herhangi bir hata: bir daha deneme, sesi sayfanın kendisinde üret (cihaz sesi kapanmasın) */
  function isciBirak(e) {
    DHPiper.isciHata = (e && e.message) || String(e);
    try { if (isci) isci.terminate(); } catch (er) {}
    isci = false; Object.keys(bekleyen).forEach(function (k) { bekleyen[k].hata(e); }); bekleyen = {};
    try { console.warn('[DHPiper] iş parçacığı kapatıldı, sayfada devam:', DHPiper.isciHata); } catch (er) {}
  }
  function isciIsSureli(msg, ilerle, ms) {
    return Promise.race([isciIs(msg, ilerle), new Promise(function (_, h) { setTimeout(function () { h(new Error('iş parçacığı ' + Math.round(ms / 1000) + ' sn yanıt vermedi')); }, ms); })]);
  }
  function hazirla(dil, ilerle) {
    var id = secili(dil);
    if (isciAl()) return isciIsSureli({ tip: 'hazirla', id: id, yol: SESLER[id].yol }, ilerle, 600000).then(function () { yuklu[id] = true; return true; })
      .catch(function (e) { isciBirak(e); return oturum(id, ilerle).then(function () { return true; }); });
    return oturum(id, ilerle).then(function () { return true; });
  }
  /* yeni cevap: eski cevabın henüz başlamamış parçalarını atla (telefon boşuna uğraşmasın) */
  var nesil = 0;
  function iptal() { nesil++; if (isci) try { isci.postMessage({ tip: 'nesil', nesil: nesil }); } catch (e) {} }
  var gunluk = [];
  function gunlukYaz(o) { gunluk.push(o); if (gunluk.length > 30) gunluk.shift(); DHPiper.son = o; }
  var yuklu = {};
  function hazirMi(dil) { return !!yuklu[secili(dil)]; }
  function indirildiMi(dil) { var s = SESLER[secili(dil)]; return kasadaMi(HF + s.yol); }

  /* ---------- sentez (sırayla) ---------- */
  var sira = Promise.resolve();
  function sentezle(metin, dil, hiz) {
    hiz = +hiz > 0.4 && +hiz < 2.5 ? +hiz : 1;
    metin = String(metin || '').replace(/\s+/g, ' ').trim();
    var id = secili(dil === 'tr' ? 'tr' : 'en');
    if (metin && isciAl()) {
      var t0 = performance.now();
      return isciIsSureli({ tip: 'sentezle', id: id, yol: SESLER[id].yol, metin: metin, hiz: hiz, nesil: nesil }, null, 900000).then(function (r) {
        yuklu[id] = true;
        var buf = new AudioBuffer({ length: r.pcm.length, numberOfChannels: 1, sampleRate: r.hz }); buf.copyToChannel(r.pcm, 0);
        gunlukYaz({ z: new Date().toISOString().slice(11, 19), m: metin.slice(0, 30), dil: dil, fonemMs: r.fonemMs, modelMs: r.modelMs, sn: +(r.pcm.length / r.hz).toFixed(2), toplamMs: Math.round(performance.now() - t0), isci: true, phYenilendi: r.phYenilendi });
        return buf;
      }, function (e) { if (e && e.message === 'iptal') throw e; isciBirak(e); return sentezle(metin, dil, hiz); });   /* sayfada yeniden dene */
    }
    var is = sira.then(async function () {
      if (!metin) throw new Error('boş metin');
      var t0 = performance.now();
      var m = await oturum(id); yuklu[id] = true;
      var c = m.ayar, ids = await fonemler(metin, c.espeak.voice);
      var T = m.ort.Tensor, f = {
        input: new T('int64', ids, [1, ids.length]),
        input_lengths: new T('int64', [ids.length]),
        scales: new T('float32', [c.inference.noise_scale, c.inference.length_scale / hiz, c.inference.noise_w])   /* hız: konuşma hızı ayarı */
      };
      if (c.speaker_id_map && Object.keys(c.speaker_id_map).length) f.sid = new T('int64', [0]);
      var cikti = await m.oturum.run(f), pcm = cikti.output.data;
      /* ses düzeyi eşitleme: Türkçe model İngilizceden ~5 kat kısık çıkıyor (tepe 0,15 / 0,8); her parça tepe 0,9'a getirilir */
      pcm = pcm instanceof Float32Array ? pcm : Float32Array.from(pcm);
      var tepe = 0; for (var i = 0; i < pcm.length; i++) { var a = pcm[i] < 0 ? -pcm[i] : pcm[i]; if (a > tepe) tepe = a; }
      if (tepe > 0.01) { var kat = Math.min(8, 0.9 / tepe); if (Math.abs(kat - 1) > 0.05) for (var j = 0; j < pcm.length; j++) pcm[j] *= kat; }
      var hz = c.audio.sample_rate, buf = new AudioBuffer({ length: pcm.length, numberOfChannels: 1, sampleRate: hz });
      buf.copyToChannel(pcm, 0);
      gunlukYaz({ z: new Date().toISOString().slice(11, 19), m: metin.slice(0, 30), dil: dil, sn: +(pcm.length / hz).toFixed(2), toplamMs: Math.round(performance.now() - t0), isci: false });
      return buf;
    });
    sira = is.catch(function () {});
    return is;
  }

  async function sil() { oturumlar = {}; yuklu = {}; try { if (isci) isci.terminate(); } catch (e) {} isci = null; bekleyen = {}; try { await caches.delete(KASA); } catch (e) {} }

  var DHPiper = global.DHPiper = { iptal: iptal, isciHata: null, gunluk: function () { return gunluk.slice(); }, SESLER: SESLER, VARSAYILAN: VARSAYILAN, secili: secili, sec: sec, hazirMi: hazirMi, indirildiMi: indirildiMi, hazirla: hazirla, sentezle: sentezle, sil: sil, son: null };
})(window);
