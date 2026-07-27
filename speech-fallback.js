/* speech-fallback.js — konuşma tanıma olmayan tarayıcılar için gerçek bir alternatif
   ==================================================================
   SORUN: webkitSpeechRecognition 14 dosyada kullanılıyor ama iOS Safari'de bu API
   yok. iPhone kullanıcısının gördüğü tek şey "Tarayıcı ses tanımayı desteklemiyor"
   uyarısı ve arkasından açılan bir YAZI kutusuydu. Telaffuz alıştırmasında cevabı
   yazmak, alıştırmanın amacını ortadan kaldırıyor.

   ÇÖZÜM: gölgeleme (shadowing) — dil öğretiminde bilinen bir teknik:
     1. doğru okunuşu dinle
     2. kendi sesini kaydet   (MediaRecorder — iOS Safari 14.3+ destekliyor)
     3. ikisini arka arkaya dinle
     4. kendini değerlendir → puan SRS'e işlenir

   Sunucu olmadan gerçek tanıma yapılamaz; dürüst olan çözüm kullanıcının kendi
   kararını almasını sağlamak. Böylece alıştırma iPhone'da da SESLİ kalıyor.

   API:
     DHSpeech.supported          tarayıcıda ses tanıma var mı
     DHSpeech.canRecord()        kayıt yapılabiliyor mu
     DHSpeech.shadow(metin, cb)  gölgeleme panelini açar; cb({puan, kendi:true})
     DHSpeech.speak(metin)       hedef cümleyi seslendirir
*/
(function () {
  "use strict";
  if (window.DHSpeech) return;

  var STT = window.SpeechRecognition || window.webkitSpeechRecognition;

  function canRecord() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
              typeof window.MediaRecorder !== "undefined");
  }

  function speak(text, rate) {
    try {
      if (!window.speechSynthesis) return false;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text || ""));
      u.lang = "en-US";
      u.rate = rate || 0.92;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  /* Safari audio/webm desteklemez; uygun formatı seç */
  function pickMime() {
    var tries = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", ""];
    for (var i = 0; i < tries.length; i++) {
      try { if (!tries[i] || MediaRecorder.isTypeSupported(tries[i])) return tries[i]; } catch (e) {}
    }
    return "";
  }

  var css = [
    '.dhsp-back{position:fixed;inset:0;background:#000b;z-index:100000;display:flex;',
    '  align-items:flex-end;justify-content:center}',
    '.dhsp{background:#0a1424;border:1px solid #1e3a5f;border-bottom:0;',
    '  border-radius:20px 20px 0 0;width:100%;max-width:520px;padding:18px 16px 24px;',
    '  color:#e8eef7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;',
    '  animation:dhspUp .25s cubic-bezier(.2,.8,.2,1)}',
    '@keyframes dhspUp{from{transform:translateY(24px);opacity:.5}}',
    '.dhsp h3{margin:0 0 4px;font-size:16px}',
    '.dhsp .hint{color:#9fb3d9;font-size:13px;margin:0 0 14px;line-height:1.45}',
    '.dhsp .target{background:#10264a;border:1px solid #1e3a5f;border-radius:13px;',
    '  padding:13px 14px;font-size:17px;font-weight:700;line-height:1.4;margin-bottom:14px}',
    '.dhsp .row{display:flex;gap:9px;margin-bottom:10px}',
    '.dhsp button{appearance:none;border:0;cursor:pointer;border-radius:12px;padding:13px 12px;',
    '  font-size:14.5px;font-weight:800;color:#fff;background:#16294a;border:1px solid #1e3a5f;flex:1}',
    '.dhsp button.p{background:linear-gradient(135deg,#059669,#10b981);border-color:transparent}',
    '.dhsp button.rec{background:linear-gradient(135deg,#b91c1c,#ef4444);border-color:transparent}',
    '.dhsp button[disabled]{opacity:.4;cursor:default}',
    '.dhsp .rate{display:flex;gap:8px;margin-top:4px}',
    '.dhsp .rate button{font-size:13.5px;padding:12px 6px}',
    '.dhsp .close{background:none;border:0;color:#9fb3d9;font-size:13px;',
    '  text-decoration:underline;width:100%;margin-top:10px;padding:8px}',
    '.dhsp .lvl{height:4px;border-radius:2px;background:#16294a;overflow:hidden;margin:8px 0 12px}',
    '.dhsp .lvl i{display:block;height:100%;width:0;background:#10b981;transition:width .1s}',
    '@media (prefers-reduced-motion:reduce){.dhsp{animation:none}}'
  ].join("");

  function ensureCSS() {
    if (document.getElementById("dhsp-css")) return;
    var st = document.createElement("style");
    st.id = "dhsp-css"; st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- gölgeleme paneli ---------- */
  function shadow(target, done) {
    ensureCSS();
    var back = document.createElement("div");
    back.className = "dhsp-back";
    back.innerHTML =
      '<div class="dhsp" role="dialog" aria-modal="true">' +
        '<h3>Dinle, tekrarla, karşılaştır</h3>' +
        '<p class="hint">Bu tarayıcı otomatik değerlendirme yapamıyor. Cümleyi dinle, ' +
        'kendi sesini kaydet, ikisini arka arkaya dinleyip kendin karar ver.</p>' +
        '<div class="target"></div>' +
        '<div class="lvl"><i id="dhspLvl"></i></div>' +
        '<div class="row">' +
          '<button id="dhspPlay">🔊 Dinle</button>' +
          '<button id="dhspRec" class="rec">🎙 Kaydet</button>' +
        '</div>' +
        '<div class="row">' +
          '<button id="dhspMine" disabled>▶️ Kendini dinle</button>' +
          '<button id="dhspBoth" disabled>🔁 Karşılaştır</button>' +
        '</div>' +
        '<p class="hint" id="dhspAsk" style="display:none;margin:12px 0 6px">Nasıl geçti?</p>' +
        '<div class="rate" id="dhspRate" style="display:none">' +
          '<button data-p="90" class="p">Aynıydı</button>' +
          '<button data-p="60">Yaklaştım</button>' +
          '<button data-p="25">Zorlandım</button>' +
        '</div>' +
        '<button class="close" id="dhspClose">Kapat</button>' +
      '</div>';
    back.querySelector(".target").textContent = String(target || "");
    document.body.appendChild(back);

    var rec = null, chunks = [], url = null, stream = null, meter = null, ctx = null;
    var $ = function (id) { return back.querySelector("#" + id); };

    function cleanup() {
      try { if (rec && rec.state === "recording") rec.stop(); } catch (e) {}
      try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      try { if (ctx) ctx.close(); } catch (e) {}
      try { if (url) URL.revokeObjectURL(url); } catch (e) {}
      clearInterval(meter);
      try { speechSynthesis.cancel(); } catch (e) {}
      back.remove();
    }

    $("dhspClose").onclick = function () { cleanup(); if (done) done(null); };
    back.onclick = function (e) { if (e.target === back) { cleanup(); if (done) done(null); } };

    $("dhspPlay").onclick = function () { speak(target); };

    $("dhspRec").onclick = function () {
      if (rec && rec.state === "recording") { rec.stop(); return; }
      if (!canRecord()) {
        $("dhspRec").disabled = true;
        $("dhspRec").textContent = "Kayıt yok";
        $("dhspAsk").style.display = "block";
        $("dhspRate").style.display = "flex";
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
        stream = st; chunks = [];
        var mt = pickMime();
        rec = mt ? new MediaRecorder(st, { mimeType: mt }) : new MediaRecorder(st);
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          clearInterval(meter);
          $("dhspLvl").style.width = "0%";
          try { if (url) URL.revokeObjectURL(url); } catch (e) {}
          url = URL.createObjectURL(new Blob(chunks, { type: chunks[0] ? chunks[0].type : "audio/mp4" }));
          $("dhspRec").textContent = "🎙 Tekrar kaydet";
          $("dhspRec").classList.remove("rec");
          $("dhspMine").disabled = false;
          $("dhspBoth").disabled = false;
          $("dhspAsk").style.display = "block";
          $("dhspRate").style.display = "flex";
          try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        };
        rec.start();
        $("dhspRec").textContent = "⏹ Durdur";

        /* basit ses seviyesi göstergesi — kayıt gerçekten alınıyor mu, görünsün */
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          ctx = new AC();
          var src = ctx.createMediaStreamSource(st), an = ctx.createAnalyser();
          an.fftSize = 512; src.connect(an);
          var buf = new Uint8Array(an.frequencyBinCount);
          meter = setInterval(function () {
            an.getByteFrequencyData(buf);
            var sum = 0; for (var i = 0; i < buf.length; i++) sum += buf[i];
            var pct = Math.min(100, Math.round(sum / buf.length / 90 * 100));
            $("dhspLvl").style.width = pct + "%";
          }, 90);
        } catch (e) {}

        /* güvenlik: 15 saniyede otomatik durdur */
        setTimeout(function () { try { if (rec && rec.state === "recording") rec.stop(); } catch (e) {} }, 15000);
      }).catch(function () {
        $("dhspRec").textContent = "Mikrofon izni yok";
        $("dhspRec").disabled = true;
        $("dhspAsk").style.display = "block";
        $("dhspRate").style.display = "flex";
      });
    };

    $("dhspMine").onclick = function () {
      if (!url) return;
      try { speechSynthesis.cancel(); } catch (e) {}
      new Audio(url).play().catch(function () {});
    };

    $("dhspBoth").onclick = function () {
      if (!url) return;
      speak(target);
      setTimeout(function () { new Audio(url).play().catch(function () {}); },
                 Math.max(1600, String(target || "").length * 62));
    };

    back.querySelectorAll("#dhspRate button").forEach(function (b) {
      b.onclick = function () {
        var puan = parseInt(b.dataset.p, 10) || 0;
        cleanup();
        if (done) done({ puan: puan, kendi: true, metin: String(target || "") });
      };
    });
  }

  window.DHSpeech = {
    supported: !!STT,
    canRecord: canRecord,
    speak: speak,
    shadow: shadow
  };
})();
