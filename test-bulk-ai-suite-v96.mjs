import fs from "node:fs";
const s=fs.readFileSync("bulk-ai-v33.js","utf8"),sw=fs.readFileSync("sw.js","utf8");
let f=0;function ok(v,m){console.log((v?"✓ ":"✗ ")+m);if(!v)f++;}
ok(s.includes("moduleWords")&&s.includes("dh-word-package-v2"),"modül kelimeleri toplu hazırlanıyor");
ok(s.includes("moduleReport"),"modül raporu toplu hazırlanıyor");
ok(s.includes("errorLesson"),"Hata Defteri toplu ders paketi var");
ok(s.includes("combinedDayPlan")&&s.includes("bulk-day-tomorrow"),"bugün ve yarın tek pakette");
ok(s.includes("PDF için eksik açıklamaları tamamla"),"PDF açıklama hazırlığı var");
ok(/dh-sw-v(?:9[6-9]|[1-9][0-9]{2,})/.test(sw)&&sw.includes("bulk-ai-v33.js"),"mobil önbellek güncel");
process.exit(f?1:0);
