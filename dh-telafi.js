/* dh-telafi.js — Dil Harita geri kalmis seviye telafisi
   ---------------------------------------------------------------
   NE ISE YARAR
   Kullanicinin seviyesi B1 olabilir ama hata defteri A2'de yigilmis
   olabilir — yani ust seviyede ilerlerken alt seviyede bosluk birakmis.
   Bu modul o boslugu bulur ve o seviyeden somut bir modul onerir.

   Koc bu oneriyi gunun planina bir adim olarak ekler ve kullaniciya
   NEDENINI soyler ("A2'de son 30 gunde 7 hata yaptin").

   NEDEN AYRI DOSYA
   profile.js seviyenin ve modul seciminin sahibi; ona dokunmuyoruz
   cunku koc.js, ders.html ve harita.html hepsi ona bagli. Telafi ayri
   bir kavram, ayri dosyada durur.

   VERI KAYNAKLARI (hepsi yerel — cevrimdisi calisir)
     DHProfile.level()        kullanicinin seviyesi
     DHProfile.moduleStat()   modulun tamamlanma yuzdesi
     LearningErrorDB.all()    hata kayitlari (ts, level, module, sentenceId)
     DHSent.index()           modul listesi + seviyeleri

   SEVIYE COZUMU — uc kademeli, ilki bulunca durur:
     1. kaydin kendi level alani           ("A2")
     2. modul adinin oneki                 ("A2-M03 Past Simple · P1")
     3. cumle kimliginin oneki             ("A2-M03-P1-014")
   Boylece eski kayitlarda level bos olsa da seviye cikarilabiliyor.

   ── GUN ICINDE DONAR (dh-telafi-gun-<YYYY-MM-DD>) ──
   Secim her cagrida yeniden HESAPLANMIYOR. Sebep olculdu: modul secimi
   "en dusuk tamamlanma yuzdesi"ne dayaniyor ve bu yuzde gun icinde
   calistikca degisiyordu. Sonuc: sabah "Demonstratives · P4" diyen adim
   ogleden sonra "· P2" oluyordu. Iki ayri zarar:
     1) Kullaniciya gun icinde baska bir modul gosteriliyordu.
     2) DHPlan defteri gunun basinda DONUYOR. Plandaki href degisince
        defterdeki href ile eslesme kalmiyor, dh-plan-kopru.js hicbir
        adimi bulamiyor ve ilerleme sayimi TAMAMEN susuyordu
        ("5 cumle calistim, hala 0/5" sikayetinin ucuncu yolu).
   Artik gunun ilk hesabi donduruluyor; sonuc null olsa bile donuyor
   (plan gun icinde buyumesin — dh-plan.js'in "hedef gun icinde donar"
   ilkesiyle ayni disiplin). Yarin yeniden hesaplanir.

   API
     DHTelafi.bul()      -> Promise<null | {
                              seviye, hataSayisi, modul, modulKisa,
                              turler:[...], yuzde
                            }>
     DHTelafi.hesapla()  -> dondurmadan HESAPLAR (tani/test icin)
     DHTelafi.sifirla()  -> bugunun dondurulmus secimini siler
     DHTelafi.ESIK       varsayilan esik (3 hata)
*/
(function (global) {
  "use strict";
  if (global.DHTelafi) return;

  var SIRA = ["A1", "A2", "B1", "B2", "C1", "C2"];
  var ESIK = 3;                 /* bir seviyede en az kac hata "bosluk" sayilir */
  var PENCERE = 30 * 86400000;  /* son 30 gun */
  var GUN_ONEK = "dh-telafi-gun-";
  /* koc.js ve index.html ile AYNI gun anahtari (toISOString) */
  function bugunKey() { return GUN_ONEK + new Date().toISOString().slice(0, 10); }

  function idx(lvl) {
    var i = SIRA.indexOf(String(lvl || "").toUpperCase());
    return i < 0 ? -1 : i;
  }

  /* Bir hata kaydinin seviyesini coz. Bos donebilir. */
  function kayitSeviyesi(r) {
    if (!r) return "";
    var l = String(r.level || "").toUpperCase();
    if (idx(l) >= 0) return l;

    var kaynaklar = [r.module, r.sentenceId, r.id];
    for (var i = 0; i < kaynaklar.length; i++) {
      var m = String(kaynaklar[i] || "").toUpperCase().match(/^([ABC][12])\b|^([ABC][12])-/);
      if (m) {
        var bulunan = m[1] || m[2];
        if (idx(bulunan) >= 0) return bulunan;
      }
    }
    return "";
  }

  /* Modul adindan kisa etiket: "A2-M03 Past Simple · P1" -> "Past Simple · P1" */
  function kisaAd(mod) {
    return String(mod || "").replace(/^[A-C][12]-M\d+\s*/, "").trim() || String(mod || "");
  }

  function hatalar() {
    try {
      if (global.LearningErrorDB && global.LearningErrorDB.all) {
        return global.LearningErrorDB.all();
      }
    } catch (e) {}
    return Promise.resolve([]);
  }

  /* Seviyesi kullanicinin ALTINDA olan ve esigi asan seviyeleri bul.
     En DUSUK seviyeden baslanir — temel once onarilir. */
  function bosluklar(kayitlar, benimSeviye) {
    var benim = idx(benimSeviye);
    if (benim <= 0) return [];          /* seviye bilinmiyor ya da zaten A1 */

    var simdi = Date.now();
    var say = {}, turler = {};

    (kayitlar || []).forEach(function (r) {
      var ts = r.ts || 0;
      if (ts && simdi - ts > PENCERE) return;
      var lvl = kayitSeviyesi(r);
      if (!lvl) return;
      if (idx(lvl) >= benim) return;    /* kendi seviyesi ya da ustu: bosluk degil */

      say[lvl] = (say[lvl] || 0) + 1;
      if (!turler[lvl]) turler[lvl] = {};
      var tl = (Array.isArray(r.types) && r.types.length) ? r.types
             : (r.primaryType ? [r.primaryType] : (r.type ? [r.type] : []));
      tl.forEach(function (t) { turler[lvl][t] = (turler[lvl][t] || 0) + 1; });
    });

    return Object.keys(say)
      .filter(function (l) { return say[l] >= ESIK; })
      .sort(function (a, b) { return idx(a) - idx(b); })   /* en dusuk once */
      .map(function (l) {
        var t = turler[l] || {};
        return {
          seviye: l,
          hataSayisi: say[l],
          turler: Object.keys(t).sort(function (a, b) { return t[b] - t[a]; }).slice(0, 3)
        };
      });
  }

  /* O seviyede tamamlanmamis ilk modulu sec. */
  function seviyedeModul(seviye) {
    if (!global.DHSent || !global.DHSent.index) return Promise.resolve(null);
    return global.DHSent.index().then(function (ix) {
      if (!ix || !ix.modules) return null;
      var adaylar = ix.modules.filter(function (m) {
        return String(m.lvl || "").toUpperCase() === seviye;
      });
      if (!adaylar.length) return null;

      /* En dusuk tamamlanma yuzdesine sahip modul — en zayif halka. */
      var isler = adaylar.map(function (m) {
        if (!(global.DHProfile && global.DHProfile.moduleStat)) {
          return Promise.resolve({ mod: m.mod, yuzde: 0 });
        }
        return global.DHProfile.moduleStat(m.mod).then(function (st) {
          return { mod: m.mod, yuzde: (st && st.yuzde) || 0 };
        }).catch(function () { return { mod: m.mod, yuzde: 0 }; });
      });

      return Promise.all(isler).then(function (sonuc) {
        var eksik = sonuc.filter(function (x) { return x.yuzde < 100; });
        if (!eksik.length) return null;          /* seviye zaten tamam */
        eksik.sort(function (a, b) { return a.yuzde - b.yuzde; });
        return eksik[0];
      });
    }).catch(function () { return null; });
  }

  /* ---------- HESAP (dondurmasiz) ---------- */
  function hesapla() {
    var seviye = null;
    try { if (global.DHProfile && global.DHProfile.level) seviye = global.DHProfile.level(); }
    catch (e) {}
    if (!seviye || idx(seviye) <= 0) return Promise.resolve(null);

    return hatalar().then(function (kayitlar) {
      var bos = bosluklar(kayitlar, seviye);
      if (!bos.length) return null;

      var hedef = bos[0];
      return seviyedeModul(hedef.seviye).then(function (m) {
        if (!m) return null;
        return {
          seviye: hedef.seviye,
          hataSayisi: hedef.hataSayisi,
          turler: hedef.turler,
          modul: m.mod,
          modulKisa: kisaAd(m.mod),
          yuzde: m.yuzde
        };
      });
    }).catch(function () { return null; });
  }

  /* ---------- ANA: gun icinde DONMUS secim ---------- */
  function donmusOku() {
    try {
      var ham = localStorage.getItem(bugunKey());
      if (ham === null) return undefined;          /* henuz donmadi */
      return JSON.parse(ham);                      /* null da gecerli bir sonuctur */
    } catch (e) { return undefined; }
  }
  function dondur(v) {
    try {
      localStorage.setItem(bugunKey(), JSON.stringify(v === undefined ? null : v));
      /* onceki gunlerin anahtarlari birikmesin */
      var bu = bugunKey();
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf(GUN_ONEK) === 0 && k !== bu) localStorage.removeItem(k);
      }
    } catch (e) {}
  }

  var _ucus = null;     /* ayni anda iki cagri (koc.js + index.html) iki farkli
                           sonuc dondurmesin: ilk hesap paylasilir */
  function bul() {
    var d = donmusOku();
    if (d !== undefined) return Promise.resolve(d);
    if (_ucus) return _ucus;
    _ucus = hesapla().then(function (r) {
      var son = donmusOku();                       /* baska sekme donduduysa ona uy */
      if (son !== undefined) { _ucus = null; return son; }
      dondur(r || null);
      _ucus = null;
      return r || null;
    }).catch(function () { _ucus = null; return null; });
    return _ucus;
  }
  function sifirla() {
    try { localStorage.removeItem(bugunKey()); } catch (e) {}
    _ucus = null;
  }

  global.DHTelafi = {
    bul: bul,
    hesapla: hesapla,
    sifirla: sifirla,
    ESIK: ESIK,
    _kayitSeviyesi: kayitSeviyesi,
    _bosluklar: bosluklar,
    _kisaAd: kisaAd
  };
})(typeof window !== "undefined" ? window : globalThis);
