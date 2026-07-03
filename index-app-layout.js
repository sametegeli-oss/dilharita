/* index-app-layout.js — DÜZEN TOPARLAYICI (v10 — araçlar butonlu, temiz görünüm)
   1) Tüm üst başlıklar kaldırıldı
   2) Zor/Normal/Kolay butonları kartta
   3) Araçlar butonu -> tüm araçlar açılır panelde
   4) Önceki, Araçlar, Sonraki kartın altında
   5) Temiz, düzenli görünüm
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
    
    /* Gereksiz elementleri gizle */
    +".card > div:first-child, .card > p:first-child, .card > span:first-child{display:none !important}"
    
    /* ALTTAN SABİT ÇUBUĞU KALDIR */
    +".study-nav.dh-fixed-nav{display:none !important}"
    +"body{padding-bottom:0 !important}"
    
    /* ---- KART ANA DÜZEN ---- */
    +".card{background:transparent !important;box-shadow:none !important;padding:8px 12px !important;margin:0 !important}"
    +".card.dh-split{display:flex !important;flex-direction:column !important;gap:8px;padding:6px 10px !important;margin:0 !important;height:100vh;max-height:100vh;overflow-y:auto}"
    
    /* Sol içerik (resim + cümle) */
    +".card.dh-split .sm-img-wrap{text-align:center;margin:0;padding:0}"
    +".card.dh-split .sm-img-wrap img{max-height:120px;width:auto;object-fit:contain;border-radius:8px}"
    +".card.dh-split .card-en{font-size:18px !important;font-weight:700;color:#fff;margin:4px 0;line-height:1.3}"
    +".card.dh-split .card-tr{font-size:16px !important;color:#a8c8ff;margin:2px 0;line-height:1.3}"
    +".card.dh-split .card-pron{font-size:14px !important;color:#8899bb;margin:2px 0}"
    
    /* Google Translate butonu */
    +".dh-gtr-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border:1px solid rgba(255,255,255,0.12);border-radius:8px;background:#1a2942;color:#cfe0ff;font:600 12px Nunito,system-ui,sans-serif;cursor:pointer;margin:2px 0}"
    +".dh-gtr-btn:hover{background:#22344f}"
    
    /* Zorluk butonları */
    +".dh-grade-under{display:flex !important;gap:6px;margin:6px 0 4px}"
    +".dh-grade-under button{flex:1;min-height:40px;border-radius:10px;font-weight:700;font-size:13px;border:1px solid rgba(255,255,255,0.10);cursor:pointer;background:#0d1a30;color:#cfe0ff}"
    +".dh-grade-under button:hover{background:#1a2a44}"
    +".dh-grade-under .grade-hard{color:#ff6b6b}"
    +".dh-grade-under .grade-normal{color:#ffd93d}"
    +".dh-grade-under .grade-easy{color:#6bcb77}"
    
    /* ---- ARAÇLAR BUTONU VE PANELİ ---- */
    +".dh-tools-toggle{display:flex;align-items:center;justify-content:center;gap:6px;padding:0 16px;min-height:40px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;background:#17233a;color:#eaf2ff;font:700 13px Nunito,system-ui,sans-serif;cursor:pointer;flex:0 0 auto}"
    +".dh-tools-toggle:hover{background:#22304f}"
    +".dh-tools-toggle .chev{transition:transform .3s ease;font-size:10px}"
    +".dh-tools-toggle.open .chev{transform:rotate(180deg)}"
    
    /* Araçlar paneli - açılır kapanır */
    +".dh-tools-box{display:none;flex-direction:column;gap:6px;padding:8px 10px;background:#0d1a30;border-radius:10px;border:1px solid rgba(255,255,255,0.06);width:100%}"
    +".dh-tools-box.open{display:flex}"
    +".dh-tools-box .dh-tools-title{font:700 11px Nunito,system-ui,sans-serif;color:#6a8ab0;text-align:center;margin:0;padding:0;letter-spacing:1px;text-transform:uppercase}"
    
    /* Araç butonları grid */
    +".dh-tools-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}"
    +".dh-tools-grid .dh-tool-btn{min-height:32px;border-radius:6px;font-size:10px;font-weight:600;padding:2px 4px;border:1px solid rgba(255,255,255,0.06);background:#1a2942;color:#9bb8e8;cursor:pointer;transition:all .2s}"
    +".dh-tools-grid .dh-tool-btn:hover{background:#22344f;color:#fff;border-color:rgba(255,255,255,0.15)}"
    +".dh-tools-grid .dh-tool-btn.primary{color:#ffd93d}"
    +".dh-tools-grid .dh-tool-btn.success{color:#6bcb77}"
    +".dh-tools-grid .dh-tool-btn.danger{color:#ff6b6b}"
    +".dh-tools-grid .dh-tool-btn.purple{color:#a78bfa}"
    
    /* ---- ALT NAV SATIRI ---- */
    +".dh-nav-row{display:flex !important;gap:6px;align-items:center;justify-content:space-between;margin-top:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);width:100%}"
    +".dh-nav-row .btn{flex:1;min-height:40px;font-size:13px !important;font-weight:700 !important;border-radius:10px !important;padding:4px 8px;background:#0d1a30;border:1px solid rgba(255,255,255,0.08);color:#cfe0ff;cursor:pointer}"
    +".dh-nav-row .btn:hover{background:#1a2a44}"
    +".dh-nav-row .btn:active{transform:scale(0.97)}"
    
    /* ---- MOBİL YATAY OPTİMİZASYON ---- */
    +"@media (orientation:landscape) and (max-height:500px){"
    +"html,body{height:100%;overflow:hidden;margin:0;padding:0}"
    +".app-container,.app-content,.main-container,.container{height:100%;overflow:hidden;padding:0 !important;margin:0 !important}"
    +".card.dh-split{padding:4px 8px !important;gap:4px}"
    +".card.dh-split .sm-img-wrap img{max-height:70px}"
    +".card.dh-split .card-en{font-size:" + Math.max(12, Math.min(16, vh * 0.03)) + "px !important}"
    +".card.dh-split .card-tr{font-size:" + Math.max(11, Math.min(14, vh * 0.027)) + "px !important}"
    +".card.dh-split .card-pron{font-size:" + Math.max(10, Math.min(12, vh * 0.024)) + "px !important}"
    +".dh-grade-under button{min-height:" + Math.max(24, Math.min(32, vh * 0.06)) + "px !important;font-size:" + Math.max(10, Math.min(12, vh * 0.024)) + "px !important}"
    +".dh-tools-toggle{min-height:" + Math.max(24, Math.min(32, vh * 0.06)) + "px !important;font-size:" + Math.max(10, Math.min(12, vh * 0.024)) + "px !important;padding:0 10px}"
    +".dh-nav-row .btn{min-height:" + Math.max(24, Math.min(32, vh * 0.06)) + "px !important;font-size:" + Math.max(10, Math.min(12, vh * 0.024)) + "px !important}"
    +".dh-tools-grid{grid-template-columns:repeat(4,1fr)}"
    +".dh-tools-grid .dh-tool-btn{min-height:" + Math.max(20, Math.min(26, vh * 0.05)) + "px !important;font-size:" + Math.max(7, Math.min(9, vh * 0.018)) + "px !important}"
    +".dh-gtr-btn{font-size:" + Math.max(9, Math.min(11, vh * 0.022)) + "px !important;padding:2px 8px}"
    +"}"
    
    /* ---- MOBİL PORTRE ---- */
    +"@media (orientation:portrait) and (max-width:680px){"
    +".card.dh-split{padding:6px 10px !important}"
    +".dh-tools-grid{grid-template-columns:repeat(3,1fr)}"
    +".dh-grade-under button{min-height:36px;font-size:12px}"
    +"}"
    
    /* ---- DESKTOP ---- */
    +"@media (min-width:681px){"
    +".dh-tools-grid{grid-template-columns:repeat(4,1fr)}"
    +".card.dh-split .sm-img-wrap img{max-height:160px}"
    +"}";
    
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
  
  function moveGrade(card){
    if(card.dataset.dhGradeDone==="1") return;
    var tr=card.querySelector(".card-tr"); 
    if(!tr) return;
    
    // Google Translate butonu
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
          window.open("https://translate.google.com/?sl=en&tl=tr&op=translate&text="+encodeURIComponent(txt), "_blank");
        };
        tr.insertAdjacentElement("afterend", gb);
      }
    }
    
    // Zorluk butonları
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
  
  // Araçları topla ve panele koy
  function setupTools(card){
    if(card.dataset.dhToolsDone==="1") return;
    
    // Araçlar paneli
    var box = document.getElementById("dhToolsBox");
    if(!box){
      box = document.createElement("div");
      box.id = "dhToolsBox";
      box.className = "dh-tools-box";
      
      var title = document.createElement("div");
      title.className = "dh-tools-title";
      title.textContent = "🛠 Araçlar";
      box.appendChild(title);
      
      var grid = document.createElement("div");
      grid.className = "dh-tools-grid";
      box.appendChild(grid);
      
      card.appendChild(box);
    }
    
    var grid = box.querySelector(".dh-tools-grid");
    
    // Araç butonlarını bul ve grid'e ekle
    var toolButtons = [];
    
    // Mevcut butonları bul
    var allButtons = card.querySelectorAll("button, a");
    var toolTexts = ["düşük", "yavaş", "öğretmen", "zayıf analiz", 
                     "shadow", "al test", "benzer", "hikaye", 
                     "podcast", "konuşma", "cümle yaz", "partner", "görsel"];
    
    allButtons.forEach(function(btn){
      var txt = (btn.textContent || "").toLowerCase().trim();
      // Zorluk butonlarını atla
      if(txt === "zor" || txt === "normal" || txt === "kolay") return;
      // Google Translate butonunu atla
      if(btn.classList.contains("dh-gtr-btn")) return;
      // Nav butonlarını atla
      if(btn.closest(".dh-nav-row")) return;
      
      // Araç mı kontrol et
      var isTool = toolTexts.some(function(t){ return txt.includes(t); });
      if(isTool || btn.classList.contains("teacher-btn") || btn.classList.contains("extra-weak")){
        var newBtn = btn.cloneNode(true);
        newBtn.className = "dh-tool-btn";
        // Renk sınıfları ekle
        if(txt.includes("düşük") || txt.includes("shadow")) newBtn.classList.add("primary");
        if(txt.includes("yavaş") || txt.includes("konuşma")) newBtn.classList.add("success");
        if(txt.includes("öğretmen") || txt.includes("zayıf")) newBtn.classList.add("danger");
        if(txt.includes("test") || txt.includes("hikaye")) newBtn.classList.add("purple");
        newBtn.onclick = btn.onclick ? btn.onclick : function(){};
        grid.appendChild(newBtn);
        // Orijinal butonu gizle
        btn.style.display = "none";
      }
    });
    
    card.dataset.dhToolsDone = "1";
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
    
    // Önceki butonu
    var prevBtn = nav.querySelector(".btn:first-child");
    if(prevBtn){
      var newPrev = prevBtn.cloneNode(true);
      newPrev.className = "btn";
      navRow.appendChild(newPrev);
    }
    
    // Araçlar butonu
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
    var nextBtn = nav.querySelector(".btn:last-child");
    if(nextBtn && nextBtn !== prevBtn){
      var newNext = nextBtn.cloneNode(true);
      newNext.className = "btn";
      navRow.appendChild(newNext);
    }
    
    // Orijinal nav'ı gizle
    nav.style.display = "none";
    
    card.dataset.dhNavMoved = "1";
  }
  
  function apply(){
    if(applying) return;
    applying=true;
    try{
      updateViewportHeight();
      
      // Eski style'ı temizle
      var oldStyle = document.getElementById(STYLE_ID);
      if(oldStyle) oldStyle.remove();
      
      addStyle();
      var card = currentCard();
      if(card){ 
        moveGrade(card); 
        setupTools(card);
        moveNavToCard(card);
        card.classList.add("dh-split");
      }
    }catch(e){
      console.log("[dh-layout] hata:", e);
    }
    applying=false;
  }
  
  function schedule(){
    if(scheduled) return;
    scheduled=true;
    setTimeout(function(){ 
      scheduled=false; 
      apply(); 
    }, 200);
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
    }, 500);
  }
  
  if(document.readyState!=="loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
