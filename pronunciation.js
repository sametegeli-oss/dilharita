// ============================================================
// TELAFFUZ — egzotik dil ile dinle + IPA/fonem karşılaştırması
// İngilizce/Türkçe DIŞINDA bir dil koduyla dinleyince motor sesi
// kelimeye yuvarlayamaz; ham heceleri yazar. Bunu fonem dizisine
// çevirip hedefin IPA'sıyla karşılaştırırız.
// ============================================================

export function isSpeechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Denenecek diller: İngilizce/Türkçe bilmeyen, latin alfabesi yazan diller.
// Sesi kelimeye yuvarlamadan, duyduğu heceleri yazmaya en yatkın olanlar.
const TRY_LANGS = ['ms-MY', 'id-ID', 'sw-KE', 'fil-PH'];

// Tek dille dinle → ham metin (Promise<string>)
function listenOne(lang) {
  return new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return reject(new Error('Tarayıcı ses tanımayı desteklemiyor. Chrome veya Edge kullanın.'));
    const rec = new SR();
    rec.lang = lang;
    rec.maxAlternatives = 1;
    rec.interimResults = false;
    rec.continuous = false;
    let got = '';
    rec.onresult = (e) => { got = (e.results[0][0].transcript || '').toLowerCase().trim(); };
    rec.onerror = (e) => {
      const map = {
        'no-speech': 'Ses algılanamadı. Tekrar dene.',
        'not-allowed': 'Mikrofon izni gerekli.',
        'audio-capture': 'Mikrofona ulaşılamadı.',
        'language-not-supported': '__SKIP__',
        'aborted': null,
      };
      const msg = map[e.error];
      if (msg === '__SKIP__') resolve('__UNSUPPORTED__');
      else if (msg !== null) reject(new Error(msg || ('Hata: ' + e.error)));
    };
    rec.onend = () => resolve(got);
    try { rec.start(); } catch (err) { reject(err); }
    listenOne._active = rec;
  });
}

// Tek bir kayıt: ilk desteklenen egzotik dille dinle.
// (Aynı anda tek mikrofon olduğu için sırayla deneyemiyoruz; ilk
//  desteklenen dili kullanırız. Desteklenmezse en-US'a düşeriz.)
let _chosenLang = null;

export async function listen() {
  // daha önce çalışan bir dil bulduysak onu kullan
  const order = _chosenLang ? [_chosenLang, ...TRY_LANGS, 'en-US'] : [...TRY_LANGS, 'en-US'];
  for (const lang of order) {
    try {
      const r = await listenOne(lang);
      if (r === '__UNSUPPORTED__') continue;
      _chosenLang = lang;
      return { text: r, lang };
    } catch (e) {
      // mikrofon/izin hatası → kullanıcıya ilet, döngüyü kır
      throw e;
    }
  }
  return { text: '', lang: 'en-US' };
}

export function stopListening() {
  try { if (listenOne._active) listenOne._active.stop(); } catch {}
}

// Ham tanınan metni kaba fonem dizisine çevir (latin harf → fonem sınıfı)
export function textToPhonemes(text) {
  let s = String(text || '').toLowerCase().replace(/[^a-zçğıöşü\s]/g, '').replace(/\s+/g, '');
  const map = {
    'ı': 'i', 'ç': 'c', 'ş': 's', 'ğ': '', 'ö': 'o', 'ü': 'u',
    'c': 'c', 'j': 'j', 'q': 'k', 'x': 'ks', 'w': 'v', 'y': 'i',
  };
  let out = '';
  for (const ch of s) out += (map[ch] ?? ch);
  // ünlü/ünsüz yakınlaştırma (IPA normalize ile aynı sınıflar)
  out = out.replace(/[ae]/g, 'a').replace(/[ou]/g, 'o');
  return out;
}
