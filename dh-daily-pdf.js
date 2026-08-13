/* dh-daily-pdf.js - Bugunun ve yarinin istege bagli calisma PDF'leri */
(function (global) {
  "use strict";
  if (global.DHDailyPdf) return;

  function iso(d) {
    var x=d||new Date();
    return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");
  }
  function esc(s) {
    return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});
  }
  function read(key, fallback) {
    try { var v=JSON.parse(localStorage.getItem(key)||"null"); return v==null?fallback:v; } catch(e){ return fallback; }
  }
  function dayData(day) {
    var tracker=read("dh-study-tracker-v1",{})||{};
    return (tracker.days&&tracker.days[day])||{};
  }
  function plan(day) {
    return read("dh-gun-plan-"+day,null)||{adimlar:[]};
  }
  function openDb() {
    return new Promise(function(resolve){
      try { var r=indexedDB.open("sentence-mode",1); r.onsuccess=function(){resolve(r.result);}; r.onerror=function(){resolve(null);}; }
      catch(e){resolve(null);}
    });
  }
  function dueUntil(end) {
    return openDb().then(function(db){
      if(!db||!db.objectStoreNames.contains("kv"))return [];
      return new Promise(function(resolve){
        var out=[];
        try{
          var q=db.transaction("kv","readonly").objectStore("kv").openCursor();
          q.onsuccess=function(e){var c=e.target.result;if(!c){try{db.close();}catch(_){}return resolve(out);}
            var k=String(c.key),v=c.value||{};
            if((k.indexOf("srs:")===0||k.indexOf("wsrs:")===0)&&Number(v.due||0)<=end)out.push({key:k,due:Number(v.due||0)});
            c.continue();};
          q.onerror=function(){try{db.close();}catch(_){}resolve(out);};
        }catch(e){try{db.close();}catch(_){}resolve(out);}
      });
    });
  }
  function li(text, meta) {
    return '<li><span>'+esc(text)+'</span>'+(meta?'<b>'+esc(meta)+'</b>':'')+'</li>';
  }
  function planRows(items) {
    if(!items||!items.length)return '<p class="empty">Henüz günlük plan oluşturulmadı.</p>';
    return '<ul class="tasks">'+items.map(function(a){
      var hedef=Math.max(1,Number(a.hedef)||1),yap=Math.min(hedef,Number(a.yapilan)||0);
      return li(a.etiket||a.label||a.tip||"Çalışma",yap+" / "+hedef);
    }).join('')+'</ul>';
  }
  function chips(arr) {
    return arr&&arr.length?'<div class="chips">'+arr.map(function(x){return '<span>'+esc(x)+'</span>';}).join('')+'</div>':'<p class="empty">Kayıt yok.</p>';
  }
  function shell(title,date,body,note) {
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'
      +'@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#14213d;font:14px/1.48 Arial,"Segoe UI",sans-serif;background:#fff}'
      +'.head{padding:20px 22px;border-radius:16px;background:linear-gradient(135deg,#0f766e,#2563eb);color:#fff;margin-bottom:16px}.head h1{margin:0 0 4px;font-size:25px}.head p{margin:0;opacity:.88}'
      +'.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:12px 0}.metric,.box{border:1px solid #cbd5e1;border-radius:12px;padding:12px;break-inside:avoid}.metric b{display:block;font-size:22px;color:#0f766e}.metric span{font-size:11px;color:#64748b}'
      +'h2{font-size:16px;color:#1d4ed8;margin:18px 0 8px}.tasks{list-style:none;padding:0;margin:0}.tasks li{display:flex;justify-content:space-between;gap:12px;padding:8px 4px;border-bottom:1px solid #e2e8f0}.tasks b{white-space:nowrap;color:#0f766e}'
      +'.chips{display:flex;flex-wrap:wrap;gap:6px}.chips span{padding:5px 9px;border-radius:99px;background:#e0f2fe;border:1px solid #7dd3fc;font-size:11px}.empty{color:#64748b;font-style:italic}'
      +'.note{margin-top:18px;padding:10px 12px;border-radius:10px;background:#f1f5f9;color:#475569;font-size:11px}.foot{text-align:center;color:#94a3b8;font-size:10px;margin-top:18px}'
      +'@media print{button{display:none!important}.box{break-inside:avoid}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>'
      +'<header class="head"><h1>'+esc(title)+'</h1><p>'+esc(date)+' · Dil Harita kişisel çalışma dosyası</p></header>'+body
      +'<div class="note">'+esc(note)+'</div><div class="foot">Oluşturulma: '+esc(new Date().toLocaleString("tr-TR"))+'</div>'
      +'<script>setTimeout(function(){window.print()},350)<\/script></body></html>';
  }
  function show(html) {
    var w=global.open("","_blank");
    if(!w){alert("PDF önizlemesi için açılır pencereye izin verin.");return false;}
    w.document.open();w.document.write(html);w.document.close();return true;
  }
  async function todayPdf() {
    var day=iso(),d=dayData(day),p=plan(day),h=null;
    try{if(global.DHGunSonu&&DHGunSonu.topla)h=await DHGunSonu.topla();}catch(e){}
    h=h||{cumleler:[],kaliplar:[],kelimeler:[]};
    var body='<div class="grid"><div class="metric"><b>'+(d.sentences||0)+'</b><span>CÜMLE</span></div><div class="metric"><b>'+(d.reviews||0)+'</b><span>TEKRAR</span></div><div class="metric"><b>'+(d.lessons||0)+'</b><span>DERS</span></div></div>'
      +'<section class="box"><h2>Bugünün planı ve gerçekleşenler</h2>'+planRows(p.adimlar)+'</section>'
      +'<section class="box"><h2>Çalışılan cümleler</h2>'+chips((h.cumleler||[]).map(function(c){return c.en;}))+'</section>'
      +'<section class="box"><h2>Kalıplar</h2>'+chips(h.kaliplar||[])+'</section>'
      +'<section class="box"><h2>Kelimeler</h2>'+chips(h.kelimeler||[])+'</section>';
    show(shell("Bugünün Çalışma PDF'i",day,body,"Bu belge mevcut cihazdaki gerçek günlük plan ve tarihli çalışma kayıtlarından hazırlanmıştır."));
  }
  async function tomorrowPdf() {
    var t=new Date();t.setDate(t.getDate()+1);var day=iso(t),end=new Date(t);end.setHours(23,59,59,999);
    var due=await dueUntil(end.getTime()),review=Math.min(15,due.length);
    var current=plan(iso()).adimlar||[], unfinished=current.filter(function(a){return Number(a.yapilan||0)<Math.max(1,Number(a.hedef)||1);});
    var suggested=[
      {etiket:"Vadesi gelen tekrarlar (SRS)",hedef:review||10,yapilan:0},
      {etiket:"Yeni cümle çalışması",hedef:5,yapilan:0},
      {etiket:"Öğrendiklerini üret",hedef:3,yapilan:0},
      {etiket:"1 dakika konuş",hedef:1,yapilan:0},
      {etiket:"Hata defterini çalış",hedef:1,yapilan:0}
    ];
    var carry=unfinished.map(function(a){return (a.etiket||a.label||a.tip||"Çalışma")+" - "+Math.max(0,(Number(a.hedef)||1)-(Number(a.yapilan)||0))+" kaldı";});
    var body='<div class="grid"><div class="metric"><b>'+due.length+'</b><span>YARINA KADAR VADESİ GELEN</span></div><div class="metric"><b>'+review+'</b><span>ÖNERİLEN TEKRAR</span></div><div class="metric"><b>10-20</b><span>DAKİKA</span></div></div>'
      +'<section class="box"><h2>Yarının önerilen çalışma planı</h2>'+planRows(suggested)+'</section>'
      +'<section class="box"><h2>Bugünden kalan odaklar</h2>'+chips(carry)+'</section>'
      +'<section class="box"><h2>Uygulama sırası</h2><ul class="tasks">'+li("Önce vadesi gelen tekrarları tamamla","1")+li("Yeni cümleleri öğren ve sesli oku","2")+li("Üç cümleyi kendin üret","3")+li("Konuşma ve hata telafisiyle bitir","4")+'</ul></section>';
    show(shell("Yarının Çalışma PDF'i",day,body,"Bu bir ön plandır. Yarının kesin SRS kuyruğu ve kişisel planı uygulama açıldığında güncel verilere göre yeniden hesaplanır."));
  }
  global.DHDailyPdf={today:todayPdf,tomorrow:tomorrowPdf,_shell:shell,_dueUntil:dueUntil};
})(window);
