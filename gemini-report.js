/* gemini-report.js — 💎 GEMINI HATA KARNESİ
   ------------------------------------------------------------------
   Hata defterindeki kayıtları tek zengin prompta paketler, gemini-bridge.js
   ile Gemini'ye gönderir; dönen JSON cevabı ayrıştırıp karneyi ekrana basar
   ve üretilen alıştırmaları çözülebilir hale getirir.

   Gerekli: gemini-bridge.js, learning-error-system.js
   Bağlanma: sayfada #geminiReportBtn düğmesi otomatik kurulur (hata-defteri.html).
   ------------------------------------------------------------------ */
(function(global){
"use strict";
if(global.DHGeminiReport) return;

var MAX_ERRORS = 40;   /* prompt şişmesin */
var LS_KEY = "dh-gemini-report-v1";

/* ---------- stil ---------- */
function css(){
  if(document.getElementById("dhgr-css")) return;
  var s=document.createElement("style"); s.id="dhgr-css";
  s.textContent =
   ".dhgr-ov{position:fixed;inset:0;z-index:1000001;background:rgba(2,6,23,.75);display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto}"
  +".dhgr-card{width:100%;max-width:640px;background:#0d1b32;color:#e8eef7;border:1px solid #1e3a5f;border-radius:16px;padding:16px;margin:auto;box-shadow:0 18px 50px rgba(0,0,0,.5);font-family:Nunito,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}"
  +".dhgr-card h3{margin:0 0 2px;font-size:17px;font-weight:900}"
  +".dhgr-sub{font-size:12px;color:#9fb3d9;margin:0 0 12px}"
  +".dhgr-sec{background:#071120;border:1px solid #1e3a5f;border-radius:12px;padding:12px;margin-bottom:10px}"
  +".dhgr-sec h4{margin:0 0 6px;font-size:13.5px;font-weight:900;color:#38bdf8}"
  +".dhgr-sec p{margin:0 0 6px;font-size:13px;line-height:1.55;color:#cbd5e1}"
  +".dhgr-root{border-left:3px solid #f59e0b;padding-left:10px;margin-bottom:12px}"
  +".dhgr-root b{color:#fbbf24;font-size:13.5px}"
  +".dhgr-ex{background:#0b1830;border:1px solid #1e3a5f;border-radius:10px;padding:10px;margin-top:8px}"
  +".dhgr-q{font-size:13.5px;font-weight:800;margin-bottom:7px;line-height:1.45}"
  +".dhgr-in{width:100%;box-sizing:border-box;background:#071120;color:#e8eef7;border:1px solid #1e3a5f;border-radius:9px;padding:9px;font-size:13.5px;font-family:inherit}"
  +".dhgr-in:focus{outline:2px solid #38bdf8;outline-offset:1px}"
  +".dhgr-exrow{display:flex;gap:6px;margin-top:7px}"
  +".dhgr-exrow button{border:0;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer}"
  +".dhgr-chk{background:linear-gradient(180deg,#10b981,#059669);color:#fff}"
  +".dhgr-see{background:#13294d;color:#e8eef7;border:1px solid #1e3a5f!important}"
  +".dhgr-fb{font-size:12.5px;font-weight:800;margin-top:7px;min-height:16px;line-height:1.45}"
  +".dhgr-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}"
  +".dhgr-row button{flex:1;min-width:120px;border:0;border-radius:10px;padding:11px 8px;font-size:13px;font-weight:800;cursor:pointer}"
  +".dhgr-again{background:#8b5cf6;color:#fff}"
  +".dhgr-close{background:#334155;color:#e8eef7}"
  +".dhgr-plan{font-size:13px;line-height:1.6;color:#cbd5e1;margin:0;padding-left:18px}"
  +".dhgr-plan li{margin-bottom:4px}";
  document.head.appendChild(s);
}
function esc(s){
  return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}
function norm(t){
  return String(t||"").toLowerCase().replace(/[\u2019\u2018]/g,"'")
    .replace(/[^a-z0-9' ]+/g," ").replace(/\s+/g," ").trim();
}
function answerCorrect(got,want){
  if(norm(got)===norm(want)) return true;
  /* Mobilde SentenceAnalyzer gec/yuklenmemis olsa bile en temel yazim
     bicimleri yanlis sayilmasin. Bu yedek iki tarafi da ayni acik bicime
     cevirir; are not/aren't dahil butun yaygin daraltmalar esdegerdir. */
  var contractions={"don't":"do not","doesn't":"does not","didn't":"did not","isn't":"is not","aren't":"are not","wasn't":"was not","weren't":"were not","can't":"can not","cannot":"can not","couldn't":"could not","won't":"will not","wouldn't":"would not","shouldn't":"should not","mustn't":"must not","haven't":"have not","hasn't":"has not","hadn't":"had not","i'm":"i am","you're":"you are","we're":"we are","they're":"they are","he's":"he is","she's":"she is","it's":"it is","that's":"that is","there's":"there is","i've":"i have","you've":"you have","we've":"we have","they've":"they have"};
  function expanded(s){ return norm(s).split(" ").map(function(w){return contractions[w]||w;}).join(" "); }
  if(expanded(got)===expanded(want)) return true;
  /* Günlük karne, Hata Defteri'nin geri kalanıyla aynı cümle motorunu
     kullanmalı. Motor isn't/is not, aren't/are not gibi kısaltmaları açar;
     böylece doğru cevap yalnız yazım biçimi farklı diye reddedilmez. */
  try{
    if(global.SentenceAnalyzer&&typeof global.SentenceAnalyzer.analyze==="function"){
      return global.SentenceAnalyzer.analyze(want,got).verdict==="correct";
    }
  }catch(e){}
  return false;
}

/* ---------- prompt kurulumu ---------- */
function buildPrompt(records, summary){
  var lines=[], i;
  var use=records.slice(0, MAX_ERRORS);
  for(i=0;i<use.length;i++){
    var r=use[i];
    var t=r.target||r.sentenceEN||"";
    var a=r.answer||"(boş bırakıldı)";
    if(!t) continue;
    lines.push((lines.length+1)+". Doğrusu: "+t+"  |  Benim yazdığım: "+a
      + (r.count>1 ? "  (bu cümlede "+r.count+" kez hata)" : ""));
  }
  var types=(summary&&summary.byType||[]).slice(0,5)
    .map(function(x){ return x[0]+" ("+x[1]+")"; }).join(", ");

  return [
    "Sen deneyimli bir İngilizce öğretmenisin. Öğrencin Türk ve İngilizce öğreniyor.",
    "Aşağıda öğrencinin hata defterinden gerçek hataları var (doğru cümle ve öğrencinin yazdığı).",
    "",
    "Toplam hata: "+(summary&&summary.total||use.length)
      + (types ? "  |  Sistemin etiketlediği tipler: "+types : ""),
    "",
    "HATALAR:",
    lines.join("\n"),
    "",
    "GÖREV: Bu hataların ARKASINDAKİ 3 KÖK NEDENİ bul (tek tek hataları değil, tekrar eden yapısal sebebi).",
    "Her kök neden için: kısa Türkçe açıklama + öğrencinin kendi hatalarından örnek + 5 alıştırma cümlesi.",
    "Alıştırmalar Türkçe cümle olsun, öğrenci İngilizceye çevirsin; o kök nedeni hedeflesin.",
    "",
    "ÇOK ÖNEMLİ: Sadece aşağıdaki JSON'u döndür. Başka hiçbir metin, açıklama veya markdown yazma.",
    "",
    "{",
    '  "ozet": "Öğrencinin genel durumu, 2-3 cümle Türkçe",',
    '  "kokNedenler": [',
    '    {',
    '      "baslik": "Kök nedenin kısa adı",',
    '      "aciklama": "Neden bu hatayı yapıyor, Türkçe 2-3 cümle",',
    '      "ornek": "Öğrencinin kendi hatalarından bir örnek",',
    '      "alistirmalar": [',
    '        {"tr": "Türkçe cümle", "en": "Beklenen İngilizce cevap"}',
    '      ]',
    '    }',
    '  ],',
    '  "calismaPlani": ["Bu hafta yapılacak somut madde", "..."]',
    "}"
  ].join("\n");
}

/* ---------- karne gösterimi ---------- */
function today(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function dailyMode(){ return /[?&]gemini=gunluk(?:&|$)/.test(location.search); }
function lastMode(){ return /[?&]gemini=son(?:&|$)/.test(location.search); }
function dailyRootIndex(roots){ return roots.length ? Math.floor(new Date(today()+"T12:00:00").getTime()/86400000)%roots.length : 0; }
function dailyState(){ try{return JSON.parse(localStorage.getItem("dh-gemini-gunluk-"+today())||"null")||{correct:{}};}catch(e){return {correct:{}};} }
function saveDaily(st){ try{localStorage.setItem("dh-gemini-gunluk-"+today(),JSON.stringify(st));}catch(e){} }
function syncDailyPlan(count){
  try{
    var k="dh-gun-plan-"+today(), p=JSON.parse(localStorage.getItem(k)||"null");
    if(!p||!p.adimlar)return;
    for(var i=0;i<p.adimlar.length;i++) if(String(p.adimlar[i].tip||p.adimlar[i].id)==="hata"){
      p.adimlar[i].yapilan=Math.min(p.adimlar[i].hedef|0,count|0); break;
    }
    localStorage.setItem(k,JSON.stringify(p));
    if((count|0)>=3){
      /* Koç ayrı bir tamamlanma kanıtı okur. Yalnız DHPlan'i ilerletmek,
         özellikle mobilde kullanıcıyı yeniden karneye gönderen döngüydü. */
      var dk="dh-koc-steps-done-"+today(), ds=JSON.parse(localStorage.getItem(dk)||"{}")||{};
      ds["hata-defteri.html?gemini=gunluk"]=1;
      ds["hata-defteri.html"]=1;
      localStorage.setItem(dk,JSON.stringify(ds));
      localStorage.setItem("dh-gemini-daily-complete-"+today(),"1");
      try{ global.dispatchEvent(new CustomEvent("dh:task-complete",{detail:{type:"hata",source:"gemini-daily"}})); }catch(e){}
    }
  }catch(e){}
}
function render(data, options){
  css();
  options=options||{};
  var isDaily=options.daily===true||dailyMode();
  var ov=document.createElement("div"); ov.className="dhgr-ov";
  var roots=Array.isArray(data&&data.kokNedenler)?data.kokNedenler:[];
  var rootOffset=0;
  if(isDaily&&roots.length){ rootOffset=dailyRootIndex(roots); roots=[roots[rootOffset]]; }
  var html=''
   +'<div class="dhgr-card">'
   +'<h3>'+(isDaily?'🎯 Karnenden bugünün 3 sorusu':'💎 Gemini Hata Karnen')+'</h3>'
   +'<p class="dhgr-sub">'+(isDaily?'Bugün tek bir kök nedene odaklan. Üç doğru cevap günlük planındaki bu adımı tamamlar.':'Kök nedenler ve sana özel alıştırmalar — cevabını yazıp "Kontrol et" diyebilirsin.')+'</p>';

  if(!isDaily&&data&&data.ozet){
    html+='<div class="dhgr-sec"><h4>📋 Genel değerlendirme</h4><p>'+esc(data.ozet)+'</p></div>';
  }
  roots.forEach(function(rt,ri){
    html+='<div class="dhgr-sec"><div class="dhgr-root"><b>'+(ri+1)+'. '+esc(rt.baslik||"Kök neden")+'</b></div>';
    if(rt.aciklama) html+='<p>'+esc(rt.aciklama)+'</p>';
    if(rt.ornek) html+='<p style="color:#fbbf24;font-size:12.5px">↳ Örnek: '+esc(rt.ornek)+'</p>';
    var ex=Array.isArray(rt.alistirmalar)?rt.alistirmalar:[];
    if(isDaily) ex=ex.slice(0,3);
    ex.forEach(function(q,qi){
      if(!q||!q.tr) return;
      var realRi=isDaily?rootOffset:ri, id="dhgr-"+realRi+"-"+qi;
      html+='<div class="dhgr-ex" data-key="'+realRi+'-'+qi+'" data-en="'+esc(q.en||"")+'">'
        +'<div class="dhgr-q">'+(qi+1)+'. '+esc(q.tr)+'</div>'
        +'<input class="dhgr-in" id="'+id+'" placeholder="İngilizce çevirini yaz…" autocomplete="off" spellcheck="false">'
        +'<div class="dhgr-exrow">'
          +'<button class="dhgr-chk" type="button">Kontrol et</button>'
          +'<button class="dhgr-see" type="button">Cevabı gör</button>'
        +'</div>'
        +'<div class="dhgr-fb"></div>'
      +'</div>';
    });
    html+='</div>';
  });
  if(!roots.length){
    html+='<div class="dhgr-sec"><p>Cevapta kök neden bulunamadı. Gemini\'nin tüm JSON çıktısını yapıştırdığından emin ol.</p></div>';
  }
  var plan=!isDaily&&Array.isArray(data&&data.calismaPlani)?data.calismaPlani:[];
  if(plan.length){
    html+='<div class="dhgr-sec"><h4>🎯 Bu haftaki çalışma planın</h4><ul class="dhgr-plan">'
      +plan.map(function(p){ return '<li>'+esc(p)+'</li>'; }).join("")+'</ul></div>';
  }
  html+='<div class="dhgr-row">'
      +(isDaily?'':'<button class="dhgr-again" type="button">🔄 Yeni karne al</button>')
      +'<button class="dhgr-close" type="button">Kapat</button>'
    +'</div></div>';
  ov.innerHTML=html;
  document.body.appendChild(ov);

  /* alıştırma kontrolü */
  ov.addEventListener("click",function(e){
    var btn=e.target;
    if(!btn || !btn.classList) return;
    var box=btn.closest && btn.closest(".dhgr-ex");
    if(box && btn.classList.contains("dhgr-chk")){
      var want=box.getAttribute("data-en")||"";
      var got=box.querySelector(".dhgr-in").value||"";
      var fb=box.querySelector(".dhgr-fb");
      if(!got.trim()){ fb.style.color="#f59e0b"; fb.textContent="Önce cevabını yaz."; return; }
      if(answerCorrect(got,want)){
        fb.style.color="#4ade80"; fb.textContent="✓ Doğru!";
        if(isDaily){
          var st=dailyState(), key=box.getAttribute("data-key")||""; st.correct[key]=1; saveDaily(st);
          var n=Object.keys(st.correct).length; syncDailyPlan(n);
          if(n>=3){ fb.textContent="✓ Doğru! Bugünkü karne çalışman tamamlandı."; try{window.dhCoachSay&&dhCoachSay("Karnendeki kök nedeni 3 doğru cevapla pekiştirdin ✅","praise");}catch(_){} }
        }
      }
      else{ fb.style.color="#f87171"; fb.textContent="✗ Beklenen: "+want; }
      return;
    }
    if(box && btn.classList.contains("dhgr-see")){
      var fb2=box.querySelector(".dhgr-fb");
      fb2.style.color="#9fb3d9"; fb2.textContent="💡 "+(box.getAttribute("data-en")||"—");
      return;
    }
    if(btn.classList.contains("dhgr-close")){ ov.remove(); return; }
    if(btn.classList.contains("dhgr-again")){ ov.remove(); run(); return; }
    if(e.target===ov) ov.remove();
  });
  return ov;
}

/* ---------- ana akış ---------- */
function run(){
  if(!global.DHGemini){ alert("Gemini köprüsü yüklenmedi (gemini-bridge.js)."); return; }
  if(!global.LearningErrorDB){ alert("Hata defteri yüklenmedi."); return; }
  Promise.resolve(LearningErrorDB.all()).then(function(arr){
    var recs=(arr||[]).filter(function(r){ return r && (r.target||r.sentenceEN); });
    if(!recs.length){ alert("Defterde henüz hata yok — önce biraz pratik yap."); return; }
    var summary={};
    try{ summary=LearningErrorDB.summarize(recs)||{}; }catch(e){}
    var prompt=buildPrompt(recs, summary);
    DHGemini.ask({
      title:"💎 Hata karnesi al",
      hint:"Gemini'nin JSON cevabını buraya yapıştır ve Enter'a bas…",
      prompt:prompt,
      parse:function(text){
        var data=DHGemini.parsers.json(text);
        if(!data || (!data.kokNedenler && !data.ozet))
          throw new Error("JSON beklenen alanları içermiyor (kokNedenler/ozet).");
        return data;
      },
      onResult:function(data){
        try{ localStorage.setItem(LS_KEY, JSON.stringify({at:new Date().toISOString(), data:data})); }catch(e){}
        render(data);
      }
    });
  });
}
function last(){
  try{
    var o=JSON.parse(localStorage.getItem(LS_KEY)||"null");
    return o && o.data ? o : null;
  }catch(e){ return null; }
}

/* ---------- düğmeyi kur ---------- */
function mount(){
  var host=document.getElementById("aiCleanBtn");
  if(!host || document.getElementById("geminiReportBtn")) return;
  var b=document.createElement("button");
  b.id="geminiReportBtn";
  b.className=host.className||"btn";
  b.style.background="#8b5cf6";
  b.style.borderColor="#a78bfa";
  b.textContent="💎 Gemini Karnesi";
  b.title="Hatalarını Gemini'ye analiz ettir: kök nedenler + sana özel alıştırmalar";
  b.onclick=run;
  host.parentNode.insertBefore(b, host.nextSibling);
  /* daha önce alınmış karne varsa hızlı erişim */
  var prev=last();
  if(prev){
    var b2=document.createElement("button");
    b2.id="geminiReportLastBtn";
    b2.className=host.className||"btn";
    b2.style.background="#1e3a5f";
    b2.textContent="📄 Son karne";
    b2.onclick=function(){ var p=last(); if(p) render(p.data); };
    host.parentNode.insertBefore(b2, b.nextSibling);
  }
}
/* Düğme, hedef (#aiCleanBtn) sonradan oluşsa da kurulsun:
   hemen dene, DOMContentLoaded'da dene, kısa aralıklarla birkaç kez daha bak. */
function mountRetry(){
  mount();
  var n=0;
  var iv=setInterval(function(){
    mount();
    if(document.getElementById("geminiReportBtn") || ++n>10) clearInterval(iv);
  },400);
}
function autoDaily(){ if(!dailyMode())return; var p=last(); if(p&&p.data)render(p.data,{daily:true}); }
function autoLast(){ if(!lastMode())return; var p=last(); if(p&&p.data)render(p.data); }
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){mountRetry();autoDaily();autoLast();});
else { mountRetry(); autoDaily(); autoLast(); }
mount();

global.DHGeminiReport={ run:run, render:render, buildPrompt:buildPrompt, last:last, mount:mount, answerCorrect:answerCorrect };
})(window);
