ACİL STATİK INDEX PAKETİ

Durum:
- Temizlik yapıldığı halde index dönüp duruyorsa sorun büyük ihtimalle assets/app.js veya uygulama verisi tarafında.
- Bu paket index.html dosyasını statik menü yapar. app.js yüklenmez, bu yüzden dönüp durmaz.

Yapılacaklar:
1) index.html dosyasını mevcut index.html üzerine yaz.
2) pwa-hard-reset.html ve index-app.html dosyalarını da yükle.
3) Şunu aç:
   https://sametegeli-oss.github.io/dilharita/index.html

Test:
- Statik index açılırsa ana site kurtarıldı demektir.
- Eski uygulamayı test etmek için index-app.html aç.
- index-app.html dönerse sorun assets/app.js veya uygulamanın veri yükleme aşamasındadır.

Not:
Bu geçici kurtarma menüsüdür. Ana uygulama app.js ayrıca incelenmeli.
