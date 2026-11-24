# Deniz Telegram'da — kurulum

Sunucu kuruldu (24 Kasım): `https://dilharita-deniz.sametegeli.workers.dev`
(Cloudflare Worker `dilharita-deniz`, KV `dilharita-deniz` → `DENIZ`, saatlik tetikleyici `0 * * * *`).
Program bu adresi kendisi kullanır.

Bot anahtarı ve Groq anahtarı yalnız Cloudflare'de durur; depoya ve uygulamaya yazılmaz.

## Kullanıcının yapacağı 2 adım
1. **Bot oluştur.**
   - Telegram'da @BotFather'a yaz: `/newbot`.
   - Ad olarak örneğin `Deniz · Dil Harita` ver. Kullanıcı adı `_bot` ile bitmeli.
   - BotFather'ın verdiği anahtarı kopyala.
2. **Anahtarları gir.**
   - Cloudflare → Workers & Pages → `dilharita-deniz` → Settings → Variables and Secrets → **Add**.
   - Type: **Secret**, Name: `TELEGRAM_TOKEN`, Value: bot anahtarı → **Deploy**.
   - İsteğe bağlı, Deniz'in sohbet cevapları için: aynı yerde `GROQ_KEY` = Groq anahtarı.

Sonra Koçluk Paneli → **Deniz Telegram'da** → **Telegram'a bağla** → Telegram'da **Başlat**.
Webhook ilk bağlanmada kendiliğinden kurulur; sırrı bot anahtarından türetilir.

Kontrol: `https://dilharita-deniz.sametegeli.workers.dev/saglik` → `tg:true` (ve Groq girildiyse `groq:true`).

## Kod güncellemesi
`worker-deniz.js` değişirse:
- Ya `npx wrangler deploy -c wrangler-deniz.toml` (wrangler girişi gerekir),
- ya da panelde Edit code → kodu yapıştır → Deploy.

## Ne olur
- Seçtiğin saatte (varsayılan 20:00) o gün 5 dakikadan az çalıştıysan Deniz yazar; düğmeye basınca koç modu açılır.
- Bota yazdıkların Deniz'e gider. "Yorgunum, kısa tut" ya da "bugün in/of çalışalım" dersen, programı açınca bugünkü plan buna göre ayarlanır.
- Komutlar: `/plan`, `/durum`, `/saat 21`, `/sessiz`, `/ayril`.
- Konuşma bitince kısa notlar gelir (panelden kapatılabilir).

## Worker'ın sakladığı veriler (Cloudflare KV)
- Bugünkü dakikan, planın ve koç bağlamı: program saatte bir günceller.
- Telegram sohbet kimliği.
- Son 12 sohbet mesajı.

"Bağlantıyı kaldır" bunların hepsini siler.
