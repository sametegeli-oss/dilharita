/* koc.js — YAPAY ZEKA HAFIZALI AI MENTOR V2 */
(function(){
  "use strict";
  var DAY = new Date().toISOString().slice(0,10), KEY = "dh-koc-plan-" + DAY;
  var ALLOWED = ["tekrar.html?plan=1","index-app.html","chat.html","practice.html?auto=due","kelime-ogren.html","hata-defteri.html"];

  // AI Koç Geçmiş Aktivite Kaydedici (Yeni Nesil Hafıza Katmanı)
  window.logKocActivity = function(activityType, focusTopic) {
    try {
      var history = JSON.parse(localStorage.getItem("dh-koc-history") || "[]");
      history.push({
        timestamp: Date.now(),
        date: DAY,
        type: activityType,
        focus: focusTopic
      });
      // Performans için son 45 aktiviteyi hafızada sakla
      if (history.length > 45) history.shift();
      localStorage.setItem("dh-koc-history", JSON.stringify(history));
    } catch(e) {}
  };

  async function profile(){
    var p = [];
    // 1. Çalışma Serisi Kontrolü
    try {
      var tr = JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}, d = new Date(), st = 0;
      for(;;){ if((tr.days||{})[d.toISOString().slice(0,10)]){st++;d.setDate(d.getDate()-1);} else break; }
      if(st) p.push("Seri:" + st + " gün.");
    } catch(e){}

    // 2. Cümle ve Kelime İlerleme İstatistikleri[cite: 1]
    try {
      var m = JSON.parse(localStorage.getItem("dh-progress-mirror-v1")||"{}")||{}, s1=0, w1=0, s2=0, w2=0;
      for(var k in m){ if(!m[k]) continue; var st0=m[k][0];
        if(k.indexOf("sentence:")===0){ if(st0===1)s1++; else if(st0===2)s2++; }
        else if(k.indexOf("word:")===0){ if(st0===1)w1++; else if(st0===2)w2++; }
      }
      p.push("Çalışılan cümle:" + s1 + ", kelime:" + w1 + ". Öğrenilmiş cümle:" + s2 + ", kelime:" + w2 + ".");
      __lastS1=s1; __lastW1=w1; __lastS2=s2; __lastW2=w2;
    } catch(e){}

    // 3. Hata Defterindeki Son Kritik Durumlar[cite: 1]
    var errCount = 0;
    try {
      if(window.LearningErrorDB && LearningErrorDB.all){
        var errs = await LearningErrorDB.all(), t = {};
        errCount = (errs||[]).length;
        (errs||[]).slice(-60).forEach(function(r){ if(r&&r.type) t[r.type] = (t[r.type]||0)+1; });
        var top = Object.keys(t).sort(function(a,b){return t[b]-t[a]}).slice(0,3);
        p.push(top.length ? ("Hata defteri: " + errCount + " kayıt var. Öğrencinin sık hata yaptığı yapılar: " + top.join(",") + ".") : "Hata defteri: BOŞ (0 kayıt) — hata defteri önerme.");
      }
    } catch(e){}
    window.__dhErrCount = errCount;

    // 4. SRS Sıralama Durumu ve İnatçı Öğeler[cite: 1]
    await new Promise(function(res){ try{
      var r = indexedDB.open("sentence-mode", 1);
      r.onsuccess = function(){ var db = r.result, due = 0, leech = 0, now = Date.now();
        try { var q = db.transaction("kv","readonly").objectStore("kv").openCursor();
          q.onsuccess = function(e){ var c = e.target.result;
            if(c){ var kk = String(c.key), v = c.value||{};
              if(kk.indexOf("srs:")===0){ if((v.due||0)<=now)due++; if((v.lapses||0)>=3)leech++; }
              c.continue();
            } else { db.close(); if(due)p.push("Tekrar bekleyen:" + due + " madde."); if(leech)p.push("İnatçı zorlanılan öğe:" + leech + "."); res(); } };
          q.onerror = function(){ db.close(); res(); };
        } catch(e2){ try{db.close()}catch(_){ } res(); } };
      r.onerror = function(){ res(); };
    } catch(e3){ res(); } });

    // 5. YAPAY ZEKA HAFIZASI KATMANI ENTEGRASYONU
    try {
      var history = JSON.parse(localStorage.getItem("dh-koc-history") || "[]");
      if(history.length) {
        var distribution = history.reduce(function(acc, curr){ acc[curr.type] = (acc[curr.type]||0)+1; return acc; }, {});
        p.push("Son 30 gündeki çalışma yönelim grafiği (sıklık sayısı): " + JSON.stringify(distribution));
      }
    } catch(e){}

    return p.join(" ");
  }

  function paint(plan){
    try {
      var box = document.getElementById("dhKocContainer");
      var sub = document.getElementById("dhDaySub");
      if(!plan || !plan.steps || !plan.steps.length){
        if(box && box.dataset.dhFilled!=="1"){
          box.innerHTML = '<div style="background:#111827;padding:16px;border-radius:14px;border:1px dashed rgba(255,255,255,.15);color:#93c5fd;font-size:13px;text-align:center">AI Mentor için API anahtarı ekleyince burada günün planı görünecek.</div>';
        }
        return;
      }
      if(sub) sub.textContent = (plan.dueCount||0) + " tekrar bekleyen";
      if(box){
        box.dataset.dhFilled = "1";
        var stepsHtml = plan.steps.map(function(s, i){
          return `<a href="./${s.href}" onclick="logKocActivity('${s.href.split('?')[0]}', '${plan.focus}')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#0d1526;border:1px solid #1e3a5f;border-radius:11px;text-decoration:none;color:#e8eef7;margin-top:8px">`
            +`<span style="background:#2563eb;color:#fff;font:800 12px system-ui;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:0 0 auto">${i+1}</span>`
            +`<span style="font-size:13.5px;font-weight:700">${esc(s.label)}</span></a>`;
        }).join("");
        
        var st = plan.stats||{}, learned = (st.s2||0)+(st.w2||0), studying = (st.s1||0)+(st.w1||0), due = st.due||0;
        var maxV = Math.max(learned, studying, due, 1);
        function bar(label, val, color){
          var pct = Math.round(100*val/maxV);
          return `<div style="display:flex;align-items:center;gap:8px;margin-top:5px">`
            +`<span style="width:78px;font-size:11px;color:#9fb3d9;flex:0 0 auto">${label}</span>`
            +`<div style="flex:1;background:#0a1628;border-radius:6px;height:10px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color}"></div></div>`
            +`<span style="width:26px;text-align:right;font-size:11px;color:#e8eef7;flex:0 0 auto">${val}</span></div>`;
        }
        var chartHtml = '<div style="margin:10px 0 12px">' + bar("Öğrenilmiş", learned, "#4ade80") + bar("Çalışılıyor", studying, "#38bdf8") + bar("Tekrar bekleyen", due, "#f59e0b") + '</div>';
        
        box.innerHTML = `<div style="background:#111827;padding:18px;border-radius:14px;border:1px solid rgba(255,255,255,.1)">`
          +`<div style="color:#60a5fa;font:900 12px system-ui;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">🧭 AI Mentor — Bugünün Planı</div>`
          +`<div style="font:800 16px system-ui;margin-bottom:2px">${esc(plan.focus||"")}</div>`
          +(plan.note?(`<div style="color:#9fb3d9;font-size:12.5px;margin-bottom:2px">💬 ${esc(plan.note)}</div>`):'')
          +(plan.why?(`<div style="color:#facc15;font-size:11.5px;margin-bottom:4px;line-height:1.4;">🎯 <b>Gerekçe:</b> ${esc(plan.why)}</div>`):'')
          +chartHtml+stepsHtml+'</div>';
      }
    } catch(e){}
  }
  
  function esc(s){ return String(s||"").replace(/[<>&]/g,function(c){return {"<":"&lt;",">":"&gt;","&":"&amp;"}[c];}); }
  var __lastDue=0, __lastS1=0, __lastW1=0, __lastS2=0, __lastW2=0, __nextModule=null;

  async function pickNextModule(){
    try {
      var mirror = JSON.parse(localStorage.getItem("dh-progress-mirror-v1")||"{}")||{};
      var all = await (await fetch("./data/sentences.json")).json();
      var order = [], seen = {}, byMod = {};
      all.forEach(function(s){
        if(!s.module) return;
        if(!seen[s.module]){ seen[s.module]=1; order.push(s.module); byMod[s.module]=[]; }
        byMod[s.module].push(s);
      });
      for(var i=0;i<order.length;i++){
        var mod = order[i];
        var incomplete = byMod[mod].some(function(s){ var m = mirror["sentence:"+s.id]; return !(m && m[0]===2); });
        if(incomplete) return mod;
      }
      return order[0]||null;
    } catch(e){ return null; }
  }

  function valid(p){
    if(!p||typeof p!=="object"||!Array.isArray(p.steps)) return null;
    var due = (p.dueCount!=null ? p.dueCount : __lastDue);
    p.dueCount = due;
    var aiSteps = p.steps.filter(function(s){ return s&&s.label&&ALLOWED.indexOf(String(s.href||""))>=0; });
    if(!window.__dhErrCount){ aiSteps = aiSteps.filter(function(s){ return s.href!=="hata-defteri.html"; }); }

    var spine = [];
    if(due>0) spine.push({label:due+" öğeyi tekrarla", href:"tekrar.html?plan=1"});
    spine.push({label: __nextModule ? ("Yeni cümleler: "+__nextModule.replace(/^[A-C]\d-M\d+\s*/,"")) : "Yeni cümleler öğren", href: __nextModule ? ("index-app.html?mod="+encodeURIComponent(__nextModule)) : "index-app.html"});
    spine.push({label:"1 dakika konuş", href:"chat.html"});
    var hrefs = spine.map(function(s){return s.href;});
    var bonus = aiSteps.find(function(s){ return hrefs.indexOf(s.href)<0; });
    p.steps = bonus ? spine.concat([bonus]) : spine;

    if(!p.steps.length) return null;
    p.focus = String(p.focus||"").slice(0,120); p.note = String(p.note||"").slice(0,140);
    p.why = String(p.why||"").slice(0,250);
    return p;
  }

  async function liveStats(){
    var s1=0,s2=0,w1=0,w2=0,due=0;
    try {
      var m = JSON.parse(localStorage.getItem("dh-progress-mirror-v1")||"{}")||{};
      for(var k in m){ if(!m[k]) continue; var st0=m[k][0];
        if(k.indexOf("sentence:")===0){ if(st0===1)s1++; else if(st0===2)s2++; }
        else if(k.indexOf("word:")===0){ if(st0===1)w1++; else if(st0===2)w2++; }
      }
    } catch(e){}
    await new Promise(function(res){ try{
      var r = indexedDB.open("sentence-mode",1);
      r.onsuccess = function(){ var db = r.result, now = Date.now();
        try { var q = db.transaction("kv","readonly").objectStore("kv").openCursor();
          q.onsuccess = function(e){ var c = e.target.result;
            if(c){ var kk = String(c.key),v = c.value||{}; if(kk.indexOf("srs:")===0 && (v.due||0)<=now) due++; c.continue(); }
            else { db.close(); res(); } };
          q.onerror = function(){ db.close(); res(); };
        } catch(e2){ try{db.close()}catch(_){ } res(); } };
      r.onerror = function(){ res(); };
    } catch(e3){ res(); } });
    return {due:due, s1:s1, s2:s2, w1:w1, w2:w2};
  }

  async function run(){
    try {
      try{ window.__dhErrCount = window.LearningErrorDB&&LearningErrorDB.all ? (await LearningErrorDB.all()||[]).length : 0; }catch(e){ window.__dhErrCount=0; }
      __nextModule = await pickNextModule();
      var cached = localStorage.getItem(KEY);
      if(cached){ var cp = valid(JSON.parse(cached)); if(cp){ cp.stats = await liveStats(); paint(cp); } return; }
      if(!(window.DHProviders&&DHProviders.chat&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey())) return;
      var prof = await profile(); if(!prof) return;
      var sys = 'Türk öğrencinin analitik İngilizce koçusun. Mevcut profil verilerine ve 30 günlük çalışma sıklık hafızasına bakarak BUGÜN için net bir rota planla. '
        +'"why" parametresinde kesinlikle sayısal verilere veya geçmiş trendlere değinerek mantıklı bir açıklama yap (En fazla 25 kelime, Türkçe). '
        +'SADECE JSON döndür: {"focus":"günün odağı","note":"kısa motivasyon","why":"neden bu planı önerdiğinin analitik açıklaması","steps":[{"label":"somut adım","href":"..."}]}';
      var out = await DHProviders.chat([{role:"system",content:sys},{role:"user",content:prof}],{temperature:0.3,max_tokens:450});
      var plan = null; try{ plan = valid(JSON.parse(String(out).replace(/```json|```/g,"").trim())); }catch(e){}
      if(!plan) return;
      localStorage.setItem(KEY,JSON.stringify(plan));
      plan.stats = await liveStats();
      paint(plan);
    } catch(e){}
  }
  if(document.readyState!=="loading") setTimeout(run,1200);
  else document.addEventListener("DOMContentLoaded",function(){ setTimeout(run,1200); });
})();