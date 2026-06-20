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
function openAITest(){
  const d=currentData();
  const words=tokens(d.sentence);
  const main=words[Math.max(0,Math.floor(words.length/2))] || d.word;
  const wrong=pick(["because","although","since","during","while","before","after","never","always","usually","quickly","carefully","important","different","possible"].filter(x=>x!==main.toLowerCase()),3);
  const choices=pick([main,...wrong],4);
  const blank=d.sentence.replace(new RegExp("\\b"+main.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i"),"_____");
  const body=sentenceBox(d)+`
    <div class="wd-card">
      <div class="wd-title">🎯 Test Oluştur</div>
      <div class="wd-sub">Orijinal AI Test mantığındaki gibi aktif cümleden soru üretildi.</div>
      <div class="wd-item" style="margin-top:12px"><b>SORU:</b><br>${esc(blank)}</div>
      <div class="wd-choices">${choices.map(c=>`<button class="wd-choice" data-a="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div id="wdQuizResult" class="wd-note">Doğru seçeneği işaretle.</div>
    </div>
    <div class="wd-card">
      <div class="wd-title">🔀 Kelime Sıralama</div>
      <div class="wd-item">${esc(pick(words,words.length).join(" / "))}</div>
      <textarea id="wdOrderAnswer" class="wd-textarea" placeholder="Cümleyi doğru sırayla yaz..."></textarea>
      <div class="wd-actions"><button class="wd-btn" id="wdOrderCheck">Kontrol</button><button class="wd-btn green" id="wdShowAnswer">Cevabı göster</button></div>
      <div id="wdOrderResult" class="wd-note"></div>
    </div>`;
  const ov=panel("📝 AI Test",body);
  ov.querySelectorAll(".wd-choice").forEach(btn=>{
    btn.onclick=()=>{
      const ok=lower(btn.dataset.a)===lower(main);
      btn.classList.add(ok?"ok":"bad");
      ov.querySelector("#wdQuizResult").innerHTML=ok?"✅ Doğru.":`❌ Doğru cevap: <b>${esc(main)}</b>`;
    };
  });
  ov.querySelector("#wdOrderCheck").onclick=()=>{
    const v=lower(ov.querySelector("#wdOrderAnswer").value);
    ov.querySelector("#wdOrderResult").innerHTML = v===lower(d.sentence) ? "✅ Tam doğru." : `Kontrol et. Doğru cümle: <b>${esc(d.sentence)}</b>`;
  };
  ov.querySelector("#wdShowAnswer").onclick=()=>{ ov.querySelector("#wdOrderAnswer").value=d.sentence; };
}

/* 3 — HİKAYE */
function openStory(){
  const d=currentData();
  const body=sentenceBox(d)+`
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
  const ov=panel("📖 Hikaye",body);
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
  ov.querySelector("#wdStoryListen").onclick=()=>speak(ov.querySelector("#wdStoryOut").innerText,"en-US",.88);
}

/* 4 — PODCAST */
function openPodcast(){
  const d=currentData();
  const body=sentenceBox(d)+`
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
  const ov=panel("🎧 Podcast",body);
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
  ov.querySelector("#wdPodPlay").onclick=()=>speak(out.innerText,"en-US",.86);
  ov.querySelector("#wdPodStop").onclick=()=>speechSynthesis.cancel();
}

/* 5 — KONUŞMA */
function openConversation(){
  const d=currentData();
  activeConv=[];
  const body=sentenceBox(d)+`
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
  const ov=panel("🗣️ Konuşma",body);
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
    add("ai",ai||fallback);
    speak(ai||fallback,"en-US",.9);
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
    <div class="wd-card">
      <div class="wd-title">✍️ Cümle Yaz</div>
      <div class="wd-sub">Aktif cümle kalıbıyla kendi İngilizce cümleni yaz. Sistem basit kontrol yapar, API varsa açıklama ister.</div>
      <textarea id="wdWriteInput" class="wd-textarea" placeholder="Kendi cümleni İngilizce yaz..."></textarea>
      <div class="wd-actions"><button class="wd-btn green" id="wdCheckWriting">Kontrol Et</button><button class="wd-btn orange" id="wdWriteMic">🎤 Sesle Gir</button></div>
      <div id="wdWriteOut" class="wd-item" style="margin-top:12px">Cümleni yaz.</div>
    </div>`;
  const ov=panel("✍️ Cümle Yaz",body);
  ov.querySelector("#wdWriteMic").onclick=()=>listen(t=>{ov.querySelector("#wdWriteInput").value=t;});
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
    <div class="wd-card">
      <div class="wd-title">🗨️ Partner</div>
      <div class="wd-sub">Kısa mesajlaşma pratiği. Partner aktif cümleye göre cevap verir.</div>
      <div id="wdPartnerChat" class="wd-chat"></div>
      <textarea id="wdPartnerInput" class="wd-textarea" placeholder="Mesajını İngilizce yaz...">Can we practice this sentence?</textarea>
      <div class="wd-actions"><button class="wd-btn green" id="wdPartnerSend">Gönder</button></div>
    </div>`;
  const ov=panel("🗨️ Partner",body);
  const chat=ov.querySelector("#wdPartnerChat");
  function add(who,text){const div=document.createElement("div");div.className="wd-msg "+(who==="user"?"wd-user":"wd-ai");div.innerHTML=esc(text);chat.appendChild(div);}
  add("ai",`Sure. Try to use this sentence: "${d.sentence}"`);
  ov.querySelector("#wdPartnerSend").onclick=async()=>{
    const val=clean(ov.querySelector("#wdPartnerInput").value); if(!val)return;
    add("user",val); ov.querySelector("#wdPartnerInput").value="";
    const ai=await callAI("You are a friendly English chat partner. Keep it short.",`Target sentence: ${d.sentence}\nLearner message: ${val}\nReply naturally and ask a short question.`,"partner");
    add("ai",ai||"Nice. Can you say it one more time in a different way?");
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
    <button class="wd-gold" data-wd="test"><b>📝</b>AI Test</button>
    <button class="wd-blue" data-wd="story"><b>📖</b>Hikaye</button>
    <button class="wd-blue" data-wd="podcast"><b>🎧</b>Podcast</button>
    <button data-wd="conversation"><b>🗣️</b>Konuşma</button>
    <button data-wd="writing"><b>✍️</b>Cümle Yaz</button>
    <button data-wd="partner"><b>🗨️</b>Partner</button>
    <button data-wd="visual"><b>🖼️</b>Görsel</button>
  `;
  const map={test:openAITest,story:openStory,podcast:openPodcast,conversation:openConversation,writing:openWriting,partner:openPartner,visual:openVisual};
  row.querySelectorAll("[data-wd]").forEach(b=>b.onclick=()=>map[b.dataset.wd]());
  anchor.insertAdjacentElement("afterend", row);
  card.dataset.wordDirectTools="1";
}
let t=null;
function schedule(){clearTimeout(t);t=setTimeout(enhance,120);}
document.addEventListener("DOMContentLoaded",()=>{enhance();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});});
window.addEventListener("load",enhance);
})();