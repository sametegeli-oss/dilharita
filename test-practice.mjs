/* test-practice.mjs — practice.html parçalı veri dönüşümü
   En önemli testi: "vadesi gelenler" hesabı eski tam-tarama ile AYNI sonucu vermeli. */
import fs from "node:fs";
let fail=0; const ok=(c,m)=>{console.log(`  ${c?"✓":"✗ BAŞARISIZ"}  ${m}`); if(!c)fail++;};

/* ---- sahte veri: 3 modül, 6 cümle ---- */
const VERI = {
  "A1-M01":[{id:"s1",en:"I am here",module:"A1-M01",level:"A1",order:1},
            {id:"s2",en:"You are late",module:"A1-M01",level:"A1",order:2}],
  "A1-M02":[{id:"s3",en:"We go home",module:"A1-M02",level:"A1",order:1},
            {id:"s4",en:"They go home",module:"A1-M02",level:"A1",order:2}],
  "B1-M01":[{id:"s5",en:"I would have gone",module:"B1-M01",level:"B1",order:1},
            {id:"s6",en:"She had left",module:"B1-M01",level:"B1",order:2}]
};
const IX = { v:1, total:6, levels:["A1","B1"], modules:[
  {lvl:"A1",mod:"A1-M01",f:"a1-m01",n:2,ids:["s1","s2"]},
  {lvl:"A1",mod:"A1-M02",f:"a1-m02",n:2,ids:["s3","s4"]},
  {lvl:"B1",mod:"B1-M01",f:"b1-m01",n:2,ids:["s5","s6"]}]};

let indirilen=0;                       // kaç modül parçası indirildi
global.DHSent = {
  index: async()=>IX,
  module: async(m)=>{ indirilen++; return VERI[m]||[]; },
  byIds: async(ids)=>{ const out={};
    for(const m in VERI){ let used=false;
      for(const x of VERI[m]) if(ids.includes(String(x.id))){ out[String(x.id)]=x; used=true; }
      if(used) indirilen++; }
    return out; }
};

/* ---- fonksiyonları practice.html'den çıkar ---- */
const src=fs.readFileSync("practice.html","utf8");
function al(ad, bitis){
  const i=src.indexOf(ad); const j=src.indexOf(bitis, i);
  if(i<0||j<0) throw new Error("bulunamadı: "+ad);
  return src.slice(i, j+bitis.length);
}
const kod = al("async function ensureModule(mod){","\n}")
          + "\n" + al("async function sentencesByIds(ids){","\n}")
          + "\n" + al("function moduleProgress(mod){","\n}");
global.State = {};
eval(kod + "\nglobalThis.ensureModule=ensureModule;globalThis.sentencesByIds=sentencesByIds;globalThis.moduleProgress=moduleProgress;");

/* ---- loadData'nın kurduğu duruma benzet ---- */
function kurulum(srs){
  State.index=IX; State.byModule=new Map(); State.modMeta=new Map();
  State.byLevel=new Map(); State.sentences=[]; State.srs=srs||{};
  for(const m of IX.modules){
    State.modMeta.set(m.mod,m);
    if(!State.byLevel.has(m.lvl)) State.byLevel.set(m.lvl,[]);
    State.byLevel.get(m.lvl).push(m.mod);
  }
  indirilen=0;
}

console.log("\n--- modül ilerlemesi veri indirmeden ---");
kurulum({s1:{rep:3,due:1},s2:{rep:0,due:0},s3:{rep:2,due:1}});
let p=moduleProgress("A1-M01");
ok(p.total===2 && p.learned===1, `A1-M01: 1/2 (${p.learned}/${p.total})`);
ok(indirilen===0, "ilerleme çubuğu için TEK parça indirilmedi");
ok(moduleProgress("B1-M01").total===2, "hiç açılmamış modülün toplamı da biliniyor");
ok(moduleProgress("YOK").total===0, "olmayan modül çökertmiyor");

console.log("\n--- tembel modül yükleme ---");
kurulum({});
let arr=await ensureModule("A1-M02");
ok(arr.length===2 && indirilen===1, "modül ilk erişimde indiriliyor");
arr=await ensureModule("A1-M02");
ok(indirilen===1, "ikinci erişimde önbellekten (yeniden indirmiyor)");
ok(State.sentences.length===2, "yüklenen cümleler örnek arama havuzuna eklendi");

console.log("\n--- OCR gibi yerel modüller ---");
kurulum({"ocr-0":{rep:5,due:1}});
const ocr=[{id:"ocr-0",en:"My photo sentence",module:"OCR",level:"OCR",order:0}];
State.byModule.set("OCR",ocr); for(const x of ocr) State.sentences.push(x);
ok(moduleProgress("OCR").total===1 && moduleProgress("OCR").learned===1,
   "index'te olmayan OCR modülü bellekten sayılıyor");
let bul=await sentencesByIds(["ocr-0"]);
ok(bul.length===1 && indirilen===0, "yerel OCR cümlesi için ağa gidilmiyor");

console.log("\n--- id ile getirme ---");
kurulum({});
bul=await sentencesByIds(["s5","s1","YOK"]);
ok(bul.length===2, "olmayan id sessizce atlanıyor");
ok(bul[0].id==="s5" && bul[1].id==="s1", "istenen SIRA korunuyor (vade sırası bozulmamalı)");

console.log("\n--- ASIL TEST: vadesi gelenler eskiyle aynı mı ---");
const now=Date.now();
const srs={ s1:{rep:2,due:now-5000}, s2:{rep:0,due:now-9000},   // rep=0 -> sayılmaz
            s3:{rep:1,due:now-1000}, s4:{rep:4,due:now+99999},  // gelecek -> sayılmaz
            s5:{rep:3,due:now-7000}, s6:{rep:1,due:now} };
/* ESKİ yol: 9417 cümlenin tamamını tara */
const tum=Object.values(VERI).flat();
const eski=tum.filter(s=>{const r=srs[s.id];return r&&(r.due||0)<=now&&r.rep>0;})
              .sort((a,b)=>(srs[a.id].due||0)-(srs[b.id].due||0)).map(s=>s.id);
/* YENİ yol: SRS anahtarlarından */
kurulum(srs);
const yeniIds=Object.keys(State.srs)
  .filter(id=>{const r=State.srs[id];return r&&(r.due||0)<=now&&r.rep>0;})
  .sort((a,b)=>(State.srs[a].due||0)-(State.srs[b].due||0));
const yeni=(await sentencesByIds(yeniIds)).map(s=>s.id);
ok(JSON.stringify(eski)===JSON.stringify(yeni),
   `aynı liste, aynı sıra: [${yeni.join(", ")}]`);
ok(eski.length===4, "rep=0 ve gelecek vadeliler ikisinde de dışarıda");

console.log(fail===0?"\nSONUÇ: tüm testler geçti ✓\n":`\nSONUÇ: ${fail} başarısız ✗\n`);
process.exit(fail?1:0);
