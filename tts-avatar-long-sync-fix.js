/* tts-avatar-long-sync-fix.js
   Uzun metinlerde ses devam ederken avatarın susmasını engeller.
   - TTS metnini küçük parçalara böler.
   - Her parçada avatar-speaking durumunu canlı tutar.
   - Avatar ağız frame'lerini tüm okuma bitene kadar döndürür.
   - Türkçe kısımlar tr-TR, İngilizce kısımlar en-US okunur.
*/
(function(){
"use strict";
if(window.__LongTTSAvatarSyncFixV2) return;
window.__LongTTSAvatarSyncFixV2 = true;

const AVATAR_SELECTORS = [
  "#avatarImg","#avatarImage","#teacherAvatarImg","#teacherAvatar","#mainAvatarImg",
  ".avatar-img",".avatar-image",".teacher-avatar img",".avatar img",
  "img[src*='avatars']","img[src*='avatar']","img[src*='idle.webp']","img[src*='mouth-']"
];

let nativeSpeak = null;
try { nativeSpeak = speechSynthesis.speak.bind(speechSynthesis); } catch(e){}

let active = false;
let activeTimer = null;
let mouthTimer = null;
let savedSrc = new WeakMap();
let mouthIndex = 0;

function clean(s){ return String(s||"").replace(/\s+/g," ").trim(); }
function isTurkish(text){
  const s=String(text||"");
  if(/[ğüşöçıİĞÜŞÖÇ]/.test(s)) return true;
  if(/^\s*(TÜRKÇE|AÇIKLAMA|ÖZET|NOT|KURAL|YANLIŞ|DOĞRU)\b/i.test(s)) return true;
  if(/\b(konu|cümle|örnek|anlam|yapı|kural|kullanıcı|cevap|doğru|yanlış|şöyle|çünkü|fiil|özne|yüklem|Türkçe|anlat|açıkla|demek|kullanılır)\b/i.test(s)) return true;
  return false;
}
function splitLongLine(line, maxLen=140){
  line=clean(line);
  if(line.length<=maxLen) return [line];
  const parts=[];
  let rest=line;
  while(rest.length>maxLen){
    let cut=Math.max(rest.lastIndexOf(". ",maxLen), rest.lastIndexOf(", ",maxLen), rest.lastIndexOf("; ",maxLen), rest.lastIndexOf(" ",maxLen));
    if(cut<60) cut=maxLen;
    parts.push(clean(rest.slice(0,cut+1)));
    rest=clean(rest.slice(cut+1));
  }
  if(rest) parts.push(rest);
  return parts;
}
function splitForSpeech(text){
  const raw=String(text||"").replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g," ");
  const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const chunks=[];
  lines.forEach(line=>{
    const lang=isTurkish(line) ? "tr-TR" : "en-US";
    const pieces=line.split(/(?<=[.!?])\s+/).filter(Boolean);
    (pieces.length?pieces:[line]).forEach(p=>{
      splitLongLine(p, lang==="tr-TR"?150:125).forEach(piece=>{
        if(piece) chunks.push({text:piece, lang});
      });
    });
  });
  return chunks.length ? chunks : [{text:clean(raw), lang:isTurkish(raw)?"tr-TR":"en-US"}];
}
function avatarImgs(){
  const set=new Set();
  AVATAR_SELECTORS.forEach(sel=>{
    try{ document.querySelectorAll(sel).forEach(img=>{ if(img && img.tagName==="IMG") set.add(img); }); }catch(e){}
  });
  return [...set].filter(img=>{
    try{
      const r=img.getBoundingClientRect();
      return r.width>24 && r.height>24 && r.bottom>0 && r.top<innerHeight;
    }catch(e){ return true; }
  });
}
function srcOf(img){ return img.currentSrc || img.src || img.getAttribute("src") || ""; }
function frameCandidates(src){
  if(!src) return [];
  const q=src.includes("?") ? src.slice(src.indexOf("?")) : "";
  const base=src.replace(/\?.*$/,"");
  const dir=base.replace(/\/[^\/]*$/,"/");
  const ext=(base.match(/\.(webp|png|jpg|jpeg)$/i)||[".webp","webp"])[1];
  return [
    dir+"mouth-a."+ext+q,
    dir+"mouth-e."+ext+q,
    dir+"mouth-o."+ext+q,
    dir+"talk."+ext+q,
    dir+"speaking."+ext+q,
    dir+"mouth-open."+ext+q
  ];
}
function idleSrc(src){
  if(!src) return src;
  return src.replace(/\/(mouth-[^\/]+|talk|speaking|mouth-open|blink)\.(webp|png|jpg|jpeg)(\?.*)?$/i, "/idle.$2$3");
}
function setSpeakingState(on){
  active = !!on;
  document.body.classList.toggle("avatar-speaking", active);
  document.body.classList.toggle("is-speaking", active);
  document.documentElement.classList.toggle("avatar-speaking", active);
  try{ window.dispatchEvent(new CustomEvent(active ? "dh-tts-start" : "dh-tts-end")); }catch(e){}
  if(active){
    clearInterval(activeTimer);
    activeTimer=setInterval(()=>{
      document.body.classList.add("avatar-speaking","is-speaking");
      document.documentElement.classList.add("avatar-speaking");
    }, 250);
    startMouthLoop();
  } else {
    clearInterval(activeTimer); activeTimer=null;
    stopMouthLoop();
  }
}
function startMouthLoop(){
  if(mouthTimer) return;
  mouthTimer=setInterval(()=>{
    if(!active) return;
    mouthIndex++;
    avatarImgs().forEach(img=>{
      const current=srcOf(img);
      if(!savedSrc.has(img)) savedSrc.set(img, idleSrc(current));
      if(img.dataset.avatarBlinking==="1") return;
      const base=savedSrc.get(img) || idleSrc(current) || current;
      const frames=frameCandidates(base);
      const next=frames[mouthIndex % frames.length];
      try{ img.src=next; }catch(e){}
    });
  }, 115);
}
function stopMouthLoop(){
  clearInterval(mouthTimer); mouthTimer=null;
  avatarImgs().forEach(img=>{
    const old=savedSrc.get(img);
    if(old){ try{ img.src=old; }catch(e){} }
  });
}
function speakChunks(text){
  if(!nativeSpeak) return false;
  const chunks=splitForSpeech(text).filter(c=>clean(c.text));
  if(!chunks.length) return false;
  try{ speechSynthesis.cancel(); }catch(e){}
  setSpeakingState(true);
  let i=0, stopped=false;
  function next(){
    if(stopped) return;
    if(i>=chunks.length){
      setTimeout(()=>setSpeakingState(false), 180);
      return;
    }
    const c=chunks[i++];
    const u=new SpeechSynthesisUtterance(c.text);
    u.lang=c.lang;
    u.rate=c.lang==="tr-TR" ? .96 : .88;
    u.pitch=1;
    u.__longTTSAvatarSync = true;
    let ended=false;
    const watchdog=setTimeout(()=>{
      if(!ended && active) {
        try{ speechSynthesis.pause(); speechSynthesis.resume(); }catch(e){}
      }
    }, Math.max(3500, c.text.length*90));
    u.onstart=()=>setSpeakingState(true);
    u.onboundary=()=>setSpeakingState(true);
    u.onend=()=>{ ended=true; clearTimeout(watchdog); setSpeakingState(true); setTimeout(next, 80); };
    u.onerror=()=>{ ended=true; clearTimeout(watchdog); setTimeout(next, 80); };
    try{ nativeSpeak(u); }catch(e){ clearTimeout(watchdog); next(); }
  }
  next();
  return true;
}
window.DH_speakMixed = speakChunks;
window.DH_LongTTSAvatarSync = { speak:speakChunks, split:splitForSpeech, start:()=>setSpeakingState(true), stop:()=>setSpeakingState(false) };

try{
  const nativeCancel=speechSynthesis.cancel.bind(speechSynthesis);
  speechSynthesis.cancel=function(){
    setSpeakingState(false);
    return nativeCancel();
  };
}catch(e){}

try{
  if(!speechSynthesis.__longAvatarSpeakPatch){
    speechSynthesis.__longAvatarSpeakPatch=true;
    speechSynthesis.speak=function(u){
      try{
        if(u && u.__longTTSAvatarSync) return nativeSpeak(u);
        const text=String(u&&u.text||"");
        if(text.length>80 || /TÜRKÇE|ENGLISH|AÇIKLAMA|ÖZET|ğ|ü|ş|ö|ç|ı/i.test(text)){
          return speakChunks(text);
        }
        u.onstart=((old)=>function(ev){setSpeakingState(true); if(old) old.call(this,ev);})(u.onstart);
        u.onboundary=((old)=>function(ev){setSpeakingState(true); if(old) old.call(this,ev);})(u.onboundary);
        u.onend=((old)=>function(ev){setTimeout(()=>setSpeakingState(false),180); if(old) old.call(this,ev);})(u.onend);
        u.onerror=((old)=>function(ev){setTimeout(()=>setSpeakingState(false),180); if(old) old.call(this,ev);})(u.onerror);
      }catch(e){}
      return nativeSpeak(u);
    };
  }
}catch(e){}

document.addEventListener("visibilitychange",()=>{ if(document.hidden) setSpeakingState(false); });
})();