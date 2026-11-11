# Oturum notu — yeni oturum için hatırlatma (son güncelleme: 11 Kasım 2026 öğlen)

> Yeni oturumdaki Claude için: Önce bu dosyayı oku. Kullanıcıyla **Türkçe** konuş.
> Uygulamanın kullanıcıları 50–80 yaş arası; arayüz büyük, sade ve açık yazılı olmalı.
> Kullanıcı kısa yazar (",2", "A", "devam et"). Kısa cevabı son sorulan sorunun cevabı say; yorumunu bir cümleyle söyle ve devam et.

## ▶ ŞU AN NEREDEYİZ — buradan başla
Son yayın: SW **`dh-sw-v423`** (11 Kasım). Çalışma ağacı temiz, her şey yayında.

**11 Kasım sabahı yapılanlar (kullanıcı "planı uygula, tam sesli modu da ekle" dedi):**
1. **Amaç sorusu yenilendi** — `dh-amac.js` (tek kaynak): Seyahat · Aile ve torunlar · Sağlık · Günlük hayat · Zihnimi canlı tutmak · İş · Sınav. `basla.html`'de çoklu seçim (dokun → ✓, "Devam et"); profilde `amac` (ilk) + `amaclar` (hepsi). Yeni 3 amaç için ilk cümleler eklendi.
2. **Bana özel ders** — `ozel-ders.html` + `dh-ozel-ders.js`: amaç + `DHProfile.nextModule()` gramer + seviye → 12 cümlelik modül, `DHModul` deposuna (Modüllerim/Cümle Çalış'ta görünür). Yol sırası: kendi anahtarı (`DHProviders.chat`, `slowMs` 60 sn — ai-providers'a eklendi, `?v=t35`) → araç (`ARACI_ADRES`) → Gemini kopyala-yapıştır paneli (sayfa yeniden yüklenirse `dh-ozel-ders-yarim` ile aynı görev kimliğiyle sürer). Kalite: alan denetimi (DHModul.dogrula), seviye başına kelime sınırı, iş/akademik dışında yazılım jargonu atılır, api/araç yolunda ikinci yapay zekâ denetimi, "🚩 Hatalı" ile cümle çıkarma. Günde 3 ders (yalnız ara sunucu yolunda; 11 Kasım: kendi anahtarı/Gemini yolunda sınır kaldırıldı). Ana sayfa kartı + kolay görünüm kutusu + menü + Modüllerim'de bağlantı.
3. ~~**Arka planda hazırlık**~~ (5c ile kapatıldı) — ana sayfa açılınca 6 sn sonra `DHOzelDers.onceden()`: bekleyen ders yoksa (yalnız anahtar/araç yolunda) sıradakini sessizce hazırlar; kart "Size özel yeni ders hazır" der.
4. **Araç (Aşama 3)** — `worker-ozel-ders.js` yazıldı, KURULMADI. Kurulum adımları `OZEL-DERS-ARACI.md`. Kullanıcı Worker adresini verince `dh-ozel-ders.js` → `ARACI_ADRES` doldurulacak. (Deneme için localStorage `dh-ozel-ders-araci` da kabul edilir; yalnız *.workers.dev.)
5. **Tam sesli mod** — `sesli-calis.html`: Türkçesi okunur → bip → kullanıcı İngilizcesini söyler → sonuç + doğrusu sesle; "stop/skip/repeat" sesli komutları, Durdur/Geç/Tekrar söyle/Bitir düğmeleri, ekran kararmaz (wakeLock). Vadesi gelen tekrarlar (srs:, tekrar.html'in SM-2 adımı, günlük tekrar sayacı) yoksa sıradaki modülden "dinle-tekrar et". Mikrofon yoksa/izin yoksa "Sadece dinle". Menü, ana sayfa ve Tekrar sayfasında ("🎧 Tam sesli mod") bağlantı.
5b. **Kendi konusu** (kullanıcı isteği): Bana Özel Ders'te "Konuyu kendiniz yazın" kutusu. Yazılan konu `DHAmac.ozelEkle` ile profile (`ozelKonular`, en çok 12) eklenir, kimliği `ozel:<metin>`; seçilir ve hemen o konuda ders hazırlanır. Amaç listesinde ✏️ ile görünür, "Kaldır" ile silinir; sırayla kullanılır ve arka planda da hazırlanır. Kendi konusunda jargon süzgeci kapalı.
   - Not: kolay görünümde simge+yazılı düğmeler yalnız DOKUNMATİK OLMAYAN ekranda simgeye iner; telefonda yazı görünür (test için `hasTouch:true, isMobile:true`).
5c. **Seviye/modül seçimi + koç onayı** (kullanıcı isteği): ozel-ders.html'de "Seviye ve konu" kartı (A1–C1 düğmeleri, seviyedeki modüller açılır listede; varsayılan = sıradaki konu). "Hazırla"ya basınca koç (dh-avatar, sesli) seviyeyi, konuyu, veriden bir örnek cümleyi ve amacı anlatır; "Evet, hazırla" denince üretilir (`uret({kaynakMod})`). Türkçe modül/seviye adları `dh-modul-tanim.js` (121 modül türünün hepsi). **Arka planda onaysız üretim KAPATILDI** (`onceden()` yalnız `window.__dhOzelDersOtomatik` varsa çalışır). Gemini yolunda yarım iş yeniden yüklemede onaylı ayarla sürer.
5d. **LDPlayer'da düzeltildi (v408–409):** hazırda bekleyen ders varken "hazırla" düğmesi gizleniyordu ("ders hazırlamıyor" şikâyeti) → ikisi birlikte görünür ("Yeni bir özel ders hazırla"). Amaç seçimi dokununca kaydedilir. Seçili seviye/amaç yeşil çerçeve + ✓. LDPlayer'da kullanıcının anahtarıyla GERÇEK üretim denendi: C1 Koşul (ileri) · Aile ve torunlar, ~1,5 dk sürdü, başarılı. Bekleme yazısı "1–2 dakika" yapıldı. LDPlayer'da sürüklemeden hemen sonraki dokunuş kaydırmayı durdurup tıklamayı yutuyor — testte dokunmadan önce 2 sn bekle.
5e. **Koç sunumu düzeltildi (v411):** "Havalimanı" gibi DURUM modülleri dil bilgisi listesinden çıkarıldı (`DHModulTanim.gramerMi`, DURUM listesi); varsayılan da ilk dil bilgisi modülü. Koç "Dil bilgisi: …" ve "Cümlelerin konusu: …" diye ayrı anlatır, örnek "Bu kalıba bir örnek". Aynı adlı modüller "Modül n · Bölüm m" diye ayrılır.
5f. **Sesli çalış (v412):** kullanıcı "beni duymuyor" dedi. Android'de ses tanıma sessizlikte erken kapanıyordu → 8 sn dolana kadar kendini yeniden başlatır (tekrar.html yöntemi). Boş cevapta sebep yazılır (mikrofondan ses gelmiyor / internet / duyamadım); audio-capture/network'te "sadece dinle"ye geçer. **Kendi sesini dinleme:** her cevap MediaRecorder ile kaydedilir; "Sesimi dinle" düğmesi (sizin sesiniz → doğrusu), "Her cevaptan sonra kendi sesimi çal" seçeneği (localStorage dh-sesli-otoses), bitişte cümle listesi + "Sesimi dinle / Doğrusunu dinle". Kayıt mikrofonu kilitlerse (audio-capture) kayıt o oturumda kapanır. LDPlayer mikrofonu PC'den gelmeyebilir — gerçek telefonda denenmeli. v413: dinlerken yeşil ses seviyesi çubuğu; hiç ses yoksa "Mikrofondan hiç ses gelmiyor", ses var ama anlaşılmadıysa "duydum ama anlayamadım". Hiçbir şey duyulmayan cümlede tekrar kaydı (srs) DEĞİŞMEZ.
5g. **Sesli çalış v414:** ses tanıma ile kayıt AYNI ANDA çalışmıyor (Android'de getUserMedia açıkken ses tanıma duymuyor olabilir; LDPlayer'da ses geliyordu ama tanınmadı). Artık cevap yalnız ses tanımayla dinlenir; kayıt ayrı adım: "Sesimi kaydet ve dinle" düğmesi (akışı durdurur → bip → 5 sn kayıt, yeşil ses çubuğu → "Sizin sesiniz" → "Doğrusu") ve "Her cevaptan sonra sesimi kaydedip dinlet" seçeneği. Gerçek sesle henüz denenmedi (Claude konuşamıyor) — kullanıcı denemeli.
5h. **Her modülde sesli çalış (v415):** `sesli-calis.html?mod=<TAM MODÜL ADI>` o modülün cümlelerini (resmî ya da kullanıcı/özel ders modülü, en çok 30) çalıştırır; iki biçim: "Önce dinleyip sonra söyleyeyim" (yeni) / "Türkçesini duyunca kendim söyleyeyim" (sina). Modül oturumunda SRS yazılmaz, yalnız DHProgress.recordResult. `dh-sesli-modul.js` düğmeyi ekler: index-app (.study-title satırının altında "🎧 Bu modülü sesli çalış"), ogren + videopractice (sabit yerleşim; sol sütunda Fotoğraf/Resim-Video/Önceki altına, #videoStatus üstüne "🎧 Sesli çalış" hapı; tam ad kutucuktaki data-mod'dan sessionStorage'a). Modüllerim detay ve Bana Özel Ders (hazır kart + geçmiş satırları) bağlantıları.
5i. **Telefonda sesli mod ÇALIŞIYOR** (kullanıcı doğruladı; LDPlayer'da ses tanıma yok). **v416: arkada video/resim** — her cümlede ekranın arkasında: önce `video-practice-video:<id>` (Görselle Öğren'in bulduğu), yoksa Pexels anahtarı (`pexels-api-key`, kv) varsa Pexels (720 px mp4, sonuç aynı anahtara kaydedilir), yoksa/açılmazsa resim (`img:<normEn>` önbelleği, yoksa Openverse → Commons). Koyu perde + yazı gölgesi; sıradaki cümlenin medyası önceden aranır; "Arkada video ya da resim göster" seçeneği (dh-sesli-medya).
5j. **v417 (kullanıcı "2,4" seçti):** (2) Sesli çalışta kelime farkı: `farkBul` (LCS, kısaltmalar açılır) yanlış/eksik kelimeyi cümlede kırmızı dalgalı çizer, koç "“go” değil, “went” denir" / "“a” kelimesini atladınız" der (en çok 2 sorun; eşleşme %50 altıysa yalnız doğrusu). (4) **nasil-derim.html** "Bunu İngilizce nasıl derim?": Türkçe yaz/söyle (tr-TR ses tanıma) → yapay zekâ JSON (en, tr, trPron, ipa, açıklama, alternatif + modül alanları) → Dinle / Yavaş dinle / Ben de söyleyeyim (en ses tanıma, eksik kelime) / Derslerime ekle (DHModul id `USR-KENDI`, ad "<seviye>-M90 Kendi cümlelerim" — M90 gocEt yeniden adlandırmasın diye). Son 20 soru `dh-nasil-derim-v1`, aynı soru yapay zekâya tekrar gitmez. Anahtarsızda Gemini paneli. Ana sayfa kutusu + menü.
5k. **v418 — "anahtarım var ama sohbet Gemini kopyala-yapıştıra gidiyor":** sebep profildeki `aiYontemi:"gemini"` ("💬 Anahtarım yok" seçimi, ai-choice.js) kayıtlı anahtardan önce geliyordu; profil bulutla cihazlar arası taşınıyor. `ai-providers.js` `aiMode()`: bu cihazda kullanılabilir anahtar varsa HER ZAMAN "api"; yoksa aiYontemi "api" ise api (anahtar penceresi), değilse gemini. ai-providers `?v=t36` (36 dosya).
5l. **v419 — sohbet açılışında soru (kullanıcı isteği):** chat-core.js `aiTercihSor` → "Öğretmen nasıl cevap versin? 🔑 Anahtarımla / 💬 Gemini ile (kopyala-yapıştır)" + "Bu cihazda hep bunu kullan" (`dh-sohbet-ai-tercih`, buluta GİTMEZ) + "Sohbete girmeden geri dön". Seçim `DHProviders.setSessionMode` ile YALNIZ o sayfada geçerli (aiMode önce ona bakar). Gemini seçilince açılış cümlesi yapay zekâya sorulmaz. Anahtarsız "Anahtarımla" → anahtar penceresi. Menü → Ayarlar: "Sohbette yapay zekâ seçimini yeniden sor". chat-core `?v=t38`, ai-providers t36.
5m. **v420 — "📋 Plan" kutusu düğmeleri örtüyordu** (coach-bubble.js `dhMountPlanPill`, bottom:12px sabit, en üst katman; kolay görünüm yazıyı 3 satıra büyütüyordu). `pillYerlestir`: koç balonuyla aynı kural — alt çubuğun ve ekranın alt yarısında yerinde sabit duran düğmelerin (+ sohbetteki #taskBar) üstüne oturur; `data-kk-atla` + 15px tek satır; panel kutunun hemen üstünde açılır; 2 sn'de bir yeniden hesaplanır. coach-bubble `?v=t38` (15 sayfa).
5n. **v421 — plan kutusu, kullanıcı "B" seçti:** v420'deki yer bulma telefonda çalışmadı (adres çubuğu yüzünden sohbet sayfası "kaydırılabilir" sayıldı, düğmeler "sabit" sayılmadı; test ortamında adres çubuğu yok — dikkat!). Artık TAM EKRAN sayfalarda (`DH_TAM_EKRAN`: chat*, teacher*, ogren, videopractice, sesdalga, immersive, youtube-*, sesli-calis + .chat-shell/.video-page olan her sayfa) plan kutusu HİÇ gösterilmez. Diğer sayfalarda alt çubuğun üstünde; sayfa sonuna 76 px boşluk (#dhPlanBosluk) eklenir ki son düğmeler kaydırılınca kutunun altında kalmasın. coach-bubble `?v=t39`.
5o. **v422 — plan ve koç Menü'de (kullanıcı isteği):** kolay görünümün Menü'sü varsa (`dhKolayMenu`) "📋 Plan" kutusu ve sağ alttaki koç yüzü ekranda GÖSTERİLMEZ; Menü açılınca en üstte "Bugün" bölümü (kolay-kullanim.js `bugunCiz`): "📋 Bugünkü planım — 0/5 yapıldı · Sıradaki: …" (dhCoachPlanAc → plan paneli) ve "🧑‍🏫 Koçum" (dhCoachGoster; 1,2 sn'de cevap yoksa "Durumunuza bakıyorum…", mesaj yoksa "Şu an yeni bir yorumum yok"). Koç BALONLARI eskisi gibi çıkar. Kolay Menü'ye Bana Özel Ders / Sesli Çalış / Nasıl Derim? eklendi. coach-bubble t40, kolay-kullanim v26.
5p. **v423 — 🧰 Düğmeler (kullanıcı "A" seçti):** alt çubuk artık Geri · Ana Sayfa · Menü · **🧰 Düğmeler** ("Aa" kalktı; Yazı boyutu Menü → Görünüm'de ve Düğmeler penceresinin altında). `dh-dugmeler.js` (kolay-kullanim.js dinamik yükler, `?v=7`): ekranın ARAÇ düğmeleri gizlenir (satır içi display:none!important; sayfanın kendi display'i saklanır, "kullanılabilir mi" `__dhGorunur` ile ölçülür, style/hidden/class değişince yeniden ölçülür), pencerede kopyaları büyük ve yazılı; kopyaya basınca asıl düğmeye .click(). Asıl iş düğmeleri ekranda kalır. EKRANLAR: index-app (Gemini, Resim/Video, YouTube, Araçlar, Liste, Sesli çalış; .dh-source-media-row gizli), tekrar (Çalışma şekli dört mod — .mode gizli; Çeviri, Gemini, Bir daha sor, Stüdyo, Bunu tekrar sorma, Cevap kontrol ayarları), kelime-ogren (Örnek cümle, Ayarlar), ogren (Tercüme, Stüdyo, Fotoğraf/Video, Sesli çalış), videopractice (Tercüme, Stüdyo, Resim/Video #dhModeToggle, Video ayarı, Sesli çalış). Tam ekran ogren/videopractice'te Menü'nün altında "🧰 Düğme". Listede olmayan sayfada pencere "Bu ekranda başka düğme yok" + Yazı boyutu. kolay-kullanim v27. SIRADAKİ: diğer ekranlar (ders, practice, hata-defteri, chat "Daha fazla"…) için liste.
6. Denemeler: sahte Groq ve sahte Worker (worker kodunun kendisi) ile uçtan uca üretim, bayrak, ana sayfa kartı; sahte ses tanıma ile sesli çalış (SRS yazımı doğrulandı); `mobiltara` yeni/değişen 7 sayfa: JS hatası/404/taşma 0. `tools/mobil-tarama/mobiltara.mjs` listesine 2 yeni sayfa eklendi.

**Kullanıcıdan beklenenler:** araç kurulsun mu (OZEL-DERS-ARACI.md); LDPlayer'da Bana özel ders + Sesli çalış denemesi (mikrofon izni kullanıcının işi).

**10 Kasım akşamı–gecesi bitenler (hepsi yayında):**
1. Düğme taraması (55 sayfa, 2 seviye, boş + örnek veri; 1.800+ tıklama, 318 farklı ekran elle incelendi) ve bulunan hataların düzeltmesi. Ayrıntı aşağıda.
2. Bağlantısız 4 sayfa silindi (kullanıcı onayıyla).
3. Zayıf yön 2 (koç balonu düğmeleri örtüyor) çözüldü — kullanıcı "A" seçti.
4. Zayıf yön 1 (Gemini kopyala-yapıştır) için yalnız "2. katman" yapıldı — kullanıcı ",2" yazdı.

**Sıradaki iş (11 Kasım sabahı kullanıcıya önerildi, cevap bekleniyor):**
- **a) LDPlayer doğrulaması** (önerilen ilk iş): dünkü değişiklikler gerçek uygulamada HİÇ denenmedi. Bakılacaklar:
  - Gemini paneli: 3 adım, "📋 Gemini’nin cevabını getir" → Android pano izni sorusu (izin verilirse tek dokunuş, verilmezse "Kendim yapıştıracağım" açılmalı). Gemini'ye gerçek soru gönderme kullanıcının işi; sadece paneli ve izin davranışını gör.
  - Koç balonu: Hata Defteri "🎯 Bunu çöz" alıştırması, Cümle Yazma, Kelime Öğren, İngilizceyi Yaşa sahnesi — balon hiçbir düğmeyi örtmemeli, yalnız ✕ kapatmalı.
  - Görselle Öğren'de "Daily Problems · P2" gibi alt sıradaki modüle dokunma: yerelde bazen ilk dokunuş etkisiz kaldı, sebebi bulunamadı — telefonda tekrar dene.
  - Kesin kurallar (aşağıda) geçerli: veri silen/değiştiren düğmelere basma, izin verme.
- **b) Zayıf yön 3:** sayfanın kendiliğinden yenilenmesi (önerilen sonraki iyileştirme). Öneri: `ux-boost.js` controllerchange'te sormadan `location.reload()` yerine, yazılmış cevap/açık panel yokken yenile, varsa "🔄 Güncelleme hazır · Yenile" bildirimi göster. Önce kullanıcıya planı anlat, onay al.
- **c) Gemini akışının seçilmeyen katmanları** (kullanıcı seçerse): 1. katman — Öğretmen sayfasında cümlenin hazır `aiExplain` açıklaması (9138 cümlenin 5063'ünde var; teacher/teacher1 hiç kullanmıyor) önce gösterilsin, Gemini "Daha fazla" ile; 3. katman — A) sahibin Gemini anahtarıyla Cloudflare Worker aracı (kullanıcıya anahtar gerekmez; kota paylaşılır), B) rehberli ücretsiz anahtar kurulumu.
- **d) Kalan zayıf yönler** 4–9 (aşağıdaki listede). Kural: her biri için önce "nasıl çözeceğim" anlat, kullanıcı seçsin; izinsiz değiştirme.

**Çalışma yöntemi (kullanıcı bunu bekliyor):**
- Her değişiklikten sonra ilgili sayfaları `mobiltara.mjs` ile yeniden tara (JS hatası/404/örtme sıfır olmalı), ekran görüntülerine bak, sonra `?v=` + `SW_VERSION` artır, commit + push.
- Yerel sunucu: `python3 -m http.server 8767 --bind 127.0.0.1` — arka plan işleri 2 saatte öldürülüyor; uzun beklemede testten önce açıp sonra `pkill -f "http.server 8767"` ile kapatmak daha güvenli.
- Değişen dosyalar: `coach-bubble.js?v=t37` (15 sayfa), `gemini-bridge.js?v=t22` (12 sayfa), `dh-avatar.js?v=4`.

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
1. **Gemini kopyala-yapıştır akışı çok adımlı** → 10 Kasım gecesi kullanıcı "2. katman"ı seçti ve yapıldı: `gemini-bridge.js` paneli 3 büyük numaralı adım (sıradaki çerçeveli); "📋 Gemini’nin cevabını getir" panoyu kendisi okur, cevap DH-ID ile bu soruya aitse ek onay sormadan uygular; panoda hâlâ soru varsa uyarır; izin yoksa "Kendim yapıştıracağım" kutusu kendiliğinden açılır; açılışta klavye açılmaz; geri dönünce 3. adım vurgulanır; panel açıkken koç yüzü/balonu ve yüzen Menü gizli. Önerilen ama YAPILMAYANLAR (kullanıcı seçmedi): 1. katman — cümlelerdeki hazır `aiExplain` (9138’in 5063’ünde var) Öğretmen sayfasında önce gösterilsin; 3. katman — A) sahibinin anahtarıyla Cloudflare Worker aracı, B) rehberli ücretsiz anahtar kurulumu. Eski metin:: anahtarı olmayan kullanıcıda Öğretmen/teacher sayfası açılır açılmaz 3 adımlı panel çıkıyor (kopyala → Gemini'ye geç → basılı tutup yapıştır → cevabı kopyala → geri dön → yapıştır). Sohbet, hata defteri, tekrar, modüllerim aynı yolu kullanıyor. Bu yaş grubu için en büyük engel.
2. ~~**Koç övgü/ipucu balonu düğmeleri örtüyor**~~ → **10 Kasım gecesi çözüldü** (kullanıcı "A" seçti: balon altta kalır, sayfa yer açar; `coach-bubble.js` `balonYerlestir/yuzYerlestir`). Balona dokunmak artık kapatmıyor, yalnız ✕ (48 px, "Kapat"); en fazla ekranın 3'te 1'i; "YENİ KONU" metni kısaldı. Tarama: koç örtmesi 13+ → 0. Eski metin:: yalnız ✕ ile kapanıyor ve balona dokunmak da onu kapatıyor; kullanıcı "Kontrol et / Atla / Dinle / Sıradaki" düğmesine basmak isterken dokunuşu balon yiyor (hata defteri alıştırması, kelime öğren, videopractice, cümle yazma "YENİ KONU" balonu her adımda). Sağ alttaki küçük koç yüzü de bazı düğmelerin köşesine biniyor (Hata Defteri "Kontrol et").
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
- Önbellek kırma: değişen betiğin `?v=` değerini artır ve `sw.js` içindeki `SW_VERSION`'u bir artır. Şu an `dh-sw-v404`.
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
3. **Sayfa içi akışlar denetlendi** (10 Kasım akşamı); zayıf yön 1 (kısmen) ve 2 iyileştirildi. LDPlayer doğrulaması ve zayıf yön 3–9 kaldı — en üstteki "ŞU AN NEREDEYİZ" bölümüne bak.
4. **Gözlenen küçük sorunlar:**
   - Doktor portresinde görüntü bozulmaları var (görsel dosyalarında; yeni çizim gerekir).
   - YouTube Eğitim Stüdyosu'nda kayan oynatıcı görülmedi; oynatıcı sayfayla birlikte kayıyor.
   - Ders örnekleri yazılım/SQL temalı; bunlar kullanıcının kendi hata geçmişinden geliyor.
   - Görselle Öğren: alt sıradaki modül kutucuğuna ilk dokunuş bazen etkisiz (yerelde 1,5 sn içinde dokununca); sebebi bulunamadı, LDPlayer'da denenecek.
   - `test-gemini-navigation-cloud-ai-v106.mjs` eski `.dhgb-open` sınıfını arıyor; bu test zaten eskiydi (Gemini paneli değişmeden önce de geçmiyordu).

### 5q. Modül ekranında Önceki · Dinle · Sonraki üst çubukta (v424)
- dh-dugmeler.js `ust` tanımı: index-app'te üç vekil düğme `.index-app-top-actions` içine, Geri'nin yanına; karttaki #dhNavTrio ve .dh-card-actions-primary gizlenir. Simge üstte, yazı altta (dar ekrana sığsın). Asılların kapalı/yok durumu yansıtılır; liste ekranında çubuk gizli. Zor/Normal/Kolay kartta kalır.

### 5r. Ana sayfada çift "özel ders" kartı kaldırıldı (v425)
- Kolay görünümde (html.kk-acik) #ozelDersKart gizli; üstteki "✨ Bana Özel Ders" kutusu tek giriş ve "Yeni dersin hazır" notunu gösteriyor. Kolay görünüm kapalıyken kart tek giriş olduğu için kalır.
