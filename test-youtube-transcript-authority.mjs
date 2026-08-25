import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("./immersive-youtube-study.js",import.meta.url),"utf8");
const document={readyState:"loading",addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]}};
const window={document,navigator:{onLine:true},addEventListener(){},dispatchEvent(){}};
window.window=window;
const context=vm.createContext({window,document,navigator:window.navigator,console,URL,Blob,Date,Math,JSON,Promise,setTimeout,clearTimeout,setInterval,clearInterval});
vm.runInContext(source,context,{filename:"immersive-youtube-study.js"});

const input={
  title:"Transcript test",
  level:"A2",
  source:{videoId:"HAG4uyrkVfA",durationSeconds:20,language:"en",completeVideo:true},
  segments:[
    {startSeconds:5.2,endSeconds:6.1,transcriptEN:"First line.",translationTR:"İlk satır."},
    {startSeconds:8.7,endSeconds:9.4,transcriptEN:"Second line.",translationTR:"İkinci satır."},
    {startSeconds:13.1,endSeconds:15.4,transcriptEN:"Last line.",translationTR:"Son satır."}
  ],
  phrases:[],quiz:[],roleplay:{}
};

const result=window.DHYouTubeStudy.applyYouTubeTranscriptAuthority(input,"youtube-transcript");
assert.deepEqual(Array.from(result.segments,x=>x.startSeconds),[5.2,8.7,13.1],"YouTube başlangıç zamanları aynen korunmalı");
assert.equal(result.segments[0].endSeconds,8.66,"İlk satır sonraki YouTube zamanında bitmeli");
assert.equal(result.segments[1].endSeconds,13.06,"İkinci satır sonraki YouTube zamanında bitmeli");
assert.equal(result.segments[2].endSeconds,15.4,"Son satır kendi geçerli bitişini korumalı");
assert.equal(result.source.timelineAuthority,"youtube-transcript");
assert.equal(result.source.timingVersion,5);
assert.equal(window.DHYouTubeStudy.isExactTiming(result),true);
assert.equal(input.segments[0].endSeconds,6.1,"Kaynak veri yerinde değiştirilmemeli");

console.log("YouTube transkript zaman otoritesi davranış testleri geçti.");
