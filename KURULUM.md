# Öğretmen Sistemi — Kurulum

AI'sız, kurallı bir "öğretmen" eklendi. Öğretmen senin verine bakıp dersi kendisi planlıyor, konuları belirliyor, açıklıyor ve adım adım yönetiyor. Davranışı, düzenlenebilir bir **anayasa** ile yönetiliyor.

## Dosyalar
| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `teacher-policy.js` | **Yeni** | Öğretmen anayasası — düzenlenebilir pedagojik kurallar |
| `lesson-engine.js` | **Yeni** | Ders motoru — anayasayı verinle birleştirip ders üretir |
| `ders.html` | **Yeni** | "Bugünkü Dersim" sayfası — öğretmen arayüzü |
| `index.html` | **Değiştir** | Ana menüye "🎓 Bugünkü Dersim" kartı (en üstte) |

> Bağımlılık: `progress-engine.js` (önceki adımdan) yüklü olmalı. Veri: `data/sentences.json`, `data/phrasal-verbs.json`, `data/dictionary.json`.

## Nasıl çalışıyor?

### Öğretmenin beyni: Anayasa
`teacher-policy.js` öğretmenin uyduğu tüm kuralları içerir — bir nevi "prompt" ama deterministik. Örnek kurallar:
- Ders uzunluğu, günlük yeni öğe sınırı (bilişsel yük)
- Ders evreleri ve oranları: **ısınma → tekrar → yeni → pekiştirme**
- Konu seçim önceliği: önce geciken tekrarlar → zayıf konular → yarım modül → yeni içerik
- İçerik ağırlıkları (cümle/öbek/kelime dağılımı)
- İlerleme eşikleri, uyarlanabilirlik, günlük hedef, öğretmen mesajları

### Ders motoru
Öğrencinin gerçek verisine bakar:
- **DHProgress** → ne öğrenildi/öğreniliyor
- **Hata Defteri** → nerede zayıf
- **StudyTracker** → seri, hedef

Bu veriyi anayasayla birleştirip somut bir ders planı kurar. Deterministiktir — aynı durumda hep aynı mantıklı planı verir.

### Ders akışı (ders.html)
Öğretmen baloncuğuyla öğrenciyi karşılar, evre evre yönetir:
1. **Isınma:** Bildiği birkaç öğeyle güven tazeler
2. **Tekrar:** Önce hata yaptıkları, sonra "öğreniliyor" durumundakiler
3. **Yeni:** Seviyeye uygun, frekans öncelikli yeni içerik (açıklama + örnek)
4. **Pekiştirme:** Yeni öğrenilenle mini çoktan seçmeli alıştırma

Her adımda "Anladım / Hatırladım / Zor geldi" ile öğrenci tepki verir; sonuç ortak ilerleme motoruna yazılır, harita ve tekrar sistemi güncellenir.

## Anayasayı düzenleme (kullanıcıya açık)
Ders sayfasında sağ üstteki ⚙️ ile **anayasa düzenleyici** açılır:
- Tüm kurallar JSON olarak görünür ve düzenlenebilir (bir prompt gibi).
- **Kaydet** → yeni ders bu kurallara göre hazırlanır.
- **↺ Varsayılana dön** → her an fabrika ayarlarına döner.
- Geçersiz JSON girilirse uyarır, bozmaz.

Örnek: "yeni içerik çok geliyor" dersen, `evreOranlari.yeni` değerini düşürüp `tekrar`'ı artırırsın — öğretmen anında daha çok tekrar yaptırmaya başlar.

## Test edildi
- Anayasa: yükleme, düzenleme, iç içe alanlar, geçersiz JSON yakalama, varsayılana dönüş, eski kayıtlara yeni alan ekleme ✓
- Motor: gerçek veriyle (9417 cümle + 881 öbek + 10679 kelime) doğru ders planı; evreler ve öncelik sırası doğru; anayasa düzenlemesi anında etki ediyor ✓

## İleride (istenirse)
- Anayasayı görsel ayar arayüzüyle de düzenlemek (kaydırıcılar/seçimler — JSON bilmeyenler için).
- Mevcut AI öğretmeni (teacher.html) bu derse bağlayıp "yeni" evrede konuyu sohbetle anlattırmak — kurallı motor konuyu seçer, AI anlatır.
- Pratik skorlarını uyarlanabilirliğe gerçek veri olarak bağlamak.
