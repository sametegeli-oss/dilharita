/* index-app-layout.js — SADE DÜZEN (v11)
   - Tüm üst başlıklar kaldırıldı
   - Kart içinde: İngilizce, Türkçe, telaffuz, Google Translate, Zor/Normal/Kolay
   - "Araçlar" butonu → tüm araçlar açılır panelde
   - Alt satır: Önceki | Araçlar | Sonraki
   - Temiz, modern görünüm
*/
(function(){
  "use strict";
  var STYLE_ID = "dh-clean-layout";
  var applying = false;

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* === TÜM BAŞLIKLARI GİZLE === */
      .app-header, .module-header, .top-header, .study-header,
      .page-header, .breadcrumb, .header-title, .module-name,
      .level-title, .unit-title, .lesson-title,
      [class*="header"]:not(.study-nav),
      [class*="title"]:not(.dh-tools-title),
      h1, h2, h3, h4, .card-title, .section-title {
        display: none !important;
      }
      /* Kart içi gereksiz öğeler */
      .card > div:first-child,
      .card > p:first-child,
      .card > span:first-child {
        display: none !important;
      }

      /* Alttaki sabit nav'ı kaldır */
      .study-nav.dh-fixed-nav { display: none !important; }
      body { padding-bottom: 0 !important; }

      /* === KART DÜZENİ === */
      .card {
        background: transparent !important;
        box-shadow: none !important;
        padding: 12px 16px !important;
        margin: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px;
        height: 100vh;
        max-height: 100vh;
        overflow-y: auto;
      }
      .card .sm-img-wrap {
        text-align: center;
        margin: 0;
      }
      .card .sm-img-wrap img {
        max-height: 140px;
        width: auto;
        object-fit: contain;
        border-radius: 8px;
      }
      .card .card-en {
        font-size: 20px;
        font-weight: 700;
        color: #fff;
        margin: 2px 0;
        line-height: 1.3;
      }
      .card .card-tr {
        font-size: 17px;
        color: #a8c8ff;
        margin: 2px 0;
        line-height: 1.3;
      }
      .card .card-pron {
        font-size: 15px;
        color: #8899bb;
        margin: 2px 0;
      }

      /* Google Translate butonu */
      .dh-gtr-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        background: #1a2942;
        color: #cfe0ff;
        font: 600 13px Nunito, system-ui, sans-serif;
        cursor: pointer;
        width: fit-content;
      }
      .dh-gtr-btn:hover { background: #22344f; }

      /* Zorluk butonları */
      .dh-grade-row {
        display: flex;
        gap: 8px;
        margin: 4px 0;
      }
      .dh-grade-row button {
        flex: 1;
        min-height: 44px;
        border-radius: 10px;
        font-weight: 700;
        font-size: 14px;
        border: 1px solid rgba(255,255,255,0.08);
        background: #0d1a30;
        color: #cfe0ff;
        cursor: pointer;
        transition: all 0.2s;
      }
      .dh-grade-row button:hover { background: #1a2a44; }
      .dh-grade-row .grade-hard { color: #ff6b6b; }
      .dh-grade-row .grade-normal { color: #ffd93d; }
      .dh-grade-row .grade-easy { color: #6bcb77; }

      /* === ARAÇLAR BUTONU VE PANELİ === */
      .dh-tools-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 0 18px;
        min-height: 44px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        background: #17233a;
        color: #eaf2ff;
        font: 700 14px Nunito, system-ui, sans-serif;
        cursor: pointer;
        flex: 0 0 auto;
        transition: all 0.2s;
      }
      .dh-tools-toggle:hover { background: #22304f; }
      .dh-tools-toggle .chev {
        transition: transform 0.3s ease;
        font-size: 11px;
      }
      .dh-tools-toggle.open .chev { transform: rotate(180deg); }

      /* Araçlar paneli */
      .dh-tools-panel {
        display: none;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        background: #0d1a30;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.06);
        margin-top: 4px;
      }
      .dh-tools-panel.open { display: flex; }
      .dh-tools-panel .dh-tools-title {
        font: 700 11px Nunito, system-ui, sans-serif;
        color: #6a8ab0;
        text-align: center;
        letter-spacing: 1px;
        text-transform: uppercase;
        margin: 0 0 4px 0;
      }
      .dh-tools-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .dh-tools-grid .dh-tool-btn {
        min-height: 34px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 6px;
        border: 1px solid rgba(255,255,255,0.06);
        background: #1a2942;
        color: #9bb8e8;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
      }
      .dh-tools-grid .dh-tool-btn:hover {
        background: #22344f;
        color: #fff;
        border-color: rgba(255,255,255,0.15);
      }

      /* === ALT NAV SATIRI === */
      .dh-nav-row {
        display: flex !important;
        gap: 8px;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
        padding-top: 10px;
        border-top: 1px solid rgba(255,255,255,0.06);
        width: 100%;
      }
      .dh-nav-row .btn {
        flex: 1;
        min-height: 44px;
        font-size: 14px !important;
        font-weight: 700 !important;
        border-radius: 10px !important;
        padding: 4px 10px;
        background: #0d1a30;
        border: 1px solid rgba(255,255,255,0.08);
        color: #cfe0ff;
        cursor: pointer;
        transition: all 0.2s;
      }
      .dh-nav-row .btn:hover { background: #1a2a44; }
      .dh-nav-row .btn:active { transform: scale(0.97); }

      /* === MOBİL YATAY === */
      @media (orientation:landscape) and (max-height:500px) {
        .card { padding: 6px 10px !important; gap: 4px; }
        .card .sm-img-wrap img { max-height: 70px; }
        .card .card-en { font-size: 16px; }
        .card .card-tr { font-size: 14px; }
        .card .card-pron { font-size: 12px; }
        .dh-grade-row button { min-height: 30px; font-size: 11px; }
        .dh-tools-toggle { min-height: 30px; font-size: 12px; padding: 0 12px; }
        .dh-nav-row .btn { min-height: 30px; font-size: 12px; }
        .dh-tools-grid { grid-template-columns: repeat(4, 1fr); }
        .dh-tools-grid .dh-tool-btn { min-height: 26px; font-size: 9px; }
        .dh-gtr-btn { font-size: 11px; padding: 4px 10px; }
      }

      @media (orientation:portrait) and (max-width:680px) {
        .dh-tools-grid { grid-template-columns: repeat(3, 1fr); }
      }
      @media (min-width:681px) {
        .dh-tools-grid { grid-template-columns: repeat(4, 1fr); }
        .card .sm-img-wrap img { max-height: 200px; }
      }
    `;
    document.head.appendChild(style);
  }

  // Yardımcı: metin ile buton bul
  function findButton(root, text) {
    var t = text.toLowerCase();
    var btns = root.querySelectorAll("button, a");
    for (var i = 0; i < btns.length; i++) {
      var txt = (btns[i].textContent || "").toLowerCase();
      if (txt.indexOf(t) !== -1) return btns[i];
    }
    return null;
  }

  // Ana düzenleme
  function applyLayout() {
    if (applying) return;
    applying = true;

    try {
      addStyles();

      // Kartı bul
      var card = document.querySelector(".card");
      if (!card) { applying = false; return; }

      // 1. Zaten düzenlenmişse tekrar yapma
      if (card.dataset.dhClean === "1") { applying = false; return; }

      // 2. study-nav'ı gizle ve butonları al
      var nav = document.querySelector(".study-nav");
      var prevBtn = null, nextBtn = null;
      if (nav) {
        var btns = nav.querySelectorAll(".btn");
        if (btns.length >= 2) {
          prevBtn = btns[0].cloneNode(true);
          nextBtn = btns[1].cloneNode(true);
        }
        nav.style.display = "none";
      }

      // 3. Zorluk butonlarını grupla
      var hard = findButton(card, "zor");
      var normal = findButton(card, "normal");
      var easy = findButton(card, "kolay");
      if (hard && normal && easy) {
        var gradeRow = document.createElement("div");
        gradeRow.className = "dh-grade-row";
        gradeRow.appendChild(hard);
        gradeRow.appendChild(normal);
        gradeRow.appendChild(easy);
        // Telaffuz veya Türkçe'den sonra ekle
        var pron = card.querySelector(".card-pron");
        var insertAfter = pron || card.querySelector(".card-tr");
        if (insertAfter) {
          insertAfter.insertAdjacentElement("afterend", gradeRow);
        } else {
          card.appendChild(gradeRow);
        }
      }

      // 4. Google Translate butonunu ekle (yoksa)
      if (!card.querySelector(".dh-gtr-btn")) {
        var en = card.querySelector(".card-en");
        if (en) {
          var gb = document.createElement("button");
          gb.className = "dh-gtr-btn";
          gb.innerHTML = "🌐 Google Translate";
          gb.onclick = function() {
            var txt = (en.textContent || "").trim();
            if (!txt) return;
            // Kopyala
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(txt);
              } else {
                var ta = document.createElement("textarea");
                ta.value = txt;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
              }
            } catch(e) {}
            window.open("https://translate.google.com/?sl=en&tl=tr&op=translate&text=" + encodeURIComponent(txt), "_blank");
          };
          var insertAfter = card.querySelector(".card-pron") || card.querySelector(".card-tr");
          if (insertAfter) {
            insertAfter.insertAdjacentElement("afterend", gb);
          } else {
            card.appendChild(gb);
          }
        }
      }

      // 5. Araçlar panelini oluştur
      var toolsPanel = document.createElement("div");
      toolsPanel.className = "dh-tools-panel";
      var title = document.createElement("div");
      title.className = "dh-tools-title";
      title.textContent = "🛠 Araçlar";
      toolsPanel.appendChild(title);
      var grid = document.createElement("div");
      grid.className = "dh-tools-grid";
      toolsPanel.appendChild(grid);
      card.appendChild(toolsPanel);

      // Araç butonlarını topla (zorluk ve Google Translate hariç)
      var allBtns = card.querySelectorAll("button, a");
      var toolTexts = ["düşük", "yavaş", "öğretmen", "zayıf analiz", 
                       "dinle", "detay", "shadow", "al test", "benzer", 
                       "hikaye", "podcast", "konuşma", "cümle yaz", "partner", "görsel"];
      var moved = [];
      allBtns.forEach(function(btn) {
        var txt = (btn.textContent || "").toLowerCase().trim();
        // Zorluk butonlarını atla
        if (txt === "zor" || txt === "normal" || txt === "kolay") return;
        // Google Translate butonunu atla
        if (btn.classList.contains("dh-gtr-btn")) return;
        // Araç mı?
        var isTool = toolTexts.some(function(t) { return txt.indexOf(t) !== -1; });
        if (isTool || btn.classList.contains("teacher-btn") || btn.classList.contains("extra-weak")) {
          var clone = btn.cloneNode(true);
          clone.className = "dh-tool-btn";
          clone.onclick = btn.onclick ? btn.onclick : function(){};
          grid.appendChild(clone);
          btn.style.display = "none";
          moved.push(btn);
        }
      });

      // 6. Nav satırını ekle
      var navRow = document.createElement("div");
      navRow.className = "dh-nav-row";

      // Önceki butonu
      if (prevBtn) {
        prevBtn.className = "btn";
        navRow.appendChild(prevBtn);
      }

      // Araçlar toggle butonu
      var toggle = document.createElement("button");
      toggle.className = "dh-tools-toggle";
      toggle.innerHTML = '🛠 Araçlar <span class="chev">▾</span>';
      toggle.onclick = function() {
        var panel = card.querySelector(".dh-tools-panel");
        if (panel) {
          panel.classList.toggle("open");
          this.classList.toggle("open");
        }
      };
      navRow.appendChild(toggle);

      // Sonraki butonu
      if (nextBtn) {
        nextBtn.className = "btn";
        navRow.appendChild(nextBtn);
      }

      card.appendChild(navRow);

      // 7. İşaretle
      card.dataset.dhClean = "1";

    } catch(e) {
      console.log("[dh-clean] hata:", e);
    }

    applying = false;
  }

  // Otomatik çalıştır
  function boot() {
    applyLayout();
    // DOM değişikliklerini izle
    var observer = new MutationObserver(function() {
      if (!applying) applyLayout();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Periyodik kontrol
    var count = 0;
    var interval = setInterval(function() {
      applyLayout();
      if (++count > 10) clearInterval(interval);
    }, 500);
  }

  if (document.readyState !== "loading") {
    boot();
  } else {
    document.addEventListener("DOMContentLoaded", boot);
  }
})();
