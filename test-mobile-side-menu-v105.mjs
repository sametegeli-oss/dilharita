import fs from "node:fs";
const js=fs.readFileSync("product-improvements.js","utf8"),css=fs.readFileSync("product-improvements.css","utf8"),sw=fs.readFileSync("sw.js","utf8");
let f=0;function ok(v,m){console.log((v?"✓ ":"✗ ")+m);if(!v)f++;}
ok(js.includes("dh-mobile-menu-button")&&js.includes("Bütün menüleri aç"),"ortak mobil menü düğmesi var");
ok(js.includes("dh-mobile-menu__panel")&&js.includes("mobileTools"),"sağ panel ana bölümleri ve araçları içeriyor");
ok(js.includes('e.key==="Escape"')&&js.includes("data-dh-close"),"panel Escape, kapatma ve perde ile kapanıyor");
ok(css.includes("position:fixed!important")&&css.includes("z-index:2147483000")&&css.includes("visibility:visible!important"),"menü düğmesi ekran yerleşiminden bağımsız ve görünür");
ok(css.includes("width:min(86vw,380px)")&&css.includes("translateX(105%)"),"panel sağdan açılıyor ve mobil genişliğe uyuyor");
ok(css.includes(".dh-primary-nav{display:none!important}"),"mobilde tekrarlanan alt menü kaldırılıyor");
ok(/dh-sw-v(?:10[5-9]|1[1-9][0-9]|[2-9][0-9]{2,})/.test(sw),"PWA önbelleği yenilendi");
process.exit(f?1:0);
