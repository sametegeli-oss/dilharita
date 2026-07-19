/* word-wave-addon.js — 🌊 SES DALGASI ANALİZİ (sesdalga.html mantığı, kelime bazlı)
   index-app.html'deki React kelime popup'ına (wp-box) React'e dokunmadan
   "Hoca Çizdir → Sen Oku → Kıyasla → Düet" bölümünü ekler.

   Aynı ölçüm hattı: analyser fftSize=64, 40ms örnekleme, ortalama genlik.
   Hoca: TTS hoparlörden konuşurken mikrofon (yankı bastırma KAPALI) gerçek sesi kaydeder.
   Kıyas: sessizlik kırpma (eşik 8) → Tempo (süre), Vurgu (zirve konumu), Söz (STT). */
(function(global){
  "use strict";
  if(global.__dhWordWave) return; global.__dhWordWave=true;

  /* ---------- stil ---------- */
  function injectCSS(){
    if(document.getElementById("dhwv-css")) return;
    var st=document.createElement("style"); st.id="dhwv-css";
    st.textContent =
     ".dhwv-box{background:#0b1830;border:1px solid #1e3a5f;border-radius:14px;padding:12px 14px;margin:10px 0}"
    +".dhwv-head{font-size:12px;font-weight:800;color:#9fb3d9;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px}"
    +".dhwv-wave{position:relative;width:100%;height:110px;background:#020617;border:1px solid #1e3a5f;border-radius:10px;overflow:hidden;margin-bottom:8px}"
    +".dhwv-wave canvas{position:absolute;inset:0;width:100%;height:100%;display:block}"
    +".dhwv-meta{display:flex;gap:8px;align-items:center;font-size:11px;font-weight:800;color:#9fb3d9;margin-bottom:8px}"
    +".dhwv-dur{background:#13294d;border:1px solid #1e3a5f;padding:2px 7px;border-radius:6px;font-family:monospace;color:#cbd5e1}"
    +".dhwv-score{margin-left:auto;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:900;color:#03131c;display:none}"
    +".dhwv-row{display:flex;gap:6px;margin-bottom:6px}"
    +".dhwv-row button{flex:1;border:0;border-radius:10px;padding:9px 4px;font-size:11.5px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px}"
    +".dhwv-row button:disabled{opacity:.4;cursor:default}"
    +".dhwv-coach{background:#38bdf8;color:#03131c}"
    +".dhwv-rec{background:#dc2626;color:#fff}"
    +".dhwv-rec.on{background:#f43f5e;animation:dhwvP 1s infinite}"
    +"@keyframes dhwvP{50%{opacity:.6}}"
    +".dhwv-cmp{background:linear-gradient(180deg,#10b981,#059669);color:#fff}"
    +".dhwv-play{background:#13294d;color:#e8eef7;border:1px solid #1e3a5f!important}"
    +".dhwv-status{font-size:12px;font-weight:700;color:#9fb3d9;min-height:16px;line-height:1.4}";
    document.head.appendChild(st);
  }

  /* ---------- motor durumu ---------- */
  var WV=null;
  function cleanup(){
    if(!WV) return;
    try{ if(WV.timer) clearInterval(WV.timer); }catch(e){}
    try{ if(WV.rec && WV.rec.state!=="inactive") WV.rec.stop(); }catch(e){}
    try{ if(WV.stream) WV.stream.getTracks().forEach(function(t){t.stop();}); }catch(e){}
    try{ if(WV.sr) WV.sr.stop(); }catch(e){}
    try{ (WV.playing||[]).forEach(function(a){a.pause();}); }catch(e){}
    if(WV.coachUrl){ try{ URL.revokeObjectURL(WV.coachUrl); }catch(e){} }
    if(WV.userUrl){ try{ URL.revokeObjectURL(WV.userUrl); }catch(e){} }
    WV=null;
  }
  function q(sel){ return WV&&WV.sec ? WV.sec.querySelector(sel) : null; }
  function setStatus(msg,color){ var s=q(".dhwv-status"); if(s){ s.textContent=msg; s.style.color=color||"#9fb3d9"; } }
  function avg(arr){ var t=0; for(var i=0;i<arr.length;i++) t+=arr[i]; return t/arr.length; }
  function trim(d){ var TH=8,s=0,e=d.length-1; while(s<d.length&&d[s]<TH)s++; while(e>s&&d[e]<TH)e--; return d.slice(s,e+1); }
  function resample(data,len){
    if(!data.length||data.length===len) return data.slice();
    var out=[],r=(data.length-1)/Math.max(len-1,1);
    for(var i=0;i<len;i++){ var p=i*r,a=Math.floor(p),b=Math.min(a+1,data.length-1),w=p-a; out.push(data[a]*(1-w)+data[b]*w); }
    return out;
  }
  function syllableCount(w){
    var m=String(w||"").toLowerCase().match(/[aeiouy]+/g);
    return Math.max(1,(m||["a"]).length);
  }
  function template(word){
    var n=syllableCount(word), frames=Math.max(14,n*11), out=[];
    for(var i=0;i<frames;i++){
      var pos=i/frames*n, k=Math.floor(pos), c=(pos-k)-0.5;
      out.push(Math.max(6,Math.round(62*Math.exp(-c*c*10))));
    }
    return out;
  }
  function draw(){
    if(!WV) return;
    var cv=q("canvas"); if(!cv) return;
    var w=cv.clientWidth,h=cv.clientHeight;
    if(!w||!h) return;
    if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
    var ctx=cv.getContext("2d"); ctx.clearRect(0,0,w,h);
    var C=WV.viewC||[], U=WV.viewU||[];
    if(C.length&&U.length&&C.length===U.length){
      ctx.fillStyle="rgba(244,63,94,0.12)"; ctx.beginPath();
      var st=w/Math.max(C.length-1,1);
      for(var i=0;i<C.length;i++){
        var yC=h-(C[i]/100)*(h*0.85)-2, yU=h-((U[i]||0)/100)*(h*0.85)-2, x=i*st;
        if(i===0) ctx.moveTo(x,yC); else ctx.lineTo(x,yC);
        ctx.lineTo(x,yU);
      }
      ctx.fill();
    }
    function line(data,color){
      if(!data.length) return;
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.beginPath();
      var st=w/Math.max(data.length-1,1);
      for(var i=0;i<data.length;i++){
        var y=h-(data[i]/100)*(h*0.85)-2;
        if(i===0) ctx.moveTo(0,y); else ctx.lineTo(i*st,y);
      }
      ctx.stroke();
    }
    line(C,"#38bdf8"); line(U,"#4ade80");
  }
  function stopAudio(){ if(!WV) return; try{ (WV.playing||[]).forEach(function(a){a.pause();}); }catch(e){} WV.playing=[]; }
  function speakWord(word,rate){
    try{
      speechSynthesis.cancel();
      var u=new SpeechSynthesisUtterance(String(word||""));
      u.lang="en-US"; u.rate=rate||0.78; u.__dhMixed=true; u.__longTTSAvatarSync=true;
      speechSynthesis.speak(u);
    }catch(e){}
  }

  function coach(){
    var me=WV; if(!me) return;
    stopAudio();
    var word=me.word;
    me.coach=[]; me.viewC=[]; me.viewU=me.user.slice();
    if(me.coachUrl){ try{ URL.revokeObjectURL(me.coachUrl); }catch(e){} me.coachUrl=null; }
    var sc=q(".dhwv-score"); if(sc) sc.style.display="none";
    q(".dhwv-coach").disabled=true;
    setStatus("🎓 Hoca konuşuyor — hoparlör açık olsun, dalga canlı çiziliyor…","#38bdf8");
    var capStream=null,capCtx=null,capAn=null,capData=null,capRec=null,chunks=[],micFail=false,done=false;
    function finish(){
      if(WV!==me||done) return; done=true;
      clearInterval(me.timer); me.timer=null;
      try{ if(capRec&&capRec.state!=="inactive") capRec.stop(); }catch(e){}
      try{ if(capStream) capStream.getTracks().forEach(function(t){t.stop();}); }catch(e){}
      try{ if(capCtx) capCtx.close(); }catch(e){}
      setTimeout(function(){
        if(WV!==me) return;
        var mx=0; for(var i=0;i<me.coach.length;i++) if(me.coach[i]>mx) mx=me.coach[i];
        if(micFail||!me.coach.length||mx<20){
          me.coach=template(word); me.coachUrl=null;
          setStatus(micFail?"⚠️ Mikrofon izni yok — ritim şablonu kullanıldı. Yine de kaydını kıyaslayabilirsin.":"⚠️ Mikrofon hocayı duyamadı (kulaklık takılı olabilir) — ritim şablonu kullanıldı.","#f59e0b");
        }else{
          setStatus("🎓 Hoca hazır (gerçek kayıt). Şimdi '2. Sen Oku' ile aynı kelimeyi söyle.","#4ade80");
        }
        me.coachDur=me.coach.length*0.04;
        me.viewC=me.coach.slice();
        var d=q(".dhwv-durC"); if(d) d.textContent=me.coachDur.toFixed(1)+"s";
        q(".dhwv-coach").disabled=false;
        q(".dhwv-rec").disabled=false;
        var pc=q(".dhwv-playC"); if(pc) pc.disabled=false;
        if(me.user.length) q(".dhwv-cmp").disabled=false;
        draw();
      },250);
    }
    var pStream=(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)
      ? navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false}})
      : Promise.reject();
    pStream.then(function(st){
      if(WV!==me){ st.getTracks().forEach(function(t){t.stop();}); return; }
      capStream=st;
      capCtx=new (window.AudioContext||window.webkitAudioContext)();
      capAn=capCtx.createAnalyser(); capAn.fftSize=64;
      capData=new Uint8Array(capAn.frequencyBinCount);
      capCtx.createMediaStreamSource(st).connect(capAn);
      try{
        capRec=new MediaRecorder(st);
        capRec.ondataavailable=function(e){ if(e.data.size>0) chunks.push(e.data); };
        capRec.onstop=function(){ if(chunks.length&&WV===me) me.coachUrl=URL.createObjectURL(new Blob(chunks,{type:"audio/webm"})); };
        capRec.start();
      }catch(e){}
    }).catch(function(){ micFail=true; })
    .then(function(){
      if(WV!==me) return;
      if(!("speechSynthesis" in window)){ me.coach=template(word); finish(); return; }
      try{ speechSynthesis.cancel(); }catch(e){}
      var u=new SpeechSynthesisUtterance(word);
      u.lang="en-US"; u.rate=0.78; u.__dhMixed=true;
      me.timer=setInterval(function(){
        var vol=15;
        if(capAn){ capAn.getByteFrequencyData(capData); vol=avg(capData); }
        me.coach.push(vol);
        me.viewC=me.coach;
        var d=q(".dhwv-durC"); if(d) d.textContent=(me.coach.length*0.04).toFixed(1)+"s";
        draw();
      },40);
      u.onend=finish; u.onerror=finish;
      speechSynthesis.speak(u);
      setTimeout(finish,6000); /* emniyet */
    });
  }

  function record(){
    var me=WV; if(!me||me.recording) return;
    stopAudio();
    var word=me.word;
    me.user=[]; me.viewU=[]; me.viewC=me.coach.slice(); me.heard="";
    if(me.userUrl){ try{ URL.revokeObjectURL(me.userUrl); }catch(e){} me.userUrl=null; }
    var sc=q(".dhwv-score"); if(sc) sc.style.display="none";
    navigator.mediaDevices.getUserMedia({audio:true}).then(function(st){
      if(WV!==me){ st.getTracks().forEach(function(t){t.stop();}); return; }
      me.stream=st;
      var ctxA=new (window.AudioContext||window.webkitAudioContext)();
      me.ctxA=ctxA;
      var an=ctxA.createAnalyser(); an.fftSize=64;
      var da=new Uint8Array(an.frequencyBinCount);
      ctxA.createMediaStreamSource(st).connect(an);
      var chunks=[];
      try{
        me.rec=new MediaRecorder(st);
        me.rec.ondataavailable=function(e){ if(e.data.size>0) chunks.push(e.data); };
        me.rec.onstop=function(){
          if(chunks.length&&WV===me){
            me.userUrl=URL.createObjectURL(new Blob(chunks,{type:"audio/webm"}));
            var pu=q(".dhwv-playU"); if(pu) pu.disabled=false;
            var pd=q(".dhwv-duet"); if(pd&&me.coachUrl) pd.disabled=false;
          }
        };
        me.rec.start();
      }catch(e){}
      var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(SR){ try{ me.sr=new SR(); me.sr.lang="en-US"; me.sr.onresult=function(e){ me.heard=(e.results[0][0].transcript||"").toLowerCase(); }; me.sr.start(); }catch(e){ me.sr=null; } }
      me.recording=true;
      var b=q(".dhwv-rec"); b.textContent="■ Durdur"; b.classList.add("on");
      setStatus("🎙️ Kaydediliyor — \""+word+"\" de ve durdur…","#f43f5e");
      me.timer=setInterval(function(){
        an.getByteFrequencyData(da);
        me.user.push(avg(da));
        me.viewU=me.user;
        var d=q(".dhwv-durU"); if(d) d.textContent=(me.user.length*0.04).toFixed(1)+"s";
        draw();
        if(me.user.length*0.04>=6) stopRec(); /* tek kelime için emniyet tavanı */
      },40);
    }).catch(function(){ setStatus("Mikrofon izni verilmedi.","#f87171"); });
  }
  function stopRec(){
    var me=WV; if(!me||!me.recording) return;
    me.recording=false;
    clearInterval(me.timer); me.timer=null;
    try{ if(me.rec&&me.rec.state!=="inactive") me.rec.stop(); }catch(e){}
    try{ if(me.stream) me.stream.getTracks().forEach(function(t){t.stop();}); }catch(e){}
    try{ if(me.ctxA) me.ctxA.close(); }catch(e){}
    try{ if(me.sr) me.sr.stop(); }catch(e){}
    me.stream=null; me.rec=null;
    me.userDur=me.user.length*0.04;
    var b=q(".dhwv-rec"); if(b){ b.textContent="🎙️ 2. Sen Oku"; b.classList.remove("on"); }
    if(me.coach.length) q(".dhwv-cmp").disabled=false;
    setStatus("Kaydın hazır. '3. Kıyasla' ile hocayla karşılaştır.","#4ade80");
  }

  function normEnv(d){ /* genlikleri kendi zirvesine göre 0-100'e ölçekle (mikrofon şiddeti farkını yok sayar) */
    var mx=0; for(var i=0;i<d.length;i++) if(d[i]>mx) mx=d[i];
    if(mx<=0) return d.slice();
    var out=[]; for(var j=0;j<d.length;j++) out.push(d[j]/mx*100);
    return out;
  }
  function pearson(a,b){
    var n=Math.min(a.length,b.length); if(n<3) return 0;
    var ma=0,mb=0,i;
    for(i=0;i<n;i++){ ma+=a[i]; mb+=b[i]; } ma/=n; mb/=n;
    var num=0,da=0,db=0;
    for(i=0;i<n;i++){ var x=a[i]-ma,y=b[i]-mb; num+=x*y; da+=x*x; db+=y*y; }
    var den=Math.sqrt(da*db);
    return den?num/den:0;
  }
  function levSim(a,b){ /* 0..1 harf benzerliği */
    a=String(a||""); b=String(b||"");
    if(!a.length||!b.length) return 0;
    if(a===b) return 1;
    var m=a.length,n=b.length,d=[],i,j;
    for(i=0;i<=m;i++) d[i]=[i];
    for(j=0;j<=n;j++) d[0][j]=j;
    for(i=1;i<=m;i++) for(j=1;j<=n;j++)
      d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    return 1-d[m][n]/Math.max(m,n);
  }
  function sozScore(heard,word){
    heard=String(heard||"").toLowerCase(); word=String(word||"").toLowerCase();
    if(!heard) return null;
    if(heard.indexOf(word)>=0) return 100;
    var best=0, toks=heard.split(/[^a-z']+/);
    for(var i=0;i<toks.length;i++){ var s=levSim(toks[i],word); if(s>best) best=s; }
    if(best>=0.8) return 100;                 /* pen/pan, this/these gibi çok yakın duyumlar */
    if(best>=0.5) return Math.round(60+best*40);
    return Math.round(40+best*40);
  }
  function compare(){
    var me=WV; if(!me||!me.coach.length||!me.user.length) return;
    var word=me.word;
    var sC=trim(me.coach), sU=trim(me.user);
    if(!sC.length||!sU.length){ setStatus("Ses algılanamadı — tekrar dene.","#f59e0b"); return; }
    var dC=sC.length*0.04, dU=sU.length*0.04;
    var nC=normEnv(sC), nU=normEnv(sU);
    var rU=resample(nU,nC.length);
    me.viewC=nC; me.viewU=rU; draw();
    var d1=q(".dhwv-durC"); if(d1) d1.textContent=dC.toFixed(1)+"s Net";
    var d2=q(".dhwv-durU"); if(d2) d2.textContent=dU.toFixed(1)+"s Net";
    /* Tempo: tek kelimede ±0.15s serbest, sonrası yumuşak ceza */
    var tolS=0.15, excess=Math.max(0,Math.abs(dC-dU)-tolS);
    var tempo=Math.max(0,Math.round(100-excess/Math.max(dC,0.2)*80));
    /* Şekil: normalize zarfların korelasyonu (şiddet farkından etkilenmez); r=1→100, r=0→50 */
    var r=Math.max(-1,Math.min(1,pearson(nC,rU)));
    var shape=Math.round(((r+1)/2)*100);
    /* Vurgu: zirve konumu, %12 kayma serbest */
    var mC=0,iC=0,mU=0,iU=0;
    for(var i=0;i<nC.length;i++){
      if(nC[i]>mC){mC=nC[i];iC=i;}
      if(rU[i]>mU){mU=rU[i];iU=i;}
    }
    var shift=Math.abs(iC-iU)/nC.length;
    var vurgu=shift<=0.12?100:Math.max(0,Math.round(100-(shift-0.12)*220));
    var soz=sozScore(me.heard,word);
    var genel=(soz!==null)
      ? Math.round(soz*0.4+shape*0.25+vurgu*0.15+tempo*0.2)
      : Math.round(shape*0.4+vurgu*0.25+tempo*0.35);
    var sc=q(".dhwv-score");
    if(sc){
      sc.style.display="inline-block"; sc.style.color="#03131c";
      if(genel>=85){ sc.textContent="Kusursuz 🌟 %"+genel; sc.style.background="#10b981"; }
      else if(genel>=65){ sc.textContent="İyi 👍 %"+genel; sc.style.background="#3b82f6"; sc.style.color="#fff"; }
      else{ sc.textContent="Gelişmeli 🎯 %"+genel; sc.style.background="#f59e0b"; }
    }
    var det="Şekil %"+shape+" • Tempo %"+tempo+" • Vurgu %"+vurgu+(soz!==null?" • Söz %"+soz:"");
    if(genel>=85) setStatus("🌟 "+det+" — dalgan hocayla neredeyse örtüşüyor.","#34d399");
    else if(genel>=65) setStatus("👍 "+det+" — Düet ile farkı dinleyip tekrar dene.","#60a5fa");
    else setStatus("🎯 "+det+" — hocayı dinle, ▶ Düet ile aynala.","#f59e0b");
  }

  function play(mode){
    var me=WV; if(!me) return;
    stopAudio();
    function coachA(){
      if(me.coachUrl){ var a=new Audio(me.coachUrl); me.playing.push(a); a.play().catch(function(){}); }
      else speakWord(me.word,0.78);
    }
    function userA(){
      if(me.userUrl){ var a=new Audio(me.userUrl); me.playing.push(a); a.play().catch(function(){}); }
    }
    if(mode==="coach") coachA();
    else if(mode==="user") userA();
    else { coachA(); userA(); } /* düet: birebir senkron */
  }

  /* ---------- popup'a enjeksiyon ---------- */
  function buildSection(word){
    var sec=document.createElement("div");
    sec.className="dhwv-box"; sec.id="dhwvSec";
    sec.innerHTML =
      '<div class="dhwv-head">🌊 Ses Dalgası Analizi</div>'
     +'<div class="dhwv-wave"><canvas></canvas></div>'
     +'<div class="dhwv-meta">'
       +'<span class="dhwv-dur">🎓 <span class="dhwv-durC">0.0s</span></span>'
       +'<span class="dhwv-dur">🎙️ <span class="dhwv-durU">0.0s</span></span>'
       +'<span class="dhwv-score"></span>'
     +'</div>'
     +'<div class="dhwv-row">'
       +'<button class="dhwv-coach">🎓 1. Hoca Çizdir</button>'
       +'<button class="dhwv-rec" disabled>🎙️ 2. Sen Oku</button>'
       +'<button class="dhwv-cmp" disabled>🔍 3. Kıyasla</button>'
     +'</div>'
     +'<div class="dhwv-row">'
       +'<button class="dhwv-play dhwv-playC" disabled>▶ Hoca</button>'
       +'<button class="dhwv-play dhwv-playU" disabled>▶ Sen</button>'
       +'<button class="dhwv-play dhwv-duet" disabled>▶ Düet</button>'
     +'</div>'
     +'<div class="dhwv-status">Önce \'1. Hoca Çizdir\'e dokunun — hocanın dalgası mavi, seninki yeşil çizilir.</div>';
    /* React tıklamayı overlay kapatma vb. için dinliyor olabilir — butonlarımız popup içinde,
       yine de yukarı sıçramasın diye durduruyoruz. */
    sec.addEventListener("click",function(e){ e.stopPropagation(); });
    sec.querySelector(".dhwv-coach").onclick=coach;
    sec.querySelector(".dhwv-rec").onclick=function(){ WV&&WV.recording ? stopRec() : record(); };
    sec.querySelector(".dhwv-cmp").onclick=compare;
    sec.querySelector(".dhwv-playC").onclick=function(){ play("coach"); };
    sec.querySelector(".dhwv-playU").onclick=function(){ play("user"); };
    sec.querySelector(".dhwv-duet").onclick=function(){ play("duet"); };
    return sec;
  }

  function ensure(){
    /* React kelime popup'ı: .wp-box içinde .wp-word */
    var box=document.querySelector(".wp-box");
    var wordEl=box?box.querySelector(".wp-word"):null;
    if(!box||!wordEl){ if(WV) cleanup(); return; }
    var word=(wordEl.textContent||"").trim();
    if(!word){ return; }
    var sec=box.querySelector("#dhwvSec");
    if(sec && WV && WV.word===word && WV.sec===sec) return; /* değişiklik yok */
    if(WV && WV.word!==word){ cleanup(); if(sec){ sec.remove(); sec=null; } } /* başka kelime → temiz kur */
    if(!sec){
      injectCSS();
      sec=buildSection(word);
      /* Telaffuz kutusundan (.pt-box) sonra; yoksa cümleler başlığından önce; o da yoksa sona */
      var pt=box.querySelector(".pt-box");
      var title=box.querySelector(".wp-section-title");
      if(pt&&pt.parentNode===box&&pt.nextSibling) box.insertBefore(sec,pt.nextSibling);
      else if(pt&&pt.parentNode===box) box.appendChild(sec);
      else if(title) box.insertBefore(sec,title);
      else box.appendChild(sec);
    }
    if(!WV||WV.sec!==sec||WV.word!==word){
      cleanup();
      WV={word:word,sec:sec,coach:[],user:[],viewC:[],viewU:[],coachUrl:null,userUrl:null,
          coachDur:0,userDur:0,timer:null,stream:null,rec:null,ctxA:null,sr:null,heard:"",
          recording:false,playing:[]};
      setTimeout(draw,60);
    }
  }

  function start(){
    var mo=new MutationObserver(function(){ ensure(); });
    mo.observe(document.body,{childList:true,subtree:true,characterData:true});
    ensure();
  }
  if(document.readyState!=="loading") start();
  else document.addEventListener("DOMContentLoaded",start);
})(window);
