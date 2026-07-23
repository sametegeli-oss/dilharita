/* azar-remedial.js — İçerik Odaklı Akıllı Azar Kitap Eşleştirici */
(function(global){
  "use strict";

  var azarData = null;

  function loadAzarData() {
    if(azarData) return Promise.resolve(azarData);
    return fetch('./data/azar_uueg.json')
      .then(function(r){ return r.json(); })
      .then(function(data){ azarData = data; return azarData; });
  }

  // Başlıklara değil, doğrudan JSON içeriklerine (content) bakarak en uygun sayfayı bulan akıllı motor
  function findBestPagesFromJSON(sentenceText, pages) {
    var query = String(sentenceText || "").toLowerCase();
    var words = query.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(function(w){ return w.length > 2; });
    
    if (!pages || !pages.length) return { title: "General Grammar Review", pages: [15, 16] };

    var scoredPages = pages.map(function(page) {
      var content = String(page.content || "").toLowerCase();
      var score = 0;

      // 1. Gramer İmzalarına göre doğrudan içerik ağırlığı ver
      if (/\b(since|for)\b/.test(query) && /\b(present perfect|duration)\b/.test(content)) score += 15;
      if (/\b(must|have to|had better|should)\b/.test(query) && /\b(necessity|advisability|modal)\b/.test(content)) score += 15;
      if (/\b(when|while|before|after|by the time)\b/.test(query) && /\b(time clause|adverb clause)\b/.test(content)) score += 15;
      if (/\b(who|which|that|where)\b/.test(query) && /\b(adjective clause)\b/.test(content)) score += 15;
      if (/\b(if|unless)\b/.test(query) && /\b(conditional)\b/.test(content)) score += 15;

      // 2. Kelime Eşleşmesi (İçerik taraması)
      words.forEach(function(word) {
        if (content.indexOf(word) !== -1) {
          score += 1;
        }
      });

      return { pageNumber: page.pageNumber, score: score, content: page.content };
    });

    // En yüksek skora sahip sayfaları sırala
    scoredPages.sort(function(a, b) { return b.score - a.score; });

    // En iyi eşleşen ilk 2-3 sayfayı seç
    var topPages = scoredPages.slice(0, 3).filter(function(p){ return p.score > 0; });
    
    if (!topPages.length) {
      // Eşleşme çıkmazsa varsayılan genel zamanlar sayfaları
      return { title: "Overview of Verb Tenses & Usage", pages: [15, 16, 17] };
    }

    return {
      title: "Azar Grammar Target Section (Page " + topPages[0].pageNumber + ")",
      pages: topPages.map(function(p){ return p.pageNumber; }),
      snippets: topPages.map(function(p){ return "--- BETTY AZAR UUEG PAGE " + p.pageNumber + " ---\n" + p.content; }).join("\n\n")
    };
  }

  function startRemedialLesson(sentenceText) {
    loadAzarData().then(function(pages) {
      // Doğrudan JSON içeriklerinden en iyi eşleşmeyi bul
      var matchResult = findBestPagesFromJSON(sentenceText, pages);

      var promptPayload = "Sen Betty Azar'ın 'Understanding and Using English Grammar' kitabına hakim uzman bir İngilizce öğretmenisin.\n\n"
                        + "Öğrenci 'Dil Harita' uygulamasında şu cümlede takıldı ve zorlanıyor:\n"
                        + "👉 \" " + sentenceText + " \"\n\n"
                        + "Aşağıda kitabın içerik analiziyle tespit edilen en ilgili sayfalarından taranmış orijinal ders içerikleri yer alıyor:\n\n"
                        + matchResult.snippets + "\n\n"
                        + "LÜTFEN ÖĞRENCİYE ŞU BÖLÜMLERİ SUN:\n"
                        + "1. 💡 **Cümle Analizi & Kilit Kural:** Öğrencinin takıldığı bu cümlenin gramer yapısını ve Türk öğrencilerin yaptığı tipik hatayı anlat.\n"
                        + "2. 📝 **Kitaptan Benzer Örnekler:** Yukarıdaki sayfalardan bu yapıyla eşleşen örnekleri Türkçe akademik çevirisiyle sun.\n"
                        + "3. 🎯 **Mini Telafi Testi:** Öğrencinin bu yapıyı pekiştirmesi için 3 adet şıklı boşluk doldurma sorusu hazırla ve en alta çözümlerini ekle.";

      try {
        if(navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(promptPayload);
        } else {
          var ta = document.createElement("textarea"); ta.value = promptPayload;
          ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.focus(); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta);
        }
        alert("📘 İçerik Bazlı Akıllı Eşleşme Başarılı!\n\nTakıldığınız Cümle: \"" + sentenceText + "\"\nBulunan Sayfalar: " + matchResult.pages.join(", ") + "\n\nPrompt kopyalandı! Gemini sayfasına yapıştırabilirsiniz (Ctrl+V).");
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