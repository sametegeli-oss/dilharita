/* koc.js — GELİŞMİŞ AI ÖĞRENME KOÇU (MENTOR)
   Kurallar: AI yalnız ÖNERİR · Plan günlük önbellekte saklanır · 
   Hata/Yetersiz veri durumunda sessiz düşüş (banner korunur) · UI enjeksiyonu güvenlidir. */
(function(){
  "use strict";
  var DAY = new Date().toISOString().slice(0,10), KEY = "dh-koc-plan-" + DAY;
  var ALLOWED = ["tekrar.html?plan=1", "index-app.html", "chat.html", "practice.html", "kelime-ogren.html", "hata-defteri.html"];

  // 1. ÇOK DAHA ZENGİN PROFİL ANALİZİ
  async function profile(){
    var p = {};
    // Seri ve Son 7/30 Günlük Aktivite
    try {
      var tr = JSON.parse(localStorage.getItem("dh-study-tracker-v1") || "{}") || {}, d = new Date(), st = 0;
      for(;;){ if((tr.days || {})[d.toISOString().slice(0,10)]){ st++; d.setDate(d.getDate()-1); } else break; }
      p.streak = st;
      p.last7DaysActive = Object.keys(tr.days || {}).filter(function(k){ 
        return (Date.now() - new Date(k).getTime()) <= 7 * 24 * 60 * 60 * 1000; 
      }).length;
    } catch(e){}

    // İlerleme, Öğrenilen Cümle ve Kelime Sayıları
    try {
      var m = JSON.parse(localStorage.getItem("dh-progress-mirror-v1") || "{}") || {}, s1=0, w1=0;
      for(var k in m){ if(m[k] && m[k][0] === 1){ if(k.indexOf("sentence:") === 0) s1++; else if(k.indexOf("word:") === 0) w1++; } }
      p.learnedSentences = s1;
      p.learnedWords = w1;
    } catch(e){}

    // Hata Defteri Analizi (Grammar, Kelime, Kalıp Sık Hatalar)
    try {
      if(window.LearningErrorDB && LearningErrorDB.all){
        var errs = await LearningErrorDB.all(), t = {};
        (errs || []).slice(-100).forEach(function(r){ if(r && r.type) t[r.type] = (t[r.type] || 0) + 1; });
        p.topErrors = Object.keys(t).sort(function(a,b){ return t[b] - t[a]; }).slice(0,3);
      }
    } catch(e){}

    // SRS ve İnatçı (Leech) Ögeler (IndexedDB)
    await new Promise(function(res){ try {
      var r = indexedDB.open("sentence-mode", 1);
      r.onsuccess = function(){ var db = r.result, due = 0, leech = 0, now = Date.now();
        try { 
          var tx = db.transaction("kv", "readonly");
          tx.onerror = function(){ db.close(); res(); };
          var q = tx.objectStore("kv").openCursor();
          q.onsuccess = function(e){ var c = e.target.result;
            if(c){ var kk = String(c.key), v = c.value || {};
              if(kk.indexOf("srs:") === 0){ if((v.due || 0) <= now) due++; if((v.lapses || 0) >= 3) leech++; }
              c.continue();
            } else { db.close(); p.dueSRS = due; p.leechItems = leech; res(); } };
          q.onerror = function(){ db.close(); res(); };
        } catch(e2){ try{db.close()}catch(_){} res(); } };
      r.onerror = function(){ res(); };
    } catch(e3){ res(); } });

    return JSON.stringify(p);
  }

  // 3, 4 ve 6. MADDELER: DİNAMİK PLAN, KOÇ MESAJI VE GÖRSEL ENJEKSİYON
  function paint(plan){
    try {
      var wrapper = document.getElementById("dhKocContainer");
      if(!wrapper || !plan || !plan.steps || !plan.steps.length) return;

      var stepsHtml = plan.steps.map(function(s, i){
        return '<div style="margin: 8px 0; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">' +
                 '<span><b>' + (i+1) + '.</b> ' + esc(s.label) + '</span>' +
                 '<a href="./' + esc(s.href) + '" style="background:#007bff; color:#fff; padding:4px 10px; border-radius:4px; text-decoration:none; font-size:13px;">Başla →</a>' +
               '</div>';
      }).join("");

      wrapper.innerHTML = 
        '<div style="border: 1px solid rgba(255,255,255,0.15); padding: 16px; border-radius: 12px; background: #1e1e24; color: #fff; font-family: sans-serif;">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px; margin-bottom:12px;">' +
            '<span style="font-size:18px;">🎯 <b>Günün Odağı:</b> ' + esc(plan.focus) + '</span>' +
            '<span style="font-size:12px; background:#28a745; padding:3px 8px; border-radius:12px;">Başarı İhtimali: %' + esc(plan.success_rate || "90") + '</span>' +
          '</div>' +
          '<div>' + stepsHtml + '</div>' +
          '<div style="margin-top:12px; font-size:13px; color:#aaa;">⏱️ <b>Tahmini Süre:</b> ' + esc(plan.estimated_time || "30") + ' dakika</div>' +
          '<hr style="border:0; border-top:1px dashed rgba(255,255,255,0.1); margin:12px 0;">' +
          '<div style="background: rgba(0,123,255,0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #007bff;">' +
            '<b style="color:#007bff; display:block; margin-bottom:4px;">🎓 Koçun Stratejik Notu:</b>' +
            '<span style="font-style:italic; font-size:14px; line-height:1.4;">"' + esc(plan.coach_comment) + '"</span>' +
          '</div>' +
        '</div>';
    } catch(e){}
  }

  function esc(s){ return String(s||"").replace(/[<>&]/g,function(c){return {"<":"&lt;",">":"&gt;","&":"&amp;"}[c];}); }
  
  function valid(p){
    if(!p || typeof p !== "object" || !Array.isArray(p.steps)) return null;
    p.steps = p.steps.filter(function(s){ return s && s.label && ALLOWED.indexOf(String(s.href || "")) >= 0; }).slice(0,5);
    if(!p.steps.length) return null;
    p.focus = String(p.focus || "").slice(0, 150);
    p.coach_comment = String(p.coach_comment || "").slice(0, 300);
    return p;
  }

  async function run(){
    try {
      var cached = localStorage.getItem(KEY);
      if(cached){ var cp = valid(JSON.parse(cached)); if(cp) paint(cp); return; }
      if(!(window.DHProviders && DHProviders.chat && DHProviders.hasAnyKey && DHProviders.hasAnyKey())) return;
      
      var prof = await profile();
      
      // 2, 7 ve 8. MADDELER: PROFESYONEL SİSTEM PROMPTU (AKILLI ÖNCELİKLENDİRME VE PEDAGOJİ)
      var sys = "Sen DilHaritası uygulamasındaki Türk öğrencilerin profesyonel, bilge ve stratejik İngilizce eğitim koçusun.\n" +
                "Öğrencinin JSON formatındaki güncel profil verilerini analiz ederek BUGÜN uygulamada yapması gereken mikro planı hazırlayacaksın.\n\n" +
                "STRATEJİK ÖNCELİKLENDİRME KURALLARI:\n" +
                "- Eğer 'dueSRS' (tekrar bekleyen) 50'den fazlaysa, kesinlikle kelime-ogren.html ÖNERME. Önce eritmeyi hedefle.\n" +
                "- Eğer 'leechItems' (inatçı hata) yüksekse, hata-defteri.html veya practice.html modüllerine ağırlık ver.\n" +
                "- Öğrenme psikolojisini kullan: Öğrenciyi ne tamamen boğ, ne de çok rahat bırak. Dengeli süreler ver.\n" +
                "- Rutini kır: Her gün ardışık aynı sıralamayı verme, performansa göre dinamik taktik belirle.\n\n" +
                "ÇIKTI FORMATI:\n" +
                "SADECE ham JSON döndür, asla markdown (```json) veya ekstra açıklama yazma. Şema birebir şöyle olmalı:\n" +
                "{\n" +
                "  \"focus\": \"Bugünkü odak konusu (Örn: Past Perfect ve Article Hatalarını Azaltma)\",\n" +
                "  \"estimated_time\": \"Tahmini çalışma süresi (Sadece sayısal string, örn: '42')\",\n" +
                "  \"success_rate\": \"Mevcut seriye ve profile göre başarı ihtimali yüzdesi (Sadece sayı, örn: '92')\",\n" +
                "  \"coach_comment\": \"Gerçek bir öğretmen gibi hitap eden, neden bu adımları seçtiğini gerekçelendiren pedagojik ve motive edici mentor yorumu (En fazla 3-4 cümle)\",\n" +
                "  \"steps\": [\n" +
                "    {\"label\": \"15 Dakika Kalıcı Tekrar\", \"href\": \"tekrar.html?plan=1\"}\n" +
                "  ]\n" +
                "}\n\n" +
                "İzin verilen href listesi kesinlikle sadece şunlar olabilir: " + ALLOWED.join(", ");

      var out = await DHProviders.chat([{role:"system", content:sys}, {role:"user", content:prof}], {temperature: 0.3, max_tokens: 600});
      
      var plan = null;
      try {
        var cleanOut = String(out).replace(/```json|```/g,"").trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
        plan = valid(JSON.parse(cleanOut));
      } catch(e){}
      
      if(!plan) return;
      localStorage.setItem(KEY, JSON.stringify(plan));
      
      // Eski günlerin planlarını temizleme
      for(var i=localStorage.length-1; i>=0; i--){ var k=localStorage.key(i); if(k && k.indexOf("dh-koc-plan-")===0 && k!==KEY) localStorage.removeItem(k); }
      paint(plan);
    } catch(e){}
  }

  if(document.readyState !== "loading") setTimeout(run, 1200);
  else document.addEventListener("DOMContentLoaded", function(){ setTimeout(run, 1200); });
})();