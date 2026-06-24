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
  const raw=String(text||"")
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<[^>]+>/g," ")
    .replace(/\*\*/g," ");        // ** kalın işaretleri okunmasın
  const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const chunks=[];

  // Bir satırı [[...]] sınırlarına göre dil-segmentlerine ayırır.
  // KURAL: [[ ]] içi = İngilizce. Geri kalan HER ŞEY = Türkçe.
  function segmentsByBrackets(line){
    const segs=[];
    const re=/\[\[([\s\S]*?)\]\]/g;
    let last=0, m;
    while((m=re.exec(line))!==null){
      if(m.index>last){
        const before=line.slice(last, m.index).trim();
        if(before) segs.push({text:before, lang:"tr-TR"});   // dış = Türkçe
      }
      const inner=(m[1]||"").trim();
      if(inner) segs.push({text:inner, lang:"en-US"});        // [[...]] içi = İngilizce
      last=re.lastIndex;
    }
    if(last<line.length){
      const after=line.slice(last).trim();
      if(after) segs.push({text:after, lang:"tr-TR"});        // dış = Türkçe
    }
    // Hiç [[...]] yoksa tüm satır Türkçe
    if(!segs.length){
      const t=line.trim();
      if(t) segs.push({text:t, lang:"tr-TR"});
    }
    return segs;
  }

  lines.forEach(line=>{
    segmentsByBrackets(line).forEach(seg=>{
      // Her segmenti cümlelere, sonra uzun ise küçük parçalara böl
      const pieces=seg.text.split(/(?<=[.!?])\s+/).filter(Boolean);
      (pieces.length?pieces:[seg.text]).forEach(p=>{
        splitLongLine(p, seg.lang==="tr-TR"?110:90).forEach(piece=>{
          if(piece) chunks.push({text:piece, lang:seg.lang});
        });
      });
    });
  });
  return chunks.length ? chunks : [{text:clean(raw.replace(/\[\[|\]\]/g," ")), lang:"tr-TR"}];
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
/* Bir harf icin dogru agiz frame dosya adi (avatars_v3 setine gore). */
function mouthFileForChar(ch){
  ch = String(ch||"").toLocaleLowerCase("tr-TR");
  if(ch==="a"||ch==="â") return "mouth-a";
  if(ch==="e") return "mouth-e";
  if(ch==="o"||ch==="u"||ch==="ö"||ch==="ü") return "mouth-o";
  if(ch==="i"||ch==="ı"||ch==="y") return "mouth-i";
  if(ch==="m"||ch==="b"||ch==="p") return "mouth-mbp";
  if(ch==="f"||ch==="v") return "mouth-fv";
  if(ch==="l") return "mouth-l";
  if(ch==="t"||ch==="d"||ch==="s"||ch==="z"||ch==="ş") return "mouth-th";
  if(/[a-zçğşö]/.test(ch)) return "mouth-e"; // diger sessizler: hafif acik
  return null; // bosluk/noktalama -> idle (agiz kapali)
}
function frameForChar(baseSrc, ch){
  if(!baseSrc) return null;
  const file = mouthFileForChar(ch);
  const q = baseSrc.includes("?") ? baseSrc.slice(baseSrc.indexOf("?")) : "";
  const base = baseSrc.replace(/\?.*$/,"");
  const dir = base.replace(/\/[^\/]*$/,"/");
  const ext = (base.match(/\.(webp|png|jpg|jpeg)$/i)||[".webp","webp"])[1];
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

/* ---- Metin tabanli agiz oynatici (her telefonda calisir) ----
   - currentText: o an okunan parcanin metni
   - mouthPos: metinde gosterdigimiz harf indexi
   - onboundary gelirse mouthPos o kelimeye atlanir (hizalama)
   - onboundary hic gelmese bile tahmini hizla ilerler
*/
let currentText="";
let mouthPos=0;
let perCharMs=75;

function applyCharToAvatars(ch){
  avatarImgs().forEach(img=>{
    const current=srcOf(img);
    if(!savedSrc.has(img)) savedSrc.set(img, idleSrc(current));
    if(img.dataset.avatarBlinking==="1") return;
    const base=savedSrc.get(img) || idleSrc(current) || current;
    const next=frameForChar(base, ch);
    if(next){ try{ img.src=next; }catch(e){} }
  });
}

function startMouthForText(text, lang){
  currentText = String(text||"");
  mouthPos = 0;
  // ortalama konusma hizi: tr biraz hizli, en biraz yavas
  let basePer = (lang==="tr-TR") ? 70 : 80;
  // kullanici ayari: 0.5 (cok hizli agiz) .. 2.0 (cok yavas agiz), varsayilan 1.0
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
    if(mouthPos >= currentText.length){
      // metin bitti ama ses surebilir: agzi hafif kapali tut, bekle
      applyCharToAvatars("");
      return;
    }
    const ch = currentText.charAt(mouthPos);
    applyCharToAvatars(ch);
    mouthPos++;
  }, perCharMs);
}

/* onboundary geldiginde okunan kelimeye hizalan */
function alignMouthTo(charIndex){
  if(typeof charIndex==="number" && charIndex>=0 && charIndex<=currentText.length){
    mouthPos = charIndex;
  }
}

function stopMouthLoop(){
  clearInterval(mouthTimer); mouthTimer=null;
  currentText=""; mouthPos=0;
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
  // Chrome, uzun konuşmalarda ~15 sn sonra TTS'i sessizce durdurur.
  // Periyodik pause/resume bu kesilmeyi engeller (konuşma boyunca aktif).
  let keepAlive=setInterval(()=>{
    try{
      if(speechSynthesis.speaking && !speechSynthesis.paused){
        speechSynthesis.pause(); speechSynthesis.resume();
      }
    }catch(e){}
  }, 9000);
  function stopKeepAlive(){ if(keepAlive){ clearInterval(keepAlive); keepAlive=null; } }
  let i=0, stopped=false;
  function next(){
    if(stopped) return;
    if(i>=chunks.length){
      stopKeepAlive();
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
    function advance(){
      if(ended) return;
      ended=true;
      clearTimeout(watchdog);
      clearInterval(mouthTimer); mouthTimer=null;
      setSpeakingState(true);
      setTimeout(next, 60);
    }
    // Zorlama zamanlayıcısı: Chrome bazen onend'i hiç çağırmaz; tahmini süre
    // dolunca zinciri zorla ilerlet ki sonraki parça okunsun (kesilme önlenir).
    // Tahmini süre: kelime sayısı * konuşma hızına göre + güvenlik payı.
    var estMs = Math.max(4000, c.text.length * 75) + 1500;
    const watchdog=setTimeout(advance, estMs);
    u.onstart=()=>{ setSpeakingState(true); startMouthForText(c.text, c.lang); };
    u.onboundary=(ev)=>{ setSpeakingState(true); if(ev && (ev.name==="word"||ev.name===undefined)) alignMouthTo(ev.charIndex); };
    u.onend=advance;
    u.onerror=advance;
    try{ nativeSpeak(u); }catch(e){ advance(); }
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


/* ====================================================================
   AGIZ HIZI AYAR KAYDIRICISI (kullanici arayuzu)
   Konusma ekranina kucuk bir dis (ayar) dugmesi ekler.
   Tiklayinca "Agiz hizi" kaydiricisi acilir; secilen deger
   localStorage'a (dh_mouthSpeed) kaydedilir ve yukaridaki
   startMouthForText() tarafindan okunur. Ekstra dosya gerekmez.
   ==================================================================== */
(function(){
  if(window.__mouthSpeedControl) return;
  window.__mouthSpeedControl = true;
  var KEY = "dh_mouthSpeed";

  function getVal(){
    try{
      var v = parseFloat(localStorage.getItem(KEY));
      if(isFinite(v) && v>=0.5 && v<=2.0) return v;
    }catch(e){}
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
      "#mouthSpeedClose{margin-top:10px;width:100%;padding:7px;border:none;border-radius:9px;",
      "  background:#1f6feb;color:#fff;font-size:13px;cursor:pointer;}",
      "#mouthSpeedTest{margin-top:6px;width:100%;padding:7px;border:1px solid rgba(255,255,255,.25);",
      "  border-radius:9px;background:transparent;color:#fff;font-size:13px;cursor:pointer;}"
    ].join("");
    document.head.appendChild(css);
  }

  function build(){
    injectCss();
    var btn = document.createElement("button");
    btn.id = "mouthSpeedBtn"; btn.type = "button";
    btn.title = "Avatar agiz hizi ayari"; btn.textContent = "\u2699";

    var panel = document.createElement("div");
    panel.id = "mouthSpeedPanel";
    panel.innerHTML =
      '<h4>Avatar a\u011f\u0131z h\u0131z\u0131</h4>' +
      '<p>A\u011f\u0131z hareketi sesle uyumsuzsa buradan ayarlay\u0131n. De\u011fi\u015fiklik kaydedilir.</p>' +
      '<input id="mouthSpeedRange" type="range" min="0.5" max="2.0" step="0.05">' +
      '<div id="mouthSpeedLabels"><span>H\u0131zl\u0131</span><span>Normal</span><span>Yava\u015f</span></div>' +
      '<button id="mouthSpeedTest" type="button">\ud83d\udd0a Dene</button>' +
      '<button id="mouthSpeedClose" type="button">Tamam</button>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    var range = panel.querySelector("#mouthSpeedRange");
    range.value = String(getVal());
    range.addEventListener("input", function(){ setVal(parseFloat(range.value)); });

    btn.addEventListener("click", function(){
      panel.classList.toggle("open");
      range.value = String(getVal());
    });
    panel.querySelector("#mouthSpeedClose").addEventListener("click", function(){
      panel.classList.remove("open");
    });
    panel.querySelector("#mouthSpeedTest").addEventListener("click", function(){
      var sample = "Hello, this is a test. Merhaba, bu bir denemedir.";
      try{ if(window.DH_speakMixed){ window.DH_speakMixed(sample); return; } }catch(e){}
      try{ speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(sample)); }catch(e){}
    });
    document.addEventListener("click", function(ev){
      if(panel.classList.contains("open") && !panel.contains(ev.target) && ev.target!==btn){
        panel.classList.remove("open");
      }
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", build);
  } else { build(); }
})();
