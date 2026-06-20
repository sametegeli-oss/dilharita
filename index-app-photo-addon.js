/* index-app-photo-addon.js
   Fotoğraflı Cümle Öğren ekranında cümle kartına otomatik fotoğraf ekler.
   assets/app.js'e dokunmaz; aktif cümleyi okuyup üstüne görsel yerleştirir.
*/
(function(){
"use strict";

const STYLE_ID = "index-app-photo-addon-style-v1";

const PHOTO_LIBRARY = [
  {keys:["apartment","flat","home","house","lived","live","daire","ev"], url:"https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80"},
  {keys:["family","mother","father","brother","sister","aile"], url:"https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=80"},
  {keys:["food","drink","restaurant","coffee","tea","breakfast","eat","içmek","yemek"], url:"https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80"},
  {keys:["shopping","shop","buy","store","market","alışveriş"], url:"https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80"},
  {keys:["weather","rain","sunny","snow","wind","hava"], url:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80"},
  {keys:["school","student","learn","lesson","study","öğren"], url:"https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1200&q=80"},
  {keys:["work","office","job","business","çalış"], url:"https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80"},
  {keys:["travel","airport","hotel","trip","reservation","seyahat","otel"], url:"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80"},
  {keys:["doctor","hospital","health","hasta","doktor"], url:"https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80"},
  {keys:["football","sport","played","game","oynadım"], url:"https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&w=1200&q=80"},
  {keys:["letter","wrote","write","mail","mektup","yazdı"], url:"https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80"},
  {keys:["film","movie","saw","watch","cinema","film"], url:"https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80"},
  {keys:["direction","map","street","road","go","git","yol"], url:"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80"},
  {keys:["childhood","remember","past","çocukluk","hatırla"], url:"https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1200&q=80"},
  {keys:["relationship","friend","people","talk","konuş","ilişki"], url:"https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80"},
  {keys:["default"], url:"https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80"}
];

function addStyle(){
  if(document.getElementById(STYLE_ID)) return;
  const s=document.createElement("style");
  s.id=STYLE_ID;
  s.textContent=`
  .sentence-photo-box{
    width:100%;
    height:260px;
    border-radius:22px;
    overflow:hidden;
    margin:0 0 18px;
    border:1px solid rgba(255,255,255,.14);
    background:#0b1528;
    box-shadow:0 16px 40px rgba(0,0,0,.25);
    position:relative;
  }
  .sentence-photo-box img{
    width:100%;
    height:100%;
    object-fit:cover;
    display:block;
  }
  .sentence-photo-box:after{
    content:"";
    position:absolute;
    inset:0;
    background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.18));
    pointer-events:none;
  }
  .sentence-photo-caption{
    position:absolute;
    left:12px;
    bottom:10px;
    z-index:2;
    color:#fff;
    background:rgba(0,0,0,.45);
    border:1px solid rgba(255,255,255,.14);
    border-radius:999px;
    padding:5px 10px;
    font:800 12px Nunito,system-ui,sans-serif;
    backdrop-filter:blur(6px);
  }
  @media(max-width:760px){
    .sentence-photo-box{height:190px;border-radius:18px;margin-bottom:14px}
  }`;
  document.head.appendChild(s);
}

function clean(s){return String(s||"").replace(/\s+/g," ").trim();}
function currentCard(){
  return [...document.querySelectorAll(".card")].find(c => c.querySelector(".card-en"));
}
function currentText(card){
  return [
    card?.querySelector(".card-en")?.innerText || "",
    card?.querySelector(".card-tr")?.innerText || "",
    document.querySelector(".study-title")?.innerText || ""
  ].join(" ").toLowerCase();
}
function pickPhoto(text){
  for(const item of PHOTO_LIBRARY){
    if(item.keys.some(k => k !== "default" && text.includes(k))) return item.url;
  }
  return PHOTO_LIBRARY[PHOTO_LIBRARY.length-1].url;
}
function photoKey(text){
  return text.toLowerCase().replace(/[^a-z0-9çğıöşü\s]/g," ").replace(/\s+/g," ").trim().slice(0,80);
}
function enhance(){
  addStyle();
  const card=currentCard();
  if(!card) return;
  const key=photoKey(currentText(card));
  const existing=card.querySelector(".sentence-photo-box");
  if(existing && existing.dataset.key === key) return;
  if(existing) existing.remove();

  const url=pickPhoto(currentText(card));
  const box=document.createElement("div");
  box.className="sentence-photo-box";
  box.dataset.key=key;
  box.innerHTML=`<img alt="Cümle görseli" src="${url}" loading="lazy"><div class="sentence-photo-caption">📸 Cümle görseli</div>`;
  const first = card.firstElementChild;
  card.insertBefore(box, first);
}

let timer=null;
function schedule(){
  clearTimeout(timer);
  timer=setTimeout(enhance,120);
}

document.addEventListener("DOMContentLoaded", ()=>{
  enhance();
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
});
window.addEventListener("load", enhance);
})();