/* ==========================================================================
   azar-remedial.js — Gelişmiş OCR Temizleyicili & Kırmızı Vurgulu Azar Motoru v17
   ========================================================================== */

(function (global) {
  "use strict";

  var azarData = null;

  // 1. JSON Veritabanını Yükleme
  function loadAzarData() {
    if (azarData) return Promise.resolve(azarData);
    
    return fetch('./data/azar_uueg.json')
      .then(function (r) {
        if (!r.ok) throw new Error("Azar JSON veritabanı bulunamadı.");
        return r.json();
      })
      .then(function (data) {
        azarData = data;
        return azarData;
      });
  }

  // 🛠️ GELİŞMİŞ OCR HATA VE BİTİŞİK KELİME DÜZELTİCİ
  function fixOcrErrors(text) {
    if (!text) return "";

    return text
      // 1. Üst bölümlerdeki garip karakter çöplerini temizle
      .replace(/\}?\s*\\"\[[a-zA-Z0-9\s\{\}\\]+/g, '')
      
      // 2. [J EXERCISE, OJ EXERCISE, [0 EXERCISE başlık çöplerini düzelt
      .replace(/[\[\(]?[J|O|0|eTolol]*\s*(EXERCISE\s*\d+)/gi, '$1')
      
      // 3. Soru başı simge ve liste numarası çöplerini temizle
      .replace(/[@©®™]\s*—?/g, '')
      .replace(/\(\d+\)\s*/g, '')
      
      // 4. Tilde (~) gibi çizik OCR çöplerini sil
      .replace(/~{2,}/g, '')
      
      // 5. Nokta, soru işareti veya ünlemden sonra gelen bitişik harfi ayır (Notme.I -> Notme. I)
      .replace(/([a-zA-Z0-9])([.?!])([a-zA-Z])/g, '$1$2 $3')
      
      // 6. Virgül, iki nokta veya noktalı virgülden sonra boşluk koy (preference:WOULD -> preference: WOULD)
      .replace(/([a-zA-Z0-9])([,;:])([a-zA-Z])/g, '$1$2 $3')
      
      // 7. Bitişik kalmış küçük-büyük ve harf-rakam dizilimlerini ayır
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Za-z]+)(\d+)/g, '$1 $2')
      .replace(/(\d+)([A-Za-z]+)/g, '$1 $2')
      
      // 8. OCR kaynaklı yaygın yapışık kelimeleri düzelt
      .replace(/yourletter/gi, "your letter")
      .replace(/nottogotobed/gi, "not to go to bed")
      .replace(/Thatswhyl/gi, "That's why I")
      .replace(/alotaftime/gi, "a lot of time")
      .replace(/anapafteri/gi, "a nap after I")
      .replace(/eversince/gi, "ever since")
      .replace(/tothepakand/gi, "to the park and")
      
      // 9. Fazla noktaları ve boşlukları teke indir
      .replace(/\.{4,}/g, '...')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  var STOP_WORDS = ["a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with", "please"];

  function extractCoreGrammar(text) {
    var raw = String(text || "").toLowerCase();
    var cleanText = raw.replace(/[^a-z0-9\s]/g, " ");
    var words = cleanText.split(/\s+/).filter(function (w) { return w.length > 0; });
    var coreWords = words.filter(function (w) { return STOP_WORDS.indexOf(w) === -1; });

    var signatures = [];

    if (raw.indexOf("would rather") !== -1 || raw.indexOf("'d rather") !== -1) signatures.push({ phrase: "would rather", weight: 50 });
    if (raw.indexOf("would like") !== -1 || raw.indexOf("'d like") !== -1) signatures.push({ phrase: "would like", weight: 50 });
    if (raw.indexOf("had better") !== -1 || raw.indexOf("'d better") !== -1) signatures.push({ phrase: "had better", weight: 40 });
    if (raw.indexOf("used to") !== -1) signatures.push({ phrase: "used to", weight: 40 });

    coreWords.forEach(function (w) {
      if (w.length > 2) signatures.push({ phrase: w, weight: 3 });
    });

    return signatures;
  }

  function searchAzarPages(sentenceText, pages) {
    if (!pages || !pages.length) return [];

    var signatures = extractCoreGrammar(sentenceText);
    var scoredPages = [];

    pages.forEach(function (page) {
      var content = String(page.content || "").toLowerCase();
      var score = 0;

      signatures.forEach(function (sig) {
        if (content.indexOf(sig.phrase) !== -1) {
          score += sig.weight;
        }
      });

      if (score > 5) {
        scoredPages.push({
          pageNumber: page.pageNumber,
          score: score,
          content: page.content
        });
      }
    });

    scoredPages.sort(function (a, b) { return b.score - a.score; });
    return scoredPages.slice(0, 3);
  }

  // 🔴 İLGİLİ CÜMLELERİ/KALIPLARI KIRMIZI YAPMA SÜZGEÇİ
  function processAndHighlightText(content, targetSentence) {
    if (!content) return "";
    
    // 1. Önce OCR hatalarını ve bitişiklikleri temizle
    var cleanContent = fixOcrErrors(content);

    var signatures = extractCoreGrammar(targetSentence);
    var phrasesToHighlight = signatures
      .filter(function(s){ return s.weight >= 10 || s.phrase.indexOf(" ") !== -1; })
      .map(function(s){ return s.phrase; });

    if (phrasesToHighlight.length === 0) {
      phrasesToHighlight = signatures.map(function(s){ return s.phrase; });
    }

    var escapeRegex = function(str) {
      return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };

    var safeContent = cleanContent
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 2. İlgili hedef gramer kelimelerini/cümlelerini KIRMIZI ile renklendir
    phrasesToHighlight.forEach(function(phrase) {
      if (!phrase || phrase.length < 3) return;
      var regex = new RegExp("(" + escapeRegex(phrase) + ")", "gi");
      safeContent = safeContent.replace(regex, "<span style='color: #ef4444; font-weight: 800; background: rgba(239, 68, 68, 0.15); padding: 2px 5px; border-radius: 4px;'>$1</span>");
    });

    return safeContent;
  }

  function startRemedialLesson(sentenceText, targetElementId) {
    var containerId = targetElementId || "azar-result-container";
    var container = document.getElementById(containerId);

    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      var azBtn = document.getElementById("dhAzarAskBtn");
      if (azBtn && azBtn.parentNode) {
        azBtn.parentNode.appendChild(container);
      } else {
        var out = document.getElementById("out");
        if (out) out.appendChild(container);
      }
    }

    container.innerHTML = "<div style='padding:15px; text-align:center; color:#60a5fa; font-weight:bold; background:#0f172a; border:1px solid #1e293b; border-radius:10px; margin-top:12px;'>📘 Azar Veritabanında Taranıyor...</div>";

    loadAzarData().then(function (pages) {
      var matchedPages = searchAzarPages(sentenceText, pages);

      if (!matchedPages || matchedPages.length === 0) {
        container.innerHTML = "<div style='padding:15px; background:#451a03; color:#fcd34d; border-radius:10px; margin-top:12px;'>⚠️ Bu cümle için Azar veritabanında doğrudan bir sayfa eşleşmesi bulunamadı.</div>";
        return;
      }

      var pageNums = matchedPages.map(function (p) { return p.pageNumber; }).join(", ");

      var html = "";
      html += "<div class='azar-lesson-card' style='font-family: inherit; line-height: 1.6; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin: 15px 0; color:#e2e8f0;'>";

      html += "<div style='display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:10px; margin-bottom:15px;'>";
      html += "<h3 style='margin:0; color:#60a5fa; font-size:16px;'>📘 Betty Azar - İlgili Konu Sayfaları</h3>";
      html += "<span style='background:#1e3a8a; color:#93c5fd; font-weight:bold; padding:4px 10px; border-radius:15px; font-size:12px;'>Sayfa: " + pageNums + "</span>";
      html += "</div>";

      html += "<h4 style='color:#94a3b8; font-size:13px; margin-bottom:10px;'>📝 Orijinal Metinler ve İlgili Cümleler (OCR Düzeltilmiş & Kırmızı Vurgulu)</h4>";
      
      matchedPages.forEach(function (item) {
        var highlightedText = processAndHighlightText(item.content, sentenceText);
        
        html += "<div style='margin-bottom:15px; background:#1e293b; border:1px solid #334155; border-radius:8px; padding:12px;'>";
        html += "<div style='font-weight:bold; color:#38bdf8; font-size:13px; margin-bottom:6px;'>📄 Sayfa " + item.pageNumber + "</div>";
        html += "<div style='white-space:pre-wrap; font-family: monospace; font-size:13px; background:#090d16; padding:12px; border:1px solid #1e293b; border-radius:6px; color:#cbd5e1; max-height:280px; overflow-y:auto; line-height:1.7;'>" + highlightedText + "</div>";
        html += "</div>";
      });

      html += "</div>";

      container.innerHTML = html;

    }).catch(function (err) {
      container.innerHTML = "<div style='padding:15px; background:#450a0a; color:#fca5a5; border-radius:10px; margin-top:12px;'>❌ Hata oluştu: " + err.message + "</div>";
    });
  }

  global.DHAzarEngine = {
    startRemedialLesson: startRemedialLesson
  };

})(window);