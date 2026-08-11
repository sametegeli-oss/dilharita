# Dil Harita · Atlas

Mevcut Dil Harita projesinin **verisiyle**, ama **sıfırdan yazılmış** arayüz ve motorla
tek sayfalık bir uygulama. 50 ayrı HTML sayfası yerine tek kabuk, hash yönlendirme,
6 çekirdek + 5 ekran dosyası.

Açmak için Windows'ta `BASLAT.cmd` dosyasına çift tıkla. Açılan komut penceresi
açık kaldığı sürece uygulama `http://127.0.0.1:8765/` adresinde çalışır.
`index.html` dosyasını doğrudan `file://` ile açma; sözlük, ders verileri ve service
worker tarayıcı güvenliği nedeniyle bu kipte yüklenmez.

---

## Neden yeniden yazıldı

Eski projede 961 dosya, `index.html` ile `koc-modu.html` gibi birbirinin kopyası
sayfalar, `app.js` ve `assets/app.js` gibi kaynağı olmayan iki ayrı bundle, ve
ilerlemeyi 11 ayrı localStorage anahtarına dağıtan bir yapı vardı. Atlas'ta:

| | Eski | Atlas |
|---|---|---|
| Sayfa sayısı | 50 HTML | 1 HTML + 11 modül |
| İlerleme deposu | 11 anahtar, birleştiren yok | tek `atlas:srs` + tek olay yayını |
| Kod satırı (uygulama) | ~2 MB bundle + 50 sayfa | ~5.500 satır, tamamı okunur |
| Bağımlılık | Firebase, jQuery izleri, 2 bundle | **sıfır** |
| Test | dağınık .mjs dosyaları | `test.mjs` — 83 test, hepsi geçiyor |

---

## Dosya haritası

```
index.html              kabuk — 3 KB, tüm ekranlar buraya çizilir
css/atlas.css           tasarım sistemi (tokens → bileşen → ekran → hareket)
js/core.js              durum · SM-2 · ilerleme · seri · hata defteri · rozet · yedek
js/veri.js              veri yükleyici — parçalı indirme, bellek, kelime indeksi
js/ses.js               çift dilli seslendirme · ağız haritaları · tanıma · gölgeleme
js/ai.js                sağlayıcı köprüsü · persona yalıtımı · dil kuralları
js/ui.js                bileşen kitaplığı — halka, grafik, konfeti, baloncuk, avatar
js/app.js               yönlendirici · kabuk · kurulum · ana sayfa · menü
js/ekran-ogren.js       modül haritası · oturum motoru (5 kip) · tekrar · telaffuz
js/ekran-kelime.js      kelime kartları · quiz · kendi listem · phrasal verbs
js/ekran-analiz.js      ilerleme · 30 günlük rapor · hata defteri · aktivite · seviye testi
js/ekran-sohbet.js      rol yapma senaryoları · öğretmen · kendi cümlelerim · modül üretimi
js/ekran-ayar.js        ayarlar · veri, yedek, göç, dışa aktarım
sw.js                   service worker — HTML ağ önce, varlıklar stale-while-revalidate
test.mjs                83 test (jsdom gerektirir)
data/                   mevcut projeden gelen veri + iki yeni indeks
```

---

## Ekranlar (hepsi çalışır durumda)

**Öğren** — 506 modül, A1→C1, yolculuk patikası olarak. İlerleme çubukları
tek cümle indirmeden çiziliyor.

**Oturum motoru** — beş kip, hepsi aynı motoru kullanır:
üretim (Türkçesini gör, İngilizcesini yaz) · tanıma (kendini yokla) ·
dinleme (duyduğunu yaz) · telaffuz (sesli oku, karşılaştır) · boşluk doldurma.
Her cevaptan sonra: benzerlik yüzdesi, kelime kelime fark (ins/del), doğru cümle,
IPA, Türkçe okunuş, "neden böyle" açıklaması, sık yapılan hata, birlikte kullanımlar,
eş/karşıt anlam, kendi notun.

**Tekrar** — vadesi gelenler; cümle / kelime / phrasal ayrı, ayrıca
"sadece zorlandıklarım" listesi.

**Kelime** — 10.679 kelimelik sözlük, frekans sıralı. 3B çevirmeli kartlar,
çoktan seçmeli quiz, arama, kendi listen. Her kelime için örnek cümleler
kelime→cümle indeksinden geliyor (165 KB, kapsam %100).

**Phrasal verbs** — 881 öbek fiil; anlam, örnek, üç kipli pratik
(çoktan seçmeli, boşluk doldurma, dinle-seç).

**Konuşma** — 8 senaryo (öğretmen, havaalanı, otel, doktor, restoran, mülakat,
günlük sohbet, alışveriş). Konuşan avatar, sesle giriş, tek dokunuşla çeviri.

**Öğretmen** — serbest cümle çözümlemesi, Türkçe anlatım.

**Kendi cümlelerim** — elle veya toplu yapıştırarak ekle; sanal modül olur,
aynı SRS motoruyla çalışır.

**Modül üret** — konu yaz, AI seviyene uygun cümleler üretsin, kaydet veya hemen çalış.

**İlerleme · Rapor · Hata defteri · Aktivite · Seviye testi** —
seviye çubukları, 15 rozet, 30 günlük aktivite ve doğruluk eğrisi,
önümüzdeki 30 günün tekrar yükü, hata eğilimi, saat saat bugün.

**Ayarlar · Veri** — tema, okuma kolaylığı, ses seçimi ve hız, AI sağlayıcı,
yedek al/geri yükle/birleştir, eski Dil Harita verisini aktar, CSV dışa aktarım.

---

## Motorda düzeltilen üç şey

**1) SM-2'de kalite puanı artık sabit değil.**
Eskiden `q` sabit 4 yazılıydı. SM-2 formülünde q=4 iken düzeltme terimi
`0.1 - (5-4)×(0.08 + (5-4)×0.02) = 0` — yani kolaylık katsayısı başarıda
hiç artmıyor, sadece "zor"da düşüyordu. Uzun vadede her kalem 1.3 tabanına
kayar ve iyi bildiğin cümleler bile giderek daha sık sorulur.
Atlas'ta `q` benzerlik yüzdesinden türüyor (%90+ → 5, %70+ → 4, altı → 3/2),
ef'e 3.0 tavanı da kondu. `test.mjs` eski hatayı ayrı bir testle sabitliyor:
biri sabit değere dönerse test kırılır.

**2) Persona sızıntısı kapatıldı.**
Eskiden öğretmen promptu her AI çağrısının başına koşulsuz ekleniyordu; doktorla
konuşurken sistem mesajının başında 9 bölümlü gramer analizi öğretmeni duruyordu ve
doktoru eziyordu. Atlas'ta öğretmen promptu yalnız `ogretmen: true` işaretli senaryoya
giriyor. Dil kuralı da senaryoya göre seçiliyor: öğretmen → anlatım tamamen Türkçe,
rol yapma → İngilizce kalır. İki test bunu sabitliyor.

**3) Veri parçalı kalıyor, ama artık tek gerçeklik kaynağı var.**
Modül listesi 28 KB indeksle çiziliyor, bir modül ~5 KB. `sentences.json` (8,3 MB)
ve `excelveri.json` hiç kopyalanmadı — kimse istemiyor. Yerine iki küçük dosya üretildi:
`examples.json` (8.609 cümle, id/en/tr — 1 MB) ve `word-index.json`
(5.385 kelime → cümle numarası — 165 KB).

---

## Testler

```bash
npm install jsdom
node test.mjs
```

83 test: SM-2 davranışı ve sınırları, benzerlik/fark, SRS deposu ve bellek
geçersizleştirme, seri koruma mantığı, hata defteri tekilleştirme, ağız
haritalarının iki dilde farkı, `[[ ]]` ayrıştırma, persona yalıtımı,
yedek/göç döngüsü, gerçek veri dosyalarıyla yükleyici, ve 21 ekranın
hatasız açılışı (konsol hatası da yakalanır).

Test yazarken üç şey yakalandı ve düzeltildi:
`UI.kutla` içinde bileşen çağrısı yanlış imzayla yapılıyordu (kutlama ekranı
istatistikle çağrıldığında çöküyordu), `Veri.index()` ikinci çağrıda
"Kendi Cümlelerim" modülünü tekrar ekliyordu, ve SVG gradyanlarında
`stop-color="var(--brand)"` yazılmıştı — sunum niteliğinde CSS değişkeni
çözülmez, halkalar ve grafikler renksiz kalırdı.

---

## Yayına alma

Statik dosya; olduğu gibi GitHub Pages'e konabilir.
Eski uygulamayla aynı yerde durabilir — anahtar alanı ayrı (`atlas:`),
birbirlerinin verisine dokunmazlar. İlk açılışta veya
Ayarlar → Veri → "Eski verimi aktar" ile eski ilerleme taşınır.

Service worker'ı güncellerken `sw.js` içindeki `SURUM` değerini artır;
eski önbellekler otomatik silinir.

---

## Yapay zekâ (isteğe bağlı)

Ayarlar → Yapay zekâ. Groq, Google Gemini veya OpenAI uyumlu bir uç nokta.
Anahtar yalnızca tarayıcıda durur. Anahtar yoksa şunlar kapalı olur:
konuşma senaryoları, serbest cümle çözümlemesi, cevap hakemliği, modül üretimi,
koç yorumu. Geri kalan her şey — modüller, SRS, telaffuz, kelime, phrasal,
raporlar — anahtarsız tam çalışır; açıklamalar veri setindeki
`aiExplain`, `commonMistake`, `collocations` alanlarından gelir.
