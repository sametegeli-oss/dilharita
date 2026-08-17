import fs from "node:fs";
const s=fs.readFileSync(new URL("./hata-defteri.html",import.meta.url),"utf8");
let failed=0;
function ok(v,m){ if(v) console.log("✓",m); else { console.error("✗",m); failed++; } }

ok(/var payload=candidates\.map/.test(s)&&/JSON\.stringify\(payload\)/.test(s),"bütün görünür hata kayıtları tek Gemini paketine konuyor");
ok((s.match(/await DHProviders\.chat\(msgs/g)||[]).length===1,"toplu temizleme yalnız bir AI isteği yapıyor");
ok(!/for\(var i=0;i<candidates\.length;i\+\+\)[\s\S]{0,300}checkOne/.test(s),"cümle başına Gemini çağrısı yapan eski döngü kaldırıldı");
ok(/Object\.keys\(decisions\)\.length!==candidates\.length/.test(s),"Gemini tüm kayıtları yanıtlamazsa hiçbir sonuç uygulanmıyor");
ok(/if\(!\(e&&e\.code==="abort"\)\)/.test(s),"Kapat işlemi yeni istek başlatmadan toplu akışı sonlandırıyor");
ok(/dh-sw-v9[0-9]/.test(fs.readFileSync(new URL(".\/sw.js",import.meta.url),"utf8")),"mobil önbellek toplu akış sürümüne yükseltildi");

if(failed) process.exit(1);
console.log("Hata Defteri toplu Gemini kontrolleri geçti.");
