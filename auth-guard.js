/* auth-guard.js — Her sayfada oturum bekçisi (ZORUNLU GİRİŞ, 16 Kasım)
   ====================================================================
   Karar (kullanıcı isteği): Dil Harita açılışta şifre ister; misafir
   kullanım yoktur. Böylece her cihaz hesaba bağlı olur ve veriler
   Firebase'e gider (misafir modda haftalarca buluta hiçbir şey
   gitmediği fark edilmemişti).

   Mantık:
   1) Yerel işaret yoksa ("dh_logged_in") → login.html.
   2) "Bu cihazda hatırla" KAPALIYSA (dh_remember !== "1") giriş yalnız bu
      oturum için geçerlidir: sessionStorage "dh_session_ok" yoksa
      (uygulama/tarayıcı kapatılıp açılmış) → login.html.
   3) "Bu cihazda hatırla" AÇIKSA sayfa HEMEN açılır (internet beklemeden,
      çevrimdışı da çalışır).
   4) İnternet varsa Firebase oturumu arka planda doğrulanır; oturum
      gerçekten yoksa (başka cihazdan çıkış, depolama temizlenmiş) yerel
      işaret temizlenir ve login.html açılır.

   Herkese açık kalan sayfalar: login.html, veri-gizlilik.html (gizlilik
   metni girişten önce okunabilmeli), pwa-hard-reset.html (kurtarma aracı).
   ==================================================================== */
(function(){
  "use strict";

  /* Kimlik doğrulama kullanan eski sayfalarda ortak erişilebilirlik, çevrimdışı
     durum, hata günlüğü ve PWA güncelleme katmanını da garanti et. */
  if(!document.querySelector('script[src*="ux-boost.js"]')){
    var ux=document.createElement("script"); ux.src="./ux-boost.js?v=2"; document.head.appendChild(ux);
  }

  var page = decodeURIComponent((location.pathname.split("/").pop() || "index.html")).toLowerCase();
  var PUBLIC = ["login.html", "veri-gizlilik.html", "pwa-hard-reset.html"];
  if (PUBLIC.indexOf(page) !== -1) return;

  function ls(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function ss(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
  function hasLocalLogin(){ return ls("dh_logged_in") === "1"; }
  function remembered(){ return ls("dh_remember") === "1"; }
  function clearLocalLogin(){
    try{
      localStorage.removeItem("dh_logged_in");
      localStorage.removeItem("dh_logged_uid");
      localStorage.removeItem("dh_logged_email");
    }catch(e){}
    try{ sessionStorage.removeItem("dh_session_ok"); }catch(e){}
  }
  var gidiyor = false;
  function goLogin(){
    if (gidiyor) return; gidiyor = true;
    /* Yönlendirme sürerken sayfa içeriği bir an görünmesin. */
    try{ document.documentElement.style.visibility = "hidden"; }catch(e){}
    var son = location.pathname.split("/").pop() || "index.html";
    try{ son = decodeURIComponent(son); }catch(e){}
    var here = son + (location.search || "") + (location.hash || "");
    location.replace("./login.html?next=" + encodeURIComponent(here));
  }

  // --- 1) ve 2): giriş yoksa ya da hatırlanmayan oturum kapanmışsa ---
  if (!hasLocalLogin() || (!remembered() && ss("dh_session_ok") !== "1")) {
    goLogin();
    return;
  }

  // --- 3) Giriş var: sayfa açılır. İnternet varsa arka planda doğrula. ---
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
    /* Kalıcılık "Bu cihazda hatırla" tercihine uyar: hatırlanmayan oturum
       sekme/uygulama kapanınca biter. (Eskiden her sayfa kalıcıya çeviriyordu.) */
    try{
      if(remembered()){
        if(authMod.setPersistence && authMod.browserLocalPersistence) authMod.setPersistence(auth, authMod.browserLocalPersistence);
      } else if(authMod.setPersistence && authMod.browserSessionPersistence){
        authMod.setPersistence(auth, authMod.browserSessionPersistence);
      }
    }catch(e){}

    var decided = false;
    var nullTimer = null;
    authMod.onAuthStateChanged(auth, function(user){
      if (user){
        decided = true;
        if (nullTimer){ clearTimeout(nullTimer); nullTimer=null; }
        try{
          localStorage.setItem("dh_logged_in","1");
          localStorage.setItem("dh_logged_uid", user.uid || "");
          if(user.email) localStorage.setItem("dh_logged_email", user.email);
          localStorage.removeItem("dh_guest_mode");
        }catch(e){}
      } else {
        if (decided) return;
        // İlk null GEÇİCİ olabilir (mobilde kalıcılık gecikmesi). 6 sn içinde
        // gerçek oturum gelmezse oturum gerçekten yok → giriş ekranı.
        if (nullTimer) return;
        nullTimer = setTimeout(function(){
          if (decided) return;
          decided = true;
          clearLocalLogin();
          goLogin();
        }, 6000);
      }
    });
  }).catch(function(){
    // İnternet yok / Firebase yüklenemedi: yerel işarete güvenip offline devam.
  });
})();
