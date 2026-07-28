/* tts-avatar-long-sync-fix.js  (v3 - polling tabanlı, sağlam motor)
   Uzun/karışık (TR+EN) metinleri baştan sona kesintisiz seslendirir,
   avatar ağzını senkron tutar ve ekranda görünen metni birebir okur.

   Tasarım notu: Chrome'un iki bilinen hatası bu iş için ölümcül:
   1) Toplam kesintisiz konuşma ~15 sn'yi geçince ses sessizce durur.
   2) onend/onerror bazen HİÇ tetiklenmez (cümle bitse de sıradaki gelmez).
   Bu yüzden akış onend olayına GÜVENMEZ. Her 250 ms çalışan tek bir
   "watchdog" motorun gerçek durumuna (speaking/pending/paused) bakarak
   sıradaki cümleye geçer ve periyodik pause()+resume() ile 15 sn hatasını
   önler. Böylece kuyruk her koşulda ilerler.
*/
(function(){
"use strict";
if(window.__LongTTSAvatarSyncFixV3) return;
window.__LongTTSAvatarSyncFixV3 = true;

const AVATAR_SELECTORS = [
  "#avatarImg","#avatarImage","#teacherAvatarImg","#teacherAvatar","#mainAvatarImg",
  ".avatar-img",".avatar-image",".teacher-avatar img",".avatar img",
  "img[src*='avatars']","img[src*='avatar']","img[src*='idle.webp']","img[src*='mouth-']"
];

// ÇOK ÖNEMLİ: Bu sayfada BAŞKA bir script daha (ai-teacher-prompt-tts.js)
// speechSynthesis.speak'i sarmalıyor. Native'i instance'tan (speechSynthesis.speak)
// yakalarsak, onun sarmalayıcısını yakalarız; iç çağrılarımız tekrar ona
// girer, o da speakChunkList'i yeniden çağırıp başında cancel() tetikler ve
// ses birkaç cümlede durur (iki script birbirini iptal eder).
// Bu yüzden GERÇEK native metotları PROTOTİPTEN alıyoruz — hiçbir instance
// yaması araya giremez, döngü kırılır.
let nativeSpeak = null, nativeCancel = null;
(function captureNatives(){
  try{
    var P = (typeof SpeechSynthesis!=="undefined" && SpeechSynthesis.prototype) ? SpeechSynthesis.prototype : null;
    if(P && typeof P.speak==="function"){
      nativeSpeak  = P.speak.bind(speechSynthesis);
      nativeCancel = P.cancel.bind(speechSynthesis);
      return;
    }
  }catch(e){}
  try{ nativeSpeak = speechSynthesis.speak.bind(speechSynthesis); }catch(e){}
  try{ nativeCancel = speechSynthesis.cancel.bind(speechSynthesis); }catch(e){}
})();

let active = false;
let activeTimer = null;
let mouthTimer = null;
let savedSrc = new WeakMap();

/* ---------------- Ses / hız / ton ayarları ---------------- */
var DH_TTS_DEFAULTS={ trRate:0.96, trPitch:1.0, enRate:0.90, enPitch:1.0 };
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

function dhAllVoices(){ try{ return speechSynthesis.getVoices()||[]; }catch(e){ return []; } }

function dhPickVoice(lang){
  var voices=dhAllVoices();
  if(!voices.length) return null;
  var tr=/^tr/i.test(lang);
  // TEK DOĞRU KAYNAK: ses ayar sayfası (ses-secim.html).
  // İngilizce sesler için önce karakter-özel, sonra global ayarı oku.
  if(!tr){
    try{
      // chat-core ile AYNI anahtarı üret: mümkünse onun fonksiyonunu kullan.
      var perCharKey = (typeof window.avatarVoiceKey==="function")
        ? window.avatarVoiceKey()
        : "dh-voice:" + String((window.Scenario&&Scenario.avatarDir)||(window.CHAT_SCENARIO&&CHAT_SCENARIO.avatarDir)||"default").replace(/[^a-z0-9]+/gi,"-");
      var perChar=JSON.parse(localStorage.getItem(perCharKey)||"null");
      if(perChar&&perChar.name){ var pc=voices.filter(function(v){return v.name===perChar.name;})[0]; if(pc) return pc; }
      var glob=JSON.parse(localStorage.getItem("dh-voice:__global__")||"null");
      if(glob&&glob.name){ var gm=voices.filter(function(v){return v.name===glob.name;})[0]; if(gm) return gm; }
    }catch(e){}
  }
  // Ayar yoksa: eski dh-tts-voice-v1 tercihine, sonra dil filtresine düş
  var c=dhTtsCfg();
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
  if(!v){
    // İstenen dilde ses yoksa desteklenmeyen bir lang'da bırakmak sesi
    // tamamen susturur (onerror -> cümle atlanır). Mevcut herhangi bir sese
    // düşüp en azından okunmasını sağlıyoruz.
    var all=dhAllVoices();
    v = all.filter(function(x){ return /^tr/i.test(x.lang||""); })[0]
        || all.filter(function(x){ return /^en/i.test(x.lang||""); })[0]
        || all[0] || null;
  }
  if(v){ u.voice=v; u.lang=v.lang; }
  else { try{ u.lang = lang || ""; }catch(e){} }
}

/* ---------------- Metin temizleme ---------------- */
function dhSpeakClean(s){
  var orig=String(s||"");
  var r=orig;
  r=r.replace(/```[\s\S]*?```/g," ").replace(/`+/g," ");
  r=r.replace(/[*_~#>^=|]+/g," ");
  r=r.replace(/["“”„«»]+/g," ");
  r=r.replace(/[•·▪●■▶→←✓✔✗★☆]/g," ");
  r=r.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/gu," ");
  r=r.replace(/[‒-―−]/g," ");
  r=r.replace(/(^|\s)-+(?=\s)/g," ");
  r=r.replace(/(\s)-+/g,"$1").replace(/-+(\s)/g,"$1");
  r=r.replace(/\b([A-Za-zÇĞİÖŞÜçğıöşü])\.(?=[A-Za-zÇĞİÖŞÜçğıöşü]\b)/g,"$1 ");
  r=r.replace(/\s{2,}/g," ").trim();
  r=r.replace(/\s*\.(?:\s*\.)+/g,".");
  r=r.replace(/([!?])\1+/g,"$1");
  r=r.replace(/\.{2,}/g,".");
  r=r.replace(/\s+([.,;:!?])/g,"$1");
  r=r.replace(/\s{2,}/g," ").trim();
  return r.length ? r : orig.replace(/\s+/g," ").trim();
}
function clean(s){ return dhSpeakClean(s); }

// Gelen metni EKRANDA GÖRÜNEN düz metne çevirir (etiket temizler,
// &amp; &nbsp; gibi entity'leri gerçek karaktere döndürür).
function htmlToVisibleText(input){
  var s = String(input||"");
  try{
    var hasTags = /<[^>]+>/.test(s);
    var tmp = document.createElement("div");
    if(hasTags){
      s = s.replace(/<\s*br\s*\/?>/gi, "\n")
           .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr|section|article)\s*>/gi, "\n");
      tmp.innerHTML = s;
      try{ tmp.querySelectorAll("script,style,noscript").forEach(function(n){ n.remove(); }); }catch(e){}
    } else {
      tmp.innerHTML = s; // etiket yok ama entity olabilir
    }
    var out = (tmp.textContent || "").replace(/ /g, " ");
    if(out && out.trim()) return out;
  }catch(e){}
  return s.replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g," ");
}

window.DH_TTS={
  get:dhTtsCfg,
  set:function(patch){ var n=Object.assign(dhTtsCfg(),patch||{}); try{ localStorage.setItem("dh-tts-voice-v1",JSON.stringify(n)); }catch(e){} return n; },
  reset:function(){ try{ localStorage.removeItem("dh-tts-voice-v1"); }catch(e){} return dhTtsCfg(); },
  apply:dhApplyVoice, clean:dhSpeakClean, defaults:DH_TTS_DEFAULTS, pickVoice:dhPickVoice,
  voices:function(lang){
    var v=dhAllVoices();
    if(!lang) return v.slice();
    var re=/^tr/i.test(lang)?/^tr/i:/^en/i;
    return v.filter(function(x){ return re.test(x.lang||""); });
  }
};

/* ---------------- Dil tespiti + cümle bölme ---------------- */
function isTurkish(text){
  const s=String(text||"");
  if(/[ğüşöçıİĞÜŞÖÇ]/.test(s)) return true;
  if(/^\s*(TÜRKÇE|AÇIKLAMA|ÖZET|NOT|KURAL|YANLIŞ|DOĞRU)\b/i.test(s)) return true;
  if(/\b(konu|cümle|örnek|anlam|yapı|kural|kullanıcı|cevap|doğru|yanlış|şöyle|çünkü|fiil|özne|yüklem|Türkçe|anlat|açıkla|demek|kullanılır)\b/i.test(s)) return true;
  return false;
}

/* DİL KARARI.
   Eskiden tek kural vardı: isTurkish() değilse "en-US". Türkçe cümlelerin çoğunda
   ğüşöçı bulunur ama "Bu bir kalem.", "Hadi tekrar edelim." gibi cümlelerde yoktur;
   bunlar İngilizce sayılıp hem İngilizce sesle okunuyor hem de ağız için İngilizce
   tablo (t/d/s/z -> mouth-th) kullanılıyordu. Artık İngilizce için de KANIT aranır;
   iki taraf da kanıtsızsa sayfanın varsayılan dili (window.DH_DEFAULT_LANG) seçilir. */
var EN_WORDS=/\b(the|a|an|is|are|was|were|am|be|been|and|or|but|to|of|in|on|at|it|its|he|she|they|you|we|i|my|your|his|her|this|that|these|those|with|for|from|have|has|had|do|does|did|not|don't|can|could|will|would|should|there|what|when|where|which|who|how|because|about|very|more|than|then|so|if|as|by|up|out|no|yes|please|thank|thanks)\b/i;
function looksEnglish(text){
  var s=String(text||"");
  if(/[ğüşöçıİĞÜŞÖÇ]/.test(s)) return false;
  var hits=(s.match(new RegExp(EN_WORDS.source,"gi"))||[]).length;
  return hits >= 2 || (hits === 1 && s.trim().split(/\s+/).length <= 4);
}
function detectLang(text){
  if(isTurkish(text)) return "tr-TR";
  if(looksEnglish(text)) return "en-US";
  try{ if(window.DH_DEFAULT_LANG) return window.DH_DEFAULT_LANG; }catch(e){}
  return "en-US";
}

function splitLongLine(line, maxLen){
  maxLen = maxLen || 90;
  line=clean(line);
  if(line.length<=maxLen) return [line];
  const parts=[];
  let rest=line;
  while(rest.length>maxLen){
    let cut=Math.max(rest.lastIndexOf(". ",maxLen), rest.lastIndexOf(", ",maxLen), rest.lastIndexOf("; ",maxLen), rest.lastIndexOf(" ",maxLen));
    if(cut<25) cut=maxLen;
    parts.push(clean(rest.slice(0,cut+1)));
    rest=clean(rest.slice(cut+1));
  }
  if(rest) parts.push(rest);
  return parts;
}

function splitForSpeech(text){
  const raw=htmlToVisibleText(text).replace(/\*\*/g," ");
  const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const chunks=[];

  function segmentsByBrackets(line){
    const segs=[];
    const re=/\[\[([\s\S]*?)\]\]|"([^"]*?)"|“([^”]*?)”/g;
    let last=0, m;
    while((m=re.exec(line))!==null){
      if(m.index > last){
        const before=line.slice(last, m.index).trim();
        if(before) segs.push({text:before, lang: detectLang(before)});
      }
      const inner=((m[1]!=null?m[1]:(m[2]!=null?m[2]:m[3]))||"").trim();
      if(inner) segs.push({text:inner, lang:"en-US"});
      last=re.lastIndex;
    }
    if(last < line.length){
      const after=line.slice(last).trim();
      if(after) segs.push({text:after, lang: detectLang(after)});
    }
    if(!segs.length){
      const t=line.trim();
      if(t) segs.push({text:t, lang: detectLang(t)});
    }
    return segs;
  }

  lines.forEach(line=>{
    segmentsByBrackets(line).forEach(seg=>{
      const pieceClean = clean(seg.text);
      if(!pieceClean) return;
      const pieces = pieceClean.split(/([.!?]+(?:\s+|$))/).filter(Boolean);
      let currentBuf = "";
      for(let i=0; i<pieces.length; i++){
        currentBuf += pieces[i];
        if(i % 2 === 1 || i === pieces.length - 1){
          const finalStr = clean(currentBuf);
          if(finalStr){
            splitLongLine(finalStr, seg.lang==="tr-TR"?90:75).forEach(piece=>{
              if(piece && piece.length > 1) chunks.push({text:piece, lang:seg.lang});
            });
          }
          currentBuf = "";
        }
      }
    });
  });
  return chunks.length ? chunks : [{text:clean(raw.replace(/\[\[|\]\]/g," ")), lang: detectLang(raw)}];
}

/* ---------------- Avatar ağız animasyonu ---------------- */
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
function idleSrc(src){
  if(!src) return src;
  return src.replace(/\/(mouth-[^\/]+|talk|speaking|mouth-open|blink)\.(webp|png|jpg|jpeg)(\?.*)?$/i, "/idle.$2$3");
}
// --- Dil-farkında ağız şekli (viseme) tabloları ---
// Türkçe fonetiktir: harf ~ ses. Doğrudan eşleme yeterli.
var DH_VISEME_TR = {
  "a":"mouth-a","â":"mouth-a","e":"mouth-e",
  "ı":"mouth-i","i":"mouth-i","y":"mouth-i",
  "o":"mouth-o","u":"mouth-o","ö":"mouth-o","ü":"mouth-o",
  "m":"mouth-mbp","b":"mouth-mbp","p":"mouth-mbp",
  "f":"mouth-fv","v":"mouth-fv","l":"mouth-l",
  /* TÜRKÇEDE "th" KARESİ KULLANILMAZ: o kare dilin dişler arasına çıktığı
     İngilizce th sesi içindir, Türkçede böyle bir ses yok. En yakın kareler:
     t d s z ş ç c j -> hepsi küçük açıklık (mouth-i). Kullanıcı kararı. */
  "t":"mouth-i","d":"mouth-i","s":"mouth-i","z":"mouth-i","ş":"mouth-i","c":"mouth-i","ç":"mouth-i","j":"mouth-i",
  "g":"mouth-e","ğ":"mouth-e","k":"mouth-e","h":"mouth-e","n":"mouth-e","r":"mouth-e"
};
// İngilizce'de yazım != telaffuz. Yaygın çift-harfleri (digraph) önce yakala.
var DH_VISEME_EN_DIGRAPH = {
  "th":"mouth-th","sh":"mouth-th","ch":"mouth-th","ph":"mouth-fv","gh":"mouth-fv",
  "wh":"mouth-o","qu":"mouth-o","oo":"mouth-o","ou":"mouth-o","ow":"mouth-o","oa":"mouth-o",
  "ee":"mouth-i","ea":"mouth-i","ie":"mouth-i","ey":"mouth-i",
  "ai":"mouth-e","ay":"mouth-e","ng":"mouth-e","ck":"mouth-th"
};
var DH_VISEME_EN = {
  "a":"mouth-a","e":"mouth-e","i":"mouth-i","o":"mouth-o","u":"mouth-o","y":"mouth-i",
  "m":"mouth-mbp","b":"mouth-mbp","p":"mouth-mbp",
  "f":"mouth-fv","v":"mouth-fv","w":"mouth-o","r":"mouth-e","l":"mouth-l",
  "t":"mouth-th","d":"mouth-th","s":"mouth-th","z":"mouth-th","c":"mouth-th","g":"mouth-th","j":"mouth-th","k":"mouth-th","x":"mouth-th",
  "n":"mouth-e","h":"mouth-e","q":"mouth-o"
};

/* KULLANICI EŞLEMESİ (ses-esleme.html → "dh-viseme-tr-v1").
   Sayfada seçilen harf→dosya eşlemesi Türkçe tarafında tabloyu ezer.
   visemeAt her karakterde çağrıldığı için sonuç önbelleklenir; sayfa
   değişiklik yayınladığında (veya başka sekmede kaydedildiğinde) tazelenir. */
var _trUserMap=null;
function trUserMap(){
  if(_trUserMap) return _trUserMap;
  try{ _trUserMap = JSON.parse(localStorage.getItem("dh-viseme-tr-v1")||"null") || {}; }
  catch(e){ _trUserMap = {}; }
  return _trUserMap;
}
try{
  window.addEventListener("dh-viseme-tr-changed", function(){ _trUserMap=null; });
  window.addEventListener("storage", function(e){ if(!e || e.key==="dh-viseme-tr-v1") _trUserMap=null; });
}catch(e){}

// Verilen konumdaki ağız şeklini ve kaç karakter ilerleyeceğini döndürür.
function visemeAt(text, pos, lang){
  var s = String(text||"");
  if(pos<0 || pos>=s.length) return {file:null, advance:1};
  var isTr = (lang==="tr-TR");
  var ch = s.charAt(pos).toLocaleLowerCase(isTr?"tr-TR":"en-US");
  if(!isTr){
    var two = s.substr(pos,2).toLowerCase();
    if(DH_VISEME_EN_DIGRAPH[two]) return {file:DH_VISEME_EN_DIGRAPH[two], advance:2};
    if(DH_VISEME_EN[ch]) return {file:DH_VISEME_EN[ch], advance:1};
    return {file:null, advance:1}; // boşluk/noktalama -> idle (kapalı ağız)
  }
  var um=trUserMap();
  if(um[ch]) return {file:um[ch], advance:1};
  if(DH_VISEME_TR[ch]) return {file:DH_VISEME_TR[ch], advance:1};
  return {file:null, advance:1};
}

function frameForFile(baseSrc, file){
  if(!baseSrc) return null;
  var q = baseSrc.includes("?") ? baseSrc.slice(baseSrc.indexOf("?")) : "";
  var base = baseSrc.replace(/\?.*$/,"");
  var dir = base.replace(/\/[^\/]*$/,"/");
  var ext = (base.match(/\.(webp|png|jpg|jpeg)$/i)||[".webp","webp"])[1];
  return dir+(file||"idle")+"."+ext+q;
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
  } else {
    clearInterval(activeTimer); activeTimer=null;
    stopMouthLoop();
  }
}

let currentText="";
let currentLang="tr-TR";
let mouthPos=0;
let perCharMs=75;

function applyVisemeToAvatars(file){
  avatarImgs().forEach(img=>{
    const current=srcOf(img);
    if(!savedSrc.has(img)) savedSrc.set(img, idleSrc(current));
    if(img.dataset.avatarBlinking==="1") return;
    const base=savedSrc.get(img) || idleSrc(current) || current;
    const next=frameForFile(base, file);
    if(next){ try{ img.src=next; }catch(e){} }
  });
}
// Geriye dönük uyumluluk: tek karakterle çağrılırsa aktif dile göre eşle.
function applyCharToAvatars(ch){
  applyVisemeToAvatars(visemeAt(String(ch||""), 0, currentLang).file);
}

function startMouthForText(text, lang){
  currentText = String(text||"");
  currentLang = (lang==="tr-TR") ? "tr-TR" : "en-US";
  mouthPos = 0;
  let basePer = (currentLang==="tr-TR") ? 70 : 80;
  let mult = 1.0;
  try{
    const saved = parseFloat(localStorage.getItem("dh_mouthSpeed"));
    if(isFinite(saved) && saved>=0.5 && saved<=2.0) mult = saved;
  }catch(e){}
  perCharMs = Math.round(basePer * mult);
  clearInterval(mouthTimer);
  if(!currentText){ return; }
  mouthTimer=setInterval(()=>{
    if(!active || !currentText){ return; }
    if(mouthPos >= currentText.length){ applyVisemeToAvatars(null); return; }
    // Aktif dile göre ağız şekli (TR: fonetik, EN: digraph-farkında).
    const v = visemeAt(currentText, mouthPos, currentLang);
    applyVisemeToAvatars(v.file);
    mouthPos += (v.advance>0 ? v.advance : 1);
  }, perCharMs);
}
function alignMouthTo(charIndex){
  if(typeof charIndex==="number" && charIndex>=0 && charIndex<=currentText.length){ mouthPos = charIndex; }
}
function stopMouthLoop(){
  clearInterval(mouthTimer); mouthTimer=null;
  currentText=""; mouthPos=0;
  avatarImgs().forEach(img=>{
    const old=savedSrc.get(img);
    if(old){ try{ img.src=old; }catch(e){} }
  });
}

/* ================= SAĞLAM SESLENDİRME MOTORU (v3) ================= */
let currentQueueSession = 0;
let dhWaitedForVoices = false;
// GC koruması: Chrome, JS referansı kalmayan utterance'ı konuşma bitmeden
// çöp toplayıp sesi kesebiliyor. Son birkaç nesneyi elde tutuyoruz.
let __keepAliveRefs = [];

function speakChunkList(chunks){
  if(!nativeSpeak) return false;
  dhWaitedForVoices = false;   // yeni konuşma: sesler yüklenmediyse yeniden bekle
  chunks=(chunks||[]).filter(c=>c&&clean(c.text)&&clean(c.text).length>1)
                     .map(c=>({text:clean(c.text), lang:c.lang, el:c.el||null}));
  if(!chunks.length) return false;

  try{ if(nativeCancel) nativeCancel(); else speechSynthesis.cancel(); }catch(e){}
  currentQueueSession++;
  const session = currentQueueSession;
  setSpeakingState(true);

  let idx = 0;
  let curStarted = false;   // aktif cümlede onstart geldi mi
  let curDone = false;      // aktif cümle tamamlandı/atlandı mı
  let curCallTime = 0;      // speak() çağrı zamanı
  let curStartAt = 0;       // onstart zamanı
  let curMaxMs = 0;         // bu cümle için makul üst süre sınırı
  let watchdog = null;

  function stopWatchdog(){ if(watchdog){ clearInterval(watchdog); watchdog=null; } }

  function finishAll(){
    stopWatchdog();
    setTimeout(()=>{ if(session===currentQueueSession) setSpeakingState(false); }, 150);
    try{ if(window.__dhHighlight) window.__dhHighlight(null); }catch(e){}
  }

  function advance(){
    if(curDone) return;
    curDone = true;
    clearInterval(mouthTimer); mouthTimer=null;
    idx++;
    setTimeout(()=>{ if(session===currentQueueSession) speakCurrent(); }, 20);
  }

  function speakCurrent(){
    if(session !== currentQueueSession){ stopWatchdog(); return; }
    if(idx >= chunks.length){ finishAll(); return; }

    // MOBİL: sesler henüz yüklenmediyse (getVoices boş), kayıtlı ses bulunamayıp
    // varsayılana düşer. Sesleri tazele; hâlâ boşsa kısa bekleyip tekrar dene.
    if(!dhAllVoices().length && !dhWaitedForVoices){
      dhWaitedForVoices = true;
      try{ speechSynthesis.getVoices(); }catch(e){}
      var _retry=0;
      var _iv=setInterval(function(){
        _retry++;
        if(dhAllVoices().length || _retry>=8){   // ~1.6sn'ye kadar bekle
          clearInterval(_iv);
          if(session===currentQueueSession) speakCurrent();
        }
      }, 200);
      return;
    }

    const item = chunks[idx];
    const u = new SpeechSynthesisUtterance(item.text);
    dhApplyVoice(u, item.lang);
    u.__longTTSAvatarSync = true;

    curStarted = false;
    curDone = false;
    curCallTime = Date.now();
    curStartAt = 0;
    // Bu cümle için beklenen konuşma süresi (rate'e göre) + 6 sn pay.
    // Motor bundan uzun süre "konuşuyor" görünüp ilerlemezse kilitlenmiş
    // sayıp kurtarıyoruz.
    var _mp = item.lang==="tr-TR" ? 105 : 115;
    var _rate = Math.max(u.rate||1, 0.4);
    curMaxMs = Math.round(item.text.length * _mp / _rate) + 6000;

    __keepAliveRefs.push(u);
    if(__keepAliveRefs.length>8) __keepAliveRefs.splice(0, __keepAliveRefs.length-8);

    u.onstart = function(){
      if(session!==currentQueueSession) return;
      curStarted = true;
      curStartAt = Date.now();
      setSpeakingState(true);
      startMouthForText(item.text, item.lang);
      try{ if(window.__dhHighlight) window.__dhHighlight(item.el||null); }catch(e){}
    };
    u.onboundary = function(ev){
      if(session!==currentQueueSession) return;
      if(ev && (ev.name==="word"||ev.name===undefined)) alignMouthTo(ev.charIndex);
    };
    u.onend = function(){ advance(); };
    u.onerror = function(){ advance(); };

    try{ nativeSpeak(u); }catch(e){ advance(); }
  }

  // Tek watchdog: onend'e HİÇ güvenmez. Motorun gerçek durumuna bakarak
  // ilerler ve motor kilitlenirse (Chrome ~15 sn sessizleşme hatası)
  // yerel cancel + sıradaki cümle ile kurtarır. Böylece kalıcı durma olmaz.
  watchdog = setInterval(function(){
    if(session !== currentQueueSession){ stopWatchdog(); return; }

    // Kullanıcı elle duraklattıysa hiçbir şey yapma.
    if(window.__dhUserPaused){ return; }

    var speaking=false, pending=false, paused=false;
    try{ speaking=speechSynthesis.speaking; pending=speechSynthesis.pending; paused=speechSynthesis.paused; }catch(e){}

    // İstemeden takılı kalmış duraklamayı kurtar.
    if(paused){ try{ speechSynthesis.resume(); }catch(e){} return; }

    if(curDone) return;

    // 1) Cümle başladı, motor artık konuşmuyor -> bitti (onend düşmüş olabilir).
    if(curStarted && !speaking && !pending){ advance(); return; }

    // 2) Hiç başlamadı, makul süre geçti -> ses düşürüldü, atla ki durmasın.
    if(!curStarted && !speaking && !pending && (Date.now()-curCallTime) > 3500){ advance(); return; }

    // 3) "Konuşuyor" görünüp beklenenden çok uzun sürdü -> motor kilitlendi.
    //    Yerel cancel ile temizle ve sıradaki cümleye geç (temiz başlangıç
    //    Chrome'un 15 sn sayacını da sıfırlar).
    if(curStarted && curStartAt && (Date.now()-curStartAt) > curMaxMs){
      try{ (nativeCancel || speechSynthesis.cancel)(); }catch(e){}
      advance(); return;
    }
  }, 250);

  speakCurrent();
  return true;
}

function speakChunks(text){
  if(!nativeSpeak) return false;
  return speakChunkList(splitForSpeech(text));
}
function speakSegments(segments){
  if(!nativeSpeak || !Array.isArray(segments)) return false;
  const out=[];
  segments.forEach(function(seg){
    if(!seg) return;
    var lang = seg.lang ? seg.lang : detectLang(seg.text);
    var text = clean(htmlToVisibleText(seg.text||""));
    if(!text) return;
    var el = seg.el || null;
    splitLongLine(text, lang==="tr-TR"?90:75).forEach(function(piece){
      if(piece && piece.length > 1) out.push({text:piece, lang:lang, el:el});
    });
  });
  return speakChunkList(out);
}

window.DH_speakMixed = speakChunks;
window.DH_speakSegments = speakSegments;
window.DH_LongTTSAvatarSync = {
  speak:speakChunks, speakSegments:speakSegments, split:splitForSpeech,
  start:()=>setSpeakingState(true),
  stop:()=>{ try{ speechSynthesis.cancel(); }catch(e){} setSpeakingState(false); }
};

/* cancel() çağrıldığında oturumu geçersiz kıl ve durumu sıfırla.
   Not: gerçek iptali modül düzeyindeki nativeCancel (prototip native) ile
   yapıyoruz; başka bir script'in cancel sarmalayıcısına girmeyiz. */
try{
  speechSynthesis.cancel=function(){
    currentQueueSession++;
    setSpeakingState(false);
    try{ return nativeCancel ? nativeCancel() : SpeechSynthesis.prototype.cancel.call(speechSynthesis); }catch(e){}
  };
}catch(e){}

/* Uygulama düz speechSynthesis.speak çağırırsa: uzun/karışık metinleri
   bizim motora yönlendir, kısa tekil metinleri sadece avatar durumuyla sar. */
try{
  if(!speechSynthesis.__longAvatarSpeakPatch){
    speechSynthesis.__longAvatarSpeakPatch=true;
    speechSynthesis.speak=function(u){
      try{
        if(u && u.__longTTSAvatarSync) return nativeSpeak(u);
        const text=String(u&&u.text||"");
        if(text.length>60 || /TÜRKÇE|ENGLISH|AÇIKLAMA|ÖZET|ğ|ü|ş|ö|ç|ı/i.test(text) || /[.!?].+[.!?]/.test(text)){
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

document.addEventListener("visibilitychange",()=>{ if(document.hidden){ try{ speechSynthesis.cancel(); }catch(e){} setSpeakingState(false); } });
})();


/* ====================================================================
   AGIZ HIZI VE SES AYAR KAYDIRICISI (UI - DİŞLİ DÜĞMESİ)
   ==================================================================== */
(function(){
  if(window.__mouthSpeedControl) return;
  window.__mouthSpeedControl = true;
  var KEY = "dh_mouthSpeed";

  function getVal(){
    try{ var v = parseFloat(localStorage.getItem(KEY)); if(isFinite(v) && v>=0.5 && v<=2.0) return v; }catch(e){}
    return 1.0;
  }
  function setVal(v){ try{ localStorage.setItem(KEY, String(v)); }catch(e){} }

  function injectCss(){
    if(document.getElementById("mouthSpeedCss")) return;
    var css = document.createElement("style");
    css.id = "mouthSpeedCss";
    css.textContent = [
      "#mouthSpeedBtn{position:fixed;right:12px;bottom:12px;z-index:99998;",
      "  width:42px;height:42px;border-radius:50%;border:none;cursor:pointer;",
      "  background:rgba(7,18,38,.85);color:#fff;font-size:20px;line-height:42px;",
      "  text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.35);padding:0;}",
      "body.dh-chat-page #mouthSpeedBtn{bottom:150px;background:rgba(7,18,38,.72);}",
      "body.dh-chat-page #mouthSpeedPanel{bottom:200px;}",
      "#mouthSpeedBtn:active{transform:scale(.94);}",
      "#mouthSpeedPanel{position:fixed;right:12px;bottom:62px;z-index:99999;",
      "  width:230px;max-width:80vw;background:#0d1b32;color:#fff;border-radius:14px;",
      "  padding:14px 14px 12px;box-shadow:0 6px 22px rgba(0,0,0,.45);",
      "  font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:none;}",
      "#mouthSpeedPanel.open{display:block;}",
      "#mouthSpeedPanel h4{margin:0 0 4px;font-size:14px;font-weight:600;}",
      "#mouthSpeedPanel p{margin:0 0 10px;font-size:11px;opacity:.7;line-height:1.4;}",
      "#mouthSpeedRange{width:100%;margin:6px 0 2px;}",
      "#mouthSpeedLabels{display:flex;justify-content:space-between;font-size:11px;opacity:.8;}",
      ".dh-voice-grid{display:grid;grid-template-columns:auto 1fr auto;gap:6px 8px;align-items:center;}",
      ".dh-vlabel{display:block;font-size:11px;font-weight:700;margin:8px 0 3px;}",
      ".dh-vsel{width:100%;padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:inherit;font-size:12px;}",
      ".dh-vsel option{color:#111;}",
      ".dh-voice-grid b{font-size:11px;font-weight:700;white-space:nowrap;}",
      ".dh-voice-grid input[type=range]{width:100%;margin:0;}",
      ".dh-vv{font-size:10.5px;opacity:.7;font-family:monospace;min-width:30px;text-align:right;}",
      "#mouthSpeedPanel #vTestTr,#mouthSpeedPanel #vTestEn,#mouthSpeedPanel #vReset{flex:1;padding:7px 4px;font-size:11px;border:1px solid rgba(255,255,255,.25);border-radius:8px;background:rgba(255,255,255,.08);color:inherit;cursor:pointer;}",
      "#mouthSpeedClose{margin-top:10px;width:100%;padding:7px;border:none;border-radius:9px;",
      "  background:#1f6feb;color:#fff;font-size:13px;cursor:pointer;}",
      "#mouthSpeedTest{margin-top:6px;width:100%;padding:7px;border:1px solid rgba(255,255,255,.25);",
      "  border-radius:9px;background:transparent;color:#fff;font-size:13px;cursor:pointer;}"
    ].join("");
    document.head.appendChild(css);
  }

  function build(){
    injectCss();
    function markChatPage(){
      try{ if(document.querySelector(".chat-shell, .input-row .send-btn, #chatHistory")) document.body.classList.add("dh-chat-page"); }catch(e){}
    }
    markChatPage(); setTimeout(markChatPage,600); setTimeout(markChatPage,2000);
    var btn = document.createElement("button");
    btn.id = "mouthSpeedBtn"; btn.type = "button";
    btn.title = "Avatar agiz hizi ayari"; btn.textContent = "⚙";

    var panel = document.createElement("div");
    panel.id = "mouthSpeedPanel";
    panel.innerHTML =
      '<h4>Avatar ağız hızı</h4>' +
      '<p>Ağız hareketi sesle uyumsuzsa buradan ayarlayın. Değişiklik kaydedilir.</p>' +
      '<input id="mouthSpeedRange" type="range" min="0.5" max="2.0" step="0.05">' +
      '<div id="mouthSpeedLabels"><span>Hızlı</span><span>Normal</span><span>Yavaş</span></div>' +
      '<button id="mouthSpeedTest" type="button">🔊 Dene</button>' +
      '<hr style="border:0;border-top:1px solid rgba(255,255,255,.12);margin:12px 0">' +
      '<h4>🔊 Seslendirme hızı / tonu</h4>' +
      '<label class="dh-vlabel">🇹🇷 Türkçe ses</label><select id="vTrVoice" class="dh-vsel"></select>' +
      '<label class="dh-vlabel">🇬🇧 İngilizce ses</label><select id="vEnVoice" class="dh-vsel"></select>' +
      '<div class="dh-voice-grid">' +
        '<b>🇹🇷 hız</b><input id="vTrRate" type="range" min="0.5" max="1.6" step="0.02"><span class="dh-vv" id="vTrRateV"></span>' +
        '<b>🇹🇷 ton</b><input id="vTrPitch" type="range" min="0.5" max="1.6" step="0.02"><span class="dh-vv" id="vTrPitchV"></span>' +
        '<b>🇬🇧 hız</b><input id="vEnRate" type="range" min="0.5" max="1.6" step="0.02"><span class="dh-vv" id="vEnRateV"></span>' +
        '<b>🇬🇧 ton</b><input id="vEnPitch" type="range" min="0.5" max="1.6" step="0.02"><span class="dh-vv" id="vEnPitchV"></span>' +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-top:8px">' +
        '<button id="vTestTr" type="button">🇹🇷 Dene</button>' +
        '<button id="vTestEn" type="button">🇬🇧 Dene</button>' +
        '<button id="vReset" type="button">Sıfırla</button>' +
      '</div>' +
      '<button id="mouthSpeedClose" type="button" style="margin-top:8px">Tamam</button>';

    // Ses ayarı artık yalnızca ses-secim.html'den yapılır → bu yüzen çark düğmesi kaldırıldı.
    // Panel yine de DOM'da (gizli) kalır; aşağıdaki ağız-senkron kodu ona erişebilsin.
    // document.body.appendChild(btn);   // <- çark düğmesi eklenmiyor
    panel.style.display = "none";
    document.body.appendChild(panel);

    var range = panel.querySelector("#mouthSpeedRange");
    range.value = String(getVal());
    range.addEventListener("input", function(){ setVal(parseFloat(range.value)); });

    function vGet(){ return (window.DH_TTS&&DH_TTS.get)?DH_TTS.get():{}; }
    function vSync(){
      var c=vGet(), map={vTrRate:["trRate","vTrRateV"],vTrPitch:["trPitch","vTrPitchV"],vEnRate:["enRate","vEnRateV"],vEnPitch:["enPitch","vEnPitchV"]};
      Object.keys(map).forEach(function(id){ var el=panel.querySelector("#"+id),lab=panel.querySelector("#"+map[id][1]);
        if(el && c[map[id][0]]!=null) el.value=String(c[map[id][0]]); if(lab && c[map[id][0]]!=null) lab.textContent=Number(c[map[id][0]]).toFixed(2); });
    }
    function vBind(id,key,labId){ var el=panel.querySelector("#"+id); if(!el)return;
      el.addEventListener("input", function(){ var pt={}; pt[key]=parseFloat(el.value);
        if(window.DH_TTS&&DH_TTS.set) DH_TTS.set(pt);
        var lab=panel.querySelector("#"+labId); if(lab) lab.textContent=Number(el.value).toFixed(2); }); }
    vBind("vTrRate","trRate","vTrRateV"); vBind("vTrPitch","trPitch","vTrPitchV");
    vBind("vEnRate","enRate","vEnRateV"); vBind("vEnPitch","enPitch","vEnPitchV");

    function fillVoiceSelects(){
      var c=(window.DH_TTS&&DH_TTS.get)?DH_TTS.get():{};
      [["vTrVoice","tr-TR","trVoice"],["vEnVoice","en-US","enVoice"]].forEach(function(row){
        var sel=panel.querySelector("#"+row[0]); if(!sel) return;
        var list=(window.DH_TTS&&DH_TTS.voices)?DH_TTS.voices(row[1]):[];
        var cur=c[row[2]]||"";
        var html='<option value="">Varsayılan ('+(list.length?list.length+" ses":"yükleniyor")+')</option>';
        list.forEach(function(v){
          var id=v.voiceURI||v.name;
          var sel2=(id===cur)?" selected":"";
          html+='<option value="'+String(id).replace(/"/g,"&quot;")+'"'+sel2+'>'+String(v.name||id)+' ('+(v.lang||"")+')</option>';
        });
        sel.innerHTML=html;
      });
    }
    function bindVoiceSel(id, key, lang){
      var sel=panel.querySelector("#"+id); if(!sel) return;
      sel.addEventListener("change", function(){
        var patch={}; patch[key]=sel.value;
        if(window.DH_TTS&&DH_TTS.set) DH_TTS.set(patch);
        vSpeak(/^tr/i.test(lang)?"Merhaba, ses denemesi.":"Hello, voice test.", lang);
      });
    }
    bindVoiceSel("vTrVoice","trVoice","tr-TR");
    bindVoiceSel("vEnVoice","enVoice","en-US");
    fillVoiceSelects();
    try{ speechSynthesis.onvoiceschanged=function(){ fillVoiceSelects(); }; }catch(e){}
    var vtries=0, vtimer=setInterval(function(){
      var n=(window.DH_TTS&&DH_TTS.voices)?DH_TTS.voices().length:0;
      if(n>0){ fillVoiceSelects(); clearInterval(vtimer); }
      if(++vtries>10) clearInterval(vtimer);
    },500);
    function vSpeak(txt,lang){ try{ speechSynthesis.cancel(); var u=new SpeechSynthesisUtterance(txt); u.lang=lang;
      if(window.DH_TTS&&DH_TTS.apply) DH_TTS.apply(u,lang); u.__longTTSAvatarSync=true; speechSynthesis.speak(u); }catch(e){} }
    var _tt=panel.querySelector("#vTestTr"); if(_tt) _tt.addEventListener("click",function(){ vSpeak("Merhaba, bu bir Türkçe seslendirme denemedir.","tr-TR"); });
    var _te=panel.querySelector("#vTestEn"); if(_te) _te.addEventListener("click",function(){ vSpeak("Hello, this is an English voice test.","en-US"); });
    var _vr=panel.querySelector("#vReset"); if(_vr) _vr.addEventListener("click",function(){ if(window.DH_TTS&&DH_TTS.reset) DH_TTS.reset(); vSync(); });
    vSync();

    btn.addEventListener("click", function(){ panel.classList.toggle("open"); range.value = String(getVal()); });
    panel.querySelector("#mouthSpeedClose").addEventListener("click", function(){ panel.classList.remove("open"); });
    panel.querySelector("#mouthSpeedTest").addEventListener("click", function(){
      var sample = "Hello, this is a test. Merhaba, bu bir denemedir. Bu cümle biraz daha uzun olsun ki uzun metinde durmadığını görelim.";
      try{ if(window.DH_speakMixed){ window.DH_speakMixed(sample); return; } }catch(e){}
      try{ speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(sample)); }catch(e){}
    });
    document.addEventListener("click", function(ev){
      if(panel.classList.contains("open") && !panel.contains(ev.target) && ev.target!==btn){ panel.classList.remove("open"); }
    });
  }

  if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded", build); } else { build(); }
})();
