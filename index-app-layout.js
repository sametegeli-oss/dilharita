/* index-app-layout.js — v12 TAŞIMASIZ / ÇÖKMESİZ SÜRÜM
   İLKE: React'in DOM düğümleri ASLA taşınmaz/silinmez (removeChild çökmesinin sebebiydi).
   Yerleşim %100 CSS grid: grade-bar ve card-actions kartın doğrudan çocuğu olduğundan
   grid-column:2 ile taşımadan sağ sütuna yerleşir. JS yalnızca:
     - karta .dh-split sınıfı ekler (React silerse yeniden ekler)
     - KENDİ öğelerini üretir: 🌐 GTR butonu, 🛠 toggle, araç paneli (proxy butonlar)
*/
(function(){
  "use strict";
  var applying=false, scheduled=false;

  function addStyle(){
    if(document.getElementById("dh-ia-css")) return;
    var s=document.createElement("style"); s.id="dh-ia-css";
    s.textContent =
    /* genel */
     ".legend,.legend-item,.legend-dot{display:none !important}"
    +"@media (orientation:landscape){.study-header,.study-progress{display:none !important}}"
    /* React'in Öğretmen/Zayıf butonları ana ekranda gizli (taşınmaz!) — panelde proxy'leri var */
    +".card-actions .teacher-btn,.card-actions .extra-weak,button.teacher-btn,button.extra-weak{display:none !important}"
    /* grade-bar her modda kompakt yatay */
    +".grade-bar{display:flex !important;gap:6px;align-items:stretch}"
    +".grade-bar .grade-label{display:none !important}"
    +".grade-bar .grade-btn{flex:1;min-height:38px;border-radius:10px;font-weight:800;font-size:13px}"
    /* GTR butonu */
    +".dh-gtr-btn{display:inline-flex;align-items:center;gap:6px;margin:8px 0 2px;padding:7px 12px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:#1a2942;color:#cfe0ff;font:800 13px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-gtr-btn:hover{background:#22344f}"
    /* nav: kart altında kompakt (taşınmaz) */
    +".study-nav{display:flex;gap:8px;align-items:center}"
    +".study-nav .btn{flex:1;min-height:42px;font-weight:800;border-radius:11px}"
    /* 🛠 toggle (benim öğem, nav içine eklenir) */
    +".dh-tools-toggle{flex:0 0 auto !important;min-height:42px;padding:0 13px;border:1px solid rgba(255,255,255,.14);border-radius:11px;background:#17233a;color:#eaf2ff;font:900 14px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-tools-toggle:hover{background:#22304f}"
    /* araç paneli (benim öğem) */
    +".dh-tools-box{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:8999;width:92%;max-width:420px;padding:14px;max-height:56vh;overflow-y:auto;border-radius:16px;background:#0d1a30;border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 40px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:10px}"
    +".dh-tools-box.dh-hidden{display:none !important}"
    +".dh-tools-box .dh-pbtn{width:100%;min-height:42px;border-radius:10px;border:1px solid rgba(255,255,255,.15);font:800 13px Nunito,system-ui;cursor:pointer;background:#1e293b;color:#f8fafc}"
    +".dh-tools-box .dh-pbtn:hover{background:#334155}"
    +".dh-tools-box .wd-tools-row{margin:0 !important}"
    /* ---- 2 SÜTUN (yatay/geniş): SAF CSS, TAŞIMA YOK ---- */
    +"@media (orientation:landscape),(min-width:680px){"
    +".card.dh-split{display:grid !important;grid-template-columns:1.55fr .85fr;gap:10px 16px;align-items:start}"
    +".card.dh-split>*{grid-column:1;min-width:0}"
    +".card.dh-split>.grade-bar{grid-column:2;grid-row:1;flex-direction:column !important}"
    +".card.dh-split>.grade-bar .grade-btn{min-height:33px;font-size:12px}"
    +".card.dh-split>.card-actions{grid-column:2;grid-row:2;display:flex;flex-wrap:wrap;gap:6px;align-content:start}"
    +".card.dh-split>.card-actions button{min-height:31px;padding:5px 9px !important;font-size:12px !important;border-radius:9px !important}"
    +"}"
    /* ---- YATAY MOBİL: TEK EKRAN ---- */
    +"@media (orientation:landscape) and (max-height:520px){"
    +"body{padding:0 !important}"
    +".study-main{padding:6px 10px !important;margin:0 !important}"
    +".card.dh-split{padding:10px !important;gap:6px 12px !important;margin:0 !important}"
    +".card.dh-split>.card-meta{display:none !important}"
    +".card.dh-split>.sm-img-wrap{grid-row:1;grid-column:1;margin:0 !important}"
    +".card.dh-split .sm-img{max-height:50vh;width:100%;object-fit:cover;display:block;border-radius:12px}"
    +".card.dh-split>.card-en{grid-row:1;grid-column:1;align-self:end;z-index:2;margin:0 !important;padding:7px 11px !important;background:rgba(4,10,24,.62);backdrop-filter:blur(3px);border-radius:0 0 12px 12px;font-size:17px !important;line-height:1.3 !important}"
    +".card.dh-split>.card-tr{margin:2px 0 !important;font-size:14px !important}"
    +".card.dh-split>.card-pron,.card.dh-split>.card-ipa{font-size:11px !important;margin:0 !important}"
    +".card.dh-split .dh-gtr-btn{margin:2px 0 !important;padding:4px 9px !important;font-size:11px !important}"
    +".study-nav .btn{min-height:34px;font-size:13px}"
    +".dh-tools-toggle{min-height:34px}"
    +"}";
    document.head.appendChild(s);
  }

  function card(){
    var cs=document.querySelectorAll(".card");
    for(var i=0;i<cs.length;i++) if(cs[i].querySelector(".card-en")&&cs[i].querySelector(".card-actions")) return cs[i];
    return null;
  }
  function byText(root,t){
    if(!root) return null;
    t=t.toLocaleLowerCase("tr");
    var bs=root.querySelectorAll("button,a");
    for(var i=0;i<bs.length;i++) if((bs[i].textContent||"").toLocaleLowerCase("tr").indexOf(t)>=0) return bs[i];
    return null;
  }

  /* 🌐 GTR — kendi öğem; .card-tr'nin yanına eklenir (React düğümü taşınmaz) */
  function ensureGtr(c){
    if(c.querySelector(".dh-gtr-btn")) return;
    var tr=c.querySelector(".card-tr"), en=c.querySelector(".card-en");
    if(!tr||!en) return;
    var b=document.createElement("button");
    b.type="button"; b.className="dh-gtr-btn"; b.textContent="🌐 Google Translate";
    b.onclick=function(){
      var t=(en.textContent||"").trim(); if(!t) return;
      try{
        if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t);
        else{ var ta=document.createElement("textarea"); ta.value=t; ta.style.cssText="position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
      }catch(e){}
      try{
        var n=document.createElement("div");
        n.textContent="📋 Cümle kopyalandı — Translate'te yapıştır";
        n.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#0f1f3a;color:#fff;border:1px solid #2563eb;padding:11px 16px;border-radius:12px;font:700 13px system-ui;max-width:90vw;text-align:center";
        document.body.appendChild(n);
        setTimeout(function(){ n.remove(); },2600);
      }catch(e){}
      window.open("https://translate.google.com/?sl=en&tl=tr&op=translate&text="+encodeURIComponent(t),"_blank");
    };
    tr.insertAdjacentElement("afterend", b);
  }

  /* 🛠 toggle + panel — hepsi kendi öğem; React butonlarına yalnız proxy .click() */
  function ensureTools(){
    var box=document.getElementById("dhToolsBox");
    if(!box){
      box=document.createElement("div");
      box.id="dhToolsBox"; box.className="dh-tools-box dh-hidden";
      var mk=function(label,finder){
        var b=document.createElement("button");
        b.className="dh-pbtn"; b.textContent=label;
        b.onclick=function(){ var t=finder(); if(t) t.click(); };
        return b;
      };
      box.appendChild(mk("🎓 Öğretmen",function(){ var c=card(); return c&&(c.querySelector(".teacher-btn")||byText(c,"öğretmen")); }));
      box.appendChild(mk("📉 Zayıf Analiz",function(){ var c=card(); return c&&(c.querySelector(".extra-weak")||byText(c,"zayıf")); }));
      box.appendChild(mk("🔍 Detay",function(){ return byText(card(),"detay"); }));
      document.body.appendChild(box);
    }
    var grid=document.querySelector(".wd-tools-row");   // başka eklentinin öğesi (React değil) — taşınabilir
    if(grid&&grid.parentElement!==box) box.appendChild(grid);

    var tg=document.getElementById("dhToolsToggle");
    if(!tg){
      tg=document.createElement("button");
      tg.id="dhToolsToggle"; tg.type="button"; tg.className="dh-tools-toggle"; tg.textContent="🛠";
      tg.onclick=function(){ box.classList.toggle("dh-hidden"); };
    }
    var nav=document.querySelector(".study-nav");
    if(nav&&tg.parentElement!==nav){
      var btns=nav.querySelectorAll(".btn");
      if(btns.length>=2) nav.insertBefore(tg,btns[btns.length-1]); else nav.appendChild(tg);
    }
  }

  function apply(){
    if(applying) return;
    applying=true;
    try{
      addStyle();
      var c=card();
      if(c){
        if(!c.classList.contains("dh-split")) c.classList.add("dh-split"); // React sınıfı silerse yeniden
        ensureGtr(c);
      }
      ensureTools();
    }catch(e){}
    applying=false;
  }
  function schedule(){ if(scheduled) return; scheduled=true; setTimeout(function(){ scheduled=false; apply(); },150); }
  function boot(){
    apply();
    try{ new MutationObserver(function(){ if(!applying) schedule(); }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]}); }catch(e){}
    var n=0,t=setInterval(function(){ apply(); if(++n>10) clearInterval(t); },400);
  }
  if(document.readyState!=="loading") boot(); else document.addEventListener("DOMContentLoaded",boot);
})();
