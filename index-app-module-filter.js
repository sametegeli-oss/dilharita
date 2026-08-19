/* index-app-module-filter.js — büyük modül kataloğunu mobilde yönetilebilir yapar */
(function(global){
  "use strict";
  if(global.__dhModuleFilterInstalled)return;global.__dhModuleFilterInstalled=true;
  var level="",query="",timer=0;
  function profileLevel(){try{return String((JSON.parse(localStorage.getItem("dh-profile-v1")||"{}")||{}).seviye||"").toUpperCase();}catch(e){return "";}}
  function cardLevel(card){
    var p=card;
    while(p&&p.id!=="root"){
      var h=p.querySelector&&p.querySelector(":scope > h2, :scope > header h2, :scope > .level-title");
      var m=h&&String(h.textContent||"").match(/\b(A1|A2|B1|B2|C1)\b/i);
      if(m)return m[1].toUpperCase();
      p=p.parentElement;
    }
    /* React bölümleri kardeş düğümler yapıyorsa en yakın önceki başlığı kullan. */
    var n=card;while(n){n=n.previousElementSibling;if(!n)break;var mm=String(n.textContent||"").match(/^\s*(A1|A2|B1|B2|C1)\b/i);if(mm)return mm[1].toUpperCase();}
    return "";
  }
  function apply(){
    var cards=[].slice.call(document.querySelectorAll("#root .module-tile")),shown=0;
    cards.forEach(function(card){var text=String(card.textContent||"").toLocaleLowerCase("tr"),lev=cardLevel(card);var ok=(!level||lev===level)&&(!query||text.indexOf(query)>=0);card.hidden=!ok;card.style.display=ok?"":"none";if(ok)shown++;});
    var count=document.getElementById("dhModuleFilterCount");if(count)count.textContent=cards.length?shown+" / "+cards.length+" modül gösteriliyor":"Modüller hazırlanıyor…";
    var empty=document.getElementById("dhModuleFilterEmpty");if(empty)empty.hidden=!cards.length||shown>0;
  }
  function install(){
    var root=document.getElementById("root");if(!root||document.getElementById("dhModuleFilter"))return;
    var pref=profileLevel();
    var bar=document.createElement("section");bar.id="dhModuleFilter";bar.className="dh-module-filter";bar.setAttribute("aria-label","Modül süzgeci");
    bar.innerHTML='<div class="dh-module-filter__top"><label for="dhModuleSearch">Modül ara</label><input id="dhModuleSearch" type="search" placeholder="Konu veya modül adı…" autocomplete="off"></div><div class="dh-module-filter__levels" role="group" aria-label="Seviye seç"><button type="button" data-level="">Tümü</button>'+["A1","A2","B1","B2","C1"].map(function(x){return '<button type="button" data-level="'+x+'">'+x+'</button>';}).join("")+(pref?'<button type="button" class="is-coach" data-level="'+pref+'">Koçun seviyene odaklan: '+pref+'</button>':'')+'</div><p id="dhModuleFilterCount" aria-live="polite">Modüller hazırlanıyor…</p><p id="dhModuleFilterEmpty" hidden>Bu süzgeçte modül bulunamadı. Seviyeyi veya aramayı değiştir.</p>';
    root.parentNode.insertBefore(bar,root);
    bar.querySelector('[data-level=""]').classList.add("is-active");
    bar.querySelector("input").addEventListener("input",function(){query=this.value.trim().toLocaleLowerCase("tr");apply();});
    bar.addEventListener("click",function(e){var b=e.target.closest("button[data-level]");if(!b)return;level=b.getAttribute("data-level")||"";bar.querySelectorAll("button[data-level]").forEach(function(x){x.classList.toggle("is-active",x===b);});apply();});
    apply();
    new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(apply,80);}).observe(root,{childList:true,subtree:true});
  }
  var css=document.createElement("style");css.textContent='.dh-module-filter{position:sticky;top:0;z-index:40;margin:0 auto 14px;width:min(1120px,calc(100% - 24px));padding:12px;border:1px solid #334155;border-radius:16px;background:rgba(11,17,32,.96);box-shadow:0 10px 28px #0005;font-family:Nunito,system-ui;color:#e5eefc}.dh-module-filter__top{display:flex;gap:10px;align-items:center}.dh-module-filter label{font-weight:900;white-space:nowrap}.dh-module-filter input{min-width:0;flex:1;padding:11px 13px;border:1px solid #3b4d68;border-radius:11px;background:#071120;color:#fff;font:inherit}.dh-module-filter__levels{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.dh-module-filter button{padding:8px 12px;border:1px solid #3b4d68;border-radius:999px;background:#14233b;color:#dbeafe;font-weight:900}.dh-module-filter button.is-active{background:#2563eb;border-color:#60a5fa;color:#fff}.dh-module-filter button.is-coach{margin-left:auto;border-color:#34d399}.dh-module-filter p{margin:8px 2px 0;color:#9fb0ca;font-size:13px}.dh-module-filter #dhModuleFilterEmpty{color:#fbbf24;font-weight:800}@media(max-width:560px){.dh-module-filter{top:6px;width:calc(100% - 16px);padding:10px}.dh-module-filter__top{display:block}.dh-module-filter label{display:block;margin-bottom:6px}.dh-module-filter input{width:100%}.dh-module-filter__levels{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}.dh-module-filter button{flex:0 0 auto}.dh-module-filter button.is-coach{margin-left:0}}';document.head.appendChild(css);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);else install();
})(window);
