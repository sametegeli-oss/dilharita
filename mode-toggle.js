/* mode-toggle.js — 📷 Resim / 🎬 Video seçici (v2)
   v1'deki DONMA HATASI: nav-bridge.js ile bu dosya, kendi öğelerini
   dhNavTrio'nun hemen yanına taşımak için yarışıyordu → MutationObserver
   sonsuz döngüsü → index-app donuyordu.
   v2 ÇÖZÜM:
   - Toggle artık ASLA yeniden konumlandırılmaz; sadece DOM'dan tamamen
     silinmişse (React yeniden render) yeniden eklenir.
   - Foto ekranında çapa olarak nbVideoBtn kullanılır (trio'nun yanı
     nav-bridge'e bırakılır, kavga biter). nbVideoBtn yoksa trio'ya düşer.
   - Video → Resim geçişinde dönüş bilgisi her durumda kaydedilir. */
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
      "@media(max-width:640px){",
      "  .dh-mode-toggle.on-video{top:auto;left:12px;",
      "    bottom:calc(178px + env(safe-area-inset-bottom))}",
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
    // Yedek yol (ör. videopractice modül seçme ekranındayken):
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

  /* ---------- Mount (foto ekranı) ----------
     KRİTİK KURAL: toggle DOM'da duruyorsa HİÇBİR ŞEY yapma.
     Yeniden konumlandırma yok → observer döngüsü imkânsız. */
  var mounting = false;
  function mountPhoto(){
    if (mounting) return;
    if (document.getElementById("dhModeToggle")) return; // hâlâ sayfada → dokunma
    // Çapa: nbVideoBtn (gizli ama DOM'da). Onun yanına eklenirsek
    // nav-bridge'in "trio'nun hemen yanındayım" kontrolü bozulmaz.
    var anchor = document.getElementById("nbVideoBtn") ||
                 document.getElementById("dhNavTrio");
    if (!anchor) return; // observer tekrar deneyecek
    mounting = true;
    try{ anchor.insertAdjacentElement("afterend", buildToggle()); }
    finally{ mounting = false; }
  }

  function mountVideo(){
    if (document.getElementById("dhModeToggle")) return;
    document.body.appendChild(buildToggle());
  }

  function boot(){
    try{ addStyle(); }catch(e){}
    if (IS_VIDEO){
      mountVideo();
      // root.innerHTML her kartta yenileniyor ama toggle body'de → kalıcı.
      // Yine de güvence olarak hafif bir kontrol:
      setInterval(mountVideo, 2000);
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
