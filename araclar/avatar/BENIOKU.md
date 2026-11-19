# Avatar görsel hattı (Deniz)

Site bu klasörü kullanmaz; yalnız avatar görsellerini üretmek/güncellemek için.

## Akış
1. **Gemini'de görsel üret** (Chrome, Gemini "Hydrogen" modeli): duygunun referans fotoğrafı yüklenir, istem "Go back to the ORIGINAL photo… change ONLY the mouth…" kalıbıyla yazılır.
   Referanslar: düşünceli, anlayışlı, şaşkın, ciddi, meraklı için kullanıcının yüklediği orijinal fotoğraflar; yeni duygular için `duygu-mutlu.png` tabanı.
2. Görseller tek zip olarak indirilir (gerçek tıklamayla), `device_stage_files` ile alınır, `/tmp/fa/yeni2/` altına `{duygu}-{ses}.png`, `duygu-{ad}.png`, `{ad}-kirp.png` adlarıyla konur.
3. `lm3.py` + `lm3.html`: face-api ile 68 yüz noktası (yalnız yeni dosyalar) → `/tmp/fa/landmarks3.json`.
   Kurulum: `/tmp/fa` içinde `npm i @vladmandic/face-api`, `python3 -m http.server 8771` (lm3.html oradan açılır).
4. `isle3.py <duygu…>`: tabana hizala, rembg (isnet) ön plan maskesi, silüete kırp, ağız (AG=237,404,593,650) ve göz (GZ=261,268,552,355) yamaları + `face.json` agizSetleri/kirpma.
5. `isle4.py ad:ödünçSet …`: yeni duygu TABANI (hizala + arka plan sil + kenar temizle) ve face.json duygular/duyguAgiz/duyguKirpma.
6. `gor.py duygu:ses …` → `/tmp/gor.png` kontrol montajı.
7. `dh-canli-yuz.js` içindeki `GORSEL_SURUM`'u artır, sürüm referanslarını ve `sw.js` SW_VERSION'ı yükselt, yayınla.

`kenar.py` tabanları bir kez temizlemek içindi; **tekrar çalıştırma**.
`duman-testi.mjs` motoru başsız tarayıcıda dener; `agiz-zamanlama.mjs` ağız şekli zamanlamasını ölçer (`node`, `viseme-lang.js` + `dh-canli-yuz.js` gerekir).
