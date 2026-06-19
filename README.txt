V9 PAKETİ

DÜZELTMELER
1) Otel ve öğretmen avatarlarında gövde/arka plan kayması için tam frame değiştirme yöntemi bırakıldı.
   Artık ana resim sabit kalır; göz kırpma ve ağız hareketi ayrı foto karelerinden kesilen gerçek parçalarla yapılır.
   Bu sahte çizim overlay değildir; parçalar üretilen gerçek foto karelerinden alınır.

2) Kadın/erkek ses ayrımı:
   hotel, doctor, airport = female
   restaurant, teacher1, teacher2 = male
   Tarayıcı destekliyorsa uygun İngilizce erkek/kadın sesi seçilir; destek yoksa pitch ile ayrıştırılır.

3) Teacher seçenekleri artık farklıdır:
   chatteacher1.html = öğretmen opsiyon 1
   chatteacher2.html = öğretmen opsiyon 2
   Seçim localStorage selectedTeacherAvatar alanına kaydedilir.

4) Video sayfaları için teacher avatar helper:
   teacher-video-avatar.js
   Video sayfasında kullanmak için:
   <script src="./teacher-video-avatar.js"></script>
   Sonra avatar görünecek yere:
   <div data-teacher-avatar></div>
   veya
   <img data-teacher-avatar>

5) chat.html üstünde ana menüye dönüş butonu var:
   index.html

YÜKLEME
Zip içindeki tüm dosyaları klasör yapısını bozmadan GitHub repo'na yükle.
Yükledikten sonra Ctrl+F5 yap.


V11 GÜNCELLEME
- Tüm senaryolara mouth-o.webp eklendi.
- Ağız animasyonu tam foto karelerle yapılır; O sesi için mouth-o.webp kullanılır.
- Konuşma sırasında metindeki o/u/ö harfleri ve benzer yuvarlak sesler mouth-o.webp karesine yönlendirilir.
- Tarayıcı cache karışmasın diye JS/CSS çağrıları v=11 oldu.


V12 GÜNCELLEME
- Tüm karakterlerde mouth-o.webp artık mouth-small.webp tabanlı ayrı bir tam foto kare olarak ayarlandı; mouth-open ile aynı değil.
- Teacher1 ve Teacher2 tam kareleri idle karesine göre hizalandı; sağa-sola kayma azaltıldı.
- assets/avatars_v3/teacher/ klasörü yeni teacher1 ile güncellendi.
- Video/kütüphane/çalışma/teacher-chat gibi sayfalarda yeni teacher avatarını zorla kullanmak için teacher-global-avatar.js eklendi.
- teacher-video-avatar.js de sadece yeni teacher avatarlarını kullanacak şekilde güncellendi.
