/* index-app-layout.js — DÜZEN TOPARLAYICI (v12 — Çakışma Önleyici Tam Ekran Sürümü)
   1) Yatay modda İngilizce ve Türkçe metinler resmin üzerine bindirildi; butonların kapanması engellendi.
   2) Öğretmen ve Zayıf Analiz ana ekranda CSS ile tamamen gizlendi (Sonsuz döngü bitti).
   3) Araçlar panelinde sabit tetikleyiciler oluşturuldu, mükerrer buton üretimi engellendi.
   4) Mobil yatay modda (Landscape) 0-Scroll (Kaydırmasız) tam ekran düzeni sağlandı.
*/
(function(){
  "use strict";
  var STYLE_ID="dh-ia-layout-css";
  var applying=false, scheduled=false;

  function addStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var s=document.createElement("style"); s.id=STYLE_ID;
    s.textContent =
     ".legend,.legend-item,.legend-dot{display:none !important}"
    /* YATAY (landscape) modda üst modül barı + ilerleme çubuğu gizli; dikeyde görünür */
    +"@media (orientation:landscape){.study-header,.study-progress{display:none !important}}"
    +".study-nav .legend,.study-nav .legend-item{display:none !important}"
    
    /* Ana arayüzdeki Öğretmen ve Zayıf Analiz butonlarını alan kaplamayacak şekilde KESİN GİZLE */
    +".card-actions .teacher-btn, .card-actions .extra-weak, button.teacher-btn, button.extra-weak { display:none !important; width:0 !important; height:0 !important; margin:0 !important; padding:0 !important; overflow:hidden !important; position:absolute !important; pointer-events:none !important; }"
    
    /* ---- 2 SÜTUN DÜZEN ---- */
    +".dh-col-left,.dh-col-right{display:block}"
+"@media (orientation:landscape),(min-width:680px){"
+".card.dh-split{display:grid !important;grid-template-columns:1.4fr 1fr;gap:14px 16px;align-items:start}"
+".card.dh-split>*{grid-column:1;min-width:0}"
+".card.dh-split>.dh-col-right{grid-column:2;grid-row:1/99;display:flex;flex-direction:column;gap:6px;align-self:start;margin-top:0 !important}"
+".card.dh-split .sm-img-wrap{margin:6px 0}"
+".card.dh-split .dh-grade-under{flex-direction:row !important;gap:4px !important;margin:0;width:100%;box-sizing:border-box}"
+".card.dh-split .dh-grade-under button{flex:1 !important;min-height:32px !important;padding:4px 2px !important;font-size:12px !important;border-radius:8px !important;white-space:nowrap;overflow:hidden}"
+".card.dh-split .card-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}"
+".card.dh-split .card-actions button{min-height:32px !important;padding:6px 10px !important;font-size:12px !important;border-radius:9px !important}"
+"}"
    /* ---- YATAY MOBİL: TEK EKRANA SIĞDIR (KAYDIRMA YOK - TAM EKRAN MODU) ---- */
    +"@media (orientation:landscape) and (max-width:767px){"
    +".study-header, .study-progress, .study-header *, [class*='header'], :has(> .btn:contains('Liste')){display:none !important}"
    +"body, html {overflow:hidden !important; height:100vh !important; max-height:100vh !important; padding:0 !important; margin:0 !important; background:#040a18 !important;}"
    +".study-main{padding:6px !important; margin:0 !important; height:100vh !important; display:flex !important; align-items:center !important; justify-content:center !important; box-sizing:border-box !important;}"
    
    /* Ana Kartı Tam Ekran Yap */
    +".card.dh-split{width:100vw !important; height:96vh !important; max-height:96vh !important; padding:8px !important; gap:8px 12px !important; margin:0 !important; box-sizing:border-box !important; overflow:hidden !important; grid-template-columns:1.3fr 1fr !important; align-items:stretch !important;}"
    
    /* SOL SÜTUN: Resim Sarıcı Konumlandırması */
    +".card.dh-split .sm-img-wrap{grid-row:1/3 !important; grid-column:1 !important; margin:0 !important; height:100% !important; position:relative !important; display:flex !important; flex-direction:column !important;}"
    +".card.dh-split .sm-img-wrap img, .card.dh-split .sm-img{height:100% !important; max-height:100% !important; width:100% !important; object-fit:cover !important; display:block !important; border-radius:10px !important;}"
    
    /* İngilizce Cümle (Resmin Altına Katman Olarak Bindirme) */
    +".card.dh-split .card-en{position:absolute !important; bottom:28px !important; left:0 !important; right:0 !important; z-index:5 !important; margin:0 !important; padding:6px 10px !important; background:rgba(4,10,24,.80) !important; backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); border-radius:0 !important; font-size:15px !important; line-height:1.2 !important; text-align:center !important; width:100% !important; box-sizing:border-box !important;}"
    
    /* Türkçe Anlam (Resmin En Altına Şerit Olarak Bindirme - Düğmeleri Kapatması Engellendi) */
    +".card.dh-split .card-tr{position:absolute !important; bottom:0 !important; left:0 !important; right:0 !important; z-index:5 !important; margin:0 !important; padding:4px 10px !important; background:rgba(10,25,50,.90) !important; color:#9fb3d9 !important; border-radius:0 0 10px 10px !important; font-size:12px !important; line-height:1.2 !important; text-align:center !important; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100% !important; box-sizing:border-box !important; grid-row:auto !important; grid-column:auto !important;}"
    
    /* Yer kazanmak için gereksiz alanları uçur */
    +".card.dh-split .card-pron{display:none !important;}" 
    +".card.dh-split .dh-gtr-btn{display:none !important;}"
    
    /* SAĞ SÜTUN: Buton Alanı */
    +".card.dh-split .dh-col-right{grid-column:2 !important; grid-row:1/3 !important; display:flex !important; flex-direction:column !important; justify-content:space-between !important; height:100% !important; gap:4px !important; margin:0 !important; overflow:hidden !important;}"
    
    /* Zor-Normal-Kolay Grubu */
    +".card.dh-split .dh-grade-under{margin:0 !important; gap:4px !important; display:flex !important; order:1 !important;}"
    +".card.dh-split .dh-grade-under button{min-height:30px !important; padding:2px !important; font-size:11px !important; border-radius:6px !important;}"
    
    /* Diğer Aksiyon Butonları Alanı (2 Sütun Düzen) */
    +".card.dh-split .card-actions{display:grid !important; grid-template-columns:1fr 1fr !important; gap:4px !important; margin:0 !important; padding:0 !important; order:2 !important;}"
    +".card.dh-split .card-actions button, .card.dh-split .card-actions .btn{min-height:30px !important; max-height:34px !important; padding:2px 4px !important; font-size:11px !important; border-radius:6px !important; margin:0 !important; display:flex !important; align-items:center !important; justify-content:center !important;}"
    
    /* Orijinal kalabalık butonları ez */
    +".card.dh-split .card-actions .teacher-btn, .card.dh-split .card-actions .extra-weak { display:none !important; }"
    
    /* Navigasyon Alt Barı (Önceki - Araçlar - Sonraki) En Altta Rahatça Kalacak */
    +".study-nav.dh-card-nav{margin:0 !important; padding:0 !important; gap:4px !important; order:3 !important; width:100% !important; display:flex !important;}"
    +".study-nav.dh-card-nav .btn{min-height:34px !important; font-size:12px !important; border-radius:8px !important; flex:1 !important;}"
    +".dh-tools-toggle{min-height:34px !important; padding:0 8px !important; border-radius:8px !important;}"
    
    /* Üst seviye etiketlerini gizle */
    +".card.dh-split > div:has(.chip-level), .card.dh-split div[class*='chip']{display:none !important}"
    +"}"
    /* Sağ sütun alt bar ayarları */
    +".study-nav.dh-card-nav{position:relative !important;display:flex !important;gap:6px;align-items:center;justify-content:space-between;margin:10px 0 0 !important;padding:0 !important;background:transparent !important;border-top:none !important;box-shadow:none !important;width:100%}"
    +".study-nav.dh-card-nav .btn{flex:1;min-height:40px;font-size:13px !important;font-weight:800 !important;border-radius:10px !important;padding:4px 8px !important}"
    +".study-nav.dh-card-nav > *:not(.btn):not(.dh-tools-toggle){flex:0 0 auto}"
    /* Kompakt Araçlar butonu */
    +".dh-tools-toggle{flex:0 0 auto !important;min-height:40px;padding:0 12px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:#17233a;color:#eaf2ff;font:900 13px Nunito,system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap}"
    +".dh-tools-toggle:hover{background:#22304f}"
    +".dh-tools-toggle .chev{transition:transform .2s;font-size:11px}"
    +".dh-tools-toggle.open .chev{transform:rotate(180deg)}"
    /* Varsayılan esnek grup yapısı */
    +".dh-grade-under{display:flex !important;flex-direction:row !important;gap:4px;margin:10px 0 4px;width:100%}"
    +".dh-gtr-btn{display:inline-flex;align-items:center;gap:6px;margin:8px 0 2px;padding:8px 14px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:#1a2942;color:#cfe0ff;font:800 13px Nunito,system-ui,sans-serif;cursor:pointer}"
    +".dh-gtr-btn:hover{background:#22344f}"
    +".dh-grade-under button{flex:1;min-height:38px;border-radius:10px;font-weight:800;font-size:13px;border:1px solid rgba(255,255,255,.14);cursor:pointer;padding:4px}"
    /* Araçlar paneli popup */
    +".dh-tools-box{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:8999;width:90%;max-width:400px;margin:0;padding:14px;max-height:50vh;overflow-y:auto;border-radius:16px;background:#0d1a30;border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 40px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:10px;animation:dhToolsUp .2s ease}"
    +"@keyframes dhToolsUp{from{transform:translate(-50%, 10px);opacity:.4}to{transform:translate(-50%, 0);opacity:1}}"
    +".dh-hidden{display:none !important}"
    +".dh-tools-box .dh-custom-btn{width:100%;min-height:42px;border-radius:10px;display:flex !important;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.15);font-weight:800;font-size:13px;cursor:pointer;background:#1e293b;color:#f8fafc;}"
    +".dh-tools-box .dh-custom-btn:hover{background:#334155}"
    +".dh-tools-box .wd-tools-row{margin-top:0 !important}"
    +".dh-tools-title{font:900 13px Nunito,system-ui,sans-serif;color:#9fb3d9;text-align:center;margin-bottom:2px}";
    document.head.appendChild(s);
  }

  function currentCard(){
    var cards=[].slice.call(document.querySelectorAll(".card"));
    return cards.find(function(c){ return c.querySelector(".card-en") && c.querySelector(".card-actions"); });
  }

  function btnByText(root, txt){
    var t=txt.toLocaleLowerCase("tr");
    return [].slice.call(root.querySelectorAll("button,a")).find(function(b){
      return (b.textContent||"").toLocaleLowerCase("tr").indexOf(t)>=0;
    })||null;
  }

  function fixNav(rightCol){
    var nav=document.querySelector(".study-nav");
    if(!nav) return null;
    if(!nav.classList.contains("dh-card-nav")) nav.classList.add("dh-card-nav");
    
    if(rightCol && nav.parentElement !== rightCol){
      rightCol.appendChild(nav);
    }
    return nav;
  }

  function moveGrade(card){
    if(card.dataset.dhGradeDone==="1") return;
    var tr=card.querySelector(".card-tr"); if(!tr) return;

    if(!card.querySelector(".dh-gtr-btn")){
      var en=card.querySelector(".card-en");
      if(en){
        var gb=document.createElement("button");
        gb.type="button"; gb.className="dh-gtr-btn";
        gb.innerHTML="🌐 Google Translate";
        gb.onclick=function(){
          var txt=(en.textContent||"").trim();
          if(!txt) return;
          function fallbackCopy(x){ try{ var ta=document.createElement("textarea"); ta.value=x; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }catch(e){} }
          try{ if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).catch(function(){ fallbackCopy(txt); }); } else { fallbackCopy(txt); } }catch(e){ fallbackCopy(txt); }
          try{
            var n=document.createElement("div");
            n.textContent="📋 Cümle kopyalandı — Translate'te yapıştır";
            n.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#0f1f3a;color:#fff;border:1px solid #2563eb;padding:12px 18px;border-radius:12px;font:700 13px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:90vw;text-align:center";
            document.body.appendChild(n);
            setTimeout(function(){ n.style.transition="opacity .4s"; n.style.opacity="0"; setTimeout(function(){ n.remove(); },400); },3000);
          }catch(e){}
          window.open("https://translate.google.com/?sl=en&tl=tr&op=translate&text="+encodeURIComponent(txt), "_blank");
        };
        tr.insertAdjacentElement("afterend", gb);
      }
    }
    var zor=card.querySelector(".grade-hard")||btnByText(card,"zor");
    var nor=card.querySelector(".grade-normal")||btnByText(card,"normal");
    var kol=card.querySelector(".grade-easy")||btnByText(card,"kolay");
    if(!(zor&&nor&&kol)) return;
    var grp=card.querySelector(".dh-grade-under");
    if(!grp){ grp=document.createElement("div"); grp.className="dh-grade-under"; }
    grp.appendChild(zor); grp.appendChild(nor); grp.appendChild(kol);
    var anchor=card.querySelector(".card-pron")||tr;
    anchor.insertAdjacentElement("afterend", grp);
    card.dataset.dhGradeDone="1";
  }

  function splitCard(card){
    if(card.dataset.dhSplitDone==="1") return card.querySelector(".dh-col-right");
    
    var enEl=card.querySelector(".card-en"); if(!enEl){ return null; }
    var grade=card.querySelector(".dh-grade-under");
    var actions=card.querySelector(".card-actions");
    if(!grade || !actions){ return null; }

    var right=card.querySelector(".dh-col-right");
    if(!right) {
      right = document.createElement("div");
      right.className="dh-col-right";
    }
    
    // "ne kadar biliyorsun" yazısını bul ve kaldır
    var q=[].slice.call(card.querySelectorAll("*")).find(function(e){
      return e.children.length===0 && /ne kadar biliyorsun/i.test(e.textContent||"");
    });
    if(q) { q.remove(); }
    
    right.appendChild(grade);
    right.appendChild(actions);
    
    card.appendChild(right);
    card.classList.add("dh-split");
    card.dataset.dhSplitDone="1";
    return right;
  }

  function ensureTools(card, nav){
    var box=document.getElementById("dhToolsBox");
    var toggle=document.getElementById("dhToolsToggle");
    
    if(!box){
      box=document.createElement("div");
      box.id="dhToolsBox"; box.className="dh-tools-box dh-hidden";
      box.innerHTML='<div class="dh-tools-title">🛠 Araçlar</div>';
      
      // Panel içine sonsuz döngüye girmeyen 1'er adet sabit tetikleyici buton ekle
      var btnTeacher = document.createElement("button");
      btnTeacher.className = "dh-custom-btn"; btnTeacher.innerHTML = "🎓 Öğretmen";
      btnTeacher.onclick = function(){
        var target = document.querySelector(".card .teacher-btn") || btnByText(document.querySelector(".card"), "öğretmen");
        if(target) target.click();
      };
      
      var btnWeak = document.createElement("button");
      btnWeak.className = "dh-custom-btn"; btnWeak.innerHTML = "📉 Zayıf Analiz";
      btnWeak.onclick = function(){
        var target = document.querySelector(".card .extra-weak") || btnByText(document.querySelector(".card"), "zayıf");
        if(target) target.click();
      };

      var btnDetay = document.createElement("button");
      btnDetay.className = "dh-custom-btn"; btnDetay.innerHTML = "🔍 Detay";
      btnDetay.onclick = function(){
        var target = btnByText(document.querySelector(".card"), "detay");
        if(target) target.click();
      };
      
      box.appendChild(btnTeacher);
      box.appendChild(btnWeak);
      box.appendChild(btnDetay);
      document.body.appendChild(box);
    }

    if(!toggle){
      toggle=document.createElement("button");
      toggle.id="dhToolsToggle"; toggle.type="button"; toggle.className="dh-tools-toggle";
      toggle.innerHTML='🛠 <span class="chev">▾</span>';
      toggle.onclick=function(){
        var hid=box.classList.toggle("dh-hidden");
        toggle.classList.toggle("open", !hid);
      };
    }
    
    if(nav && toggle.parentElement!==nav){
      var btns=[].slice.call(nav.querySelectorAll(".btn"));
      if(btns.length>=2){ nav.insertBefore(toggle, btns[btns.length-1]); }
      else nav.appendChild(toggle);
    }

    var grid=document.querySelector(".wd-tools-row");
    if(grid && grid.parentElement!==box){ box.appendChild(grid); }
  }

  function apply(){
    if(applying) return;
    applying=true;
    try{
      addStyle();
      var card=currentCard();
      var rightCol=null;
      if(card){ 
        moveGrade(card); 
        rightCol = splitCard(card);
      }
      var nav=fixNav(rightCol);
      ensureTools(card, nav);
    }catch(e){}
    applying=false;
  }

  function schedule(){
    if(scheduled) return;
    scheduled=true;
    setTimeout(function(){ scheduled=false; apply(); }, 150);
  }

  function boot(){
    apply();
    try{
      new MutationObserver(function(){ if(applying) return; schedule(); })
        .observe(document.body,{childList:true,subtree:true});
    }catch(e){}
    var n=0, t=setInterval(function brush(){ apply(); if(++n>12) clearInterval(t); }, 400);
  }
  if(document.readyState!=="loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();