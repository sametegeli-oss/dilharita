/* word-popup.js — ZENGİN KELİME AÇIKLAMA POPUP (v2)
   Dil Harita — Her sayfada İngilizce kelimeye tıkla, tam donanımlı panel aç.
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
    var merged=[];
    for(var j=0;j<parts.length;j++){
      var p=parts[j];
      var hasV=/[aeiouy]/.test(p);
      if(!hasV && merged.length){ merged[merged.length-1]+=p; }
      else merged.push(p);
    }
    return merged.join(" · ")||w;
  }

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
    +".dh-wp-mean{color:#e8eef7;font-size:15px;padding:5px 0;line-height:1.4}"
    +".dh-wp-syl{font-size:16px;color:#e8eef7;font-weight:700;letter-spacing:1px}"
    +".dh-wp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}"
    +".dh-wp-btn{border:0;border-radius:12px;padding:12px 8px;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;text-align:center;line-height:1.2}"
    +".dh-wp-b1{background:#2563eb;color:#fff}"
    +".dh-wp-video{background:#dc2626;color:#fff}"
    +".dh-wp-ai{background:linear-gradient(180deg,#10b981,#059669);color:#fff}"
    +".dh-wp-mnemonic{background:linear-gradient(180deg,#f59e0b,#d97706);color:#fff}"
    +".dh-wp-rec{background:#dc2626;color:#fff;width:100%;margin-bottom:10px}"
    +".dh-wp-sec-title{font-size:13px;font-weight:800;color:#9fb3d9;margin:6px 0 8px}"
    +".dh-wp-sent{background:#0b1830;border:1px solid #1e3a5f;border-radius:12px;padding:11px 12px;margin-bottom:8px;position:relative}"
    +".dh-wp-sent .en{color:#e8eef7;font-size:14px;line-height:1.4;padding-right:56px}"
    +".dh-wp-sent .tr{color:#9fb3d9;font-size:13px;margin-top:3px}"
    +".dh-wp-ai-out{background:#0b1830;border:1px solid #10b98155;border-radius:12px;padding:12px;margin-bottom:10px;color:#d1fae5;font-size:14px;line-height:1.5;white-space:pre-wrap}"
    +".dh-wp-mnemonic-out{background:#0b1830;border:1px solid #f59e0b55;border-radius:12px;padding:12px;margin-bottom:10px;color:#fef3c7;font-size:14px;line-height:1.5;white-space:pre-wrap}"
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
     +'<div class="dh-wp-box"><div class="dh-wp-boxhead">🎙 Telaffuzunu dene</div>'
       +'<div class="dh-wp-rec-out" id="dhWpRecOut"></div>'
       +'<button class="dh-wp-btn dh-wp-rec" id="dhWpRec">🎙 Kaydı başlat</button>'
     +'</div>'
     +'<div class="dh-wp-sec-title" id="dhWpSentTitle">Bu kelimenin geçtiği cümleler</div>'
     +'<div id="dhWpSents"><div class="dh-wp-muted">Cümleler yükleniyor…</div></div>'
     +'</div>';
    document.body.appendChild(ov); popEl=ov;
    ov.addEventListener("click", function(e){ if(e.target===ov) close(); });
    document.getElementById("dhWpX").onclick=close;
    document.getElementById("dhWpListen").onclick=function(){ speak(w,0.9); };
    document.getElementById("dhWpVideo").onclick=function(){ window.open("https://youglish.com/pronounce/"+encodeURIComponent(w)+"/english","_blank"); };
    document.getElementById("dhWpAI").onclick=function(){ aiExplain(w, anlamlar); };
    document.getElementById("dhWpMnemonic").onclick=function(){ aiMnemonic(w, anlamlar); };
    document.getElementById("dhWpRec").onclick=function(){ tryPronounce(w); };
    fillSentences(w);
  }

  function aiExplain(word, anlamlar){
    var out=document.getElementById("dhWpAIOut"), btn=document.getElementById("dhWpAI");
    if(!(global.DHProviders && DHProviders.hasAnyKey && DHProviders.hasAnyKey())){
      out.innerHTML='<div class="dh-wp-ai-out">API anahtarı bulunamadı.</div>';
      return;
    }
    btn.textContent="⏳ Açıklanıyor…"; btn.disabled=true;
    var sys="Sen İngilizce öğretmenisin. Kelimeyi Türkçe açıkla: tanım, kullanım alanı, 1-2 örnek cümle.";
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
    
    var sys = "Sen kelimeleri Türkçe benzeşimle (mnemonic) ezberleten bir uzmansın.\n"
            + "Çıktında MUTLAKA şu adımları yaz:\n"
            + "1. Kelimenin Okunuşu\n"
            + "2. Türkçe Benzeşim/Şifre Sözcükleri\n"
            + "3. Kısa Görsel Hikaye\n"
            + "4. Özet Hatırlama Cümlesi\n"
            + "5. GÖRSEL_ARAMA: [Hikayedeki görseli anlatan 2-3 İngilizce anahtar kelime]\n\n"
            + "ÖNEMLİ: 5. adımı 'GÖRSEL_ARAMA: [kelimeler]' şeklinde yazmayı asla unutma.";

    var usr = "Kelime: \"" + word + "\"\nAnlamı: " + anlamlar.join(", ");

    DHProviders.chat([{role:"system",content:sys},{role:"user",content:usr}],{temperature:0.7,max_tokens:450})
      .then(function(txt){
        var rawText = String(txt||"").trim();
        var searchTerms = word;

        var match = rawText.match(/GÖRSEL_ARAMA:\s*\[?(.*?)\]?$/i);
        if(match && match[1]){
          searchTerms = match[1].trim().replace(/[^a-zA-Z0-9\s]/g, "");
          rawText = rawText.replace(/(?:5\.\s*)?GÖRSEL_ARAMA:.*$/i, "").trim();
        }

        var cleanTxt = esc(rawText);
        var cleanPrompt = encodeURIComponent(searchTerms.trim() || word);

        var imgUrl = "https://image.pollinations.ai/prompt/" + cleanPrompt + "%20digital%20art%20illustration?width=600&height=300&nologo=true";

        var fallbackSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='300' viewBox='0 0 600 300'><rect width='100%' height='100%' fill='%2313294d'/><text x='50%' y='45%' font-family='sans-serif' font-size='24' font-weight='bold' fill='%2338bdf8' text-anchor='middle'>💡 " + esc(word).toUpperCase() + "</text><text x='50%' y='62%' font-family='sans-serif' font-size='16' fill='%239fb3d9' text-anchor='middle'>" + esc(searchTerms) + "</text></svg>";

        var imgHtml = '<div style="position:relative;margin-top:10px;min-height:180px;background:#020617;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid #1e3a5f;">'
                    + '<div id="dhWpImgLoader" style="position:absolute;color:#9fb3d9;font-size:13px;font-weight:700;">🖼️ Görsel Çiziliyor...</div>'
                    + '<img class="dh-wp-mnemonic-img" src="' + imgUrl + '" alt="' + esc(searchTerms) + '" '
                    + 'style="width:100%;height:180px;object-fit:cover;display:block;position:relative;z-index:2;" '
                    + 'onload="document.getElementById(\'dhWpImgLoader\').style.display=\'none\';" '
                    + 'onerror="this.onerror=null;this.src=\'' + fallbackSvg + '\';document.getElementById(\'dhWpImgLoader\').style.display=\'none\';">'
                    + '</div>';

        out.innerHTML = '<div class="dh-wp-mnemonic-out">' + cleanTxt + imgHtml + '</div>';
      })
      .catch(function(){ out.innerHTML='<div class="dh-wp-mnemonic-out">Şifre üretilemedi.</div>'; })
      .then(function(){ btn.textContent="💡 Şifre Oluştur (AI)"; btn.disabled=false; });
  }

  function tryPronounce(word){
    var out=document.getElementById("dhWpRecOut");
    var SR=global.SpeechRecognition||global.webkitSpeechRecognition;
    if(!SR){ out.style.color="#f87171"; out.textContent="Ses tanıma desteklenmiyor."; return; }
    var rec=new SR(); rec.lang="en-US"; rec.interimResults=false;
    out.style.color="#38bdf8"; out.textContent="🎙 Dinliyorum…";
    rec.onresult=function(e){
      var heard=(e.results[0][0].transcript||"").toLowerCase().trim();
      var ok=heard.indexOf(word.toLowerCase())>=0;
      out.style.color= ok?"#34d399":"#f59e0b";
      out.textContent= ok?"✓ Doğru telaffuz ("+heard+")":"Duyduğum: \""+heard+"\"";
    };
    rec.onerror=function(){ out.style.color="#f87171"; out.textContent="Ses alınamadı."; };
    try{ rec.start(); }catch(e){}
  }

  function fillSentences(word){
    loadSentences().then(function(list){
      var host=document.getElementById("dhWpSents"); if(!host) return;
      var re=new RegExp("\\b"+word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i");
      var found=[];
      for(var i=0;i<list.length && found.length<8;i++){ if(re.test(list[i].en||"")) found.push(list[i]); }
      if(!found.length){ host.innerHTML='<div class="dh-wp-muted">Örnek cümle bulunamadı.</div>'; return; }
      host.innerHTML=found.map(function(s){
        return '<div class="dh-wp-sent"><div class="en">'+(s.en||"")+'</div><div class="tr">'+esc(s.tr||"")+'</div></div>';
      }).join("");
    });
  }

  global.DHWordPop = {
    __v2:true,
    lookup:function(w){ loadDict().then(function(){ var e=findEntry(cleanWord(w)); if(e) open(e); }); },
    enable:function(){ enabled=true; }, disable:function(){ enabled=false; }, close:close
  };
  if(document.readyState!=="loading") document.addEventListener("click", function(e){
    if(!enabled || popEl) return;
    var sel=(global.getSelection && global.getSelection().toString())||"";
    if(sel && sel.length>2) return;
    var range=document.caretRangeFromPoint?document.caretRangeFromPoint(e.clientX,e.clientY):null;
    if(!range || !range.startContainer || range.startContainer.nodeType!==3) return;
    var text=range.startContainer.textContent||"", off=range.startOffset, s=off, en=off;
    while(s>0 && /[a-zA-Z'-]/.test(text[s-1])) s--;
    while(en<text.length && /[a-zA-Z'-]/.test(text[en])) en++;
    var word=cleanWord(text.slice(s,en));
    if(word && word.length>=2) loadDict().then(function(){ var entry=findEntry(word); if(entry) open(entry); });
  }, true);
})(window);