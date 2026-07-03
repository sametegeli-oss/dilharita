/* index-app-layout.js — DÜZEN TOPARLAYICI (v6 — mobil yatay viewport optimize)
   1) İleri/geri (.study-nav) → altta SABİT çubuk
   2) "🛠 Araçlar" butonu → Önceki ile Sonraki ARASINA (alt çubukta)
   3) Zor/Normal/Kolay → cümlenin Türkçesinin (.card-tr) ALTINA
   4) Detay + Zayıf Analiz + Öğretmen + 9'lu ızgara → Araçlar panelinde (alttan açılır)
   5) Mobil yatayda viewport'a göre dinamik boyutlandırma
*/
(function(){
  "use strict";
  var STYLE_ID="dh-ia-layout-css";
  var applying=false, scheduled=false;
  var viewportHeight = window.innerHeight;

  function updateViewportHeight() {
    viewportHeight = window.innerHeight;
    // visualViewport varsa onu kullan (daha doğru)
    if (window.visualViewport) {
      viewportHeight = window.visualViewport.height;
    }
    return viewportHeight;
  }

  function addStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var s=document.createElement("style"); s.id=STYLE_ID;
    
    // Dinamik viewport yüksekliğine göre hesaplanan stiller
    var vh = updateViewportHeight();
    var navHeight = Math.min(60, Math.max(44, vh * 0.09)); // Alt nav %9 veya 44-60px
    var toolsHeight = Math.min(220, Math.max(140, vh * 0.35)); // Araçlar paneli %35 veya 140-220px
    var cardMaxHeight = vh - navHeight - 8; // Kart için kalan alan
    
    s.textContent =
    "body{padding-bottom:" + (navHeight + 6) + "px !important}"
    +".legend,.legend-item,.legend-dot{display:none !important}"
    +".study-nav .legend,.study-nav .legend-item{display:none !important}"
    
    /* ---- 2 SÜTUN DÜZEN (practice.html tarzı) ---- */
    +".dh-col-left,.dh-col-right{display:block}"
    
    /* Büyük ekranlar (masaüstü) - ORİJİNAL */
    +"@media (orientation:landscape),(min-width:680px){"
    +".card.dh-split{display:grid !important;grid-template-columns:1.5fr .9fr;gap:14px 16px;align-items:start}"
    +".card.dh-split>*{grid-column:1;min-width:0}"
    +".card.dh-split>.dh-col-right{grid-column:2;grid-row:1/99;display:flex;flex-direction:column;gap:6px;align-self:start}"
    +".card.dh-split .sm-img-wrap{margin:6px 0}"
    +".card.dh-split .dh-grade-under{flex-direction:column !important;gap:6px !important;margin:0}"
    +".card.dh-split .dh-grade-under button{min-height:34px !important;padding:7px 8px !important;font-size:13px !important;border-radius:9px !important}"
    +".card.dh-split .card-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}"
    +".card.dh-split .card-actions button{min-height:32px !important;padding:6px 10px !important;font-size:12px !important;border-radius:9px !important}"
    +"}"
    
    /* ---- MOBİL YATAY (LANDSCAPE) ÖZEL - DİNAMİK VIEWPORT ---- */
    +"@media (orientation:landscape) and (max-height:500px){"
    +"body{padding-bottom:" + (navHeight + 4) + "px !important;overflow:hidden}"
    +"html,body{height:100%;overflow:hidden}"
    +".app-container,.app-content,.main-container{height:100%;overflow:hidden}"
    /* Kartı viewport'a göre boyutlandır */
    +".card.dh-split{grid-template-columns:1.2fr 1fr !important;gap:4px 8px !important;padding:4px 8px !important;max-height:" + cardMaxHeight + "px !important;height:" + cardMaxHeight + "px !important;overflow-y:auto}"
    +".card.dh-split .sm-img-wrap{margin:1px 0;max-height:" + (cardMaxHeight * 0.2) + "px}"
    +".card.dh-split .sm-img-wrap img{max-height:" + (cardMaxHeight * 0.2) + "px;width:auto;object-fit:contain}"
    +".card.dh-split .card-en{font-size:" + Math.max(11, Math.min(14, vh * 0.028)) + "px !important;line-height:1.15;margin:1px 0}"
    +".card.dh-split .card-tr{font-size:" + Math.max(10, Math.min(13, vh * 0.026)) + "px !important;line-height:1.15;margin:1px 0}"
    +".card.dh-split .card-pron{font-size:" + Math.max(9, Math.min(12, vh * 0.024)) + "px !important;margin:0}"
    +".card.dh-split .dh-grade-under{flex-direction:row !important;gap:2px !important;margin:1px 0}"
    +".card.dh-split .dh-grade-under button{min-height:" + Math.max(18, Math.min(28, vh * 0.05)) + "px !important;padding:2px 4px !important;font-size:" + Math.max(8, Math.min(11, vh * 0.022)) + "px !important;border-radius:4px !important;flex:1}"
    +".card.dh-split .card-actions{gap:2px;margin-top:1px}"
    +".card.dh-split .card-actions button{min-height:" + Math.max(18, Math.min(28, vh * 0.05)) + "px !important;padding:2px 4px !important;font-size:" + Math.max(7, Math.min(10, vh * 0.02)) + "px !important;border-radius:4px !important;flex:1 0 auto}"
    +".card.dh-split .dh-gtr-btn{padding:2px 6px !important;font-size:" + Math.max(8, Math.min(10, vh * 0.02)) + "px !important;margin:1px 0}"
    +".card.dh-split .dh-col-right{gap:2px !important}"
    +".dh-gtr-btn{font-size:" + Math.max(8, Math.min(10, vh * 0.02)) + "px !important;padding:2px 6px !important;margin:1px 0}"
    /* Alt nav çubuğu - dinamik */
    +".study-nav.dh-fixed-nav{padding:3px 4px calc(3px + env(safe-area-inset-bottom)) !important;gap:3px !important;height:" + navHeight + "px !important;min-height:" + navHeight + "px !important}"
    +".study-nav.dh-fixed-nav .btn{min-height:" + (navHeight - 8) + "px !important;font-size:" + Math.max(9, Math.min(12, vh * 0.024)) + "px !important;padding:2px 4px !important;border-radius:8px !important}"
    +".dh-tools-toggle{min-height:" + (navHeight - 8) + "px !important;padding:0 8px !important;font-size:" + Math.max(9, Math.min(11, vh * 0.022)) + "px !important;border-radius:8px !important}"
    /* Araçlar paneli - dinamik */
    +".dh-tools-box{max-height:" + toolsHeight + "px !important;bottom:" + (navHeight + 2) + "px !important;padding:4px 8px !important;gap:3px !important}"
    +".dh-tools-box .dh-moved-btn{min-height:" + Math.max(20, Math.min(32, vh * 0.06)) + "px !important;font-size:" + Math.max(8, Math.min(10, vh * 0.02)) + "px !important;padding:2px 6px !important;border-radius:6px !important}"
    +".dh-tools-box .wd-tools-row{grid-template-columns:repeat(3,1fr) !important;gap:2px !important}"
    +".dh-tools-box .wd-tools-row button{min-height:" + Math.max(18, Math.min(28, vh * 0.055)) + "px !important;font-size:" + Math.max(7, Math.min(9, vh * 0.018)) + "px !important;padding:1px 3px !important;border-radius:4px !important}"
    +".dh-tools-title{font-size:" + Math.max(8, Math.min(10, vh * 0.02)) + "px !important;margin-bottom:1px}"
    +".dh-tools-box .dh-tools-title{font-size:" + Math.max(8, Math.min(10, vh * 0.02)) + "px !important}"
    /* Scroll bar'ı gizle/göster */
    +".card.dh-split::-webkit-scrollbar{width:2px}"
    +".card.dh-split::-webkit-scrollbar-track{background:transparent}"
    +".card.dh-split::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2);border-radius:2px}"
    +"}"
    
    /* ---- MOBİL PORTRE (DİKEY) ---- */
    +"@media (orientation:portrait) and (max-width:680px){"
    +".card.dh-split{display:flex !important;flex-direction:column;gap:8px}"
    +".card.dh-split .dh-col-right{width:100%}"
    +".card.dh-split .dh-grade-under{flex-direction:row !important;gap:6px}"
    +".card.dh-split .dh-grade-under button{min-height:38px !important;font-size:13px !important}"
    +"}"
    
    /* ALT NAV - SABİT (ORİJİNAL) */
    +".study-nav.dh-fixed-nav{position:fixed !important;left:0;right:0;bottom:0;z-index:9000;display:flex !important;gap:8px;align-items:center;justify-content:space-between;margin:0 !important;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(9,15,28,.96);backdrop-filter:blur(10px);border-top:1px solid rgba(255,255,255,.10);box-shadow:0 -8px 30px rgba(0,0,0,.4)}"
    +".study-nav.dh-fixed-nav .btn{flex:1;min-height:48px;font-size:15px !important;font-weight:800 !important;border-radius:14px !important}"
    +".study-nav.dh-fixed-nav > *:not(.btn):not(.dh-tools-toggle){flex:0 0 auto}"
    
    /* Araçlar butonu */
    +".dh-tools-toggle{flex:0 0 auto !important;min-height:48px;padding:0 16px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:#17233a;color:#eaf2ff;font:900 14px Nunito,system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}"
    +".dh-tools-toggle:hover{background:#22304f}"
    +".dh-tools-toggle .chev{transition:transform .2s;font-size:11px}"
    +".dh-tools-toggle.open .chev{transform:rotate(180deg)}"
    
    /* Zorluk butonları */
    +".dh-grade-under{display:flex !important;gap:8px;margin:10px 0 4px}"
    +".dh-gtr-btn{display:inline-flex;align-items:center;gap:6px;margin:8px 0 2px;padding:8px 14px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:#1a2942;color:#cfe0ff;font:800 13px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-gtr-btn:hover{background:#22344f}"
    +".dh-grade-under button{flex:1;min-height:44px;border-radius:12px;font-weight:800;font-size:14px;border:1px solid rgba(255,255,255,.14);cursor:pointer}"
    
    /* Araçlar paneli */
    +".dh-tools-box{position:fixed;left:0;right:0;bottom:70px;z-index:8999;margin:0;padding:14px;max-height:60vh;overflow-y:auto;border-radius:18px 18px 0 0;background:#0d1a30;border-top:1px solid rgba(255,255,255,.12);box-shadow:0 -10px 40px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:10px;animation:dhToolsUp .2s ease}"
    +"@keyframes dhToolsUp{from{transform:translateY(20px);opacity:.4}to{transform:none;opacity:1}}"
    +".dh-tools-box.dh-hidden{display:none !important}"
    +".dh-tools-box .dh-moved-btn{width:100%;min-height:46px;border-radius:12px}"
    +".dh-tools-box .wd-tools-row{margin-top:0 !important;display:grid;grid-template-columns:repeat(3,1fr);gap:6px}"
    +".dh-tools-box .wd-tools-row button{min-height:40px;border-radius:10px;font-size:12px;font-weight:700;padding:4px 8px}"
    +".dh-tools-title{font:900 13px Nunito,system-ui,sans-serif;color:#9fb3d9;text-align:center;margin-bottom:2px}";
    
    document.head.appendChild(s);
  }
  
  // Viewport değişikliklerini dinle
  function setupViewportListener() {
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function() {
        updateViewportHeight();
        // CSS'i yeniden oluştur
        var oldStyle = document.getElementById(STYLE_ID);
        if (oldStyle) oldStyle.remove();
        addStyle();
        apply();
      });
    }
    
    // Pencere yeniden boyutlandığında da güncelle
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
    if(!enEl){ console.log("[dh-split] card-en yok"); return; }
    var grade=card.querySelector(".dh-grade-under");
    var actions=card.querySelector(".card-actions");
    if(!grade || !actions){ console.log("[dh-split] hazır değil — grade:", !!grade, "actions:", !!actions); return; }
    console.log("[dh-split] BÖLÜNÜYOR ✓");

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

  function fixNav(){
    var nav=document.querySelector(".study-nav");
    if(nav && !nav.classList.contains("dh-fixed-nav")) nav.classList.add("dh-fixed-nav");
    return nav;
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
            n.textContent="📋 Cümle kopyalandı — Translate'te yapıştır";
            n.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#0f1f3a;color:#fff;border:1px solid #2563eb;padding:12px 18px;border-radius:12px;font:700 13px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:90vw;text-align:center";
            document.body.appendChild(n);
            setTimeout(function(){ 
              n.style.transition="opacity .4s"; 
              n.style.opacity="0"; 
              setTimeout(function(){ n.remove(); },400); 
            },3000);
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
  
  function ensureTools(card, nav){
    var box=document.getElementById("dhToolsBox");
    var toggle=document.getElementById("dhToolsToggle");
    
    if(!box){
      box=document.createElement("div");
      box.id="dhToolsBox"; 
      box.className="dh-tools-box dh-hidden";
      box.innerHTML='<div class="dh-tools-title">🛠 Araçlar</div>';
      document.body.appendChild(box);
    }
    
    if(!toggle){
      toggle=document.createElement("button");
      toggle.id="dhToolsToggle"; 
      toggle.type="button"; 
      toggle.className="dh-tools-toggle";
      toggle.innerHTML='🛠 <span class="chev">▾</span>';
      toggle.onclick=function(){
        var hid=box.classList.toggle("dh-hidden");
        toggle.classList.toggle("open", !hid);
      };
    }
    
    if(nav && toggle.parentElement!==nav){
      var btns=[].slice.call(nav.querySelectorAll(".btn"));
      if(btns.length>=2){ 
        nav.insertBefore(toggle, btns[btns.length-1]); 
      }
      else nav.appendChild(toggle);
    }
    
    if(card && card.dataset.dhToolsFilled!=="1"){
      var teacher=card.querySelector(".teacher-btn")||btnByText(card,"öğretmen");
      if(teacher && !/sor/i.test(teacher.textContent||"")){ 
        teacher.classList.add("dh-moved-btn"); 
        box.appendChild(teacher); 
      }
      
      var teacherAsk=[].slice.call(card.querySelectorAll("button,a")).find(function(b){
        return /öğretmene sor/i.test(b.textContent||"");
      });
      if(teacherAsk){ 
        teacherAsk.style.display=""; 
        teacherAsk.classList.add("dh-moved-btn"); 
        box.appendChild(teacherAsk); 
      }
      
      var detay=btnByText(card,"detay");
      if(detay){ 
        detay.classList.add("dh-moved-btn"); 
        box.appendChild(detay); 
      }
      
      var weak=card.querySelector(".extra-weak")||btnByText(card,"zayıf");
      if(weak){ 
        weak.classList.add("dh-moved-btn"); 
        box.appendChild(weak); 
      }
      card.dataset.dhToolsFilled="1";
    }
    
    var grid=document.querySelector(".wd-tools-row");
    if(grid && grid.parentElement!==box){ 
      box.appendChild(grid); 
    }
  }
  
  function apply(){
    if(applying) return;
    applying=true;
    try{
      // Viewport'u güncelle
      updateViewportHeight();
      
      addStyle();
      var nav=fixNav();
      var card=currentCard();
      if(card){ 
        moveGrade(card); 
      }
      ensureTools(card, nav);
      if(card){ 
        splitCard(card); 
      }
    }catch(e){}
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
