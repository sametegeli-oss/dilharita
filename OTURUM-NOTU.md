# Oturum notu — yeni oturum için hatırlatma (10 Kasım 2026)

> Yeni oturumdaki Claude için: Önce bu dosyayı oku. Kullanıcıyla **Türkçe** konuş.
> Uygulamanın kullanıcıları 50–80 yaş arası; arayüz büyük, sade ve açık yazılı olmalı.

## Proje
- Depo: `sametegeli-oss/dilharita`. Statik site, GitHub Pages'te yayında: https://sametegeli-oss.github.io/dilharita/
- Yayın: `main`'e push edince "pages build and deployment" çalışır (~1 dk).
  - "Quality" iş akışı eski bir sebepten (Windows kısa adları) hep başarısız olur; görmezden gel.
- Önbellek kırma: değişen betiğin `?v=` değerini artır ve `sw.js` içindeki `SW_VERSION`'u bir artır. Şu an `dh-sw-v379`.
- Commit: `git -c user.email=noreply@anthropic.com -c user.name=Claude commit`, sonra `git pull --rebase origin main && git push origin HEAD:main`.

## Kesin kurallar (kullanıcının istekleri)
- **Bağlantısız sayfaları, eski kopyaları ve yinelenen avatarları SİLME**; önce kullanıcıya sor. Karar hâlâ bekliyor.
- Kullanıcı verisini silen ya da değiştiren düğmelere basma: "Bunu tekrar sorma", "Bildim", "Modülü sil", seviye testini bitirme, PDF indirme.
- Sistem veya site izni verme (mikrofon, dosya). Reddetmek gerekirse reddet.
- API anahtarlarının değerlerini okuma, kopyalama ya da yazma; kullanıcı kendisi yapıştırır.

## Test araçları
- Yerel sunucu: depo klasöründe `python3 -m http.server 8767 --bind 127.0.0.1`.
- Playwright: `/opt/npm-tools/node_modules/playwright/index.mjs`.
- Mobil düğme tarayıcısı: `/home/claude/tools/mobiltara.mjs`.
  - Yeni oturumda bu dosya yok; gerekirse yeniden yaz.
  - Yaptığı iş: 360 px genişlikte her düğmeye taze sayfada tıklar; taşma, çakışma, küçük hedef ve JS hatalarını raporlar.
- **LDPlayer (Android öykünücü), bilgisayar kullanımı ile:**
  - Erişim: önce `computer_resolve_access`, sonra `computer_request_access` ile LDPlayer9.
  - Telefon ekranı yaklaşık x 160–580, y 25–765 aralığında.
  - Yakınlaştırma: `zoom [160,25,580,765]` ve `scale 0.6`. Görüntüdeki koordinatı ekrana çevirmek için ×1.265 çarp, x'e 160, y'ye 25 ekle.
  - Kaydırma: `left_click_drag` kullan; tekerlek çalışmaz.
  - Klavye TR-F; yazı yazmak güvenilir değil.
  - Sayfa yenileme ikonu yaklaşık (276,95).
  - Sonunda `computer_release_lock` çağır.

## Bu oturumda yapılanlar (hepsi yayında)
- **Bulut senkronu:** API anahtarları artık şifreli kasa ile cihazlar arasında taşınıyor (`cloud-sync.js`).
  - Kasa: PBKDF2 + AES-GCM, Firestore'da `settings/{uid}.__keyVault`.
  - Menüde "Anahtar kasası" bölümü var.
- **Yeni ücretsiz AI sağlayıcıları:** Mistral ve OpenRouter eklendi (`ai-providers.js`, `teacher.html`).
  - GitHub Models tarayıcıdan çalışmıyor (CORS engeli).
  - Mistral'in ücretsiz planında API yok.
  - OpenRouter anahtarı ("Dil Harita") kullanıcı tarafından yapıştırıldı.
- **Sohbet hızı ve güvenilirliği:**
  - Önce Groq/Cerebras deneniyor (hızlı mod), Gemini yedekte.
  - Sağlayıcı başına 18 sn, toplamda 45 sn süre sınırı.
  - Devre dışı bırakılan anahtarlar 6 saat sonra kendiliğinden yeniden açılıyor.
  - Gemini'nin düşünce parçaları, yarım cevapları ve JSON kırıntıları artık ekrana sızmıyor.
- **LDPlayer mobil denetiminde düzeltilenler:**
  - Tekrar: "Devam" ve "Kontrol et" düğmeleri.
  - Rapor ve Hata Defteri: hata türleri Türkçe.
  - Kütüphane: araç çubuğu telefonda 2 satır.
  - Video: "Sesli oku" düğmesi tam boy.
  - Telaffuz stüdyosu ve kullanım kılavuzu: çakışmalar giderildi.
  - Ses seçimi sayfası.
  - Seviye rozeti.
  - İngilizceyi Yaşa: "Sahneye dön" düğmesi, bozuk cevap süzgeci, öneriler öğrencinin ağzından.
  - Gemini karnesi: üstte "Kapat" düğmesi.
  - Kolay görünüm: kapatmadan önce onay soruyor.
  - Kelime Öğren: 8,5 MB'lık cümle yedeği kaldırıldı (telefonda sekmeyi çökertebiliyordu).
  - Havaalanı sohbeti: çift selamlama (betikler iki kez yükleniyordu).
  - Doktor kartı: "Kadın doktor" yazıyor.
  - "Hatalarım" düğmesi artık sonucu söylüyor.
  - Öbek fiil alıştırması: sadece öbeği içeren cümleler, çekimli biçim de doğru, "Sonraki" görünür.

## Kalanlar / yapılacaklar
1. **Kullanıcının kendi yapacakları:**
   - LDPlayer'daki uygulamada buluta yeniden giriş yapmak (orada çıkış yapılmış görünüyordu).
   - OpenRouter anahtarının gerçekten cevap verdiğini bir sohbette denemek. Kayıtlı olduğu görüldü, çalışması denenmedi.
2. **Kullanıcı kararı bekleyenler** (izinsiz değiştirme):
   - Bağlantısız/yetim sayfalar ve eski kopyalar: silinsin mi?
   - "Bunu tekrar sorma" düğmesi onay sormadan siliyor: onay eklensin mi?
   - Ders ayarları ham JSON olarak görünüyor: kullanıcı dostu forma çevrilsin mi?
   - Tekrar sayfasında iki "Konuş" düğmesi var.
   - "Toplu AI ders paketi" düğmesi biçimsiz.
3. **Henüz denetlenmeyenler** (LDPlayer'da tek tek):
   - Otel ve restoran dışındaki öğretmen sohbetleri: `chatteacher1/2`.
   - Seviye testi akışı, bitirme düğmesine basmadan.
   - Cümle Yazma ve Konuşma Pratiği'ndeki "Bugünün konuşması → Başla".
   - İlerlemem ve Tüm Bölümler listesindeki her sayfa.
   - Öbek fiil "Çoktan Seçmeli" modu.
4. **Gözlenen küçük sorunlar:**
   - Doktor sohbetinin arka plan fotoğrafında erkek doktor var; konuşan avatar kadın.
   - Doktor portresinde görüntü bozulmaları var.
   - Kayan YouTube oynatıcısı, kaydırınca kontrol satırını örtüyor.
   - Sağ alttaki "Öğretmene sor" düğmesi bazen içeriğin bir kısmını kapatıyor.
   - `hata-defteri.html?odak=...` yenilenince alıştırmayı yeniden açıyor.
   - Ders örnekleri yazılım/SQL temalı; bunlar kullanıcının kendi hata geçmişinden geliyor.
