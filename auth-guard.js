/* auth-guard.js
   Her sayfada oturum bekçisi — OFFLINE DESTEKLİ.

   Mantık:
   1) Önce yerel işarete bak (localStorage "dh_logged_in"). Varsa sayfayı HEMEN aç
      (internet beklemeden). Bu, çevrimdışı kullanımı ve hızlı açılışı sağlar.
   2) Yerel işaret YOKSA misafir kullanımına izin verir. Veriler cihazda tutulur.
   3) Hesap varsa ve internet açıksa Firebase oturumu arka planda yine de doğrular. Oturum gerçekten
      geçersizse (örn. başka cihazda çıkış yapılmış) yerel işareti temizleyip login'e atar.

   login.html'in kendisinde çalışmaz (sonsuz döngü olmasın).
*/
(function(){
  "use strict";

  /* Kimlik doğrulama kullanan eski sayfalarda ortak erişilebilirlik, çevrimdışı
     durum, hata günlüğü ve PWA güncelleme katmanını da garanti et. */
  if(!document.querySelector('script[src*="ux-boost.js"]')){
    var ux=document.createElement("script"); ux.src="./ux-boost.js?v=2"; document.head.appendChild(ux);
  }

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

  function oturumNotu(){
    try{
      if(document.getElementById("dhOturumNotu")) return;
      var d=document.createElement("div");
      d.id="dhOturumNotu"; d.setAttribute("role","status");
      d.style.cssText="position:fixed;left:8px;right:8px;top:8px;z-index:99999;background:#1e293b;color:#f8fafc;border:2px solid #f59e0b;border-radius:14px;padding:12px 14px;font:600 17px/1.45 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4);display:flex;flex-wrap:wrap;gap:8px;align-items:center";
      d.innerHTML='<span style="flex:1 1 220px">Hesabından çıkış yapılmış. Çalışmaya devam edebilirsin; ilerlemen bu cihazda saklanıyor.</span>'
        +'<button type="button" id="dhOturumGir" style="min-height:44px;padding:8px 14px;border-radius:10px;border:0;background:#6366f1;color:#fff;font:700 16px system-ui">Tekrar giriş yap</button>'
        +'<button type="button" id="dhOturumKapat" style="min-height:44px;padding:8px 14px;border-radius:10px;border:1px solid #64748b;background:transparent;color:#f8fafc;font:700 16px system-ui">Kapat</button>';
      (document.body||document.documentElement).appendChild(d);
      document.getElementById("dhOturumGir").onclick=goLogin;
      document.getElementById("dhOturumKapat").onclick=function(){ d.remove(); };
    }catch(e){ goLogin(); }
  }

  // --- 1) Yerel işaret yoksa: ürünü misafir olarak aç. Hesap, yalnızca
  // bulut eşitleme istendiğinde gerekir; ilk değeri görmeden giriş duvarı yoktur. ---
  if (!hasLocalLogin()){
    try{ localStorage.setItem("dh_guest_mode", "1"); }catch(e){}
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
    var nullTimer = null;
    authMod.onAuthStateChanged(auth, function(user){
      if (user){
        decided = true;
        if (nullTimer){ clearTimeout(nullTimer); nullTimer=null; }
        try{
          localStorage.setItem("dh_logged_in","1");
          localStorage.setItem("dh_logged_uid", user.uid || "");
          if(user.email) localStorage.setItem("dh_logged_email", user.email);
        }catch(e){}
      } else {
        if (decided) return;
        // İlk null GEÇİCİ olabilir (mobilde persistence gecikmesi). Kısa bekle;
        // 1.5 sn içinde gerçek oturum gelmezse, oturum gerçekten yok → login'e at.
        if (nullTimer) return;
        nullTimer = setTimeout(function(){
          if (decided) return;
          decided = true;
          clearLocalLogin();
          /* 50-80 yaş: kullanıcıyı çalışırken giriş ekranına FIRLATMA.
             Misafir olarak devam etsin; üstte nazik bir not çıksın. */
          try{ localStorage.setItem("dh_guest_mode", "1"); }catch(e){}
          oturumNotu();
        }, 2500);
      }
    });
  }).catch(function(){
    // İnternet yok / Firebase yüklenemedi: yerel işarete güvenip offline devam.
  });
})();
