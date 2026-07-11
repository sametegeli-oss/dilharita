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
    +".dh-coach.stat{border-color:#a78bfa;background:linear-gradient(135deg,#111827,#22183f)}";
  document.head.appendChild(css);
  var box=document.createElement("div"); box.className="dh-coach";
  function mount(){ document.body.appendChild(box); }
  if(document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  var hideT=null, lastMsg="", lastAt=0;
  window.dhCoachSay=function(msg, kind, faceOverride){
    if(!msg || !document.body) return;
    if(msg===lastMsg && Date.now()-lastAt<4000) return;
    lastMsg=msg; lastAt=Date.now();
    box.classList.remove("show");
    void box.offsetWidth;
    box.className="dh-coach "+(kind||"tip");
    box.innerHTML='<span class="face">'+(faceOverride||faceSvg(kind))+'</span><span style="flex:1">'+String(msg).replace(/[<>&]/g,function(c){return{"<":"&lt;",">":"&gt;","&":"&amp;"}[c];})+'</span><span class="x" onclick="event.stopPropagation();this.parentElement.classList.remove(\'show\')">✕</span>';
    requestAnimationFrame(function(){ box.classList.add("show"); });
    clearTimeout(hideT);
    hideT=setTimeout(function(){ box.classList.remove("show"); }, 7500);
  };
  box.onclick=function(){ box.classList.remove("show"); };

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
  window.dhCoachEvaluate=async function(opts){
    try{
      opts=opts||{};
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
        }
      }
    }catch(e){}
  };
  window.dhCoachModuleIntro=function(mod, commonMistake){
    try{
      if(!mod || state.seenTypesToday[mod]) return;
      state.seenTypesToday[mod]=1;
      if(commonMistake) dhCoachSay("YENİ KONU: Bu yapıyı ilk kez çalışıyorsun. Genelde şu hata yapılır: "+commonMistake+" — buna dikkat ederek başla.","tip");
    }catch(e){}
  };

  /* ---------- PASİF SAYFALAR İÇİN GENEL YÖNLENDİRME (cevap değerlendirmesi olmayan ekranlar) ---------- */
  // Her sayfada değil, en fazla birkaç saatte bir; sıkıcı/tekrarlı olmasın diye zaman kilidi var.
  (async function genericTip(){
    try{
      var lastT=+localStorage.getItem("dh-coach-last-generic-tip")||0;
      if(Date.now()-lastT<3*3600000) return;   // 3 saatte bir en fazla
      var tr={}; try{ tr=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}; }catch(e){}
      var d=new Date(), streak=0;
      for(;;){ if((tr.days||{})[d.toISOString().slice(0,10)]){streak++; d.setDate(d.getDate()-1);} else break; }
      var due=0;
      try{
        var r=await new Promise(function(res){ var rq=indexedDB.open("sentence-mode",1); rq.onsuccess=function(){res(rq.result);}; rq.onerror=function(){res(null);}; });
        if(r){ await new Promise(function(res){ var now=Date.now(), q=r.transaction("kv","readonly").objectStore("kv").openCursor();
          q.onsuccess=function(e){ var c=e.target.result; if(c){ var k=String(c.key); if(k.indexOf("srs:")===0 && c.value && (c.value.due||0)<=now) due++; c.continue(); } else { r.close(); res(); } };
          q.onerror=function(){ res(); }; }); }
      }catch(e){}
      var msg=null, kind="tip";
      if(streak===0 && due>10) msg="Bugün henüz çalışmadın ama "+due+" tekrar bekliyor — hemen 10 dakikanı ayır, seriye başla!";
      else if(streak>=3) msg=streak+" günlük serin devam ediyor, harika gidiyorsun — bugünü de kaçırma!";
      else if(due>30) msg="Tekrar bekleyen "+due+" öğe birikmiş — bugün önce tekrarları bitir, sonra yeni cümlelere geç.";
      if(msg){ dhCoachSay(msg, kind); localStorage.setItem("dh-coach-last-generic-tip", String(Date.now())); }
    }catch(e){}
  })();
})();
