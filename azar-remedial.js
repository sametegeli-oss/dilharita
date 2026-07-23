/* ==========================================================================
   azar-remedial.js — İlgili Cümleleri Kırmızı Vurgulayan Motor v15
   ========================================================================== */

(function (global) {
  "use strict";

  var azarData = null;

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

  // 🔴 İLGİLİ KELİME VEYA CÜMLELERİ KIRMIZI YAPMA SÜZGEÇİ
  function highlightMatchedSentence(content, targetSentence) {
    if (!content) return "";
    
    var signatures = extractCoreGrammar(targetSentence);
    var phrasesToHighlight = signatures
      .filter(function(s){ return s.weight >= 10 || s.phrase.indexOf(" ") !== -1; })
      .map(function(s){ return s.phrase; });

    // Eğer özel kalıp yakalanamadıysa cümlenin ana kelimelerini kullan
    if (phrasesToHighlight.length === 0) {
      phrasesToHighlight = signatures.map(function(s){ return s.phrase; });
    }

    var escapeRegex = function(str) {
      return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };

    var safeContent = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // İlgili hedef yapıları kırmızı span etiketine al
    phrasesToHighlight.forEach(function(phrase) {
      if (!phrase || phrase.length < 3) return;
      var regex = new RegExp("(" + escapeRegex(phrase) + ")", "gi");
      safeContent = safeContent.replace(regex, "<span style='color: #ef4444; font-weight: 800; background: rgba(239, 68, 68, 0.1); padding: 2px 4px; border-radius: 4px;'>$1</span>");
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

      html += "<h4 style='color:#94a3b8; font-size:13px; margin-bottom:10px;'>📝 Orijinal Metinler ve İlgili Cümleler (Kırmızı Vurgulu)</h4>";
      
      matchedPages.forEach(function (item) {
        var highlightedText = highlightMatchedSentence(item.content, sentenceText);
        
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