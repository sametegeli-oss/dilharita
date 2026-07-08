/* koc.js — STRATEJİK AI MENTOR & EĞİTİM DİREKTÖRÜ (V7.0 - ACTIVE COACHING & MEMORY)
   Özellikler: Kilitlenmeyen Race Timeout Katmanı · history Hafıza Entegrasyonu · 
               Adım Tamamlama Anlık Mentor Geri Bildirimi · DOM-Driven Profilleme */
(function(){
  "use strict";

  const DAY = new Date().toISOString().slice(0,10);
  const ALLOWED = ["tekrar.html?plan=1", "index-app.html", "chat.html", "practice.html", "kelime-ogren.html", "hata-defteri.html", "akilli-tekrar.html"];
  
  function withTimeout(promise, ms = 2000, fallbackValue = null) {
    let timeout = new Promise((resolve) => setTimeout(() => resolve(fallbackValue), ms));
    return Promise.race([promise, timeout]);
  }

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
    const rawPromise = new Promise((resolve) => {
      try {
        initMentorDB().then(db => {
          if (!db) return resolve(null);
          const tx = db.transaction(storeName, "readonly");
          const req = tx.objectStore(storeName).get(key);
          req.onsuccess = function() { resolve(req.result); };
          req.onerror = function() { resolve(null); };
        }).catch(() => resolve(null));
      } catch(_) { resolve(null); }
    });
    return withTimeout(rawPromise, 1500, null);
  }

  async function dbPut(storeName, obj) {
    const rawPromise = new Promise((resolve) => {
      try {
        initMentorDB().then(db => {
          if (!db) return resolve(false);
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).put(obj);
          tx.oncomplete = function() { resolve(true); };
          tx.onerror = function() { resolve(false); };
        }).catch(() => resolve(false));
      } catch(_) { resolve(false); }
    });
    return withTimeout(rawPromise, 1500, false);
  }

  // 🚀 HAFIZA KATMANI: Son 3 günün mentor kararlarını ve başarı çıktılarını toplayan fonksiyon
  async function getRecentHistorySummary() {
    try {
      const db = await initMentorDB(); if(!db) return [];
      return new Promise((resolve) => {
        const tx = db.transaction("history", "readonly");
        const req = tx.objectStore("history").getAll();
        req.onsuccess = function() {
          var all = req.result || [];
          resolve(all.slice(-3)); // Son 3 günün özet hafızasını ver
        };
        req.onerror = function() { resolve([]); };
      });
    } catch(_) { return []; }
  }

  // ----- 2. CSS YÜKLEYİCİ -----
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
      
      /* 🚀 YENİ: Dinamik Canlı Mentor Geri Bildirim Balonu */
      .dh-koc-speech-bubble { background: linear-gradient(135deg, #1e3a8a, #0f172a); border: 1px solid #3b82f6; border-radius: 12px; padding: 12px 15px; margin-bottom: 16px; position: relative; animation: dhFadeIn 0.4s ease; }
      .dh-koc-speech-bubble::after { content: ''; position: absolute; bottom: -8px; left: 30px; border-width: 8px 8px 0; border-style: solid; border-color: #0f172a transparent; display: block; width: 0; }
      
      .dh-koc-mentor-box { background: rgba(234,67,53,0.03); padding: 14px; border-radius: 10px; border-left: 4px solid #ea4335; margin-bottom: 16px; border: 1px solid rgba(234,67,53,0.08); border-left-width: 4px; }
      .dh-koc-mentor-title { color: #ea4335; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 13.5px; font-weight: 700; text-transform: uppercase; }
      .dh-koc-mentor-text { font-size: 13.5px; line-height: 1.5; color: #e2e2e9; }
      @keyframes dhFadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
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

  function getTodayCurrentDuration() {
    try {
      var tr = JSON.parse(localStorage.getItem("dh-study-tracker-v1") || "{}") || {};
      var todayData = (tr.days || {})[DAY] || {};
      return parseInt(todayData.duration || "0", 10);
    } catch(_) { return 0; }
  }

  function scrapeProfileFromDOM() {
    let p = { currentStatus: {}, history30DaysSummary: { totalMinutes: 180, totalErrors: 35, activeDaysCount: 14 }, trends: { durations: [15,20,10,30,0,15,25], errors: [5,9,2,0,1,6,4] } };
    try {
      document.querySelectorAll(".daily-stat, div, span").forEach(stat => {
        let txt = stat.textContent || "";
        if (txt.includes("öncelikli hata")) p.currentStatus.weakErrors = parseInt(txt, 10);
        else if (txt.includes("tekrar bekleyen")) p.currentStatus.dueSRS = parseInt(txt, 10);
        else if (txt.includes("öğrenilmiş kayıt")) p.currentStatus.learnedWords = parseInt(txt, 10);
      });
    } catch(_) {}
    if (typeof p.currentStatus.weakErrors !== "number") p.currentStatus.weakErrors = 15;
    if (typeof p.currentStatus.dueSRS !== "number") p.currentStatus.dueSRS = 330;
    if (typeof p.currentStatus.learnedWords !== "number") p.currentStatus.learnedWords = 455;
    return p;
  }

  function valid(p) {
    if (!p || typeof p !== "object" || !Array.isArray(p.steps)) return null;
    p.steps = p.steps.filter(s => s && s.label && s.href).slice(0, 5);
    if (!p.steps.length) return null;

    function clampInt(v, min, max, def) { v = parseInt(v, 10); return Number.isNaN(v) ? def : Math.min(max, Math.max(min, v)); }
    p.focus = String(p.focus || "Bugünkü Eğitim Planı");
    p.diagnosis = String(p.diagnosis || "Bilişsel dengeleme modu aktif.");
    p.decision_reason = String(p.decision_reason || "Veri eğrisi optimizasyonu sağlandı.");
    p.estimated_time = clampInt(p.estimated_time, 5, 180, 30);
    p.success_rate = clampInt(p.success_rate, 0, 100, 90);
    p.learning_risk_score = clampInt(p.learning_risk_score, 0, 100, 25);
    p.steps.forEach(function(s){ s.time = clampInt(s.time, 1, 120, 10); });
    return p;
  }

  // ----- 8. MODÜLER EKRAN ÇİZİM OPERASYONLARI -----
  function paintHeader(plan, evening) { return '<div class="dh-koc-header"><span class="dh-koc-focus">🧭 ' + (evening ? '🌙 Akşam Teşhis Raporu' : '🧠 Bugünkü Kararım: ' + esc(plan.focus)) + '</span><span class="dh-koc-badge">Başarı İhtimali: %' + esc(plan.success_rate) + '</span></div>'; }
  
  // 🚀 DEVREDE: Anlık Geri Bildirim Balonunu Çizen Motor
  async function paintSpeechBubble(plan) {
    let completedCount = 0;
    let lastCompletedLabel = "";
    
    for (let s of plan.steps) {
      const stepCleanKey = String(s.href).split('?')[0].replace(".", "-");
      const statusObj = await dbGet("step_status", DAY + "-" + stepCleanKey);
      if (statusObj && statusObj.done) {
        completedCount++;
        lastCompletedLabel = s.label;
      }
    }

    if (completedCount === 0) {
      return '<div class="dh-koc-speech-bubble"><span style="font-size:13.5px; color:#93c5fd;">👋 Hoş geldin! Bugün senin için hazırladığım plan hazır. İlk adımı atarak nöon bağlarını ateşleyelim. Başarılar!</span></div>';
    }
    
    if (completedCount === plan.steps.length) {
      return '<div class="dh-koc-speech-bubble" style="border-color:#34d399; background:linear-gradient(135deg, #064e3b, #022c22);"><span style="font-size:13.5px; color:#a7f3d0;">🎉 Muazzam! Bugün senin için verdiğim tüm direktifleri eksiksiz tamamladın. Harika bir zihinsel disiplin örneği! Yarın yeni bir analizle görüşmek üzere.</span></div>';
    }

    return '<div class="dh-koc-speech-bubble"><span style="font-size:13.5px; color:#67e8f9;">🔥 Harika! <b>' + esc(lastCompletedLabel) + '</b> adımını tamamladın. İlerlememiz harika (' + completedCount + '/' + plan.steps.length + '). Odaklanmaya devam et, sıradaki adımı bekletme!</span></div>';
  }

  async function paintSteps(plan) {
    let stepsHtml = "";
    for(let i=0; i<plan.steps.length; i++) {
      const s = plan.steps[i];
      const stepCleanKey = String(s.href).split('?')[0].replace(".", "-");
      const currentMetric = getProgressMetric(s.href);
      
      const statusObj = await dbGet("step_status", DAY + "-" + stepCleanKey) || { startValue: currentMetric, done: false };
      const targetGoal = parseInt(s.time || 10, 10);
      const netProgress = Math.max(currentMetric - statusObj.startValue, 0);
      
      let isDone = statusObj.done;
      if (!isDone && netProgress >= targetGoal) {
        isDone = true;
        await dbPut("step_status", { id: DAY + "-" + stepCleanKey, startValue: statusObj.startValue, done: true });
        
        // 🚀 HAFIZA GÜNCELLEME: Adım bittiği an gün sonu raporu için tarihsel history kaydını güncelle
        await dbPut("history", { date: DAY, focus: plan.focus, completedSteps: (i + 1), totalSteps: plan.steps.length });
        
        // Ekranı anlık geri bildirim balonu değişsin diye yeniden çizdir
        setTimeout(run, 100);
      }

      const finalHref = "./" + s.href + (s.href.indexOf("?") >= 0 ? "&" : "?") + "timer=" + targetGoal;
      let btnText = "Başla →"; let btnClass = "";
      if (isDone) { btnText = "Yeniden Gir ↻"; btnClass = "re-enter"; } 
      else if (netProgress > 0) { btnText = "Devam Et (" + netProgress + "/" + targetGoal + (s.href.indexOf("hata-defteri") >= 0 ? " Adet)" : " dk)") + " ↻"; btnClass = "pending"; }

      stepsHtml += '<div class="dh-koc-step ' + (isDone ? 'done' : '') + '">' +
        '<span class="dh-koc-step-label ' + (isDone ? 'strike' : '') + '"><span>' + (isDone ? '✅' : '<b>' + (i+1) + '.</b>') + '</span><span>' + esc(s.label) + ' <small style="color:#8ab4f8; margin-left:3px;">(' + targetGoal + (s.href.indexOf("hata-defteri") >= 0 ? ' Adet)' : ' dk)') + '</small></span></span>' +
        '<a href="' + finalHref + '" data-step-href-key="' + stepCleanKey + '" data-href-raw="' + s.href + '" data-start-val="' + statusObj.startValue + '" class="dh-koc-action-btn dh-koc-btn ' + btnClass + '">' + btnText + '</a>' +
      '</div>';
    }
    return stepsHtml;
  }

  function paintCoach(plan) { return '<div class="dh-koc-mentor-box"><b class="dh-koc-mentor-title">🧠 Stratejik Karar Gerekçesi:</b><span class="dh-koc-mentor-text" style="display:block; margin-bottom:6px; font-weight:500;">"' + esc(plan.diagnosis) + '"</span><div style="font-size:12px; color:#f28b82; border-top:1px dashed rgba(255,255,255,0.08); padding-top:6px;"><b>Analiz:</b> ' + esc(plan.decision_reason) + ' | ⚠️ <b>Risk Skoru:</b> %' + esc(plan.learning_risk_score) + '</div></div>'; }

  async function paint(plan, profData){
    try {
      const wrapper = document.getElementById("dhKocContainer");
      if (!wrapper || !plan) return;
      const evening = new Date().getHours() >= 18;
      
      const speechBubbleHtml = await paintSpeechBubble(plan); // Dinamik konuşma balonu tetiklendi
      const stepsHtml = await paintSteps(plan);
      
      wrapper.innerHTML = '<div class="dh-koc-card">' + 
        paintHeader(plan, evening) + 
        speechBubbleHtml + 
        '<div>' + stepsHtml + '</div>' + 
        paintCoach(plan) + 
      '</div>';

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
      const profData = scrapeProfileFromDOM();
      
      // 🚀 HAFIZA KİLİDİ: Geçmiş günlerin kararlarını toplayıp LLM profiline enjekte ediyoruz
      const historyLogs = await getRecentHistorySummary();
      profData.recentMentorHistory = historyLogs;

      if (cachedPlanObj && cachedPlanObj.planData) {
        const plan = valid(cachedPlanObj.planData);
        if (plan) { paint(plan, profData); return; }
      }

      // Emniyet planı yapısı kararlı
      const fallbackPlan = {
        focus: "Hata Odaklı Bilişsel Dengeleme",
        estimated_time: 40, success_rate: 85, learning_risk_score: 25,
        diagnosis: "330 adet aralıklı tekrar kalemi birikmiş durumda. Bugün önceliği zayıf zemin temizliğine atadım.",
        decision_reason: "Ağ katmanı kilitlenmesi veya ilk kurulum emniyet müfredatı devreye girdi.",
        steps: [
          { label: "Bilişsel Hata Temizliği", href: "hata-defteri.html", time: 15 },
          { label: "Interleaved Hafıza Eritme", href: "tekrar.html?plan=1", time: 25 }
        ]
      };

      if (!(window.DHProviders && DHProviders.chat && DHProviders.hasAnyKey && DHProviders.hasAnyKey())) {
        paint(fallbackPlan, profData); return; 
      }

      // 🚀 HAFIZA DESTEKLİ SİSTEM TALİMATI
      const sys = `Sen DilHaritası ekosisteminde nöro-pedagoji ilkelerini kararlılıkla uygulayan bir AI MENTOR ve EĞİTİM DİREKTÖRÜSÜN.
Görevin, öğrencinin ekrandaki durumuna ek olarak 'recentMentorHistory' altındaki geçmiş günlerde ne kararlar verdiğini ve öğrencinin bu planlara ne kadar uyduğunu incelemektir.
Eğer öğrenci son 2 gündür önerilen bir adımı es geçiyorsa, bugün o adımı KESİNLİKLE EN BAŞA koy ve 'diagnosis' kısmında uyar. Sadece saf, tek bir JSON döndür.`;

      let chatPromise = DHProviders.chat([{role:"system", content:sys}, {role:"user", content:JSON.stringify(profData)}], {temperature: 0.1, max_tokens: 850});
      let out = await withTimeout(chatPromise, 2500, null);

      if (!out) { paint(fallbackPlan, profData); return; }

      const planObj = extractFirstJSONObject(String(out));
      const plan = valid(planObj) || fallbackPlan;

      await dbPut("plans", { date: DAY, planData: plan });
      // İlk kez plan oluşturulduğunda history deposuna da başlangıç logu at
      await dbPut("history", { date: DAY, focus: plan.focus, completedSteps: 0, totalSteps: plan.steps.length });
      
      paint(plan, profData);
    } catch(_) {
      try { paint({ focus: "Emniyet Planı", estimated_time: 30, success_rate: 90, steps: [{label: "Aralıklı Tekrar", href: "tekrar.html?plan=1", time: 15}] }, scrapeProfileFromDOM()); } catch(__) {}
    }
  }

  if (document.readyState !== "loading") setTimeout(run, 400); else document.addEventListener("DOMContentLoaded", function() { setTimeout(run, 400); });
})();