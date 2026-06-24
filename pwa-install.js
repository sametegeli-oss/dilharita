(function(){
"use strict";

/*
  Güvenli PWA Aşama 1:
  - Service Worker yok.
  - Cache yok.
  - Sayfayı döngüye sokacak hiçbir fetch/cache müdahalesi yok.
  - Sadece manifest + kurulum yardımcısı var.
*/

let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", function(e){
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton("📲 Uygulama olarak kur");
});

window.addEventListener("appinstalled", function(){
  const btn = document.getElementById("pwaInstallBtn");
  if(btn) btn.remove();
});

function isStandalone(){
  return window.matchMedia("(display-mode: standalone)").matches ||
         window.navigator.standalone === true;
}

function showInstallButton(text){
  // Kullanıcı isteğiyle "Ana ekrana ekle / Kur" düğmesi devre dışı bırakıldı.
  return;
  if(isStandalone()) return;
  if(document.getElementById("pwaInstallBtn")) return;

  const btn = document.createElement("button");
  btn.id = "pwaInstallBtn";
  btn.type = "button";
  btn.textContent = text || "📲 Kur";
  btn.style.cssText = [
    "position:fixed",
    "left:14px",
    "bottom:14px",
    "z-index:10000",
    "border:none",
    "border-radius:14px",
    "padding:12px 14px",
    "background:linear-gradient(135deg,#16a34a,#15803d)",
    "color:#fff",
    "font:800 14px system-ui,sans-serif",
    "box-shadow:0 8px 24px #0007"
  ].join(";");

  btn.onclick = async function(){
    if(deferredPrompt){
      deferredPrompt.prompt();
      try{ await deferredPrompt.userChoice; }catch{}
      deferredPrompt = null;
      btn.remove();
      return;
    }

    alert(
      "Uygulama olarak kurmak için:\n\n" +
      "Android Chrome: sağ üst menü ⋮ > Ana ekrana ekle / Uygulamayı yükle\n\n" +
      "iPhone Safari: Paylaş > Ana Ekrana Ekle"
    );
  };

  document.body.appendChild(btn);
}

document.addEventListener("DOMContentLoaded", function(){
  // beforeinstallprompt gelmezse de kullanıcıya yol gösterecek küçük buton göster.
  setTimeout(function(){
    if(!isStandalone()) showInstallButton("📲 Ana ekrana ekle");
  }, 1200);
});
})();