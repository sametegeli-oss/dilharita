/* tts-avatar-long-sync-fix.js
   Uzun metinlerde ses devam ederken avatarın susmasını engeller.
   - Yeşil renkli öğeler/cümleler en-US, geri kalanı tr-TR okunur.
   - Tarayıcı seslerinin geç yüklenmesi durumu (voiceschanged) düzeltilmiştir.
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

// Tarayıcıdaki ses listesinden en uygun olanı seçer
function dhPickVoice(lang) {
  var voices = [];
  try { voices = speechSynthesis.getVoices() || []; } catch(e) {}
  if (!voices.length) return null;
  
  var c = dhTtsCfg();
  var isTr = /^tr/i.test(lang);
  var want = isTr ? c.trVoice : c.enVoice;
  
  // 1. Öncelik: Kullanıcının seçtiği özel ses
  if (want) {
    var matched = voices.find(function(v) { return v.voiceURI === want || v.name === want; });
    if (matched) return matched;
  }
  
  // 2. Öncelik: Tam dil eşleşmesi (Örn: en-US veya tr-TR)
  var exactMatch = voices.find(function(v) { return v.lang && v.lang.toLowerCase() === lang.toLowerCase(); });
  if (exactMatch) return exactMatch;

  // 3. Öncelik: Dil ailesi eşleşmesi (Örn: "en" içeren herhangi bir ses)
  var familyMatch = voices.find(function(v) { return isTr ? /^tr/i.test(v.lang || "") : /^en/i.test(v.lang || ""); });
  return familyMatch || null;
}

function dhApplyVoice(u, lang) {
  var c = dhTtsCfg();
  var isTr = (lang === "tr-TR");
  u.rate = isTr ? c.trRate : c.enRate;
  u.pitch = isTr ? c.trPitch : c.enPitch;
  u.lang = lang; // Dil kodunu doğrudan set et
  
  var v = dhPickVoice(lang);
  if (v) { 
    u.voice = v; 
  }
}

function dhSpeakClean(s) {
  var r = String(s || "");
  return r.replace(/```[\s\S]*?```/g, " ")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/[*_#~]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
}

/**
 * Bir elementin stilinden veya renginden yeşil olup olmadığını tespit eder.
 */
function isGreenElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  
  // Class ve inline stillere öncelikli bakış
  if (el.classList.contains("green") || el.classList.contains("text-green") || el.style.color === "green") {
    return true;
  }

  const style = window.getComputedStyle(el);
  const color = style.color; // "rgb(r, g, b)"
  
  const rgb = color.match(/\d+/g);
  if (rgb && rgb.length >= 3) {
    const r = parseInt(rgb[0], 10);
    const g = parseInt(rgb[1], 10);
    const b = parseInt(rgb[2], 10);
    
    // Yeşil renk tespiti (G bileşeninin belirgin şekilde yüksek olması)
    if (g > 80 && g > r * 1.2 && g > b * 1.2) {
      return true;
    }
  }
  return false;
}

/**
 * HTML Alanını tarayıp yeşil yazıları en-US, diğerlerini tr-TR olarak parçalar.
 */
function parseElementToSpeechSegments(containerEl) {
  const segments = [];

  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = dhSpeakClean(node.textContent);
      if (text) {
        let parent = node.parentElement;
        let isGreen = false;
        
        // Üst hiyerarşide yeşil renk olan bir kapsayıcı var mı kontrol et
        while (parent && parent !== containerEl) {
          if (isGreenElement(parent)) {
            isGreen = true;
            break;
          }
          parent = parent.parentElement;
        }

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
 * Seslendirmeyi başlatan ana fonksiyon
 */
window.speakSmartText = function(target) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel(); // Mevcut seslendirmeyi durdur
  }

  let segments = [];

  if (typeof target === "string") {
    segments.push({ text: dhSpeakClean(target), lang: "tr-TR" });
  } else if (target && target.nodeType) {
    segments = parseElementToSpeechSegments(target);
  }

  if (!segments.length) return;

  // Seslerin tarayıcıda yüklenmesini sağla
  const runSpeech = () => {
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

  // Sesler henüz hazır değilse listeyi bekle
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.onvoiceschanged = function() {
      speechSynthesis.onvoiceschanged = null;
      runSpeech();
    };
  } else {
    runSpeech();
  }
};

})();