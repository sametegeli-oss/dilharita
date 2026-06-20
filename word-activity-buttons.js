/* word-activity-buttons.js
   /word ekranındaki aktivite düğmelerini index-app.html cümle kartına taşır:
   Shadow, Hikaye, Podcast, Konuş, Benzer, AI Test.
   assets/app.js'e dokunmaz; aktif cümleyi okuyup güvenli ekleme yapar.
*/
(function(){
"use strict";

const STYLE_ID = "word-activity-buttons-style-v1";

function addStyle(){
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
  .word-activity-row{
    display:flex;
    flex-wrap:wrap;
    gap:10px;
    margin-top:14px;
    padding:14px;
    border:1px solid rgba(255,255,255,.10);
    border-radius:18px;
    background:rgba(255,255,255,.035);
  }
  .word-activity-row .wa-btn{
    min-width:98px;
    min-height:64px;
    border:1px solid rgba(255,255,255,.14);
    border-radius:16px;
    background:#17233a;
    color:#eaf2ff;
    font:900 14px Nunito,system-ui,sans-serif;
    cursor:pointer;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:5px;
    box-shadow:0 10px 26px rgba(0,0,0,.20);
  }
  .word-activity-row .wa-btn:hover{background:#22304f;transform:translateY(-1px)}
  .word-activity-row .wa-btn b{font-size:20px;line-height:1}
  .word-activity-row .wa-similar{background:#12315f;border-color:#3b82f666;color:#93c5fd}
  .word-activity-row .wa-test{background:#3b2a09;border-color:#f59e0b66;color:#fde68a}
  .wa-modal{
    position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.66);
    display:flex;align-items:center;justify-content:center;padding:18px;
    backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  }
  .wa-card{
    width:min(760px,100%);max-height:86vh;overflow:auto;
    background:#0f1d35;color:#edf4ff;border:1px solid rgba(255,255,255,.14);
    border-radius:24px;padding:20px;box-shadow:0 28px 80px rgba(0,0,0,.58);
    font-family:Nunito,system-ui,sans-serif;
  }
  .wa-card h2{margin:0 0 8px;font-size:25px}
  .wa-card .wa-sub{color:#9fb3d5;margin-bottom:14px;line-height:1.45}
  .wa-box{background:#08162b;border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:14px;margin:10px 0;line-height:1.6}
  .wa-label{font-size:12px;font-weight:950;color:#93c5fd;text-transform:uppercase;letter-spacing:.45px;margin-bottom:6px}
  .wa-en{font-size:22px;font-weight:950;color:#fff}.wa-tr{color:#cbd5e1;margin-top:5px}
  .wa-list{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
  .wa-list li{background:#08162b;border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:12px}
  .wa-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:14px}
  .wa-actions button,.wa-actions a{
    border:0;border-radius:12px;padding:10px 14px;background:#2563eb;color:#fff;
    font-weight:900;text-decoration:none;cursor:pointer;
  }
  .wa-actions .close{background:#334155}
  .wa-actions .green{background:#16a34a}.wa-actions .purple{background:#6d28d9}.wa-actions .orange{background:#d97706}
  .wa-input{width:100%;min-height:70px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:#071226;color:#fff;padding:12px;font:800 15px Nunito,system-ui,sans-serif}
  .wa-result{margin-top:10px;border-radius:14px;padding:12px;background:#071226;border:1px solid rgba(255,255,255,.10)}
  @media(max-width:760px){
    .word-activity-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px}
    .word-activity-row .wa-btn{min-width:0;min-height:56px;font-size:12px}
    .word-activity-row .wa-btn b{font-size:18px}
    .wa-card{padding:16px}
    .wa-en{font-size:19px}
  }`;
  document.head.appendChild(s);
}

function clean(s){ return String(s||"").replace(/\s+/g," ").trim(); }
function esc(s){ return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }

function currentCard(){
  const cards=[...document.querySelectorAll(".card")];
  return cards.find(c => c.querySelector(".card-en") && c.querySelector(".card-actions"));
}
function data(card){
  return {
    en: clean(card?.querySelector(".card-en")?.innerText || ""),
    tr: clean(card?.querySelector(".card-tr")?.innerText || ""),
    pron: clean(card?.querySelector(".card-pron")?.innerText || ""),
    ipa: clean(card?.querySelector(".card-ipa")?.innerText || ""),
    module: clean(document.querySelector(".study-title")?.innerText || ""),
    details: [...(card?.querySelectorAll(".detail-row") || [])].map(r=>({
      k: clean(r.querySelector(".detail-label")?.innerText || ""),
      v: clean(r.querySelector(".detail-value")?.innerText || "")
    })).filter(x=>x.k||x.v)
  };
}

function speak(text, slow=false){
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang="en-US"; u.rate=slow?.72:.9; u.volume=1;
    const voice=(speechSynthesis.getVoices()||[]).find(v=>/^en/i.test(v.lang));
    if(voice) u.voice=voice;
    speechSynthesis.speak(u);
  }catch{}
}

function modal(title, sub, body, actions=""){
  const m=document.createElement("div");
  m.className="wa-modal";
  m.innerHTML=`<div class="wa-card">
    <h2>${title}</h2>
    ${sub?`<div class="wa-sub">${sub}</div>`:""}
    ${body}
    <div class="wa-actions">
      ${actions}
      <button class="close" type="button">Kapat</button>
    </div>
  </div>`;
  m.querySelector(".close").onclick=()=>m.remove();
  m.onclick=e=>{ if(e.target===m) m.remove(); };
  document.body.appendChild(m);
  return m;
}

function similarSentences(en){
  const e = clean(en);
  let out = [];
  if(/\bI am a\b/i.test(e)){
    out=[e, e.replace(/\bI am\b/i,"You are"), e.replace(/\bI am\b/i,"He is"), e.replace(/\bI am\b/i,"She is"), e.replace(/\ba\b/i,"an")];
  }else if(/\bI have lived\b/i.test(e)){
    out=[e, "I have worked here for ten years.", "She has lived in this city since 2020.", "They have stayed in this hotel for two nights.", "We have known each other for years."];
  }else if(/\bdidn't\b|\bdid not\b/i.test(e)){
    out=[e, e.replace(/^I\b/i,"He"), e.replace(/^I\b/i,"She"), "They didn't go there.", "We didn't finish the lesson."];
  }else if(/\bsaw\b/i.test(e)){
    out=[e, e.replace(/^She\b/i,"He"), e.replace(/^She\b/i,"I"), "They saw the match.", "We saw a nice place."];
  }else{
    out=[e, "I can use this sentence in daily life.", "Can you say this sentence again?", "This sentence is useful for speaking.", "Try to make a similar sentence."];
  }
  return [...new Set(out.filter(Boolean))].slice(0,5);
}

function showShadow(card){
  const d=data(card);
  const body=`<div class="wa-box"><div class="wa-label">Shadow cümlesi</div><div class="wa-en">${esc(d.en)}</div>${d.tr?`<div class="wa-tr">${esc(d.tr)}</div>`:""}</div>
  <div class="wa-box"><div class="wa-label">Adımlar</div>
    1. Dinle<br>2. Yavaş dinle<br>3. Aynı anda tekrar et<br>4. Mikrofona söyle ve kendini kontrol et
  </div>
  <textarea class="wa-input" id="waShadowText" placeholder="Mikrofondan veya klavyeden söylediğini buraya yaz..."></textarea>
  <div class="wa-result" id="waShadowResult">Hazır.</div>`;
  const m=modal("🎧 Shadow", "Cümleyi dinleyip aynı ritimle tekrar et.", body,
    `<button class="green" id="waListen">Dinle</button><button class="purple" id="waSlow">Yavaş</button><button class="orange" id="waMic">Mikrofon</button><button id="waCheck">Kontrol</button>`);
  m.querySelector("#waListen").onclick=()=>speak(d.en);
  m.querySelector("#waSlow").onclick=()=>speak(d.en,true);
  m.querySelector("#waCheck").onclick=()=>checkText(m,d.en,"waShadowText","waShadowResult");
  m.querySelector("#waMic").onclick=()=>listenToInput(m.querySelector("#waShadowText"));
}

function showStory(card){
  const d=data(card);
  const lines=[
    `Today I learned this sentence: "${d.en}"`,
    `I saw a situation where this sentence was useful.`,
    `I repeated it slowly and clearly.`,
    `Now I can use it when I speak English.`
  ];
  const body=`<div class="wa-box"><div class="wa-label">Ana cümle</div><div class="wa-en">${esc(d.en)}</div>${d.tr?`<div class="wa-tr">${esc(d.tr)}</div>`:""}</div>
  <ul class="wa-list">${lines.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
  const m=modal("📖 Hikaye", "Cümleyi kısa bir hikâye içinde kullan.", body, `<button class="green" id="waRead">Hikâyeyi dinle</button>`);
  m.querySelector("#waRead").onclick=()=>speak(lines.join(" "));
}

function showPodcast(card){
  const d=data(card);
  const lines=[
    `Host: Today's useful sentence is: ${d.en}`,
    `Guest: What does it mean?`,
    `Host: It means: ${d.tr || "Try to understand it from the context."}`,
    `Guest: Great. I will repeat it three times.`,
    `Host: Perfect. Use it in a real conversation today.`
  ];
  const body=`<ul class="wa-list">${lines.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
  const m=modal("🎙️ Podcast", "Mini podcast diyalogu ile dinleme çalışması.", body, `<button class="green" id="waRead">Podcast'i dinle</button>`);
  m.querySelector("#waRead").onclick=()=>speak(lines.join(" "));
}

function showSpeak(card){
  const d=data(card);
  const body=`<div class="wa-box"><div class="wa-label">Konuşma görevi</div>
    Bu cümleyi kullanarak 3 cümlelik kısa cevap ver.
  </div>
  <div class="wa-box"><div class="wa-label">Kullanılacak cümle</div><div class="wa-en">${esc(d.en)}</div></div>
  <textarea class="wa-input" id="waSpeakText" placeholder="Cevabını İngilizce yaz veya mikrofona söyle..."></textarea>
  <div class="wa-result" id="waSpeakResult">Cevabını yaz veya söyle.</div>`;
  const m=modal("💬 Konuş", "Aktif cümleyi konuşma içinde kullan.", body,
    `<button class="orange" id="waMic">Mikrofon</button><button id="waCheck">Kontrol</button>`);
  m.querySelector("#waMic").onclick=()=>listenToInput(m.querySelector("#waSpeakText"));
  m.querySelector("#waCheck").onclick=()=> {
    const val=clean(m.querySelector("#waSpeakText").value);
    m.querySelector("#waSpeakResult").innerHTML = val ? `✅ Cevap kaydedildi. Ana cümleyi kullandıysan iyi bir konuşma çalışması yaptın.` : `Önce bir cevap yaz.`;
  };
}

function showSimilar(card){
  const d=data(card);
  const sims=similarSentences(d.en);
  const body=`<div class="wa-box"><div class="wa-label">Ana cümle</div><div class="wa-en">${esc(d.en)}</div></div>
  <ul class="wa-list">${sims.map(x=>`<li>${esc(x)} <button data-say="${esc(x)}" style="float:right">🔊</button></li>`).join("")}</ul>`;
  const m=modal("✨ Benzer", "Aynı kalıpla benzer örnekler.", body);
  m.querySelectorAll("button[data-say]").forEach(b=>b.onclick=()=>speak(b.getAttribute("data-say")));
}

function showAITest(card){
  const d=data(card);
  const words=d.en.split(/\s+/).filter(Boolean);
  const idx=Math.max(0, Math.floor(words.length/2));
  const answer=words[idx] || "";
  const blank=words.map((w,i)=>i===idx?"_____":w).join(" ");
  const shuffled=[...words].sort(()=>Math.random()-.5).join(" / ");
  const body=`<div class="wa-box"><div class="wa-label">Test 1 · Boşluk doldur</div><div class="wa-en">${esc(blank)}</div></div>
  <textarea class="wa-input" id="waTestText" placeholder="Eksik kelimeyi veya tüm cümleyi yaz..."></textarea>
  <div class="wa-box"><div class="wa-label">Test 2 · Kelime sırası</div>${esc(shuffled)}</div>
  <div class="wa-box"><div class="wa-label">Test 3 · Türkçeden İngilizceye</div>${esc(d.tr || "Türkçe çeviri yok")}</div>
  <div class="wa-result" id="waTestResult">Cevabını kontrol et.</div>`;
  const m=modal("📝 AI Test", "Bu cümleden hızlı test üretildi.", body,
    `<button id="waCheck">Kontrol</button><button class="green" id="waShow">Cevabı göster</button>`);
  m.querySelector("#waCheck").onclick=()=> {
    const val=clean(m.querySelector("#waTestText").value).toLowerCase();
    const ok=val===answer.toLowerCase() || val===d.en.toLowerCase();
    m.querySelector("#waTestResult").innerHTML = ok ? `✅ Doğru.` : `📌 Kontrol et. Eksik kelime: <b>${esc(answer)}</b>`;
  };
  m.querySelector("#waShow").onclick=()=> {
    m.querySelector("#waTestResult").innerHTML = `Doğru cevap: <b>${esc(d.en)}</b>`;
  };
}

function checkText(m,target,inputId,resultId){
  const val=clean(m.querySelector("#"+inputId).value).toLowerCase();
  const tgt=clean(target).toLowerCase();
  const ok=val===tgt;
  const score = val ? Math.round(commonWords(val,tgt)/Math.max(1,tgt.split(/\s+/).length)*100) : 0;
  m.querySelector("#"+resultId).innerHTML = ok ? `✅ Tam doğru.` : `Benzerlik: <b>${score}%</b><br>Doğrusu: ${esc(target)}`;
}
function commonWords(a,b){
  const A=a.split(/\s+/), B=b.split(/\s+/);
  let n=0, used=new Set();
  A.forEach(x=>{
    const i=B.findIndex((y,idx)=>!used.has(idx)&&x===y);
    if(i>=0){used.add(i);n++;}
  });
  return n;
}
function listenToInput(input){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ alert("Bu tarayıcıda mikrofon konuşma tanıma desteklenmiyor."); return; }
  const r=new SR();
  r.lang="en-US"; r.interimResults=false; r.maxAlternatives=1;
  r.onresult=e=>{ input.value=e.results[0][0].transcript; };
  try{ r.start(); }catch{}
}

function enhance(){
  addStyle();
  const card=currentCard();
  if(!card || card.dataset.wordActivityButtons==="1") return;
  const anchor = card.querySelector(".extra-learning-actions") || card.querySelector(".card-actions");
  if(!anchor) return;

  const row=document.createElement("div");
  row.className="word-activity-row";
  row.innerHTML=`
    <button class="wa-btn" data-act="shadow"><b>🎧</b>Shadow</button>
    <button class="wa-btn" data-act="story"><b>📖</b>Hikaye</button>
    <button class="wa-btn" data-act="podcast"><b>🎙️</b>Podcast</button>
    <button class="wa-btn" data-act="speak"><b>💬</b>Konuş</button>
    <button class="wa-btn wa-similar" data-act="similar"><b>✨</b>Benzer</button>
    <button class="wa-btn wa-test" data-act="test"><b>📝</b>AI Test</button>
  `;
  row.querySelector('[data-act="shadow"]').onclick=()=>showShadow(card);
  row.querySelector('[data-act="story"]').onclick=()=>showStory(card);
  row.querySelector('[data-act="podcast"]').onclick=()=>showPodcast(card);
  row.querySelector('[data-act="speak"]').onclick=()=>showSpeak(card);
  row.querySelector('[data-act="similar"]').onclick=()=>showSimilar(card);
  row.querySelector('[data-act="test"]').onclick=()=>showAITest(card);

  anchor.insertAdjacentElement("afterend", row);
  card.dataset.wordActivityButtons="1";
}

let t=null;
function schedule(){ clearTimeout(t); t=setTimeout(enhance,130); }
document.addEventListener("DOMContentLoaded",()=>{
  enhance();
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
});
window.addEventListener("load", enhance);
})();