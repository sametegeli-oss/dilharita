/* azar-remedial.js — Dil Harita & Azar UUEG Kitap Entegrasyonu */
(function(global){
  "use strict";

  var azarData = null;

  // Azar JSON verisini arka planda bir kez yükle
  function loadAzarData() {
    if(azarData) return Promise.resolve(azarData);
    return fetch('./data/Azar_UUEG_IndexedDB_Backup_2026-07-23.json')
      .then(r => r.json())
      .then(data => { azarData = data; return azarData; });
  }

  // Zorlanılan konuya göre kitaptan sayfaları toplayıp Gemini'ye hazırlar
  function generateRemedialPrompt(topicKey) {
    var topicInfo = AZAR_TOPIC_MAP[topicKey];
    if(!topicInfo) return;

    loadAzarData().then(pages => {
      // İlgili konunun sayfalarındaki metinleri süz
      var targetPages = pages.filter(p => topicInfo.pages.includes(p.pageNumber));
      var combinedContent = targetPages.map(p => `--- SAYFA ${p.pageNumber} ---\n` + p.content).join("\n\n");

      var promptPayload = `
Sen Betty Azar'ın "Understanding and Using English Grammar" müfredatına hakim uzman bir İngilizce öğretmenisin.

Öğrenci "Dil Harita" uygulamasında [ ${topicInfo.title} ] konusunda zorlanmaktadır.
Aşağıda kitabın ilgili sayfalarından derlenmiş içerik yer almaktadır:

${combinedContent}

LÜTFEN ÖĞRENCİYE ŞU BÖLÜMLERİ SUN:
1. 💡 **Kritik Gramer Özeti:** Bu konudaki mantığı Türk öğrencilerin yaptığı tipik hataları vurgulayarak anlat.
2. 📝 **Kitap Örnekleri:** Sayfalardaki en kritik 2 örneği Türkçe açıklamasıyla yaz.
3. 🎯 **Mini Telafi Testi:** Öğrencinin kendini denemesi için 3 adet şıklı soru hazırla. En alta detaylı çözümlerini ekle.
      `.trim();

      // Panoya kopyala ve Gemini'ye yönlendir
      if(navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(promptPayload);
        alert(`📘 "${topicInfo.title}" konusu için Azar kitabından ${topicInfo.pages.join(", ")}. sayfaların verileri derlendi ve prompt kopyalandı!\n\nGemini sayfasına yapıştırabilirsiniz.`);
        window.open("https://gemini.google.com/app", "_blank");
      }
    });
  }

  global.DHAzarEngine = {
    triggerRemedial: generateRemedialPrompt
  };
})(window);