/* word-local-tools-launcher.js
   DİLHARİTA içinde /word'den alınan orijinal araçları yerel kopya olarak açar.
   /word klasörünü kullanmaz, /word tarafına dosya yükletmez.
*/
(function(){
"use strict";

const STYLE_ID = "word-local-tools-launcher-style-v1";
const LOCAL_TOOL_URL = "./wordtools/index.html";

function addStyle(){
  if(document.getElementById(STYLE_ID)) return;
  const s=document.createElement("style");
  s.id=STYLE_ID;
  s.textContent=`
  .word-local-row{
    display:flex;
    flex-wrap:wrap;
    gap:10px;
    margin-top:14px;
    padding:14px;
    border:1px solid rgba(255,255,255,.10);
    border-radius:18px;
    background:rgba(255,255,255,.035);
  }
  .word-local-row .wl-btn{
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
  .word-local-row .wl-btn:hover{background:#22304f;transform:translateY(-1px)}
  .word-local-row .wl-btn b{font-size:20px;line-height:1}
  .word-local-row .wl-test{background:#3b2a09;border-color:#f59e0b66;color:#fde68a}
  .word-local-row .wl-ai{background:#12315f;border-color:#3b82f666;color:#93c5fd}
  @media(max-width:760px){
    .word-local-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px}
    .word-local-row .wl-btn{min-width:0;min-height:56px;font-size:12px}
    .word-local-row .wl-btn b{font-size:18px}
  }`;
  document.head.appendChild(s);
}
function clean(s){return String(s||"").replace(/\s+/g," ").trim();}
function currentCard(){
  const cards=[...document.querySelectorAll(".card")];
  return cards.find(c => c.querySelector(".card-en") && c.querySelector(".card-actions"));
}
function payload(card){
  const en = clean(card?.querySelector(".card-en")?.innerText || "");
  const tr = clean(card?.querySelector(".card-tr")?.innerText || "");
  const pron = clean(card?.querySelector(".card-pron")?.innerText || "");
  const ipa = clean(card?.querySelector(".card-ipa")?.innerText || "");
  const module = clean(document.querySelector(".study-title")?.innerText || "");
  const firstWord = (en.match(/[A-Za-z']+/)||["sentence"])[0].toLowerCase();
  return {
    word:firstWord,
    tr:tr,
    translation:tr,
    sentence:en,
    sentenceTr:tr,
    trPron:pron,
    phonetic:ipa,
    level:clean(card?.querySelector(".chip-level")?.innerText || ""),
    topic:module,
    module:module,
    addedAt:Date.now()
  };
}
function launch(tool, card){
  const p = payload(card);
  p.tool = tool;
  try{
    localStorage.setItem("wm_bridge_sentence", JSON.stringify(p));

    // Orijinal WordMode loadLastFile/Story/Shadow gibi fonksiyonların veri bulması için
    // yerel kopyaya küçük bir çalışma listesi bırakıyoruz.
    const list = [p];
    const words = (p.sentence||"").match(/[A-Za-z']+/g) || [];
    words.slice(0,8).forEach((w,i)=>{
      const low = w.toLowerCase();
      if(!list.some(x=>String(x.word||"").toLowerCase()===low)){
        list.push({
          word:low,
          tr:"",
          translation:"",
          sentence:p.sentence,
          sentenceTr:p.sentenceTr,
          phonetic:"",
          level:p.level||"A1",
          topic:p.topic||"Dil Harita",
          addedAt:Date.now()+i
        });
      }
    });
    localStorage.setItem("lastFileData", JSON.stringify(list));
    localStorage.setItem("lastUploadedFile", JSON.stringify({
      name:"Dil Harita aktif cümle",
      size:JSON.stringify(list).length,
      wordCount:list.length,
      uploadDate:new Date().toISOString(),
      fileKey:"dilharita-active-sentence"
    }));

    // Hikaye orijinal fonksiyonu ezberlenecekler listesinden çalışıyor.
    words.slice(0,8).forEach((w,i)=>{
      const key="toLearnWords_bridge_"+i;
      localStorage.setItem(key, JSON.stringify({
        word:w.toLowerCase(),
        tr:"",
        sentence:p.sentence,
        sentenceTr:p.sentenceTr,
        phonetic:"",
        level:p.level||"A1",
        topic:p.topic||"Dil Harita"
      }));
    });
  }catch(e){}
  location.href = LOCAL_TOOL_URL + "?wmTool=" + encodeURIComponent(tool) + "&from=dilharita&t=" + Date.now();
}
function enhance(){
  addStyle();
  const card=currentCard();
  if(!card || card.dataset.wordLocalTools==="1") return;
  const anchor = card.querySelector(".extra-learning-actions") || card.querySelector(".card-actions");
  if(!anchor) return;

  const row=document.createElement("div");
  row.className="word-local-row";
  row.innerHTML=`
    <button class="wl-btn" data-tool="conversation"><b>🗣️</b>Konuşma</button>
    <button class="wl-btn" data-tool="sentence"><b>🔤</b>Cümle Modu</button>
    <button class="wl-btn" data-tool="shadow"><b>👥</b>Shadow</button>
    <button class="wl-btn wl-test" data-tool="quiz"><b>📝</b>AI Test</button>
    <button class="wl-btn wl-ai" data-tool="story"><b>📖</b>Hikaye</button>
    <button class="wl-btn wl-ai" data-tool="podcast"><b>🎧</b>Podcast</button>
    <button class="wl-btn wl-ai" data-tool="visual"><b>🖼️</b>Görsel</button>
  `;
  row.querySelectorAll("[data-tool]").forEach(btn=>{
    btn.onclick=()=>launch(btn.dataset.tool, card);
  });
  anchor.insertAdjacentElement("afterend", row);
  card.dataset.wordLocalTools="1";
}
let timer=null;
function schedule(){ clearTimeout(timer); timer=setTimeout(enhance,120); }
document.addEventListener("DOMContentLoaded",()=>{
  enhance();
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
});
window.addEventListener("load", enhance);
})();