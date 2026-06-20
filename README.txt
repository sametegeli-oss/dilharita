ESKİ GÖRSEL YAPISI GERİ BAĞLAMA

Haklısın: Son eklenen index-app-photo-addon.js geçici ve yanlış bir fotoğraf seçme sistemi kuruyordu.
Bu paket onu kaldırır.

Yapılan:
1) index-app-photo-addon.js bağlantısı kaldırıldı.
2) Eski yapının kullandığı image-addon.js tekrar index-app.html içine bağlandı.
3) teacher-addon.js tekrar bağlandı.
4) Öğretmene Sor / Zayıf Analiz düğmeleri korunur.

Yüklenecek:
- index-app.html
- index-app-ogretmen-analiz-buttons.js

ÖNEMLİ:
- index-app-photo-addon.js dosyasını GitHub'dan sil veya artık kullanma.
- image-addon.js ve teacher-addon.js zaten projede varsa tekrar yüklemene gerek yok.
- Eski görsel arama cümlesi mantığı image-addon.js tarafından çalıştırılacak.

Sonra Ctrl+F5 yap.
