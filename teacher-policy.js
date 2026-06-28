/* teacher-policy.js
   Dil Harita — ÖĞRETMEN ANAYASASI (Teaching Constitution)

   Bu, AI'sız öğretmenin "beynidir". Bir prompt değil; deterministik
   pedagojik kuralların yapılandırılmış tanımıdır. Ders motoru
   (lesson-engine.js) bu kuralları öğrencinin verisiyle birleştirip
   somut ders planı üretir.

   - Kullanıcıya AÇIK: ayarlar sayfasında okunur/düzenlenir.
   - DÜZENLENEBİLİR: localStorage'da saklanır (dh-teacher-policy-v1).
   - VARSAYILANA DÖNÜŞ: resetToDefault() ile her an geri alınır.

   Her alanın yanında ne işe yaradığı yazılıdır; kullanıcı bunu
   bir "öğretmen talimatı" gibi okuyup ayarlar.
*/
(function(){
  "use strict";
  if(window.__dhPolicyInstalled) return;
  window.__dhPolicyInstalled = true;

  var LS_KEY = "dh-teacher-policy-v1";

  // ============================================================
  //  VARSAYILAN ANAYASA
  //  (Kullanıcı bunu düzenleyebilir; "Varsayılana dön" geri yükler)
  // ============================================================
  var DEFAULT_POLICY = {
    // -- Genel ilke (öğretmenin kendi sözleriyle amacı; sadece gösterim) --
    aciklama: "Sen sabırlı bir İngilizce öğretmenisin. Öğrenciye ne çalışacağına sen karar verirsin. Önce eksikleri ve unutulanları tamamlatır, sonra yeni konuya geçersin. Öğrenciyi yeni bilgiyle boğmaz, her derste eskiyi pekiştirirsin.",

    // -- Yapay zeka (AI) ayarları --
    // AI yalnızca açıklama/düzeltme/rol yapma gibi yüksek değerli işlerde kullanılır.
    // Bu bayrak kapalıysa veya AI ulaşılamazsa, uygulama tamamen kurallı modda çalışır.
    ai: {
      acik: true,            // AI özellikleri (kayan öğretmen, açıklama, roleplay) açık mı
      // not: anahtar yoksa veya limit dolduğunda DHAI.available() otomatik false döner
    },

    // -- Ders boyutu --
    dersUzunlugu: 12,        // bir derste toplam kaç öğe (adım) olsun
    gunlukYeniSiniri: 7,     // bir günde en fazla kaç YENİ öğe öğretilsin (bilişsel yük)

    // -- Öğrenci seviyesi --
    // "auto" → StudyTracker'dan/ilerlemeden otomatik; ya da "A1".."C1" sabitle
    seviye: "auto",
    seviyeUstuneIzin: 1,     // mevcut seviyenin kaç üstündeki içeriğe izin (0=sadece kendi seviyesi)

    // -- Tanı (seviye sınavı sonucu) --
    amac: "",                // "gunluk" | "seyahat" | "is" | "akademik" (seviye sınavından)
    seviyeTesti: null,       // { level, confidence, tarih, soruSayisi } — sınav yapılınca dolar

    // -- Gramer dersi bölümü --
    gramer: {
      acik: true,            // her derste gramer konusu anlatılsın mı
      konuSayisi: 1          // derste kaç gramer konusu işlensin
    },

    // -- Video ile öğren bölümü --
    video: {
      acik: true,            // derste video ile öğrenme adımı olsun mu
      adimSayisi: 1          // kaç video adımı
    },

    // -- Ders evrelerinin oranı (toplamı ~1.0 olmalı) --
    evreOranlari: {
      isinma: 0.15,          // bilinen öğelerle güven tazeleme
      tekrar: 0.40,          // zamanı gelmiş / yanlış yapılmış öğeler
      yeni:   0.35,          // yeni içerik
      pekistirme: 0.10       // dersin alıştırması / değerlendirme
    },

    // -- Telaffuz (konuşma) pratiği --
    telaffuz: {
      acik: true,            // derste telaffuz adımı olsun mu
      adimSayisi: 1,         // her derste kaç telaffuz adımı
      yontem: "ders-ici"     // "ders-ici" (TTS+mikrofon, hafif) | "videopractice" (tam ekran)
    },

    // -- Konu seçim önceliği (yukarıdan aşağıya) --
    // Öğretmen sıradaki içeriği bu sırayla arar.
    oncelikSirasi: [
      "geciken_tekrar",      // 1) zamanı geçmiş tekrarlar
      "zayif_konu",          // 2) hata defterinde sık hata yapılan konular
      "yarim_modul",         // 3) mevcut seviyede yarım kalmış modül
      "yeni_modul"           // 4) yeni modül / yeni içerik
    ],

    // -- İçerik kaynak ağırlıkları (yeni içerik hangi modülden gelsin) --
    // Toplam önemli değil; orantı olarak kullanılır.
    icerikAgirliklari: {
      sentence: 3,           // cümleler
      pv: 2,                 // phrasal verbs (frekansa göre öncelikli)
      word: 1                // kelimeler
    },

    // -- İlerleme / geçiş kuralları --
    konuTamamlanmaEsigi: 0.80,  // bir konunun %80'i öğrenilince "tamam" sayılır
    ogrenildiTekrarSayisi: 3,   // üst üste kaç doğru → "öğrenildi"

    // -- Uyarlanabilirlik (öğrenci performansına göre zorluk) --
    uyarla: true,               // performansa göre otomatik ayar açık mı
    basarisizlikEsigi: 0.50,    // ders başarısı bunun altındaysa zorluk düşür
    basariEsigi: 0.85,          // bunun üstündeyse hızlandır

    // -- Frekans önceliği (phrasal verb / kelime için) --
    frekansOnce: true,          // sık kullanılan öğeler önce öğretilsin

    // -- Günlük hedef (öğretmenin öğrenciye koyduğu hedef) --
    gunlukHedef: {
      ders: 1,                  // günde kaç ders tamamlansın
      dakika: 10                // günde kaç dakika çalışılsın (öneri)
    },

    // -- Ton / mesaj stili (öğretmenin öğrenciye seslenişi; gösterim) --
    mesajlar: {
      gunaydin: "Bugünkü dersine başlayalım. Hazırsan ilk konudan gidelim.",
      gramerGiris: "Önce bugünün gramer konusunu öğrenelim.",
      videoGiris: "Şimdi bunu video ile pekiştirelim.",
      tekrarGiris: "Önce geçen sefer takıldığın yerleri pekiştirelim.",
      yeniGiris: "Şimdi yeni bir şey öğrenelim.",
      tamamlandi: "Bugünkü dersi tamamladın, eline sağlık. Yarın devam edelim.",
      basarili: "Çok iyi gidiyorsun, bu konuyu kapatıyoruz.",
      zorlanma: "Burası biraz zor geldi, biraz daha tekrar edelim — acelesi yok."
    }
  };

  // ============================================================
  //  Okuma / yazma / sıfırlama
  // ============================================================
  function deepMerge(base, over){
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if(!over || typeof over!=="object") return out;
    for(var k in over){
      if(over[k] && typeof over[k]==="object" && !Array.isArray(over[k]) &&
         base[k] && typeof base[k]==="object" && !Array.isArray(base[k])){
        out[k] = deepMerge(base[k], over[k]);
      }else{
        out[k] = over[k];
      }
    }
    return out;
  }

  function load(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if(!raw) return deepMerge(DEFAULT_POLICY, {});
      var saved = JSON.parse(raw);
      // varsayılanla birleştir: yeni eklenen alanlar eksik kalmasın
      return deepMerge(DEFAULT_POLICY, saved);
    }catch(e){
      return deepMerge(DEFAULT_POLICY, {});
    }
  }

  function save(policy){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(policy));
      try{ window.dispatchEvent(new CustomEvent("dh-policy-changed",{detail:policy})); }catch(e){}
      return true;
    }catch(e){ return false; }
  }

  function resetToDefault(){
    try{ localStorage.removeItem(LS_KEY); }catch(e){}
    try{ window.dispatchEvent(new CustomEvent("dh-policy-changed",{detail:DEFAULT_POLICY})); }catch(e){}
    return deepMerge(DEFAULT_POLICY, {});
  }

  // JSON metni olarak ver/al (kullanıcı "prompt gibi" düzenlesin diye)
  function toText(){
    return JSON.stringify(load(), null, 2);
  }
  function fromText(text){
    var parsed = JSON.parse(text); // hata fırlatırsa çağıran yakalar
    // güvenlik: sadece bilinen alanları al, varsayılanla birleştir
    var merged = deepMerge(DEFAULT_POLICY, parsed);
    save(merged);
    return merged;
  }

  // tek bir alanı güncelle (ayar arayüzü için)
  function set(path, value){
    var p = load();
    var keys = path.split(".");
    var node = p;
    for(var i=0;i<keys.length-1;i++){
      if(typeof node[keys[i]]!=="object" || node[keys[i]]===null) node[keys[i]]={};
      node = node[keys[i]];
    }
    node[keys[keys.length-1]] = value;
    save(p);
    return p;
  }

  window.DHTeacherPolicy = {
    DEFAULT: DEFAULT_POLICY,
    load: load,
    save: save,
    set: set,
    reset: resetToDefault,
    toText: toText,
    fromText: fromText
  };
})();
