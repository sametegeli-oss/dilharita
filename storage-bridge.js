/* storage-bridge.js
   localStorage'ı IndexedDB destekli hale getiren köprü.

   AMAÇ: localStorage'ın küçük kotası (~5MB) dolunca yaşanan
   QuotaExceededError sorununu kökten çözmek. Mevcut kodun
   hiçbir satırını değiştirmeden, tüm localStorage.getItem/
   setItem/removeItem çağrılarını bellek + IndexedDB'ye yönlendirir.

   ÇALIŞMA MANTIĞI:
   - Sayfa açılışında IndexedDB'deki tüm anahtarlar belleğe okunur.
   - localStorage.getItem/setItem/removeItem/clear/key/length
     senkron şekilde bu bellek kopyasını kullanır (eski kod aynen çalışır).
   - Her yazma arka planda IndexedDB'ye kaydedilir (kota neredeyse sınırsız).
   - İlk açılışta, varsa eski gerçek localStorage verisi IndexedDB'ye taşınır.

   ÖNEMLİ: Bu dosya, depolama kullanan TÜM diğer scriptlerden ÖNCE,
   sayfanın <head> kısmının başına yüklenmelidir.
*/
(function(){
  "use strict";
  if (window.__dhStorageBridgeInstalled) return;
  window.__dhStorageBridgeInstalled = true;

  var DB_NAME = "dh-storage";
  var STORE = "kv";
  var dbPromise = null;

  function openDB(){
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject){
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(){
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
    return dbPromise;
  }

  function idbGetAll(){
    return openDB().then(function(db){
      return new Promise(function(resolve){
        var out = {};
        try{
          var tx = db.transaction(STORE, "readonly");
          var store = tx.objectStore(STORE);
          var cur = store.openCursor();
          cur.onsuccess = function(){
            var c = cur.result;
            if (c){ out[c.key] = c.value; c.continue(); }
            else resolve(out);
          };
          cur.onerror = function(){ resolve(out); };
        }catch(e){ resolve(out); }
      });
    });
  }

  function idbSet(key, val){
    return openDB().then(function(db){
      return new Promise(function(resolve){
        try{
          var tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).put(val, key);
          tx.oncomplete = function(){ resolve(true); };
          tx.onerror = function(){ resolve(false); };
        }catch(e){ resolve(false); }
      });
    });
  }

  function idbDel(key){
    return openDB().then(function(db){
      return new Promise(function(resolve){
        try{
          var tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).delete(key);
          tx.oncomplete = function(){ resolve(true); };
          tx.onerror = function(){ resolve(false); };
        }catch(e){ resolve(false); }
      });
    });
  }

  function idbClear(){
    return openDB().then(function(db){
      return new Promise(function(resolve){
        try{
          var tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).clear();
          tx.oncomplete = function(){ resolve(true); };
          tx.onerror = function(){ resolve(false); };
        }catch(e){ resolve(false); }
      });
    });
  }

  // Bellek içi senkron ayna (eski kodun beklediği senkron davranış için)
  var mem = {};
  // Yazma kuyruğu (arka planda IndexedDB'ye sırayla yazılır)
  var writeQueue = Promise.resolve();
  function queueWrite(fn){ writeQueue = writeQueue.then(fn).catch(function(){}); }

  // Orijinal localStorage'a referans (taşıma için)
  var nativeLS = null;
  try{ nativeLS = window.localStorage; }catch(e){ nativeLS = null; }

  // Yeni senkron localStorage arayüzü (bellek üstünden çalışır, IDB'ye yansıtır)
  var shim = {
    getItem: function(k){
      k = String(k);
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
    },
    setItem: function(k, v){
      k = String(k); v = String(v);
      mem[k] = v;
      queueWrite(function(){ return idbSet(k, v); });
    },
    removeItem: function(k){
      k = String(k);
      delete mem[k];
      queueWrite(function(){ return idbDel(k); });
    },
    clear: function(){
      mem = {};
      queueWrite(function(){ return idbClear(); });
    },
    key: function(i){
      var keys = Object.keys(mem);
      return i >= 0 && i < keys.length ? keys[i] : null;
    },
    get length(){ return Object.keys(mem).length; }
  };

  // localStorage'ı shim ile değiştir
  function install(){
    try{
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get: function(){ return shim; }
      });
    }catch(e){
      // defineProperty başarısızsa metodları doğrudan ata (kısmi)
      try{
        window.localStorage.getItem = shim.getItem;
        window.localStorage.setItem = shim.setItem;
        window.localStorage.removeItem = shim.removeItem;
        window.localStorage.clear = shim.clear;
      }catch(_){}
    }
  }

  // Başlatma: IDB'yi belleğe yükle, eski LS verisini taşı, sonra shim'i kur.
  // Senkron kod IDB hazır olmadan çalışabileceği için, önce eski LS'yi
  // belleğe alıp shim'i HEMEN kuruyoruz; IDB yüklenince birleştiriyoruz.
  function preloadFromNativeLS(){
    if (!nativeLS) return;
    try{
      for (var i = 0; i < nativeLS.length; i++){
        var k = nativeLS.key(i);
        if (k == null) continue;
        if (k === "__dh_idb_migrated__") continue;
        mem[k] = nativeLS.getItem(k);
      }
    }catch(e){}
  }

  // 1) Eski localStorage verisini belleğe al (senkron, anında)
  preloadFromNativeLS();
  // 2) shim'i hemen kur (artık tüm çağrılar bellekten çalışır)
  install();

  // 3) IndexedDB'yi yükle ve belleği birleştir (asenkron)
  idbGetAll().then(function(stored){

    // IDB'de "migrated" işareti var mı?
    var alreadyMigrated = stored.__dh_idb_migrated__ === "1";

    if (!alreadyMigrated){
      // İlk kez: bellekteki (eski LS'den gelen) her şeyi IDB'ye yaz
      var pending = [];
      for (var k in mem){
        if (mem.hasOwnProperty(k)) pending.push(idbSet(k, mem[k]));
      }
      Promise.all(pending).then(function(){
        return idbSet("__dh_idb_migrated__","1");
      }).then(function(){
        mem["__dh_idb_migrated__"] = "1";
        // Veri artık IDB'de güvende → eski localStorage'ı boşalt (kotayı serbest bırak)
        try{
          if (nativeLS){
            var keys = [];
            for (var j = 0; j < nativeLS.length; j++){ var kk = nativeLS.key(j); if (kk) keys.push(kk); }
            keys.forEach(function(kk){ try{ nativeLS.removeItem(kk); }catch(e){} });
          }
        }catch(e){}
      }).catch(function(e){
        // Taşıma başarısızsa localStorage'a DOKUNMA (veri kaybını önle)
        console.warn("storage-bridge: taşıma tamamlanamadı, eski veri korunuyor.", e);
      });
    } else {
      // Sonraki açılışlar: IDB ana kaynak. Belleği IDB ile birleştir
      // (IDB'deki değerler önceliklidir, çünkü en güncel olan o)
      for (var sk in stored){
        if (stored.hasOwnProperty(sk)) mem[sk] = stored[sk];
      }
    }

    // Hazır olduğunu bildir (isteyen scriptler bekleyebilir)
    window.__dhStorageReady = true;
    try{ window.dispatchEvent(new Event("dh-storage-ready")); }catch(e){}
  }).catch(function(e){
    // IndexedDB hiç açılamazsa (çok eski tarayıcı / gizli mod):
    // bellek + (mümkünse) eski localStorage ile devam et, çökme.
    window.__dhStorageReady = true;
    try{ window.dispatchEvent(new Event("dh-storage-ready")); }catch(_){}
    console.warn("storage-bridge: IndexedDB kullanılamadı, bellek modunda devam ediliyor.", e);
  });
})();
