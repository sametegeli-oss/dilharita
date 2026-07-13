(function(){
  "use strict";
  if (window.__dhNavBridge) return;
  window.__dhNavBridge = true;

  function addStyle(){
    var css = document.createElement("style");
    css.textContent = `
      .nb-video-btn {
        background: #4c1d95; border: 1px solid #7c3aed; color: #fff; border-radius: 10px;
        padding: 8px 14px; font: 800 13px Nunito,system-ui,sans-serif; cursor: pointer;
        margin-left: 8px; display: inline-flex; align-items: center;
      }
      .nb-video-btn:hover { background: #5b21b6 }
      .nb-return-banner {
        position: fixed; left: 12px; right: 12px; top: 12px; z-index: 9999;
        background: #0f172a; border: 1px solid #7c3aed88; border-radius: 14px; padding: 12px 16px;
        color: #e2e8f0; font: 600 13px Nunito,system-ui,sans-serif; display: flex; gap: 10px;
        align-items: center; box-shadow: 0 12px 34px rgba(0,0,0,.4)
      }
      .nb-return-banner b { color: #c4b5fd }
      .nb-return-x { margin-left: auto; background: transparent; border: 0; color: #94a3b8; font-size: 16px; cursor: pointer; padding: 4px 8px }
    `;
    document.head.appendChild(css);
  }

  /* ---- YÖN 1: foto -> video (React DOM'a uygun Entegrasyon) ---- */
  function mountVideoButton(){
    // React'in buton barını (.card-actions) hedef alıyoruz
    var actionsBar = document.querySelector(".card-actions");
    var existing = document.getElementById("nbVideoBtn");
    
    if (existing) {
      if (actionsBar && existing.parentNode !== actionsBar) {
        actionsBar.appendChild(existing);
      }
      return;
    }
    
    if (!actionsBar) return; // Kart henüz render edilmediyse bekle
    
    var b = document.createElement("button");
    b.id = "nbVideoBtn"; 
    b.className = "nb-video-btn";
    b.textContent = "🎬 Video Practice";
    
    b.onclick = function(){
      var card = document.querySelector(".card");
      var en = card && card.querySelector(".card-en");
      var text = en ? (en.textContent || "").trim() : "";
      
      if (!text) { 
        location.href = "./videopractice.html"; 
        return; 
      }
      // videopractice.html?q=... şeklinde tam senkron gönderim
      location.href = "./videopractice.html?q=" + encodeURIComponent(text);
    };
    
    // "Detay" veya "Dinle" butonlarının yanına ekler
    actionsBar.appendChild(b);
  }

  /* ---- YÖN 2: video -> foto dönüşü ---- */
  function showReturnBanner(){
    var raw;
    try { raw = localStorage.getItem("dh-bridge-return"); } catch(e) { return; }
    if (!raw) return;
    var info;
    try { info = JSON.parse(raw); } catch(e) { return; }
    if (!info || !info.en) return;
    
    if (Date.now() - (info.at || 0) > 10*60*1000){
      try { localStorage.removeItem("dh-bridge-return"); } catch(e){}
      return;
    }
    if (document.getElementById("nbReturnBanner")) return;

    var box = document.createElement("div");
    box.id = "nbReturnBanner";
    box.className = "nb-return-banner";
    box.innerHTML =
      '<span>📍 Videodan döndün — kaldığın cümle: <b></b>'
      + (info.module ? ' · ' + esc2(info.module) : '') + '</span>'
      + '<button class="nb-return-x" id="nbReturnX">✕</button>';
    box.querySelector("b").textContent = info.en;
    document.body.appendChild(box);
    
    document.getElementById("nbReturnX").onclick = function(){
      box.remove();
      try { localStorage.removeItem("dh-bridge-return"); } catch(e){}
    };
    setTimeout(function(){ if(box.parentNode) box.remove(); }, 15000);
  }
  
  function esc2(s){ 
    return String(s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    }); 
  }

  function boot(){
    try { addStyle(); } catch(e){}
    try { showReturnBanner(); } catch(e){}
    try {
      // DOM değişikliklerini izleyip kart geldikçe butonu basıyoruz
      new MutationObserver(function(){ try { mountVideoButton(); } catch(e){} })
        .observe(document.body, {childList: true, subtree: true});
      mountVideoButton();
    } catch(e){}
  }
  
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
