import fs from "node:fs";const s=fs.readFileSync("index-app-layout.js","utf8"),h=fs.readFileSync("index-app.html","utf8"),sw=fs.readFileSync("sw.js","utf8");let f=0;function ok(v,m){console.log((v?"✓ ":"✗ ")+m);if(!v)f++;}
ok(s.includes("showModuleAIWarningOnce")&&s.includes("Modül açıklamaları eksik")&&s.includes("Şimdi açıklamaları al"),"modül ilk açılışında eksik açıklama uyarısı var");
ok(s.includes("sessionStorage.getItem(key)")&&s.includes("dh-module-ai-warning-v1:"),"uyarı aynı modül oturumunda yalnız bir kez gösteriliyor");
ok(s.includes("groups[k].every")&&s.includes("dh-ai-ready-module-card"),"yalnız bütün açıklamaları tamamlanan modül kartı işaretleniyor");
ok(s.includes("AI açıklamaları hazır")&&s.includes("rgba(6,78,59")&&s.includes("border-color:#34d399"),"tamamlanan modül farklı zemin ve rozet kullanıyor");
ok(/index-app-layout\.js\?v=(?:19|[2-9][0-9])/.test(h)&&/dh-sw-v(?:10[2-9]|1[1-9][0-9]|[2-9][0-9]{2,})/.test(sw),"tarayıcı ve PWA önbelleği yenilendi");process.exit(f?1:0);
