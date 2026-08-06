/* index-app-layout.js — v13 TAŞIMASIZ / ÇÖKMESİZ / TEMİZLEMELİ SÜRÜM
   İLKE: React'in DOM düğümleri ASLA taşınmaz/silinmez.
   AI Açıklama kutusu cümle değiştiğinde otomatik temizlenir ve gizlenir.
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
    /* React'in Öğretmen/Zayıf butonları ana ekranda gizli — panelde proxy'leri var */
    +".card-actions .teacher-btn,.card-actions .extra-weak,button.teacher-btn,button.extra-weak{display:none !important}"
    +".extra-weak-btn,.sm-teacher-btn{display:none !important}"
    /* grade-bar her modda kompakt yatay */
    +".grade-bar{display:flex !important;gap:6px;align-items:stretch}"
    +".grade-bar .grade-label{display:none !important}"
    +".grade-bar .grade-btn{flex:1;min-height:38px;border-radius:10px;font-weight:800;font-size:13px}"
    /* GTR + AI'ye Sor */
    +".dh-ai-row{display:flex;gap:8px;margin:0 0 14px}"
    +".dh-ai-row .dh-gtr-btn{flex:1;margin:0;justify-content:center}"
    +".dh-gtr-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:#1a2942;color:#cfe0ff;font:800 13px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-gtr-btn:hover{background:#22344f}"
    +".dh-aiask-btn{background:linear-gradient(135deg,#7c3aed,#4338ca);border-color:#8b5cf6;color:#fff}"
    +".dh-aiask-btn:hover{background:linear-gradient(135deg,#8b4cf7,#4f46e0)}"
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
    +".card.dh-split>.dh-ai-row .dh-gtr-btn{font-size:11px !important;padding:5px 9px !important;min-height:31px}"
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
        }catch(e){}
        window.open("https://translate.google.com/?sl=en&tl=tr&op=translate&text="+encodeURIComponent(t),"_blank");
      };

      var ai=document.createElement("button");
      ai.type="button"; ai.className="dh-gtr-btn dh-aiask-btn"; ai.textContent="🤖 AI'ye Sor";

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
        ensureNavTrio(c);
        var trio=document.getElementById("dhNavTrio");
        ensureAiRow(c, trio);
        
        // Cümle değiştiyse eski AI açıklama kutusunu güncelle/temizle
        checkAndSyncAiBox(c);
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

/* --- AI'YE SOR, DİNAMİK TEMİZLEME & INDEXEDDB KÖPRÜSÜ --- */
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
  return new Promise(function(resolve) {
    let req = indexedDB.open("DilHaritaAI_DB", 1);
    req.onsuccess = function(e) {
      let db = e.target.result;
      let tx = db.transaction(["ai_explanations"], "readwrite");
      let store = tx.objectStore("ai_explanations");
      store.put({ sentence: sentence, explanation: explanation, timestamp: new Date().toISOString() });
      tx.oncomplete = function() { resolve(true); };
    };
  });
}

function renderResultBox(sentence, text, tag) {
  let old = document.getElementById("dhAiResultBox");
  if (old) old.remove();

  let card = document.querySelector(".card");
  if (!card) return;

  let box = document.createElement("div");
  box.id = "dhAiResultBox";
  box.dataset.sentence = sentence;
  box.style.cssText = "margin-top:14px;padding:14px;background:rgba(15,23,42,0.9);border-radius:12px;border:1px solid #3b82f6;color:#e2e8f0;font-size:13px;line-height:1.5;white-space:pre-wrap;grid-column:1 / -1;";
  box.innerHTML = `<div style="margin-bottom:8px;"><span style="background:#10b981;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:800;">${tag}</span></div>${text}`;
  
  card.appendChild(box);
}

// Cümle değiştiğinde eski AI kutusunu temizler veya bu cümle için önbellek varsa getirir
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