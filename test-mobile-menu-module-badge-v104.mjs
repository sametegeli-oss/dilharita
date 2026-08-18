import fs from "node:fs";
const css=fs.readFileSync(new URL("./dh-ui.css",import.meta.url),"utf8");
const layout=fs.readFileSync(new URL("./index-app-layout.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("./index-app.html",import.meta.url),"utf8");
const sw=fs.readFileSync(new URL("./sw.js",import.meta.url),"utf8");
function ok(v,m){if(!v)throw new Error(m);console.log("✓ "+m);}
ok(css.includes(".dh-ust__sag .dh-ikon-btn")&&css.includes("visibility:visible !important")&&css.includes("flex:0 0 44px"),"mobil üst menü ikonları görünür ve küçülmez");
ok(layout.includes('querySelectorAll("#root .module-tile")')&&layout.includes('querySelector(".module-name")'),"AI durumu gerçek modül kartı ve adı üzerinden eşleşiyor");
ok(layout.includes("dh-ai-ready-badge")&&layout.includes("AI açıklamaları hazır"),"tamamlanan modüle görünür rozet ekleniyor");
ok(html.includes("index-app-layout.js?v=21"),"index-app yeni yerleşim sürümünü çağırıyor");
ok(/dh-sw-v(?:10[4-9]|1[1-9][0-9]|[2-9][0-9]{2,})/.test(sw),"önbellek sürümü güncel");
