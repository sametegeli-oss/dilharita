# Dil Harita — Performans + UX Paketi

## Ölçülen sonuç

| | Önce | Sonra |
|---|---|---|
| `index.html` (başlangıç sayfası) | 448 KB → gzip **333 KB** | 18 KB → gzip **7 KB** |
| `koc-modu.html` | 447 KB | 0.6 KB (yönlendirme) |
| Repo boyutu (.git hariç) | ~38 MB | ~33 MB |
| Ana sayfa açılışı | her seferinde 333 KB HTML indirilir | 7 KB HTML + görseller önbellekten |
| Çevrimdışı | hiç açılmamış sayfa çalışmaz | kabuk önceden önbelleklenir |

## Neden bu kadar küçüldü?

`index.html` ve `koc-modu.html` içinde tek satırda **440.726 karakterlik base64 avatar
kareleri** gömülüydü. Bu 5 karenin md5'lerini `assets/avatars_v3/teacher/` altındaki
dosyalarla karşılaştırdım — **birebir aynı**. Yani aynı görseller repoda hem dosya hem
base64 olarak iki kez duruyordu. Base64 gzip'te de küçülmez ve HTML her açılışta yeniden
indirildiği için her girişte 330 KB boşa gidiyordu.

Artık kareler dosya yolundan yükleniyor:

```js
var AV="./assets/avatars_v3/teacher/";
var FR={ idle:AV+"idle.webp", small:AV+"mouth-small.webp", ... };
```

Tarayıcı bunları bir kez indirip kalıcı önbelleğe alır. İlk karenin gecikmemesi için
`<link rel="preload">` ekledim, diğer 4 kare `prefetch` ile arka planda iniyor.

---

## Dosya dosya ne değişti

**`index.html`** — gömülü blob çıkarıldı; `preload`/`prefetch` eklendi;
`theme-color` meta'sı eklendi (mobilde durum çubuğu artık uygulama rengiyle uyumlu);
avatar `<img>`'ine sabit `width/height` verildi (yükleme sırasında zıplama olmaz);
`ux-boost.js` bağlandı.

**`koc-modu.html`** — `index.html`'in eski bir kopyasıydı (`computeDue` fonksiyonu
eksikti) ve hiçbir sayfadan link verilmiyordu. 569 baytlık yönlendirmeye çevirdim, böylece
eski yer imleri de çalışmaya devam eder.

**`sw.js` → v4** — asıl verim buradan geliyor:
- Kurulumda kabuk (ana sayfa, menü, çekirdek js, avatar kareleri) önbelleğe alınır →
  ilk çevrimdışı açılış da çalışır.
- HTML sayfaları hâlâ **ağ-öncelikli**, yani yüklediğiniz değişiklik anında görünür
  ("yükledim ama değişmedi" sorunu geri gelmez).
- JS/CSS/görsel/JSON için **stale-while-revalidate**: sayfa anında önbellekten açılır,
  yeni sürüm sessizce arka planda iner. v3'te her istek ağı beklerdi.
- Dış origin'lere (Firebase, AI sağlayıcıları) hiç karışmaz.

**`ux-boost.js` (yeni, 39 sayfaya eklenir)**
1. **Üst yükleme çubuğu** — `data/sentences.json` 8,5 MB (gzip 1,7 MB). Şu anda kullanıcı
   bunu beklerken hiçbir geri bildirim almıyor. Artık ince bir ilerleme çubuğu ve
   "📚 sentences.json yükleniyor · 1.2 MB" bilgisi görüyor.
2. **Çevrimdışı bandı** — bağlantı kesilince uyarır, gelince haber verir.
3. **"Güncelleme hazır · Yenile"** şeridi — yeni sürüm indiğinde kullanıcı eski sürümde
   takılı kalmaz.
4. **Dokunma geri bildirimi** — buton/kartlarda hafif basma efekti.
5. **Service worker kaydı** — kayıt eskiden **yalnızca `menu.html`'de** vardı. Oysa
   `manifest.webmanifest` içindeki `start_url` `./index.html`. Doğrudan ana sayfadan
   girenlerde önbellek ve çevrimdışı hiç devreye girmiyordu. Artık her sayfa kaydı garanti eder.

**`menu.html`** — `sw.js?v=2` → `sw.js?v=4`.

**`.github/workflows/daily-report.yml`** — cron `0 2` → `0 5`. Yorum "08:00 Türkiye"
diyordu ama `0 2 * * *` = 02:00 UTC = **05:00 Türkiye**. Rapor maili sabah 5'te gidiyordu.

**`kur.sh`** — ölü/yinelenen dosyaları siler (~4,5 MB) ve `ux-boost.js`'i kalan sayfalara ekler.

---

## Kurulum

```bash
# 1) Bu klasördeki dosyaları repo köküne kopyala
#    (daily-report.yml -> .github/workflows/ altına)
# 2) data-sentences.zip'i repo kökünde aç -> data/sentences/ klasörü oluşur
unzip data-sentences.zip
# 3) Temizlik + enjeksiyon + veri kontrolü:
bash kur.sh
# 4) Doğrulama (isteğe bağlı, node gerekir):
node test-veri.mjs
# 3) Yayınla:
git add -A
git commit -m "Performans + UX: gomulu base64 kaldirildi, sw v4, ux-boost"
git push
```

## Kurulumdan sonra ilk test

Eski service worker tarayıcıda takılı kalabilir. İlk kez şunu yapın:

1. `https://sametegeli-oss.github.io/dilharita/pwa-reset.html` sayfasını açın (repoda mevcut)
2. Sonra ana sayfayı açıp **sert yenileme** yapın (mobilde: uygulamayı kapat/aç)
3. Kontrol listesi:
   - Avatar görünüyor mu, ağzı konuşurken oynuyor mu?
   - Uçak modunda ana sayfa açılıyor mu?
   - `ogren.html` modül seçim ekranı hızlı açılıyor mu, ilerleme çubukları doğru mu?
   - Bir modüle girip cümleler geliyor mu?
   - `seviye-testi.html`, `modul-testi.html`, `tekrar.html`, `hata-defteri.html` çalışıyor mu?
   - Streak / hedef sayaçları eskisi gibi mi?

## 2. AŞAMA: `data/sentences.json` bölündü

8,5 MB'lık (gzip **1,7 MB**) tek dosya, `veri-bol.mjs` ile parçalara ayrıldı:

| dosya | ne için | gzip |
|---|---|---|
| `data/sentences/index.json` | modül listesi + her modülün cümle id'leri | **28 KB** |
| `data/sentences/mod/<slug>.json` | 506 modül parçası, modüle girilince iner | **~5 KB** |
| `data/sentences/test-pool.json` | seviye sınavı havuzu (400/seviye) | **93 KB** |
| `data/sentences/img-queries.json` | cümle → imgQuery eşlemesi | **171 KB** |

### Gerçek transfer karşılaştırması

| işlem | önce | sonra | kazanç |
|---|---|---|---|
| Modül seçim ekranını açmak | 1716 KB | **28 KB** | 61× |
| Bir modülle çalışmak | 1716 KB | **32 KB** | 54× |
| Seviye sınavı | 1716 KB | **93 KB** | 18× |
| Hata defteri / görsel eşleme | 1716 KB | **171 KB** | 10× |
| Tekrar oturumu | 1716 KB | **~35 KB** | 49× |

İlerleme çubukları ve modül sayaçları da artık cümle indirmeden çiziliyor: `index.json`
her modülün id listesini taşıyor, SRS kayıtları bu id'lerle eşleştiriliyor.

### Dönüştürülen 8 tüketici

`ogren.html`, `videopractice.html` (index + tembel modül yükleme),
`tekrar.html` (`DHSent.byIds` — yalnız vadesi gelenlerin modülleri),
`seviye-testi.html` (hafif havuz), `modul-testi.html` (URL'deki tek modül),
`image-addon.js` + `hata-defteri.html` (hazır imgQuery eşlemesi),
`koc.js` (yalnız id'ler yettiği için index).

### Doğrulama

`test-veri.mjs`, parçalı verinin eski tek dosyayla **birebir aynı** sonucu verdiğini
kanıtlıyor — 506 modül parçasının tamamı, sıralama dahil, kaynaktan süzülmüş hâliyle
karşılaştırılıyor. 17 testin hepsi geçiyor:

```
node test-veri.mjs
```

> Test yazarken bir hata yakaladım: `imgQuery` eşlemesinde 8934 kayıt için 8281 anahtar
> çıkıyordu. Sebep veri kaybı değil — 577 İngilizce cümle birden fazla modülde tekrar
> ediyor ve **eski kod da** aynı anahtarı son değerle eziyordu. Yani davranış birebir korundu.

### `data/sentences.json` silinmedi

Parçaların tek doğruluk kaynağı o dosya; `veri-bol.mjs` ondan üretiyor. Ayrıca aşağıdaki
sayfalar hâlâ onu kullanıyor, bu yüzden silmek bozar. Çalışma anında hiçbir dönüştürülmüş
sayfa artık onu istemiyor.

### Henüz dönüştürülmeyenler (çalışıyorlar, sadece hızlanmadılar)

İlk incelemede `head -10` yüzünden listeyi eksik görmüştüm; toplam 14 tüketici var, 8'ini
dönüştürdüm. Kalan 6'sı eski dosyayı indirmeye devam ediyor:

| dosya | neden bekletildi | önerilen yol |
|---|---|---|
| `practice.html` | Ana pratik sayfası. Tüm cümleler üzerinden "vadesi gelen" listesi çıkarıyor ve OCR ile çalışma anında sanal modül ekliyor — 6 çağrı noktası var. Aceleyle dokunulacak yer değil. | index'ten id'ler → `byIds(vadesi gelenler)` |
| `kelime-ogren.html` | Kelime için örnek cümle arıyor | kelime→cümle id eşleme dosyası |
| `word-popup.js` | Kelime baloncuğu için cümle araması | aynı eşleme dosyası |
| `lesson-engine.js`, `harita.html` | Veri yolu yapılandırmadan geliyor | yapılandırmayı loader'a bağla |
| `index-app-ogretmen-analiz-buttons.js` | Öğretmen analizi | `byIds` |

Bunların hepsi `sentences-loader.js`'in güvenlik ağı sayesinde sorunsuz çalışır: parça
bulunamazsa otomatik olarak eski dosyaya düşer.

---

## Sırada bekleyenler

1. Yukarıdaki 6 tüketicinin dönüştürülmesi — en değerlisi `practice.html`.
2. **Firebase config'in tek dosyaya toplanması** — aynı anahtar 6 dosyada tekrar ediyor,
   proje değişiminde 6 yeri düzeltmek gerekir.
3. **`app.js` (218 KB) ve `assets/app.js` (299 KB)** — ikisi de minified bundle, içerikleri
   farklı, kaynak kod repoda yok. Hangisinin canlı olduğunu netleştirip diğerini silmek gerek.
4. **`teacher.html` / `teacher1.html`, `chatteacher{,1,2}.html`** ailelerinin birleştirilmesi.

---

# 3. AŞAMA: kullanıcı deneyimi

## Önce iki düzeltme

**1) "Seviye testi sonucu hiçbir yere kaydedilmiyor" demiştim — yanlıştı.**
Sonuç kaydediliyor: `DHTeacherPolicy.set("seviye", lvl)` ile
`dh-teacher-policy-v1` içine yazılıyor ve bulut yedeğine de giriyor. İlk
taramamda `setItem` aradığım için kaçırdım. Doğru olan tespit daha dar:
sonucu **yalnızca AI öğretmen** okuyor (`lesson-engine.js`, `teacher-bubble.js`).
Modül seçici, koç ve ders akışı seviyeyi hiç sormuyordu. Ayrıca
`gemini-lesson.js`'in okuduğu `dh-level` anahtarını gerçekten hiçbir kod
yazmıyordu; o kontrol her zaman boş dönüyordu.

**2) "İlerleme 11 ayrı yerde, birleştiren yok" demiştim — bu da eksikti.**
`progress-engine.js` zaten `window.DHProgress`'i tanımlıyor
(NEW/LEARNING/LEARNED, `recordResult`, `getStatus`, `summaryAll`, bulut aynası)
ve ilgili 15 sayfada yüklü. Aynayı da o dolduruyor.
İlk yazdığım `progress.js` bunu **ezip** `basla.html`'i bozacaktı; fark edip
sildim. Yerine çakışmayan `profile.js` var — `window.DHProgress`'e dokunmuyor.
Gerçek boşluk şuydu: başlangıç sayfası `index.html` ve `koc.js` bu katmanı
hiç yüklemiyor, ve katman seviye/hedef kavramını içermiyor.

## Eklenenler

**`profile.js` (yeni)** — `window.DHProfile`. Seviye, amaç, günlük hedef ve
sıradaki modül. `setLevel()` üç yere birden yazıyor: profil, `dh-level`
(gemini-lesson.js nihayet çalışıyor), öğretmen anayasası. `nextModule()`
üç ilerleme deposunu da (`prog:`, `sentence:`, `srs:`) okuyor ve kullanıcının
seviyesinden başlıyor — koç mantığı yalnız ikisini okuyordu.

**`basla.html` + `onboarding-guard.js` (yeni)** — üç adımlı ilk kurulum:
amaç → seviye (bilmiyorsan teste yönlendirir, dönüşte kaldığı yerden devam eder)
→ günlük hedef. Bitince seviyeye uygun ilk modüle götürür. Kapı yalnızca
`index.html`'de; kullanıcıyı uygulama içinde kilitlemiyor. Eski kullanıcıyı
(seviyesi veya çalışma geçmişi olan) hiç rahatsız etmiyor. "Atla" kalıcı.

**`seviye-testi.html`** — sonuç artık `DHProfile.setLevel()` ile de kaydediliyor,
yani öğrenme akışı da görüyor. Kurulumdan gelindiyse kuruluma dönüyor.

**`index.html`** — günlük hedef sabit kodlu `var GOAL=5` değil, kullanıcının
seçtiği değer.

**`speech-fallback.js` (yeni)** — iOS Safari'de `SpeechRecognition` yok.
Eskiden "Tarayıcı ses tanımayı desteklemiyor" uyarısı çıkıp bir **yazı kutusu**
açılıyordu; telaffuz alıştırmasını yazıya çevirmek alıştırmanın amacını bitiriyor.
Artık gölgeleme paneli açılıyor: dinle → kendini kaydet (MediaRecorder, iOS 14.3+)
→ ikisini arka arkaya dinle → kendini değerlendir. Puan SRS'e ve
`DHProgress.recordResult`'a işleniyor. Alıştırma iPhone'da da sesli kalıyor.
Safari `audio/webm` desteklemediği için mime türü otomatik seçiliyor.

## Yapmadığım birleştirme ve nedeni

`ogren.html` ile `videopractice.html` %99 aynı (77 KB'lık motor iki kez).
Tek fark: videopractice `mode-toggle.js` yüklüyor. Onu okudum — bu dosya
video ekranı ile React foto uygulaması (`index-app`) arasında `postMessage`
ile cümle senkronu yapıyor ve davranışını `location.pathname`'e göre
değiştiriyor. Yani fark kozmetik değil, kaynak kodu repoda olmayan bir
bundle'la konuşan bir protokol.

Tarayıcı olmadan bunu test edemem. İki büyük etkileşimli sayfayı, test
edemediğim bir senkron protokolü üzerinden birleştirmek makul görünen ama
sessizce bozan türden bir değişiklik olurdu. Doğru yol: ortak motoru
`practice-engine.js`'e çıkarıp iki sayfayı ince kabuklara indirmek — ayrı bir
tur, tarayıcıda elle test ederek.

Diğer "kopya" sandıklarım kopya değilmiş:
`teacher.html`/`teacher1.html` yalnız %50 benziyor (farklı sayfalar),
`chatteacher1/2.html` 1 KB'lık avatar seçici kabuklar — kasıtlı, borç değil.

## Testler

```
node test-veri.mjs     # veri parçalama (17 test)
node test-profil.mjs   # seviye/profil/sıradaki modül (17 test)
```

`test-profil.mjs` iki gerçek hata yakaladı: kodda `window.X` ile kontrol edip
çıplak `X` ile çağırmıştım (tarayıcıda çalışır, kırılgan), ve `window.DHProgress`
çakışmasını test olarak sabitledim — bir daha ezilirse test kırılır.

## Kurulumdan sonra ek kontrol

- Tarayıcı verisini temizleyip ana sayfayı aç: `basla.html` açılmalı.
- Kurulumu bitir: seviyene uygun bir modüle düşmelisin (A1-M01'e değil).
- Mevcut kullanıcıyla aç: kurulum ekranı **çıkmamalı**.
- iPhone/Safari'de bir cümlede mikrofona bas: yazı kutusu değil, kayıt paneli açılmalı.
