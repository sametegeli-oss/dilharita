import fs from "node:fs";const s=fs.readFileSync("index-app-layout.js","utf8"),h=fs.readFileSync("index-app.html","utf8"),sw=fs.readFileSync("sw.js","utf8");let f=0;function ok(v,m){console.log((v?"✓ ":"✗ ")+m);if(!v)f++;}
ok(s.includes("90-130 Türkçe kelime")&&s.includes("TAMAMINI")&&s.includes("Yanıtı erken bitirme"),"toplu prompt bütün kayıtları tek yanıta sığdırmayı zorunlu tutuyor");
ok(s.includes("isDetailedModuleExplanation")&&s.includes("t.length>=450")&&s.includes("rejected++"),"aşırı kısa veya eksik başlıklı cevaplar tamamlandı sayılmıyor");
ok(s.includes("Tüm Modülü Ayrıntılı Yenile")&&s.includes("explainActiveModuleWithAI(true)"),"kayıtlı olsa bile tüm modül yeniden çekilebiliyor");
ok(s.includes("forceRefresh:!!forceAll")&&s.includes("eski açıklaması korundu"),"tam yenileme önbelleği aşarken yetersiz cevap eski kaydı bozmuyor");
ok(/index-app-layout\.js\?v=(?:1[8-9]|[2-9][0-9])/.test(h)&&/dh-sw-v(?:10[1-9]|1[1-9][0-9]|[2-9][0-9]{2,})/.test(sw),"tarayıcı ve PWA önbelleği yenilendi");process.exit(f?1:0);
