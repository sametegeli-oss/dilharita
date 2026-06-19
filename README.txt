HATA DEFTERİ + KULLANICI HATALARINDAN ÖĞRENEN SİSTEM

Yükle:
- learning-error-system.js
- hata-defteri.html
- practice.html
- videopractice.html

Yaptığı iş:
1) Practice ekranında kullanıcı yanlış/eksik cevap verdiğinde hata defterine kayıt açar.
2) Video Practice ekranında telaffuz/okuma skoru düşükse hata defterine kayıt açar.
3) Hataları IndexedDB içinde saklar; localStorage yedeği vardır.
4) Hata tiplerini otomatik etiketler:
   - missing-word
   - extra-word
   - auxiliary-missing
   - article
   - pronoun
   - past-simple
   - present-continuous
   - question-order
   - pronunciation
5) hata-defteri.html ekranında toplam hata, yüksek öncelik, modül ve hata tipi analizini gösterir.
6) JSON dışa aktarma ve defteri temizleme var.

Assets yüklemene gerek yok.

Not:
Bu paket çekirdek birinci aşamadır. Sonraki aşamada “Akıllı Tekrar” ekranı bu hata kayıtlarını kullanıp kullanıcıya otomatik tekrar listesi hazırlayacak.
