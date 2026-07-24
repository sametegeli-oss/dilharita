/* ==========================================================================
   azar-remedial.js — Betty Azar Kitap Entegrasyon ve Tam Eşleşme Motoru v2.0
   ========================================================================== */

(function (global) {
  "use strict";

  var azarData = null;

  // 1. Veritabanını Hafızaya Yükleme (Cache)
  function loadAzarData() {
    if (azarData) return Promise.resolve(azarData);
    return fetch('./data/azar_uueg.json')
      .then(function (response) {
        if (!response.ok) throw new Error("Azar veri tabanı yüklenemedi. Lütfen ./data/ klasörünü kontrol edin.");
        return response.json();
      })
      .then(function (data) {
        azarData = data;
        return azarData;
      })
      .catch(function (err) {
        console.error("Azar yükleme hatası:", err);
        return [];
      });
  }

  // 2. OCR Sonucu Parçalanmış Kelimeleri Canlı Düzeltme Fonksiyonu
  function cleanOcrText(text) {
    if (!text) return "";
    var cleaned = text;
    cleaned = cleaned.replace(/\bU\s+nd\s+er\s+st\s+an\s+di\s+ng\b/gi, "Understanding");
    cleaned = cleaned.replace(/\bG\s+R\s+A\s+M\s+M\s+A\s+R\b/gi, "GRAMMAR");
    cleaned = cleaned.replace(/\bS\s+I\s+M\s+P\s+L\s+E\b/gi, "SIMPLE");
    cleaned = cleaned.replace(/\bP\s+R\s+E\s+S\s+E\s+N\s+T\b/gi, "PRESENT");
    cleaned = cleaned.replace(/\bP\s+A\s+S\s+T\b/gi, "PAST");
    cleaned = cleaned.replace(/\bF\s+U\s+T\s+U\s+R\s+E\b/gi, "FUTURE");
    cleaned = cleaned.replace(/\bM\s+O\s+D\s+A\s+L\s+S\b/gi, "MODALS");
    
    cleaned = cleaned.replace(/[ \t]+/g, " ");
    return cleaned;
  }

  // 3. Azar Kitabı İçin Tüm Eşleşen Kayıtları Getiren Skorlama Algoritması
  function startRemedialLesson(sentenceText, targetElementId) {
    var containerId = targetElementId || "azar-result-container";
    var container = document.getElementById(containerId);

    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      var azBtn = document.getElementById("dhAzarAskBtn");
      if (azBtn && azBtn.parentNode) {
        azBtn.parentNode.appendChild(container);
      }
    }

    container.innerHTML = "<div style='padding:15px; text-align:center; color:#60a5fa;'>📘 Betty Azar Kitabı taranıyor ve tüm eşleşen sayfalar derleniyor...</div>";

    loadAzarData().then(function (pages) {
      if (!pages || pages.length === 0) {
        container.innerHTML = "<div style='padding:15px; background:#450a0a; color:#fca5a5; border-radius:8px;'>❌ Azar veritabanı bulunamadı.</div>";
        return;
      }

      var rawSentence = String(sentenceText || "").trim().toLowerCase();
      var stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to", "it", "and", "or", "of", "for", "with", "that", "this", "by", "as", "be"]);
      var words = rawSentence.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/);
      var meaningfulWords = words.filter(function(w) {
        return w.length > 2 && !stopWords.has(w);
      });

      if (meaningfulWords.length === 0 && rawSentence.length > 2) {
        meaningfulWords = [rawSentence.slice(0, 5)];
      }

      // Her sayfaya eşleşme puanı hesapla
      var scoredPages = pages.map(function(page) {
        var content = String(page.content || "").toLowerCase();
        var score = 0;

        meaningfulWords.forEach(function(word) {
          if (content.indexOf(word) !== -1) score += 2;
        });

        return { page: page, score: score };
      });

      // Puana göre büyükten küçüğe sırala
      scoredPages.sort(function(a, b) {
        return b.score - a.score;
      });

      // SINIRLAMA YOK: Skor sıfırdan büyük TÜM eşleşen sayfaları alıyoruz
      var matchedPages = scoredPages.filter(function(m) {
        return m.score > 0;
      }).map(function(m) {
        return m.page;
      });

      // Eşleşme çıkmazsa ilk sayfaları göster
      if (matchedPages.length === 0) {
        matchedPages = pages.slice(0, 5);
      }

      var html = "<div style='background:#0f172a; border:1px solid #3b82f6; border-radius:12px; padding:18px; margin-top:15px; color:#e2e8f0;'>";
      html += "<div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #1e293b; padding-bottom:8px;'>";
      html += "<h3 style='margin:0; color:#60a5fa; font-size:16px;'>📘 Betty Azar Kitabı - Tüm Eşleşen Sayfalar (" + matchedPages.length + " Adet)</h3>";
      html += "<span style='font-size:11px; background:#1e293b; color:#34d399; padding:3px 8px; border-radius:6px;'>Eksiksiz Tarama</span>";
      html += "</div>";

      // Çok fazla sonuç için kaydırma çubuğu (scroll)
      html += "<div style='max-height: 450px; overflow-y: auto; padding-right: 5px;'>";

      matchedPages.forEach(function (page, idx) {
        var cleanContent = cleanOcrText(page.content);
        
        meaningfulWords.forEach(function (kw) {
          var regex = new RegExp("(" + kw + ")", "gi");
          cleanContent = cleanContent.replace(regex, "<mark style='background:#ef4444; color:#fff; padding:0 3px; border-radius:3px;'>$1</mark>");
        });

        html += "<div style='background:#1e293b; border-radius:8px; padding:12px; margin-bottom:12px; border-left:3px solid #3b82f6;'>";
        html += "<div style='display:flex; justify-content:space-between; font-weight:bold; color:#34d399; margin-bottom:6px; font-size:12px;'>";
        html += "<span>#" + (idx + 1) + " — Sayfa Numarası: " + page.pageNumber + "</span>";
        html += "</div>";
        html += "<div style='white-space:pre-wrap; font-family:monospace; color:#cbd5e1; font-size:13px; line-height:1.5;'>" + cleanContent + "</div>";
        html += "</div>";
      });

      html += "</div>";
      html += "<div style='font-size:12px; color:#94a3b8; text-align:right; margin-top:10px;'>Kaynak: Understanding and Using English Grammar (Betty Schrampfer Azar)</div>";
      html += "</div>";

      container.innerHTML = html;
    }).catch(function (error) {
      container.innerHTML = "<div style='padding:15px; background:#450a0a; color:#fca5a5; border-radius:8px;'>❌ Hata oluştu: " + error.message + "</div>";
    });
  }

  global.DHAzarEngine = {
    startRemedialLesson: startRemedialLesson,
    cleanOcrText: cleanOcrText
  };

})(window);