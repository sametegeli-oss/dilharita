/* dh-modul.js — Dil Harita kullanici modulleri
   ===============================================================
   NE YAPAR
   Kullanici, calistigi bir modulun gramerini KENDI ilgi alaninda
   (muhendislik, saglik, hukuk, mutfak...) calismak isteyebilir.
   Bu dosya:
     1. Gemini'ye yapistirilacak URETIM PROMPTUNU hazirlar
     2. Geminiden donen serbest metni AYRISTIRIR
     3. Kati bir DOGRULAMADAN gecirir
     4. Gecen modulu yerel depoya KAYDEDER

   API ANAHTARI KULLANILMAZ. Akis tamamen elle:
     prompt kopyala -> Gemini'ye yapistir -> cevabi kopyala -> uygulamaya yapistir

   HEDEF BICIM
   Uygulamanin gercek modul dosyasiyla BIREBIR ayni: 23 alanli
   kayitlardan olusan DUZ DIZI (data/sentences/mod/<slug>.json ile ayni).
   Boylece asagi akistaki hicbir ekran degismek zorunda kalmaz.

   DEPO
     dh-modul-dizin          -> [{id, ad, alan, level, kaynakModul, n, tarih}]
     dh-modul-<id>           -> [ {23 alanli kayit}, ... ]
   "dh-modul-" oneki cloud-sync.js'in LS_PREFIXES listesine eklendiginde
   modul tum cihazlara senkronlanir.
*/
(function (global) {
  "use strict";
  if (global.DHModul) return;

  var DIZIN = "dh-modul-dizin";
  var ONEK  = "dh-modul-";

  /* Gercek modul dosyasindaki 23 alan. Sira da ayni tutulur. */
  var ALANLAR = [
    "id", "module", "part", "stage", "order", "level", "topic", "scenario",
    "grammar", "highlights", "pattern", "en", "tr", "ipa", "trPron", "tense",
    "collocations", "synonyms", "antonyms", "commonMistake", "aiExplain",
    "grammarTags", "imgQuery"
  ];

  /* Bos birakilamayacak alanlar. pattern gercek veride de %96 bos,
     grammarTags bazen bos — ikisi zorunlu degil. */
  var ZORUNLU = [
    "id", "module", "part", "stage", "order", "level", "topic", "scenario",
    "grammar", "highlights", "en", "tr", "ipa", "trPron", "tense",
    "collocations", "synonyms", "antonyms", "commonMistake", "aiExplain",
    "imgQuery"
  ];

  var SEVIYELER = ["A1", "A2", "B1", "B2", "C1", "C2"];

  /* Hazir ilgi alanlari — kullanici serbest metin de yazabilir */
  var ALANLAR_HAZIR = [
    "İş hayatı", "Mühendislik", "Sağlık ve tıp", "Bilişim ve yazılım",
    "Hukuk", "Eğitim", "Mutfak ve yemek", "Spor", "Seyahat",
    "Tarım", "Finans ve muhasebe", "Sanat ve müzik", "Denizcilik", "Havacılık"
  ];

  /* ============================================================
     1) URETIM PROMPTU
     ============================================================
     Prompt KENDI KENDINE YETER: bos bir Gemini sohbetine yapistirilinca
     baska hicbir baglam gerektirmez. Bu yuzden hem sema hem ornek hem
     kalite kurallari hem de son kontrol listesi iceride.
  */
  function promptUret(s) {
    s = s || {};
    var alan     = String(s.alan || "İş hayatı").trim();
    var seviye   = String(s.seviye || "A1").toUpperCase();
    var kaynak   = String(s.kaynakModul || "").trim();
    var gramer   = String(s.grammar || "").trim();
    var tense    = String(s.tense || "Present Simple").trim();
    var adet     = Math.max(5, Math.min(30, parseInt(s.adet, 10) || 25));
    var modulAd  = String(s.modulAd || (kaynak.replace(/^[A-C][12]-M\d+\s*/, "") + " · " + alan)).trim();
    var kimlikOn = String(s.kimlikOnek || "USR-XXX").trim();
    var ornekler = Array.isArray(s.ornekler) ? s.ornekler.slice(0, 2) : [];

    var L = [];

    L.push("Sen bir İngilizce öğretim materyali üreticisisin. Türkçe konuşan bir öğrenci için");
    L.push("JSON biçiminde bir çalışma modülü hazırlayacaksın.");
    L.push("");
    L.push("════════ GÖREV ════════");
    L.push("Aşağıdaki gramer yapısını KORUYARAK, konu bağlamını \"" + alan + "\" alanına taşı.");
    L.push("");
    L.push("  Gramer yapısı : " + (gramer || "(kaynak modüldeki yapı)"));
    L.push("  Zaman         : " + tense);
    L.push("  CEFR seviyesi : " + seviye);
    L.push("  Kaynak modül  : " + (kaynak || "(serbest)"));
    L.push("  İlgi alanı    : " + alan);
    L.push("  Cümle sayısı  : tam olarak " + adet + " adet");
    L.push("");
    L.push("Yani gramer AYNI kalır, kelime dünyası değişir.");
    L.push("");

    if (ornekler.length) {
      L.push("════════ BİÇİM ÖRNEĞİ (kaynak modülden gerçek kayıtlar) ════════");
      L.push("Çıktın bu kayıtlarla BİREBİR aynı alanlara ve aynı yazım tarzına sahip olmalı:");
      L.push("");
      ornekler.forEach(function (o) {
        var temiz = {};
        ALANLAR.forEach(function (a) { temiz[a] = (o && o[a] != null) ? o[a] : ""; });
        L.push(JSON.stringify(temiz, null, 2));
      });
      L.push("");
    }

    L.push("════════ ALAN ALAN KURALLAR ════════");
    L.push('id            "' + kimlikOn + '-001" biçiminde, 001\'den ' + ("00" + adet).slice(-3) + "'e kadar sırayla.");
    L.push('module        her kayıtta AYNI: "' + modulAd + '"');
    L.push('part          her kayıtta AYNI: "P1 Foundation"');
    L.push('stage         her kayıtta AYNI: "Foundation"');
    L.push("order         1'den " + adet + "'e kadar tam sayı (tırnaksız).");
    L.push('level         her kayıtta AYNI: "' + seviye + '"');
    L.push("topic         2-3 kelimelik İngilizce konu etiketi. " + alan + " alanından.");
    L.push("scenario      cümlenin geçtiği somut durum, İngilizce, kısa.");
    L.push("grammar       yapının formülü, İngilizce. Örn: \"Subject + be verb + article + noun\".");
    L.push("highlights    TÜRKÇE tek cümle: öğrencinin bu cümlede DİKKAT ETMESİ gereken nokta.");
    L.push('pattern       boş bırak: ""');
    L.push("en            İngilizce cümle. Nokta ile biter. " + seviye + " seviyesine uygun.");
    L.push("tr            DOĞAL Türkçe çeviri. Kelime kelime çeviri YAPMA.");
    L.push("ipa           IPA yazımı, eğik çizgiler arasında. Örn: /aɪ æm ə tiːtʃər/");
    L.push("trPron        Türkçe okunuş. Türk alfabesiyle, IPA DEĞİL. Örn: \"Ay em ı tiçır\"");
    L.push('tense         "' + tense + '"');
    L.push("collocations  bu cümledeki 2-3 doğal eşdizim, İngilizce, virgülle.");
    L.push("synonyms      anahtar kelimenin 1-3 eşanlamlısı, İngilizce, virgülle.");
    L.push('antonyms      1-3 zıt anlamlı, İngilizce, virgülle. Yoksa "none" yaz.');
    L.push("commonMistake TÜRK öğrencinin bu cümlede yaptığı TİPİK hata + \" ❌\" ile biter.");
    L.push("              Örn: \"I am software developer. ❌\"");
    L.push("aiExplain     TÜRKÇE 1-2 cümle açıklama: neden öyle, hata neden hata.");
    L.push("grammarTags   2-4 İngilizce etiket, virgülle. Örn: \"be, article, profession\"");
    L.push("imgQuery      2-4 İngilizce kelime, FOTOĞRAFLANABİLİR somut sahne.");
    L.push("              İyi: \"person coding on computer\" · Kötü: \"knowledge\", \"being\"");
    L.push("");

    L.push("════════ KALİTE ŞARTLARI (uyulması zorunlu) ════════");
    L.push("1. Her cümle belirtilen gramer yapısını kullanmalı. Yapıyı değiştiren cümle YAZMA.");
    L.push("2. Kelime seviyesi " + seviye + " sınırında kalmalı. " + alan + " alanının teknik terimleri");
    L.push("   kullanılabilir ama cümle KURULUŞU " + seviye + " olmalı.");
    L.push("3. Hiçbir İngilizce cümle tekrar etmemeli — " + adet + " cümlenin hepsi farklı olmalı.");
    L.push("4. Türkçe çeviriler akıcı Türkçe olmalı; devrik ya da makine çevirisi tadında olmamalı.");
    L.push("5. commonMistake gerçekten Türk öğrencinin yaptığı hata olmalı (Türkçe dil bilgisinden");
    L.push("   kaynaklanan): eksik artikel, yanlış edat, olmayan yardımcı fiil gibi.");
    L.push("6. imgQuery soyut kavram OLMAMALI; bir fotoğraf arama motorunda sonuç verecek somut sahne.");
    L.push("7. Uydurma kelime, uydurma deyim, var olmayan eşdizim YAZMA.");
    L.push("8. Cümleler birbirini takip eden bir bağlam oluşturmalı, rastgele dağılmamalı.");
    L.push("");

    L.push("════════ GÖNDERMEDEN ÖNCE KENDİ KENDİNİ DENETLE ════════");
    L.push("Çıktıyı yazdıktan sonra şu listeyi tek tek kontrol et; sorun varsa DÜZELT ve öyle gönder:");
    L.push("  ☐ Tam olarak " + adet + " kayıt var mı?");
    L.push("  ☐ Her kayıtta 23 alanın hepsi var mı? (eksik alan bırakma)");
    L.push("  ☐ id'ler " + kimlikOn + "-001 … " + kimlikOn + "-" + ("00" + adet).slice(-3) + " sırasında mı?");
    L.push("  ☐ order alanları 1…" + adet + " ve TIRNAKSIZ sayı mı?");
    L.push("  ☐ module / part / stage / level tüm kayıtlarda aynı mı?");
    L.push("  ☐ Aynı 'en' cümlesi iki kez geçiyor mu? (geçmemeli)");
    L.push("  ☐ Her cümle gerçekten \"" + (gramer || tense) + "\" yapısını kullanıyor mu?");
    L.push("  ☐ Her ipa / ile başlayıp / ile bitiyor mu?");
    L.push("  ☐ Her trPron Türk harfleriyle mi yazılmış (IPA sembolü içermiyor)?");
    L.push("  ☐ Her commonMistake ❌ ile mi bitiyor?");
    L.push("  ☐ Her aiExplain ve highlights TÜRKÇE mi?");
    L.push("  ☐ JSON geçerli mi? (tek tırnak yok, sondaki virgül yok, kaçış karakterleri doğru)");
    L.push("");

    L.push("════════ ÇIKTI BİÇİMİ ════════");
    L.push("SADECE JSON dizisi döndür. Açıklama, başlık, giriş cümlesi, sonuç cümlesi YAZMA.");
    L.push("Kod bloğu işareti kullanabilirsin ama içinde yalnızca JSON olsun.");
    L.push("Dizi köşeli parantezle başlayıp köşeli parantezle bitmeli.");

    return L.join("\n");
  }

  /* ============================================================
     2) AYRISTIRMA — Gemini'nin serbest metnini JSON'a cevirir
     ============================================================
     Web arayuzu genelde ```json ... ``` sarar, bazen once/sonra
     aciklama yazar. Ikisini de tolere ederiz.
  */
  function ayristir(metin) {
    var ham = String(metin || "").trim();
    if (!ham) return { ok: false, hata: "Boş metin yapıştırıldı." };

    /* kod bloklarini soy */
    var blok = ham.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (blok) ham = blok[1].trim();

    /* once/sonra aciklama varsa ilk [ ile son ] arasini al */
    if (ham[0] !== "[") {
      var b = ham.indexOf("[");
      var e = ham.lastIndexOf("]");
      if (b >= 0 && e > b) ham = ham.slice(b, e + 1);
    }

    var veri;
    try {
      veri = JSON.parse(ham);
    } catch (err) {
      return { ok: false, hata: "JSON okunamadı: " + (err && err.message || "biçim hatası") };
    }

    /* Bazen {modul:..., cumleler:[...]} gibi sarmalanmis gelir */
    if (!Array.isArray(veri) && veri && typeof veri === "object") {
      var aday = veri.cumleler || veri.sentences || veri.items || veri.data;
      if (Array.isArray(aday)) veri = aday;
    }
    if (!Array.isArray(veri)) return { ok: false, hata: "Beklenen biçim bir JSON dizisiydi." };

    return { ok: true, kayitlar: veri };
  }

  /* ============================================================
     3) DOGRULAMA
     ============================================================
     Ikinci bir yapay zeka gecisi olmadigi icin denetim BURADA yapilir.
     hatalar  -> kaydetmeyi engeller
     uyarilar -> kaydetmeyi engellemez, kullaniciya gosterilir
  */
  function dogrula(kayitlar, beklenen) {
    beklenen = beklenen || {};
    var hatalar = [], uyarilar = [];
    var gorulenEn = {}, gorulenId = {};

    if (!kayitlar.length) {
      return { hatalar: ["Hiç kayıt yok."], uyarilar: [] };
    }
    if (beklenen.adet && kayitlar.length !== beklenen.adet) {
      uyarilar.push(beklenen.adet + " cümle istenmişti, " + kayitlar.length + " geldi.");
    }

    kayitlar.forEach(function (k, i) {
      var n = "#" + (i + 1) + " ";
      if (!k || typeof k !== "object") { hatalar.push(n + "kayıt nesne değil."); return; }

      ZORUNLU.forEach(function (a) {
        var v = k[a];
        if (v === undefined || v === null || String(v).trim() === "") {
          hatalar.push(n + '"' + a + '" alanı boş.');
        }
      });

      if (k.en) {
        var enAnahtar = String(k.en).toLowerCase().replace(/[^a-z ]/g, "").trim();
        if (gorulenEn[enAnahtar]) hatalar.push(n + "cümle tekrar ediyor: " + k.en);
        gorulenEn[enAnahtar] = 1;
        /* Turkce harf iceren "ingilizce" cumle -> yanlis alan */
        if (/[çğıöşüÇĞİÖŞÜ]/.test(k.en)) uyarilar.push(n + "en alanında Türkçe harf var: " + k.en);
      }
      if (k.id) {
        if (gorulenId[k.id]) hatalar.push(n + "id tekrar ediyor: " + k.id);
        gorulenId[k.id] = 1;
      }
      if (k.order !== undefined && typeof k.order !== "number") {
        uyarilar.push(n + "order sayı değil (\"" + k.order + "\").");
      }
      if (k.ipa && !/^\/.*\/$/.test(String(k.ipa).trim())) {
        uyarilar.push(n + "ipa eğik çizgi arasında değil.");
      }
      if (k.trPron && /[əɪʊʌɜɒæθðŋʃʒː]/.test(String(k.trPron))) {
        uyarilar.push(n + "trPron IPA sembolü içeriyor, Türkçe okunuş olmalı.");
      }
      if (k.commonMistake && String(k.commonMistake).indexOf("❌") < 0) {
        uyarilar.push(n + "commonMistake ❌ ile bitmiyor.");
      }
      if (k.imgQuery && String(k.imgQuery).trim().split(/\s+/).length > 6) {
        uyarilar.push(n + "imgQuery çok uzun.");
      }
      if (beklenen.seviye && k.level && String(k.level).toUpperCase() !== beklenen.seviye) {
        uyarilar.push(n + "level beklenenden farklı (" + k.level + ").");
      }
    });

    /* modul/part/stage tutarliligi */
    ["module", "part", "stage", "level"].forEach(function (a) {
      var kume = {};
      kayitlar.forEach(function (k) { if (k && k[a]) kume[k[a]] = 1; });
      if (Object.keys(kume).length > 1) {
        uyarilar.push('"' + a + '" alanı kayıtlar arasında farklılık gösteriyor.');
      }
    });

    return { hatalar: hatalar, uyarilar: uyarilar };
  }

  /* Eksik alanlari tamamlar, order'i sayiya cevirir, alan sirasini duzenler. */
  function normalize(kayitlar, meta) {
    meta = meta || {};
    return kayitlar.map(function (k, i) {
      var o = {};
      ALANLAR.forEach(function (a) { o[a] = (k && k[a] != null) ? k[a] : ""; });
      o.order = parseInt(o.order, 10) || (i + 1);
      if (meta.modulAd) o.module = meta.modulAd;
      if (meta.seviye) o.level = meta.seviye;
      if (!o.part) o.part = "P1 Foundation";
      if (!o.stage) o.stage = "Foundation";
      o.uretilmis = true;                      /* ekranlarda rozet icin */
      return o;
    });
  }

  /* ============================================================
     4) DEPO
     ============================================================ */
  function oku(k, vars) {
    try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : vars; }
    catch (e) { return vars; }
  }
  function yaz(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }

  function liste() { return oku(DIZIN, []) || []; }

  function getir(id) { return oku(ONEK + id, null); }

  function kimlikUret(alan) {
    var kod = String(alan || "USR").toLocaleUpperCase("tr")
      .replace(/[^A-ZÇĞİÖŞÜ]/g, "").slice(0, 3) || "USR";
    kod = kod.replace(/Ç/g, "C").replace(/Ğ/g, "G").replace(/İ/g, "I")
             .replace(/Ö/g, "O").replace(/Ş/g, "S").replace(/Ü/g, "U");
    return "USR-" + kod + "-" + Date.now().toString(36).slice(-5).toUpperCase();
  }

  function kaydet(kayitlar, meta) {
    meta = meta || {};
    var id = meta.id || kimlikUret(meta.alan);
    var temiz = normalize(kayitlar, meta);

    if (!yaz(ONEK + id, temiz)) {
      return { ok: false, hata: "Depo dolu — kaydedilemedi." };
    }
    var d = liste().filter(function (x) { return x.id !== id; });
    d.unshift({
      id: id,
      ad: meta.modulAd || "Modül",
      alan: meta.alan || "",
      level: meta.seviye || (temiz[0] && temiz[0].level) || "",
      kaynakModul: meta.kaynakModul || "",
      n: temiz.length,
      tarih: Date.now()
    });
    yaz(DIZIN, d);
    return { ok: true, id: id, n: temiz.length };
  }

  function sil(id) {
    try { localStorage.removeItem(ONEK + id); } catch (e) {}
    yaz(DIZIN, liste().filter(function (x) { return x.id !== id; }));
  }

  /* Tum kullanici cumleleri: id -> kayit.
     sentences-loader.js bunu DHSent.byIds sonucuna karistirir; boylece
     tekrar.html uretilen cumlelerin metnini de cozebilir. */
  function cumleMap() {
    var m = {};
    liste().forEach(function (x) {
      (getir(x.id) || []).forEach(function (k) { if (k && k.id) m[k.id] = k; });
    });
    return m;
  }

  global.DHModul = {
    ALANLAR: ALANLAR,
    ZORUNLU: ZORUNLU,
    SEVIYELER: SEVIYELER,
    ALANLAR_HAZIR: ALANLAR_HAZIR,
    promptUret: promptUret,
    ayristir: ayristir,
    dogrula: dogrula,
    normalize: normalize,
    liste: liste,
    getir: getir,
    kaydet: kaydet,
    sil: sil,
    cumleMap: cumleMap,
    kimlikUret: kimlikUret,
    _ONEK: ONEK
  };
})(typeof window !== "undefined" ? window : globalThis);
