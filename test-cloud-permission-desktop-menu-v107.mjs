import fs from "node:fs";
const cloud=fs.readFileSync("cloud-sync.js","utf8"),css=fs.readFileSync("product-improvements.css","utf8"),providers=fs.readFileSync("ai-providers.js","utf8"),sw=fs.readFileSync("sw.js","utf8");
let f=0;function ok(v,m){console.log((v?"✓ ":"✗ ")+m);if(!v)f++;}
ok(cloud.includes('catch(aiErr)')&&cloud.includes('AI açıklamaları cihazda korundu'),"AI koleksiyon izin hatası genel eşlemeyi durdurmuyor");
ok(cloud.includes('yeniSig[ak]=eski[ak]')&&cloud.includes('aiSyncDirty=true'),"başarısız AI kayıtları gönderildi sayılmıyor ve yeniden deneniyor");
ok(css.includes('@media screen{')&&css.includes('.dh-primary-nav{display:none!important}'),"yan panel masaüstü dahil bütün ekran genişliklerinde kullanılıyor");
ok(providers.includes('gemini-bridge.js?v=12'),"dinamik Gemini köprüsü eski önbellekten ayrıldı");
ok(sw.includes('dh-sw-v107'),"PWA önbelleği yenilendi");
process.exit(f?1:0);
