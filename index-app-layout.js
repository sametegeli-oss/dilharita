/* index-app-layout.js — DÜZEN TOPARLAYICI (v9.1 — araçlar butonlu, küçük butonlar)
   1) Tüm üst başlıklar kaldırıldı
   2) Zor/Normal/Kolay → cümlenin Türkçesinin ALTINA
   3) Araçlar paneli (Detay, Zayıf Analiz, Öğretmen, 9'lu ızgara) → sadece "Araçlar" butonuna tıklanınca açılır
   4) Önceki, Araçlar, Sonraki butonları kartın altında
   5) Altta sabit çubuk KALDIRILDI
*/
(function(){
  "use strict";
  var STYLE_ID="dh-ia-layout-css";
  var applying=false, scheduled=false;
  var viewportHeight = window.innerHeight;

  function updateViewportHeight() {
    viewportHeight = window.innerHeight;
    if (window.visualViewport) {
      viewportHeight = window.visualViewport.height;
    }
    return viewportHeight;
  }

  function addStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var s=document.createElement("style"); s.id=STYLE_ID;
    
    var vh = updateViewportHeight();
    
    s.textContent =
    /* === TÜM ÜST BAŞLIKLARI GİZLE === */
    +".app-header, .app-header *, .module-header, .module-title, .top-header, "
    +".study-header, .page-header, .breadcrumb, .header-title, .module-name, "
    +".level-title, .unit-title, .lesson-title, [class*='header']:not(.study-nav), "
    +".card-title, .section-title, .heading, h1, h2, h3, h4, "
    +"[class*='title']:not(.dh-tools-title), [class*='Level'], [class*='Unit'], "
    +"[class*='Lesson'], [class*='Confirmation'], [class*='Present']{display:none !important}"
    
    /* A1, Confirmation, Present Simple gibi metinleri gizle */
    +".card > div:first-child, .card > p:first-child, .card > span:first-child{display:none !important}"
    +".card > *:not(.card-en):not(.card-tr):not(.card-pron):not(.sm-img-wrap):not(.dh-col-right):not(.dh-grade-under):not(.card-actions):not(.dh-gtr-btn):not(.dh-nav-row):not(.dh-tools-box){display:none !important}"
    
    /* ALTTAN SABİT ÇUBUĞU KALDIR */
    +".study-nav.dh-fixed-nav{display:none !important}"
    +"body{padding-bottom:0 !important}"
    
    /* Kart içi nav satırı */
    +".dh-nav-row{display:flex !important;gap:6px;align-items:center;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);width:100%}"
    +".dh-nav-row .btn{flex:1;min-height:36px;font-size:13px !important;font-weight:700 !important;border-radius:10px !important;padding:4px 8px}"
    +".dh-nav-row .dh-tools-toggle{flex:0 0 auto !important;min-height:36px;padding:0 12px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:#17233a;color:#eaf2ff;font:700 12px Nunito,system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;white-space:nowrap}"
    +".dh-nav-row .dh-tools-toggle:hover{background:#22304f}"
    +".dh-nav-row .dh-tools-toggle .chev{transition:transform .2s;font-size:9px}"
    +".dh-nav-row .dh-tools-toggle.open .chev{transform:rotate(180deg)}"
    
    /* ---- ARAÇLAR PANELİ (sadece açıkken görünür) ---- */
    +".dh-tools-box{display:none !important;flex-direction:column;gap:4px;margin-top:4px;padding:6px 8px;background:#0d1a30;border-radius:8px;border:1px solid rgba(255,255,255,.08);width:100%}"
    +".dh-tools-box.open{display:flex !important}"
    +".dh-tools-box .dh-tools-title{font:700 10px Nunito,system-ui,sans-serif;color:#9fb3d9;text-align:center;margin:0 0 4px 0;padding:0}"
    /* Araç butonları - küçük ve grid */
    +".dh-tools-box .dh-tools-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}"
    +".dh-tools-box .dh-tools-grid .dh-tool-btn{min-height:26px;border-radius:6px;font-size:10px;font-weight:600;padding:2px 4px;border:1px solid rgba(255,255,255,0.06);background:#1a2942;color:#9bb8e8;cursor:pointer;transition:all .2s;text-align:center}"
    +".dh-tools-box .dh-tools-grid .dh-tool-btn:hover{background:#22344f;color:#fff;border-color:rgba(255,255,255,0.15)}"
    /* Eski buton stilleri (uyumluluk) */
    +".dh-tools-box .dh-moved-btn{width:100%;min-height:26px;border-radius:6px;font-size:10px;font-weight:600;padding:2px 4px;border:1px solid rgba(255,255,255,0.06);background:#1a2942;color:#9bb8e8;cursor:pointer;text-align:center}"
    +".dh-tools-box .wd-tools-row{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:2px}"
    +".dh-tools-box .wd-tools-row button{min-height:26px;border-radius:6px;font-size:10px;font-weight:600;padding:2px 4px;border:1px solid rgba(255,255,255,0.06);background:#1a2942;color:#9bb8e8;cursor:pointer}"
    
    /* ---- 2 SÜTUN DÜZEN ---- */
    +".dh-col-left,.dh-col-right{display:block}"
    
    /* Büyük ekranlar */
    +"@media (orientation:landscape),(min-width:680px){"
    +".card.dh-split{display:grid !important;grid-template-columns:1.5fr .9fr;gap:12px 14px;align-items:start}"
    +".card.dh-split>*{grid-column:1;min-width:0}"
    +".card.dh-split>.dh-col-right{grid-column:2;grid-row:1/99;display:flex;flex-direction:column;gap:4px;align-self:start}"
    +".card.dh-split .sm-img-wrap{margin:4px 0}"
    +".card.dh-split .dh-grade-under{flex-direction:column !important;gap:4px !important;margin:0}"
    +".card.dh-split .dh-grade-under button{min-height:32px !important;padding:6px 8px !important;font-size:12px !important;border-radius:8px !important}"
    +".card.dh-split .card-actions{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}"
    +".card.dh-split .card-actions button{min-height:30px !important;padding:5px 8px !important;font-size:11px !important;border-radius:8px !important}"
    /* Nav row 2 sütunda */
    +".card.dh-split .dh-nav-row{grid-column:1/3;margin-top:8px;padding-top:8px}"
    +".card.dh-split .dh-tools-box{grid-column:1/3}"
    +"}"
    
    /* ---- MOBİL YATAY ---- */
    +"@media (orientation:landscape) and (max-height:500px){"
    +"html,body{height:100%;overflow:hidden;margin:0;padding:0}"
    +".app-container,.app-content,.main-container,.container{height:100%;overflow:hidden;padding:0 !important;margin:0 !important}"
    /* Kartı tam ekran yap */
    +".card.dh-split{display:grid !important;grid-template-columns:1.1fr 1fr !important;gap:2px 5px !important;padding:2px 4px !important;height:100% !important;max-height:100vh !important;overflow-y:auto;margin:0 !important;border-radius:0 !important}"
    +".card.dh-split .sm-img-wrap{margin:0;max-height:80px}"
    +".card.dh-split .sm-img-wrap img{max-height:80px;width:auto;object-fit:contain}"
    +".card.dh-split .card-en{font-size:" + Math.max(10, Math.min(13, vh * 0.025)) + "px !important;line-height:1.1;margin:0}"
    +".card.dh-split .card-tr{font-size:" + Math.max(9, Math.min(12, vh * 0.023)) + "px !important;line-height:1.1;margin:0}"
    +".card.dh-split .card-pron{font-size:" + Math.max(8, Math.min(10, vh * 0.02)) + "px !important;margin:0}"
    +".card.dh-split .dh-grade-under{flex-direction:row !important;gap:1px !important;margin:0}"
    +".card.dh-split .dh-grade-under button{min-height:" + Math.max(14, Math.min(22, vh * 0.04)) + "px !important;padding:0 2px !important;font-size:" + Math.max(6, Math.min(9, vh * 0.018)) + "px !important;border-radius:3px !important;flex:1}"
    +".card.dh-split .card-actions{gap:1px;margin:0;display:flex;flex-wrap:wrap}"
    +".card.dh-split .card-actions button{min-height:" + Math.max(14, Math.min(22, vh * 0.04)) + "px !important;padding:0 2px !important;font-size:" + Math.max(6, Math.min(8, vh * 0.016)) + "px !important;border-radius:3px !important;flex:1 0 auto}"
    +".card.dh-split .dh-gtr-btn{padding:0 3px !important;font-size:" + Math.max(6, Math.min(8, vh * 0.016)) + "px !important;margin:0}"
    +".card.dh-split .dh-col-right{gap:0 !important}"
    +".dh-gtr-btn{font-size:" + Math.max(6, Math.min(8, vh * 0.016)) + "px !important;padding:0 3px !important;margin:0}"
    /* Nav row */
    +".card.dh-split .dh-nav-row{grid-column:1/3;margin-top:3px;padding-top:3px;gap:2px}"
    +".card.dh-split .dh-nav-row .btn{min-height:" + Math.max(18, Math.min(26, vh * 0.045)) + "px !important;font-size:" + Math.max(7, Math.min(10, vh * 0.02)) + "px !important;padding:0 2px !important;border-radius:4px !important}"
    +".card.dh-split .dh-nav-row .dh-tools-toggle{min-height:" + Math.max(18, Math.min(26, vh * 0.045)) + "px !important;padding:0 6px !important;font-size:" + Math.max(7, Math.min(9, vh * 0.018)) + "px !important;border-radius:4px !important}"
    /* Araçlar paneli yatayda */
    +".card.dh-split .dh-tools-box{grid-column:1/3}"
    +".card.dh-split .dh-tools-box .dh-tools-grid{grid-template-columns:repeat(4,1fr)}"
    +".card.dh-split .dh-tools-box .dh-tools-grid .dh-tool-btn{min-height:" + Math.max(16, Math.min(22, vh * 0.04)) + "px !important;font-size:" + Math.max(6, Math.min(8, vh * 0.016)) + "px !important;padding:1px 3px !important}"
    /* "Bu cümleyi ne kadar biliyorsun?" yazısını küçült */
    +".dh-col-right > div:first-child{font-size:" + Math.max(5, Math.min(7, vh * 0.014)) + "px !important;margin:0 !important;padding:0 !important}"
    /* Scroll bar */
    +".card.dh-split::-webkit-scrollbar{width:1.5px}"
    +".card.dh-split::-webkit-scrollbar-track{background:transparent}"
    +".card.dh-split::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:1px}"
    +"}"
    
    /* ---- MOBİL PORTRE ---- */
    +"@media (orientation:portrait) and (max-width:680px){"
    +".card.dh-split{display:flex !important;flex-direction:column;gap:4px;padding-top:0 !important;margin-top:0 !important}"
    +".card.dh-split .dh-col-right{width:100%}"
    +".card.dh-split .dh-grade-under{flex-direction:row !important;gap:3px}"
    +".card.dh-split .dh-grade-under button{min-height:32px !important;font-size:11px !important}"
    +".card.dh-split .dh-nav-row{margin-top:4px;padding-top:4px}"
    +".card.dh-split .dh-tools-box .dh-tools-grid{grid-template-columns:repeat(3,1fr)}"
    +"}"
    
    /* Zorluk butonları */
    +".dh-grade-under{display:flex !important;gap:6px;margin:6px 0 2px}"
    +".dh-gtr-btn{display:inline-flex;align-items:center;gap:3px;margin:3px 0 1px;padding:5px 10px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#1a2942;color:#cfe0ff;font:700 11px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-gtr-btn:hover{background:#22344f}"
    +".dh-grade-under button{flex:1;min-height:36px;border-radius:8px;font-weight:700;font-size:12px;border:1px solid rgba(255,255,255,.10);cursor:pointer}"
    
    /* Kart - genel */
    +".legend,.legend-item,.legend-dot{display:none !important}"
    +".card{padding-top:4px !important;margin-top:0 !important}"
    +".card.dh-split{margin-top:0 !important;padding-top:2px !important}";
    
    document.head.appendChild(s);
  }
  
  // Viewport listener
  function setupViewportListener() {
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function() {
        updateViewportHeight();
        var oldStyle = document.getElementById(STYLE_ID);
        if (oldStyle) oldStyle.remove();
        addStyle();
        apply();
      });
    }
    var resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        updateViewportHeight();
        var oldStyle = document.getElementById(STYLE_ID);
        if (oldStyle) oldStyle.remove();
        addStyle();
        apply();
      }, 200);
    });
  }
  
  function currentCard(){
    var cards=[].slice.call(document.querySelectorAll(".card"));
    return cards.find(function(c){ return c.querySelector(".card-en") && c.querySelector(".card-actions"); });
  }
  
  function btnByText(root, txt){
    var t=txt.toLocaleLowerCase("tr");
    return [].slice.call(root.querySelectorAll("button,a")).find(function(b){
      return (b.textContent||"").toLocaleLowerCase("tr").indexOf(t)>=0;
    })||null;
  }
  
  function splitCard(card){
    if(card.dataset.dhSplitDone==="1") return;
    var enEl=card.querySelector(".card-en"); 
    if(!enEl){ return; }
    var grade=card.querySelector(".dh-grade-under");
    var actions=card.querySelector(".card-actions");
    if(!grade || !actions){ return; }

    var right=document.createElement("div"); 
    right.className="dh-col-right";
    
    var q=[].slice.call(card.querySelectorAll("*")).find(function(e){
      return e.children.length===0 && /ne kadar biliyorsun/i.test(e.textContent||"");
    });
    if(q) right.appendChild(q);
    right.appendChild(grade);
    right.appendChild(actions);
    card.appendChild(right);
    card.classList.add("dh-split");
    card.dataset.dhSplitDone="1";
  }

  // NAV'ı kartın içine taşı
  function moveNavToCard(card){
    if(card.dataset.dhNavMoved==="1") return;
    
    var nav = document.querySelector(".study-nav");
    if(!nav) return;
    
    // Varolan nav row'u kontrol et
    var navRow = card.querySelector(".dh-nav-row");
    if(!navRow){
      navRow = document.createElement("div");
      navRow.className = "dh-nav-row";
      card.appendChild(navRow);
    }
    
    // Butonları nav'dan al
    var btns = nav.querySelectorAll(".btn");
    
    // Önceki butonu
    if(btns.length >= 1){
      var prevBtn = btns[0].cloneNode(true);
      prevBtn.className = "btn";
      navRow.appendChild(prevBtn);
    }
    
    // Araçlar butonu (toggle) - yeni oluştur
    var toolsToggle = document.createElement("button");
    toolsToggle.className = "dh-tools-toggle";
    toolsToggle.innerHTML = '🛠 Araçlar <span class="chev">▾</span>';
    toolsToggle.onclick = function(){
      var box = document.getElementById("dhToolsBox");
      if(box){
        box.classList.toggle("open");
        this.classList.toggle("open");
      }
    };
    navRow.appendChild(toolsToggle);
    
    // Sonraki butonu
    if(btns.length >= 2){
      var nextBtn = btns[1].cloneNode(true);
      nextBtn.className = "btn";
      navRow.appendChild(nextBtn);
    }
    
    // Orijinal nav'ı gizle
    nav.style.display = "none";
    
    card.dataset.dhNavMoved = "1";
  }
  
  function moveGrade(card){
    if(card.dataset.dhGradeDone==="1") return;
    var tr=card.querySelector(".card-tr"); 
    if(!tr) return;
    
    if(!card.querySelector(".dh-gtr-btn")){
      var en=card.querySelector(".card-en");
      if(en){
        var gb=document.createElement("button");
        gb.type="button"; 
        gb.className="dh-gtr-btn";
        gb.innerHTML="🌐 Google Translate";
        gb.onclick=function(){
          var txt=(en.textContent||"").trim();
          if(!txt) return;
          function fallbackCopy(x){ 
            try{ 
              var ta=document.createElement("textarea"); 
              ta.value=x; 
              ta.style.position="fixed"; 
              ta.style.opacity="0"; 
              document.body.appendChild(ta); 
              ta.focus(); 
              ta.select(); 
              document.execCommand("copy"); 
              document.body.removeChild(ta); 
            }catch(e){} 
          }
          try{ 
            if(navigator.clipboard && navigator.clipboard.writeText){ 
              navigator.clipboard.writeText(txt).catch(function(){ fallbackCopy(txt); }); 
            } else { 
              fallbackCopy(txt); 
            } 
          }catch(e){ 
            fallbackCopy(txt); 
          }
          try{
            var n=document.createElement("div");
            n.textContent="📋 Kopyalandı! Google Translate açılıyor...";
            n.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#0f1f3a;color:#fff;border:1px solid #2563eb;padding:8px 14px;border-radius:8px;font:700 11px system-ui;box-shadow:0 4px 16px rgba(0,0,0,.5);max-width:90vw;text-align:center";
            document.body.appendChild(n);
            setTimeout(function(){ 
              n.style.transition="opacity .3s"; 
              n.style.opacity="0"; 
              setTimeout(function(){ n.remove(); },300); 
            },2000);
          }catch(e){}
          window.open("https://translate.google.com/?sl=en&tl=tr&op=translate&text="+encodeURIComponent(txt), "_blank");
        };
        tr.insertAdjacentElement("afterend", gb);
      }
    }
    
    var zor=card.querySelector(".grade-hard")||btnByText(card,"zor");
    var nor=card.querySelector(".grade-normal")||btnByText(card,"normal");
    var kol=card.querySelector(".grade-easy")||btnByText(card,"kolay");
    if(!(zor&&nor&&kol)) return;
    
    var grp=card.querySelector(".dh-grade-under");
    if(!grp){ 
      grp=document.createElement("div"); 
      grp.className="dh-grade-under"; 
    }
    grp.appendChild(zor); 
    grp.appendChild(nor); 
    grp.appendChild(kol);
    
    var anchor=card.querySelector(".card-pron")||tr;
    anchor.insertAdjacentElement("afterend", grp);
    card.dataset.dhGradeDone="1";
  }
  
  function ensureTools(card){
    var box = document.getElementById("dhToolsBox");
    
    if(!box){
      box = document.createElement("div");
      box.id = "dhToolsBox";
      box.className = "dh-tools-box";
      box.innerHTML = '<div class="dh-tools-title">🛠 Araçlar</div>';
      
      // Grid container
      var grid = document.createElement("div");
      grid.className = "dh-tools-grid";
      box.appendChild(grid);
      
      // Kartın içine ekle (navRow'dan önce)
      card.appendChild(box);
    }
    
    if(card && card.dataset.dhToolsFilled!=="1"){
      var grid = box.querySelector(".dh-tools-grid");
      if(!grid){
        grid = document.createElement("div");
        grid.className = "dh-tools-grid";
        box.appendChild(grid);
      }
      
      // Araç butonlarını bul ve grid'e ekle
      var allBtns = card.querySelectorAll("button, a");
      var toolTexts = ["düşük", "yavaş", "öğretmen", "zayıf analiz", 
                       "detay", "shadow", "al test", "benzer", 
                       "hikaye", "podcast", "konuşma", "cümle yaz", "partner", "görsel"];
      var added = 0;
      allBtns.forEach(function(btn){
        var txt = (btn.textContent || "").toLowerCase().trim();
        // Zorluk butonlarını atla
        if (txt === "zor" || txt === "normal" || txt === "kolay") return;
        // Google Translate butonunu atla
        if (btn.classList.contains("dh-gtr-btn")) return;
        // Nav butonlarını atla
        if (btn.closest(".dh-nav-row")) return;
        
        var isTool = toolTexts.some(function(t){ return txt.indexOf(t) !== -1; });
        if (isTool || btn.classList.contains("teacher-btn") || btn.classList.contains("extra-weak")) {
          var clone = btn.cloneNode(true);
          clone.className = "dh-tool-btn";
          // Orijinal onclick'i kopyala
          if (btn.onclick) {
            clone.onclick = btn.onclick;
          }
          grid.appendChild(clone);
          btn.style.display = "none";
          added++;
        }
      });
      
      // Eğer hiç buton eklenmediyse, mevcut .wd-tools-row'u dene
      if (added === 0) {
        var oldGrid = card.querySelector(".wd-tools-row");
        if (oldGrid) {
          grid.innerHTML = '';
          var items = oldGrid.querySelectorAll("button, a");
          items.forEach(function(item){
            var clone = item.cloneNode(true);
            clone.className = "dh-tool-btn";
            if (item.onclick) clone.onclick = item.onclick;
            grid.appendChild(clone);
            item.style.display = "none";
          });
          oldGrid.style.display = "none";
        }
      }
      
      card.dataset.dhToolsFilled = "1";
    }
  }
  
  function apply(){
    if(applying) return;
    applying=true;
    try{
      updateViewportHeight();
      addStyle();
      var card = currentCard();
      if(card){ 
        moveGrade(card); 
        ensureTools(card);
        moveNavToCard(card);
        splitCard(card);
      }
    }catch(e){ console.log("[dh-layout] hata:", e); }
    applying=false;
  }
  
  function schedule(){
    if(scheduled) return;
    scheduled=true;
    setTimeout(function(){ 
      scheduled=false; 
      apply(); 
    }, 150);
  }
  
  function boot(){
    apply();
    setupViewportListener();
    try{
      new MutationObserver(function(){ 
        if(applying) return; 
        schedule(); 
      })
      .observe(document.body,{childList:true,subtree:true});
    }catch(e){}
    var n=0, t=setInterval(function(){ 
      apply(); 
      if(++n>12) clearInterval(t); 
    }, 400);
  }
  
  if(document.readyState!=="loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
