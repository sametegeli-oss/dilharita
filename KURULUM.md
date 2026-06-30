# Çok Sağlayıcılı AI: Groq + Cerebras + Gemini (Aşamalı)

Artık öğretmen üç ücretsiz AI sağlayıcısını **aşamalı** kullanıyor: biri limite
takılırsa otomatik diğerine geçer. Hiçbiri ücret istemez (kart yok).

## Mantık
**Groq → Cerebras → Gemini** sırasıyla denenir. Bir sağlayıcı limitlenirse (429) veya
başarısız olursa, sıradaki devreye girer. Aynı sağlayıcının birden çok anahtarı varsa
onlar da sırayla denenir. Hepsi tükenirse kurallı moda düşülür (çökmez).

Sıra = öncelik: Groq en hızlı, o yüzden önce. Cerebras yüksek hacim. Gemini en cömert
(Google, günde 1.500 istek + dakikada 1M token) ama farklı format — yedek olarak ideal.

## Yeni dosya
- **`ai-providers.js`**: Merkezi AI katmanı. `DHProviders.chat(messages, opts)` tek
  fonksiyon — içinde üç sağlayıcı + fallback. Groq/Cerebras OpenAI-uyumlu; Gemini ayrı
  format (systemInstruction/contents/parts) otomatik çevriliyor.

## Anahtar girişi (teacher.html)
🔑 panelinde artık **üç bölüm** var: Groq, Cerebras, Gemini. Her birine ayrı anahtar
eklenir. En az biri yeterli. Ücretsiz alma linkleri panelde:
- Groq: console.groq.com/keys (gsk_...)
- Cerebras: cloud.cerebras.ai (csk-...)
- Gemini: aistudio.google.com/apikey (AIza...)

Anahtarlar localStorage'da ayrı saklanır: `groqApiKeys`, `cerebrasApiKeys`, `geminiApiKeys`.

## Güncellenen AI çağrıları (hepsi artık çok sağlayıcılı)
- Seviye testi: yazma değerlendirme + AI çeldirici
- Modül sınavı: yazma değerlendirme
- Modül hikayesi: hikaye üretimi
- Kayan öğretmen (teacher-bubble): sohbet
- Öğretmen sayfası (teacher.html): cümle analizi

`ai-status.js` (DHAI) artık "herhangi bir sağlayıcıda anahtar var mı" diye bakıyor
(sadece Groq değil).

## Dosyalar (13)
Yeni: `ai-providers.js`
Değişti: `ai-status.js`, `module-story.js`, `teacher-bubble.js`, `teacher.html`
(3 sağlayıcılı anahtar paneli + çok sağlayıcılı çağrı), `seviye-testi.html`,
`modul-testi.html`, ve ai-providers script'i eklenen sayfalar (`ders/harita/index/
library/pv-practice/phrasal-verbs.html`).

## Test edildi
- Aşamalı fallback: Groq limit→Cerebras, sadece Gemini, üçü birden ✓
- Gemini format çevirisi (system→systemInstruction, contents/parts) ✓
- Tüm sözdizimi (node --check) + script dengeleri ✓
- Geriye uyumluluk: sadece Groq anahtarıyla eskisi gibi çalışır ✓

## Önemli düzeltme
modul-testi.html'de eski bir string hatası (renderWrite feedback) vardı, bu pakette
düzeltildi.

## Yükledikten sonra
1. 13 dosyayı yükle, sert yenile (Ctrl+Shift+R).
2. teacher.html → 🔑 → istediğin sağlayıcı(lar)dan ücretsiz anahtar ekle.
3. Tek sağlayıcı yeterli; ama 2-3 eklersen biri limitlenince kesinti olmaz.

## Not
- Mevcut Groq anahtarların aynen çalışmaya devam eder — hiçbir şey kaybolmaz.
- Gemini ücretsiz katmanı en cömert; Groq limitleri 2026'da düştüğü için Cerebras/Gemini
  eklemek kesintiyi ciddi azaltır.
- Gemini istekleri Google tarafından eğitimde kullanılabilir (dil öğrenme için sorun değil).
