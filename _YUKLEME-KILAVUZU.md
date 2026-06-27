# 📦 TÜM DOSYALAR — Birleşik Yükleme

Menüde yeni kartları görmüyorsan sebebi: güncellenmiş dosyalar henüz GitHub'a yüklenmemiş.
Bu klasördeki **11 dosyanın hepsini** reponun KÖK dizinine (index.html ile aynı yere) yükle. Hepsi mevcut dosyaların üzerine yazılır veya yenisini ekler.

## Yüklenecek dosyalar

| Dosya | Yeni mi? | Ne için |
|-------|----------|---------|
| `index.html` | değiştir | **← Menüdeki yeni kartlar bunda.** Harita + PV Pratiği kartları, bildirim kartı |
| `notifications.js` | yeni | Bildirim sistemi |
| `sw.js` | değiştir | Service worker (bildirim destekli) |
| `firebase-messaging-sw.js` | yeni | Firebase push alıcısı |
| `phrasal-verbs.html` | değiştir | Frekans sıralama + öğrenme durumu |
| `pv-practice.html` | yeni | Phrasal verb pratiği (3 mod) |
| `progress-engine.js` | yeni | Ortak ilerleme motoru |
| `harita.html` | yeni | İlerleme haritası sayfası |
| `study-tracker.js` | değiştir | PV pratiği takibi |
| `library.html` | değiştir | Kelime öğrenme işaretleme |
| `videopractice.html` | değiştir | Video → cümle ilerlemesi |

## Nasıl yüklenir? (GitHub web arayüzü)
1. https://github.com/sametegeli-oss/dilharita adresine git.
2. Sağ üstte **"Add file" → "Upload files"** tıkla.
3. Bu klasördeki 11 dosyayı sürükle-bırak.
4. Aşağıda **"Commit changes"** ile onayla.
5. GitHub Pages 1-2 dakikada günceller.
6. Siteyi aç, **sayfayı yenile** (gerekirse Ctrl+Shift+R ile sert yenile — eski sürüm önbellekte kalmış olabilir).

## Yükledikten sonra menüde görmen gerekenler
- 🗺️ İlerleme Haritası (en üstte)
- 🎯 Phrasal Verb Pratiği (Phrasal Verbs'in altında)
- 🔔 Günlük Hatırlatma kartı (kartların altında, ayrı bölüm)

## Hâlâ görünmüyorsa
- **Sert yenileme yap:** Ctrl+Shift+R (mobilde tarayıcı önbelleğini temizle).
- Menüdeki **"🧹 Önbellek Temizle"** sayfasını aç, sonra ana sayfayı yeniden aç.
- GitHub'da `index.html`'in gerçekten güncellendiğini kontrol et (dosyaya tıklayıp `harita.html` geçiyor mu bak).

## Önemli not — bağımlılıklar
- `data/phrasal-verbs.json` (881 kayıtlık, çevirili) reponun `data/` klasöründe olmalı.
- Bildirimlerin Firebase push kısmı için VAPID anahtarı gerekiyor (Adım 1 kılavuzunda). Sadece yerel hatırlatma istersen o ayara gerek yok.
