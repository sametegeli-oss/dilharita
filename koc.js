/* ============================================================================
   koc.js — DİL HARİTASI ADAPTİF KOÇ V6
   ---------------------------------------------------------------------------
   Amaç:
   - AI yalnızca önerir; öğrenme kararlarının omurgası deterministiktir.
   - Due sayısı yerine porsiyonlanmış tekrar önerilir.
   - Öğrenme riski hesaplanır: gecikme + lapse + düşük tekrar + unutma yaşı.
   - Günlük yük otomatik olarak MINIMUM / NORMAL / İLERİ moda ayarlanır.
   - 10 etkileşim = öğrenme kabul edilmez; gerçek aktivite + kalite kapısı kullanılır.
   - Hata türü yalnızca sayılmaz; trend ve olası kök neden profili çıkarılır.
   - Haftalık hedefler trend bazlıdır.
   - AI planı bozulursa deterministik plan sessizce devreye girer.
   - Mevcut Dil Haritası anahtarları korunur.
   ============================================================================ */
(function () {
  "use strict";

  var DAY = new Date().toISOString().slice(0, 10);
  var KEY = "dh-koc-plan-" + DAY;
  var GOAL_KEY = "dh-koc-goal";
  var MODEL_KEY = "dh-coach-learning-model-v2";
  var ALLOWED = [
    "tekrar.html?plan=1",
    "index-app.html",
    "chat.html",
    "practice.html?auto=due",
    "kelime-ogren.html",
    "hata-defteri.html"
  ];

  var LIMITS = {
    MINIMUM: { review: 5, sentences: 2, conversation: 1 },
    NORMAL:  { review: 10, sentences: 5, conversation: 3 },
    ADVANCED:{ review: 15, sentences: 10, conversation: 5 }
  };

  function now() { return Date.now(); }
  function safeJSON(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function readLS(key, fallback) {
    try { return safeJSON(localStorage.getItem(key), fallback); } catch (_) { return fallback; }
  }
  function writeLS(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) {
      return { "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c];
    });
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function dateKey(d) {
    return (d || new Date()).toISOString().slice(0, 10);
  }

  function tracker() {
    return readLS("dh-study-tracker-v1", {}) || {};
  }

  function todayRecord() {
    var t = tracker();
    return (t.days || {})[DAY] || {};
  }

  function todayWork() {
    var r = todayRecord();
    return {
      sentences: Number(r.sentences || 0),
      reviews: Number(r.reviews || 0),
      lessons: Number(r.lessons || 0),
      videos: Number(r.videos || 0),
      total: Number(r.sentences || 0) + Number(r.reviews || 0) +
             Number(r.lessons || 0) + Number(r.videos || 0)
    };
  }

  function activityTrend30() {
    var tr = tracker(), days = tr.days || {};
    var active = 0, lessons = 0, sentences = 0, reviews = 0;
    var first15 = 0, last15 = 0, daily = [];

    for (var i = 0; i < 30; i++) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var rec = days[dateKey(d)] || null;
      var activeDay = !!rec && (
        Number(rec.lessons || 0) +
        Number(rec.sentences || 0) +
        Number(rec.reviews || 0) +
        Number(rec.videos || 0)
      ) > 0;

      if (activeDay) {
        active++;
        if (i < 15) last15++; else first15++;
      }

      lessons += Number(rec && rec.lessons || 0);
      sentences += Number(rec && rec.sentences || 0);
      reviews += Number(rec && rec.reviews || 0);
      daily.push({ date: dateKey(d), active: activeDay ? 1 : 0 });
    }

    return {
      active: active,
      lessons: lessons,
      sentences: sentences,
      reviews: reviews,
      first15: first15,
      last15: last15,
      trend: last15 > first15 ? "artıyor" : (last15 < first15 ? "azalıyor" : "sabit"),
      daily: daily
    };
  }

  function errorTrend30() {
    var rows = [];
    var recent = {}, older = {};
    var cutoff = now() - 15 * 86400000;

    return Promise.resolve().then(async function () {
      try {
        if (!window.LearningErrorDB || !LearningErrorDB.all) return { text: "", rows: [] };
        var errs = await LearningErrorDB.all() || [];

        errs.forEach(function (r) {
          var ts = Number(r.createdAt || r.timestamp || r.time || 0);
          var types = Array.isArray(r.types) && r.types.length
            ? r.types
            : (r.type ? [r.type] : []);

          types.forEach(function (type) {
            type = String(type || "other");
            if (ts && ts >= cutoff) recent[type] = (recent[type] || 0) + 1;
            else if (ts) older[type] = (older[type] || 0) + 1;
          });
        });

        var all = {};
        Object.keys(recent).forEach(function (k) { all[k] = 1; });
        Object.keys(older).forEach(function (k) { all[k] = 1; });

        Object.keys(all).forEach(function (type) {
          var o = older[type] || 0, r = recent[type] || 0;
          rows.push({
            type: type,
            older: o,
            recent: r,
            delta: r - o,
            worsening: r > o && r >= 2,
            improving: o > 0 && r <= Math.ceil(o * 0.5)
          });
        });

        rows.sort(function (a, b) {
          return (b.recent + Math.max(0, b.delta)) - (a.recent + Math.max(0, a.delta));
        });

        var lines = rows.slice(0, 4).map(function (r) {
          if (r.worsening) return r.type + ": artıyor (" + r.older + "→" + r.recent + ")";
          if (r.improving) return r.type + ": azalıyor (" + r.older + "→" + r.recent + ")";
          return r.type + ": " + r.recent;
        });

        return {
          text: lines.length
            ? "Son 30 günde hata eğilimleri: " + lines.join("; ") + "."
            : "",
          rows: rows
        };
      } catch (_) {
        return { text: "", rows: [] };
      }
    });
  }

  function rootCause(type) {
    var s = String(type || "").toLowerCase();
    if (/tense|past|present|future|time|zaman/.test(s))
      return "zaman seçimi ve zaman sinyallerini otomatikleştirme";
    if (/article|a_an|the|artik/.test(s))
      return "belirleyici ve isim öbeği kalıbı";
    if (/preposition|prep|edat/.test(s))
      return "fiil–edat ve kalıp eşleşmesi";
    if (/word_order|syntax|sentence|söz dizimi/.test(s))
      return "İngilizce cümle iskeleti";
    if (/plural|count|uncount|çoğul/.test(s))
      return "isim türü ve miktar ifadesi";
    if (/verb|irregular|fiil/.test(s))
      return "fiil biçimi ve çekim otomatikliği";
    if (/pronunciation|sound|telaffuz/.test(s))
      return "ses–kelime eşleşmesi ve üretim";
    if (/vocab|word|kelime/.test(s))
      return "kelimeyi bağlam içinde geri çağırma";
    return "bu yapıyı farklı cümlelerde üretme";
  }

  function loadModel() {
    return readLS(MODEL_KEY, {
      updatedAt: 0,
      errorPatterns: {},
      recentSessions: [],
      masterySignals: {}
    });
  }

  function saveModel(model) {
    model.updatedAt = now();
    writeLS(MODEL_KEY, model);
  }

  function updateLearningModel(errorRows, stats) {
    var model = loadModel();
    model.errorPatterns = model.errorPatterns || {};

    (errorRows || []).forEach(function (r) {
      model.errorPatterns[r.type] = {
        recent: r.recent,
        older: r.older,
        delta: r.delta,
        rootCause: rootCause(r.type),
        updatedAt: now()
      };
    });

    model.recentSessions = (model.recentSessions || []).slice(-29);
    model.recentSessions.push({
      date: DAY,
      work: todayWork(),
      stats: stats
    });

    saveModel(model);
    window.__dhCoachModel = model;
    return model;
  }

  function kvReadPrefix(prefix) {
    return new Promise(function (resolve) {
      try {
        var req = indexedDB.open("sentence-mode", 1);
        req.onsuccess = function () {
          var db = req.result, out = {};
          try {
            var cur = db.transaction("kv", "readonly")
              .objectStore("kv").openCursor();

            cur.onsuccess = function (e) {
              var c = e.target.result;
              if (c) {
                var k = String(c.key);
                if (k.indexOf(prefix) === 0) out[k.slice(prefix.length)] = c.value;
                c.continue();
              } else {
                db.close();
                resolve(out);
              }
            };
            cur.onerror = function () {
              db.close();
              resolve(out);
            };
          } catch (_) {
            try { db.close(); } catch (__) {}
            resolve(out);
          }
        };
        req.onerror = function () { resolve({}); };
      } catch (_) { resolve({}); }
    });
  }

  function riskScore(srs) {
    var v = srs || {};
    var t = now();
    var due = Number(v.due || 0);
    var lapses = Number(v.lapses || 0);
    var reps = Number(v.rep || v.reps || 0);
    var last = Number(v.last || v.lastReview || v.updatedAt || 0);

    var overdueDays = due > 0 && due < t ? (t - due) / 86400000 : 0;
    var ageDays = last > 0 ? (t - last) / 86400000 : 0;

    return Math.round(clamp(
      overdueDays * 8 +
      lapses * 12 +
      Math.max(0, 4 - reps) * 5 +
      Math.min(30, ageDays) * 1.5,
      0, 100
    ));
  }

  async function collectSRS() {
    var srs = await kvReadPrefix("srs:");
    var due = 0, leech = 0, risk = [];

    Object.keys(srs).forEach(function (id) {
      var v = srs[id] || {};
      var score = riskScore(v);
      var dueNow = Number(v.due || 0) <= now();

      if (dueNow) due++;
      if (Number(v.lapses || 0) >= 3) leech++;
      if (score >= 35) risk.push({ id: id, score: score, srs: v });
    });

    risk.sort(function (a, b) { return b.score - a.score; });

    return {
      all: srs,
      due: due,
      leech: leech,
      risk: risk.slice(0, 20),
      highRisk: risk.filter(function (x) { return x.score >= 60; }).length
    };
  }

  async function liveStats() {
    var s1 = 0, s2 = 0, w1 = 0, w2 = 0;
    var mirror = readLS("dh-progress-mirror-v1", {}) || {};

    Object.keys(mirror).forEach(function (k) {
      var v = mirror[k];
      if (!v) return;
      var st = v[0];
      if (k.indexOf("sentence:") === 0) {
        if (st === 1) s1++;
        else if (st === 2) s2++;
      } else if (k.indexOf("word:") === 0) {
        if (st === 1) w1++;
        else if (st === 2) w2++;
      }
    });

    var srs = await collectSRS();

    return {
      due: srs.due,
      leech: srs.leech,
      highRisk: srs.highRisk,
      risk: srs.risk,
      s1: s1,
      s2: s2,
      w1: w1,
      w2: w2
    };
  }

  function chooseDailyMode(activity) {
    var recent = activity.last15;
    var activeRate = recent / 15;
    var today = todayWork().total;

    if (today >= 25 || activeRate < 0.27) return "MINIMUM";
    if (activeRate >= 0.73 && today >= 5) return "ADVANCED";
    return "NORMAL";
  }

  function getDailyTargets(activity) {
    var mode = chooseDailyMode(activity);
    return { mode: mode, targets: LIMITS[mode] };
  }

  async function pickNextModule() {
    try {
      var mirror = readLS("dh-progress-mirror-v1", {}) || {};
      var srs = await kvReadPrefix("srs:");
      var visited = readLS("dh-mod-visited-v1", {}) || {};
      var all = await (await fetch("./data/sentences.json")).json();
      var order = [], seen = {}, byMod = {};

      (all || []).forEach(function (s) {
        if (!s.module) return;
        if (!seen[s.module]) {
          seen[s.module] = 1;
          order.push(s.module);
          byMod[s.module] = [];
        }
        byMod[s.module].push(s);
      });

      function touched(s) {
        return !!(mirror["sentence:" + s.id] || srs[s.id]);
      }

      function finished(s) {
        var m = mirror["sentence:" + s.id];
        var r = srs[s.id];
        return !!(m && m[0] === 2) || !!(r && Number(r.rep || 0) >= 2);
      }

      var untouched = null, rested = null, incomplete = null;
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      var yKey = dateKey(yesterday);

      order.some(function (mod) {
        var list = byMod[mod] || [];
        var hasUntouched = list.some(function (s) { return !touched(s); });
        var hasIncomplete = list.some(function (s) { return !finished(s); });
        var lastVisit = visited[mod] && visited[mod].last;

        if (hasUntouched && !untouched) untouched = mod;
        if (hasIncomplete && (!lastVisit || lastVisit !== yKey) && !rested) rested = mod;
        if (hasIncomplete && !incomplete) incomplete = mod;

        return !!untouched;
      });

      return untouched || rested || incomplete || order[0] || null;
    } catch (_) {
      return null;
    }
  }

  function planSpine(nextModule, stats, targets, today) {
    var spine = [];

    if (stats.due > 0 || stats.highRisk > 0) {
      spine.push({
        label: stats.highRisk > 0
          ? "En yüksek riskli tekrarları çalış"
          : "Vadesi gelen kelime ve cümleleri tekrarla",
        href: "tekrar.html?plan=1",
        kind: "review",
        target: targets.review
      });
    }

    if (today.sentences < targets.sentences) {
      spine.push({
        label: nextModule
          ? "Yeni cümleler: " + nextModule.replace(/^[A-C]\d-M\d+\s*/, "")
          : "Yeni cümleler öğren",
        href: nextModule
          ? "index-app.html?mod=" + encodeURIComponent(nextModule)
          : "index-app.html",
        kind: "new-sentences",
        target: targets.sentences
      });
    }

    spine.push({
      label: "Kısa bir konuşma yap",
      href: "chat.html",
      kind: "conversation",
      target: targets.conversation
    });

    return spine;
  }

  function deterministicPlan(nextModule, stats, activity, errorRows) {
    var mode = getDailyTargets(activity);
    var today = todayWork();
    var spine = planSpine(nextModule, stats, mode.targets, today);
    var worsening = (errorRows || []).filter(function (r) { return r.worsening; })[0];
    var focus = worsening
      ? "Bugün " + rootCause(worsening.type) + " üzerinde özellikle üretim yap."
      : stats.highRisk > 0
        ? "Bugün unutulma riski yüksek öğeleri geri çağır."
        : "Bugün tekrar, yeni cümle ve üretim döngüsünü tamamla.";

    var why = worsening
      ? worsening.type + " hatası son dönemde artıyor."
      : stats.highRisk > 0
        ? "Bazı öğelerin unutulma riski yükseldi."
        : activity.trend === "azalıyor"
          ? "Son 15 gündeki ritim zayıfladı; sürdürülebilir bir günlük yük seçildi."
          : "Mevcut çalışma ritmine uygun bir öğrenme döngüsü seçildi.";

    return {
      focus: focus,
      note: mode.mode === "MINIMUM"
        ? "Bugün minimum planı tamamla; ritmi korumak yeterli."
        : mode.mode === "ADVANCED"
          ? "Ritmin güçlü; bugün daha derin üretim yap."
          : "Önce tekrarları yap, sonra yeni cümle ve konuşmaya geç.",
      why: why,
      mode: mode.mode,
      targets: mode.targets,
      steps: spine,
      generatedBy: "deterministic-v6",
      madeAt: {
        count: today.total,
        due: stats.due,
        ts: now()
      }
    };
  }

  function parseAIPlan(raw) {
    try {
      var text = String(raw || "")
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      var start = text.indexOf("{");
      var end = text.lastIndexOf("}");
      if (start >= 0 && end > start) text = text.slice(start, end + 1);

      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  function validPlan(plan) {
    if (!plan || typeof plan !== "object") return null;

    var out = {
      focus: String(plan.focus || "").slice(0, 180),
      note: String(plan.note || "").slice(0, 180),
      why: String(plan.why || "").slice(0, 240),
      steps: []
    };

    var allowed = {};
    ALLOWED.forEach(function (x) { allowed[x] = 1; });

    (Array.isArray(plan.steps) ? plan.steps : []).forEach(function (s) {
      if (!s || !allowed[String(s.href || "")]) return;
      out.steps.push({
        label: String(s.label || "Önerilen çalışma").replace(/\b\d+\b/g, "").replace(/\s{2,}/g, " ").trim(),
        href: String(s.href),
        kind: s.kind || "ai",
        target: Number(s.target || 0)
      });
    });

    return out.steps.length ? out : null;
  }

  function errorGoal(errorRows) {
    var goal = readLS(GOAL_KEY, null);
    var current = now();
    var result = null;

    if (goal && current - Number(goal.setAt || 0) >= 7 * 86400000) {
      var row = (errorRows || []).find(function (r) { return r.type === goal.type; });
      var count = row ? row.recent : 0;
      result = {
        type: goal.type,
        achieved: count <= goal.targetCount,
        before: goal.baseline,
        now: count
      };
      goal = null;
    }

    if (!goal) {
      var candidate = (errorRows || []).slice().sort(function (a, b) {
        return (b.recent + Math.max(0, b.delta)) -
               (a.recent + Math.max(0, a.delta));
      })[0];

      if (candidate && candidate.recent >= 2) {
        goal = {
          type: candidate.type,
          rootCause: rootCause(candidate.type),
          baseline: candidate.recent,
          targetCount: Math.max(0, Math.ceil(candidate.recent * 0.5)),
          setAt: current
        };
        writeLS(GOAL_KEY, goal);
      }
    }

    return { goal: goal, result: result };
  }

  function completionState() {
    var done = readLS("dh-koc-steps-done-" + DAY, {}) || {};
    var today = todayWork();
    return { done: done, today: today };
  }

  function paint(plan, stats, activity, errorRows) {
    try {
      var box = document.getElementById("dhKocContainer");
      var sub = document.getElementById("dhDaySub");
      if (!box) return;

      var state = completionState();
      var targets = plan.targets || LIMITS[plan.mode || "NORMAL"];
      var mode = plan.mode || "NORMAL";

      var learned = (stats.s2 || 0) + (stats.w2 || 0);
      var studying = (stats.s1 || 0) + (stats.w1 || 0);
      var maxV = Math.max(learned, studying, stats.due || 0, stats.highRisk || 0, 1);

      function bar(label, value) {
        var pct = Math.round((value / maxV) * 100);
        return '<div style="margin:6px 0">' +
          '<div style="display:flex;justify-content:space-between;font-size:12px">' +
          '<span>' + esc(label) + '</span><strong>' + value + '</strong></div>' +
          '<div style="height:7px;background:rgba(127,127,127,.18);border-radius:99px;overflow:hidden">' +
          '<i style="display:block;width:' + clamp(pct, 3, 100) +
          '%;height:100%;background:currentColor;border-radius:99px"></i></div></div>';
      }

      var stepsHtml = (plan.steps || []).map(function (s, i) {
        var page = String(s.href || "").split("?")[0];
        var done = !!state.done[page];

        if (s.kind === "review" && state.today.reviews >= targets.review) done = true;
        if (s.kind === "new-sentences" && state.today.sentences >= targets.sentences) done = true;
        if (s.kind === "conversation" && state.today.lessons >= targets.conversation) done = true;

        return '<div style="display:flex;gap:8px;align-items:center;margin:8px 0">' +
          '<b>' + (done ? "✓" : (i + 1)) + '</b>' +
          '<span>' + esc(s.label) + '</span>' +
          (s.target ? '<small style="opacity:.65"> · hedef ' + s.target + '</small>' : '') +
          '</div>';
      }).join("");

      var worst = (errorRows || []).filter(function (r) { return r.worsening; })[0];
      var goal = window.__dhGoal || {};
      var goalHtml = "";

      if (goal.result) {
        goalHtml += '<div style="margin-top:10px;padding:8px;border-radius:10px;background:rgba(127,127,127,.12)">' +
          (goal.result.achieved ? "✅ Haftalık hedef başarıldı: " : "⏳ Haftalık hedef henüz tamamlanmadı: ") +
          esc(goal.result.type) + " (" + goal.result.before + " → " + goal.result.now + ")" +
          '</div>';
      }

      if (goal.goal) {
        goalHtml += '<div style="margin-top:8px;font-size:13px">🎯 Bu haftanın odağı: <b>' +
          esc(goal.goal.rootCause || goal.goal.type) +
          '</b> — hedef hata sayısı: ' + goal.goal.targetCount + '</div>';
      }

      var rootHtml = worst
        ? '<div style="margin-top:8px;font-size:13px">⚠️ Kök neden adayı: <b>' +
          esc(rootCause(worst.type)) + '</b></div>'
        : "";

      var week = "";
      try {
        var days = (tracker().days || {});
        var cells = [];
        for (var i = 6; i >= 0; i--) {
          var d = new Date();
          d.setDate(d.getDate() - i);
          var rec = days[dateKey(d)] || {};
          var v = Number(rec.lessons || 0) +
                  Number(rec.sentences || 0) / 5 +
                  Number(rec.reviews || 0) / 3;
          cells.push('<span title="' + dateKey(d) + '" style="' +
            'display:inline-block;width:14px;height:' + clamp(Math.round(v * 4), 6, 32) +
            'px;margin:0 3px;border-radius:4px 4px 0 0;background:currentColor"></span>');
        }
        week = '<div style="margin-top:12px;font-size:11px;opacity:.75">SON 7 GÜN</div>' +
          '<div style="height:38px;display:flex;align-items:end">' + cells.join("") + '</div>';
      } catch (_) {}

      if (sub) {
        sub.textContent = mode + " GÜN · " +
          (stats.highRisk > 0 ? stats.highRisk + " yüksek riskli öğe" :
           stats.due > 0 ? "tekrar önceliği var" : "plan hazır");
      }

      box.dataset.dhFilled = "1";
      box.innerHTML =
        '<div style="font-weight:800;font-size:18px">AI Mentor — Bugünün Planı</div>' +
        '<div style="margin-top:8px;font-weight:700">' + esc(plan.focus) + '</div>' +
        '<div style="margin-top:6px;opacity:.8">' + esc(plan.note) + '</div>' +
        '<div style="margin-top:8px;font-size:13px;opacity:.75">Neden: ' + esc(plan.why) + '</div>' +
        '<div style="margin-top:12px;padding:10px;border-radius:12px;background:rgba(127,127,127,.10)">' +
          '<b>Gün modu: ' + esc(mode) + '</b>' +
          '<div style="font-size:12px;opacity:.75;margin-top:4px">' +
          'Tekrar ' + targets.review + ' · Cümle ' + targets.sentences +
          ' · Konuşma ' + targets.conversation + '</div>' +
        '</div>' +
        '<div style="margin-top:12px">' + stepsHtml + '</div>' +
        rootHtml + goalHtml + week +
        '<div style="margin-top:12px">' +
          bar("Öğrenilmiş", learned) +
          bar("Çalışılıyor", studying) +
          bar("Yüksek risk", stats.highRisk || 0) +
          bar("Tekrar bekleyen", stats.due || 0) +
        '</div>' +
        '<div style="margin-top:10px;font-size:12px;opacity:.7">' +
          '30 gün: ' + activity.active + ' aktif gün · eğilim: ' + activity.trend +
        '</div>' +
        '<div style="margin-top:14px"><a href="rapor.html">Detaylı 30 günlük rapor →</a></div>' +
        '<div style="margin-top:14px"><button id="dhResetToday" type="button">⏭️ Sonraki günü başlat</button></div>';

      var reset = document.getElementById("dhResetToday");
      if (reset) reset.onclick = function () {
        try {
          localStorage.removeItem(KEY);
          localStorage.removeItem("dh-koc-steps-done-" + DAY);
          localStorage.removeItem("dh-day-closed-" + DAY);
          localStorage.removeItem("dh-coach-last-generic-tip");
        } catch (_) {}
        location.reload();
      };
    } catch (_) {}
  }

  async function buildPlan() {
    var activity = activityTrend30();
    var stats = await liveStats();
    var err = await errorTrend30();
    var mode = getDailyTargets(activity);
    var nextModule = await pickNextModule();

    updateLearningModel(err.rows, stats);

    window.__dhLevelSuggest =
      activity.active >= 20 &&
      err.rows.filter(function (r) { return r.improving; }).length >= 2 &&
      !err.rows.some(function (r) { return r.worsening; });

    window.__dhLevelReason = window.__dhLevelSuggest
      ? "Son 30 günde düzenli çalıştın ve birden fazla hata alanında belirgin iyileşme gösterdin."
      : "";

    window.__dhGoal = errorGoal(err.rows);

    var fallback = deterministicPlan(nextModule, stats, activity, err.rows);

    if (window.DHProviders &&
        DHProviders.chat &&
        DHProviders.hasAnyKey &&
        DHProviders.hasAnyKey()) {

      var profile = [
        "Aktif gün: " + activity.active + "/30.",
        "Son 15 gün: " + activity.last15 + ", önceki 15 gün: " + activity.first15 + ".",
        "Aktivite eğilimi: " + activity.trend + ".",
        "Gün modu: " + mode.mode + ".",
        "Tekrar bekleyen: " + stats.due + ".",
        "Yüksek unutulma riski: " + stats.highRisk + ".",
        "İnatçı öğe: " + stats.leech + ".",
        "Hata analizi: " + (err.text || "belirgin veri yok") + "."
      ].join(" ");

      var sys =
        "Türk öğrenci için kısa ve somut günlük İngilizce koçusun. " +
        "AI yalnızca önerir. SADECE JSON döndür. " +
        "Hata defteri boşsa hata-defteri.html ekleme. " +
        "Tekrar yoksa tekrar.html ekleme. " +
        "Sayıları etiketlere gömme. " +
        "focus, note ve why Türkçe olsun. " +
        "steps 1-2 ek öneri içersin. " +
        "href yalnızca şu değerlerden biri olabilir: " + ALLOWED.join(", ") + ". " +
        'JSON: {"focus":"","note":"","why":"","steps":[{"label":"","href":""}]}';

      try {
        var out = await DHProviders.chat([
          { role: "system", content: sys },
          { role: "user", content: profile }
        ], { temperature: 0.3, max_tokens: 350 });

        var ai = validPlan(parseAIPlan(out));
        if (ai) {
          ai.mode = fallback.mode;
          ai.targets = fallback.targets;
          ai.madeAt = fallback.madeAt;
          ai.steps = fallback.steps.concat(
            ai.steps.filter(function (x) {
              return !fallback.steps.some(function (y) { return y.href === x.href; });
            }).slice(0, 1)
          );
          fallback = ai;
        }
      } catch (_) {}
    }

    writeLS(KEY, fallback);
    return { plan: fallback, stats: stats, activity: activity, errors: err.rows };
  }

  async function run() {
    try {
      var result = await buildPlan();
      paint(result.plan, result.stats, result.activity, result.errors);
    } catch (_) {}
  }

  window.DHCoachV6 = {
    run: run,
    activityTrend30: activityTrend30,
    errorTrend30: errorTrend30,
    liveStats: liveStats,
    collectSRS: collectSRS,
    riskScore: riskScore,
    rootCause: rootCause,
    chooseDailyMode: chooseDailyMode,
    pickNextModule: pickNextModule,
    getLearningModel: loadModel
  };

  if (document.readyState !== "loading") {
    setTimeout(run, 1200);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(run, 1200);
    });
  }
})();
