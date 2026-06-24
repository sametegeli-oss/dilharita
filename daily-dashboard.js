/* daily-dashboard.js
   Ana menüye Bugünkü Çalışma Paneli ekler.
   Hata Defteri + Akıllı Tekrar kayıtlarını okur; kullanıcıya bugün ne çalışacağını gösterir.
*/
(function(){
"use strict";

const STYLE_ID = "daily-dashboard-style-v1";

function style(){
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
  .daily-panel{
    margin:18px 0 20px;
    background:linear-gradient(180deg,#10264a,#0b172d);
    border:1px solid #60a5fa44;
    border-radius:22px;
    padding:18px;
    box-shadow:0 18px 46px #0005;
  }
  .daily-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
  .daily-title{font-size:22px;font-weight:950;color:#fff}
  .daily-sub{font-size:13px;color:#9fb0c8;margin-top:3px}
  .daily-refresh{border:1px solid #ffffff22;border-radius:12px;background:#1d2b48;color:#fff;padding:9px 12px;font-weight:900;cursor:pointer}
  .daily-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
  .daily-stat{background:#08172d;border:1px solid #ffffff14;border-radius:16px;padding:13px}
  .daily-num{font-size:28px;font-weight:950;color:#fff;line-height:1}
  .daily-label{font-size:12px;color:#9fb0c8;margin-top:6px}
  .daily-plan{display:grid;grid-template-columns:1.15fr 1fr;gap:12px;margin-top:12px}
  .daily-box{background:#08172d;border:1px solid #ffffff14;border-radius:16px;padding:14px}
  .daily-box h3{margin:0 0 10px;font-size:15px;color:#dbeafe}
  .daily-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
  .daily-list li{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed #ffffff12;padding-bottom:7px;color:#cbd5e1;font-size:13px}
  .daily-list li:last-child{border-bottom:0;padding-bottom:0}
  .daily-pill{border-radius:999px;background:#1d4ed8;color:#fff;font-size:11px;font-weight:900;padding:2px 8px;white-space:nowrap}
  .daily-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
  .daily-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;color:#fff;border-radius:13px;padding:11px 14px;font-weight:900;background:#2563eb;border:1px solid #ffffff18}
  .daily-action.green{background:#16a34a}.daily-action.purple{background:#6d28d9}.daily-action.red{background:#b91c1c}
  @media(max-width:760px){
    .daily-grid{grid-template-columns:repeat(2,1fr)}
    .daily-plan{grid-template-columns:1fr}
    .daily-head{align-items:flex-start}
    .daily-title{font-size:20px}
    .daily-actions{display:grid;grid-template-columns:1fr 1fr}
  }`;
  document.head.appendChild(s);
}

function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]))}
function clean(s){return String(s||"").replace(/\s+/g," ").trim();}
function fallbackErrors(){
  try{return JSON.parse(localStorage.getItem("learning-errors-v1")||"[]")}catch{return []}
}
async function getErrors(){
  if (window.LearningErrorDB && typeof LearningErrorDB.all === "function"){
    try{return await LearningErrorDB.all()}catch{}
  }
  return fallbackErrors();
}
function summarizeErrors(records){
  const arr = Array.isArray(records) ? records : [];
  const byType = {};
  const byModule = {};
  const high = arr.filter(r => r.reviewPriority === "high" || Number(r.score||0) < 55);
  for (const r of arr){
    (r.types || [r.primaryType || "general"]).forEach(t => byType[t] = (byType[t]||0)+1);
    const m = clean(r.module || "Modül yok");
    byModule[m] = (byModule[m]||0)+1;
  }
  const top = obj => Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return {total:arr.length, high:high.length, byType:top(byType), byModule:top(byModule)};
}

function countLocalSrs(){
  let due = 0, learned = 0, worked = 0;
  const now = Date.now();
  try{
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i) || "";
      if(!/srs|learn|progress|sentence/i.test(k)) continue;
      const raw = localStorage.getItem(k);
      if(!raw) continue;
      worked++;
      try{
        const v = JSON.parse(raw);
        const flat = Array.isArray(v) ? v : (v && typeof v === "object" ? Object.values(v) : []);
        flat.forEach(r=>{
          if(!r || typeof r !== "object") return;
          if((r.rep||r.reps||0)>0 || r.learned) learned++;
          if((r.due||0) && (r.due||0)<=now) due++;
        });
      }catch{}
    }
  }catch{}
  return {due, learned, worked};
}

function planList(summary){
  const items = [];
  if(summary.high > 0) items.push(["Yüksek öncelikli hatalar", summary.high, "./akilli-tekrar.html"]);
  if(summary.byType[0]) items.push([`En zayıf konu: ${summary.byType[0][0]}`, summary.byType[0][1], "./hata-defteri.html"]);
  if(summary.byModule[0]) items.push([`En çok hata yapılan modül: ${summary.byModule[0][0]}`, summary.byModule[0][1], "./hata-defteri.html"]);
  items.push(["Fotoğraflı cümle öğren", "devam", "./index-app.html"]);
  items.push(["Video telaffuz çalışması", "pekiştir", "./videopractice.html"]);
  return items.slice(0,5);
}

function renderPanel(summary, srs){
  let host = document.querySelector(".daily-panel");
  if (!host){
    host = document.createElement("section");
    host.className = "daily-panel";
    const grid = document.querySelector(".grid");
    if(grid) grid.parentNode.insertBefore(host, grid);
    else document.body.prepend(host);
  }
  const weakType = summary.byType[0] ? summary.byType[0][0] : "Henüz yok";
  const weakModule = summary.byModule[0] ? summary.byModule[0][0] : "Henüz yok";
  const plan = planList(summary);

  host.innerHTML = `
    <div class="daily-head">
      <div>
        <div class="daily-title">📅 Bugünkü Çalışma Paneli</div>
        <div class="daily-sub">Hata Defteri + Akıllı Tekrar kayıtlarına göre önerilen günlük plan.</div>
      </div>
      <button class="daily-refresh" id="dailyRefresh">Yenile</button>
    </div>
    <div class="daily-grid">
      <div class="daily-stat"><div class="daily-num">${summary.high}</div><div class="daily-label">öncelikli hata</div></div>
      <div class="daily-stat"><div class="daily-num">${summary.total}</div><div class="daily-label">hata kaydı</div></div>
      <div class="daily-stat"><div class="daily-num">${srs.due}</div><div class="daily-label">tekrar bekleyen</div></div>
      <div class="daily-stat"><div class="daily-num">${srs.learned}</div><div class="daily-label">öğrenilmiş kayıt</div></div>
    </div>
    <div class="daily-plan">
      <div class="daily-box">
        <h3>Bugünkü önerilen sıra</h3>
        <ul class="daily-list">
          ${plan.map(([name,count,url])=>`<li><a href="${url}" style="color:#dbeafe;text-decoration:none">${esc(name)}</a><span class="daily-pill">${esc(count)}</span></li>`).join("")}
        </ul>
      </div>
      <div class="daily-box">
        <h3>Zayıf analiz özeti</h3>
        <ul class="daily-list">
          <li><span>Zayıf konu</span><span class="daily-pill">${esc(weakType)}</span></li>
          <li><span>Zayıf modül</span><span class="daily-pill">${esc(weakModule)}</span></li>
          <li><span>Öneri</span><span class="daily-pill">${summary.high ? "Akıllı tekrar" : "Yeni cümle çalış"}</span></li>
        </ul>
      </div>
    </div>
  `;
  document.getElementById("dailyRefresh").onclick = boot;
}

async function boot(){
  try{
    style();
    const errors = await getErrors();
    const summary = summarizeErrors(errors);
    const srs = countLocalSrs();
    renderPanel(summary, srs);
  }catch(e){
    try{ style(); renderPanel({total:0,high:0,byType:[],byModule:[]},{due:0,learned:0,worked:0}); }catch(_){}
    console.warn("daily-dashboard boot hata:",e);
  }
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
})();