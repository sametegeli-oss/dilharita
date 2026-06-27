/* lesson-engine.js
   Dil Harita — DERS MOTORU (AI'sız öğretmen beyni)

   Öğretmen anayasasını (DHTeacherPolicy) öğrencinin gerçek verisiyle
   birleştirip SOMUT bir ders planı üretir. Deterministiktir: aynı
   durumda her zaman aynı planı verir.

   VERİ KAYNAKLARI:
   - DHProgress      : ne öğrenildi / öğreniliyor (tüm modüller)
   - LearningErrorDB : zayıf konular, sık hatalar
   - StudyTracker    : seri, günlük durum, hedef
   - data/*.json     : içerik (cümle, pv, kelime)

   ÇIKTI: { intro, steps:[{phase,type,itemId,item,prompt}], hedef }
     phase: isinma | tekrar | yeni | pekistirme
*/
(function(){
  "use strict";
  if(window.__dhLessonInstalled) return;
  window.__dhLessonInstalled = true;

  // ---- içerik önbelleği ----
  var cache = { sentence:null, pv:null, word:null };

  function loadData(type){
    if(cache[type]) return Promise.resolve(cache[type]);
    var paths = {
      sentence:"./data/sentences.json",
      pv:"./data/phrasal-verbs.json",
      word:"./data/dictionary.json"
    };
    return fetch(paths[type]).then(function(r){ return r.ok?r.json():null; }).then(function(d){
      var list=[];
      if(Array.isArray(d)){
        list = d.map(function(x){
          if(type==="pv") return { id:x.pv, label:x.pv, tr:x.tr, freq:x.freq||0, meanings:x.meanings, examples:x.examples, level:x.level||"" };
          // sentence
          return { id:x.id, label:x.en, tr:x.tr, level:x.level||"", module:x.module||"", topic:x.topic||"", grammar:x.grammar||"", aiExplain:x.aiExplain||"", commonMistake:x.commonMistake||"" };
        });
      }else if(d && typeof d==="object"){
        // dictionary {kelime:...} — alan adları Türkçe: seviye, frekans, anlamlar, oku
        list = Object.keys(d).map(function(k){
          var v=d[k]||{};
          if(typeof v==="string") return { id:k, label:k, tr:v, level:"", freq:0, meanings:[v], oku:"" };
          return {
            id:k, label:k,
            tr:(v.anlamlar && v.anlamlar.length ? v.anlamlar[0] : (v.tr||"")),
            level:(v.seviye||v.level||""),
            freq:(v.frekans||v.freq||0),
            meanings:(v.anlamlar||v.meanings||[]),
            oku:(v.oku||"")
          };
        });
      }
      cache[type]=list;
      return list;
    }).catch(function(){ cache[type]=[]; return []; });
  }

  // ---- öğrenci durumu topla ----
  function gatherState(){
    var P = window.DHProgress;
    var jobs = [];
    var state = { progress:{}, errors:[], errorSummary:null, streak:0, doneToday:false, summary:null };

    // ilerleme (tür bazlı durum haritaları)
    ["sentence","pv","word"].forEach(function(t){
      jobs.push(
        (P && P.getAllForType ? P.getAllForType(t) : Promise.resolve({}))
          .then(function(m){ state.progress[t]=m||{}; })
          .catch(function(){ state.progress[t]={}; })
      );
    });
    // hata defteri
    jobs.push(
      (window.LearningErrorDB && LearningErrorDB.all ? LearningErrorDB.all() : Promise.resolve([]))
        .then(function(arr){
          state.errors=arr||[];
          try{ state.errorSummary = LearningErrorDB.summarize ? LearningErrorDB.summarize(arr) : null; }catch(e){}
        }).catch(function(){ state.errors=[]; })
    );
    // study tracker
    try{
      if(window.StudyTracker){
        state.streak = StudyTracker.streak ? StudyTracker.streak() : 0;
        state.summary = StudyTracker.summary ? StudyTracker.summary() : null;
        if(state.summary){ state.doneToday = !!state.summary.doneToday; }
      }
    }catch(e){}

    return Promise.all(jobs).then(function(){ return state; });
  }

  // ---- yardımcılar ----
  function statusOf(state, type, id){ return (state.progress[type]||{})[id] || 0; }

  var LEVEL_ORDER=["A1","A2","B1","B2","C1","C2"];
  function levelIndex(lv){ var i=LEVEL_ORDER.indexOf((lv||"").toUpperCase()); return i<0?0:i; }

  // öğrencinin seviyesini belirle (anayasa "auto" ise ilerlemeden tahmin)
  function resolveLevel(policy, state, lists){
    var s=(policy.seviye||"auto");
    if(s!=="auto" && LEVEL_ORDER.indexOf(s)>=0) return s;
    // auto: öğrenilmiş en yüksek seviyeli cümleye bak; yoksa A1
    var prog=state.progress.sentence||{};
    var maxLv=0, seen=false;
    (lists.sentence||[]).forEach(function(it){
      if(prog[it.id]>=1 && it.level){ seen=true; var li=levelIndex(it.level); if(li>maxLv) maxLv=li; }
    });
    return seen ? LEVEL_ORDER[maxLv] : "A1";
  }

  // bir öğenin seviyesi öğrenciye uygun mu (kendi seviyesi + izin verilen üst)
  function levelOk(itemLevel, studentLevel, allowAbove){
    if(!itemLevel) return true; // seviyesiz içerik her zaman uygun
    var diff = levelIndex(itemLevel) - levelIndex(studentLevel);
    return diff <= (allowAbove||0); // kendi seviyesi ve altı + izin verilen üst
  }

  // bir türde "yeni" (hiç dokunulmamış) öğeleri frekans/sıra ile getir
  function pickNew(list, state, type, n, frekansOnce, studentLevel, allowAbove){
    var arr = list.filter(function(it){
      if(statusOf(state,type,it.id)!==0) return false;
      if(studentLevel && !levelOk(it.level, studentLevel, allowAbove)) return false;
      return true;
    });
    if(frekansOnce && (type==="pv"||type==="word")){
      arr = arr.slice().sort(function(a,b){ return (b.freq||0)-(a.freq||0); });
    }
    return arr.slice(0, n);
  }

  // "öğreniliyor" (1) durumundaki öğeler — tekrar adayları
  function pickLearning(list, state, type, n){
    var arr = list.filter(function(it){ return statusOf(state,type,it.id)===1; });
    return arr.slice(0, n);
  }

  // "öğrenildi" (2) — ısınma adayları
  function pickLearned(list, state, type, n){
    var arr = list.filter(function(it){ return statusOf(state,type,it.id)===2; });
    // karıştır (hep aynı olmasın)
    for(var i=arr.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=arr[i];arr[i]=arr[j];arr[j]=t; }
    return arr.slice(0, n);
  }

  // hata defterinden zayıf öğeleri çöz (target/sentenceId üzerinden eşle)
  function pickWeak(state, lists, n){
    var out=[];
    var seen={};
    (state.errors||[]).forEach(function(e){
      if(out.length>=n) return;
      var sid = e.sentenceId||"";
      var p = parseItemId(sid);
      if(!p) return;
      var key=p.type+":"+p.id;
      if(seen[key]) return; seen[key]=1;
      var list=lists[p.type]; if(!list) return;
      var item=list.find(function(x){ return String(x.id)===String(p.id); });
      if(item){ out.push({ type:p.type, item:item }); }
    });
    return out;
  }
  function parseItemId(sid){
    if(!sid) return null;
    var i=sid.indexOf(":");
    if(i<0) return { type:"sentence", id:sid }; // eski kayıtlar düz cümle id
    return { type:sid.slice(0,i), id:sid.slice(i+1) };
  }

  // ağırlığa göre tür seç (yeni içerik dağılımı)
  function weightedTypes(weights, count){
    var pool=[];
    for(var t in weights){ for(var i=0;i<(weights[t]||0);i++) pool.push(t); }
    if(!pool.length) pool=["sentence"];
    var out=[];
    for(var k=0;k<count;k++){ out.push(pool[k % pool.length]); }
    return out;
  }

  // ---- Gramer konusu seç (öğrencinin seviyesinden, henüz iyi bilinmeyen) ----
  function pickGrammar(lists, state, studentLevel, allowAbove, n){
    var sentences = lists.sentence||[];
    var groups={};
    sentences.forEach(function(it){
      if(!it.grammar) return;
      if(!levelOk(it.level, studentLevel, allowAbove)) return;
      var g=it.grammar;
      if(!groups[g]) groups[g]={ grammar:g, level:it.level, pattern:"", aiExplain:"", grammarTags:it.grammarTags, sentences:[], learned:0, total:0 };
      groups[g].total++;
      if(statusOf(state,"sentence",it.id)>=2) groups[g].learned++;
      if(groups[g].sentences.length<4) groups[g].sentences.push(it);
      if(it.aiExplain && !groups[g].aiExplain) groups[g].aiExplain=it.aiExplain;
      if(it.pattern && !groups[g].pattern) groups[g].pattern=it.pattern;
    });
    var arr=Object.keys(groups).map(function(g){ return groups[g]; });
    arr.sort(function(a,b){
      var ar=a.total? a.learned/a.total:0, br=b.total? b.learned/b.total:0;
      return ar-br;
    });
    return arr.slice(0, n);
  }

  // ---- ANA: ders planı üret ----
  function buildLesson(){
    var policy = window.DHTeacherPolicy ? DHTeacherPolicy.load() : null;
    if(!policy) return Promise.reject(new Error("Anayasa yüklenemedi"));

    return Promise.all([ loadData("sentence"), loadData("pv"), loadData("word"), gatherState() ])
      .then(function(res){
        var lists = { sentence:res[0], pv:res[1], word:res[2] };
        var state = res[3];

        // öğrenci seviyesi
        var studentLevel = resolveLevel(policy, state, lists);
        var allowAbove = (typeof policy.seviyeUstuneIzin==="number") ? policy.seviyeUstuneIzin : 1;

        var total = policy.dersUzunlugu||12;
        var o = policy.evreOranlari||{};
        var nIsinma = Math.max(0, Math.round(total*(o.isinma||0)));
        var nTekrar = Math.max(0, Math.round(total*(o.tekrar||0)));
        var nYeni   = Math.max(0, Math.round(total*(o.yeni||0)));
        var nPekistirme = Math.max(0, Math.round(total*(o.pekistirme||0)));

        // uyarlama: dün/son ders başarısı düşükse yeni'yi azalt, tekrarı artır
        if(policy.uyarla){
          var perf = recentPerformance(state);
          if(perf!==null && perf < (policy.basarisizlikEsigi||0.5)){
            var shift = Math.min(nYeni, 2);
            nYeni -= shift; nTekrar += shift;
          }else if(perf!==null && perf > (policy.basariEsigi||0.85)){
            // iyi gidiyor: bir miktar yeni ekle
            nYeni += 1;
          }
        }
        // günlük yeni sınırı
        nYeni = Math.min(nYeni, policy.gunlukYeniSiniri||7);

        var steps=[];

        // 0) GRAMER — dersin başında konu anlatımı
        var gram = policy.gramer||{};
        if(gram.acik){
          var gtopics = pickGrammar(lists, state, studentLevel, allowAbove, Math.max(0,gram.konuSayisi||0));
          gtopics.forEach(function(gt){
            steps.push({
              phase:"gramer",
              type:"grammar",
              itemId:"grammar:"+gt.grammar,
              item:{ label:gt.grammar, level:gt.level, pattern:gt.pattern, aiExplain:gt.aiExplain, grammarTags:gt.grammarTags, examples:gt.sentences },
              isGrammar:true
            });
          });
        }

        // 1) ISINMA — öğrenilmiş öğelerle
        var warm = [];
        ["pv","sentence","word"].forEach(function(t){
          if(warm.length<nIsinma) warm = warm.concat(pickLearned(lists[t], state, t, nIsinma-warm.length).map(function(it){ return {type:t,item:it}; }));
        });
        warm.slice(0,nIsinma).forEach(function(w){ steps.push(mkStep("isinma", w.type, w.item, policy)); });

        // 2) TEKRAR — önce zayıf (hata defteri), sonra "öğreniliyor"
        var rev = pickWeak(state, lists, nTekrar);
        if(rev.length<nTekrar){
          ["pv","sentence","word"].forEach(function(t){
            if(rev.length<nTekrar) rev = rev.concat(pickLearning(lists[t], state, t, nTekrar-rev.length).map(function(it){ return {type:t,item:it}; }));
          });
        }
        rev.slice(0,nTekrar).forEach(function(w){ steps.push(mkStep("tekrar", w.type, w.item, policy)); });

        // 3) YENİ — ağırlığa göre türlerden, frekans öncelikli
        var types = weightedTypes(policy.icerikAgirliklari||{sentence:1}, nYeni);
        var usedNew={};
        var newPicks={ sentence:[], pv:[], word:[] };
        // her tür için yeni aday havuzunu hazırla
        ["sentence","pv","word"].forEach(function(t){
          newPicks[t] = pickNew(lists[t], state, t, nYeni, policy.frekansOnce, studentLevel, allowAbove);
        });
        var newIdx={ sentence:0, pv:0, word:0 };
        types.forEach(function(t){
          // bu türden bir sonraki kullanılmamış öğeyi al; biterse başka türe kay
          var picked=null;
          var order=[t,"sentence","pv","word"]; // önce istenen tür, sonra diğerleri
          for(var oi=0; oi<order.length && !picked; oi++){
            var tt=order[oi];
            while(newIdx[tt] < newPicks[tt].length){
              var cand=newPicks[tt][newIdx[tt]++];
              var key=tt+":"+cand.id;
              if(!usedNew[key]){ usedNew[key]=1; picked=mkStep("yeni", tt, cand, policy); break; }
            }
          }
          if(picked) steps.push(picked);
        });

        // 4) PEKİŞTİRME — bu derste geçen yeni öğelerden mini alıştırma işareti
        var newOnes = steps.filter(function(s){ return s.phase==="yeni"; });
        for(var i=0;i<nPekistirme && i<newOnes.length;i++){
          var src=newOnes[i];
          steps.push({ phase:"pekistirme", type:src.type, itemId:src.itemId, item:src.item, prompt:"Az önce öğrendiğin '"+src.item.label+"' ile küçük bir alıştırma.", exercise:true });
        }

        // 5) VİDEO İLE ÖĞREN — konu cümlesini videopractice'te öğret
        var vid = policy.video||{};
        if(vid.acik){
          var vidN = Math.max(0, vid.adimSayisi||0);
          var lessonSent = steps.filter(function(s){ return s.type==="sentence"; }).map(function(s){ return s.item; });
          var vPool = lessonSent.slice();
          if(vPool.length<vidN){
            var vExtra=(lists.sentence||[]).filter(function(it){
              return levelOk(it.level,studentLevel,allowAbove) && vPool.indexOf(it)<0;
            }).slice(0, vidN-vPool.length);
            vPool=vPool.concat(vExtra);
          }
          for(var vi=0; vi<vidN && vi<vPool.length; vi++){
            var vit=vPool[vi];
            steps.push({ phase:"video", type:"sentence", itemId:"sentence:"+vit.id, item:vit, isVideo:true });
          }
        }

        // 6) TELAFFUZ — anayasaya göre konuşma pratiği (cümlelerle)
        var tel = policy.telaffuz||{};
        if(tel.acik){
          var telN = Math.max(0, tel.adimSayisi||0);
          // önce bu derste geçen cümleler, yetmezse seviyeye uygun cümleler
          var lessonSentences = steps.filter(function(s){ return s.type==="sentence"; }).map(function(s){ return s.item; });
          var telPool = lessonSentences.slice();
          if(telPool.length < telN){
            // bilinen/öğreniliyor cümlelerden ekle
            var extra = (lists.sentence||[]).filter(function(it){
              var st = statusOf(state,"sentence",it.id);
              return st>=1 && telPool.indexOf(it)<0;
            }).slice(0, telN-telPool.length);
            telPool = telPool.concat(extra);
          }
          // hâlâ yetmezse herhangi bir cümle
          if(telPool.length < telN){
            telPool = telPool.concat((lists.sentence||[]).slice(0, telN-telPool.length));
          }
          for(var ti=0; ti<telN && ti<telPool.length; ti++){
            var sit = telPool[ti];
            steps.push({
              phase:"telaffuz",
              type:"sentence",
              itemId:"sentence:"+sit.id,
              item:sit,
              prompt:sit.label,
              yontem: tel.yontem||"ders-ici"
            });
          }
        }

        var intro = buildIntro(policy, state, steps);
        return {
          intro: intro,
          steps: steps,
          policy: policy,
          state: { streak:state.streak, doneToday:state.doneToday },
          hedef: policy.gunlukHedef||{ders:1,dakika:10}
        };
      });
  }

  // son ders başarısı (StudyTracker events'ten kaba tahmin) — yoksa null
  function recentPerformance(state){
    try{
      if(state.summary && state.summary.today){
        // bu basit sürümde: bugün hata/doğru oranını events'ten çıkar
      }
    }catch(e){}
    return null; // şimdilik nötr; ileride pratik skorları bağlanır
  }

  function mkStep(phase, type, item, policy){
    var msg = policy.mesajlar||{};
    var prompt = "";
    if(phase==="isinma") prompt = item.label;
    else if(phase==="tekrar") prompt = item.label;
    else if(phase==="yeni") prompt = item.label;
    return {
      phase: phase,
      type: type,
      itemId: type+":"+item.id,
      item: item,
      prompt: prompt
    };
  }

  function buildIntro(policy, state, steps){
    var m = policy.mesajlar||{};
    var counts = { isinma:0, tekrar:0, yeni:0, pekistirme:0 };
    steps.forEach(function(s){ counts[s.phase]=(counts[s.phase]||0)+1; });
    var greet = (state.streak>=2)
      ? ("🔥 "+state.streak+" günlük serindesin. ")
      : "";
    return {
      greeting: greet + (m.gunaydin||"Bugünkü dersine başlayalım."),
      breakdown: counts
    };
  }

  window.DHLesson = {
    build: buildLesson,
    _loadData: loadData,
    _gatherState: gatherState
  };
})();
