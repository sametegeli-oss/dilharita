/* ==========================================================================
   azar-remedial.js — Çift Veritabanlı (Azar + Çeviri Kılavuzu) Motor v18
   ========================================================================== */

(function (global) {
  "use strict";

  var azarData = null;
  var translationData = null;

  // 1. Betty Azar JSON Yükleyici
  function loadAzarData() {
    if (azarData) return Promise.resolve(azarData);
    return fetch('./data/azar_uueg.json')
      .then(function (r) { return r.json(); })
      .then(function (data) { azarData = data; return azarData; });
  }

  // 2. Türkçe Çeviri Kılavuzu JSON Yükleyici
  function loadTranslationData() {
    if (translationData) return Promise.resolve(translationData);
    return fetch('./data/translation_guide.json')
      .then(function (r) { if (!r.ok) return []; return r.json(); })
      .catch(function () { return []; })
      .then(function (data) { translationData = data; return translationData; });
  }

  var STOP_WORDS = ["a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with"];

  function extractSignatures(text) {
    var raw = String(text || "").toLowerCase();
    var sigs = [];
    if (raw.indexOf("would rather") !== -1 || raw.indexOf("'d rather") !== -1) sigs.push("would rather");
    if (raw.indexOf("used to") !== -1) sigs.push("used to");
    if (raw.indexOf("had better") !== -1) sigs.push("had better");
    if (raw.indexOf("wish") !== -1) sigs.push("wish");
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
})(window);