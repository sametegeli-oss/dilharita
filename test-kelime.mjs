/* test-kelime.mjs — kelime popup her yerde çalışıyor mu, AI yedeği bağlı mı */
import fs from "node:fs";
let fail=0; const ok=(c,m)=>{console.log(`  ${c?"✓":"✗ BAŞARISIZ"}  ${m}`); if(!c)fail++;};
const wp=fs.readFileSync("word-popup.js","utf8");
const sayfalar=fs.readdirSync(".").filter(f=>f.endsWith(".html"));

console.log("\n--- ASIL HATA: dinleyici hiç bağlanmıyordu ---");
ok(!/if\(document\.readyState!=="loading"\) document\.addEventListener\("click"/.test(wp),
   "else'siz readyState koşulu kaldırıldı");
ok(/document\.readyState === "loading"/.test(wp) && /DOMContentLoaded/.test(wp),
   "belge yükleniyorsa DOMContentLoaded bekleniyor");
ok(/function baglaTiklama/.test(wp), "bağlama ayrı fonksiyona alındı");
ok(/__dhWpBound/.test(wp), "çift bağlama koruması var");
ok(/addEventListener\("click",\s*onClick,\s*true\)/.test(wp), "yakalama fazında dinliyor");

console.log("\n--- tarayıcı kapsamı ---");
ok(/caretRangeFromPoint/.test(wp), "Chrome/Safari yolu var");
ok(/caretPositionFromPoint/.test(wp), "Firefox yolu da var (eskiden yoktu)");
ok(/offsetNode/.test(wp), "Firefox'un döndürdüğü alan okunuyor");

console.log("\n--- sözlükte yoksa AI ---");
ok(/if\(entry\) open\(entry\); else defineWithAI\(/.test(wp),
   "sözlükte bulunamayan kelime AI'ya gidiyor");
ok(/function defineWithAI/.test(wp), "AI tanımlama fonksiyonu var");
const dwa=wp.slice(wp.indexOf("function defineWithAI"), wp.indexOf("function defineWithAI")+1400);
ok(/dh-word-ai-cache-v1/.test(dwa) && /cached/.test(dwa), "önce yerel önbelleğe bakıyor (gereksiz AI çağrısı yok)");
ok(/hasAnyKey/.test(dwa), "anahtar yoksa kullanıcıya açıklıyor");

console.log("\n--- kapsam: hangi sayfalarda çalışıyor ---");
const wpVar=sayfalar.filter(f=>fs.readFileSync(f,"utf8").includes("word-popup.js"));
ok(wpVar.length>=20, `${wpVar.length} sayfada yüklü`);
const gerekli=["chatdoctor.html","chatteacher1.html","chatteacher2.html","chathotel.html",
               "chatairport.html","chatrestaurant.html","phrasal-verbs.html","sesdalga.html","index.html"];
const eksik=gerekli.filter(f=>!wpVar.includes(f));
ok(eksik.length===0, `İngilizce metin olan sayfalarda var${eksik.length?" — eksik: "+eksik.join(", "):""}`);

console.log("\n--- AI yedeği gerçekten çalışabilir mi ---");
const aiEksik=wpVar.filter(f=>!fs.readFileSync(f,"utf8").includes("ai-providers.js"));
ok(aiEksik.length===0,
   `word-popup olan her sayfada ai-providers da var${aiEksik.length?" — eksik: "+aiEksik.join(", "):""}`);

console.log("\n--- bilerek hariç tutulanlar ---");
ok(!fs.readFileSync("seviye-testi.html","utf8").includes("word-popup.js"),
   "seviye-testi.html HARİÇ — sınavda kelime anlamı açmak kopya olur");
ok(fs.readFileSync("index-app.html","utf8").includes("word-popup.js"),
   "index-app.html ortak kelime verisi ve analiz API'sini kullanıyor");

console.log(fail===0?"\nSONUÇ: tüm testler geçti ✓\n":`\nSONUÇ: ${fail} başarısız ✗\n`);
process.exit(fail?1:0);
