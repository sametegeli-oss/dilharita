# Günlük Derse Telaffuz Eklendi

Artık her ders, anayasaya göre telaffuz (konuşma) pratiği de içeriyor. İki yöntem var, hangisinin kullanılacağına anayasadan karar veriliyor.

## Dosyalar
| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `teacher-policy.js` | **Değiştir** | Anayasaya `telaffuz` ayarları eklendi |
| `lesson-engine.js` | **Değiştir** | Derse telaffuz adımı üretimi eklendi |
| `ders.html` | **Değiştir** | İki telaffuz modu (gömülü mikrofon + videopractice köprüsü) |
| `videopractice.html` | **Değiştir** | Dersten gelen cümleyle başlama + derse dönüş |

## Anayasadaki yeni ayarlar
```json
"telaffuz": {
  "acik": true,            // derste telaffuz olsun mu
  "adimSayisi": 1,         // her derste kaç telaffuz adımı
  "yontem": "ders-ici"     // "ders-ici" veya "videopractice"
}
```
Ders sayfasındaki ⚙️ ile bunları düzenleyebilir, kapatabilir, sayısını artırabilir veya yöntemi değiştirebilirsin.

## İki yöntem

**`ders-ici` (hafif, varsayılan):** Ders sayfasından çıkmadan telaffuz. Cümle gösterilir, dinlenir, mikrofona basıp okunur. Tarayıcının ses tanımasıyla (SpeechRecognition) duyduğu metin yazıya çevrilir, hedefle karşılaştırılıp %puan verilir. %70+ başarılı sayılır. Video/avatar yok — hızlı ve hafif.
- Ses tanıma desteklemeyen tarayıcıda: dinle + "söyledim" ile geçilir (puan vermeden).

**`videopractice` (tam ekran):** Telaffuz adımına gelince öğrenci, o cümlenin modülüyle mevcut **videopractice.html**'e yönlendirilir (videolu, avatarlı, tam puanlama). Bitince "← Derse dön" ile ders kaldığı yerden devam eder. Mevcut, test edilmiş video motoru hiç değişmeden kullanılır.

## Sistem entegrasyonu
- Her iki yöntemde de telaffuz sonucu **ortak ilerleme motoruna** (`sentence:` kimliği) yazılır → harita ve tekrar sistemi güncellenir.
- Telaffuz adımı dersin **sonunda** gelir (öğrenme → pekiştirme → konuşma sırası).
- Telaffuz cümleleri öncelikle o derste geçen cümlelerden seçilir (öğrendiğini hemen konuşturur).

## Test edildi
- Anayasa: telaffuz açık/kapalı, adım sayısı, yöntem değişimi ✓
- Motor: telaffuz adımı doğru sırada (sona) üretiliyor, 2 adım ayarı çalışıyor ✓
- Skorlama: tam eşleşme %100, kısmi %75, yanlış %0 ✓
- Köprü: dersten videopractice'e cümleyle gidiş + dönüşte kaldığı adımdan devam ✓

## Not
- `ders-ici` telaffuz için mikrofon izni gerekir; tarayıcı ilk kullanımda sorar.
- Ses tanıma en iyi Chrome/Edge'de çalışır; bazı tarayıcılarda sınırlı olabilir (o durumda otomatik "dinle + geç" moduna düşer).
- `videopractice` yöntemi için Pexels API anahtarı (videopractice'in kendi ayarı) gerekir; yoksa video gelmez ama telaffuz yine çalışır.
