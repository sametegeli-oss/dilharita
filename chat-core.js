(function(){
"use strict";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const KEYS_LS = "groqApiKeys";
const STT = window.SpeechRecognition || window.webkitSpeechRecognition;
const DEFAULT_SCENARIO = {
  title:"Otel",
  subtitle:"İngilizce konuşma",
  level:"A2",
  role:"a friendly hotel receptionist",
  voiceGender:"male",
  opener:"Hello, welcome to our hotel. Do you have a reservation?",
  systemExtra:"You are role-playing as a friendly hotel receptionist at the front desk.",
  avatarDir:"assets/avatars_v3/hotel/",
  frames:{
    idle:"idle.webp", blink:"blink.webp", listen:"listen.webp",
    mouthA:"mouth-a.webp", mouthE:"mouth-e.webp", mouthI:"mouth-i.webp",
    mouthO:"mouth-o.webp", mouthU:"mouth-u.webp", mouthMBP:"mouth-mbp.webp",
    mouthFV:"mouth-fv.webp", mouthL:"mouth-l.webp", mouthTH:"mouth-th.webp",
    mouthSmall:"mouth-i.webp", mouthMedium:"mouth-e.webp", mouthOpen:"mouth-a.webp"
  },
  backHref:"chat.html",
  noKeyReply:"I can continue when you add a Groq API key. What would you like to practice?"
};
const Scenario = Object.assign({}, DEFAULT_SCENARIO, window.CHAT_SCENARIO || {});
Scenario.voiceGender = "male";
Scenario.frames = Object.assign({}, DEFAULT_SCENARIO.frames, (window.CHAT_SCENARIO && window.CHAT_SCENARIO.frames) || {});
const State = {
  level: localStorage.getItem("chat:level:" + safeId(Scenario.title + ":" + (Scenario.avatarDir||""))) || Scenario.level || "A2",
  currentPartner: Scenario.opener,
  busy:false,
  speaking:false,
  history:[]
};
function safeId(s){ return String(s||"scenario").toLowerCase().replace(/[^a-z0-9]+/g,"-"); }
function $(id){ return document.getElementById(id); }
function activeAvatarDir(){
  const isTeacher = /teacher|öğretmen|ogretmen/i.test((Scenario.title||"") + " " + (Scenario.role||""));
  const selected = localStorage.getItem("selectedTeacherAvatar") || "teacher1";
  if(isTeacher && /^assets\/avatars_v3\/teacher/i.test(Scenario.avatarDir || "assets/avatars_v3/teacher1/")){
    return "assets/avatars_v3/" + selected + "/";
  }
  return (Scenario.avatarDir || "");
}
function asset(file){ return activeAvatarDir() + file; }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function getKeys(){ try{ return (JSON.parse(localStorage.getItem(KEYS_LS)||"[]")||[]).filter(Boolean); }catch{return [];} }
function ensureStorageReady(){
  return new Promise(function(resolve){
    if(typeof window.__dhStorageReady==="undefined" || window.__dhStorageReady || getKeys().length){ resolve(); return; }
    var done=false; function go(){ if(done)return; done=true; resolve(); }
    window.addEventListener("dh-storage-ready", go, {once:true});
    setTimeout(go, 1500);
  });
}
function saveKey(k){ const keys=getKeys(); if(!keys.includes(k)) keys.push(k); localStorage.setItem(KEYS_LS, JSON.stringify(keys)); }
async function groqChat(messages){
  const keys=getKeys();
  if(!keys.length) throw {code:"no-key"};
  let lastErr=null;
  for(const key of keys){
    try{
      const res=await fetch(GROQ_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model:GROQ_MODEL,messages,temperature:.7,max_tokens:320})});
      if(res.status===401){lastErr={code:"bad-key"};continue;}
      if(res.status===429){lastErr={code:"rate"};continue;}
      if(!res.ok){lastErr={code:"http",status:res.status};continue;}
      const data=await res.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    }catch(e){ lastErr={code:"network"}; }
  }
  throw lastErr || {code:"unknown"};
}

class PhotoAvatar{
  constructor(img){
    this.img=img;
    this.frames={
      idle:asset(Scenario.frames.idle),
      blink:asset(Scenario.frames.blink),
      listen:asset(Scenario.frames.listen),
      a:asset(Scenario.frames.mouthA),
      e:asset(Scenario.frames.mouthE),
      i:asset(Scenario.frames.mouthI),
      o:asset(Scenario.frames.mouthO),
      u:asset(Scenario.frames.mouthU),
      mbp:asset(Scenario.frames.mouthMBP),
      fv:asset(Scenario.frames.mouthFV),
      l:asset(Scenario.frames.mouthL),
      th:asset(Scenario.frames.mouthTH)
    };
    this.blinkTimer=null;
    this.talkTimer=null;
    this.endTimer=null;
    this.isBlinking=false;
    this.talkSeq=[];
    this.talkIndex=0;
  }
  init(){
    this.img.onerror=()=>{ this.img.onerror=null; this.img.src=this.frames.idle; };
    this.show(this.frames.idle);
    this.preload();
    this.scheduleBlink(1000);
  }
  preload(){ Object.values(this.frames).forEach(src=>{ const im = new Image(); im.src=src; }); }
  show(url){ this.img.src=url; }
  scheduleBlink(delay){
    clearTimeout(this.blinkTimer);
    this.blinkTimer=setTimeout(()=>this.blink(), delay || (2100 + Math.random()*1900));
  }
  blink(){
    if(State.speaking){
      this.scheduleBlink(1200 + Math.random()*1200);
      return;
    }
    this.isBlinking=true;
    this.show(this.frames.blink);
    setTimeout(()=>{
      this.isBlinking=false;
      if(!State.speaking) this.show(this.frames.idle);
      this.scheduleBlink();
    }, 330);
  }
  frameForChar(ch, next){
    ch = (ch || "").toLowerCase();
    next = (next || "").toLowerCase();

    if(ch === "t" && next === "h") return this.frames.th;
    if(/[oö0]/.test(ch)) return this.frames.o;
    if(/[uüwq]/.test(ch)) return this.frames.u;
    if(/[a]/.test(ch)) return this.frames.a;
    if(/[e]/.test(ch)) return this.frames.e;
    if(/[iııy]/.test(ch)) return this.frames.i;
    if(/[mnbp]/.test(ch)) return this.frames.mbp;
    if(/[fv]/.test(ch)) return this.frames.fv;
    if(/[l]/.test(ch)) return this.frames.l;
    if(/[.,!?;:\s]/.test(ch)) return this.frames.idle;
    return this.frames.i;
  }
  buildSequenceFromText(text){
    const s = String(text || "");
    const seq = [];
    for(let idx=0; idx<s.length; idx++){
      const ch = s[idx];
      const next = s[idx+1] || "";
      const frame = this.frameForChar(ch, next);
      if(frame) seq.push(frame);
      if(ch.toLowerCase()==="t" && next.toLowerCase()==="h") idx++;
    }
    return seq.filter(Boolean);
  }
  speakText(text, duration){
    clearInterval(this.talkTimer);
    clearTimeout(this.endTimer);
    State.speaking=true;
    this.talkSeq = this.buildSequenceFromText(text);
    if(!this.talkSeq.length){
      this.talkSeq = [this.frames.i, this.frames.e, this.frames.a, this.frames.o, this.frames.u, this.frames.mbp, this.frames.idle];
    }
    this.talkIndex=0;
    this.talkTimer=setInterval(()=>{
      if(this.isBlinking) return;
      this.show(this.talkSeq[this.talkIndex % this.talkSeq.length]);
      this.talkIndex++;
    }, 105);
    this.endTimer=setTimeout(()=>this.stop(), Math.max(1000,duration||1800));
  }
  stop(){
    clearInterval(this.talkTimer);
    clearTimeout(this.endTimer);
    State.speaking=false;
    if(!this.isBlinking) this.show(this.frames.listen);
    setTimeout(()=>{ if(!State.speaking && !this.isBlinking) this.show(this.frames.idle); }, 260);
    this.scheduleBlink(1100);
  }
}

function buildUI(){
  const root=document.getElementById("chatApp") || document.body.appendChild(document.createElement("div"));
  root.innerHTML=`<div class="chat-shell"><div class="chat-top"><a class="back-btn" href="${Scenario.backHref||'chat.html'}">←</a><div class="chat-title-wrap"><div class="chat-title">${esc(Scenario.title)}</div><div class="chat-sub" id="subtitle">${esc(Scenario.subtitle)} · ${State.level}</div></div><button class="level-pill" id="levelBtn" type="button">${State.level}</button></div><div class="avatar-stage"><img id="avatarImg" alt="Fotoğraflı konuşan avatar"></div><div class="panel"><div class="chat-history" id="chatHistory"></div><div class="input-row"><div class="input-wrap"><textarea id="textIn" class="text-in" rows="1" placeholder="Yaz ya da 🎙 ile konuş..."></textarea></div><button class="icon-fab mic-btn" id="micBtn" type="button">🎙</button><button class="icon-fab send-btn" id="sendBtn" type="button">➤</button></div></div></div><div class="sheet" id="explainSheet"><div class="sheet-card"><h3>TR Açıkla</h3><p id="explainText">Yükleniyor...</p><div class="sheet-btns"><button class="sheet-btn primary" id="closeExplain">Kapat</button></div></div></div><div class="sheet" id="levelSheet"><div class="sheet-card"><h3>Seviye seç</h3><div class="sheet-btns"><button class="sheet-btn levelOpt" data-level="A1">A1</button><button class="sheet-btn levelOpt" data-level="A2">A2</button><button class="sheet-btn levelOpt" data-level="B1">B1</button><button class="sheet-btn levelOpt" data-level="B2">B2</button><button class="sheet-btn levelOpt" data-level="C1">C1</button></div><div class="sheet-btns"><button class="sheet-btn primary" id="closeLevel">Kapat</button></div></div></div><div class="sheet" id="keySheet"><div class="sheet-card"><h3>Groq API anahtarı</h3><p>Konuşma için Groq API anahtarını ekle. Birden fazla anahtar saklanabilir.</p><input id="keyInput" type="text" placeholder="gsk_..." autocomplete="off"><div class="sheet-btns"><button class="sheet-btn primary" id="saveKey">Kaydet</button><button class="sheet-btn" id="closeKey">Kapat</button></div><div class="note" id="keyNote">Anahtar bu tarayıcıda saklanır.</div></div></div>`;
}
function addBubble(role, text, options){
  const hist = $("chatHistory");
  const el = document.createElement("div");
  el.className = "bubble " + (role === "user" ? "user" : "assistant");
  if(options && options.typing){
    el.className = "bubble assistant typing";
    el.id = "typingBubble";
    el.textContent = "Düşünüyor...";
  }else{
    const t = document.createElement("div");
    t.className = "bubble-text";
    t.textContent = text;
    el.appendChild(t);
    if(role !== "user"){
      const actions = document.createElement("div");
      actions.className = "bubble-actions";
      const listen = document.createElement("button");
      listen.className = "bubble-btn";
      listen.type = "button";
      listen.textContent = "🔊 Dinle";
      listen.onclick = () => speakText(text);
      const tr = document.createElement("button");
      tr.className = "bubble-btn";
      tr.type = "button";
      tr.textContent = "TR Açıkla";
      tr.onclick = () => explainText(text);
      actions.appendChild(listen);
      actions.appendChild(tr);
      el.appendChild(actions);
    }
  }
  hist.appendChild(el);
  scrollHistory();
  return el;
}
function scrollHistory(){ const hist = $("chatHistory"); if(hist) hist.scrollTop = hist.scrollHeight; }
function removeTyping(){ const t = $("typingBubble"); if(t) t.remove(); }
function levelGuide(){
  return ({A1:"The user is beginner A1. Use very short and easy sentences.",A2:"The user is elementary A2. Use simple and common words.",B1:"The user is intermediate B1. Use natural but clear English.",B2:"The user is upper intermediate B2. Speak naturally but keep it concise.",C1:"The user is advanced C1. Use fluent natural English, still keep replies concise."})[State.level] || "Use clear natural English.";
}
function systemPrompt(){
  return [Scenario.systemExtra || ("You are role-playing as " + Scenario.role + "."), levelGuide(), "Always reply in English unless the user explicitly asks for Turkish.", "Keep replies short: 1 to 3 sentences.", "Ask a follow-up question to keep the conversation going.", "If the user makes a clear mistake, gently model the correct version without lecturing.", "No emojis."].join("\n");
}
function estimateDuration(text){ const n=Array.from(String(text||"")).length; return Math.max(1100, Math.min(12000, n * 82)); }

let cachedVoices = [];
function refreshVoices(){ cachedVoices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : []; }
if(typeof speechSynthesis !== "undefined"){
  refreshVoices();
  speechSynthesis.onvoiceschanged = refreshVoices;
}
function pickVoice(){
  refreshVoices();
  const voices = cachedVoices.filter(v => /^en/i.test(v.lang || ""));
  if(!voices.length) return null;
  const maleRe = /(male|david|mark|george|daniel|james|john|alex|fred|thomas|guy|brian|ryan|matthew|arthur|oliver)/i;
  let preferred = voices.filter(v => /en-US|en_GB|en-GB|en_US/i.test(v.lang || ""));
  if(!preferred.length) preferred = voices;
  return preferred.find(v => maleRe.test(v.name || "")) || preferred[0] || voices[0];
}

let avatar; let speechRun=0;
function speakText(text){
  text=String(text||"").trim();
  if(!text) return;
  const run=++speechRun;
  try{speechSynthesis.cancel();}catch(e){}
  const duration=estimateDuration(text);
  avatar.speakText(text, duration+300);
  try{
    const u=new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if(voice) u.voice = voice;
    u.lang = "en-US";          // sohbet HER ZAMAN İngilizce
    u.__dhMixed = true;        // karma-dil patch'ini atla (Türkçe okumayı engelle)
    u.rate = .96;
    u.pitch = .78;
    u.onend=()=>{if(run===speechRun) avatar.stop();};
    u.onerror=()=>{if(run===speechRun) avatar.stop();};
    speechSynthesis.speak(u);
  }catch(e){ setTimeout(()=>{ if(run===speechRun) avatar.stop(); }, duration); }
}
async function explainText(text){
  $("explainSheet").classList.add("open");
  $("explainText").textContent="Yükleniyor...";
  if(!getKeys().length){
    $("explainText").textContent="API anahtarı eklenmemiş. Bu bölümde normalde İngilizce cümlenin Türkçe anlamı ve kısa dil bilgisi açıklaması gösterilir.";
    return;
  }
  try{
    const reply=await groqChat([{role:"system", content:"You are a Turkish-speaking English teacher. Translate the sentence into Turkish and briefly explain key vocabulary or grammar. Maximum 3 short Turkish sentences."},{role:"user", content:text}]);
    $("explainText").textContent=reply || "Açıklama alınamadı.";
  }catch(e){ $("explainText").textContent="Açıklama alınamadı. API anahtarını kontrol et veya tekrar dene."; }
}
async function sendUser(){
  const input=$("textIn");
  const text=input.value.trim();
  if(!text || State.busy) return;
  State.busy=true;
  $("sendBtn").disabled=true;
  addBubble("user", text);
  input.value="";
  input.style.height="auto";
  addBubble("assistant", "", {typing:true});

  await ensureStorageReady();
  if(!getKeys().length){
    removeTyping();
    $("keySheet").classList.add("open");
    State.currentPartner=Scenario.noKeyReply;
    addBubble("assistant", State.currentPartner);
    speakText(State.currentPartner);
    State.busy=false;
    $("sendBtn").disabled=false;
    return;
  }
  try{
    State.history.push({role:"user",content:text});
    const messages=[{role:"system",content:systemPrompt()},{role:"assistant",content:Scenario.opener},...State.history.slice(-10)];
    const reply=await groqChat(messages);
    removeTyping();
    State.currentPartner=reply || "Could you please say that again?";
    State.history.push({role:"assistant",content:State.currentPartner});
    addBubble("assistant", State.currentPartner);
    speakText(State.currentPartner);
  }catch(e){
    removeTyping();
    let msg="Bir sorun oldu. Tekrar deneyelim.";
    if(e.code==="rate") msg="API limiti doldu. Biraz sonra tekrar dene.";
    else if(e.code==="bad-key") msg="API anahtarı geçersiz görünüyor.";
    else if(e.code==="network") msg="İnternet bağlantısı kontrol edilmeli.";
    State.currentPartner=msg;
    addBubble("assistant", msg);
  }finally{
    State.busy=false;
    $("sendBtn").disabled=false;
  }
}
function setupEvents(){
  $("closeExplain").onclick=()=>$("explainSheet").classList.remove("open");
  $("levelBtn").onclick=()=>$("levelSheet").classList.add("open");
  $("closeLevel").onclick=()=>$("levelSheet").classList.remove("open");
  document.querySelectorAll(".levelOpt").forEach(btn=>btn.onclick=()=>{
    State.level=btn.dataset.level;
    localStorage.setItem("chat:level:"+safeId(Scenario.title + ":" + (Scenario.avatarDir||"")), State.level);
    $("levelBtn").textContent=State.level;
    $("subtitle").textContent=Scenario.subtitle + " · " + State.level;
    $("levelSheet").classList.remove("open");
  });
  $("textIn").addEventListener("input",e=>{ e.target.style.height="auto"; e.target.style.height=Math.min(120,e.target.scrollHeight)+"px"; });
  $("textIn").addEventListener("keydown",e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendUser(); } });
  $("sendBtn").onclick=sendUser;
  if(STT){
    let rec=null,listening=false;
    $("micBtn").onclick=()=>{
      if(listening && rec){ rec.stop(); return; }
      rec=new STT();
      rec.lang="en-US";
      rec.interimResults=false;
      rec.maxAlternatives=1;
      rec.onstart=()=>{listening=true; $("micBtn").classList.add("listening");};
      rec.onerror=()=>{};
      rec.onresult=ev=>{ $("textIn").value=ev.results[0][0].transcript; $("textIn").dispatchEvent(new Event("input")); };
      rec.onend=()=>{ listening=false; $("micBtn").classList.remove("listening"); if($("textIn").value.trim()) sendUser(); };
      try{ rec.start(); }catch(e){}
    };
  }else{ $("micBtn").disabled=true; }
  $("closeKey").onclick=()=>$("keySheet").classList.remove("open");
  $("saveKey").onclick=()=>{
    const k=$("keyInput").value.trim();
    if(!k || !k.startsWith("gsk_")){
      $("keyNote").textContent="Anahtar gsk_ ile başlamalı.";
      $("keyNote").className="note bad";
      return;
    }
    saveKey(k);
    $("keyNote").textContent="Anahtar kaydedildi.";
    $("keyNote").className="note";
    $("keySheet").classList.remove("open");
  };
}
function boot(){
  buildUI();
  avatar=new PhotoAvatar($("avatarImg"));
  avatar.init();
  setupEvents();
  addBubble("assistant", State.currentPartner);
  setTimeout(()=>speakText(State.currentPartner), 450);
}
document.addEventListener("DOMContentLoaded", boot);
})();