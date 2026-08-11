import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
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

/* fetch → dosya sistemi */
w.fetch = (u) => {
  const rel = String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.\//,'');
  const p = path.join(KOK, rel);
  if (!fs.existsSync(p)) return Promise.resolve({ ok:false, status:404, json:()=>Promise.reject(new Error('404')) });
  const txt = fs.readFileSync(p,'utf8');
  return Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve(JSON.parse(txt)), text:()=>Promise.resolve(txt) });
};

/* betikleri yükle */
const betikler = ['core.js','veri.js','ses.js','ai.js','ui.js','app.js',
  'ekran-ogren.js','ekran-kelime.js','ekran-analiz.js','ekran-sohbet.js','ekran-ayar.js'];
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
t('benzerlik: kesme işareti anlamlı sayılır (its ≠ it\'s)', () => {
  const b = A.benzerlik("It's fine", 'its fine');
  if (b === 100) throw new Error('kesme işareti yutuldu — its/it\'s ayrımı kayboluyor');
  if (b < 85) throw new Error('fazla cezalandırdı: ' + b);
});
t('benzerlik: eğik tırnak düz tırnakla eşleşir', () => A.benzerlik('It\u2019s fine', "It's fine") === 100);
t('benzerlik: alakasız cümle düşük', () => A.benzerlik('I am happy', 'zzz qqq') < 40);
t('fark: eksik kelime del, fazla kelime ins', () => {
  const f = A.fark('i am very happy', 'i am happy');
  const del = f.filter(x=>x.t==='-').map(x=>x.s);
  return del.length === 1 && del[0] === 'very';
});

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
  '#/menu','#/hakkinda','#/ogretmen','#/kendi','#/uret','#/telaffuz','#/dinleme'];
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

/* ─── 12 · V2 güvenlik ve dayanıklılık ─── */
const aiKaynak = fs.readFileSync(path.join(KOK, 'js/ai.js'), 'utf8');
const coreKaynak = fs.readFileSync(path.join(KOK, 'js/core.js'), 'utf8');
const sohbetKaynak = fs.readFileSync(path.join(KOK, 'js/ekran-sohbet.js'), 'utf8');
const sonucKaynak = fs.readFileSync(path.join(KOK, 'js/result-effects.js'), 'utf8');
t('AI çağrısı 25 saniye zaman aşımı ve iptal sinyali kullanıyor', () => /AbortController/.test(aiKaynak) && /25000/.test(aiKaynak) && /secenek\.sinyal/.test(aiKaynak));
t('API anahtarı yedekten çıkarılıyor', () => /delete v\.aiAnahtar/.test(coreKaynak));
t('eski çalışma günleri days deposundan taşınıyor', () => /tr = tr\.days \|\| tr/.test(coreKaynak));
t('göç öncesi durum geri alınabiliyor', () => /gocuGeriAl/.test(coreKaynak));
t('sohbet geçmişi varsayılan kapalı ve kullanıcı tercihine bağlı', () => /sohbetSakla: false/.test(coreKaynak) && /sohbetSakla \?/.test(sohbetKaynak));
t('doğru ve yanlış cevap animasyonları tek cevap girişine bağlı', () => /atlas-result/.test(coreKaynak) && /yildizYagmuru/.test(sonucKaynak) && /function hata/.test(sonucKaynak));

/* ═══ rapor ═══ */
console.log('\n' + '═'.repeat(58));
console.log('  GEÇEN: ' + gecen + '   KALAN: ' + kalan);
console.log('═'.repeat(58));
if (hatalar.length) { console.log('\nBAŞARISIZ:'); hatalar.forEach(h => console.log('  ✗ ' + h)); }
process.exit(kalan ? 1 : 0);
