(function(){
"use strict";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const KEYS_LS = "groqApiKeys";
const STT = window.SpeechRecognition || window.webkitSpeechRecognition;
const DEFAULT_SCENARIO = {
  title:"Otel",
  subtitle:"İngilizce konuşma",
  level:"A2",
  role:"a friendly hotel receptionist",
  voiceGender:"male",
  opener:"Hello, welcome to our hotel. Do you have a reservation?",
  systemExtra:"You are role-playing as a friendly hotel receptionist at the front desk.",
  avatarDir:"assets/avatars_v3/hotel/",
  frames:{
    idle:"idle.webp", blink:"blink.webp", listen:"listen.webp",
    mouthA:"mouth-a.webp", mouthE:"mouth-e.webp", mouthI:"mouth-i.webp",
    mouthO:"mouth-o.webp", mouthU:"mouth-u.webp", mouthMBP:"mouth-mbp.webp",
    mouthFV:"mouth-fv.webp", mouthL:"mouth-l.webp", mouthTH:"mouth-th.webp",
    mouthSmall:"mouth-i.webp", mouthMedium:"mouth-e.webp", mouthOpen:"mouth-a.webp"
  },
  backHref:"chat.html",
  noKeyReply:"I can continue when you add a Groq API key. What would you like to practice?"
};
const Scenario = Object.assign({}, DEFAULT_SCENARIO, window.CHAT_SCENARIO || {});
Scenario.voiceGender = "male";
Scenario.frames = Object.assign({}, DEFAULT_SCENARIO.frames, (window.CHAT_SCENARIO && window.CHAT_SCENARIO.frames) || {});
/* KOÇ BEYNİ: öğretmen senaryosu mu? (koç planı/hedefi YALNIZ öğretmene aktarılır —
   otel resepsiyonisti öğrencinin çalışma planını bilirse rol bozulur) */
var __dhIsTeacher = /teacher|öğretmen|ogretmen/i.test((Scenario.title||"") + " " + (Scenario.role||""));
/* Koç balonundan "?focus=hataTürü" ile gelinirse bu oturum o hataya odaklanır */
var __dhFocus = ""; try{ __dhFocus = new URLSearchParams(location.search).get("focus") || ""; }catch(e){}
/* Antrenmandan gelen SOMUT hata bağlamı (cümle, yanlış, kural) — öğretmen boş
   karşılama yerine doğrudan o hatayı öğretmeye başlar */
var __dhTeach=null; try{
  var __tRaw=sessionStorage.getItem("dh-teach-focus");
  if(__tRaw){ __dhTeach=JSON.parse(__tRaw); if(!__dhTeach||Date.now()-(__dhTeach.t||0)>2*3600000) __dhTeach=null; }
}catch(e){}
/* Anlamsız plan etiketleri ("review", "tekrar"…) konu adı değildir — bunlarla
   "practice review" gibi boş bir açılış kurulmamalı. */
var __dhJunkFocus=/^(review|tekrar|practice|pratik|study|genel|general|plan|devam)$/i;
if(__dhFocus && __dhJunkFocus.test(__dhFocus)) __dhFocus="";
function __dhOpener(){
  if(__dhTeach&&__dhTeach.target){
    var head = __dhTeach.from==="coach"
      ? ("Koçun seni bugünün eksiğine çalışmaya gönderdi"+(__dhTeach.label?(" — konu: "+__dhTeach.label):"")+".\nDefterinden aldığım örnek:\n")
      : "Welcome back! I heard you struggled with this sentence in your drill:\n";
    return head
      +(__dhTeach.answer?("✗ "+__dhTeach.answer+"\n"):"")
      +"✓ "+__dhTeach.target
      +(__dhTeach.tip?("\n(Kural: "+__dhTeach.tip+")"):"")
      +"\nLet's master it together. First, you try: "
      +(__dhTeach.tr?("translate this into English — \""+__dhTeach.tr+"\""):"write the correct sentence yourself.");
  }
  if(__dhFocus) return "Your coach sent you to practice \""+__dhFocus+"\" with me. Let's work on it together! I'll give you short prompts — first, write any sentence using this pattern.";
  return Scenario.opener;
}
const State = {
  level: localStorage.getItem("chat:level:" + safeId(Scenario.title + ":" + (Scenario.avatarDir||""))) || Scenario.level || "A2",
  currentPartner: __dhOpener(),
  busy:false,
  speaking:false,
  history:[]
};
function safeId(s){ return String(s||"scenario").toLowerCase().replace(/[^a-z0-9]+/g,"-"); }
function $(id){ return document.getElementById(id); }
function activeAvatarDir(){
  const isTeacher = /teacher|öğretmen|ogretmen/i.test((Scenario.title||"") + " " + (Scenario.role||""));
  const selected = localStorage.getItem("selectedTeacherAvatar") || "teacher1";
  if(isTeacher && /^assets\/avatars_v3\/teacher/i.test(Scenario.avatarDir || "assets/avatars_v3/teacher1/")){
    return "assets/avatars_v3/" + selected + "/";
  }
  return (Scenario.avatarDir || "");
}
function asset(file){ return activeAvatarDir() + file; }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function getKeys(){ try{ return (JSON.parse(localStorage.getItem(KEYS_LS)||"[]")||[]).filter(Boolean); }catch{return [];} }
function ensureStorageReady(){
  return new Promise(function(resolve){
    if(typeof window.__dhStorageReady==="undefined" || window.__dhStorageReady || getKeys().length){ resolve(); return; }
    var done=false; function go(){ if(done)return; done=true; resolve(); }
    window.addEventListener("dh-storage-ready", go, {once:true});
    setTimeout(go, 1500);
  });
}
function saveKey(k){ const keys=getKeys(); if(!keys.includes(k)) keys.push(k); localStorage.setItem(KEYS_LS, JSON.stringify(keys)); }
async function groqChat(messages){
  const keys=getKeys();
  if(!keys.length) throw {code:"no-key"};
  let lastErr=null;
  for(const key of keys){
    try{
      const res=await fetch(GROQ_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model:GROQ_MODEL,messages,temperature:.7,max_tokens:320})});
      if(res.status===401){lastErr={code:"bad-key"};continue;}
      if(res.status===429){lastErr={code:"rate"};continue;}
      if(!res.ok){lastErr={code:"http",status:res.status};continue;}
      const data=await res.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    }catch(e){ lastErr={code:"network"}; }
  }
  throw lastErr || {code:"unknown"};
}

class PhotoAvatar{
  constructor(img){
    this.img=img;
    this.frames={
      idle:asset(Scenario.frames.idle),
      blink:asset(Scenario.frames.blink),
      listen:asset(Scenario.frames.listen),
      a:asset(Scenario.frames.mouthA),
      e:asset(Scenario.frames.mouthE),
      i:asset(Scenario.frames.mouthI),
      o:asset(Scenario.frames.mouthO),
      u:asset(Scenario.frames.mouthU),
      mbp:asset(Scenario.frames.mouthMBP),
      fv:asset(Scenario.frames.mouthFV),
      l:asset(Scenario.frames.mouthL),
      th:asset(Scenario.frames.mouthTH)
    };
    this.blinkTimer=null;
    this.talkTimer=null;
    this.endTimer=null;
    this.isBlinking=false;
    this.talkSeq=[];
    this.talkIndex=0;
  }
  init(){
    this.img.onerror=()=>{ this.img.onerror=null; this.img.src=this.frames.idle; };
    this.show(this.frames.idle);
    this.preload();
    this.scheduleBlink(1000);
  }
  preload(){ Object.values(this.frames).forEach(src=>{ const im = new Image(); im.src=src; }); }
  show(url){ this.img.src=url; }
  scheduleBlink(delay){
    clearTimeout(this.blinkTimer);
    this.blinkTimer=setTimeout(()=>this.blink(), delay || (2100 + Math.random()*1900));
  }
  blink(){
    if(State.speaking){
      this.scheduleBlink(1200 + Math.random()*1200);
      return;
    }
    this.isBlinking=true;
    this.show(this.frames.blink);
    setTimeout(()=>{
      this.isBlinking=false;
      if(!State.speaking) this.show(this.frames.idle);
      this.scheduleBlink();
    }, 330);
  }
  frameForChar(ch, next){
    ch = (ch || "").toLowerCase();
    next = (next || "").toLowerCase();

    if(ch === "t" && next === "h") return this.frames.th;
    if(/[oö0]/.test(ch)) return this.frames.o;
    if(/[uüwq]/.test(ch)) return this.frames.u;
    if(/[a]/.test(ch)) return this.frames.a;
    if(/[e]/.test(ch)) return this.frames.e;
    if(/[iııy]/.test(ch)) return this.frames.i;
    if(/[mnbp]/.test(ch)) return this.frames.mbp;
    if(/[fv]/.test(ch)) return this.frames.fv;
    if(/[l]/.test(ch)) return this.frames.l;
    if(/[.,!?;:\s]/.test(ch)) return this.frames.idle;
    return this.frames.i;
  }
  buildSequenceFromText(text){
    const s = String(text || "");
    const seq = [];
    for(let idx=0; idx<s.length; idx++){
      const ch = s[idx];
      const next = s[idx+1] || "";
      const frame = this.frameForChar(ch, next);
      if(frame) seq.push(frame);
      if(ch.toLowerCase()==="t" && next.toLowerCase()==="h") idx++;
    }
    return seq.filter(Boolean);
  }
  speakText(text, duration){
    clearInterval(this.talkTimer);
    clearTimeout(this.endTimer);
    State.speaking=true;
    this.talkSeq = this.buildSequenceFromText(text);
    if(!this.talkSeq.length){
      this.talkSeq = [this.frames.i, this.frames.e, this.frames.a, this.frames.o, this.frames.u, this.frames.mbp, this.frames.idle];
    }
    this.talkIndex=0;
    this.talkTimer=setInterval(()=>{
      if(this.isBlinking) return;
      this.show(this.talkSeq[this.talkIndex % this.talkSeq.length]);
      this.talkIndex++;
    }, 105);
    this.endTimer=setTimeout(()=>this.stop(), Math.max(1000,duration||1800));
  }
  stop(){
    clearInterval(this.talkTimer);
    clearTimeout(this.endTimer);
    State.speaking=false;
    if(!this.isBlinking) this.show(this.frames.listen);
    setTimeout(()=>{ if(!State.speaking && !this.isBlinking) this.show(this.frames.idle); }, 260);
    this.scheduleBlink(1100);
  }
}

function buildUI(){
  const root=document.getElementById("chatApp") || document.body.appendChild(document.createElement("div"));
  root.innerHTML=`<div class="chat-shell"><div class="chat-top"><a class="back-btn" href="${Scenario.backHref||'chat.html'}">←</a><div class="chat-title-wrap"><div class="chat-title">${esc(Scenario.title)}</div><div class="chat-sub" id="subtitle">${esc(Scenario.subtitle)} · ${State.level}</div></div><button class="level-pill" id="levelBtn" type="button">${State.level}</button></div><div class="avatar-stage"><img id="avatarImg" alt="Fotoğraflı konuşan avatar"></div><div class="panel"><div class="chat-history" id="chatHistory"></div><div id="taskBar" style="font-size:11.5px;color:#9fb3d9;padding:4px 8px;border-top:1px dashed #ffffff18"></div><div class="input-row"><div class="input-wrap"><textarea id="textIn" class="text-in" rows="1" placeholder="Yaz ya da 🎙 ile konuş..."></textarea></div><button class="icon-fab suggest-btn" id="suggestBtn" type="button" title="Sen öner">💡</button><button class="icon-fab suggest-btn" id="errSaveBtn" type="button" title="Bu konuşmadaki hatalarımı deftere kaydet" style="background:#b45309">📝</button><button class="icon-fab suggest-btn" id="autoBtn" type="button" title="Eller serbest: avatar susunca mikrofon otomatik açılır" style="background:#334155">🔁</button><button class="icon-fab mic-btn" id="micBtn" type="button">🎙</button><button class="icon-fab send-btn" id="sendBtn" type="button">➤</button></div></div></div><div class="sheet" id="explainSheet"><div class="sheet-card"><h3>TR Açıkla</h3><p id="explainText">Yükleniyor...</p><div class="sheet-btns"><button class="sheet-btn primary" id="closeExplain">Kapat</button></div></div></div><div class="sheet" id="levelSheet"><div class="sheet-card"><h3>Seviye seç</h3><div class="sheet-btns"><button class="sheet-btn levelOpt" data-level="A1">A1</button><button class="sheet-btn levelOpt" data-level="A2">A2</button><button class="sheet-btn levelOpt" data-level="B1">B1</button><button class="sheet-btn levelOpt" data-level="B2">B2</button><button class="sheet-btn levelOpt" data-level="C1">C1</button></div><div class="sheet-btns"><button class="sheet-btn primary" id="closeLevel">Kapat</button></div></div></div><div class="sheet" id="keySheet"><div class="sheet-card"><h3>Groq API anahtarı</h3><p>Konuşma için Groq API anahtarını ekle. Birden fazla anahtar saklanabilir.</p><input id="keyInput" type="text" placeholder="gsk_..." autocomplete="off"><div class="sheet-btns"><button class="sheet-btn primary" id="saveKey">Kaydet</button><button class="sheet-btn" id="closeKey">Kapat</button></div><div class="note" id="keyNote">Anahtar bu tarayıcıda saklanır.</div></div></div>`;
}
function addBubble(role, text, options){
  const hist = $("chatHistory");
  const el = document.createElement("div");
  el.className = "bubble " + (role === "user" ? "user" : "assistant");
  if(options && options.typing){
    el.className = "bubble assistant typing";
    el.id = "typingBubble";
    el.textContent = "Düşünüyor...";
  }else{
    const t = document.createElement("div");
    t.className = "bubble-text";
    t.textContent = text;
    el.appendChild(t);
    if(role !== "user"){
      const actions = document.createElement("div");
      actions.className = "bubble-actions";
      const listen = document.createElement("button");
      listen.className = "bubble-btn";
      listen.type = "button";
      listen.textContent = "🔊 Dinle";
      listen.onclick = () => speakText(text);
      const tr = document.createElement("button");
      tr.className = "bubble-btn";
      tr.type = "button";
      tr.textContent = "TR Açıkla";
      tr.onclick = () => explainText(text);
      actions.appendChild(listen);
      actions.appendChild(tr);
      el.appendChild(actions);
    }
  }
  hist.appendChild(el);
  scrollHistory();
  return el;
}
function scrollHistory(){ const hist = $("chatHistory"); if(hist) hist.scrollTop = hist.scrollHeight; }
function removeTyping(){ const t = $("typingBubble"); if(t) t.remove(); }
function levelGuide(){
  return ({A1:"The user is beginner A1. Use very short and easy sentences.",A2:"The user is elementary A2. Use simple and common words.",B1:"The user is intermediate B1. Use natural but clear English.",B2:"The user is upper intermediate B2. Speak naturally but keep it concise.",C1:"The user is advanced C1. Use fluent natural English, still keep replies concise."})[State.level] || "Use clear natural English.";
}

/* ---- ÖĞRENCİ PROFİLİ: uygulama verisinden AI'ya kısa özet (≤150 kelime) ---- */
async function dhBuildProfile(){
  var p=[];
  try{ // streak + bugün
    var tr=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}, days=Object.keys(tr.days||{}).sort();
    var streak=0, d=new Date();
    for(;;){ var key=d.toISOString().slice(0,10); if((tr.days||{})[key]){streak++; d.setDate(d.getDate()-1);} else break; }
    if(streak) p.push("Seri: "+streak+" gün.");
  }catch(e){}
  try{ // kelime/cümle durumu
    var m=JSON.parse(localStorage.getItem("dh-progress-mirror-v1")||"{}")||{}, w1=0,w2=0,s1=0,s2=0;
    for(var k in m){ var st=m[k]&&m[k][0]; if(k.indexOf("word:")===0){ if(st===1)w1++; if(st===2)w2++; } if(k.indexOf("sentence:")===0){ if(st===1)s1++; if(st===2)s2++; } }
    p.push("Kelime: "+w2+" öğrenildi/"+w1+" çalışılıyor. Cümle: "+s2+"/"+s1+".");
  }catch(e){}
  try{ // hata etiketleri (ilk 3)
    if(window.LearningErrorDB&&LearningErrorDB.all){
      var errs=await LearningErrorDB.all(), tally={};
      (errs||[]).slice(-60).forEach(function(r){ var t=r&&r.type; if(t) tally[t]=(tally[t]||0)+1; });
      var top=Object.keys(tally).sort(function(a,b){return tally[b]-tally[a]}).slice(0,3);
      if(top.length) p.push("Sık hata türleri: "+top.join(", ")+".");
      var now30=Date.now(), c15=now30-15*86400000, c30=now30-30*86400000, o30={}, r30={};
      errs.forEach(function(r){ var ts=r.ts||0; if(ts<c30) return; var ty=Array.isArray(r.types)&&r.types.length?r.types:(r.type?[r.type]:[]);
        ty.forEach(function(t){ if(ts>=c15) r30[t]=(r30[t]||0)+1; else o30[t]=(o30[t]||0)+1; }); });
      var trend30=[]; Object.keys(Object.assign({},o30,r30)).forEach(function(t){ var o=o30[t]||0,r=r30[t]||0; if(o&&r<o) trend30.push(t+" iyileşiyor"); else if(r>=2&&r>o) trend30.push(t+" kötüleşiyor"); });
      if(trend30.length) p.push("Son 30 gün eğilimi: "+trend30.slice(0,2).join(", ")+".");
    }
  }catch(e){}
  try{ // inatçı cümleler (ilk 3) + vadesi gelen
    var due=0, leech=[];
    await new Promise(function(res){ try{
      var r=indexedDB.open("sentence-mode",1);
      r.onsuccess=function(){ var db=r.result;
        try{ var req=db.transaction("kv","readonly").objectStore("kv").openCursor(), now=Date.now();
          req.onsuccess=function(e){ var c=e.target.result;
            if(c){ var kk=String(c.key), v=c.value||{};
              if(kk.indexOf("srs:")===0){ if((v.due||0)<=now) due++; if((v.lapses||0)>=3&&leech.length<3) leech.push(kk.slice(4)); }
              c.continue();
            } else { db.close(); res(); } };
          req.onerror=function(){ db.close(); res(); };
        }catch(e2){ try{db.close()}catch(_){ } res(); } };
      r.onerror=function(){ res(); };
    }catch(e3){ res(); } });
    if(due) p.push("Bugün tekrar için seçilen porsiyon: "+Math.min(due,15)+"."+(due>15?" (Toplam birikmiş "+due+" — KURAL: bu toplamı kullanıcıya söyleme, günde 15 tekrarın yeterli olduğunu vurgula.)":""));
    if(leech.length) p.push("İnatçı (öğrenemediği) cümleler: "+leech.join(" | ")+".");
  }catch(e){}
  try{ /* KOÇ BEYNİ → öğretmene: günün planı + haftalık hedef */
    if(__dhIsTeacher){
      var kDay=new Date().toISOString().slice(0,10);
      var kPlan=null; try{ kPlan=JSON.parse(localStorage.getItem("dh-koc-plan-"+kDay)||"null"); }catch(e){}
      if(kPlan && kPlan.focus){
        var kDone={}; try{ kDone=JSON.parse(localStorage.getItem("dh-koc-steps-done-"+kDay)||"{}")||{}; }catch(e){}
        var kSteps=(kPlan.steps||[]).map(function(s){
          var pg=String(s.href||"").split("?")[0];
          return (kDone[pg]?"✅":"⬜")+" "+(s.label||pg);
        }).join("; ");
        p.push("BUGÜNÜN KOÇ PLANI — Odak: "+kPlan.focus+"."+(kPlan.note?(" Not: "+kPlan.note+"."):"")+(kSteps?(" Adımlar: "+kSteps+"."):""));
      }
      var kGoal=null; try{ kGoal=JSON.parse(localStorage.getItem("dh-koc-goal")||"null"); }catch(e){}
      if(kGoal && kGoal.type){
        var kKalan=Math.max(0, Math.ceil(((kGoal.setAt||Date.now())+7*86400000-Date.now())/86400000));
        p.push("HAFTALIK HEDEF: '"+kGoal.type+"' hatasını azaltmak (kalan "+kKalan+" gün).");
      }
    }
  }catch(e){}
  return p.join(" ").slice(0, __dhIsTeacher ? 1500 : 900);
}

var __dhProfile=""; dhBuildProfile().then(function(t){ __dhProfile=t; });
var __dhTasks=(window.Scenario&&Scenario.tasks)||["Selamlaş ve kendini kısaca tanıt","Senaryonun ana amacını gerçekleştir","Karşındakine en az bir soru sor"];
var __dhTaskDone=__dhTasks.map(function(){return false;});
function dhRenderTasks(){
  var el=document.getElementById("taskBar"); if(!el) return;
  el.innerHTML="🎯 "+__dhTasks.map(function(t,i){ return '<span style="opacity:'+(__dhTaskDone[i]?1:.6)+'">'+(__dhTaskDone[i]?"✅":"⬜")+" "+t+"</span>"; }).join("  ·  ");
  if(__dhTaskDone.every(Boolean)) el.innerHTML+=' <b style="color:#4ade80">— 🎉 Görevler tamam!</b>';
}
function dhStripTasks(reply){
  return String(reply||"").replace(/\[TASK_DONE:(\d)\]/g, function(_,n){
    var i=(+n)-1; if(__dhTaskDone[i]===false){ __dhTaskDone[i]=true; setTimeout(dhRenderTasks,50); }
    return "";
  }).trim();
}
function systemPrompt(){
  return [Scenario.systemExtra || ("You are role-playing as " + Scenario.role + "."), levelGuide(), "Always reply in English unless the user explicitly asks for Turkish.", "Keep replies short: 1 to 3 sentences.", "Ask a follow-up question to keep the conversation going.", "If the user makes a clear mistake, gently model the correct version without lecturing.", "No emojis.",
    (__dhProfile?("\n[STUDENT PROFILE — use this to personalize, in Turkish data]\n"+__dhProfile+"\nWhen the student repeats one of their known error patterns, gently correct it and briefly note it is a frequent mistake of theirs. Naturally create situations that make the student use the patterns they struggle with."):""),
    (__dhIsTeacher?"\n[COACH ROLE] You are not only a conversation partner but also the student's personal coach. The profile above includes their daily coach plan (BUGÜNÜN KOÇ PLANI) and weekly goal (HAFTALIK HEDEF). In your FIRST reply, acknowledge their streak, plan or goal in ONE short friendly sentence, then continue teaching. Steer the practice toward the weekly goal and the unfinished (⬜) plan steps. If they completed steps (✅), congratulate briefly.":""),
    (__dhTeach&&__dhTeach.target?("\n[EXACT ERROR CONTEXT] The student's own mistake: wrong=\""+(__dhTeach.answer||"")+"\" correct=\""+__dhTeach.target+"\" (TR: \""+(__dhTeach.tr||"")+"\"). Rule: "+(__dhTeach.tip||"")+". Start THIS session by teaching exactly this, then create 2-3 similar practice prompts."):""),
    /* Koç birden fazla gerçek hata yolladıysa tüm oturum bu listeden kurulur —
       öğretmen malzemesiz kalıp genel sorulara kaçmasın. */
    (__dhTeach&&__dhTeach.items&&__dhTeach.items.length>1?("\n[SESSION MATERIAL — the student's real mistakes from their error notebook"+(__dhTeach.label?(", topic: "+__dhTeach.label):"")+"]\n"
      +__dhTeach.items.map(function(it,i){ return (i+1)+") wrong=\""+(it.answer||"")+"\" correct=\""+it.target+"\""+(it.tr?(" (TR: \""+it.tr+"\")"):""); }).join("\n")
      +"\nWork through these one by one: for each, make the student produce the correct sentence themselves, correct them, give ONE short Turkish tip, then move to the next. Do NOT ask generic questions while this list is unfinished."):""),
    (__dhFocus?("\n[FOCUS DRILL] The coach sent the student to you specifically to work on this error type: \""+__dhFocus+"\". Build most of this session around it: create short prompts that force the student to produce this pattern, correct their attempts, and give ONE short Turkish tip when they slip. Mention at the start, in one sentence, that you two will practice this together."):""),
    "\n[TASKS] The student must complete these in-scenario tasks: "+__dhTasks.map(function(t,i){return (i+1)+") "+t;}).join(" ")+" Weave them naturally into the conversation. When the user GENUINELY completes task N, append the marker [TASK_DONE:N] at the very end of your reply. Never mention the markers or tasks mechanically."
  ].join("\n");
}
function estimateDuration(text){ const n=Array.from(String(text||"")).length; return Math.max(1100, Math.min(12000, n * 82)); }

let cachedVoices = [];
function refreshVoices(){ cachedVoices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : []; }
/* Mobilde getVoices() ilk çağrıda boş döner; sesler asenkron yüklenir.
   voicesReady, sesler gelene kadar bekleyip callback çağırır. */
let __voicesReadyCbs = [];
function whenVoicesReady(cb){
  refreshVoices();
  if(cachedVoices.length){ cb(); return; }
  __voicesReadyCbs.push(cb);
  // güvence: 1.2sn sonra yine de dene (bazı tarayıcılar olayı geç/hiç atmaz)
  setTimeout(function(){ refreshVoices(); if(cachedVoices.length){ var q=__voicesReadyCbs; __voicesReadyCbs=[]; q.forEach(function(f){ try{f();}catch(e){} }); } }, 1200);
}
if(typeof speechSynthesis !== "undefined"){
  refreshVoices();
  speechSynthesis.onvoiceschanged = function(){
    refreshVoices();
    if(__voicesReadyCbs.length){ var q=__voicesReadyCbs; __voicesReadyCbs=[]; q.forEach(function(f){ try{f();}catch(e){} }); }
  };
}
function avatarVoiceKey(){ return "dh-voice:" + (activeAvatarDir()||"default").replace(/[^a-z0-9]+/gi,"-"); }
try{ window.avatarVoiceKey = avatarVoiceKey; }catch(e){}
function pickVoice(){
  refreshVoices();
  const voices = cachedVoices.filter(v => /^en/i.test(v.lang || ""));
  const allVoices = cachedVoices.slice();
  if(!allVoices.length){ dhVoiceDebug("SESLER BOŞ (getVoices boş döndü) → varsayılana düşecek"); return null; }
  // TEK DOĞRU KAYNAK: ses ayar sayfası (ses-secim.html).
  const _key = avatarVoiceKey();
  // 1) Bu karakter için kayıtlı seçim
  try{
    const saved = JSON.parse(localStorage.getItem(_key)||"null");
    if(saved && saved.name){
      const f = allVoices.find(v => v.name===saved.name);
      if(f){ dhVoiceDebug("✅ karakter sesi: "+saved.name+" (anahtar: "+_key+")"); return f; }
      dhVoiceDebug("⚠️ karakter kaydı VAR ("+saved.name+") ama cihazda o ses YOK → global'e düşüyor");
    } else {
      dhVoiceDebug("karakter kaydı yok (anahtar: "+_key+") → global'e bakılıyor");
    }
  }catch(e){}
  // 2) Karakter-özel yoksa: GLOBAL ayar (tüm karakterler için)
  try{
    const gv = JSON.parse(localStorage.getItem("dh-voice:__global__")||"null");
    if(gv && gv.name){
      const f2 = allVoices.find(v => v.name===gv.name);
      if(f2){ dhVoiceDebug("🌐 global ses: "+gv.name); return f2; }
      dhVoiceDebug("⚠️ global kayıt VAR ("+gv.name+") ama cihazda o ses YOK → varsayılana düşüyor");
    }
  }catch(e){}
  // 3) Hiç ayar yoksa: nötr İngilizce ses (cinsiyet önyargısı YOK — ayar sayfası tek karar mercii)
  const pool = voices.length ? voices : allVoices;
  dhVoiceDebug("varsayılan ses: "+((pool[0]&&pool[0].name)||"?"));
  return pool[0] || null;
}
/* Geçici teşhis: sohbette hangi sesin neden seçildiğini ekrana yazar.
   localStorage'da dh-voice-debug="1" ise görünür. Kapatmak için silinir. */
function dhVoiceDebug(msg){
  try{
    if(localStorage.getItem("dh-voice-debug")!=="1") return;
    var box=document.getElementById("dhVoiceDebugBox");
    if(!box){
      box=document.createElement("div"); box.id="dhVoiceDebugBox";
      box.style.cssText="position:fixed;left:8px;right:8px;bottom:8px;z-index:999999;background:#071226;color:#9fe8b0;border:1px solid #2e7d66;border-radius:10px;padding:10px 12px;font:12px/1.4 monospace;max-height:38vh;overflow:auto;white-space:pre-wrap";
      var x=document.createElement("button"); x.textContent="✕"; x.style.cssText="position:absolute;top:4px;right:6px;background:#334155;color:#fff;border:0;border-radius:6px;padding:2px 8px";
      x.onclick=function(){ box.remove(); try{localStorage.removeItem("dh-voice-debug");}catch(e){} };
      box.appendChild(x);
      document.body.appendChild(box);
    }
    var line=document.createElement("div"); line.textContent="🔊 "+msg;
    box.appendChild(line);
  }catch(e){}
}
try{ window.dhVoiceDebug = dhVoiceDebug; }catch(e){}
function avatarVoicePrefs(){
  try{ return JSON.parse(localStorage.getItem(avatarVoiceKey())||"null") || {}; }catch(e){ return {}; }
}

let avatar; let speechRun=0;
/* 🔤 KARMA DİL OKUMA: öğretmen Türkçe ipucu + İngilizce örnek karışık konuşur.
   Eski kod her şeyi en-US'a sabitliyordu ("Türkçe okumayı kesin engelle") —
   bu sefer tersi sorun çıkmıştı: Türkçe cümleler İngilizce aksanla okunuyordu.
   Doğrusu: cümle cümle dil tespiti — Türkçe karakter/kelime içeren parça TR
   sesiyle, gerisi İngilizce sesiyle sırayla okunur. */
function isTrChunk(s){
  s=String(s||"");
  if(/[ğüşöçıİĞÜŞÖÇ]/.test(s)) return true;
  return /\b(şimdi|şöyle|çünkü|doğru|yanlış|anlam|cümle|örnek|kural|yani|ipucu|harika|aferin|dene|deneyelim|hadi|tekrar|söyle|güzel|evet|hayır|bakalım|Türkçe)\b/i.test(s);
}
function splitMixedSpeech(text){
  var parts=String(text||"").replace(/\*\*/g,"").split(/\n+|(?<=[.!?…])\s+|(?<=:)\s+/).map(function(x){return x.trim();}).filter(Boolean);
  var chunks=[];
  parts.forEach(function(p){
    var lang=isTrChunk(p)?"tr-TR":"en-US";
    var last=chunks[chunks.length-1];
    if(last && last.lang===lang) last.text+=" "+p;   // ardışık aynı dilde: birleştir (akıcılık)
    else chunks.push({text:p, lang:lang});
  });
  return chunks.length?chunks:[{text:String(text||""), lang:"en-US"}];
}
function pickTrVoice(){
  refreshVoices();
  var tr=cachedVoices.filter(function(v){ return /^tr/i.test(v.lang||""); });
  return tr[0] || cachedVoices.find(function(v){ return /turkish|türk/i.test(v.name||""); }) || null;
}
function speakText(text){
  text=String(text||"").trim();
  if(!text) return;
  try{ if(typeof dhVoiceDebug==="function") dhVoiceDebug("speakText çağrıldı → ses seçiliyor…"); }catch(e){}
  const run=++speechRun;
  try{speechSynthesis.cancel();}catch(e){}
  const duration=estimateDuration(text);
  avatar.speakText(text, duration+300);
  const vp=avatarVoicePrefs();
  const chunks=splitMixedSpeech(text);
  let ci=0;
  function finishAll(){
    if(run!==speechRun) return;
    avatar.stop();
    if(window.__dhAuto){ setTimeout(function(){ try{ var mb=document.getElementById("micBtn"); if(mb&&!mb.classList.contains("listening")) mb.click(); }catch(e){} }, 400); }
  }
  function speakNext(){
    if(run!==speechRun) return;              // yeni konuşma başladı: bu kuyruk iptal
    if(ci>=chunks.length){ finishAll(); return; }
    const c=chunks[ci++];
    try{
      const u=new SpeechSynthesisUtterance(c.text);
      if(c.lang==="tr-TR"){
        const tv=pickTrVoice();
        if(tv) u.voice=tv;
        u.lang="tr-TR";
        u.rate=vp.rate || .96;
        u.pitch=1;                            // TR seslerinde düşük pitch doğal durmuyor
      } else {
        const voice=pickVoice();
        if(voice){ u.voice=voice; u.lang=voice.lang || "en-US"; }
        else { u.lang="en-US"; }
        u.rate=vp.rate || .96;
        u.pitch=vp.pitch != null ? vp.pitch : .78;
      }
      u.__dhMixed=true;                       // global karma-dil patch'i atla (biz zaten böldük)
      u.__longTTSAvatarSync=true;             // long-avatar patch'ini de atla
      let done=false;
      function go(){ if(done) return; done=true; clearTimeout(wd); setTimeout(speakNext,60); }
      var wd=setTimeout(go, Math.max(4000, c.text.length*80)+1500);  // onend gelmezse takılma
      u.onend=go; u.onerror=go;
      speechSynthesis.speak(u);
    }catch(e){ speakNext(); }
  }
  try{ whenVoicesReady(function(){ try{ speakNext(); }catch(e){ setTimeout(function(){ if(run===speechRun) avatar.stop(); }, duration); } }); }
  catch(e){ setTimeout(function(){ if(run===speechRun) avatar.stop(); }, duration); }
}
async function explainText(text){
  $("explainSheet").classList.add("open");
  $("explainText").textContent="Yükleniyor...";
  if(!getKeys().length){
    $("explainText").textContent="API anahtarı eklenmemiş. Bu bölümde normalde İngilizce cümlenin Türkçe anlamı ve kısa dil bilgisi açıklaması gösterilir.";
    return;
  }
  try{
    const reply=await groqChat([{role:"system", content:"You are a Turkish-speaking English teacher. Translate the sentence into Turkish and briefly explain key vocabulary or grammar. Maximum 3 short Turkish sentences."},{role:"user", content:text}]);
    $("explainText").textContent=reply || "Açıklama alınamadı.";
  }catch(e){ $("explainText").textContent="Açıklama alınamadı. API anahtarını kontrol et veya tekrar dene."; }
}
async function analyzeChatErrors(){
  const b=$("errSaveBtn"); if(!b) return;
  const userMsgs=State.history.filter(m=>m.role==="user").map(m=>m.content).slice(-12);
  if(!userMsgs.length){ b.textContent="—"; setTimeout(()=>b.textContent="📝",1200); return; }
  if(!(window.DHProviders&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey())){ alert("API anahtarı yok."); return; }
  b.textContent="⏳";
  try{
    const sys="You are an English error analyzer for a Turkish learner. Given the learner's chat messages, list ONLY real grammar/vocabulary errors as JSON array: [{\"wrong\":\"...\",\"correct\":\"...\",\"tr\":\"kısa Türkçe açıklama\"}]. Max 5. If no errors return []. JSON only, no prose.";
    const out=await DHProviders.chat([{role:"system",content:sys},{role:"user",content:userMsgs.join("\n")}]);
    let arr=[]; try{ arr=JSON.parse(String(out).replace(/```json|```/g,"").trim()); }catch(e){}
    if(!Array.isArray(arr)) arr=[];
    if(arr.length && window.LearningErrorDB && LearningErrorDB.bulkMerge){
      const now=Date.now();
      const recs=arr.slice(0,5).map((r,i)=>({
        id:"chat_"+now+"_"+i, sentenceId:"", type:"chat-grammar", source:"chat",
        sentenceEN:String(r.correct||""), sentenceTR:String(r.tr||""),
        answer:String(r.wrong||""), score:40, ts:now
      }));
      await LearningErrorDB.bulkMerge(recs);
      try{ window.dispatchEvent(new Event("learning-errors-cleared")); }catch(e){}
    }
    b.textContent="✓"+arr.length;
    if(arr.length===0 && userMsgs.length>=6 && !window.__dhLevelTipShown){
      window.__dhLevelTipShown=true;
      var order=["A1","A2","B1","B2","C1"], nx=order[order.indexOf(State.level)+1];
      if(nx && confirm("Bu oturumda hiç hata bulunamadı — seviyeyi "+nx+" yapalım mı?")){
        var ob=document.querySelector('.levelOpt[data-level="'+nx+'"]'); if(ob) ob.click();
      }
    }
  }catch(e){ b.textContent="⚠"; }
  setTimeout(()=>{ b.textContent="📝"; },2000);
}

document.addEventListener("click",function(e){
  if(e.target&&e.target.id==="errSaveBtn") analyzeChatErrors();
  if(e.target&&e.target.id==="autoBtn"){ window.__dhAuto=!window.__dhAuto; e.target.style.background=window.__dhAuto?"#16a34a":"#334155"; }
});
setTimeout(dhRenderTasks, 800);
async function suggestReply(){
  if(State.busy) return;
  const input=$("textIn");
  const sBtn=$("suggestBtn");
  await ensureStorageReady();
  if(!getKeys().length){ $("keySheet").classList.add("open"); return; }
  const prev=sBtn ? sBtn.textContent : "";
  if(sBtn){ sBtn.disabled=true; sBtn.textContent="⏳"; }
  try{
    // Sohbet bağlamına göre, kullanıcının SÖYLEYEBİLECEĞİ uygun bir İngilizce cevap öner.
    const sys = systemPrompt()
      + "\n\nNOW: The USER is stuck and wants a suggested reply. Based on the conversation so far and the partner's last message, write ONE natural English sentence that the USER (the learner) could say next. "
      + "Match the learner's level ("+State.level+"): keep it simple and appropriate. "
      + "Reply with ONLY that single English sentence — no quotes, no Turkish, no explanation.";
    const messages=[{role:"system",content:sys},{role:"assistant",content:__dhOpener()},...State.history.slice(-10),
      {role:"user",content:"(Suggest what I could say next — English only, one sentence.)"}];
    let reply=await groqChat(messages);
    reply=String(reply||"").trim().replace(/^["'“”]+|["'“”]+$/g,"").split("\n")[0].trim();
    if(reply){
      input.value=reply;
      input.dispatchEvent(new Event("input"));
      input.focus();
      // imleci sona al
      try{ input.setSelectionRange(reply.length, reply.length); }catch(e){}
    }
  }catch(e){
    // sessiz: öneri alınamazsa kutuyu boş bırak
  }finally{
    if(sBtn){ sBtn.disabled=false; sBtn.textContent=prev||"💡"; }
  }
}

async function sendUser(){
  const input=$("textIn");
  const text=input.value.trim();
  if(!text || State.busy) return;
  State.busy=true;
  $("sendBtn").disabled=true;
  addBubble("user", text);
  input.value="";
  input.style.height="auto";
  addBubble("assistant", "", {typing:true});

  await ensureStorageReady();
  if(!getKeys().length){
    removeTyping();
    $("keySheet").classList.add("open");
    State.currentPartner = Scenario.noKeyReply;
    addBubble("assistant", State.currentPartner);
    speakText(State.currentPartner);
    State.busy=false;
    $("sendBtn").disabled=false;
    return;
  }
  try{
    State.history.push({role:"user",content:text});
    // GÜVENCE: "soru sor" türü görevler AI'nin [TASK_DONE] işaretine güvenmeden de tespit edilir
    try{
      var isQuestion = /\?\s*$/.test(text.trim()) || /^\s*(is|are|do|does|did|can|could|will|would|what|where|when|why|how|who|which)\b/i.test(text.trim());
      if(isQuestion){
        __dhTasks.forEach(function(t,i){
          if(!__dhTaskDone[i] && /soru\s*sor/i.test(t)){ __dhTaskDone[i]=true; setTimeout(dhRenderTasks,50); }
        });
      }
    }catch(e){}
    const messages=[{role:"system",content:systemPrompt()},{role:"assistant",content:__dhOpener()},...State.history.slice(-10)];
    const reply=await groqChat(messages);
    removeTyping();
    State.currentPartner=dhStripTasks(reply) || "Could you please say that again?";
    try{
      window.dhLogActivity && window.dhLogActivity(
        "💬 Sohbet: \""+(text||"").slice(0,60)+"\"",
        "chat",
        { target:Scenario&&Scenario.title, answer:text, module:(Scenario&&Scenario.title)||"", score:null,
          // AI'nin cevabı + hangi görevlerin o an tamamlanmış olduğu da saklanır (derin analiz için)
          types:(function(){ try{ return __dhTasks.map(function(t,i){ return __dhTaskDone[i]?("✓"+t):null; }).filter(Boolean); }catch(e){ return undefined; } })()
        }
      );
      // AI'nin cevabını AYRI bir kayıt olarak da tut (kullanıcı mesajından ayrı, karışmasın)
      window.dhLogActivity && window.dhLogActivity(
        "🤖 Yanıt: \""+String(State.currentPartner||"").slice(0,80)+"\"", "chat-reply",
        { target:State.currentPartner, module:(Scenario&&Scenario.title)||"" }
      );
      window.dhBumpDailyTracker && window.dhBumpDailyTracker("lesson");
      window.dhCoachMarkStepDone && window.dhCoachMarkStepDone(location.pathname.split("/").pop()||"chat.html");
      try{ window.dhCoachChainBump && window.dhCoachChainBump(); }catch(e){}
    }catch(e){}
    State.history.push({role:"assistant",content:State.currentPartner});
    addBubble("assistant", State.currentPartner);
    speakText(State.currentPartner);
  }catch(e){
    removeTyping();
    let msg="Bir sorun oldu. Tekrar deneyelim.";
    if(e.code==="rate") msg="API limiti doldu. Biraz sonra tekrar dene.";
    else if(e.code==="bad-key") msg="API anahtarı geçersiz görünüyor.";
    else if(e.code==="network") msg="İnternet bağlantısı kontrol edilmeli.";
    State.currentPartner=msg;
    addBubble("assistant", msg);
  }finally{
    State.busy=false;
    $("sendBtn").disabled=false;
  }
}
function setupEvents(){
  $("closeExplain").onclick=()=>$("explainSheet").classList.remove("open");
  $("levelBtn").onclick=()=>$("levelSheet").classList.add("open");
  $("closeLevel").onclick=()=>$("levelSheet").classList.remove("open");
  document.querySelectorAll(".levelOpt").forEach(btn=>btn.onclick=()=>{
    State.level=btn.dataset.level;
    localStorage.setItem("chat:level:"+safeId(Scenario.title + ":" + (Scenario.avatarDir||"")), State.level);
    $("levelBtn").textContent=State.level;
    $("subtitle").textContent=Scenario.subtitle + " · " + State.level;
    $("levelSheet").classList.remove("open");
  });
  $("textIn").addEventListener("input",e=>{ e.target.style.height="auto"; e.target.style.height=Math.min(120,e.target.scrollHeight)+"px"; });
  $("textIn").addEventListener("keydown",e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendUser(); } });
  $("sendBtn").onclick=sendUser;
  const sBtn=$("suggestBtn");
  if(sBtn) sBtn.onclick=suggestReply;
  if(STT){
    let rec=null,listening=false;
    $("micBtn").onclick=()=>{
      if(listening && rec){ rec.stop(); return; }
      rec=new STT();
      rec.lang="en-US";
      rec.interimResults=false;
      rec.maxAlternatives=1;
      rec.onstart=()=>{listening=true; $("micBtn").classList.add("listening");};
      rec.onerror=()=>{};
      rec.onresult=ev=>{ $("textIn").value=ev.results[0][0].transcript; $("textIn").dispatchEvent(new Event("input")); };
      rec.onend=()=>{ listening=false; $("micBtn").classList.remove("listening"); if($("textIn").value.trim()) sendUser(); };
      try{ rec.start(); }catch(e){}
    };
  }else{ $("micBtn").disabled=true; }
  $("closeKey").onclick=()=>$("keySheet").classList.remove("open");
  $("saveKey").onclick=()=>{
    const k=$("keyInput").value.trim();
    if(!k || !k.startsWith("gsk_")){
      $("keyNote").textContent="Anahtar gsk_ ile başlamalı.";
      $("keyNote").className="note bad";
      return;
    }
    saveKey(k);
    $("keyNote").textContent="Anahtar kaydedildi.";
    $("keyNote").className="note";
    $("keySheet").classList.remove("open");
  };
}
function boot(){
  buildUI();
  avatar=new PhotoAvatar($("avatarImg"));
  avatar.init();
  setupEvents();
  addBubble("assistant", State.currentPartner);
  setTimeout(()=>speakText(State.currentPartner), 450);
}
document.addEventListener("DOMContentLoaded", boot);
})();