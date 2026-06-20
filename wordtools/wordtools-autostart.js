/* wordtools-autostart.js
   /dilharita/wordtools içindeki yerel WordMode kopyası için.
   Orijinal /word fonksiyonlarını çağırır. Yeni işlev uydurmaz.
*/
(function(){
"use strict";

function qs(name){
  try{return new URLSearchParams(location.search).get(name)}catch{return null}
}
function bridge(){
  try{return JSON.parse(localStorage.getItem("wm_bridge_sentence")||"{}")||{}}catch{return {}}
}
function clean(s){return String(s||"").replace(/\s+/g," ").trim();}
function ensureBridgeData(){
  const p = bridge();
  if(!p || !p.sentence) return;

  const list = [];
  list.push({
    word:p.word || ((p.sentence.match(/[A-Za-z']+/)||["sentence"])[0].toLowerCase()),
    tr:p.tr || p.translation || p.sentenceTr || "",
    translation:p.translation || p.tr || p.sentenceTr || "",
    sentence:p.sentence || "",
    sentenceTr:p.sentenceTr || p.tr || "",
    phonetic:p.phonetic || "",
    level:p.level || "A1",
    topic:p.topic || "Dil Harita",
    module:p.module || "Dil Harita"
  });

  const ws = (p.sentence.match(/[A-Za-z']+/g)||[]).slice(0,12);
  ws.forEach((w,i)=>{
    const low=w.toLowerCase();
    if(!list.some(x=>String(x.word||"").toLowerCase()===low)){
      list.push({
        word:low,
        tr:"",
        translation:"",
        sentence:p.sentence,
        sentenceTr:p.sentenceTr || p.tr || "",
        phonetic:"",
        level:p.level || "A1",
        topic:p.topic || "Dil Harita",
        module:p.module || "Dil Harita"
      });
    }
  });

  try{
    localStorage.setItem("lastFileData", JSON.stringify(list));
    localStorage.setItem("lastUploadedFile", JSON.stringify({
      name:"Dil Harita aktif cümle",
      size:JSON.stringify(list).length,
      wordCount:list.length,
      uploadDate:new Date().toISOString(),
      fileKey:"dilharita-active-sentence"
    }));
    ws.slice(0,10).forEach((w,i)=>{
      localStorage.setItem("toLearnWords_bridge_"+i, JSON.stringify({
        word:w.toLowerCase(),
        tr:"",
        translation:"",
        sentence:p.sentence,
        sentenceTr:p.sentenceTr || p.tr || "",
        phonetic:"",
        level:p.level || "A1",
        topic:p.topic || "Dil Harita"
      }));
    });
  }catch(e){}
}
function setInputHints(){
  const p=bridge();
  if(!p || !p.sentence) return;
  const combined = p.sentence + (p.sentenceTr ? "\n" + p.sentenceTr : "");
  const selectors=[
    "#sentInput","#askAIUser","#contextInput","#vcText",
    "textarea[placeholder*='cümle' i]","textarea[placeholder*='kelime' i]",
    "input[placeholder*='Kelime' i]","input[placeholder*='cümle' i]"
  ];
  selectors.forEach(sel=>{
    try{
      const el=document.querySelector(sel);
      if(el && !el.value){
        el.value=combined;
        el.dispatchEvent(new Event("input",{bubbles:true}));
        el.dispatchEvent(new Event("change",{bubbles:true}));
      }
    }catch(e){}
  });
}
function call(fnNames){
  for(const name of fnNames){
    try{
      if(typeof window[name]==="function"){
        window[name]();
        return true;
      }
    }catch(e){console.warn("[wordtools autostart]", name, e);}
  }
  return false;
}
function show(id){
  try{
    if(typeof window.showScreen==="function"){
      window.showScreen(id);
      return true;
    }
  }catch(e){}
  try{
    document.querySelectorAll(".screen").forEach(x=>{x.classList.remove("active");x.style.display="none";});
    const el=document.getElementById(id);
    if(el){el.classList.add("active");el.style.display="block";return true;}
  }catch(e){}
  return false;
}
function run(tool){
  ensureBridgeData();
  setInputHints();
  try{ if(typeof window.loadLastFile==="function") window.loadLastFile(); }catch(e){}
  setTimeout(setInputHints,200);

  if(tool==="conversation") return call(["openConversationSim"]) || show("sc-conversation");
  if(tool==="sentence") return show("sc-sent");
  if(tool==="shadow") return call(["openShadowMode"]) || show("sc-shadow");
  if(tool==="quiz") return show("sc-quiz");
  if(tool==="story") return call(["openStoryScreen"]) || show("sc-story");
  if(tool==="podcast") return call(["openPodcastScreen"]) || show("sc-podcast");
  if(tool==="visual") return call(["openWordVisual"]) || show("sc-visual");
}
function boot(){
  const tool = qs("wmTool");
  if(!tool) return;
  ensureBridgeData();
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    run(tool);
    if(tries>=10) clearInterval(timer);
  },350);
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
})();