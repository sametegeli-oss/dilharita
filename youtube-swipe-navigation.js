/* youtube-swipe-navigation.js — mobilde cümleler arasında parmakla geçiş */
(function(){
  "use strict";
  var sx=0,sy=0,started=0,tracking=false,zone=null;
  function addStyle(){
    if(document.getElementById("yt-swipe-css"))return;var s=document.createElement("style");s.id="yt-swipe-css";
    s.textContent="@media(pointer:coarse){#videoShell,#learningCard{touch-action:pan-y;transition:transform .16s ease,box-shadow .16s ease}#videoShell.yt-swipe-next,#learningCard.yt-swipe-next{transform:translateX(-8px);box-shadow:8px 0 0 rgba(37,99,235,.85)}#videoShell.yt-swipe-prev,#learningCard.yt-swipe-prev{transform:translateX(8px);box-shadow:-8px 0 0 rgba(52,211,153,.85)}}";document.head.appendChild(s);
  }
  function validZone(target){return target&&target.closest&&target.closest("#videoShell,#learningCard");}
  function interactive(target){
    if(target&&target.closest&&target.closest("#fullscreenTapLayer,#captionLayer"))return false;
    return !!(target&&target.closest&&target.closest("button,a,input,textarea,select,label,[contenteditable='true'],.yt-timeline,.yt-controls,.yt-modal,.yt-fullscreen-drawer,.yt-youglish-stage"));
  }
  document.addEventListener("touchstart",function(e){
    if(!e.touches||e.touches.length!==1){tracking=false;return;}var target=e.target;zone=validZone(target);if(!zone||interactive(target)){tracking=false;return;}
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;started=Date.now();tracking=true;
  },{passive:true,capture:true});
  document.addEventListener("touchend",function(e){
    if(!tracking||!e.changedTouches||e.changedTouches.length!==1)return;tracking=false;var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy,elapsed=Date.now()-started;
    if(elapsed>900||Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.25)return;var next=dx<0,button=document.getElementById(next?"nextSentence":"prevSentence");if(!button||button.disabled)return;
    var cls=next?"yt-swipe-next":"yt-swipe-prev",targets=[document.getElementById("videoShell"),document.getElementById("learningCard")];targets.forEach(function(x){if(x)x.classList.add(cls);});setTimeout(function(){targets.forEach(function(x){if(x)x.classList.remove(cls);});button.click();},120);
  },{passive:true,capture:true});
  document.addEventListener("touchcancel",function(){tracking=false;},{passive:true,capture:true});addStyle();
})();
