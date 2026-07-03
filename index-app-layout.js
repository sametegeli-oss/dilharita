/* index-app-layout.js — DÜZEN TOPARLAYICI (v9.2 — Nav ve Araçlar Tam Korumalı)
   1) Üst başlıklar ve alttaki sabit çubuk kaldırıldı
   2) Zor/Normal/Kolay butonları Türkçenin altına taşındı
   3) Araçlar paneli default olarak gizlidir, sadece "Araçlar" butonuna basınca açılır
   4) Geliştirilmiş seçicilerle İleri/Geri ve tüm Araç butonları (div/span dahil) hatasız yakalanır
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
    ".app-header, .app-header *, .module-header, .module-title, .top-header, "
    +".study-header, .page-header, .breadcrumb, .header-title, .module-name, "
    +".level-title, .unit-title, .lesson-title, [class*='header']:not(.study-nav), "
    +".card-title, .section-title, .heading, h1, h2, h3, h4, "
    +"[class*='title']:not(.dh-tools-title), [class*='Level'], [class*='Unit'], "
    +"[class*='Lesson'], [class*='Confirmation'], [class*='Present']{display:none !important}"
    
    /* Kart içi temizlik */
    +".card > div:first-child, .card > p:first-child, .card > span:first-child{display:none !important}"
    +".card > *:not(.card-en):not(.card-tr):not(.card-pron):not(.sm-img-wrap):not(.dh-col-right):not(.dh-grade-under):not(.card-actions):not(.dh-gtr-btn):not(.dh-nav-row):not(.dh-tools-box){display:none !important}"
    
    /* ALTTAN SABİT ÇUBUĞU KALDIR */
    +".study-nav.dh-fixed-nav{display:none !important}"
    +"body{padding-bottom:0 !important}"
    
    /* Kart içi nav satırı */
    +".dh-nav-row{display:flex !important;gap:6px;align-items:center;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);width:100%}"
    +".dh-nav-row button, .dh-nav-row a, .dh-nav-row .dh-nav-btn{flex:1;min-height:36px;font-size:13px !important;font-weight:700 !important;border-radius:10px !important;padding:4px 8px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;cursor:pointer}"
    +".dh-nav-row .dh-tools-toggle{flex:0 0 auto !important;min-height:36px;padding:0 12px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:#17233a;color:#eaf2ff;font:700 12px Nunito,system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;white-space:nowrap}"
    +".dh-nav-row .dh-tools-toggle:hover{background:#22304f}"
    +".dh-nav-row .dh-tools-toggle .chev{transition:transform .2s;font-size:9px}"
    +".dh-nav-row .dh-tools-toggle.open .chev{transform:rotate(180deg)}"
    
    /* ---- ARAÇLAR PANELİ (Varsayılan olarak gizli) ---- */
    +".dh-tools-box{display:none !important;flex-direction:column;gap:4px;margin-top:4px;padding:6px 8px;background:#0d1a30;border-radius:8px;border:1px solid rgba(255,255,255,.08);width:100%}"
    +".dh-tools-box.open{display:flex !important}"
    +".dh-tools-box .dh-tools-title{font:700 10px Nunito,system-ui,sans-serif;color:#9fb3d9;text-align:center;margin:0 0 4px 0;padding:0}"
    
    /* Araç butonları grid yapısı */
    +".dh-tools-box .dh-tools-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}"
    +".dh-tools-box .dh-tools-grid > *{min-height:28px;border-radius:6px;font-size:10px;font-weight:600;padding:2px 4px;border:1px solid rgba(255,255,255,0.06) !important;background:#1a2942 !important;color:#9bb8e8 !important;cursor:pointer;transition:all .2s;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-sizing:border-box}"
    +".dh-tools-box .dh-tools-grid > *:hover{background:#22344f !important;color:#fff !important;border-color:rgba(255,255,255,0.15) !important}"
    
    /* ---- 2 SÜTUN DÜZEN ---- */
    +".dh-col-left,.dh-col-right{display:block}"
    
    /* Büyük ekranlar */
    +"@media (orientation:landscape),(min-width:680px){"
    +".card.dh-split{display:grid !important;grid-template-columns:1.5fr .9fr;gap:12px 14px;align-items:start}"
    +".card.dh-split>*{grid-column:1;min-width:0}"
    +".card.dh-split>.dh-col-right{grid-column:2;grid-row:1/99;display:flex;flex-direction:column;gap:4px;align-self:start}"
    +".card.dh-split .dh-nav-row{grid-column:1/3;margin-top:8px;padding-top:8px}"
    +".card.dh-split .dh-tools-box{grid-column:1/3}"
    +"}"
    
    /* Mobil Yatay */
    +"@media (orientation:landscape) and (max-height:500px){"
    +"html,body{height:100%;overflow:hidden;margin:0;padding:0}"
    +".card.dh-split{display:grid !important;grid-template-columns:1.1fr 1fr !important;gap:2px 5px !important;padding:2px 4px !important;height:100% !important;max-height:100vh !important;overflow-y:auto}"
    +".card.dh-split .dh-nav-row{grid-column:1/3;margin-top:3px;padding-top:3px;gap:2px}"
    +".card.dh-split .dh-tools-box{grid-column:1/3}"
    +".card.dh-split .dh-tools-box .dh-tools-grid{grid-template-columns:repeat(4,1fr)}"
    +"}"
    
    /* Mobil Dikey */
    +"@media (orientation:portrait) and (max-width:680px){"
    +".card.dh-split{display:flex !important;flex-direction:column;gap:4px}"
    +".card.dh-split .dh-col-right{width:100%}"
    +"}"
    
    /* Zorluk ve Translate Butonları */
    +".dh-grade-under{display:flex !important;gap:6px;margin:6px 0 2px}"
    +".dh-gtr-btn{display:inline-flex;align-items:center;gap:3px;margin:3px 0 1px;padding:5px 10px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#1a2942;color:#cfe0ff;font:700 11px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-grade-under button{flex:1;min-height:36px;border-radius:8px;font-weight:700;font-size:12px;border:1px solid rgba(255,255,255,.10);cursor:pointer}"
    +".legend,.legend-item,.legend-dot{display:none !important}"
    +".card{padding-top:4px !important;margin-top:0 !important}";
    
    document.head.appendChild(s);
  }
  
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
  }
  
  function currentCard(){
    var cards=[].slice.call(document.querySelectorAll(".card"));
    return cards.find(function(c){ return c.querySelector(".card-en"); });
  }
  
  function btnByText(root, txt){
    var t=txt.toLocaleLowerCase("tr");
    return [].slice.call(root.querySelectorAll("button,a,div,span")).find(function(b){
      return b.children.length === 0 && (b.textContent||"").toLocaleLowerCase("tr").indexOf(t)>=0;
    })||null;
  }
  
  function splitCard(card){
    if(card.dataset.dhSplitDone==="1") return;
    var grade=card.querySelector(".dh-grade-under");
    if(!grade) return;

    var right=card.querySelector(".dh-col-right") || document.createElement("div"); 
    right.className="dh-col-right";
    
    var q=[].slice.call(card.querySelectorAll("*")).find(function(e){
      return e.children.length===0 && /ne kadar biliyorsun/i.test(e.textContent||"");
    });
    if(q) right.appendChild(q);
    right.appendChild(grade);
    
    var actions=card.querySelector(".card-actions");
    if(actions) right.appendChild(actions);
    
    card.appendChild(right);
    card.classList.add("dh-split");
    card.dataset.dhSplitDone="1";
  }

  function moveNavToCard(card){
    if(card.dataset.dhNavMoved==="1") return;
    
    // Sitedeki alt gezinti barını (nav) seçicilerle tarayalım
    var nav = document.querySelector(".study-nav, [class*='study-nav'], [class*='nav-fixed']");
    if(!nav) return;
    
    var navRow = card.querySelector(".dh-nav-row") || document.createElement("div");
    navRow.className = "dh-nav-row";
    card.appendChild(navRow);
    
    // Sınıf adına bakılmaksızın tüm tıklanabilir elemanları (İleri / Geri butonlarını) topla
    var allNavBtns = [].slice.call(nav.querySelectorAll("button, a, [role='button']"));
    
    // Önceki / Geri Butonu
    if(allNavBtns.length >= 1){
      var prevBtn = allNavBtns[0].cloneNode(true);
      prevBtn.className = "dh-nav-btn";
      if(allNavBtns[0].onclick) prevBtn.onclick = allNavBtns[0].onclick;
      navRow.appendChild(prevBtn);
    }
    
    // Ortadaki Dinamik Araçlar Butonu (Toggle)
    var toolsToggle = document.createElement("button");
    toolsToggle.className = "dh-tools-toggle";
    toolsToggle.type = "button";
    toolsToggle.innerHTML = '🛠 Araçlar <span class="chev">▾</span>';
    toolsToggle.onclick = function(e){
      e.preventDefault();
      var box = document.getElementById("dhToolsBox");
      if(box){
        box.classList.toggle("open");
        this.classList.toggle("open");
      }
    };
    navRow.appendChild(toolsToggle);
    
    // Sonraki / İleri Butonu
    if(allNavBtns.length >= 2){
      var nextBtn = allNavBtns[1].cloneNode(true);
      nextBtn.className = "dh-nav-btn";
      if(allNavBtns[1].onclick) nextBtn.onclick = allNavBtns[1].onclick;
      navRow.appendChild(nextBtn);
    }
    
    nav.style.setProperty("display", "none", "important");
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
          window.open("https://translate.google.com/?sl=en&tl=tr&op=translate&text="+encodeURIComponent(txt), "_blank");
        };
        tr.insertAdjacentElement("afterend", gb);
      }
    }
    
    var zor=card.querySelector(".grade-hard")||btnByText(card,"zor");
    var nor=card.querySelector(".grade-normal")||btnByText(card,"normal");
    var kol=card.querySelector(".grade-easy")||btnByText(card,"kolay");
    if(!(zor&&nor&&kol)) return;
    
    var grp=card.querySelector(".dh-grade-under") || document.createElement("div"); 
    grp.className="dh-grade-under"; 
    
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
      var grid = document.createElement("div");
      grid.className = "grid dh-tools-grid";
      box.appendChild(grid);
      card.appendChild(box);
    }
    
    if(card && card.dataset.dhToolsFilled!=="1"){
      var grid = box.querySelector(".dh-tools-grid");
      
      // Genişletilmiş araç anahtar kelimeleri (Yazım hataları ve div yapıları dahil)
      var toolTexts = ["düşük", "yavaş", "öğretmen", "analiz", "detay", "shadow", 
                       "test", "benzer", "hikaye", "podcast", "konuşma", "cümle", "partner", "görsel", "dinle"];
      
      // Kart içindeki tüm alt elemanları tara (div, span, button, a)
      var potentialBtns = card.querySelectorAll("button, a, div, span, [role='button']");
      
      potentialBtns.forEach(function(btn){
        if (btn.children.length > 2) return; // Kapsayıcı ana kutuları atla
        var txt = (btn.textContent || "").toLowerCase().trim();
        
        if (!txt || txt === "zor" || txt === "normal" || txt === "kolay" || txt.indexOf("google") !== -1) return;
        if (btn.closest(".dh-nav-row") || btn.id === "dhToolsBox" || btn.classList.contains("dh-tools-title")) return;
        
        var isTool = toolTexts.some(function(t){ return txt.indexOf(t) !== -1; });
        if (isTool) {
          var clone = btn.cloneNode(true);
          if (btn.onclick) clone.onclick = btn.onclick;
          
          // Orijinal elemandaki tıklama olaylarını simüle et (Klonlarda kaybolma ihtimaline karşı)
          clone.addEventListener('click', function(e) {
            btn.click();
          });

          grid.appendChild(clone);
          btn.style.setProperty("display", "none", "important");
        }
      });
      
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
    }, 100);
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
      if(++n>10) clearInterval(t); 
    }, 300);
  }
  
  if(document.readyState!=="loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
