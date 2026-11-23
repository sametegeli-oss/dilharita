/* dh-piper-isci.js — Piper ses üretimi AYRI İŞ PARÇACIĞINDA (Web Worker).
   Telefonda bir parçanın sese çevrilmesi saniyeler sürebiliyor; ana sayfada yapılınca sayfa donuyordu
   (ölçüm: 80 sn boyunca ne ses bitti ne zamanlayıcı çalıştı). Burada çalışınca sayfa, ağız ve çalma akmaya devam eder.
   dh-piper.js ile mesajlaşır:
     → { no, tip: 'kur', yol: { ort, ph, hf, phJs } }
     → { no, tip: 'hazirla', id, yol }          ← { no, tip: 'ilerle', ... } … ← { no, tamam: true }
     → { no, tip: 'sentezle', id, yol, metin, hiz } ← { no, pcm (Float32Array, aktarılır), hz, fonemMs, modelMs }
   Hata: ← { no, hata: 'mesaj' } */
'use strict';
var Y = null, KASA = 'dh-kalici-piper-v1';

async function kasa() { try { return await caches.open(KASA); } catch (e) { return null; } }
async function indir(url, ilerle) {
  var k = await kasa();
  if (k) { try { var r0 = await k.match(url); if (r0) return await r0.arrayBuffer(); } catch (e) {} }
  var r = await fetch(url, { mode: 'cors' });
  if (!r.ok) throw new Error('İndirilemedi (' + r.status + '): ' + url.split('/').pop());
  var toplam = +(r.headers.get('Content-Length') || 0), gelen = 0, parcalar = [];
  if (r.body && r.body.getReader) {
    var okur = r.body.getReader();
    for (;;) { var x = await okur.read(); if (x.done) break; parcalar.push(x.value); gelen += x.value.length; if (ilerle) ilerle(gelen, toplam); }
  } else { var ab0 = await r.arrayBuffer(); parcalar.push(new Uint8Array(ab0)); gelen = ab0.byteLength; }
  var tum = new Uint8Array(gelen), o = 0; parcalar.forEach(function (p) { tum.set(p, o); o += p.length; });
  if (k) { try { await k.put(url, new Response(tum.buffer, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(gelen) } })); } catch (e) {} }
  return tum.buffer;
}

var ortHazir = false;
function ortYukle() {
  if (!ortHazir) {
    importScripts(Y.ort + 'ort.wasm.min.js');
    self.ort.env.wasm.wasmPaths = Y.ort;
    self.ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
    ortHazir = true;
  }
  return self.ort;
}

var phSoz = null, phCikti = null;
function phYeni() {
  return import(Y.phJs).then(function (m) {
    return Promise.all([indir(Y.ph + 'piper_phonemize.wasm'), indir(Y.ph + 'piper_phonemize.data')]).then(function (r) {
      var veri = r[1];
      return m.createPiperPhonemize({
        wasmBinary: r[0], getPreloadedPackage: function () { return veri; },
        locateFile: function (u) { return Y.ph + u; },
        print: function (s) { if (phCikti) { var f = phCikti; phCikti = null; f(s); } }, printErr: function () {}
      });
    });
  });
}
function phHazir() { if (!phSoz) phSoz = phYeni().catch(function (e) { phSoz = null; throw e; }); return phSoz; }
var phYenilendi = 0;
async function fonemler(metin, ses) {
  var dene = async function () {
    var mod = await phHazir();
    return await new Promise(function (ok, hata) {
      phCikti = function (s) { try { ok(JSON.parse(s).phoneme_ids); } catch (e) { hata(e); } };
      try { mod.callMain(['-l', ses, '--input', JSON.stringify([{ text: metin }]), '--espeak_data', '/espeak-ng-data']); }
      catch (e) { phCikti = null; hata(e); }
      setTimeout(function () { if (phCikti) { phCikti = null; hata(new Error('fonem çıkmadı')); } }, 6000);
    });
  };
  try { return await dene(); } catch (e) { phSoz = null; phYenilendi++; return await dene(); }
}

var oturumlar = {};
function oturum(id, yol, ilerle) {
  if (oturumlar[id]) return oturumlar[id];
  oturumlar[id] = (async function () {
    var ort = ortYukle();
    var ayar = JSON.parse(new TextDecoder().decode(await indir(Y.hf + yol + '.json')));
    var model = await indir(Y.hf + yol, function (g, t) { if (ilerle) ilerle({ asama: 'indir', yuzde: t ? Math.round(g / t * 100) : null, mb: +(g / 1048576).toFixed(1), toplamMb: t ? +(t / 1048576).toFixed(1) : null }); });
    if (ilerle) ilerle({ asama: 'yukle' });
    var o = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
    await phHazir();
    return { ort: ort, oturum: o, ayar: ayar };
  })().catch(function (e) { delete oturumlar[id]; throw e; });
  return oturumlar[id];
}

async function sentezle(d) {
  var m = await oturum(d.id, d.yol), c = m.ayar, hiz = +d.hiz > 0.4 && +d.hiz < 2.5 ? +d.hiz : 1;
  var t0 = performance.now(), ids = await fonemler(d.metin, c.espeak.voice), t1 = performance.now();
  var T = m.ort.Tensor, f = {
    input: new T('int64', ids, [1, ids.length]),
    input_lengths: new T('int64', [ids.length]),
    scales: new T('float32', [c.inference.noise_scale, c.inference.length_scale / hiz, c.inference.noise_w])
  };
  if (c.speaker_id_map && Object.keys(c.speaker_id_map).length) f.sid = new T('int64', [0]);
  var cikti = await m.oturum.run(f), pcm = cikti.output.data, t2 = performance.now();
  pcm = pcm instanceof Float32Array ? new Float32Array(pcm) : Float32Array.from(pcm);
  /* ses düzeyi eşitleme (Türkçe model ~5 kat kısık) */
  var tepe = 0; for (var i = 0; i < pcm.length; i++) { var a = pcm[i] < 0 ? -pcm[i] : pcm[i]; if (a > tepe) tepe = a; }
  if (tepe > 0.01) { var kat = Math.min(8, 0.9 / tepe); if (Math.abs(kat - 1) > 0.05) for (var j = 0; j < pcm.length; j++) pcm[j] *= kat; }
  return { pcm: pcm, hz: c.audio.sample_rate, fonemMs: Math.round(t1 - t0), modelMs: Math.round(t2 - t1), phYenilendi: phYenilendi };
}

/* iş sırası: ses üretimi (sentezle) model hazırlığının (hazirla) önüne geçer; kendi aralarında geliş sırası.
   Açılışta Türkçe model yüklenince ilk cümle, İngilizce modelin yüklenmesini beklemeden üretilir. */
var isler = [], calisiyor = false;
function isYap(d) {
  if (d.tip === 'hazirla') return oturum(d.id, d.yol, function (x) { self.postMessage(Object.assign({ no: d.no, tip: 'ilerle' }, x)); }).then(function () { return { tamam: true }; });
  if (d.tip === 'sentezle') { if ((d.nesil || 0) < gecerliNesil) return Promise.reject(new Error('iptal')); return sentezle(d); }
  return Promise.reject(new Error('bilinmeyen iş: ' + d.tip));
}
function siradaki() {
  if (calisiyor || !isler.length) return;
  var k = -1; for (var i = 0; i < isler.length; i++) if (isler[i].d.tip === 'sentezle') { k = i; break; }
  var j = isler.splice(k < 0 ? 0 : k, 1)[0]; calisiyor = true;
  var p; try { p = isYap(j.d); } catch (e) { p = Promise.reject(e); }
  p.then(j.ok, j.hata).then(function () { calisiyor = false; siradaki(); });
}
var gecerliNesil = 0;   /* yeni cevap başlayınca eski cevabın sıradaki parçaları atlanır */
self.onmessage = function (e) {
  var d = e.data || {}, no = d.no;
  if (d.tip === 'kur') { Y = d.yol; self.postMessage({ no: no, tamam: true }); return; }
  if (d.tip === 'nesil') { gecerliNesil = Math.max(gecerliNesil, d.nesil || 0); return; }
  var is = new Promise(function (ok, hata) { isler.push({ d: d, ok: ok, hata: hata }); siradaki(); });
  is.then(function (r) {
    if (r && r.pcm) self.postMessage(Object.assign({ no: no }, r), [r.pcm.buffer]);
    else self.postMessage(Object.assign({ no: no }, r));
  }, function (err) { self.postMessage({ no: no, hata: (err && err.message) || String(err) }); });
};
