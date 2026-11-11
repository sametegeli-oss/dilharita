// Mobil düğme tarayıcısı (Dil Harita)
// Kullanım: node mobiltara.mjs [--isci=6] [--mod=bos|veri|ilk] [--cikti=klasor] [sayfa ...]
//  - Her düğme için taze bağlam: sayfayı aç, (gerekirse kapalı grubu aç), düğmeye bas, 1,2 sn bekle, kaydet.
//  - Tıklama yeni pencere/bölüm açtıysa, orada yeni çıkan her düğme 2. seviye iş olarak kuyruğa girer.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

const arg = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const SECILEN = process.argv.slice(2).filter(a => !a.startsWith('--'));
const ISCI = +(arg.isci || 6);
const MOD = arg.mod || 'bos';
const OUT = arg.cikti || `/home/claude/tools/out-${MOD}`;
const BASE = 'http://127.0.0.1:8767/';
fs.mkdirSync(path.join(OUT, 'ekran'), { recursive: true });

const SAYFALAR = ['akilli-tekrar','aktivite','basla','bugun','chat','chatairport','chatdoctor','chathotel','chatrestaurant','chatteacher','chatteacher1','chatteacher2','ders','foto-ekle','gemini-rapor-arsivi','gunluk-takip','harita','hata-defteri','ilerleme','immersive','index-app','index','kelime-ogren','kilavuz','kıblenamaz','library','login','menu','modul-testi','modullerim','ocr-sentence','ogren','ogrenme-yolu','phrasal-verbs','practice','profil','pv-practice','pwa-hard-reset','rapor','ses-secim','ses-teshis','sesdalga','seviye-testi','teacher-chat','teacher','teacher1','tekrar','veri-gizlilik','videopractice','youtube-egitim','youtube-pratik','ozel-ders','sesli-calis'];
const ALT_CUBUK_SAYFASI = 'menu'; // .kk-alt düğmeleri yalnız burada test edilir
const SECICI = 'button, a[href], [role=button], summary, [onclick], input[type=checkbox], input[type=radio]';

// Sayfa açılmadan önce çalışır: profil (ilk açılış penceresini atlamak için) ve örnek veri.
function baslangicBetigi(mod) {
  return `(() => {
    try {
      if (${JSON.stringify(mod)} !== 'ilk' && !localStorage.getItem('dh-profile-v1')) {
        localStorage.setItem('dh-profile-v1', JSON.stringify({ aiYontemi: 'gemini', aiYontemiTarih: Date.now() }));
      }
    } catch (e) {}
    window.__dhTara = { mut: 0 };
    try {
      new MutationObserver(l => { window.__dhTara.mut += l.length; }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    } catch (e) {}
  })();`;
}

async function yeniBaglam(browser) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, locale: 'tr-TR', acceptDownloads: false, permissions: [], serviceWorkers: 'block', ...(MOD === 'veri' ? { storageState: '/home/claude/tools/ornek-durum.json' } : {}) });
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  await ctx.addInitScript(baslangicBetigi(MOD));
  return ctx;
}

// Sayfadaki tüm tıklanabilirler (indeks = SECICI sırasındaki yer)
async function listele(page) {
  return page.$$eval(SECICI, els => els.map((el, i) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    const gizliGiris = el.tagName === 'INPUT' && (el.classList.contains('gizliGiris') || r.width < 4 || st.opacity === '0');
    let kapali = false, gizliAta = false;
    for (let a = el.parentElement; a; a = a.parentElement) {
      if (a.tagName === 'DETAILS' && !a.open && el.closest('summary')?.parentElement !== a) kapali = true;
      const s = getComputedStyle(a);
      if (s.display === 'none' || s.visibility === 'hidden') gizliAta = true;
    }
    const gorunur = !gizliAta && st.display !== 'none' && st.visibility !== 'hidden' && (r.width > 0 && r.height > 0 || kapali);
    const lbl = el.tagName === 'INPUT' ? (el.closest('label')?.innerText || el.getAttribute('aria-label') || '') : '';
    const metin = (el.innerText || el.textContent || lbl || el.value || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 70);
    // Gizli onay kutusunun gerçek dokunma alanı: sarmalayan label
    const hedefKutu = gizliGiris && el.closest('label') ? el.closest('label').getBoundingClientRect() : r;
    return {
      i, gorunur: gorunur || (gizliGiris && !!el.closest('label')), kapali, gizliGiris, metin,
      etiket: el.tagName.toLowerCase(), id: el.id || '', sinif: (typeof el.className === 'string' ? el.className : '').slice(0, 60),
      href: el.getAttribute('href') || '', altCubuk: !!el.closest('.kk-alt'),
      w: Math.round(hedefKutu.width), h: Math.round(hedefKutu.height), fs: parseFloat(st.fontSize) || 0,
      parmak: [el.tagName, el.id, (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40), el.getAttribute('href') || ''].join('|'),
      atla: el.classList.contains('skip-link') || /^ana içeriğe geç$/i.test((el.textContent||'').trim()),
    };
  }));
}

// Açık durumda görünen sabit/üst pencereler
async function pencereler(page) {
  return page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => {
    const s = getComputedStyle(e);
    if (s.position !== 'fixed' && !(e.tagName === 'DIALOG' && e.open)) return false;
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width >= 150 && r.height >= 120;
  }).map(e => {
    const r = e.getBoundingClientRect();
    const kapat = [...e.querySelectorAll('button, a, [role=button]')].some(b => /✕|×|✖|kapat|tamam|vazgeç|iptal|geri|anladım|close/i.test((b.innerText || b.getAttribute('aria-label') || '').trim()));
    return { kim: (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]).slice(0, 50), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), sigmiyor: r.left < -2 || r.top < -2 || r.right > innerWidth + 2 || r.bottom > innerHeight + 2, kapat };
  }));
}

async function olcum(page) {
  return page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    let kucuk = [];
    for (const e of document.querySelectorAll('body *')) {
      if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = e.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > vh) continue;
      if (parseFloat(s.fontSize) < 12 && parseFloat(s.fontSize) > 0) kucuk.push(e.innerText.trim().slice(0, 30) + ` (${s.fontSize})`);
    }
    return { tasma: document.documentElement.scrollWidth - vw, kucukYazi: kucuk.slice(0, 6), metin: (document.body?.innerText || '').length, mut: window.__dhTara?.mut || 0, baslik: document.title };
  });
}

async function sayfayiAc(page, sayfa) {
  await page.goto(BASE + encodeURI(sayfa) + '.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1300);
}

// Kapalı <details> içindeyse önce grubun başlığına dokun (kullanıcı gibi)
async function grubuAc(page, loc) {
  for (let g = 0; g < 4; g++) {
    const idx = await loc.evaluate(e => {
      let d = e.parentElement?.closest('details:not([open])');
      if (e.tagName === 'SUMMARY') d = e.parentElement?.parentElement?.closest('details:not([open])');
      if (!d) return -1;
      const s = d.querySelector(':scope > summary');
      return s ? [...document.querySelectorAll('summary')].indexOf(s) : -1;
    }).catch(() => -1);
    if (idx < 0) return;
    await page.locator('summary').nth(idx).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(350);
  }
}

async function bas(page, loc, kayit) {
  await grubuAc(page, loc);
  await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  try { await loc.click({ timeout: 4000 }); }
  catch (e) {
    const neden = (e.message.match(/(element is not visible|intercepts pointer events|element is not enabled|element is outside of the viewport|not stable)/) || [])[1] || e.message.split('\n')[0].slice(0, 80);
    let ortu = '';
    if (/intercepts/.test(e.message)) ortu = (e.message.match(/<[^>]{0,120}>[^\n]{0,40}intercepts/) || [''])[0].slice(0, 140);
    kayit.tiklanamadi = neden + (ortu ? ' ← ' + ortu : '');
    await loc.click({ timeout: 2000, force: true }).catch(() => {});
  }
}

async function is(browser, job) {
  const ctx = await yeniBaglam(browser);
  const page = await ctx.newPage();
  const kayit = { sayfa: job.sayfa, yol: job.yol.map(y => y.metin), seviye: job.yol.length, hatalar: [], diyaloglar: [], indirmeler: [], yeniSekme: '' };
  page.on('pageerror', e => kayit.hatalar.push('JS: ' + e.message.slice(0, 180) + ' @' + decodeURI(page.url().replace(BASE,'')) + ' ' + (e.stack||'').split('\n').slice(1,3).map(x=>x.trim().replace(BASE,'')).join(' ; ').slice(0,220)));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) kayit.hatalar.push('konsol: ' + m.text().slice(0, 160)); });
  page.on('dialog', async d => { kayit.diyaloglar.push(`${d.type()}: ${d.message().slice(0, 200)}`); await d.dismiss().catch(() => {}); });
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) kayit.hatalar.push(`HTTP ${r.status()} ${decodeURI(r.url().replace(BASE, ''))}`); });
  page.on('download', d => { kayit.indirmeler.push(d.suggestedFilename()); d.cancel().catch(() => {}); });
  ctx.on('page', p => { if (p !== page) { kayit.yeniSekme = p.url(); p.close().catch(() => {}); } });
  try {
    await sayfayiAc(page, job.sayfa);
    // Yoldaki önceki adımlar (2. seviye için 1. düğme)
    for (let k = 0; k < job.yol.length - 1; k++) {
      const adim = job.yol[k];
      const liste = await listele(page);
      const el = liste.find(x => x.parmak === adim.parmak && x.gorunur) || (liste[adim.i]?.gorunur ? liste[adim.i] : null);
      if (!el) { kayit.atlandi = 'önceki adım bulunamadı'; return kayit; }
      await bas(page, page.locator(SECICI).nth(el.i), {});
      await page.waitForTimeout(1200);
    }
    kayit.oncekiDiyaloglar = kayit.diyaloglar.splice(0);
    const son = job.yol[job.yol.length - 1];
    const onceListe = await listele(page);
    const yedek = onceListe[son.i];
    const el = onceListe.find(x => x.parmak === son.parmak && x.gorunur) || (yedek && yedek.gorunur && (job.yol.length === 1 || yedek.parmak.split('|')[0] === son.parmak.split('|')[0]) ? yedek : null);
    if (!el) { kayit.atlandi = 'düğme bulunamadı'; return kayit; }
    Object.assign(kayit, { metin: el.metin, etiket: el.etiket, id: el.id, boyut: `${el.w}x${el.h}`, yazi: el.fs, href: el.href, kucukHedef: el.w < 40 || el.h < 40 });
    const onceP = await pencereler(page);
    const onceO = await olcum(page);
    const onceUrl = page.url();
    await bas(page, page.locator(SECICI).nth(el.i), kayit);
    await page.waitForTimeout(1200);
    const sonUrl = page.url();
    kayit.gidilen = sonUrl !== onceUrl ? decodeURI(sonUrl.replace(BASE, '')) : '';
    let sonO = null, sonP = [];
    for (let deneme = 0; deneme < 3 && !sonO; deneme++) {
      await page.waitForLoadState('load', { timeout: 6000 }).catch(() => {});
      if (kayit.gidilen || deneme) await page.waitForTimeout(900);
      try { sonO = await olcum(page); sonP = await pencereler(page); } catch (e) { if (deneme === 2) kayit.hatalar.push('ölçüm: ' + e.message.slice(0, 80)); }
    }
    kayit.gidilen = page.url() !== onceUrl ? decodeURI(page.url().replace(BASE, '')) : '';
    if (sonO) {
      kayit.tasma = sonO.tasma > 1 ? sonO.tasma : 0;
      kayit.kucukYazi = sonO.kucukYazi;
      kayit.baslik = sonO.baslik;
      const onceKim = new Set(onceP.map(p => p.kim));
      kayit.yeniPencereler = sonP.filter(p => !onceKim.has(p.kim));
      kayit.etkisiz = !kayit.gidilen && !kayit.yeniSekme && !kayit.diyaloglar.length && !kayit.indirmeler.length && (sonO.mut - onceO.mut) <= 1 && sonO.metin === onceO.metin;
    }
    if (kayit.gidilen && /404|Error response/i.test(kayit.baslik || '')) kayit.hatalar.push('404 sayfası: ' + kayit.gidilen);
    const ad = `${job.sayfa}__${job.yol.map(y => y.i).join('-')}`.replace(/[^\w.-]/g, '_');
    await page.screenshot({ path: path.join(OUT, 'ekran', ad + '.png'), timeout: 5000 }).catch(() => {});
    kayit.ekran = ad + '.png';
    // 2. seviye: aynı sayfada kalındıysa ve yeni düğmeler çıktıysa
    if (job.yol.length === 1 && !kayit.gidilen && !kayit.etkisiz) {
      const sonraListe = await listele(page).catch(() => []);
      const onceGorunen = new Set(onceListe.filter(x => x.gorunur && (x.w > 0 || x.kapali)).map(x => x.parmak));
      kayit.yeniDugmeler = sonraListe.filter(x => x.gorunur && !x.kapali && !x.atla && x.w > 0 && !x.altCubuk && !onceGorunen.has(x.parmak)).map(x => ({ i: x.i, parmak: x.parmak, metin: x.metin, etiket: x.etiket, sinif: x.sinif }));
    }
  } catch (e) {
    kayit.hatalar.push('TARAYICI: ' + e.message.split('\n')[0].slice(0, 140));
  } finally { await ctx.close().catch(() => {}); }
  return kayit;
}

async function sayfaListesi(browser, sayfa) {
  const ctx = await yeniBaglam(browser);
  const page = await ctx.newPage();
  const jsHata = [], http = [];
  page.on('pageerror', e => jsHata.push(e.message.slice(0, 180)));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) http.push(r.status() + ' ' + decodeURI(r.url().replace(BASE, ''))); });
  try {
    await sayfayiAc(page, sayfa);
    const liste = (await listele(page)).filter(x => x.gorunur && !x.atla && (sayfa === ALT_CUBUK_SAYFASI || !x.altCubuk));
    const o = await olcum(page);
    const p = await pencereler(page);
    await page.screenshot({ path: path.join(OUT, 'ekran', `${sayfa}__ACILIS.png`.replace(/[^\w.-]/g, '_')), fullPage: true, timeout: 8000 }).catch(() => {});
    return { sayfa, liste, jsHata, http, tasma: o.tasma, kucukYazi: o.kucukYazi, baslik: o.baslik, acilisPencereleri: p };
  } catch (e) { return { sayfa, liste: [], hata: e.message.split('\n')[0] }; }
  finally { await ctx.close().catch(() => {}); }
}

// Aynı yapıdaki uzun listeler (ör. 500 modül düğmesi): ilk 3, her 100'üncü ve son öğe
function ornekle(liste, kayitNotu) {
  const gruplar = new Map();
  for (const x of liste) { const k = x.etiket + '|' + (x.sinif || '') ; if (!gruplar.has(k)) gruplar.set(k, []); gruplar.get(k).push(x); }
  const sec = new Set();
  for (const [k, g] of gruplar) {
    if (g.length <= 12 || !g[0].sinif) { g.forEach(x => sec.add(x)); continue; }
    g.forEach((x, j) => { if (j < 3 || j % 100 === 0 || j === g.length - 1) sec.add(x); });
    kayitNotu?.push(`${k} grubu: ${g.length} öğeden ${g.filter(x => sec.has(x)).length} örnek`);
  }
  return liste.filter(x => sec.has(x));
}

async function main() {
  const sayfalar = SECILEN.length ? SECILEN : SAYFALAR;
  const browser = await chromium.launch({ headless: true });
  const ozet = [];
  const kuyruk = [];
  for (const s of sayfalar) {
    const o = await sayfaListesi(browser, s);
    const not = [];
    const secilen = ornekle(o.liste, not);
    ozet.push({ ...o, ornekleme: not, toplamDugme: o.liste.length, liste: o.liste.map(x => ({ i: x.i, metin: x.metin, etiket: x.etiket, w: x.w, h: x.h, fs: x.fs })) });
    for (const x of secilen) kuyruk.push({ sayfa: s, yol: [{ i: x.i, parmak: x.parmak, metin: x.metin }] });
  }
  fs.writeFileSync(path.join(OUT, 'ozet.json'), JSON.stringify(ozet, null, 1));
  console.error(`Sayfa: ${sayfalar.length}, 1. seviye iş: ${kuyruk.length}`);
  const sonuc = [];
  let bitti = 0, ikinci = 0;
  const seviye2Gorulen = new Set();
  async function isci() {
    while (kuyruk.length) {
      const job = kuyruk.shift();
      const r = await is(browser, job);
      sonuc.push(r);
      if (r.yeniDugmeler?.length) {
        for (const d of ornekle(r.yeniDugmeler).slice(0, 40)) {
          const anahtar = job.sayfa + '§' + d.parmak;
          if (seviye2Gorulen.has(anahtar)) continue;
          seviye2Gorulen.add(anahtar);
          kuyruk.push({ sayfa: job.sayfa, yol: [job.yol[0], d] });
          ikinci++;
        }
      }
      if (++bitti % 50 === 0) { console.error(`${bitti} bitti, kuyruk ${kuyruk.length}, 2. seviye eklenen ${ikinci}`); fs.writeFileSync(path.join(OUT, 'sonuc.json'), JSON.stringify(sonuc, null, 1)); }
    }
  }
  await Promise.all(Array.from({ length: ISCI }, isci));
  fs.writeFileSync(path.join(OUT, 'sonuc.json'), JSON.stringify(sonuc, null, 1));
  await browser.close();
  console.error(`BİTTİ: ${sonuc.length} tıklama (2. seviye ${ikinci})`);
}
main().catch(e => { console.error(e); process.exit(1); });
