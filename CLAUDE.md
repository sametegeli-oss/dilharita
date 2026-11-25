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
- Android'de tarayıcı sesi perde/hız 1 değilse dil geçişlerinde 2–6 sn bekliyor; perde ve hız 1'de sabit.

## Şu anki sürümler (24 Kasım 2026)
sw `dh-sw-v614` · cloud-sync.js v55 · ai-providers.js t40 · auth-guard.js v19 · koc.js v7 · dh-olay.js v4 · youtube-egitim.js v128 · youtube-pratik.js t37 · immersive.js t31 · dh-insights.js v4 · dh-fsrs.js v1 · learning-error-system.js v12 · assets/app.js tm3 · dh-deniz-telegram.js v3 · coach-bubble.js t43 · koc-paneli/konuskan.html: dh-koc-kilavuz v3 · dh-koc-beyin v9 · dh-koc-deniz v8 · konuskan.js v31 · dh-koc-modu v5 · goruntulu.js v89 · goruntulu.css v38 · dh-canli-yuz.js v75 (kliplerde kenar_video.py ile beyaz hale temizliği; klip.dondur 1 sn; klip kareleri araclar/avatar/sabitle.py ile yüz ECC sabitleme; klipSonrasi: göz düz, bitişte notr kalır; kare hazır değilse son video karesi korunur) (kaş katsayıları 9/8/7) (bas-sag-az/orta/tam rastgele; klipler tabanla aynı ilk/son kare: araclar/avatar/uc.py mantığı; AÇIK İŞ: bas-sol.webm yok, KLIP_SOL=false; Veo kotası yenilenince sola dönüş videosu üret, vid.py ile işle, KLIP_SOL=true; göz yaması eşikli tek yön) (baş çevirme Deniz 10 sn+ susunca, 12–20 sn arayla sağ/sol sırayla: `bas-sol/bas-sag.webm` klipleri, `api.klip(ad)`) (bakSol/bakSag/bakYukari/gez jestleri) (GORSEL_SURUM 20261125l; `sac-duzelt.webm` klibi dinlerken 40–90 sn arayla, `api.klip()`; face.json `bakis` göz yamaları + `gulme` duygusu) · dh-piper.js v6 · dh-piper-isci.js v3
