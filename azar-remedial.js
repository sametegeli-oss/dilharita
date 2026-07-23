/* ==========================================================================
   azar-remedial.js — Betty Azar Kitap Entegrasyon ve Canlı OCR Düzeltme Motoru v1.0
   ========================================================================== */

(function (global) {
  "use strict";

  var azarData = null;

  // 1. Veritabanını Hafızaya Yükleme (Cache)
  function loadAzarData() {
    if (azarData) return Promise.resolve(azarData);
    return fetch('./data/azar_uueg.json')
      .then(function (response) {
        if (!response.ok) throw new Error("Azar veri tabanı yüklenemedi.");
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
    // Bitişik kalmış veya OCR ile arasına boşluk girmiş yaygın kalıpları düzelt
    cleaned = cleaned.replace(/\bU\s+nd\s+er\s+st\s+an\s+di\s+ng\b/gi, "Understanding");
    cleaned = cleaned.replace(/\bG\s+R\s+A\s+M\s+M\s+A\s+R\b/gi, "GRAMMAR");
    cleaned = cleaned.replace(/\bS\s+I\s+M\s+P\s+L\s+E\b/gi, "SIMPLE");
    cleaned = cleaned.replace(/\bP\s+R\s+E\s+S\s+E\s+N\s+T\b/gi, "PRESENT");
    cleaned = cleaned.replace(/\bP\s+A\s+S\s+T\b/gi, "PAST");
    cleaned = cleaned.replace(/\bF\s+U\s+T\s+U\s+R\s+E\b/gi, "FUTURE");
    cleaned = cleaned.replace(/\bM\s+O\s+D\s+A\s+L\s+S\b/gi, "MODALS");
    
    // Fazla boşlukları teke indir
    cleaned = cleaned.replace(/[ \t]+/g, " ");
    return cleaned;
  }

  // 3. Cümle İçerisindeki Anahtar Kelimelere Göre Konu Eşleştirme
  function findRelevantPages(sentence) {
    var raw = String(sentence || "").toLowerCase();
    var keywords = [];

    if (raw.indexOf("would rather") !== -1 || raw.indexOf("prefer") !== -1) keywords.push("prefer", "would rather");
    else if (raw.indexOf("used to") !== -1 || raw.indexOf("would") !== -1) keywords.push("habit", "past");
    else if (raw.indexOf("have been") !== -1 || raw.indexOf("has been") !== -1) keywords.push("perfect", "progressive");
    else if (raw.indexOf("if ") !== -1 || raw.indexOf("would have") !== -1) keywords.push("conditional", "wish");
    else if (raw.indexOf("by the time") !== -1 || raw.indexOf("before") !== -1 || raw.indexOf("after") !== -1) keywords.push("time", "clause");
    else {
      // Varsayılan olarak genel zamanlar veya simple present/past
      keywords.push("tense", "simple", "present");
    }

    return keywords;
  }

  // 4. Ana Remedial (İyileştirme) Çalışmasını Başlatma Fonksiyonu
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

    container.innerHTML = "<div style='padding:15px; text-align:center; color:#60a5fa;'>📘 Betty Azar Kitabı taranıyor ve ilgili kural sayfaları derleniyor...</div>";

    loadAzarData().then(function (pages) {
      if (!pages || pages.length === 0) {
        container.innerHTML = "<div style='padding:15px; background:#450a0a; color:#fca5a5; border-radius:8px;'>❌ Azar veritabanı yüklenemedi veya boş.</div>";
        return;
      }

      var keywords = findRelevantPages(sentenceText);
      
      // Veritabanından anahtar kelimeleri içeren ilk 2 sayfayı seç
      var matchedPages = pages.filter(function (p) {
        var contentLower = String(p.content || "").toLowerCase();
        return keywords.some(function (kw) {
          return contentLower.indexOf(kw) !== -1;
        });
      }).slice(0, 2);

      // Eğer eşleşme çıkmazsa ilk temel gramer sayfalarını (Örn: sayfa 15-16) göster
      if (matchedPages.length === 0) {
        matchedPages = pages.slice(14, 16);
      }

      var html = "<div style='background:#0f172a; border:1px solid #3b82f6; border-radius:12px; padding:18px; margin-top:15px; color:#e2e8f0;'>";
      html += "<div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #1e293b; padding-bottom:8px;'>";
      html += "<h3 style='margin:0; color:#60a5fa; font-size:16px;'>📘 Betty Azar Kitabı İlgili Konu Sayfaları</h3>";
      html += "<span style='font-size:11px; background:#1e293b; color:#34d399; padding:3px 8px; border-radius:6px;'>Hedef Cümle Analizi</span>";
      html += "</div>";

      matchedPages.forEach(function (page) {
        var cleanContent = cleanOcrText(page.content);
        
        // Hedef kelimeyi metin içerisinde kırmızı/vurgulu hale getir
        keywords.forEach(function (kw) {
          var regex = new RegExp("(" + kw + ")", "gi");
          cleanContent = cleanContent.replace(regex, "<mark style='background:#ef4444; color:#fff; padding:0 3px; border-radius:3px;'>$1</mark>");
        });

        html += "<div style='background:#1e293b; border-radius:8px; padding:12px; margin-bottom:12px; font-size:13px; line-height:1.6;'>";
        html += "<div style='font-weight:bold; color:#34d399; margin-bottom:6px; font-size:12px;'>Sayfa Number: " + page.pageNumber + "</div>";
        html += "<div style='white-space:pre-wrap; font-family:monospace; color:#cbd5e1;'>" + cleanContent + "</div>";
        html += "</div>";
      });

      html += "<div style='font-size:12px; color:#94a3b8; text-align:right; margin-top:8px;'>Kaynak: Understanding and Using English Grammar (Betty Schrampfer Azar)</div>";
      html += "</div>";

      container.innerHTML = html;
    }).catch(function (error) {
      container.innerHTML = "<div style='padding:15px; background:#450a0a; color:#fca5a5; border-radius:8px;'>❌ Hata oluştu: " + error.message + "</div>";
    });
  }

  // Global nesneye dışa aktarma
  global.DHAzarEngine = {
    startRemedialLesson: startRemedialLesson,
    cleanOcrText: cleanOcrText
  };

})(window);
       
