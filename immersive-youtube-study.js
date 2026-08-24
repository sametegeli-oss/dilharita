/* immersive-youtube-study.js — Kullanıcının seçtiği YouTube videosundan çalışma üretir. */
(function(global){
"use strict";
var CACHE_KEY="dh-immersive-youtube-study-v1",currentId="",currentUrl="",currentScene="",busy=false;
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function videoId(input){
  var raw=String(input||"").trim(),u,id="";
  if(/^[\w-]{11}$/.test(raw))return raw;
  try{u=new URL(raw);var host=u.hostname.toLowerCase().replace(/^www\./,"");
    if(host==="youtu.be")id=u.pathname.split("/").filter(Boolean)[0]||"";
    else if(host==="youtube.com"||host==="m.youtube.com"||host==="music.youtube.com"){
      id=u.searchParams.get("v")||"";
      if(!id){var m=u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/);if(m)id=m[1];}
    }
  }catch(e){}
  return /^[\w-]{11}$/.test(id)?id:"";
}
function canonical(id){return "https://www.youtube.com/watch?v="+id}
function embed(id,start){return "https://www.youtube-nocookie.com/embed/"+id+"?rel=0&playsinline=1"+(start?"&start="+Math.max(0,+start||0)+"&autoplay=1":"")}
function cache(){try{var v=JSON.parse(localStorage.getItem(CACHE_KEY)||"{}");return v&&typeof v==="object"?v:{}}catch(e){return{}}}
function saveCache(id,data){var v=cache();v[id]={savedAt:Date.now(),data:data};try{localStorage.setItem(CACHE_KEY,JSON.stringify(v))}catch(e){}}
function cleanJson(raw){var t=String(raw||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");var a=t.indexOf("{"),b=t.lastIndexOf("}");if(a>=0&&b>a)t=t.slice(a,b+1);return t}
function normalize(raw){
  var o=typeof raw==="string"?JSON.parse(cleanJson(raw)):raw;
  if(!o||typeof o!=="object")throw new Error("Video çalışması okunamadı.");
  o.title=String(o.title||"YouTube İngilizce çalışması");
  o.level=String(o.level||"A2–B1");
  o.summaryTR=String(o.summaryTR||"");
  o.segments=Array.isArray(o.segments)?o.segments.slice(0,5):[];
  o.phrases=Array.isArray(o.phrases)?o.phrases.slice(0,8):[];
  o.quiz=Array.isArray(o.quiz)?o.quiz.slice(0,5):[];
  o.roleplay=o.roleplay&&typeof o.roleplay==="object"?o.roleplay:{};
  if(!o.segments.length&&!o.phrases.length&&!o.quiz.length)throw new Error("Gemini videodan yeterli çalışma çıkaramadı.");
  return o;
}
function prompt(url){return [
  "Bu herkese açık YouTube videosunun hem sesini hem görüntüsünü dikkatle analiz et: "+url,
  "Türkçe açıklamalı, İngilizce öğrenmeye yönelik bir mikro ders üret. Videoda gerçekten duyulmayan cümleleri alıntı gibi gösterme. Zaman damgalarını video içeriğine göre doğrula.",
  "Yalnızca geçerli JSON döndür. Şema:",
  '{"title":"kısa başlık","level":"A1|A2|B1|B2|C1","summaryTR":"2 cümlelik özet","segments":[{"startSeconds":0,"endSeconds":20,"listenTR":"dinleme görevi","questionEN":"English question","answerEN":"short expected answer"}],"phrases":[{"phrase":"exact useful English phrase","meaningTR":"Türkçe anlam","exampleEN":"new short example","timestampSeconds":0}],"quiz":[{"questionTR":"Türkçe soru","options":["A","B","C"],"correctIndex":0,"explanationTR":"kısa açıklama"}],"roleplay":{"sceneType":"hotel|restaurant|airport|doctor","title":"English scene title","aiRole":"English role","characterName":"name","missionEN":"learner mission in English","openerEN":"natural opening line","hintTR":"kısa Türkçe ipucu","quick":["three short English replies"]}}',
  "3 dinleme bölümü, 5 yararlı ifade, 3 soru ve 1 rol yapma görevi üret. startSeconds ve endSeconds tam sayı olsun. correctIndex 0 tabanlı olsun."
 ].join("\n\n")}
function time(sec){sec=Math.max(0,Math.floor(+sec||0));return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0")}
function status(text,kind){var el=$("youtubeStatus");if(!el)return;el.textContent=text||"";el.dataset.kind=kind||""}
function setBusy(on){busy=on;var form=$("youtubePickForm");if(!form)return;var b=form.querySelector("button");b.disabled=on;b.textContent=on?"Video inceleniyor…":"Çalışma oluştur"}
function seek(sec){if(!currentId)return;$("youtubePlayer").src=embed(currentId,sec);$("youtubePlayer").scrollIntoView({behavior:"smooth",block:"center"})}
function speak(text){if(!text||!("speechSynthesis" in global))return;try{speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(text);u.lang="en-GB";u.rate=.88;speechSynthesis.speak(u)}catch(e){}}
function render(data){
  var seg=data.segments.map(function(x,i){return '<article class="imm-yt-segment"><button type="button" data-yt-seek="'+(+x.startSeconds||0)+'">'+time(x.startSeconds)+'–'+time(x.endSeconds)+'</button><div><strong>'+(i+1)+'. '+esc(x.listenTR)+'</strong><p>'+esc(x.questionEN)+'</p><details><summary>Cevabı göster</summary>'+esc(x.answerEN)+'</details></div></article>'}).join("");
  var phrases=data.phrases.map(function(x){return '<article class="imm-yt-phrase"><div><strong>'+esc(x.phrase)+'</strong><span>'+esc(x.meaningTR)+'</span><small>'+esc(x.exampleEN)+'</small></div><button type="button" data-yt-speak="'+esc(x.phrase)+'" aria-label="İfadeyi sesli dinle">🔊</button>'+(isFinite(+x.timestampSeconds)?'<button type="button" data-yt-seek="'+(+x.timestampSeconds||0)+'">'+time(x.timestampSeconds)+'</button>':"")+'</article>'}).join("");
  var quiz=data.quiz.map(function(q,qi){var opts=(Array.isArray(q.options)?q.options:[]).map(function(o,oi){return '<button type="button" data-yt-quiz="'+qi+'" data-option="'+oi+'">'+esc(o)+'</button>'}).join("");return '<article class="imm-yt-quiz" data-quiz-card="'+qi+'"><strong>'+(qi+1)+'. '+esc(q.questionTR)+'</strong><div>'+opts+'</div><p hidden>'+esc(q.explanationTR)+'</p></article>'}).join("");
  var rp=data.roleplay||{};
  $("youtubeStudyContent").innerHTML='<header class="imm-yt-result-head"><div><span>'+esc(data.level)+'</span><h3>'+esc(data.title)+'</h3><p>'+esc(data.summaryTR)+'</p></div></header><section><h4>🎧 Zaman damgalı dinleme</h4>'+seg+'</section><section><h4>🗣️ Videodan ifadeler</h4><div class="imm-yt-phrase-grid">'+phrases+'</div></section><section><h4>🧠 Mini kontrol</h4>'+quiz+'</section><section class="imm-yt-role"><h4>🎭 Videoyu yaşa</h4><p><strong>'+esc(rp.title||data.title)+'</strong><br>'+esc(rp.missionEN||"")+'</p><button class="imm-primary" id="youtubeRoleplay" type="button">Bu videodan rol oyununu başlat</button></section>';
  $("youtubeStudy").hidden=false;
  Array.prototype.forEach.call(document.querySelectorAll("[data-yt-seek]"),function(b){b.onclick=function(){seek(b.getAttribute("data-yt-seek"))}});
  Array.prototype.forEach.call(document.querySelectorAll("[data-yt-speak]"),function(b){b.onclick=function(){speak(b.getAttribute("data-yt-speak"))}});
  Array.prototype.forEach.call(document.querySelectorAll("[data-yt-quiz]"),function(b){b.onclick=function(){var qi=+b.getAttribute("data-yt-quiz"),oi=+b.getAttribute("data-option"),q=data.quiz[qi],card=b.closest(".imm-yt-quiz");Array.prototype.forEach.call(card.querySelectorAll("button"),function(x){x.disabled=true;x.classList.toggle("is-correct",+x.getAttribute("data-option")===+q.correctIndex)});b.classList.add(oi===+q.correctIndex?"is-picked-correct":"is-picked-wrong");card.querySelector("p").hidden=false}});
  var rb=$("youtubeRoleplay");if(rb)rb.onclick=function(){if(global.DHImmersive&&DHImmersive.startVideoRoleplay){$("youtubeWarmup").hidden=true;DHImmersive.startVideoRoleplay({videoId:currentId,videoUrl:currentUrl,level:data.level,title:data.title,roleplay:rp})}};
  status("Çalışma hazır. Zaman düğmelerinden videonun ilgili bölümüne geçebilirsin.","ok");
}
function manual(url,id){
  if(!global.DHGemini||!DHGemini.ask){status("Video analizi için Gemini API anahtarı veya Gemini köprüsü gerekli.","error");setBusy(false);return}
  DHGemini.ask({title:"YouTube videosundan çalışma oluştur",prompt:prompt(url),hint:"Gemini'nin JSON cevabını buraya yapıştır…",parse:normalize,onResult:function(data){saveCache(id,data);render(data);setBusy(false)},onCancel:function(){setBusy(false);status("Video analizi iptal edildi.","error")}})
}
function analyze(url,id,force){
  currentId=id;currentUrl=url;$("youtubePlayer").src=embed(id);$("youtubeStudy").hidden=false;
  var old=cache()[id];if(old&&!force){render(old.data);status("Bu video için daha önce hazırlanan çalışma açıldı.","ok");return}
  setBusy(true);status("Gemini videonun sesini ve görüntüsünü inceliyor…","loading");
  if(!global.DHProviders||!DHProviders.youtubeStudy){manual(url,id);return}
  DHProviders.youtubeStudy(url,prompt(url),{max_tokens:3600}).then(function(raw){var data=normalize(raw);saveCache(id,data);render(data);setBusy(false)}).catch(function(err){if(err&&(err.code==="no-gemini-key"||err.code==="all-keys-failed")){manual(url,id);return}setBusy(false);status(err&&err.code==="rate"?"Gemini kullanım limiti doldu. Biraz sonra tekrar dene.":"Video analiz edilemedi. Videonun herkese açık olduğunu kontrol et.","error")})
}
function prepareScene(sceneId,selectedUrl){
  var selectedId=videoId(selectedUrl||"");
  if(selectedId&&selectedId===currentId){currentScene=sceneId;return}
  if(currentScene&&currentScene!==sceneId){
    currentId="";currentUrl="";
    if($("youtubeUrl"))$("youtubeUrl").value="";
    if($("youtubePlayer"))$("youtubePlayer").removeAttribute("src");
    if($("youtubeStudy"))$("youtubeStudy").hidden=true;
    if($("youtubeStudyContent"))$("youtubeStudyContent").innerHTML="";
  }
  currentScene=sceneId;
}
function boot(){
  var form=$("youtubePickForm");if(!form)return;
  form.onsubmit=function(e){e.preventDefault();if(busy)return;var id=videoId($("youtubeUrl").value);if(!id){status("Geçerli bir YouTube video adresi yapıştır.","error");$("youtubeUrl").focus();return}analyze(canonical(id),id,false)};
}
global.DHYouTubeStudy={videoId:videoId,normalize:normalize,analyze:analyze,prepareScene:prepareScene};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})(window);
