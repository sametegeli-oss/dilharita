/* DHGoogle — Konuşkan genel asistanı için Google hesabı bağlantısı (tamamen tarayıcıda).
   - Giriş: OAuth "token" akışı (açılır pencere + google-donus.html). Erişim anahtarı yalnız bu tarayıcıda, ~1 saat geçerli.
   - Yetki: Takvim (oku + etkinlik ekle), Gmail (oku + TASLAK oluştur; göndermez), Görevler (oku + ekle),
            Kişiler (oku), Drive (oku).
   - Yazan her işlem (etkinlik / taslak / görev) kullanıcı onayından geçer (onay geri çağrısı).
   - Araç sonuçları kısaltılır: Groq'un dakikalık token sınırı dolmasın. */
(function () {
  'use strict';
  const CID_KEY = 'dh-google-client-id', TOK_KEY = 'dh-google-token-v1', ONAY_KEY = 'dh-google-izin-verildi';
  const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/tasks',
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');
  const TZ = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Europe/Istanbul';
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };

  /* Dil Harita'nın Google OAuth istemci kimliği (gizli değildir; yalnız https://sametegeli-oss.github.io kaynağında çalışır) */
  const VARSAYILAN_ISTEMCI = '562124015557-k34l1lm68pqgijogq2b28ddi5n93uukd.apps.googleusercontent.com';
  const istemci = () => (LS.get(CID_KEY) || window.DH_GOOGLE_CLIENT_ID || VARSAYILAN_ISTEMCI || '').trim();
  /* Bağlantı, onu kuran Dil Harita kullanıcısına aittir: aynı tarayıcıda başka biri girerse görünmez ve silinir. */
  const kullanici = () => LS.get('dh_logged_uid') || '';
  const girisEposta = () => (LS.get('dh_logged_email') || '').trim().toLowerCase();
  function token() {
    try {
      const t = JSON.parse(LS.get(TOK_KEY) || 'null'); if (!t) return null;
      if ((t.uid || '') !== kullanici()) { LS.set(TOK_KEY, null); LS.set(ONAY_KEY, null); return null; }
      return t.exp > Date.now() + 60000 ? t : null;
    } catch (e) { return null; }
  }
  const dinleyiciler = new Set(); const bildir = () => dinleyiciler.forEach(f => { try { f(durum()); } catch (e) {} });
  function durum() { const t = token(); const ge = girisEposta(); const e = t && t.eposta || '';
    return { istemci: !!istemci(), bagli: !!t, eposta: e, girisEposta: ge, farkli: !!(t && e && ge && e.toLowerCase() !== ge), dahaOnce: LS.get(ONAY_KEY) === '1' && LS.get(ONAY_KEY + ':uid') === kullanici() }; }

  let gisYuk = null;
  function gisYukle() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisYuk) return gisYuk;
    gisYuk = new Promise((ok, red) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => ok(); s.onerror = () => { gisYuk = null; red({ code: 'google_yuklenemedi' }); }; document.head.appendChild(s); });
    return gisYuk;
  }
  /* Kullanıcı hareketi (tıklama) içinde çağrılmalı: Google küçük bir pencere açar.
     Kendi açılır pencere akışımız: Google, onaydan sonra aynı sitedeki google-donus.html'e döner; o sayfa anahtarı
     localStorage'a yazar, bu sekme "storage" olayıyla görür. (GIS penceresi Chrome'da bazen bağlantıyı koparıp
     "popup_closed" diyordu; bu yol pencere ile sekme arasında doğrudan bağlantıya ihtiyaç duymaz.) */
  const DONUS = new URL('../google-donus.html', document.currentScript ? document.currentScript.src : location.href).href.split('?')[0];
  let bekleyen = null;
  function baglan(zorla) {
    const cid = istemci(); if (!cid) return Promise.reject({ code: 'google_istemci_yok' });
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    LS.set('dh-google-state', state); LS.set('dh-google-donus', null);
    const sessiz = !zorla && durum().dahaOnce;
    const q = new URLSearchParams({ client_id: cid, redirect_uri: DONUS, response_type: 'token', scope: SCOPES, include_granted_scopes: 'true', state, prompt: sessiz ? 'none' : 'consent' });
    if (girisEposta()) q.set('login_hint', girisEposta());
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + q;
    const w = window.open(url, 'dh-google-giris', 'width=520,height=680,left=' + Math.max(0, (screen.width - 520) / 2) + ',top=' + Math.max(0, (screen.height - 680) / 2));
    if (!w) return Promise.reject({ code: 'google_red', detay: 'popup_blocked' });
    if (bekleyen) bekleyen.iptal();
    return new Promise((ok, red) => {
      let bitti = false;
      const son = (f, v) => { if (bitti) return; bitti = true; clearInterval(z); window.removeEventListener('storage', bak); bekleyen = null; f(v); };
      const bak = () => {
        let d = null; try { d = JSON.parse(LS.get('dh-google-donus') || 'null'); } catch (e) {}
        if (!d) return;
        if (d.ok && token()) { bildir(); son(ok, durum()); }
        else if (d.hata) {
          /* sessiz yenileme izin isterse: bir kez onay ekranıyla dene */
          if (sessiz && /interaction_required|consent_required|login_required/.test(d.hata)) { son(red, { code: 'google_red', detay: d.hata }); return; }
          son(red, { code: 'google_red', detay: d.hata });
        }
      };
      const bas = Date.now();
      const z = setInterval(() => { bak(); if (Date.now() - bas > 10 * 60000) son(red, { code: 'google_red', detay: 'zaman_asimi' }); }, 700);
      window.addEventListener('storage', bak);
      bekleyen = { iptal: () => son(red, { code: 'google_red', detay: 'yeni_deneme' }) };
    });
  }
  function kes() {
    const t = token(); LS.set(TOK_KEY, null); LS.set(ONAY_KEY, null); LS.set(ONAY_KEY + ':uid', null);
    try { if (t) fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t.erisim), { method: 'POST', mode: 'no-cors' }).catch(() => {}); } catch (e) {}
    bildir();
  }

  async function api(url, o = {}) {
    const t = token(); if (!t) throw { code: 'google_auth' };
    const r = await fetch(url, Object.assign({}, o, { headers: Object.assign({ Authorization: 'Bearer ' + t.erisim }, o.json ? { 'Content-Type': 'application/json' } : {}, o.headers || {}), body: o.json ? JSON.stringify(o.json) : o.body }));
    if (r.status === 401) { LS.set(TOK_KEY, null); bildir(); throw { code: 'google_auth' }; }
    if (r.status === 403) { let m = ''; try { m = (await r.json()).error.message; } catch (e) {} throw { code: 'google_yetki', mesaj: m }; }
    if (!r.ok) throw { code: 'google_http', status: r.status };
    return o.metin ? r.text() : r.json();
  }
  const kisalt = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
  const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64coz = s => { try { return decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')))); } catch (e) { return ''; } };
  const htmlMetin = h => { const d = new DOMParser().parseFromString(h, 'text/html'); d.querySelectorAll('script,style').forEach(x => x.remove()); return d.body ? d.body.textContent : ''; };
  const baslik = (m, ad) => { const h = (m.payload && m.payload.headers || []).find(x => x.name.toLowerCase() === ad.toLowerCase()); return h ? h.value : ''; };
  function govde(p) {
    if (!p) return '';
    if (p.mimeType === 'text/plain' && p.body && p.body.data) return b64coz(p.body.data);
    let html = '';
    for (const c of (p.parts || [])) { const t = govde(c); if (t && c.mimeType !== 'text/html') return t; if (c.mimeType === 'text/html' && c.body && c.body.data) html = b64coz(c.body.data); }
    if (p.mimeType === 'text/html' && p.body && p.body.data) html = b64coz(p.body.data);
    return html ? htmlMetin(html) : '';
  }
  const tarihGoster = s => { try { return new Date(s).toLocaleString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }); } catch (e) { return s; } };

  /* ---- araçlar ---- */
  const A = {};
  A.takvim_listele = {
    t: 'List events in the user\'s primary Google Calendar between two ISO 8601 datetimes (with timezone offset). Optional text search.',
    p: { baslangic: { type: 'string', description: 'ISO start, e.g. 2026-11-19T00:00:00+03:00' }, bitis: { type: 'string', description: 'ISO end' }, ara: { type: 'string', description: 'optional free-text filter' } }, z: ['baslangic', 'bitis'],
    async f(a) {
      const u = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      u.search = new URLSearchParams(Object.assign({ timeMin: new Date(a.baslangic).toISOString(), timeMax: new Date(a.bitis).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '25', timeZone: TZ }, a.ara ? { q: a.ara } : {}));
      const r = await api(u.href);
      return { etkinlikler: (r.items || []).map(e => ({ baslik: e.summary || '(başlıksız)', baslangic: e.start.dateTime || e.start.date, bitis: e.end && (e.end.dateTime || e.end.date), tum_gun: !e.start.dateTime, konum: e.location ? kisalt(e.location, 80) : undefined, aciklama: e.description ? kisalt(htmlMetin(e.description), 120) : undefined, katilimci: e.attendees ? e.attendees.length : undefined })) };
    }
  };
  A.takvim_ekle = {
    yaz: true,
    t: 'Create an event in the user\'s primary Google Calendar. The app shows the user a confirmation card before it is created.',
    p: { baslik: { type: 'string' }, baslangic: { type: 'string', description: 'ISO datetime with offset, or YYYY-MM-DD for all-day' }, bitis: { type: 'string', description: 'ISO datetime with offset, or YYYY-MM-DD (exclusive) for all-day' }, konum: { type: 'string' }, aciklama: { type: 'string' } }, z: ['baslik', 'baslangic', 'bitis'],
    ozet: a => ({ baslik: 'Takvime etkinlik eklensin mi?', satirlar: [a.baslik, /T/.test(a.baslangic) ? tarihGoster(a.baslangic) + ' – ' + tarihGoster(a.bitis).replace(/^.*\s(\d\d:\d\d)$/, '$1') : a.baslangic + ' (tüm gün)', a.konum || ''].filter(Boolean) }),
    async f(a) {
      const gun = !/T/.test(a.baslangic);
      const e = { summary: a.baslik, location: a.konum || undefined, description: a.aciklama || undefined, start: gun ? { date: a.baslangic } : { dateTime: new Date(a.baslangic).toISOString(), timeZone: TZ }, end: gun ? { date: a.bitis } : { dateTime: new Date(a.bitis).toISOString(), timeZone: TZ } };
      const r = await api('https://www.googleapis.com/calendar/v3/calendars/primary/events', { method: 'POST', json: e });
      return { ok: true, eklendi: r.summary, baslangic: r.start.dateTime || r.start.date, baglanti: r.htmlLink };
    }
  };
  A.gmail_ara = {
    t: 'Search the user\'s Gmail with Gmail search syntax (e.g. "is:unread newer_than:2d", "from:ali", "subject:fatura"). Returns sender, subject, date, snippet and id.',
    p: { sorgu: { type: 'string' }, adet: { type: 'integer', description: 'max 10' } }, z: ['sorgu'],
    async f(a) {
      const n = Math.max(1, Math.min(10, +a.adet || 6));
      const l = await api('https://gmail.googleapis.com/gmail/v1/users/me/messages?' + new URLSearchParams({ q: a.sorgu || '', maxResults: String(n) }));
      const ms = await Promise.all((l.messages || []).map(m => api(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`).catch(() => null)));
      return { tahmini_toplam: l.resultSizeEstimate || 0, epostalar: ms.filter(Boolean).map(m => ({ id: m.id, kimden: kisalt(baslik(m, 'From'), 60), konu: kisalt(baslik(m, 'Subject'), 90), tarih: tarihGoster(+m.internalDate), okunmadi: (m.labelIds || []).includes('UNREAD') || undefined, ozet: kisalt(new DOMParser().parseFromString(m.snippet || '', 'text/html').body.textContent, 140) })) };
    }
  };
  A.gmail_oku = {
    t: 'Read one email (by id from gmail_ara). Body is shortened.',
    p: { id: { type: 'string' } }, z: ['id'],
    async f(a) {
      const m = await api(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(a.id)}?format=full`);
      return { id: m.id, kimden: baslik(m, 'From'), kime: kisalt(baslik(m, 'To'), 120), konu: baslik(m, 'Subject'), tarih: tarihGoster(+m.internalDate), metin: kisalt(govde(m.payload) || m.snippet, 2500) };
    }
  };
  A.gmail_taslak = {
    yaz: true,
    t: 'Create a Gmail DRAFT (it is NOT sent; the user reviews and sends it from Gmail). Use yanit_id to reply in the thread of an email. The app shows the user a confirmation card first.',
    p: { kime: { type: 'string', description: 'recipient email address(es), comma separated' }, konu: { type: 'string' }, metin: { type: 'string', description: 'plain-text body' }, yanit_id: { type: 'string', description: 'optional id of the email being replied to' } }, z: ['kime', 'metin'],
    ozet: a => ({ baslik: 'Gmail taslağı oluşturulsun mu?', satirlar: ['Kime: ' + a.kime, a.konu ? 'Konu: ' + a.konu : '', kisalt(a.metin, 220)].filter(Boolean), not: 'Gönderilmez; Gmail\'de taslaklara kaydedilir.' }),
    async f(a) {
      let konu = a.konu || '', thread = null, ek = '';
      if (a.yanit_id) {
        const m = await api(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(a.yanit_id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-ID`);
        thread = m.threadId; const mid = baslik(m, 'Message-ID'); if (!konu) konu = /^re:/i.test(baslik(m, 'Subject')) ? baslik(m, 'Subject') : 'Re: ' + baslik(m, 'Subject');
        if (mid) ek = `In-Reply-To: ${mid}\r\nReferences: ${mid}\r\n`;
      }
      const konuK = '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(konu))) + '?=';
      const ham = `To: ${a.kime}\r\nSubject: ${konuK}\r\n${ek}MIME-Version: 1.0\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${a.metin}`;
      const r = await api('https://gmail.googleapis.com/gmail/v1/users/me/drafts', { method: 'POST', json: { message: Object.assign({ raw: b64url(ham) }, thread ? { threadId: thread } : {}) } });
      return { ok: true, taslak_id: r.id, not: 'Taslak Gmail\'de Taslaklar klasöründe; gönderilmedi.' };
    }
  };
  A.gorev_listele = {
    t: 'List the user\'s open Google Tasks (default list).',
    p: {}, z: [],
    async f() {
      const r = await api('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?' + new URLSearchParams({ showCompleted: 'false', maxResults: '30' }));
      return { gorevler: (r.items || []).map(t => ({ baslik: t.title, tarih: t.due ? t.due.slice(0, 10) : undefined, not: t.notes ? kisalt(t.notes, 80) : undefined })) };
    }
  };
  A.gorev_ekle = {
    yaz: true,
    t: 'Add a task to the user\'s Google Tasks (default list). The app shows a confirmation card first.',
    p: { baslik: { type: 'string' }, tarih: { type: 'string', description: 'optional due date YYYY-MM-DD' }, not: { type: 'string' } }, z: ['baslik'],
    ozet: a => ({ baslik: 'Görev eklensin mi?', satirlar: [a.baslik, a.tarih ? 'Tarih: ' + a.tarih : '', a.not || ''].filter(Boolean) }),
    async f(a) {
      const r = await api('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', { method: 'POST', json: { title: a.baslik, notes: a.not || undefined, due: a.tarih ? a.tarih + 'T00:00:00.000Z' : undefined } });
      return { ok: true, eklendi: r.title };
    }
  };
  let kisiIsindi = false;
  A.kisi_ara = {
    t: 'Find a person in the user\'s Google Contacts by name; returns email addresses and phone numbers.',
    p: { ad: { type: 'string' } }, z: ['ad'],
    async f(a) {
      const u = q => 'https://people.googleapis.com/v1/people:searchContacts?' + new URLSearchParams({ query: q, readMask: 'names,emailAddresses,phoneNumbers', pageSize: '8' });
      if (!kisiIsindi) { kisiIsindi = true; try { await api(u('')); } catch (e) {} }   /* Google: aramadan önce boş bir "ısınma" isteği */
      const r = await api(u(a.ad || ''));
      return { kisiler: (r.results || []).map(x => x.person).map(p => ({ ad: p.names && p.names[0] && p.names[0].displayName, eposta: (p.emailAddresses || []).map(e => e.value), telefon: (p.phoneNumbers || []).map(t => t.value) })) };
    }
  };
  A.drive_ara = {
    t: 'Search the user\'s Google Drive files by text (name or content). Returns id, name, type, modified date.',
    p: { sorgu: { type: 'string' } }, z: ['sorgu'],
    async f(a) {
      const s = String(a.sorgu || '').replace(/\\/g, '').replace(/'/g, "\\'");
      const r = await api('https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({ q: `(name contains '${s}' or fullText contains '${s}') and trashed = false`, fields: 'files(id,name,mimeType,modifiedTime)', pageSize: '8', orderBy: 'modifiedTime desc' }));
      return { dosyalar: (r.files || []).map(f => ({ id: f.id, ad: f.name, tur: f.mimeType.replace('application/vnd.google-apps.', 'google-'), degisti: tarihGoster(f.modifiedTime) })) };
    }
  };
  A.drive_oku = {
    t: 'Read the text of a Google Drive file (Google Docs/Sheets/Slides or a text file) by id. Shortened.',
    p: { id: { type: 'string' } }, z: ['id'],
    async f(a) {
      const id = encodeURIComponent(a.id);
      const m = await api(`https://www.googleapis.com/drive/v3/files/${id}?fields=name,mimeType`);
      const ex = { 'application/vnd.google-apps.document': 'text/plain', 'application/vnd.google-apps.spreadsheet': 'text/csv', 'application/vnd.google-apps.presentation': 'text/plain' }[m.mimeType];
      let t;
      if (ex) t = await api(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(ex)}`, { metin: true });
      else if (/^text\/|json|csv|xml/.test(m.mimeType)) t = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { metin: true });
      else return { ad: m.name, tur: m.mimeType, not: 'Bu dosya türünün içeriği okunamıyor (yalnız Google Dokümanlar/E-Tablolar/Slaytlar ve metin dosyaları).' };
      return { ad: m.name, metin: kisalt(t, 3000) };
    }
  };

  function araclar() { return Object.entries(A).map(([ad, x]) => ({ type: 'function', function: { name: ad, description: x.t, parameters: { type: 'object', properties: x.p, required: x.z } } })); }
  const ACIKLAMA = { takvim_listele: 'Takvimine bakıyor…', takvim_ekle: 'Takvime ekliyor…', gmail_ara: 'E-postalarına bakıyor…', gmail_oku: 'E-postayı okuyor…', gmail_taslak: 'Taslak hazırlıyor…', gorev_listele: 'Görevlerine bakıyor…', gorev_ekle: 'Görev ekliyor…', kisi_ara: 'Kişilerinde arıyor…', drive_ara: 'Drive\'da arıyor…', drive_oku: 'Dosyayı okuyor…' };

  /* Bir aracı çalıştır. onay(ozet) → Promise<boolean>; yazan işlemler için zorunlu. onbellek: aynı tur içinde
     yazan işlem iki kez yapılmasın (sağlayıcı değişip istek yinelenirse). Sonuç her zaman modele gidecek bir JSON metni. */
  async function calistir(ad, argMetin, { onay, onbellek } = {}) {
    const x = A[ad]; if (!x) return JSON.stringify({ hata: 'bilinmeyen araç' });
    let a = {}; try { a = typeof argMetin === 'string' ? JSON.parse(argMetin || '{}') : (argMetin || {}); } catch (e) { return JSON.stringify({ hata: 'argümanlar okunamadı' }); }
    const anahtar = ad + ':' + JSON.stringify(a);
    if (x.yaz && onbellek && onbellek.has(anahtar)) return onbellek.get(anahtar);
    let sonuc;
    try {
      if (!token()) throw { code: 'google_auth' };
      if (x.yaz) { const evet = onay ? await onay(x.ozet(a), ad) : false; if (!evet) { sonuc = JSON.stringify({ ok: false, iptal: 'Kullanıcı onaylamadı; işlem yapılmadı.' }); if (onbellek) onbellek.set(anahtar, sonuc); return sonuc; } }
      sonuc = JSON.stringify(await x.f(a));
    } catch (e) {
      const c = e && e.code;
      sonuc = JSON.stringify({ hata: c === 'google_auth' ? 'Google bağlantısının süresi doldu; kullanıcı "Google\'a yeniden bağlan" düğmesine basmalı.' : c === 'google_yetki' ? 'Google bu işleme izin vermedi: ' + (e.mesaj || '') : 'Google isteği başarısız oldu.' });
    }
    if (sonuc.length > 4500) sonuc = sonuc.slice(0, 4500) + '…"}';
    if (x.yaz && onbellek) onbellek.set(anahtar, sonuc);
    return sonuc;
  }

  window.DHGoogle = {
    durum, baglan, kes, araclar, calistir, aciklama: ad => ACIKLAMA[ad] || 'Google\'a bakıyor…',
    istemciAyarla(v) { LS.set(CID_KEY, (v || '').trim() || null); bildir(); },
    istemci, dinle(f) { dinleyiciler.add(f); return () => dinleyiciler.delete(f); }, TZ
  };
})();
