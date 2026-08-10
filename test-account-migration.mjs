/* Misafir ilerlemesinin hesaba geçerken korunması */
import fs from "node:fs";
let fail=0;
const ok=(c,m)=>{ console.log(`  ${c?"✓":"✗ BAŞARISIZ"}  ${m}`); if(!c) fail++; };
const login=fs.readFileSync("login.html","utf8");
const cloud=fs.readFileSync("cloud-sync.js","utf8");
const index=fs.readFileSync("index.html","utf8");

console.log("\n--- misafir → hesap geçişi ---");
ok(/dh-account-migration-pending/.test(login),"girişte geçiş işareti bırakılıyor");
ok(/migration && localStorage\.getItem\(rk\)!=null/.test(cloud),"yerel basit değerler eski bulut verisiyle ezilmiyor");
ok(/mergeTracker/.test(cloud)&&/mergeMirror/.test(cloud)&&/errMerge/.test(cloud),"çalışma, ilerleme ve hata kayıtları birleşiyor");
ok(/removeItem\("dh-account-migration-pending"\)/.test(cloud),"işaret yalnız başarılı yazmadan sonra temizleniyor");
ok(/removeItem\("dh_guest_mode"\)/.test(cloud),"başarılı geçişte misafir modu kapanıyor");
ok(/if\(!pres \|\| !pres\.ok\)/.test(cloud)&&/Cihazdaki verilerin korundu/.test(cloud),"buluta geri yazma başarısızsa geçiş başarılı sayılmıyor");
ok(/dh-cloud-sync-state/.test(cloud),"kullanıcıya senkron durumu bildiriliyor");
ok(/cloud-sync\.js/.test(index),"ana ekran geçişi otomatik başlatabiliyor");

console.log(fail===0?"\nSONUÇ: tüm testler geçti ✓\n":`\nSONUÇ: ${fail} başarısız ✗\n`);
process.exit(fail?1:0);
