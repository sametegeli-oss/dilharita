/* koc.js — STRATEJİK AI EĞİTİM DİREKTÖRÜ (MENTOR V3 + 30 GÜNLÜK SVG GRAFİK)
   Özellikler: 30 Günlük Geçmiş Analizi · Gömülü SVG Trend Grafikleri · Aktif Karar ve Yönetim Mekanizması
   Kurallar: AI mutlak otoritedir · Plan günlük önbellektedir · Hatalarda sessiz düşüş yapar. */
(function(){
  "use strict";

  const DAY = new Date().toISOString().slice(0,10);
  const KEY = "dh-koc-plan-" + DAY;
  const TS_KEY = "dh-koc-plan-ts-" + DAY;   
  const PROFILE_CACHE_KEY = "dh-koc-profile-cache";
  const PROFILE_CACHE_TTL = 5 * 60 * 1000;   
  const PLAN_REFRESH_INTERVAL = 6 * 60 * 60 * 1000; 
  const DB_NAME = "sentence-mode";           
  const ALLOWED = ["tekrar.html?plan=1", "index-app.html", "chat.html", "practice.html", "kelime-ogren.html", "hata-defteri.html"];

  // ----- Yardımcı Fonksiyonlar -----
  function esc(s){
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, function(c) {
      const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;'};
      return map[c];
    });
  }

  function getStepStatus(index) {
    return localStorage.getItem("dh-koc-step-" + DAY + "-" + index) === "true";
  }
  function setStepStatus(index) {
    localStorage.setItem("dh-koc-step-" + DAY + "-" + index, "true");
  }
  function isEvening() {
    return new Date().getHours() >= 18;
  }

  // Saf SVG Çizgi Grafiği Üretici (Kütüphanesiz Hafif Çözüm)
  function generateSVGChart(dataArray, color) {
    if (!dataArray || dataArray.length === 0) return '';
    const max = Math.max(...dataArray, 1);
    const width = 280;
    const height = 40;
    const padding = 2;
    const stepX = width / (dataArray.length - 1 || 1);
    
    let points = [];
    for (let i = 0; i < dataArray.length; i++) {
      let x = i * stepX;
      let y = height - ((dataArray[i] / max) * (height - padding * 2)) - padding;
      points.push(`${x},${y}`);
    }
    
    return `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible;">
      <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points.join(' ')}" />
    </svg>`;
  }

  // ----- 1. 30 GÜNLÜK DETAYLI PROFİL VE TREND TOPLAMA -----
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
      trends: { durations: [], errors: [] }
    };

    // Mevcut Zayıf Yönler
    try {
      p.currentStatus.weakestTopic = localStorage.getItem("dh-weak-topic") || "missing-word";
      p.currentStatus.weakestModule = localStorage.getItem("dh-weak-module") || "A2-M20 Doctor";
      p.currentStatus.pronunciationScore = parseFloat(localStorage.getItem("dh-avg-pronunciation") || "75");
    } catch(_) {}

    // 30 Günlük Zaman Serisi Analizi
    try {
      const tr = JSON.parse(localStorage.getItem("dh-study-tracker-v1") || "{}") || {};
      let d = new Date();
      let streak = 0;
      while (true) {
        if ((tr.days || {})[d.toISOString().slice(0,10)]) { streak++; d.setDate(d.getDate() - 1); } else break;
      }
      p.currentStatus.streak = streak;

      // Son 30 günü geriye doğru tara
      for (let i = 29; i >= 0; i--) {
        let checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - i);
        let dateStr = checkDate.toISOString().slice(0,10);
        let dayData = (tr.days || {})[dateStr] || null;

        if (dayData) {
          let mins = dayData.duration || 0;
          let errs = dayData.errors || 0;
          
          p.trends.durations.push(mins);
          p.trends.errors.push(errs);
          
          p.history30DaysSummary.totalMinutes += mins;
          p.history30DaysSummary.totalErrors += errs;
          p.history30DaysSummary.activeDaysCount++;
        } else {
          p.trends.durations.push(0);
          p.trends.errors.push(0);
        }
      }
    } catch(_) {}

    // Öğrenilen toplam kayıt hacmi
    try {
      const m = JSON.parse(localStorage.getItem("dh-progress-mirror-v1") || "{}") || {};
      let sentences = 0, words = 0;
      for (let k in m) {
        if (m[k] && m[k][0] === 1) {
          if (k.indexOf("sentence:") === 0) sentences++;
          else if (k.indexOf("word:") === 0) words++;
        }
      }
      p.currentStatus.learnedSentences = sentences;
      p.currentStatus.learnedWords = words;
    } catch(_) {}

    // SRS Veritabanı (IndexedDB)
    await new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onsuccess = function() {
          const db = req.result;
          let due = 0, leech = 0, now = Date.now();
          try {
            const tx = db.transaction("kv", "readonly");
            tx.onerror = function() { db.close(); resolve(); };
            const store = tx.objectStore("kv");
            const cursor = store.openCursor();
            cursor.onsuccess = function(e) {
              const cur = e.target.result;
              if (cur) {
                const key = String(cur.key);
                const val = cur.value || {};
                if (key.indexOf("srs:") === 0) {
                  if ((val.due || 0) <= now) due++;
                  if ((val.lapses || 0) >= 3) leech++;
                }
                cur.continue();
              } else {
                db.close(); p.currentStatus.dueSRS = due; p.currentStatus.leechItems = leech; resolve();
              }
            };
            cursor.onerror = function() { db.close(); resolve(); };
          } catch(e) { try { db.close(); } catch(_) {} resolve(); }
        };
        req.onerror = function() { resolve(); };
      } catch(e) { resolve(); }
    });

    const profileString = JSON.stringify(p);
    try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ data: profileString, timestamp: Date.now() })); } catch(_) {}
    return profileString;
  }

  // ----- 2. PANEL ÇİZİMİ VE GÖMÜLÜ GRAPH ENJEKSİYONU -----
  function paint(plan, profileRaw){
    try {
      const wrapper = document.getElementById("dhKocContainer");
      if (!wrapper || !plan || !plan.steps || !plan.steps.length) return;

      let profData = { trends: { durations: [], errors: [] } };
      try { profData = JSON.parse(profileRaw); } catch(_) {}

      const totalSteps = plan.steps.length;
      let completedCount = 0;

      const stepsHtml = plan.steps.map((s, i) => {
        const isDone = getStepStatus(i);
        if (isDone) completedCount++;

        const stepTime = parseInt(s.time, 10) || 10;
        const finalHref = "./" + s.href + (s.href.indexOf("?") >= 0 ? "&" : "?") + "timer=" + stepTime;

        return `<div style="margin: 6px 0; padding: 10px; background: ${isDone ? 'rgba(40,167,69,0.12)' : 'rgba(255,255,255,0.04)'}; border: 1px solid ${isDone ? 'rgba(40,167,69,0.25)' : 'transparent'}; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-size:14px;">
          <span style="display:flex; align-items:center; gap:8px; ${isDone ? 'text-decoration: line-through; opacity: 0.5;' : ''}">
            <span>${isDone ? '✅' : '<b>' + (i+1) + '.</b>'}</span>
            <span>${esc(s.label)} <small style="color:#aaa; margin-left:3px;">(${esc(String(stepTime))} dk)</small></span>
          </span>
          ${isDone ? '<span style="color:#28a745; font-size:12px; font-weight:bold;">Bitti</span>' : `<a href="${finalHref}" data-step-idx="${i}" class="dh-koc-action-btn" style="background:#007bff; color:#fff; padding:5px 10px; border-radius:6px; text-decoration:none; font-size:12px; font-weight:bold;">Başla →</a>`}
        </div>`;
      }).join("");

      const evening = isEvening();
      const isAllDone = (completedCount === totalSteps);
      const bgHeader = evening ? (isAllDone ? '#14321a' : '#2b1c1c') : '#1e1e24';
      const borderHeader = evening ? (isAllDone ? 'rgba(40,167,69,0.4)' : 'rgba(220,53,69,0.4)') : 'rgba(255,255,255,0.15)';

      let customComment = plan.coach_comment || "";
      if (evening) {
        customComment = isAllDone ? "Harika iş çıkardın! Bugün verdiğim tüm yönetimsel hedefleri başarıyla tamamladın. Zihnini dinlendir, yarın yeni kararlarla dümendeyim! 🌟" : "Gün kapanıyor ama yönetim planında eksikler var. Çizgini ve kararlılığını korumak için yatmadan önce adımları temizle.";
      }

      // SVG Mini Grafikleri Çiz
      const durationChart = generateSVGChart(profData.trends.durations, '#007bff');
      const errorChart = generateSVGChart(profData.trends.errors, '#dc3545');

      wrapper.innerHTML = `
        <div style="border: 1px solid ${borderHeader}; padding: 18px; border-radius: 12px; background: ${bgHeader}; color: #fff; font-family: sans-serif;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; margin-bottom:14px;">
            <span style="font-size:15px; font-weight:bold;">🧭 ${evening ? '🌙 Akşam Durum Raporu' : '🎯 Yönetim Kararı: ' + esc(plan.focus)}</span>
            <span style="font-size:12px; background:#28a745; padding:3px 8px; border-radius:12px; font-weight:bold;">Başarı İhtimali: %${esc(plan.success_rate || "90")}</span>
          </div>
          
          <div>${stepsHtml}</div>
          
          <div style="margin-top:10px; font-size:13px; color:#ccc; display:flex; justify-content:space-between;">
            <span>⏱️ <b>Hedeflenen Süre:</b> ${esc(plan.estimated_time || "30")} dakika</span>
            <span>📊 Tamamlanma: ${completedCount}/${totalSteps}</span>
          </div>
          
          <hr style="border:0; border-top:1px dashed rgba(255,255,255,0.1); margin:12px 0;">
          
          <div style="background: rgba(220,53,69,0.06); padding: 12px; border-radius: 8px; border-left: 4px solid #dc3545; margin-bottom:14px;">
            <b style="color:#dc3545; display:block; margin-bottom:4px; font-size:13px;">🎓 Yönetici Koçun Gerekçeli Kararı:</b>
            <span style="font-style:italic; font-size:13px; line-height:1.45; color:#eee;">"${esc(customComment)}"</span>
          </div>

          <!-- 30 Günlük Görsel Analiz Bölümü (Sparklines) -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
            <div>
              <div style="font-size:11px; color:#aaa; margin-bottom:4px; display:flex; justify-content:space-between;">
                <span>📈 30 Günlük Çalışma Trendi</span>
                <b style="color:#007bff">${profData.history30DaysSummary.totalMinutes} dk</b>
              </div>
              ${durationChart}
            </div>
            <div>
              <div style="font-size:11px; color:#aaa; margin-bottom:4px; display:flex; justify-content:space-between;">
                <span>📉 30 Günlük Hata Eğrisi</span>
                <b style="color:#dc3545">${profData.history30DaysSummary.totalErrors} Hata</b>
              </div>
              ${errorChart}
            </div>
          </div>
        </div>
      `;

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
      s.time = parseInt(s.time, 10);
      if (isNaN(s.time) || s.time < 1) s.time = 10;
      return true;
    }).slice(0, 5);

    if (!p.steps.length) return null;
    p.focus = String(p.focus || "").slice(0, 150);
    p.coach_comment = String(p.coach_comment || "").slice(0, 300);
    p.estimated_time = String(p.estimated_time || "").slice(0, 10);
    p.success_rate = String(p.success_rate || "").slice(0, 10);
    return p;
  }

  // ----- 3. AI ÇALIŞTIRMA VE COCH TALİMATLARI -----
  async function run(){
    try {
      const cachedPlan = localStorage.getItem(KEY);
      const cachedTs = localStorage.getItem(TS_KEY);
      const cachedProfile = localStorage.getItem(PROFILE_CACHE_KEY);
      let needRefresh = false;

      if (cachedPlan && cachedTs && cachedProfile) {
        if (Date.now() - parseInt(cachedTs, 10) > PLAN_REFRESH_INTERVAL) needRefresh = true;
        else { 
          const plan = valid(JSON.parse(cachedPlan)); 
          if (plan) { paint(plan, JSON.parse(cachedProfile).data); return; } else needRefresh = true; 
        }
      } else needRefresh = true;

      if (needRefresh) {
        if (!(window.DHProviders && DHProviders.chat && DHProviders.hasAnyKey && DHProviders.hasAnyKey())) return;

        const prof = await profile();

        const sys = `Sen DilHaritası uygulamasında sadece basit görevler veren bir bot değil, öğrencinin eğitim sürecini mikro ve makro düzeyde YÖNETEN, radikal kararlar alan üst düzey bir EĞİTİM DİREKTÖRÜSÜN.
Görevin, öğrencinin anlık durumunu ve 'trends' altındaki son 30 günlük çalışma süreleri ve hata eğrilerini analiz ederek stratejik kısıtlamalar uygulamaktır.

YÖNETİM PRENSİPLERİ VE KARAR YAPILARI:
1. Makro 30 Günlük İnceleme: 'trends.durations' dizisindeki son 30 günün grafik dalgalanmalarına bak. Eğer öğrenci son 5-6 gündür sürekliliğini kaybettiyse veya çok düşük dakikalar çalıştıysa, ağır modüller (chat.html veya practice.html) yerine kesinlikle kısa süreli kelime-ogren.html veya tekrar.html?plan=1 ver.
2. Hata Dalgalanmaları: 'trends.errors' dizisinde son günlerde hata patlaması yaşanıyorsa, öğrencinin yeni bilgiler öğrenmesini YASAKLA (kelime-ogren.html modülünü plana dahil etme). Önceliği hata-defteri.html modülüne ata.
3. Direktör Hitabı: 'coach_comment' alanında bir tavsiye verme, doğrudan 30 günlük trende atıfta bulunarak kararını gerekçelendir. (Örn: "Son 30 günlük grafiklerini incelediğimde son bir haftadır hata eğrin dik bir ivmeyle tırmanıyor. Bu sebeple bugün yeni kelime çalışmanı askıya aldım; sadece yaraları saracağız.")

ÇIKTI MODELİ (SADECE saf JSON, asla markdown bloğu olmasın):
{
  "focus": "Yönetimsel kural başlığı",
  "estimated_time": "40",
  "success_rate": "85",
  "coach_comment": "Öğrenci eğrilerine ve trendlerine doğrudan atıfta bulunan, mutlak yönetici yorumu.",
  "steps": [
    {"label": "Hata Eğrisi Temizliği", "href": "hata-defteri.html", "time": 15},
    {"label": "Kalıcı Hafıza Eritme", "href": "tekrar.html?plan=1", "time": 20}
  ]
}
İzin verilen tek href listesi: ${ALLOWED.join(", ")}`;

        const out = await DHProviders.chat([{role:"system", content:sys}, {role:"user", content:prof}], {temperature: 0.2, max_tokens: 600});

        let plan = null;
        try {
          const clean = String(out).replace(/```json|```/g,"").trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
          plan = valid(JSON.parse(clean));
        } catch(_) {}

        if (plan) {
          localStorage.setItem(KEY, JSON.stringify(plan));
          localStorage.setItem(TS_KEY, String(Date.now()));
          
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