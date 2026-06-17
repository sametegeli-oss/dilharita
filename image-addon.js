/* ============================================================
   image-addon.js — Cümle görseli (index.html için)
   app.js'e DOKUNMAZ. Modül çalışma kartını izler, cümleyi yakalar,
   imgQuery ile açık kaynaktan (Openverse → Wikimedia Commons →
   Wikipedia) resim çeker, kartta cümlenin üstüne büyük resmi koyar.
   Bulunan URL IndexedDB'ye cache'lenir (bir daha aranmaz).
   ============================================================ */
(function(){
"use strict";

/* ---------- IndexedDB cache (resim URL'leri) ---------- */
const DB_NAME = "sentence-mode", STORE = "kv", IMG_PREFIX = "img:";
let _db = null;
function openDB(){
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const idb = window.indexedDB;
    if (!idb || typeof idb.open !== "function") return rej("no-idb");
    const r = idb.open(DB_NAME, 1);
    r.onupgradeneeded = () => { const db=r.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
async function cacheGet(key){
  try{
    const db = await openDB();
    return await new Promise((res,rej)=>{ const rq=db.transaction(STORE,"readonly").objectStore(STORE).get(IMG_PREFIX+key); rq.onsuccess=()=>res(rq.result||null); rq.onerror=()=>rej(rq.error); });
  }catch{
    try{ return window.localStorage.getItem(IMG_PREFIX+key); }catch{ return null; }
  }
}
async function cacheSet(key, val){
  try{
    const db = await openDB();
    await new Promise((res,rej)=>{ const rq=db.transaction(STORE,"readwrite").objectStore(STORE).put(val, IMG_PREFIX+key); rq.onsuccess=()=>res(); rq.onerror=()=>rej(rq.error); });
  }catch{
    try{ window.localStorage.setItem(IMG_PREFIX+key, val); }catch{}
  }
}

/* ---------- cümle -> imgQuery eşlemesi (data/sentences.json) ---------- */
let _imgMap = null;   // en cümlesi (normalize) -> imgQuery
let _loadingMap = null;
function normEn(s){ return (s||"").toLowerCase().replace(/\s+/g," ").replace(/[^a-z0-9' ]/g,"").trim(); }
function loadMap(){
  if (_imgMap) return Promise.resolve(_imgMap);
  if (_loadingMap) return _loadingMap;
  _loadingMap = (async () => {
    const paths = ["data/sentences.json","sentences.json","./data/sentences.json"];
    for (const p of paths){
      try{
        const r = await fetch(p); if(!r.ok) continue;
        const arr = await r.json();
        const m = {};
        for (const s of arr){ if (s.en && s.imgQuery) m[normEn(s.en)] = s.imgQuery; }
        _imgMap = m; return m;
      }catch{}
    }
    _imgMap = {}; return _imgMap;
  })();
  return _loadingMap;
}

/* ---------- görsel kaynakları: Openverse → Commons → Wikipedia ---------- */
async function fromOpenverse(q){
  try{
    const r = await fetch("https://api.openverse.org/v1/images/?q="+encodeURIComponent(q)+"&page_size=1&mature=false", {headers:{"Accept":"application/json"}});
    if(!r.ok) return null;
    const j = await r.json();
    const f = (j.results||[])[0];
    return f ? (f.thumbnail || f.url) : null;
  }catch{ return null; }
}
async function fromCommons(q){
  try{
    const r = await fetch("https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch="+encodeURIComponent("filetype:bitmap "+q)+"&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=600");
    const j = await r.json();
    const pages = (j.query&&j.query.pages)||{};
    for (const p in pages){ const ii=pages[p].imageinfo&&pages[p].imageinfo[0]; if(ii&&ii.thumburl) return ii.thumburl; }
    return null;
  }catch{ return null; }
}
async function fromWikipedia(q){
  try{
    const s = await fetch("https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch="+encodeURIComponent(q)+"&srlimit=1");
    const sj = await s.json(); const hit=(sj.query&&sj.query.search||[])[0]; if(!hit) return null;
    const r = await fetch("https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=600&pageids="+hit.pageid);
    const rj = await r.json(); const pages=(rj.query&&rj.query.pages)||{};
    for (const p in pages){ if(pages[p].thumbnail) return pages[p].thumbnail.source; }
    return null;
  }catch{ return null; }
}
// sırayla dene: Openverse -> Commons -> Wikipedia
async function findImage(query){
  for (const fn of [fromOpenverse, fromCommons, fromWikipedia]){
    const url = await fn(query);
    if (url) return url;
  }
  return null;
}

/* ---------- kart üzerine resmi yerleştir ---------- */
let _busyFor = null;   // şu an aranan cümle (çift istek önleme)

async function ensureImageFor(card){
  const enEl = card.querySelector(".card-en");
  if (!enEl) return;
  const enText = enEl.textContent.trim();
  if (!enText) return;
  const key = normEn(enText);
  if (!key) return;

  // zaten bu cümle için resim var mı (kartta)?
  const existing = card.querySelector(".sm-img-wrap");
  if (existing && existing.dataset.key === key) return;   // doğru resim duruyor
  if (existing) existing.remove();                         // eski cümlenin resmi -> kaldır

  if (_busyFor === key) return;
  _busyFor = key;

  // imgQuery'yi bul
  const map = await loadMap();
  const q = map[key];
  // sorgu yoksa: cümlenin kendisinden basit bir terim türet (yedek)
  const query = q || enText;

  // cache'te var mı?
  let url = null;
  try{ url = await cacheGet(key); }catch{}
  if (url === "NONE"){ _busyFor=null; return; }   // daha önce bulunamadı, tekrar deneme

  if (!url){
    url = await findImage(query);
    await cacheSet(key, url || "NONE");
  }
  _busyFor = null;
  if (!url) return;

  // hâlâ aynı cümle ekranda mı? (kullanıcı geçmiş olabilir)
  const curEnEl = card.querySelector(".card-en");
  if (!curEnEl || normEn(curEnEl.textContent.trim()) !== key) return;
  if (card.querySelector(".sm-img-wrap")) return;

  // resmi card-meta'dan sonra (cümlenin üstüne) ekle
  const wrap = document.createElement("div");
  wrap.className = "sm-img-wrap";
  wrap.dataset.key = key;
  const img = document.createElement("img");
  img.className = "sm-img";
  img.alt = "";
  img.loading = "lazy";
  img.src = url;
  img.onerror = () => { wrap.remove(); cacheSet(key, "NONE"); };
  wrap.appendChild(img);

  const meta = card.querySelector(".card-meta");
  if (meta && meta.parentNode === card){ meta.insertAdjacentElement("afterend", wrap); }
  else { card.insertBefore(wrap, curEnEl); }
}

/* ---------- kartı izle (app.js kartı her cümlede yeniden çiziyor) ---------- */
function scan(){
  const card = document.querySelector(".card");
  if (card && card.querySelector(".card-en")) ensureImageFor(card);
}
function start(){
  // stil enjekte et
  const css = document.createElement("style");
  css.textContent = `
    .sm-img-wrap{margin:0 0 16px;border-radius:14px;overflow:hidden;border:1px solid #ffffff14;
      background:#0f172a;line-height:0;animation:smImgIn .3s ease}
    .sm-img{width:100%;height:auto;max-height:260px;object-fit:cover;display:block}
    @keyframes smImgIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`;
  document.head.appendChild(css);

  // DOM değişimlerini izle (kart her cümlede yeniden render ediliyor)
  const mo = new MutationObserver(() => scan());
  mo.observe(document.body, { childList:true, subtree:true });
  scan();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();

})();
