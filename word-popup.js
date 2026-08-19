/* word-popup.js — ZENGİN KELİME AÇIKLAMA POPUP (v2)
   Dil Harita — Her sayfada İngilizce kelimeye tıkla, tam donanımlı panel aç.

   Özellikler: anlamlar + okunuş + seviye/frekans, EŞ ANLAMLILAR (kullanım
   sıklığına göre sıralı), heceler, Dinle/Yavaş/Hızlı, Kelime Açıklama (AI),
   Telaffuzunu dene, geçtiği cümleler.

   Sözlük:      data/dictionary.json
   Cümleler:    data/sentences.json
   Eş anlamlı:  data/synonyms.json      (tools/synonyms-uret.py üretir)
   Yedek frekans: data/ngram-yedek.json (tools/ngram-yedek-uret.py üretir)

   ── EŞ ANLAMLI SIRALAMASI (v3) ───────────────────────────────────────
   Liste, kelimelerin GERÇEK kullanım sıklığına göre çoktan aza sıralanır.
   Sıklık kaynağı önceliği:
     1) Google Books Ngram — CANLI. Google bu uç noktada CORS başlığı
        döndürmediği için tarayıcıdan doğrudan çağrılamaz; araya kendi
        proxy'miz girer. Proxy adresi:
             window.DH_NGRAM_PROXY   ya da   localStorage["dh-ngram-proxy"]
        Kurulum: tools/ngram-proxy.gs (Google Apps Script, 5 dakika).
        Alınan değerler localStorage'da 30 gün önbelleklenir — aynı
        kelimeye ikinci tıklamada ağa hiç çıkılmaz. Google arka arkaya
        isteklerde engelliyor, önbellek bunun için şart.
     2) data/ngram-yedek.json — proxy yoksa/çevrimdışıysa. Değerler Ngram
        ile aynı birimde ama yaklaşıktır; arayüzde "~" ile işaretlenir.
   Ayrıca her kelimenin yanında sözlükteki `frekans` alanı gösterilir:
   bu, kelimenin BU UYGULAMANIN kendi cümle korpusunda kaç kez geçtiği.
   Genel İngilizce sıklığı değildir, o yüzden sıralamada kullanılmaz —
   "yaygın ama ben hiç görmedim" ayrımını göstermek için durur.

   API: DHWordPop.lookup("running") / enable() / disable()
*/
(function(global){
  "use strict";
  if(global.DHWordPop && global.DHWordPop.__v2) return;

  var DICT_PATHS = ["./data/dictionary.json","data/dictionary.json","./dictionary.json"];
  /* Hafif örnek havuzu önce: 8.26 MB tam veri yerine 1.16 MB id/en/tr.
     Eski dosya, eski dağıtımlar ve üretim hataları için güvenlik ağıdır. */
  var SENT_PATHS = ["./data/sentences/examples.json","data/sentences/examples.json","./data/sentences.json","data/sentences.json","./sentences.json"];
  var SYN_PATHS  = ["./data/synonyms.json","data/synonyms.json","./synonyms.json"];
  var NGY_PATHS  = ["./data/ngram-yedek.json","data/ngram-yedek.json","./ngram-yedek.json"];
  var dict=null, dictLoading=null, sentences=null, sentLoading=null;
  var syn=null, synLoading=null, ngYedek=null, ngYedekLoading=null;
  var enabled=true, popEl=null;

  /* ---------- Ngram: proxy adresi + önbellek ---------- */
  var NG_CACHE_KEY = "dh-ngram-v1";
  var NG_TTL = 30*24*60*60*1000;              /* 30 gün */
  var NG_MAX = 4000;                          /* önbellekte en fazla kelime */

  function ngProxy(){
    try{
      if(global.DH_NGRAM_PROXY) return String(global.DH_NGRAM_PROXY);
      var v=localStorage.getItem("dh-ngram-proxy");
      if(v) return v;
    }catch(e){}
    return "";
  }
  function ngCacheOku(){
    try{ return JSON.parse(localStorage.getItem(NG_CACHE_KEY)||"{}")||{}; }
    catch(e){ return {}; }
  }
  function ngCacheYaz(obj){
    try{
      var ks=Object.keys(obj);
      if(ks.length>NG_MAX){
        /* en eski kayıtları at */
        ks.sort(function(a,b){ return (obj[a].t||0)-(obj[b].t||0); });
        for(var i=0;i<ks.length-NG_MAX;i++) delete obj[ks[i]];
      }
      localStorage.setItem(NG_CACHE_KEY, JSON.stringify(obj));
    }catch(e){}
  }

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

  function loadSyn(){
    if(syn) return Promise.resolve(syn);
    if(synLoading) return synLoading;
    synLoading=(function tryPath(i){
      if(i>=SYN_PATHS.length) return Promise.resolve({});
      return fetch(SYN_PATHS[i]).then(function(r){ if(!r.ok) throw 0; return r.json(); })
        .then(function(d){ syn=d||{}; return syn; }).catch(function(){ return tryPath(i+1); });
    })(0);
    return synLoading;
  }
  function loadNgYedek(){
    if(ngYedek) return Promise.resolve(ngYedek);
    if(ngYedekLoading) return ngYedekLoading;
    ngYedekLoading=(function tryPath(i){
      if(i>=NGY_PATHS.length) return Promise.resolve({});
      return fetch(NGY_PATHS[i]).then(function(r){ if(!r.ok) throw 0; return r.json(); })
        .then(function(d){ ngYedek=d||{}; return ngYedek; }).catch(function(){ return tryPath(i+1); });
    })(0);
    return ngYedekLoading;
  }

  /* ================= 💎 KELİME ANALİZİ DEPOSU (IndexedDB) =================
     Neden localStorage değil: analiz kaydı kelime başına birkaç yüz bayt ve
     zamanla binlerce kelimeye çıkar; localStorage'ın ~5 MB sınırına dayanır
     ve o sınıra çarptığında SESSİZCE yazamaz (bu projede daha önce yaşandı).
     IndexedDB'nin böyle bir sorunu yok.
     Ayrı bir veritabanı kullanılıyor ("sentence-mode" değil) — cümle
     ilerlemesiyle aynı depoya yazmak dh-plan-kopru.js'in taramasını
     kirletirdi. */
  var KA_DB="dh-kelime-analiz", KA_STORE="kelimeler", kaDbP=null;

  function kaOpen(){
    if(kaDbP) return kaDbP;
    kaDbP=new Promise(function(res,rej){
      if(!global.indexedDB) return rej(0);
      var r=global.indexedDB.open(KA_DB,1);
      r.onupgradeneeded=function(){
        var db=r.result;
        if(!db.objectStoreNames.contains(KA_STORE))
          db.createObjectStore(KA_STORE,{keyPath:"w"});
      };
      r.onsuccess=function(){ res(r.result); };
      r.onerror=function(){ rej(r.error); };
    }).catch(function(){ return null; });
    return kaDbP;
  }
  function kaGet(w){
    return kaOpen().then(function(db){
      if(!db) return null;
      return new Promise(function(res){
        try{
          var q=db.transaction(KA_STORE,"readonly").objectStore(KA_STORE).get(w);
          q.onsuccess=function(){ res(q.result||null); };
          q.onerror=function(){ res(null); };
        }catch(e){ res(null); }
      });
    }).catch(function(){ return null; });
  }
  function kaPut(rec){
    return kaOpen().then(function(db){
      if(!db) return false;
      return new Promise(function(res){
        try{
          var t=db.transaction(KA_STORE,"readwrite");
          t.objectStore(KA_STORE).put(rec);
          t.oncomplete=function(){ res(true); };
          t.onerror=function(){ res(false); };
        }catch(e){ res(false); }
      });
    }).catch(function(){ return false; });
  }
  /* Dışarıdan erişim: yedekleme/aktarma için (DHWordPop.analiz.*) */
  function kaAll(){
    return kaOpen().then(function(db){
      if(!db) return [];
      return new Promise(function(res){
        var out=[];
        try{
          var q=db.transaction(KA_STORE,"readonly").objectStore(KA_STORE).openCursor();
          q.onsuccess=function(e){
            var c=e.target.result;
            if(!c) return res(out);
            out.push(c.value); c.continue();
          };
          q.onerror=function(){ res(out); };
        }catch(e){ res(out); }
      });
    }).catch(function(){ return []; });
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
    +".dh-wp-wv-status{font-size:12px;font-weight:700;color:#9fb3d9;min-height:16px;line-height:1.4}"
    /* ---- eş anlamlılar ---- */
    +".dh-wp-syn{display:block;position:relative;background:#0b1830;border:1px solid #1e3a5f;border-radius:11px;padding:9px 11px;margin-bottom:6px;cursor:pointer;text-align:left;width:100%}"
    +".dh-wp-syn:disabled{cursor:default}"
    +".dh-wp-syn.self{border-color:#818cf8;background:#141c3d}"
    +".dh-wp-syn-ust{display:flex;align-items:baseline;gap:8px}"
    +".dh-wp-syn-k{font-size:15px;font-weight:800;color:#e8eef7}"
    +".dh-wp-syn.self .dh-wp-syn-k{color:#a5b4fc}"
    +".dh-wp-syn-tr{font-size:12px;color:#9fb3d9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}"
    +".dh-wp-syn-yuzde{margin-left:auto;font-size:11.5px;font-weight:900;color:#6ee7b7;font-family:monospace;flex:0 0 auto}"
    +".dh-wp-syn-cubuk{height:4px;border-radius:99px;background:#13294d;margin-top:6px;overflow:hidden}"
    +".dh-wp-syn-cubuk i{display:block;height:100%;background:linear-gradient(90deg,#38bdf8,#818cf8);border-radius:99px}"
    +".dh-wp-syn-alt{font-size:10.5px;color:#64748b;margin-top:4px;display:flex;gap:8px;flex-wrap:wrap}"
    +".dh-wp-syn-alt b{color:#94a3b8;font-weight:800}"
    +".dh-wp-syn-not{font-size:11px;color:#64748b;line-height:1.45;margin-top:2px}"
    +".dh-wp-syn-not a{color:#60a5fa}"
    /* ---- Gemini kelime analizi ---- */
    +".dh-wp-gem{background:linear-gradient(180deg,#8b5cf6,#6d28d9);color:#fff}"
    +".dh-wp-syn-grup{margin-bottom:12px}"
    +".dh-wp-syn-grup:last-child{margin-bottom:0}"
    +".dh-wp-syn-gbas{display:flex;align-items:baseline;gap:7px;font-size:12.5px;font-weight:900;color:#c4b5fd;margin:0 0 7px;padding-bottom:5px;border-bottom:1px solid #1e3a5f}"
    +".dh-wp-syn-gno{background:#4c1d95;color:#ddd6fe;border-radius:6px;padding:1px 7px;font-size:11px;flex:0 0 auto}"
    +".dh-wp-syn-gbos{font-size:12px;color:#64748b;padding:2px 0 4px}"
    /* ---- yapıştırma kutusu ---- */
    +".dh-wp-gk{position:fixed;inset:0;z-index:10060;background:rgba(2,6,23,.82);display:flex;align-items:center;justify-content:center;padding:14px}"
    +".dh-wp-gk-card{width:100%;max-width:480px;max-height:92vh;overflow:auto;background:#0d1b32;border:1px solid #7c3aed;border-radius:16px;padding:16px;color:#e8eef7}"
    +".dh-wp-gk-card h4{margin:0 0 4px;font-size:16px;font-weight:900}"
    +".dh-wp-gk-ad{font-size:12px;color:#9fb3d9;line-height:1.55;margin:0 0 11px}"
    +".dh-wp-gk-ad b{color:#c4b5fd}"
    +".dh-wp-gk-row{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}"
    +".dh-wp-gk-row button{flex:1;min-width:126px;border:0;border-radius:10px;padding:11px 8px;font-size:13px;font-weight:800;cursor:pointer}"
    +".dh-wp-gk-copy{background:#1d4ed8;color:#fff}"
    +".dh-wp-gk-open{background:#8b5cf6;color:#fff}"
    +".dh-wp-gk-ta{width:100%;box-sizing:border-box;min-height:110px;background:#071120;color:#e8eef7;border:1px solid #1e3a5f;border-radius:11px;padding:11px;font-size:13px;line-height:1.5;resize:vertical;font-family:monospace}"
    +".dh-wp-gk-ta:focus{outline:2px solid #8b5cf6;outline-offset:1px}"
    +".dh-wp-gk-msg{font-size:12.5px;font-weight:700;min-height:17px;margin:7px 0;line-height:1.45}"
    +".dh-wp-gk-send{background:linear-gradient(180deg,#10b981,#059669);color:#fff}"
    +".dh-wp-gk-close{background:#334155;color:#e8eef7}";
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
     +'<div class="dh-wp-box" id="dhWpSynBox" style="display:none">'
       +'<div class="dh-wp-boxhead">🔁 Aynı anlama gelen kelimeler'
         +'<span class="dh-wp-tags"><span class="dh-wp-tag l" id="dhWpSynKaynak">…</span></span>'
       +'</div>'
       +'<div id="dhWpSynList"></div>'
       +'<div class="dh-wp-syn-not" id="dhWpSynNot"></div>'
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
     +'<button class="dh-wp-full dh-wp-gem" id="dhWpGem">💎 Gemini Kelime Analizi</button>'
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
    document.getElementById("dhWpGem").onclick=function(){ gemAnaliz(w, anlamlar); };
    document.getElementById("dhWpRec").onclick=function(){ tryPronounce(w); };
    wvInit(w);
    fillSynonyms(w);
    fillSentences(w);
  }

  /* ================= 🔁 EŞ ANLAMLILAR =================
     Akış: adayları topla → sıklıkları getir (önbellek → proxy → yedek)
     → çoktan aza sırala → çiz. Ağ beklenmez: liste önce yedek/önbellek
     değerleriyle ANINDA çizilir, canlı Ngram gelince yeniden sıralanır. */

  /* Ngram değerlerini getir. Dönüş: {kelime: oran}
     kaynak: "canli" | "yedek" | "karma" */
  function ngramGetir(kelimeler){
    var cache=ngCacheOku(), simdi=Date.now();
    var sonuc={}, eksik=[];
    kelimeler.forEach(function(k){
      var c=cache[k];
      if(c && (simdi-(c.t||0))<NG_TTL){ if(typeof c.v==="number") sonuc[k]=c.v; }
      else eksik.push(k);
    });

    var proxy=ngProxy();
    if(!eksik.length) return Promise.resolve({deger:sonuc, kaynak:"canli"});
    if(!proxy){
      return loadNgYedek().then(function(y){
        eksik.forEach(function(k){ if(typeof y[k]==="number") sonuc[k]=y[k]; });
        return {deger:sonuc, kaynak: Object.keys(cache).length?"karma":"yedek"};
      });
    }

    /* Ngram uç noktası virgülle birden çok kelime kabul eder — tek istek. */
    var url = proxy + (proxy.indexOf("?")<0?"?":"&") + "content=" +
      encodeURIComponent(eksik.join(",")) +
      "&year_start=2015&year_end=2019&corpus=en-2019&smoothing=3";

    return fetch(url).then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(arr){
        if(!Array.isArray(arr)) throw 0;
        var yeni=ngCacheOku();
        arr.forEach(function(it){
          var ad=String((it&&it.ngram)||"").replace(/_[A-Z]+$/,"").toLowerCase();
          var ts=it&&it.timeseries;
          if(!ad || !Array.isArray(ts) || !ts.length) return;
          var v=Number(ts[ts.length-1])||0;
          sonuc[ad]=v; yeni[ad]={v:v,t:simdi};
        });
        /* Ngram'da hiç geçmeyen kelime cevapta gelmez; 0 olarak
           önbelleğe yaz ki her açılışta tekrar sorulmasın. */
        eksik.forEach(function(k){
          if(!(k in sonuc)){ sonuc[k]=0; yeni[k]={v:0,t:simdi}; }
        });
        ngCacheYaz(yeni);
        return {deger:sonuc, kaynak:"canli"};
      })
      .catch(function(){
        return loadNgYedek().then(function(y){
          eksik.forEach(function(k){ if(typeof y[k]==="number") sonuc[k]=y[k]; });
          return {deger:sonuc, kaynak:"yedek"};
        });
      });
  }

  function ngramYazi(v){
    if(!(v>0)) return "—";
    var yuzde=v*100;
    if(yuzde>=0.01) return yuzde.toFixed(3)+"%";
    if(yuzde>=0.0001) return yuzde.toFixed(5)+"%";
    return yuzde.toExponential(1)+"%";
  }

  function synCiz(host, liste, enBuyuk, kendisi){
    host.innerHTML = liste.map(function(r){
      var oran = enBuyuk>0 ? Math.max(2, Math.round(100*r.v/enBuyuk)) : 0;
      var alt=[];
      alt.push("<b>"+ngramYazi(r.v)+"</b> Ngram");
      if(typeof r.korpus==="number") alt.push("bu uygulamada <b>"+r.korpus+"</b> kez");
      if(r.seviye) alt.push(esc(r.seviye));
      return '<button type="button" class="dh-wp-syn'+(r.k===kendisi?" self":"")+'" data-w="'+esc(r.k)+'"'+(r.k===kendisi?" disabled":"")+'>'
        +'<div class="dh-wp-syn-ust">'
          +'<span class="dh-wp-syn-k">'+esc(r.k)+(r.k===kendisi?" ←":"")+'</span>'
          +'<span class="dh-wp-syn-tr">'+esc(r.tr||"")+'</span>'
          +'<span class="dh-wp-syn-yuzde">'+ngramYazi(r.v)+'</span>'
        +'</div>'
        +'<div class="dh-wp-syn-cubuk"><i style="width:'+oran+'%"></i></div>'
        +'<div class="dh-wp-syn-alt">'+alt.join(" · ")+'</div>'
      +'</button>';
    }).join("");
    host.querySelectorAll(".dh-wp-syn:not(.self)").forEach(function(b){
      b.onclick=function(){
        var w=b.getAttribute("data-w");
        close();
        setTimeout(function(){ global.DHWordPop.lookup(w); }, 60);
      };
    });
  }

  /* ================= 💎 GEMINI KELİME ANALİZİ =================
     Sözlükte bir kelimenin BİRDEN FAZLA anlamı var ("book" → ayırtmak /
     kitap / deftere işlemek) ve bunlar çoğu zaman bambaşka anlamlar.
     Tek bir eş anlamlı listesi bu durumda yanıltıcı: ekranda "ayırtmak"
     yazarken "volume, publication" göstermek öğrencinin kafasını karıştırır.

     Bu düğme, kelimeyi Gemini'ye HER ANLAMI AYRI AYRI analiz ettirir.
     Akış: prompt panoya kopyalanır → Gemini açılır → dönen JSON buradaki
     kutuya yapıştırılır → IndexedDB'ye yazılır → popup anlam anlam gruplu
     liste çizer. Kayıt kalıcı: aynı kelimeye bir daha tıklandığında
     Gemini'ye gitmeye gerek kalmaz, analiz anında gelir.

     Sıralama Gemini'ye bırakılmaz: her grup, elimizdeki Ngram değerlerine
     göre yeniden sıralanır (canlı proxy → önbellek → yedek dosya). Model
     sıklık konusunda yanılabilir, ölçülen değer yanılmaz. */

  /* ── PROMPT ──────────────────────────────────────────────────────
     ÇÖZÜLEN HATA: Gemini sürekli boş cevap veriyordu —
       {"kelime":"global","anlamlar":[]}   ya da   ..."es":[] ...

     SEBEP: Promptun SON satırı, hedef kelimenin adıyla ve "es":[] boş
     dizileriyle kurulmuş bir JSON şablonuydu. Modelin gördüğü son şey
     tam da doldurması istenen cevabın boş hali olunca onu aynen geri
     yazıyordu. Üstüne "eş anlamlısı yoksa boş bırak" kuralı listenin
     başındaydı ve bu davranışı pekiştiriyordu.

     ÇÖZÜM: Örnek artık BAŞKA bir kelime için ve DOLU. Hedef kelimenin
     adı örnekte hiç geçmiyor, yani kopyalanacak bir kalıp yok. Boş
     bırakma kuralı geri plana alındı ve "hepsini boş döndürmek yanlış
     cevaptır" uyarısı eklendi.                                       */
  function gemPrompt(word, anlamlar){
    var temiz=(anlamlar||[]).map(function(m){
      return String(m).replace(/\s*\[[^\]]*\]/g,"").trim();
    }).filter(Boolean);

    var bas, gorev;
    if(temiz.length){
      bas = 'Bu kelimenin uygulamamızdaki Türkçe karşılıkları:\n'
          + temiz.map(function(m,i){ return (i+1)+". "+m; }).join("\n");
      gorev = "GÖREV: Yukarıdaki HER Türkçe anlam için, o anlamda kullanılan "
            + "İngilizce eş anlamlıları yaz. \"tr\" alanına o Türkçe anlamı "
            + "aynen yaz, \"es\" alanına o anlamın eş anlamlılarını.";
    } else {
      bas = "(Bu kelimenin Türkçe karşılıkları elimde yok.)";
      gorev = "GÖREV: Önce bu kelimenin belirgin biçimde farklı 2-4 anlamını "
            + "belirle ve her birini kısa bir Türkçe karşılıkla \"tr\" alanına yaz. "
            + "Sonra her anlam için o anlamda kullanılan İngilizce eş anlamlıları "
            + "\"es\" alanına yaz.";
    }

    return [
      'İngilizce "'+word+'" kelimesini analiz et.',
      "",
      bas,
      "",
      gorev,
      "Her listeyi EN ÇOK KULLANILANDAN EN AZ KULLANILANA doğru sırala",
      "(Google Books Ngram sıklığını esas al).",
      "",
      "KURALLAR",
      "1. Eş anlamlıları o anlama göre ver. Kelimenin başka anlamının eş",
      "   anlamlılarını o gruba KARIŞTIRMA.",
      "2. Yalnızca cümlede yerine konabilecek kelimeler yaz. \"Yakın anlamlı\",",
      "   \"ilgili kavram\", \"üst kavram\" yazma.",
      "3. Sadece sözlük kökü yaz: çoğul, -ed, -ing, -er/-est biçimleri yok.",
      "4. Tek kelimelik eş anlamlılar yaz; deyim/fiil öbeği yazma (\"give up\").",
      "5. Kelimenin kendisini ve farklı yazımını (color/colour) yazma.",
      "6. Öğrencinin gerçekten kullanabileceği yaygın kelimeler yaz; nadir,",
      "   kitabi kelimeler yazma.",
      "7. Her anlam için en fazla 6 kelime.",
      temiz.length ? "8. Anlam sırasını KORU, anlamları birleştirme veya atlama." : "8. Anlamları en yaygından en az yaygına doğru sırala.",
      "9. Bir anlamın gerçekten hiç eş anlamlısı yoksa o anlamın \"es\" listesini",
      "   boş bırak — ama bu bir İSTİSNADIR. Çoğu kelimenin en az bir eş",
      "   anlamlısı vardır; zorlama, uydurma, ama kolayca da pes etme.",
      "",
      "ÇIKTI BİÇİMİ — aşağıdaki örnek BAŞKA bir kelime içindir, yalnızca",
      "biçimi göstermek amaçlıdır:",
      '{"kelime":"book","anlamlar":[{"tr":"ayırtmak","es":["reserve","arrange"]},'
        + '{"tr":"kitap","es":["volume","publication","tome"]},'
        + '{"tr":"deftere işlemek","es":["record","register","log"]}]}',
      "",
      'Şimdi AYNI biçimde, yalnızca "'+word+'" kelimesi için JSON üret.',
      "Örnekteki kelimeleri kopyalama. \"es\" listelerini GERÇEKTEN doldur;",
      "hepsini boş döndürmek yanlış cevaptır.",
      "SADECE JSON yaz — öncesinde ya da sonrasında tek kelime bile olmasın,",
      "markdown kod bloğu kullanma."
    ].join("\n");
  }

  function gemKopyala(t){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(t); return true;
      }
    }catch(e){}
    try{
      var ta=document.createElement("textarea");
      ta.value=t; ta.style.cssText="position:fixed;opacity:0;left:-9999px";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove(); return true;
    }catch(e){ return false; }
  }

  /* Kendi yapıştırma kutusu — gemini-bridge.js her sayfada yüklü değil
     (word-popup 16 sayfada var, köprü 6'sında). Bağımlılık kurmak yerine
     küçük kutuyu burada tutmak daha güvenli. */
  /* bitince(rec): kayıt başarıyla yazıldıktan sonra çağrılır.
     index-app.html'deki React popup'ına enjekte eden addon bunu kullanır
     (bkz. word-gemini-addon.js) — o sayfada dhWpSynBox yoktur. */
  function gemKutu(word, prompt, bitince){
    injectCSS();
    var ov=document.createElement("div"); ov.className="dh-wp-gk no-wordpop";
    ov.innerHTML=
      '<div class="dh-wp-gk-card">'
      +'<h4>💎 '+esc(word)+' — Gemini analizi</h4>'
      +'<p class="dh-wp-gk-ad">1) <b>Kopyala</b> → 2) <b>Gemini\'yi aç</b>, yapıştır ve gönder → '
      +'3) Gemini\'nin JSON cevabını buraya yapıştırıp <b>Kaydet</b>\'e bas.</p>'
      +'<div class="dh-wp-gk-row">'
        +'<button type="button" class="dh-wp-gk-copy" id="dhWpGkCopy">📋 Promptu kopyala</button>'
        +'<button type="button" class="dh-wp-gk-open" id="dhWpGkOpen">💎 Gemini\'yi aç</button>'
      +'</div>'
      +'<textarea class="dh-wp-gk-ta" id="dhWpGkTa" placeholder=\'{"kelime":"...","anlamlar":[...]}\' spellcheck="false"></textarea>'
      +'<div class="dh-wp-gk-msg" id="dhWpGkMsg"></div>'
      +'<div class="dh-wp-gk-row">'
        +'<button type="button" class="dh-wp-gk-send" id="dhWpGkSend">Kaydet</button>'
        +'<button type="button" class="dh-wp-gk-close" id="dhWpGkClose">Kapat</button>'
      +'</div></div>';
    document.body.appendChild(ov);

    var msg=ov.querySelector("#dhWpGkMsg");
    function bilgi(t,renk){ msg.style.color=renk||"#9fb3d9"; msg.textContent=t; }

    if(gemKopyala(prompt)) bilgi("📋 Prompt panoya kopyalandı.","#4ade80");

    ov.querySelector("#dhWpGkCopy").onclick=function(){
      bilgi(gemKopyala(prompt) ? "📋 Kopyalandı." : "Kopyalanamadı, metni elle seç.",
            gemKopyala(prompt) ? "#4ade80" : "#f59e0b");
    };
    ov.querySelector("#dhWpGkOpen").onclick=function(){
      gemKopyala(prompt);
      try{ global.open("https://gemini.google.com/app","_blank","noopener"); }catch(e){}
    };
    ov.querySelector("#dhWpGkClose").onclick=function(){ ov.remove(); };
    ov.addEventListener("click",function(e){ if(e.target===ov) ov.remove(); });
    ov.querySelector("#dhWpGkSend").onclick=function(){
      var ham=ov.querySelector("#dhWpGkTa").value||"";
      var rec;
      try{ rec=gemAyristir(word, ham); }
      catch(err){ bilgi("✗ "+err.message,"#f87171"); return; }
      bilgi("⏳ Kaydediliyor…","#38bdf8");
      kaPut(rec).then(function(ok){
        ov.remove();
        if(!ok) return;
        if(typeof bitince==="function"){ try{ bitince(rec); }catch(e){} return; }
        if(popEl) fillSynonyms(word);      /* popup hâlâ açıksa anında çiz */
      });
    };
    setTimeout(function(){ try{ ov.querySelector("#dhWpGkTa").focus(); }catch(e){} }, 80);
  }

  function gemAyristir(word, ham){
    var t=String(ham||"").trim();
    if(!t) throw new Error("Önce Gemini'nin cevabını yapıştır.");
    t=t.replace(/^```[a-z]*\s*/i,"").replace(/```\s*$/,"").trim();
    var d=null;
    try{ d=JSON.parse(t); }
    catch(e){
      var m=t.match(/\{[\s\S]*\}/);
      if(m){ try{ d=JSON.parse(m[0]); }catch(e2){} }
    }
    if(!d || typeof d!=="object") throw new Error("JSON okunamadı. Cevabın tamamını yapıştırdığından emin ol.");
    var ham2=Array.isArray(d.anlamlar)?d.anlamlar:null;
    if(!ham2) throw new Error("Cevapta \"anlamlar\" listesi yok.");

    var temiz=[];
    ham2.forEach(function(g){
      if(!g) return;
      var tr=String(g.tr||"").trim();
      var es=Array.isArray(g.es)?g.es:[];
      var out=[];
      es.forEach(function(x){
        var k=String(x||"").toLowerCase().trim();
        k=k.replace(/\([^)]*\)/g,"").trim();
        if(!/^[a-z][a-z-]*$/.test(k)) return;      /* öbek/işaretli: at */
        if(k===word) return;                        /* kelimenin kendisi */
        if(out.indexOf(k)<0) out.push(k);
      });
      temiz.push({ tr:tr, es:out.slice(0,6) });
    });
    if(!temiz.length) throw new Error("Cevapta hiç anlam bulunamadı — JSON'un tamamını yapıştırdığından emin ol.");
    /* Hepsi boş gelirse KAYDETME. Boş kayıt "bu kelimenin eş anlamlısı yok"
       demek olur ve popup bir daha hiç sormaz; modelin tembel bir cevabı
       kalıcı bir yanlışa dönüşürdü. */
    var doluVar = temiz.some(function(g){ return g.es && g.es.length; });
    if(!doluVar) throw new Error("Gemini tüm listeleri boş döndürdü. Sohbette \"listeleri doldur, boş bırakma\" deyip tekrar sor, sonra yeni cevabı yapıştır.");
    return { w:word, at:Date.now(), anlamlar:temiz };
  }

  function gemAnaliz(word, anlamlar){
    gemKutu(word, gemPrompt(word, anlamlar));
  }

  /* Gruplu çizim: her anlam kendi başlığı altında, kendi içinde sıklığa
     göre sıralı. Kelimenin kendisi her grupta yer alır ki öğrenci "bu
     anlamda hangisi daha yaygın" sorusunun cevabını görsün. */
  /* GENEL ÇİZİCİ — hem bu dosyanın popup'ı hem de index-app.html'deki
     React popup'ı (word-gemini-addon.js) aynı kodu kullanır. Tek kaynak:
     iki yerde ayrı çizim = iki ayrı davranış demekti. */
  function analizCiz(host, word, rec, bilgiEl){
    if(!host) return Promise.resolve();
    host.innerHTML='<div class="dh-wp-muted">Sıklık değerleri alınıyor…</div>';

    var hepsi=[word];
    (rec.anlamlar||[]).forEach(function(g){
      (g.es||[]).forEach(function(k){ if(hepsi.indexOf(k)<0) hepsi.push(k); });
    });

    return loadDict().then(function(){ return ngramGetir(hepsi); }).then(function(res){
      function satir(k){
        var d=(dict&&dict[k])||{};
        var anl=(d.anlamlar&&d.anlamlar[0])||"";
        return { k:k, v:res.deger[k]||0,
                 tr:String(anl).replace(/\s*\[[^\]]*\]/g,"").trim(),
                 korpus: typeof d.frekans==="number"?d.frekans:null,
                 seviye:d.seviye||"" };
      }
      var html="", gruplar=[];
      (rec.anlamlar||[]).forEach(function(g,i){
        var kelimeler=[word].concat((g.es||[]).filter(function(k){ return k!==word; }));
        var satirlar=kelimeler.map(satir);
        satirlar.sort(function(a,b){ return b.v!==a.v ? b.v-a.v : (a.k<b.k?-1:1); });
        gruplar.push({ satirlar:satirlar, enBuyuk:satirlar.length?satirlar[0].v:0, bos:!(g.es||[]).length });

        html+='<div class="dh-wp-syn-grup">'
            +'<div class="dh-wp-syn-gbas"><span class="dh-wp-syn-gno">'+(i+1)+'</span>'
            +esc(g.tr||"")+'</div>';
        html+= gruplar[i].bos
             ? '<div class="dh-wp-syn-gbos">Bu anlam için eş anlamlı bulunamadı.</div>'
             : '<div class="dh-wp-syn-govde" data-grup="'+i+'"></div>';
        html+='</div>';
      });
      host.innerHTML=html;
      gruplar.forEach(function(g,i){
        if(g.bos) return;
        var kap=host.querySelector('.dh-wp-syn-govde[data-grup="'+i+'"]');
        if(kap) synCiz(kap, g.satirlar, g.enBuyuk, word);
      });

      if(bilgiEl){
        var tarih="";
        try{ tarih=new Date(rec.at||Date.now()).toLocaleDateString("tr-TR"); }catch(e){}
        bilgiEl.innerHTML="Anlam anlam Gemini analizi ("+esc(tarih)+"). Sıralama "
          + (res.kaynak==="canli" ? "Google Books Ngram değerlerine" : "yaklaşık (çevrimdışı) sıklık değerlerine")
          + " göre yapıldı. Yenilemek için 💎 düğmesine tekrar bas.";
      }
      return res;
    });
  }

  function synGrupCiz(word, rec){
    var box=document.getElementById("dhWpSynBox");
    var host=document.getElementById("dhWpSynList");
    var etiket=document.getElementById("dhWpSynKaynak");
    var not=document.getElementById("dhWpSynNot");
    if(!box||!host) return;
    box.style.display="";
    etiket.textContent="💎 Gemini";
    analizCiz(host, word, rec, not);
  }

  function fillSynonyms(word){
    var box=document.getElementById("dhWpSynBox");
    var host=document.getElementById("dhWpSynList");
    var etiket=document.getElementById("dhWpSynKaynak");
    var not=document.getElementById("dhWpSynNot");
    if(!box||!host) return;

    /* ÖNCELİK: Gemini'nin anlam anlam analizi varsa o çizilir. Statik
       synonyms.json tek düz liste verir; analiz daha zengin ve o kelimeye
       özel olduğu için onun önüne geçer. */
    kaGet(word).then(function(rec){
      if(rec && Array.isArray(rec.anlamlar) && rec.anlamlar.length){
        synGrupCiz(word, rec);
        return;
      }
      synDuzCiz(word);
    });
  }

  function synDuzCiz(word){
    var box=document.getElementById("dhWpSynBox");
    var host=document.getElementById("dhWpSynList");
    var etiket=document.getElementById("dhWpSynKaynak");
    var not=document.getElementById("dhWpSynNot");
    if(!box||!host) return;

    loadSyn().then(function(sz){
      var liste=(sz && sz[word]) || [];
      if(!liste.length){
        /* Anahtar VAR ama liste boşsa: bu kelimenin eş anlamlısı olmadığı
           daha önce belirlenmiş demektir (Gemini toplu üretimi boş döndü).
           Her açılışta AI'a yeniden sormanın anlamı yok. */
        if(sz && Object.prototype.hasOwnProperty.call(sz, word)) return;
        synAI(word);
        return;
      }

      var hepsi=[word].concat(liste.filter(function(k){ return k!==word; }));
      box.style.display="";
      host.innerHTML='<div class="dh-wp-muted">Sıklık değerleri alınıyor…</div>';
      etiket.textContent="…";

      /* satır iskeleti — sözlükten Türkçe anlam, seviye, korpus sayısı */
      var satirlar=hepsi.map(function(k){
        var d=(dict&&dict[k])||{};
        var anl=(d.anlamlar&&d.anlamlar[0])||"";
        return { k:k, v:0, tr:String(anl).replace(/\s*\[[^\]]*\]/g,"").trim(),
                 korpus: typeof d.frekans==="number"?d.frekans:null, seviye:d.seviye||"" };
      });

      ngramGetir(hepsi).then(function(res){
        satirlar.forEach(function(r){ r.v=res.deger[r.k]||0; });
        satirlar.sort(function(a,b){
          if(b.v!==a.v) return b.v-a.v;
          return a.k<b.k?-1:1;
        });
        var enBuyuk=satirlar.length?satirlar[0].v:0;
        synCiz(host, satirlar, enBuyuk, word);

        if(res.kaynak==="canli"){
          etiket.textContent="Google Ngram";
          not.innerHTML="Değerler Google Books Ngram (en-2019) kaynaklıdır — "
            +"bir kelimenin tüm kitaplardaki kelimelere oranı.";
        } else {
          etiket.textContent="~ çevrimdışı";
          not.innerHTML="Canlı Ngram alınamadı, yaklaşık değerler gösteriliyor. "
            +"Canlı değerler için Ngram proxy adresini tanımlayın "
            +"(bkz. tools/ngram-proxy.gs).";
        }
      });
    });
  }

  /* Statik dosyada yoksa AI'dan iste; sonuç kalıcı önbelleğe yazılır ki
     aynı kelime için bir daha sorulmasın. */
  /* ── AI YEDEĞİ ───────────────────────────────────────────────────
     Statik synonyms.json'da olmayan kelimeler için DHProviders'a sorar.

     ÇÖZÜLEN HATA: Listede TÜRKÇE ve harfleri eksik kelimeler çıkıyordu —
       allocation → atama, ayrma, dalm, datm, paylatrma, tahsis
     İki ayrı kusur üst üste binmişti:
       1) Model Türkçe cevap veriyordu (prompt Türkçe yazılmıştı ve
          "İngilizce yaz" talimatı yeterince baskın değildi):
          ayırma, dağılım, dağıtım, paylaştırma...
       2) Temizleyici geçersiz karakteri ELEMEK yerine SİLİYORDU:
             x.replace(/[^a-z'-]/g,"")
          "ayırma" → "ayrma", "dağılım" → "dalm". Yani hatalı kelime
          atılmıyor, tanınmaz hale getirilip listeye konuyordu.

     ÇÖZÜM
       · Kelime ASCII a-z kalıbına uymuyorsa ATILIR (kırpılmaz).
       · Sonuç, uygulamanın kendi İngilizce sözlüğüyle doğrulanır: sözlükte
         olmayan aday kabul edilmez. "atama"/"tahsis" gibi ASCII yazılan
         Türkçe kelimeleri de bu eler. Yan faydası: gösterilen her eş
         anlamlının Türkçe karşılığı ve seviyesi de vardır.
       · Prompt İngilizce yazıldı ve örneklendi.                        */
  function synAI(word){
    var box=document.getElementById("dhWpSynBox");
    if(!box) return;
    var AK="dh-syn-ai-v1", depo={};
    try{ depo=JSON.parse(localStorage.getItem(AK)||"{}")||{}; }catch(e){}

    function goster(list){
      if(!list.length){ box.style.display="none"; return; }
      if(!syn) syn={};
      syn[word]=list;
      synDuzCiz(word);
      /* synDuzCiz etiketi Ngram kaynağıyla eziyor; AI olduğunu kaybetme */
      setTimeout(function(){
        var e=document.getElementById("dhWpSynKaynak");
        if(e) e.textContent="AI";
      },0);
    }

    if(Array.isArray(depo[word])){
      /* Eski sürümün ürettiği bozuk kayıtlar önbellekte kalmış olabilir;
         doğrulamadan geçmeyenleri at ve önbelleği tazele. */
      var suzulmus=depo[word].filter(gecerliEsAnlamli(word));
      if(suzulmus.length!==depo[word].length){
        depo[word]=suzulmus;
        try{ localStorage.setItem(AK, JSON.stringify(depo)); }catch(e){}
      }
      if(!suzulmus.length) return;
      goster(suzulmus);
      return;
    }
    if(!(global.DHProviders && DHProviders.hasAnyKey && DHProviders.hasAnyKey())) return;

    box.style.display="";
    document.getElementById("dhWpSynList").innerHTML=
      '<div class="dh-wp-muted">Eş anlamlılar aranıyor…</div>';
    document.getElementById("dhWpSynKaynak").textContent="AI";

    var sys="You are an English thesaurus. Reply with ENGLISH WORDS ONLY, "
      +"as a comma-separated list, at most 6 items. Never answer in Turkish "
      +"or any other language. Never translate the word. Give dictionary base "
      +"forms only (no plurals, no -ed/-ing). Do not repeat the given word. "
      +"Do not write phrases or explanations. If there is no true synonym, "
      +"reply with nothing.\n"
      +"Example — input: allocation → output: distribution, assignment, quota\n"
      +"Example — input: abbreviation → output:";
    DHProviders.chat([{role:"system",content:sys},{role:"user",content:word}],
                     {temperature:0.2,max_tokens:60})
      .then(function(txt){
        var list=String(txt||"").toLowerCase().split(/[,\n]/)
          .map(function(x){ return x.trim(); })
          .filter(gecerliEsAnlamli(word))
          .slice(0,6);
        /* tekrarları at */
        var tekil=[]; list.forEach(function(x){ if(tekil.indexOf(x)<0) tekil.push(x); });
        depo[word]=tekil;
        try{ localStorage.setItem(AK, JSON.stringify(depo)); }catch(e){}
        goster(tekil);
      })
      .catch(function(){ box.style.display="none"; });
  }

  /* Aday gerçekten İngilizce bir kelime mi? Sözlükte varsa evet.
     (dict bu noktada yüklüdür; popup açılışı loadDict'ten sonra olur.) */
  function gecerliEsAnlamli(word){
    return function(k){
      if(!k || k===word) return false;
      if(!/^[a-z][a-z-]{1,}$/.test(k)) return false;   // ASCII değilse AT, kırpma
      if(dict && !dict[k]) return false;               // sözlükte yoksa İngilizce sayma
      return true;
    };
  }

  function aiExplain(word, anlamlar){
    var out=document.getElementById("dhWpAIOut"), btn=document.getElementById("dhWpAI");
    if(!global.DHProviders){
      out.innerHTML='<div class="dh-wp-ai-out">AI bağlantısı hazırlanıyor…</div>';
      var old=document.querySelector('script[data-dh-word-ai-provider]');
      if(old){old.addEventListener("load",function(){aiExplain(word,anlamlar);},{once:true});return;}
      var ps=document.createElement("script");ps.src="./ai-providers.js?v=3";ps.dataset.dhWordAiProvider="1";
      ps.onload=function(){aiExplain(word,anlamlar);};
      ps.onerror=function(){out.innerHTML='<div class="dh-wp-ai-out">AI bağlantısı yüklenemedi. İnternet bağlantını kontrol et.</div>';};
      document.head.appendChild(ps);
      return;
    }
    var cacheKey="dh-word-package-v2", cache={};
    try{ cache=JSON.parse(localStorage.getItem(cacheKey)||"{}")||{}; }catch(e){}
    var ck=String(word||"").toLowerCase(), old=cache[ck];
    function draw(p){
      var lines=[];
      if(p.tanim) lines.push("📖 "+p.tanim);
      if(p.kullanim) lines.push("🧭 "+p.kullanim);
      if(p.telaffuz) lines.push("🔊 "+p.telaffuz);
      if(Array.isArray(p.kaliplar)&&p.kaliplar.length) lines.push("🧩 Kalıplar: "+p.kaliplar.join(", "));
      if(Array.isArray(p.esAnlamlilar)&&p.esAnlamlilar.length) lines.push("🔁 Eş anlamlılar: "+p.esAnlamlilar.join(", "));
      if(Array.isArray(p.ornekler)) p.ornekler.forEach(function(x){ if(x&&x.en) lines.push("• "+x.en+(x.tr?" — "+x.tr:"")); });
      if(p.ipucu) lines.push("💡 "+p.ipucu);
      out.innerHTML='<div class="dh-wp-ai-out" style="white-space:pre-line">'+esc(lines.join("\n"))+'</div>';
    }
    if(old&&old.at>Date.now()-30*86400000&&old.data){ draw(old.data); return; }
    btn.textContent="⏳ Kelime paketi hazırlanıyor…"; btn.disabled=true;
    var sys="Sen Türk öğrenciye İngilizce öğreten bir öğretmensin. Kelimeyi tek pakette analiz et. Yalnız geçerli JSON döndür: {\"tanim\":\"kısa Türkçe tanım\",\"kullanim\":\"ne zaman/nasıl kullanılır\",\"telaffuz\":\"Türkçe telaffuz ipucu\",\"esAnlamlilar\":[\"English word\"],\"kaliplar\":[\"English collocation\"],\"ornekler\":[{\"en\":\"English sentence\",\"tr\":\"Türkçesi\"}],\"ipucu\":\"akılda tutma ipucu\"}. En fazla 6 eş anlamlı, 5 kalıp ve A1/B1/B2 düzeylerinde 3 örnek ver. Eş anlamlılar yalnız İngilizce temel biçimde olsun.";
    var usr="Kelime: \""+word+"\"\nYerel sözlük anlamları: "+anlamlar.join(", ");
    DHProviders.chat([{role:"system",content:sys},{role:"user",content:usr}],{temperature:0.4,max_tokens:900,json:true,title:"💎 "+word+" kelime paketini hazırla"})
      .then(function(txt){
        var t=String(txt||"").replace(/```json|```/gi,"").trim(), m=t.match(/\{[\s\S]*\}/), p=m?JSON.parse(m[0]):null;
        if(!p||!p.tanim) throw new Error("Kelime paketi okunamadı");
        cache[ck]={at:Date.now(),data:p};
        try{ localStorage.setItem(cacheKey,JSON.stringify(cache)); }catch(e){}
        if(Array.isArray(p.esAnlamlilar)){
          var synCache={}; try{synCache=JSON.parse(localStorage.getItem("dh-syn-ai-v1")||"{}")||{};}catch(e){}
          synCache[ck]=p.esAnlamlilar.map(function(x){return String(x).toLowerCase();}).filter(gecerliEsAnlamli(ck)).slice(0,6);
          try{localStorage.setItem("dh-syn-ai-v1",JSON.stringify(synCache));}catch(e){}
        }
        draw(p);
      })
      .catch(function(err){ out.innerHTML='<div class="dh-wp-ai-out">'+((err&&err.code==="abort")?'İşlem kapatıldı. İstersen yeniden deneyebilirsin.':'Açıklama alınamadı. AI tercihini veya bağlantını kontrol et.')+'</div>'; })
      .then(function(){ btn.textContent="🎓 Kelime Paketi (AI)"; btn.disabled=false; });
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
    /* AI tanımlarını 30 gün cihazda tut: aynı nadir kelime için yeniden
       sağlayıcı çağrısı yapılmaz. Anahtar veya içerik buluta gönderilmez. */
    var aiCacheKey="dh-word-ai-cache-v1", aiCache={};
    try{ aiCache=JSON.parse(localStorage.getItem(aiCacheKey)||"{}")||{}; }catch(e){}
    var cached=aiCache[String(word||"").toLowerCase()];
    if(cached && cached.t>Date.now()-30*86400000 && Array.isArray(cached.v)){
      updateMeanings(cached.v); return;
    }
    /* İKİ AYRI DURUM — eskiden ikisi de "anahtar ekle" diyordu ve
       anahtarı olan kullanıcı neden çalışmadığını anlayamıyordu.
       word-popup.js 16 sayfada yüklüyken ai-providers.js bunların
       yalnızca 11'inde yüklüydü. */
    if(!global.DHProviders){
      updateMeanings(["📕 Bu kelime yerel sözlükte yok.",
        "⚠ Bu sayfada AI sağlayıcı betiği (ai-providers.js) yüklü değil — anahtarın kayıtlı olsa bile buradan kullanılamaz. 💎 Gemini Kelime Analizi düğmesi yine de çalışır."]);
      return;
    }
    if(!(DHProviders.hasAnyKey && DHProviders.hasAnyKey())){
      updateMeanings(["📕 Bu kelime yerel sözlükte yok. AI açıklaması için öğretmen sayfasından bir API anahtarı ekle (Groq, Cerebras veya Gemini)."]);
      return;
    }
    var sys="Sen İngilizce-Türkçe sözlük gibi çalışıyorsun. Verilen İngilizce kelime bir çekim ekiyle gelmiş olabilir (örn. çoğul, geçmiş zaman, -ing) — önce sözlük kökünü bul, sonra o kökün 1-3 kısa Türkçe karşılığını SADECE virgülle ayrılmış liste halinde ver. Başka hiçbir açıklama, cümle veya noktalama ekleme.";
    var usr="Kelime: \""+word+"\"";
    DHProviders.chat([{role:"system",content:sys},{role:"user",content:usr}],{temperature:0.3,max_tokens:60})
      .then(function(txt){
        var list=String(txt||"").split(",").map(function(s){ return s.trim(); }).filter(Boolean);
        list=list.length?list:["Anlam bulunamadı."];
        updateMeanings(list);
        try{
          aiCache[String(word||"").toLowerCase()]={t:Date.now(),v:list};
          var keys=Object.keys(aiCache); if(keys.length>500) keys.sort(function(a,b){return aiCache[b].t-aiCache[a].t;}).slice(500).forEach(function(k){delete aiCache[k];});
          localStorage.setItem(aiCacheKey,JSON.stringify(aiCache));
        }catch(e){}
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
    /* Tempo: tek kelimede ±0.15s serbest, sonrası yumuşak ceza */
    var excess=Math.max(0,Math.abs(dC-dU)-0.15);
    var tempo=Math.max(0,Math.round(100-excess/Math.max(dC,0.2)*80));
    /* Şekil: normalize zarfların korelasyonu; r=1→100, r=0→50 */
    var r=Math.max(-1,Math.min(1,wvPearson(nC,rU)));
    var shape=Math.round(((r+1)/2)*100);
    /* Vurgu: zirve konumu, %12 kayma serbest */
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
    else{ coachAudio(); userAudio(); } /* düet: birebir senkron */
  }
  /* ================= /SES DALGASI ================= */

  function onClick(e){
    if(!enabled || popEl) return;
    var t=e.target; if(!t) return;
    if(t.closest && t.closest("input,textarea,button,a,select,.no-wordpop")) return;
    /* ?ift t?klama taray?c?da kelimeyi se?er; bu se?im a??lmay? engellememeli. */
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
    /* 💎 kelime analizi deposu — yedekleme/aktarma için */
    /* 💎 kelime analizi — hem bu popup hem de index-app.html'deki React
       popup'ı (word-gemini-addon.js) bu API'yi kullanır. */
    analiz:{
      oku:kaGet, yaz:kaPut, tumu:kaAll,
      prompt:gemPrompt, ayristir:gemAyristir,
      /* Kutuyu aç: kopyala → Gemini'yi aç → JSON yapıştır → kaydet.
         bitince(rec) kayıttan sonra çağrılır. */
      iste:function(word, anlamlar, bitince){ gemKutu(word, gemPrompt(word, anlamlar), bitince); },
      ciz:analizCiz,          /* (host, kelime, kayit, bilgiEl) */
      ngram:ngramGetir,
      sozluk:loadDict,
      stil:injectCSS
    },
    lookup:function(w){ loadDict().then(function(){ var e=findEntry(cleanWord(w)); if(e) open(e); else defineWithAI(cleanWord(w)); }); },
    enable:function(){ enabled=true; }, disable:function(){ enabled=false; }, close:close
  };
  function baglaTiklama(){
    if(document.__dhWpBound) return;
    document.__dhWpBound=true;
    document.addEventListener("dblclick",onClick,true);
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",baglaTiklama,{once:true});
  else baglaTiklama();
  /* Klasik ve React word-popup için ortak çalışma listesi. */
  (function(){if(document.querySelector('script[data-dh-word-study-list]'))return;var s=document.createElement("script");s.src="./word-learning-list.js?v=1";s.dataset.dhWordStudyList="1";document.head.appendChild(s);})();
})(window);
