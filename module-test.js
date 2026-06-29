/* module-test.js — MODÜL SONU İNTERAKTİF SINAV
   Dil Harita — Madde 4: Modül bitince o modülün yapılarını bir arada kullandıran
   sınav. Sonuç = MODÜL NOTU. Modül notları birleşince = SEVİYE NOTU.

   Bir modüldeki cümlelerden çok becerili sorular üretir (seviye testiyle aynı türler:
   tanıma / dinleme / gramer / sıralama / yazma). Her soru o modülün gerçek
   içeriğinden gelir — yani modülü öğrendiyse geçer.

   Sonuç:
   - Modül notu (0-100) → DHModuleScore'a kaydedilir
   - Her sorunun becerisi Mastery'ye kanıt olarak yazılır
   - Gramer alt-konu başarısı ayrı tutulur (gramer profili)

   API:
     var t = DHModuleTest.create(moduleSentences, {count:8});
     t.next(); t.answer(payload); t.done(); t.result();
*/
(function(global){
  "use strict";

  function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i];a[i]=a[j];a[j]=t; } return a; }
  function norm(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9'\s]/g," ").replace(/\s+/g," ").trim(); }
  function wordsOf(str){ return String(str||"").toLowerCase().replace(/[.,!?;:]/g," ").split(/\s+/).filter(Boolean); }

  var STOP = {"the":1,"a":1,"an":1,"is":1,"are":1,"was":1,"were":1,"to":1,"of":1,"in":1,"on":1,"at":1,"for":1,"and":1,"or":1,"i":1,"you":1,"he":1,"she":1,"it":1,"we":1,"they":1,"has":1,"have":1,"had":1,"will":1,"my":1,"your":1,"this":1,"that":1};
  function contentWords(str){ return wordsOf(str).filter(function(w){ return !STOP[w]; }); }
  function subjectOf(str){
    var w=wordsOf(str); if(!w.length) return "";
    var first=w[0];
    if((first==="the"||first==="a"||first==="an") && w[1]) return first+" "+w[1];
    return first;
  }
  function similarity(a, b){
    var aw=contentWords(a), bw=contentWords(b), bset={};
    bw.forEach(function(w){ bset[w]=1; });
    var common=0; aw.forEach(function(w){ if(bset[w]) common++; });
    var lenDiff=Math.abs(wordsOf(a).length-wordsOf(b).length);
    var subjScore = (subjectOf(a)===subjectOf(b)) ? 5 : 0;
    return common*1.5 + Math.max(0,4-lenDiff) + subjScore;
  }

  // soru türleri — modül sınavında dengeli dağılım
  var TYPE_CYCLE = ["tanima","gramer","siralama","dinleme","yazma","tanima","gramer","siralama"];

  function create(moduleSentences, opts){
    opts = opts || {};
    var pool = (moduleSentences||[]).filter(function(s){ return s && s.en && s.tr; });
    var COUNT = Math.min(opts.count || 8, pool.length);
    if(COUNT<3) COUNT = Math.min(pool.length, 3);

    var asked=[], history=[], qCount=0, current=null, finished=false;
    var grammarVotes={};  // {gramerKonusu:{r,w}} — gramer profili

    function pick(type){
      var avail = pool.filter(function(s){
        if(asked.indexOf(s.en)>=0) return false;
        var wc=s.en.split(/\s+/).length;
        if((type==="siralama"||type==="yazma")&&(wc<3||wc>8)) return false;
        if((type==="tanima"||type==="dinleme")&&wc>12) return false;
        return true;
      });
      if(!avail.length) avail = pool.filter(function(s){ return asked.indexOf(s.en)<0; });
      if(!avail.length) avail = pool;
      return avail[Math.floor(Math.random()*avail.length)];
    }

    function distractors(correct){
      // önce modül içinden benzer + AYNI ÖZNELİ, yetmezse genel benzer
      var corSubj=subjectOf(correct.en);
      var others = pool.filter(function(s){ return s.en!==correct.en; });
      var scored = others.map(function(s){ return {en:s.en, sim:similarity(correct.en,s.en), sameSubj:(subjectOf(s.en)===corSubj)}; }).sort(function(a,b){ return b.sim-a.sim; });
      var same = scored.filter(function(x){ return x.sameSubj; });
      var src = (same.length>=3 ? same : scored);
      var picked=[], seen={};
      shuffle(src.slice(0,10)).forEach(function(x){ if(picked.length<3 && !seen[x.en]){ seen[x.en]=1; picked.push(x.en); } });
      var i=0; while(picked.length<3 && i<scored.length){ if(!seen[scored[i].en]){ seen[scored[i].en]=1; picked.push(scored[i].en); } i++; }
      return picked;
    }

    function build(type, s){
      var q={ type:type, en:s.en, tr:s.tr, grammar:s.grammar||"" };
      if(type==="tanima"||type==="dinleme"){
        var opts2=shuffle(distractors(s).concat([s.en]));
        q.options=opts2; q.correctIndex=opts2.indexOf(s.en);
        q.prompt=(type==="dinleme")?"Duyduğun cümle hangisi?":"Bu cümlenin İngilizcesi hangisi?";
        q.speak=(type==="dinleme")?s.en:null;
        if(type==="dinleme") q.tr=null;
      } else if(type==="siralama"){
        q.words=shuffle(s.en.replace(/\s+/g," ").trim().split(" ")); q.answer=s.en;
        q.prompt="Kelimeleri doğru sıraya diz:";
      } else if(type==="yazma"){
        q.prompt="Bu cümleyi İngilizce yaz:"; q.answer=s.en;
      } else if(type==="gramer"){
        var ws=s.en.split(" ");
        var pos=ws.length>=4?1+Math.floor(Math.random()*(ws.length-2)):Math.floor(ws.length/2);
        var ans=ws[pos].replace(/[.,!?]/g,"");
        var disp=ws.slice(); disp[pos]="_____";
        var cand={}; pool.forEach(function(o){ o.en.split(" ").forEach(function(w){ var ww=w.replace(/[.,!?]/g,"").toLowerCase(); if(ww&&ww!==ans.toLowerCase()&&ww.length>1) cand[ww]=1; }); });
        var ds=shuffle(Object.keys(cand)).slice(0,3);
        var fb=["is","are","the","to","do","have"]; var fi=0; while(ds.length<3&&fi<fb.length){ if(ds.indexOf(fb[fi])<0)ds.push(fb[fi]); fi++; }
        var go=shuffle(ds.concat([ans]));
        q.options=go; q.correctIndex=go.indexOf(ans); q.display=disp.join(" "); q.prompt="Boşluğa hangi kelime gelir?"; q.tr=s.tr;
      }
      return q;
    }

    function next(){
      if(finished) return null;
      var type=TYPE_CYCLE[qCount % TYPE_CYCLE.length];
      var s=pick(type);
      if(!s){ finished=true; return null; }
      asked.push(s.en);
      current=build(type,s); qCount++;
      return current;
    }

    function answer(payload){
      if(!current||finished) return null;
      var correct=false;
      if(current.type==="tanima"||current.type==="dinleme"||current.type==="gramer"){
        correct=(payload && payload.index===current.correctIndex);
      } else if(current.type==="siralama"){
        correct=(norm(payload&&payload.text)===norm(current.answer));
      } else if(current.type==="yazma"){
        if(payload && typeof payload.correct==="boolean") correct=payload.correct;
        else correct=(norm(payload&&payload.text)===norm(current.answer));
      }
      history.push({type:current.type, correct:correct, grammar:current.grammar});
      // gramer profili
      if(current.grammar){
        grammarVotes[current.grammar]=grammarVotes[current.grammar]||{r:0,w:0};
        correct?grammarVotes[current.grammar].r++:grammarVotes[current.grammar].w++;
      }
      if(qCount>=COUNT) finished=true;
      var cur=current; current=null;
      var out={correct:correct, finished:finished, type:cur.type};
      if(cur.type==="tanima"||cur.type==="dinleme"||cur.type==="gramer") out.correctIndex=cur.correctIndex;
      if(cur.type==="siralama"||cur.type==="yazma") out.answer=cur.answer;
      out.en=cur.en;
      return out;
    }

    function result(){
      var r=history.filter(function(h){ return h.correct; }).length;
      var total=history.length||1;
      var score=Math.round(100*r/total);
      // beceri kırılımı
      var bySkill={};
      history.forEach(function(h){ bySkill[h.type]=bySkill[h.type]||{r:0,w:0}; h.correct?bySkill[h.type].r++:bySkill[h.type].w++; });
      return { score:score, correct:r, total:total, bySkill:bySkill, grammar:grammarVotes, history:history };
    }

    return {
      next:next, answer:answer,
      done:function(){ return finished; },
      result:result,
      get current(){ return current; },
      get count(){ return qCount; },
      total: COUNT
    };
  }

  global.DHModuleTest = { create: create };
})(window);
