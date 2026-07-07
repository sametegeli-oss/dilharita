/* koc.js — HİPER-KİŞİSELLEŞTİRİLMİŞ AI ÖĞRENME KOÇU (MENTOR V2)
   Özellikler: Zayıf Konu Entegrasyonu · Telaffuz Radarı · Adım Takibi (Tikler) · Pomodoro Desteği · Gün Sonu Modu 
   Kurallar: AI yalnız ÖNERİR (veri yazmaz) · Plan günlük önbellektedir · Hatalarda sessiz düşüş yapar. */
(function(){
  "use strict";
  var DAY = new Date().toISOString().slice(0,10), KEY = "dh-koc-plan-" + DAY;
  var ALLOWED = ["tekrar.html?plan=1", "index-app.html", "chat.html", "practice.html", "kelime-ogren.html", "hata-defteri.html"];

  // 1 & 5. MADDELER: ADIM TAMAMLANMA VE AKŞAM MODU KONTROLLERİ
  function getStepStatus(index) {
    return localStorage.getItem("dh-koc-step-" + DAY + "-" + index) === "true";
  }
  function setStepStatus(index) {
    localStorage.setItem("dh-koc-step-" + DAY + "-" + index, "true");
  }
  function isEvening() {
    var hour = new Date().getHours();
    return hour >= 18; // Saat 18:00 ve sonrası akşam modudur
  }

  // 1, 2 & 4. MADDELER: ALT PANELDEKİ ZAYIF KONULARI VE TELAFFUZU OKUYAN ZENGİN PROFİL
  async function profile(){
    var p = {};
    
    // Çalışma serisi ve süreklilik analizi (Local Storage)
    try {
      var tr = JSON.parse(localStorage.getItem("dh-study-tracker-v1") || "{}") || {}, d = new Date(), st = 0;
      for(;;){ if((tr.days || {})[d.toISOString().slice(0,10)]){ st++; d.setDate(d.getDate()-1); } else break; }
      p.streak = st;
      p.last7DaysActive = Object.keys(tr.days || {}).filter(function(k){ 
        return (Date.now() - new Date(k).getTime()) <= 7 * 24 * 60 * 60 * 1000; 
      }).length;
    } catch(e){}

    // Toplam öğrenilen hacim
    try {
      var m = JSON.parse(localStorage.getItem("dh-progress-mirror-v1") || "{}") || {}, s1=0, w1=0;
      for(var k in m){ if(m[k] && m[k][0] === 1){ if(k.indexOf("sentence:") === 0) s1++; else if(k.indexOf("word:") === 0) w1++; } }
      p.learnedSentences = s1;
      p.learnedWords = w1;
    } catch(e){}

    // Alt paneldeki gerçek zayıf konu, zayıf modül ve telaffuz skorunu doğrudan yakala
    try {
      p.weakestTopic = localStorage.getItem("dh-weak-topic") || "missing-word";
      p.weakestModule = localStorage.getItem("dh-weak-module") || "A2-M20 Doctor";
      p.pronunciationScore = parseFloat(localStorage.getItem("dh-avg-pronunciation") || "75");
    } catch(e){}

    // SRS kuyruğu ve İnatçı Ögeler (IndexedDB)
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
          q.onerror=function(){ db.close(); res(); };
        } catch(e2){ try{db.close()}catch(_){} res(); } };
      r.onerror = function(){ res(); };
    } catch(e3){ res(); } });

    return JSON.stringify(p);
  }

  // 1, 3 ve 5. MADDELER: TİKLİ, POMODORO DESTEKLİ VE DİNAMİK ARAYÜZ
  function paint(plan){
    try {
      var wrapper = document.getElementById("dhKocContainer");
      if(!wrapper || !plan || !plan.steps || !plan.steps.length) return;

      var totalSteps = plan.steps.length;
      var completedCount = 0;

      var stepsHtml = plan.steps.map(function(s, i){
        var isDone = getStepStatus(i);
        if(isDone) completedCount++;

        // 3. Madde: Modüllere süre parametresi (timer) paslama
        var stepTime = s.time || "10";
        var finalHref = "./" + s.href + (s.href.indexOf("?") >= 0 ? "&" : "?") + "timer=" + stepTime;

        return '<div style="margin: 8px 0; padding: 12px; background: ' + (isDone ? 'rgba(40,167,69,0.15)' : 'rgba(255,255,255,0.05)') + '; border: 1px solid ' + (isDone ? 'rgba(40,167,69,0.3)' : 'transparent') + '; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; transition: all 0.3s;">' +
                 '<span style="display:flex; align-items:center; gap:8px;' + (isDone ? 'text-decoration: line-through; opacity: 0.6;' : '') + '">' +
                   '<span>' + (isDone ? '✅' : '<b>' + (i+1) + '.</b>') + '</span>' +
                   '<span>' + esc(s.label) + ' <small style="color:#aaa; margin-left:5px;">(' + esc(stepTime) + ' dk)</small></span>' +
                 '</span>' +
                 (isDone 
                   ? '<span style="color:#28a745; font-size:13px; font-weight:bold; padding:4px 10px;">Tamamlandı</span>'
                   : '<a href="' + finalHref + '" data-step-idx="' + i + '" class="dh-koc-action-btn" style="background:#007bff; color:#fff; padding:6px 12px; border-radius:6px; text-decoration:none; font-size:13px; font-weight:bold; box-shadow: 0 2px 4px rgba(0,123,255,0.2);">Başla →</a>'
                 ) +
               '</div>';
      }).join("");

      // 5. Madde: Akşam Modu & Gün Sonu Kapanış Algoritması
      var isAllDone = completedCount === totalSteps;
      var evening = isEvening();
      var bgHeader = evening ? (isAllDone ? '#14321a' : '#2b1c1c') : '#1e1e24';
      var borderHeader = evening ? (isAllDone ? 'rgba(40,167,69,0.4)' : 'rgba(220,53,69,0.4)') : 'rgba(255,255,255,0.15)';
      
      var customComment = plan.coach_comment;
      if (evening) {
        if (isAllDone) {
          customComment = "Muhteşem bir gün kapanışı! Bugün verdiğim planın tamamını eksiksiz bitirdin. Harika gidiyorsun, şimdi dinlenme zamanı! 🌟";
        } else {
          customComment = "Gün bitmek üzere ama günlük planın henüz tamamlanmamış! Öğrenme çizgini korumak ve kalıcılığı sağlamak için yatmadan önce eksik adımları hızlıca tamamlayalım. Hadi!";
        }
      }

      wrapper.innerHTML = 
        '<div style="border: 1px solid ' + borderHeader + '; padding: 18px; border-radius: 12px; background: ' + bgHeader + '; color: #fff; font-family: sans-serif; transition: background 0.5s;">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; margin-bottom:14px;">' +
            '<span style="font-size:16px; font-weight:bold;">🧭 ' + (evening ? '🌙 Akşam Raporu & Kapanış' : '🎯 Günün Odağı: ' + esc(plan.focus)) + '</span>' +
            '<span style="font-size:12px; background:#28a745; padding:3px 8px; border-radius:12px; font-weight:bold;">Başarı İhtimali: %' + esc(plan.success_rate || "90") + '</span>' +
          '</div>' +
          '<div>' + stepsHtml + '</div>' +
          '<div style="margin-top:12px; font-size:13px; color:#ccc; display:flex; justify-content:space-between;">' +
            '<span>⏱️ <b>Toplam Tahmini Süre:</b> ' + esc(plan.estimated_time || "30") + ' dakika</span>' +
            '<span>📊 İlerleme: ' + completedCount + '/' + totalSteps + '</span>' +
          '</div>' +
          '<hr style="border:0; border-top:1px dashed rgba(255,255,255,0.1); margin:14px 0;">' +
          '<div style="background: rgba(0,123,255,0.08); padding: 12px; border-radius: 8px; border-left: 4px solid #007bff;">' +
            '<b style="color:#007bff; display:block; margin-bottom:4px; font-size:13px;">🎓 Koçun Stratejik Notu:</b>' +
            '<span style="font-style:italic; font-size:13.5px; line-height:1.45; color:#eee;">"' + esc(customComment) + '"</span>' +
          '</div>' +
        '</div>';

      // Butonlara tıklama olayı bağlama
      var btns = wrapper.querySelectorAll(".dh-koc-action-btn");
      for(var idx=0; idx<btns.length; idx++) {
        btns[idx].addEventListener("click", function(e) {
          var stepIdx = this.getAttribute("data-step-idx");
          if(stepIdx !== null) setStepStatus(stepIdx);
        });
      }

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
      
      // 2, 4, 6, 7 & 8. MADDELER: TELAFFUZ VE STRATEJİ ODAKLI PROMPT
      var sys = "Sen DilHaritası uygulamasındaki Türk öğrencilerin profesyonel, bilge ve stratejik İngilizce eğitim koçusun.\n" +
                "Öğrencinin JSON formatındaki detaylı profilini (streak, zayıf konular, srs durumları, telaffuz skoru vb.) analiz ederek BUGÜN için mikro taktiksel bir plan sunacaksın.\n\n" +
                "STRATEJİK KURALLAR:\n" +
                "- Öğrencinin 'weakestTopic' (en zayıf konu) ve 'weakestModule' (en zayıf modül) değerlerini mutlaka gör ve stratejik notunda (coach_comment) bu eksiklere doğrudan değin.\n" +
                "- Öğrencinin 'pronunciationScore' (Telaffuz Puanı) değerine ÖZELLİKLE dikkat et. Eğer bu puan 75'in altındaysa, kesinlikle plana chat.html veya practice.html modüllerinden birini ekle ve stratejik notunda telaffuzunu/konuşmasını geliştirmesi gerektiğine dair pedagojik bir uyarı yap.\n" +
                "- Eğer 'dueSRS' (tekrar bekleyen) 50'den fazlaysa tekrar.html?plan=1 modülünü planın en başına koy ve süre olarak en az 15 dk ata. Bu durumdayken kelime-ogren.html modülünü plana ekleme.\n" +
                "- Rutin kırıcı ol: Adım sıralamalarını her gün ezbere yapma, pedagojik olarak mantıklı kombinasyonlar kur.\n\n" +
                "ÇIKTI MODELİ (SADECE saf JSON, asla markdown bloğu olmasın):\n" +
                "{\n" +
                "  \"focus\": \"Günün ana odağı (Örn: Telaffuz İyileştirme ve Hata Analizi)\",\n" +
                "  \"estimated_time\": \"Toplam tahmini plan süresi (Örn: '45')\",\n" +
                "  \"success_rate\": \"Seri ve yük durumuna göre başarma ihtimali yüzdesi (Örn: '88')\",\n" +
                "  \"coach_comment\": \"Öğrencinin telaffuz puanına, zayıf konusuna ve durumuna doğrudan hitap eden, neden bu adımları seçtiğini gerekçelendiren bilgece mentor yorumu.\",\n" +
                "  \"steps\": [\n" +
                "    {\"label\": \"Sesli İletişim Pratiği\", \"href\": \"chat.html\", \"time\": \"15\"},\n" +
                "    {\"label\": \"Zayıf Konu Odaklı Tekrar\", \"href\": \"tekrar.html?plan=1\", \"time\": \"10\"}\n" +
                "  ]\n" +
                "}\n\n" +
                "İzin verilen tek href listesi: " + ALLOWED.join(", ");

      var out = await DHProviders.chat([{role:"system", content:sys}, {role:"user", content:prof}], {temperature: 0.3, max_tokens: 600});
      
      var plan = null;
      try {
        var cleanOut = String(out).replace(/```json|```/g,"").trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
        plan = valid(JSON.parse(cleanOut));
      } catch(e){}
      
      if(!plan) return;
      localStorage.setItem(KEY, JSON.stringify(plan));
      
      // Eski günlerin planlarını ve eski adımların tıklanma durumlarını temizle
      for(var i=localStorage.length-1; i>=0; i--){ 
        var k = localStorage.key(i); 
        if(k && k.indexOf("dh-koc-plan-")===0 && k!==KEY) localStorage.removeItem(k);
        if(k && k.indexOf("dh-koc-step-")===0 && k.indexOf(DAY) === -1) localStorage.removeItem(k);
      }
      paint(plan);
    } catch(e){}
  }

  if(document.readyState !== "loading") setTimeout(run, 1200);
  else document.addEventListener("DOMContentLoaded", function(){ setTimeout(run, 1200); });
})();