/* cloud-sync.js
   Cihazlar arası senkron — mevcut "sentencemode" Firebase projesini kullanır.

   NE SENKRONLANIR (pratik SRS hariç; o practice.html'de zaten senkronlu):
   - AI prompt           (localStorage: dh_ai_prompt_teacher)
   - Günlük takip/streak  (localStorage: dh-study-tracker-v1)
   - Groq API anahtarları (localStorage: groqApiKeys)
   - Hata defteri         (IndexedDB: LearningErrorDB)

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

  // Senkronlanacak localStorage anahtarları
  var LS_KEYS = ["dh_ai_prompt_teacher", "dh-study-tracker-v1", "groqApiKeys"];

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
      fb = {
        auth: auth, db: db,
        onAuth: function(cb){ return authMod.onAuthStateChanged(auth, cb); },
        loadSettings: function(uid){
          return fsMod.getDoc(fsMod.doc(db, "settings", uid)).then(function(snap){
            return snap.exists() ? snap.data() : null;
          });
        },
        saveSettings: function(uid, data){
          return fsMod.setDoc(fsMod.doc(db, "settings", uid),
            { data: data, updated_at: Date.now() }, { merge: true });
        }
      };
      ready = true;
      fb.onAuth(function(u){
        user = u ? { uid: u.uid } : null;
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
    if (!ready || !user || !fb) return;
    fb.loadSettings(user.uid).then(function(remote){
      var rd = (remote && remote.data) || {};
      // 1) localStorage anahtarlarını uygula (yerelde boşsa buluttan al)
      applyLocal(rd);
      // 2) hata defterini birleştir (buluttan gelenleri ekle)
      return mergeRemoteErrors(rd.errors || []);
    }).then(function(){
      // 3) birleşmiş yerel durumu buluta geri yaz
      return pushNow();
    }).catch(function(e){ console.warn("cloud-sync ilk senkron hata:", e); });
  }

  // --- Yerel durumu buluta yaz ---
  function pushNow(){
    if (!ready || !user || !fb) return Promise.resolve();
    var local = collectLocal();
    return getLocalErrors().then(function(errors){
      var payload = {
        ls: local.ls,
        errors: Array.isArray(errors) ? errors.slice(0, 3000) : []
      };
      return fb.saveSettings(user.uid, payload);
    }).catch(function(e){ console.warn("cloud-sync yazma hata:", e); });
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
        if (LS_KEYS.indexOf(String(k)) >= 0) pushSoon();
      };
    }catch(e){}
  }
  // Hata defterine kayıt eklenince de buluta gönder
  window.addEventListener("learning-error-added", pushSoon);
  window.addEventListener("learning-errors-cleared", pushSoon);

  // Başlat
  function start(){
    hookLocalStorage();
    initFirebase();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  // Dışarıya küçük API (manuel tetikleme için)
  window.DHCloudSync = { push: pushNow, sync: initialSync, get user(){ return user; } };
})();
