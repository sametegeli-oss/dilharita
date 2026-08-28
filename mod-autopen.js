/* mod-autopen.js — AI KOÇ OTOMATİK MODÜL BAŞLATICI (v1, React uyumlu)
   koc.js günün planında "Yeni cümleler öğren" adımını
   index-app.html?mod=<MODÜL ADI> olarak üretir (örn: "A1-M01 Be Verb · P2").

   NOT: Eski başlatıcı (index-app1.html'de kalmış) startPractice() fonksiyonuna
   ve onclick özniteliklerine güveniyordu — bunlar derlenmiş React uygulamasında
   YOK. Bu sürüm React'e dokunmaz: modül adı kart başlığıyla birebir aynı
   olduğundan, metni ekranda bulur ve kartın tıklanabilir atasına click yollar
   (React'in kendi olay dinleyicisi tetiklenir). */
(function(){
  /* ziyaret defteri: koç aynı modüle üst üste yönlendirmesin diye */
  try{
    var __mv=new URLSearchParams(location.search).get("mod");
    if(__mv){
      var __vk="dh-mod-visited-v1", __vd=JSON.parse(localStorage.getItem(__vk)||"{}")||{};
      __vd[__mv]=new Date().toISOString().slice(0,10);
      localStorage.setItem(__vk, JSON.stringify(__vd));
    }
  }catch(e){}

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
    if(!b){
      var nav=document.querySelector(".study-nav"),buttons=nav&&nav.querySelectorAll("button.btn");
      if(buttons&&buttons.length)b=dir>0?buttons[buttons.length-1]:buttons[0];
    }
    if(b && !b.disabled){ b.click(); return true; }
    return false;
  }
  function staticModuleList(modName){
    return fetch("data/sentences/index.json")
      .then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(ix){
        var m=null, arr=(ix&&ix.modules)||[];
        for(var i=0;i<arr.length;i++) if(arr[i].mod===modName){ m=arr[i]; break; }
        if(!m) return null;
        return fetch("data/sentences/mod/"+m.f+".json")
          .then(function(r){ if(!r.ok) throw 0; return r.json(); });
      })
      .catch(function(){ return null; });
  }
  /* Modülün cümle listesini getirir (sırayla). Modül adı -> index -> parça. */
  function moduleList(modName){
    if(!window.DHModul)return staticModuleList(modName);
    var ready;
    try{ready=DHModul.hazir?DHModul.hazir():Promise.resolve();}catch(e){ready=Promise.resolve();}
    return ready.then(function(){
      try{
        var mine=DHModul.liste(),found=null;
        for(var u=0;u<mine.length;u++) if(mine[u].ad===modName){found=mine[u];break;}
        if(found)return DHModul.getir(found.id)||[];
      }catch(e){}
      return staticModuleList(modName);
    });
  }

  /* SIRA GÜDÜMLÜ YÜRÜYÜŞ.
     Eski sürüm metni bulmak için KÖR dolaşıyordu: 30 kez ileri, sonra 65 kez
     geri. Metin herhangi bir sebeple tutmazsa (React kartı cümleyi renkli
     parçalara böldüğü için textContent farklı gelebiliyor) uygulama rastgele
     bir cümlede kalıyordu — foto ve video ayrı cümleleri gösteriyordu.
     Veride modül adı ve sıra zaten var. Artık modülün listesi okunuyor,
     mevcut kartın ve hedefin SIRA NUMARASI bulunuyor, hedefe doğru TEK YÖNDE
     gidiliyor ve varınca duruluyor. Liste okunamazsa eski davranışa düşülür. */
  function walkToSentence(sentence){
    moduleList(target).then(function(list){
      if(!list || !list.length){ walkBlind(sentence); return; }
      var want=-1, wn=normS(sentence);
      for(var i=0;i<list.length;i++) if(normS(list[i].en)===wn){ want=i; break; }
      if(want<0) return;                       // hedef bu modülde yok: dokunma

      var t1=Date.now(), miss=0, navWait=0, sonYon=0, ayniKonum=0, oncekiKonum=-1;
      var wv=setInterval(function(){
        if(Date.now()-t1>30000){ clearInterval(wv); return; }
        var en=cardEn();
        if(!en) return;                        // kart henüz yüklenmedi
        var cur=-1, cn=normS(en);
        for(var j=0;j<list.length;j++) if(normS(list[j].en)===cn){ cur=j; break; }
        if(cur<0){                             // kart bu modülden değil
          if(++miss>12) clearInterval(wv);      // zorla dolaşmıyoruz
          return;
        }
        if(cur===want){ clearInterval(wv); return; }   // 🎯 vardık
        var yon = cur<want ? 1 : -1;
        if(sonYon && yon!==sonYon){ clearInterval(wv); return; }  // salınım koruması
        sonYon=yon;
        if(!navClick(yon)){ if(++navWait>40)clearInterval(wv); return; }
        navWait=0;
        /* Yalnız gerçek bir gezinme tıklamasından sonra ilerlemeyi ölç.
           Kontroller henüz oluşmadıysa aynı kartta beklemek hata değildir. */
        if(cur===oncekiKonum){ if(++ayniKonum>12){ clearInterval(wv); return; } }
        else { ayniKonum=0; oncekiKonum=cur; }
      }, 300);
    });
  }

  /* Eski kör yürüyüş — yalnızca modül listesi okunamazsa yedek olarak. */
  function walkBlind(sentence){
    var want=normS(sentence), t1=Date.now();
    var phase=0, steps=0;
    var wv=setInterval(function(){
      if(Date.now()-t1>30000){ clearInterval(wv); return; }
      var en=cardEn();
      if(!en) return;
      if(normS(en)===want){ clearInterval(wv); return; }
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
