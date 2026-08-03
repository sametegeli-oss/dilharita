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

  var DIZIN   = "dh-modul-dizin";
  var ONEK    = "dh-modul-";
  /* Silinen modul kimlikleri -> silinme zamani. Bulut birlesiminin
     silineni geri diriltmesini engeller. Kimlikler "USR-..." biciminde
     uretildigi icin "dh-modul-silinen" bir kayit blogyla cakisamaz. */
  var SILINEN = "dh-modul-silinen";

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

    L.push("Sen CEFR uzmanı, İngilizce öğretmeni ve corpus linguistisin. Türkçe konuşan bir");
    L.push("öğrenci için GOLD STANDARD kalitede bir İngilizce çalışma modülü üreteceksin.");
    L.push("");
    L.push("Modül şunları desteklemeli: gerçek hayatta kullanılan İngilizce, Türk öğrencinin");
    L.push("yaptığı hataların düzeltilmesi, telaffuz sistemi, aralıklı tekrar (SRS) ve");
    L.push("senaryo tabanlı öğrenme.");
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

    L.push("════════ CEFR KELİME KURALI ════════");
    var cefr = {
      "A1": "Kelimelerin %95'i A1 olmalı. Zorunlu durumda az miktarda A2. B1 ve üstü YASAK.",
      "A2": "A1+A2 ağırlıklı. Az miktarda B1 olabilir. B2 ve üstü yasak.",
      "B1": "A1+A2+B1 ağırlıklı. Az miktarda B2 olabilir.",
      "B2": "B1+B2 ağırlıklı. Doğal, akıcı yapılar.",
      "C1": "Doğal ileri seviye İngilizce. Deyimsel kullanım serbest.",
      "C2": "Ana dili düzeyinde, nüanslı İngilizce."
    };
    L.push(seviye + ": " + (cefr[seviye] || cefr.B1));
    L.push("\"" + alan + "\" alanının teknik terimleri kullanılabilir — ama cümlenin KURULUŞU");
    L.push(seviye + " seviyesinde kalmalı. Terim zor olabilir, dil bilgisi olmamalı.");
    L.push("");

    L.push("════════ PEDAGOJİK KURALLAR ════════");
    L.push("Her cümle: tek hedef öğretmeli · tek ana yapı içermeli · doğal olmalı ·");
    L.push("konuşma diline uygun olmalı · gerçek hayatta kullanılabilir olmalı.");
    L.push("");
    L.push("YASAK: yapay ders kitabı dili · robotik cümleler · gereksiz uzunluk ·");
    L.push("aynı yapının anlamsız tekrarı · uydurma kelime · uydurma eşdizim.");
    L.push("");

    L.push("════════ TÜRK ÖĞRENCİ HATALARI ════════");
    L.push("commonMistake alanını doldururken Türkçe dil bilgisinden kaynaklanan gerçek");
    L.push("hataları hedefle. Türk öğrencinin sık yaptığı hatalar şunlardır:");
    L.push("  I am agree · I am understand · discuss about · married with · listen music");
    L.push("  depend to · good in · interested to · different than · explain me");
    L.push("  enter to · return back · make sport · open the TV · close the light");
    L.push("Bu modülün gramerine UYAN hataları seç; alakasız hata yazma.");
    L.push("Tipik hata kaynakları: eksik be fiili, eksik artikel, yanlış edat,");
    L.push("Türkçedeki karşılığın birebir çevrilmesi.");
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
    L.push("9. ZORLUK ARTMALI: 1. cümle en kolay, son cümle en zor olacak şekilde sırala.");
    L.push("   Basitten karmaşığa: önce çekirdek kalıp, sonra ek öğeler, sonra gerçek");
    L.push("   hayat kullanımı. order alanı bu sıralamayı yansıtmalı.");
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
    L.push("  ☐ Cümleler kolaydan zora doğru sıralanmış mı?");
    L.push("  ☐ " + seviye + " seviyesinin üstünde kelime kaçmış mı?");
    L.push("  ☐ commonMistake'ler gerçekten Türk öğrenci hatası mı (uydurma değil)?");
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
        /* Turkce harf iceren "ingilizce" cumle -> yanlis alan.
           AMA ozel isimler mesru: "She is İpek." dogru bir cumledir.
           Bu yuzden yalnizca KUCUK harfle baslayan kelimelerde Turkce
           harf ararız; bir ozel isim buyuk harfle baslar. */
        var kucukTr = String(k.en).split(/\s+/).some(function(kel){
          var temiz = kel.replace(/[.,!?;:]/g, "");
          if (!temiz) return false;
          var ilk = temiz.charAt(0);
          if (ilk === ilk.toLocaleUpperCase("tr") && ilk !== ilk.toLocaleLowerCase("tr")) return false;
          return /[çğıöşüÇĞİÖŞÜ]/.test(temiz);
        });
        if (kucukTr) uyarilar.push(n + "en alanında Türkçe harf var: " + k.en);
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

  /* TEKRAR AYIKLAMA
     Uretimde ayni cumle iki kez cikabiliyor. Bu bir engelleyici hatadir
     ama kullaniciyi Gemini'ye geri gondermek gereksiz: ilk gecen kalir,
     sonrakiler atilir, order ve id yeniden numaralanir.
     Doner: {kayitlar, atilan} */
  function tekrarlariAyikla(kayitlar) {
    var gorulen = {}, out = [], atilan = 0;
    (kayitlar || []).forEach(function (k) {
      var anahtar = String((k && k.en) || "").toLowerCase().replace(/[^a-z ]/g, "").trim();
      if (!anahtar || gorulen[anahtar]) { atilan++; return; }
      gorulen[anahtar] = 1;
      out.push(k);
    });
    /* id onekini koru, sirayi yeniden kur */
    out.forEach(function (k, i) {
      k.order = i + 1;
      var m = String(k.id || "").match(/^(.*-)(\d{3})$/);
      if (m) k.id = m[1] + ("00" + (i + 1)).slice(-3);
    });
    return { kayitlar: out, atilan: atilan };
  }

  /* Yalnizca tekrar hatasi mi var? (otomatik duzeltme teklif etmek icin) */
  function sadeceTekrarMi(hatalar) {
    return hatalar.length > 0 && hatalar.every(function (h) {
      return h.indexOf("tekrar ediyor") >= 0;
    });
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
     4) DEPO — IndexedDB (sentence-mode / kv)
     ============================================================
     NEDEN INDEXEDDB
     Moduller onceden localStorage'daydi. Iki sorunu vardi:
       1. KAPASITE. localStorage kaynak basina ~5MB ve bu sinir TUM
          uygulamayla paylasiliyor (ilerleme, koc plani, hata defteri...).
          Bir modul ~20KB; birkac dusuye modul sinira dayanir.
       2. SESSIZ KAYIP. Sinir asilinca setItem exception atar; eski
          yaz() bunu yutup false donuyordu, kullanici hicbir sey
          gormeden modulunu kaybedebilirdi.
     IndexedDB'de pratik sinir yuzlerce MB ve uygulama zaten bu
     veritabanini kullaniyor (ilerleme orada). Bulut senkronu da
     kv deposunu "smv:" onekiyle tasiyor, yani moduller senkronda kalir.

     OKUMA NEDEN HALA SENKRON
     liste()/getir()/cumleMap() cagiranlarin hepsi senkron. IndexedDB
     asenkron oldugu icin acilista tum "dh-modul-" anahtarlari BELLEGE
     okunur; okumalar bu aynadan yapilir, yazmalar hem aynayi hem
     IDB'yi gunceller. Cagiranin tek yapmasi gereken ilk okumadan once
     DHModul.hazir() sozunu beklemek.

     Anahtar isimleri localStorage donemiyle AYNI birakildi
     ("dh-modul-dizin", "dh-modul-<id>"); boylece bulut senkronundaki
     birlestirme kurallari ve tum cagiranlar aynen calisiyor.
  */
  var DB_AD = "sentence-mode", DEPO = "kv";

  var _ayna = null;      /* {anahtar: deger} — bellekteki kopya */
  var _hazir = null;     /* yukleme sozu */
  var _kuyruk = Promise.resolve();   /* yazmalar sirayla */

  function idbAc() {
    return new Promise(function (res) {
      try {
        if (typeof indexedDB === "undefined") return res(null);
        var r = indexedDB.open(DB_AD);
        r.onerror = function () { res(null); };
        r.onsuccess = function () {
          var db = r.result;
          if (db.objectStoreNames.contains(DEPO)) return res(db);
          /* Depo yoksa surum yukselterek olustur. Uygulama veritabanini
             acik tutuyorsa onblocked gelir; o durumda sessizce vazgecip
             null doneriz, cagiran bellek aynasiyla calismaya devam eder. */
          var v = db.version + 1;
          db.close();
          var r2 = indexedDB.open(DB_AD, v);
          r2.onupgradeneeded = function () {
            try { r2.result.createObjectStore(DEPO); } catch (e) {}
          };
          r2.onsuccess = function () { res(r2.result); };
          r2.onerror = function () { res(null); };
          r2.onblocked = function () { res(null); };
        };
      } catch (e) { res(null); }
    });
  }

  /* "dh-modul-" ile baslayan her anahtari okur */
  function idbHepsi() {
    return idbAc().then(function (db) {
      if (!db) return {};
      return new Promise(function (res) {
        var out = {};
        try {
          var st = db.transaction(DEPO, "readonly").objectStore(DEPO);
          var req = st.openCursor();
          req.onsuccess = function (e) {
            var c = e.target.result;
            if (c) {
              var k = String(c.key);
              if (k.indexOf(ONEK) === 0) out[k] = c.value;
              c.continue();
            } else { db.close(); res(out); }
          };
          req.onerror = function () { try { db.close(); } catch (_) {} res({}); };
        } catch (e) { try { db.close(); } catch (_) {} res({}); }
      });
    });
  }

  function idbYaz(k, v) {
    return idbAc().then(function (db) {
      if (!db) return false;
      return new Promise(function (res) {
        try {
          var tx = db.transaction(DEPO, "readwrite");
          if (v === null) tx.objectStore(DEPO)["delete"](k);
          else tx.objectStore(DEPO).put(v, k);
          tx.oncomplete = function () { db.close(); res(true); };
          tx.onerror = function () { try { db.close(); } catch (_) {} res(false); };
          tx.onabort = function () { try { db.close(); } catch (_) {} res(false); };
        } catch (e) { try { db.close(); } catch (_) {} res(false); }
      });
    });
  }

  /* Eski localStorage kayitlarini IDB'ye tasir, sonra temizler.
     Tasima BASARILI olmadan localStorage silinmez. */
  function lsGoc(ayna) {
    var tasinacak = [], i, k;
    try {
      for (i = 0; i < localStorage.length; i++) {
        k = localStorage.key(i);
        if (k && k.indexOf(ONEK) === 0) tasinacak.push(k);
      }
    } catch (e) { return Promise.resolve(0); }
    if (!tasinacak.length) return Promise.resolve(0);

    var isler = [];
    tasinacak.forEach(function (anahtar) {
      var deger;
      try { deger = JSON.parse(localStorage.getItem(anahtar)); } catch (e) { return; }
      if (deger == null) return;
      /* IDB'de zaten varsa oradaki daha guncel sayilir */
      if (ayna[anahtar] !== undefined) {
        try { localStorage.removeItem(anahtar); } catch (e) {}
        return;
      }
      ayna[anahtar] = deger;
      isler.push(idbYaz(anahtar, deger).then(function (ok) {
        if (ok) { try { localStorage.removeItem(anahtar); } catch (e) {} }
        return ok;
      }));
    });
    return Promise.all(isler).then(function (r) {
      var n = r.filter(Boolean).length;
      if (n) { try { console.log("[dh] " + n + " modül anahtarı IndexedDB'ye taşındı"); } catch (e) {} }
      return n;
    });
  }

  function hazir() {
    if (_hazir) return _hazir;
    _hazir = idbHepsi().then(function (m) {
      _ayna = m || {};
      return lsGoc(_ayna);
    }).then(function () {
      try { gocEt(); } catch (e) {}       /* ad onarimi */
      return true;
    }).catch(function () {
      _ayna = _ayna || {};
      return false;
    });
    return _hazir;
  }

  function oku(k, vars) {
    if (_ayna && _ayna[k] !== undefined) return _ayna[k];
    /* Ayna daha yuklenmediyse localStorage'a dus — goc sirasindaki
       ilk okumalar ve cok eski cihazlar icin guvenlik agi. */
    try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : vars; }
    catch (e) { return vars; }
  }
  function yaz(k, v) {
    if (!_ayna) _ayna = {};
    _ayna[k] = v;                                   /* okuma hemen dogru */
    _kuyruk = _kuyruk.then(function () { return idbYaz(k, v); });
    return true;
  }
  function silAnahtar(k) {
    if (_ayna) delete _ayna[k];
    _kuyruk = _kuyruk.then(function () { return idbYaz(k, null); });
  }
  /* Yazmalarin diske indigini beklemek isteyen cagiranlar icin */
  function yazmaBitti() { return _kuyruk; }

  function liste() { return oku(DIZIN, []) || []; }

  function getir(id) { return oku(ONEK + id, null); }

  /* Silinen modul kimlikleri -> silinme zamani */
  function mezarlar() { return oku(SILINEN, {}) || {}; }

  function kimlikUret(alan) {
    var kod = String(alan || "USR").toLocaleUpperCase("tr")
      .replace(/[^A-ZÇĞİÖŞÜ]/g, "").slice(0, 3) || "USR";
    kod = kod.replace(/Ç/g, "C").replace(/Ğ/g, "G").replace(/İ/g, "I")
             .replace(/Ö/g, "O").replace(/Ş/g, "S").replace(/Ü/g, "U");
    return "USR-" + kod + "-" + Date.now().toString(36).slice(-5).toUpperCase();
  }

  /* ============================================================
     MODUL ADI
     ============================================================
     Ad, KAYNAK MODULUN TAM ADIYLA baslar ve ilgi alaniyla biter:

       "B2-M05 Comparatives · P1"  +  "Finans ve muhasebe"
       -> "B2-M05 Comparatives · P1 · Finans ve muhasebe"

     Kaynak adi oldugu gibi korundugu icin seviye kodu ("B2-M05")
     adin basinda kalir. Koc, telafi motoru ve modul kisaltmasi
     seviyeyi hep adin basindan okuyor:
        dh-telafi.js   /^([ABC][12])\b|^([ABC][12])-/
        mod-autopen.js /^([ABC][12])/i
        kisaltma       "^[A-C][12]-M<sayi>" onekini atar
     Bu yuzden seviye tespiti icin ek bir kural gerekmiyor.
  */
  function adUret(kaynak, alan) {
    var k = String(kaynak || "").trim();
    var a = String(alan || "").trim();
    if (!k) return a || "Modül";

    /* ALAN EKI ZORUNLU — ad asla kaynagin AYNISI olamaz.
       Cunku index-app modulleri `module` alanina gore grupluyor.
       Ad kaynakla birebir ayni olsaydi uretilen cumleler RESMI modulun
       icine karisir, kullanici modulu ayri bir kart olarak ORTADAN
       KAYBOLURDU. Alan bos gelirse yerine "Özel" konur. */
    if (!a) a = "Özel";

    /* Ayni alan iki kez eklenmesin (yeniden adlandirma tekrar calisirsa) */
    if (k.toLocaleLowerCase("tr").indexOf(a.toLocaleLowerCase("tr")) === k.length - a.length &&
        k.length > a.length) return k;
    return k + " · " + a;
  }

  /* Eski kayitlari yeni ada tasir.
     Once kaynak modulun adi atiliyordu ("Comparatives · P1 · Finans"),
     dolayisiyla seviye kodu adin basinda yoktu ve koc modulun hangi
     seviyeye ait oldugunu ADdan cikaramiyordu.

     Kaynak adi biliniyorsa ad yeniden kurulur. Bilinmiyorsa (cok eski
     kayitlar) ada en azindan seviye kodu eklenir; M90 kullanilir cunku
     resmi moduller her seviyede en fazla M25'e cikiyor — cakisamaz.

     Sadece degisiklik varsa yazar; her acilista depo dovulmez. */
  function gocEt() {
    var d = liste(), degisti = false;
    for (var i = 0; i < d.length; i++) {
      var e = d[i], eski = String(e.ad || "");
      var yeni;
      if (e.kaynakModul) {
        yeni = adUret(e.kaynakModul, e.alan);
      } else if (!/^[A-C][12]\b|^[A-C][12]-/.test(eski) && e.level) {
        yeni = e.level + "-M90 " + eski;
      } else {
        continue;
      }
      if (!yeni || yeni === eski) continue;

      var kayitlar = getir(e.id);
      if (kayitlar && kayitlar.length) {
        for (var j = 0; j < kayitlar.length; j++) kayitlar[j].module = yeni;
        if (!yaz(ONEK + e.id, kayitlar)) continue;   /* depo doluysa adi da degistirme */
      }
      e.ad = yeni;
      degisti = true;
    }
    if (degisti) yaz(DIZIN, d);
    return degisti;
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
    silAnahtar(ONEK + id);
    yaz(DIZIN, liste().filter(function (x) { return x.id !== id; }));

    /* MEZAR TASI
       Bulut dizini artik EZMEK yerine BIRLESTIRIYOR (cloud-sync.js).
       Birlesim tek basina silmeyi geri alirdi: modul baska bir cihazin
       anlik goruntusunde durdugu icin ilk senkronda geri dogardi.
       Silinme zamani kaydedilir; birlesim `tarih`i bundan eski olan
       kaydi elemez, atar. */
    try {
      var t = oku(SILINEN, {}) || {};
      t[id] = Date.now();
      yaz(SILINEN, t);
    } catch (e) {}
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
    tekrarlariAyikla: tekrarlariAyikla,
    sadeceTekrarMi: sadeceTekrarMi,
    liste: liste,
    getir: getir,
    mezarlar: mezarlar,
    kaydet: kaydet,
    adUret: adUret,
    gocEt: gocEt,
    sil: sil,
    cumleMap: cumleMap,
    kimlikUret: kimlikUret,
    hazir: hazir,
    yazmaBitti: yazmaBitti,
    _ONEK: ONEK
  };

  /* Yukleme hemen baslar; cagiranlar DHModul.hazir() sozunu bekler.
     Ad onarimi (gocEt) yukleme bitince otomatik calisir. */
  hazir();
})(typeof window !== "undefined" ? window : globalThis);
