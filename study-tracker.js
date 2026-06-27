/* study-tracker.js
   Günlük çalışma takibi + öğrenme yolu için ortak küçük veri katmanı.
   localStorage kullanır, IndexedDB gerektirmez.
*/
(function(){
"use strict";

const KEY = "dh-study-tracker-v1";
const SESSION_KEY = "dh-study-session-today-v1";

function todayKey(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function load(){
  try{
    return JSON.parse(localStorage.getItem(KEY)||"{}") || {};
  }catch{return {}}
}
function save(data){
  localStorage.setItem(KEY, JSON.stringify(data||{}));
}
function ensure(){
  const data=load();
  data.days = data.days || {};
  data.goals = data.goals || {dailyLessons:1,dailyMinutes:10,dailySentences:20};
  data.path = data.path || {};
  return data;
}
function recordActivity(type="study", amount=1, meta={}){
  const data=ensure();
  const k=todayKey();
  const day=data.days[k] || {date:k,lessons:0,minutes:0,sentences:0,videos:0,reviews:0,errors:0,events:[]};
  if(type==="lesson") day.lessons += amount;
  else if(type==="minute") day.minutes += amount;
  else if(type==="sentence") day.sentences += amount;
  else if(type==="video") day.videos += amount;
  else if(type==="review") day.reviews += amount;
  else if(type==="error") day.errors += amount;
  else day.events.push({type,amount,meta,at:Date.now()});
  day.events.push({type,amount,meta,at:Date.now()});
  data.days[k]=day;
  save(data);
  return day;
}
function markLessonDone(id, meta={}){
  const data=ensure();
  data.path[id] = {...(data.path[id]||{}), done:true, doneAt:Date.now(), ...meta};
  save(data);
  recordActivity("lesson",1,{id});
}
function isDone(id){
  return !!ensure().path[id]?.done;
}
function day(date=todayKey()){
  const data=ensure();
  return data.days[date] || {date,lessons:0,minutes:0,sentences:0,videos:0,reviews:0,errors:0,events:[]};
}
function lastNDays(n=7){
  const arr=[];
  const now=new Date();
  for(let i=n-1;i>=0;i--){
    const d=new Date(now);
    d.setDate(now.getDate()-i);
    arr.push(day(todayKey(d)));
  }
  return arr;
}
function streak(){
  const data=ensure();
  let count=0;
  const now=new Date();
  for(let i=0;i<3650;i++){
    const d=new Date(now); d.setDate(now.getDate()-i);
    const k=todayKey(d);
    const day=data.days[k];
    if(day && (day.lessons>0 || day.sentences>0 || day.videos>0 || day.reviews>0 || day.minutes>0)) count++;
    else break;
  }
  return count;
}
function summary(){
  const d=day();
  const data=ensure();
  const goals=data.goals || {};
  const week=lastNDays(7);
  return {
    today:d,
    week,
    streak:streak(),
    goals,
    doneToday:(d.lessons>=goals.dailyLessons)||(d.minutes>=goals.dailyMinutes)||(d.sentences>=goals.dailySentences),
    totalLessons:Object.values(data.path||{}).filter(x=>x.done).length
  };
}
function setGoals(goals){
  const data=ensure();
  data.goals={...(data.goals||{}),...goals};
  save(data);
}
function resetDemo(){
  const data=ensure();
  data.days={};
  const now=new Date();
  for(let i=6;i>=0;i--){
    const d=new Date(now); d.setDate(now.getDate()-i);
    const k=todayKey(d);
    data.days[k]={date:k,lessons:i<3?1:0,minutes:i<3?10+i*2:0,sentences:i<3?20+i:0,videos:i===1?1:0,reviews:i===0?4:0,errors:i===0?1:0,events:[]};
  }
  save(data);
}
window.StudyTracker={todayKey,load,save,ensure,recordActivity,markLessonDone,isDone,day,lastNDays,streak,summary,setGoals,resetDemo};

/* ---- Otomatik aktivite izleyici ----
   Çalışma sayfaları açıldığında o günü "aktif" sayar ve geçirilen
   süreyi dakika olarak ekler. Böylece kullanıcı ekstra bir şey
   yapmadan günlük seri ve istatistikler dolar.
   Sayfa türü data-study-type ile veya dosya adından belirlenir.
*/
(function(){
  try{
    var path=(location.pathname||"").toLowerCase();
    var map=[
      ["index-app","sentence"],
      ["pv-practice","review"],
      ["practice","sentence"],
      ["teacher","lesson"],
      ["chat","lesson"],
      ["videopractice","video"],
      ["akilli-tekrar","review"],
      ["library","lesson"]
    ];
    var type=null;
    for(var i=0;i<map.length;i++){ if(path.indexOf(map[i][0])>=0){ type=map[i][1]; break; } }
    // Takip ve yol sayfaları sadece görüntüleme; aktivite saymaz
    if(path.indexOf("gunluk-takip")>=0 || path.indexOf("ogrenme-yolu")>=0) type=null;
    if(!type) return;

    var SK="dh-auto-visit-"+todayKey()+"-"+type;
    // Aynı gün + aynı tür için günde 1 kez "ders/cümle" say (çift saymayı önle)
    if(!sessionStorage.getItem(SK+"-counted")){
      try{ sessionStorage.setItem(SK+"-counted","1"); }catch(e){}
      if(type==="sentence") recordActivity("sentence",1,{auto:true});
      else if(type==="video") recordActivity("video",1,{auto:true});
      else if(type==="review") recordActivity("review",1,{auto:true});
      else recordActivity("lesson",1,{auto:true});
    }
    // Geçirilen süreyi dakika olarak ekle (sayfadan çıkarken)
    var start=Date.now();
    function flushMinutes(){
      try{
        var mins=Math.round((Date.now()-start)/60000);
        if(mins>=1){ recordActivity("minute",Math.min(mins,120),{auto:true}); start=Date.now(); }
      }catch(e){}
    }
    document.addEventListener("visibilitychange",function(){ if(document.hidden) flushMinutes(); });
    window.addEventListener("pagehide",flushMinutes);
    window.addEventListener("beforeunload",flushMinutes);
  }catch(e){}
})();
})();