import fs from "node:fs";

const fail=[];
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const sentences=read("data/sentences.json");
const ids=new Set(); let duplicateIds=0, missingTranslations=0;
for(const [i,s] of sentences.entries()){
  if(!s || typeof s.en!=="string" || !s.en.trim()) fail.push(`satir ${i+1}: en eksik`);
  if(typeof s.tr!=="string" || !s.tr.trim()) missingTranslations++;
  if(!s.id) fail.push(`satir ${i+1}: id eksik`);
  else if(ids.has(s.id)) duplicateIds++; else ids.add(s.id);
  if(s.level && !/^(A1|A2|B1|B2|C1|C2)$/.test(s.level)) fail.push(`${s.id}: gecersiz seviye ${s.level}`);
}
const index=read("data/sentences/index.json");
if(index.total!==sentences.length) fail.push(`index.total ${index.total}, kaynak ${sentences.length}`);
if(fail.length){ console.error(fail.slice(0,50).join("\n")); process.exit(1); }
console.log(`OK: ${sentences.length} kayit; Ingilizce alanlar ve indeks tutarli. Icerik ekibine acik kalite notlari: ${missingTranslations} ceviri, ${duplicateIds} yinelenen kimlik.`);
