/* goruntulu.js — Konuşkan "Görüntülü ders": canlı yüzlü öğretmenle tam ekran sohbet
   ==========================================================================
   konuskan.js'ten SONRA yüklenir; onun ortak parçalarını kullanır:
   ai(), S, LEVEL_GUIDE, learnerContext(), addError(), removeError(), addXP(),
   markDone(), trivialDiff(), diffHTML(), dict/micTarget/micLive, pickVoice(),
   speak(), openPanel(), closePanel(), toast(), aiErr(), esc(), ROLEPLAYS,
   geminiKeys(), blobToB64(), loadDict(), dictLookup().
   Avatar: dh-canli-yuz.js (DHCanliYuz) — duygu fotoğrafları + WebGL esnetme.

   SES TANIMA (v2)
     - Tarayıcının tanıması yalnız CANLI ÖNİZLEME içindir (yazı akarken görünür).
     - Asıl metin: konuşma kaydedilir (MediaRecorder), 16 kHz WAV'a çevrilir ve
       Dil Harita'daki Gemini anahtarıyla yazıya dökülür. Öğrencinin hataları
       DÜZELTİLMEDEN, söylendiği gibi yazılır. Gemini yoksa / hata verirse
       tarayıcının metni kullanılır.
     - "Sustu mu?" kararı gerçek ses seviyesinden verilir (ortam gürültüsü
       ölçülüp eşik ona göre ayarlanır); bekleme süresi ayarlardan değişir.
   SOHBET AKIŞI
     - Yanda (telefonda alttan açılan) sohbet: öğretmen mesajına dokununca
       öğretmen aynı ifadelerle tekrar söyler; her mesajda Türkçe düğmesi.
     - Öğrenci mesajlarının düzeltmesi mesajın altında görünür.
     - Öğretmen mesajındaki bir kelimeye dokununca sözlük anlamı + karta ekle. */
"use strict";
(function () {
  if (!window.DHCanliYuz) return;
  MODE_TR.video = 'Görüntülü ders';
  const VI = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    kb: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
    again: '<path d="M4 4v6h6"/><path d="M20 12a8 8 0 1 1-2.3-5.7L20 9"/>',
    end: '<path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3-1.5v-2.5a10 10 0 0 0-7 0V16l-3 1.5z"/>',
    cc: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10.5 10.2a2.2 2.2 0 1 0 0 3.6M17 10.2a2.2 2.2 0 1 0 0 3.6"/>',
    chat: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    ok: '<path d="M5 12l5 5L20 7"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    spk: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    send: '<path d="M4 12l16-8-6 16-2-6z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    video: '<rect x="2" y="6" width="13" height="12" rx="2.5"/><path d="M15 10.5l6-3.5v10l-6-3.5z"/>'
  };
  const vi = (n, c = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${c}>${VI[n]}</svg>`;
  const OGRETMEN = 'Deniz';
  const PERSONA = `${OGRETMEN}, a warm, patient and genuinely interested English teacher on a one-to-one video lesson`;
  const DUYGU = ['notr', 'mutlu', 'cesaret', 'merak', 'dusunceli', 'anlayisli', 'saskin', 'ciddi', 'gururlu'];
  const JEST = ['onay', 'iki_onay', 'hayir', 'egil', 'one_egil', 'dusun', 'kas'];
  const AYAR_KEY = 'dh-konuskan-video-v1';
  const genis = () => window.matchMedia('(min-width: 1000px)').matches;
  let ayar = { ellerSerbest: true, altyaziTR: false, altyazi: true, hassas: true, sessizlik: 2.0, sohbet: null };
  try { Object.assign(ayar, JSON.parse(localStorage.getItem(AYAR_KEY) || '{}')); } catch (e) {}
  const ayarKaydet = () => { try { localStorage.setItem(AYAR_KEY, JSON.stringify(ayar)); } catch (e) {} };

  function konular() {
    return [
      { id: 'free', t: 'Serbest sohbet', s: 'Günün, hayatın, ilgi alanların', persona: PERSONA + ` who chats about the learner's daily life` + (S.goal ? ` and their goal (${S.goal})` : '') },
      { id: 'weekend', t: 'Hafta sonu planları', s: 'Geçmiş ve gelecek zaman pratiği', persona: PERSONA + ' who asks about the learner\'s last and next weekend' },
      { id: 'travel', t: 'Seyahat', s: 'Gezdiğin ve görmek istediğin yerler', persona: PERSONA + ' who talks about travel experiences and dream destinations' },
      { id: 'work', t: 'İş ve okul', s: 'Ne yaptığını anlatma', persona: PERSONA + ' who talks about the learner\'s work or studies' },
      ...ROLEPLAYS.map(r => ({ id: 'rp-' + r.id, t: r.t, s: 'Rol yapma · ' + r.tasks.length + ' görev', persona: r.r + ' (on a video call, staying friendly and patient with an English learner)', tasks: r.tasks, scene: r.t }))
    ];
  }

  /* ================= Ses kaydı + Gemini ile yazıya dökme ================= */
  async function wav16k(blob) {
    const ab = await blob.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
    let buf; try { buf = await ac.decodeAudioData(ab); } finally { try { ac.close(); } catch (e) {} }
    const hz = 16000, n = Math.ceil(buf.duration * hz);
    const off = new OfflineAudioContext(1, Math.max(1, n), hz);
    const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
    const r = await off.startRendering(); const d = r.getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + d.length * 2));
    const yaz = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    yaz(0, 'RIFF'); out.setUint32(4, 36 + d.length * 2, true); yaz(8, 'WAVE'); yaz(12, 'fmt '); out.setUint32(16, 16, true);
    out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, hz, true); out.setUint32(28, hz * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
    yaz(36, 'data'); out.setUint32(40, d.length * 2, true);
    for (let i = 0; i < d.length; i++) { const v = Math.max(-1, Math.min(1, d[i])); out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
    return new Blob([out], { type: 'audio/wav' });
  }
  const KOTA_KEY = 'dh-gemini-kota-v1';
  function kotaOku() { try { const k = JSON.parse(localStorage.getItem(KOTA_KEY) || '{}'); return k.gun === today() ? (k.m || {}) : {}; } catch (e) { return {}; } }
  function kotaDoldu(m) { const k = kotaOku(); k[m] = 1; try { localStorage.setItem(KOTA_KEY, JSON.stringify({ gun: today(), m: k })); } catch (e) {} }
  async function geminiYaziya(blob, ipucu, dilIpucu) {
    const keys = geminiKeys(); if (!keys.length) throw { code: 'no_gemini' };
    const wav = await wav16k(blob); const b64 = await blobToB64(wav);
    /* Yazıya dökme basit bir iş: önce kotası geniş "lite" model; o gün kotası dolan model atlanır. */
    const secili = (DHProviders.getModel && DHProviders.getModel('gemini')) || 'gemini-3.6-flash';
    const kota = kotaOku(); const modeller = ['gemini-3.5-flash-lite', secili, 'gemini-3.5-flash', 'gemini-3.6-flash'].filter((m, i, A) => A.indexOf(m) === i && !kota[m]);
    if (!modeller.length) throw { code: 'rate' };
    const prompt = `Transcribe this audio of a Turkish learner (English level CEFR ${S.level}) in an English lesson. They may speak English, Turkish, or a mix of both.
Write EXACTLY what they said, word for word, each part in the language it was spoken (Turkish with correct Turkish letters ç ğ ı ö ş ü). Do NOT correct the English: grammar, tense, article and word-choice mistakes must stay as spoken. Do not translate. Do not add words they did not say. Remove only fillers like "uh", "um", "eee", "şey".
${dilIpucu === 'tr' ? 'The learner is in TURKISH study mode: they mostly speak Turkish, sometimes an English practice sentence. Write the Turkish parts in Turkish and the English parts in English.\n' : ''}NEVER translate: if they spoke Turkish, the transcript must be in Turkish (Türkçe konuştuysa Türkçe yaz, çevirme).
${ipucu ? `Context — the teacher had just said: "${ipucu}"\n` : ''}Return ONLY the transcript text, no quotes, no comments. If there is no intelligible speech, return an empty string.`;
    let son = null;
    for (const model of modeller) {
    let hepsiDolu = true;
    for (const key of keys) {
      try {
        const ctl = new AbortController(); const z = setTimeout(() => ctl.abort(), 12000);
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'audio/wav', data: b64 } }, { text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 400 } })
        });
        clearTimeout(z);
        if (res.status === 429) { son = { code: 'rate' }; let gunluk = false; try { gunluk = /PerDay/i.test(await res.text()); } catch (e) {} if (!gunluk) hepsiDolu = false; continue; }
        hepsiDolu = false;
        if (!res.ok) { son = { code: 'http', message: 'Gemini ' + res.status }; continue; }
        const d = await res.json(); const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
        return parts.filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('').replace(/^["“]|["”]$/g, '').trim();
      } catch (e) { hepsiDolu = false; son = e && e.code ? e : { code: 'network' }; }
    }
    if (hepsiDolu) kotaDoldu(model);
    }
    throw son || { code: 'all-failed' };
  }

  /* ================= Kurulum ================= */
  function startVideo() {
    const host = openPanel('Görüntülü ders');
    host.innerHTML = '';
    const kok = document.createElement('div');
    kok.className = 'vd';
    kok.innerHTML = `
      <div class="vd-sahne">
        <div class="vd-isik" aria-hidden="true"></div>
        <canvas class="vd-yuz" aria-label="Öğretmen ${OGRETMEN}"></canvas>
        <div class="vd-yukleniyor"><span class="vd-spin"></span></div>
      </div>
      <header class="vd-ust">
        <div class="vd-kim">
          <span class="vd-durum" data-d="hazir"><i></i><span class="vd-durum-y">Hazır</span></span>
          <div><b>${OGRETMEN}</b><span class="vd-alt"><span class="vd-rol">İngilizce öğretmeni</span> · <span class="vd-lv">${esc(S.level)}</span></span></div>
        </div>
        <div class="vd-sure" hidden>00:00</div>
        <div class="vd-ust-sag">
          <button class="vd-ib" data-a="cc" title="Altyazı" aria-label="Altyazı">${vi('cc')}</button>
          <button class="vd-ib" data-a="sohbet" title="Sohbet" aria-label="Sohbet">${vi('chat')}<em class="vd-rozet" hidden>0</em></button>
          <button class="vd-ib" data-a="ayar" title="Ayarlar" aria-label="Ayarlar">${vi('gear')}</button>
          <button class="vd-ib" data-a="kapat" title="Kapat" aria-label="Kapat">${vi('x')}</button>
        </div>
      </header>
      <div class="vd-mod" role="radiogroup" aria-label="Ders modu">
        <label><input type="radio" name="vdmod" value="tr"><span>Türkçe konu çalışma</span></label>
        <label><input type="radio" name="vdmod" value="en"><span>İngilizce sohbet</span></label>
        <label><input type="radio" name="vdmod" value="genel"><span>Türkçe genel sohbet</span></label>
      </div>
      <section class="vd-lobi">
        <div class="vd-kart">
          <span class="vd-etiket">Görüntülü ders</span>
          <h2>${OGRETMEN} ile yüz yüze konuş</h2>
          <p>Seviyene (${esc(S.level)}) göre İngilizce konuşur, duygularıyla tepki verir. Takıldığın yerde Türkçe sor: Türkçe açıklar, örnekleri İngilizce okur.</p>
          <div class="vd-konular"></div>
          <form class="vd-kendi"><input placeholder="Ya da kendi konunu yaz (Türkçe ya da İngilizce)" aria-label="Kendi konun"></form>
          <label class="vd-anahtar"><input type="checkbox" data-a="eller"><span></span> Eller serbest <small>Öğretmen susunca mikrofon kendiliğinden açılır</small></label>
          <button class="vd-basla" type="button">${vi('video')} Dersi başlat</button>
          <p class="vd-not"></p>
        </div>
      </section>
      <div class="vd-altyazi" aria-live="polite"><div class="vd-cumle"></div><div class="vd-tr"></div></div>
      <div class="vd-sen" hidden><span class="vd-dalga"><i></i><i></i><i></i><i></i><i></i></span><span class="vd-sen-y"></span><button type="button" class="vd-sen-yeniden" title="Sil ve baştan kaydet" aria-label="Baştan kaydet">${vi('again')}</button><button type="button" class="vd-sen-gonder" title="Bitirdim, gönder" aria-label="Gönder">${vi('send')}</button></div>
      <form class="vd-onay" hidden>
        <div class="vd-onay-ust"><b>Mikrofonun anladığı</b><span>Yanlışsa düzelt ya da yeniden kaydet</span></div>
        <textarea rows="2" aria-label="Mikrofonun anladığı metin (düzenleyebilirsin)"></textarea>
        <div class="vd-onay-sayac"><i></i></div>
        <div class="vd-onay-b">
          <button type="button" data-k="yeniden">${vi('mic')} Yeniden kaydet</button>
          <button type="button" data-k="iptal">${vi('x')} Sil</button>
          <button type="submit" data-k="gonder" class="ana">${vi('send')} Gönder</button>
        </div>
      </form>
      <div class="vd-ipucu" hidden></div>
      <div class="vd-duzeltme" hidden></div>
      <footer class="vd-alt-bar" hidden>
        <button class="vd-b" data-a="kb" title="Yazarak cevap ver">${vi('kb')}<span>Yaz</span></button>
        <button class="vd-b" data-a="ipucu" title="Ne diyebilirim?">${vi('hint')}<span>İpucu</span></button>
        <button class="vd-mic" data-a="mic" aria-label="Mikrofon">${vi('mic')}</button>
        <button class="vd-b" data-a="tekrar" title="Son cevabı tekrar et">${vi('again')}<span>Tekrar</span></button>
        <button class="vd-b vd-bitir" data-a="bitir" title="Dersi bitir">${vi('end')}<span>Bitir</span></button>
      </footer>
      <form class="vd-yaz" hidden><input placeholder="İngilizce (ya da Türkçe) yaz ve Enter'a bas" aria-label="Mesaj"><button aria-label="Gönder">${vi('send')}</button></form>
      <aside class="vd-panel" aria-label="Sohbet">
        <div class="vd-panel-ust"><div><b>Sohbet</b><span class="vd-panel-not">Mesaja dokun: tekrar dinle · Kelimeye dokun: anlamı · Türkçe de sorabilirsin</span></div><button class="vd-ib" data-a="sohbetkapat" aria-label="Kapat">${vi('x')}</button></div>
        <div class="vd-liste"><p class="vd-bos">Ders başlayınca konuşma burada yazılı olarak akar.</p></div>
      </aside>
      <div class="vd-kelime" hidden></div>
      <div class="vd-ayarlar" hidden>
        <b>Ayarlar</b>
        <label class="vd-anahtar"><input type="checkbox" data-a="eller2"><span></span> Eller serbest</label>
        <label class="vd-anahtar"><input type="checkbox" data-a="onay"><span></span> Göndermeden önce metni göster <small>Mikrofonun anladığını düzeltebilir ya da yeniden kaydedebilirsin. Eller serbestte dokunmazsan 4 sn sonra gönderilir.</small></label>
        <label class="vd-anahtar"><input type="checkbox" data-a="hassas"><span></span> Hassas ses tanıma <small class="vd-hassas-not">Konuşman Gemini ile yazıya dökülür; aksanı ve hızlı konuşmayı çok daha iyi anlar.</small></label>
        <label class="vd-satir">Sustuktan sonra bekleme: <b class="vd-sessiz-d"></b><input type="range" min="1.2" max="4" step="0.2" data-a="sessizlik"></label>
        <label class="vd-anahtar"><input type="checkbox" data-a="trAc"><span></span> Türkçe çeviriler açık</label>
        <label class="vd-satir">Öğretmen sesi <select data-a="ses"><option value="Charon">Doğal · Charon (sakin)</option><option value="Iapetus">Doğal · Iapetus (berrak)</option><option value="Orus">Doğal · Orus (tok)</option><option value="Fenrir">Doğal · Fenrir (enerjik)</option><option value="tarayici">Tarayıcı sesi</option></select><small class="vd-ses-not">Doğal ses Gemini ile üretilir; ağız sesin kendisiyle oynar. Kota dolarsa kendiliğinden tarayıcı sesine geçer.</small></label>
        <label class="vd-satir">Konuşma hızı (tarayıcı sesi) <input type="range" min="0.7" max="1.2" step="0.05" data-a="hiz"></label>
        <label class="vd-satir">Yapay zekâ <select data-a="tier">${TIERS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
      </div>
      <section class="vd-ozet" hidden></section>`;
    document.body.appendChild(kok);
    /* ekran dışındaki panel yüzünden tarayıcı katmanı yana kaydırmasın (yazı kutusuna odaklanınca oluyordu) */
    kok.addEventListener('scroll', () => { if (kok.scrollLeft || kok.scrollTop) { kok.scrollLeft = 0; kok.scrollTop = 0; } });
    document.documentElement.classList.add('vd-acik');
    const q = s => kok.querySelector(s), qa = s => kok.querySelectorAll(s);
    const st = { faz: 'lobi', konu: null, hist: [], errs: [], turns: 0, okN: 0, xp: 0, busy: false, bas: 0, son: null, done: new Set(), bitti: false, sabir: 0 };

    /* avatar */
    const v = pickVoice && pickVoice();
    const yuz = DHCanliYuz.olustur(q('.vd-yuz'), { yol: './assets/avatars_v4/teacher/', sesAdi: v ? v.name : undefined });
    yuz.profil({ ifade: 0.75, enerji: 0.55, jest: 0.55 });
    yuz.hazir.then(() => { q('.vd-yukleniyor').remove(); yuz.duygu('cesaret', 0.5); },
      () => { q('.vd-yukleniyor').innerHTML = '<p>Avatar bu cihazda açılamadı (WebGL yok). Ders yine de sesli devam edebilir.</p>'; });

    const DURUM = { hazir: 'Hazır', dinliyor: 'Seni dinliyor', anliyor: 'Anlıyor…', dusunuyor: 'Düşünüyor', konusuyor: 'Konuşuyor', bekliyor: 'Senin sıran', onay: 'Metni kontrol et' };
    function durum(d) { q('.vd-durum').dataset.d = d; q('.vd-durum-y').textContent = DURUM[d] || d; kok.dataset.d = d; q('.vd-mic').classList.toggle('canli', d === 'dinliyor'); }

    /* ---- sohbet paneli ---- */
    function sohbetAc(ac, kaydetme) { kok.classList.toggle('vd-sohbet-acik', ac); if (ac) { q('.vd-rozet').hidden = true; q('.vd-rozet').textContent = '0'; } if (genis() && !kaydetme && st.faz === 'ders') { ayar.sohbet = ac; ayarKaydet(); } }
    q('[data-a=sohbet]').onclick = () => sohbetAc(!kok.classList.contains('vd-sohbet-acik'));
    q('[data-a=sohbetkapat]').onclick = () => sohbetAc(false);
    function rozet() { if (kok.classList.contains('vd-sohbet-acik')) return; const r = q('.vd-rozet'); r.hidden = false; r.textContent = String(+r.textContent + 1); }
    function listeyeEkle(el) { const l = q('.vd-liste'); const b = l.querySelector('.vd-bos'); if (b) b.remove(); l.appendChild(el); l.scrollTop = l.scrollHeight; }
    function kelimeler(metin) { return esc(metin).replace(/[A-Za-z][A-Za-z'’-]*/g, w => `<span class="vd-k" data-k="${w}">${w}</span>`); }
    /* Türkçe parçalar düz, İngilizce parçalar dokunulabilir kelimelerle */
    const aciklamaMi = m => m.liste && m.liste.some(c => c.dil === 'tr') && m.liste.some(c => c.dil === 'en');
    function parcaHTML(m) { const ac = aciklamaMi(m); return m.liste.map((c, i) => c.dil === 'tr' ? `<span class="vd-p-tr">${esc(c.metin)}</span>` : (ac ? `<span class="vd-ornek"><span class="vd-p-en">${kelimeler(c.metin)}</span><span class="vd-p-cev" data-i="${i}">${c.cev ? esc(c.cev) : '<span class="vd-spin kucuk"></span>'}</span></span>` : `<span class="vd-p-en">${kelimeler(c.metin)}</span>`)).join(' '); }
    /* örnek cümlenin çevirisi gelmediyse sonradan tamamla */
    async function cevirileriTamamla(m) {
      if (!aciklamaMi(m)) return;
      const eksik = m.liste.map((c, i) => [c, i]).filter(([c]) => c.dil === 'en' && !c.cev);
      if (eksik.length) {
        try { const r = await ai(`Translate these English example sentences into natural Turkish. Return ONLY JSON: {"tr":["..."]} in the same order.\n${eksik.map(([c], k) => (k + 1) + ') ' + c.metin).join('\n')}`); (r.tr || []).forEach((t, k) => { if (eksik[k] && t) eksik[k][0].cev = String(t).trim(); }); } catch (e) {}
      }
      if (m._el) m.liste.forEach((c, i) => { const el = m._el.querySelector(`.vd-p-cev[data-i="${i}"]`); if (el) { if (c.cev) el.textContent = c.cev; else el.remove(); } });
    }
    function ogretmenMesaji(m) {
      const d = document.createElement('div'); d.className = 'vd-m ogr';
      d.innerHTML = `<span class="vd-m-ava" aria-hidden="true">D</span><div class="vd-m-ic"><div class="vd-m-bub" role="button" tabindex="0" title="Tekrar dinle">${parcaHTML(m)}</div>
        <div class="vd-m-tr" hidden>${esc(m.tr || 'Çeviri yok.')}</div>
        <div class="vd-m-a"><button type="button" data-k="dinle">${vi('spk')} Tekrar söyle</button>${m.tr ? '<button type="button" data-k="tr">TR</button>' : ''}</div></div>`;
      const bub = d.querySelector('.vd-m-bub');
      bub.onclick = e => { const k = e.target.closest('.vd-k'); if (k) { e.stopPropagation(); kelimeGoster(k); return; } tekrarSoyle(m); };
      bub.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tekrarSoyle(m); } };
      d.querySelector('[data-k=dinle]').onclick = () => tekrarSoyle(m);
      const trB = d.querySelector('[data-k=tr]');
      if (trB) { trB.onclick = e => { const t = d.querySelector('.vd-m-tr'); t.hidden = !t.hidden; e.currentTarget.classList.toggle('sec', !t.hidden); };
        if (ayar.altyaziTR) { d.querySelector('.vd-m-tr').hidden = false; trB.classList.add('sec'); } }
      m._el = d; listeyeEkle(d);
    }
    function ogrenciMesaji(um) {
      const d = document.createElement('div'); d.className = 'vd-m sen';
      d.innerHTML = `<div class="vd-m-ic"><div class="vd-m-bub" role="button" tabindex="0" title="Dinle">${esc(um.text)}</div><div class="vd-m-tr" hidden></div>
        <div class="vd-m-durum"><span class="vd-bekle"><span class="vd-spin kucuk"></span>kontrol ediliyor</span></div>
        <div class="vd-m-a"><button type="button" data-k="dinle">${vi('spk')} Dinle</button><button type="button" data-k="tr">TR</button></div></div>`;
      const dinlet = () => speak(um.check && !um.check.ok ? um.check.corrected : um.text);
      d.querySelector('.vd-m-bub').onclick = dinlet; d.querySelector('[data-k=dinle]').onclick = dinlet;
      d.querySelector('[data-k=tr]').onclick = async e => {
        const b = e.currentTarget, t = d.querySelector('.vd-m-tr');
        if (!t.hidden) { t.hidden = true; b.classList.remove('sec'); return; }
        t.hidden = false; b.classList.add('sec');
        if (!um.tr) { t.innerHTML = '<span class="vd-spin kucuk"></span>'; try { const r = await ai(`Translate this English sentence written by a learner into natural Turkish. If it has mistakes, translate what they meant. Return ONLY JSON: {"tr":"..."}\n"${um.text}"`); um.tr = r.tr || ''; } catch (x) { t.textContent = aiErr(x); return; } }
        t.textContent = um.tr;
      };
      um._el = d; listeyeEkle(d);
    }
    function ogrenciDurum(um) {
      const c = um.check, kut = um._el && um._el.querySelector('.vd-m-durum'); if (!kut) return;
      um._el.classList.toggle('duz', !c.ok);
      if (c.tr) { kut.innerHTML = '<span class="vd-trsoru">Türkçe</span>'; return; }
      if (c.ok) { kut.innerHTML = `<span class="vd-iyi">${vi('ok')} Hatasız</span>`; return; }
      kut.innerHTML = `<div class="vd-duz-k"><div class="vd-fb-b">${vi('pen')} Düzeltme${c.tag ? ` · <em>${esc(c.tag)}</em>` : ''}</div><div class="vd-fark">${diffHTML(um.text, c.corrected)}</div><div class="vd-dogru">${esc(c.corrected)}</div><p>${esc(c.why_tr)}</p><div class="vd-fb-a"><button type="button" data-k="dd">${vi('spk')} Doğrusunu dinle</button><button type="button" data-k="yanlis">Bu düzeltme yanlış</button></div></div>`;
      kut.querySelector('[data-k=dd]').onclick = () => speak(c.corrected);
      kut.querySelector('[data-k=yanlis]').onclick = () => { removeError(um._err); const k = st.errs.indexOf(um._err); if (k >= 0) st.errs.splice(k, 1); um.check = { ok: true }; S.stats.ok++; st.okN++; addXP(5); ogrenciDurum(um); toast('Düzeltme kaldırıldı'); };
      const l = q('.vd-liste'); l.scrollTop = l.scrollHeight;
    }

    /* ---- kelime anlamı ---- */
    async function kelimeGoster(span) {
      const w = span.dataset.k.toLowerCase().replace(/[’]/g, "'"), kut = q('.vd-kelime');
      const r = span.getBoundingClientRect();
      kut.hidden = false; kut.style.left = Math.max(10, Math.min(innerWidth - 280, r.left - 20)) + 'px'; kut.style.top = Math.min(innerHeight - 170, r.bottom + 8) + 'px';
      kut.innerHTML = `<b>${esc(w)}</b> <span class="vd-spin kucuk"></span>`;
      let bulunan = null; try { const Dc = await loadDict(); bulunan = dictLookup(Dc, w); } catch (e) {}
      const ana = bulunan ? bulunan[0] : w, kart = !!S.srs[ana];
      const anlam = bulunan ? (bulunan[1].anlamlar || []).map(a => a.replace(/\s*\[[^\]]*\]/g, '').trim()).filter((a, i, A) => a && A.indexOf(a) === i).slice(0, 3).join(', ') : '';
      kut.innerHTML = `<div class="vd-kel-u"><b>${esc(ana)}</b>${bulunan && bulunan[1].oku ? `<i>${esc(bulunan[1].oku)}</i>` : ''}<button type="button" data-k="s" aria-label="Dinle">${vi('spk')}</button></div>
        <div class="vd-kel-a">${anlam ? esc(anlam) : 'Sözlükte bulunamadı.'}</div>
        ${anlam ? `<button type="button" data-k="k" class="vd-kel-ekle" ${kart ? 'disabled' : ''}>${kart ? vi('ok') + ' Kartlarında' : vi('plus') + ' Kartlara ekle'}</button>` : ''}`;
      kut.querySelector('[data-k=s]').onclick = () => speak(ana);
      const ek = kut.querySelector('[data-k=k]');
      if (ek) ek.onclick = () => { if (!S.srs[ana]) { S.srs[ana] = { tr: anlam.split(',')[0], o: '', box: 1, due: today() }; save(); } ek.disabled = true; ek.innerHTML = vi('ok') + ' Kartlarında'; };
    }
    kok.addEventListener('pointerdown', e => {
      if (!q('.vd-kelime').hidden && !e.target.closest('.vd-kelime,.vd-k')) q('.vd-kelime').hidden = true;
      if (!q('.vd-ayarlar').hidden && !e.target.closest('.vd-ayarlar,[data-a=ayar]')) q('.vd-ayarlar').hidden = true;
    });

    /* ---- lobi ---- */
    const kl = konular();
    q('.vd-konular').innerHTML = kl.map((k, i) => `<button type="button" class="vd-konu ${i === 0 ? 'sec' : ''}" data-i="${i}"><b>${esc(k.t)}</b><span>${esc(k.s)}</span></button>`).join('');
    st.konu = kl[0];
    qa('.vd-konu').forEach(b => b.onclick = () => { qa('.vd-konu').forEach(x => x.classList.remove('sec')); b.classList.add('sec'); st.konu = kl[+b.dataset.i]; q('.vd-kendi input').value = ''; });
    q('.vd-kendi').onsubmit = e => { e.preventDefault(); basla(); };
    const eller = q('[data-a=eller]'); eller.checked = ayar.ellerSerbest; eller.onchange = () => { ayar.ellerSerbest = eller.checked; ayarKaydet(); q('[data-a=eller2]').checked = eller.checked; };
    if (aiOff()) q('.vd-not').textContent = aiErr({ code: 'no_ai' });
    else if (!dict && !(navigator.mediaDevices && window.MediaRecorder)) q('.vd-not').textContent = 'Bu tarayıcıda mikrofon kullanılamıyor; yazarak konuşabilirsin.';
    q('.vd-basla').onclick = basla;

    /* ---- ayarlar ---- */
    const gemVar = geminiKeys().length > 0;
    q('[data-a=eller2]').checked = ayar.ellerSerbest;
    q('[data-a=eller2]').onchange = e => { ayar.ellerSerbest = e.target.checked; ayarKaydet(); eller.checked = ayar.ellerSerbest; };
    q('[data-a=hassas]').checked = ayar.hassas && gemVar; q('[data-a=hassas]').disabled = !gemVar;
    if (!gemVar) q('.vd-hassas-not').textContent = 'Bunun için Dil Harita\'da bir Gemini anahtarı kayıtlı olmalı. Şu an tarayıcının kendi tanıması kullanılıyor.';
    q('[data-a=hassas]').onchange = e => { ayar.hassas = e.target.checked; ayarKaydet(); };
    if (ayar.onay === undefined) ayar.onay = true;
    q('[data-a=onay]').checked = ayar.onay; q('[data-a=onay]').onchange = e => { ayar.onay = e.target.checked; ayarKaydet(); };
    const sz = q('[data-a=sessizlik]'); sz.value = ayar.sessizlik; q('.vd-sessiz-d').textContent = (+ayar.sessizlik).toFixed(1) + ' sn';
    sz.oninput = () => { ayar.sessizlik = +sz.value; ayarKaydet(); q('.vd-sessiz-d').textContent = (+sz.value).toFixed(1) + ' sn'; };
    /* DERS MODU — "Türkçe konu çalışma": öğretmen Türkçe anlatır, İngilizce örnekleri İngilizce okur; mikrofon Türkçe dinler.
                   "İngilizce sohbet": öğretmen İngilizce konuşur; mikrofon İngilizce dinler. */
    if (ayar.mod !== 'tr' && ayar.mod !== 'en' && ayar.mod !== 'genel') ayar.mod = 'en';
    const genelMi = () => ayar.mod === 'genel', turkceMi = () => ayar.mod !== 'en';
    function modUygula(bildir) {
      qa('[name=vdmod]').forEach(r => { r.checked = r.value === ayar.mod; });
      kok.dataset.mod = ayar.mod;
      window.KK_DICT_LANG = turkceMi() ? 'tr-TR' : 'en-US';
      const rol = q('.vd-rol'); if (rol) rol.textContent = genelMi() ? 'Genel asistan' : 'İngilizce öğretmeni';
      const lb = q('.vd-lobi p'); if (lb) lb.textContent = genelMi()
        ? `${OGRETMEN} her konuda Türkçe yardımcı olan genel asistanın: soru sor, fikir al, bir şey yazdır, plan yap. Konuşurken cihazının kendi sesini kullanır, Gemini ses kotası harcanmaz.`
        : ayar.mod === 'tr'
        ? `${OGRETMEN} istediğin konuyu Türkçe anlatır; İngilizce örnekleri İngilizce okur, küçük alıştırmalar yaptırır. Aşağıdan bir konu seç ya da kendin yaz.`
        : `Seviyene (${S.level}) göre İngilizce konuşur, duygularıyla tepki verir. Takıldığın yerde Türkçe sorabilirsin.`;
      const kn = q('.vd-konular'); if (kn) kn.hidden = genelMi();
      const ip = q('[data-a=ipucu]'); if (ip) ip.hidden = genelMi();
      const bb = q('.vd-basla'); if (bb) bb.innerHTML = vi('video') + (genelMi() ? ' Sohbeti başlat' : ' Dersi başlat');
      const inp = q('.vd-kendi input'); if (inp) inp.placeholder = genelMi() ? 'Ne konuşmak istersin? (isteğe bağlı, ör. hafta sonu planı, bir e-posta taslağı)' : ayar.mod === 'tr' ? 'Çalışmak istediğin konu (ör. Present perfect, sıfatlar, "make" ile "do" farkı)' : 'Ya da kendi konunu yaz (Türkçe ya da İngilizce)';
      q('.vd-yaz input').placeholder = genelMi() ? 'Bir şey sor ya da yaz…' : ayar.mod === 'tr' ? 'Türkçe soru sor ya da İngilizce cümle yaz…' : "İngilizce (ya da Türkçe) yaz ve Enter'a bas";
      if (bildir) {
        bilgi(genelMi() ? 'Türkçe genel sohbet: genel asistan Türkçe konuşacak, cihaz sesini kullanacak (kota harcamaz).' : ayar.mod === 'tr' ? 'Türkçe konu çalışma: öğretmen Türkçe anlatacak, mikrofon Türkçe dinleyecek.' : 'İngilizce sohbet: öğretmen İngilizce konuşacak, mikrofon İngilizce dinleyecek.');
        if (D.aktif && !D.bitiyor && micLive) dict.stop().catch(() => {});   /* dinleme sürüyorsa yeni dille yeniden açılır */
      }
    }
    qa('[name=vdmod]').forEach(r => r.onchange = () => { if (!r.checked) return; ayar.mod = r.value; ayarKaydet(); modUygula(true);
      if (st.faz === 'ders' && !st.busy && kok.dataset.d === 'bekliyor' && st.son) sor(null, genelMi() ? 'The user just switched to TURKISH GENERAL CHAT mode. In Turkish, say one short friendly line that you are now their general assistant and ask how you can help.' : ayar.mod === 'tr' ? 'The learner just switched to TURKISH topic study mode. In Turkish, briefly say you will now explain in Turkish and ask which topic they want to study (or offer to continue with the current one).' : 'The learner just switched back to ENGLISH conversation mode. In English, say one short friendly line and ask an easy question to continue the conversation.'); });
    q('[data-a=trAc]').checked = ayar.altyaziTR;
    modUygula(false);
    q('[data-a=trAc]').onchange = e => { ayar.altyaziTR = e.target.checked; ayarKaydet(); q('.vd-tr').hidden = !ayar.altyaziTR; };
    q('.vd-tr').hidden = !ayar.altyaziTR;
    const sesSec = q('[data-a=ses]');
    sesSec.value = ayar.ses === 'tarayici' ? 'tarayici' : (ayar.sesAdi || 'Charon');
    if (!gemVar) { sesSec.value = 'tarayici'; [...sesSec.options].forEach(o => { if (o.value !== 'tarayici') o.disabled = true; }); q('.vd-ses-not').textContent = 'Doğal ses için Dil Harita\'da bir Gemini anahtarı kayıtlı olmalı.'; }
    sesSec.onchange = () => { if (sesSec.value === 'tarayici') ayar.ses = 'tarayici'; else { ayar.ses = 'gemini'; ayar.sesAdi = sesSec.value; st.ttsKapali = false; st.ttsHataN = 0; dolgulariHazirla(); } ayarKaydet(); };
    q('[data-a=hiz]').value = S.rate; q('[data-a=hiz]').oninput = e => { S.rate = +e.target.value; touchSettings(); };
    q('[data-a=tier]').value = S.tierChat; q('[data-a=tier]').onchange = e => { S.tierChat = e.target.value; touchSettings(); };
    q('[data-a=ayar]').onclick = () => { q('.vd-ayarlar').hidden = !q('.vd-ayarlar').hidden; };
    q('[data-a=cc]').onclick = () => { ayar.altyazi = !ayar.altyazi; ayarKaydet(); kok.classList.toggle('vd-cc-yok', !ayar.altyazi); };
    kok.classList.toggle('vd-cc-yok', !ayar.altyazi);
    q('[data-a=kapat]').onclick = () => { if (st.faz === 'ders' && st.turns) bitir(); else closePanel(); };

    /* ---- yapay zekâ ---- */
    function sistem() {
      const LV = S.level, k = st.konu;
      if (genelMi()) {
        let g = `You are ${OGRETMEN}, a friendly, knowledgeable personal assistant talking with the user on a live VIDEO call. The user is Turkish.
MODE: TURKISH GENERAL CHAT. Speak natural TURKISH (informal "sen") about ANY subject the user brings: everyday questions, advice, explanations, ideas, planning, writing help, health/money/legal basics (with a short note to consult a professional when it really matters), general knowledge, or just chatting.
- Your words are spoken aloud: answer in 1-5 short, clear spoken sentences. No emojis, no lists, no markdown, no stage directions. If a longer answer is needed, give the essence first and offer to continue.
- Be honest: if you are not sure, or it depends on recent/current information you may not know, say so briefly.
- Ask a short follow-up question only when it really helps.
- The user's messages come from speech recognition: if a message looks garbled, kindly ask them to repeat.
- If the user wants English help, you can help, but keep explaining in Turkish.`;
        if (k && k.custom) g += `\nThe user wants to start with: ${k.custom}`;
        return g;
      }
      let s = `You are ${k.persona}. You are on a live one-to-one VIDEO lesson with a Turkish native speaker who is learning English at CEFR level ${LV}. ${LEVEL_GUIDE[LV]}
Be warm, natural and encouraging, like a real person on a video call. No emojis, no lists, no stage directions. Never break role. Do not correct the learner in your reply (corrections are shown on screen separately), but you may naturally reuse the correct form. The learner's messages come from speech recognition: if a message looks garbled, kindly ask them to say it again.\n`;
      if (ayar.mod === 'tr') {
        s += `MODE: TURKISH TOPIC STUDY (chosen by the learner). You speak TURKISH (informal "sen", like a kind, clear teacher) and teach the English topic the learner wants: grammar, vocabulary, usage, differences.
- ALL explanation sentences MUST be in Turkish. English is allowed ONLY in example sentences and in the short English terms being taught (e.g. "present perfect", "have + V3"). Never write an explanatory sentence in English, even if the learner writes in English.
- Each turn: 3-6 short sentences. Explain one small step, give 1-2 English example sentences, then a tiny practice (e.g. ask them to make an English sentence, or to choose between two forms) — the practice instruction itself is in Turkish.
- When the learner answers with an English sentence, react to it in Turkish (praise or gently fix) before continuing.
- Every English example must be its own "en" segment so it is read with an English voice.`;
      } else {
        s += `MODE: ENGLISH CONVERSATION. Speak English: 1-3 short sentences, usually ending with ONE follow-up question.
- EXCEPTION: whenever you EXPLAIN anything (a grammar point, the meaning of a word, a rule, a difference, why something is wrong, how to say something) — whether the learner asked in Turkish or in English — the explanation must be in TURKISH (informal "sen", at most 5-6 sentences); only the example sentences are in English, each as its own "en" segment. After the explanation, bring them back to English with one short, easy English question.
- If the learner simply speaks Turkish, answer in Turkish briefly, then invite them back to English.`;
      }
      if (k.tasks) s += `\nScene: ${k.scene}. Over the conversation the learner should complete these tasks: ${k.tasks.map((t, i) => (i + 1) + ') ' + t).join(' ')}. Create natural chances for them; never list them.`;
      if (k.custom) s += `\nTopic chosen by the learner: ${k.custom}`;
      else if (ayar.mod === 'tr') s += `\nLesson theme: ${k.t}${k.tasks ? ' (useful phrases for this situation)' : ''}.`;
      return s + learnerContext();
    }
    const ETIKET = `Split your reply into SEGMENTS: normally one sentence each, but whenever the language changes inside a sentence, split there (e.g. Turkish "Mesela şöyle dersin:" and English "I went home yesterday." are two segments). Give each segment "lang": "tr" or "en". If your reply contains any Turkish explanation, give every "en" segment also "tr": its natural Turkish translation (for the learner to read under the example). For EACH segment choose the face the teacher should show: "emo" one of ${DUYGU.join('|')} and "gest" one of ${JEST.join('|')} or null. Keep the same emo for segments that continue one sentence. Choose by meaning: praise→mutlu or gururlu with iki_onay; gentle correction or "almost"→anlayisli with egil; encouragement→cesaret; a question→merak (often egil or kas); thinking aloud→dusunceli with dusun; real surprise→saskin with kas; an important warning→ciddi. Use null gesture often.`;
    function gecmis(n = 14) { return st.hist.slice(-n).map(h => (h.role === 'user' ? 'Learner: ' : 'You: ') + h.text).join('\n'); }
    /* parçanın dilini metinden de tahmin et: yanlış etiketli cümle yanlış sesle okunmasın */
    function dilTahmin(t) {
      const k = ' ' + t.toLowerCase().replace(/[^a-zçğıöşüâî' ]+/g, ' ') + ' ';
      const tr = (/[çğışöüâ]/.test(k) ? 2 : 0) + (k.match(/ (ve|bir|bu|şu|için|ile|gibi|olarak|yani|mesela|örneğin|ne|nasıl|değil|ama|çünkü|da|de|mi|mı|mu|mü|var|yok|olur|ise|kullanılır|kullanırız|dersin|demek) /g) || []).length;
      const en = (k.match(/ (the|a|an|is|are|was|were|i|you|he|she|we|they|it|to|and|of|in|on|at|do|does|did|have|has|what|how|can|will|my|your|this|that) /g) || []).length;
      if (tr >= 2 && tr > en) return 'tr'; if (en >= 2 && tr === 0) return 'en'; return null;
    }
    function cumleler(r) {
      const arr = Array.isArray(r.reply) ? r.reply : null;
      if (!arr) return DHCanliYuz.etiketle(String(r.reply || '')).map(c => Object.assign(c, { dil: 'en' }));
      return arr.map(segmentCevir).filter(Boolean);
    }
    function segmentCevir(x) {
      if (!x || typeof x !== 'object') return null;
      { const metin = String(x.s || x.text || '').trim(); const etiket = x.lang === 'tr' || x.lang === 'en' ? x.lang : null, tahmin = dilTahmin(metin); const dil = tahmin || etiket || (/[çğışöüÇĞİŞÖÜ]/.test(metin) ? 'tr' : 'en');
        const cev = dil === 'en' && typeof x.tr === 'string' && x.tr.trim() && x.tr.trim() !== metin ? x.tr.trim() : '';
        if (!metin) return null;
        return { metin, duygu: DUYGU.includes(x.emo) ? x.emo : 'cesaret', jest: JEST.includes(x.gest) ? x.gest : null, guc: 0.85, dil, cev }; }
    }

    /* ================= Ses: Gemini doğal ses (ağız sesin kendisiyle oynar) ya da tarayıcı sesi ================= */
    /* ücretsiz kullanımda her modelin günlük hakkı ayrı (ölçüldü: 10'ar istek) */
    const TTS_MODELLER = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
    const DOLGU = { en: ['Hmm.', 'Let me see.', 'Okay.'], tr: ['Hmm.', 'Bir bakalım.', 'Peki.'] };
    const ttsHafiza = new Map();
    function geminiSesAcik() { return !genelMi() && ayar.ses !== 'tarayici' && geminiKeys().length > 0 && !st.ttsKapali; }
    async function ttsOnbellek(anahtar, ab) {
      /* kısa ve sık kullanılan sesler (dolgu, "acele etme") bir kez üretilir, tarayıcıda saklanır */
      try { const c = await caches.open('dh-tts-v1'); const u = 'https://tts.dilharita.local/' + encodeURIComponent(anahtar);
        if (ab) { await c.put(u, new Response(ab, { headers: { 'Content-Type': 'audio/wav' } })); return null; }
        const r = await c.match(u); return r ? await r.arrayBuffer() : null; } catch (e) { return null; }
    }
    function pcmWav(bytes, hz) {
      const v = new DataView(new ArrayBuffer(44 + bytes.length)); const y = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      y(0, 'RIFF'); v.setUint32(4, 36 + bytes.length, true); y(8, 'WAVE'); y(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, hz, true); v.setUint32(28, hz * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); y(36, 'data'); v.setUint32(40, bytes.length, true);
      new Uint8Array(v.buffer, 44).set(bytes); return v.buffer;
    }
    async function ttsIstek(metin, ses) {
      const keys = geminiKeys(); if (!keys.length) throw { code: 'no_gemini' };
      const kota = kotaOku(); const modeller = TTS_MODELLER.filter(m => !kota[m]); if (!modeller.length) throw { code: 'rate' };
      let son = null;
      for (const model of modeller) {
        let hepsiDolu = true;
        for (const key of keys) {
          try {
            const ctl = new AbortController(); const z = setTimeout(() => ctl.abort(), 15000);
            const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key), {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
              body: JSON.stringify({ contents: [{ parts: [{ text: metin }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: ses } } } } }) });
            clearTimeout(z);
            if (res.status === 429) { son = { code: 'rate' }; let g = false; try { g = /PerDay/i.test(await res.text()); } catch (e) {} if (!g) hepsiDolu = false; continue; }
            hepsiDolu = false;
            if (!res.ok) { son = { code: 'http', message: 'Gemini ses ' + res.status }; continue; }
            const d = await res.json(); const p = (((d.candidates || [])[0] || {}).content || {}).parts || [];
            const ses0 = p.find(x => x.inlineData && x.inlineData.data); if (!ses0) { son = { code: 'empty' }; continue; }
            const bytes = Uint8Array.from(atob(ses0.inlineData.data), ch => ch.charCodeAt(0)); const mime = ses0.inlineData.mimeType || '';
            if (/wav/i.test(mime)) return bytes.buffer;
            const hz = +((mime.match(/rate=(\d+)/) || [])[1] || 24000); return pcmWav(bytes, hz);   /* ham PCM gelirse wav'a sar */
          } catch (e) { hepsiDolu = false; son = e && e.code ? e : { code: 'network' }; }
        }
        if (hepsiDolu) kotaDoldu(model);
      }
      throw son || { code: 'all-failed' };
    }
    function ttsUret(metin) {
      const ses = ayar.sesAdi || 'Charon', anahtar = ses + '|' + metin;
      if (ttsHafiza.has(anahtar)) return ttsHafiza.get(anahtar);
      const is = (async () => {
        const kisa = metin.length < 40;
        let ab = kisa ? await ttsOnbellek(anahtar) : null;
        if (!ab) { ab = await ttsIstek(metin, ses); if (kisa) ttsOnbellek(anahtar, ab.slice(0)); }
        return yuz.sesCoz(ab.slice(0));
      })();
      ttsHafiza.set(anahtar, is); is.catch(() => ttsHafiza.delete(anahtar));
      return is;
    }
    function ttsHata(e) {
      st.ttsHataN = (st.ttsHataN || 0) + 1;
      if ((e && e.code === 'rate') || st.ttsHataN >= 2) {
        st.ttsKapali = true;
        if (!st.ttsUyari) { st.ttsUyari = true; toast(e && e.code === 'rate' ? 'Doğal ses (Gemini) bugünlük kotasını doldurdu; tarayıcı sesiyle devam ediliyor.' : 'Doğal ses şu an üretilemiyor; tarayıcı sesiyle devam ediliyor.'); }
      }
    }
    function dolgulariHazirla() { if (!geminiSesAcik()) return; DOLGU[turkceMi() ? 'tr' : 'en'].slice(0, 2).forEach(t => ttsUret(t).catch(() => {})); }

    /* ---- altyazı: söylenen parça (ve örnekse çevirisi) ---- */
    function altyaziGoster(m, i, cevMi) {
      const liste = m.liste, asil = liste[i]; if (!asil) return;
      const ac = aciklamaMi(m), trKut = q('.vd-tr');
      if (ac && asil.dil === 'en' && asil.cev) { trKut.textContent = asil.cev; trKut.hidden = false; trKut.classList.add('ornek'); trKut.classList.toggle('okunuyor', !!cevMi); }
      else if (ac) { trKut.textContent = ''; trKut.classList.remove('ornek', 'okunuyor'); }
      else { trKut.textContent = m.tr || ''; trKut.hidden = !ayar.altyaziTR; }
      const goster = liste.length > 2 ? [[asil, i]] : liste.map((x, k) => [x, k]);
      q('.vd-cumle').innerHTML = goster.map(([x, k]) => `<span class="${k === i && !cevMi ? 'su' : k <= i ? 'gecti' : ''}${x.dil === 'tr' ? ' trp' : ''}">${esc(x.metin)}</span>`).join(' ');
      if (m._el) m._el.querySelectorAll('.vd-p-cev').forEach(el => el.classList.toggle('okunuyor', !!cevMi && +el.dataset.i === i));
    }

    /* ---- konuşmacı: cümleler geldikçe seslendirir (Gemini: bloklar halinde, tarayıcı: cümle cümle) ---- */
    function yeniKonusucu(m) {
      const k = yuz.konusAkis({ hiz: S.rate || 1, sonDuygu: 'cesaret', oncesi: c => { if (c.goster) c.goster(); } });
      const gemini = geminiSesAcik();
      let zincir = Promise.resolve(), bekleyen = [], ilk = true, iptal = false, sesBasladi = false;
      m.okunan = [];
      const acMi = () => aciklamaMi(m) || ayar.mod === 'tr';
      function gosterFn(i, cevMi) {
        return () => {
          sesBasladi = true;
          if (kok.dataset.d !== 'konusuyor') { durum('konusuyor'); yuz.dinle(false); }
          qa('.vd-m.konusan').forEach(x => { if (x !== m._el) x.classList.remove('konusan'); }); if (m._el) m._el.classList.add('konusan');
          altyaziGoster(m, i, cevMi);
        };
      }
      function tarayiciParcalari(c, i) {
        const a = [Object.assign({}, c, { goster: gosterFn(i, false) })];
        if (acMi() && c.dil === 'en' && c.cev) a.push({ metin: c.cev, dil: 'tr', duygu: c.duygu, guc: c.guc, jest: null, goster: gosterFn(i, true) });
        return a;
      }
      function siraylaEkle(p) { zincir = zincir.then(() => p).then(items => { if (iptal) return; items.forEach(it => { k.ekle(it); m.okunan.push(it); }); }); }
      /* Türkçe anlatımdaki bir örneğin çevirisi gelmediyse önce onu tamamla (okunabilsin) */
      function eksikCeviri(parcalar) {
        const eksik = parcalar.filter(({ c }) => acMi() && c.dil === 'en' && !c.cev);
        if (!eksik.length) return Promise.resolve();
        return ai(`Translate these English example sentences into natural Turkish. Return ONLY JSON: {"tr":["..."]} in the same order.\n${eksik.map(({ c }, k) => (k + 1) + ') ' + c.metin).join('\n')}`)
          .then(r => { (r.tr || []).forEach((t, k) => { if (eksik[k] && t) eksik[k].c.cev = String(t).trim(); }); baloncukGuncelle(m); }).catch(() => {});
      }
      function blokGonder(parcalar) {
        siraylaEkle(eksikCeviri(parcalar).then(() => blokHazirla(parcalar)));
      }
      function blokHazirla(parcalar) {
        const tarayici = () => parcalar.flatMap(({ c, i }) => tarayiciParcalari(c, i));
        if (!gemini || st.ttsKapali) return tarayici();
        let metin = ''; const altlar = [];
        const ekle = (t, cfg) => { if (metin) metin += ' '; altlar.push(Object.assign({ poz: metin.length }, cfg)); metin += t; };
        parcalar.forEach(({ c, i }) => { ekle(c.metin, { duygu: c.duygu, guc: c.guc, jest: c.jest, oncesi: gosterFn(i, false) }); if (acMi() && c.dil === 'en' && c.cev) ekle(c.cev, { oncesi: gosterFn(i, true) }); });
        altlar.forEach(a => { a.oran = a.poz / Math.max(1, metin.length); });
        return ttsUret(metin).then(buf => [{ metin, dil: parcalar[0].c.dil, sesTampon: buf, duygu: altlar[0].duygu, guc: altlar[0].guc, jest: null, altlar }])
          .catch(e => { ttsHata(e); return tarayici(); });
      }
      return {
        ekle(c) {
          bekleyen.push({ c, i: m.liste.indexOf(c) });
          if (!gemini || st.ttsKapali) { blokGonder(bekleyen); bekleyen = []; return; }
          /* ilk cümle hemen (beklemeyi kısaltır); gerisi tek parça — kota az (her ses isteği günlük haktan düşer).
             Çok uzun açıklamalarda ~320 harfte bir yeni parça (sessiz boşluk uzamasın). */
          const uz = bekleyen.reduce((a, b) => a + b.c.metin.length + (b.c.cev ? b.c.cev.length : 0), 0);
          if (ilk || uz >= 320) { blokGonder(bekleyen); bekleyen = []; ilk = false; }
        },
        /* uzun beklemede düşünür gibi kısa bir dolgu ("Hmm.", "Let me see.") */
        dolgu() {
          if (sesBasladi || m.liste.length || iptal) return;
          const liste = DOLGU[turkceMi() ? 'tr' : 'en']; const t = liste[(st.dolguN = (st.dolguN || 0) + 1) % 2];
          const dil = turkceMi() && t !== 'Hmm.' ? 'tr' : 'en';
          if (gemini && !st.ttsKapali) {
            /* yalnız hazır (saklanmış) ses varsa çal; yoksa bir dahaki sefere hazırla */
            Promise.race([ttsUret(t), new Promise((_, r) => setTimeout(() => r('gec'), 250))])
              .then(buf => { if (!sesBasladi && !m.liste.length && !iptal) k.ekle({ metin: t, dil, sesTampon: buf, duygu: 'dusunceli', guc: 0.5, jest: 'dusun' }); }).catch(() => {});
          } else k.ekle({ metin: t, dil, duygu: 'dusunceli', guc: 0.5, jest: 'dusun' });
        },
        bitir() { if (bekleyen.length) { blokGonder(bekleyen); bekleyen = []; } zincir = zincir.then(() => k.bitir()); },
        iptal() { iptal = true; yuz.sustur(); },
        bitti() { return zincir.then(() => k.bitti); }
      };
    }

    /* ---- akış halinde cevap: Groq / Cerebras / OpenRouter / Mistral; cümleler tamamlandıkça yakalanır ---- */
    async function akisliCevap(istem, onSeg) {
      const SIRA = ['groq', 'cerebras', 'openrouter', 'mistral'];
      const P = (DHProviders.PROVIDERS || []);
      let son = null;
      for (const id of SIRA) {
        const p = P.find(x => x.id === id); if (!p) continue;
        let keys = []; try { keys = (JSON.parse(localStorage.getItem(p.keyStore) || '[]') || []).filter(Boolean); } catch (e) {}
        for (const key of keys) {
          try { return await akisDene(p, key, istem, onSeg); }
          catch (e) { son = e; if (e && e.basladi) throw e; }   /* yarıda kaldıysa başka sağlayıcıyla tekrar söyletme */
        }
      }
      throw son || { code: 'no-key' };
    }
    async function akisDene(p, key, istem, onSeg) {
      const model = (DHProviders.getModel && DHProviders.getModel(p.id)) || p.model;
      const body = { model, stream: true, temperature: 0.4, max_tokens: 2500, messages: [
        { role: 'system', content: 'You help a Turkish learner practise English inside the Konuşkan app. Reply with valid JSON only, no markdown fences.' },
        { role: 'user', content: istem }] };
      if (/gpt-oss/i.test(model)) body.reasoning_effort = 'low';
      const ctl = new AbortController(); let z = setTimeout(() => ctl.abort(), 15000);
      const res = await fetch(p.url, { method: 'POST', signal: ctl.signal, headers: Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, p.headers || {}), body: JSON.stringify(body) });
      if (res.status === 429) { clearTimeout(z); throw { code: 'rate' }; }
      if (!res.ok || !res.body) { clearTimeout(z); throw { code: 'http', status: res.status }; }
      const rd = res.body.getReader(), dec = new TextDecoder();
      let tampon = '', metin = '', dizi = false, poz = 0, kapandi = false, adet = 0;
      const tara = () => {
        if (kapandi) return;
        if (!dizi) { const k = metin.indexOf('"reply"'); if (k < 0) return; const a = metin.indexOf('[', k); if (a < 0) return; dizi = true; poz = a + 1; }
        for (;;) {
          while (poz < metin.length && /[\s,]/.test(metin[poz])) poz++;
          if (poz >= metin.length) return;
          if (metin[poz] === ']') { kapandi = true; return; }
          if (metin[poz] !== '{') { poz++; continue; }
          let d = 0, ic = false, ka = false, j = poz;
          for (; j < metin.length; j++) { const ch = metin[j]; if (ic) { if (ka) ka = false; else if (ch === '\\') ka = true; else if (ch === '"') ic = false; } else if (ch === '"') ic = true; else if (ch === '{') d++; else if (ch === '}') { d--; if (d === 0) break; } }
          if (j >= metin.length) return;   /* nesne henüz tamamlanmadı */
          try { const o = JSON.parse(metin.slice(poz, j + 1)); const c = segmentCevir(o); if (c) { adet++; onSeg(c); } } catch (e) {}
          poz = j + 1;
        }
      };
      try {
        for (;;) {
          const { value, done } = await rd.read(); if (done) break;
          clearTimeout(z); z = setTimeout(() => ctl.abort(), 15000);
          tampon += dec.decode(value, { stream: true });
          let n; while ((n = tampon.indexOf('\n')) >= 0) {
            const satir = tampon.slice(0, n).trim(); tampon = tampon.slice(n + 1);
            if (!satir.startsWith('data:')) continue; const v = satir.slice(5).trim(); if (v === '[DONE]') continue;
            try { const o = JSON.parse(v); const t = o.choices && o.choices[0] && o.choices[0].delta && o.choices[0].delta.content; if (t) { metin += t; tara(); } } catch (e) {}
          }
        }
      } catch (e) { clearTimeout(z); throw Object.assign({ code: 'network' }, adet ? { basladi: true } : {}); }
      clearTimeout(z);
      let r = null; try { r = parseJSON(metin); } catch (e) {}
      if (!r) { if (!adet) throw { code: 'bad_json' }; r = {}; }
      if (!adet) { (Array.isArray(r.reply) ? r.reply : []).forEach(o => { const c = segmentCevir(o); if (c) { adet++; onSeg(c); } }); if (!adet) throw { code: 'bad_json' }; }
      return r;
    }

    /* ---- akış ---- */
    async function basla() {
      const kendi = q('.vd-kendi input').value.trim();
      if (kendi) st.konu = { id: 'custom', t: kendi, s: '', persona: PERSONA, custom: kendi };
      if (aiOff()) { toast(aiErr({ code: 'no_ai' })); return; }
      try { speechSynthesis.cancel(); yuz.isit(); } catch (e) {}   /* sesleri ısıt: ilk cümlede ağız sesin önüne geçmesin */
      st.faz = 'ders'; st.bas = Date.now(); kok.classList.add('vd-derste');
      if (genis() && ayar.sohbet !== false) sohbetAc(true, true);
      q('.vd-lobi').remove(); q('.vd-alt-bar').hidden = false; q('.vd-sure').hidden = false;
      st.saat = setInterval(() => { const s = Math.floor((Date.now() - st.bas) / 1000); q('.vd-sure').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); lastAct = Date.now(); }, 1000);
      mikrofonHazirla();   /* izni ders başında iste; ilk cevapta beklemesin */
      dolgulariHazirla();
      await sor(null);
    }
    async function sor(metin, ekTalimat) {
      if (st.busy || st.bitti) return; st.busy = true;
      bilgiGizle();
      let um = null;
      if (metin) { um = { role: 'user', text: metin, spoken: !!st.sesli }; st.hist.push(um); st.turns++; ogrenciMesaji(um); }
      durum('dusunuyor'); yuz.dinle(false);
      const dusunZ = setTimeout(() => { if (kok.dataset.d === 'dusunuyor') { yuz.duygu('dusunceli', 0.45); yuz.jest('dusun', 0.6); } }, 900);
      const m = { role: 'assistant', text: '', tr: '', liste: [] };
      const ks = yeniKonusucu(m);
      st.konusucu = ks;
      const dolguZ = setTimeout(() => ks.dolgu(), 1400);
      const onSeg = c => {
        m.liste.push(c); m.text = m.liste.map(x => x.metin).join(' ');
        if (m.liste.length === 1) { clearTimeout(dusunZ); st.hist.push(m); st.son = m; ogretmenMesaji(m); rozet(); }
        else baloncukGuncelle(m);
        ks.ekle(c);
      };
      try {
        const j = `{"reply":[{"s":"segment","lang":"en","tr":"Turkish translation (only for en segments in a Turkish explanation)","emo":"mutlu","gest":"onay"}],"check":{"ok":true,"lang":"en","corrected":"","why_tr":"","tag":""},"reply_tr":"Turkish translation of the English parts of your reply (empty if the reply is all Turkish)"${st.konu.tasks ? ',"tasks_done":[]' : ''}}`;
        const istem = sistem() + `\n\n${st.hist.length ? 'Conversation so far:\n' + gecmis() + '\n\n' : ''}` +
          (metin && genelMi() ? `Write your next reply to the user's last message.${ekTalimat ? ' ' + ekTalimat : ''} Set check to {"ok":true,"lang":"tr"} (no language checking in this mode).`
            : !metin && genelMi() ? (ekTalimat || `Start now IN TURKISH: greet the user warmly in one short sentence${st.konu && st.konu.custom ? ' and start helping with what they want to talk about' : ' and ask how you can help today'}.`)
            : metin ? `Do two things.\n1) Write your next reply.${ekTalimat ? ' ' + ekTalimat : ''}\n2) Check the learner's LAST message. If it is (mostly) in Turkish — a question, a request for explanation, or just Turkish talk — set check.lang="tr", ok=true and do not check it. Otherwise check.lang="en" and flag ONLY real English errors in the English parts: grammar (tense, articles, prepositions, word order, agreement), wrong word choice, clearly unnatural phrasing. NEVER flag punctuation, capitalisation, spelling of names, contractions, filler words${um.spoken ? ', or anything caused by speech recognition (stray periods, stutters, repeated or misheard words)' : ''}. If only such things differ, ok=true and corrected empty. Keep the learner's wording in "corrected"; change only what is wrong. why_tr: informal Turkish (sen), 1-2 short sentences naming the exact rule.${st.konu.tasks ? ' List the numbers of tasks the learner has GENUINELY completed so far in "tasks_done".' : ''}`
            : (ekTalimat ? ekTalimat : ayar.mod === 'tr' ? `Start the lesson now IN TURKISH: greet the learner warmly, say in one sentence what you will study together (the topic above), and begin with the first small step and an English example.` : `Start the lesson now: greet the learner warmly by video, say one short friendly thing, and ask an opening question about the topic.`)) +
          `\n${ETIKET}\nWrite the "reply" array FIRST in the JSON (it is spoken while you write the rest).\nReturn ONLY JSON: ${j}`;
        let r;
        try { r = await akisliCevap(istem, onSeg); }
        catch (e) {
          if (m.liste.length) throw e;
          /* akış olmadıysa normal yoldan (Gemini dahil) bir kerede */
          r = await ai(istem); cumleler(r).forEach(onSeg);
        }
        clearTimeout(dusunZ); clearTimeout(dolguZ);
        if (!m.liste.length) throw { code: 'bad_json' };
        m.tr = r.reply_tr || ''; baloncukGuncelle(m, true);
        if (um) kontrol(um, r.check || { ok: true });
        (r.tasks_done || []).forEach(n => st.done.add(+n));
        cevirileriTamamla(m);
        ks.bitir();
        st.busy = false;
        await ks.bitti();
        sonra(m, false);
      } catch (e) {
        clearTimeout(dusunZ); clearTimeout(dolguZ); st.busy = false; ks.iptal();
        if (m.liste.length) { m.text = m.liste.map(x => x.metin).join(' '); }
        if (um) { const k = um._el && um._el.querySelector('.vd-m-durum'); if (k) k.innerHTML = '<span class="vd-hata">Gönderilemedi</span>'; if (!m.liste.length) { st.hist.pop(); st.turns--; } }
        yuz.duygu('anlayisli', 0.5);
        altyazi('', ''); bilgi(aiErr(e) + ' Tekrar dene.');
        durum('bekliyor');
      }
    }
    function baloncukGuncelle(m, son) {
      if (!m._el) return;
      m._el.querySelector('.vd-m-bub').innerHTML = parcaHTML(m);
      if (son) {
        m._el.querySelector('.vd-m-tr').textContent = m.tr || 'Çeviri yok.';
        if (m.tr && !m._el.querySelector('[data-k=tr]')) {
          const b = document.createElement('button'); b.type = 'button'; b.dataset.k = 'tr'; b.textContent = 'TR';
          b.onclick = e => { const t = m._el.querySelector('.vd-m-tr'); t.hidden = !t.hidden; e.currentTarget.classList.toggle('sec', !t.hidden); };
          m._el.querySelector('.vd-m-a').appendChild(b);
          if (ayar.altyaziTR) { m._el.querySelector('.vd-m-tr').hidden = false; b.classList.add('sec'); }
        }
      }
      const l = q('.vd-liste'); l.scrollTop = l.scrollHeight;
    }
    /* konuşma bittiğinde: altyazıyı söndür, sırayı öğrenciye ver */
    function sonra(m, tekrar) {
      if (m._el) { m._el.querySelectorAll('.vd-p-cev.okunuyor').forEach(el => el.classList.remove('okunuyor')); m._el.classList.remove('konusan'); }
      const trKut = q('.vd-tr'); trKut.classList.remove('ornek', 'okunuyor'); trKut.hidden = !ayar.altyaziTR;
      if (st.bitti || (kok.dataset.d !== 'konusuyor' && kok.dataset.d !== 'dusunuyor')) return;
      q('.vd-cumle').querySelectorAll('span').forEach(s => s.className = 'gecti');
      if (st.konu.tasks && st.done.size >= st.konu.tasks.length && !st.gorevMsg) { st.gorevMsg = true; toast('Tüm görevleri tamamladın! İstersen dersi bitirebilirsin.'); }
      durum('bekliyor');
      if (ayar.ellerSerbest && !tekrar) setTimeout(() => { if (kok.dataset.d === 'bekliyor' && !st.bitti) dinle(); }, 300);
    }
    /* bütün bir mesajı baştan söylet (ör. "Take your time") */
    async function soyle(m, tekrar) {
      if (st.bitti) return;
      const ks = yeniKonusucu(m); m.liste.forEach(c => ks.ekle(c)); ks.bitir();
      await ks.bitti(); sonra(m, tekrar);
    }
    /* tekrar dinle: daha önce üretilmiş sesler yeniden kullanılır (yeni istek yok) */
    async function tekrarSoyle(m) {
      if (st.busy || st.bitti || !m.liste) return;
      if (D.aktif) dinlemeIptal();
      yuz.sustur();
      await new Promise(r => setTimeout(r, 60));
      if (m.okunan && m.okunan.length) {
        const k = yuz.konusAkis({ hiz: S.rate || 1, sonDuygu: 'cesaret', oncesi: c => { if (c.goster) c.goster(); } });
        m.okunan.forEach(it => k.ekle(Object.assign({}, it))); k.bitir(); await k.bitti; sonra(m, true);
      } else await soyle(m, true);
    }
    function kontrol(um, c) {
      if (c.lang === 'tr') { um.check = { ok: true, tr: true }; ogrenciDurum(um); return; }
      if (!c.ok && (!c.corrected || trivialDiff(um.text, c.corrected))) c = { ok: true };
      um.check = c; S.stats.msgs++;
      if (c.ok) { S.stats.ok++; st.okN++; st.xp += 10; addXP(10); }
      else {
        st.xp += 5; addXP(5); const e = addError({ wrong: um.text, right: c.corrected, why: c.why_tr, tag: c.tag || '', mode: 'video', d: today() }); st.errs.push(e); um._err = e;
        if (!kok.classList.contains('vd-sohbet-acik')) {
          bilgiGizle();
          const z = q('.vd-duzeltme'); z.innerHTML = `${vi('pen')}<span><b>Küçük düzeltme:</b> ${esc(c.corrected)}</span>`; z.hidden = false; z.onclick = () => { sohbetAc(true); z.hidden = true; };
          clearTimeout(st.duzZ); st.duzZ = setTimeout(() => { z.hidden = true; }, 7000);
        }
      }
      ogrenciDurum(um);
    }

    /* ================= Mikrofon: kayıt + ses seviyesi + canlı önizleme ================= */
    const mk = { akis: null, ac: null, analiz: null, veri: null, kayit: null, parcalar: [], izin: null, soz: null };
    function mikrofonHazirla() {
      if (mk.akis) return Promise.resolve(true);
      if (mk.izin === false) return Promise.resolve(false);
      if (mk.soz) return mk.soz;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { mk.izin = false; return Promise.resolve(false); }
      mk.soz = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }).then(akis => {
        if (st.bitti) { akis.getTracks().forEach(t => t.stop()); return false; }
        mk.akis = akis;
        const AC = window.AudioContext || window.webkitAudioContext; mk.ac = new AC();
        const src = mk.ac.createMediaStreamSource(akis); mk.analiz = mk.ac.createAnalyser(); mk.analiz.fftSize = 1024; src.connect(mk.analiz);
        mk.veri = new Float32Array(mk.analiz.fftSize); mk.izin = true; return true;
      }).catch(e => { mk.izin = false; if (e && e.name === 'NotAllowedError') bilgi('Mikrofon izni verilmedi. Adres çubuğundaki simgeden izin verebilir ya da yazarak konuşabilirsin.'); return false; });
      return mk.soz;
    }
    function seviye() { if (!mk.analiz) return 0; mk.analiz.getFloatTimeDomainData(mk.veri); let t = 0; for (let i = 0; i < mk.veri.length; i++) t += mk.veri[i] * mk.veri[i]; return Math.sqrt(t / mk.veri.length); }
    const D = { aktif: false, metin: '', gecici: '', konustu: 0, sessizBas: 0, taban: 0, ornek: 0, bas: 0, son: 0, raf: 0, bitiyor: false, kayitVar: false };
    async function dinle() {
      if (st.bitti || st.busy || D.aktif) return;
      D.aktif = true; D.bitiyor = false;
      const kayitVar = await mikrofonHazirla();
      if (st.bitti || st.busy || kok.dataset.d === 'konusuyor') { D.aktif = false; return; }
      if (!kayitVar && !dict) { D.aktif = false; durum('bekliyor'); yazAc(true); return; }
      Object.assign(D, { metin: '', gecici: '', konustu: 0, sessizBas: 0, taban: 0, ornek: 0, bas: performance.now(), son: 0, kayitVar });
      durum('dinliyor'); yuz.dinle(true); yuz.duygu('merak', 0.35);
      q('.vd-sen').hidden = false; senGoster();
      const parcalar = mk.parcalar = [];   /* her kaydın sesi ayrı: yeniden kaydette eski parça karışmasın */
      if (kayitVar) {
        try { if (mk.ac.state === 'suspended') await mk.ac.resume(); } catch (e) {}
        try { mk.kayit = new MediaRecorder(mk.akis); mk.kayit.ondataavailable = e => { if (e.data && e.data.size) parcalar.push(e.data); }; mk.kayit.start(250); } catch (e) { mk.kayit = null; }
        D.raf = requestAnimationFrame(olcum);
      }
      /* canlı önizleme (tarayıcı tanıması) */
      if (dict) {
        micTarget = {
          partial: t => { D.gecici = t; senGoster(); if (!kayitVar) sessizSayac(); dinlerkenOnay(); },
          final: t => { D.metin = (D.metin + ' ' + t).trim(); D.gecici = ''; senGoster(); if (!kayitVar) sessizSayac(); },
          idle: () => { if (!D.aktif || D.bitiyor) return; if (!kayitVar) { dinlemeBitir(); return; }
            /* kayıt sürerken tarayıcı tanıması kendiliğinden kapandıysa yeniden aç */
            setTimeout(() => { if (D.aktif && !D.bitiyor && !micLive) dict.start().catch(() => {}); }, 150); }
        };
        dict.start().catch(() => { if (!kayitVar) { D.aktif = false; durum('bekliyor'); q('.vd-sen').hidden = true; bilgi('Mikrofon açılamadı. Yazarak devam edebilirsin.'); } });
      }
      if (!kayitVar) sessizSayac();
    }
    /* ses seviyesiyle konuşma / sessizlik algılama */
    function olcum(t) {
      if (!D.aktif || D.bitiyor) return;
      const dt = D.son ? Math.min(100, t - D.son) : 16; D.son = t;
      const s = seviye(), gecen = t - D.bas;
      if (gecen < 400) D.taban = (D.taban * D.ornek + s) / (++D.ornek);
      const esik = Math.max(0.012, Math.min(0.08, D.taban * 2.6));
      const bars = q('.vd-dalga').children, sev = Math.min(1, s / Math.max(esik * 3, 0.04));
      for (let i = 0; i < bars.length; i++) bars[i].style.height = (4 + sev * 20 * (0.5 + 0.5 * Math.abs(Math.sin(t / 110 + i * 1.7)))) + 'px';
      if (gecen > 400) {
        if (s > esik) { D.konustu += dt; D.sessizBas = 0; if (D.konustu > 250) dinlerkenOnay(); }
        else if (D.konustu > 200) { if (!D.sessizBas) D.sessizBas = t; else if (ayar.ellerSerbest && t - D.sessizBas > ayar.sessizlik * 1000) { dinlemeBitir(); return; } }
        if (ayar.ellerSerbest && D.konustu < 200 && !(D.metin + D.gecici).trim() && gecen > 10000) { dinlemeBitir(); return; }
        if (gecen > 60000) { dinlemeBitir(); return; }
      }
      D.raf = requestAnimationFrame(olcum);
    }
    function sessizSayac() { clearTimeout(D.sz); if (!ayar.ellerSerbest) return; D.sz = setTimeout(() => { if ((D.metin + D.gecici).trim()) dinlemeBitir(); }, ayar.sessizlik * 1000); }
    function senGoster() { const t = (D.metin + ' ' + D.gecici).trim(); q('.vd-sen-y').textContent = t || 'Dinliyorum… konuşabilirsin'; q('.vd-sen').classList.toggle('bos', !t); }
    function dinlerkenOnay() { if (st.nodZ) return; st.nodZ = setTimeout(() => { st.nodZ = null; }, 2800); if (Math.random() < 0.5) yuz.jest('onay', 0.35); }
    function kaydiDurdur() {
      return new Promise(res => {
        cancelAnimationFrame(D.raf);
        const r = mk.kayit, parcalar = mk.parcalar; mk.kayit = null;
        const paket = () => parcalar.length ? new Blob(parcalar, { type: (r && r.mimeType) || 'audio/webm' }) : null;
        if (!r || r.state === 'inactive') return res(paket());
        r.onstop = () => res(paket());
        try { r.stop(); } catch (e) { res(null); }
      });
    }
    function dinlemeIptal() { D.aktif = false; D.bitiyor = true; clearTimeout(D.sz); micTarget = null; if (micLive) dict.stop().catch(() => {}); kaydiDurdur(); yuz.dinle(false); q('.vd-sen').hidden = true; }
    async function dinlemeBitir() {
      if (!D.aktif || D.bitiyor) return; D.bitiyor = true; clearTimeout(D.sz);
      micTarget = null; if (micLive) dict.stop().catch(() => {});
      const blob = await kaydiDurdur();
      yuz.dinle(false);
      let metin = (D.metin + ' ' + D.gecici).trim();
      const konustu = D.konustu > 200 || !!metin;
      if (konustu && blob && ayar.hassas && geminiKeys().length) {
        durum('anliyor'); q('.vd-sen-y').textContent = metin || 'Söylediklerin yazıya dökülüyor…'; q('.vd-sen').classList.add('anliyor');
        try { const g = await geminiYaziya(blob, st.son && st.son.text, turkceMi() ? 'tr' : 'en'); if (g) metin = g; }
        catch (e) {
          /* tarayıcının metniyle devam; ama kullanıcıyı bir kez uyar */
          if (!st.gemUyari) { st.gemUyari = true; toast(e && e.code === 'rate' ? 'Hassas ses tanıma bugünlük Gemini kotasını doldurdu; tarayıcının tanıması kullanılıyor.' : 'Hassas ses tanıma şu an çalışmadı; tarayıcının tanıması kullanılıyor.'); }
        }
        q('.vd-sen').classList.remove('anliyor');
      }
      D.aktif = false;
      if (st.bitti) return;
      q('.vd-sen').hidden = true;
      if (metin) { st.sabir = 0; if (ayar.onay) onayGoster(metin); else { st.sesli = true; altyaziSen(metin); sor(metin); } return; }
      durum('bekliyor');
      if (!ayar.ellerSerbest) { bilgi('Seni duyamadım. Mikrofona basıp tekrar konuş.'); return; }
      /* hiç konuşmadıysa: bir kez nazikçe hatırlat, sonra beklemeye geç */
      if (st.sabir++ < 1 && st.son) {
        const m = genelMi() ? { role: 'assistant', text: 'Acele etme, dinliyorum.', tr: '', liste: [{ metin: 'Acele etme, dinliyorum.', duygu: 'anlayisli', jest: 'egil', guc: 0.7, dil: 'tr' }] } : { role: 'assistant', text: "Take your time. I'm listening.", tr: 'Acele etme, dinliyorum.', liste: [{ metin: 'Take your time.', duygu: 'anlayisli', jest: 'egil', guc: 0.7, dil: 'en' }, { metin: "I'm listening.", duygu: 'cesaret', jest: null, guc: 0.6, dil: 'en' }] };
        await soyle(m, true); if (!st.bitti && kok.dataset.d === 'bekliyor') dinle();
      } else bilgi('Hazır olunca mikrofona bas (masaüstünde boşluk tuşu).');
    }
    function altyaziSen(t) { q('.vd-cumle').innerHTML = `<span class="vd-senin">${esc(t)}</span>`; q('.vd-tr').textContent = ''; }
    function altyazi(c, tr) { q('.vd-cumle').textContent = c; q('.vd-tr').textContent = tr; }
    function bilgi(m) { const z = q('.vd-ipucu'); q('.vd-duzeltme').hidden = true; z.innerHTML = `<span>${esc(m)}</span>`; z.hidden = false; clearTimeout(st.bilgiZ); st.bilgiZ = setTimeout(() => { z.hidden = true; }, 6000); }
    function bilgiGizle() { q('.vd-ipucu').hidden = true; }

    /* ---- düğmeler ---- */
    q('[data-a=mic]').onclick = () => {
      if (st.bitti) return;
      const d = kok.dataset.d;
      if (d === 'konusuyor') { yuz.sustur(); durum('bekliyor'); dinle(); return; }
      if (d === 'dinliyor') { dinlemeBitir(); return; }
      if (d === 'dusunuyor' || d === 'anliyor') return;
      if (d === 'onay') { onayKapat(); }
      st.sabir = 0; dinle();
    };
    q('.vd-sen-gonder').onclick = () => dinlemeBitir();
    /* dinlerken: kaydı sil ve baştan başla */
    function yenidenKaydet() {
      if (st.bitti || st.busy) return;
      onayKapat();
      if (D.aktif) dinlemeIptal();
      durum('bekliyor'); st.sabir = 0;
      setTimeout(() => { if (!st.bitti) { D.bitiyor = false; dinle(); } }, 250);
    }
    q('.vd-sen-yeniden').onclick = yenidenKaydet;

    /* ---- mikrofonun anladığı metni göster: düzelt, yeniden kaydet ya da gönder ---- */
    const onay = q('.vd-onay'), onayT = onay.querySelector('textarea');
    function onayBoy() { onayT.style.height = 'auto'; onayT.style.height = Math.min(160, onayT.scrollHeight) + 'px'; }
    function sayacDur() { clearTimeout(st.onayZ); onay.classList.remove('sayiyor'); }
    function onayGoster(metin) {
      durum('onay'); yuz.duygu('merak', 0.3);
      onayT.value = metin; onay.hidden = false; kok.classList.add('vd-onay-acik'); onayBoy();
      sayacDur();
      if (ayar.ellerSerbest) {
        /* eller serbest: dokunmazsan 4 sn sonra gönder */
        void onay.offsetWidth; onay.classList.add('sayiyor');
        st.onayZ = setTimeout(() => { if (!onay.hidden) onayGonder(); }, 4000);
      } else if (window.matchMedia('(pointer: fine)').matches) { onayT.focus(); onayT.setSelectionRange(onayT.value.length, onayT.value.length); }
    }
    function onayKapat() { sayacDur(); onay.hidden = true; kok.classList.remove('vd-onay-acik'); if (kok.dataset.d === 'onay') durum('bekliyor'); }
    function onayGonder() {
      const t = onayT.value.replace(/\s+/g, ' ').trim(); onayKapat();
      if (!t) { durum('bekliyor'); return; }
      st.sesli = true; altyaziSen(t); sor(t);
    }
    ['pointerdown', 'focus', 'input', 'keydown'].forEach(ev => onay.addEventListener(ev, sayacDur, true));
    onayT.addEventListener('input', onayBoy);
    onayT.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onayGonder(); } else if (e.key === 'Escape') { e.preventDefault(); onayKapat(); } });
    onay.onsubmit = e => { e.preventDefault(); onayGonder(); };
    onay.querySelector('[data-k=yeniden]').onclick = yenidenKaydet;
    onay.querySelector('[data-k=iptal]').onclick = () => { onayKapat(); bilgi('Silindi. Hazır olunca mikrofona bas.'); };
    function yazAc(zorla) { const f = q('.vd-yaz'); f.hidden = zorla ? false : !f.hidden; kok.classList.toggle('vd-yaz-acik', !f.hidden); if (!f.hidden) { if (D.aktif) { dinlemeIptal(); durum('bekliyor'); } onayKapat(); f.querySelector('input').focus(); } }
    q('[data-a=kb]').onclick = () => yazAc();
    q('.vd-yaz').onsubmit = e => { e.preventDefault(); const i = q('.vd-yaz input'); const t = i.value.trim(); if (!t || st.busy) return; i.value = ''; if (kok.dataset.d === 'konusuyor') yuz.sustur(); st.sesli = false; altyaziSen(t); sor(t); };
    q('[data-a=tekrar]').onclick = () => { if (st.son) tekrarSoyle(st.son); };
    q('[data-a=ipucu]').onclick = async () => {
      if (st.busy || aiOff()) return;
      q('.vd-duzeltme').hidden = true;
      const z = q('.vd-ipucu'); z.hidden = false; z.innerHTML = '<span class="vd-spin kucuk"></span><span>Bir cevap önerisi hazırlanıyor…</span>';
      try {
        const r = await ai(sistem() + `\n\nConversation so far:\n${gecmis()}\n\nSuggest ONE natural answer the learner could give next, at level ${S.level}, max 16 words. Return ONLY JSON: {"suggestion":"...","tr":"Turkish"}`);
        z.innerHTML = `<span><small>Şöyle diyebilirsin</small><b>${esc(r.suggestion)}</b><em>${esc(r.tr)}</em></span><button type="button" aria-label="Dinle">${vi('spk')}</button>`;
        z.querySelector('button').onclick = () => speak(r.suggestion);
        clearTimeout(st.bilgiZ); st.bilgiZ = setTimeout(() => { z.hidden = true; }, 15000);
      } catch (e) { z.innerHTML = `<span>${esc(aiErr(e))}</span>`; }
    };
    q('[data-a=bitir]').onclick = () => bitir();
    function klavye(e) { if (st.faz !== 'ders' || st.bitti || e.target.closest('input,textarea,select,button,[role=button]')) return; if (e.code === 'Space') { e.preventDefault(); q('[data-a=mic]').click(); } }
    document.addEventListener('keydown', klavye);

    /* ---- özet ---- */
    async function bitir() {
      if (st.bitti) return; st.bitti = true; st.ozetVar = true;
      clearInterval(st.saat); yuz.sustur(); if (D.aktif) dinlemeIptal(); onayKapat();
      const sure = Math.max(1, Math.round((Date.now() - st.bas) / 60000));
      if (st.turns && !genelMi()) markDone('video');
      kok.classList.remove('vd-derste', 'vd-sohbet-acik');
      q('.vd-alt-bar').hidden = true; q('.vd-yaz').hidden = true; kok.classList.remove('vd-yaz-acik'); q('.vd-sen').hidden = true; q('.vd-duzeltme').hidden = true; bilgiGizle();
      durum('hazir'); yuz.duygu(st.turns && st.okN >= st.turns / 2 ? 'gururlu' : 'cesaret', 0.8); yuz.jest('onay');
      const o = q('.vd-ozet'); o.hidden = false;
      o.innerHTML = `<div class="vd-kart">
        <span class="vd-etiket">${genelMi() ? 'Sohbet bitti' : 'Ders bitti'}</span><h2>${genelMi() ? (st.turns ? 'Keyifli bir sohbetti!' : 'Sohbet kısa sürdü') : st.turns ? 'Güzel bir dersti!' : 'Ders kısa sürdü'}</h2>
        ${genelMi() ? `<div class="vd-sayilar"><div><b>${sure}</b><span>dakika</span></div><div><b>${st.turns}</b><span>mesaj</span></div></div>` : `<div class="vd-sayilar"><div><b>${sure}</b><span>dakika</span></div><div><b>${st.turns}</b><span>cevap</span></div><div><b>${st.okN}</b><span>hatasız</span></div><div><b>+${st.xp}</b><span>XP</span></div></div>`}
        ${st.konu && st.konu.tasks ? `<p class="vd-gorev">Görevler: ${st.done.size} / ${st.konu.tasks.length}</p>` : ''}
        <div class="vd-yorum"></div>
        ${st.errs.length ? `<h3>Bu dersteki düzeltmeler</h3><div class="vd-oz-liste">${st.errs.map(e => `<div class="vd-duz-k"><div class="vd-fark">${diffHTML(e.wrong, e.right)}</div><div class="vd-dogru">${esc(e.right)}</div><p>${esc(e.why || '')}</p></div>`).join('')}</div><p class="vd-not">Hepsi hata defterine ve Dil Harita'nın ortak hata defterine eklendi.</p>` : (st.turns && !genelMi() ? '<p>Bu derste düzeltilecek bir hata çıkmadı. 👏</p>' : '')}
        <div class="vd-oz-b"><button type="button" class="vd-basla" data-k="yeni">${vi('video')} ${genelMi() ? 'Yeni sohbet' : 'Yeni ders'}</button><button type="button" class="vd-ikincil" data-k="kapat">Kapat</button></div></div>`;
      o.querySelector('[data-k=kapat]').onclick = () => closePanel();
      o.querySelector('[data-k=yeni]').onclick = () => { closePanel(true); startVideo(); };
      saveNow();
      if (st.turns >= 2 && !aiOff() && !genelMi()) {
        const y = o.querySelector('.vd-yorum'); y.innerHTML = '<span class="vd-spin kucuk"></span>';
        try {
          const r = await ai(`You were ${OGRETMEN}, an English teacher, in a short video lesson with a Turkish learner (level ${S.level}).\nTranscript:\n${gecmis(30)}\nGive brief feedback in informal Turkish (sen). Return ONLY JSON: {"guclu":"1 sentence: what went well","gelistir":"1 sentence: the one thing to work on next","ifadeler":["3 useful English phrases from or for this conversation"]}`, { deep: true });
          y.innerHTML = `<div class="vd-geri"><p><b>İyi giden:</b> ${esc(r.guclu)}</p><p><b>Sıradaki adım:</b> ${esc(r.gelistir)}</p>${(r.ifadeler || []).length ? `<div class="vd-ifadeler">${r.ifadeler.map(p => `<button type="button">${vi('spk')} ${esc(p)}</button>`).join('')}</div>` : ''}</div>`;
          y.querySelectorAll('.vd-ifadeler button').forEach((b, i) => b.onclick = () => speak(r.ifadeler[i]));
        } catch (e) { y.innerHTML = ''; }
      }
    }

    panelCleanup = () => {
      st.bitti = true; clearInterval(st.saat); clearTimeout(D.sz); cancelAnimationFrame(D.raf);
      if (st.turns && !st.ozetVar && !genelMi()) { try { markDone('video'); } catch (e) {} }
      document.removeEventListener('keydown', klavye);
      try { if (mk.kayit && mk.kayit.state !== 'inactive') mk.kayit.stop(); } catch (e) {}
      try { mk.akis && mk.akis.getTracks().forEach(t => t.stop()); } catch (e) {}
      try { mk.ac && mk.ac.close(); } catch (e) {}
      micTarget = null; window.KK_DICT_LANG = 'en-US';
      try { yuz.yikil(); } catch (e) {}
      kok.remove(); document.documentElement.classList.remove('vd-acik');
    };
  }
  window.startVideo = startVideo;
  window.__vdWav = wav16k;
})();
