/* sentences-loader.js — parçalı cümle verisi için tembel yükleyici
   ------------------------------------------------------------------
   data/sentences.json (8,5 MB) artık çalışma anında hiç istenmiyor. Yerine
   veri-bol.mjs ile üretilen parçalar kullanılıyor:

     data/sentences/index.json         modül listesi + id'ler   (gzip ~27 KB)
     data/sentences/mod/<slug>.json    modül başına kayıtlar    (gzip ~5 KB)
     data/sentences/test-pool.json     seviye sınavı havuzu     (gzip ~94 KB)
     data/sentences/examples.json      tüm cümleler id/en/tr    (gzip ~294 KB)
     data/sentences/img-queries.json   cümle -> imgQuery        (gzip ~172 KB)

   API (window.DHSent):
     await DHSent.index()          -> {v,total,levels,modules:[{lvl,mod,f,n,ids}]}
     await DHSent.module("A1-M01 Be Verb · P1") -> [kayıt, ...]
     await DHSent.level("A1")      -> o seviyenin tüm kayıtları
     await DHSent.byIds([id,...])  -> {id: kayıt}  (yalnız gereken modüller iner)
     await DHSent.findById(id)     -> kayıt | null
     await DHSent.testPool()       -> [{id,level,en,tr,grammar}, ...]
     await DHSent.examples()       -> [{id,en,tr}, ...]  TÜM cümleler (kelime araması)
     await DHSent.imgQueries()     -> {normalizeEn: imgQuery}
     await DHSent.all()            -> tüm kayıtlar (yalnız zorunlu hâllerde!)
     DHSent.moduleIds(mod)         -> [id,...]  (index yüklendikten sonra, senkron)

   GÜVENLİK AĞI: parçalar bulunamazsa (henüz üretilmediyse) otomatik olarak eski
   data/sentences.json'a düşer, böylece hiçbir sayfa bozulmaz.
*/
(function () {
  "use strict";
  if (window.DHSent) return;

  var BASE = "data/sentences/";
  var LEGACY = ["data/sentences.json", "./data/sentences.json", "sentences.json"];

  var _index = null;        // Promise
  var _mods = {};           // slug -> Promise<array>
  var _byName = null;       // module adı -> index kaydı
  var _pool = null, _img = null, _all = null;
  var _legacy = null;       // eski dosyaya düşüldüyse Promise<array>

  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + " → HTTP " + r.status);
      return r.json();
    });
  }

  function legacyAll() {
    if (_legacy) return _legacy;
    _legacy = (function () {
      var i = 0;
      function next() {
        if (i >= LEGACY.length) return Promise.reject(new Error("cümle verisi bulunamadı"));
        return getJSON(LEGACY[i++]).catch(next);
      }
      return next();
    })();
    return _legacy;
  }

  /* ---------- index ---------- */
  function index() {
    if (_index) return _index;
    _index = getJSON(BASE + "index.json").then(function (ix) {
      _byName = {};
      (ix.modules || []).forEach(function (m) { _byName[m.mod] = m; });
      return ix;
    }).catch(function () {
      // parçalar yok → eski dosyadan index'i bellekte kur
      return legacyAll().then(function (arr) {
        var map = {}, order = [];
        arr.forEach(function (s) {
          var m = s.module || "?";
          if (!map[m]) { map[m] = []; order.push(m); }
          map[m].push(s);
        });
        var modules = order.map(function (m) {
          var a = map[m].slice().sort(function (x, y) { return (x.order || 0) - (y.order || 0); });
          _mods["legacy:" + m] = Promise.resolve(a);
          return { lvl: (a[0] && a[0].level) || "A1", mod: m, f: "legacy:" + m, n: a.length,
                   ids: a.map(function (s) { return s.id; }) };
        });
        var lvls = [];
        ["A1","A2","B1","B2","C1","C2"].forEach(function (l) {
          if (modules.some(function (m) { return m.lvl === l; })) lvls.push(l);
        });
        var ix = { v: 0, total: arr.length, levels: lvls, modules: modules, legacy: true };
        _byName = {};
        modules.forEach(function (m) { _byName[m.mod] = m; });
        return ix;
      });
    });
    return _index;
  }

  /* ---------- tek modül ---------- */
  function moduleByEntry(entry) {
    if (!entry) return Promise.resolve([]);
    if (_mods[entry.f]) return _mods[entry.f];
    _mods[entry.f] = getJSON(BASE + "mod/" + entry.f + ".json").catch(function () {
      // bu parça inmedi → eski dosyadan süz
      return legacyAll().then(function (arr) {
        return arr.filter(function (s) { return s.module === entry.mod; })
                  .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      });
    });
    return _mods[entry.f];
  }

  function module_(name) {
    return index().then(function () { return moduleByEntry(_byName[name]); });
  }

  function moduleIds(name) {
    return (_byName && _byName[name] && _byName[name].ids) || [];
  }

  /* ---------- seviye ---------- */
  function level(lvl) {
    return index().then(function (ix) {
      var mods = ix.modules.filter(function (m) { return m.lvl === lvl; });
      return Promise.all(mods.map(moduleByEntry)).then(function (chunks) {
        return [].concat.apply([], chunks);
      });
    });
  }

  /* ---------- id ile ---------- */
  function byIds(ids) {
    var want = {};
    (ids || []).forEach(function (i) { want[String(i)] = 1; });
    return index().then(function (ix) {
      var need = ix.modules.filter(function (m) {
        for (var i = 0; i < m.ids.length; i++) if (want[m.ids[i]]) return true;
        return false;
      });
      return Promise.all(need.map(moduleByEntry)).then(function (chunks) {
        var out = {};
        chunks.forEach(function (arr) {
          arr.forEach(function (s) { if (want[String(s.id)]) out[String(s.id)] = s; });
        });
        /* KULLANICI MODULLERI (dh-modul.js) — resmi veride bulunmayan
           uretilmis cumleler de cozulsun. Olmadan tekrar.html bu
           cumlelerin metnini bulamayip ekranda kimlik gosteriyordu.
           Resmi kayit varsa o kazanir; uretilen yalnizca bosluk doldurur. */
        try{
          if (window.DHModul && DHModul.cumleMap){
            var kul = DHModul.cumleMap();
            for (var kid in kul){ if (want[kid] && !out[kid]) out[kid] = kul[kid]; }
          }
        }catch(e){}
        return out;
      });
    });
  }

  function findById(id) {
    return byIds([id]).then(function (m) { return m[String(id)] || null; });
  }

  /* ---------- hafif havuzlar ---------- */
  function testPool() {
    if (_pool) return _pool;
    _pool = getJSON(BASE + "test-pool.json").catch(function () { return legacyAll(); });
    return _pool;
  }

  /* TÜM cümlelerin id/en/tr hâli — kelime baloncuğu "bu kelime hangi cümlelerde
     geçiyor" diye ararken kapsamın %100 olması için gerekiyor. Modül parçalarıyla
     yapılamaz: kullanıcının açmadığı modüldeki kelime bulunamazdı. */
  var _ex = null;
  function examples() {
    if (_ex) return _ex;
    _ex = getJSON(BASE + "examples.json").catch(function () {
      return legacyAll().then(function (arr) {
        return arr.filter(function (s) { return s && s.en; })
                  .map(function (s) { return { id: s.id, en: s.en, tr: s.tr || "" }; });
      });
    });
    return _ex;
  }

  function imgQueries() {
    if (_img) return _img;
    _img = getJSON(BASE + "img-queries.json").catch(function () {
      return legacyAll().then(function (arr) {
        var norm = function (s) {
          return String(s || "").toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9' ]/g, "").trim();
        };
        var m = {};
        arr.forEach(function (s) { if (s.en && s.imgQuery) m[norm(s.en)] = s.imgQuery; });
        return m;
      });
    });
    return _img;
  }

  /* ---------- son çare: hepsi ----------
     Sadece nadiren gereken yollar için (ör. cümle metniyle derin link).
     506 parçayı paralel indirir; eski davranıştan yavaş değildir ama
     mümkün olan her yerde module()/byIds() tercih edilmeli. */
  function all() {
    if (_all) return _all;
    _all = index().then(function (ix) {
      return Promise.all(ix.modules.map(moduleByEntry)).then(function (chunks) {
        return [].concat.apply([], chunks);
      });
    });
    return _all;
  }

  window.DHSent = {
    index: index,
    module: module_,
    moduleIds: moduleIds,
    level: level,
    byIds: byIds,
    findById: findById,
    testPool: testPool,
    examples: examples,
    imgQueries: imgQueries,
    all: all
  };
})();
