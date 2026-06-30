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
  var PROVIDERS = [
    {
      id:"groq",
      keyStore:"groqApiKeys",
      url:"https://api.groq.com/openai/v1/chat/completions",
      model:"llama-3.3-70b-versatile",
      kind:"openai"
    },
    {
      id:"cerebras",
      keyStore:"cerebrasApiKeys",
      url:"https://api.cerebras.ai/v1/chat/completions",
      model:"llama-3.3-70b",
      kind:"openai"
    },
    {
      id:"gemini",
      keyStore:"geminiApiKeys",
      // {KEY} runtime'da değiştirilir
      url:"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      model:"gemini-2.5-flash",
      kind:"gemini"
    }
  ];

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
      model: p.model,
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
      if(!res.ok) throw {code:"http", provider:p.id, status:res.status};
      return res.json();
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
    var url = p.url + "?key=" + encodeURIComponent(key);
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

  global.DHProviders = {
    chat: chat,
    hasAnyKey: hasAnyKey,
    activeProviders: activeProviders,
    PROVIDERS: PROVIDERS
  };
})(window);
