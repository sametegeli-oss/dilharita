import fs from "node:fs";

const src = fs.readFileSync("cloud-sync.js", "utf8");
const failures = [];
function check(ok, message){
  if(ok) console.log("  ✓ " + message);
  else { console.error("  ✗ " + message); failures.push(message); }
}

console.log("\n--- bulut senkronu gizlilik sınırı ---");
const list = src.match(/var LS_KEYS = \[([\s\S]*?)\];/)?.[1] || "";
for(const key of ["groqApiKeys", "cerebrasApiKeys", "geminiApiKeys", "dh-disabled-keys", "apiKeys"]){
  check(!list.includes('"' + key + '"'), key + " senkron listesinde değil");
}
check(/isSecretKey\(k\)/.test(src), "gönderim sırasında ikinci bir sır filtresi var");
check(/purgeSecrets:function/.test(src), "eski bulut kopyalarını temizleyen geçiş var");
check(/!isSecretKey\(rk\)/.test(src), "eski bulut sırları cihaza geri alınmıyor");
const listMatch=src.match(/var LS_KEYS = \[([\s\S]*?)\];/)?.[1]||"";
check(listMatch.includes('"dh-profile-v1"'),"seviye ve günlük hedef profili cihazlar arasında eşitleniyor");
check(/function mergeProfile\(/.test(src)&&/rt>lt \? remoteStr : localStr/.test(src),"profil çakışmasında en yeni cihaz kaydı kazanıyor");
check(/mergeProfile\(localStorage\.getItem\(rk\),rv,migration\)/.test(src),"misafirden hesap geçişinde cihaz profili korunuyor");

if(failures.length){
  console.error("\nSONUÇ: " + failures.length + " güvenlik testi başarısız");
  process.exit(1);
}
console.log("\nSONUÇ: tüm güvenlik testleri geçti ✓\n");
