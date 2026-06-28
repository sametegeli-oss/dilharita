/* level-test.js — DİNAMİK SEVİYE SINAVI (IRT mantıklı)
   Dil Harita — Aşama 1: Tanı.

   Türkçe cümle gösterilir, öğrenci 4 İngilizce seçenekten doğruyu seçer.
   Uyarlanabilir: B1'den başlar. Üst üste 2 hata → bir alt seviye.
   Rahat geçerse → üst seviye. ~10 soruda nokta atışı seviye belirler.

   Tamamen KURALLI (AI yok). Sorular gerçek cümle verisinden üretilir.

   API:
     var test = DHLevelTest.create(sentences);   // cümle listesi
     test.next();        // sıradaki soru {tr, options[4], correctIndex, level}
     test.answer(idx);   // cevabı işle, true/false döner
     test.done();        // bitti mi
     test.result();      // {level, confidence, history}
*/
(function(global){
  "use strict";

  var LEVELS = ["A1","A2","B1","B2","C1"];
  var START_LEVEL = "B1";
  var MAX_QUESTIONS = 10;
  var MIN_QUESTIONS = 6;

  function idx(lv){ var i=LEVELS.indexOf(lv); return i<0?2:i; }
  function clampLevel(i){ return LEVELS[Math.max(0, Math.min(LEVELS.length-1, i))]; }
  function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i];a[i]=a[j];a[j]=t; } return a; }

  function create(sentences){
    // seviyeye göre grupla
    var byLevel = {};
    LEVELS.forEach(function(l){ byLevel[l]=[]; });
    (sentences||[]).forEach(function(s){
      if(s && s.level && byLevel[s.level] && s.en && s.tr){ byLevel[s.level].push(s); }
    });

    var curLevel = START_LEVEL;
    var asked = [];           // sorulan cümle id/en'leri (tekrar olmasın)
    var history = [];         // {level, correct}
    var consecutiveWrong = 0;
    var consecutiveRight = 0;
    var qCount = 0;
    var current = null;
    var finished = false;
    var levelVotes = {};      // her seviyede doğru/yanlış sayısı

    function pickSentence(level){
      var pool = byLevel[level] || [];
      // sorulmamışları tercih et
      var fresh = pool.filter(function(s){ return asked.indexOf(s.en)<0; });
      var use = fresh.length ? fresh : pool;
      if(!use.length) return null;
      return use[Math.floor(Math.random()*use.length)];
    }

    // yanlış şıklar: aynı seviyeden farklı cümleler (çeldirici)
    function makeOptions(correct, level){
      var pool = (byLevel[level]||[]).filter(function(s){ return s.en!==correct.en; });
      var distractors = shuffle(pool).slice(0,3).map(function(s){ return s.en; });
      // yetersizse diğer seviyelerden tamamla
      if(distractors.length<3){
        var all = [];
        LEVELS.forEach(function(l){ (byLevel[l]||[]).forEach(function(s){ if(s.en!==correct.en && distractors.indexOf(s.en)<0) all.push(s.en); }); });
        all = shuffle(all);
        while(distractors.length<3 && all.length){ distractors.push(all.shift()); }
      }
      var opts = shuffle(distractors.concat([correct.en]));
      return { options: opts, correctIndex: opts.indexOf(correct.en) };
    }

    function next(){
      if(finished) return null;
      var s = pickSentence(curLevel);
      if(!s){
        // bu seviyede soru yok — komşu seviyeye kaydır
        var alt = pickSentence(clampLevel(idx(curLevel)-1)) || pickSentence(clampLevel(idx(curLevel)+1));
        if(!alt){ finished=true; return null; }
        s = alt;
      }
      asked.push(s.en);
      var o = makeOptions(s, curLevel);
      current = { tr:s.tr, en:s.en, options:o.options, correctIndex:o.correctIndex, level:curLevel, grammar:s.grammar||"" };
      qCount++;
      return current;
    }

    function answer(selectedIndex){
      if(!current || finished) return null;
      var correct = (selectedIndex === current.correctIndex);
      history.push({ level:current.level, correct:correct });
      levelVotes[current.level] = levelVotes[current.level] || {r:0,w:0};
      if(correct){ levelVotes[current.level].r++; } else { levelVotes[current.level].w++; }

      if(correct){
        consecutiveRight++; consecutiveWrong=0;
        // 2 üst üste doğru → bir üst seviyeye çık (zorlaştır)
        if(consecutiveRight>=2 && idx(curLevel)<LEVELS.length-1){
          curLevel = clampLevel(idx(curLevel)+1);
          consecutiveRight=0;
        }
      } else {
        consecutiveWrong++; consecutiveRight=0;
        // 2 üst üste yanlış → bir alt seviyeye in (kolaylaştır)
        if(consecutiveWrong>=2 && idx(curLevel)>0){
          curLevel = clampLevel(idx(curLevel)-1);
          consecutiveWrong=0;
        }
      }

      // bitiş koşulu
      if(qCount>=MAX_QUESTIONS) finished=true;
      else if(qCount>=MIN_QUESTIONS){
        // erken bitiş: son 4 cevap istikrarlıysa (hep doğru veya hep yanlış değil, kararlı seviye)
        var recent = history.slice(-4);
        var levelsSeen = {};
        recent.forEach(function(h){ levelsSeen[h.level]=1; });
        if(Object.keys(levelsSeen).length<=1) finished=true; // son 4 soru aynı seviyede → kararlı
      }

      var cur = current;
      current = null;
      return { correct:correct, correctIndex:cur.correctIndex, finished:finished };
    }

    function result(){
      // en çok ve en kararlı doğru cevaplanan seviyeyi bul
      // strateji: history'de doğru cevapların en yüksek seviyesi (art arda en az 1 doğru)
      var best = "A1";
      // her seviye için doğruluk oranı
      var scores = {};
      LEVELS.forEach(function(l){
        var v = levelVotes[l];
        if(v && (v.r+v.w)>0){ scores[l] = v.r/(v.r+v.w); }
      });
      // en yüksek seviyeden aşağı in: o seviyede yeterli doğru ve oran≥0.6 ise o seviyedir
      for(var i=LEVELS.length-1;i>=0;i--){
        var l=LEVELS[i], v=levelVotes[l];
        if(v && v.r>=2 && (v.r/(v.r+v.w))>=0.6){ best=l; break; }
        // tek soru sorulduysa daha esnek (oran≥0.5)
        if(v && v.r>=1 && (v.r+v.w)===1){ best=l; break; }
      }
      // güven: o seviyedeki cevap sayısı + tutarlılık
      var bv = levelVotes[best] || {r:0,w:0};
      var total = bv.r+bv.w;
      var confidence = total>0 ? Math.round(100*bv.r/total) : 50;
      return { level:best, confidence:confidence, history:history, votes:levelVotes, questionCount:qCount };
    }

    return {
      next: next,
      answer: answer,
      done: function(){ return finished; },
      result: result,
      get current(){ return current; },
      get count(){ return qCount; },
      maxQuestions: MAX_QUESTIONS
    };
  }

  global.DHLevelTest = { create: create, LEVELS: LEVELS };
})(window);
