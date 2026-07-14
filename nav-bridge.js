/* nav-bridge.js — index-app.html (foto) ile videopractice.html (video) arasında
   köprü. Artık yönlendirme yok; video butonu aynı sayfada modal açıyor ve içine
   videopractice.html'yi iframe olarak yüklüyor. */
(function(){
  "use strict";
  if (window.__dhNavBridge) return;
  window.__dhNavBridge = true;

  // CSS ekle
  function addStyle(){
    var css = document.createElement("style");
    css.textContent = `
      .nb-video-btn{background:#4c1d95;border:1px solid #7c3aed;color:#fff;border-radius:10px;
        padding:8px 14px;font:800 13px Nunito,system-ui,sans-serif;cursor:pointer}
      .nb-video-btn:hover{background:#5b21b6}
      .nb-return-banner{position:fixed;left:12px;right:76px;bottom:12px;top:auto;z-index:9999;
        background:#0f172a;border:1px solid #7c3aed88;border-radius:14px;padding:12px 16px;
        color:#e2e8f0;font:600 13px Nunito,system-ui,sans-serif;display:flex;gap:10px;
        align-items:center;box-shadow:0 12px 34px rgba(0,0,0,.4)}
      .nb-return-banner b{color:#c4b5fd}
      .nb-return-x{margin-left:auto;background:transparent;border:0;color:#94a3b8;
        font-size:16px;cursor:pointer;padding:4px 8px}
      /* Modal */
      .nb-modal-overlay{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);
        display:flex;align-items:center;justify-content:center;padding:10px;backdrop-filter:blur(4px)}
      .nb-modal-box{width:100%;max-width:1100px;height:95vh;background:#0b1120;border-radius:22px;
        overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.6);border:1px solid #ffffff22;position:relative}
      .nb-modal-close{position:absolute;top:12px;right:16px;z-index:10;background:#000000aa;border:0;
        color:#fff;font-size:28px;width:44px;height:44px;border-radius:999px;cursor:pointer;
        display:flex;align-items:center;justify-content:center;transition:background .2s}
      .nb-modal-close:hover{background:#dc2626aa}
      .nb-modal-iframe{width:100%;height:100%;border:0;display:block}
    `;
    document.head.appendChild(css);
  }

  // Modal oluştur
  function createModal(iframeSrc){
    var overlay = document.createElement("div");
    overlay.className = "nb-modal-overlay";
    overlay.id = "nbModalOverlay";

    var box = document.createElement("div");
    box.className = "nb-modal-box";

    var closeBtn = document.createElement("button");
    closeBtn.className = "nb-modal-close";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label","Kapat");

    var iframe = document.createElement("iframe");
    iframe.className = "nb-modal-iframe";
    iframe.src = iframeSrc;
    iframe.allow = "microphone; autoplay; encrypted-media";
    iframe.allowFullscreen = true;

    box.appendChild(closeBtn);
    box.appendChild(iframe);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function closeModal(){
      if(overlay.parentNode) overlay.remove();
      window.removeEventListener("message", onMessage);
    }

    function onMessage(e){
      if(e.data && e.data.type === "closeVideoModal"){
        closeModal();
      }
    }
    window.addEventListener("message", onMessage);

    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", function(e){
      if(e.target === overlay) closeModal();
    });

    return { overlay, iframe, close: closeModal };
  }

  // Butonu mount et
  function mountVideoButton(retryCount){
    retryCount = retryCount || 0;
    var trio = document.getElementById("dhNavTrio");
    var existing = document.getElementById("nbVideoBtn");
    if (existing){
      if (trio && existing.previousElementSibling !== trio) {
        trio.insertAdjacentElement("afterend", existing);
      }
      return;
    }
    if (!trio) {
      if (retryCount < 5) {
        setTimeout(function(){ mountVideoButton(retryCount + 1); }, 300);
      }
      return;
    }
    var b = document.createElement("button");
    b.id = "nbVideoBtn";
    b.className = "nb-video-btn";
    b.textContent = "🎬 Video";
    b.onclick = function(){
      var card = document.querySelector(".card");
      var en = card && card.querySelector(".card-en");
      var text = en ? (en.textContent||"").trim() : "";
      var src = "./videopractice.html";
      if(text){
        src += "?q=" + encodeURIComponent(text);
      }
      createModal(src);
    };
    trio.insertAdjacentElement("afterend", b);
  }

  // Dönüş banner'ı (aynı)
  function showReturnBanner(){
    var raw;
    try{ raw = localStorage.getItem("dh-bridge-return"); }catch(e){ return; }
    if (!raw) return;
    var info;
    try{ info = JSON.parse(raw); }catch(e){ return; }
    if (!info || !info.en) return;
    if (Date.now() - (info.at||0) > 10*60*1000){
      try{ localStorage.removeItem("dh-bridge-return"); }catch(e){}
      return;
    }
    if (document.getElementById("nbReturnBanner")) return;

    var box = document.createElement("div");
    box.id = "nbReturnBanner";
    box.className = "nb-return-banner";
    box.innerHTML =
      '<span>📍 Videodan döndün — kaldığın cümle: <b></b>'
      + (info.module ? ' · '+esc2(info.module) : '') + '</span>'
      + '<button class="nb-return-x" id="nbReturnX">✕</button>';
    box.querySelector("b").textContent = info.en;
    document.body.appendChild(box);
    document.getElementById("nbReturnX").onclick = function(){
      box.remove();
      try{ localStorage.removeItem("dh-bridge-return"); }catch(e){}
    };
    setTimeout(function(){ if(box.parentNode) box.remove(); }, 15000);
  }
  function esc2(s){ return String(s).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  }); }

  function boot(){
    try{ addStyle(); }catch(e){}
    try{ showReturnBanner(); }catch(e){}
    try{
      new MutationObserver(function(){
        try{ mountVideoButton(); }catch(e){}
      }).observe(document.body, {childList:true, subtree:true});
      mountVideoButton();
    }catch(e){}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
