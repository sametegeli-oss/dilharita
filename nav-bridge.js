/* nav-bridge.js — index-app.html (foto) ile videopractice.html (video) arasında
   geçiş köprüsü. React'e (assets/app.js) HİÇ dokunmuyor; sadece DOM'u izleyip
   cümle metnini okuyor ve bir "🎬 Video" düğmesi ekliyor.

   YÖN 1 (foto -> video): TAM SENKRONİZE. Kartın .card-en metnini videopractice'e
   ?q=<cümle> ile yolluyoruz; orada bu metinle eşleşen cümle bulunup TAM O CÜMLEDE
   açılıyor (videopractice.html'deki boot() güncellemesi).

   YÖN 2 (video -> foto): ARTIK MODÜL OTOMATİK AÇILIYOR (metin eşleşmesi ile). */
(function(){
  "use strict";
  if (window.__dhNavBridge) return;
  window.__dhNavBridge = true;

  function addStyle(){
    var css = document.createElement("style");
    css.textContent = `
      .nb-video-btn{background:#4c1d95;border:1px solid #7c3aed;color:#fff;border-radius:10px;
        padding:8px 14px;font:800 13px Nunito,system-ui,sans-serif;cursor:pointer}
      .nb-video-btn:hover{background:#5b21b6}
      .nb-return-banner{position:fixed;left:12px;right:12px;top:12px;z-index:9999;
        background:#0f172a;border:1px solid #7c3aed88;border-radius:14px;padding:12px 16px;
        color:#e2e8f0;font:600 13px Nunito,system-ui,sans-serif;display:flex;gap:10px;
        align-items:center;box-shadow:0 12px 34px rgba(0,0,0,.4)}
      .nb-return-banner b{color:#c4b5fd}
      .nb-return-x{margin-left:auto;background:transparent;border:0;color:#94a3b8;
        font-size:16px;cursor:pointer;padding:4px 8px}
    `;
    document.head.appendChild(css);
  }

  /* ---- YÖN 1: foto -> video (tam senkronize) ---- */
  function mountVideoButton(){
    var trio = document.getElementById("dhNavTrio");
    var existing = document.getElementById("nbVideoBtn");
    if (existing){
      if (trio && existing.previousElementSibling !== trio) trio.insertAdjacentElement("afterend", existing);
      return;
    }
    if (!trio) return;
    var b = document.createElement("button");
    b.id = "nbVideoBtn"; b.className = "nb-video-btn";
    b.textContent = "🎬 Video";
    b.onclick = function(){
      var card = document.querySelector(".card");
      var en = card && card.querySelector(".card-en");
      var text = en ? (en.textContent||"").trim() : "";
      if (!text){ location.href = "./videopractice.html"; return; }
      location.href = "./videopractice.html?q=" + encodeURIComponent(text);
    };
    trio.insertAdjacentElement("afterend", b);
  }

  /* ---- YÖN 2: video -> foto dönüşü (modülü otomatik aç) ---- */
  function tryOpenModule(moduleName){
    if (!moduleName) return false;

    // Butonları bul: metin eşleşmesi ile
    function findModuleButton(){
      var btns = document.querySelectorAll('button, .mod-tile, [role="button"]');
      var normalizedTarget = moduleName.trim().toLowerCase();
      for (var i = 0; i < btns.length; i++) {
        var btn = btns[i];
        var text = (btn.textContent || '').trim().toLowerCase();
        // Buton metni normalizedTarget'i içeriyorsa ve buton tıklanabilir görünüyorsa
        if (text.includes(normalizedTarget)) {
          return btn;
        }
      }
      return null;
    }

    function clickModule(){
      var btn = findModuleButton();
      if (btn) {
        // Dispatch click event
        btn.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
        // Ayrıca click() dene
        try { btn.click(); } catch(e) {}
        return true;
      }
      return false;
    }

    // Önce hemen dene
    if (clickModule()) return true;

    // Yoksa DOM değişikliklerini izle
    var observer = new MutationObserver(function(mutations, obs){
      if (clickModule()) {
        obs.disconnect();
        return;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 10 saniye sonra zaman aşımı
    setTimeout(function(){
      observer.disconnect();
    }, 10000);

    return false;
  }

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

    // Modülü açmayı dene (biraz bekle)
    if (info.module) {
      setTimeout(function(){
        tryOpenModule(info.module);
        // Açıldıktan sonra localStorage bilgisini silelim
        try{ localStorage.removeItem("dh-bridge-return"); }catch(e){}
      }, 500);
    }
  }

  function esc2(s){ return String(s).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  }); }

  function boot(){
    try{ addStyle(); }catch(e){}
    try{ showReturnBanner(); }catch(e){}
    try{
      new MutationObserver(function(){ try{ mountVideoButton(); }catch(e){} })
        .observe(document.body, {childList:true, subtree:true});
      mountVideoButton();
    }catch(e){}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
