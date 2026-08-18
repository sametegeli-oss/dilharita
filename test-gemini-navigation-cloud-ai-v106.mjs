import fs from "node:fs";
const bridge=fs.readFileSync("gemini-bridge.js","utf8"),html=fs.readFileSync("index-app.html","utf8"),cloud=fs.readFileSync("cloud-sync.js","utf8"),sw=fs.readFileSync("sw.js","utf8");
let f=0;function ok(v,m){console.log((v?"✓ ":"✗ ")+m);if(!v)f++;}
const autoTail=bridge.slice(bridge.indexOf('function returned()'));
ok(!autoTail.includes('global.open(GEMINI_URL'),"Gemini görev oluşturulurken otomatik sekme açılmıyor");
ok(bridge.includes('ov.querySelector(".dhgb-open").onclick')&&bridge.includes('global.open(GEMINI_URL'),"Gemini yalnız açık kullanıcı düğmesiyle açılıyor");
ok(bridge.includes('clearPending(id); close(); if(typeof opt.onCancel')&&bridge.includes('addEventListener("pagehide",abandoned'),"kapatma ve menü geçişi bekleyen görevi temizliyor");
ok(html.includes('cloud-sync.js?v=22')&&html.indexOf('cloud-sync.js?v=22')<html.indexOf('index-app-layout.js?v=21'),"index-app bulut köprüsünü açıklama araçlarından önce yüklüyor");
ok(cloud.includes('aiReadAll()')&&cloud.includes('saveAIExplanations')&&cloud.includes('loadAIExplanations'),"AI açıklamaları çift yönlü bulut zincirinde");
ok(cloud.includes('aiSyncDirty=true; pushSoon()')&&cloud.includes('if(aiSyncDirty) setTimeout(function(){ pushNow(); },800)'),"kimlik hazır olmasa da toplu açıklama bulut yazımı kaybolmuyor");
ok(/dh-sw-v(?:10[6-9]|1[1-9][0-9]|[2-9][0-9]{2,})/.test(sw),"PWA önbelleği yenilendi");
process.exit(f?1:0);
