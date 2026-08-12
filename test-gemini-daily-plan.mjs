import fs from "node:fs";
import assert from "node:assert/strict";

const coach=fs.readFileSync("koc.js","utf8");
const report=fs.readFileSync("gemini-report.js","utf8");
const home=fs.readFileSync("index.html","utf8");
assert.match(coach,/hata-defteri\.html\?gemini=gunluk/,"Karne mikro çalışması günlük plana bağlanmalı");
assert.match(coach,/age<30\*86400000/,"Bayat karne günlük plana alınmamalı");
assert.match(coach,/Karnenden 3 soru/,"Plan görevi açık adlandırılmalı");
assert.match(report,/dailyRootIndex/,"Kök nedenler günlere dağıtılmalı");
assert.match(report,/ex=ex\.slice\(0,3\)/,"Günlük yük üç soruyla sınırlanmalı");
assert.match(report,/syncDailyPlan\(n\)/,"Doğru cevaplar merkezi planı ilerletmeli");
assert.match(report,/if\(n>=3\)/,"Üç doğru cevap tamamlanma ölçütü olmalı");
assert.match(home,/gemini=gunluk[^\n]+return 3/,"Ana plan hedefi üç olmalı");
console.log("PASS gemini-daily-plan");
