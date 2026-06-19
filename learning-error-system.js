/* learning-error-system.js
   Kullanıcının yanlışlarından öğrenen ortak hata defteri.
   Practice, Video Practice, sohbet/teacher gibi tüm ekranlar buraya hata kaydedebilir.
*/
(function(){
"use strict";
const DB_NAME="sentence-learning-system";
const DB_VER=1;
const ERROR_STORE="errors";
const FALLBACK_KEY="learning-errors-v1";

function uid(){
  return "err_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);
}
function nowISO(){ return new Date().toISOString(); }
function clean(s){ return String(s||"").replace(/\s+/g," ").trim(); }
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
function normEN(s){
  return String(s||"")
    .toLowerCase()
    .replace(/[’]/g,"'")
    .replace(/[^a-z0-9'\s]/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function words(s){ return normEN(s).split(/\s+/).filter(Boolean); }

function openDB(){
  return new Promise((res,rej)=>{
    if(!("indexedDB" in window)) return rej(new Error("IndexedDB yok"));
    const r=indexedDB.open(DB_NAME,DB_VER);
    r.onupgradeneeded=()=>{
      const db=r.result;
      if(!db.objectStoreNames.contains(ERROR_STORE)){
        const st=db.createObjectStore(ERROR_STORE,{keyPath:"id"});
        st.createIndex("createdAt","createdAt");
        st.createIndex("sentenceId","sentenceId");
        st.createIndex("module","module");
        st.createIndex("primaryType","primaryType");
        st.createIndex("source","source");
      }
    };
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
  });
}
async function idbAdd(record){
  const db=await openDB();
  return await new Promise((res,rej)=>{
    const tx=db.transaction(ERROR_STORE,"readwrite");
    tx.objectStore(ERROR_STORE).put(record);
    tx.oncomplete=()=>res(true);
    tx.onerror=()=>rej(tx.error);
  });
}
async function idbAll(){
  const db=await openDB();
  return await new Promise((res,rej)=>{
    const rq=db.transaction(ERROR_STORE,"readonly").objectStore(ERROR_STORE).getAll();
    rq.onsuccess=()=>res(rq.result||[]);
    rq.onerror=()=>rej(rq.error);
  });
}
async function idbClear(){
  const db=await openDB();
  return await new Promise((res,rej)=>{
    const rq=db.transaction(ERROR_STORE,"readwrite").objectStore(ERROR_STORE).clear();
    rq.onsuccess=()=>res(true);
    rq.onerror=()=>rej(rq.error);
  });
}
function fbAll(){
  try{return JSON.parse(localStorage.getItem(FALLBACK_KEY)||"[]")}catch{return []}
}
function fbSave(arr){ try{localStorage.setItem(FALLBACK_KEY,JSON.stringify(arr));return true}catch{return false} }

async function add(record){
  record.id=record.id||uid();
  record.createdAt=record.createdAt||nowISO();
  record.updatedAt=nowISO();
  record.target=clean(record.target);
  record.answer=clean(record.answer);
  record.sentenceTR=clean(record.sentenceTR);
  record.module=clean(record.module);
  record.level=clean(record.level);
  record.grammar=clean(record.grammar || record.grammarStructure || record.pattern);
  record.source=record.source||"practice";
  record.score=Number(record.score||0);
  record.grade=record.grade||"hard";
  record.types=Array.isArray(record.types)&&record.types.length?record.types:detectTypes(record);
  record.primaryType=record.types[0]||"general";
  record.reviewPriority=priority(record);
  try{ await idbAdd(record); }
  catch(e){ const arr=fbAll(); arr.unshift(record); fbSave(arr.slice(0,2000)); }
  window.dispatchEvent(new CustomEvent("learning-error-added",{detail:record}));
  return record;
}
async function all(){
  let arr=[];
  try{arr=await idbAll();}catch{arr=fbAll();}
  return arr.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
}
async function clearAll(){
  try{await idbClear();}catch{}
  fbSave([]);
  window.dispatchEvent(new CustomEvent("learning-errors-cleared"));
}
function priority(r){
  const score=Number(r.score||0);
  if(r.grade==="hard" || score<55) return "high";
  if(r.grade==="good" || score<80) return "medium";
  return "low";
}
function detectTypes(r){
  const target=words(r.target);
  const answer=words(r.answer);
  const parts=Array.isArray(r.diffParts)?r.diffParts:[];
  const missing=parts.filter(p=>p.type==="missing").map(p=>normEN(p.word)).filter(Boolean);
  const extra=parts.filter(p=>p.type==="extra").map(p=>normEN(p.word)).filter(Boolean);
  const types=[];
  const grammar=normEN(r.grammar+" "+r.module+" "+r.pattern+" "+r.topic);
  const aux=["am","is","are","was","were","do","does","did","have","has","had","will","would","can","could","should","must"];
  const articles=["a","an","the"];
  const pronouns=["i","you","he","she","it","we","they","me","him","her","us","them","my","your","his","their","our"];
  if(missing.length) types.push("missing-word");
  if(extra.length) types.push("extra-word");
  if(missing.some(w=>aux.includes(w))) types.unshift("auxiliary-missing");
  if(extra.some(w=>aux.includes(w))) types.unshift("auxiliary-extra");
  if(missing.some(w=>articles.includes(w)) || extra.some(w=>articles.includes(w))) types.unshift("article");
  if(missing.some(w=>pronouns.includes(w)) || extra.some(w=>pronouns.includes(w))) types.unshift("pronoun");
  if(/past simple|did|was|were/.test(grammar)) types.push("past-simple");
  if(/present continuous|am is are|ing/.test(grammar)) types.push("present-continuous");
  if(/question|questions|\?/.test(grammar+" "+r.target)) types.push("question-order");
  if(r.source==="video" || r.mode==="voice") types.push("pronunciation");
  if(!types.length && Number(r.score||0)<80) types.push("sentence-accuracy");
  return [...new Set(types)];
}
function makePracticeRecord({sentence,answer,grade,score,layer,diff}){
  const s=sentence||{};
  const parts=(diff&&Array.isArray(diff.parts)?diff.parts:[]).map(p=>({type:p.type,word:p.word,heard:p.heard||""}));
  return {
    source:"practice",
    mode:layer||"",
    sentenceId:s.id||"",
    target:s.en||s.SentenceEN||"",
    answer:answer||"",
    sentenceTR:s.tr||s.SentenceTR||"",
    level:s.level||s.Level||"",
    module:s.module||s.Module||"",
    grammar:s.grammarStructure||s.GrammarStructure||s.pattern||s.Pattern||"",
    topic:s.topic||s.Topic||"",
    score:score||Math.round(((diff&&diff.ratio)||0)*100),
    grade:grade||"hard",
    diffParts:parts,
    commonMistake:s.commonMistake||"",
    aiExplain:s.aiExplain||""
  };
}
function makeVideoRecord({sentence,heard,grade,score,diff,mode}){
  const s=sentence||{};
  const parts=(diff&&Array.isArray(diff.parts)?diff.parts:[]).map(p=>({type:p.type,word:p.word,heard:p.heard||""}));
  return {
    source:"video",
    mode:mode||"voice",
    sentenceId:s.id||"",
    target:s.en||s.SentenceEN||"",
    answer:heard||"",
    sentenceTR:s.tr||s.SentenceTR||"",
    level:s.level||s.Level||"",
    module:s.module||s.Module||"",
    grammar:s.grammarStructure||s.GrammarStructure||s.pattern||s.Pattern||"",
    topic:s.topic||s.Topic||"",
    score:score||0,
    grade:grade||"hard",
    diffParts:parts
  };
}
async function logFromPractice(payload){
  try{
    const rec=makePracticeRecord(payload||{});
    if(rec.grade==="easy" && rec.score>=90) return null;
    return await add(rec);
  }catch(e){console.warn("Hata defteri kaydı yazılamadı:",e);return null;}
}
async function logFromVideo(payload){
  try{
    const rec=makeVideoRecord(payload||{});
    if(rec.grade==="easy" && rec.score>=90) return null;
    return await add(rec);
  }catch(e){console.warn("Video hata defteri kaydı yazılamadı:",e);return null;}
}
function summarize(records){
  const arr=records||[];
  const byType={}, byModule={}, bySentence={};
  for(const r of arr){
    (r.types||[r.primaryType||"general"]).forEach(t=>byType[t]=(byType[t]||0)+1);
    const m=r.module||"Modül yok"; byModule[m]=(byModule[m]||0)+1;
    const sid=r.sentenceId||r.target||r.id; bySentence[sid]=(bySentence[sid]||0)+1;
  }
  const top=(obj)=>Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,10);
  return {total:arr.length, high:arr.filter(r=>r.reviewPriority==="high").length, byType:top(byType), byModule:top(byModule), repeated:top(bySentence).filter(x=>x[1]>1)};
}

window.LearningErrorDB={add,all,clearAll,logFromPractice,logFromVideo,summarize,detectTypes,esc};
})();