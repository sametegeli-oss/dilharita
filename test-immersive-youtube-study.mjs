import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("./immersive-youtube-study.js",import.meta.url),"utf8");
const context={
  console,URL,setTimeout,clearTimeout,
  localStorage:{getItem(){return null},setItem(){}},
  document:{readyState:"loading",getElementById(){return null},addEventListener(){}},
  window:null
};
context.window=context;
vm.runInNewContext(source,context,{filename:"immersive-youtube-study.js"});

const api=context.DHYouTubeStudy;
assert.ok(api,"DHYouTubeStudy dışa açılmalı");
assert.equal(typeof api.prepareScene,"function");
assert.equal(typeof api.save,"function");
assert.equal(typeof api.remove,"function");
assert.equal(typeof api.saveShadowAudio,"function");
assert.equal(typeof api.getShadowAudio,"function");
assert.equal(typeof api.allShadowAudio,"function");
assert.equal(typeof api.deleteShadowAudio,"function");
assert.equal(typeof api.parseCaptionPayload,"function");
assert.equal(typeof api.parseYouTubeTranscriptText,"function");
assert.equal(typeof api.fetchOfficialCaptions,"function");
assert.equal(typeof api.fetchYouTubeTranscript,"function");
assert.equal(typeof api.buildStudyFromYouTubeTranscript,"function");
assert.equal(typeof api.alignSegmentsToCaptionCues,"function");
assert.equal(typeof api.alignWithOfficialCaptions,"function");
assert.equal(typeof api.validateExactTimeline,"function");
assert.equal(typeof api.isExactTiming,"function");
assert.equal(typeof api.canonical,"function");
assert.equal(api.videoId("https://www.youtube.com/watch?v=XRG9LfZmChQ"),"XRG9LfZmChQ");
assert.equal(api.videoId("https://youtu.be/XRG9LfZmChQ?t=10"),"XRG9LfZmChQ");
assert.equal(api.videoId("https://www.youtube.com/shorts/XRG9LfZmChQ"),"XRG9LfZmChQ");
assert.equal(api.videoId("https://example.com/watch?v=XRG9LfZmChQ"),"");
assert.equal(api.videoId("geçersiz"),"");
assert.deepEqual(
  JSON.parse(JSON.stringify(api.makeChunks(1798))),
  [
    {index:0,start:0,end:480},
    {index:1,start:480,end:960},
    {index:2,start:960,end:1440},
    {index:3,start:1440,end:1798}
  ]
);

const meta={videoId:"XRG9LfZmChQ",title:"Healthcare Conversations",durationSeconds:1798,verifiedAt:1};
const chunk={index:0,start:0,end:480};
const chunkData=api.normalizeChunk({
  sourceVideoId:meta.videoId,sourceDurationSeconds:1798,
  rangeStartSeconds:0,rangeEndSeconds:480,videoTitle:meta.title,level:"B1",
  chunkSummaryTR:"İlk bölüm",
  sentences:[
    {startSeconds:10,endSeconds:14,speaker:"Max",transcriptEN:"Good morning.",translationTR:"Günaydın."},
    {startSeconds:20,endSeconds:24,speaker:"Mia",transcriptEN:"How are you?",translationTR:"Nasılsın?"}
  ],
  phrases:[],quiz:[],roleplay:{sceneType:"doctor"}
},meta,chunk);
assert.equal(chunkData.sentences.length,2);
const repairedChunk=api.normalizeChunk(`DH-ID: DH-TEST
{
  "sourceVideoId":"XRG9LfZmChQ",
  "sourceDurationSeconds":1798,
  "rangeStartSeconds":0,
  "rangeEndSeconds":480,
  "videoTitle":"Healthcare Conversations",
  "level":"B1",
  "chunkSummaryTR":"Bu bölümde "I have" ve "I feel" kalıpları anlatılır.",
  "sentences":[{"startSeconds":30,"endSeconds":34,"speaker":"Mia","transcriptEN":"Say "I feel dizzy" to the doctor.","translationTR":"Doktora "Başım dönüyor" deyin."}],
  "phrases":[],
  "quiz":[],
  "roleplay":{}
}`,meta,chunk);
assert.equal(repairedChunk.chunkSummaryTR,'Bu bölümde "I have" ve "I feel" kalıpları anlatılır.');
assert.equal(repairedChunk.sentences[0].transcriptEN,'Say "I feel dizzy" to the doctor.');
const merged=api.mergeChunks(meta,[chunk],[chunkData]);
assert.equal(merged.source.completeVideo,true);
assert.equal(merged.source.durationSeconds,1798);
assert.equal(merged.segments.length,2);
assert.equal(merged.segments[0].speaker,"Max");
assert.match(api.chunkPrompt("https://www.youtube.com/watch?v=XRG9LfZmChQ",meta,chunk,4),/BİR TRANSKRİPT SATIRINDA BİRDEN FAZLA CÜMLE/);
assert.match(api.chunkPrompt("https://www.youtube.com/watch?v=XRG9LfZmChQ",meta,chunk,4),/her nesnede yalnız bir cümle/);
assert.match(api.chunkPrompt("https://www.youtube.com/watch?v=XRG9LfZmChQ",meta,chunk,4),/TEK ZAMAN OTORİTESİ YOUTUBE TRANSKRİPTİDİR/);
assert.match(api.chunkPrompt("https://www.youtube.com/watch?v=XRG9LfZmChQ",meta,chunk,4),/alıntı gerekiyorsa tek tırnak/);
assert.match(api.chunkPrompt("https://www.youtube.com/watch?v=XRG9LfZmChQ",{...meta,sourceLanguageRequested:"tr"},chunk,4),/Kaynak dili TÜRKÇE/);
assert.match(api.chunkPrompt("https://www.youtube.com/watch?v=XRG9LfZmChQ",{...meta,sourceLanguageRequested:"tr"},chunk,4),/doğal ve konuşulabilir İngilizce/);
const turkishChunk=api.normalizeChunk({
  sourceVideoId:meta.videoId,sourceDurationSeconds:1798,sourceLanguage:"tr",
  rangeStartSeconds:0,rangeEndSeconds:480,videoTitle:"Türkçe Sağlık",level:"A2",
  sentences:[{startSeconds:10.4,endSeconds:12.7,timingConfidence:.96,speaker:"Doktor",transcriptEN:"Take your medicine.",translationTR:"İlacınızı alın."}],
  phrases:[],quiz:[],roleplay:{}
},{...meta,sourceLanguageRequested:"tr"},chunk);
assert.equal(turkishChunk.sourceLanguage,"tr");
assert.equal(turkishChunk.sentences[0].startSeconds,10.4);
assert.throws(()=>api.normalizeChunk({
  sourceVideoId:meta.videoId,sourceDurationSeconds:1798,sourceLanguage:"en",
  rangeStartSeconds:0,rangeEndSeconds:480,videoTitle:"Birleşik transkript",level:"A2",
  sentences:[{startSeconds:60,endSeconds:67,timingConfidence:1,speaker:"",transcriptEN:"Do you deliver to my hotel certainly just provide the address is there a delivery charge yes depending on the distance",translationTR:"Otelime teslim eder misiniz elbette adresi verin teslimat ücreti var mı evet mesafeye göre"}],
  phrases:[],quiz:[],roleplay:{}
},meta,chunk),/paragraf halinde bıraktı/);
const mergedTurkish=api.mergeChunks({...meta,sourceLanguageRequested:"tr"},[chunk],[turkishChunk]);
assert.equal(mergedTurkish.source.reverseShadowing,true);
assert.equal(mergedTurkish.source.language,"tr");
assert.ok(mergedTurkish.segments[0].guideDurationSeconds>0);

const parsedCues=api.parseCaptionPayload(JSON.stringify({events:[
  {tStartMs:10000,dDurationMs:1200,segs:[{utf8:"Hello there."}]},
  {tStartMs:12500,dDurationMs:1400,segs:[{utf8:"How are you?"}]}
]}));
assert.equal(parsedCues.length,2);
const captionAligned=api.alignSegmentsToCaptionCues({
  title:"Caption test",source:{videoId:meta.videoId,language:"en",durationSeconds:30},
  segments:[
    {startSeconds:1,endSeconds:2,transcriptEN:"Hello there.",translationTR:"Merhaba."},
    {startSeconds:3,endSeconds:4,transcriptEN:"How are you?",translationTR:"Nasılsın?"}
  ],phrases:[],quiz:[],roleplay:{}
},parsedCues);
assert.equal(captionAligned.alignedCount,2);
assert.equal(captionAligned.exact,true);
assert.ok(captionAligned.data.segments[0].startSeconds>=9.9);
assert.equal(captionAligned.data.source.captionTimingSource,"youtube-caption-track");
assert.equal(api.isExactTiming(captionAligned.data),true);
const rejectedPartial=api.alignSegmentsToCaptionCues({
  title:"Partial caption test",source:{videoId:meta.videoId,language:"en",durationSeconds:30},
  segments:[
    {startSeconds:1,endSeconds:2,transcriptEN:"Hello there.",translationTR:"Merhaba."},
    {startSeconds:3,endSeconds:4,transcriptEN:"This sentence is absent.",translationTR:"Bu cümle yok."}
  ],phrases:[],quiz:[],roleplay:{}
},parsedCues);
assert.equal(rejectedPartial.exact,false,"Kısmi eşleşme kesin senkron sayılmamalı");
assert.equal(api.isExactTiming(rejectedPartial.data),false);
const wordTimed=api.parseCaptionPayload(JSON.stringify({events:[
  {tStartMs:57000,dDurationMs:2000,segs:[{utf8:"Yes",tOffsetMs:200},{utf8:" we",tOffsetMs:500},{utf8:" offer",tOffsetMs:900}]}
]}));
assert.equal(wordTimed[0].words[0].start,57.2);
assert.equal(wordTimed[0].words[1].start,57.5);
const pastedYouTube=api.parseYouTubeTranscriptText(`0:00
Hello there.
This untimed chapter heading must be ignored
0:03
How are you?
0:06 [music]
0:06 This is the third line.
Tümü
Uploader name`,30);
assert.equal(pastedYouTube.length,3);
assert.equal(pastedYouTube[0].start,0);
assert.equal(pastedYouTube[1].start,3);
assert.equal(pastedYouTube[2].text,"This is the third line.");
assert.doesNotMatch(pastedYouTube.map(x=>x.text).join(" "),/chapter heading|Tümü|Uploader/);
const directStudy=api.buildStudyFromYouTubeTranscript({
  videoId:meta.videoId,title:"Direct YouTube transcript",durationSeconds:30
},{
  videoId:meta.videoId,sourceLanguage:"en",timingSource:"youtube-caption-track",
  cues:parsedCues,
  translatedLanguage:"tr",
  translatedCues:[
    {start:10,end:11.2,text:"Merhaba."},
    {start:12.5,end:13.9,text:"Nasılsın?"}
  ]
});
assert.equal(directStudy.segments.length,2,"Her YouTube zaman satırı ayrı kayıt olmalı");
assert.equal(directStudy.segments[0].transcriptEN,"Hello there.");
assert.equal(directStudy.segments[0].translationTR,"Merhaba.");
assert.equal(directStudy.segments[0].startSeconds,10,"Başlangıç doğrudan YouTube zamanından gelmeli");
assert.equal(directStudy.source.transcriptMode,"youtube-direct");
assert.equal(directStudy.source.translationSource,"youtube-translated-caption");
assert.equal(directStudy.source.timingVersion,6);
assert.equal(directStudy.captionTimeline.length,2,"Ham YouTube zaman çizelgesi korunmalı");
const directTurkish=api.buildStudyFromYouTubeTranscript({videoId:meta.videoId,title:"Türkçe YouTube",durationSeconds:30},{
  videoId:meta.videoId,sourceLanguage:"tr",mode:"youtube-pasted",timingSource:"youtube-transcript-paste",
  cues:[{start:1,end:3,text:"Bugün nasılsınız?"},{start:3,end:5,text:"Teşekkür ederim."}],translatedCues:[]
});
assert.equal(directTurkish.segments.length,2,"Türkçe özgün transkript çeviri olmadan da korunmalı");
assert.equal(directTurkish.segments[0].translationTR,"Bugün nasılsınız?");
assert.equal(directTurkish.segments[0].transcriptEN,"","Olmayan İngilizce çeviri uydurulmamalı");
assert.equal(directTurkish.source.transcriptMode,"youtube-pasted");
const importedCues=api.parseCaptionPayload(`WEBVTT

00:00:10.000 --> 00:00:11.200
Hello there.

00:00:12.500 --> 00:00:13.900
How are you?
`);
const importedExact=api.alignSegmentsToCaptionCues({
  title:"Imported caption test",source:{videoId:meta.videoId,language:"en",durationSeconds:30},
  segments:[
    {startSeconds:1,endSeconds:2,transcriptEN:"Hello there.",translationTR:"Merhaba."},
    {startSeconds:3,endSeconds:4,transcriptEN:"How are you?",translationTR:"Nasılsın?"}
  ],phrases:[],quiz:[],roleplay:{}
},importedCues,"subtitle-file");
assert.equal(importedExact.exact,true);
assert.equal(importedExact.data.source.captionTimingSource,"subtitle-file");
assert.equal(importedExact.data.segments.every(x=>x.timingVerified),true);
assert.equal(importedExact.data.captionTimeline.length,2,"Doğrulanan ham zaman çizelgesi IndexedDB kaydında korunmalı");
assert.equal(api.validateExactTimeline({source:{durationSeconds:20},segments:[
  {startSeconds:2,endSeconds:5,timingVerified:true},
  {startSeconds:4,endSeconds:6,timingVerified:true}
]}).ok,false,"Çakışan cümleler doğrulamadan geçmemeli");

const normalized=api.normalize({
  title:"Healthcare",level:"A2",summaryTR:"Özet",
  segments:[{startSeconds:0,endSeconds:12,listenTR:"Dinle",questionEN:"What?",answerEN:"A doctor."}],
  phrases:[{phrase:"I have an appointment",meaningTR:"Randevum var"}],
  quiz:[{questionTR:"Kim?",options:["Doktor","Pilot","Garson"],correctIndex:0}],
  roleplay:{sceneType:"doctor"}
});
assert.equal(normalized.level,"A2");
assert.equal(normalized.segments.length,1);
assert.equal(normalized.segments[0].transcriptEN,"A doctor.");
assert.equal(normalized.phrases[0].phrase,"I have an appointment");

const html=fs.readFileSync(new URL("./immersive.html",import.meta.url),"utf8");
for(const id of ["youtubePickForm","youtubeUrl","youtubePlayer","youtubeStudy","youtubeStudyContent","youtubeLibrary","youtubeLibraryCount","youtubeOffline"]){
  assert.match(html,new RegExp(`id=["']${id}["']`),`${id} HTML içinde olmalı`);
}
assert.match(html,/immersive-youtube-study\.js\?v=11/);
assert.match(html,/immersive-youtube\.css\?v=4/);

assert.match(source,/DilHaritaYouTube_DB/);
assert.match(source,/dh-immersive-youtube-library-v1/);
assert.match(source,/data-yt-loop-start/);
assert.match(source,/transcriptEN/);
assert.match(source,/translationTR/);
assert.match(source,/CHUNK_SECONDS=480/);
assert.match(source,/completeVideo:true/);
assert.match(source,/navigator\.onLine/);
assert.match(source,/dh-cloud-synced/);
assert.match(source,/DB_VERSION=2/);
assert.match(source,/AUDIO_STORE="shadowAudio"/);

const cloud=fs.readFileSync(new URL("./cloud-sync.js",import.meta.url),"utf8");
assert.match(cloud,/"dh-immersive-"/,"YouTube kitaplığı mevcut bulut eşitleme kapsamına girmeli");
assert.match(cloud,/youtube_studies/,"Uzun video kayıtları ayrı Firestore belgelerine yazılmalı");
assert.match(cloud,/900000/,"Tam video kaydı tek video Firestore sınırında taşınmalı");

const backup=fs.readFileSync(new URL("./dh-yedek.js",import.meta.url),"utf8");
assert.match(backup,/DilHaritaYouTube_DB/,"YouTube IndexedDB kayıtları tam yedeğe dahil olmalı");

const sw=fs.readFileSync(new URL("./sw.js",import.meta.url),"utf8");
assert.match(sw,/dh-sw-v179/);
assert.match(sw,/\.\/immersive-youtube-study\.js/);

console.log("YouTube video seçim ve çalışma testleri geçti.");
