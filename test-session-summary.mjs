import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source=fs.readFileSync("dh-session-summary.js","utf8");
const window={};
vm.runInNewContext(source,{window,Math,Number,String});
const summary=window.DHSessionSummary.build({title:"Test",correct:7,wrong:3,total:10,durationMs:125000});
assert.equal(summary.accuracy,70);
assert.equal(summary.minutes,3);
assert.equal(summary.next.href,"./hata-defteri.html");
for(const page of ["practice.html","ogren.html","videopractice.html","ders.html"]){
  const html=fs.readFileSync(page,"utf8");
  assert.match(html,/dh-session-summary\.js/);
  assert.match(html,/DHSessionSummary\.enhance/);
}
const sw=fs.readFileSync("sw.js","utf8");
assert.match(sw,/dh-session-summary\.js/);
console.log("OK: ortak oturum ozeti hesaplama ve ekran entegrasyonlari dogrulandi.");
