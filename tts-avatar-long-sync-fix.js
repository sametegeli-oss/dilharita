/* tts-avatar-long-sync-fix.js
   - Arka plandan gelen ham metni doğrudan analiz eder.
   - Dash (---) ve karakter bozulmalarını engeller.
   - İngilizce/Türkçe cümleleri otomatik tespit edip doğru dilde okur.
   - Ekrandaki eşleşen metni canlı olarak sarı dolgu ile vurgular.
*/
(function(){
"use strict";
if(window.__LongTTSAvatarSyncFixV5) return;
window.__LongTTSAvatarSyncFixV5 = true;

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

// "Dash" ve gürültü çıkaran Markdown işaretlerini temizleme
function cleanRawText(s) {
  return String(s || "")
    .replace(/[-─━_]{2,}/g, " ")     // Çizgileri (---) tamamen kaldırır
    .replace(/```[\s\S]*?```/g, " ")  // Kod bloklarını kaldırır
    .replace(/`([^`]+)`/g, "$1")     // Inline kodları temizler
    .replace(/[*_#~|:<>-]/g, " ")    // Tablo ve biçimlendirme simgelerini siler
    .replace(/\s+/g, " ")
    .trim();
}

// Metnin İngilizce mi Türkçe mi olduğunu tespit eder
function detectLanguage(text) {
  // Türkçe karakter kontrolü (ş, ğ, ç, ı, ö, ü)
  if (/[çğışöüÇĞİŞÖÜ]/.test(text)) {
    return "tr-TR";
  }
  // Genel İngilizce kelimeler ve Latik karakter baskınlığı
  const englishWords = /\b(the|is|are|am|allowed|for|to|in|on|at|and|not|this|that|you|we|they|he|she|it|with|have|has|be|bring|limits|check|works|as|hired)\b/i;
  if (englishWords.test(text)) {
    return "en-US";
  }
  return "tr-TR";
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

// Ekran üzerindeki metni bulup sarı dolgu ile vurgular
function highlightOnScreen(phrase) {
  clearHighlight();
  if (!phrase || phrase.length < 3) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.includes(phrase)) {
      let parent = node.parentElement;
      if (parent) {
        activeHighlightEl = parent;
        parent.style.transition = "background-color 0.2s ease";
        parent.style.backgroundColor = "#ffeb3b"; // Parlak sarı dolgu
        parent.style.color = "#000000";             // Siyah metin
        parent.style.borderRadius = "4px";
        break;
      }
    }
  }
}

// Metni cümle/parça seviyesinde böler
function parseTextIntoSegments(fullText) {
  const cleaned = cleanRawText(fullText);
  // Cümle bitimleri (. ! ?) veya parantez geçişlerine göre ayırır
  const rawParts = cleaned.split(/(?<=[.!?])\s+|(?=\()|(?<=\))/g);
  
  const segments = [];
  for (let part of rawParts) {
    const txt = part.trim();
    if (!txt || txt.length < 2) continue;
    
    segments.push({
      text: txt,
      lang: detectLanguage(txt)
    });
  }
  return segments;
}

const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);

// Arka plandan gelen tüm seslendirme isteklerini yakala
window.speechSynthesis.speak = function(utterance) {
  if (!utterance || !utterance.text) {
    return originalSpeak(utterance);
  }

  const rawText = utterance.text;
  const segments = parseTextIntoSegments(rawText);

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
      highlightOnScreen(seg.text); // Ekrandaki karşılığını sarı yap

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

  originalSpeak(utterance);
};

})();