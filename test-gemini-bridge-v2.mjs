import fs from "node:fs";
const src=fs.readFileSync(new URL("./gemini-bridge.js",import.meta.url),"utf8");
let failed=0;
function ok(v,m){ if(v) console.log("✓",m); else { console.error("✗",m); failed++; } }

ok(src.includes('PENDING_KEY = "dh-gemini-pending-v2"')&&src.includes("savePending(job)"),"bekleyen Gemini görevi yeniden yüklemeye karşı saklanıyor");
ok(src.includes("GÖREV KİMLİĞİ:")&&src.includes("Bu cevap başka göreve ait"),"yanıt görev kimliğiyle yanlış işe uygulanmıyor");
ok(src.includes("global.open(GEMINI_URL")&&src.includes("copy(prompt)"),"tek işlemde prompt kopyalanıp Gemini açılıyor");
ok(src.includes('navigator.permissions.query({name:"clipboard-read"})')&&src.includes("visibilitychange"),"Gemini'den dönüşte izinli pano algılanıyor");
ok(src.includes("Onayla ve uygula")&&src.includes("Uygulanacak Gemini yanıtı"),"yanıt uygulanmadan önce önizleme ve onay var");
ok(src.includes("GİZLİ-API-ANAHTARI")&&src.includes("GİZLİ-EPOSTA"),"hassas bilgiler Gemini promptunda maskeleniyor");
ok(src.includes("replace(/,\\s*([}\\]])/g"),"yaygın JSON biçim kusurları otomatik onarılıyor");

if(failed) process.exit(1);
console.log("Gemini köprüsü v2 kontrolleri geçti.");
