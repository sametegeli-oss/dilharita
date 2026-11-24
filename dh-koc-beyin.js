/* dh-koc-beyin.js — DENİZ'İN KOÇ BEYNİ (koç planı, 2. aşama · 24 Kasım 2026)
   ====================================================================
   İki bölüm:
   (a) HESAPLANAN — uygulama yerel veriden hesaplar; yapay zekâ yazamaz.
       Kaynaklar: dh-olay.js günlük özeti (dh-gun-ozet-v1), tekrar kartları
       (IndexedDB sentence-mode/kv: srs:, wsrs:), ilerleme aynası, sözlük
       seviyeleri (data/dictionary.json), profil, Konuşkan durumu.
   (b) BEYİN — notlar, koçluk tercihleri, hedef. Firestore users/{uid}/koc/beyin
       (yalnız kullanıcının kendisi okur/yazar), yerel kopya dh-koc-beyin-v1.
       Notlar cihazlar arasında kimlik bazında birleşir; silinenler mezar taşıyla.

   denizkoç.md = koçluk kılavuzu (dh-koc-kilavuz.js) + tercihler + hesaplanan özet + notlar.
   Bulut: günde bir kez users/{uid}/koc/hesap (Telegram botu da okur),
          haftada bir users/{uid}/koc_haftalik/{YYYY-Hnn} anlık kopya.

   API (window.DHKocBeyin)
     await hesapla(zorla?)        hesaplanan bölüm (10 dk önbellek)
     beyin()                      {notlar, tercihler, hedef} (yerel kopya)
     await yukle()                buluttan çek + birleştir
     await notEkle({metin, kaynak, konu?})   kaynak: "kullanici" | "veri" | "tahmin"
     await notSil(id) · await notDuzelt(id, metin)
     await tercihYaz(patch) · await hedefYaz({seviye, tarih})
     await md()                   denizkoç.md metni
     kisaBaglam()                 Konuşkan sohbet isteğine eklenen kısa bağlam (önbellekten, eşzamanlı)
     oturumBitti({hatalar, mod})  oturum sonu: aynı hata türü 3+ ise "veri" notu (konu başına tek not)
   ==================================================================== */
(function (global) {
  "use strict";
  if (global.DHKocBeyin) return;

  var K_BEYIN = "dh-koc-beyin-v1", K_HESAP = "dh-koc-hesap-v1", K_BULUT = "dh-koc-bulut-gun";
  var SEVIYELER = ["A1", "A2", "B1", "B2", "C1"];
  var KAYNAKLAR = ["kullanici", "veri", "tahmin"];
  var BECERI_TR = { kelime: "kelime", dilbilgisi: "dilbilgisi", dinleme: "dinleme", konusma: "konuşma", okuma: "okuma", yazma: "yazma" };

  /* Amaca göre beceri dağılımı hedefi (toplam 1). Birden çok amaç seçiliyse ortalaması alınır. */
  var AMAC_AGIRLIK = {
    _:        { konusma: .25, dinleme: .20, kelime: .20, dilbilgisi: .15, yazma: .10, okuma: .10 },
    seyahat:  { konusma: .35, dinleme: .30, kelime: .20, dilbilgisi: .05, yazma: .05, okuma: .05 },
    aile:     { konusma: .35, dinleme: .25, kelime: .20, dilbilgisi: .05, yazma: .10, okuma: .05 },
    saglik:   { konusma: .30, dinleme: .30, kelime: .25, dilbilgisi: .05, yazma: .05, okuma: .05 },
    gunluk:   { konusma: .30, dinleme: .25, kelime: .20, dilbilgisi: .10, yazma: .05, okuma: .10 },
    zihin:    { konusma: .15, dinleme: .20, kelime: .20, dilbilgisi: .10, yazma: .10, okuma: .25 },
    is:       { konusma: .30, dinleme: .20, kelime: .15, dilbilgisi: .10, yazma: .15, okuma: .10 },
    akademik: { konusma: .10, dinleme: .15, kelime: .20, dilbilgisi: .20, yazma: .15, okuma: .20 }
  };

  function KIL() { return global.DHKocKilavuz || { SINIR: { notMax: 60, notUzunluk: 220, egilimMinGun: 14, tahminMinGun: 14 }, VARSAYILAN_TERCIH: { duzeltme: "dengeli", gunlukDakika: 30, uslup: "kısa ve sıcak" }, METIN: "", SURUM: "?" }; }
  function js(k, v) { try { var x = JSON.parse(localStorage.getItem(k) || "null"); return x == null ? v : x; } catch (e) { return v; } }
  function jsYaz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function gunAnahtari(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function yuzde(a, b) { return b ? Math.round(a / b * 100) : 0; }

  /* ---------- tekrar kartları (IndexedDB sentence-mode/kv) ---------- */
  function kvOneki(onekler) {
    return new Promise(function (res) {
      var out = {}; onekler.forEach(function (o) { out[o] = {}; });
      try {
        var r = indexedDB.open("sentence-mode", 1);
        r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains("kv")) r.result.createObjectStore("kv"); };
        r.onerror = function () { res(out); };
        r.onsuccess = function () {
          try {
            var q = r.result.transaction("kv", "readonly").objectStore("kv").openCursor();
            q.onsuccess = function () {
              var c = q.result;
              if (!c) { try { r.result.close(); } catch (e) {} return res(out); }
              if (typeof c.key === "string") for (var i = 0; i < onekler.length; i++) if (c.key.indexOf(onekler[i]) === 0) { out[onekler[i]][c.key.slice(onekler[i].length)] = c.value; break; }
              c.continue();
            };
            q.onerror = function () { res(out); };
          } catch (e) { res(out); }
        };
      } catch (e) { res(out); }
    });
  }

  var sozlukSoz = null;
  function sozlukSeviyeleri() {
    if (!sozlukSoz) sozlukSoz = fetch("./data/dictionary.json").then(function (r) { return r.json(); }).then(function (d) {
      var sev = {}, say = {};
      for (var w in d) if (d.hasOwnProperty(w)) { var s = d[w] && d[w].seviye; if (SEVIYELER.indexOf(s) >= 0) { sev[w.toLowerCase()] = s; say[s] = (say[s] || 0) + 1; } }
      return { sev: sev, say: say };
    }).catch(function () { sozlukSoz = null; return { sev: {}, say: {} }; });
    return sozlukSoz;
  }

  function profil() {
    var p = js("dh-profile-v1", {}) || {};
    var seviye = p.seviye || p.level || (function () { try { return localStorage.getItem("dh-level"); } catch (e) { return null; } })() || null;
    var amaclar = Array.isArray(p.amaclar) && p.amaclar.length ? p.amaclar : (p.amac ? [p.amac] : []);
    return { seviye: seviye, amaclar: amaclar, gunlukHedef: +p.gunlukHedef || null };
  }

  function amacAgirligi(amaclar) {
    var liste = (amaclar || []).filter(function (a) { return AMAC_AGIRLIK[a]; });
    if (!liste.length) return AMAC_AGIRLIK._;
    var out = {};
    liste.forEach(function (a) { var w = AMAC_AGIRLIK[a]; for (var b in w) out[b] = (out[b] || 0) + w[b] / liste.length; });
    return out;
  }

  /* ---------- HESAPLANAN BÖLÜM ---------- */
  /* ---------- müfredat: sıradaki modül + geride kalan seviye (eski koc.js'ten taşındı) ---------- */
  function betik(src, ad) {
    if (global[ad]) return Promise.resolve(true);
    return new Promise(function (res) {
      try {
        var var0 = document.querySelector('script[data-dhk="' + ad + '"]');
        if (var0) { var0.addEventListener("load", function () { res(!!global[ad]); }); setTimeout(function () { res(!!global[ad]); }, 6000); return; }
        var s = document.createElement("script"); s.src = src; s.setAttribute("data-dhk", ad);
        s.onload = function () { res(!!global[ad]); }; s.onerror = function () { res(false); };
        document.head.appendChild(s);
      } catch (e) { res(false); }
    });
  }
  function bugunYeniCumle() {
    try { var tr = js("dh-study-tracker-v1", {}) || {}, k = new Date().toISOString().slice(0, 10); return ((tr.days && tr.days[k] && tr.days[k].sentences) || 0); } catch (e) { return 0; }
  }
  function modulKisa(m) { return String(m || "").replace(/^[A-C]\d-M\d+[\s-]*/, ""); }
  async function mufredat() {
    var sonuc = { sonraki: null, sonrakiKisa: null, bugunCumle: bugunYeniCumle(), gunlukSinir: 25, telafi: null };
    try {
      await betik("./sentences-loader.js?v=1", "DHSent");
      await betik("./profile.js?v=2", "DHProfile");
      if (global.DHProfile && DHProfile.nextModule) {
        var m = await Promise.race([DHProfile.nextModule(), new Promise(function (r) { setTimeout(function () { r(null); }, 6000); })]);
        if (m) { sonuc.sonraki = m; sonuc.sonrakiKisa = modulKisa(m); }
      }
      await betik("./learning-error-system.js?v=12", "LearningErrorDB");
      await betik("./dh-telafi.js?v=2", "DHTelafi");
      if (global.DHTelafi && DHTelafi.bul) {
        var t = await Promise.race([DHTelafi.bul(), new Promise(function (r) { setTimeout(function () { r(null); }, 6000); })]);
        if (t && t.modul && t.modul !== sonuc.sonraki) sonuc.telafi = { modul: t.modul, modulKisa: t.modulKisa || modulKisa(t.modul), seviye: t.seviye || "", hataSayisi: +t.hataSayisi || 0 };
      }
    } catch (e) {}
    return sonuc;
  }

  async function hesapla(zorla) {
    var onbellek = js(K_HESAP, null);
    if (!zorla && onbellek && onbellek.t && Date.now() - onbellek.t < 10 * 60000 && onbellek.gun === gunAnahtari()) return onbellek;
    /* dh-olay.js auth-guard tarafından eşzamansız eklenir; en çok 3 sn bekle */
    for (var bk = 0; bk < 30 && !global.DHOlay; bk++) await new Promise(function (r) { setTimeout(r, 100); });
    var O = global.DHOlay;
    var son28 = O ? O.gunler(28) : [];
    var hepsi = (js("dh-gun-ozet-v1", { gun: {} }) || { gun: {} }).gun || {};
    function toplamSn(g) { var t = 0; for (var b in (g.s || {})) t += +g.s[b] || 0; return t; }

    /* süre ve beceri */
    var son7 = son28.slice(-7), gunluk = son7.map(function (g) { return { tarih: g.tarih, dk: Math.round(toplamSn(g) / 60) }; });
    var beceriSn = {}, dogru = {}, yanlis = {};
    son7.forEach(function (g) { ["s", "d", "y"].forEach(function (a) { var x = g[a] || {}; var hedef = a === "s" ? beceriSn : a === "d" ? dogru : yanlis; for (var b in x) hedef[b] = (hedef[b] || 0) + (+x[b] || 0); }); });
    var haftaToplamSn = 0; for (var b0 in beceriSn) haftaToplamSn += beceriSn[b0];
    var pr = profil(), agirlik = amacAgirligi(pr.amaclar);
    var beceriler = Object.keys(BECERI_TR).map(function (b) {
      var top = (dogru[b] || 0) + (yanlis[b] || 0);
      return { beceri: b, dk: Math.round((beceriSn[b] || 0) / 60), pay: haftaToplamSn ? Math.round((beceriSn[b] || 0) / haftaToplamSn * 100) : 0,
               hedefPay: Math.round((agirlik[b] || 0) * 100), dogruluk: top >= 5 ? yuzde(dogru[b] || 0, top) : null, cevap: top };
    });
    var geride = beceriler.filter(function (x) { return haftaToplamSn >= 600 && x.pay < x.hedefPay * 0.6; }).sort(function (a, b) { return (a.pay - a.hedefPay) - (b.pay - b.hedefPay); }).map(function (x) { return x.beceri; });

    /* haftalık (son 4 hafta) ve aylık dakika */
    var haftalar = [0, 1, 2, 3].map(function (i) { var dilim = son28.slice(i * 7, i * 7 + 7), sn = 0; dilim.forEach(function (g) { sn += toplamSn(g); }); return Math.round(sn / 60); });
    var aylik = {};
    var veriGunu = 0, ilkGun = null;
    Object.keys(hepsi).sort().forEach(function (gun) {
      var t = O ? O._topla(hepsi[gun]) : { s: {} }, sn = toplamSn(t);
      if (sn > 0) { veriGunu++; if (!ilkGun) ilkGun = gun; }
      var ay = gun.slice(0, 7); aylik[ay] = (aylik[ay] || 0) + Math.round(sn / 60);
    });

    /* aktif gün serisi (bugün henüz çalışılmadıysa dünden geriye) */
    var seri = 0, d = new Date();
    for (var i = 0; i < 400; i++) {
      var k = gunAnahtari(d), g = hepsi[k];
      var sn = g && O ? toplamSn(O._topla(g)) : 0;
      if (sn >= 120) seri++; else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }

    /* hata konuları: son 14 gün ile önceki 14 gün */
    var yeni = {}, eski = {};
    son28.forEach(function (g, idx) { var hedef = idx >= 14 ? yeni : eski; var kk = g.k || {}; for (var konu in kk) hedef[konu] = (hedef[konu] || 0) + (+kk[konu][1] || 0); });
    var konular = Object.keys(yeni).concat(Object.keys(eski)).filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (konu) {
      var y = yeni[konu] || 0, e = eski[konu] || 0;
      var egilim = veriGunu < KIL().SINIR.egilimMinGun ? "henüz erken" : (e === 0 && y > 0 ? "yeni" : y < e * 0.8 ? "azalıyor" : y > e * 1.2 ? "artıyor" : "değişmedi");
      return { konu: konu, son14: y, onceki14: e, egilim: egilim };
    }).filter(function (x) { return x.son14 + x.onceki14 > 0; }).sort(function (a, b) { return b.son14 - a.son14; }).slice(0, 8);

    /* tekrar kartları ve kelimeler */
    var kv = await kvOneki(["srs:", "wsrs:"]), simdi = Date.now();
    function say(m) { var r = { kart: 0, bekleyen: 0, ogrenilen: 0, zor: 0 }; for (var id in m) { var x = m[id]; if (!x || typeof x !== "object") continue; r.kart++; if ((x.due || 0) > 0 && x.due <= simdi) r.bekleyen++; if ((x.rep || 0) >= 2) r.ogrenilen++; if ((x.lapses || 0) >= 3) r.zor++; } return r; }
    var cumle = say(kv["srs:"]), kelime = say(kv["wsrs:"]);
    var ayna = js("dh-progress-mirror-v1", {}) || {}, bilinen = {};
    for (var w in kv["wsrs:"]) { var x = kv["wsrs:"][w]; if (x && (x.rep || 0) >= 2) bilinen[w.toLowerCase()] = 1; }
    for (var key in ayna) if (key.indexOf("word:") === 0 && ayna[key] && ayna[key][0] === 2) bilinen[key.slice(5).toLowerCase()] = 1;
    var sz = await sozlukSeviyeleri(), seviyeKelime = {};
    SEVIYELER.forEach(function (s) { seviyeKelime[s] = { bilinen: 0, toplam: sz.say[s] || 0 }; });
    for (var bw in bilinen) { var sv = sz.sev[bw]; if (sv) seviyeKelime[sv].bilinen++; }
    SEVIYELER.forEach(function (s) { seviyeKelime[s].yuzde = yuzde(seviyeKelime[s].bilinen, seviyeKelime[s].toplam); });

    /* Konuşkan */
    var kk = js("dh-konuskan-v1", {}) || {}, kst = kk.stats || {};
    var konuskan = { seviye: kk.level || null, mesaj: kst.msgs || 0, dogruMesaj: kst.ok || 0, hata: (kk.errors || []).length };

    /* plan (coach-bubble) */
    var plan = null;
    try { if (global.dhPlanProgress) { var p = global.dhPlanProgress(); if (p) plan = { toplam: p.total || 0, biten: p.doneCount || 0 }; } } catch (e) {}

    var beyinV = beyin(), hedef = beyinV.hedef || {};
    var tahmin = { durum: veriGunu < KIL().SINIR.tahminMinGun ? "henüz erken" : "hesaplanmadı", not: "Seviye ilerleme tahmini için en az " + KIL().SINIR.tahminMinGun + " günlük veri ve hedef seviye gerekir." };
    if (veriGunu >= KIL().SINIR.tahminMinGun && hedef.seviye && pr.seviye) {
      /* Kaba tahmin: hedef seviyeye kadar kalan seviye kelimeleri / son 4 haftada öğrenilen kelime hızı.
         (Sözlük kelimesi ilerlemesi seviyenin tek ölçüsü değil; panelde "kaba tahmin" diye yazılır.) */
      var kalan = 0, a = SEVIYELER.indexOf(pr.seviye), h = SEVIYELER.indexOf(hedef.seviye);
      for (var si = Math.max(0, a); si <= h && si >= 0; si++) { var sk = seviyeKelime[SEVIYELER[si]]; kalan += Math.max(0, Math.round(sk.toplam * 0.8) - sk.bilinen); }
      var once = js("dh-koc-kelime-sayac-v1", {}) || {}, bugunK = Object.keys(bilinen).length;
      once[gunAnahtari()] = bugunK; var gunlerK = Object.keys(once).sort(); while (gunlerK.length > 60) delete once[gunlerK.shift()]; jsYaz("dh-koc-kelime-sayac-v1", once);
      var eskiK = null; for (var gi = 0; gi < gunlerK.length; gi++) { if (gunlerK[gi] >= gunAnahtari(new Date(Date.now() - 28 * 864e5))) { eskiK = once[gunlerK[gi]]; var ilkTarih = gunlerK[gi]; break; } }
      var gecenGun = ilkTarih ? Math.max(1, Math.round((Date.now() - Date.parse(ilkTarih)) / 864e5)) : 0;
      var hiz = gecenGun >= 7 && eskiK != null ? (bugunK - eskiK) / gecenGun : null;
      if (kalan === 0) tahmin = { durum: "kelime hedefi tamam", kalanKelime: 0 };
      else if (hiz && hiz > 0) { var varis = new Date(Date.now() + kalan / hiz * 864e5); tahmin = { durum: "kaba tahmin", kalanKelime: kalan, gunlukHiz: Math.round(hiz * 10) / 10, varis: gunAnahtari(varis) }; }
      else tahmin = { durum: "hız ölçülemedi", kalanKelime: kalan, not: "Son haftalarda yeni kelime öğrenme hızı ölçülemedi." };
    } else { try { var once2 = js("dh-koc-kelime-sayac-v1", {}) || {}; once2[gunAnahtari()] = Object.keys(bilinen).length; jsYaz("dh-koc-kelime-sayac-v1", once2); } catch (e) {} }

    var kisisel = kisiselHedefler().map(function (x) {
      var simdiHata = 0; konular.forEach(function (k) { if (k.konu === x.konu) simdiHata = k.son14; });
      var gecen = Math.max(1, Math.ceil((Date.now() - x.bas) / 864e5));
      return { id: x.id, ad: x.ad, konu: x.konu, gun: Math.min(gecen, x.gun), toplamGun: x.gun, gunlukDk: x.gunlukDk, basHata: x.basHata, simdiHata: simdiHata, suresiDoldu: Date.now() > x.bitis };
    });
    var sonuc = {
      t: Date.now(), gun: gunAnahtari(), surum: 1, kisisel: kisisel, bugun: bugun(),
      profil: pr, hedef: hedef,
      sure: { gunluk: gunluk, haftaDk: Math.round(haftaToplamSn / 60), haftalar: haftalar, aylik: aylik, aktifGunHafta: gunluk.filter(function (g) { return g.dk >= 2; }).length, seri: seri, veriGunu: veriGunu, ilkGun: ilkGun },
      beceriler: beceriler, gerideBeceri: geride,
      hataKonulari: konular,
      tekrar: { cumle: cumle, kelime: kelime },
      kelimeSeviye: seviyeKelime, bilinenKelime: Object.keys(bilinen).length,
      konuskan: konuskan, plan: plan, tahmin: tahmin,
      mufredat: await mufredat()
    };
    jsYaz(K_HESAP, sonuc);
    gunlukBulut(sonuc);
    return sonuc;
  }

  /* ---------- BEYİN: notlar, tercihler, hedef ---------- */
  function bos() { return { notlar: {}, silinen: {}, tercihler: { u: 0 }, hedef: { u: 0 }, kisisel: {}, bugun: { u: 0 } }; }
  function beyin() { var b = js(K_BEYIN, null); if (!b || typeof b !== "object") b = bos(); b.notlar = b.notlar || {}; b.silinen = b.silinen || {}; b.tercihler = b.tercihler || { u: 0 }; b.hedef = b.hedef || { u: 0 }; b.kisisel = b.kisisel || {}; b.bugun = b.bugun || { u: 0 }; return b; }
  function birlestir(a, b) {
    a = a || bos(); b = b || bos();
    var out = bos(), id;
    for (id in (a.silinen || {})) out.silinen[id] = Math.max(out.silinen[id] || 0, +a.silinen[id] || 0);
    for (id in (b.silinen || {})) out.silinen[id] = Math.max(out.silinen[id] || 0, +b.silinen[id] || 0);
    [a.notlar || {}, b.notlar || {}].forEach(function (n) { for (var i in n) if (n.hasOwnProperty(i)) { var x = n[i]; if (!x) continue; var var0 = out.notlar[i]; if (!var0 || (+x.u || 0) > (+var0.u || 0)) out.notlar[i] = x; } });
    for (id in out.notlar) if ((out.silinen[id] || 0) >= (+out.notlar[id].u || 0)) delete out.notlar[id];
    out.tercihler = (+((b.tercihler || {}).u) || 0) > (+((a.tercihler || {}).u) || 0) ? b.tercihler : (a.tercihler || { u: 0 });
    out.hedef = (+((b.hedef || {}).u) || 0) > (+((a.hedef || {}).u) || 0) ? b.hedef : (a.hedef || { u: 0 });
    /* kişisel hedefler: kimlik bazında, büyük u kazanır (kapatma da bir güncellemedir) */
    [a.kisisel || {}, b.kisisel || {}].forEach(function (n) { for (var i in n) if (n.hasOwnProperty(i)) { var x = n[i]; if (!x) continue; var v0 = out.kisisel[i]; if (!v0 || (+x.u || 0) > (+v0.u || 0)) out.kisisel[i] = x; } });
    out.bugun = (+((b.bugun || {}).u) || 0) > (+((a.bugun || {}).u) || 0) ? b.bugun : (a.bugun || { u: 0 });
    /* mezar taşları 180 gün sonra unutulur */
    var sinir = Date.now() - 180 * 864e5; for (id in out.silinen) if (out.silinen[id] < sinir) delete out.silinen[id];
    return out;
  }
  function bulut() { var C = global.DHCloudSync; return C && C.koc && C.koc.hazir() ? C.koc : null; }
  async function yukle() {
    var c = bulut(); if (!c) return beyin();
    try { var uzak = await c.oku("koc", "beyin"); var b = birlestir(beyin(), uzak || null); jsYaz(K_BEYIN, b); if (JSON.stringify(uzak || {}) !== JSON.stringify(b)) await c.yaz("koc", "beyin", b, false); return b; }
    catch (e) { return beyin(); }
  }
  async function degistir(fn) {
    var b = beyin(); fn(b); jsYaz(K_BEYIN, b);
    var c = bulut(); if (!c) { jsYaz("dh-koc-beyin-bekliyor", 1); return b; }
    try { var uzak = await c.oku("koc", "beyin"); var m = birlestir(uzak || null, b); jsYaz(K_BEYIN, m); await c.yaz("koc", "beyin", m, false); try { localStorage.removeItem("dh-koc-beyin-bekliyor"); } catch (e) {} return m; }
    catch (e) { jsYaz("dh-koc-beyin-bekliyor", 1); return b; }
  }

  var HASSAS = /\b(hasta(lık)?|ilaç|tedavi|depresyon|kanser|ameliyat|hamile|din(i|im)?|namaz|oruç|inanç|siyas|parti(si)?|cinsel|boşan)/i;
  async function notEkle(o) {
    o = o || {};
    var S = KIL().SINIR, metin = String(o.metin || "").replace(/\s+/g, " ").trim().slice(0, S.notUzunluk);
    if (!metin) return { ok: false, neden: "boş not" };
    var kaynak = KAYNAKLAR.indexOf(o.kaynak) >= 0 ? o.kaynak : "tahmin";
    if (kaynak !== "kullanici" && HASSAS.test(metin)) return { ok: false, neden: "hassas konu (yalnız kullanıcı isterse)" };
    var b0 = beyin(), ayni = null;
    for (var i in b0.notlar) if (b0.notlar[i].m.toLowerCase() === metin.toLowerCase()) ayni = i;
    if (ayni) return { ok: true, id: ayni, tekrar: true };
    var id = "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), simdi = Date.now();
    await degistir(function (b) {
      b.notlar[id] = { m: metin, k: kaynak, konu: o.konu ? String(o.konu).slice(0, 40) : null, t: simdi, u: simdi };
      /* sınır: önce en eski "tahmin", sonra "veri", en son "kullanici" notu düşer */
      var ids = Object.keys(b.notlar);
      while (ids.length > S.notMax) {
        var sira = ids.slice().sort(function (x, y) { var r = { tahmin: 0, veri: 1, kullanici: 2 }; var a = b.notlar[x], c = b.notlar[y]; return (r[a.k] - r[c.k]) || (a.u - c.u); });
        b.silinen[sira[0]] = Date.now(); delete b.notlar[sira[0]]; ids = Object.keys(b.notlar);
      }
    });
    return { ok: true, id: id };
  }
  async function notSil(id) { await degistir(function (b) { delete b.notlar[id]; b.silinen[id] = Date.now(); }); return true; }
  async function notDuzelt(id, metin) {
    metin = String(metin || "").replace(/\s+/g, " ").trim().slice(0, KIL().SINIR.notUzunluk); if (!metin) return notSil(id);
    await degistir(function (b) { var n = b.notlar[id]; if (n) { n.m = metin; n.k = "kullanici"; n.u = Date.now(); } }); return true;
  }
  async function tercihYaz(p) {
    var izin = { duzeltme: ["yumuşak", "dengeli", "sıkı"], uslup: null, gunlukDakika: null };
    await degistir(function (b) {
      var t = Object.assign({}, b.tercihler);
      if (p.duzeltme && izin.duzeltme.indexOf(p.duzeltme) >= 0) t.duzeltme = p.duzeltme;
      if (p.gunlukDakika != null) t.gunlukDakika = Math.max(5, Math.min(180, Math.round(+p.gunlukDakika || 30)));
      if (p.uslup != null) t.uslup = String(p.uslup).slice(0, 80);
      t.u = Date.now(); b.tercihler = t;
    }); return true;
  }
  async function hedefYaz(h) {
    await degistir(function (b) {
      var x = { u: Date.now() };
      if (SEVIYELER.indexOf(h.seviye) >= 0) x.seviye = h.seviye;
      if (/^\d{4}-\d{2}-\d{2}$/.test(h.tarih || "")) x.tarih = h.tarih;
      b.hedef = x;
    });
    try { localStorage.removeItem(K_HESAP); } catch (e) {}
    return true;
  }
  /* ---------- KİŞİSEL HEDEFLER (4. aşama) ----------
     {id:{konu, ad, istek, gun, gunlukDk, bas, bitis, basHata, durum:"acik"|"kapandi", u}}
     Sınır (kodda): aynı anda en çok SINIR.kisiselHedefMax açık hedef. Onaysız eklenmez: ekleyen her zaman kullanıcı arayüzüdür. */
  function kisiselHedefler(hepsi) { var k = beyin().kisisel, out = []; for (var i in k) if (k.hasOwnProperty(i) && (hepsi || k[i].durum === "acik")) { var x = Object.assign({ id: i }, k[i]); out.push(x); } return out.sort(function (a, b) { return a.bas - b.bas; }); }
  async function kisiselEkle(o) {
    var acik = kisiselHedefler().length, max = (KIL().SINIR.kisiselHedefMax || 3);
    if (acik >= max) return { ok: false, neden: "En çok " + max + " kişisel hedef açık olabilir; önce birini kapat." };
    var gun = Math.max(3, Math.min(60, Math.round(+o.gun || 14))), dk = Math.max(5, Math.min(30, Math.round(+o.gunlukDk || 10)));
    var konu = String(o.konu || "").toLowerCase().replace(/[^a-z0-9_çğıöşü]/g, "_").slice(0, 40) || "genel";
    var h = js(K_HESAP, null), basHata = 0;
    if (h) (h.hataKonulari || []).forEach(function (k) { if (k.konu === konu) basHata = k.son14; });
    var id = "h" + Date.now().toString(36), simdi = Date.now();
    await degistir(function (b) { b.kisisel[id] = { konu: konu, ad: String(o.ad || konu).slice(0, 60), istek: String(o.istek || "").slice(0, 160), gun: gun, gunlukDk: dk, bas: simdi, bitis: simdi + gun * 864e5, basHata: basHata, durum: "acik", u: simdi }; });
    try { await notEkle({ metin: "Kişisel hedef: " + String(o.ad || konu).slice(0, 60) + " (" + gun + " gün, günde " + dk + " dk)" + (o.istek ? " — isteği: " + String(o.istek).slice(0, 80) : ""), kaynak: "kullanici" }); } catch (e) {}
    try { localStorage.removeItem(K_HESAP); } catch (e) {}
    return { ok: true, id: id };
  }
  async function kisiselKapat(id) { await degistir(function (b) { var x = b.kisisel[id]; if (x) { x.durum = "kapandi"; x.u = Date.now(); } }); return true; }
  /* Bugüne özel istek: {dk?, odak?, metin?} — yalnız bugün geçerli; plan yeniden hazırlanır. */
  async function bugunYaz(o) {
    await degistir(function (b) {
      var eski = (b.bugun && b.bugun.gun === gunAnahtari()) ? b.bugun : {};
      b.bugun = { gun: gunAnahtari(), u: Date.now(),
        dk: "dk" in o ? (o.dk ? Math.max(5, Math.min(180, Math.round(+o.dk))) : null) : (eski.dk || null),
        odak: "odak" in o ? (o.odak || null) : (eski.odak || null),
        metin: "metin" in o ? (o.metin ? String(o.metin).slice(0, 120) : null) : (eski.metin || null) };
    });
    try { localStorage.removeItem("dh-koc-gun-" + gunAnahtari()); } catch (e) {}
    return true;
  }
  function bugun() { var x = beyin().bugun || {}; return x.gun === gunAnahtari() ? x : null; }

  function tercihler() { var t = Object.assign({}, KIL().VARSAYILAN_TERCIH, beyin().tercihler || {}); delete t.u; var bg = bugun(); if (bg && bg.dk) { t.gunlukDakika = bg.dk; t.bugunOzel = true; } return t; }

  /* ---------- bulut: günlük hesap kopyası + haftalık anlık kopya ---------- */
  function haftaAnahtari(d) { d = new Date(d || Date.now()); var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var g = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - g); var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + "-H" + String(Math.ceil(((t - y) / 864e5 + 1) / 7)).padStart(2, "0"); }
  function gunlukBulut(h) {
    var c = bulut(); if (!c) return;
    var bugun = gunAnahtari(); try { if (localStorage.getItem(K_BULUT) === bugun) return; } catch (e) { return; }
    try { localStorage.setItem(K_BULUT, bugun); } catch (e) {}
    c.yaz("koc", "hesap", h, false).catch(function () {});
    var hk = haftaAnahtari(); try { if (localStorage.getItem("dh-koc-haftalik") !== hk) { localStorage.setItem("dh-koc-haftalik", hk); c.yaz("koc_haftalik", hk, { hesap: h, notSayisi: Object.keys(beyin().notlar).length, t: Date.now() }, false).catch(function () {}); haftalikDegerlendirme(h); } } catch (e) {}
    if (localStorage.getItem("dh-koc-beyin-bekliyor")) yukle();
  }

  /* HAFTALIK DEĞERLENDİRME (kılavuz: "haftada bir, tek not"). Yapay zekâ değil, koç beynindeki
     rakamlardan kurulur; uydurma rakam riski yok. Konu "haftalik" olduğu için her hafta aynı notu günceller. */
  function konuTR(k) { try { if (global.DHInsights && DHInsights.label) return DHInsights.label(k); } catch (e) {} return String(k || "").replace(/_/g, " "); }
  function haftalikDegerlendirme(h) {
    try {
      var hw = h.sure.haftalar || [], bu = hw[3] || 0, once = hw[2] || 0, parca = [];
      parca.push("Geçen hafta " + bu + " dk çalıştın" + (once ? " (bir önceki hafta " + once + " dk" + (bu > once * 1.1 ? ", arttı" : bu < once * 0.9 ? ", azaldı" : ", aynı") + ")" : "") + ".");
      var azalan = h.hataKonulari.filter(function (k) { return k.egilim === "azalıyor"; }).map(function (k) { return konuTR(k.konu); });
      var artan = h.hataKonulari.filter(function (k) { return k.egilim === "artıyor" || k.egilim === "yeni"; }).map(function (k) { return konuTR(k.konu); });
      if (azalan.length) parca.push("İşe yarayan: " + azalan.slice(0, 2).join(", ") + " hataları azalıyor.");
      if (artan.length) parca.push("Bu hafta ağırlık: " + artan.slice(0, 2).join(", ") + ".");
      if (h.gerideBeceri.length && h.sure.haftaDk >= 60) parca.push("Amaca göre geride: " + h.gerideBeceri.slice(0, 2).map(function (x) { return BECERI_TR[x]; }).join(", ") + ".");
      var bek = h.tekrar.cumle.bekleyen + h.tekrar.kelime.bekleyen; if (bek) parca.push("Bekleyen tekrar " + bek + ".");
      if (bu > 0 || once > 0) konuNotu("haftalik", "Haftalık değerlendirme (" + gunAnahtari() + "): " + parca.join(" "));
    } catch (e) {}
  }

  /* ---------- denizkoç.md ---------- */
  function satir(arr) { return arr.filter(Boolean).join("\n"); }
  async function md() {
    var h = await hesapla(), b = beyin(), t = tercihler();
    var azVeri = h.sure.haftaDk < 60;
    var bec = h.beceriler.map(function (x) { return "- " + BECERI_TR[x.beceri] + ": " + x.dk + " dk" + (azVeri ? "" : " (%" + x.pay + ", amaca göre hedef %" + x.hedefPay + ")") + (x.dogruluk != null ? ", doğruluk %" + x.dogruluk : ""); });
    if (azVeri) bec.unshift("- (bu haftanın verisi henüz az; oranlar yorumlanmamalı)");
    var kon = h.hataKonulari.map(function (k) { return "- " + k.konu + ": son 14 gün " + k.son14 + " hata (önceki 14 gün " + k.onceki14 + ") → " + k.egilim; });
    var kel = SEVIYELER.map(function (s) { var x = h.kelimeSeviye[s]; return s + " " + x.bilinen + "/" + x.toplam + " (%" + x.yuzde + ")"; }).join(" · ");
    var notlar = Object.keys(b.notlar).map(function (id) { return b.notlar[id]; }).sort(function (a, c) { return c.u - a.u; })
      .map(function (n) { return "- [" + n.k + ", " + gunAnahtari(new Date(n.u)) + "] " + n.m; });
    var tah = h.tahmin || {};
    return satir([
      KIL().METIN, "",
      "# Koç beyni — " + h.gun,
      "## Koçluk tercihleri (kılavuzun önüne geçer)",
      "- Düzeltme sıkılığı: " + t.duzeltme + " · Günlük süre: " + t.gunlukDakika + " dk · Üslup: " + t.uslup,
      "## Öğrenci",
      "- Seviye: " + (h.profil.seviye || "bilinmiyor") + " · Amaç: " + (h.profil.amaclar.join(", ") || "belirtilmemiş") + " · Hedef: " + (h.hedef.seviye ? h.hedef.seviye + (h.hedef.tarih ? " (" + h.hedef.tarih + ")" : "") : "belirtilmemiş"),
      "## Çalışma (hesaplanan)",
      "- Bu hafta " + h.sure.haftaDk + " dk, " + h.sure.aktifGunHafta + "/7 gün; seri " + h.sure.seri + " gün; son 4 hafta (yeniden eskiye) " + h.sure.haftalar.slice().reverse().join(" / ") + " dk; toplam veri günü " + h.sure.veriGunu,
      h.gerideBeceri.length ? "- Amaca göre geride kalan: " + h.gerideBeceri.map(function (x) { return BECERI_TR[x]; }).join(", ") : null,
      "## Beceriler (son 7 gün)", satir(bec),
      "## Hata konuları", kon.length ? satir(kon) : "- kayıt yok",
      "## Tekrar",
      "- Cümle kartı: " + h.tekrar.cumle.kart + ", bekleyen " + h.tekrar.cumle.bekleyen + ", öğrenilen " + h.tekrar.cumle.ogrenilen + ", zor " + h.tekrar.cumle.zor,
      "- Kelime kartı: " + h.tekrar.kelime.kart + ", bekleyen " + h.tekrar.kelime.bekleyen + ", öğrenilen " + h.tekrar.kelime.ogrenilen,
      "- Bilinen kelime (seviyeye göre): " + kel,
      "## Müfredat",
      (h.mufredat && h.mufredat.sonraki ? "- Sıradaki yeni modül: " + h.mufredat.sonrakiKisa + " (" + h.mufredat.sonraki + ")" : "- Sıradaki yeni modül: bulunamadı"),
      "- Bugün öğrenilen yeni cümle: " + ((h.mufredat && h.mufredat.bugunCumle) || 0) + " (günlük sınır " + ((h.mufredat && h.mufredat.gunlukSinir) || 25) + ")",
      (h.mufredat && h.mufredat.telafi ? "- Eksik kalan alt seviye: " + h.mufredat.telafi.seviye + " " + h.mufredat.telafi.modulKisa + ", bu seviyede son 30 günde " + h.mufredat.telafi.hataSayisi + " hata" : "- Eksik kalan alt seviye: yok"),
      "## Hedefe varış", "- " + (tah.durum || "-") + (tah.varis ? ": " + tah.varis + " (kalan " + tah.kalanKelime + " kelime, günde " + tah.gunlukHiz + ")" : "") + (tah.not ? " — " + tah.not : ""),
      "## Konuşkan", "- Mesaj " + h.konuskan.mesaj + ", doğru " + h.konuskan.dogruMesaj + ", kayıtlı hata " + h.konuskan.hata,
      h.plan ? "## Bugünün planı\n- " + h.plan.biten + "/" + h.plan.toplam + " adım bitti" : null,
      "## Kişisel hedefler (öğrencinin kendi istekleri; öncelik 2)", (h.kisisel || []).length ? satir(h.kisisel.map(function (x) { return "- " + x.ad + " (" + x.konu + "): " + x.gun + ". gün / " + x.toplamGun + ", günde " + x.gunlukDk + " dk; hata başlangıçta " + x.basHata + ", şimdi " + x.simdiHata + (x.suresiDoldu ? " — süresi doldu, kapatmayı öner" : ""); })) : "- yok",
      h.bugun ? "## Bugüne özel istek\n- " + [h.bugun.dk ? "bugün " + h.bugun.dk + " dk" : "", h.bugun.odak ? "odak: " + h.bugun.odak : "", h.bugun.metin ? "\"" + h.bugun.metin + "\"" : ""].filter(Boolean).join(" · ") : null,
      "## Deniz'in notları", notlar.length ? satir(notlar) : "- henüz not yok"
    ]);
  }

  /* ---------- Konuşkan'a kısa bağlam (her sohbet isteğine eklenir; ~120 kelime) ---------- */
  var DUZELTME_EN = {
    "yumuşak": "Correction style (learner's choice): gentle — correct only errors that change meaning; let small slips pass.",
    "dengeli": "Correction style (learner's choice): balanced — correct clear grammar and word-choice errors, skip tiny slips.",
    "sıkı": "Correction style (learner's choice): strict — correct every error, including small ones."
  };
  function kisaBaglam() {
    try {
      var h = js(K_HESAP, null), b = beyin(), t = tercihler(), satirlar = [];
      satirlar.push(DUZELTME_EN[t.duzeltme] || DUZELTME_EN.dengeli);
      if (h) {
        var zayif = (h.hataKonulari || []).slice(0, 3).map(function (k) { return k.konu + " (" + k.son14 + " errors in 14 days, " + k.egilim + ")"; });
        if (zayif.length) satirlar.push("Weak points from the learner's data: " + zayif.join("; ") + ". Steer the conversation so these come up naturally.");
        if ((h.gerideBeceri || []).length && h.sure && h.sure.haftaDk >= 60) satirlar.push("Behind this week (by goal): " + h.gerideBeceri.map(function (x) { return BECERI_TR[x]; }).join(", ") + ".");
        if (h.profil && h.profil.amaclar && h.profil.amaclar.length) satirlar.push("Learning goals: " + h.profil.amaclar.join(", ") + ".");
      }
      var notlar = Object.keys(b.notlar).map(function (id) { return b.notlar[id]; }).sort(function (a, c) { return c.u - a.u; }).slice(0, 8)
        .map(function (n) { return "[" + (n.k === "kullanici" ? "learner said" : n.k === "veri" ? "from data" : "coach's guess") + "] " + n.m; });
      var kh = kisiselHedefler(); if (kh.length) satirlar.push("Learner's own goals (they asked for these; weave them in): " + kh.map(function (x) { return x.ad + " (" + x.konu + ")"; }).join("; ") + ".");
      var bg = bugun(); if (bg && bg.metin) satirlar.push("Today the learner wants to talk about / practise: \"" + bg.metin + "\". Prefer this topic today.");
      if (notlar.length) satirlar.push("Coach notes about this learner (Turkish; use, do not recite): " + notlar.join(" | "));
      return "\nCOACH BRAIN (Dil Harita; never invent numbers about the learner):\n- " + satirlar.join("\n- ");
    } catch (e) { return ""; }
  }

  /* Oturum sonu gözlemi: aynı konu için tek "veri" notu tutulur, yenisi eskisini günceller. */
  async function konuNotu(konu, metin) {
    konu = String(konu || "").slice(0, 40); if (!konu) return notEkle({ metin: metin, kaynak: "veri" });
    var b0 = beyin(), var0 = null;
    for (var i in b0.notlar) if (b0.notlar[i].konu === konu && b0.notlar[i].k === "veri") var0 = i;
    if (!var0) return notEkle({ metin: metin, kaynak: "veri", konu: konu });
    metin = String(metin || "").replace(/\s+/g, " ").trim().slice(0, KIL().SINIR.notUzunluk);
    await degistir(function (b) { var n = b.notlar[var0]; if (n) { n.m = metin; n.u = Date.now(); } });
    return { ok: true, id: var0, guncellendi: true };
  }
  /* Konuşkan oturumu bittiğinde: aynı hata türü bir oturumda 3+ kez görüldüyse not düş. */
  function oturumBitti(o) {
    try {
      var hatalar = (o && o.hatalar) || [], say = {};
      hatalar.forEach(function (e) { var t = String(e.tag || "").trim(); if (t && ["speaking", "photo", "level exam"].indexOf(t) < 0) say[t] = (say[t] || 0) + 1; });
      var esik = (KIL().SINIR.araTekrarAyniHata || 3);
      Object.keys(say).forEach(function (t) {
        if (say[t] < esik) return;
        var ornek = hatalar.filter(function (e) { return e.tag === t; })[0] || {};
        konuNotu(t, gunAnahtari() + " " + (o.mod || "Konuşkan") + ": " + konuTR(t) + " hatası bir oturumda " + say[t] + " kez" + (ornek.wrong ? " (ör. \"" + String(ornek.wrong).slice(0, 50) + "\" → \"" + String(ornek.right || "").slice(0, 50) + "\")" : "") + ".");
      });
      if (global.DHDenizTelegram) DHDenizTelegram.oturumOzeti(hatalar, o && o.mod);
    } catch (e) {}
  }

  /* açılışta bulutla birleştir (oturum hazır olunca) */
  setTimeout(function bekle(n) { n = n || 0; if (bulut()) yukle(); else if (n < 20) setTimeout(function () { bekle(n + 1); }, 1500); }, 2000);

  global.DHKocBeyin = { hesapla: hesapla, beyin: beyin, yukle: yukle, notEkle: notEkle, notSil: notSil, notDuzelt: notDuzelt,
    tercihYaz: tercihYaz, tercihler: tercihler, kisiselHedefler: kisiselHedefler, kisiselEkle: kisiselEkle, kisiselKapat: kisiselKapat, bugunYaz: bugunYaz, bugun: bugun, hedefYaz: hedefYaz, md: md, kisaBaglam: kisaBaglam, konuNotu: konuNotu, oturumBitti: oturumBitti, _haftalik: haftalikDegerlendirme, _birlestir: birlestir, BECERI_TR: BECERI_TR, SEVIYELER: SEVIYELER };
})(window);
