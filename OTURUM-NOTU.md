# Oturum notu — yeni oturum için hatırlatma (10 Kasım 2026)

> Yeni oturumdaki Claude için: Önce bu dosyayı oku. Kullanıcıyla **Türkçe** konuş.
> Uygulamanın kullanıcıları 50–80 yaş arası; arayüz büyük, sade ve açık yazılı olmalı.

## ▶ SIRADAKİ İŞ — buradan başla
Düğme taraması (kullanıcının isteği: "ekranlardaki düğmelere basınca açılan iç akışlara da teker teker bak. atlama yapma") **10 Kasım akşamı bitti ve yayında** (commit `cf65418`, `47bfec8`, SW `dh-sw-v398`).
Kullanıcı ek olarak şunu istedi: **"programı bir kullanıcı gözüyle de analiz et; zayıf ve kuvvetli yönleri keşfet, daha sonra zayıf yönleri iyileştiririz."**
→ Aşağıdaki "Kullanıcı gözüyle değerlendirme" listesi kullanıcıya sunuldu. **Hangi zayıf yönün iyileştirileceğini kullanıcı seçecek; izinsiz değiştirme.**
Kalan: veriye bağlı akışları LDPlayer'da doğrulamak (bu oturumda bilgisayar bağlantısı koptu, yapılamadı).

### Tarama nasıl yapıldı (tekrar gerekirse)
- Araçlar depoda: `tools/mobil-tarama/` → `/home/claude/tools/` altına kopyala.
  - `node mobiltara.mjs --isci=6 --mod=bos|veri|ilk [--cikti=klasor] [sayfa ...]` (boşsa 55 sayfa). Çıktı: `ozet.json`, `sonuc.json`, `ekran/*.png`.
  - `--mod=veri` için önce `node ornek-veri.mjs` (4 hata kaydı, 6 günlük takip, 30 `srs:` kaydı → `ornek-durum.json`, storageState + IndexedDB).
  - `python3 rapor.py out-bos [sayfa]` özet; `python3 izgara.py izg/ad 740 dosyalar...` 6'lık ızgara.
- **Servis çalışanı mutlaka kapalı** (`serviceWorkers:'block'`): ilk açılışta SW `skipWaiting+clients.claim` → `controllerchange` → sayfa ~4 sn sonra kendini yeniliyor, tıklamalar bozuluyor.
- 500+ aynı yapıdaki modül düğmesi (index-app, ogren, videopractice) örneklenir: ilk 3, her 100'üncü, son. Diğer her düğme tek tek.
- Sonuç: boş durum 826 tıklama (485'i 2. seviye), örnek veri 975 tıklama (560'ı 2. seviye). 318 farklı ekran görüntüsü elle incelendi.
- Yanlış alarm olanlar: alt çubuk "◀ Geri" → about:blank (yalnız test tarayıcısında, gerçekte index.html'e gider); `sentence-mode` v1/v2 (idb-uyum.js zaten çözüyor); index→basla yönlendirmesi (kurulum yapılmamışsa doğru).

### Taramada bulunup düzeltilenler (yayında)
- `dh-avatar.js`: boş/yalnız emoji metinde `cizgi[-1].v` hatası (ana sayfa → Gemini ile değerlendir).
- 88 modül adı "-Decision" gibi tireli görünüyordu (`B2-M12-Decision` adları): 12 dosyada önek regex'i `[\s-]*`.
- teacher1 başlığı Talimat/Menü ile çakışıyordu; sesdalga başlığı kolay görünümde sütunlara bölünüyordu; videopractice/ogren "Video ayarı" penceresi Önceki/Sıradaki altında kalıyordu (z-index); menü günlük hatırlatma anahtarı 64×38 ve satırın yazısı da dokunulabilir.

### Silinenler (kullanıcı onayıyla, 10 Kasım akşamı)
- Hiçbir yerden bağlantı verilmeyen `pdfoku.html` (her açılışta `pdfjsLib` hatası), `koc-modu.html` (eski adresi index.html'e yönlendiren sayfaydı), `ses-esleme.html`, `pwa-reset.html` (yerine `pwa-hard-reset.html`). `test-mobile-layout.mjs` içinden bu sayfalara ait iki kontrol çıkarıldı.

### Kullanıcı gözüyle değerlendirme (50–80 yaş)
**Güçlü yönler**
1. İlk açılış kısa ve başarı hissi veriyor: 3 soru, ilk cümleyi doğru yaptırıyor, yanlışta Türkçe neden ("the park" çünkü belli bir park).
2. Alt çubuk (Geri · Ana Sayfa · Menü · Yazı) neredeyse her sayfada aynı yerde; yazı boyutu paneli çok anlaşılır.
3. Tehlikeli işlemler (veri silme, çıkış, defteri silme, eski verileri temizle) önce açık Türkçe onay soruyor.
4. Boş durumlar çoğunlukla yol gösteriyor ("Henüz fotoğraftan eklenmiş cümle yok" + düğme, "Önce kutuya bir şey yaz").
5. Öbek fiil alıştırması örnek nitelikte: büyük seçenekler, doğru/yanlışta anlamıyla açıklama, "Sonraki" ve "Dinle".
6. Ana sayfa "Bugünün planı" ne kaldığını sayıyla gösteriyor (4/8 · 4 kaldı).

**Zayıf yönler (önem sırasıyla)**
1. **Gemini kopyala-yapıştır akışı çok adımlı**: anahtarı olmayan kullanıcıda Öğretmen/teacher sayfası açılır açılmaz 3 adımlı panel çıkıyor (kopyala → Gemini'ye geç → basılı tutup yapıştır → cevabı kopyala → geri dön → yapıştır). Sohbet, hata defteri, tekrar, modüllerim aynı yolu kullanıyor. Bu yaş grubu için en büyük engel.
2. **Koç övgü/ipucu balonu düğmeleri örtüyor**: yalnız ✕ ile kapanıyor ve balona dokunmak da onu kapatıyor; kullanıcı "Kontrol et / Atla / Dinle / Sıradaki" düğmesine basmak isterken dokunuşu balon yiyor (hata defteri alıştırması, kelime öğren, videopractice, cümle yazma "YENİ KONU" balonu her adımda). Sağ alttaki küçük koç yüzü de bazı düğmelerin köşesine biniyor (Hata Defteri "Kontrol et").
3. **Sayfa kendiliğinden yenileniyor**: yeni sürüm yayınlanınca (`ux-boost.js` controllerchange → `location.reload()`, sw.js `skipWaiting`) açık sayfa sormadan yenileniyor; yazılan cevap/kayıt yarıda kalabilir.
4. **Çok uzun modül listeleri**: Cümle Çalış / Görselle Öğren / Videoyla Okuma'da 500+ modül tek liste; arama veya "kaldığın yer" öne çıkmıyor.
5. **Teknik dil görünür yerlerde**: "Cloudflare Worker adresi", "JSON", "Pexels anahtarı", "SW + Cache temizle", "LocalStorage", "Groq AI Anahtarları", "Trainer modülü hazır" (sesdalga).
6. **Tutarsız görünüm**: bazı sayfalar başka tasarımda (veri-gizlilik, pwa-hard-reset, kıblenamaz açık tema), sağ üstteki yüzen "Menü" ile alt çubuktaki "Menü" aynı sayfada iki kez; başlıklar yüzen Menü'nün altında kalmaya yatkın.
7. **Aynı işi yapan çok sayfa/düğme**: Öğretmen için teacher, teacher1, teacher-chat, chatteacher, chatteacher1/2; sohbet alt çubuğunda 10'a yakın düğme (Öneri, Daha fazla, Hatalarım, Eller serbest, Özetle, Gemini'de sürdür, Gemini raporu, Değerlendir, Konuş, Gönder). Ne zaman hangisi kullanılır belirsiz.
8. **İçerik teması**: C1/B2 cümleleri yazılım/SQL temalı ("nested WHILE loop"); kelime dizme alıştırmasında büyük harfli kelime cümlenin başını ele veriyor.
9. **Küçük boş durum kusurları**: Tekrar sayfası hiç çalışılmamışken "🎉 Oturum bitti! 0/0"; "Bu cümle için resim/video bulunamadı" kutusu ekranın ortasını kaplıyor.

Bilinen ipuçları:
- Bu bulut ortamı yayındaki siteye (github.io) erişemiyor; her şey yerel sunucuda test edilir.
- Kolay görünüm (`kolay-kullanim.js`) düğmelere kendisi etiket koyuyor: `KIMLIK` (kimliğe göre), `SIMGE` (simgeye göre); `ikonYazilari` artık önce `KIMLIK`'e bakıyor. Etiket sorunları oradan düzeltilir.
- Koç balonu `coach-bubble.js` (`dhCoachSay`), öğretmen paneli `teacher-bubble.js`.
- Yeni oturumda depo yok: `add_repo` (push) → `git clone --depth 1 https://github.com/sametegeli-oss/dilharita /home/claude/dilharita`.

## Proje
- Depo: `sametegeli-oss/dilharita`. Statik site, GitHub Pages'te yayında: https://sametegeli-oss.github.io/dilharita/
- Yayın: `main`'e push edince "pages build and deployment" çalışır (~1 dk).
  - "Quality" iş akışı eski bir sebepten (Windows kısa adları) hep başarısız olur; görmezden gel.
- Önbellek kırma: değişen betiğin `?v=` değerini artır ve `sw.js` içindeki `SW_VERSION`'u bir artır. Şu an `dh-sw-v399`.
- Commit: `git -c user.email=noreply@anthropic.com -c user.name=Claude commit` (mesaj sonuna oturumun verdiği Co-Authored-By satırı), sonra `git pull --rebase origin main && git push origin HEAD:main`.

## Kesin kurallar (kullanıcının istekleri)
- Dosya silme: kullanıcı onayıyla 114 dosya silindi (bkz. aşağı). Yeni silme gerekirse yine önce sor.
- Kullanıcı verisini silen ya da değiştiren düğmelere basma: "Bunu tekrar sorma", "Bildim", "Modülü sil", seviye testini bitirme, PDF indirme.
- Sistem veya site izni verme (mikrofon, dosya). Reddetmek gerekirse reddet.
- API anahtarlarının değerlerini okuma, kopyalama ya da yazma; kullanıcı kendisi yapıştırır.

## Test araçları
- Yerel sunucu: depo klasöründe `python3 -m http.server 8767 --bind 127.0.0.1`.
- Playwright: `/opt/npm-tools/node_modules/playwright/index.mjs`.
- Mobil düğme tarayıcısı: depoda `tools/mobil-tarama/mobiltara.mjs` (yukarıdaki "Tarama nasıl yapıldı").
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

## 10 Kasım öğleden sonra (ikinci oturum, hepsi yayında)
- 114 kullanılmayan dosya silindi (kullanıcı onayıyla): kısa adlı `~` kopyalar, `modul-calis/teacher3/pv.html`, `practice*.css`, `chat-gemini-continue.js`, `zilmT21J` zip, `assets/avatars_v3/teacher1/` içindeki sayfa/sw kopyaları ve `.WEB` dosyaları, kodda geçmeyen `patch-*` vb. avatarlar. 29 sayfa tarandı: JS hatası ve 404 yok.
  - Bırakılanlar: `teacher.html`'in kullandığı alt çizgili avatar adları, `mouth_00–23.png`, `data-sentences.zip`, `kur.sh` (çalıştırılmadı).
- Sohbet "Öneri": öğretmen bir cümle söyletiyorsa tam o cümleyi öneriyor.
- Sohbet alt çubuğu: "Gemini ile ders" düğmesi "Gemini ders" adıyla "Daha fazla" grubunda.
- Öğretmen seçimi sayfası: geliştirici notu yerine sade açıklama.
- İlerleme raporu: hata oranı açıklaması sade Türkçe, ondalık virgül; çalışma ritmi kartına açıklama.
- Hata Defteri: telefonda 6 px yatay taşma giderildi.
- Seviye testi: mikrofon izni/mikrofon yoksa okuma sorusu yanlış sayılmıyor; "Şimdi sesli okuyamıyorum, geç" düğmesi.
- Öğretmen seçimi: kullanıcı otomatik değişimi seçti (Türkçe → teacher1, İngilizce → teacher2). chatteacher.html metni buna göre yazıldı.
- "Öğretmene sor" yüzen düğmesi: kolay görünümde alt çubuğa 5. düğme ("🎓 Öğretmen") olarak alındı, yüzen düğme gizli. Tam ekran sayfalarda (sohbet) eskisi gibi. Kullanıcı bu soruyu cevaplamadı, önerilen yol uygulandı.
- Koç balonu tekrar sayısı Cümle Yazma ile aynı (yalnız öğrenilmiş cümleler, "öğe" yerine "cümle").
- Hata Defteri `?odak=...&baslat=1`: alıştırma açılınca `baslat` adresten siliniyor, yenileyince yeniden açılmıyor.
- YouTube'dan Çalış (youtube-pratik): oynatıcı + kontrol satırı tek yapışkan kutuda, telefonda tek satır. `seekQuiet`: kesit başına atlamak videoyu kendiliğinden oynatmıyor (eskiden oturum başlayınca video sonuna kadar akıyordu). "Soldan filtreleri" → "Filtreleri".
- Doktor sohbeti arka planı "female doctor" aramasıyla.
- Tekrar sayfası: iki düğme farklı işler (bMic = sesle cevap, bStudio = Telaffuz Stüdyosu); kolay görünüm ikisine de "Konuş" yazıyordu. Etiketler "Sesle cevapla" / "Telaffuz". Hiçbiri kaldırılmadı.
- "Toplu AI ders paketi" düğmesi yanındaki mor düğmelerle aynı görünümde.
- Koç balonu: alt çubuk varken çubuğun hemen üstünde çıkıyor (eskiden üstte soruyu örtüyordu); yine yalnız ✕ ile kapanır.
- "Bunu tekrar sorma": kullanıcı "olduğu gibi kalsın" dedi.
- Tüm Bölümler sayfaları telefon ekran görüntüsüyle elle incelendi. Düzeltilenler: Bugünkü Dersim "10 soru" → "en fazla 15 soru"; Gemini rapor arşivi "SRS" yerine sade ifade; Kılavuz "Sol taraftaki meşale" → "Meşale göstergesi"; Cümle Çalış başlığı ayar düğmesiyle çakışmıyor; Modüllerim "+" düğmesi "Yeni" (taşmıyordu).
- Kolay görünüm `ikonYazilari` artık KIMLIK etiketini önce kullanıyor.
- Denetlendi, sorun yok: Konuşma Pratiği "Bugünün konuşması → Başla", Cümle Yazma, İlerlemem, Tüm Bölümler, seviye testi akışı (bitirmeden), öbek fiil Çoktan Seçmeli.

## Kalanlar / yapılacaklar
1. **Kullanıcının kendi yapacakları:**
   - LDPlayer'daki uygulamada buluta yeniden giriş yapmak (orada çıkış yapılmış görünüyordu).
   - OpenRouter anahtarının gerçekten cevap verdiğini bir sohbette denemek. Kayıtlı olduğu görüldü, çalışması denenmedi.
2. **Kullanıcı kararı bekleyenler** (izinsiz değiştirme):
   - (Ders ayarları JSON olarak kalacak — kullanıcı kararı. Kıvrık tırnaklar kaydederken düz tırnağa çevriliyor.)
3. **Sayfa içi akışlar denetlendi** (10 Kasım akşamı); LDPlayer doğrulaması ve zayıf yönlerin iyileştirilmesi kaldı.
4. **Gözlenen küçük sorunlar:**
   - Doktor portresinde görüntü bozulmaları var (görsel dosyalarında; yeni çizim gerekir).
   - YouTube Eğitim Stüdyosu'nda kayan oynatıcı görülmedi; oynatıcı sayfayla birlikte kayıyor.
   - Ders örnekleri yazılım/SQL temalı; bunlar kullanıcının kendi hata geçmişinden geliyor.
