/* dh-app-shell.js — ortak gezinme, bağlantı ve erişilebilirlik kabuğu */
(function (global) {
  "use strict";
  if (global.__dhAppShellInstalled) return;
  global.__dhAppShellInstalled = true;
  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  var excluded = /^(login|basla|pwa-reset|pwa-hard-reset)\.html?$/.test(page);
  function activeFor(href) {
    if (href === "./index.html") return page === "index.html";
    if (href === "./library.html") return /^(library|menu|modullerim|kelime-ogren|phrasal-verbs|pdfoku|ocr-sentence)\.html?$/.test(page);
    if (href === "./chat.html") return /^(chat|chatteacher|chatteacher1|chatteacher2|chatdoctor|chathotel|chatairport|chatrestaurant|teacher|teacher1|teacher3)\.html?$/.test(page);
    return /^(rapor|ilerleme|gunluk-takip|hata-defteri|aktivite)\.html?$/.test(page);
  }
  function icon(name) {
    var paths = {home:'<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',learn:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5z"/><path d="M4 6.5v13"/>',talk:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',chart:'<path d="M4 20V10m6 10V4m6 16v-7m5 7H2"/>'};
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+paths[name]+'</svg>';
  }
  function installNav() {
    if (excluded || document.querySelector(".dh-app-nav")) return;
    var items=[["./index.html","home","Bugün"],["./library.html","learn","Öğren"],["./chat.html","talk","Konuş"],["./rapor.html","chart","İlerleme"]];
    var nav=document.createElement("nav"); nav.className="dh-app-nav"; nav.setAttribute("aria-label","Ana gezinme");
    nav.innerHTML=items.map(function(x){var active=activeFor(x[0]);return '<a href="'+x[0]+'"'+(active?' class="is-active" aria-current="page"':'')+'>'+icon(x[1])+'<span>'+x[2]+'</span></a>';}).join("");
    document.body.appendChild(nav); document.body.classList.add("dh-has-app-nav");
  }
  function installConnectionStatus() {
    if (document.getElementById("dhConnectionStatus")) return;
    var el=document.createElement("div"); el.id="dhConnectionStatus"; el.className="dh-connection"; el.setAttribute("role","status"); el.setAttribute("aria-live","polite"); document.body.appendChild(el);
    var hideTimer=null;
    function show(message,bad){clearTimeout(hideTimer);el.textContent=message;el.classList.toggle("is-error",!!bad);el.classList.add("is-visible");hideTimer=setTimeout(function(){el.classList.remove("is-visible");},bad?5200:3000);}
    function paint(){var offline=navigator.onLine===false;if(offline){clearTimeout(hideTimer);el.textContent="Çevrimdışısın · ilerlemen bu cihazda korunuyor";el.classList.remove("is-error");el.classList.add("is-visible");}else show("Bağlantı geri geldi · ilerleme eşitlenecek",false);}
    global.addEventListener("offline",paint); global.addEventListener("online",function(){el.classList.add("is-visible");paint();}); if(navigator.onLine===false)paint();
    global.addEventListener("dh-cloud-sync-state",function(ev){
      var d=ev.detail||{};
      if(d.state==="syncing") show(d.migration?"Cihazdaki ilerlemen hesabına aktarılıyor…":"İlerlemen eşitleniyor…",false);
      else if(d.state==="success") show(d.migration?"İlerlemen hesabına güvenle aktarıldı":"İlerlemen güncel",false);
      else if(d.state==="error") show("Eşitleme tamamlanamadı · cihazdaki verilerin korunuyor",true);
    });
  }
  function start(){try{if(global.matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("dh-reduced-motion");}catch(e){} installNav();installConnectionStatus();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})(window);
