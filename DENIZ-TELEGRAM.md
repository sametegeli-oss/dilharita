# Deniz Telegram'da — kurulum

Deniz'in Telegram'dan yazması ("Deniz arar") ve onunla Telegram'dan yazışmak için küçük bir Cloudflare Worker gerekir.
Hepsi ücretsiz plan içinde kalır (saatte 1 kontrol, günde birkaç mesaj).

Gizli değerler (bot anahtarı, Groq anahtarı) yalnız Cloudflare'de durur; depoya ve uygulamaya yazılmaz.

## 1. Bot oluştur (telefonda, 2 dk)
1. Telegram'da **@BotFather**'a yaz: `/newbot`
2. Ad: `Deniz · Dil Harita` (istediğin ad olabilir). Kullanıcı adı `_bot` ile bitmeli, ör. `DenizDilHaritaBot`.
3. BotFather bir **anahtar** verir (`123456:ABC...`). Bunu kimseyle paylaşma; 3. adımda Cloudflare'e sen gireceksin.

## 2. Worker'ı yayınla
Bilgisayarda, depo klasöründe:
```
npx wrangler login
npx wrangler kv namespace create DENIZ          # çıkan id'yi wrangler-deniz.toml'daki BURAYA_KV_KIMLIGI yerine yaz
npx wrangler deploy -c wrangler-deniz.toml
```
Çıkan adres: `https://dilharita-deniz.<hesabın>.workers.dev`

## 3. Gizli değerleri gir (sen yazarsın)
```
npx wrangler secret put TELEGRAM_TOKEN -c wrangler-deniz.toml   # BotFather'ın anahtarı
npx wrangler secret put TG_SECRET -c wrangler-deniz.toml        # uydurduğun uzun rastgele bir metin (harf+rakam)
npx wrangler secret put GROQ_KEY -c wrangler-deniz.toml         # isteğe bağlı: Deniz'in sohbet cevapları için
```
(Cloudflare panelinden de olur: Workers → dilharita-deniz → Settings → Variables and Secrets.)

## 4. Telegram'ı sunucuya bağla
Tarayıcıda bir kez aç: `https://dilharita-deniz.<hesabın>.workers.dev/kur?sir=<TG_SECRET>` → "Tamam" yazmalı.

## 5. Programda bağlan
Koçluk Paneli → **Deniz Telegram'da** → sunucu adresini yaz → **Telegram'a bağla** → Telegram'da **Başlat**.

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
