/* tts-avatar-long-sync-fix.js
   - Rengi Yeşil olan tüm cümleleri en-US okur.
   - Diğer tüm açıklamaları tr-TR okur.
   - Dash (---) ve tablo çizgilerini temizler.
   - Okunan cümlenin arka planını PEMBE (#ff69b4) dolgu rengiyle vurgular.
*/
(function(){
"use strict";
if(window.__LongTTSAvatarSyncFixV7) return;
window.__LongTTSAvatarSyncFixV7 = true;

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

// "Dash" (---), tablo simgeleri ve gereksiz karakter temizliği
function cleanTextForSpeech(s) {
  return String(s || "")
    .replace(/[-─━_]{2,}/g, " ")      // --- Çizgileri tamamen sil
    .replace(/```[\s\S]*?```/g, " ")   // Kod bloklarını sil
    .replace(/`([^`]+)`/g, "$1")      // Inline backtick temizle
    .replace(/[*_#~|:<>-]/g, " ")     // Tablo ve biçimlendirmeleri sil
    .replace(/\s+/g, " ")
    .trim();
}

// Bir öğenin ekrandaki renginin "YEŞİL" olup olmadığını kontrol eder
function checkIsGreen(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  
  if (el.classList.contains("green") || el.style.color === "green" || el.getAttribute("color") === "green") {
    return true;
  }

  const computed = window.getComputedStyle(el);
  const color = computed.color; // "rgb(r, g, b)"
  
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
    activeHighlightEl.style.color = "";
    activeHighlightEl.style.borderRadius = "";
    activeHighlightEl = null;
  }
}

// Vurgulama rengi PEMBE olarak güncellendi
function setHighlight(targetEl) {
  clearHighlight();
  if (!targetEl) return;

  activeHighlightEl = targetEl;
  targetEl.style.transition = "background-color 0.2s ease";
  targetEl.style.backgroundColor = "#ff69b4"; // Canlı Pembe Dolgu Rengi (Hot Pink)
  targetEl.style.color = "#ffffff";             // Okunabilirlik için beyaz yazı
  targetEl.style.borderRadius = "4px";
  targetEl.style.padding = "2px 4px";
}

/**
 * Ekrandaki DOM ağacını tek tek tarayarak metin parçalarını yeşil/siyah durumuna göre gruplar.
 */
function getSegmentsFromDOM() {
  const segments = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  
  let node;
  while (node = walker.nextNode()) {
    const text = cleanTextForSpeech(node.textContent);
    if (!text || text.length < 1) continue;

    let parent = node.parentElement;
    let isGreen = false;

    // Elemanın veya üst kapsayıcılarının yeşil renkte olup olmadığını sorgula
    while (parent && parent !== document.body) {
      if (checkIsGreen(parent)) {
        isGreen = true;
        break;
      }
      parent = parent.parentElement;
    }

    segments.push({
      text: text,
      lang: isGreen ? "en-US" : "tr-TR",
      element: node.parentElement
    });
  }
  return segments;
}

const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);

// speechSynthesis.speak metodu araya girilerek eziliyor
window.speechSynthesis.speak = function(utterance) {
  const segments = getSegmentsFromDOM();

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
      
      // Okunan elemanı ekranda pembe dolgu ile vurgula
      setHighlight(seg.element);

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

  // DOM bulunamazsa standart okuma yap
  if (utterance && utterance.text) {
    utterance.text = cleanTextForSpeech(utterance.text);
  }
  originalSpeak(utterance);
};

})();