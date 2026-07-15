/* error-drill.js — 🏋️ HATA ANTRENMANI (koçun interaktif hata çalıştırıcısı)
   Öğrencinin KENDİ hata kayıtlarından (LearningErrorDB) üç tip alıştırma üretir:
     1) DÜZELT: yanlış cümle gösterilir, doğrusunu yazar
     2) BOŞLUK: doğru cümlede TAM HATA YAPTIĞI kelimeler boşluk olur
     3) SEÇ: doğru / kendi yanlışı / kural tabanlı çeldirici arasından seçer
   Sonuçlar hata defterinin kendi SRS'ine işlenir (markReviewed):
   doğru → "easy" (tekrar önceliği düşer), yanlış → "hard" (öne gelir).
   Takılınca: 🧑‍🏫 Öğretmenle çalış (?focus=tür) + 🤖 Neden? (tek AI çağrısı).
   Kullanım: dhErrorDrill.open()  veya  dhErrorDrill.open(errorListesi)
   coach-bubble bu dosyayı İHTİYAÇ ANINDA yükler (HTML'lere ekleme gerekmez). */
(function(){
  "use strict";
  if(window.dhErrorDrill) return;

  /* ---------- yardımcılar ---------- */
  function esc(t){ return String(t==null?"":t).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function norm(t){ return String(t||"").toLowerCase().replace(/[^a-z0-9ğüşöçıi']+/g," ").trim(); }
  function words(t){ return norm(t).split(" ").filter(Boolean); }
  function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var x=a[i]; a[i]=a[j]; a[j]=x; } return a; }
  function teacherHref(focus){
    var sel="teacher1"; try{ sel=localStorage.getItem("selectedTeacherAvatar")||"teacher1"; }catch(e){}
    var page=sel==="teacher2"?"chatteacher2.html":"chatteacher1.html";
    return "./"+page+(focus?("?focus="+encodeURIComponent(focus)):"");
  }
  var TL=(window.DH_COACH_TYPE_LABEL||{}), TT=(window.DH_COACH_TYPE_TIP||{});

  /* ---------- soru üretimi ---------- */
  function makeCloze(err){
    var tw=words(err.target), aw={}; words(err.answer).forEach(function(w){ aw[w]=1; });
    var missing=tw.filter(function(w){ return !aw[w]; }).slice(0,2);
    if(!missing.length) return null;               // kelime farkı yok → düzelt tipine düş
    var re=new RegExp("\\b("+missing.map(function(w){ return w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }).join("|")+")\\b","ig");
    var shown=esc(err.target).replace(re,'<b style="color:#facc15">____</b>');
    return { kind:"cloze", err:err, missing:missing, shown:shown,
      prompt:"Boşlukları doldur — tam hata yaptığın yer:" };
  }
  function makeChoice(err){
    var opts=[err.target];
    if(norm(err.answer)!==norm(err.target)) opts.push(err.answer);
    /* kural tabanlı çeldirici: yardımcı fiili düşür / makaleyi kaldır */
    var d=String(err.target).replace(/\b(is|are|am|was|were)\b\s*/i,"");
    if(norm(d)!==norm(err.target) && opts.every(function(o){return norm(o)!==norm(d);})) opts.push(d);
    var d2=String(err.target).replace(/\b(a|an|the)\b\s*/i,"");
    if(opts.length<3 && norm(d2)!==norm(err.target) && opts.every(function(o){return norm(o)!==norm(d2);})) opts.push(d2);
    if(opts.length<2) return null;
    return { kind:"choice", err:err, options:shuffle(opts.slice(0,3)),
      prompt:"Hangisi doğru?" };
  }
  function makeFix(err){
    return { kind:"fix", err:err,
      prompt:"Bu cümlede hata var — doğrusunu yaz:" };
  }
  function buildQueue(errs){
    var q=[];
    errs.forEach(function(err,i){
      if(!err || !err.target) return;
      var maker=[makeCloze,makeChoice,makeFix][i%3];
      q.push(maker(err) || makeFix(err));
    });
    return shuffle(q);
  }

  /* ---------- cevap kontrolü ---------- */
  function checkAnswer(item, val){
    if(item.kind==="choice") return norm(val)===norm(item.err.target);
    if(item.kind==="cloze"){
      var got=words(val);
      return item.missing.every(function(w){ return got.indexOf(w)>=0; });
    }
    /* fix: normalize eşitliği (noktalama/harf duyarsız) */
    return norm(val)===norm(item.err.target);
  }

  /* ---------- UI ---------- */
  var S=null; // {queue, i, ok, wrong, typesWrong, overlay}
  function open(errs){
    if(document.getElementById("dhDrillOverlay")) return;
    var start=function(list){
      list=(list||[]).filter(function(r){ return r && r.target; }).slice(0,10);
      if(!list.length){ alert("Çalışılacak hata kaydı bulunamadı — önce biraz pratik yap 🙂"); return; }
      S={ queue:buildQueue(list), i:0, ok:0, wrong:0, typesWrong:{}, overlay:null };
      mount(); render();
    };
    if(Array.isArray(errs) && errs.length){ start(errs); return; }
    /* liste verilmediyse: bugünün hataları, yoksa en öncelikli 10 */
    if(!(window.LearningErrorDB&&LearningErrorDB.all)){ alert("Hata defteri modülü yüklü değil."); return; }
    LearningErrorDB.all().then(function(all){
      var t0=new Date(); t0.setHours(0,0,0,0);
      var today=all.filter(function(r){ return new Date(r.createdAt||0)>=t0; });
      var pool=today.length?today:all.sort(function(a,b){ return (b.reviewPriority||0)-(a.reviewPriority||0); });
      start(pool);
    });
  }

  function mount(){
    var ov=document.createElement("div");
    ov.id="dhDrillOverlay";
    ov.style.cssText="position:fixed;inset:0;z-index:2147483300;background:rgba(2,8,20,.8);display:flex;align-items:center;justify-content:center;padding:12px";
    ov.innerHTML='<div style="background:#0f1f3a;border:1px solid #1e3a5f;border-radius:18px;width:min(560px,96vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden">'
      +'<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #1e3a5f">'
      +'<b style="color:#e8eef7;font-size:16px;flex:1">🏋️ Hata Antrenmanı</b>'
      +'<span id="dhDrillProg" style="color:#9fb3d9;font-size:13px;font-weight:800"></span>'
      +'<button id="dhDrillX" style="background:#13294d;border:1px solid #1e3a5f;color:#e8eef7;border-radius:8px;width:32px;height:32px;cursor:pointer">✕</button>'
      +'</div>'
      +'<div id="dhDrillBody" style="padding:16px;overflow-y:auto;color:#dbe7ff;font-size:14.5px;line-height:1.6"></div>'
      +'</div>';
    document.body.appendChild(ov);
    document.getElementById("dhDrillX").onclick=function(){ ov.remove(); S=null; };
    S.overlay=ov;
  }

  function render(){
    var body=document.getElementById("dhDrillBody"), prog=document.getElementById("dhDrillProg");
    if(!body) return;
    if(S.i>=S.queue.length){ return renderDone(body, prog); }
    var item=S.queue[S.i];
    prog.textContent=(S.i+1)+"/"+S.queue.length;
    var html='<div style="color:#93c5fd;font-weight:800;margin-bottom:8px">'+esc(item.prompt)+'</div>';
    if(item.err.sentenceTR) html+='<div style="font-size:12.5px;color:#9fb3d9;margin-bottom:8px">İpucu (TR): '+esc(item.err.sentenceTR)+'</div>';
    if(item.kind==="fix"){
      html+='<div style="background:#2a0f14;border:1px solid #7f1d1d;border-radius:10px;padding:10px;margin-bottom:10px">✗ '+esc(item.err.answer||"")+'</div>'
        +'<input id="dhDrillInp" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="Doğrusunu yaz..." '
        +'style="width:100%;background:#0b1120;border:1px solid #1e3a5f;color:#e8eef7;border-radius:10px;padding:12px;font-size:15px">';
    } else if(item.kind==="cloze"){
      html+='<div style="background:#13294d;border:1px solid #1e3a5f;border-radius:10px;padding:12px;margin-bottom:10px;font-size:16px">'+item.shown+'</div>'
        +'<input id="dhDrillInp" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="Eksik kelime(ler)i yaz..." '
        +'style="width:100%;background:#0b1120;border:1px solid #1e3a5f;color:#e8eef7;border-radius:10px;padding:12px;font-size:15px">';
    } else {
      html+=item.options.map(function(o,i){
        return '<button class="dhDrillOpt" data-v="'+esc(o)+'" style="display:block;width:100%;text-align:left;margin-top:8px;'
          +'background:#13294d;border:1px solid #1e3a5f;color:#e8eef7;border-radius:10px;padding:12px;font-size:15px;cursor:pointer">'+esc(o)+'</button>';
      }).join("");
    }
    if(item.kind!=="choice"){
      html+='<div style="display:flex;gap:8px;margin-top:10px">'
        +'<button id="dhDrillGive" style="flex:1;background:#334155;border:0;color:#fff;border-radius:10px;padding:11px;font-weight:800;cursor:pointer">Bilmiyorum</button>'
        +'<button id="dhDrillChk" style="flex:1;background:#2563eb;border:0;color:#fff;border-radius:10px;padding:11px;font-weight:800;cursor:pointer">Kontrol ✓</button>'
        +'</div>';
    }
    html+='<div id="dhDrillFb" style="margin-top:12px;min-height:24px"></div>';
    body.innerHTML=html;
    var inp=document.getElementById("dhDrillInp");
    if(inp){ inp.focus(); inp.addEventListener("keydown",function(e){ if(e.key==="Enter") submit(inp.value); }); }
    var chk=document.getElementById("dhDrillChk"); if(chk) chk.onclick=function(){ submit(inp?inp.value:""); };
    var gv=document.getElementById("dhDrillGive"); if(gv) gv.onclick=function(){ submit("__give_up__"); };
    body.querySelectorAll(".dhDrillOpt").forEach(function(b){ b.onclick=function(){ submit(b.getAttribute("data-v")); }; });
  }

  function submit(val){
    var item=S.queue[S.i];
    var fb=document.getElementById("dhDrillFb");
    if(!fb || fb.dataset.done) return;
    fb.dataset.done="1";
    var ok = val!=="__give_up__" && checkAnswer(item, val);
    var tp=item.err.primaryType||"general";
    try{ if(window.LearningErrorDB&&LearningErrorDB.markReviewed&&item.err.id) LearningErrorDB.markReviewed(item.err.id,{grade: ok?"easy":"hard"}); }catch(e){}
    if(ok){
      S.ok++;
      fb.innerHTML='<div style="color:#4ade80;font-weight:900">✓ Doğru! '+esc(item.err.target)+'</div>';
      setTimeout(next, 1100);
    } else {
      S.wrong++; S.typesWrong[tp]=(S.typesWrong[tp]||0)+1;
      fb.innerHTML='<div style="color:#f87171;font-weight:900">✗ Doğrusu: <span style="color:#4ade80">'+esc(item.err.target)+'</span></div>'
        +'<div style="font-size:12.5px;color:#9fb3d9;margin-top:5px">'+esc(TT[tp]||"Bu kalıba dikkat.")+'</div>'
        +'<div style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap">'
        +'<a href="'+teacherHref(tp)+'" style="background:#1d4ed8;color:#fff;text-decoration:none;font-weight:800;font-size:12px;padding:7px 11px;border-radius:999px">🧑‍🏫 Öğretmenle çalış</a>'
        +(window.DHProviders&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey()
          ? '<button id="dhDrillWhy" style="background:#7c3aed;border:0;color:#fff;font-weight:800;font-size:12px;padding:7px 11px;border-radius:999px;cursor:pointer">🤖 Neden?</button>':'')
        +'<button id="dhDrillNext" style="background:#334155;border:0;color:#fff;font-weight:800;font-size:12px;padding:7px 11px;border-radius:999px;cursor:pointer">Devam →</button>'
        +'</div><div id="dhDrillWhyOut" style="margin-top:8px;font-size:13px;white-space:pre-wrap"></div>';
      var nb=document.getElementById("dhDrillNext"); if(nb) nb.onclick=next;
      var wb=document.getElementById("dhDrillWhy");
      if(wb) wb.onclick=function(){
        wb.disabled=true; wb.textContent="⏳";
        var out=document.getElementById("dhDrillWhyOut");
        DHProviders.chat([
          {role:"system",content:"Türkçe konuşan İngilizce öğretmenisin. Öğrencinin yanlışı ile doğrusu verilecek. NEDEN yanlış olduğunu en fazla 3 kısa Türkçe cümleyle, kuralı net söyleyerek açıkla."},
          {role:"user",content:"Yanlış: "+(item.err.answer||val)+"\nDoğru: "+item.err.target}
        ],{temperature:0.3,max_tokens:220}).then(function(t){ out.textContent=String(t||"").trim(); wb.remove(); })
         .catch(function(){ out.textContent="Açıklama alınamadı — öğretmene sorabilirsin."; wb.remove(); });
      };
    }
  }
  function next(){ S.i++; render(); }

  function renderDone(body, prog){
    prog.textContent="";
    var total=S.ok+S.wrong, pct=total?Math.round(100*S.ok/total):0;
    var worst=null, wn=0;
    for(var t in S.typesWrong){ if(S.typesWrong[t]>wn){ wn=S.typesWrong[t]; worst=t; } }
    body.innerHTML='<div style="text-align:center;padding:8px 0">'
      +'<div style="font-size:42px">'+(pct>=80?"🏆":(pct>=50?"💪":"🌱"))+'</div>'
      +'<div style="font-size:20px;font-weight:900;color:#e8eef7;margin-top:6px">%'+pct+' — '+S.ok+'/'+total+' doğru</div>'
      +(worst
        ? '<div style="margin-top:10px;color:#9fb3d9;font-size:13.5px">En çok zorlandığın: <b style="color:#facc15">'+esc(TL[worst]||worst)+'</b></div>'
          +'<a href="'+teacherHref(worst)+'" style="display:inline-block;margin-top:12px;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:800;padding:11px 18px;border-radius:999px">🧑‍🏫 Öğretmenle bu konuyu çalış</a>'
        : '<div style="margin-top:10px;color:#4ade80;font-weight:800">Tüm hatalarını yendin — defter temizleniyor! 🎉</div>')
      +'<div style="margin-top:14px"><button id="dhDrillClose2" style="background:#334155;border:0;color:#fff;border-radius:10px;padding:11px 22px;font-weight:800;cursor:pointer">Kapat</button></div>'
      +'</div>';
    document.getElementById("dhDrillClose2").onclick=function(){ S.overlay.remove(); S=null; };
    try{ window.dhLogActivity && window.dhLogActivity("🏋️ Hata antrenmanı: %"+pct+" ("+S.ok+"/"+total+")","drill"); }catch(e){}
  }

  window.dhErrorDrill={ open:open };
})();
