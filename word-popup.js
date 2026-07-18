/* word-popup.js — ZENGİN KELİME AÇIKLAMA POPUP (v2)
   Dil Harita — Her sayfada İngilizce kelimeye tıkla, tam donanımlı panel aç.

   Özellikler: anlamlar + okunuş + seviye/frekans, heceler, Dinle/Yavaş/Hızlı,
   Kelime Açıklama (AI), Telaffuzunu dene, geçtiği cümleler.
   Sözlük: data/dictionary.json  |  Cümleler: data/sentences.json
   API: DHWordPop.lookup("running") / enable() / disable()
*/
(function(global){
  "use strict";
  if(global.DHWordPop && global.DHWordPop.__v2) return;

  var DICT_PATHS = ["./data/dictionary.json","data/dictionary.json","./dictionary.json"];
  var SENT_PATHS = ["./data/sentences.json","data/sentences.json","./sentences.json"];
  var dict=null, dictLoading=null, sentences=null, sentLoading=null;
  var enabled=true, popEl=null;

  function loadDict(){
    if(dict) return Promise.resolve(dict);
    if(dictLoading) return dictLoading;
    dictLoading=(function tryPath(i){
      if(i>=DICT_PATHS.length) return Promise.resolve({});
      return fetch(DICT_PATHS[i]).then(function(r){ if(!r.ok) throw 0; return r.json(); })
        .then(function(d){ dict=d||{}; return dict; }).catch(function(){ return tryPath(i+1); });
    })(0);
    return dictLoading;
  }
  function loadSentences(){
    if(sentences) return Promise.resolve(sentences);
    if(sentLoading) return sentLoading;
    sentLoading=(function tryPath(i){
      if(i>=SENT_PATHS.length) return Promise.resolve([]);
      return fetch(SENT_PATHS[i]).then(function(r){ if(!r.ok) throw 0; return r.json(); })
        .then(function(d){ sentences=Array.isArray(d)?d:[]; return sentences; }).catch(function(){ return tryPath(i+1); });
    })(0);
    return sentLoading;
  }

  function cleanWord(w){ return String(w||"").toLowerCase().replace(/[^a-z'-]/g,"").replace(/^'+|'+$/g,""); }
  function variants(w){
    var v=[w];
    if(w.length>4){
      if(/ies$/.test(w)) v.push(w.replace(/ies$/,"y"));
      if(/es$/.test(w)) v.push(w.replace(/es$/,""));
      if(/s$/.test(w)) v.push(w.replace(/s$/,""));
      if(/ing$/.test(w)){ v.push(w.replace(/ing$/,"")); v.push(w.replace(/ing$/,"e")); }
      if(/ed$/.test(w)){ v.push(w.replace(/ed$/,"")); v.push(w.replace(/ed$/,"e")); }
      if(/ied$/.test(w)) v.push(w.replace(/ied$/,"y"));
      if(/er$/.test(w)) v.push(w.replace(/er$/,""));
      if(/est$/.test(w)) v.push(w.replace(/est$/,""));
    }
    return v;
  }
  function findEntry(raw){
    if(!dict) return null;
    var w=cleanWord(raw); if(!w) return null;
    var vs=variants(w);
    for(var i=0;i<vs.length;i++){ if(dict[vs[i]]) return { word:vs[i], data:dict[vs[i]] }; }
    return null;
  }

  function syllabify(word){
    var w=String(word||"").toLowerCase();
    if(w.length<=3) return w;
    var parts=[], i=0, isV=function(c){ return "aeiouy".indexOf(c)>=0; };
    while(i<w.length){
      var seg=w[i]; i++;
      while(i<w.length && !isV(w[i]) && !isV(seg[seg.length-1])){ seg+=w[i]; i++; }
      while(i<w.length && isV(w[i])){ seg+=w[i]; i++; }
      parts.push(seg);
    }
    // sesli harf içermeyen parçaları (sadece ünsüz) bir öncekine yapıştır
    var merged=[];
    for(var j=0;j<parts.length;j++){
      var p=parts[j];
      var hasV=/[aeiouy]/.test(p);
      if(!hasV && merged.length){ merged[merged.length-1]+=p; }
      else merged.push(p);
    }
    return merged.join(" · ")||w;
  }

  // Cümleyi PANOYA KOPYALA (garanti) + Google Translate'i aç. Açılınca yapıştırılır.
  function openGoogleTranslate(text){
    text=String(text||"").trim(); if(!text) return;
    function fallbackCopy(t){
      try{ var ta=document.createElement("textarea"); ta.value=t; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }catch(e){}
    }
    try{ if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).catch(function(){ fallbackCopy(text); }); } else { fallbackCopy(text); } }catch(e){ fallbackCopy(text); }
    try{
      var n=document.createElement("div");
      n.textContent="📋 Cümle kopyalandı — Translate'te yapıştır";
      n.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#0f1f3a;color:#fff;border:1px solid #2563eb;padding:12px 18px;border-radius:12px;font:700 13px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:90vw;text-align:center";
      document.body.appendChild(n);
      setTimeout(function(){ n.style.transition="opacity .4s"; n.style.opacity="0"; setTimeout(function(){ n.remove(); },400); },3000);
    }catch(e){}
    window.open("https://translate.google.com/?sl=en&tl=tr&op=translate&text="+encodeURIComponent(text), "_blank");
  }

  function speak(text, rate){
    try{
      speechSynthesis.cancel();
      var u=new SpeechSynthesisUtterance(String(text||""));
      u.lang="en-US"; u.rate=rate||0.9;
      u.__dhMixed=true; u.__longTTSAvatarSync=true;
      speechSynthesis.speak(u);
    }catch(e){}
  }

  function injectCSS(){
    if(document.getElementById("dh-wordpop-css")) return;
    var st=document.createElement("style"); st.id="dh-wordpop-css";
    st.textContent =
     ".dh-wp-ov{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;animation:dhWpF .15s ease}"
    +"@keyframes dhWpF{from{opacity:0}to{opacity:1}}"
    +".dh-wp{background:#0f1f3a;border:1px solid #1e3a5f;border-radius:20px 20px 0 0;width:100%;max-width:480px;max-height:88vh;overflow-y:auto;padding:20px 18px max(20px,env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.5);animation:dhWpUp .2s ease}"
    +"@media(min-width:520px){.dh-wp-ov{align-items:center}.dh-wp{border-radius:20px;max-height:90vh}}"
    +"@keyframes dhWpUp{from{transform:translateY(30px);opacity:.5}to{transform:none;opacity:1}}"
    +".dh-wp-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}"
    +".dh-wp-word{font-size:26px;font-weight:900;color:#818cf8}"
    +".dh-wp-read{font-size:15px;color:#fbbf24;font-weight:700;font-style:italic}"
    +".dh-wp-x{margin-left:auto;background:#13294d;border:1px solid #1e3a5f;color:#e8eef7;width:34px;height:34px;border-radius:50%;font-size:16px;cursor:pointer;flex:0 0 auto}"
    +".dh-wp-box{background:#0b1830;border:1px solid #1e3a5f;border-radius:14px;padding:12px 14px;margin-bottom:10px}"
    +".dh-wp-boxhead{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#9fb3d9;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px}"
    +".dh-wp-tags{margin-left:auto;display:flex;gap:6px}"
    +".dh-wp-tag{font-size:10px;font-weight:800;padding:3px 8px;border-radius:99px}"
    +".dh-wp-tag.f{background:#065f46;color:#6ee7b7}"
    +".dh-wp-tag.l{background:#1e3a8a;color:#93c5fd}"
    +".dh-wp-mean{color:#e8eef7;font-size:15px;padding:5px 0;line-height:1.4}"
    +".dh-wp-syl{font-size:16px;color:#e8eef7;font-weight:700;letter-spacing:1px}"
    +".dh-wp-row{display:flex;gap:8px;margin-bottom:10px}"
    +".dh-wp-row button{flex:1;border:0;border-radius:11px;padding:11px 6px;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px}"
    +".dh-wp-b1{background:#2563eb;color:#fff}"
    +".dh-wp-b2{background:#13294d;color:#e8eef7;border:1px solid #1e3a5f}"
    +".dh-wp-full{width:100%;border:0;border-radius:12px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:7px}"
    +".dh-wp-video{background:#dc2626;color:#fff}"
    +".dh-wp-ai{background:linear-gradient(180deg,#10b981,#059669);color:#fff}"
    +".dh-wp-rec{background:#dc2626;color:#fff}"
    +".dh-wp-sec-title{font-size:13px;font-weight:800;color:#9fb3d9;margin:6px 0 8px}"
    +".dh-wp-sent{background:#0b1830;border:1px solid #1e3a5f;border-radius:12px;padding:11px 12px;margin-bottom:8px;position:relative}"
    +".dh-wp-sent .en{color:#e8eef7;font-size:14px;line-height:1.4;padding-right:56px}"
    +".dh-wp-sent .tr{color:#9fb3d9;font-size:13px;margin-top:3px}"
    +".dh-wp-sent .play{position:absolute;top:10px;right:10px;background:none;border:0;color:#38bdf8;font-size:16px;cursor:pointer}"
    +".dh-wp-sent .gtr{position:absolute;top:10px;right:38px;background:none;border:0;font-size:15px;cursor:pointer}"
    +".dh-wp-ai-out{background:#0b1830;border:1px solid #10b98155;border-radius:12px;padding:12px;margin-bottom:10px;color:#d1fae5;font-size:14px;line-height:1.5;white-space:pre-wrap}"
    +".dh-wp-rec-out{font-size:13px;font-weight:700;margin:4px 0 10px;min-height:18px}"
    +".dh-wp-muted{color:#64748b;font-size:13px;padding:6px 0}"
    +".dh-wp-wave-wrap{position:relative;width:100%;height:110px;background:#020617;border:1px solid #1e3a5f;border-radius:10px;overflow:hidden;margin-bottom:8px}"
    +".dh-wp-wave-wrap canvas{position:absolute;inset:0;width:100%;height:100%;display:block}"
    +".dh-wp-wave-meta{display:flex;gap:8px;align-items:center;font-size:11px;font-weight:800;color:#9fb3d9;margin-bottom:8px}"
    +".dh-wp-wave-meta .dur{background:#13294d;border:1px solid #1e3a5f;padding:2px 7px;border-radius:6px;font-family:monospace;color:#cbd5e1}"
    +".dh-wp-wave-score{margin-left:auto;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:900;color:#03131c;display:none}"
    +".dh-wp-wv-row{display:flex;gap:6px;margin-bottom:6px}"
    +".dh-wp-wv-row button{flex:1;border:0;border-radius:10px;padding:9px 4px;font-size:11.5px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px}"
    +".dh-wp-wv-row button:disabled{opacity:.4;cursor:default}"
    +".dh-wp-wv-coach{background:#38bdf8;color:#03131c}"
    +".dh-wp-wv-rec{background:#dc2626;color:#fff}"
    +".dh-wp-wv-rec.on{background:#f43f5e;animation:dhWvPulse 1s infinite}"
    +"@keyframes dhWvPulse{50%{opacity:.6}}"
    +".dh-wp-wv-cmp{background:linear-gradient(180deg,#10b981,#059669);color:#fff}"
    +".dh-wp-wv-play{background:#13294d;color:#e8eef7;border:1px solid #1e3a5f!important}"
    +".dh-wp-wv-status{font-size:12px;font-weight:700;color:#9fb3d9;min-height:16px;line-height:1.4}";
    document.head.appendChild(st);
  }

  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }
  function close(){ wvCleanup(); if(popEl){ popEl.remove(); popEl=null; } try{ speechSynthesis.cancel(); }catch(e){} }

  function open(entry){
    injectCSS(); close();
    var w=entry.word, d=entry.data;
    var anlamlar=Array.isArray(d.anlamlar)?d.anlamlar:(d.anlamlar?[d.anlamlar]:[]);
    var ov=document.createElement("div"); ov.className="dh-wp-ov";
    ov.innerHTML =
     '<div class="dh-wp no-wordpop">'
     +'<div class="dh-wp-head">'
       +'<span class="dh-wp-word">'+esc(w)+'</span>'
       +(d.oku?'<span class="dh-wp-read">'+esc(d.oku)+'</span>':'')
       +'<button class="dh-wp-x" id="dhWpX">✕</button>'
     +'</div>'
     +'<div class="dh-wp-box">'
       +'<div class="dh-wp-boxhead">📖 Anlamlar<span class="dh-wp-tags">'
         +(d.frekans?'<span class="dh-wp-tag f">frekans '+d.frekans+'</span>':'')
         +(d.seviye?'<span class="dh-wp-tag l">'+esc(d.seviye)+'</span>':'')
       +'</span></div>'
       + anlamlar.map(function(m,i){ return '<div class="dh-wp-mean">'+(i+1)+'. '+esc(m)+'</div>'; }).join("")
     +'</div>'
     +'<div class="dh-wp-box"><div class="dh-wp-boxhead">🔤 Heceler</div><div class="dh-wp-syl">'+esc(syllabify(w))+'</div></div>'
     +'<div class="dh-wp-row">'
       +'<button class="dh-wp-b1" id="dhWpListen">🔊 Dinle</button>'
       +'<button class="dh-wp-b2" id="dhWpSlow">🐢 Yavaş</button>'
       +'<button class="dh-wp-b2" id="dhWpFast">⚡ Hızlı</button>'
     +'</div>'
     +'<button class="dh-wp-full dh-wp-video" id="dhWpVideo">🎬 Gerçek videolarda dinle</button>'
     +'<button class="dh-wp-full dh-wp-ai" id="dhWpAI">🎓 Kelime Açıklama (AI)</button>'
     +'<div id="dhWpAIOut"></div>'
     +'<div class="dh-wp-box"><div class="dh-wp-boxhead">🎙 Telaffuzunu dene</div>'
       +'<div class="dh-wp-rec-out" id="dhWpRecOut"></div>'
       +'<button class="dh-wp-full dh-wp-rec" id="dhWpRec">🎙 Kaydı başlat</button>'
     +'</div>'
     +'<div class="dh-wp-box"><div class="dh-wp-boxhead">🌊 Ses Dalgası Analizi</div>'
       +'<div class="dh-wp-wave-wrap"><canvas id="dhWpWvCanvas"></canvas></div>'
       +'<div class="dh-wp-wave-meta">'
         +'<span class="dur">🎓 <span id="dhWpWvDurC">0.0s</span></span>'
         +'<span class="dur">🎙️ <span id="dhWpWvDurU">0.0s</span></span>'
         +'<span class="dh-wp-wave-score" id="dhWpWvScore"></span>'
       +'</div>'
       +'<div class="dh-wp-wv-row">'
         +'<button class="dh-wp-wv-coach" id="dhWpWvCoach">🎓 1. Hoca Çizdir</button>'
         +'<button class="dh-wp-wv-rec" id="dhWpWvRec" disabled>🎙️ 2. Sen Oku</button>'
         +'<button class="dh-wp-wv-cmp" id="dhWpWvCmp" disabled>🔍 3. Kıyasla</button>'
       +'</div>'
       +'<div class="dh-wp-wv-row">'
         +'<button class="dh-wp-wv-play" id="dhWpWvPlayC" disabled>▶ Hoca</button>'
         +'<button class="dh-wp-wv-play" id="dhWpWvPlayU" disabled>▶ Sen</button>'
         +'<button class="dh-wp-wv-play" id="dhWpWvDuet" disabled>▶ Düet</button>'
       +'</div>'
       +'<div class="dh-wp-wv-status" id="dhWpWvStatus">Önce \'1. Hoca Çizdir\'e dokunun — hocanın dalgası mavi, seninki yeşil çizilir.</div>'
     +'</div>'
     +'<div class="dh-wp-sec-title" id="dhWpSentTitle">Bu kelimenin geçtiği cümleler</div>'
     +'<div id="dhWpSents"><div class="dh-wp-muted">Cümleler yükleniyor…</div></div>'
     +'</div>';
    document.body.appendChild(ov); popEl=ov;
    ov.addEventListener("click", function(e){ if(e.target===ov) close(); });
    document.getElementById("dhWpX").onclick=close;
    document.getElementById("dhWpListen").onclick=function(){ speak(w,0.9); };
    document.getElementById("dhWpSlow").onclick=function(){ speak(w,0.55); };
    document.getElementById("dhWpFast").onclick=function(){ speak(w,1.25); };
    document.getElementById("dhWpVideo").onclick=function(){ window.open("https://youglish.com/pronounce/"+encodeURIComponent(w)+"/english","_blank"); };
    document.getElementById("dhWpAI").onclick=function(){ aiExplain(w, anlamlar); };
    document.getElementById("dhWpRec").onclick=function(){ tryPronounce(w); };
    wvInit(w);
    fillSentences(w);
  }

  function aiExplain(word, anlamlar){
    var out=document.getElementById("dhWpAIOut"), btn=document.getElementById("dhWpAI");
    if(!(global.DHProviders && DHProviders.hasAnyKey && DHProviders.hasAnyKey())){
      out.innerHTML='<div class="dh-wp-ai-out">AI açıklaması için öğretmen sayfasından bir API anahtarı ekle (Groq, Cerebras veya Gemini).</div>';
      return;
    }
    btn.textContent="⏳ Açıklama hazırlanıyor…"; btn.disabled=true;
    var sys="Sen İngilizce öğreten bir öğretmensin. Verilen İngilizce kelimeyi Türkçe açıkla: kısa tanım, ne zaman/nasıl kullanılır, 1-2 örnek cümle (İngilizce + Türkçe çeviri). Kısa ve öğretici, akıcı yaz.";
    var usr="Kelime: \""+word+"\"\nTürkçe anlamları: "+anlamlar.join(", ")+"\nBu kelimeyi öğrenciye açıkla.";
    DHProviders.chat([{role:"system",content:sys},{role:"user",content:usr}],{temperature:0.5,max_tokens:400})
      .then(function(txt){ out.innerHTML='<div class="dh-wp-ai-out">'+esc(String(txt||"").trim())+'</div>'; })
      .catch(function(){ out.innerHTML='<div class="dh-wp-ai-out">Açıklama alınamadı. Anahtar/limit kontrol et.</div>'; })
      .then(function(){ btn.textContent="🎓 Kelime Açıklama (AI)"; btn.disabled=false; });
  }

  function tryPronounce(word){
    var out=document.getElementById("dhWpRecOut");
    var SR=global.SpeechRecognition||global.webkitSpeechRecognition;
    if(!SR){ out.style.color="#f87171"; out.textContent="Bu cihaz/tarayıcı ses tanımayı desteklemiyor."; return; }
    var rec=new SR(); rec.lang="en-US"; rec.interimResults=false; rec.maxAlternatives=3;
    out.style.color="#38bdf8"; out.textContent="🎙 Dinliyorum… kelimeyi söyle.";
    rec.onresult=function(e){
      var heard="";
      for(var i=0;i<e.results[0].length;i++){ heard=(e.results[0][i].transcript||"").toLowerCase().trim(); if(heard.indexOf(word.toLowerCase())>=0) break; }
      var ok=heard.indexOf(word.toLowerCase())>=0;
      out.style.color= ok?"#34d399":"#f59e0b";
      out.textContent= ok?"✓ Harika! Doğru telaffuz ("+heard+")":"Duyduğum: \""+heard+"\" — tekrar dene.";
    };
    rec.onerror=function(){ out.style.color="#f87171"; out.textContent="Ses alınamadı, tekrar dene."; };
    try{ rec.start(); }catch(e){ out.textContent="Başlatılamadı."; }
  }

  function fillSentences(word){
    loadSentences().then(function(list){
      var host=document.getElementById("dhWpSents"); if(!host) return;
      var re=new RegExp("\\b"+word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i");
      var found=[];
      for(var i=0;i<list.length && found.length<8;i++){ if(re.test(list[i].en||"")) found.push(list[i]); }
      var titleEl=document.getElementById("dhWpSentTitle");
      if(titleEl) titleEl.textContent="Bu kelimenin geçtiği cümleler ("+found.length+")";
      if(!found.length){ host.innerHTML='<div class="dh-wp-muted">Bu kelime için örnek cümle bulunamadı.</div>'; return; }
      host.innerHTML=found.map(function(s){
        var en=(s.en||"").replace(re, function(m){ return "<b style=\"color:#38bdf8\">"+m+"</b>"; });
        return '<div class="dh-wp-sent"><div class="en">'+en+'</div>'+(s.tr?'<div class="tr">'+esc(s.tr)+'</div>':'')+'<button class="play" data-en="'+esc(s.en||"")+'">▶</button><button class="gtr" data-en="'+esc(s.en||"")+'" title="Google Translate">🌐</button></div>';
      }).join("");
      host.querySelectorAll(".play").forEach(function(b){ b.onclick=function(){ speak(b.getAttribute("data-en"),0.9); }; });
      host.querySelectorAll(".gtr").forEach(function(b){ b.onclick=function(){ openGoogleTranslate(b.getAttribute("data-en")); }; });
    });
  }

  function updateMeanings(list){
    if(!popEl) return;
    var box = popEl.querySelector(".dh-wp-box");
    if(!box) return;
    var head = box.querySelector(".dh-wp-boxhead");
    box.innerHTML = "";
    if(head) box.appendChild(head);
    (list||[]).forEach(function(m,i){
      var d=document.createElement("div"); d.className="dh-wp-mean"; d.textContent=(i+1)+". "+m;
      box.appendChild(d);
    });
  }

  /* Kelime yerel sözlükte (variants dahil) bulunamazsa: büyük ekranı yine de
     aç, ve AI (Groq/Cerebras/Gemini) ile anlık Türkçe anlam üretmeyi dene. */
  function defineWithAI(word){
    open({ word: word, data: { anlamlar: ["⏳ Sözlükte yok — AI ile anlam aranıyor…"], oku:"", frekans:"", seviye:"" } });
    if(!(global.DHProviders && DHProviders.hasAnyKey && DHProviders.hasAnyKey())){
      updateMeanings(["📕 Bu kelime yerel sözlükte yok. AI açıklaması için öğretmen sayfasından bir API anahtarı ekle (Groq, Cerebras veya Gemini)."]);
      return;
    }
    var sys="Sen İngilizce-Türkçe sözlük gibi çalışıyorsun. Verilen İngilizce kelime bir çekim ekiyle gelmiş olabilir (örn. çoğul, geçmiş zaman, -ing) — önce sözlük kökünü bul, sonra o kökün 1-3 kısa Türkçe karşılığını SADECE virgülle ayrılmış liste halinde ver. Başka hiçbir açıklama, cümle veya noktalama ekleme.";
    var usr="Kelime: \""+word+"\"";
    DHProviders.chat([{role:"system",content:sys},{role:"user",content:usr}],{temperature:0.3,max_tokens:60})
      .then(function(txt){
        var list=String(txt||"").split(",").map(function(s){ return s.trim(); }).filter(Boolean);
        updateMeanings(list.length?list:["Anlam bulunamadı."]);
      })
      .catch(function(err){
        var code = err && err.code;
        var msg =
          code==="no-key" ? "📕 Bu kelime yerel sözlükte yok ve AI anahtarı bulunamadı. Öğretmen sayfasından bir API anahtarı ekle (Groq, Cerebras veya Gemini)." :
          code==="rate" || code==="all-failed" ? "⏳ Tüm AI sağlayıcıları şu an limitte/başarısız. Biraz sonra tekrar dene." :
          code==="bad-key" ? "🔑 API anahtarı geçersiz görünüyor. Öğretmen sayfasından anahtarını kontrol et." :
          code==="network" ? "📡 Ağ/CORS hatası — internet bağlantını kontrol et." :
          "Anlam alınamadı. Bağlantı/anahtar kontrol et.";
        updateMeanings([msg]);
      });
  }

  /* ================= 🌊 SES DALGASI (sesdalga.html mantığı — kelime bazlı) =================
     Aynı ölçüm hattı: analyser fftSize=64, 40ms örnekleme, ortalama genlik.
     Hoca: TTS hoparlörden konuşurken mikrofon (yankı bastırma KAPALI) gerçek sesi kaydeder.
     Kıyas: sessizlik kırpma (eşik 8) → süre (tempo), zirve konumu (vurgu), STT (söz). */
  var WV = null;
  function wvCleanup(){
    if(!WV) return;
    try{ if(WV.timer) clearInterval(WV.timer); }catch(e){}
    try{ if(WV.rec && WV.rec.state!=="inactive") WV.rec.stop(); }catch(e){}
    try{ if(WV.stream) WV.stream.getTracks().forEach(function(t){t.stop();}); }catch(e){}
    try{ if(WV.sr) WV.sr.stop(); }catch(e){}
    try{ (WV.playing||[]).forEach(function(a){a.pause();}); }catch(e){}
    if(WV.coachUrl){ try{ URL.revokeObjectURL(WV.coachUrl); }catch(e){} }
    if(WV.userUrl){ try{ URL.revokeObjectURL(WV.userUrl); }catch(e){} }
    WV=null;
  }
  function wvEl(id){ return document.getElementById(id); }
  function wvStatus(msg,color){ var s=wvEl("dhWpWvStatus"); if(s){ s.textContent=msg; s.style.color=color||"#9fb3d9"; } }
  function wvAvg(arr){ var t=0; for(var i=0;i<arr.length;i++) t+=arr[i]; return t/arr.length; }
  function wvTrim(d){ var TH=8,s=0,e=d.length-1; while(s<d.length&&d[s]<TH)s++; while(e>s&&d[e]<TH)e--; return d.slice(s,e+1); }
  function wvResample(data,len){
    if(!data.length||data.length===len) return data.slice();
    var out=[],r=(data.length-1)/Math.max(len-1,1);
    for(var i=0;i<len;i++){ var p=i*r,a=Math.floor(p),b=Math.min(a+1,data.length-1),w=p-a; out.push(data[a]*(1-w)+data[b]*w); }
    return out;
  }
  function wvTemplate(word){
    var n=Math.max(1,syllabify(word).split("·").length), frames=Math.max(14,n*11), out=[];
    for(var i=0;i<frames;i++){
      var pos=i/frames*n, k=Math.floor(pos), c=(pos-k)-0.5;
      out.push(Math.max(6,Math.round(62*Math.exp(-c*c*10))));
    }
    return out;
  }
  function wvDraw(){
    if(!WV) return;
    var cv=wvEl("dhWpWvCanvas"); if(!cv) return;
    var w=cv.clientWidth,h=cv.clientHeight;
    if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
    var ctx=cv.getContext("2d"); ctx.clearRect(0,0,w,h);
    var C=WV.viewC||[], U=WV.viewU||[];
    if(C.length&&U.length&&C.length===U.length){
      ctx.fillStyle="rgba(244,63,94,0.12)"; ctx.beginPath();
      var st=w/Math.max(C.length-1,1);
      for(var i=0;i<C.length;i++){
        var yC=h-(C[i]/100)*(h*0.85)-2, yU=h-((U[i]||0)/100)*(h*0.85)-2, x=i*st;
        if(i===0) ctx.moveTo(x,yC); else ctx.lineTo(x,yC);
        ctx.lineTo(x,yU);
      }
      ctx.fill();
    }
    function line(data,color){
      if(!data.length) return;
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.beginPath();
      var st=w/Math.max(data.length-1,1);
      for(var i=0;i<data.length;i++){
        var y=h-(data[i]/100)*(h*0.85)-2;
        if(i===0) ctx.moveTo(0,y); else ctx.lineTo(i*st,y);
      }
      ctx.stroke();
    }
    line(C,"#38bdf8"); line(U,"#4ade80");
  }
  function wvInit(word){
    wvCleanup();
    WV={word:word,coach:[],user:[],viewC:[],viewU:[],coachUrl:null,userUrl:null,
        coachDur:0,userDur:0,timer:null,stream:null,rec:null,sr:null,heard:"",
        recording:false,playing:[]};
    var bC=wvEl("dhWpWvCoach"),bR=wvEl("dhWpWvRec"),bK=wvEl("dhWpWvCmp"),
        pC=wvEl("dhWpWvPlayC"),pU=wvEl("dhWpWvPlayU"),pD=wvEl("dhWpWvDuet");
    if(!bC) return;
    bC.onclick=function(){ wvCoach(word); };
    bR.onclick=function(){ WV.recording ? wvStopRec() : wvRecord(word); };
    bK.onclick=function(){ wvCompare(word); };
    pC.onclick=function(){ wvPlay("coach",word); };
    pU.onclick=function(){ wvPlay("user",word); };
    pD.onclick=function(){ wvPlay("duet",word); };
    setTimeout(wvDraw,60);
  }
  function wvStopAudio(){ try{ (WV.playing||[]).forEach(function(a){a.pause();}); }catch(e){} WV.playing=[]; }
  function wvCoach(word){
    var me=WV; if(!me) return;
    wvStopAudio();
    me.coach=[]; me.viewC=[]; me.viewU=me.user.slice();
    if(me.coachUrl){ try{ URL.revokeObjectURL(me.coachUrl); }catch(e){} me.coachUrl=null; }
    var sc=wvEl("dhWpWvScore"); if(sc) sc.style.display="none";
    wvEl("dhWpWvCoach").disabled=true;
    wvStatus("🎓 Hoca konuşuyor — hoparlör açık olsun, dalga canlı çiziliyor…","#38bdf8");
    var capStream=null,capCtx=null,capAn=null,capData=null,capRec=null,chunks=[],micFail=false;
    function finish(){
      if(WV!==me) return;
      clearInterval(me.timer); me.timer=null;
      try{ if(capRec&&capRec.state!=="inactive") capRec.stop(); }catch(e){}
      try{ if(capStream) capStream.getTracks().forEach(function(t){t.stop();}); }catch(e){}
      try{ if(capCtx) capCtx.close(); }catch(e){}
      setTimeout(function(){
        if(WV!==me) return;
        var mx=0; for(var i=0;i<me.coach.length;i++) if(me.coach[i]>mx) mx=me.coach[i];
        if(micFail||!me.coach.length||mx<20){
          me.coach=wvTemplate(word); me.coachUrl=null;
          wvStatus(micFail?"⚠️ Mikrofon izni yok — ritim şablonu kullanıldı. Yine de kaydını kıyaslayabilirsin.":"⚠️ Mikrofon hocayı duyamadı (kulaklık takılı olabilir) — ritim şablonu kullanıldı.","#f59e0b");
        }else{
          wvStatus("🎓 Hoca hazır (gerçek kayıt). Şimdi '2. Sen Oku' ile aynı kelimeyi söyle.","#4ade80");
        }
        me.coachDur=me.coach.length*0.04;
        me.viewC=me.coach.slice();
        wvEl("dhWpWvDurC").textContent=me.coachDur.toFixed(1)+"s";
        wvEl("dhWpWvCoach").disabled=false;
        wvEl("dhWpWvRec").disabled=false;
        wvEl("dhWpWvPlayC").disabled=false;
        if(me.user.length) wvEl("dhWpWvCmp").disabled=false;
        wvDraw();
      },250);
    }
    var pStream = (navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)
      ? navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false}})
      : Promise.reject();
    pStream.then(function(st){
      if(WV!==me){ st.getTracks().forEach(function(t){t.stop();}); return; }
      capStream=st;
      capCtx=new (window.AudioContext||window.webkitAudioContext)();
      capAn=capCtx.createAnalyser(); capAn.fftSize=64;
      capData=new Uint8Array(capAn.frequencyBinCount);
      capCtx.createMediaStreamSource(st).connect(capAn);
      try{
        capRec=new MediaRecorder(st);
        capRec.ondataavailable=function(e){ if(e.data.size>0) chunks.push(e.data); };
        capRec.onstop=function(){ if(chunks.length&&WV===me) me.coachUrl=URL.createObjectURL(new Blob(chunks,{type:"audio/webm"})); };
        capRec.start();
      }catch(e){}
    }).catch(function(){ micFail=true; })
    .then(function(){
      if(WV!==me) return;
      if(!("speechSynthesis" in window)){ me.coach=wvTemplate(word); finish(); return; }
      try{ speechSynthesis.cancel(); }catch(e){}
      var u=new SpeechSynthesisUtterance(word);
      u.lang="en-US"; u.rate=0.78; u.__dhMixed=true;
      me.timer=setInterval(function(){
        var vol=15;
        if(capAn){ capAn.getByteFrequencyData(capData); vol=wvAvg(capData); }
        me.coach.push(vol);
        me.viewC=me.coach;
        wvEl("dhWpWvDurC").textContent=(me.coach.length*0.04).toFixed(1)+"s";
        wvDraw();
      },40);
      u.onend=finish;
      u.onerror=finish;
      speechSynthesis.speak(u);
      setTimeout(function(){ if(me.timer) finish(); },6000); /* emniyet */
    });
  }
  function wvRecord(word){
    var me=WV; if(!me||me.recording) return;
    wvStopAudio();
    me.user=[]; me.viewU=[]; me.viewC=me.coach.slice(); me.heard="";
    if(me.userUrl){ try{ URL.revokeObjectURL(me.userUrl); }catch(e){} me.userUrl=null; }
    var sc=wvEl("dhWpWvScore"); if(sc) sc.style.display="none";
    navigator.mediaDevices.getUserMedia({audio:true}).then(function(st){
      if(WV!==me){ st.getTracks().forEach(function(t){t.stop();}); return; }
      me.stream=st;
      var ctxA=new (window.AudioContext||window.webkitAudioContext)();
      me.ctxA=ctxA;
      var an=ctxA.createAnalyser(); an.fftSize=64;
      var da=new Uint8Array(an.frequencyBinCount);
      ctxA.createMediaStreamSource(st).connect(an);
      var chunks=[];
      try{
        me.rec=new MediaRecorder(st);
        me.rec.ondataavailable=function(e){ if(e.data.size>0) chunks.push(e.data); };
        me.rec.onstop=function(){ if(chunks.length&&WV===me){ me.userUrl=URL.createObjectURL(new Blob(chunks,{type:"audio/webm"})); wvEl("dhWpWvPlayU").disabled=false; if(me.coachUrl) wvEl("dhWpWvDuet").disabled=false; } };
        me.rec.start();
      }catch(e){}
      var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(SR){ try{ me.sr=new SR(); me.sr.lang="en-US"; me.sr.onresult=function(e){ me.heard=(e.results[0][0].transcript||"").toLowerCase(); }; me.sr.start(); }catch(e){ me.sr=null; } }
      me.recording=true;
      var b=wvEl("dhWpWvRec"); b.textContent="■ Durdur"; b.classList.add("on");
      wvStatus("🎙️ Kaydediliyor — \""+word+"\" de ve durdur…","#f43f5e");
      me.timer=setInterval(function(){
        an.getByteFrequencyData(da);
        me.user.push(wvAvg(da));
        me.viewU=me.user;
        wvEl("dhWpWvDurU").textContent=(me.user.length*0.04).toFixed(1)+"s";
        wvDraw();
        if(me.user.length*0.04>=6) wvStopRec(); /* tek kelime için emniyet tavanı */
      },40);
    }).catch(function(){ wvStatus("Mikrofon izni verilmedi.","#f87171"); });
  }
  function wvStopRec(){
    var me=WV; if(!me||!me.recording) return;
    me.recording=false;
    clearInterval(me.timer); me.timer=null;
    try{ if(me.rec&&me.rec.state!=="inactive") me.rec.stop(); }catch(e){}
    try{ if(me.stream) me.stream.getTracks().forEach(function(t){t.stop();}); }catch(e){}
    try{ if(me.ctxA) me.ctxA.close(); }catch(e){}
    try{ if(me.sr) me.sr.stop(); }catch(e){}
    me.stream=null; me.rec=null;
    me.userDur=me.user.length*0.04;
    var b=wvEl("dhWpWvRec"); b.textContent="🎙️ 2. Sen Oku"; b.classList.remove("on");
    if(me.coach.length) wvEl("dhWpWvCmp").disabled=false;
    wvStatus("Kaydın hazır. '3. Kıyasla' ile hocayla karşılaştır.","#4ade80");
  }
  function wvCompare(word){
    var me=WV; if(!me||!me.coach.length||!me.user.length) return;
    var sC=wvTrim(me.coach), sU=wvTrim(me.user);
    if(!sC.length||!sU.length){ wvStatus("Ses algılanamadı — tekrar dene.","#f59e0b"); return; }
    var dC=sC.length*0.04, dU=sU.length*0.04;
    var rU=wvResample(sU,sC.length);
    me.viewC=sC; me.viewU=rU; wvDraw();
    wvEl("dhWpWvDurC").textContent=dC.toFixed(1)+"s Net";
    wvEl("dhWpWvDurU").textContent=dU.toFixed(1)+"s Net";
    /* sesdalga formülleri */
    var tempo=Math.max(0,Math.round(100-(Math.abs(dC-dU)/dC*100)));
    var mC=0,iC=0,mU=0,iU=0;
    for(var i=0;i<sC.length;i++){
      if(sC[i]>mC){mC=sC[i];iC=i;}
      if(rU[i]>mU){mU=rU[i];iU=i;}
    }
    var vurgu=Math.max(0,Math.round(100-(Math.abs(iC-iU)/sC.length*160)));
    var soz=null;
    if(me.sr!==undefined&&me.heard) soz=(me.heard.indexOf(String(word).toLowerCase())>=0)?100:40;
    var genel=(soz!==null)?Math.round(soz*0.3+tempo*0.4+vurgu*0.3):Math.round(tempo*0.55+vurgu*0.45);
    var sc=wvEl("dhWpWvScore");
    sc.style.display="inline-block";
    if(genel>=85){ sc.textContent="Kusursuz 🌟 %"+genel; sc.style.background="#10b981"; }
    else if(genel>=65){ sc.textContent="İyi 👍 %"+genel; sc.style.background="#3b82f6"; sc.style.color="#fff"; }
    else{ sc.textContent="Gelişmeli 🎯 %"+genel; sc.style.background="#f59e0b"; }
    var det="Tempo %"+tempo+" • Vurgu %"+vurgu+(soz!==null?" • Söz %"+soz:"");
    if(genel>=85) wvStatus("🌟 "+det+" — dalgan hocayla neredeyse örtüşüyor.","#34d399");
    else if(genel>=65) wvStatus("👍 "+det+" — Düet ile farkı dinleyip tekrar dene.","#60a5fa");
    else wvStatus("🎯 "+det+" — süre/vurgu sapıyor; hocayı dinle, ▶ Düet ile aynala.","#f59e0b");
  }
  function wvPlay(mode,word){
    var me=WV; if(!me) return;
    wvStopAudio();
    function coachAudio(){
      if(me.coachUrl){ var a=new Audio(me.coachUrl); me.playing.push(a); a.play().catch(function(){}); }
      else speak(word,0.78);
    }
    function userAudio(){
      if(me.userUrl){ var a=new Audio(me.userUrl); me.playing.push(a); a.play().catch(function(){}); }
    }
    if(mode==="coach") coachAudio();
    else if(mode==="user") userAudio();
    else{ coachAudio(); userAudio(); } /* düet: birebir senkron */
  }
  /* ================= /SES DALGASI ================= */

  function onClick(e){
    if(!enabled || popEl) return;
    var t=e.target; if(!t) return;
    if(t.closest && t.closest("input,textarea,button,a,select,.no-wordpop")) return;
    var sel=(global.getSelection && global.getSelection().toString())||"";
    if(sel && sel.length>2) return;
    var word=wordAtPoint(e); if(!word) return;
    var cleaned=cleanWord(word);
    if(!cleaned || cleaned.length<2 || !/^[a-z'-]+$/.test(cleaned)) return;
    loadDict().then(function(){ var entry=findEntry(cleaned); if(entry) open(entry); else defineWithAI(cleaned); });
  }
  function wordAtPoint(e){
    try{
      var range=null;
      if(document.caretRangeFromPoint) range=document.caretRangeFromPoint(e.clientX,e.clientY);
      else if(document.caretPositionFromPoint){ var p=document.caretPositionFromPoint(e.clientX,e.clientY); if(p){ range=document.createRange(); range.setStart(p.offsetNode,p.offset); } }
      if(!range || !range.startContainer || range.startContainer.nodeType!==3) return "";
      var text=range.startContainer.textContent||"", off=range.startOffset, s=off, en=off;
      while(s>0 && /[a-zA-Z'-]/.test(text[s-1])) s--;
      while(en<text.length && /[a-zA-Z'-]/.test(text[en])) en++;
      return text.slice(s,en);
    }catch(err){ return ""; }
  }

  global.DHWordPop = {
    __v2:true,
    lookup:function(w){ loadDict().then(function(){ var e=findEntry(cleanWord(w)); if(e) open(e); else defineWithAI(cleanWord(w)); }); },
    enable:function(){ enabled=true; }, disable:function(){ enabled=false; }, close:close
  };
  if(document.readyState!=="loading") document.addEventListener("click", onClick, true);
  else document.addEventListener("DOMContentLoaded", function(){ document.addEventListener("click", onClick, true); });
})(window);
