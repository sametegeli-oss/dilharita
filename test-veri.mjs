/* test-veri.mjs — parçalama doğrulaması
   Parçalı verinin, eski tek dosyayla BİREBİR aynı sonucu ürettiğini kanıtlar.
   Kullanım: node test-veri.mjs
*/
import fs from "node:fs";
import path from "node:path";

let fail = 0;
const ok = (c, msg) => { console.log(`  ${c ? "✓" : "✗ BAŞARISIZ"}  ${msg}`); if (!c) fail++; };

/* tarayıcı ortamını taklit et: fetch -> diskten oku */
global.window = {};
global.fetch = async (url) => {
  const p = String(url).replace(/^\.\//, "").split("?")[0];
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => { throw new Error("404"); } };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) };
};

/* loader'ı yükle */
eval(fs.readFileSync("sentences-loader.js", "utf8"));
const DHSent = global.window.DHSent;

const src = JSON.parse(fs.readFileSync("data/sentences.json", "utf8"));
console.log(`\nkaynak: ${src.length} cümle\n`);

/* ---- 1) index ---- */
const ix = await DHSent.index();
ok(ix.total === src.length, `index.total = kaynak sayısı (${ix.total})`);
ok(ix.modules.length === new Set(src.map(s => s.module)).size,
   `modül sayısı doğru (${ix.modules.length})`);
const idsInIndex = ix.modules.reduce((a, m) => a + m.ids.length, 0);
ok(idsInIndex === src.length, `index'teki id sayısı = kaynak (${idsInIndex})`);

/* seviye dağılımı ---- */
const srcLv = {}, ixLv = {};
for (const s of src) srcLv[s.level] = (srcLv[s.level] || 0) + 1;
for (const m of ix.modules) ixLv[m.lvl] = (ixLv[m.lvl] || 0) + m.n;
ok(JSON.stringify(srcLv) === JSON.stringify(ixLv),
   `seviye dağılımı aynı: ${JSON.stringify(ixLv)}`);

/* ---- 2) her modül parçası, kaynağın aynı sıralı süzülmüş hâli mi? ---- */
let mismatch = 0, checked = 0;
for (const m of ix.modules) {
  const shard = await DHSent.module(m.mod);
  const expect = src.filter(s => s.module === m.mod)
                    .sort((a, b) => (a.order || 0) - (b.order || 0));
  if (JSON.stringify(shard) !== JSON.stringify(expect)) { mismatch++; if (mismatch < 4) console.log(`     fark: ${m.mod}`); }
  checked++;
}
ok(mismatch === 0, `${checked} modül parçası kaynakla birebir aynı (sıra dahil)`);

/* ---- 3) toplam kayıp yok ---- */
const all = await DHSent.all();
ok(all.length === src.length, `tüm parçalar toplandığında ${all.length} kayıt`);
const srcIds = new Set(src.map(s => String(s.id)));
ok(all.every(s => srcIds.has(String(s.id))), "hiç uydurma/eksik id yok");

/* ---- 4) byIds: yalnız istenenler, doğru içerikle ---- */
const sample = [src[0], src[1500], src[4000], src[9416]].map(s => String(s.id));
const got = await DHSent.byIds(sample);
ok(Object.keys(got).length === sample.length, `byIds ${sample.length} id için ${Object.keys(got).length} kayıt döndü`);
ok(sample.every(id => got[id] && got[id].en === src.find(s => String(s.id) === id).en),
   "byIds içerikleri kaynakla aynı");
const bogus = await DHSent.byIds(["YOK-123"]);
ok(Object.keys(bogus).length === 0, "olmayan id boş dönüyor (çökmüyor)");

/* ---- 5) findById ---- */
const one = await DHSent.findById(src[777].id);
ok(one && one.en === src[777].en, `findById doğru kaydı buluyor (${src[777].id})`);

/* ---- 6) seviye sınavı havuzu: level-test.js'in okuduğu alanlar dolu mu? ---- */
const pool = await DHSent.testPool();
const lvls = [...new Set(pool.map(s => s.level))].sort();
ok(lvls.length === Object.keys(srcLv).length, `havuzda tüm seviyeler var: ${lvls.join(",")}`);
ok(pool.every(s => s.en && s.tr && s.level), "havuzdaki her kayıtta en/tr/level dolu");
// level-test.js uzunluk filtreleri: her seviyede 3-8 kelimelik cümle bulunmalı
const shortEnough = lvls.every(l => pool.some(s => {
  const wc = s.en.split(/\s+/).length; return s.level === l && wc >= 3 && wc <= 8;
}));
ok(shortEnough, "her seviyede sıralama/yazma sorusuna uygun (3-8 kelime) cümle var");
const poolIds = new Set(pool.map(s => String(s.id)));
ok([...poolIds].every(id => srcIds.has(id)), "havuzdaki id'lerin hepsi kaynakta var");

/* ---- 7) imgQuery eşlemesi ----
   Doğruluk kaynağı: image-addon.js'in ESKİ kodunun bellekte kurduğu harita.
   Not: 577 İngilizce cümle birden fazla modülde tekrar ediyor; eski kod da aynı
   anahtarı son değerle eziyordu, bu yüzden anahtar sayısı kayıt sayısından az. */
const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9' ]/g, "").trim();
const eski = {};
for (const s of src) if (s.en && s.imgQuery) eski[norm(s.en)] = s.imgQuery;
const img = await DHSent.imgQueries();
const keysEski = Object.keys(eski), keysYeni = Object.keys(img);
ok(keysEski.length === keysYeni.length,
   `anahtar sayısı eski kodla aynı (${keysYeni.length})`);
ok(keysEski.every(k => eski[k] === img[k]),
   "her imgQuery değeri eski kodun ürettiğiyle birebir aynı");

/* ---- 8) transfer boyutu karşılaştırması ---- */
import zlib from "node:zlib";
const gzKB = p => (zlib.gzipSync(fs.readFileSync(p)).length / 1024).toFixed(0);
const modFiles = fs.readdirSync("data/sentences/mod");
const avgMod = modFiles.reduce((a, f) => a + zlib.gzipSync(fs.readFileSync(path.join("data/sentences/mod", f))).length, 0) / modFiles.length / 1024;

console.log(`
--- gerçek transfer (gzip) ---
  ESKİ: her sayfa açılışında            data/sentences.json      ${gzKB("data/sentences.json")} KB
  YENİ: modül seçim ekranı              index.json               ${gzKB("data/sentences/index.json")} KB
  YENİ: bir modülle çalışmak            index + 1 modül          ${(+gzKB("data/sentences/index.json") + avgMod).toFixed(0)} KB
  YENİ: seviye sınavı                   test-pool.json           ${gzKB("data/sentences/test-pool.json")} KB
  YENİ: görsel eşleme (image-addon)     img-queries.json         ${gzKB("data/sentences/img-queries.json")} KB
`);

console.log(fail === 0 ? "SONUÇ: tüm testler geçti ✓\n" : `SONUÇ: ${fail} test başarısız ✗\n`);
process.exit(fail === 0 ? 0 : 1);
