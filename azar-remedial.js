/* azar-remedial.js — Tam Dinamik, Jenerik ve Kapsamlı Azar Konu Eşleştirici v8 */
(function(global){
  "use strict";

  var azarData = null;

  function loadAzarData() {
    if(azarData) return Promise.resolve(azarData);
    return fetch('./data/azar_uueg.json')
      .then(function(r){ return r.json(); })
      .then(function(data){ azarData = data; return azarData; });
  }

  // Cümledeki tüm n-gramları (1'li, 2'li, 3'lü kelime öbeklerini) dinamik çıkartan fonksiyon
  function generateNGrams(text) {
    var cleanText = String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    var words = cleanText.split(/\s+/).filter(function(w){ return w.length > 1; });
    var nGrams = [];

    // Tekil, ikili, üçlü ve dörtlü öbekleri oluştur
    for (var i = 0; i < words.length; i++) {
      // 1-gram
      nGrams.push({ phrase: words[i], weight: 1 });
      // 2-gram (örn: "would rather")
      if (i + 1 < words.length) {
        nGrams.push({ phrase: words[i] + " " + words[i+1], weight: 5 });
      }
      // 3-gram (örn: "would rather not")
      if (i + 2 < words.length) {
        nGrams.push({ phrase: words[i] + " " + words[i+1] + " " + words[i+2], weight: 12 });
      }
      // 4-gram (örn: "would rather not be")
      if (i + 3 < words.length) {
        nGrams.push({ phrase: words[i] + " " + words[i+1] + " " + words[i+2] + " " + words[i+3], weight: 20 });
      }
    }
    return nGrams;
  }

  // 567 Sayfanın tamamında jenerik ve dinamik arama yapan motor
  function findDynamicTopicPages(sentenceText, pages) {
    if (!pages || !pages.length) return { chapterTitle: "General Grammar", pageNumbers: [], snippets: "" };

    var nGrams = generateNGrams(sentenceText);
    
    var scoredPages = pages.map(function(page) {
      var content = String(page.content || "").toLowerCase();
      var score = 0;

      nGrams.forEach(function(ngram) {
        if (content.indexOf(ngram.phrase) !== -1) {
          score += ngram.weight;
        }
      });

      return { pageNumber: page.pageNumber, score: score, content: page.content };
    });

    // Skoru en yüksek sayfaları sırala
    scoredPages.sort(function(a, b) { return b.score - a.score; });

    // Anlamlı skor üreten tüm ana sayfaları filtrele
    var topMatches = scoredPages.filter(function(p){ return p.score > 2; });
    
    if (!topMatches.length) {
      topMatches = scoredPages.slice(0, 3);
    }

    // Konu bütünlüğü için bulunan ana sayfaları ve konu devamlılığı sağlayan komşu sayfalarını dahil et
    var targetPagesMap = {};
    topMatches.slice(0, 5).forEach(function(p) {
      targetPagesMap[p.pageNumber] = true;
      // Konu anlatımı tek sayfada bitmeyeceği için öncesi ve sonrasındaki ardışık sayfaları da ekle
      if (p.pageNumber > 1) targetPagesMap[p.pageNumber - 1] = true;
      if (p.pageNumber < pages.length) targetPagesMap[p.pageNumber + 1] = true;
    });

    var sortedPages = Object.keys(targetPagesMap).map(Number).sort(function(a,b){ return a-b; });

    // Seçilen TÜM sayfaların orijinal metinlerini eksiksiz birleştir
    var combinedSnippets = pages
      .filter(function(p){ return targetPagesMap[p.pageNumber]; })
      .map(function(p){ return "=== BETTY AZAR UUEG SAYFA " + p.pageNumber + " ===\n" + p.content; })
      .join("\n\n--------------------------------------------------\n\n");

    return {
      chapterTitle: "Betty Azar UUEG (Tespit Edilen Konu Sayfaları: " + sortedPages.join(", ") + ")",
      pageNumbers: sortedPages,
      snippets: combinedSnippets
    };
  }

  function startRemedialLesson(sentenceText) {
    loadAzarData().then(function(pages) {
      var topicData = findDynamicTopicPages(sentenceText, pages);

      var promptPayload = "Sen Betty Azar'ın 'Understanding and Using English Grammar' (3rd Edition) kitabının müfredatına tamamen hakim uzman bir yapay zeka İngilizce öğretmenisin.\n\n"
                        + "Öğrenci şu cümlede takıldı veya bu yapı/konu üzerinde çalışmak istiyor:\n"
                        + "👉 \"" + sentenceText + "\"\n\n"
                        + "Aşağıda kitabın 567 sayfalık tam veri tabanından dinamik olarak çıkarılan, bu cümleyi ve ilgili tüm gramer konusunu kapsayan ORİJİNAL TARAMA METİNLERİ yer almaktadır:\n\n"
                        + topicData.snippets + "\n\n"
                        + "LÜTFEN YUKARIDAKİ KİTAP METİNLERİNİ VE TABLOLARI KULLANARAK HİÇBİR ADET VE SAYI KISITLAMASI KOYMAKSIZIN EKSİKSİZ BİR DERS HAZIRLA (Doğrudan Türkçe anlatım kullan):\n\n"
                        + "# 📘 " + topicData.chapterTitle + " - Tam Konu Özeti\n"
                        + "- **Gramer Odağı:** Taranan metinlerde geçen konunun temel kuralını, tüm formüllerini (olumlu, olumsuz, soru, özel durumlar), tablo gruplarını ve istisnalarını eksiksiz açıkla.\n"
                        + "- **Türk Öğrenciler İçin Kritik İpucu:** Türkçeden İngilizceye çeviri yaparken veya düşünürken bu konuda yapılan tüm yaygın kontrast hatalarını ve çözümlerini yaz.\n\n"
                        + "# 📝 Örnek Cümle Analizleri (Book Sentences)\n"
                        + "Yukarıdaki orijinal kitap sayfalarında ve alıştırmalarında geçen **TÜM İLGİLİ ÖRNEK CÜMLELERİ VE DİYALOGLARI (Hiçbir sınırlama ve adet kısıtlaması olmadan, hepsini)** ayıkla. İngilizce orijinal hallerini ve hemen altına en doğru Türkçe akademik çevirilerini liste şeklinde eksiksiz yaz.\n\n"
                        + "# 🧠 İnteraktif Alıştırma Paneli (Interactive Quiz)\n"
                        + "Yukarıdaki kitap sayfalarında yer alan egzersiz maddelerinin **HEPSİNİ/TAMAMINI** şıklı boşluk doldurma sorularına dönüştür ('[ _____ ]' formatında). Soruların altına A, B, C, D şıklarını koy.\n"
                        + "*En alta ise 'Cevap Anahtarı ve Detaylı Dil Bilgisi Açıklaması' ekleyerek her bir sorunun dil bilgisi gerekçesini detaylıca anlat.*";

      try {
        if(navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(promptPayload);
        } else {
          var ta = document.createElement("textarea"); ta.value = promptPayload;
          ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.focus(); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta);
        }
        alert("📘 Tam Dinamik Azar Taraması Başarılı!\n\nTaranan Sayfalar: " + topicData.pageNumbers.join(", ") + "\n\nPrompt kopyalandı! Gemini sayfasına yapıştırabilirsiniz (Ctrl+V).");
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