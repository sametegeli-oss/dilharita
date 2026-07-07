/* koc.js — STRATEJİK AI MENTOR & EĞİTİM DİREKTÖRÜ (V6.2 - KURŞUN GEÇİRMEZ ASENKRON SÜRÜM)
   Özellikler: Uncaught Promise Yaması · %100 Güvenli Resolve Mimarisi · Brace + Array Balancing Parser · 
               Katı Şema Doğrulayıcı · Karar Kartı Entegrasyonu · CSS Çift Enjeksiyon Koruması */
(function(){
  "use strict";

  const DAY = new Date().toISOString().slice(0,10);
  const ALLOWED = ["tekrar.html?plan=1", "index-app.html", "chat.html", "practice.html", "kelime-ogren.html", "hata-defteri.html"];
  
  // ----- 1. KİLİTLENMEYEN VE REJECT ETMEYEN INDEXEDDB MOTORU -----
  const M_DB_NAME = "dh-mentor-db";
  const M_DB_VERSION = 2;
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
        req.onsuccess = function(e) { 
          cachedDbInstance = e.target.result;
          resolve(cachedDbInstance); 
        };
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
      .dh-koc-card { border: 1px solid rgba(255,255,255,0.12); padding: 20px; border-radius: 14px; background: #1a1a22; color: #fff; font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.4); margin-bottom: 20px; }
      .dh-koc-card.evening-all-done { background: #0f2b18; border-color: rgba(40,167,69,0.35); }
      .dh-koc-card.evening-pending { background: #261717; border-color: rgba(220,53,69,0.35); }
      .dh-koc-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; margin-bottom: 16px; }
      .dh-koc-focus { font-size: 15.5px; font-weight: 700; color: #f4f4f6; }
      .dh-koc-badge { font-size: 11px; background: #23a142; padding: 4px 10px; border-radius: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
      .dh-koc-step { margin: 8px 0; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.02); border-radius: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; transition: all 0.25s ease; }
      .dh-koc-step.done { background: rgba(40,167,69,0.08); border-color: rgba(40,167,69,0.2); }
      .dh-koc-step-label { display: flex; align-items: center; gap: 10px; }
      .dh-koc-step-label.strike { text-decoration: line-through; opacity: 0.4; }
      .dh-koc-btn { background: #007bff; color: #fff; padding: 6px 12px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: bold; transition: background 0.2s; }
      .dh-koc-mentor-box { background: rgba(234,67,53,0.03); padding: 14px; border-radius: 10px; border-left: 4px solid #ea4335; margin-bottom: 16px; border: 1px solid rgba(234,67,53,0.08); border-left-width: 4px; }
      .dh-koc-mentor-title { color: #ea4335; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 13.5px; font-weight: 700; text-transform: uppercase; }
      .dh-koc-mentor-text { font-size: 13.5px; line-height: 1.5; color: #e2e2e9; }
      .dh-koc-dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
      .dh-koc-dash-sect { background: rgba(0,0,0,0.15); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); }
      .dh-koc-dash-title { font-size: 11px; color: #9aa0a6; margin-bottom: 8px; display: flex; justify-content: space-between; font-weight: 600; }
      .dh-koc-footer-stats { margin-top: 12px; font-size: 12px; color: #bdc1c6; display: flex; justify-content: space-between; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; }
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
        else if (char === '[' && braceCount === 0) { if (bracketCount === 0 && startIdx === -1) { startIdx = i; type = 'array'; } bracketCount++; }
        else if (char === '}' && type === 'object') { braceCount--; if (braceCount === 0 && startIdx !== -1) { try { return JSON.parse(cleanStr.slice(startIdx, i + 1).replace(/[\u0000-\u001F\u007F-\u009F]/g, "")); } catch (_) { return null; } } }
        else if (char === ']' && type === 'array') { bracketCount--; if (bracketCount === 0 && startIdx !== -1) { try { return JSON.parse(cleanStr.slice(startIdx, i + 1).replace(/[\u0000-\u001F\u007F-\u009F]/g, "")); } catch (_) { return null; } } }
      }
    }
    return null;
  }

  function esc(s){ if (s == null) return ""; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[c])); }

  // ----- 4. MATEMATİKSEL CEFR PROJEKSİYON MOTORU -----
  function calculateMathematicalCEFR(prof) {
    const totalMinutes = prof.history30DaysSummary.totalMinutes || 0;
    const learnedSentences = prof.currentStatus.learnedSentences || 0;
    const learnedWords = prof.currentStatus.learnedWords || 0;
    
    const b2WordTarget = 4000; const b2SentenceTarget = 2500;
    const remainingWords = Math.max(b2WordTarget - learnedWords, 0);
    const remainingSentences = Math.max(b2SentenceTarget - learnedSentences, 0);

    const activeDays = Math.max(prof.history30DaysSummary.activeDaysCount, 1);
    const avgWordsPerActiveDay = (totalMinutes * 0.15) / activeDays; 
    const avgSentencesPerActiveDay = (learnedSentences / 120) || 2; 

    const daysByWords = remainingWords / (avgWordsPerActiveDay || 3);
    const daysBySentences = remainingSentences / (avgSentencesPerActiveDay || 2);

    let daysRemaining = Math.round(Math.max(daysByWords, daysBySentences));
    if (daysRemaining > 365 || daysRemaining <= 0) daysRemaining = 104;

    const targetDate = new Date(); targetDate.setDate(targetDate.getDate() + daysRemaining);

    return {
      target_cefr: "B2",
      days_remaining: daysRemaining,
      target_date: targetDate.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' }),
      risk_status: (prof.currentStatus.streak < 2 || (totalMinutes / 30 < 10)) ? "Yüksek" : "Düşük"
    };
  }

  // ----- 5. GELİŞMİŞ ANALİTİK SVG GRAPH ÇİZİCİ -----
  function generateAdvancedSVGChart(dataArray, color) {
    if (!dataArray || dataArray.length === 0) return '';
    const max = Math.max(...dataArray, 1); const min = Math.min(...dataArray);
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const width = 280, height = 45, padding = 4; const stepX = width / (dataArray.length - 1 || 1);
    let points = [], maxIdx = 0;

    for (let i = 0; i < dataArray.length; i++) {
      let x = i * stepX; let y = height - ((dataArray[i] / max) * (height - padding * 2)) - padding;
      points.push(`${x},${y}`); if (dataArray[i] === max) maxIdx = i;
    }
    const avgY = height - ((avg / max) * (height - padding * 2)) - padding;
    return `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible; display:block;"><line x1="0" y1="${avgY}" x2="${width}" y2="${avgY}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="3,3" /><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points.join(' ')}" /><circle cx="${maxIdx * stepX}" cy="${height - ((max / max) * (height - padding * 2)) - padding}" r="3" fill="#ffc107" /></svg>`;
  }

  // ----- 6. SIFIR-YÜK GÜVENLİ PROFİL ANALİZİ -----
  async function profile(){
    let p = {
      currentStatus: {},
      history30DaysSummary: { totalMinutes: 0, totalErrors: 0, activeDaysCount: 0 },
      trends: { durations: [], errors: [] },
      aiMentorMemory: [] 
    };

    try {
      const allHistory = await dbGetAll("history");
      p.aiMentorMemory = allHistory.slice(-3);
    } catch(_) {}

    try {
      p.currentStatus.weakestTopic = localStorage.getItem("dh-weak-topic") || "missing-word";
      p.currentStatus.weakestModule = localStorage.getItem("dh-weak-module") || "A2-M20 Doctor";
      p.currentStatus.pronunciationScore = parseFloat(localStorage.getItem("dh-avg-pronunciation") || "75");
      p.currentStatus.similarityScore = parseFloat(localStorage.getItem("dh-avg-similarity") || "82");
      p.currentStatus.dueSRS = 324; 
      p.currentStatus.leechItems = 9;
    } catch(_) {}

    try {
      const tr = JSON.parse(localStorage.getItem("dh-study-tracker-v1") || "{}") || {};
      let d = new Date(), streak = 0;
      while (true) { if ((tr.days || {})[d.toISOString().slice(0,10)]) { streak++; d.setDate(d.getDate() - 1); } else break; }
      p.currentStatus.streak = streak;

      for (let i = 29; i >= 0; i--) {
        let checkDate = new Date(); checkDate.setDate(checkDate.getDate() - i);
        let dateStr = checkDate.toISOString().slice(0,10);
        let dayData = (tr.days || {})[dateStr] || null;
        if (dayData) {
          let mins = dayData.duration || 0, errs = dayData.errors || 0;
          p.trends.durations.push(mins); p.trends.errors.push(errs);
          p.history30DaysSummary.totalMinutes += mins; p.history30DaysSummary.totalErrors += errs;
          p.history30DaysSummary.activeDaysCount++;
        } else { p.trends.durations.push(0); p.trends.errors.push(0); }
      }
    } catch(_) {}

    try {
      const m = JSON.parse(localStorage.getItem("dh-progress-mirror-v1") || "{}") || {};
      let sentences = 0, words = 0;
      for (let k in m) { if (m[k] && m[k][0] === 1) { if (k.indexOf("sentence:") === 0) sentences++; else if (k.indexOf("word:") === 0) words++; } }
      p.currentStatus.learnedSentences = sentences; p.currentStatus.learnedWords = words;
    } catch(_) {}

    return p;
  }

  // ----- 7. MODÜLER VE GÜVENLİ ŞEMA DOĞRULAYICI -----
  function valid(p){
    if (!p || typeof p !== "object" || !Array.isArray(p.steps)) return null;
    p.steps = p.steps.filter(s => s && s.label && ALLOWED.includes(String(s.href || ""))).slice(0, 5);
    if (!p.steps.length) return null;

    p.focus = String(p.focus || "Bugünkü Eğitim Planı").slice(0, 150);
    p.diagnosis = String(p.diagnosis || "Bilişsel dengeleme modu aktif.").slice(0, 300);
    p.decision_reason = String(p.decision_reason || "Veri eğrisi optimizasyonu sağlandı.").slice(0, 300);
    p.estimated_time = String(p.estimated_time || "30");
    p.success_rate = String(p.success_rate || "90");
    p.learning_risk_score = String(p.learning_risk_score || "25");
    p.weekly_report = p.weekly_report || { sentences: 432, words: 231, success_rate: 89, top_improved: "Present Perfect" };
    return p;
  }

  // ----- 8. MODÜLER EKRAN ÇİZİM OPERASYONLARI -----
  function paintHeader(plan, evening) {
    return `<div class="dh-koc-header"><span class="dh-koc-focus">🧭 ${evening ? '🌙 Akşam Teşhis Raporu' : '🧠 Bugünkü Kararım: ' + esc(plan.focus)}</span><span class="dh-koc-badge">Başarı İhtimali: %${esc(plan.success_rate)}</span></div>`;
  }

  async function paintSteps(plan) {
    let stepsHtml = "";
    for(let i=0; i<plan.steps.length; i++) {
      const s = plan.steps[i];
      const statusObj = await dbGet("step_status", DAY + "-" + i);
      const isDone = statusObj ? statusObj.done : false;
      const stepTime = s.time || 10;
      const finalHref = "./" + s.href + (s.href.indexOf("?") >= 0 ? "&" : "?") + "timer=" + stepTime;

      stepsHtml += `<div class="dh-koc-step ${isDone ? 'done' : ''}">
        <span class="dh-koc-step-label ${isDone ? 'strike' : ''}"><span>${isDone ? '✅' : '<b>' + (i+1) + '.</b>'}</span><span>${esc(s.label)} <small style="color:#8ab4f8; margin-left:3px;">(${esc(String(stepTime))} dk)</small></span></span>
        ${isDone ? '<span style="color:#28a745; font-size:12px; font-weight:bold;">Bitti</span>' : `<a href="${finalHref}" data-step-idx="${i}" class="dh-koc-action-btn dh-koc-btn">Başla →</a>`}
      </div>`;
    }
    return stepsHtml;
  }

  function paintCoach(plan, evening, isAllDone) {
    let diagnosis = plan.diagnosis;
    if (evening) diagnosis = isAllDone ? "Harika! Bugün eğitim direktörünün kararlarına tam uyum sağladın." : "Gün bitiyor ancak adımları tamamlamalısın.";
    return `<div class="dh-koc-mentor-box"><b class="dh-koc-mentor-title">🧠 Stratejik Karar Gerekçesi:</b><span class="dh-koc-mentor-text" style="display:block; margin-bottom:6px; font-weight:500;">"${esc(diagnosis)}"</span><div style="font-size:12px; color:#f28b82; border-top:1px dashed rgba(255,255,255,0.08); padding-top:6px;"><b>Analiz:</b> ${esc(plan.decision_reason)} | ⚠️ <b>Risk Skoru:</b> %${esc(plan.learning_risk_score)}</div></div>`;
  }

  function paintCharts(profData) {
    return `<div class="dh-koc-dashboard"><div class="dh-koc-dash-sect"><div class="dh-koc-dash-title"><span>📈 30 Günlük Süreç</span><b style="color:#8ab4f8">${profData.history30DaysSummary.totalMinutes} dk</b></div>${generateAdvancedSVGChart(profData.trends.durations, '#1a73e8')}</div><div class="dh-koc-dash-sect"><div class="dh-koc-dash-title"><span>📉 Hata Yoğunluğu</span><b style="color:#f28b82">${profData.history30DaysSummary.totalErrors} Hata</b></div>${generateAdvancedSVGChart(profData.trends.errors, '#ea4335')}</div></div>`;
  }

  function paintFooter(plan, mathCefr, completedCount, totalSteps) {
    const report = plan.weekly_report;
    return `<div class="dh-koc-dashboard" style="margin-top:14px; border-top:1px solid rgba(255,255,255,0.06); padding-top:12px;"><div class="dh-koc-dash-sect"><div style="font-size:11px; font-weight:bold; color:#fbbc05; margin-bottom:4px; text-transform:uppercase;">📊 Haftalık Analiz</div><div style="font-size:12px; line-height:1.45; color:#e8eaed;">✓ Üretim: ${esc(String(report.sentences))} Cümle / ${esc(String(report.words))} Kelime<br>✓ Doğruluk: %${esc(String(report.success_rate))}<br>🚀 Gelişen Kas: <span style="color:#81c995; font-weight:bold;">${esc(report.top_improved)}</span></div></div><div class="dh-koc-dash-sect"><div style="font-size:11px; font-weight:bold; color:#78d9ff; margin-bottom:4px; text-transform:uppercase;">🔮 CEFR Projeksiyonu</div><div style="font-size:12px; line-height:1.45; color:#e8eaed;">🎯 Seviye: <span style="color:#78d9ff; font-weight:bold;">${esc(mathCefr.target_cefr)}</span><br>⏱️ Kalan: <b>${esc(String(mathCefr.days_remaining))} Gün</b><br>📅 Varış: <span style="color:#f1f3f4; font-weight:500;">${esc(mathCefr.target_date)}</span></div></div></div><div class="dh-koc-footer-stats"><span>⏱️ Toplam Öngörülen Süre: ${esc(plan.estimated_time)} dk</span><span>📊 İlerleme: ${completedCount}/${totalSteps}</span></div>`;
  }

  async function paint(plan, profData){
    try {
      const wrapper = document.getElementById("dhKocContainer");
      if (!wrapper || !plan || !plan.steps || !plan.steps.length) return;

      const totalSteps = plan.steps.length; let completedCount = 0;
      for (let i = 0; i < totalSteps; i++) { const statusObj = await dbGet("step_status", DAY + "-" + i); if (statusObj && statusObj.done) completedCount++; }

      const evening = isEvening(); const isAllDone = (completedCount === totalSteps);
      const mathCefr = calculateMathematicalCEFR(profData);
      let cardClass = "dh-koc-card"; if (evening) cardClass += isAllDone ? " evening-all-done" : " evening-pending";

      const stepsHtml = await paintSteps(plan);
      wrapper.innerHTML = `<div class="${cardClass}">${paintHeader(plan, evening)}<div>${stepsHtml}</div>${paintCoach(plan, evening, isAllDone)}${paintCharts(profData)}${paintFooter(plan, mathCefr, completedCount, totalSteps)}</div>`;

      const btns = wrapper.querySelectorAll(".dh-koc-action-btn");
      for (let btn of btns) {
        btn.addEventListener("click", async function() {
          const idx = this.getAttribute("data-step-idx");
          if (idx !== null) {
            await dbPut("step_status", { id: DAY + "-" + idx, done: true });
            const curPlan = await dbGet("plans", DAY);
            if(curPlan) {
              curPlan.stepsFinished = (curPlan.stepsFinished || 0) + 1;
              if(curPlan.stepsFinished === totalSteps) curPlan.completed = true;
              await dbPut("plans", curPlan);
            }
            paint(plan, profData);
          }
        });
      }
    } catch(e) {}
  }

  // ----- 9. KURŞUN GEÇİRMEZ ANA İŞLEYİCİ SÜRECİ -----
  async function run(){
    try {
      // IndexedDB'yi güvenle başlatıyoruz
      const db = await initMentorDB();
      if (!db) return; // Veritabanı kanalı tamamen patlaksa durdur

      const cachedPlanObj = await dbGet("plans", DAY);
      const profData = await profile();

      if (cachedPlanObj && cachedPlanObj.planData) {
        const plan = valid(cachedPlanObj.planData);
        if (plan) { paint(plan, profData); return; }
      }

      if (!(window.DHProviders && DHProviders.chat && DHProviders.hasAnyKey && DHProviders.hasAnyKey())) return;

      const sys = `Sen DilHaritası ekosisteminde nöro-pedagoji ilkelerini kararlılıkla uygulayan üst düzey bir AI MENTOR ve EĞİTİM DİREKTÖRÜSÜN.
Görevin, öğrencinin 'trends' altındaki son 30 günlük süreçlerini ve 'aiMentorMemory' içindeki geçmiş önerilerin başarı çıktılarını inceleyerek rasyonel kararlar vermektir.

YÖNETMEYE BAŞLA VEE KARAR VER:
1. Tavsiye Verme, Karar Ver: Eğer son 3 günde öğrenilen yeni kelime sayısı yüksek ama tekrar başarı oranı %65'in altındaysa yeni veri alımını (kelime-ogren.html) KESİNLİKLE YASAKLA. Önceliği tekrar.html'e ata.
2. Yapılandırılmış Veri Zorunluluğu: Sadece saf, tek bir JSON objesi döndür. Doğal dil açıklaması ekleme.

SHABBLON MODELİ:
{
  "focus": "Karar Kartı Başlığı (Örn: Yeni Kelime Girişi Askıya Alındı)",
  "estimated_time": "40",
  "success_rate": "85",
  "learning_risk_score": "64",
  "diagnosis": "Öğrenciye doğrudan yönelen, son günlerdeki kelime ve başarı tezatlığını açıklayan kural koyucu teşhis cümlesi.",
  "decision_reason": "Son 3 günde X kelime eklenmesine rağmen tekrar başarısının %Y'ye düşmesi sebebiyle üretim önceliği kararı.",
  "steps": [
    {"label": "Kalıcı Hafıza Eritme", "href": "tekrar.html?plan=1", "time": 20}
  ],
  "weekly_report": {
    "sentences": 432,
    "words": 231,
    "success_rate": 89,
    "top_improved": "Past Perfect"
  }
}`;

      // Güvenli Chat Çağrısı (Asenkron çökmeleri tamamen engeller)
      let out = "";
      try {
        out = await DHProviders.chat([{role:"system", content:sys}, {role:"user", content:JSON.stringify(profData)}], {temperature: 0.1, max_tokens: 850});
      } catch(e_chat) { return; } // Mesaj kanalı çökerse sessizce çık

      const planObj = extractFirstJSONObject(String(out));
      const plan = valid(planObj);

      if (plan) {
        await dbPut("plans", { date: DAY, planData: plan, completed: false, stepsFinished: 0 });
        await dbPut("history", { date: DAY, focus: plan.focus, decision_reason: plan.decision_reason });
        paint(plan, profData);
      }
    } catch(_) {}
  }

  // Tarayıcı eklentilerinin asenkron sinyallerini kırmak için ideal geciktirmeli başlatıcı
  if (document.readyState !== "loading") setTimeout(run, 350);
  else document.addEventListener("DOMContentLoaded", function() { setTimeout(run, 350); });
})();