/* ai-providers.js — ÇOK SAĞLAYICILI AI KATMANI (aşamalı/fallback)
   Dil Harita — Groq → Cerebras → Gemini sırasıyla dener.

   Anahtarlar (localStorage, her biri JSON dizi):
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
      id:"groq",
      keyStore:"groqApiKeys",
      url:"https://api.groq.com/openai/v1/chat/completions",
      model:"llama-3.3-70b-versatile",
      models:["llama-3.3-70b-versatile","openai/gpt-oss-120b","openai/gpt-oss-20b","llama-3.1-8b-instant","qwen3-32b","llama-4-scout"],
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
    },
    {
      id:"gemini",
      keyStore:"geminiApiKeys",
      url:"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
      model:"gemini-2.5-flash",
      // Gemini: SADECE Flash ücretsiz (Pro ücretli — listeye koymuyoruz)
      models:["gemini-2.5-flash","gemini-2.5-flash-lite"],
      modelsUrl:"https://generativelanguage.googleapis.com/v1beta/models",  // ?key= ile
      modelsAuth:"query",
      kind:"gemini"
    }
  ];

  // Kullanıcının seçtiği model (yoksa varsayılan)
  function modelOf(p){
    try{
      var m = localStorage.getItem("dh-model-"+p.id);
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
  function hasAnyKey(){
    return PROVIDERS.some(function(p){ return keysOf(p.keyStore).length>0; });
  }
  function activeProviders(){
    return PROVIDERS.filter(function(p){ return keysOf(p.keyStore).length>0; }).map(function(p){ return p.id; });
  }

  // --- OpenAI-uyumlu çağrı (Groq, Cerebras) ---
  function callOpenAI(p, key, messages, opts){
    var body = {
      model: modelOf(p),
      messages: messages,
      temperature: (opts.temperature!=null?opts.temperature:0.3),
      max_tokens: (opts.max_tokens||800)
    };
    return fetch(p.url, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+key },
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
    if(sys) bodyObj.systemInstruction = { parts:[{text:sys}] };
    var endpoint = p.url.replace("{MODEL}", modelOf(p));
    var url = endpoint + "?key=" + encodeURIComponent(key);
    return fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(bodyObj)
    }).then(function(res){
      if(res.status===429) throw {code:"rate", provider:p.id};
      if(res.status===400||res.status===403) throw {code:"bad-key", provider:p.id};
      if(!res.ok) throw {code:"http", provider:p.id, status:res.status};
      return res.json();
    }).then(function(d){
      var txt = d && d.candidates && d.candidates[0] && d.candidates[0].content
        && d.candidates[0].content.parts && d.candidates[0].content.parts[0] && d.candidates[0].content.parts[0].text;
      if(txt==null) throw {code:"empty", provider:p.id};
      return String(txt);
    });
  }

  function callProvider(p, messages, opts){
    var keys = keysOf(p.keyStore);
    if(!keys.length) return Promise.reject({code:"no-key", provider:p.id});
    // o sağlayıcının anahtarlarını sırayla dene (biri bozuksa diğeri)
    var i = 0;
    function tryKey(){
      if(i>=keys.length) return Promise.reject({code:"all-keys-failed", provider:p.id});
      var key = keys[i++];
      var fn = (p.kind==="gemini") ? callGemini : callOpenAI;
      return fn(p, key, messages, opts).catch(function(err){
        // bu anahtar bozuk/limitse sıradaki anahtarı dene
        if(err && (err.code==="bad-key" || err.code==="rate")) return tryKey();
        throw err;
      });
    }
    return tryKey();
  }

  // --- ANA FONKSİYON: aşamalı dene ---
  function chat(messages, opts){
    opts = opts || {};
    var avail = PROVIDERS.filter(function(p){ return keysOf(p.keyStore).length>0; });
    if(!avail.length) return Promise.reject({code:"no-key"});

    var idx = 0;
    function tryProvider(){
      if(idx>=avail.length) return Promise.reject({code:"all-failed"});
      var p = avail[idx++];
      return callProvider(p, messages, opts).then(function(txt){
        try{ if(global.DHAI && DHAI.noteSuccess) DHAI.noteSuccess(); }catch(e){}
        return txt;
      }).catch(function(err){
        // bu sağlayıcı tükendi → sıradakine geç
        if(err && err.code==="rate"){ try{ if(global.DHAI && DHAI.noteRateLimit) DHAI.noteRateLimit(); }catch(e){} }
        if(idx<avail.length) return tryProvider();
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
    hasAnyKey: hasAnyKey,
    activeProviders: activeProviders,
    listModels: listModels,
    setModel: setModel,
    getModel: getModel,
    PROVIDERS: PROVIDERS
  };
})(window);
