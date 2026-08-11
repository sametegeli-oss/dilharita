import fs from "node:fs";
import assert from "node:assert/strict";
const pages=fs.readdirSync(".").filter(x=>x.endsWith(".html"));
assert.ok(pages.length>=50);
for(const page of pages) assert.match(fs.readFileSync(page,"utf8"),/atlas-theme\.css/,page+" Atlas temasına bağlı değil");
const css=fs.readFileSync("atlas-theme.css","utf8");
for(const token of ["--atlas-purple","--atlas-cyan","--atlas-panel",".dh-app-nav","prefers-reduced-motion"]) assert.ok(css.includes(token),token+" eksik");
assert.match(fs.readFileSync("sw.js","utf8"),/atlas-theme\.css/);
console.log(`OK: Atlas görsel sistemi ${pages.length} HTML ekranına ve PWA kabuğuna bağlı.`);
