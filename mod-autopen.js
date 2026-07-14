/* mod-autopen.js — AI KOÇ OTOMATİK MODÜL BAŞLATICI (v1, React uyumlu)
   koc.js günün planında "Yeni cümleler öğren" adımını
   index-app.html?mod=<MODÜL ADI> olarak üretir (örn: "A1-M01 Be Verb · P2").

   NOT: Eski başlatıcı (index-app1.html'de kalmış) startPractice() fonksiyonuna
   ve onclick özniteliklerine güveniyordu — bunlar derlenmiş React uygulamasında
   YOK. Bu sürüm React'e dokunmaz: modül adı kart başlığıyla birebir aynı
   olduğundan, metni ekranda bulur ve kartın tıklanabilir atasına click yollar
   (React'in kendi olay dinleyicisi tetiklenir). */
(function(){
  "use strict";
  var mod="", q="";
  try{
    var sp=new URLSearchParams(location.search);
    mod=sp.get("mod")||""; q=sp.get("q")||"";   // q: modül açıldıktan sonra gidilecek CÜMLE
  }catch(e){}
  if(!mod) return;
  var target=mod.trim();
  var level=(target.match(/^([ABC][12])/i)||[])[1]||"";
  var t0=Date.now(), clickedLevel=false, done=false;

  /* Metni TAM eşleşen en derin (en küçük) öğeyi bul */
  function findByText(s){
    var all=document.querySelectorAll("#root *");
    var best=null, bestSize=Infinity;
    for(var i=0;i<all.length;i++){
      var el=all[i];
      if(((el.textContent||"").trim())===s){
        var size=el.getElementsByTagName("*").length;
        if(size<bestSize){ best=el; bestSize=size; }
      }
    }
    return best;
  }
  /* Tıklanabilir atayı bul (cursor:pointer olan kart kabuğu) */
  function clickableAncestor(el){
    var n=el, hops=0;
    while(n && hops++<7){
      try{ if(getComputedStyle(n).cursor==="pointer") return n; }catch(e){}
      n=n.parentElement;
    }
    return el.parentElement||el;
  }

  /* 🚶 Modül açıldıktan sonra hedef cümleye adım adım git.
     dhNavTrio'nun (index-app-layout) Önceki/Sonraki proxy butonlarını kullanır;
     React kaldığın yerden açabileceği için önce ileri, bulamazsa geri tarar. */
  function normS(t){ return String(t||"").toLowerCase().replace(/[^a-z0-9ğüşöçıi]+/g," ").trim(); }
  function cardEn(){ var el=document.querySelector(".card .card-en"); return el?el.textContent.trim():""; }
  function navClick(dir){
    var b=document.querySelector("#dhNavTrio "+(dir>0?".dh-nav-next":".dh-nav-prev"));
    if(b && !b.disabled){ b.click(); return true; }
    return false;
  }
  function walkToSentence(sentence){
    var want=normS(sentence), t1=Date.now();
    var phase=0, steps=0;            // phase 0: kart bekleniyor · 1: ileri · 2: geri
    var wv=setInterval(function(){
      if(Date.now()-t1>30000){ clearInterval(wv); return; }
      var en=cardEn();
      if(!en) return;                          // kart görünümü henüz yüklenmedi
      if(normS(en)===want){ clearInterval(wv); return; }   // 🎯 bulundu
      if(phase===0){ phase=1; steps=0; }
      if(phase===1){
        if(steps++>=30 || !navClick(1)){ phase=2; steps=0; }
      } else if(phase===2){
        if(steps++>=65 || !navClick(-1)){ clearInterval(wv); }
      }
    }, 300);
  }

  var iv=setInterval(function(){
    if(done) { clearInterval(iv); return; }
    if(Date.now()-t0>15000){ clearInterval(iv); return; } // 15 sn'de bulunamazsa sessizce vazgeç
    var hit=findByText(target);
    if(hit){
      done=true; clearInterval(iv);
      var card=clickableAncestor(hit);
      try{ card.scrollIntoView({block:"center"}); }catch(e){}
      try{ card.click(); }catch(e){}
      if(q) walkToSentence(q);          // 🚶 2. faz: modül içinde cümleye yürü
      return;
    }
    /* Kart görünmüyorsa hedef seviyenin sekmesine geçmeyi bir kez dene
       (örn. A2 modülü istendi ama ekranda A1 listesi açık) */
    if(level && !clickedLevel){
      var lv=findByText(level);
      if(lv){ clickedLevel=true; try{ clickableAncestor(lv).click(); }catch(e){} }
    }
  }, 400);
})();
