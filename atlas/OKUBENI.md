# Dil Harita · Atlas

Mevcut Dil Harita projesinin **verisiyle**, ama **sıfırdan yazılmış** arayüz ve motorla
tek sayfalık bir uygulama. 50 ayrı HTML sayfası yerine tek kabuk, hash yönlendirme,
11 çekirdek + 12 ekran dosyası. **43 ekran, ~12.100 satır, sıfır kalıcı bağımlılık.**

Açmak için `index.html` — kurulum yok, derleme yok.
Yerelde `file://` yerine küçük bir sunucu kullan (`python -m http.server`); service
worker ve `fetch` bunu ister.

---

## Neden yeniden yazıldı

Eski projede 961 dosya, birbirinin kopyası sayfalar (`index.html` ↔ `koc-modu.html`),
kaynağı repoda olmayan iki ayrı bundle (`app.js` 218 KB, `assets/app.js` 299 KB), ve
ilerlemeyi 11 ayrı localStorage anahtarına dağıtan bir yapı vardı.

| | Eski | Atlas |
|---|---|---|
| Sayfa | 50 HTML | 1 HTML + 23 modül |
| İlerleme deposu | 11 anahtar, birleştiren yok | tek `atlas:srs` + tek olay yayını |
| Uygulama kodu | ~2 MB bundle + 50 sayfa | 12.100 satır, tamamı okunur |
| Kalıcı bağımlılık | Firebase, 2 bundle | **sıfır** (Tesseract/PDF.js/Firebase yalnız o ekran açılınca iner) |
| Test | dağınık .mjs dosyaları | `test.mjs` — 199 test, hepsi geçiyor |

---

## Dosya haritası

```
index.html              kabuk — 3 KB, 43 ekran buraya çizilir
css/atlas.css           tasarım sistemi (tokens → bileşen → ekran → hareket)

js/core.js              durum · SM-2 · karşılaştırma · seri · hata defteri · rozet · yedek
js/mastery.js           5 becerili ustalık motoru (kanıt → skor)
js/veri.js              veri yükleyici — parçalı indirme, bellek, kelime indeksi
js/gorsel.js            cümle görselleri — Pexels/Openverse/Commons/Wikipedia + IndexedDB
js/ses.js               çift dilli seslendirme · ağız haritaları · tanıma · gölgeleme
js/ai.js                sağlayıcı köprüsü · persona yalıtımı · dil kuralları
js/bulut.js             yerel hatırlatma · Firebase senkron ve birleştirme
js/ui.js                bileşen kitaplığı — halka, radar, grafik, konfeti, avatar
js/kelime-balonu.js     zengin kelime paneli — heceleme, ngram sıralı eş anlamlılar, AI
js/eklenti.js           iOS ses kilidi · göz kırpma · PWA istemi · çıktı · AI köprüsü · oturum hafızası
js/app.js               yönlendirici · kabuk · kurulum · bugün · menü
js/koc.js               koç balonu · öğretmen anayasası · telafi · seri ekranı

js/ekran-ogren.js       modül haritası · oturum motoru (5 kip) · tekrar · telaffuz · dinleme
js/ekran-kelime.js      kelime kartları · quiz · kendi listem · phrasal verbs
js/ekran-analiz.js      ilerleme · 30 günlük rapor · hata defteri · aktivite · seviye testi
js/ekran-sohbet.js      rol yapma · öğretmen · kendi cümlelerim · modül üretimi
js/ekran-drill.js       hata antrenmanı · modül sınavı · akıllı tekrar · öğrenme yolu
js/ekran-ders.js        günlük ders motoru · modül hikâyesi/podcast · gün sonu · günün konuşması
js/ekran-metin.js       kütüphane (Gutenberg) · OCR · PDF okuma
js/ekran-ses.js         akustik artikülasyon · video pratik · ses teşhis
js/ekran-studyo.js      ses dalga stüdyosu — hoca çizdir → sen oku → kıyasla
js/ekran-kible.js       namaz vakitleri ve kıble (yerel hesap)
js/ekran-ayar.js        ayarlar · hesap/bulut · kılavuz · veri, yedek, göç, dışa aktarım

sw.js                   service worker — HTML ağ önce, varlıklar stale-while-revalidate
test.mjs                199 test (jsdom gerektirir)
data/                   mevcut projeden gelen veri + üç yeni indeks
```

---

## 43 ekran

**Öğrenme** — modül haritası (506 modül, A1→C1) · öğrenme yolu · **bugünkü ders** (5 adımlı:
ısınma → sunum → alıştırma → hata onarımı → kapanış) · **modül hikâyesi/podcast** ·
**telafi** (alt seviyede kalan boşluklar) · kelime (10.679 kelime, 3B çevirmeli kart +
quiz + arama + kendi listen) · phrasal verbs (881 öbek, üç kipli pratik) · öğretmen ·
kendi cümlelerim · AI modül üretimi

**Çalışma motoru** — beş kip aynı motoru kullanır: üretim · tanıma · dinleme · telaffuz ·
boşluk doldurma. Her cevaptan sonra benzerlik yüzdesi, kelime kelime fark, cümle görseli,
IPA, Türkçe okunuş, "neden böyle", sık yapılan hata, birlikte kullanımlar, eş/karşıt
anlam, kendi notun ve **ustalık şeridi**.

**Pratik** — tekrar · akıllı tekrar · hata antrenmanı · modül sınavı · 8 konuşma senaryosu
(**sohbet sonu puanlama ve öğretmen raporu** ile) · telaffuz stüdyosu · dinleme ·
**günün konuşması** (üç soru, kalıplar, sesli cevap) · **gün sonu karma tekrar**

**Okuma ve ses** — kütüphane (Gutenberg) · fotoğraftan ekle (OCR) · PDF oku ·
**ses dalga stüdyosu** · akustik artikülasyon · video pratik (YouGlish)

**İlerleme** — ilerleme haritası · 30 günlük rapor · hata defteri · bugünkü aktivite ·
**öğrenme çizgin** (seri, kilometre taşları, koruma hakkı) · seviye testi · 15 rozet

**Ayarlar** — tema, okuma kolaylığı, ses seçimi ve hız, görseller, hatırlatma, AI
sağlayıcı, **öğretmen anayasası**, hesap ve bulut senkron, ses teşhis,
veri/yedek/göç/CSV, kullanım kılavuzu, **namaz vakitleri ve kıble**

Ayrıca her ekranda: **koç balonu** (duruma göre kendiliğinden konuşur, sağ alttaki
düğmeyle çağrılır), **zengin kelime baloncuğu** (herhangi bir İngilizce kelimeye dokun),
**yarım kalan oturumu sürdürme**, **çıktı alma** (cümle listesi ya da boşluklu çalışma
kâğıdı + cevap anahtarı).

---

## Motorun beş kararı

**1) SM-2'de kalite puanı sabit değil.**
Eskiden `q` sabit 4 yazılıydı. SM-2 formülünde q=4 iken düzeltme terimi
`0.1 - (5-4)×(0.08 + (5-4)×0.02) = 0` — kolaylık katsayısı başarıda hiç artmıyor,
yalnız "zor"da düşüyordu. Uzun vadede her kalem 1.3 tabanına kayar ve iyi bildiğin
cümleler bile giderek daha sık sorulur. Artık `q` benzerlik yüzdesinden türüyor
(%90+ → 5, %70+ → 4, altı → 3/2) ve ef'in 3.0 tavanı var. Eski hata ayrı bir testle
sabitlendi: biri sabit değere dönerse test kırılır.

**2) SRS "ne zaman"ı, ustalık motoru "hangi beceriyle"yi ölçer.**
Her öğe için beş beceri skoru tutuluyor: tanıma, dinleme, hatırlama, üretim, akıcılık.
Her cevap önce **kanıt** olarak kaydediliyor, skor kanıtlardan türetiliyor — puanlama
kuralı değişirse geçmiş veriden yeniden hesaplanabilir. Az kanıt varsa skora tam
güvenilmiyor (3 kanıt = tam güven), son kanıtlar daha ağır tartılıyor.
Yüksek tanıma + düşük üretim, klasik "anlıyorum ama konuşamıyorum" tablosudur; akıllı
tekrar oturumu o beceriyi hedefleyen kiple kurar. Kayıt `Atlas.cevapla`'ya bağlı,
yani hiçbir ekran kaydetmeyi unutamaz.

**3) Persona sızmaz.**
Eskiden öğretmen promptu her AI çağrısının başına koşulsuz ekleniyordu; doktorla
konuşurken sistem mesajının başında 9 bölümlü gramer analizi öğretmeni duruyor ve
doktoru eziyordu. Artık öğretmen promptu yalnız `ogretmen: true` işaretli senaryoya
giriyor. Dil kuralı da senaryoya göre: öğretmen → anlatım tamamen Türkçe;
rol yapma → İngilizce kalır, çünkü Türkçeye çevirmek alıştırmanın kendisini yok eder.

**4) Veri parçalı.**
Modül listesi 28 KB indeksle çiziliyor, bir modül ~5 KB. `sentences.json` (8,3 MB) ve
`excelveri.json` hiç kopyalanmadı. Yerine üç küçük dosya üretildi: `examples.json`
(8.609 cümle, id/en/tr — 1 MB), `word-index.json` (5.385 kelime → cümle — 165 KB),
ve zaten var olan ama hiç kullanılmayan `img-queries.json` nihayet kullanılıyor.

**5) Ağır kütüphaneler tembel.**
Tesseract.js (OCR), PDF.js ve Firebase SDK yalnız o ekran açıldığında iniyor.
Uygulamanın açılışına hiçbir maliyeti yok; o ekranlara hiç girmezsen hiç inmezler.

---

## Doğru sayılan farklı yazımlar

Karşılaştırma karakter değil **kelime** düzeyinde, çünkü iki dilbilgisel gerçek var:

**Kısaltmalar açılıp karşılaştırılır.** `wasn't` = `was not`, `I'm` = `I am`,
`can't` = `cannot` = `can not`, `let's` = `let us`. 45 kalıp, iki yönlü.
Eğik tırnak (’) düz tırnakla eşit.

**Cinsiyetsiz 3. tekil şahıs.** Türkçe "O" cinsiyet belirtmez; İngilizce hedef birini
seçmek zorunda. "O bir doktor." için `He is a doctor.` de `She is a doctor.` de doğru.

| grup | serbest |
|---|---|
| özne | he · she · it |
| nesne | him · her · it |
| iyelik | his · her · its |
| dönüşlü | himself · herself · itself |

Grup **içi** serbest, grup **arası** değil: `I saw he` hâlâ hata — bu cinsiyet değil,
özne/nesne hatası. Ekranda kabul edilen karşılık kesikli mavi çizgiyle işaretleniyor
(kırmızı hata değil), üstüne gelince hedefteki biçimi gösteriyor; tam puan aldığında
altta nedeni tek satırla yazıyor.

**Yazım hatası hâlâ hata.** `hapy` → %87 (kısmi puan, karakter benzerliğine göre).
`its fine` → tam puan yok: bu kısaltma değil, eksik fiil.

---

## Ses dalga stüdyosu

Eski `sesdalga.html`'in yaptığı iş, üç adımda:

1. **Hoca çizdirir** — cümle seslendirilirken ses zarfı üretilir. Hoparlör çıkışı
   tarayıcıdan geri okunamadığı için zarf metinden hesaplanıyor: kelime başına hece
   sayısı süreyi, ünlü yoğunluğu genliği, noktalama duraklamayı veriyor. Kaba ama her
   cihazda aynı sonucu veriyor.
2. **Sen okursun** — mikrofondan RMS zarfı toplanır, baş/son sessizlik kırpılır.
3. **Kıyaslanır** — iki eğri tek tuvalde üst üste, üç ayrı puan:

| ölçü | ağırlık | ne bakıyor |
|---|---|---|
| söz | %30 | doğru kelimeleri söyledin mi (tanıma + kelime farkı) |
| tempo | %40 | toplam süre oranı |
| vurgu | %30 | normalize enerji zarfının sapması |

"Yanlış telaffuz" tek bir şey olmadığı için puan tek sayı değil: kelimeleri doğru
söyleyip tempoyu kaçırmak ile vurguyu kaçırmak farklı problemler, farklı çözümleri var.
Tavsiye metni hangi bileşenin düştüğüne göre değişiyor.

**Kelime kelime**: cümledeki her kelimeye dokunulabilir; hocanın ve senin kaydından o
dilim ayrı ayrı ya da arka arkaya çalınır. Sınırlar süreye orantılı tahmin — konuşma
tanıma zaman damgası vermediği için başka yolu yok — ve kaydırıcıyla elle düzeltilebilir.

---

## Kelime baloncuğu

Herhangi bir ekranda İngilizce bir kelimeye dokun: anlamlar, okunuş, **heceleme**,
seviye, **korpus frekansı**, üç hızda dinleme (normal / yavaş / hızlı),
**telaffuz denemesi** (tanıma varsa puanlanır ve SRS'e işlenir), **AI açıklaması**
(IndexedDB'de önbelleklenir, ikinci dokunuşta bedava), geçtiği örnek cümleler,
listeye ekleme, çeviri ve video köprüsü.

**Eş anlamlılar gerçek kullanım sıklığına göre sıralanır.** Kaynak önceliği:
Google Books Ngram (canlı, kendi proxy'inle, 30 gün önbellekli) → `data/ngram-yedek.json`
(10.473 kelime, yaklaşık, arayüzde `~` ile işaretli). Sözlükteki `frekans` alanı ayrıca
gösterilir ama sıralamada kullanılmaz: o, kelimenin bu uygulamanın kendi korpusunda kaç
kez geçtiği — "yaygın bir kelime ama ben hiç görmedim" ayrımını göstermek için duruyor.

---

## Görseller

`img-queries.json` (8.900 eşleme) projede duruyordu ama hiç kullanılmıyordu.
Artık cümlenin sahnesi resimle gösteriliyor — kelimeyi çeviriye değil anlama bağlar.

Kaynak sırası: **Pexels** (yalnız ayarlarda anahtar varsa) → **Openverse** →
**Wikimedia Commons** → **Wikipedia**. Son üçü anahtarsız. Bulunan URL IndexedDB'ye
yazılıyor, aynı cümle bir daha aranmıyor. Görsel bulunamazsa hiçbir şey gösterilmiyor —
boş kutu ya da kırık ikon yok. Ayarlardan tamamen kapatılabilir; kapalıyken hiç istek
atılmaz.

---

## Bulut senkron (isteğe bağlı)

Atlas'ın sunucusu yok. İki cihaz arasında senkron istersen Hesap ekranından **kendi
Firebase projeni** bağlarsın — veri senin projende kalır.

Birleştirme kuralı "son yazan kazanır" değil, **kayıt bazında daha yeni olan kazanır**.
SRS kayıtları son çalışma zamanına, ustalık kayıtları son dokunma zamanına göre;
aynı gün iki cihazda çalışılmışsa günlük sayacın yükseği; listeler tekilleştirilerek
birleşiyor. Bu, iki cihazda çalışan birinin ilerlemesini kaybetmemesi için gerekli —
düz üzerine yazma, bir cihazdaki günü siler.

Tek cihaz kullanıyorsan bunun yerine Veri ekranından yedek almak daha basit.

---

## Hatırlatma

Sunucu yok, push yok. Bir saat seçersin; o saatten sonra uygulamayı açtığında
(ya da açıkken o saate gelindiğinde) o gün henüz çalışmadıysan yerel bildirim gösterilir.
**Hedefini tamamladıysan hiç rahatsız etmez.** Serisi olan kullanıcıya farklı mesaj
gider ("5 günlük serini kaybetme"), aynı gün ikinci kez bildirmez.

---

## Küçük ama vazgeçilmez katmanlar

**iOS ses kilidi.** iOS Safari kullanıcı dokunmadan ses çalmaz. İlk dokunuşta sessiz bir
utterance ve bir AudioContext başlatılıyor. Bu yapılmazsa kullanıcı ilk "Dinle"ye
bastığında hiçbir şey duymuyor ve uygulama bozuk sanılıyor.

**Göz kırpma.** Avatar konuşmadığında 2,6–6,8 saniye arasında rastgele kırpıyor, bazen
çift. Konuşurken ağız kareleri devrede olduğu için karışmıyor.

**Yarım kalan oturum.** Telefonu cebe koyup ertesi gün açan kullanıcı kaldığı yerden
devam eder. Bu olmadan her kesinti baştan başlamak demek. Kayıt 3 gün saklanıyor.

**Çıktı.** Herhangi bir çalışma listesinden yazdırılabilir cümle listesi ya da boşluklu
çalışma kâğıdı + cevap anahtarı üretilir; yazdırma penceresinden PDF olarak kaydedilir.

**AI köprüsü.** Anahtarın yoksa ya da kotan bittiyse: hazır prompt panoya kopyalanır,
seçtiğin sohbet sitesi açılır, dönen cevabı yapıştırınca uygulama normal şekilde işler.

**Koç balonu.** Günde bir kez, duruma göre kendiliğinden konuşur: tekrar yığıldıysa,
alt seviyede boşluk varsa, seri uzunsa ya da güne hiç başlanmadıysa farklı şey söyler.
Sağ alttaki düğmeyle her an çağrılabilir. Kapatılabilir ve kapalı kalır.

**Öğretmen anayasası.** Öğretmenin her AI çağrısında uyacağı kalıcı kurallar tek yerden
yönetilir: anlatım dili, cevap uzunluğu, ton, düzeltme biçimi, kendi odağın, değişmez
kural. Prompt'un her yerde yeniden yazılmaması için ayrı bir katman. Rol yapma
senaryolarına **sızmaz** — test bunu sabitliyor.

---

## Testler

```bash
npm install jsdom
node test.mjs
```

**199 test:** SM-2 davranışı ve sınırları · kısaltma ve zamir eşdeğerliği (27) ·
SRS deposu ve bellek geçersizleştirme · seri koruma mantığı · hata defteri
tekilleştirme · ağız haritalarının iki dilde farkı · `[[ ]]` ayrıştırma ·
persona yalıtımı · ustalık motoru (11) · görsel katmanı (5) · bulut birleştirme (9) ·
hatırlatma koşulları (6) · heceleme ve ngram sıralaması (6) · namaz vakitleri ve
kıble hesabı (11) · öğretmen anayasası ve sızıntı yalıtımı (5) · telafi · oturum
hafızası (4) · çıktı ve AI köprüsü · yedek/göç döngüsü · gerçek veri dosyalarıyla
yükleyici · **43 ekranın hatasız açılışı** (konsol hatası da yakalanır).

Test yazarken yakalanan ve düzeltilen gerçek hatalar:

- `UI.kutla` bileşeni yanlış imzayla çağrılıyordu — kutlama ekranı istatistikle
  açıldığında çöküyordu.
- `Veri.index()` ikinci çağrıda "Kendi Cümlelerim" modülünü tekrar ekliyordu.
- SVG gradyanlarında `stop-color="var(--brand)"` yazılmıştı; sunum niteliğinde CSS
  değişkeni çözülmez, halkalar ve grafikler renksiz kalırdı.
- Kısaltma açılınca `wasn't` iki belirtece bölünüyor (`was` + `not`) ve ikinci parça
  ekrana da basılıyordu: fark satırında "He wasn't **not** ready" gibi hayalet bir
  kelime çıkıyordu.
- İlk yazdığım hatırlatma testleri `Notification.permission = 'default'` olduğu için
  hiçbir şeyi denemeden geçiyordu; izin verilmiş bir sahte nesneyle yeniden yazıldı.
- Kıble mesafesi testinde beklentiyi 2.600 km yazmıştım; doğru değer 2.397 km çıktı.
  Kontrol edince hesap doğru, benim beklentim yanlıştı — test düzeltildi. Kıble açısı
  (151,6°) bilinen değerle örtüştüğü için hesaba güvenildi.

---

## Yayına alma

Statik dosya; olduğu gibi GitHub Pages'e konabilir. Eski uygulamayla aynı yerde
durabilir — anahtar alanı ayrı (`atlas:`), birbirlerinin verisine dokunmazlar.
İlk açılışta veya Ayarlar → Veri → "Eski verimi aktar" ile eski ilerleme taşınır.

Service worker'ı güncellerken `sw.js` içindeki `SURUM` değerini artır; eski önbellekler
otomatik silinir.

---

## Yapay zekâ (isteğe bağlı)

Ayarlar → Yapay zekâ. Groq, Google Gemini veya OpenAI uyumlu bir uç nokta.
Anahtar yalnızca tarayıcıda durur.

Anahtar **yoksa** kapalı olanlar: konuşma senaryoları, serbest cümle çözümlemesi,
cevap hakemliği, modül üretimi, koç yorumu, hata antrenmanının AI ders metinleri,
OCR metin temizleme, otomatik çeviri.

Anahtarsız da tam çalışanlar: modüller, SRS, ustalık motoru, hata antrenmanı (yerel
ders içeriğiyle), modül sınavı, akıllı tekrar, telaffuz, akustik analiz, kelime,
phrasal, kütüphane, OCR, PDF, görseller, raporlar, bulut senkron.
Açıklamalar veri setindeki `aiExplain`, `commonMistake`, `collocations` alanlarından
geliyor.
