/* profile.js — kullanıcı profili: seviye, amaç, günlük hedef, sıradaki modül
   ==================================================================
   NEDEN AYRI BİR DOSYA: uygulamada zaten bir birleştirme katmanı var —
   progress-engine.js, window.DHProgress'i tanımlıyor (NEW/LEARNING/LEARNED,
   recordResult, getStatus, summaryAll, bulut aynası) ve ilgili 15 sayfada yüklü.
   Bu dosya ONU EZMEZ, yanına oturur. window.DHProgress'e dokunmaz.

   DHProgress'in kapsamadığı üç boşluğu kapatıyor:

   1) SEVİYE. Seviye testi sonucu yalnızca öğretmen anayasasına
      (dh-teacher-policy-v1) yazılıyordu; onu sadece AI öğretmen okuyor.
      Öğrenme akışı (modül seçici, koç, ders motoru) seviyeyi hiç bilmiyordu.
      Ayrıca gemini-lesson.js'in okuduğu "dh-level" anahtarını hiçbir kod
      yazmıyordu — o kontrol her zaman boş dönüyordu.
      setLevel() üçüne birden yazar: profil, dh-level, öğretmen anayasası.

   2) PROFİL. Amaç ve günlük hedef hiçbir yerde tutulmuyordu; koç ekranındaki
      "0/5 cümle" hedefi sabit kodluydu.

   3) SIRADAKİ MODÜL. Bu mantık koc.js içinde gömülüydü ve seviyeyi hesaba
      katmıyordu; yeni kullanıcı hep A1-M01'den başlıyordu.

   API:
     DHProfile.get()                 {amac, seviye, gunlukHedef, aiYontemi, kurulumBitti, ...}
     DHProfile.set(patch)
     DHProfile.level()               "B1" | null
     DHProfile.setLevel(lvl, meta)
     DHProfile.hedef()               günlük cümle hedefi (varsayılan 5)
     await DHProfile.nextModule()    seviyeye uygun sıradaki modül adı
     await DHProfile.moduleStat(mod) {toplam, ogrenilen, yuzde}
*/
(function () {
  "use strict";
  if (window.DHProfile) return;

  var K_PROFILE = "dh-profile-v1";
  var K_LEVEL   = "dh-level";
  var K_POLICY  = "dh-teacher-policy-v1";
  var K_VISITED = "dh-mod-visited-v1";
  var DB = "sentence-mode", STORE = "kv";
  var ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

  function lsGet(k, fb) {
    try { var v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); }
    catch (e) { return fb; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }
  function today() { return new Date().toISOString().slice(0, 10); }

  /* ---------- profil ---------- */
  function get() { return lsGet(K_PROFILE, {}) || {}; }

  function set(patch) {
    var p = get();
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) p[k] = patch[k];
    p.guncellendi = Date.now();
    lsSet(K_PROFILE, p);
    return p;
  }

  function hedef() {
    var h = parseInt(get().gunlukHedef, 10);
    return (h > 0 && h < 500) ? h : 5;
  }

  /* Yas/egitim bilgisi seviyeyi belirlemez. Yalniz anlatim bicimi, baglam
     ve gunluk calisma porsiyonunu yonlendiren kisa bir ozet uretir. */
  function kisisellestirmeOzeti() {
    var p=get(), out=[];
    if(p.yasAraligi) out.push("Yaş aralığı: "+p.yasAraligi);
    if(p.egitimDurumu) out.push("Eğitim: "+p.egitimDurumu);
    if(p.meslek) out.push("Meslek/alan: "+p.meslek);
    if(p.ilgiAlanlari) out.push("İlgi alanları: "+p.ilgiAlanlari);
    if(p.amac) out.push("Öğrenme amacı: "+p.amac);
    if(p.anlatimTercihi) out.push("Anlatım tercihi: "+p.anlatimTercihi);
    if(p.gunlukDakika) out.push("Günlük ayırabileceği süre: "+p.gunlukDakika+" dakika");
    if(!out.length) return "";
    return "KULLANICI TERCİHLERİ (İngilizce seviyesini bunlardan çıkarma; yalnız anlatım, örnek ve bağlamı uyarla): "+out.join("; ")+".";
  }

  /* ---------- seviye ---------- */
  function level() {
    var p = get();
    if (p.seviye) return p.seviye;
    var pol = lsGet(K_POLICY, {}) || {};
    if (pol.seviye) return pol.seviye;
    var raw = "";
    try { raw = localStorage.getItem(K_LEVEL) || ""; } catch (e) {}
    var m = /(A1|A2|B1|B2|C1|C2)/.exec(String(raw));
    return m ? m[1] : null;
  }

  function setLevel(lvl, meta) {
    if (!lvl || ORDER.indexOf(lvl) < 0) return false;
    set({ seviye: lvl, seviyeTarih: Date.now(), seviyeTesti: meta || get().seviyeTesti });
    lsSet(K_LEVEL, lvl);                       // gemini-lesson.js bunu okuyor
    try {
      if (window.DHTeacherPolicy) {
        window.DHTeacherPolicy.set("seviye", lvl);
        if (meta) window.DHTeacherPolicy.set("seviyeTesti", meta);
      }
    } catch (e) {}
    return true;
  }

  /* ---------- IndexedDB'den ham ilerleme (yalnızca okuma) ---------- */
  var _raw = null;
  function readProgress() {
    if (_raw) return _raw;
    _raw = new Promise(function (res) {
      var out = { srs: {}, sent: {}, prog: {} };
      try {
        if (!window.indexedDB) return res(out);
        var r = window.indexedDB.open(DB, 1);
        r.onerror = function () { res(out); };
        r.onupgradeneeded = function () {
          try { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); } catch (e) {}
        };
        r.onsuccess = function () {
          var db = r.result;
          if (!db.objectStoreNames.contains(STORE)) { try { db.close(); } catch (e) {} return res(out); }
          try {
            var q = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
            q.onsuccess = function (e) {
              var c = e.target.result;
              if (!c) { try { db.close(); } catch (e2) {} return res(out); }
              var k = String(c.key);
              if (k.indexOf("srs:") === 0) out.srs[k.slice(4)] = c.value;
              else if (k.indexOf("sentence:") === 0) out.sent[k.slice(9)] = c.value;
              else if (k.indexOf("prog:sentence:") === 0) out.prog[k.slice(14)] = c.value;
              c.continue();
            };
            q.onerror = function () { try { db.close(); } catch (e3) {} res(out); };
          } catch (e4) { res(out); }
        };
      } catch (e5) { res(out); }
    });
    return _raw;
  }
  function invalidate() { _raw = null; }

  /* Bir cümlenin durumu — üç depoyu da hesaba katar.
     progress-engine.js "prog:", eski React tarafı "sentence:", pratik sayfaları
     "srs:" kullanıyor. Ekranların birbirini tutması için tek yorum burada. */
  function learned(R, id) {
    var p = R.prog[id];
    if (p && typeof p.status === "number" && p.status === 2) return true;
    var m = R.sent[id];
    if (m && m[0] === 2) return true;
    var s = R.srs[id];
    return !!(s && (s.rep || 0) >= 2);
  }
  function touched(R, id) {
    return !!(R.prog[id] || R.sent[id] || R.srs[id]);
  }

  /* ---------- modül istatistiği ---------- */
  function moduleStat(mod) {
    return Promise.all([readProgress(), window.DHSent ? window.DHSent.index() : Promise.resolve(null)])
      .then(function (a) {
        var R = a[0], ix = a[1];
        if (!ix) return { toplam: 0, ogrenilen: 0, yuzde: 0 };
        var meta = null;
        for (var i = 0; i < ix.modules.length; i++)
          if (ix.modules[i].mod === mod) { meta = ix.modules[i]; break; }
        if (!meta) return { toplam: 0, ogrenilen: 0, yuzde: 0 };
        var ids = meta.ids || [], n = 0;
        for (var j = 0; j < ids.length; j++) if (learned(R, ids[j])) n++;
        return { toplam: ids.length, ogrenilen: n,
                 yuzde: ids.length ? Math.round(n / ids.length * 100) : 0 };
      });
  }

  /* ---------- sıradaki modül ----------
     koc.js'teki öncelik sırasının aynısı, iki farkla:
       - üç ilerleme deposunu da okur (koc.js yalnız ikisini okuyordu)
       - kullanıcının seviyesi biliniyorsa oradan başlar */
  function nextModule() {
    return Promise.all([readProgress(), window.DHSent ? window.DHSent.index() : Promise.resolve(null)])
      .then(function (a) {
        var R = a[0], ix = a[1];
        if (!ix || !ix.modules.length) return null;
        var mods = ix.modules.slice();
        var lvl = level(), from = lvl ? ORDER.indexOf(lvl) : -1;
        if (from >= 0) {
          var ust = mods.filter(function (m) { return ORDER.indexOf(m.lvl) >= from; });
          var alt = mods.filter(function (m) { return ORDER.indexOf(m.lvl) <  from; });
          mods = ust.concat(alt);   // seviyesi ve üstü önce; altı tekrar için erişilebilir kalır
        }
        var vis = lsGet(K_VISITED, {}) || {}, gun = today();

        function varUnseen(m) {
          var ids = m.ids || [];
          for (var i = 0; i < ids.length; i++) if (!touched(R, ids[i])) return true;
          return false;
        }
        function varEksik(m) {
          var ids = m.ids || [];
          for (var i = 0; i < ids.length; i++) if (!learned(R, ids[i])) return true;
          return false;
        }
        var i;
        for (i = 0; i < mods.length; i++)
          if (vis[mods[i].mod] === gun && varUnseen(mods[i])) return mods[i].mod;
        for (i = 0; i < mods.length; i++) if (varUnseen(mods[i])) return mods[i].mod;
        for (i = 0; i < mods.length; i++) if (varEksik(mods[i])) return mods[i].mod;
        return mods[0].mod;
      });
  }

  window.DHProfile = {
    get: get, set: set,
    level: level, setLevel: setLevel,
    hedef: hedef, kisisellestirmeOzeti: kisisellestirmeOzeti,
    nextModule: nextModule,
    moduleStat: moduleStat,
    invalidate: invalidate
  };
})();
