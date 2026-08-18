import fs from "node:fs";const c=fs.readFileSync("cloud-sync.js","utf8"),i=fs.readFileSync("index-app-layout.js","utf8"),h=fs.readFileSync("index-app.html","utf8"),sw=fs.readFileSync("sw.js","utf8");let f=0;function ok(v,m){console.log((v?"✓ ":"✗ ")+m);if(!v)f++;}
ok(c.includes('indexedDB.open("DilHaritaAI_DB",1)')&&c.includes('transaction("ai_explanations"'),"AI açıklamaları yerel IndexedDB'den toplanıyor");
ok(c.includes("loadAIExplanations")&&c.includes("saveAIExplanations")&&c.includes('collection(db,"users",uid,"ai_explanations")'),"AI açıklamaları kullanıcıya ait bulut alt koleksiyonuna yüklenip indiriliyor");
ok(c.includes("aiTime(x)>aiTime(old)")&&c.includes("aiMergeRemote"),"cihazlar arasında en yeni açıklama kazanıyor");
ok(i.includes("deleted:true")&&c.includes("deleted:!!x.deleted"),"silme mezar taşı buluta taşınıyor ve silinen kayıt geri dirilmiyor");
ok(c.includes('"__aix:"+sigOf')&&c.includes("aiChanged"),"yalnız değişen açıklamalar fark yazmayla gönderiliyor");
ok(c.includes('addEventListener("dh-ai-explanation-changed"')&&c.includes('aiSyncDirty=true; pushSoon()')&&i.includes('CustomEvent("dh-ai-explanation-changed")'),"açıklama değişikliği otomatik bulut yazımını tetikliyor");
ok(c.includes('"geminiApiKeys"')&&c.includes("isSecretKey"),"API anahtarları bulut dışında kalıyor");
ok(fs.readFileSync("firestore.rules","utf8").includes('match /{document=**} { allow read, write: if owns(uid); }'),"mevcut Firestore kuralları kullanıcı alt koleksiyonunu yalnız sahibine açıyor");
ok(/index-app-layout\.js\?v=(?:2[0-9]|[3-9][0-9])/.test(h)&&/dh-sw-v(?:10[3-9]|1[1-9][0-9]|[2-9][0-9]{2,})/.test(sw),"tarayıcı ve PWA önbelleği yenilendi");process.exit(f?1:0);
