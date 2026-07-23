/* azar-remedial.js — Dinamik Cümle Analizi ve Azar Kitap Entegrasyonu */
(function(global){
  "use strict";

  var azarData = null;

  // JSON verisini çek
  function loadAzarData() {
    if(azarData) return Promise.resolve(azarData);
    return fetch('./data/azar_uueg.json')
      .then(function(r){ return r.json(); })
      .then(function(data){ azarData = data; return azarData; });
  }

  // Cümlenin yapısını analiz edip AZAR_TOPIC_MAP içindeki en uygun konuyu otomatik bulur
  function detectTopicFromSentence(sentenceText) {
    var text = String(sentenceText || "").toLowerCase();

    // Pattern Matching (Gramer İmzaları)
    if (/\b(have|has)\s+[a-z]+ed\b|\b(have|has)\s+(been|gone|seen|eaten|done|taken|bought|written|met)\b/.test(text)) {
      return "present_perfect";
    }
    if (/\b(must|have to|has to|had better|got to|gotta|hafta|hasta)\b/.test(text)) {
      return "modals_necessity";
    }
    if (/\b(will|be going to|am going to|is going to|are going to)\b/.test(text)) {
      return "future_time";
    }
    if (/\b(was|were)\s+[a-z]+ing\b/.test(text)) {
      return "simple_past_progressive";
    }
    if (/\b(am|is|are)\s+[a-z]+ing\b/.test(text)) {
      return "simple_present_progressive";
    }
    if (/\b(should|could|might|may)\b/.test(text)) {
      return "degrees_of_certainty";
    }
    if (/\b(much|many|few|little|a lot of|some|any|furniture|information|water)\b/.test(text)) {
      return "count_noncount_nouns";
    }

    // Varsayılan genel zamanlar özeti
    return "present_tenses";
  }

  // Dışarıdan doğrudan CÜMLE METNİ veya KONU ANAHTARI alabilen ana fonksiyon
  function startRemedialForCurrentSentence(sentenceText, manualCategory) {
    // Eğer kategorisi zaten tanımlıysa onu kullan, yoksa cümlenin metninden otomatik bul
    var topicKey = manualCategory || detectTopicFromSentence(sentenceText);
    var topicInfo = AZAR_TOPIC_MAP[topicKey] || AZAR_TOPIC_MAP["present_tenses"];

    loadAzarData().then(function(pages) {
      // İlgili konunun sayfalarını filtrele
      var targetPages = pages.filter(function(p){ 
        return topicInfo.pages.indexOf(p.pageNumber) !== -1; 
      });

      var combinedContent = targetPages.map(function(p){ 
        return "--- BETTY AZAR UUEG PAGE " + p.pageNumber + " ---\n" + p.content; 
      }).join("\n\n");

      // Master Prompt Derleme
      var promptPayload = "Sen Betty Azar'ın 'Understanding and Using English Grammar' kitabına hakim uzman bir İngilizce öğretmenisin.\n\n"
                        + "Öğrenci 'Dil Harita' uygulamasında şu cümlede takıldı ve zorlanıyor:\n"
                        + "👉 \" " + sentenceText + " \"\n\n"
                        + "Bu cümlenin ait olduğu gramer konusu: [ " + topicInfo.title + " ]\n"
                        + "Aşağıda kitabın " + topicInfo.pages.join(", ") + ". sayfalarından taranmış orijinal kitap ders içerikleri yer alıyor:\n\n"
                        + combinedContent + "\n\n"
                        + "LÜTFEN ÖĞRENCİYE ŞU BÖLÜMLERİ SUN:\n"
                        + "1. 💡 **Cümle Analizi & Kilit Kural:** Öğrencinin takıldığı bu cümlenin gramer yapısını ve Türk öğrencilerin yaptığı tipik hatayı anlat.\n"
                        + "2. 📝 **Kitaptan Benzer Örnekler:** Yukarıdaki sayfalardan bu yapıyla eşleşen 2 örneği Türkçe akademik çevirisiyle sun.\n"
                        + "3. 🎯 **Mini Telafi Testi:** Öğrencinin bu yapıyı pekiştirmesi için 3 adet şıklı boşluk doldurma sorusu hazırla ve en alta çözümlerini ekle.";

      // Panoya kopyala ve Gemini'yi aç
      try {
        if(navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(promptPayload);
        } else {
          var ta = document.createElement("textarea"); ta.value = promptPayload;
          ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.focus(); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta);
        }
        alert("📘 Akıllı Tespit Çalıştı!\n\nTakıldığınız Cümle: \"" + sentenceText + "\"\nTespit Edilen Konu: " + topicInfo.title + "\n\nAzar kitabından ilgili sayfalar derlendi ve prompt kopyalandı! Gemini sayfasına yapıştırabilirsiniz (Ctrl+V).");
        window.open("https://gemini.google.com/app", "_blank");
      } catch(e) {
        alert("Prompt kopyalanamadı.");
      }
    });
  }

  global.DHAzarEngine = {
    startRemedialLesson: startRemedialForCurrentSentence,
    detectTopic: detectTopicFromSentence
  };
})(window);