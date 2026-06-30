/* ai-status.js — AI DURUM MERKEZİ
   Dil Harita — Aşama 0 mimari temel.

   Tüm AI özellikleri (kayan öğretmen, açıklama, ileride roleplay/düzeltme)
   AI'yı doğrudan çağırmadan ÖNCE buraya sorar: "AI şu an kullanılabilir mi?"

   AI kullanılamaz olduğunda (anahtar yok / limit dolu / internet yok / anayasada
   kapalı) uygulama ÇÖKMEZ — kurallı (offline) moda zarifçe düşer.

   Kullanım:
     if (DHAI.available()) { ... AI çağır ... } else { ... kurallı alternatif ... }
     DHAI.noteRateLimit();   // bir AI çağrısı limite takılınca işaretle
     DHAI.noteSuccess();     // başarılı AI çağrısından sonra
     DHAI.reason();          // neden kullanılamıyor (mesaj göstermek için)
*/
(function(global){
  "use strict";
  if (global.DHAI) return;

  var RATE_BAN_MS = 60 * 1000;       // limit yiyince 60 sn AI'yı kapalı say
  var _rateUntil = 0;                // bu zamana kadar AI rate-limit nedeniyle kapalı

  function policyAiOpen(){
    try{
      if (global.DHTeacherPolicy){
        var p = DHTeacherPolicy.load();
        if (p && p.ai && p.ai.acik === false) return false;
      }
    }catch(e){}
    return true; // anayasa yoksa veya belirtilmemişse açık varsay
  }

  function hasKeys(){
    try{
      // Çok sağlayıcılı: herhangi birinde anahtar varsa yeterli
      if(global.DHProviders && DHProviders.hasAnyKey) return DHProviders.hasAnyKey();
      // yedek: doğrudan kontrol
      var stores=["groqApiKeys","cerebrasApiKeys","geminiApiKeys"];
      for(var i=0;i<stores.length;i++){
        var ks=JSON.parse(localStorage.getItem(stores[i])||"[]")||[];
        if(ks.filter(Boolean).length>0) return true;
      }
      return false;
    }catch(e){ return false; }
  }

  function online(){
    // navigator.onLine güvenilir değil ama "kesin offline" durumunu yakalar
    try{ return navigator.onLine !== false; }catch(e){ return true; }
  }

  function rateLimited(){ return Date.now() < _rateUntil; }

  // AI şu an kullanılabilir mi? (tüm koşullar)
  function available(){
    if (!policyAiOpen()) return false;   // anayasada kapatılmış
    if (!hasKeys())      return false;   // Groq anahtarı yok
    if (!online())       return false;   // internet yok
    if (rateLimited())   return false;   // geçici limit
    return true;
  }

  // Neden kullanılamıyor — kullanıcıya kısa mesaj için
  function reason(){
    if (!policyAiOpen()) return "AI öğretmen ayarlardan kapalı.";
    if (!hasKeys())      return "AI için bir anahtar gerekiyor (Groq, Cerebras veya Gemini — öğretmen sayfasından ekle).";
    if (!online())       return "İnternet yok — öğretmen şu an çevrimdışı modda.";
    if (rateLimited()){
      var sec = Math.max(1, Math.ceil((_rateUntil - Date.now())/1000));
      return "AI öğretmen şu an dinleniyor (~" + sec + " sn). Kurallı modda devam.";
    }
    return "";
  }

  function noteRateLimit(){ _rateUntil = Date.now() + RATE_BAN_MS; }
  function noteSuccess(){ _rateUntil = 0; }

  global.DHAI = {
    available: available,
    reason: reason,
    noteRateLimit: noteRateLimit,
    noteSuccess: noteSuccess,
    hasKeys: hasKeys,
    online: online
  };
})(window);
