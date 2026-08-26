/* youtube-egitim.js — Trancy esinli, Dil Harita'ya özgü aktif YouTube çalışma ekranı. */
(function(global){
"use strict";
var studyApi=null,study=null,record=null,videoId="",videoUrl="",player=null,playerReady=null,ytApiReady=null,tick=null,active=-1,loopOn=false,loopIndex=-1,seekNonce=0,showEN=true,showTR=true,captionOn=true,muted=false,searchText="",saving=null,recognition=null,shadowTimer=null,studyMode="watch",autoPause=false,karaokeOn=true,autoPausedIndex=-1,selectedWord="",mediaRecorder=null,mediaStream=null,recordedChunks=[],recordedAudioUrl="",recordedAudioBlob=null,shadowStartedAt=0,shadowPlaybackAudio=null,shadowSyncTimer=null,shadowSyncOn=false,ownVoiceOn=false,ownVoiceRecords={},ownVoiceAudio=null,ownVoiceUrl="",ownVoiceKey="",ownVoiceLastTime=-1,guideVoiceOn=false,guideVoiceKey="",guideVoiceLastTime=-1,guideUtterance=null,guideLastStartedAt=0,guideLastStartedKey="",micAudioContext=null,micSource=null,micAnalyser=null,micMeterFrame=0,micMeterData=null,shadowSignalTimer=null,shadowEndTimer=null,shadowDurationTimer=null,shadowStopHandler=null,shadowTargetSeconds=0;
var alignDraft={index:-1,start:0,end:0,dirty:false,origStart:0,origEnd:0};
var pendingTranscriptMeta=null;
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function time(s){s=Math.max(0,Math.floor(+s||0));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
function previewParam(){if(!/^(127\.0\.0\.1|localhost)$/.test(location.hostname))return"";var p=new URLSearchParams(location.search).get("preview");return p?"&preview="+encodeURIComponent(p):""}
function keyOf(x){return String(x&&x.sentenceKey||(Math.round(+x.startSeconds||0)+"|"+String(x&&x.transcriptEN||"").toLowerCase().replace(/[^a-z0-9']+/g," ").trim()))}
function isReverse(){return!!(study&&study.source&&(study.source.language==="tr"||study.source.sourceLanguage==="tr"||study.source.reverseShadowing))}
function hasExactTiming(){return!!(study&&study.segments&&study.segments.length>0)}
function setTimingState(kind,text){var el=$("timingState");if(!el)return;el.dataset.state=kind;var label=el.querySelector("span");if(label)label.textContent=text||""}
function timingBlockedMessage(){return"YouTube transkriptinde kullanılabilir bir zaman damgası bulunamadı."}
function updateTimingUi(){var exact=hasExactTiming(),practiceReady=exact&&study&&study.segments.every(function(x){return String(x.transcriptEN||"").trim()}),footer=document.querySelector(".yt-transcript-footer span");document.body.classList.toggle("yt-timing-blocked",!exact);if(exact)setTimingState("exact","Zaman kaynağı · YouTube transkripti");else setTimingState("blocked","YouTube transkript zamanı bulunamadı");["loopToggle","autoPauseToggle","karaokeToggle","captionToggle","prevSentence","nextSentence"].forEach(function(id){var b=$(id);if(b)b.disabled=!exact});["startShadowing","startDictation","guideAudioMode","ownAudioMode"].forEach(function(id){var b=$(id);if(b)b.disabled=!practiceReady});var sync=$("syncSentence");if(sync){sync.disabled=false;sync.title="Bu satırı YouTube transkript zamanında aç"}if(footer)footer.innerHTML=exact?"<i></i> Aktif satır YouTube transkript zamanıyla eşleşir":"<i></i> YouTube transkript zamanı bulunamadı";Array.prototype.forEach.call(document.querySelectorAll('[data-study-mode="shadow"],[data-study-mode="dictation"]'),function(b){b.disabled=!practiceReady;b.title=practiceReady?"":exact?"İngilizce karşılık bulunmadığı için bu çalışma kapalı.":timingBlockedMessage()});if(!exact){loopOn=false;loopIndex=-1;autoPause=false;karaokeOn=false;captionOn=false;var layer=$("captionLayer");if(layer)layer.hidden=true}else{karaokeOn=true;captionOn=true;var layer2=$("captionLayer");if(layer2)layer2.hidden=false}}
function englishGuideDuration(x){var saved=+x.guideDurationSeconds||0;if(saved>0)return saved;var text=String(x.transcriptEN||""),words=text.trim().split(/\s+/).filter(Boolean).length,pauses=(text.match(/[,;:—-]/g)||[]).length*.12+(text.match(/[.!?]/g)||[]).length*.22;return Math.max(.8,Math.min(18,words/2.25+pauses+.18))}
function state(){study.userState=study.userState&&typeof study.userState==="object"?study.userState:{};var s=study.userState;s.learned=s.learned||{};s.hard=s.hard||{};s.favorites=s.favorites||{};s.words=s.words||{};s.grammar=s.grammar||{};s.shadowAttempts=s.shadowAttempts||{};return s}
function setStatus(text,kind){var el=$("homeStatus");if(!el)return;el.textContent=text||"";el.dataset.kind=kind||""}
function isYouTubeTranscriptSource(src){return!!(src&&/^youtube-(?:direct|pasted)$/.test(String(src.transcriptMode||"")))}
function closeTranscriptPaste(){if($("transcriptPasteModal"))$("transcriptPasteModal").hidden=true}
function openTranscriptPaste(meta){var id=studyApi.videoId($("videoUrl").value||videoUrl);if(!id){setStatus("Önce geçerli bir YouTube video adresi girin.","error");return}videoId=id;videoUrl=studyApi.canonical(id);pendingTranscriptMeta=meta||pendingTranscriptMeta;$("transcriptPasteModal").hidden=false;$("transcriptPasteHint").classList.remove("is-error");$("transcriptPasteHint").textContent="YouTube zamanları korunur; bölünmüş parçalar tamamlanmış cümleler hâlinde kaydedilir.";setTimeout(function(){$("transcriptPasteText").focus()},30)}
async function usePastedTranscript(){var raw=$("transcriptPasteText").value,id=studyApi.videoId($("videoUrl").value||videoUrl),hint=$("transcriptPasteHint");if(!id){hint.classList.add("is-error");hint.textContent="Geçerli YouTube adresi bulunamadı.";return}try{var meta=pendingTranscriptMeta&&pendingTranscriptMeta.videoId===id?pendingTranscriptMeta:await metaFromPlayer(id),cues=studyApi.parseYouTubeTranscriptText(raw,meta.durationSeconds);if(cues.length<2)throw new Error("En az iki zamanlı YouTube transkript satırı bulunmalıdır.");var language=$("videoLanguage")&&/^(tr|en)$/.test($("videoLanguage").value)?$("videoLanguage").value:"en",prior=study&&videoId===id?study:record&&record.videoId===id?record.study:null,data=carryStudyState(prior,studyApi.buildStudyFromYouTubeTranscript(meta,{videoId:id,sourceLanguage:language,cues:cues,translatedCues:[],timingSource:"youtube-transcript-paste",mode:"youtube-pasted"}));videoId=id;videoUrl=studyApi.canonical(id);record=await studyApi.save(id,videoUrl,data);closeTranscriptPaste();renderStudy(data);await renderLibrary();setTimingState("exact","Zaman kaynağı · yapıştırılan YouTube transkripti");try{await translateStudyWithGemini(data,false)}catch(translationError){setTranslationMessage(translationError&&translationError.code==="abort"?"Çeviri bekliyor":"Çeviri tamamlanamadı",false);renderStudy(data)}await backupYouTubeNow()}catch(e){hint.classList.add("is-error");hint.textContent=e&&e.message?e.message:"YouTube transkripti okunamadı."}}
function showTimingRequired(){if($("practiceBox"))showPractice('<div class="yt-empty-mini"><h3>⏱ Kesin zaman kaynağı gerekli</h3><p>'+esc(timingBlockedMessage())+'</p><button id="timingImportNow" type="button">SRT/VTT altyazısı yükle</button></div>');var b=$("timingImportNow");if(b)b.onclick=function(){$("subtitleFile").click()}}
function syncBadge(){var el=$("syncState");if(!el)return;var online=navigator.onLine,user=global.DHCloudSync&&DHCloudSync.user;el.querySelector("span").textContent=online?(user?"Bulut senkronu açık":"Cihazda kayıtlı"):"Çevrimdışı çalışma";el.classList.toggle("is-offline",!online)}
function setSyncBadgeText(text){var el=$("syncState"),label=el&&el.querySelector("span");if(label)label.textContent=text}
async function backupYouTubeNow(){
 if(!(global.DHCloudSync&&DHCloudSync.user&&DHCloudSync.push)){syncBadge();return{ok:false,local:true}}
 setSyncBadgeText("Buluta yedekleniyor…");
 try{
  var result=await DHCloudSync.push();
  if(result&&result.ok)setSyncBadgeText("Buluta yedeklendi");
  else if(result&&/sıra|zaten yazılıyor/i.test(String(result.error||"")))setSyncBadgeText("Bulut senkronuna alındı");
  else setSyncBadgeText("Cihazda kayıtlı · bulut bekliyor");
  setTimeout(syncBadge,2600);
  return result||{ok:false};
 }catch(e){setSyncBadgeText("Cihazda kayıtlı · bulut bekliyor");setTimeout(syncBadge,3200);return{ok:false,error:String(e&&e.message||e)}}
}
function translationSourceLanguage(data){return data&&data.source&&data.source.language==="tr"?"tr":"en"}
function translationFingerprint(data){var lang=translationSourceLanguage(data);return(data&&data.segments||[]).map(function(x,i){return i+"|"+(+x.startSeconds||0)+"|"+(lang==="tr"?x.translationTR:x.transcriptEN)}).join("\n")}
function translationRows(data,force){var lang=translationSourceLanguage(data),target=lang==="tr"?"transcriptEN":"translationTR",rows=[];(data&&data.segments||[]).forEach(function(x,i){var source=String((lang==="tr"?x.translationTR:x.transcriptEN)||"").trim();if(source&&(force||!String(x[target]||"").trim()))rows.push({index:i,id:"DH-T"+String(i+1).padStart(4,"0"),source:source})});return rows}
function translationBatches(rows){var batches=[],part=[],chars=0;rows.forEach(function(row){var size=row.source.length+48;if(part.length&&(part.length>=120||chars+size>26000)){batches.push(part);part=[];chars=0}part.push(row);chars+=size});if(part.length)batches.push(part);return batches}
function translationPrompt(batch,sourceLanguage){var target=sourceLanguage==="tr"?"İngilizce":"Türkçe",source=sourceLanguage==="tr"?"Türkçe":"İngilizce",items=batch.map(function(row){return{id:row.id,text:row.source}});return["Görevin yalnızca sabitlenmiş "+source+" cümleleri doğal ve bağlama uygun "+target+" diline çevirmektir.","Cümleleri düzeltme, yeniden yazma, birleştirme, bölme, özetleme veya sıralama. Zaman üretme. Açıklama, başlık, seviye, test ya da ek içerik üretme.","Her giriş kimliğini cevapta tam bir kez koru. Hiçbir kimliği atlama ve yeni kimlik ekleme. Komşu cümleleri yalnız bağlam için kullan; her çeviri sadece kendi cümlesinin karşılığı olsun.","Yalnızca geçerli JSON döndür. Şema: {\"translations\":[{\"id\":\"DH-T0001\",\"text\":\"yalnız çeviri\"}]}","SABİTLENMİŞ CÜMLELER:\n"+JSON.stringify(items)].join("\n\n")}
function parseTranslationReply(raw,batch){var parsed=studyApi.parseJsonReply(raw),list=parsed&&Array.isArray(parsed.translations)?parsed.translations:null;if(!list)throw new Error("Gemini cevabında translations dizisi bulunamadı.");if(list.length!==batch.length)throw new Error("Gemini "+batch.length+" çeviri yerine "+list.length+" çeviri döndürdü; hiçbir cümle değiştirilmedi.");var expected={},result={};batch.forEach(function(row){expected[row.id]=1});list.forEach(function(item){var id=String(item&&item.id||""),text=String(item&&item.text||"").trim();if(!expected[id])throw new Error("Gemini bilinmeyen bir cümle kimliği döndürdü: "+id);if(result[id])throw new Error("Gemini aynı cümle kimliğini iki kez döndürdü: "+id);if(!text)throw new Error(id+" çevirisi boş geldi.");result[id]=text});batch.forEach(function(row){if(!result[row.id])throw new Error(row.id+" çevirisi eksik.")});return result}
function setTranslationMessage(text,busy){var b=$("translateTranscript"),label=b&&b.querySelector("span");if(label)label.textContent=text||"Gemini ile çevir";if(b)b.disabled=!!busy}
function updateTranslationButton(data){var b=$("translateTranscript"),label=b&&b.querySelector("span");if(!b||!data)return;var missing=translationRows(data,false).length,total=(data.segments||[]).length;b.disabled=false;b.title=missing?missing+" cümlenin yalnız çevirisini Gemini'den al":"Mevcut "+total+" çeviriyi Gemini ile yeniden oluştur";if(label)label.textContent=missing?"Gemini çeviri ("+missing+")":"Çevirileri yenile"}
async function translateStudyWithGemini(data,force){
 if(!data||!data.segments||!data.segments.length)throw new Error("Çevrilecek cümle bulunamadı.");
 if(!(global.DHProviders&&DHProviders.geminiText))throw new Error("Gemini çeviri bağlantısı yüklenmedi.");
 var language=translationSourceLanguage(data),targetField=language==="tr"?"transcriptEN":"translationTR",rows=translationRows(data,!!force),batches=translationBatches(rows),fingerprint=translationFingerprint(data),applied=0;
 if(!rows.length){updateTranslationButton(data);return data}
 try{
  for(var i=0;i<batches.length;i++){
   var batch=batches[i];setTranslationMessage("Gemini çeviri "+(i+1)+"/"+batches.length,true);
   var raw=await DHProviders.geminiText([{role:"system",content:"Sen yalnızca verilen sabit cümleleri çeviren, JSON dışında hiçbir şey yazmayan profesyonel bir çevirmensin."},{role:"user",content:translationPrompt(batch,language)}],{title:"YouTube cümle çevirileri · Bölüm "+(i+1)+"/"+batches.length,temperature:.1,max_tokens:16000,json:true});
   if(translationFingerprint(data)!==fingerprint)throw new Error("Çeviri sırasında özgün transkript değişti; Gemini cevabı uygulanmadı.");
   var translations=parseTranslationReply(raw,batch);
   batch.forEach(function(row){data.segments[row.index][targetField]=translations[row.id]});
   data.source.translationSource="gemini-sentence-only";data.source.translationLanguage=language==="tr"?"en":"tr";data.source.translationUpdatedAt=Date.now();data.source.translationCount=(data.segments||[]).filter(function(x){return String(x[targetField]||"").trim()}).length;
   record=await studyApi.save(videoId,videoUrl,data);applied+=batch.length;
  }
  renderStudy(data);await renderLibrary();setTranslationMessage(applied+" çeviri hazır",false);setTimeout(function(){updateTranslationButton(data)},2600);return data;
 }catch(e){if(applied){renderStudy(data);await renderLibrary()}updateTranslationButton(data);throw e}
}
function loadYT(){if(global.YT&&YT.Player)return Promise.resolve();if(ytApiReady)return ytApiReady;ytApiReady=new Promise(function(resolve,reject){var old=global.onYouTubeIframeAPIReady;global.onYouTubeIframeAPIReady=function(){if(typeof old==="function")try{old()}catch(e){}resolve()};var s=document.createElement("script");s.src="https://www.youtube.com/iframe_api";s.onerror=function(){reject(new Error("YouTube oynatıcı yüklenemedi"))};document.head.appendChild(s)});return ytApiReady}
function resetPlayer(){stopOwnVoiceAudio();cancelGuideVoice();try{if(player&&player.destroy)player.destroy()}catch(e){}player=null;playerReady=null;var old=$("ytPlayer"),host=old&&old.parentNode;if(host){var n=document.createElement("div");n.id="ytPlayer";n.className="yt-player";n.setAttribute("aria-label","YouTube video oynatıcı");host.replaceChild(n,old)}}
function createPlayer(id){if(!navigator.onLine)return Promise.reject(new Error("offline"));if(player&&videoId===id)return playerReady||Promise.resolve(player);resetPlayer();$("playerLoading").hidden=false;playerReady=loadYT().then(function(){return new Promise(function(resolve,reject){var settled=false;player=new YT.Player("ytPlayer",{host:"https://www.youtube-nocookie.com",videoId:id,playerVars:{playsinline:1,rel:0,cc_load_policy:0,controls:0,origin:location.origin&&location.origin!=="null"?location.origin:undefined},events:{onReady:function(){settled=true;$("playerLoading").hidden=true;if(studyMode==="shadow")forceShadowMute();else if(ownVoiceOn||guideVoiceOn)forceOwnVoiceMute();resolve(player);startTicker()},onStateChange:function(){if(studyMode==="shadow")forceShadowMute();else if(ownVoiceOn)handleOwnVoicePlayerState();else if(guideVoiceOn)handleGuidePlayerState();updatePlayButton()},onError:function(){if(!settled)reject(new Error("Video oynatılamadı"))}}})})});return playerReady}
async function metaFromPlayer(id){var p=await createPlayer(id);for(var i=0;i<24;i++){var d=0,info={};try{d=Math.floor(+p.getDuration()||0);info=p.getVideoData&&p.getVideoData()||{}}catch(e){}if(d>0)return{videoId:id,title:String(info.title||("YouTube "+id)),author:String(info.author||""),durationSeconds:d,verifiedAt:Date.now()};await new Promise(function(r){setTimeout(r,250)})}throw new Error("Video süresi okunamadı")}
function updatePlayButton(){var b=$("playToggle"),playing=false;try{playing=player&&global.YT&&player.getPlayerState()===YT.PlayerState.PLAYING}catch(e){}if(b)b.textContent=playing?"❚❚":"▶"}
function playPause(){if(!player)return;try{if(studyMode==="shadow")forceShadowMute();else if(ownVoiceOn||guideVoiceOn)forceOwnVoiceMute();var playing=global.YT&&player.getPlayerState()===YT.PlayerState.PLAYING;playing?player.pauseVideo():player.playVideo()}catch(e){}}
function seek(sec,play){if(!player)return;var at=Math.max(0,+sec||0),token=++seekNonce;function apply(){if(!player||token!==seekNonce)return;try{player.seekTo(at,true);if(play!==false)player.playVideo()}catch(e){}}apply();setTimeout(function(){if(!player||token!==seekNonce)return;try{var actual=+player.getCurrentTime()||0,stateNow=global.YT&&player.getPlayerState();if(Math.abs(actual-at)>.85||(play!==false&&stateNow!==YT.PlayerState.PLAYING))apply()}catch(e){}},220);setTimeout(function(){if(!player||token!==seekNonce)return;try{var actual=+player.getCurrentTime()||0;if(Math.abs(actual-at)>1.15)apply()}catch(e){}},520)}
function setLoop(on){if(on&&!hasExactTiming()){loopOn=false;loopIndex=-1;showTimingRequired();return}loopOn=!!on;loopIndex=loopOn&&active>=0?active:-1;var b=$("loopToggle");b.classList.toggle("is-active",loopOn);b.setAttribute("aria-pressed",String(loopOn));if(loopOn&&loopIndex>=0&&study)seek(study.segments[loopIndex].startSeconds,true)}
function findActive(sec){if(!study||!study.segments.length)return-1;var a=study.segments,lo=0,hi=a.length-1,best=-1;while(lo<=hi){var m=(lo+hi)>>1;if(+a[m].startSeconds<=sec+.04){best=m;lo=m+1}else hi=m-1}if(best<0)return-1;return sec<=segmentEnd(best)+.04?best:-1}
function segmentEnd(i){if(!study||!study.segments[i])return 0;var x=study.segments[i],start=+x.startSeconds||0,end=+x.endSeconds||0;if(end<=start+.18)end=start+2;return Math.max(start+.18,end)}
function startTicker(){clearInterval(tick);tick=setInterval(function(){if(!player)return;var now=0,dur=0;try{now=+player.getCurrentTime()||0;dur=+player.getDuration()||0}catch(e){}$("currentTime").textContent=time(now);$("durationTime").textContent=time(dur);var pct=dur?Math.min(100,now/dur*100):0;$("timelineFill").style.width=pct+"%";$("timelineThumb").style.left=pct+"%";if($("alignCursor")&&dur)$("alignCursor").style.left=pct+"%";if(study&&study.segments.length){if(loopOn&&loopIndex>=0&&study.segments[loopIndex]){var lx=study.segments[loopIndex],ls=+lx.startSeconds||0,le=segmentEnd(loopIndex);if(active!==loopIndex)setActive(loopIndex,false);updateKaraoke(now,lx);if(ownVoiceOn&&studyMode!=="shadow")syncOwnVoice(loopIndex,now);else if(guideVoiceOn&&studyMode!=="shadow")syncGuideVoice(loopIndex,now);if(now>=le-.1||now<ls-.45)seek(ls,true)}else{var i=findActive(now);if(i>=0&&i!==active){setActive(i,true);autoPausedIndex=-1}if(i<0){$("captionEN").textContent="";$("captionTR").textContent=""}else{var x=study.segments[i],end=segmentEnd(i);updateKaraoke(now,x);if(ownVoiceOn&&studyMode!=="shadow")syncOwnVoice(i,now);else if(guideVoiceOn&&studyMode!=="shadow")syncGuideVoice(i,now);if(autoPause&&autoPausedIndex!==i&&now>=end-.08){autoPausedIndex=i;try{player.pauseVideo()}catch(e){}}}}}updatePlayButton()},100)}
function karaokeHtml(text,current){var words=String(text||"").trim().split(/\s+/);return words.map(function(w,i){return'<span class="yt-karaoke-word'+(i<current?' is-spoken':i===current?' is-current':'')+'">'+esc(w)+'</span>'}).join("")}
function updateKaraoke(now,x){if(!captionOn||!showEN||!karaokeOn||!x)return;var words=String(x.transcriptEN||"").trim().split(/\s+/),span=Math.max(.3,(+x.endSeconds||+x.startSeconds+2)-+x.startSeconds),idx=Math.min(words.length-1,Math.max(0,Math.floor(((now-+x.startSeconds)/span)*words.length)));$("captionEN").innerHTML=karaokeHtml(x.transcriptEN,idx)}
function sentenceWords(text){return String(text||"").split(/(\s+|[^A-Za-z'-]+)/).map(function(part){if(/^[A-Za-z][A-Za-z'-]*$/.test(part))return'<button type="button" class="yt-word" data-word="'+esc(part)+'">'+esc(part)+'</button>';return esc(part)}).join("")}

function minAllowedStart(idx){
 if(!study||!study.segments||idx<=0)return 0;
 var prev=study.segments[idx-1];
 return Math.round(((+prev.endSeconds||prev.startSeconds+0.2)+0.05)*100)/100;
}

function normalizeStudyTimelines(){
 if(!study||!study.segments)return;
 study.segments.forEach(function(x){
  x.startSeconds=Math.max(0,Math.round((+x.startSeconds||0)*100)/100);
  x.endSeconds=Math.max(x.startSeconds+0.2,Math.round((+x.endSeconds||x.startSeconds+2)*100)/100);
  x.timingVerified=true;
  x.timingConfidence=1;
  x.captionAligned=true;
 });
 study.segments.sort(function(a,b){return a.startSeconds-b.startSeconds});
 for(var i=0;i<study.segments.length-1;i++){
  var cur=study.segments[i],next=study.segments[i+1];
  if(cur.endSeconds>next.startSeconds){
   var span=next.endSeconds-next.startSeconds;
   next.startSeconds=Math.round((cur.endSeconds+0.05)*100)/100;
   next.endSeconds=Math.round((next.startSeconds+Math.max(0.2,span))*100)/100;
  }
 }
 if(study.source){
  study.source.exactTiming=true;
  study.source.timingVersion=6;
 }
}

function initAlignDraft(idx){
 if(!study||idx<0||!study.segments[idx])return;
 var x=study.segments[idx];
 alignDraft.index=idx;
 alignDraft.start=+x.startSeconds||0;
 alignDraft.end=segmentEnd(idx);
 alignDraft.origStart=+x.startSeconds||0;
 alignDraft.origEnd=segmentEnd(idx);
 alignDraft.dirty=false;
 updateTimelineAlignerUi();
}

function updateTimelineAlignerUi(){
 if(!study||active<0||!study.segments[active])return;
 var x=study.segments[active],dur=player&&player.getDuration?+player.getDuration()||0:0;
 if(!dur&&study.source)dur=+study.source.durationSeconds||0;
 if(dur<=0)return;

 if(alignDraft.index!==active){
  initAlignDraft(active);
  return;
 }

 var targetEl=$("alignTargetText"),block=$("alignSegmentBlock"),times=$("alignTimesText"),durEl=$("alignDurationText"),saveBtn=$("alignSaveBtn");
 if(targetEl){
  targetEl.textContent=(active+1)+". "+(x.transcriptEN||"—")+" ("+(x.translationTR||"")+")";
 }

 var st=alignDraft.start,en=alignDraft.end;
 var lengthSec=Math.max(0.2,en-st);

 var startPct=Math.max(0,Math.min(100,(st/dur)*100));
 var endPct=Math.max(startPct+0.3,Math.min(100,(en/dur)*100));

 if(block){
  block.style.left=startPct+"%";
  block.style.width=Math.max(0.6,endPct-startPct)+"%";
 }
 if(times){
  times.textContent=st.toFixed(1)+"s → "+en.toFixed(1)+"s";
 }
 if(durEl){
  durEl.textContent=lengthSec.toFixed(1)+" sn";
 }
 if(saveBtn){
  saveBtn.classList.toggle("has-changes",alignDraft.dirty);
  saveBtn.textContent=alignDraft.dirty?"✓ Zamanı Kaydet *":"✓ Zamanı Kaydet";
 }
}

function setActive(i,follow){if(!study||!study.segments.length)return;i=Math.max(0,Math.min(study.segments.length-1,+i||0));var changed=i!==active;active=i;var x=study.segments[i],s=state(),k=keyOf(x);$("activeIndex").textContent="CÜMLE "+(i+1)+" / "+study.segments.length;$("learningEN").innerHTML=sentenceWords(x.transcriptEN);$("learningTR").textContent=x.translationTR||"";$("captionEN").innerHTML=showEN&&captionOn?(karaokeOn?karaokeHtml(x.transcriptEN,0):esc(x.transcriptEN)):"";$("captionTR").textContent=showTR&&captionOn?x.translationTR:"";$("favoriteSentence").classList.toggle("is-favorite",!!s.favorites[k]);$("favoriteSentence").textContent=s.favorites[k]?"♥":"♡";$("markLearned").classList.toggle("is-active",!!s.learned[k]);$("markHard").classList.toggle("is-active",!!s.hard[k]);var sync=$("syncSentence");if(sync){sync.classList.add("is-synced");sync.textContent="▶ YouTube zamanı"}Array.prototype.forEach.call(document.querySelectorAll(".yt-segment.is-active"),function(n){n.classList.remove("is-active")});var row=document.querySelector('.yt-segment[data-index="'+i+'"]');if(row){row.classList.add("is-active");if(follow&&changed)row.scrollIntoView({block:"center",behavior:"smooth"})}if(changed){s.lastIndex=i;s.lastTime=+x.startSeconds||0;s.lastOpenedAt=Date.now();$("wordActionBar").hidden=true;selectedWord="";initAlignDraft(i);scheduleSave()}bindWordButtons();updateTimelineAlignerUi();if(studyMode==="shadow"&&changed)renderShadowReady();if(studyMode==="dictation"&&changed)renderDictationReady();if(!$("grammarPanel").hidden)renderGrammar()}
function bindWordButtons(){Array.prototype.forEach.call(document.querySelectorAll(".yt-word"),function(b){b.onclick=function(){selectedWord=String(b.getAttribute("data-word")||"").toLowerCase().replace(/[^a-z'-]/g,"");$("selectedWord").textContent=selectedWord;$("wordActionBar").hidden=!selectedWord;if(global.DHWordPop&&DHWordPop.lookup)DHWordPop.lookup(selectedWord)}})}
function highlight(text,q){if(!q)return esc(text);var safe=esc(text),needle=esc(q).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");try{return safe.replace(new RegExp("("+needle+")","ig"),"<mark>$1</mark>")}catch(e){return safe}}
function renderTranscript(){var box=$("transcriptList");if(!study){box.innerHTML="";return}var s=state(),q=searchText.trim().toLowerCase(),html=[],exact=hasExactTiming();study.segments.forEach(function(x,i){if(q&&(String(x.transcriptEN||"")+" "+String(x.translationTR||"")).toLowerCase().indexOf(q)<0)return;var k=keyOf(x);html.push('<button class="yt-segment'+(i===active?' is-active':'')+(s.learned[k]?' is-learned':'')+(ownVoiceRecords[k]?' has-shadow-audio':'')+'" data-index="'+i+'" type="button"><time>'+time(x.startSeconds)+'</time><span class="yt-segment-main"><span class="yt-segment-en" lang="en">'+highlight(x.transcriptEN,searchText)+'</span><span class="yt-segment-tr" lang="tr">'+highlight(x.translationTR,searchText)+'</span>'+(ownVoiceRecords[k]?'<small class="yt-shadow-audio-badge">🎤 Shadow kaydı</small>':'')+'</span></button>')});box.innerHTML=html.join("")||'<div class="yt-empty-mini">Aramayla eşleşen cümle yok.</div>';Array.prototype.forEach.call(box.querySelectorAll(".yt-segment"),function(b){b.onclick=function(){var idx=+b.getAttribute("data-index");setActive(idx,true);if(exact){seek(study.segments[idx].startSeconds,true);if(loopOn)setLoop(true)}else showTimingRequired()}});$("sentenceCount").textContent=String(study.segments.length)}
function renderPhrases(){var box=$("phrasesPanel"),duration=+(study&&study.source&&study.source.durationSeconds)||0;box.innerHTML=(study&&study.phrases||[]).map(function(x,i){var st=Math.max(0,+x.timestampSeconds||0),en=Math.min(duration||st+10,st+10);return'<article class="yt-phrase-card"><strong>'+esc(x.phrase)+'</strong><span>'+esc(x.meaningTR)+'</span><small>'+esc(x.exampleEN)+'</small><button type="button" data-phrase="'+i+'">▶ '+time(st)+' kesitini çalış</button></article>'}).join("")||'<div class="yt-empty-mini">Bu videoda ayrıca kaydedilmiş ifade yok.</div>';Array.prototype.forEach.call(box.querySelectorAll("[data-phrase]"),function(b){b.onclick=function(){var x=study.phrases[+b.getAttribute("data-phrase")],idx=findActive(+x.timestampSeconds||0);setActive(idx,true);setLoop(true)}})}
function renderQuiz(){var box=$("quizPanel");box.innerHTML=(study&&study.quiz||[]).map(function(q,i){return'<article class="yt-quiz-card"><strong>'+(i+1)+'. '+esc(q.questionTR)+'</strong><div class="yt-quiz-options">'+(q.options||[]).map(function(o,j){return'<button type="button" data-q="'+i+'" data-o="'+j+'">'+esc(o)+'</button>'}).join("")+'</div><p hidden>'+esc(q.explanationTR||"")+'</p></article>'}).join("")||'<div class="yt-empty-mini">Bu video için test bulunmuyor.</div>';Array.prototype.forEach.call(box.querySelectorAll("[data-q]"),function(b){b.onclick=function(){var qi=+b.getAttribute("data-q"),oi=+b.getAttribute("data-o"),q=study.quiz[qi],card=b.closest(".yt-quiz-card");Array.prototype.forEach.call(card.querySelectorAll("button"),function(o){o.disabled=true;o.classList.toggle("is-correct",+o.getAttribute("data-o")===+q.correctIndex)});if(oi!==+q.correctIndex)b.classList.add("is-wrong");card.querySelector("p").hidden=false}})}
function renderWordbook(){if(!study)return;var words=state().words,keys=Object.keys(words).sort(),box=$("wordbookPanel");$("wordCount").textContent=String(keys.length);box.innerHTML='<section class="yt-wordbook-head"><h3>Video kelime defteri</h3><p>Kelimeyi geçtiği cümle ve zaman damgasıyla saklar; IndexedDB ve bulut yedeğine dahildir.</p><div class="yt-wordbook-actions"><button type="button" id="wordbookExport">⇩ Markdown indir</button><button type="button" id="wordbookClear">Tümünü temizle</button></div></section>'+keys.map(function(k){var w=words[k];return'<article class="yt-word-card"><header><strong>'+esc(k)+'</strong><time>'+time(w.startSeconds)+'</time></header><p>'+esc(w.sentenceEN||"")+'</p><small>'+esc(w.sentenceTR||"")+'</small><footer><button type="button" data-word-seek="'+esc(k)+'">▶ Videoda aç</button><button type="button" data-word-explain="'+esc(k)+'">✦ Açıkla</button><button class="yt-word-remove" type="button" data-word-remove="'+esc(k)+'">Sil</button></footer></article>'}).join("")+(keys.length?"":'<div class="yt-empty-mini">İngilizce cümlede bir kelimeye dokunun ve “Kelime defterine ekle”yi seçin.</div>');Array.prototype.forEach.call(box.querySelectorAll("[data-word-seek]"),function(b){b.onclick=function(){var w=words[b.getAttribute("data-word-seek")];if(w){setActive(+w.index||0,true);seek(+w.startSeconds||0,true)}}});Array.prototype.forEach.call(box.querySelectorAll("[data-word-explain]"),function(b){b.onclick=function(){selectedWord=b.getAttribute("data-word-explain");askQuestion("Bu cümledeki ‘"+selectedWord+"’ kelimesini; anlamı, türü ve doğal kullanım kalıbıyla açıkla.");$("aiModal").hidden=false}});Array.prototype.forEach.call(box.querySelectorAll("[data-word-remove]"),function(b){b.onclick=function(){delete words[b.getAttribute("data-word-remove")];renderWordbook();scheduleSave()}});var ex=$("wordbookExport"),cl=$("wordbookClear");if(ex)ex.onclick=function(){downloadText(safeName(study.title)+"-kelime-defteri.md",wordbookMarkdown(),"text/markdown;charset=utf-8")};if(cl)cl.onclick=function(){if(keys.length&&confirm("Bu videonun kelime defteri temizlensin mi?")){state().words={};renderWordbook();scheduleSave()}}}
function saveWord(){if(!selectedWord||active<0)return;var x=study.segments[active];state().words[selectedWord]={word:selectedWord,index:active,startSeconds:+x.startSeconds||0,sentenceEN:x.transcriptEN,sentenceTR:x.translationTR,savedAt:Date.now()};renderWordbook();scheduleSave();$("saveSelectedWord").textContent="✓ Deftere eklendi";setTimeout(function(){if($("saveSelectedWord"))$("saveSelectedWord").textContent="＋ Kelime defterine ekle"},1500)}
function renderGrammar(){if(!study||active<0)return;var x=study.segments[active],cached=state().grammar[keyOf(x)]||"",box=$("grammarPanel");box.innerHTML='<section class="yt-grammar-hero"><h3>Bağlamlı dilbilgisi laboratuvarı</h3><p>Aktif cümlenin yapısını, kelime türlerini, kalıplarını ve doğal kullanımını Gemini ile inceler.</p><button id="analyzeGrammar" type="button">✦ Aktif cümleyi çözümle</button></section><div class="yt-grammar-result" id="grammarResult">'+(cached?esc(cached):"Henüz çözümleme yapılmadı.")+'</div>';$("analyzeGrammar").onclick=analyzeGrammar}
function analyzeGrammar(){if(active<0)return;var x=study.segments[active],out=$("grammarResult"),prompt=["Sen deneyimli bir İngilizce öğretmenisin.","Seviye: "+study.level,"Video bağlamındaki cümle: "+x.transcriptEN,"Türkçesi: "+x.translationTR,"Şu başlıklarla kısa ve net Türkçe çözümle: 1) Cümle yapısı 2) Kelime türleri 3) Önemli kalıp/collocation 4) Neden bu zaman/yapı 5) Aynı yapıyla iki doğal örnek. Markdown kullanma."].join("\n");out.textContent="Gemini cümleyi çözümlüyor…";out.classList.add("is-loading");if(!global.DHGemini||!DHGemini.ask){out.textContent="Gemini köprüsü yüklenmedi.";return}DHGemini.ask({title:"Video cümlesi · Dilbilgisi çözümleme",prompt:prompt,hint:"Gemini çözümlemesini buraya yapıştır…",parse:function(t){return String(t||"").replace(/^\s*DH-ID:[^\n]*\n/i,"").trim()},onResult:function(t){out.classList.remove("is-loading");out.textContent=t||"Çözümleme alınamadı.";state().grammar[keyOf(x)]=t;scheduleSave()},onCancel:function(){out.classList.remove("is-loading");out.textContent="Çözümleme iptal edildi."}})}
function forceShadowMute(){try{if(player)player.mute()}catch(e){}var b=$("soundToggle");if(b){b.textContent="🔇";b.disabled=true;b.title="Shadowing sırasında yalnız görüntü oynar; video sesi kapalıdır."}}
function restoreSound(){if(ownVoiceOn||guideVoiceOn)return forceOwnVoiceMute();var b=$("soundToggle");if(b){b.disabled=false;b.title="";b.textContent=muted?"🔇":"🔊"}try{if(player){if(muted)player.mute();else player.unMute()}}catch(e){}}
function stopOwnVoiceAudio(){if(ownVoiceAudio){try{ownVoiceAudio.pause();ownVoiceAudio.currentTime=0}catch(e){}}ownVoiceAudio=null;if(ownVoiceUrl){try{URL.revokeObjectURL(ownVoiceUrl)}catch(e){}}ownVoiceUrl="";ownVoiceKey="";ownVoiceLastTime=-1}
function cancelGuideVoice(){try{if(global.speechSynthesis)speechSynthesis.cancel()}catch(e){}guideUtterance=null;guideVoiceKey="";guideVoiceLastTime=-1}
function forceOwnVoiceMute(){try{if(player)player.mute()}catch(e){}var b=$("soundToggle");if(b){b.textContent="🔇";b.disabled=true;b.title="Kendi sesim seçiliyken YouTube'un orijinal sesi kapalıdır."}}
function forceOriginalFallback(){try{if(player)player.unMute()}catch(e){}var b=$("soundToggle");if(b){b.textContent="🔊";b.disabled=true;b.title="Bu cümlede Shadowing kaydınız olmadığı için orijinal ses kullanılıyor."}}
function updateAudioSourceUi(){var reverse=isReverse(),exact=hasExactTiming(),original=$("originalAudioMode"),guide=$("guideAudioMode"),own=$("ownAudioMode"),count=Object.keys(ownVoiceRecords).length;if($("ownAudioCount"))$("ownAudioCount").textContent=String(count);if(original){original.querySelector("span").textContent=reverse?"Orijinal Türkçe":"Orijinal ses";original.classList.toggle("is-active",!ownVoiceOn&&!guideVoiceOn);original.setAttribute("aria-pressed",String(!ownVoiceOn&&!guideVoiceOn))}if(guide){guide.hidden=!reverse;guide.disabled=!exact;guide.classList.toggle("is-active",guideVoiceOn);guide.setAttribute("aria-pressed",String(guideVoiceOn));guide.title=exact?"Doğal İngilizce karşılığı rehber sesle dinle.":timingBlockedMessage()}if(own){own.querySelector("span").textContent=reverse?"Kendi İngilizcem":"Kendi sesim";own.disabled=!exact||!count;own.classList.toggle("is-active",ownVoiceOn);own.setAttribute("aria-pressed",String(ownVoiceOn));own.title=!exact?timingBlockedMessage():(count?(count+" cümlede kayıtlı Shadowing sesiniz var. Kayıtsız cümlelerde "+(reverse?"İngilizce rehber":"orijinal")+" ses kullanılır."):"Önce en az bir cümlede Shadowing kaydı oluşturun.")}}
async function loadOwnVoiceRecords(){var requestedId=videoId;ownVoiceRecords={};stopOwnVoiceAudio();if(studyApi&&studyApi.allShadowAudio&&requestedId){var rows=await studyApi.allShadowAudio(requestedId).catch(function(){return[]});if(requestedId!==videoId||!study)return;rows.forEach(function(r){if(r&&r.sentenceKey&&r.blob)ownVoiceRecords[r.sentenceKey]=r})}if(ownVoiceOn&&!Object.keys(ownVoiceRecords).length)ownVoiceOn=false;updateAudioSourceUi();renderTranscript()}
function setAudioSource(source){var wantOwn=source==="own",wantGuide=source==="guide"&&isReverse();if((wantOwn||wantGuide)&&!hasExactTiming()){showTimingRequired();return}if(wantOwn&&!Object.keys(ownVoiceRecords).length){ownVoiceOn=false;guideVoiceOn=false;updateAudioSourceUi();return}ownVoiceOn=wantOwn;guideVoiceOn=wantGuide;if(!wantOwn&&!wantGuide)muted=false;stopOwnVoiceAudio();cancelGuideVoice();updateAudioSourceUi();if(studyMode==="shadow")return forceShadowMute();var now=0;try{now=+player.getCurrentTime()||0;if(wantOwn||wantGuide)player.playVideo()}catch(e){}if(ownVoiceOn){forceOwnVoiceMute();syncOwnVoice(findActive(now),now,true)}else if(guideVoiceOn){forceOwnVoiceMute();syncGuideVoice(findActive(now),now,true)}else restoreSound()}
function playGuideVoiceSegment(i,now){if(studyMode==="shadow"||!isReverse()||!study||!study.segments[i]||!("speechSynthesis" in global))return;var x=study.segments[i],k=keyOf(x),stamp=Date.now();if(k===guideLastStartedKey&&stamp-guideLastStartedAt<900)return;cancelGuideVoice();guideLastStartedKey=k;guideLastStartedAt=stamp;guideVoiceKey=k;guideVoiceLastTime=now;forceOwnVoiceMute();try{var u=new SpeechSynthesisUtterance(x.transcriptEN);guideUtterance=u;u.lang="en-US";u.rate=.92;u.pitch=1;u.onend=function(){if(guideUtterance===u)guideUtterance=null};speechSynthesis.speak(u)}catch(e){}}
function syncGuideVoice(i,now,force){if(!guideVoiceOn||i<0)return;var x=study&&study.segments[i],k=x?keyOf(x):"",jumped=guideVoiceLastTime>=0&&now<guideVoiceLastTime-.45;forceOwnVoiceMute();if(force||k!==guideVoiceKey||jumped)playGuideVoiceSegment(i,now);guideVoiceLastTime=now}
function playOwnVoiceSegment(i,now){if(!ownVoiceOn||studyMode==="shadow"||!study||!study.segments[i])return;var x=study.segments[i],k=keyOf(x),row=ownVoiceRecords[k];stopOwnVoiceAudio();ownVoiceKey=k;ownVoiceLastTime=now;if(!row||!row.blob){if(isReverse()){forceOwnVoiceMute();playGuideVoiceSegment(i,now)}else forceOriginalFallback();return}cancelGuideVoice();forceOwnVoiceMute();try{ownVoiceUrl=URL.createObjectURL(row.blob);var audio=new Audio(ownVoiceUrl);ownVoiceAudio=audio;var offset=Math.max(0,now-(+x.startSeconds||0));function start(){if(!ownVoiceOn||ownVoiceAudio!==audio||studyMode==="shadow")return;try{if(isFinite(audio.duration)&&audio.duration>0)audio.currentTime=Math.min(offset,Math.max(0,audio.duration-.05));audio.play().catch(function(){})}catch(e){}}if(audio.readyState>=1)start();else audio.addEventListener("loadedmetadata",start,{once:true})}catch(e){}}
function syncOwnVoice(i,now,force){if(!ownVoiceOn||i<0)return;var x=study&&study.segments[i],k=x?keyOf(x):"",hasOwn=!!ownVoiceRecords[k],jumped=ownVoiceLastTime>=0&&(now<ownVoiceLastTime-.45||now>ownVoiceLastTime+.8);if(hasOwn)forceOwnVoiceMute();else if(isReverse())forceOwnVoiceMute();else forceOriginalFallback();if(force||k!==ownVoiceKey||jumped)playOwnVoiceSegment(i,now);ownVoiceLastTime=now}
function handleOwnVoicePlayerState(){var playing=false,now=0;try{playing=global.YT&&player.getPlayerState()===YT.PlayerState.PLAYING;now=+player.getCurrentTime()||0}catch(e){}if(!playing){if(ownVoiceAudio)try{ownVoiceAudio.pause()}catch(e){};ownVoiceLastTime=-1}else syncOwnVoice(findActive(now),now,true)}
function handleGuidePlayerState(){var stateNow=-1,now=0;try{stateNow=global.YT&&player.getPlayerState();now=+player.getCurrentTime()||0}catch(e){}if(global.YT&&(stateNow===YT.PlayerState.PAUSED||stateNow===YT.PlayerState.ENDED))cancelGuideVoice();else if(stateNow===YT.PlayerState.PLAYING)syncGuideVoice(findActive(now),now,false)}
function persistShadowRecording(x,attempt){if(!recordedAudioBlob||!studyApi||!studyApi.saveShadowAudio)return Promise.resolve(null);var k=keyOf(x),savedVideoId=videoId,blob=recordedAudioBlob;return studyApi.saveShadowAudio(savedVideoId,k,blob,{startSeconds:x.startSeconds,endSeconds:x.endSeconds,transcriptEN:x.transcriptEN,durationSeconds:attempt&&attempt.elapsed,score:attempt&&attempt.textScore}).then(function(row){if(savedVideoId===videoId&&study){ownVoiceRecords[k]=row;updateAudioSourceUi();renderTranscript();var note=$("shadowSaveState");if(note)note.textContent="✓ Shadowing kaydı IndexedDB’ye kalıcı olarak kaydedildi."}return row}).catch(function(){var note=$("shadowSaveState");if(note)note.textContent="Ses kaydı kalıcı olarak saklanamadı.";return null})}
function stopShadowSync(){shadowSyncOn=false;clearTimeout(shadowSyncTimer);shadowSyncTimer=null;if(shadowPlaybackAudio){try{shadowPlaybackAudio.pause();shadowPlaybackAudio.currentTime=0}catch(e){}}shadowPlaybackAudio=null}
function startShadowSync(x){stopShadowSync();if(!recordedAudioUrl||studyMode!=="shadow")return;var xIndex=study&&study.segments?study.segments.indexOf(x):-1;if(xIndex<0)xIndex=active;shadowSyncOn=true;forceShadowMute();setLoop(true);function cycle(){if(!shadowSyncOn||studyMode!=="shadow"||active!==xIndex)return stopShadowSync();forceShadowMute();loopIndex=xIndex;seek(+x.startSeconds||0,true);try{if(shadowPlaybackAudio){shadowPlaybackAudio.pause();shadowPlaybackAudio.currentTime=0}shadowPlaybackAudio=new Audio(recordedAudioUrl);shadowPlaybackAudio.currentTime=0;shadowPlaybackAudio.play().catch(function(){})}catch(e){}var span=Math.max(.7,isReverse()?shadowTargetFor(x):segmentEnd(xIndex)-(+x.startSeconds||0));shadowSyncTimer=setTimeout(cycle,span*1000)}cycle()}
function setStudyMode(mode){if(/^(shadow|dictation)$/.test(mode)&&!hasExactTiming()){studyMode="watch";showTimingRequired();return}var previous=studyMode;studyMode=/^(shadow|dictation)$/.test(mode)?mode:"watch";if(previous==="shadow"&&studyMode!=="shadow"){stopShadowSync();setLoop(false);if(ownVoiceOn||guideVoiceOn)forceOwnVoiceMute();else restoreSound()}document.body.classList.toggle("yt-mode-shadow",studyMode==="shadow");document.body.classList.toggle("yt-mode-dictation",studyMode==="dictation");Array.prototype.forEach.call(document.querySelectorAll("[data-study-mode]"),function(b){var on=b.getAttribute("data-study-mode")===studyMode;b.classList.toggle("is-active",on);b.setAttribute("aria-selected",String(on))});if(studyMode==="watch"){$("practiceBox").hidden=true;if(ownVoiceOn)forceOwnVoiceMute();else if(guideVoiceOn)forceOwnVoiceMute()}else if(studyMode==="shadow"){stopOwnVoiceAudio();cancelGuideVoice();forceShadowMute();setLoop(true);renderShadowReady()}else{if(ownVoiceOn||guideVoiceOn)forceOwnVoiceMute();renderDictationReady()}}
function renderShadowReady(){if(!study||active<0)return;stopShadowSync();forceShadowMute();if(!loopOn||loopIndex!==active)setLoop(true);var reverse=isReverse(),attempts=state().shadowAttempts[keyOf(study.segments[active])]||[];showPractice('<div class="yt-shadow-dashboard"><div class="yt-shadow-main"><h3>🎙 '+(reverse?'Ters shadowing · Türkçeden İngilizceye':'Sessiz görüntüyle shadowing')+'</h3><p>'+(reverse?'Türkçe video kesiti sessiz döner. Ekrandaki doğal İngilizce karşılığı siz seslendirirsiniz.':'Video kesiti sessiz ve sürekli döner. Sesiniz kaydedilir; bitirdiğinizde kaydınız aynı görüntüyle eşleştirilir.')+'</p><div class="yt-reverse-pair"><span>TR · '+esc(study.segments[active].translationTR)+'</span><b>EN · '+esc(study.segments[active].transcriptEN)+'</b></div><div class="yt-shadow-wave">'+new Array(25).fill("<i></i>").join("")+'</div><div class="yt-shadow-record"><button class="yt-record-primary" id="shadowStartNow" type="button">🎙 '+(reverse?'İngilizcemi kaydet':'Sesimi kaydet')+'</button><button class="yt-open-acoustic" id="openAcousticLab" type="button">〽 Ses Dalga ile ayrıntılı çalış</button></div><div class="yt-attempts">'+attempts.slice(-3).reverse().map(function(a){return'<div class="yt-attempt-row"><span>'+new Date(a.at).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})+'</span><b>Metin %'+a.textScore+' · Tamlık %'+a.completeness+'</b></div>'}).join("")+'</div></div><div class="yt-shadow-metrics"><div class="yt-metric is-pending"><b>∞</b><span>SESSİZ VİDEO DÖNGÜSÜ</span></div><div class="yt-metric is-pending"><b>—</b><span>KULLANICI KAYDI</span></div><div class="yt-metric is-pending"><b>—</b><span>GÖRÜNTÜ EŞLEŞMESİ</span></div><div class="yt-metric is-pending"><b>—</b><span>METİN UYUMU</span></div><p class="yt-shadow-note">'+(reverse?'Hedef kayıt süresi İngilizce rehber cümlenin doğal konuşma süresine göre hesaplanır. Kaydınız yoksa İngilizce rehber ses kullanılır.':'Orijinal video sesi Shadowing modunda kapalı tutulur.')+' Yeni kaydınız bu cümleye bağlı olarak IndexedDB’de saklanır.</p></div></div>');$("shadowStartNow").onclick=startShadowing;$("openAcousticLab").onclick=openAudioLab}
function openAudioLab(){if(!study||active<0)return;try{if(player)player.pauseVideo()}catch(e){}var x=study.segments[active];$("audioLabSentence").textContent=x.transcriptEN;$("audioLabFrame").src="./sesdalga.html?embed=1&en="+encodeURIComponent(x.transcriptEN)+"&tr="+encodeURIComponent(x.translationTR||"");$("audioLabModal").hidden=false}
function closeAudioLab(){$("audioLabModal").hidden=true;$("audioLabFrame").src="about:blank";if(studyMode==="shadow"&&study){forceShadowMute();setLoop(true)}}
function renderDictationReady(){if(!study||active<0)return;showPractice('<h3>⌨ Dikte modu</h3><p>Altyazı gizlenecek, aktif cümle sürekli çalacak. Hazır olduğunuzda başlayın.</p><button id="dictationStartNow" type="button">Dikteyi başlat</button>');$("dictationStartNow").onclick=startDictation}
function safeName(s){return String(s||"youtube-dersi").replace(/[\\/:*?"<>|]+/g," ").replace(/\s+/g," ").trim().slice(0,90)||"youtube-dersi"}
function srtTime(sec){var ms=Math.max(0,Math.round((+sec||0)*1000)),h=Math.floor(ms/3600000);ms%=3600000;var m=Math.floor(ms/60000);ms%=60000;var s=Math.floor(ms/1000),x=ms%1000;return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")+","+String(x).padStart(3,"0")}
function exportLanguage(){var el=document.querySelector('input[name="exportLanguage"]:checked');return el?el.value:"bilingual"}
function segmentText(x,lang,separator){if(lang==="original")return x.transcriptEN||"";if(lang==="translation")return x.translationTR||"";return(x.transcriptEN||"")+(separator||"\n")+(x.translationTR||"")}
function wordbookMarkdown(){var words=state().words,keys=Object.keys(words).sort();return"# "+study.title+" · Kelime Defteri\n\n"+keys.map(function(k){var w=words[k];return"## "+k+" · "+time(w.startSeconds)+"\n\n- "+w.sentenceEN+"\n- "+w.sentenceTR}).join("\n\n")}
function buildExport(format,lang){if(format==="srt")return study.segments.map(function(x,i){return(i+1)+"\n"+srtTime(x.startSeconds)+" --> "+srtTime(x.endSeconds)+"\n"+segmentText(x,lang,"\n")}).join("\n\n");var body="# "+study.title+"\n\n"+study.segments.map(function(x){return"## ["+time(x.startSeconds)+"]\n\n"+segmentText(x,lang,"\n\n")}).join("\n\n");if($("exportWordbook").checked&&Object.keys(state().words).length)body+="\n\n---\n\n"+wordbookMarkdown();return body}
function downloadText(name,textValue,type){var blob=new Blob(["\ufeff"+textValue],{type:type||"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000)}
function exportNow(){var format=(document.querySelector('input[name="exportFormat"]:checked')||{}).value||"pdf",lang=exportLanguage(),name=safeName(study.title);if(format==="srt")downloadText(name+".srt",buildExport("srt",lang),"application/x-subrip;charset=utf-8");else if(format==="md")downloadText(name+".md",buildExport("md",lang),"text/markdown;charset=utf-8");else{var w=window.open("","_blank");if(!w){alert("PDF penceresi engellendi. Açılır pencereye izin verin.");return}var rows=study.segments.map(function(x){return'<section><time>'+time(x.startSeconds)+'</time><p class="en">'+esc(lang==="translation"?"":x.transcriptEN)+'</p><p class="tr">'+esc(lang==="original"?"":x.translationTR)+'</p></section>'}).join("");var wb=$("exportWordbook").checked?Object.keys(state().words).map(function(k){return'<li><b>'+esc(k)+'</b> — '+esc(state().words[k].sentenceEN)+'</li>'}).join(""):"";w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(name)+'</title><style>body{font:15px Arial;max-width:850px;margin:36px auto;color:#182235}h1{font-size:25px}section{break-inside:avoid;border-bottom:1px solid #ddd;padding:11px 0}time{color:#65758b;font-size:11px}.en{font-weight:700}.tr{color:#56657a}@media print{button{display:none}}</style></head><body><button onclick="print()">PDF olarak yazdır / kaydet</button><h1>'+esc(study.title)+'</h1><p>'+esc(study.summaryTR||"")+'</p>'+rows+(wb?'<h2>Kelime defteri</h2><ul>'+wb+'</ul>':"")+'<script>setTimeout(function(){print()},300)<\/script></body></html>');w.document.close()}$("exportModal").hidden=true}
function renderProgress(){if(!study)return;var s=state(),learned=0;study.segments.forEach(function(x){if(s.learned[keyOf(x)])learned++});var total=study.segments.length,pct=total?learned/total*100:0;$("masteryLabel").textContent=learned+" / "+total+" öğrenildi";$("masteryBar").style.width=pct+"%"}
function renderStudy(data){study=studyApi.normalize(data);normalizeStudyTimelines();ownVoiceRecords={};stopOwnVoiceAudio();cancelGuideVoice();guideVoiceOn=false;ownVoiceOn=false;var src=study.source||{},duration=+src.durationSeconds||0,reverse=isReverse(),translated=src.translationSource==="youtube-translated-caption",sourceLabel=src.transcriptMode==="youtube-direct"?"doğrudan YouTube zamanlı":src.transcriptMode==="youtube-pasted"?"YouTube’dan yapıştırılan zamanlı metin":"eski kayıt";document.body.classList.toggle("yt-source-tr",reverse);if($("videoLanguage"))$("videoLanguage").value=reverse?"tr":"en";updateAudioSourceUi();$("videoTitle").textContent=study.title;$("videoLevel").textContent=(study.level||"—")+" · "+(reverse?"TÜRKÇE VİDEO · YOUTUBE TRANSKRİPTİ":"YOUTUBE TRANSKRİPTİ");$("videoMeta").textContent=(src.author?src.author+" · ":"")+time(duration)+" · "+study.segments.length+" transkript satırı · "+(reverse?"TR özgün":"EN özgün")+(translated?" + YouTube çevirisi":" · çeviri yok")+" · "+sourceLabel;$("durationTime").textContent=time(duration);$("homeView").hidden=true;$("studyView").hidden=false;updateTimingUi();renderTranscript();renderPhrases();renderQuiz();renderProgress();var s=state(),idx=Math.max(0,Math.min(study.segments.length-1,+s.lastIndex||0));setActive(idx,false);renderWordbook();renderGrammar();setStudyMode(studyMode);loadOwnVoiceRecords();if(player&&navigator.onLine)seek(+s.lastTime||study.segments[idx].startSeconds,false);history.replaceState(null,"","./youtube-egitim.html?video="+encodeURIComponent(videoId)+previewParam())}
var renderStudyCore=renderStudy;
renderStudy=function(data){var result=renderStudyCore(data),src=study&&study.source||{},meta=$("videoMeta");if(src.translationSource==="gemini-sentence-only"&&meta)meta.textContent=meta.textContent.replace(" · çeviri yok"," + Gemini cümle çevirisi").replace(" + YouTube çevirisi"," + Gemini cümle çevirisi");updateTranslationButton(study);return result};
function textIdentity(x){return String(x&&x.transcriptEN||"").toLowerCase().replace(/[^a-z0-9']+/g," ").trim()+"|"+String(x&&x.translationTR||"").toLowerCase().replace(/[^a-z0-9çğıöşü']+/g," ").trim()}
function carryStudyState(oldStudy,newStudy){if(!oldStudy||!newStudy)return newStudy;var oldSegments=Array.isArray(oldStudy.segments)?oldStudy.segments:[],map={};oldSegments.forEach(function(x){map[textIdentity(x)]=x});newStudy.segments.forEach(function(x){var old=map[textIdentity(x)];if(old&&old.sentenceKey)x.sentenceKey=old.sentenceKey});if(oldStudy.userState)newStudy.userState=oldStudy.userState;return newStudy}
async function alignCurrentCaptions(feedback){if(!study||!videoId||!navigator.onLine||!studyApi.alignWithOfficialCaptions)return 0;var button=$("refreshTiming"),oldText=button&&button.innerHTML;if(feedback&&button){button.disabled=true;button.innerHTML="⌛ <span>Altyazı aranıyor</span>";setTimingState("checking","YouTube zaman kodları kontrol ediliyor…")}try{var result=await studyApi.alignWithOfficialCaptions(study,videoId);if(result&&result.exact&&result.data){study=result.data;normalizeStudyTimelines();record=await studyApi.save(videoId,videoUrl,study);renderStudy(study);if(button){button.innerHTML="✓ <span>"+result.alignedCount+" cümle kesin eşleşti</span>";setTimeout(function(){if(button)button.innerHTML=oldText},2600)}return result.alignedCount}if(feedback){setTimingState("blocked","Kesin YouTube zaman kaynağı bulunamadı");showTimingRequired();if(button){button.innerHTML="! <span>SRT/VTT gerekli</span>";setTimeout(function(){if(button)button.innerHTML=oldText},3200)}}return 0}catch(e){if(feedback){setTimingState("blocked","Altyazı zamanları alınamadı");showTimingRequired()}return 0}finally{if(button){button.disabled=false;if(!feedback)button.innerHTML=oldText}}}
async function refreshTiming(){if(!study||!videoId)return;var button=$("refreshTiming"),oldText=button&&button.innerHTML;if(button){button.disabled=true;button.innerHTML="⌛ <span>YouTube transkripti yenileniyor</span>"}try{await analyze(videoId,videoUrl,isReverse()?"tr":"en")}finally{if(button){button.disabled=false;button.innerHTML=oldText}}}
async function importSubtitleFile(file){if(!study||!file)return;var button=$("importSubtitles"),oldText=button.innerHTML;button.disabled=true;button.innerHTML="⌛ <span>Dosya doğrulanıyor</span>";setTimingState("checking","SRT/VTT cümlelerle eşleştiriliyor…");try{var text=await file.text(),cues=studyApi.parseCaptionPayload(text);if(cues.length<2)throw new Error("Dosyada zaman kodlu altyazı bulunamadı.");var result=studyApi.alignSegmentsToCaptionCues(study,cues,"subtitle-file");if(!result||!result.exact)throw new Error(result&&result.errors&&result.errors[0]||"Bütün cümleler altyazıyla eşleşmedi.");study=result.data;study.source.subtitleFileName=file.name;normalizeStudyTimelines();record=await studyApi.save(videoId,videoUrl,study);renderStudy(study);button.innerHTML="✓ <span>Kesin senkron hazır</span>";setTimeout(function(){if(button)button.innerHTML=oldText},2600)}catch(e){setTimingState("blocked","Dosya kabul edilmedi · yanlış senkron kurulmadı");showPractice('<div class="yt-empty-mini"><h3>Altyazı eşleşmedi</h3><p>'+esc(e&&e.message||"Bütün cümlelerin zamanları doğrulanamadı.")+'</p><p class="yt-timing-help">Video ile aynı sürüme ait İngilizce kaynak altyazıyı yükleyin. Sistem kısmi eşleşmeyi kabul etmez.</p></div>');button.innerHTML="! <span>Dosya eşleşmedi</span>";setTimeout(function(){if(button)button.innerHTML=oldText},3200)}finally{button.disabled=false;$("subtitleFile").value=""}}
function scheduleSave(){clearTimeout(saving);saving=setTimeout(saveNow,500)}
async function saveNow(){if(!study||!videoId)return;try{record=await studyApi.save(videoId,videoUrl,study);renderProgress();renderLibrary();if(global.DHCloudSync&&DHCloudSync.push)DHCloudSync.push().catch(function(){})}catch(e){}}
function cardHtml(r){var st=r.study&&r.study.userState||{},learned=Object.keys(st.learned||{}).length,total=r.study&&r.study.segments?r.study.segments.length:0,pct=total?Math.min(100,learned/total*100):0;return'<button class="yt-library-card" type="button" data-open-video="'+esc(r.videoId)+'"><strong>'+esc(r.title||"YouTube çalışması")+'</strong><small>'+esc(r.level||"")+(total?" · "+total+" cümle":"")+(navigator.onLine?" · Buluta hazır":" · Çevrimdışı hazır")+'</small><span class="yt-card-progress"><i style="width:'+pct+'%"></i></span></button>'}
async function renderLibrary(){var rows=await studyApi.all();$("libraryCount").textContent=String(rows.length);$("recentGrid").innerHTML=rows.slice(0,3).map(cardHtml).join("")||'<div class="yt-empty-mini">Henüz kayıtlı video yok. İlk YouTube adresini yukarıya ekleyin.</div>';$("drawerList").innerHTML=rows.map(function(r){return'<div class="yt-drawer-row">'+cardHtml(r)+'<button class="yt-delete-video" type="button" data-delete-video="'+esc(r.videoId)+'" aria-label="Videoyu sil">×</button></div>'}).join("")||'<div class="yt-empty-mini">Kitaplığınız boş.</div>';Array.prototype.forEach.call(document.querySelectorAll("[data-open-video]"),function(b){b.onclick=function(){openSaved(b.getAttribute("data-open-video"));closeLibrary()}});Array.prototype.forEach.call(document.querySelectorAll("[data-delete-video]"),function(b){b.onclick=async function(){var id=b.getAttribute("data-delete-video"),r=await studyApi.get(id);if(!confirm((r&&r.title||"Bu video")+" kitaplıktan silinsin mi?"))return;await studyApi.remove(id);await studyApi.mirrorNow();if(videoId===id)showHome();renderLibrary()}})}
function showHome(){clearInterval(tick);clearTimeout(shadowTimer);stopShadowMedia();stopShadowSync();closeAudioLab();setLoop(false);ownVoiceOn=false;guideVoiceOn=false;ownVoiceRecords={};stopOwnVoiceAudio();cancelGuideVoice();updateAudioSourceUi();resetPlayer();study=null;record=null;videoId="";videoUrl="";active=-1;document.body.classList.remove("yt-source-tr","yt-timing-blocked");$("studyView").hidden=true;$("homeView").hidden=false;$("videoUrl").value="";if($("videoLanguage"))$("videoLanguage").value="auto";history.replaceState(null,"","./youtube-egitim.html")}
async function openSaved(id){var r=await studyApi.get(id);if(!r)return;record=r;videoId=id;videoUrl=r.url||studyApi.canonical(id);var src=r.study&&r.study.source||{};if(navigator.onLine&&!isYouTubeTranscriptSource(src)){await analyze(id,videoUrl,String(src.language||src.sourceLanguage||"auto"));return}renderStudy(r.study);if(navigator.onLine)createPlayer(id).then(function(){var s=state();seek(+s.lastTime||0,false)}).catch(function(){$("playerLoading").innerHTML="<b>Video oynatılamadı; YouTube transkripti kayıtlı.</b>"});else{$("playerLoading").hidden=false;$("playerLoading").innerHTML="<b>Çevrimdışı: IndexedDB’de kayıtlı YouTube transkripti gösteriliyor.</b>"}}
async function analyze(id,url,requestedLanguage){var submit=$("videoForm").querySelector('button[type="submit"]');submit.disabled=true;setStatus("Video bilgileri YouTube’dan doğrulanıyor…","loading");videoId=id;videoUrl=url;try{var meta=await metaFromPlayer(id);pendingTranscriptMeta=meta;setStatus(time(meta.durationSeconds)+" video doğrulandı. YouTube konuşma metnini zamanlarıyla yapıştırın.","ok");openTranscriptPaste(meta)}catch(e){setStatus(e&&e.message?e.message:"Video doğrulanamadı.","error")}finally{submit.disabled=false}}
async function openOrAnalyze(raw){var id=studyApi.videoId(raw),requested=$("videoLanguage")?$("videoLanguage").value:"auto";if(!id){setStatus("Geçerli bir YouTube video adresi yapıştırın.","error");return}var old=await studyApi.get(id),savedSource=old&&old.study&&old.study.source||{},savedLanguage=String(savedSource.language||savedSource.sourceLanguage||"en");if(old&&old.study&&savedSource.completeVideo&&isYouTubeTranscriptSource(savedSource)&&(requested==="auto"||requested===savedLanguage)){openSaved(id);return}analyze(id,studyApi.canonical(id),requested)}
function closeLibrary(){$("libraryDrawer").hidden=true}
function openLibrary(){$("libraryDrawer").hidden=false}
function switchPanel(name){Array.prototype.forEach.call(document.querySelectorAll("[data-panel]"),function(b){b.classList.toggle("is-active",b.getAttribute("data-panel")===name)});["transcript","phrases","quiz","wordbook","grammar"].forEach(function(n){var id=n==="transcript"?"transcriptList":n+"Panel";$(id).hidden=n!==name});if(name==="wordbook")renderWordbook();if(name==="grammar")renderGrammar()}
function toggleMark(type){if(active<0)return;var s=state(),k=keyOf(study.segments[active]),map=s[type];map[k]=!map[k];if(!map[k])delete map[k];renderTranscript();setActive(active,false);renderProgress();scheduleSave()}
function markHard(){toggleMark("hard");var x=study.segments[active],s=state();if(s.hard[keyOf(x)]&&global.LearningErrorDB&&LearningErrorDB.logFromVideo)LearningErrorDB.logFromVideo({sentence:{id:videoId+":"+active,en:x.transcriptEN,tr:x.translationTR,level:study.level,module:study.title},heard:"",grade:"hard",score:0,mode:"youtube-repeat"})}
function syncSentenceToCurrent(){if(!study||active<0||!player)return;var x=study.segments[active],b=$("syncSentence");seek(+x.startSeconds||0,false);if(b){b.textContent="✓ YouTube zamanına gidildi";setTimeout(function(){if(study&&active>=0)setActive(active,false)},1800)}}
function editOpen(){if(active<0)return;var x=study.segments[active];$("editEN").value=x.transcriptEN;$("editTR").value=x.translationTR;$("editStart").value=(+x.startSeconds||0).toFixed(3);$("editEnd").value=(+x.endSeconds||0).toFixed(3);$("editStart").readOnly=false;$("editEnd").readOnly=false;$("editModal").hidden=false}
function editClose(){$("editModal").hidden=true}
function askOpen(){if(active<0)return;var qs=["Bu cümleyi açıkla","Neden bu yapı kullanıldı?","Daha doğal nasıl söylenir?","Bu kalıpla 3 örnek ver","Bana mini alıştırma yaptır"];$("aiQuick").innerHTML=qs.map(function(q){return'<button type="button" data-ai-q="'+esc(q)+'">'+esc(q)+'</button>'}).join("");$("aiAnswer").textContent="Bir soru seçin.";$("aiModal").hidden=false;Array.prototype.forEach.call(document.querySelectorAll("[data-ai-q]"),function(b){b.onclick=function(){askQuestion(b.getAttribute("data-ai-q"))}})}
function askQuestion(question){var x=study.segments[active],prev=study.segments[active-1],next=study.segments[active+1],prompt=["Sen Dil Harita İngilizce öğretmenisin. Kullanıcının seviyesi: "+study.level,"Video: "+study.title+" · zaman: "+time(x.startSeconds),"Önceki cümle: "+(prev?prev.transcriptEN:"yok"),"AKTİF CÜMLE: "+x.transcriptEN,"Türkçesi: "+x.translationTR,"Sonraki cümle: "+(next?next.transcriptEN:"yok"),"Kullanıcı isteği: "+question,"Türkçe, kısa, öğretici ve bu bağlama özel cevap ver."].join("\n");$("aiAnswer").textContent="Gemini cevabı bekleniyor…";$("aiAnswer").classList.add("is-loading");if(!global.DHGemini||!DHGemini.ask){$("aiAnswer").textContent="Gemini köprüsü yüklenmedi.";return}DHGemini.ask({title:"Aktif cümleyi Gemini ile incele",prompt:prompt,hint:"Gemini cevabını buraya yapıştır…",parse:function(t){return String(t||"").replace(/^\s*DH-ID:[^\n]*\n/i,"").trim()},onResult:function(t){$("aiAnswer").classList.remove("is-loading");$("aiAnswer").textContent=t||"Cevap alınamadı.";},onCancel:function(){$("aiAnswer").classList.remove("is-loading");$("aiAnswer").textContent="Soru iptal edildi."}})}
function normWords(s){return String(s||"").toLowerCase().replace(/[’]/g,"'").replace(/[^a-z0-9' ]+/g," ").replace(/\s+/g," ").trim().split(" ").filter(Boolean)}
function levenshtein(a,b){var m=a.length,n=b.length,row=Array(n+1),next=[],i,j;for(j=0;j<=n;j++)row[j]=j;for(i=1;i<=m;i++){next=[i];for(j=1;j<=n;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next}return row[n]}
function compare(target,heard){var a=normWords(target),b=normWords(heard),max=Math.max(a.length,b.length,1),score=Math.max(0,Math.round((1-levenshtein(a,b)/max)*100));return{score:score,target:a.join(" "),heard:b.join(" ")}}
function showPractice(html){var box=$("practiceBox");box.hidden=false;box.innerHTML=html;var meter=box.querySelector(".yt-shadow-wave.is-recording");if(meter){meter.id="shadowToneMeter";meter.classList.add("yt-tone-meter");meter.insertAdjacentHTML("beforebegin",'<div class="yt-tone-head"><b>Canlı ses tonu</b><span id="shadowToneLabel" class="is-quiet">Gri · ses bekleniyor</span></div>');meter.insertAdjacentHTML("afterend",'<div class="yt-tone-legend"><span><i class="is-strong"></i>Koyu yeşil · iyi</span><span><i class="is-soft"></i>Açık yeşil · hafif</span><span><i></i>Gri · sessiz</span></div>');setTimeout(function(){if(mediaStream)startMicMeter(mediaStream)},0)}}
function startDictation(){if(active<0)return;if(!hasExactTiming()){showTimingRequired();return}setLoop(true);captionOn=false;$("captionLayer").hidden=true;var x=study.segments[active];showPractice('<h3>⌨ Duyduğunu yaz</h3><p>Cümle döngüde. Duyduğunuz İngilizce cümleyi yazın.</p><form id="dictationForm"><input id="dictationInput" autocomplete="off" placeholder="Duyduğunu İngilizce yaz…"><button type="submit">Kontrol et</button></form><div id="dictationResult"></div>');$("dictationForm").onsubmit=function(e){e.preventDefault();var heard=$("dictationInput").value,r=compare(x.transcriptEN,heard),out=$("dictationResult");out.className="yt-practice-result "+(r.score>=85?"good":"bad");out.textContent="%"+r.score+" eşleşme · "+(r.score>=85?"Harika, cümleyi yakaladınız.":"Tekrar dinleyin: "+x.transcriptEN);captionOn=true;$("captionLayer").hidden=false;if(r.score<85&&global.LearningErrorDB&&LearningErrorDB.logFromVideo)LearningErrorDB.logFromVideo({sentence:{id:videoId+":"+active,en:x.transcriptEN,tr:x.translationTR,level:study.level,module:study.title},heard:heard,grade:"hard",score:r.score,mode:"dictation"})}}
function stopMicMeter(){if(micMeterFrame){try{(global.cancelAnimationFrame||clearTimeout)(micMeterFrame)}catch(e){}}micMeterFrame=0;try{if(micSource)micSource.disconnect()}catch(e){}micSource=null;micAnalyser=null;micMeterData=null;if(micAudioContext){try{micAudioContext.close()}catch(e){}}micAudioContext=null}
function startMicMeter(stream){stopMicMeter();var C=global.AudioContext||global.webkitAudioContext;if(!C||!stream)return;try{micAudioContext=new C();micAnalyser=micAudioContext.createAnalyser();micAnalyser.fftSize=256;micAnalyser.smoothingTimeConstant=.72;micSource=micAudioContext.createMediaStreamSource(stream);micSource.connect(micAnalyser);micMeterData=new Uint8Array(micAnalyser.fftSize)}catch(e){stopMicMeter();return}var raf=global.requestAnimationFrame||function(fn){return setTimeout(fn,50)};function draw(){if(!micAnalyser||!micMeterData)return;micAnalyser.getByteTimeDomainData(micMeterData);var sum=0;for(var i=0;i<micMeterData.length;i++){var v=(micMeterData[i]-128)/128;sum+=v*v}var rms=Math.sqrt(sum/micMeterData.length),state=rms<.025?"quiet":rms<.085?"soft":"strong",level=state==="quiet"?0:Math.min(1,Math.max(.12,(rms-.018)*8)),bars=document.querySelectorAll("#shadowToneMeter i"),filled=Math.max(0,Math.round(level*bars.length));Array.prototype.forEach.call(bars,function(b,n){b.className=n<filled?(state==="strong"?"is-strong":"is-soft"):"";b.style.height=(8+Math.round((n<filled?level:.04)*26*(.55+((n*7)%10)/20)))+"px"});var label=$("shadowToneLabel");if(label){label.className="is-"+state;label.textContent=state==="strong"?"Koyu yeşil · iyi seviye":state==="soft"?"Açık yeşil · biraz daha güçlü":"Gri · ses bekleniyor"}micMeterFrame=raf(draw)}draw()}
function stopShadowMedia(done){stopShadowGuides();stopMicMeter();var rec=mediaRecorder,called=false;function complete(){if(called)return;called=true;if(done)done()}try{if(rec&&rec.state!=="inactive"){var prior=rec.onstop;rec.onstop=function(e){if(prior)prior.call(rec,e);complete()};rec.stop()}else complete()}catch(e){complete()}try{if(mediaStream)mediaStream.getTracks().forEach(function(t){t.stop()})}catch(e){}mediaStream=null}
function shadowWordHtml(target,heard){var got=normWords(heard),used={};return normWords(target).map(function(w){var hit=false;for(var i=0;i<got.length;i++)if(!used[i]&&got[i]===w){used[i]=true;hit=true;break}return'<span class="'+(hit?'hit':'')+'">'+esc(w)+'</span>'}).join(" ")}
function renderShadowResult(x,heard,confidence,elapsed){var r=compare(x.transcriptEN,heard),target=normWords(x.transcriptEN),said=normWords(heard),matched=0,copy=said.slice();target.forEach(function(w){var i=copy.indexOf(w);if(i>=0){matched++;copy.splice(i,1)}});var completeness=Math.round(matched/Math.max(1,target.length)*100),expected=Math.max(1,(+x.endSeconds-+x.startSeconds)),ratio=elapsed/expected,fluency=Math.max(0,Math.min(100,Math.round(100-Math.abs(1-ratio)*45))),trust=Math.max(0,Math.min(100,Math.round((+confidence||0)*100))),attempt={at:Date.now(),textScore:r.score,completeness:completeness,fluency:fluency,confidence:trust,heard:heard,elapsed:elapsed},k=keyOf(x),list=state().shadowAttempts[k]||[];list.push(attempt);state().shadowAttempts[k]=list.slice(-10);scheduleSave();showPractice('<div class="yt-shadow-dashboard"><div class="yt-shadow-main"><h3>🎬 Sesiniz görüntüyle eşleştirildi</h3><p>Tarayıcının algıladığı: “'+esc(heard||"—")+'”</p><div class="yt-shadow-words">'+shadowWordHtml(x.transcriptEN,heard)+'</div><div class="yt-shadow-record"><button class="yt-record-primary" id="shadowSyncToggle" type="button">■ Eşleşmeyi durdur</button><button id="shadowRetry" type="button">↻ Yeniden kaydet</button><button class="yt-open-acoustic" id="openAcousticLab" type="button">〽 Ses Dalga analizi</button></div><p class="yt-shadow-save" id="shadowSaveState">IndexedDB’ye kaydediliyor…</p></div><div class="yt-shadow-metrics"><div class="yt-metric"><b>%'+r.score+'</b><span>METİN DOĞRULUĞU</span></div><div class="yt-metric"><b>%'+completeness+'</b><span>TAMLIK</span></div><div class="yt-metric"><b>%'+fluency+'</b><span>AKICILIK TAHMİNİ</span></div><div class="yt-metric"><b>%'+trust+'</b><span>TANIMA GÜVENİ</span></div><p class="yt-shadow-note">Video sessiz döner; duyduğunuz ses sizin mikrofon kaydınızdır. Daha sonra “Kendi sesim” seçeneğiyle kayıtlı cümleleri sizin sesinizden dinleyebilirsiniz.</p></div></div>');persistShadowRecording(x,attempt);$("shadowRetry").onclick=function(){stopShadowSync();startShadowing()};$("shadowSyncToggle").onclick=function(){if(shadowSyncOn){stopShadowSync();this.textContent="▶ Kaydımı görüntüyle oynat"}else{startShadowSync(x);this.textContent="■ Eşleşmeyi durdur"}};$("openAcousticLab").onclick=openAudioLab;setTimeout(function(){startShadowSync(x)},140);if(r.score<85&&global.LearningErrorDB&&LearningErrorDB.logFromVideo)LearningErrorDB.logFromVideo({sentence:{id:videoId+":"+active,en:x.transcriptEN,tr:x.translationTR,level:study.level,module:study.title},heard:heard,grade:"hard",score:r.score,mode:"shadowing"})}
function shadowTargetFor(x){if(isReverse())return englishGuideDuration(x);var i=study&&study.segments?study.segments.indexOf(x):-1,start=+x.startSeconds||0,end=i>=0?segmentEnd(i):(+x.endSeconds||start+2);return Math.max(.8,end-start)}
function stopShadowGuides(){clearInterval(shadowSignalTimer);clearInterval(shadowDurationTimer);clearTimeout(shadowEndTimer);shadowSignalTimer=null;shadowDurationTimer=null;shadowEndTimer=null;shadowStopHandler=null}
function showShadowEndSignal(){var signal=$("shadowSignal"),text=$("shadowSignalText"),hint=$("shadowDurationHint"),fill=$("shadowDurationFill");if(signal){signal.classList.remove("is-start","is-ready");signal.classList.add("is-stop")}if(text)text.textContent="BİTİR";if(hint)hint.textContent="Süre tamamlandı · konuşmayı bırakın.";if(fill){fill.style.width="100%";fill.classList.add("is-complete")}}
function startShadowCountdown(x,start){var handler=shadowStopHandler;stopShadowGuides();shadowStopHandler=handler;shadowTargetSeconds=shadowTargetFor(x);forceShadowMute();setLoop(true);showPractice('<div class="yt-shadow-countdown"><div class="yt-signal is-ready" id="shadowSignal"><i></i><b id="shadowSignalText">3</b><span>HAZIR OL</span></div><h3>'+esc(x.transcriptEN)+'</h3><p>Program yeşil ışığı verdiğinde başlayın; kırmızı ışıkta konuşmayı bırakın.</p><div class="yt-countdown-target"><span>Hedef kayıt süresi</span><b>'+shadowTargetSeconds.toFixed(1)+' saniye</b></div></div>');var n=3;shadowSignalTimer=setInterval(function(){if(studyMode!=="shadow"){stopShadowGuides();return}n--;var text=$("shadowSignalText");if(n>0){if(text)text.textContent=String(n);return}clearInterval(shadowSignalTimer);shadowSignalTimer=null;if(start)start()},850)}
function startShadowDurationGuide(x){clearInterval(shadowDurationTimer);clearTimeout(shadowEndTimer);shadowTargetSeconds=shadowTargetFor(x);function update(){var elapsed=Math.max(0,(Date.now()-shadowStartedAt)/1000),ratio=elapsed/shadowTargetSeconds,fill=$("shadowDurationFill"),elapsedEl=$("shadowElapsed"),remaining=$("shadowRemaining"),hint=$("shadowDurationHint");if(fill){fill.style.width=Math.min(100,ratio*100)+"%";fill.classList.toggle("is-near",ratio>=.72&&ratio<1);fill.classList.toggle("is-complete",ratio>=1)}if(elapsedEl)elapsedEl.textContent=elapsed.toFixed(1)+" sn";if(remaining)remaining.textContent=Math.max(0,shadowTargetSeconds-elapsed).toFixed(1)+" sn kaldı";if(hint)hint.textContent=ratio<.72?"Cümleyi doğal hızda sürdürün.":ratio<1?"Hedef süreye yaklaşıyorsunuz.":"Süre tamamlandı · konuşmayı bırakın."}update();shadowDurationTimer=setInterval(update,50);var passed=Math.max(0,Date.now()-shadowStartedAt);shadowEndTimer=setTimeout(function(){showShadowEndSignal();if(shadowStopHandler)shadowStopHandler(true)},Math.max(0,shadowTargetSeconds*1000-passed))}
function renderShadowRecording(x,stop){var target=shadowTargetFor(x);showPractice('<div class="yt-shadow-dashboard"><div class="yt-shadow-main"><div class="yt-signal is-start" id="shadowSignal"><i></i><b id="shadowSignalText">BAŞLA</b><span>KONUŞ</span></div><h3>🎙 Cümleyi görüntüyle birlikte söyleyin</h3><p>“'+esc(x.transcriptEN)+'”</p><div class="yt-shadow-duration"><header><span>Hedef cümle süresi</span><b>'+target.toFixed(1)+' sn</b></header><div class="yt-duration-track"><i id="shadowDurationFill"></i><em></em></div><footer><b id="shadowElapsed">0.0 sn</b><span id="shadowRemaining">'+target.toFixed(1)+' sn kaldı</span></footer><small id="shadowDurationHint">Cümleyi doğal hızda sürdürün.</small></div><div class="yt-shadow-wave is-recording">'+new Array(25).fill("<i></i>").join("")+'</div><div class="yt-shadow-record"><button id="shadowStop" type="button">■ Erken bitir</button></div></div><div class="yt-shadow-metrics"><div class="yt-metric is-pending"><b>●</b><span>YEŞİLDE KONUŞ</span></div><div class="yt-metric is-pending"><b>'+target.toFixed(1)+'</b><span>HEDEF SANİYE</span></div><p class="yt-shadow-note">Kırmızı BİTİR ışığında kayıt otomatik kapanır ve video süresiyle eşleşir.</p></div></div>');$("shadowStop").onclick=function(){stop(false)};startShadowDurationGuide(x)}
async function beginShadowCapture(x,R){recordedChunks=[];recordedAudioBlob=null;if(recordedAudioUrl){URL.revokeObjectURL(recordedAudioUrl);recordedAudioUrl=""}try{mediaStream=await navigator.mediaDevices.getUserMedia({audio:true});if(!global.MediaRecorder)throw new Error("MediaRecorder desteklenmiyor");mediaRecorder=new MediaRecorder(mediaStream);mediaRecorder.ondataavailable=function(e){if(e.data&&e.data.size)recordedChunks.push(e.data)};mediaRecorder.onstop=function(){if(recordedChunks.length){recordedAudioBlob=new Blob(recordedChunks,{type:mediaRecorder.mimeType||"audio/webm"});recordedAudioUrl=URL.createObjectURL(recordedAudioBlob)}}}catch(e){mediaStream=null;showPractice('<h3>Mikrofon açılamadı</h3><p>Sesinizi görüntüyle eşleştirebilmek için mikrofon izni gereklidir.</p><button id="shadowRetry" type="button">Yeniden dene</button>');$("shadowRetry").onclick=startShadowing;return}recognition=new R();recognition.lang="en-US";recognition.continuous=true;recognition.interimResults=false;var heard=[],confidences=[],userStopped=false,finalized=false,fatal=false,captureStarted=false,autoEnded=false,restartTimer=null;function finish(){if(finalized)return;finalized=true;clearTimeout(restartTimer);var elapsed=Math.max(.5,(Date.now()-shadowStartedAt)/1000),text=heard.join(" ").trim(),confidence=confidences.length?confidences.reduce(function(a,b){return a+b},0)/confidences.length:0;stopShadowMedia(function(){setTimeout(function(){renderShadowResult(x,text,confidence,elapsed)},autoEnded?650:220)})}function fail(){if(finalized)return;finalized=true;clearTimeout(restartTimer);stopShadowMedia();showPractice('<h3>Mikrofon tamamlanamadı</h3><p>Mikrofon iznini ve internet bağlantısını kontrol edin. Sessiz video döngüsü devam ediyor.</p><button id="shadowRetry" type="button">Yeniden dene</button>');$("shadowRetry").onclick=startShadowing}function stopCapture(auto){if(userStopped)return;userStopped=true;autoEnded=!!auto;showShadowEndSignal();try{recognition.stop()}catch(e){finish()}setTimeout(finish,500)}shadowStopHandler=stopCapture;recognition.onstart=function(){if(captureStarted)return;captureStarted=true;renderShadowRecording(x,stopCapture)};recognition.onresult=function(ev){for(var i=ev.resultIndex||0;i<ev.results.length;i++){var result=ev.results[i],alt=result&&result[0];if(result&&result.isFinal&&alt){heard.push(String(alt.transcript||"").trim());confidences.push(+alt.confidence||0)}}};recognition.onerror=function(ev){fatal=!!(ev&&/not-allowed|service-not-allowed|audio-capture/.test(ev.error||""));if(fatal)fail()};recognition.onend=function(){if(finalized)return;if(userStopped)return finish();if(fatal)return;restartTimer=setTimeout(function(){if(finalized||userStopped||studyMode!=="shadow")return finish();try{recognition.start()}catch(e){restartTimer=setTimeout(function(){try{recognition.start()}catch(x){fail()}},300)}},120)};startShadowCountdown(x,function(){if(studyMode!=="shadow")return stopShadowMedia();try{shadowStartedAt=Date.now();mediaRecorder.start();recognition.start()}catch(e){fail()}})}
function startShadowing(){if(active<0)return;if(!hasExactTiming()){showTimingRequired();return}var R=global.SpeechRecognition||global.webkitSpeechRecognition;if(!R){showPractice("<h3>🎙 Shadowing</h3><p>Bu tarayıcı konuşma tanımayı desteklemiyor. Sessiz video döngüsünü izleyerek cümleyi sesli tekrar edebilirsiniz.</p>");return}clearTimeout(shadowTimer);stopShadowSync();forceShadowMute();setLoop(true);beginShadowCapture(study.segments[active],R)}

function bindTimelineAligner(){
 var track=$("alignTrack"),handleL=$("alignHandleLeft"),handleR=$("alignHandleRight"),dragBody=$("alignDragBody");
 var dragMode=null,startX=0,initialStart=0,initialEnd=0;

 function onPointerDown(e,mode){
  if(!study||active<0||alignDraft.index!==active)return;
  dragMode=mode;
  startX=e.clientX||(e.touches&&e.touches[0].clientX)||0;
  initialStart=alignDraft.start;
  initialEnd=alignDraft.end;
  window.addEventListener("pointermove",onPointerMove);
  window.addEventListener("pointerup",onPointerUp);
  e.preventDefault();
 }

 function onPointerMove(e){
  if(!dragMode||!study||active<0)return;
  var dur=player&&player.getDuration?+player.getDuration()||0:0;
  if(!dur&&study.source)dur=+study.source.durationSeconds||0;
  if(dur<=0)return;

  var curX=e.clientX||(e.touches&&e.touches[0].clientX)||0;
  var dx=curX-startX;
  var trackW=track.getBoundingClientRect().width||1;
  var dSec=(dx/trackW)*dur;
  var minStart=minAllowedStart(active);

  if(dragMode==="move"){
   var span=initialEnd-initialStart;
   var newS=Math.max(minStart,Math.min(dur-span,initialStart+dSec));
   alignDraft.start=Math.round(newS*100)/100;
   alignDraft.end=Math.round((newS+span)*100)/100;
  }else if(dragMode==="left"){
   var newSL=Math.max(minStart,Math.min(alignDraft.end-0.3,initialStart+dSec));
   alignDraft.start=Math.round(newSL*100)/100;
  }else if(dragMode==="right"){
   var newER=Math.max(alignDraft.start+0.3,Math.min(dur,initialEnd+dSec));
   alignDraft.end=Math.round(newER*100)/100;
  }
  alignDraft.dirty=true;
  updateTimelineAlignerUi();
  seek(alignDraft.start,false);
 }

 function onPointerUp(){
  if(dragMode){
   dragMode=null;
   window.removeEventListener("pointermove",onPointerMove);
   window.removeEventListener("pointerup",onPointerUp);
  }
 }

 if(handleL)handleL.onpointerdown=function(e){onPointerDown(e,"left")};
 if(handleR)handleR.onpointerdown=function(e){onPointerDown(e,"right")};
 if(dragBody)dragBody.onpointerdown=function(e){onPointerDown(e,"move")};

 if(track){
  track.onclick=function(e){
   if(e.target.closest("#alignSegmentBlock"))return;
   var rect=track.getBoundingClientRect();
   var pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
   var dur=player&&player.getDuration?+player.getDuration()||0:0;
   if(!dur&&study.source)dur=+study.source.durationSeconds||0;
   seek(dur*pct,true);
  };
 }

 if($("alignStartEarlier")){
  $("alignStartEarlier").onclick=function(){
   if(active<0||!study)return;
   var minStart=minAllowedStart(active);
   alignDraft.start=Math.max(minStart,Math.round((alignDraft.start-0.2)*100)/100);
   alignDraft.dirty=true;
   updateTimelineAlignerUi();
   seek(alignDraft.start,true);
  };
 }

 if($("alignStartLater")){
  $("alignStartLater").onclick=function(){
   if(active<0||!study)return;
   alignDraft.start=Math.min(alignDraft.end-0.3,Math.round((alignDraft.start+0.2)*100)/100);
   alignDraft.dirty=true;
   updateTimelineAlignerUi();
   seek(alignDraft.start,true);
  };
 }

 if($("alignEndEarlier")){
  $("alignEndEarlier").onclick=function(){
   if(active<0||!study)return;
   alignDraft.end=Math.max(alignDraft.start+0.3,Math.round((alignDraft.end-0.2)*100)/100);
   alignDraft.dirty=true;
   updateTimelineAlignerUi();
   seek(Math.max(alignDraft.start,alignDraft.end-1),true);
  };
 }

 if($("alignEndLater")){
  $("alignEndLater").onclick=function(){
   if(active<0||!study)return;
   var dur=player&&player.getDuration?+player.getDuration()||0:0;
   if(!dur&&study.source)dur=+study.source.durationSeconds||9999;
   alignDraft.end=Math.min(dur,Math.round((alignDraft.end+0.2)*100)/100);
   alignDraft.dirty=true;
   updateTimelineAlignerUi();
   seek(Math.max(alignDraft.start,alignDraft.end-1),true);
  };
 }

 if($("alignNudgeLeft")){
  $("alignNudgeLeft").onclick=function(){
   if(active<0||!study)return;
   var span=alignDraft.end-alignDraft.start;
   var minStart=minAllowedStart(active);
   alignDraft.start=Math.max(minStart,Math.round((alignDraft.start-0.5)*100)/100);
   alignDraft.end=Math.round((alignDraft.start+span)*100)/100;
   alignDraft.dirty=true;
   updateTimelineAlignerUi();
   seek(alignDraft.start,true);
  };
 }

 if($("alignNudgeRight")){
  $("alignNudgeRight").onclick=function(){
   if(active<0||!study)return;
   var span=alignDraft.end-alignDraft.start;
   alignDraft.start=Math.round((alignDraft.start+0.5)*100)/100;
   alignDraft.end=Math.round((alignDraft.start+span)*100)/100;
   alignDraft.dirty=true;
   updateTimelineAlignerUi();
   seek(alignDraft.start,true);
  };
 }

 if($("alignSetCurrentStart")){
  $("alignSetCurrentStart").onclick=function(){
   if(active<0||!study||!player)return;
   var now=+player.getCurrentTime()||0;
   var span=Math.max(0.8,alignDraft.end-alignDraft.start);
   var minStart=minAllowedStart(active);
   alignDraft.start=Math.max(minStart,Math.round(now*100)/100);
   alignDraft.end=Math.round((alignDraft.start+span)*100)/100;
   alignDraft.dirty=true;
   updateTimelineAlignerUi();
   seek(alignDraft.start,true);
  };
 }

 if($("alignTestPlay")){
  $("alignTestPlay").onclick=function(){
   seek(alignDraft.start,true);
  };
 }

 if($("alignResetBtn")){
  $("alignResetBtn").onclick=function(){
   if(active<0||!study)return;
   initAlignDraft(active);
   seek(alignDraft.start,false);
  };
 }

 if($("alignSaveBtn")){
  $("alignSaveBtn").onclick=async function(){
   if(active<0||!study||!study.segments[active])return;
   var curIdx=active;
   var x=study.segments[curIdx];
   var rippleAll=$("alignRippleAll")&&$("alignRippleAll").checked;
   var minStart=minAllowedStart(curIdx);
   var newStart=Math.max(minStart,alignDraft.start);
   var newEnd=Math.max(newStart+0.2,alignDraft.end);

   x.startSeconds=newStart;
   x.endSeconds=newEnd;

   // Sonraki cümleleri kendi sürelerini (uzunluklarını) koruyarak ardışık ötele
   if(rippleAll){
    for(var j=curIdx+1;j<study.segments.length;j++){
     var prevSeg=study.segments[j-1];
     var thisSeg=study.segments[j];
     var thisLength=Math.max(0.3,Math.round(((+thisSeg.endSeconds||thisSeg.startSeconds+2)-(+thisSeg.startSeconds||0))*100)/100);
     thisSeg.startSeconds=Math.round((prevSeg.endSeconds+0.05)*100)/100;
     thisSeg.endSeconds=Math.round((thisSeg.startSeconds+thisLength)*100)/100;
    }
   }else{
    for(var k=curIdx+1;k<study.segments.length;k++){
     var pSeg=study.segments[k-1];
     var tSeg=study.segments[k];
     if(tSeg.startSeconds<pSeg.endSeconds){
      var tLen=Math.max(0.3,Math.round(((+tSeg.endSeconds||tSeg.startSeconds+2)-(+tSeg.startSeconds||0))*100)/100);
      tSeg.startSeconds=Math.round((pSeg.endSeconds+0.05)*100)/100;
      tSeg.endSeconds=Math.round((tSeg.startSeconds+tLen)*100)/100;
     }
    }
   }

   normalizeStudyTimelines();
   active=study.segments.indexOf(x);
   initAlignDraft(active);
   renderTranscript();
   setActive(active,false);
   
   if(studyApi&&studyApi.save&&videoId){
    record=await studyApi.save(videoId,videoUrl,study);
    if(global.DHCloudSync&&DHCloudSync.push)DHCloudSync.push().catch(function(){});
   }

   var btn=$("alignSaveBtn");
   if(btn){
    btn.textContent=rippleAll?"✓ Tüm Cümleler Revize Edildi!":"✓ Kaydedildi!";
    setTimeout(function(){updateTimelineAlignerUi()},1600);
   }
  };
 }
}

function bind(){
 $("translateTranscript").onclick=function(){if(!study)return;var force=translationRows(study,false).length===0;translateStudyWithGemini(study,force).then(function(){return backupYouTubeNow()}).catch(function(e){setTranslationMessage(e&&e.code==="abort"?"Çeviri bekliyor":"Çeviri hatası · yeniden dene",false)})};
 $("pasteTranscriptOpen").onclick=function(){openTranscriptPaste()};$("transcriptPasteForm").onsubmit=function(e){e.preventDefault();usePastedTranscript()};Array.prototype.forEach.call(document.querySelectorAll("[data-close-transcript-paste]"),function(b){b.onclick=closeTranscriptPaste});$("transcriptPasteModal").onclick=function(e){if(e.target===this)closeTranscriptPaste()};
 Array.prototype.forEach.call(document.querySelectorAll("[data-study-mode]"),function(b){b.onclick=function(){setStudyMode(b.getAttribute("data-study-mode"))}});
 $("autoPauseToggle").onclick=function(){autoPause=!autoPause;autoPausedIndex=-1;this.classList.toggle("is-active",autoPause);this.setAttribute("aria-pressed",String(autoPause))};
 $("karaokeToggle").onclick=function(){karaokeOn=!karaokeOn;this.classList.toggle("is-active",karaokeOn);this.setAttribute("aria-pressed",String(karaokeOn));if(study)setActive(active,false)};
 $("refreshTiming").onclick=refreshTiming;
 $("importSubtitles").onclick=function(){$("subtitleFile").click()};
 $("subtitleFile").onchange=function(){if(this.files&&this.files[0])importSubtitleFile(this.files[0])};
 $("exportOpen").onclick=function(){if(study)$("exportModal").hidden=false};$("exportDownload").onclick=exportNow;Array.prototype.forEach.call(document.querySelectorAll("[data-close-export]"),function(b){b.onclick=function(){$("exportModal").hidden=true}});$("exportModal").onclick=function(e){if(e.target===this)this.hidden=true};
 $("saveSelectedWord").onclick=saveWord;$("explainSelectedWord").onclick=function(){if(!selectedWord)return;$("aiModal").hidden=false;askQuestion("Bu cümledeki ‘"+selectedWord+"’ kelimesini; anlamı, kelime türü, telaffuz ipucu ve doğal kalıbıyla açıkla.")};
 $("closeAudioLab").onclick=closeAudioLab;
 $("videoForm").onsubmit=function(e){e.preventDefault();openOrAnalyze($("videoUrl").value)};$("openLibrary").onclick=openLibrary;$("showAllLibrary").onclick=openLibrary;$("closeLibrary").onclick=closeLibrary;$("libraryDrawer").onclick=function(e){if(e.target===$("libraryDrawer"))closeLibrary()};$("closeStudy").onclick=showHome;$("playToggle").onclick=playPause;$("prevSentence").onclick=function(){if(active>0){setActive(active-1,true);if(loopOn)setLoop(true);else seek(study.segments[active].startSeconds,true)}};$("nextSentence").onclick=function(){if(study&&active<study.segments.length-1){setActive(active+1,true);if(loopOn)setLoop(true);else seek(study.segments[active].startSeconds,true)}};$("loopToggle").onclick=function(){setLoop(!loopOn)};$("speedToggle").onclick=function(){var rates=[.5,.75,1,1.25,1.5],cur=1;try{cur=player.getPlaybackRate()}catch(e){}var next=rates[(rates.indexOf(cur)+1)%rates.length];try{player.setPlaybackRate(next)}catch(e){}this.textContent=next+"×"};$("captionToggle").onclick=function(){captionOn=!captionOn;this.classList.toggle("is-active",captionOn);this.setAttribute("aria-pressed",String(captionOn));$("captionLayer").hidden=!captionOn;if(captionOn)setActive(active,false)};$("soundToggle").onclick=function(){if(studyMode==="shadow"||ownVoiceOn||guideVoiceOn)return;muted=!muted;try{muted?player.mute():player.unMute()}catch(e){}this.textContent=muted?"🔇":"🔊"};$("timelineThumb").parentNode.onclick=function(e){if(!player)return;var r=this.getBoundingClientRect(),pct=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),dur=0;try{dur=player.getDuration()}catch(x){}seek(dur*pct,true)};$("scrollActive").onclick=function(){var r=document.querySelector(".yt-segment.is-active");if(r)r.scrollIntoView({block:"center",behavior:"smooth"})};$("toggleEN").onclick=function(){showEN=!showEN;this.classList.toggle("is-active",showEN);this.setAttribute("aria-pressed",String(showEN));document.querySelector(".yt-transcript-panel").classList.toggle("hide-en",!showEN);setActive(active,false)};$("toggleTR").onclick=function(){showTR=!showTR;this.classList.toggle("is-active",showTR);this.setAttribute("aria-pressed",String(showTR));document.querySelector(".yt-transcript-panel").classList.toggle("hide-tr",!showTR);setActive(active,false)};$("transcriptSearch").oninput=function(){searchText=this.value;renderTranscript()};Array.prototype.forEach.call(document.querySelectorAll("[data-panel]"),function(b){b.onclick=function(){switchPanel(b.getAttribute("data-panel"))}});$("favoriteSentence").onclick=function(){toggleMark("favorites")};$("markLearned").onclick=function(){toggleMark("learned")};$("markHard").onclick=markHard;$("syncSentence").onclick=syncSentenceToCurrent;$("editSentence").onclick=editOpen;$("askGemini").onclick=askOpen;$("startDictation").onclick=function(){setStudyMode("dictation");startDictation()};$("startShadowing").onclick=function(){setStudyMode("shadow");startShadowing()};Array.prototype.querySelectorAll("[data-close-modal]").forEach(function(b){b.onclick=editClose});Array.prototype.querySelectorAll("[data-close-ai]").forEach(function(b){b.onclick=function(){$("aiModal").hidden=true}});$("editModal").onclick=function(e){if(e.target===this)editClose()};$("aiModal").onclick=function(e){if(e.target===this)this.hidden=true};$("editForm").onsubmit=function(e){e.preventDefault();var x=study.segments[active],old=keyOf(x);x.transcriptEN=$("editEN").value.trim();x.translationTR=$("editTR").value.trim();x.startSeconds=Math.max(0,+$("editStart").value||0);x.endSeconds=Math.max(x.startSeconds+.2,+$("editEnd").value||x.startSeconds+.2);var s=state(),fresh=keyOf(x);["learned","hard","favorites"].forEach(function(k){if(s[k][old]){s[k][fresh]=s[k][old];delete s[k][old]}});normalizeStudyTimelines();active=study.segments.indexOf(x);renderTranscript();setActive(active,false);editClose();scheduleSave()};$("focusMode").onclick=function(){document.body.classList.toggle("yt-focus")};$("originalAudioMode").onclick=function(){setAudioSource("original")};$("guideAudioMode").onclick=function(){setAudioSource("guide")};$("ownAudioMode").onclick=function(){setAudioSource("own")};
 bindTimelineAligner();
 global.addEventListener("online",syncBadge);global.addEventListener("offline",syncBadge);global.addEventListener("dh-cloud-synced",syncBadge);document.addEventListener("keydown",function(e){if(e.target&&/input|textarea|select/i.test(e.target.tagName))return;if(e.code==="Space"){e.preventDefault();playPause()}else if(e.key==="ArrowLeft")$("prevSentence").click();else if(e.key==="ArrowRight")$("nextSentence").click();else if(e.key.toLowerCase()==="l")$("loopToggle").click();else if(e.key.toLowerCase()==="a")$("autoPauseToggle").click();else if(e.key.toLowerCase()==="s")setStudyMode("shadow");else if(e.key.toLowerCase()==="d")setStudyMode("dictation")})
}
global.addEventListener("dh-cloud-synced",function(){
 if(!studyApi){syncBadge();return}
 Promise.resolve(studyApi.applyMirror?studyApi.applyMirror():0)
  .then(function(){return renderLibrary()})
  .then(syncBadge)
  .catch(syncBadge);
});
async function boot(){studyApi=global.DHYouTubeStudy;if(!studyApi){setStatus("YouTube veri katmanı yüklenemedi.","error");return}bind();await studyApi.applyMirror().catch(function(){});await renderLibrary();syncBadge();var q=new URLSearchParams(location.search),id=studyApi.videoId(q.get("video")||""),previewMode=q.get("preview")||"";if(/^(127\.0\.0\.1|localhost)$/.test(location.hostname)&&/^(study|reverse)$/.test(previewMode)){videoId="HAG4uyrkVfA";videoUrl=studyApi.canonical(videoId);var lines=[[8,10,"Doctor","You have a bacterial infection in your throat.","Boğazınızda bakteriyel bir enfeksiyon var."],[10,13,"Doctor","Take your medicine and drink more water.","İlacınızı alın ve daha fazla su için."],[13,17,"Tom","How long should I take the antibiotics?","Antibiyotikleri ne kadar süre kullanmalıyım?"],[17,21,"Doctor","Take them twice a day for one week.","Bir hafta boyunca günde iki kez alın."],[21,25,"Tom","Should I stay home from work?","İşe gitmeyip evde kalmalı mıyım?"],[25,29,"Doctor","You should rest until the fever is gone.","Ateşiniz geçene kadar dinlenmelisiniz."],[29,33,"Tom","I feel exhausted and a little dizzy.","Kendimi bitkin ve biraz başı dönmüş hissediyorum."],[33,37,"Doctor","That can happen when your body fights an infection.","Vücudunuz enfeksiyonla savaşırken bu olabilir."],[37,41,"Doctor","Come back if you do not feel better.","Kendinizi daha iyi hissetmezseniz tekrar gelin."],[41,45,"Tom","Thank you for explaining everything.","Her şeyi açıkladığınız için teşekkür ederim."]];var sample={title:"I Went to the Doctor and THIS Happened | Health Vocabulary",level:"A2",summaryTR:"Doktor muayenesinde hastalık belirtileri, tedavi ve tavsiye ifadeleri.",source:{videoId:videoId,author:"Daily English Talk",durationSeconds:1021,completeVideo:true,chunkCount:3,language:previewMode==="reverse"?"tr":"en",sourceLanguage:previewMode==="reverse"?"tr":"en",reverseShadowing:previewMode==="reverse"},segments:lines.map(function(a){return{startSeconds:a[0],endSeconds:a[1],speaker:a[2],transcriptEN:a[3],translationTR:a[4],listenTR:"Cümleyi dinleyip tekrar edin."}}),phrases:[{phrase:"take your medicine",meaningTR:"ilacını almak",exampleEN:"Take your medicine after dinner.",timestampSeconds:10},{phrase:"feel exhausted",meaningTR:"bitkin hissetmek",exampleEN:"I feel exhausted today.",timestampSeconds:29}],quiz:[{questionTR:"Doktor ilacın ne kadar süre kullanılmasını söylüyor?",options:["Bir gün","Bir hafta","Bir ay"],correctIndex:1,explanationTR:"Doktor bir hafta boyunca kullanılmasını söylüyor."}],roleplay:{}};renderStudy(studyApi.applyYouTubeTranscriptAuthority(sample,"youtube-transcript"));createPlayer(videoId).catch(function(){});return}if(id)openSaved(id)}
(global.DHYouTubeSessionReady||Promise.resolve()).then(boot);
})(window);