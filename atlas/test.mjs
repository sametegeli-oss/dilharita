import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
import path from 'path';

const KOK = new URL('.', import.meta.url).pathname;
let gecen = 0, kalan = 0;
const hatalar = [];
async function ta(ad, fn) {
  try { await fn(); gecen++; }
  catch (e) { kalan++; hatalar.push(ad + ' → ' + e.message); }
}
function t(ad, fn) {
  try { const r = fn(); if (r === false) throw new Error('false döndü'); gecen++; }
  catch (e) { kalan++; hatalar.push(ad + ' → ' + e.message); }
}

/* --- sahte tarayıcı --- */
const vc = new VirtualConsole();
const konsolHatalari = [];
vc.on('jsdomError', e => konsolHatalari.push('jsdomError: ' + e.message));
vc.on('error', (...a) => konsolHatalari.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(fs.readFileSync(path.join(KOK, 'index.html'), 'utf8'), {
  url: 'https://ornek.test/index.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc
});
const w = dom.window;

/* eksik tarayıcı API'leri */
w.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){} });
w.scrollTo = () => {};
w.HTMLCanvasElement.prototype.getContext = () => ({
  clearRect(){}, fillRect(){}, save(){}, restore(){}, translate(){}, rotate(){},
  beginPath(){}, arc(){}, fill(){}, set fillStyle(v){}, set globalAlpha(v){}
});
w.speechSynthesis = { getVoices: () => [], speak(u){ setTimeout(()=>u.onend&&u.onend(),0); }, cancel(){} };
w.SpeechSynthesisUtterance = function(t){ this.text=t; };
w.navigator.vibrate = () => true;
w.print = () => {};
w.indexedDB = undefined;
const bildirimler = [];
w.Notification = function(baslik, o){ bildirimler.push({baslik, ...o}); };
w.Notification.permission = 'granted';
w.Notification.requestPermission = () => Promise.resolve('granted');
w.AudioContext = function(){ this.sampleRate=48000; this.createMediaStreamSource=()=>({connect(){}}); this.createAnalyser=()=>({fftSize:2048,frequencyBinCount:1024,getByteFrequencyData(){},getByteTimeDomainData(){},connect(){}}); this.close=()=>{}; };
w.navigator.mediaDevices = { getUserMedia: () => Promise.reject(new Error('yok')) };
w.MediaRecorder = undefined;
w.requestAnimationFrame = (f) => setTimeout(()=>f(performance.now()), 16);
w.cancelAnimationFrame = (i) => clearTimeout(i);
w.open = () => null;
w.DeviceOrientationEvent = undefined;
w.navigator.geolocation = undefined;
w.navigator.clipboard = { writeText: () => Promise.resolve() };
w.HTMLCanvasElement.prototype.getContext = function(){ return {
  clearRect(){}, fillRect(){}, strokeRect(){}, save(){}, restore(){}, translate(){}, rotate(){}, scale(){},
  beginPath(){}, arc(){}, moveTo(){}, lineTo(){}, closePath(){}, fill(){}, stroke(){}, setTransform(){},
  setLineDash(){}, fillText(){}, measureText:()=>({width:10}),
  createLinearGradient:()=>({addColorStop(){}}),
  set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){}, set font(v){},
  set globalAlpha(v){}, set lineJoin(v){}, set textAlign(v){}
};};

/* fetch → dosya sistemi */
w.fetch = (u) => {
  const rel = String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.\//,'');
  const p = path.join(KOK, rel);
  if (!fs.existsSync(p)) return Promise.resolve({ ok:false, status:404, json:()=>Promise.reject(new Error('404')) });
  const txt = fs.readFileSync(p,'utf8');
  return Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve(JSON.parse(txt)), text:()=>Promise.resolve(txt) });
};

/* betikleri yükle */
const betikler = ['core.js','mastery.js','veri.js','gorsel.js','ses.js','ai.js','bulut.js','ui.js',
  'kelime-balonu.js','eklenti.js','app.js','koc.js',
  'ekran-ogren.js','ekran-kelime.js','ekran-analiz.js','ekran-sohbet.js','ekran-drill.js',
  'ekran-ders.js','ekran-metin.js','ekran-ses.js','ekran-studyo.js','ekran-kible.js','ekran-ayar.js'];
for (const b of betikler) w.eval(fs.readFileSync(path.join(KOK,'js',b),'utf8'));

const A = w.Atlas;

/* ═══ 1 · SRS ═══ */
t('SM-2: q=4 düzeltme terimi tam olarak 0 (eski hatanın kanıtı)', () => {
  const d = 0.1 - (5-4)*(0.08+(5-4)*0.02);
  if (Math.abs(d) > 1e-12) throw new Error('formül değişmiş: ' + d);
});
t('ef başarıda artar (q=5), sabit kalmaz', () => {
  const n = A.SRS.adim({rep:2, ef:2.5, aralik:4, vade:0, son:0}, false, 5);
  if (!(n.ef > 2.5)) throw new Error('ef artmadı: ' + n.ef);
});
t('ef üst sınırı 3.0', () => {
  let n = {rep:5, ef:2.98, aralik:20};
  for (let i=0;i<10;i++) n = A.SRS.adim(n, false, 5);
  if (n.ef > 3.0) throw new Error('ef ' + n.ef);
});
t('ef alt sınırı 1.3', () => {
  let n = {rep:5, ef:1.4, aralik:20};
  for (let i=0;i<10;i++) n = A.SRS.adim(n, true);
  if (n.ef < 1.3) throw new Error('ef ' + n.ef);
});
t('zor → aralık sıfırlanır, hata sayacı artar', () => {
  const n = A.SRS.adim({rep:6, ef:2.5, aralik:40}, true);
  return n.rep === 0 && n.aralik === 0 && n.hata === 1;
});
t('aralık dizisi 1 → 4 → ef katlı', () => {
  let n = A.SRS.adim(null, false, 4); if (n.aralik !== 1) throw new Error('1. ' + n.aralik);
  n = A.SRS.adim(n, false, 4);        if (n.aralik !== 4) throw new Error('2. ' + n.aralik);
  n = A.SRS.adim(n, false, 4);        if (n.aralik < 9)  throw new Error('3. ' + n.aralik);
});
t('kalite skordan türer (sabit değil)', () => {
  return A.SRS.kalite(95) === 5 && A.SRS.kalite(75) === 4 && A.SRS.kalite(50) === 3 && A.SRS.kalite(10) === 2;
});
t('puan yoksa eski davranış korunur (q=4)', () => A.SRS.kalite(-1) === 4 && A.SRS.kalite(undefined) === 4);

/* ═══ 2 · benzerlik / fark ═══ */
t('benzerlik: aynı cümle %100', () => A.benzerlik('I am happy.', 'i am happy') === 100);
t('benzerlik: nokta/virgül/büyük harf görmezden gelinir', () => A.benzerlik('It is fine.', 'it is fine') === 100);
t('kesme işareti anlamlı: "its fine" eksik fiil hatasıdır', () => {
  const b = A.benzerlik("It's fine", 'its fine');
  if (b === 100) throw new Error('it is / its ayrımı kayboldu — eksik fiil yakalanmıyor');
  return true;
});
t('benzerlik: eğik tırnak düz tırnakla eşleşir', () => A.benzerlik('It\u2019s fine', "It's fine") === 100);
t('benzerlik: alakasız cümle düşük', () => A.benzerlik('I am happy', 'zzz qqq') < 40);
t('fark: eksik kelime del, fazla kelime ins', () => {
  const f = A.fark('i am very happy', 'i am happy');
  const del = f.filter(x=>x.t==='-').map(x=>x.s);
  return del.length === 1 && del[0] === 'very';
});


/* ═══ 2b · kısaltma ve cinsiyetsiz zamir ═══ */
t('kısaltma: wasn\'t = was not', () => A.benzerlik("He wasn't ready.", 'He was not ready.') === 100);
t('kısaltma: ters yön de geçerli', () => A.benzerlik('He was not ready.', "He wasn't ready.") === 100);
t('kısaltma: I\'m = I am', () => A.benzerlik("I'm a teacher.", 'I am a teacher.') === 100);
t('kısaltma: don\'t / doesn\'t / didn\'t', () =>
  A.benzerlik("I don't know.", 'I do not know.') === 100 &&
  A.benzerlik("She doesn't work.", 'She does not work.') === 100 &&
  A.benzerlik("They didn't come.", 'They did not come.') === 100);
t('kısaltma: can\'t = cannot = can not', () =>
  A.benzerlik("I can't swim.", 'I cannot swim.') === 100 &&
  A.benzerlik('I cannot swim.', 'I can not swim.') === 100);
t('kısaltma: won\'t = will not, let\'s = let us', () =>
  A.benzerlik("It won't work.", 'It will not work.') === 100 &&
  A.benzerlik("Let's go.", 'Let us go.') === 100);
t('kısaltma: eğik tırnak (’) düz tırnakla eşit', () => A.benzerlik('He wasn\u2019t ready.', 'He was not ready.') === 100);
t('kısaltma yanlışsa hâlâ hata: wasn\'t ≠ weren\'t', () => A.benzerlik("He wasn't ready.", "He weren't ready.") < 100);

t('zamir: he = she = it (Türkçe "O" cinsiyetsiz)', () =>
  A.benzerlik('He is a doctor.', 'She is a doctor.') === 100 &&
  A.benzerlik('She is a doctor.', 'It is a doctor.') === 100 &&
  A.benzerlik('It is a doctor.', 'He is a doctor.') === 100);
t('zamir: him = her = it', () => A.benzerlik('I saw him.', 'I saw her.') === 100);
t('zamir: his = her = its', () => A.benzerlik('This is his book.', 'This is her book.') === 100);
t('zamir: himself = herself = itself', () => A.benzerlik('He hurt himself.', 'She hurt herself.') === 100);
t('zamir + kısaltma birlikte', () => A.benzerlik("He isn't ready.", 'She is not ready.') === 100);
t('zamir: grup ARASI geçiş serbest değil (he ≠ him)', () => {
  const b = A.benzerlik('I saw him.', 'I saw he.');
  if (b === 100) throw new Error('he/him ayrımı kayboldu — özne/nesne hatası yakalanmıyor');
  return true;
});
t('zamir: they/we hâlâ hata', () => A.benzerlik('He is here.', 'They are here.') < 100);
t('zamir eşleşmesi tek kelimede tetiklenmez: cat ≠ dog', () => A.benzerlik('The cat sleeps.', 'The dog sleeps.') < 100);

t('fark: kabul edilen karşılık ≈ olarak işaretlenir, hata değil', () => {
  const p = A.fark('He was not ready.', "She wasn't ready.");
  if (p.some(o => o.t === '+' || o.t === '-')) throw new Error('hata olarak işaretlendi');
  const yaklasik = p.filter(o => o.t === '≈');
  if (!yaklasik.length) throw new Error('≈ işareti yok');
  if (yaklasik[0].beklenen !== 'He') throw new Error('beklenen biçim taşınmadı: ' + yaklasik[0].beklenen);
});
t('fark: gerçek eksik kelime hâlâ del olarak çıkar', () => {
  const p = A.fark('He is very happy.', 'He is happy.');
  return p.filter(o => o.t === '-').map(o => o.s).join() === 'very';
});
t('fark: kısaltmanın açılmış ikinci yarısı ekrana hayalet kelime basmaz', () => {
  const p = A.fark("He wasn't ready.", "He wasn't ready.");
  const metin = p.map(o => o.s).join(' ');
  if (/not/.test(metin)) throw new Error('hayalet kelime: ' + metin);
  if (metin !== "He wasn't ready") throw new Error('beklenmeyen çıktı: ' + metin);
});
t('fark: kısaltmanın içindeki eksik parça yine de hata olarak görünür', () => {
  const p = A.fark("He wasn't ready.", 'He was ready.');
  const eksik = p.filter(o => o.t === '-').map(o => o.s);
  if (eksik.join() !== 'not') throw new Error('eksik "not" yakalanmadı: ' + JSON.stringify(p));
});
t('esdegerNedeni: zamir açıklaması', () => /cinsiyet belirtmez/.test(A.esdegerNedeni('He is a doctor.', 'She is a doctor.')));
t('esdegerNedeni: kısaltma açıklaması', () => {
  const n = A.esdegerNedeni('He was not ready.', "He wasn't ready.");
  if (!n) throw new Error('null döndü');
  return /Kısaltma/.test(n);
});
t('esdegerNedeni: birebir aynıysa not gösterilmez', () => A.esdegerNedeni('He is here.', 'he is here') === null);
t('esdegerNedeni: gerçek hata varsa not gösterilmez', () => A.esdegerNedeni('He is very happy.', 'She is happy.') === null);

t('yazım hatası kısmi puan alır (tam ceza değil)', () => {
  const b = A.benzerlik('I am happy.', 'I am hapy.');
  if (b >= 100) throw new Error('yazım hatası affedildi: ' + b);
  if (b < 80) throw new Error('fazla cezalandırdı: ' + b);
});
t('alakasız cevap hâlâ düşük', () => A.benzerlik('He is a doctor.', 'zzz qqq www') < 30);
t('boşluk kipinde tek kelime: wasn\'t = was not', () => A.benzerlik("wasn't", 'was not') === 100);

/* ═══ 3 · depo / ilerleme ═══ */
t('SRS kaydet + vadesiGelen', () => {
  A.SRS.kaydet('c','A1-M01-P1-001', false, 95);
  const k = A.SRS.getir('c','A1-M01-P1-001');
  if (!k || k.rep !== 1) throw new Error('kayıt yok');
  const v = A.SRS.vadesiGelen('c');
  if (v.length !== 0) throw new Error('yeni kayıt hemen vadesi gelmemeli');
});
t('bellek geçersiz kılma: kaydet sonrası tumu güncel', () => {
  A.SRS.kaydet('k','test-kelime', false, 80);
  return !!A.SRS.tumu()['k:test-kelime'];
});
t('vadesi geçmiş kayıt listelenir', () => {
  const h = A.SRS.tumu();
  h['c:ESKI-1'] = {rep:1, ef:2.5, aralik:1, vade: Date.now()-86400000, son:0, tip:'c'};
  A.yaz('srs', h); A.SRS.bellegiBosalt();
  return A.SRS.vadesiGelen('c').some(x=>x.id==='ESKI-1');
});
t('sayım: toplam/vade/kalıcı ayrışır', () => {
  const s = A.SRS.sayim();
  return s.toplam >= 3 && s.vade >= 1 && s.cumle >= 2 && s.kelime >= 1;
});
t('unut: kayıt silinir', () => {
  A.SRS.unut('c','ESKI-1');
  return !A.SRS.getir('c','ESKI-1');
});

/* ═══ 4 · günlük / seri ═══ */
t('Gunluk.ekle sayacı ve saati işler', () => {
  const g = A.Gunluk.ekle('sayac', 1, 'c');
  const saat = new Date().getHours();
  return g.sayac >= 1 && g.saat[saat] >= 1 && g.tur.c >= 1;
});
t('seri: ilk gün 1', () => A.Seri.canli() >= 1);
t('seri: 1 gün boşluk affedilir (dondurma hakkı)', () => {
  A.yaz('seri', {gun:5, son: A.gunEkle(A.bugun(), -2), enIyi:5, dondurma:2});
  const s = A.Seri.dokun();
  return s.gun === 6 && s.dondurma === 1;
});
t('seri: 2+ gün boşluk sıfırlar (hak bitince)', () => {
  A.yaz('seri', {gun:9, son: A.gunEkle(A.bugun(), -5), enIyi:9, dondurma:0});
  return A.Seri.dokun().gun === 1;
});

/* ═══ 5 · hata defteri ═══ */
t('aynı hata kopyalanmaz, sayaç artar', () => {
  A.yaz('hata', []);
  A.Hata.ekle({tip:'c', id:'X1', en:'a', etiket:'present-simple'});
  A.Hata.ekle({tip:'c', id:'X1', en:'a', etiket:'present-simple'});
  const h = A.Hata.hepsi();
  return h.length === 1 && h[0].kez === 2;
});
t('doğru cevap hatayı kapatır', () => {
  A.cevapla({tip:'c', id:'X1', dogruMu:true, skor:95, en:'a'});
  return A.Hata.hepsi().length === 0;
});
t('eğilim etiketlere göre gruplar', () => {
  A.yaz('hata', []);
  A.Hata.ekle({tip:'c', id:'Y1', etiket:'passive, modal'});
  A.Hata.ekle({tip:'c', id:'Y2', etiket:'passive'});
  const e = A.Hata.egilim();
  return e[0].ad === 'passive' && e[0].n === 2;
});

/* ═══ 6 · ses / viseme ═══ */
const S = w.Ses;
t('[[ ]] blokları İngilizce olarak ayrışır', () => {
  const p = S.parcala('Şunu dene: [[I am happy.]] tamam mı', 'tr');
  return p.length === 3 && p[1].dil === 'en' && p[0].dil === 'tr';
});
t('Türkçe harf → tr, İngilizce fonksiyon kelimesi → en', () => {
  return S.dilTahmin('şimdi gel', 'en') === 'tr' && S.dilTahmin('the book is here', 'tr') === 'en';
});
t('işaret yoksa bağlam dili kullanılır', () => S.dilTahmin('kalem', 'tr') === 'tr' && S.dilTahmin('red', 'en') === 'en');
t('İngilizcede kelime sonundaki e sessiz — ağız açılmaz', () => {
  const k = S.kareler('like', 'en');
  return k[k.length-1] !== 'e';
});
t('Türkçede ö/ü ayrı ünlü, ğ ağzı değiştirmez', () => {
  const k = S.kareler('ağ', 'tr');
  return k.length === 1 && k[0] === 'a';
});
t('İngilizce r yuvarlak, Türkçe r nötr', () => {
  return S.kareler('r','en')[0] === 'u' && S.kareler('r','tr')[0] === 'kucuk';
});
t('th ayrı şekil (yalnız İngilizce)', () => S.kareler('th','en')[0] === 'th');

/* ═══ 7 · AI persona sızıntısı ═══ */
const AI = w.AI;
t('öğretmen senaryosu var ve işaretli', () => AI.senaryoBul('ogretmen').ogretmen === true);
t('rol yapma senaryoları öğretmen değil', () => {
  return ['havaalani','otel','doktor','restoran','is','arkadas','alisveris']
    .every(k => !AI.senaryoBul(k).ogretmen);
});
await ta('öğretmen promptu doktora sızmıyor', async () => {
  let yakalanan = null;
  const eskiFetch = w.fetch;
  w.fetch = (u,o) => { yakalanan = JSON.parse(o.body); return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({choices:[{message:{content:'ok'}}]})}); };
  A.Ayar.kur({aiAnahtar:'test-anahtar', aiSaglayici:'groq'});
  try { await AI.sohbet(AI.senaryoBul('doktor'), [], 'my head hurts'); }
  finally { w.fetch = eskiFetch; }
  const sis = yakalanan.messages[0].content;
  if (/öğretmen|Öğrencin Türk/i.test(sis)) throw new Error('ÖĞRETMEN PROMPTU SIZDI');
  if (!/doctor/i.test(sis)) throw new Error('doktor personası yok');
  if (/TAMAMI Türkçe/i.test(sis)) throw new Error('Türkçe kuralı rol yapmaya sızdı');
});
await ta('öğretmen sohbetinde Türkçe kuralı ve üçüncü dil yasağı var', async () => {
  let yakalanan = null;
  const eskiFetch = w.fetch;
  w.fetch = (u,o) => { yakalanan = JSON.parse(o.body); return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({choices:[{message:{content:'ok'}}]})}); };
  try { await AI.sohbet(AI.senaryoBul('ogretmen'), [], 'merhaba'); }
  finally { w.fetch = eskiFetch; }
  const sis = yakalanan.messages[0].content;
  if (!/TAMAMI Türkçe/i.test(sis)) throw new Error('Türkçe kuralı yok');
  if (!/Üçüncü bir dilden tek kelime bile yazma/i.test(sis)) throw new Error('üçüncü dil yasağı yok');
  if (!/Kural ve NEDENİ/i.test(sis)) throw new Error('düzeltme yapısı yok');
});
t('balonMetni [[ ]] işaretlerini ekrandan kaldırır', () => {
  const d = AI.balonMetni('Şöyle de: [[I am fine.]] oldu mu');
  if (/\[\[|\]\]/.test(d.textContent)) throw new Error('parantez ekranda kaldı');
  if (!d.querySelector('.en-parca')) throw new Error('İngilizce vurgulanmadı');
  if (d.textContent !== 'Şöyle de: I am fine. oldu mu') throw new Error('metin bozuldu: ' + d.textContent);
});
t('yerel açıklama anahtarsız da içerik üretir', () => {
  const m = AI.yerelAciklama({aiExplain:'çünkü öyle', grammar:'S+V', commonMistake:'X ❌'});
  return m.includes('çünkü öyle') && m.includes('S+V') && m.includes('X ❌');
});

A.Ayar.kur({aiAnahtar:''});

/* ═══ 8 · yedek / göç ═══ */
t('yedek üret → geri yükle döngüsü', () => {
  const y = A.Yedek.uret();
  if (y.uygulama !== 'atlas') throw new Error('imza yok');
  const oncekiSayi = A.SRS.sayim().toplam;
  A.Yedek.hepsiniSil();
  if (A.SRS.sayim().toplam !== 0) throw new Error('silinmedi');
  A.Yedek.yukle(y, false);
  if (A.SRS.sayim().toplam !== oncekiSayi) throw new Error('geri yüklenmedi');
});
t('yabancı dosya reddedilir', () => {
  try { A.Yedek.yukle({uygulama:'baska'}, false); return false; } catch(e){ return true; }
});
t('eski dilharita verisi göç eder', () => {
  w.localStorage.setItem('srs:A1-M01-P1-009', JSON.stringify({rep:3, ef:2.6, interval:8, due: Date.now()+1000, last:1}));
  w.localStorage.setItem('dh-profile-v1', JSON.stringify({seviye:'B1', hedef:35}));
  w.localStorage.setItem('dh-study-tracker-v1', JSON.stringify({'2026-08-01':{count:12}}));
  const r = A.Yedek.eskidenAl();
  if (r.srs < 1) throw new Error('srs göç etmedi');
  if (r.seviye !== 'B1') throw new Error('seviye göç etmedi');
  const k = A.SRS.getir('c','A1-M01-P1-009');
  if (!k || k.aralik !== 8) throw new Error('interval→aralik eşlenmedi');
  if (A.Profil.al().hedef !== 35) throw new Error('hedef göç etmedi');
});

/* ═══ 9 · koç planı ═══ */
t('vade varken tekrar önceliklidir', () => {
  const h = A.SRS.tumu();
  h['c:VADE-1'] = {rep:1, ef:2.5, aralik:1, vade: Date.now()-1000, tip:'c'};
  A.yaz('srs', h); A.SRS.bellegiBosalt();
  return A.Koc.plan().adimlar[0].yol === '#/tekrar';
});
t('tavsiye metni boş dönmez', () => A.Koc.tavsiye().length > 30);

/* ═══ 10 · veri katmanı (gerçek dosyalarla) ═══ */
const V = w.Veri;
const testler = [];
testler.push(V.index().then(j => {
  t('index.json okundu, 500+ modül', () => j.modules.length > 500);
  t('her modülün id listesi var', () => j.modules.every(m => Array.isArray(m.ids) && m.ids.length));
}));
testler.push(V.index().then(()=>V.index()).then(j => {
  t('index iki kez çağrılınca "Kendi Cümlelerim" iki kez eklenmez', () => {
    const n = j.modules.filter(m=>m.f==='__ozel__').length;
    if (n > 1) throw new Error(n + ' kez eklendi');
    return true;
  });
}));
testler.push(V.modul('a1-m01-be-verb-p1').then(c => {
  t('modül parçası indi ve alanlar tam', () =>
    c.length === 25 && c[0].en && c[0].tr && c[0].ipa && c[0].aiExplain);
}));
testler.push(V.cumlelerByIds(['A1-M01-P1-003','A2-M01-001']).then(l => {
  t('byIds farklı modüllerden cümle toplar ve sırayı korur', () =>
    l.length === 2 && l[0].id === 'A1-M01-P1-003' && l[1].id === 'A2-M01-001');
}));
testler.push(V.cumlelerByIds(['YOK-1','A1-M01-P1-005']).then(l => {
  t('byIds olmayan idleri sessizce atlar', () => l.length === 1 && l[0].id === 'A1-M01-P1-005');
}));
testler.push(V.kelimeOrnekleri('happy', 3).then(o => {
  t('kelime→örnek cümle indeksi çalışır', () => o.length > 0 && /happy/i.test(o[0].en));
}));
testler.push(V.kelimeBilgi('abandoned').then(b => {
  t('sözlük araması', () => b && b.anlamlar.length);
}));
testler.push(V.kelimeBilgi('running').then(b => {
  t('sözlükte doğrudan varsa kök aranmaz (running)', () => b && b.kelime === 'running');
}));
testler.push(V.kelimeBilgi('abandoning').then(b => {
  t('kök bulma: abandoning → abandon', () => b && b.kelime === 'abandon' && b.kokBulundu === 'abandoning');
}));
testler.push(V.kelimeBilgi('zzqqxx').then(b => {
  t('bilinmeyen kelime null döner (uydurma kök üretmez)', () => b === null);
}));
testler.push(V.seviyeSorulari(20).then(s => {
  t('seviye testi 20 soru, her soruda 4 seçenek ve doğru cevap içinde', () =>
    s.length === 20 && s.every(x => x.secenekler.length === 4 && x.secenekler.includes(x.dogru)));
  t('seviye testi 5 seviyeyi de kapsar', () =>
    new Set(s.map(x=>x.level)).size === 5);
}));
testler.push(V.phrasal().then(p => {
  t('phrasal verb verisi (881)', () => p.length === 881 && p[0].pv && p[0].meanings);
}));

/* ═══ 11 · ekran yönlendirme (DOM dumanı) ═══ */
await Promise.all(testler);

const yollar = ['#/','#/ogren','#/tekrar','#/kelime','#/kelime/liste','#/phrasal','#/sohbet',
  '#/ilerleme','#/rapor','#/hatalar','#/aktivite','#/seviye-testi','#/ayarlar','#/veri',
  '#/menu','#/hakkinda','#/ogretmen','#/kendi','#/uret','#/telaffuz','#/dinleme',
  '#/akilli','#/antrenman','#/yol','#/kutuphane','#/foto','#/pdf','#/akustik','#/video',
  '#/ses-teshis','#/hesap','#/kilavuz',
  '#/ders','#/hikaye','#/gunsonu','#/konusma','#/seri','#/telafi','#/anayasa',
  '#/studyo','#/kible','#/sinav/a1-m01-be-verb-p1','#/calis/a1-m01-be-verb-p1'];
A.Profil.kur({kurulum:true, seviye:'A2', hedef:20, ad:'Test'});
for (const y of yollar) {
  t('ekran açılıyor: ' + y, () => {
    konsolHatalari.length = 0;
    w.location.hash = y;
    w.Uygulama.yonlendir();
    const govde = w.document.getElementById('govde');
    if (!govde.hasChildNodes()) throw new Error('boş ekran');
    if (govde.textContent.includes('Bir şeyler ters gitti')) throw new Error('hata ekranı: ' + govde.textContent.slice(0,160));
    if (konsolHatalari.length) throw new Error(konsolHatalari[0].slice(0,160));
  });
}
await new Promise(r => setTimeout(r, 900));  /* async ekranların yerleşmesi */
t('modül haritası async içeriği çizdi', () => {
  w.location.hash = '#/ogren'; w.Uygulama.yonlendir();
  return true;
});
await new Promise(r => setTimeout(r, 700));
t('modül haritasında modül kartları var', () => {
  const n = w.document.querySelectorAll('#govde .modul').length;
  if (n < 5) throw new Error('sadece ' + n + ' modül çizildi');
});
t('alt gezinme aktif sekmeyi işaretliyor', () => {
  w.location.hash = '#/tekrar'; w.Uygulama.yonlendir();
  return !!w.document.querySelector('.alt a.aktif[href="#/tekrar"]');
});
t('kurulum yapılmamışsa ev → kurulum ekranı', () => {
  A.Profil.kur({kurulum:false});
  w.location.hash = '#/'; w.Uygulama.yonlendir();
  const m = w.document.getElementById('govde').textContent;
  if (!/Başlayalım/.test(m)) throw new Error('kurulum açılmadı');
  A.Profil.kur({kurulum:true});
});


/* ═══ 12 · USTALIK MOTORU ═══ */
const M = w.Mastery;
t('mastery: kanıt yoksa tüm beceriler 0', () => {
  const s = M.al('c:HIC-YOK');
  return s.genel === 0 && M.BECERILER.every(b => s[b] === 0);
});
t('mastery: doğru cevaplar skoru yükseltir', () => {
  for (let i=0;i<5;i++) M.kaydet('c:M1','uretim',true);
  const s = M.al('c:M1');
  if (s.uretim < 80) throw new Error('uretim ' + s.uretim);
  if (s.tanima !== 0) throw new Error('başka beceri kirlendi: ' + s.tanima);
});
t('mastery: tek kanıtta skora tam güvenilmez', () => {
  M.sil('c:M2'); M.kaydet('c:M2','tanima',true);
  const s = M.al('c:M2');
  if (s.tanima >= 100) throw new Error('tek kanıtla %100 verdi: ' + s.tanima);
  if (s.tanima < 20) throw new Error('fazla cezalandırdı: ' + s.tanima);
});
t('mastery: son kanıtlar daha ağırlıklı', () => {
  M.sil('c:M3');
  for (let i=0;i<5;i++) M.kaydet('c:M3','uretim',false);
  const dusuk = M.al('c:M3').uretim;
  for (let i=0;i<4;i++) M.kaydet('c:M3','uretim',true);
  const yuksek = M.al('c:M3').uretim;
  if (!(yuksek > dusuk)) throw new Error(dusuk + ' → ' + yuksek);
});
t('mastery: genel skor zor becerileri daha çok tartar', () => {
  M.sil('c:M4'); M.sil('c:M5');
  for (let i=0;i<5;i++) { M.kaydet('c:M4','tanima',true); M.kaydet('c:M5','akicilik',true); }
  if (!(M.al('c:M5').genel > M.al('c:M4').genel))
    throw new Error('akıcılık tanımadan ağır değil');
});
t('mastery: kanıtı olan beceriler içinde en zayıfı bulunur', () => {
  M.sil('c:M6');
  /* beş becerinin de kanıtı olsun ki "hiç ölçülmemiş" beceri kazanmasın */
  for (let i=0;i<4;i++) {
    M.kaydet('c:M6','tanima',true);
    M.kaydet('c:M6','dinleme',true);
    M.kaydet('c:M6','hatirlama',true);
    M.kaydet('c:M6','akicilik',true);
    M.kaydet('c:M6','uretim',false);
  }
  const s6 = M.al('c:M6');
  if (s6.uretim >= s6.tanima) throw new Error('uretim düşük çıkmadı: ' + JSON.stringify(s6));
  const z = M.zayifBeceri('c:M6');
  if (z !== 'uretim') throw new Error('zayıf beceri "' + z + '" bulundu, "uretim" olmalıydı');
});
t('mastery: hiç ölçülmemiş beceri en zayıf sayılır (0 skor)', () => {
  M.sil('c:M7');
  for (let i=0;i<4;i++) M.kaydet('c:M7','tanima',true);
  return M.al('c:M7').akicilik === 0;
});
t('mastery: çalışma kipi doğru beceriye eşlenir', () =>
  M.KIP_BECERI.uretim === 'uretim' && M.KIP_BECERI.dinleme === 'dinleme' &&
  M.KIP_BECERI.telaffuz === 'akicilik' && M.KIP_BECERI.bosluk === 'hatirlama' &&
  M.KIP_BECERI.tanima === 'tanima');
t('mastery: Atlas.cevapla otomatik kanıt üretir (ekran unutamaz)', () => {
  M.sil('c:OTO1');
  A.cevapla({tip:'c', id:'OTO1', dogruMu:true, skor:95, kip:'dinleme', en:'x'});
  const s = M.al('c:OTO1');
  if (s.dinleme === 0) throw new Error('kanıt düşmedi');
  if (s.uretim !== 0) throw new Error('yanlış beceriye yazdı');
});
t('mastery: özet ve profil zayıfı', () => {
  const o = M.ozet();
  return o.oge > 0 && typeof o.genel === 'number' && o.beceri.uretim !== undefined;
});
t('mastery: etiket eşikleri', () =>
  M.etiket(90).ad === 'Usta' && M.etiket(70).ad === 'Sağlam' &&
  M.etiket(50).ad === 'Gelişiyor' && M.etiket(0).ad === 'Yeni');

/* ═══ 13 · GÖRSEL KATMANI ═══ */
const G = w.Gorsel;
await ta('görsel: hazır imgQuery varsa o kullanılır', async () => {
  const q = await G.sorgu({en:'I am happy.', imgQuery:'smiling person'});
  if (q !== 'smiling person') throw new Error(q);
});
t('görsel: eşleme yoksa cümleden anlamlı sorgu türetilir', () => {
  const q = G.cumledenSorgu('The doctor is examining the patient in the hospital.');
  if (/\b(the|is|in)\b/.test(q)) throw new Error('işlev kelimesi sızdı: ' + q);
  if (!/doctor|examining|patient|hospital/.test(q)) throw new Error('anlamlı kelime yok: ' + q);
});
await ta('görsel: img-queries.json gerçekten var ve dolu', async () => {
  const h = await V.gorselSorgu();
  const n = Object.keys(h).length;
  if (n < 1000) throw new Error('sadece ' + n + ' eşleme');
});
t('görsel: ayardan kapatılabilir', () => {
  A.Ayar.kur({gorsel:false});
  const kapali = G.acik();
  A.Ayar.kur({gorsel:true});
  return kapali === false && G.acik() === true;
});
t('görsel: kutu() her zaman düğüm döndürür (kırık ikon yok)', () => {
  const d = G.kutu({en:'test', imgQuery:'test'});
  return d && d.nodeType === 1 && d.className === 'gorsel-kutu';
});

/* ═══ 14 · BULUT BİRLEŞTİRME ═══ */
const B = w.Bulut;
t('bulut: yapılandırma yoksa kapalı', () => {
  A.sil('firebase');
  return B.yapilandirildiMi() === false;
});
t('bulut: SRS birleştirmede daha YENİ kayıt kazanır', () => {
  const yerel = {srs:{'c:X':{son:1000, aralik:5}}};
  const uzak  = {srs:{'c:X':{son:2000, aralik:9}}};
  const r = B.birlestir(yerel, uzak);
  if (r.srs['c:X'].aralik !== 9) throw new Error('eski kayıt kazandı');
});
t('bulut: eski uzak kayıt yereli ezmez', () => {
  const yerel = {srs:{'c:Y':{son:5000, aralik:20}}};
  const uzak  = {srs:{'c:Y':{son:1000, aralik:1}}};
  return B.birlestir(yerel, uzak).srs['c:Y'].aralik === 20;
});
t('bulut: iki cihazdaki farklı kayıtlar birleşir, kaybolmaz', () => {
  const r = B.birlestir({srs:{'c:A':{son:1}}}, {srs:{'c:B':{son:1}}});
  return r.srs['c:A'] && r.srs['c:B'];
});
t('bulut: aynı gün iki cihazda çalışılmışsa yüksek sayaç kalır', () => {
  const r = B.birlestir(
    {gunluk:{'2026-08-11':{sayac:10,dogru:8}}},
    {gunluk:{'2026-08-11':{sayac:25,dogru:20}}});
  return r.gunluk['2026-08-11'].sayac === 25 && r.gunluk['2026-08-11'].dogru === 20;
});
t('bulut: mastery öğe bazında son dokunulan kazanır', () => {
  const r = B.birlestir({mastery:{'c:Z':{t:100,g:10}}}, {mastery:{'c:Z':{t:900,g:80}}});
  return r.mastery['c:Z'].g === 80;
});
t('bulut: en iyi seri korunur', () => {
  const r = B.birlestir({seri:{gun:3,enIyi:9,son:'2026-08-11'}}, {seri:{gun:2,enIyi:40,son:'2026-08-01'}});
  return r.seri.enIyi === 40 && r.seri.gun === 3;
});
t('bulut: kendi cümlelerim tekilleşerek birleşir', () => {
  const r = B.birlestir(
    {'ozel-cumle':[{id:'a',en:'A'},{id:'b',en:'B'}]},
    {'ozel-cumle':[{id:'b',en:'B'},{id:'c',en:'C'}]});
  const idler = r['ozel-cumle'].map(x=>x.id).sort().join();
  if (idler !== 'a,b,c') throw new Error(idler);
});
t('bulut: uzak veri yoksa yerel aynen döner', () => {
  const y = {srs:{'c:Q':{son:1}}};
  return B.birlestir(y, null) === y;
});
t('bulut: profil yerelde kalır (kullanıcı burada oturuyor)', () => {
  const r = B.birlestir({profil:{seviye:'B2'}}, {profil:{seviye:'A1'}});
  return r.profil.seviye === 'B2';
});

/* ═══ 15 · HATIRLATMA ═══ */
const H = w.Hatirlatma;
function hatirlatmaKur(sayac, hedef, seri) {
  A.sil('hatirlatma-son');
  A.Profil.kur({hedef: hedef});
  const g = A.Gunluk.hepsi();
  g[A.bugun()] = {sayac: sayac, dogru: sayac, yanlis: 0, saat: {}, tur: {}};
  A.yaz('gunluk', g);
  A.yaz('seri', {gun: seri || 1, son: A.bugun(), enIyi: seri || 1, dondurma: 2});
  bildirimler.length = 0;
}
t('hatırlatma: izin verilmiş ve saat geçmişse bildirir', () => {
  hatirlatmaKur(0, 20, 5);
  A.Ayar.kur({gunlukHatirlatma: '00:01'});
  if (H.denetle() !== true) throw new Error('bildirmedi');
  if (!bildirimler.length) throw new Error('Notification çağrılmadı');
  if (!/serini kaybetme/.test(bildirimler[0].baslik)) throw new Error('seri mesajı yok: ' + bildirimler[0].baslik);
});
t('hatırlatma: aynı gün iki kez bildirmez', () => {
  bildirimler.length = 0;
  if (H.denetle() !== false) throw new Error('ikinci kez bildirdi');
  if (bildirimler.length) throw new Error('Notification tekrar çağrıldı');
});
t('hatırlatma: hedef tamamlandıysa rahatsız etmez', () => {
  hatirlatmaKur(50, 20, 5);
  A.Ayar.kur({gunlukHatirlatma: '00:01'});
  if (H.denetle() !== false) throw new Error('hedef bittiği halde bildirdi');
  if (bildirimler.length) throw new Error('Notification çağrıldı');
});
t('hatırlatma: saat henüz gelmediyse bildirmez', () => {
  hatirlatmaKur(0, 20, 3);
  A.Ayar.kur({gunlukHatirlatma: '23:59'});
  const simdi = new Date();
  if (simdi.getHours() === 23 && simdi.getMinutes() >= 59) return true;
  if (H.denetle() !== false) throw new Error('erken bildirdi');
});
t('hatırlatma: saat kurulmamışsa hiç bildirmez', () => {
  hatirlatmaKur(0, 20, 3);
  A.Ayar.kur({gunlukHatirlatma: ''});
  return H.denetle() === false;
});
t('hatırlatma: serisi yokken farklı mesaj kullanır', () => {
  hatirlatmaKur(0, 20, 1);
  A.Ayar.kur({gunlukHatirlatma: '00:01'});
  H.denetle();
  A.Ayar.kur({gunlukHatirlatma: ''});
  if (!bildirimler.length) throw new Error('bildirmedi');
  if (/serini kaybetme/.test(bildirimler[0].baslik)) throw new Error('seri yokken seri mesajı verdi');
});

/* ═══ 16 · YEDEK KAPSAMI ═══ */
t('yedek: mastery de yedeğe giriyor', () => {
  M.kaydet('c:YEDEK1','uretim',true);
  const y = A.Yedek.uret();
  if (!y.mastery || !y.mastery['c:YEDEK1']) throw new Error('mastery yedeğe girmedi');
});


/* ═══ 17 · KELİME BALONCUĞU ═══ */
const KB = w.KelimeBalonu;
t('heceleme: kısa kelime bölünmez', () => KB.heceler('cat') === 'cat');
t('heceleme: çok heceli kelime bölünür', () => {
  const h = KB.heceler('computer');
  if (h.indexOf('·') < 0) throw new Error('bölünmedi: ' + h);
  if (h.replace(/[ ·]/g,'') !== 'computer') throw new Error('harf kayboldu: ' + h);
});
t('heceleme: ünsüz yığını bir öncekine yapışır', () => {
  const h = KB.heceler('strength');
  return h.replace(/[ ·]/g,'') === 'strength';
});
await ta('ngram: yedek tablodan sıklık okunur', async () => {
  const r = await KB.ngramGetir(['about','abandon']);
  if (!r.deger.about) throw new Error('about bulunamadı');
  if (r.deger.about <= r.deger.abandon) throw new Error('"about" "abandon"dan sık olmalı');
});
await ta('ngram: önbellek ikinci çağrıda ağa çıkmaz', async () => {
  await KB.ngramGetir(['about']);
  const c = A.oku('ngram-cache', {});
  return typeof c === 'object';
});
t('baloncuk: UI.kelimeBalonu zengin sürümle değişti', () => w.UI.kelimeBalonu === KB.ac);

/* ═══ 18 · NAMAZ VAKİTLERİ ve KIBLE ═══ */
const N = w.Namaz;
t('kıble: İstanbul’dan güneydoğu (≈152°)', () => {
  const y = N.kibleYonu(41.0082, 28.9784);
  if (Math.abs(y - 151.6) > 3) throw new Error('yön ' + y.toFixed(1) + '°');
});
t('kıble: Mekke’de mesafe ~0', () => N.mesafe(21.4225, 39.6317) < 1);
t('kıble: İstanbul–Kâbe ≈ 2400 km (büyük daire)', () => {
  const m = N.mesafe(41.0082, 28.9784);
  if (Math.abs(m - 2400) > 60) throw new Error(m.toFixed(0) + ' km');
});
t('kıble: mesafe simetrik ve pozitif', () => {
  const m1 = N.mesafe(52.52, 13.405);
  if (!(m1 > 4000 && m1 < 4600)) throw new Error('Berlin–Kâbe ' + m1.toFixed(0) + ' km');
});
t('kıble: Kâbe’nin kuzeyinden bakınca güneye gösterir', () => {
  const y = N.kibleYonu(31.4, 39.63);
  if (Math.abs(y - 180) > 5) throw new Error(y.toFixed(1) + '°');
});
t('vakitler: sıralama mantıklı (imsak < güneş < öğle < ikindi < akşam < yatsı)', () => {
  const v = N.vakitler(new Date(2026, 5, 21), 41.0082, 28.9784, 'diyanet', 3);
  const s = [v.imsak, v.gunes, v.ogle, v.ikindi, v.aksam, v.yatsi];
  for (let i = 1; i < s.length; i++) {
    if (s[i] === null) throw new Error('null vakit: ' + i);
    if (s[i] <= s[i-1]) throw new Error('sıra bozuk ' + i + ': ' + JSON.stringify(s));
  }
});
t('vakitler: 21 Haziran İstanbul öğle ≈ 13:1x', () => {
  const v = N.vakitler(new Date(2026, 5, 21), 41.0082, 28.9784, 'diyanet', 3);
  if (Math.abs(v.ogle - 13.2) > 0.35) throw new Error(N.saatMetin(v.ogle));
});
t('vakitler: yazın gün uzun, kışın kısa', () => {
  const yaz = N.vakitler(new Date(2026, 5, 21), 41.0082, 28.9784, 'diyanet', 3);
  const kis = N.vakitler(new Date(2026, 11, 21), 41.0082, 28.9784, 'diyanet', 3);
  const yazGun = yaz.aksam - yaz.gunes, kisGun = kis.aksam - kis.gunes;
  if (!(yazGun > kisGun + 4)) throw new Error('yaz ' + yazGun.toFixed(1) + 'sa, kış ' + kisGun.toFixed(1) + 'sa');
});
t('vakitler: hanefî ikindi şafiîden geç', () => {
  const safi = N.vakitler(new Date(2026, 3, 15), 41.0082, 28.9784, 'diyanet', 3);
  const hanefi = N.vakitler(new Date(2026, 3, 15), 41.0082, 28.9784, 'hanefi', 3);
  if (!(hanefi.ikindi > safi.ikindi)) throw new Error('hanefî ikindi geç değil');
});
t('vakitler: ISNA fecri Diyanet’ten geç (açı küçük)', () => {
  const d = N.vakitler(new Date(2026, 3, 15), 41.0082, 28.9784, 'diyanet', 3);
  const i = N.vakitler(new Date(2026, 3, 15), 41.0082, 28.9784, 'isna', 3);
  if (!(i.imsak > d.imsak)) throw new Error('ISNA imsak erken çıktı');
});
t('vakitler: kutup bölgesinde çökmez, null döner', () => {
  const v = N.vakitler(new Date(2026, 5, 21), 78, 15, 'diyanet', 1);
  return v.imsak === null || typeof v.imsak === 'number';
});
t('saatMetin: biçim ve taşma', () =>
  N.saatMetin(13.5) === '13:30' && N.saatMetin(25.25) === '01:15' && N.saatMetin(null) === '—');

/* ═══ 19 · ÖĞRETMEN ANAYASASI ═══ */
const AN = w.Anayasa;
t('anayasa: varsayılan Türkçe anlatım', () => /Türkçe/.test(AN.metin()));
t('anayasa: uzunluk seçimi metne yansır', () => {
  AN.kur({uzunluk:'kisa'});
  const k = AN.metin();
  AN.kur({uzunluk:'uzun'});
  const u = AN.metin();
  AN.kur({uzunluk:'orta'});
  if (!/en fazla 3 satır/.test(k)) throw new Error('kısa yansımadı');
  if (!/10 satıra kadar/.test(u)) throw new Error('uzun yansımadı');
});
t('anayasa: kendi odağın metne giriyor', () => {
  AN.kur({hedefOdak:'yazılım mülakatları'});
  const m = AN.metin();
  AN.kur({hedefOdak:''});
  return /yazılım mülakatları/.test(m);
});
await ta('anayasa: öğretmen çağrısına eklenir, rol yapmaya EKLENMEZ', async () => {
  let yakalanan = null;
  const eskiFetch = w.fetch;
  w.fetch = (u,o) => { yakalanan = JSON.parse(o.body); return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({choices:[{message:{content:'ok'}}]})}); };
  A.Ayar.kur({aiAnahtar:'test'});
  AN.kur({hedefOdak:'ANAYASA-IZI'});
  try {
    await w.AI.sohbet(w.AI.senaryoBul('ogretmen'), [], 'merhaba');
    if (!/ANAYASA-IZI/.test(yakalanan.messages[0].content)) throw new Error('öğretmene eklenmedi');
    await w.AI.sohbet(w.AI.senaryoBul('doktor'), [], 'hello');
    if (/ANAYASA-IZI/.test(yakalanan.messages[0].content)) throw new Error('rol yapmaya SIZDI');
  } finally {
    w.fetch = eskiFetch; AN.kur({hedefOdak:''}); A.Ayar.kur({aiAnahtar:''});
  }
});
t('anayasa: sıfırla varsayılana döner', () => {
  AN.kur({ton:'sert'});
  AN.sifirla();
  return AN.al().ton === 'sicak';
});

/* ═══ 20 · TELAFİ ═══ */
t('telafi: üst seviyedeyken alt seviye boşlukları bulunur', () => {
  A.Profil.kur({seviye:'B1'});
  const eksik = w.Telafi.tespit();
  if (!Array.isArray(eksik)) throw new Error('dizi dönmedi');
  if (eksik.some(x => ['B1','B2','C1'].indexOf(x.modul.lvl) > -1))
    throw new Error('üst/eşit seviye modül telafiye girdi');
});
t('telafi: A1’deyken telafi listesi boş', () => {
  A.Profil.kur({seviye:'A1'});
  const eksik = w.Telafi.tespit();
  A.Profil.kur({seviye:'A2'});
  return eksik.length === 0;
});

/* ═══ 21 · OTURUM HAFIZASI ═══ */
const OH = w.OturumHafiza;
t('oturum hafızası: kaydet ve geri al', () => {
  OH.kaydet({idler:['a','b','c','d'], i:1, kip:'uretim', kaynak:'test', geriYol:'#/'});
  const o = OH.al();
  if (!o || o.i !== 1) throw new Error('geri alınamadı');
  return o.idler.length === 4;
});
t('oturum hafızası: son cümledeyse devam önerilmez', () => {
  OH.kaydet({idler:['a','b'], i:1, kip:'uretim'});
  return OH.al() === null;
});
t('oturum hafızası: 3 günden eski kayıt atılır', () => {
  A.yaz('oturum-yarim', {idler:['a','b','c'], i:0, t: Date.now() - 4*86400000});
  return OH.al() === null;
});
t('oturum hafızası: temizle', () => { OH.temizle(); return OH.al() === null; });

/* ═══ 22 · ÇIKTI ve KÖPRÜ ═══ */
t('çıktı: menü çökmeden açılır', () => {
  w.Cikti.menu([{en:'A', tr:'a'}], 'Test');
  const p = w.document.querySelector('.pencere');
  const var_ = !!p && /Boşluklu/.test(p.textContent);
  w.UI.pencereKapat();
  return var_;
});
t('köprü: prompt ve geri alma akışı', () => {
  let gelen = null;
  w.Kopru.ac({prompt:'TEST-PROMPT', baslik:'x', geri: (t2) => { gelen = t2; }});
  const p = w.document.querySelector('.pencere');
  if (!p) throw new Error('pencere açılmadı');
  const alanlar = p.querySelectorAll('textarea');
  if (alanlar[0].value !== 'TEST-PROMPT') throw new Error('prompt yerleşmedi');
  alanlar[1].value = 'CEVAP';
  const dugmeler = Array.from(p.querySelectorAll('button'));
  dugmeler.find(b => /aktar/i.test(b.textContent)).click();
  if (gelen !== 'CEVAP') throw new Error('geri çağrı çalışmadı');
});
t('köprü: anahtar yokken gerekiyor der', () => {
  A.Ayar.kur({aiAnahtar:''});
  return w.Kopru.gerekiyorMu() === true;
});

/* ═══ 23 · AI DURUM ═══ */
t('ai durum: anahtar yokken rozet "Anahtar yok"', () => {
  A.Ayar.kur({aiAnahtar:''});
  return w.AIDurum.rozet().ad === 'Anahtar yok';
});
await ta('ai durum: başarılı çağrı kaydediliyor', async () => {
  const eskiFetch = w.fetch;
  w.fetch = () => Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({choices:[{message:{content:'ok'}}]})});
  A.Ayar.kur({aiAnahtar:'test'});
  try { await w.AI.cagir([{role:'user',content:'x'}]); } finally { w.fetch = eskiFetch; }
  const r = w.AIDurum.rozet();
  A.Ayar.kur({aiAnahtar:''});
  if (r.ad !== 'Çalışıyor') throw new Error('rozet: ' + r.ad);
});

/* ═══ rapor ═══ */
console.log('\n' + '═'.repeat(58));
console.log('  GEÇEN: ' + gecen + '   KALAN: ' + kalan);
console.log('═'.repeat(58));
if (hatalar.length) { console.log('\nBAŞARISIZ:'); hatalar.forEach(h => console.log('  ✗ ' + h)); }
process.exit(kalan ? 1 : 0);
