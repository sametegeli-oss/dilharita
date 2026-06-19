(function(){
'use strict';
function isVideoPage(){return location.pathname.toLowerCase().includes('video')||/video|telaffuz|avatar/i.test(document.body.innerText||'')}
function overlap(a,b){return !(a.right<b.left||a.left>b.right||a.bottom<b.top||a.top>b.bottom)}
function fix(){
 if(!isVideoPage())return;
 const avs=[...document.querySelectorAll('[id*="avatar" i],[class*="avatar" i],[id*="teacher" i],[class*="teacher" i]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>60&&r.height>60});
 const exs=[...document.querySelectorAll('[id*="explain" i],[class*="explain" i],[id*="tr" i],[class*="tr" i],[id*="translation" i],[class*="translation" i]')].filter(e=>{const t=(e.innerText||'')+' '+e.id+' '+e.className;const r=e.getBoundingClientRect();return r.width>80&&r.height>20&&/türkçe|açıkla|çeviri|anlam|tr/i.test(t)});
 exs.forEach(ex=>{if(!avs.some(av=>overlap(ex.getBoundingClientRect(),av.getBoundingClientRect())))return;
   ex.classList.add('video-explanation-fixed');Object.assign(ex.style,{position:'relative',left:'auto',right:'auto',top:'auto',bottom:'auto',transform:'none',zIndex:'5',marginTop:'12px',maxWidth:'100%',clear:'both'});
   const av=avs[0];const c=av.closest('.card,.panel,section,main,.wrap')||av.parentElement;if(c&&ex.parentElement!==c&&c.contains(av)){try{c.appendChild(ex)}catch{}}
 });
}
function boot(){const st=document.createElement('style');st.textContent='.video-explanation-fixed{display:block!important;width:auto!important;max-height:45vh!important;overflow:auto!important;pointer-events:auto!important}';document.head.appendChild(st);fix();new MutationObserver(fix).observe(document.body,{childList:true,subtree:true,attributes:true});setInterval(fix,1500)}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();