/*
  DilAvatar — Ayarlanabilir Konuşan Asistan Avatarı
  ------------------------------------------------
  Tek dosyalık, çevrimdışı çalışan, dış bağımlılıksız avatar sistemi.
  HTML + CSS + SVG + Vanilla JavaScript.

  Kullanım:
    DilAvatar.mount("avatarHost");
    DilAvatar.speakText("merhaba bugün İngilizce çalışıyoruz", 3200);

  Ayar paneli:
    DilAvatar.mountControlPanel("panelHost");

  Not:
    Gerçek ses dalgasına bağlı lip-sync yapılmaz.
    Tarayıcı TTS çıktısını güvenilir şekilde Web Audio'ya bağlamak pratik değildir.
    Bu yüzden metin harf harf süreye yayılır ve ağız şekilleri harf tabanlı değiştirilir.
*/
(function (global) {
  "use strict";

  var STORAGE_KEY = "DilAvatar.v7.settings";
  var GENDER_KEY = "DilAvatar.v7.gender";

  var state = {
    host: null,
    root: null,
    svgWrap: null,
    svg: null,
    gender: "erkek",
    mouth: "rest",
    speakingTimer: null,
    thinkingTimer: null,
    blinkTimer: null,
    blinkOffTimer: null,
    isBlinking: false,
    isThinking: false,
    controls: [],
    settings: null
  };

  var DEFAULTS = {
    kadin: {
      title: "Kadın Avatar",
      theme: "#3b82f6",
      imageType: "svgVector",
      bg: "#f8fafc",
      face: "#ffd7ae",
      hair: "#5b2a1c",
      hair2: "#7a3b27",
      eye: "#5b341c",
      cloth: "#0e7490",
      cloth2: "#075985",
      mouthColor: "#9f1d35",
      lipColor: "#d94b62",
      hasGlasses: false,
      hasBeard: false,
      // 1000x1000 koordinat sistemi
      mouthX: 500,
      mouthY: 545,
      mouthScale: 1,
      mouthWidth: 108,
      mouthHeight: 36,
      mouthRotate: 0,
      mouthOpacity: 1,
      leftEyeX: 410,
      leftEyeY: 405,
      rightEyeX: 590,
      rightEyeY: 405,
      eyeW: 76,
      eyeH: 30,
      eyeStroke: 8,
      eyeCurve: 16,
      browVisible: true,
      browOpacity: 1,
      browWidth: 86,
      browHeight: 26,
      browPeak: 18,
      browStroke: 13,
      leftBrowX: 410,
      leftBrowY: 345,
      rightBrowX: 590,
      rightBrowY: 345,
      leftBrowRotate: -8,
      rightBrowRotate: 8
    },
    erkek: {
      title: "Erkek Avatar",
      theme: "#2dd4bf",
      imageType: "svgSimpleBeard",
      bg: "#f8fafc",
      face: "#ffd0a8",
      hair: "#4b2116",
      hair2: "#6b301e",
      eye: "#4a2b18",
      cloth: "#1e1b7a",
      cloth2: "#172554",
      mouthColor: "#111827",
      lipColor: "#f2a484",
      hasGlasses: false,
      hasBeard: true,
      // Sakallı avatar için ağız bilinçli olarak sakalın üzerine çizilir.
      mouthX: 500,
      mouthY: 575,
      mouthScale: 1,
      mouthWidth: 118,
      mouthHeight: 32,
      mouthRotate: 0,
      mouthOpacity: 1,
      leftEyeX: 415,
      leftEyeY: 390,
      rightEyeX: 585,
      rightEyeY: 390,
      eyeW: 66,
      eyeH: 24,
      eyeStroke: 8,
      eyeCurve: 13,
      browVisible: true,
      browOpacity: 1,
      browWidth: 78,
      browHeight: 23,
      browPeak: 16,
      browStroke: 13,
      leftBrowX: 415,
      leftBrowY: 338,
      rightBrowX: 585,
      rightBrowY: 338,
      leftBrowRotate: -5,
      rightBrowRotate: 5
    }
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function safeGet(key, fallback) {
    try {
      var v = global.localStorage && global.localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      if (global.localStorage) global.localStorage.setItem(key, value);
    } catch (e) {}
  }

  function safeRemove(key) {
    try {
      if (global.localStorage) global.localStorage.removeItem(key);
    } catch (e) {}
  }

  function loadSettings() {
    var saved = safeGet(STORAGE_KEY, null);
    var data = clone(DEFAULTS);
    if (saved) {
      try {
        var parsed = JSON.parse(saved);
        ["kadin", "erkek"].forEach(function (g) {
          if (parsed && parsed[g]) {
            Object.keys(parsed[g]).forEach(function (k) {
              data[g][k] = parsed[g][k];
            });
          }
        });
      } catch (e) {}
    }
    state.settings = data;
    var g = safeGet(GENDER_KEY, "erkek");
    state.gender = (g === "erkek" || g === "kadin") ? g : "kadin";
  }

  function saveSettings() {
    safeSet(STORAGE_KEY, JSON.stringify(state.settings));
    safeSet(GENDER_KEY, state.gender);
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "style") node.setAttribute("style", attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    if (html != null) node.innerHTML = html;
    return node;
  }

  function injectCss() {
    if (document.getElementById("dil-avatar-style-v5")) return;
    var css = `
      .dil-avatar-box{
        --da-theme:#3b82f6;
        width:100%;
        max-width:280px;
        min-width:120px;
        margin:0 auto;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        color:#e5e7eb;
        user-select:none;
      }
      .dil-avatar-frame{
        position:relative;
        width:100%;
        aspect-ratio:1/1;
        border-radius:50%;
        overflow:hidden;
        background:#0b1120;
        border:4px solid var(--da-theme);
        box-shadow:0 20px 40px rgba(0,0,0,.25), inset 0 0 0 1px rgba(255,255,255,.08);
      }
      .dil-avatar-svg{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        display:block;
      }
      .dil-avatar-switch{
        margin:12px auto 0;
        padding:6px;
        display:flex;
        gap:6px;
        justify-content:center;
        background:rgba(15,23,42,.85);
        border:1px solid rgba(148,163,184,.35);
        border-radius:999px;
        width:max-content;
        max-width:100%;
      }
      .dil-avatar-switch button,
      .dil-avatar-actions button,
      .dil-avatar-panel button{
        border:0;
        border-radius:999px;
        padding:10px 14px;
        font-weight:800;
        cursor:pointer;
        background:transparent;
        color:#cbd5e1;
      }
      .dil-avatar-switch button.active{
        background:linear-gradient(135deg,#2563eb,#3b82f6);
        color:white;
      }
      .dil-avatar-actions{
        margin:12px auto 0;
        display:flex;
        gap:8px;
        justify-content:center;
        flex-wrap:wrap;
      }
      .dil-avatar-actions button{
        background:linear-gradient(135deg,#2563eb,#3b82f6);
        color:#fff;
        border-radius:18px;
        padding:12px 16px;
      }
      .dil-avatar-panel{
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        background:#0b1120;
        color:#e5e7eb;
        border:1px solid rgba(148,163,184,.25);
        border-radius:18px;
        padding:14px;
        max-width:900px;
      }
      .dil-avatar-panel h3{
        margin:0 0 10px;
        font-size:18px;
      }
      .dil-avatar-grid{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
        gap:12px;
      }
      .dil-avatar-card{
        background:rgba(15,23,42,.85);
        border:1px solid rgba(148,163,184,.25);
        border-radius:14px;
        padding:12px;
      }
      .dil-avatar-card h4{
        margin:0 0 8px;
        color:#93c5fd;
      }
      .dil-avatar-row{
        display:grid;
        grid-template-columns:92px 1fr 54px;
        gap:8px;
        align-items:center;
        margin:7px 0;
        font-size:12px;
      }
      .dil-avatar-row input[type=range]{
        width:100%;
      }
      .dil-avatar-row output{
        text-align:right;
        color:#cbd5e1;
        font-variant-numeric:tabular-nums;
      }
      .dil-avatar-small-actions{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-top:12px;
      }
      .dil-avatar-small-actions button{
        background:#1e293b;
        color:#e5e7eb;
        border-radius:12px;
        padding:9px 12px;
      }
      .dil-avatar-small-actions button.primary{
        background:#2563eb;
        color:white;
      }
      .dil-avatar-json{
        width:100%;
        min-height:120px;
        background:#020617;
        color:#dbeafe;
        border:1px solid rgba(148,163,184,.3);
        border-radius:12px;
        padding:10px;
        box-sizing:border-box;
        margin-top:10px;
        font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        font-size:12px;
      }
    `;
    var style = el("style", { id: "dil-avatar-style-v5" }, css);
    document.head.appendChild(style);
  }

  function current() {
    return state.settings[state.gender];
  }

  function svgBase(cfg) {
    if (state.gender === "erkek") return maleSvg(cfg);
    return femaleSvg(cfg);
  }

  function femaleSvg(c) {
    return `
      <svg class="dil-avatar-svg" viewBox="0 0 1000 1000" aria-label="${c.title}">
        <defs>
          <radialGradient id="daBgF" cx="50%" cy="35%" r="70%">
            <stop offset="0" stop-color="#ffffff"/>
            <stop offset="1" stop-color="#dbeafe"/>
          </radialGradient>
          <linearGradient id="daSkinF" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#ffe2bf"/>
            <stop offset="1" stop-color="${c.face}"/>
          </linearGradient>
          <linearGradient id="daHairF" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stop-color="${c.hair2}"/>
            <stop offset="1" stop-color="${c.hair}"/>
          </linearGradient>
        </defs>
        <rect width="1000" height="1000" fill="url(#daBgF)"/>
        <g id="hair-back">
          <path d="M248 708 C180 575 194 300 355 210 C470 145 642 168 733 286 C821 402 826 616 744 760 C684 866 552 886 500 812 C434 894 304 826 248 708Z" fill="url(#daHairF)"/>
          <path d="M202 805 C284 770 291 653 272 530 C344 625 365 772 300 900Z" fill="#3f1f17" opacity=".55"/>
          <path d="M798 805 C716 770 709 653 728 530 C656 625 635 772 700 900Z" fill="#3f1f17" opacity=".55"/>
        </g>
        <path d="M356 762 C378 860 622 860 644 762 L644 642 L356 642Z" fill="url(#daSkinF)"/>
        <path d="M266 1000 C288 848 386 790 500 790 C614 790 712 848 734 1000Z" fill="${c.cloth}"/>
        <path d="M360 820 L500 1000 L640 820 C590 850 410 850 360 820Z" fill="#fff"/>
        <path d="M342 840 L456 1000 L276 1000 C286 925 306 875 342 840Z" fill="${c.cloth2}" opacity=".85"/>
        <path d="M658 840 L544 1000 L724 1000 C714 925 694 875 658 840Z" fill="${c.cloth2}" opacity=".85"/>
        <ellipse cx="296" cy="470" rx="42" ry="66" fill="url(#daSkinF)"/>
        <ellipse cx="704" cy="470" rx="42" ry="66" fill="url(#daSkinF)"/>
        <path d="M322 400 C330 250 670 250 678 400 L662 610 C650 750 570 805 500 805 C430 805 350 750 338 610Z" fill="url(#daSkinF)"/>
        <path d="M322 384 C388 258 556 255 675 382 C672 302 600 210 498 210 C392 210 324 300 322 384Z" fill="url(#daHairF)"/>
        <path d="M322 386 C420 360 548 300 622 238 C585 215 485 197 398 236 C342 261 312 322 322 386Z" fill="#6b2d1f" opacity=".8"/>
        <path d="M500 448 C490 505 470 542 465 575 C482 590 519 590 535 575 C529 540 510 504 500 448Z" fill="#d8956e" opacity=".48"/>
        <path d="M472 607 C486 618 514 618 528 607" fill="none" stroke="#be7654" stroke-width="6" stroke-linecap="round" opacity=".45"/>
        <g id="eyes-base">
          <path d="M360 408 C386 380 438 382 462 410 C432 432 388 432 360 408Z" fill="white"/>
          <path d="M538 410 C562 382 614 380 640 408 C612 432 568 432 538 410Z" fill="white"/>
          <circle cx="413" cy="409" r="20" fill="${c.eye}"/>
          <circle cx="587" cy="409" r="20" fill="${c.eye}"/>
          <circle cx="420" cy="401" r="6" fill="white" opacity=".9"/>
          <circle cx="594" cy="401" r="6" fill="white" opacity=".9"/>
        </g>
        <circle cx="300" cy="612" r="16" fill="#fff"/>
        <circle cx="700" cy="612" r="16" fill="#fff"/>
      </svg>
    `;
  }

  function maleSvg(c) {
    return `
      <svg class="dil-avatar-svg" viewBox="0 0 1000 1000" aria-label="${c.title}">
        <defs>
          <radialGradient id="daBgM" cx="50%" cy="35%" r="72%">
            <stop offset="0" stop-color="#ffffff"/>
            <stop offset="1" stop-color="#e0f2fe"/>
          </radialGradient>
          <linearGradient id="daSkinM" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="#ffddbd"/>
            <stop offset="1" stop-color="${c.face}"/>
          </linearGradient>
          <linearGradient id="daHairM" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stop-color="${c.hair2}"/>
            <stop offset="1" stop-color="${c.hair}"/>
          </linearGradient>
        </defs>
        <rect width="1000" height="1000" fill="url(#daBgM)"/>
        <path d="M290 1000 C315 835 392 770 500 770 C608 770 685 835 710 1000Z" fill="${c.cloth}"/>
        <path d="M392 802 L500 1000 L608 802 C570 836 430 836 392 802Z" fill="#e0f2fe"/>
        <path d="M325 842 L450 1000 L270 1000 C282 920 300 875 325 842Z" fill="${c.cloth2}" opacity=".85"/>
        <path d="M675 842 L550 1000 L730 1000 C718 920 700 875 675 842Z" fill="${c.cloth2}" opacity=".85"/>
        <ellipse cx="304" cy="475" rx="40" ry="68" fill="url(#daSkinM)"/>
        <ellipse cx="696" cy="475" rx="40" ry="68" fill="url(#daSkinM)"/>
        <path d="M322 382 C330 245 670 245 678 382 L660 600 C650 720 575 790 500 790 C425 790 350 720 340 600Z" fill="url(#daSkinM)"/>
        <path d="M315 395 C300 290 360 180 498 174 C645 168 710 284 684 402 C642 324 360 330 315 395Z" fill="url(#daHairM)"/>
        <path d="M326 398 C406 337 538 319 674 392 C662 290 572 220 470 235 C370 250 320 330 326 398Z" fill="#35170f" opacity=".34"/>
        <path d="M350 548 C350 683 410 800 500 800 C590 800 650 683 650 548 C628 628 572 650 520 610 C508 600 492 600 480 610 C428 650 372 628 350 548Z" fill="${c.hair}" opacity=".98"/>
        <ellipse cx="500" cy="584" rx="48" ry="34" fill="url(#daSkinM)"/>
        <path d="M500 448 C490 510 468 548 462 578 C482 598 518 598 538 578 C532 548 510 510 500 448Z" fill="#c77750" opacity=".42"/>
        <path d="M472 606 C486 616 514 616 528 606" fill="none" stroke="#aa6042" stroke-width="6" stroke-linecap="round" opacity=".45"/>
        <g id="eyes-base">
          <path d="M362 402 C386 380 435 382 458 406 C430 426 390 426 362 402Z" fill="white"/>
          <path d="M542 406 C565 382 614 380 638 402 C610 426 570 426 542 406Z" fill="white"/>
          <circle cx="412" cy="404" r="18" fill="${c.eye}"/>
          <circle cx="588" cy="404" r="18" fill="${c.eye}"/>
          <circle cx="419" cy="397" r="5" fill="white" opacity=".9"/>
          <circle cx="595" cy="397" r="5" fill="white" opacity=".9"/>
        </g>
      </svg>
    `;
  }

  function overlaySvg(c) {
    var m = mouthShapePath(c, state.mouth);
    var brows = "";
    if (c.browVisible) {
      brows = browSvg(c, "left") + browSvg(c, "right");
    }
    return `
      <svg class="dil-avatar-svg" viewBox="0 0 1000 1000" aria-hidden="true">
        <g id="da-brows" opacity="${c.browOpacity}">
          ${brows}
        </g>
        <g id="da-blink" style="display:${state.isBlinking ? "block" : "none"}">
          ${eyeLidSvg(c, "left")}
          ${eyeLidSvg(c, "right")}
        </g>
        <g id="da-mouth"
           transform="translate(${c.mouthX} ${c.mouthY}) rotate(${c.mouthRotate}) scale(${c.mouthScale})"
           opacity="${c.mouthOpacity}">
          ${m}
        </g>
      </svg>
    `;
  }

  function browSvg(c, side) {
    var x = side === "left" ? c.leftBrowX : c.rightBrowX;
    var y = side === "left" ? c.leftBrowY : c.rightBrowY;
    var rot = side === "left" ? c.leftBrowRotate : c.rightBrowRotate;
    var w = c.browWidth, h = c.browHeight, p = c.browPeak;
    var flip = side === "left" ? 1 : -1;
    return `
      <path d="M ${-w/2} ${h/2} C ${-w/4} ${-p}, ${w/4} ${-p}, ${w/2} ${h/2}"
        transform="translate(${x} ${y}) rotate(${rot}) scale(${flip} 1)"
        fill="none" stroke="${c.hair}" stroke-width="${c.browStroke}" stroke-linecap="round"/>
    `;
  }

  function eyeLidSvg(c, side) {
    var x = side === "left" ? c.leftEyeX : c.rightEyeX;
    var y = side === "left" ? c.leftEyeY : c.rightEyeY;
    var w = c.eyeW, h = c.eyeH;
    return `
      <path d="M ${x - w/2} ${y} C ${x - w/4} ${y + c.eyeCurve}, ${x + w/4} ${y + c.eyeCurve}, ${x + w/2} ${y}"
        fill="none" stroke="#2b1a12" stroke-width="${c.eyeStroke}" stroke-linecap="round"/>
      <ellipse cx="${x}" cy="${y - 1}" rx="${w/2 + 6}" ry="${Math.max(8, h/2)}" fill="${c.face}" opacity=".92"/>
      <path d="M ${x - w/2} ${y} C ${x - w/4} ${y + c.eyeCurve}, ${x + w/4} ${y + c.eyeCurve}, ${x + w/2} ${y}"
        fill="none" stroke="#2b1a12" stroke-width="${c.eyeStroke}" stroke-linecap="round"/>
    `;
  }

  function mouthShapePath(c, shape) {
    var w = c.mouthWidth;
    var h = c.mouthHeight;
    var lip = c.lipColor;
    var dark = c.mouthColor;

    if (shape === "open") {
      return `
        <ellipse cx="0" cy="0" rx="${w * .45}" ry="${h * .70}" fill="${lip}"/>
        <ellipse cx="0" cy="${h * .05}" rx="${w * .34}" ry="${h * .48}" fill="${dark}"/>
        <path d="M ${-w*.25} ${-h*.28} C ${-w*.05} ${-h*.42}, ${w*.05} ${-h*.42}, ${w*.25} ${-h*.28}" fill="#fff" opacity=".95"/>
      `;
    }
    if (shape === "round") {
      return `
        <ellipse cx="0" cy="0" rx="${w * .34}" ry="${h * .62}" fill="${lip}"/>
        <ellipse cx="0" cy="0" rx="${w * .20}" ry="${h * .38}" fill="${dark}"/>
      `;
    }
    if (shape === "wide") {
      return `
        <path d="M ${-w*.55} 0 C ${-w*.25} ${h*.34}, ${w*.25} ${h*.34}, ${w*.55} 0 C ${w*.25} ${h*.55}, ${-w*.25} ${h*.55}, ${-w*.55} 0Z" fill="${lip}"/>
        <path d="M ${-w*.42} ${h*.08} C ${-w*.16} ${h*.28}, ${w*.16} ${h*.28}, ${w*.42} ${h*.08}" fill="none" stroke="${dark}" stroke-width="7" stroke-linecap="round"/>
      `;
    }
    if (shape === "closed") {
      return `
        <path d="M ${-w*.48} 0 C ${-w*.20} ${-h*.16}, ${w*.20} ${-h*.16}, ${w*.48} 0 C ${w*.20} ${h*.20}, ${-w*.20} ${h*.20}, ${-w*.48} 0Z" fill="${lip}"/>
        <path d="M ${-w*.42} 0 C ${-w*.15} ${h*.08}, ${w*.15} ${h*.08}, ${w*.42} 0" fill="none" stroke="${dark}" stroke-width="6" stroke-linecap="round" opacity=".65"/>
      `;
    }
    if (shape === "teeth") {
      return `
        <path d="M ${-w*.48} 0 C ${-w*.20} ${-h*.28}, ${w*.20} ${-h*.28}, ${w*.48} 0 C ${w*.25} ${h*.32}, ${-w*.25} ${h*.32}, ${-w*.48} 0Z" fill="${lip}"/>
        <rect x="${-w*.26}" y="${-h*.12}" width="${w*.52}" height="${h*.22}" rx="6" fill="#fff"/>
        <path d="M ${-w*.36} ${h*.08} C ${-w*.12} ${h*.22}, ${w*.12} ${h*.22}, ${w*.36} ${h*.08}" fill="none" stroke="${dark}" stroke-width="5" stroke-linecap="round" opacity=".55"/>
      `;
    }
    // rest
    return `
      <path d="M ${-w*.45} 0 C ${-w*.18} ${h*.18}, ${w*.18} ${h*.18}, ${w*.45} 0"
        fill="none" stroke="${dark}" stroke-width="8" stroke-linecap="round"/>
      <path d="M ${-w*.28} ${h*.10} C ${-w*.08} ${h*.24}, ${w*.08} ${h*.24}, ${w*.28} ${h*.10}"
        fill="none" stroke="${lip}" stroke-width="6" stroke-linecap="round" opacity=".65"/>
    `;
  }

  function render() {
    if (!state.svgWrap) return;
    var c = current();
    var theme = c.theme || "#3b82f6";
    if (state.root) state.root.style.setProperty("--da-theme", theme);
    state.svgWrap.innerHTML = svgBase(c) + overlaySvg(c);
    updateSwitchButtons();
    updateControlOutputs();
  }

  function mount(target) {
    loadSettings();
    injectCss();

    var host = typeof target === "string" ? document.getElementById(target) : target;
    if (!host) throw new Error("DilAvatar.mount: hedef eleman bulunamadı.");

    state.host = host;
    host.innerHTML = "";

    var root = el("div", { class: "dil-avatar-box" });
    var frame = el("div", { class: "dil-avatar-frame" });
    var svgWrap = el("div");
    frame.appendChild(svgWrap);

    var sw = el("div", { class: "dil-avatar-switch" });
    var b1 = el("button", { type: "button", "data-da-gender": "kadin" }, "Kadın Avatar");
    var b2 = el("button", { type: "button", "data-da-gender": "erkek" }, "Erkek Avatar");
    b1.onclick = function () { setGender("kadin"); };
    b2.onclick = function () { setGender("erkek"); };
    sw.appendChild(b1);
    sw.appendChild(b2);

    root.appendChild(frame);
    root.appendChild(sw);
    host.appendChild(root);

    state.root = root;
    state.svgWrap = svgWrap;

    render();
    scheduleBlink();
    return root;
  }

  function updateSwitchButtons() {
    if (!state.root) return;
    var btns = state.root.querySelectorAll("[data-da-gender]");
    Array.prototype.forEach.call(btns, function (b) {
      b.classList.toggle("active", b.getAttribute("data-da-gender") === state.gender);
    });
  }

  function setGender(g) {
    if (g !== "kadin" && g !== "erkek") return;
    state.gender = g;
    state.mouth = "rest";
    saveSettings();
    render();
  }

  function getGender() {
    return state.gender;
  }

  function setMouth(shape) {
    if (["rest", "open", "round", "wide", "closed", "teeth"].indexOf(shape) < 0) shape = "rest";
    state.mouth = shape;
    render();
  }

  function visemeForChar(ch) {
    ch = String(ch || "").toLocaleLowerCase("tr-TR");
    if ("aeâ".indexOf(ch) >= 0) return "open";
    if ("ou".indexOf(ch) >= 0) return "round";
    if ("ıiüöy".indexOf(ch) >= 0) return "wide";
    if ("mbp".indexOf(ch) >= 0) return "closed";
    if ("fv".indexOf(ch) >= 0) return "teeth";
    if (/\s/.test(ch)) return "rest";
    return "rest";
  }

  function clearSpeaking() {
    if (state.speakingTimer) {
      clearTimeout(state.speakingTimer);
      state.speakingTimer = null;
    }
  }

  function speakText(text, durationMs) {
    stop(false);
    text = String(text || "");
    var chars = Array.prototype.slice.call(text);
    if (!chars.length) {
      setMouth("rest");
      return;
    }

    var total = Number(durationMs);
    var per = total && isFinite(total) ? total / chars.length : 110;
    per = clamp(per, 60, 150);

    var i = 0;
    function step() {
      if (i >= chars.length) {
        setMouth("rest");
        state.speakingTimer = null;
        return;
      }
      setMouth(visemeForChar(chars[i]));
      i += 1;
      state.speakingTimer = setTimeout(step, per);
    }
    step();
  }

  function blinkOnce() {
    state.isBlinking = true;
    render();
    if (state.blinkOffTimer) clearTimeout(state.blinkOffTimer);
    state.blinkOffTimer = setTimeout(function () {
      state.isBlinking = false;
      render();
    }, 150);
  }

  function scheduleBlink() {
    if (state.blinkTimer) clearTimeout(state.blinkTimer);
    var next = 2500 + Math.random() * 2500;
    state.blinkTimer = setTimeout(function () {
      blinkOnce();
      scheduleBlink();
    }, next);
  }

  function thinking(on) {
    state.isThinking = !!on;
    if (state.thinkingTimer) {
      clearInterval(state.thinkingTimer);
      state.thinkingTimer = null;
    }
    if (!on) {
      setMouth("rest");
      return;
    }
    var flip = false;
    state.thinkingTimer = setInterval(function () {
      flip = !flip;
      setMouth(flip ? "closed" : "rest");
    }, 520);
  }

  function stop(renderNow) {
    clearSpeaking();
    if (state.thinkingTimer) {
      clearInterval(state.thinkingTimer);
      state.thinkingTimer = null;
    }
    state.isThinking = false;
    state.mouth = "rest";
    if (renderNow !== false) render();
  }

  function mountControlPanel(target) {
    if (!state.settings) loadSettings();
    injectCss();
    var host = typeof target === "string" ? document.getElementById(target) : target;
    if (!host) throw new Error("DilAvatar.mountControlPanel: hedef eleman bulunamadı.");
    state.controls = [];

    var panel = el("div", { class: "dil-avatar-panel" });
    panel.innerHTML = `
      <h3>Avatar Ayarlama Paneli</h3>
      <div class="dil-avatar-grid">
        <div class="dil-avatar-card" data-section="mouth"><h4>Ağız</h4></div>
        <div class="dil-avatar-card" data-section="eyes"><h4>Göz / Göz Kırpma</h4></div>
        <div class="dil-avatar-card" data-section="brow"><h4>Kaş</h4></div>
      </div>
      <div class="dil-avatar-small-actions">
        <button class="primary" data-act="testSpeak">Konuşma test</button>
        <button data-act="blink">Göz test</button>
        <button data-mouth="rest">rest</button>
        <button data-mouth="open">open</button>
        <button data-mouth="round">round</button>
        <button data-mouth="wide">wide</button>
        <button data-mouth="closed">closed</button>
        <button data-mouth="teeth">teeth</button>
        <button data-act="resetCurrent">Bu avatarı sıfırla</button>
        <button data-act="resetAll">Tümünü sıfırla</button>
        <button data-act="export">JSON getir</button>
        <button data-act="import">JSON yükle</button>
      </div>
      <textarea class="dil-avatar-json" placeholder="JSON ayarları burada görünür / buraya yapıştırılır"></textarea>
    `;
    host.innerHTML = "";
    host.appendChild(panel);

    var mouth = panel.querySelector('[data-section="mouth"]');
    var eyes = panel.querySelector('[data-section="eyes"]');
    var brow = panel.querySelector('[data-section="brow"]');

    addRange(mouth, "mouthX", "Ağız X", 250, 750, 1);
    addRange(mouth, "mouthY", "Ağız Y", 350, 760, 1);
    addRange(mouth, "mouthScale", "Ağız ölçek", .35, 2.2, .01);
    addRange(mouth, "mouthWidth", "Ağız genişlik", 20, 220, 1);
    addRange(mouth, "mouthHeight", "Ağız yükseklik", 8, 140, 1);
    addRange(mouth, "mouthRotate", "Ağız açı", -45, 45, 1);
    addRange(mouth, "mouthOpacity", "Ağız opaklık", 0, 1, .01);

    addRange(eyes, "leftEyeX", "Sol göz X", 250, 520, 1);
    addRange(eyes, "leftEyeY", "Sol göz Y", 250, 560, 1);
    addRange(eyes, "rightEyeX", "Sağ göz X", 480, 750, 1);
    addRange(eyes, "rightEyeY", "Sağ göz Y", 250, 560, 1);
    addRange(eyes, "eyeW", "Kapak genişlik", 20, 150, 1);
    addRange(eyes, "eyeH", "Kapak yükseklik", 6, 80, 1);
    addRange(eyes, "eyeStroke", "Kapak kalınlık", 1, 24, 1);
    addRange(eyes, "eyeCurve", "Kapak eğrisi", -40, 60, 1);

    addCheckbox(brow, "browVisible", "Kaş göster");
    addRange(brow, "browOpacity", "Kaş opaklık", 0, 1, .01);
    addRange(brow, "browWidth", "Kaş genişlik", 20, 160, 1);
    addRange(brow, "browHeight", "Kaş yükseklik", 0, 70, 1);
    addRange(brow, "browPeak", "Kaş tepe", -20, 70, 1);
    addRange(brow, "browStroke", "Kaş kalınlık", 1, 30, 1);
    addRange(brow, "leftBrowX", "Sol kaş X", 250, 520, 1);
    addRange(brow, "leftBrowY", "Sol kaş Y", 200, 500, 1);
    addRange(brow, "rightBrowX", "Sağ kaş X", 480, 750, 1);
    addRange(brow, "rightBrowY", "Sağ kaş Y", 200, 500, 1);
    addRange(brow, "leftBrowRotate", "Sol kaş açı", -60, 60, 1);
    addRange(brow, "rightBrowRotate", "Sağ kaş açı", -60, 60, 1);

    panel.addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (!b) return;
      var m = b.getAttribute("data-mouth");
      if (m) setMouth(m);
      var act = b.getAttribute("data-act");
      if (act === "blink") blinkOnce();
      if (act === "testSpeak") speakText("merhaba bugün ingilizce çalışıyoruz", 3200);
      if (act === "resetCurrent") {
        state.settings[state.gender] = clone(DEFAULTS[state.gender]);
        saveSettings();
        render();
      }
      if (act === "resetAll") {
        state.settings = clone(DEFAULTS);
        safeRemove(STORAGE_KEY);
        saveSettings();
        render();
      }
      if (act === "export") {
        panel.querySelector(".dil-avatar-json").value = JSON.stringify(state.settings, null, 2);
      }
      if (act === "import") {
        try {
          var data = JSON.parse(panel.querySelector(".dil-avatar-json").value);
          ["kadin", "erkek"].forEach(function (g) {
            if (data[g]) Object.assign(state.settings[g], data[g]);
          });
          saveSettings();
          render();
        } catch (e) {
          alert("JSON okunamadı.");
        }
      }
    });

    updateControlOutputs();
    return panel;
  }

  function addRange(parent, key, label, min, max, step) {
    var row = el("label", { class: "dil-avatar-row" });
    row.innerHTML = `
      <span>${label}</span>
      <input type="range" min="${min}" max="${max}" step="${step}" data-key="${key}">
      <output data-out="${key}"></output>
    `;
    parent.appendChild(row);
    var input = row.querySelector("input");
    input.addEventListener("input", function () {
      current()[key] = Number(input.value);
      saveSettings();
      render();
    });
    state.controls.push({ key: key, input: input, out: row.querySelector("output") });
  }

  function addCheckbox(parent, key, label) {
    var row = el("label", { class: "dil-avatar-row" });
    row.innerHTML = `
      <span>${label}</span>
      <input type="checkbox" data-key="${key}">
      <output data-out="${key}"></output>
    `;
    parent.appendChild(row);
    var input = row.querySelector("input");
    input.addEventListener("change", function () {
      current()[key] = !!input.checked;
      saveSettings();
      render();
    });
    state.controls.push({ key: key, input: input, out: row.querySelector("output"), checkbox: true });
  }

  function updateControlOutputs() {
    if (!state.controls || !state.controls.length || !state.settings) return;
    var c = current();
    state.controls.forEach(function (ctl) {
      if (!ctl.input) return;
      if (ctl.checkbox) {
        ctl.input.checked = !!c[ctl.key];
        ctl.out.textContent = c[ctl.key] ? "açık" : "kapalı";
      } else {
        ctl.input.value = c[ctl.key];
        ctl.out.textContent = String(Math.round(Number(c[ctl.key]) * 100) / 100);
      }
    });
  }

  function getSettings() {
    if (!state.settings) loadSettings();
    return clone(state.settings);
  }

  function setSettings(obj) {
    if (!state.settings) loadSettings();
    ["kadin", "erkek"].forEach(function (g) {
      if (obj && obj[g]) Object.assign(state.settings[g], obj[g]);
    });
    saveSettings();
    render();
  }

  global.DilAvatar = {
    mount: mount,
    mountControlPanel: mountControlPanel,
    setMouth: setMouth,
    speakText: speakText,
    thinking: thinking,
    stop: function () { stop(true); },
    setGender: setGender,
    getGender: getGender,
    visemeForChar: visemeForChar,
    blink: blinkOnce,
    getSettings: getSettings,
    setSettings: setSettings
  };

})(window);
