/* mode-toggle.js — 📷 Resim / 🎬 Video seçici (v4)
   v2: nav-bridge observer döngüsü çözüldü (donma bitti).
   v3: Video ekranına "← Önceki" butonu eklendi.
   v4 YENİ: CÜMLE SENKRONU — video ekranında ileri/geri gidildikçe alttaki
   foto ekranı (index-app) da aynı cümleye adım adım taşınır:
   - Video her cümle değişiminde parent'a {dhVideoStep, delta} mesajı yollar.
   - Foto tarafı dhNavTrio'daki Önceki/Sonraki proxy butonlarına delta kadar
     tıklar (React'e dokunmadan).
   - Modal kapanırken metin doğrulaması yapılır; kayma olduysa cümle metnine
     göre ileri/geri taranıp yakalanır. */
(function(){
  "use strict";
  if (window.__dhModeToggle) return;
  window.__dhModeToggle = true;

  var IS_VIDEO = /videopractice/i.test(location.pathname);
  var LS_KEY = "dh-practice-mode";

  function setPref(v){ try{ localStorage.setItem(LS_KEY, v); }catch(e){} }
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function norm(s){
    return String(s||"").toLowerCase().replace(/[^a-z0-9ğüşöçıi]+/g," ").trim();
  }

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
      /* SAĞ YIĞIN DÜZELTMESİ: koç avatarı sağ altta 78-132px arasını kaplıyor;",
         Sıradaki butonu 126'dan başlayınca üstüne biniyordu. Yeni istif:",
         avatar 78-132 → Sıradaki 140-188 → Önceki 196-244 (tr-panel 300'de, temas yok) */
      "  .next-float{top:auto!important;right:12px!important;",
      "    bottom:calc(140px + env(safe-area-inset-bottom))!important}",
      "  .dh-prev-float{top:auto;right:12px;",
      "    bottom:calc(196px + env(safe-area-inset-bottom))}",
      "}",
      "#nbVideoBtn{display:none !important}",
      ".photo-float{display:none !important}"
    ].join("\n");
    document.head.appendChild(css);
  }

  /* ---------- Geçiş fonksiyonları ---------- */
  function goVideo(){
    setPref("video");
    var nb = document.getElementById("nbVideoBtn");
    if (nb){ nb.click(); return; }
    var card = document.querySelector(".card");
    var en = card && card.querySelector(".card-en");
    var text = en ? (en.textContent || "").trim() : "";
    var src = "./videopractice.html";
    if (text) src += "?q=" + encodeURIComponent(text);
    location.href = src;
  }

  function goPhoto(){
    setPref("photo");
    // Kapanmadan önce son cümleyi parent'a bildir (doğrulama için)
    try{
      if (window.parent !== window && typeof State !== "undefined"){
        var s = State.queue && State.queue[State.idx];
        if (s && s.en) parent.postMessage({ type:"dhVideoAt", en:s.en }, "*");
      }
    }catch(e){}
    var pb = document.getElementById("photoBackBtn");
    if (pb){ pb.click(); return; }
    if (window.parent !== window){
      try{ parent.postMessage({ type: "closeVideoModal" }, "*"); return; }catch(e){}
    }
    location.href = "./index-app.html";
  }

  /* ---------- Toggle ---------- */
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

  /* ================================================================
     VIDEO TARAFI
     ================================================================ */
  var _prevLock = false;
  async function goPrevCard(){
    if (_prevLock) return;
    _prevLock = true;
    try{
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
      document.body.appendChild(prev);
    }
    prev.style.display = "";
    var canGoBack = false;
    try{ canGoBack = State.idx > 0; }catch(e){}
    prev.disabled = !canGoBack;
  }

  /* Cümle değişimini izle → parent'a adım mesajı yolla */
  var _syncIdx = null;
  function syncTick(){
    try{
      if (window.parent === window) return;                 // modal içinde değiliz
      if (typeof State === "undefined") return;
      if (!State.queue || !State.queue.length) return;
      if (State.idx < 0 || State.idx >= State.queue.length) return;
      if (_syncIdx === null){ _syncIdx = State.idx; return; } // başlangıç: ?q= ile zaten eşit
      if (State.idx !== _syncIdx){
        var delta = State.idx - _syncIdx;
        _syncIdx = State.idx;
        var s = State.queue[State.idx];
        parent.postMessage({ type:"dhVideoStep", delta:delta, en:(s&&s.en)||"" }, "*");
      }
    }catch(e){}
  }

  /* ================================================================
     FOTO TARAFI — gelen adımları React'in Önceki/Sonraki proxy
     butonlarına uygular (#dhNavTrio, index-app-layout.js kuruyor)
     ================================================================ */
  var _pending = 0, _stepping = false, _lastVideoEn = "";

  function cardEnText(){
    var el = document.querySelector(".card .card-en");
    return el ? (el.textContent || "").trim() : "";
  }
  function clickNav(dir){
    var sel = dir > 0 ? ".dh-nav-next" : ".dh-nav-prev";
    var b = document.querySelector("#dhNavTrio " + sel);
    if (b && !b.disabled){ b.click(); return true; }
    return false;
  }
  async function drainSteps(){
    if (_stepping) return;
    _stepping = true;
    try{
      var guard = 0;
      while (_pending !== 0 && guard++ < 400){
        var dir = _pending > 0 ? 1 : -1;
        if (!clickNav(dir)) break;   // kuyruk sonu/başı: bekleyeni bırak
        _pending -= dir;
        await wait(230);             // React'in kartı çizmesine süre tanı
      }
    } finally { _stepping = false; }
  }
  /* Modal kapandıktan sonra: metin eşleşiyor mu? Kayma varsa tara-yakala */
  async function verifyAlign(){
    var i;
    // Önce bekleyen adımlar bitsin
    for (i = 0; i < 40 && (_stepping || _pending !== 0); i++){
      await drainSteps(); await wait(150);
    }
    if (!_lastVideoEn) return;
    var target = norm(_lastVideoEn);
    if (norm(cardEnText()) === target) return;   // zaten senkron
    // İleri tara (en fazla 30 adım)
    for (i = 0; i < 30; i++){
      if (!clickNav(1)) break;
      await wait(230);
      if (norm(cardEnText()) === target) return;
    }
    // Bulunamadı: geri tara (gittiğin + 30 adım)
    var back = i + 30;
    for (var j = 0; j < back; j++){
      if (!clickNav(-1)) return;
      await wait(230);
      if (norm(cardEnText()) === target) return;
    }
  }

  function listenPhotoSync(){
    window.addEventListener("message", function(e){
      var d = e.data || {};
      if (d.type === "dhVideoStep"){
        _pending += (d.delta | 0);
        if (d.en) _lastVideoEn = d.en;
        drainSteps();
      } else if (d.type === "dhVideoAt"){
        if (d.en) _lastVideoEn = d.en;
      } else if (d.type === "closeVideoModal"){
        // nav-bridge modalı kapatır; biz de hizayı doğrularız
        setTimeout(function(){ verifyAlign(); }, 450);
      }
    });
  }

  /* ---------- Mount ----------
     KRİTİK KURAL: öğe DOM'da duruyorsa yeniden KONUMLANDIRMA yok. */
  function mountPhoto(){
    if (document.getElementById("dhModeToggle")) return;
    var anchor = document.getElementById("nbVideoBtn") ||
                 document.getElementById("dhNavTrio");
    if (!anchor) return;
    anchor.insertAdjacentElement("afterend", buildToggle());
  }

  function mountVideo(){
    if (!document.getElementById("dhModeToggle")){
      document.body.appendChild(buildToggle());
    }
    ensurePrevBtn();
    syncTick();
  }

  function boot(){
    try{ addStyle(); }catch(e){}
    if (IS_VIDEO){
      mountVideo();
      try{
        new MutationObserver(function(){
          try{ mountVideo(); }catch(e){}
        }).observe(document.body, { childList:true, subtree:true });
      }catch(e){
        setInterval(mountVideo, 1500);
      }
      setInterval(syncTick, 800); // observer kaçırırsa güvence
    } else {
      listenPhotoSync();
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
