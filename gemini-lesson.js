/* gemini-lesson.js — 💎 GEMINI İLE DERS (tek yönlü köprü)
   ------------------------------------------------------------------
   Mantık: uygulama SADECE ilk promptu kurar. Ders Gemini'de akar —
   her tur için kopyala/yapıştır YOK. Ders bitince öğrenci "BİTTİ" yazar,
   Gemini tek bir JSON özeti üretir, o özet buraya bir kez yapıştırılır:
   hatalar deftere işlenir, çalışma sayacı artar, öğrenme döngüsü kopmaz.

   İlk prompt şunları taşır: seviye, koç planı odağı ve öğrencinin
   HATA DEFTERİNDEN gerçek cümleleri (yanlış/doğru/Türkçesi).

   Gerekli: gemini-bridge.js (özet yapıştırma kutusu için)
   İsteğe bağlı: learning-error-system.js (malzeme + geri işleme)
   ------------------------------------------------------------------ */
(function(global){
"use strict";
if(global.DHGeminiLesson) return;

var GEMINI_URL="https://gemini.google.com/app";
var LS_PENDING="dh-gemini-lesson-pending";

/* ---------- stil ---------- */
function css(){
  if(document.getElementById("dhgl-css")) return;
  var s=document.createElement("style"); s.id="dhgl-css";
  s.textContent=
   ".dhgl-btn{background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff}"
  +".dhgl-ov{position:fixed;inset:0;z-index:1000002;background:rgba(2,6,23,.75);display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto}"
  +".dhgl-card{width:100%;max-width:540px;background:#0d1b32;color:#e8eef7;border:1px solid #1e3a5f;border-radius:16px;padding:16px;margin:auto;box-shadow:0 18px 50px rgba(0,0,0,.5);font-family:Nunito,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}"
  +".dhgl-card h3{margin:0 0 3px;font-size:17px;font-weight:900}"
  +".dhgl-sub{font-size:12.5px;color:#9fb3d9;margin:0 0 12px;line-height:1.5}"
  +".dhgl-steps{background:#071120;border:1px solid #1e3a5f;border-radius:12px;padding:11px 12px;margin-bottom:11px;font-size:13px;line-height:1.75;color:#cbd5e1}"
  +".dhgl-steps b{color:#a78bfa}"
  +".dhgl-mat{background:#071120;border:1px dashed #1e3a5f;border-radius:10px;padding:9px;margin-bottom:11px;font-size:12px;color:#9fb3d9;max-height:120px;overflow:auto}"
  +".dhgl-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:9px}"
  +".dhgl-row button{flex:1;min-width:140px;border:0;border-radius:11px;padding:12px 8px;font-size:13.5px;font-weight:800;cursor:pointer}"
  +".dhgl-copy{background:#1d4ed8;color:#fff}"
  +".dhgl-open{background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff}"
  +".dhgl-fin{background:linear-gradient(180deg,#10b981,#059669);color:#fff}"
  +".dhgl-close{background:#334155;color:#e8eef7}"
  +".dhgl-msg{font-size:12.5px;font-weight:700;min-height:17px;line-height:1.45;margin-bottom:4px}";
  document.head.appendChild(s);
}
function esc(s){
  return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}
function copyText(text){
  return new Promise(function(res){
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){res(true);},function(){res(fb());});
    } else res(fb());
    function fb(){
      try{
        var t=document.createElement("textarea");
        t.value=text; t.style.position="fixed"; t.style.opacity="0";
        document.body.appendChild(t); t.select();
        var ok=document.execCommand("copy"); document.body.removeChild(t); return ok;
      }catch(e){ return false; }
    }
  });
}

/* ---------- malzeme toplama ---------- */
function levelOf(){
  try{
    if(global.State && State.level) return State.level;
    var m=/(^|:)(A1|A2|B1|B2|C1)(:|$)/.exec(localStorage.getItem("dh-level")||"");
    if(m) return m[2];
  }catch(e){}
  return "A2";
}
function teachCtx(){
  try{
    var r=sessionStorage.getItem("dh-teach-focus");
    if(!r) return null;
    var o=JSON.parse(r);
    if(!o || Date.now()-(o.t||0)>2*3600000) return null;
    return o;
  }catch(e){ return null; }
}
function urlFocus(){
  try{ var f=new URLSearchParams(location.search).get("focus")||""; return f.trim(); }catch(e){ return ""; }
}
function gatherErrors(){
  return new Promise(function(done){
    var ctx=teachCtx();
    /* KOÇ ODAĞI ÖNCELİKLİDİR: koç seni belirli bir konuya gönderdiyse
       ("Öğretmenle çalış — konu: X"), Gemini dersi de o konudan kurulmalı,
       deftere göre genelleşmemeli. */
    if(ctx && ctx.items && ctx.items.length)
      return done({label:ctx.label||urlFocus()||"", items:ctx.items.slice(0,8), from:"coach"});
    if(ctx && ctx.target)   /* tek cümlelik odak da geçerli malzemedir */
      return done({label:ctx.label||urlFocus()||"", from:"coach",
        items:[{target:ctx.target, answer:ctx.answer||"", tr:ctx.tr||"", type:ctx.type||""}]});

    var focus=urlFocus();
    var JUNK=/^(review|tekrar|practice|pratik|study|genel|general|plan|devam)$/i;
    if(focus && JUNK.test(focus)) focus="";

    if(!(global.LearningErrorDB && global.LearningErrorDB.all))
      return done({label:focus, items:[], from:focus?"focus":""});
    Promise.resolve(global.LearningErrorDB.all()).then(function(all){
      all=(all||[]).filter(function(r){ return r && r.target; });
      var TL=global.DH_COACH_TYPE_LABEL||{};
      var pick=[];
      /* URL'de gerçek bir konu etiketi varsa önce o türdeki hataları getir */
      if(focus){
        pick=all.filter(function(r){ return (r.primaryType||"")===focus || (r.types||[]).indexOf(focus)>=0; });
      }
      if(!pick.length){
        var t0=new Date(); t0.setHours(0,0,0,0);
        pick=all.filter(function(r){ return new Date(r.createdAt||0)>=t0; });
      }
      if(!pick.length) pick=all.slice().sort(function(a,b){ return (b.reviewPriority||0)-(a.reviewPriority||0); });
      pick=pick.slice(0,8);
      var lbl=focus ? (TL[focus]||focus)
                    : (pick.length?(TL[pick[0].primaryType]||pick[0].primaryType||""):"");
      done({ label:lbl, from:focus?"focus":"", items:pick.map(function(r){
        return { target:r.target, answer:r.answer||"", tr:r.sentenceTR||"", type:r.primaryType||"" }; }) });
    }).catch(function(){ done({label:focus,items:[],from:focus?"focus":""}); });
  });
}

/* ---------- ilk prompt ---------- */
function buildPrompt(mat){
  var lines=(mat.items||[]).map(function(it,i){
    return (i+1)+". Doğrusu: "+it.target
      +(it.answer?("  |  Benim yazdığım: "+it.answer):"")
      +(it.tr?("  |  Türkçesi: "+it.tr):"");
  });
  var topic = mat.label
    ? (mat.from==="coach"
        ? "Koçum beni bugün ŞU KONUYA çalışmaya gönderdi: "+mat.label+". Dersi bu konu üzerine kur."
        : "Bugünün konusu: "+mat.label)
    : "Bugünün konusu: kendi hatalarım";
  return [
    "Sen benim İngilizce öğretmenimsin. Ben Türkçe konuşuyorum, seviyem "+levelOf()+".",
    "Bu sohbet baştan sona bir DERS olacak; ben burada seninle çalışacağım.",
    "",
    topic,
    "",
    (lines.length
      ? "HATA DEFTERİMDEN BU KONUYLA İLGİLİ GERÇEK HATALARIM:\n"+lines.join("\n")
      : "Hata defterim şu an boş; yukarıdaki konudan seviyeme uygun başlat."),
    "",
    "DERSİ ŞÖYLE YÜRÜT:",
    "1) Kısa selam + bugün bu konuda ne çalışacağımızı TEK cümlede söyle. Konu dışına çıkma.",
    "2) Hataları kök nedene göre grupla. Her grup için 2-3 cümlelik Türkçe açıklama yap ve benim kendi yanlış cümlemi yanlış→doğru göster.",
    "3) Sonra alıştırma yaptır: BİR SEFERDE TEK SORU sor ve cevabımı bekle. Uzun listeler verme.",
    "4) Cevabımı düzelt, tek satır Türkçe ipucu ver, sonra bir sonraki soruya geç.",
    "5) Kolaydan zora ilerle. Aynı hatayı tekrarlarsam daha basit bir örneğe dön.",
    "6) Cevaplarını kısa tut (en fazla 4-5 satır). Beni konuşturmaya öncelik ver.",
    "",
    "DERSİN SONU — ÇOK ÖNEMLİ:",
    "Ben 'BİTTİ' yazdığımda ders biter ve SADECE aşağıdaki JSON'u yazarsın.",
    "Başka hiçbir metin, açıklama veya markdown ekleme:",
    "",
    "{",
    '  "ozet": "Dersin 1-2 cümlelik Türkçe özeti",',
    '  "sure_dk": 15,',
    '  "hatalar": [',
    '    {"dogru": "İngilizce doğru cümle", "benimki": "benim yanlış yazdığım", "tr": "Türkçesi", "tur": "tense|order|article|preposition|vocab|general"}',
    "  ],",
    '  "basarilar": ["Bu derste doğru yaptığım şeyler"],',
    '  "sonraki_konu": "Bir sonraki derste çalışılacak konu"',
    "}",
    "",
    "Şimdi dersi başlat."
  ].join("\n");
}

/* ---------- özet → deftere işleme ---------- */
function ingest(data){
  return new Promise(function(done){
    var added=0, errs=Array.isArray(data&&data.hatalar)?data.hatalar:[];
    var jobs=[];
    if(global.LearningErrorDB && global.LearningErrorDB.add){
      errs.forEach(function(h){
        if(!h || !h.dogru) return;
        jobs.push(Promise.resolve(global.LearningErrorDB.add({
          target:h.dogru, answer:h.benimki||"", sentenceTR:h.tr||"",
          types:h.tur?[String(h.tur)]:undefined,
          module:"Gemini Ders", source:"gemini-lesson", grade:"hard"
        })).then(function(r){ if(r) added++; }).catch(function(){}));
      });
    }
    Promise.all(jobs).then(function(){
      /* çalışma sayacı: ders bir "ders" olarak işlenir */
      try{ if(global.dhBumpDailyTracker) global.dhBumpDailyTracker("lesson"); }catch(e){}
      try{ if(global.dhLogActivity) global.dhLogActivity("💎 Gemini ile ders tamamlandı"+(added?(" · "+added+" hata deftere eklendi"):""),"info"); }catch(e){}
      try{ localStorage.removeItem(LS_PENDING); }catch(e){}
      done(added);
    });
  });
}

/* ---------- ekran ---------- */
function open(){
  css();
  gatherErrors().then(function(mat){
    var prompt=buildPrompt(mat);
    var ov=document.createElement("div"); ov.className="dhgl-ov";
    var matHtml=(mat.items||[]).length
      ? '<div class="dhgl-mat"><b>Derse gidecek malzeme ('+mat.items.length+' cümle)'+(mat.label?(" · "+esc(mat.label)):"")+':</b><br>'
        +mat.items.slice(0,4).map(function(i){ return "✗ "+esc(i.answer||"—")+" → ✓ "+esc(i.target); }).join("<br>")
        +((mat.items.length>4)?("<br>… ve "+(mat.items.length-4)+" tane daha"):"")+'</div>'
      : '<div class="dhgl-mat">Defterinde hata yok — Gemini seviyene uygun bir dersle başlayacak.</div>';
    ov.innerHTML=
      '<div class="dhgl-card">'
     +'<h3>💎 Gemini ile ders</h3>'
     +'<p class="dhgl-sub">Ders Gemini\'de akar — her cümle için kopyala/yapıştır yok. Sadece başlarken bir kez, bitirirken bir kez.</p>'
     +matHtml
     +'<div class="dhgl-steps">'
       +'<b>1.</b> Promptu kopyala &nbsp;→&nbsp; <b>2.</b> Gemini\'yi aç, yapıştır, gönder<br>'
       +'<b>3.</b> Dersi orada yap (istediğin kadar konuş)<br>'
       +'<b>4.</b> Bitince Gemini\'ye <b>BİTTİ</b> yaz → özet JSON verir<br>'
       +'<b>5.</b> Buraya dönüp <b>“Dersi bitirdim”</b>e bas, özeti yapıştır'
     +'</div>'
     +'<div class="dhgl-row">'
       +'<button class="dhgl-copy" type="button">📋 1. Promptu kopyala</button>'
       +'<button class="dhgl-open" type="button">🚀 2. Gemini\'yi aç</button>'
     +'</div>'
     +'<div class="dhgl-msg"></div>'
     +'<div class="dhgl-row">'
       +'<button class="dhgl-fin" type="button">✅ Dersi bitirdim — özeti yapıştır</button>'
       +'<button class="dhgl-close" type="button">Kapat</button>'
     +'</div>'
     +'</div>';
    document.body.appendChild(ov);
    var msg=ov.querySelector(".dhgl-msg");
    function say(t,c){ msg.textContent=t||""; msg.style.color=c||"#9fb3d9"; }

    ov.querySelector(".dhgl-copy").onclick=function(){
      var b=this;
      copyText(prompt).then(function(ok){
        b.textContent=ok?"✅ Kopyalandı":"⚠️ Kopyalanamadı";
        say(ok?"Prompt panoda. Gemini'yi açıp yapıştır ve gönder — ders orada başlar."
               :"Kopyalanamadı, tarayıcı izin vermedi.", ok?"#4ade80":"#f59e0b");
        setTimeout(function(){ b.textContent="📋 1. Promptu kopyala"; },2200);
        try{ localStorage.setItem(LS_PENDING, String(Date.now())); }catch(e){}
      });
    };
    ov.querySelector(".dhgl-open").onclick=function(){
      try{ global.open(GEMINI_URL,"_blank","noopener"); }
      catch(e){ say("Gemini açılamadı — gemini.google.com adresine git.","#f59e0b"); }
    };
    ov.querySelector(".dhgl-close").onclick=function(){ ov.remove(); };
    ov.addEventListener("click",function(e){ if(e.target===ov) ov.remove(); });
    ov.querySelector(".dhgl-fin").onclick=function(){
      if(!global.DHGemini){ say("Özet kutusu yüklenmedi (gemini-bridge.js).","#f59e0b"); return; }
      ov.remove();
      global.DHGemini.ask({
        title:"💎 Ders özetini içeri al",
        hint:"Gemini'ye BİTTİ yazınca verdiği JSON özeti buraya yapıştır…",
        prompt:"BİTTİ",
        parse:function(text){
          var d=global.DHGemini.parsers.json(text);
          if(!d || (!d.hatalar && !d.ozet)) throw new Error("Özet JSON'u beklenen alanları içermiyor (ozet/hatalar).");
          return d;
        },
        onResult:function(data){
          ingest(data).then(function(added){ report(data, added); });
        }
      });
    };
  });
}

function report(data, added){
  css();
  var ov=document.createElement("div"); ov.className="dhgl-ov";
  var wins=Array.isArray(data.basarilar)?data.basarilar:[];
  ov.innerHTML=
    '<div class="dhgl-card">'
   +'<h3>✅ Ders kaydedildi</h3>'
   +'<p class="dhgl-sub">'+esc(data.ozet||"Ders tamamlandı.")+'</p>'
   +'<div class="dhgl-steps">'
     +'📓 Deftere eklenen hata: <b>'+added+'</b><br>'
     +'📈 Günlük çalışma sayacına <b>1 ders</b> işlendi'
     +(data.sonraki_konu?('<br>🎯 Sonraki konu: <b>'+esc(data.sonraki_konu)+'</b>'):"")
   +'</div>'
   +(wins.length?('<div class="dhgl-mat"><b>Bu derste iyi yaptıkların:</b><br>'+wins.map(esc).join("<br>")+'</div>'):"")
   +'<div class="dhgl-row"><button class="dhgl-close" type="button">Kapat</button></div>'
   +'</div>';
  document.body.appendChild(ov);
  ov.querySelector(".dhgl-close").onclick=function(){ ov.remove(); };
  ov.addEventListener("click",function(e){ if(e.target===ov) ov.remove(); });
}

/* ---------- düğmeyi kur ---------- */
function mount(){
  if(document.getElementById("dhGeminiLessonBtn")) return;
  var row=document.querySelector(".input-row");
  if(!row) return;
  var b=document.createElement("button");
  b.id="dhGeminiLessonBtn"; b.type="button";
  b.className="icon-fab suggest-btn dhgl-btn";
  b.title="Gemini ile ders yap (hata defterinden malzemeyle)";
  b.textContent="💎";
  b.onclick=function(e){ e.preventDefault(); e.stopPropagation(); open(); };
  var mic=row.querySelector(".mic-btn");
  if(mic) row.insertBefore(b, mic); else row.appendChild(b);
  /* Ders yarım kaldıysa hatırlat */
  try{
    var pend=parseInt(localStorage.getItem(LS_PENDING)||"0",10);
    if(pend && Date.now()-pend < 6*3600000) b.style.boxShadow="0 0 0 3px #a78bfa88";
  }catch(e){}
}
function mountRetry(){
  mount();
  var n=0, iv=setInterval(function(){
    mount();
    if(document.getElementById("dhGeminiLessonBtn") || ++n>12) clearInterval(iv);
  },400);
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mountRetry);
else mountRetry();

global.DHGeminiLesson={ open:open, mount:mount, buildPrompt:buildPrompt, ingest:ingest };
})(window);
