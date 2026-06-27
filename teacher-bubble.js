/* teacher-bubble.js
   Dil Harita — KAYAN ÖĞRETMEN (her sayfada)

   Köşede duran öğretmen avatarı. Tıklanınca aynı sayfada küçük bir panel
   açılır; o sayfanın "aktif konusunu" Groq AI'ya sorup açıklar ve
   DilAvatar ile konuşturur (avatar varsa).

   AKTİF KONU: Sayfalar şunu ayarlar:
     window.dhSetTopic({ baslik, soru, ceviri, baglam })
   Hiç ayarlanmazsa, kullanıcı panelde kendi sorusunu yazar.

   BAĞIMLILIK:
   - groqApiKeys (localStorage) — teacher.html ile ortak
   - avatar.js (DilAvatar) — opsiyonel, ihtiyaç anında yüklenir
   - Tek <script src="./teacher-bubble.js"> ile her sayfaya eklenir.
*/
(function(){
  "use strict";
  if(window.__dhTeacherBubble) return;
  window.__dhTeacherBubble = true;

  // ---- Aktif konu deposu ----
  var topic = null; // { baslik, soru, ceviri, baglam }
  window.dhSetTopic = function(t){
    topic = t || null;
    updateHint();
    // panel açık ve henüz soru sorulmadıysa (başlangıç ekranı) yeni konuyu yansıt
    try{
      if(panel && panel.classList.contains("open") && bodyEl && bodyEl.dataset.mode==="start"){
        renderStart();
      }
    }catch(e){}
  };
  window.dhClearTopic = function(){ topic = null; updateHint(); };

  // ---- Groq (teacher.html ile ortak mantık) ----
  var GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  var GROQ_MODEL = "llama-3.3-70b-versatile";
  function getKeys(){ try{ return (JSON.parse(localStorage.getItem("groqApiKeys")||"[]")||[]).filter(Boolean); }catch(e){ return []; } }
  var _ki=0, _ban={};
  function nextKey(keys){
    var now=Date.now();
    Object.keys(_ban).forEach(function(k){ if(_ban[k]<now) delete _ban[k]; });
    for(var e=0;e<keys.length;e++){ var idx=(_ki+e)%keys.length; if(!_ban[idx]){ _ki=idx; return {idx:idx,key:keys[idx]}; } }
    return {idx:-1,key:null};
  }
  function groqChat(messages){
    var keys=getKeys();
    if(!keys.length) return Promise.reject({code:"no-key"});
    var attempt=0;
    function tryOnce(){
      var pick=nextKey(keys);
      if(pick.idx===-1) return Promise.reject({code:"rate"});
      return fetch(GROQ_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+pick.key},
        body:JSON.stringify({model:GROQ_MODEL,messages:messages,temperature:0.3,max_tokens:1500})})
        .then(function(res){
          if(res.status===401){ _ban[pick.idx]=Date.now()+300000; if(++attempt<keys.length) return tryOnce(); throw {code:"bad-key"}; }
          if(res.status===429){ _ban[pick.idx]=Date.now()+60000; if(++attempt<keys.length) return tryOnce(); throw {code:"rate"}; }
          if(!res.ok){ _ban[pick.idx]=Date.now()+10000; if(++attempt<keys.length) return tryOnce(); throw {code:"http"}; }
          return res.json().then(function(d){ return (d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content||"").trim(); });
        })
        .catch(function(e){ if(++attempt<keys.length) return tryOnce(); throw (e&&e.code?e:{code:"network"}); });
    }
    return tryOnce();
  }

  // ---- Öğretmen sistem talimatı (anayasadaki açıklama ile uyumlu) ----
  function systemPrompt(){
    var base = "Sen sabırlı, sıcak bir İngilizce öğretmenisin. Öğrenciye TÜRKÇE açıklama yaparsın. "
      + "Kısa, anlaşılır, örnekli anlat. Gereksiz uzatma. İngilizce örnekleri ver ama açıklamayı Türkçe yap. "
      + "Soru bir gramer konusuysa kuralı ve kalıbı net göster. Bir kelime/öbekse anlamını, kullanımını ve örnek cümle ver.";
    try{
      if(window.DHTeacherPolicy){ var p=DHTeacherPolicy.load(); if(p && p.aciklama) base = p.aciklama + " (Açıklamaların Türkçe olsun.)"; }
    }catch(e){}
    return base;
  }

  // ---- DilAvatar (ihtiyaç anında yükle) ----
  var avatarLoaded=false, avatarLoading=false;
  function loadAvatar(){
    if(avatarLoaded) return Promise.resolve(true);
    if(window.DilAvatar){ avatarLoaded=true; return Promise.resolve(true); }
    if(avatarLoading) return new Promise(function(res){ var t=setInterval(function(){ if(window.DilAvatar){clearInterval(t);avatarLoaded=true;res(true);} },120); setTimeout(function(){clearInterval(t);res(!!window.DilAvatar);},6000); });
    avatarLoading=true;
    return new Promise(function(res){
      var s=document.createElement("script");
      s.src="./avatar.js?v=1";
      s.onload=function(){ avatarLoaded=true; res(true); };
      s.onerror=function(){ res(false); };
      document.head.appendChild(s);
    });
  }

  // ---- UI ----
  var css = ""
   +".dh-tb-fab{position:fixed;right:16px;bottom:16px;z-index:9000;width:62px;height:62px;border-radius:50%;"
   +"background:linear-gradient(135deg,#2563eb,#1d4ed8);border:3px solid #ffffff22;box-shadow:0 10px 30px rgba(0,0,0,.45);"
   +"cursor:pointer;display:grid;place-items:center;font-size:30px;transition:transform .15s;user-select:none}"
   +".dh-tb-fab:hover{transform:scale(1.08)}"
   +".dh-tb-fab .pulse{position:absolute;inset:-3px;border-radius:50%;border:2px solid #60a5fa;animation:dhPulse 2s infinite;pointer-events:none}"
   +"@keyframes dhPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.5);opacity:0}}"
   +".dh-tb-badge{position:absolute;top:-4px;right:-4px;background:#f59e0b;color:#06283b;font-size:11px;font-weight:900;border-radius:10px;padding:1px 6px}"
   +".dh-tb-panel{position:fixed;right:16px;bottom:88px;z-index:9001;width:min(380px,calc(100vw - 24px));max-height:min(560px,80vh);"
   +"background:#0f1f3a;border:1px solid #1e3a5f;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.6);display:none;flex-direction:column;overflow:hidden}"
   +".dh-tb-panel.open{display:flex}"
   +".dh-tb-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #1e3a5f;background:#10264a}"
   +".dh-tb-ava{width:46px;height:46px;border-radius:12px;background:#0b1120;overflow:hidden;flex:0 0 auto;display:grid;place-items:center;font-size:24px}"
   +".dh-tb-ava canvas,.dh-tb-ava svg{width:100%;height:100%}"
   +".dh-tb-title{flex:1;min-width:0}.dh-tb-title b{color:#e8eef7;font-size:15px}.dh-tb-title span{display:block;color:#9fb3d9;font-size:12px}"
   +".dh-tb-x{background:#13294d;border:1px solid #1e3a5f;color:#e8eef7;border-radius:8px;width:32px;height:32px;cursor:pointer}"
   +".dh-tb-body{padding:14px;overflow-y:auto;flex:1;color:#e8eef7;font-size:14px;line-height:1.6}"
   +".dh-tb-topic{background:#13294d;border:1px solid #1e3a5f;border-radius:10px;padding:9px 11px;font-size:13px;color:#9fb3d9;margin-bottom:10px}"
   +".dh-tb-topic b{color:#e8eef7}"
   +".dh-tb-ans{white-space:pre-wrap}"
   +".dh-tb-ans .en{color:#34d399}"
   +".dh-tb-foot{padding:10px 12px;border-top:1px solid #1e3a5f;display:flex;gap:8px}"
   +".dh-tb-foot input{flex:1;background:#0b1120;border:1px solid #1e3a5f;color:#e8eef7;border-radius:10px;padding:10px 12px;font-size:14px}"
   +".dh-tb-send{background:#2563eb;border:0;color:#fff;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer}"
   +".dh-tb-quick{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}"
   +".dh-tb-chip{background:#13294d;border:1px solid #1e3a5f;color:#cfe;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer}"
   +".dh-tb-loading{color:#9fb3d9;font-style:italic}"
   +".dh-tb-err{color:#fca5a5;font-size:13px}";

  function injectCSS(){ var st=document.createElement("style"); st.textContent=css; document.head.appendChild(st); }

  var fab, panel, bodyEl, inputEl, avaHost, avatarMounted=false;

  function build(){
    injectCSS();
    fab=document.createElement("button");
    fab.className="dh-tb-fab";
    fab.innerHTML='<span class="pulse"></span>🎓';
    fab.title="Öğretmene sor";
    fab.onclick=togglePanel;
    document.body.appendChild(fab);

    panel=document.createElement("div");
    panel.className="dh-tb-panel";
    panel.innerHTML=''
      +'<div class="dh-tb-head">'
      +'<div class="dh-tb-ava" id="dhTbAva">🎓</div>'
      +'<div class="dh-tb-title"><b>Öğretmen</b><span>Bir şey sor, açıklayayım</span></div>'
      +'<button class="dh-tb-x" id="dhTbX">✕</button>'
      +'</div>'
      +'<div class="dh-tb-body" id="dhTbBody"></div>'
      +'<div class="dh-tb-foot"><input id="dhTbInput" type="text" placeholder="Sorunu yaz..."><button class="dh-tb-send" id="dhTbSend">Sor</button></div>';
    document.body.appendChild(panel);
    bodyEl=panel.querySelector("#dhTbBody");
    inputEl=panel.querySelector("#dhTbInput");
    avaHost=panel.querySelector("#dhTbAva");
    panel.querySelector("#dhTbX").onclick=closePanel;
    panel.querySelector("#dhTbSend").onclick=function(){ ask(inputEl.value); };
    inputEl.addEventListener("keydown",function(e){ if(e.key==="Enter") ask(inputEl.value); });
    updateHint();
  }

  function updateHint(){
    if(!fab) return;
    var old=fab.querySelector(".dh-tb-badge");
    if(topic && topic.baslik){
      if(!old){ var b=document.createElement("span"); b.className="dh-tb-badge"; b.textContent="?"; fab.appendChild(b); }
    }else if(old){ old.remove(); }
  }

  function togglePanel(){ panel.classList.contains("open") ? closePanel() : openPanel(); }
  function closePanel(){ panel.classList.remove("open"); try{ if(window.DilAvatar&&DilAvatar.stop) DilAvatar.stop(); }catch(e){} }

  function openPanel(){
    panel.classList.add("open");
    // avatar yükle + mount (bir kez)
    loadAvatar().then(function(ok){
      if(ok && !avatarMounted && window.DilAvatar){
        try{ avaHost.innerHTML=""; DilAvatar.mount(avaHost); avatarMounted=true; }catch(e){}
      }
    });
    // HER açılışta güncel konuyla başla (eski cevap kalmasın)
    renderStart();
  }

  function renderStart(){
    if(bodyEl) bodyEl.dataset.mode="start";
    var html="";
    if(topic && (topic.baslik||topic.soru)){
      html+='<div class="dh-tb-topic">Bu sayfadaki konu: <b>'+esc(topic.baslik||topic.soru)+'</b></div>';
      html+='<div class="dh-tb-quick">'
        +'<button class="dh-tb-chip" data-q="bunu açıkla">📖 Bunu açıkla</button>'
        +'<button class="dh-tb-chip" data-q="örnek cümle ver">✍️ Örnek ver</button>'
        +'<button class="dh-tb-chip" data-q="nasıl kullanılır">🔧 Nasıl kullanılır</button>'
        +'</div>';
      bodyEl.innerHTML=html;
      bodyEl.querySelectorAll(".dh-tb-chip").forEach(function(c){
        c.onclick=function(){ ask(c.getAttribute("data-q")); };
      });
    }else{
      bodyEl.innerHTML='<div class="dh-tb-topic">Aklına takılan bir İngilizce konusunu yazabilirsin. Açıklayayım.</div>';
    }
  }

  function buildUserMessage(userText){
    var ctx="";
    if(topic){
      if(topic.baslik) ctx+="Konu: "+topic.baslik+"\n";
      if(topic.soru && topic.soru!==topic.baslik) ctx+="İçerik: "+topic.soru+"\n";
      if(topic.ceviri) ctx+="Türkçesi: "+topic.ceviri+"\n";
      if(topic.baglam) ctx+="Bağlam: "+topic.baglam+"\n";
    }
    return (ctx ? (ctx+"\nÖğrencinin isteği: ") : "") + userText;
  }

  function ask(userText){
    userText=(userText||"").trim();
    if(!userText && topic) userText="Bunu açıkla";
    if(!userText) return;
    if(bodyEl) bodyEl.dataset.mode="answer";
    inputEl.value="";
    bodyEl.innerHTML='<div class="dh-tb-loading">🎓 Öğretmen düşünüyor…</div>';
    try{ if(window.DilAvatar&&DilAvatar.thinking) DilAvatar.thinking(true); }catch(e){}

    var msgs=[
      {role:"system",content:systemPrompt()},
      {role:"user",content:buildUserMessage(userText)}
    ];
    groqChat(msgs).then(function(answer){
      try{ if(window.DilAvatar&&DilAvatar.thinking) DilAvatar.thinking(false); }catch(e){}
      showAnswer(answer||"(boş yanıt)");
      // avatar konuşsun (İngilizce kısımları değil, kısa özet)
      try{ if(window.DilAvatar&&DilAvatar.speakText){ DilAvatar.speakText(stripForSpeech(answer)); } }catch(e){}
    }).catch(function(err){
      try{ if(window.DilAvatar&&DilAvatar.thinking) DilAvatar.thinking(false); }catch(e){}
      var m="Bir sorun oldu.";
      if(err&&err.code==="no-key") m='Öğretmen için Groq API anahtarı gerekiyor. Sohbet/öğretmen sayfasından bir anahtar ekleyebilirsin (console.groq.com/keys — ücretsiz).';
      else if(err&&err.code==="rate") m="Tüm API anahtarları şu an limitte. Biraz sonra tekrar dene.";
      else if(err&&err.code==="bad-key") m="API anahtarı geçersiz görünüyor. Öğretmen sayfasından kontrol et.";
      bodyEl.innerHTML='<div class="dh-tb-err">'+esc(m)+'</div>'
        +'<div class="dh-tb-quick" style="margin-top:10px"><button class="dh-tb-chip" id="dhTbRetry">↻ Tekrar dene</button>'
        +'<a class="dh-tb-chip" href="./teacher.html" style="text-decoration:none">🎓 Öğretmen sayfası</a></div>';
      var r=document.getElementById("dhTbRetry"); if(r) r.onclick=function(){ ask(userText); };
    });
  }

  function showAnswer(text){
    // İngilizce örnekleri yeşil göster (kaba: tırnak içi veya satır başı büyük harf cümleler)
    bodyEl.innerHTML='<div class="dh-tb-ans">'+esc(text)+'</div>'
      +'<div class="dh-tb-quick" style="margin-top:12px">'
      +'<button class="dh-tb-chip" data-q="daha basit anlat">🔁 Daha basit</button>'
      +'<button class="dh-tb-chip" data-q="bir örnek daha">➕ Bir örnek daha</button>'
      +'</div>';
    bodyEl.querySelectorAll(".dh-tb-chip").forEach(function(c){ c.onclick=function(){ ask(c.getAttribute("data-q")); }; });
  }

  function stripForSpeech(t){
    // avatar Türkçe okur; çok uzunsa ilk birkaç cümle
    var s=String(t||"").replace(/[*_`#>]/g,"").trim();
    var parts=s.split(/(?<=[.!?])\s/).slice(0,3).join(" ");
    return parts.slice(0,240);
  }

  function esc(s){ return String(s==null?"":s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];}); }

  // başlat
  if(document.body) build();
  else document.addEventListener("DOMContentLoaded", build);
})();
