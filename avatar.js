/*
  DilAvatar v19 — Tam Kare Hizalı Fotoğraf Avatar
  ------------------------------------------------
  Bu sürümde patch / ağız overlay / göz overlay yoktur.
  Bütün üretilmiş fotoğraflar tam kare olarak kullanılır.

  Amaç:
  - çift dudak yok
  - gri halka yok
  - ağız üstüne ağız bindirme yok
  - saç/ceket kopması yok
  - beden transform yok
  - yüz scale/rotate/translate yok

  Konuşma mantığı:
  Harf -> viseme -> tam kare fotoğraf.

  API:
    DilAvatar.mount(elementIdVeyaEleman, options?)
    DilAvatar.speakText(text, durationMs?)
    DilAvatar.setMouth(shape)
    DilAvatar.blink()
    DilAvatar.fixHair(true)
    DilAvatar.thinking(true|false)
    DilAvatar.stop()
    DilAvatar.setAutoHair(true|false)
    DilAvatar.setHeadMotion(false)  // API uyumluluğu için var; hareket kapalıdır.
*/

(function(global) {
  "use strict";

  var STORAGE_KEY = "DilAvatar.frame.v19.settings";
  var __AV_BASE=(function(){try{var sc=document.currentScript&&document.currentScript.src;if(sc)return sc.replace(/[^\/]*$/,'')+'assets/avatars_v3/default/';}catch(e){}return 'assets/avatars_v3/default/';})();
var FR = {"rest":__AV_BASE+"rest.webp","slight":__AV_BASE+"slight.webp","half":__AV_BASE+"half.webp","mid":__AV_BASE+"mid.webp","open":__AV_BASE+"open.webp","round":__AV_BASE+"round.webp","wide":__AV_BASE+"wide.webp","blinkHalf":__AV_BASE+"blinkHalf.webp","blink":__AV_BASE+"blink.webp","hair1":__AV_BASE+"hair1.webp","hair2":__AV_BASE+"hair2.webp","hair3":__AV_BASE+"hair3.webp","hair4":__AV_BASE+"hair4.webp"};

  var state = {
    host: null,
    root: null,
    frame: null,
    img: null,

    currentFrame: "rest",
    lastSpeechFrame: "rest",

    speaking: false,
    thinking: false,
    hairActive: false,
    autoHair: false,

    speechTimer: null,
    blinkTimer: null,
    blinkSeqTimer: null,
    hairTimer: null,
    autoHairTimer: null,
    thinkingTimer: null,

    opts: {
      size: 300,
      borderColor: "#2dd4bf",
      showMiniControls: false
    }
  };

  function safeGet(key, fallback) {
    try {
      var v = global.localStorage && global.localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch(e) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      if (global.localStorage) global.localStorage.setItem(key, value);
    } catch(e) {}
  }

  function loadSettings() {
    try {
      var saved = JSON.parse(safeGet(STORAGE_KEY, "{}") || "{}");
      if (typeof saved.autoHair === "boolean") state.autoHair = saved.autoHair;
    } catch(e) {}
  }

  function saveSettings() {
    safeSet(STORAGE_KEY, JSON.stringify({
      autoHair: state.autoHair
    }));
  }

  function injectCss() {
    if (document.getElementById("dil-avatar-v19-style")) return;

    var css = `
      .dil-avatar-v19 {
        --da-border:#2dd4bf;
        width:100%;
        max-width:var(--da-size, 300px);
        min-width:120px;
        margin:0 auto;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        color:#e5e7eb;
        user-select:none;
      }

      .dil-avatar-v19-frame {
        width:100%;
        aspect-ratio:1/1;
        position:relative;
        overflow:hidden;
        border-radius:50%;
        background:#0b1120;
        border:4px solid var(--da-border);
        box-shadow:0 18px 38px rgba(0,0,0,.28), inset 0 0 0 1px rgba(255,255,255,.08);
      }

      .dil-avatar-v19-img {
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        object-fit:cover;
        object-position:center center;
        display:block;
        pointer-events:none;
        -webkit-user-drag:none;
        transform:none !important;
        transition: opacity 38ms linear;
      }

      .dil-avatar-v19-mini {
        margin:10px auto 0;
        display:flex;
        gap:5px;
        flex-wrap:wrap;
        justify-content:center;
      }

      .dil-avatar-v19-mini button {
        border:0;
        border-radius:10px;
        padding:6px 8px;
        cursor:pointer;
        font-weight:800;
        font-size:11px;
        color:white;
        background:#2563eb;
      }

      .dil-avatar-v19-mini button.secondary {
        background:#1e293b;
        color:#dbeafe;
      }
    `;

    var style = document.createElement("style");
    style.id = "dil-avatar-v19-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function preloadFrames() {
    Object.keys(FR).forEach(function(k) {
      var im = new Image();
      im.src = FR[k];
    });
  }

  function mount(target, options) {
    loadSettings();
    injectCss();
    preloadFrames();

    var host = typeof target === "string" ? document.getElementById(target) : target;
    if (!host) throw new Error("DilAvatar.mount: hedef eleman bulunamadı.");

    state.opts = Object.assign({}, state.opts, options || {});
    host.innerHTML = "";

    var root = document.createElement("div");
    root.className = "dil-avatar-v19";
    root.style.setProperty("--da-size", (state.opts.size || 300) + "px");
    root.style.setProperty("--da-border", state.opts.borderColor || "#2dd4bf");

    var frame = document.createElement("div");
    frame.className = "dil-avatar-v19-frame";

    var img = document.createElement("img");
    img.className = "dil-avatar-v19-img";
    img.alt = "DilAvatar";
    img.src = FR.rest;

    frame.appendChild(img);
    root.appendChild(frame);

    if (state.opts.showMiniControls) {
      var mini = document.createElement("div");
      mini.className = "dil-avatar-v19-mini";
      mini.innerHTML = `
        <button type="button" data-da-act="speak">Konuş</button>
        <button type="button" data-da-act="hair" class="secondary">Saç</button>
        <button type="button" data-da-act="blink" class="secondary">Göz</button>
        <button type="button" data-da-act="stop" class="secondary">Dur</button>
      `;

      mini.addEventListener("click", function(ev) {
        var b = ev.target.closest("button");
        if (!b) return;

        var act = b.getAttribute("data-da-act");
        if (act === "speak") speakText("merhaba bugün ingilizce çalışıyoruz", 3200);
        if (act === "hair") fixHair(true);
        if (act === "blink") blink();
        if (act === "stop") stop();
      });

      root.appendChild(mini);
    }

    host.appendChild(root);

    state.host = host;
    state.root = root;
    state.frame = frame;
    state.img = img;

    showFrame("rest");
    scheduleBlink();
    scheduleAutoHair();

    return root;
  }

  function showFrame(name, rememberSpeech) {
    if (!FR[name]) name = "rest";
    if (!state.img) return;

    state.currentFrame = name;
    state.img.src = FR[name];

    if (rememberSpeech !== false && name.indexOf("hair") !== 0 && name !== "blink" && name !== "blinkHalf") {
      state.lastSpeechFrame = name;
    }
  }

  function mouthToFrame(shape) {
    switch(shape) {
      case "rest":
      case "closed":
        return "rest";
      case "slight":
        return "slight";
      case "half":
        return "half";
      case "mid":
        return "mid";
      case "open":
        return "open";
      case "round":
        return "round";
      case "wide":
        return "wide";
      case "teeth":
        return "mid";
      default:
        return "rest";
    }
  }

  function setMouth(shape) {
    if (state.hairActive) return;
    showFrame(mouthToFrame(shape));
  }

  function visemeForChar(ch) {
    ch = String(ch || "").toLocaleLowerCase("tr-TR");

    if (ch === "a" || ch === "â") return "open";
    if (ch === "e") return "wide";
    if (ch === "o" || ch === "u") return "round";
    if (ch === "ı" || ch === "i" || ch === "ü" || ch === "ö" || ch === "y") return "wide";
    if (ch === "m" || ch === "b" || ch === "p") return "closed";
    if (ch === "f" || ch === "v") return "teeth";
    if (/\s/.test(ch)) return "rest";

    if ("çcğhjklmnprsştzqxw".indexOf(ch) >= 0) return "slight";
    return "rest";
  }

  function frameForChar(ch, index) {
    var f = mouthToFrame(visemeForChar(ch));
    if (f === "slight" && index % 3 === 0) f = "half";
    return f;
  }

  function clearTimeoutSafe(t) {
    if (t) clearTimeout(t);
    return null;
  }

  function clearIntervalSafe(t) {
    if (t) clearInterval(t);
    return null;
  }

  function speakText(text, durationMs) {
    stopSpeechOnly();

    text = String(text || "");
    var chars = Array.prototype.slice.call(text);

    if (!chars.length) {
      showFrame("rest");
      return;
    }

    state.speaking = true;
    state.hairActive = false;

    var total = Number(durationMs);
    var per = total && isFinite(total) ? total / chars.length : 110;
    per = Math.max(70, Math.min(145, per));

    var i = 0;
    function step() {
      if (!state.speaking || i >= chars.length) {
        state.speaking = false;
        showFrame("rest");
        return;
      }

      showFrame(frameForChar(chars[i], i));
      maybeTriggerHairGesture(i, chars.length);

      i += 1;
      state.speechTimer = setTimeout(step, per);
    }

    step();
  }

  function stopSpeechOnly() {
    state.speechTimer = clearTimeoutSafe(state.speechTimer);
    state.speaking = false;
  }

  function blink() {
    if (state.hairActive) return;

    var back = state.lastSpeechFrame || "rest";
    state.blinkSeqTimer = clearTimeoutSafe(state.blinkSeqTimer);

    showFrame("blinkHalf", false);
    state.blinkSeqTimer = setTimeout(function() {
      showFrame("blink", false);
      state.blinkSeqTimer = setTimeout(function() {
        showFrame("blinkHalf", false);
        state.blinkSeqTimer = setTimeout(function() {
          showFrame(back, false);
        }, 75);
      }, 90);
    }, 75);
  }

  function scheduleBlink() {
    state.blinkTimer = clearTimeoutSafe(state.blinkTimer);
    var next = 2800 + Math.random() * 3400;
    state.blinkTimer = setTimeout(function() {
      blink();
      scheduleBlink();
    }, next);
  }

  function maybeTriggerHairGesture(index, total) {
    if (state.hairActive) return;
    if (total < 28) return;
    if (index === Math.floor(total * 0.62)) {
      quickHairGesture();
    }
  }

  function quickHairGesture() {
    if (state.hairActive) return;

    state.hairActive = true;
    var seq = [
      ["hair1", 130],
      ["hair2", 160],
      ["hair3", 220],
      ["hair4", 170],
      ["hair2", 140],
      ["hair1", 110],
      ["rest", 80]
    ];

    var i = 0;
    state.hairTimer = clearTimeoutSafe(state.hairTimer);

    function step() {
      if (i >= seq.length) {
        state.hairActive = false;
        showFrame("rest");
        return;
      }

      showFrame(seq[i][0], false);
      state.hairTimer = setTimeout(step, seq[i][1]);
      i += 1;
    }

    step();
  }

  function fixHair(force) {
    if (state.speaking && !force) return;
    quickHairGesture();
  }

  function scheduleAutoHair() {
    state.autoHairTimer = clearTimeoutSafe(state.autoHairTimer);
    if (!state.autoHair) return;

    var next = 28000 + Math.random() * 22000;
    state.autoHairTimer = setTimeout(function() {
      if (!state.speaking && !state.thinking && !state.hairActive) quickHairGesture();
      scheduleAutoHair();
    }, next);
  }

  function thinking(on) {
    state.thinking = !!on;
    state.thinkingTimer = clearIntervalSafe(state.thinkingTimer);

    if (!on) {
      showFrame("rest");
      return;
    }

    var flip = false;
    state.thinkingTimer = setInterval(function() {
      if (state.hairActive) return;
      flip = !flip;
      showFrame(flip ? "slight" : "rest");
    }, 720);
  }

  function stop() {
    stopSpeechOnly();
    state.thinking = false;
    state.hairActive = false;
    state.thinkingTimer = clearIntervalSafe(state.thinkingTimer);
    state.hairTimer = clearTimeoutSafe(state.hairTimer);
    state.blinkSeqTimer = clearTimeoutSafe(state.blinkSeqTimer);
    showFrame("rest");
  }

  function setHeadMotion(on) {
    // Bu sürümde bilinçli olarak baş/gövde transform yok.
    return false;
  }

  function setAutoHair(on) {
    state.autoHair = !!on;
    saveSettings();
    scheduleAutoHair();
  }

  function setGender(g) {
    return "erkek";
  }

  function getGender() {
    return "erkek";
  }

  function getFrameNames() {
    return Object.keys(FR).slice();
  }

  function showFrameManual(name) {
    showFrame(name || "rest", false);
  }

  global.DilAvatar = {
    mount: mount,
    speakText: speakText,
    setMouth: setMouth,
    blink: blink,
    fixHair: fixHair,
    thinking: thinking,
    stop: stop,
    setHeadMotion: setHeadMotion,
    setAutoHair: setAutoHair,
    setGender: setGender,
    getGender: getGender,
    visemeForChar: visemeForChar,
    showFrame: showFrameManual,
    getFrameNames: getFrameNames
  };
})(window);
