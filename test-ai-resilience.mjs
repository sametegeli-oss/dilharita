import fs from "node:fs";

const chat=fs.readFileSync("chat-core.js","utf8");
const providers=fs.readFileSync("ai-providers.js","utf8");
const failed=[];
function check(ok,msg){if(ok)console.log("  ✓ "+msg);else{console.error("  ✗ "+msg);failed.push(msg);}}

console.log("\n--- AI istek dayanıklılığı ---");
check(/new AbortController\(\)/.test(chat),"sohbet istekleri iptal denetleyicisi kullanıyor");
check(/timeoutMs\|\|25000/.test(chat),"AI yanıtı 25 saniyede zaman aşımına uğruyor");
check(/AI isteğini iptal et/.test(chat)&&/textContent="■"/.test(chat),"gönder düğmesi istek sırasında iptal düğmesine dönüşüyor");
check(/State\.abortController\.abort\(\)/.test(chat),"kullanıcı etkin isteği iptal edebiliyor");
check(/input\.value=text/.test(chat),"iptal veya zaman aşımında mesaj kutuya geri konuyor");
check(/signal:opts\.signal/.test(providers),"iptal sinyali tüm AI sağlayıcılarına aktarılıyor");
check((providers.match(/code:"abort"/g)||[]).length>=2&&(providers.match(/err\.code==="abort"/g)||[]).length>=2,"sağlayıcı zinciri iptali ağ hatası veya kota olarak yorumlamıyor");
check(/cleanupRequest\(\);return answer/.test(chat),"başarılı istekte zamanlayıcı temizleniyor");

if(failed.length){console.error("\nSONUÇ: "+failed.length+" dayanıklılık testi başarısız");process.exit(1);}
console.log("\nSONUÇ: tüm AI dayanıklılık testleri geçti ✓\n");
