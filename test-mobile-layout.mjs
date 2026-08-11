import fs from "node:fs";

const shell=fs.readFileSync("dh-app-shell.js","utf8");
const ui=fs.readFileSync("dh-ui.css","utf8");
const pdf=fs.readFileSync("pdfoku.html","utf8");
const voice=fs.readFileSync("ses-esleme.html","utf8");
const library=fs.readFileSync("library.html","utf8");
const teacher=fs.readFileSync("teacher.html","utf8");
const failed=[];
function check(ok,msg){if(ok)console.log("  ✓ "+msg);else{console.error("  ✗ "+msg);failed.push(msg);}}

console.log("\n--- mobil yerleşim güvenlik ağı ---");
for(const page of ["chat","chatteacher1","chatdoctor","ogren","practice","videopractice","sesdalga"]){
  check(new RegExp("(?:\\||\\()"+page+"(?:\\||\\))").test(shell),page+" tam ekran modunda ortak alt menüden ayrılmış");
}
check(/dh-has-app-nav #dhSyncBadge/.test(ui),"bulut rozeti alt menünün üzerinde tutuluyor");
check(/dh-has-app-nav \.dh-tb-fab/.test(ui),"öğretmen düğmesi alt menünün üzerinde tutuluyor");
check(/max-width:480px/.test(pdf)&&/grid-template-columns:1fr 1fr/.test(pdf),"PDF araçları mobilde iki satıra kırılıyor");
check(/\.bar input\[type=text\].*min-width:0/.test(voice),"ses eşleme metin alanı kapsayıcıdan taşmıyor");
check(/\.level-row\{display:grid;grid-template-columns:repeat\(3/.test(library),"seviye düğmeleri mobilde üç sütuna sarılıyor");
check(/\.manual-entry\{[^}]*width:100%/.test(teacher)&&/\.state\{min-width:0/.test(teacher),"öğretmen eylemleri dar ekranda kapsayıcıya uyuyor");

if(failed.length){console.error("\nSONUÇ: "+failed.length+" mobil kontrol başarısız");process.exit(1);}
console.log("\nSONUÇ: tüm mobil yerleşim kontrolleri geçti ✓\n");
