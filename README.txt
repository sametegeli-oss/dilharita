Yükleme talimatı:
1) Zip içindeki tüm dosyaları aynı klasör yapısı korunacak şekilde GitHub repo'na yükle.
2) chat.html ana seçim ekranıdır.
3) chathotel.html, chatrestaurant.html, chatdoctor.html, chatairport.html ayrı senaryo dosyalarıdır.
4) chat-core.js ortak konuşma/AI/TTS/STT ve foto-kare animasyon motorudur.
5) chat-style.css ortak tasarımdır.
6) assets/avatars/... altında her senaryonun ayrı foto kareleri vardır.

Önemli:
- Bu sürümde göz kırpma ve ağız hareketleri için sadece ayrı ayrı foto dosyaları kullanılır.
- CSS/JS ile uydurma göz kapağı veya ağız overlay sistemi kullanılmaz.
- Konuşma sırasında sıralı olarak mouth-small.webp -> mouth-medium.webp -> mouth-open.webp -> mouth-medium.webp döngüsü oynatılır.
- Göz kırpma sırasında blink.webp çok kısa süre gösterilir.


AI ÖĞRETMEN EKLENDİ:
- chatteacher.html : öğretmen seçim ekranı
- chatteacher1.html : opsiyon 1
- chatteacher2.html : opsiyon 2
- assets/avatars/teacher1 : öğretmen 1 kareleri
- assets/avatars/teacher2 : öğretmen 2 kareleri

Bu öğretmenler daire içindeki mevcut avatar stiline göre tasarlanmıştır.
