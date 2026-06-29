/* module-score.js — MODÜL NOTLARI + SEVİYE NOTU
   Dil Harita — Madde 4 + 3: Modül notları birleşince gerçek seviye notu oluşur.

   - Her modül sınavı sonucu burada saklanır (modül notu 0-100 + tarih + beceri).
   - Tüm modül notlarından SEVİYE NOTU türetilir: hangi seviyenin modüllerini ne
     kadar geçtiğine bakar. Tek sınavdan değil, KANITLANMIŞ başarıdan seviye.
   - Gramer profili de modüllerden toplanır (konu konu başarı).

   Felsefe: Seviye testi "soğuk başlangıç" tahmini verir; ama gerçek seviye, modül
   notlarından sürekli güncellenir. 1 test yanılır, 30 modül yanılmaz.

   Saklama: localStorage (storage-bridge üzerinden), "modscore:" prefix.

   API:
     DHModuleScore.save(moduleId, level, score, detail)  // modül notu kaydet
     DHModuleScore.get(moduleId)        // bir modülün notu
     DHModuleScore.all()                // tüm modül notları
     DHModuleScore.levelScore()         // {level, score, breakdown} hesaplanmış seviye
     DHModuleScore.grammarProfile()     // {konu: yüzde} gramer profili
*/
(function(global){
  "use strict";
  if(global.DHModuleScore) return;

  var PREFIX = "modscore:";
  var GPREFIX = "gramprof:";  // gramer profili birikimi
  var LEVELS = ["A1","A2","B1","B2","C1"];
  var PASS = 70;  // bir modül "geçildi" sayılır eşiği

  function lvIndex(l){ var i=LEVELS.indexOf(l); return i<0?0:i; }

  function kvSet(key,val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){} }
  function kvGet(key){ try{ var r=localStorage.getItem(key); return r?JSON.parse(r):null; }catch(e){ return null; } }
  function kvAll(prefix){
    var out={};
    try{
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k && k.indexOf(prefix)===0){ try{ out[k.slice(prefix.length)]=JSON.parse(localStorage.getItem(k)); }catch(e){} }
      }
    }catch(e){}
    return out;
  }

  // modül notu kaydet — en yüksek not korunur (öğrenci tekrar girip yükseltebilir)
  function save(moduleId, level, score, detail){
    var prev = kvGet(PREFIX+moduleId);
    var best = prev && typeof prev.score==="number" ? Math.max(prev.score, score) : score;
    var rec = {
      level: level || (prev&&prev.level) || "",
      score: best,
      lastScore: score,
      attempts: (prev&&prev.attempts||0)+1,
      updated: Date.now(),
      bySkill: (detail&&detail.bySkill)||null
    };
    kvSet(PREFIX+moduleId, rec);
    // gramer profilini güncelle
    if(detail && detail.grammar){
      var gp = kvGet(GPREFIX+"all") || {};
      Object.keys(detail.grammar).forEach(function(konu){
        var v=detail.grammar[konu];
        gp[konu]=gp[konu]||{r:0,w:0};
        gp[konu].r += v.r||0; gp[konu].w += v.w||0;
      });
      kvSet(GPREFIX+"all", gp);
    }
    try{ window.dispatchEvent(new CustomEvent("dh-module-scored",{detail:{moduleId:moduleId,score:best}})); }catch(e){}
    return rec;
  }

  function get(moduleId){ return kvGet(PREFIX+moduleId); }
  function all(){ return kvAll(PREFIX); }

  // SEVİYE NOTU: modül notlarından türetilir
  // Mantık: her seviye için, o seviyenin geçilen modül oranı + ortalama notu.
  // Öğrencinin seviyesi = geçtiği en yüksek seviye (yeterli modülü ≥PASS geçmişse).
  function levelScore(){
    var scores = all();
    var byLevel = {}; LEVELS.forEach(function(l){ byLevel[l]={passed:0,count:0,sum:0}; });
    Object.keys(scores).forEach(function(mid){
      var rec=scores[mid];
      var lv=rec.level;
      if(!lv || !byLevel[lv]) return;
      byLevel[lv].count++;
      byLevel[lv].sum += rec.score;
      if(rec.score>=PASS) byLevel[lv].passed++;
    });

    // En yüksek seviyeden aşağı: o seviyede en az 2 modül geçilmişse, seviye odur
    var level = null;
    for(var i=LEVELS.length-1;i>=0;i--){
      var l=LEVELS[i], b=byLevel[l];
      if(b.count>0 && b.passed>=2){ level=l; break; }
      if(b.count>0 && b.passed>=1 && b.count<=2){ level=l; break; } // az modül varsa 1 yeterli
    }

    var breakdown = {};
    LEVELS.forEach(function(l){
      var b=byLevel[l];
      breakdown[l] = { modules:b.count, passed:b.passed, avg: b.count?Math.round(b.sum/b.count):0 };
    });

    return { level: level, breakdown: breakdown };
  }

  // gramer profili: konu konu başarı yüzdesi
  function grammarProfile(){
    var gp = kvGet(GPREFIX+"all") || {};
    var out = {};
    Object.keys(gp).forEach(function(konu){
      var v=gp[konu], total=v.r+v.w;
      if(total>0) out[konu] = Math.round(100*v.r/total);
    });
    return out;
  }

  global.DHModuleScore = {
    save: save, get: get, all: all,
    levelScore: levelScore, grammarProfile: grammarProfile,
    PASS: PASS, LEVELS: LEVELS
  };
})(window);
