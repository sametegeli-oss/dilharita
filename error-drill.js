/* error-drill.js v2 — 🏋️ HATA ANTRENMANI (profesyonel eğitim döngüsü)
   Her hata için 3 aşamalı MİKRO DÖNGÜ:
     📖 DERS      → hata kartı: yanlış/doğru farkı, kural, neden (AI toplu üretir)
     🎯 REHBERLİ  → kolay alıştırma (seçmeli / ipuçlu boşluk)
     ✍️ ÜRETİM    → zor alıştırma (kelime dizme / TR'den yazma / dinle-yaz / düzelt)
   USTALIK KURALI: üretimde yanlış → madde kuyruğa GERİ girer (en fazla 2 kez);
   ancak iki aşamayı da geçen madde "ustalaşıldı" sayılır ve hata defterinin
   SRS'inde geriye itilir (markReviewed easy) — geçemeyen öne gelir (hard).
   Yanlışta: kelime bazlı fark vurgusu + kural hatırlatması + doğrusunu bir kez
   yazdırma (pekiştirme) + 🧑‍🏫 öğretmen köprüsü.
   AI: oturum başında TEK toplu çağrı tüm maddelerin ders içeriğini üretir.
   Kullanım: dhErrorDrill.open()  /  dhErrorDrill.open(errListesi) */
(function(){
  "use strict";
  if(window.dhErrorDrill && window.dhErrorDrill.__v2) return;

  function esc(t){ return String(t==null?"":t).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  var __EQC={"don't":"do not","doesn't":"does not","didn't":"did not","isn't":"is not","aren't":"are not","wasn't":"was not","weren't":"were not","can't":"can not","cannot":"can not","couldn't":"could not","won't":"will not","wouldn't":"would not","shouldn't":"should not","mustn't":"must not","haven't":"have not","hasn't":"has not","hadn't":"had not","i'm":"i am","you're":"you are","we're":"we are","they're":"they are","he's":"he is","she's":"she is","it's":"it is","that's":"that is","there's":"there is","let's":"let us","i've":"i have","we've":"we have","they've":"they have","you've":"you have","i'll":"i will","we'll":"we will","you'll":"you will","they'll":"they will","he'll":"he will","she'll":"she will"};
  function norm(t){
    t=String(t||"").toLowerCase().replace(/[\u2019\u2018]/g,"'");
    t=t.replace(/\b[a-z']+\b/g,function(w){ return __EQC[w]||w; });      /* didn't = did not */
    t=t.replace(/\b(he|she|it|him|her|his|hers|its)\b/g,"o3");                              /* he=she=it=him=her */
    return t.replace(/[^a-z0-9ğüşöçıi0-9 ']+/g," ").replace(/\s+/g," ").trim();
  }
  function words(t){ return norm(t).split(" ").filter(Boolean); }
  function rawWords(t){ return String(t||"").replace(/[.!?,;]+/g,"").split(/\s+/).filter(Boolean); }
  function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var x=a[i]; a[i]=a[j]; a[j]=x; } return a; }
  function teacherHref(focus){
    var sel="teacher1"; try{ sel=localStorage.getItem("selectedTeacherAvatar")||"teacher1"; }catch(e){}
    return "./"+(sel==="teacher2"?"chatteacher2.html":"chatteacher1.html")+(focus?("?focus="+encodeURIComponent(focus)):"");
  }
  function speakEn(t){
    try{
      var u=new SpeechSynthesisUtterance(String(t||""));
      u.lang="en-US"; u.rate=.92; u.__dhMixed=true;
      var v=(speechSynthesis.getVoices()||[]).filter(function(x){return /^en/i.test(x.lang||"");})[0];
      if(v) u.voice=v;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }catch(e){}
  }
  /* kelime bazlı fark: doğruda olup cevapta olmayan → eksik; ters则 fazla */
  function diffWords(target, answer){
    var tw=words(target), aw=words(answer), amap={}, tmap={};
    aw.forEach(function(w){amap[w]=(amap[w]||0)+1;});
    tw.forEach(function(w){tmap[w]=(tmap[w]||0)+1;});
    return {
      missing: tw.filter(function(w){ if((amap[w]||0)>0){amap[w]--;return false;} return true; }),
      extra:   aw.filter(function(w){ if((tmap[w]||0)>0){tmap[w]--;return false;} return true; })
    };
  }
  function diffHtml(target, answer){
    var d=diffWords(target, answer), out="";
    if(d.missing.length) out+='<div style="font-size:13px;margin-top:4px">Eksik: '+d.missing.map(function(w){return '<b style="color:#4ade80">'+esc(w)+'</b>';}).join(", ")+'</div>';
    if(d.extra.length)   out+='<div style="font-size:13px;margin-top:2px">Fazla: '+d.extra.map(function(w){return '<s style="color:#f87171">'+esc(w)+'</s>';}).join(", ")+'</div>';
    return out;
  }
  var TL=(window.DH_COACH_TYPE_LABEL||{}), TT=(window.DH_COACH_TYPE_TIP||{});

  /* ================= OTURUM DURUMU ================= */
  var S=null;
  /* madde: {err, lesson:{why,rule,example}, stage:0 ders|1 rehberli|2 üretim, tries, mastered, failed} */

  /* ---------- AI toplu ders üretimi (tek çağrı) ---------- */
  function fetchLessons(items){
    if(!(window.DHProviders&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey())) return Promise.resolve();
    var lines=items.map(function(it,i){ return (i+1)+") Yanlış: "+(it.err.answer||"")+" | Doğru: "+(it.err.target||""); }).join("\n");
    var sys='Türkçe konuşan profesyonel bir İngilizce öğretmenisin. Öğrencinin hataları numaralı listede. SADECE geçerli JSON dizisi döndür, başka hiçbir şey yazma. Her öğe: {"i":numara,"why":"bu öğrencinin cümlesi ÖZELİNDE neden yanlış, 1-2 cümle Türkçe","rule":"genel kural, tek cümle Türkçe","example":"aynı kuralı gösteren FARKLI kısa İngilizce örnek cümle"}';
    return DHProviders.chat([{role:"system",content:sys},{role:"user",content:lines}],{temperature:0.3,max_tokens:1200})
      .then(function(t){
        try{
          var m=String(t||"").match(/\[[\s\S]*\]/);
          var arr=JSON.parse(m?m[0]:t);
          arr.forEach(function(o){ var it=items[(o.i|0)-1]; if(it) it.lesson={why:o.why||"",rule:o.rule||"",example:o.example||""}; });
        }catch(e){}
      }).catch(function(){});
  }

  /* ================= ALIŞTIRMA ÜRETİCİLERİ ================= */
  function exChoice(err){
    var opts=[err.target];
    if(err.answer && norm(err.answer)!==norm(err.target)) opts.push(err.answer);
    var d=String(err.target).replace(/\b(is|are|am|was|were|do|does|did|have|has)\b\s*/i,"");
    if(norm(d)!==norm(err.target)&&opts.every(function(o){return norm(o)!==norm(d);})) opts.push(d);
    var d2=String(err.target).replace(/\b(a|an|the)\b\s*/i,"");
    if(opts.length<3&&norm(d2)!==norm(err.target)&&opts.every(function(o){return norm(o)!==norm(d2);})) opts.push(d2);
    return opts.length>=2?{kind:"choice",options:shuffle(opts.slice(0,3))}:null;
  }
  function exCloze(err){
    var twRaw=rawWords(err.target);
    var am={}; words(err.answer).forEach(function(w){am[w]=1;});
    var miss=twRaw.filter(function(w){ var k=words(w)[0]; return k&&!am[k]; }).slice(0,2);
    var tw=words(err.target);
    if(!miss.length) return null;
    var re=new RegExp("\\b("+miss.map(function(w){return w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}).join("|")+")\\b","ig");
    return {kind:"cloze",missing:miss,shown:esc(err.target).replace(re,'<b style="color:#facc15">____</b>')};
  }
  function exBuild(err){
    var toks=rawWords(err.target);
    if(toks.length<3||toks.length>10) return null;
    return {kind:"build",tokens:shuffle(toks.slice()),answerToks:toks};
  }
  function exTr2En(err){ return err.sentenceTR?{kind:"tr2en"}:null; }
  function exListen(err){ return ("speechSynthesis" in window)?{kind:"listen"}:null; }
  function exFix(err){ return {kind:"fix"}; }

  function pickGuided(err){
    return exChoice(err)||exCloze(err)||(err.answer?exFix(err):(exBuild(err)||exTr2En(err)||exListen(err)||exChoice(err)));
  }
  function pickProduction(err, salt){
    var pool=[exBuild(err),exTr2En(err),exListen(err),(err.answer?exFix(err):null)].filter(Boolean);
    return pool[(salt||0)%pool.length];
  }

  function checkEx(ex, err, val){
    if(ex.kind==="choice") return norm(val)===norm(err.target);
    if(ex.kind==="cloze"){ var g=words(val); return ex.missing.every(function(w){ var k=words(w)[0]; return !k||g.indexOf(k)>=0; }); }
    if(ex.kind==="build") return norm(val)===norm(err.target);
    return norm(val)===norm(err.target);  // fix / tr2en / listen: tam cümle
  }

  /* ================= AKIŞ ================= */
  function open(errs){
    if(document.getElementById("dhDrillOverlay")) return;
    var boot=function(list){
      list=(list||[]).filter(function(r){return r&&r.target;}).slice(0,8);
      if(!list.length){ alert("Çalışılacak hata kaydı yok — önce biraz pratik yap 🙂"); return; }
      S={items:list.map(function(e){return {err:e,lesson:null,stage:0,tries:0,prodSalt:0,mastered:false,requeued:0};}),
         q:[],qi:0,right:0,wrong:0,typesWrong:{},t0:Date.now(),overlay:null};
      S.items.forEach(function(it){ S.q.push(it); });
      mount(); renderIntro();
    };
    if(Array.isArray(errs)&&errs.length){ boot(errs); return; }
    if(!(window.LearningErrorDB&&LearningErrorDB.all)){ alert("Hata defteri modülü yüklü değil."); return; }
    LearningErrorDB.all().then(function(all){
      var t0=new Date(); t0.setHours(0,0,0,0);
      var today=all.filter(function(r){return new Date(r.createdAt||0)>=t0;});
      boot(today.length?today:all.sort(function(a,b){return (b.reviewPriority||0)-(a.reviewPriority||0);}));
    });
  }

  function mount(){
    var ov=document.createElement("div");
    ov.id="dhDrillOverlay";
    ov.style.cssText="position:fixed;inset:0;z-index:2147483300;background:rgba(2,8,20,.85);display:flex;align-items:center;justify-content:center;padding:10px";
    ov.innerHTML='<div style="background:#0f1f3a;border:1px solid #1e3a5f;border-radius:18px;width:min(580px,97vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden">'
      +'<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #1e3a5f">'
      +'<b style="color:#e8eef7;font-size:16px;flex:1">🏋️ Hata Antrenmanı</b>'
      +'<span id="dhDrillProg" style="color:#9fb3d9;font-size:12.5px;font-weight:800"></span>'
      +'<button id="dhDrillX" style="background:#13294d;border:1px solid #1e3a5f;color:#e8eef7;border-radius:8px;width:32px;height:32px;cursor:pointer">✕</button></div>'
      +'<div id="dhDrillBar" style="height:4px;background:#13294d"><div id="dhDrillBarIn" style="height:100%;width:0%;background:linear-gradient(90deg,#059669,#22d3ee);transition:width .4s"></div></div>'
      +'<div id="dhDrillBody" style="padding:16px;overflow-y:auto;color:#dbe7ff;font-size:14.5px;line-height:1.6"></div>'
      +'</div>';
    document.body.appendChild(ov);
    document.getElementById("dhDrillX").onclick=function(){ ov.remove(); S=null; clearState(); };
    S.overlay=ov;
  }
  function B(){ return document.getElementById("dhDrillBody"); }
  function setProg(){
    var totalTasks=S.items.length*2;          // rehberli+üretim
    var doneTasks=S.right+S.wrong;
    document.getElementById("dhDrillBarIn").style.width=Math.min(100,Math.round(100*doneTasks/Math.max(1,totalTasks)))+"%";
    document.getElementById("dhDrillProg").textContent=S.qi<S.q.length?("madde "+(S.qi+1)+"/"+S.q.length):"";
  }

  function renderIntro(){
    var types={}; S.items.forEach(function(it){ var t=it.err.primaryType||"general"; types[t]=(types[t]||0)+1; });
    var chips=Object.keys(types).map(function(t){ return '<span style="background:#13294d;border:1px solid #1e3a5f;border-radius:999px;padding:5px 11px;font-size:12px;margin:3px;display:inline-block">'+esc(TL[t]||t)+' ×'+types[t]+'</span>'; }).join("");
    B().innerHTML='<div style="text-align:center;padding:6px 0">'
      +'<div style="font-size:38px">🎓</div>'
      +'<div style="font-size:17px;font-weight:900;color:#e8eef7;margin-top:6px">'+S.items.length+' hatan üzerinde profesyonel çalışma</div>'
      +'<div style="color:#9fb3d9;font-size:13px;margin-top:6px">Her hata için: 📖 ders → 🎯 rehberli alıştırma → ✍️ üretim.<br>Yanlış yaptıkların tekrar karşına gelir — ustalaşmadan bitmez.</div>'
      +'<div style="margin-top:10px">'+chips+'</div>'
      +'<div style="color:#64748b;font-size:12px;margin-top:8px">Tahmini süre: ~'+Math.max(3,S.items.length*2)+' dk</div>'
      +'<button id="dhDrillStart" style="margin-top:14px;background:linear-gradient(135deg,#059669,#0d9488);border:0;color:#fff;border-radius:12px;padding:13px 30px;font-weight:900;font-size:15px;cursor:pointer">Başla →</button>'
      +'<div id="dhDrillPrep" style="color:#64748b;font-size:12px;margin-top:8px"></div></div>';
    /* AI dersleri arka planda hazırlansın — Başla'yı bekletmez */
    var prep=fetchLessons(S.items);
    document.getElementById("dhDrillStart").onclick=function(){
      this.disabled=true; this.textContent="⏳";
      document.getElementById("dhDrillPrep").textContent="Öğretmen ders notlarını hazırlıyor…";
      Promise.race([prep,new Promise(function(r){setTimeout(r,6000);})]).then(function(){ next(); });
    };
  }

  function cur(){ return S.q[S.qi]; }
  function next(){
    saveState();
    if(S.qi>=S.q.length) return renderDone();
    var it=cur();
    setProg();
    if(it.stage===0) renderLesson(it);
    else renderExercise(it);
  }
  function advance(){ S.qi++; next(); }

  /* ---------- 📖 DERS KARTI ---------- */
  function renderLesson(it){
    var e=it.err, L=it.lesson||{};
    var tp=e.primaryType||"general";
    B().innerHTML='<div style="color:#93c5fd;font-weight:800;font-size:12.5px">📖 DERS · '+esc(TL[tp]||tp)+'</div>'
      +(e.answer?'<div style="background:#2a0f14;border:1px solid #7f1d1d;border-radius:12px;padding:11px;margin-top:10px">✗ <s>'+esc(e.answer)+'</s></div>':'<div style="background:#13294d;border:1px solid #1e3a5f;border-radius:12px;padding:11px;margin-top:10px">Tekrarda zorlandığın kalem — bugün pekiştirelim 💪</div>')
      +'<div style="background:#0a2818;border:1px solid #14532d;border-radius:12px;padding:11px;margin-top:8px">✓ <b>'+esc(e.target)+'</b> <button id="dhLsnSpk" style="border:0;background:transparent;cursor:pointer;font-size:16px">🔊</button></b>'
      +'<a id="dhLsnStudio" href="#" style="margin-left:6px;background:#7c3aed;color:#fff;text-decoration:none;font-weight:800;font-size:11.5px;padding:5px 10px;border-radius:999px">🎙️ Stüdyo</a><b>'
      +(e.sentenceTR?'<div style="font-size:12.5px;color:#9fb3d9;margin-top:4px">'+esc(e.sentenceTR)+'</div>':'')+'</div>'
      +(L.why?'<div style="margin-top:10px"><b style="color:#facc15">Neden?</b> '+esc(L.why)+'</div>':'')
      +'<div style="margin-top:8px"><b style="color:#facc15">Kural:</b> '+esc(L.rule||TT[tp]||"Bu kalıba dikkat et.")+'</div>'
      +(L.example?'<div style="margin-top:8px;background:#13294d;border:1px solid #1e3a5f;border-radius:10px;padding:9px;font-size:13.5px">Başka örnek: <i>'+esc(L.example)+'</i> <button id="dhLsnSpk2" style="border:0;background:transparent;cursor:pointer">🔊</button></div>':'')
      +'<button id="dhLsnGo" style="display:block;width:100%;margin-top:14px;background:#2563eb;border:0;color:#fff;border-radius:11px;padding:12px;font-weight:900;cursor:pointer">Anladım, alıştırmaya geç →</button>';
    var s1=document.getElementById("dhLsnSpk"); if(s1) s1.onclick=function(){ speakEn(e.target); };
    var sSt=document.getElementById("dhLsnStudio");
    if(sSt) sSt.onclick=function(ev){ ev.preventDefault(); saveState();
      location.href='./sesdalga.html?en='+encodeURIComponent(e.target)+'&tr='+encodeURIComponent(e.sentenceTR||''); };
    var s2=document.getElementById("dhLsnSpk2"); if(s2) s2.onclick=function(){ speakEn(L.example); };
    document.getElementById("dhLsnGo").onclick=function(){ it.stage=1; next(); };
  }

  /* ---------- 🎯/✍️ ALIŞTIRMA ---------- */
  function renderExercise(it){
    var e=it.err;
    var ex = it.stage===1 ? pickGuided(e) : pickProduction(e, it.prodSalt);
    it.__ex=ex;
    var head = it.stage===1 ? "🎯 REHBERLİ" : "✍️ ÜRETİM";
    var html='<div style="color:#93c5fd;font-weight:800;font-size:12.5px">'+head+(it.requeued?' · tekrar denemesi':'')+'</div>';
    if(ex.kind==="choice"){
      html+='<div style="margin-top:10px;font-weight:800">Hangisi doğru?</div>'
        +(e.sentenceTR?'<div style="font-size:12.5px;color:#9fb3d9;margin-top:4px">'+esc(e.sentenceTR)+'</div>':'')
        +ex.options.map(function(o){ return '<button class="dhOpt" data-v="'+esc(o)+'" style="display:block;width:100%;text-align:left;margin-top:8px;background:#13294d;border:1px solid #1e3a5f;color:#e8eef7;border-radius:10px;padding:12px;font-size:15px;cursor:pointer">'+esc(o)+'</button>'; }).join("");
    } else if(ex.kind==="cloze"){
      html+='<div style="margin-top:10px;font-weight:800">Boşlukları doldur:</div>'
        +'<div style="background:#13294d;border:1px solid #1e3a5f;border-radius:10px;padding:12px;margin-top:8px;font-size:16px">'+ex.shown+'</div>'
        +inputRow("Eksik kelime(ler)…");
    } else if(ex.kind==="build"){
      html+='<div style="margin-top:10px;font-weight:800">Kelimeleri doğru sıraya diz:</div>'
        +(e.sentenceTR?'<div style="font-size:12.5px;color:#9fb3d9;margin-top:4px">'+esc(e.sentenceTR)+'</div>':'')
        +'<div id="dhBuildOut" style="min-height:46px;background:#0b1120;border:1px dashed #1e3a5f;border-radius:10px;padding:8px;margin-top:8px"></div>'
        +'<div id="dhBuildSrc" style="margin-top:8px">'+ex.tokens.map(function(t,i){ return '<button class="dhTok" data-i="'+i+'" style="background:#13294d;border:1px solid #1e3a5f;color:#e8eef7;border-radius:9px;padding:9px 12px;margin:4px;font-size:15px;cursor:pointer">'+esc(t)+'</button>'; }).join("")+'</div>'
        +btnRow(false);
    } else if(ex.kind==="tr2en"){
      html+='<div style="margin-top:10px;font-weight:800">Bu cümleyi İngilizce yaz:</div>'
        +'<div style="background:#13294d;border:1px solid #1e3a5f;border-radius:10px;padding:12px;margin-top:8px;font-size:15.5px">'+esc(e.sentenceTR)+'</div>'
        +inputRow("İngilizcesini yaz…");
    } else if(ex.kind==="listen"){
      html+='<div style="margin-top:10px;font-weight:800">👂 Dinle ve yaz:</div>'
        +'<button id="dhExSpk" style="margin-top:8px;background:#13294d;border:1px solid #1e3a5f;color:#e8eef7;border-radius:10px;padding:11px 18px;font-size:15px;cursor:pointer">🔊 Dinle</button>'
        +inputRow("Duyduğunu yaz…");
    } else { /* fix */
      html+='<div style="margin-top:10px;font-weight:800">Bu cümlede hata var — doğrusunu yaz:</div>'
        +(e.sentenceTR?'<div style="font-size:12.5px;color:#9fb3d9;margin-top:4px">'+esc(e.sentenceTR)+'</div>':'')
        +'<div style="background:#2a0f14;border:1px solid #7f1d1d;border-radius:10px;padding:11px;margin-top:8px">✗ '+esc(e.answer||"")+'</div>'
        +inputRow("Doğrusunu yaz…");
    }
    html+='<div id="dhExFb" style="margin-top:12px;min-height:22px"></div>';
    B().innerHTML=html;
    if(ex.kind==="listen"){ document.getElementById("dhExSpk").onclick=function(){ speakEn(e.target); }; setTimeout(function(){ speakEn(e.target); },350); }
    if(ex.kind==="build"){
      var picked=[];
      var out=document.getElementById("dhBuildOut");
      function redraw(){
        out.innerHTML=picked.map(function(p,pi){ return '<button class="dhTokOut" data-pi="'+pi+'" style="background:#1d4ed8;border:0;color:#fff;border-radius:9px;padding:9px 12px;margin:4px;font-size:15px;cursor:pointer">'+esc(p.t)+'</button>'; }).join("")||'<span style="color:#475569;font-size:13px">Kelimelere dokunarak cümleyi kur…</span>';
        out.querySelectorAll(".dhTokOut").forEach(function(b){ b.onclick=function(){ var pi=+b.getAttribute("data-pi"); document.querySelector('.dhTok[data-i="'+picked[pi].i+'"]').style.visibility="visible"; picked.splice(pi,1); redraw(); }; });
      }
      document.querySelectorAll(".dhTok").forEach(function(b){
        b.onclick=function(){ b.style.visibility="hidden"; picked.push({t:b.textContent,i:+b.getAttribute("data-i")}); redraw(); };
      });
      redraw();
      it.__getVal=function(){ return picked.map(function(p){return p.t;}).join(" "); };
    }
    var inp=document.getElementById("dhExInp");
    if(inp){ inp.focus(); inp.addEventListener("keydown",function(ev){ if(ev.key==="Enter") submit(inp.value); }); it.__getVal=function(){ return inp.value; }; }
    var chk=document.getElementById("dhExChk"); if(chk) chk.onclick=function(){ submit(it.__getVal?it.__getVal():""); };
    var gv=document.getElementById("dhExGive"); if(gv) gv.onclick=function(){ submit("__give_up__"); };
    document.querySelectorAll(".dhOpt").forEach(function(b){ b.onclick=function(){ submit(b.getAttribute("data-v")); }; });
  }
  function inputRow(ph){
    return '<input id="dhExInp" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="'+esc(ph)+'" '
      +'style="width:100%;margin-top:8px;background:#0b1120;border:1px solid #1e3a5f;color:#e8eef7;border-radius:10px;padding:12px;font-size:15px">'+btnRow(true);
  }
  function btnRow(withGive){
    return '<div style="display:flex;gap:8px;margin-top:10px">'
      +(withGive?'<button id="dhExGive" style="flex:1;background:#334155;border:0;color:#fff;border-radius:10px;padding:11px;font-weight:800;cursor:pointer">Bilmiyorum</button>':'')
      +'<button id="dhExChk" style="flex:'+(withGive?1:"none")+';'+(withGive?'':'width:100%;')+'background:#2563eb;border:0;color:#fff;border-radius:10px;padding:11px;font-weight:800;cursor:pointer">Kontrol ✓</button></div>';
  }

  function submit(val){
    var it=cur(), e=it.err, ex=it.__ex;
    var fb=document.getElementById("dhExFb");
    if(!fb||fb.dataset.done) return;
    fb.dataset.done="1";
    var ok = val!=="__give_up__" && checkEx(ex, e, val);
    if(ok){
      S.right++;
      speakEn(e.target);
      fb.innerHTML='<div style="color:#4ade80;font-weight:900">✓ Doğru! '+esc(e.target)+'</div>';
      if(it.stage===1){ it.stage=2; setTimeout(function(){ next(); },1000); }
      else {
        it.mastered=true;
        try{ if(window.LearningErrorDB&&LearningErrorDB.markReviewed&&e.id) LearningErrorDB.markReviewed(e.id,{grade:"easy"}); }catch(x){}
        setTimeout(advance,1000);
      }
      setProg();
      return;
    }
    /* YANLIŞ: fark vurgusu + kural + pekiştirme (doğrusunu bir kez yaz) */
    S.wrong++; var tp=e.primaryType||"general"; S.typesWrong[tp]=(S.typesWrong[tp]||0)+1;
    setProg();
    var L=it.lesson||{};
    fb.innerHTML='<div style="color:#f87171;font-weight:900">✗ Doğrusu: <span style="color:#4ade80">'+esc(e.target)+'</span></div>'
      +(val!=="__give_up__"?diffHtml(e.target, val):"")
      +'<div style="font-size:12.5px;color:#9fb3d9;margin-top:5px">'+esc(L.why||L.rule||TT[tp]||"Bu kalıba dikkat.")+'</div>'
      +'<div style="margin-top:9px;font-weight:800;font-size:13px">Pekiştir — doğrusunu bir kez yaz:</div>'
      +'<input id="dhFixInp" autocapitalize="none" autocomplete="off" spellcheck="false" style="width:100%;margin-top:6px;background:#0b1120;border:1px solid #4c1d95;color:#e8eef7;border-radius:10px;padding:11px;font-size:15px">'
      +'<div style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap">'
      +'<button id="dhFixOk" style="background:#7c3aed;border:0;color:#fff;font-weight:800;font-size:12.5px;padding:8px 13px;border-radius:999px;cursor:pointer">Yazdım →</button>'
      +'<a id="dhFbTeach" href="'+teacherHref(tp)+'" style="background:#1d4ed8;color:#fff;text-decoration:none;font-weight:800;font-size:12.5px;padding:8px 13px;border-radius:999px">🧑‍🏫 Öğretmenle çalış</a>'
      +'</div>';
    var __tl=document.getElementById("dhFbTeach");
    if(__tl) __tl.addEventListener("click",function(){ stashTeachCtx(it); saveState(); });
    var fi=document.getElementById("dhFixInp"); fi.focus();
    function proceed(){
      if(norm(fi.value)!==norm(e.target)){ fi.style.borderColor="#f87171"; fi.placeholder="Aynen yaz: "+e.target; fi.value=""; return; }
      /* ustalık kuralı: üretimde yanlış → maddeyi kuyruğun sonuna geri koy (max 2) */
      if(it.requeued<2){
        it.requeued++; it.tries++; it.prodSalt++; it.stage= it.stage===1?1:2;
        S.q.push(it);
      } else {
        it.failed=true;
        try{ if(window.LearningErrorDB&&LearningErrorDB.markReviewed&&e.id) LearningErrorDB.markReviewed(e.id,{grade:"hard"}); }catch(x){}
      }
      advance();
    }
    document.getElementById("dhFixOk").onclick=proceed;
    fi.addEventListener("keydown",function(ev){ if(ev.key==="Enter") proceed(); });
  }

  /* ---------- BİTİŞ ---------- */
  function renderDone(){
    clearState();
    document.getElementById("dhDrillProg").textContent="";
    document.getElementById("dhDrillBarIn").style.width="100%";
    var total=S.right+S.wrong, pct=total?Math.round(100*S.right/total):0;
    var mins=Math.max(1,Math.round((Date.now()-S.t0)/60000));
    var mastered=S.items.filter(function(it){return it.mastered;});
    var weak=S.items.filter(function(it){return !it.mastered;});
    var worst=null,wn=0; for(var t in S.typesWrong){ if(S.typesWrong[t]>wn){wn=S.typesWrong[t];worst=t;} }
    B().innerHTML='<div style="text-align:center">'
      +'<div style="font-size:42px">'+(pct>=80?"🏆":(pct>=50?"💪":"🌱"))+'</div>'
      +'<div style="font-size:20px;font-weight:900;color:#e8eef7;margin-top:4px">%'+pct+' doğruluk · '+mins+' dk</div></div>'
      +(mastered.length?'<div style="margin-top:12px"><b style="color:#4ade80">✓ Ustalaştın ('+mastered.length+'):</b>'
        +mastered.map(function(it){return '<div style="font-size:13px;color:#9fb3d9;margin-top:3px">• '+esc(it.err.target)+'</div>';}).join("")+'</div>':"")
      +(weak.length?'<div style="margin-top:12px"><b style="color:#f87171">↻ Hâlâ zorlanıyorsun ('+weak.length+'):</b>'
        +weak.map(function(it){return '<div style="font-size:13px;color:#9fb3d9;margin-top:3px">• '+esc(it.err.target)+'</div>';}).join("")
        +'<div style="font-size:12px;color:#64748b;margin-top:4px">Bunlar hata defterinde ÖNE alındı — yarın tekrar karşına gelecek.</div></div>':"")
      +(worst?'<a href="'+teacherHref(worst)+'" style="display:block;text-align:center;margin-top:14px;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:800;padding:12px;border-radius:11px">🧑‍🏫 En zayıf konunu öğretmenle çalış: '+esc(TL[worst]||worst)+'</a>':"")
      +'<button id="dhDrillEnd" style="display:block;width:100%;margin-top:10px;background:#334155;border:0;color:#fff;border-radius:11px;padding:12px;font-weight:800;cursor:pointer">Kapat</button>';
    document.getElementById("dhDrillEnd").onclick=function(){ S.overlay.remove(); S=null; };
    try{ window.dhLogActivity&&window.dhLogActivity("🏋️ Hata antrenmanı: %"+pct+" ("+mastered.length+" ustalık)","drill"); }catch(e){}
  }

  /* ── OTURUM KALICILIĞI: öğretmene gidiş antrenmanı ÖLDÜRMEZ ──
     next() her adımda durumu yazar; koç çipi kaldığın maddeden sürdürür. */
  function saveState(){
    try{
      if(!S) return;
      var idx=function(it){ return S.items.indexOf(it); };
      sessionStorage.setItem("dh-drill-state", JSON.stringify({
        t:Date.now(), returnTo:location.pathname+location.search,
        items:S.items.map(function(it){ return {err:it.err,lesson:it.lesson,stage:it.stage,tries:it.tries,prodSalt:it.prodSalt,requeued:it.requeued,mastered:it.mastered,failed:it.failed}; }),
        q:S.q.map(idx), qi:S.qi, right:S.right, wrong:S.wrong, typesWrong:S.typesWrong, t0:S.t0
      }));
    }catch(e){}
  }
  function clearState(){ try{ sessionStorage.removeItem("dh-drill-state"); }catch(e){} }
  function resume(){
    try{
      var st=JSON.parse(sessionStorage.getItem("dh-drill-state")||"null");
      if(!st||!st.items||!st.items.length) return false;
      if(document.getElementById("dhDrillOverlay")) return true;
      S={items:st.items.map(function(o){ return {err:o.err,lesson:o.lesson,stage:o.stage,tries:o.tries||0,prodSalt:o.prodSalt||0,requeued:o.requeued||0,mastered:!!o.mastered,failed:!!o.failed}; }),
         q:[],qi:st.qi||0,right:st.right||0,wrong:st.wrong||0,typesWrong:st.typesWrong||{},t0:st.t0||Date.now(),overlay:null};
      S.q=(st.q||[]).map(function(i){ return S.items[i]; }).filter(Boolean);
      if(!S.q.length){ clearState(); return false; }
      mount(); next();
      return true;
    }catch(e){ return false; }
  }
  function stashTeachCtx(it){
    try{
      var e=it.err, L=it.lesson||{}, tp=e.primaryType||"general";
      sessionStorage.setItem("dh-teach-focus", JSON.stringify({
        t:Date.now(), type:tp, label:(TL[tp]||tp),
        target:e.target, answer:e.answer||"", tr:e.sentenceTR||"",
        tip:L.why||L.rule||TT[tp]||"" }));
    }catch(e2){}
  }
  window.dhErrorDrill={ open:open, resume:resume, __v2:true };
})();
