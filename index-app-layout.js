/* index-app-layout.js — DÜZEN TOPARLAYICI (v9 — tam temizlik ve alan kazanımı)
   1) "Bu cümleyi ne kadar biliyorsun?" yazısı tamamen KALDIRILDI ve alan kazanıldı.
   2) Öğretmen ve Zayıf Analiz butonları ana ekrandan KESİN OLARAK SİLİNDİ (.remove() + CSS).
   3) Zor/Normal/Kolay → Yan yana (flex-row) kompakt düzende sığdırıldı.
   4) İleri/geri/araçlar (.study-nav) → Sağ sütunda en alta yerleştirildi.
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
    +".study-nav .legend,.study-nav .legend-item{display:none !important}"
    
    /* Ana ekrandaki Öğretmen, Zayıf Analiz butonlarını ve "ne kadar biliyorsun" yazılarını CSS ile KESİN ENGELEME */
    +".card-actions .teacher-btn, .card-actions .extra-weak, .teacher-btn, .extra-weak {display:none !important; opacity:0 !important; visibility:hidden !important; pointer-events:none !important}"
    
    /* Araçlar paneli içindeki klonların görünmesini garanti et */
    +".dh-tools-box .dh-moved-btn {display:flex !important; visibility:visible !important; opacity:1 !important}"
    
    /* ---- 2 SÜTUN DÜZEN ---- */
    +".dh-col-left,.dh-col-right{display:block}"
+"@media (orientation:landscape),(min-width:680px){"
+".card.dh-split{display:grid !important;grid-template-columns:1.5fr .9fr;gap:14px 16px;align-items:start}"
+".card.dh-split>*{grid-column:1;min-width:0}"
+".card.dh-split>.dh-col-right{grid-column:2;grid-row:1/99;display:flex;flex-direction:column;gap:6px;align-self:start;margin-top:0 !important}"
+".card.dh-split .sm-img-wrap{margin:6px 0}"
+".card.dh-split .dh-grade-under{flex-direction:row !important;gap:4px !important;margin:0;width:100%;box-sizing:border-box}"
+".card.dh-split .dh-grade-under button{flex:1 !important;min-height:32px !important;padding:4px 2px !important;font-size:12px !important;border-radius:8px !important;white-space:nowrap;overflow:hidden}"
+".card.dh-split .card-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}"
+".card.dh-split .card-actions button{min-height:32px !important;padding:6px 10px !important;font-size:12px !important;border-radius:9px !important}"
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
    +".dh-tools-box.dh-hidden{display:none !important}"
    +".dh-tools-box .dh-moved-btn{width:100%;min-height:42px;border-radius:10px;display:flex !important}"
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
    
    // "ne kadar biliyorsun" yazısını bul ve DOM'dan tamamen SİL
    var q=[].slice.call(card.querySelectorAll("*")).find(function(e){
      return e.children.length===0 && /ne kadar biliyorsun/i.test(e.textContent||"");
    });
    if(q) { q.remove(); }
    
    // Doğrudan Zor/Normal/Kolay ve diğer dinleme aksiyonlarını ekle
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

    if(card){
      var actions = card.querySelector(".card-actions");
      
      // Öğretmen Butonu Kontrolü
      var teacher=card.querySelector(".teacher-btn")||btnByText(card,"öğretmen");
      if(teacher && !/sor/i.test(teacher.textContent||"")){ 
        if(teacher.parentElement !== box && !box.querySelector(".teacher-btn")) {
          var tClone = teacher.cloneNode(true);
          tClone.className = "dh-moved-btn btn btn-primary";
          tClone.style.display = "flex";
          box.appendChild(tClone);
        }
        teacher.remove(); // Ana ekrandakini kesin imha et
      }
      
      // Öğretmene Sor Butonu Kontrolü
      var teacherAsk=[].slice.call(card.querySelectorAll("button,a")).find(function(b){
        return /öğretmene sor/i.test(b.textContent||"");
      });
      if(teacherAsk){ 
        if(teacherAsk.parentElement !== box && !btnByText(box, "öğretmene sor")) {
          var taClone = teacherAsk.cloneNode(true);
          taClone.className = "dh-moved-btn btn";
          taClone.style.display = "flex";
          box.appendChild(taClone);
        }
        teacherAsk.remove(); // Ana ekrandakini kesin imha et
      }
      
      // Detay Butonu Kontrolü
      var detay=btnByText(card,"detay");
      if(detay){ 
        if(detay.parentElement !== box && !btnByText(box, "detay")) {
          var dClone = detay.cloneNode(true);
          dClone.className = "dh-moved-btn btn";
          dClone.style.display = "flex";
          box.appendChild(dClone);
        }
        detay.remove();
      }
      
      // Zayıf Analiz Butonu Kontrolü
      var weak=card.querySelector(".extra-weak")||btnByText(card,"zayıf");
      if(weak){ 
        if(weak.parentElement !== box && !box.querySelector(".extra-weak")) {
          var wClone = weak.cloneNode(true);
          wClone.className = "dh-moved-btn btn btn-warning";
          wClone.style.display = "flex";
          box.appendChild(wClone);
        }
        weak.remove(); // Ana ekrandakini kesin imha et
      }

      // Sitenin MutationObserver ile sonradan üretebileceği kalıntıları döngüyle temizle
      if (actions) {
        [].slice.call(actions.querySelectorAll("button, a")).forEach(function(btn){
          var txt = (btn.textContent || "").toLowerCase();
          if (txt.indexOf("öğretmen") >= 0 || txt.indexOf("zayıf") >= 0 || txt.indexOf("detay") >= 0) {
            btn.remove();
          }
        });
      }
      card.dataset.dhToolsFilled="1";
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
    var n=0, t=setInterval(function(){ apply(); if(++n>12) clearInterval(t); }, 400);
  }
  if(document.readyState!=="loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();