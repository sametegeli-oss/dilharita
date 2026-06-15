// ============================================================
// IPA TABANLI TELAFFUZ KARŞILAŞTIRMA
// Hedef kelimenin IPA'sı zaten veride var (sentences/sözlük).
// Kullanıcının söylediği (egzotik dil tanımasından gelen ham metin)
// kaba bir IPA/fonem dizisine çevrilir, sonra hizalanıp karşılaştırılır.
// Amaç: İngilizce kelimeye yuvarlamayı kırmak.
// ============================================================

// IPA dizgesini sade fonem dizisine indirge (vurgu/uzunluk işaretlerini at,
// yakın sesleri tek sınıfa topla). Karşılaştırma bunun üstünden yapılır.
export function normalizeIPA(ipa) {
  let s = String(ipa || '')
    .replace(/[\/\[\]ˈˌ.ˑ ]/g, '')   // slash, vurgu, nokta, boşluk
    .replace(/ː/g, '')                 // uzunluk işareti
    .toLowerCase();
  // yakın sesleri tek temsile indir (kaba)
  const map = {
    'ɑ': 'a', 'æ': 'a', 'ʌ': 'a', 'ɒ': 'o', 'ɔ': 'o', 'o': 'o',
    'ə': 'e', 'ɛ': 'e', 'e': 'e',
    'ɪ': 'i', 'i': 'i', 'iː': 'i',
    'ʊ': 'u', 'u': 'u',
    'θ': 't', 'ð': 'd', 'ʃ': 's', 'ʒ': 'j', 'tʃ': 'c', 'dʒ': 'j',
    'ŋ': 'n', 'ɹ': 'r', 'r': 'r', 'ɡ': 'g',
  };
  let out = '';
  for (const ch of s) out += (map[ch] || ch);
  return out;
}

// Türkçe okunuşu kaba fonem dizisine indir (textToPhonemes ile AYNI sınıflar)
export function trToPhonemes(tr) {
  let s = String(tr || '').toLocaleLowerCase('tr').replace(/[^a-zçğıöşü\s]/g, '').replace(/\s+/g, '');
  const map = {
    'â': 'a', 'î': 'i', 'û': 'u',
    'ı': 'i', 'ç': 'c', 'ş': 's', 'ğ': '', 'ö': 'o', 'ü': 'u',
    'q': 'k', 'x': 'ks', 'w': 'v', 'y': 'i',
  };
  let out = '';
  for (const ch of s) out += (map[ch] ?? ch);
  out = out.replace(/[ae]/g, 'a').replace(/[ou]/g, 'o'); // ünlü sınıfları
  return out;
}

// Needleman-Wunsch hizalama (fonem dizileri için)
export function alignSeq(e, t) {
  const n = e.length, o = t.length;
  const r = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: o + 1 }, (_, j) => (i === 0 ? -j : j === 0 ? -i : 0))
  );
  for (let a = 1; a <= n; a++)
    for (let b = 1; b <= o; b++)
      r[a][b] = Math.max(
        r[a - 1][b - 1] + (e[a - 1] === t[b - 1] ? 2 : -1),
        r[a - 1][b] - 1,
        r[a][b - 1] - 1
      );
  let a1 = '', a2 = '', s = n, l = o;
  while (s > 0 || l > 0) {
    if (s > 0 && l > 0 && r[s][l] === r[s - 1][l - 1] + (e[s - 1] === t[l - 1] ? 2 : -1)) {
      a1 = e[s - 1] + a1; a2 = t[l - 1] + a2; s--; l--;
    } else if (s > 0 && r[s][l] === r[s - 1][l] - 1) {
      a1 = e[s - 1] + a1; a2 = '-' + a2; s--;
    } else {
      a1 = '-' + a1; a2 = t[l - 1] + a2; l--;
    }
  }
  return { a1, a2 };
}

// İki fonem dizisini karşılaştır → renkli harf analizi + skor
export function comparePhonemes(targetSeq, spokenSeq) {
  const a = String(targetSeq || '');
  const b = String(spokenSeq || '');
  if (!a) return { letters: [], score: 0, correct: 0, wrong: 0, missing: 0 };
  if (!b) return { letters: a.split('').map((c) => ({ char: c, status: 'missing' })), score: 0, correct: 0, wrong: 0, missing: a.length };
  const { a1, a2 } = alignSeq(a, b);
  const letters = [];
  let correct = 0, wrong = 0, missing = 0;
  for (let i = 0; i < a1.length; i++) {
    const c = a1[i], d = a2[i];
    if (c === '-') continue;
    if (c === d) { letters.push({ char: c, status: 'ok' }); correct++; }
    else if (d === '-') { letters.push({ char: c, status: 'missing' }); missing++; }
    else { letters.push({ char: c, status: 'wrong', said: d }); wrong++; }
  }
  const total = correct + wrong + missing;
  const score = total ? Math.round((correct / total) * 100) : 0;
  return { letters, score, correct, wrong, missing };
}
