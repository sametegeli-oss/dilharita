import fs from "node:fs";
import vm from "node:vm";

const code=fs.readFileSync("dh-learning-coach.js","utf8");
const store=new Map();
const window={localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))}};
const context={window,localStorage:window.localStorage,console,Date,encodeURIComponent,setTimeout,clearTimeout};
vm.createContext(context);vm.runInContext(code,context);
const coach=window.DHLearningCoach,fail=[];
function check(ok,msg){if(ok)console.log("  ✓ "+msg);else{console.error("  ✗ "+msg);fail.push(msg);}}

console.log("\n--- kişisel günlük öğrenme koçu ---");
let m=coach.build({goal:10,day:{sentences:3},due:4});
check(m.pct===30&&m.remaining===7,"günlük hedef ilerlemesi doğru hesaplanıyor");
check(m.action.kind==="review","vadesi gelen tekrar en yüksek öncelikte");
m=coach.build({goal:10,day:{sentences:3},due:0,weak:{type:"article",count:4}});
check(m.action.kind==="weak"&&/article/.test(m.action.href),"tekrar yoksa tekrar eden zayıf konu öneriliyor");
m=coach.build({goal:10,day:{sentences:3},due:0,weak:{type:"article",count:2}});
check(m.action.kind==="learn","zayıf konu eşiğin altındaysa günlük hedef sürüyor");
m=coach.build({goal:5,day:{sentences:8},due:0});
check(m.pct===100&&m.action.kind==="talk","hedef yüzde 100'de sınırlandırılıp konuşmaya geçiliyor");
m=coach.build({goal:5,day:{sentences:5,talks:1},due:0});
check(m.action.kind==="done","öğrenme ve konuşma bitince gün tamamlanıyor");
const weak=coach._topError([
  {primaryType:"tense",createdAt:new Date().toISOString()},
  {types:["tense"],updatedAt:new Date().toISOString()},
  {type:"article",createdAt:new Date().toISOString()},
  {primaryType:"article",reviewed:true,createdAt:new Date().toISOString()}
]);
check(weak.type==="tense"&&weak.count===2,"incelenmemiş son 30 günlük hatalardan baskın konu seçiliyor");
check(/data-dh-goal-save/.test(code)&&/DHProfile\.set\(\{gunlukHedef:value/.test(code),"günlük hedef ana ekrandan değiştirilebiliyor");

if(fail.length){console.error("\nSONUÇ: "+fail.length+" test başarısız");process.exit(1);}
console.log("\nSONUÇ: tüm öğrenme koçu testleri geçti ✓\n");
