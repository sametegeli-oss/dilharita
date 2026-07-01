/* index-app-layout.js — DÜZEN TOPARLAYICI (v1)
   index-app.html React arayüzünü kullanıcı dostu yapar (bundle'a dokunmadan, DOM sonrası).

   1) İleri/geri (.study-nav) → ekranın altına SABİT çubuk (mobilde parmak altında)
   2) 9'lu araç ızgarası (.wd-tools-row) → gizli; tek "🛠 Araçlar" butonuyla aç/kapa
   3) Kart alt boşluğu → sabit çubukla çakışmasın

   Not: React yeniden render edince düzen bozulmasın diye MutationObserver ile sürekli uygular.
*/
(function(){
  "use strict";
  var STYLE_ID="dh-ia-layout-css";

  function addStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var s=document.createElement("style"); s.id=STYLE_ID;
    s.textContent = `
    /* içerik alt sabit çubuğun altına girmesin */
    body{ padding-bottom: 76px !important; }

    /* ---- SABİT ALT NAV ÇUBUĞU (ileri/geri) ---- */
    .study-nav.dh-fixed-nav{
      position:fixed !important;
      left:0; right:0; bottom:0;
      z-index:9000;
      display:flex !important;
      gap:10px;
      align-items:center;
      justify-content:space-between;
      margin:0 !important;
      padding:10px 12px calc(10px + env(safe-area-inset-bottom));
      background:rgba(9,15,28,.96);
      backdrop-filter:blur(10px);
      border-top:1px solid rgba(255,255,255,.10);
      box-shadow:0 -8px 30px rgba(0,0,0,.4);
    }
    .study-nav.dh-fixed-nav .btn{
      flex:1;
      min-height:48px;
      font-size:15px !important;
      font-weight:800 !important;
      border-radius:14px !important;
    }
    /* ortadaki nokta/gösterge varsa küçült */
    .study-nav.dh-fixed-nav > *:not(.btn){ flex:0 0 auto; }

    /* ---- ARAÇLAR: gizle + aç/kapa ---- */
    .wd-tools-row.dh-tools-hidden{ display:none !important; }
    .dh-tools-toggle{
      width:100%;
      margin-top:14px;
      min-height:52px;
      border:1px solid rgba(255,255,255,.14);
      border-radius:16px;
      background:#17233a;
      color:#eaf2ff;
      font:900 15px Nunito,system-ui,sans-serif;
      cursor:pointer;
      display:flex; align-items:center; justify-content:center; gap:8px;
    }
    .dh-tools-toggle:hover{ background:#22304f; }
    .dh-tools-toggle .chev{ transition:transform .2s; }
    .dh-tools-toggle.open .chev{ transform:rotate(180deg); }
    `;
    document.head.appendChild(s);
  }

  // ---- 1) ileri/geri çubuğunu sabitle ----
  function fixNav(){
    var nav=document.querySelector(".study-nav");
    if(nav && !nav.classList.contains("dh-fixed-nav")){
      nav.classList.add("dh-fixed-nav");
    }
  }

  // ---- 2) araç ızgarasını gizle + toggle butonu ekle ----
  function foldTools(){
    var grid=document.querySelector(".wd-tools-row");
    if(!grid) return;
    // zaten işlenmişse çık
    if(grid.dataset.dhFolded==="1") return;
    grid.dataset.dhFolded="1";
    grid.classList.add("dh-tools-hidden");

    // toggle butonu (ızgaranın hemen öncesine)
    var btn=document.createElement("button");
    btn.type="button";
    btn.className="dh-tools-toggle";
    btn.innerHTML='🛠 Araçlar <span class="chev">▾</span>';
    btn.onclick=function(){
      var hidden=grid.classList.toggle("dh-tools-hidden");
      btn.classList.toggle("open", !hidden);
    };
    grid.parentNode.insertBefore(btn, grid);
  }

  function apply(){
    addStyle();
    fixNav();
    foldTools();
  }

  // ilk uygula + React render'larını izle
  function boot(){
    apply();
    try{
      var mo=new MutationObserver(function(){ apply(); });
      mo.observe(document.body, {childList:true, subtree:true});
    }catch(e){}
    // güvenlik: birkaç kez tekrar dene (React geç render edebilir)
    var n=0, t=setInterval(function(){ apply(); if(++n>20) clearInterval(t); }, 400);
  }
  if(document.readyState!=="loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
