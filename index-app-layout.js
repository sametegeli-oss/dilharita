/* index-app-layout.js — v19 TÜM MODÜLLERİ PDF İNDİRME SÜRÜMÜ
   - Ekranda veya Araçlar panelinde "Tüm Modülleri PDF İndir" seçeneği içerir.
   - Bütün modüllerdeki cümleleri, TR karşılıklarını ve IndexedDB'deki AI açıklamalarını derler.
   - Markdown işaretlerini Gemini dizaynında şık HTML'e dönüştürür.
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
    /* React'in Öğretmen/Zayıf butonları ana ekranda gizli */
    +".card-actions .teacher-btn,.card-actions .extra-weak,button.teacher-btn,button.extra-weak{display:none !important}"
    +".extra-weak-btn,.sm-teacher-btn{display:none !important}"
    /* grade-bar her modda kompakt yatay */
    +".grade-bar{display:flex !important;gap:6px;align-items:stretch}"
    +".grade-bar .grade-label{display:none !important}"
    +".grade-bar .grade-btn{flex:1;min-height:38px;border-radius:10px;font-weight:800;font-size:13px}"
    /* GTR + AI'ye Sor + PDF İndir Satırı */
    +".dh-ai-row{display:flex;gap:6px;margin:0 0 14px;flex-wrap:wrap}"
    +".dh-ai-row .dh-gtr-btn{flex:1;margin:0;justify-content:center;min-width:100px}"
    +".dh-gtr-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:#1a2942;color:#cfe0ff;font:800 12px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-gtr-btn:hover{background:#22344f}"
    +".dh-aiask-btn{background:linear-gradient(135deg,#7c3aed,#4338ca);border-color:#8b5cf6;color:#fff}"
    +".dh-aiask-btn:hover{background:linear-gradient(135deg,#8b4cf7,#4f46e0)}"
    +".dh-pdf-btn{background:linear-gradient(135deg,#059669,#10b981);border-color:#34d399;color:#fff}"
    +".dh-pdf-btn:hover{background:linear-gradient(135deg,#047857,#059669)}"
    +".dh-pdf-all-btn{background:linear-gradient(135deg,#d97706,#f59e0b);border-color:#fbbf24;color:#fff}"
    +".dh-pdf-all-btn:hover{background:linear-gradient(135deg,#b45309,#d97706)}"
    +".dh-youtube-source-btn{background:linear-gradient(135deg,#dc2626,#b91c1c)!important;border-color:#f87171!important;color:#fff!important}"
    +".dh-youtube-source-btn:hover{background:linear-gradient(135deg,#ef4444,#dc2626)!important}"
    +".dh-source-media-row{display:flex;align-items:stretch;gap:8px;min-width:0}"
    +".dh-source-media-row #dhModeToggle{flex:1;min-width:0;margin:0!important}"
    +".dh-source-media-row .dh-youtube-source-btn{flex:0 0 auto;padding:7px 13px;border-radius:11px;font:900 12px Nunito,system-ui,sans-serif;cursor:pointer}"
    /* bütün cümle açıklamaları hazır modül kartı */
    +".dh-ai-ready-module-card{background:linear-gradient(135deg,rgba(6,78,59,.96),rgba(13,60,78,.96)) !important;border-color:#34d399 !important;box-shadow:0 0 0 1px rgba(52,211,153,.25),0 10px 28px rgba(5,150,105,.18) !important;position:relative}"
    +".dh-ai-ready-badge{display:inline-flex;align-items:center;align-self:flex-start;margin-top:5px;padding:3px 8px;border-radius:999px;background:#10b981;color:#03261c;font:900 10px Nunito,system-ui,sans-serif;line-height:1.35;pointer-events:none}"
    /* nav */
    +".study-nav{display:none !important}"
    +".dh-nav-trio{display:flex;gap:8px;align-items:center;margin:0 0 14px}"
    +".dh-nav-trio .dh-nav-btn{flex:1;min-height:42px;font-weight:800;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:#1a2942;color:#cfe0ff;font:800 14px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-nav-trio .dh-nav-btn:hover{background:#22344f}"
    +".dh-nav-trio .dh-nav-btn:disabled{opacity:.35;cursor:default}"
    +".dh-nav-trio .dh-nav-next{background:#2563eb;color:#fff;border-color:transparent}"
    +".dh-nav-trio .dh-nav-next:hover{background:#2f6fe0}"
    +".dh-nav-trio .dh-tools-toggle{flex:0 0 auto !important;margin:0}"
    /* 🛠 toggle */
    +".dh-tools-toggle{flex:0 0 auto !important;min-height:42px;padding:0 13px;border:1px solid rgba(255,255,255,.14);border-radius:11px;background:#17233a;color:#eaf2ff;font:900 14px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-tools-toggle:hover{background:#22304f}"
    /* araç paneli */
    +".dh-tools-box{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:8999;width:92%;max-width:420px;padding:14px;max-height:56vh;overflow-y:auto;border-radius:16px;background:#0d1a30;border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 40px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:10px}"
    +".dh-tools-box.dh-hidden{display:none !important}"
    +".dh-tools-box .dh-pbtn{width:100%;min-height:42px;border-radius:10px;border:1px solid rgba(255,255,255,.15);font:800 13px Nunito,system-ui;cursor:pointer;background:#1e293b;color:#f8fafc}"
    +".dh-tools-box .dh-pbtn:hover{background:#334155}"
    +".dh-tools-box .wd-tools-row{margin:0 !important}"
    +".card.dh-split>.dh-sentence-listen-row{grid-column:1;display:flex !important;align-items:center;gap:9px;min-width:0;margin:0 0 8px}"
    +".dh-sentence-listen-row>.card-en{display:block;margin:0 !important;min-width:0}"
    +".dh-sentence-listen-row>.dh-listen-after-sentence{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;margin:0;padding:7px 13px !important;border-radius:10px !important;background:#0e7490 !important;color:#fff !important;font-weight:900 !important;white-space:nowrap}"
    
    /* GEMINI MODELİİLE BİREBİR STİLLER */
    +"#dhAiResultBox { font-family: 'Nunito', system-ui, -apple-system, sans-serif !important; color: #f1f5f9 !important; font-size: 14px !important; line-height: 1.65 !important; }"
    +"#dhAiResultBox h3, #dhAiResultBox h4 { font-size: 15px !important; font-weight: 800 !important; color: #f8fafc !important; margin: 16px 0 8px 0 !important; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px; }"
    +"#dhAiResultBox p { margin: 6px 0 !important; }"
    +"#dhAiResultBox strong { color: #ffffff !important; font-weight: 700 !important; }"
    +"#dhAiResultBox em { color: #cbd5e1 !important; font-style: italic !important; }"
    +"#dhAiResultBox code { background: rgba(255, 255, 255, 0.1) !important; color: #e2e8f0 !important; padding: 3px 7px !important; border-radius: 6px !important; font-family: monospace, sans-serif !important; font-size: 13px !important; display: inline-block !important; margin: 2px 0 !important; border: 1px solid rgba(255,255,255,0.05); }"
    +"#dhAiResultBox blockquote { margin: 8px 0 !important; padding: 6px 12px !important; background: rgba(255,255,255,0.03) !important; border-left: 3px solid #8b5cf6 !important; border-radius: 0 6px 6px 0 !important; color: #e2e8f0 !important; font-style: italic !important; }"
    +"#dhAiResultBox ul, #dhAiResultBox ol { margin: 6px 0 10px 20px !important; padding: 0 !important; }"
    +"#dhAiResultBox li { margin-bottom: 6px !important; list-style-type: disc !important; }"
    +"#dhAiResultBox hr { border: 0 !important; height: 1px !important; background: rgba(255,255,255,0.1) !important; margin: 16px 0 !important; }"

    /* 2 SÜTUN */
    +"@media (orientation:landscape),(min-width:680px){"
    +".card.dh-split{display:grid !important;grid-template-columns:1.55fr .85fr;gap:10px 16px;align-items:start}"
    +".card.dh-split>*{grid-column:1;min-width:0}"
    +".card.dh-split>.grade-bar,.card.dh-split>.grade-done{grid-column:2;grid-row:1;flex-direction:column !important}"
    +".card.dh-split>.grade-bar .grade-btn{min-height:33px;font-size:12px}"
    +".card.dh-split>.dh-nav-trio{grid-column:2;grid-row:2}"
    +".card.dh-split>.dh-nav-trio .dh-nav-btn{min-height:31px;padding:5px 9px !important;font-size:12px !important;border-radius:9px !important}"
    +".card.dh-split>.dh-nav-trio .dh-tools-toggle{min-height:31px !important;padding:0 9px !important}"
    +".card.dh-split>.dh-ai-row{grid-column:2;grid-row:3}"
    +".card.dh-split>.dh-ai-row .dh-gtr-btn{font-size:11px !important;padding:5px 6px !important;min-height:31px}"
    +".card.dh-split>.card-actions{grid-column:2;grid-row:4;display:flex;flex-wrap:wrap;gap:6px;align-content:start}"
    +".card.dh-split>.card-actions button{min-height:31px;padding:5px 9px !important;font-size:12px !important;border-radius:9px !important}"
    +"}"
    /* YATAY MOBİL */
    +"@media (orientation:landscape) and (max-height:520px){"
    +"body{padding:0 !important}"
    +".study-main{padding:6px 10px !important;margin:0 !important}"
    +".card.dh-split{padding:10px !important;gap:6px 12px !important;margin:0 !important}"
    +".card.dh-split>.card-meta{display:none !important}"
    +".card.dh-split>.sm-img-wrap{grid-row:1;grid-column:1;margin:0 !important}"
    +".card.dh-split .sm-img{max-height:50vh;width:100%;object-fit:cover;display:block;border-radius:12px}"
    +".card.dh-split>.dh-sentence-listen-row{grid-row:1;grid-column:1;align-self:end;z-index:2;margin:0 !important;padding:7px 11px !important;background:rgba(4,10,24,.62);backdrop-filter:blur(3px);border-radius:0 0 12px 12px}"
    +".card.dh-split>.dh-sentence-listen-row>.card-en{padding:0 !important;background:transparent !important;font-size:17px !important;line-height:1.3 !important}"
    +".card.dh-split>.card-tr{margin:2px 0 !important;font-size:14px !important}"
    +".card.dh-split>.card-pron,.card.dh-split>.card-ipa{font-size:11px !important;margin:0 !important}"
    +".card.dh-split .dh-gtr-btn{margin:2px 0 !important;padding:4px 6px !important;font-size:11px !important}"
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

  function youtubeSourceForCard(c){
    if(!c||!window.DHModul)return null;
    var en=c.querySelector(".card-en"),text=(en&&en.textContent||"").trim().toLocaleLowerCase("en");
    if(!text)return null;
    try{
      var list=DHModul.liste();
      for(var i=0;i<list.length;i++){
        var rows=DHModul.getir(list[i].id)||[];
        for(var j=0;j<rows.length;j++){
          var r=rows[j];
          if(r&&r.videoId&&String(r.en||"").trim().toLocaleLowerCase("en")===text)return r;
        }
      }
    }catch(e){}
    return null;
  }

  function ensureYoutubeSourceButton(c){
    var toggle=c&&c.querySelector("#dhModeToggle");
    if(!toggle)return;
    var wrap=c.querySelector(".dh-source-media-row");
    if(!wrap){wrap=document.createElement("div");wrap.className="dh-source-media-row";toggle.parentElement.insertBefore(wrap,toggle);wrap.appendChild(toggle);}
    var button=wrap.querySelector(".dh-youtube-source-btn");
    if(!button){button=document.createElement("button");button.type="button";button.className="dh-youtube-source-btn";button.textContent="▶ YouTube video";button.onclick=function(){var source=youtubeSourceForCard(card());if(!source)return;location.href="./youtube-egitim.html?video="+encodeURIComponent(source.videoId)+"&sentence="+encodeURIComponent(source.videoSentenceIndex||0)+"&t="+encodeURIComponent(source.videoStartSeconds||0)+"&loop=1";};wrap.appendChild(button);}
    var source=youtubeSourceForCard(c);button.hidden=!source;button.title=source?"Bu cümleyi kaynak YouTube videosunda aç":"";
  }

  /* 🌐 Translate + 🤖 AI'ye Sor + 📄 PDF İndir + 📚 Tümünü İndir Satırı */
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
      gtr.type="button"; gtr.className="dh-gtr-btn"; gtr.textContent="🌐 Translate";
      gtr.onclick=function(){
        var t=(en.textContent||"").trim(); if(!t) return;
        try{
          if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t);
        }catch(e){}
        window.open("https://translate.google.com/?sl=en&tl=tr&op=translate&text="+encodeURIComponent(t),"_blank");
      };

      var ai=document.createElement("button");
      ai.type="button"; ai.className="dh-gtr-btn dh-aiask-btn"; ai.textContent="🤖 AI'ye Sor";

      var aiModule=document.createElement("button");
      aiModule.type="button"; aiModule.className="dh-gtr-btn dh-ai-module-btn"; aiModule.textContent="💎 Tüm Modülü Gemini’ye Sor";
      aiModule.onclick=function(){ explainActiveModuleWithAI(); };

      var aiModuleRefresh=document.createElement("button");
      aiModuleRefresh.type="button"; aiModuleRefresh.className="dh-gtr-btn dh-ai-module-refresh-btn"; aiModuleRefresh.textContent="♻️ Modülü Baştan Açıkla";
      aiModuleRefresh.onclick=function(){ if(confirm("Aktif modülün tüm cümleleri kayıtlı olsalar bile tek toplu istekte yeniden hazırlansın mı? Eski açıklamalar yalnız ayrıntılı yeni cevap geldiğinde değiştirilecektir."))explainActiveModuleWithAI(true); };

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

      var pdf=document.createElement("button");
      pdf.type="button"; pdf.className="dh-gtr-btn dh-pdf-btn"; pdf.textContent="📄 PDF İndir";
      pdf.onclick=function(){ exportModuleToPDF(false); };

      var pdfAll=document.createElement("button");
      pdfAll.type="button"; pdfAll.className="dh-gtr-btn dh-pdf-all-btn"; pdfAll.textContent="📚 Tümünü PDF İndir";
      pdfAll.onclick=function(){ exportModuleToPDF(true); };

      row.appendChild(stu);
      row.appendChild(gtr);
      row.appendChild(ai);
      row.appendChild(aiModule);
      row.appendChild(aiModuleRefresh);
      row.appendChild(pdf);
      row.appendChild(pdfAll);
    }
    if(row.previousElementSibling!==anchor || row.parentElement!==anchor.parentElement){
      anchor.insertAdjacentElement("afterend", row);
    }
  }

  function realPrevBtn(){
    var nav=document.querySelector(".study-nav");
    return nav ? nav.querySelector("button.btn:not(.btn-primary)") : null;
  }
  function realNextBtn(){
    var nav=document.querySelector(".study-nav");
    return nav ? nav.querySelector("button.btn-primary") : null;
  }

  function gradeAnchor(c){
    return c.querySelector(".grade-bar") || c.querySelector(".grade-done") || c.querySelector(".card-meta");
  }
  function ensureListenAfterSentence(c){
    var en=c.querySelector(".card-en");if(!en)return;
    var listen=byText(c.querySelector(".card-actions"),"dinle");
    if(!listen)listen=c.querySelector(".dh-listen-after-sentence");
    if(!listen)return;
    listen.classList.add("dh-listen-after-sentence");
    var row=en.closest(".dh-sentence-listen-row");
    if(!row){
      row=document.createElement("div");
      row.className="dh-sentence-listen-row";
      en.parentElement.insertBefore(row,en);
      row.appendChild(en);
    }
    if(listen.parentElement!==row||listen.previousElementSibling!==en)row.appendChild(listen);
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
      anchor.insertAdjacentElement("afterend", trio);
    }
    var rp=realPrevBtn(), rn=realNextBtn();
    var pBtn=trio.querySelector(".dh-nav-prev"), nBtn=trio.querySelector(".dh-nav-next");
    if(pBtn) pBtn.disabled = !!(rp && rp.disabled);
    if(nBtn) nBtn.disabled = !!(rn && rn.disabled);
    return trio;
  }

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
      box.appendChild(mk("📄 Aktif Modülü PDF İndir",function(){ exportModuleToPDF(false); }));
      box.appendChild(mk("📚 TÜM Modülleri PDF İndir",function(){ exportModuleToPDF(true); }));
      var bulk=document.createElement("button");bulk.className="dh-pbtn";bulk.textContent="💎 Tüm Modülü Gemini’ye Sor";bulk.onclick=function(){box.classList.add("dh-hidden");explainActiveModuleWithAI();};box.appendChild(bulk);
      var refresh=document.createElement("button");refresh.className="dh-pbtn";refresh.textContent="♻️ Tüm Modülü Ayrıntılı Yenile";refresh.onclick=function(){box.classList.add("dh-hidden");if(confirm("Kayıtlı olanlar dahil tüm aktif modül tek istekte yeniden hazırlansın mı?"))explainActiveModuleWithAI(true);};box.appendChild(refresh);
      box.appendChild(mk("🔍 Detay",function(){ return byText(card(),"detay"); }));
      document.body.appendChild(box);
    }
    var grid=document.querySelector(".wd-tools-row");
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
      var nav=document.querySelector(".study-nav");
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
        if(!c.classList.contains("dh-split")) c.classList.add("dh-split");
        ensureListenAfterSentence(c);
        ensureNavTrio(c);
        var trio=document.getElementById("dhNavTrio");
        ensureAiRow(c, trio);
        ensureYoutubeSourceButton(c);
        checkAndSyncAiBox(c);
      }
      ensureTools();
      scheduleModuleAIStatusUI();
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

/* --- MODÜL AI DURUMU: açılış uyarısı + tamamlanan kart zemini --- */
var dhModuleAIStatusTimer=0,dhModuleAIStatusBusy=false,dhModuleSentenceStatusCache=null;
function scheduleModuleAIStatusUI(){clearTimeout(dhModuleAIStatusTimer);dhModuleAIStatusTimer=setTimeout(refreshModuleAIStatusUI,450);}
async function moduleStatusSentences(){if(dhModuleSentenceStatusCache)return dhModuleSentenceStatusCache;var all=[];try{var r=await fetch("./data/sentences.json");if(r.ok)all=await r.json();}catch(e){}if(!all.length&&window._sentencesCache)all=window._sentencesCache;dhModuleSentenceStatusCache=all||[];return dhModuleSentenceStatusCache;}
async function refreshModuleAIStatusUI(){
  if(dhModuleAIStatusBusy)return;dhModuleAIStatusBusy=true;
  try{
    var all=await moduleStatusSentences(),ai=await getAllAIExplanationsFromDB(),groups={};
    all.forEach(function(s){var k=normalizeModuleName(s.module);if(!k)return;(groups[k]||(groups[k]=[])).push(s);});
    var ready={};Object.keys(groups).forEach(function(k){ready[k]=groups[k].length>0&&groups[k].every(function(s){return !!ai[s.en];});});
    document.querySelectorAll(".dh-ai-ready-module-card").forEach(function(el){var marked=el.getAttribute("data-dh-ai-module")||"";if(!ready[marked]){el.classList.remove("dh-ai-ready-module-card");el.removeAttribute("data-dh-ai-module");var oldBadge=el.querySelector(":scope > .dh-ai-ready-badge");if(oldBadge)oldBadge.remove();}});
    /* Kartta cümle sayısı/ilerleme de bulunduğu için tam metin eşitliği kullanma.
       Gerçek React kartı .module-tile'dır; adını .module-name üzerinden eşleştir. */
    document.querySelectorAll("#root .module-tile").forEach(function(card){
      var nameEl=card.querySelector(".module-name"),name=normalizeModuleName(nameEl?nameEl.textContent:card.textContent),k="";
      if(ready[name])k=name;else Object.keys(ready).some(function(candidate){if(ready[candidate]&&(name.indexOf(candidate)>=0||candidate.indexOf(name)>=0)){k=candidate;return true;}return false;});
      if(!k)return;
      card.classList.add("dh-ai-ready-module-card");card.setAttribute("data-dh-ai-module",k);
      if(!card.querySelector(":scope > .dh-ai-ready-badge")){var badge=document.createElement("span");badge.className="dh-ai-ready-badge";badge.textContent="✓ AI açıklamaları hazır";card.appendChild(badge);}
    });
    var title=document.querySelector(".study-title"),sentence=document.querySelector(".card .card-en");
    if(title&&sentence){var name=(title.textContent||"").trim(),key=normalizeModuleName(name),list=groups[key]||[],missing=list.filter(function(s){return !ai[s.en];});if(list.length&&missing.length)showModuleAIWarningOnce(name,list.length,missing.length);}
  }catch(e){}finally{dhModuleAIStatusBusy=false;}
}
function showModuleAIWarningOnce(name,total,missing){
  var key="dh-module-ai-warning-v1:"+normalizeModuleName(name);try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"1");}catch(e){}
  if(document.getElementById("dhModuleAIWarning"))return;var o=document.createElement("div");o.id="dhModuleAIWarning";o.style.cssText="position:fixed;inset:0;z-index:1000003;background:#020617df;display:flex;align-items:center;justify-content:center;padding:16px";
  o.innerHTML='<div style="width:min(520px,100%);background:#0d1b32;color:#e8eef7;border:1px solid #f59e0b;border-radius:17px;padding:18px;box-shadow:0 20px 60px #0009"><h2 style="margin:0 0 10px;font-size:19px">💡 Modül açıklamaları eksik</h2><p style="line-height:1.6;color:#bfd0ea"><b>'+name+'</b> modülündeki '+total+' cümlenin <b>'+missing+' tanesi</b> için AI açıklaması bulunmuyor. Çalışmaya başlamadan önce tamamını tek istekte hazırlayabilirsiniz.</p><div style="display:flex;gap:9px;flex-wrap:wrap"><button data-a="later">Daha sonra</button><button data-a="now">💎 Şimdi açıklamaları al</button></div></div>';
  o.querySelectorAll("button").forEach(function(b){b.style.cssText="flex:1;min-width:150px;padding:11px;border:0;border-radius:9px;background:#334155;color:white;font-weight:900";});o.querySelector('[data-a="now"]').style.background="linear-gradient(135deg,#7c3aed,#2563eb)";o.querySelector('[data-a="later"]').onclick=function(){o.remove();};o.querySelector('[data-a="now"]').onclick=function(){o.remove();explainActiveModuleWithAI();};document.body.appendChild(o);
}

/* --- MARKDOWN PARSER (Gemini Kod Blokları ve Başlık Düzeltici) --- */
function parseMarkdownToHTML(markdown) {
  if (!markdown) return "";
  let html = markdown
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^#### (.*$)/gim, "<h4>$1</h4>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h3>$1</h3>")
    .replace(/^# (.*$)/gim, "<h3>$1</h3>")
    .replace(/^---$/gim, "<hr/>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^&gt; (.*$)/gim, "blockquote>$1</blockquote>")
    .replace(/^\s*\* (.*$)/gim, "<li>$1</li>")
    .replace(/^\s*- (.*$)/gim, "<li>$1</li>")
    .replace(/^\d+\.\s+(.*$)/gim, "<li>$1</li>");

  let lines = html.split("\n");
  let inList = false;
  let result = [];

  lines.forEach(line => {
    let trimmed = line.trim();
    if (trimmed.startsWith("<li>")) {
      if (!inList) { result.push("<ul>"); inList = true; }
      result.push(trimmed);
    } else {
      if (inList) { result.push("</ul>"); inList = false; }
      if (trimmed.startsWith("<h3>") || trimmed.startsWith("<h4>") || trimmed.startsWith("<hr/>") || trimmed.startsWith("<blockquote>")) {
        result.push(trimmed);
      } else if (trimmed.length > 0) {
        result.push("<p>" + trimmed + "</p>");
      }
    }
  });

  if (inList) result.push("</ul>");
  return result.join("");
}

/* --- AI'YE SOR & INDEXEDDB KÖPRÜSÜ --- */
var currentLoadedSentence = "";

function getAIFromDB(sentence) {
  return new Promise(function(resolve) {
    let req = indexedDB.open("DilHaritaAI_DB", 1);
    req.onupgradeneeded = function(e) {
      let db = e.target.result;
      if (!db.objectStoreNames.contains("ai_explanations")) {
        db.createObjectStore("ai_explanations", { keyPath: "sentence" });
      }
    };
    req.onsuccess = function(e) {
      let db = e.target.result;
      let tx = db.transaction(["ai_explanations"], "readonly");
      let store = tx.objectStore("ai_explanations");
      let getReq = store.get(sentence);
      getReq.onsuccess = function() { resolve(getReq.result ? getReq.result.explanation : null); };
      getReq.onerror = function() { resolve(null); };
    };
    req.onerror = function() { resolve(null); };
  });
}

function saveAIToDB(sentence, explanation) {
  return getAIFromDB(sentence).then(function(oldText){
    if(oldText&&oldText!==explanation)pushAIBackup(sentence,oldText);
    return new Promise(function(resolve) {
    let req = indexedDB.open("DilHaritaAI_DB", 1);
    req.onsuccess = function(e) {
      let db = e.target.result;
      let tx = db.transaction(["ai_explanations"], "readwrite");
      let store = tx.objectStore("ai_explanations");
      store.put({ sentence: sentence, explanation: explanation, deleted:false, timestamp: new Date().toISOString() });
      tx.oncomplete = function() { try{window.dispatchEvent(new CustomEvent("dh-ai-explanation-changed"));}catch(e){} resolve(true); };
    };
    });
  });
}

var AI_BACKUP_KEY="dh-ai-explanation-backups-v1";
function readAIBackups(){try{return JSON.parse(localStorage.getItem(AI_BACKUP_KEY)||"{}")||{};}catch(e){return {};}}
function pushAIBackup(sentence,text){if(!text)return;var all=readAIBackups(),list=all[sentence]||[];if(list[list.length-1]!==text)list.push(text);all[sentence]=list.slice(-5);try{localStorage.setItem(AI_BACKUP_KEY,JSON.stringify(all));}catch(e){}}
function popAIBackup(sentence){var all=readAIBackups(),list=all[sentence]||[],text=list.pop()||null;if(list.length)all[sentence]=list;else delete all[sentence];try{localStorage.setItem(AI_BACKUP_KEY,JSON.stringify(all));}catch(e){}return text;}
function deleteAIFromDB(sentence){return getAIFromDB(sentence).then(function(oldText){if(oldText)pushAIBackup(sentence,oldText);return new Promise(function(resolve){var req=indexedDB.open("DilHaritaAI_DB",1);req.onsuccess=function(e){var tx=e.target.result.transaction(["ai_explanations"],"readwrite");tx.objectStore("ai_explanations").put({sentence:sentence,explanation:"",deleted:true,timestamp:new Date().toISOString()});tx.oncomplete=function(){try{window.dispatchEvent(new CustomEvent("dh-ai-explanation-changed"));}catch(e){}resolve(true);};};req.onerror=function(){resolve(false);};});});}
async function restorePreviousAI(sentence){var old=popAIBackup(sentence);if(!old)return null;await saveAIToDB(sentence,old);return old;}

function getAllAIExplanationsFromDB() {
  return new Promise(function(resolve) {
    let req = indexedDB.open("DilHaritaAI_DB", 1);
    req.onsuccess = function(e) {
      let db = e.target.result;
      if (!db.objectStoreNames.contains("ai_explanations")) return resolve({});
      let tx = db.transaction(["ai_explanations"], "readonly");
      let store = tx.objectStore("ai_explanations");
      let cursorReq = store.openCursor();
      let map = {};
      cursorReq.onsuccess = function() {
        let cursor = cursorReq.result;
        if (cursor) {
          map[cursor.key] = cursor.value.explanation;
          cursor.continue();
        } else resolve(map);
      };
      cursorReq.onerror = function() { resolve({}); };
    };
    req.onerror = function() { resolve({}); };
  });
}

function normalizeModuleName(value){return String(value||"").toLowerCase().replace(/\s+/g," ").trim();}
function requestedModuleName(){try{return new URLSearchParams(location.search).get("mod")||"";}catch(e){return "";}}
async function activeModuleSentences(){
  var modName=requestedModuleName()||(document.querySelector(".study-title")&&document.querySelector(".study-title").textContent||"").trim();
  if(!modName)return [];
  var all=[];try{var res=await fetch("./data/sentences.json");if(res.ok)all=await res.json();}catch(e){}
  if(!all.length&&window._sentencesCache)all=window._sentencesCache;
  var key=normalizeModuleName(modName);
  return (all||[]).filter(function(s){return normalizeModuleName(s.module)===key;});
}
function bulkModal(title,body,busy){
  var old=document.getElementById("dhAiBulkModal");if(old)old.remove();var o=document.createElement("div");o.id="dhAiBulkModal";o.style.cssText="position:fixed;inset:0;z-index:1000001;background:#020617df;display:flex;align-items:center;justify-content:center;padding:16px";
  o.innerHTML='<div style="width:min(520px,100%);max-height:88vh;overflow:auto;background:#0d1b32;color:#e8eef7;border:1px solid #8b5cf6;border-radius:17px;padding:18px;box-shadow:0 20px 60px #0009"><h2 style="margin:0 0 10px;font-size:18px;color:#fff">'+title+'</h2><div style="line-height:1.6;color:#bfd0ea">'+body+'</div>'+(busy?'':'<button type="button" style="width:100%;margin-top:16px;padding:12px;border:0;border-radius:10px;background:#334155;color:#fff;font-weight:900">Kapat</button>')+'</div>';
  var b=o.querySelector("button");if(b)b.onclick=function(){o.remove();};document.body.appendChild(o);return o;
}
function isDetailedModuleExplanation(text){var t=String(text||""),low=t.toLocaleLowerCase("tr-TR");return t.length>=450&&low.indexOf("türkçe çeviri")>=0&&low.indexOf("dilbilgisi")>=0&&low.indexOf("önemli kelimeler")>=0&&low.indexOf("anlam nüansı")>=0&&low.indexOf("örnek")>=0;}
async function explainActiveModuleWithAI(forceAll){
  var sentences=await activeModuleSentences();if(!sentences.length){alert("Aktif modülün cümleleri bulunamadı.");return;}
  var cached=await getAllAIExplanationsFromDB(),missing=forceAll?sentences.slice():sentences.filter(function(s){return !cached[s.en];});
  if(!missing.length){bulkModal("♻️ Modül açıklamaları hazır","Bu modüldeki <b>"+sentences.length+" cümlenin tamamı</b> daha önce açıklanmış. Gemini’ye yeniden gönderilmedi.",false);var cur=document.querySelector(".card-en");if(cur&&cached[cur.textContent.trim()])renderResultBox(cur.textContent.trim(),cached[cur.textContent.trim()],"🤖 Modülün kayıtlı AI açıklaması");return;}
  if(!(window.DHProviders&&DHProviders.chat&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey())){alert("Profilde Gemini/AI yöntemini etkinleştirin.");return;}
  var waitingModal=bulkModal("💎 Modül AI’ye hazırlanıyor",forceAll?("Aktif modüldeki <b>"+sentences.length+" cümlenin tamamı</b>, kayıt durumuna bakılmadan tek ayrıntılı istekte yeniden gönderilecek. Kısa yanıtlar eski kayıtların üzerine yazılmayacak."):("Toplam "+sentences.length+" cümlenin "+cachedCount(sentences,cached)+" tanesi kayıtlı. Açıklaması bulunmayan <b>"+missing.length+" cümlenin tamamı tek istekte</b> gönderilecek. Yanıt bazı cümleleri atlarsa kaydedilenler korunur; sonraki çalıştırmada yalnız kalanlar gönderilir."),true);
  var payload=missing.map(function(s,i){return{n:i+1,en:s.en,tr:s.tr||""};});
  var sys="Bu istekte verilen "+missing.length+" İngilizce cümlenin TAMAMINI, hiçbir n değerini atlamadan tek JSON yanıtında açıkla. Öncelik bütün kayıtları tamamlamaktır. Her explanation 90-130 Türkçe kelime arasında, kompakt fakat öğretici olmalı. Her kayıtta şu beş Markdown başlığı zorunludur: **Türkçe çeviri**, **Dilbilgisi**, **Önemli kelimeler ve kalıplar**, **Anlam nüansı**, **Örnek**. Dilbilgisinde zaman/yapı formülünü ve neden kullanıldığını 2-3 cümleyle belirt. En önemli 2-4 kelime veya kalıbı Türkçeleştir. Anlam nüansını 1-2 cümleyle açıkla. Örnekte bir yeni İngilizce cümle ve Türkçe çevirisini aynı satırda ver. Aynı gramer bilgisini gereksiz yere tekrar ederek metni uzatma. İlk kayıttan son kayda kadar aynı biçimi ve yaklaşık aynı uzunluğu koru. Yanıtı erken bitirme; "+missing.length+" nesnenin tamamını üret. Yalnız geçerli JSON dizi döndür: [{\"n\":1,\"explanation\":\"Markdown açıklama\"}]. explanation içindeki bütün çift tırnakları JSON kuralına uygun biçimde \\\" ile kaçır. n değerini aynen koru; markdown kod bloğu kullanma.";
  try{
    /* Kopyala-yapıştır köprüsünün cevap alanını bekleme katmanı kapatmasın. */
    if(waitingModal&&waitingModal.parentNode)waitingModal.remove();
    var raw=await DHProviders.chat([{role:"system",content:sys},{role:"user",content:JSON.stringify(payload)}],{temperature:.2,max_tokens:Math.min(16000,Math.max(5000,missing.length*550)),json:true,title:"💎 "+missing.length+" modül cümlesinin tamamını tek seferde açıkla",cacheType:forceAll?"index-module-explanations-full-refresh-v4":"index-module-explanations-complete-v4",cacheInput:{refresh:!!forceAll,items:payload},forceRefresh:!!forceAll});
    var rows=(window.DHAIBulkJSON&&DHAIBulkJSON.parse)?DHAIBulkJSON.parse(raw):JSON.parse(String(raw||"")),saved=0,rejected=0;
    for(var i=0;i<rows.length;i++){var n=Number(rows[i]&&rows[i].n),text=String(rows[i]&&rows[i].explanation||"").trim();if(n>=1&&n<=missing.length&&text){if(!isDetailedModuleExplanation(text)){rejected++;continue;}await saveAIToDB(missing[n-1].en,text);saved++;}}
    var left=missing.length-saved;bulkModal("✅ Ayrıntılı modül açıklamaları işlendi","<b>"+saved+" ayrıntılı açıklama</b> kaydedildi."+(rejected?" <b>"+rejected+" kısa veya bölümleri eksik açıklama</b> kalite kontrolünden geçmedi ve eski kaydın üzerine yazılmadı.":"")+(left&&!forceAll?" Kalan <b>"+left+" cümle</b> sonraki çalıştırmada yeniden gönderilir.":left&&forceAll?" Baştan yenilemede tamamlanmayan "+left+" cümlenin eski açıklaması korundu.":" Modülün bütün açıklamaları hazır."),false);
    var current=document.querySelector(".card-en");if(current){var now=await getAIFromDB(current.textContent.trim());if(now)renderResultBox(current.textContent.trim(),now,"🤖 Toplu modül AI açıklaması");}
  }catch(e){bulkModal("⚠️ Toplu açıklama tamamlanamadı","Yanıt beklenen JSON biçiminde değildi veya işlem iptal edildi. Hiçbir mevcut kayıt silinmedi; tekrar denediğinizde yalnız eksik cümleler gönderilir.",false);}
}
function cachedCount(sentences,map){return sentences.filter(function(s){return !!map[s.en];}).length;}
window.explainActiveModuleWithAI=explainActiveModuleWithAI;

function renderResultBox(sentence, rawMarkdownText, tag) {
  let old = document.getElementById("dhAiResultBox");
  if (old) old.remove();

  let card = document.querySelector(".card");
  if (!card) return;

  let formattedHTML = parseMarkdownToHTML(rawMarkdownText);

  let box = document.createElement("div");
  box.id = "dhAiResultBox";
  box.dataset.sentence = sentence;
  box.style.cssText = "margin-top:16px;padding:16px;background:rgba(15,23,42,0.95);border-radius:14px;border:1px solid #3b82f6;color:#f1f5f9;grid-column:1 / -1;";
  box.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;"><span style="background:#10b981;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:800;">${tag}</span><button type="button" data-ai-action="renew">🔄 Yeniden hazırla</button><button type="button" data-ai-action="edit">✏️ Düzenle</button><button type="button" data-ai-action="delete">🗑️ Sil</button><button type="button" data-ai-action="restore">↩ Önceki</button></div><div class="dh-ai-result-content">` + formattedHTML + `</div>`;
  box.querySelectorAll("button[data-ai-action]").forEach(function(b){b.style.cssText="border:1px solid #475569;border-radius:7px;background:#17243a;color:#e5edf8;padding:5px 8px;font-size:11px;font-weight:800;cursor:pointer";});
  box.querySelector('[data-ai-action="edit"]').onclick=function(){showExplanationEditor(sentence,rawMarkdownText,"Açıklamayı düzenle");};
  box.querySelector('[data-ai-action="renew"]').onclick=function(){renewSingleExplanation(sentence,rawMarkdownText);};
  box.querySelector('[data-ai-action="delete"]').onclick=async function(){if(!confirm("Bu açıklama silinsin mi? Modül toplu işleminde yeniden eksik sayılacaktır."))return;await deleteAIFromDB(sentence);box.innerHTML='<div style="color:#fbbf24">Açıklama silindi. Bir sonraki toplu işlemde yalnız eksiklerle birlikte yeniden hazırlanacak.</div><button type="button" id="dhRestoreDeleted" style="margin-top:10px;padding:8px;border:0;border-radius:8px;background:#334155;color:white;font-weight:800">↩ Silmeyi geri al</button>';box.querySelector("#dhRestoreDeleted").onclick=async function(){var old=await restorePreviousAI(sentence);if(old)renderResultBox(sentence,old,"🤖 Önceki açıklama geri yüklendi");};};
  box.querySelector('[data-ai-action="restore"]').onclick=async function(){var old=popAIBackup(sentence);if(!old){alert("Bu cümle için önceki açıklama bulunmuyor.");return;}var current=await getAIFromDB(sentence);if(current)pushAIBackup(sentence,current);await saveAIToDB(sentence,old);renderResultBox(sentence,old,"🤖 Önceki açıklama geri yüklendi");};
  
  card.appendChild(box);
}

function showExplanationEditor(sentence,text,title){var old=document.getElementById("dhAiEditModal");if(old)old.remove();var m=document.createElement("div");m.id="dhAiEditModal";m.style.cssText="position:fixed;inset:0;z-index:1000002;background:#020617e8;display:flex;align-items:center;justify-content:center;padding:14px";m.innerHTML='<div style="width:min(720px,100%);background:#0f172a;border:1px solid #8b5cf6;border-radius:16px;padding:16px;color:white"><h3 style="margin:0 0 10px">'+title+'</h3><p style="font-size:12px;color:#94a3b8">Yeni metin kaydedilene kadar mevcut açıklama korunur.</p><textarea style="width:100%;height:50vh;box-sizing:border-box;background:#071225;color:white;border:1px solid #475569;border-radius:10px;padding:12px"></textarea><div style="display:flex;gap:8px;margin-top:10px"><button data-x="cancel">İptal</button><button data-x="save">Onayla ve değiştir</button></div></div>';document.body.appendChild(m);var ta=m.querySelector("textarea");ta.value=text||"";m.querySelectorAll("button").forEach(function(b){b.style.cssText="flex:1;padding:10px;border:0;border-radius:8px;background:#334155;color:white;font-weight:800";});m.querySelector('[data-x="save"]').style.background="#10b981";m.querySelector('[data-x="cancel"]').onclick=function(){m.remove();};m.querySelector('[data-x="save"]').onclick=async function(){var v=ta.value.trim();if(!v)return;await saveAIToDB(sentence,v);m.remove();renderResultBox(sentence,v,"🤖 Düzenlenmiş AI açıklaması");};ta.focus();}

async function renewSingleExplanation(sentence,current){if(!(window.DHProviders&&DHProviders.chat))return;var prompt="Aşağıdaki İngilizce cümleyi Türk öğrenci için 250-400 Türkçe kelimeyle çok ayrıntılı açıkla. Şu Markdown başlıklarının tamamını kullan: **Türkçe çeviri**, **Dilbilgisi**, **Önemli kelimeler ve kalıplar**, **Anlam nüansı**, **Örnek**. Ana/yan cümlecikleri, özne-fiil-nesneyi, formülü, kullanım nedenini ve yakın yapılardan farkını anlat. Yeni örneğin Türkçe çevirisini ekle. Cümle: "+sentence;try{var fresh=await DHProviders.chat([{role:"user",content:prompt}],{title:"🔄 Bu kaydı çok ayrıntılı yeniden hazırla",cacheType:"index-single-explanation-detailed-v3",cacheInput:{sentence:sentence},forceRefresh:true,max_tokens:2600});if(fresh)showExplanationEditor(sentence,String(fresh).trim(),"Yeni ayrıntılı açıklamayı önizle");}catch(e){alert("Yeni açıklama alınamadı; mevcut kayıt korunuyor.");}}

async function checkAndSyncAiBox(card) {
  let sentenceEl = card.querySelector(".card-en");
  let sentence = sentenceEl ? sentenceEl.innerText.trim() : "";
  
  if (sentence === currentLoadedSentence) return;
  currentLoadedSentence = sentence;

  let oldBox = document.getElementById("dhAiResultBox");
  if (oldBox) oldBox.remove();

  if (!sentence) return;

  let cached = await getAIFromDB(sentence);
  if (cached) {
    renderResultBox(sentence, cached, "🤖 AI Açıklaması (IndexedDB'den yüklendi)");
  }
}

function showPasteModal(sentence) {
  let old = document.getElementById("dhAiModal");
  if (old) old.remove();

  let modal = document.createElement("div");
  modal.id = "dhAiModal";
  modal.style.cssText = "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px;";
  modal.innerHTML = `
    <div style="width:100%;max-width:500px;background:#0f172a;border:2px solid #8b5cf6;border-radius:16px;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,0.8);color:#fff;font-family:sans-serif;">
      <div style="font-size:15px;color:#a78bfa;font-weight:800;margin-bottom:8px;">📋 Gemini Cevabını Yapıştırın</div>
      <p style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Gemini'den kopyaladığınız açıklamayı aşağıdaki kutuya yapıştırıp kaydedin.</p>
      <textarea id="dhAiTextarea" placeholder="Cevabı buraya yapıştırın (Ctrl+V)..." style="width:100%;height:120px;background:#1e293b;color:#fff;border:1px solid #475569;border-radius:8px;padding:10px;font-size:13px;resize:none;outline:none;box-sizing:border-box;"></textarea>
      <div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end;">
        <button id="dhAiCancel" style="padding:8px 16px;font-size:13px;background:#334155;color:#fff;border:none;border-radius:8px;cursor:pointer;">İptal</button>
        <button id="dhAiSave" style="padding:8px 18px;font-size:13px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:800;cursor:pointer;">Kaydet ve IndexedDB'ye Ekle</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("dhAiCancel").onclick = function() { modal.remove(); };
  document.getElementById("dhAiSave").onclick = async function() {
    let text = document.getElementById("dhAiTextarea").value.trim();
    if (text) {
      await saveAIToDB(sentence, text);
      modal.remove();
      renderResultBox(sentence, text, "🤖 AI Açıklaması (IndexedDB'ye kaydedildi)");
    }
  };
}

/* --- TÜM VEYA TEK MODÜL CÜMLELERİNİ PDF OLARAK DIŞA AKTARMA --- */
async function exportModuleToPDF(exportAllModules) {
  var modName = document.querySelector(".study-title")?.textContent || "Modül Cümleleri";
  if (exportAllModules) modName = "Tüm Modüller";

  var aiMap = await getAllAIExplanationsFromDB();
  var sentences = [];

  // Tüm cümleleri fetch et
  try {
    var res = await fetch("./data/sentences.json");
    if (res.ok) {
      var allData = await res.json();
      
      if (exportAllModules) {
        sentences = allData;
      } else {
        var keyMod = normalizeModuleName(requestedModuleName() || modName);
        sentences = allData.filter(function(s){
          return normalizeModuleName(s.module) === keyMod;
        });
      }
    }
  } catch(e){}

  if (!sentences.length && window._sentencesCache) {
    if (exportAllModules) {
      sentences = window._sentencesCache;
    } else {
      var key = normalizeModuleName(requestedModuleName() || modName);
      sentences = window._sentencesCache.filter(function(s){
        return normalizeModuleName(s.module) === key;
      });
    }
  }

  if (!sentences.length) {
    alert("Dışa aktarılacak cümle bulunamadı.");
    return;
  }

  // Cümleleri Modüllerine Göre Grupla
  var grouped = {};
  sentences.forEach(s => {
    var mName = s.module || "Genel";
    if (!grouped[mName]) grouped[mName] = [];
    grouped[mName].push(s);
  });

  var win = window.open("", "_blank");
  var html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${modName} - Çalışma Notları</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; line-height: 1.6; }
        h1 { color: #4338ca; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-size: 22px; margin-bottom: 24px; }
        h2.mod-title { color: #1e1b4b; background: #e0e7ff; padding: 8px 14px; border-radius: 6px; font-size: 16px; margin-top: 28px; margin-bottom: 14px; page-break-after: avoid; }
        .item { margin-bottom: 16px; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; page-break-inside: avoid; }
        .en { font-size: 15px; font-weight: 700; color: #1e293b; }
        .tr { font-size: 13.5px; color: #475569; margin-top: 4px; }
        .ai { margin-top: 10px; padding: 10px 12px; background: #f8fafc; border-left: 4px solid #8b5cf6; font-size: 12.5px; color: #334155; border-radius: 0 6px 6px 0; }
        .ai-tag { font-weight: 800; color: #6d28d9; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; }
        .ai h3, .ai h4 { font-size: 13.5px; font-weight: bold; margin: 8px 0 4px 0; color: #1e293b; }
        .ai code { background: #e2e8f0; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 12px; }
        .ai p { margin: 4px 0; }
        .ai ul { margin: 4px 0 8px 20px; padding: 0; }
      </style>
    </head>
    <body>
      <h1>${modName} — Ders ve AI Çalışma Notları (${sentences.length} Cümle)</h1>
      ${Object.keys(grouped).map(m => `
        <h2 class="mod-title">📌 ${m} (${grouped[m].length} Cümle)</h2>
        ${grouped[m].map((s, i) => `
          <div class="item">
            <div class="en">${i + 1}. ${s.en}</div>
            ${s.tr ? `<div class="tr"><b>TR:</b> ${s.tr}</div>` : ''}
            ${aiMap[s.en] ? `<div class="ai"><div class="ai-tag">🤖 AI Açıklaması</div>${parseMarkdownToHTML(aiMap[s.en])}</div>` : ''}
          </div>
        `).join('')}
      `).join('')}
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `;

  win.document.write(html);
  win.document.close();
}

document.addEventListener("click", async function(e) {
  let btn = e.target.closest(".dh-aiask-btn, .ai-sor-btn, button");
  if (!btn || !btn.textContent.includes("AI'ye Sor")) return;

  e.preventDefault();
  e.stopPropagation();

  let card = document.querySelector(".card");
  let sentenceEl = card ? card.querySelector(".card-en") : null;
  let sentence = sentenceEl ? sentenceEl.innerText.trim() : "";

  if (!sentence) return;

  let cached = await getAIFromDB(sentence);
  if (cached) {
    renderResultBox(sentence, cached, "🤖 AI Açıklaması (IndexedDB'den yüklendi)");
    return;
  }

  let prompt = `Lütfen şu İngilizce cümleyi detaylıca açıkla ve Türkçeye çevir: "${sentence}"`;
  try { navigator.clipboard.writeText(prompt); } catch(err) {}

  window.open(`https://gemini.google.com/app`, "_blank");
  showPasteModal(sentence);
}, true);
