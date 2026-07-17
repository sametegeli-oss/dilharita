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
    /* Zayıf Analiz / Öğretmen düğmeleri artık kart üzerinde gösterilmiyor — sadece 🛠 Araçlar panelinde */
    +".extra-weak-btn,.sm-teacher-btn{display:none !important}"
    /* grade-bar her modda kompakt yatay */
    +".grade-bar{display:flex !important;gap:6px;align-items:stretch}"
    +".grade-bar .grade-label{display:none !important}"
    +".grade-bar .grade-btn{flex:1;min-height:38px;border-radius:10px;font-weight:800;font-size:13px}"
    /* GTR + AI'ye Sor — artık ikisi bir arada, üçlünün altında tek satır */
    +".dh-ai-row{display:flex;gap:8px;margin:0 0 14px}"
    +".dh-ai-row .dh-gtr-btn{flex:1;margin:0;justify-content:center}"
    +".dh-gtr-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:#1a2942;color:#cfe0ff;font:800 13px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-gtr-btn:hover{background:#22344f}"
    +".dh-aiask-btn{background:linear-gradient(135deg,#7c3aed,#4338ca);border-color:#8b5cf6;color:#fff}"
    +".dh-aiask-btn:hover{background:linear-gradient(135deg,#8b4cf7,#4f46e0)}"
    /* nav: orijinal alt satır artık gizli — üçlü resmin üstüne taşındı (proxy) */
    +".study-nav{display:none !important}"
    +".dh-nav-trio{display:flex;gap:8px;align-items:center;margin:0 0 14px}"
    +".dh-nav-trio .dh-nav-btn{flex:1;min-height:42px;font-weight:800;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:#1a2942;color:#cfe0ff;font:800 14px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-nav-trio .dh-nav-btn:hover{background:#22344f}"
    +".dh-nav-trio .dh-nav-btn:disabled{opacity:.35;cursor:default}"
    +".dh-nav-trio .dh-nav-next{background:#2563eb;color:#fff;border-color:transparent}"
    +".dh-nav-trio .dh-nav-next:hover{background:#2f6fe0}"
    +".dh-nav-trio .dh-tools-toggle{flex:0 0 auto !important;margin:0}"
    /* 🛠 toggle (benim öğem, üçlünün ortasına eklenir) */
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
    +".card.dh-split>.grade-bar,.card.dh-split>.grade-done{grid-column:2;grid-row:1;flex-direction:column !important}"
    +".card.dh-split>.grade-bar .grade-btn{min-height:33px;font-size:12px}"
    +".card.dh-split>.dh-nav-trio{grid-column:2;grid-row:2}"
    +".card.dh-split>.dh-nav-trio .dh-nav-btn{min-height:31px;padding:5px 9px !important;font-size:12px !important;border-radius:9px !important}"
    +".card.dh-split>.dh-nav-trio .dh-tools-toggle{min-height:31px !important;padding:0 9px !important}"
    +".card.dh-split>.dh-ai-row{grid-column:2;grid-row:3}"
    +".card.dh-split>.dh-ai-row .dh-gtr-btn{font-size:11px !important;padding:5px 9px !important;min-height:31px}"
    +".card.dh-split>.card-actions{grid-column:2;grid-row:4;display:flex;flex-wrap:wrap;gap:6px;align-content:start}"
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
    +".dh-nav-trio .dh-nav-btn{min-height:34px;font-size:13px}"
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

  /* 🌐 Google Translate + 🤖 AI'ye Sor — tek satırda yan yana, kendi öğelerim;
     Önceki/Araçlar/Sonraki üçlüsünün hemen altına yerleşir (React düğümü taşınmaz) */
  function ensureAiRow(c, trio){
    var en=c.querySelector(".card-en");
    if(!en) return;
    var anchor = trio || gradeAnchor(c);
    if(!anchor) return;
    var row=document.getElementById("dhAiRow");
    if(!row){
      row=document.createElement("div");
      row.id="dhAiRow"; row.className="dh-ai-row";

      var gtr=document.createElement("button");
      gtr.type="button"; gtr.className="dh-gtr-btn"; gtr.textContent="🌐 Google Translate";
      gtr.onclick=function(){
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

      var ai=document.createElement("button");
      ai.type="button"; ai.className="dh-gtr-btn dh-aiask-btn"; ai.textContent="🤖 AI'ye Sor";
      ai.onclick=function(){
        var t=(en.textContent||"").trim(); if(!t) return;
        var prompt=t+" cümlesindeki yapıları öğret";
        try{
          if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(prompt);
          else{ var ta=document.createElement("textarea"); ta.value=prompt; ta.style.cssText="position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
        }catch(e){}
        try{
          var n=document.createElement("div");
          n.textContent="📋 Prompt kopyalandı — Gemini'de yapıştır (Ctrl/Cmd+V) ve Enter'a bas";
          n.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#0f1f3a;color:#fff;border:1px solid #7c3aed;padding:11px 16px;border-radius:12px;font:700 13px system-ui;max-width:90vw;text-align:center";
          document.body.appendChild(n);
          setTimeout(function(){ n.remove(); },3600);
        }catch(e){}
        window.open("https://gemini.google.com/app","_blank");
      };

      /* 🎙️ Telaffuz Stüdyosu: karttaki cümleyi sesdalga'ya taşır; geri dönüş
         mod-autopen'in ?q= yürüyüşüyle AYNI karta gelir */
      var stu=document.createElement("button");
      stu.type="button"; stu.className="dh-gtr-btn"; stu.textContent="🎙️ Stüdyo";
      stu.onclick=function(){
        var t=(en.textContent||"").trim(); if(!t) return;
        var trEl=c.querySelector(".card-tr");
        var tr=trEl?(trEl.textContent||"").trim():"";
        var back="";
        try{
          var mod=new URLSearchParams(location.search).get("mod");
          if(mod) back="index-app.html?mod="+encodeURIComponent(mod)+"&q="+encodeURIComponent(t);
        }catch(e){}
        location.href="./sesdalga.html?en="+encodeURIComponent(t)+"&tr="+encodeURIComponent(tr)+(back?("&back="+encodeURIComponent(back)):"");
      };
      row.appendChild(stu);
      row.appendChild(gtr);
      row.appendChild(ai);
    }
    if(row.previousElementSibling!==anchor || row.parentElement!==anchor.parentElement){
      anchor.insertAdjacentElement("afterend", row); // React yeniden render ettiyse konumu düzelt
    }
  }

  /* Önceki / Sonraki gerçek React düğmeleri (study-nav içinde, taşınmaz) */
  function realPrevBtn(){
    var nav=document.querySelector(".study-nav");
    return nav ? nav.querySelector("button.btn:not(.btn-primary)") : null;
  }
  function realNextBtn(){
    var nav=document.querySelector(".study-nav");
    return nav ? nav.querySelector("button.btn-primary") : null;
  }

  /* ⬅➡ üçlü — Zor/Normal/Kolay (grade-bar) düğmelerinin hemen altına kendi öğem;
     grade-bar bazen "grade-done" mesajına dönüştüğü için ikisine de bakılır,
     hiçbiri yoksa card-meta'nın altına düşer (kaybolmasın diye).
     gerçek React düğmelerine yalnız proxy .click() + disabled senkronu */
  function gradeAnchor(c){
    return c.querySelector(".grade-bar") || c.querySelector(".grade-done") || c.querySelector(".card-meta");
  }
  function ensureNavTrio(c){
    var anchor=gradeAnchor(c);
    if(!anchor) return null;
    var trio=document.getElementById("dhNavTrio");
    if(!trio){
      trio=document.createElement("div");
      trio.id="dhNavTrio"; trio.className="dh-nav-trio";
      var prev=document.createElement("button");
      prev.type="button"; prev.className="dh-nav-btn dh-nav-prev"; prev.textContent="← Önceki";
      prev.onclick=function(){ var r=realPrevBtn(); if(r) r.click(); };
      var next=document.createElement("button");
      next.type="button"; next.className="dh-nav-btn dh-nav-next"; next.textContent="Sonraki →";
      next.onclick=function(){ var r=realNextBtn(); if(r) r.click(); };
      trio.appendChild(prev);
      trio.appendChild(next);
      anchor.insertAdjacentElement("afterend", trio);
    }
    if(trio.previousElementSibling!==anchor || trio.parentElement!==anchor.parentElement){
      anchor.insertAdjacentElement("afterend", trio); // React yeniden render ettiyse konumu düzelt
    }
    var rp=realPrevBtn(), rn=realNextBtn();
    var pBtn=trio.querySelector(".dh-nav-prev"), nBtn=trio.querySelector(".dh-nav-next");
    if(pBtn) pBtn.disabled = !!(rp && rp.disabled);
    if(nBtn) nBtn.disabled = !!(rn && rn.disabled);
    return trio;
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
    var trio=document.getElementById("dhNavTrio");
    if(trio&&tg.parentElement!==trio){
      var nextBtn=trio.querySelector(".dh-nav-next");
      if(nextBtn) trio.insertBefore(tg,nextBtn); else trio.appendChild(tg);
    }else if(!trio){
      var nav=document.querySelector(".study-nav"); // yedek: kart bulunamazsa eski yere
      if(nav&&tg.parentElement!==nav){
        var btns=nav.querySelectorAll(".btn");
        if(btns.length>=2) nav.insertBefore(tg,btns[btns.length-1]); else nav.appendChild(tg);
      }
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
        ensureNavTrio(c);
        var trio=document.getElementById("dhNavTrio");
        ensureAiRow(c, trio);
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
