/* dh-ozel-ders.js — "Bana özel ders": amaca göre kişisel modül üretimi
   ====================================================================
   NE YAPAR
   Kullanıcının öğrenme amacını (dh-amac.js), şu an çalıştığı gramer
   modülünü (DHProfile.nextModule) ve seviyesini birleştirip yapay zekâya
   12 cümlelik bir modül yazdırır, denetler ve Modüllerim'e kaydeder.
   Kullanıcıya hiçbir şey sorulmaz; tek düğme.

   YAPAY ZEKÂ YOLU (sırayla)
     1. "api"   : kullanıcının kendi anahtarı (DHProviders.chat)
     2. "araci" : sahibinin Cloudflare Worker aracı (ARACI_ADRES doluysa)
     3. "elle"  : Gemini kopyala-yapıştır paneli (DHProviders.manualChat)
   1 ve 2 arka planda çalışabilir; 3 kullanıcının dokunmasını ister.

   KALİTE
     - DHModul.dogrula ile aynı alan denetimi (Modüllerim'deki kurallar)
     - seviyeye göre en fazla kelime sayısı
     - amaç "İş/Akademik" değilse yazılım/şirket jargonu içeren cümle atılır
     - api/araci yolunda İKİNCİ bir yapay zekâ denetimi: İngilizcesi bozuk
       ya da Türkçesi yanlış cümle atılır
     - kullanıcı "🚩 Bunda hata var" derse cümle modülden çıkar (bayrakla)

   DEPO (yalnız bu cihaz)
     dh-ozel-ders-v1 = { uretilen:[{id,ad,amac,kaynak,seviye,n,tarih,acildi}],
                         gun:{t:"YYYY-MM-DD", n:0}, sira:0, bayrak:[...],
                         sonHata:{t, metin} }
   Modülün kendisi DHModul deposunda (bulut senkronlu).

   API
     DHOzelDers.hazirla()          gerekli betikleri yükler -> Promise
     DHOzelDers.yol()              "api" | "araci" | "elle"
     DHOzelDers.uret({durum})      -> Promise<{id, ad, n, amac}>
     DHOzelDers.onceden()          arka planda sıradakini hazırlar (sessiz)
     DHOzelDers.bekleyen()         hazır ve henüz açılmamış modül | null
     DHOzelDers.liste()            üretilenler (silinmemiş olanlar)
     DHOzelDers.acildi(id)
     DHOzelDers.bayrakla(id, en)   cümleyi modülden çıkarır
     DHOzelDers.kalanHak()         bugün kalan üretim hakkı
*/
(function (global) {
  "use strict";
  if (global.DHOzelDers) return;

  /* Cloudflare Worker aracının adresi (OZEL-DERS-ARACI.md'ye bakın).
     Boşken bu yol hiç kullanılmaz. Örnek: "https://dilharita-ozel.ornek.workers.dev" */
  var ARACI_ADRES = "";
  /* Deneme için: localStorage "dh-ozel-ders-araci" de adres verebilir. */
  try { ARACI_ADRES = ARACI_ADRES || localStorage.getItem("dh-ozel-ders-araci") || ""; } catch (e) {}
  if (ARACI_ADRES && !/^https:\/\/[a-z0-9.-]+\.workers\.dev\/?$|^http:\/\/127\.0\.0\.1:\d+\/?$/i.test(ARACI_ADRES)) ARACI_ADRES = "";

  var K = "dh-ozel-ders-v1";
  var GUNLUK_SINIR = 3;
  var ADET = 12;
  var EN_AZ = 6;
  var KELIME_SINIRI = { A1: 12, A2: 14, B1: 16, B2: 20, C1: 26, C2: 30 };
  var JARGON = /\b(software|sql|database|server|servers|coding|code|deploy|deployment|api|algorithm|programming|programmer|developer|debug|debugging|loop|query|queries|spreadsheet|kpi|stakeholder|backend|frontend|repository|compile)\b/i;

  /* ---------- depo ---------- */
  function bugun() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function oku() {
    var v;
    try { v = JSON.parse(localStorage.getItem(K) || "null"); } catch (e) { v = null; }
    v = v && typeof v === "object" ? v : {};
    if (!Array.isArray(v.uretilen)) v.uretilen = [];
    if (!Array.isArray(v.bayrak)) v.bayrak = [];
    if (!v.gun || v.gun.t !== bugun()) v.gun = { t: bugun(), n: 0 };
    v.sira = v.sira | 0;
    return v;
  }
  function yaz(v) { try { localStorage.setItem(K, JSON.stringify(v)); } catch (e) {} }

  function cihazKimligi() {
    var k = "dh-cihaz-kimligi";
    try {
      var v = localStorage.getItem(k);
      if (!v) { v = "c" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return "bilinmiyor"; }
  }

  /* ---------- betik yükleme ---------- */
  function betik(src, kontrol) {
    if (kontrol()) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error(src + " yüklenemedi")); };
      document.head.appendChild(s);
    });
  }
  var _hazir = null;
  function hazirla() {
    if (_hazir) return _hazir;
    _hazir = betik("./sentences-loader.js?v=20", function () { return !!global.DHSent; })
      .then(function () { return betik("./profile.js?v=2", function () { return !!global.DHProfile; }); })
      .then(function () { return betik("./dh-amac.js?v=2", function () { return !!global.DHAmac; }); })
      .then(function () { return betik("./dh-modul-tanim.js?v=3", function () { return !!global.DHModulTanim; }); })
      .then(function () { return betik("./ai-providers.js?v=t35", function () { return !!global.DHProviders; }); })
      .then(function () { return betik("./dh-modul.js?v=10", function () { return !!global.DHModul; }); })
      .then(function () { return global.DHModul.hazir ? global.DHModul.hazir() : null; })
      .catch(function (e) { _hazir = null; throw e; });
    return _hazir;
  }

  /* ---------- hangi yapay zekâ yolu ---------- */
  function yol() {
    var P = global.DHProviders;
    try { if (P && P.mode && P.mode() === "api" && P.realHasAnyKey && P.realHasAnyKey()) return "api"; } catch (e) {}
    if (ARACI_ADRES) return "araci";
    return "elle";
  }

  /* Günlük sınır YALNIZ ara sunucu (sahibin ortak anahtarı) için.
     Kendi anahtarı ya da Gemini kopyala-yapıştır yolunda sınır yok. */
  function sinirli() { return yol() === "araci"; }
  function kalanHak() { return sinirli() ? Math.max(0, GUNLUK_SINIR - oku().gun.n) : Infinity; }

  /* ---------- konu ve kaynak seçimi ---------- */
  function amacSec(v) {
    var ids = global.DHAmac ? global.DHAmac.secili() : [];
    if (!ids.length) return null;
    return global.DHAmac.bul(ids[v.sira % ids.length]);
  }

  function kaynakSec(amacId, v) {
    return Promise.all([global.DHSent.index(), global.DHProfile.nextModule()]).then(function (a) {
      var ix = a[0], sonraki = a[1];
      var mods = (ix && ix.modules) || [];
      if (!mods.length) throw new Error("Modül listesi yüklenemedi.");
      var i = 0;
      for (var j = 0; j < mods.length; j++) if (mods[j].mod === sonraki) { i = j; break; }
      var lvl = mods[i].lvl;
      var G = global.DHModulTanim;
      var gramer = function (m) { return !G || G.gramerMi(m.mod); };
      /* Sıradaki modülden başlayarak aynı seviyedeki ilk DİL BİLGİSİ modülü;
         durum modülleri (Havalimanı, Aile…) atlanır */
      var yedek = null;
      for (var k = 0; i + k < mods.length; k++) {
        var m = mods[i + k];
        if (m.lvl !== lvl) break;
        if (!gramer(m)) continue;
        if (!yedek) yedek = m;
        var var_ = v.uretilen.some(function (u) { return u.kaynak === m.mod && u.amac === amacId; });
        if (!var_) return m;
      }
      if (yedek) return yedek;
      var ilkG = mods.filter(function (m) { return m.lvl === lvl && gramer(m); })[0];
      return ilkG || mods[i];
    });
  }

  function ornekAl(m) {
    var ids = (m.ids || []).slice(0, 2);
    if (!ids.length) return Promise.resolve([]);
    return global.DHSent.byIds(ids).then(function (h) {
      return ids.map(function (x) { return h[x]; }).filter(Boolean);
    }).catch(function () { return []; });
  }

  function benzersizAd(ad) {
    var var_ = {};
    (global.DHModul.liste() || []).forEach(function (x) { var_[x.ad] = 1; });
    if (!var_[ad]) return ad;
    for (var n = 2; n < 50; n++) if (!var_[ad + " " + n]) return ad + " " + n;
    return ad + " " + Date.now().toString(36).slice(-3);
  }

  /* ---------- istem ---------- */
  function istemKur(amac, m, ornekler, onek, ad) {
    var ilk = ornekler[0] || {};
    var seviye = String(m.lvl || "A1").toUpperCase();
    var temel = global.DHModul.promptUret({
      alan: amac.alan, seviye: seviye, kaynakModul: m.mod,
      grammar: ilk.grammar || "", tense: ilk.tense || "Present Simple",
      adet: ADET, modulAd: ad, kimlikOnek: onek, ornekler: ornekler
    });
    var L = [];
    L.push("");
    L.push("════════ ÖĞRENCİYİ TANI (en önemli kural) ════════");
    L.push("Öğrenci 50–80 yaşında, Türkçe konuşan bir yetişkin. İngilizceyi \"" + amac.ad + "\" için öğreniyor.");
    L.push("Cümleler onun GERÇEK hayatından olsun. Sahneler: " + amac.konu + ".");
    if (amac.ozel) {
      L.push("Konuyu öğrenci KENDİSİ yazdı: \"" + amac.konu + "\". Bütün cümleler bu konunun içinden olsun;");
      L.push("konu belirsizse en doğal, gündelik yorumunu seç. Konu uygunsuzsa genel gündelik cümleler yaz.");
    } else if (amac.id !== "is" && amac.id !== "akademik") {
      L.push("Bilgisayar, yazılım, veritabanı, şirket, toplantı ve sınav dili KULLANMA.");
    }
    L.push("Her İngilizce cümle en fazla " + (KELIME_SINIRI[seviye] || 16) + " kelime olsun.");
    L.push("highlights ve aiExplain alanlarını sade, gündelik Türkçeyle yaz. Dil bilgisi terimi");
    L.push("kullanman gerekirse parantez içinde ne demek olduğunu söyle.");
    return temel + "\n" + L.join("\n");
  }

  /* ---------- yapay zekâya gönder ---------- */
  function araciCagir(gorev, istem) {
    return fetch(ARACI_ADRES.replace(/\/+$/, "") + "/" + gorev, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-DH-Cihaz": cihazKimligi() },
      body: JSON.stringify({ istem: istem })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 429) throw { code: "sinir", mesaj: j.mesaj || "Bugünkü ders hakkı doldu." };
        if (!r.ok || !j.metin) throw { code: "araci", mesaj: j.mesaj || ("Araç cevap vermedi (" + r.status + ").") };
        return j.metin;
      });
    });
  }

  function gonder(y, istem, uzun) {
    var mesajlar = [
      { role: "system", content: "Sen deneyimli bir İngilizce öğretmenisin. Yalnız istenen JSON'u döndür." },
      { role: "user", content: istem }
    ];
    if (y === "api") {
      return global.DHProviders.chat(mesajlar, {
        temperature: 0.5, max_tokens: uzun ? 12000 : 3000, slowMs: 60000, title: "✨ Bana özel ders"
      });
    }
    if (y === "araci") return araciCagir(uzun ? "uret" : "denetle", istem);
    return global.DHProviders.manualChat(mesajlar, {
      directPrompt: istem,
      title: "✨ Bana özel ders",
      validateReply: function (metin) {
        var a = global.DHModul.ayristir(metin);
        if (!a.ok) throw new Error("Bu cevap ders biçiminde değil. Gemini'nin cevabının TAMAMINI kopyalayıp tekrar deneyin.");
      }
    });
  }

  /* ---------- denetim ---------- */
  function bos(v) { return v == null || String(v).trim() === ""; }

  function yerelDenetim(kayitlar, ctx) {
    var atilan = [];
    var ICERIK = ["en", "tr", "ipa", "trPron", "aiExplain", "highlights", "commonMistake"];
    var sinir = KELIME_SINIRI[ctx.seviye] || 16;
    var temiz = [];
    (kayitlar || []).forEach(function (k) {
      if (!k || typeof k !== "object") return;
      if (ICERIK.some(function (a) { return bos(k[a]); })) { atilan.push({ en: k.en, neden: "eksik alan" }); return; }
      var kelime = String(k.en).trim().split(/\s+/).length;
      if (kelime > sinir) { atilan.push({ en: k.en, neden: "çok uzun" }); return; }
      if (ctx.jargonYasak && JARGON.test([k.en, k.scenario, k.topic].join(" "))) { atilan.push({ en: k.en, neden: "konu dışı" }); return; }
      /* ikincil alanlar boşsa makul bir değerle doldurulur */
      if (bos(k.topic)) k.topic = ctx.alan;
      if (bos(k.scenario)) k.scenario = ctx.alan;
      if (bos(k.grammar)) k.grammar = ctx.grammar || ctx.tense || "—";
      if (bos(k.tense)) k.tense = ctx.tense || "Present Simple";
      if (bos(k.collocations)) k.collocations = "—";
      if (bos(k.synonyms)) k.synonyms = "—";
      if (bos(k.antonyms)) k.antonyms = "none";
      if (bos(k.imgQuery)) k.imgQuery = String(k.topic).split(/\s+/).slice(0, 4).join(" ");
      temiz.push(k);
    });
    temiz = global.DHModul.tekrarlariAyikla(temiz).kayitlar;
    numarala(temiz, ctx);

    /* Modüllerim'in denetimi: hata veren kayıt atılır, kalanlar yeniden denetlenir */
    for (var tur = 0; tur < 3; tur++) {
      var r = global.DHModul.dogrula(temiz, { seviye: ctx.seviye });
      if (!r.hatalar.length) break;
      var kotu = {};
      r.hatalar.forEach(function (h) { var m = String(h).match(/^#(\d+)\s/); if (m) kotu[(+m[1]) - 1] = 1; });
      if (!Object.keys(kotu).length) break;
      temiz = temiz.filter(function (k, i) { if (kotu[i]) { atilan.push({ en: k.en, neden: "biçim" }); return false; } return true; });
      numarala(temiz, ctx);
    }
    return { kayitlar: temiz, atilan: atilan };
  }

  function numarala(kayitlar, ctx) {
    kayitlar.forEach(function (k, i) {
      k.id = ctx.onek + "-" + ("00" + (i + 1)).slice(-3);
      k.order = i + 1;
      k.module = ctx.ad;
      k.level = ctx.seviye;
      k.part = "P1 Foundation";
      k.stage = "Foundation";
    });
  }

  /* İkinci yapay zekâ denetimi. Başarısız olursa (ağ, biçim) denetimsiz
     geçilir — yerel denetim zaten yapıldı. */
  function ikinciDenetim(y, kayitlar, seviye) {
    if (y === "elle" || !kayitlar.length) return Promise.resolve({ kayitlar: kayitlar, atilan: [] });
    var L = [];
    L.push("Aşağıda Türkçe konuşan bir öğrenci için yazılmış " + seviye + " seviyesinde İngilizce cümleler ve Türkçe karşılıkları var.");
    L.push("Her birini dikkatle denetle. Şunlardan BİRİ varsa o cümle HATALIDIR:");
    L.push("- İngilizce cümlede dil bilgisi hatası var ya da cümle doğal değil");
    L.push("- Türkçe karşılık İngilizce cümlenin anlamını doğru vermiyor");
    L.push("- Cümle " + seviye + " seviyesine göre belirgin biçimde zor");
    L.push("Sadece şu biçimde JSON döndür, başka hiçbir şey yazma:");
    L.push('{"hatali":[{"no":3,"neden":"kısa Türkçe neden"}]}');
    L.push('Hiç hata yoksa: {"hatali":[]}');
    L.push("");
    kayitlar.forEach(function (k, i) { L.push((i + 1) + ". EN: " + k.en + " | TR: " + k.tr); });
    return gonder(y, L.join("\n"), false).then(function (metin) {
      var t = String(metin || ""), b = t.indexOf("{"), e = t.lastIndexOf("}");
      var j = JSON.parse(t.slice(b, e + 1));
      var kotu = {};
      (j.hatali || []).forEach(function (x) { var n = parseInt(x && x.no, 10); if (n > 0) kotu[n - 1] = (x.neden || "denetim"); });
      var atilan = [];
      var kalan = kayitlar.filter(function (k, i) { if (kotu[i]) { atilan.push({ en: k.en, neden: kotu[i] }); return false; } return true; });
      /* Denetçi neredeyse hepsini attıysa denetçiye güvenme */
      if (kalan.length < EN_AZ && kayitlar.length >= EN_AZ) return { kayitlar: kayitlar, atilan: [] };
      return { kayitlar: kalan, atilan: atilan };
    }).catch(function () { return { kayitlar: kayitlar, atilan: [] }; });
  }

  /* ---------- ana akış ---------- */
  var _calisiyor = null;
  var K_YARIM = "dh-ozel-ders-yarim";
  function elleYarim() {
    try {
      var x = JSON.parse(localStorage.getItem(K_YARIM) || "null");
      if (x && x.istem && Date.now() - (x.t || 0) < 6 * 3600 * 1000) return x;
    } catch (e) {}
    return null;
  }
  function elleTemizle() { try { localStorage.removeItem(K_YARIM); } catch (e) {} }

  function uret(opt) {
    opt = opt || {};
    if (_calisiyor) return _calisiyor;
    var bildir = typeof opt.durum === "function" ? opt.durum : function () {};
    _calisiyor = hazirla().then(function () {
      var v = oku();
      if (sinirli() && v.gun.n >= GUNLUK_SINIR) throw { code: "sinir", mesaj: "Bugün " + GUNLUK_SINIR + " özel ders hazırlandı. Yarın yenileri hazırlanır." };
      var amac = opt.amacId ? global.DHAmac.bul(opt.amacId) : amacSec(v);
      if (!amac) throw { code: "amac", mesaj: "Önce İngilizceyi ne için öğrendiğinizi seçin." };
      var y = opt.yol || yol();
      if (opt.sessiz && y === "elle") throw { code: "elle", mesaj: "Arka planda hazırlanamaz." };

      bildir("Konu seçiliyor…");
      /* Kopyala-yapıştır yolunda kullanıcı Gemini'ye geçince telefon sayfayı
         yeniden yükleyebilir. Yarım kalan iş saklanır; aynı istem yeniden
         kurulur ki Gemini köprüsü aynı görev kimliğini kullansın. */
      var yarim = y === "elle" ? elleYarim() : null;
      if (yarim && yarim.amac !== amac.id) { elleTemizle(); yarim = null; }
      var kaynakP = opt.kaynakMod
        ? global.DHSent.index().then(function (ix) {
            var m = ((ix && ix.modules) || []).filter(function (x) { return x.mod === opt.kaynakMod; })[0];
            if (!m) throw { code: "modul", mesaj: "Seçilen modül bulunamadı." };
            return m;
          })
        : null;
      if (yarim && opt.kaynakMod && yarim.m && yarim.m.mod !== opt.kaynakMod) { elleTemizle(); yarim = null; }
      var hazirlik = yarim
        ? Promise.resolve(yarim)
        : (kaynakP || kaynakSec(amac.id, v)).then(function (m) {
            return ornekAl(m).then(function (ornekler) {
              var ilk = ornekler[0] || {};
              var seviye = String(m.lvl || "A1").toUpperCase();
              var ctx = {
                seviye: seviye, alan: amac.alan, grammar: ilk.grammar || "", tense: ilk.tense || "",
                onek: global.DHModul.kimlikUret(amac.alan),
                ad: benzersizAd(global.DHModul.adUret(m.mod, amac.alan)),
                jargonYasak: !amac.ozel && amac.id !== "is" && amac.id !== "akademik"
              };
              var is = { amac: amac.id, m: { mod: m.mod, lvl: m.lvl }, ctx: ctx, istem: istemKur(amac, m, ornekler, ctx.onek, ctx.ad), t: Date.now() };
              if (y === "elle") { try { localStorage.setItem(K_YARIM, JSON.stringify(is)); } catch (e) {} }
              return is;
            });
          });
      return hazirlik.then(function (is) {
        var m = is.m, ctx = is.ctx, istem = is.istem, seviye = ctx.seviye;
        return (function () {

          function dene(sayi, ekNot) {
            bildir(y === "elle" ? "Gemini penceresi açılıyor…" : "Cümleler yazılıyor ve kontrol ediliyor… (1–2 dakika sürebilir, sayfayı kapatmayın)");
            return gonder(y, ekNot ? istem + "\n\n" + ekNot : istem, true).then(function (metin) {
              bildir("Cümleler kontrol ediliyor…");
              var a = global.DHModul.ayristir(metin);
              if (!a.ok) throw { code: "bicim", mesaj: "Gelen cevap ders biçiminde değildi." };
              var yd = yerelDenetim(a.kayitlar, ctx);
              return ikinciDenetim(y, yd.kayitlar, seviye).then(function (ik) {
                var son = ik.kayitlar;
                numarala(son, ctx);
                if (son.length < EN_AZ) throw { code: "az", mesaj: "Yeterince iyi cümle çıkmadı (" + son.length + ")." };
                return { kayitlar: son, atilan: yd.atilan.concat(ik.atilan) };
              });
            }).catch(function (err) {
              if (err && (err.code === "abort" || err.code === "sinir")) throw err;
              if (sayi < 2 && y !== "elle") {
                return dene(sayi + 1, "ÖNCEKİ DENEMEDE SORUN OLDU: " + ((err && err.mesaj) || "biçim hatası") +
                  " Bu sefer kurallara harfiyen uy ve yalnızca JSON dizisi döndür.");
              }
              throw err;
            });
          }

          return dene(1).then(function (sonuc) {
            bildir("Kaydediliyor…");
            var r = global.DHModul.kaydet(sonuc.kayitlar, {
              id: ctx.onek, modulAd: ctx.ad, alan: amac.alan, seviye: seviye, kaynakModul: m.mod
            });
            if (!r.ok) throw { code: "depo", mesaj: r.hata || "Kaydedilemedi." };
            var v2 = oku();
            v2.uretilen.unshift({ id: r.id, ad: ctx.ad, amac: amac.id, kaynak: m.mod, seviye: seviye,
                                  n: r.n, tarih: Date.now(), acildi: false, atilan: sonuc.atilan.length });
            v2.uretilen = v2.uretilen.slice(0, 60);
            v2.gun.n++;
            v2.sira++;
            v2.sonHata = null;
            yaz(v2);
            elleTemizle();
            return { id: r.id, ad: ctx.ad, n: r.n, amac: amac, atilan: sonuc.atilan };
          });
        })();
      });
    }).catch(function (err) {
      if (err && err.code === "abort") elleTemizle();
      if (!(err && err.code === "abort")) {
        var v3 = oku();
        v3.sonHata = { t: Date.now(), metin: (err && (err.mesaj || err.message)) || "bilinmeyen hata" };
        yaz(v3);
      }
      throw err;
    });
    var bitir = function () { _calisiyor = null; };
    _calisiyor.then(bitir, bitir);
    return _calisiyor;
  }

  /* ---------- kayıtlar ---------- */
  function liste() {
    var v = oku();
    if (!global.DHModul) return v.uretilen;
    var var_ = {};
    (global.DHModul.liste() || []).forEach(function (x) { var_[x.id] = x; });
    return v.uretilen.filter(function (u) { return !!var_[u.id]; }).map(function (u) {
      var x = var_[u.id]; u.n = x.n; return u;
    });
  }
  function bekleyen() {
    var l = liste();
    for (var i = 0; i < l.length; i++) if (!l[i].acildi) return l[i];
    return null;
  }
  function acildi(id) {
    var v = oku();
    v.uretilen.forEach(function (u) { if (u.id === id) u.acildi = true; });
    yaz(v);
  }
  function bayrakla(id, en) {
    var M = global.DHModul;
    if (!M) return false;
    var meta = (M.liste() || []).filter(function (x) { return x.id === id; })[0];
    if (!meta) return false;
    var kayitlar = (M.getir(id) || []).filter(function (k) { return k && k.en !== en; });
    if (!kayitlar.length) return false;
    var r = M.kaydet(kayitlar, { id: id, modulAd: meta.ad, alan: meta.alan, seviye: meta.level, kaynakModul: meta.kaynakModul });
    var v = oku();
    v.bayrak.unshift({ id: id, en: en, t: Date.now() });
    v.bayrak = v.bayrak.slice(0, 100);
    yaz(v);
    return !!(r && r.ok);
  }

  /* Koçun onay ekranı için: varsayılan modül, seviyedeki modüller, örnek cümle */
  function varsayilan(amacId) {
    return hazirla().then(function () { return kaynakSec(amacId || "", oku()); })
      .then(function (m) { return { mod: m.mod, lvl: m.lvl }; });
  }
  function moduller(lvl) {
    return hazirla().then(function () { return global.DHSent.index(); }).then(function (ix) {
      var G = global.DHModulTanim;
      return ((ix && ix.modules) || []).filter(function (m) { return m.lvl === lvl && (!G || G.gramerMi(m.mod)); })
        .map(function (m) { return { mod: m.mod, lvl: m.lvl, n: (m.ids || []).length }; });
    });
  }
  function ornek(mod) {
    return hazirla().then(function () { return global.DHSent.module(mod); }).then(function (k) {
      var l = (k || []).slice(0, 12).filter(function (x) {
        return x && x.en && x.tr && x.en.split(" ").length <= 12 && !/❌|\(/.test(x.tr + x.en);
      });
      l.sort(function (a, b) { return a.en.length - b.en.length; });
      return l[0] ? { en: l[0].en, tr: l[0].tr } : null;
    }).catch(function () { return null; });
  }

  /* Arka planda sıradakini hazırla. Yalnız kullanıcının dokunması
     gerekmeyen yollarda (api/araci); günde bir başarısız denemeden sonra
     6 saat bekler; hazırda bekleyen ders varsa yenisini yapmaz. */
  function onceden() {
    /* KAPALI (11 Kasım, kullanıcı isteği): ders, koç seviyeyi ve modülü
       anlatıp kullanıcı onay verdikten SONRA oluşturulur. Arka planda
       onaysız üretim yapılmaz. Kod ileride "onaylı ayarla otomatik" için duruyor. */
    if (!global.__dhOzelDersOtomatik) return Promise.resolve(null);
    return hazirla().then(function () {
      if (yol() === "elle") return null;
      if (!global.DHAmac.secili().length) return null;
      if (kalanHak() <= 0) return null;
      if (bekleyen()) return null;
      var v = oku();
      if (v.sonHata && Date.now() - v.sonHata.t < 6 * 3600 * 1000) return null;
      return uret({ sessiz: true });
    }).catch(function () { return null; });
  }

  global.DHOzelDers = {
    hazirla: hazirla, yol: yol, uret: uret, onceden: onceden,
    bekleyen: bekleyen, liste: liste, acildi: acildi, bayrakla: bayrakla,
    kalanHak: kalanHak, GUNLUK_SINIR: GUNLUK_SINIR,
    elleBekliyor: function () { return !!elleYarim(); },
    elleBilgi: function () { var y = elleYarim(); return y ? { amac: y.amac, mod: y.m && y.m.mod } : null; },
    varsayilan: varsayilan, moduller: moduller, ornek: ornek,
    siradakiAmac: function () { return global.DHAmac ? amacSec(oku()) : null; },
    _yerelDenetim: yerelDenetim, _istemKur: istemKur
  };
})(window);
