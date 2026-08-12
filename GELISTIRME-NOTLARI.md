# DİLHARİTA Geliştirilmiş Sürüm

Bu klasör, kaynak projenin özelliklerini koruyan ve kapsamlı ürün incelemesindeki
öncelikli sorunları uygulama düzeyinde ele alan bağımsız teslim kopyasıdır.

## Uygulanan başlıca değişiklikler

- 52 ekranın tamamına beş bölümlü ortak ana navigasyon eklendi.
- Klavye atlama bağlantısı, görünür odak, eksik başlık/etiket/alt metin yedekleri eklendi.
- Çevrimiçi/çevrimdışı durum göstergesi ve hareket azaltma desteği eklendi.
- İki gerçek HTML tablosuna caption ve sütun kapsamı semantiği eklendi.
- 383 gruptaki cümle kimliği çakışması giderildi; ilk kimlik korunup varyantlar
  `-V2`, `-V3` biçiminde benzersizleştirildi.
- Kimlik değişim kaydı `data/id-migration.json` dosyasına yazıldı.
- Eksik ve İngilizceyle aynı kalan bilinen Türkçe çeviriler düzeltildi.
- Bölünmüş 506 modül, test havuzu, örnek havuzu ve indeks yeniden üretildi.
- `excelveri.json` içindeki tamamen boş ve birebir yinelenen satırlar temizlendi.
- Çeviri rehberinin paragraflaşmış `section` alanları sekiz kanonik bölüme indirildi;
  kök ve `data/` kopyaları eşitlendi.
- Veri eksikleri görünür ve ölçülebilir olsun diye `data/quality-manifest.json` eklendi.
- PWA sürümü yükseltildi ve yeni ortak dosyalar çevrimdışı kabuğa eklendi.
- Yeni regresyon testi `test-product-improvements.mjs` eklendi.

## Günlük kullanıcı yolculuğu düzeltmeleri (v2)

- Öğretmen konuşması değerlendirilince `1 dakika konuş` görevi merkezi planda tamamlanır.
- Konuşma kanıtı hem merkezi plana hem günlük sayaca tek sefer yazılır; aynı görev yeniden önerilmez.
- Tamamlanan ders günlük `Ders` sayacına yinelenmeden yazılır ve sonuç ekranında kayıt teyidi görünür.
- Tamamlanan görev kartları yeşil zemin, yeşil çerçeve ve `✓ Tamamlandı` etiketi alır.
- Kullanıcı çalışmaya başladıktan sonra anlamı “hiç çalışmayacağım” olan `Bugün dinleniyorum` seçeneği gizlenir.
- Tam ekran öğretmen/senaryo sayfalarında ortak alt menü gizlenir; yazma, mikrofon ve gönder düğmeleri artık panelin arkasında kalmaz.
- Masaüstü öğretmen panelinin kullanılabilir genişliği artırıldı.
- PWA önbellek sürümü `v64` olarak yenilendi.
- Bu akış için `test-daily-journey-fixes.mjs` regresyon testi eklendi.

## Bilinçli olarak otomatik doldurulmayan içerikler

Sözlükteki eksik CEFR seviyeleri ile phrasal verb örnek/çekim/eş anlam boşlukları,
yanlış pedagojik bilgi uydurmamak için otomatik tahminle doldurulmadı. Bunlar
`data/quality-manifest.json` içinde kalite kuyruğu olarak ölçülmektedir ve uzman
içerik editörü onayıyla tamamlanmalıdır.

## Çalıştırma

Visual Studio Code terminalinde:

```powershell
python -m http.server 5500
```

Ardından `http://localhost:5500/index.html` adresini açın. Mikrofon ve PWA
özellikleri için uygulamayı doğrudan `file://` ile değil, yerel sunucuyla çalıştırın.

Testler:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-tests.ps1
```
