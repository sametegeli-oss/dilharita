/* mode-toggle.js — 📷 Resim / 🎬 Video seçici
   Hem index-app.html (foto) hem videopractice.html (video) sayfasına eklenir.
   - Foto ekranında "🎬 Video" seçilirse: mevcut nav-bridge modalı üzerinden
     videopractice.html aynı cümleyle açılır (nbVideoBtn'e proxy click).
   - Video ekranında "📷 Resim" seçilirse: mevcut photoBackBtn davranışı
     kullanılır (modal içindeyse kapanır, değilse index-app.html'e döner).
   - Kullanıcının son seçimi localStorage("dh-practice-mode") içinde tutulur.
   - Eski tekil butonlar (nbVideoBtn / photoBackBtn) gizlenir; işlevleri
     bu toggle üzerinden çalışmaya devam eder. */
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
    css.textContent = `
      .dh-mode-toggle{display:inline-flex;align-items:center;gap:0;background:#0f172a;
        border:1px solid #ffffff26;border-radius:999px;padding:3px;
        box-shadow:0 8px 24px rgba(0,0,0,.35);font-family:Nunito,system-ui,sans-serif;
        user-select:none;-webkit-user-select:none}
      .dh-mode-btn{border:0;background:transparent;color:#94a3b8;border-radius:999px;
        padding:7px 14px;font:800 13px Nunito,system-ui,sans-serif;cursor:pointer;
        transition:background .15s,color .15s;white-space:nowrap}
      .dh-mode-btn.active{background:#2563eb;color:#fff;cursor:default;
        box-shadow:0 4px 14px rgba(37,99,235,.4)}
      .dh-mode-btn:not(.active):hover{color:#e2e8f0;background:#ffffff14}

      /* Foto ekranı: dhNavTrio yanında akış içinde durur */
      .dh-mode-toggle.on-photo{vertical-align:middle;margin:0 6px}

      /* Video ekranı: eski 📷 Fotoğraf butonunun yerinde sabit durur */
      .dh-mode-toggle.on-video{position:fixed;left:16px;top:126px;z-index:130}
      @media(max-width:640px){
        .dh-mode-toggle.on-video{top:auto;left:12px;
          bottom:calc(178px + env(safe-area-inset-bottom))}
      }

      /* Eski tekil butonları gizle — işlev toggle'a taşındı */
      #nbVideoBtn{display:none !important}
      .photo-float{display:none !important}
    `;
    document.head.appendChild(css);
  }

  /* ---------- Geçiş fonksiyonları ---------- */
  function goVideo(){
    setPref("video");
    // nav-bridge'in modal açan butonu varsa onu kullan (cümle senkronu orada hazır)
    var nb = document.getElementById("nbVideoBtn");
    if (nb){ nb.click(); return; }
    // Yedek yol: cümleyi karttan alıp ?q= ile yönlendir
    var card = document.querySelector(".card");
    var en = card && card.querySelector(".card-en");
    var text = en ? (en.textContent || "").trim() : "";
    var src = "./videopractice.html";
    if (text) src += "?q=" + encodeURIComponent(text);
    location.href = src;
  }

  function goPhoto(){
    setPref("photo");
    // videopractice içindeki mevcut buton varsa onu kullan
    // (kaldığın cümleyi kaydeder + modal içindeyse kapatır)
    var pb = document.getElementById("photoBackBtn");
    if (pb){ pb.click(); return; }
    // Yedek yol
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

  /* ---------- Mount ---------- */
  function mountPhoto(){
    var trio = document.getElementById("dhNavTrio");
    var existing = document.getElementById("dhModeToggle");
    if (existing){
      // React yeniden render ettiyse yerini koru
      if (trio && existing.previousElementSibling !== trio){
        trio.insertAdjacentElement("afterend", existing);
      }
      return;
    }
    if (!trio) return; // observer tekrar deneyecek
    trio.insertAdjacentElement("afterend", buildToggle());
  }

  function mountVideo(){
    if (document.getElementById("dhModeToggle")) return;
    document.body.appendChild(buildToggle());
  }

  function boot(){
    try{ addStyle(); }catch(e){}
    if (IS_VIDEO){
      mountVideo();
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
