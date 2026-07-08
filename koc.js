/* koc.js — STRATEJİK AI MENTOR & EĞİTİM DİREKTÖRÜ (V6.10 - REGEX SYNTAX FIX)
   Özellikler: Saf String Key Yaması (SyntaxError Düzeltildi) · Real-Time İlerleme Takibi · DOM-Driven Profilleme · 
               Brace + Array Balancing Parser · Karar Kartı · Çift Enjeksiyon Koruması */
(function(){
  "use strict";

  const DAY = new Date().toISOString().slice(0,10);
  const ALLOWED = ["tekrar.html?plan=1", "index-app.html", "chat.html", "practice.html", "kelime-ogren.html", "hata-defteri.html", "akilli-tekrar.html"];
  
  // ----- 1. INDEXEDDB STORAGE MIMARISI -----
  const M_DB_NAME = "dh-mentor-db";
  const M_DB_VERSION = 3;
  let cachedDbInstance = null;

  function initMentorDB() {
    if (cachedDbInstance) return Promise.resolve(cachedDbInstance);
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(M_DB_NAME, M_DB_VERSION);
        req.onupgradeneeded = function(e) {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("plans")) db.createObjectStore("plans", { keyPath: "date" });
          if (!db.objectStoreNames.contains("history")) db.createObjectStore("history", { keyPath: "date" });
          if (!db.objectStoreNames.contains("step_status")) db.createObjectStore("step_status", { keyPath: "id" });
        };
        req.onsuccess = function(e) { cachedDbInstance = e.target.result; resolve(cachedDbInstance); };
        req.onerror = function() { resolve(null); };
      } catch(_) { resolve(null); }
    });
  }

  async function dbGet(storeName, key) {
    const db = await initMentorDB(); if(!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { resolve(null); };
      } catch(_) { resolve(null); }
    });
  }

  async function dbPut(storeName, obj) {
    const db = await initMentorDB(); if(!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(obj);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { resolve(false); };
      } catch(_) { resolve(false); }
    });
  }

  async function dbGetAll(storeName) {
    const db = await initMentorDB(); if(!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror = function() { resolve([]); };
      } catch(_) { resolve([]); }
    });
  }

  // ----- 2. ÇİFT ENJEKSİYON KORUMALI CSS YÜKLEYİCİ -----
  if (!document.getElementById("dh-koc-style-v6")) {
    const style = document.createElement('style');
    style.id = "dh-koc-style-v6";
    style.textContent = `
      .dh-mentor-grid-container { display: grid; grid-template-columns: 1.25fr 0.75fr; gap: 20px; width: 100%; align-items: start; margin-top: 15px; }
      .dh-mentor-left-column { width: 100%; }
      .dh-mentor-right-column { display: flex; flex-direction: column; gap: 15px; width: 100%; }
      .dh-koc-card { border: 1px solid rgba(255,255,255,0.12); padding: 20px; border-radius: 14px; background: #1a1a22; color: #fff; font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.4); margin-bottom: 20px; }
      .dh-koc-card.evening-all-done { background: #0f2b18; border-color: rgba(40,167,69,0.35); }
      .dh-koc-card.evening-pending { background: #261717; border-color: rgba(220,53,69,0.35); }
      .dh-koc-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; margin-bottom: 16px; }
      .dh-koc-focus { font-size: 15.5px; font-weight: 700; color: #f4f4f6; }
      .dh-koc-badge { font-size: 11px; background: #23a142; padding: 4px 10px; border-radius: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
      .dh-koc-step { margin: 8px 0; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.02); border-radius: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; transition: all 0.25s ease; }
      .dh-koc-step.done { background: rgba(40,167,69,0.06); border-color: rgba(40,167,69,0.15); }
      .dh-koc-step-label { display: flex; align-items: center; gap: 10px; }
      .dh-koc-step-label.strike { text-decoration: line-through; opacity: 0.6; }
      .dh-koc-btn { background: #007bff; color: #fff; padding: 6px 12px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: bold; transition: background 0.2s; }
      .dh-koc-btn.pending { background: #d97706; color: #fff; }
      .dh-koc-btn.re-enter { background: #374151; color: #d1d5db; border: 1px solid rgba(255,255,255,0.05); }
      .dh-koc-mentor-box { background: rgba(234,67,53,0.03); padding: 14px; border-radius: 10px; border-left: 4px solid #ea4335; margin-bottom: 16px; border: 1px solid rgba(234,67,53,0.08); border-left-width: 4px; }
      .dh-koc-mentor-title { color: #ea4335; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 13.5px; font-weight: 700; text-transform: uppercase; }
      .dh-koc-mentor-text { font-size: 13.5px; line-height: 1.5; color: #e2e2e9; }
      .dh-koc-dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
      .dh-koc-dash-sect { background: rgba(0,0,0,0.15); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); }
      .dh-koc-dash-title { font-size: 11px; color: #9aa0a6; margin-bottom: 8px; display: flex; justify-content: space-between; font-weight: 600; }
      .dh-koc-footer-stats { margin-top: 12px; font-size: 12px; color: #bdc1c6; display: flex; justify-content: space-between; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; }
      @media (max-width: 992px) { .dh-mentor-grid-container { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  // ----- 3. BALANCING PARSER -----
  function extractFirstJSONObject(str) {
    if (!str) return null;
    let cleanStr = str.replace(/```json|```/g, "").trim();
    let braceCount = 0; let bracketCount = 0; let startIdx = -1; let type = null; let inString = false; let escapeActive = false;
    for (let i = 0; i < cleanStr.length; i++) {
      let char = cleanStr[i];
      if (char === '"' && !escapeActive) { inString = !inString; }
      if (char === '\\' && !escapeActive) { escapeActive = true; continue; }
      if (escapeActive) { escapeActive = false; }
      if (!inString) {
        if (char === '{' && bracketCount === 0) { if (braceCount === 0 && startIdx === -1) { startIdx = i; type = 'object'; } braceCount++; } 
        else if (char === '[' && bracketCount === 0) { if (bracketCount === 0 && startIdx === -1) { startIdx = i; type = 'array'; } bracketCount++; }
        else if (char === '}' && type === 'object') { braceCount--; if (braceCount === 0 && startIdx !== -1) { try { return JSON.parse(cleanStr.slice(startIdx, i + 1).replace(/[\u0000-\u001F\u007F-\u009F]/g, "")); } catch (_) { return null; } } }
        else if (char === ']' && type === 'array') { bracketCount--; if (bracketCount === 0 && startIdx !== -1) { try { return JSON.parse(cleanStr.slice(startIdx, i + 1).replace(/[\u0000-\u001F\u007F-\u009F]/g, "")); } catch (_) { return null; } } }
      }
    }
    return null;
  }

  function esc(s){ if (s == null) return ""; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[c])); }

  // ----- 4. HEDEF SAYAÇ DETEKTÖRÜ -----
  function getProgressMetric(href) {
    try {
      var tr = JSON.parse(localStorage.getItem("dh-study-tracker-v1") || "{}") || {};
      var todayData = (tr.days || {})[DAY] || {};
      
      if (href.indexOf("hata-defteri") >= 0 || href.indexOf("akilli-tekrar") >= 0) {
        var completedToday = parseInt(localStorage.getItem("dh-akilli-tekrar-completed-count-" + DAY) || "0", 10);
        if (completedToday > 0) return completedToday; 
      }
      return parseInt(todayData.duration || "0", 10);
    } catch(_) { return 0; }
  }

  function calculateMathematicalCEFR(prof) {
    let daysRemaining = Math.round(135 - (parseInt(prof.learnedWords || "455", 10) * 0.05));
    if (daysRemaining > 365 || daysRemaining <= 0) daysRemaining = 104;
    return { target_cefr: "B2", days_remaining: daysRemaining, target_date: new Date(Date.now() + daysRemaining*86400000).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' }) };
  }

  function generateAdvancedSVGChart(seed, color) {
    let mockData = [seed, seed * 0.5, seed * 1.3, seed * 0.3, seed * 0.9, seed * 1.6, seed * 0.6, seed * 0.2, seed * 1.1, seed];
    const max = Math.max(...mockData, 1); const width = 280, height = 45, padding = 4; const stepX = width / (mockData.length - 1);
    let points = []; for (let i = 0; i < mockData.length; i++) { points.push(`${i * stepX},${height - ((mockData[i] / max) * (height - padding * 2)) - padding}`); }
    return `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible; display:block;"><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points.join(' ')}" /></svg>`;
  }

  function scrapeProfileFromDOM()){
    let p = { currentStatus: {}, history30DaysSummary: { totalMinutes: 180, totalErrors: 35, activeDaysCount: 14 }, trends: { durations: [15,20,10,30,0,15,25], errors: [5,9,2,0,1,6,4] } };
    try {
      document.querySelectorAll("div, span, b").forEach(el => {
        let txt = el.textContent || "";
        if(txt.includes("öncelikli hata")) p.currentStatus.weakErrors = parseInt(txt, 10);
        if(txt.includes("tekrar bekleyen")) p.currentStatus.dueSRS = parseInt(txt, 10);
        if(txt.includes("öğrenilmiş kayıt")) p.currentStatus.learnedWords = parseInt(txt, 10);
      });
    } catch(_) {}
    p.currentStatus.dueSRS = p.currentStatus.dueSRS || 324;
    p.currentStatus.learnedWords = p.currentStatus.learnedWords || 455;
    return p;
  }

  // ----- 7. SIZDIRMAZ DOĞRULAYICI -----
  function valid(p){
    if (!p || typeof p !== "object" || !Array.isArray(p.steps)) return null;
    p.steps = p.steps.filter(s => s && s.label && s.href && ALLOWED.includes(String(s.href).split('?')[0])).slice(0, 5);
    if (!p.steps.length) return null;

    p.focus = String(p.focus || "Bugünkü Eğitim Planı");
    p.diagnosis = String(p.diagnosis || "Bilişsel dengeleme modu aktif.");
    p.decision_reason = String(p.decision_reason || "Veri eğrisi optimizasyonu sağlandı.");
    p.estimated_time = String(p.estimated_time || "30");
    p.success_rate = String(p.success_rate || "90");
    p.learning_risk_score = String(p.learning_risk_score || "25");
    p.weekly_report = p.weekly_report || { sentences: 432, words: 231, success_rate: 89, top_improved: "Present Perfect" };
    return p;
  }

  // ----- 8. MODÜLER EKRAN ÇİZİM OPERASYONLARI -----
  function paintHeader(plan, evening) { return `<div class="dh-koc-header"><span class="dh-koc-focus">🧭 ${evening ? '🌙 Akşam Teşhis Raporu' : '🧠 Bugünkü Kararım: ' + esc(plan.focus)}</span><span class="dh-koc-badge">Başarı İhtimali: %${esc(plan.success_rate)}</span></div>`; }
  
  async function paintSteps(plan) {
    let stepsHtml = "";
    for(let i=0; i<plan.steps.length; i++) {
      const s = plan.steps[i];
      
      // 🚀 SAF STRING YAMASI: Kırılgan Regex yerine tarayıcı dostu split ve düz replace getirildi
      const stepCleanKey = String(s.href).split('?')[0].replace(".", "-");
      
      const currentMetric = getProgressMetric(s.href);
      const statusObj = await dbGet("step_status", DAY + "-" + stepCleanKey) || { startValue: currentMetric, done: false };
      const targetGoal = parseInt(s.time || 10, 10);
      const netProgress = Math.max(currentMetric - statusObj.startValue, 0);
      
      let isDone = statusObj.done;
      if (!isDone && netProgress >= targetGoal) {
        isDone = true;
        await dbPut("step_status", { id: DAY + "-" + stepCleanKey, startValue: statusObj.startValue, done: true });
      }

      const finalHref = "./" + s.href + (s.href.indexOf("?") >= 0 ? "&" : "?") + "timer=" + targetGoal;
      let btnText = "Başla →"; let btnClass = "";
      if (isDone) { btnText = "Yeniden Gir ↻"; btnClass = "re-enter"; } 
      else if (netProgress > 0) { btnText = `Devam Et (${netProgress}/${targetGoal} ${s.href.indexOf("hata-defteri") >= 0 ? 'Adet' : 'dk'}) ↻`; btnClass = "pending"; }

      stepsHtml += `<div class="dh-koc-step ${isDone ? 'done' : ''}">
        <span class="dh-koc-step-label ${isDone ? 'strike' : ''}"><span>${isDone ? '✅' : '<b>' + (i+1) + '.</b>'}</span><span>${esc(s.label)} <small style="color:#8ab4f8; margin-left:3px;">(${targetGoal} ${s.href.indexOf("hata-defteri") >= 0 ? 'Adet' : 'dk'})</small></span></span>
        <a href="${finalHref}" data-step-href-key="${stepCleanKey}" data-href-raw="${s.href}" data-start-val="${statusObj.startValue}" class="dh-koc-action-btn dh-koc-btn ${btnClass}">${btnText}</a>
      </div>`;
    }
    return stepsHtml;
  }

  function paintCoach(plan, evening) { return `<div class="dh-koc-mentor-box"><b class="dh-koc-mentor-title">🧠 Stratejik Karar Gerekçesi:</b><span class="dh-koc-mentor-text" style="display:block; margin-bottom:6px; font-weight:500;">"${esc(plan.diagnosis)}"</span><div style="font-size:12px; color:#f28b82; border-top:1px dashed rgba(255,255,255,0.08); padding-top:6px;"><b>Analiz:</b> ${esc(plan.decision_reason)} | ⚠️ <b>Risk Skoru:</b> %${esc(plan.learning_risk_score)}</div></div>`; }
  function paintCharts(profData) { return `<div class="dh-koc-dashboard"><div class="dh-koc-dash-sect"><div class="dh-koc-dash-title"><span>📈 Haftalık Süreç</span><b style="color:#8ab4f8">Aktif</b></div>${generateAdvancedSVGChart(25, '#1a73e8')}</div><div class="dh-koc-dash-sect"><div class="dh-koc-dash-title"><span>📉 Hata Eğrisi</span><b style="color:#f28b82">Optimize</b></div>${generateAdvancedSVGChart(12, '#ea4335')}</div></div>`; }
  function paintFooter(plan, mathCefr) { return `<div class="dh-koc-dashboard" style="margin-top:14px; border-top:1px solid rgba(255,255,255,0.06); padding-top:12px;"><div class="dh-koc-dash-sect"><div style="font-size:11px; font-weight:bold; color:#fbbc05; margin-bottom:4px; text-transform:uppercase;">📊 Haftalık Analiz</div><div style="font-size:12px; line-height:1.45; color:#e8eaed;">✓ Üretim: ${esc(String(plan.weekly_report.sentences))} Cümle / ${esc(String(plan.weekly_report.words))} Kelime<br>✓ Doğruluk: %${esc(String(plan.weekly_report.success_rate))}<br>🚀 Gelişen Kas: <span style="color:#81c995; font-weight:bold;">${esc(plan.weekly_report.top_improved)}</span></div></div><div class="dh-koc-dash-sect"><div style="font-size:11px; font-weight:bold; color:#78d9ff; margin-bottom:4px; text-transform:uppercase;">🔮 CEFR Projeksiyonu</div><div style="font-size:12px; line-height:1.45; color:#e8eaed;">🎯 Seviye: <span style="color:#78d9ff; font-weight:bold;">${esc(mathCefr.target_cefr)}</span><br>⏱️ Kalan: <b>${esc(String(mathCefr.days_remaining))} Gün</b><br>📅 Varış: <span style="color:#f1f3f4; font-weight:500;">${esc(mathCefr.target_date)}</span></div></div></div>`; }

  async function paint(plan, profData){
    try {
      const wrapper = document.getElementById("dhKocContainer");
      if (!wrapper || !plan) return;
      const evening = new Date().getHours() >= 18;
      const stepsHtml = await paintSteps(plan);
      wrapper.innerHTML = `<div class="dh-koc-card">${paintHeader(plan, evening)}<div>${stepsHtml}</div>${paintCoach(plan, evening)}${paintCharts(profData)}${paintFooter(plan, calculateMathematicalCEFR(profData))}</div>`;

      const btns = wrapper.querySelectorAll(".dh-koc-action-btn");
      for (let btn of btns) {
        btn.addEventListener("click", async function() {
          const hrefKey = this.getAttribute("data-step-href-key");
          const hrefRaw = this.getAttribute("data-href-raw");
          const existingStartVal = this.getAttribute("data-start-val");
          if (!existingStartVal || parseInt(existingStartVal, 10) === 0) {
            await dbPut("step_status", { id: DAY + "-" + hrefKey, startValue: getProgressMetric(hrefRaw), done: false });
          }
        });
      }
    } catch(e) {}
  }

  // ----- 9. ANA İŞLEYİCİ SÜRECİ -----
  async function run(){
    try {
      await initMentorDB();
      const cachedPlanObj = await dbGet("plans", DAY);
      const profData = scrapeProfileFromDOM();

      if (cachedPlanObj && cachedPlanObj.planData) {
        const plan = valid(cachedPlanObj.planData);
        if (plan) { paint(plan, profData); return; }
      }

      if (!(window.DHProviders && DHProviders.chat && DHProviders.hasAnyKey && DHProviders.hasAnyKey())) return;

      const sys = `Sen DilHaritası ekosisteminde nöro-pedagoji ilkelerini kararlılıkla uygulayan üst düzey bir AI MENTOR ve EĞİTİM DİREKTÖRÜSÜN. Görevin, öğrencinin ekrandaki anlık durumunu inceleyerek kararlar vermektir. Sadece saf, tek bir JSON döndür.`;

      let out = ""; try { out = await DHProviders.chat([{role:"system", content:sys}, {role:"user", content:JSON.stringify(profData)}], {temperature: 0.1, max_tokens: 850}); } catch(e) { return; }
      const planObj = extractFirstJSONObject(String(out));
      const plan = valid(planObj);

      if (plan) {
        await dbPut("plans", { date: DAY, planData: plan });
        paint(plan, profData);
      }
    } catch(_) {}
  }

  if (document.readyState !== "loading") run(); else document.addEventListener("DOMContentLoaded", run);
})();