/* module-story.js — MODÜL HİKAYESİ + DİNLEME ("podcast")
   Dil Harita — Modül bitince o modülün yapılarını kullanan hikaye üretir.

   - AI (Groq) modülün gramer konusunu + örnek cümlelerini alıp seviyeye uygun
     kısa bir hikaye yazar (İngilizce + Türkçe çeviri).
   - Hikaye TTS ile seslendirilebilir ("dinle" = podcast benzeri).
   - AI yoksa: modülün kendi cümlelerinden basit bir dizilim sunar (kurallı yedek).

   API:
     DHModuleStory.generate(moduleId, sentences) -> Promise<{title, en, tr, ai}>
        sentences: o modülün cümleleri (en/tr/grammar)
     DHModuleStory.cacheGet(moduleId) / cacheSet(moduleId, story)
*/
(function(global){
  "use strict";
  if(global.DHModuleStory) return;

  var CACHE_PREFIX = "story:";

  function cacheGet(moduleId){
    try{ var r=localStorage.getItem(CACHE_PREFIX+moduleId); return r?JSON.parse(r):null; }catch(e){ return null; }
  }
  function cacheSet(moduleId, story){
    try{ localStorage.setItem(CACHE_PREFIX+moduleId, JSON.stringify(story)); }catch(e){}
  }

  function keys(){ try{ return (JSON.parse(localStorage.getItem("groqApiKeys")||"[]")||[]).filter(Boolean); }catch(e){ return []; } }

  // modülden gramer konusu + örnek cümleler topla
  function moduleProfile(moduleId, sentences){
    var items=(sentences||[]).filter(function(s){ return s.module===moduleId; });
    var level = items[0] ? (items[0].level||"") : "";
    // konu adı modül adından (örn "B1-M01 Present Perfect" → "Present Perfect")
    var topic = String(moduleId).replace(/^[A-C][12]-M\d+\s*/,"") || moduleId;
    // birkaç örnek cümle (hikayede kullanılsın diye)
    var samples = [];
    for(var i=0;i<items.length && samples.length<8;i+=Math.max(1,Math.floor(items.length/8))){
      if(items[i] && items[i].en) samples.push(items[i].en);
    }
    // gramer alt-konuları
    var grams={}; items.forEach(function(s){ if(s.grammar) grams[s.grammar]=1; });
    return { level:level, topic:topic, samples:samples, grammars:Object.keys(grams).slice(0,4), count:items.length };
  }

  // AI ile hikaye üret
  function generateAI(prof){
    var ks=keys();
    if(!ks.length) return Promise.reject({code:"no-key"});
    var sys = "Sen bir İngilizce öğretmenisin. Öğrenci için KISA, akıcı ve eğlenceli bir hikaye yaz. "
      + "Hikaye, verilen gramer konusunu BOL BOL kullanmalı (öğrenci o yapıyı bağlamda görsün). "
      + "Seviye: "+(prof.level||"B1")+" — kelimeler ve cümleler bu seviyeye uygun olsun, fazla zorlaştırma. "
      + "5-8 cümlelik tek paragraf. Sonra AYNI hikayenin doğal Türkçe çevirisini ver. "
      + "SADECE şu JSON formatında yanıt ver, başka hiçbir şey yazma: "
      + '{"title":"kısa İngilizce başlık","en":"İngilizce hikaye","tr":"Türkçe çeviri"}';
    var usr = "Gramer konusu: "+prof.topic+"\n"
      + (prof.grammars.length? "Alt konular: "+prof.grammars.join(", ")+"\n" : "")
      + "Bu yapıları kullanan örnek cümleler:\n- " + prof.samples.slice(0,6).join("\n- ")
      + "\n\nBu gramer konusunu bolca kullanan, "+(prof.level||"B1")+" seviyesine uygun kısa bir hikaye yaz.";

    return fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+ks[0]},
      body:JSON.stringify({model:"llama-3.3-70b-versatile",messages:[{role:"system",content:sys},{role:"user",content:usr}],temperature:0.7,max_tokens:700})
    }).then(function(res){
      if(res.status===429){ try{ if(global.DHAI) DHAI.noteRateLimit(); }catch(e){} throw {code:"rate"}; }
      if(!res.ok) throw {code:"http"};
      try{ if(global.DHAI) DHAI.noteSuccess(); }catch(e){}
      return res.json();
    }).then(function(d){
      var txt=(d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content||"").trim();
      var m=txt.match(/\{[\s\S]*\}/);
      if(m){
        try{
          var o=JSON.parse(m[0]);
          if(o.en){ return { title:o.title||prof.topic, en:o.en, tr:o.tr||"", ai:true }; }
        }catch(e){}
      }
      throw {code:"parse"};
    });
  }

  // kurallı yedek: modülün kendi cümlelerinden basit dizilim
  function fallback(prof, sentences, moduleId){
    var items=(sentences||[]).filter(function(s){ return s.module===moduleId; });
    var pick = items.slice(0, 6);
    var en = pick.map(function(s){ return s.en; }).join(" ");
    var tr = pick.map(function(s){ return s.tr; }).join(" ");
    return { title:prof.topic, en:en, tr:tr, ai:false, fallback:true };
  }

  function generate(moduleId, sentences){
    var cached = cacheGet(moduleId);
    if(cached) return Promise.resolve(cached);
    var prof = moduleProfile(moduleId, sentences);

    var useAI = false;
    try{ useAI = !!(global.DHAI && DHAI.available()); }catch(e){ useAI = keys().length>0; }

    if(useAI){
      return generateAI(prof).then(function(story){
        cacheSet(moduleId, story);
        return story;
      }).catch(function(){
        // AI başarısız → kurallı yedek (cache'leme, AI sonra denenebilsin)
        return fallback(prof, sentences, moduleId);
      });
    }
    return Promise.resolve(fallback(prof, sentences, moduleId));
  }

  global.DHModuleStory = {
    generate: generate,
    cacheGet: cacheGet,
    cacheSet: cacheSet,
    moduleProfile: moduleProfile
  };
})(window);
