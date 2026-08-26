import assert from "node:assert/strict";
import fs from "node:fs";

const read=name=>fs.readFileSync(new URL(`./${name}`,import.meta.url),"utf8");
const html=read("youtube-egitim.html"),js=read("youtube-egitim.js"),css=read("youtube-egitim.css"),lock=read("youtube-session-lock.js"),sw=read("sw.js"),menu=read("menu.html"),audio=read("sesdalga.html");

for(const id of ["sessionGate","ytApp","homeView","studyView","videoForm","videoUrl","ytPlayer","captionEN","captionTR","transcriptList","phrasesPanel","quizPanel","practiceBox","libraryDrawer","editModal","aiModal","pasteTranscriptOpen","transcriptPasteModal","transcriptPasteForm","transcriptPasteText"]){
  assert.match(html,new RegExp(`id=["']${id}["']`),`${id} YouTube sayfasında bulunmalı`);
}
for(const feature of ["startShadowing","startDictation","askGemini","editSentence","markLearned","markHard","loopToggle","toggleEN","toggleTR"]){
  assert.match(html,new RegExp(`id=["']${feature}["']`),`${feature} çalışma aracı bulunmalı`);
}
for(const id of ["videoLanguage","autoPauseToggle","karaokeToggle","refreshTiming","importSubtitles","subtitleFile","timingState","originalAudioMode","guideAudioMode","ownAudioMode","ownAudioCount","syncSentence","exportModal","exportDownload","wordActionBar","wordbookPanel","grammarPanel","audioLabModal","audioLabFrame"]){
  assert.match(html,new RegExp(`id=["']${id}["']`),`${id} gelişmiş çalışma aracı bulunmalı`);
}
assert.match(js,/DHYouTubeStudy/);
assert.match(js,/DHWordPop\.lookup/);
assert.match(js,/LearningErrorDB\.logFromVideo/);
assert.match(js,/DHGemini\.ask/);
assert.match(js,/SpeechRecognition\|\|global\.webkitSpeechRecognition/);
assert.match(js,/setLoop\(true\)/);
assert.match(js,/studyApi\.save/);
assert.match(js,/openAudioLab/);
assert.match(js,/sesdalga\.html\?embed=1/);
assert.match(js,/buildExport/);
assert.match(js,/renderWordbook/);
assert.match(js,/analyzeGrammar/);
assert.match(js,/updateKaraoke/);
assert.match(js,/loopIndex/);
assert.match(js,/segmentEnd/);
assert.match(js,/forceShadowMute/);
assert.match(js,/startShadowSync/);
assert.match(js,/Sessiz görüntüyle shadowing/);
assert.match(js,/active!==xIndex/);
assert.match(js,/recognition\.continuous=true/);
assert.equal((js.match(/async function beginShadowCapture/g)||[]).length,1,"Shadowing kayıt motoru tek tanımlı olmalı");
assert.match(js,/persistShadowRecording/);
assert.match(js,/setAudioSource/);
assert.match(js,/syncOwnVoice/);
assert.match(js,/allShadowAudio/);
assert.match(js,/forceOriginalFallback/);
assert.match(js,/startMicMeter/);
assert.match(js,/Gri · ses bekleniyor/);
assert.match(js,/Kayıtsız cümlelerde/);
assert.match(js,/İngilizce rehber/);
assert.match(js,/Ters shadowing/);
assert.match(js,/englishGuideDuration/);
assert.match(js,/syncSentenceToCurrent/);
assert.match(js,/seekNonce/);
assert.match(js,/alignCurrentCaptions/);
assert.match(js,/refreshTiming/);
assert.match(js,/importSubtitleFile/);
assert.match(js,/hasExactTiming/);
assert.match(js,/timingBlockedMessage/);
assert.match(js,/result&&result\.exact/);
assert.match(js,/buildStudyFromYouTubeTranscript/);
assert.match(js,/YouTube konuşma metnini zamanlarıyla yapıştırın/);
assert.doesNotMatch(js,/studyApi\.fetchYouTubeTranscript/);
assert.match(js,/isYouTubeTranscriptSource/);
assert.match(js,/youtube-pasted/);
assert.match(js,/parseYouTubeTranscriptText/);
assert.doesNotMatch(js,/DHProviders\.youtubeStudy/);
assert.doesNotMatch(js,/function manualChunks/);
assert.doesNotMatch(js,/manual-cue-adjustment/);
assert.match(read("immersive-youtube-study.js"),/youtube-direct/);
assert.match(read("immersive-youtube-study.js"),/timingSource:"youtube-caption-track"/);
assert.match(js,/guideLastStartedAt/);
assert.match(css,/\.yt-karaoke-word\{display:inline-block;margin-right:/);
assert.match(js,/startShadowCountdown/);
assert.match(js,/startShadowDurationGuide/);
assert.match(js,/shadowTargetFor/);
assert.match(js,/BAŞLA/);
assert.match(js,/BİTİR/);
assert.match(js,/shadowStopHandler\(true\)/);
assert.match(css,/yt-tone-meter/);
assert.match(css,/\.yt-tone-meter i\.is-strong/);
assert.match(css,/yt-signal\.is-start/);
assert.match(css,/yt-signal\.is-stop/);
assert.match(css,/yt-shadow-duration/);
assert.match(html,/youtube-egitim\.js\?v=16/);
assert.match(html,/immersive-youtube-study\.js\?v=13/);
assert.match(audio,/dh-embedded/);
assert.match(audio,/URLSearchParams\(location\.search\)/);
assert.match(lock,/runTransaction/);
assert.match(lock,/expiresAt/);
assert.match(lock,/DHYouTubeSessionReady/);
assert.match(css,/@media\(max-width:1050px\)/);
assert.match(css,/@media\(max-width:680px\)/);
assert.match(css,/grid-template-columns:minmax\(0,1\.62fr\)/);
assert.match(menu,/href="\.\/youtube-egitim\.html"/);
assert.match(sw,/\.\/youtube-egitim\.html/);
assert.match(sw,/\.\/youtube-egitim\.js/);
assert.match(sw,/\.\/youtube-session-lock\.js/);
assert.match(sw,/\.\/youtube-egitim\.css/);
assert.match(sw,/\.\/sesdalga\.html/);
assert.match(sw,/dh-sw-v179/);

console.log("YouTube Eğitim Stüdyosu yapı testleri geçti.");
