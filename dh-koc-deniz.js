/* dh-koc-deniz.js — DENİZ'İN GÜNLÜK KARARI: sabah özeti + bugünün planı (koç planı, 2. aşama)
   ====================================================================
   Model koç beynini (denizkoç.md) okur ve JSON döndürür:
     { "ozet": "...", "plan": [ {"ekran":"tekrar","dk":15,"neden":"..."} ], "not": {"metin":"...","kaynak":"veri|tahmin"} | null }
   KOD DENETLER (dogrula):
     - JSON ve alanlar geçerli mi, ekran izinli listede mi, dk 3–60 arası mı;
     - toplam süre günlük tercihin %40–%140'ı arasında mı;
     - bekleyen tekrar varsa planda bir tekrar adımı var mı;
     - rakam uydurma: özet ve gerekçelerdeki her sayı koç beyninde ya da planda geçiyor mu;
     - rakam doğru yerde mi: sayının çevresindeki kelimeler o sayıyı içeren olgu satırıyla eşleşiyor mu.
   Denetimden geçmeyen cevap reddedilir, sıradaki model denenir; hiçbiri olmazsa
   KURAL PLANI (kuralPlani) kullanılır — koç hiçbir zaman durmaz.
   Model sırası: Groq → Gemini → Cerebras → NVIDIA (küçük modeller koç kararına girmez).

   API (window.DHKocDeniz)
     await gunluk(zorla?)   {ozet, plan, kaynak:"model:<ad>"|"kural", t}  (gün içinde önbellek)
     await dene(saglayici, senaryo?)   model testi: tek sağlayıcıyla bir kez dener ({md,h,t} senaryosu ya da gerçek veri)
     EKRANLAR, dogrula, kuralPlani
   ==================================================================== */
(function (global) {
  "use strict";
  if (global.DHKocDeniz) return;

  var EKRANLAR = {
    tekrar:  { ad: "Cümle tekrarı",       url: "tekrar.html?plan=1",   beceri: "yazma" },
    kelime:  { ad: "Kelime",              url: "kelime-ogren.html",    beceri: "kelime" },
    konusma: { ad: "Deniz'le konuşma",    url: "konuskan.html",        beceri: "konusma" },
    dinleme: { ad: "Video ile dinleme",   url: "youtube-egitim.html",  beceri: "dinleme" },
    ders:    { ad: "Dilbilgisi dersi",    url: "ders.html",            beceri: "dilbilgisi" },
    okuma:   { ad: "Okuma",               url: "library.html",         beceri: "okuma" },
    hata:    { ad: "Hata defteri",        url: "hata-defteri.html",    beceri: "yazma" }
  };
  /* Groq önce: ~1 sn ve testte denetimi geçen cevaplar; Gemini kotası sık doluyor (24 Kasım ölçümü). */
  var SIRA = ["groq", "gemini", "cerebras", "nvidia"];
  /* Modeller ekran yerine beceri adı yazabiliyor (testte Groq: "dilbilgisi", "yazma"); eş anlamlılar ekrana çevrilir. */
  var ES = { dilbilgisi: "ders", gramer: "ders", yazma: "tekrar", cumle: "tekrar", "cümle": "tekrar", "konuşma": "konusma", sohbet: "konusma",
             video: "dinleme", "hata defteri": "hata", hatalar: "hata", kelimeler: "kelime", kitap: "okuma" };
  function ekranAdi(x) { x = String(x || "").toLowerCase().trim(); return EKRANLAR[x] ? x : (ES[x] || x); }

  function gunAnahtari() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function js(k, v) { try { var x = JSON.parse(localStorage.getItem(k) || "null"); return x == null ? v : x; } catch (e) { return v; } }

  var ISTEK = [
    "Bugün için öğrenciye sabah özetini ve bugünün planını hazırla.",
    "Yalnız şu JSON'u döndür (başka metin yok):",
    '{"ozet":"2-3 cümle, Türkçe, öğrenciye hitaben; en az bir rakamla gerekçe","plan":[{"ekran":"<' + Object.keys(EKRANLAR).join("|") + '>","dk":<sayı>,"neden":"tek cümle, Türkçe"}],"not":null}',
    "\"ekran\" alanına YALNIZ şu kimliklerden birini yaz: " + Object.keys(EKRANLAR).map(function (k) { return k + " (" + EKRANLAR[k].ad + ")"; }).join(", ") + ".",
    "Kurallar: 2-5 adım; toplam süre öğrencinin günlük süre tercihine yakın; kılavuzdaki öncelik sırasına uy; yalnız OLGULAR'daki rakamları kullan; öğrenciye \"sen\" diye hitap et.",
    "Koç beyninden yeni ve önemli bir gözlem çıkarırsan \"not\" alanına {\"metin\":\"...\",\"kaynak\":\"veri\"} yaz, yoksa null bırak."
  ].join("\n");

  /* OLGULAR: modelin kullanabileceği rakamlar, her biri kendi kelimeleriyle. Denetimde metindeki
     her rakamın çevresindeki kelimeler, o rakamı içeren bir olgu satırıyla eşleşmek zorunda
     (testte model "dinleme 0 dk" yazdı; 0 aslında konuşmanın değeriydi). */
  var BTR = { kelime: "kelime", dilbilgisi: "dilbilgisi", dinleme: "dinleme", konusma: "konuşma", okuma: "okuma", yazma: "yazma" };
  function olgular(h, t) {
    var o = [];
    o.push("günlük süre tercihi: " + ((t && t.gunlukDakika) || 30) + " dakika");
    o.push("bekleyen cümle kartı: " + h.tekrar.cumle.bekleyen + " kart");
    o.push("bekleyen kelime kartı: " + h.tekrar.kelime.bekleyen + " kart");
    if (h.tekrar.cumle.zor) o.push("zorlanılan cümle kartı: " + h.tekrar.cumle.zor + " kart");
    if (h.sure) {
      o.push("bu hafta toplam çalışma: " + h.sure.haftaDk + " dakika, " + h.sure.aktifGunHafta + " gün");
      o.push("aralıksız çalışma serisi: " + h.sure.seri + " gün");
    }
    /* Haftalık veri azken (60 dk altı) oranlar yanıltır ("konuşmayı %100 tamamladın"); yalnız dakika verilir. */
    var azVeri = !h.sure || h.sure.haftaDk < 60;
    if (azVeri) o.push("bu haftanın verisi henüz az (60 dakikadan az): beceri dağılımı ve oranları yorumlanmamalı");
    (h.beceriler || []).forEach(function (x) {
      if (azVeri) { if (x.dk) o.push(BTR[x.beceri] + " bu hafta: " + x.dk + " dakika"); return; }
      o.push(BTR[x.beceri] + " bu hafta: " + x.dk + " dakika (payı yüzde " + x.pay + ", amaca göre hedef payı yüzde " + x.hedefPay + ")" + (x.dogruluk != null ? ", " + BTR[x.beceri] + " doğruluğu yüzde " + x.dogruluk : ""));
    });
    (h.hataKonulari || []).forEach(function (k) {
      var ad = (global.DHInsights && DHInsights.label) ? DHInsights.label(k.konu) : k.konu;
      o.push(ad + " (" + k.konu + ") hataları: son 14 günde " + k.son14 + " hata, önceki 14 günde " + k.onceki14 + " hata, eğilim " + k.egilim);
    });
    (h.kisisel || []).forEach(function (x) { o.push("kişisel hedef " + x.ad + " (" + x.konu + "): " + x.gun + ". gün / " + x.toplamGun + " gün, günde " + x.gunlukDk + " dakika, hata başlangıçta " + x.basHata + ", şimdi " + x.simdiHata); });
    if (h.bugun && h.bugun.dk) o.push("bugüne özel istek: bugün " + h.bugun.dk + " dakika");
    if (h.tahmin && h.tahmin.varis) o.push("hedef kelime düzeyine kaba tahmini varış: " + h.tahmin.varis + ", kalan " + h.tahmin.kalanKelime + " kelime");
    return o;
  }
  function kokler(metin) {
    return String(metin || "").toLocaleLowerCase("tr").replace(/[^a-zçğıöşü0-9 ]/g, " ").split(/\s+/)
      .filter(function (w) { return w.length >= 4 && !/^\d/.test(w) && ["yüzde", "dakika", "hafta", "bugün", "kart", "kartı", "olan", "için", "gibi", "daha", "sonra", "önce"].indexOf(w) < 0; })
      .map(function (w) { return w.slice(0, 4); });
  }
  function eslesmeyen(metin, olguListesi) {
    var kotu = [], m, re = /\d+(?:[.,]\d+)?/g, s = String(metin || "");
    while ((m = re.exec(s))) {
      var n = m[0].replace(",", "."); if (n === "1" || n === "2") continue;
      var cevre = kokler(s.slice(Math.max(0, m.index - 45), m.index + m[0].length + 30));
      var uygun = olguListesi.some(function (ol) {
        if (sayilar(ol).indexOf(n) < 0) return false;
        var ok = kokler(ol); return cevre.some(function (w) { return ok.indexOf(w) >= 0; });
      });
      if (!uygun) kotu.push(n);
    }
    return kotu;
  }
  function sayilar(metin) { return (String(metin || "").match(/\d+(?:[.,]\d+)?/g) || []).map(function (x) { return x.replace(",", "."); }); }

  function dogrula(c, h, mdMetin, tercih, olguListesi) {
    var hatalar = [];
    if (!c || typeof c !== "object") return { ok: false, hatalar: ["JSON değil"] };
    if (typeof c.ozet !== "string" || c.ozet.trim().length < 20) hatalar.push("özet yok/kısa");
    if (!Array.isArray(c.plan) || c.plan.length < 2 || c.plan.length > 5) hatalar.push("plan 2-5 adım değil");
    var toplam = 0, izinli = true;
    (c.plan || []).forEach(function (a) { if (a) a.ekran = ekranAdi(a.ekran); });
    (c.plan || []).forEach(function (a) {
      if (!a || !EKRANLAR[a.ekran]) izinli = false;
      var dk = +a.dk; if (!(dk >= 3 && dk <= 60)) hatalar.push("süre aralık dışı: " + a.dk); else toplam += dk;
      if (!a.neden || String(a.neden).length < 8) hatalar.push("gerekçe yok");
    });
    if (!izinli) hatalar.push("izinsiz ekran");
    var hedefDk = (tercih && tercih.gunlukDakika) || 30;
    /* alt sınır %40: öğrenci "bugün kısa tut" diyebilir; üst sınır %140 */
    if (toplam && (toplam < hedefDk * 0.4 || toplam > hedefDk * 1.4)) hatalar.push("toplam " + toplam + " dk, hedef " + hedefDk);
    /* öncelik bir sert kural değil (son söz öğrencide): bekleyen tekrar varsa planda bir tekrar adımı bulunsun yeter */
    var bekleyen = h && h.tekrar ? (h.tekrar.cumle.bekleyen + h.tekrar.kelime.bekleyen) : 0;
    if (bekleyen > 0 && Array.isArray(c.plan) && !c.plan.some(function (a) { return a && ["tekrar", "kelime", "hata"].indexOf(a.ekran) >= 0; })) hatalar.push("bekleyen tekrar varken planda tekrar yok");
    /* rakam uydurma denetimi */
    var izinliSayilar = {}; sayilar(mdMetin).forEach(function (x) { izinliSayilar[x] = 1; });
    (c.plan || []).forEach(function (a) { izinliSayilar[String(+a.dk)] = 1; });
    izinliSayilar[String(toplam)] = 1; izinliSayilar[String((c.plan || []).length)] = 1;
    var metin = String(c.ozet || "") + " " + (c.plan || []).map(function (a) { return a && a.neden; }).join(" ");
    var uydurma = sayilar(metin).filter(function (x) { return !izinliSayilar[x] && +x > 2; });
    if (uydurma.length) hatalar.push("koç beyninde olmayan rakam: " + uydurma.slice(0, 4).join(", "));
    if (olguListesi && !uydurma.length) {
      /* plan süreleri de geçerli olgudur */
      var ek = (c.plan || []).map(function (a) { return a && EKRANLAR[a.ekran] ? EKRANLAR[a.ekran].ad + " " + a.ekran + " " + (BTR[EKRANLAR[a.ekran].beceri] || "") + " planı: " + a.dk + " dakika" : ""; });
      ek.push("bugünkü planımız toplam çalışma süresi: " + toplam + " dakika");
      ek.push("günlük süre tercihi hedef toplam planımız bugün: " + ((tercih && tercih.gunlukDakika) || 30) + " dakika");
      var yanlis = eslesmeyen(c.ozet, olguListesi.concat(ek));
      (c.plan || []).forEach(function (a) { if (a) yanlis = yanlis.concat(eslesmeyen(a.neden, olguListesi.concat(ek))); });
      if (yanlis.length) hatalar.push("rakam yanlış yerde kullanılmış: " + yanlis.slice(0, 4).join(", "));
    }
    if (c.not != null && (typeof c.not !== "object" || ["veri", "tahmin"].indexOf(c.not.kaynak) < 0 || !c.not.metin)) hatalar.push("not biçimi");
    return { ok: !hatalar.length, hatalar: hatalar, toplamDk: toplam };
  }

  function kuralPlani(h, tercih) {
    var hedefDk = (tercih && tercih.gunlukDakika) || 30, plan = [], kalan = hedefDk;
    function ekle(ekran, dk, neden) { if (kalan < 5) return; dk = Math.max(5, Math.min(kalan, dk)); if (dk >= 5 && plan.length < 5) { plan.push({ ekran: ekran, dk: dk, neden: neden }); kalan -= dk; } }
    var bc = h.tekrar.cumle.bekleyen, bk = h.tekrar.kelime.bekleyen;
    if (bc > 0) ekle("tekrar", Math.min(15, 5 + Math.ceil(bc / 4)), bc + " cümle kartının tekrar zamanı geldi.");
    if (bk > 0) ekle("kelime", Math.min(10, 5 + Math.ceil(bk / 6)), bk + " kelimenin tekrar zamanı geldi.");
    (h.kisisel || []).slice(0, 2).forEach(function (x) { ekle(KONU_EKRAN[x.konu] || "hata", Math.min(x.gunlukDk || 10, 15), "Kişisel hedefin: " + x.ad + " (" + x.gun + ". gün)."); });
    var geride = (h.gerideBeceri || []).filter(function (b) { return ["konusma", "dinleme", "okuma", "dilbilgisi", "kelime"].indexOf(b) >= 0; });
    var map = { konusma: "konusma", dinleme: "dinleme", okuma: "okuma", dilbilgisi: "ders", kelime: "kelime", yazma: "tekrar" };
    geride.slice(0, 2).forEach(function (b) { if (!plan.some(function (a) { return a.ekran === map[b]; })) ekle(map[b], 10, "Bu hafta " + (global.DHKocBeyin ? DHKocBeyin.BECERI_TR[b] : b) + " amacına göre geride kaldı."); });
    if (!plan.some(function (a) { return a.ekran === "konusma"; }) && kalan >= 5) ekle("konusma", 10, "Her gün biraz konuşmak akıcılığı korur.");
    if (kalan >= 5) ekle("kelime", kalan, "Kalan süreyi yeni kelimelerle değerlendirelim.");
    var KISA = { tekrar: "cümle tekrarı", kelime: "kelime çalışması", konusma: "Deniz'le konuşma", dinleme: "video ile dinleme", ders: "dilbilgisi dersi", okuma: "okuma", hata: "hata defteri" };
    var ilk = plan[0] ? (KISA[plan[0].ekran] || EKRANLAR[plan[0].ekran].ad) : "kısa bir pratik";
    var ozet = "Bugün " + (hedefDk - kalan) + " dakikalık bir planımız var; önce " + ilk + " ile başlayalım." +
      (h.sure && h.sure.haftaDk ? " Bu hafta şimdiye kadar " + h.sure.haftaDk + " dakika çalıştın." : "");
    return { ozet: ozet, plan: plan, not: null };
  }

  /* Kişisel hedefin konusu → çalışılacak ekran */
  var KONU_EKRAN = { pronunciation: "konusma", konusma: "konusma", dinleme: "dinleme", okuma: "okuma", vocabulary: "kelime", kelime: "kelime" };
  var KONULAR = ["preposition", "tense", "article", "word_order", "verb", "pronoun", "past-simple", "present-continuous", "question-order", "auxiliary-missing", "pronunciation", "vocabulary", "spelling", "konusma", "dinleme", "okuma", "kelime"];
  var ANAHTAR = [[/edat|preposition|\b(in|on|at|of|to|for)\b/i, "preposition"], [/zaman|tense|geçmiş|past|present|gelecek|future/i, "tense"], [/\ba\/an\b|article|\bthe\b|tanımlık/i, "article"],
    [/kelime sıra|word order|sıralama/i, "word_order"], [/telaffuz|söyleniş|pronunc|aksan/i, "pronunciation"], [/kelime|vocab|sözcük/i, "kelime"], [/soru/i, "question-order"],
    [/dinle|anlama|listening/i, "dinleme"], [/konuş|speaking|akıcı/i, "konusma"], [/oku|reading/i, "okuma"], [/yardımcı fiil|am\/is\/are|\bdo\b|\bdoes\b/i, "auxiliary-missing"]];
  function kuralYorum(metin) {
    for (var i = 0; i < ANAHTAR.length; i++) if (ANAHTAR[i][0].test(metin)) return ANAHTAR[i][1];
    return null;
  }
  /* Öğrencinin isteğini ölçülebilir hedef ÖNERİSİNE çevirir (eklemez: onayı arayüz alır). */
  async function hedefYorumla(metin) {
    var B = global.DHKocBeyin, h = await B.hesapla(), konu = null, ad = null, gun = 14, dk = 10, gerekce = "", kaynak = "kural";
    var P = global.DHProviders;
    if (P && P.chat) {
      try {
        var verim = (h.hataKonulari || []).map(function (k) { return k.konu + ": son 14 günde " + k.son14 + " hata"; }).join("; ") || "hata kaydı yok";
        var c = cozJSON(await Promise.race([P.chat([{ role: "user", content:
          "Bir İngilizce öğrencisi koçuna şunu yazdı: \"" + String(metin).slice(0, 200) + "\"\n" +
          "Öğrencinin hata verisi: " + verim + "\n" +
          "Bunu ölçülebilir bir kişisel hedefe çevir. Yalnız JSON döndür: {\"konu\":\"" + KONULAR.join("|") + "\",\"ad\":\"kısa Türkçe ad (ör. in/on/at edatları)\",\"gun\":7-30,\"gunlukDk\":5-20,\"gerekce\":\"tek cümle, Türkçe; veride olan rakamla\"}" }],
          { json: true, prefer: ["groq", "gemini"], slowMs: 12000, title: "Deniz hedef" }), new Promise(function (_, r) { setTimeout(function () { r("slow"); }, 14000); })]));
        if (c && KONULAR.indexOf(c.konu) >= 0) { konu = c.konu; ad = String(c.ad || "").slice(0, 60) || null; gun = +c.gun || 14; dk = +c.gunlukDk || 10; gerekce = String(c.gerekce || "").slice(0, 200); kaynak = "model"; }
      } catch (e) {}
    }
    if (!konu) { konu = kuralYorum(metin) || "genel"; }
    gun = Math.max(7, Math.min(30, Math.round(gun))); dk = Math.max(5, Math.min(20, Math.round(dk)));
    var sim = 0; (h.hataKonulari || []).forEach(function (k) { if (k.konu === konu) sim = k.son14; });
    /* gerekçedeki rakamlar veriyle uyuşmuyorsa gerekçeyi koddan kur */
    var izin = {}; [sim, gun, dk, 14].forEach(function (n) { izin[String(n)] = 1; });
    if (!gerekce || sayilar(gerekce).some(function (n) { return !izin[n] && +n > 2; })) gerekce = sim ? ("Son 14 günde bu konuda " + sim + " hata var; hedefimiz bunu yarıya indirmek.") : "Bu konuda henüz yeterli hata kaydı yok; ilerlemeyi birlikte ölçeceğiz.";
    var label = ad || ((global.DHInsights && DHInsights.label) ? DHInsights.label(konu) : konu);
    return { konu: konu, ad: label, gun: gun, gunlukDk: dk, gerekce: gerekce, istek: String(metin).slice(0, 160), simdiHata: sim, ekran: KONU_EKRAN[konu] || "hata", kaynak: kaynak };
  }

  function cozJSON(t) {
    if (t && typeof t === "object") return t;
    var s = String(t || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    var i = s.indexOf("{"), j = s.lastIndexOf("}");
    if (i < 0 || j <= i) return null;
    try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { return null; }
  }

  async function sor(saglayici, mdMetin, olguListesi) {
    var P = global.DHProviders; if (!P || !P.chat) throw { code: "ai-yok" };
    var t0 = Date.now();
    var istek = ISTEK + (olguListesi ? "\n\nOLGULAR (özet ve gerekçelerdeki her rakam buradan, kendi satırındaki anlamıyla alınmalı):\n- " + olguListesi.join("\n- ") : "");
    var cevap = await Promise.race([
      P.chat([{ role: "system", content: mdMetin }, { role: "user", content: istek }], { json: true, only: saglayici, slowMs: 15000, title: "Deniz günlük plan" }),
      new Promise(function (_, rej) { setTimeout(function () { rej({ code: "slow", provider: saglayici }); }, 17000); })
    ]);
    var bilgi = P.lastResponseInfo || {};
    return { metin: typeof cevap === "string" ? cevap : (cevap && cevap.text) || JSON.stringify(cevap), sure: Date.now() - t0, model: bilgi.model || saglayici };
  }

  /* senaryo: {md, h, t} verilirse onunla (model testi), yoksa bu cihazın gerçek verisiyle */
  async function dene(saglayici, senaryo) {
    var B = global.DHKocBeyin, h, t, mdMetin;
    if (senaryo && senaryo.md) { h = senaryo.h; t = senaryo.t; mdMetin = senaryo.md; }
    else { h = await B.hesapla(); t = B.tercihler(); mdMetin = await B.md(); }
    var ol = senaryo && senaryo.olgular ? senaryo.olgular : (h && h.beceriler ? olgular(h, t) : null);
    try { var r = await sor(saglayici, mdMetin, ol); var c = cozJSON(r.metin); var d = dogrula(c, h, mdMetin, t, ol); return { saglayici: saglayici, model: r.model, sureMs: r.sure, denetim: d, cevap: c, ham: c ? null : String(r.metin).slice(0, 300) }; }
    catch (e) { return { saglayici: saglayici, hata: (e && (e.code || e.message)) || String(e) }; }
  }

  /* onAra(kuralSonucu): model denenirken ekranda hemen gösterilecek kural planı */
  async function gunluk(zorla, onAra) {
    var K = "dh-koc-gun-" + gunAnahtari(), eski = js(K, null);
    if (eski && !zorla) return eski;
    var B = global.DHKocBeyin, h = await B.hesapla(true), t = B.tercihler(), mdMetin = await B.md(), sonuc = null, denemeler = [];
    if (typeof onAra === "function") { try { var ka = kuralPlani(h, t); onAra({ ozet: ka.ozet, plan: ka.plan, kaynak: "kural", ara: true, t: Date.now() }); } catch (e) {} }
    var ol = olgular(h, t);
    var P = global.DHProviders, var0 = P && P.realHasAnyKey ? P.realHasAnyKey() : !!P;
    /* Kotası dolan ya da cevap vermeyen model 6 saat atlanır (her açılışta bekletmesin). */
    var DURUM = "dh-koc-model-durum", durum = js(DURUM, {}) || {};
    if (var0) for (var i = 0; i < SIRA.length && !sonuc; i++) {
      if (durum[SIRA[i]] && Date.now() - durum[SIRA[i]] < 6 * 3600e3) { denemeler.push({ s: SIRA[i], atlandi: true }); continue; }
      try {
        var r = await sor(SIRA[i], mdMetin, ol), c = cozJSON(r.metin), d = dogrula(c, h, mdMetin, t, ol);
        denemeler.push({ s: SIRA[i], ok: d.ok, h: d.hatalar });
        if (d.ok) sonuc = { ozet: c.ozet.trim(), plan: c.plan.map(function (a) { return { ekran: a.ekran, dk: Math.round(+a.dk), neden: String(a.neden).trim() }; }), kaynak: "model:" + r.model, not: c.not };
      } catch (e) {
        var kod = (e && (e.code || e.message)) || "hata";
        denemeler.push({ s: SIRA[i], hata: kod });
        if (/all-keys-failed|rate|slow|http|no-key|all-failed/.test(String(kod))) { durum[SIRA[i]] = Date.now(); try { localStorage.setItem(DURUM, JSON.stringify(durum)); } catch (x) {} }
      }
    }
    if (!sonuc) { var k = kuralPlani(h, t); sonuc = { ozet: k.ozet, plan: k.plan, kaynak: "kural", not: null }; }
    if (sonuc.not && sonuc.not.metin) { try { await B.notEkle({ metin: sonuc.not.metin, kaynak: sonuc.not.kaynak }); } catch (e) {} }
    sonuc.t = Date.now(); sonuc.denemeler = denemeler;
    try { localStorage.setItem(K, JSON.stringify(sonuc)); } catch (e) {}
    /* eski günlerin kayıtları birikmesin */
    try { for (var a = localStorage.length - 1; a >= 0; a--) { var key = localStorage.key(a); if (key && key.indexOf("dh-koc-gun-") === 0 && key !== K) localStorage.removeItem(key); } } catch (e) {}
    return sonuc;
  }

  global.DHKocDeniz = { gunluk: gunluk, dene: dene, hedefYorumla: hedefYorumla, KONU_EKRAN: KONU_EKRAN, dogrula: dogrula, kuralPlani: kuralPlani, olgular: olgular, _eslesmeyen: eslesmeyen, EKRANLAR: EKRANLAR, ISTEK: ISTEK, SIRA: SIRA, _coz: cozJSON };
})(window);
