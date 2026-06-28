/* auth-guard.js
   Her sayfada oturum bekçisi — OFFLINE DESTEKLİ.

   Mantık:
   1) Önce yerel işarete bak (localStorage "dh_logged_in"). Varsa sayfayı HEMEN aç
      (internet beklemeden). Bu, çevrimdışı kullanımı ve hızlı açılışı sağlar.
   2) Yerel işaret YOKSA login.html'e yönlendir.
   3) İnternet varsa Firebase oturumu arka planda yine de doğrular. Oturum gerçekten
      geçersizse (örn. başka cihazda çıkış yapılmış) yerel işareti temizleyip login'e atar.

   login.html'in kendisinde çalışmaz (sonsuz döngü olmasın).
*/
(function(){
  "use strict";

  var path = (location.pathname || "").toLowerCase();
  if (path.indexOf("login.html") !== -1) return;

  function hasLocalLogin(){
    try{ return localStorage.getItem("dh_logged_in") === "1"; }catch(e){ return false; }
  }
  function clearLocalLogin(){
    try{
      localStorage.removeItem("dh_logged_in");
      localStorage.removeItem("dh_logged_uid");
      localStorage.removeItem("dh_logged_email");
    }catch(e){}
  }
  function goLogin(){
    var here = (location.pathname.split("/").pop() || "index.html") + (location.search || "");
    location.replace("./login.html?next=" + encodeURIComponent(here));
  }

  // --- 1) Yerel işaret yoksa: hemen login'e (Firebase'e hiç gitmeden) ---
  if (!hasLocalLogin()){
    goLogin();
    return;
  }

  // --- Yerel işaret VAR: sayfa açılır. İnternet varsa arka planda doğrula. ---
  var firebaseConfig = {
    apiKey: "AIzaSyBZTHvP8xX94UMtKRt7hIYN7qpbO2gz0Zg",
    authDomain: "sentencemode.firebaseapp.com",
    projectId: "sentencemode",
    storageBucket: "sentencemode.firebasestorage.app",
    messagingSenderId: "1048475533632",
    appId: "1:1048475533632:web:3f719b6da4397ed7c53aa5"
  };

  // Arka plan doğrulaması — sayfayı engellemez. İnternet yoksa import başarısız olur,
  // sorun değil; yerel işarete güvenip devam ederiz (offline çalışma).
  Promise.all([
    import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js")
  ]).then(function(mods){
    var appMod = mods[0], authMod = mods[1];
    var app;
    try{
      var existing = appMod.getApps && appMod.getApps();
      app = (existing && existing.length) ? existing[0] : appMod.initializeApp(firebaseConfig);
    }catch(e){ app = appMod.initializeApp(firebaseConfig); }
    var auth = authMod.getAuth(app);
    try{
      if(authMod.setPersistence && authMod.browserLocalPersistence){
        authMod.setPersistence(auth, authMod.browserLocalPersistence);
      }
    }catch(e){}

    var decided = false;
    authMod.onAuthStateChanged(auth, function(user){
      if (decided) return;
      decided = true;
      if (user){
        try{
          localStorage.setItem("dh_logged_in","1");
          localStorage.setItem("dh_logged_uid", user.uid || "");
          if(user.email) localStorage.setItem("dh_logged_email", user.email);
        }catch(e){}
      } else {
        // Firebase "oturum yok" diyor. Ama "beni hatırla" AÇIKSA bu, mobilde
        // persistence gecikmesi/temizliği yüzünden gelen GEÇİCİ bir null olabilir.
        // Kullanıcıyı atma — yerel işarete güven (offline/kalıcı oturum).
        var remembered = false;
        try{ remembered = localStorage.getItem("dh_remember")==="1"; }catch(e){}
        if(!remembered){
          clearLocalLogin();
          goLogin();
        }
        // remembered ise: sessizce devam, sayfa açık kalır.
      }
    });
  }).catch(function(){
    // İnternet yok / Firebase yüklenemedi: yerel işarete güvenip offline devam.
  });
})();
