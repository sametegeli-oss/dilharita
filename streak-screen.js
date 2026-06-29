/* streak-screen.js — ÖĞRENME ÇİZGİSİ (STREAK) EKRANI
   Dil Harita — Busuu tarzı seri/streak gösterimi.

   StudyTracker'ın verisini kullanır (streak, lastNDays).
   Ders sonunda veya ana sayfada gösterilebilir.

   Kullanım:
     DHStreak.show();                  // tam ekran modal göster
     DHStreak.show({ onContinue:fn });  // "Devam" butonuna basınca çağrılır
     DHStreak.card();                   // küçük kart HTML'i döndürür (gömülü için)
*/
(function(global){
  "use strict";
  if(global.DHStreak) return;

  var GUN_KISA = ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"]; // getDay() 0=Pazar

  function getWeek(){
    // StudyTracker.lastNDays(7) → son 7 gün, en eski → en yeni
    var days = [];
    try{
      if(global.StudyTracker && StudyTracker.lastNDays){
        days = StudyTracker.lastNDays(7) || [];
      }
    }catch(e){}
    return days.map(function(d){
      var done = d && (d.lessons>0 || d.sentences>0 || d.videos>0 || d.reviews>0 || d.minutes>0);
      var dateObj = d && d.date ? parseKey(d.date) : null;
      var label = dateObj ? GUN_KISA[dateObj.getDay()] : "";
      var isToday = d && d.date===todayKey();
      return { label:label, done:!!done, isToday:isToday };
    });
  }
  function parseKey(k){ // "2026-06-29" → Date
    var p = String(k).split("-");
    if(p.length===3) return new Date(+p[0], +p[1]-1, +p[2]);
    return new Date();
  }
  function todayKey(){
    try{ if(global.StudyTracker && StudyTracker.todayKey) return StudyTracker.todayKey(); }catch(e){}
    var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }
  function getStreak(){
    try{ if(global.StudyTracker && StudyTracker.streak) return StudyTracker.streak(); }catch(e){}
    return 0;
  }
  function doneToday(){
    var w=getWeek();
    var t=w.filter(function(d){ return d.isToday; })[0];
    return t ? t.done : false;
  }

  // --- CSS (bir kez) ---
  function injectCSS(){
    if(document.getElementById("dh-streak-css")) return;
    var st=document.createElement("style");
    st.id="dh-streak-css";
    st.textContent =
     ".dh-streak-ov{position:fixed;inset:0;z-index:10000;background:#0a1628;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;animation:dhSF .25s ease}"
    +"@keyframes dhSF{from{opacity:0}to{opacity:1}}"
    +".dh-streak-flame{font-size:84px;line-height:1;margin-bottom:8px;animation:dhFlame 1.6s ease-in-out infinite}"
    +"@keyframes dhFlame{0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.08) rotate(2deg)}}"
    +".dh-streak-cal{display:flex;gap:10px;background:#0f1f3a;border:1px solid #1e3a5f;border-radius:18px;padding:16px 18px;margin:6px 0 26px}"
    +".dh-streak-day{display:flex;flex-direction:column;align-items:center;gap:7px}"
    +".dh-streak-dot{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-size:18px;border:2px solid #1e3a5f;background:#0a1628;color:#9fb3d9;transition:transform .2s}"
    +".dh-streak-dot.done{background:linear-gradient(135deg,#34d399,#10b981);border-color:#34d399;color:#fff}"
    +".dh-streak-dot.today{border-color:#60a5fa;box-shadow:0 0 0 3px #60a5fa33}"
    +".dh-streak-dlabel{font-size:11px;color:#9fb3d9;font-weight:700}"
    +".dh-streak-num{font-size:40px;font-weight:950;color:#e8eef7;text-align:center;line-height:1.1}"
    +".dh-streak-num b{background:linear-gradient(135deg,#fb923c,#f59e0b);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}"
    +".dh-streak-title{font-size:22px;font-weight:850;color:#e8eef7;text-align:center;margin:4px 0 8px;line-height:1.3;max-width:340px}"
    +".dh-streak-warn{font-size:14px;color:#9fb3d9;text-align:center;margin-bottom:30px;max-width:320px;line-height:1.5}"
    +".dh-streak-warn b{color:#fbbf24}"
    +".dh-streak-btn{background:#2563eb;color:#fff;border:0;border-radius:14px;padding:15px 48px;font-size:17px;font-weight:800;cursor:pointer}"
    +".dh-streak-btn:hover{background:#1d4ed8}"
    +".dh-streak-card{background:#0f1f3a;border:1px solid #1e3a5f;border-radius:16px;padding:16px;display:flex;align-items:center;gap:14px}"
    +".dh-streak-card .f{font-size:38px}"
    +".dh-streak-card .t b{font-size:22px;color:#fb923c}"
    +".dh-streak-card .t span{display:block;color:#9fb3d9;font-size:13px}";
    document.head.appendChild(st);
  }

  function calHtml(){
    var week=getWeek();
    return '<div class="dh-streak-cal">'
      + week.map(function(d){
          return '<div class="dh-streak-day">'
            +'<div class="dh-streak-dot'+(d.done?" done":"")+(d.isToday?" today":"")+'">'+(d.done?"✓":"")+'</div>'
            +'<div class="dh-streak-dlabel">'+d.label+'</div>'
            +'</div>';
        }).join("")
      +'</div>';
  }

  function show(opts){
    opts=opts||{};
    injectCSS();
    var streak=getStreak();
    var bugun=doneToday();

    var title, warn;
    if(streak<=0){
      title="Hadi başlayalım!";
      warn="Bugün çalışarak öğrenme çizgini başlat. Her gün küçük bir adım yeter.";
    } else if(bugun){
      title=streak+" günlük öğrenme çizgisindesin!";
      warn="Harika gidiyorsun — bugünkü çalışmanı tamamladın. 🎉";
    } else {
      title=streak+" günlük öğrenme çizgisindesin!";
      warn="Çizgini korumak için bugün kısa bir çalışma yapman yeter. <b>Serini kaçırma!</b>";
    }

    var ov=document.createElement("div");
    ov.className="dh-streak-ov";
    ov.innerHTML =
      '<div class="dh-streak-flame">🔥</div>'
      + calHtml()
      + (streak>0 ? '<div class="dh-streak-num"><b>'+streak+'</b> gün</div>' : '')
      + '<div class="dh-streak-title">'+title+'</div>'
      + '<div class="dh-streak-warn">'+warn+'</div>'
      + '<button class="dh-streak-btn" id="dhStreakGo">Devam</button>';
    document.body.appendChild(ov);
    document.getElementById("dhStreakGo").onclick=function(){
      ov.remove();
      if(typeof opts.onContinue==="function") opts.onContinue();
    };
  }

  // küçük gömülü kart (ana sayfa için)
  function card(){
    injectCSS();
    var streak=getStreak();
    return '<div class="dh-streak-card">'
      +'<div class="f">🔥</div>'
      +'<div class="t"><b>'+streak+' gün</b><span>öğrenme çizgin</span></div>'
      +'</div>';
  }

  global.DHStreak = { show: show, card: card, getStreak: getStreak, doneToday: doneToday };
})(window);
