/* cloud-sync.js
   Cihazlar arası senkron — mevcut "sentencemode" Firebase projesini kullanır.

   NE SENKRONLANIR (pratik SRS hariç; o practice.html'de zaten senkronlu):
   - AI prompt            (dh_ai_prompt_teacher)
   - Günlük takip/streak   (dh-study-tracker-v1)
   - AI anahtarları        (groqApiKeys, cerebrasApiKeys, geminiApiKeys)
   - Model seçimleri       (dh-model-groq/cerebras/gemini)
   - Pasif anahtarlar      (dh-disabled-keys)
   - Öğretmen ayarları     (dh-teacher-policy-v1, dh-notif-settings-v1, selectedTeacherAvatar)
   - İlerleme aynası       (dh-progress-mirror-v1)
   - OCR cümleleri         (dh-ocr-sentences-v1)
   - Mastery skorları      (mas:* , ev:*)
   - Modül notları/profil  (modscore:* , gramprof:*)
   - Modül hikayeleri      (story:*)
   - Hata defteri          (IndexedDB: LearningErrorDB)

   NASIL ÇALIŞIR:
   - Kullanıcı giriş yapınca (Firebase Auth) buluttan "settings/{uid}" belgesini çeker,
     cihazdakiyle birleştirir, sonucu hem cihaza hem buluta yazar.
   - İlgili veri değişince (storage olayları) buluta yazar (debounce'lu).
   - Giriş yoksa hiçbir şey yapmaz; her şey eskisi gibi yerel çalışır.

   GÜVENLİK NOTU: API anahtarları da senkronlanır (kullanıcı isteğiyle).
   Bunlar sizin Firebase projenizdeki Firestore'da, kullanıcının kendi belgesinde durur.
*/
(function(){
  "use strict";
  if (window.__dhCloudSyncInstalled) return;
  window.__dhCloudSyncInstalled = true;

  // Senkronlanacak SABİT localStorage anahtarları
  var LS_KEYS = [
    "dh_ai_prompt_teacher", "dh-study-tracker-v1", "dh-ocr-sentences-v1",
    "dh-teacher-policy-v1", "dh-notif-settings-v1", "dh-progress-mirror-v1",
    // AI sağlayıcı anahtarları (çok sağlayıcılı)
    "groqApiKeys", "cerebrasApiKeys", "geminiApiKeys",
    // model seçimleri + pasif anahtar listesi
    "dh-model-groq", "dh-model-cerebras", "dh-model-gemini", "dh-disabled-keys",
    // seçili öğretmen avatarı
    "selectedTeacherAvatar"
  ];

  // Senkronlanacak PREFIX'li anahtarlar (çoklu kayıt: mastery, modül notları, hikayeler).
  // Bu öneklerle başlayan TÜM localStorage anahtarları toplanıp senkronlanır.
  var LS_PREFIXES = [
    "mas:",        // mastery skorları
    "ev:",         // mastery kanıtları
    "modscore:",   // modül notları
    "gramprof:",   // gramer profili
    "story:"       // modül hikaye önbelleği
  ];

  // Buluttan gelen belgeyi normalize et: {ls:{...}, errors:[...]}
  // Hem yeni kök-seviye yapı hem eski data.ls yapısını destekler.
  function parseRemote(remote){
    var out = { ls: {}, ts: {}, errors: [] };
    if (!remote) return out;
    // Eski yapı: remote.data.ls / remote.data.errors
    var d = remote.data && typeof remote.data === "object" ? remote.data : null;
    if (d && d.ls){ for (var k in d.ls){ if (d.ls.hasOwnProperty(k)) out.ls[k] = d.ls[k]; } }
    if (d && d.ts){ for (var tk in d.ts){ if (d.ts.hasOwnProperty(tk)) out.ts[tk] = d.ts[tk]; } }
    if (d && Array.isArray(d.errors)){ out.errors = out.errors.concat(d.errors); }
    // Yeni kök yapı: doğrudan belgenin alanları (LS_KEYS) + __ts + __errors
    for (var i=0;i<LS_KEYS.length;i++){
      var key = LS_KEYS[i];
      if (Object.prototype.hasOwnProperty.call(remote, key) && remote[key] != null){
        out.ls[key] = remote[key];
      }
    }
    if (remote.__ts && typeof remote.__ts === "object"){
      for (var tk2 in remote.__ts){ if (remote.__ts.hasOwnProperty(tk2)) out.ts[tk2] = remote.__ts[tk2]; }
    }
    // __bulk: nokta/özel karakterli anahtarlar (mas:/ev:/modscore:/gramprof:/story:)
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

  var fb = null;        // { auth, db, ... }
  var user = null;      // { uid } | null
  var authResolved = false;  // onAuthStateChanged ilk kez çalıştı mı (oturum belirlendi mi)
  var ready = false;
  var saveTimer = null;

  // Firebase modüllerini dinamik yükle (her sayfada kendi başına çalışsın)
  function initFirebase(){
    return Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js")
    ]).then(function(mods){
      var appMod = mods[0], authMod = mods[1], fsMod = mods[2];
      // practice.html zaten bir app başlatmış olabilir; çakışmayı önlemek için
      // var olan app'i kullan, yoksa yeni başlat.
      var app;
      try{
        var existing = appMod.getApps && appMod.getApps();
        app = (existing && existing.length) ? existing[0] : appMod.initializeApp(firebaseConfig);
      }catch(e){ app = appMod.initializeApp(firebaseConfig); }
      var auth = authMod.getAuth(app);
      var db = fsMod.getFirestore(app);
      // Oturumu kalıcı tut: kullanıcı bir kez giriş yapınca tarayıcı kapansa bile
      // hatırlansın, her açılışta tekrar şifre istenmesin.
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
          // Veriyi KÖK seviyeye yaz (data.ls sarmalı yok). merge:true ile
          // diğer alanlar korunur. Yapı: { <lsKey>: value, __ts:{...}, __errors:[...] }
          // ANCAK: anahtar adında nokta (.) veya / olanlar Firestore alan adı olamaz —
          // bunları güvenli "__bulk" nesnesine koy (ör. cümle ID'li mas:/story: anahtarları).
          var doc2 = {}, bulk = {};
          if (data && data.ls){
            for (var k in data.ls){
              if (!data.ls.hasOwnProperty(k)) continue;
              if (k.indexOf(".")>=0 || k.indexOf("/")>=0 || k.indexOf("~")>=0 || k.indexOf("[")>=0 || k.indexOf("]")>=0 || k.indexOf("*")>=0){
                bulk[k] = data.ls[k];          // sorunlu karakterli → sarmalı
              } else {
                doc2[k] = data.ls[k];          // güvenli → kök alan
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
        authResolved = true;   // oturum durumu ilk kez belirlendi
        if (user) initialSync();
      });
    }).catch(function(e){
      console.warn("cloud-sync: Firebase yüklenemedi, yerel modda devam.", e);
    });
  }

  // --- Yerel veri toplama / uygulama ---
  function collectLocal(){
    var out = { ls: {}, errors: [] };
    for (var i=0;i<LS_KEYS.length;i++){
      try{ var v = localStorage.getItem(LS_KEYS[i]); if (v != null) out.ls[LS_KEYS[i]] = v; }catch(e){}
    }
    // prefix'li anahtarlar (mastery, modül notları, hikayeler): tüm eşleşenleri tara
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

  function applyLocal(remote){
    if (!remote) return;
    // localStorage anahtarları: bulut değeri varsa ve yerelde yoksa/boşsa uygula.
    // (Çakışmada güncellik bilinmediği için: yerelde değer yoksa buluttan al.)
    if (remote.ls){
      for (var k in remote.ls){
        if (!remote.ls.hasOwnProperty(k)) continue;
        try{
          var cur = localStorage.getItem(k);
          if (cur == null || cur === "" || cur === "[]") {
            localStorage.setItem(k, remote.ls[k]);
          }
        }catch(e){}
      }
    }
  }

  // --- Hata defteri (IndexedDB) ---
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

  // --- Giriş sonrası ilk senkron: buluttan çek + birleştir + geri yaz ---
  function initialSync(){
    // AÇILIŞTA: buluttan ÇEK (yerel veriyi buluttakiyle güncelle).
    // Yükleme yapmaz — yükleme yalnızca çıkışta (signOut) veya setItem sonrası pushSoon ile.
    // Böylece açılışta yanlışlıkla bulut ezilmez.
    waitForAuth(5000).then(function(){
      if (!ready || !user || !fb) return;
      fullSync().then(function(res){
        try{ if (window.__dhAutoSyncDone) window.__dhAutoSyncDone(res); }catch(e){}
      }).catch(function(){});
    });
  }

  // ÇIKIŞ: önce buluta yaz (o oturumdaki değişiklikleri kaydet), sonra oturumu kapat.
  function signOutAndPush(){
    return waitForAuth(3000).then(function(){
      var doPush = (ready && user && fb) ? pushNow() : Promise.resolve();
      return doPush.catch(function(){}).then(function(){
        // storage-bridge asenkron olabilir: yazmanın tamamlanması için kısa bekle
        return new Promise(function(res){ setTimeout(res, 600); });
      }).then(function(){
        try{ if (fb && fb.signOut) return fb.signOut(); }catch(e){}
      }).then(function(){
        // yerel oturum bayraklarını temizle + giriş sayfasına dön
        try{
          localStorage.removeItem("dh_logged_in");
          localStorage.removeItem("dh_logged_uid");
          localStorage.removeItem("dh_logged_email");
        }catch(e){}
        return { ok:true };
      });
    });
  }

  // --- Yerel durumu buluta yaz ---
  function pushNow(){
    if (!ready || !user || !fb) return Promise.resolve();
    // en güncel öğrenme ilerlemesini localStorage aynasına yaz (sonra collectLocal okur)
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

  // --- Değişiklikleri dinle ---
  // Aynı sekmede localStorage.setItem storage olayını tetiklemez; bu yüzden
  // setItem'i sarmalayıp ilgili anahtarlarda pushSoon çağırıyoruz.
  function hookLocalStorage(){
    try{
      var proto = window.localStorage;
      // storage-bridge shim'i defineProperty ile kurulmuş olabilir; setItem'i sarmala
      var origSet = proto.setItem.bind(proto);
      proto.setItem = function(k, v){
        origSet(k, v);
        var key=String(k);
        var match = (LS_KEYS.indexOf(key) >= 0);
        if(!match){ for(var p=0;p<LS_PREFIXES.length;p++){ if(key.indexOf(LS_PREFIXES[p])===0){ match=true; break; } } }
        if (match){
          try{ origSet("__ts_" + key, String(Date.now())); }catch(e){}
          pushSoon();
        }
      };
    }catch(e){}
  }
  // Bir anahtarın yerel zaman damgasını oku
  function localTs(k){
    try{ return parseInt(localStorage.getItem("__ts_" + k) || "0", 10) || 0; }catch(e){ return 0; }
  }
  // Hata defterine kayıt eklenince de buluta gönder
  window.addEventListener("learning-error-added", pushSoon);
  window.addEventListener("learning-errors-cleared", pushSoon);

  // EKRAN ÇIKIŞI / SAYFA GİZLENMESİ: bekleyen değişiklikleri hemen buluta yaz.
  // pagehide + visibilitychange(hidden): sayfa geçişi, sekme kapatma, mobilde arka plan.
  function flushOnLeave(){
    try{
      // storage-bridge'i diske it (asenkron shim), sonra push
      if(window.__dhStorageFlush) window.__dhStorageFlush();
    }catch(e){}
    // bekleyen debounce'u iptal edip hemen yaz
    try{ clearTimeout(saveTimer); }catch(e){}
    pushNow();
  }
  window.addEventListener("pagehide", flushOnLeave);
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState==="hidden") flushOnLeave();
  });

  // Başlat
  function start(){
    hookLocalStorage();
    initFirebase();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  // Genel "Bulutla Senkronize Et" — buluttan çek, birleştir, geri yaz.
  // Kullanıcıya gösterilecek sonuç döndürür: {ok, message}
  // Oturumun (onAuthStateChanged) ilk kez çözülmesini bekler. Firebase, kalıcı
  // oturumu IndexedDB'den okurken birkaç yüz ms gecikir; bu yüzden "giriş yok"
  // demeden önce oturumun yüklenmesine şans tanırız.
  function waitForAuth(maxMs){
    return new Promise(function(resolve){
      if (authResolved) return resolve();
      var waited = 0;
      var iv = setInterval(function(){
        waited += 100;
        if (authResolved || waited >= (maxMs||4000)){ clearInterval(iv); resolve(); }
      }, 100);
    });
  }

  function fullSync(){
    if (!ready) return Promise.resolve({ ok:false, message:"Bulut bağlantısı henüz hazır değil. Birkaç saniye sonra tekrar dene." });
    return waitForAuth(4000).then(function(){
      if (!user) return { ok:false, message:"Senkron için önce giriş yapmalısın." };
      return fb.loadSettings(user.uid).then(function(remote){
        var rd = parseRemote(remote);
        // BASİT MANTIK: Senkron = buluttakini getir, yerele yaz. Geri yazma yok.
        var pulled = 0;
        // hem sabit LS_KEYS hem prefix'li (mas:/story: vb.) — rd.ls'deki HER anahtarı çek
        if (rd.ls){
          for (var rk in rd.ls){
            if (!rd.ls.hasOwnProperty(rk)) continue;
            var rv = rd.ls[rk];
            if (rv == null || rv === "") continue;
            // sadece bilinen anahtarları/önekleri yaz (çöp veri yazma)
            var ok = (LS_KEYS.indexOf(rk) >= 0);
            if (!ok){ for (var pp=0; pp<LS_PREFIXES.length; pp++){ if (rk.indexOf(LS_PREFIXES[pp])===0){ ok=true; break; } } }
            if (!ok) continue;
            try{ localStorage.setItem(rk, rv); pulled++; }catch(e){}
          }
        }
        // hata defteri: buluttan gelenleri yerele ekle (birleştir)
        return mergeRemoteErrors(rd.errors || []).then(function(addedErr){
          // öğrenme ilerlemesi aynasını IndexedDB'ye uygula
          var progP = (window.DHProgress && DHProgress.applyMirror) ? DHProgress.applyMirror() : Promise.resolve(0);
          return progP.then(function(addedProg){
            return { ok:true, pulled:pulled, addedErrors:addedErr||0, addedProgress:addedProg||0 };
          });
        });
      }).then(function(res){
        var parts = [];
        if (res.pulled) parts.push(res.pulled + " ayar buluttan alındı");
        if (res.addedErrors) parts.push(res.addedErrors + " hata kaydı eklendi");
        if (!parts.length) parts.push("bulutta veri yok veya zaten güncel");
        return { ok:true, message:"✓ Buluttan alındı. " + parts.join(", ") + "." };
      }).catch(function(e){
        var msg = (e && e.message) ? e.message : "bağlantı hatası";
        if (/permission/i.test(msg)) msg = "İzin hatası (Firebase kuralı). Lütfen tekrar dene.";
        return { ok:false, message:"Senkron başarısız: " + msg };
      });
    });
  }

  // Dışarıya küçük API (manuel tetikleme için)
  // pull(key): buluttaki settings belgesinden tek bir localStorage anahtarının
  // güncel değerini döndürür (örn. "dh_ai_prompt_teacher").
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
