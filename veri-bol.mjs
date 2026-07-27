#!/usr/bin/env node
/* veri-bol.mjs — data/sentences.json'u parçalara böler
   ------------------------------------------------------------------
   NEDEN: data/sentences.json 8,5 MB (gzip 1,7 MB) tek parça. Kullanıcı tek bir
   modülle çalışsa bile tamamı iniyor, çünkü tarayıcı JSON'un bir kısmını indiremez.

   ÜRETTİĞİ DOSYALAR (data/sentences/ altına):
     index.json              modül listesi + her modülün cümle id'leri  (~gzip 20 KB)
                             → seviye/modül seçim ekranı ve ilerleme çubukları
                               artık SADECE bunu indiriyor
     mod/<slug>.json         modül başına tam kayıtlar (~17 KB)
                             → bir modüle girildiğinde yalnız o iniyor
     test-pool.json          seviye sınavı için hafif havuz (id/level/en/tr/grammar)
     img-queries.json        normalize İngilizce cümle -> imgQuery eşlemesi

   KAYNAK data/sentences.json SİLİNMEZ: parçaların tek doğruluk kaynağı odur,
   yeniden üretmek için gerekir. Çalışma anında hiçbir sayfa onu artık istemez.

   KULLANIM:  node veri-bol.mjs
*/
import fs from "node:fs";
import path from "node:path";

const SRC = "data/sentences.json";
const OUT = "data/sentences";
const MOD_DIR = path.join(OUT, "mod");
const TEST_PER_LEVEL = 400;   // seviye sınavı havuzu (seviye başına)

if (!fs.existsSync(SRC)) {
  console.error(`HATA: ${SRC} bulunamadı. Betiği repo kökünde çalıştır.`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
const all = Array.isArray(raw) ? raw : (raw.sentences || []);
console.log(`kaynak: ${all.length} cümle, ${(fs.statSync(SRC).size / 1048576).toFixed(2)} MB`);

/* ---- modül adını dosya adına çevir ---- */
const TR = { "ı":"i","İ":"i","ş":"s","Ş":"s","ğ":"g","Ğ":"g","ü":"u","Ü":"u","ö":"o","Ö":"o","ç":"c","Ç":"c" };
function slug(s) {
  return String(s)
    .replace(/[ıİşŞğĞüÜöÖçÇ]/g, ch => TR[ch] || ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "mod";
}

/* ---- modüllere grupla, order'a göre sırala (sayfalardaki mantıkla aynı) ---- */
const byModule = new Map();
for (const s of all) {
  const m = s.module || "?";
  if (!byModule.has(m)) byModule.set(m, []);
  byModule.get(m).push(s);
}
for (const arr of byModule.values()) arr.sort((a, b) => (a.order || 0) - (b.order || 0));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(MOD_DIR, { recursive: true });

const used = new Set();
const modules = [];
let shardBytes = 0;

for (const [mod, arr] of byModule) {
  let f = slug(mod);
  let n = 2;
  while (used.has(f)) f = `${slug(mod)}-${n++}`;
  used.add(f);

  const json = JSON.stringify(arr);
  fs.writeFileSync(path.join(MOD_DIR, `${f}.json`), json);
  shardBytes += Buffer.byteLength(json);

  modules.push({
    lvl: arr[0]?.level || "A1",
    mod,
    f,
    n: arr.length,
    // ilerleme çubukları ve derin linkler için id'ler; gzip bunları çok iyi sıkıştırır
    ids: arr.map(s => s.id)
  });
}

/* ---- index ---- */
const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
const levels = LEVEL_ORDER.filter(l => modules.some(m => m.lvl === l));
const index = { v: 1, total: all.length, levels, modules };
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index));

/* ---- seviye sınavı havuzu: level-test.js yalnız en/tr/level/grammar okuyor ---- */
function spread(arr, k) {
  // modüllere eşit dağılacak şekilde seç (hepsi aynı modülden gelmesin)
  if (arr.length <= k) return arr;
  const step = arr.length / k, out = [];
  for (let i = 0; i < k; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
const pool = [];
for (const lv of levels) {
  const items = all.filter(s => s.level === lv && s.en && s.tr);
  for (const s of spread(items, TEST_PER_LEVEL)) {
    pool.push({ id: s.id, level: s.level, en: s.en, tr: s.tr, grammar: s.grammar || "" });
  }
}
fs.writeFileSync(path.join(OUT, "test-pool.json"), JSON.stringify(pool));

/* ---- ÖRNEK CÜMLE HAVUZU ----
   Kelime baloncuğu "şu kelime hangi cümlelerde geçiyor" diye arıyor; bunun için
   TÜM cümlelere bakması gerekiyor. Ama örnek göstermek için yalnız id/en/tr
   yetiyor — ipa, aiExplain, collocations, commonMistake gibi ağır alanlar gerekmiyor.
   Sonuç: 9417 cümlenin tamamı gzip ~300 KB (tam dosya 1716 KB).
   Böylece kapsam %100 kalıyor, arama senkron yapılabiliyor (baloncukta gecikme yok)
   ve hiçbir kelime kapsam dışında kalmıyor. */
const examples = all.map(s => ({ id: s.id, en: s.en || "", tr: s.tr || "" }))
                    .filter(s => s.en);
fs.writeFileSync(path.join(OUT, "examples.json"), JSON.stringify(examples));

/* ---- imgQuery eşlemesi: image-addon.js yalnız bunu kullanıyor ---- */
const normEn = s => String(s || "").toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9' ]/g, "").trim();
const img = {};
for (const s of all) if (s.en && s.imgQuery) img[normEn(s.en)] = s.imgQuery;
fs.writeFileSync(path.join(OUT, "img-queries.json"), JSON.stringify(img));

/* ---- özet ---- */
const kb = p => (fs.statSync(p).size / 1024).toFixed(0);
console.log(`
üretildi → ${OUT}/
  index.json         ${kb(path.join(OUT, "index.json"))} KB   (${modules.length} modül, ${all.length} id)
  mod/*.json         ${modules.length} dosya, toplam ${(shardBytes / 1048576).toFixed(2)} MB
                     ortalama ${(shardBytes / modules.length / 1024).toFixed(0)} KB/modül
  test-pool.json     ${kb(path.join(OUT, "test-pool.json"))} KB   (${pool.length} cümle)
  examples.json      ${kb(path.join(OUT, "examples.json"))} KB   (${examples.length} cümle, kelime araması için)
  img-queries.json   ${kb(path.join(OUT, "img-queries.json"))} KB   (${Object.keys(img).length} eşleme)
`);
