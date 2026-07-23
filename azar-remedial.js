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
    return sigs;
  }

  function startRemedialLesson(sentenceText, targetElementId) {
    var containerId = targetElementId || "azar-result-container";
    var container = document.getElementById(containerId);

    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      var azBtn = document.getElementById("dhAzarAskBtn");
      if (azBtn && azBtn.parentNode) azBtn.parentNode.appendChild(container);
    }

    container.innerHTML = "<div style='padding:15px; text-align:center; color:#60a5fa;'>📘 Azar ve Çeviri Veritabanı Taranıyor...</div>";

    Promise.all([loadAzarData(), loadTranslationData()]).then(function (results) {
      var pages = results[0];
      var transEntries = results[1];
      var sigs = extractSignatures(sentenceText);

      // Çeviri Kılavuzundan ilgili Türkçe-İngilizce örnekleri süz
      var matchedTrans = transEntries.filter(function (item) {
        var content = String(item.content || "").toLowerCase();
        return sigs.some(function (sig) { return content.indexOf(sig) !== -1; });
      }).slice(0, 5);

      var html = "<div style='background:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:16px; margin-top:15px; color:#e2e8f0;'>";
      
      // A) Türkçe Çeviri Kılavuzu Örnekleri Paneli
      if (matchedTrans.length > 0) {
        html += "<div style='margin-bottom:15px; background:#1e293b; padding:12px; border-radius:8px; border-left:4px solid #34d399;'>";
        html += "<h4 style='margin:0 0 8px 0; color:#34d399;'>🇹🇷 Türkçe Çeviri Kılavuzu - Örnek İpuçları</h4>";
        matchedTrans.forEach(function (t) {
          html += "<div style='font-size:13px; margin-bottom:6px; color:#cbd5e1;'>• " + t.content + "</div>";
        });
        html += "</div>";
      }

      // B) Betty Azar Orijinal Metin Paneli
      html += "<h4 style='margin:0 0 10px 0; color:#60a5fa;'>📘 Betty Azar Orijinal Ders Konusu</h4>";
      // ... Azar sayfa metinleri buraya basılır ...
      html += "</div>";

      container.innerHTML = html;
    });
  }

  global.DHAzarEngine = { startRemedialLesson: startRemedialLesson };
   // Çeviri Kılavuzunu Arama ve Ekrana Basma Fonksiyonu
  function searchTranslationGuide(inputId, containerId) {
    var inputElem = document.getElementById(inputId || "translationSearchInput");
    var containerElem = document.getElementById(containerId || "translation-result-container");
    
    if (!inputElem || !containerElem) return;
    var query = inputElem.value.trim().toLowerCase();
    
    if (!query) {
      containerElem.innerHTML = "<div style='padding:10px; color:#fcd34d;'>⚠️ Lütfen aratmak istediğiniz bir ifade girin.</div>";
      return;
    }

    containerElem.innerHTML = "<div style='padding:15px; text-align:center; color:#34d399;'>📖 Çeviri Kılavuzu Taranıyor...</div>";

    // translation_guide.json dosyasını yükle
    fetch('./data/translation_guide.json')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        // İçerisinde aranan kelime geçen ilk 5 kaydı bul
        var matches = data.filter(function(item) {
          return String(item.content || "").toLowerCase().indexOf(query) !== -1;
        }).slice(0, 5);

        if (matches.length === 0) {
          containerElem.innerHTML = "<div style='padding:15px; background:#451a03; color:#fcd34d; border-radius:8px; margin-top:10px;'>⚠️ Bu ifade için kılavuzda eşleşme bulunamadı.</div>";
          return;
        }

        var html = "<div style='background:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:16px; margin-top:15px; color:#e2e8f0;'>";
        html += "<h3 style='margin:0 0 12px 0; color:#34d399; font-size:15px;'>📖 Türkçe Çeviri Kılavuzu Sonuçları</h3>";

        matches.forEach(function(m) {
          var typeBadge = m.type === "E" ? "🇬🇧 İngilizce Örnek" : (m.type === "K" ? "⚖️ Karşılaştırmalı" : "🇹🇷 Türkçe Açıklama");
          var badgeColor = m.type === "E" ? "#60a5fa" : (m.type === "K" ? "#f43f5e" : "#34d399");

          html += "<div style='margin-bottom:10px; background:#1e293b; padding:10px; border-radius:8px; border-left:3px solid " + badgeColor + ";'>";
          html += "<div style='font-size:11px; font-weight:bold; color:" + badgeColor + "; margin-bottom:4px;'>" + typeBadge + " — Bölüm: " + m.section + "</div>";
          html += "<div style='font-size:13px; color:#cbd5e1;'>" + m.content + "</div>";
          html += "</div>";
        });

        html += "</div>";
        containerElem.innerHTML = html;
      })
      .catch(function(err) {
        containerElem.innerHTML = "<div style='padding:15px; background:#450a0a; color:#fca5a5; border-radius:8px;'>❌ Kılavuz yüklenirken hata oluştu: " + err.message + "</div>";
      });
  }

  // Global nesneye bağlama
  global.DHAzarEngine.searchTranslationGuide = searchTranslationGuide;
})(window);
