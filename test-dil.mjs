/* dhLanguageRule() davranış testi */
import fs from "node:fs";
let fail=0; const ok=(c,m)=>{console.log(`  ${c?"✓":"✗ BAŞARISIZ"}  ${m}`); if(!c)fail++;};
const src=fs.readFileSync("chat-core.js","utf8");
const fn=src.slice(src.indexOf("function dhLanguageRule()"), src.indexOf("function systemPrompt()"));

const store={};
global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=v}};

function kural(isTeacher, pref){
  if(pref) store["dh-teacher-dili"]=pref; else delete store["dh-teacher-dili"];
  return eval(`var __dhIsTeacher=${isTeacher}; ${fn} dhLanguageRule();`);
}

console.log("\n--- AI Öğretmen ---");
let r=kural(true);
ok(/TURKISH/.test(r), "öğretmen modunda Türkçe anlatım dayatılıyor");
ok(/target sentences|example/i.test(r), "öğretilen İngilizce malzeme İngilizce kalıyor");
ok(!/Always reply in English/.test(r), "eski İngilizce kuralı uygulanmıyor");

console.log("\n--- rol yapma (havaalanı, otel, doktor) ---");
r=kural(false);
ok(/Always reply in English/.test(r), "senaryo sohbetleri İngilizce kalıyor (pratiğin amacı bu)");
ok(!/TURKISH/.test(r), "senaryoya Türkçe kuralı sızmıyor");

console.log("\n--- kullanıcı tercihi ---");
r=kural(true,"en");
ok(/Always reply in English/.test(r), 'dh-teacher-dili="en" ile eskiye dönülebiliyor');
r=kural(true,"tr");
ok(/TURKISH/.test(r), 'dh-teacher-dili="tr" Türkçe kalıyor');

console.log(fail===0?"\nSONUÇ: tüm testler geçti ✓\n":`\nSONUÇ: ${fail} başarısız ✗\n`);
process.exit(fail?1:0);
