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
function render(data){
  css();
  var ov=document.createElement("div"); ov.className="dhgr-ov";
  var roots=Array.isArray(data&&data.kokNedenler)?data.kokNedenler:[];
  var html=''
   +'<div class="dhgr-card">'
   +'<h3>💎 Gemini Hata Karnen</h3>'
   +'<p class="dhgr-sub">Kök nedenler ve sana özel alıştırmalar — cevabını yazıp "Kontrol et" diyebilirsin.</p>';

  if(data&&data.ozet){
    html+='<div class="dhgr-sec"><h4>📋 Genel değerlendirme</h4><p>'+esc(data.ozet)+'</p></div>';
  }
  roots.forEach(function(rt,ri){
    html+='<div class="dhgr-sec"><div class="dhgr-root"><b>'+(ri+1)+'. '+esc(rt.baslik||"Kök neden")+'</b></div>';
    if(rt.aciklama) html+='<p>'+esc(rt.aciklama)+'</p>';
    if(rt.ornek) html+='<p style="color:#fbbf24;font-size:12.5px">↳ Örnek: '+esc(rt.ornek)+'</p>';
    var ex=Array.isArray(rt.alistirmalar)?rt.alistirmalar:[];
    ex.forEach(function(q,qi){
      if(!q||!q.tr) return;
      var id="dhgr-"+ri+"-"+qi;
      html+='<div class="dhgr-ex" data-en="'+esc(q.en||"")+'">'
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
  var plan=Array.isArray(data&&data.calismaPlani)?data.calismaPlani:[];
  if(plan.length){
    html+='<div class="dhgr-sec"><h4>🎯 Bu haftaki çalışma planın</h4><ul class="dhgr-plan">'
      +plan.map(function(p){ return '<li>'+esc(p)+'</li>'; }).join("")+'</ul></div>';
  }
  html+='<div class="dhgr-row">'
      +'<button class="dhgr-again" type="button">🔄 Yeni karne al</button>'
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
      if(norm(got)===norm(want)){ fb.style.color="#4ade80"; fb.textContent="✓ Doğru!"; }
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
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mountRetry);
else mountRetry();
mount();

global.DHGeminiReport={ run:run, render:render, buildPrompt:buildPrompt, last:last, mount:mount };
})(window);
