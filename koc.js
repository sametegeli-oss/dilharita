/* koc.js — AI KOÇ: günde 1 kez profil → öğretmen → günün planı.
   Kurallar: AI yalnız ÖNERİR (hiç veri yazmaz) · plan günlük önbellekte ·
   AI yoksa/parse hatasında banner statik haline dokunulmaz (sessiz düşüş). */
(function(){
  "use strict";
  var DAY=new Date().toISOString().slice(0,10), KEY="dh-koc-plan-"+DAY;
  
  // Modül listesi (index-app.html içindeki 52 modülün yapısal şeması)
  var MODULES = [
    "A1-M01-P1","A1-M01-P2","A1-M01-P3","A1-M01-P4",
    "A1-M02-P1","A1-M02-P2","A1-M02-P3","A1-M02-P4",
    "A1-M03-P1","A1-M03-P2","A1-M03-P3","A1-M03-P4",
    "A1-M04-P1","A1-M04-P2","A1-M04-P3","A1-M04-P4",
    "A1-M05-P1","A1-M05-P2","A1-M05-P3","A1-M05-P4",
    "A1-M06-P1","A1-M06-P2","A1-M06-P3","A1-M06-P4",
    "A1-M07-P1","A1-M07-P2","A1-M07-P3","A1-M07-P4",
    "A1-M08-P1","A1-M08-P2","A1-M08-P3","A1-M08-P4",
    "A1-M09-P1","A1-M09-P2","A1-M09-P3","A1-M09-P4",
    "A1-M10-P1","A1-M10-P2","A1-M10-P3","A1-M10-P4",
    "A1-M11-P1","A1-M11-P2","A1-M11-P3","A1-M11-P4",
    "A1-M12-P1","A1-M12-P2","A1-M12-P3","A1-M12-P4",
    "A1-M13-P1","A1-M13-P2","A1-M13-P3","A1-M13-P4"
  ];

  function isHrefAllowed(href) {
    if (!href) return false;
    if (href.indexOf("index-app.html") === 0) return true; // Parametreli index-app.html girişlerine izin ver
    var basicAllowed = ["tekrar.html?plan=1", "chat.html", "practice.html?auto=due", "kelime-ogren.html", "hata-defteri.html"];
    return basicAllowed.indexOf(href) >= 0;
  }

  async function profile(){
    var p=[];
    var modProgress = {}; // Modül bazlı cümle sayımı
    MODULES.forEach(function(m){ modProgress[m] = 0; });

    try{ var tr=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}, d=new Date(), st=0;
      for(;;){ if((tr.days||{})[d.toISOString().slice(0,10)]){st++;d.setDate(d.getDate()-1);} else break; }
      if(st) p.push("Seri:"+st+" gün.");
    }catch(e){}

    try{ var m=JSON.parse(localStorage.getItem("dh-progress-mirror-v1")||"{}")||{}, s1=0,w1=0,s2=0,w2=0;
      for(var k in m){ if(!m[k]) continue; var st0=m[k][0];
        if(k.indexOf("sentence:")===0){ 
          if(st0===1)s1++; else if(st0===2)s2++; 
          // Hangi modüle ait olduğunu çözüp sayacı artır (Örn: sentence:A1-M01-P1_0 -> A1-M01-P1)
          var parts = k.replace("sentence:", "").split("_");
          if(parts[0] && modProgress[parts[0]] !== undefined) {
            modProgress[parts[0]]++;
          }
        }
        else if(k.indexOf("word:")===0){ if(st0===1)w1++; else if(st0===2)w2++; }
      }
      p.push("Çalışılan cümle:"+s1+", kelime:"+w1+". Öğrenilmiş cümle:"+s2+", kelime:"+w2+".");
      
      // Modüllerin doluluk durumunu koça raporla (Sadece üzerinde çalışılmış olanları özetle)
      var activeMods = [];
      MODULES.forEach(function(m){
        if(modProgress[m] > 0 && modProgress[m] < 25) {
          activeMods.push(m + ":" + modProgress[m] + "/25");
        }
      });
      if(activeMods.length > 0) {
        p.push("Yarım kalan modüller (acil bitmeli): " + activeMods.slice(0, 3).join(", ") + ".");
      } else {
        // Eğer yarım kalan yoksa sıradaki ilk sıfır olan modülü fısılda
        var nextMod = MODULES.find(function(m){ return modProgress[m] === 0; });
        if(nextMod) p.push("Sıradaki boş modül: " + nextMod + ".");
      }

      __lastS1=s1; __lastW1=w1; __lastS2=s2; __lastW2=w2;
    }catch(e){}

    var errCount=0;
    try{ if(window.LearningErrorDB&&LearningErrorDB.all){
      var errs=await LearningErrorDB.all(), t={};
      errCount=(errs||[]).length;
      (errs||[]).slice(-60).forEach(function(r){ if(r&&r.type) t[r.type]=(t[r.type]||0)+1; });
      var top=Object.keys(t).sort(function(a,b){return t[b]-t[a]}).slice(0,3);
      p.push(top.length ? ("Hata defteri: "+errCount+" kayıt. Sık hatalar:"+top.join(",")+".") : "Hata defteri: BOŞ (0 kayıt) — hata defteri önerme.");
    }}catch(e){}
    window.__dhErrCount=errCount;

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
    }catch(e33){ res(); } });
    return p.join(" ");
  }

  function paint(plan){
    try{
      var box=document.getElementById("dhKocContainer");
      var sub=document.getElementById("dhDaySub");
      if(!plan||!plan.steps||!plan.steps.length){
        if(box && box.dataset.dhFilled!=="1"){
          box.innerHTML='<div style="background:#111827;padding:16px;border-radius:14px;border:1px dashed rgba(255,255,255,.15);color:#93c5fd;font-size:13px;text-align:center">AI Koçunuzun dizginleri ele alması için API anahtarı ekleyin.</div>';
        }
        return;
      }
      if(sub) sub.textContent=(plan.dueCount||0)+" tekrar bekleyen";
      if(box){
        box.dataset.dhFilled="1";
        var stepsHtml=plan.steps.map(function(s,i){
          var badge = i === 0 ? '<span style="background:#dc2626;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:900;text-transform:uppercase">KRİTİK</span>' : '<span style="background:#1e3a5f;color:#93c5fd;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700">ADIM '+(i+1)+'</span>';
          return '<a href="./'+s.href+'" style="display:flex;align-items:center;justify-content:between;gap:10px;padding:12px;background:#0d1526;border:1px solid #2563eb;border-radius:11px;text-decoration:none;color:#e8eef7;margin-top:8px;transition:all 0.2s">'
            +'<div style="display:flex;align-items:center;gap:10px">'
            +'<span style="background:#2563eb;color:#fff;font:800 12px system-ui;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:0 0 auto">'+(i+1)+'</span>'
            +'<span style="font-size:13.5px;font-weight:700;color:#fff">'+esc(s.label)+'</span>'
            +'</div>'+badge+'</a>';
        }).join("");
        var st=plan.stats||{}, learned=(st.s2||0)+(st.w2||0), studying=(st.s1||0)+(st.w1||0), due=st.due||0;
        var maxV=Math.max(learned,studying,due,1);
        function bar(label,val,color){
          var pct=Math.round(100*val/maxV);
          return '<div style="display:flex;align-items:center;gap:8px;margin-top:5px">'
            +'<span style="width:85px;font-size:11px;color:#9fb3d9;flex:0 0 auto">'+label+'</span>'
            +'<div style="flex:1;background:#0a1628;border-radius:6px;height:10px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+color+'"></div></div>'
            +'<span style="width:26px;text-align:right;font-size:11px;color:#e8eef7;flex:0 0 auto">'+val+'</span></div>';
        }
        var chartHtml='<div style="margin:12px 0;background:#070d19;padding:10px;border-radius:8px;border:1px solid #1e293b">'
          +'<div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:6px;text-transform:uppercase">Mevcut Durum Kök Analizi:</div>'
          +bar("Öğrenilenler", learned, "#22c55e")+bar("Çalışılanlar", studying, "#3b82f6")+bar("Bekleyen Tekrar", due, "#f59e0b")
          +'</div>';
        
        box.innerHTML='<div style="background:#0f172a;padding:20px;border-radius:16px;border:2px solid #2563eb;box-shadow: 0 4px 20px rgba(37,99,235,0.15)">'
          +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
          +'<div style="color:#ef4444;font:900 12px system-ui;letter-spacing:.6px;text-transform:uppercase;display:flex;align-items:center;gap:4px">🛑 KOÇUN SIKI KONTROLÜNDESİNİZ</div>'
          +'<div style="background:#22c55e;color:#fff;font-size:10px;padding:2px 6px;border-radius:20px;font-weight:800">HEDEF ODAKLI</div>'
          +'</div>'
          +'<div style="font:800 17px system-ui;color:#fff;margin-bottom:6px;line-height:1.3">🎯 Koç Emri: '+esc(plan.focus||"")+'</div>'
          +(plan.note?('<div style="color:#e2e8f0;background:#1e293b;padding:10px;border-left:4px solid #facc15;border-radius:0 8px 8px 0;font-size:13px;font-weight:500;margin-bottom:10px"><b>Koç Analizi:</b> '+esc(plan.note)+'</div>'):'')
          +(plan.why?('<div style="color:#94a3b8;font-size:12px;margin-bottom:6px"><b>Gerekçe:</b> '+esc(plan.why)+'</div>'):'')
          +chartHtml
          +'<div style="font-size:12px;color:#94a3b8;font-weight:700;margin:12px 0 4px 2px">KAÇIŞI OLMAYAN GÜNLÜK EMİRLER:</div>'
          +stepsHtml+'</div>';
      } else {
        var a2=document.getElementById("dhDayStart");
        if(a2 && sub){ a2.href="./"+plan.steps[0].href;
          sub.innerHTML="<b>💥 KOÇ EMRETTİ: "+esc(plan.focus||"")+"</b> — "+plan.steps.map(function(s,i){return (i+1)+") "+esc(s.label);}).join(" → "); }
      }
    }catch(e){}
  }
  function esc(s){ return String(s||"").replace(/[<>&]/g,function(c){return {"<":"&lt;",">":"&gt;","&":"&amp;"}[c];}); }
  var __lastDue=0, __lastS1=0, __lastW1=0, __lastS2=0, __lastW2=0;
  
  function valid(p){
    if(!p||typeof p!=="object"||!Array.isArray(p.steps)) return null;
    var due = (p.dueCount!=null ? p.dueCount : __lastDue);
    p.dueCount=due;
    
    // Güvenlik süzgeci: href izinli mi kontrol et
    var aiSteps=p.steps.filter(function(s){ return s && s.label && isHrefAllowed(String(s.href||"")); });
    if(!window.__dhErrCount){ aiSteps=aiSteps.filter(function(s){ return s.href!=="hata-defteri.html"; }); }

    var spine=[];
    if(due>0) spine.push({label:"Geciken " + due+" öğeyi koç denetiminde temizle", href:"tekrar.html?plan=1"});
    
    // AI'dan gelen nokta atışı index-app.html?mod=... linkini bulmaya çalış
    var targetModStep = aiSteps.find(function(s){ return s.href.indexOf("index-app.html") === 0; });
    if(targetModStep) {
      spine.push(targetModStep);
    } else {
      spine.push({label:"Günlük yeni cümle hedefini tamamla", href:"index-app.html"});
    }
    
    spine.push({label:"Koçla 1 dakika canlı mülakat testi yap", href:"chat.html"});
    
    // Diğer ekstra adımları (hata defteri vs.) bağla
    var hrefs=spine.map(function(s){return s.href;});
    var bonus=aiSteps.find(function(s){ return hrefs.indexOf(s.href)<0; });
    p.steps = bonus ? spine.concat([bonus]) : spine;

    if(!p.steps.length) return null;
    p.focus=String(p.focus||"").slice(0,120); p.note=String(p.note||"").slice(0,140);
    p.why=String(p.why||"").slice(0,180);
    if(!p.stats) p.stats={due:due, s2:__lastS2||0, w2:__lastW2||0, s1:__lastS1||0, w1:__lastW1||0};
    return p;
  }

  async function run(){
    try{
      try{ window.__dhErrCount = window.LearningErrorDB&&LearningErrorDB.all ? (await LearningErrorDB.all()||[]).length : 0; }catch(e){ window.__dhErrCount=0; }
      var cached=localStorage.getItem(KEY);
      if(cached){ var cp=valid(JSON.parse(cached)); if(cp) paint(cp); return; }
      if(!(window.DHProviders&&DHProviders.chat&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey())) return;
      var prof=await profile(); if(!prof) return;
      var sys='Sen disiplinli, tavizsiz ve yönlendirici bir İNGİLİZCE BAŞANTRENÖRSÜN. '
        +'Görevin kullanıcıyı koca modül listesinde yalnız bırakmak değil, doğrudan hedef göstermektir. '
        +'Sana profilde kullanıcının yarım kalan modülleri (örn: A1-M01-P2:7/25) veya sıradaki boş modülü verilecek. '
        +'SENİN KURALIN: steps dizisindeki cümle çalışma adımının href değerini kesinlikle "index-app.html?mod=MODÜL_KODU" şeklinde üretmelisiniz (Örn: "index-app.html?mod=A1-M01-P2"). '
        +'Asla düz "index-app.html" linki verme, nokta atışı hedefi parametre olarak ekle! '
        +'Cümlelerinde esnek olma; "yap, bitir, yarıda bırakma" gibi emir kipleri kullan. '
        +'SADECE JSON döndür, açıklama yok: {"focus":"Bugünün nokta atışı emir cümlesi (Türkçe)","note":"Yarım bıraktığı veya geçmesi gereken modülle ilgili koç fırçası/uyarısı (Türkçe, max 15 kelime)","why":"Neden bu spesifik modülü seçtiğini sayılarla açıklayan gerekçe (Türkçe, max 20 kelime)","steps":[{"label":"Emir kipiyle modül odaklı kısa adım (Örn: A1-M01-P2 modülünü bitir)","href":"index-app.html?mod=A1-M01-P2"}]} steps içinde index-app.html?mod=... formatı ZORUNLUDUR.';
      
      var out=await DHProviders.chat([{role:"system",content:sys},{role:"user",content:prof}],{temperature:0.4,max_tokens:400});
      var plan=null; try{ plan=valid(JSON.parse(String(out).replace(/```json|```/g,"").trim())); }catch(e){}
      if(!plan) return;
      localStorage.setItem(KEY,JSON.stringify(plan));
      for(var i=localStorage.length-1;i>=0;i--){ var k=localStorage.key(i); if(k&&k.indexOf("dh-koc-plan-")===0&&k!==KEY) localStorage.removeItem(k); }
      paint(plan);
    }catch(e){}
  }
  if(document.readyState!=="loading") setTimeout(run,1200);
  else document.addEventListener("DOMContentLoaded",function(){ setTimeout(run,1200); });
})();