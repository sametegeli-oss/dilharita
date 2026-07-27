/* test-persona.mjs — öğretmen promptu yalnız öğretmen bağlamına gitmeli */
import fs from "node:fs";
let fail=0; const ok=(c,m)=>{console.log(`  ${c?"✓":"✗ BAŞARISIZ"}  ${m}`); if(!c)fail++;};
const src=fs.readFileSync("ai-teacher-prompt-tts.js","utf8");
const i=src.indexOf("function teacherContext()");
const fn=src.slice(i, src.indexOf("\n  }", i)+4);

global.window={};
eval(fn + "\nglobalThis.teacherContext = teacherContext;");

console.log("\n--- rol yapma senaryoları: öğretmen promptu EKLENMEMELİ ---");
const roller=[
  ["Doktor","a calm male doctor"],
  ["Otel","a friendly male hotel receptionist"],
  ["Havaalanı","a male airport check-in agent"],
  ["Restoran","a waiter"]
];
for(const [title,role] of roller){
  global.window.CHAT_SCENARIO={title,role};
  ok(teacherContext()===false, `${title} sohbetinde öğretmen promptu eklenmiyor`);
}

console.log("\n--- öğretmen bağlamı: EKLENMELİ ---");
global.window.CHAT_SCENARIO={title:"AI Öğretmen", role:"a friendly male English teacher"};
ok(teacherContext()===true, "AI Öğretmen sohbetinde ekleniyor");
global.window.CHAT_SCENARIO={title:"AI Teacher", role:"teacher"};
ok(teacherContext()===true, "İngilizce 'teacher' başlığı da tanınıyor");
delete global.window.CHAT_SCENARIO;
ok(teacherContext()===true, "senaryosuz sayfalar (teacher.html, ocr, phrasal-verbs) ekliyor");

console.log("\n--- sağlamlık ---");
global.window.CHAT_SCENARIO={};
ok(teacherContext()===false, "boş senaryo nesnesi rol-yapma sayılıyor (çökmüyor)");
global.window.CHAT_SCENARIO={title:null,role:undefined};
ok(teacherContext()===false, "eksik alanlar çökertmiyor");

console.log(fail===0?"\nSONUÇ: tüm testler geçti ✓\n":`\nSONUÇ: ${fail} başarısız ✗\n`);
process.exit(fail?1:0);
