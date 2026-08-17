import fs from "node:fs";
import SentenceAnalyzer from "./sentence-analyzer.js";

let fail=0;
const ok=(value,message)=>{console.log(`${value?"✓":"✗"} ${message}`);if(!value)fail++;};
const report=fs.readFileSync("gemini-report.js","utf8");
const page=fs.readFileSync("hata-defteri.html","utf8");
const sw=fs.readFileSync("sw.js","utf8");

ok(SentenceAnalyzer.analyze("Be quiet, or else you aren't welcome here.","be quiet or else you are not welcome here").verdict==="correct","aren't ile are not eşdeğer kabul ediliyor");
ok(SentenceAnalyzer.analyze("Speak loudly so that he isn't ignored.","speak loudly so that he is not ignored").verdict==="correct","isn't ile is not eşdeğer kabul ediliyor");
ok(/answerCorrect\(got,want\)/.test(report)&&/SentenceAnalyzer\.analyze\(want,got\)/.test(report),"Gemini günlük karne ortak eşdeğerlik motorunu kullanıyor");
ok(page.includes("gemini-report.js?v=3"),"Hata Defteri yeni karne kodunu önbellekten ayırıyor");
ok(/dh-sw-v(?:8[4-9]|9\d+)/.test(sw),"Service Worker önbellek sürümü v84 veya sonrasına yükseltildi");

process.exit(fail?1:0);
