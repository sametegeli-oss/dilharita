/* youtube-image-guard.js — YouTube kaynaklı modül cümlesinde görsel aramasını durdurur. */
(function(){
  "use strict";
  if(window.__dhYoutubeImageGuard)return;window.__dhYoutubeImageGuard=true;
  function norm(t){return String(t||"").trim().toLocaleLowerCase("en");}
  function activeYoutubeSentence(){
    var el=document.querySelector(".card .card-en"),text=norm(el&&el.textContent);if(!text||!window.DHModul)return false;
    try{var list=DHModul.liste()||[];for(var i=0;i<list.length;i++){var rows=DHModul.getir(list[i].id)||[];for(var j=0;j<rows.length;j++){var r=rows[j];if(r&&norm(r.en)===text&&(r.videoId||String(r.sourceType||"").toLowerCase().indexOf("youtube")>=0))return true;}}}catch(e){}
    return false;
  }
  var nativeFetch=window.fetch;if(typeof nativeFetch!=="function")return;
  window.fetch=function(input,init){
    var url=String(input&&input.url||input||"");
    if(activeYoutubeSentence()&&/^(?:https?:\/\/)?(?:api\.openverse\.org|commons\.wikimedia\.org|en\.wikipedia\.org)\//i.test(url))return Promise.reject(new TypeError("YouTube cümlesinde görsel araması kapalı"));
    return nativeFetch.apply(this,arguments);
  };
})();
