import fs from "node:fs";
import path from "node:path";
let failed = 0;
const ok = (v,m) => { console.log(`${v?'✓':'✗'} ${m}`); if(!v) failed++; };
const html = fs.readdirSync(".").filter(f => f.endsWith(".html"));
ok(html.length === 52, "52 ekran korunuyor");
for (const f of html) {
  const s=fs.readFileSync(f,"utf8");
  ok(s.includes("product-improvements.css") && s.includes("product-improvements.js"), `${f}: ortak iyileştirme katmanı`);
}
const rows=JSON.parse(fs.readFileSync("data/sentences.json","utf8"));
ok(new Set(rows.map(x=>x.id)).size===rows.length,"tüm cümle kimlikleri benzersiz");
ok(rows.every(x=>String(x.tr||"").trim()),"tüm cümlelerde Türkçe çeviri var");
const excel=JSON.parse(fs.readFileSync("data/excelveri.json","utf8"));
ok(excel.every(x=>String(x.ingilizce||"").trim() || String(x.türkçe||"").trim()),"Excel havuzunda tamamen boş satır yok");
const guide=JSON.parse(fs.readFileSync("translation_guide.json","utf8"));
ok(guide.every(x=>String(x.section||"").length<=40),"çeviri rehberi bölüm metadata'sı paragraf içermiyor");
ok(fs.readFileSync("sw.js","utf8").includes("product-improvements.js"),"PWA ortak iyileştirmeleri çevrimdışı önbelleğe alıyor");
process.exit(failed?1:0);
