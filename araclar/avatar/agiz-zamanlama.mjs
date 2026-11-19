import fs from 'fs'; import vm from 'vm';
const ctx={}; ctx.window=ctx; ctx.globalThis=ctx; ctx.console=console; vm.createContext(ctx);
vm.runInContext(fs.readFileSync((process.argv[3]||'viseme-lang.js'),'utf8'),ctx);
const src=fs.readFileSync(process.argv[2]||'dh-canli-yuz.js','utf8');
const a=src.indexOf('  var ONEM ='), b=src.indexOf('  var sinirVar = false;');
vm.runInContext(src.slice(a,b)+'; window.agizDuzen=agizDuzen;',ctx);
for (const metin of ['Düzenledi.','Merhaba, bugün sana nasıl yardımcı olabilirim? Bu akşam bir kitap okumak ister misin?','Hello, how are you today? Let us practise some useful phrases.']) {
  const dil=/Hello/.test(metin)?'en':'tr'; const sh=ctx.DHViseme.shapes(metin,dil); const d=sh.map(x=>x.shape||x); d.ci=sh.map(x=>x.ci||0); const km=metin.length*62/d.length;
  const r=ctx.agizDuzen(d,km); let deg=0; for(let i=1;i<r.dizi.length;i++) if(r.dizi[i]!==r.dizi[i-1]) deg++;
  let seq=[],son=null; r.dizi.forEach(x=>{if(x!==son){seq.push(x);son=x;}});
  console.log((deg/(r.dizi.length*r.kareMs/1000)).toFixed(1)+'/sn km='+km.toFixed(0)+' :: '+d.join(' ')+'\n  -> '+seq.join(' '));
}
