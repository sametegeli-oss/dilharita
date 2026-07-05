/* koc.js — AI KOÇ: günde 1 kez profil → öğretmen → günün planı.
   Kurallar: AI yalnız ÖNERİR (hiç veri yazmaz) · plan günlük önbellekte ·
   AI yoksa/parse hatasında banner statik haline dokunulmaz (sessiz düşüş). */
(function(){
  "use strict";
  var DAY=new Date().toISOString().slice(0,10), KEY="dh-koc-plan-"+DAY;
  var ALLOWED=["tekrar.html?plan=1","index-app.html","chat.html","practice.html","kelime-ogren.html","hata-defteri.html"];

  async function profile(){
    var p=[];
    try{ var tr=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}, d=new Date(), st=0;
      for(;;){ if((tr.days||{})[d.toISOString().slice(0,10)]){st++;d.setDate(d.getDate()-1);} else break; }
      if(st) p.push("Seri:"+st+" gün.");
    }catch(e){}
    try{ var m=JSON.parse(localStorage.getItem("dh-progress-mirror-v1")||"{}")||{}, s1=0,w1=0;
      for(var k in m){ if(m[k]&&m[k][0]===1){ if(k.indexOf("sentence:")===0)s1++; else if(k.indexOf("word:")===0)w1++; } }
      p.push("Çalışılan cümle:"+s1+", kelime:"+w1+".");
    }catch(e){}
    try{ if(window.LearningErrorDB&&LearningErrorDB.all){
      var errs=await LearningErrorDB.all(), t={};
      (errs||[]).slice(-60).forEach(function(r){ if(r&&r.type) t[r.type]=(t[r.type]||0)+1; });
      var top=Object.keys(t).sort(function(a,b){return t[b]-t[a]}).slice(0,3);
      if(top.length) p.push("Sık hatalar:"+top.join(",")+".");
    }}catch(e){}
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
      var a=document.getElementById("dhDayStart"), sub=document.getElementById("dhDaySub");
      if(!a||!sub||!plan||!plan.steps||!plan.steps.length) return;
      var first=plan.steps[0];
      a.href="./"+first.href;
      var b=a.querySelector("b"); if(b) b.textContent="🧭 Koçun Bugünkü Planı";
      sub.innerHTML="<b>"+esc(plan.focus||"")+"</b> — "
        +plan.steps.map(function(s,i){ return (i+1)+") "+esc(s.label); }).join(" → ")
        +(plan.note?('<br><span style="opacity:.8">💬 '+esc(plan.note)+"</span>"):"");
    }catch(e){}
  }
  function esc(s){ return String(s||"").replace(/[<>&]/g,function(c){return {"<":"&lt;",">":"&gt;","&":"&amp;"}[c];}); }
  function valid(p){
    if(!p||typeof p!=="object"||!Array.isArray(p.steps)) return null;
    p.steps=p.steps.filter(function(s){ return s&&s.label&&ALLOWED.indexOf(String(s.href||""))>=0; }).slice(0,4);
    if(!p.steps.length) return null;
    p.focus=String(p.focus||"").slice(0,120); p.note=String(p.note||"").slice(0,140);
    return p;
  }

  async function run(){
    try{
      var cached=localStorage.getItem(KEY);
      if(cached){ var cp=valid(JSON.parse(cached)); if(cp) paint(cp); return; }
      if(!(window.DHProviders&&DHProviders.chat&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey())) return;
      var prof=await profile(); if(!prof) return;
      var sys='Türk öğrencinin İngilizce koçusun. Profile göre BUGÜN için kısa plan yap. SADECE JSON döndür, açıklama yok: {"focus":"günün odağı tek cümle (Türkçe)","note":"kısa motivasyon/uyarı (Türkçe, en çok 15 kelime)","steps":[{"label":"adım (Türkçe, kısa)","href":"..."}]} steps 2-4 adet olacak ve href YALNIZ şunlardan biri: '+ALLOWED.join(", ");
      var out=await DHProviders.chat([{role:"system",content:sys},{role:"user",content:prof}],{temperature:0.4,max_tokens:400});
      var plan=null; try{ plan=valid(JSON.parse(String(out).replace(/```json|```/g,"").trim())); }catch(e){}
      if(!plan) return;                      // sessiz düşüş: banner statik kalır
      localStorage.setItem(KEY,JSON.stringify(plan));
      // eski gün planlarını temizle
      for(var i=localStorage.length-1;i>=0;i--){ var k=localStorage.key(i); if(k&&k.indexOf("dh-koc-plan-")===0&&k!==KEY) localStorage.removeItem(k); }
      paint(plan);
    }catch(e){}
  }
  if(document.readyState!=="loading") setTimeout(run,1200);
  else document.addEventListener("DOMContentLoaded",function(){ setTimeout(run,1200); });
})();
