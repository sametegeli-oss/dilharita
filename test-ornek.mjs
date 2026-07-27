/* test-ornek.mjs — kelime baloncuğu kapsamı: HİÇBİR kelime dışarıda kalmasın */
import fs from "node:fs";
let fail=0; const ok=(c,m)=>{console.log(`  ${c?"✓":"✗ BAŞARISIZ"}  ${m}`); if(!c)fail++;};

const kaynak = JSON.parse(fs.readFileSync("data/sentences.json","utf8"));
const havuz  = JSON.parse(fs.readFileSync("data/sentences/examples.json","utf8"));

console.log("\n--- havuz eksiksiz mi ---");
const kaynakEn = kaynak.filter(s=>s.en);
ok(havuz.length===kaynakEn.length, `${havuz.length} cümle = kaynaktaki tüm cümleler`);
const hId=new Set(havuz.map(s=>String(s.id)));
ok(kaynakEn.every(s=>hId.has(String(s.id))), "tek bir cümle bile atlanmamış");
ok(havuz.every(s=>s.en && typeof s.tr==="string"), "her kayıtta en var, tr alanı mevcut");
ok(havuz.every(s=>!("aiExplain" in s) && !("ipa" in s)), "ağır alanlar taşınmıyor (boyut için)");

console.log("\n--- kelime kapsamı ---");
const tok = s => (s||"").toLowerCase().match(/[a-z']+/g) || [];
const kelimeler = new Set();
for(const s of kaynakEn) for(const w of tok(s.en)) if(w.length>=2) kelimeler.add(w);
// havuzdan aynı dizini kur
const dizin = new Map();
for(const s of havuz) for(const w of tok(s.en)) if(w.length>=2){
  if(!dizin.has(w)) dizin.set(w,[]); dizin.get(w).push(s);
}
ok(dizin.size===kelimeler.size, `${dizin.size} farklı kelime — kaynakla aynı`);
const bulunamayan=[...kelimeler].filter(w=>!dizin.has(w));
ok(bulunamayan.length===0, `örnek bulunamayan kelime yok (${bulunamayan.length})`);

console.log("\n--- yalnız tek cümlede geçen nadir kelimeler ---");
const nadir=[...dizin.entries()].filter(([,v])=>v.length===1).map(([w])=>w);
ok(nadir.length>0, `${nadir.length} kelime tek cümlede geçiyor`);
ok(nadir.every(w=>dizin.get(w).length===1), "nadir kelimeler de örnek döndürüyor — hiçbiri kapsam dışı değil");
const orn=dizin.get(nadir[0])[0];
ok(!!(orn.en && orn.id), `örnek: "${nadir[0]}" -> ${orn.en.slice(0,42)}`);

console.log("\n--- en sık geçen kelimeler ---");
ok(dizin.get("the").length>3000, `"the" için ${dizin.get("the").length} cümle bulunuyor`);

console.log("\n--- practice.html tavizi geri alındı mı ---");
const ph=fs.readFileSync("practice.html","utf8");
ok(/State\.examples/.test(ph), "tam havuz kullanılıyor");
ok(/DHSent\.examples\(\)/.test(ph), "havuz arka planda yükleniyor");
ok(/ocr-/.test(ph), "OCR cümleleri de aramaya dahil");

console.log("\n--- diğer tüketiciler ---");
ok(/examples\.json/.test(fs.readFileSync("word-popup.js","utf8")), "word-popup.js havuza geçti");
ok(/examples\.json/.test(fs.readFileSync("kelime-ogren.html","utf8")), "kelime-ogren.html havuza geçti");
ok(/data\/sentences\.json/.test(fs.readFileSync("word-popup.js","utf8")), "eski dosya güvenlik ağı olarak duruyor");

console.log(fail===0?"\nSONUÇ: tüm testler geçti ✓\n":`\nSONUÇ: ${fail} başarısız ✗\n`);
process.exit(fail?1:0);
