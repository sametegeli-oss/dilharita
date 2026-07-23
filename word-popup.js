/* word-popup.js — ZENGİN KELİME AÇIKLAMA POPUP (v4.3 - Manuel Gemini Web Entegrasyonu)
   Dil Harita — Her sayfada İngilizce kelimeye tıkla, tam donanımlı panel aç.
*/
(function(global){
  "use strict";
  if(global.DHWordPop && global.DHWordPop.__v4) return;

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
    var merged=[];
    for(var j=0;j<parts.length;j++){
      var p=parts[j];
      var hasV=/[aeiouy]/.test(p);
      if(!hasV && merged.length){ merged[merged.length-1]+=p; }
      else merged.push(p);
    }
    return merged.join(" · ")||w;
  }

  function toggleFav(word){
    try{
      var favs = JSON.parse(localStorage.getItem("dh_fav_words") || "{}");
      var btn = document.getElementById("dhWpFavBtn");
      if(favs[word]){
        delete favs[word];
        if(btn) btn.textContent = "☆";
      } else {
        favs[word] = { date: Date.now(), level: 1 };
        if(btn) btn.textContent = "⭐";
      }
      localStorage.setItem("dh_fav_words", JSON.stringify(favs));
    }catch(e){}
  }

  function isFav(word){
    try{
      var favs = JSON.parse(localStorage.getItem("dh_fav_words") || "{}");
      return !!favs[word];
    }catch(e){ return false; }
  }

  function openGoogleTranslate(text){
    text=String(text||"").trim(); if(!text) return;
    function fallbackCopy(t){
      try{ var ta=document.createElement("textarea"); ta.value=t; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }catch(e){}
    }
    try{ if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).catch(function(){ fallbackCopy(text); }); } else { fallbackCopy(text); } }catch(e){ fallbackCopy(text); }
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

  function copyToClipboard(text, alertMsg){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text);
      } else {
        var ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
      }
      if(alertMsg) alert(alertMsg);
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
    +".dh-wp-fav{background:none;border:0;color:#f59e0b;font-size:22px;cursor:pointer;padding:0 5px}"
    +".dh-wp-x{margin-left:auto;background:#13294d;border:1px solid #1e3a5f;color:#e8eef7;width:34px;height:34px;border-radius:50%;font-size:16px;cursor:pointer;flex:0 0 auto}"
    +".dh-wp-box{background:#0b1830;border:1px solid #1e3a5f;border-radius:14px;padding:12px 14px;margin-bottom:10px}"
    +".dh-wp-boxhead{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#9fb3d9;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px}"
    +".dh-wp-mean{color:#e8eef7;font-size:15px;padding:5px 0;line-height:1.4}"
    +".dh-wp-syl{font-size:16px;color:#e8eef7;font-weight:700;letter-spacing:1px}"
    +".dh-wp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}"
    +".dh-wp-btn{border:0;border-radius:12px;padding:12px 8px;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;text-align:center;line-height:1.2}"
    +".dh-wp-b1{background:#2563eb;color:#fff}"
    +".dh-wp-video{background:#dc2626;color:#fff}"
    +".dh-wp-ai{background:linear-gradient(180deg,#10b981,#059669);color:#fff}"
    +".dh-wp-mnemonic{background:linear-gradient(180deg,#f59e0b,#d97706);color:#fff}"
    +".dh-wp-sec-title{font-size:13px;font-weight:800;color:#9fb3d9;margin:6px 0 8px}"
    +".dh-wp-sent{background:#0b1830;border:1px solid #1e3a5f;border-radius:12px;padding:11px 12px;margin-bottom:8px;position:relative}"
    +".dh-wp-sent .en{color:#e8eef7;font-size:14px;line-height:1.4;padding-right:56px}"
    +".dh-wp-sent .tr{color:#9fb3d9;font-size:13px;margin-top:3px}"
    +".dh-wp-sent .play{position:absolute;top:10px;right:10px;background:none;border:0;color:#38bdf8;font-size:16px;cursor:pointer}"
    +".dh-wp-sent .gtr{position:absolute;top:10px;right:38px;background:none;border:0;font-size:15px;cursor:pointer}"
    +".dh-wp-ai-out{background:#0b1830;border:1px solid #10b98155;border-radius:12px;padding:12px;margin-bottom:10px;color:#d1fae5;font-size:14px;line-height:1.5;white-space:pre-wrap}"
    +".dh-wp-mnemonic-out{background:#0b1830;border:1px solid #f59e0b55;border-radius:12px;padding:12px;margin-bottom:10px;color:#fef3c7;font-size:14px;line-height:1.5;white-space:pre-wrap;position:relative}"
    +".dh-wp-blur{filter:blur(6px);user-select:none;pointer-events:none;transition:filter .3s}"
    +".dh-wp-blur-btn{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;background:#f59e0b;color:#03131c;border:0;padding:10px 18px;border-radius:20px;font-weight:900;font-size:13px;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.5)}"
    +".dh-wp-custom-box{margin-top:10px;border-top:1px dashed #1e3a5f;padding-top:10px}"
    +".dh-wp-textarea{width:100%;box-sizing:border-box;background:#020617;border:1px solid #1e3a5f;border-radius:8px;color:#e8eef7;padding:8px 10px;font-size:13px;resize:vertical;min-height:60px;outline:none;margin-bottom:6px}"
    +".dh-wp-btn-row{display:flex;gap:6px;margin-bottom:6px}"
    +".dh-wp-gen-btn{flex:1;background:#38bdf8;color:#03131c;border:0;border-radius:8px;padding:9px;font-size:12px;font-weight:800;cursor:pointer}"
    +".dh-wp-gemini-btn{flex:1;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;border:0;border-radius:8px;padding:9px;font-size:12px;font-weight:800;cursor:pointer}"
    +".dh-wp-mnemonic-img{width:100%;height:180px;object-fit:cover;border-radius:10px;margin-top:10px;border:1px solid #1e3a5f;display:block}"
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
       +'<button class="dh-wp-fav" id="dhWpFavBtn" title="Favorilere Ekle / Aralıklı Tekrar">'+(isFav(w)?"⭐":"☆")+'</button>'
       +(d.oku?'<span class="dh-wp-read">'+esc(d.oku)+'</span>':'')
       +'<button class="dh-wp-x" id="dhWpX">✕</button>'
     +'</div>'
     +'<div class="dh-wp-box">'
       +'<div class="dh-wp-boxhead">📖 Anlamlar</div>'
       + anlamlar.map(function(m,i){ return '<div class="dh-wp-mean">'+(i+1)+'. '+esc(m)+'</div>'; }).join("")
     +'</div>'
     +'<div class="dh-wp-box"><div class="dh-wp-boxhead">🔤 Heceler</div><div class="dh-wp-syl">'+esc(syllabify(w))+'</div></div>'
     +'<div class="dh-wp-grid">'
       +'<button class="dh-wp-btn dh-wp-b1" id="dhWpListen">🔊 Dinle</button>'
       +'<button class="dh-wp-btn dh-wp-video" id="dhWpVideo">🎬 Videolarda Dinle</button>'
       +'<button class="dh-wp-btn dh-wp-ai" id="dhWpAI">🎓 Açıklama (AI)</button>'
       +'<button class="dh-wp-btn dh-wp-mnemonic" id="dhWpMnemonic">💡 Şifre Oluştur (AI)</button>'
     +'</div>'
     +'<div id="dhWpAIOut"></div>'
     +'<div id="dhWpMnemonicOut"></div>'
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
    document.getElementById("dhWpFavBtn").onclick=function(){ toggleFav(w); };
    document.getElementById("dhWpListen").onclick=function(){ speak(w,0.9); };
    document.getElementById("dhWpVideo").onclick=function(){ window.open("https://youglish.com/pronounce/"+encodeURIComponent(w)+"/english","_blank"); };
    document.getElementById("dhWpAI").onclick=function(){ aiExplain(w, anlamlar); };
    document.getElementById("dhWpMnemonic").onclick=function(){ aiMnemonic(w, anlamlar); };
    wvInit(w);
    fillSentences(w);
  }

  function aiExplain(word, anlamlar){
    var out=document.getElementById("dhWpAIOut"), btn=document.getElementById("dhWpAI");
    if(!(global.DHProviders && DHProviders.hasAnyKey && DHProviders.hasAnyKey())){
      out.innerHTML='<div class="dh-wp-ai-out">API anahtarı bulunamadı.</div>';
      return;
    }
    btn.textContent="⏳ Açıklanıyor…"; btn.disabled=true;
    var sys="Sen İngilizce öğretmenisin. Kelimeyi Türkçe açıkla: tanım, kullanım alanı, birlikte sık kullanıldığı 2-3 kelime (collocations) ve 1-2 örnek cümle.";
    var usr="Kelime: \""+word+"\"\nAnlamı: "+anlamlar.join(", ");
    DHProviders.chat([{role:"system",content:sys},{role:"user",content:usr}],{temperature:0.5,max_tokens:400})
      .then(function(txt){ out.innerHTML='<div class="dh-wp-ai-out">'+esc(String(txt||"").trim())+'</div>'; })
      .catch(function(){ out.innerHTML='<div class="dh-wp-ai-out">Açıklama alınamadı.</div>'; })
      .then(function(){ btn.textContent="🎓 Açıklama (AI)"; btn.disabled=false; });
  }

  function aiMnemonic(word, anlamlar){
    var out=document.getElementById("dhWpMnemonicOut"), btn=document.getElementById("dhWpMnemonic");
    if(!(global.DHProviders && DHProviders.hasAnyKey && DHProviders.hasAnyKey())){
      out.innerHTML='<div class="dh-wp-mnemonic-out">API anahtarı bulunamadı.</div>';
      return;
    }
    btn.textContent="⏳ Şifre & Görsel Hazırlanıyor…"; btn.disabled=true;
    
    var sys = "Sen kelimeleri Türkçe benzeşimle (mnemonic) ezberleten komik ve absürt bir uzmansın.\n"
            + "Çıktında MUTLAKA şu adımları yaz:\n"
            + "1. Kelimenin Okunuşu\n"
            + "2. Türkçe Benzeşim/Şifre Sözcükleri\n"
            + "3. Absürt & Komik Görsel Hikaye (Unutulmaz, komik veya sıra dışı bir sahne yarat)\n"
            + "4. Kafiyeli Slogan/Hatırlama Cümlesi\n"
            + "5. GÖRSEL_ARAMA: [Hikayedeki absürt görseli anlatan 3-4 İngilizce anahtar kelime]\n\n"
            + "ÖNEMLİ: 5. adımı 'GÖRSEL_ARAMA: [kelimeler]' şeklinde yazmayı asla unutma.";

    var usr = "Kelime: \"" + word + "\"\nAnlamı: " + anlamlar.join(", ");

    DHProviders.chat([{role:"system",content:sys},{role:"user",content:usr}],{temperature:0.8,max_tokens:450})
      .then(function(txt){
        var rawText = String(txt||"").trim();
        var searchTerms = word;

        var match = rawText.match(/GÖRSEL_ARAMA:\s*\[?(.*?)\]?$/i);
        if(match && match[1]){
          searchTerms = match[1].trim().replace(/[^a-zA-Z0-9\s]/g, "");
          rawText = rawText.replace(/(?:5\.\s*)?GÖRSEL_ARAMA:.*$/i, "").trim();
        }

        renderMnemonicBox(word, rawText, searchTerms, anlamlar);
      })
      .catch(function(){ out.innerHTML='<div class="dh-wp-mnemonic-out">Şifre üretilemedi.</div>'; })
      .then(function(){ btn.textContent="💡 Şifre Oluştur (AI)"; btn.disabled=false; });
  }

  function renderMnemonicBox(word, text, searchTerms, anlamlar){
    var out = document.getElementById("dhWpMnemonicOut");
    var cleanTxt = esc(text);
    var cleanPrompt = encodeURIComponent(searchTerms.trim() || word);

    var imgUrl = "https://image.pollinations.ai/prompt/" + cleanPrompt + "%20funny%20digital%20art%20illustration?width=600&height=300&nologo=true";
    var fallbackSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='300' viewBox='0 0 600 300'><rect width='100%' height='100%' fill='%2313294d'/><text x='50%' y='45%' font-family='sans-serif' font-size='24' font-weight='bold' fill='%2338bdf8' text-anchor='middle'>💡 " + esc(word).toUpperCase() + "</text><text x='50%' y='62%' font-family='sans-serif' font-size='16' fill='%239fb3d9' text-anchor='middle'>" + esc(searchTerms) + "</text></svg>";

    var imgContainerHtml = '<div id="dhWpImgWrapper" style="position:relative;margin-top:10px;min-height:180px;background:#020617;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid #1e3a5f;">'
                         + '<div id="dhWpImgLoader" style="position:absolute;color:#9fb3d9;font-size:13px;font-weight:700;">🖼️ Görsel Çiziliyor...</div>'
                         + '<img class="dh-wp-mnemonic-img" id="dhWpMnemonicImg" src="' + imgUrl + '" alt="' + esc(searchTerms) + '" '
                         + 'style="width:100%;height:180px;object-fit:cover;display:block;position:relative;z-index:2;" '
                         + 'onload="var l=document.getElementById(\'dhWpImgLoader\'); if(l) l.style.display=\'none\';" '
                         + 'onerror="this.onerror=null;this.src=\'' + fallbackSvg + '\';var l=document.getElementById(\'dhWpImgLoader\'); if(l) l.style.display=\'none\';">'
                         + '</div>';

    var customBoxHtml = '<div class="dh-wp-custom-box">'
                      + '<div style="font-size:12px;font-weight:800;color:#9fb3d9;margin-bottom:4px;">✍️ Hatırlama Senaryosu & Hikaye:</div>'
                      + '<textarea class="dh-wp-textarea" id="dhWpCustomScenario" placeholder="Kendi hikayeni yapıştır veya Gemini\'ye ürettir..."></textarea>'
                      + '<div class="dh-wp-btn-row">'
                      + '<button class="dh-wp-gen-btn" id="dhWpGenCustomImg">🎨 Resim Üret</button>'
                      + '<button class="dh-wp-gemini-btn" id="dhWpGeminiGenStory">✨ Gemini İle Hikaye Üret</button>'
                      + '</div>'
                      + '</div>';

    out.innerHTML = '<div class="dh-wp-mnemonic-out" style="position:relative;">'
                  + '<button class="dh-wp-blur-btn" id="dhWpRevealBtn">👁️ Şifreyi & Hikayeyi Göster</button>'
                  + '<div class="dh-wp-blur" id="dhWpBlurContent">' + cleanTxt + imgContainerHtml + customBoxHtml + '</div>'
                  + '</div>';

    document.getElementById("dhWpRevealBtn").onclick = function(){
      document.getElementById("dhWpBlurContent").classList.remove("dh-wp-blur");
      this.style.display = "none";
    };

    // 1. Kutuya Yapıştırılan/Yazılan Hikayeden Resmi Üretme Butonu
    document.getElementById("dhWpGenCustomImg").onclick = function(){
      var userText = document.getElementById("dhWpCustomScenario").value.trim();
      if(!userText) return;
      var btn = this;
      btn.textContent = "⏳ Görsel Çiziliyor…"; btn.disabled = true;
      generateImageFromText(userText, word, function(){
        btn.textContent = "🎨 Resim Üret"; btn.disabled = false;
      });
    };

    // 2. ✨ Gemini İle Hikaye Üret Butonu (Prompt'u Kopyalar, Gemini Sayfasını Açar)
    document.getElementById("dhWpGeminiGenStory").onclick = function(){
      var promptText = "Sen İngilizce kelimeleri Türkçe ses benzeşimiyle (mnemonic) ezberleten komik ve yaratıcı bir öğretmensin.\n\n"
                     + "İngilizce Kelime: \"" + word + "\"\n"
                     + "Anlamı: " + (anlamlar ? anlamlar.join(", ") : "") + "\n\n"
                     + "Lütfen bu kelime için 2-3 cümlelik, son derece komik, absürt ve akılda kalıcı bir Türkçe benzeşim hikayesi yaz.";

      copyToClipboard(promptText, "📋 Prompt panoya kopyalandı!\n\nAçılan Gemini web sayfasına yapıştırın (Ctrl+V). Çıkan hikayeyi kopyalayıp buradaki kutuya koyun ve 'Resim Üret'e basın.");
      window.open("https://gemini.google.com/app", "_blank");
    };
  }

  function generateImageFromText(text, fallbackWord, callback){
    if(global.DHProviders && DHProviders.hasAnyKey && DHProviders.hasAnyKey()){
      var sys = "Sen bir AI görsel prompt üreticisisin. Verilen Türkçe hikayeyi görsel çizen AI için 3-4 kelimelik İngilizce anahtar terime çevir. SADECE İngilizce kelimeleri ver.";
      DHProviders.chat([{role:"system",content:sys},{role:"user",content:text}],{temperature:0.3,max_tokens:30})
        .then(function(translatedTerms){
          var cleanPrompt = encodeURIComponent(String(translatedTerms||"").trim().replace(/[^a-zA-Z0-9\s]/g, "") || fallbackWord);
          updateMnemonicImage(cleanPrompt);
        })
        .catch(function(){
          var fallbackPrompt = encodeURIComponent(text.replace(/[^a-zA-Z0-9\s]/g, "") || fallbackWord);
          updateMnemonicImage(fallbackPrompt);
        })
        .then(function(){ if(callback) callback(); });
    } else {
      var fallbackPrompt = encodeURIComponent(text.replace(/[^a-zA-Z0-9\s]/g, "") || fallbackWord);
      updateMnemonicImage(fallbackPrompt);
      if(callback) callback();
    }
  }

  function updateMnemonicImage(promptText){
    var imgEl = document.getElementById("dhWpMnemonicImg");
    var loaderEl = document.getElementById("dhWpImgLoader");
    if(!imgEl) return;
    if(loaderEl) loaderEl.style.display = "block";
    imgEl.src = "https://image.pollinations.ai/prompt/" + promptText + "%20funny%20digital%20art%20illustration?width=600&height=300&nologo=true&seed=" + Math.floor(Math.random()*1000);
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

  function defineWithAI(word){
    open({ word: word, data: { anlamlar: ["⏳ Sözlükte yok — AI ile anlam aranıyor…"], oku:"", frekans:"", seviye:"" } });
    if(!(global.DHProviders && DHProviders.hasAnyKey && DHProviders.hasAnyKey())){
      updateMeanings(["📕 Bu kelime yerel sözlükte yok. API anahtarı ekleyin."]);
      return;
    }
    var sys="Sen İngilizce-Türkçe sözlüksün. Kelimenin kökünü bul, 1-3 kısa Türkçe karşılığını virgülle ayrılmış ver.";
    var usr="Kelime: \""+word+"\"";
    DHProviders.chat([{role:"system",content:sys},{role:"user",content:usr}],{temperature:0.3,max_tokens:60})
      .then(function(txt){
        var list=String(txt||"").split(",").map(function(s){ return s.trim(); }).filter(Boolean);
        updateMeanings(list.length?list:["Anlam bulunamadı."]);
      })
      .catch(function(){ updateMeanings(["Anlam alınamadı."]); });
  }

  /* ================= 🌊 SES DALGASI ANALİZİ (Canvas Grafiği) ================= */
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
          wvStatus(micFail?"⚠️ Mikrofon izni yok — ritim şablonu kullanıldı.":"⚠️ Mikrofon hocayı duyamadı — ritim şablonu kullanıldı.","#f59e0b");
        }else{
          wvStatus("🎓 Hoca hazır (gerçek kayıt). Şimdi '2. Sen Oku' ile dene.","#4ade80");
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
      setTimeout(function(){ if(me.timer) finish(); },6000);
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
        if(me.user.length*0.04>=6) wvStopRec();
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
  function wvNormEnv(d){
    var mx=0; for(var i=0;i<d.length;i++) if(d[i]>mx) mx=d[i];
    if(mx<=0) return d.slice();
    var out=[]; for(var j=0;j<d.length;j++) out.push(d[j]/mx*100);
    return out;
  }
  function wvPearson(a,b){
    var n=Math.min(a.length,b.length); if(n<3) return 0;
    var ma=0,mb=0,i;
    for(i=0;i<n;i++){ ma+=a[i]; mb+=b[i]; } ma/=n; mb/=n;
    var num=0,da=0,db=0;
    for(i=0;i<n;i++){ var x=a[i]-ma,y=b[i]-mb; num+=x*y; da+=x*x; db+=y*y; }
    var den=Math.sqrt(da*db);
    return den?num/den:0;
  }
  function wvLevSim(a,b){
    a=String(a||""); b=String(b||"");
    if(!a.length||!b.length) return 0;
    if(a===b) return 1;
    var m=a.length,n=b.length,d=[],i,j;
    for(i=0;i<=m;i++) d[i]=[i];
    for(j=0;j<=n;j++) d[0][j]=j;
    for(i=1;i<=m;i++) for(j=1;j<=n;j++)
      d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    return 1-d[m][n]/Math.max(m,n);
  }
  function wvSozScore(heard,word){
    heard=String(heard||"").toLowerCase(); word=String(word||"").toLowerCase();
    if(!heard) return null;
    if(heard.indexOf(word)>=0) return 100;
    var best=0, toks=heard.split(/[^a-z']+/);
    for(var i=0;i<toks.length;i++){ var s=wvLevSim(toks[i],word); if(s>best) best=s; }
    if(best>=0.8) return 100;
    if(best>=0.5) return Math.round(60+best*40);
    return Math.round(40+best*40);
  }
  function wvCompare(word){
    var me=WV; if(!me||!me.coach.length||!me.user.length) return;
    var sC=wvTrim(me.coach), sU=wvTrim(me.user);
    if(!sC.length||!sU.length){ wvStatus("Ses algılanamadı — tekrar dene.","#f59e0b"); return; }
    var dC=sC.length*0.04, dU=sU.length*0.04;
    var nC=wvNormEnv(sC), nU=wvNormEnv(sU);
    var rU=wvResample(nU,nC.length);
    me.viewC=nC; me.viewU=rU; wvDraw();
    wvEl("dhWpWvDurC").textContent=dC.toFixed(1)+"s Net";
    wvEl("dhWpWvDurU").textContent=dU.toFixed(1)+"s Net";
    var excess=Math.max(0,Math.abs(dC-dU)-0.15);
    var tempo=Math.max(0,Math.round(100-excess/Math.max(dC,0.2)*80));
    var r=Math.max(-1,Math.min(1,wvPearson(nC,rU)));
    var shape=Math.round(((r+1)/2)*100);
    var mC=0,iC=0,mU=0,iU=0;
    for(var i=0;i<nC.length;i++){
      if(nC[i]>mC){mC=nC[i];iC=i;}
      if(rU[i]>mU){mU=rU[i];iU=i;}
    }
    var shift=Math.abs(iC-iU)/nC.length;
    var vurgu=shift<=0.12?100:Math.max(0,Math.round(100-(shift-0.12)*220));
    var soz=wvSozScore(me.heard,word);
    var genel=(soz!==null)
      ? Math.round(soz*0.4+shape*0.25+vurgu*0.15+tempo*0.2)
      : Math.round(shape*0.4+vurgu*0.25+tempo*0.35);
    var sc=wvEl("dhWpWvScore");
    sc.style.display="inline-block"; sc.style.color="#03131c";
    if(genel>=85){ sc.textContent="Kusursuz 🌟 %"+genel; sc.style.background="#10b981"; }
    else if(genel>=65){ sc.textContent="İyi 👍 %"+genel; sc.style.background="#3b82f6"; sc.style.color="#fff"; }
    else{ sc.textContent="Gelişmeli 🎯 %"+genel; sc.style.background="#f59e0b"; }
    var det="Şekil %"+shape+" • Tempo %"+tempo+" • Vurgu %"+vurgu+(soz!==null?" • Söz %"+soz:"");
    if(genel>=85) wvStatus("🌟 "+det+" — dalgan hocayla neredeyse örtüşüyor.","#34d399");
    else if(genel>=65) wvStatus("👍 "+det+" — Düet ile farkı dinleyip tekrar dene.","#60a5fa");
    else wvStatus("🎯 "+det+" — hocayı dinle, ▶ Düet ile aynala.","#f59e0b");
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
    else{ coachAudio(); userAudio(); }
  }

  global.DHWordPop = {
    __v4:true,
    lookup:function(w){ loadDict().then(function(){ var e=findEntry(cleanWord(w)); if(e) open(e); else defineWithAI(cleanWord(w)); }); },
    enable:function(){ enabled=true; }, disable:function(){ enabled=false; }, close:close
  };
  if(document.readyState!=="loading") document.addEventListener("click", function(e){
    if(!enabled || popEl) return;
    var t=e.target; if(!t) return;
    if(t.closest && t.closest("input,textarea,button,a,select,.no-wordpop")) return;
    var sel=(global.getSelection && global.getSelection().toString())||"";
    if(sel && sel.length>2) return;
    var range=document.caretRangeFromPoint?document.caretRangeFromPoint(e.clientX,e.clientY):null;
    if(!range || !range.startContainer || range.startContainer.nodeType!==3) return;
    var text=range.startContainer.textContent||"", off=range.startOffset, s=off, en=off;
    while(s>0 && /[a-zA-Z'-]/.test(text[s-1])) s--;
    while(en<text.length && /[a-zA-Z'-]/.test(text[en])) en++;
    var word=cleanWord(text.slice(s,en));
    if(word && word.length>=2) loadDict().then(function(){ var entry=findEntry(word); if(entry) open(entry); else defineWithAI(word); });
  }, true);
})(window);