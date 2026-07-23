/* azar-remedial.js — Stop-Word Korumalı ve Tam Odaklı Azar Engine v12 */
(function(global){
  "use strict";

  var azarData = null;

  function loadAzarData() {
    if(azarData) return Promise.resolve(azarData);
    return fetch('./data/azar_uueg.json')
      .then(function(r){ return r.json(); })
      .then(function(data){ azarData = data; return azarData; });
  }

  // Arama parazitlerini engellemek için stop-word'leri eliyoruz
  var STOP_WORDS = ["a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with", "please"];

  function extractCoreGrammarPhrases(text) {
    var cleanText = String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    var words = cleanText.split(/\s+/).filter(function(w){ return w.length > 0; });
    
    var coreWords = words.filter(function(w){ return STOP_WORDS.indexOf(w) === -1; });
    var phrases = [];

    // Özel kalıpları (Phrasal Modals / Verbs) doğrudan çek
    if (cleanText.indexOf("would like") !== -1 || cleanText.indexOf("d like") !== -1) phrases.push("would like");
    if (cleanText.indexOf("would rather") !== -1 || cleanText.indexOf("d rather") !== -1) phrases.push("would rather");
    if (cleanText.indexOf("had better") !== -1 || cleanText.indexOf("d better") !== -1) phrases.push("had better");
    if (cleanText.indexOf("used to") !== -1) phrases.push("used to");

    // Temizlenmiş kelimeleri de ekle
    coreWords.forEach(function(w){ if(w.length > 2) phrases.push(w); });

    return phrases;
  }

  function findExactTopicPages(sentenceText, pages) {
    if (!pages || !pages.length) return { snippets: "", pageNumbers: [] };

    var phrases = extractCoreGrammarPhrases(sentenceText);
    
    var scoredPages = pages.map(function(page) {
      var content = String(page.content || "").toLowerCase();
      var score = 0;

      phrases.forEach(function(phrase) {
        if (content.indexOf(phrase) !== -1) {
          // Kalıp eşleşmelerine ezici yüksek puan ver ki Articles gibi yan sayfalar araya girmesin
          score += (phrase.indexOf(" ") !== -1) ? 50 : 3;
        }
      });

      return { pageNumber: page.pageNumber, score: score, content: page.content };
    });

    scoredPages.sort(function(a, b) { return b.score - a.score; });

    // Sadece gerçekten yüksek puan alan (yani pure gramer kalıbını içeren) sayfaları al
    var topMatches = scoredPages.filter(function(p){ return p.score >= 10; });
    if (!topMatches.length) topMatches = scoredPages.slice(0, 2);

    var targetPageNumbers = topMatches.map(function(p){ return p.pageNumber; }).sort(function(a,b){ return a-b; });

    var combinedSnippets = pages
      .filter(function(p){ return targetPageNumbers.indexOf(p.pageNumber) !== -1; })
      .map(function(p){ return "=== BETTY AZAR UUEG SAYFA " + p.pageNumber + " ===\n" + p.content; })
      .join("\n\n--------------------------------------------------\n\n");

    return {
      pageNumbers: targetPageNumbers,
      snippets: combinedSnippets
    };
  }

  function startRemedialLesson(sentenceText) {
    loadAzarData().then(function(pages) {
      var result = findExactTopicPages(sentenceText, pages);

      var promptPayload = "Sen Betty Azar'ın 'Understanding and Using English Grammar' kitabının müfredatına hakim uzman bir yapay zeka öğretmenisin.\n\n"
                        + "ÖĞRENCİNİN İNCELEMEK İSTEDİĞİ HEDEF CÜMLE:\n"
                        + "👉 \"" + sentenceText + "\"\n\n"
                        + "Aşağıda kitabın taranmış veritabanından SADECE BU GRAMER KALIPIYLA İLGİLİ SAYFALARIN HAM METİNLERİ yer almaktadır:\n\n"
                        + result.snippets + "\n\n"
                        + "🎯 KESİN ODAK TALİMATI:\n"
                        + "1. Cümledeki tek ve gerçek gramer konusu ne ise (Örn: 'Would like' ile istek belirtme) SADECE O KONUYU anlat.\n"
                        + "2. Cümlede geçen nesnelerden, edatlardan veya alakasız kelimelerden yola çıkarak başka gramer konularına (Articles, Nouns vb.) KESİNLİKLE SAPMA.\n"
                        + "3. Kitapta geçen 'Would like' ile ilgili TÜM ÖRNEKLERİ ve TÜM ALIŞTIRMALARI eksiksiz dök.\n\n"
                        + "ŞU ŞABLONA BİREBİR UY (Doğrudan Türkçe anlatım kullan):\n\n"
                        + "# 📘 Odak Cümle Gramer Analizi & Nokta Atışı Konu Özeti\n"
                        + "- **Cümlenin Dil Bilgisi Formülü:** Target cümlenin tam yapısını, formülünü ve kurallarını açıkla.\n"
                        + "- **Türk Öğrenciler İçin Kritik İpucu:** Bu spesifik kalıpta Türk öğrencilerin yaptığı en yaygın hatayı ve çözümünü yaz.\n\n"
                        + "# 📝 Odak Konuyla Birebir İlgili Örnek Cümleler (TAM LİSTE)\n"
                        + "Taranan sayfalarda geçen ve SADECE bu gramer kalıbına ('Would like') uyan TÜM İngilizce örnek cümleler ve hemen altında akademik Türkçe çevirileri.\n\n"
                        + "# 🧠 Odak Pekiştirme Testi (Interactive Quiz - TÜM ALIŞTIRMALAR)\n"
                        + "Taranan sayfalardaki 'Would like' alıştırma maddelerinin TAMAMINDAN üretilmiş şıklı boşluk doldurma soruları ('[ _____ ]' formatında) ve en alta detaylı cevap anahtarı.";

      try {
        if(navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(promptPayload);
        } else {
          var ta = document.createElement("textarea"); ta.value = promptPayload;
          ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.focus(); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta);
        }
        alert("🎯 Tam Odaklı Azar Taraması Başarılı!\n\nTaranan Sayfalar: " + result.pageNumbers.join(", ") + "\n\nPrompt kopyalandı!");
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