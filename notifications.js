/* notifications.js
   Dil Harita — Bildirim sistemi (ücretsiz, sunucusuz çekirdek + FCM token altyapısı)

   İKİ KATMAN:
   1) YEREL HATIRLATMA (sunucu yok): Kullanıcı izin verir, günlük bir saat seçer.
      Uygulama her açıldığında "bugün o saat geçti mi ve henüz çalışmadın mı?"
      kontrol edilir; uygunsa yerel bir bildirim gösterilir. Ayrıca uygulama
      açıkken o saate gelince anında hatırlatır. StudyTracker'a bağlıdır:
      - Bugün hiç çalışılmadıysa: "Bugün henüz çalışmadın"
      - Seri varsa: "X günlük serini kaybetme"
      - Hedef tamamlandıysa bildirim gösterilmez (rahatsız etmez).
   2) FCM TOKEN (Firebase Console'dan ELLE push için): İzin verilince cihazın
      FCM token'ı alınır ve Firestore'a (fcmTokens/{uid}) yazılır. Böylece
      Firebase panelinden tüm/seçili kullanıcılara bildirim gönderilebilir.
      (Otomatik zamanlanmış push Blaze ister; burada yok.)

   STORAGE ANAHTARLARI (localStorage / storage-bridge üzerinden):
   - dh-notif-settings-v1 : {enabled, hour, minute, lastShownDate, fcmToken}
   Mevcut: StudyTracker (global), DHCloudSync (firebaseConfig, user.uid)
*/
(function(){
  "use strict";
  if (window.__dhNotifInstalled) return;
  window.__dhNotifInstalled = true;

  var LS_KEY = "dh-notif-settings-v1";

  var firebaseConfig = {
    apiKey: "AIzaSyBZTHvP8xX94UMtKRt7hIYN7qpbO2gz0Zg",
    authDomain: "sentencemode.firebaseapp.com",
    projectId: "sentencemode",
    storageBucket: "sentencemode.firebasestorage.app",
    messagingSenderId: "1048475533632",
    appId: "1:1048475533632:web:3f719b6da4397ed7c53aa5"
  };

  // ---- Ayar okuma/yazma ----
  function defaults(){
    return { enabled:false, hour:20, minute:0, lastShownDate:"", fcmToken:"" };
  }
  function load(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if(!raw) return defaults();
      var o = JSON.parse(raw);
      return Object.assign(defaults(), o||{});
    }catch(e){ return defaults(); }
  }
  function save(s){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(s||defaults())); }catch(e){}
  }
  function todayStr(d){
    d = d || new Date();
    var y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), da=String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+da;
  }

  // ---- İzin durumu ----
  function permission(){
    try{ return (typeof Notification!=="undefined") ? Notification.permission : "unsupported"; }
    catch(e){ return "unsupported"; }
  }
  function supported(){
    return (typeof Notification!=="undefined") && ("serviceWorker" in navigator);
  }
  function requestPermission(){
    if(!supported()) return Promise.resolve("unsupported");
    try{
      return Notification.requestPermission().then(function(p){ return p; });
    }catch(e){
      // Eski tarayıcılar callback tarzı kullanır
      return new Promise(function(res){
        try{ Notification.requestPermission(function(p){ res(p); }); }catch(_){ res("denied"); }
      });
    }
  }

  // ---- Bugün çalışıldı mı? (StudyTracker) ----
  function studiedToday(){
    try{
      if(window.StudyTracker && StudyTracker.day){
        var d = StudyTracker.day();
        return (d.lessons>0 || d.sentences>0 || d.videos>0 || d.reviews>0 || d.minutes>0);
      }
    }catch(e){}
    return false;
  }
  function currentStreak(){
    try{ if(window.StudyTracker && StudyTracker.streak) return StudyTracker.streak()||0; }catch(e){}
    return 0;
  }
  function goalDone(){
    try{
      if(window.StudyTracker && StudyTracker.summary){
        var s = StudyTracker.summary();
        return !!s.doneToday;
      }
    }catch(e){}
    return false;
  }

  // ---- Hatırlatma mesajını üret ----
  function buildMessage(){
    var streak = currentStreak();
    if(!studiedToday()){
      if(streak>=2){
        return {
          title:"🔥 "+streak+" günlük serini kaybetme!",
          body:"Bugün henüz çalışmadın. Birkaç dakika ayır, seriyi sürdür."
        };
      }
      return {
        title:"📚 Çalışma vakti!",
        body:"Bugün henüz çalışmadın. Birkaç öbek fiil ya da cümleyle başla."
      };
    }
    // Çalışılmış ama hedef tamamlanmamışsa hafif teşvik
    if(!goalDone()){
      return {
        title:"💪 Az kaldı!",
        body:"Bugünkü hedefini tamamlamana az kaldı. Devam et!"
      };
    }
    return null; // hedef tamam → rahatsız etme
  }

  // ---- Bildirim göster (SW üzerinden; SW yoksa Notification API) ----
  function showNotification(payload){
    if(!payload) return Promise.resolve(false);
    if(permission()!=="granted") return Promise.resolve(false);
    var opts = {
      body: payload.body || "",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: "dh-daily-reminder",
      renotify: true,
      data: { url: "./index.html" }
    };
    // Önce SW registration ile (PWA kapalıyken bile tıklanınca açar)
    try{
      if(navigator.serviceWorker && navigator.serviceWorker.ready){
        return navigator.serviceWorker.ready.then(function(reg){
          if(reg && reg.showNotification){
            return reg.showNotification(payload.title, opts).then(function(){ return true; });
          }
          return fallbackNotify(payload, opts);
        }).catch(function(){ return fallbackNotify(payload, opts); });
      }
    }catch(e){}
    return Promise.resolve(fallbackNotify(payload, opts));
  }
  function fallbackNotify(payload, opts){
    try{
      var n = new Notification(payload.title, opts);
      n.onclick = function(){ try{ window.focus(); location.href="./index.html"; }catch(e){} n.close(); };
      return true;
    }catch(e){ return false; }
  }

  // ---- "Bugün gösterim yapıldı mı?" işareti ----
  function markShownToday(){
    var s = load(); s.lastShownDate = todayStr(); save(s);
  }
  function alreadyShownToday(){
    return load().lastShownDate === todayStr();
  }

  // ---- Açılışta kontrol: saat geçmiş + bugün çalışılmamış + bugün gösterilmemiş ----
  function checkOnLoad(){
    var s = load();
    if(!s.enabled || permission()!=="granted") return;
    if(alreadyShownToday()) return;
    var now = new Date();
    var target = new Date();
    target.setHours(s.hour||20, s.minute||0, 0, 0);
    if(now >= target){
      var msg = buildMessage();
      if(msg){ showNotification(msg).then(function(ok){ if(ok) markShownToday(); }); }
      else { markShownToday(); } // hedef tamam → bugün için sustur
    }
  }

  // ---- Uygulama AÇIKKEN saat gelince anında hatırlat ----
  var tickTimer = null;
  function startTicking(){
    if(tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(function(){
      var s = load();
      if(!s.enabled || permission()!=="granted") return;
      if(alreadyShownToday()) return;
      var now = new Date();
      if(now.getHours()===(s.hour||20) && now.getMinutes()===(s.minute||0)){
        var msg = buildMessage();
        if(msg){ showNotification(msg).then(function(ok){ if(ok) markShownToday(); }); }
        else { markShownToday(); }
      }
    }, 30000); // 30 sn'de bir
  }

  // ---- FCM token (Firebase Console'dan elle push için) ----
  // VAPID anahtarı: Firebase Console > Project Settings > Cloud Messaging >
  // "Web Push certificates" > Generate key pair ile üretip buraya yapıştır.
  var VAPID_KEY = ""; // <-- BURAYA VAPID public key yapıştırılacak

  function currentUid(){
    try{
      if(window.DHCloudSync && DHCloudSync.user && DHCloudSync.user.uid) return DHCloudSync.user.uid;
    }catch(e){}
    try{ return localStorage.getItem("dh_logged_uid") || ""; }catch(e){}
    return "";
  }

  function registerFCM(){
    if(!VAPID_KEY){ return Promise.resolve({ok:false, reason:"VAPID anahtarı ayarlanmadı"}); }
    if(permission()!=="granted"){ return Promise.resolve({ok:false, reason:"İzin yok"}); }
    return Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js")
    ]).then(function(mods){
      var appMod=mods[0], msgMod=mods[1], fsMod=mods[2];
      var app;
      try{
        var existing = appMod.getApps && appMod.getApps();
        app = (existing && existing.length) ? existing[0] : appMod.initializeApp(firebaseConfig);
      }catch(e){ app = appMod.initializeApp(firebaseConfig); }

      return navigator.serviceWorker.register("./firebase-messaging-sw.js", {scope:"./"})
        .then(function(swReg){
          var messaging = msgMod.getMessaging(app);
          // Uygulama ÖN PLANDAYKEN gelen mesajları da göster
          try{
            msgMod.onMessage(messaging, function(p){
              var n = (p && p.notification) || {};
              showNotification({ title:n.title||"Dil Harita", body:n.body||"" });
            });
          }catch(e){}
          return msgMod.getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
        })
        .then(function(token){
          if(!token) return {ok:false, reason:"Token alınamadı"};
          var s = load(); s.fcmToken = token; save(s);
          var uid = currentUid();
          if(uid){
            var db = fsMod.getFirestore(app);
            return fsMod.setDoc(
              fsMod.doc(db, "fcmTokens", uid),
              { token: token, updated_at: Date.now(), ua: navigator.userAgent.slice(0,200) },
              { merge:true }
            ).then(function(){ return {ok:true, token:token}; })
             .catch(function(e){ return {ok:true, token:token, warn:"Firestore yazılamadı: "+(e&&e.message||"")}; });
          }
          return {ok:true, token:token, warn:"Giriş yok; token yerelde saklandı"};
        });
    }).catch(function(e){
      return {ok:false, reason:(e&&e.message)||"FCM başlatılamadı"};
    });
  }

  // ---- Genel: kullanıcı bildirimleri açtığında çağrılır ----
  function enable(hour, minute){
    return requestPermission().then(function(p){
      var s = load();
      if(p==="granted"){
        s.enabled = true;
        if(typeof hour==="number") s.hour = hour;
        if(typeof minute==="number") s.minute = minute;
        save(s);
        startTicking();
        // FCM token'ı arka planda dene (varsa kaydeder)
        registerFCM().then(function(){});
        return { ok:true, permission:p };
      }
      return { ok:false, permission:p };
    });
  }
  function disable(){
    var s = load(); s.enabled = false; save(s);
    if(tickTimer){ clearInterval(tickTimer); tickTimer=null; }
    return { ok:true };
  }
  function setTime(hour, minute){
    var s = load(); s.hour = hour; s.minute = minute; s.lastShownDate=""; save(s);
    return load();
  }
  function testNotification(){
    return requestPermission().then(function(p){
      if(p!=="granted") return { ok:false, permission:p };
      return showNotification({
        title:"🔔 Bildirim testi",
        body:"Harika! Bildirimler çalışıyor. Her gün seçtiğin saatte hatırlatacağım."
      }).then(function(ok){ return { ok:ok, permission:p }; });
    });
  }

  // ---- Dışa açılan API ----
  window.DHNotifications = {
    supported: supported,
    permission: permission,
    load: load,
    enable: enable,
    disable: disable,
    setTime: setTime,
    test: testNotification,
    registerFCM: registerFCM,
    checkOnLoad: checkOnLoad,
    _build: buildMessage
  };

  // ---- Otomatik başlat ----
  function boot(){
    // storage-bridge hazır olunca ayarlar doğru okunur
    try{
      var s = load();
      if(s.enabled && permission()==="granted"){
        startTicking();
        // Açılışta gecikmeli kontrol (StudyTracker yüklensin diye)
        setTimeout(checkOnLoad, 2500);
      }
    }catch(e){}
  }
  if(window.__dhStorageReady){ boot(); }
  else{
    window.addEventListener("dh-storage-ready", boot, { once:true });
    // Güvenlik: event hiç gelmezse 1.5 sn sonra yine de başlat
    setTimeout(function(){ if(!window.__dhNotifBooted){ window.__dhNotifBooted=true; boot(); } }, 1500);
  }
})();
