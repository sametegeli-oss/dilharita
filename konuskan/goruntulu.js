/* goruntulu.js — Konuşkan "Görüntülü ders": canlı yüzlü öğretmenle tam ekran sohbet
   ==========================================================================
   konuskan.js'ten SONRA yüklenir; onun ortak parçalarını kullanır:
   ai(), S, LEVEL_GUIDE, learnerContext(), addError(), addXP(), markDone(),
   trivialDiff(), diffHTML(), dict/micTarget/micLive, pickVoice(), openPanel(),
   closePanel(), toast(), aiErr(), esc(), ROLEPLAYS.
   Avatar: dh-canli-yuz.js (DHCanliYuz) — duygu fotoğrafları + WebGL esnetme.

   Akış: bekleme ekranı (konu seç) → görüşme → özet.
   Eller serbest: öğretmen susunca mikrofon kendiliğinden açılır; öğrenci
   1,6 sn susunca cevap gönderilir. İstenirse bas-konuş ya da klavye.
   Yapay zekâ her cevabı cümlelere bölüp her cümleye duygu + jest verir;
   avatar cümleyi o ifadeyle söyler. Düzeltmeler sohbeti bölmeden yan
   panelde görünür, hata defterine ve Dil Harita'ya yazılır. */
"use strict";
(function () {
  if (!window.DHCanliYuz) return;
  MODE_TR.video = 'Görüntülü ders';
  const VI = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    micOff: '<path d="M3 3l18 18"/><path d="M9 9v2a3 3 0 0 0 5 2.2M15 10V6a3 3 0 0 0-5.7-1.3"/><path d="M5 11a7 7 0 0 0 11 5.7M19 11a7 7 0 0 1-.6 2.8M12 18v3"/>',
    kb: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
    again: '<path d="M4 4v6h6"/><path d="M20 12a8 8 0 1 1-2.3-5.7L20 9"/>',
    end: '<path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3-1.5v-2.5a10 10 0 0 0-7 0V16l-3 1.5z"/>',
    cc: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10.5 10.2a2.2 2.2 0 1 0 0 3.6M17 10.2a2.2 2.2 0 1 0 0 3.6"/>',
    fb: '<path d="M4 5h16v11H8l-4 4z"/><path d="M9 10l2 2 4-4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    ok: '<path d="M5 12l5 5L20 7"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    spk: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    send: '<path d="M4 12l16-8-6 16-2-6z"/>',
    video: '<rect x="2" y="6" width="13" height="12" rx="2.5"/><path d="M15 10.5l6-3.5v10l-6-3.5z"/>'
  };
  const vi = (n, c = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${c}>${VI[n]}</svg>`;
  const OGRETMEN = 'Deniz';
  const PERSONA = `${OGRETMEN}, a warm, patient and genuinely interested English teacher on a one-to-one video lesson`;
  const DUYGU = ['notr', 'mutlu', 'cesaret', 'merak', 'dusunceli', 'anlayisli', 'saskin', 'ciddi', 'gururlu'];
  const JEST = ['onay', 'iki_onay', 'hayir', 'egil', 'one_egil', 'dusun', 'kas'];
  const AYAR_KEY = 'dh-konuskan-video-v1';
  let ayar = { ellerSerbest: true, altyaziTR: false, altyazi: true };
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

  /* ---------------- Kurulum ---------------- */
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
          <div><b>${OGRETMEN}</b><span class="vd-alt">İngilizce öğretmeni · <span class="vd-lv">${esc(S.level)}</span></span></div>
        </div>
        <div class="vd-sure" hidden>00:00</div>
        <div class="vd-ust-sag">
          <button class="vd-ib" data-a="cc" title="Altyazı" aria-label="Altyazı">${vi('cc')}</button>
          <button class="vd-ib" data-a="fb" title="Geri bildirim" aria-label="Geri bildirim">${vi('fb')}<em class="vd-rozet" hidden>0</em></button>
          <button class="vd-ib" data-a="ayar" title="Ayarlar" aria-label="Ayarlar">${vi('gear')}</button>
          <button class="vd-ib" data-a="kapat" title="Kapat" aria-label="Kapat">${vi('x')}</button>
        </div>
      </header>
      <section class="vd-lobi">
        <div class="vd-kart">
          <span class="vd-etiket">Görüntülü ders</span>
          <h2>${OGRETMEN} ile yüz yüze konuş</h2>
          <p>Seviyene (${esc(S.level)}) göre konuşur, duygularıyla tepki verir. Hatalarını sohbeti bölmeden yan panelde görürsün.</p>
          <div class="vd-konular"></div>
          <form class="vd-kendi"><input placeholder="Ya da kendi konunu yaz (Türkçe ya da İngilizce)" aria-label="Kendi konun"></form>
          <label class="vd-anahtar"><input type="checkbox" data-a="eller"><span></span> Eller serbest <small>Öğretmen susunca mikrofon kendiliğinden açılır</small></label>
          <button class="vd-basla" type="button">${vi('video')} Dersi başlat</button>
          <p class="vd-not"></p>
        </div>
      </section>
      <div class="vd-altyazi" aria-live="polite"><div class="vd-cumle"></div><div class="vd-tr"></div></div>
      <div class="vd-sen" hidden><span class="vd-dalga"><i></i><i></i><i></i><i></i></span><span class="vd-sen-y"></span></div>
      <div class="vd-ipucu" hidden></div>
      <div class="vd-duzeltme" hidden></div>
      <footer class="vd-alt-bar" hidden>
        <button class="vd-b" data-a="kb" title="Yazarak cevap ver">${vi('kb')}<span>Yaz</span></button>
        <button class="vd-b" data-a="ipucu" title="Ne diyebilirim?">${vi('hint')}<span>İpucu</span></button>
        <button class="vd-mic" data-a="mic" aria-label="Mikrofon">${vi('mic')}</button>
        <button class="vd-b" data-a="tekrar" title="Son cümleyi tekrar et">${vi('again')}<span>Tekrar</span></button>
        <button class="vd-b vd-bitir" data-a="bitir" title="Dersi bitir">${vi('end')}<span>Bitir</span></button>
      </footer>
      <form class="vd-yaz" hidden><input placeholder="İngilizce yaz ve Enter'a bas" aria-label="Mesaj"><button aria-label="Gönder">${vi('send')}</button></form>
      <aside class="vd-panel" aria-label="Geri bildirim"><div class="vd-panel-ust"><b>Geri bildirim</b><button class="vd-ib" data-a="fbkapat" aria-label="Kapat">${vi('x')}</button></div><div class="vd-liste"><p class="vd-bos">Konuşmaya başlayınca her cevabın burada kontrol edilir.</p></div></aside>
      <div class="vd-ayarlar" hidden>
        <b>Ayarlar</b>
        <label class="vd-anahtar"><input type="checkbox" data-a="eller2"><span></span> Eller serbest</label>
        <label class="vd-anahtar"><input type="checkbox" data-a="trAc"><span></span> Türkçe altyazı</label>
        <label class="vd-satir">Konuşma hızı <input type="range" min="0.7" max="1.2" step="0.05" data-a="hiz"></label>
        <label class="vd-satir">Yapay zekâ <select data-a="tier">${TIERS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
      </div>
      <section class="vd-ozet" hidden></section>`;
    document.body.appendChild(kok);
    document.documentElement.classList.add('vd-acik');
    const q = s => kok.querySelector(s), qa = s => kok.querySelectorAll(s);

    const st = { faz: 'lobi', konu: null, hist: [], errs: [], turns: 0, okN: 0, xp: 0, busy: false, bas: 0, sonCevap: null, duyulan: '', gecici: '', sessizZ: null, dinleDeneme: 0, done: new Set(), bitti: false, nodZ: null };

    /* avatar */
    const v = pickVoice && pickVoice();
    const yuz = DHCanliYuz.olustur(q('.vd-yuz'), { yol: './assets/avatars_v4/teacher/', sesAdi: v ? v.name : undefined });
    yuz.profil({ ifade: 0.75, enerji: 0.55, jest: 0.55 });
    yuz.hazir.then(() => { q('.vd-yukleniyor').remove(); yuz.duygu('cesaret', 0.5); },
      () => { q('.vd-yukleniyor').innerHTML = '<p>Avatar bu cihazda açılamadı (WebGL yok). Ders yine de sesli devam edebilir.</p>'; });

    /* ---- durum ---- */
    const DURUM = { hazir: 'Hazır', dinliyor: 'Seni dinliyor', dusunuyor: 'Düşünüyor', konusuyor: 'Konuşuyor', bekliyor: 'Senin sıran' };
    function durum(d) { const e = q('.vd-durum'); e.dataset.d = d; q('.vd-durum-y').textContent = DURUM[d] || d; kok.dataset.d = d;
      q('.vd-mic').classList.toggle('canli', d === 'dinliyor'); }

    /* ---- lobi ---- */
    const kl = konular();
    q('.vd-konular').innerHTML = kl.map((k, i) => `<button type="button" class="vd-konu ${i === 0 ? 'sec' : ''}" data-i="${i}"><b>${esc(k.t)}</b><span>${esc(k.s)}</span></button>`).join('');
    st.konu = kl[0];
    qa('.vd-konu').forEach(b => b.onclick = () => { qa('.vd-konu').forEach(x => x.classList.remove('sec')); b.classList.add('sec'); st.konu = kl[+b.dataset.i]; q('.vd-kendi input').value = ''; });
    q('.vd-kendi').onsubmit = e => { e.preventDefault(); basla(); };
    const eller = q('[data-a=eller]'); eller.checked = ayar.ellerSerbest; eller.onchange = () => { ayar.ellerSerbest = eller.checked; ayarKaydet(); q('[data-a=eller2]').checked = eller.checked; };
    if (aiOff()) q('.vd-not').textContent = aiErr({ code: 'no_ai' });
    else if (!dict) q('.vd-not').textContent = 'Bu tarayıcıda ses tanıma yok; yazarak konuşabilirsin. Sesli konuşmak için Chrome ya da Edge kullan.';
    q('.vd-basla').onclick = basla;

    /* ---- ayarlar ---- */
    q('[data-a=eller2]').checked = ayar.ellerSerbest;
    q('[data-a=eller2]').onchange = e => { ayar.ellerSerbest = e.target.checked; ayarKaydet(); eller.checked = ayar.ellerSerbest; if (ayar.ellerSerbest && st.faz === 'ders' && kok.dataset.d === 'bekliyor') dinle(); };
    q('[data-a=trAc]').checked = ayar.altyaziTR;
    q('[data-a=trAc]').onchange = e => { ayar.altyaziTR = e.target.checked; ayarKaydet(); q('.vd-tr').hidden = !ayar.altyaziTR; };
    q('.vd-tr').hidden = !ayar.altyaziTR;
    q('[data-a=hiz]').value = S.rate; q('[data-a=hiz]').oninput = e => { S.rate = +e.target.value; touchSettings(); };
    q('[data-a=tier]').value = S.tierChat; q('[data-a=tier]').onchange = e => { S.tierChat = e.target.value; touchSettings(); };
    q('[data-a=ayar]').onclick = () => { q('.vd-ayarlar').hidden = !q('.vd-ayarlar').hidden; };
    q('[data-a=cc]').onclick = () => { ayar.altyazi = !ayar.altyazi; ayarKaydet(); kok.classList.toggle('vd-cc-yok', !ayar.altyazi); };
    kok.classList.toggle('vd-cc-yok', !ayar.altyazi);
    q('[data-a=fb]').onclick = () => { kok.classList.toggle('vd-panel-acik'); q('.vd-rozet').hidden = true; q('.vd-rozet').textContent = '0'; };
    q('[data-a=fbkapat]').onclick = () => kok.classList.remove('vd-panel-acik');
    q('[data-a=kapat]').onclick = () => { if (st.faz === 'ders' && st.turns) bitir(); else closePanel(); };
    kok.addEventListener('pointerdown', e => { if (!q('.vd-ayarlar').hidden && !e.target.closest('.vd-ayarlar,[data-a=ayar]')) q('.vd-ayarlar').hidden = true; });

    /* ---- yapay zekâ ---- */
    function sistem() {
      const LV = S.level, k = st.konu;
      let s = `You are ${k.persona}. You are on a live one-to-one VIDEO lesson with a Turkish native speaker who is learning English at CEFR level ${LV}. ${LEVEL_GUIDE[LV]}
Speak like a real person on a video call: warm, natural, encouraging; 1-3 short sentences; usually end with ONE follow-up question. No emojis, no lists, no stage directions. Never break role. Do not correct the learner in your reply (corrections are shown on screen separately), but you may naturally reuse the correct form.`;
      if (k.tasks) s += `\nScene: ${k.scene}. Over the conversation the learner should complete these tasks: ${k.tasks.map((t, i) => (i + 1) + ') ' + t).join(' ')}. Create natural chances for them; never list them.`;
      if (k.custom) s += `\nTopic chosen by the learner: ${k.custom}`;
      return s + learnerContext();
    }
    const ETIKET = `Split your reply into its sentences. For EACH sentence choose the face the teacher should show: "emo" one of ${DUYGU.join('|')} and "gest" one of ${JEST.join('|')} or null. Choose by meaning: praise→mutlu or gururlu with iki_onay; gentle correction or "almost"→anlayisli with egil; encouragement→cesaret; a question→merak (often egil or kas); thinking aloud→dusunceli with dusun; real surprise→saskin with kas; an important warning→ciddi. Use null gesture often; not every sentence needs one.`;
    function gecmis(n = 14) { return st.hist.slice(-n).map(h => (h.role === 'user' ? 'Learner: ' : 'You: ') + h.text).join('\n'); }
    function cumleler(r) {
      let arr = Array.isArray(r.reply) ? r.reply : null;
      if (!arr) return DHCanliYuz.etiketle(String(r.reply || ''));
      return arr.map(x => ({ metin: String(x.s || x.text || '').trim(), duygu: DUYGU.includes(x.emo) ? x.emo : 'cesaret', jest: JEST.includes(x.gest) ? x.gest : null, guc: 0.85, dil: 'en' })).filter(x => x.metin);
    }

    /* ---- akış ---- */
    async function basla() {
      const kendi = q('.vd-kendi input').value.trim();
      if (kendi) st.konu = { id: 'custom', t: kendi, s: '', persona: PERSONA, custom: kendi };
      if (aiOff()) { toast(aiErr({ code: 'no_ai' })); return; }
      try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) {}   /* iOS: sesi kullanıcı dokunuşuyla aç */
      st.faz = 'ders'; st.bas = Date.now(); kok.classList.add('vd-derste');
      q('.vd-lobi').remove(); q('.vd-alt-bar').hidden = false; q('.vd-sure').hidden = false;
      st.saat = setInterval(() => { const s = Math.floor((Date.now() - st.bas) / 1000); q('.vd-sure').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); lastAct = Date.now(); }, 1000);
      await sor(null);
    }
    async function sor(metin, ekTalimat) {
      if (st.busy || st.bitti) return; st.busy = true;
      ipucuGizle();
      let um = null;
      if (metin) { um = { role: 'user', text: metin, spoken: !!st.sesli }; st.hist.push(um); st.turns++; }
      durum('dusunuyor'); yuz.dinle(false);
      const dusunZ = setTimeout(() => { if (kok.dataset.d === 'dusunuyor') { yuz.duygu('dusunceli', 0.45); yuz.jest('dusun', 0.6); } }, 900);
      try {
        const j = `{"check":{"ok":true,"corrected":"","why_tr":"","tag":""},"reply":[{"s":"sentence","emo":"mutlu","gest":"onay"}],"reply_tr":"Turkish translation of the whole reply"${st.konu.tasks ? ',"tasks_done":[]' : ''}}`;
        const istem = sistem() + `\n\n${st.hist.length ? 'Conversation so far:\n' + gecmis() + '\n\n' : ''}` +
          (metin ? `Do two things.\n1) Check the learner's LAST message. Flag ONLY real English errors: grammar (tense, articles, prepositions, word order, agreement), wrong word choice, clearly unnatural phrasing. NEVER flag punctuation, capitalisation, spelling of names, contractions, filler words${um.spoken ? ', or anything caused by speech recognition (stray periods, stutters, repeated or misheard words)' : ''}. If only such things differ, ok=true and corrected empty. Keep the learner's wording in "corrected"; change only what is wrong. why_tr: informal Turkish (sen), 1-2 short sentences naming the exact rule.\n2) Write your next reply.${ekTalimat ? ' ' + ekTalimat : ''}${st.konu.tasks ? ' List the numbers of tasks the learner has GENUINELY completed so far in "tasks_done".' : ''}`
            : `Start the lesson now: greet the learner warmly by video, say one short friendly thing, and ask an opening question about the topic.${ekTalimat ? ' ' + ekTalimat : ''}`) +
          `\n${ETIKET}\nReturn ONLY JSON: ${j}`;
        const r = await ai(istem);
        clearTimeout(dusunZ);
        if (um) kontrol(um, r.check || { ok: true });
        (r.tasks_done || []).forEach(n => st.done.add(+n));
        const liste = cumleler(r);
        const yanit = liste.map(c => c.metin).join(' ');
        if (!yanit) throw { code: 'bad_json' };
        st.hist.push({ role: 'assistant', text: yanit, tr: r.reply_tr || '' });
        st.sonCevap = { liste, tr: r.reply_tr || '' };
        st.busy = false;
        await soyle(liste, r.reply_tr || '');
      } catch (e) {
        clearTimeout(dusunZ); st.busy = false;
        if (um) { st.hist.pop(); st.turns--; }
        yuz.duygu('anlayisli', 0.5);
        altyazi('', ''); bilgi(aiErr(e) + ' Tekrar söylemeyi dene.');
        durum('bekliyor');
      }
    }
    async function soyle(liste, tr) {
      if (st.bitti) return;
      durum('konusuyor'); yuz.dinle(false);
      q('.vd-tr').textContent = tr;
      await yuz.konus(liste, { hiz: S.rate || 1, sonDuygu: 'cesaret', oncesi: (c, i) => {
        q('.vd-cumle').innerHTML = liste.map((x, k) => `<span class="${k === i ? 'su' : k < i ? 'gecti' : ''}">${esc(x.metin)}</span>`).join(' ');
      } });
      if (st.bitti) return;
      q('.vd-cumle').querySelectorAll('span').forEach(s => s.className = 'gecti');
      if (st.konu.tasks && st.done.size >= st.konu.tasks.length && !st.gorevMsg) { st.gorevMsg = true; toast('Tüm görevleri tamamladın! İstersen dersi bitirebilirsin.'); }
      durum('bekliyor');
      if (ayar.ellerSerbest && dict) { st.dinleDeneme = 0; setTimeout(() => { if (kok.dataset.d === 'bekliyor' && !st.bitti) dinle(); }, 350); }
    }
    function kontrol(um, c) {
      if (!c.ok && (!c.corrected || trivialDiff(um.text, c.corrected))) c = { ok: true };
      um.check = c; S.stats.msgs++;
      if (c.ok) { S.stats.ok++; st.okN++; st.xp += 10; addXP(10); }
      else { st.xp += 5; addXP(5); const e = addError({ wrong: um.text, right: c.corrected, why: c.why_tr, tag: c.tag || '', mode: 'video', d: today() }); st.errs.push(e); um._err = e; }
      kart(um);
    }
    function kart(um) {
      const l = q('.vd-liste'); const bos = l.querySelector('.vd-bos'); if (bos) bos.remove();
      const c = um.check, d = document.createElement('div'); d.className = 'vd-fb ' + (c.ok ? 'iyi' : 'duz');
      d.innerHTML = c.ok
        ? `<div class="vd-fb-b">${vi('ok')} Hatasız</div><p>${esc(um.text)}</p>`
        : `<div class="vd-fb-b">${vi('pen')} Düzeltme${c.tag ? ` · <em>${esc(c.tag)}</em>` : ''}</div><div class="vd-fark">${diffHTML(um.text, c.corrected)}</div><div class="vd-dogru">${esc(c.corrected)}</div><p>${esc(c.why_tr)}</p><div class="vd-fb-a"><button type="button" data-k="dinle">${vi('spk')} Dinle</button><button type="button" data-k="yanlis">Bu düzeltme yanlış</button></div>`;
      l.prepend(d);
      if (!c.ok) {
        d.querySelector('[data-k=dinle]').onclick = () => speak(c.corrected);
        d.querySelector('[data-k=yanlis]').onclick = () => { removeError(um._err); const k = st.errs.indexOf(um._err); if (k >= 0) st.errs.splice(k, 1); um.check = { ok: true }; S.stats.ok++; st.okN++; addXP(5); d.remove(); kart(um); toast('Düzeltme kaldırıldı'); };
        /* sohbeti bölmeden küçük bir uyarı */
        ipucuGizle();
        const z = q('.vd-duzeltme'); z.innerHTML = `${vi('pen')}<span><b>Küçük düzeltme:</b> ${esc(c.corrected)}</span>`; z.hidden = false; z.onclick = () => { kok.classList.add('vd-panel-acik'); z.hidden = true; };
        clearTimeout(st.duzZ); st.duzZ = setTimeout(() => { z.hidden = true; }, 7000);
        if (!kok.classList.contains('vd-panel-acik')) { const r = q('.vd-rozet'); r.hidden = false; r.textContent = String(+r.textContent + 1); }
      }
    }

    /* ---- dinleme (eller serbest) ---- */
    function dinle() {
      if (!dict || st.bitti || st.busy) return;
      if (micLive) return;
      st.duyulan = ''; st.gecici = ''; st.gonderildi = false;
      micTarget = {
        partial: t => { st.gecici = t; senGoster(); sessizSay(); dinlerkenOnay(); },
        final: t => { st.duyulan = (st.duyulan + ' ' + t).trim(); st.gecici = ''; senGoster(); sessizSay(); },
        idle: () => dinlemeBitti()
      };
      durum('dinliyor'); yuz.dinle(true); yuz.duygu('merak', 0.35);
      q('.vd-sen').hidden = false; senGoster();
      dict.start().catch(e => { durum('bekliyor'); yuz.dinle(false); q('.vd-sen').hidden = true; if (e && e.code === 'not_granted') bilgi('Mikrofon izni verilmedi. Tarayıcının adres çubuğundan izin verebilir ya da yazarak konuşabilirsin.'); });
    }
    function senGoster() { const t = (st.duyulan + ' ' + st.gecici).trim(); q('.vd-sen-y').textContent = t || 'Dinliyorum… konuşabilirsin'; q('.vd-sen').classList.toggle('bos', !t); }
    function sessizSay() { clearTimeout(st.sessizZ); if (!ayar.ellerSerbest) return; st.sessizZ = setTimeout(() => { if ((st.duyulan + st.gecici).trim()) durdurVeGonder(); }, 1600); }
    function dinlerkenOnay() { if (st.nodZ) return; st.nodZ = setTimeout(() => { st.nodZ = null; }, 2600); if (Math.random() < 0.55) yuz.jest('onay', 0.35); }
    function durdurVeGonder() { clearTimeout(st.sessizZ); st.gonderilecek = true; if (micLive) dict.stop().catch(() => {}); else dinlemeBitti(); }
    function dinlemeBitti() {
      clearTimeout(st.sessizZ);
      const t = (st.duyulan + ' ' + st.gecici).trim();
      micTarget = null; yuz.dinle(false);
      if (st.gonderildi || st.bitti) return;
      if (t) { st.gonderildi = true; q('.vd-sen').hidden = true; st.sesli = true; altyaziSen(t); sor(t); return; }
      /* hiç ses gelmediyse: eller serbestte birkaç kez yeniden dinle */
      if (ayar.ellerSerbest && kok.dataset.d === 'dinliyor' && st.dinleDeneme++ < 2) { setTimeout(dinle, 200); return; }
      q('.vd-sen').hidden = true; durum('bekliyor');
      if (ayar.ellerSerbest) bilgi('Seni duyamadım. Konuşmak için mikrofona bas.');
    }
    function altyaziSen(t) { q('.vd-cumle').innerHTML = `<span class="vd-senin">${esc(t)}</span>`; q('.vd-tr').textContent = ''; }
    function altyazi(c, tr) { q('.vd-cumle').textContent = c; q('.vd-tr').textContent = tr; }
    function bilgi(m) { const z = q('.vd-ipucu'); z.innerHTML = `<span>${esc(m)}</span>`; z.hidden = false; clearTimeout(st.bilgiZ); st.bilgiZ = setTimeout(() => { z.hidden = true; }, 6000); }
    function ipucuGizle() { q('.vd-ipucu').hidden = true; }

    /* ---- düğmeler ---- */
    q('[data-a=mic]').onclick = () => {
      if (st.bitti) return;
      if (kok.dataset.d === 'konusuyor') { yuz.sustur(); durum('bekliyor'); dinle(); return; }
      if (kok.dataset.d === 'dinliyor') { durdurVeGonder(); return; }
      if (kok.dataset.d === 'dusunuyor') return;
      if (!dict) { yazAc(); return; }
      st.dinleDeneme = 0; dinle();
    };
    function yazAc() { const f = q('.vd-yaz'); f.hidden = !f.hidden; if (!f.hidden) { if (micLive) { st.gonderildi = true; dict.stop().catch(() => {}); q('.vd-sen').hidden = true; durum('bekliyor'); } f.querySelector('input').focus(); } }
    q('[data-a=kb]').onclick = yazAc;
    q('.vd-yaz').onsubmit = e => { e.preventDefault(); const i = q('.vd-yaz input'); const t = i.value.trim(); if (!t || st.busy) return; i.value = ''; if (kok.dataset.d === 'konusuyor') yuz.sustur(); st.sesli = false; altyaziSen(t); sor(t); };
    q('[data-a=tekrar]').onclick = () => { if (st.sonCevap && !st.busy && kok.dataset.d !== 'dinliyor') { yuz.sustur(); soyle(st.sonCevap.liste, st.sonCevap.tr); } };
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
    function klavye(e) { if (st.faz !== 'ders' || e.target.closest('input,textarea,select')) return; if (e.code === 'Space') { e.preventDefault(); q('[data-a=mic]').click(); } }
    document.addEventListener('keydown', klavye);

    /* ---- özet ---- */
    async function bitir() {
      if (st.bitti) return; st.bitti = true; st.ozetVar = true;
      clearInterval(st.saat); clearTimeout(st.sessizZ); yuz.sustur(); if (micLive) dict.stop().catch(() => {}); micTarget = null;
      const sure = Math.max(1, Math.round((Date.now() - st.bas) / 60000));
      if (st.turns) markDone('video');
      kok.classList.remove('vd-panel-acik', 'vd-derste'); q('.vd-alt-bar').hidden = true; q('.vd-yaz').hidden = true; q('.vd-sen').hidden = true; q('.vd-duzeltme').hidden = true; ipucuGizle();
      durum('hazir'); yuz.duygu(st.turns && st.okN >= st.turns / 2 ? 'gururlu' : 'cesaret', 0.8); yuz.jest('onay');
      const o = q('.vd-ozet'); o.hidden = false;
      o.innerHTML = `<div class="vd-kart">
        <span class="vd-etiket">Ders bitti</span><h2>${st.turns ? 'Güzel bir dersti!' : 'Ders kısa sürdü'}</h2>
        <div class="vd-sayilar"><div><b>${sure}</b><span>dakika</span></div><div><b>${st.turns}</b><span>cevap</span></div><div><b>${st.okN}</b><span>hatasız</span></div><div><b>+${st.xp}</b><span>XP</span></div></div>
        ${st.konu && st.konu.tasks ? `<p class="vd-gorev">Görevler: ${st.done.size} / ${st.konu.tasks.length}</p>` : ''}
        <div class="vd-yorum"></div>
        ${st.errs.length ? `<h3>Bu dersteki düzeltmeler</h3><div class="vd-oz-liste">${st.errs.map(e => `<div class="vd-fb duz"><div class="vd-fark">${diffHTML(e.wrong, e.right)}</div><div class="vd-dogru">${esc(e.right)}</div><p>${esc(e.why || '')}</p></div>`).join('')}</div><p class="vd-not">Hepsi hata defterine ve Dil Harita'nın ortak hata defterine eklendi.</p>` : (st.turns ? '<p>Bu derste düzeltilecek bir hata çıkmadı. 👏</p>' : '')}
        <div class="vd-oz-b"><button type="button" class="vd-basla" data-k="yeni">${vi('video')} Yeni ders</button><button type="button" class="vd-ikincil" data-k="kapat">Kapat</button></div></div>`;
      o.querySelector('[data-k=kapat]').onclick = () => closePanel();
      o.querySelector('[data-k=yeni]').onclick = () => { closePanel(true); startVideo(); };
      saveNow();
      if (st.turns >= 2 && !aiOff()) {
        const y = o.querySelector('.vd-yorum'); y.innerHTML = '<span class="vd-spin kucuk"></span>';
        try {
          const r = await ai(`You were ${OGRETMEN}, an English teacher, in a short video lesson with a Turkish learner (level ${S.level}).\nTranscript:\n${gecmis(30)}\nGive brief feedback in informal Turkish (sen). Return ONLY JSON: {"guclu":"1 sentence: what went well","gelistir":"1 sentence: the one thing to work on next","ifadeler":["3 useful English phrases from or for this conversation"]}`, { deep: true });
          y.innerHTML = `<div class="vd-geri"><p><b>İyi giden:</b> ${esc(r.guclu)}</p><p><b>Sıradaki adım:</b> ${esc(r.gelistir)}</p>${(r.ifadeler || []).length ? `<div class="vd-ifadeler">${r.ifadeler.map(p => `<button type="button">${vi('spk')} ${esc(p)}</button>`).join('')}</div>` : ''}</div>`;
          y.querySelectorAll('.vd-ifadeler button').forEach((b, i) => b.onclick = () => speak(r.ifadeler[i]));
        } catch (e) { y.innerHTML = ''; }
      }
    }

    panelCleanup = () => {
      st.bitti = true; clearInterval(st.saat); clearTimeout(st.sessizZ);
      if (st.turns && !st.ozetVar) { try { markDone('video'); } catch (e) {} }
      document.removeEventListener('keydown', klavye);
      try { yuz.yikil(); } catch (e) {}
      kok.remove(); document.documentElement.classList.remove('vd-acik');
    };
  }
  window.startVideo = startVideo;
})();
