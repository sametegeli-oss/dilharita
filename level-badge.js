/* level-badge.js — KALICI SEVİYE ROZETİ
   Dil Harita — Madde 2: Seviye her sayfada görünür.

   Üst köşede küçük bir rozet: seviye (A1-C1) + genel ustalık.
   Anayasadaki seviye + Mastery Engine özetinden beslenir.
   Tıklayınca kısa bir özet açılır (seviye dağılımı + beceriler).

   Otomatik mount olur (sayfaya eklenince kendini gösterir).
*/
(function(global){
  "use strict";
  if(global.DHLevelBadge) return;

  var LEVEL_LABEL = { A1:"Başlangıç", A2:"Temel", B1:"Orta", B2:"Orta-üstü", C1:"İleri", C2:"Usta" };
  var SKILL_LABEL = { tanima:"Tanıma", dinleme:"Dinleme", hatirlama:"Hatırlama", uretim:"Üretim", akicilik:"Akıcılık" };

  function getLevel(){
    try{
      if(global.DHTeacherPolicy){
        var p = DHTeacherPolicy.load();
        if(p && p.seviye && p.seviye!=="auto") return p.seviye;
        if(p && p.seviyeTesti && p.seviyeTesti.level) return p.seviyeTesti.level;
      }
    }catch(e){}
    return null;
  }

  function injectCSS(){
    if(document.getElementById("dh-lvbadge-css")) return;
    var st=document.createElement("style");
    st.id="dh-lvbadge-css";
    st.textContent =
     ".dh-lvbadge{position:fixed;top:max(10px,env(safe-area-inset-top));right:12px;z-index:9998;"
    +"display:flex;align-items:center;gap:7px;background:rgba(15,31,58,.92);border:1px solid #1e3a5f;"
    +"border-radius:999px;padding:6px 12px 6px 8px;cursor:pointer;backdrop-filter:blur(8px);"
    +"box-shadow:0 4px 16px rgba(0,0,0,.3);font-family:system-ui,-apple-system,sans-serif;transition:transform .15s}"
    +".dh-lvbadge:hover{transform:scale(1.04)}"
    +".dh-lvbadge .lv{font-size:15px;font-weight:950;color:#fff;background:linear-gradient(135deg,#2563eb,#38bdf8);"
    +"width:30px;height:30px;border-radius:50%;display:grid;place-items:center}"
    +".dh-lvbadge .meta{display:flex;flex-direction:column;line-height:1.1}"
    +".dh-lvbadge .meta b{font-size:12px;color:#e8eef7;font-weight:800}"
    +".dh-lvbadge .meta span{font-size:10px;color:#9fb3d9}"
    +".dh-lvpop{position:fixed;top:54px;right:12px;z-index:9999;width:280px;max-width:calc(100vw - 24px);"
    +"background:#0f1f3a;border:1px solid #1e3a5f;border-radius:16px;padding:16px;box-shadow:0 20px 50px rgba(0,0,0,.5);"
    +"font-family:system-ui,-apple-system,sans-serif;animation:dhLvF .2s ease}"
    +"@keyframes dhLvF{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}"
    +".dh-lvpop h4{margin:0 0 4px;color:#e8eef7;font-size:15px}"
    +".dh-lvpop .sub{color:#9fb3d9;font-size:12px;margin-bottom:12px}"
    +".dh-lvpop .row{margin-bottom:9px}"
    +".dh-lvpop .row .rt{display:flex;justify-content:space-between;font-size:12px;color:#cbd5e1;margin-bottom:3px}"
    +".dh-lvpop .bar{height:6px;background:#13294d;border-radius:99px;overflow:hidden}"
    +".dh-lvpop .bar > i{display:block;height:100%;border-radius:99px}"
    +".dh-lvpop .empty{color:#9fb3d9;font-size:12px;text-align:center;padding:8px 0}"
    +".dh-lvpop .close{position:absolute;top:10px;right:12px;color:#9fb3d9;cursor:pointer;font-size:18px;background:none;border:0}";
    document.head.appendChild(st);
  }

  var popEl=null;
  function closePop(){ if(popEl){ popEl.remove(); popEl=null; } }

  function openPop(){
    closePop();
    injectCSS();
    var lvl = getLevel();
    popEl=document.createElement("div");
    popEl.className="dh-lvpop";
    popEl.innerHTML='<button class="close" id="dhLvClose">×</button>'
      +'<h4>Seviyen: '+(lvl||"belirlenmedi")+(lvl?' · '+(LEVEL_LABEL[lvl]||""):"")+'</h4>'
      +'<div class="sub">Çalıştıkça gelişir</div>'
      +'<div id="dhLvBody"><div class="empty">Yükleniyor…</div></div>';
    document.body.appendChild(popEl);
    document.getElementById("dhLvClose").onclick=closePop;

    // Mastery özeti
    if(global.DHMastery && DHMastery.summary){
      DHMastery.summary().then(function(sum){
        var body=document.getElementById("dhLvBody"); if(!body) return;
        if(!sum || !sum.itemCount){
          body.innerHTML='<div class="empty">Henüz yeterli çalışma yok.<br>Ders yaptıkça beceri kırılımın burada görünecek.</div>';
          return;
        }
        var skills = DHMastery.SKILLS || ["tanima","dinleme","hatirlama","uretim","akicilik"];
        var html = skills.map(function(sk){
          var v = (sum.skillAverages && sum.skillAverages[sk]) || 0;
          var col = v>=65?"#34d399":(v>=40?"#f59e0b":"#f87171");
          return '<div class="row"><div class="rt"><span>'+(SKILL_LABEL[sk]||sk)+'</span><span>'+v+'%</span></div>'
            +'<div class="bar"><i style="width:'+v+'%;background:'+col+'"></i></div></div>';
        }).join("");
        html += '<div class="sub" style="margin-top:10px;margin-bottom:0">'+sum.itemCount+' öğe çalışıldı</div>';
        body.innerHTML=html;
      }).catch(function(){
        var body=document.getElementById("dhLvBody"); if(body) body.innerHTML='<div class="empty">Özet alınamadı.</div>';
      });
    } else {
      var body=document.getElementById("dhLvBody"); if(body) body.innerHTML='<div class="empty">Beceri verisi yok.</div>';
    }
  }

  function mount(){
    var lvl = getLevel();
    if(!lvl) return; // seviye belirlenmemişse rozet gösterme
    injectCSS();
    if(document.querySelector(".dh-lvbadge")) return;
    var b=document.createElement("div");
    b.className="dh-lvbadge";
    b.innerHTML='<div class="lv">'+lvl+'</div>'
      +'<div class="meta"><b>Seviyen</b><span>'+(LEVEL_LABEL[lvl]||"")+'</span></div>';
    b.onclick=function(e){ e.stopPropagation(); if(popEl) closePop(); else openPop(); };
    document.body.appendChild(b);
    document.addEventListener("click", function(e){
      if(popEl && !popEl.contains(e.target) && !b.contains(e.target)) closePop();
    });
  }

  function boot(){
    if(document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);
  }
  if(global.__dhStorageReady) setTimeout(boot, 200);
  else{ global.addEventListener("dh-storage-ready", function(){ setTimeout(boot,200); }, {once:true}); setTimeout(boot, 1600); }

  global.DHLevelBadge = { mount: mount, refresh: function(){ var b=document.querySelector(".dh-lvbadge"); if(b) b.remove(); mount(); } };
})(window);
