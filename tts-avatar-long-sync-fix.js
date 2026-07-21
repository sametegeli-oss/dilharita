/* tts-avatar-long-sync-fix.js
   - yeşil renkli cümleler en-US, geri kalanı tr-TR seslendirilir.
   - speechSynthesis.speak monkey-patch edilerek mevcut sisteme tam entegre edilmiştir.
*/
(function(){
"use strict";
if(window.__LongTTSAvatarSyncFixV3) return;
window.__LongTTSAvatarSyncFixV3 = true;

const DH_TTS_DEFAULTS = { trRate: 0.96, trPitch: 1.0, enRate: 0.88, enPitch: 1.0 };

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
  
  var c = dhTtsCfg();
  var isTr = /^tr/i.test(lang);
  var want = isTr ? c.trVoice : c.enVoice;
  
  if (want) {
    var matched = voices.find(function(v) { return v.voiceURI === want || v.name === want; });
    if (matched) return matched;
  }
  
  var exactMatch = voices.find(function(v) { return v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0,2)); });
  return exactMatch || null;
}

function dhApplyVoice(u, lang) {
  var c = dhTtsCfg();
  var isTr = /^tr/i.test(lang);
  u.rate = isTr ? c.trRate : c.enRate;
  u.pitch = isTr ? c.trPitch : c.enPitch;
  u.lang = lang;
  
  var v = dhPickVoice(lang);
  if (v) { u.voice = v; }
}

function dhSpeakClean(s) {
  return String(s || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_#~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sayfadaki yeşil renkteki DOM elemanlarını bulur ve text parçalarını dil bilgisiyle ayırır.
 */
function getLanguageSegmentsFromDOM() {
  const segments = [];
  
  // Yeşil tonu kontrolü (RGB)
  function isGreen(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const color = window.getComputedStyle(el).color;
    const rgb = color.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      const r = parseInt(rgb[0], 10);
      const g = parseInt(rgb[1], 10);
      const b = parseInt(rgb[2], 10);
      // Yeşil baskınlığı tespiti
      if (g > 90 && g > r * 1.15 && g > b * 1.15) return true;
    }
    return false;
  }

  // Sayfada konuşma metninin bulunduğu tüm alanları tara
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walker.nextNode()) {
    const txt = dhSpeakClean(node.textContent);
    if (!txt) continue;

    let parent = node.parentElement;
    let greenFound = false;
    while (parent && parent !== document.body) {
      if (isGreen(parent)) {
        greenFound = true;
        break;
      }
      parent = parent.parentElement;
    }

    segments.push({
      text: txt,
      lang: greenFound ? "en-US" : "tr-TR"
    });
  }
  return segments;
}

// Orijinal speechSynthesis.speak metodunu yakalıyoruz (Intercept)
const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);

window.speechSynthesis.speak = function(utterance) {
  if (!utterance || !utterance.text) {
    return originalSpeak(utterance);
  }

  // Eğer sistem arka planda tek bir uzun metin gönderiyorsa, DOM üzerindeki yeşil/siyah duruma göre parçala
  const domSegments = getLanguageSegmentsFromDOM();
  
  // Eğer DOM'dan yeşil renkli segmentler başarıyla çıkarıldıysa onları sırayla oku
  if (domSegments.length > 0) {
    window.speechSynthesis.cancel(); // Mevcut kuyruğu temizle
    
    let index = 0;
    function playNextSegment() {
      if (index >= domSegments.length) return;

      const seg = domSegments[index];
      const newUtterance = new SpeechSynthesisUtterance(seg.text);
      dhApplyVoice(newUtterance, seg.lang);

      newUtterance.onend = function() {
        index++;
        playNextSegment();
      };
      newUtterance.onerror = function() {
        index++;
        playNextSegment();
      };

      originalSpeak(newUtterance);
    }

    playNextSegment();
    return;
  }

  // DOM okunamazsa gelen standart utterance'ı olduğu gibi çalıştır
  originalSpeak(utterance);
};

})();