/* onboarding-guard.js — ilk kurulum kapısı
   Yeni kullanıcı doğrudan koç ekranına düşüyordu: "0/5 cümle" yazan, seviyesi
   bilinmeyen, alt menüsünde 40 kapı olan bir ekran. Bu dosya, kurulumu
   tamamlamamış kullanıcıyı bir kereliğine basla.html'e yönlendirir.

   Sadece başlangıç sayfasına (index.html) eklenir — kullanıcıyı uygulamanın
   içinde bir yere kilitlemesin diye. Atlayan bir daha görmez.
*/
(function(){
  "use strict";
  try{
    var p = JSON.parse(localStorage.getItem("dh-profile-v1") || "{}") || {};
    if(p.kurulumBitti) return;

    /* Kurulumu bitirmemiş ama uygulamayı zaten kullanmış olabilir (eski kullanıcı).
       Öyleyse rahatsız etme: seviyesi veya öğretmen anayasası varsa kurulmuş say. */
    var pol = {};
    try{ pol = JSON.parse(localStorage.getItem("dh-teacher-policy-v1") || "{}") || {}; }catch(e){}
    var eskiKullanici = !!(pol.seviye || localStorage.getItem("dh-study-tracker-v1"));
    if(eskiKullanici){
      p.kurulumBitti = true; p.kurulumEskiKullanici = true;
      try{ localStorage.setItem("dh-profile-v1", JSON.stringify(p)); }catch(e){}
      return;
    }

    if(/basla\.html|seviye-testi\.html|login\.html|pwa-/i.test(location.pathname)) return;
    location.replace("./basla.html");
  }catch(e){}
})();
