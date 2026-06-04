const CACHE='dil-haritasi-clean-v2-20260604';
const ASSETS=['./','./index.html','./css/style.css','./js/app.js','./data/cumleler.xlsx','./data/sozluk.json','./manifest.webmanifest'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=e.request.url;if(/\.(html|js|css|xlsx|json|webmanifest)$/i.test(u)||u.endsWith('/'))e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));});
