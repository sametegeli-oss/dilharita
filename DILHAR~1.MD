# Dil Harita — Tasarım Yönü

Bu belge görsel ve etkileşim yönünü tanımlar; kod planı değildir. Framework seçiminden
bağımsızdır — token katmanı hangi araca geçilirse geçilsin taşınır.

Mevcut durumun tanısı, iddia değil ölçüm: `index.html` ve `ders.html` iki farklı
lacivert paleti kullanıyor; toplam 7 evre rengi + altın + yeşil + mor eşzamanlı
yarışıyor; ikonlar emoji; köşe yarıçapı 12/14/18/22/999 karışık; `practice.html`
üç ayrı kırılım noktasında `!important` yığınıyla kendi kendini eziyor. Sorun
"yeterince modern değil" değil — **tek bir görsel dil yok.**

---

## 0. Token katmanı

Her şeyin ön koşulu. Sayfa-içi `<style>` blokları bitmeden diğer dört madde
uygulanamaz, çünkü her düzeltme 48 dosyada tekrar edilmesi gereken bir iş olur.

### Renk

**Nötr rampa — arayüzün %90'ı**

| Token | Değer | Kullanım |
|---|---|---|
| `ink-900` | `#0F1417` | Ana metin |
| `ink-700` | `#2A3138` | İkincil metin, koyu yüzey |
| `ink-500` | `#5A646D` | Yardımcı metin |
| `ink-400` | `#99A2AA` | İpucu, pasif ikon |
| `ink-200` | `#D6DCE1` | Kenarlık |
| `ink-100` | `#EDF0F2` | Dolgu yüzey |
| `ink-000` | `#FFFFFF` | Kart |

**Anlamlı renkler — dekorasyon için asla**

| Token | Değer | Yalnızca |
|---|---|---|
| `brand` | `#0F7A5A` | Birincil eylem, aktif adım, ilerleme |
| `ok` | `#127A4B` | Doğru cevap |
| `err` | `#B3392E` | Yanlış cevap |
| `streak` | `#C2760C` | Seri — tek yerde |

Kural: bir renk ekrana çıkıyorsa bir şey **söylüyor** olmalı. 7 evre rengi
(gramer/ısınma/tekrar/yeni/pekiştirme/video/telaffuz) nötr çipe iner; yalnızca
o an aktif olan evre `brand` alır. Evreyi ayıran şey renk değil, etiket ve sıra.

### Mod

Açık mod **varsayılan çalışma yüzeyi** olmalı. Uygulama şu an yalnızca koyu ve
kullanıcı 20 dakika boyunca lacivert üstünde 15.5px İngilizce metin okuyor.
Koyu mod korunur ama seçenek olarak.

### Tipografi

Tek ölçek: `12 · 13 · 16 · 20 · 28 · 36`. İki ağırlık: `400` ve `500`.

| Rol | Punto/Ağırlık |
|---|---|
| Çalışma cümlesi (İngilizce) | 28 / 500 |
| Ekran başlığı | 20 / 500 |
| Çeviri, gövde | 16 / 400 |
| Etiket, meta | 13 / 400 |
| İpucu | 12 / 400 |

Hiyerarşiyi renk ve arka plan kutusu değil punto kurar. İngilizce cümle her
çalışma ekranında **ekrandaki en büyük öğe** olmalı — istisnasız.

Türkçe aksanlı karakterler (ı ş ğ ç ö ü İ) tam kapsanmalı; değişken bir sans
(Inter, Geist, Source Sans 3) yeterli.

### Biçim

- Köşe: `8` (kontrol) · `12` (kart) · `999` (çip). Başka değer yok.
- Kenarlık: `0.5px solid ink-200`. Vurgu için `ink-400`.
- Yükseklik gölgeyle değil kenarlık + yüzey farkıyla. Gölge yalnızca odak halkası.
- Gradyan yok. Conic-gradient avatar halkası, buton gradyanları, glow gölgeleri kalkar.

### İkon

Emoji ikon olarak kullanılmayacak. Çizgi ikon seti (Lucide veya Phosphor),
1.5px kalınlık, `currentColor`, 20px. Emoji yalnızca iki yerde kalır:
seri alevi ve kutlama anı.

Gerekçe teknik: emoji platformdan platforma farklı render edilir, tek renge
boyanamaz, optik ağırlığı kontrol edilemez, hizalama metriği yoktur. Tek başına
bu değişiklik arayüzü diğer tüm maddelerden daha fazla modernleştirir.

### Hareket

- Süreler: `120ms` (geri bildirim) · `200ms` (geçiş) · `320ms` (giriş)
- Kolaylaştırma: `cubic-bezier(0.2, 0, 0, 1)` — tek eğri
- `prefers-reduced-motion` her animasyonda karşılanır

---

## 1. İlk kullanım deneyimi

**İlke: değer önce, yapılandırma sonra.**

- **Giriş duvarı kalkar.** `auth-guard.js` şu an her sayfada oturum yoksa
  `login.html`'e yönlendiriyor. Kullanıcı ürünü görmeden kayıt ekranı görüyor.
  Anonim başlanır; hesap ilk senkron ya da ikinci cihaz ihtiyacında istenir.
- **Kurulum bir kazanımla biter, ayar özetiyle değil.** Üç soru (amaç, seviye,
  hedef) kalır ama dördüncü adım "işte ilk cümlen" olur ve kullanıcı kurulumdan
  bir doğru cevapla çıkar.
- **Seviye testi kurulumdan çıkar.** "Seviyeni biliyor musun?" yeni kullanıcının
  cevabı olmayan bir sorudur. Test, koç 3. günde önerdiğinde yapılır — o zaman
  zaten bir miktar veri vardır ve öneri anlamlıdır.
- **Tek soru = tek ekran.** Yazı girişi yok, dokunma hedefi ≥56px, ilerleme
  noktaları görünür, "atla" küçük ama erişilebilir.

---

## 2. Modern ve sade arayüz

Yukarıdaki token katmanı uygulandığında bu madde büyük ölçüde çözülür. Ek olarak:

- **Ekran başına tek birincil eylem.** Şu an koç ekranında iki eylem butonu +
  soru kutusu + "tüm modüller" + hedef pill + ses düğmesi eşzamanlı.
- **Kutu içinde kutu kalkar.** Hiyerarşi boşlukla kurulur, çerçeveyle değil.
- **Avatar halkası küçülür.** 188px conic-gradient halka ekranın merkezini
  yiyor; içerik değil dekorasyon. 40-56px yeterli — koçun varlığı hissedilsin
  ama sahneyi kaplamasın.
- **Mikro-kopya sadeleşir.** "Bugün ne çalışacağına koçun karar verir — sen
  sadece onu dinle 👇" gibi satırlar ürünü açıklıyor; iyi tasarım açıklama
  gerektirmez.

---

## 3. Avatar akıcılığı

### Mevcut teknik ve sınırları

Şu an `setInterval` ile `<img>.src` 40–170ms aralıkta değiştiriliyor ve
`speechSynthesis.onboundary` ile hizalanıyor. Üç yapısal sınır:

1. **Her kare yeni bir decode.** `src` değişimi tarayıcıyı yeniden çözmeye
   zorlar; takılma buradan gelir. Çözüm: tek sprite sheet + `background-position`
   ya da tek `<canvas>`. Decode bir kez olur.
2. **Kareler arası geçiş sert.** Ayrık karelerde ara değer yok. Çözüm: iki
   katman, 50–70ms çapraz geçiş. Ağız şekli sıçramaz, akar.
3. **Zamanlama kayar.** `setInterval` sürüklenir ve `onboundary` her platformda
   tetiklenmez (iOS Safari'de güvenilmez). Çözüm: `requestAnimationFrame` ile
   ses zaman çizgisine karşı hizalama; `onboundary` birincil kaynak değil
   düzeltici olarak kullanılır.

### Tasarım tarafı — asıl fark burada

Akıcılık hissinin çoğu ağızda değil **boşta duruşta**:

- **Nefes.** 2.5–4sn periyotta ±%1.5 ölçek. Tek başına bu, karakteri
  "donmuş resim" olmaktan çıkarır.
- **Göz kırpma düzensizleşir.** Şu an sabit 3800ms — makine gibi. 2.8–6.2sn
  arası rastgele, ve tek kare değil üç kare (yarım → kapalı → yarım), 120ms.
- **Hafif baş salınımı.** ±1.5°, 6–9sn periyot, nefesle senkron değil.
- **Konuşma sonu yumuşar.** Ağız `idle`'a sıçramaz, 200ms'de kapanır.
- **Daha az kare, daha akıcı.** 15 viseme yerine iyi harmanlanmış 8 kare
  gözle daha akıcı görünür — geçiş kalitesi kare sayısından önemlidir.

---

## 4. Kademeli açılım

**İlke: her şeyi göstermek özellik zenginliği değil, karar yükü.**

- **Ana ekranda tek şey var: bugünün planı.** Şu an `menu.html` yaklaşık 25
  giriş noktasını aynı anda gösteriyor.
- **"Kitaplık" tek yüzey, üç niyet grubu:** Öğren · Pratik · Analiz.
  Düz ızgara ya da alfabetik liste değil — kullanıcı özellik adıyla değil
  niyetle arar.
- **Keşif menüden değil koçtan.** Bir modül ilgili hâle geldiğinde koç tanıtır:
  "hata defterin doldu, on dakikalık bir antrenman çıkarayım mı?". `koc.js`
  bunu yapacak veriye zaten sahip.
- **Kilit değil gizleme.** Kullanılmayan modüller "Daha fazla" altında kalır;
  erişim engellenmez, dikkat korunur.
- **Varyantlar tekilleşir.** `teacher` / `teacher1` / `teacher3`,
  `chat` / `chat1` / `chatteacher1` / `chatteacher2` — kullanıcının hangisinin
  güncel olduğunu bilmesi gerekmemeli. Tek yüzey + parametre.

---

## 5. İlerleme ve motivasyon

### Üç ilke

**Borç değil emek göster.** "324 tekrar bekleyen" bir borç bildirimidir ve
kullanıcıyı kaçırır. Yerine "bugün 12" ve tamamlanınca "kalan yarına
porsiyonlandı". `tekrar.html` bunu zaten doğru yapıyor (`dh-tekrar-gun-<gün>`,
dondurulmuş hedef, tuğla sayacı, `7/12 · 5 kaldı`) — bu dil tüm ekranlara
taşınmalı, tersi değil.

**Ufuk ver.** Günde 5 cümle hedefi ile 9417 cümlelik havuz arasında hiçbir
varış noktası yok. "A2'ye 9 hafta" mevcut tempodan hesaplanabilir ve tek
başına en güçlü motivasyon öğesidir.

**Haftalık ritim, günlük mükemmellik değil.** Seri kırılması en büyük terk
sebebidir. Yedi kutu ve "5/5 hedef tuttu · 1 dinlenme günü" — dinlenme günü
planın parçası olsun, başarısızlık değil.

### İmza öğe

`rapor.html`'deki **kişisel unutma eğrisi** bu üründe rakiplerde olmayan tek
şey: kullanıcının kendi verisinden çıkarılmış Ebbinghaus eğrisi. Şu an bir
rapor sayfasının dibinde duruyor. İlerleme ekranının merkezine alınmalı ve
tekrar aralıklarıyla ilişkisi açıkça söylenmeli — "4. günde hatırlaman %52'ye
düşüyor, tekrar aralığın buna göre ayarlandı." Bu cümle hem motivasyon hem
ürünün zekâsının kanıtı.

### Ekran başına tek kahraman metrik

Şu an koç kartı üç çubuk + 7 günlük ızgara + adım listesi + haftalık hedef
notunu aynı anda gösteriyor. Her ekran tek bir şeyi büyük söylesin,
gerisi ikincil kalsın.

---

## Korunması gerekenler

Yeniden yazımda kaybolmaması gereken, doğru kurulmuş şeyler:

- **Öğretmen anayasası** (`teacher-policy.js`) — pedagojinin okunabilir ve
  düzenlenebilir olması ürünün en ayırt edici yanı.
- **Evre şeridi** kavramı (`ders.html`) — dersin yapısını görünür kılıyor.
- **Tuğla sayacı** (`tekrar.html`) — planlanan/yapılan/kalan üçlüsünü
  doğru kuran tek ekran.
- **Unutma eğrisi** (`rapor.html`).
- **Beceri ayrımı** (`mastery-engine.js`) — tanıma/dinleme/hatırlama/üretim/
  akıcılık ayrı ölçülüyor ve öğrenciye sayı değil etiket gösteriliyor.

## Sıralama

Token katmanı önce; diğer dördü ona bağlı. Ardından etkiye göre:
ilk kullanım → kademeli açılım → ilerleme ekranları → avatar. Avatar en son,
çünkü en görünür ama en az terk sebebi olan madde.
