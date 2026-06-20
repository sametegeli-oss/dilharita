/* ai-teacher-prompt-tts.js
   AI Öğretmen + sohbetler için:
   - Kullanıcı promptu düzenler ve kaydeder.
   - Fetch tabanlı AI çağrılarında sistem promptuna eklenir.
   - Cevaplar Türkçe anlatım + İngilizce örnek formatına zorlanır.
   - Karma Türkçe/İngilizce metinleri ayrı dillerle okur.
*/
(function(){
"use strict";
if(window.__DHAIPromptTTSV1) return;
window.__DHAIPromptTTSV1 = true;

const DEFAULT_TEACHER_PROMPT = `Sen profesyonel bir İngilizce öğretmenisin.
Konuyu MUTLAKA Türkçe anlat.
İngilizce örnekleri ayrı satırlarda İngilizce ver.
Cevap düzeni:
TÜRKÇE AÇIKLAMA:
- Konuyu Türkçe açıkla.
ENGLISH PRACTICE:
- English example sentences
TÜRKÇE ÖZET:
- Kısa Türkçe özet ver.`;

function esc(s){return String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function key(){return "dh_ai_prompt_teacher";}
function getPrompt(){try{return localStorage.getItem(key()) || DEFAULT_TEACHER_PROMPT;}catch(e){return DEFAULT_TEACHER_PROMPT;}}
function savePrompt(v){try{localStorage.setItem(key(),v||"");}catch(e){}}
function mustRules(){
  return `

DEĞİŞMEZ KURAL:
- Kullanıcı promptu geçerlidir ve bundan sonraki sohbet ona göre devam eder.
- Konu anlatımı mutlaka Türkçe yapılır.
- İngilizce cümle/örnekler İngilizce kalır.
- Cevabı mümkünse TÜRKÇE AÇIKLAMA / ENGLISH PRACTICE / TÜRKÇE ÖZET başlıklarıyla ayır.`;
}
function isTurkishChunk(text){
  const s=String(text||"");
  if(/[ğüşöçıİĞÜŞÖÇ]/.test(s)) return true;
  if(/^\s*(TÜRKÇE|AÇIKLAMA|ÖZET|NOT|KURAL|YANLIŞ|DOĞRU)\b/i.test(s)) return true;
  if(/\b(konu|cümle|örnek|anlam|yapı|kural|kullanıcı|cevap|doğru|yanlış|şöyle|çünkü|fiil|özne|yüklem|Türkçe|anlat|açıkla)\b/i.test(s)) return true;
  return false;
}
function splitForSpeech(text){
  const raw=String(text||"").replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g," ");
  const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const chunks=[];
  lines.forEach(line=>{
    const lang=isTurkishChunk(line)?"tr-TR":"en-US";
    line.split(/(?<=[.!?])\s+/).filter(Boolean).forEach(p=>chunks.push({text:p,lang}));
  });
  return chunks.length?chunks:[{text:raw,lang:isTurkishChunk(raw)?"tr-TR":"en-US"}];
}
function speakMixed(text){
  if(window.DH_LongTTSAvatarSync && window.DH_LongTTSAvatarSync.speak){ return window.DH_LongTTSAvatarSync.speak(text); }
  try{
    speechSynthesis.cancel();
    const chunks=splitForSpeech(text);
    let i=0;
    function next(){
      if(i>=chunks.length)return;
      const c=chunks[i++];
      const u=new SpeechSynthesisUtterance(c.text);
      u.lang=c.lang;
      u.rate=c.lang==="tr-TR"?.96:.88;
      u.__dhMixed=true;
      u.onend=next;
      nativeSpeak.call(speechSynthesis,u);
    }
    next();
  }catch(e){}
}
window.DH_speakMixed = speakMixed;

/* Mevcut kod tek utterance ile karma metin okutursa otomatik iki dilli oku */
const nativeSpeak = speechSynthesis.speak.bind(speechSynthesis);
try{
  if(!speechSynthesis.__dhMixedPatched){
    speechSynthesis.__dhMixedPatched = true;
    speechSynthesis.speak = function(u){
      try{
        const text=String(u&&u.text||"");
        if(!u.__dhMixed && text.length>80 && (/[ğüşöçıİĞÜŞÖÇ]/.test(text) || /TÜRKÇE|ENGLISH|AÇIKLAMA|ÖZET/i.test(text))){
          speakMixed(text);
          return;
        }
      }catch(e){}
      return nativeSpeak(u);
    };
  }
}catch(e){}

/* Fetch ile giden AI mesajlarına kullanıcı promptunu ekle */
const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
if(nativeFetch && !window.fetch.__dhPromptPatched){
  const patched = async function(input, init){
    try{
      const url = typeof input==="string" ? input : (input && input.url) || "";
      const body = init && init.body;
      const isAI = /groq|openai|anthropic|gemini|openrouter|chat\/completions|generateContent/i.test(url) || (typeof body==="string" && /"messages"|"contents"/.test(body));
      if(isAI && typeof body==="string"){
        const data=JSON.parse(body);
        const add = getPrompt() + mustRules();
        if(Array.isArray(data.messages)){
          const sys=data.messages.find(m=>m.role==="system");
          if(sys) sys.content = add + "\n\n" + (sys.content||"");
          else data.messages.unshift({role:"system",content:add});
          init = Object.assign({}, init, {body:JSON.stringify(data)});
        } else if(Array.isArray(data.contents)){
          // Gemini tarzı: ilk kullanıcı mesajının başına ekle
          const first=data.contents[0];
          if(first && Array.isArray(first.parts)){
            first.parts.unshift({text:add});
            init = Object.assign({}, init, {body:JSON.stringify(data)});
          }
        }
      }
    }catch(e){}
    return nativeFetch(input, init);
  };
  patched.__dhPromptPatched = true;
  window.fetch = patched;
}

function addStyle(){
  if(document.getElementById("dhAiPromptStyle")) return;
  const st=document.createElement("style");
  st.id="dhAiPromptStyle";
  st.textContent=`
  #dhAiPromptBtn{position:fixed;right:14px;bottom:88px;z-index:999998;border:1px solid rgba(255,255,255,.18);background:#1d4ed8;color:white;border-radius:999px;padding:11px 14px;font:900 13px Nunito,system-ui,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.38)}
  #dhAiPromptPanel{position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.68);display:none;align-items:center;justify-content:center;padding:16px}
  #dhAiPromptPanel.active{display:flex}
  .dhp-box{width:min(760px,100%);max-height:88vh;overflow:auto;background:#0f172a;color:#e5eefb;border:1px solid rgba(255,255,255,.16);border-radius:22px;padding:16px;font-family:Nunito,system-ui,sans-serif}
  .dhp-box h2{margin:0 0 10px;font-size:20px}.dhp-box p{color:#93a4bd;font-size:13px;line-height:1.5}
  #dhAiPromptText{width:100%;min-height:270px;background:#081226;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:12px;font:800 13px Nunito,system-ui,sans-serif;line-height:1.5}
  .dhp-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.dhp-actions button{border:1px solid rgba(255,255,255,.14);border-radius:12px;background:#2563eb;color:#fff;padding:10px 13px;font-weight:900}
  .dhp-actions .gray{background:#334155}.dhp-actions .green{background:#16a34a}
  .dhReadMixedBtn{margin-left:6px;border:1px solid rgba(255,255,255,.14);background:#1d4ed8;color:#fff;border-radius:999px;padding:4px 8px;font:900 11px Nunito,system-ui,sans-serif;cursor:pointer}
  `;
  document.head.appendChild(st);
}
function createUI(){
  addStyle();
  if(!document.getElementById("dhAiPromptBtn")){
    const b=document.createElement("button");
    b.id="dhAiPromptBtn";
    b.textContent="⚙️ AI Prompt";
    b.onclick=()=>openPanel();
    document.body.appendChild(b);
  }
  if(!document.getElementById("dhAiPromptPanel")){
    const p=document.createElement("div");
    p.id="dhAiPromptPanel";
    p.innerHTML=`<div class="dhp-box">
      <h2>⚙️ AI Öğretmen / Sohbet Promptu</h2>
      <p>Bu prompt kaydedilince AI öğretmen ve sohbet cevapları bundan sonraki mesajlarda buna göre devam eder. Öğretmen Türkçe anlatır; İngilizce örnekler İngilizce kalır.</p>
      <textarea id="dhAiPromptText">${esc(getPrompt())}</textarea>
      <div class="dhp-actions">
        <button class="green" id="dhAiPromptSave">💾 Kaydet</button>
        <button class="gray" id="dhAiPromptReset">Varsayılana Dön</button>
        <button class="gray" id="dhAiPromptClose">Kapat</button>
      </div>
    </div>`;
    document.body.appendChild(p);
    p.onclick=e=>{if(e.target===p)p.classList.remove("active");};
    p.querySelector("#dhAiPromptSave").onclick=()=>{savePrompt(p.querySelector("#dhAiPromptText").value); alert("Prompt kaydedildi. Sohbet bundan sonra bu prompta göre devam eder.");};
    p.querySelector("#dhAiPromptReset").onclick=()=>{savePrompt(DEFAULT_TEACHER_PROMPT); p.querySelector("#dhAiPromptText").value=getPrompt();};
    p.querySelector("#dhAiPromptClose").onclick=()=>p.classList.remove("active");
  }
}
function openPanel(){
  createUI();
  const p=document.getElementById("dhAiPromptPanel");
  p.querySelector("#dhAiPromptText").value=getPrompt();
  p.classList.add("active");
}

/* Yeni AI mesajlarına iki dilli oku butonu ekle */
function addReadButtons(){
  const candidates=document.querySelectorAll(".wd-ai,.assistant,.bot,.ai-message,.teacher-message,[class*='assistant'],[class*='bot'],[class*='ai']");
  candidates.forEach(el=>{
    if(el.dataset.dhReadBtn==="1") return;
    const txt=(el.innerText||"").trim();
    if(txt.length<40) return;
    el.dataset.dhReadBtn="1";
    const btn=document.createElement("button");
    btn.className="dhReadMixedBtn";
    btn.textContent="🔊 TR/EN Oku";
    btn.onclick=(e)=>{e.stopPropagation(); speakMixed(el.innerText||"");};
    el.appendChild(btn);
  });
}
document.addEventListener("DOMContentLoaded",()=>{
  createUI();
  addReadButtons();
  try{new MutationObserver(()=>addReadButtons()).observe(document.body,{childList:true,subtree:true});}catch(e){}
});
window.addEventListener("load",()=>{createUI();addReadButtons();});
})();