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

// ---- Kullanıcı duraklatma bayrağı (artık kullanılmıyor, güvenlik için false) ----
window.__dhUserPaused = false;

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
  r=r.replace(/```[\s\S]*?```/g," ").replace(/`+/g," ");
  r=r.replace(/[*_~#>^=|]+/g," ");
  r=r.replace(/["\u201C\u201D\u201E\u00AB\u00BB]+/g," ");
  r=r.replace(/[\u2022\u00B7\u25AA\u25CF\u25A0\u25B6\u2192\u2190\u2713\u2714\u2717\u2605\u2606]/g," ");
  r=r.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\uFE0F]/gu," ");
  r=r.replace(/[\u2012-\u2015\u2212]/g," ");
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

window.DH_TTS={
  get:dhTtsCfg,
  set:function(patch){ var n=Object.assign(dhTtsCfg(),patch||{}); try{ localStorage.setItem("dh-tts-voice-v1",JSON.stringify(n)); }catch(e){} return n; },
  reset:function(){ try{ localStorage.removeItem("dh-tts-voice-v1"); }catch(e){} return dhTtsCfg(); },
  apply:dhApplyVoice, clean:dhSpeakClean, defaults:DH_TTS_DEFAULTS, pickVoice:dhPickVoice,
  voices:function(lang){
    var v=[]; try{ v=speechSynthesis.getVoices()||[]; }catch(e){}
    if(!lang) return v.slice();
    var re=/^tr/i.test(lang)?/^tr/i:/^en/i;
    return v.filter(function(x){ return re.test(x.lang||""); });
  }
};

function isTurkish(text){
  const s=String(text||"");
  if(/[ğüşöçıİĞÜŞÖÇ]/.test(s)) return true;
  if(/^\s*(TÜRKÇE|AÇIKLAMA|ÖZET|NOT|KURAL|YANLIŞ|DOĞRU)\b/i.test(s)) return true;
  if(/\b(konu|cümle|örnek|anlam|yapı|kural|kullanıcı|cevap|doğru|yanlış|şöyle|çünkü|fiil|özne|yüklem|Türkçe|anlat|açıkla|demek|kullanılır)\b/i.test(s)) return true;
  return false;
}

function splitLongLine(line, maxLen=120){
  line=clean(line);
  if(line.length<=maxLen) return [line];
  const parts=[];
  let rest=line;
  while(rest.length>maxLen){
    let cut=Math.max(rest.lastIndexOf(". ",maxLen), rest.lastIndexOf(", ",maxLen), rest.lastIndexOf("; ",maxLen), rest.lastIndexOf(" ",maxLen));
    if(cut<40) cut=maxLen;
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
    .replace(/\*\*/g," ");
  const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const chunks=[];

  function segmentsByBrackets(line){
    const segs=[];
    const re=/\[\[([\s\S]*?)\]\]|"([^"]*?)"|“([^”]*?)”/g;
    let last=0, m;

    while((m=re.exec(line))!==null){
      if(m.index > last){
        const before=line.slice(last, m.index).trim();
        if(before){
          segs.push({text:before, lang: isTurkish(before) ? "tr-TR" : "en-US"});
        }
      }
      const inner=((m[1]!=null?m[1]:(m[2]!=null?m[2]:m[3]))||"").trim();
      if(inner){
        segs.push({text:inner, lang:"en-US"});
      }
      last=re.lastIndex;
    }

    if(last < line.length){
      const after=line.slice(last).trim();
      if(after){
        segs.push({text:after, lang: isTurkish(after) ? "tr-TR" : "en-US"});
      }
    }

    if(!segs.length){
      const t=line.trim();
      if(t) segs.push({text:t, lang: isTurkish(t) ? "tr-TR" : "en-US"});
    }
    return segs;
  }

  lines.forEach(line=>{
    segmentsByBrackets(line).forEach(seg=>{
      const pieces=seg.text.split(/(?<=[.!?])\s+/).filter(Boolean);
      (pieces.length?pieces:[seg.text]).forEach(p=>{
        splitLongLine(p, seg.lang==="tr-TR"?100:80).forEach(piece=>{
          if(piece) chunks.push({text:piece, lang:seg.lang});
        });
      });
    });
  });
  return chunks.length ? chunks : [{text:clean(raw.replace(/\[\[|\]\]/g," ")), lang: isTurkish(raw) ? "tr-TR" : "en-US"}];
}

function avatarImgs(){
  const set=new Set();
  AVATAR_SELECTORS.forEach(sel=>{
    try{ document.querySelectorAll(sel).forEach(img=>{ if(img && img.tagName==="IMG") set.add(img); }); }catch(e){}
  });
  return [...set].filter(img=>{
    try{
      const r=img.getBoundingClientRect();
      return r.width>24 && r.height>24 && r.bottom>0 && r.top<window.innerHeight;
    }catch(e){ return true; }
  });
}

function srcOf(img){ return img.currentSrc || img.src || img.getAttribute("src") || ""; }
function idleSrc(src){
  if(!src) return src;
  return src.replace(/\/(mouth-[^\/]+|talk|speaking|mouth-open|blink)\.(webp|png|jpg|jpeg)(\?.*)?$/i, "/idle.$2$3");
}

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
  if(/[a-zçğşö]/.test(ch)) return "mouth-e";
  return null;
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
  let basePer = (lang==="tr-TR") ? 70 : 80;
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
      applyCharToAvatars("");
      return;
    }
    const ch = currentText.charAt(mouthPos);
    applyCharToAvatars(ch);
    mouthPos++;
  }, perCharMs);
}

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
  return speakChunkList(chunks);
}

function speakSegments(segments){
  if(!nativeSpeak || !Array.isArray(segments)) return false;
  const out=[];
  segments.forEach(function(seg){
    if(!seg) return;
    var lang = seg.lang ? seg.lang : (isTurkish(seg.text) ? "tr-TR" : "en-US");
    var text = clean(seg.text||"");
    if(!text) return;
    var el = seg.el || null;
    var pieces = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    (pieces.length?pieces:[text]).forEach(function(p){
      splitLongLine(p, lang==="tr-TR"?100:80).forEach(function(piece){
        if(piece) out.push({text:piece, lang:lang, el:el});
      });
    });
  });
  return speakChunkList(out);
}

// KİLİTLENMEYİ VE DURMAYI ÖNLEYEN ZİNCİRLEME (QUEUE) YÖNETİCİSİ
let currentQueueSession = 0;

function speakChunkList(chunks){
  if(!nativeSpeak) return false;
  chunks=(chunks||[]).filter(c=>c&&clean(c.text));
  if(!chunks.length) return false;

  try{ speechSynthesis.cancel(); }catch(e){}
  setSpeakingState(true);

  currentQueueSession++;
  const thisSession = currentQueueSession;

  let index = 0;

  function playNext(){
    if(thisSession !== currentQueueSession) return;

    if(index >= chunks.length){
      setTimeout(()=>setSpeakingState(false), 200);
      try{ if(window.__dhHighlight) window.__dhHighlight(null); }catch(e){}
      return;
    }

    const item = chunks[index++];
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = item.lang;
    dhApplyVoice(u, item.lang);
    u.__longTTSAvatarSync = true;

    let hasAdvanced = false;
    let safetyTimer = null;

    function stepNext(){
      if(hasAdvanced) return;
      hasAdvanced = true;
      if(safetyTimer) clearTimeout(safetyTimer);
      clearInterval(mouthTimer); mouthTimer=null;

      // ★ DÜZELTİLDİ: window.__dhUserPaused kontrolü KALDIRILDI
      // Tarayıcı duraklatma/resume işlevlerini kullanın, bu değişkene güvenmeyin.
      setTimeout(playNext, 40);
    }

    // Her cümle için kelime başına ve karakter uzunluğuna göre cömert emniyet payı
    const safeMs = Math.max(item.text.length * 150, 4500);
    safetyTimer = setTimeout(stepNext, safeMs);

    u.onstart = () => {
      if(thisSession !== currentQueueSession) return;
      setSpeakingState(true);
      startMouthForText(item.text, item.lang);
      try{ if(window.__dhHighlight) window.__dhHighlight(item.el||null); }catch(e){}
    };

    u.onboundary = (ev) => {
      if(thisSession !== currentQueueSession) return;
      setSpeakingState(true);
      if(ev && (ev.name==="word"||ev.name===undefined)) alignMouthTo(ev.charIndex);
    };

    u.onend = stepNext;
    u.onerror = stepNext;

    try {
      nativeSpeak(u);
    } catch(e) {
      stepNext();
    }
  }

  playNext();
  return true;
}

window.DH_speakMixed = speakChunks;
window.DH_speakSegments = speakSegments;
window.DH_LongTTSAvatarSync = { speak:speakChunks, speakSegments:speakSegments, split:splitForSpeech, start:()=>setSpeakingState(true), stop:()=>setSpeakingState(false) };

// ---- speechSynthesis.cancel override (güvenli) ----
try{
  const nativeCancel = speechSynthesis.cancel.bind(speechSynthesis);
  speechSynthesis.cancel = function(){
    currentQueueSession++;
    setSpeakingState(false);
    return nativeCancel();
  };
}catch(e){}

// ---- speechSynthesis.speak override (daha sağlam) ----
try{
  if(!speechSynthesis.__longAvatarSpeakPatch){
    speechSynthesis.__longAvatarSpeakPatch = true;
    speechSynthesis.speak = function(u){
      try{
        if(u && u.__longTTSAvatarSync) return nativeSpeak(u);
        const text = String(u && u.text || "");
        if(text.length > 80 || /TÜRKÇE|ENGLISH|AÇIKLAMA|ÖZET|ğ|ü|ş|ö|ç|ı/i.test(text)){
          return speakChunks(text);
        }
        const oldStart = u.onstart;
        const oldBoundary = u.onboundary;
        const oldEnd = u.onend;
        const oldError = u.onerror;
        u.onstart = function(ev){ setSpeakingState(true); if(oldStart) oldStart.call(this, ev); };
        u.onboundary = function(ev){ setSpeakingState(true); if(oldBoundary) oldBoundary.call(this, ev); };
        u.onend = function(ev){ setTimeout(()=>setSpeakingState(false), 180); if(oldEnd) oldEnd.call(this, ev); };
        u.onerror = function(ev){ setTimeout(()=>setSpeakingState(false), 180); if(oldError) oldError.call(this, ev); };
      }catch(e){ /* override içinde hata olursa sessizce geç */ }
      try { return nativeSpeak(u); } catch(e) { return undefined; }
    };
  }
}catch(e){}

document.addEventListener("visibilitychange", ()=>{
  if(document.hidden) setSpeakingState(false);
});

})();


/* ====================================================================
   AGIZ HIZI VE SES AYAR KAYDIRICISI (UI - DİŞLİ DÜĞMESİ)
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
      try{
        if(document.querySelector(".chat-shell, .input-row .send-btn, #chatHistory"))
          document.body.classList.add("dh-chat-page");
      }catch(e){}
    }
    markChatPage(); setTimeout(markChatPage,600); setTimeout(markChatPage,2000);
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
      '<hr style="border:0;border-top:1px solid rgba(255,255,255,.12);margin:12px 0">' +
      '<h4>\ud83d\udd0a Seslendirme h\u0131z\u0131 / tonu</h4>' +
      '<label class="dh-vlabel">\ud83c\uddf9\ud83c\uddf7 T\u00fcrk\u00e7e ses</label><select id="vTrVoice" class="dh-vsel"></select>' +
      '<label class="dh-vlabel">\ud83c\uddec\ud83c\udde7 \u0130ngilizce ses</label><select id="vEnVoice" class="dh-vsel"></select>' +
      '<div class="dh-voice-grid">' +
        '<b>\ud83c\uddf9\ud83c\uddf7 h\u0131z</b><input id="vTrRate" type="range" min="0.5" max="1.6" step="0.02"><span class="dh-vv" id="vTrRateV"></span>' +
        '<b>\ud83c\uddf9\ud83c\uddf7 ton</b><input id="vTrPitch" type="range" min="0.5" max="1.6" step="0.02"><span class="dh-vv" id="vTrPitchV"></span>' +
        '<b>\ud83c\uddec\ud83c\udde7 h\u0131z</b><input id="vEnRate" type="range" min="0.5" max="1.6" step="0.02"><span class="dh-vv" id="vEnRateV"></span>' +
        '<b>\ud83c\uddec\ud83c\udde7 ton</b><input id="vEnPitch" type="range" min="0.5" max="1.6" step="0.02"><span class="dh-vv" id="vEnPitchV"></span>' +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-top:8px">' +
        '<button id="vTestTr" type="button">\ud83c\uddf9\ud83c\uddf7 Dene</button>' +
        '<button id="vTestEn" type="button">\ud83c\uddec\ud83c\udde7 Dene</button>' +
        '<button id="vReset" type="button">S\u0131f\u0131rla</button>' +
      '</div>' +
      '<button id="mouthSpeedClose" type="button" style="margin-top:8px">Tamam</button>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    var range = panel.querySelector("#mouthSpeedRange");
    range.value = String(getVal());
    range.addEventListener("input", function(){ setVal(parseFloat(range.value)); });

    function vGet(){ return (window.DH_TTS&&DH_TTS.get)?DH_TTS.get():DH_TTS_DEFAULTS; }
    function vSync(){
      var c=vGet(), map={vTrRate:["trRate","vTrRateV"],vTrPitch:["trPitch","vTrPitchV"],vEnRate:["enRate","vEnRateV"],vEnPitch:["enPitch","vEnPitchV"]};
      Object.keys(map).forEach(function(id){ var el=panel.querySelector("#"+id),lab=panel.querySelector("#"+map[id][1]);
        if(el) el.value=String(c[map[id][0]]); if(lab) lab.textContent=Number(c[map[id][0]]).toFixed(2); });
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
        var html='<option value="">Varsay\u0131lan ('+(list.length?list.length+" ses":"y\u00fckleniyor")+')</option>';
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