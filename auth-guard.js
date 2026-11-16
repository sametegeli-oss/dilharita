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
  /* Giriş işareti çerezde de tutulur (login.html): localStorage dolunca
     (QuotaExceededError) "dh_logged_in" yazılamıyordu → giriş döngüsü. */
  function cerez(ad){ var m=document.cookie.match(new RegExp("(?:^|; )"+ad+"=([^;]*)")); return m?m[1]:null; }
  function cerezSil(ad){ var yol=location.pathname.replace(/[^/]*$/,""); document.cookie=ad+"=; path="+yol+"; max-age=0"; }
  function hasLocalLogin(){ return ls("dh_logged_in") === "1" || cerez("dh_auth") === "1"; }
  function remembered(){ return ls("dh_remember") === "1" || cerez("dh_rem") === "1"; }
  function clearLocalLogin(){
    try{
      localStorage.removeItem("dh_logged_in");
      localStorage.removeItem("dh_logged_uid");
      localStorage.removeItem("dh_logged_email");
    }catch(e){}
    try{ sessionStorage.removeItem("dh_session_ok"); }catch(e){}
    try{ cerezSil("dh_auth"); }catch(e){}
  }
  var gidiyor = false;
  /* DÖNGÜ SİGORTASI: bir hata yüzünden giriş ↔ sayfa arasında gidip
     gelinirse (16 Kasım'da oldu) 30 sn içinde 3. yönlendirmede durur,
     sayfayı açık bırakır ve kullanıcıya not gösterir. */
  function donguVar(){
    try{
      var now=Date.now(), arr=JSON.parse(sessionStorage.getItem("dh_guard_hops")||"[]").filter(function(t){ return now-t<30000; });
      arr.push(now); sessionStorage.setItem("dh_guard_hops", JSON.stringify(arr));
      return arr.length>=3;
    }catch(e){ return false; }
  }
  function donguNotu(){
    try{
      var d=document.createElement("div"); d.setAttribute("role","alert");
      d.style.cssText="position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;background:#1e293b;color:#f8fafc;border:2px solid #f59e0b;border-radius:14px;padding:12px 14px;font:600 16px/1.45 system-ui";
      d.textContent="Oturum doğrulanamadı. Çalışmaya devam edebilirsin; sorun sürerse Kitaplık menüsünden çıkış yapıp yeniden giriş yap.";
      (document.body||document.documentElement).appendChild(d);
      setTimeout(function(){ try{ d.remove(); }catch(e){} }, 9000);
    }catch(e){}
  }
  function goLogin(){
    if (gidiyor) return;
    if (donguVar()){ try{ document.documentElement.style.visibility=""; }catch(e){} if(document.body) donguNotu(); else document.addEventListener("DOMContentLoaded", donguNotu); return; }
    gidiyor = true;
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
    /* KALICILIĞA DOKUNULMAZ. Oturumun nerede saklanacağını yalnız
       login.html seçer ("Bu cihazda hatırla": IndexedDB, değilse oturumluk).
       Eskiden burada setPersistence(localStorage) çağrılıyordu: oturum
       IndexedDB'deyken Firebase onu göremiyor, "çıkış yapılmış" sanıyordu.
       Sonuç: giriş ↔ ana sayfa döngüsü ve haftalarca buluta yazılmayan veri.
       getAuth varsayılan olarak IndexedDB, localStorage ve sessionStorage'ın
       hepsine bakar. authStateReady, kayıtlı oturum okunana kadar bekler. */
    var hazir = auth.authStateReady ? auth.authStateReady()
      : new Promise(function(r){ var u=authMod.onAuthStateChanged(auth,function(){ try{u();}catch(e){} r(); }); });
    hazir.then(function(){
      var user = auth.currentUser;
      if (user){
        try{ localStorage.removeItem("dh_guest_mode"); }catch(e){}
        try{ sessionStorage.removeItem("dh_guard_hops"); }catch(e){}
        try{ localStorage.setItem("dh_logged_in","1"); }catch(e){}
        try{ localStorage.setItem("dh_logged_uid", user.uid || ""); }catch(e){}
        try{ if(user.email) localStorage.setItem("dh_logged_email", user.email); }catch(e){}
      } else {
        if (navigator.onLine === false) return;   /* çevrimdışı: yerel işarete güven */
        clearLocalLogin();
        goLogin();
      }
    }).catch(function(){});
  }).catch(function(){
    // İnternet yok / Firebase yüklenemedi: yerel işarete güvenip offline devam.
  });
})();
