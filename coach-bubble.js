/* coach-bubble.js — GLOBAL AI KOÇ BALONU (yüzlü, tüm sayfalarda tek dosya)
   Kullanım: <script src="./coach-bubble.js"></script> — başka hiçbir şey gerekmez.
   Dışa açık API:
     window.dhCoachSay(msg, kind, faceOverride)   — doğrudan bir mesaj göster
     window.dhCoachEvaluate(opts)                  — cevap değerlendirmesinden karar üretir ve gösterir
       opts: {sentenceId, en, answer, ok, commonMistake}
   Tüm kararlar YEREL veriye (hata defteri geçmişi) dayanır — AI çağrısı YOK, anlık ve ücretsiz.
*/
(function(){
  "use strict";
  if(window.__dhCoachInstalled) return;
  window.__dhCoachInstalled = true;

  /* ÖNEMLİ DÜZELTME: "sayfayı ziyaret etmek" görev tamamlama için ARTIK yeterli değil —
     meşale/hedef gerçek cevaplara bakarken, adım işaretleri yalnız ziyarete bakıyordu ve
     bu ikisi çelişiyordu (3 görev "tamamlandı" görünürken meşale "0 gün" kalabiliyordu).
     Artık "görev tamamlandı" da SADECE gerçek etkileşimde (dhCoachEvaluate/sohbet mesajı) işaretlenir. */
  var __dhPage=(location.pathname.split("/").pop()||"index.html");
  window.dhCoachMarkStepDone=function(page){
    try{ var k="dh-koc-steps-done-"+new Date().toISOString().slice(0,10); var s=JSON.parse(localStorage.getItem(k)||"{}")||{}; s[page]=1; localStorage.setItem(k, JSON.stringify(s)); }catch(e){}
  };

  /* ---------- 📋 GÜNLÜK AKTİVİTE KAYDI ("Bugünkü Aktivitem" ekranı için) ---------- */
  var PAGE_LABEL={"index.html":"Ana Menü","practice.html":"Pratik","tekrar.html":"Tekrar","index-app.html":"Cümle Öğrenimi",
    "chat.html":"Sohbet Seçimi","chathotel.html":"Sohbet: Otel","chatrestaurant.html":"Sohbet: Restoran","chatdoctor.html":"Sohbet: Doktor",
    "chatairport.html":"Sohbet: Havaalanı","chatteacher.html":"Sohbet: Öğretmen","teacher.html":"Öğretmen","kelime-ogren.html":"Kelime Öğren",
    "videopractice.html":"Video Pratik","hata-defteri.html":"Hata Defteri","rapor.html":"İlerleme Raporu"};
  window.dhLogActivity=function(detail, kind){
    try{
      var K="dh-activity-log-v1";
      var log=JSON.parse(localStorage.getItem(K)||"[]")||[];
      var today=new Date().toISOString().slice(0,10);
      // KALICI GEÇMİŞ: eskiden yalnız "bugün" tutulup her yazımda önceki günler silinirdi.
      // Artık son 30 günü saklıyoruz — koç ve aktivite ekranı gerçek geçmiş üzerinden analiz yapabilsin.
      var cutoff=Date.now()-30*86400000;
      log=log.filter(function(e){ return (e.ts||0)>=cutoff; });
      log.push({ts:Date.now(), d:today, page:(location.pathname.split("/").pop()||"index.html"), detail:String(detail||"").slice(0,140), kind:kind||"info"});
      if(log.length>4000) log=log.slice(-4000);   // 30 gün için üst sınır (depolama koruması)
      localStorage.setItem(K, JSON.stringify(log));
    }catch(e){}
  };
  try{ window.dhLogActivity(PAGE_LABEL[__dhPage]?( "📍 "+PAGE_LABEL[__dhPage]+" sayfasını açtı"):("📍 "+__dhPage+" sayfasını açtı"), "visit"); }catch(e){}

  /* ---------- SVG YÜZ (dış dosyaya bağımlı değil, her zaman çalışır) ---------- */
  function faceSvg(kind){
    var mouth = kind==="praise" ? '<path d="M20 40 Q32 52 44 40" stroke="#0a1628" stroke-width="4" fill="none" stroke-linecap="round"/>'
      : kind==="warn" ? '<path d="M20 46 Q32 36 44 46" stroke="#0a1628" stroke-width="4" fill="none" stroke-linecap="round"/>'
      : '<line x1="22" y1="42" x2="42" y2="42" stroke="#0a1628" stroke-width="4" stroke-linecap="round"/>';
    var eyeShape = kind==="praise"
      ? '<path d="M16 26 Q20 20 24 26" stroke="#0a1628" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M40 26 Q44 20 48 26" stroke="#0a1628" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
      : '<circle cx="20" cy="25" r="3.5" fill="#0a1628"/><circle cx="44" cy="25" r="3.5" fill="#0a1628"/>';
    var bg = kind==="praise" ? "#4ade80" : kind==="warn" ? "#f59e0b" : kind==="stat" ? "#a78bfa" : "#38bdf8";
    var brow = kind==="warn" ? '<path d="M14 18 L26 21" stroke="#0a1628" stroke-width="3" stroke-linecap="round"/><path d="M50 18 L38 21" stroke="#0a1628" stroke-width="3" stroke-linecap="round"/>' : "";
    return '<svg viewBox="0 0 64 64" width="46" height="46" style="flex:0 0 auto"><circle cx="32" cy="32" r="30" fill="'+bg+'"/>'+brow+eyeShape+mouth+'</svg>';
  }

  /* ---------- CSS + KUTU ---------- */
  var css=document.createElement("style");
  css.textContent=".dh-coach{position:fixed !important;left:50% !important;top:22px !important;bottom:auto !important;"
    +"transform:translateX(-50%) translateY(-40px) scale(.85);opacity:0;"
    +"max-width:min(95vw,640px);background:#111827;border-left:8px solid #38bdf8;border-radius:16px;"
    +"padding:18px 24px;box-shadow:0 20px 60px rgba(0,0,0,.7);z-index:2147483000;font:800 17px/1.4 system-ui,sans-serif;color:#f8fafc;"
    +"display:flex;gap:16px;align-items:center;transition:opacity .3s,transform .3s;pointer-events:none}"
    +".dh-coach.show{opacity:1;transform:translateX(-50%) translateY(0) scale(1);pointer-events:auto}"
    +".dh-coach.show.praise{animation:dhClap .6s ease 2}"
    +".dh-coach.show.warn{animation:dhShake .5s ease}"
    +".dh-coach.show.tip,.dh-coach.show.stat{animation:dhPulse .5s ease}"
    +"@keyframes dhPulse{0%{transform:translateX(-50%) translateY(0) scale(1.08)}100%{transform:translateX(-50%) translateY(0) scale(1)}}"
    +"@keyframes dhClap{0%,100%{transform:translateX(-50%) translateY(0) scale(1) rotate(0)}25%{transform:translateX(-50%) translateY(-6px) scale(1.05) rotate(-2deg)}50%{transform:translateX(-50%) translateY(0) scale(1.1) rotate(2deg)}75%{transform:translateX(-50%) translateY(-4px) scale(1.05) rotate(-1deg)}}"
    +"@keyframes dhShake{0%,100%{transform:translateX(-50%) translateY(0) scale(1)}20%{transform:translate(calc(-50% - 10px),0) scale(1)}40%{transform:translate(calc(-50% + 10px),0) scale(1)}60%{transform:translate(calc(-50% - 6px),0) scale(1)}80%{transform:translate(calc(-50% + 6px),0) scale(1)}}"
    +".dh-coach .face{animation:dhFaceBob .5s ease 3}"
    +"@keyframes dhFaceBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}"
    +".dh-coach .x{position:absolute;top:8px;right:11px;font-size:15px;color:#94a3b8;cursor:pointer;font-weight:400}"
    +".dh-coach.praise{border-color:#22c55e;background:linear-gradient(135deg,#111827,#0d2818)}"
    +".dh-coach.warn{border-color:#f59e0b;background:linear-gradient(135deg,#111827,#2d1a06)}"
    +".dh-coach.tip{border-color:#38bdf8;background:linear-gradient(135deg,#111827,#0a2233)}"
    +".dh-coach.stat{border-color:#a78bfa;background:linear-gradient(135deg,#111827,#22183f)}"
    +".dh-avatar{position:fixed !important;right:14px;bottom:78px;z-index:2147482900;width:54px;height:54px;border-radius:50%;"
    +"background:#111827;border:3px solid #38bdf8;box-shadow:0 6px 20px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;"
    +"cursor:pointer;animation:dhBreathe 3s ease-in-out infinite}"
    +"@keyframes dhBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}"
    +".dh-avatar.reacting{animation:dhAvatarReact .6s ease}"
    +"@keyframes dhAvatarReact{0%{transform:scale(1)}30%{transform:scale(1.25)}60%{transform:scale(.95)}100%{transform:scale(1)}}"
    +".dh-avatar svg{width:40px;height:40px}"
    +".dh-avatar .ring{position:absolute;inset:-3px;border-radius:50%;border:2px solid #38bdf8;opacity:0;pointer-events:none}"
    +".dh-avatar.reacting .ring{animation:dhRing .8s ease}"
    +"@keyframes dhRing{0%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(1.6)}}";
  document.head.appendChild(css);
  var box=document.createElement("div"); box.className="dh-coach";
  var avatar=document.createElement("div"); avatar.className="dh-avatar"; avatar.title="Koçun — tıkla, son yorumunu tekrar göster";
  avatar.innerHTML='<div class="ring"></div>'+faceSvg("tip");
  function mount(){ document.body.appendChild(box); document.body.appendChild(avatar); }
  if(document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  var avatarResetT=null;
  function setAvatarFace(kind){
    try{
      avatar.querySelector("svg") && avatar.querySelector("svg").remove();
      avatar.insertAdjacentHTML("beforeend", faceSvg(kind||"tip"));
      avatar.classList.remove("reacting"); void avatar.offsetWidth; avatar.classList.add("reacting");
      clearTimeout(avatarResetT);
      avatarResetT=setTimeout(function(){
        avatar.querySelector("svg") && avatar.querySelector("svg").remove();
        avatar.insertAdjacentHTML("beforeend", faceSvg("tip"));   // nötr yüze dön
      }, 8000);
    }catch(e){}
  }

  var hideT=null, lastMsg="", lastAt=0, lastKind="tip";
  window.dhCoachSay=function(msg, kind, faceOverride){
    if(!msg || !document.body) return;
    if(msg===lastMsg && Date.now()-lastAt<4000) return;
    lastMsg=msg; lastAt=Date.now(); lastKind=kind||"tip";
    setAvatarFace(kind);
    box.classList.remove("show");
    void box.offsetWidth;
    box.className="dh-coach "+(kind||"tip");
    box.innerHTML='<span class="face">'+(faceOverride||faceSvg(kind))+'</span><span style="flex:1">'+String(msg).replace(/[<>&]/g,function(c){return{"<":"&lt;",">":"&gt;","&":"&amp;"}[c];})+'</span><span class="x" onclick="event.stopPropagation();this.parentElement.classList.remove(\'show\')">✕</span>';
    requestAnimationFrame(function(){ box.classList.add("show"); });
    clearTimeout(hideT);
    // otomatik kapanma KALDIRILDI — kullanıcı isteği: balon yalnız ✕ ile veya elle kapatılır
  };
  box.onclick=function(){ box.classList.remove("show"); };
  avatar.onclick=function(){
    if(lastMsg && Date.now()-lastAt<600000){ box.className="dh-coach "+lastKind; box.innerHTML='<span class="face">'+faceSvg(lastKind)+'</span><span style="flex:1">'+lastMsg.replace(/[<>&]/g,function(c){return{"<":"&lt;",">":"&gt;","&":"&amp;"}[c];})+'</span><span class="x" onclick="event.stopPropagation();this.parentElement.classList.remove(\'show\')">✕</span>'; box.classList.add("show"); clearTimeout(hideT); hideT=setTimeout(function(){ box.classList.remove("show"); },7500); }
    else { try{ window.__dhCoachManualStatus && window.__dhCoachManualStatus(); }catch(e){} }
  };

  /* ---------- ORTAK TÜR ETİKETİ + SOMUT TAVSİYE ---------- */
  var TYPE_LABEL={
    "missing-word":"kelime atlama","extra-word":"fazladan kelime","auxiliary-missing":"yardımcı fiil eksikliği (am/is/are/do/did...)",
    "auxiliary-extra":"gereksiz yardımcı fiil","article":"a/an/the kullanımı","pronoun":"zamir kullanımı",
    "past-simple":"geçmiş zaman (past simple)","present-continuous":"şimdiki zaman (present continuous)",
    "question-order":"soru cümlesi sıralaması","pronunciation":"telaffuz","sentence-accuracy":"cümle doğruluğu"
  };
  var TYPE_TIP={
    "missing-word":"Cümleyi yazmadan önce zihninde İngilizce olarak yüksek sesle tekrar et.",
    "extra-word":"Yazdıktan sonra cümleyi kelime kelime referansla karşılaştır, fazlalık varsa sil.",
    "auxiliary-missing":"Her cümlede önce 'yardımcı fiil var mı?' diye kontrol et: am/is/are/was/were/do/does/did.",
    "auxiliary-extra":"Basit cümlelerde gereksiz yere 'do/does' ekleme — sadece soru ve olumsuzda gerekir.",
    "article":"'a' ünsüzle, 'an' ünlüyle başlar; belirli nesnede 'the' kullan.",
    "pronoun":"Özneyi (I/you/he/she...) cümlenin başında MUTLAKA belirt.",
    "past-simple":"Fiilin -ed halini ya da düzensiz geçmiş formunu (was/were/went/did) kullanmayı unutma.",
    "present-continuous":"'am/is/are' + fiil-ing kalıbını birlikte kullan.",
    "question-order":"Soruda yardımcı fiil ÖZNEDEN ÖNCE gelir: Do you...? / Are you...?",
    "sentence-accuracy":"Kalıbı bütün olarak hatırla, kelime kelime çevirme."
  };
  window.DH_COACH_TYPE_LABEL=TYPE_LABEL; window.DH_COACH_TYPE_TIP=TYPE_TIP;

  var state={ evalCount:0, correctStreak:0, errCache:null, errCacheAt:0, seenTypesToday:{} };
  async function errHistory(){
    var now=Date.now();
    if(state.errCache && now-state.errCacheAt<15000) return state.errCache;
    try{ state.errCache=(window.LearningErrorDB && await LearningErrorDB.all())||[]; }catch(e){ state.errCache=[]; }
    state.errCacheAt=now;
    return state.errCache;
  }

  /* ---------- CEVAP DEĞERLENDİRME (practice/tekrar ORTAK karar mantığı) ---------- */
  /* ---------- 🔥 GÜNLÜK TAKİP (streak/meşale) — KANITLANDI: dh-study-tracker-v1'i
     sistemde hiçbir dosya yazmıyordu, bu yüzden meşale hep "0 gün" kalıyordu.
     Artık her gerçek cevap değerlendirmesinde bugünün kaydı burada oluşturulur/güncellenir. */
  function bumpDailyTracker(kind){
    try{
      var K="dh-study-tracker-v1";
      var tr=JSON.parse(localStorage.getItem(K)||"{}")||{};
      if(!tr.days) tr.days={};
      var today=new Date().toISOString().slice(0,10);
      if(!tr.days[today]) tr.days[today]={date:today,lessons:0,minutes:0,sentences:0,videos:0,reviews:0,errors:0};
      var d=tr.days[today];
      if(kind==="sentence") d.sentences=(d.sentences||0)+1;
      else if(kind==="review") d.reviews=(d.reviews||0)+1;
      else if(kind==="video") d.videos=(d.videos||0)+1;
      else if(kind==="lesson") d.lessons=(d.lessons||0)+1;
      localStorage.setItem(K, JSON.stringify(tr));
    }catch(e){}
  }
  window.dhBumpDailyTracker=bumpDailyTracker;

  var __dhSession={correct:0, wrong:0};
  function logSessionRate(force){
    var total=__dhSession.correct+__dhSession.wrong;
    if(!total) return;
    if(!force && total%10!==0) return;   // her 10 cevapta bir, ya da sayfadan ayrılırken (force)
    var pct=Math.round(100*__dhSession.correct/total);
    try{ window.dhLogActivity("📊 Oturum doğruluğu: %"+pct+" ("+__dhSession.correct+"/"+total+")", "rate"); }catch(e){}
  }
  window.addEventListener("pagehide", function(){ logSessionRate(true); });
  document.addEventListener("visibilitychange", function(){ if(document.visibilityState==="hidden") logSessionRate(true); });

  window.dhCoachEvaluate=async function(opts){
    try{
      opts=opts||{};
      bumpDailyTracker(opts.trackKind||"sentence");
      window.dhCoachMarkStepDone && window.dhCoachMarkStepDone(__dhPage);
      if(opts.ok) __dhSession.correct++; else __dhSession.wrong++;
      try{ window.dhLogActivity((opts.ok?"✅ Doğru: ":"❌ Yanlış: ")+(opts.en||opts.sentenceId||""), opts.ok?"correct":"wrong"); }catch(e){}
      logSessionRate(false);
      var hist=await errHistory();
      var curTypes = (window.LearningErrorDB && LearningErrorDB.detectTypes)
        ? LearningErrorDB.detectTypes({target:opts.en, answer:opts.answer, grammar:opts.grammar||"", module:opts.module||"", topic:opts.topic||""})
        : [];
      var sameSentencePast = hist.filter(function(r){ return r.sentenceId===opts.sentenceId && r.grade==="hard"; });

      if(opts.ok) state.correctStreak++; else state.correctStreak=0;
      if(opts.ok && state.correctStreak>=3 && state.correctStreak%3===0){
        dhCoachSay("HARİKASIN! Art arda "+state.correctStreak+" doğru cevap verdin, bu ritmi koru!","praise");
        return;
      }
      if(opts.ok && sameSentencePast.length){
        dhCoachSay("MÜKEMMEL! Daha önce bu cümlede zorlanmıştın, şimdi tam doğru yaptın. Aynı dikkatle devam et!","praise");
        return;
      }
      if(!opts.ok && sameSentencePast.length){
        dhCoachSay("DİKKAT: Bu cümlede daha önce de hata yapmıştın. "+(opts.commonMistake||"Kelime sırasına ve yardımcı fiile dikkat et.")+" Devam etmeden önce bir kez daha oku.","warn");
        return;
      }
      if(!opts.ok){
        var overlap = hist.filter(function(r){ return r.grade==="hard" && Array.isArray(r.types) && r.types.some(function(t){return curTypes.indexOf(t)>=0;}); });
        if(overlap.length>=2 && curTypes.length){
          var tp=curTypes[0];
          dhCoachSay("TEKRARLANAN HATA: "+(TYPE_LABEL[tp]||tp)+". Yapman gereken: "+(TYPE_TIP[tp]||"Cümle kurarken buna özellikle dikkat et.")+" Bir sonraki cümlede bilerek uygula!","warn");
          return;
        }
      }
      state.evalCount++;
      if(state.evalCount%5===0){
        var tally={};
        hist.forEach(function(r){ if(r.grade==="hard" && Array.isArray(r.types)) r.types.forEach(function(t){ tally[t]=(tally[t]||0)+1; }); });
        var top=Object.keys(tally).sort(function(a,b){return tally[b]-tally[a];})[0];
        if(top && tally[top]>=3){
          dhCoachSay("GENEL DEĞERLENDİRME: En çok "+(TYPE_LABEL[top]||top)+" konusunda hata yapıyorsun ("+tally[top]+" kez). Tavsiyem: "+(TYPE_TIP[top]||"buna özellikle dikkat et")+".","stat");
          return;
        }
      }
      // HİÇBİR ÖZEL KOŞUL TUTMADI: "her aktivitede yorum" ilkesi gereği yine de kısa bir tepki ver.
      var DEF_OK=["Doğru! Böyle devam et.","Aferin, tam isabet.","Güzel, ilerliyorsun.","Doğru cevap — bir sonrakine geç."];
      var DEF_NO=["Olmadı, doğrusuna bak ve devam et.","Bu sefer olmadı — açıklamayı oku, unutma.","Yanlış, ama önemli değil — öğrenmenin parçası."];
      var pick = opts.ok ? DEF_OK[state.evalCount%DEF_OK.length] : DEF_NO[state.evalCount%DEF_NO.length];
      dhCoachSay(pick, opts.ok?"praise":"warn");
    }catch(e){}
  };
  window.dhCoachModuleIntro=function(mod, commonMistake){
    try{
      if(!mod || state.seenTypesToday[mod]) return;
      state.seenTypesToday[mod]=1;
      if(commonMistake) dhCoachSay("YENİ KONU: Bu yapıyı ilk kez çalışıyorsun. Genelde şu hata yapılır: "+commonMistake+" — buna dikkat ederek başla.","tip");
    }catch(e){}
  };

  /* ---------- PASİF SAYFALAR İÇİN GENEL YÖNLENDİRME + GENEL DURUM YORUMU ---------- */
  async function buildStatusMessage(){
    var tr={}; try{ tr=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}; }catch(e){}
    var d=new Date(), streak=0;
    for(;;){ if((tr.days||{})[d.toISOString().slice(0,10)]){streak++; d.setDate(d.getDate()-1);} else break; }
    var due=0, learned=0;
    try{
      var r=await new Promise(function(res){ var rq=indexedDB.open("sentence-mode",1); rq.onsuccess=function(){res(rq.result);}; rq.onerror=function(){res(null);}; });
      if(r){ await new Promise(function(res){ var now=Date.now(), q=r.transaction("kv","readonly").objectStore("kv").openCursor();
        q.onsuccess=function(e){ var c=e.target.result; if(c){ var k=String(c.key); if(k.indexOf("srs:")===0 && c.value && (c.value.due||0)<=now) due++; c.continue(); } else { r.close(); res(); } };
        q.onerror=function(){ res(); }; }); }
    }catch(e){}
    try{ var m=JSON.parse(localStorage.getItem("dh-progress-mirror-v1")||"{}")||{}; for(var k in m){ if(m[k]&&m[k][0]===2) learned++; } }catch(e){}
    var msg=null, kind="tip";
    if(streak===0 && due>10){ msg="Bugün henüz çalışmadın ama "+due+" tekrar bekliyor — hemen 10 dakikanı ayır, seriye başla!"; kind="warn"; }
    else if(streak>=7){ msg="🔥 "+streak+" günlük serin devam ediyor, harikasın! Bugünü de kaçırma, meşale sönmesin."; kind="praise"; }
    else if(streak>=3){ msg=streak+" günlük serin devam ediyor, iyi gidiyorsun — bugünü de kaçırma!"; kind="praise"; }
    else if(due>30){ msg="Tekrar bekleyen "+due+" öğe birikmiş — bugün önce tekrarları bitir, sonra yeni cümlelere geç."; kind="warn"; }
    else { msg="Genel durumun: "+learned+" öğrenilmiş kayıt, "+due+" tekrar bekliyor. İstersen 'Tekrar' ya da 'Yeni Cümleler'den devam et."; kind="tip"; }
    return {msg:msg, kind:kind};
  }
  window.__dhCoachManualStatus=async function(){
    try{ var s=await buildStatusMessage(); if(s.msg) dhCoachSay(s.msg, s.kind); }catch(e){}
  };
  (async function genericTip(){
    try{
      var lastT=+localStorage.getItem("dh-coach-last-generic-tip")||0;
      if(Date.now()-lastT<20*60000) return;   // 20 dakikada bir en fazla — "koç her yerde olmalı" isteği gereği sıklaştırıldı
      var s=await buildStatusMessage();
      if(s.msg){ dhCoachSay(s.msg, s.kind); localStorage.setItem("dh-coach-last-generic-tip", String(Date.now())); }
    }catch(e){}
  })();
})();
