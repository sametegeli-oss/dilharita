/* youtube-session-lock.js — Aynı hesapta tek etkin YouTube eğitim oturumu. */
(function(global){
"use strict";
var gate=document.getElementById("sessionGate"),app=document.getElementById("ytApp"),HEARTBEAT=20000,LEASE=70000,timer=null,stopWatch=null;
function id(prefix){try{return prefix+crypto.getRandomValues(new Uint32Array(3)).join("-")}catch(e){return prefix+Date.now()+"-"+Math.random().toString(36).slice(2)}}
function localUid(){try{return localStorage.getItem("dh_logged_uid")||""}catch(e){return""}}
function sessionId(){try{var v=sessionStorage.getItem("dh-youtube-tab-session");if(!v){v=id("yt-");sessionStorage.setItem("dh-youtube-tab-session",v)}return v}catch(e){return id("yt-")}}
function card(title,text,action){if(!gate)return;gate.hidden=false;gate.innerHTML='<div class="yt-lock-card"><span style="font-size:36px">'+(action?"🔒":"◌")+'</span><strong>'+title+'</strong><small>'+text+'</small>'+(action||"")+'</div>'}
function ready(detail){if(gate)gate.hidden=true;if(app)app.hidden=false;global.DHYouTubeSession={ready:true,detail:detail||{}};try{global.dispatchEvent(new CustomEvent("dh-youtube-session-ready",{detail:detail||{}}))}catch(e){}}
function blocked(email){if(app)app.hidden=true;card("Bu hesap başka bir oturumda açık",(email?email+" hesabı ":"Bu hesap ")+"şu anda başka bir cihaz veya sekmede YouTube eğitimi kullanıyor. O oturum kapandıktan sonra bu ekran yaklaşık bir dakika içinde açılabilir.",'<button class="yt-top-button" onclick="location.reload()">Yeniden kontrol et</button>')}
function loginRequired(){if(app)app.hidden=true;card("Giriş yapmanız gerekiyor","Tek oturum koruması ve bulut ilerlemesi için YouTube Eğitim Stüdyosu hesapla kullanılır.",'<a class="yt-top-button" href="./login.html?next=youtube-egitim.html">Giriş yap</a>')}
function offlineReady(uid){try{if(localStorage.getItem("dh-youtube-last-owner")===uid){ready({uid:uid,offline:true});return true}}catch(e){}return false}
async function start(){
 if(/^(127\.0\.0\.1|localhost)$/.test(location.hostname)&&new URLSearchParams(location.search).has("preview")){ready({preview:true,offline:true});return}
 var uid=localUid();
 if(!navigator.onLine){if(uid&&offlineReady(uid))return;card("Bağlantı gerekiyor","Bu cihazın ilk tek-oturum yetkisini doğrulamak için bir kez internete bağlanın.","");return}
 try{
  var mods=await Promise.all([import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js"),import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js")]);
  var appMod=mods[0],authMod=mods[1],fs=mods[2],apps=appMod.getApps&&appMod.getApps(),firebaseApp=apps&&apps.length?apps[0]:null;
  if(!firebaseApp){loginRequired();return}
  var auth=authMod.getAuth(firebaseApp),db=fs.getFirestore(firebaseApp),sid=sessionId();
  var user=await new Promise(function(resolve){var done=false,off=authMod.onAuthStateChanged(auth,function(u){if(done)return;done=true;off();resolve(u)});setTimeout(function(){if(!done){done=true;off();resolve(null)}},4500)});
  if(!user){loginRequired();return}
  uid=user.uid;var ref=fs.doc(db,"users",uid,"runtime","youtube_training"),now=Date.now(),mine=false;
  await fs.runTransaction(db,async function(tx){var snap=await tx.get(ref),old=snap.exists()?snap.data():{},active=old&&old.sessionId&&+old.expiresAt>now;if(active&&old.sessionId!==sid){var err=new Error("busy");err.code="busy";throw err}tx.set(ref,{sessionId:sid,uid:uid,email:user.email||"",startedAt:old.sessionId===sid?(old.startedAt||now):now,heartbeatAt:now,expiresAt:now+LEASE,userAgent:String(navigator.userAgent||"").slice(0,180)},{merge:true});mine=true});
  if(!mine)return;
  try{localStorage.setItem("dh-youtube-last-owner",uid)}catch(e){}
  ready({uid:uid,sessionId:sid,offline:false});
  async function beat(){if(!navigator.onLine)return;var t=Date.now();try{await fs.setDoc(ref,{sessionId:sid,heartbeatAt:t,expiresAt:t+LEASE},{merge:true})}catch(e){}}
  timer=setInterval(beat,HEARTBEAT);
  stopWatch=fs.onSnapshot(ref,function(snap){var v=snap.exists()?snap.data():{};if(v.sessionId&&v.sessionId!==sid&&+v.expiresAt>Date.now()){clearInterval(timer);blocked(user.email||"")}},function(){});
  global.addEventListener("online",beat);
  global.addEventListener("pagehide",function(){clearInterval(timer);if(stopWatch)try{stopWatch()}catch(e){};try{fs.setDoc(ref,{sessionId:sid,heartbeatAt:Date.now(),expiresAt:Date.now()-1},{merge:true})}catch(e){}},{once:true});
 }catch(e){if(e&&e.code==="busy"){blocked("");return}if(uid&&offlineReady(uid))return;card("Oturum doğrulanamadı","Tek kullanıcı kilidi şu anda doğrulanamadı. Bağlantınızı kontrol edip yeniden deneyin.",'<button class="yt-top-button" onclick="location.reload()">Yeniden dene</button>')}
}
global.DHYouTubeSessionReady=new Promise(function(resolve){global.addEventListener("dh-youtube-session-ready",function(e){resolve(e.detail)},{once:true})});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})(window);
