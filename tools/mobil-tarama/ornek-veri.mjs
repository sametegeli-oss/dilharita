// Örnek veri: hata defteri kayıtları, 7 günlük çalışma takibi, SRS ilerlemesi. storageState dosyasına yazar.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const sent = JSON.parse(fs.readFileSync('/home/claude/dilharita/data/sentences.json')).slice(0, 40);
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, locale: 'tr-TR', serviceWorkers: 'block' });
await c.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:8767/') ? r.continue() : r.abort());
await c.addInitScript(() => { try { if (!localStorage.getItem('dh-profile-v1')) localStorage.setItem('dh-profile-v1', JSON.stringify({ aiYontemi: 'gemini', aiYontemiTarih: Date.now() })); } catch (e) {} });
const p = await c.newPage(); p.on('console', m => { if (m.text().startsWith('TOHUM')) console.error(m.text()); });
await p.goto('http://127.0.0.1:8767/hata-defteri.html'); await p.waitForFunction(() => window.LearningErrorDB, null, { timeout: 40000 }); await p.waitForTimeout(1000);
await p.waitForTimeout(4000); await p.waitForLoadState('load'); await p.waitForFunction(() => window.LearningErrorDB, null, { timeout: 40000 });
console.error('adres', p.url(), Date.now());
const sonuc = await p.evaluate(async (sent) => {
  const out = {};
  const hatalar = [
    { target: 'My friend is here.', answer: 'Is my friend.', sentenceTR: 'Arkadaşım burada.', module: 'A1-M01 Be Verb · P1', level: 'A1', source: 'practice', sentenceId: sent[5].id },
    { target: 'She goes to work every day.', answer: 'She go to work every day.', sentenceTR: 'O her gün işe gider.', module: 'A1-M03 Present Simple', level: 'A1', source: 'practice' },
    { target: 'I have been waiting for an hour.', answer: 'I am waiting since one hour.', sentenceTR: 'Bir saattir bekliyorum.', module: 'B1-M02 Present Perfect Continuous', level: 'B1', source: 'chat' },
    { target: 'Could you help me, please?', answer: 'You can help me?', sentenceTR: 'Bana yardım eder misiniz lütfen?', module: 'A2-M05 Requests', level: 'A2', source: 'youtube' },
  ];
  out.hata = [];
  for (const h of hatalar) { console.error('TOHUM hata ' + h.target); out.hata.push(!!(await window.LearningErrorDB.add(h))); }
  console.error('TOHUM hatalar tamam');
  // Çalışma takibi: son 7 gün
  const days = {}; const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now - i * 86400000); const k = d.toISOString().slice(0, 10);
    if (i === 3) continue;
    days[k] = { date: k, lessons: 1, minutes: 12 + i * 3, sentences: 15 + i, videos: i % 2, reviews: 4 + i, errors: i % 3, events: [] };
  }
  localStorage.setItem('dh-study-tracker-v1', JSON.stringify({ days, goals: {}, done: {} }));
  // SRS: 30 cümle öğrenilmiş (rep>0), 8'inin vakti gelmiş
  await new Promise((res, rej) => {
    const r = indexedDB.open('sentence-mode');
    r.onblocked = () => console.log('TOHUM idb blocked');
    r.onupgradeneeded = () => { console.log('TOHUM idb upgrade v' + r.result.version); if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
    r.onsuccess = () => {
      const db = r.result; console.log('TOHUM idb v' + db.version + ' ' + [...db.objectStoreNames]);
      if (!db.objectStoreNames.contains('kv')) {
        const v = db.version; db.close();
        const r2 = indexedDB.open('sentence-mode', v + 1);
        r2.onupgradeneeded = () => r2.result.createObjectStore('kv');
        r2.onsuccess = () => { const db2 = r2.result; const tx = db2.transaction('kv', 'readwrite'); const st = tx.objectStore('kv');
          sent.slice(0, 30).forEach((s, i) => st.put({ rep: 1 + (i % 4), ease: 2.5, interval: 1 + i, due: Date.now() + (i < 8 ? -3600e3 : 86400e3 * (1 + i)), lapses: i === 2 ? 3 : 0, last: Date.now() - 86400e3 }, 'srs:' + s.id));
          tx.oncomplete = () => { db2.close(); res(); }; };
        r2.onerror = () => rej(r2.error); return;
      }
      const tx = db.transaction('kv', 'readwrite'); const st = tx.objectStore('kv');
      sent.slice(0, 30).forEach((s, i) => st.put({ rep: 1 + (i % 4), ease: 2.5, interval: 1 + i, due: Date.now() + (i < 8 ? -3600e3 : 86400e3 * (1 + i)), lapses: i === 2 ? 3 : 0, last: Date.now() - 86400e3 }, 'srs:' + s.id));
      tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error);
    };
    r.onerror = () => rej(r.error);
  });
  console.error('TOHUM srs tamam');
  out.srs = await new Promise(res => { const r = indexedDB.open('sentence-mode'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').count(); q.onsuccess = () => { r.result.close(); res(q.result); }; }; });
  out.toplamHata = (await window.LearningErrorDB.all()).length;
  return out;
}, sent);
console.error(JSON.stringify(sonuc));
await c.storageState({ path: '/home/claude/tools/ornek-durum.json', indexedDB: true });
await b.close();
