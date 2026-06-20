/* index-app-ogretmen-analiz-buttons.js v2
   index-app.html için:
   1) her ekranda üstte Ana Menü / Hata Defteri / Akıllı Tekrar kısayolları
   2) cümle kartında Öğretmene Sor + Zayıf Analiz düğmeleri
*/
(function(){
"use strict";

const STYLE_ID = "index-app-extra-actions-style-v2";

function addStyle(){
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
  .index-app-top-actions{
    position:fixed;
    top:10px;
    left:10px;
    z-index:99998;
    display:flex;
    gap:8px;
    flex-wrap:wrap;
    pointer-events:auto;
  }
  .index-app-top-actions a{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:7px;
    min-height:38px;
    padding:8px 12px;
    border-radius:999px;
    border:1px solid rgba(255,255,255,.16);
    color:#fff;
    text-decoration:none;
    font:900 13px Nunito,system-ui,sans-serif;
    background:rgba(15,30,58,.86);
    box-shadow:0 10px 26px rgba(0,0,0,.32);
    backdrop-filter:blur(8px);
    -webkit-backdrop-filter:blur(8px);
  }
  .index-app-top-actions .home{background:linear-gradient(135deg,#16a34a,#15803d)}
  .index-app-top-actions .error{background:linear-gradient(135deg,#dc2626,#991b1b)}
  .index-app-top-actions .review{background:linear-gradient(135deg,#2563eb,#1d4ed8)}
  .extra-learning-actions{
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    margin-top:12px;
    padding-top:12px;
    border-top:1px solid rgba(255,255,255,.10);
  }
  .extra-learning-actions .extra-btn{
    border:1px solid rgba(255,255,255,.16);
    cursor:pointer;
    color:#fff;
    border-radius:12px;
    padding:10px 14px;
    font:800 14px Nunito,system-ui,sans-serif;
    background:#1d2b48;
    text-decoration:none;
    display:inline-flex;
    align-items:center;
    gap:7px;
    min-height:42px;
  }
  .extra-learning-actions .extra-teacher{background:linear-gradient(135deg,#16a34a,#15803d);border-color:#22c55e88}
  .extra-learning-actions .extra-weak{background:linear-gradient(135deg,#7c3aed,#4338ca);border-color:#a78bfa88}
  .weak-modal{
    position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
    padding:18px;background:rgba(0,0,0,.62);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);
  }
  .weak-card{
    width:min(620px,100%);max-height:82vh;overflow:auto;background:#0f1f3a;color:#edf4ff;
    border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:20px;
    box-shadow:0 24px 70px rgba(0,0,0,.55);font-family:Nunito,system-ui,sans-serif;
  }
  .weak-card h2{margin:0 0 10px;font-size:24px}
  .weak-card .weak-line{background:#0a172c;border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:12px;margin:10px 0;line-height:1.55}
  .weak-card .weak-label{color:#93c5fd;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.45px;margin-bottom:5px}
  .weak-card .weak-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
  .weak-card button,.weak-card a{border:0;border-radius:12px;background:#2563eb;color:#fff;padding:10px 14px;font-weight:900;text-decoration:none;cursor:pointer}
  .weak-card button.close{background:#334155}
  @media(max-width:760px){
    .index-app-top-actions{position:static;margin:10px;display:grid;grid-template-columns:1fr 1fr 1fr}
    .index-app-top-actions a{border-radius:12px;font-size:12px;padding:8px 6px}
    .extra-learning-actions{display:grid;grid-template-columns:1fr 1fr}
    .extra-learning-actions .extra-btn{justify-content:center;font-size:12px;padding:9px 8px}
  }`;
  document.head.appendChild(s);
}

function clean(s){ return String(s||"").replace(/\s+/g," ").trim(); }
function escapeHtml(s){ return String(s??"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

function ensureTopActions(){
  if (document.querySelector(".index-app-top-actions")) return;
  const row = document.createElement("div");
  row.className = "index-app-top-actions";
  row.innerHTML = `
    <a class="home" href="./index.html">🏠 Ana Menü</a>
    <a class="error" href="./hata-defteri.html">📌 Hata Defteri</a>
    <a class="review" href="./akilli-tekrar.html">🧠 Akıllı Tekrar</a>
  `;
  document.body.appendChild(row);
}

function currentCard(){
  const cards = [...document.querySelectorAll(".card")];
  return cards.find(c => c.querySelector(".card-en") && c.querySelector(".card-actions"));
}
function sentenceEN(card){
  return clean(card?.querySelector(".card-en")?.innerText || "");
}
function sentenceTR(card){
  return clean(card?.querySelector(".card-tr")?.innerText || "");
}

function openTeacher(card){
  const en = sentenceEN(card);
  const tr = sentenceTR(card);
  if (!en) return;
  const back = "./index-app.html";
  location.href = "./teacher.html?s=" + encodeURIComponent(en) +
    (tr ? "&t=" + encodeURIComponent(tr) : "") +
    "&return=" + encodeURIComponent(back);
}

function collectDetails(card){
  return [...card.querySelectorAll(".detail-row")].map(r => {
    const k = clean(r.querySelector(".detail-label")?.innerText || "");
    const v = clean(r.querySelector(".detail-value")?.innerText || "");
    return k && v ? [k, v] : null;
  }).filter(Boolean);
}

function inferWeakPoints(card){
  const en = sentenceEN(card);
  const tr = sentenceTR(card);
  const details = collectDetails(card);
  const text = (en+" "+details.map(x=>x.join(" ")).join(" ")).toLowerCase();
  const out = [];

  const common = details.find(([k]) => /sık yapılan hata/i.test(k));
  if (common) out.push(["Sık yapılan hata", common[1]]);
  const grammar = details.find(([k]) => /gramer|yapı/i.test(k));
  if (grammar) out.push(["Gramer yapısı", grammar[1]]);
  const pattern = details.find(([k]) => /kalıp/i.test(k));
  if (pattern) out.push(["Kalıp", pattern[1]]);

  if (/for|since/.test(text)) out.push(["Zayıf nokta", "`for / since` ayrımı: for süreyi, since başlangıç noktasını anlatır."]);
  if (/present perfect|have lived|has lived|have|has/.test(text)) out.push(["Zayıf nokta", "Present Perfect: geçmişte başlayıp şimdiyle bağlantısı devam eden durumlarda kullanılır."]);
  if (/did|didn|past simple/.test(text)) out.push(["Zayıf nokta", "Past Simple: yardımcı fiil `did` varsa ana fiil yalın hale döner."]);
  if (/\bam\b|\bis\b|\bare\b|\bwas\b|\bwere\b/.test(text)) out.push(["Zayıf nokta", "Be fiili: özneye göre `am / is / are / was / were` seçimi kontrol edilmeli."]);
  if (/\?/.test(en)) out.push(["Zayıf nokta", "Soru sırası: yardımcı fiil veya be fiili özneden önce gelir."]);
  if (!out.length) out.push(["Zayıf Analiz", "Bu cümlede özel hata notu yok. Detay düğmesine basınca gramer, kalıp ve sık hata bilgileri görünüyorsa buraya alınır."]);
  return {en,tr,out};
}

function showWeakAnalysis(card){
  const a = inferWeakPoints(card);
  const modal = document.createElement("div");
  modal.className = "weak-modal";
  modal.innerHTML = `
    <div class="weak-card">
      <h2>📉 Zayıf Analiz</h2>
      <div class="weak-line"><div class="weak-label">İngilizce</div>${escapeHtml(a.en)}</div>
      ${a.tr ? `<div class="weak-line"><div class="weak-label">Türkçe</div>${escapeHtml(a.tr)}</div>` : ""}
      ${a.out.map(([k,v]) => `<div class="weak-line"><div class="weak-label">${escapeHtml(k)}</div>${escapeHtml(v)}</div>`).join("")}
      <div class="weak-actions">
        <a href="./hata-defteri.html">📌 Hata Defteri</a>
        <a href="./akilli-tekrar.html">🧠 Akıllı Tekrar</a>
        <button class="close" type="button">Kapat</button>
      </div>
    </div>`;
  modal.querySelector(".close").onclick = () => modal.remove();
  modal.onclick = e => { if(e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

function enhanceCard(){
  const card = currentCard();
  if (!card || card.dataset.extraLearningButtons === "1") return;
  const actions = card.querySelector(".card-actions");
  if (!actions) return;

  const row = document.createElement("div");
  row.className = "extra-learning-actions";
  row.innerHTML = `
    <button type="button" class="extra-btn extra-teacher">🎓 Öğretmene Sor</button>
    <button type="button" class="extra-btn extra-weak">📉 Zayıf Analiz</button>
  `;
  row.querySelector(".extra-teacher").onclick = () => openTeacher(card);
  row.querySelector(".extra-weak").onclick = () => showWeakAnalysis(card);
  actions.insertAdjacentElement("afterend", row);
  card.dataset.extraLearningButtons = "1";
}

function enhance(){
  addStyle();
  ensureTopActions();
  enhanceCard();
}

let timer = null;
function schedule(){
  clearTimeout(timer);
  timer = setTimeout(enhance, 120);
}

document.addEventListener("DOMContentLoaded", () => {
  enhance();
  new MutationObserver(schedule).observe(document.body, {childList:true, subtree:true});
});
window.addEventListener("load", enhance);
})();