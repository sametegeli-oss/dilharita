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
  /* Dinle'nin altına taşınan Zor/Normal/Kolay grubu */
  .dh-grade-under-listen{ margin-top:8px !important; }
  /* Yukarı taşınan gerçek Sonraki butonu — kart içindeki sıraya uysun */
  .dh-next-moved{ margin:0 !important; }
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
  /* Bu sayfada (sentence mode) AI Prompt düğmesi görünmesin */
  #dhAiPromptBtn{ display:none !important; }
  /* Ana menüye dönüş: çalışma ekranındaki gibi geri ok */
  .index-app-top-actions a.dh-back-arrow{
    width:42px;height:42px;min-height:42px;padding:0;
    font-size:20px;font-weight:900;line-height:1;
    border-radius:12px;
  }
  .dh-list-btn{
    background:#13294d;border:1px solid #1e3a5f;color:#e8eef7;
    border-radius:12px;padding:9px 13px;font:800 13px system-ui,sans-serif;cursor:pointer;min-height:42px;
  }
  .dh-list-modal{
    position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:2147483000;
    display:none;align-items:center;justify-content:center;padding:16px;
  }
  .dh-list-modal.show{display:flex}
  .dh-list-box{
    background:#0f1f3a;border:1px solid #1e3a5f;border-radius:16px;
    width:min(640px,100%);max-height:85vh;display:flex;flex-direction:column;overflow:hidden;
  }
  .dh-list-headbar{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #1e3a5f;color:#e8eef7;font-size:16px}
  .dh-list-headbar button{background:#13294d;border:1px solid #1e3a5f;color:#e8eef7;border-radius:8px;width:32px;height:32px;font-size:16px;cursor:pointer}
  .dh-list-body{overflow-y:auto;padding:8px}
  .dh-list-loading{padding:24px;text-align:center;color:#9fb3d9}
  .dh-list-row{display:flex;gap:10px;align-items:flex-start;padding:10px;border-bottom:1px solid #1e3a5f}
  .dh-list-row.active{background:#1e3a5f55;border-radius:8px}
  .dh-list-n{flex:0 0 auto;width:24px;height:24px;border-radius:50%;background:#2563eb;color:#fff;display:grid;place-items:center;font-size:11px;font-weight:900;margin-top:2px}
  .dh-list-txt{flex:1;min-width:0}
  .dh-list-e{color:#34d399;font-weight:700;font-size:14px}
  .dh-list-t{color:#9fb3d9;font-size:13px;margin-top:2px}
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
    <a class="home dh-back-arrow" href="./index.html" title="Ana menü">←</a>
    <button type="button" class="dh-list-btn" id="dhModuleListBtn" title="Modül cümleleri">📋 Liste</button>
  `;
  document.body.appendChild(row);
  const lb = row.querySelector("#dhModuleListBtn");
  if (lb) lb.onclick = openModuleList;
}

// --- Modül cümle listesi ---
var _sentencesCache = null;
function loadAllSentences(){
  if (_sentencesCache) return Promise.resolve(_sentencesCache);
  return fetch("./data/sentences.json").then(r=>r.ok?r.json():[]).then(function(arr){
    var list = Array.isArray(arr) ? arr.slice() : [];
    // OCR cümlelerini de ekle
    try{
      var ocr = JSON.parse(localStorage.getItem("dh-ocr-sentences-v1")||"[]")||[];
      ocr.forEach(function(s){ if(s&&s.en) list.push({en:s.en,tr:s.tr||"",module:"📷 OCR Cümlelerim",order:s.order||0}); });
    }catch(e){}
    _sentencesCache = list;
    return list;
  }).catch(function(){ return []; });
}
function currentModuleName(){
  var el = document.querySelector(".study-title");
  return el ? (el.textContent||"").trim() : "";
}
function currentSentenceEN(){
  var c = currentCard();
  return c ? clean(c.querySelector(".card-en")?.innerText||"") : "";
}
function escH(s){ return String(s==null?"":s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];}); }

function openModuleList(){
  var modName = currentModuleName();
  ensureListModal();
  var modal = document.getElementById("dhListModal");
  var body = document.getElementById("dhListBody");
  var head = document.getElementById("dhListHead");
  head.textContent = modName ? ("📋 "+modName) : "📋 Modül cümleleri";
  body.innerHTML = '<div class="dh-list-loading">Yükleniyor…</div>';
  modal.classList.add("show");

  loadAllSentences().then(function(all){
    // modül adını normalize ederek eşleştir (DOM'daki ad json'dakiyle birebir olmayabilir)
    var key = modName.toLowerCase().replace(/\s+/g," ").trim();
    var rows = all.filter(function(s){
      var m = (s.module||"").toLowerCase().replace(/\s+/g," ").trim();
      return m === key || (key && m.indexOf(key)===0) || (m && key.indexOf(m)===0);
    });
    if(!rows.length){
      // eşleşme yoksa: modül kodu (A2-M01) ile dene
      var codeMatch = (modName.match(/[A-C][12]-M\d+/)||[])[0];
      if(codeMatch){
        rows = all.filter(function(s){ return (s.module||"").indexOf(codeMatch)!==-1; });
      }
    }
    rows.sort(function(a,b){ return (a.order||0)-(b.order||0); });
    if(!rows.length){
      body.innerHTML = '<div class="dh-list-loading">Bu modülün cümleleri bulunamadı.</div>';
      return;
    }
    var curEN = currentSentenceEN().toLowerCase().trim();
    body.innerHTML = rows.map(function(s,i){
      var active = curEN && (s.en||"").toLowerCase().trim()===curEN;
      return '<div class="dh-list-row'+(active?" active":"")+'">'
        + '<div class="dh-list-n">'+(i+1)+'</div>'
        + '<div class="dh-list-txt"><div class="dh-list-e">'+escH(s.en)+'</div><div class="dh-list-t">'+escH(s.tr||"")+'</div></div>'
        + '</div>';
    }).join("");
    // aktif olana kaydır
    var act = body.querySelector(".dh-list-row.active");
    if(act) act.scrollIntoView({block:"center"});
  });
}
function ensureListModal(){
  if(document.getElementById("dhListModal")) return;
  var m = document.createElement("div");
  m.id = "dhListModal";
  m.className = "dh-list-modal";
  m.innerHTML = '<div class="dh-list-box">'
    + '<div class="dh-list-headbar"><b id="dhListHead">📋 Modül cümleleri</b><button id="dhListClose">✕</button></div>'
    + '<div class="dh-list-body" id="dhListBody"></div>'
    + '</div>';
  document.body.appendChild(m);
  m.onclick = function(e){ if(e.target===m) m.classList.remove("show"); };
  m.querySelector("#dhListClose").onclick = function(){ m.classList.remove("show"); };
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
  const url = "./teacher.html?s=" + encodeURIComponent(en) +
    (tr ? "&t=" + encodeURIComponent(tr) : "") + "&embed=1";
  openTeacherOverlay(url);
}

// Öğretmeni çalışma sayfasının ÜSTÜNDE tam ekran iframe katmanı olarak açar.
// Çalışma sayfası arkada açık/aktif kalır; katman kapanınca aynı cümleden devam edilir.
function openTeacherOverlay(url){
  let ov = document.getElementById("teacherOverlay");
  if (ov) ov.remove(); // varsa eskisini temizle
  ov = document.createElement("div");
  ov.id = "teacherOverlay";
  ov.style.cssText = [
    "position:fixed","inset:0","z-index:2147483000",
    "background:#0b1120","display:flex","flex-direction:column"
  ].join(";");

  const bar = document.createElement("div");
  bar.style.cssText = [
    "flex:0 0 auto","display:flex","align-items:center","gap:10px",
    "padding:10px 14px","background:#0b1120","border-bottom:1px solid #ffffff14"
  ].join(";");
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "← Çalışmaya dön";
  closeBtn.style.cssText = [
    "border:none","cursor:pointer","border-radius:12px","padding:10px 14px",
    "background:linear-gradient(135deg,#34d399,#16a34a)","color:#fff",
    "font:800 14px system-ui,sans-serif"
  ].join(";");
  closeBtn.onclick = closeTeacherOverlay;
  bar.appendChild(closeBtn);

  const frame = document.createElement("iframe");
  frame.src = url;
  frame.style.cssText = "flex:1 1 auto;width:100%;border:0;background:#0b1120";
  frame.setAttribute("allow", "microphone; autoplay");

  ov.appendChild(bar);
  ov.appendChild(frame);
  document.body.appendChild(ov);
  document.body.style.overflow = "hidden"; // arka plan kaymasın
}

function closeTeacherOverlay(){
  const ov = document.getElementById("teacherOverlay");
  if (ov) ov.remove();
  document.body.style.overflow = ""; // arka planı geri aç
}

// teacher.html (iframe içinden) kapatma isteği gönderebilsin diye dinleyici
window.addEventListener("message", function(ev){
  if (ev && ev.data === "dh-teacher-close") closeTeacherOverlay();
});

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
  if (!card) return;
  const actions = card.querySelector(".card-actions");
  if (!actions) return;

  // Zayıf Analiz + Öğretmene Sor satırını ekle (yalnız bir kez)
  if (card.dataset.extraLearningButtons !== "1"){
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

  // İstenen yeni düzeni uygula (her render'da güvenli, idempotent)
  relayoutButtons(card);
}

// Buton metnine göre bul (React minified sınıflarına bağlı kalmamak için)
function findBtnByText(root, txt){
  const btns = [...root.querySelectorAll("button, a")];
  const t = txt.toLocaleLowerCase("tr");
  return btns.find(b => (b.textContent||"").toLocaleLowerCase("tr").includes(t)) || null;
}

function relayoutButtons(card){
  try{
    const actions = card.querySelector(".card-actions");
    if (!actions) return;

    // 1) "Öğretmen" butonunu kaldır; GERÇEK alttaki "Sonraki →" butonunu onun yerine taşı.
    //    (Sahte kopya çalışmıyordu — gerçek butonu taşımak hem çalışır hem doğru yerde durur.)
    const ogretmenBtn = [...actions.querySelectorAll("button,a")].find(b => {
      const t = (b.textContent||"").toLocaleLowerCase("tr").trim();
      return t.includes("öğretmen") && !t.includes("sor");
    });
    // gerçek "Sonraki →" butonu: kartın DIŞINDA, sayfanın altındaki
    let realNext = null;
    const allNext = [...document.querySelectorAll("button,a")].filter(b => {
      const t = (b.textContent||"").toLocaleLowerCase("tr").trim();
      return t.includes("sonraki");
    });
    // kartın içindeki (benim eklediğim eski sahte) hariç, dışarıdaki gerçek olanı seç
    realNext = allNext.find(b => !card.contains(b)) || null;

    if (ogretmenBtn && realNext && !realNext.dataset.dhMovedUp){
      realNext.dataset.dhMovedUp = "1";
      realNext.classList.add("dh-next-moved");
      // Öğretmen butonunun yerine gerçek Sonraki'yi koy
      ogretmenBtn.replaceWith(realNext);
    } else if (realNext && realNext.dataset.dhMovedUp === "1"){
      // zaten taşındı: kart yeniden render olduysa actions içinde değilse geri yerleştir
      if (ogretmenBtn) ogretmenBtn.replaceWith(realNext);
    }

    // 2) "Zayıf Analiz"i Detay butonunun yanına taşı
    const detayBtn = findBtnByText(actions, "detay");
    const weakRow = card.querySelector(".extra-learning-actions");
    const weakBtn = weakRow ? weakRow.querySelector(".extra-weak") : null;
    if (detayBtn && weakBtn && weakBtn.parentElement !== actions){
      detayBtn.insertAdjacentElement("afterend", weakBtn);
    }

    // 3) Zor / Normal / Kolay butonlarını "Dinle"nin altına taşı
    const dinleBtn = findBtnByText(card, "dinle");
    if (dinleBtn){
      // zorluk butonlarını sayfada bul (metinleri: Zor / Normal / Kolay)
      const zor = findBtnByText(document, "zor");
      const normal = findBtnByText(document, "normal");
      const kolay = findBtnByText(document, "kolay");
      if (zor && normal && kolay && !card.querySelector(".dh-grade-under-listen")){
        const wrap = zor.parentElement; // üç butonun ortak kabı
        if (wrap && [zor,normal,kolay].every(b => wrap.contains(b))){
          wrap.classList.add("dh-grade-under-listen");
          // Dinle butonunun hemen altına taşı
          const host = dinleBtn.closest(".card-actions") || dinleBtn.parentElement;
          host.insertAdjacentElement("afterend", wrap);
        }
      }
    }
  }catch(e){ /* sessiz: düzen bozulursa orijinal kalır */ }
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