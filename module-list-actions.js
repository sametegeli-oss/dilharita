/* module-list-actions.js — v71: cümleye git / Gemini / ses / sil */
(function(){
  "use strict";
  var ACTION_KEY="dh-module-list-action-v1";
  function norm(t){return String(t||"").toLocaleLowerCase("en").replace(/[^a-z0-9ğüşöçıi]+/g," ").trim();}
  function moduleName(){try{return new URLSearchParams(location.search).get("mod")||"";}catch(e){return "";}}
  function context(){
    var name=moduleName()||(document.querySelector(".study-title")&&document.querySelector(".study-title").textContent||"").trim(),entry=null,rows=[];
    try{if(window.DHModul){var items=DHModul.liste()||[];for(var i=0;i<items.length;i++)if(norm(items[i].ad)===norm(name)){entry=items[i];rows=DHModul.getir(entry.id)||[];break;}}}catch(e){}
    return{name:name,entry:entry,rows:rows};
  }
  function style(){
    if(document.getElementById("dh-module-list-css"))return;
    var s=document.createElement("style");s.id="dh-module-list-css";
    s.textContent=".dh-ml-overlay{position:fixed;inset:0;z-index:1000003;background:#020617ed;display:flex;align-items:center;justify-content:center;padding:14px;font-family:Nunito,system-ui,sans-serif}.dh-ml-panel{width:min(820px,100%);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;background:#071426;border:1px solid #294569;border-radius:18px;box-shadow:0 26px 80px #000b;color:#eaf2ff}.dh-ml-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #203955;background:#0a1930}.dh-ml-title{min-width:0}.dh-ml-title strong{display:block;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dh-ml-title span{display:block;margin-top:3px;color:#8fa8c8;font-size:12px}.dh-ml-close{width:42px;height:42px;flex:0 0 42px;border:1px solid #385579;border-radius:11px;background:#132641;color:white;font-size:24px;cursor:pointer}.dh-ml-list{overflow:auto;padding:10px}.dh-ml-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;margin:0 0 8px;padding:10px;border:1px solid #203a5a;border-radius:13px;background:#0b1a30;color:#eaf2ff;cursor:pointer}.dh-ml-row:hover,.dh-ml-row:focus-within{background:#102543;border-color:#3b82f6}.dh-ml-row.is-current{border-color:#34d399;background:#0b2c32}.dh-ml-no{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:#152a46;color:#9fc2eb;font-size:12px;font-weight:900}.dh-ml-copy{min-width:0}.dh-ml-en{display:block;font-size:14px;font-weight:900;line-height:1.35}.dh-ml-tr{display:block;margin-top:4px;color:#9eb1cc;font-size:12px;line-height:1.35}.dh-ml-actions{display:flex;gap:7px}.dh-ml-action{width:38px;height:38px;border:1px solid #385579;border-radius:10px;background:#142641;color:#dbeafe;font-size:17px;cursor:pointer}.dh-ml-action:hover{background:#234266}.dh-ml-action.has-ai{background:#14532d;border-color:#34d399;color:#d1fae5}.dh-ml-action.is-delete{color:#fecaca;border-color:#7f1d1d;background:#321521}@media(max-width:620px){.dh-ml-overlay{padding:0}.dh-ml-panel{height:100%;max-height:none;border:0;border-radius:0}.dh-ml-head{padding:12px}.dh-ml-list{padding:8px}.dh-ml-row{grid-template-columns:34px minmax(0,1fr)}.dh-ml-actions{grid-column:2;justify-content:flex-end}.dh-ml-action{width:42px}.dh-ml-tr{font-size:13px}}";
    document.head.appendChild(s);
  }
  function speak(row){
    if(!window.speechSynthesis)return alert("Bu tarayıcı seslendirmeyi desteklemiyor.");
    speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(String(row.en||""));u.lang="en-US";u.rate=.88;speechSynthesis.speak(u);
  }
  async function go(row,index,action){
    var c=context();if(!c.name)return;
    try{if(action)sessionStorage.setItem(ACTION_KEY,JSON.stringify({action:action,sentence:String(row.en||""),at:Date.now()}));else sessionStorage.removeItem(ACTION_KEY);}catch(e){}
    try{if(window.DHModul&&DHModul.konumAyarla)await DHModul.konumAyarla(c.name,index);}catch(e){}
    var url="./index-app.html?mod="+encodeURIComponent(c.name)+(row.id?"&target="+encodeURIComponent(row.id):"&q="+encodeURIComponent(row.en||""));location.href=url;
  }
  async function remove(row,index,overlay){
    var c=context();if(!c.entry||!confirm("Bu cümle modülden kalıcı olarak silinsin mi?"))return;
    var rows=c.rows.slice();rows.splice(index,1);if(!rows.length)return alert("Modülde en az bir cümle kalmalıdır.");rows.forEach(function(r,i){r.order=i+1;});
    var e=c.entry,res=DHModul.kaydet(rows,{id:e.id,modulAd:e.ad,alan:e.alan,seviye:e.level,kaynakModul:e.kaynakModul});
    if(!res||!res.ok)return alert(res&&res.hata||"Cümle silinemedi.");try{if(DHModul.yazmaBitti)await DHModul.yazmaBitti();}catch(err){}
    overlay.remove();var nextIndex=Math.min(index,rows.length-1);await go(rows[nextIndex],nextIndex,"");
  }
  async function officialRows(name){
    var all=[];try{var r=await fetch("./data/sentences.json");if(r.ok)all=await r.json();}catch(e){}if(!all.length&&window._sentencesCache)all=window._sentencesCache;
    return(all||[]).filter(function(x){return norm(x.module)===norm(name);});
  }
  async function openList(){
    var old=document.getElementById("dhModuleSentenceList");if(old)old.remove();var c=context();if(!c.rows.length)c.rows=await officialRows(c.name);if(!c.rows.length)return alert("Aktif modülün cümleleri bulunamadı.");
    style();var overlay=document.createElement("div");overlay.id="dhModuleSentenceList";overlay.className="dh-ml-overlay";var panel=document.createElement("section");panel.className="dh-ml-panel";panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-label","Modül cümleleri");
    var head=document.createElement("header");head.className="dh-ml-head";var title=document.createElement("div");title.className="dh-ml-title";var strong=document.createElement("strong"),note=document.createElement("span");strong.textContent=c.name||"Modül listesi";note.textContent=c.rows.length+" cümle · Cümleye gitmek için satıra dokunun";title.appendChild(strong);title.appendChild(note);var close=document.createElement("button");close.type="button";close.className="dh-ml-close";close.setAttribute("aria-label","Listeyi kapat");close.textContent="×";head.appendChild(title);head.appendChild(close);var list=document.createElement("div");list.className="dh-ml-list";panel.appendChild(head);panel.appendChild(list);overlay.appendChild(panel);document.body.appendChild(overlay);
    close.onclick=function(){overlay.remove();};overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};var cache={};try{cache=await getAllAIExplanationsFromDB();}catch(e){}var active=(document.querySelector(".card .card-en")||{}).textContent||"";
    c.rows.forEach(function(row,index){
      var item=document.createElement("div");item.className="dh-ml-row"+(norm(row.en)===norm(active)?" is-current":"");item.tabIndex=0;item.setAttribute("role","button");item.setAttribute("aria-label",(index+1)+". cümleye git");var no=document.createElement("span");no.className="dh-ml-no";no.textContent=String(index+1).padStart(2,"0");var copy=document.createElement("span");copy.className="dh-ml-copy";var en=document.createElement("span");en.className="dh-ml-en";en.textContent=row.en||"";copy.appendChild(en);if(row.tr){var tr=document.createElement("span");tr.className="dh-ml-tr";tr.textContent=row.tr;copy.appendChild(tr);}var actions=document.createElement("span");actions.className="dh-ml-actions";
      function button(label,icon,extra,fn){var b=document.createElement("button");b.type="button";b.className="dh-ml-action"+(extra?" "+extra:"");b.setAttribute("aria-label",label);b.title=label;b.textContent=icon;b.onclick=function(ev){ev.preventDefault();ev.stopPropagation();fn();};actions.appendChild(b);}
      button(cache[row.en]?"Kayıtlı Gemini açıklamasını aç":"Gemini ile açıkla","✦",cache[row.en]?"has-ai":"",function(){go(row,index,"gemini");});button("Cümleyi seslendir","🔊","",function(){speak(row);});if(c.entry)button("Cümleyi sil","🗑","is-delete",function(){remove(row,index,overlay);});item.appendChild(no);item.appendChild(copy);item.appendChild(actions);item.onclick=function(){go(row,index,"");};item.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();go(row,index,"");}};list.appendChild(item);
    });close.focus();
  }
  function resume(){
    var p=null;try{p=JSON.parse(sessionStorage.getItem(ACTION_KEY)||"null");}catch(e){}if(!p||p.action!=="gemini"||Date.now()-Number(p.at||0)>120000)return;
    var n=0,t=setInterval(function(){var el=document.querySelector(".card .card-en"),text=(el&&el.textContent||"").trim();if(norm(text)===norm(p.sentence)){clearInterval(t);try{sessionStorage.removeItem(ACTION_KEY);}catch(e){}if(window.requestModuleExplanation)window.requestModuleExplanation(text,false);else if(typeof requestModuleExplanation==="function")requestModuleExplanation(text,false);}else if(++n>80)clearInterval(t);},250);
  }
  document.addEventListener("click",function(e){var b=e.target&&e.target.closest&&e.target.closest("button,a");if(!b||!document.querySelector(".card")||(b.textContent||"").trim().toLocaleLowerCase("tr-TR")!=="liste")return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();openList();},true);
  document.addEventListener("keydown",function(e){if(e.key==="Escape"){var o=document.getElementById("dhModuleSentenceList");if(o)o.remove();}});if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",resume);else resume();
})();
