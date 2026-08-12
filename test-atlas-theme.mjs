import fs from "node:fs";
import assert from "node:assert/strict";
const pages=fs.readdirSync(".").filter(x=>x.endsWith(".html"));
assert.ok(pages.length>=50);
for(const page of pages){ const html=fs.readFileSync(page,"utf8"); assert.match(html,/atlas-theme\.css/,page+" Atlas temasına bağlı değil"); assert.match(html,/atlas-effects\.js/,page+" Atlas efektlerine bağlı değil"); }
const css=fs.readFileSync("atlas-theme.css","utf8");
for(const token of ["--atlas-purple","--atlas-cyan","--atlas-panel",".dh-app-nav","prefers-reduced-motion"]) assert.ok(css.includes(token),token+" eksik");
assert.match(fs.readFileSync("sw.js","utf8"),/atlas-theme\.css/);
const indexHtml=fs.readFileSync("index.html","utf8");
assert.doesNotMatch(indexHtml,/atlas-v2-donus|location\.replace\(.*atlas-v2/,
  "görsel katman DilHarita yönlendirmesini değiştirmemeli");
const fx=fs.readFileSync("atlas-effects.js","utf8");
for(const feature of ["atlas-aurora","atlas-stars","atlas-confetti","atlas-ring","atlas-wave","atlas-heatmap","atlas-chart","dh-atlas-theme","dh-atlas-reading"]) assert.ok((css+fx).includes(feature),feature+" eksik");
assert.doesNotMatch(fx,/preventDefault\(|location\.(?:href|replace)|sessionStorage/,
  "Atlas efektleri yalnız görsel olmalı; sayfa akışını ele geçirmemeli");
for(const feature of ["starRain","failEffect","dh-result","dh-answer-result","atlas-result-shake"]) assert.ok((css+fx).includes(feature),feature+" sonuç animasyonu eksik");
assert.match(fs.readFileSync("sw.js","utf8"),/atlas-effects\.js/);
console.log(`OK: Atlas görsel ve hareket sistemi ${pages.length} HTML ekranına ve PWA kabuğuna bağlı.`);
