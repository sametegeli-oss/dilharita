/* brick-progress.js — YÜZER TUĞLA İLERLEME WIDGET'I (tüm sayfalarda tek dosya)
   coach-bubble.js bunu otomatik yükler. dh-study-tracker-v1'i (bugünkü cümle+tekrar+ders)
   izler; her tamamlamada yandaki tuğla düşer + hoş ses. G'lik turlar; tur dolunca kutlama + yeniden dolar.
   tekrar.html'in kendi oturum şeridi (#revBricks) varsa bu widget kendini gizler. */
(function(){
  if(window.__dhBrickWidget) return; window.__dhBrickWidget=true;
  if(document.getElementById("revBricks")) return;   // sayfanın kendi tuğla şeridi varsa çakışma yok

  function today(){ return new Date().toISOString().slice(0,10); }
  function goal(){ var g=10; try{ if(window.DHProfile&&DHProfile.hedef) g=DHProfile.hedef()||10; }catch(e){} g=parseInt(g,10)||10; return Math.max(5,Math.min(20,g)); }
  function todayItems(){ try{ var t=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}; var d=(t.days||{})[today()]||{}; return (d.sentences||0)+(d.reviews||0)+(d.lessons||0); }catch(e){ return 0; } }

  function tone(freq,dur){ try{ var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; var ctx=window.__dhAC||(window.__dhAC=new AC()); if(ctx.state==="suspended"){try{ctx.resume();}catch(e){}} var t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain(); o.type="triangle"; o.frequency.value=freq; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.18,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.start(t); o.stop(t+dur+0.02);}catch(e){} }
  function chime(){ tone(659.25,0.3); }
  function fanfare(){ [523,659,784,1047].forEach(function(f,k){ setTimeout(function(){ tone(f,0.4); }, k*90); }); }

  var G=goal(), wrap=null, lbl=null, shown=0;
  function css(){ var s=document.createElement("style"); s.textContent=
    ".dhbw{position:fixed;left:8px;top:50%;transform:translateY(-50%);z-index:2147482800;display:flex;flex-direction:column;gap:3px;align-items:center;padding:7px 6px;background:rgba(7,18,38,.55);border:1px solid #ffffff1f;border-radius:13px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}"
    +".dhbw .bw-b{width:20px;height:12px;border-radius:3px;background:linear-gradient(180deg,#f59e0b,#b45309);box-shadow:inset 0 -2px 0 #7c2d12;transition:none}"
    +".dhbw .bw-b.f{opacity:.14;transform:translateX(-15px) rotate(-14deg);background:linear-gradient(180deg,#3b5170,#22344f);box-shadow:none}"
    +".dhbw .bw-b.drop{animation:bwDrop .5s cubic-bezier(.4,1.3,.6,1) both}"
    +"@keyframes bwDrop{0%{opacity:1;transform:translateX(0) rotate(0)}100%{opacity:.14;transform:translateX(-15px) rotate(-14deg)}}"
    +".dhbw .bw-l{font:800 10px system-ui,sans-serif;color:#e8eef7;margin-top:3px;letter-spacing:.02em}";
    (document.head||document.documentElement).appendChild(s);
  }
  function build(){ wrap=document.createElement("div"); wrap.className="dhbw";
    for(var k=0;k<G;k++){ var b=document.createElement("div"); b.className="bw-b"; wrap.appendChild(b); }
    lbl=document.createElement("div"); lbl.className="bw-l"; wrap.appendChild(lbl);
    (document.body||document.documentElement).appendChild(wrap);
  }
  function setLbl(total){ var inRound=(total>0 && total%G===0)?G:(total%G); if(lbl) lbl.textContent="🧱 "+inRound+"/"+G; }
  function paintInstant(total){ shown=total; var f=total%G; for(var k=0;k<G;k++){ wrap.children[k].className="bw-b"+(k<f?" f":""); } setLbl(total); }
  function step(total){
    while(shown<total){
      var idx=shown%G;
      if(idx===0 && shown>0){ for(var k=0;k<G;k++) wrap.children[k].className="bw-b"; }  // yeni tur: duvar yeniden dolar
      var b=wrap.children[idx]; if(b) b.className="bw-b drop";
      chime(); shown++;
      if(shown%G===0){ setTimeout(fanfare,140); }
    }
    setLbl(total);
  }
  function poll(){ var t=todayItems(); if(t>shown) step(t); else if(t<shown) paintInstant(t); }
  function init(){ css(); build(); paintInstant(todayItems()); setInterval(poll,1200);
    document.addEventListener("visibilitychange",function(){ if(!document.hidden) poll(); });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
