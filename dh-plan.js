/* dh-plan.js — Dil Harita kalici gun plani
   ---------------------------------------------------------------
   NEDEN VAR
   Uygulamada su an iki ayri plan var ve ikisi de kalici degil:
     - koc.js gunluk plani onbellege aliyor ama adim ilerlemesini
       yalnizca "sayfa ziyaret edildi mi" olarak tutuyor.
     - ders.html her acilista idx=0 ile plani SIFIRDAN uretiyor;
       12 adimin 7'sini yapip sayfayi kapatan kullanici basa donuyor.
   Sonuc: "planlanan / yapilan / kalan" uclusu yalnizca tekrar.html'de
   dogru kurulmus durumda (dh-tekrar-gun-<gun>, dondurulmus hedef).

   BU DOSYA o dogru davranisi genellestirir ve TEK KAYNAK yapar.

   ILKELER
   1) Hedef gun icinde DONAR. Sayfaya donunce yeniden hesaplanmaz.
   2) Borc degil emek gosterilir. Toplam birikmis is disari verilmez;
      gunun porsiyonu verilir, artan yarina devredilir.
   3) Ilerleme adim bazinda ve kalicidir (localStorage).
   4) Dinlenme gunu plani bozmaz; hafta ritmi gunluk mukemmellikten onemli.

   DEPOLAMA
     dh-gun-plan-<YYYY-MM-DD>  -> { olusturuldu, adimlar:[...], dinlenme }
   Adim:
     { id, tip, etiket, href, hedef, yapilan }
       hedef  : bu adimda kac birim planlandi (or. 12 tekrar)
       yapilan: kac birim tamamlandi

   API
     DHPlan.bugun()                     -> plan nesnesi (yoksa null)
     DHPlan.kur(adimlar, {dinlenme})    -> plani bir kez dondurur
     DHPlan.varMi()                     -> bool
     DHPlan.ilerlet(id, n)              -> adimi n birim ilerletir
     DHPlan.tamamla(id)                 -> adimi hedefine cekip bitirir
     DHPlan.adim(id)                    -> tek adim
     DHPlan.aktif()                     -> ilk bitmemis adim
     DHPlan.ozet()                      -> {toplam, yapilan, kalan, yuzde, bittiMi}
     DHPlan.dinlenmeyeAl()              -> bugunu dinlenme gunu isaretler
     DHPlan.devret(id, kalanBirim)      -> artani yarina not eder
     DHPlan.hafta()                     -> son 7 gunun durumu (ritim seridi icin)
     DHPlan.sifirla()                   -> yalnizca bugunku plani siler
     DHPlan.dinle(fn)                   -> plan degisince cagrilir
*/
(function (global) {
  "use strict";
  if (global.DHPlan) return;

  var ONEK = "dh-gun-plan-";
  var DEVIR_ONEK = "dh-gun-devir-";
  var dinleyiciler = [];

  /* ---------- yardimcilar ---------- */

  function iso(d) {
    var t = d || new Date();
    // yerel gune gore ISO — toISOString UTC'ye kayar ve gece yarisi
    // civarinda gunu bir gun geri alabilir.
    var y = t.getFullYear();
    var a = String(t.getMonth() + 1).padStart(2, "0");
    var g = String(t.getDate()).padStart(2, "0");
    return y + "-" + a + "-" + g;
  }

  function gunOnce(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return iso(d);
  }

  function oku(anahtar) {
    try {
      var ham = localStorage.getItem(anahtar);
      return ham ? JSON.parse(ham) : null;
    } catch (e) {
      return null;
    }
  }

  function yaz(anahtar, deger) {
    try {
      localStorage.setItem(anahtar, JSON.stringify(deger));
      return true;
    } catch (e) {
      return false;
    }
  }

  function sayi(v, varsayilan) {
    var n = parseInt(v, 10);
    return isNaN(n) ? (varsayilan || 0) : n;
  }

  function haberVer(plan) {
    for (var i = 0; i < dinleyiciler.length; i++) {
      try { dinleyiciler[i](plan); } catch (e) {}
    }
  }

  /* ---------- cekirdek ---------- */

  function anahtarBugun() { return ONEK + iso(); }

  function bugun() { return oku(anahtarBugun()); }

  function varMi() {
    var p = bugun();
    return !!(p && p.adimlar && p.adimlar.length);
  }

  /* Plani bir KEZ dondurur. Ikinci cagri mevcut plani DEGISTIRMEZ —
     kullanici gun icinde sayfayi yenilediginde hedefin buyumesini
     ya da icerigin degismesini onler. Zorlamak icin once sifirla(). */
  function kur(adimlar, secenek) {
    var mevcut = bugun();
    if (mevcut && mevcut.adimlar && mevcut.adimlar.length) return mevcut;

    var s = secenek || {};
    var temiz = (adimlar || []).map(function (a, i) {
      return {
        id: String(a.id || ("adim-" + i)),
        tip: String(a.tip || "genel"),
        etiket: String(a.etiket || ""),
        href: String(a.href || ""),
        hedef: Math.max(1, sayi(a.hedef, 1)),
        yapilan: 0
      };
    });

    if (!temiz.length) return null;

    // Dunden devredilen artan varsa ilgili adimin hedefine eklenmez —
    // yalnizca not olarak tasinir. Hedefin sismesi "borc" hissidir.
    var devir = oku(DEVIR_ONEK + iso()) || null;

    var plan = {
      olusturuldu: Date.now(),
      gun: iso(),
      dinlenme: !!s.dinlenme,
      devredilen: devir,
      adimlar: temiz
    };
    yaz(anahtarBugun(), plan);
    haberVer(plan);
    return plan;
  }

  function adim(id) {
    var p = bugun();
    if (!p) return null;
    for (var i = 0; i < p.adimlar.length; i++) {
      if (p.adimlar[i].id === id) return p.adimlar[i];
    }
    return null;
  }

  function kaydet(p) {
    yaz(anahtarBugun(), p);
    haberVer(p);
    return p;
  }

  function ilerlet(id, n) {
    var p = bugun();
    if (!p) return null;
    var artis = sayi(n, 1);
    for (var i = 0; i < p.adimlar.length; i++) {
      var a = p.adimlar[i];
      if (a.id !== id) continue;
      a.yapilan = Math.max(0, Math.min(a.hedef, a.yapilan + artis));
      return kaydet(p);
    }
    return p;
  }

  function tamamla(id) {
    var p = bugun();
    if (!p) return null;
    for (var i = 0; i < p.adimlar.length; i++) {
      if (p.adimlar[i].id === id) {
        p.adimlar[i].yapilan = p.adimlar[i].hedef;
        return kaydet(p);
      }
    }
    return p;
  }

  function aktif() {
    var p = bugun();
    if (!p) return null;
    for (var i = 0; i < p.adimlar.length; i++) {
      if (p.adimlar[i].yapilan < p.adimlar[i].hedef) return p.adimlar[i];
    }
    return null;
  }

  function ozet() {
    var p = bugun();
    if (!p) return { toplam: 0, yapilan: 0, kalan: 0, yuzde: 0, bittiMi: false };
    var toplam = 0, yapilan = 0;
    for (var i = 0; i < p.adimlar.length; i++) {
      toplam += p.adimlar[i].hedef;
      yapilan += Math.min(p.adimlar[i].yapilan, p.adimlar[i].hedef);
    }
    var kalan = Math.max(0, toplam - yapilan);
    return {
      toplam: toplam,
      yapilan: yapilan,
      kalan: kalan,
      yuzde: toplam ? Math.round((100 * yapilan) / toplam) : 0,
      bittiMi: toplam > 0 && kalan === 0
    };
  }

  function dinlenmeyeAl() {
    var p = bugun();
    if (!p) {
      p = { olusturuldu: Date.now(), gun: iso(), dinlenme: true, adimlar: [] };
    } else {
      p.dinlenme = true;
    }
    return kaydet(p);
  }

  /* Artani yarina devret. Hedefe EKLENMEZ; yalnizca yarinki plan
     kurulurken "sunlar bekliyordu" bilgisi olarak okunur. */
  function devret(id, kalanBirim) {
    var yarin = new Date();
    yarin.setDate(yarin.getDate() + 1);
    var anahtar = DEVIR_ONEK + iso(yarin);
    var mevcut = oku(anahtar) || {};
    mevcut[id] = sayi(kalanBirim, 0);
    yaz(anahtar, mevcut);
    return mevcut;
  }

  /* Son 7 gun — haftalik ritim seridi icin.
     durum: "tuttu" | "kismi" | "dinlenme" | "yok" | "bugun" */
  function hafta() {
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var g = gunOnce(i);
      var p = oku(ONEK + g);
      var durum = "yok";
      if (p) {
        if (p.dinlenme) {
          durum = "dinlenme";
        } else {
          var t = 0, y = 0;
          for (var j = 0; j < (p.adimlar || []).length; j++) {
            t += p.adimlar[j].hedef;
            y += Math.min(p.adimlar[j].yapilan, p.adimlar[j].hedef);
          }
          if (t > 0 && y >= t) durum = "tuttu";
          else if (y > 0) durum = "kismi";
        }
      }
      if (i === 0 && durum === "yok") durum = "bugun";
      out.push({ gun: g, durum: durum, bugunMu: i === 0 });
    }
    return out;
  }

  /* Hedefi tutan gun sayisi — dinlenme gunu seriyi KIRMAZ.
     Seri kirilmasi en buyuk terk sebebi; dinlenme plana dahildir. */
  function seri() {
    var n = 0;
    for (var i = 0; i < 400; i++) {
      var p = oku(ONEK + gunOnce(i));
      if (!p) {
        if (i === 0) continue; // bugun henuz kurulmadiysa seriyi bozma
        break;
      }
      if (p.dinlenme) continue;
      var t = 0, y = 0;
      for (var j = 0; j < (p.adimlar || []).length; j++) {
        t += p.adimlar[j].hedef;
        y += Math.min(p.adimlar[j].yapilan, p.adimlar[j].hedef);
      }
      if (t > 0 && y >= t) n++;
      else if (i === 0) continue; // bugun yarim olabilir
      else break;
    }
    return n;
  }

  function sifirla() {
    try { localStorage.removeItem(anahtarBugun()); } catch (e) {}
    haberVer(null);
  }

  function dinle(fn) {
    if (typeof fn === "function") dinleyiciler.push(fn);
    return function () {
      var i = dinleyiciler.indexOf(fn);
      if (i >= 0) dinleyiciler.splice(i, 1);
    };
  }

  global.DHPlan = {
    bugun: bugun,
    varMi: varMi,
    kur: kur,
    adim: adim,
    ilerlet: ilerlet,
    tamamla: tamamla,
    aktif: aktif,
    ozet: ozet,
    dinlenmeyeAl: dinlenmeyeAl,
    devret: devret,
    hafta: hafta,
    seri: seri,
    sifirla: sifirla,
    dinle: dinle,
    _iso: iso
  };
})(typeof window !== "undefined" ? window : globalThis);
