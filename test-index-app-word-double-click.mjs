import fs from "node:fs";

let fail = 0;
const ok = (value, message) => {
  console.log(`${value ? "✓" : "✗"} ${message}`);
  if (!value) fail++;
};

const bridge = fs.readFileSync("index-app-word-double-click.js", "utf8");
const page = fs.readFileSync("index-app.html", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");

ok(/addEventListener\("click", onClick, true\)/.test(bridge), "React kelime tek tıklaması yakalama aşamasında engelleniyor");
ok(/addEventListener\("dblclick", onDoubleClick, true\)/.test(bridge), "kelime açma çift tıklamaya bağlandı");
ok(/closest\("\.tok"\)/.test(bridge), "kural yalnız İngilizce React kelimelerine uygulanıyor");
ok(/Object\.defineProperty\(click, PASS/.test(bridge), "çift tıklama React'e güvenli tek açma olayı aktarıyor");
ok(page.includes("index-app-word-double-click.js?v=1"), "index-app çift tıklama köprüsünü yüklüyor");
ok(/dh-sw-v(?:8[3-9]|9\d+)/.test(sw), "Service Worker önbellek sürümü v83 veya sonrasına yükseltildi");

process.exit(fail ? 1 : 0);
