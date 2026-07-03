/* cloud-sync.js
   Cihazlar arası senkron — mevcut "sentencemode" Firebase projesini kullanır.
*/
(function(){
  "use strict";
  if (window.__dhCloudSyncInstalled) return;
  window.__dhCloudSyncInstalled = true;

  // Orijinal localStorage tetikleyicisini güvenli senkron için sakla
  var rawLocalStorageSet = window.localStorage.setItem.bind(window.localStorage);

  // Senkronlanacak SABİT localStorage anahtarları
  var LS_KEYS = [
    "dh_ai_prompt_teacher", "dh-study-tracker-v1", "dh-ocr-sentences-v1",
    "dh-teacher-policy-v1", "dh-notif-settings-v1", "dh-progress-mirror-v1",
    "groqApiKeys", "cerebrasApiKeys", "geminiApiKeys",
    "dh-model-groq", "dh-model-cerebras", "dh-model-gemini", "dh-disabled-keys",
    "selectedTeacherAvatar"
  ];

  // Senkronlanacak PREFIX'li anahtarlar
  var LS_PREFIXES = [
    "mas:",        
    "ev:",         
    "modscore:",   
    "gramprof:",   
    "story:"       
  ];

  function mergeEvents(a, b){
    var all=(a||[]).concat(b||[]), seen={}, out=[];
    for(var i=0;i<all.length;i++){
      var k; try{ k=JSON.stringify(all[i]); }catch(e){ k=String(all[i]); }
      if(!seen[k]){ seen[k]=1; out.push(all[i]); }
    }
    return out.slice(-30);
  }

  function mergeStudyTracker(localStr, remoteStr){
    var L={}, R={};
    try{ L=JSON.parse(localStr||"{}")||{}; }catch(e){}
    try{ R=JSON.parse(remoteStr||"{}")||{}; }catch(e){}
    var out={};
    for(var k in R){ if(R.hasOwnProperty(k) && k!=="days") out[k]=R[k]; }
    for(var k2 in L){ if(L.hasOwnProperty(k2) && k2!=="days") out[k2]=L[k2]; }
    var ld=(L.days)||{}, rd=(R.days)||{}, days={}, allKeys={};
    for(var d1 in ld){ if(ld.hasOwnProperty(d1)) allKeys[d1]=1; }
    for(var d2 in rd){ if(rd.hasOwnProperty(d2)) allKeys[d2]=1; }
    for(var day in allKeys){
      var a=ld[day], b=rd[day];
      if(a && b){
        days[day]={ date:day,
          lessons:Math.max(a.lessons||0,b.lessons||0),
          minutes:Math.max(a.minutes||0,b.minutes||0),
          sentences:Math.max(a.sentences||0,b.sentences||0),
          videos:Math.max(a.videos||0,b.videos||0),
          reviews:Math.max(a.reviews||0,b.reviews||0),
          errors:Math.max(a.errors||0,b.errors||0),
          events:mergeEvents(a.events, b.events) };
      } else { days[day]= a || b; }
    }
    out.days=days;
    return JSON.stringify(out);
  }

  function mergeProgressMirror(localStr, remoteStr){
    var L={}, R={};
    try{ L=JSON.parse(localStr||"{}")||{}; }catch(e){}
    try{ R=JSON.parse(remoteStr||"{}")||{}; }catch(e){}
    var out={};
    for(var k in L){ if(L.hasOwnProperty(k)) out[k]=L[k]; }
    for(var k2 in R){
      if(!R.hasOwnProperty(k2)) continue;
      var r=R[k2], l=out[k2];
      if(!l){ out[k2]=r; continue; }
      var lU=(l&&l[1])||0, rU=(r&&r[1])||0;
      if(rU>lU || (rU===lU && (r[0]||0)>(l[0]||0))) out[k2]=r;
    }
    return JSON.stringify(out);
  }

  function parseRemote(remote){
    var out = { ls: {}, ts: {}, errors: [] };
    if (!remote) return out;
    var d = remote.data && typeof remote.data === "object" ? remote.data : null;
    if (d && d.ls){ for (var k in d.ls){ if (d.ls.hasOwnProperty(k)) out.ls[k] = d.ls[k]; } }
    if (d && d.ts){ for (var tk in d.ts){ if (d.ts.hasOwnProperty(tk)) out.ts[tk] = d.ts[tk]; } }
    if (d && Array.isArray(d.errors)){ out.errors = out.errors.concat(d.errors); }
    for (var i=0;i<LS_KEYS.length;i++){
      var key = LS_KEYS[i];
      if (Object.prototype.hasOwnProperty.call(remote, key) && remote[key] != null){
        out.ls[key] = remote[key];
      }
    }
    if (remote.__ts && typeof remote.__ts === "object"){
      for (var tk2 in remote.__ts){ if (remote.__ts.hasOwnProperty(tk2)) out.ts[tk2] = remote.__ts[tk2]; }
    }
    if (remote.__bulk && typeof remote.__bulk === "object"){
      for (var bk in remote.__bulk){ if (remote.__bulk.hasOwnProperty(bk) && remote.__bulk[bk] != null) out.ls[bk] = remote.__bulk[bk]; }
    }
    if (Array.isArray(remote.__errors)) out.errors = out.errors.concat(remote.__errors);
    return out;
  }

  var firebaseConfig = {
    apiKey: "AIzaSyBZTHvP8xX94UMtKRt7hIYN7qpbO2gz0Zg",
    authDomain: "sentencemode.firebaseapp.com",
    projectId: "sentencemode",
    storageBucket: "sentencemode.firebasestorage.app",
    messagingSenderId: "1048475533632",
    appId: "1:1048475533632:web:3f719b6da4397ed7c53aa5"
  };

  var fb = null;        
  var user = null;      
  var authResolved = false;  
  var ready = false;
  var saveTimer = null;

  function initFirebase(){
    return Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js")
    ]).then(function(mods){
      var appMod = mods[0], authMod = mods[1], fsMod = mods[2];
      var app;
      try{
        var existing = appMod.getApps && appMod.getApps();
        app = (existing && existing.length) ? existing[0] : appMod.initializeApp(firebaseConfig);
      }catch(e){ app = appMod.initializeApp(firebaseConfig); }
      var auth = authMod.getAuth(app);
      var db = fsMod.getFirestore(app);
      try{
        if(authMod.setPersistence && authMod.browserLocalPersistence){
          authMod.setPersistence(auth, authMod.browserLocalPersistence);
        }
      }catch(e){}
      fb = {
        auth: auth, db: db,
        onAuth: function(cb){ return authMod.onAuthStateChanged(auth, cb); },
        signOut: function(){ try{ return authMod.signOut(auth); }catch(e){ return Promise.resolve(); } },
        loadSettings: function(uid){
          return fsMod.getDoc(fsMod.doc(db, "settings", uid)).then(function(snap){
            return snap.exists() ? snap.data() : null;
          });
        },
        saveSettings: function(uid, data){
          var doc2 = {}, bulk = {};
          if (data && data.ls){
            for (var k in data.ls){
              if (!data.ls.hasOwnProperty(k)) continue;
              if (k.indexOf(".")>=0 || k.indexOf("/")>=0 || k.indexOf("~")>=0 || k.indexOf("[")>=0 || k.indexOf("]")>=0 || k.indexOf("*")>=0){
                bulk[k] = data.ls[k];          
              } else {
                doc2[k] = data.ls[k];          
              }
            }
          }
          if (Object.keys(bulk).length) doc2.__bulk = bulk;
          if (data && data.ts){ doc2.__ts = data.ts; }
          if (data && data.errors){ doc2.__errors = data.errors; }
          doc2.updated_at = Date.now();
          return fsMod.setDoc(fsMod.doc(db, "settings", uid), doc2, { merge: true });
        }
      };
      ready = true;
      fb.onAuth(function(u){
        user = u ? { uid: u.uid } : null;
        authResolved = true;   
        if (user) initialSync();
      });
    }).catch(function(e){
      console.warn("cloud-sync: Firebase yüklenemedi, yerel modda devam.", e);
    });
  }

  function collectLocal(){
    var out = { ls: {}, errors: [] };
    for (var i=0;i<LS_KEYS.length;i++){
      try{ var v = localStorage.getItem(LS_KEYS[i]); if (v != null) out.ls[LS_KEYS[i]] = v; }catch(e){}
    }
    try{
      for (var j=0;j<localStorage.length;j++){
        var key = localStorage.key(j);
        if (!key) continue;
        for (var p=0;p<LS_PREFIXES.length;p++){
          if (key.indexOf(LS_PREFIXES[p]) === 0){
            try{ var vv = localStorage.getItem(key); if (vv != null) out.ls[key] = vv; }catch(e){}
            break;
          }
        }
      }
    }catch(e){}
    return out;
  }

  function getLocalErrors(){
    try{
      if (window.LearningErrorDB && window.LearningErrorDB.all) return window.LearningErrorDB.all();
    }catch(e){}
    return Promise.resolve([]);
  }
  
  function mergeRemoteErrors(remoteErrors){
    try{
      if (window.LearningErrorDB && window.LearningErrorDB.bulkMerge && Array.isArray(remoteErrors)){
        return window.LearningErrorDB.bulkMerge(remoteErrors);
      }
    }catch(e){}
    return Promise.resolve(0);
  }

  function initialSync(){
    waitForAuth(5000).then(function(){
      if (!ready || !user || !fb) return;
      fullSync().then(function(res){
        try{ if (window.__dhAutoSyncDone) window.__dhAutoSyncDone(res); }catch(e){}
      }).catch(function(){});
    });
  }

  function signOutAndPush(){
    return waitForAuth(3000).then(function(){
      var doPush = (ready && user && fb) ? pushNow() : Promise.resolve();
      return doPush.catch(function(){}).then(function(){
        return new Promise(function(res){ setTimeout(res, 600); });
      }).then(function(){
        try{ if (fb && fb.signOut) return fb.signOut(); }catch(e){}
      }).then(function(){
        try{
          localStorage.removeItem("dh_logged_in");
          localStorage.removeItem("dh_logged_uid");
          localStorage.removeItem("dh_logged_email");
        }catch(e){}
        return { ok:true };
      });
    });
  }

  function sanitizeStudyTracker(){
    try{
      var raw = localStorage.getItem("dh-study-tracker-v1");
      if(!raw || raw.length < 400000) return;   
      var d = JSON.parse(raw)||{};
      var days = d.days||{};
      for(var day in days){
        if(!days.hasOwnProperty(day)) continue;
        var ev = days[day] && days[day].events;
        if(ev && ev.length) days[day].events = mergeEvents(ev, []);
      }
      d.days = days;
      var out = JSON.stringify(d);
      if(out.length > 900000){
        for(var day2 in days){ if(days.hasOwnProperty(day2) && days[day2]) days[day2].events=[]; }
        out = JSON.stringify(d);
      }
      if(out.length >= raw.length) return;  
      localStorage.setItem("dh-study-tracker-v1", out);
    }catch(e){}
  }

  function pushNow(){
    sanitizeStudyTracker();
    if (!ready || !user || !fb) return Promise.resolve();
    var prep = (window.DHProgress && DHProgress.mirrorNow) ? DHProgress.mirrorNow() : Promise.resolve();
    return Promise.resolve(prep).then(function(){
      var local = collectLocal();
      var ts = {};
      for (var i=0;i<LS_KEYS.length;i++){ ts[LS_KEYS[i]] = localTs(LS_KEYS[i]); }
      return getLocalErrors().then(function(errors){
        var payload = {
          ls: local.ls,
          ts: ts,
          errors: Array.isArray(errors) ? errors.slice(0, 3000) : []
        };
        return fb.saveSettings(user.uid, payload);
      }).catch(function(e){ console.warn("cloud-sync yazma hata:", e); });
    });
  }

  function pushSoon(){
    if (!ready || !user) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushNow, 1500);
  }

  function hookLocalStorage(){
    try{
      var proto = window.localStorage;
      var origSet = proto.setItem.bind(proto);
      proto.setItem = function(k, v){
        origSet(k, v);
        var key=String(k);
        if (key.indexOf("__ts_") === 0) return;
        var match = (LS_KEYS.indexOf(key) >= 0);
        if(!match){ for(var p=0;p<LS_PREFIXES.length;p++){ if(key.indexOf(LS_PREFIXES[p])===0){ match=true; break; } } }
        if (match){
          try{ origSet("__ts_" + key, String(Date.now())); }catch(e){}
          pushSoon();
        }
      };
    }catch(e){}
  }

  function localTs(k){
    try{ return parseInt(localStorage.getItem("__ts_" + k) || "0", 10) || 0; }catch(e){ return 0; }
  }

  window.addEventListener("learning-error-added", pushSoon);
  window.addEventListener("learning-errors-cleared", pushSoon);

  function flushOnLeave(){
    try{
      if(window.__dhStorageFlush) window.__dhStorageFlush();
    }catch(e){}
    try{ clearTimeout(saveTimer); }catch(e){}
    pushNow();
  }
  window.addEventListener("pagehide", flushOnLeave);
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState==="hidden") flushOnLeave();
  });

  function start(){
    hookLocalStorage();
    initFirebase();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  function fullSync(){
    if (!ready) return Promise.resolve({ ok:false, message:"Bulut bağlantısı henüz hazır değil. Birkaç saniye sonra tekrar dene." });
    return waitForAuth(4000).then(function(){
      if (!user) return { ok:false, message:"Senkron için önce giriş yapmalısın." };
      return fb.loadSettings(user.uid).then(function(remote){
        var rd = parseRemote(remote);
        var pulled = 0;
        var nowTs = String(Date.now());

        if (rd.ls){
          for (var rk in rd.ls){
            if (!rd.ls.hasOwnProperty(rk)) continue;
            var rv = rd.ls[rk];
            if (rv == null || rv === "") continue;
            
            var ok = (LS_KEYS.indexOf(rk) >= 0);
            if (!ok){ for (var pp=0; pp<LS_PREFIXES.length; pp++){ if (rk.indexOf(LS_PREFIXES[pp])===0){ ok=true; break; } } }
            if (!ok) continue;

            try{
              var localVal = localStorage.getItem(rk);
              var lTs = localTs(rk);
              var rTs = (rd.ts && rd.ts[rk]) ? parseInt(rd.ts[rk], 10) : 0;

              if (localVal == null || localVal === "" || localVal === "[]" || rTs > lTs) {
                if (rk === "dh-study-tracker-v1"){
                  rawLocalStorageSet(rk, mergeStudyTracker(localVal, rv));
                } else if (rk === "dh-progress-mirror-v1"){
                  rawLocalStorageSet(rk, mergeProgressMirror(localVal, rv));
                } else {
                  rawLocalStorageSet(rk, rv);
                }
                rawLocalStorageSet("__ts_" + rk, String(Math.max(rTs, parseInt(nowTs, 10))));
                pulled++;
              }
            }catch(e){ console.error("Key sync error: " + rk, e); }
          }
        }

        return mergeRemoteErrors(rd.errors || []).then(function(addedErr){
          var flushP = (window.__dhStorageFlush) ? Promise.resolve(window.__dhStorageFlush()).catch(function(){}) : Promise.resolve();
          return flushP.then(function(){
            var progP = (window.DHProgress && DHProgress.applyMirror) ? DHProgress.applyMirror() : Promise.resolve(0);
            return progP.then(function(addedProg){
              try{ if(window.__dhStorageFlush) window.__dhStorageFlush(); }catch(e){}
              
              return pushNow().catch(function(){}).then(function(){
                return { ok:true, pulled:pulled, addedErrors:addedErr||0, addedProgress:addedProg||0 };
              });
            });
          });
        });
      }).then(function(res){
        var parts = [];
        if (res.pulled) parts.push(res.pulled + " ayar buluttan alındı");
        if (res.addedErrors) parts.push(res.addedErrors + " hata kaydı eklendi");
        if (!parts.length) parts.push("bulutta veri yok veya zaten güncel");
        return { ok:true, message:"✓ Bulutla senkronizasyon sağlandı. " + parts.join(", ") + "." };
      }).catch(function(e){
        var msg = (e && e.message) ? e.message : "bağlantı hatası";
        if (/permission/i.test(msg)) msg = "İzin hatası (Firebase kuralı). Lütfen tekrar dene.";
        return { ok:false, message:"Senkron başarısız: " + msg };
      });
    });
  }

  function pull(key){
    if (!ready || !user || !fb) return Promise.reject(new Error("Bulut hazır değil veya giriş yok"));
    return fb.loadSettings(user.uid).then(function(remote){
      var rd = parseRemote(remote);
      if (rd.ls && Object.prototype.hasOwnProperty.call(rd.ls, key)) return rd.ls[key];
      return null;
    });
  }

  window.DHCloudSync = { push: pushNow, sync: initialSync, pull: pull, fullSync: fullSync, signOut: signOutAndPush, get ready(){ return ready; }, get user(){ return user; } };
})();