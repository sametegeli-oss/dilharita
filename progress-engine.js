/* progress-engine.js
   Dil Harita — ORTAK İLERLEME MOTORU (tüm modüller)

   AMAÇ: Phrasal verb, cümle, kelime, video, chat… tüm öğrenilebilir
   öğeler için TEK bir "öğrenme durumu" katmanı. Her modül aynı API'yi
   kullanır; harita sayfası tek motordan beslenir.

   ÖĞE KİMLİĞİ:  "tür:kimlik"
     sentence:A1-M01-P1-001
     pv:give up
     word:abandon
     video:<id>   (opsiyonel)

   DURUMLAR:
     0 = new       (hiç çalışılmadı)
     1 = learning  (çalışılıyor)
     2 = learned   (öğrenildi)

   DEPOLAMA:
     - Kendi katmanı: IndexedDB "sentence-mode"/"kv", prefix "prog:"
       (mevcut srs: verisini BOZMAZ, ayrı anahtar uzayı)
     - CÜMLELER için durum, mevcut "srs:" SM-2 verisinden OTOMATİK
       türetilir (rep>=4 → learned, rep>=1 → learning). Böylece cümle
       ilerlemesi çift sayılmaz; mevcut çalışma motoruyla tutarlı kalır.
     - pv / word / video için durum bu katmanda elle/pratikle yazılır.

   BULUT: prog: anahtarları da srsAll mantığıyla okunabilir; cloud-sync
     mevcut "kv" store'u senkronladığı için otomatik taşınır (aynı DB).

   BAĞIMLILIK: storage-bridge (opsiyonel), StudyTracker (opsiyonel)
*/
(function(){
  "use strict";
  if (window.__dhProgressInstalled) return;
  window.__dhProgressInstalled = true;

  var DB_NAME="sentence-mode", STORE="kv";
  var PROG_PREFIX="prog:";     // ortak ilerleme
  var SRS_PREFIX="srs:";       // mevcut cümle SM-2 (sadece OKUNUR)

  // ---- Durum sabitleri ----
  var NEW=0, LEARNING=1, LEARNED=2;

  // ---- IndexedDB ----
  var _db=null;
  function openDB(){
    if(_db) return Promise.resolve(_db);
    return new Promise(function(res,rej){
      if(!("indexedDB" in window)) return rej("no-idb");
      var r=indexedDB.open(DB_NAME,1);
      r.onupgradeneeded=function(){ var db=r.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); };
      r.onsuccess=function(){ _db=r.result; res(_db); };
      r.onerror=function(){ rej(r.error); };
    });
  }
  function kvGet(key){
    return openDB().then(function(db){
      return new Promise(function(res,rej){
        var rq=db.transaction(STORE,"readonly").objectStore(STORE).get(key);
        rq.onsuccess=function(){ res(rq.result||null); };
        rq.onerror=function(){ rej(rq.error); };
      });
    }).catch(function(){
      try{ return JSON.parse(localStorage.getItem(key)||"null"); }catch(e){ return null; }
    });
  }
  function kvSet(key,val){
    return openDB().then(function(db){
      return new Promise(function(res,rej){
        var rq=db.transaction(STORE,"readwrite").objectStore(STORE).put(val,key);
        rq.onsuccess=function(){ res(true); };
        rq.onerror=function(){ rej(rq.error); };
      });
    }).catch(function(){
      try{ localStorage.setItem(key,JSON.stringify(val)); return true; }catch(e){ return false; }
    });
  }
  function kvAll(prefix){
    return openDB().then(function(db){
      return new Promise(function(res,rej){
        var store=db.transaction(STORE,"readonly").objectStore(STORE);
        var out={};
        var rq=store.openCursor();
        rq.onsuccess=function(){
          var c=rq.result;
          if(c){
            if(typeof c.key==="string" && c.key.indexOf(prefix)===0) out[c.key.slice(prefix.length)]=c.value;
            c.continue();
          } else res(out);
        };
        rq.onerror=function(){ rej(rq.error); };
      });
    }).catch(function(){
      var out={};
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k && k.indexOf(prefix)===0){ try{ out[k.slice(prefix.length)]=JSON.parse(localStorage.getItem(k)); }catch(e){} }
      }
      return out;
    });
  }

  // ---- srs kaydından durum türet (cümleler) ----
  function srsToStatus(rec){
    if(!rec) return NEW;
    var rep=rec.rep||0;
    if(rep>=4) return LEARNED;
    if(rep>=1) return LEARNING;
    // hiç tekrar yok ama kayıt varsa: en azından görülmüş
    return (rec.last||rec.due) ? LEARNING : NEW;
  }

  // ---- Öğe id ayrıştır ----
  function parse(itemId){
    var i=itemId.indexOf(":");
    if(i<0) return { type:"misc", id:itemId };
    return { type:itemId.slice(0,i), id:itemId.slice(i+1) };
  }

  // ---- Tek öğenin durumunu getir ----
  function getStatus(itemId){
    var p=parse(itemId);
    if(p.type==="sentence"){
      // önce prog: katmanına bak (elle işaret), yoksa srs'ten türet
      return kvGet(PROG_PREFIX+itemId).then(function(prog){
        if(prog && typeof prog.status==="number") return prog.status;
        return kvGet(SRS_PREFIX+p.id).then(function(srs){ return srsToStatus(srs); });
      });
    }
    return kvGet(PROG_PREFIX+itemId).then(function(prog){
      return (prog && typeof prog.status==="number") ? prog.status : NEW;
    });
  }

  // ---- Durum yaz ----
  function setStatus(itemId, status){
    var rec={ status:status, updated:Date.now() };
    return kvSet(PROG_PREFIX+itemId, rec).then(function(){
      mirrorSoon();
      try{ window.dispatchEvent(new CustomEvent("dh-progress-changed",{detail:{itemId:itemId,status:status}})); }catch(e){}
      return rec;
    });
  }

  // ---- Pratikten otomatik güncelle (doğru/yanlış) ----
  // Doğru bilince: new→learning→learned (üst üste doğruyla ilerler)
  // Yanlış: learned→learning'e düşürür (unutma sinyali)
  function recordResult(itemId, correct){
    return kvGet(PROG_PREFIX+itemId).then(function(prog){
      var streak=(prog && prog.streak)||0;
      var status=(prog && typeof prog.status==="number")?prog.status:NEW;
      if(correct){
        streak=streak+1;
        if(streak>=3) status=LEARNED;
        else if(status<LEARNING) status=LEARNING;
        else if(status===LEARNING && streak>=3) status=LEARNED;
      }else{
        streak=0;
        if(status===LEARNED) status=LEARNING; // düşür
        else status=LEARNING;
      }
      var rec={ status:status, streak:streak, updated:Date.now() };
      return kvSet(PROG_PREFIX+itemId, rec).then(function(){
        mirrorSoon();
        try{ window.dispatchEvent(new CustomEvent("dh-progress-changed",{detail:{itemId:itemId,status:status}})); }catch(e){}
        return rec;
      });
    });
  }

  // ---- Bir türün tüm durumlarını getir ----
  // sentences için srs: ile birleştirir.
  function getAllForType(type){
    return kvAll(PROG_PREFIX).then(function(prog){
      var result={}; // id -> status
      // prog: katmanındaki bu türe ait kayıtlar
      for(var key in prog){
        var p=parse(key);
        if(p.type===type && prog[key] && typeof prog[key].status==="number"){
          result[p.id]=prog[key].status;
        }
      }
      if(type!=="sentence") return result;
      // sentences: srs verisini de kat (prog'da olmayanları türet)
      return kvAll(SRS_PREFIX).then(function(srs){
        for(var sid in srs){
          if(!(sid in result)){
            var st=srsToStatus(srs[sid]);
            if(st>NEW) result[sid]=st;
          }
        }
        return result;
      });
    });
  }

  // ---- Tür bazında özet sayım ----
  // total: o türdeki toplam öğe sayısı (modül verir; bilinmiyorsa null)
  function summary(type, total){
    return getAllForType(type).then(function(map){
      var learning=0, learned=0;
      for(var id in map){
        if(map[id]===LEARNED) learned++;
        else if(map[id]===LEARNING) learning++;
      }
      var touched=learning+learned;
      var t=(typeof total==="number" && total>0)?total:touched;
      return {
        type:type,
        total:t,
        learned:learned,
        learning:learning,
        new:Math.max(0, t-touched),
        pct: t? Math.round(100*learned/t) : 0
      };
    });
  }

  // ---- Toplu özet (birden çok tür) ----
  // spec: {sentence:9417, pv:881, word:10679, ...}
  function summaryAll(spec){
    spec=spec||{};
    var types=Object.keys(spec);
    return Promise.all(types.map(function(t){ return summary(t, spec[t]); }))
      .then(function(arr){
        var out={}; var grand={total:0,learned:0,learning:0,new:0};
        arr.forEach(function(s){
          out[s.type]=s;
          grand.total+=s.total; grand.learned+=s.learned;
          grand.learning+=s.learning; grand.new+=s.new;
        });
        grand.pct = grand.total? Math.round(100*grand.learned/grand.total) : 0;
        out._grand=grand;
        return out;
      });
  }

  // ============================================================
  //  BULUT SENKRON KÖPRÜSÜ
  //  prog: verisi IndexedDB'de durur; cloud-sync localStorage'ı
  //  senkronladığı için durumu bir localStorage anahtarına
  //  ("dh-progress-mirror-v1") yansıtırız. Diğer cihazda bu ayna
  //  geri IndexedDB'ye uygulanır. Son-yazan-kazanır (updated'a göre).
  // ============================================================
  var MIRROR_KEY = "dh-progress-mirror-v1";
  var _mirrorTimer = null;

  function mirrorSoon(){
    if(_mirrorTimer) clearTimeout(_mirrorTimer);
    _mirrorTimer = setTimeout(mirrorNow, 800);
  }
  function mirrorNow(){
    return kvAll(PROG_PREFIX).then(function(prog){
      // {itemId: {status, streak?, updated}} → kompakt {itemId:[status,updated]}
      var compact={};
      for(var key in prog){
        var r=prog[key];
        if(r && typeof r.status==="number"){ compact[key]=[r.status, r.updated||0]; }
      }
      try{
        localStorage.setItem(MIRROR_KEY, JSON.stringify(compact));
        localStorage.setItem("__ts_"+MIRROR_KEY, String(Date.now()));
      }catch(e){}
    }).catch(function(){});
  }

  // localStorage aynasından IndexedDB'ye geri uygula (senkron sonrası çağrılır)
  function applyMirror(){
    var raw;
    try{ raw = localStorage.getItem(MIRROR_KEY); }catch(e){ raw=null; }
    if(!raw) return Promise.resolve(0);
    var compact;
    try{ compact = JSON.parse(raw); }catch(e){ return Promise.resolve(0); }
    return kvAll(PROG_PREFIX).then(function(local){
      var jobs=[]; var applied=0;
      for(var key in compact){
        var rStatus=compact[key][0], rUpdated=compact[key][1]||0;
        var lr=local[key];
        var lUpdated=(lr && lr.updated)||0;
        // uzak daha yeniyse veya yerelde yoksa uygula
        if(!lr || rUpdated>lUpdated){
          jobs.push(kvSet(PROG_PREFIX+key, { status:rStatus, updated:rUpdated }));
          applied++;
        }
      }
      return Promise.all(jobs).then(function(){
        if(applied){ try{ window.dispatchEvent(new CustomEvent("dh-progress-changed",{detail:{bulk:true}})); }catch(e){} }
        return applied;
      });
    });
  }

  // ---- Dışa açılan API ----
  window.DHProgress = {
    NEW:NEW, LEARNING:LEARNING, LEARNED:LEARNED,
    getStatus: getStatus,
    setStatus: setStatus,
    recordResult: recordResult,
    getAllForType: getAllForType,
    summary: summary,
    summaryAll: summaryAll,
    // yardımcılar
    id: function(type, id){ return type+":"+id; },
    parse: parse,
    // bulut senkron köprüsü
    mirrorNow: mirrorNow,
    applyMirror: applyMirror,
    MIRROR_KEY: MIRROR_KEY
  };

  // sayfa açılışında: aynayı IndexedDB'ye uygula (senkronla gelen veriyi yansıt)
  function bootMirror(){
    try{ applyMirror(); }catch(e){}
  }
  if(window.__dhStorageReady){ setTimeout(bootMirror, 600); }
  else{ window.addEventListener("dh-storage-ready", function(){ setTimeout(bootMirror, 600); }, {once:true}); setTimeout(bootMirror, 1800); }
})();
