/* tts-avatar-long-sync-fix.js
   - Yeşil cümleler: en-US (İngilizce)
   - Diğer cümleler: tr-TR (Türkçe)
   - Okunan cümle canlı olarak sarı dolgu rengiyle vurgulanır.
   - Dash (---) ve Markdown simgeleri temizlendi.
*/
(function(){
"use strict";
if(window.__LongTTSAvatarSyncFixV4) return;
window.__LongTTSAvatarSyncFixV4 = true;

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
  
  var exactMatch = voices.find(function(v) { 
    return v.lang && v.lang.toLowerCase().replace('_','-').startsWith(lang.toLowerCase().slice(0,2)); 
  });
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

// "Dash" okunmasını engellemek için metin temizliği
function dhCleanText(s) {
  return String(s || "")
    .replace(/[-─━_]{2,}/g, " ") // --- veya ___ çizgi karakterlerini tamamen yok et
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_#~|:<>-]/g, " ") // Noktalama ve tablo simgelerini temizle
    .replace(/\s+/g, " ")
    .trim();
}

// Yeşil renk tespiti
function isElementGreen(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  
  const style = window.getComputedStyle(el);
  const color = style.color;
  
  // Standart yeşil class veya inline kontrolü
  if (el.classList.contains("green") || el.style.color === "green") return true;

  const rgb = color.match(/\d+/g);
  if (rgb && rgb.length >= 3) {
    const r = parseInt(rgb[0], 10);
    const g = parseInt(rgb[1], 10);
    const b = parseInt(rgb[2], 10);
    
    // Yeşil renk baskınlığı
    if (g > 80 && g > r * 1.15 && g > b * 1.15) {
      return true;
    }
  }
  return false;
}

let activeHighlightEl = null;

function clearHighlight() {
  if (activeHighlightEl) {
    activeHighlightEl.style.backgroundColor = "";
    activeHighlightEl.style.borderRadius = "";
    activeHighlightEl.style.transition = "";
    activeHighlightEl = null;
  }
}

function setHighlight(node) {
  clearHighlight();
  if (!node) return;
  
  let target = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (target) {
    activeHighlightEl = target;
    target.style.transition = "background-color 0.2s ease";
    target.style.backgroundColor = "#ffeb3b"; // Parlak sarı dolgu
    target.style.color = "#000000"; // Okunabilirlik için siyah yazı
    target.style.borderRadius = "4px";
  }
}

/**
 * DOM Ağacını tarayarak yeşil elemanları en-US, kalanları tr-TR olarak ayırır.
 */
function extractSegmentsFromDOM() {
  const segments = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  
  let node;
  while (node = walker.nextNode()) {
    const rawText = node.textContent;
    const cleaned = dhCleanText(rawText);
    
    if (!cleaned) continue;

    let parent = node.parentElement;
    let greenFound = false;

    while (parent && parent !== document.body) {
      if (isElementGreen(parent)) {
        greenFound = true;
        break;
      }
      parent = parent.parentElement;
    }

    segments.push({
      text: cleaned,
      lang: greenFound ? "en-US" : "tr-TR",
      node: node
    });
  }
  return segments;
}

const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);

window.speechSynthesis.speak = function(utterance) {
  const segments = extractSegmentsFromDOM();

  if (segments.length > 0) {
    window.speechSynthesis.cancel();
    clearHighlight();

    let index = 0;

    function playNext() {
      if (index >= segments.length) {
        clearHighlight();
        return;
      }

      const seg = segments[index];
      setHighlight(seg.node);

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

      originalSpeak(u);
    }

    playNext();
    return;
  }

  // Fallback: DOM elemanları okunamazsa standart okuma yap ve çizgileri temizle
  if (utterance && utterance.text) {
    utterance.text = dhCleanText(utterance.text);
  }
  originalSpeak(utterance);
};

})();