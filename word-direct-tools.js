/* word-direct-tools.js
   /dilharita/index-app.html için bağımsız araç modülü.
   /word klasörüne gitmez, /word içine dosya yükletmez.
   Aktif fotoğraflı cümle kartından veri alır.
   Kapsam: 2 AI Test, 3 Hikaye, 4 Podcast, 5 Konuşma, 6 Cümle Yaz / Partner / Görsel.
*/
(function(){
"use strict";

const STYLE_ID = "word-direct-tools-style-v1";
let activeConv = [];

/* AI PROMPT + TÜRKÇE/İNGİLİZCE OKUMA YARDIMCILARI */
const WD_PROMPT_DEFAULTS = {
  teacher: `Sen profesyonel bir İngilizce öğretmenisin.
Konuyu MUTLAKA Türkçe anlat.
İngilizce örnekleri ayrı satırlarda ver.
Cevap düzeni:
TÜRKÇE AÇIKLAMA:
- Konuyu kısa ve net Türkçe açıkla.
ENGLISH PRACTICE:
- English example 1
- English example 2
TÜRKÇE ÖZET:
- Kullanıcının neyi öğrenmesi gerektiğini Türkçe söyle.`,
  conversation: `Sen sabırlı bir İngilizce konuşma partnerisin.
Kullanıcı İngilizce pratik yapacak.
Cevap kısa olsun.
Gerekirse Türkçe açıklamayı ayrı "TÜRKÇE NOT:" bölümünde ver.`,
  partner: `Sen doğal bir İngilizce mesajlaşma partnerisin.
Kullanıcıya İngilizce cevap ver.
Yanlış varsa kısa Türkçe düzeltme ekle.`,
  writing: `Sen Türkçe anlatan profesyonel bir İngilizce yazma öğretmenisin.
Önce Türkçe açıklama yap.
Sonra doğru İngilizce cümleyi ayrı satırda ver.`,
  quiz: `Sen Türkçe anlatan İngilizce test öğretmenisin.
Her yanlışta Türkçe açıklama ver.
İngilizce örnekleri ayrı satırda yaz.`,
  story: `Sen İngilizce öğretmek için kısa hikaye yazan bir öğretmensin.
Hikaye İngilizce olsun.
Önce Türkçe kısa açıklama ver, sonra İngilizce hikaye ver.`,
  podcast: `Sen İngilizce öğrenenler için podcast hazırlayan bir öğretmensin.
Önce konuyu Türkçe açıkla.
Sonra İngilizce podcast metnini ver.`,
  similar: `Sen Türkçe açıklama yapan İngilizce gramer öğretmenisin.
Aynı yapıda benzer İngilizce cümleler üret.
Her cümlenin altına Türkçe olarak yapıyı açıkla.`
};
function wdPromptKey(kind){ return "dh_ai_prompt_" + (kind || "teacher"); }
function wdGetPrompt(kind){
  try { return localStorage.getItem(wdPromptKey(kind)) || WD_PROMPT_DEFAULTS[kind] || WD_PROMPT_DEFAULTS.teacher; }
  catch(e){ return WD_PROMPT_DEFAULTS[kind] || WD_PROMPT_DEFAULTS.teacher; }
}
function wdSavePrompt(kind, val){
  try { localStorage.setItem(wdPromptKey(kind), val || ""); } catch(e){}
}
function wdResetPrompt(kind){
  wdSavePrompt(kind, WD_PROMPT_DEFAULTS[kind] || WD_PROMPT_DEFAULTS.teacher);
}
function wdPromptEditor(kind, title){
  const val = wdGetPrompt(kind);
  return `<details class="wd-promptbox">
    <summary>⚙️ Promptu Düzenle — ${esc(title || kind)}</summary>
    <textarea class="wd-textarea wdPromptInput" data-kind="${esc(kind)}">${esc(val)}</textarea>
    <div class="wd-actions">
      <button class="wd-btn green wdPromptSave" data-kind="${esc(kind)}">💾 Promptu Kaydet</button>
      <button class="wd-btn gray wdPromptReset" data-kind="${esc(kind)}">↩ Varsayılana Dön</button>
    </div>
    <div class="wd-note">Kaydedilen prompt bundan sonraki cevaplarda kullanılır; sohbet aynı prompta göre devam eder.</div>
  </details>`;
}
function wdBindPromptEditor(root){
  root.querySelectorAll(".wdPromptSave").forEach(btn=>{
    btn.onclick=()=>{
      const kind=btn.dataset.kind;
      const ta=root.querySelector(`.wdPromptInput[data-kind="${kind}"]`);
      wdSavePrompt(kind, ta ? ta.value : "");
      try{ alert("Prompt kaydedildi. Bundan sonraki cevaplar buna göre devam edecek."); }catch(e){}
    };
  });
  root.querySelectorAll(".wdPromptReset").forEach(btn=>{
    btn.onclick=()=>{
      const kind=btn.dataset.kind;
      wdResetPrompt(kind);
      const ta=root.querySelector(`.wdPromptInput[data-kind="${kind}"]`);
      if(ta) ta.value=wdGetPrompt(kind);
    };
  });
}
function isTurkishChunk(text){
  const s=String(text||"");
  if(/[ğüşöçıİĞÜŞÖÇ]/.test(s)) return true;
  if(/^\s*(TÜRKÇE|AÇIKLAMA|ÖZET|NOT|KURAL|YANLIŞ|DOĞRU)\b/i.test(s)) return true;
  if(/\b(konu|cümle|örnek|anlam|yapı|kural|kullanıcı|cevap|doğru|yanlış|şöyle|çünkü|fiil|özne|yüklem|Türkçe)\b/i.test(s)) return true;
  return false;
}
function wdSplitForSpeech(text){
  const raw=String(text||"").replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g," ");
  const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const chunks=[];
  lines.forEach(line=>{
    const lang = isTurkishChunk(line) ? "tr-TR" : "en-US";
    // Çok uzun satırı noktalardan böl.
    const pieces=line.split(/(?<=[.!?])\s+/).filter(Boolean);
    pieces.forEach(p=>chunks.push({text:p, lang}));
  });
  return chunks.length?chunks:[{text:raw, lang:isTurkishChunk(raw)?"tr-TR":"en-US"}];
}
function speakMixed(text){
  try{
    speechSynthesis.cancel();
    const chunks=wdSplitForSpeech(text);
    let i=0;
    function next(){
      if(i>=chunks.length) return;
      const c=chunks[i++];
      const u=new SpeechSynthesisUtterance(c.text);
      u.lang=c.lang;
      u.rate=c.lang==="tr-TR" ? .96 : .88;
      u.onend=next;
      speechSynthesis.speak(u);
    }
    next();
  }catch(e){ speak(text, "tr-TR", .9); }
}


function esc(s){return String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function clean(s){return String(s||"").replace(/\s+/g," ").trim();}
function lower(s){return clean(s).toLowerCase();}
function tokens(s){return clean(s).match(/[A-Za-z']+/g)||[];}
function pick(arr,n){return arr.slice().sort(()=>Math.random()-.5).slice(0,n);}
function addStyle(){
  if(document.getElementById(STYLE_ID)) return;
  const st=document.createElement("style");
  st.id=STYLE_ID;
  st.textContent=`
  .wd-tools-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px;padding:14px;border-radius:18px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.10)}
  .wd-tools-row button{min-height:62px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:#17233a;color:#eaf2ff;font:900 13px Nunito,system-ui,sans-serif;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px}
  .wd-tools-row button:hover{background:#22304f;transform:translateY(-1px)}
  .wd-tools-row button b{font-size:19px;line-height:1}
  .wd-tools-row .wd-gold{background:#3b2a09;border-color:#f59e0b66;color:#fde68a}
  .wd-tools-row .wd-blue{background:#12315f;border-color:#3b82f666;color:#bfdbfe}
  .wd-ov{position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
  .wd-panel{width:min(940px,100%);max-height:90vh;overflow:auto;background:#0f172a;color:#e8eef7;border:1px solid rgba(255,255,255,.14);border-radius:24px;box-shadow:0 28px 90px rgba(0,0,0,.55);font-family:Nunito,system-ui,sans-serif}
  .wd-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:10px;padding:14px 16px;background:rgba(15,23,42,.96);border-bottom:1px solid rgba(255,255,255,.10)}
  .wd-back,.wd-head button{border:1px solid rgba(255,255,255,.14);background:#1a2540;color:#fff;border-radius:12px;padding:9px 12px;font-weight:900;cursor:pointer}
  .wd-head h2{font-size:20px;margin:0;flex:1}
  .wd-body{padding:16px}
  .wd-card{background:#131c30;border:1px solid rgba(255,255,255,.10);border-radius:18px;padding:16px;margin-bottom:14px}
  .wd-title{font-weight:950;font-size:18px;margin-bottom:8px}.wd-sub{color:#93a4bd;font-size:13px;line-height:1.5}.wd-en{font-size:23px;font-weight:950;line-height:1.45;color:#fff}.wd-tr{margin-top:6px;color:#cbd5e1;font-size:16px;line-height:1.45}
  .wd-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.wd-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .wd-input,.wd-textarea,.wd-select{width:100%;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:#081226;color:#fff;padding:12px;font:800 14px Nunito,system-ui,sans-serif}
  .wd-textarea{min-height:110px;resize:vertical;line-height:1.5}
  .wd-btn{border:1px solid rgba(255,255,255,.14);background:#2563eb;color:#fff;border-radius:13px;padding:11px 14px;font-weight:950;cursor:pointer}
  .wd-btn.green{background:#16a34a}.wd-btn.orange{background:#d97706}.wd-btn.gray{background:#334155}.wd-btn.purple{background:#6d28d9}
  .wd-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.wd-list{display:flex;flex-direction:column;gap:9px}.wd-item{background:#081226;border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:12px;line-height:1.5}
  .wd-choices{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px}.wd-choice{text-align:left;border:1px solid rgba(255,255,255,.14);background:#17233a;color:#fff;border-radius:14px;padding:12px;font-weight:850;cursor:pointer}.wd-choice.ok{border-color:#22c55e;background:#064e3b}.wd-choice.bad{border-color:#ef4444;background:#4c1111}
  .wd-chat{display:flex;flex-direction:column;gap:10px;max-height:360px;overflow:auto;padding-right:4px}.wd-msg{max-width:84%;border-radius:16px;padding:11px 13px;line-height:1.5}.wd-user{align-self:flex-end;background:#2563eb}.wd-ai{align-self:flex-start;background:#17233a;border:1px solid rgba(255,255,255,.10)}
  .wd-note{font-size:12px;color:#93a4bd;margin-top:8px;line-height:1.45}.wd-small{font-size:12px;color:#93a4bd}.wd-imgprompt{white-space:pre-wrap;background:#081226;border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:12px;color:#dbeafe}
  .wd-promptbox{margin:12px 0;background:#081226;border:1px solid rgba(96,165,250,.35);border-radius:16px;padding:10px}.wd-promptbox summary{cursor:pointer;font-weight:950;color:#93c5fd}.wdPromptInput{margin-top:10px;min-height:150px;font-size:12px}
  @media(max-width:760px){.wd-tools-row{grid-template-columns:repeat(3,1fr);gap:8px;padding:10px}.wd-tools-row button{min-height:56px;font-size:12px}.wd-grid,.wd-grid3,.wd-choices{grid-template-columns:1fr}.wd-panel{max-height:94vh;border-radius:18px}.wd-body{padding:12px}.wd-en{font-size:19px}}
  `;
  document.head.appendChild(st);
}
function currentCard(){
  const cards=[...document.querySelectorAll(".card")];
  return cards.find(c=>c.querySelector(".card-en") && c.querySelector(".card-actions"));
}
function currentData(card=currentCard()){
  const en=clean(card?.querySelector(".card-en")?.innerText||"");
  const tr=clean(card?.querySelector(".card-tr")?.innerText||"");
  return {
    sentence:en,
    sentenceTr:tr,
    word:(tokens(en)[0]||"sentence").toLowerCase(),
    module:clean(document.querySelector(".study-title")?.innerText||""),
    level:clean(card?.querySelector(".chip-level")?.innerText||""),
    grammar:clean([...card?.querySelectorAll?.(".detail-row")||[]].map(r=>clean(r.innerText)).find(x=>/grammar|gramer|structure|yapı/i.test(x))||"")
  };
}
function panel(title, bodyHTML){
  const ov=document.createElement("div");
  ov.className="wd-ov";
  ov.innerHTML=`<div class="wd-panel"><div class="wd-head"><button class="wd-back">← Kapat</button><h2>${title}</h2></div><div class="wd-body">${bodyHTML}</div></div>`;
  ov.querySelector(".wd-back").onclick=()=>ov.remove();
  ov.onclick=e=>{if(e.target===ov) ov.remove();};
  document.body.appendChild(ov);
  return ov;
}
function sentenceBox(d){
  return `<div class="wd-card"><div class="wd-small">Aktif cümle</div><div class="wd-en">${esc(d.sentence)}</div>${d.sentenceTr?`<div class="wd-tr">${esc(d.sentenceTr)}</div>`:""}</div>`;
}
function speak(text,lang="en-US",rate=.9){
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang=lang; u.rate=rate; speechSynthesis.speak(u); }catch(e){}
}
function listen(cb){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){alert("Bu tarayıcıda konuşma tanıma yok. Chrome/Edge kullan.");return;}
  const r=new SR(); r.lang="en-US"; r.interimResults=false; r.maxAlternatives=1;
  r.onresult=e=>cb(e.results[0][0].transcript);
  try{r.start();}catch(e){}
}

/* API: varsa Groq anahtarıyla orijinaldeki gibi AI üretmeye çalışır, yoksa offline üretim yapar */
async function callAI(system,user,kind){
  const userEditablePrompt = wdGetPrompt(kind || "teacher");
  const mustRules = `

DEĞİŞMEZ KURAL:
- Kullanıcının kaydettiği prompta göre cevap ver.
- Konu anlatımı gerekiyorsa MUTLAKA Türkçe anlat.
- İngilizce örnekler ayrı satırlarda İngilizce kalmalı.
- Cevapta Türkçe ve İngilizce bölümleri mümkünse şu başlıklarla ayır:
TÜRKÇE AÇIKLAMA:
ENGLISH PRACTICE:
TÜRKÇE ÖZET:
`;
  system = userEditablePrompt + mustRules + "\n\nEK SİSTEM BAĞLAMI:\n" + (system || "");
  const keys=[];
  try{
    const apiKeys=JSON.parse(localStorage.getItem("apiKeys")||"{}");
    if(apiKeys.groq) keys.push(apiKeys.groq);
  }catch(e){}
  try{
    const g=localStorage.getItem("groq_api_key");
    if(g) keys.push(g);
  }catch(e){}
  try{
    const arr=JSON.parse(localStorage.getItem("groq_api_keys")||"[]");
    if(Array.isArray(arr)) keys.push(...arr);
  }catch(e){}
  const key=[...new Set(keys.filter(Boolean))][0];
  if(!key) return null;
  try{
    const model=localStorage.getItem("groq_model")||"llama-3.3-70b-versatile";
    const res=await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
      body:JSON.stringify({model,messages:[{role:"system",content:system},{role:"user",content:user}],temperature:.7,max_tokens:900})
    });
    if(!res.ok) throw new Error(await res.text());
    const j=await res.json();
    return j.choices?.[0]?.message?.content||"";
  }catch(e){
    console.warn("[wd] AI çalışmadı, offline cevap:",e);
    return null;
  }
}
function offlineStory(d){
  const w=tokens(d.sentence).slice(0,8).join(", ");
  return `Title: A Useful Sentence

Today, I learned an important English sentence: "${d.sentence}"

At first, I only understood the words: ${w || d.word}. Then I tried to use the sentence in a real situation. I imagined myself talking to another person and saying it naturally.

After repeating it a few times, the sentence became easier. Now I can remember both the meaning and the sound.

The most useful part is this: I do not only memorize the sentence. I learn when and how to use it.`;
}
function offlinePodcast(d){
  return `Hello listeners, welcome to today's English practice.

Our useful sentence today is: "${d.sentence}"

This sentence is important because it helps you speak more naturally. Listen to the rhythm. Try to repeat it slowly first, then a little faster.

Now let's understand the meaning. ${d.sentenceTr ? "In Turkish, it means: " + d.sentenceTr : "Try to understand it from the situation."}

Here is your practice task: say the sentence three times, then make one new sentence with the same pattern.

That's all for today. Keep practicing every day.`;
}

/* 2 — AI TEST */
function inferStructure(d){
  const s=lower(d.sentence);
  const explicit=clean(d.grammar||"");
  let name=explicit || "Aktif cümle kalıbı";
  let formula="Cümledeki ana kelime sırası";
  let focus="Aynı yapıyı farklı kelimelerle kurabilme";
  let rule="Cümlenin iskeletini koru, kelimeleri değiştirerek aynı yapıda yeni cümle kur.";
  if(/\b(have|has)\b\s+\w+/.test(s)){
    name="Present Perfect"; formula="have/has + V3"; focus="Geçmişte başlayıp şimdiyle bağlantılı durum"; rule="I/you/we/they için have, he/she/it için has kullanılır; fiil V3 olur.";
  } else if(/\b(am|is|are)\b\s+\w+ing\b/.test(s)){
    name="Present Continuous"; formula="am/is/are + V-ing"; focus="Şu anda devam eden eylem"; rule="Özneye göre am/is/are seçilir; fiile -ing eklenir.";
  } else if(/\b(was|were)\b\s+\w+ing\b/.test(s)){
    name="Past Continuous"; formula="was/were + V-ing"; focus="Geçmişte devam eden eylem"; rule="I/he/she/it için was, you/we/they için were kullanılır.";
  } else if(/\bwill\b/.test(s)){
    name="Future Simple"; formula="will + V1"; focus="Gelecek karar/tahmin"; rule="Will'den sonra fiilin yalın hâli gelir.";
  } else if(/\b(can|could|should|must|may|might)\b/.test(s)){
    name="Modal Verb"; formula="modal + V1"; focus="Yetenek, tavsiye, zorunluluk veya ihtimal"; rule="Modal fiilden sonra fiilin yalın hâli gelir.";
  } else if(/\b(did|didn't|was|were|went|came|saw|took|made|had|\w+ed)\b/.test(s)){
    name="Past Simple"; formula="V2 / did + V1"; focus="Geçmişte bitmiş eylem"; rule="Olumlu cümlede V2; soru/olumsuzda did + V1 kullanılır.";
  } else if(/\b(do|does|don't|doesn't|always|usually|often|every)\b/.test(s)){
    name="Present Simple"; formula="V1 / he-she-it + V-s"; focus="Rutinler ve genel doğrular"; rule="He/she/it ile olumlu cümlede fiile çoğu zaman -s gelir.";
  }
  return {name,formula,focus,rule};
}
function makeStructureQuestions(d, st){
  const words=tokens(d.sentence);
  const key=words.find(w=>/^(have|has|am|is|are|was|were|will|can|could|should|must|do|does|did)$/i.test(w)) || words[Math.max(0,Math.floor(words.length/2))] || d.word;
  const safeKey=key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const blank=d.sentence.replace(new RegExp("\\b"+safeKey+"\\b","i"),"_____");
  const auxList=["have","has","am","is","are","was","were","will","can","did","does","should","must"];
  const distractors=pick(auxList.filter(x=>lower(x)!==lower(key)),3);
  const shuffled=pick(words,words.length).join(" / ");
  let broken=d.sentence;
  if(st.name==="Present Perfect") broken=d.sentence.replace(/\b(have|has)\s+(\w+)/i,(m,a,b)=>a+" "+b.replace(/ed$/,""));
  else if(st.name==="Present Continuous") broken=d.sentence.replace(/\b(am|is|are)\s+(\w+)ing\b/i,"$1 $2");
  else if(st.name==="Future Simple") broken=d.sentence.replace(/\bwill\s+(\w+)\b/i,"will to $1");
  else if(st.name==="Modal Verb") broken=d.sentence.replace(/\b(can|could|should|must|may|might)\s+(\w+)\b/i,"$1 to $2");
  else if(st.name==="Present Simple") broken=d.sentence.replace(/\b(she|he|it)\s+(\w+)s\b/i,"$1 $2");
  if(broken===d.sentence) broken=d.sentence.replace(/\b(\w+)\b/,"$1 ___");
  return [
    {type:"choice", title:"1) Boşluk doldur", prompt:blank, answer:key, choices:pick([key,...distractors],4), explain:`Anahtar kelime: ${key}. Kalıp: ${st.formula}`},
    {type:"order", title:"2) Kelime sıralama", prompt:shuffled, answer:d.sentence, explain:`Aynı yapıda kelime sırası korunur: ${st.formula}`},
    {type:"translate", title:"3) Türkçeden İngilizceye", prompt:d.sentenceTr || "Bu cümlenin Türkçesinden aynı İngilizce yapıyı kur.", answer:d.sentence, explain:"Amaç birebir ezber değil, aynı gramer iskeletini kurmaktır."},
    {type:"correct", title:"4) Hatalı cümleyi düzelt", prompt:broken, answer:d.sentence, explain:`Düzeltirken yapıyı koru: ${st.formula}`},
    {type:"produce", title:"5) Yeni cümle üret", prompt:"Aynı yapıda yeni bir İngilizce cümle yaz.", answer:"Aynı yapı kullanılmışsa doğru kabul edilir.", explain:`Kendi cümlende şu kalıbı kullan: ${st.formula}`}
  ];
}
function similarityScore(a,b){
  const A=lower(a).replace(/[^a-z0-9'\s]/g," ").split(/\s+/).filter(Boolean);
  const B=lower(b).replace(/[^a-z0-9'\s]/g," ").split(/\s+/).filter(Boolean);
  if(!A.length||!B.length)return 0;
  let hit=0; const used=new Set();
  A.forEach(w=>{const i=B.findIndex((x,idx)=>!used.has(idx)&&x===w); if(i>=0){used.add(i);hit++;}});
  return Math.round((hit/Math.max(A.length,B.length))*100);
}
function structureHintScore(text, st){
  const s=lower(text);
  if(!s) return 0;
  if(st.name==="Present Perfect") return /\b(have|has)\b\s+\w+/.test(s)?75:25;
  if(st.name==="Present Continuous") return /\b(am|is|are)\b\s+\w+ing\b/.test(s)?80:25;
  if(st.name==="Past Continuous") return /\b(was|were)\b\s+\w+ing\b/.test(s)?80:25;
  if(st.name==="Future Simple") return /\bwill\b\s+\w+/.test(s)?80:25;
  if(st.name==="Modal Verb") return /\b(can|could|should|must|may|might)\b\s+\w+/.test(s)?80:25;
  if(st.name==="Past Simple") return /\b(did|was|were|went|came|saw|took|made|had|\w+ed)\b/.test(s)?65:30;
  return text.split(/\s+/).length>=3?60:20;
}
function openAITest(){
  const d=currentData();
  const st=inferStructure(d);
  const qs=makeStructureQuestions(d,st);
  let current=0, correct=0, answers=[], selected=null;
  const body=sentenceBox(d)+`
    ${wdPromptEditor("quiz","AI Test")}
    <div class="wd-card">
      <div class="wd-title">📝 Yapı Odaklı AI Test</div>
      <div class="wd-sub">Amaç tek cümleyi ezberletmek değil; aynı cümle yapısını 5 farklı alıştırmayla öğretmek.</div>
      <div class="wd-item" style="margin-top:12px">
        <b>Yapı:</b> ${esc(st.name)}<br>
        <b>Formül:</b> ${esc(st.formula)}<br>
        <b>Odak:</b> ${esc(st.focus)}<br>
        <b>Kural:</b> ${esc(st.rule)}
      </div>
    </div>
    <div class="wd-card">
      <div id="wdQuizStep"></div>
      <div id="wdQuizFeedback" class="wd-note"></div>
      <div class="wd-actions">
        <button class="wd-btn green" id="wdQuizCheck">Kontrol</button>
        <button class="wd-btn" id="wdQuizNext" style="display:none">Sonraki →</button>
      </div>
    </div>
    <div class="wd-card" id="wdQuizSummary" style="display:none"></div>`;
  const ov=panel("📝 AI Test — 5 Soru",body); wdBindPromptEditor(ov);
  const step=ov.querySelector("#wdQuizStep"), fb=ov.querySelector("#wdQuizFeedback"), summary=ov.querySelector("#wdQuizSummary");
  function render(){
    selected=null; fb.innerHTML="";
    const q=qs[current];
    ov.querySelector("#wdQuizNext").style.display="none";
    ov.querySelector("#wdQuizCheck").style.display="";
    let html=`<div class="wd-title">${esc(q.title)}</div><div class="wd-item">${esc(q.prompt)}</div>`;
    if(q.type==="choice"){
      html+=`<div class="wd-choices">${q.choices.map(c=>`<button class="wd-choice" data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</div>`;
    } else {
      html+=`<textarea id="wdQuizTextAnswer" class="wd-textarea" placeholder="Cevabını buraya yaz..."></textarea>`;
      if(q.type!=="produce") html+=`<button class="wd-btn gray" id="wdQuizShowAnswer" style="margin-top:8px">Cevabı Göster</button>`;
    }
    step.innerHTML=html;
    step.querySelectorAll("[data-choice]").forEach(b=>b.onclick=()=>{
      step.querySelectorAll(".wd-choice").forEach(x=>x.classList.remove("ok","bad"));
      selected=b.dataset.choice; b.classList.add("ok");
    });
    const show=step.querySelector("#wdQuizShowAnswer");
    if(show) show.onclick=()=>{ const ta=step.querySelector("#wdQuizTextAnswer"); if(ta) ta.value=q.answer; };
  }
  async function check(){
    const q=qs[current];
    const val=q.type==="choice" ? selected : clean(step.querySelector("#wdQuizTextAnswer")?.value||"");
    if(!val){ fb.innerHTML="Önce cevap ver."; return; }
    let ok=false, pct=0;
    if(q.type==="choice"){
      ok=lower(val)===lower(q.answer); pct=ok?100:0;
      step.querySelectorAll(".wd-choice").forEach(b=>{
        if(lower(b.dataset.choice)===lower(q.answer)) b.classList.add("ok");
        else if(lower(b.dataset.choice)===lower(val)) b.classList.add("bad");
      });
    } else if(q.type==="produce"){
      pct=structureHintScore(val, st); ok=pct>=60;
    } else {
      pct=similarityScore(q.answer,val); ok=pct>=70;
    }
    let aiText=null;
    if((q.type==="produce" || q.type==="correct" || q.type==="translate") && typeof callAI==="function"){
      aiText=await callAI("Sen Türkçe açıklama yapan kısa bir İngilizce öğretmenisin.",
        `Hedef yapı: ${st.name} / ${st.formula}\nHedef cümle: ${d.sentence}\nSoru: ${q.title}\nBeklenen cevap: ${q.answer}\nÖğrenci cevabı: ${val}\nCevabı kısa değerlendir. Doğruysa DOĞRU, yanlışsa YANLIŞ kelimesiyle başla.`,
        "quiz");
      if(aiText && /DOĞRU/i.test(aiText)) ok=true;
    }
    fb.innerHTML = (ok?"✅":"❌")+" "+(aiText?esc(aiText).replace(/\n/g,"<br>"):(esc(q.explain)+(q.type==="produce"?`<br><b>Yapı puanı:</b> ${pct}%`:`<br><b>Beklenen:</b> ${esc(q.answer)}`)));
    if(ok) correct++;
    answers.push({q:q.title, answer:val, ok, pct});
    ov.querySelector("#wdQuizCheck").style.display="none";
    ov.querySelector("#wdQuizNext").style.display="";
  }
  function next(){
    current++;
    if(current>=qs.length){
      step.parentElement.style.display="none";
      summary.style.display="";
      summary.innerHTML=`
        <div class="wd-title">Sonuç: ${correct}/5</div>
        <div class="wd-item"><b>Öğrenilen yapı:</b> ${esc(st.name)}<br><b>Formül:</b> ${esc(st.formula)}<br><b>Özet:</b> ${esc(st.rule)}</div>
        <div class="wd-list" style="margin-top:12px">
          ${answers.map(a=>`<div class="wd-item">${a.ok?"✅":"❌"} <b>${esc(a.q)}</b><br><span class="wd-small">${esc(a.answer)}</span></div>`).join("")}
        </div>
        <div class="wd-actions"><button class="wd-btn green" id="wdOpenSimilarAfterQuiz">Benzer Cümlelerle Pekiştir</button></div>`;
      summary.querySelector("#wdOpenSimilarAfterQuiz").onclick=()=>openSimilarSentences();
      return;
    }
    render();
  }
  ov.querySelector("#wdQuizCheck").onclick=check;
  ov.querySelector("#wdQuizNext").onclick=next;
  render();
}

/* 2B — BENZER CÜMLELER */
async function openSimilarSentences(){
  const d=currentData();
  const st=inferStructure(d);
  const body=sentenceBox(d)+`
    ${wdPromptEditor("similar","Benzer Cümleler")}
    <div class="wd-card">
      <div class="wd-title">✨ Benzer Cümleler Üret</div>
      <div class="wd-sub">Aynı yapıyı farklı kelimelerle öğreterek kalıbı derinleştirir.</div>
      <div class="wd-item" style="margin-top:12px">
        <b>Yapı:</b> ${esc(st.name)}<br>
        <b>Formül:</b> ${esc(st.formula)}<br>
        <b>Kural:</b> ${esc(st.rule)}
      </div>
      <div class="wd-actions">
        <button class="wd-btn green" id="wdGenerateSimilar">5 Benzer Cümle Üret</button>
        <button class="wd-btn" id="wdSimilarListenAll">🔊 Hepsini Dinle</button>
      </div>
    </div>
    <div class="wd-card"><div class="wd-title">Benzer Cümleler</div><div id="wdSimilarOut" class="wd-list">Henüz üretilmedi.</div></div>`;
  const ov=panel("✨ Benzer Cümleler",body); wdBindPromptEditor(ov);
  const out=ov.querySelector("#wdSimilarOut");

  function offlineSimilar(){
    const rows=[];
    for(let i=0;i<5;i++){
      let en="";
      if(st.name==="Present Perfect") en=[`I have worked here for two years.`,`She has studied English since Monday.`,`They have finished the project already.`,`He has visited that city twice.`,`We have practiced this structure many times.`][i];
      else if(st.name==="Present Continuous") en=[`I am learning English now.`,`She is reading a useful sentence.`,`They are waiting outside.`,`He is working in the office.`,`We are practicing together.`][i];
      else if(st.name==="Future Simple") en=[`I will call you tomorrow.`,`She will finish the work soon.`,`They will visit us next week.`,`We will start the lesson today.`,`He will help his friend later.`][i];
      else if(st.name==="Modal Verb") en=[`You should practice every day.`,`I can speak more clearly.`,`They must finish this task.`,`She could help her friend.`,`We might need more time.`][i];
      else if(st.name==="Past Continuous") en=[`I was studying at eight.`,`They were watching a movie.`,`She was cooking dinner.`,`We were working all morning.`,`He was waiting outside.`][i];
      else if(st.name==="Past Simple") en=[`I visited my friend yesterday.`,`She finished the lesson last night.`,`They worked hard last week.`,`We started early.`,`He called his teacher.`][i];
      else if(st.name==="Present Simple") en=[`I practice English every day.`,`She practices English at home.`,`They study new words.`,`We use this sentence often.`,`He needs more time.`][i];
      else en=[`I use this sentence every day.`,`She learns the same structure.`,`They practice with new words.`,`We make similar sentences.`,`He understands the pattern.`][i];
      rows.push({en,tr:"Bu cümle aynı yapıyı farklı kelimelerle gösterir.",note:`Kalıp: ${st.formula}`});
    }
    return rows;
  }
  function renderRows(rows){
    out.innerHTML=rows.map((r,i)=>`
      <div class="wd-item">
        <div style="display:flex;gap:8px;align-items:flex-start">
          <div style="font-weight:950;color:#60a5fa">${i+1}</div>
          <div style="flex:1">
            <div style="font-size:18px;font-weight:950;color:#fff">${esc(r.en)}</div>
            <div class="wd-small" style="margin-top:4px">${esc(r.tr||"")}</div>
            <div class="wd-note">${esc(r.note||("Aynı yapı: "+st.formula))}</div>
          </div>
          <button class="wd-btn gray" data-say="${esc(r.en)}">🔊</button>
        </div>
      </div>`).join("");
    out.querySelectorAll("[data-say]").forEach(b=>b.onclick=()=>speak(b.dataset.say,"en-US",.88));
  }
  ov.querySelector("#wdGenerateSimilar").onclick=async()=>{
    out.innerHTML="⏳ Benzer cümleler hazırlanıyor...";
    const sys="Sen Türkçe açıklama yapan profesyonel bir İngilizce öğretmenisin. JSON dışında cevap verme.";
    const user=`Aktif cümle: ${d.sentence}\nTürkçe: ${d.sentenceTr}\nYapı: ${st.name}\nFormül: ${st.formula}\nAynı gramer yapısını öğreten 5 benzer İngilizce cümle üret. JSON formatı: [{"en":"...","tr":"...","note":"..."}]`;
    let rows=null;
    const ai=await callAI(sys,user,"similar");
    if(ai){
      try{ const m=ai.match(/\[[\s\S]*\]/); rows=JSON.parse(m?m[0]:ai); }catch(e){}
    }
    renderRows(Array.isArray(rows)&&rows.length?rows.slice(0,5):offlineSimilar());
  };
  ov.querySelector("#wdSimilarListenAll").onclick=()=>{
    const text=[...out.querySelectorAll("[data-say]")].map(b=>b.dataset.say).join(". ");
    if(text) speak(text,"en-US",.84);
  };
  ov.querySelector("#wdGenerateSimilar").click();
}

/* 3 — HİKAYE */
function openStory(){
  const d=currentData();
  const body=sentenceBox(d)+`
    ${wdPromptEditor("story","Hikaye")}
    <div class="wd-card">
      <div class="wd-title">📖 AI Hikaye Üretici</div>
      <div class="wd-sub">Orijinal ekrandaki gibi seviye seçip aktif cümleden hikaye üretir. API anahtarı varsa AI dener, yoksa offline hikaye verir.</div>
      <div class="wd-grid3" style="margin-top:12px">
        <button class="wd-btn green" data-level="A1-A2">📗 Başlangıç</button>
        <button class="wd-btn orange" data-level="B1-B2">📙 Orta</button>
        <button class="wd-btn purple" data-level="C1-C2">📕 İleri</button>
      </div>
    </div>
    <div class="wd-card"><div class="wd-title">Hikaye</div><div id="wdStoryOut" class="wd-item">Seviye seç ve hikaye oluştur.</div><div class="wd-actions"><button class="wd-btn" id="wdStoryListen">🔊 Seslendir</button></div></div>`;
  const ov=panel("📖 Hikaye",body); wdBindPromptEditor(ov);
  const out=ov.querySelector("#wdStoryOut");
  ov.querySelectorAll("[data-level]").forEach(b=>{
    b.onclick=async()=>{
      out.innerHTML="⏳ Hikaye hazırlanıyor...";
      const level=b.dataset.level;
      const sys=`Sen profesyonel bir İngilizce hikaye yazarısın. ${level} seviyesinde kısa, öğretici hikayeler yazıyorsun.`;
      const user=`Aktif cümle: ${d.sentence}\nTürkçe: ${d.sentenceTr}\nBu cümleyi doğal biçimde kullanan kısa bir İngilizce hikaye yaz. Başlık ekle.`;
      const ai=await callAI(sys,user,"story");
      out.innerHTML=esc(ai||offlineStory(d)).replace(/\n/g,"<br>");
    };
  });
  ov.querySelector("#wdStoryListen").onclick=()=>speakMixed(ov.querySelector("#wdStoryOut").innerText);
}

/* 4 — PODCAST */
function openPodcast(){
  const d=currentData();
  const body=sentenceBox(d)+`
    ${wdPromptEditor("podcast","Podcast")}
    <div class="wd-card">
      <div class="wd-title">🎧 AI Podcast Oluşturucu</div>
      <div class="wd-sub">Orijinal podcast ekranı mantığında konu + seviye ile aktif cümleden dinleme metni oluşturur.</div>
      <select id="wdPodcastLevel" class="wd-select" style="margin-top:12px">
        <option value="A1">A1 - Başlangıç</option><option value="A2" selected>A2 - Temel</option><option value="B1">B1 - Orta</option><option value="B2">B2 - Orta-İleri</option><option value="C1">C1 - İleri</option>
      </select>
      <input id="wdPodcastTopic" class="wd-input" style="margin-top:10px" value="Daily English Practice" placeholder="Podcast konusu">
      <div class="wd-actions"><button class="wd-btn green" id="wdGenPodcast">✨ Podcast Oluştur</button></div>
    </div>
    <div class="wd-card"><div class="wd-title">Podcast Metni</div><div id="wdPodcastOut" class="wd-item">Henüz oluşturulmadı.</div><div class="wd-actions"><button class="wd-btn" id="wdPodPlay">▶ Dinle</button><button class="wd-btn gray" id="wdPodStop">⏹ Durdur</button></div></div>`;
  const ov=panel("🎧 Podcast",body); wdBindPromptEditor(ov);
  const out=ov.querySelector("#wdPodcastOut");
  ov.querySelector("#wdGenPodcast").onclick=async()=>{
    out.innerHTML="⏳ Podcast hazırlanıyor...";
    const level=ov.querySelector("#wdPodcastLevel").value;
    const topic=ov.querySelector("#wdPodcastTopic").value;
    const sys=`Sen profesyonel bir İngilizce podcast sunucususun. ${level} seviyesinde podcast yapıyorsun.`;
    const user=`Konu: ${topic}\nAktif cümle: ${d.sentence}\nTürkçe: ${d.sentenceTr}\nDoğal, kısa ve eğitici bir İngilizce podcast metni yaz.`;
    const ai=await callAI(sys,user,"podcast");
    out.innerHTML=esc(ai||offlinePodcast(d)).replace(/\n/g,"<br>");
  };
  ov.querySelector("#wdPodPlay").onclick=()=>speakMixed(out.innerText);
  ov.querySelector("#wdPodStop").onclick=()=>speechSynthesis.cancel();
}

/* 5 — KONUŞMA */
function openConversation(){
  const d=currentData();
  activeConv=[];
  const body=sentenceBox(d)+`
    ${wdPromptEditor("conversation","Konuşma")}
    <div class="wd-card">
      <div class="wd-title">🗣️ Konuşma Simülasyonu</div>
      <div class="wd-sub">Aktif cümleyi gerçek konuşma içinde kullan. Rol seç, yaz veya mikrofona söyle.</div>
      <select id="wdScenario" class="wd-select" style="margin-top:12px">
        <option value="friendly English teacher">Friendly English Teacher</option>
        <option value="hotel receptionist">Hotel Receptionist</option>
        <option value="restaurant waiter">Restaurant Waiter</option>
        <option value="airport staff">Airport Staff</option>
        <option value="conversation partner">Conversation Partner</option>
      </select>
    </div>
    <div class="wd-card"><div id="wdChat" class="wd-chat"></div>
      <textarea id="wdChatInput" class="wd-textarea" placeholder="İngilizce cevap yaz veya mikrofona söyle...">${esc(d.sentence)}</textarea>
      <div class="wd-actions"><button class="wd-btn orange" id="wdMic">🎤 Mikrofon</button><button class="wd-btn green" id="wdSend">Gönder</button><button class="wd-btn" id="wdStart">Bu ayarlarla başlat</button></div>
    </div>`;
  const ov=panel("🗣️ Konuşma",body); wdBindPromptEditor(ov);
  const chat=ov.querySelector("#wdChat");
  function add(role,text){
    const div=document.createElement("div");
    div.className="wd-msg "+(role==="user"?"wd-user":"wd-ai");
    div.innerHTML=esc(text).replace(/\n/g,"<br>");
    chat.appendChild(div);
    chat.scrollTop=chat.scrollHeight;
  }
  async function aiReply(userText, first=false){
    const scenario=ov.querySelector("#wdScenario").value;
    const sys=`You are a ${scenario}. Help a Turkish learner practice English. Keep replies short, natural and friendly.`;
    const user=first?`Start a short roleplay. The learner's target sentence is: ${d.sentence}`:`Learner: ${userText}\nTarget sentence: ${d.sentence}\nReply naturally and ask one follow-up question.`;
    const ai=await callAI(sys,user,"conversation");
    const fallback=first?`Hello! Let's practice. Try to use this sentence naturally: "${d.sentence}"`:`Good. I understood you. Can you make one more sentence with the same pattern?`;
    const reply=ai||fallback;
    add("ai",reply);
    speakMixed(reply);
  }
  ov.querySelector("#wdStart").onclick=()=>aiReply("",true);
  ov.querySelector("#wdSend").onclick=()=>{
    const v=clean(ov.querySelector("#wdChatInput").value);
    if(!v)return;
    add("user",v);
    ov.querySelector("#wdChatInput").value="";
    aiReply(v,false);
  };
  ov.querySelector("#wdMic").onclick=()=>listen(t=>{ov.querySelector("#wdChatInput").value=t;});
  aiReply("",true);
}

/* 6A — CÜMLE YAZ */
function openWriting(){
  const d=currentData();
  const body=sentenceBox(d)+`
    ${wdPromptEditor("writing","Cümle Yaz")}
    <div class="wd-card">
      <div class="wd-title">✍️ Cümle Yaz</div>
      <div class="wd-sub">Aktif cümle kalıbıyla kendi İngilizce cümleni yaz. Sistem basit kontrol yapar, API varsa açıklama ister.</div>
      <textarea id="wdWriteInput" class="wd-textarea" placeholder="Kendi cümleni İngilizce yaz..."></textarea>
      <div class="wd-actions"><button class="wd-btn green" id="wdCheckWriting">Kontrol Et</button><button class="wd-btn orange" id="wdWriteMic">🎤 Sesle Gir</button></div>
      <div id="wdWriteOut" class="wd-item" style="margin-top:12px">Cümleni yaz.</div><div class="wd-actions"><button class="wd-btn gray" id="wdWriteRead">🔊 Cevabı Oku</button></div>
    </div>`;
  const ov=panel("✍️ Cümle Yaz",body); wdBindPromptEditor(ov);
  ov.querySelector("#wdWriteMic").onclick=()=>listen(t=>{ov.querySelector("#wdWriteInput").value=t;});
  ov.querySelector("#wdWriteRead").onclick=()=>speakMixed(ov.querySelector("#wdWriteOut").innerText);
  ov.querySelector("#wdCheckWriting").onclick=async()=>{
    const val=clean(ov.querySelector("#wdWriteInput").value);
    const out=ov.querySelector("#wdWriteOut");
    if(!val){out.innerHTML="Önce cümle yaz.";return;}
    out.innerHTML="⏳ Kontrol ediliyor...";
    const sys="You are an English writing teacher for Turkish learners. Reply in Turkish. Be concise.";
    const user=`Öğrenci cümlesi: ${val}\nHedef örnek: ${d.sentence}\nCümleyi düzelt, kısa açıklama ver ve daha doğal bir versiyon yaz.`;
    const ai=await callAI(sys,user,"writing");
    const cap=/^[A-Z]/.test(val.trim()), end=/[.!?]$/.test(val.trim());
    out.innerHTML=esc(ai||`Kontrol sonucu:\n- Büyük harfle başlama: ${cap?"uygun":"eksik"}\n- Noktalama: ${end?"uygun":"eksik"}\n- Hedef kalıba yakın cümle kurmaya çalış.\n\nÖrnek: ${d.sentence}`).replace(/\n/g,"<br>");
  };
}

/* 6B — PARTNER */
function openPartner(){
  const d=currentData();
  const body=sentenceBox(d)+`
    ${wdPromptEditor("partner","Partner")}
    <div class="wd-card">
      <div class="wd-title">🗨️ Partner</div>
      <div class="wd-sub">Kısa mesajlaşma pratiği. Partner aktif cümleye göre cevap verir.</div>
      <div id="wdPartnerChat" class="wd-chat"></div>
      <textarea id="wdPartnerInput" class="wd-textarea" placeholder="Mesajını İngilizce yaz...">Can we practice this sentence?</textarea>
      <div class="wd-actions"><button class="wd-btn green" id="wdPartnerSend">Gönder</button></div>
    </div>`;
  const ov=panel("🗨️ Partner",body); wdBindPromptEditor(ov);
  const chat=ov.querySelector("#wdPartnerChat");
  function add(who,text){const div=document.createElement("div");div.className="wd-msg "+(who==="user"?"wd-user":"wd-ai");div.innerHTML=esc(text);chat.appendChild(div);}
  add("ai",`Sure. Try to use this sentence: "${d.sentence}"`);
  ov.querySelector("#wdPartnerSend").onclick=async()=>{
    const val=clean(ov.querySelector("#wdPartnerInput").value); if(!val)return;
    add("user",val); ov.querySelector("#wdPartnerInput").value="";
    const ai=await callAI("You are a friendly English chat partner. Keep it short.",`Target sentence: ${d.sentence}\nLearner message: ${val}\nReply naturally and ask a short question.`,"partner");
    const reply=ai||"Nice. Can you say it one more time in a different way?"; add("ai",reply); speakMixed(reply);
  };
}

/* 6C — GÖRSEL */
function openVisual(){
  const d=currentData();
  const prompt = `Realistic educational scene for English learning.
Sentence: "${d.sentence}"
Meaning in Turkish: "${d.sentenceTr}"
Show a clear real-life situation that represents the sentence.
No text on image. Natural lighting.`;
  const body=sentenceBox(d)+`
    <div class="wd-card">
      <div class="wd-title">🖼️ Görsel</div>
      <div class="wd-sub">Data'daki görsel arama mantığına uygun şekilde aktif cümleden görsel prompt çıkarır. Burada üretim değil, arama/üretim cümlesi hazırlanır.</div>
      <div class="wd-imgprompt" id="wdVisualPrompt">${esc(prompt)}</div>
      <div class="wd-actions"><button class="wd-btn" id="wdCopyPrompt">📋 Promptu Kopyala</button><button class="wd-btn green" id="wdSearchUnsplash">Görsel Ara</button></div>
      <div class="wd-note">Eski image-addon.js fotoğraf sistemin ayrıca korunuyor; bu ekran sadece görsel çalışması için arama/üretim cümlesi verir.</div>
    </div>`;
  const ov=panel("🖼️ Görsel",body);
  ov.querySelector("#wdCopyPrompt").onclick=async()=>{try{await navigator.clipboard.writeText(prompt);alert("Kopyalandı");}catch(e){}};
  ov.querySelector("#wdSearchUnsplash").onclick=()=>{window.open("https://unsplash.com/s/photos/"+encodeURIComponent(tokens(d.sentence).slice(0,5).join(" ")),"_blank");};
}


/* 1 — SHADOW */
function openShadow(){
  const d=currentData();
  const body=sentenceBox(d)+`
    <div class="wd-card">
      <div class="wd-title">👥 Shadow</div>
      <div class="wd-sub">Dinle → yavaş dinle → aynı anda tekrar et → mikrofona oku. Sonuçta sadece puan ve söylediğin cümle gösterilir.</div>
      <div class="wd-actions">
        <button class="wd-btn green" id="wdShadowListen">🔊 Dinle</button>
        <button class="wd-btn orange" id="wdShadowSlow">🐌 Yavaş Dinle</button>
        <button class="wd-btn purple" id="wdShadowMic">🎤 Oku</button>
      </div>
    </div>
    <div class="wd-card">
      <div class="wd-title">Sonuç</div>
      <div id="wdShadowStatus" class="wd-item">Hazır. Önce dinle, sonra oku.</div>
      <div class="wd-actions">
        <button class="wd-btn" id="wdShadowReplay" style="display:none">▶ Kendi Kaydını Dinle</button>
        <button class="wd-btn gray" id="wdShadowReset">🔄 Tekrar</button>
      </div>
    </div>`;
  const ov=panel("👥 Shadow",body);
  let recBlob=null, recUrl=null, mediaRecorder=null, chunks=[];
  const status=ov.querySelector("#wdShadowStatus");
  const replay=ov.querySelector("#wdShadowReplay");

  function normalizeText(s){
    return String(s||"").toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9'\s]/g," ").replace(/\s+/g," ").trim();
  }
  function scoreSpoken(target, spoken){
    const t=normalizeText(target).split(/\s+/).filter(Boolean);
    const s=normalizeText(spoken).split(/\s+/).filter(Boolean);
    if(!t.length || !s.length) return 0;
    const used=new Set(); let hit=0;
    t.forEach(w=>{
      const i=s.findIndex((x,idx)=>!used.has(idx) && x===w);
      if(i>=0){used.add(i);hit++;}
    });
    return Math.round((hit/Math.max(t.length,s.length))*100);
  }
  function colorWords(target, spoken){
    const t=normalizeText(target).split(/\s+/).filter(Boolean);
    const s=normalizeText(spoken).split(/\s+/).filter(Boolean);
    return s.map(w=>{
      const ok=t.includes(w);
      return `<span style="color:${ok?'#4ade80':'#f87171'};font-weight:950">${esc(w)}</span>`;
    }).join(" ");
  }
  async function startRecordingBlob(){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      chunks=[];
      mediaRecorder=new MediaRecorder(stream);
      mediaRecorder.ondataavailable=e=>{ if(e.data && e.data.size) chunks.push(e.data); };
      mediaRecorder.onstop=()=>{
        try{ stream.getTracks().forEach(t=>t.stop()); }catch(e){}
        recBlob=new Blob(chunks,{type:mediaRecorder.mimeType||"audio/webm"});
        if(recUrl) URL.revokeObjectURL(recUrl);
        recUrl=URL.createObjectURL(recBlob);
        replay.style.display="";
      };
      mediaRecorder.start();
    }catch(e){}
  }
  function stopRecordingBlob(){
    try{ if(mediaRecorder && mediaRecorder.state!=="inactive") mediaRecorder.stop(); }catch(e){}
  }
  ov.querySelector("#wdShadowListen").onclick=()=>speak(d.sentence,"en-US",.9);
  ov.querySelector("#wdShadowSlow").onclick=()=>speak(d.sentence,"en-US",.62);
  ov.querySelector("#wdShadowMic").onclick=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){ alert("Bu tarayıcıda konuşma tanıma yok. Chrome/Edge kullan."); return; }
    status.innerHTML="🎤 Dinliyorum...";
    startRecordingBlob();
    const r=new SR();
    r.lang="en-US"; r.interimResults=false; r.maxAlternatives=1; r.continuous=false;
    r.onresult=e=>{
      const spoken=e.results[0][0].transcript;
      const pct=scoreSpoken(d.sentence, spoken);
      const clr=pct>=85?"#4ade80":pct>=65?"#60a5fa":pct>=45?"#f59e0b":"#f87171";
      status.innerHTML=`
        <div style="font-size:42px;font-weight:950;color:${clr};text-align:center;margin-bottom:10px">${pct}%</div>
        <div style="font-size:20px;line-height:1.8;text-align:center">${colorWords(d.sentence, spoken)}</div>
      `;
      stopRecordingBlob();
    };
    r.onerror=e=>{
      status.innerHTML="❌ Ses algılanamadı. Tekrar dene.";
      stopRecordingBlob();
    };
    r.onend=()=>stopRecordingBlob();
    try{r.start();}catch(e){status.innerHTML="❌ Mikrofon başlatılamadı.";stopRecordingBlob();}
  };
  replay.onclick=()=>{ if(recUrl){ const a=new Audio(recUrl); a.play(); } };
  ov.querySelector("#wdShadowReset").onclick=()=>{
    status.innerHTML="Hazır. Önce dinle, sonra oku.";
    replay.style.display="none";
    if(recUrl) URL.revokeObjectURL(recUrl);
    recUrl=null; recBlob=null;
  };
}

/* BUTTONS */
function enhance(){
  addStyle();
  const card=currentCard();
  if(!card || card.dataset.wordDirectTools==="1") return;
  const anchor=card.querySelector(".extra-learning-actions") || card.querySelector(".card-actions");
  if(!anchor) return;
  const row=document.createElement("div");
  row.className="wd-tools-row";
  row.innerHTML=`
    <button data-wd="shadow"><b>👥</b>Shadow</button>
    <button class="wd-gold" data-wd="test"><b>📝</b>AI Test</button>
    <button class="wd-blue" data-wd="similar"><b>✨</b>Benzer</button>
    <button class="wd-blue" data-wd="story"><b>📖</b>Hikaye</button>
    <button class="wd-blue" data-wd="podcast"><b>🎧</b>Podcast</button>
    <button data-wd="conversation"><b>🗣️</b>Konuşma</button>
    <button data-wd="writing"><b>✍️</b>Cümle Yaz</button>
    <button data-wd="partner"><b>🗨️</b>Partner</button>
    <button data-wd="visual"><b>🖼️</b>Görsel</button>
  `;
  const map={shadow:openShadow,test:openAITest,similar:openSimilarSentences,story:openStory,podcast:openPodcast,conversation:openConversation,writing:openWriting,partner:openPartner,visual:openVisual};
  row.querySelectorAll("[data-wd]").forEach(b=>b.onclick=()=>map[b.dataset.wd]());
  anchor.insertAdjacentElement("afterend", row);
  card.dataset.wordDirectTools="1";
}
let t=null;
function schedule(){clearTimeout(t);t=setTimeout(enhance,120);}
document.addEventListener("DOMContentLoaded",()=>{enhance();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});});
window.addEventListener("load",enhance);
})();