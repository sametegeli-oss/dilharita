/* cloud-sync.js — v7 (SIFIRDAN TEMİZ TASARIM)
   ═══════════════════════════════════════════════════════════════
   MİMARİ (tek akış):
     AÇILIŞ  → fullSync: buluttan ÇEK → BİRLEŞTİR → cihaza UYGULA → buluta GERİ YAZ
     ÇALIŞMA → veri değişince 1.5 sn sonra otomatik push (debounce)
     ÇIKIŞ   → ekrandan ayrılırken push (pagehide) · "Çıkış Yap" → push + signOut

   VERİ KAYNAKLARI (bu oturumda kanıtlanmış):
     1) localStorage        : ayarlar, API anahtarları, aktif günler, kelime AYNASI
     2) IndexedDB sentence-mode/kv : React modül ilerlemesi (img:* hariç, HAM anahtarlar)
                              → buluta "smv:"+anahtar olarak gider/gelir
     3) DHProgress (kendi IDB'si)  : kelime/cümle durumu — AYNA üzerinden
                              (mirrorNow: IDB→localStorage, applyMirror: localStorage→IDB)
     4) LearningErrorDB     : hata defteri (all / bulkMerge)

   BİRLEŞTİRME KURALLARI:
     dh-study-tracker-v1    → günler birleşir (union), sayaçlarda büyük kazanır,
                              olaylar tekrarsız + gün başına ≤30 (1MB koruması)
     dh-progress-mirror-v1  → kayıt başına "daha yeni / daha ileri" kazanır
     smv:* ve diğerleri     → bulut kazanır; geri-yazma ile bulut = iki cihazın birleşimi
   ═══════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  if (window.__dhCloudSyncInstalled) return;
  window.__dhCloudSyncInstalled = true;

  /* ── 1) SABİTLER ─────────────────────────────────────────── */
  var LS_KEYS = [
    "dh_ai_prompt_teacher", "dh-study-tracker-v1", "dh-ocr-sentences-v1",
    "dh-teacher-policy-v1", "dh-notif-settings-v1", "dh-progress-mirror-v1",
    "groqApiKeys", "cerebrasApiKeys", "geminiApiKeys",
    "dh-model-groq", "dh-model-cerebras", "dh-model-gemini", "dh-disabled-keys",
    "selectedTeacherAvatar", "dh-teacher-mem"
  ];
  var LS_PREFIXES = ["sm:", "mas:", "ev:", "modscore:", "gramprof:", "story:"];
  var MAX_VAL = 200000;      // alan başına üst sınır (Firestore alan limiti 1MB)
  var TRACKER = "dh-study-tracker-v1";
  var MIRROR  = "dh-progress-mirror-v1";

  var firebaseConfig = {
    apiKey: "AIzaSyBZTHvP8xX94UMtKRt7hIYN7qpbO2gz0Zg",
    authDomain: "sentencemode.firebaseapp.com",
    projectId: "sentencemode",
    storageBucket: "sentencemode.firebasestorage.app",
    messagingSenderId: "1048475533632",
    appId: "1:1048475533632:web:3f719b6da4397ed7c53aa5"
  };

  var fb=null, user=null, ready=false, authResolved=false, saveTimer=null, syncing=false;

  /* ── 2) BİRLEŞTİRME (saf fonksiyonlar) ───────────────────── */
  function mergeEvents(a,b){
    var all=(a||[]).concat(b||[]), seen={}, out=[];
    for(var i=0;i<all.length;i++){
      var k; try{ k=JSON.stringify(all[i]); }catch(e){ k=String(all[i]); }
      if(!seen[k]){ seen[k]=1; out.push(all[i]); }
    }
    return out.slice(-30);
  }
  function mergeTracker(localStr, remoteStr){
    var L={},R={};
    try{ L=JSON.parse(localStr||"{}")||{}; }catch(e){}
    try{ R=JSON.parse(remoteStr||"{}")||{}; }catch(e){}
    var out={};
    for(var k in R){ if(R.hasOwnProperty(k)&&k!=="days") out[k]=R[k]; }
    for(var k2 in L){ if(L.hasOwnProperty(k2)&&k2!=="days") out[k2]=L[k2]; }
    var ld=L.days||{}, rd=R.days||{}, days={}, all={};
    for(var d in ld){ if(ld.hasOwnProperty(d)) all[d]=1; }
    for(var d2 in rd){ if(rd.hasOwnProperty(d2)) all[d2]=1; }
    for(var day in all){
      var a=ld[day], b=rd[day];
      if(a&&b){
        days[day]={ date:day,
          lessons:Math.max(a.lessons||0,b.lessons||0),
          minutes:Math.max(a.minutes||0,b.minutes||0),
          sentences:Math.max(a.sentences||0,b.sentences||0),
          videos:Math.max(a.videos||0,b.videos||0),
          reviews:Math.max(a.reviews||0,b.reviews||0),
          errors:Math.max(a.errors||0,b.errors||0),
          events:mergeEvents(a.events,b.events) };
      } else {
        days[day]=a||b;
        if(days[day]&&days[day].events&&days[day].events.length>30)
          days[day].events=mergeEvents(days[day].events,[]);
      }
    }
    out.days=days;
    return JSON.stringify(out);
  }
  function mergeMirror(localStr, remoteStr){
    var L={},R={};
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

  /* ── 3) 1MB KORUMASI: şişmiş tracker onarımı ─────────────── */
  function sanitizeTracker(){
    try{
      var raw=localStorage.getItem(TRACKER);
      if(!raw || raw.length<200000) return;
      var d=JSON.parse(raw)||{}, days=d.days||{};
      for(var day in days){ if(days.hasOwnProperty(day)&&days[day]&&days[day].events)
        days[day].events=mergeEvents(days[day].events,[]); }
      d.days=days;
      var out=JSON.stringify(d);
      if(out.length>180000){
        for(var d2 in days){ if(days.hasOwnProperty(d2)&&days[d2]) days[d2].events=[]; }
        out=JSON.stringify(d);
      }
      if(out.length<raw.length){
        localStorage.setItem(TRACKER,out);
        console.log("[cloud-sync] tracker küçültüldü:",raw.length,"→",out.length);
      }
    }catch(e){}
  }

  /* ── 4) React modül ilerlemesi: IndexedDB sentence-mode/kv ─ */
  function kvOpen(){
    return new Promise(function(res){
      try{
        var r=indexedDB.open("sentence-mode");
        r.onsuccess=function(){ res(r.result); };
        r.onerror=function(){ res(null); };
      }catch(e){ res(null); }
    });
  }
  async function kvReadAll(){
    var db=await kvOpen(); if(!db) return {};
    return new Promise(function(res){
      try{
        var name=db.objectStoreNames.contains("kv")?"kv":db.objectStoreNames[0];
        if(!name){ db.close(); return res({}); }
        var out={}, req=db.transaction(name,"readonly").objectStore(name).openCursor();
        req.onsuccess=function(e){
          var c=e.target.result;
          if(c){
            var k=String(c.key);
            if(k && k.indexOf("img:")!==0){          // resim önbelleği HARİÇ
              var v; try{ v=JSON.stringify(c.value); }catch(_){ v=String(c.value); }
              if(v && v.length<=MAX_VAL) out["smv:"+k]=v;
            }
            c.continue();
          } else { db.close(); res(out); }
        };
        req.onerror=function(){ db.close(); res({}); };
      }catch(e){ try{db.close();}catch(_){ } res({}); }
    });
  }
  async function kvWriteAll(map){
    var keys=Object.keys(map||{}); if(!keys.length) return 0;
    var db=await kvOpen(); if(!db) return 0;
    return new Promise(function(res){
      try{
        var name=db.objectStoreNames.contains("kv")?"kv":db.objectStoreNames[0];
        if(!name){ db.close(); return res(0); }
        var tx=db.transaction(name,"readwrite"), st=tx.objectStore(name), n=0;
        keys.forEach(function(k){
          var v=map[k]; try{ v=JSON.parse(map[k]); }catch(_){}
          var raw=(k.indexOf("smv:")===0)?k.slice(4):k;
          try{ st.put(v,raw); n++; }catch(_){}
        });
        tx.oncomplete=function(){ db.close(); res(n); };
        tx.onerror=function(){ db.close(); res(n); };
      }catch(e){ try{db.close();}catch(_){ } res(0); }
    });
  }

  /* ── 5) Diğer yerel kaynaklar ─────────────────────────────── */
  function mirrorNow(){ try{ if(window.DHProgress&&DHProgress.mirrorNow) return Promise.resolve(DHProgress.mirrorNow()).catch(function(){}); }catch(e){} return Promise.resolve(); }
  function applyMirror(){ try{ if(window.DHProgress&&DHProgress.applyMirror) return Promise.resolve(DHProgress.applyMirror()).catch(function(){return 0;}); }catch(e){} return Promise.resolve(0); }
  function errAll(){ try{ if(window.LearningErrorDB&&LearningErrorDB.all) return LearningErrorDB.all(); }catch(e){} return Promise.resolve([]); }
  function errMerge(list){ try{ if(window.LearningErrorDB&&LearningErrorDB.bulkMerge&&Array.isArray(list)) return LearningErrorDB.bulkMerge(list); }catch(e){} return Promise.resolve(0); }

  function lsCollect(){
    var out={};
    for(var i=0;i<LS_KEYS.length;i++){
      try{ var v=localStorage.getItem(LS_KEYS[i]); if(v!=null&&v.length<=MAX_VAL) out[LS_KEYS[i]]=v; }catch(e){}
    }
    try{
      for(var j=0;j<localStorage.length;j++){
        var key=localStorage.key(j); if(!key) continue;
        for(var p=0;p<LS_PREFIXES.length;p++){
          if(key.indexOf(LS_PREFIXES[p])===0){
            try{ var vv=localStorage.getItem(key); if(vv!=null&&vv.length<=MAX_VAL) out[key]=vv; }catch(e){}
            break;
          }
        }
      }
    }catch(e){}
    return out;
  }

  /* ── 6) TÜM YERELİ TOPLA (push yükü) ─────────────────────── */
  async function collectAll(){
    sanitizeTracker();
    await mirrorNow();                       // kelime ilerlemesi → ayna (localStorage)
    var ls=lsCollect();
    var kv=await kvReadAll();                // modül ilerlemesi (smv:*)
    for(var k in kv){ if(kv.hasOwnProperty(k)) ls[k]=kv[k]; }
    var errors=await errAll().catch(function(){ return []; });
    return { ls:ls, errors:Array.isArray(errors)?errors.slice(0,3000):[] };
  }

  /* ── 7) PUSH: yereli buluta yaz ──────────────────────────── */
  var DOC_LIMIT = 950000;   // Firestore belge limiti ~1MB; güvenli tavan
  function shrinkToLimit(ls){
    var size=0, dropped=0;
    try{ size=JSON.stringify(ls).length; }catch(e){ return {size:0,dropped:0}; }
    if(size<=DOC_LIMIT) return {size:size,dropped:0};
    // sınır aşıldı: en BÜYÜK smv: değerlerinden başlayarak at (küçük not kayıtları kalsın)
    var smv=[];
    for(var k in ls){ if(ls.hasOwnProperty(k)&&k.indexOf("smv:")===0) smv.push([k,(ls[k]||"").length]); }
    smv.sort(function(a,b){ return b[1]-a[1]; });
    for(var i=0;i<smv.length && size>DOC_LIMIT;i++){
      size-=smv[i][1]; delete ls[smv[i][0]]; dropped++;
    }
    try{ size=JSON.stringify(ls).length; }catch(e){}
    return {size:size,dropped:dropped};
  }
  async function pushNow(){
    if(!ready||!user||!fb) return { ok:false, error:"hazır değil" };
    try{
      var data=await collectAll();
      var g=shrinkToLimit(data.ls);
      await fb.saveSettings(user.uid, data);
      try{ localStorage.setItem("dh-last-push-ts", String(Date.now())); }catch(e){}
      return { ok:true, size:g.size, dropped:g.dropped };
    }catch(e){
      console.warn("cloud-sync yazma hata:", e);
      return { ok:false, error:(e&&e.message?e.message:"bilinmeyen").slice(0,120) };
    }
  }
  function pushSoon(){
    if(!ready||!user) return;
    clearTimeout(saveTimer);
    saveTimer=setTimeout(function(){ pushNow(); },1500);
  }

  /* ── 8) FULL SYNC: çek → birleştir → uygula → geri yaz ───── */
  function waitForAuth(maxMs){
    return new Promise(function(res){
      if(authResolved) return res();
      var w=0, iv=setInterval(function(){
        w+=100;
        if(authResolved||w>=(maxMs||4000)){ clearInterval(iv); res(); }
      },100);
    });
  }

  async function fullSync(){
    if(!ready) return { ok:false, message:"Bulut bağlantısı henüz hazır değil. Birkaç saniye sonra tekrar dene." };
    await waitForAuth(4000);
    if(!user) return { ok:false, message:"Senkron için önce giriş yapmalısın." };
    if(syncing) return { ok:false, message:"Senkron zaten sürüyor…" };
    syncing=true;
    try{
      var remote=await fb.loadSettings(user.uid);
      var rd=parseRemote(remote);
      // MODÜL ÇAKIŞMA YÖNÜ: bulut, bu cihazın son yazmasından YENİYSE bulut kazanır;
      // değilse (bu cihaz daha taze) yalnız yerelde OLMAYAN modül kayıtları alınır.
      var cloudNewer = ((remote&&remote.updated_at)||0) > (+localStorage.getItem("dh-last-push-ts")||0);
      var pulled=0, kvIncoming={};

      for(var rk in rd.ls){
        if(!rd.ls.hasOwnProperty(rk)) continue;
        var rv=rd.ls[rk];
        if(rv==null||rv==="") continue;
        var ok=(LS_KEYS.indexOf(rk)>=0) || rk.indexOf("smv:")===0;
        if(!ok){ for(var p=0;p<LS_PREFIXES.length;p++){ if(rk.indexOf(LS_PREFIXES[p])===0){ ok=true; break; } } }
        if(!ok) continue;
        try{
          if(rk.indexOf("smv:")===0){ kvIncoming[rk]=rv; pulled++; }
          else if(rk===TRACKER){ localStorage.setItem(rk, mergeTracker(localStorage.getItem(rk), rv)); pulled++; }
          else if(rk===MIRROR){ localStorage.setItem(rk, mergeMirror(localStorage.getItem(rk), rv)); pulled++; }
          else { localStorage.setItem(rk, rv); pulled++; }
        }catch(e){}
      }

      if(!cloudNewer){
        // yerel daha taze: mevcut yerel kayıtların üzerine yazma, sadece eksikleri al
        var have=await kvReadAll();
        for(var hk in kvIncoming){ if(kvIncoming.hasOwnProperty(hk) && have[hk]!==undefined) delete kvIncoming[hk]; }
      }
      await kvWriteAll(kvIncoming);                 // modül ilerlemesi → IndexedDB (React okur)
      var addedErr=await errMerge(rd.errors||[]);   // hata defteri birleşir
      var addedProg=await applyMirror();            // kelime aynası → DHProgress IDB
      var pres=await pushNow();                     // GERİ YAZ: bulut = birleşim

      // teşhis sayacı
      var kvNow=await kvReadAll();
      var mirCount=0; try{ mirCount=Object.keys(JSON.parse(localStorage.getItem(MIRROR)||"{}")).length; }catch(e){}
      var parts=[];
      if(pulled) parts.push(pulled+" kayıt buluttan alındı");
      if(addedErr) parts.push(addedErr+" hata kaydı eklendi");
      if(addedProg) parts.push(addedProg+" ilerleme uygulandı");
      if(!parts.length) parts.push("her şey zaten güncel");
      var pmsg = pres&&pres.ok
        ? ("buluta yazıldı "+Math.round((pres.size||0)/1024)+"KB"+(pres.dropped?(" ("+pres.dropped+" büyük kayıt atlandı)"):""))
        : ("buluta YAZILAMADI: "+(pres&&pres.error||"?"));
      try{ localStorage.setItem("dh-last-sync-ts", String(Date.now())); }catch(e){}
      updateBadge(true);
      return { ok:true, message:"✓ "+parts.join(", ")+" · "+pmsg+". [cihazda modül:"+Object.keys(kvNow).length+" · kelime:"+mirCount+"]" };
    }catch(e){
      return { ok:false, message:"Senkron başarısız: "+(e&&e.message?e.message:"bilinmeyen") };
    }finally{
      syncing=false;
    }
  }

  /* ── 9) Uzak belgeyi normalize et (eski+yeni yapı+__bulk) ── */
  function parseRemote(remote){
    var out={ ls:{}, errors:[] };
    if(!remote) return out;
    var d=remote.data&&typeof remote.data==="object"?remote.data:null;
    if(d&&d.ls){ for(var k in d.ls){ if(d.ls.hasOwnProperty(k)) out.ls[k]=d.ls[k]; } }
    if(d&&Array.isArray(d.errors)) out.errors=out.errors.concat(d.errors);
    for(var rk in remote){
      if(!Object.prototype.hasOwnProperty.call(remote,rk)) continue;
      if(rk==="data"||rk==="__ts"||rk==="__errors"||rk==="__bulk"||rk==="updated_at") continue;
      if(remote[rk]!=null && typeof remote[rk]==="string") out.ls[rk]=remote[rk];
    }
    if(remote.__bulk&&typeof remote.__bulk==="object"){
      for(var bk in remote.__bulk){ if(remote.__bulk.hasOwnProperty(bk)&&remote.__bulk[bk]!=null) out.ls[bk]=remote.__bulk[bk]; }
    }
    if(Array.isArray(remote.__errors)) out.errors=out.errors.concat(remote.__errors);
    return out;
  }

  /* ── 10) FIREBASE (kanıtlı çalışan başlatma) ─────────────── */
  function initFirebase(){
    return Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js")
    ]).then(function(mods){
      var appMod=mods[0], authMod=mods[1], fsMod=mods[2];
      var app;
      try{
        var existing=appMod.getApps&&appMod.getApps();
        app=(existing&&existing.length)?existing[0]:appMod.initializeApp(firebaseConfig);
      }catch(e){ app=appMod.initializeApp(firebaseConfig); }
      var auth=authMod.getAuth(app);
      var db=fsMod.getFirestore(app);
      try{
        if(authMod.setPersistence&&authMod.browserLocalPersistence)
          authMod.setPersistence(auth, authMod.browserLocalPersistence);
      }catch(e){}
      fb={
        auth:auth, db:db,
        onAuth:function(cb){ return authMod.onAuthStateChanged(auth,cb); },
        signOut:function(){ try{ return authMod.signOut(auth); }catch(e){ return Promise.resolve(); } },
        loadSettings:function(uid){
          // İKİ BELGE: settings (ayarlar) + progress (srs/ayna/günler) — birleşik döndür.
          // Eski tek-belge kurulumları da kapsar (progress boşsa settings'teki her şey okunur).
          return Promise.all([
            fsMod.getDoc(fsMod.doc(db,"settings",uid)).then(function(s){return s.exists()?s.data():null;}),
            fsMod.getDoc(fsMod.doc(db,"progress",uid)).then(function(s){return s.exists()?s.data():null;}).catch(function(){return null;})
          ]).then(function(a){
            var st=a[0]||{}, pg=a[1]||{}, out={};
            for(var k in st){ if(st.hasOwnProperty(k)) out[k]=st[k]; }
            for(var k2 in pg){ if(pg.hasOwnProperty(k2)&&k2!=="updated_at") out[k2]=pg[k2]; }  // progress daha taze → üstüne
            if(pg.__bulk){ out.__bulk=Object.assign({},st.__bulk||{},pg.__bulk); }
            out.updated_at=Math.max(st.updated_at||0, pg.updated_at||0);
            return out;
          });
        },
        saveSettings:function(uid,data){
          // BÖL: ilerleme (smv:*, wsrs, ayna, günler) → progress/{uid}; kalan ayarlar → settings/{uid}.
          // İki belge = 2×1MB tavan; ayar değişimi koca ilerlemeyi yeniden yazmaz.
          // nokta/özel karakterli anahtarlar Firestore alan adı olamaz → __bulk
          var doc2={}, bulk={};
          if(data&&data.ls){
            for(var k in data.ls){
              if(!data.ls.hasOwnProperty(k)) continue;
              if(/[.\/~\[\]*]/.test(k)) bulk[k]=data.ls[k];
              else doc2[k]=data.ls[k];
            }
          }
          var isProg=function(k){ return k.indexOf("smv:")===0 || k==="dh-progress-mirror-v1" || k==="dh-study-tracker-v1"; };
          var pDoc={}, sDoc={}, pBulk={}, sBulk={};
          for(var dk in doc2){ if(doc2.hasOwnProperty(dk)) (isProg(dk)?pDoc:sDoc)[dk]=doc2[dk]; }
          for(var bk2 in bulk){ if(bulk.hasOwnProperty(bk2)) (isProg(bk2)?pBulk:sBulk)[bk2]=bulk[bk2]; }
          if(Object.keys(sBulk).length) sDoc.__bulk=sBulk;
          if(Object.keys(pBulk).length) pDoc.__bulk=pBulk;
          if(data&&data.errors) sDoc.__errors=data.errors;
          var now2=Date.now(); sDoc.updated_at=now2; pDoc.updated_at=now2;
          return Promise.all([
            fsMod.setDoc(fsMod.doc(db,"settings",uid), sDoc, { merge:true }),
            fsMod.setDoc(fsMod.doc(db,"progress",uid), pDoc, { merge:true })
          ]);
        }
      };
      ready=true;
      fb.onAuth(function(u){
        user=u?{uid:u.uid}:null;
        authResolved=true;
        if(user) initialSync();
      });
    }).catch(function(e){ console.warn("cloud-sync: firebase yüklenemedi", e); });
  }

  /* ── 11) TETİKLEYİCİLER ──────────────────────────────────── */
  function initialSync(){
    waitForAuth(5000).then(function(){
      if(!ready||!user||!fb) return;
      // KISIT: son tam senkron 5 dk içindeyse sayfa gezinmelerinde tekrar etme
      try{ if(Date.now()-(+localStorage.getItem("dh-last-sync-ts")||0) < 300000) return; }catch(e){}
      fullSync().then(function(res){
        try{ if(window.__dhAutoSyncDone) window.__dhAutoSyncDone(res); }catch(e){}
      }).catch(function(){});
    });
  }
  async function signOutAndPush(){
    await waitForAuth(3000);
    if(ready&&user&&fb){ try{ await pushNow(); }catch(e){} }
    await new Promise(function(r){ setTimeout(r,400); });
    try{ if(fb&&fb.signOut) await fb.signOut(); }catch(e){}
    try{
      localStorage.removeItem("dh_logged_in");
      localStorage.removeItem("dh_logged_uid");
      localStorage.removeItem("dh_logged_email");
    }catch(e){}
    return { ok:true };
  }
  function hookLocalStorage(){
    try{
      var proto=window.localStorage;
      var origSet=proto.setItem.bind(proto);
      proto.setItem=function(k,v){
        origSet(k,v);
        var key=String(k);
        var match=(LS_KEYS.indexOf(key)>=0);
        if(!match){ for(var p=0;p<LS_PREFIXES.length;p++){ if(key.indexOf(LS_PREFIXES[p])===0){ match=true; break; } } }
        if(match) pushSoon();
      };
    }catch(e){}
  }
  function flushOnLeave(){
    try{ clearTimeout(saveTimer); }catch(e){}
    pushNow();
  }

  /* ── 11b) DURUM ROZETİ: sağ-alt "☁ HH:MM" — tıkla = senkron ── */
  function updateBadge(ok){
    try{
      var b=document.getElementById("dhSyncBadge");
      if(!b){
        b=document.createElement("button");
        b.id="dhSyncBadge"; b.type="button";
        b.style.cssText="position:fixed;right:10px;bottom:10px;z-index:9998;background:rgba(13,26,48,.92);color:#9fb3d9;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:5px 11px;font:700 11px system-ui;cursor:pointer;opacity:.85";
        b.title="Son senkron — tıkla: şimdi senkronla";
        b.onclick=function(){
          b.textContent="☁ …";
          fullSync().then(function(r){ if(!r.ok){ b.textContent="☁ ⚠"; b.style.color="#f87171"; } });
        };
        var mount=function(){ try{ document.body.appendChild(b); }catch(e){} };
        if(document.body) mount(); else document.addEventListener("DOMContentLoaded",mount);
      }
      var ts=+localStorage.getItem("dh-last-sync-ts")||0;
      var hhmm=ts?new Date(ts).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"}):"—";
      b.textContent="☁ "+hhmm;
      b.style.color=(ok===false)?"#f87171":"#9fb3d9";
    }catch(e){}
  }

  /* ── 11c) GÜNLÜK ANLIK GÖRÜNTÜ: "dünü geri al" güvenlik ağı ── */
  async function takeSnapshot(){
    try{
      var day=new Date().toISOString().slice(0,10), key="dh-snap-"+day;
      if(localStorage.getItem(key)) return;
      var snap={ m:localStorage.getItem(MIRROR)||"", t:localStorage.getItem(TRACKER)||"", kv:await kvReadAll() };
      var str=JSON.stringify(snap);
      if(str.length>1500000) { snap.kv={}; str=JSON.stringify(snap); }  // taşarsa kv'siz sakla
      localStorage.setItem(key,str);
      // en fazla 3 gün tut
      var snaps=[]; for(var i2=0;i2<localStorage.length;i2++){ var k2=localStorage.key(i2); if(k2&&k2.indexOf("dh-snap-")===0) snaps.push(k2); }
      snaps.sort(); while(snaps.length>3){ localStorage.removeItem(snaps.shift()); }
    }catch(e){}
  }
  function snapList(){
    var out=[]; try{ for(var i3=0;i3<localStorage.length;i3++){ var k3=localStorage.key(i3); if(k3&&k3.indexOf("dh-snap-")===0) out.push(k3.slice(8)); } }catch(e){}
    return out.sort();
  }
  async function restoreSnap(day){
    try{
      var raw=localStorage.getItem("dh-snap-"+day); if(!raw) return {ok:false,message:"Anlık görüntü yok"};
      var s2=JSON.parse(raw);
      if(s2.m) localStorage.setItem(MIRROR,s2.m);
      if(s2.t) localStorage.setItem(TRACKER,s2.t);
      if(s2.kv) await kvWriteAll(s2.kv);
      await applyMirror();
      await pushNow();
      return {ok:true,message:"✓ "+day+" durumuna dönüldü ve buluta yazıldı."};
    }catch(e){ return {ok:false,message:"Geri dönüş hatası: "+(e&&e.message||"?")}; }
  }

  /* ── 12) BAŞLAT + DIŞ API ────────────────────────────────── */
  hookLocalStorage();
  window.addEventListener("learning-errors-cleared", pushSoon);
  window.addEventListener("pagehide", flushOnLeave);
  document.addEventListener("visibilitychange", function(){ if(document.visibilityState==="hidden") flushOnLeave(); });
  initFirebase();
  setTimeout(function(){ takeSnapshot(); }, 4000);
  if(document.readyState!=="loading") updateBadge(); else document.addEventListener("DOMContentLoaded",function(){ updateBadge(); });

  window.DHCloudSync = {
    push: pushNow, sync: initialSync, pull: fullSync, fullSync: fullSync,
    signOut: signOutAndPush,
    snapList: snapList, restoreSnap: restoreSnap,
    get ready(){ return ready; }, get user(){ return user; }
  };
})();
