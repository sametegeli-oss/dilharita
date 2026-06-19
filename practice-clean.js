(function(){
'use strict';
function isPracticePage(){const p=location.pathname.toLowerCase();const t=(document.body.innerText||'').toLowerCase();return p.includes('practice')||t.includes('bu cümleyi ne kadar biliyorsun')||t.includes('çalışma')}
function unwrap(span){const p=span.parentNode;if(!p)return;while(span.firstChild)p.insertBefore(span.firstChild,span);p.removeChild(span)}
function clean(){
 if(!isPracticePage())return;
 document.querySelectorAll('.sentence,.sentence-en,.subject-en,.english,.card,.study-card,.lesson-card,[data-sentence]').forEach(root=>{
   if(root.closest('button,.btn,nav,.menu'))return;
   root.querySelectorAll('span').forEach(s=>{
     if(s.closest('button,.btn,nav,.menu'))return;
     const mark=(s.getAttribute('style')||'')+' '+(s.className||'');
     if(/color\s*:|background|grammar|tense|noun|verb|adj|adv|highlight|word-color/i.test(mark))unwrap(s);
   });
 });
}
function boot(){clean();new MutationObserver(clean).observe(document.body,{childList:true,subtree:true});setInterval(clean,1500)}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();