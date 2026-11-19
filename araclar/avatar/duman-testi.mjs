import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/usr/bin/google-chrome', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8768/index.html').catch(()=>{}); await p.addScriptTag({url:'http://localhost:8768/viseme-lang.js?v=3'}); await p.addScriptTag({url:'http://localhost:8768/dh-canli-yuz.js?v=11'});
const r = await p.evaluate(async()=>{ const c=document.createElement('canvas'); document.body.appendChild(c); const y=DHCanliYuz.olustur(c,{yol:'http://localhost:8768/assets/avatars_v4/teacher/'}); await y.hazir; await new Promise(r=>setTimeout(r,1200));
 const out={}; for(const d of ['mutlu','saskin']){ y.duygu(d,1); await new Promise(r=>setTimeout(r,700)); const seen=new Set(); y.konus([{metin:'Sessiz sesler: çok şık, kedi gitti, nane.',sessiz:true,sureMs:3000,duygu:d,dil:'tr'}]); for(let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,75)); const a=y.durum().agiz; seen.add(typeof a==='object'?JSON.stringify(a):a); } out[d]=[...seen].join(','); } return out; });
console.log(JSON.stringify(r,null,1)); console.log('errs',errs); await b.close();
