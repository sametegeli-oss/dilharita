/* firebase-messaging-sw.js
   FCM arka plan bildirim alıcısı.
   Uygulama kapalı/arka plandayken gelen push'ları gösterir.
   Bu dosya KÖK dizinde olmalı (FCM burada arar).

   NOT: Bu ayrı bir service worker'dır; mevcut sw.js'den bağımsızdır.
   importScripts ile compat SDK kullanır (SW içinde modül import sınırlı).
*/
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBZTHvP8xX94UMtKRt7hIYN7qpbO2gz0Zg",
  authDomain: "sentencemode.firebaseapp.com",
  projectId: "sentencemode",
  storageBucket: "sentencemode.firebasestorage.app",
  messagingSenderId: "1048475533632",
  appId: "1:1048475533632:web:3f719b6da4397ed7c53aa5"
});

var messaging = firebase.messaging();

// Arka planda mesaj gelince bildirim göster
messaging.onBackgroundMessage(function(payload){
  var n = (payload && payload.notification) || {};
  var data = (payload && payload.data) || {};
  var title = n.title || data.title || "Dil Harita";
  var options = {
    body: n.body || data.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: data.tag || "dh-push",
    renotify: true,
    data: { url: data.url || "./index.html" }
  };
  return self.registration.showNotification(title, options);
});

// Bildirime tıklayınca uygulamayı aç (açıksa ona odaklan)
self.addEventListener("notificationclick", function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "./index.html";
  event.waitUntil(
    self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(function(list){
      for(var i=0;i<list.length;i++){
        var c = list[i];
        if(c.url && c.url.indexOf("index.html")!==-1 && "focus" in c) return c.focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
