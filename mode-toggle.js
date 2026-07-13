/* mode-toggle.js — 📷 Resim / 🎬 Video seçici (v3)
   v2: nav-bridge ile observer döngüsü çözüldü (donma bitti).
   v3 YENİ: Video ekranına "← Önceki" butonu eklendi. videopractice'in
   global State / savePos / renderVideoCard fonksiyonlarına bağlanır;
   "Sıradaki →" butonunun yanında durur, ilk cümlede pasif olur. */
(function(){
  "use strict";
  if (window.__dhModeToggle) return;
  window.__dhModeToggle = true;

  var IS_VIDEO = /videopractice/i.test(location.pathname);
  var LS_KEY = "dh-practice-mode";

  function setPref(v){ try{ localStorage.setItem(LS_KEY, v); }catch(e){} }

  /* ---------- Stil ---------- */
  function addStyle(){
    var css = document.createElement("style");
    css.textContent = [
      ".dh-mode-toggle{display:inline-flex;align-items:center;gap:0;background:#0f172a;",
      "  border:1px solid #ffffff26;border-radius:999px;padding:3px;",
      "  box-shadow:0 8px 24px rgba(0,0,0,.35);font-family:Nunito,system-ui,sans-serif;",
      "  user-select:none;-webkit-user-select:none}",
      ".dh-mode-btn{border:0;background:transparent;color:#94a3b8;border-radius:999px;",
      "  padding:7px 14px;font:800 13px Nunito,system-ui,sans-serif;cursor:pointer;",
      "  transition:background .15s,color .15s;white-space:nowrap}",
      ".dh-mode-btn.active{background:#2563eb;color:#fff;cursor:default;",
      "  box-shadow:0 4px 14px rgba(37,99,235,.4)}",
      ".dh-mode-btn:not(.active):hover{color:#e2e8f0;background:#ffffff14}",
      ".dh-mode-toggle.on-photo{vertical-align:middle;margin:0 6px}",
      ".dh-mode-toggle.on-video{position:fixed;left:16px;top:126px;z-index:130}",
      /* Video ekranı: ← Önceki butonu (Sıradaki'nin solunda) */
      ".dh-prev-float{position:fixed;right:140px;top:72px;z-index:60;border:0;",
      "  border-radius:999px;background:#334155;color:#fff;font-weight:950;",
      "  padding:12px 16px;box-shadow:0 22px 70px rgba(0,0,0,.45);cursor:pointer;",
      "  font-family:Nunito,system-ui,sans-serif;font-size:15px;",
      "  touch-action:manipulation;-webkit-tap-highlight-color:transparent;",
      "  user-select:none;min-height:48px;min-width:112px}",
      ".dh-prev-float:active{transform:scale(.97)}",
      ".dh-prev-float[disabled]{opacity:.35;cursor:default;pointer-events:none}",
      "@media(max-width:640px){",
      "  .dh-mode-toggle.on-video{top:auto;left:12px;",
      "    bottom:calc(178px + env(safe-area-inset-bottom))}",
      "  .dh-prev-float{top:auto;right:12px;",
      "    bottom:calc(184px + env(safe-area-inset-bottom))}", /* Sıradaki'nin üstünde */
      "}",
      /* Eski tekil butonları görsel olarak gizle — işlev toggle'da */
      "#nbVideoBtn{display:none !important}",
      ".photo-float{display:none !important}"
    ].join("\n");
    document.head.appendChild(css);
  }

  /* ---------- Geçiş fonksiyonları ---------- */
  function goVideo(){
    setPref("video");
    var nb = document.getElementById("nbVideoBtn");
    if (nb){ nb.click(); return; } // nav-bridge modalı: cümle senkronu hazır
    var card = document.querySelector(".card");
    var en = card && card.querySelector(".card-en");
    var text = en ? (en.textContent || "").trim() : "";
    var src = "./videopractice.html";
    if (text) src += "?q=" + encodeURIComponent(text);
    location.href = src;
  }

  function goPhoto(){
    setPref("photo");
    var pb = document.getElementById("photoBackBtn");
    if (pb){ pb.click(); return; } // kaldığın cümleyi kaydeder + modalı kapatır
    if (window.parent !== window){
      try{ parent.postMessage({ type: "closeVideoModal" }, "*"); return; }catch(e){}
    }
    location.href = "./index-app.html";
  }

  /* ---------- Toggle oluşturma ---------- */
  function buildToggle(){
    var wrap = document.createElement("div");
    wrap.id = "dhModeToggle";
    wrap.className = "dh-mode-toggle " + (IS_VIDEO ? "on-video" : "on-photo");

    var bPhoto = document.createElement("button");
    bPhoto.type = "button";
    bPhoto.className = "dh-mode-btn" + (IS_VIDEO ? "" : " active");
    bPhoto.textContent = "📷 Resim";
    bPhoto.onclick = function(){ if (IS_VIDEO) goPhoto(); };

    var bVideo = document.createElement("button");
    bVideo.type = "button";
    bVideo.className = "dh-mode-btn" + (IS_VIDEO ? " active" : "");
    bVideo.textContent = "🎬 Video";
    bVideo.onclick = function(){ if (!IS_VIDEO) goVideo(); };

    wrap.appendChild(bPhoto);
    wrap.appendChild(bVideo);
    return wrap;
  }

  /* ---------- VIDEO: ← Önceki butonu ---------- */
  var _prevLock = false;
  async function goPrevCard(){
    if (_prevLock) return;
    _prevLock = true;
    try{
      // uiNextCard'daki temizlik adımlarının aynısı (hepsi global, varsa çağır)
      try{ clearUiTimers(); }catch(e){}
      try{ hideFeedback(); }catch(e){}
      try{ clearVideoStatus(); }catch(e){}
      try{ speechSynthesis.cancel(); }catch(e){}
      try{ clearTeachTimers(); clearVisemeTimers(); setAvatarSpeaking(false); }catch(e){}
      try{ closeDictPop(); }catch(e){}
      try{
        State.manualStop = true;
        if (State.voiceRec){ State.voiceRec.abort ? State.voiceRec.abort() : State.voiceRec.stop(); }
      }catch(e){}
      try{ stopOwnVoiceRecording(true); }catch(e){}
      try{ State.listening = false; }catch(e){}

      if (typeof State === "undefined" || State.idx <= 0) return;
      State.idx--;
      try{ await savePos(); }catch(e){}
      renderVideoCard();
    } finally {
      setTimeout(function(){ _prevLock = false; }, 350);
    }
  }

  function ensurePrevBtn(){
    var nextBtn = document.getElementById("nextBtn");
    var prev = document.getElementById("dhPrevBtn");
    if (!nextBtn){
      // Modül seçme / bitiş ekranı: butonu gizle
      if (prev) prev.style.display = "none";
      return;
    }
    if (!prev){
      prev = document.createElement("button");
      prev.id = "dhPrevBtn";
      prev.type = "button";
      prev.className = "dh-prev-float";
      prev.textContent = "← Önceki";
      prev.onclick = goPrevCard;
      document.body.appendChild(prev); // body'de → render'lar silemez
    }
    prev.style.display = "";
    var canGoBack = false;
    try{ canGoBack = State.idx > 0; }catch(e){}
    prev.disabled = !canGoBack;
  }

  /* ---------- Mount ----------
     KRİTİK KURAL: öğe DOM'da duruyorsa yeniden KONUMLANDIRMA yok
     (v1'deki donmanın sebebi buydu). Sadece silinmişse eklenir. */
  function mountPhoto(){
    if (document.getElementById("dhModeToggle")) return;
    var anchor = document.getElementById("nbVideoBtn") ||
                 document.getElementById("dhNavTrio");
    if (!anchor) return; // observer tekrar deneyecek
    anchor.insertAdjacentElement("afterend", buildToggle());
  }

  function mountVideo(){
    if (!document.getElementById("dhModeToggle")){
      document.body.appendChild(buildToggle());
    }
    ensurePrevBtn();
  }

  function boot(){
    try{ addStyle(); }catch(e){}
    if (IS_VIDEO){
      mountVideo();
      // Her kartta root.innerHTML yenileniyor → prev butonunun
      // durumunu (görünür/pasif) observer ile taze tut
      try{
        new MutationObserver(function(){
          try{ mountVideo(); }catch(e){}
        }).observe(document.body, { childList:true, subtree:true });
      }catch(e){
        setInterval(mountVideo, 1500);
      }
    } else {
      try{
        new MutationObserver(function(){
          try{ mountPhoto(); }catch(e){}
        }).observe(document.body, { childList:true, subtree:true });
        mountPhoto();
      }catch(e){}
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
