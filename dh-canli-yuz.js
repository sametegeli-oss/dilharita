/* dh-canli-yuz.js — Dil Harita "canlı yüz" avatar motoru (deneme, v1)
   ====================================================================
   ESKİ SİSTEMİN SINIRLARI (ölçüldü, 17 Kasım)
     - Her ağız şekli ayrı üretilmiş TAM bir fotoğraftı; kareler birbirine
       hizalı değildi (yüz 18 px'e kadar kayıyor, %3 büyüyüp küçülüyordu)
       → konuşurken yüz titriyordu.
     - Sadece ağız oynuyordu; kaş, göz, baş ve duygu yoktu.

   BU MOTOR
     1) TEK taban fotoğraf + tabana hizalanmış, yumuşak kenarlı ağız/göz
        parçaları (assets/avatars_v4/<avatar>/). Yüz artık hiç kaymaz.
     2) Fotoğraf WebGL'de bir ızgara örgüsüyle gerçek zamanlı ESNETİLİR:
        kaşlar, göz kapakları, dudak köşeleri (gülümseme/üzüntü), bakış,
        baş eğme / sallama / çevirme ve öne eğilme sürekli değerlerle oynar.
     3) Duygu ön ayarları + jestler + boşta canlılık (nefes, göz kırpma,
        küçük baş hareketleri, bakış kaymaları).
     4) Konuşma: metin cümlelere bölünür; her cümle kendi duygusu ve
        jestiyle okunur. Ağız şekilleri DHViseme (viseme-lang.js) varsa
        dile duyarlı, yoksa basit eşlemeyle seçilir.

   API
     var y = DHCanliYuz.olustur(canvas, { yol: "./assets/avatars_v4/teacher/" });
     y.hazir.then(...)
     y.duygu(ad, guc, sureMs)      // "notr","mutlu","cesaret","merak","dusunceli","dinleyen","sefkatli","karisik","heyecanli","uzgun","ofkeli",
                                   // "anlayisli","saskin","ciddi","gururlu"
     y.jest(ad)                    // "onay","hayir","egil","one_egil","dusun","kas","iki_onay"
     y.ayar(parametreler)          // ham parametreler (kaydırıcılar için)
     y.profil({ifade, enerji, jest})   // 0..1 değerleri
     y.konus(cumleler, {ses, hiz}) // [{metin, duygu, guc, jest, dil}] → Promise
     y.sustur(); y.dinle(acik); y.yikil();
*/
(function (global) {
  "use strict";
  if (global.DHCanliYuz) return;

  /* ---------- Duygu ön ayarları (hedef parametreler) ---------- */
  var DUYGULAR = {
    notr:      {},
    mutlu:     { smile: 0.95, squint: 0.45, browOuterUp: 0.15, roll: 2.0, pitch: -0.08 },
    cesaret:   { smile: 0.6, browInnerUp: 0.35, browOuterUp: 0.2, roll: 1.5, lean: 0.25 },
    merak:     { browInnerUp: 0.55, browOuterUp: 0.6, roll: 5.0, lean: 0.55, smile: 0.15, gazeY: -0.1 },
    dusunceli: { browDown: 0.25, browAsym: 0.35, gazeX: -0.55, gazeY: -0.55, roll: -3.0, frown: 0.1, yaw: -0.15 },
    anlayisli: { browInnerUp: 0.75, smile: 0.25, roll: 4.5, squint: 0.15, pitch: 0.1 },
    saskin:    { browInnerUp: 1.0, browOuterUp: 1.0, squint: -0.6, pitch: -0.15, lean: -0.2 },
    ciddi:     { browDown: 0.55, frown: 0.25, squint: 0.25, pitch: 0.12 },
    gururlu:   { smile: 0.75, pitch: -0.25, browOuterUp: 0.25, roll: -1.5 },
    dinleyen:  { smile: 0.2, browInnerUp: 0.2, lean: 0.3, roll: 2.5 },
    sefkatli:  { smile: 0.35, browInnerUp: 0.5, roll: 3.5, squint: 0.1, pitch: 0.05 },
    karisik:   { browAsym: 0.6, browDown: 0.15, frown: 0.15, roll: -4.0, gazeX: 0.1 },
    heyecanli: { smile: 1.0, browOuterUp: 0.4, browInnerUp: 0.3, lean: 0.35, pitch: -0.1 },
    uzgun:     { browInnerUp: 0.8, frown: 0.3, pitch: 0.15, gazeY: 0.15 },
    ofkeli:    { browDown: 0.8, frown: 0.4, squint: 0.35, pitch: 0.1 }
  };
  var DUYGU_ADI = { notr: "Nötr", mutlu: "Mutlu", cesaret: "Cesaretlendirici", merak: "Merak", dusunceli: "Düşünceli",
    anlayisli: "Anlayışlı", saskin: "Şaşkın", ciddi: "Ciddi", gururlu: "Gururlu",
    dinleyen: "Dinleyen", sefkatli: "Şefkatli", karisik: "Kafası karışık", heyecanli: "Heyecanlı", uzgun: "Üzgün", ofkeli: "Öfkeli" };
  var PARAMS = ["smile","frown","browInnerUp","browOuterUp","browDown","browAsym","squint","gazeX","gazeY","roll","pitch","yaw","lean"];

  /* ---------- Jestler: zamana bağlı eklemeler ---------- */
  function egri(t, noktalar) {   // [[t,v],...] doğrusal + yumuşatma
    if (t <= noktalar[0][0]) return noktalar[0][1];
    for (var i = 1; i < noktalar.length; i++) {
      if (t <= noktalar[i][0]) {
        var a = noktalar[i - 1], b = noktalar[i], u = (t - a[0]) / (b[0] - a[0]);
        u = u * u * (3 - 2 * u);
        return a[1] + (b[1] - a[1]) * u;
      }
    }
    return noktalar[noktalar.length - 1][1];
  }
  var JESTLER = {
    onay:     { sure: 650,  f: function (t) { return { pitch: egri(t, [[0,0],[0.3,0.55],[0.65,-0.08],[1,0]]) }; } },
    iki_onay: { sure: 1100, f: function (t) { return { pitch: egri(t, [[0,0],[0.18,0.5],[0.38,0],[0.58,0.45],[0.8,-0.05],[1,0]]) }; } },
    hayir:    { sure: 900,  f: function (t) { return { yaw: egri(t, [[0,0],[0.2,0.35],[0.45,-0.35],[0.7,0.25],[1,0]]) }; } },
    egil:     { sure: 1400, f: function (t) { return { roll: egri(t, [[0,0],[0.25,6],[0.75,6],[1,0]]) }; } },
    one_egil: { sure: 1600, f: function (t) { return { lean: egri(t, [[0,0],[0.25,0.8],[0.75,0.8],[1,0]]) }; } },
    dusun:    { sure: 1500, f: function (t) { var v = egri(t, [[0,0],[0.2,1],[0.8,1],[1,0]]); return { gazeX: -0.6 * v, gazeY: -0.6 * v, browAsym: 0.4 * v, roll: -2 * v }; } },
    kas:      { sure: 500,  f: function (t) { var v = egri(t, [[0,0],[0.3,1],[0.6,1],[1,0]]); return { browInnerUp: 0.7 * v, browOuterUp: 0.7 * v }; } },
    /* vurgu: vurgulu kelimede küçük baş inişi + kaş kalkması (konuşurken kendiliğinden) */
    vurgu:    { sure: 420,  f: function (t) { var v = egri(t, [[0,0],[0.3,1],[1,0]]); return { pitch: 0.2 * v, browInnerUp: 0.35 * v, browOuterUp: 0.3 * v }; } }
  };
  var JEST_ADI = { vurgu: "Vurgu", onay: "Baş sallama", iki_onay: "İki kez onay", hayir: "Hayır (baş çevirme)", egil: "Başı yana eğme",
    one_egil: "Öne eğilme", dusun: "Düşünme (yukarı bakış)", kas: "Kaş kaldırma" };

  /* ---------- Viseme → parça ---------- */
  var BASIT = { a: "a", e: "e", i: "i", o: "o", u: "u", ö: "o", ü: "u", ı: "i",
    m: "mbp", b: "mbp", p: "mbp", f: "fv", v: "fv", l: "l", r: "e", w: "u", y: "i",
    s: "i", z: "i", t: "e", d: "e", n: "e", k: "e", g: "e", c: "e", ç: "e", ş: "u", j: "u", h: "a" };
  function basitDizi(metin) {
    var out = [], s = String(metin || "").toLowerCase();
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === "t" && s[i + 1] === "h") { out.push("th"); i++; continue; }
      if (/[.!?…]/.test(c)) { out.push("idle", "idle", "idle"); continue; }
      if (/[,;:]/.test(c)) { out.push("idle"); continue; }
      if (c === " ") { if (out[out.length - 1] !== "idle" && Math.random() < 0.3) out.push("idle"); continue; }
      out.push(BASIT[c] || "e");
    }
    return out;
  }
  function visemeDizi(metin, dil) {
    try {
      if (global.DHViseme && DHViseme.shapes) {
        var sh = DHViseme.shapes(metin, dil === "tr" ? "tr" : "en");
        if (sh && sh.length) { var d = sh.map(function (x) { return x.shape || x; }); d.ci = sh.map(function (x) { return x.ci || 0; }); return d; }
      }
    } catch (e) {}
    return basitDizi(metin);
  }

  var sinirVar = false;   /* tarayıcı kelime sınırı (onboundary) bildiriyor mu — ilk bildirimde öğrenilir */
  /* ---------- Yardımcılar ---------- */
  /* avatar görsellerinin sürümü: görseller yenilenince artır (önbellekte eski kopya kalmasın) */
  var GORSEL_SURUM = "20261119a";
  function yukle(src) { if (src.indexOf("?") < 0 && !/^(data|blob):/.test(src)) src += "?v=" + GORSEL_SURUM; return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { (im.decode ? im.decode() : Promise.resolve()).then(function () { res(im); }, function () { res(im); }); }; im.onerror = rej; im.src = src; }); }
  function ort(P, ids) { var x = 0, y = 0; ids.forEach(function (i) { x += P[i][0]; y += P[i][1]; }); return [x / ids.length, y / ids.length]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  var hareketAz = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function olustur(canvas, sec) {
    sec = sec || {};
    var yol = sec.yol || "./assets/avatars_v4/teacher/";
    var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: !!sec.ekranGoruntusu });
    var durum = { hazir: false, yikildi: false };
    var face, W, H, taban, parcalar = {};
    var cmp = document.createElement("canvas"), cx;
    var N = 96, verts, uvs, idx, temel, headW, faceW, gozW, kollar = [], maskeImg = null;
    var prog, posBuf, uvBuf, idxBuf, tex, uLoc;

    /* parametre durumu */
    var cur = {}, hedef = {}, ham = {};
    PARAMS.forEach(function (p) { cur[p] = 0; hedef[p] = 0; ham[p] = 0; });
    var profil = { ifade: 0.7, enerji: 0.55, jest: 0.6 };
    var aktifJestler = [];
    var agiz = { a: "idle", b: "idle", t: 1 }, gozKirp = 0;
    /* duygu fotoğrafları: her duygu için ayrı, tabana hizalı fotoğraf (varsa) */
    var fotolar = {}, agizSetleri = {}, kirpSetleri = {}, foto = { a: "notr", b: "notr", t: 1 }, fotoAcik = sec.fotolar !== false;
    var YUZ_P = ["smile", "frown", "browInnerUp", "browOuterUp", "browDown", "browAsym", "squint"];
    function baskin() { return foto.t >= 0.5 ? foto.b : foto.a; }
    /* eksik ağız şekli: önce aynı duygu setinde en yakın şekle, sonra nötr sete düş (ör. setinde "sz" yoksa "i") */
    var YEDEK = { sz: ["i", "e"], sc: ["u", "o"], tdn: ["i", "e"], kg: ["e", "a"], th: ["i"], fv: ["mbp"], l: ["e"], u: ["o"], o: ["u"], a: ["e"], e: ["a"], i: ["e"] };
    function agizParca(sekil) {
      var d = baskin(), set = (face.duyguAgiz && agizSetleri[face.duyguAgiz[d]]) || parcalar;
      var zincir = [sekil].concat(YEDEK[sekil] || []);
      for (var i = 0; i < zincir.length; i++) if (set[zincir[i]]) return set[zincir[i]];
      for (i = 0; i < zincir.length; i++) if (parcalar[zincir[i]]) return parcalar[zincir[i]];
      return null;
    }
    function kirpParca() { var d = baskin(); return (face.duyguKirpma && kirpSetleri[face.duyguKirpma[d]]) || parcalar.blink; }
    function fotoHedef(ad) { if (!fotolar[ad]) ad = "notr"; if (ad === foto.b) return; foto.a = foto.t >= 0.5 ? foto.b : foto.a; foto.b = ad; foto.t = 0; }
    var konusma = null, dinleme = false;
    var t0 = performance.now(), sonKirp = t0, sonrakiKirp = t0 + 2500, sakkad = { x: 0, y: 0, t: t0 + 1500 }, bakisKac = t0 + 5000, sonVurgu = 0;
    /* Gerçek ses (Gemini) çalmak için ses bağlamı + çözümleyici: ağız sesin şiddetiyle oynar */
    var sesAc = null, sesAnaliz = null, sesVeri = null;
    function sesBagi() {
      if (!sesAc) { var AC = global.AudioContext || global.webkitAudioContext; if (!AC) return null; sesAc = new AC(); sesAnaliz = sesAc.createAnalyser(); sesAnaliz.fftSize = 1024; sesAnaliz.connect(sesAc.destination); sesVeri = new Float32Array(sesAnaliz.fftSize); }
      if (sesAc.state === "suspended") { try { sesAc.resume(); } catch (e) {} }
      return sesAc;
    }
    function sesSeviye() { if (!sesAnaliz) return 0; sesAnaliz.getFloatTimeDomainData(sesVeri); var t = 0; for (var i = 0; i < sesVeri.length; i++) t += sesVeri[i] * sesVeri[i]; return Math.sqrt(t / sesVeri.length); }
    function vurgula(simdi) { if (simdi - sonVurgu < 1100) return; sonVurgu = simdi; api.jest("vurgu", 0.6 + profil.ifade * 0.5); }

    /* ---------------- WebGL kurulum ---------------- */
    function shader(tip, kaynak) { var s = gl.createShader(tip); gl.shaderSource(s, kaynak); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    function kur() {
      var vs = "attribute vec2 aPos; attribute vec2 aUV; uniform vec2 uSize; uniform vec3 uCam; varying vec2 vUV;" +
        "void main(){ vec2 p=(aPos-uCam.xy)*uCam.z+uCam.xy; vec2 c=p/uSize*2.0-1.0; gl_Position=vec4(c.x,-c.y,0.0,1.0); vUV=aUV; }";
      var fs = "precision mediump float; varying vec2 vUV; uniform sampler2D uTex; void main(){ gl_FragColor=texture2D(uTex,vUV); }";
      prog = gl.createProgram(); gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog); gl.useProgram(prog);
      uLoc = { size: gl.getUniformLocation(prog, "uSize"), cam: gl.getUniformLocation(prog, "uCam") };
      /* ızgara */
      var n1 = N + 1; temel = new Float32Array(n1 * n1 * 2); uvs = new Float32Array(n1 * n1 * 2); verts = new Float32Array(n1 * n1 * 2);
      for (var j = 0; j <= N; j++) for (var i = 0; i <= N; i++) { var k = (j * n1 + i) * 2; temel[k] = i / N * W; temel[k + 1] = j / N * H; uvs[k] = i / N; uvs[k + 1] = j / N; }
      var ix = []; for (j = 0; j < N; j++) for (i = 0; i < N; i++) { var a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1; ix.push(a, b, c, b, d, c); }
      idx = new Uint16Array(ix);
      posBuf = gl.createBuffer(); uvBuf = gl.createBuffer(); idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
      var aUV = gl.getAttribLocation(prog, "aUV"); gl.enableVertexAttribArray(aUV); gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform2f(uLoc.size, W, H);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    /* ---------------- Yüz kolları (deformasyon tutamakları) ---------------- */
    function kollariKur() {
      var P = face.noktalar68;
      var gozL = ort(P, [36, 37, 38, 39, 40, 41]), gozR = ort(P, [42, 43, 44, 45, 46, 47]);
      var yanakL = [(P[31][0] + P[2][0]) / 2 + 6, (P[31][1] + P[2][1]) / 2 + 18], yanakR = [(P[35][0] + P[14][0]) / 2 - 6, (P[35][1] + P[14][1]) / 2 + 18];
      var iod = gozR[0] - gozL[0];            /* gözler arası: ölçek */
      var s = iod / 165;                      /* öğretmen fotoğrafında ~165 px */
      function kol(ad, nokta, sx, sy, syAlt, koru) { kollar.push({ ad: ad, x: nokta[0], y: nokta[1], sx: sx * s, sy: sy * s, syAlt: (syAlt || sy) * s, koru: !!koru, dx: 0, dy: 0 }); }
      /* kaşlar: yukarıya (alına) geniş, aşağıya (gözlüğe) çok dar etki eder */
      kol("kasIcL", P[21], 22, 14, 3.5, true); kol("kasIcR", P[22], 22, 14, 3.5, true);
      kol("kasOrtaL", P[19], 24, 14, 3.5, true); kol("kasOrtaR", P[24], 24, 14, 3.5, true);
      kol("kasDisL", P[17], 22, 14, 3.5, true); kol("kasDisR", P[26], 22, 14, 3.5, true);
      kol("ustKapakL", ort(P, [37, 38]), 16, 6); kol("ustKapakR", ort(P, [43, 44]), 16, 6);
      kol("altKapakL", ort(P, [40, 41]), 16, 6); kol("altKapakR", ort(P, [46, 47]), 16, 6);
      kol("irisL", gozL, 7, 6); kol("irisR", gozR, 7, 6);
      kol("koseL", P[48], 15, 13, 13, true); kol("koseR", P[54], 15, 13, 13, true);
      kol("yanakL", yanakL, 26, 22, 22, true); kol("yanakR", yanakR, 26, 22, 22, true);
      kol("ustDudak", P[51], 18, 8, 8, true); kol("altDudak", P[57], 18, 9, 9, true);
      /* baş maskesi: fotoğraftan çıkarılmış (baş + saç = 1, boyun yumuşak, omuz = 0).
         Saç ve baş birlikte, bozulmadan döner; fon saydam olduğu için arkada bükülme olmaz. */
      var merkez = [ (P[0][0] + P[16][0]) / 2, (P[19][1] + P[8][1]) / 2 - 20 * s ];
      var rx = (P[16][0] - P[0][0]) * 0.72, ry = (P[8][1] - P[19][1]) * 1.1;
      var pivot = [merkez[0], P[8][1] + 40 * s];
      var n1 = N + 1; headW = new Float32Array(n1 * n1); faceW = new Float32Array(n1 * n1); gozW = new Float32Array(n1 * n1);
      var burun = P[30], md = null, mw = 0, mh = 0;
      if (maskeImg) { var mc = document.createElement("canvas"); mw = mc.width = maskeImg.naturalWidth; mh = mc.height = maskeImg.naturalHeight; var mx = mc.getContext("2d"); mx.drawImage(maskeImg, 0, 0); md = mx.getImageData(0, 0, mw, mh).data; }
      function maske(x, y) {
        var u = Math.max(0, Math.min(mw - 1.001, x / W * mw - 0.5)), v = Math.max(0, Math.min(mh - 1.001, y / H * mh - 0.5));
        var i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
        function g(a, b) { return md[((b * mw) + a) * 4] / 255; }
        return (g(i, j) * (1 - fu) + g(i + 1, j) * fu) * (1 - fv) + (g(i, j + 1) * (1 - fu) + g(i + 1, j + 1) * fu) * fv;
      }
      var gz = face.gozluk, ss = function (e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
      for (var v = 0; v < n1 * n1; v++) {
        var x = temel[v * 2], y = temel[v * 2 + 1], w;
        if (md) w = maske(x, y);
        else { var dx = (x - merkez[0]) / rx, dy = (y - merkez[1]) / ry, r = Math.sqrt(dx * dx + dy * dy); w = r < 0.8 ? 1 : r > 1.2 ? 0 : 1 - (r - 0.8) / 0.4; w = w * w * (3 - 2 * w); }
        headW[v] = w;
        var fx = (x - burun[0]) / (rx * 0.55), fy = (y - burun[1]) / (ry * 0.5);
        faceW[v] = Math.exp(-(fx * fx + fy * fy));
        /* gözlük bölgesi: kaş / yanak / ağız hareketleri gözlüğü esnetmesin */
        gozW[v] = gz ? ss(gz[0] - 6, gz[0] + 6, x) * (1 - ss(gz[2] - 6, gz[2] + 6, x)) * ss(gz[1] - 4, gz[1] + 6, y) * (1 - ss(gz[3] - 6, gz[3] + 6, y)) : 0;
      }
      durum.pivot = pivot; durum.s = s; durum.merkez = merkez;
    }

    /* parametre → kol yer değiştirmeleri (px, taban ölçeğinde) */
    function kollariAyarla(p) {
      var s = durum.s, K = {};
      kollar.forEach(function (k) { k.dx = 0; k.dy = 0; K[k.ad] = k; });
      var ic = p.browInnerUp * 17 - p.browDown * 10, dis = p.browOuterUp * 15 - p.browDown * 3, asym = p.browAsym * 12;
      K.kasIcL.dy -= ic * s; K.kasIcR.dy -= ic * s;
      K.kasIcL.dx += p.browDown * 5 * s; K.kasIcR.dx -= p.browDown * 5 * s;
      K.kasOrtaL.dy -= (ic + dis) * 0.5 * s + asym * s; K.kasOrtaR.dy -= (ic + dis) * 0.5 * s - asym * 0.4 * s;
      K.kasDisL.dy -= dis * s + asym * s; K.kasDisR.dy -= dis * s;
      var sq = p.squint + p.smile * 0.35;
      K.altKapakL.dy -= sq * 4.5 * s; K.altKapakR.dy -= sq * 4.5 * s;
      K.ustKapakL.dy += Math.max(0, sq) * 1.5 * s - Math.max(0, -p.squint) * 2.5 * s - p.browInnerUp * 1 * s;
      K.ustKapakR.dy += Math.max(0, sq) * 1.5 * s - Math.max(0, -p.squint) * 2.5 * s - p.browInnerUp * 1 * s;
      var gx = p.gazeX * 6 * s, gy = p.gazeY * 4 * s;
      K.irisL.dx += gx; K.irisR.dx += gx; K.irisL.dy += gy; K.irisR.dy += gy;
      var sm = p.smile, fr = p.frown;
      K.koseL.dx -= (sm * 10 - fr * 2) * s; K.koseR.dx += (sm * 10 - fr * 2) * s;
      K.koseL.dy -= (sm * 12 - fr * 11) * s; K.koseR.dy -= (sm * 12 - fr * 11) * s;
      K.yanakL.dy -= sm * 7 * s; K.yanakR.dy -= sm * 7 * s;
      K.yanakL.dx -= sm * 1.5 * s; K.yanakR.dx += sm * 1.5 * s;
      K.ustDudak.dy -= sm * 1.2 * s; K.altDudak.dy += fr * 1.5 * s;
    }

    function deforme(p, zaman) {
      kollariAyarla(p);
      var n = (N + 1) * (N + 1), piv = durum.pivot, s = durum.s;
      var rollR = p.roll * Math.PI / 180, cs = Math.cos(rollR), sn = Math.sin(rollR);
      var pitchY = p.pitch * 14 * s, pitchS = p.pitch * 0.035, yawX = p.yaw * 16 * s;
      for (var v = 0; v < n; v++) {
        var x0 = temel[v * 2], y0 = temel[v * 2 + 1], x = x0, y = y0, ox = 0, oy = 0;
        for (var k = 0; k < kollar.length; k++) {
          var h = kollar[k]; if (!h.dx && !h.dy) continue;
          var ddx = (x - h.x) / h.sx, ddy = (y - h.y) / (y > h.y ? h.syAlt : h.sy), d2 = ddx * ddx + ddy * ddy;
          if (d2 > 9) continue;
          var w = Math.exp(-0.5 * d2); if (h.koru) w *= 1 - gozW[v]; ox += h.dx * w; oy += h.dy * w;
        }
        x += ox; y += oy;
        var hw = headW[v];
        if (hw > 0) {
          /* baş sallama (pitch): yüz aşağı kayar ve dikeyde hafif basılır; burun daha çok (derinlik hissi) */
          var fw = faceW[v];
          var py = y + (pitchY * (0.55 + 0.45 * fw) + (y - piv[1]) * pitchS * -1) * hw;
          var px = x + yawX * (0.35 + 0.65 * fw) * hw - (x - durum.merkez[0]) * Math.abs(p.yaw) * 0.04 * hw;
          /* yana eğme (roll): boyun ekseni etrafında */
          var rx = px - piv[0], ry = py - piv[1];
          var nx = piv[0] + rx * cs - ry * sn, ny = piv[1] + rx * sn + ry * cs;
          x = px + (nx - px) * hw; y = py + (ny - py) * hw;
        }
        verts[v * 2] = x; verts[v * 2 + 1] = y;
      }
    }

    /* ---------------- Doku (taban + ağız + göz) ---------------- */
    var sonDoku = "";
    function dokuCiz() {
      var anahtar = foto.a + foto.b + foto.t.toFixed(2) + "|" + agiz.a + "|" + agiz.b + "|" + agiz.t.toFixed(2) + "|" + gozKirp.toFixed(2);
      if (anahtar === sonDoku) return;
      sonDoku = anahtar;
      cx.globalCompositeOperation = "source-over"; cx.globalAlpha = 1; cx.clearRect(0, 0, W, H);
      if (foto.t >= 1 || foto.a === foto.b) cx.drawImage(fotolar[foto.b] || taban, 0, 0);
      else { cx.drawImage(fotolar[foto.a] || taban, 0, 0); cx.globalAlpha = foto.t; cx.drawImage(fotolar[foto.b] || taban, 0, 0); cx.globalAlpha = 1; }
      cx.globalCompositeOperation = "source-atop";   /* parçalar kişinin dışına taşmasın */
      function ciz(pr, a) { if (!pr || a <= 0.01) return; cx.globalAlpha = Math.min(1, a); cx.drawImage(pr.img, pr.x, pr.y); }
      ciz(agiz.a !== "idle" && agizParca(agiz.a), 1 - agiz.t); ciz(agiz.b !== "idle" && agizParca(agiz.b), agiz.t);
      ciz(kirpParca(), gozKirp);
      cx.globalAlpha = 1; cx.globalCompositeOperation = "source-over";
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cmp);
    }

    /* ---------------- Döngü ---------------- */
    function gurultu(t, f, faz) { return Math.sin(t * f + faz) * 0.6 + Math.sin(t * f * 2.13 + faz * 1.7) * 0.3 + Math.sin(t * f * 0.47 + faz * 0.3) * 0.1; }
    function kare(simdi) {
      if (durum.yikildi) return;
      /* görünmüyorsa çizme; küçük avatarda konuşmuyorken saniyede ~30 kare yeter (pil) */
      if (!konusma && (durum.duraklat || (durum.fps && simdi - (durum.sonCizim || 0) < 1000 / durum.fps))) { if (durum.duraklat) durum.son = simdi; requestAnimationFrame(kare); return; }
      durum.sonCizim = simdi;
      var dt = Math.min(0.05, (simdi - (durum.son || simdi)) / 1000); durum.son = simdi;
      var t = (simdi - t0) / 1000;
      /* hedefe yumuşak yaklaşma: enerji yüksekse daha hızlı */
      var hiz = 1 - Math.exp(-dt * (3.5 + profil.enerji * 6));
      PARAMS.forEach(function (p) { cur[p] = lerp(cur[p], hedef[p] + ham[p], hiz); });
      var p = {}; PARAMS.forEach(function (k) { p[k] = cur[k]; });
      /* jestler */
      var jg = 0.6 + profil.enerji * 0.6;
      aktifJestler = aktifJestler.filter(function (j) {
        var u = (simdi - j.bas) / j.sure; if (u >= 1) return false;
        var d = j.f(u); for (var k in d) p[k] = (p[k] || 0) + d[k] * jg * j.guc; return true;
      });
      /* boşta canlılık: küçük baş hareketleri, nefes, bakış kaymaları */
      if (!hareketAz) {
        var canli = 0.6 + profil.enerji * 0.8 + (konusma ? 0.6 : 0);
        p.roll += gurultu(t, 0.55, 1.3) * 0.7 * canli;
        p.yaw += gurultu(t, 0.4, 4.1) * 0.05 * canli;
        p.pitch += gurultu(t, 0.5, 2.2) * 0.04 * canli + (konusma ? Math.sin(t * 7.5) * 0.015 : 0);
        if (konusma && simdi > bakisKac) {
          /* uzun konuşmada arada kısa bakış kaçırma (düşünür gibi), sonra tekrar kameraya */
          bakisKac = simdi + 3800 + Math.random() * 4200;
          sakkad.x = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.2); sakkad.y = -0.12 - Math.random() * 0.15; sakkad.t = simdi + 450 + Math.random() * 300;
        } else if (simdi > sakkad.t) { sakkad.x = (Math.random() - 0.5) * (konusma ? 0.2 : 0.35); sakkad.y = (Math.random() - 0.5) * 0.2; sakkad.t = simdi + 900 + Math.random() * 2200; }
        p.gazeX += sakkad.x; p.gazeY += sakkad.y;
        if (dinleme) { p.lean += 0.35; p.roll += 2.5; p.browInnerUp += 0.15; }
      }
      /* göz kırpma: düzensiz, yarım-kapalı-yarım */
      if (simdi > sonrakiKirp) { sonKirp = simdi; sonrakiKirp = simdi + (konusma ? 1700 + Math.random() * 2600 : 2600 + Math.random() * 3800); }
      var kb = simdi - sonKirp; gozKirp = kb < 70 ? kb / 70 : kb < 130 ? 1 : kb < 230 ? 1 - (kb - 130) / 100 : 0;
      /* konuşma: ağız dizisi */
      if (konusma) konusmaKare(simdi, dt);
      else if (agiz.b !== "idle" || agiz.t < 1) { if (agiz.b !== "idle") { agiz.a = agiz.b; agiz.b = "idle"; agiz.t = 0; } agiz.t = Math.min(1, agiz.t + dt / 0.12); }
      if (foto.t < 1) foto.t = Math.min(1, foto.t + dt / 0.35);
      deforme(p, t);
      dokuCiz();
      var nefes = hareketAz ? 0 : Math.sin(t * 1.6) * 0.0025;
      var zoom = 1 + Math.max(-0.3, p.lean) * 0.06 + nefes;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform3f(uLoc.cam, durum.merkez[0], durum.merkez[1] + 40 * durum.s, zoom);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
      var aPos = gl.getAttribLocation(prog, "aPos"); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
      durum.p = p;
      requestAnimationFrame(kare);
    }

    /* ---------------- Konuşma ---------------- */
    function konusmaKare(simdi, dt) {
      var k = konusma, c = k.cumle; if (!c || !c.dizi) return;
      /* kelime sınırı düzeltmesi yavaşça uygulanır: ağız ileri geri sıçramasın */
      if (c.duzeltHedef != null) { c.duzelt = (c.duzelt || 0) + (c.duzeltHedef - (c.duzelt || 0)) * Math.min(1, dt * 4); }
      var gecen = simdi - c.bas + (c.duzelt || 0);
      var i = Math.min(c.dizi.length - 1, Math.max(0, Math.floor(gecen / c.kareMs)));
      var sekil = c.konusuyor && !c.bekle ? c.dizi[i] : "idle";
      if (c.sesli && c.konusuyor) {
        /* gerçek ses: sessiz anlarda ağız kapanır; ani şiddet artışı = vurgu */
        var sv = sesSeviye(); c.ort = c.ort == null ? sv : c.ort * 0.96 + sv * 0.04;
        if (sv < 0.01) sekil = "idle";
        if (sv > 0.05 && sv > c.ort * 1.9 && Math.random() < 0.45) vurgula(simdi);
      }
      if (sekil === "th" && !parcalar.th) sekil = "e";
      if (sekil !== "idle" && !agizParca(sekil)) sekil = "idle";
      if (sekil !== agiz.b) { agiz.a = agiz.t > 0.5 ? agiz.b : agiz.a; agiz.b = sekil; agiz.t = 0; }
      agiz.t = Math.min(1, agiz.t + dt / 0.1);
    }
    /* Ses listesi ilk açılışta boş gelebilir: o an seçilen ses yerine varsayılan (çoğu zaman
       internetten gelen, gecikmeli) ses kullanılır ve ağız sesten önce başlardı. */
    var sesListesi = null;
    function seslerHazir() {
      if (sesListesi) return sesListesi;
      sesListesi = new Promise(function (res) {
        try { if ((speechSynthesis.getVoices() || []).length) return res(); } catch (e) { return res(); }
        var bitti = false; function tamam() { if (!bitti) { bitti = true; res(); } }
        try { speechSynthesis.addEventListener("voiceschanged", tamam, { once: true }); } catch (e) {}
        setTimeout(tamam, 1200);
      });
      return sesListesi;
    }
    function sesSec(dil) {
      var vs = []; try { vs = speechSynthesis.getVoices() || []; } catch (e) {}
      var hedefDil = dil === "tr" ? /^tr/i : /^en/i;
      var uygun = vs.filter(function (v) { return hedefDil.test(v.lang); });
      var tercih = sec.sesAdi && uygun.find(function (v) { return v.name === sec.sesAdi; });
      if (!tercih && dil !== "tr") { try { var g = JSON.parse(localStorage.getItem("dh-voice:__global__") || "null"); if (g && g.name) tercih = uygun.find(function (v) { return v.name === g.name; }); } catch (e) {} }
      return tercih || uygun.find(function (v) { return dil === "tr" ? /tr-TR/i.test(v.lang) : /en-US/i.test(v.lang); }) || uygun[0] || null;
    }
    function dilBul(metin) { return /[çğışöüÇĞİŞÖÜ]/.test(metin) || /\b(ve|bir|bu|çok|için|değil|ama|şimdi|harika|aferin|doğru|yanlış)\b/i.test(metin) ? "tr" : "en"; }
    function cumleSoyle(c, hizOrani) {
      return new Promise(function (res) {
        var dil = c.dil || dilBul(c.metin);
        c.dizi = visemeDizi(c.metin, dil);
        var msHarf = (dil === "tr" ? 62 : 58) / (hizOrani || 1);
        /* gerçek ses varsa zamanlama sesin kendi süresinden, yoksa tahmini konuşma hızından */
        var toplamMs = c.sesTampon ? c.sesTampon.duration * 1000 : (c.sessiz && c.sureMs ? c.sureMs : c.metin.length * msHarf);
        c.kareMs = Math.max(30, toplamMs / Math.max(1, c.dizi.length));
        /* Harf başına bir şekil saniyede 15-20 değişim demek: göz bunu titreme olarak görür.
           Kareleri ~120 ms'lik gruplara topla, her grupta en belirgin şekli göster. */
        var EN_AZ = 100;
        if (c.kareMs < EN_AZ && c.dizi.length > 1) {
          var g = Math.ceil(EN_AZ / c.kareMs), yeni = [], ci = [], ONCELIK = { a: 9, o: 8, e: 7, u: 6, i: 5, mbp: 6, fv: 5, l: 4, th: 4, idle: 0 };
          for (var q = 0; q < c.dizi.length; q += g) {
            var parca = c.dizi.slice(q, q + g), bos = parca.filter(function (x) { return x === "idle"; }).length;
            var sec = "idle";
            if (bos * 2 <= parca.length) parca.forEach(function (x) { if ((ONCELIK[x] || 3) > (ONCELIK[sec] || 0)) sec = x; });
            /* aynı şekil arka arkaya gelirse bir öncekiyle birleşir (ağız boşuna kapanıp açılmaz) */
            yeni.push(sec); ci.push(c.dizi.ci ? c.dizi.ci[q] : 0);
          }
          var eski = c.dizi; c.dizi = yeni; if (eski.ci) c.dizi.ci = ci;
          c.kareMs = c.kareMs * g;
        }
        c.bas = performance.now(); c.konusuyor = false;
        konusma.cumle = c;
        /* duygu biraz ÖNCE başlar, jest cümleyle birlikte */
        if (c.duygu) api.duygu(c.duygu, c.guc == null ? 0.8 : c.guc);
        if (c.jest && JESTLER[c.jest]) setTimeout(function () { if (konusma) api.jest(c.jest); }, c.jestZaman === "son" ? Math.max(300, c.metin.length * msHarf * 0.75) : 150);
        var bitti = false; function son() { if (bitti) return; bitti = true; c.konusuyor = false; setTimeout(res, 140); }
        if (c.sesTampon) { sesleOku(); return; }
        /* sessiz konuşma: ses başka yerden çalıyor ya da kapalı; ağız verilen süre boyunca oynar */
        if (c.sessiz) { c.konusuyor = true; c.bas = performance.now(); setTimeout(son, c.sureMs || c.metin.length * msHarf); return; }
        seslerHazir().then(function () { if (!bitti && konusma && konusma.cumle === c) baslat(); else son(); });
        function sesleOku() {
          var ac = sesBagi(); if (!ac) { c.sesTampon = null; seslerHazir().then(baslat); return; }
          /* tarayıcı sesi kullanıcı dokunmadan açmadıysa (otomatik oynatma engeli) tarayıcı sesine dön */
          if (ac.state !== "running") {
            Promise.race([ac.resume().catch(function () {}), new Promise(function (r) { setTimeout(r, 300); })]).then(function () {
              if (ac.state === "running") oynat(); else { c.sesTampon = null; seslerHazir().then(baslat); }
            });
            return;
          }
          oynat();
        }
        function oynat() {
          var ac = sesAc;
          var sure = c.sesTampon.duration;
          var src = ac.createBufferSource(); src.buffer = c.sesTampon; src.connect(sesAnaliz);
          c.sesKaynak = src; c.sesli = true; c.duzelt = 0; c.duzeltHedef = null;
          src.onended = son;
          src.start();
          c.bas = performance.now() + ((ac.outputLatency || ac.baseLatency || 0) * 1000); c.konusuyor = true;
          /* blok içindeki cümlelerin duygu ve jestleri, metindeki yerlerine göre zamanlanır */
          (c.altlar || []).forEach(function (a) { setTimeout(function () { if (konusma && konusma.cumle === c) { if (a.duygu) api.duygu(a.duygu, a.guc == null ? 0.8 : a.guc); if (a.jest && JESTLER[a.jest]) api.jest(a.jest); if (a.oncesi) try { a.oncesi(); } catch (e) {} } }, Math.max(0, a.oran * sure * 1000 - 120)); });
          setTimeout(son, sure * 1000 + 1500);
        }
        function baslat() {
        var u; try { u = new SpeechSynthesisUtterance(c.metin); } catch (e) { u = null; }
        if (!u || !global.speechSynthesis) { c.konusuyor = true; c.bas = performance.now(); setTimeout(son, c.metin.length * msHarf); return; }
        var v = sesSec(dil); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = dil === "tr" ? "tr-TR" : "en-US";
        u.rate = hizOrani || 1;
        u.onboundary = function (ev) {
          if (!ev || typeof ev.charIndex !== "number" || !c.metin.length) return;
          sinirVar = true;
          /* uzun kelimelerde ara ara vurgu jesti */
          var kel = (c.metin.slice(ev.charIndex).match(/^[\p{L}'’-]+/u) || [""])[0];
          if (kel.length >= 6 && Math.random() < 0.35) vurgula(performance.now());
          /* kelime sınırında ağzı metindeki konuma hizala */
          var kareNo = ev.charIndex / c.metin.length * c.dizi.length;
          if (c.dizi.ci) { kareNo = 0; while (kareNo < c.dizi.ci.length && c.dizi.ci[kareNo] < ev.charIndex) kareNo++; }
          var beklenen = kareNo * c.kareMs;
          /* ilk kelime gerçekten okunmaya başladı: ağzı tam bu ana bağla */
          if (c.bekle) { c.bekle = false; clearTimeout(c.bekleZ); c.bas = performance.now() - beklenen; c.duzelt = 0; c.duzeltHedef = null; return; }
          var gecen = performance.now() - c.bas;
          var fark = beklenen - gecen - (c.duzelt || 0);
          if (Math.abs(fark) > 180) c.duzeltHedef = beklenen - gecen;   /* küçük sapmalar yok sayılır */
        };
        /* ses yoksa / hata verirse: sessiz okuma (ağız yine metin süresince oynar) */
        var basladi = false, sessiz = false, sessizZ = null;
        function sessizOku() { if (sessiz || bitti) return; sessiz = true; c.konusuyor = true; c.bekle = false; c.bas = performance.now(); c.duzelt = 0; c.duzeltHedef = null; sessizZ = setTimeout(son, c.metin.length * msHarf); }
        u.onstart = function () {
          /* ses geç geldiyse sessiz okumayı bırak, sese yeniden hizalan */
          if (sessiz) { clearTimeout(sessizZ); sessiz = false; }
          basladi = true; c.bas = performance.now(); c.konusuyor = true; c.duzelt = 0; c.duzeltHedef = null;
          /* bu tarayıcı kelime sınırı bildiriyorsa ağız ilk kelimenin gerçekten duyulduğu anda başlar */
          if (sinirVar) { c.bekle = true; c.bekleZ = setTimeout(function () { if (c.bekle) { c.bekle = false; c.bas = performance.now(); } }, 800); }
        };
        u.onend = function () { if (!basladi) sessizOku(); else son(); };
        u.onerror = function (ev) { if (ev && (ev.error === "interrupted" || ev.error === "canceled")) son(); else sessizOku(); };
        /* güvenlik: ses hiç başlamazsa ya da bitiş gelmezse */
        setTimeout(function () { if (!basladi && !bitti) sessizOku(); }, 2500);
        setTimeout(son, Math.max(4000, c.metin.length * msHarf * 2.2 + 2000));
        try { speechSynthesis.speak(u); } catch (e) { son(); }
        }
      });
    }

    /* ---------- Doğal ses (Gemini TTS) — Dil Harita'daki Gemini anahtarıyla ----------
       Kota bilgisi Konuşkan ile ortak tutulur (dh-gemini-kota-v1): o gün dolan model atlanır. */
    var TTS_MODELLER = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"], dogalKapali = false, ttsBellek = {};
    function bugun() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    function kotaOku() { try { var k = JSON.parse(localStorage.getItem("dh-gemini-kota-v1") || "{}"); return k.gun === bugun() ? (k.m || {}) : {}; } catch (e) { return {}; } }
    function kotaDoldu(m) { var k = kotaOku(); k[m] = 1; if (global.DHKullanim) { var gy = new Date(); gy.setHours(24, 0, 0, 0); global.DHKullanim.kaydet("gemini-ses", m, { dolu: +gy }); } try { localStorage.setItem("dh-gemini-kota-v1", JSON.stringify({ gun: bugun(), m: k })); } catch (e) {} }
    function anahtarlar() { try { return (JSON.parse(localStorage.getItem("geminiApiKeys") || "[]") || []).filter(Boolean); } catch (e) { return []; } }
    function dogalSesKullanilir() {
      if (dogalKapali || !anahtarlar().length) return false;
      try { var a = JSON.parse(localStorage.getItem("dh-konuskan-video-v1") || "{}"); if (a.ses === "tarayici") return false; } catch (e) {}
      return true;
    }
    function dogalSes(metin, sesAdi) {
      if (!sesAdi) { try { sesAdi = (JSON.parse(localStorage.getItem("dh-konuskan-video-v1") || "{}").sesAdi) || "Charon"; } catch (e) { sesAdi = "Charon"; } }
      var anahtar = sesAdi + "|" + metin; if (ttsBellek[anahtar]) return ttsBellek[anahtar];
      var keys = anahtarlar(), kota = kotaOku(), modeller = TTS_MODELLER.filter(function (m) { return !kota[m]; });
      var p = (function dene(mi, ki, hepsiDolu) {
        if (mi >= modeller.length) { dogalKapali = true; return Promise.reject({ code: "rate" }); }
        if (ki >= keys.length) { if (hepsiDolu) kotaDoldu(modeller[mi]); return dene(mi + 1, 0, true); }
        return fetch("https://generativelanguage.googleapis.com/v1beta/models/" + modeller[mi] + ":generateContent?key=" + encodeURIComponent(keys[ki]), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: metin }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: sesAdi } } } } })
        }).then(function (res) {
          var KUL = global.DHKullanim;
          if (res.status === 429) return res.text().then(function (t) { if (KUL) KUL.kaydet("gemini-ses", modeller[mi], { hata: 1 }); return dene(mi, ki + 1, hepsiDolu && /PerDay/i.test(t)); });
          if (!res.ok) { if (KUL) KUL.kaydet("gemini-ses", modeller[mi], { hata: 1 }); return dene(mi, ki + 1, false); }
          if (KUL) KUL.kaydet("gemini-ses", modeller[mi], { istek: 1, ok: true });
          return res.json().then(function (d) {
            var parts = (((d.candidates || [])[0] || {}).content || {}).parts || [], p0 = parts.filter(function (x) { return x.inlineData && x.inlineData.data; })[0];
            if (!p0) return dene(mi, ki + 1, false);
            var b = atob(p0.inlineData.data), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
            var buf = u.buffer;
            if (!/wav/i.test(p0.inlineData.mimeType || "")) {
              var hz = +(((p0.inlineData.mimeType || "").match(/rate=(\d+)/) || [])[1] || 24000), v = new DataView(new ArrayBuffer(44 + u.length)), y = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
              y(0, "RIFF"); v.setUint32(4, 36 + u.length, true); y(8, "WAVE"); y(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, hz, true); v.setUint32(28, hz * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); y(36, "data"); v.setUint32(40, u.length, true);
              new Uint8Array(v.buffer, 44).set(u); buf = v.buffer;
            }
            return api.sesCoz(buf);
          });
        }, function () { return dene(mi, ki + 1, false); });
      })(0, 0, true);
      ttsBellek[anahtar] = p; p.catch(function () { delete ttsBellek[anahtar]; });
      return p;
    }

    var api = {
      DUYGULAR: DUYGULAR, DUYGU_ADI: DUYGU_ADI, JESTLER: JESTLER, JEST_ADI: JEST_ADI, PARAMS: PARAMS,
      duygu: function (ad, guc) {
        var d = DUYGULAR[ad] || {}, ham0 = guc == null ? 0.8 : guc; guc = ham0 * (0.45 + profil.ifade * 0.95);
        /* duygunun fotoğrafı varsa yüz ifadesini fotoğraf verir; esnetme yalnız baş duruşu ve bakış için kalır */
        var fotoVar = fotoAcik && fotolar[ad] && ham0 >= 0.45;
        fotoHedef(fotoVar ? ad : "notr");
        PARAMS.forEach(function (p) { hedef[p] = (d[p] || 0) * guc * (fotoVar && YUZ_P.indexOf(p) >= 0 ? 0.15 : 1); });
        durum.duygu = ad; durum.guc = ham0;
      },
      jest: function (ad, guc) { var j = JESTLER[ad]; if (!j) return; aktifJestler.push({ bas: performance.now(), sure: j.sure / (0.7 + profil.enerji * 0.6), f: j.f, guc: guc == null ? 1 : guc }); },
      ayar: function (p) { for (var k in p) if (k in ham) ham[k] = +p[k] || 0; },
      profil: function (p) { for (var k in p) if (k in profil) profil[k] = Math.max(0, Math.min(1, +p[k])); },
      dinle: function (acik) { dinleme = !!acik; },
      duraklat: function (d) { durum.duraklat = !!d; },
      cizimHizi: function (fps) { durum.fps = fps || 0; },
      fotoKullan: function (acik) { fotoAcik = !!acik; if (durum.duygu) api.duygu(durum.duygu, durum.guc); },
      durum: function () { return { duygu: durum.duygu, p: durum.p, profil: profil, agiz: agiz.b }; },
      /* akış halinde konuşma: cümleler geldikçe eklenir (ekle), bitince bitir() çağrılır */
      konusAkis: function (o) {
        o = o || {}; api.sustur(o.sesiKesme === false ? { sesKesme: false } : null);
        var liste = [], bekleyen = null, kapandi = false;
        var benim = konusma = { liste: liste, cumle: null, iptal: false, cozucu: function () { if (bekleyen) { var r = bekleyen; bekleyen = null; r(); } } };
        var i = 0;
        function sonraki() {
          if (benim.iptal || konusma !== benim) return Promise.resolve();
          if (i >= liste.length) {
            if (!kapandi) return new Promise(function (r) { bekleyen = r; }).then(sonraki);
            konusma = null; setTimeout(function () { if (!konusma) api.duygu(o.sonDuygu || "notr", 0.6); }, 600); return Promise.resolve();
          }
          var c = Object.assign({}, liste[i++]);
          if (o.oncesi) try { o.oncesi(c, i - 1); } catch (e) {}
          /* jest sıklığına göre kendiliğinden küçük baş sallamaları */
          if (!c.jest && !c.sesTampon && Math.random() < profil.jest * 0.45 && !/\?\s*$/.test(c.metin)) { c.jest = "onay"; c.jestZaman = "son"; }
          if (c._sesP && !c.sesTampon) {
            /* doğal ses (önceden istenmiş) hazır olunca; olmazsa tarayıcı sesiyle */
            return Promise.race([c._sesP, new Promise(function (_, r) { setTimeout(function () { r({ code: "gec" }); }, 9000); })])
              .then(function (buf) { c.sesTampon = buf; }, function () {})
              .then(function () { if (benim.iptal || konusma !== benim) return; return cumleSoyle(c, o.hiz || 1).then(sonraki); });
          }
          return cumleSoyle(c, o.hiz || 1).then(sonraki);
        }
        var bitis = sonraki();
        return {
          ekle: function (c) { if (benim.iptal) return; liste.push(c); benim.cozucu(); },
          bitir: function () { kapandi = true; benim.cozucu(); },
          bekleyen: function () { return liste.length - i; },
          aktif: function () { return konusma === benim && !benim.iptal; },
          bitti: bitis
        };
      },
      konus: function (cumleler, o) {
        o = o || {};
        var liste = (Array.isArray(cumleler) ? cumleler : [{ metin: String(cumleler) }]).map(function (c) { return Object.assign({}, c); });
        /* doğal ses: tüm cümlelerin sesi baştan, aynı anda istenir (konuşurken arada boşluk olmasın) */
        if (o.dogal && dogalSesKullanilir()) liste.forEach(function (c) { if (!c.sesTampon && !c.sessiz) { c._sesP = dogalSes(c.metin, o.sesAdi); c._sesP.catch(function () {}); } });
        var k = api.konusAkis(o);
        liste.forEach(function (c) { k.ekle(c); });
        k.bitir(); return k.bitti;
      },
      /* sesleri sessizce ısıt: ilk gerçek cümle soğuk ses motoru yüzünden geç başlamasın (kullanıcı dokunuşunda çağır) */
      isit: function () {
        try { sesBagi(); } catch (e) {}
        if (!global.speechSynthesis) return;
        seslerHazir().then(function () {
          ["en", "tr"].forEach(function (d) {
            try { var u = new SpeechSynthesisUtterance(d === "tr" ? "merhaba" : "hello"); var v = sesSec(d); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = d === "tr" ? "tr-TR" : "en-US";
              u.volume = 0; u.rate = 1.6; u.onboundary = function () { sinirVar = true; }; speechSynthesis.speak(u); } catch (e) {}
          });
        });
      },
      /* sustur({ sesKesme:false }): yalnız avatarı durdur, sayfanın kendi çaldığı tarayıcı sesine dokunma */
      sustur: function (so) { if (konusma) { konusma.iptal = true; try { if (konusma.cumle && konusma.cumle.sesKaynak) konusma.cumle.sesKaynak.stop(); } catch (e) {} if (konusma.cozucu) konusma.cozucu(); } konusma = null; if (!(so && so.sesKesme === false)) { try { speechSynthesis.cancel(); } catch (e) {} } },
      /* gerçek ses verisini (wav vb.) motorun ses bağlamında çöz */
      sesCoz: function (ab) { var ac = sesBagi(); if (!ac) return Promise.reject(new Error("ses yok")); return new Promise(function (res, rej) { var p = ac.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); },
      yikil: function () { durum.yikildi = true; api.sustur(); }
    };

    api.hazir = fetch(yol + "face.json?v=" + GORSEL_SURUM).then(function (r) { return r.json(); }).then(function (f) {
      face = f; W = f.boyut[0]; H = f.boyut[1];
      canvas.width = W; canvas.height = H;
      cmp.width = W; cmp.height = H; cx = cmp.getContext("2d");
      var isler = [yukle(yol + f.taban).then(function (im) { taban = im; })];
      if (f.basMaske) isler.push(yukle(yol + f.basMaske).then(function (im) { maskeImg = im; }, function () {}));
      Object.keys(f.parcalar).forEach(function (k) { var pr = f.parcalar[k]; isler.push(yukle(yol + pr.dosya).then(function (im) { parcalar[k] = { img: im, x: pr.x, y: pr.y }; })); });
      return Promise.all(isler);
    }).then(function () {
      if (!gl) throw new Error("Bu tarayıcıda WebGL yok");
      kur(); kollariKur(); durum.hazir = true;
      fotolar.notr = taban;
      requestAnimationFrame(kare);
      /* duygu fotoğrafları arka planda yüklenir; gelene kadar esnetme kullanılır */
      var ek = [], f = face;
      Object.keys(f.duygular || {}).forEach(function (k) { ek.push(yukle(yol + f.duygular[k].dosya).then(function (im) { fotolar[k] = im; }, function () {})); });
      Object.keys(f.agizSetleri || {}).forEach(function (s) { var set = agizSetleri[s] = {}; Object.keys(f.agizSetleri[s]).forEach(function (k) { var pr = f.agizSetleri[s][k]; ek.push(yukle(yol + pr.dosya).then(function (im) { set[k] = { img: im, x: pr.x, y: pr.y }; }, function () {})); }); });
      Object.keys(f.kirpma || {}).forEach(function (k) { var pr = f.kirpma[k]; ek.push(yukle(yol + pr.dosya).then(function (im) { kirpSetleri[k] = { img: im, x: pr.x, y: pr.y }; }, function () {})); });
      api.fotolarHazir = Promise.all(ek).then(function () { if (durum.duygu) api.duygu(durum.duygu, durum.guc); return api; });
      return api;
    });
    return api;
  }

  /* ---------- Davranış etiketleyici (kurallı, yapay zekâsız) ----------
     Her cümleye bir duygu ve jest önerir. Yapay zekâ etiket verirse o kullanılır. */
  var KURAL = [
    { re: /\b(great|excellent|perfect|well done|exactly|correct|good job|amazing|fantastic|nice|brilliant|harika|mükemmel|aferin|süper|tebrik|doğru|çok iyi|bravo)\b/i, duygu: "mutlu", jest: "iki_onay", guc: 0.9 },
    { re: /\b(not quite|almost|close|mistake|wrong|try again|neredeyse|yanlış|hata|tekrar dene|olmadı)\b/i, duygu: "anlayisli", jest: "egil", guc: 0.8 },
    { re: /\b(careful|be careful|remember|important|watch out|dikkat|önemli|unutma)\b/i, duygu: "ciddi", jest: "onay", guc: 0.7 },
    { re: /\b(unfortunately|sorry|sad|maalesef|üzgünüm|ne yazık)\b/i, duygu: "anlayisli", jest: null, guc: 0.8 },
    { re: /\b(hmm|let me think|let's see|i wonder|düşüneyim|bakalım|acaba)\b/i, duygu: "dusunceli", jest: "dusun", guc: 0.8 },
    { re: /\b(wow|really\?|no way|incredible|vay|gerçekten mi|inanılmaz)\b/i, duygu: "saskin", jest: "kas", guc: 0.9 },
    { re: /\b(you can|keep going|don't worry|let's try|you're improving|yapabilirsin|devam|merak etme|hadi)\b/i, duygu: "cesaret", jest: "onay", guc: 0.8 },
    { re: /\b(proud|i'm proud|gurur)\b/i, duygu: "gururlu", jest: "onay", guc: 0.9 }
  ];
  function cumlelereBol(metin) {
    var m = String(metin || "").replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]*["')\]]*\s*/g) || [];
    return m.map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function etiketle(metin) {
    return cumlelereBol(metin).map(function (s) {
      for (var i = 0; i < KURAL.length; i++) if (KURAL[i].re.test(s)) return { metin: s, duygu: KURAL[i].duygu, jest: KURAL[i].jest, guc: KURAL[i].guc, kaynak: "kural" };
      if (/\?\s*$/.test(s)) return { metin: s, duygu: "merak", jest: Math.random() < 0.5 ? "egil" : "kas", guc: 0.7, kaynak: "kural" };
      if (/!\s*$/.test(s)) return { metin: s, duygu: "mutlu", jest: "onay", guc: 0.7, kaynak: "kural" };
      return { metin: s, duygu: "cesaret", jest: null, guc: 0.35, kaynak: "kural" };
    });
  }
  /* Yapay zekâ ile etiketleme (Dil Harita anahtarlarıyla, varsa) */
  function yapayZekaEtiketle(metin) {
    var cumleler = cumlelereBol(metin);
    if (!global.DHProviders || !DHProviders.chat) return Promise.resolve(etiketle(metin));
    var prompt = "You direct the facial expressions of a friendly English teacher avatar. For each sentence choose ONE emotion from: " + Object.keys(DUYGULAR).join(", ") +
      " and ONE gesture from: " + Object.keys(JESTLER).join(", ") + ", or null. Also an intensity 0.3-1. Consider the meaning and the teaching situation (praise, correction, question, explanation). " +
      "Return ONLY JSON: {\"tags\":[{\"i\":0,\"duygu\":\"...\",\"jest\":\"...\",\"guc\":0.8}]}\nSentences:\n" + cumleler.map(function (s, i) { return i + ") " + s; }).join("\n");
    return DHProviders.chat([{ role: "system", content: "Reply with valid JSON only." }, { role: "user", content: prompt }], { json: true, fast: true, max_tokens: 1500, temperature: 0.3 })
      .then(function (txt) {
        var t = String(txt || "").replace(/^```(?:json)?/i, "").replace(/```$/, ""); var a = t.indexOf("{"), b = t.lastIndexOf("}");
        var j = JSON.parse(t.slice(a, b + 1)); var kur = etiketle(metin);
        (j.tags || []).forEach(function (x) { var c = kur[+x.i]; if (!c) return; if (DUYGULAR[x.duygu]) c.duygu = x.duygu; c.jest = JESTLER[x.jest] ? x.jest : null; if (x.guc) c.guc = Math.max(0.2, Math.min(1, +x.guc)); c.kaynak = "yapay zekâ"; });
        return kur;
      }).catch(function () { return etiketle(metin); });
  }

  global.DHCanliYuz = { olustur: olustur, etiketle: etiketle, yapayZekaEtiketle: yapayZekaEtiketle, cumlelereBol: cumlelereBol, DUYGULAR: DUYGULAR, DUYGU_ADI: DUYGU_ADI, JESTLER: JESTLER, JEST_ADI: JEST_ADI };
})(window);
