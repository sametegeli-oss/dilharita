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

/* ── YAZMADAN ÖNCE ELEME: zamir/kısaltma farkından ibaret "sahte hatalar"ın
   hata defterine hiç yazılmasını engelleyen güvenlik katmanı. */
const _CONTRACTIONS={"isn't":["is","not"],"aren't":["are","not"],"wasn't":["was","not"],"weren't":["were","not"],
  "don't":["do","not"],"doesn't":["does","not"],"didn't":["did","not"],"can't":["can","not"],"won't":["will","not"],
  "i'm":["i","am"],"you're":["you","are"],"he's":["he","is"],"she's":["she","is"],"it's":["it","is"],
  "we're":["we","are"],"they're":["they","are"],"i've":["i","have"],"i'll":["i","will"],"i'd":["i","would"]};
function _tokenize(s){ return (String(s||"").match(/[A-Za-z']+(?:-[A-Za-z']+)*|\d+/g) || []); }
function _norm(w){ return w.toLowerCase().replace(/[\u2019\u2018]/g,"'").replace(/[.,!?;:"()]/g,"").trim(); }
function _normSeq(text){ var out=[]; _tokenize(text).forEach(function(raw){ var n=_norm(raw); if(_CONTRACTIONS[n]) _CONTRACTIONS[n].forEach(function(x){out.push(x);}); else out.push(n); }); return out; }
const _PRONOUN_GROUPS=[["he","she","it"],["him","her","it"],["his","her","its"]];
function isFalsePositive(target, answer){
  if(!target || !answer) return false;
  var a=_normSeq(answer), b=_normSeq(target);
  if(a.length!==b.length) return false;
  for(var i=0;i<a.length;i++){
    if(a[i]===b[i]) continue;
    var grp=_PRONOUN_GROUPS.find(function(g){ return g.indexOf(a[i])>=0 && g.indexOf(b[i])>=0; });
    if(!grp) return false;
  }
  return true;
}

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

const __COMMON_EN=new Set(("a an the is am are was were be been has have had do does did done he she it we they you i "
  +"in on at of to for and or not no so if as by my his her its our your their this that these those will would can could may might").split(" "));
function __lev1(a,b){
  if(a===b) return true;
  var la=a.length, lb=b.length;
  if(Math.abs(la-lb)>1) return false;
  var i=0,j=0,edits=0;
  while(i<la&&j<lb){
    if(a[i]===b[j]){i++;j++;continue;}
    if(++edits>1) return false;
    if(la>lb) i++; else if(lb>la) j++; else {i++;j++;}
  }
  return edits+(la-i)+(lb-j)<=1;
}
/* "was→wad" gibi TEK HARFLİK yazım sürçmesi: tespit edilir ama DEFTERE İŞLENMEZ.
   Koşul: yalnız 1 kelime farklı + aradaki fark 1 harf + yazılan kelime gerçek bir
   sık kelime DEĞİL (was→has gerçek karıştırmadır, kaydedilir). */
function isTypoOnly(target, answer){
  try{
    var T=String(target||"").toLowerCase().replace(/[^a-z0-9' ]+/g," ").trim().split(/\s+/);
    var A=String(answer||"").toLowerCase().replace(/[^a-z0-9' ]+/g," ").trim().split(/\s+/);
    if(!T.length||T.length!==A.length) return false;
    var diff=[];
    for(var i=0;i<T.length;i++) if(T[i]!==A[i]) diff.push(i);
    if(diff.length!==1) return false;
    var t=T[diff[0]], a=A[diff[0]];
    if(t.length<3||a.length<2) return false;
    if(__COMMON_EN.has(a)) return false;
    return __lev1(t,a);
  }catch(e){ return false; }
}
async function add(record){
  if(isFalsePositive(record&&record.target, record&&record.answer)) return null;
  if(isTypoOnly(record&&record.target, record&&record.answer)) return null;   // yazım sürçmesi: hata değil
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
  /* TEKİLLEŞTİRME: aynı hedef cümle defterde varsa yeni kayıt AÇMA —
     mevcut kaydı güncelle (son yanlış cevap, tür birleşimi, sayaç+öncelik artar). */
  try{
    var __nt=String(record.target||"").toLowerCase().replace(/[^a-z0-9']+/g," ").trim();
    if(__nt){
      var __arr=await all();
      var __dup=__arr.find(function(r){ return String(r.target||"").toLowerCase().replace(/[^a-z0-9']+/g," ").trim()===__nt; });
      if(__dup){
        __dup.answer=record.answer||__dup.answer;
        __dup.sentenceTR=__dup.sentenceTR||record.sentenceTR;
        __dup.updatedAt=nowISO();
        __dup.count=(__dup.count||1)+1;
        __dup.types=Array.from(new Set((__dup.types||[]).concat(record.types||[])));
        __dup.primaryType=__dup.types[0]||__dup.primaryType||"general";
        __dup.reviewPriority=(__dup.reviewPriority||0)+1;
        try{ await idbAdd(__dup); }catch(e){ const a2=fbAll().filter(function(r){return r.id!==__dup.id;}); a2.unshift(__dup); fbSave(a2.slice(0,2000)); }
        window.dispatchEvent(new CustomEvent("learning-error-added",{detail:__dup}));
        return __dup;
      }
    }
  }catch(e){}
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
async function deleteMany(ids){
  var idSet={}; (ids||[]).forEach(function(id){ idSet[id]=1; });
  if(!Object.keys(idSet).length) return 0;
  var n=0;
  try{
    var db=await openDB();
    await new Promise(function(res){
      var tx=db.transaction(ERROR_STORE,"readwrite"), st=tx.objectStore(ERROR_STORE);
      Object.keys(idSet).forEach(function(id){ try{ st.delete(id); n++; }catch(e){} });
      tx.oncomplete=res; tx.onerror=res;
    });
  }catch(e){}
  try{ var arr=fbAll(); var kept=arr.filter(function(r){ return !idSet[r.id]; }); fbSave(kept); }catch(e){}
  return n;
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

// Senkron için: gelen kayıtları mevcutlarla birleştir (aynı id varsa atla).
// Buluttan gelen hata kayıtlarını yerel IndexedDB'ye ekler, kopya oluşturmaz.
async function bulkMerge(records){
  if(!Array.isArray(records) || !records.length) return 0;
  let existing=[];
  try{ existing=await idbAll(); }catch(e){ existing=fbAll(); }
  const haveIds=new Set(existing.map(r=>r&&r.id).filter(Boolean));
  let added=0;
  for(const rec of records){
    if(!rec || !rec.id) continue;
    if(haveIds.has(rec.id)) continue;
    try{ await idbAdd(rec); }
    catch(e){ const arr=fbAll(); arr.unshift(rec); fbSave(arr.slice(0,2000)); }
    haveIds.add(rec.id); added++;
  }
  if(added) window.dispatchEvent(new CustomEvent("learning-errors-merged",{detail:{added}}));
  return added;
}
const DAY_MS = 86400000;
function srsDefault(){ return { rep:0, interval:0, ef:2.5, last:0, due:0 }; }
// Bu fonksiyon practice.html/tekrar.html'deki SM-2 zamanlamasının BİREBİR aynısı —
// tüm site genelinde tutarlı bir aralıklı tekrar (SRS) ritmi sağlamak için.
function srsGrade(prev, grade){
  const n = Object.assign(srsDefault(), prev||{});
  const now = Date.now();
  if (grade === "hard"){
    n.rep = 0; n.interval = 0; n.ef = Math.max(1.3, n.ef - 0.2);
  } else {
    const q = grade === "easy" ? 5 : 4;
    n.ef = Math.max(1.3, n.ef + (0.1 - (5-q) * (0.08 + (5-q) * 0.02)));
    n.rep += 1;
    if (n.rep === 1)      n.interval = grade === "easy" ? 3 : 1;
    else if (n.rep === 2) n.interval = grade === "easy" ? 7 : 4;
    else                  n.interval = Math.round(n.interval * n.ef * (grade === "easy" ? 1.3 : 1));
  }
  n.last = now;
  n.due  = now + n.interval * DAY_MS;
  return n;
}

// 🆕 Bir hata kaydı gerçekten "çalışıldı" sayıldığında (akıllı tekrarda doğru
// cevaplandığında) skorunu/önceliğini VE bir sonraki gözden geçirme tarihini
// (SRS) kalıcı olarak günceller. "hard" (Tekrar) → hemen tekrar due; "easy"/"good"
// (Bildim) → SM-2 ladder'ına göre günler sonrasına ertelenir. Bu olmadan aynı
// kayıt her boot()'ta hep aynı filtreye takılıp sonsuza dek tekrar listesine düşüyordu.
async function markReviewed(id, opts){
  opts = opts || {};
  const grade = opts.grade || "easy";
  const boostScore = grade === "hard" ? null : Number(opts.score != null ? opts.score : 90);
  function applyPatch(rec){
    rec.srs = srsGrade(rec.srs, grade);
    if (boostScore != null) rec.score = Math.max(Number(rec.score||0), boostScore);
    rec.grade = grade;
    rec.reviewPriority = priority(rec);
    rec.lastReviewedAt = nowISO();
    rec.reviewCount = Number(rec.reviewCount||0) + (grade !== "hard" ? 1 : 0);
    rec.dueAt = rec.srs.due; // buildQueue'nun düz alan olarak kolayca okuyabilmesi için
    return rec;
  }
  let rec = null;
  try{
    const arr = await idbAll();
    const idx = arr.findIndex(r=>r&&r.id===id);
    if(idx<0) return null;
    rec = applyPatch(arr[idx]);
    await idbAdd(rec); // put => aynı id'yi (aynı kaydı) günceller, kopya oluşturmaz
  }catch(e){
    const arr = fbAll();
    const idx = arr.findIndex(r=>r&&r.id===id);
    if(idx<0) return null;
    rec = applyPatch(arr[idx]);
    arr[idx] = rec;
    fbSave(arr);
  }
  window.dispatchEvent(new CustomEvent("learning-error-updated",{detail:rec}));
  return rec;
}
/* GEÇMİŞ TEMİZLİĞİ (tek sefer): aynı hedef cümlenin eski kopyalarını birleştir */
setTimeout(async function dedupeOnce(){
  try{
    if(localStorage.getItem("dh-errdb-deduped-v1")) return;
    var arr=await all(); var seen={}, kill=[];
    arr.slice().reverse().forEach(function(r){       // eskiden yeniye: İLK kayıt kalır
      var k=String(r.target||"").toLowerCase().replace(/[^a-z0-9']+/g," ").trim();
      if(!k) return;
      if(seen[k]){ seen[k].count=(seen[k].count||1)+1; kill.push(r.id); }
      else seen[k]=r;
    });
    if(kill.length && typeof deleteMany==="function") await deleteMany(kill);
    localStorage.setItem("dh-errdb-deduped-v1","1");
  }catch(e){}
}, 2500);
window.LearningErrorDB={ isTypoOnly:isTypoOnly, add,all,deleteMany,clearAll,logFromPractice,logFromVideo,summarize,detectTypes,esc,bulkMerge,markReviewed};
})();