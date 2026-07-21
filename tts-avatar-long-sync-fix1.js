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

var DH_TTS_DEFAULTS={ trRate:0.96, trPitch:1.0, enRate:0.88, enPitch:1.0 };
function dhClampNum(v,lo,hi,def){ v=parseFloat(v); if(isNaN(v))return def; return Math.min(hi,Math.max(lo,v)); }
function dhTtsCfg(){
  try{
    var s=JSON.parse(localStorage.getItem("dh-tts-voice-v1")||"null");
    if(s&&typeof s==="object") return {
      trRate:dhClampNum(s.trRate,0.5,1.6,DH_TTS_DEFAULTS.trRate),
      trPitch:dhClampNum(s.trPitch,0.5,1.6,DH_TTS_DEFAULTS.trPitch),
      enRate:dhClampNum(s.enRate,0.5,1.6,DH_TTS_DEFAULTS.enRate),
      enPitch:dhClampNum(s.enPitch,0.5,1.6,DH_TTS_DEFAULTS.enPitch),
      trVoice:s.trVoice||"", enVoice:s.enVoice||""
    };
  }catch(e){}
  return { trRate:DH_TTS_DEFAULTS.trRate,trPitch:DH_TTS_DEFAULTS.trPitch,enRate:DH_TTS_DEFAULTS.enRate,enPitch:DH_TTS_DEFAULTS.enPitch,trVoice:"",enVoice:"" };
}

function dhPickVoice(lang){
  var voices=[]; try{ voices=speechSynthesis.getVoices()||[]; }catch(e){}
  if(!voices.length) return null;
  var c=dhTtsCfg(), tr=/^tr/i.test(lang);
  var want=tr?c.trVoice:c.enVoice;
  if(want){ var m=voices.filter(function(v){ return v.voiceURI===want||v.name===want; })[0]; if(m) return m; }
  var pref=voices.filter(function(v){ return tr ? /^tr/i.test(v.lang||"") : /^en/i.test(v.lang||""); });
  return pref[0] || null;
}

function dhApplyVoice(u, lang){
  var c=dhTtsCfg(), tr=(lang==="tr-TR");
  u.rate=tr?c.trRate:c.enRate;
  u.pitch=tr?c.trPitch:c.enPitch;
  var v=dhPickVoice(lang);
  if(v){ u.voice=v; u.lang=v.lang; }
}

function dhSpeakClean(s){
  var orig=String(s||"");
  var r=orig;
  r=r.replace(/```[\s\S]*?
