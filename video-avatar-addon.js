/* video-avatar-addon.js — videopractice'in GELİŞMİŞ özelliklerini index-app'e taşır.
   ============================================================================
   TAŞINANLAR (videopractice.html'den birebir, mantık değiştirilmedi):
     · Konuşan avatar (VISEME dudak senkronu)
     · Karaoke (cümle okunurken kelime kelime vurgu)
     · Mikrofonla telaffuz kontrolü  -> koça bildirir, hata defterine yazar, SRS notu verir
     · Kendi sesini kaydet + dinle
     · Pexels video (imgQuery ile ARANIR — cümlenin tamamıyla değil)

   NEDEN EKLENTİ? React (assets/app.js) minified; ona dokunmuyoruz. image-addon.js
   ile aynı deseni izler: DOM'u izler, .card görünce panelini karta basar.

   KALDIRILAN ÇAKIŞMA: word-direct-tools'un "shadowing" aracı. Sebep: buradaki
   mikrofon onun her şeyini yapıyor (kayıt, yavaş dinleme) ve ÜSTELİK koç/SRS/hata
   defterine yazıyor — shadowing bunların hiçbirini yapmıyordu, çalışman sayılmıyordu.
   ============================================================================ */
(function(){
"use strict";
if (window.__dhVideoAvatarAddon) return;
window.__dhVideoAvatarAddon = true;

var API_KEY="dh-pexels-key";
var State={ en:"", tr:"", sentence:null, videoPayload:null };


/* ---------- videopractice'ten eksik kalan GLOBALLER ----------
   playTeaching/karaoke bunlara yazıyor; alınmadıkları için
   'ReferenceError: _lastVisemeWord is not defined' hatası veriyordu. */
let _nextTapLock=false;
let _feedbackTimer=null;
let _statusTimer=null;
let _dict=null, _dictPromise=null;
let _lastVisemeWord=-1;
let _perWordEstimate=420;   /* karaoke kelime süresi (ms). Bildirimi eksikti:
                               "use strict" altında atama ReferenceError veriyordu. */
let _pronMap=[];
/* ---------- videopractice'in beklediği global yardımcılar ---------- */
function $(id){ return document.getElementById(id); }
function currentSentence(){ return State.sentence || {en:State.en, tr:State.tr}; }
function showStatus(t){ var e=$("vaStatus"); if(e) e.textContent=t||""; }
function setLoading(on,msg){ var e=$("vaLoading"); if(!e) return;
  e.style.display=on?"flex":"none"; if(msg){ var m=e.querySelector("span"); if(m) m.textContent=msg; } }
function scheduleStatusClear(){ setTimeout(function(){ showStatus(""); },2500); }
function hideFeedback(){ var e=$("vaFeedback"); if(e) e.classList.add("hidden"); }
function showFeedback(html,cls){ var e=$("vaFeedback"); if(!e) return;
  e.className="va-feedback "+(cls||""); e.innerHTML=html; }
function clearVideoStatus(){ showStatus(""); }
function scheduleFeedbackHide(){ setTimeout(hideFeedback, 6000); }
function clearUiTimers(){}
function bindTap(el,fn){ if(el) el.onclick=fn; }

/* ---------- IndexedDB (videopractice ile AYNI depo) ---------- */
var _db=null;
function openDB(){
  return new Promise(function(res,rej){
    if(_db) return res(_db);
    /* KRİTİK: VERSİYON BELİRTME.
       Bu veritabanını (sentence-mode) React de kullanıyor. Sabit bir versiyon
       (örn. 3) vermek, mevcut sürümden yüksekse YÜKSELTME tetikler; React'in
       açık bağlantısı varsa yükseltme BLOKE olur ve React hiç başlamaz
       -> SAYFA BOŞ KALIR. Versiyonsuz açış mevcut sürümü kullanır, kimseyi kilitlemez. */
    var r=indexedDB.open("sentence-mode");
    r.onsuccess=function(){
      _db=r.result;
      /* "kv" deposu yoksa bu DB'yi kullanamayız — sessizce devre dışı kal,
         React'i yükseltmeye zorlamaktansa önbelleksiz çalış. */
      if(!_db.objectStoreNames.contains("kv")){ _db=null; return rej(new Error("kv yok")); }
      res(_db);
    };
    r.onerror=function(){ rej(r.error); };
    r.onblocked=function(){ rej(new Error("blocked")); };
  });
}
async function kvGet(k){ try{ var d=await openDB(); return await new Promise(function(res){
  var q=d.transaction("kv","readonly").objectStore("kv").get(k);
  q.onsuccess=function(){ res(q.result||null); }; q.onerror=function(){ res(null); }; }); }catch(e){ return null; } }
async function kvSet(k,v){ try{ var d=await openDB(); return await new Promise(function(res){
  var q=d.transaction("kv","readwrite").objectStore("kv").put(v,k);
  q.onsuccess=function(){ res(true); }; q.onerror=function(){ res(false); }; }); }catch(e){ return false; } }

var VA_CSS = `
.controls{position:fixed;left:0;right:0;bottom:16px;z-index:6;display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:10px;width:min(760px,calc(100vw - 24px));margin:auto}
.ctrl{background:transparent;border:0;color:white;text-shadow:0 2px 10px rgba(0,0,0,.75);font-weight:950;font-size:15px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px}
.ctrl-ico{width:46px;height:46px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.5);border:1px solid #ffffff22;font-size:25px}
.mic-caption{text-align:center;color:white;font-weight:950;margin-top:8px;text-shadow:0 2px 10px #000}
.feedback{position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:9;width:min(720px,calc(100vw - 28px));background:rgba(2,6,23,.9);border:1px solid #ffffff24;border-radius:18px;padding:14px 16px;box-shadow:var(--shadow);color:#e5e7eb}
.feedback.ok{border-color:#22c55e88}
.feedback.bad{border-color:#ef444488}
.controls{bottom:18px;grid-template-columns:1fr 106px 1fr}
.ctrl{font-size:13px}
.ctrl-ico{width:42px;height:42px}
.feedback{top:72px}
.feedback.pronunciation-only{width:min(620px,calc(100vw - 28px));text-align:center;padding:18px 18px 20px}
.heard-colored{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;font-size:20px;font-weight:950;line-height:1.45}
.heard-colored .wd-ok,.heard-colored .wd-bad{padding:7px 10px;border-radius:11px}
.own-voice-row{margin-top:14px;display:flex;justify-content:center}
.own-voice-btn{border:0;border-radius:999px;background:#2563eb;color:#fff;font-weight:950;padding:10px 16px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.24)}
.own-voice-btn:active{transform:scale(.97)}
.own-voice-btn{width:100%;max-width:260px}
.teach-overlay{position:fixed;bottom:168px;left:50%;transform:translateX(-50%);z-index:55;width:min(380px,calc(100vw - 24px));background:rgba(7,12,24,.62);border:1px solid #ffffff2e;border-radius:20px;box-shadow:0 20px 56px rgba(0,0,0,.5);padding:14px 16px 16px;display:flex;flex-direction:column;align-items:center;gap:9px;backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
.teach-head{font-family:Fraunces,serif;font-weight:600;font-size:12px;color:#93c5fd;letter-spacing:.4px;text-transform:uppercase}
.avatar{width:108px;flex:0 0 auto}
.avatar .dilav-face{max-width:108px;border-width:2.5px!important}
.avatar .dilav-switch{transform:scale(.92)}
.avatar svg{width:78px;height:78px}
.avatar.speaking{box-shadow:0 12px 34px rgba(37,99,235,.55)}
.karaoke{width:100%;text-align:center;font-weight:950;font-size:clamp(18px,2.2vw,24px);line-height:1.35;letter-spacing:.2px;display:flex;flex-wrap:wrap;gap:5px 8px;justify-content:center}
.teach-tr{width:100%;text-align:center;color:var(--muted);font-family:Fraunces,serif;font-size:14px;line-height:1.4}
.teach-listen{border:0;border-radius:999px;background:var(--accent-strong);color:#fff;font-weight:950;font-size:14px;padding:10px 20px;cursor:pointer;box-shadow:0 8px 22px rgba(37,99,235,.35);display:inline-flex;align-items:center;gap:8px}
.teach-listen:active{transform:scale(.97)}
.teach-listen.playing{background:#dc2626}
.teach-hint{color:#64748b;font-size:11px;text-align:center;line-height:1.45}
.teach-overlay{top:auto;bottom:160px;left:50%;transform:translateX(-50%);width:min(360px,calc(100vw - 20px));flex-direction:column;padding:11px 13px;gap:7px}
.teach-overlay .teach-head{font-size:11px}
.avatar{width:78px}
.avatar .dilav-face{max-width:78px}
.avatar .dilav-switch{transform:scale(.82)}
.karaoke{font-size:clamp(16px,4.8vw,21px);gap:4px 7px}
.teach-tr{font-size:13px}
.teach-listen{padding:8px 17px;font-size:13px}
.teach-hint{display:none}
.avatar.photo-teacher-avatar,
.photo-teacher-avatar{
  width:124px!important;
  height:124px!important;
  border-radius:22px!important;
  overflow:hidden!important;
  border:2px solid #34d399aa!important;
  background:#050b16!important;
  box-shadow:0 18px 46px rgba(0,0,0,.55)!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
}
.photo-teacher-avatar-img{
  width:100%!important;
  height:100%!important;
  object-fit:cover!important;
  display:block!important;
}
.avatar.speaking.photo-teacher-avatar,
.photo-teacher-avatar.speaking{
  box-shadow:0 0 0 3px rgba(96,165,250,.22),0 18px 46px rgba(37,99,235,.5)!important;
}
.avatar.photo-teacher-avatar,
  .photo-teacher-avatar{
    width:92px!important;
    height:92px!important;
    border-radius:18px!important;
  }
.teach-overlay{
  position:fixed!important;
  left:16px!important;
  right:16px!important;
  bottom:116px!important;
  transform:none!important;
  width:auto!important;
  max-width:none!important;
  z-index:55!important;
  min-height:160px!important;
  display:grid!important;
  grid-template-columns:150px 1fr!important;
  grid-template-areas:
    "avatar head"
    "avatar text"
    "avatar tr"
    "avatar actions"
    "avatar hint"!important;
  align-items:center!important;
  gap:8px 16px!important;
  padding:16px 18px!important;
  background:rgba(7,12,24,.76)!important;
  border:1px solid #ffffff30!important;
  border-radius:24px!important;
  box-shadow:0 20px 56px rgba(0,0,0,.5)!important;
  backdrop-filter:blur(10px)!important;
  -webkit-backdrop-filter:blur(10px)!important;
}
.teach-head{grid-area:head!important;text-align:left!important;margin:0!important;font-size:12px!important}
.avatar,
#teachAvatar{
  grid-area:avatar!important;
  align-self:center!important;
  justify-self:center!important;
  width:140px!important;
  min-width:140px!important;
}
.photo-teacher-avatar,
.avatar.photo-teacher-avatar{
  width:140px!important;
  height:140px!important;
  border-radius:20px!important;
}
.karaoke{
  grid-area:text!important;
  justify-content:flex-start!important;
  text-align:left!important;
  font-size:clamp(24px,2.4vw,34px)!important;
  line-height:1.22!important;
  width:100%!important;
}
.teach-tr{
  grid-area:tr!important;
  text-align:left!important;
  font-size:clamp(18px,1.7vw,24px)!important;
  color:#dbeafe!important;
}
.teach-listen{
  grid-area:actions!important;
  justify-self:start!important;
  min-width:130px!important;
}
.teach-hint{
  grid-area:hint!important;
  text-align:left!important;
  color:#94a3b8!important;
}
.controls{
  z-index:70!important;
}
.teach-overlay{
    grid-template-columns:116px 1fr!important;
    bottom:112px!important;
    min-height:146px!important;
    padding:14px!important;
  }
.avatar,#teachAvatar{width:108px!important;min-width:108px!important}
.photo-teacher-avatar,.avatar.photo-teacher-avatar{width:108px!important;height:108px!important}
.karaoke{font-size:clamp(20px,3vw,28px)!important}
.teach-tr{font-size:16px!important}
.teach-overlay{
    left:12px!important;
    right:12px!important;
    bottom:118px!important;
    min-height:158px!important;
    grid-template-columns:92px 1fr!important;
    gap:6px 12px!important;
    padding:12px 12px 14px!important;
    border-radius:20px!important;
  }
.teach-head{font-size:11px!important}
.avatar,#teachAvatar{width:92px!important;min-width:92px!important}
.photo-teacher-avatar,.avatar.photo-teacher-avatar{width:92px!important;height:92px!important;border-radius:16px!important}
.karaoke{
    font-size:clamp(18px,5vw,24px)!important;
    gap:3px 6px!important;
  }
.teach-tr{font-size:14px!important}
.teach-listen{font-size:13px!important;padding:9px 14px!important}
.teach-hint{display:none!important}
.va-panel{margin:12px 0}
.va-media{position:relative;width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#0f172a;border:1px solid #ffffff14;display:none}
.va-media.has-video{display:block}
.va-media video{width:100%;height:100%;object-fit:cover;display:block}
.va-loading{position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:#cbd5e1;font-size:13px;background:#020617aa}
.va-row{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}
.va-btn{background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer;font-size:13px}
.va-btn:hover{background:#334155}
.va-status{color:#94a3b8;font-size:12px;flex:1;min-width:120px}
.va-mic-wrap{display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap}
.va-feedback{margin-top:10px;border-radius:12px;padding:12px;background:#0f172a;border:1px solid #334155;color:#e2e8f0;font-size:14px}
.va-feedback.hidden{display:none}
.kara-line{margin:8px 0;font-size:17px;font-weight:800;line-height:1.7;color:#e2e8f0}
/* ÇAKIŞMA GİDERİLDİ: word-direct-tools'un "Shadow" aracı gizlendi.
   Sebep: buradaki mikrofon onun her şeyini yapıyor (kayıt, yavaş dinleme) ve ÜSTELİK
   koça bildirip hata defterine ve SRS'e yazıyor — Shadow bunların hiçbirini yapmıyordu.
   Geri istersen: bu iki satırı sil. word-direct-tools.js DEĞİŞTİRİLMEDİ. */
button[data-wd="shadow"]{display:none !important}
`;

const VISEME={
  rest:  "M37 66 Q50 70 63 66 Q50 72 37 66 Z",       
  open:  "M36 64 Q50 60 64 64 Q50 78 36 64 Z",       
  round: "M44 64 Q50 60 56 64 Q56 74 50 76 Q44 74 44 64 Z",
  wide:  "M34 66 Q50 64 66 66 Q50 71 34 66 Z",       
  closed:"M38 66 Q50 65 62 66 Q50 67 38 66 Z",       
  teeth: "M40 64 Q50 62 60 64 Q50 72 40 64 Z"        
}
let _teachTimers=[];
let _visemeTimers=[];

function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}

function cleanText(t){return String(t||"").replace(/\s+/g," ").trim()}

function hash(str){let h=0;str=String(str||"");for(let i=0;i<str.length;i++){h=((h<<5)-h)+str.charCodeAt(i);h|=0}return Math.abs(h).toString(36)}

function pickVoice(lang){const voices=speechSynthesis.getVoices()||[];if(lang==="tr")return voices.find(v=>/^tr/i.test(v.lang))||null;return voices.find(v=>/^en-US/i.test(v.lang)&&/Google|Jenny|Aria|Zira|Samantha|Natural/i.test(v.name))||voices.find(v=>/^en/i.test(v.lang))||null}

function speakEnglish(text){try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="en-US";u.rate=.92;u.pitch=1;u.volume=1;const voice=pickVoice("en");if(voice)u.voice=voice;speechSynthesis.speak(u)}catch{}}

function teachPron(s){
  let p=String((s&&(s.trPron??s.tr_pron??s.trpron??s.TrPron??s.pronTR))||"").trim();
  if(/^(none|n\/a|na|-|—|yok|null)$/i.test(p))p="";
  return p||String(s&&s.tr||"");
}

function tokenizeEN(s){return String(s||"").match(/[A-Za-z']+(?:-[A-Za-z']+)*|\d+/g)||[]}

function normEN(w){return String(w||"").toLowerCase().replace(/[\u2019\u2018]/g,"'").replace(/[.,!?;:\"()]/g,"").trim()}

function normSeqEN(text){
  const out=[];
  for(const raw of tokenizeEN(text)){
    const n=normEN(raw);
    if(EN_CONTRACTIONS[n]) out.push(...EN_CONTRACTIONS[n].map(x=>({n:x,raw})));
    else if(n) out.push({n,raw});
  }
  return out;
}

function diffEN(answer,target){
  const A=normSeqEN(answer), B=normSeqEN(target);
  if(!A.length||!B.length)return{parts:B.map(x=>({type:"missing",word:x.raw})),correct:0,total:B.length,ratio:0,score:0,hadExtra:false};
  const m=A.length,n=B.length;
  const dp=Array.from({length:m+1},()=>new Int16Array(n+1));
  for(let i=m-1;i>=0;i--)for(let j=n-1;j>=0;j--)dp[i][j]=A[i].n===B[j].n?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const parts=[];let i=0,j=0,correct=0,extra=0;
  while(i<m&&j<n){
    if(A[i].n===B[j].n){parts.push({type:"ok",word:B[j].raw,heard:A[i].raw});correct++;i++;j++;}
    else if(dp[i+1][j]>=dp[i][j+1]){parts.push({type:"extra",word:A[i].raw});extra++;i++;}
    else{parts.push({type:"missing",word:B[j].raw});j++;}
  }
  while(i<m){parts.push({type:"extra",word:A[i++].raw});extra++;}
  while(j<n)parts.push({type:"missing",word:B[j++].raw});
  const ratio=correct/Math.max(n,1);
  const penalty=Math.min(extra*4,12);
  return{parts,correct,total:n,ratio,score:Math.max(0,Math.round(ratio*100-penalty)),hadExtra:extra>0};
}

function renderHeardColored(diff, heard){
  if(!diff || !Array.isArray(diff.parts)) return "";
  const pieces=[];
  for(const p of diff.parts){
    if(p.type==="ok") pieces.push(`<span class="wd-ok">${esc(p.heard||p.word||"")}</span>`);
    else if(p.type==="extra") pieces.push(`<span class="wd-bad">${esc(p.word||"")}</span>`);
  }
  let html=pieces.join(" ");
  if(!html){
    html=tokenizeEN(heard).map(w=>`<span class="wd-bad">${esc(w)}</span>`).join(" ");
  }
  return `<div class="heard-colored">${html}</div>`;
}

function renderWordDiff(diff){ return renderHeardColored(diff, ""); }

function similarityEN(a,b){return diffEN(a,b).score}

function bestVoiceTranscriptEN(results,target){
  const list=[];
  try{for(let i=0;i<results[0].length;i++)list.push(results[0][i]);}catch{}
  if(!list.length)return{transcript:"",score:0,confidence:0};
  let best={transcript:cleanText(list[0].transcript||""),score:0,confidence:list[0].confidence||0};
  for(const alt of list){
    const transcript=cleanText(alt.transcript||"");
    const score=similarityEN(transcript,target);
    const confidence=alt.confidence||0;
    if(score>best.score || (score===best.score && confidence>best.confidence)) best={transcript,score,confidence};
  }
  return best;
}

function visemeForChar(ch){
  ch=String(ch||"").toLowerCase();
  if("aeâ".includes(ch))return "open";
  if("ou".includes(ch))return "round";
  if("ıiüöy".includes(ch))return "wide";
  if("mbp".includes(ch))return "closed";
  if("fv".includes(ch))return "teeth";
  return "rest";
}

function setMouth(shape){
  if(window.DilAvatar){
    const map={rest:"rest",open:"open",round:"round",wide:"wide",closed:"closed",teeth:"closed"};
    DilAvatar.setMouth(map[shape]||"rest");
    return;
  }
}

function animateWordViseme(pron,durationMs){
  clearVisemeTimers();
  const letters=String(pron||"").replace(/[^a-zçğışöüâ]/gi,"").split("");
  if(!letters.length){setMouth("open");_visemeTimers.push(setTimeout(()=>setMouth("rest"),Math.max(120,durationMs||300)));return;}
  const step=Math.max(70,Math.min(150,Math.round((durationMs||letters.length*120)/letters.length)));
  letters.forEach((ch,i)=>{ _visemeTimers.push(setTimeout(()=>setMouth(visemeForChar(ch)),i*step)); });
  _visemeTimers.push(setTimeout(()=>setMouth("rest"),letters.length*step+60));
}

function setAvatarSpeaking(on){
  const a=document.getElementById("teachAvatar"); if(a)a.classList.toggle("speaking",!!on);
  if(!on){clearVisemeTimers();setMouth("rest");}
}

function clearVisemeTimers(){for(const t of _visemeTimers){clearTimeout(t)}_visemeTimers=[];}

function buildPronMap(s){
  const enWords=String(s&&s.en||"").trim().split(/\s+/).filter(Boolean);
  let pron=String((s&&(s.trPron??s.tr_pron??s.trpron??s.TrPron??s.pronTR))||"").trim();
  if(/^(none|n\/a|na|-|—|yok|null)$/i.test(pron))pron="";
  const prWords=pron?pron.split(/\s+/).filter(Boolean):[];
  if(!enWords.length)return [];
  if(prWords.length===enWords.length)return prWords;
  if(!prWords.length)return enWords.slice();
  return enWords.map((_,i)=>prWords[Math.min(prWords.length-1,Math.round(i*(prWords.length-1)/Math.max(1,enWords.length-1)))]||"");
}

function buildKaraokeTokens(text){
  const tokens=[];const re=/\S+/g;let m;
  while((m=re.exec(String(text||"")))!==null){tokens.push({word:m[0],start:m.index,end:m.index+m[0].length});}
  return tokens;
}

function renderKaraoke(text){
  const box=document.getElementById("karaoke");if(!box)return [];
  const tokens=buildKaraokeTokens(text);
  box.innerHTML=tokens.map((t,i)=>`<span class="kw lookup" data-i="${i}">${esc(t.word)}</span>`).join("");
  box.onclick=(e)=>{
    const sp=e.target.closest(".kw"); if(!sp)return; e.stopPropagation();
    const idx=+sp.dataset.i; const w=(tokens[idx]&&tokens[idx].word)||sp.textContent||"";
    lookupWord(w,sp);
  };
  return tokens;
}

function setKaraokeActive(i){
  const box=document.getElementById("karaoke");if(!box)return;
  const spans=box.querySelectorAll(".kw");
  spans.forEach((sp,idx)=>{ sp.classList.toggle("active",idx===i); sp.classList.toggle("done",idx<i); });
  if(i!==_lastVisemeWord && i>=0 && i<spans.length){
    _lastVisemeWord=i; const pron=(_pronMap&&_pronMap[i])||""; animateWordViseme(pron,_perWordEstimate);
  }
}

function clearKaraokeHighlight(){
  const box=document.getElementById("karaoke");if(!box)return;
  box.querySelectorAll(".kw").forEach(sp=>sp.classList.remove("active","done"));
}

function tokenIndexForChar(tokens,charIndex){
  for(let i=tokens.length-1;i>=0;i--){if(charIndex>=tokens[i].start)return i;}
  return 0;
}

function playTeaching(s){
  const text=s&&s.en?s.en:""; if(!text)return;
  clearTeachTimers();clearVisemeTimers(); _lastVisemeWord=-1; _pronMap=buildPronMap(s);
  const tokens=renderKaraoke(text); clearKaraokeHighlight(); setMouth("rest");
  let boundaryFired=false; try{speechSynthesis.cancel();}catch{}
  let u; try{u=new SpeechSynthesisUtterance(text);}catch{ visualOnlyKaraoke(tokens);return; }
  u.lang="en-US";u.rate=.92;u.pitch=1;u.volume=1;
  const voice=pickVoice("en");if(voice)u.voice=voice;
  u.onstart=()=>{setAvatarSpeaking(true);setTeachBtnPlaying(true);};
  u.onboundary=(ev)=>{
    if(ev.name && ev.name!=="word")return; boundaryFired=true;
    const i=tokenIndexForChar(tokens,ev.charIndex||0); setKaraokeActive(i);
  };
  u.onend=()=>{setAvatarSpeaking(false);setTeachBtnPlaying(false);setKaraokeActive(tokens.length);clearTeachTimers();};
  u.onerror=()=>{setAvatarSpeaking(false);setTeachBtnPlaying(false);clearTeachTimers();};
  _perWordEstimate=Math.max(280,Math.round(360/0.92));
  try{speechSynthesis.speak(u);}catch{visualOnlyKaraoke(tokens);return;}
  const perWord=_perWordEstimate;
  tokens.forEach((t,i)=>{ _teachTimers.push(setTimeout(()=>{ if(!boundaryFired) setKaraokeActive(i); },i*perWord+120)); });
}

function visualOnlyKaraoke(tokens){
  setAvatarSpeaking(true);setTeachBtnPlaying(true); _lastVisemeWord=-1;
  const perWord=420;_perWordEstimate=perWord;
  tokens.forEach((t,i)=>{_teachTimers.push(setTimeout(()=>setKaraokeActive(i),i*perWord));});
  _teachTimers.push(setTimeout(()=>{setAvatarSpeaking(false);setTeachBtnPlaying(false);setKaraokeActive(tokens.length);},tokens.length*perWord+200));
}

function clearTeachTimers(){for(const t of _teachTimers){clearTimeout(t)}_teachTimers=[];}

function setTeachBtnPlaying(on){
  const b=document.getElementById("teachListenBtn"); if(!b)return;
  b.classList.toggle("playing",!!on); b.textContent=on?"⏸ Oynatılıyor…":"🔊 Dinle";
}

function startEnglishCheck(){
  const s=currentSentence(); try{ speechSynthesis.cancel(); }catch{}
  if(!State.listening){try{clearTeachTimers();clearVisemeTimers();setAvatarSpeaking(false);setTeachBtnPlaying(false);}catch{}}
  if(!STT){
    showFeedback("Mikrofon desteklenmiyor",`Tarayıcı ses tanımayı desteklemiyor.`,0,false);
    document.getElementById("fallbackInput").classList.remove("hidden"); return;
  }
  if(State.listening){
    State.manualStop=true; showStatus("Okuma tamamlandı. Değerlendiriliyor…"); scheduleStatusClear(15000);
    const mic=document.getElementById("micBtn"),cap=document.getElementById("micCaption");
    if(mic) mic.textContent="⌛"; if(cap) cap.textContent="Değerlendiriliyor…";
    try{ if(State.voiceRec) State.voiceRec.stop(); }catch{}
    if(State.voiceFinishTimer) clearTimeout(State.voiceFinishTimer);
    State.voiceFinishTimer=setTimeout(()=>{
      if(State.voiceCheckDone) return; State.listening=false; try{ resetMicUI(); }catch{}
      stopOwnVoiceRecording(false).then(()=>finishVoiceCheck(s)).catch(()=>finishVoiceCheck(s));
    }, 2500);
    return;
  }
  State.voiceFinalText=""; State.voiceInterimText=""; State.voiceBest={transcript:"",score:0,confidence:0};
  State.voiceTargetId=s.id; State.manualStop=false; State.voiceCheckDone=false;
  startOwnVoiceRecording().finally(()=>startRecognitionLoop(s));
}

function startRecognitionLoop(s){
  let rec; try{ rec=new STT(); }catch{return}
  State.voiceRec=rec; rec.lang="en-US"; rec.interimResults=true;
  
  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  rec.continuous = !isMobile; 
  rec.maxAlternatives=10;

  const mic=document.getElementById("micBtn"),cap=document.getElementById("micCaption");
  rec.onstart=()=>{
    State.listening=true;
    if(mic){ mic.classList.add("listening"); mic.textContent="■"; }
    if(cap) cap.textContent="Bitirmek için tekrar tıkla";
    showStatus("Seni dinliyorum… Cümle bitince mikrofon düğmesine tekrar tıkla.");
  };

  rec.onresult=e=>{
    let interim="";
    try{
      for(let i=e.resultIndex;i<e.results.length;i++){
        const res=e.results[i]; let bestAlt="", bestScore=-1, bestConf=0;
        for(let j=0;j<res.length;j++){
          const transcript=cleanText(res[j].transcript||"");
          const score=similarityEN(transcript,s.en); const conf=res[j].confidence||0;
          if(score>bestScore || (score===bestScore && conf>bestConf)){ bestAlt=transcript; bestScore=score; bestConf=conf; }
        }
        if(bestAlt){
          if(bestScore>(State.voiceBest?.score||0) || (bestScore===(State.voiceBest?.score||0) && bestConf>(State.voiceBest?.confidence||0))){
            State.voiceBest={transcript:bestAlt,score:bestScore,confidence:bestConf};
          }
          if(res.isFinal){
            if (!State.voiceFinalText.includes(bestAlt.trim())) {
              State.voiceFinalText=(State.voiceFinalText+" "+bestAlt).replace(/\s+/g," ").trim();
            }
          } else {
            interim=(interim+" "+bestAlt).replace(/\s+/g," ").trim();
          }
        }
      }
    }catch{}
    State.voiceInterimText=interim;
    const rawHeard=cleanText((State.voiceFinalText||"")+" "+(State.voiceInterimText||""));
    
    var words = rawHeard.split(/\s+/); var cleanWordsArr = [];
    for (var wIdx = 0; wIdx < words.length; wIdx++) {
      if (wIdx === 0 || words[wIdx].toLowerCase() !== words[wIdx - 1].toLowerCase()) {
        cleanWordsArr.push(words[wIdx]);
      }
    }
    const heard = cleanWordsArr.join(" ");
    if(heard && !State.manualStop){
      showStatus("Dinleniyor… Şu ana kadar: " + heard + "  ·  Bitirmek için mikrofon düğmesine tekrar tıkla.");
    }
  };

  rec.onerror=e=>{
    if(State.manualStop) return; const code=(e&&e.error)||"";
    if(code === "not-allowed" || code === "service-not-allowed"){
      State.listening=false; State.manualStop=true; resetMicUI(); stopOwnVoiceRecording(true);
      showStatus("Mikrofon izni verilmedi."); document.getElementById("fallbackInput")?.classList.remove("hidden"); return;
    }
    if(State.listening && !State.manualStop){ showStatus("Dinleme devam ediyor… Bitirmek için tekrar tıkla."); }
  };

  rec.onend=()=>{
    if(State.manualStop){ State.listening=false; resetMicUI(); stopOwnVoiceRecording(false).then(()=>finishVoiceCheck(s)); return; }
    if(State.listening && currentSentence() && currentSentence().id===State.voiceTargetId){
      setTimeout(()=>{ if(State.listening && !State.manualStop){ try{ rec.start(); }catch{ startRecognitionLoop(s); } } },260); return;
    }
    resetMicUI();
  };
  setTimeout(()=>{ try{ rec.start(); }catch{} },160);
}

function resetMicUI(){
  const mic=document.getElementById("micBtn"),cap=document.getElementById("micCaption");
  if(mic){ mic.classList.remove("listening"); mic.textContent="🎙️"; }
  if(cap) cap.textContent="Tıkla ve İngilizceyi oku";
}

function finishVoiceCheck(s){
  if(State.voiceCheckDone) return; State.voiceCheckDone=true;
  if(State.voiceFinishTimer){ clearTimeout(State.voiceFinishTimer); State.voiceFinishTimer=null; }
  const rawHeard=cleanText((State.voiceFinalText||"")+" "+(State.voiceInterimText||""));
  
  var words = rawHeard.split(/\s+/); var cleanWordsArr = [];
  for (var wIdx = 0; wIdx < words.length; wIdx++) {
    if (wIdx === 0 || words[wIdx].toLowerCase() !== words[wIdx - 1].toLowerCase()) cleanWordsArr.push(words[wIdx]);
  }
  let heard = cleanWordsArr.join(" ");
  
  const best=State.voiceBest||{transcript:"",score:0,confidence:0};
  let finalText=heard; let finalScore=similarityEN(finalText,s.en);
  if(best.transcript && best.score>finalScore){ finalText=best.transcript; finalScore=best.score; }
  if(!finalText){
    showFeedback("Cümle alınamadı","Ses algılanamadı. Mikrofonu açıp cümleyi bitirince düğmeye bas.",0,false);
    document.getElementById("fallbackInput")?.classList.remove("hidden"); return;
  }
  checkEnglish(finalText,"voice",finalScore,best.confidence||0);
}

async function checkEnglish(heard,mode,preScore,confidence){
  const s=currentSentence(); heard=cleanText(heard);
  if(!heard){showFeedback("Cümle alınamadı","Ses veya yazı algılanamadı.",0,false);return}
  const diff=diffEN(heard,s.en); const score=typeof preScore==="number"?preScore:diff.score;
  if(mode==="voice" && score<45 && (confidence||0)<0.70){
    document.getElementById("fallbackInput")?.classList.remove("hidden"); showPronunciationResult(score,diff,heard,false); return;
  }
  let grade="hard"; if(score >= 92 && !diff.hadExtra)grade="easy"; else if(score>=72)grade="good";
  const next=srsGrade(await srsGet(s.id),grade); await srsSet(s.id,next); State.srs[s.id]=next;
  try{ if(window.DHProgress && s.id){ DHProgress.recordResult("sentence:"+s.id, grade!=="hard"); } }catch(e){}
  if (window.LearningErrorDB && grade !== "easy"){ LearningErrorDB.logFromVideo({ sentence:s, heard, grade, score, diff, mode }); }
  try{ window.dhCoachEvaluate && window.dhCoachEvaluate({sentenceId:s.id, en:s.en, answer:heard, ok:(grade!=="hard"), commonMistake:s.commonMistake, layer:mode, score:score}); }catch(e){}
  showPronunciationResult(score,diff,heard,score>=72);
}

function showPronunciationResult(score,diff,heard,ok){
  clearVideoStatus(); const fb=document.getElementById("feedback"); if(!fb)return;
  fb.className="feedback pronunciation-only "+(ok?"ok":"bad");
  const voiceBtn=State.lastVoiceUrl?`<div class="own-voice-row"><button type="button" class="own-voice-btn" id="ownVoiceReplayBtn">▶ Kendi sesimi dinle</button></div>`:"";
  fb.innerHTML=`<div class="fb-score-only">${Math.round(score||0)}%</div>${renderHeardColored(diff,heard)}${voiceBtn}`;
  const b=document.getElementById("ownVoiceReplayBtn"); if(b) b.onclick=playOwnVoice;
  fb.classList.remove("hidden"); requestAnimationFrame(()=>clearVideoStatus()); scheduleFeedbackHide(ok?11000:13000);
}

async function startOwnVoiceRecording(){
  clearLastVoiceRecording(); if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true}); State.mediaStream=stream; State.recordedChunks=[];
    const mimeOptions=["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"];
    let opts={};
    for(const m of mimeOptions){ try{ if(window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)){opts={mimeType:m};break;} }catch{}}
    const rec=new MediaRecorder(stream,opts); State.mediaRecorder=rec;
    rec.ondataavailable=e=>{ if(e.data && e.data.size>0) State.recordedChunks.push(e.data); };
    rec.start(250); return true;
  }catch(e){ console.warn("Ses kaydı başlatılamadı:",e); return false; }
}

function stopOwnVoiceRecording(discard){
  return new Promise(resolve=>{
    const rec=State.mediaRecorder; const stream=State.mediaStream; let done=false;
    const finish=()=>{
      if(done) return; done=true;
      try{ if(stream) stream.getTracks().forEach(t=>t.stop()); }catch{}
      State.mediaStream=null; State.mediaRecorder=null;
      if(!discard && State.recordedChunks && State.recordedChunks.length){
        try{
          const type=(State.recordedChunks[0] && State.recordedChunks[0].type) || "audio/webm";
          const blob=new Blob(State.recordedChunks,{type}); State.lastVoiceBlob=blob; State.lastVoiceUrl=URL.createObjectURL(blob);
        }catch(e){console.warn(e)}
      }
      resolve(State.lastVoiceUrl||"");
    };
    if(!rec){finish();return;} setTimeout(finish, 1500);
    try{ if(rec.state!=="inactive") rec.stop(); else finish(); }catch(e){finish();}
  });
}

function playOwnVoice(){
  if(!State.lastVoiceUrl){ showStatus("Henüz dinlenecek kayıt yok. Önce mikrofonla cümleyi oku."); return; }
  try{
    speechSynthesis.cancel(); const v=document.getElementById("mainVideo"); if(v&&v.src){try{v.pause()}catch{}}
    const a=new Audio(State.lastVoiceUrl); a.play().catch(()=>showStatus("Ses kaydı oynatılamadı."));
  }catch(e){showStatus("Ses kaydı oynatılamadı.")}
}

function clearLastVoiceRecording(){
  try{ if(State.lastVoiceUrl) URL.revokeObjectURL(State.lastVoiceUrl); }catch{}
  State.lastVoiceUrl=""; State.lastVoiceBlob=null; State.recordedChunks=[];
}

/* ---------- SRS (videopractice'ten birebir) ---------- */
function srsDefault(){return{rep:0,ef:2.5,interval:0,due:0,last:0}}

async function srsGet(id){const raw=await kvGet(SRS_PREFIX+id);try{return raw?JSON.parse(raw):null}catch{return null}}

async function srsSet(id,val){await kvSet(SRS_PREFIX+id,JSON.stringify(val))}

async function srsAll(){const out={};try{const db=await openDB();return await new Promise((res,rej)=>{const rq=db.transaction(STORE,"readonly").objectStore(STORE).openCursor();rq.onsuccess=()=>{const c=rq.result;if(c){if(typeof c.key==="string"&&c.key.startsWith(SRS_PREFIX)){try{out[c.key.slice(SRS_PREFIX.length)]=typeof c.value==="string"?JSON.parse(c.value):c.value}catch{}}c.continue()}else res(out)};rq.onerror=()=>rej(rq.error)})}catch{return out}}

function srsGrade(prev,grade){const n=Object.assign(srsDefault(),prev||{});const r=Date.now();if(grade==="hard"){n.rep=0;n.interval=0;n.ef=Math.max(1.3,n.ef-.2)}else{const q=grade==="easy"?5:4;n.ef=Math.max(1.3,n.ef+(0.1-(5-q)*(0.08+(5-q)*0.02)));n.rep++;if(n.rep===1)n.interval=grade==="easy"?3:1;else if(n.rep===2)n.interval=grade==="easy"?7:4;else n.interval=Math.round(n.interval*n.ef*(grade==="easy"?1.3:1))}n.last=r;n.due=r+n.interval*DAY;return n}

/* ---------- SÖZLÜK KÖPRÜSÜ ----------
   index-app'te sözlük zaten var (word-popup.js). Karaoke kelimesine tıklanınca
   onu çağırırız; yoksa sessizce hiçbir şey yapmaz (hata vermez). */
function lookupWord(w, el){
  try{
    if(window.DHWordPopup && DHWordPopup.show) return DHWordPopup.show(w, el);
    if(window.dhShowWord) return window.dhShowWord(w, el);
    if(window.showWordPopup) return window.showWordPopup(w, el);
  }catch(e){}
}


/* ---------- MEDYA: imgQuery ile ara (cümlenin tamamıyla DEĞİL) ---------- */
var _imgMap=null;
async function loadImgMap(){
  if(_imgMap) return _imgMap;
  var paths=["./data/sentences.json","data/sentences.json"];
  for(var i=0;i<paths.length;i++){
    try{ var r=await fetch(paths[i]); if(!r.ok) continue;
      var arr=await r.json(), m={};
      for(var k=0;k<arr.length;k++){ var s=arr[k];
        if(s&&s.en&&s.imgQuery) m[normKey(s.en)]=s.imgQuery; }
      _imgMap=m; return m;
    }catch(e){}
  }
  _imgMap={}; return _imgMap;
}
function normKey(s){ return String(s||"").toLowerCase().replace(/\s+/g," ").replace(/[^a-z0-9' ]/g,"").trim(); }

/* ESKİ HATA: buildQuery cümlenin TAMAMINI Pexels'e yolluyordu
   ("speaking video : I am a teacher") — böyle stok video yok, alakasız sonuç geliyordu.
   DOĞRUSU: sentences.json'daki elle yazılmış imgQuery ("woman at blackboard"). */
async function buildQuery(en){
  var m=await loadImgMap();
  return m[normKey(en)] || cleanText(en);
}
function videoKey(en){ return "vid:"+hash(en||""); }

async function loadVideo(en){
  var v=$("vaVideo"); if(!v) return;
  var saved=await kvGet(videoKey(en));
  if(saved){ try{ var p=JSON.parse(saved); if(p&&p.videoUrl){ applyVideo(p); return; } }catch(e){} }
  var key=await kvGet(API_KEY);
  if(!key){ showStatus("Video için Pexels anahtarı gerekli (🔑)."); return; }
  var q=await buildQuery(en);
  setLoading(true,"Video aranıyor…");
  showStatus("Aranıyor: "+q);
  try{
    var url=new URL("https://api.pexels.com/videos/search");
    url.searchParams.set("query",q);
    url.searchParams.set("per_page","8");
    url.searchParams.set("orientation","landscape");
    var res=await fetch(url.toString(),{headers:{Authorization:key}});
    if(!res.ok) throw new Error(res.status===401?"API anahtarı hatalı":"Pexels hatası "+res.status);
    var data=await res.json(), vids=data.videos||[];
    setLoading(false);
    if(!vids.length){ showStatus("Video bulunamadı: "+q); return; }
    var files=(vids[0].video_files||[]).filter(function(f){ return f.file_type==="video/mp4"&&f.link; })
      .sort(function(a,b){ return Math.abs(1280-(a.width||0))-Math.abs(1280-(b.width||0)); });
    if(!files[0]){ showStatus("MP4 bulunamadı."); return; }
    var payload={videoUrl:files[0].link, posterUrl:vids[0].image||"", query:q};
    await kvSet(videoKey(en), JSON.stringify(payload));
    applyVideo(payload);
  }catch(e){ setLoading(false); showStatus("Video hatası: "+e.message); }
}
function applyVideo(p){
  var v=$("vaVideo"); if(!v) return;
  v.src=p.videoUrl; if(p.posterUrl) v.poster=p.posterUrl;
  v.muted=true; v.loop=true; v.playsInline=true;
  v.load(); v.play().catch(function(){});
  $("vaMedia").classList.add("has-video");
  setLoading(false); showStatus("");
}

function openApiSheet(){
  var k=prompt("Pexels API anahtarını yapıştır (video için gerekli):");
  if(k&&k.trim()){ kvSet(API_KEY,k.trim()).then(function(){
    showStatus("Anahtar kaydedildi."); if(State.en) loadVideo(State.en); }); }
}

/* ---------- PANELİ KARTA BAS ---------- */
function panelHTML(){
  return ''
  + '<div class="va-media" id="vaMedia">'
  +   '<video id="vaVideo" muted playsinline loop></video>'
  +   '<div class="va-loading" id="vaLoading"><span>Yükleniyor…</span></div>'
  + '</div>'
  + '<div class="va-row">'
  +   '<button class="va-btn" id="vaVideoBtn">🎬 Video getir</button>'
  +   '<button class="va-btn" id="vaKeyBtn">🔑</button>'
  +   '<span class="va-status" id="vaStatus"></span>'
  + '</div>'
  + '<div class="teach-overlay" id="vaTeach">'
  +   '<div class="teach-head">🎧 Cümleyi Dinle &amp; Öğren</div>'
  +   '<div class="avatar" id="teachAvatar"></div>'
  +   '<div id="karaokeLine" class="kara-line"></div>'
  +   '<div class="teach-tr" id="teachTr"></div>'
  +   '<button class="teach-listen" id="teachListenBtn">🔊 Dinle</button>'
  + '</div>'
  + '<div class="va-mic-wrap">'
  +   '<button class="mic-btn" id="micBtn">🎙️</button>'
  +   '<div class="mic-caption" id="micCaption">Tıkla ve İngilizceyi oku</div>'
  +   '<button class="va-btn" id="ownVoiceBtn">▶ Kendi sesimi dinle</button>'
  + '</div>'
  + '<div class="va-feedback hidden" id="vaFeedback"></div>';
}

function mountPanel(card){
  /* Panel KARTIN İÇİNDE olmalı. Sayfada başka bir yerde kalmış kopya varsa
     (layout.js kartı yeniden düzenlerken dışarıda bırakabiliyor) onu temizle. */
  document.querySelectorAll("#vaPanel").forEach(function(old){
    if(!card.contains(old)) old.remove();
  });
  var ex=card.querySelector("#vaPanel");
  if(ex) return ex;

  var p=document.createElement("div");
  p.id="vaPanel"; p.className="va-panel";
  p.innerHTML=panelHTML();

  /* Yerleşim önceliği: Türkçe cümleden sonra -> yoksa İngilizceden sonra
     -> yoksa düğmelerden önce -> son çare kartın sonu. */
  var tr=card.querySelector(".card-tr");
  var en=card.querySelector(".card-en");
  var acts=card.querySelector(".card-actions");
  if(tr && tr.parentNode) tr.insertAdjacentElement("afterend", p);
  else if(en && en.parentNode) en.insertAdjacentElement("afterend", p);
  else if(acts && acts.parentNode) acts.insertAdjacentElement("beforebegin", p);
  else card.appendChild(p);
  return p;
}

function bindPanel(){
  var vb=$("vaVideoBtn"); if(vb) vb.onclick=function(){ loadVideo(State.en); };
  var kb=$("vaKeyBtn");   if(kb) kb.onclick=openApiSheet;
  var tb=$("teachListenBtn"); if(tb) tb.onclick=function(){ playTeaching(currentSentence()); };
  var mb=$("micBtn");     if(mb) mb.onclick=function(){ startEnglishCheck(); };
  var ov=$("ownVoiceBtn");if(ov) ov.onclick=function(){ playOwnVoice(); };
  try{ if(window.DilAvatar&&DilAvatar.mount) DilAvatar.mount("teachAvatar"); }catch(e){}
}

/* ---------- KARTI İZLE (image-addon.js ile aynı desen) ---------- */
var _lastEn="";
function scan(){
  var card=document.querySelector(".card");
  if(!card) return;
  if(!card.querySelector(".card-en")) return;
  var enEl=card.querySelector(".card-en"), trEl=card.querySelector(".card-tr");
  if(!enEl) return;
  var en=(enEl.textContent||"").trim();
  if(!en) return;

  mountPanel(card);
  if(en===_lastEn) return;      // aynı cümle: yeniden kurma
  _lastEn=en;

  State.en=en;
  State.tr=trEl?(trEl.textContent||"").trim():"";
  State.sentence={en:State.en, tr:State.tr};

  try{ clearTeachTimers(); clearVisemeTimers(); }catch(e){}
  hideFeedback(); showStatus("");
  var v=$("vaVideo"); if(v){ v.removeAttribute("src"); v.load(); }
  var mm=$("vaMedia"); if(mm) mm.classList.remove("has-video");
  var tt=$("teachTr"); if(tt){ try{ tt.textContent=teachPron(State.sentence); }catch(e){ tt.textContent=""; } }
  try{ renderKaraoke(State.en); }catch(e){}
  bindPanel();
}

function start(){
  /* GÜVENLİK AĞI: bu eklenti ne olursa olsun sayfayı BOZMAMALI.
     Bir hata fırlarsa React zaten çalışmaya devam eder; eklenti sessizce devre dışı kalır. */
  try{
    var st=document.createElement("style");
    st.textContent=VA_CSS;
    document.head.appendChild(st);
  }catch(e){ console.warn("[video-avatar] stil eklenemedi",e); }
  try{
    new MutationObserver(function(){ try{ scan(); }catch(e){} })
      .observe(document.body,{childList:true,subtree:true});
    scan();
  }catch(e){ console.warn("[video-avatar] devre dışı",e); }
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start);
else start();

})();