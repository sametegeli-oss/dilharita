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
      .nb-sync-overlay{position:fixed;inset:0;background:#0b1120;z-index:100000;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        color:#fff;font:700 16px Nunito,sans-serif;gap:12px}
      .nb-spinner{width:30px;height:30px;border:3px solid #ffffff24;border-top-color:#7c3aed;
        border-radius:50%;animation:nbspin .6s linear infinite}
      @keyframes nbspin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(css);
  }

  /* ---- FOTO -> VİDEO GEÇİŞİ ---- */
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

  /* ---- VİDEO -> FOTO TAM SENKRONİZASYON (React DOM Otomasyonu) ---- */
  var syncAttempts = 0;
  function trySyncReactState() {
    var raw;
    try { raw = localStorage.getItem("dh-bridge-return"); } catch(e) { return; }
    if (!raw) return;
    
    var info;
    try { info = JSON.parse(raw); } catch(e) { return; }
    if (!info || !info.en) return;
    
    // 5 dakikadan eskiyse senkronize etme
    if (Date.now() - (info.at||0) > 5*60*1000) {
      try { localStorage.removeItem("dh-bridge-return"); } catch(e){}
      return;
    }

    // Kullanıcıya yükleniyor ekranı göster (Arka plandaki zıplamaları görmesin)
    var overlay = document.getElementById("nbSyncOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "nbSyncOverlay";
      overlay.className = "nb-sync-overlay";
      overlay.innerHTML = '<div class="nb-spinner"></div><div>Kaldığınız cümle senkronize ediliyor...</div>';
      document.body.appendChild(overlay);
    }

    var cardEnEl = document.querySelector(".card-en");
    if (!cardEnEl) {
      // React henüz yüklenmediyse veya modül seçilmediyse beklemeye devam et
      syncAttempts++;
      if (syncAttempts > 40) { // 4 saniye zaman aşımı
        if (overlay) overlay.remove();
        return;
      }
      setTimeout(trySyncReactState, 100);
      return;
    }

    var currentEn = cardEnEl.textContent.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    var targetEn = info.en.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

    if (currentEn === targetEn) {
      // Tam eşleşme sağlandı! Başarı çizgisi.
      if (overlay) overlay.remove();
      try { localStorage.removeItem("dh-bridge-return"); } catch(e){}
    } else {
      // Eşleşme yoksa React uygulamasının "Sıradaki / İleri" butonunu bulup simüle tıkla
      // Projenizdeki ileri butonunun sınıfını veya id'sini (örn: .next-btn veya #nextBtn) buraya yazın.
      // Genel bir yaklaşım olarak "Sıradaki" veya "İleri" içeren butonları arayalım:
      var nextBtn = Array.from(document.querySelectorAll("button")).find(function(btn) {
        var text = (btn.textContent || "").toLowerCase();
        return text.includes("sonraki") || text.includes("ileri") || text.includes("→");
      });

      if (nextBtn) {
        nextBtn.click();
        // Bir sonraki karta geçişi beklemek için kısa bir döngü
        setTimeout(trySyncReactState, 80);
      } else {
        // İleri butonu bulunamadıysa işlemi sonlandır
        if (overlay) overlay.remove();
      }
    }
  }

  function boot(){
    try{ addStyle(); }catch(e){}
    try{
      new MutationObserver(function(){ try{ mountVideoButton(); }catch(e){} })
        .observe(document.body, {childList:true, subtree:true});
      mountVideoButton();
    }catch(e){}
    
    // Video sayfasından dönüş kontrolünü tetikle
    try { trySyncReactState(); } catch(e){}
  }
  
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
