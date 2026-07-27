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
