GÜVENLİ PWA AŞAMA 1

Bu paket, siteyi tekrar bozmadan PWA hissi verir:
- manifest.webmanifest
- icon-192 / icon-512
- pwa-install.js
- statik index.html

Önemli:
- Service Worker YOK.
- Cache YOK.
- Fetch yakalama YOK.
Bu yüzden sayfa tekrar dönüp durmaz.

Kurulum:
1) Zip içeriğini /dilharita/ klasörüne yükle.
2) index.html dosyasını mevcut statik index.html üzerine yaz.
3) manifest.webmanifest, pwa-install.js ve icons klasörünü yükle.
4) Ctrl+F5 yap.
5) Mobil Chrome menüsünden "Ana ekrana ekle / Uygulamayı yükle" de.

Sonraki aşama:
Site 1-2 gün stabil kalırsa, sadece statik dosyalar için kontrollü Service Worker ekleriz.
