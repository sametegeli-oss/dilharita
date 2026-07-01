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
    +".dh-wp-sent .en{color:#e8eef7;font-size:14px;line-height:1.4;padding-right:28px}"
    +".dh-wp-sent .tr{color:#9fb3d9;font-size:13px;margin-top:3px}"
    +".dh-wp-sent .play{position:absolute;top:10px;right:10px;background:none;border:0;color:#38bdf8;font-size:16px;cursor:pointer}"
    +".dh-wp-ai-out{background:#0b1830;border:1px solid #10b98155;border-radius:12px;padding:12px;margin-bottom:10px;color:#d1fae5;font-size:14px;line-height:1.5;white-space:pre-wrap}"
    +".dh-wp-rec-out{font-size:13px;font-weight:700;margin:4px 0 10px;min-height:18px}"
    +".dh-wp-muted{color:#64748b;font-size:13px;padding:6px 0}";
    document.head.appendChild(st);
  }

  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }
  function close(){ if(popEl){ popEl.remove(); popEl=null; } try{ speechSynthesis.cancel(); }catch(e){} }

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
     +'<div class="dh-wp-sec-title" id="dhWpSentTitle">Bu kelimenin geçtiği cümleler</div>'
     +'<div id="dhWpSents"><div class="dh-wp-muted">Cümleler yükleniyor…</div></div>'
     +'</div>';
    document.body.appendChild(ov); popEl=ov;
    ov.addEventListener("click", function(e){ if(e.target===ov) close(); });
    document.getElementById("dhWpX").onclick=close;
    document.getElementById("dhWpListen").onclick=function(){ speak(w,0.9); };
    document.getElementById("dhWpSlow").onclick=function(){ speak(w,0.55); };
    document.getElementById("dhWpFast").onclick=function(){ speak(w,1.25); };
    document.getElementById("dhWpVideo").onclick=function(){ try{ localStorage.setItem("dh-video-word",w); }catch(e){} location.href="./videopractice.html"; };
    document.getElementById("dhWpAI").onclick=function(){ aiExplain(w, anlamlar); };
    document.getElementById("dhWpRec").onclick=function(){ tryPronounce(w); };
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
        return '<div class="dh-wp-sent"><div class="en">'+en+'</div>'+(s.tr?'<div class="tr">'+esc(s.tr)+'</div>':'')+'<button class="play" data-en="'+esc(s.en||"")+'">▶</button></div>';
      }).join("");
      host.querySelectorAll(".play").forEach(function(b){ b.onclick=function(){ speak(b.getAttribute("data-en"),0.9); }; });
    });
  }

  function onClick(e){
    if(!enabled || popEl) return;
    var t=e.target; if(!t) return;
    if(t.closest && t.closest("input,textarea,button,a,select,.no-wordpop")) return;
    var sel=(global.getSelection && global.getSelection().toString())||"";
    if(sel && sel.length>2) return;
    var word=wordAtPoint(e); if(!word) return;
    var cleaned=cleanWord(word);
    if(!cleaned || cleaned.length<2 || !/^[a-z'-]+$/.test(cleaned)) return;
    loadDict().then(function(){ var entry=findEntry(cleaned); if(entry) open(entry); });
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
    lookup:function(w){ loadDict().then(function(){ var e=findEntry(cleanWord(w)); if(e) open(e); }); },
    enable:function(){ enabled=true; }, disable:function(){ enabled=false; }, close:close
  };
  if(document.readyState!=="loading") document.addEventListener("click", onClick, true);
  else document.addEventListener("DOMContentLoaded", function(){ document.addEventListener("click", onClick, true); });
})(window);
