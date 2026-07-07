/* koc.js — ÜST DÜZEY AI MENTOR & EĞİTİM DİREKTÖRÜ (V4)
   Özellikler: AI Hafıza Katmanı · Modüler Paint Mimarisi · Robust JSON Extractor · 
               CEFR Projeksiyonu · Haftalık/Aylık Analitik Dashboard · Temiz Class Tabanlı CSS */
(function(){
  "use strict";

  const DAY = new Date().toISOString().slice(0,10);
  const KEY = "dh-koc-plan-" + DAY;
  const TS_KEY = "dh-koc-plan-ts-" + DAY;   
  const HISTORY_KEY = "dh-koc-plan-history"; // Geçmiş planları tutan AI hafızası
  const PROFILE_CACHE_KEY = "dh-koc-profile-cache";
  const PROFILE_CACHE_TTL = 5 * 60 * 1000;   
  const PLAN_REFRESH_INTERVAL = 6 * 60 * 60 * 1000; 
  const DB_NAME = "sentence-mode";           
  const ALLOWED = ["tekrar.html?plan=1", "index-app.html", "chat.html", "practice.html", "kelime-ogren.html", "hata-defteri.html"];

  // ----- 1. DİNAMİK CSS ENJEKSİYONU (Clean Code) -----
  const style = document.createElement('style');
  style.textContent = `
    .dh-koc-card { border: 1px solid rgba(255,255,255,0.15); padding: 18px; border-radius: 12px; background: #1e1e24; color: #fff; font-family: sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
    .dh-koc-card.evening-all-done { background: #14321a; border-color: rgba(40,167,69,0.4); }
    .dh-koc-card.evening-pending { background: #2b1c1c; border-color: rgba(220,53,69,0.4); }
    .dh-koc-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 14px; }
    .dh-koc-focus { font-size: 15px; font-weight: bold; }
    .dh-koc-badge { font-size: 12px; background: #28a745; padding: 3px 8px; border-radius: 12px; font-weight: bold; }
    .dh-koc-step { margin: 6px 0; padding: 10px; background: rgba(255,255,255,0.04); border: 1px solid transparent; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; transition: all 0.3s; }
    .dh-koc-step.done { background: rgba(40,167,69,0.12); border-color: rgba(40,167,69,0.25); }
    .dh-koc-step-label { display: flex; align-items: center; gap: 8px; }
    .dh-koc-step-label.strike { text-decoration: line-through; opacity: 0.5; }
    .dh-koc-btn { background: #007bff; color: #fff; padding: 5px 10px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: bold; cursor: pointer; }
    .dh-koc-mentor-box { background: rgba(220,53,69,0.06); padding: 12px; border-radius: 8px; border-left: 4px solid #dc3545; margin-bottom: 14px; }
    .dh-koc-mentor-title { color: #dc3545; display: block; margin-bottom: 4px; font-size: 13px; font-weight: bold; }
    .dh-koc-mentor-text { font-style: italic; font-size: 13px; line-height: 1.45; color: #eee; }
    .dh-koc-dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
    .dh-koc-dash-sect { background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
    .dh-koc-dash-title { font-size: 11px; color: #aaa; margin-bottom: 6px; display: flex; justify-content: space-between; }
    .dh-koc-footer-stats { margin-top: 10px; font-size: 12px; color: #ccc; display: flex; justify-content: space-between; opacity: 0.8; }
  `;
  document.head.appendChild(style);

  // ----- 2. ROBUST JSON EXTRACTOR (Güvenli Parser) -----
  function extractFirstJSONObject(str) {
    if (!str) return null;
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    const candidate = str.slice(start, end + 1).trim()
                         .replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Gizli karakter temizliği
    try {
      return JSON.parse(candidate);
    } catch (e) {
      return null;
    }
  }

  function esc(s){
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[c]));
  }

  function getStepStatus(index) { return localStorage.getItem("dh-koc-step-" + DAY + "-" + index) === "true"; }
  function setStepStatus(index) { localStorage.setItem("dh-koc-step-" + DAY + "-" + index, "true"); }
  function isEvening() { return new Date().getHours() >= 18; }

  // Saf SVG Çizgi Grafiği Üretici
  function generateSVGChart(dataArray, color) {
    if (!dataArray || dataArray.length === 0) return '';
    const max = Math.max(...dataArray, 1);
    const width = 280, height = 35, padding = 2;
    const stepX = width / (dataArray.length - 1 || 1);
    let points = [];
    for (let i = 0; i < dataArray.length; i++) {
      let x = i * stepX;
      let y = height - ((dataArray[i] / max) * (height - padding * 2)) - padding;
      points.push(`${x},${y}`);
    }
    return `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible;"><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points.join(' ')}" /></svg>`;
  }

  // ----- 3. AI HAFIZALI DETAYLI PROFİL TOPLAMA -----
  async function profile(){
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < PROFILE_CACHE_TTL) return data;
      } catch(_) {}
    }

    let p = {
      currentStatus: {},
      history30DaysSummary: { totalMinutes: 0, totalErrors: 0, activeDaysCount: 0 },
      trends: { durations: [], errors: [] },
      aiMentorMemory: [] // Son planların hafıza katmanı
    };

    // AI Hafızasını Yükle (Son 3 plan odağı ve başarısı)
    try {
      const memory = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      p.aiMentorMemory = memory.slice(-3);
    } catch(_) {}

    // Kullanıcı anlık metrikleri
    try {
      p.currentStatus.weakestTopic = localStorage.getItem("dh-weak-topic") || "missing-word";
      p.currentStatus.weakestModule = localStorage.getItem("dh-weak-module") || "A2-M20 Doctor";
      p.currentStatus.pronunciationScore = parseFloat(localStorage.getItem("dh-avg-pronunciation") || "75");
      p.currentStatus.similarityScore = parseFloat(localStorage.getItem("dh-avg-similarity") || "82");
    } catch(_) {}

    // 30 Günlük Zaman Serisi
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

    // Toplam hacim
    try {
      const m = JSON.parse(localStorage.getItem("dh-progress-mirror-v1") || "{}") || {};
      let sentences = 0, words = 0;
      for (let k in m) { if (m[k] && m[k][0] === 1) { if (k.indexOf("sentence:") === 0) sentences++; else if (k.indexOf("word:") === 0) words++; } }
      p.currentStatus.learnedSentences = sentences; p.currentStatus.learnedWords = words;
    } catch(_) {}

    // IndexedDB okuma (SRS)
    await new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
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

    const profileString = JSON.stringify(p);
    try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ data: profileString, timestamp: Date.now() })); } catch(_) {}
    return profileString;
  }

  // ----- 4. MODÜLER PAINT (EKRAN ÇİZİM) MİMARİSİ -----
  function paintHeader(plan, evening) {
    return `<div class="dh-koc-header">
      <span class="dh-koc-focus">🧭 ${evening ? '🌙 Akşam Analitik Raporu' : '🎯 Mentor Teşhisi: ' + esc(plan.focus)}</span>
      <span class="dh-koc-badge">Başarı İhtimali: %${esc(plan.success_rate || "90")}</span>
    </div>`;
  }

  function paintSteps(plan) {
    return plan.steps.map((s, i) => {
      const isDone = getStepStatus(i);
      const stepTime = parseInt(s.time, 10) || 10;
      const finalHref = "./" + s.href + (s.href.indexOf("?") >= 0 ? "&" : "?") + "timer=" + stepTime;

      return `<div class="dh-koc-step ${isDone ? 'done' : ''}">
        <span class="dh-koc-step-label ${isDone ? 'strike' : ''}">
          <span>${isDone ? '✅' : '<b>' + (i+1) + '.</b>'}</span>
          <span>${esc(s.label)} <small style="color:#aaa; margin-left:3px;">(${esc(String(stepTime))} dk)</small></span>
        </span>
        ${isDone ? '<span style="color:#28a745; font-size:12px; font-weight:bold;">Bitti</span>' : `<a href="${finalHref}" data-step-idx="${i}" class="dh-koc-action-btn dh-koc-btn">Başla →</a>`}
      </div>`;
    }).join("");
  }

  function paintCoach(plan, evening, completedCount, totalSteps) {
    let comment = plan.coach_comment || "";
    if (evening) {
      comment = (completedCount === totalSteps) 
        ? "Muhteşem direktör planı zaferi! Bugün verdiğim pedagojik hedeflerin hepsini imha ettin. Şimdi zihnini kapat ve dinlen, harikasın. 🌟" 
        : "Gün kapanıyor ama dümendeki planın yarım kalmış. Öğrenme eğrini korumak için uyumadan önce eksik adımları hızlıca tamamla.";
    }
    return `<div class="dh-koc-mentor-box">
      <b class="dh-koc-mentor-title">🎓 Mentor Teşhis ve Pedagojik Yorum:</b>
      <span class="dh-koc-mentor-text">"${esc(comment)}"</span>
    </div>`;
  }

  function paintCharts(profData) {
    const durationChart = generateSVGChart(profData.trends.durations, '#007bff');
    const errorChart = generateSVGChart(profData.trends.errors, '#dc3545');
    return `<div class="dh-koc-dashboard">
      <div class="dh-koc-dash-sect">
        <div class="dh-koc-dash-title"><span>📈 30 Günlük Yoğunluk</span><b style="color:#007bff">${profData.history30DaysSummary.totalMinutes} dk</b></div>
        ${durationChart}
      </div>
      <div class="dh-koc-dash-sect">
        <div class="dh-koc-dash-title"><span>📉 Hata Patlaması</span><b style="color:#dc3545">${profData.history30DaysSummary.totalErrors} Hata</b></div>
        ${errorChart}
      </div>
    </div>`;
  }

  function paintFooter(plan, completedCount, totalSteps) {
    const report = plan.weekly_report || {};
    const forecast = plan.forecast || {};
    return `
      <div class="dh-koc-dashboard" style="margin-top:12px; border-top:1px dashed rgba(255,255,255,0.1); padding-top:10px;">
        <div class="dh-koc-dash-sect">
          <div style="font-size:11px; font-weight:bold; color:#ffc107; margin-bottom:4px;">📊 Haftalık Gelişim Özeti</div>
          <div style="font-size:12px; line-height:1.4; color:#ddd;">
            ✓ Cümle: ${esc(String(report.sentences || "-"))} | Kelime: ${esc(String(report.words || "-"))}<br>
            ✓ Başarı Oranı: %${esc(String(report.success_rate || "-"))}<br>
            🚀 En Çok Gelişen: <span style="color:#28a745">${esc(report.top_improved || "Analiz ediliyor")}</span>
          </div>
        </div>
        <div class="dh-koc-dash-sect">
          <div style="font-size:11px; font-weight:bold; color:#17a2b8; margin-bottom:4px;">🔮 Gelecek Projeksiyonu</div>
          <div style="font-size:12px; line-height:1.4; color:#ddd;">
            🎯 Hedef Seviye: <span style="color:#17a2b8; font-weight:bold;">${esc(forecast.target_cefr || "B2")}</span><br>
            ⏱️ Kalan Tahmini Süre: <span style="font-weight:bold;">${esc(String(forecast.days_remaining || "-"))} Gün</span><br>
            ⚠️ Risk Durumu: <span style="color:${forecast.risk_status === 'Yüksek' ? '#dc3545' : '#28a745'}">${esc(forecast.risk_status || "Düşük")}</span>
          </div>
        </div>
      </div>
      <div class="dh-koc-footer-stats">
        <span>⏱️ Toplam Öngörülen Süre: ${esc(plan.estimated_time || "30")} dakika</span>
        <span>📊 Plan İlerlemesi: ${completedCount}/${totalSteps}</span>
      </div>
    `;
  }

  function paint(plan, profileRaw){
    try {
      const wrapper = document.getElementById("dhKocContainer");
      if (!wrapper || !plan || !plan.steps || !plan.steps.length) return;

      let profData = { trends: { durations: [], errors: [] }, history30DaysSummary:{totalMinutes:0, totalErrors:0} };
      try { profData = JSON.parse(profileRaw); } catch(_) {}

      const totalSteps = plan.steps.length;
      let completedCount = 0;
      for (let i = 0; i < totalSteps; i++) { if (getStepStatus(i)) completedCount++; }

      const evening = isEvening();
      const isAllDone = (completedCount === totalSteps);

      // Ana kart sınıflarını tayin et
      let cardClass = "dh-koc-card";
      if (evening) cardClass += isAllDone ? " evening-all-done" : " evening-pending";

      // Modüler birleştirme
      wrapper.innerHTML = `
        <div class="${cardClass}">
          ${paintHeader(plan, evening)}
          <div>${paintSteps(plan)}</div>
          ${paintCoach(plan, evening, completedCount, totalSteps)}
          ${paintCharts(profData)}
          ${paintFooter(plan, completedCount, totalSteps)}
        </div>
      `;

      // Event listenerları bağla
      const btns = wrapper.querySelectorAll(".dh-koc-action-btn");
      for (let btn of btns) {
        btn.addEventListener("click", function() {
          const idx = this.getAttribute("data-step-idx");
          if (idx !== null) setStepStatus(parseInt(idx, 10));
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
    return p;
  }

  // ----- 5. AI REFORM TALİMATLARI (AI ÖĞRETİYOR VE PROJEKSİYON YAPIYOR) -----
  async function run(){
    try {
      const cachedPlan = localStorage.getItem(KEY);
      const cachedTs = localStorage.getItem(TS_KEY);
      const cachedProfile = localStorage.getItem(PROFILE_CACHE_KEY);
      let needRefresh = false;

      if (cachedPlan && cachedTs && cachedProfile) {
        if (Date.now() - parseInt(cachedTs, 10) > PLAN_REFRESH_INTERVAL) needRefresh = true;
        else { const plan = valid(extractFirstJSONObject(cachedPlan)); if (plan) { paint(plan, JSON.parse(cachedProfile).data); return; } else needRefresh = true; }
      } else needRefresh = true;

      if (needRefresh) {
        if (!(window.DHProviders && DHProviders.chat && DHProviders.hasAnyKey && DHProviders.hasAnyKey())) return;

        const prof = await profile();

        const sys = `Sen DilHaritası uygulamasında sadece basit görev listesi üreten bir yazılım değilsin. Sen öğrencinin geçmiş 30 günlük trendlerini ve 'aiMentorMemory' altındaki GEÇMİŞ YÖNLENDİRME KARARLARINI okuyarak onu eğiten, teşhis koyan, kural koyan bilge bir AI MENTORSUN.

PEDAGOJİK VE ÖNGÖRÜSEL ANALİZ KURALLARI:
1. Sadece Planlama Yapma, ÖĞRET VE TEŞHİS KOY: 'trends' verilerini analiz et. Süre artarken hata artıyorsa coach_comment alanında şunu de: "Son 30 günde çalışma süren arttı ama hata sayın da fırladı. Demek ki çok hızlı gidiyorsun, bugün seni yavaşlatıyorum." 
2. Hafıza Katmanını Kullan: 'aiMentorMemory' dizisine bak. Eğer geçen günlerde öğrenciye bir zayıf yön odaklı hedef verdiysen, bugünkü sonuçları kıyasla: "Geçen hafta sana Article çalışmanı emretmiştim, bugün verilerine baktım ve belirgin düzelme görüyorum. Harika!" de.
3. Haftalık Rapor ve CEFR Tahmini: Öğrencinin mevcut hızını ('learnedSentences', 'learnedWords', 'streak' ve son 30 günlük aktif dakikasını) ekstrapole ederek, hedeflediği bir sonraki CEFR seviyesine (Örn: B2 veya C1) kaç günde ulaşabileceğini matematiksel olarak tahmin et.

ÇIKTI MODELİ (SADECE saf, tek bir JSON objesi döndür, markdown bloğu ekleme):
{
  "focus": "Günün mentorluk odağı (Örn: Hızlı Çalışma Sendromu Teşhisi ve Yavaşlama)",
  "estimated_time": "45",
  "success_rate": "88",
  "coach_comment": "Öğrenme psikolojisini yöneten, geçmiş kararları hatırlayan ve doğrudan öğrenme eğrisine teşhis koyan bilge koç metni (En fazla 4 cümle).",
  "steps": [
    {"label": "Yavaş ve Odaklı Tekrar", "href": "tekrar.html?plan=1", "time": 20}
  ],
  "weekly_report": {
    "sentences": 432,
    "words": 231,
    "success_rate": 89,
    "top_improved": "Past Perfect"
  },
  "forecast": {
    "target_cefr": "B2",
    "days_remaining": 104,
    "risk_status": "Düşük"
  }
}`;

        const out = await DHProviders.chat([{role:"system", content:sys}, {role:"user", content:prof}], {temperature: 0.2, max_tokens: 800});

        let plan = null;
        const planObj = extractFirstJSONObject(String(out));
        plan = valid(planObj);

        if (plan) {
          localStorage.setItem(KEY, JSON.stringify(plan));
          localStorage.setItem(TS_KEY, String(Date.now()));
          
          // AI Hafızasına bu başarılı kararı kaydet
          try {
            let memory = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
            memory.push({ date: DAY, focus: plan.focus });
            if (memory.length > 5) memory.shift();
            localStorage.setItem(HISTORY_KEY, JSON.stringify(memory));
          } catch(_) {}

          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.indexOf("dh-koc-plan-") === 0 && k !== KEY) localStorage.removeItem(k);
            if (k && k.indexOf("dh-koc-step-") === 0 && k.indexOf(DAY) === -1) localStorage.removeItem(k);
          }
          paint(plan, prof);
        }
      }
    } catch(_) {}
  }

  if (document.readyState !== "loading") setTimeout(run, 1200);
  else document.addEventListener("DOMContentLoaded", function() { setTimeout(run, 1200); });
})();