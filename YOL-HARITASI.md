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
5. **Menülerde üç boyutlu canlı görünüm:** katmanlı kartlar, eğimle paralaks, yalnız menülerde; "Canlı görüntü" ayarına bağlı.

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
- Firestore'da birikmiş öksüz video parçalarını silme (kullanıcı onayladı; kota sıfırlanınca yapılacak).
- Piper sayacı iyileştirmeleri, karma ses (İngilizce tarayıcı sesi / Türkçe Piper), barge-in, kadın avatar,
  hassas tanıma ve onay ekranını kapatma önerisi (cevap bekliyor), "&quot;" çözümleme önerisi.

## Yapıldı
- 24 Kasım: Oturum her sabah düşüyordu → Browser key'e Token Service API eklendi.
- 24 Kasım: Senkron okuma kotasını bitiriyordu → video kayıtları artımlı okunuyor, eski parçaların silinmesi bekleniyor (sw v566).
- 23 Kasım: Piper tamponlu okuma, Android tarayıcı sesi perde/hız 1, görüntülü ders tahtası, düzeltme gösterimi, canlı görüntü.
