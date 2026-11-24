# Dil Harita — yol haritası ve kararlar

Kullanıcıyla birlikte alınan kararlar ve sıradaki işler. Bir iş bitince "Yapıldı"ya taşı, tarihini yaz.

## Hedef: Deniz merkez koç ("otomatik pilot")
Konuşkan'daki Deniz, programın tek koçu olur: bütün aktiviteleri takip eder, günü planlar,
ekranları kendisi açar, gerektiğinde tekrar ettirir. Kumanda her zaman kullanıcıda kalır.

### İlkeler (24 Kasım kararları)
- Rakamları uygulama hesaplar; Deniz yalnız yorumlar ve önerir (yapay zekâ veri uydurmaz, veri yazmaz).
- Deniz'e ham veri değil kısa bir öğrenci özeti gider (son 7 gün ayrıntılı, 4 hafta haftalık, başlangıçtan aylık).
- Mevcut dağınık koç/plan/ilerleme ekranları birleştirilir; yenisi eklenmez. Eski sayfaları kaldırmadan önce kullanıcıya sor.
- Tahminler dürüst: veri azsa "henüz erken"; kaydı olmayan beceri boş kutu görünür.
- Paneldeki her bilgi bir eylem düğmesiyle biter.

### Veri saklama
| Ne | Süre |
|---|---|
| Ham olaylar (ekran, ne yapıldı) | 30 gün |
| Günlük özet (dakika, beceri dağılımı, doğru/yanlış) | süresiz |
| Haftalık/aylık özet | süresiz |
| Tekrar kartları, seviye testleri, sertifikalar | süresiz |
| Hatalar | çözülene kadar tam; sonra yalnız sayı |
`dh-activity-log-v1` 10 günden 30 güne çıkarılacak; `dh-study-tracker-v1`'de 30 günden eski günlerin olay listesi silinecek.

### 1. aşama envanteri (24 Kasım) — `dh-olay.js`
- **Ortak kayıt:** `dh-olay.js` (auth-guard her korumalı sayfaya ekler). Günlük özet `dh-gun-ozet-v1` (cihaz kovalı, buluta
  senkron, progress belgesinde; birleştirme `cloud-sync.js` → `mergeGunOzet`), ham olaylar IndexedDB `dh-olay` (30 gün, yalnız cihaz).
- **Etkin süre** (görünür + son 90 sn'de dokunma ya da ses/video çalıyor): 35 sayfa beceriye eşli
  (kelime, yazma, dinleme, konuşma, okuma, dilbilgisi). Menü/ilerleme/ayar sayfaları süre saymaz.
- **Cevaplar:** `dhCoachEvaluate` üzerinden → tekrar, pratik, öğren (sesli → konuşma), video pratik (sesli → konuşma),
  kelime öğren, öğretmen, hata defteri. Konuşkan → yazılı/sesli sohbet, telefon görüşmesi, cümle kurma, fotoğraf anlatma,
  görüntülü ders (`dhKonuskanCevap`). Yanlışlarda konu türü `LearningErrorDB.detectTypes` ile (yüklü olduğu sayfalarda).
- **Cevap kaydı henüz olmayan (yalnız süre):** akıllı tekrar, YouTube eğitim/pratik, İngilizceyi Yaşa, telaffuz stüdyosu,
  sesli çalış, ders ve modül testleri, seviye testi, phrasal verbs, kitaplık, senaryolu sohbetler. 3. aşamada ("bitti"
  sinyalleri) bağlanacak.
- **Saklama:** aktivite günlüğü 10 → 30 gün; çalışma sayacında 30 günden eski günlerin olay listesi silinir;
  günlük özette 90 günden eski günler tek kovaya sıkışır (süresiz).

### Aşamalar (sırayla; her aşamadan sonra kullanıcı telefonda dener)
1. **Envanter + saklama kuralları:** hangi ekran neyi kaydediyor, eksikler; tek aktivite kaydı.
2. **Koç beyni + Koçluk Paneli + Deniz'in sabah özeti.**
   **Koç beyni (denizkoç):** Firestore'da kullanıcıya özel tek belge (herkese açık depoya asla girmez). İki bölüm:
   (a) *hesaplanan* — uygulama her gün veriden yeniden hesaplar (seviye, kelime %, beceri süreleri, hata türleri ve seyri,
   tekrar başarısı, amaç/hedef, plan durumu); yapay zekâ yazamaz.
   (b) *Deniz'in notları* — gözlemler, kullanıcının istekleri ve tercihleri, denenen yöntemlerin sonuçları; her notta tarih ve
   kaynak (kullanıcı söyledi / veri / Deniz'in tahmini), boyut sınırı, eski notlar gözden geçirilir.
   `denizkoç.md` bunun Deniz'e verilen kısa okunur hâli; uygulama ve Telegram botu aynı belgeyi okur.
   Panelde "Deniz'in hakkımdaki notları": kullanıcı görür, düzeltir, siler. Haftada bir anlık kopya.
   **Koçluk kılavuzu (herkese aynı, kodda sürümlü):** Deniz'in veriyi nasıl kullanacağı —
   öncelik sırası (unutma riski olan tekrar → kişisel hedefler → amaca göre geride kalan beceri → yeni içerik),
   karar kuralları (ara tekrar, atlama, ara sonrası hafif gün, eğilim için en az 2–4 hafta veri),
   üslup (kısa, rakamla gerekçe, açıklama Türkçe / pratik İngilizce, oran seviyeye göre),
   not yazma kuralları (kaynak etiketi, sınır, hassas konu yazılmaz), yasaklar (rakam uydurmak, hesaplanan bölüme yazmak,
   onaysız hedef, tahmini kullanıcının sözü gibi yazmak), son söz kullanıcıda, haftalık değerlendirme.
   Kullanıcının **koçluk tercihleri** (koç beyninde) kılavuzun varsayılanlarını ezer.
   `denizkoç.md` = kılavuz + koç beyni. Kritik sınırlar (eşikler, sayılar, yazma yasakları, onay) **kodda da** uygulanır.
   Taslak: https://claude.ai/artifact/EAAnb2bp1aFyi3Yfw9ghdc (Neredeyim, Amacım, Nereye gidiyorum, Bu hafta, Gidiş, Güçlü/zayıf).
   Seviye ölçüsü için Oxford kelime listesi (kullanıcının Excel'inden, A1–C1) kullanılabilir.
3. **Koç modu:** Deniz plan adımlarını kendisi açar; her ekran gerçek "bitti" sinyali verir; 5 sn geri sayımlı geçiş
   (Bekle/Atla); üstte farklı renkte "Koç modu · Adım 2/4" şeridi ve ilerleme çubuğu; "Koçtan çık"; menüye girilince koç bekler.
   **Ara tekrar:** başarı < %70 ya da aynı hata türü ≥ 3 → yalnız yanlışlar, biraz sonra, farklı biçimde; adım başına günde en çok 1; eşikler ayarlanabilir.
4. **Kişisel hedefler:** kullanıcı "in/of'ta zayıfım" der → Deniz veriye bakıp ölçülebilir hedef önerir (süre, günlük dk, ölçü);
   en fazla 3 açık hedef; günlük süre sabit, Deniz neyi azalttığını söyler. Günlük istekler de ("yorgunum, kısa tut").
5. **Menülerde üç boyutlu canlı görünüm:** taslak (kullanıcı onayı bekliyor): https://claude.ai/artifact/EAAnb2bp1aFyi3Yfw9ghdc#artboard-Menu3D — katmanlı kartlar, eğimle paralaks, yalnız menülerde; "Canlı görüntü" ayarına bağlı.

### Araştırmadan eklenenler (24 Kasım, kullanıcı onayladı)
- Deniz arar: çalışılmayan günde bildirimle "arar", konuşma sonrası "bu konuşmadan 3 ders".
- Bildiğini atlat: "bunu biliyorum" → 3 soruluk hızlı sınav → geçerse atla.
- Her panel rakamına bir eylem düğmesi.
- Hafıza: Deniz önceki zorlukları hatırlayıp bugüne taşır.
- Düzeltme sıkılığı ayarı: yumuşak / dengeli / sıkı.
- Karışık (interleaved) ve soru biçimli tekrar.
- Kendi hayatından dersler (ör. toplantı provası).
- Ayda bir "öğretmenine götür" özeti.
- Tekrar sistemini FSRS'e geçirme (büyük iş; önce mevcut algoritmayı incele).

### Telegram (24 Kasım, kullanıcı istedi)
Deniz'le Telegram'dan yazışma (WhatsApp, Meta'nın 2026 yapay zekâ bot kuralı ve şablon zorunluluğu yüzünden seçilmedi).
Telegram Bot API ücretsiz. Sunucu: projedeki Cloudflare Worker. Kullanıcı @BotFather'dan bot oluşturup anahtarı verecek.
Deniz kendisi yazabilir, sesli mesaj alıp verebilir; konuşmalar koç özetine ve Sohbetlerim'e işlenir.
Önce programın kendi bildirimleriyle "Deniz arar", sonra Telegram.

## Diğer açık konular
- Kullanıcının Excel dosyası: Oxford kelime listesi ve konu tabloları eklenebilir; kişisel cümle bankası (~13.700 çift)
  açık depoya değil "dosyadan içe aktar" ile cihaza. Telifli içerik (Headway, çeviri kılavuzu, podcast dökümleri) eklenmez.
- Piper sayacı iyileştirmeleri, karma ses (İngilizce tarayıcı sesi / Türkçe Piper), barge-in, kadın avatar,
  hassas tanıma ve onay ekranını kapatma önerisi (cevap bekliyor), "&quot;" çözümleme önerisi.

## Model testi (24 Kasım, 10 senaryo, kullanıcının anahtarlarıyla)
- **Groq gpt-oss-120b:** ~1 sn; 10'da 5 ilk denetimden geçti. Hatalar: ekran yerine beceri adı (düzeltildi: eş anlamlı
  çevirisi + istekte kimlik listesi), bir uydurma sayı, ve **rakamı yanlış beceriye bağlama** ("dinleme 0 dk", 0 konuşmanındı) →
  olgu listesi + rakam-kelime eşleşme denetimi eklendi (yerel testte yakalıyor).
- **Gemini 3.6 Flash:** test sırasında günlük ücretsiz kota dolu (429), ölçülemedi. **Cerebras:** 402 ücretsiz hak bitmiş.
- **NVIDIA Nemotron 3 Super:** 90 sn'de cevap yok → günlük plan için uygun değil. OpenRouter ücretsiz: ölçülmedi.
- **Canlı veride (24 Kasım 10:33):** Groq ~1 sn, denetimden geçti. Sıra artık Groq → Gemini → Cerebras → NVIDIA; kotası dolan /
  cevap vermeyen model 6 sa atlanır; panel model beklerken kural planını hemen gösterir. Haftalık veri 60 dk altındayken beceri
  oranları modele verilmez ("konuşmayı %100 tamamladın" hatası). Kota sıfırlanınca Gemini yeniden ölçülecek.

### 2. aşamada kalanlar
- Eski 6 ilerleme sayfasının (rapor, ilerleme, aktivite, harita, günlük takip, öğrenme yolu) kaldırılıp kaldırılmayacağı:
  kullanıcıya sorulacak. Şimdilik üstlerinde panel bağlantısı var.
- (Gemini 11:02'de ölçüldü: gerçek veride 10 sn'de denetimi geçti, ikinci denemede 15 sn'yi aştı; Groq 1,1 sn ve iki denemede de geçti → Groq önce kalıyor.)

## Yapıldı
- 24 Kasım 11:02: Firestore'da 3.318 öksüz video parçası silindi (kullanıcı onayıyla; 65 ana kayıt + 85 parça kaldı, eksik yok).
  Not: REST `batchWrite` güvenlik kurallarında reddedildi, `commit` çalıştı; büyük belgelerde grup 50.
- 24 Kasım: 4. aşama çekirdeği — kişisel hedefler (panelde "Senin isteklerin": istek → Deniz ölçülebilir hedef önerir →
  kullanıcı onaylar; en çok 3; gerekçedeki rakam veriyle uyuşmazsa koddan kurulur; planda öncelik 2; ilerleme: gün ve hata
  başta/şimdi), bugüne özel istek (15/45 dk, plan yeniden), düzeltme sıkılığı Konuşkan'da uygulanıyor (sw v579).
- 24 Kasım: 3. aşama çekirdeği — koç modu (`dh-koc-modu.js`): panel/Konuşkan'dan başlar, adım ekranını açar, lacivert şerit +
  ilerleme çubukları, adım süresi %80 dolunca ya da "Adımı bitirdim" ile 5 sn geri sayımlı geçiş (Bekle/Atla/Şimdi aç, Türkçe
  sesli), ara tekrar (≥5 cevapta başarı <%70 ya da aynı konuda 3+ yanlış → bir adım sonra hata defteri 5 dk, ekran başına günde 1),
  plan dışı sayfada "beklemede", Koçtan çık, alt menü lacivert (sw v578). Kalan: ekran bazlı gerçek "bitti" sinyalleri, bildiğini atlat yoklaması.
- 24 Kasım: Haftalık değerlendirme (kod üretir, haftada tek "veri" notu); eski ilerleme sayfalarına panel bağlantısı (sw v577).
- 24 Kasım: Konuşkan koç beynini okuyor (`kisaBaglam`: düzeltme sıkılığı, zayıf konular, notlar), ana sayfada Deniz'in
  bugünkü planı, oturum sonunda aynı hata türü 3+ ise konu başına tek "veri" notu (sw v576).
- 24 Kasım: 2. aşama çekirdeği — koç beyni, kılavuz, Deniz günlük plan + olgu denetimi, Koçluk Paneli (menüde), sw v569.
- 24 Kasım: 1. aşama — tek aktivite kaydı (`dh-olay.js`), saklama kuralları (sw v567).
- 24 Kasım: Oturum her sabah düşüyordu → Browser key'e Token Service API eklendi.
- 24 Kasım: Senkron okuma kotasını bitiriyordu → video kayıtları artımlı okunuyor, eski parçaların silinmesi bekleniyor (sw v566).
- 23 Kasım: Piper tamponlu okuma, Android tarayıcı sesi perde/hız 1, görüntülü ders tahtası, düzeltme gösterimi, canlı görüntü.
