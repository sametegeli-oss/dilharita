# Dil Harita — Claude için proje rehberi

Bu dosya her oturumun başında kendiliğinden okunur. Kalıcı kurallar, çalışma düzeni ve
projenin şu anki durumu buradadır. Yol haritası ve kararlar: `YOL-HARITASI.md`.
Her oturumun sonunda bu iki dosyayı güncel tut (sürüm numaraları, yapılanlar, açık konular).

## Kullanıcıyla çalışma kuralları
- **Her zaman Türkçe cevap ver.**
- claude.ai'deki "Konuşkan · Claude" artifact'ını silme.
- Kullanıcının parolasını asla girme.
- Kullanıcı verisini silmek, bulut/hesap ayarı değiştirmek gibi işlemlerden önce açık onay al.
- Kullanıcının kendi uygulama ayarlarını (ör. perde/hız, cevap uzunluğu) değiştiren işleri önce sor; "yap" deyince yap.
- Kullanıcı telefondan çalışıyor (Android 10, Chrome) ve ekran görüntüsü ya da ölçüm tablosu yapıştırıyor.
  Tahmin yerine ölçüme dayan. Bir değişiklik durumu kötüleştirirse hemen geri al.
- Kullanıcının bilgisayarında Claude in Chrome çalışıyor; gerçek ortamı oradan incele.
  Orada "Eller serbest" açık: dersi açarsan mikrofon dinler. İş bitince dersi ve sekmeyi kapat.
  Oradaki işlemler gerçek yapay zekâ anahtarlarını ve gerçek Firestore kotasını harcar.

## Depo ve yayın
- GitHub: `sametegeli-oss/dilharita` (main), herkese açık. Site: https://sametegeli-oss.github.io/dilharita/
  Depoya gizli bilgi, kişisel veri ya da başkasının telifli içeriğini koyma.
- Her değişiklikte:
  1. Değişen JS/CSS dosyasının `?v=` numarasını onu yükleyen **bütün** HTML'lerde artır
     (`grep -rl 'dosya.js?v=' --include=*.html .`).
  2. `sw.js` 16. satırdaki `SW_VERSION`'ı artır ve yanına kısa not yaz.
  3. Commit: `git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit`,
     mesajın sonunda Co-Authored-By ve Claude-Session satırları.
  4. Push: `git -c push.negotiate=true push -q origin main`.
  5. `gh api "repos/sametegeli-oss/dilharita/actions/runs?per_page=4"` ile "pages build and deployment"ı bekle (~1 dk).
     "Quality" iş akışı hep başarısız; önemsiz.

## Yerel test düzeni
- Depoya test dosyası koyma. Test dosyaları depo dışında: `/home/claude/qtest/` (yoksa yeniden kur).
- Yerel sunucu: depo kökünü ve `/_pt/` → `qtest/pt` yolunu 8768'de sunan küçük bir Python betiği
  (`qtest/sunucu.py`; oturumlar arasında silinebilir, yoksa yeniden yaz). Her testten önce
  `(setsid nohup python3 -I qtest/sunucu.py &)` ile başlat (arka plan süreci tur sonunda ölür).
  `qtest/pt/` = onnxruntime-web 1.18 dist, @diffusionstudio/piper-wasm build, Piper modelleri.
- Playwright: `/tmp/pw/node_modules/playwright` + `/usr/bin/google-chrome`.
- Sahte kurulum: auth-guard boş; `DHProviders` `Object.defineProperty` ile (PROVIDERS, getModel, chat,
  realHasAnyKey, activeProviders, lastResponseInfo); groq isteği SSE ile taklit; `window.DH_PIPER_YOL`;
  sahte speechSynthesis; `[hidden]{display:none!important}`. addInitScript içinde `process.env` kullanma.
- Piper modelleri GitHub'dan (k2-fsa/sherpa-onnx releases) iner; huggingface.co ve jsdelivr erişilemez.

## Mimari özeti
- Saf HTML/JS PWA, GitHub Pages'te. Android kabuğu: `android-app/` (Capacitor, siteyi yükler).
- Giriş: Firebase Auth (`login.html`, `auth-guard.js`). Bulut: Firestore (`cloud-sync.js`), proje `sentencemode`, ücretsiz plan.
- Yapay zekâ: `ai-providers.js` (Groq/Cerebras/Gemini), anahtarlar kullanıcıda.
- Konuşkan (Deniz): `konuskan.html` + `konuskan/` (görüntülü ders `goruntulu.js`, Piper sesi `dh-piper*.js`).
  Konuşkan'ın durumu (`dh-konuskan-v1`) programın geri kalanından ayrı tutuluyor.
- **Koç (Deniz merkez koç):** `dh-koc-kilavuz.js` (kılavuz + sınırlar), `dh-koc-beyin.js` (hesaplanan + notlar/tercihler/hedef,
  Firestore `users/{uid}/koc/beyin`, `koc/hesap`, `koc_haftalik`), `dh-koc-deniz.js` (günlük plan; model cevabı olgu denetiminden
  geçmezse sıradaki model, en son kural planı), `koc-paneli.html`, `dh-koc-modu.js` (koç modu: auth-guard her sayfaya ekler, durum `dh-koc-modu-v1`). `DHProviders.chat` `opts.prefer/only` ile modele yönlendirilir.
- **Tek plan (24 Kasım):** günün planı yalnız Deniz'in (`dh-koc-deniz.js`). Müfredat adımları `yeni` (sıradaki modül,
  `DHProfile.nextModule`) ve `telafi` (`DHTelafi.bul`) koddan `a.mod` alır. Adım durumu her yerde `DHKocModu.planDurumu()`
  (süre %80 + koç modu; aynı sayfayı paylaşan adımlar süreyi sırayla böler). Eski okuyucular için Deniz planından
  `dh-koc-plan-<UTC gün>` köprü kaydı yazılır (`deniz:true`). Ana sayfa (`index.html` denizCiz) ve koç balonu plan kutusu
  Deniz'i gösterir; `koc.js` artık AI çağırmaz, yalnız sayı/kart çizer. Geri dönüş: localStorage `dh-ana-plan`=`eski`.
  `dh-plan.js` (DHPlan defteri) zararsız biçimde duruyor; Deniz modunda ölçü olarak kullanılmıyor.
  Kaldırıldı: `daily-dashboard.js`, `dh-learning-coach.js`.
- **Tekrar hesabı: `dh-fsrs.js` (FSRS-5) tek kaynak.** SM-2 kopyaları (assets/app.js `E()`, practice, tekrar, ogren, videopractice,
  sesli-calis, kelime-ogren, learning-error-system) `DHFSRS.notla`'yı çağırır, yoksa eski hesaba düşer. Kayıt alanları aynı
  (rep/ef/interval/due/last/lapses) + `f:{s,d}`, `alg:"fsrs5"`. Eski kart ilk FSRS notunda dönüşür; ilk aralık SM-2'nin 2 katıyla sınırlı.
  Yeni bir tekrar ekranı yazarken kendi aralık hesabını yazma, `DHFSRS.notla(kayit, "hard"|"good"|"easy"|1-4)` kullan.
- Ekran "bitti" sinyali: `window.dispatchEvent(new CustomEvent("dh-ekran-bitti",{detail:{bos}}))` → koç modu adımı bitirir.
- Deniz Telegram: `worker-deniz.js` + `wrangler-deniz.toml` (Cloudflare, KV `DENIZ`, sırlar yalnız Cloudflare'de), istemci
  `dh-deniz-telegram.js` (auth-guard ekler; bağlı değilse hiçbir şey göndermez), panelde "Deniz Telegram'da". Kurulum: `DENIZ-TELEGRAM.md`.
  Yayında: `https://dilharita-deniz.sametegeli.workers.dev` (Cloudflare hesabı sametegeli@gmail.com; panelden Edit code ile güncellenir).
- Cümle bankam: `cumle-bankam.html` (IndexedDB `dh-cumle-bankam`; bulut `users/{uid}/cumle_bankasi/p000..` 400'lük parçalar + `meta` + `ilerleme`).
  Kişisel cümle dosyası depoya konmaz; kullanıcı "Dosyadan içe aktar" ile yükler. `ilerleme` belgesi büyürse (1 MB) parçala.
- Kayıtlar: **`dh-olay.js` tek aktivite kaydı** (günlük özet `dh-gun-ozet-v1`, ham olay IndexedDB `dh-olay`); cevaplar
  `dh-cevap` olayıyla gelir (`dhCoachEvaluate`, `dhKonuskanCevap`, diğer ekranlar `window.dhCevapYay(ok, beceri, {hedef, cevap, konular, kaynak})`;
  yanlışta konu verilmezse dh-olay hedef/cevaptan `detectTypes` ile çıkarır). Ayrıca `dh-activity-log-v1` (30 gün), `dh-study-tracker-v1`,
  hata defteri, `srs:`/`wsrs:` tekrar kartları.

## Bilinen tuzaklar (yaşandı)
- **Firestore günlük okuma kotası (50.000):** Senkronun koleksiyonun tamamını okuması kotayı bitiriyordu
  (24 Kasım). Video kayıtları artık artımlı okunuyor (`dh-yt-pull-v1`). Yeni okuma kodu yazarken okuma sayısını hesapla.
- **Video kayıtlarının her açılışta yeniden yazılması (24 Kasım):** tam senkron `pushNow(true)` 65 videonun hepsini (~150 belge)
  her açılışta yazıyor, sayfa erken kapanınca eski parçalar öksüz kalıyordu. Artık video belgeleri yalnız imza değişince yazılır,
  yarım silmeler `dh-yt-silinecek-v1` ile tekrar denenir, haftada bir otomatik öksüz temizliği var (`dh-yt-temizlik-v1`).
  Koç anahtarlarından model durumu, hesap özeti ve eski günlük planlar buluta gitmez (`kocHaric`).
- **Firestore belge sınırı 1 MB:** Ayar/ilerleme belgeleri büyümesin; büyük veri ayrı alt koleksiyona.
- **API anahtarı kısıtı:** Browser key'de Token Service API izinli olmalı; yoksa oturum 1 saat sonra düşer
  ve her açılışta şifre sorulur (24 Kasım'da eklendi).
- **ai-providers.js:** son sağlayıcıda zaman sınırı eskiden 10 dk'ydı (tek modelli çağrı takılıyordu); `opts.only/prefer` ile artık `slowMs`.
- Gemini ücretsiz kotası sık doluyor (429), Cerebras ücretsiz hakkı bitti (402), NVIDIA Nemotron günlük plan için çok yavaş.
- **Etkin süre ve iframe videolar:** dh-olay 90 sn dokunulmazsa süreyi durdurur; YouTube iframe'i `<video>` olarak görünmez.
  Çözüm: IFrame API durum mesajları + `window.dhMedyaCaliyor()` kancası (24 Kasım). Yeni oynatıcı eklersen kancayı tanımla.
- **Taze tarayıcıda `sentence-mode` açılışı takılabiliyor** (yerel testte `indexedDB.open` 20 sn+ bekledi): müfredat hesabı
  12 sn zaman sınırlı; modül bulunamazsa plan `yeni` adımı olmadan kurulur.
- **Kullanıcının bilgisayar Chrome'unda "Dark Mode" eklentisi** (dmghijelimhndkbmpgbldicpogfkceaj, dark_2.css) sitenin renklerini griye çeviriyor; "renkler kayboldu" denirse önce bunu kontrol et.
- Android'de tarayıcı sesi perde/hız 1 değilse dil geçişlerinde 2–6 sn bekliyor; perde ve hız 1'de sabit.

## Şu anki sürümler (24 Kasım 2026)
sw `dh-sw-v652` (DERS DEFTERİ BULUTTA: dh-ders-defteri.js v4 → DHCloudSync.defter (cloud-sync v56: loadKoleksiyonSonra where guncel>son) users/{uid}/ders_defteri/{id}; değişiklik 4 sn sonra yazılır (bekleyen dh-defter-bekleyen-v1), açılışta artımlı çekiş (dh-defter-cek-v1), ilk açılışta bütün yerel defterler gönderilir (dh-defter-ilk-v1); SİLME artık var: DHDefter.sil → yerel + {silindi:true} işareti (dh-defter-silinen-v1), öbür cihazlar da siler; aynı cümle yeniden çalışılırsa silinmişlik kalkar; 900 KB üstü bulut kopyasında eski mesajlar kırpılır; DHDefter.sohbet(kim,metin): Deniz serbest sohbeti günlük 'Deniz sohbeti · <tarih>' defteri (tur:sohbet), etkin defteri değiştirmez; ders-defteri.html cloud-sync yükler, 🗑 Sil (confirm), sohbet kartında 'Deniz'le sohbet et'; goruntulu v103: üst çubukta 📒 data-a=defter → ders-defteri.html) · v651 (tam ekranda .explain-actions/.subject-play/.t-deniz gizli; html:not(.t-tam-acik) .t-tam-alt/.t-tam-cik display:none; çıkışta okuma durur + Duraklat gizlenir; fullscreenchange ile tarayıcı tam ekranından çıkınca kapanır) · v650 (öğretmen BEKLET/DEVAM: speakSegmentsSelf içinde _okumaKontrol {beklet: i=cur + cancel, devam: cancel+resume+aynı parçadan step}; speakFromScreen ikinci basış, Duraklat düğmesi ve tam ekran Bekle okumaCevir() kullanır; Android'de pause()/resume() sesi kaybediyordu) · v649 (networkFirst HTML'i fetch(url,{cache:'no-cache'}) ile ister: GitHub Pages max-age=600 yüzünden ?defter=1 gibi adresler eski kalıyordu) · teacher.html TAM EKRAN (⛶ #teacherTamBtn → html.t-tam-acik: sayfanın KENDİSİ tam ekran (üst çubuk, Menü, composer, araçlar gizli; canlı yüz .teacher-hero üstte fixed), altta #tTamAlt Söyle (=#explainListenBtn, yoksa son .qaListen) / Bekle (=dhTtsPauseBtn.onclick) / Dur (session++ + cancel); #tTamCik ✕ çıkar. OKUMA MANTIĞINA DOKUNULMADI (kullanıcı isteği; v647'deki ayrı okuyucu geri alındı). Test: sahte TTS SpeechSynthesis.prototype üzerine kurulmalı (ai-metin/dh-ses prototipi sarar)) · ders-defteri.html (📒 geçmiş: bütün defterler, arama, Öğretmende aç / Deniz'le çalış) · dh-ders-defteri.js v3 (KALICI ARŞİV IndexedDB dh-ders-defteri/defterler, id=kimlik(cumle), SİLME YOK; baslat yeni cümlede _bekliyor: arşivdeki eski kayıt birleştirilmeden arşive yazılmaz (yoksa eski konuşmalar ezilirdi), olay dh-defter-birlesti; listele/ac; etkin defter localStorage dh-ders-defteri-v1 {cumle,tr,aciklama,mesajlar[{kim Sen|Öğretmen|Deniz, metin, yer}]}; DHDefter.baslat/aciklama/ekle/al/konusulabilir(md→sesli satırlar, tablo satırı "Başlık: değer — …")) · teacher.html: .t-composer z-index 900 (eskiden 2147482000 idi, ayar/ses pencerelerinin Kapat düğmesini örtüyordu), pencere açıkken composer gizli, koyu alana dokun/Esc kapatır; başlıkta 📒 Defter; dh-defter-birlesti → eski soru-cevaplar .qa-gecmis ile; BOŞ açılır (excelveri ilk cümle kaldırıldı; boşken .subject hidden), ?defter=1 → defterGoster (açıklama + Öğretmen/Deniz etiketli soru-cevaplar, State.history bağlamı), renderExplanation/askFollowup deftere yazar, .t-tools telefonda ikişerli; başlık .t-ustbar (🎥 Deniz'le çalış #teacherDenizBtn, Ses, Ayar, Anahtar yazılı hap düğmeler; kolay görünüm etiketlemesin diye yazılı), telefonda fotoğraf 92px; her soru-cevapta .qaDeniz (denizeTasi({soru,cevap})); denizeTasi kurallar:getPrompt() de taşır → goruntulu sistem() analiz.kurallar'ı "TEACHER RULES" olarak ekler; FORMAT_KURALI + sistemPrompt() (kullanıcının talimatına EK: ## başlıklar + Markdown tablolar), tablosuz eski IndexedDB açıklaması yeniden üretilir, .dh-tablo stilleri; "🎥 Deniz'le sesli ve görüntülü çalış" (denizeTasi: localStorage dh-deniz-analiz {cumle,tr,src,ozet,t} → konuskan.html?deniz=analiz → konuskan.js startVideo(null,{ustte:true,analiz})); sohbet düzeni (#qaThread soru balonu sağda/cevap kartı solda, .t-composer altta position:fixed, #out padding-bottom 96px, araçlar .t-tools tek satır, askFollowup kutuyu temizler + scrollIntoView; test: Playwright serviceWorkers:"block" + auth-guard/cloud-sync stub, IIFE için route ile window.__t kancası) · cloud-sync.js v55 · gemini-bridge.js t23 (markdown: tablo desteği .dh-tablo) · konuskan.js v33 (?deniz=analiz; cümle yoksa düz görüntülü ders) · ai-providers.js t41 · auth-guard.js v19 · koc.js v7 · dh-olay.js v4 · youtube-egitim.js v128 · youtube-pratik.js t37 · immersive.js t31 · dh-insights.js v4 · dh-fsrs.js v1 · learning-error-system.js v12 · assets/app.js tm3 · dh-deniz-telegram.js v3 · coach-bubble.js t44 (balonBosYer: balon düğme/seçenek ya da h1-h3/.word/.pron/.qprompt üstündeyse ekranda boş yer arar, yoksa 2,5 sn sonra kapanır) · koc-paneli/konuskan.html: dh-koc-kilavuz v3 · dh-koc-beyin v9 · dh-koc-deniz v8 ·  dh-koc-modu v5 · goruntulu.js v102 (📘 Öğretmen düğmesi HER derste (defter varsa ?defter=1); analiz.defter: defterdeki soru-cevaplar vd-devam-not + st.hist, metniOku() açıklamayı (ya da odak cevabı) KELİMESİ KELİMESİNE okur — yapay zekâ çağrısı yok, parçaların dili dilTahmin; sor() Sen/Deniz mesajlarını deftere yazar; üst çubukta 📘 data-a=ogretmen → teacher.html?defter=1; analiz.kurallar → sistem talimatına öğretmen kuralları; kullanıcı konuşmaya başlayınca (400 ms) HER dinlemede yuz.klip("not"), D.notAldi dinleme başında sıfırlanır (eskiden hiç sıfırlanmıyordu) (5,3 sn, not.webm: klipisle.py not 0.4 50 155); cevap hazırlanırken dusunZ 900 ms: yuz.klip dusun-a (%70, 2,5 sn) / dusun-b (4,1 sn); kullanıcı konuşurken dinlerkenOnay: en fazla 15 sn'de bir %35 olasılıkla yuz.klip("onay") (3,75 sn); JEST listesinde alkis: modele "gerçek başarıda son övgü parçasında" denir; Kaydettiklerim galeri+önizleme; Kaydettiklerim kv dh-fon-kayitli; Arka plan türü ayar.fonTur video|resim|fon; kv dh-fon-resim-<fon>; fon videosu net, Pexels, kv dh-fon-video-<fon>, Başka video) · goruntulu.css v46 (geniş ekranda sağa dayalı) · dh-canli-yuz.js v92 (konuşma başında (i===0) oynayan klip varsa bitmesini bekler (benim.klipBekledi, alkisBitti); tekrarsiz(): son 3 klip tekrar seçilmez; baş hareketi aralığı 9–26 sn; soru cümlesinde %60 one_egil; 140+ harfli cümlede kendiliğinden jest olasılığı düşük; yeni klipler dusun-a/-b, onay (/home/claude/qtest/klipisle.py <mp4> <ad> K A B: lm3 + kamera K takip + rembg + renk + 8/12 uç harman + kenar); dinlerken alkis-az* parçaları kullanıcı isteğiyle listeden ÇIKARILDI (dosyalar duruyor); yaklas.webm: Deniz kameraya eğilip döner (kullanıcının Veo videosu, Downloads/dh-avatar/bekle-veo.mp4), /home/claude/qtest/yaklas.py: her 2. karede face-api noktaları (lm3, bk-NNN), kamera yüzü %60 takip eder, kareler 15–140; sohbetin İLK konuşmasından önce tam oynar (acilisYapildi, sec.acilisKlip=false kapatır) ve konuşma bekler; beklerken listeye yaklas-az1..4 (yaklaşmanın %25/45/70/100ü ileri-geri, 16 fps); beklerken baş hareketlerinin her 3.sü (klip.basSay%3==0) ileri-geri: alkis-az1/2/3/alkis-az (alkışın ilk %6/9/12/15i) ya da sac-az1..4 (el kaldırmanın ilk %6..15i, /tmp/sacfix karelerinden), gidiş+2 bekleme+ters, 16 fps (%20 yavaş), sessiz; alkış ÖNCE: konusAkis sonraki() sıradaki parça alkisMi ise klipOynat("alkis") + alkisBitti() bekler, sonra okur (konuşma başına bir kez, benim.alkisti); alkış sesi: KLIP_SES.alkis el birleşme saniyeleri, alkisSesi() WebAudio gürültü patlaması doğrudan destination'a (çözümleyiciye değil, ağız oynamasın), sec.klipSes=false kapatır, sec.klipSesGuc 0.55; alkış: cümlede jest "alkis" ya da metinde övgü sözcüğü (harika|aferin|bravo|tebrik|mükemmel|süpersin|çok güzel|well done|excellent|great job|perfect) → alkis.webm klibi; alkis.webm Veo geniş kadrajdı: /home/claude/qtest/alkis_zoom.py ile kamera 1.6x geri çekilip dönüyor, uçlar fotoğrafa 8/12 kare harman; sac-duzelt.webm sonu: baş 3,4° eğikti, son 25 karede ECC ile yavaşça düzeltildi; klip.dondur 0,5 sn; sola dönüş bas-sol/-az/-orta.webm hazır, KLIP_SOL=true, sağ/sol sırayla; Veo sol videosu yavaştı: hareketli kısım 24 kareye sıkıştırıldı, ilk 6 harman karesi korunur; vid.py artık landmark anahtarı alır: vid.py sol-0; netlik: canvas ekran çözünürlüğü ≤2x + shader unsharp uK=0.7 sec.keskin; klip video DOMa 4px eklenir, currentTime 1 sn durursa bırak, 2 hatada kapat; klip: readyState beklemeden oynat, bekle 3 sn / oynatma süre+2,5 sn zaman aşımı — telefonda donma; bas-sag tam da %95te kesik: varyant.py <kareler> <önek> 17 24 30; bakış jestleri bakOne/bakAsagi/basYukari/basAsagi; kliplerde kenar_video.py ile beyaz hale temizliği; klip kareleri araclar/avatar/sabitle.py ile yüz ECC sabitleme; klipSonrasi: göz düz, bitişte notr kalır; kare hazır değilse son video karesi korunur) (kaş katsayıları 9/8/7) (bas-sag-az/orta/tam rastgele; klipler tabanla aynı ilk/son kare: araclar/avatar/uc.py mantığı; göz yaması eşikli tek yön) (baş çevirme Deniz 10 sn+ susunca, 12–20 sn arayla sağ/sol sırayla: `bas-sol/bas-sag.webm` klipleri, `api.klip(ad)`) (bakSol/bakSag/bakYukari/gez jestleri) (GORSEL_SURUM 20261127a; `sac-duzelt.webm` klibi dinlerken 40–90 sn arayla, `api.klip()`; face.json `bakis` göz yamaları + `gulme` duygusu) · dh-piper.js v6 · dh-piper-isci.js v3
