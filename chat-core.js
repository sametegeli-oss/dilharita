(function(){
"use strict";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const KEYS_LS = "groqApiKeys";
const STT = window.SpeechRecognition || window.webkitSpeechRecognition;
const DEFAULT_SCENARIO = {
  title:"Otel",
  subtitle:"İngilizce konuşma",
  level:"A2",
  role:"a friendly hotel receptionist",
  voiceGender:"male",
  opener:"Hello, welcome to our hotel. Do you have a reservation?",
  systemExtra:"You are role-playing as a friendly hotel receptionist at the front desk.",
  avatarDir:"assets/avatars_v3/hotel/",
  frames:{
    idle:"idle.webp", blink:"blink.webp", listen:"listen.webp",
    mouthA:"mouth-a.webp", mouthE:"mouth-e.webp", mouthI:"mouth-i.webp",
    mouthO:"mouth-o.webp", mouthU:"mouth-u.webp", mouthMBP:"mouth-mbp.webp",
    mouthFV:"mouth-fv.webp", mouthL:"mouth-l.webp", mouthTH:"mouth-th.webp",
    mouthSmall:"mouth-i.webp", mouthMedium:"mouth-e.webp", mouthOpen:"mouth-a.webp"
  },
  backHref:"chat.html",
  noKeyReply:"I can continue when you add a Groq API key. What would you like to practice?"
};
const Scenario = Object.assign({}, DEFAULT_SCENARIO, window.CHAT_SCENARIO || {});
Scenario.voiceGender = "male";
Scenario.frames = Object.assign({}, DEFAULT_SCENARIO.frames, (window.CHAT_SCENARIO && window.CHAT_SCENARIO.frames) || {});
/* KOÇ BEYNİ: öğretmen senaryosu mu? (koç planı/hedefi YALNIZ öğretmene aktarılır —
   otel resepsiyonisti öğrencinin çalışma planını bilirse rol bozulur) */
var __dhIsTeacher = /teacher|öğretmen|ogretmen/i.test((Scenario.title||"") + " " + (Scenario.role||""));
/* Koç balonundan "?focus=hataTürü" ile gelinirse bu oturum o hataya odaklanır */
var __dhFocus = ""; try{ __dhFocus = new URLSearchParams(location.search).get("focus") || ""; }catch(e){}
/* Antrenmandan gelen SOMUT hata bağlamı (cümle, yanlış, kural) — öğretmen boş
   karşılama yerine doğrudan o hatayı öğretmeye başlar */
var __dhTeach=null; try{
  var __tRaw=sessionStorage.getItem("dh-teach-focus");
  if(__tRaw){ __dhTeach=JSON.parse(__tRaw); if(!__dhTeach||Date.now()-(__dhTeach.t||0)>2*3600000) __dhTeach=null; }
}catch(e){}
/* Anlamsız plan etiketleri ("review", "tekrar"…) konu adı değildir — bunlarla
   "practice review" gibi boş bir açılış kurulmamalı. */
var __dhJunkFocus=/^(review|tekrar|practice|pratik|study|genel|general|plan|devam)$/i;
if(__dhFocus && __dhJunkFocus.test(__dhFocus)) __dhFocus="";
/* ── TEK PERSONA: OGRETMEN ──────────────────────────────────────────
   Eskiden burada su vardi:
       if(!__dhIsTeacher){ __dhTeach=null; __dhFocus=""; }
   Yani hata defterinden gelen SOMUT hata ve kocun gonderdigi odak, rol
   senaryolarinda (garson, resepsiyonist, doktor) BILEREK siliniyordu —
   "rol bozulmasin" diye. Sonuc: en degerli ogretme malzemesi o
   sayfalara hic ulasmiyordu ve garson ogretemiyordu; iki tur prompt
   sikistirmasina ragmen anlatmaya devam etti.
   YENI YAPI: konusmayi HER SAYFADA ogretmen yurutur. Senaryo artik
   asistanin KIMLIGI degil, ogretmenin gerektiginde CANLANDIRDIGI rol
   ve dersin gectigi ortamdir. Boylece malzeme her yerde kullanilabilir. */
var __dhRol = (Scenario.role || "").trim();      /* ogretmenin canlandiracagi karakter (EN) */
/* Rolun TURKCE adi. Prompt'ta Turkce cumlenin icine Ingilizce rol tanimi
   konunca model onu aynen kopyaliyor: "Şimdi ben a friendly male waiter in
   a restaurant olayım" (ekranda gorulen kusur). Turkce etiket senaryonun
   basligindan turetilir. */
/* TEMBEL: __dhMalzeme bu satirdan SONRA tanimlaniyor; erken hesaplanirsa
   ortam bilgisi henuz yok ve rol hep "karsindaki kisi" cikiyordu (olculdu). */
var __dhRolTrOnbellek = null;
function dhRolTr(){
  if (__dhRolTrOnbellek) return __dhRolTrOnbellek;
  var t = ((Scenario.title||"") + " " + (Scenario.role||"")
         + " " + ((__dhMalzeme&&__dhMalzeme.senaryoAd)||"")
         + " " + ((__dhMalzeme&&__dhMalzeme.ortam)||"")
         + " " + ((__dhMalzeme&&__dhMalzeme.konu)||"")).toLocaleLowerCase("tr");
  var r = "karşındaki kişi";
  if(/otel|hotel|resepsiyon|reception/.test(t)) r = "otel resepsiyonisti";
  else if(/restoran|restaurant|garson|waiter/.test(t)) r = "garson";
  else if(/doktor|doctor|sağlık|saglik|health/.test(t)) r = "doktor";
  else if(/havaalan|airport|check-in|ucus|uçuş/.test(t)) r = "havaalanı görevlisi";
  else if(/mağaza|magaza|shop|store|satıcı|satici|shopping/.test(t)) r = "satıcı";
  __dhRolTrOnbellek = r;
  return r;
}
/* ── DERS yalnizca OGRETMEN sayfasinda ──────────────────────────────
   Koc adimi artik chat.html'e hic ugramadan dogrudan ogretmen ekranina
   gidiyor (bkz. index.html). Dolayisiyla senaryo sayfalarinin (Otel,
   Restoran, Doktor, Havaalani) ogretmene donusmesine gerek YOK: onlar
   ESKI hallerinde kalir — karakter kendisidir, bastan sona Ingilizce.
   "Diger avatarlarla chatler bozulmamali" sarti boyle korunuyor.
   Ders, ortam ve gunun cumleleri OGRETMEN ekraninda yasar. */
var __dhDersModu = __dhIsTeacher;
/* Disari ac: dh-sohbet-puan.js "gunun cumleleri" seridini ve puan
   bilesenini yalnizca ders modunda gostersin. Rol senaryolarinda
   malzeme zaten asagida temizleniyor (satir ~115); serit de o yuzden
   cikmamali, yoksa ulasilmasi imkansiz bir hedef gosterilmis olur. */
try{ window.__dhDersModuAktif = __dhDersModu; }catch(e){}
var __dhRolluMu = false;                          /* senaryo sayfasi rol oynatmaz */

/* ── GUNUN MALZEMESI (dh-konusma.js) ────────────────────────────────
   COZULEN SIKAYET: "1 dakika konus hergun ayni yere sifirdan basliyor;
   kendisi ogrenilen cumlelere gore konusma baslatmali."
   Sebep asagidaki genFreshOpener(): her acilista AI'dan BILEREK rastgele
   ve "taze" bir gunluk konu istiyor. Uygulamada calisilan cumlelerin
   konusmaya hicbir etkisi yoktu.

   Malzeme UCUNCU kaynak olarak eklenir; oncelik sirasi degismez:
     1) dh-teach-focus  (hata defterinden gelen SOMUT hata)
     2) ?focus=         (koc bir hata turu yolladi)
     3) gunun malzemesi (bugun calisilan cumleler)   <-- YENI
     4) hicbiri yoksa   eski davranis (genFreshOpener)

   NEDEN localStorage: bu dosya SENKRON aciliyor (State.currentPartner
   yuklenirken __dhOpener() cagriliyor), IndexedDB'yi burada beklemek
   mumkun degil. Hesabi dh-konusma.js onceden yapip donduruyor. */
var __dhMalzeme=null; try{
  var __mRaw=localStorage.getItem("dh-konusma-gun-"+new Date().toISOString().slice(0,10));
  if(__mRaw){
    var __m=JSON.parse(__mRaw);
    /* dh-konusma.js kaydi {s:<surum>, v:<malzeme>} olarak sarmalar; ac. */
    if(__m && typeof __m==="object" && __m.s && __m.v!==undefined) __m=__m.v;
    if(__m && __m.cumleler && __m.cumleler.length) __dhMalzeme=__m;
  }
}catch(e){}
/* Serbest senaryo sohbetinde ne gunun malzemesi ne de kocun odagi
   kullanilir — senaryo eski haliyle, rol bozulmadan calisir. */
if(!__dhDersModu){ __dhMalzeme=null; __dhTeach=null; __dhFocus=""; }

/* ── KARMA GUN SONU PRATIGI (dh-gun-sonu.js) ────────────────────────
   Gunu Kapat panelindeki "Ogretmenle karma pratik yap" dugmesi bu
   sayfayi ?gunsonu=1 ile aciyor ve harmani localStorage'a birakiyor.
   O harman gunun normal malzemesini EZER: kapanista amac tek bir
   modulun cumleleri degil, gun icinde calisilan HER SEYI (cumle +
   kalip + kelime) tek konusmada urettirmek. */
var __dhGunSonu=false;
try{
  var __gs = new URLSearchParams(location.search).get("gunsonu");
  if(__gs==="1" && __dhDersModu){
    var __gsRaw=localStorage.getItem("dh-gunsonu-"+new Date().toISOString().slice(0,10));
    if(__gsRaw){
      var __h=JSON.parse(__gsRaw);
      if(__h && ((__h.cumleler&&__h.cumleler.length) || (__h.kelimeler&&__h.kelimeler.length))){
        __dhMalzeme = {
          modul:  "gün sonu",
          konu:   "bugün çalıştıkların",
          ortam:  (__h.cumleler&&__h.cumleler[0]&&__h.cumleler[0].ortam) || "",
          cumleler: __h.cumleler||[],
          kelimeler: __h.kelimeler||[],
          kaliplar: __h.kaliplar||[],
          kaynak: "bugun",
          gunSonu: true
        };
        __dhGunSonu=true;
      }
    }
  }
}catch(e){}
/* Somut hata her zaman onceliklidir: ikisi birden varsa malzeme beklemeye alinir. */
if(__dhTeach && __dhTeach.target) __dhMalzeme=null;
if(__dhFocus) __dhMalzeme=null;

/* Acilis metni: dunku konuyu anar (sureklilik), bugunun ilk cumlesini
   ortaya koyar. DIL senaryoya gore degisir:
     ogretmen  -> Turkce cerceve (dh-teach-focus acilisiyla ayni uslup)
     rol       -> Ingilizce ve ROL ICINDE; resepsiyonistin Turkce konusmasi
                  rolu bozar (chat-core zaten bu yuzden koc odagini rol
                  senaryolarindan temizliyor). */
function __dhMalzemeOpener(){
  var m=__dhMalzeme, kac=m.cumleler.length;

  /* KARMA GUN SONU: ilerleme defteri gunun NORMAL malzemesine ait,
     buradaki cumleler baska bir kume. Defteri uygulamak yanlis olur. */
  if(m.gunSonu){
    var kw=(m.kelimeler||[]).slice(0,8);
    return "Günü kapatıyoruz 🌙 Bugün " + kac + " cümle"
      + (kw.length ? (" ve " + (m.kelimeler||[]).length + " kelime") : "")
      + " çalışmışsın. Şimdi hepsini tek konuşmada harmanlayalım.\n"
      + (kw.length ? ("Bugünün kelimeleri: " + kw.join(", ") + "\n") : "")
      + "İlk kalıbımız şu:\n"
      + (kac ? (m.cumleler[0].en + (m.cumleler[0].tr ? ("\n(" + m.cumleler[0].tr + ")") : ""))
             : "Bugün öğrendiğin kelimelerden biriyle bir cümle kur.")
      + "\nSen söylesen nasıl söylersin?";
  }

  /* KALDIGIN YERDEN — COZULEN SIKAYET:
     "Bitirmeme ragmen cikip tekrar girdigimde ayni konuya tekrar
      basliyor." Sebep: burasi her acilista cumleler[0]'dan basliyordu.
     Artik gunun ilerleme defteri okunur (dh-konusma.js) ve henuz
     URETILMEMIS ilk cumleden devam edilir. Hepsi uretildiyse defter
     gunu "bitti" isaretler; bir sonraki giriste dh-konusma YENI
     malzeme hesaplar, yani buraya zaten taze cumleler gelir. */
  var yapilan = [];
  try{
    if(window.DHKonusma && window.DHKonusma.ilerleme)
      yapilan = window.DHKonusma.ilerleme().yapilan || [];
  }catch(e){}
  var kalanlar = m.cumleler.filter(function(c){
    return c.id==null || yapilan.indexOf(String(c.id))<0;
  });
  var devamMi  = kalanlar.length>0 && kalanlar.length<kac;
  var hepsiOk  = kac>0 && kalanlar.length===0;

  /* Hepsi uretilmisse gunu BURADA da tamamlanmis isaretle. dh-sohbet-puan.js
     seridi cizerken de isaretliyor ama o dosya her sayfada yuklu olmayabilir
     ve serit yalnizca 4 sn'de bir calisiyor. Bayrak kurulmazsa dh-konusma
     yeni malzeme hesaplamaz ve kullanici ayni konuyla karsilasir. */
  if(hepsiOk){
    try{ if(window.DHKonusma && window.DHKonusma.bitir) window.DHKonusma.bitir(); }catch(e){}
  }
  var ilk = kalanlar.length ? kalanlar[0] : m.cumleler[0];

  var konu = m.konu || m.modul;
  var dunVar = !!(m.dun && m.dun.konu && m.dun.konu!==m.konu);

  if(__dhIsTeacher){
    var neKadar = (m.kaynak==="bugun") ? ("bugün " + kac + " cümle notladın")
                : (m.kaynak==="hafta") ? ("bu hafta " + kac + " cümle çalıştın")
                : ("daha önce " + kac + " cümle öğrendin");
    if(hepsiOk){
      /* Malzeme tamamlandi ama henuz tazelenmedi (bu sayfada DHSent yok,
         yeni secim ana ekranda yapiliyor). Ayni acilisi tekrar okumak
         yerine durumu soyle. */
      return "Bugünün " + kac + " cümlesini bitirdik, " + konu + " tamam. 👏\n"
        + "Menüye dönüp tekrar gelirsen yeni cümlelerle devam ederiz.\n"
        + "İstersen şimdi serbest pratik yapalım — bugün öğrendiklerinle "
        + "bir şey anlat, ben düzelteyim.";
    }
    if(devamMi){
      return "Kaldığımız yerden devam ediyoruz — " + konu + ", "
        + (kac - kalanlar.length) + "/" + kac + " tamam.\n"
        + "Sıradaki cümle:\n" + ilk.en + (ilk.tr ? ("\n(" + ilk.tr + ")") : "")
        + "\nSen söylesen nasıl söylersin?";
    }
    return (dunVar ? ("Dün " + m.dun.konu + " çalışmıştık. ") : "")
      + "Bugün " + konu + " üzerine konuşalım — " + neKadar + ".\n"
      + (m.ortam ? ("Ortam: " + m.ortam + ".\n") : "")
      + "Şu cümleyle başlıyoruz:\n" + ilk.en + (ilk.tr ? ("\n(" + ilk.tr + ")") : "")
      + "\nSen söylesen nasıl söylersin?";
  }
  /* Senaryo sayfasi da OGRETMEN acilisiyla baslar; sahne yalnizca dersin
     gectigi ortamdir. Once ne calisacagimizi soyler, sonra ilk cumleyi verir. */
  if(hepsiOk){
    return "Bugünün " + kac + " kalıbını bitirdik. 👏 Menüye dönüp tekrar "
      + "gelirsen yeni cümlelerle devam ederiz. İstersen şimdi serbest "
      + "pratik yapalım — " + (m.ortam ? ("ortam: " + m.ortam + "; ") : "")
      + "İngilizce bir şey anlat, ben " + dhRolTr() + " olup karşılık vereyim.";
  }
  if(devamMi){
    return "Kaldığımız yerden devam — " + konu + ", "
      + (kac - kalanlar.length) + "/" + kac + " tamam.\n"
      + "Sıradaki kalıp:\n" + "[[" + ilk.en + "]]"
      + (ilk.tr ? ("\n(" + ilk.tr + ")") : "")
      + "\nSen söylesen nasıl söylerdin? İngilizce yaz, sonra "
      + "ben " + dhRolTr() + " olup deneriz.";
  }
  return (dunVar ? ("Dün " + m.dun.konu + " çalışmıştık. ") : "")
    + "Bugün " + konu + " çalışıyoruz"
    + (m.ortam ? (" — ortam: " + m.ortam) : "")
    + "; " + kac + " cümle notlamıştın.\n"
    + "İlk kalıbımız şu:\n" + "[[" + ilk.en + "]]"
    + (ilk.tr ? ("\n(" + ilk.tr + ")") : "")
    + "\nSen söylesen nasıl söylerdin? İngilizce yaz, sonra "
    + "ben " + dhRolTr() + " olup deneriz.";
}
function __dhOpener(){
  if(__dhTeach&&__dhTeach.target){
    var head = __dhTeach.from==="coach"
      ? ("Koçun seni bugünün eksiğine çalışmaya gönderdi"+(__dhTeach.label?(" — konu: "+__dhTeach.label):"")+".\nDefterinden aldığım örnek:\n")
      : "Welcome back! I heard you struggled with this sentence in your drill:\n";
    return head
      +(__dhTeach.answer?("✗ "+__dhTeach.answer+"\n"):"")
      +"✓ "+__dhTeach.target
      +(__dhTeach.tip?("\n(Kural: "+__dhTeach.tip+")"):"")
      +"\nLet's master it together. First, you try: "
      +(__dhTeach.tr?("translate this into English — \""+__dhTeach.tr+"\""):"write the correct sentence yourself.");
  }
  if(__dhFocus) return "Your coach sent you to practice \""+__dhFocus+"\" with me. Let's work on it together! I'll give you short prompts — first, write any sentence using this pattern.";
  if(__dhMalzeme) return __dhMalzemeOpener();
  return Scenario.opener;
}
const State = {
  level: localStorage.getItem("chat:level:" + safeId(Scenario.title + ":" + (Scenario.avatarDir||""))) || Scenario.level || "A2",
  currentPartner: __dhOpener(),
  busy:false,
  speaking:false,
  history:[]
};
State.firstMsg=State.currentPartner;
function safeId(s){ return String(s||"scenario").toLowerCase().replace(/[^a-z0-9]+/g,"-"); }
function $(id){ return document.getElementById(id); }
function activeAvatarDir(){
  const isTeacher = /teacher|öğretmen|ogretmen/i.test((Scenario.title||"") + " " + (Scenario.role||""));
  const selected = localStorage.getItem("selectedTeacherAvatar") || "teacher1";
  if(isTeacher && /^assets\/avatars_v3\/teacher/i.test(Scenario.avatarDir || "assets/avatars_v3/teacher1/")){
    return "assets/avatars_v3/" + selected + "/";
  }
  return (Scenario.avatarDir || "");
}
function asset(file){ return activeAvatarDir() + file; }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function getKeys(){ try{ return (JSON.parse(localStorage.getItem(KEYS_LS)||"[]")||[]).filter(Boolean); }catch{return [];} }
function ensureStorageReady(){
  return new Promise(function(resolve){
    if(typeof window.__dhStorageReady==="undefined" || window.__dhStorageReady || getKeys().length){ resolve(); return; }
    var done=false; function go(){ if(done)return; done=true; resolve(); }
    window.addEventListener("dh-storage-ready", go, {once:true});
    setTimeout(go, 1500);
  });
}
/* ai-providers.js sayfada yuklu degilse undefined doner — cagrilar
   sessizce eski Groq yoluna duser. */
function global_DHProviders(){ try{ return window.DHProviders || null; }catch(e){ return null; } }
function saveKey(k){ const keys=getKeys(); if(!keys.includes(k)) keys.push(k); localStorage.setItem(KEYS_LS, JSON.stringify(keys)); }
/* ── COK SAGLAYICILI CAGRI ──────────────────────────────────────────
   OLCULDU: bu dosya dogrudan GROQ_URL'e gidiyordu ve yalnizca birden
   fazla GROQ anahtari arasinda donuyordu. Groq kotasi bitince sohbet
   tamamen duruyordu ("API limiti doldu"), oysa uygulamada Cerebras ve
   Gemini API anahtarlari da olabiliyor.
   ai-providers.js (DHProviders) tam bu isi yapiyor: anahtari olan
   saglayicilari sirayla dener, 429 alani atlayip sonrakine geçer. Yazilmis
   ama chat sayfalarina HIC baglanmamisti. Artik varsa o kullanilir;
   yoksa asagidaki eski dogrudan-Groq yolu aynen calisir (geri uyum). */
async function groqChat(messages, requestOpts){
  requestOpts=requestOpts||{};
  const controller=new AbortController();
  let timedOut=false;
  const timer=setTimeout(function(){timedOut=true;controller.abort();},requestOpts.timeoutMs||25000);
  const external=requestOpts.signal;
  const abortFromOutside=function(){controller.abort();};
  const cleanupRequest=function(){clearTimeout(timer);if(external)external.removeEventListener("abort",abortFromOutside);};
  if(external){if(external.aborted)controller.abort();else external.addEventListener("abort",abortFromOutside,{once:true});}
  try{
    if(global_DHProviders() && global_DHProviders().hasAnyKey && global_DHProviders().hasAnyKey()){
      return await global_DHProviders().chat(messages, { temperature:0.7, max_tokens:1100, signal:controller.signal });
    }
  }catch(e){
    /* DHProviders'in kendi hata kodlari ("rate","all-failed","no-key")
       cagiranin bekledigi bicimle ayni; oldugu gibi yukari verilir. */
    if(e && (e.code==="rate" || e.code==="all-failed")) throw {code:"rate"};
    if(e && e.code==="no-key") throw {code:"no-key"};
    if((e&&e.code==="abort") || controller.signal.aborted) throw {code:timedOut?"timeout":"cancelled"};
    throw e;
  }finally{
    /* Sağlayıcı yolu burada biter. Doğrudan Groq yedeğine düşülecekse
       zamanlayıcı aşağıdaki ikinci blokta yeniden kurulur. */
    if(global_DHProviders() && global_DHProviders().hasAnyKey && global_DHProviders().hasAnyKey()){
      cleanupRequest();
    }
  }
  const keys=getKeys();
  if(!keys.length){cleanupRequest();throw {code:"no-key"};}
  let lastErr=null;
  for(const key of keys){
    try{
      const res=await fetch(GROQ_URL,{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model:GROQ_MODEL,messages,temperature:.7,max_tokens:320})});
      if(res.status===401){lastErr={code:"bad-key"};continue;}
      if(res.status===429){lastErr={code:"rate"};continue;}
      if(!res.ok){lastErr={code:"http",status:res.status};continue;}
      const data=await res.json();
      const answer=data.choices?.[0]?.message?.content?.trim() || "";
      cleanupRequest();return answer;
    }catch(e){ if(controller.signal.aborted){lastErr={code:timedOut?"timeout":"cancelled"};break;} lastErr={code:"network"}; }
  }
  cleanupRequest();
  throw lastErr || {code:"unknown"};
}

class PhotoAvatar{
  constructor(img){
    this.img=img;
    this.frames={
      idle:asset(Scenario.frames.idle),
      blink:asset(Scenario.frames.blink),
      listen:asset(Scenario.frames.listen),
      a:asset(Scenario.frames.mouthA),
      e:asset(Scenario.frames.mouthE),
      i:asset(Scenario.frames.mouthI),
      o:asset(Scenario.frames.mouthO),
      u:asset(Scenario.frames.mouthU),
      mbp:asset(Scenario.frames.mouthMBP),
      fv:asset(Scenario.frames.mouthFV),
      l:asset(Scenario.frames.mouthL),
      th:asset(Scenario.frames.mouthTH)
    };
    this.blinkTimer=null;
    this.talkTimer=null;
    this.endTimer=null;
    this.isBlinking=false;
    this.talkSeq=[];
    this.talkIndex=0;
  }
  init(){
    this.img.onerror=()=>{ this.img.onerror=null; this.img.src=this.frames.idle; };
    this.show(this.frames.idle);
    this.preload();
    this.scheduleBlink(1000);
  }
  preload(){ Object.values(this.frames).forEach(src=>{ const im = new Image(); im.src=src; }); }
  show(url){ this.img.src=url; }
  scheduleBlink(delay){
    clearTimeout(this.blinkTimer);
    this.blinkTimer=setTimeout(()=>this.blink(), delay || (2100 + Math.random()*1900));
  }
  blink(){
    if(State.speaking){
      this.scheduleBlink(1200 + Math.random()*1200);
      return;
    }
    this.isBlinking=true;
    this.show(this.frames.blink);
    setTimeout(()=>{
      this.isBlinking=false;
      if(!State.speaking) this.show(this.frames.idle);
      this.scheduleBlink();
    }, 330);
  }
  frameForChar(ch, next){
    ch = (ch || "").toLowerCase();
    next = (next || "").toLowerCase();

    if(ch === "t" && next === "h") return this.frames.th;
    if(/[oö0]/.test(ch)) return this.frames.o;
    if(/[uüwq]/.test(ch)) return this.frames.u;
    if(/[a]/.test(ch)) return this.frames.a;
    if(/[e]/.test(ch)) return this.frames.e;
    if(/[iııy]/.test(ch)) return this.frames.i;
    if(/[mnbp]/.test(ch)) return this.frames.mbp;
    if(/[fv]/.test(ch)) return this.frames.fv;
    if(/[l]/.test(ch)) return this.frames.l;
    if(/[.,!?;:\s]/.test(ch)) return this.frames.idle;
    return this.frames.i;
  }
  buildSequenceFromText(text){
    /* DİLE DUYARLI AĞIZ: eskiden tek karma harita vardı — Türkçe c/ç/ş/ğ/j
       hiç tanınmıyor, İngilizce'de th dışında ayrım yapılmıyordu.
       viseme-lang.js metni dile göre parçalayıp her parçaya kendi haritasını
       uyguluyor. Bağlam dili: öğretmen ekranında Türkçe (İngilizce [[ ]] ile
       gelir), rol-yapma senaryolarında İngilizce (cevabın tamamı İngilizce). */
    if(window.DHViseme){
      const def = (typeof __dhIsTeacher !== "undefined" && __dhIsTeacher) ? "tr" : "en";
      const seq = window.DHViseme.sequence(text, {
        a:this.frames.a, e:this.frames.e, i:this.frames.i, o:this.frames.o,
        u:this.frames.u, mbp:this.frames.mbp, fv:this.frames.fv,
        l:this.frames.l, th:this.frames.th, idle:this.frames.idle
      }, def);
      if(seq.length) return seq;
    }
    const s = String(text || "");
    const seq = [];
    for(let idx=0; idx<s.length; idx++){
      const ch = s[idx];
      const next = s[idx+1] || "";
      const frame = this.frameForChar(ch, next);
      if(frame) seq.push(frame);
      if(ch.toLowerCase()==="t" && next.toLowerCase()==="h") idx++;
    }
    return seq.filter(Boolean);
  }
  speakText(text, duration){
    clearInterval(this.talkTimer);
    clearTimeout(this.endTimer);
    State.speaking=true;
    /* timeline: kareler + her karenin metindeki harf konumu. Harf konumu
       gerekiyor çünkü noktalama duraklamaları yüzünden kare sayısı harf
       sayısıyla doğrusal değil. */
    this.talkCharAt = null;
    if(window.DHViseme && window.DHViseme.timeline){
      const _def = (typeof __dhIsTeacher !== "undefined" && __dhIsTeacher) ? "tr" : "en";
      const tl = window.DHViseme.timeline(text, {
        a:this.frames.a, e:this.frames.e, i:this.frames.i, o:this.frames.o,
        u:this.frames.u, mbp:this.frames.mbp, fv:this.frames.fv,
        l:this.frames.l, th:this.frames.th, idle:this.frames.idle
      }, _def);
      if(tl && tl.frames.length){ this.talkSeq = tl.frames; this.talkCharAt = tl.charAt; }
    }
    if(!this.talkSeq || !this.talkSeq.length) this.talkSeq = this.buildSequenceFromText(text);
    if(!this.talkSeq.length){
      this.talkSeq = [this.frames.i, this.frames.e, this.frames.a, this.frames.o, this.frames.u, this.frames.mbp, this.frames.idle];
    }
    this.talkIndex=0;
    /* SENKRON DÜZELTMESİ.
       Eskiden kare aralığı sabit 105 ms'ydi ve dizi bitince "% length" ile
       BAŞA DÖNÜYORDU. Dizi her harf için bir kare üretiyor; 105 ms sabit adımla
       konuşmanın gerçek hızıyla hiçbir bağı yoktu. Sonuç: ağız ya geride
       kalıyor ya da cümleyi bitirip baştan "söylemeye" başlıyordu.
       Artık kare süresi konuşmanın tahmini süresine bölünüyor ve döngü yok. */
    const _total = Math.max(1000, duration||1800);
    this.talkTotal = _total;
    this.talkStart = Date.now();
    const _step = Math.max(40, Math.min(170, Math.round(_total / Math.max(1, this.talkSeq.length))));
    this.talkStep = _step;
    this.talkTimer=setInterval(()=>{
      if(this.isBlinking) return;
      if(this.talkIndex >= this.talkSeq.length){
        this.show(this.frames.idle);     // bitti: başa dönme, dinlenme karesinde kal
        return;
      }
      this.show(this.talkSeq[this.talkIndex++]);
    }, _step);
    this.endTimer=setTimeout(()=>this.stop(), _total);
  }
  /* Konuşmanın gerçek konumuna hizala (0..1). Tarayıcı her kelimede
     onboundary olayı veriyor; ağız birikmiş gecikmeyi orada kapatıyor. */
  /* charIndex: metnin başından itibaren harf konumu (onboundary'den gelir) */
  alignToChar(charIndex){
    if(!this.talkSeq || !this.talkSeq.length) return;
    if(typeof charIndex!=="number" || charIndex<0) return;
    let hedef;
    if(this.talkCharAt && window.DHViseme && window.DHViseme.indexForChar){
      hedef = window.DHViseme.indexForChar(this.talkCharAt, charIndex);
    } else {
      return;                            // eşleme yoksa hizalamayı zorlamayalım
    }
    const ratio = hedef / this.talkSeq.length;
    /* küçük sapmaları düzeltmeye çalışmayalım — titremeye yol açar */
    if(Math.abs(hedef - this.talkIndex) > 2) this.talkIndex = hedef;

    /* KENDİNİ AYARLAMA.
       estimateDuration karakter başına 82 ms varsayıyor; gerçek sesler genelde
       daha hızlı konuşuyor. Bu yüzden ağzın bütçesi sesten uzun kalıyor ve
       ses bittikten sonra birkaç hece daha oynuyordu.
       Burada gerçek hızı ölçüyoruz: bu noktaya kadar geçen süre / kat edilen oran
       = konuşmanın gerçek toplam süresi. Kalan kareleri ona göre yayıyoruz. */
    if(ratio > 0.15 && this.talkStart){
      const gecen = Date.now() - this.talkStart;
      const gercekToplam = gecen / ratio;
      const yeniAdim = Math.max(40, Math.min(170,
        Math.round(gercekToplam / Math.max(1, this.talkSeq.length))));
      if(Math.abs(yeniAdim - (this.talkStep||0)) > Math.max(8, this.talkStep*0.15)){
        this.talkStep = yeniAdim;
        clearInterval(this.talkTimer);
        this.talkTimer = setInterval(()=>{
          if(this.isBlinking) return;
          if(this.talkIndex >= this.talkSeq.length){ this.show(this.frames.idle); return; }
          this.show(this.talkSeq[this.talkIndex++]);
        }, yeniAdim);
        clearTimeout(this.endTimer);
        this.endTimer = setTimeout(()=>this.stop(), Math.max(300, gercekToplam - gecen + 150));
      }
    }
  }
  stop(){
    clearInterval(this.talkTimer);
    clearTimeout(this.endTimer);
    State.speaking=false;
    if(!this.isBlinking) this.show(this.frames.listen);
    setTimeout(()=>{ if(!State.speaking && !this.isBlinking) this.show(this.frames.idle); }, 260);
    this.scheduleBlink(1100);
  }
}

function buildUI(){
  const root=document.getElementById("chatApp") || document.body.appendChild(document.createElement("div"));
  root.innerHTML=`<div class="chat-shell"><div class="chat-top"><a class="back-btn" href="${Scenario.backHref||'chat.html'}">←</a><div class="chat-title-wrap"><div class="chat-title">${esc(Scenario.title)}</div><div class="chat-sub" id="subtitle">${esc(Scenario.subtitle)} · ${State.level}</div></div><button class="level-pill" id="levelBtn" type="button">${State.level}</button></div><div class="avatar-stage"><img id="avatarImg" alt="Fotoğraflı konuşan avatar"></div><div class="panel"><div class="chat-history" id="chatHistory"></div><div id="taskBar" style="font-size:11.5px;color:#9fb3d9;padding:4px 8px;border-top:1px dashed #ffffff18"></div><div class="input-row"><div class="input-wrap"><textarea id="textIn" class="text-in" rows="1" placeholder="Yaz ya da 🎙 ile konuş..."></textarea></div><button class="icon-fab suggest-btn" id="suggestBtn" type="button" title="Sen öner">💡</button><button class="icon-fab suggest-btn" id="errSaveBtn" type="button" title="Bu konuşmadaki hatalarımı deftere kaydet" style="background:#b45309">📝</button><button class="icon-fab suggest-btn" id="autoBtn" type="button" title="Eller serbest: avatar susunca mikrofon otomatik açılır" style="background:#334155">🔁</button><button class="icon-fab suggest-btn" id="finishBtn" type="button" title="Oturumu bitir ve özetle" style="background:#0f7a5a">✓</button><button class="icon-fab suggest-btn" id="gemBtn" type="button" title="Sohbeti Gemini de surdur (panoya kopyalanir)" style="background:#7c3aed">💎</button><button class="icon-fab mic-btn" id="micBtn" type="button">🎙</button><button class="icon-fab send-btn" id="sendBtn" type="button">➤</button></div></div></div><div class="sheet" id="explainSheet"><div class="sheet-card"><h3>TR Açıkla</h3><p id="explainText">Yükleniyor...</p><div class="sheet-btns"><button class="sheet-btn primary" id="closeExplain">Kapat</button></div></div></div><div class="sheet" id="summarySheet"><div class="sheet-card"><h3>Konuşma özeti</h3><div id="summaryText"></div><div class="sheet-btns"><a class="sheet-btn primary" id="summaryPractice" href="./hata-defteri.html">Hataları çalış</a><a class="sheet-btn" href="./index.html">Bugüne dön</a><button class="sheet-btn" id="closeSummary">Sohbete devam et</button></div></div></div><div class="sheet" id="levelSheet"><div class="sheet-card"><h3>Seviye seç</h3><div class="sheet-btns"><button class="sheet-btn levelOpt" data-level="A1">A1</button><button class="sheet-btn levelOpt" data-level="A2">A2</button><button class="sheet-btn levelOpt" data-level="B1">B1</button><button class="sheet-btn levelOpt" data-level="B2">B2</button><button class="sheet-btn levelOpt" data-level="C1">C1</button></div><div class="sheet-btns"><button class="sheet-btn primary" id="closeLevel">Kapat</button></div></div></div><div class="sheet" id="keySheet"><div class="sheet-card"><h3>AI bağlantısı</h3><p>Konuşma sağlayıcısı için API anahtarını ekle. Anahtar yalnızca bu tarayıcıda saklanır.</p><input id="keyInput" type="password" placeholder="gsk_..." autocomplete="off"><div class="sheet-btns"><button class="sheet-btn primary" id="saveKey">Kaydet</button><button class="sheet-btn" id="closeKey">Kapat</button></div><div class="note" id="keyNote">Anahtar bu cihazda saklanır; hesabına gönderilmez.</div></div></div>`;
}
/* Metni ekrana basarken [[İngilizce]] bloklarını işaretli span'a çevirir.
   Ham metne dokunmaz — seslendirme onu kullanmaya devam eder. */
/* Modeller basligi **boyle** kalinlastiriyor; chat-core'da hic markdown
   islenmedigi icin ekrana "**TURKCE ACIKLAMA**" diye yildizlariyla
   dusuyordu. Sadece **kalin** destekleniyor — baska markdown yok, cunku
   ogretmen cevabinda baska bir sey kullanilmiyor. */
function dhKalinParcala(metin, hedef){
  var re = /\*\*([^*\n][^*]*?)\*\*/g, i = 0, m;
  while((m = re.exec(metin))){
    if(m.index > i) hedef.appendChild(document.createTextNode(metin.slice(i, m.index)));
    var b = document.createElement("strong");
    b.textContent = m[1];
    hedef.appendChild(b);
    i = re.lastIndex;
  }
  if(i < metin.length) hedef.appendChild(document.createTextNode(metin.slice(i)));
}
function renderBubbleText(node, raw){
  var s = String(raw == null ? "" : raw);
  var re = /\[\[([\s\S]*?)\]\]/g, i = 0, m;
  while((m = re.exec(s))){
    if(m.index > i) dhKalinParcala(s.slice(i, m.index), node);
    /* BOS BLOK: model bazen "... : [[…]]" gibi yer tutucu birakiyordu,
       ekranda bos yesil kutucuk olarak ciziliyordu. Icinde harf/rakam
       yoksa blok hic cizilmez. */
    var ic = m[1];
    if(/[A-Za-z0-9]/.test(ic)){
      var sp = document.createElement("span");
      sp.className = "en-chunk";
      sp.textContent = ic;
      node.appendChild(sp);
    }
    i = re.lastIndex;
  }
  if(i < s.length) dhKalinParcala(s.slice(i), node);
  if(i === 0 && !s) node.textContent = "";
}
function addBubble(role, text, options){
  const hist = $("chatHistory");
  const el = document.createElement("div");
  el.className = "bubble " + (role === "user" ? "user" : "assistant");
  if(options && options.typing){
    el.className = "bubble assistant typing";
    el.id = "typingBubble";
    el.textContent = "Düşünüyor...";
  }else{
    const t = document.createElement("div");
    t.className = "bubble-text";
    /* [[ ]] işaretleri seslendirmenin İngilizce bölümleri ayırt etmesi için var
       (tts-avatar-long-sync-fix.js onları ayrıştırıyor). Ama ekranda ham
       görünüyorlardı: "Doğru cevap: [[It was such a lot of work...]]".
       Artık parantezler ekrandan kalkıyor, İngilizce bölüm işaretli span'a
       giriyor. speakText'e HAM metin gidiyor; çift dilli okuma bozulmuyor. */
    renderBubbleText(t, text);
    el.appendChild(t);
    if(role !== "user"){
      const actions = document.createElement("div");
      actions.className = "bubble-actions";
      const listen = document.createElement("button");
      listen.className = "bubble-btn";
      listen.type = "button";
      listen.textContent = "🔊 Dinle";
      listen.onclick = () => speakText(text);
      const tr = document.createElement("button");
      tr.className = "bubble-btn";
      tr.type = "button";
      tr.textContent = "TR Açıkla";
      tr.onclick = () => explainText(text);
      actions.appendChild(listen);
      actions.appendChild(tr);
      el.appendChild(actions);
    }
  }
  hist.appendChild(el);
  scrollHistory();
  return el;
}
function scrollHistory(){ const hist = $("chatHistory"); if(hist) hist.scrollTop = hist.scrollHeight; }
function removeTyping(){ const t = $("typingBubble"); if(t) t.remove(); }
function levelGuide(){
  return ({A1:"The user is beginner A1. Use very short and easy sentences.",A2:"The user is elementary A2. Use simple and common words.",B1:"The user is intermediate B1. Use natural but clear English.",B2:"The user is upper intermediate B2. Speak naturally but keep it concise.",C1:"The user is advanced C1. Use fluent natural English, still keep replies concise."})[State.level] || "Use clear natural English.";
}

/* ---- ÖĞRENCİ PROFİLİ: uygulama verisinden AI'ya kısa özet (≤150 kelime) ---- */
async function dhBuildProfile(){
  var p=[];
  try{ // streak + bugün
    var tr=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}, days=Object.keys(tr.days||{}).sort();
    var streak=0, d=new Date();
    for(;;){ var key=d.toISOString().slice(0,10); if((tr.days||{})[key]){streak++; d.setDate(d.getDate()-1);} else break; }
    if(streak) p.push("Seri: "+streak+" gün.");
  }catch(e){}
  try{ // kelime/cümle durumu
    var m=JSON.parse(localStorage.getItem("dh-progress-mirror-v1")||"{}")||{}, w1=0,w2=0,s1=0,s2=0;
    for(var k in m){ var st=m[k]&&m[k][0]; if(k.indexOf("word:")===0){ if(st===1)w1++; if(st===2)w2++; } if(k.indexOf("sentence:")===0){ if(st===1)s1++; if(st===2)s2++; } }
    p.push("Kelime: "+w2+" öğrenildi/"+w1+" çalışılıyor. Cümle: "+s2+"/"+s1+".");
  }catch(e){}
  try{ // hata etiketleri (ilk 3)
    if(window.LearningErrorDB&&LearningErrorDB.all){
      var errs=await LearningErrorDB.all(), tally={};
      (errs||[]).slice(-60).forEach(function(r){ var t=r&&r.type; if(t) tally[t]=(tally[t]||0)+1; });
      var top=Object.keys(tally).sort(function(a,b){return tally[b]-tally[a]}).slice(0,3);
      if(top.length) p.push("Sık hata türleri: "+top.join(", ")+".");
      var now30=Date.now(), c15=now30-15*86400000, c30=now30-30*86400000, o30={}, r30={};
      errs.forEach(function(r){ var ts=r.ts||0; if(ts<c30) return; var ty=Array.isArray(r.types)&&r.types.length?r.types:(r.type?[r.type]:[]);
        ty.forEach(function(t){ if(ts>=c15) r30[t]=(r30[t]||0)+1; else o30[t]=(o30[t]||0)+1; }); });
      var trend30=[]; Object.keys(Object.assign({},o30,r30)).forEach(function(t){ var o=o30[t]||0,r=r30[t]||0; if(o&&r<o) trend30.push(t+" iyileşiyor"); else if(r>=2&&r>o) trend30.push(t+" kötüleşiyor"); });
      if(trend30.length) p.push("Son 30 gün eğilimi: "+trend30.slice(0,2).join(", ")+".");
    }
  }catch(e){}
  try{ // inatçı cümleler (ilk 3) + vadesi gelen
    var due=0, leech=[];
    await new Promise(function(res){ try{
      var r=indexedDB.open("sentence-mode",1);
      r.onsuccess=function(){ var db=r.result;
        try{ var req=db.transaction("kv","readonly").objectStore("kv").openCursor(), now=Date.now();
          req.onsuccess=function(e){ var c=e.target.result;
            if(c){ var kk=String(c.key), v=c.value||{};
              if(kk.indexOf("srs:")===0){ if((v.due||0)<=now) due++; if((v.lapses||0)>=3&&leech.length<3) leech.push(kk.slice(4)); }
              c.continue();
            } else { db.close(); res(); } };
          req.onerror=function(){ db.close(); res(); };
        }catch(e2){ try{db.close()}catch(_){ } res(); } };
      r.onerror=function(){ res(); };
    }catch(e3){ res(); } });
    if(due && __dhIsTeacher) p.push("Bugün tekrar için seçilen porsiyon: "+Math.min(due,15)+"."+(due>15?" (Toplam birikmiş "+due+" — KURAL: bu toplamı kullanıcıya söyleme, günde 15 tekrarın yeterli olduğunu vurgula.)":""));
    if(leech.length) p.push("İnatçı (öğrenemediği) cümleler: "+leech.join(" | ")+".");
  }catch(e){}
  try{ /* KOÇ BEYNİ → öğretmene: günün planı + haftalık hedef */
    if(__dhIsTeacher){
      var kDay=new Date().toISOString().slice(0,10);
      var kPlan=null; try{ kPlan=JSON.parse(localStorage.getItem("dh-koc-plan-"+kDay)||"null"); }catch(e){}
      if(kPlan && kPlan.focus){
        var kDone={}; try{ kDone=JSON.parse(localStorage.getItem("dh-koc-steps-done-"+kDay)||"{}")||{}; }catch(e){}
        var kSteps=(kPlan.steps||[]).map(function(s){
          var pg=String(s.href||"").split("?")[0];
          return (kDone[pg]?"✅":"⬜")+" "+(s.label||pg);
        }).join("; ");
        p.push("BUGÜNÜN KOÇ PLANI — Odak: "+kPlan.focus+"."+(kPlan.note?(" Not: "+kPlan.note+"."):"")+(kSteps?(" Adımlar: "+kSteps+"."):""));
      }
      var kGoal=null; try{ kGoal=JSON.parse(localStorage.getItem("dh-koc-goal")||"null"); }catch(e){}
      if(kGoal && kGoal.type){
        var kKalan=Math.max(0, Math.ceil(((kGoal.setAt||Date.now())+7*86400000-Date.now())/86400000));
        p.push("HAFTALIK HEDEF: '"+kGoal.type+"' hatasını azaltmak (kalan "+kKalan+" gün).");
      }
    }
  }catch(e){}
  return p.join(" ").slice(0, __dhIsTeacher ? 1500 : 900);
}

var __dhProfile=""; dhBuildProfile().then(function(t){ __dhProfile=t; });
var __dhTasks=(window.Scenario&&Scenario.tasks)||["Selamlaş ve kendini kısaca tanıt","Senaryonun ana amacını gerçekleştir","Karşındakine en az bir soru sor"];
var __dhTaskDone=__dhTasks.map(function(){return false;});
function dhRenderTasks(){
  var el=document.getElementById("taskBar"); if(!el) return;
  el.innerHTML="🎯 "+__dhTasks.map(function(t,i){ return '<span style="opacity:'+(__dhTaskDone[i]?1:.6)+'">'+(__dhTaskDone[i]?"✅":"⬜")+" "+t+"</span>"; }).join("  ·  ");
  if(__dhTaskDone.every(Boolean)) el.innerHTML+=' <b style="color:#4ade80">— 🎉 Görevler tamam!</b>';
}
/* Gemini'de devam eden sohbetin onayli raporu da ayni gorev seridini
   kapatabilsin. Dizi bu dosyada kapsullu oldugu icin guvenli bir API acilir. */
globalThis.DHChatTasks={
  completeAll:function(){
    for(var i=0;i<__dhTaskDone.length;i++) __dhTaskDone[i]=true;
    dhRenderTasks();
    return {done:__dhTaskDone.length,total:__dhTasks.length};
  },
  state:function(){return __dhTaskDone.slice();}
};
function dhStripTasks(reply){
  return String(reply||"").replace(/\[TASK_DONE:(\d)\]/g, function(_,n){
    var i=(+n)-1; if(__dhTaskDone[i]===false){ __dhTaskDone[i]=true; setTimeout(dhRenderTasks,50); }
    return "";
  }).trim();
}
/* DİL KURALI — rol-yapma ile öğretmeni ayırır.
   Havaalanı/otel/doktor gibi senaryolarda amaç İngilizce konuşma pratiği, orada
   İngilizce kalır. AI Öğretmen'de amaç ÖĞRETMEK: açıklama, düzeltme ve yönerge
   Türkçe olmalı, öğretilen malzeme İngilizce kalmalı — index.html'in koçu
   tarif ederken dediği gibi: "Türkçe anlatan İngilizce koçun".
   Eskiye dönmek isteyen: localStorage["dh-teacher-dili"] = "en" */
/* ── OGRETMEN KURALI: TEK KAYNAK ────────────────────────────────────
   Bu metin AI Ogretmen icin yazilmis ve oturmus durumda: Turkce ogret,
   Ingilizce malzemeyi Ingilizce birak, hatayi tek satirla gecistirme.
   Rol senaryolari (garson, resepsiyonist, doktor) icin AYRI bir kural
   yazmak yerine AYNI metin kullanilir; uzerine yalnizca "rolunu koru"
   katmani eklenir. Boylece ogretme davranisi iki yerde ayrisip
   birbirinden kopmaz. */
function dhOgretmenKurali(){
  return "LANGUAGE RULE (strict): You are a Turkish-speaking English teacher and the "
    + "student is a Turkish native speaker. Write EVERYTHING you say in TURKISH: "
    + "explanations, grammar, corrections, instructions, praise, and your questions. "
    + "Keep in English ONLY the language material itself — target sentences, example "
    + "sentences, vocabulary, and the phrases you ask the student to say. "
    + "Never explain grammar in English. Never repeat your own Turkish sentence in "
    + "English. When you want the student to speak, ask in Turkish and then give the "
    + "English sentence to produce. "
    + "Use ONLY Turkish and English — never a word from any third language "
    + "(Spanish, French, German...). "
    + "When you correct a mistake, do not settle for one line: say what is wrong, "
    + "then explain the RULE and WHY in 2-3 Turkish sentences, give the correct "
    + "sentence, add one more example using the same rule, and ask the student to "
    + "build a new sentence with it. "
    /* OLCULEN HATA: ogrenci "siparis verirken going to yerine will
       kullanmam gerekmez mi" diye sordu, ogretmen "menuden secerken going
       to daha dogal" dedi. Ders kitaplarindaki ayrim tam tersi: konusma
       aninda verilen karar → will. Ogrenci hakliydi. */
    + "GRAMMAR ACCURACY — will vs going to: a decision made AT THE MOMENT OF "
    + "SPEAKING takes 'will' (ordering from a menu at the table: \"I'll have the "
    + "chocolate cake.\"); a plan or intention formed BEFORE speaking takes 'going "
    + "to' (\"I'm going to order the steak, I decided on the way here.\"). Asking "
    + "about someone's already-formed intention also takes 'going to' (\"Are you "
    + "going to order this or that?\"). Never tell the student that 'going to' is "
    + "the natural choice for an on-the-spot restaurant order. "
    + "Formatting: write plain sentences. Do NOT use markdown headings, bullets or "
    + "**bold**. Put every English sentence inside [[ ]] and never leave a [[ ]] "
    + "block empty — if you want the student to fill a blank, write it in Turkish.";
}
function dhLanguageRule(){
  var pref="";
  try{ pref=localStorage.getItem("dh-teacher-dili")||""; }catch(e){}
  if(__dhIsTeacher && pref!=="en"){
    /* Gunun malzemesi bir ORTAM tasiyorsa ogretmen o ortamda ders yapar ve
       gerektiginde karsi tarafi canlandirir. Ortam yoksa duz ders. */
    if(!(__dhMalzeme && __dhMalzeme.ortam)) return dhOgretmenKurali();
    return dhOgretmenKurali() + "\n" + dhRolOyunuKatmani();
  }

  var rolPref="";
  try{ rolPref=localStorage.getItem("dh-rol-dili")||""; }catch(e){}
  if(rolPref==="en") return "Always reply in English unless the user explicitly asks for Turkish.";

  /* Senaryo sayfasi: AYNI ogretmen kurali + rol oyunu katmani.
     Ogretmen once ogretir, ogrenci hazir olunca kisa bir canlandirma
     yapar, sonra ogretmene doner. Rol, asistanin kimligi DEGILDIR. */
  /* Senaryo sayfalari artik ders yapmaz — eski davranis. */
  return "Always reply in English unless the user explicitly asks for Turkish.";
}
/* ── ROL OYUNU KATMANI (ogretmen ekraninda, ortam varsa) ─────────────
   Her tur gonderildigi icin kisa tutuldu; kurallarin hicbiri atilmadi,
   her biri ekranda gorulen somut bir kusuru kapatiyor. */
function dhRolOyunuKatmani(){
  var ortam = (__dhMalzeme && __dhMalzeme.ortam) || "";
  return "[ROLEPLAY] Today's lesson happens in this setting: \"" + ortam + "\". You may act "
    + "out " + dhRolTr() + " there for 1-2 turns, then step back out. Each turn: (1) Turkish "
    + "teaching — react, correct properly if wrong, give the pattern needed now; (2) either "
    + "ask for a sentence or start a short roleplay with \"Şimdi ben " + dhRolTr() + " olayım\" "
    + "(use exactly this Turkish label, never an English role description) and your line as "
    + "[[English]].\nRULES: teacher first, never disappear into the character · never narrate "
    + "what just happened · never translate your own English line · all English inside [[ ]] · "
    + "if their sentence is correct for their level, say so briefly and MOVE THE SCENE FORWARD "
    + "— never invent a mistake · ignore punctuation, capitalisation and typing slips, this is "
    + "speaking not dictation · never force a question out of them, answering is often correct · "
    + "each turn advances the scene one step, never repeat a step they did right · Turkish "
    + "teaching max 3 short sentences, the student speaks more than you · end by making them "
    + "produce an English sentence.";
}
/* Ogretme modu acik mi (ogretmen senaryosu ya da rol senaryosunda ders) */
function dhOgretmeModu(){
  try{
    /* OLCULEN KUSUR: Restoran sayfasinda garson Turkce ders anlatiyordu.
       Sebep: dhLanguageRule() senaryo sayfasi icin dogru sekilde
       "Always reply in English" donuyor, ama dhOgretmeModu() ayni sayfada
       true donup "Turkce ogretme bolumu 2-4 cumle" uzunluk kuralini
       yolluyordu. Iki kural celisince model Turkce ogretmeye kayiyordu.
       Ogretme modu artik SADECE ogretmen ekraninda acik. */
    if(!__dhIsTeacher) return false;
    return localStorage.getItem("dh-teacher-dili")!=="en";
  }catch(e){ return false; }
}
function systemPrompt(){
  /* Senaryonun systemExtra'si ("You are role-playing as a waiter") artik
     asistanin kimligi olarak VERILMEZ; verilirse model ogretmenligi birakip
     garsona donusuyor. Rol, [ROLEPLAY] katmaninda canlandirilacak karakter
     olarak geciyor. */
  /* Ogretmen ekraninda ortam varsa kimlige sahne bilgisi eklenir; senaryo
     sayfalarinda Scenario.systemExtra AYNEN gecer (eski davranis). */
  var __kimlik = (__dhIsTeacher && __dhMalzeme && __dhMalzeme.ortam)
    ? ("You are a Turkish-speaking English teacher. Today's lesson is set in: "
       + __dhMalzeme.ortam + ". You may act out " + dhRolTr()
       + " during short roleplay moments, but you remain the teacher.")
    : (Scenario.systemExtra || ("You are role-playing as " + Scenario.role + "."));
  return [__kimlik, levelGuide(), dhLanguageRule(),     /* CELISKI GIDERILDI: "1-3 cumle" ve "ders verme" kurallari, ogretme
       kuralinin istedigi (kural + neden + ornek + yeni cumle kurdur)
       yapiyi eziyordu. Model her seyi tek cumleye sikistirip ogretmek
       yerine olan biteni ANLATIYORDU ("...diye sordum, siz de
       soylediniz, simdi size sunu diyorum"). Ogretme modunda uzunluk
       serbest ama YAPI zorunlu; eski kisa/ders-verme kurallari yalnizca
       ogretme kapaliyken gecerli. */
    (dhOgretmeModu()
      ? "Length: your English line is 1-2 sentences; the Turkish teaching part is 2-4 sentences. Never longer."
      : "Keep replies short: 1 to 3 sentences."),
    (dhOgretmeModu() ? "" : "If the user makes a clear mistake, gently model the correct version without lecturing."),
    "Ask a follow-up question to keep the conversation going.", "No emojis.",
    (__dhProfile?("\n[STUDENT PROFILE — use this to personalize, in Turkish data]\n"+__dhProfile+"\nWhen the student repeats one of their known error patterns, gently correct it and briefly note it is a frequent mistake of theirs. Naturally create situations that make the student use the patterns they struggle with."):""),
    (__dhIsTeacher?"\n[COACH ROLE] You are not only a conversation partner but also the student's personal coach. The profile above includes their daily coach plan (BUGÜNÜN KOÇ PLANI) and weekly goal (HAFTALIK HEDEF). In your FIRST reply, acknowledge their streak, plan or goal in ONE short friendly sentence, then continue teaching. Steer the practice toward the weekly goal and the unfinished (⬜) plan steps. If they completed steps (✅), congratulate briefly.":""),
    (__dhTeach&&__dhTeach.target?("\n[EXACT ERROR CONTEXT] The student's own mistake: wrong=\""+(__dhTeach.answer||"")+"\" correct=\""+__dhTeach.target+"\" (TR: \""+(__dhTeach.tr||"")+"\"). Rule: "+(__dhTeach.tip||"")+". Start THIS session by teaching exactly this, then create 2-3 similar practice prompts."):""),
    /* Koç birden fazla gerçek hata yolladıysa tüm oturum bu listeden kurulur —
       öğretmen malzemesiz kalıp genel sorulara kaçmasın. */
    (__dhTeach&&__dhTeach.items&&__dhTeach.items.length>1?("\n[SESSION MATERIAL — the student's real mistakes from their error notebook"+(__dhTeach.label?(", topic: "+__dhTeach.label):"")+"]\n"
      +__dhTeach.items.map(function(it,i){ return (i+1)+") wrong=\""+(it.answer||"")+"\" correct=\""+it.target+"\""+(it.tr?(" (TR: \""+it.tr+"\")"):""); }).join("\n")
      +"\nWork through these one by one: for each, make the student produce the correct sentence themselves, correct them, give ONE short Turkish tip, then move to the next. Do NOT ask generic questions while this list is unfinished."):""),
    /* Ogrenciye BUGUN calistigi cumleleri konusturur. Cumleyi tekrar
       ettirmek degil, KALIBI urettirmek hedef — yoksa papagan olur. */
    /* Konusmanin ORTAMI verinin kendisinden gelir (cumlelerin "scenario"
       alani). Sabit bes senaryodan birine zorlanmaz: "Executive Boardroom"
       da olabilir "Being at home" de. Rol senaryosundaysak rol korunur,
       ortam onun icinde kurulur. */
    (__dhMalzeme&&__dhMalzeme.ortam?("\n[SETTING] Set this conversation in a concrete situation: \""+__dhMalzeme.ortam+"\"."
      +((__dhMalzeme.ortamlar&&__dhMalzeme.ortamlar.length>1)?(" Related situations you may move through: "+__dhMalzeme.ortamlar.slice(1).join("; ")+"."):"")
      +" Open the scene there and keep it concrete — a real moment, not a lesson about the topic."):""),
    (__dhMalzeme?("\n[TODAY'S MATERIAL — the student studied these in module \""+__dhMalzeme.modul+"\""
      +(__dhMalzeme.konu?(", topic: "+__dhMalzeme.konu):"")+"]\n"
      +__dhMalzeme.cumleler.map(function(c,i){
          return (i+1)+') "'+c.en+'"'+(c.kalip?('   pattern: '+c.kalip):"");
        }).join("\n")
      +"\nBuild this session around these. Create real situations that force the student to PRODUCE these patterns themselves — do not quote the sentences at them and do not ask them to repeat. Work through them one at a time. When they use a pattern correctly, acknowledge it in a few words and move to the next. Keep the role you are playing."
      +((__dhMalzeme.kelimeler&&__dhMalzeme.kelimeler.length)
          ? ("\n[TODAY'S WORDS] "+__dhMalzeme.kelimeler.join(", ")
             +"\nWeave these words into the same conversation. Create moments where the student needs them; do not list them or ask for definitions.")
          : "")
      +(__dhMalzeme.gunSonu
          ? "\n[END-OF-DAY MIX] This is the student's closing session for the day. Mix the sentences, the patterns and the words above in ONE flowing conversation instead of drilling them separately. Start easy, get harder. At the end, give a two-sentence Turkish summary of what they handled well and what still needs work."
          : "")
      +(__dhMalzeme.dun&&__dhMalzeme.dun.konu?("\nYesterday they practiced \""+__dhMalzeme.dun.konu+"\" with you; you may refer back to it once, briefly."):"")):""),
    (__dhFocus?("\n[FOCUS DRILL] The coach sent the student to you specifically to work on this error type: \""+__dhFocus+"\". Build most of this session around it: create short prompts that force the student to produce this pattern, correct their attempts, and give ONE short Turkish tip when they slip. Mention at the start, in one sentence, that you two will practice this together."):""),
    "\n[TASKS] Over the WHOLE conversation the student should eventually do these: "+__dhTasks.map(function(t,i){return (i+1)+") "+t;}).join(" ")+" These are goals for the whole session, NOT for every turn. Never force a question out of them just to tick a task. Weave them naturally into the conversation. When the user GENUINELY completes task N, append the marker [TASK_DONE:N] at the very end of your reply. Never mention the markers or tasks mechanically."
  ].join("\n");
}
function estimateDuration(text){ const n=Array.from(String(text||"")).length; return Math.max(1100, Math.min(12000, n * 82)); }

let cachedVoices = [];
function refreshVoices(){ cachedVoices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : []; }
/* Mobilde getVoices() ilk çağrıda boş döner; sesler asenkron yüklenir.
   voicesReady, sesler gelene kadar bekleyip callback çağırır. */
let __voicesReadyCbs = [];
function whenVoicesReady(cb){
  refreshVoices();
  if(cachedVoices.length){ cb(); return; }
  __voicesReadyCbs.push(cb);
  // güvence: 1.2sn sonra yine de dene (bazı tarayıcılar olayı geç/hiç atmaz)
  setTimeout(function(){ refreshVoices(); if(cachedVoices.length){ var q=__voicesReadyCbs; __voicesReadyCbs=[]; q.forEach(function(f){ try{f();}catch(e){} }); } }, 1200);
}
if(typeof speechSynthesis !== "undefined"){
  refreshVoices();
  speechSynthesis.onvoiceschanged = function(){
    refreshVoices();
    if(__voicesReadyCbs.length){ var q=__voicesReadyCbs; __voicesReadyCbs=[]; q.forEach(function(f){ try{f();}catch(e){} }); }
  };
}
function avatarVoiceKey(){ return "dh-voice:" + (activeAvatarDir()||"default").replace(/[^a-z0-9]+/gi,"-"); }
try{ window.avatarVoiceKey = avatarVoiceKey; }catch(e){}
function pickVoice(){
  refreshVoices();
  const voices = cachedVoices.filter(v => /^en/i.test(v.lang || ""));
  const allVoices = cachedVoices.slice();
  if(!allVoices.length){ dhVoiceDebug("SESLER BOŞ (getVoices boş döndü) → varsayılana düşecek"); return null; }
  // TEK DOĞRU KAYNAK: ses ayar sayfası (ses-secim.html).
  const _key = avatarVoiceKey();
  // 1) Bu karakter için kayıtlı seçim
  try{
    const saved = JSON.parse(localStorage.getItem(_key)||"null");
    if(saved && saved.name){
      const f = allVoices.find(v => v.name===saved.name);
      if(f){ dhVoiceDebug("✅ karakter sesi: "+saved.name+" (anahtar: "+_key+")"); return f; }
      dhVoiceDebug("⚠️ karakter kaydı VAR ("+saved.name+") ama cihazda o ses YOK → global'e düşüyor");
    } else {
      dhVoiceDebug("karakter kaydı yok (anahtar: "+_key+") → global'e bakılıyor");
    }
  }catch(e){}
  // 2) Karakter-özel yoksa: GLOBAL ayar (tüm karakterler için)
  try{
    const gv = JSON.parse(localStorage.getItem("dh-voice:__global__")||"null");
    if(gv && gv.name){
      const f2 = allVoices.find(v => v.name===gv.name);
      if(f2){ dhVoiceDebug("🌐 global ses: "+gv.name); return f2; }
      dhVoiceDebug("⚠️ global kayıt VAR ("+gv.name+") ama cihazda o ses YOK → varsayılana düşüyor");
    }
  }catch(e){}
  // 3) Hiç ayar yoksa: nötr İngilizce ses (cinsiyet önyargısı YOK — ayar sayfası tek karar mercii)
  const pool = voices.length ? voices : allVoices;
  dhVoiceDebug("varsayılan ses: "+((pool[0]&&pool[0].name)||"?"));
  return pool[0] || null;
}
/* Geçici teşhis: sohbette hangi sesin neden seçildiğini ekrana yazar.
   localStorage'da dh-voice-debug="1" ise görünür. Kapatmak için silinir. */
function dhVoiceDebug(msg){
  try{
    if(localStorage.getItem("dh-voice-debug")!=="1") return;
    var box=document.getElementById("dhVoiceDebugBox");
    if(!box){
      box=document.createElement("div"); box.id="dhVoiceDebugBox";
      box.style.cssText="position:fixed;left:8px;right:8px;bottom:8px;z-index:999999;background:#071226;color:#9fe8b0;border:1px solid #2e7d66;border-radius:10px;padding:10px 12px;font:12px/1.4 monospace;max-height:38vh;overflow:auto;white-space:pre-wrap";
      var x=document.createElement("button"); x.textContent="✕"; x.style.cssText="position:absolute;top:4px;right:6px;background:#334155;color:#fff;border:0;border-radius:6px;padding:2px 8px";
      x.onclick=function(){ box.remove(); try{localStorage.removeItem("dh-voice-debug");}catch(e){} };
      box.appendChild(x);
      document.body.appendChild(box);
    }
    var line=document.createElement("div"); line.textContent="🔊 "+msg;
    box.appendChild(line);
  }catch(e){}
}
try{ window.dhVoiceDebug = dhVoiceDebug; }catch(e){}
function avatarVoicePrefs(){
  try{ return JSON.parse(localStorage.getItem(avatarVoiceKey())||"null") || {}; }catch(e){ return {}; }
}

let avatar; let speechRun=0;
/* 🔤 KARMA DİL OKUMA: öğretmen Türkçe ipucu + İngilizce örnek karışık konuşur.
   Eski kod her şeyi en-US'a sabitliyordu ("Türkçe okumayı kesin engelle") —
   bu sefer tersi sorun çıkmıştı: Türkçe cümleler İngilizce aksanla okunuyordu.
   Doğrusu: cümle cümle dil tespiti — Türkçe karakter/kelime içeren parça TR
   sesiyle, gerisi İngilizce sesiyle sırayla okunur. */
function isTrChunk(s){
  s=String(s||"");
  if(/[ğüşöçıİĞÜŞÖÇ]/.test(s)) return true;
  return /\b(şimdi|şöyle|çünkü|doğru|yanlış|anlam|cümle|örnek|kural|yani|ipucu|harika|aferin|dene|deneyelim|hadi|tekrar|söyle|güzel|evet|hayır|bakalım|Türkçe)\b/i.test(s);
}
/* Sezgisel bolme: cumle cumle bakip Turkce isareti arar. YALNIZCA [[ ]]
   disinda kalan metin icin kullanilir. */
function splitHeuristic(text, chunks){
  var parts=String(text||"").replace(/\*\*/g,"").split(/\n+|(?<=[.!?…])\s+|(?<=:)\s+/).map(function(x){return x.trim();}).filter(Boolean);
  parts.forEach(function(p){
    var lang=isTrChunk(p)?"tr-TR":"en-US";
    var last=chunks[chunks.length-1];
    if(last && last.lang===lang) last.text+=" "+p;   // ardışık aynı dilde: birleştir (akıcılık)
    else chunks.push({text:p, lang:lang});
  });
}
/* ── [[ ]] KESIN SINYALDIR ──────────────────────────────────────────
   OLCULDU: AI Ingilizce bolumleri [[...]] ile isaretliyor (ekranda mavi
   .en-chunk span'i olarak gorunuyor) ama bu fonksiyon o isareti HIC
   kullanmiyordu; sadece cumle sinirina gore tahmin yuruyordu. Turkce bir
   cumlenin ICINE gomulu Ingilizce ("...icin [[Is this item from…]] kalibi
   kullanilir") ayri bir cumle olmadigi icin TR sayilip Turkce okunuyordu.
   Artik once [[ ]] bloklari ayrilir: ICI kesinlikle en-US, DISI eski
   sezgisel yolla degerlendirilir. */
function splitMixedSpeech(text){
  var s=String(text||"");
  var chunks=[], re=/\[\[([\s\S]*?)\]\]/g, i=0, m;
  while((m=re.exec(s))){
    if(m.index>i) splitHeuristic(s.slice(i,m.index), chunks);
    var en=String(m[1]||"").trim();
    if(en){
      var last=chunks[chunks.length-1];
      if(last && last.lang==="en-US") last.text+=" "+en;
      else chunks.push({text:en, lang:"en-US"});
    }
    i=m.index+m[0].length;
  }
  if(i<s.length) splitHeuristic(s.slice(i), chunks);
  return chunks.length?chunks:[{text:s, lang:"en-US"}];
}
/* Cihazdaki ilk INGILIZCE ses (pickVoice'un dil-bagimsiz secimine yedek) */
function pickEnVoice(){
  refreshVoices();
  var en=cachedVoices.filter(function(v){ return /^en/i.test(v.lang||""); });
  var iyi=en.find(function(v){ return /^en-US/i.test(v.lang||""); });
  return iyi || en[0] || null;
}
function pickTrVoice(){
  refreshVoices();
  var tr=cachedVoices.filter(function(v){ return /^tr/i.test(v.lang||""); });
  return tr[0] || cachedVoices.find(function(v){ return /turkish|türk/i.test(v.name||""); }) || null;
}
/* Seslendirmeye giden metin: markdown yildizlari ve bos [[ ]] bloklari
   temizlenir. Ayni temiz metin hem TTS'e hem agiz zaman cizelgesine
   gider — karakter hizalamasi bozulmasin diye tek yerde temizleniyor. */
function dhSesMetni(s){
  return String(s == null ? "" : s)
    .replace(/\[\[\s*([^A-Za-z0-9\]]*)\s*\]\]/g, "")   // icinde harf yok → at
    .replace(/\*\*([^*\n][^*]*?)\*\*/g, "$1")            // **kalin** → kalin
    .replace(/[ \t]{2,}/g, " ");
}
function speakText(text){
  text=dhSesMetni(text).trim();
  if(!text) return;
  try{ if(typeof dhVoiceDebug==="function") dhVoiceDebug("speakText çağrıldı → ses seçiliyor…"); }catch(e){}
  const run=++speechRun;
  try{speechSynthesis.cancel();}catch(e){}
  const duration=estimateDuration(text);
  avatar.speakText(text, duration+300);
  try{ window.dispatchEvent(new CustomEvent("dh-speech-start",{detail:{text:text}})); }catch(e){}
  const vp=avatarVoicePrefs();
  const chunks=splitMixedSpeech(text);
  let ci=0;
  let spokenChars=0;                                   // bu parçadan önce söylenen karakterler
  const totalChars=chunks.reduce((a,c)=>a+c.text.length,0) || text.length;
  function finishAll(){
    if(run!==speechRun) return;
    avatar.stop();
    try{ window.dispatchEvent(new CustomEvent("dh-speech-end")); }catch(e){}
    try{ window.dispatchEvent(new CustomEvent("dh-konusma-bitti")); }catch(e){}
    if(window.__dhAuto){ setTimeout(function(){ try{ var mb=document.getElementById("micBtn"); if(mb&&!mb.classList.contains("listening")) mb.click(); }catch(e){} }, 400); }
  }
  function speakNext(){
    if(run!==speechRun) return;              // yeni konuşma başladı: bu kuyruk iptal
    if(ci>=chunks.length){ finishAll(); return; }
    const c=chunks[ci++];
    /* Avatar katmani bu olayi dinleyip Ingilizce parcada teacher2'ye
       geciyor. chat-core agiz/zamanlama zincirine hic dokunulmadi. */
    try{ window.dispatchEvent(new CustomEvent("dh-konusma-dili",{detail:{lang:c.lang}})); }catch(e){}
    try{
      const u=new SpeechSynthesisUtterance(c.text);
      if(c.lang==="tr-TR"){
        const tv=pickTrVoice();
        if(tv) u.voice=tv;
        u.lang="tr-TR";
        u.rate=vp.rate || .96;
        u.pitch=1;                            // TR seslerinde düşük pitch doğal durmuyor
      } else {
        /* OLCULDU: pickVoice() kayitli ses adini TUM diller icinde ariyor
           (allVoices). Ses ayarlarinda Turkce bir ses secilmisse Ingilizce
           parcaya da o ses atanip u.lang="tr-TR" oluyor ve her sey Turkce
           okunuyordu. Ingilizce parca ancak INGILIZCE bir sesle okunur;
           kayitli ses Ingilizce degilse cihazdaki ilk Ingilizce sese
           dusulur, o da yoksa ses atanmadan u.lang="en-US" birakilir. */
        let voice=pickVoice();
        if(voice && !/^en/i.test(voice.lang||"")) voice=pickEnVoice();
        if(voice){ u.voice=voice; u.lang=voice.lang || "en-US"; }
        else { u.lang="en-US"; }
        u.rate=vp.rate || .96;
        u.pitch=vp.pitch != null ? vp.pitch : .78;
      }
      u.__dhMixed=true;                       // global karma-dil patch'i atla (biz zaten böldük)
      u.__longTTSAvatarSync=true;             // long-avatar patch'ini de atla
      /* Ağzı sesin gerçek konumuna hizala: bu parçadan önce söylenmiş karakter
         sayısı + parça içindeki konum, tüm metne oranlanıyor. */
      const _base = spokenChars;
      u.onboundary = function(ev){
        if(run!==speechRun) return;
        if(!ev || (ev.name && ev.name!=="word")) return;
        const ci2 = (typeof ev.charIndex==="number") ? ev.charIndex : 0;
        avatar.alignToChar(_base + ci2);
      };
      spokenChars += c.text.length;
      let done=false;
      function go(){ if(done) return; done=true; clearTimeout(wd);
        /* Son parça bittiyse ağzı beklemeden durdur. Eskiden finishAll'a
           60 ms'lik bir setTimeout zinciriyle gidiliyordu ve o arada ağız
           oynamaya devam ediyordu. */
        if(ci>=chunks.length && run===speechRun) avatar.stop();
        setTimeout(speakNext,60); }
      var wd=setTimeout(go, Math.max(4000, c.text.length*80)+1500);  // onend gelmezse takılma
      u.onend=go; u.onerror=go;
      speechSynthesis.speak(u);
    }catch(e){ speakNext(); }
  }
  try{ whenVoicesReady(function(){ try{ speakNext(); }catch(e){ setTimeout(function(){ if(run===speechRun) avatar.stop(); }, duration); } }); }
  catch(e){ setTimeout(function(){ if(run===speechRun) avatar.stop(); }, duration); }
}
async function explainText(text){
  $("explainSheet").classList.add("open");
  $("explainText").textContent="Yükleniyor...";
  if(!(window.DHProviders&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey())&&!getKeys().length){
    $("explainText").textContent="Profilinden API veya Gemini kullanımını seçmelisin.";
    return;
  }
  try{
    const reply=await groqChat([{role:"system", content:"You are a Turkish-speaking English teacher. Translate the sentence into Turkish and briefly explain key vocabulary or grammar. Maximum 3 short Turkish sentences."},{role:"user", content:text}]);
    $("explainText").textContent=reply || "Açıklama alınamadı.";
  }catch(e){ $("explainText").textContent="Açıklama alınamadı. AI tercihini kontrol et veya tekrar dene."; }
}
async function analyzeChatErrors(){
  const b=$("errSaveBtn"); if(!b) return;
  const userMsgs=State.history.filter(m=>m.role==="user").map(m=>m.content).slice(-12);
  if(!userMsgs.length){ b.textContent="—"; setTimeout(()=>b.textContent="📝",1200); return []; }
  if(!(window.DHProviders&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey())) return null;
  b.textContent="⏳";
  try{
    const sys="You are an English error analyzer for a Turkish learner. Given the learner's chat messages, list ONLY real grammar/vocabulary errors as JSON array: [{\"wrong\":\"...\",\"correct\":\"...\",\"tr\":\"kısa Türkçe açıklama\"}]. Max 5. If no errors return []. JSON only, no prose.";
    const out=await DHProviders.chat([{role:"system",content:sys},{role:"user",content:userMsgs.join("\n")}]);
    let arr=[]; try{ arr=JSON.parse(String(out).replace(/```json|```/g,"").trim()); }catch(e){}
    if(!Array.isArray(arr)) arr=[];
    if(arr.length && window.LearningErrorDB && LearningErrorDB.bulkMerge){
      const now=Date.now();
      const recs=arr.slice(0,5).map((r,i)=>({
        id:"chat_"+now+"_"+i, sentenceId:"", type:"chat-grammar", source:"chat",
        sentenceEN:String(r.correct||""), sentenceTR:String(r.tr||""),
        answer:String(r.wrong||""), score:40, ts:now
      }));
      await LearningErrorDB.bulkMerge(recs);
      try{ window.dispatchEvent(new Event("learning-errors-cleared")); }catch(e){}
    }
    b.textContent="✓"+arr.length;
    if(arr.length===0 && userMsgs.length>=6 && !window.__dhLevelTipShown){
      window.__dhLevelTipShown=true;
      var order=["A1","A2","B1","B2","C1"], nx=order[order.indexOf(State.level)+1];
      if(nx && confirm("Bu oturumda hiç hata bulunamadı — seviyeyi "+nx+" yapalım mı?")){
        var ob=document.querySelector('.levelOpt[data-level="'+nx+'"]'); if(ob) ob.click();
      }
    }
    setTimeout(()=>{ b.textContent="📝"; },2000);
    return arr;
  }catch(e){ b.textContent="⚠"; setTimeout(()=>{ b.textContent="📝"; },2000); return null; }
}

async function finishSession(){
  var userMsgs=State.history.filter(function(m){return m.role==="user";});
  var words=userMsgs.reduce(function(n,m){return n+String(m.content||"").trim().split(/\s+/).filter(Boolean).length;},0);
  var done=__dhTasks.filter(function(_,i){return __dhTaskDone[i];}).length;
  var total=__dhTasks.length;
  var result=null;
  if(userMsgs.length) result=await analyzeChatErrors();
  var errorCount=Array.isArray(result)?result.length:null;
  var headline=!userMsgs.length?"Henüz konuşma başlamadı":errorCount===0?"Temiz ve akıcı bir oturumdu":errorCount>0?"İyi ilerledin; şimdi hataları pekiştirelim":"Oturumun cihazına kaydedildi";
  var detail=userMsgs.length+" mesaj · "+words+" İngilizce kelime"+(total?" · "+done+"/"+total+" hedef":"");
  var next=errorCount>0?"Bir sonraki en iyi adım: konuşmada yakalanan "+errorCount+" hatayı kısa telafi oturumunda yeniden kurmak.":errorCount===0?"Bir sonraki en iyi adım: aynı seviyede yeni bir senaryoya geçmek.":"AI analizi olmadan da konuşma süren ve tamamlanan hedeflerin kaydedildi.";
  $("summaryText").innerHTML='<p style="font-size:18px;font-weight:800;margin:0 0 8px">'+esc(headline)+'</p><p style="color:#9fb3d9;margin:0 0 12px">'+esc(detail)+'</p><p style="line-height:1.55">'+esc(next)+'</p>';
  $("summaryPractice").style.display=errorCount>0?"inline-flex":"none";
  $("summarySheet").classList.add("open");
  try{
    if(localStorage.getItem("dh-chat-history-enabled")==="1" && userMsgs.length){
      var archive=JSON.parse(localStorage.getItem("dh-chat-history-v1")||"[]")||[];
      archive.unshift({id:Date.now(),at:new Date().toISOString(),scenario:(Scenario&&Scenario.title)||"Sohbet",level:State.level,messages:State.history.slice(-40)});
      localStorage.setItem("dh-chat-history-v1",JSON.stringify(archive.slice(0,30)));
    }
  }catch(e){}
  try{window.dhLogActivity&&window.dhLogActivity("✓ Konuşma oturumu tamamlandı: "+userMsgs.length+" mesaj","chat-summary",{score:errorCount===0?100:null,module:(Scenario&&Scenario.title)||""});}catch(e){}
}

document.addEventListener("click",function(e){
  if(e.target&&e.target.id==="errSaveBtn") analyzeChatErrors();
  if(e.target&&e.target.id==="autoBtn"){ window.__dhAuto=!window.__dhAuto; e.target.style.background=window.__dhAuto?"#16a34a":"#334155"; }
});
setTimeout(dhRenderTasks, 800);
async function suggestReply(){
  if(State.busy) return;
  const input=$("textIn");
  const sBtn=$("suggestBtn");
  await ensureStorageReady();
  if(!(window.DHProviders&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey())&&!getKeys().length){ $("keySheet").classList.add("open"); return; }
  const prev=sBtn ? sBtn.textContent : "";
  if(sBtn){ sBtn.disabled=true; sBtn.textContent="⏳"; }
  try{
    // Sohbet bağlamına göre, kullanıcının SÖYLEYEBİLECEĞİ uygun bir İngilizce cevap öner.
    const sys = systemPrompt()
      + "\n\nNOW: The USER is stuck and wants a suggested reply. Based on the conversation so far and the partner's last message, write ONE natural English sentence that the USER (the learner) could say next. "
      + "Match the learner's level ("+State.level+"): keep it simple and appropriate. "
      + "Reply with ONLY that single English sentence — no quotes, no Turkish, no explanation.";
    const messages=[{role:"system",content:sys},{role:"assistant",content:__dhOpener()},...State.history.slice(-6),
      {role:"user",content:"(Suggest what I could say next — English only, one sentence.)"}];
    let reply=await groqChat(messages);
    reply=String(reply||"").trim().replace(/^["'“”]+|["'“”]+$/g,"").split("\n")[0].trim();
    if(reply){
      input.value=reply;
      input.dispatchEvent(new Event("input"));
      input.focus();
      // imleci sona al
      try{ input.setSelectionRange(reply.length, reply.length); }catch(e){}
    }
  }catch(e){
    // sessiz: öneri alınamazsa kutuyu boş bırak
  }finally{
    if(sBtn){ sBtn.disabled=false; sBtn.textContent=prev||"💡"; }
  }
}

async function sendUser(){
  const input=$("textIn");
  const text=input.value.trim();
  if(!text || State.busy) return;
  /* Gemini'nin RAPOR JSON'u yanlislikla/kolaylikla ana mesaj kutusuna
     yapistirilabilir. Bunu AI'ye yeni mesaj olarak gonderme: yerelde rapor
     olarak isle, gorevleri tamamla ve kullaniciya bitis ekranini goster. */
  if(window.DHGeminiRapor && DHGeminiRapor.uygula &&
     /[\"']?hedefUlasildi[\"']?\s*:/.test(text) &&
     /[\"']?(basari|ozet)[\"']?\s*:/.test(text)){
    try{
      DHGeminiRapor.uygula(text);
      input.value="";
      input.style.height="auto";
    }catch(e){
      alert("Gemini raporu okunamadı: "+(e&&e.message?e.message:"Geçersiz rapor"));
    }
    return;
  }
  State.busy=true;
  State.abortController=new AbortController();
  $("sendBtn").disabled=false;
  $("sendBtn").textContent="■";
  $("sendBtn").title="AI isteğini iptal et";
  addBubble("user", text);
  input.value="";
  input.style.height="auto";
  addBubble("assistant", "", {typing:true});

  await ensureStorageReady();
  if(!(window.DHProviders&&DHProviders.hasAnyKey&&DHProviders.hasAnyKey())&&!getKeys().length){
    removeTyping();
    $("keySheet").classList.add("open");
    State.currentPartner = Scenario.noKeyReply;
    addBubble("assistant", State.currentPartner);
    speakText(State.currentPartner);
    State.busy=false;
    State.abortController=null;
    $("sendBtn").disabled=false;
    $("sendBtn").textContent="➤";
    $("sendBtn").title="Gönder";
    return;
  }
  try{
    State.history.push({role:"user",content:text});
    // GÜVENCE: "soru sor" türü görevler AI'nin [TASK_DONE] işaretine güvenmeden de tespit edilir
    try{
      var isQuestion = /\?\s*$/.test(text.trim()) || /^\s*(is|are|do|does|did|can|could|will|would|what|where|when|why|how|who|which)\b/i.test(text.trim());
      if(isQuestion){
        __dhTasks.forEach(function(t,i){
          if(!__dhTaskDone[i] && /soru\s*sor/i.test(t)){ __dhTaskDone[i]=true; setTimeout(dhRenderTasks,50); }
        });
      }
    }catch(e){}
    const messages=[{role:"system",content:systemPrompt()},{role:"assistant",content:State.firstMsg},...State.history.slice(-6)];
    const reply=await groqChat(messages,{signal:State.abortController.signal,timeoutMs:25000});
    removeTyping();
    State.currentPartner=dhStripTasks(reply) || "Could you please say that again?";
    try{
      window.dhLogActivity && window.dhLogActivity(
        "💬 Sohbet: \""+(text||"").slice(0,60)+"\"",
        "chat",
        { target:Scenario&&Scenario.title, answer:text, module:(Scenario&&Scenario.title)||"", score:null,
          // AI'nin cevabı + hangi görevlerin o an tamamlanmış olduğu da saklanır (derin analiz için)
          types:(function(){ try{ return __dhTasks.map(function(t,i){ return __dhTaskDone[i]?("✓"+t):null; }).filter(Boolean); }catch(e){ return undefined; } })()
        }
      );
      // AI'nin cevabını AYRI bir kayıt olarak da tut (kullanıcı mesajından ayrı, karışmasın)
      window.dhLogActivity && window.dhLogActivity(
        "🤖 Yanıt: \""+String(State.currentPartner||"").slice(0,80)+"\"", "chat-reply",
        { target:State.currentPartner, module:(Scenario&&Scenario.title)||"" }
      );
      window.dhBumpDailyTracker && window.dhBumpDailyTracker("lesson");
      window.dhCoachMarkStepDone && window.dhCoachMarkStepDone(location.pathname.split("/").pop()||"chat.html");
      try{ window.dhCoachChainBump && window.dhCoachChainBump(); }catch(e){}
    }catch(e){}
    State.history.push({role:"assistant",content:State.currentPartner});
    addBubble("assistant", State.currentPartner);
    speakText(State.currentPartner);
  }catch(e){
    removeTyping();
    let msg="Bir sorun oldu. Tekrar deneyelim.";
    if(e.code==="rate") msg="Tüm AI sağlayıcıların limiti doldu. 💎 ile Gemini'de devam edebilir ya da Ayarlar'dan Cerebras/Gemini anahtarı ekleyebilirsin.";
    else if(e.code==="bad-key") msg="API anahtarı geçersiz görünüyor.";
    else if(e.code==="network") msg="İnternet bağlantısı kontrol edilmeli.";
    else if(e.code==="timeout") msg="AI yanıtı 25 saniyede gelmedi. Mesajın kutuya geri kondu; tekrar deneyebilirsin.";
    else if(e.code==="cancelled") msg="İstek iptal edildi. Mesajın kutuya geri kondu.";
    if((e.code==="timeout"||e.code==="cancelled")&&!input.value){input.value=text;input.dispatchEvent(new Event("input"));}
    State.currentPartner=msg;
    addBubble("assistant", msg);
  }finally{
    State.busy=false;
    State.abortController=null;
    $("sendBtn").disabled=false;
    $("sendBtn").textContent="➤";
    $("sendBtn").title="Gönder";
  }
}
function setupEvents(){
  $("closeExplain").onclick=()=>$("explainSheet").classList.remove("open");
  $("levelBtn").onclick=()=>$("levelSheet").classList.add("open");
  $("closeLevel").onclick=()=>$("levelSheet").classList.remove("open");
  document.querySelectorAll(".levelOpt").forEach(btn=>btn.onclick=()=>{
    State.level=btn.dataset.level;
    localStorage.setItem("chat:level:"+safeId(Scenario.title + ":" + (Scenario.avatarDir||"")), State.level);
    $("levelBtn").textContent=State.level;
    $("subtitle").textContent=Scenario.subtitle + " · " + State.level;
    $("levelSheet").classList.remove("open");
  });
  $("textIn").addEventListener("input",e=>{ e.target.style.height="auto"; e.target.style.height=Math.min(120,e.target.scrollHeight)+"px"; });
  $("textIn").addEventListener("keydown",e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendUser(); } });
  $("sendBtn").onclick=function(){if(State.busy&&State.abortController){State.abortController.abort();return;}sendUser();};
  const sBtn=$("suggestBtn");
  if(sBtn) sBtn.onclick=suggestReply;
  var gB=$("gemBtn"); if(gB) gB.onclick=continueInGemini;
  var fB=$("finishBtn"); if(fB) fB.onclick=finishSession;
  $("closeSummary").onclick=()=>$("summarySheet").classList.remove("open");
  if(STT){
    let rec=null,listening=false;
    $("micBtn").onclick=()=>{
      if(listening && rec){ rec.stop(); return; }
      rec=new STT();
      rec.lang="en-US";
      rec.interimResults=false;
      rec.maxAlternatives=1;
      rec.onstart=()=>{listening=true; $("micBtn").classList.add("listening");};
      rec.onerror=()=>{};
      rec.onresult=ev=>{ $("textIn").value=ev.results[0][0].transcript; $("textIn").dispatchEvent(new Event("input")); };
      rec.onend=()=>{ listening=false; $("micBtn").classList.remove("listening"); if($("textIn").value.trim()) sendUser(); };
      try{ rec.start(); }catch(e){}
    };
  }else{ $("micBtn").disabled=true; }
  $("closeKey").onclick=()=>$("keySheet").classList.remove("open");
  $("saveKey").onclick=()=>{
    const k=$("keyInput").value.trim();
    if(!k || !k.startsWith("gsk_")){
      $("keyNote").textContent="Anahtar gsk_ ile başlamalı.";
      $("keyNote").className="note bad";
      return;
    }
    saveKey(k);
    $("keyNote").textContent="Anahtar kaydedildi.";
    $("keyNote").className="note";
    $("keySheet").classList.remove("open");
  };
}
/* #4: her sohbet TAZE bir konuyla baslasin; son konular saklanip tekrarlanmasin. */
function genFreshOpener(cb){
  try{
    var idKey="chat:recent:"+safeId(Scenario.title+":"+(Scenario.avatarDir||""));
    var recent=[]; try{ recent=JSON.parse(localStorage.getItem(idKey)||"[]")||[]; }catch(e){}
    var sys="You are "+(Scenario.role||Scenario.title||"a friendly English conversation partner")
      +". Start a BRAND NEW English conversation with a Turkish learner at level "+State.level
      +". Pick a FRESH everyday topic that is NOT one of these recent topics: "+(recent.join(", ")||"(none)")
      +". Greet very briefly and ask ONE natural opening question to get them talking. 1-2 short level-appropriate sentences. "
      +"Return ONLY the opener line, then a new line: TOPIC: <two-word topic>.";
    groqChat([{role:"system",content:sys},{role:"user",content:"Start now."}]).then(function(out){
      var txt=String(out||"").trim();
      var tm=txt.match(/TOPIC:\s*(.+)$/im); var topic=tm?tm[1].trim():"";
      var opener=txt.replace(/TOPIC:.*$/im,"").trim();
      if(topic){ recent.unshift(topic); recent=recent.slice(0,6); try{ localStorage.setItem(idKey, JSON.stringify(recent)); }catch(e){} }
      cb(opener||null);
    }).catch(function(){ cb(null); });
  }catch(e){ cb(null); }
}
/* #5: sohbeti Gemini'de surdur — konusmayi prompt olarak panoya kopyala, Gemini'yi ac. */
function continueInGemini(){
  try{
    var lines=(State.history||[]).map(function(m){ return (m.role==="user"?"Student: ":"Partner: ")+m.content; });
    var convo=(State.firstMsg?("Partner: "+State.firstMsg+"\n"):"")+lines.join("\n");
    var prompt;
    if(__dhDersModu){
      /* DERS: Gemini'de de AYNI kurulumla devam edilsin — ogretmen kimligi,
         Turkce ogretme kurali, ortam, gunun cumleleri ve [[ ]] sozlesmesi.
         Yoksa Gemini'ye gecince ders bitiyor, duz sohbete donuyordu. */
      var mm = __dhMalzeme;
      prompt = "Sen Türkçe konuşan bir İngilizce öğretmenisin. Bir Türk öğrenciyle "
        + "çalışıyorsun (seviye " + State.level + ").\n\n"
        + "KURALLAR:\n"
        + "· Açıklama, düzeltme, yönerge ve övgü HER ZAMAN Türkçe. Sadece öğretilen "
        + "malzeme (hedef cümleler, örnekler, öğrenciden istediğin ifadeler) İngilizce.\n"
        + "· Her İngilizce ifadeyi [[çift köşeli parantez]] içine al.\n"
        + "· Hata düzeltirken tek satırla geçiştirme: neyin yanlış olduğunu söyle, "
        + "kuralı ve nedenini 2-3 Türkçe cümleyle anlat, doğrusunu ver, aynı kuralla "
        + "bir örnek daha ekle ve öğrenciden yeni bir cümle kurmasını iste.\n"
        + "· Cümlesi seviyesine göre doğruysa onayla ve ilerle; hata UYDURMA. "
        + "Noktalama ve büyük harf hatası sayılmaz.\n"
        + "· Olan biteni anlatma; öğret.\n"
        + (mm && mm.ortam ? ("· Ders şu ortamda geçiyor: " + mm.ortam + ". Gerektiğinde "
            + "\"Şimdi ben " + dhRolTr() + " olayım\" deyip 1-2 tur canlandır, sonra "
            + "öğretmene dön.\n") : "")
        + (mm && mm.cumleler && mm.cumleler.length
            ? ("\nBUGÜNÜN ÇALIŞILAN CÜMLELERİ (öğrenciye bu kalıpları ÜRETTİR, "
               + "cümleleri okuma):\n"
               + mm.cumleler.map(function(c,i){
                   return (i+1)+") [[" + c.en + "]]" + (c.kalip?("  kalıp: "+c.kalip):"");
                 }).join("\n") + "\n")
            : "")
        + "\nŞu ana kadarki konuşmamız:\n\n" + convo
        + "\n\nBu dersi yukarıdaki kurallarla, kaldığımız yerden SÜRDÜR.";
    } else {
      prompt = "Sen \""+(Scenario.role||Scenario.title||"a friendly English conversation partner")+"\" rolundesin. Bir Turk ogrenciyle Ingilizce konusma pratigi yapiyoruz (seviye "+State.level+"). Su ana kadarki konusmamiz:\n\n"+convo+"\n\nBu sohbeti AYNI rolde, Ingilizce, seviyeme uygun sekilde kaldigimiz yerden SURDUR; gerektiginde kisa Turkce ipucu ver.";
    }
    /* RAPOR SOZLESMESI — Gemini'de yapilan calisma uygulamaya geri donsun.
       Prompt'un sonuna "RAPOR yazinca sadece su JSON'u dondur" sartini
       ekler. Ogrenci Gemini'de bitirince RAPOR yazar, cikan JSON'u 📊
       dugmesiyle uygulamaya yapistirir; puan/hata/sayac oraya islenir.
       Bkz. gemini-sohbet-rapor.js */
    try{ if(window.DHGeminiRapor && DHGeminiRapor.sozlesme) prompt += DHGeminiRapor.sozlesme(); }catch(e){}

    try{ if(navigator.clipboard) navigator.clipboard.writeText(prompt); }catch(e){}
    try{ window.open("https://gemini.google.com/app","_blank"); }catch(e){}
    try{
      addBubble("assistant", window.DHGeminiRapor
        ? "💎 Sohbet panoya kopyalandı ve Gemini açıldı — oraya yapıştırıp devam et. Bitirince Gemini'ye tek başına RAPOR yaz, çıkan JSON'u kopyala ve buradaki 📊 düğmesine yapıştır: puanın, hataların ve günlük sayacın buna göre güncellenir."
        : "💎 Sohbet panoya kopyalandi ve Gemini acildi — oraya yapistirip devam edebilirsin.");
    }catch(e){}
  }catch(e){}
}
function boot(){
  buildUI();
  avatar=new PhotoAvatar($("avatarImg"));
  avatar.init();
  setupEvents();
  /* Malzeme varsa genFreshOpener CAGRILMAZ: rastgele "taze konu" uretimi
     malzeme acilisini ezer ve sikayet aynen geri gelir. */
  var generic = !(__dhTeach&&__dhTeach.target) && !__dhFocus && !__dhMalzeme;
  /* Acilis metni arka planda kendiliginden Gemini penceresi acmasin. Web
     koprusu yalniz kullanicinin sohbet/dugme eylemiyle baslar. */
  var directAI=(window.DHProviders&&DHProviders.realHasAnyKey&&DHProviders.realHasAnyKey())||getKeys().length;
  if(generic && directAI){
    addBubble("assistant", "", {typing:true});
    genFreshOpener(function(op){
      removeTyping();
      if(op){ State.currentPartner=op; State.firstMsg=op; }
      addBubble("assistant", State.currentPartner);
      setTimeout(function(){ speakText(State.currentPartner); }, 250);
    });
  } else {
    addBubble("assistant", State.currentPartner);
    setTimeout(function(){ speakText(State.currentPartner); }, 450);
  }
}
document.addEventListener("DOMContentLoaded", boot);
})();
