/* index-app-layout.js — DÜZEN TOPARLAYICI (v3 — döngü-güvenli)
   1) İleri/geri (.study-nav) → altta SABİT çubuk
   2) Zor/Normal/Kolay → cümlenin Türkçesinin (.card-tr) ALTINA
   3) Detay + Zayıf Analiz + Öğretmen + 9'lu ızgara → "🛠 Araçlar" paneline (gizli)
*/
(function(){
  "use strict";
  var STYLE_ID="dh-ia-layout-css";
  var applying=false;      // kendi DOM değişikliğimizi observer'da yok say
  var scheduled=false;     // debounce

  function addStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var s=document.createElement("style"); s.id=STYLE_ID;
    s.textContent =
    "body{padding-bottom:78px !important}"
    +".study-nav.dh-fixed-nav{position:fixed !important;left:0;right:0;bottom:0;z-index:9000;display:flex !important;gap:10px;align-items:center;justify-content:space-between;margin:0 !important;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(9,15,28,.96);backdrop-filter:blur(10px);border-top:1px solid rgba(255,255,255,.10);box-shadow:0 -8px 30px rgba(0,0,0,.4)}"
    +".study-nav.dh-fixed-nav .btn{flex:1;min-height:48px;font-size:15px !important;font-weight:800 !important;border-radius:14px !important}"
    +".study-nav.dh-fixed-nav > *:not(.btn){flex:0 0 auto}"
    +".dh-grade-under{display:flex !important;gap:8px;margin:10px 0 4px}"
    +".dh-grade-under button{flex:1;min-height:44px;border-radius:12px;font-weight:800;font-size:14px;border:1px solid rgba(255,255,255,.14);cursor:pointer}"
    +".dh-tools-toggle{width:100%;margin-top:12px;min-height:50px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:#17233a;color:#eaf2ff;font:900 15px Nunito,system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}"
    +".dh-tools-toggle:hover{background:#22304f}"
    +".dh-tools-toggle .chev{transition:transform .2s}"
    +".dh-tools-toggle.open .chev{transform:rotate(180deg)}"
    +".dh-tools-box{margin-top:10px;padding:12px;border-radius:16px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.10);display:flex;flex-direction:column;gap:10px}"
    +".dh-tools-box.dh-hidden{display:none !important}"
    +".dh-tools-box .dh-moved-btn{width:100%}"
    +".dh-tools-box .wd-tools-row{margin-top:0 !important}";
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
  function fixNav(){
    var nav=document.querySelector(".study-nav");
    if(nav && !nav.classList.contains("dh-fixed-nav")) nav.classList.add("dh-fixed-nav");
  }
  function moveGrade(card){
    // kart zaten işlendiyse çık (döngüyü kes)
    if(card.dataset.dhGradeDone==="1") return;
    var tr=card.querySelector(".card-tr"); if(!tr) return;
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
  function foldTools(card){
    if(card.dataset.dhToolsDone==="1"){
      // sadece ızgara sonradan geldiyse ekle
      var g=document.querySelector(".wd-tools-row");
      var b=card.querySelector(".dh-tools-box");
      if(g && b && g.parentElement!==b) b.appendChild(g);
      return;
    }
    var box=document.createElement("div"); box.className="dh-tools-box dh-hidden";
    var toggle=document.createElement("button");
    toggle.type="button"; toggle.className="dh-tools-toggle";
    toggle.innerHTML='🛠 Araçlar <span class="chev">▾</span>';
    toggle.onclick=function(){ var hid=box.classList.toggle("dh-hidden"); toggle.classList.toggle("open", !hid); };
    card.appendChild(toggle); card.appendChild(box);

    var teacher=card.querySelector(".teacher-btn")||btnByText(card,"öğretmen");
    if(teacher && !/sor/i.test(teacher.textContent||"")){ teacher.classList.add("dh-moved-btn"); box.appendChild(teacher); }
    var detay=btnByText(card,"detay");
    if(detay){ detay.classList.add("dh-moved-btn"); box.appendChild(detay); }
    var weak=card.querySelector(".extra-weak")||btnByText(card,"zayıf");
    if(weak){ weak.classList.add("dh-moved-btn"); box.appendChild(weak); }
    var grid=document.querySelector(".wd-tools-row");
    if(grid){ box.appendChild(grid); }
    card.dataset.dhToolsDone="1";
  }
  function apply(){
    if(applying) return;
    applying=true;
    try{
      addStyle(); fixNav();
      var card=currentCard();
      if(card){ moveGrade(card); foldTools(card); }
    }catch(e){}
    applying=false;
  }
  function schedule(){
    if(scheduled) return;
    scheduled=true;
    setTimeout(function(){ scheduled=false; apply(); }, 150);  // debounce
  }
  function boot(){
    apply();
    try{
      new MutationObserver(function(){
        if(applying) return;   // kendi değişikliğimiz → yok say
        schedule();            // debounce'lu tetik
      }).observe(document.body,{childList:true,subtree:true});
    }catch(e){}
    // ilk render için birkaç kez dene, sonra dur (sonsuz değil)
    var n=0, t=setInterval(function(){ apply(); if(++n>12) clearInterval(t); }, 400);
  }
  if(document.readyState!=="loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
