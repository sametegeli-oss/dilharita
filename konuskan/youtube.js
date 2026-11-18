/* DHYouTube — YouTube Data API v3 ile video arama (tarayıcıda, API anahtarıyla; giriş gerekmez).
   - Anahtar: localStorage "youtubeApiKeys" (dizi; yalnız sametegeli-oss.github.io'dan çalışacak şekilde kısıtlı).
   - Kota: arama (search.list) için günde ~100 çağrı ayrı kovada; video ayrıntısı (videos.list) 1 birim.
     Aynı arama bu oturumda tekrar edilirse kotadan yemez (önbellek).
   - Model aracı: youtube_ara → kısa liste döner; uygulama sonuçları kart olarak gösterir. */
(function () {
  'use strict';
  const KS = 'youtubeApiKeys';
  const anahtar = () => { try { return ((JSON.parse(localStorage.getItem(KS) || '[]') || []).filter(Boolean))[0] || ''; } catch (e) { return ''; } };
  function anahtarKaydet(k) {
    k = String(k || '').trim();
    try { localStorage.setItem(KS, JSON.stringify(k ? [k] : [])); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('dh-keys-changed', { detail: { store: KS } })); } catch (e) {}
  }
  const onbellek = new Map();
  const cozHtml = s => { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; };
  function sure(iso) {   /* PT1H2M3S → 1:02:03 */
    const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || ''); if (!m) return '';
    const h = +m[1] || 0, d = +m[2] || 0, s = +m[3] || 0;
    return (h ? h + ':' + String(d).padStart(2, '0') : d) + ':' + String(s).padStart(2, '0');
  }
  const saniye = iso => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || ''); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
  async function getir(url) {
    const r = await fetch(url, { referrerPolicy: 'strict-origin-when-cross-origin' });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) {
      const neden = j && j.error && ((j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || j.error.status) || ('http_' + r.status);
      throw { code: /quota/i.test(neden) ? 'yt_kota' : /keyInvalid|API_KEY_INVALID|referer|Referer|forbidden/i.test(neden + (j && j.error && j.error.message || '')) ? 'yt_anahtar' : 'yt_hata', neden, mesaj: j && j.error && j.error.message };
    }
    return j;
  }
  /* a: { sorgu, dil:'en'|'tr'|'', sure:'kisa'|'orta'|'uzun'|'', altyazili:bool, adet:1-8 } */
  async function ara(a) {
    a = a || {};
    const k = anahtar(); if (!k) throw { code: 'yt_anahtar_yok' };
    const sorgu = String(a.sorgu || '').trim().slice(0, 120); if (!sorgu) throw { code: 'yt_sorgu_yok' };
    const adet = Math.max(1, Math.min(8, +a.adet || 5));
    const p = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', safeSearch: 'moderate', maxResults: String(adet), q: sorgu, key: k });
    if (a.dil === 'en' || a.dil === 'tr') p.set('relevanceLanguage', a.dil);
    if (a.altyazili) p.set('videoCaption', 'closedCaption');
    const SURE = { kisa: 'short', orta: 'medium', uzun: 'long' }; if (SURE[a.sure]) p.set('videoDuration', SURE[a.sure]);
    const ad = p.toString().replace(/&key=[^&]*/, '');
    if (onbellek.has(ad)) return onbellek.get(ad);
    const KUL = window.DHKullanim;
    let s;
    try { s = await getir('https://www.googleapis.com/youtube/v3/search?' + p); if (KUL) KUL.kaydet('youtube', 'arama', { istek: 1, ok: true }); }
    catch (e) { if (KUL) KUL.kaydet('youtube', 'arama', Object.assign({ hata: 1 }, e.code === 'yt_kota' ? { dolu: yarinPasifik() } : {})); throw e; }
    const idler = (s.items || []).map(x => x.id && x.id.videoId).filter(Boolean);
    let ayr = { items: [] };
    if (idler.length) { try { ayr = await getir('https://www.googleapis.com/youtube/v3/videos?' + new URLSearchParams({ part: 'snippet,contentDetails,statistics', id: idler.join(','), key: k })); } catch (e) {} }
    const bilgi = {}; (ayr.items || []).forEach(v => { bilgi[v.id] = v; });
    const videolar = idler.map(id => {
      const v = bilgi[id] || {}, sn = v.snippet || (s.items.find(x => x.id.videoId === id) || {}).snippet || {};
      const cd = v.contentDetails || {}, stt = v.statistics || {};
      return { id, baslik: cozHtml(sn.title), kanal: cozHtml(sn.channelTitle), sure: sure(cd.duration), saniye: saniye(cd.duration),
        altyazi: cd.caption === 'true', izlenme: +stt.viewCount || 0, tarih: (sn.publishedAt || '').slice(0, 10),
        aciklama: cozHtml(sn.description || '').replace(/\s+/g, ' ').slice(0, 300), dil: sn.defaultAudioLanguage || sn.defaultLanguage || '' };
    });
    onbellek.set(ad, videolar);
    return videolar;
  }
  function yarinPasifik() {   /* YouTube kotası Pasifik gece yarısı yenilenir */
    try {
      const simdi = new Date(), la = new Date(simdi.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const fark = simdi - la, ert = new Date(la); ert.setHours(24, 0, 0, 0); return +ert + fark;
    } catch (e) { return Date.now() + 12 * 3600000; }
  }
  /* model aracı */
  const ARAC = { type: 'function', function: { name: 'youtube_ara', description: 'Search YouTube for videos the user can watch inside the app (results are shown to the user as clickable cards). Use when the user asks for a video, or when a short video would really help (e.g. an English listening practice video at their level). Costs daily quota: call at most once per user request.',
    parameters: { type: 'object', properties: {
      sorgu: { type: 'string', description: 'Search query, written the way YouTube users search (English query for English-learning videos).' },
      dil: { type: 'string', enum: ['en', 'tr'], description: 'Preferred video language' },
      sure: { type: 'string', enum: ['kisa', 'orta', 'uzun'], description: 'kisa < 4 min, orta 4-20 min, uzun > 20 min' },
      altyazili: { type: 'boolean', description: 'Only videos with closed captions (recommended for English learning)' },
      adet: { type: 'integer', description: '1-6, default 4' } }, required: ['sorgu'] } } };
  async function aracCalistir(argMetin) {
    let a = {}; try { a = JSON.parse(argMetin || '{}') || {}; } catch (e) {}
    a.adet = Math.min(6, +a.adet || 4);
    try {
      const v = await ara(a);
      return { videolar: v, model: JSON.stringify({ videolar: v.map((x, i) => ({ no: i + 1, baslik: x.baslik, kanal: x.kanal, sure: x.sure, altyazi: x.altyazi, izlenme: x.izlenme, aciklama: x.aciklama.slice(0, 140) })), not: 'The app already shows these as cards the user can tap to watch. Mention at most 2-3 briefly by number/title; do not read out URLs or ids.' }) };
    } catch (e) {
      const m = { yt_anahtar_yok: 'YouTube anahtarı eklenmemiş (ayarlar → YouTube anahtarı).', yt_kota: 'YouTube günlük arama kotası doldu; yarın öğlen civarı yenilenir.', yt_anahtar: 'YouTube anahtarı geçersiz ya da bu siteye izin vermiyor.' }[e.code] || 'YouTube araması yapılamadı.';
      return { videolar: [], hata: m, model: JSON.stringify({ hata: m }) };
    }
  }
  window.DHYouTube = { hazir: () => !!anahtar(), anahtar, anahtarKaydet, ara, ARAC, aracCalistir };
})();
