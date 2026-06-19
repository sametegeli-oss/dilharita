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
  opener:"Hello, welcome to our hotel. Do you have a reservation?",
  systemExtra:"You are role-playing as a friendly hotel receptionist at the front desk.",
  avatarDir:"assets/avatars_v3/hotel/",
  frames:{idle:"idle.webp", blink:"blink.webp", mouthSmall:"mouth-small.webp", mouthMedium:"mouth-medium.webp", mouthOpen:"mouth-open.webp", listen:"listen.webp"},
  backHref:"chat.html",
  noKeyReply:"I can continue when you add a Groq API key. Would you like to check in or ask about a room?"
};
const Scenario = Object.assign({}, DEFAULT_SCENARIO, window.CHAT_SCENARIO || {});
Scenario.frames = Object.assign({}, DEFAULT_SCENARIO.frames, (window.CHAT_SCENARIO && window.CHAT_SCENARIO.frames) || {});
const State = {
  level: localStorage.getItem("chat:level:" + safeId(Scenario.title)) || Scenario.level || "A2",
  currentPartner: Scenario.opener,
  busy:false,
  speaking:false,
  history:[]
};
function safeId(s){ return String(s||"scenario").toLowerCase().replace(/[^a-z0-9]+/g,"-"); }
function $(id){ return document.getElementById(id); }
function asset(file){ return (Scenario.avatarDir || "") + file; }
function getKeys(){ try{ return (JSON.parse(localStorage.getItem(KEYS_LS)||"[]")||[]).filter(Boolean); }catch{return [];} }
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
      mouthSmall:asset(Scenario.frames.mouthSmall),
      mouthMedium:asset(Scenario.frames.mouthMedium),
      mouthOpen:asset(Scenario.frames.mouthOpen),
      listen:asset(Scenario.frames.listen)
    };
    this.blinkTimer=null;
    this.talkTimer=null;
    this.endTimer=null;
  }
  init(){
    this.img.onerror=()=>{ this.img.onerror=null; this.img.src=this.frames.idle; };
    this.show(this.frames.idle);
    this.scheduleBlink(1700);
  }
  show(url){ this.img.src=url; }
  scheduleBlink(delay){
    clearTimeout(this.blinkTimer);
    this.blinkTimer=setTimeout(()=>this.blink(), delay || (2600 + Math.random()*2800));
  }
  blink(){
    if(State.speaking){ this.scheduleBlink(1300 + Math.random()*1700); return; }
    this.show(this.frames.blink);
    setTimeout(()=>{ if(!State.speaking) this.show(this.frames.idle); this.scheduleBlink(); }, 150);
  }
  speak(duration){
    clearInterval(this.talkTimer);
    clearTimeout(this.endTimer);
    State.speaking=true;
    const seq=[this.frames.mouthSmall,this.frames.mouthMedium,this.frames.mouthOpen,this.frames.mouthMedium,this.frames.mouthSmall,this.frames.idle];
    let i=0;
    this.talkTimer=setInterval(()=>{ this.show(seq[i % seq.length]); i++; }, 115);
    this.endTimer=setTimeout(()=>this.stop(), Math.max(900,duration||1800));
  }
  stop(){
    clearInterval(this.talkTimer);
    clearTimeout(this.endTimer);
    State.speaking=false;
    this.show(this.frames.listen);
    setTimeout(()=>{ if(!State.speaking) this.show(this.frames.idle); }, 260);
    this.scheduleBlink(1700);
  }
}
function buildUI(){
  const root=document.getElementById("chatApp") || document.body.appendChild(document.createElement("div"));
  root.innerHTML=`<div class="chat-shell"><div class="chat-top"><a class="back-btn" href="${Scenario.backHref||'chat.html'}">←</a><div class="chat-title-wrap"><div class="chat-title">${Scenario.title}</div><div class="chat-sub" id="subtitle">${Scenario.subtitle} · ${State.level}</div></div><button class="level-pill" id="levelBtn" type="button">${State.level}</button></div><div class="avatar-stage"><img id="avatarImg" alt="Fotoğraflı konuşan avatar"></div><div class="panel"><div class="message-card"><div class="partner-text" id="partnerText">${State.currentPartner}</div><div class="user-text" id="userText"></div><div class="msg-actions"><button class="action-btn" type="button" id="listenBtn">🔊 Dinle</button><button class="action-btn" type="button" id="explainBtn">TR Açıkla</button></div></div><div class="input-row"><div class="input-wrap"><textarea class="text-in" id="textIn" rows="1" placeholder="Yaz ya da 🎙️ ile konuş..."></textarea></div><button class="icon-fab mic-btn" id="micBtn" type="button" title="Konuş">🎙️</button><button class="icon-fab send-btn" id="sendBtn" type="button" title="Gönder">➤</button></div></div><div class="bottom-nav"><div class="nav-item active"><span class="ico">💬</span>Pratik</div><div class="nav-item"><span class="ico">📚</span>Kelime</div><div class="nav-item"><span class="ico">📈</span>İlerleme</div><div class="nav-item"><span class="ico">👤</span>Profil</div></div></div><div class="sheet" id="explainSheet"><div class="sheet-card"><h3>Türkçe açıklama</h3><p id="explainText">Yükleniyor...</p><div class="sheet-btns"><button class="sheet-btn" id="closeExplain" type="button">Kapat</button></div></div></div><div class="sheet" id="levelSheet"><div class="sheet-card"><h3>Seviyeni seç</h3><p>Partner konuşma zorluğunu bu seviyeye göre ayarlar.</p><div class="sheet-btns">${["A1","A2","B1","B2","C1"].map(l=>`<button class="sheet-btn primary levelOpt" type="button" data-level="${l}">${l}</button>`).join("")}</div><div class="sheet-btns"><button class="sheet-btn" id="closeLevel" type="button">Kapat</button></div></div></div><div class="sheet" id="keySheet"><div class="sheet-card"><h3>Groq API anahtarı</h3><p>AI cevap üretmesi için Groq anahtarı gerekir. Anahtar cihazında saklanır.</p><input id="keyInput" type="text" placeholder="gsk_..." autocomplete="off" spellcheck="false"><div class="note" id="keyNote">Anahtar yoksa avatar ve Dinle düğmesi çalışır; AI cevap üretmez.</div><div class="sheet-btns"><button class="sheet-btn primary" id="saveKey" type="button">Kaydet</button><button class="sheet-btn" id="closeKey" type="button">Kapat</button></div></div></div>`;
}
function levelGuide(){
  return ({A1:"The user is beginner A1. Use very short and easy sentences.",A2:"The user is elementary A2. Use simple and common words.",B1:"The user is intermediate B1. Use natural but clear English.",B2:"The user is upper intermediate B2. Speak naturally but keep it concise.",C1:"The user is advanced C1. Use fluent natural English, still keep replies concise."})[State.level] || "Use clear natural English.";
}
function systemPrompt(){
  return [Scenario.systemExtra || ("You are role-playing as " + Scenario.role + "."), levelGuide(), "Always reply in English unless the user explicitly asks for Turkish.", "Keep replies short: 1 to 3 sentences.", "Ask a follow-up question to keep the conversation going.", "If the user makes a clear mistake, gently model the correct version without lecturing.", "No emojis."].join("\n");
}
function estimateDuration(text){ const n=Array.from(String(text||"")).length; return Math.max(1100, Math.min(12000, n * 82)); }
let avatar; let speechRun=0;
function speakText(text){
  text=String(text||"").trim();
  if(!text) return;
  const run=++speechRun;
  try{speechSynthesis.cancel();}catch(e){}
  const duration=estimateDuration(text);
  avatar.speak(duration+300);
  try{
    const u=new SpeechSynthesisUtterance(text);
    u.lang="en-US";
    u.rate=.96;
    u.onend=()=>{if(run===speechRun) avatar.stop();};
    u.onerror=()=>{if(run===speechRun) avatar.stop();};
    speechSynthesis.speak(u);
  }catch(e){ setTimeout(()=>{ if(run===speechRun) avatar.stop(); }, duration); }
}
async function explainCurrent(){
  $("explainSheet").classList.add("open");
  $("explainText").textContent="Yükleniyor...";
  if(!getKeys().length){
    $("explainText").textContent="API anahtarı eklenmemiş. Bu bölümde normalde İngilizce cümlenin Türkçe anlamı ve kısa dil bilgisi açıklaması gösterilir.";
    return;
  }
  try{
    const reply=await groqChat([{role:"system", content:"You are a Turkish-speaking English teacher. Translate the sentence into Turkish and briefly explain key vocabulary or grammar. Maximum 3 short Turkish sentences."},{role:"user", content:State.currentPartner}]);
    $("explainText").textContent=reply || "Açıklama alınamadı.";
  }catch(e){ $("explainText").textContent="Açıklama alınamadı. API anahtarını kontrol et veya tekrar dene."; }
}
async function sendUser(){
  const input=$("textIn");
  const text=input.value.trim();
  if(!text || State.busy) return;
  State.busy=true;
  $("sendBtn").disabled=true;
  $("userText").style.display="block";
  $("userText").textContent="Sen: " + text;
  $("partnerText").textContent="Düşünüyor...";
  input.value="";
  input.style.height="auto";
  if(!getKeys().length){
    $("keySheet").classList.add("open");
    State.currentPartner=Scenario.noKeyReply;
    $("partnerText").textContent=State.currentPartner;
    speakText(State.currentPartner);
    State.busy=false;
    $("sendBtn").disabled=false;
    return;
  }
  try{
    State.history.push({role:"user",content:text});
    const messages=[{role:"system",content:systemPrompt()},{role:"assistant",content:Scenario.opener},...State.history.slice(-8)];
    const reply=await groqChat(messages);
    State.currentPartner=reply || "Could you please say that again?";
    State.history.push({role:"assistant",content:State.currentPartner});
    $("partnerText").textContent=State.currentPartner;
    speakText(State.currentPartner);
  }catch(e){
    let msg="Bir sorun oldu. Tekrar deneyelim.";
    if(e.code==="rate") msg="API limiti doldu. Biraz sonra tekrar dene.";
    else if(e.code==="bad-key") msg="API anahtarı geçersiz görünüyor.";
    else if(e.code==="network") msg="İnternet bağlantısı kontrol edilmeli.";
    State.currentPartner=msg;
    $("partnerText").textContent=msg;
  }finally{
    State.busy=false;
    $("sendBtn").disabled=false;
  }
}
function setupEvents(){
  $("listenBtn").onclick=()=>speakText(State.currentPartner);
  $("explainBtn").onclick=explainCurrent;
  $("closeExplain").onclick=()=>$("explainSheet").classList.remove("open");
  $("levelBtn").onclick=()=>$("levelSheet").classList.add("open");
  $("closeLevel").onclick=()=>$("levelSheet").classList.remove("open");
  document.querySelectorAll(".levelOpt").forEach(btn=>btn.onclick=()=>{
    State.level=btn.dataset.level;
    localStorage.setItem("chat:level:"+safeId(Scenario.title), State.level);
    $("levelBtn").textContent=State.level;
    $("subtitle").textContent=Scenario.subtitle + " · " + State.level;
    $("levelSheet").classList.remove("open");
  });
  $("textIn").addEventListener("input",e=>{ e.target.style.height="auto"; e.target.style.height=Math.min(160,e.target.scrollHeight)+"px"; });
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
  setTimeout(()=>speakText(State.currentPartner), 350);
}
document.addEventListener("DOMContentLoaded", boot);
})();