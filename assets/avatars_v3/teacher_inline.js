/* ============================================================
   teacher.html — Türkçe konuşan İngilizce öğretmeni paneli
   Cümleyi URL'den (?s=...&t=...) alır, Groq'a düzenlenebilir
   system prompt ile gönderir, açıklamadaki tırnak-içi İngilizceyi
   koyu yeşil gösterir. Groq anahtarı chat.html ile ortaktır.
   ============================================================ */
(function(){
"use strict";

/* ---------- Groq (chat.html ile ortak) ---------- */
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const KEYS_LS = "groqApiKeys";
function getKeys(){ try{ return (JSON.parse(localStorage.getItem(KEYS_LS)||"[]")||[]).filter(Boolean); }catch{ return []; } }
function saveKey(k){ const ks=getKeys(); if(!ks.includes(k)) ks.push(k); try{ localStorage.setItem(KEYS_LS, JSON.stringify(ks)); }catch{} }
let _ki=0;
async function groqChat(messages){
  const keys=getKeys();
  if(!keys.length) throw {code:"no-key"};
  let last=null;
  for(let n=0;n<keys.length;n++){
    const key=keys[(_ki+n)%keys.length];
    try{
      const res=await fetch(GROQ_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model:GROQ_MODEL,messages,temperature:0.5,max_tokens:1100})});
      if(res.status===401){ last={code:"bad-key"}; continue; }
      if(res.status===429){ last={code:"rate"}; continue; }
      if(!res.ok){ last={code:"http"}; continue; }
      const data=await res.json(); _ki=(_ki+n)%keys.length;
      return data.choices?.[0]?.message?.content?.trim()||"";
    }catch(e){ last={code:"network"}; }
  }
  throw last||{code:"unknown"};
}

/* ---------- varsayılan prompt (kullanıcı düzenleyebilir) ---------- */
const DEFAULT_PROMPT = `Sen Türkçe konuşan, deneyimli ve sabırlı bir İngilizce öğretmenisin. Sana bir İngilizce cümle ve Türkçe çevirisi verilecek. Görevin, bu cümleyi Türk bir öğrenciye derinlemesine öğretmek.

Açıklamanı şu başlıklarla, sade ve anlaşılır Türkçe ile yap:

1. Genel anlam: Cümlenin ne anlattığını ve hangi durumda kullanıldığını 1-2 cümleyle açıkla.
2. Cümle yapısı / gramer / kalıplar: Cümledeki dilbilgisi yapısını adım adım çöz (zaman, kip, cümle dizilişi). Neden böyle kurulduğunu açıkla.
3. Kelime kelime: Önemli kelimeleri tek tek ele al — anlamı, türü (isim/fiil/sıfat), varsa okunuşu ve dikkat edilmesi gereken noktalar.
4. Alternatifler: Aynı anlamı veren başka nasıl söylenebilir? Eş anlamlı kelimeler, alternatif kalıplar ya da daha resmi/günlük versiyonlar ver.
5. Sık yapılan hata: Türk öğrencilerin bu tür cümlede yaptığı yaygın bir hatayı ve doğrusunu belirt.

Kurallar:
- Tamamen Türkçe yaz (örnek İngilizce cümleler hariç).
- İngilizce kelime ve cümleleri çift tırnak içinde ver (örn. "I am happy"). Türkçe açıklamaları tırnaksız yaz.
- Başlıkları koru ama gereksiz uzatma; öğrenci sıkılmasın.
- Örnekleri bol ve günlük hayattan ver.
- Cesaretlendirici ve net bir dil kullan.`;

const PROMPT_LS = "teacherPrompt";
function getPrompt(){ try{ return localStorage.getItem(PROMPT_LS) || DEFAULT_PROMPT; }catch{ return DEFAULT_PROMPT; } }
function setPrompt(p){ try{ localStorage.setItem(PROMPT_LS, p); }catch{} }

/* ---------- TTS ---------- */
/* ---------- fotoğraflı teacher avatar + TTS ---------- */
const TEACHER_FRAMES = {
  idle:"idle.webp", blink:"blink.webp", listen:"listen.webp",
  a:"mouth-a.webp", e:"mouth-e.webp", i:"mouth-i.webp",
  o:"mouth-o.webp", u:"mouth-u.webp", mbp:"mouth-mbp.webp",
  fv:"mouth-fv.webp", l:"mouth-l.webp", th:"mouth-th.webp"
};
function teacherDir(){
  const selected = localStorage.getItem("selectedTeacherAvatar") || "teacher1";
  return "./assets/avatars_v3/" + selected + "/";
}
let TeacherAvatar = null;
class PhotoTeacherAvatar{
  constructor(){
    this.imgs=[];
    this.frames={};
    this.blinkTimer=null;
    this.talkTimer=null;
    this.endTimer=null;
    this.seq=[];
    this.idx=0;
    this.speaking=false;
  }
  mount(){
    this.imgs = ["teacherAvaImg","teacherHeroImg"].map(id=>document.getElementById(id)).filter(Boolean);
    const dir=teacherDir();
    for(const [k,v] of Object.entries(TEACHER_FRAMES)) this.frames[k]=dir+v;
    this.preload();
    this.show(this.frames.idle);
    this.scheduleBlink(1200);
  }
  preload(){ Object.values(this.frames).forEach(src=>{ const im=new Image(); im.src=src; }); }
  show(src){ this.imgs.forEach(img=>{ img.src=src; }); }
  scheduleBlink(delay){
    clearTimeout(this.blinkTimer);
    this.blinkTimer=setTimeout(()=>this.blink(), delay || (2400 + Math.random()*2200));
  }
  blink(){
    if(this.speaking){ this.scheduleBlink(1400); return; }
    this.show(this.frames.blink);
    setTimeout(()=>{ if(!this.speaking) this.show(this.frames.idle); this.scheduleBlink(); }, 330);
  }
  frameForChar(ch,next){
    ch=(ch||"").toLowerCase(); next=(next||"").toLowerCase();
    if(ch==="t" && next==="h") return this.frames.th;
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
  buildSeq(text){
    const s=String(text||"");
    const seq=[];
    for(let i=0;i<s.length;i++){
      const ch=s[i], next=s[i+1]||"";
      seq.push(this.frameForChar(ch,next));
      if(ch.toLowerCase()==="t" && next.toLowerCase()==="h") i++;
    }
    return seq.filter(Boolean);
  }
  speakText(text,duration){
    clearInterval(this.talkTimer); clearTimeout(this.endTimer);
    this.speaking=true;
    this.seq=this.buildSeq(text);
    if(!this.seq.length) this.seq=[this.frames.i,this.frames.e,this.frames.a,this.frames.o,this.frames.u,this.frames.mbp,this.frames.idle];
    this.idx=0;
    this.talkTimer=setInterval(()=>{ this.show(this.seq[this.idx % this.seq.length]); this.idx++; },105);
    this.endTimer=setTimeout(()=>this.stop(), Math.max(900,duration||1800));
  }
  stop(){
    clearInterval(this.talkTimer); clearTimeout(this.endTimer);
    this.speaking=false;
    this.show(this.frames.listen);
    setTimeout(()=>{ if(!this.speaking) this.show(this.frames.idle); },260);
    this.scheduleBlink(1200);
  }
}
function mountTeacherAvatar(){
  TeacherAvatar = new PhotoTeacherAvatar();
  TeacherAvatar.mount();
}
function estimateSpeechDuration(text){
  return Math.max(900, Math.min(18000, Array.from(String(text||"")).length * 92));
}
let _voiceCache=[];
function refreshVoices(){ try{ _voiceCache = speechSynthesis.getVoices ? speechSynthesis.getVoices() : []; }catch{ _voiceCache=[]; } }
try{ refreshVoices(); speechSynthesis.onvoiceschanged = refreshVoices; }catch{}
function pickMaleVoice(){
  refreshVoices();
  const voices=_voiceCache.filter(v=>/^en/i.test(v.lang||""));
  if(!voices.length) return null;
  const male=/(male|david|mark|george|daniel|james|john|alex|fred|thomas|guy|brian|ryan|matthew|arthur|oliver)/i;
  const pref=voices.filter(v=>/en-US|en_GB|en-GB|en_US/i.test(v.lang||""));
  return (pref.find(v=>male.test(v.name||"")) || pref[0] || voices[0]);
}
function speak(text){
  try{
    text=String(text||"");
    const u=new SpeechSynthesisUtterance(text);
    const voice=pickMaleVoice();
    if(voice) u.voice=voice;
    u.lang=voice ? voice.lang : "en-US";
    u.rate=0.95;
    u.pitch=0.78;
    speechSynthesis.cancel();
    if(TeacherAvatar) TeacherAvatar.speakText(text, estimateSpeechDuration(text));
    u.onend=()=>{ if(TeacherAvatar) TeacherAvatar.stop(); };
    u.onerror=()=>{ if(TeacherAvatar) TeacherAvatar.stop(); };
    speechSynthesis.speak(u);
  }catch{
    if(TeacherAvatar) TeacherAvatar.stop();
  }
}

/* ---------- yardımcılar ---------- */
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
// açıklamadaki tırnak-içi İngilizce -> koyu yeşil; **kalın** -> strong
function renderRich(text){
  let html = esc(text);
  // "....." -> yeşil (çift tırnak ya da düz/eğik tırnak)
  html = html.replace(/&quot;([^&]*?)&quot;/g, '<span class="en">$1</span>');
  html = html.replace(/[“”]([^“”]*?)[“”]/g, '<span class="en">$1</span>');
  // **kalın**
  html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  return html;
}

const root = document.getElementById("root");
const State = { en:"", tr:"", history:[] };

/* ---------- URL parametreleri ---------- */
function parseParams(){
  const p = new URLSearchParams(location.search);
  State.en = (p.get("s")||"").trim();
  State.tr = (p.get("t")||"").trim();
}

/* ============================================================
   EKRAN
   ============================================================ */
function render(){
  root.innerHTML = `
  <div class="top">
    <a href="./index.html" class="back" title="Geri">←</a>
    <div class="ava" title="Fotoğraflı öğretmen"><img id="teacherAvaImg" alt="Öğretmen avatarı"></div>
    <div class="tinfo"><h1>İngilizce Öğretmeni</h1><p>Türkçe anlatımlı İngilizce öğretmeni</p></div>
    <button class="prompt-btn" id="promptBtn">⚙ Prompt</button>
  </div>
  <div class="body">
    <div class="teacher-hero"><img class="teacher-photo" id="teacherHeroImg" alt="Fotoğraflı öğretmen avatarı"></div>
    <div class="subject">
      <div class="subject-en" id="subEn">${renderRich('"'+esc(State.en)+'"')}</div>
      ${State.tr ? `<div class="subject-tr">${esc(State.tr)}</div>` : ""}
      <button class="subject-play" id="playBtn">🔊 Dinle</button>
    </div>
    <div id="out"></div>
  </div>`;
  mountTeacherAvatar();
  document.getElementById("promptBtn").onclick = openPromptSheet;
  document.getElementById("playBtn").onclick = () => speak(State.en);
  explain();
}

function setOut(html){ document.getElementById("out").innerHTML = html; }

async function explain(){
  if (!State.en){ setOut(`<div class="state"><h2>Cümle yok</h2><p>Bu panel bir cümleyle açılır. Çalışma ekranındaki 🎓 Öğretmen düğmesini kullan.</p></div>`); return; }
  if (!getKeys().length){ openKeySheet(); setOut(""); return; }
  setOut(`<div class="loading"><div class="spinner"></div> Öğretmen cümleyi inceliyor…</div>`);
  const userMsg = `İngilizce cümle: "${State.en}"` + (State.tr ? `\nTürkçe çevirisi: ${State.tr}` : "");
  State.history = [{ role:"system", content:getPrompt() }, { role:"user", content:userMsg }];
  try{
    const reply = await groqChat(State.history);
    State.history.push({ role:"assistant", content:reply });
    renderExplanation(reply);
  }catch(e){ handleError(e); }
}

function renderExplanation(reply){
  setOut(`
    <div class="explain">${renderRich(reply)}</div>
    <div class="followup">
      <input id="fuInput" type="text" placeholder="Bir sorun mu var? Öğretmene sor…" />
      <button id="fuSend">Sor</button>
    </div>
    <button class="regen" id="regenBtn">↻ Yeniden açıkla</button>`);
  const fu = document.getElementById("fuInput");
  fu.onkeydown = e => { if (e.key==="Enter") askFollowup(fu.value); };
  document.getElementById("fuSend").onclick = () => askFollowup(fu.value);
  document.getElementById("regenBtn").onclick = () => explain();
}

async function askFollowup(q){
  q = (q||"").trim();
  if (!q) return;
  const out = document.getElementById("out");
  // mevcut açıklamanın altına soru + cevap alanı
  const qa = document.createElement("div");
  qa.innerHTML = `<div class="qa-q">❓ ${esc(q)}</div><div class="loading"><div class="spinner"></div> Yanıtlanıyor…</div>`;
  out.appendChild(qa);
  State.history.push({ role:"user", content:q });
  try{
    const reply = await groqChat(State.history);
    State.history.push({ role:"assistant", content:reply });
    qa.innerHTML = `<div class="qa-q">❓ ${esc(q)}</div><div class="explain">${renderRich(reply)}</div>`;
  }catch(e){
    qa.querySelector(".loading").outerHTML = `<div class="note bad">Yanıt alınamadı.</div>`;
    handleError(e, true);
  }
}

function handleError(e, silent){
  const code = e && e.code;
  if (code==="no-key" || code==="bad-key"){ openKeySheet(code==="bad-key"); if(!silent) setOut(""); return; }
  let msg="Bir sorun oluştu, tekrar dene.";
  if (code==="rate") msg="API limiti doldu. Biraz bekle.";
  else if (code==="network") msg="İnternet bağlantısı yok gibi görünüyor.";
  if (!silent) setOut(`<div class="state"><h2>Olmadı</h2><p>${msg}</p><button class="btn btn-primary" onclick="location.reload()">Tekrar dene</button></div>`);
}

/* ---------- prompt editörü ---------- */
function openPromptSheet(){
  const sheet=document.createElement("div"); sheet.className="sheet-overlay";
  sheet.innerHTML=`
    <div class="sheet">
      <h3>Öğretmen promptu</h3>
      <p>Yapay zekanın nasıl öğreteceğini buradan değiştirebilirsin. Değişiklik cihazında saklanır. İstediğinde varsayılana dönebilirsin.</p>
      <textarea id="promptArea">${esc(getPrompt())}</textarea>
      <div class="note" id="promptNote"></div>
      <button class="btn btn-primary" id="promptSave">Kaydet ve yeniden açıkla</button>
      <div class="row2">
        <button class="btn" id="promptReset">Varsayılana dön</button>
        <button class="btn" id="promptCancel">Kapat</button>
      </div>
    </div>`;
  document.body.appendChild(sheet);
  const close=()=>sheet.remove();
  sheet.onclick=e=>{ if(e.target===sheet) close(); };
  sheet.querySelector("#promptCancel").onclick=close;
  sheet.querySelector("#promptSave").onclick=()=>{
    const v=sheet.querySelector("#promptArea").value.trim();
    if(!v){ sheet.querySelector("#promptNote").textContent="Prompt boş olamaz."; sheet.querySelector("#promptNote").className="note bad"; return; }
    setPrompt(v); close(); explain();
  };
  sheet.querySelector("#promptReset").onclick=()=>{
    sheet.querySelector("#promptArea").value=DEFAULT_PROMPT;
  };
}

/* ---------- API anahtarı ---------- */
function openKeySheet(invalid){
  const sheet=document.createElement("div"); sheet.className="sheet-overlay";
  sheet.innerHTML=`
    <div class="sheet">
      <h3>Öğretmen için API anahtarı</h3>
      <p>Öğretmen, ücretsiz <b>Groq</b> yapay zekasını kullanır. Kendi anahtarını bir kez gir; cihazında saklanır. <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a> adresinden ücretsiz alabilirsin.</p>
      <input id="keyInput" type="text" placeholder="gsk_..." autocomplete="off" spellcheck="false" />
      <div class="note ${invalid?"bad":""}" id="keyNote">${invalid?"Önceki anahtar geçersizdi.":""}</div>
      <button class="btn btn-primary" id="keySave">Kaydet ve başla</button>
      <button class="btn" id="keyCancel">Vazgeç</button>
    </div>`;
  document.body.appendChild(sheet);
  const close=()=>sheet.remove();
  sheet.onclick=e=>{ if(e.target===sheet) close(); };
  sheet.querySelector("#keyCancel").onclick=close;
  sheet.querySelector("#keyInput").focus();
  sheet.querySelector("#keySave").onclick=()=>{
    const k=sheet.querySelector("#keyInput").value.trim();
    if(!k||!k.startsWith("gsk_")){ sheet.querySelector("#keyNote").textContent="Anahtar 'gsk_' ile başlamalı."; sheet.querySelector("#keyNote").className="note bad"; return; }
    saveKey(k); close(); explain();
  };
}

/* ---------- başlat ---------- */
parseParams();
render();

})();
