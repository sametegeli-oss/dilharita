/* test-senkron.mjs — ağız/ses senkronu */
import fs from "node:fs";
let fail=0; const ok=(c,m)=>{console.log(`  ${c?"✓":"✗ BAŞARISIZ"}  ${m}`); if(!c)fail++;};
const cc=fs.readFileSync("chat-core.js","utf8");
const ix=fs.readFileSync("index.html","utf8");

console.log("\n--- döngü kaldırıldı (asıl hata) ---");
ok(!/talkSeq\[this\.talkIndex % this\.talkSeq\.length\]/.test(cc),
   "chat-core: '% talkSeq.length' başa dönüşü kaldırıldı");
ok(!/seq\[si%seq\.length\]/.test(ix),
   "index.html: '% seq.length' başa dönüşü kaldırıldı");
ok(/talkIndex >= this\.talkSeq\.length/.test(cc), "chat-core: dizi bitince duruyor");
ok(/si>=seq\.length/.test(ix), "index.html: dizi bitince duruyor");

console.log("\n--- kare süresi artık sabit değil ---");
ok(!/\}, 105\);/.test(cc), "chat-core: sabit 105 ms gitti");
const sm=ix.slice(ix.indexOf("function startMouth"), ix.indexOf("function alignMouth"));
ok(!/,\s*\d+\s*\);?\s*\}?$/m.test(sm.split("setInterval")[1]||""),
   "index.html: ağız zamanlayıcısında sabit sayı yok");
ok(/_step\)/.test(sm), "index.html: hesaplanan adım kullanılıyor");
ok(/_total \/ Math\.max\(1, this\.talkSeq\.length\)/.test(cc), "chat-core: süre / kare sayısı");
ok(/_total\/Math\.max\(1,seq\.length\)/.test(ix), "index.html: süre / kare sayısı");

console.log("\n--- onboundary hizalaması ---");
ok(/u\.onboundary/.test(cc), "chat-core: onboundary bağlandı");
ok(/u\.onboundary/.test(ix), "index.html: onboundary bağlandı");
ok(/alignTo\(ratio\)/.test(cc), "chat-core: alignTo() var");
ok(/function alignMouth\(ratio\)/.test(ix), "index.html: alignMouth() var");
ok(/Math\.abs\(hedef - this\.talkIndex\) > 2/.test(cc), "küçük sapmalar düzeltilmiyor (titreme olmasın)");

console.log("\n--- adım süresi hesabı makul mü ---");
const step=(total,n)=>Math.max(40,Math.min(170,Math.round(total/Math.max(1,n))));
ok(step(3000,45)===67, `45 karelik 3 sn -> ${step(3000,45)} ms/kare`);
ok(step(1200,60)===40, `60 karelik 1,2 sn tabanda kalıyor -> ${step(1200,60)} ms`);
ok(step(9000,20)===170, `20 karelik 9 sn tavanda kalıyor -> ${step(9000,20)} ms`);
ok(step(1000,0)>=40, "sıfır kare çökertmiyor");

console.log("\n--- emoji ayıklanmış metin ---");
ok(/var sesMetni=text\.replace/.test(ix), "index.html: süre/hizalama seslendirilen metne göre");
ok(/sesMetni\.length\*70/.test(ix), "ekrandaki metne değil, okunan metne göre");

console.log(fail===0?"\nSONUÇ: tüm testler geçti ✓\n":`\nSONUÇ: ${fail} başarısız ✗\n`);
process.exit(fail?1:0);
