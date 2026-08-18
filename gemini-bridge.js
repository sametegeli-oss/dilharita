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
var PENDING_KEY = "dh-gemini-pending-v2";
var activeOverlay = null;

function jobId(){ return "DH-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,7).toUpperCase(); }
function savePending(job){ try{ localStorage.setItem(PENDING_KEY,JSON.stringify(job)); }catch(e){} }
function loadPending(){ try{ return JSON.parse(localStorage.getItem(PENDING_KEY)||"null"); }catch(e){ return null; } }
function clearPending(id){
  var p=loadPending();
  if(!id || !p || p.id===id) try{ localStorage.removeItem(PENDING_KEY); }catch(e){}
}
function compact(s,n){ s=String(s==null?"":s).replace(/\s+/g," ").trim(); return s.length>n?s.slice(0,n-1)+"…":s; }
function redactSensitive(s){
  return String(s||"")
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g,"[GİZLİ-GEMINI-ANAHTARI]")
    .replace(/\b(?:gsk_|csk-|sk-)[0-9A-Za-z_-]{16,}\b/g,"[GİZLİ-API-ANAHTARI]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,"[GİZLİ-EPOSTA]");
}

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
  +".dhgb-job{font-size:11px;color:#7dd3fc;margin:0 0 8px;font-weight:800}"
  +".dhgb-preview{display:none;background:#071120;border:1px solid #10b981;border-radius:10px;padding:10px;margin:0 0 10px;font-size:12px;line-height:1.45;white-space:pre-wrap;max-height:150px;overflow:auto}"
  +".dh-md{line-height:1.68;color:#dbe7f7}.dh-md h1,.dh-md h2,.dh-md h3,.dh-md h4{color:#fff;margin:18px 0 8px;line-height:1.3}.dh-md h1{font-size:21px}.dh-md h2{font-size:18px;border-bottom:1px solid #274060;padding-bottom:7px}.dh-md h3{font-size:15px;color:#7dd3fc}.dh-md p{margin:7px 0}.dh-md ul,.dh-md ol{margin:7px 0 12px;padding-left:23px}.dh-md li{margin:5px 0}.dh-md strong{color:#fff}.dh-md em{color:#c4b5fd}.dh-md code{background:#26344c;color:#e2e8f0;padding:2px 6px;border-radius:6px;font:12px ui-monospace,monospace}.dh-md pre{background:#06101e;border:1px solid #243b5a;border-radius:10px;padding:10px;overflow:auto}.dh-md blockquote{border-left:3px solid #8b5cf6;margin:10px 0;padding:7px 11px;background:#111d35;color:#cbd5e1}"
  +".dhgb-paste.dhgb-ready{outline:3px solid #fbbf24;animation:dhgbPulse 1s infinite alternate}@keyframes dhgbPulse{to{outline-color:transparent}}"
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
  var originalPrompt=String(opt.prompt||"");
  var basePrompt=redactSensitive(originalPrompt);
  var wasRedacted=basePrompt!==originalPrompt;
  var old=loadPending();
  var sameOld=old && old.prompt===basePrompt && old.page===location.pathname;
  var id=sameOld?old.id:jobId();
  var prompt=basePrompt+"\n\nGÖREV KİMLİĞİ: "+id+"\nYanıtının ilk satırına tam olarak \"DH-ID: "+id+"\" yaz. Sonraki satırlarda istenen yanıtı ver.";
  var job={id:id,title:String(opt.title||"Gemini'ye sor"),prompt:basePrompt,page:location.pathname,createdAt:sameOld?old.createdAt:Date.now(),state:"waiting"};
  savePending(job);
  if(activeOverlay && activeOverlay.parentNode) activeOverlay.parentNode.removeChild(activeOverlay);
  var ov=document.createElement("div"); ov.className="dhgb-ov";
  activeOverlay=ov;
  ov.innerHTML =
    '<div class="dhgb-card">'
   +'<h3>'+esc(opt.title||"Gemini'ye sor")+'</h3>'
   +'<div class="dhgb-job">Bekleyen görev: '+esc(id)+'</div>'
   +'<p class="dhgb-step">1️⃣ Promptu kopyala → 2️⃣ Gemini\'de sor → 3️⃣ Cevabı aşağıya yapıştır, <b>Enter</b>. Program oradan devam eder.</p>'
   +'<button class="dhgb-tog" type="button">Promptu göster / gizle</button>'
   +'<div class="dhgb-prompt" style="display:none"></div>'
   +'<div class="dhgb-row">'
     +'<button class="dhgb-copy" type="button">📋 1. Promptu kopyala</button>'
     +'<button class="dhgb-open" type="button">🚀 2. Gemini\'yi aç</button>'
   +'</div>'
   +'<textarea class="dhgb-ta" placeholder="'+esc(opt.hint||"Gemini'nin cevabını buraya yapıştır ve Enter'a bas…")+'"></textarea>'
   +'<div class="dhgb-msg"></div>'
   +'<div class="dhgb-preview"></div>'
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
      pv=ov.querySelector(".dhgb-prompt"),
      preview=ov.querySelector(".dhgb-preview"),
      sendBtn=ov.querySelector(".dhgb-send"),
      pasteBtn=ov.querySelector(".dhgb-paste");
  pv.textContent=prompt;
  if(sameOld && old.draft) ta.value=old.draft;

  function say(t,c){ msg.textContent=t||""; msg.style.color=c||"#9fb3d9"; }
  function close(){
    if(ov.parentNode) ov.parentNode.removeChild(ov);
    if(activeOverlay===ov) activeOverlay=null;
    global.removeEventListener("focus",returned);
    global.removeEventListener("pagehide",abandoned);
    document.removeEventListener("visibilitychange",returned);
  }
  function rememberDraft(){ job.draft=ta.value||""; job.state="answer-ready"; savePending(job); }
  ta.addEventListener("input",rememberDraft);

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
      if(t && t.trim()){ ta.value=t; rememberDraft(); pasteBtn.classList.remove("dhgb-ready"); say("Panodan alındı. Enter ya da ✅ ile kontrol et.","#4ade80"); ta.focus(); }
      else say("Pano boş görünüyor.","#f59e0b");
    }).catch(function(){
      say("Tarayıcı panoyu okumaya izin vermedi — kutuya uzun basıp Yapıştır de.","#f59e0b");
      ta.focus();
    });
  };
  ov.querySelector(".dhgb-close").onclick=function(){
    clearPending(id); close(); if(typeof opt.onCancel==="function") try{ opt.onCancel(); }catch(e){}
  };
  ov.addEventListener("click",function(e){ if(e.target===ov) ov.querySelector(".dhgb-close").click(); });

  var parsedResult, parsedRaw, awaitingConfirm=false;
  function normalizeAnswer(raw){
    var m=raw.match(/^\s*DH-ID:\s*([^\s]+)\s*\r?\n/i);
    if(m && m[1]!==id) throw new Error("Bu cevap başka göreve ait ("+m[1]+"). Doğru Gemini cevabını yapıştır.");
    return m?raw.slice(m[0].length).trim():raw;
  }
  function applyResult(){
    clearPending(id); close();
    if(typeof opt.onResult==="function") opt.onResult(parsedResult, parsedRaw);
  }
  function submit(){
    if(awaitingConfirm){ applyResult(); return; }
    var raw=(ta.value||"").trim();
    if(!raw){ say("Önce Gemini'nin cevabını yapıştır.","#f59e0b"); ta.focus(); return; }
    try{ raw=normalizeAnswer(raw); }
    catch(idErr){ say("⚠️ "+idErr.message,"#f59e0b"); return; }
    var result=raw;
    if(typeof opt.parse==="function"){
      try{ result=opt.parse(raw); }
      catch(err){
        say("⚠️ "+(err&&err.message?err.message:"Cevap anlaşılamadı, tekrar yapıştır."),"#f59e0b");
        return;
      }
    }
    parsedResult=result; parsedRaw=raw; awaitingConfirm=true;
    preview.style.display="block";
    preview.style.whiteSpace="normal";
    preview.innerHTML='<b style="color:#4ade80">Uygulanacak Gemini yanıtı</b><div class="dh-md">'+markdown(compact(raw,2400))+'</div>';
    sendBtn.textContent="✅ Onayla ve uygula";
    say("Yanıt anlaşıldı. Uygulamaya aktarmadan önce önizlemeyi kontrol et.","#4ade80");
  }
  ov.querySelector(".dhgb-send").onclick=submit;
  ta.addEventListener("keydown",function(e){
    if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); submit(); }
  });
  setTimeout(function(){ ta.focus(); },80);
  /* Gemini sekmesini yalnız kullanıcının mor "Gemini'yi aç" düğmesi açar.
     Sayfa yüklenirken/menü geçişinde otomatik sekme açmak gezinmeyi döngüye
     sokuyordu. Prompt yine hazırdır ama kullanıcı karar verene kadar dışarı
     yönlendirme yapılmaz. */
  var privacy=wasRedacted?" Kişisel/API bilgileri maskelendi.":"";
  say("Prompt hazır. Önce kopyala, ardından istersen Gemini'yi aç."+privacy,"#9fb3d9");

  function abandoned(){ clearPending(id); }
  global.addEventListener("pagehide",abandoned,{once:true});

  function returned(){
    if(document.hidden || !ov.parentNode) return;
    function check(granted){
      if(!granted){ pasteBtn.classList.add("dhgb-ready"); say("Gemini'den döndün. Cevabı kopyaladıysan 📋 Panodan al'a dokun.","#fbbf24"); return; }
      readClip().then(function(t){
        if(t && t.trim() && t.trim()!==prompt.trim()){ ta.value=t; rememberDraft(); say("Gemini cevabı panodan alındı. Kontrol etmek için ✅ düğmesine bas.","#4ade80"); }
      }).catch(function(){ pasteBtn.classList.add("dhgb-ready"); });
    }
    if(navigator.permissions&&navigator.permissions.query){
      navigator.permissions.query({name:"clipboard-read"}).then(function(p){check(p.state==="granted");},function(){check(false);});
    }else check(false);
  }
  global.addEventListener("focus",returned);
  document.addEventListener("visibilitychange",returned);
  return { close:close, setMessage:say };
}

function esc(s){
  return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}

/* Gemini'nin Markdown çıktısını index-app benzeri okunabilir karta çevirir.
   Önce bütün HTML kaçırıldığı için model cevabı kod çalıştıramaz. */
function markdown(input){
  var src=String(input==null?"":input).replace(/\[\[\s*([\s\S]*?)\s*\]\]/g,"`$1`").replace(/\r/g,"").split("\n"), out=[], list="", code=false, codeLines=[];
  function inline(s){
    s=esc(s).replace(/`([^`]+)`/g,"<code>$1</code>");
    s=s.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/__([^_]+)__/g,"<strong>$1</strong>");
    s=s.replace(/(^|[^*])\*([^*\n]+)\*/g,"$1<em>$2</em>").replace(/(^|[^_])_([^_\n]+)_/g,"$1<em>$2</em>");
    return s;
  }
  function closeList(){if(list){out.push("</"+list+">");list="";}}
  src.forEach(function(line){
    if(/^\s*```/.test(line)){if(code){out.push("<pre><code>"+esc(codeLines.join("\n"))+"</code></pre>");code=false;codeLines=[];}else{closeList();code=true;}return;}
    if(code){codeLines.push(line);return;}
    var m=line.match(/^\s*(#{1,4})\s+(.+)$/);if(m){closeList();out.push("<h"+m[1].length+">"+inline(m[2])+"</h"+m[1].length+">");return;}
    m=line.match(/^\s*[-*•]\s+(.+)$/);if(m){if(list!=="ul"){closeList();list="ul";out.push("<ul>");}out.push("<li>"+inline(m[1])+"</li>");return;}
    m=line.match(/^\s*\d+[.)]\s+(.+)$/);if(m){if(list!=="ol"){closeList();list="ol";out.push("<ol>");}out.push("<li>"+inline(m[1])+"</li>");return;}
    m=line.match(/^\s*>\s?(.*)$/);if(m){closeList();out.push("<blockquote>"+inline(m[1])+"</blockquote>");return;}
    if(/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)){closeList();out.push("<hr>");return;}
    if(!line.trim()){closeList();return;}
    closeList();out.push("<p>"+inline(line.trim())+"</p>");
  });
  if(code)out.push("<pre><code>"+esc(codeLines.join("\n"))+"</code></pre>");closeList();return out.join("");
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
    var t=String(text||"").replace(/```json|```/gi,"").trim();
    var s=t.indexOf("{"), a=t.indexOf("[");
    if(a>=0 && (s<0||a<s)) s=a;
    if(s<0) throw new Error("Cevapta JSON bulunamadı.");
    var e=Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if(e<s) throw new Error("JSON tamamlanmamış görünüyor.");
    var candidate=t.slice(s,e+1);
    try{ return JSON.parse(candidate); }
    catch(err){
      candidate=candidate.replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/,\s*([}\]])/g,"$1");
      try{ return JSON.parse(candidate); }
      catch(err2){ throw new Error("JSON okunamadı — cevabın tamamını yapıştırdığından emin ol."); }
    }
  },
  /* düz metin */
  text: function(text){
    var t=String(text||"").trim();
    if(t.length<2) throw new Error("Cevap çok kısa.");
    return t;
  }
};

function pending(){ return loadPending(); }
function discardPending(){ clearPending(); }
global.DHGemini={ ask:ask, parsers:parsers, copy:copy, url:GEMINI_URL, pending:pending, discardPending:discardPending, markdown:markdown };
})(window);
