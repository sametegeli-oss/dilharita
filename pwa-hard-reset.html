<!doctype html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dil Harita Temizleme</title>
<style>
body{margin:0;background:#0b1120;color:#e8eef7;font-family:system-ui,sans-serif;min-height:100vh;display:grid;place-items:center}
.box{max-width:620px;margin:20px;padding:22px;background:#111827;border:1px solid #ffffff22;border-radius:18px;line-height:1.6}
button,a{display:inline-block;margin:8px 8px 0 0;background:#2563eb;color:#fff;border:0;border-radius:10px;padding:11px 14px;text-decoration:none;font-weight:800}
button.red{background:#dc2626}
pre{background:#0005;padding:10px;border-radius:10px;white-space:pre-wrap;max-height:260px;overflow:auto}
</style>
</head>
<body>
<div class="box">
<h2>Dil Harita önbellek temizleme</h2>
<button onclick="clearCaches()">SW + Cache temizle</button>
<button class="red" onclick="backupAndClearLocal()">LocalStorage yedekle ve temizle</button>
<a href="./index.html">Ana menüye dön</a>
<pre id="log">Hazır.</pre>
</div>
<script>
const log = m => document.getElementById('log').textContent += "\n" + m;
async function clearCaches(){
  try{
    if('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      for(const r of regs){ await r.unregister(); log('SW silindi: ' + (r.scope||'')); }
    }
    if(window.caches){
      const keys = await caches.keys();
      for(const k of keys){ await caches.delete(k); log('Cache silindi: ' + k); }
    }
    log('Bitti. index.html aç ve Ctrl+F5 yap.');
  }catch(e){ log('Hata: ' + e); }
}
function backupAndClearLocal(){
  try{
    const data={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      data[k]=localStorage.getItem(k);
    }
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='dilharita-localstorage-yedek.json';
    a.click();
    localStorage.clear();
    log('LocalStorage yedeklendi ve temizlendi.');
  }catch(e){ log('Hata: '+e); }
}
</script>
</body>
</html>
