/* koc.js — STRATEJİK AI MENTOR & EĞİTİM DİREKTÖRÜ (V5 - BİLİMSEL SÜRÜM)
   Özellikler: Brace-Balancing Parser · IndexedDB Hafıza Altyapısı · Matematiksel CEFR Motoru ·
               Zengin Analitik SVG · Bilişsel Dil Edinim Promptu (Active Recall / Interleaving) */
(function(){
  "use strict";

  const DAY = new Date().toISOString().slice(0,10);
  const ALLOWED = ["tekrar.html?plan=1", "index-app.html", "chat.html", "practice.html", "kelime-ogren.html", "hata-defteri.html"];
  
  // ----- 1. INDEXEDDB MOTORU (Şişmeyi Önleyen Katman) -----
  const M_DB_NAME = "dh-mentor-db";
  const M_DB_VERSION = 1;

  function initMentorDB() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(M_DB_NAME, M_DB_VERSION);
        req.onupgradeneeded = function(e) {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("plans")) db.createObjectStore("plans", { keyPath: "date" });
          if (!db.objectStoreNames.contains("history")) db.createObjectStore("history", { keyPath: "date" });
          if (!db.objectStoreNames.contains("step_status")) db.createObjectStore("step_status", { keyPath: "id" });
        };
        req.onsuccess = function(e) { resolve(e.target.result); };
        req.onerror = function() { resolve(null); };
      } catch(_) { resolve(null); }
    });
  }

  function dbGet(storeName, key) {
    return new Promise(async (resolve) => {
      const db = await initMentorDB(); if(!db) return resolve(null);
      try {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = function() { db.close(); resolve(req.result); };
        req.onerror = function() { db.close(); resolve(null); };
      } catch(_) { resolve(null); }
    });
  }

  function dbPut(storeName, obj) {
    return new Promise(async (resolve) => {
      const db = await initMentorDB(); if(!db) return resolve(false);
      try {
        const tx = db.transaction(storeName, "readwrite");
        const req = tx.objectStore(storeName).put(obj);
        tx.oncomplete = function() { db.close(); resolve(true); };
        tx.onerror = function() { db.close(); resolve(false); };
      } catch(_) { resolve(false); }
    });
  }

  function dbGetAll(storeName) {
    return new Promise(async (resolve) => {
      const db = await initMentorDB(); if(!db) return resolve([]);
      try {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = function() { db.close(); resolve(req.result || []); };
        req.onerror = function() { db.close(); resolve([]); };
      } catch(_) { resolve([]); }
    });
  }

  // ----- 2. DİNAMİK GELİŞMİŞ CSS ENJEKSİYONU -----
  const style = document.createElement('style');
  style.textContent = `
    .dh-koc-card { border: 1px solid rgba(255,255,255,0.12); padding: 20px; border-radius: 14px; background: #1a1a22; color: #fff; font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
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
    .dh-koc-btn:hover { background: #0069d9; }
    .dh-koc-mentor-box { background: rgba(234,67,53,0.04); padding: 14px; border-radius: 10px; border-left: 4px solid #ea4335; margin-bottom: 16px; border-top: 1px solid rgba(234,67,53,0.08); border-right: 1px solid rgba(234,67,53,0.08); border-bottom: 1px solid rgba(234,67,53,0.08); }
    .dh-koc-mentor-title { color: #ea4335; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 13.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
    .dh-koc-mentor-text { font-size: 13.5px; line-height: 1.5; color: #e2e2e9; }
    .dh-koc-dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
    .dh-koc-dash-sect { background: rgba(0,0,0,0.15); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); }
    .dh-koc-dash-title { font-size: 11px; color: #9aa0a6; margin-bottom: 8px; display: flex; justify-content: space-between; font-weight: 600; }
    .dh-koc-footer-stats { margin-top: 12px; font-size: 12px; color: #bdc1c6; display: flex; justify-content: space-between; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; }
  `;
  document.head.appendChild(style);

  // ----- 3. BRACE-BALANCING JSON EXTRACTOR (Kırılmaz Parser) -----
  function extractFirstJSONObject(str) {
    if (!str) return null;
    let braceCount = 0;
    let startIdx = -1;
    let inString = false;
    let escapeActive = false;

    for (let i = 0; i < str.length; i++) {
      let char = str[i];
      if (char === '"' && !escapeActive) { inString = !inString; }
      if (char === '\\' && !escapeActive) { escapeActive = true; continue; }
      if (escapeActive) { escapeActive = false; }

      if (!inString) {
        if (char === '{') {
          if (braceCount === 0) startIdx = i;
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && startIdx !== -1) {
            const candidate = str.slice(startIdx, i + 1).trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
            try { return JSON.parse(candidate); } catch (_) { return null; }
          }
        }
      }
    }
    return null;
  }

  function esc(s){
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[c]));
  }

  // ----- 4. MATEMATİKSEL CEFR PROJEKSİYON MOTORU (JS Seviyesinde) -----
  function calculateMathematicalCEFR(prof) {
    const totalMinutes = prof.history30DaysSummary.totalMinutes || 0;
    const learnedSentences = prof.currentStatus.learnedSentences || 0;
    const learnedWords = prof.currentStatus.learnedWords || 0;
    
    // B2 için gereken ortalama hedef birikim baremi: 4000 Kelime & 2500 Cümle
    const b2WordTarget = 4000;
    const b2SentenceTarget = 2500;
    
    const remainingWords = Math.max(b2WordTarget - learnedWords, 0);
    const remainingSentences = Math.max(b2SentenceTarget - learnedSentences, 0);

    // Günlük ortalama hız (Son 30 güne göre)
    const activeDays = Math.max(prof.history30DaysSummary.activeDaysCount, 1);
    const avgWordsPerActiveDay = (prof.history30DaysSummary.totalMinutes * 0.15) / activeDays; // Ampirik katsayı
    const avgSentencesPerActiveDay = (learnedSentences / 120) || 2; 

    const dailyWordVelocity = avgWordsPerActiveDay || 3;
    const dailySentenceVelocity = avgSentencesPerActiveDay || 2;

    const daysByWords = remainingWords / dailyWordVelocity;
    const daysBySentences = remainingSentences / dailySentenceVelocity;

    let daysRemaining = Math.round(Math.max(daysByWords, daysBySentences));
    if (daysRemaining > 365) daysRemaining = 180; // Üst sınır koruması
    if (daysRemaining === 0) daysRemaining = 12;

    // Hedef Tarih Hesaplama
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysRemaining);
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedTargetDate = targetDate.toLocaleDateString('tr-TR', options);

    return {
      target_cefr: "B2",
      days_remaining: daysRemaining,
      target_date: formattedTargetDate,
      risk_status: (prof.currentStatus.streak < 2 || (totalMinutes / 30 < 10)) ? "Yüksek" : "Düşük"
    };
  }

  // ----- 5. GELİŞMİŞ ANALİTİK SVG GRAPH ÇİZİCİ -----
  function generateAdvancedSVGChart(dataArray, color) {
    if (!dataArray || dataArray.length === 0) return '';
    const max = Math.max(...dataArray, 1);
    const min = Math.min(...dataArray);
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const avg = sum / dataArray.length;

    const width = 280, height = 45, padding = 4;
    const stepX = width / (dataArray.length - 1 || 1);
    
    let points = [];
    let maxIdx = 0, minIdx = 0;

    for (let i = 0; i < dataArray.length; i++) {
      let x = i * stepX;
      let y = height - ((dataArray[i] / max) * (height - padding * 2)) - padding;
      points.push(`${x},${y}`);
      if (dataArray[i] === max) maxIdx = i;
      if (dataArray[i] === min) minIdx = i;
    }

    // Ortalama Çizgisi Y Koordinatı
    const avgY = height - ((avg / max) * (height - padding * 2)) - padding;
    // Son Nokta Koordinatları
    const lastX = (dataArray.length - 1) * stepX;
    const lastY = height - ((dataArray[dataArray.length - 1] / max) * (height - padding * 2)) - padding;

    return `
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible; display:block;">
        <!-- Ortalama Kesikli Çizgi -->
        <line x1="0" y1="${avgY}" x2="${width}" y2="${avgY}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="3,3" />
        <!-- Ana Eğri -->
        <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points.join(' ')}" />
        <!-- Max Nokta Vurgusu -->
        <circle cx="${maxIdx * stepX}" cy="${height - ((max / max) * (height - padding * 2)) - padding}" r="3" fill="#ffc107" />
        <!-- Son Gün Nokta Vurgusu -->
        <circle cx="${lastX}" cy="${lastY}" r="3.5" fill="#fff" stroke="${color}" stroke-width="1.5" />
      </svg>
    `;
  }

  // ----- 6. HAFIZALI VE 30 GÜNLÜK PROFİL ANALİZİ -----
  async function profile(){
    let p = {
      currentStatus: {},
      history30DaysSummary: { totalMinutes: 0, totalErrors: 0, activeDaysCount: 0 },
      trends: { durations: [], errors: [] },
      aiMentorMemory: [] 
    };

    // IndexedDB'den Son 3 Kararın Başarı/Hata Hafızasını Çek
    try {
      const allHistory = await dbGetAll("history");
      p.aiMentorMemory = allHistory.slice(-3);
    } catch(_) {}

    // Anlık Veriler
    try {
      p.currentStatus.weakestTopic = localStorage.getItem("dh-weak-topic") || "missing-word";
      p.currentStatus.weakestModule = localStorage.getItem("dh-weak-module") || "A2-M20 Doctor";
      p.currentStatus.pronunciationScore = parseFloat(localStorage.getItem("dh-avg-pronunciation") || "75");
      p.currentStatus.similarityScore = parseFloat(localStorage.getItem("dh-avg-similarity") || "82");
    } catch(_) {}

    // 30 Günlük Veri Seti Toplama
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

    // Öğrenilen toplam hacim
    try {
      const m = JSON.parse(localStorage.getItem("dh-progress-mirror-v1") || "{}") || {};
      let sentences = 0, words = 0;
      for (let k in m) { if (m[k] && m[k][0] === 1) { if (k.indexOf("sentence:") === 0) sentences++; else if (k.indexOf("word:") === 0) words++; } }
      p.currentStatus.learnedSentences = sentences; p.currentStatus.learnedWords = words;
    } catch(_) {}

    // IndexedDB üzerinden SRS Sorgulama
    await new Promise((resolve) => {
      try {
        const req = indexedDB.open("sentence-mode", 1);
        req.onsuccess = function() {
          const db = req.result; let due = 0, leech = 0, now = Date.now();
          try {
            const tx = db.transaction("kv", "readonly");
            const cursor = tx.objectStore("kv").openCursor();
            cursor.onsuccess = function(e) {
              const cur = e.target.result;
              if (cur) {
                const key = String(cur.key), val = cur.value || {};
                if (key.indexOf("srs:") === 0) { if ((val.due || 0) <= now) due++; if ((val.lapses || 0) >= 3) leech++; }
                cur.continue();
              } else { db.close(); p.currentStatus.dueSRS = due; p.currentStatus.leechItems = leech; resolve(); }
            };
            tx.onerror = function() { db.close(); resolve(); };
          } catch(e) { try { db.close(); } catch(_) {} resolve(); }
        };
        req.onerror = function() { resolve(); };
      } catch(e) { resolve(); }
    });

    return p;
  }

  // ----- 7. MODÜLER BÖLÜNMÜŞ PAINT FUNCTIONALITIES -----
  function paintHeader(plan, evening) {
    return `<div class="dh-koc-header">
      <span class="dh-koc-focus">🧭 ${evening ? '🌙 Akşam Teşhis ve Rapor Paneli' : '🎯 Mentor Kararı: ' + esc(plan.focus)}</span>
      <span class="dh-koc-badge">Başarı İhtimali: %${esc(plan.success_rate || "90")}</span>
    </div>`;
  }

  async function paintSteps(plan) {
    let stepsHtml = "";
    for(let i=0; i<plan.steps.length; i++) {
      const s = plan.steps[i];
      const statusObj = await dbGet("step_status", DAY + "-" + i);
      const isDone = statusObj ? statusObj.done : false;

      const stepTime = parseInt(s.time, 10) || 10;
      const finalHref = "./" + s.href + (s.href.indexOf("?") >= 0 ? "&" : "?") + "timer=" + stepTime;

      stepsHtml += `<div class="dh-koc-step ${isDone ? 'done' : ''}">
        <span class="dh-koc-step-label ${isDone ? 'strike' : ''}">
          <span>${isDone ? '✅' : '<b>' + (i+1) + '.</b>'}</span>
          <span>${esc(s.label)} <small style="color:#8ab4f8; margin-left:3px;">(${esc(String(stepTime))} dk)</small></span>
        </span>
        ${isDone ? '<span style="color:#28a745; font-size:12px; font-weight:bold;">Tamamlandı</span>' : `<a href="${finalHref}" data-step-idx="${i}" class="dh-koc-action-btn dh-koc-btn">Başla →</a>`}
      </div>`;
    }
    return stepsHtml;
  }

  function paintCoach(plan, evening, isAllDone) {
    let comment = plan.coach_comment || "";
    let reason = plan.decision_reason || "Mevcut çalışma verilerinin optimizasyonu.";
    let risk = plan.learning_risk_score || "24";
    
    if (evening) {
      comment = isAllDone 
        ? "Mükemmel! Bugün direktörün koyduğu tüm kurallara sadık kaldın ve planı sıfırladın. Kalıcı hafıza kilitleri açıldı!" 
        : "Gün biterken yönetim hedeflerinde yarım kalan maddeler var. Unutma riskini tetiklememek için uyumadan önce adımları kapat.";
    }

    return `
      <div class="dh-koc-mentor-box">
        <b class="dh-koc-mentor-title">🚨 Gerekçeli Karar ve Teşhis:</b>
        <span class="dh-koc-mentor-text" style="display:block; margin-bottom:8px; font-weight:500;">"${esc(comment)}"</span>
        <div style="font-size:12px; color:#f28b82; border-top:1px dashed rgba(255,255,255,0.08); padding-top:6px;">
          <b>Neden Bu Karar?</b> ${esc(reason)} | ⚠️ <b>Risk Skoru:</b> %${esc(risk)}
        </div>
      </div>
    `;
  }

  function paintCharts(profData) {
    const durationChart = generateAdvancedSVGChart(profData.trends.durations, '#1a73e8');
    const errorChart = generateAdvancedSVGChart(profData.trends.errors, '#ea4335');
    return `<div class="dh-koc-dashboard">
      <div class="dh-koc-dash-sect">
        <div class="dh-koc-dash-title"><span>📈 30 Günlük Yoğunluk Eğrisi</span><b style="color:#8ab4f8">${profData.history30DaysSummary.totalMinutes} dk</b></div>
        ${durationChart}
      </div>
      <div class="dh-koc-dash-sect">
        <div class="dh-koc-dash-title"><span>📉 Hata Yoğunluğu & Tepe Noktaları</span><b style="color:#f28b82">${profData.history30DaysSummary.totalErrors} Hata</b></div>
        ${errorChart}
      </div>
    </div>`;
  }

  function paintFooter(plan, mathCefr, completedCount, totalSteps) {
    const report = plan.weekly_report || {};
    return `
      <div class="dh-koc-dashboard" style="margin-top:14px; border-top:1px dashed rgba(255,255,255,0.06); padding-top:12px;">
        <div class="dh-koc-dash-sect">
          <div style="font-size:11px; font-weight:bold; color:#fbbc05; margin-bottom:4px; text-transform:uppercase;">📊 Haftalık Analitik Özet</div>
          <div style="font-size:12px; line-height:1.45; color:#e8eaed;">
            ✓ Üretim Hacmi: ${esc(String(report.sentences || "-"))} Cümle / ${esc(String(report.words || "-"))} Kelime<br>
            ✓ Doğruluk Oranı: %${esc(String(report.success_rate || "-"))}<br>
            🚀 Gelişen Kas: <span style="color:#81c995; font-weight:bold;">${esc(report.top_improved || "Hesaplanıyor")}</span>
          </div>
        </div>
        <div class="dh-koc-dash-sect">
          <div style="font-size:11px; font-weight:bold; color:#78d9ff; margin-bottom:4px; text-transform:uppercase;">🔮 Matematiksel CEFR Tahmini</div>
          <div style="font-size:12px; line-height:1.45; color:#e8eaed;">
            🎯 Hedef Kilidi: <span style="color:#78d9ff; font-weight:bold;">${esc(mathCefr.target_cefr)} Seviyesi</span><br>
            ⏱️ Kalan Süre: <b>${esc(String(mathCefr.days_remaining))} Gün</b><br>
            📅 Varış Tarihi: <span style="color:#f1f3f4; font-weight:500;">${esc(mathCefr.target_date)}</span>
          </div>
        </div>
      </div>
      <div class="dh-koc-footer-stats">
        <span>⏱️ Toplam Plan Süresi: ${esc(plan.estimated_time || "30")} dk</span>
        <span>📊 Tamamlama Başarısı: ${completedCount}/${totalSteps}</span>
      </div>
    `;
  }

  async function paint(plan, profData){
    try {
      const wrapper = document.getElementById("dhKocContainer");
      if (!wrapper || !plan || !plan.steps || !plan.steps.length) return;

      const totalSteps = plan.steps.length;
      let completedCount = 0;
      for (let i = 0; i < totalSteps; i++) { 
        const statusObj = await dbGet("step_status", DAY + "-" + i);
        if (statusObj && statusObj.done) completedCount++; 
      }

      const evening = isEvening();
      const isAllDone = (completedCount === totalSteps);
      const mathCefr = calculateMathematicalCEFR(profData);

      let cardClass = "dh-koc-card";
      if (evening) cardClass += isAllDone ? " evening-all-done" : " evening-pending";

      const stepsHtml = await paintSteps(plan);

      wrapper.innerHTML = `
        <div class="${cardClass}">
          ${paintHeader(plan, evening)}
          <div>${stepsHtml}</div>
          ${paintCoach(plan, evening, isAllDone)}
          ${paintCharts(profData)}
          ${paintFooter(plan, mathCefr, completedCount, totalSteps)}
        </div>
      `;

      // Event Listener Enjeksiyonu ve IndexedDB Güncelleme Tetikçisi
      const btns = wrapper.querySelectorAll(".dh-koc-action-btn");
      for (let btn of btns) {
        btn.addEventListener("click", async function() {
          const idx = this.getAttribute("data-step-idx");
          if (idx !== null) {
            await dbPut("step_status", { id: DAY + "-" + idx, done: true });
            // Hafıza katmanı güncellemesi (Geçmiş başarıyı loglamak için)
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

  function valid(p){
    if (!p || typeof p !== "object" || !Array.isArray(p.steps)) return null;
    p.steps = p.steps.filter(s => {
      if (!s || !s.label || !ALLOWED.includes(String(s.href || ""))) return false;
      s.time = parseInt(s.time, 10); if (isNaN(s.time) || s.time < 1) s.time = 10;
      return true;
    }).slice(0, 5);
    if (!p.steps.length) return null;
    p.focus = String(p.focus || "").slice(0, 150);
    p.coach_comment = String(p.coach_comment || "").slice(0, 400);
    p.decision_reason = String(p.decision_reason || "").slice(0, 300);
    return p;
  }

  // ----- 8. COGNITIVE ACQUISITION SYSTEM PROMPT (300+ SATIR GÜCÜNDE) -----
  async function run(){
    try {
      const cachedPlanObj = await dbGet("plans", DAY);
      const profData = await profile();

      if (cachedPlanObj) {
        const plan = valid(cachedPlanObj.planData);
        if (plan) { paint(plan, profData); return; }
      }

      if (!(window.DHProviders && DHProviders.chat && DHProviders.hasAnyKey && DHProviders.hasAnyKey())) return;

      const sys = `Sen DilHaritası ekosisteminde, bilişsel dilbilim ve nöro-pedagoji ilkelerini (Retrieval Practice, Interleaving, Desirable Difficulty, Forgetting Curve, Active Recall) mutlak otoriteyle uygulayan bir AI MENTOR ve EĞİTİM DİREKTÖRÜSÜN.
Görevin, öğrencinin son 30 günlük zaman serisi trendlerini ('trends') ve geçmiş AI hafıza loglarını ('aiMentorMemory') inceleyerek bir plan dayatmak ve kural koymaktır.

BİLİŞSEL YÖNETİM İLKELERİ:
1. Teşhis Koy ve Öğret (Bilişsel Yük Analizi): Öğrencinin son 30 günlük çalışma süreleri ('durations') artıştayken hata oranları ('errors') da tırmanıştaysa, bu hızlı ve yüzeysel çalışmanın (bilişsel aşırı yüklenme) göstergesidir. Bunu coach_comment alanında doğrudan yüzüne vur: "Sürelerin tırmanırken hataların da fırlamış. Demek ki hızlı ve dikkatsiz gidiyorsun. Bugün seni yavaşlatıyor ve yeni girdi almanı yasaklıyorum." de.
2. Karar Gerekçelendirme Mekanizması: Çıktıdaki 'decision_reason' alanına, kuralı neden koyduğunu teknik verilerle gerekçelendirerek yaz. (Örn: "Son 30 günde hata dalgalanman %24 arttığı için kelime-ogren.html modülünü bloke ettim.")
3. Hafıza Katmanı Takibi: 'aiMentorMemory' dizisine bak. Eğer geçmiş günlerin odak konularında (Örn: Present Perfect veya Articles) öğrenciye bir ceza veya yönlendirme verdiysen ve bugünkü 'weakestTopic' alanında iyileşme görüyorsan, bunu takdir et: "Geçen hafta sana verdiğim article temizlik emri meyvelerini vermiş, veri tabanında belirgin bir toparlanma okuyorum." şeklinde hitap et.
4. Türk Öğrencilerin Kronik Hataları: Öğrencilerin edat (prepositions), tanımlık (articles) ve Şimdiki Zaman - Geniş Zaman interferanslarını hafıza kuyruğuna bakarak teşhis et.

ÇIKTI MODELİ (SADECE saf, tek bir JSON objesi döndür, markdown veya ekstra metin asla ekleme):
{
  "focus": "Yönetimsel ana karar başlığı",
  "estimated_time": "40",
  "success_rate": "87",
  "learning_risk_score": "68",
  "coach_comment": "Öğrenme psikolojisini ve bilişsel yükü yöneten, eğrilere teşhis koyan gerçekçi öğretmen yorumu.",
  "decision_reason": "Bu kararın verilmesinin ardındaki net veri gerekçesi.",
  "steps": [
    {"label": "Bilişsel Hata Temizliği", "href": "hata-defteri.html", "time": 15},
    {"label": "Interleaved Hafıza Eritme", "href": "tekrar.html?plan=1", "time": 25}
  ],
  "weekly_report": {
    "sentences": 432,
    "words": 231,
    "success_rate": 89,
    "top_improved": "Present Perfect"
  }
}`;

      const out = await DHProviders.chat([{role:"system", content:sys}, {role:"user", content:JSON.stringify(profData)}], {temperature: 0.15, max_tokens: 850});

      let plan = null;
      const planObj = extractFirstJSONObject(String(out));
      plan = valid(planObj);

      if (plan) {
        // Bugünün planını ve ilerleme durumunu IndexedDB'ye kaydet
        await dbPut("plans", {
          date: DAY,
          planData: plan,
          completed: false,
          stepsFinished: 0
        });

        // Uzun vadeli mentor kararları geçmişine ekle
        await dbPut("history", {
          date: DAY,
          focus: plan.focus,
          decision_reason: plan.decision_reason
        });

        paint(plan, profData);
      }
    } catch(_) {}
  }

  if (document.readyState !== "loading") setTimeout(run, 1200);
  else document.addEventListener("DOMContentLoaded", function() { setTimeout(run, 1200); });
})();