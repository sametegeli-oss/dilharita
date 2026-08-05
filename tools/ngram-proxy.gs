/**
 * ngram-proxy.gs — Google Books Ngram için CORS köprüsü
 * ====================================================================
 * NEDEN GEREKLİ
 * books.google.com/ngrams/json cevabında Access-Control-Allow-Origin
 * başlığı yok. Bu yüzden dilharita gibi statik bir siteden doğrudan
 * fetch edilemez: tarayıcı isteği daha göndermeden engeller. Bu betik
 * araya girer, Google'dan veriyi sunucu tarafında alır ve tarayıcının
 * kabul edeceği biçimde geri verir.
 *
 * KURULUM (5 dakika, ücretsiz, sunucu gerekmez)
 *  1. script.google.com adresine git → "Yeni proje".
 *  2. Editördeki her şeyi sil, bu dosyanın tamamını yapıştır.
 *  3. Sağ üstten "Dağıt" (Deploy) → "Yeni dağıtım".
 *  4. Tür olarak "Web uygulaması"nı seç.
 *       Yürüten (Execute as): Ben
 *       Erişimi olan (Who has access): Herkes  ← bu şart
 *  5. "Dağıt" de, izin ekranını onayla. Sana şuna benzer bir adres verir:
 *       https://script.google.com/macros/s/AKfy..../exec
 *  6. Bu adresi uygulamaya tanıt. En kolayı, tarayıcı konsolunda bir kez:
 *       localStorage.setItem("dh-ngram-proxy","BURAYA_ADRESI_YAPISTIR")
 *     Kalıcı olsun istersen index.html içine şu satırı ekleyebilirsin:
 *       <script>window.DH_NGRAM_PROXY="BURAYA_ADRESI_YAPISTIR";</script>
 *
 * SINIRLAR
 *  - Apps Script ücretsiz kotası günde ~20.000 UrlFetch çağrısıdır;
 *    tek kullanıcı için fazlasıyla yeterli.
 *  - Google, Ngram uç noktasına arka arkaya gelen isteklerde 429/503
 *    dönebiliyor. Bu yüzden burada 6 saatlik sunucu önbelleği var,
 *    ayrıca word-popup.js tarafında 30 günlük tarayıcı önbelleği.
 *  - Uygulama tek istekte tüm eş anlamlıları sorar (content=a,b,c),
 *    böylece bir popup açılışı = bir çağrı.
 */

var NGRAM = 'https://books.google.com/ngrams/json';
var ONBELLEK_SN = 6 * 60 * 60;   // 6 saat

function doGet(e) {
  var p = (e && e.parameter) || {};
  var content = String(p.content || '').trim();

  if (!content) {
    return cikti([]);
  }

  // Anahtar: aynı sorgu tekrar gelirse Google'a hiç gitme.
  var sorgu = [
    'content=' + encodeURIComponent(content),
    'year_start=' + (p.year_start || '2015'),
    'year_end=' + (p.year_end || '2019'),
    'corpus=' + (p.corpus || 'en-2019'),
    'smoothing=' + (p.smoothing || '3'),
    'case_insensitive=false'
  ].join('&');

  var cache = CacheService.getScriptCache();
  var anahtar = 'ng_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, sorgu));

  var hazir = cache.get(anahtar);
  if (hazir) {
    return ContentService.createTextOutput(hazir)
      .setMimeType(ContentService.MimeType.JSON);
  }

  var metin;
  try {
    var r = UrlFetchApp.fetch(NGRAM + '?' + sorgu, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        // Google, tarayıcı gibi görünmeyen isteklere sık sık 403 dönüyor.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*'
      }
    });
    if (r.getResponseCode() !== 200) {
      return cikti({ hata: 'ngram-' + r.getResponseCode() });
    }
    metin = r.getContentText();
    JSON.parse(metin);           // bozuk cevabı önbelleğe almayalım
  } catch (err) {
    return cikti({ hata: String(err) });
  }

  // 100 KB üstü Apps Script önbelleğine sığmaz; sığmıyorsa sessiz geç.
  try { cache.put(anahtar, metin, ONBELLEK_SN); } catch (err2) {}

  return ContentService.createTextOutput(metin)
    .setMimeType(ContentService.MimeType.JSON);
}

function cikti(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
