/* koc.js — HİPER-KİŞİSELLEŞTİRİLMİŞ AI ÖĞRENME KOÇU (MENTOR V2)
   Güncelleme Notları:
   - KRİTİK HATA DÜZELTİLDİ: esc() fonksiyonu URL'leri bozuyordu, şimdi sadece metinlerde kullanılıyor.
   - Profil önbelleği düzeltildi.
   - Tüm özellikler çalışır durumda.
*/
(function(){
  "use strict";

  // ----- Sabitler ve Yapılandırma -----
  const DAY = new Date().toISOString().slice(0,10);
  const KEY = "dh-koc-plan-" + DAY;
  const TS_KEY = "dh-koc-plan-ts-" + DAY;   
  const PROFILE_CACHE_KEY = "dh-koc-profile-cache";
  const PROFILE_CACHE_TTL = 5 * 60 * 1000;   // 5 dakika
  const PLAN_REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 saat
  const DB_NAME = "sentence-mode";           
  const ALLOWED = ["tekrar.html?plan=1", "index-app.html", "chat.html", "practice.html", "kelime-ogren.html", "hata-defteri.html"];

  // ----- Yardımcı Fonksiyonlar -----
  // SADECE metin içeriği için HTML kaçış (URL'ler için KULLANMA!)
  function esc(s){
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, function(c) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return map[c];
    });
  }

  // Adım durumları
  function getStepStatus(index) {
    return localStorage.getItem("dh-koc-step-" + DAY + "-" + index) === "true";
  }
  function setStepStatus(index) {
    localStorage.setItem("dh-koc-step-" + DAY + "-" + index, "true");
  }

  // Akşam modu (yerel saat)
  function isEvening() {
    return new Date().getHours() >= 18;
  }

  // ----- Profil Toplama (Önbellekli) -----
  async function profile(){
    // Önbellek kontrolü
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < PROFILE_CACHE_TTL) {
          return data; // data zaten JSON string
        }
      } catch(_) {}
    }

    let p = {};

    // Çalışma serisi ve süreklilik analizi
    try {
      const tr = JSON.parse(localStorage.getItem("dh-study-tracker-v1") || "{}") || {};
      let d = new Date(), streak = 0;
      while (true) {
        if ((tr.days || {})[d.toISOString().slice(0,10)]) {
          streak++;
          d.setDate(d.getDate() - 1);
        } else break;
      }
      p.streak = streak;
      p.last7DaysActive = Object.keys(tr.days || {}).filter(k =>
        (Date.now() - new Date(k).getTime()) <= 7 * 24 * 60 * 60 * 1000
      ).length;
    } catch(_) {}

    // Öğrenilen hacim
    try {
      const m = JSON.parse(localStorage.getItem("dh-progress-mirror-v1") || "{}") || {};
      let sentences = 0, words = 0;
      for (let k in m) {
        if (m[k] && m[k][0] === 1) {
          if (k.indexOf("sentence:") === 0) sentences++;
          else if (k.indexOf("word:") === 0) words++;
        }
      }
      p.learnedSentences = sentences;
      p.learnedWords = words;
    } catch(_) {}

    // Zayıf konu, modül, telaffuz
    try {
      p.weakestTopic = localStorage.getItem("dh-weak-topic") || "missing-word";
      p.weakestModule = localStorage.getItem("dh-weak-module") || "A2-M20 Doctor";
      p.pronunciationScore = parseFloat(localStorage.getItem("dh-avg-pronunciation") || "75");
    } catch(_) {}

    // SRS ve inatçı ögeler (IndexedDB)
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
                db.close();
                p.dueSRS = due;
                p.leechItems = leech;
                resolve();
              }
            };
            cursor.onerror = function() { db.close(); resolve(); };
          } catch(e) {
            try { db.close(); } catch(_) {}
            resolve();
          }
        };
        req.onerror = function() { resolve(); };
      } catch(e) {
        resolve();
      }
    });

    const profileString = JSON.stringify(p);
    
    // Önbelleğe kaydet
    try {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
        data: profileString,
        timestamp: Date.now()
      }));
    } catch(_) {}

    return profileString;
  }

  // ----- Planı HTML'e Dönüştür -----
  function paint(plan){
    try {
      const wrapper = document.getElementById("dhKocContainer");
      if (!wrapper || !plan || !plan.steps || !plan.steps.length) return;

      const totalSteps = plan.steps.length;
      let completedCount = 0;

      const stepsHtml = plan.steps.map((s, i) => {
        const isDone = getStepStatus(i);
        if (isDone) completedCount++;

        // timer parametresi ekle (URL güvenliği için esc KULLANMA)
        const stepTime = parseInt(s.time, 10) || 10;
        const finalHref = "./" + s.href + (s.href.indexOf("?") >= 0 ? "&" : "?") + "timer=" + stepTime;

        const bg = isDone ? 'rgba(40,167,69,0.15)' : 'rgba(255,255,255,0.05)';
        const border = isDone ? 'rgba(40,167,69,0.3)' : 'transparent';
        const labelStyle = isDone ? 'text-decoration: line-through; opacity: 0.6;' : '';

        return `<div style="margin: 8px 0; padding: 12px; background: ${bg}; border: 1px solid ${border}; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; transition: all 0.3s;">
          <span style="display:flex; align-items:center; gap:8px; ${labelStyle}">
            <span>${isDone ? '✅' : '<b>' + (i+1) + '.</b>'}</span>
            <span>${esc(s.label)} <small style="color:#aaa; margin-left:5px;">(${esc(String(stepTime))} dk)</small></span>
          </span>
          ${isDone
            ? '<span style="color:#28a745; font-size:13px; font-weight:bold; padding:4px 10px;">Tamamlandı</span>'
            : `<a href="${finalHref}" data-step-idx="${i}" class="dh-koc-action-btn" style="background:#007bff; color:#fff; padding:6px 12px; border-radius:6px; text-decoration:none; font-size:13px; font-weight:bold; box-shadow: 0 2px 4px rgba(0,123,255,0.2);" aria-label="Adım ${i+1}: ${esc(s.label)}'e başla">Başla →</a>`
          }
        </div>`;
      }).join("");

      // Akşam modu ve tamamlama durumu
      const evening = isEvening();
      const isAllDone = (completedCount === totalSteps);
      const bgHeader = evening ? (isAllDone ? '#14321a' : '#2b1c1c') : '#1e1e24';
      const borderHeader = evening ? (isAllDone ? 'rgba(40,167,69,0.4)' : 'rgba(220,53,69,0.4)') : 'rgba(255,255,255,0.15)';

      let customComment = plan.coach_comment || "";
      if (evening) {
        if (isAllDone) {
          customComment = "Muhteşem bir gün kapanışı! Bugün verdiğim planın tamamını eksiksiz bitirdin. Harika gidiyorsun, şimdi dinlenme zamanı! 🌟";
        } else {
          customComment = "Gün bitmek üzere ama günlük planın henüz tamamlanmamış! Öğrenme çizgini korumak ve kalıcılığı sağlamak için yatmadan önce eksik adımları hızlıca tamamlayalım. Hadi!";
        }
      }

      wrapper.innerHTML = `
        <div style="border: 1px solid ${borderHeader}; padding: 18px; border-radius: 12px; background: ${bgHeader}; color: #fff; font-family: sans-serif; transition: background 0.5s;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; margin-bottom:14px;">
            <span style="font-size:16px; font-weight:bold;">🧭 ${evening ? '🌙 Akşam Raporu & Kapanış' : '🎯 Günün Odağı: ' + esc(plan.focus)}</span>
            <span style="font-size:12px; background:#28a745; padding:3px 8px; border-radius:12px; font-weight:bold;">Başarı İhtimali: %${esc(plan.success_rate || "90")}</span>
          </div>
          <div>${stepsHtml}</div>
          <div style="margin-top:12px; font-size:13px; color:#ccc; display:flex; justify-content:space-between;">
            <span>⏱️ <b>Toplam Tahmini Süre:</b> ${esc(plan.estimated_time || "30")} dakika</span>
            <span>📊 İlerleme: ${completedCount}/${totalSteps}</span>
          </div>
          <hr style="border:0; border-top:1px dashed rgba(255,255,255,0.1); margin:14px 0;">
          <div style="background: rgba(0,123,255,0.08); padding: 12px; border-radius: 8px; border-left: 4px solid #007bff;">
            <b style="color:#007bff; display:block; margin-bottom:4px; font-size:13px;">🎓 Koçun Stratejik Notu:</b>
            <span style="font-style:italic; font-size:13.5px; line-height:1.45; color:#eee;">"${esc(customComment)}"</span>
          </div>
        </div>
      `;

      // Butonlara tıklama olayı bağla
      const btns = wrapper.querySelectorAll(".dh-koc-action-btn");
      for (let btn of btns) {
        btn.addEventListener("click", function(e) {
          const idx = this.getAttribute("data-step-idx");
          if (idx !== null) setStepStatus(parseInt(idx, 10));
        });
      }

    } catch(e) {
      // Sessiz hata
    }
  }

  // ----- Plan Doğrulama -----
  function valid(p){
    if (!p || typeof p !== "object" || !Array.isArray(p.steps)) return null;
    p.steps = p.steps.filter(s => {
      if (!s || !s.label) return false;
      const href = String(s.href || "");
      if (!ALLOWED.includes(href)) return false;
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

  // ----- Ana İşleyici (run) -----
  async function run(){
    try {
      // Önce önbellekteki planı kontrol et
      const cachedPlan = localStorage.getItem(KEY);
      const cachedTs = localStorage.getItem(TS_KEY);
      let needRefresh = false;

      if (cachedPlan && cachedTs) {
        const ts = parseInt(cachedTs, 10);
        if (Date.now() - ts > PLAN_REFRESH_INTERVAL) {
          needRefresh = true;
        } else {
          const plan = valid(JSON.parse(cachedPlan));
          if (plan) {
            paint(plan);
            return;
          } else {
            needRefresh = true;
          }
        }
      } else {
        needRefresh = true;
      }

      if (needRefresh) {
        if (!(window.DHProviders && DHProviders.chat && DHProviders.hasAnyKey && DHProviders.hasAnyKey())) {
          return;
        }

        const prof = await profile();

        const sys = `Sen DilHaritası uygulamasındaki Türk öğrencilerin profesyonel, bilge ve stratejik İngilizce eğitim koçusun.
Öğrencinin JSON formatındaki detaylı profilini (streak, zayıf konular, srs durumları, telaffuz skoru vb.) analiz ederek BUGÜN için mikro taktiksel bir plan sunacaksın.

STRATEJİK YÖNERGELER (esnek uygula):
- Öğrencinin 'weakestTopic' ve 'weakestModule' değerlerini dikkate al, stratejik notunda bu eksiklere değin.
- 'pronunciationScore' 75'in altındaysa, chat.html veya practice.html modüllerinden birini eklemeyi düşün ve telaffuz gelişimi için öneride bulun.
- 'dueSRS' 50'den fazlaysa, tekrar.html?plan=1 modülünü planın başlarına koy ve süreyi en az 15 dk ver. Bu durumda kelime-ogren.html'den kaçınabilirsin.
- Rutinleri çeşitlendir, her gün farklı kombinasyonlar oluştur.

ÇIKTI MODELİ (SADECE saf JSON, asla markdown bloğu olmasın):
{
  "focus": "Günün ana odağı",
  "estimated_time": "45",
  "success_rate": "88",
  "coach_comment": "Öğrenciye özel bilgece yorum.",
  "steps": [
    {"label": "Sesli İletişim Pratiği", "href": "chat.html", "time": 15},
    {"label": "Zayıf Konu Tekrarı", "href": "tekrar.html?plan=1", "time": 10}
  ]
}
İzin verilen href'ler: ${ALLOWED.join(", ")}`;

        const out = await DHProviders.chat([{role:"system", content:sys}, {role:"user", content:prof}], {temperature: 0.3, max_tokens: 600});

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
          paint(plan);
        }
      }
    } catch(_) {}
  }

  // ----- Başlatma -----
  if (document.readyState !== "loading") {
    setTimeout(run, 1200);
  } else {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(run, 1200);
    });
  }
})();