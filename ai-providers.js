/* ai-providers.js — ÇOK SAĞLAYICILI AI KATMANI (aşamalı/fallback)
   Dil Harita — Gemini → Groq → Cerebras sırasıyla otomatik dener.
   NVIDIA'nın genel API'si GitHub Pages tarayıcı çağrılarına CORS izni
   vermediği için NVIDIA güvenli kopyala-yapıştır köprüsüyle kullanılır.

   Anahtarlar (localStorage, her biri JSON dizi):
     nvidiaApiKeys    — NVIDIA NIM (build.nvidia.com)
     groqApiKeys      — Groq (console.groq.com)
     cerebrasApiKeys  — Cerebras (cloud.cerebras.ai)
     geminiApiKeys    — Google Gemini (aistudio.google.com)

   Mantık: Bir sağlayıcı anahtarı varsa onunla dene; başarısız/limit olursa
   sıradaki sağlayıcıya geç. Hepsi tükenirse hata döner (çağıran kurallı moda düşer).

   API:
     DHProviders.chat(messages, {temperature, max_tokens, json})
        → Promise<string>  (modelin metin yanıtı)
     DHProviders.hasAnyKey()  → bool
     DHProviders.activeProviders() → ["groq","cerebras",...]
*/
(function(global){
  "use strict";
  if(global.DHProviders) return;

  // Sağlayıcı tanımları — sıra = öncelik (Groq önce)
  // model: VARSAYILAN model (kullanıcı seçmezse). models: bilinen güncel liste (canlı çekme
  // başarısız olursa kullanılır). modelsUrl: canlı model listesi endpoint'i (varsa).
  var PROVIDERS = [
    {
      id:"gemini", keyStore:"geminiApiKeys",
      url:"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
      model:"gemini-3.6-flash",
      models:["gemini-3.6-flash","gemini-3.5-flash","gemini-3.5-flash-lite"],
      modelsUrl:"https://generativelanguage.googleapis.com/v1beta/models",
      modelsAuth:"query", kind:"gemini"
    },
    {
      id:"nvidia",
      keyStore:"nvidiaApiKeys",
      url:"https://integrate.api.nvidia.com/v1/chat/completions",
      model:"nvidia/nemotron-3-super-120b-a12b",
      fallbackModels:["nvidia/nemotron-3.5-lightning-30b-a3b","openai/gpt-oss-120b"],
      models:["nvidia/nemotron-3-super-120b-a12b","nvidia/nemotron-3.5-lightning-30b-a3b","openai/gpt-oss-120b"],
      modelsUrl:"https://integrate.api.nvidia.com/v1/models",
      modelsAuth:true,
      kind:"openai",
      manualOnly:true
    },
    {
      id:"groq",
      keyStore:"groqApiKeys",
      url:"https://api.groq.com/openai/v1/chat/completions",
      model:"openai/gpt-oss-120b",
      fallbackModels:["openai/gpt-oss-20b","llama-3.1-8b-instant"],
      models:["openai/gpt-oss-120b","openai/gpt-oss-20b","llama-3.1-8b-instant","llama-3.3-70b-versatile"],
      modelsUrl:"https://api.groq.com/openai/v1/models",   // anahtar gerekli
      modelsAuth:true,
      kind:"openai"
    },
    {
      id:"cerebras",
      keyStore:"cerebrasApiKeys",
      url:"https://api.cerebras.ai/v1/chat/completions",
      model:"gpt-oss-120b",
      models:["gpt-oss-120b","zai-glm-4.7"],
      modelsUrl:"https://api.cerebras.ai/public/v1/models",  // anahtarsız, public
      modelsAuth:false,
      kind:"openai"
    }
  ];

  var PROVIDER_LABELS={gemini:"Gemini",groq:"Groq",cerebras:"Cerebras",nvidia:"NVIDIA NIM","gemini-web":"Gemini Web"};
  function sourceInfo(provider,model,extra){
    var info={provider:provider,label:PROVIDER_LABELS[provider]||provider,model:model||"Model belirtilmedi",at:Date.now(),cached:false};
    if(extra) Object.keys(extra).forEach(function(k){info[k]=extra[k];});
    return info;
  }
  function showSource(info,cached){
    info=info||sourceInfo("unknown","Eski kayıtta model bilgisi yok");
    if(cached) info=Object.assign({},info,{cached:true});
    global.DHProviders.lastResponseInfo=info;
    try{localStorage.setItem("dh-last-ai-source-v1",JSON.stringify(info));}catch(e){}
    try{global.dispatchEvent(new CustomEvent("dh-ai-source",{detail:info}));}catch(e){}
    if(!global.document||!document.body)return info;
    var el=document.getElementById("dh-ai-source-badge");
    if(!el){
      el=document.createElement("div");el.id="dh-ai-source-badge";
      el.style.cssText="position:fixed;right:12px;top:12px;z-index:2147483000;max-width:min(88vw,430px);padding:9px 12px;border:1px solid #38bdf8;border-radius:12px;background:#0b1930;color:#e5f3ff;box-shadow:0 8px 28px #0008;font:700 12px/1.35 Nunito,system-ui,sans-serif;cursor:pointer";
      el.title="Kapatmak için dokun";el.onclick=function(){el.remove();};document.body.appendChild(el);
    }
    el.textContent="🤖 AI kaynağı: "+(info.label||info.provider)+" · "+(info.model||"Model belirtilmedi")+(info.cached?" · önbellekten":"");
    return info;
  }

  // Kullanıcının seçtiği model (yoksa varsayılan)
  function modelOf(p){
    try{
      var m = localStorage.getItem("dh-model-"+p.id);
      /* Eski cihaz ayarlarında kalmış erişilemeyen model adlarını kendiliğinden taşı. */
      if(p.id==="nvidia" && (m==="meta/llama-3.3-70b-instruct" || /^nvidia\/llama-3\.3-nemotron-super-49b/.test(m||""))) m=p.model;
      if(p.id==="groq" && m==="llama-3.3-70b-versatile") m="openai/gpt-oss-120b";
      if(p.id==="gemini" && (m==="gemini-2.5-flash" || m==="gemini-2.5-flash-lite")) m=p.model;
      if(m && m.trim()) return m.trim();
    }catch(e){}
    return p.model;
  }

  function keysOf(store){
    try{
      var all = (JSON.parse(localStorage.getItem(store)||"[]")||[]).filter(Boolean);
      var off = disabledSet();
      return all.filter(function(k){ return !off[k]; });  // pasif anahtarları atla
    }catch(e){ return []; }
  }
  // pasif (devre dışı) anahtarlar — silinmez, sadece kullanılmaz
  function disabledSet(){
    try{
      var arr = JSON.parse(localStorage.getItem("dh-disabled-keys")||"[]")||[];
      var m={}; arr.forEach(function(k){ m[k]=1; }); return m;
    }catch(e){ return {}; }
  }
  function disableBrokenKey(key){
    if(!key)return;
    try{var arr=JSON.parse(localStorage.getItem("dh-disabled-keys")||"[]")||[];if(arr.indexOf(key)<0){arr.push(key);localStorage.setItem("dh-disabled-keys",JSON.stringify(arr));}}catch(e){}
  }
  function realHasAnyKey(){
    return PROVIDERS.some(function(p){ return keysOf(p.keyStore).length>0; });
  }
  function aiMode(){
    try{
      var p=JSON.parse(localStorage.getItem("dh-profile-v1")||"{}")||{};
      if(p.aiYontemi==="api"||p.aiYontemi==="gemini") return p.aiYontemi;
    }catch(e){}
    /* Eski kullaniciyi bozma: kayitli anahtari varsa API, yoksa anahtarsiz
       Gemini web koprusu. Profil secimi yapilinca bu yedek devreden cikar. */
    return realHasAnyKey()?"api":"gemini";
  }
  function hasAnyKey(){
    return aiMode()==="gemini" || realHasAnyKey();
  }
  function activeProviders(){
    if(aiMode()==="gemini") return ["gemini-web"];
    return PROVIDERS.filter(function(p){ return keysOf(p.keyStore).length>0; }).map(function(p){ return p.id; });
  }

  function promptOf(messages,opts){
    var lines=["Aşağıdaki görevi eksiksiz uygula. Yalnız istenen yanıt biçimini döndür."];
    (messages||[]).forEach(function(m){
      var role=m&&m.role==="system"?"SİSTEM":m&&m.role==="assistant"?"ÖNCEKİ ASİSTAN":"KULLANICI";
      lines.push("\n["+role+"]\n"+String(m&&m.content||""));
    });
    if(opts&&opts.json) lines.push("\nYanıtı geçerli JSON olarak ver; markdown kod bloğu kullanma.");
    return lines.join("\n");
  }
  function ensureGeminiBridge(){
    if(global.DHGemini&&DHGemini.ask) return Promise.resolve(global.DHGemini);
    return new Promise(function(resolve,reject){
      var old=document.querySelector('script[data-dh-gemini-bridge]');
      if(old){old.addEventListener("load",function(){resolve(global.DHGemini);},{once:true});old.addEventListener("error",reject,{once:true});return;}
      var s=document.createElement("script");s.src="./gemini-bridge.js?v=12";s.dataset.dhGeminiBridge="1";
      s.onload=function(){global.DHGemini?resolve(global.DHGemini):reject({code:"bridge"});};s.onerror=function(){reject({code:"bridge"});};document.head.appendChild(s);
    });
  }
  function ensureResponseCache(){
    if(global.DHAIResponseCache) return Promise.resolve(global.DHAIResponseCache);
    return new Promise(function(resolve,reject){
      var old=document.querySelector('script[data-dh-ai-cache]');
      if(old){old.addEventListener("load",function(){resolve(global.DHAIResponseCache);},{once:true});old.addEventListener("error",reject,{once:true});return;}
      var s=document.createElement("script");s.src="./ai-response-cache.js?v=2";s.dataset.dhAiCache="1";
      s.onload=function(){resolve(global.DHAIResponseCache);};s.onerror=reject;document.head.appendChild(s);
    });
  }
  function chatViaGemini(messages,opts){
    if(opts&&opts.signal&&opts.signal.aborted) return Promise.reject({code:"abort"});
    return ensureGeminiBridge().then(function(g){
      return new Promise(function(resolve,reject){
        var settled=false;
        var handle=g.ask({
          title:(opts&&opts.title)||"💎 Gemini ile devam et",
          hint:"Gemini yanıtının tamamını buraya yapıştır…",
          prompt:promptOf(messages,opts),
          parse:g.parsers.text,
          onResult:function(value){settled=true;showSource(sourceInfo("gemini-web","Gemini web arayüzünde kullanıcı tarafından seçilen model"));resolve(String(value||""));},
          onCancel:function(){if(!settled)reject({code:"abort"});}
        });
        if(opts&&opts.signal) opts.signal.addEventListener("abort",function(){try{handle&&handle.close&&handle.close();}catch(e){}if(!settled)reject({code:"abort"});},{once:true});
      });
    });
  }
  function chatViaNvidia(messages,opts){
    if(opts&&opts.signal&&opts.signal.aborted) return Promise.reject({code:"abort"});
    return ensureGeminiBridge().then(function(g){
      return new Promise(function(resolve,reject){
        var settled=false;
        var handle=g.ask({providerName:"NVIDIA Build",openUrl:"https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b/playground",
          title:(opts&&opts.title)||"🟢 NVIDIA ile devam et",hint:"NVIDIA yanıtının tamamını buraya yapıştır…",
          prompt:promptOf(messages,opts),parse:g.parsers.text,
          onResult:function(value){settled=true;showSource(sourceInfo("nvidia","nvidia/nemotron-3-super-120b-a12b",{manual:true}));resolve(String(value||""));},
          onCancel:function(){if(!settled)reject({code:"abort"});}});
        if(opts&&opts.signal) opts.signal.addEventListener("abort",function(){try{handle&&handle.close&&handle.close();}catch(e){}if(!settled)reject({code:"abort"});},{once:true});
      });
    });
  }

  // --- OpenAI-uyumlu çağrı (Groq, Cerebras) ---
  function callOpenAI(p, key, messages, opts, modelOverride){
    var body = {
      model: modelOverride || modelOf(p),
      messages: messages,
      temperature: (opts.temperature!=null?opts.temperature:0.3),
      max_tokens: (opts.max_tokens||800)
    };
    return fetch(p.url, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+key },
      signal:opts.signal,
      body: JSON.stringify(body)
    }).then(function(res){
      if(res.status===429) throw {code:"rate", provider:p.id};
      if(res.status===401||res.status===403) throw {code:"bad-key", provider:p.id};
      if(!res.ok){
        // hata gövdesini oku (model adı yanlışsa Cerebras 400 + açıklama döner)
        return res.text().then(function(t){
          try{ console.warn("["+p.id+"] HTTP "+res.status+": "+t.slice(0,300)); }catch(e){}
          throw {code:"http", provider:p.id, status:res.status, detail:t};
        });
      }
      return res.json();
    }, function(networkErr){
      if(networkErr && networkErr.name==="AbortError") throw {code:"abort", provider:p.id};
      // fetch reddedildi → CORS veya ağ hatası
      try{ console.warn("["+p.id+"] ağ/CORS hatası:", networkErr && networkErr.message); }catch(e){}
      throw {code:"network", provider:p.id};
    }).then(function(d){
      var txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if(txt==null) throw {code:"empty", provider:p.id};
      return String(txt);
    });
  }

  // --- Gemini çağrısı (farklı format) ---
  function callGemini(p, key, messages, opts){
    // OpenAI mesajlarını Gemini formatına çevir
    var sys = "";
    var contents = [];
    messages.forEach(function(m){
      if(m.role==="system"){ sys += (sys?"\n":"")+m.content; }
      else { contents.push({ role: (m.role==="assistant"?"model":"user"), parts:[{text:m.content}] }); }
    });
    // sistem mesajını ilk user mesajına ekle (Gemini systemInstruction da destekler)
    var bodyObj = {
      contents: contents.length?contents:[{role:"user",parts:[{text:sys||"Merhaba"}]}],
      generationConfig: {
        temperature: (opts.temperature!=null?opts.temperature:0.3),
        maxOutputTokens: (opts.max_tokens||800)
      }
    };
    /* JSON isteyen ekranlarda Gemini'nin Markdown çiti veya yarım biçimli
       nesne döndürmesini önle. Bu ayar yalnız opts.json çağrılarını etkiler. */
    if(opts.json) bodyObj.generationConfig.responseMimeType = "application/json";
    if(sys) bodyObj.systemInstruction = { parts:[{text:sys}] };
    var endpoint = p.url.replace("{MODEL}", modelOf(p));
    var url = endpoint + "?key=" + encodeURIComponent(key);
    return fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      signal:opts.signal,
      body: JSON.stringify(bodyObj)
    }).then(function(res){
      if(res.status===429) throw {code:"rate", provider:p.id};
      if(res.status===400||res.status===403) throw {code:"bad-key", provider:p.id};
      if(!res.ok) throw {code:"http", provider:p.id, status:res.status};
      return res.json();
    },function(networkErr){
      if(networkErr && networkErr.name==="AbortError") throw {code:"abort",provider:p.id};
      throw {code:"network",provider:p.id};
    }).then(function(d){
      var txt = d && d.candidates && d.candidates[0] && d.candidates[0].content
        && d.candidates[0].content.parts && d.candidates[0].content.parts[0] && d.candidates[0].content.parts[0].text;
      if(txt==null) throw {code:"empty", provider:p.id};
      return String(txt);
    });
  }

  /* Herkese açık bir YouTube videosunu Gemini'nin ses + görüntü anlayışına
     doğrudan verir. Normal chat sağlayıcılarına düşmez; video girdisini
     yalnız Gemini desteklediği için Gemini anahtarlarını sırayla dener. */
  function callGeminiVideo(p,key,videoUrl,prompt,opts){
    opts=opts||{};
    var bodyObj={
      contents:[{role:"user",parts:[
        {fileData:{fileUri:videoUrl,mimeType:"video/*"}},
        {text:String(prompt||"")}
      ]}],
      generationConfig:{
        temperature:(opts.temperature!=null?opts.temperature:.25),
        maxOutputTokens:(opts.max_tokens||3200),
        responseMimeType:"application/json"
      }
    };
    var endpoint=p.url.replace("{MODEL}",modelOf(p));
    return fetch(endpoint+"?key="+encodeURIComponent(key),{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      signal:opts.signal,
      body:JSON.stringify(bodyObj)
    }).then(function(res){
      if(res.status===429) throw {code:"rate",provider:p.id};
      if(res.status===401||res.status===403) throw {code:"bad-key",provider:p.id};
      if(!res.ok)return res.text().then(function(t){throw {code:"http",provider:p.id,status:res.status,detail:t};});
      return res.json();
    },function(err){
      if(err&&err.name==="AbortError")throw {code:"abort",provider:p.id};
      throw {code:"network",provider:p.id};
    }).then(function(d){
      var parts=d&&d.candidates&&d.candidates[0]&&d.candidates[0].content&&d.candidates[0].content.parts;
      var txt=Array.isArray(parts)?parts.map(function(x){return x&&x.text||"";}).join(""):"";
      if(!txt)throw {code:"empty",provider:p.id};
      return txt;
    });
  }

  function youtubeStudy(videoUrl,prompt,opts){
    var p=PROVIDERS.filter(function(x){return x.id==="gemini";})[0];
    var keys=p?keysOf(p.keyStore):[],i=0;
    if(!p||!keys.length)return Promise.reject({code:"no-gemini-key",provider:"gemini"});
    function next(){
      if(i>=keys.length)return Promise.reject({code:"all-keys-failed",provider:"gemini"});
      var key=keys[i++];
      return callGeminiVideo(p,key,videoUrl,prompt,opts).then(function(text){
        showSource(sourceInfo("gemini",modelOf(p)));
        return text;
      }).catch(function(err){
        if(err&&err.code==="abort")throw err;
        if(err&&err.code==="bad-key")disableBrokenKey(key);
        if(err&&(err.code==="bad-key"||err.code==="rate"))return next();
        throw err;
      });
    }
    return next();
  }

  function callProvider(p, messages, opts){
    var keys = keysOf(p.keyStore);
    if(!keys.length) return Promise.reject({code:"no-key", provider:p.id});
    // o sağlayıcının anahtarlarını sırayla dene (biri bozuksa diğeri)
    var i = 0;
    function tryKey(){
      if(i>=keys.length) return Promise.reject({code:"all-keys-failed", provider:p.id});
      var key = keys[i++];
      if(p.kind==="gemini") return callGemini(p,key,messages,opts).then(function(text){return {text:text,model:modelOf(p)};}).catch(function(err){
        if(err && err.code==="abort") throw err;
        if(err&&err.code==="bad-key")disableBrokenKey(key);
        if(err && (err.code==="bad-key" || err.code==="rate")) return tryKey();
        throw err;
      });
      var models=[modelOf(p)].concat(p.fallbackModels||[]).filter(function(m,n,a){return m&&a.indexOf(m)===n;});
      var mi=0;
      function tryModel(){
        var chosen=models[mi++];
        return callOpenAI(p,key,messages,opts,chosen).then(function(text){return {text:text,model:chosen};}).catch(function(err){
          if(err&&err.code==="abort") throw err;
          /* Geçersiz anahtar model değiştirerek düzelmez. Limit/model/HTTP
             hatasında ise aynı NVIDIA anahtarıyla yedek modeli dene. */
          if(err&&err.code==="bad-key"){disableBrokenKey(key);return tryKey();}
          if(mi<models.length && err && (err.code==="rate"||err.code==="http"||err.code==="empty")) return tryModel();
          if(err&&err.code==="rate") return tryKey();
          throw err;
        });
      }
      return tryModel();
    }
    return tryKey();
  }

  // --- ANA FONKSİYON: aşamalı dene ---
  function chat(messages, opts){
    opts = opts || {};
    if(opts.cacheType && !opts.__cacheBypass){
      return ensureResponseCache().then(function(cache){
        var input=opts.cacheInput!=null?opts.cacheInput:(messages||[]).filter(function(m){return m&&m.role!=="system";});
        var prompt=(messages||[]).filter(function(m){return m&&m.role==="system";}).map(function(m){return m.content;}).join("\n");
        var hit=!opts.forceRefresh&&cache.get(opts.cacheType,input,prompt);
        if(hit){global.DHProviders.lastCacheInfo={hit:true,promptChanged:hit.promptChanged,type:opts.cacheType,input:input};showSource(hit.record.source||sourceInfo("unknown","Eski kayıtta model bilgisi yok"),true);return hit.record.text;}
        var next={};Object.keys(opts).forEach(function(k){next[k]=opts[k];});next.__cacheBypass=true;
        return chat(messages,next).then(function(txt){cache.put(opts.cacheType,input,prompt,txt,opts.title||opts.cacheType);global.DHProviders.lastCacheInfo={hit:false,promptChanged:false,type:opts.cacheType,input:input};return txt;});
      });
    }
    if(aiMode()==="gemini") return chatViaGemini(messages,opts);
    var avail = PROVIDERS.filter(function(p){ return !p.manualOnly && keysOf(p.keyStore).length>0; });
    var hasNvidia = PROVIDERS.some(function(p){ return p.id==="nvidia" && keysOf(p.keyStore).length>0; });
    if(!avail.length) return hasNvidia ? chatViaNvidia(messages,opts) : Promise.reject({code:"no-key"});

    var idx = 0;
    function tryProvider(){
      if(idx>=avail.length) return hasNvidia ? chatViaNvidia(messages,opts) : Promise.reject({code:"all-failed"});
      var p = avail[idx++];
      return callProvider(p, messages, opts).then(function(result){
        showSource(sourceInfo(p.id,result.model));
        try{ if(global.DHAI && DHAI.noteSuccess) DHAI.noteSuccess(); }catch(e){}
        return result.text;
      }).catch(function(err){
        if(err && err.code==="abort") throw err;
        // bu sağlayıcı tükendi → sıradakine geç
        if(err && err.code==="rate"){ try{ if(global.DHAI && DHAI.noteRateLimit) DHAI.noteRateLimit(); }catch(e){} }
        if(idx<avail.length || hasNvidia) return tryProvider();
        throw err;
      });
    }
    return tryProvider();
  }

  // Canlı model listesi çek (CORS başarısız olursa gömülü listeye düş)
  function listModels(providerId){
    var p = PROVIDERS.filter(function(x){ return x.id===providerId; })[0];
    if(!p) return Promise.resolve([]);
    var fallback = (p.models||[]).slice();
    if(p.manualOnly) return Promise.resolve(fallback);
    if(!p.modelsUrl) return Promise.resolve(fallback);

    var url = p.modelsUrl, headers = {};
    var keys = keysOf(p.keyStore);
    if(p.modelsAuth===true){
      if(!keys.length) return Promise.resolve(fallback);
      headers["Authorization"] = "Bearer "+keys[0];
    } else if(p.modelsAuth==="query"){
      if(!keys.length) return Promise.resolve(fallback);
      url += "?key="+encodeURIComponent(keys[0]);
    }
    return fetch(url, {headers:headers}).then(function(res){
      if(!res.ok) throw 0;
      return res.json();
    }).then(function(d){
      var ids = [];
      // OpenAI biçimi: {data:[{id},...]}  |  Gemini: {models:[{name:"models/xxx"},...]}
      if(d && Array.isArray(d.data)) ids = d.data.map(function(m){ return m.id; });
      else if(d && Array.isArray(d.models)) ids = d.models.map(function(m){ return String(m.name||"").replace(/^models\//,""); });
      ids = ids.filter(Boolean);
      // Gemini'de sadece üretim (generateContent) + ÜCRETSİZ olanlar: flash'lar.
      // Pro modelleri ücretli olduğundan listeden çıkarılır.
      if(providerId==="gemini") ids = ids.filter(function(x){ return /flash/i.test(x) && !/pro/i.test(x); });
      return ids.length ? ids : fallback;
    }).catch(function(){ return fallback; });  // CORS/hata → gömülü liste
  }

  function setModel(providerId, model){
    try{
      if(model && model.trim()) localStorage.setItem("dh-model-"+providerId, model.trim());
      else localStorage.removeItem("dh-model-"+providerId);
    }catch(e){}
  }
  function getModel(providerId){
    var p = PROVIDERS.filter(function(x){ return x.id===providerId; })[0];
    return p ? modelOf(p) : "";
  }

  global.DHProviders = {
    chat: chat,
    youtubeStudy: youtubeStudy,
    manualChat: chatViaGemini,
    hasAnyKey: hasAnyKey,
    realHasAnyKey: realHasAnyKey,
    mode: aiMode,
    setMode: function(mode){
      if(mode!=="api"&&mode!=="gemini") return false;
      try{var p=JSON.parse(localStorage.getItem("dh-profile-v1")||"{}")||{};p.aiYontemi=mode;p.aiYontemiTarih=Date.now();localStorage.setItem("dh-profile-v1",JSON.stringify(p));return true;}catch(e){return false;}
    },
    activeProviders: activeProviders,
    listModels: listModels,
    setModel: setModel,
    getModel: getModel,
    showSource: showSource,
    sourceInfo: sourceInfo,
    PROVIDERS: PROVIDERS
  };
})(window);
