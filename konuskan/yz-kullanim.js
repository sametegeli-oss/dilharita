/* DHKullanim — yapay zekâ modellerinin bugünkü kullanımı (bu cihazda sayılır).
   - Sohbet modelleri: istek, giriş/çıkış token'ı (sağlayıcının döndürdüğü "usage"), hata sayısı.
   - Groq: yanıt başlıklarından günlük kalan istek; 429 mesajındaki "Limit/Used" ile günlük token durumu.
   - Gemini ses (TTS): istek sayısı ve "günlük kota doldu" durumu.
   Gün değişince (yerel saat) sıfırlanır. */
(function () {
  'use strict';
  const K = 'dh-yz-kullanim-v1';
  const gun = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function oku() {
    let d = null; try { d = JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) {}
    if (!d || d.gun !== gun()) d = { gun: gun(), m: {} };
    return d;
  }
  const dinle = new Set();
  function kaydet(saglayici, model, o) {
    o = o || {};
    const d = oku(), ad = saglayici + '|' + model;
    const a = d.m[ad] || (d.m[ad] = { istek: 0, giris: 0, cikis: 0, hata: 0 });
    ['istek', 'giris', 'cikis', 'hata'].forEach(k => { a[k] += +o[k] || 0; });
    if (o.kalanIstek != null) { a.kalanIstek = +o.kalanIstek; a.limitIstek = +o.limitIstek || a.limitIstek; }
    if (o.tokenLimit) { a.tokenLimit = +o.tokenLimit; a.tokenKullanilan = +o.tokenKullanilan; }
    if (o.dolu) a.doluBitis = o.dolu;
    if (o.ok) a.doluBitis = 0;
    a.son = Date.now();
    try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {}
    dinle.forEach(f => { try { f(); } catch (e) {} });
  }
  /* Groq yanıt başlıkları: x-ratelimit-*-requests günlük istek (RPD) */
  function basliklar(saglayici, model, h) {
    try {
      const lim = h.get('x-ratelimit-limit-requests'), kal = h.get('x-ratelimit-remaining-requests');
      if (lim && kal) kaydet(saglayici, model, { kalanIstek: kal, limitIstek: lim });
    } catch (e) {}
  }
  /* 429 metni: "Limit 200000, Used 199004" → günlük token durumu */
  function sinirMetni(saglayici, model, t, bitis) {
    const m = /Limit\s+(\d+),\s*Used\s+(\d+)/i.exec(t || '');
    kaydet(saglayici, model, Object.assign({ hata: 1 }, m && /per day|TPD/i.test(t) ? { tokenLimit: m[1], tokenKullanilan: m[2] } : {}, bitis ? { dolu: bitis } : {}));
  }
  /* Ücretsiz plan günlük token sınırları (Groq, yaklaşık; yalnız gösterim için) */
  const GUNLUK_TOKEN = { 'groq|openai/gpt-oss-120b': 200000, 'groq|openai/gpt-oss-20b': 200000 };
  const AD = { groq: 'Groq', gemini: 'Gemini', 'gemini-ses': 'Gemini ses', cerebras: 'Cerebras', openrouter: 'OpenRouter', mistral: 'Mistral' };
  function satirlar() {
    const d = oku(), simdi = Date.now();
    return Object.keys(d.m).map(ad => {
      const a = d.m[ad], [s, model] = ad.split('|');
      const top = a.giris + a.cikis;
      const limit = a.tokenLimit || GUNLUK_TOKEN[ad] || 0;
      const kullanilan = Math.max(top, a.tokenKullanilan || 0);
      return { ad, saglayici: AD[s] || s, s, model, istek: a.istek, giris: a.giris, cikis: a.cikis, toplam: top, hata: a.hata,
        limit, kullanilan, oran: limit ? Math.min(1, kullanilan / limit) : null,
        kalanIstek: a.kalanIstek, limitIstek: a.limitIstek, dolu: a.doluBitis && a.doluBitis > simdi ? a.doluBitis : 0, son: a.son };
    }).sort((x, y) => (y.son || 0) - (x.son || 0));
  }
  window.DHKullanim = { kaydet, basliklar, sinirMetni, satirlar, dinle: f => { dinle.add(f); return () => dinle.delete(f); } };
})();
