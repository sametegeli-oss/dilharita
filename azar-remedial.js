/* ==========================================================================
   azar-remedial.js — "Azar Kitabından Çalış" Otomatik Hedef Tespiti v14
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

  // Sayfadaki yanıt kapsayıcısını Akıllı Bulan Yardımcı Fonksiyon
  function findOrCreateDisplayContainer(targetElementId) {
    if (targetElementId) {
      var el = document.getElementById(targetElementId);
      if (el) return el;
    }

    // Yaygın öğretmen yanıt paneli ID/Class alternatiflerini ara
    var autoSelectors = [
      "#teacher-response", "#teacherResponse", "#responseContainer", 
      "#chat-response", ".teacher-response-area", ".chat-output"
    ];

    for (var i = 0; i < autoSelectors.length; i++) {
      var found = document.querySelector(autoSelectors[i]);
      if (found) return found;
    }

    // Eğer hiçbir yer bulunamazsa butonun hemen üstüne/altına dinamik bir div ekle
    var azButton = document.getElementById("azAsk") || document.querySelector("button[id*='Azar']");
    if (azButton && azButton.parentElement) {
      var newContainer = document.createElement("div");
      newContainer.id = "dynamic-azar-response";
      newContainer.style.marginTop = "15px";
      azButton.parentElement.insertBefore(newContainer, azButton);
      return newContainer;
    }

    return null;
  }

  function startRemedialLesson(sentenceText, targetElementId) {
    var container = findOrCreateDisplayContainer(targetElementId);

    if (!container) {
      console.error("Hata: Cevabın yazdırılacağı alan bulunamadı.");
      alert("Cevap alanı bulunamadı! Lütfen HTML içinde yanıt alanının ID'sini kontrol edin.");
      return;
    }

    container.innerHTML = "<div style='padding:15px; text-align:center; color:#1a73e8; font-weight:bold; background:#e8f0fe; border-radius:8px;'>📘 Azar Veritabanından Konu Taranıyor...</div>";

    loadAzarData().then(function (pages) {
      var matchedPages = searchAzarPages(sentenceText, pages);

      if (!matchedPages || matchedPages.length === 0) {
        container.innerHTML = "<div style='padding:15px; background:#fff3cd; color:#856404; border-radius:8px;'>⚠️ Bu cümle için Azar veritabanında doğrudan bir sayfa eşleşmesi bulunamadı.</div>";
        return;
      }

      var pageNums = matchedPages.map(function (p) { return p.pageNumber; }).join(", ");

      var html = "";
      html += "<div class='azar-lesson-card' style='font-family: inherit; line-height: 1.6; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; margin: 15px 0; color:#333;'>";

      html += "<div style='display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #f0f2f5; padding-bottom:10px; margin-bottom:15px;'>";
      html += "<h3 style='margin:0; color:#2c3e50;'>📘 Betty Azar - Konu Anlatım Paneli</h3>";
      html += "<span style='background:#e8f0fe; color:#1a73e8; font-weight:bold; padding:4px 10px; border-radius:15px; font-size:12px;'>Sayfalar: " + pageNums + "</span>";
      html += "</div>";

      html += "<div style='background:#f8f9fa; border-left:4px solid #1a73e8; padding:12px; margin-bottom:20px; border-radius:0 8px 8px 0;'>";
      html += "<div style='font-size:12px; color:#666;'>İncelenen Cümle:</div>";
      html += "<div style='font-size:16px; font-weight:bold; color:#1a73e8; margin-top:4px;'>[[" + sentenceText + "]]</div>";
      html += "</div>";

      html += "<h4 style='color:#2c3e50; margin-bottom:10px;'>📝 Orijinal Kitap Metinleri</h4>";
      
      matchedPages.forEach(function (item) {
        html += "<div style='margin-bottom:15px; background:#fafafa; border:1px solid #eee; border-radius:8px; padding:12px;'>";
        html += "<div style='font-weight:bold; color:#555; font-size:13px; margin-bottom:6px;'>📄 Sayfa " + item.pageNumber + "</div>";
        html += "<pre style='white-space:pre-wrap; font-family: inherit; font-size:13px; background:#fff; padding:10px; border:1px solid #e5e5e5; border-radius:6px; color:#333; max-height:200px; overflow-y:auto;'>" + item.content + "</pre>";
        html += "</div>";
      });

      html += "</div>";

      container.innerHTML = html;

    }).catch(function (err) {
      container.innerHTML = "<div style='padding:15px; background:#f8d7da; color:#721c24; border-radius:8px;'>❌ Hata oluştu: " + err.message + "</div>";
    });
  }

  global.DHAzarEngine = {
    startRemedialLesson: startRemedialLesson
  };

})(window);