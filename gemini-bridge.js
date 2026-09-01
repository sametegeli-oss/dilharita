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
var PENDING_TTL = 24*60*60*1000;
var activeOverlay = null;

function jobId(){ return "DH-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,7).toUpperCase(); }
function savePending(job){ try{ localStorage.setItem(PENDING_KEY,JSON.stringify(job)); }catch(e){} }
function loadPending(){
  try{
    var value=JSON.parse(localStorage.getItem(PENDING_KEY)||"null");
    if(value&&value.createdAt&&Date.now()-value.createdAt>PENDING_TTL){localStorage.removeItem(PENDING_KEY);return null;}
    return value;
  }catch(e){ return null; }
}
function clearPending(id){
  var p=loadPending();
  if(!id || !p || p.id===id) try{ localStorage.removeItem(PENDING_KEY); }catch(e){}
}
function compact(s,n){ s=String(s==null?"":s).replace(/\s+/g," ").trim(); return s.length>n?s.slice(0,n-1)+"…":s; }
function redactSensitive(s){
  return String(s||"")
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g,"[GİZLİ-GEMINI-ANAHTARI]")
    .replace(/\b(?:gsk_|csk-|sk-)[0-9A-Za-z_-]{16,}\b/g,"[GİZLİ-API-ANAHTARI]")
    .replace(/\bnvapi-[0-9A-Za-z_-]{16,}\b/g,"[GİZLİ-NVIDIA-ANAHTARI]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,"[GİZLİ-EPOSTA]");
}

/* ---------- stil ---------- */
function css(){
  if(document.getElementById("dhgb-css")) return;
  var s=document.createElement("style"); s.id="dhgb-css";
  s.textContent =
   ".dhgb-ov{position:fixed;inset:0;z-index:1000010;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:14px}"
  +".dhgb-card{width:100%;max-width:520px;max-height:92vh;overflow:auto;background:#0d1b32;color:#e8eef7;border:1px solid #1e3a5f;border-radius:16px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.5);font-family:Nunito,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}"
  +".dhgb-card h3{margin:0 0 4px;font-size:16px;font-weight:900}"
  +".dhgb-step{font-size:12px;color:#9fb3d9;line-height:1.5;margin:0 0 10px}"
  +".dhgb-row{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}"
  +".dhgb-row button{flex:1;min-width:130px;border:0;border-radius:10px;padding:11px 8px;font-size:13px;font-weight:800;cursor:pointer}"
  +".dhgb-go{min-height:46px!important;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;box-shadow:0 10px 28px rgba(79,70,229,.3)}"
  +".dhgb-go:hover{filter:brightness(1.08);transform:translateY(-1px)}"
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
  +".dh-explanation{display:grid;gap:10px;color:#dbe7f7;white-space:normal}.dh-exp-section{overflow:hidden;border:1px solid rgba(123,157,197,.2);border-radius:14px;background:linear-gradient(145deg,rgba(18,35,55,.92),rgba(7,18,31,.96));box-shadow:inset 0 1px rgba(255,255,255,.035)}.dh-exp-section>header{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(123,157,197,.14);background:rgba(255,255,255,.018)}.dh-exp-section>header span{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;background:rgba(85,230,209,.11);color:#6de9da;font-size:9px;font-weight:950}.dh-exp-section h3{margin:0!important;color:#f1f6fd!important;font-size:13px!important;letter-spacing:.01em}.dh-exp-body{display:grid;gap:8px;padding:11px 12px;color:#bdcce0;font-size:12.5px;line-height:1.62}.dh-exp-body p{margin:0}.dh-exp-list{display:grid;gap:7px;margin:0;padding:0;list-style:none}.dh-exp-list li{position:relative;padding-left:15px}.dh-exp-list li:before{content:'·';position:absolute;left:2px;color:#58dfd0;font-weight:950}.dh-exp-row{display:grid;grid-template-columns:minmax(90px,.8fr) minmax(110px,1fr);gap:4px 10px;padding:9px 10px;border:1px solid rgba(105,166,255,.17);border-radius:10px;background:rgba(5,14,25,.52)}.dh-exp-row strong{color:#8ed9ff;font-size:12px}.dh-exp-row span{color:#dbe7f7}.dh-exp-row small{grid-column:1/-1;color:#8196b0;line-height:1.45}.dh-exp-example{padding:10px 11px;border-left:3px solid #ffc963;border-radius:0 10px 10px 0;background:rgba(255,201,99,.06)}.dh-exp-example b{display:block;color:#f5f8fc;font-size:13px;line-height:1.45}.dh-exp-example span{display:block;margin-top:4px;color:#91a5be}.dh-explanation-legacy{line-height:1.65}@media(max-width:560px){.dh-exp-row{grid-template-columns:1fr}.dh-exp-row small{grid-column:auto}.dh-exp-body{padding:10px;font-size:12px}}"
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
  var providerName=String(opt.providerName||"Gemini");
  var providerUrl=String(opt.openUrl||GEMINI_URL);
  css();
  var originalPrompt=String(opt.prompt||"");
  var basePrompt=redactSensitive(originalPrompt);
  var wasRedacted=basePrompt!==originalPrompt;
  var old=loadPending();
  var sameOld=old && old.prompt===basePrompt && old.page===location.pathname;
  var id=sameOld?old.id:jobId();
  var prompt=basePrompt+"\n\nGÖREV KİMLİĞİ: "+id+"\nYanıtının ilk satırına tam olarak \"DH-ID: "+id+"\" yaz. Sonraki satırlarda istenen yanıtı ver.";
  var job={id:id,title:String(opt.title||"Gemini'ye sor"),prompt:basePrompt,page:location.pathname,createdAt:sameOld?old.createdAt:Date.now(),state:sameOld&&old.state||"waiting",draft:sameOld&&old.draft||"",resume:opt.resume||(sameOld&&old.resume)||null,hint:String(opt.hint||""),providerName:providerName,providerUrl:providerUrl};
  savePending(job);
  if(activeOverlay && activeOverlay.parentNode) activeOverlay.parentNode.removeChild(activeOverlay);
  var ov=document.createElement("div"); ov.className="dhgb-ov";
  activeOverlay=ov;
  ov.innerHTML =
    '<div class="dhgb-card">'
   +'<h3>'+esc(opt.title||"Gemini'ye sor")+'</h3>'
   +'<div class="dhgb-job">Bekleyen görev: '+esc(id)+'</div>'
   +'<p class="dhgb-step">Tek düğmeyle prompt kopyalanır ve '+esc(providerName)+' açılır. Orada promptu yapıştırıp gönderin ve cevabı kopyalayın. Programa dönünce aşağıdaki pano düğmesine siz basın.</p>'
   +'<button class="dhgb-tog" type="button">Promptu göster / gizle</button>'
   +'<div class="dhgb-prompt" style="display:none"></div>'
   +'<div class="dhgb-row">'
     +'<button class="dhgb-go" type="button">✦ Promptu kopyala ve '+esc(providerName)+'’ye git</button>'
   +'</div>'
   +'<textarea class="dhgb-ta" placeholder="'+esc(opt.hint||"Gemini'nin cevabını buraya yapıştır ve Enter'a bas…")+'"></textarea>'
   +'<div class="dhgb-msg"></div>'
   +'<div class="dhgb-preview"></div>'
   +'<div class="dhgb-row">'
     +'<button class="dhgb-paste" type="button">📋 Gemini cevabını panodan al</button>'
     +'<button class="dhgb-send" type="button">✅ Cevabı kullan (Enter)</button>'
     +'<button class="dhgb-close" type="button">Kapat</button>'
   +'</div>'
   +'</div>';
  var fullscreenHost=document.fullscreenElement||document.webkitFullscreenElement||document.querySelector(".yt-video-shell.is-pseudo-fullscreen");
  (fullscreenHost||document.body).appendChild(ov);

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
    global.removeEventListener("pagehide",backgrounded);
  }
  function rememberDraft(){ job.draft=ta.value||""; job.state="answer-ready"; savePending(job); }
  ta.addEventListener("input",rememberDraft);

  ov.querySelector(".dhgb-tog").onclick=function(){
    pv.style.display = pv.style.display==="none" ? "block" : "none";
  };
  ov.querySelector(".dhgb-go").onclick=function(){
    var b=this,openFailed=false;
    try{ global.open(providerUrl,"_blank","noopener"); }
    catch(e){ openFailed=true; }
    copy(prompt).then(function(ok){
      b.textContent=ok?"✅ Prompt kopyalandı · "+providerName+" açıldı":"⚠️ Promptu elle kopyala";
      say(ok?("Prompt panoda. "+providerName+"’de yapıştırıp gönder; cevabı kopyalayıp buraya dön ve pano düğmesine bas.")
             :"Prompt otomatik kopyalanamadı. ‘Promptu göster’ ile açıp elle kopyalayın.",ok?"#4ade80":"#f59e0b");
      if(openFailed)say("Prompt "+(ok?"kopyalandı; ":"")+providerName+" yeni sekmede açılamadı. Sağlayıcıyı elle açın.","#f59e0b");
      setTimeout(function(){b.textContent="✦ Promptu kopyala ve "+providerName+"’ye git";},2600);
    });
  };
  ov.querySelector(".dhgb-paste").onclick=function(){
    readClip().then(function(t){
      if(t && t.trim()){ ta.value=t; rememberDraft(); say("Gemini cevabı panodan alındı.","#4ade80"); submit(false); }
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
  function submit(automatic){
    if(awaitingConfirm){ if(automatic)return;applyResult();return; }
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
    parsedResult=result; parsedRaw=raw;
    if(opt.autoApply&&!opt.confirmResult){say("Cevap doğrulandı ve doğru göreve aktarılıyor…","#4ade80");applyResult();return;}
    awaitingConfirm=true;
    preview.style.display="block";
    preview.style.whiteSpace="normal";
    preview.innerHTML='<b style="color:#4ade80">Uygulanacak Gemini yanıtı</b>'+formatExplanation(raw.length>5000?raw.slice(0,5000)+"…":raw);
    sendBtn.textContent="✅ Onayla ve uygula";
    say("Yanıt anlaşıldı. Uygulamaya aktarmadan önce önizlemeyi kontrol et.","#4ade80");
  }
  ov.querySelector(".dhgb-send").onclick=function(){submit(false)};
  ta.addEventListener("keydown",function(e){
    if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); submit(false); }
  });
  setTimeout(function(){ ta.focus(); },80);
  /* Gemini yalnız kullanıcının ana mor düğmeye dokunmasıyla açılır. Böylece
     tarayıcının açılır pencere koruması aşılmaz ve istemsiz sekme oluşmaz. */
  var privacy=wasRedacted?" Kişisel/API bilgileri maskelendi.":"";
  say("Hazır: mor düğme Gemini’yi açar. Dönüşte pano yalnız sizin düğmeye basmanızla okunur."+privacy,"#9fb3d9");

  /* Mobil tarayıcı Gemini sekmesine geçerken pagehide üretebilir veya bu
     sayfayı bellekten atabilir. Görevi burada silmek dönüş ekranını yok
     ediyordu. Yalnız taslağı sakla; görev Kapat/Uygula ile ya da 24 saat
     sonunda temizlenir. */
  function backgrounded(){ rememberDraft(); }
  global.addEventListener("pagehide",backgrounded,{once:true});

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

/* Gemini'den hızlı kopyalanan etiketli düz metni güvenli, profesyonel
   kartlara çevirir. Tanınmayan/eski kayıtlar Markdown görünümüne düşer. */
function explanationSectionKey(label){
  var key=String(label||"").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g," ");
  var aliases={"ANLAM":"ANLAM","DOĞAL ANLAM":"ANLAM","YAPI":"YAPI","DİLBİLGİSİ":"YAPI","KALIPLAR":"KALIPLAR","ÖNEMLİ KALIPLAR":"KALIPLAR","TELAFFUZ":"TELAFFUZ","YAYGIN HATALAR":"HATALAR","HATALAR":"HATALAR","ÖRNEKLER":"ORNEKLER","ORNEKLER":"ORNEKLER"};
  return aliases[key]||"";
}
function formatExplanation(input){
  css();
  var source=String(input==null?"":input).replace(/^\s*DH-ID:[^\n]*\n/i,"").replace(/\r/g,"").trim();
  if(!source)return'<div class="dh-explanation"><p>Açıklama bulunamadı.</p></div>';
  var sections={},current="",recognized=0;
  source.split("\n").forEach(function(line){
    var match=line.match(/^\s*\[([^\]]+)\]\s*$/),key=match?explanationSectionKey(match[1]):"";
    if(key){current=key;recognized++;if(!sections[key])sections[key]=[];return;}
    if(current)sections[current].push(line);
  });
  if(!recognized)return'<div class="dh-explanation dh-explanation-legacy dh-md">'+markdown(source)+'</div>';
  var order=["ANLAM","YAPI","KALIPLAR","TELAFFUZ","HATALAR","ORNEKLER"],titles={ANLAM:"Bağlamdaki doğal anlam",YAPI:"Cümle yapısı ve dilbilgisi",KALIPLAR:"Önemli kalıplar",TELAFFUZ:"Telaffuz ve akıcı konuşma",HATALAR:"Türk öğrenciler için yaygın hatalar",ORNEKLER:"Doğal örnekler"};
  function nonempty(lines){return(lines||[]).map(function(x){return String(x||"").trim()}).filter(Boolean)}
  function prose(lines){
    var rows=nonempty(lines),list=rows.length>1&&rows.every(function(x){return/^[-•]\s+/.test(x)});
    if(list)return'<ul class="dh-exp-list">'+rows.map(function(x){return'<li>'+esc(x.replace(/^[-•]\s+/,""))+'</li>'}).join("")+'</ul>';
    return rows.map(function(x){return'<p>'+esc(x)+'</p>'}).join("");
  }
  function pipeRows(lines,examples){
    var rows=nonempty(lines);
    return rows.map(function(line){
      var parts=line.replace(/^\s*\d+[.)]?\s*(?:\|\s*)?/,"").split("|").map(function(x){return x.trim()});
      if(examples&&parts.length>=2)return'<article class="dh-exp-example"><b lang="en">'+esc(parts[0])+'</b><span lang="tr">'+esc(parts.slice(1).join(" | "))+'</span></article>';
      if(parts.length>=2)return'<article class="dh-exp-row"><strong lang="en">'+esc(parts[0])+'</strong><span lang="tr">'+esc(parts[1])+'</span>'+(parts[2]?'<small>'+esc(parts.slice(2).join(" | "))+'</small>':"")+'</article>';
      return'<p>'+esc(line)+'</p>';
    }).join("");
  }
  var html=order.map(function(key,index){
    if(!sections[key]||!nonempty(sections[key]).length)return"";
    var body=key==="KALIPLAR"||key==="HATALAR"?pipeRows(sections[key],false):key==="ORNEKLER"?pipeRows(sections[key],true):prose(sections[key]);
    var number=index+1<10?"0"+(index+1):String(index+1);
    return'<section class="dh-exp-section" data-exp-section="'+key.toLowerCase()+'"><header><span>'+number+'</span><h3>'+titles[key]+'</h3></header><div class="dh-exp-body">'+body+'</div></section>';
  }).join("");
  return'<div class="dh-explanation">'+(html||'<div class="dh-explanation-legacy dh-md">'+markdown(source)+'</div>')+'</div>';
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
function hasOverlay(){return!!(activeOverlay&&activeOverlay.parentNode)}
/* Video ve modül ekranları aynı açıklama istemini kullanır. Bağlam alanı
   bulunmayan ekranda "yok" yazılır; böylece görev yapısı ve cevap başlıkları
   iki tarafta da değişmez. */
function explanationPrompt(context){
  context=context||{};
  return[
    "Sen Dil Harita'da Türk öğrencilere doğal İngilizce öğreten deneyimli bir öğretmensin.",
    "Bu cümleyi detaylı açıkla.",
    "Öğrenci seviyesi: "+(context.level||"belirtilmedi"),
    "Video: "+(context.videoTitle||"belirtilmedi"),
    "Zaman: "+(context.time||"belirtilmedi"),
    "Önceki cümle: "+(context.previous||"yok"),
    "AKTİF İNGİLİZCE CÜMLE: "+String(context.sentence||"").trim(),
    "Mevcut Türkçe karşılık: "+(context.translation||"yok"),
    "Sonraki cümle: "+(context.next||"yok"),
    "Türkçe yanıt ver. Yalnızca aşağıdaki etiketli DÜZ METİN şablonunu kullan. Markdown, JSON, HTML, tablo, kod bloğu, bağlantı, emoji, yıldız ve başına # konmuş başlık kullanma.",
    "Her etiketi ayrı satıra aynen yaz. Etiketlerden önce veya son bölümden sonra ek açıklama yazma.",
    "[ANLAM]",
    "Cümlenin bu video bağlamındaki doğal Türkçe anlamını ve anlam nüansını açıkla.",
    "[YAPI]",
    "Cümle yapısını, zamanı ve bu yapının neden seçildiğini açıkla.",
    "[KALIPLAR]",
    "Her kalıbı ayrı satırda şu biçimde yaz: İngilizce kalıp | Türkçe anlamı | kısa kullanım notu",
    "[TELAFFUZ]",
    "Vurgu, ses bağlantısı, kelime yutulması ve doğal söyleyiş ipuçlarını açıkla.",
    "[YAYGIN HATALAR]",
    "Her hatayı ayrı satırda şu biçimde yaz: Yanlış kullanım | Doğru kullanım | kısa gerekçe",
    "[ÖRNEKLER]",
    "Tam iki örnek ver. Her örneği ayrı satırda şu biçimde yaz: 1 | English sentence | Türkçe karşılığı",
    "Toplam yanıt yaklaşık 350-550 Türkçe kelime olsun. Ayrıntılı, öğretici, tekrarsız ve mobil panoya uygun düz metin üret."
  ].join("\n");
}
global.DHGemini={ ask:ask, parsers:parsers, copy:copy, url:GEMINI_URL, pending:pending, discardPending:discardPending, hasOverlay:hasOverlay, markdown:markdown, formatExplanation:formatExplanation, explanationPrompt:explanationPrompt };
})(window);
