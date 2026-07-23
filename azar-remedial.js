/* azar-remedial.js — Kesintisiz ve Eksiksiz Kapsamlı Azar Kitap Eşleştirici v4 */
(function(global){
  "use strict";

  var azarData = null;

  function loadAzarData() {
    if(azarData) return Promise.resolve(azarData);
    return fetch('./data/azar_uueg.json')
      .then(function(r){ return r.json(); })
      .then(function(data){ azarData = data; return azarData; });
  }

  // Verilen cümleyi ve konuyu kitabın başından sonuna kadar tarayıp İLGİLİ TÜM SAYFALARI getiren derin arama motoru
  function findAllRelevantPages(sentenceText, pages) {
    var query = String(sentenceText || "").toLowerCase();
    
    if (!pages || !pages.length) return { chapterTitle: "General Review", pageNumbers: [15, 16], snippets: "" };

    // Kelime köklerini ve gramer yapılarını çıkartalım
    var words = query.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(function(w){ return w.length > 2; });

    // Kitaptaki her bir sayfayı derinlemesine analiz edip skorlayalım
    var scoredPages = pages.map(function(page) {
      var content = String(page.content || "").toLowerCase();
      var score = 0;

      // 1. Kelime bazlı eşleşmeler
      words.forEach(function(w) {
        if (content.indexOf(w) !== -1) score += 2;
      });

      // 2. Gramer Konu Sınıflandırması ve Kapsam Genişletme (İlgili tüm chapter sayfalarını yakalama)
      // Gerunds & Infinitives (Chapter 14 & 15)
      if (/(hope|promise|decide|want|expect|avoid|enjoy|gerund|infinitive|to\s+\w+)/.test(query)) {
        if (/verb \+ infinitive|gerunds and infinitives|common verbs followed by/i.test(content)) score += 15;
      }
      // Tenses & Duration / Perfect Tenses (Chapter 1, 2, 3)
      if (/(since|for|already|yet|just|have been|had been)/.test(query)) {
        if (/present perfect|past perfect|duration|since|for|progressive/.test(content)) score += 15;
      }
      // Modals (Chapter 9, 10)
      if (/(must|have to|should|had better|ought to|can|could)/.test(query)) {
        if (/modal|necessity|advisability|degree of certainty/.test(content)) score += 15;
      }
      // Time Clauses (Chapter 5, 4)
      if (/(when|while|before|after|by the time|as soon as)/.test(query)) {
        if (/adverb clauses of time|time relationships|future time/.test(content)) score += 15;
      }
      // Adjective Clauses (Chapter 13)
      if (/(who|which|that|where|whose)/.test(query)) {
        if (/adjective clause|relative pronoun/.test(content)) score += 15;
      }
      // Conditionals (Chapter 20)
      if (/(if|unless|were|had)/.test(query)) {
        if (/conditional|contrary to fact|wish/.test(content)) score += 15;
      }

      return { pageNumber: page.pageNumber, score: score, content: page.content };
    });

    // Skorlarına göre büyükten küçüğe sırala
    scoredPages.sort(function(a, b) { return b.score - a.score; });

    // En yüksek skora sahip ana sayfaları filtrele (Skoru 2'den büyük olanlar)
    var topMatched = scoredPages.filter(function(p){ return p.score >= 3; });
    
    if (!topMatched.length) {
      topMatched = scoredPages.slice(0, 3); // Hiç eşleşmezse en üstteki 3 sayfayı al
    }

    // Kapsamı genişlet: Bulunan ana sayfaların yanı sıra, konu bütünlüğü bozulmasın diye 
    // kitabın o konuyu anlatan ardışık/öncesi-sonrası sayfalarını da kümeye dahil et
    var finalPageNumbersSet = {};
    topMatched.slice(0, 4).forEach(function(p) {
      finalPageNumbersSet[p.pageNumber] = true;
      // Konu bütünlüğü için çevresindeki 1'er sayfayı da ekle
      if (p.pageNumber > 1) finalPageNumbersSet[p.pageNumber - 1] = true;
      if (p.pageNumber < pages.length) finalPageNumbersSet[p.pageNumber + 1] = true;
    });

    var sortedPageNums = Object.keys(finalPageNumbersSet).map(Number).sort(function(a,b){ return a-b; });

    // İlgili tüm sayfaların ham içeriklerini eksiksiz bir şekilde birleştir
    var combinedSnippets = pages
      .filter(function(p){ return finalPageNumbersSet[p.pageNumber]; })
      .map(function(p){ return "=== BETTY AZAR UUEG PAGE " + p.pageNumber + " ===\n" + p.content; })
      .join("\n\n--------------------------------------------------\n\n");

    return {
      chapterTitle: "Betty Azar UUEG - Comprehensive Topic Coverage (Pages " + sortedPageNums.join(", ") + ")",
      pageNumbers: sortedPageNums,
      snippets: combinedSnippets
    };
  }

  function startRemedialLesson(sentenceText) {
    loadAzarData().then(function(pages) {
      var topicData = findAllRelevantPages(sentenceText, pages);

      var promptPayload = "Sen Betty Azar'ın 'Understanding and Using English Grammar' (3rd Edition) kitabının öğretim metodolojisine ve müfredatına tamamen hakim uzman bir yapay zeka İngilizce öğretmenisin.\n\n"
                        + "Öğrenci şu cümlede takıldı veya bu konu üzerinde çalışmak istiyor:\n"
                        + "👉 \" " + sentenceText + " \"\n\n"
                        + "Aşağıda kitabın taranmış orijinal veri tabanından, bu cümleyi ve ilgili konuyu **başından sonuna kadar tüm kuralları, tabloları, grup listeleri ve egzersizleriyle** ilgilendiren TÜM SAYFALARIN ham içerikleri eksiksiz olarak yer almaktadır:\n\n"
                        + topicData.snippets + "\n\n"
                        + "LÜTFEN BU KAPSAMLI VE EKSİNSİZ KİTAP VERİLERİNİ KULLANARAK ŞU ŞABLONA GÖRE MÜKEMMEL BİR DERS HAZIRLA (Doğrudan Türkçe anlatım kullan):\n\n"
                        + "# 📘 " + topicData.chapterTitle + " - Kapsamlı Ders Özeti\n"
                        + "- **Gramer Odağı:** Konunun temel mantığını, kurallarını, formüllerini ve kitapta geçen tüm özel grupları / istisnaları Türk öğrencilerin anlayacağı şekilde net örneklerle açıkla.\n"
                        + "- **Türk Öğrenciler İçin Kritik İpucu:** Türkçeden İngilizceye düşünürken bu konuda yapılan en yaygın kontrast hatalarını ve çözümünü yaz.\n\n"
                        + "# 📝 Örnek Cümle Analizleri (Book Sentences)\n"
                        + "Yukarıdaki orijinal kitap metinlerinden konuyu en iyi temsil eden 3-4 örnek cümleyi seç, İngilizce orijinal hallerini ve hemen altına en doğru Türkçe akademik çevirilerini yaz.\n\n"
                        + "# 🧠 İnteraktif Alıştırma Paneli (Interactive Quiz)\n"
                        + "Kitaptaki egzersizlerden yola çıkarak 3 adet boşluk doldurma sorusu üret. Boşlukları '[ _____ ]' şeklinde bırak. Soruların altına şıkları (A, B, C, D) koy.\n"
                        + "*En alta ise 'Cevap Anahtarı ve Detaylı Dil Bilgisi Açıklaması' ekleyerek öğrencinin neden o şıkkı seçmesi gerektiğini gerekçelendir.*";

      try {
        if(navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(promptPayload);
        } else {
          var ta = document.createElement("textarea"); ta.value = promptPayload;
          ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.focus(); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta);
        }
        alert("📘 Eksiksiz Kapsamlı Azar Eşleşmesi Başarılı!\n\nİlgili Sayfalar: " + topicData.pageNumbers.join(", ") + "\n\nPrompt panoya kopyalandı! Gemini sayfasına yapıştırabilirsiniz (Ctrl+V).");
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
