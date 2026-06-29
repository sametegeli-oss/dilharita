/* mastery-engine.js — MASTERY ENGINE (Öğrenme Aşamaları)
   Dil Harita — Aşama 2.5. Uygulamanın kalbi.

   Her öğe (kelime/öbek/gramer/cümle) için 5 BECERİ skoru tutar (0-100):
     tanima    (recognition) : gördü, seçebiliyor mu?
     dinleme   (listening)   : duyunca anlıyor mu?
     hatirlama (recall)      : Türkçesi verilince üretebiliyor mu?
     uretim    (production)  : kendi cümlesinde kullanabiliyor mu?
     akicilik  (fluency)     : konuşmada/serbest kullanabiliyor mu?

   MİMARİ (Evidence → Mastery):
   - Her aktivite önce KANIT olarak kaydedilir (ham olay: hangi öğe, hangi beceri,
     doğru mu, ne zaman). Skorlar kanıtlardan TÜRETİLİR.
   - Böylece puanlama algoritması sonra değiştirilebilir, eski kanıt kaybolmaz.

   PUAN ÖĞRETMENE AİT, ÖĞRENCİYE ETİKET:
   - Öğrenci sayı görmez. Etiket görür: Hazır değil / Başlıyor / Öğreniyor /
     Pekişiyor / Ustalaştı.

   DHProgress'i BOZMAZ — onunla yan yana çalışır, ayrı saklanır (mas: prefix).

   API:
     DHMastery.record(itemId, skill, correct, opts)  // kanıt ekle + skor güncelle
     DHMastery.get(itemId)        // {tanima, dinleme, hatirlama, uretim, akicilik, genel}
     DHMastery.label(itemId)      // öğrenciye gösterilecek etiket
     DHMastery.skillLabel(skor)   // bir skora etiket
     DHMastery.weakSkill(itemId)  // en zayıf beceri (öğretmen bir sonraki adımı seçer)
     DHMastery.summary()          // tüm öğeler özet
*/
(function(global){
  "use strict";
  if(global.DHMastery) return;

  var SKILLS = ["tanima","dinleme","hatirlama","uretim","akicilik"];
  // Beceri ağırlıkları (genel skor için): üretim/akıcılık daha değerli
  var SKILL_WEIGHT = { tanima:1, dinleme:1.1, hatirlama:1.3, uretim:1.6, akicilik:1.8 };

  var MAS_PREFIX = "mas:";   // mastery skorları
  var EV_PREFIX  = "ev:";    // evidence (ham kanıtlar)
  var EV_MAX = 50;           // öğe başına saklanacak en fazla kanıt

  // --- storage (DHProgress ile aynı kv deposu) ---
  function kvGet(key){
    return new Promise(function(res){
      try{
        var raw = localStorage.getItem(key);
        res(raw ? JSON.parse(raw) : null);
      }catch(e){ res(null); }
    });
  }
  function kvSet(key, val){
    return new Promise(function(res){
      try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
      res(val);
    });
  }
  function kvAll(prefix){
    return new Promise(function(res){
      var out={};
      try{
        for(var i=0;i<localStorage.length;i++){
          var k=localStorage.key(i);
          if(k && k.indexOf(prefix)===0){
            try{ out[k.slice(prefix.length)] = JSON.parse(localStorage.getItem(k)); }catch(e){}
          }
        }
      }catch(e){}
      res(out);
    });
  }

  // --- skor güncelleme: kanıtlardan üret ---
  // Her beceri için: son N kanıta bakıp ağırlıklı doğruluk oranı → 0-100
  function deriveScore(evList, skill){
    var rel = evList.filter(function(e){ return e.skill===skill; });
    if(!rel.length) return 0;
    // son kanıtlar daha ağırlıklı (yakın geçmiş daha önemli)
    var total=0, weight=0;
    rel.slice(-8).forEach(function(e, i, arr){
      var w = 1 + i*0.3; // sondakiler daha ağır
      total += (e.correct ? 100 : 0) * w;
      weight += w;
    });
    var base = weight ? (total/weight) : 0;
    // çok az kanıt varsa skoru tam güvenme (tavan düşür)
    var n = rel.length;
    var confidence = Math.min(1, n/3); // 3 kanıt = tam güven
    return Math.round(base * confidence);
  }

  function genel(scores){
    var total=0, weight=0;
    SKILLS.forEach(function(s){
      var w = SKILL_WEIGHT[s] || 1;
      total += (scores[s]||0) * w;
      weight += w;
    });
    return weight ? Math.round(total/weight) : 0;
  }

  // --- KANIT EKLE + SKOR GÜNCELLE ---
  // skill: SKILLS'ten biri; correct: bool; opts: {sure, ipucu, kaynak}
  function record(itemId, skill, correct, opts){
    if(SKILLS.indexOf(skill)<0) skill="tanima";
    opts = opts || {};
    var evKey = EV_PREFIX + itemId;
    return kvGet(evKey).then(function(evObj){
      var list = (evObj && evObj.list) || [];
      list.push({
        skill: skill,
        correct: !!correct,
        t: Date.now(),
        sure: opts.sure || null,
        ipucu: opts.ipucu || false,
        kaynak: opts.kaynak || ""
      });
      if(list.length>EV_MAX) list = list.slice(-EV_MAX);
      return kvSet(evKey, { list:list }).then(function(){
        // skorları yeniden türet
        var scores = {};
        SKILLS.forEach(function(s){ scores[s] = deriveScore(list, s); });
        scores.genel = genel(scores);
        scores.updated = Date.now();
        return kvSet(MAS_PREFIX+itemId, scores).then(function(){
          try{ window.dispatchEvent(new CustomEvent("dh-mastery-changed",{detail:{itemId:itemId,skill:skill}})); }catch(e){}
          return scores;
        });
      });
    });
  }

  // --- OKU ---
  function get(itemId){
    return kvGet(MAS_PREFIX+itemId).then(function(s){
      if(!s){
        var empty={updated:0,genel:0}; SKILLS.forEach(function(k){ empty[k]=0; });
        return empty;
      }
      return s;
    });
  }

  // bir skora öğrenci etiketi
  function skillLabel(score){
    if(score>=85) return "Ustalaştı";
    if(score>=65) return "Pekişiyor";
    if(score>=40) return "Öğreniyor";
    if(score>=15) return "Başlıyor";
    return "Hazır değil";
  }

  // öğenin genel etiketi
  function label(itemId){
    return get(itemId).then(function(s){ return skillLabel(s.genel||0); });
  }

  // en zayıf beceri (öğretmen sonraki adımı buradan seçer)
  // mantık: sıralı ilerleme — tanıma yoksa önce o, varsa hatırlama, sonra üretim...
  function weakSkill(itemId){
    return get(itemId).then(function(s){
      // bir önceki beceri yeterli (>=50) değilse, onu öne al
      for(var i=0;i<SKILLS.length;i++){
        var sk=SKILLS[i];
        if((s[sk]||0) < 50) return sk;
      }
      return "akicilik"; // hepsi iyiyse en üst beceri
    });
  }

  // tüm öğelerin özeti (öğretmen/karne için)
  function summary(){
    return kvAll(MAS_PREFIX).then(function(all){
      var items = Object.keys(all);
      var skillAvg = {}; SKILLS.forEach(function(s){ skillAvg[s]={sum:0,n:0}; });
      var labels = {"Hazır değil":0,"Başlıyor":0,"Öğreniyor":0,"Pekişiyor":0,"Ustalaştı":0};
      items.forEach(function(id){
        var s=all[id];
        SKILLS.forEach(function(sk){ if(typeof s[sk]==="number"){ skillAvg[sk].sum+=s[sk]; skillAvg[sk].n++; } });
        labels[skillLabel(s.genel||0)]++;
      });
      var avg={}; SKILLS.forEach(function(sk){ avg[sk] = skillAvg[sk].n ? Math.round(skillAvg[sk].sum/skillAvg[sk].n) : 0; });
      return { itemCount:items.length, skillAverages:avg, labelCounts:labels };
    });
  }

  global.DHMastery = {
    record: record,
    get: get,
    label: label,
    skillLabel: skillLabel,
    weakSkill: weakSkill,
    summary: summary,
    SKILLS: SKILLS,
    MAS_PREFIX: MAS_PREFIX,
    EV_PREFIX: EV_PREFIX
  };
})(window);
