# AI açıklamalarının bulut izni

GitHub Pages dosyalarını yüklemek Firestore güvenlik kurallarını yayımlamaz.
Bu klasörde bir kez aşağıdaki komutu çalıştırın:

```powershell
firebase deploy --only firestore:rules
```

Bu işlem `sentencemode` projesine `firestore.rules` dosyasını yayımlar.
Kural yalnız oturum açmış kullanıcının kendi `users/{uid}` alanını okumasına
ve yazmasına izin verir. API anahtarları bu koleksiyona gönderilmez.
