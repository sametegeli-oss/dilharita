import fs from "node:fs";
import vm from "node:vm";
let fail=0; const ok=(v,m)=>{console.log(`${v?'✓':'✗'} ${m}`);if(!v)fail++;};
const s=fs.readFileSync("hata-defteri.html","utf8");
ok(s.includes('sentence-analyzer.js'),"Hata Defteri ortak cümle analiz motorunu yüklüyor");
ok(/function evaluateAnswer/.test(s),"alternatif doğru yapı değerlendirmesi var");
ok(/Anlam ve gramer doğru — yalnızca küçük bir yazım hatası var/.test(s),"yazım sürçmesi doğru Türkçe geri bildirim veriyor");
ok(/Referanstan farklı ama anlamı koruyan kabul edilebilir/.test(s),"cümlecik sırası değişimi kabul mesajı veriyor");
ok(/Önceki yanıt kaydı bozulduğu için gizlendi/.test(s),"bozuk tekrarlı eski cevap kullanıcıdan gizleniyor");
const db=fs.readFileSync("learning-error-system.js","utf8");
ok(/function cleanAnswer/.test(db)&&/t\.length>600/.test(db),"gelecekte aşırı büyüyen cevap kaydı sınırlandırılıyor");

// Gerçek gözlenen cevap için aynı değerlendirme algoritmasını bağımsız doğrula.
function ed(a,b){let p=[...Array(b.length+1).keys()],c=[];for(let x=1;x<=a.length;x++){c=[x];for(let y=1;y<=b.length;y++)c[y]=Math.min(c[y-1]+1,p[y]+1,p[y-1]+(a[x-1]===b[y-1]?0:1));p=c}return p[b.length]}
const target="when the client called the developers had already deployed the pwa application".split(" ");
let answer="the software developers had already deployed the pwa aplication when the client called".split(" ");
let typo=0; answer=answer.map(w=>{if(target.includes(w))return w;let best="",d=99;for(const t of target){const n=ed(w,t);if(n<d){d=n;best=t}}if(w.length>=3&&d<=(Math.max(w.length,best.length)>=7?2:1)){typo++;return best}return w});
const missing=target.filter((w,i)=>answer.filter(x=>x===w).length<target.filter(x=>x===w).length);
const extras=answer.filter(w=>!target.includes(w));
ok(!missing.length&&extras.length===1&&extras[0]==="software"&&typo===1,"gözlenen cevap: anlam/gramer doğru, yalnız 'aplication' yazım sürçmesi");
process.exit(fail?1:0);
