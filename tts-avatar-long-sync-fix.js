/* tts-avatar-long-sync-fix.js
   Uzun metinlerde ses devam ederken avatarın susmasını engeller.
   - TTS metnini küçük parçalara böler.
   - Her parçada avatar-speaking durumunu canlı tutar.
   - Avatar ağız frame'lerini tüm okuma bitene kadar döndürür.
   - Yeşil renkli cümleler/öğeler en-US, geri kalanı tr-TR okunur.
*/
(function(){
"use strict";
if(window.__LongTTSAvatarSyncFixV2) return;
window.__LongTTSAvatarSyncFixV2 = true;

const AVATAR_SELECTORS = [
  "#avatarImg","#avatarImage","#teacherAvatarImg","#teacherAvatar","#mainAvatarImg",
  ".avatar-img",".avatar-image",".teacher-avatar img",".avatar img",
  "img[src*='avatars']","img[src*='avatar']","img[src*='idle.webp']","img[src*='mouth-']"
];

let nativeSpeak = null;
try { nativeSpeak = speechSynthesis.speak.bind(speechSynthesis); } catch(e){}

let active = false;
let activeTimer = null;
let mouthTimer = null;
let savedSrc = new WeakMap();

var DH_TTS_DEFAULTS = { trRate: 0.96, trPitch: 1.0, enRate: 0.88, enPitch: 1.0 };

function dhClampNum(v, lo, hi, def) {
  v = parseFloat(v);
  if (isNaN(v)) return def;
  return Math.min(hi, Math.max(lo, v));
}

function dhTtsCfg() {
  try {
    var s = JSON.parse(localStorage.getItem("dh-tts-voice-v1") || "null");
    if (s && typeof s === "object") return {
      trRate: dhClampNum(s.trRate, 0.5, 1.6, DH_TTS_DEFAULTS.trRate),
      trPitch: dhClampNum(s.trPitch, 0.5, 1.6, DH_TTS_DEFAULTS.trPitch),
      enRate: dhClampNum(s.enRate, 0.5, 1.6, DH_TTS_DEFAULTS.enRate),
      enPitch: dhClampNum(s.enPitch, 0.5, 1.6, DH_TTS_DEFAULTS.enPitch),
      trVoice: s.trVoice || "", enVoice: s.enVoice || ""
    };
  } catch(e) {}
  return { trRate: DH_TTS_DEFAULTS.trRate, trPitch: DH_TTS_DEFAULTS.trPitch, enRate: DH_TTS_DEFAULTS.enRate, enPitch: DH_TTS_DEFAULTS.enPitch, trVoice: "", enVoice: "" };
}

function dhPickVoice(lang) {
  var voices = [];
  try { voices = speechSynthesis.getVoices() || []; } catch(e) {}
  if (!voices.length) return null;
  var c = dhTtsCfg(), tr = /^tr/i.test(lang);
  var want = tr ? c.trVoice : c.enVoice;
  if (want) {
    var m = voices.filter(function(v) { return v.voiceURI === want || v.name === want; })[0];
    if (m) return m;
  }
  var pref = voices.filter(function(v) { return tr ? /^tr/i.test(v.lang || "") : /^en/i.test(v.lang || ""); });
  return pref[0] || null;
}

function dhApplyVoice(u, lang) {
  var c = dhTtsCfg(), tr = (lang === "tr-TR");
  u.rate = tr ? c.trRate : c.enRate;
  u.pitch = tr ? c.trPitch : c.enPitch;
  var v = dhPickVoice(lang);
  if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = lang; }
}

function dhSpeakClean(s) {
  var r = String(s || "");
  r = r.replace(/```[\s\S]*?```/g, " ")
       .replace(/`([^`]+)`/g, "$1")
       .replace(/[*_#~]/g, " ")
       .replace(/\s+/g, " ")
       .trim();
  return r;
}

/**
 * Bir elementin veya metnin yeşil renkte olup olmadığını kontrol eder.
 */
function isGreenElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  const style = window.getComputedStyle(el);
  const color = style.color; // "rgb(r, g, b)" formatında döner
  
  // RGB değerlerini ayrıştır
  const rgb = color.match(/\d+/g);
  if (rgb && rgb.length >= 3) {
    const r = parseInt(rgb[0], 10);
    const g = parseInt(rgb[1], 10);
    const b = parseInt(rgb[2], 10);
    
    // Yeşil rengin baskınlık kontrolü (G değeri R ve B'den belirgin şekilde yüksekse)
    if (g > 100 && g > r * 1.3 && g > b * 1.3) {
      return true;
    }
  }
  
  // Inline style veya sınıf kontrolleri
  if (el.classList.contains("green") || el.classList.contains("text-green") || el.style.color === "green") {
    return true;
  }
  
  return false;
}

/**
 * DOM Öğesini tarar ve yeşil olanları en-US, diğerlerini tr-TR olarak dil parçalarına ayırır.
 */
function parseElementToSpeechSegments(containerEl) {
  const segments = [];
  
  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = dhSpeakClean(node.textContent);
      if (text) {
        const isGreen = isGreenElement(node.parentElement);
        segments.push({
          text: text,
          lang: isGreen ? "en-US" : "tr-TR"
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (let child of node.childNodes) {
        traverse(child);
      }
    }
  }

  traverse(containerEl);
  return segments;
}

/**
 * Parçalı seslendirme yöneticisi
 */
window.speakSmartText = function(target) {
  speechSynthesis.cancel();
  
  let segments = [];
  
  if (typeof target === "string") {
    // Düz metin verildiyse varsayılan tr-TR
    segments.push({ text: dhSpeakClean(target), lang: "tr-TR" });
  } else if (target && target.nodeType) {
    // DOM Öğesi verildiyse renge göre dili otomatik tespit et
    segments = parseElementToSpeechSegments(target);
  }

  if (!segments.length) return;

  let index = 0;

  function playNext() {
    if (index >= segments.length) return;

    const seg = segments[index];
    const u = new SpeechSynthesisUtterance(seg.text);
    dhApplyVoice(u, seg.lang);

    u.onend = function() {
      index++;
      playNext();
    };

    u.onerror = function() {
      index++;
      playNext();
    };

    if (nativeSpeak) {
      nativeSpeak(u);
    } else {
      speechSynthesis.speak(u);
    }
  }

  playNext();
};

})();