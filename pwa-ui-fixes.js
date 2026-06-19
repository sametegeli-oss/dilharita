(function(){
'use strict';
const FLOAT_HREFS=['practice.html','chat.html','library.html','videopractice.html'];
function isFloatingHomeButton(a){const href=(a.getAttribute('href')||'').toLowerCase();if(!FLOAT_HREFS.some(x=>href.includes(x)))return false;const cs=getComputedStyle(a);return cs.position==='fixed'||a.style.position==='fixed'}
function looksLikeHomeScreen(){
 const path=location.pathname.toLowerCase(); if(!(path.endsWith('/')||path.endsWith('/index.html')))return false;
 const txt=(document.getElementById('root')?.innerText||document.body.innerText||'').toLowerCase();
 const inLesson=txt.includes('bu cümleyi ne kadar biliyorsun')||txt.includes('sonraki')||txt.includes('← modüller')||txt.includes('a2-m')||document.querySelector('[data-current-sentence],.sentence-card,.lesson-card,.study-card,.progress');
 return !inLesson;
}
function apply(){const show=looksLikeHomeScreen();document.querySelectorAll('a[href]').forEach(a=>{if(!isFloatingHomeButton(a))return;a.dataset.homeFloatingButton='1';a.style.display=show?'flex':'none'})}
function boot(){apply();new MutationObserver(apply).observe(document.body,{childList:true,subtree:true,attributes:true});setInterval(apply,1200)}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();