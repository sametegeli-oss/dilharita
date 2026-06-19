(function(){
'use strict';
const MicGuard={streams:new Set(),timers:new Set(),hardLimitMs:25000,rememberStream(s){if(s&&s.getTracks)this.streams.add(s);return s},stopAll(){this.timers.forEach(t=>clearTimeout(t));this.timers.clear();this.streams.forEach(s=>{try{s.getTracks().forEach(tr=>tr.stop())}catch{}});this.streams.clear();this.resetButtons()},resetButtons(){document.querySelectorAll('button,[role="button"]').forEach(b=>{const txt=(b.innerText||b.title||b.getAttribute('aria-label')||'').toLowerCase();const isMic=/mic|mikrofon|konuş|telaffuz|record|stop|durdur|🎙|🎤/.test(txt+' '+(b.innerText||''));if(!isMic)return;b.disabled=false;b.removeAttribute('disabled');b.classList.remove('recording','listening','active','busy','loading','is-recording','isListening');b.setAttribute('aria-pressed','false')})},arm(){const t=setTimeout(()=>this.stopAll(),this.hardLimitMs);this.timers.add(t)}};
window.DilMicGuard=MicGuard;
if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){const orig=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=function(){return orig.apply(this,arguments).then(s=>MicGuard.rememberStream(s))}}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button,[role="button"]');if(!b)return;const txt=(b.innerText||b.title||b.getAttribute('aria-label')||'').toLowerCase();if(/mic|mikrofon|konuş|telaffuz|record|🎙|🎤/.test(txt+' '+(b.innerText||'')))MicGuard.arm(b)},true);
window.addEventListener('pagehide',()=>MicGuard.stopAll());
document.addEventListener('visibilitychange',()=>{if(document.hidden)MicGuard.stopAll()});
['mouseup','touchend','pointerup'].forEach(ev=>document.addEventListener(ev,()=>setTimeout(()=>MicGuard.resetButtons(),700),true));
})();