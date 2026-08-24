/* dh-learning-coach.js — günlük hedef, tekrar ve zayıf konuyu tek öneride birleştirir. */
(function(global){
  "use strict";
  if(global.DHLearningCoach)return;
  var LABELS={tense:"zamanlar",article:"a / an / the",preposition:"edatlar",word_order:"kelime sırası",verb:"fiiller",spelling:"yazım",vocabulary:"kelime bilgisi",general:"cümle kurma"};
  function clamp(n,min,max){n=Number(n)||0;return Math.max(min,Math.min(max,n));}
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function dayKey(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  function read(key,fallback){try{var v=JSON.parse(localStorage.getItem(key)||"null");return v==null?fallback:v;}catch(e){return fallback;}}
  function topError(rows){var since=Date.now()-30*86400000,counts={};(rows||[]).forEach(function(r){if(r&&r.reviewed)return;var at=Date.parse(r&&r.updatedAt||r&&r.createdAt||0)||0;if(at<since)return;var type=r.primaryType||(r.types&&r.types[0])||r.type||"general";counts[type]=(counts[type]||0)+1;});return Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];}).map(function(k){return{type:k,count:counts[k]};})[0]||null;}
  function build(input){
    input=input||{};var day=input.day||{},goal=clamp(input.goal||5,1,499),sentences=clamp(day.sentences,0,9999),reviews=clamp(day.reviews,0,9999),talks=clamp(day.talks||day.chats||day.conversations,0,9999),due=clamp(input.due,0,9999);
    var done=Math.min(goal,sentences),remaining=Math.max(0,goal-done),pct=Math.round(done/goal*100),weak=input.weak||null,action;
    if(remaining===0) action={kind:"done",title:"Bugünkü cümle hedefini tamamladın",detail:sentences>goal?goal+" cümle hedefini "+(sentences-goal)+" cümle aştın. Bugün için zorunlu görev kalmadı.":"Günlük cümle hedefine ulaştın. Bugün için zorunlu görev kalmadı.",href:"",label:""};
    else if(due>0) action={kind:"review",title:"Önce bekleyen tekrarları tamamla",detail:due+" kayıt tekrar için hazır.",href:"./tekrar.html?plan=1",label:"Tekrara başla"};
    else if(weak&&weak.count>=3) action={kind:"weak",title:(LABELS[weak.type]||weak.type)+" konusunu güçlendir",detail:"Son 30 günde "+weak.count+" kez zorlandığın bu konu kısa bir telafi çalışmasını hak ediyor.",href:"./hata-defteri.html?odak="+encodeURIComponent(weak.type)+"&baslat=1",label:"Telafi çalışmasını aç"};
    else action={kind:"learn",title:"Günlük hedefine devam et",detail:remaining+" yeni cümle daha çalışınca bugünkü hedefin tamamlanacak.",href:"./index-app.html",label:"Cümle çalış"};
    return{goal:goal,sentences:sentences,reviews:reviews,due:due,remaining:remaining,pct:pct,weak:weak,action:action};
  }
  async function snapshot(){var tracker=read("dh-study-tracker-v1",{}),day=(tracker.days||{})[dayKey()]||{},goal=5;try{if(global.DHProfile&&DHProfile.hedef)goal=DHProfile.hedef();}catch(e){}var due=clamp(localStorage.getItem("dh-son-bekleyen"),0,9999),errors=[];try{if(global.LearningErrorDB&&LearningErrorDB.all)errors=await LearningErrorDB.all();}catch(e){}return build({day:day,goal:goal,due:due,weak:topError(errors)});}
  async function render(target){
    var el=typeof target==="string"?document.querySelector(target):target;if(!el)return null;var m=await snapshot(),a=m.action;
    var choices=[5,10,20,30].map(function(n){return'<option value="'+n+'"'+(n===m.goal?' selected':'')+'>'+n+' cümle</option>';}).join("");
    var actionButton=a.href&&a.label?'<a class="dh-btn dh-btn--ikincil" href="'+esc(a.href)+'">'+esc(a.label)+'</a>':'';
    el.innerHTML='<div class="dh-bolum-basligi">Bugünkü hedefin</div><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><strong>'+m.sentences+' / '+m.goal+' cümle</strong><span class="dh-cip">%'+m.pct+'</span></div><div role="progressbar" aria-label="Günlük cümle hedefi" aria-valuemin="0" aria-valuemax="'+m.goal+'" aria-valuenow="'+Math.min(m.sentences,m.goal)+'" style="height:8px;background:#ffffff12;border-radius:999px;overflow:hidden;margin:9px 0 14px"><span style="display:block;height:100%;width:'+m.pct+'%;background:linear-gradient(90deg,#10b981,#38bdf8)"></span></div><h2 style="font-size:var(--dh-fs-kontrol);margin:0 0 5px">'+esc(a.title)+'</h2><p class="dh-etiket" style="margin:0 0 12px">'+esc(a.detail)+'</p><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+actionButton+'<label class="dh-etiket" style="margin-left:auto">Hedef <select data-dh-goal aria-label="Günlük cümle hedefi" class="dh-input" style="width:auto;padding:8px">'+choices+'</select></label><button type="button" class="dh-btn dh-btn--sade" data-dh-goal-save>Kaydet</button></div><div data-dh-goal-status class="dh-etiket" role="status" aria-live="polite"></div>';
    el.classList.toggle("dh-tamamlandi-zemin",m.remaining===0);
    el.hidden=false;
    var save=el.querySelector("[data-dh-goal-save]"),select=el.querySelector("[data-dh-goal]"),status=el.querySelector("[data-dh-goal-status]");
    if(save)save.onclick=function(){var value=clamp(select&&select.value,1,499);if(global.DHProfile&&DHProfile.set){DHProfile.set({gunlukHedef:value,hedefDegisti:Date.now()});if(status)status.textContent="Günlük hedef kaydedildi.";try{global.dispatchEvent(new CustomEvent("dh-profile-changed",{detail:{gunlukHedef:value}}));}catch(e){}setTimeout(function(){render(el);},450);}else if(status)status.textContent="Hedef kaydedilemedi.";};
    return m;
  }
  global.DHLearningCoach={build:build,snapshot:snapshot,render:render,_topError:topError};
})(window);
