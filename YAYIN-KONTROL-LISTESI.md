# Dil Harita yayın kontrol listesi

1. `powershell -ExecutionPolicy Bypass -File ./run-tests.ps1` çalıştırılır.
2. `node tools/validate-content.mjs` çalıştırılır.
3. Firebase projesinde Authentication alan adları ve sağlayıcıları doğrulanır.
4. `firebase deploy --only firestore:rules` ile kullanıcıya özel kurallar yayımlanır.
5. Önizleme için `firebase hosting:channel:deploy staging`, onaydan sonra `firebase deploy --only hosting` kullanılır.
6. 320 px ve 430 px mobil görünümde giriş, ders, pratik, sohbet, rapor, menü ve yedekleme duman testi yapılır.
7. Gerçek cihazda çevrimdışı açılış, mikrofon, seslendirme ve oturum geri yükleme sınanır.
8. GitHub Actions `Quality` işi yeşil olmadan sürüm yayımlanmaz.

Not: Firebase dağıtımı proje sahibi oturumu gerektirir; yapılandırma dosyaları bu repoda hazırdır.
