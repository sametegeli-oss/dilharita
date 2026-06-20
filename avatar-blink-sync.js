/* avatar-blink-sync.js
   Fotoğraf avatarlar için doğal göz kırpma eklentisi.
   - Konuşurken daha sık göz kırpar.
   - Boşta da doğal aralıklarla göz kırpar.
   - Mevcut ağız/ses animasyonunu bozmaz; sadece kısa süre blink.webp gösterir.
*/
(function(){
"use strict";

if (window.__AvatarBlinkSyncV1) return;
window.__AvatarBlinkSyncV1 = true;

const CFG = {
  blinkMs: 135,
  idleMin: 3200,
  idleMax: 6800,
  speakMin: 1500,
  speakMax: 3100,
  selectors: [
    "#avatarImg",
    "#avatarImage",
    "#teacherAvatarImg",
    "#teacherAvatar",
    "#mainAvatarImg",
    ".avatar-img",
    ".avatar-image",
    ".teacher-avatar img",
    ".avatar img",
    "img[src*='avatars']",
    "img[src*='avatar']",
    "img[src*='mouth-']",
    "img[src*='idle.webp']"
  ]
};

const seen = new WeakMap();

function rand(min,max){ return Math.floor(min + Math.random() * (max-min)); }

function isVisible(el){
  try{
    const r = el.getBoundingClientRect();
    return r.width > 20 && r.height > 20 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  }catch(e){ return false; }
}

function srcOf(img){
  return img.currentSrc || img.src || img.getAttribute("src") || "";
}

function blinkSrcFor(src){
  if(!src) return "";
  let s = src;

  // Aynı klasörde blink.webp varsa:
  if(/\/(idle|listen|neutral|talk|speaking|mouth-[a-z]+)\.(webp|png|jpg|jpeg)$/i.test(s)){
    return s.replace(/\/(idle|listen|neutral|talk|speaking|mouth-[a-z]+)\.(webp|png|jpg|jpeg)$/i, "/blink.$2");
  }

  // Sorgu parametresi varsa koru:
  const q = s.includes("?") ? s.slice(s.indexOf("?")) : "";
  const base = s.replace(/\?.*$/,"");
  if(/\/[^\/]+\.(webp|png|jpg|jpeg)$/i.test(base)){
    return base.replace(/\/[^\/]+\.(webp|png|jpg|jpeg)$/i, "/blink.$1") + q;
  }
  return "";
}

function isSpeakingNow(img){
  try{
    if (window.speechSynthesis && speechSynthesis.speaking) return true;
  }catch(e){}

  const s = srcOf(img);
  if(/mouth-|talk|speak/i.test(s)) return true;

  try{
    for(const a of document.querySelectorAll("audio,video")){
      if(!a.paused && !a.ended && a.currentTime > 0) return true;
    }
  }catch(e){}

  try{
    if(document.body.classList.contains("avatar-speaking") ||
       document.body.classList.contains("is-speaking") ||
       document.documentElement.classList.contains("avatar-speaking")) return true;
  }catch(e){}
  return false;
}

function preload(url){
  if(!url) return;
  const i = new Image();
  i.src = url;
}

function doBlink(img){
  const st = seen.get(img);
  if(!st || st.disabled || document.hidden || !isVisible(img)) return;

  const before = srcOf(img);
  const blink = blinkSrcFor(before) || st.blinkSrc;
  if(!blink || before === blink) return;

  st.blinkSrc = blink;
  preload(blink);

  // Kırpma anında mevcut ağız frame'i korunur; blink kısa süre görünür, sonra geri bırakılır.
  img.dataset.avatarBlinking = "1";
  img.src = blink;

  // Ağız animasyonu çok hızlıysa blink'i bir kez daha güçlendir.
  setTimeout(function(){
    if(seen.has(img) && img.dataset.avatarBlinking === "1") {
      try { img.src = blink; } catch(e){}
    }
  }, 45);

  setTimeout(function(){
    if(!seen.has(img)) return;
    if(img.dataset.avatarBlinking === "1"){
      delete img.dataset.avatarBlinking;
      // Bu arada konuşma animasyonu başka frame'e geçtiyse onu ezme.
      if(srcOf(img) === blink) {
        try { img.src = before; } catch(e){}
      }
    }
  }, CFG.blinkMs);
}

function loop(img){
  const st = seen.get(img);
  if(!st || st.disabled) return;
  const speaking = isSpeakingNow(img);
  const delay = speaking ? rand(CFG.speakMin, CFG.speakMax) : rand(CFG.idleMin, CFG.idleMax);
  st.timer = setTimeout(function(){
    doBlink(img);
    loop(img);
  }, delay);
}

function attach(img){
  if(!img || seen.has(img)) return;
  const src = srcOf(img);
  const blink = blinkSrcFor(src);
  if(!blink) return;

  const st = { blinkSrc: blink, disabled:false, timer:null };
  seen.set(img, st);
  preload(blink);

  img.addEventListener("error", function(){
    // blink dosyası yoksa veya yol hatalıysa sonsuz hata üretme.
    if(img.dataset.avatarBlinking === "1"){
      st.disabled = true;
      delete img.dataset.avatarBlinking;
    }
  }, true);

  loop(img);
}

function scan(){
  CFG.selectors.forEach(sel=>{
    try{ document.querySelectorAll(sel).forEach(attach); }catch(e){}
  });
}

function forceBlink(){
  CFG.selectors.forEach(sel=>{
    try{ document.querySelectorAll(sel).forEach(img=>{ attach(img); doBlink(img); }); }catch(e){}
  });
}

window.AvatarBlinkSync = {
  scan,
  forceBlink,
  attach,
  version: "v1"
};

document.addEventListener("DOMContentLoaded", function(){
  scan();
  try{
    new MutationObserver(function(){ scan(); }).observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:["src","class"]});
  }catch(e){}
});

window.addEventListener("load", scan);
document.addEventListener("visibilitychange", scan);

// TTS başladığında ilk 300ms içinde kısa bir göz kırpma denemesi.
(function(){
  try{
    const nativeSpeak = speechSynthesis.speak.bind(speechSynthesis);
    if(!speechSynthesis.__avatarBlinkSpeakPatched){
      speechSynthesis.__avatarBlinkSpeakPatched = true;
      speechSynthesis.speak = function(u){
        setTimeout(forceBlink, 250);
        return nativeSpeak(u);
      };
    }
  }catch(e){}
})();
})();