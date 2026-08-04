/* dh-konusma.js — GUNUN KONUSMA MALZEMESI (Faz 1)
   ================================================================
   COZULEN SORUN
   "1 dakika konus" her gun sifirdan basliyor. Sebep olculdu:
   chat-core.js'teki genFreshOpener() her acilista AI'dan BILEREK
   rastgele/taze bir gunluk konu istiyor ("pick a FRESH everyday topic
   that is NOT one of these recent topics"). Yani sistem kasitli olarak
   ogrenilenle alakasiz bir yerden basliyor. Uygulamada calisilan
   cumlelerin konusmaya hicbir etkisi yok.

   BU DOSYANIN ISI
   Yalnizca MALZEME uretir: bugun hangi cumleler calisildi, hangi
   kaliplar, hangi konu, konusma hangi ORTAMDA gecmeli, hangi senaryo
   sayfasi uyar. Konusma YAPMAZ, AI CAGIRMAZ, DOM'a DOKUNMAZ.
   chat-core.js bu malzemeyi okur.

   ── VERI KAYNAKLARI (olculdu, varsayilmadi) ──
     srs:<cumleId>     {rep, ef, interval, due, last}
                       last = son notlama zamani. "Bugun calisildi mi"
                       sorusunun TEK tarihli cevabi bu.
     prog:<MODUL ADI>  {idx, seen:{<cumleId>:true}}
                       React'in kendi modul defteri (tarihsiz).
     DHSent.byIds()    cumlenin metni + KALIBI: en, tr, pattern,
                       grammar, tense, topic, scenario, commonMistake.

   Kalip kritik: AI'ya cumleyi ezberletmek yerine KALIBI urettiriyoruz
   ("How do I get to [place]?"). Papagan tekrari degil, gercek konusma.
   AMA "pattern" alani 9417 kaydin yalnizca %45.4'unde dolu (olculdu).
   Bu yuzden kalip su sirayla turetilir:
       pattern (%45) -> grammar (%99.9) -> tense (%98.5)
   Boylece her cumle bir kalipla gidiyor.

   ── GUN ICINDE DONAR ──
   dh-konusma-gun-<YYYY-MM-DD>. Sabah ne secildiyse aksam da o.
   dh-plan.js'in "hedef gun icinde donar" ve dh-telafi.js'in ayni
   disiplini. Yoksa gun icinde iki farkli acilis olur ve "sifirdan
   basliyor" hissi geri gelir.

   ── SUREKLILIK ──
   dh-konusma-gecmis-v1: bir cumle ust uste iki gun konusmaya girmez.
   Donmus kayitta "dun" alani tasinir ki acilis "dun yol tarifi
   calismistik, bugun..." diyebilsin.

   API
     DHKonusma.bugun()    -> Promise<null | malzeme>   (donmus)
     DHKonusma.hesapla()  -> Promise<null | malzeme>   (dondurmasiz)
     DHKonusma.sifirla()  -> bugunun donmus secimini siler
     DHKonusma.SENARYOLAR -> eslestirme sozlugu (test/tani)
*/
(function (global) {
  "use strict";
  if (global.DHKonusma) return;

  var DB = "sentence-mode", STORE = "kv";
  var GUN_ONEK = "dh-konusma-gun-";
  var GECMIS = "dh-konusma-gecmis-v1";
  /* SURUM: donmus kaydin uretildigi kod surumu. Kod degisince (or. cumleye
     imgQuery eklendi) eski kayit GECERSIZ sayilip yeniden hesaplanir.
     Bu damga yokken kullanici duzeltmeyi ancak ERTESI GUN gorebiliyordu:
     gunun karari sabah donuyor, gun icinde yayinlanan duzeltme okunmuyordu. */
  var SURUM = 2;
  var ENCOK = 6;                    /* konusmaya girecek cumle sayisi */
  var ENAZ_KONU = 3;                /* konu butunlugu icin alt sinir */
  var HAFTA = 7 * 86400000;

  /* koc.js / index.html / dh-telafi.js ile AYNI gun anahtari */
  function gunISO(d) { return (d || new Date()).toISOString().slice(0, 10); }
  function dunISO() { var d = new Date(); d.setDate(d.getDate() - 1); return gunISO(d); }
  function bugunKey() { return GUN_ONEK + gunISO(); }

  /* ───────────────────── senaryo eslestirme ───────────────────
     Cumlenin topic/scenario alanlari + modul adi taranir. Eslesme
     yoksa OGRETMEN senaryosuna dusulur: saf gramer modulu (Past
     Perfect, Inversion) bir rol senaryosuna zorlanirsa konusma
     yapaylasiyor; ogretmen ise "su kalibi kullanarak cumle kur"
     diyebiliyor. */
  var SENARYOLAR = [
    { sayfa: "chathotel.html",      ad: "Otel",
      kelimeler: ["hotel", "room", "reservation", "check-in", "checkin", "booking", "reception", "otel"] },
    { sayfa: "chatrestaurant.html", ad: "Restoran",
      kelimeler: ["restaurant", "food", "order", "menu", "meal", "eat", "drink", "cafe", "coffee", "breakfast", "lunch", "dinner"] },
    { sayfa: "chatdoctor.html",     ad: "Doktor",
      kelimeler: ["health", "doctor", "pain", "medicine", "hospital", "sick", "ill", "symptom", "body", "appointment"] },
    { sayfa: "chatairport.html",    ad: "Havaalanı",
      kelimeler: ["airport", "flight", "travel", "luggage", "baggage", "ticket", "directions", "transport", "train", "bus", "taxi", "trip", "holiday", "vacation"] }
  ];
  var VARSAYILAN = { sayfa: "chatteacher.html", ad: "Öğretmen" };

  /* ── ORTAM (konusmanin gectigi somut durum) ────────────────────
     Bes sabit senaryoya sikismak gereksiz: verinin kendisinde cumle
     basina "scenario" alani var ve 1922 farkli deger tasiyor
     ("Meeting someone new", "Ordering starter", "Executive Boardroom",
     "Being at home"...). Konusmanin ORTAMI buradan alinir; senaryo
     SAYFASI yalnizca hangi avatarin/rolun kullanilacagini secer.
     Boylece otel resepsiyonisti olmayan bir konu da kendi dogal
     ortaminda gecebilir.

     META degerler ayiklanir: bazi kayitlarda scenario bir ortam degil,
     ogretim notudur ("Correcting mistake of saying 'interested to'
     instead of 'interested in'"). Bunlar ortam olarak kullanilamaz. */
  var META = /correct|mistake|learner|hata|yanlis/i;
  function ortamSec(kayitlar) {
    var say = {};
    (kayitlar || []).forEach(function (r) {
      var s = String(r.scenario || "").trim();
      if (!s || META.test(s)) return;
      if (s.split(/\s+/).length > 9) return;      /* cumle gibi uzunsa ortam degil */
      say[s] = (say[s] || 0) + 1;
    });
    var sirali = Object.keys(say).sort(function (a, b) { return say[b] - say[a]; });
    return { ortam: sirali[0] || "", ortamlar: sirali.slice(0, 4) };
  }
  /* Tek kelimelik ortam muglak olabilir ("Arrival"). Konuyla nitelenir:
     "Restaurant — Arrival". Zaten uzunsa dokunulmaz. */
  function ortamNitele(ortam, konu) {
    if (!ortam) return konu || "";
    if (!konu || ortam.toLowerCase().indexOf(konu.toLowerCase()) >= 0) return ortam;
    return (ortam.split(/\s+/).length <= 2) ? (konu + " — " + ortam) : ortam;
  }

  function senaryoSec(kayitlar, modul) {
    var metin = (String(modul || "") + " " + (kayitlar || []).map(function (r) {
      return [r.topic, r.scenario, r.grammarTags].join(" ");
    }).join(" ")).toLowerCase();

    var enIyi = null, enSkor = 0;
    for (var i = 0; i < SENARYOLAR.length; i++) {
      var s = SENARYOLAR[i], skor = 0;
      for (var j = 0; j < s.kelimeler.length; j++) {
        /* kelime siniri: "eat" -> "theatre" icinde saymasin */
        var re = new RegExp("(^|[^a-z])" + s.kelimeler[j] + "([^a-z]|$)", "g");
        var m = metin.match(re);
        if (m) skor += m.length;
      }
      if (skor > enSkor) { enSkor = skor; enIyi = s; }
    }
    return enIyi || VARSAYILAN;
  }

  /* ───────────────────────── IndexedDB ───────────────────────── */
  function depoOku() {
    return new Promise(function (res) {
      var out = { srs: {}, prog: {} };
      try {
        if (!global.indexedDB) return res(out);
        var r = global.indexedDB.open(DB, 1);
        r.onerror = function () { res(out); };
        r.onsuccess = function () {
          var db = r.result;
          if (!db.objectStoreNames.contains(STORE)) {
            try { db.close(); } catch (e) {}
            return res(out);
          }
          try {
            var q = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
            q.onsuccess = function (e) {
              var c = e.target.result;
              if (!c) { try { db.close(); } catch (e2) {} return res(out); }
              var k = String(c.key);
              if (k.indexOf("srs:") === 0) out.srs[k.slice(4)] = c.value;
              else if (k.indexOf("prog:") === 0) out.prog[k.slice(5)] = c.value;
              c.continue();
            };
            q.onerror = function () { try { db.close(); } catch (e3) {} res(out); };
          } catch (e4) { res(out); }
        };
      } catch (e5) { res(out); }
    });
  }

  /* ───────────────────── id -> modul haritasi ────────────────── */
  function idHaritasi() {
    if (!(global.DHSent && global.DHSent.index)) return Promise.resolve({ id2mod: {}, mods: {} });
    return global.DHSent.index().then(function (ix) {
      var id2mod = {}, mods = {};
      ((ix && ix.modules) || []).forEach(function (m) {
        mods[m.mod] = m.ids || [];
        (m.ids || []).forEach(function (id) { id2mod[id] = m.mod; });
      });
      return { id2mod: id2mod, mods: mods };
    }).catch(function () { return { id2mod: {}, mods: {} }; });
  }

  /* ─────────────────────────── gecmis ────────────────────────── */
  function gecmisOku() {
    try { return JSON.parse(localStorage.getItem(GECMIS) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function gecmisYaz(ids) {
    try {
      var g = gecmisOku(), bugun = gunISO();
      ids.forEach(function (id) { g[id] = bugun; });
      /* sinirsiz buyumesin: 400 kayittan eskiyi at */
      var anahtarlar = Object.keys(g);
      if (anahtarlar.length > 400) {
        anahtarlar.sort(function (a, b) { return String(g[a]).localeCompare(String(g[b])); });
        anahtarlar.slice(0, anahtarlar.length - 400).forEach(function (k) { delete g[k]; });
      }
      localStorage.setItem(GECMIS, JSON.stringify(g));
    } catch (e) {}
  }

  /* ───────────────────────── ana hesap ───────────────────────── */
  function hesapla() {
    return Promise.all([depoOku(), idHaritasi()]).then(function (a) {
      var D = a[0], H = a[1];
      var simdi = Date.now(), bugun = gunISO();

      /* Bir cumle hangi gun notlandi — srs.last TEK tarihli kaynak */
      function gunuOf(id) {
        var s = D.srs[id];
        if (!s || !s.last) return null;
        var d = new Date(s.last);
        return isNaN(d.getTime()) ? null : gunISO(d);
      }

      /* modul -> o modulden uygun cumle kimlikleri */
      function topla(sec) {
        var byMod = {};
        for (var id in D.srs) {
          if (!D.srs.hasOwnProperty(id)) continue;
          var mod = H.id2mod[id];
          if (!mod) continue;                       /* silinmis/bilinmeyen cumle */
          if (!sec(id, D.srs[id])) continue;
          (byMod[mod] = byMod[mod] || []).push(id);
        }
        return byMod;
      }

      /* 1) BUGUN notlananlar */
      var kaynak = "bugun";
      var byMod = topla(function (id) { return gunuOf(id) === bugun; });

      /* 2) SON 7 GUN */
      if (!Object.keys(byMod).length) {
        kaynak = "hafta";
        byMod = topla(function (id, s) { return (s.last || 0) > simdi - HAFTA; });
      }
      /* 3) PEKISMIS cumleler */
      if (!Object.keys(byMod).length) {
        kaynak = "ogrenilmis";
        byMod = topla(function (id, s) { return (s.rep || 0) >= 2; });
      }
      var modAdlari = Object.keys(byMod);
      if (!modAdlari.length) return null;           /* 4) malzeme yok */

      /* En cok cumlesi olan modul; esitlikte en son calisilan kazanir */
      modAdlari.sort(function (x, y) {
        var f = byMod[y].length - byMod[x].length;
        if (f) return f;
        var sonX = Math.max.apply(null, byMod[x].map(function (i) { return (D.srs[i] || {}).last || 0; }));
        var sonY = Math.max.apply(null, byMod[y].map(function (i) { return (D.srs[i] || {}).last || 0; }));
        return sonY - sonX;
      });
      var modul = modAdlari[0];

      /* Ust uste iki gun ayni cumle konusulmasin. Eleme listeyi
         2'nin altina dusuruyorsa uygulanmaz (malzemesiz kalmayalim). */
      var gecmis = gecmisOku(), dun = dunISO();
      var hepsi = byMod[modul].slice();
      var taze = hepsi.filter(function (id) { return gecmis[id] !== bugun && gecmis[id] !== dun; });
      var secilen = (taze.length >= 2 ? taze : hepsi);

      /* modul sirasini koru (mufredat sirasi) */
      var sira = {};
      (H.mods[modul] || []).forEach(function (id, i) { sira[id] = i; });
      secilen.sort(function (x, y) { return (sira[x] || 0) - (sira[y] || 0); });

      if (!(global.DHSent && global.DHSent.byIds)) return null;
      /* Konu butunlugu icin ONCE hepsi okunur, ELEME sonra yapilir.
         Sebep olculdu: modul basina ortalama 5,6 farkli konu var ve
         modullerin %30'unda 5'ten fazla konu geciyor (or. bir "Be Verb"
         modulunde gomlek, corba, bagaj ve bogaz agrisi ayni anda).
         Boyle bir listeden kurulan konusma dagiliyor. */
      return global.DHSent.byIds(secilen).then(function (map) {
        var hepsiKayit = secilen.map(function (id) { return (map || {})[id]; })
                                .filter(function (r) { return r && r.en; });
        if (!hepsiKayit.length) return null;

        /* baskin konu; en az ENAZ_KONU cumle veriyorsa ona sadik kalinir */
        /* META konular baskin sayilmaz: bazi modullerde en sik "topic"
           degeri "Turkish Learner Mistakes Target" gibi bir OGRETIM
           etiketi. Ona odaklanmak konusmayi ortamsiz birakiyordu. */
        var sayac = {};
        hepsiKayit.forEach(function (r) {
          if (r.topic && !META.test(r.topic)) sayac[r.topic] = (sayac[r.topic] || 0) + 1;
        });
        var baskin = Object.keys(sayac).sort(function (x, y) { return sayac[y] - sayac[x]; })[0] || "";
        var odakli = hepsiKayit.filter(function (r) { return r.topic === baskin; });
        var butunluk = odakli.length >= ENAZ_KONU;      /* konu butunlugu kuruldu mu */
        var kayitlar = (butunluk ? odakli : hepsiKayit).slice(0, ENCOK);

        function enSik(alan) {
          var t = {};
          kayitlar.forEach(function (r) { if (r[alan]) t[r[alan]] = (t[r[alan]] || 0) + 1; });
          var k = Object.keys(t).sort(function (x, y) { return t[y] - t[x]; });
          return k[0] || "";
        }
        /* Konu butunlugu YOKSA rol senaryosuna zorlanmaz. Olculdu: bazi
           modullerde 12 cumlenin 12'si ayri konu (gomlek, corba, bagaj,
           bogaz agrisi, matematik, telefon...). Boyle bir listeden
           "restoran" cikarmak gurultuden anlam uretmektir; garson
           rolundeki AI matematikten konusmak zorunda kalir. Bu durumda
           OGRETMEN senaryosu dogru yer: her konuyu kaldirir ve kalip
           calistirmaya uygundur. */
        var sen = butunluk ? senaryoSec(kayitlar, modul) : VARSAYILAN;
        var o = ortamSec(kayitlar);

        return {
          kaynak: kaynak,
          modul: modul,
          seviye: (kayitlar[0] && kayitlar[0].level) || "",
          konu: enSik("topic"),
          ortam: ortamNitele(o.ortam, enSik("topic")),   /* somut durum */
          ortamlar: o.ortamlar,        /* birden fazlaysa AI arasinda gezebilir */
          butunluk: butunluk,          /* false: karisik/tekrar modulu */
          cumleler: kayitlar.map(function (r) {
            return {
              id: r.id, en: r.en, tr: r.tr || "",
              /* kalip: pattern seyrek dolu, grammar/tense yedek (bkz. bas not) */
              kalip: r.pattern || r.grammar || r.tense || "",
              /* Stok medya aramasi icin ELLE YAZILMIS terim
                 ("restaurant entrance, host stand, couple waiting").
                 Kayitlarin %96'sinda dolu; videopractice.html de Pexels'i
                 tam bununla ariyor. dh-ortam-fon.js buradan besleniyor. */
              imgQuery: r.imgQuery || r.imageQuery || "",
              grammar: r.grammar || "",
              commonMistake: r.commonMistake || ""
            };
          }),
          senaryo: sen.sayfa,
          senaryoAd: sen.ad,
          dun: dunOzet()
        };
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  }

  /* Dunun donmus kaydindan kisa ozet — acilis sureklilik kurabilsin */
  function dunOzet() {
    try {
      var ham = localStorage.getItem(GUN_ONEK + dunISO());
      if (!ham) return null;
      var o = JSON.parse(ham);
      if (o && typeof o === "object" && o.s) o = o.v;   /* {s,v} sarmali */
      if (!o || !o.modul) return null;
      return { konu: o.konu || "", modul: o.modul };
    } catch (e) { return null; }
  }

  /* ─────────────────── dondurma (gun icinde sabit) ───────────── */
  function donmusOku() {
    try {
      var ham = localStorage.getItem(bugunKey());
      if (ham === null) return undefined;          /* henuz donmadi */
      var o = JSON.parse(ham);
      /* Kayit bicimi {s:<surum>, v:<sonuc|null>}. Damgasiz ya da eski
         surumlu kayit BAYAT sayilir -> yeniden hesaplanir. */
      if (!o || typeof o !== "object" || o.s !== SURUM) return undefined;
      return o.v;                                  /* null da gecerli sonuc */
    } catch (e) { return undefined; }
  }
  function dondur(v) {
    try {
      localStorage.setItem(bugunKey(), JSON.stringify({ s: SURUM, v: (v === undefined ? null : v) }));
      /* dunku KALIR (sureklilik icin okunuyor), daha eskiler silinir */
      var tut = { }; tut[bugunKey()] = 1; tut[GUN_ONEK + dunISO()] = 1;
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf(GUN_ONEK) === 0 && !tut[k]) localStorage.removeItem(k);
      }
    } catch (e) {}
  }

  var _ucus = null;      /* index.html ve chat.html ayni anda cagirirsa tek hesap */
  function bugunMalzeme() {
    var d = donmusOku();
    if (d !== undefined) return Promise.resolve(d);
    /* KRITIK: cumle indeksi olmadan hesap yapilamaz. Boyle bir sayfada
       (sentences-loader.js yuklu degilse) SONUC DONDURULMAZ — yoksa o sayfa
       gunu "malzeme yok" diye kilitler ve ana ekran sonradan hesaplayamaz. */
    if (!(global.DHSent && global.DHSent.index)) return Promise.resolve(null);
    if (_ucus) return _ucus;
    _ucus = hesapla().then(function (r) {
      var son = donmusOku();
      if (son !== undefined) { _ucus = null; return son; }   /* baska sekme dondurdu */
      dondur(r || null);
      if (r && r.cumleler) gecmisYaz(r.cumleler.map(function (c) { return c.id; }));
      _ucus = null;
      return r || null;
    }).catch(function () { _ucus = null; return null; });
    return _ucus;
  }
  function sifirla() {
    try { localStorage.removeItem(bugunKey()); } catch (e) {}
    _ucus = null;
  }

  /* Sayfa acilisinda bir kez hesapla ve dondur. Boylece chat-core.js
     (senkron acilan) ve dh-ortam-fon.js hazir malzemeyi bulur.
     DHSent yoksa yukaridaki guard sayesinde sessizce hicbir sey yapmaz. */
  function otoDondur() { try { bugunMalzeme(); } catch (e) {} }
  if (global.document) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", otoDondur, { once: true });
    } else { otoDondur(); }
  }

  global.DHKonusma = {
    bugun: bugunMalzeme,
    hesapla: hesapla,
    sifirla: sifirla,
    SENARYOLAR: SENARYOLAR,
    _senaryoSec: senaryoSec,
    _anahtar: bugunKey
  };
})(typeof window !== "undefined" ? window : globalThis);
