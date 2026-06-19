ACİL AÇILIŞ DÜZELTME

Sorun büyük ihtimalle önceki PWA / service worker / MutationObserver düzeltmelerinden kaynaklandı.
Bu paket PWA'yı geçici olarak devre dışı bırakır ve siteyi tekrar açılır hale getirir.

Yapılacaklar:
1) Zip içindeki index.html dosyasını mevcut index.html üzerine yaz.
2) sw.js dosyasını mevcut sw.js üzerine yaz.
3) pwa-reset.html dosyasını da yükle.
4) Tarayıcıda şunu aç:
   https://sametegeli-oss.github.io/dilharita/pwa-reset.html
5) Temizlendi mesajından sonra:
   https://sametegeli-oss.github.io/dilharita/index.html
   adresine git ve Ctrl+F5 yap.

Not:
PWA'yı sonra daha güvenli şekilde tekrar ekleriz. Önce siteyi ayağa kaldıralım.
