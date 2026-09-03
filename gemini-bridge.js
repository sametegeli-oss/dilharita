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
  +".dh-explanation-shell,.dh-exp-reader-shell{--dh-exp-font:16px;--dh-exp-heading:17.5px;--dh-exp-leading:1.75;color:#dbe7f7}.dh-explanation-shell[data-dh-exp-size='small'],.dh-exp-reader-shell[data-dh-exp-size='small']{--dh-exp-font:14.5px;--dh-exp-heading:16px}.dh-explanation-shell[data-dh-exp-size='large'],.dh-exp-reader-shell[data-dh-exp-size='large']{--dh-exp-font:18px;--dh-exp-heading:19.5px}.dh-explanation-shell[data-dh-exp-size='xlarge'],.dh-exp-reader-shell[data-dh-exp-size='xlarge']{--dh-exp-font:20px;--dh-exp-heading:21.5px}.dh-exp-toolbar{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;padding:9px 10px;border:1px solid rgba(125,164,209,.22);border-radius:13px;background:rgba(8,20,35,.94);box-shadow:0 8px 24px rgba(0,0,0,.16);backdrop-filter:blur(14px)}.dh-exp-toolbar-group{display:flex;align-items:center;gap:5px}.dh-exp-toolbar-label{margin-right:2px;color:#91a5be;font-size:11px;font-weight:850;letter-spacing:.04em;text-transform:uppercase}.dh-exp-tool{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:34px;height:34px;padding:0 10px;border:1px solid rgba(126,158,197,.26);border-radius:9px;background:#0d1e33;color:#c8d6e8;font:850 12px/1 Nunito,system-ui,sans-serif;cursor:pointer;transition:border-color .18s,background .18s,color .18s,transform .18s}.dh-exp-tool:hover{border-color:#5ee8d8;color:#fff;transform:translateY(-1px)}.dh-exp-tool.is-active{border-color:#55e6d1;background:rgba(48,196,178,.15);color:#7af1e3;box-shadow:0 0 0 1px rgba(85,230,209,.12)}.dh-exp-read{min-width:auto;padding:0 12px}.dh-exp-read svg,.dh-exp-reader-close svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8}.dh-explanation{display:grid;gap:14px;color:#dbe7f7;white-space:normal}.dh-exp-section{overflow:hidden;border:1px solid rgba(123,157,197,.22);border-radius:16px;background:linear-gradient(145deg,rgba(18,35,55,.95),rgba(7,18,31,.98));box-shadow:inset 0 1px rgba(255,255,255,.045),0 10px 26px rgba(0,0,0,.1)}.dh-exp-section>header{display:flex;align-items:center;gap:11px;padding:13px 15px;border-bottom:1px solid rgba(123,157,197,.15);background:linear-gradient(90deg,rgba(255,255,255,.032),transparent)}.dh-exp-section>header span{display:grid;place-items:center;flex:0 0 29px;width:29px;height:29px;border:1px solid rgba(85,230,209,.17);border-radius:9px;background:rgba(85,230,209,.11);color:#71eadc;font-size:10px;font-weight:950}.dh-exp-section h3{margin:0!important;color:#f4f8fd!important;font-size:var(--dh-exp-heading)!important;line-height:1.28!important;letter-spacing:-.01em}.dh-exp-body{display:grid;gap:12px;padding:16px;color:#c7d4e5;font-size:var(--dh-exp-font);line-height:var(--dh-exp-leading)}.dh-exp-body p{margin:0}.dh-exp-list{display:grid;gap:10px;margin:0;padding:0;list-style:none}.dh-exp-list li{position:relative;padding-left:19px}.dh-exp-list li:before{content:'•';position:absolute;left:3px;color:#58dfd0;font-weight:950}.dh-exp-row{display:grid;grid-template-columns:minmax(120px,.82fr) minmax(150px,1fr);gap:6px 13px;padding:12px 13px;border:1px solid rgba(105,166,255,.18);border-radius:12px;background:rgba(5,14,25,.56)}.dh-exp-row strong{color:#8ed9ff;font-size:1em;line-height:1.55}.dh-exp-row span{color:#e0e9f4}.dh-exp-row small{grid-column:1/-1;color:#91a5bc;font-size:.9em;line-height:1.55}.dh-exp-example{padding:13px 14px;border:1px solid rgba(255,201,99,.15);border-left:4px solid #ffc963;border-radius:0 12px 12px 0;background:rgba(255,201,99,.065)}.dh-exp-example b{display:block;color:#f8fafc;font-size:1.04em;line-height:1.55}.dh-exp-example span{display:block;margin-top:5px;color:#a9bad0}.dh-explanation-legacy{font-size:var(--dh-exp-font);line-height:var(--dh-exp-leading)}.dh-exp-reader{position:fixed;inset:0;z-index:1000090;display:grid;place-items:center;padding:max(18px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));background:rgba(1,7,15,.88);backdrop-filter:blur(18px);animation:dhExpFade .18s ease-out}.dh-exp-reader[hidden]{display:none}.dh-exp-reader-panel{display:grid;grid-template-rows:auto minmax(0,1fr);width:min(960px,100%);height:min(92dvh,940px);overflow:hidden;border:1px solid rgba(115,155,204,.3);border-radius:22px;background:linear-gradient(160deg,#0d1b2e,#07111f 66%);box-shadow:0 30px 90px rgba(0,0,0,.62)}.dh-exp-reader-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 17px;border-bottom:1px solid rgba(123,157,197,.18);background:rgba(15,31,52,.94)}.dh-exp-reader-title{display:grid;gap:2px}.dh-exp-reader-title strong{color:#f5f8fc;font-size:16px}.dh-exp-reader-title span{color:#8296ae;font-size:11px}.dh-exp-reader-actions{display:flex;align-items:center;gap:7px}.dh-exp-reader-close{display:grid;place-items:center;width:38px;height:38px;border:1px solid rgba(133,164,200,.25);border-radius:11px;background:#13243a;color:#dce6f3;cursor:pointer}.dh-exp-reader-body{overflow:auto;overscroll-behavior:contain;padding:18px 20px 30px;scrollbar-gutter:stable}.dh-exp-reader-body .dh-explanation{max-width:820px;margin:0 auto}.dh-exp-reader-size{display:flex;align-items:center;gap:4px}.dhgb-preview .dh-exp-toolbar{display:none}@keyframes dhExpFade{from{opacity:0;transform:scale(.992)}to{opacity:1;transform:scale(1)}}@media(max-width:620px){.dh-exp-toolbar{position:relative;top:auto;align-items:stretch;flex-direction:column}.dh-exp-toolbar-group{justify-content:space-between}.dh-exp-read{width:100%;height:39px}.dh-exp-toolbar-label{font-size:10px}.dh-exp-tool{height:36px;flex:1;padding:0 7px}.dh-exp-row{grid-template-columns:1fr}.dh-exp-row small{grid-column:auto}.dh-exp-body{padding:15px}.dh-exp-reader{padding:0}.dh-exp-reader-panel{width:100%;height:100dvh;border:0;border-radius:0}.dh-exp-reader-head{padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 10px max(12px,env(safe-area-inset-left))}.dh-exp-reader-title span{display:none}.dh-exp-reader-size .dh-exp-tool{min-width:31px;width:31px;padding:0}.dh-exp-reader-body{padding:14px max(12px,env(safe-area-inset-right)) max(26px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}}"
  +".dh-exp-reader{display:block;padding:0;background:#07111f;backdrop-filter:none}.dh-exp-reader-panel{width:100vw;height:100dvh;max-width:none;max-height:none;border:0;border-radius:0;box-shadow:none}.dh-exp-reader-head{position:sticky;top:0;z-index:5;padding:max(12px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) 12px max(18px,env(safe-area-inset-left))}.dh-exp-reader-body{min-height:0;height:100%;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:24px max(20px,calc((100vw - 900px)/2)) max(48px,env(safe-area-inset-bottom));background:#07111f}.dh-exp-reader-body .dh-explanation{max-width:900px;margin:0 auto}.dh-exp-reader-shell{min-height:100%;outline:none}"
  +".dh-exp-reader-close{position:fixed!important;z-index:1000095;top:max(12px,env(safe-area-inset-top));right:max(14px,env(safe-area-inset-right));display:inline-flex!important;align-items:center;justify-content:center;gap:8px;width:auto!important;min-width:132px;height:42px;padding:0 15px;border:1px solid rgba(255,130,140,.65)!important;border-radius:11px;background:#b42335!important;color:#fff!important;font:900 12px Nunito,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45);cursor:pointer}.dh-exp-reader-close:hover,.dh-exp-reader-close:focus-visible{background:#d02e43!important;outline:2px solid #fff;outline-offset:2px}.dh-exp-reader-head{padding-right:max(165px,calc(env(safe-area-inset-right) + 155px))}@media(max-width:620px){.dh-exp-reader-close{top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));min-width:116px;height:38px;padding:0 11px}.dh-exp-reader-head{padding-right:max(136px,calc(env(safe-area-inset-right) + 128px))}}"
  +".dh-exp-reader{z-index:2147483000!important;isolation:isolate!important;background:#07111f!important}.dh-exp-reader-panel{display:block!important;position:fixed!important;inset:0!important;z-index:1!important;background:#07111f!important}.dh-exp-reader-head{position:fixed!important;z-index:2147483001!important;top:0!important;left:0!important;right:0!important;height:68px!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;padding:max(10px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 10px max(16px,env(safe-area-inset-left))!important;border-bottom:1px solid rgba(123,157,197,.28)!important;background:#0b1a2e!important;box-shadow:0 8px 24px rgba(0,0,0,.35)!important;backdrop-filter:none!important}.dh-exp-reader-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:10px!important;min-width:0!important}.dh-exp-reader-size{display:flex!important;align-items:center!important;gap:5px!important;white-space:nowrap!important}.dh-exp-reader-close{position:static!important;z-index:auto!important;flex:0 0 auto!important;margin:0!important;top:auto!important;right:auto!important}.dh-exp-reader-body{position:fixed!important;z-index:1!important;inset:68px 0 0!important;width:auto!important;height:auto!important;box-sizing:border-box!important;overflow-y:auto!important;padding:22px max(20px,calc((100vw - 900px)/2)) max(48px,env(safe-area-inset-bottom))!important;background:#07111f!important}.dh-exp-reader-title{min-width:150px!important;flex:1 1 auto!important}.dh-exp-reader-title strong,.dh-exp-reader-title span{white-space:nowrap!important}@media(max-width:700px){.dh-exp-reader-head{height:62px!important;padding-left:max(10px,env(safe-area-inset-left))!important;padding-right:max(10px,env(safe-area-inset-right))!important}.dh-exp-reader-body{inset:62px 0 0!important}.dh-exp-reader-title{display:none!important}.dh-exp-reader-actions{width:100%!important;justify-content:space-between!important}.dh-exp-reader-size{flex:1 1 auto!important;overflow-x:auto!important;scrollbar-width:none!important}.dh-exp-reader-size::-webkit-scrollbar{display:none!important}.dh-exp-reader-size .dh-exp-tool{flex:1 0 34px!important;max-width:54px!important}.dh-exp-reader-close{min-width:112px!important;height:40px!important}}@media(max-width:390px){.dh-exp-reader-close{min-width:44px!important;width:44px!important;padding:0!important}.dh-exp-reader-close span{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important}.dh-exp-reader-size .dh-exp-tool{padding:0 5px!important}}"
  +"@media(max-width:700px){.dh-exp-reader-close{position:fixed!important;z-index:2147483640!important;top:auto!important;right:max(12px,env(safe-area-inset-right))!important;bottom:max(14px,env(safe-area-inset-bottom))!important;display:inline-flex!important;width:auto!important;min-width:108px!important;height:46px!important;padding:0 14px!important;border-radius:14px!important;box-shadow:0 10px 34px rgba(0,0,0,.65),0 0 0 2px rgba(255,255,255,.16)!important}.dh-exp-reader-close span{position:static!important;width:auto!important;height:auto!important;overflow:visible!important;clip:auto!important;white-space:nowrap!important}.dh-exp-reader-body{padding-bottom:max(88px,calc(env(safe-area-inset-bottom) + 78px))!important}}"
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
var EXP_SIZE_KEY="dh-explanation-font-size-v1",EXP_SIZES=["small","normal","large","xlarge"];
function explanationSize(){
  var value="normal";
  try{value=localStorage.getItem(EXP_SIZE_KEY)||"normal";}catch(e){}
  return EXP_SIZES.indexOf(value)>=0?value:"normal";
}
function explanationSizeButtons(){
  var current=explanationSize(),labels={small:"Küçük",normal:"Normal",large:"Büyük",xlarge:"Çok büyük"},marks={small:"A",normal:"A",large:"A+",xlarge:"A++"};
  return EXP_SIZES.map(function(size,index){return'<button type="button" class="dh-exp-tool dh-exp-size'+(size===current?' is-active':'')+'" data-dh-exp-set-size="'+size+'" aria-label="Yazı boyutu: '+labels[size]+'" title="'+labels[size]+'" style="font-size:'+(11+index)+'px">'+marks[size]+'</button>';}).join("");
}
function explanationToolbar(){
  return'<div class="dh-exp-toolbar" role="toolbar" aria-label="Açıklama okuma araçları"><button type="button" class="dh-exp-tool dh-exp-read" data-dh-exp-reader aria-label="Açıklamayı okuma modunda aç"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h6.2A3.8 3.8 0 0 1 14 9.3V20a3.8 3.8 0 0 0-3.8-3.8H4zM20 5.5h-2.2A3.8 3.8 0 0 0 14 9.3V20a3.8 3.8 0 0 1 3.8-3.8H20z"/></svg><span>Okuma modunda aç</span></button><div class="dh-exp-toolbar-group"><span class="dh-exp-toolbar-label">Yazı</span>'+explanationSizeButtons()+"</div></div>";
}
function explanationShell(content){return'<div class="dh-explanation-shell" data-dh-exp-size="'+explanationSize()+'">'+explanationToolbar()+content+"</div>";}
function syncExplanationSize(size){
  if(EXP_SIZES.indexOf(size)<0)return;
  try{localStorage.setItem(EXP_SIZE_KEY,size);}catch(e){}
  Array.prototype.forEach.call(document.querySelectorAll(".dh-explanation-shell,.dh-exp-reader-shell"),function(shell){shell.setAttribute("data-dh-exp-size",size);});
  Array.prototype.forEach.call(document.querySelectorAll("[data-dh-exp-set-size]"),function(button){var active=button.getAttribute("data-dh-exp-set-size")===size;button.classList.toggle("is-active",active);button.setAttribute("aria-pressed",active?"true":"false");});
}
function closeExplanationReader(){
  var reader=document.querySelector(".dh-exp-reader");if(!reader)return;
  reader.remove();
  if(!document.querySelector(".dhgb-ov,.yt-modal-overlay:not([hidden])"))document.documentElement.style.overflow=reader.dataset.oldOverflow||"";
}
function openExplanationReader(shell){
  var source=shell&&shell.querySelector(".dh-explanation");if(!source)return;
  closeExplanationReader();
  var reader=document.createElement("div"),size=explanationSize();reader.className="dh-exp-reader";reader.setAttribute("role","dialog");reader.setAttribute("aria-modal","true");reader.setAttribute("aria-label","Gemini açıklaması okuma modu");reader.dataset.oldOverflow=document.documentElement.style.overflow||"";
  reader.innerHTML='<div class="dh-exp-reader-panel"><header class="dh-exp-reader-head"><div class="dh-exp-reader-title"><strong>Gemini açıklaması</strong><span>Odaklanmış okuma görünümü</span></div><div class="dh-exp-reader-actions"><div class="dh-exp-reader-size" aria-label="Yazı boyutu">'+explanationSizeButtons()+'</div><button type="button" class="dh-exp-reader-close" data-dh-exp-reader-close aria-label="Okuma modundan çık"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg><span>Okumadan çık</span></button></div></header><div class="dh-exp-reader-body"><div class="dh-exp-reader-shell" data-dh-exp-size="'+size+'"></div></div></div>';
  var readerShell=reader.querySelector(".dh-exp-reader-shell");readerShell.appendChild(source.cloneNode(true));readerShell.setAttribute("role","document");readerShell.setAttribute("tabindex","0");document.body.appendChild(reader);document.documentElement.style.overflow="hidden";syncExplanationSize(size);reader.querySelector(".dh-exp-reader-body").scrollTop=0;reader.querySelector(".dh-exp-reader-close").focus();
}
function bindExplanationUI(){
  if(document.documentElement.dataset.dhExplanationUi)return;document.documentElement.dataset.dhExplanationUi="1";
  document.addEventListener("click",function(event){
    var sizeButton=event.target.closest&&event.target.closest("[data-dh-exp-set-size]");if(sizeButton){syncExplanationSize(sizeButton.getAttribute("data-dh-exp-set-size"));return;}
    var readButton=event.target.closest&&event.target.closest("[data-dh-exp-reader]");if(readButton){openExplanationReader(readButton.closest(".dh-explanation-shell"));return;}
    if(event.target.closest&&event.target.closest("[data-dh-exp-reader-close]")){closeExplanationReader();return;}
    if(event.target.classList&&event.target.classList.contains("dh-exp-reader"))closeExplanationReader();
  });
  document.addEventListener("keydown",function(event){if(event.key==="Escape"&&document.querySelector(".dh-exp-reader"))closeExplanationReader();});
}
function formatExplanation(input){
  css();
  bindExplanationUI();
  var source=String(input==null?"":input).replace(/^\s*DH-ID:[^\n]*\n/i,"").replace(/\r/g,"").trim();
  if(!source)return explanationShell('<div class="dh-explanation"><p>Açıklama bulunamadı.</p></div>');
  var sections={},current="",recognized=0;
  source.split("\n").forEach(function(line){
    var match=line.match(/^\s*\[([^\]]+)\]\s*$/),key=match?explanationSectionKey(match[1]):"";
    if(key){current=key;recognized++;if(!sections[key])sections[key]=[];return;}
    if(current)sections[current].push(line);
  });
  if(!recognized)return explanationShell('<div class="dh-explanation dh-explanation-legacy dh-md">'+markdown(source)+'</div>');
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
  return explanationShell('<div class="dh-explanation">'+(html||'<div class="dh-explanation-legacy dh-md">'+markdown(source)+'</div>')+'</div>');
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
global.DHGemini={ ask:ask, parsers:parsers, copy:copy, url:GEMINI_URL, pending:pending, discardPending:discardPending, hasOverlay:hasOverlay, markdown:markdown, formatExplanation:formatExplanation, explanationPrompt:explanationPrompt, setExplanationSize:syncExplanationSize, openExplanationReader:openExplanationReader };
})(window);

/* teacher.html → modülde çalışılan cümleye kesin dönüş köprüsü.
   Teacher sayfası kendi içeriğini yeniden çizse bile düğme body üzerinde kalır. */
(function(global){
 "use strict";
 if(!/\/(teacher)\.html$/i.test(location.pathname))return;
 function savedReturn(){
  var p=new URLSearchParams(location.search),ret=p.get("return")||"";try{ret=ret||sessionStorage.getItem("teacherReturnURL")||localStorage.getItem("teacherReturnURL")||"";}catch(e){}
  if(ret)return ret;try{var s=JSON.parse(sessionStorage.getItem("dh-module-tool-return-v1")||"null");if(s&&s.module){var u=new URL("./index-app.html",location.href);u.searchParams.set("mod",s.module);if(s.target)u.searchParams.set("target",s.target);else u.searchParams.set("q",s.sentence||"");return u.href;}}catch(e){}if(/\/index-app\.html(?:[?#]|$)/i.test(document.referrer||""))return document.referrer;return "";
 }
 function goBackToSentence(ev){
  var node=ev.target&&ev.target.closest&&ev.target.closest("#teacherBack,#dhTeacherTopReturn,#dhTeacherSentenceReturn,[data-dh-sentence-return='1']");if(!node)return;var ret=savedReturn();if(!ret)return;
  ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();try{localStorage.removeItem("teacherReturnURL");sessionStorage.removeItem("teacherReturnURL");}catch(e){}location.assign(ret);
 }
 /* Uygulama kabuğunun genel .back yakalayıcısından önce kaydolur. Böylece
    öğretmen dönüşü hiçbir zaman index.html genel menüsüne çevrilemez. */
 document.addEventListener("click",goBackToSentence,true);
 function mount(){
  var ret=savedReturn();if(!ret)return;var css=document.getElementById("dh-teacher-return-css");if(!css){css=document.createElement("style");css.id="dh-teacher-return-css";css.textContent="#dhTeacherTopReturn,#dhTeacherSentenceReturn{position:fixed!important;z-index:2147483647!important;display:inline-flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border:2px solid rgba(255,255,255,.9);border-radius:14px;background:linear-gradient(135deg,#047857,#0f766e);color:#fff;font:900 14px Nunito,system-ui,sans-serif;text-decoration:none;box-shadow:0 14px 38px rgba(0,0,0,.72);cursor:pointer}#dhTeacherTopReturn{left:max(14px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top))}#dhTeacherSentenceReturn{left:max(14px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom))}@media(max-width:680px){#dhTeacherTopReturn{left:max(8px,env(safe-area-inset-left))!important;top:max(8px,env(safe-area-inset-top))!important;min-height:46px!important;padding:0 14px!important;font-size:13px!important}#dhTeacherSentenceReturn{left:max(8px,env(safe-area-inset-left))!important;right:max(8px,env(safe-area-inset-right))!important;bottom:max(10px,env(safe-area-inset-bottom))!important;width:auto!important;min-height:50px!important;font-size:14px!important}}";document.head.appendChild(css);}
  var top=document.getElementById("dhTeacherTopReturn");if(!top){top=document.createElement("a");top.id="dhTeacherTopReturn";top.textContent="← Cümleye dön";document.body.appendChild(top);}top.href=ret;top.setAttribute("data-dh-sentence-return","1");top.onclick=goBackToSentence;
  var b=document.getElementById("dhTeacherSentenceReturn");if(!b){b=document.createElement("a");b.id="dhTeacherSentenceReturn";b.textContent="← Çalışılan cümleye dön";document.body.appendChild(b);}b.href=ret;b.setAttribute("data-dh-sentence-return","1");b.onclick=goBackToSentence;
  var old=document.getElementById("teacherBack");if(old){old.href=ret;old.setAttribute("aria-hidden","true");old.setAttribute("tabindex","-1");old.style.setProperty("display","none","important");}
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();setTimeout(mount,300);setTimeout(mount,1200);
})(window);
