# "Bana özel ders" aracı — kurulum (isteğe bağlı)

Bu araç kurulmazsa da "Bana özel ders" çalışır:

- **Kendi yapay zekâ anahtarı olan kullanıcı:** Ders tek dokunuşla hazırlanır.
- **Anahtarı olmayan kullanıcı:** Gemini penceresi açılır ve ders kopyala-yapıştır ile hazırlanır.

Araç kurulursa anahtarı olmayan kullanıcı da dersi tek dokunuşla alır. Bunun için Gemini **sizin** anahtarınızla çağrılır. Anahtar yalnızca Cloudflare'de durur, kullanıcıların telefonuna hiç inmez.

## Bedeli ve sınırlar

- Gemini'nin ücretsiz kotası bütün kullanıcılar arasında paylaşılır. Kota dolarsa kullanıcı "biraz sonra tekrar deneyin" mesajı görür.
- Bir cihaz günde en çok 3 ders alır. Araç, yeniden denemeler için cihaz başına 6 üretim isteğine izin verir.
- Bir IP adresinden günde en çok 40 istek kabul edilir.
- İstek yalnızca `sametegeli-oss.github.io` adresinden gelirse kabul edilir.

## Kurulum (yaklaşık 10 dakika)

1. https://dash.cloudflare.com adresinde ücretsiz bir hesap açın (varsa giriş yapın).
2. **Workers & Pages → Create → Create Worker** yolunu izleyin. Ad olarak `dilharita-ozel` yazın ve **Deploy**'a basın.
3. **Edit code**'a basın. Oradaki kodun tamamını silin, depodaki `worker-ozel-ders.js` dosyasının içeriğini yapıştırın ve **Deploy**'a basın.
4. **Settings → Variables and Secrets → Add** yolunu izleyin:
   - Type: **Secret**
   - Name: `GEMINI_API_KEY`
   - Value: Gemini anahtarınız (https://aistudio.google.com/apikey adresinden alınır)

   Kaydedin. Anahtarı kimseyle (Claude dahil) paylaşmanıza gerek yok.
5. (Önerilir) Sayaçların kalıcı olması için KV ekleyin:
   - **Storage & Databases → KV → Create** ile `dilharita-sinir` adında bir KV oluşturun.
   - Worker'da **Settings → Bindings → Add → KV namespace** yolunu izleyin. Variable name olarak `SINIR` yazın ve az önce oluşturduğunuz KV'yi seçin.
6. Worker adresini kopyalayın. Adres şuna benzer: `https://dilharita-ozel.KULLANICIADINIZ.workers.dev`

   Denemek için tarayıcıda adresin sonuna `/saglik` ekleyip açın. `{"ok":true,"anahtar":true}` görmelisiniz.
7. Adresi Claude'a verin. Claude bu adresi `dh-ozel-ders.js` içindeki `ARACI_ADRES` satırına yazar ve yayınlar.

## Kapatmak

- `ARACI_ADRES` satırını boş bırakın (`""`). Uygulama bu araca hiç istek göndermez.
- Ya da Cloudflare'de Worker'ı silin.
