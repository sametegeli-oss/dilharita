(function(){
'use strict';
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(err=>console.warn('SW hata',err)))}
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;showInstallButton()});
function showInstallButton(){
 if(document.getElementById('pwaInstallBtn'))return;
 const b=document.createElement('button');b.id='pwaInstallBtn';b.textContent='📲 Uygulama olarak kur';
 b.style.cssText='position:fixed;left:14px;bottom:14px;z-index:10000;border:none;border-radius:14px;padding:12px 14px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font:800 14px system-ui,sans-serif;box-shadow:0 8px 24px #0007';
 b.onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();try{await deferredPrompt.userChoice}catch{}deferredPrompt=null;b.remove()};
 document.body.appendChild(b);
}
})();