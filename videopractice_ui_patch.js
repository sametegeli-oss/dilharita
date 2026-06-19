/* videopractice_ui_patch.js
   VideoPractice ekranını sadeleştirir ve avatar/ses tekrar senkronunu güçlendirir.
   Kullanım: videopractice.html içinde </body> öncesine ekle:
   <script src="./videopractice_ui_patch.js"></script>
*/
(function(){
  'use strict';

  function injectStyle(){
    if(document.getElementById('vp-ui-compact-patch-style')) return;
    var style=document.createElement('style');
    style.id='vp-ui-compact-patch-style';
    style.textContent = `
      /* Kırmızıyla işaretlenen üst/alt öğretim süsleri kaldırıldı */
      .teach-head,
      .teach-listen,
      .teach-hint{display:none!important}

      /* Video daha çok görünsün: kart inceltildi ve aşağı alındı */
      .teach-overlay{
        bottom:88px!important;
        top:auto!important;
        left:50%!important;
        transform:translateX(-50%)!important;
        width:min(380px,calc(100vw - 24px))!important;
        padding:10px 13px 12px!important;
        gap:7px!important;
        border-radius:18px!important;
        background:rgba(7,12,24,.52)!important;
        backdrop-filter:blur(6px)!important;
        -webkit-backdrop-filter:blur(6px)!important;
      }
      .teach-overlay .avatar,
      .avatar#teachAvatar{
        width:96px!important;
        height:96px!important;
        min-width:96px!important;
        min-height:96px!important;
        margin-top:0!important;
      }
      .teach-overlay .avatar svg,
      .avatar#teachAvatar svg{
        width:72px!important;
        height:72px!important;
      }
      .karaoke{font-size:clamp(17px,2.1vw,23px)!important;line-height:1.28!important;gap:4px 7px!important}
      .teach-tr{font-size:13px!important;line-height:1.32!important;margin-top:-2px!important}

      /* Mikrofon artık diğer butonlarla aynı ölçeğe yakın */
      .controls{
        bottom:14px!important;
        align-items:center!important;
        grid-template-columns:1fr auto 1fr!important;
      }
      .mic-main{
        width:52px!important;
        height:52px!important;
        border-width:2px!important;
        font-size:23px!important;
        box-shadow:0 8px 22px rgba(0,0,0,.30)!important;
      }
      .mic-caption{font-size:11px!important;margin-top:4px!important;line-height:1.15!important}
      .ctrl{font-size:12px!important;gap:4px!important}
      .ctrl-ico{width:42px!important;height:42px!important;font-size:21px!important}
      .next-float{min-height:42px!important;padding:9px 13px!important;top:64px!important}
      .api-float{padding:8px 12px!important;top:66px!important}
      .small-note{display:none!important}

      @media(max-width:640px){
        .teach-overlay{
          bottom:78px!important;
          width:min(350px,calc(100vw - 18px))!important;
          padding:8px 10px 10px!important;
          gap:5px!important;
        }
        .teach-overlay .avatar,
        .avatar#teachAvatar{
          width:84px!important;
          height:84px!important;
          min-width:84px!important;
          min-height:84px!important;
        }
        .teach-overlay .avatar svg,
        .avatar#teachAvatar svg{
          width:62px!important;
          height:62px!important;
        }
        .karaoke{font-size:clamp(15px,4.4vw,20px)!important;line-height:1.25!important}
        .teach-tr{font-size:12px!important}
        .controls{bottom:12px!important;grid-template-columns:1fr 58px 1fr!important}
        .mic-main{width:48px!important;height:48px!important;font-size:21px!important}
        .mic-caption{display:none!important}
        .ctrl-ico{width:40px!important;height:40px!important;font-size:20px!important}
        .next-float{top:auto!important;bottom:78px!important;right:10px!important;min-width:96px!important;min-height:40px!important;padding:8px 11px!important}
        .api-float{top:auto!important;bottom:78px!important;left:10px!important;padding:8px 11px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function mouthPath(shape){
    var paths={
      rest:'M37 66 Q50 70 63 66 Q50 72 37 66 Z',
      open:'M36 64 Q50 60 64 64 Q50 78 36 64 Z',
      round:'M44 64 Q50 60 56 64 Q56 74 50 76 Q44 74 44 64 Z',
      wide:'M34 66 Q50 64 66 66 Q50 71 34 66 Z',
      closed:'M38 66 Q50 65 62 66 Q50 67 38 66 Z',
      teeth:'M40 64 Q50 62 60 64 Q50 72 40 64 Z'
    };
    return paths[shape]||paths.rest;
  }
  function viseme(ch){
    ch=String(ch||'').toLowerCase();
    if('aeâ'.indexOf(ch)>=0) return 'open';
    if('ou'.indexOf(ch)>=0) return 'round';
    if('ıiüöy'.indexOf(ch)>=0) return 'wide';
    if('mbp'.indexOf(ch)>=0) return 'closed';
    if('fv'.indexOf(ch)>=0) return 'teeth';
    return 'rest';
  }

  var runId=0, timers=[];
  function clearTimers(){
    timers.forEach(function(t){clearTimeout(t)});
    timers=[];
  }
  function setMouth(shape){
    var m=document.getElementById('avMouth');
    if(m) m.setAttribute('d', mouthPath(shape));
  }
  function stopAvatar(){
    runId++;
    clearTimers();
    var a=document.getElementById('teachAvatar');
    if(a) a.classList.remove('speaking');
    setMouth('rest');
  }
  function animateAvatarForText(text, estimatedMs){
    stopAvatar();
    var local=++runId;
    var a=document.getElementById('teachAvatar');
    if(a) a.classList.add('speaking');
    text=String(text||'');
    if(!text){return;}
    var chars=text.split('');
    var per=Math.max(55, Math.min(125, (estimatedMs||Math.max(1200, chars.length*82))/Math.max(chars.length,1)));
    chars.forEach(function(ch,i){
      timers.push(setTimeout(function(){
        if(local!==runId) return;
        setMouth(viseme(ch));
      }, i*per));
    });
    timers.push(setTimeout(function(){
      if(local!==runId) return;
      var av=document.getElementById('teachAvatar');
      if(av) av.classList.remove('speaking');
      setMouth('rest');
    }, chars.length*per+180));
  }

  function hookSpeech(){
    if(!window.speechSynthesis || window.speechSynthesis.__vpAvatarHooked) return;
    var synth=window.speechSynthesis;
    var originalSpeak=synth.speak.bind(synth);
    var originalCancel=synth.cancel.bind(synth);
    synth.speak=function(utterance){
      try{
        var text=(utterance && utterance.text) || '';
        var oldStart=utterance.onstart;
        var oldEnd=utterance.onend;
        var oldErr=utterance.onerror;
        utterance.onstart=function(ev){
          animateAvatarForText(text, Math.max(1200, String(text).length*82));
          if(typeof oldStart==='function') oldStart.call(this,ev);
        };
        utterance.onend=function(ev){
          stopAvatar();
          if(typeof oldEnd==='function') oldEnd.call(this,ev);
        };
        utterance.onerror=function(ev){
          stopAvatar();
          if(typeof oldErr==='function') oldErr.call(this,ev);
        };
        // Mobilde onstart gecikebilir; ses başlarken avatar da hemen başlasın.
        animateAvatarForText(text, Math.max(1200, String(text).length*82));
      }catch(e){}
      return originalSpeak(utterance);
    };
    synth.cancel=function(){
      stopAvatar();
      return originalCancel();
    };
    synth.__vpAvatarHooked=true;
  }

  function compactDom(){
    document.querySelectorAll('.teach-head,.teach-listen,.teach-hint').forEach(function(el){el.remove();});
    var mic=document.getElementById('micBtn');
    if(mic){ mic.setAttribute('aria-label','Mikrofon'); }
  }

  function init(){
    injectStyle();
    hookSpeech();
    compactDom();
    document.addEventListener('click',function(ev){
      var replay=ev.target && ev.target.closest && ev.target.closest('#replayBtn');
      if(replay){
        stopAvatar();
        // İçerideki replayCurrent konuşmayı başlatacak; speech hook avatarı eş zamanlı başlatacak.
      }
    }, true);
    var mo=new MutationObserver(function(){compactDom();});
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
