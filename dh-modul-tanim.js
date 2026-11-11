/* dh-modul-tanim.js — modül ve seviye adlarının sade Türkçe karşılığı
   ====================================================================
   Modül adları veride İngilizce ("A2-M01 Past Simple · P1"). Koçun
   kullanıcıya "ne çalışacağız" diye anlatabilmesi için her modül
   türünün Türkçe adı ve bir cümlelik açıklaması burada.

   API
     DHModulTanim.seviye("A2")          -> {kod, ad, aciklama}
     DHModulTanim.SEVIYELER             -> ["A1",...]
     DHModulTanim.modul("A2-M01 Past Simple · P1")
                                        -> {ad, aciklama, bolum, ingilizce, gramer}
                                           gramer=false: durum/tema modülü (Havalimanı…)
*/
(function (global) {
  "use strict";
  if (global.DHModulTanim) return;

  var SEVIYE = {
    A1: { ad: "Başlangıç", aciklama: "En temel kalıplar. Kendinizi, ailenizi ve çevrenizi kısa cümlelerle anlatırsınız." },
    A2: { ad: "Temel", aciklama: "Günlük işler, alışveriş, yol, geçmişte olanlar. Basit ama tam cümleler." },
    B1: { ad: "Orta", aciklama: "Deneyim anlatma, fikir bildirme, plan yapma. Biraz daha uzun cümleler." },
    B2: { ad: "Orta üstü", aciklama: "Ayrıntılı ve akıcı anlatım, tartışma, ince anlam farkları." },
    C1: { ad: "İleri", aciklama: "Karmaşık yapılar, resmî dil, deyimler. Ana dili gibi rahat kullanım." },
    C2: { ad: "Ustalık", aciklama: "Ana dili düzeyinde, her konuda rahat ve ince anlatım." }
  };

  /* İngilizce modül adı (seviye kodu ve bölüm olmadan) -> [Türkçe ad, açıklama] */
  var T = {
    "Be Verb": ["“Olmak” fiili (am / is / are)", "Kim olduğunuzu, nerede ve nasıl olduğunuzu söylemek: “I am tired.”"],
    "Be Verb Negative": ["“Olmak” fiilinin olumsuzu (am not / isn't / aren't)", "Bir şeyin öyle olmadığını söylemek: “I am not hungry.”"],
    "Be Verb Questions": ["“Olmak” fiiliyle soru (Am I…? / Is it…?)", "Evet-hayır soruları sormak: “Is the shop open?”"],
    "Have / Has": ["Sahip olmak (have / has)", "Neyiniz olduğunu söylemek: “I have two grandchildren.”"],
    "Possessives": ["İyelik (my, your, his…)", "Bir şeyin kime ait olduğunu söylemek: “This is my bag.”"],
    "Articles": ["a / an / the", "İsimlerin önüne hangi küçük kelimenin geleceği: “a book”, “the park”."],
    "Demonstratives": ["Bu / şu (this, that, these, those)", "Yakındaki ve uzaktaki şeyleri göstermek: “This is my house.”"],
    "There Is / There Are": ["Var / yok (there is / there are)", "Bir yerde ne olduğunu söylemek: “There is a pharmacy near here.”"],
    "Family": ["Aile", "Aile üyelerini tanıtmak ve onlardan söz etmek."],
    "Food & Drinks": ["Yiyecek ve içecekler", "Ne yediğinizi, ne istediğinizi söylemek."],
    "Shopping": ["Alışveriş", "Fiyat sormak, bir şey istemek, ödeme yapmak."],
    "Weather": ["Hava durumu", "Havanın nasıl olduğunu söylemek ve sormak."],
    "Directions": ["Yol tarifi", "Bir yerin nerede olduğunu sormak ve anlamak."],
    "Past Simple": ["Geçmiş zaman (-di)", "Geçmişte olup biten işleri anlatmak: “I visited my son yesterday.”"],
    "Pres. Cont.": ["Şimdiki zaman (-yor)", "Şu an olan işleri anlatmak: “I am cooking now.”"],
    "Some / Any": ["Biraz / hiç (some / any)", "Miktarı belli olmayan şeylerden söz etmek: “Do you have any milk?”"],
    "Much / Many": ["Çok (much / many)", "Sayılan ve sayılmayan şeylerde “çok” demek: “many friends”, “much time”."],
    "How Much / How Many": ["Ne kadar / kaç tane", "Fiyat ve miktar sormak: “How much is it?”"],
    "Present Continuous Future": ["Yakın gelecek planları (-yor)", "Kesinleşmiş planları anlatmak: “I am seeing the doctor tomorrow.”"],
    "Modal Can": ["Yapabilmek (can)", "Yapabildiğiniz şeyleri söylemek ve izin istemek: “Can I sit here?”"],
    "Modal Could": ["Kibar rica ve geçmişte yapabilme (could)", "Kibarca bir şey istemek: “Could you help me?”"],
    "Requests & Offers": ["Rica ve teklif", "Bir şey istemek ve yardım önermek: “Would you like some tea?”"],
    "Travel": ["Seyahat", "Yolculukta gereken günlük kalıplar."],
    "Hotel": ["Otel", "Oda ayırtmak, giriş yapmak, bir şey istemek."],
    "Airport": ["Havalimanı", "Bilet, bagaj, uçuş kapısı ile ilgili kalıplar."],
    "Restaurant": ["Restoran", "Yemek ısmarlamak, hesap istemek."],
    "Doctor": ["Doktor", "Şikâyetinizi anlatmak, ilaç ve randevu konuşmak."],
    "Telephone English": ["Telefonda İngilizce", "Telefonla aramak, mesaj bırakmak, birini istemek."],
    "Work Basics": ["İş hayatının temelleri", "Mesleğinizi ve günlük işinizi anlatmak."],
    "Hobbies": ["Hobiler", "Sevdiğiniz uğraşları anlatmak."],
    "Daily Problems": ["Günlük sorunlar", "Bir sorunu anlatmak ve yardım istemek."],
    "Common Turkish Learner Errors": ["Türklerin sık yaptığı hatalar", "Türkçeden kelime kelime çevirince yapılan hataların doğrusu."],
    "Present Perfect": ["Yakın geçmiş (have + V3)", "Geçmişte olup etkisi süren işler: “I have lost my keys.”"],
    "Present Perfect vs Past Simple": ["Yakın geçmiş mi, geçmiş zaman mı?", "“I have seen” ile “I saw” arasındaki fark."],
    "For / Since": ["-dır / -den beri (for / since)", "Bir şeyin ne zamandır sürdüğünü söylemek: “since 2010”."],
    "Yet / Already / Just": ["Henüz / zaten / az önce", "“I have just eaten.” gibi zaman ayrıntıları."],
    "First Conditional": ["Gerçek koşul (if + geniş zaman)", "Olası bir durumun sonucunu söylemek: “If it rains, I will stay home.”"],
    "Second Conditional": ["Hayalî koşul (if + geçmiş)", "Gerçek olmayan durumlar: “If I were rich, I would travel.”"],
    "Passive Voice Basics": ["Edilgen yapı (yapıldı, yazıldı)", "İşi yapanı değil, işin kendisini öne çıkarmak: “The house was built in 1990.”"],
    "Relative Clauses": ["Bağlayan cümleler (who / which / that)", "Bir kişi ya da şeyi tarif etmek: “the woman who lives next door”."],
    "Passive Voice Advanced": ["Edilgen yapı (ileri)", "Farklı zamanlarda edilgen yapı."],
    "Reporting Verbs": ["Aktarma fiilleri (said, told, asked)", "Birinin söylediğini aktarmak."],
    "Quantifiers": ["Miktar sözcükleri", "“a few”, “a little”, “a lot of” gibi miktar bildiren kelimeler."],
    "Modal Verbs": ["Kip fiilleri (must, should, might)", "Zorunluluk, tavsiye ve olasılık bildirmek."],
    "Used to / Would": ["Eskiden yapardım (used to)", "Geçmişteki alışkanlıklar: “I used to walk every morning.”"],
    "Conditionals": ["Koşul cümleleri (if…)", "“Eğer … olursa” kalıpları."],
    "Meetings": ["Toplantı dili", "Toplantıda fikir bildirmek ve söz almak."],
    "Reported Speech": ["Dolaylı anlatım", "Birinin sözünü kendi cümlenizle aktarmak: “She said she was tired.”"],
    "Deduction": ["Çıkarım (must be / can't be)", "İpuçlarından sonuç çıkarmak: “He must be at home.”"],
    "Modals": ["Kip fiilleri", "can, must, should, might gibi fiillerin kullanımı."],
    "Adj vs Adv": ["Sıfat mı, zarf mı? (quick / quickly)", "Nasıl olduğunu ve nasıl yapıldığını ayırmak."],
    "Prepositions": ["Edatlar (in, on, at…)", "Yer ve zaman bildiren küçük kelimeler."],
    "Too/Enough": ["Fazla / yeterince (too / enough)", "“too hot”, “warm enough” gibi kalıplar."],
    "Past Cont.": ["Geçmişte süren olay (-yordu)", "Geçmişte bir an süren işler: “I was cooking when you called.”"],
    "Review": ["Tekrar", "Önceki konuların karışık tekrarı."],
    "Present Perfect Continuous": ["-dır …yor (have been -ing)", "Geçmişte başlayıp hâlâ süren işler: “I have been waiting for an hour.”"],
    "Past Perfect": ["Miş’li geçmiş (had + V3)", "Geçmişteki bir olaydan daha önce olanlar: “The bus had left.”"],
    "Future Perfect": ["Gelecekte tamamlanmış olacak (will have + V3)", "Belli bir zamana kadar bitmiş olacak işler."],
    "Passive": ["Edilgen yapı", "İşin kendisini öne çıkarmak."],
    "Future": ["Gelecek zaman (will / going to)", "Planları ve tahminleri anlatmak."],
    "Comparatives": ["Karşılaştırma (-den daha)", "İki şeyi karşılaştırmak: “bigger than”, “more expensive than”."],
    "Superlatives": ["En üstünlük (en …)", "“the biggest”, “the most beautiful” gibi kalıplar."],
    "Count/Uncount": ["Sayılan ve sayılmayan isimler", "“an apple” ama “some water” farkı."],
    "Some/Any": ["Biraz / hiç (some / any)", "Miktarı belli olmayan şeylerden söz etmek."],
    "Much/Many": ["Çok (much / many)", "Sayılan ve sayılmayan şeylerde “çok” demek."],
    "Passive Advanced": ["Edilgen yapı (ileri)", "Farklı zaman ve kiplerde edilgen yapı."],
    "Relative Clauses Advanced": ["Bağlayan cümleler (ileri)", "whose, whom, where gibi bağlaçlarla tarif."],
    "Conditionals Advanced": ["Koşul cümleleri (ileri)", "Karışık ve geçmişe dönük koşullar."],
    "Noun Clauses Advanced": ["İsim cümlecikleri", "“what you said”, “that it is true” gibi yapılar."],
    "Inversion Advanced": ["Devrik yapı", "Vurgu için sözcük sırasını değiştirmek."],
    "Advanced Modals": ["Kip fiilleri (ileri)", "“should have”, “must have” gibi geçmişe dönük kipler."],
    "Advanced Verbal Structures": ["İleri fiil yapıları", "Fiil + -ing / to fiil kalıpları."],
    "Decision": ["Karar verme", "Karar ve seçimlerle ilgili kalıplar."],
    "Responsibility": ["Sorumluluk", "Görev ve sorumluluk anlatan kalıplar."],
    "Economy": ["Ekonomi", "Para, fiyat ve ekonomi ile ilgili cümleler."],
    "Achievement": ["Başarı", "Başarı ve hedeflerden söz etmek."],
    "Habits": ["Alışkanlıklar", "Düzenli yaptığınız şeyleri anlatmak."],
    "Social": ["Sosyal hayat", "Arkadaşlık, davet, buluşma kalıpları."],
    "Work": ["İş", "İş hayatı ile ilgili cümleler."],
    "Business": ["İş dünyası", "Ticaret ve iş görüşmesi dili."],
    "Communication": ["İletişim", "Anlaşmak, anlatmak, anlamak üzerine kalıplar."],
    "Personal": ["Kişisel konular", "Kendinizden ve duygularınızdan söz etmek."],
    "Health": ["Sağlık", "Sağlık ve iyi yaşam ile ilgili cümleler."],
    "Life": ["Hayat", "Hayat olayları ve deneyimler."],
    "Problem": ["Sorunlar", "Bir sorunu anlatmak ve çözüm aramak."],
    "Attention": ["Dikkat", "Dikkat çekmek ve uyarmak."],
    "Chance": ["Şans ve olasılık", "Olasılık ve fırsatlardan söz etmek."],
    "Friendship": ["Arkadaşlık", "Arkadaşlarla ilgili cümleler."],
    "General": ["Genel", "Karışık, günlük cümleler."],
    "Tech": ["Teknoloji", "Telefon, internet ve cihazlarla ilgili cümleler."],
    "Nature": ["Doğa", "Doğa, hayvanlar ve çevre."],
    "Daily": ["Gündelik hayat", "Günlük işler ve rutinler."],
    "Education": ["Eğitim", "Okul ve öğrenme ile ilgili cümleler."],
    "Academic": ["Akademik dil", "Resmî ve bilimsel anlatım."],
    "Meeting": ["Toplantı", "Toplantı dili."],
    "Email": ["E-posta", "E-posta yazma kalıpları."],
    "Telephone": ["Telefon", "Telefon konuşması kalıpları."],
    "Problems": ["Sorunlar", "Sorun anlatma kalıpları."],
    "Errors": ["Sık yapılan hatalar", "Yaygın hataların doğrusu."],
    "Advanced Conditionals": ["Koşul cümleleri (ileri)", "Karışık ve resmî koşul yapıları."],
    "Inversion": ["Devrik yapı", "Vurgu için sözcük sırasını değiştirmek."],
    "Cleft Sentences": ["Vurgulu cümleler (It is … that)", "Bir bilgiyi öne çıkarmak: “It was my wife who called.”"],
    "Advanced Passive": ["Edilgen yapı (ileri)", "Resmî dilde edilgen kalıplar."],
    "Advanced Reporting Verbs": ["Aktarma fiilleri (ileri)", "suggest, insist, deny gibi fiillerle aktarma."],
    "Hedging Language": ["Yumuşatarak konuşma", "Kesin konuşmadan fikir bildirmek: “It seems that…”"],
    "Discourse Markers": ["Bağlayıcı sözcükler", "however, moreover gibi geçiş sözcükleri."],
    "Nominalisation": ["İsimleştirme", "Fiilden isim yaparak resmî anlatım."],
    "Advanced Collocations": ["Doğal kelime ikilileri", "Birlikte kullanılan kelimeler: “make a decision”."],
    "Idioms": ["Deyimler", "Sık kullanılan İngilizce deyimler."],
    "Advanced Phrasal Verbs": ["Öbek fiiller (ileri)", "“put up with” gibi fiil + edat kalıpları."],
    "Academic Writing": ["Akademik yazı", "Resmî yazı dili."],
    "Critical Thinking": ["Eleştirel düşünme", "Görüş tartmak ve değerlendirmek."],
    "Argumentation": ["Görüş savunma", "Bir fikri gerekçeleriyle savunmak."],
    "Debate Skills": ["Tartışma", "Karşı görüşe cevap vermek."],
    "Leadership": ["Liderlik", "Yönetim ve liderlik dili."],
    "Strategy": ["Strateji", "Plan ve strateji dili."],
    "Innovation": ["Yenilik", "Yenilik ve değişim dili."],
    "Cohesion": ["Akıcı bağlantı", "Cümleleri birbirine bağlamak."],
    "Participle": ["Ortaç yapıları (-en, -ip)", "“Feeling tired, I went to bed.” gibi kısaltılmış yapılar."],
    "Cleft": ["Vurgulu cümleler", "Bir bilgiyi öne çıkarmak."],
    "Ellipsis": ["Kısaltma (eksiltili anlatım)", "Tekrar etmeden kısa cevap vermek: “So do I.”"],
    "Kendi cümlelerim": ["Kendi cümlelerim", "“Nasıl derim?” ile sorup derslerinize eklediğiniz cümleler."]
  };

  /* DURUM / TEMA modülleri: belli bir dil bilgisi öğretmez, bir sahnenin
     (havalimanı, otel, aile…) kalıplarını toplar. "Bana özel ders"te
     dil bilgisi kaynağı olarak kullanılmaz; konu zaten kullanıcının amacıdır. */
  var DURUM = ["Family", "Food & Drinks", "Shopping", "Weather", "Directions", "Travel", "Hotel", "Airport",
    "Restaurant", "Doctor", "Telephone English", "Work Basics", "Hobbies", "Daily Problems",
    "Common Turkish Learner Errors", "Meetings", "Review", "Decision", "Responsibility", "Economy",
    "Achievement", "Habits", "Social", "Work", "Business", "Communication", "Personal", "Health", "Life",
    "Problem", "Attention", "Chance", "Friendship", "General", "Tech", "Nature", "Daily", "Education",
    "Academic", "Meeting", "Email", "Telephone", "Problems", "Errors", "Academic Writing",
    "Critical Thinking", "Argumentation", "Debate Skills", "Leadership", "Strategy", "Innovation"];

  function cozumle(mod) {
    var s = String(mod || "");
    var seviye = (s.match(/^([A-C][12])/) || [])[1] || "";
    var govde = s.replace(/^[A-C][12]-M\d+[\s-]*/, "");
    var bolum = (govde.match(/·\s*P(\d+)/) || [])[1] || "";
    var temel = govde.replace(/\s*·\s*P\d+.*$/, "").trim();
    return { seviye: seviye, temel: temel, bolum: bolum };
  }

  function modul(mod) {
    var c = cozumle(mod), t = T[c.temel];
    return {
      ad: t ? t[0] : c.temel,
      aciklama: t ? t[1] : "",
      bolum: c.bolum,
      ingilizce: c.temel,
      seviye: c.seviye,
      gramer: DURUM.indexOf(c.temel) < 0
    };
  }
  function seviye(kod) {
    var s = SEVIYE[kod] || { ad: kod, aciklama: "" };
    return { kod: kod, ad: s.ad, aciklama: s.aciklama };
  }

  function gramerMi(mod) { return DURUM.indexOf(cozumle(mod).temel) < 0; }
  global.DHModulTanim = { modul: modul, seviye: seviye, gramerMi: gramerMi, SEVIYELER: ["A1", "A2", "B1", "B2", "C1"] };
})(window);
