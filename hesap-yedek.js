/* ════════════════════════════════════════════════════════════════════
   HESAP DEĞİŞİMİNDE YEREL VERİYİ KENARA KALDIRMA  (DHHesapYedek)
   --------------------------------------------------------------------
   Sorun: Aynı tarayıcıda A çıkış yapıp B giriş yaparsa, A'nın yerel
   verisi (ilerleme, kartlar, sohbetler, API anahtarları…) bulut
   eşitlemesiyle B'nin hesabına karışıyordu.

   Çözüm: Bu tarayıcıdaki verinin sahibi "dh-yerel-sahip" anahtarında
   tutulur. Sahip olmayan biri giriş yapınca:
     1) sahibin bütün yerel verisi (localStorage + kullanıcı IndexedDB'leri,
        API anahtarları dahil) bu cihazdaki "DilHaritaYerelYedek"
        veritabanına, sahibin uid'iyle etiketlenip kopyalanır;
     2) yerel veri temizlenir (oturum anahtarları ve Firebase'in kendi
        kayıtları hariç);
     3) giren kişinin bu cihazda daha önce kenara kaldırılmış yedeği
        varsa olduğu gibi geri yüklenir; yoksa temiz başlar ve verisini
        buluttan alır.
   Yedek YALNIZ bu cihazda durur; Firebase'e ya da başka bir yere
   gönderilmez. Kopyalama başarısız olursa hiçbir şey silinmez.
   ════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  if (window.DHHesapYedek) return;
  var SAHIP = "dh-yerel-sahip";
  var YEDEK_DB = "DilHaritaYerelYedek", YEDEK_STORE = "yedek";
  /* yedeklenmeyen ve silinmeyen anahtarlar: oturum işaretleri */
  var KORU = ["dh_logged_in", "dh_logged_uid", "dh_logged_email", "dh_remember", SAHIP];
  var KORU_ON = ["firebase:"];
  /* kullanıcı verisi tutan IndexedDB'ler (indexedDB.databases() ile bulunanlar da eklenir) */
  var BILINEN_DB = ["sentence-mode", "sentence-learning-system", "DilHaritaAI_DB", "DilHaritaYouTube_DB", "DilharitaDB", "DilHaritaSecureVault"];
  function dbHaricMi(ad){ return !ad || ad === YEDEK_DB || /^firebase/i.test(ad) || /^firestore/i.test(ad) || /^workbox/i.test(ad); }

  function sahip(){ try{ return localStorage.getItem(SAHIP) || ""; }catch(e){ return ""; } }
  function sahipYaz(uid){ try{ if(uid) localStorage.setItem(SAHIP, uid); }catch(e){} }
  function korunurMu(k){ return KORU.indexOf(k) >= 0 || KORU_ON.some(function(p){ return k.indexOf(p) === 0; }); }

  function istek(r){ return new Promise(function(ok, hata){ r.onsuccess = function(){ ok(r.result); }; r.onerror = function(){ hata(r.error); }; }); }
  function bitti(tx){ return new Promise(function(ok, hata){ tx.oncomplete = function(){ ok(); }; tx.onerror = function(){ hata(tx.error); }; tx.onabort = function(){ hata(tx.error || new Error("abort")); }; }); }

  async function dbListesi(){
    var adlar = BILINEN_DB.slice();
    try{ if (indexedDB.databases){ (await indexedDB.databases()).forEach(function(d){ if (d && d.name && adlar.indexOf(d.name) < 0) adlar.push(d.name); }); } }catch(e){}
    return adlar.filter(function(a){ return !dbHaricMi(a); });
  }
  /* var olan DB'yi aç; yoksa OLUŞTURMA (null döndür) */
  function varOlaniAc(ad){
    return new Promise(function(ok){
      var yeni = false, r;
      try{ r = indexedDB.open(ad); }catch(e){ return ok(null); }
      r.onupgradeneeded = function(){ yeni = true; try{ r.transaction.abort(); }catch(e){} };
      r.onsuccess = function(){ if (yeni){ try{ r.result.close(); }catch(e){} return ok(null); } ok(r.result); };
      r.onerror = function(){ ok(null); };
      r.onblocked = function(){ ok(null); };
    });
  }

  async function dbDok(ad){
    var db = await varOlaniAc(ad); if (!db) return null;
    try{
      var out = { surum: db.version, depolar: {} };
      var adlar = Array.prototype.slice.call(db.objectStoreNames);
      for (var i = 0; i < adlar.length; i++){
        var tx = db.transaction(adlar[i], "readonly"), st = tx.objectStore(adlar[i]);
        var sema = { keyPath: st.keyPath, autoIncrement: st.autoIncrement, indexler: [] };
        Array.prototype.slice.call(st.indexNames).forEach(function(n){ var x = st.index(n); sema.indexler.push({ ad: n, keyPath: x.keyPath, unique: x.unique, multiEntry: x.multiEntry }); });
        var anahtarlar = await istek(st.getAllKeys()), degerler = await istek(st.getAll());
        out.depolar[adlar[i]] = { sema: sema, anahtarlar: anahtarlar, degerler: degerler };
      }
      return out;
    } finally { try{ db.close(); }catch(e){} }
  }
  async function dbTemizle(ad){
    var db = await varOlaniAc(ad); if (!db) return;
    try{
      var adlar = Array.prototype.slice.call(db.objectStoreNames); if (!adlar.length) return;
      var tx = db.transaction(adlar, "readwrite"); adlar.forEach(function(s){ tx.objectStore(s).clear(); }); await bitti(tx);
    } finally { try{ db.close(); }catch(e){} }
  }
  async function dbYukle(ad, dok){
    var db = await varOlaniAc(ad);
    if (!db){   /* bu cihazda yok: kaydedilen şemayla oluştur */
      db = await new Promise(function(ok, hata){
        var r = indexedDB.open(ad, dok.surum || 1);
        r.onupgradeneeded = function(){ var d = r.result;
          Object.keys(dok.depolar).forEach(function(s){ var sm = dok.depolar[s].sema || {};
            if (d.objectStoreNames.contains(s)) return;
            var o = {}; if (sm.keyPath != null) o.keyPath = sm.keyPath; if (sm.autoIncrement) o.autoIncrement = true;
            var st = d.createObjectStore(s, o);
            (sm.indexler || []).forEach(function(x){ try{ st.createIndex(x.ad, x.keyPath, { unique: !!x.unique, multiEntry: !!x.multiEntry }); }catch(e){} }); }); };
        r.onsuccess = function(){ ok(r.result); }; r.onerror = function(){ hata(r.error); };
      });
    }
    try{
      var adlar = Object.keys(dok.depolar).filter(function(s){ return db.objectStoreNames.contains(s); }); if (!adlar.length) return;
      var tx = db.transaction(adlar, "readwrite");
      adlar.forEach(function(s){ var st = tx.objectStore(s), v = dok.depolar[s]; st.clear();
        (v.degerler || []).forEach(function(deger, i){ if (st.keyPath != null) st.put(deger); else st.put(deger, v.anahtarlar[i]); }); });
      await bitti(tx);
    } finally { try{ db.close(); }catch(e){} }
  }

  function yedekDb(){
    return new Promise(function(ok, hata){
      var r = indexedDB.open(YEDEK_DB, 1);
      r.onupgradeneeded = function(){ if (!r.result.objectStoreNames.contains(YEDEK_STORE)) r.result.createObjectStore(YEDEK_STORE, { keyPath: "uid" }); };
      r.onsuccess = function(){ ok(r.result); }; r.onerror = function(){ hata(r.error); };
    });
  }
  async function yedekYaz(kayit){ var db = await yedekDb(); try{ var tx = db.transaction(YEDEK_STORE, "readwrite"); tx.objectStore(YEDEK_STORE).put(kayit); await bitti(tx); } finally { db.close(); } }
  async function yedekOku(uid){ var db = await yedekDb(); try{ return (await istek(db.transaction(YEDEK_STORE, "readonly").objectStore(YEDEK_STORE).get(uid))) || null; } finally { db.close(); } }
  async function yedekSil(uid){ var db = await yedekDb(); try{ var tx = db.transaction(YEDEK_STORE, "readwrite"); tx.objectStore(YEDEK_STORE).delete(uid); await bitti(tx); } finally { db.close(); } }
  async function yedekListe(){ var db = await yedekDb(); try{ return ((await istek(db.transaction(YEDEK_STORE, "readonly").objectStore(YEDEK_STORE).getAll())) || []).map(function(y){ return { uid: y.uid, email: y.email || "", at: y.at, anahtar: Object.keys(y.ls || {}).length }; }); } finally { db.close(); } }

  function yerelAnahtarlar(){ var out = []; try{ for (var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if (k != null && !korunurMu(k)) out.push(k); } }catch(e){} return out; }

  /* Ana iş: giriş yapan uid bu tarayıcının sahibi değilse kenara kaldır / geri yükle. */
  var calisiyor = null;
  function hazirla(uid, email){
    if (!uid) return Promise.resolve({ degisti: false });
    if (calisiyor) return calisiyor;
    calisiyor = (async function(){
      var eski = sahip();
      if (!eski){ sahipYaz(uid); try{ if (email) localStorage.setItem("dh-yerel-sahip-eposta", email); }catch(e){} return { degisti: false, sahiplendi: true }; }   /* ilk kez: mevcut veri bu kişinin */
      if (eski === uid) return { degisti: false };
      /* 1) eski sahibin verisini kenara kaldır */
      var ls = {}; yerelAnahtarlar().forEach(function(k){ try{ ls[k] = localStorage.getItem(k); }catch(e){} });
      var idb = {}, dbler = await dbListesi();
      for (var i = 0; i < dbler.length; i++){ try{ var d = await dbDok(dbler[i]); if (d) idb[dbler[i]] = d; }catch(e){ throw new Error("Yedek alınamadı (" + dbler[i] + "): " + (e && e.message || e)); } }
      var eskiEposta = ""; try{ eskiEposta = localStorage.getItem("dh-yerel-sahip-eposta") || ""; }catch(e){}
      await yedekYaz({ uid: eski, email: eskiEposta, at: Date.now(), ls: ls, idb: idb });
      /* doğrula: yazılan yedek okunabiliyor mu? değilse hiçbir şeyi silme */
      var dog = await yedekOku(eski);
      if (!dog || Object.keys(dog.ls || {}).length !== Object.keys(ls).length) throw new Error("Yedek doğrulanamadı; yerel veri silinmedi.");
      /* 2) temizle */
      Object.keys(ls).forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} });
      for (var j = 0; j < dbler.length; j++){ try{ await dbTemizle(dbler[j]); }catch(e){} }
      /* 3) yeni kişinin yedeği varsa geri yükle */
      var geri = await yedekOku(uid), geriYuklendi = false;
      if (geri){
        Object.keys(geri.ls || {}).forEach(function(k){ try{ localStorage.setItem(k, geri.ls[k]); }catch(e){} });
        var ad = Object.keys(geri.idb || {});
        for (var n = 0; n < ad.length; n++){ try{ await dbYukle(ad[n], geri.idb[ad[n]]); }catch(e){ try{ console.warn("[hesap-yedek] geri yüklenemedi", ad[n], e); }catch(_){} } }
        await yedekSil(uid); geriYuklendi = true;
      }
      sahipYaz(uid); try{ if (email) localStorage.setItem("dh-yerel-sahip-eposta", email); }catch(e){}
      try{ sessionStorage.setItem("dh-hesap-degisti", JSON.stringify({ eski: eski, yeni: uid, geriYuklendi: geriYuklendi, at: Date.now() })); }catch(e){}
      return { degisti: true, eski: eski, geriYuklendi: geriYuklendi };
    })().finally(function(){ calisiyor = null; });
    return calisiyor;
  }

  window.DHHesapYedek = { sahip: sahip, hazirla: hazirla, liste: yedekListe,
    /* sahip e-postasını kaydet (yedek listesinde kimin olduğu görünsün) */
    epostaYaz: function(email){ try{ if (email) localStorage.setItem("dh-yerel-sahip-eposta", email); }catch(e){} } };
})();
