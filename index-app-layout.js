/* index-app-layout.js — DÜZEN TOPARLAYICI (v4 — döngü-güvenli)
   1) İleri/geri (.study-nav) → altta SABİT çubuk
   2) "🛠 Araçlar" butonu → Önceki ile Sonraki ARASINA (alt çubukta)
   3) Zor/Normal/Kolay → cümlenin Türkçesinin (.card-tr) ALTINA
   4) Detay + Zayıf Analiz + Öğretmen + 9'lu ızgara → Araçlar panelinde (alttan açılır)
*/
(function(){
  "use strict";
  var STYLE_ID="dh-ia-layout-css";
  var applying=false, scheduled=false;

  function addStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var s=document.createElement("style"); s.id=STYLE_ID;
    s.textContent =
    "body{padding-bottom:78px !important}"
    +".legend{display:none !important}"
    +".study-nav.dh-fixed-nav{position:fixed !important;left:0;right:0;bottom:0;z-index:9000;display:flex !important;gap:8px;align-items:center;justify-content:space-between;margin:0 !important;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(9,15,28,.96);backdrop-filter:blur(10px);border-top:1px solid rgba(255,255,255,.10);box-shadow:0 -8px 30px rgba(0,0,0,.4)}"
    +".study-nav.dh-fixed-nav .btn{flex:1;min-height:48px;font-size:15px !important;font-weight:800 !important;border-radius:14px !important}"
    +".study-nav.dh-fixed-nav > *:not(.btn):not(.dh-tools-toggle){flex:0 0 auto}"
    /* Araçlar butonu: nav ortasında, kompakt */
    +".dh-tools-toggle{flex:0 0 auto !important;min-height:48px;padding:0 16px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:#17233a;color:#eaf2ff;font:900 14px Nunito,system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}"
    +".dh-tools-toggle:hover{background:#22304f}"
    +".dh-tools-toggle .chev{transition:transform .2s;font-size:11px}"
    +".dh-tools-toggle.open .chev{transform:rotate(180deg)}"
    +".dh-grade-under{display:flex !important;gap:8px;margin:10px 0 4px}"
    +".dh-grade-under button{flex:1;min-height:44px;border-radius:12px;font-weight:800;font-size:14px;border:1px solid rgba(255,255,255,.14);cursor:pointer}"
    /* Araçlar paneli: alt çubuğun ÜSTÜNDE açılan sabit kayan panel */
    +".dh-tools-box{position:fixed;left:0;right:0;bottom:70px;z-index:8999;margin:0;padding:14px;max-height:60vh;overflow-y:auto;border-radius:18px 18px 0 0;background:#0d1a30;border-top:1px solid rgba(255,255,255,.12);box-shadow:0 -10px 40px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:10px;animation:dhToolsUp .2s ease}"
    +"@keyframes dhToolsUp{from{transform:translateY(20px);opacity:.4}to{transform:none;opacity:1}}"
    +".dh-tools-box.dh-hidden{display:none !important}"
    +".dh-tools-box .dh-moved-btn{width:100%;min-height:46px;border-radius:12px}"
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
  function fixNav(){
    var nav=document.querySelector(".study-nav");
    if(nav && !nav.classList.contains("dh-fixed-nav")) nav.classList.add("dh-fixed-nav");
    return nav;
  }
  function moveGrade(card){
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
  // Araçlar butonu (nav ortasına) + panel (body'de sabit)
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
    // toggle'ı nav'da Önceki ile Sonraki ARASINA koy
    if(nav && toggle.parentElement!==nav){
      var btns=[].slice.call(nav.querySelectorAll(".btn"));
      // ilk .btn = Önceki, son .btn = Sonraki → ortaya ekle
      if(btns.length>=2){ nav.insertBefore(toggle, btns[btns.length-1]); }
      else nav.appendChild(toggle);
    }
    // içerikleri panele taşı (bir kez)
    if(card && card.dataset.dhToolsFilled!=="1"){
      // Öğretmen (sor olmayan) → araçlara
      var teacher=card.querySelector(".teacher-btn")||btnByText(card,"öğretmen");
      if(teacher && !/sor/i.test(teacher.textContent||"")){ teacher.classList.add("dh-moved-btn"); box.appendChild(teacher); }
      // Öğretmene Sor → araçlara
      var teacherAsk=[].slice.call(card.querySelectorAll("button,a")).find(function(b){
        return /öğretmene sor/i.test(b.textContent||"");
      });
      if(teacherAsk){ teacherAsk.style.display=""; teacherAsk.classList.add("dh-moved-btn"); box.appendChild(teacherAsk); }
      // Detay → araçlara
      var detay=btnByText(card,"detay");
      if(detay){ detay.classList.add("dh-moved-btn"); box.appendChild(detay); }
      // Zayıf Analiz → araçlara
      var weak=card.querySelector(".extra-weak")||btnByText(card,"zayıf");
      if(weak){ weak.classList.add("dh-moved-btn"); box.appendChild(weak); }
      card.dataset.dhToolsFilled="1";
    }
    // ızgara sonradan gelebilir
    var grid=document.querySelector(".wd-tools-row");
    if(grid && grid.parentElement!==box){ box.appendChild(grid); }
  }
  function apply(){
    if(applying) return;
    applying=true;
    try{
      addStyle();
      var nav=fixNav();
      var card=currentCard();
      if(card){ moveGrade(card); }
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
