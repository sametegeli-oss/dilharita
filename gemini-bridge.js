/* gemini-bridge.js — 🔁 GEMINI GİDİŞ-DÖNÜŞ KÖPRÜSÜ
   ------------------------------------------------------------------
   Amaç: API anahtarı olmadan, güçlü modelden faydalanmak.
     1) Uygulama zengin bir prompt kurar → panoya kopyalar → Gemini'yi açar.
     2) Kullanıcı Gemini'nin cevabını kopyalar.
     3) Buradaki YAPIŞTIRMA KUTUSUNA yapıştırıp Enter'a basar.
     4) Köprü cevabı ayrıştırır ve ilgili akış kaldığı yerden devam eder.

   Kullanım (herhangi bir sayfadan):
     DHGemini.ask({
       prompt: "...",                     // Gemini'ye gidecek metin
       title:  "Hakem kararı",            // kutu başlığı (ops.)
       hint:   "Gemini'nin cevabını yapıştır", // ops.
       parse:  function(text){ ... },     // ham cevabı işleyip sonuç döndürür (ops.)
                                          // hata için: throw new Error("mesaj")
       onResult: function(sonuc, ham){ }  // akışın devamı burada
     });

   Not: Enter = gönder, Shift+Enter = alt satır. Pano okunabiliyorsa
   "📋 Panodan al" düğmesi tek dokunuşla yapıştırır.
   ------------------------------------------------------------------ */
(function(global){
"use strict";
if(global.DHGemini) return;

var GEMINI_URL = "https://gemini.google.com/app";

/* ---------- stil ---------- */
function css(){
  if(document.getElementById("dhgb-css")) return;
  var s=document.createElement("style"); s.id="dhgb-css";
  s.textContent =
   ".dhgb-ov{position:fixed;inset:0;z-index:1000000;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:14px}"
  +".dhgb-card{width:100%;max-width:520px;max-height:92vh;overflow:auto;background:#0d1b32;color:#e8eef7;border:1px solid #1e3a5f;border-radius:16px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.5);font-family:Nunito,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}"
  +".dhgb-card h3{margin:0 0 4px;font-size:16px;font-weight:900}"
  +".dhgb-step{font-size:12px;color:#9fb3d9;line-height:1.5;margin:0 0 10px}"
  +".dhgb-row{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}"
  +".dhgb-row button{flex:1;min-width:130px;border:0;border-radius:10px;padding:11px 8px;font-size:13px;font-weight:800;cursor:pointer}"
  +".dhgb-copy{background:#1d4ed8;color:#fff}"
  +".dhgb-open{background:#8b5cf6;color:#fff}"
  +".dhgb-paste{background:#13294d;color:#e8eef7;border:1px solid #1e3a5f!important}"
  +".dhgb-send{background:linear-gradient(180deg,#10b981,#059669);color:#fff}"
  +".dhgb-close{background:#334155;color:#e8eef7}"
  +".dhgb-ta{width:100%;box-sizing:border-box;min-height:120px;background:#071120;color:#e8eef7;border:1px solid #1e3a5f;border-radius:12px;padding:11px;font-size:13.5px;line-height:1.5;resize:vertical;font-family:inherit}"
  +".dhgb-ta:focus{outline:2px solid #38bdf8;outline-offset:1px}"
  +".dhgb-prompt{max-height:120px;overflow:auto;background:#071120;border:1px dashed #1e3a5f;border-radius:10px;padding:9px;font-size:11.5px;color:#9fb3d9;white-space:pre-wrap;margin-bottom:10px}"
  +".dhgb-msg{font-size:12.5px;font-weight:700;min-height:17px;margin-bottom:8px;line-height:1.45}"
  +".dhgb-tog{background:none;border:0;color:#60a5fa;font-size:11.5px;font-weight:800;cursor:pointer;padding:0 0 8px;text-decoration:underline}";
  document.head.appendChild(s);
}

/* ---------- pano ---------- */
function copy(text){
  return new Promise(function(res){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){res(true);},function(){res(fallback());});
    } else res(fallback());
    function fallback(){
      try{
        var t=document.createElement("textarea");
        t.value=text; t.style.position="fixed"; t.style.opacity="0";
        document.body.appendChild(t); t.select();
        var ok=document.execCommand("copy");
        document.body.removeChild(t); return ok;
      }catch(e){ return false; }
    }
  });
}
function readClip(){
  if(navigator.clipboard && navigator.clipboard.readText) return navigator.clipboard.readText();
  return Promise.reject(new Error("no-read"));
}

/* ---------- ana giriş ---------- */
function ask(opt){
  opt=opt||{};
  css();
  var prompt=String(opt.prompt||"");
  var ov=document.createElement("div"); ov.className="dhgb-ov";
  ov.innerHTML =
    '<div class="dhgb-card">'
   +'<h3>'+esc(opt.title||"Gemini'ye sor")+'</h3>'
   +'<p class="dhgb-step">1️⃣ Promptu kopyala → 2️⃣ Gemini\'de sor → 3️⃣ Cevabı aşağıya yapıştır, <b>Enter</b>. Program oradan devam eder.</p>'
   +'<button class="dhgb-tog" type="button">Promptu göster / gizle</button>'
   +'<div class="dhgb-prompt" style="display:none"></div>'
   +'<div class="dhgb-row">'
     +'<button class="dhgb-copy" type="button">📋 1. Promptu kopyala</button>'
     +'<button class="dhgb-open" type="button">🚀 2. Gemini\'yi aç</button>'
   +'</div>'
   +'<textarea class="dhgb-ta" placeholder="'+esc(opt.hint||"Gemini'nin cevabını buraya yapıştır ve Enter'a bas…")+'"></textarea>'
   +'<div class="dhgb-msg"></div>'
   +'<div class="dhgb-row">'
     +'<button class="dhgb-paste" type="button">📋 Panodan al</button>'
     +'<button class="dhgb-send" type="button">✅ 3. Devam et (Enter)</button>'
     +'<button class="dhgb-close" type="button">Kapat</button>'
   +'</div>'
   +'</div>';
  document.body.appendChild(ov);

  var card=ov.querySelector(".dhgb-card"),
      ta=ov.querySelector(".dhgb-ta"),
      msg=ov.querySelector(".dhgb-msg"),
      pv=ov.querySelector(".dhgb-prompt");
  pv.textContent=prompt;

  function say(t,c){ msg.textContent=t||""; msg.style.color=c||"#9fb3d9"; }
  function close(){ if(ov.parentNode) ov.parentNode.removeChild(ov); }

  ov.querySelector(".dhgb-tog").onclick=function(){
    pv.style.display = pv.style.display==="none" ? "block" : "none";
  };
  ov.querySelector(".dhgb-copy").onclick=function(){
    var b=this;
    copy(prompt).then(function(ok){
      b.textContent = ok ? "✅ Kopyalandı" : "⚠️ Kopyalanamadı";
      say(ok?"Prompt panoda. Şimdi Gemini'yi aç, yapıştır (uzun bas → Yapıştır) ve gönder."
             :"Kopyalanamadı — promptu göster/gizle ile açıp elle seçebilirsin.", ok?"#4ade80":"#f59e0b");
      setTimeout(function(){ b.textContent="📋 1. Promptu kopyala"; },2200);
    });
  };
  ov.querySelector(".dhgb-open").onclick=function(){
    try{ global.open(GEMINI_URL,"_blank","noopener"); }
    catch(e){ say("Gemini açılamadı — tarayıcıda gemini.google.com adresine git.","#f59e0b"); }
  };
  ov.querySelector(".dhgb-paste").onclick=function(){
    readClip().then(function(t){
      if(t && t.trim()){ ta.value=t; say("Panodan alındı. Enter ya da ✅ ile devam et.","#4ade80"); ta.focus(); }
      else say("Pano boş görünüyor.","#f59e0b");
    }).catch(function(){
      say("Tarayıcı panoyu okumaya izin vermedi — kutuya uzun basıp Yapıştır de.","#f59e0b");
      ta.focus();
    });
  };
  ov.querySelector(".dhgb-close").onclick=function(){
    close(); if(typeof opt.onCancel==="function") try{ opt.onCancel(); }catch(e){}
  };
  ov.addEventListener("click",function(e){ if(e.target===ov) ov.querySelector(".dhgb-close").click(); });

  function submit(){
    var raw=(ta.value||"").trim();
    if(!raw){ say("Önce Gemini'nin cevabını yapıştır.","#f59e0b"); ta.focus(); return; }
    var result=raw;
    if(typeof opt.parse==="function"){
      try{ result=opt.parse(raw); }
      catch(err){
        say("⚠️ "+(err&&err.message?err.message:"Cevap anlaşılamadı, tekrar yapıştır."),"#f59e0b");
        return;
      }
    }
    close();
    if(typeof opt.onResult==="function") opt.onResult(result, raw);
  }
  ov.querySelector(".dhgb-send").onclick=submit;
  ta.addEventListener("keydown",function(e){
    if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); submit(); }
  });
  setTimeout(function(){ ta.focus(); },80);
  return { close:close, setMessage:say };
}

function esc(s){
  return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}

/* ---------- hazır ayrıştırıcılar ---------- */
var parsers={
  /* EVET/HAYIR + gerekçe → {ok:true|false, note:"..."} */
  yesNo: function(text){
    var t=String(text||"").trim();
    var head=t.slice(0,400).toLowerCase();
    var yes=/\b(evet|yes|do[ğg]ru|kabul|ge[çc]erli)\b/.test(head);
    var no =/\b(hay[ıi]r|no|yanl[ıi][şs]|kabul edilemez|ge[çc]ersiz)\b/.test(head);
    if(yes&&no){ /* ikisi de geçiyorsa önce geçeni al */
      var iy=head.search(/\b(evet|yes|do[ğg]ru|kabul|ge[çc]erli)\b/);
      var inn=head.search(/\b(hay[ıi]r|no|yanl[ıi][şs]|kabul edilemez|ge[çc]ersiz)\b/);
      yes = iy<inn; no = !yes;
    }
    if(!yes && !no) throw new Error("Cevapta EVET/HAYIR bulunamadı. Gemini'nin tüm cevabını yapıştır.");
    return { ok: yes, note: t };
  },
  /* EVET / YAZIM / HAYIR + gerekçe → {ok, typo, note}
     YAZIM = anlam doğru ama yazım hatası var → kabul edilir ama uyarılır. */
  yesNoTypo: function(text){
    var t=String(text||"").trim();
    var head=t.slice(0,400).toLowerCase();
    var typo=/\b(yaz[ıi]m|typo)\b/.test(head);
    var yes =/\b(evet|yes|do[ğg]ru|kabul|ge[çc]erli)\b/.test(head);
    var no  =/\b(hay[ıi]r|no|yanl[ıi][şs]|kabul edilemez|ge[çc]ersiz)\b/.test(head);
    if(typo) return { ok:true, typo:true, note:t };   // yazım hatası: geçerli say, uyar
    if(yes&&no){
      var iy=head.search(/\b(evet|yes|do[ğg]ru|kabul|ge[çc]erli)\b/);
      var inn=head.search(/\b(hay[ıi]r|no|yanl[ıi][şs]|kabul edilemez|ge[çc]ersiz)\b/);
      yes = iy<inn; no = !yes;
    }
    if(!yes && !no) throw new Error("Cevapta EVET/YAZIM/HAYIR bulunamadı. Gemini'nin tüm cevabını yapıştır.");
    return { ok: yes, typo:false, note: t };
  },
  /* JSON (```json bloğu olsa da) → nesne */
  json: function(text){
    var t=String(text||"").replace(/```json|```/g,"").trim();
    var s=t.indexOf("{"), a=t.indexOf("[");
    if(a>=0 && (s<0||a<s)) s=a;
    if(s<0) throw new Error("Cevapta JSON bulunamadı.");
    var e=Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if(e<s) throw new Error("JSON tamamlanmamış görünüyor.");
    try{ return JSON.parse(t.slice(s,e+1)); }
    catch(err){ throw new Error("JSON okunamadı — cevabın tamamını yapıştırdığından emin ol."); }
  },
  /* düz metin */
  text: function(text){
    var t=String(text||"").trim();
    if(t.length<2) throw new Error("Cevap çok kısa.");
    return t;
  }
};

global.DHGemini={ ask:ask, parsers:parsers, copy:copy, url:GEMINI_URL };
})(window);
