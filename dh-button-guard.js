/* dh-button-guard.js — DÜĞME GÖRÜNÜRLÜK KORUMASI (v1)
   ------------------------------------------------------------------
   Amaç: Programdaki hiçbir düğme zeminle kaybolmasın.
   Sayfadaki her görünür düğmeyi ölçer:
     1) Yazı/zemin kontrastı 3.2:1'in altındaysa yazı rengini okunur tona çeker.
     2) Düğme zeminden ayrışmıyorsa (zemin farkı yok, kenarlık yok/görünmez)
        ince bir kenarlık ve hafif bir zemin ekler (data-dh-vis="ghost").
   Tasarımı bozmamak için yalnızca gerçekten sorunlu düğmelere dokunur;
   her turda önce kendi eklediklerini kaldırıp yeniden ölçer (aktif/pasif
   durum değişirse düzeltme de kalkar). Pencere/menü açıldıkça tekrar çalışır.
   Hariç tutmak için düğmeye data-no-vis-guard eklenebilir.
   ------------------------------------------------------------------ */
(function(){
"use strict";
if(window.__dhButtonGuard) return;
window.__dhButtonGuard=true;

var SEL='button,a.btn,a.dh-btn,[role="button"],input[type="submit"],input[type="button"]';
var SKIP_ROLES={tab:1,menuitem:1,option:1,switch:1,link:1};
var TEXT_MIN=3.2, EDGE_MIN=1.3;

function injectCss(){
  if(document.getElementById("dhButtonGuardCss")) return;
  var st=document.createElement("style");st.id="dhButtonGuardCss";
  st.textContent=
    "[data-dh-vis=\"ghost\"]{border:1px solid rgba(160,190,225,.45)!important;background-color:rgba(148,178,214,.14)!important;border-radius:10px}"+
    "[data-dh-vis=\"ghost\"]:hover{border-color:rgba(85,230,209,.65)!important;background-color:rgba(85,230,209,.14)!important}"+
    "[data-dh-vis=\"light\"]{border:1px solid rgba(30,50,80,.35)!important;background-color:rgba(20,40,70,.06)!important;border-radius:10px}"+
    "[data-dh-vis=\"light\"]:hover{border-color:rgba(20,120,110,.6)!important;background-color:rgba(20,120,110,.10)!important}";
  st.textContent+='[data-dh-vis-text="light"]{color:#e6eef8!important}[data-dh-vis-text="dark"]{color:#0b1422!important}';
  (document.head||document.documentElement).appendChild(st);
}
function parse(c){var m=String(c||"").match(/rgba?\(([^)]+)\)/);if(!m)return null;var a=m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);return{r:a[0],g:a[1],b:a[2],a:a.length>3?a[3]:1};}
function lum(c){function f(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);}return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);}
function ratio(a,b){var l1=lum(a),l2=lum(b);return(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);}
function blend(t,u){var a=t.a;return{r:t.r*a+u.r*(1-a),g:t.g*a+u.g*(1-a),b:t.b*a+u.b*(1-a),a:1};}
function gradColor(img){var m=String(img||"").match(/rgba?\([^)]+\)/g);if(!m)return null;var r=0,g=0,b=0,a=0;m.forEach(function(x){var c=parse(x);r+=c.r;g+=c.g;b+=c.b;a+=c.a;});var n=m.length;return{r:r/n,g:g/n,b:b/n,a:a/n};}
function layerOf(e){var cs=getComputedStyle(e);return gradColor(cs.backgroundImage)||parse(cs.backgroundColor);}
function bgOf(el){
  var stack=[];
  for(var e=el;e&&e.nodeType===1;e=e.parentElement){var c=layerOf(e);if(c&&c.a>0.02)stack.push(c);if(c&&c.a>=.95)break;}
  var col=document.body&&parse(getComputedStyle(document.body).backgroundColor);
  if(!col||col.a<.5)col={r:8,g:14,b:26,a:1};
  for(var i=stack.length-1;i>=0;i--)col=blend(stack[i],col);
  return col;
}
function eligible(el){
  if(el.hasAttribute("data-no-vis-guard")) return false;
  var role=el.getAttribute("role");if(role&&SKIP_ROLES[role]&&el.tagName!=="BUTTON") return false;
  if(role==="tab"||role==="menuitem"||role==="option") return false;
  if(el.closest('[data-no-vis-guard],[role="tablist"],[role="menu"],svg')) return false;
  /* Cümle içindeki tıklanabilir kelimeler metnin parçasıdır; çerçevelenmez */
  if(el.matches(".yt-word,.dh-word,[data-word]")) return false;
  var par=el.parentElement;
  if(par&&(/^(P|H[1-6]|SPAN|B|STRONG|EM|LI|LABEL)$/.test(par.tagName)||par.hasAttribute("lang"))&&par.querySelectorAll(":scope>button").length>=3) return false;
  var r=el.getBoundingClientRect();if(r.width<10||r.height<10) return false;
  var cs=getComputedStyle(el);
  if(cs.visibility==="hidden"||cs.display==="none"||+cs.opacity<.05) return false;
  var txt=(el.innerText||el.value||"").trim();
  /* Kart / liste satırı gibi büyük tıklanabilir alanlar: yalnız yazı rengi düzeltilir */
  if(r.height>90||r.width>560||txt.length>70) return "text";
  if(/^[×✕✖]$/.test(txt)) return "text";                     /* kapatma çarpısı çerçevesiz kalabilir */
  return "full";
}
/* Karar hafızası: düğmenin sınıfı/durumu değişmedikçe yeniden ölçülmez.
   Ölçüm sırasında geçiş (transition) kapatılır; böylece hover/aktif
   animasyonunun ortasında yanlış renk okunup düzeltme gidip gelmez. */
var memo=typeof WeakMap==="function"?new WeakMap():null;
function sig(el){return[el.className,el.getAttribute("style")||"",el.getAttribute("aria-pressed"),el.getAttribute("aria-expanded"),el.getAttribute("aria-selected"),el.disabled?1:0].join("|");}
function fix(el){
  var mode=eligible(el);if(!mode) return;
  var s=sig(el)+"|"+mode,m=memo&&memo.get(el);
  if(m&&m.sig===s) return;
  el.removeAttribute("data-dh-vis");el.removeAttribute("data-dh-vis-text");
  var oldTr=el.style.getPropertyValue("transition"),oldPr=el.style.getPropertyPriority("transition");
  el.style.setProperty("transition","none","important");
  var cs=getComputedStyle(el),own=bgOf(el),parent=el.parentElement?bgOf(el.parentElement):own;
  var fg=parse(cs.color),bw=parseFloat(cs.borderTopWidth)||0,bd=parse(cs.borderTopColor),bstyle=cs.borderTopStyle;
  if(oldTr)el.style.setProperty("transition",oldTr,oldPr);else el.style.removeProperty("transition");
  if(!el.getAttribute("style"))el.removeAttribute("style");
  if(fg&&ratio(blend(fg,own),own)<TEXT_MIN){
    var light={r:230,g:238,b:248,a:1},darkC={r:11,g:20,b:34,a:1};
    el.setAttribute("data-dh-vis-text",ratio(light,own)>=ratio(darkC,own)?"light":"dark");
  }
  var edge=Math.max(ratio(own,parent),bw>=1&&bd&&bstyle!=="none"?ratio(blend(bd,parent),parent):1);
  /* Çerçeveli bir grup içindeki bölmeli düğmeler (segment) grubun çerçevesiyle zaten ayrışır */
  var par=el.parentElement,gp=par&&par.parentElement;
  if(par&&gp&&par.querySelectorAll(":scope>button").length>=2){
    var pcs=getComputedStyle(par),pbw=parseFloat(pcs.borderTopWidth)||0,pbd=parse(pcs.borderTopColor),gbg=bgOf(gp);
    var framed=ratio(parent,gbg)>=EDGE_MIN||(pbw>=1&&pbd&&pcs.borderTopStyle!=="none"&&ratio(blend(pbd,gbg),gbg)>=EDGE_MIN);
    if(framed) edge=Math.max(edge,EDGE_MIN);
  }
  if(mode==="full"&&edge<EDGE_MIN) el.setAttribute("data-dh-vis",lum(parent)<.35?"ghost":"light");   /* sınıf değil öznitelik: sayfa className yazsa da silinmez */
  if(memo)memo.set(el,{sig:sig(el)+"|"+mode});
}
var observer=null,timer=0,running=false,lastRun=0;
function run(){
  timer=0;if(running||document.hidden) return;running=true;lastRun=Date.now();
  try{injectCss();var list=document.querySelectorAll(SEL);for(var i=0;i<list.length;i++){try{fix(list[i]);}catch(e){}}}
  finally{running=false;if(observer)observer.takeRecords();}
}
/* En sık ~0,8 sn'de bir çalışır (animasyonlu sayfalarda işlemciyi yormaz). */
function schedule(){if(timer)return;var wait=Math.max(250,800-(Date.now()-lastRun));timer=setTimeout(run,wait);}
function start(){
  run();
  [700,1500,2500,4000,7000].forEach(function(t){setTimeout(run,t);});   /* geç çizilen/animasyonla gelen düğmeler */
  if(window.MutationObserver){
    observer=new MutationObserver(function(records){
      if(running) return;
      for(var i=0;i<records.length;i++){var t=records[i].target;if(t&&t.nodeType===1&&(t.closest("svg,canvas")||t.id==="dhButtonGuardCss"))continue;schedule();return;}
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["hidden","open","aria-expanded","aria-hidden","disabled","class"]});
  }
  window.addEventListener("resize",schedule);
  document.addEventListener("visibilitychange",schedule);
  document.addEventListener("click",function(){setTimeout(schedule,60);},true);
}
window.DHButtonGuard={run:run};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
