/* level-test.js — ÇOK BECERİLİ DİNAMİK SEVİYE SINAVI (IRT mantıklı)
   Dil Harita — Aşama 1: Tanı.

   5 soru türü (farklı beceriler — şansla geçilemesin diye yazmalılar serpiştirilir):
     1. tanima    : TR gösterilir, doğru EN'i 4 şıktan seç (pasif tanıma)
     2. siralama  : Karışık kelimeleri doğru sıraya diz (üretim — şans yok)
     3. gramer    : Cümlede boşluk, doğru kelimeyi 4 şıktan seç (dilbilgisi)
     4. dinleme   : EN sesli okunur (TTS), ne duyduğunu 4 şıktan seç (dinleme)
     5. yazma     : TR gösterilir, EN'i serbest yaz (aktif üretim — en zor)

   ~15 soru, uyarlanabilir: B1'den başlar, 2 dogru -> zorlasir, 2 yanlis -> kolaylasir.
   Tamamen KURALLI (AI yok). Sorular gercek cumle verisinden uretilir.
*/
(function(global){
  "use strict";

  var LEVELS = ["A1","A2","B1","B2","C1"];
  var START_LEVEL = "B1";
  var MAX_QUESTIONS = 15;
  var MIN_QUESTIONS = 10;

  var TYPE_PLAN = [
    "tanima","dinleme","gramer","siralama","tanima",
    "yazma","gramer","dinleme","siralama","tanima",
    "gramer","yazma","dinleme","siralama","tanima"
  ];

  function idx(lv){ var i=LEVELS.indexOf(lv); return i<0?2:i; }
  function clampLevel(i){ return LEVELS[Math.max(0, Math.min(LEVELS.length-1, i))]; }
  function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i];a[i]=a[j];a[j]=t; } return a; }
  function norm(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9'\s]/g," ").replace(/\s+/g," ").trim(); }

  function create(sentences){
    var byLevel = {};
    LEVELS.forEach(function(l){ byLevel[l]=[]; });
    (sentences||[]).forEach(function(s){
      if(s && s.level && byLevel[s.level] && s.en && s.tr){ byLevel[s.level].push(s); }
    });

    var curLevel = START_LEVEL;
    var asked = [];
    var history = [];
    var consecutiveWrong = 0, consecutiveRight = 0;
    var qCount = 0;
    var current = null;
    var finished = false;
    var levelVotes = {};
    var skillVotes = {};

    function pickSentence(level, type){
      var pool = (byLevel[level] || []).filter(function(s){
        if(asked.indexOf(s.en)>=0) return false;
        var wc = s.en.split(/\s+/).length;
        if((type==="siralama"||type==="yazma") && (wc<3 || wc>7)) return false;
        if(type==="gramer" && wc<3) return false;
        // tanıma/dinleme: çok uzun cümleler (kelime avına/okuma yüküne yol açar) elenir
        if((type==="tanima"||type==="dinleme") && wc>11) return false;
        return true;
      });
      if(!pool.length){
        pool = (byLevel[level]||[]).filter(function(s){
          var wc=s.en.split(/\s+/).length;
          if((type==="siralama"||type==="yazma")&&(wc<3||wc>7)) return false;
          if((type==="tanima"||type==="dinleme") && wc>11) return false;
          return true;
        });
      }
      // hâlâ boşsa uzunluk şartını kaldır
      if(!pool.length){
        pool = (byLevel[level]||[]).filter(function(s){
          var wc=s.en.split(/\s+/).length;
          if((type==="siralama"||type==="yazma")&&(wc<3||wc>7)) return false;
          return true;
        });
      }
      if(!pool.length) return null;
      return pool[Math.floor(Math.random()*pool.length)];
    }

    // Akıllı çeldirici: doğru cevaba BENZER cümleler seç (ortak kelime + benzer uzunluk).
    // Rastgele/alakasız çeldirici "kelime avı"na yol açar; benzer olanlar gerçek ayırt etme gerektirir.
    function wordsOf(str){
      return String(str||"").toLowerCase().replace(/[.,!?;:]/g," ").split(/\s+/).filter(function(w){ return w.length>0; });
    }
    var STOP = {"the":1,"a":1,"an":1,"is":1,"are":1,"was":1,"were":1,"to":1,"of":1,"in":1,"on":1,"at":1,"for":1,"and":1,"or":1,"i":1,"you":1,"he":1,"she":1,"it":1,"we":1,"they":1,"has":1,"have":1,"had":1,"will":1,"my":1,"your":1,"this":1,"that":1};
    function contentWords(str){
      return wordsOf(str).filter(function(w){ return !STOP[w]; });
    }
    function similarity(a, b){
      // ortak içerik kelimesi + UZUNLUK uyumu (güçlü ağırlık)
      var aw = contentWords(a), bw = contentWords(b);
      var bset = {}; bw.forEach(function(w){ bset[w]=1; });
      var common = 0; aw.forEach(function(w){ if(bset[w]) common++; });
      var lenA = wordsOf(a).length, lenB = wordsOf(b).length;
      // uzunluk farkı GÜÇLÜ ceza: kısa-uzun karışmasın (öğrenci uzunluğa bakıp seçemesin)
      var lenDiff = Math.abs(lenA - lenB);
      var lenScore = Math.max(0, 4 - lenDiff); // 0 fark=4 puan, 4+ fark=0 puan
      return common * 1.5 + lenScore;
    }
    function distractorsEN(correct, level){
      var corLen = wordsOf(correct.en).length;
      var pool = (byLevel[level]||[]).filter(function(s){
        if(s.en===correct.en) return false;
        var sl = wordsOf(s.en).length;
        // uzunluk bandı: doğru cevaba yakın uzunlukta olsun (çok kısa/uzun şık ele)
        // korLen büyükse en az korLen-3, küçükse esnek
        if(corLen>=6 && sl < corLen-3) return false; // uzun doğru yanında çok kısa şık olmasın
        if(sl > corLen+4) return false;
        return true;
      });
      // benzerliğe göre sırala
      var scored = pool.map(function(s){ return { en:s.en, sim:similarity(correct.en, s.en) }; });
      scored.sort(function(a,b){ return b.sim-a.sim; });
      var candidates = scored.slice(0, 12);
      // yeterli aday yoksa uzunluk bandını gevşet
      if(candidates.length<3){
        var pool2 = (byLevel[level]||[]).filter(function(s){ return s.en!==correct.en; });
        var scored2 = pool2.map(function(s){ return { en:s.en, sim:similarity(correct.en, s.en) }; }).sort(function(a,b){ return b.sim-a.sim; });
        candidates = scored2.slice(0, 12);
      }
      var picked = [];
      var seen = {};
      shuffle(candidates).forEach(function(x){
        if(picked.length<3 && !seen[x.en] && x.en!==correct.en){ seen[x.en]=1; picked.push(x.en); }
      });
      if(picked.length<3){
        var all=[]; LEVELS.forEach(function(l){ (byLevel[l]||[]).forEach(function(s){ if(s.en!==correct.en && !seen[s.en]) all.push(s.en); }); });
        var allScored = all.map(function(en){ return {en:en, sim:similarity(correct.en,en)}; }).sort(function(a,b){ return b.sim-a.sim; });
        var ai=0; while(picked.length<3 && ai<allScored.length){ if(!seen[allScored[ai].en]){ seen[allScored[ai].en]=1; picked.push(allScored[ai].en); } ai++; }
      }
      return picked;
    }

    function buildQuestion(type, s){
      var base = { type:type, level:curLevel, en:s.en, tr:s.tr, grammar:s.grammar||"" };
      if(type==="tanima" || type==="dinleme"){
        var opts = shuffle(distractorsEN(s, curLevel).concat([s.en]));
        base.options = opts;
        base.correctIndex = opts.indexOf(s.en);
        base.prompt = (type==="dinleme") ? "Duydugun cumle hangisi?" : "Bu cumlenin Ingilizcesi hangisi?";
        base.speak = (type==="dinleme") ? s.en : null;
        if(type==="dinleme") base.tr = null;
      }
      else if(type==="siralama"){
        var words = s.en.replace(/\s+/g," ").trim().split(" ");
        base.words = shuffle(words);
        base.answer = s.en;
        base.prompt = "Kelimeleri dogru siraya diz:";
      }
      else if(type==="yazma"){
        base.prompt = "Bu cumleyi Ingilizce yaz:";
        base.answer = s.en;
      }
      else if(type==="gramer"){
        var ws = s.en.split(" ");
        var blankPos = ws.length>=4 ? 1 + Math.floor(Math.random()*(ws.length-2)) : Math.floor(ws.length/2);
        var answer = ws[blankPos].replace(/[.,!?]/g,"");
        var display = ws.slice();
        display[blankPos] = "_____";
        var cand = {};
        (byLevel[curLevel]||[]).forEach(function(o){
          o.en.split(" ").forEach(function(w){
            var ww=w.replace(/[.,!?]/g,"").toLowerCase();
            if(ww && ww!==answer.toLowerCase() && ww.length>1) cand[ww]=1;
          });
        });
        var distr = shuffle(Object.keys(cand)).slice(0,3);
        var fallback=["is","are","the","a","to","do","have","will"];
        var fi=0; while(distr.length<3 && fi<fallback.length){ if(distr.indexOf(fallback[fi])<0) distr.push(fallback[fi]); fi++; }
        var gopts = shuffle(distr.concat([answer]));
        base.options = gopts;
        base.correctIndex = gopts.indexOf(answer);
        base.display = display.join(" ");
        base.prompt = "Bosluga hangi kelime gelir?";
        base.tr = s.tr;
      }
      return base;
    }

    function next(){
      if(finished) return null;
      var type = TYPE_PLAN[qCount % TYPE_PLAN.length];
      var s = pickSentence(curLevel, type);
      if(!s){
        s = pickSentence(clampLevel(idx(curLevel)-1), type) || pickSentence(clampLevel(idx(curLevel)+1), type);
        if(!s){
          type="tanima"; s=pickSentence(curLevel,"tanima");
          if(!s){ finished=true; return null; }
        }
      }
      asked.push(s.en);
      current = buildQuestion(type, s);
      qCount++;
      return current;
    }

    function answer(payload){
      if(!current || finished) return null;
      var correct = false;
      if(current.type==="tanima" || current.type==="dinleme" || current.type==="gramer"){
        correct = (payload && payload.index === current.correctIndex);
      } else if(current.type==="siralama"){
        correct = (norm(payload && payload.text) === norm(current.answer));
      } else if(current.type==="yazma"){
        // Yazma: HTML tarafı AI/esnek kontrol sonucunu önceden verir (payload.correct).
        // Verilmemişse birebir karşılaştırmaya düş (geriye uyumluluk).
        if(payload && typeof payload.correct==="boolean") correct = payload.correct;
        else correct = (norm(payload && payload.text) === norm(current.answer));
      }

      history.push({ level:current.level, correct:correct, type:current.type });
      levelVotes[current.level] = levelVotes[current.level] || {r:0,w:0};
      correct ? levelVotes[current.level].r++ : levelVotes[current.level].w++;
      skillVotes[current.type] = skillVotes[current.type] || {r:0,w:0};
      correct ? skillVotes[current.type].r++ : skillVotes[current.type].w++;

      if(correct){
        consecutiveRight++; consecutiveWrong=0;
        if(consecutiveRight>=2 && idx(curLevel)<LEVELS.length-1){ curLevel=clampLevel(idx(curLevel)+1); consecutiveRight=0; }
      } else {
        consecutiveWrong++; consecutiveRight=0;
        if(consecutiveWrong>=2 && idx(curLevel)>0){ curLevel=clampLevel(idx(curLevel)-1); consecutiveWrong=0; }
      }

      if(qCount>=MAX_QUESTIONS) finished=true;
      else if(qCount>=MIN_QUESTIONS){
        var recent = history.slice(-5);
        var seen={}; recent.forEach(function(h){ seen[h.level]=1; });
        if(Object.keys(seen).length<=1) finished=true;
      }

      var cur = current; current=null;
      var out = { correct:correct, finished:finished, type:cur.type };
      if(cur.type==="tanima"||cur.type==="dinleme"||cur.type==="gramer") out.correctIndex=cur.correctIndex;
      if(cur.type==="siralama"||cur.type==="yazma") out.answer=cur.answer;
      return out;
    }

    function result(){
      var best = "A1";
      for(var i=LEVELS.length-1;i>=0;i--){
        var l=LEVELS[i], v=levelVotes[l];
        if(v && v.r>=2 && (v.r/(v.r+v.w))>=0.6){ best=l; break; }
        if(v && v.r>=1 && (v.r+v.w)===1){ best=l; break; }
      }
      var bv = levelVotes[best] || {r:0,w:0};
      var total = bv.r+bv.w;
      var confidence = total>0 ? Math.round(100*bv.r/total) : 50;
      return { level:best, confidence:confidence, history:history, votes:levelVotes, skills:skillVotes, questionCount:qCount };
    }

    return {
      next: next, answer: answer,
      done: function(){ return finished; },
      result: result,
      get current(){ return current; },
      get count(){ return qCount; },
      maxQuestions: MAX_QUESTIONS
    };
  }

  global.DHLevelTest = { create: create, LEVELS: LEVELS };
})(window);
