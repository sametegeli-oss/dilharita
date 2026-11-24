/* dh-koc-deniz.js — DENİZ'İN GÜNLÜK KARARI: sabah özeti + bugünün planı (koç planı, 2. aşama)
   ====================================================================
   Model koç beynini (denizkoç.md) okur ve JSON döndürür:
     { "ozet": "...", "plan": [ {"ekran":"tekrar","dk":15,"neden":"..."} ], "not": {"metin":"...","kaynak":"veri|tahmin"} | null }
   KOD DENETLER (dogrula):
     - JSON ve alanlar geçerli mi, ekran izinli listede mi, dk 3–60 arası mı;
     - toplam süre günlük tercihin %40–%140'ı arasında mı;
     - bekleyen tekrar varsa planda bir tekrar adımı var mı;
     - rakam uydurma: özet ve gerekçelerdeki her sayı koç beyninde ya da planda geçiyor mu.
   Denetimden geçmeyen cevap reddedilir, sıradaki model denenir; hiçbiri olmazsa
   KURAL PLANI (kuralPlani) kullanılır — koç hiçbir zaman durmaz.
   Model sırası: Gemini → Groq → Cerebras → NVIDIA (küçük modeller koç kararına girmez).

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
  var SIRA = ["gemini", "groq", "cerebras", "nvidia"];

  function gunAnahtari() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function js(k, v) { try { var x = JSON.parse(localStorage.getItem(k) || "null"); return x == null ? v : x; } catch (e) { return v; } }

  var ISTEK = [
    "Bugün için öğrenciye sabah özetini ve bugünün planını hazırla.",
    "Yalnız şu JSON'u döndür (başka metin yok):",
    '{"ozet":"2-3 cümle, Türkçe, öğrenciye hitaben; en az bir rakamla gerekçe","plan":[{"ekran":"<' + Object.keys(EKRANLAR).join("|") + '>","dk":<sayı>,"neden":"tek cümle, Türkçe"}],"not":null}',
    "Kurallar: 2-5 adım; toplam süre öğrencinin günlük süre tercihine yakın; kılavuzdaki öncelik sırasına uy; yalnız koç beynindeki rakamları kullan.",
    "Koç beyninden yeni ve önemli bir gözlem çıkarırsan \"not\" alanına {\"metin\":\"...\",\"kaynak\":\"veri\"} yaz, yoksa null bırak."
  ].join("\n");

  function sayilar(metin) { return (String(metin || "").match(/\d+(?:[.,]\d+)?/g) || []).map(function (x) { return x.replace(",", "."); }); }

  function dogrula(c, h, mdMetin, tercih) {
    var hatalar = [];
    if (!c || typeof c !== "object") return { ok: false, hatalar: ["JSON değil"] };
    if (typeof c.ozet !== "string" || c.ozet.trim().length < 20) hatalar.push("özet yok/kısa");
    if (!Array.isArray(c.plan) || c.plan.length < 2 || c.plan.length > 5) hatalar.push("plan 2-5 adım değil");
    var toplam = 0, izinli = true;
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
    if (c.not != null && (typeof c.not !== "object" || ["veri", "tahmin"].indexOf(c.not.kaynak) < 0 || !c.not.metin)) hatalar.push("not biçimi");
    return { ok: !hatalar.length, hatalar: hatalar, toplamDk: toplam };
  }

  function kuralPlani(h, tercih) {
    var hedefDk = (tercih && tercih.gunlukDakika) || 30, plan = [], kalan = hedefDk;
    function ekle(ekran, dk, neden) { if (kalan < 5) return; dk = Math.max(5, Math.min(kalan, dk)); if (dk >= 5 && plan.length < 5) { plan.push({ ekran: ekran, dk: dk, neden: neden }); kalan -= dk; } }
    var bc = h.tekrar.cumle.bekleyen, bk = h.tekrar.kelime.bekleyen;
    if (bc > 0) ekle("tekrar", Math.min(15, 5 + Math.ceil(bc / 4)), bc + " cümle kartının tekrar zamanı geldi.");
    if (bk > 0) ekle("kelime", Math.min(10, 5 + Math.ceil(bk / 6)), bk + " kelimenin tekrar zamanı geldi.");
    var geride = (h.gerideBeceri || []).filter(function (b) { return ["konusma", "dinleme", "okuma", "dilbilgisi", "kelime"].indexOf(b) >= 0; });
    var map = { konusma: "konusma", dinleme: "dinleme", okuma: "okuma", dilbilgisi: "ders", kelime: "kelime", yazma: "tekrar" };
    geride.slice(0, 2).forEach(function (b) { if (!plan.some(function (a) { return a.ekran === map[b]; })) ekle(map[b], 10, "Bu hafta " + (global.DHKocBeyin ? DHKocBeyin.BECERI_TR[b] : b) + " amacına göre geride kaldı."); });
    if (!plan.some(function (a) { return a.ekran === "konusma"; }) && kalan >= 5) ekle("konusma", 10, "Her gün biraz konuşmak akıcılığı korur.");
    if (kalan >= 5) ekle("kelime", kalan, "Kalan süreyi yeni kelimelerle değerlendirelim.");
    var ilk = plan[0] ? EKRANLAR[plan[0].ekran].ad.toLowerCase() : "kısa bir pratik";
    var ozet = "Bugün " + (hedefDk - kalan) + " dakikalık bir planımız var; önce " + ilk + " ile başlayalım." +
      (h.sure && h.sure.haftaDk ? " Bu hafta şimdiye kadar " + h.sure.haftaDk + " dakika çalıştın." : "");
    return { ozet: ozet, plan: plan, not: null };
  }

  function cozJSON(t) {
    if (t && typeof t === "object") return t;
    var s = String(t || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    var i = s.indexOf("{"), j = s.lastIndexOf("}");
    if (i < 0 || j <= i) return null;
    try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { return null; }
  }

  async function sor(saglayici, mdMetin) {
    var P = global.DHProviders; if (!P || !P.chat) throw { code: "ai-yok" };
    var t0 = Date.now();
    var cevap = await P.chat([{ role: "system", content: mdMetin }, { role: "user", content: ISTEK }], { json: true, only: saglayici, slowMs: 40000, title: "Deniz günlük plan" });
    var bilgi = P.lastResponseInfo || {};
    return { metin: typeof cevap === "string" ? cevap : (cevap && cevap.text) || JSON.stringify(cevap), sure: Date.now() - t0, model: bilgi.model || saglayici };
  }

  /* senaryo: {md, h, t} verilirse onunla (model testi), yoksa bu cihazın gerçek verisiyle */
  async function dene(saglayici, senaryo) {
    var B = global.DHKocBeyin, h, t, mdMetin;
    if (senaryo && senaryo.md) { h = senaryo.h; t = senaryo.t; mdMetin = senaryo.md; }
    else { h = await B.hesapla(); t = B.tercihler(); mdMetin = await B.md(); }
    try { var r = await sor(saglayici, mdMetin); var c = cozJSON(r.metin); var d = dogrula(c, h, mdMetin, t); return { saglayici: saglayici, model: r.model, sureMs: r.sure, denetim: d, cevap: c, ham: c ? null : String(r.metin).slice(0, 300) }; }
    catch (e) { return { saglayici: saglayici, hata: (e && (e.code || e.message)) || String(e) }; }
  }

  async function gunluk(zorla) {
    var K = "dh-koc-gun-" + gunAnahtari(), eski = js(K, null);
    if (eski && !zorla) return eski;
    var B = global.DHKocBeyin, h = await B.hesapla(true), t = B.tercihler(), mdMetin = await B.md(), sonuc = null, denemeler = [];
    var P = global.DHProviders, var0 = P && P.realHasAnyKey ? P.realHasAnyKey() : !!P;
    if (var0) for (var i = 0; i < SIRA.length && !sonuc; i++) {
      try {
        var r = await sor(SIRA[i], mdMetin), c = cozJSON(r.metin), d = dogrula(c, h, mdMetin, t);
        denemeler.push({ s: SIRA[i], ok: d.ok, h: d.hatalar });
        if (d.ok) sonuc = { ozet: c.ozet.trim(), plan: c.plan.map(function (a) { return { ekran: a.ekran, dk: Math.round(+a.dk), neden: String(a.neden).trim() }; }), kaynak: "model:" + r.model, not: c.not };
      } catch (e) { denemeler.push({ s: SIRA[i], hata: (e && (e.code || e.message)) || "hata" }); }
    }
    if (!sonuc) { var k = kuralPlani(h, t); sonuc = { ozet: k.ozet, plan: k.plan, kaynak: "kural", not: null }; }
    if (sonuc.not && sonuc.not.metin) { try { await B.notEkle({ metin: sonuc.not.metin, kaynak: sonuc.not.kaynak }); } catch (e) {} }
    sonuc.t = Date.now(); sonuc.denemeler = denemeler;
    try { localStorage.setItem(K, JSON.stringify(sonuc)); } catch (e) {}
    /* eski günlerin kayıtları birikmesin */
    try { for (var a = localStorage.length - 1; a >= 0; a--) { var key = localStorage.key(a); if (key && key.indexOf("dh-koc-gun-") === 0 && key !== K) localStorage.removeItem(key); } } catch (e) {}
    return sonuc;
  }

  global.DHKocDeniz = { gunluk: gunluk, dene: dene, dogrula: dogrula, kuralPlani: kuralPlani, EKRANLAR: EKRANLAR, ISTEK: ISTEK, SIRA: SIRA, _coz: cozJSON };
})(window);
