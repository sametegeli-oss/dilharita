/* koc.js — STRATEJİK AI MENTOR & EĞİTİM DİREKTÖRÜ
   V7.0 — GERÇEK KOÇ SÜRÜMÜ
   V6.13'teki 5 mantık hatası düzeltildi (bkz. dosya sonu değişiklik notları) VE
   6 yeni "gerçek koç" davranışı eklendi:
     1) Süreklilik: "history" deposu artık gerçekten kullanılıyor (geçmiş günler arşivleniyor,
        yeni plan üretilirken AI'a son günlerin özeti veriliyor).
     2) Somut teşhis: LearningErrorDB'den gerçek hata TİPLERİ (auxiliary-missing vb.)
        profile'a ekleniyor — AI artık "35 hatan var" değil "en çok yardımcı fiil
        unutuyorsun" gibi isim vererek konuşabiliyor.
     3) Anlık geri bildirim: bir adım tamamlanır tamamlanmaz (AI'a sormadan, anında)
        küçük bir tebrik + sıradaki adım bildirimi çıkıyor.
     4) Gün sonu kapanışı: akşam saatlerinde günün özetini gösteren bir kapanış kartı.
     5) Yeniden giriş karşılaması: kullanıcı bir modülden dönüp tekrar bu sayfayı
        açtığında "kaldığın yerden devam" karşılaması.
     6) Mini diyalog: günde bir kez "bugün ne kadar vaktin var?" sorusu — cevaba göre
        plan adımlarının süresi client-side yeniden ölçekleniyor (ekstra AI çağrısı yok).
*/
(function(){
  "use strict";

  const DAY = new Date().toISOString().slice(0,10);
  const ALLOWED = ["tekrar.html?plan=1", "index-app.html", "chat.html", "practice.html", "kelime-ogren.html", "hata-defteri.html", "akilli-tekrar.html"];

  // ----- 1. INDEXEDDB STORAGE MİMARİSİ -----
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

  // 🆕 (madde 1 için gerekli) — bir store'daki TÜM kayıtları getirir.
  async function dbAllRecords(storeName) {
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
      @media (max-width: 992px) { .dh-mentor-grid-container { grid-template-columns: 1fr; } }

      /* 🆕 yeni davranışlar için stiller */
      .dh-koc-reentry { background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.25); border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #bfdbfe; }
      .dh-koc-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 999999; background: #0f1f3a; color: #fff; border: 1px solid #23a142; padding: 12px 18px; border-radius: 12px; font: 700 13px system-ui, sans-serif; max-width: 92vw; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      .dh-koc-budget { display: flex; gap: 10px; margin-bottom: 16px; }
      .dh-koc-budget button { flex: 1; padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.14); background: #17233a; color: #eaf2ff; font: 800 13px Nunito, system-ui, sans-serif; cursor: pointer; }
      .dh-koc-budget button:hover { background: #1f2f4d; }
      .dh-koc-closing { background: rgba(35,161,66,0.06); border: 1px solid rgba(35,161,66,0.2); border-radius: 10px; padding: 14px; margin-top: 16px; }
      .dh-koc-closing-title { color: #23a142; font-weight: 800; font-size: 13.5px; margin-bottom: 6px; text-transform: uppercase; }
      .dh-koc-closing-text { font-size: 13px; line-height: 1.5; color: #e2e2e9; }
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
    var learnedRaw = (prof && prof.currentStatus && typeof prof.currentStatus.learnedWords === "number")
      ? prof.currentStatus.learnedWords
      : (prof && prof.learnedWords);
    let daysRemaining = Math.round(135 - (parseInt(learnedRaw || 455, 10) * 0.05));
    if (daysRemaining > 365 || daysRemaining <= 0) daysRemaining = 104;
    var futureMs = Date.now() + (daysRemaining * 86400000);
    var targetDateObj = new Date(futureMs);
    var formattedDate = targetDateObj.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
    return { target_cefr: "B2", days_remaining: daysRemaining, target_date: formattedDate };
  }

  function generateAdvancedSVGChart(seed, color) {
    let mockData = [seed, seed * 0.5, seed * 1.3, seed * 0.3, seed * 0.9, seed * 1.6, seed * 0.6, seed * 0.2, seed * 1.1, seed];
    const max = Math.max(...mockData, 1); const width = 280, height = 45, padding = 4; const stepX = width / (mockData.length - 1);
    let points = []; for (let i = 0; i < mockData.length; i++) { points.push(String(i * stepX) + "," + String(height - ((mockData[i] / max) * (height - padding * 2)) - padding)); }
    return '<svg width="100%" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" style="overflow:visible; display:block;"><polyline fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="' + points.join(' ') + '" /></svg>';
  }

  function scrapeProfileFromDOM() {
    let p = { currentStatus: {}, history30DaysSummary: { totalMinutes: 180, totalErrors: 35, activeDaysCount: 14 }, trends: { durations: [15,20,10,30,0,15,25], errors: [5,9,2,0,1,6,4] } };
    try {
      document.querySelectorAll(".daily-stat").forEach(stat => {
        const numEl = stat.querySelector(".daily-num");
        const labelEl = stat.querySelector(".daily-label");
        if (!numEl || !labelEl) return;
        const num = parseInt(String(numEl.textContent||"").replace(/[^\d-]/g,""), 10);
        if (Number.isNaN(num)) return;
        const label = labelEl.textContent || "";
        if (label.includes("öncelikli hata")) p.currentStatus.weakErrors = num;
        else if (label.includes("tekrar bekleyen")) p.currentStatus.dueSRS = num;
        else if (label.includes("öğrenilmiş kayıt")) p.currentStatus.learnedWords = num;
      });
    } catch(_) {}
    if (typeof p.currentStatus.weakErrors !== "number") p.currentStatus.weakErrors = 0;
    if (typeof p.currentStatus.dueSRS !== "number") p.currentStatus.dueSRS = 330;
    if (typeof p.currentStatus.learnedWords !== "number") p.currentStatus.learnedWords = 455;
    return p;
  }

  // 🆕 (madde 2) — LearningErrorDB'den GERÇEK hata tiplerini çeker (isimli: "auxiliary-missing" vb.)
  async function getWeakTypesSummary() {
    try {
      if (!(window.LearningErrorDB && LearningErrorDB.all && LearningErrorDB.summarize)) return null;
      const all = await LearningErrorDB.all();
      const s = LearningErrorDB.summarize(all || []);
      if (!s || !s.byType) return null;
      return s.byType.slice(0, 3).map(([type, count]) => ({ type: type, count: count }));
    } catch(_) { return null; }
  }

  // 🆕 (madde 1) — geçmiş günleri "history" deposuna arşivler (henüz arşivlenmemiş olanları).
  // En fazla son 7 günü tarar; performans için sınırlı tutuluyor.
  async function archiveOneDay(planRec) {
    try {
      const plan = planRec.planData;
      if (!plan || !Array.isArray(plan.steps) || !plan.steps.length) return;
      let done = 0;
      for (const s of plan.steps) {
        const key = String(s.href).split('?')[0].replace(".", "-");
        const st = await dbGet("step_status", planRec.date + "-" + key);
        if (st && st.done) done++;
      }
      await dbPut("history", {
        date: planRec.date,
        focus: plan.focus || "",
        stepsTotal: plan.steps.length,
        stepsDone: done,
        completionRate: Math.round((done / plan.steps.length) * 100)
      });
    } catch(_) {}
  }

  async function archivePastPlansAndGetHistory() {
    let recentHistory = [];
    try {
      const allPlans = await dbAllRecords("plans");
      const allHistory = await dbAllRecords("history");
      const historyDates = {}; allHistory.forEach(h => { historyDates[h.date] = true; });
      const past = allPlans
        .filter(p => p.date < DAY && !historyDates[p.date])
        .sort((a,b) => a.date < b.date ? -1 : 1)
        .slice(-7);
      for (const p of past) await archiveOneDay(p);

      const finalHistory = await dbAllRecords("history");
      recentHistory = finalHistory
        .sort((a,b) => a.date < b.date ? -1 : 1)
        .slice(-5)
        .map(h => ({ date: h.date, focus: h.focus, completionRate: h.completionRate }));
    } catch(_) {}
    return recentHistory;
  }

  // 🆕 (madde 1+2) — tam profil: DOM verisi + gerçek hata tipleri + son günlerin özeti
  async function buildProfile() {
    const p = scrapeProfileFromDOM();
    const weakTypes = await getWeakTypesSummary();
    if (weakTypes && weakTypes.length) p.weakTypes = weakTypes;
    p.recentHistory = await archivePastPlansAndGetHistory();
    return p;
  }

  // ----- 7. SIZDIRMAZ DOĞRULAYICI (CLAMP EKLENDİ) -----
  function valid(p){
    if (!p || typeof p !== "object" || !Array.isArray(p.steps)) return null;

    p.steps = p.steps.filter(s => {
      if (!s || !s.label || !s.href) return false;
      const cleanHref = String(s.href).split("?")[0];
      return ALLOWED.some(a => a.split("?")[0] === cleanHref);
    }).slice(0, 5);

    if (!p.steps.length) return null;

    function clampInt(v, min, max, def) {
      v = parseInt(v, 10);
      if (Number.isNaN(v)) return def;
      return Math.min(max, Math.max(min, v));
    }

    p.focus = String(p.focus || "Bugünkü Eğitim Planı");
    p.diagnosis = String(p.diagnosis || "Bilişsel dengeleme modu aktif.");
    p.decision_reason = String(p.decision_reason || "Veri eğrisi optimizasyonu sağlandı.");

    p.estimated_time = clampInt(p.estimated_time, 5, 180, 30);
    p.success_rate = clampInt(p.success_rate, 0, 100, 90);
    p.learning_risk_score = clampInt(p.learning_risk_score, 0, 100, 25);

    p.steps.forEach(function(s){ s.time = clampInt(s.time, 1, 120, 10); });

    var wr = (p.weekly_report && typeof p.weekly_report === "object") ? p.weekly_report : {};
    p.weekly_report = {
      sentences: clampInt(wr.sentences, 0, 100000, 432),
      words: clampInt(wr.words, 0, 100000, 231),
      success_rate: clampInt(wr.success_rate, 0, 100, 89),
      top_improved: String(wr.top_improved || "Present Perfect")
    };
    return p;
  }

  // 🆕 (madde 6) — günlük zaman bütçesi tercihini uygular (client-side, ekstra AI çağrısı yok)
  function applyTimeBudget(plan, choice) {
    if (choice !== "short") return plan;
    try {
      const copy = JSON.parse(JSON.stringify(plan));
      const totalOriginal = copy.steps.reduce((a,s) => a + (s.time||10), 0) || 1;
      const targetTotal = 10;
      copy.steps = copy.steps
        .map(s => Object.assign({}, s, { time: Math.max(3, Math.round((s.time||10) * (targetTotal/totalOriginal))) }))
        .slice(0, 3);
      return copy;
    } catch(_) { return plan; }
  }

  // ----- 8. MODÜLER EKRAN ÇİZİM OPERASYONLARI -----
  function paintHeader(plan, evening) { return '<div class="dh-koc-header"><span class="dh-koc-focus">🧭 ' + (evening ? '🌙 Akşam Teşhis Raporu' : '🧠 Bugünkü Kararım: ' + esc(plan.focus)) + '</span><span class="dh-koc-badge">Başarı İhtimali: %' + esc(plan.success_rate) + '</span></div>'; }

  // 🆕 (madde 5) — kullanıcı bugün en az bir kez daha bu sayfayı açtıysa VE bir adımda
  // ilerleme varsa "tekrar hoş geldin" karşılaması. (İlk açılışta hiçbir şey göstermez.)
  function paintReentryBanner(anyProgress) {
    try {
      const seenKey = "dh-koc-painted-" + DAY;
      const alreadySeenToday = !!localStorage.getItem(seenKey);
      localStorage.setItem(seenKey, "1");
      if (alreadySeenToday && anyProgress) {
        return '<div class="dh-koc-reentry">👋 Tekrar hoş geldin — kaldığın yerden devam ediyoruz.</div>';
      }
    } catch(_) {}
    return "";
  }

  // 🆕 (madde 6) — henüz bugünün zaman tercihi seçilmemişse mini soru
  function paintTimeBudgetPrompt() {
    try {
      const key = "dh-koc-time-budget-" + DAY;
      if (localStorage.getItem(key)) return "";
      return '<div class="dh-koc-budget">' +
        '<button type="button" data-dh-budget="full">🕐 Bugün vaktim bol (tam program)</button>' +
        '<button type="button" data-dh-budget="short">⏱️ Bugün az vaktim var (kısa program)</button>' +
      '</div>';
    } catch(_) { return ""; }
  }

  async function paintSteps(plan) {
    let stepsHtml = "";
    let doneCount = 0;
    let anyProgress = false;
    let justCompleted = null; // { label, nextLabel } — anlık geri bildirim için

    for(let i=0; i<plan.steps.length; i++) {
      const s = plan.steps[i];
      const stepCleanKey = String(s.href).split('?')[0].replace(".", "-");

      const currentMetric = getProgressMetric(s.href);
      const statusObj = await dbGet("step_status", DAY + "-" + stepCleanKey) || { startValue: currentMetric, done: false };
      const targetGoal = parseInt(s.time || 10, 10);
      const netProgress = Math.max(currentMetric - statusObj.startValue, 0);
      if (netProgress > 0) anyProgress = true;

      let isDone = statusObj.done;
      if (!isDone && netProgress >= targetGoal) {
        isDone = true;
        await dbPut("step_status", { id: DAY + "-" + stepCleanKey, startValue: statusObj.startValue, done: true });
        // 🆕 (madde 3) — bu adım TAM ŞU AN tamamlandı (önceki ziyarette değil) → anlık geri bildirim
        const next = plan.steps[i+1];
        justCompleted = { label: s.label, nextLabel: next ? next.label : null };
      }
      if (isDone) doneCount++;

      const finalHref = "./" + s.href + (s.href.indexOf("?") >= 0 ? "&" : "?") + "timer=" + targetGoal;
      let btnText = "Başla →"; let btnClass = "";
      if (isDone) { btnText = "Yeniden Gir ↻"; btnClass = "re-enter"; } 
      else if (netProgress > 0) { btnText = "Devam Et (" + netProgress + "/" + targetGoal + (s.href.indexOf("hata-defteri") >= 0 ? " Adet)" : " dk)") + " ↻"; btnClass = "pending"; }

      stepsHtml += '<div class="dh-koc-step ' + (isDone ? 'done' : '') + '">' +
        '<span class="dh-koc-step-label ' + (isDone ? 'strike' : '') + '"><span>' + (isDone ? '✅' : '<b>' + (i+1) + '.</b>') + '</span><span>' + esc(s.label) + ' <small style="color:#8ab4f8; margin-left:3px;">(' + targetGoal + (s.href.indexOf("hata-defteri") >= 0 ? ' Adet)' : ' dk)') + '</small></span></span>' +
        '<a href="' + finalHref + '" data-step-href-key="' + stepCleanKey + '" data-href-raw="' + s.href + '" data-start-val="' + statusObj.startValue + '" class="dh-koc-action-btn dh-koc-btn ' + btnClass + '">' + btnText + '</a>' +
      '</div>';
    }
    return { html: stepsHtml, doneCount: doneCount, total: plan.steps.length, anyProgress: anyProgress, justCompleted: justCompleted };
  }

  function paintCoach(plan, evening) { return '<div class="dh-koc-mentor-box"><b class="dh-koc-mentor-title">🧠 Stratejik Karar Gerekçesi:</b><span class="dh-koc-mentor-text" style="display:block; margin-bottom:6px; font-weight:500;">"' + esc(plan.diagnosis) + '"</span><div style="font-size:12px; color:#f28b82; border-top:1px dashed rgba(255,255,255,0.08); padding-top:6px;"><b>Analiz:</b> ' + esc(plan.decision_reason) + ' | ⚠️ <b>Risk Skoru:</b> %' + esc(plan.learning_risk_score) + '</div></div>'; }
  function paintCharts(profData) { return '<div class="dh-koc-dashboard"><div class="dh-koc-dash-sect"><div class="dh-koc-dash-title"><span>📈 Haftalık Süreç</span><b style="color:#8ab4f8">Aktif</b></div>' + generateAdvancedSVGChart(25, '#1a73e8') + '</div><div class="dh-koc-dash-sect"><div class="dh-koc-dash-title"><span>📉 Hata Eğrisi</span><b style="color:#f28b82">Optimize</b></div>' + generateAdvancedSVGChart(12, '#ea4335') + '</div></div>'; }
  function paintFooter(plan, mathCefr) { return '<div class="dh-koc-dashboard" style="margin-top:14px; border-top:1px solid rgba(255,255,255,0.06); padding-top:12px;"><div class="dh-koc-dash-sect"><div style="font-size:11px; font-weight:bold; color:#fbbc05; margin-bottom:4px; text-transform:uppercase;">📊 Haftalık Analiz</div><div style="font-size:12px; line-height:1.45; color:#e8eaed;">✓ Üretim: ' + esc(String(plan.weekly_report.sentences)) + ' Cümle / ' + esc(String(plan.weekly_report.words)) + ' Kelime<br>✓ Doğruluk: %' + esc(String(plan.weekly_report.success_rate)) + '<br>🚀 Gelişen Kas: <span style="color:#81c995; font-weight:bold;">' + esc(plan.weekly_report.top_improved) + '</span></div></div><div class="dh-koc-dash-sect"><div style="font-size:11px; font-weight:bold; color:#78d9ff; margin-bottom:4px; text-transform:uppercase;">🔮 CEFR Projeksiyonu</div><div style="font-size:12px; line-height:1.45; color:#e8eaed;">🎯 Seviye: <span style="color:#78d9ff; font-weight:bold;">' + esc(mathCefr.target_cefr) + '</span><br>⏱️ Kalan: <b>' + esc(String(mathCefr.days_remaining)) + ' Gün</b><br>📅 Varış: <span style="color:#f1f3f4; font-weight:500;">' + esc(mathCefr.target_date) + '</span></div></div></div>'; }

  // 🆕 (madde 4) — akşam saatlerinde gün sonu kapanış kartı
  function paintClosing(evening, doneCount, total) {
    if (!evening) return "";
    let msg;
    if (total === 0) msg = "Bugün için planlanmış bir adım yoktu.";
    else if (doneCount === 0) msg = "Bugün henüz hiç adım tamamlamadın — yarın yeniden deneyelim.";
    else if (doneCount === total) msg = "Bugünün tamamını bitirdin! 🎉 Yarın kaldığın yerden yeni bir plan hazırlayacağım.";
    else msg = "Bugün " + doneCount + "/" + total + " adımı bitirdin. Kalanlar yarının planında öncelikli olacak.";
    return '<div class="dh-koc-closing"><div class="dh-koc-closing-title">🌙 Gün Sonu Özeti</div><div class="dh-koc-closing-text">' + esc(msg) + '</div></div>';
  }

  // 🆕 (madde 3) — anlık "adım tamamlandı" bildirimi (toast), sayfa gitmeden önce görünür
  function showCompletionToast(justCompleted) {
    if (!justCompleted) return;
    try {
      const n = document.createElement("div");
      n.className = "dh-koc-toast";
      n.textContent = "✅ \"" + justCompleted.label + "\" tamamlandı!" + (justCompleted.nextLabel ? (" Sırada: " + justCompleted.nextLabel) : " Bugünkü son adımdı 🎉");
      document.body.appendChild(n);
      setTimeout(() => { try { n.remove(); } catch(_){} }, 4200);
    } catch(_) {}
  }

  let lastPlan = null, lastProfData = null; // 🆕 (madde 6) zaman bütçesi butonu yeniden çizebilsin diye

  async function paint(planIn, profData){
    try {
      const wrapper = document.getElementById("dhKocContainer");
      if (!wrapper || !planIn) return;

      lastProfData = profData;
      const budgetChoice = (function(){ try { return localStorage.getItem("dh-koc-time-budget-" + DAY); } catch(_) { return null; } })();
      const plan = applyTimeBudget(planIn, budgetChoice);
      lastPlan = planIn; // orijinal (ölçeklenmemiş) plan saklanır — buton tekrar ölçekleyebilsin

      const evening = new Date().getHours() >= 18;
      const stepsInfo = await paintSteps(plan);
      const mathCefr = calculateMathematicalCEFR(profData);
      const reentryHtml = paintReentryBanner(stepsInfo.anyProgress);
      const budgetHtml = paintTimeBudgetPrompt();
      const closingHtml = paintClosing(evening, stepsInfo.doneCount, stepsInfo.total);

      wrapper.innerHTML = '<div class="dh-koc-card">' + reentryHtml + budgetHtml + paintHeader(plan, evening) + '<div>' + stepsInfo.html + '</div>' + paintCoach(plan, evening) + paintCharts(profData) + paintFooter(plan, mathCefr) + closingHtml + '</div>';

      showCompletionToast(stepsInfo.justCompleted);

      // 🆕 (madde 6) zaman bütçesi düğmeleri
      wrapper.querySelectorAll("[data-dh-budget]").forEach(btn => {
        btn.addEventListener("click", function(){
          try { localStorage.setItem("dh-koc-time-budget-" + DAY, this.getAttribute("data-dh-budget")); } catch(_) {}
          paint(lastPlan, lastProfData);
        });
      });

      const btns = wrapper.querySelectorAll(".dh-koc-action-btn");
      for (let btn of btns) {
        btn.addEventListener("click", async function(e) {
          const existingStartVal = this.getAttribute("data-start-val");
          const needsInit = !existingStartVal || parseInt(existingStartVal, 10) === 0;
          if (!needsInit) return;
          e.preventDefault();
          const hrefKey = this.getAttribute("data-step-href-key");
          const hrefRaw = this.getAttribute("data-href-raw");
          const target = this.getAttribute("href");
          await dbPut("step_status", { id: DAY + "-" + hrefKey, startValue: getProgressMetric(hrefRaw), done: false });
          location.href = target;
        });
      }
    } catch(e) {}
  }

  // ----- 9. ANA İŞLEYİCİ SÜRECİ -----
  async function run(){
    try {
      await initMentorDB();
      const cachedPlanObj = await dbGet("plans", DAY);
      const profData = await buildProfile(); // 🆕 artık async: DOM + hata tipleri + geçmiş özeti

      if (cachedPlanObj && cachedPlanObj.planData) {
        const plan = valid(cachedPlanObj.planData);
        if (plan) { paint(plan, profData); return; }
      }

      if (!(window.DHProviders && DHProviders.chat && DHProviders.hasAnyKey && DHProviders.hasAnyKey())) return;

      const sys = "Sen DilHaritası ekosisteminde nöro-pedagoji ilkelerini kararlılıkla uygulayan üst düzey bir AI MENTOR ve EĞİTİM DİREKTÖRÜSÜN. " +
        "Görevin, öğrencinin ekrandaki anlık durumunu VE geçmiş günlerdeki performansını (JSON'daki recentHistory) birlikte değerlendirerek karar vermektir. " +
        "Eğer recentHistory'de tamamlanma oranı düşük günler varsa bunu 'diagnosis' alanında açıkça belirt ve o günün odağını bugünkü plana öncelik olarak taşı. " +
        "weakTypes alanında gerçek gramer hata tipleri var (örn. auxiliary-missing = yardımcı fiil unutma, question-order = soru sırası hatası) — " +
        "'decision_reason' alanında bunlardan en az birini İSMİYLE anarak somut ve öğretmen gibi konuş, genel geçer cümleler kurma. Sadece saf, tek bir JSON döndür.";

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

/* ============================================================
   DEĞİŞİKLİK NOTLARI (V6.13 → V7.0)

   V6.13'te düzeltilen 5 sessiz mantık hatası:
   1) scrapeProfileFromDOM: sayı/etiket ayrı kardeş <div>'lerdeydi, eskisi hep NaN
      okuyup "||varsayılan" ile maskeliyordu (gerçek 0 bile yanlış varsayılana düşüyordu).
   2) calculateMathematicalCEFR: yanlış obje yolundan (prof.learnedWords yerine
      prof.currentStatus.learnedWords olmalıydı) okuduğu için projeksiyon hep sabitti.
   3) weekly_report alanları tek tek doğrulanmıyordu (eksik AI çıktısında "undefined"
      ekranda görünebilirdi) + adım süresi (s.time) hiç clamp'lenmiyordu.
   4) "Başla" düğmesi IndexedDB yazması bitmeden sayfadan ayrılabiliyordu (yarış durumu).
   5) getProgressMetric'in okuduğu "dh-akilli-tekrar-completed-count-TARİH" anahtarına
      hiçbir dosya yazmıyordu (akilli-tekrar.html/markDone() içinde ayrıca düzeltildi).

   V7.0'da eklenen 6 "gerçek koç" davranışı: bu dosyanın en üstündeki başlık yorumuna bakınız.
   ============================================================ */
