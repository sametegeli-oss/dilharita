/* koc.js — AI KOÇ: günde 1 kez profil → öğretmen → günün planı.
   Kurallar: AI yalnız ÖNERİR (hiç veri yazmaz) · plan günlük önbellekte ·
   AI yoksa/parse hatasında banner statik haline dokunulmaz (sessiz düşüş). */
(function(){
  "use strict";
  var DAY=new Date().toISOString().slice(0,10), KEY="dh-koc-plan-"+DAY;
  var ALLOWED=["tekrar.html?plan=1","index-app.html","chat.html","practice.html?auto=due","kelime-ogren.html","hata-defteri.html"];

  // ── 30 GÜNLÜK DERİN ANALİZ: koç kullanıcıyı gerçekten tanısın ──
  function activityTrend30(){
    try{
      var tr=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}, days=tr.days||{};
      var active=0, lessons=0, sentences=0, reviews=0, first15=0, last15=0, d=new Date();
      for(var i=0;i<30;i++){
        var key=d.toISOString().slice(0,10), rec=days[key];
        if(rec){
          active++; lessons+=rec.lessons||0; sentences+=rec.sentences||0; reviews+=rec.reviews||0;
          if(i<15) last15++; else first15++;
        }
        d.setDate(d.getDate()-1);
      }
      var trend = last15>first15 ? "artıyor" : (last15<first15 ? "azalıyor" : "sabit");
      return {text:"Son 30 günde "+active+"/30 gün aktif oldu (önceki 15 gün:"+first15+", son 15 gün:"+last15+" — düzen "+trend+"). "
        +"Toplam: "+lessons+" ders, "+sentences+" cümle, "+reviews+" tekrar.", active:active, first15:first15, last15:last15};
    }catch(e){ return {text:"", active:0, first15:0, last15:0}; }
  }
  async function errorTrend30(){
    var rows=[];
    try{
      if(!(window.LearningErrorDB&&LearningErrorDB.all)) return {text:"", rows:rows};
      var errs=await LearningErrorDB.all(); if(!errs||!errs.length) return {text:"", rows:rows};
      var now=Date.now(), cut15=now-15*86400000, cut30=now-30*86400000;
      var older={}, recent={};
      errs.forEach(function(r){
        var ts=r.ts||0; if(ts<cut30) return;
        var types=Array.isArray(r.types)&&r.types.length ? r.types : (r.type?[r.type]:[]);
        types.forEach(function(t){ if(ts>=cut15) recent[t]=(recent[t]||0)+1; else older[t]=(older[t]||0)+1; });
      });
      var allTypes={}; Object.keys(older).forEach(function(t){allTypes[t]=1;}); Object.keys(recent).forEach(function(t){allTypes[t]=1;});
      var lines=[];
      Object.keys(allTypes).forEach(function(t){
        var o=older[t]||0, r=recent[t]||0;
        if(o===0 && r===0) return;
        rows.push({type:t, older:o, recent:r});
        if(r<o) lines.push(t+": azalıyor ("+o+"→"+r+", iyileşme)");
        else if(r>o) lines.push(t+": artıyor ("+o+"→"+r+", dikkat)");
      });
      if(!lines.length) return {text:"", rows:rows};
      lines.sort(function(a,b){ return (b.indexOf("dikkat")>=0?1:0)-(a.indexOf("dikkat")>=0?1:0); });
      return {text:"Son 30 günde hata türü eğilimleri (önceki 15 gün → son 15 gün): "+lines.slice(0,4).join("; ")+".", rows:rows};
    }catch(e){ return {text:"", rows:rows}; }
  }

  async function profile(){
    var p=[];
    try{ var tr=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}, d=new Date(), st=0;
      for(;;){ if((tr.days||{})[d.toISOString().slice(0,10)]){st++;d.setDate(d.getDate()-1);} else break; }
      if(st) p.push("Seri:"+st+" gün.");
    }catch(e){}
    var act=activityTrend30(); if(act.text) p.push(act.text);
    try{ var m=JSON.parse(localStorage.getItem("dh-progress-mirror-v1")||"{}")||{}, s1=0,w1=0,s2=0,w2=0;
      for(var k in m){ if(!m[k]) continue; var st0=m[k][0];
        if(k.indexOf("sentence:")===0){ if(st0===1)s1++; else if(st0===2)s2++; }
        else if(k.indexOf("word:")===0){ if(st0===1)w1++; else if(st0===2)w2++; }
      }
      p.push("Çalışılan cümle:"+s1+", kelime:"+w1+". Öğrenilmiş cümle:"+s2+", kelime:"+w2+".");
      __lastS1=s1; __lastW1=w1; __lastS2=s2; __lastW2=w2;
    }catch(e){}
    var errCount=0;
    try{ if(window.LearningErrorDB&&LearningErrorDB.all){
      var errs=await LearningErrorDB.all(), t={};
      errCount=(errs||[]).length;
      (errs||[]).slice(-60).forEach(function(r){
        var types=Array.isArray(r.types)&&r.types.length ? r.types : (r.type?[r.type]:[]);
        types.forEach(function(ty){ t[ty]=(t[ty]||0)+1; });
      });
      var top=Object.keys(t).sort(function(a,b){return t[b]-t[a]}).slice(0,3);
      p.push(top.length ? ("Hata defteri: "+errCount+" kayıt. Sık hatalar:"+top.join(",")+".") : "Hata defteri: BOŞ (0 kayıt) — hata defteri önerme.");
    }}catch(e){}
    window.__dhErrCount=errCount;
    var errT=await errorTrend30(); if(errT.text) p.push(errT.text);

    // ── SEVİYE ÖNERİSİ: AI'nin insafına değil, GERÇEK KANIT'a dayalı (kod-tabanlı) ──
    try{
      var improving = errT.rows.filter(function(r){ return r.older>0 && r.recent<=Math.ceil(r.older*0.5); });
      var worsening = errT.rows.filter(function(r){ return r.recent>=3 && r.recent>r.older; });
      window.__dhLevelSuggest = (act.active>=20 && improving.length>=2 && worsening.length===0);
      window.__dhLevelReason = window.__dhLevelSuggest
        ? ("Son 30 günde "+act.active+" gün aktif oldun ve "+improving.length+" hata türünde belirgin iyileşme var — seviye yükseltmeyi hak ediyorsun.")
        : "";
    }catch(e){ window.__dhLevelSuggest=false; }

    await new Promise(function(res){ try{
      var r=indexedDB.open("sentence-mode",1);
      r.onsuccess=function(){ var db=r.result, due=0, leech=0, now=Date.now();
        try{ var q=db.transaction("kv","readonly").objectStore("kv").openCursor();
          q.onsuccess=function(e){ var c=e.target.result;
            if(c){ var kk=String(c.key),v=c.value||{};
              if(kk.indexOf("srs:")===0){ if((v.due||0)<=now)due++; if((v.lapses||0)>=3)leech++; }
              c.continue();
            } else { db.close(); if(due)p.push("Tekrar bekleyen:"+due+"."); if(leech)p.push("İnatçı öğe:"+leech+"."); res(); } };
          q.onerror=function(){ db.close(); res(); };
        }catch(e2){ try{db.close()}catch(_){ } res(); } };
      r.onerror=function(){ res(); };
    }catch(e3){ res(); } });
    return p.join(" ");
  }

  function paint(plan){
    try{
      // Öncelik: yeni "AI Mentor" konteyneri (#dhKocContainer). Yoksa eski basit banner'a düş.
      var box=document.getElementById("dhKocContainer");
      var sub=document.getElementById("dhDaySub");     // gizli sayaç beslemesi (geri uyumluluk)
      if(!plan||!plan.steps||!plan.steps.length){
        if(box && box.dataset.dhFilled!=="1"){
          box.innerHTML='<div style="background:#111827;padding:16px;border-radius:14px;border:1px dashed rgba(255,255,255,.15);color:#93c5fd;font-size:13px;text-align:center">AI Mentor için API anahtarı ekleyince burada günün planı görünecek.</div>';
        }
        return;
      }
      if(sub) sub.textContent=(plan.dueCount||0)+" tekrar bekleyen";
      if(box){
        box.dataset.dhFilled="1";
        var stepsHtml=plan.steps.map(function(s,i){
          return '<a href="./'+s.href+'" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#0d1526;border:1px solid #1e3a5f;border-radius:11px;text-decoration:none;color:#e8eef7;margin-top:8px">'
            +'<span style="background:#2563eb;color:#fff;font:800 12px system-ui;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:0 0 auto">'+(i+1)+'</span>'
            +'<span style="font-size:13.5px;font-weight:700">'+esc(s.label)+'</span></a>';
        }).join("");
        var st=plan.stats||{}, learned=(st.s2||0)+(st.w2||0), studying=(st.s1||0)+(st.w1||0), due=st.due||0;
        var maxV=Math.max(learned,studying,due,1);
        function bar(label,val,color){
          var pct=Math.round(100*val/maxV);
          return '<div style="display:flex;align-items:center;gap:8px;margin-top:5px">'
            +'<span style="width:78px;font-size:11px;color:#9fb3d9;flex:0 0 auto">'+label+'</span>'
            +'<div style="flex:1;background:#0a1628;border-radius:6px;height:10px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+color+'"></div></div>'
            +'<span style="width:26px;text-align:right;font-size:11px;color:#e8eef7;flex:0 0 auto">'+val+'</span></div>';
        }
        var chartHtml='<div style="margin:10px 0 12px">'
          +bar("Öğrenilmiş", learned, "#4ade80")+bar("Çalışılıyor", studying, "#38bdf8")+bar("Tekrar bekleyen", due, "#f59e0b")
          +'</div>';
        box.innerHTML='<div style="background:#111827;padding:18px;border-radius:14px;border:1px solid rgba(255,255,255,.1)">'
          +'<div style="color:#60a5fa;font:900 12px system-ui;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px">🧭 AI Mentor — Bugünün Planı</div>'
          +'<div style="font:800 16px system-ui;margin-bottom:2px">'+esc(plan.focus||"")+'</div>'
          +(plan.note?('<div style="color:#9fb3d9;font-size:12.5px;margin-bottom:2px">💬 '+esc(plan.note)+'</div>'):'')
          +(plan.why?('<div style="color:#facc15;font-size:11.5px;margin-bottom:4px">🎯 '+esc(plan.why)+'</div>'):'')
          +(window.__dhLevelSuggest?('<a href="./seviye-testi.html" style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:9px 12px;background:#1e1b4b;border:1px solid #818cf8;border-radius:11px;text-decoration:none;color:#e0e7ff;font-size:12.5px"><span>🎓</span><span><b>Seviye yükseltme zamanı olabilir!</b><br><span style="opacity:.85">'+esc(window.__dhLevelReason||"")+'</span></span></a>'):'')
          +(function(){
              var gg=window.__dhGoal; if(!gg) return "";
              var html="";
              if(gg.result){
                html+='<div style="margin-top:8px;padding:9px 12px;background:'+(gg.result.achieved?"#052e1655":"#3f1d1d55")+';border:1px solid '+(gg.result.achieved?"#4ade8055":"#f8717155")+';border-radius:11px;font-size:12px">'
                  +(gg.result.achieved?"✅ Geçen haftaki hedefini tuttun! ":"⏳ Geçen haftaki hedefe tam ulaşamadın. ")
                  +gg.result.type+": "+gg.result.before+" → "+gg.result.now+'</div>';
              }
              if(gg.goal){
                html+='<div style="margin-top:6px;padding:9px 12px;background:#0d1526;border:1px solid #1e3a5f;border-radius:11px;font-size:12px;color:#9fb3d9">📌 Bu haftanın hedefi: <b style="color:#e8eef7">'+gg.goal.type+'</b> hatasını '+gg.goal.baseline+"'ten "+gg.goal.targetCount+"'e indir</div>";
              }
              return html;
            })()
          +chartHtml+stepsHtml+'</div>';
      } else {
        // eski basit banner (geri uyumluluk — bazı sayfalarda hâlâ olabilir)
        var a2=document.getElementById("dhDayStart");
        if(a2 && sub){ a2.href="./"+plan.steps[0].href;
          sub.innerHTML="<b>"+esc(plan.focus||"")+"</b> — "+plan.steps.map(function(s,i){return (i+1)+") "+esc(s.label);}).join(" → "); }
      }
    }catch(e){}
  }
  function esc(s){ return String(s||"").replace(/[<>&]/g,function(c){return {"<":"&lt;",">":"&gt;","&":"&amp;"}[c];}); }
  var __lastDue=0, __lastS1=0, __lastW1=0, __lastS2=0, __lastW2=0, __nextModule=null;

  // "Yeni cümleler öğren" adımı için hedef modülü koç DETERMİNİSTİK olarak seçer (AI değil):
  // ilerlemesi tamamlanmamış (mirror'da status!==2) en az bir cümlesi olan İLK modül.
  function kvReadPrefix(pre){
    return new Promise(function(res){
      try{
        var r=indexedDB.open("sentence-mode",1);
        r.onsuccess=function(){ var db=r.result, out={};
          try{ var q=db.transaction("kv","readonly").objectStore("kv").openCursor();
            q.onsuccess=function(e){ var c=e.target.result;
              if(c){ var k=String(c.key); if(k.indexOf(pre)===0) out[k.slice(pre.length)]=c.value; c.continue(); }
              else { db.close(); res(out); } };
            q.onerror=function(){ db.close(); res(out); };
          }catch(e2){ try{db.close()}catch(_){ } res(out); } };
        r.onerror=function(){ res({}); };
      }catch(e){ res({}); }
    });
  }
  async function pickNextModule(){
    try{
      var mirror={}; try{ mirror=JSON.parse(localStorage.getItem("dh-progress-mirror-v1")||"{}")||{}; }catch(e){}
      // practice.html kendi SRS kaydını (srs:<id>) tutar, mirror'a hiç yazmaz — bu yüzden koç
      // practice'te çalışılan modülleri de "ilerleme var" saysın diye SRS kaydına da bakıyor.
      var srs=await kvReadPrefix("srs:");
      var all=await (await fetch("./data/sentences.json")).json();
      var order=[], seen={}, byMod={};
      all.forEach(function(s){
        if(!s.module) return;
        if(!seen[s.module]){ seen[s.module]=1; order.push(s.module); byMod[s.module]=[]; }
        byMod[s.module].push(s);
      });
      for(var i=0;i<order.length;i++){
        var mod=order[i];
        // "hiç dokunulmamış" = ne mirror'da öğrenilmiş(2) ne de practice'te en az 2 kez doğru cevaplanmış (rep>=2)
        var incomplete=byMod[mod].some(function(s){
          var m=mirror["sentence:"+s.id]; var learned = m && m[0]===2;
          var sr=srs[s.id]; var practiced = sr && (sr.rep||0)>=2;
          return !(learned || practiced);
        });
        if(incomplete) return mod;
      }
      return order[0]||null;
    }catch(e){ return null; }
  }
  function valid(p){
    if(!p||typeof p!=="object"||!Array.isArray(p.steps)) return null;
    var due = (p.dueCount!=null ? p.dueCount : __lastDue);
    p.dueCount=due;
    var aiSteps=p.steps.filter(function(s){ return s&&s.label&&ALLOWED.indexOf(String(s.href||""))>=0; });
    if(!window.__dhErrCount){ aiSteps=aiSteps.filter(function(s){ return s.href!=="hata-defteri.html"; }); }

    // GARANTİLİ İSKELET (eski ☀️ Güne Başla tasarımı): tekrar → yeni cümleler → 1 dk konuşma.
    var spine=[];
    if(due>0) spine.push({label:"Vadesi gelen kelime/cümleleri tekrarla", href:"tekrar.html?plan=1"});
    // Günlük 25 cümle sınırı: bugün zaten 25+ çalıştıysa "yeni cümleler" adımı önerilmez (aşırı yükleme önlenir)
    var todayCount=0;
    try{ var tr2=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}, tk=new Date().toISOString().slice(0,10);
      todayCount=(tr2.days&&tr2.days[tk]&&tr2.days[tk].sentences)||0; }catch(e){}
    if(todayCount<25){
      spine.push({label: __nextModule ? ("Yeni cümleler: "+__nextModule.replace(/^[A-C]\d-M\d+\s*/,"")) : "Yeni cümleler öğren",
                  href: __nextModule ? ("index-app.html?mod="+encodeURIComponent(__nextModule)) : "index-app.html"});
    }
    spine.push({label:"1 dakika konuş", href:"chat.html"});
    var hrefs=spine.map(function(s){return s.href;});
    var bonus=aiSteps.find(function(s){ return hrefs.indexOf(s.href)<0; });
    p.steps = bonus ? spine.concat([bonus]) : spine;

    if(!p.steps.length) return null;
    p.focus=String(p.focus||"").slice(0,120); p.note=String(p.note||"").slice(0,140);
    p.why=String(p.why||"").slice(0,180);
    // stats artık burada değil — run() içinde HER açılışta canlı hesaplanır (bkz. liveStats)
    return p;
  }

  // İstatistik çubukları HİÇ önbelleğe alınmaz — plan (adımlar) günde 1 kez AI'dan gelse de,
  // "Öğrenilmiş/Çalışılıyor/Tekrar bekleyen" sayıları her açılışta CANLI hesaplanır ki
  // gün içinde yapılan çalışma anında yansısın.
  async function liveStats(){
    var s1=0,s2=0,w1=0,w2=0,due=0;
    try{
      var m=JSON.parse(localStorage.getItem("dh-progress-mirror-v1")||"{}")||{};
      for(var k in m){ if(!m[k]) continue; var st0=m[k][0];
        if(k.indexOf("sentence:")===0){ if(st0===1)s1++; else if(st0===2)s2++; }
        else if(k.indexOf("word:")===0){ if(st0===1)w1++; else if(st0===2)w2++; }
      }
    }catch(e){}
    await new Promise(function(res){ try{
      var r=indexedDB.open("sentence-mode",1);
      r.onsuccess=function(){ var db=r.result, now=Date.now();
        try{ var q=db.transaction("kv","readonly").objectStore("kv").openCursor();
          q.onsuccess=function(e){ var c=e.target.result;
            if(c){ var kk=String(c.key),v=c.value||{}; if(kk.indexOf("srs:")===0 && (v.due||0)<=now) due++; c.continue(); }
            else { db.close(); res(); } };
          q.onerror=function(){ db.close(); res(); };
        }catch(e2){ try{db.close()}catch(_){ } res(); } };
      r.onerror=function(){ res(); };
    }catch(e3){ res(); } });
    return {due:due, s1:s1, s2:s2, w1:w1, w2:w2};
  }

  // ── HEDEF TAKİBİ: koç haftalık bir hedef koyar, 7 gün sonra kendi kendine kontrol eder ──
  function checkAndSetGoal(errT){
    var g=null; try{ g=JSON.parse(localStorage.getItem("dh-koc-goal")||"null"); }catch(e){}
    var now=Date.now(), result=null;
    if(g && now-g.setAt>=7*86400000){
      // 7 gün doldu: hedef tutmuş mu kontrol et
      var cur = errT.rows.find(function(r){ return r.type===g.type; });
      var nowCount = cur ? cur.recent : 0;
      var achieved = nowCount <= g.targetCount;
      result = { type:g.type, achieved:achieved, before:g.baseline, now:nowCount };
      g=null; // hedefi temizle, yeni belirlenecek
    }
    if(!g){
      // yeni hedef: en çok tekrarlanan (kötüleşen ya da baskın) hata türünü seç
      var worst = errT.rows.slice().sort(function(a,b){ return b.recent-a.recent; })[0];
      if(worst && worst.recent>=2){
        g={ type:worst.type, baseline:worst.recent, targetCount:Math.max(0,Math.ceil(worst.recent*0.5)), setAt:now };
        try{ localStorage.setItem("dh-koc-goal", JSON.stringify(g)); }catch(e){}
      }
    }
    return { goal:g, result:result };
  }

  async function run(){
    try{
      try{ window.__dhErrCount = window.LearningErrorDB&&LearningErrorDB.all ? (await LearningErrorDB.all()||[]).length : 0; }catch(e){ window.__dhErrCount=0; }
      __nextModule = await pickNextModule();
      // seviye önerisi HER açılışta canlı hesaplanır (cache-hit dahil, profile() cache-hit'te çalışmaz)
      try{
        var _act=activityTrend30(), _errT=await errorTrend30();
        var _imp=_errT.rows.filter(function(r){ return r.older>0 && r.recent<=Math.ceil(r.older*0.5); });
        var _wor=_errT.rows.filter(function(r){ return r.recent>=3 && r.recent>r.older; });
        window.__dhLevelSuggest = (_act.active>=20 && _imp.length>=2 && _wor.length===0);
        window.__dhLevelReason = window.__dhLevelSuggest ? ("Son 30 günde "+_act.active+" gün aktif oldun ve "+_imp.length+" hata türünde belirgin iyileşme var — seviye yükseltmeyi hak ediyorsun.") : "";
        window.__dhGoal = checkAndSetGoal(_errT);
      }catch(e){ window.__dhLevelSuggest=false; window.__dhGoal=null; }
      var cached=localStorage.getItem(KEY);
      if(cached){ var cp=valid(JSON.parse(cached)); if(cp){ cp.stats=await liveStats(); paint(cp); } return; }
      if(!(window.DHProviders&&DHProviders.chat&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey())) return;
      var prof=await profile(); if(!prof) return;
      var sys='Türk öğrencinin İngilizce koçusun. Profile göre BUGÜN için kısa, SOMUT bir plan yap. '
        +'KESİN KURALLAR: (1) "Hata defteri: BOŞ" yazıyorsa hata-defteri.html adımını KESİNLİKLE ekleme. '
        +'(2) Adım etiketlerine SAYI GÖMME (örn. "12 kelimeyi tekrarla" değil "kelimeleri tekrarla" de) — sayılar üstteki çubuklarda zaten CANLI gösteriliyor, etikete gömülen sayı gün içinde bayatlar. Yalnız gerçek duruma uygun, somut ama sayısız bir eylem adımı öner ("pratik yap" gibi aşırı genel de olmasın). '
        +'(3) Tekrar bekleyen 0 ise tekrar.html adımını ekleme. '
        +'(4) TON: cılız/nötr cümleler kurma. "note" ve "why" alanları KOMUT NİTELİĞİNDE ve YÖNLENDİRİCİ olsun — sadece gözlem değil, ne yapması gerektiğini AÇIKÇA söyle (örn. "Bugün mutlaka past-simple çalış, 3 gündür ihmal ediyorsun" gibi net bir yönerge; "iyi gidiyorsun" gibi genel geçer laf etme). '
        +'SADECE JSON döndür, açıklama yok: {"focus":"günün odağı tek cümle (Türkçe, buyurgan/yönlendirici üslupla)","note":"NET bir yönerge/komut (Türkçe, en çok 15 kelime)","why":"bu planı NEDEN önerdiğini profildeki sayılara dayanarak açıklayan, yönlendirici 1 cümle (Türkçe, en çok 20 kelime)","steps":[{"label":"somut, sayıya dayalı adım (Türkçe, kısa)","href":"..."}]} steps 2-3 adet olacak ve href YALNIZ şunlardan biri: '+ALLOWED.join(", ");
      var out=await DHProviders.chat([{role:"system",content:sys},{role:"user",content:prof}],{temperature:0.4,max_tokens:400});
      var plan=null; try{ plan=valid(JSON.parse(String(out).replace(/```json|```/g,"").trim())); }catch(e){}
      if(!plan) return;                      // sessiz düşüş: banner statik kalır
      localStorage.setItem(KEY,JSON.stringify(plan));
      // eski gün planlarını temizle
      for(var i=localStorage.length-1;i>=0;i--){ var k=localStorage.key(i); if(k&&k.indexOf("dh-koc-plan-")===0&&k!==KEY) localStorage.removeItem(k); }
      plan.stats=await liveStats();
      paint(plan);
    }catch(e){}
  }
  if(document.readyState!=="loading") setTimeout(run,1200);
  else document.addEventListener("DOMContentLoaded",function(){ setTimeout(run,1200); });
})();
