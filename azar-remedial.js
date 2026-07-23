/* azar-remedial.js — Telafi Ders Motoru */
(function(global){
  "use strict";

  var azarData = null;

  // JSON verisini data/ klasöründen bir kez çekip hafızaya alır
  function loadAzarData() {
    if(azarData) return Promise.resolve(azarData);
    return fetch('./data/azar_uueg.json')
      .then(function(r){ return r.json(); })
      .then(function(data){ azarData = data; return azarData; });
  }

  // Zorlanılan konu anahtarına göre Azar sayfalarını toplar ve Gemini Prompt'u hazırlar
  function startRemedialLesson(topicKey) {
    var topicInfo = AZAR_TOPIC_MAP[topicKey];
    if(!topicInfo) {
      alert("Bu konu için Azar eşleştirmesi bulunamadı.");
      return;
    }

    loadAzarData().then(function(pages) {
      // Sadece o konunun sayfa numaralarını süz
      var targetPages = pages.filter(function(p){ return topicInfo.pages.indexOf(p.pageNumber) !== -1; });
      var combinedContent = targetPages.map(function(p){ 
        return "--- BETTY AZAR UUEG PAGE " + p.pageNumber + " ---\n" + p.content; 
      }).join("\n\n");

      // Master Prompt Derleme
      var promptPayload = "Sen Betty Azar'ın 'Understanding and Using English Grammar' kitabına hakim uzman bir İngilizce öğretmenisin.\n\n"
                        + "Öğrenci 'Dil Harita' uygulamasında [ " + topicInfo.title + " ] konusunda zorlanıyor.\n"
                        + "Aşağıda kitabın " + topicInfo.pages.join(", ") + ". sayfalarından taranmış içerikler bulunmaktadır:\n\n"
                        + combinedContent + "\n\n"
                        + "LÜTFEN ÖĞRENCİYE ŞU BÖLÜMLERİ SUN:\n"
                        + "1. 💡 **Kritik Gramer Özeti:** Bu kuralın mantığını Türk öğrencilerin yaptığı tipik hataları vurgulayarak anlat.\n"
                        + "2. 📝 **Kitap Örnekleri:** Sayfalardaki en kritik 2 örneği Türkçe akademik çevirisiyle sun.\n"
                        + "3. 🎯 **Mini Telafi Testi:** Öğrencinin kendini denemesi için 3 adet şıklı boşluk doldurma sorusu hazırla. En alta detaylı çözümlerini ekle.";

      // Panoya kopyala ve Gemini Web'i aç
      try {
        if(navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(promptPayload);
        } else {
          var ta = document.createElement("textarea"); ta.value = promptPayload;
          ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.focus(); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta);
        }
        alert("📘 \"" + topicInfo.title + "\" konusu için Azar kitabından " + topicInfo.pages.join(", ") + ". sayfaların verileri derlendi ve prompt kopyalandı!\n\nAçılan Gemini sayfasına yapıştırabilirsiniz (Ctrl+V).");
        window.open("https://gemini.google.com/app", "_blank");
      } catch(e) {
        alert("Prompt kopyalanamadı.");
      }
    });
  }

  global.DHAzarEngine = {
    startRemedialLesson: startRemedialLesson
  };
})(window);