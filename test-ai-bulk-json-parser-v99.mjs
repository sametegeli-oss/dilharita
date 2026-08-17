import fs from "node:fs";import vm from "node:vm";
const code=fs.readFileSync("ai-bulk-json-parser.js","utf8"),ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);
let f=0;function ok(v,m){console.log((v?"✓ ":"✗ ")+m);if(!v)f++;}
const valid='DH-ID: X\n[{"n":1,"explanation":"Satır 1\\nSatır 2"}]';
const gemini='DH-ID: X\n[\n{"n":1,"explanation":"Geçmiş zaman "was" ile kurulur.\\n\\n**Örnek**"},\n{"n":2,"explanation":"Kalıp "the most" biçimindedir."}\n]';
let a=ctx.DHAIBulkJSON.parse(valid),b=ctx.DHAIBulkJSON.parse(gemini);
ok(a.length===1&&a[0].explanation.includes("\n"),"geçerli JSON ve görev kimliği okunuyor");
ok(b.length===2&&b[0].explanation.includes('"was"')&&b[1].n===2,"Gemini'nin kaçırılmamış iç tırnakları tolere ediliyor");
const layout=fs.readFileSync("index-app-layout.js","utf8"),html=fs.readFileSync("index-app.html","utf8"),sw=fs.readFileSync("sw.js","utf8");
ok(layout.includes("DHAIBulkJSON.parse(raw)"),"toplu modül akışı dayanıklı ayrıştırıcıyı kullanıyor");
ok(html.includes("ai-bulk-json-parser.js?v=1")&&html.indexOf("ai-bulk-json-parser")<html.indexOf("index-app-layout.js?v=20"),"ayrıştırıcı doğru sırada yükleniyor");
ok(/dh-sw-v(?:99|[1-9][0-9]{2,})/.test(sw)&&sw.includes("ai-bulk-json-parser.js"),"mobil önbellek güncellendi");process.exit(f?1:0);
