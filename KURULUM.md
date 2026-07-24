# Öğretmen Destek Masası — Genişletilmiş Sürüm + Repo Entegrasyonu

Bugün iki iş yapıldı: (1) bilgi tabanı **22 → 30 konuya** genişletildi ve her konunun örnek sayısı **6 → 8**'e çıktı, (2) paket, dilharita reposundaki gerçek sayfalara **tek satır**la takılacak biçimde bundle'landı.

## Ne değişti (genişletme)

Eklenen 8 yeni konu (hepsi TR/EN kural + formül + örnek + regex ile):

| id | Konu | Seviye |
|---|---|---|
| `imperatives` | Emir Cümleleri | A1 |
| `causatives` | Ettirgen Yapı (have/get sth done) | B1-B2 |
| `too_enough` | Too / Enough | A2-B1 |
| `so_such` | So / Such ... that | B1 |
| `articles` | Tanımlıklar (a / an / the) | A1-A2 |
| `prepositions` | Edatlar (in / on / at) | A1-A2 |
| `would_rather` | Tercih Yapıları (would rather / prefer / had better) | B1-B2 |
| `question_forms` | Soru Yapıları (Wh- / Yes-No) | A1-A2 |

Artık toplam **30 konu**, her biri **8 gerçek örnek cümle** (cümle bankasından, uzunluğa yayılmış), toplam **9.435 etiketli cümle**. Test edildi: yeni konuların hepsi doğru cümlelerde tespit ediliyor (emir, ettirgen, too/enough, so/such, tercih, soru yapıları — hepsi ✓).

## Dosyalar

| Dosya | İşlem | Ne işe yarar |
|---|---|---|
| `dilharita-teacher-support.bundle.js` | **Repoya yükle** | Tek dosya: KB + motor + 💡 widget. Sayfaya bunu eklemen yeter. |
| `teacher-kb.json` | Repoya yükle (opsiyonel) | Ayrı bilgi tabanı (fetch ile yüklemek istersen). |
| `teacher-kb.js` | — | KB'nin `window.TEACHER_KB` gömülü hâli (bundle içinde zaten var). |
| `teacher-support.js` | — | Motor (bundle içinde zaten var). |
| `teacher-widget.js` | — | Widget (bundle içinde zaten var). |
| `sentences.tagged.json` | Repoya yükle (opsiyonel) | 9.435 cümle, konu etiketleriyle — pratik modülünü "konuya göre" beslemek için. |
| `build_teacher_kb.py` | Sende dursun | KB'yi yeniden üreten/geliştiren script. |

> Günlük kullanımda **tek gereken dosya `dilharita-teacher-support.bundle.js`**. Diğerleri opsiyonel/kaynak.

## Repoya entegrasyon (GitHub sitesi üzerinden)

**1. Bundle'ı yükle:** `dilharita-teacher-support.bundle.js`'i reponun köküne (diğer .js dosyalarının yanına) yükle.

**2. Sayfalara tek satır ekle.** Öğretmen yardımı istediğin her sayfanın `</body>`'den hemen ÖNCESİNE şu satırı koy:

```html
<script src="./dilharita-teacher-support.bundle.js"></script>
```

Önerilen sayfalar ve onların cümle elementleri (widget bunları **otomatik** buluyor — ek ayar gerekmez):

| Sayfa | Cümle elementi | Otomatik bulunur mu |
|---|---|---|
| `practice.html` | `data-en` | ✅ evet |
| `ders.html` | `.en` | ✅ evet (listeye eklendi) |
| `teacher.html` | `.subject-en` / `.en` | ✅ evet |
| `kelime-ogren.html` | (cümle gösteren element) | gerekirse aşağıya bak |

Sayfayı açınca sağ altta **💡** butonu çıkar; basınca o an gösterilen cümlenin kuralını + 3 örneğini gösterir.

**3. (Gerekirse) cümleyi elle bildir.** Bir sayfada widget cümleyi otomatik bulamazsa, cümleyi gösteren yerde tek satırla söyle:

```js
DilharitaTeacher.setSentence(aktifCumleEN);
```

## Mevcut AI öğretmene bağlama (RAG — daha az uydurma)

dilharita'da zaten Groq AI öğretmen var. Widget'a onu bağlarsan, "🤖 Yapay zekâ öğretmene sor" butonu çıkar ve AI **yalnızca doğrulanmış kurala** dayanarak yanıtlar. Bundle'dan ÖNCE şu ayarı ekle:

```html
<script>
window.DHT_CONFIG = {
  askLLM: async (ctx, info) => {
    // ctx = kaynağa dayalı bağlam (kural + örnekler). Mevcut Groq çağrına system olarak ver:
    return await seninGroqCagrin([
      { role: "system", content: ctx },
      { role: "user",   content: info.question || "Bu cümledeki yapıyı açıkla." }
    ]);
  }
};
</script>
<script src="./dilharita-teacher-support.bundle.js"></script>
```

## Otomatik tetikleme fikri (öğrenci "takıldığında")

`hata-defteri` / yanlış-cevap mantığına ekleyerek, öğrenci 2 kez yanlış yapınca paneli kendiliğinden açabilirsin:

```js
// yanlış cevap sayacı 2'ye ulaşınca:
DilharitaTeacher.setSentence(aktifCumleEN);
DilharitaTeacher.open();
```

## KB'yi ileride büyütmek

`build_teacher_kb.py` içindeki `TOPICS` listesine yeni konu ekle, `33.xlsx`'ten üretilen `excelveri.json`'u girdi ver, çalıştır:

```bash
python3 build_teacher_kb.py
```

Çıktı: `teacher-kb.json`, `teacher-kb.js`, `sentences.tagged.json` yeniden üretilir. Sonra bundle'ı bu üçüyle yeniden birleştirmen yeterli (KB.js + teacher-support.js + teacher-widget.js).

## Not / sınır

- Tespit sezgiseldir (regex); belirsiz cümlede birden çok kart döner, ilki birincildir. Bu kasıtlı — öğrenci ilgili tüm yapıları görür.
- `articles`, `prepositions`, `question_forms` bilerek **düşük öncelikli**: cümlede daha "belirleyici" bir yapı (edilgen, koşul, ettirgen vb.) varsa o öne çıkar, tanımlık/edat ikincil kalır.
- Kural metinleri özgün yazıldı; örnek cümleler kendi bankandan (33.xlsx) geldi — telifli kaynak metni birebir gömülü değil.
