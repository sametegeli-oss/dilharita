# Dil Haritası / WordMode - Mevcut Dosyalar Düzeltilmiş v3

Bu paket, kullanıcının verdiği mevcut dosya yapısı korunarak hazırlandı.

## Yükleme
GitHub reposundaki eski dosyaları silip bu klasörün içindeki dosyaları olduğu gibi yükleyin. Ana dosya `index.html` olmalıdır.

## Düzeltmeler
- Mevcut `index.html`, `legacy-app.js`, `sentence-mode-core.js`, `fixes.js`, `free_features.js`, `style.css` korundu.
- Bozuk/eksik ikonlar gerçek PNG olarak `assets/` klasörüne eklendi.
- Service worker cache adı yükseltildi ve data dosyaları cache listesine eklendi.
- CSS/JS linklerine cache-bust eklendi.
- `fixes.js` sonuna küçük stabilizer eklendi: cache temizleme fonksiyonu, tek aktif ekran koruması, araçlar paneli dış tıkla kapanma.

## İlk açılış
Eski cache yüzünden sorun görürseniz tarayıcı konsolunda şunu çalıştırabilirsiniz:

```js
WM_FORCE_UPDATE()
```
