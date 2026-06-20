PRACTICE SAĞ DÜĞMELER KAYBOLMA FIX

Sorun:
Kontrol et'e basınca Zor / Normal / Kolay / İleri düğmeleri sağ sütunda görünüp kayboluyordu.

Sebep:
MutationObserver ve placeholder yazma mantığı düğmeleri taşıdıktan sonra sağ sütunu yeniden boş gösteriyordu.

Düzeltme:
renderFeedback içinde düğmeler doğrudan .pd-grade-dock içine taşınıyor ve eventler orada bağlanıyor.
Placeholder artık düğmeler varsa tekrar yazılmıyor.

Yükle:
practice.html dosyasını mevcut practice.html üzerine yaz.
Ctrl+F5 yap.
