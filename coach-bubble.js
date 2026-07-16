/* coach-bubble.js — GLOBAL AI KOÇ BALONU (yüzlü, tüm sayfalarda tek dosya)
   Kullanım: <script src="./coach-bubble.js"></script> — başka hiçbir şey gerekmez.
   Dışa açık API:
     window.dhCoachSay(msg, kind, faceOverride)   — doğrudan bir mesaj göster
     window.dhCoachEvaluate(opts)                  — cevap değerlendirmesinden karar üretir ve gösterir
       opts: {sentenceId, en, answer, ok, commonMistake}
   Tüm kararlar YEREL veriye (hata defteri geçmişi) dayanır — AI çağrısı YOK, anlık ve ücretsiz.
*/
(function(){
  "use strict";
  if(window.__dhCoachInstalled) return;
  window.__dhCoachInstalled = true;

  /* ÖNEMLİ DÜZELTME: "sayfayı ziyaret etmek" görev tamamlama için ARTIK yeterli değil —
     meşale/hedef gerçek cevaplara bakarken, adım işaretleri yalnız ziyarete bakıyordu ve
     bu ikisi çelişiyordu (3 görev "tamamlandı" görünürken meşale "0 gün" kalabiliyordu).
     Artık "görev tamamlandı" da SADECE gerçek etkileşimde (dhCoachEvaluate/sohbet mesajı) işaretlenir. */
  var __dhPage=(location.pathname.split("/").pop()||"index.html");
  window.dhCoachMarkStepDone=function(page){
    try{ var k="dh-koc-steps-done-"+new Date().toISOString().slice(0,10); var s=JSON.parse(localStorage.getItem(k)||"{}")||{}; s[page]=1; localStorage.setItem(k, JSON.stringify(s)); }catch(e){}
  };

  /* ---------- 🔗 GÜNLÜK PLAN ZİNCİRİ ----------
     ~10 gerçek etkileşimden sonra: bu sayfa bugünkü planın bir adımıysa,
     koç "adım tamam ✅ sıradaki: ..." balonuyla bir SONRAKİ adımın linkini uzatır.
     Kullanıcı menüye dönmeden günü koçun elinden bitirir. Sayfa başına günde 1 kez. */
  function dhToday(){ return new Date().toISOString().slice(0,10); }
  function dhEpoch(){
    try{ return JSON.parse(localStorage.getItem("dh-koc-epoch-"+dhToday())||"null")||null; }catch(e){ return null; }
  }
  /* Bugünün sayaçları — "Sonraki günü başlat" sıfır noktası düşülmüş hali.
     Karne, efor, övgü ve temiz-gün metni hep bunu kullanır. */
  function dhRecToday(){
    var rec={}; try{ var __t=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}; rec=(__t.days||{})[dhToday()]||{}; }catch(e){}
    var ep=dhEpoch();
    if(!ep) return rec;
    return { lessons:Math.max(0,(rec.lessons||0)-(ep.lessons||0)),
             sentences:Math.max(0,(rec.sentences||0)-(ep.sentences||0)),
             reviews:Math.max(0,(rec.reviews||0)-(ep.reviews||0)),
             videos:Math.max(0,(rec.videos||0)-(ep.videos||0)) };
  }
  function dhEffortNow(){
    var d=dhRecToday(); return (d.sentences||0)+(d.reviews||0);
  }
  /* Gün kapalı mı? Bayrak {t,effort} tutar; kapanıştan sonra +5 efor birikirse
     "demek ki devam ediyorsun" deyip günü OTOMATİK yeniden açar. Eski "1" biçimi
     de kapalı sayılır (geri uyum). */
  function dhDayClosed(){
    try{
      var raw=localStorage.getItem("dh-day-closed-"+dhToday()); if(!raw) return false;
      var o=null; try{ o=JSON.parse(raw); }catch(e){}
      if(o && typeof o.effort==="number" && dhEffortNow()>=o.effort+5){
        localStorage.removeItem("dh-day-closed-"+dhToday()); return false;
      }
      return true;
    }catch(e){ return false; }
  }
  /* GÜNÜN KARNESİ — kapanma şartlarının tek doğruluk kaynağı.
     Profesyonel kural: SRS uygulamasında TEKRAR pazarlık konusu değildir.
       • Tekrar: bekleyen varsa en az min(10, bekleyen) tekrar ŞART
       • Cümle:  en az 5 cümle çalışması (üretim/yeni öğrenme)
     Gün ancak TÜM şartlar sağlanınca "hakkıyla" kapanır; kapanış turu da
     +N efor değil, bu karneyi geçmekle tamamlanır. */
  var __dueCache={t:0,v:null};
  function dhCountDueSRS(){
    return new Promise(function(res){
      if(Date.now()-__dueCache.t<60000 && __dueCache.v!=null) return res(__dueCache.v);
      try{
        var r=indexedDB.open("sentence-mode",1);
        r.onsuccess=function(){ var db=r.result, n=0, now=Date.now();
          try{
            var q=db.transaction("kv","readonly").objectStore("kv").openCursor();
            q.onsuccess=function(e){ var c=e.target.result;
              if(c){ var k=String(c.key), v=c.value||{};
                if((k.indexOf("srs:")===0||k.indexOf("wsrs:")===0) && (v.due||0)<=now) n++;
                c.continue();
              } else { db.close(); __dueCache={t:Date.now(),v:n}; res(n); } };
            q.onerror=function(){ try{db.close()}catch(_){} res(null); };
          }catch(e2){ try{db.close()}catch(_){} res(null); }
        };
        r.onerror=function(){ res(null); };
      }catch(e){ res(null); }
    });
  }
  async function dhDayRequirements(){
    var rec=dhRecToday();
    /* bekleyen tekrar: ÖNCE canlı SRS sayımı (cümle srs: + kelime wsrs:);
       DB okunamazsa plandaki dueCount'a düşer. Plandaki sayı üretim anında
       0 kalabildiği için tek başına GÜVENİLMEZ — karnenin çökme nedeni buydu. */
    var due=null; try{ due=await dhCountDueSRS(); }catch(e){}
    if(due==null){ try{ var pl=JSON.parse(localStorage.getItem("dh-koc-plan-"+dhToday())||"null"); due=(pl&&pl.dueCount)||0; }catch(e){ due=0; } }
    var items=[];
    var needRev=Math.min(10, due);
    items.push({key:"rev", label:"Tekrar (SRS)", got:rec.reviews||0, need:needRev,
                ok:(rec.reviews||0)>=needRev, href:"./tekrar.html?plan=1", cta:"⚡ Tekrarları yap"});
    items.push({key:"prod", label:"Cümle çalışması", got:rec.sentences||0, need:5,
                ok:(rec.sentences||0)>=5, href:"./index-app.html", cta:"📖 Cümle çalış"});
    return { ok: items.every(function(i){return i.ok;}), items:items, rec:rec, due:due };
  }
  /* Kapanış turu: kullanıcıyı tekrar sayfasına gönderdiysek koç SUSAR.
     Durumlar: 0=tur yok · 1=tur sürüyor (teklifi bastırır) · 2=tur bitti (+8 efor
     birikti → kutlamalı teklif). 45 dk sonra bayat tur kendiliğinden düşer. */
  function dhTourState(req){
    try{
      var raw=localStorage.getItem("dh-close-tour"); if(!raw) return 0;
      var o=JSON.parse(raw);
      /* "tamamlandı" kalıcıdır — okuma bayrağı TÜKETMEZ (aksi halde aynı sayfadaki
         ikinci kontrol bayrağı bulamayıp kutlamanın üstüne sıradan teklif yazıyordu).
         Bayrağı ancak günün kapanması (dhCoachDayClose) ya da 12 saat düşürür. */
      if(o.done){ if(Date.now()-(o.t||0)>12*3600000){ localStorage.removeItem("dh-close-tour"); return 0; } return 2; }
      if(req && req.ok){
        localStorage.setItem("dh-close-tour", JSON.stringify({done:1, t:o.t||Date.now()}));
        return 2;
      }
      if(Date.now()-(o.t||0)<45*60000) return 1;
      localStorage.removeItem("dh-close-tour"); return 0;
    }catch(e){ return 0; }
  }
  window.dhCoachReopenDay=function(){
    /* Yeniden açmak = taze oturum: kilit KALKAR, plan adımlarının ✓ işaretleri
       SIFIRLANIR (yeşil/üstü çizili kalmasın — kullanıcı isteği). Plan ve tüm
       öğrenme verileri korunur; kart güncel görünsün diye sayfa tazelenir. */
    try{ localStorage.removeItem("dh-day-closed-"+dhToday()); }catch(e){}
    try{ localStorage.removeItem("dh-koc-steps-done-"+dhToday()); }catch(e){}
    try{ localStorage.removeItem("dh-close-tour"); }catch(e){}
    try{ window.dhCoachSay("Gün yeniden açıldı — adımlar sıfırlandı, haydi baştan 💪","praise"); }catch(e){}
    try{ setTimeout(function(){ location.reload(); }, 1300); }catch(e){}
  };
  function dhPlanSteps(){ try{ var p=JSON.parse(localStorage.getItem("dh-koc-plan-"+dhToday())||"null"); return (p&&p.steps)||[]; }catch(e){ return []; } }
  function dhStepsDone(){ try{ return JSON.parse(localStorage.getItem("dh-koc-steps-done-"+dhToday())||"{}")||{}; }catch(e){ return {}; } }
  var __chainN=0;
  window.dhCoachChainBump=function(){
    __chainN++;
    if(__chainN!==10) return;
    try{
      var steps=dhPlanSteps(); if(!steps.length) return;
      var isStep=steps.some(function(st){ return String(st.href||"").split("?")[0]===__dhPage; });
      if(!isStep) return;
      var G="dh-koc-chain-"+dhToday()+"-"+__dhPage;
      if(localStorage.getItem(G)) return;
      localStorage.setItem(G,"1");
      window.dhCoachMarkStepDone(__dhPage);
      var done=dhStepsDone(), next=null;
      for(var i=0;i<steps.length;i++){
        var pg=String(steps[i].href||"").split("?")[0];
        if(pg!==__dhPage && !done[pg]){ next=steps[i]; break; }
      }
      if(next){
        window.dhCoachSay("Bu adımı hakkıyla çalıştın ✅ Plandaki sıradaki adım: "+(next.label||"devam"),"praise",null,
          {actionHref:"./"+next.href, actionLabel:"▶ Devam et"});
      } else {
        window.dhCoachSay("GÜNÜN PLANI TAMAM! 🎉 Günü kapatmadan önce bugünün hatalarından kısa bir ders çıkaralım mı?","praise",null,{dayClose:true});
      }
    }catch(e){}
  };
  /* index-app'te dhCoachEvaluate çağrılmaz (React) — kart notlama (.grade-bar)
     tıklamalarını etkileşim sinyali olarak kullan */
  if(__dhPage==="index-app.html"){
    document.addEventListener("click",function(e){
      try{
        if(e.target && e.target.closest && e.target.closest(".grade-bar")){
          window.dhCoachMarkStepDone(__dhPage);
          window.dhCoachChainBump();
        }
      }catch(err){}
    }, true);
  }

  /* ---------- 📋 GÜNLÜK AKTİVİTE KAYDI ("Bugünkü Aktivitem" ekranı için) ---------- */
  var PAGE_LABEL={"index.html":"Ana Menü","practice.html":"Pratik","tekrar.html":"Tekrar","index-app.html":"Cümle Öğrenimi",
    "chat.html":"Sohbet Seçimi","chathotel.html":"Sohbet: Otel","chatrestaurant.html":"Sohbet: Restoran","chatdoctor.html":"Sohbet: Doktor",
    "chatairport.html":"Sohbet: Havaalanı","chatteacher.html":"Sohbet: Öğretmen","teacher.html":"Öğretmen","kelime-ogren.html":"Kelime Öğren",
    "videopractice.html":"Video Pratik","hata-defteri.html":"Hata Defteri","rapor.html":"İlerleme Raporu"};
  window.dhLogActivity=function(detail, kind){
    try{
      var K="dh-activity-log-v1";
      var log=JSON.parse(localStorage.getItem(K)||"[]")||[];
      var today=new Date().toISOString().slice(0,10);
      // KALICI GEÇMİŞ: son 10 gün / en fazla 600 kayıt saklanır. Bu sınır bilinçli seçildi:
      // Firestore'un tek-alan 1MB sınırına (bu projede daha önce ciddi soruna yol açmıştı)
      // asla yaklaşmasın diye — buluta senkronlanacağı için boyutu kesinlikle güvenli tutuyoruz.
      var cutoff=Date.now()-10*86400000;
      log=log.filter(function(e){ return (e.ts||0)>=cutoff; });
      log.push({ts:Date.now(), d:today, page:(location.pathname.split("/").pop()||"index.html"), detail:String(detail||"").slice(0,140), kind:kind||"info"});
      log.sort(function(a,b){ return a.ts-b.ts; });
      while(log.length>600 || JSON.stringify(log).length>150000) log.shift();   // hem sayı hem gerçek boyut sınırı
      localStorage.setItem(K, JSON.stringify(log));
    }catch(e){}
  };
  try{ window.dhLogActivity(PAGE_LABEL[__dhPage]?( "📍 "+PAGE_LABEL[__dhPage]+" sayfasını açtı"):("📍 "+__dhPage+" sayfasını açtı"), "visit"); }catch(e){}

  /* ---------- SVG YÜZ (dış dosyaya bağımlı değil, her zaman çalışır) ---------- */
  function faceSvg(kind){
    var mouth = kind==="praise" ? '<path d="M20 40 Q32 52 44 40" stroke="#0a1628" stroke-width="4" fill="none" stroke-linecap="round"/>'
      : kind==="warn" ? '<path d="M20 46 Q32 36 44 46" stroke="#0a1628" stroke-width="4" fill="none" stroke-linecap="round"/>'
      : '<line x1="22" y1="42" x2="42" y2="42" stroke="#0a1628" stroke-width="4" stroke-linecap="round"/>';
    var eyeShape = kind==="praise"
      ? '<path d="M16 26 Q20 20 24 26" stroke="#0a1628" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M40 26 Q44 20 48 26" stroke="#0a1628" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
      : '<circle cx="20" cy="25" r="3.5" fill="#0a1628"/><circle cx="44" cy="25" r="3.5" fill="#0a1628"/>';
    var bg = kind==="praise" ? "#4ade80" : kind==="warn" ? "#f59e0b" : kind==="stat" ? "#a78bfa" : "#38bdf8";
    var brow = kind==="warn" ? '<path d="M14 18 L26 21" stroke="#0a1628" stroke-width="3" stroke-linecap="round"/><path d="M50 18 L38 21" stroke="#0a1628" stroke-width="3" stroke-linecap="round"/>' : "";
    return '<svg viewBox="0 0 64 64" width="46" height="46" style="flex:0 0 auto"><circle cx="32" cy="32" r="30" fill="'+bg+'"/>'+brow+eyeShape+mouth+'</svg>';
  }

  /* ---------- CSS + KUTU ---------- */
  var css=document.createElement("style");
  css.textContent=".dh-coach{position:fixed !important;left:50% !important;top:22px !important;bottom:auto !important;width:min(92vw,400px);"
    +"transform:translateX(-50%) translateY(-40px) scale(.85);opacity:0;"
    +"max-width:min(95vw,640px);background:#111827;border-left:8px solid #38bdf8;border-radius:16px;"
    +"padding:18px 24px;box-shadow:0 20px 60px rgba(0,0,0,.7);z-index:2147483000;font:800 17px/1.4 system-ui,sans-serif;color:#f8fafc;"
    +"display:flex;gap:16px;align-items:center;transition:opacity .3s,transform .3s;pointer-events:none}"
    +".dh-coach.show{opacity:1;transform:translateX(-50%) translateY(0) scale(1);pointer-events:auto}"
    +".dh-coach.show.praise{animation:dhClap .6s ease 2}"
    +".dh-coach.show.warn{animation:dhShake .5s ease}"
    +".dh-coach.show.tip,.dh-coach.show.stat{animation:dhPulse .5s ease}"
    +"@keyframes dhPulse{0%{transform:translateX(-50%) translateY(0) scale(1.08)}100%{transform:translateX(-50%) translateY(0) scale(1)}}"
    +"@keyframes dhClap{0%,100%{transform:translateX(-50%) translateY(0) scale(1) rotate(0)}25%{transform:translateX(-50%) translateY(-6px) scale(1.05) rotate(-2deg)}50%{transform:translateX(-50%) translateY(0) scale(1.1) rotate(2deg)}75%{transform:translateX(-50%) translateY(-4px) scale(1.05) rotate(-1deg)}}"
    +"@keyframes dhShake{0%,100%{transform:translateX(-50%) translateY(0) scale(1)}20%{transform:translate(calc(-50% - 10px),0) scale(1)}40%{transform:translate(calc(-50% + 10px),0) scale(1)}60%{transform:translate(calc(-50% - 6px),0) scale(1)}80%{transform:translate(calc(-50% + 6px),0) scale(1)}}"
    +".dh-coach .face{animation:dhFaceBob .5s ease 3}"
    +"@keyframes dhFaceBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}"
    +".dh-coach .x{position:absolute;top:8px;right:11px;font-size:15px;color:#94a3b8;cursor:pointer;font-weight:400}"
    +".dh-coach.praise{border-color:#22c55e;background:linear-gradient(135deg,#111827,#0d2818)}"
    +".dh-coach.warn{border-color:#f59e0b;background:linear-gradient(135deg,#111827,#2d1a06)}"
    +".dh-coach.tip{border-color:#38bdf8;background:linear-gradient(135deg,#111827,#0a2233)}"
    +".dh-coach.stat{border-color:#a78bfa;background:linear-gradient(135deg,#111827,#22183f)}"
    +".dh-avatar{position:fixed !important;right:14px;bottom:88px;z-index:2147482900;width:54px;height:54px;border-radius:50%;"
    +"background:#111827;border:3px solid #38bdf8;box-shadow:0 6px 20px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;"
    +"cursor:pointer;animation:dhBreathe 3s ease-in-out infinite}"
    +"@keyframes dhBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}"
    +".dh-avatar.reacting{animation:dhAvatarReact .6s ease}"
    +"@keyframes dhAvatarReact{0%{transform:scale(1)}30%{transform:scale(1.25)}60%{transform:scale(.95)}100%{transform:scale(1)}}"
    +".dh-avatar svg{width:40px;height:40px}"
    +".dh-avatar .ring{position:absolute;inset:-3px;border-radius:50%;border:2px solid #38bdf8;opacity:0;pointer-events:none}"
    +".dh-avatar.reacting .ring{animation:dhRing .8s ease}"
    +"@keyframes dhRing{0%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(1.6)}}";
  document.head.appendChild(css);
  var box=document.createElement("div"); box.className="dh-coach";
  /* ---------- ÖĞRETMEN YÜZÜ: koç, seçili öğretmenin fotoğrafıyla konuşur ----------
     selectedTeacherAvatar (chatteacher.html'de seçiliyor) yoksa teacher1 varsayılır.
     Fotoğraf yüklenemezse img kendini siler ve SVG yüz devreye girer. */
  function coachFace(kind, big){
    var sel="teacher1";
    try{ sel=localStorage.getItem("selectedTeacherAvatar")||"teacher1"; }catch(e){}
    var px=big?48:34;
    /* Fotoğraf yüklenemezse img kendini siler ve gizli SVG yüz görünür olur */
    return '<img class="dh-tface" src="./assets/avatars_v3/'+sel+'/idle.webp" alt="" '
      +'style="width:'+px+'px;height:'+px+'px;border-radius:50%;object-fit:cover;object-position:top;display:block;box-shadow:0 0 0 2px #ffffff26" '
      +'onerror="this.nextElementSibling&&(this.nextElementSibling.style.display=\'\');this.remove();">'
      +'<span class="dh-svg-fb" style="display:none">'+faceSvg(kind)+'</span>';
  }
  function teacherHref(focus){
    var sel="teacher1";
    try{ sel=localStorage.getItem("selectedTeacherAvatar")||"teacher1"; }catch(e){}
    var page = sel==="teacher2" ? "chatteacher2.html" : "chatteacher1.html";
    return "./"+page+(focus?("?focus="+encodeURIComponent(focus)):"");
  }
  function focusBtnHtml(t){
    if(!t) return "";
    return '<a class="dh-coach-teach" href="'+teacherHref(t)+'" onclick="event.stopPropagation()" '
      +'style="margin-left:6px;flex:none;align-self:center;background:#1d4ed8;color:#fff;text-decoration:none;'
      +'font-weight:800;font-size:11.5px;padding:6px 10px;border-radius:999px;white-space:nowrap">🧑‍🏫 Öğretmenle çalış</a>';
  }
  /* Genel eylem düğmesi: plan zinciri vb. için {actionHref, actionLabel} */
  function actionBtnHtml(a){
    if(!a || !a.actionHref) return "";
    var lbl=String(a.actionLabel||"Devam et").replace(/[<>&"]/g,function(c){return{"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c];});
    var hrf=String(a.actionHref).replace(/"/g,"&quot;");
    return '<a class="dh-coach-teach" href="'+hrf+'" onclick="event.stopPropagation()" '
      +'style="margin-left:6px;flex:none;align-self:center;background:#15803d;color:#fff;text-decoration:none;'
      +'font-weight:800;font-size:11.5px;padding:6px 10px;border-radius:999px;white-space:nowrap">'+lbl+'</a>';
  }

  /* ---------- 🌙 GÜNÜ KAPAT: hata dersi → rakamlı takdir → mini test → yarın ----------
     Pedagojik sıra kullanıcının önerisi: gün, o günün hatalarının DERSİYLE kapanır
     (hatalar tazeyken düzeltmek en kalıcısı), sonra somut takdir, uyku öncesi
     bir geri çağırma sorusu ve yarının küçük sözü. Gün kapandıktan sonra
     "bugünü kaçırma" tarzı dürtmeler o gün için susturulur. */
  function dcEsc(t){ return String(t==null?"":t).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  /* error-drill.js'i ihtiyaç anında yükle — HTML dosyalarına ekleme gerekmez */
  window.dhCoachLoadDrill=dhLoadDrill;
  function dhLoadDrill(cb){
    if(window.dhErrorDrill) return cb();
    var sc=document.createElement("script");
    sc.src="./error-drill.js"; sc.onload=cb;
    sc.onerror=function(){ alert("Antrenman modülü yüklenemedi."); };
    document.head.appendChild(sc);
  }
  window.dhCoachDayClose=async function(force){
    if(document.getElementById("dhDayClosePanel")) return;
    var ov=document.createElement("div");
    ov.id="dhDayClosePanel";
    ov.style.cssText="position:fixed;inset:0;z-index:2147483200;background:rgba(2,8,20,.72);display:flex;align-items:center;justify-content:center;padding:14px";
    ov.innerHTML='<div style="background:#0f1f3a;border:1px solid #1e3a5f;border-radius:18px;width:min(560px,96vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden">'
      +'<div style="display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid #1e3a5f">'
      +coachFace("tip")
      +'<b style="color:#e8eef7;font-size:16px;flex:1">🌙 Günü Kapat</b>'
      +'<button id="dhDcX" style="background:#13294d;border:1px solid #1e3a5f;color:#e8eef7;border-radius:8px;width:32px;height:32px;cursor:pointer">✕</button>'
      +'</div>'
      +'<div id="dhDcBody" style="padding:16px;overflow-y:auto;color:#dbe7ff;font-size:14px;line-height:1.65">⏳ Günün hataları inceleniyor…</div>'
      +'</div>';
    document.body.appendChild(ov);
    document.getElementById("dhDcX").onclick=function(){ ov.remove(); };
    ov.addEventListener("click",function(e){ if(e.target===ov) ov.remove(); });
    var body=document.getElementById("dhDcBody");

    /* 0) DÜRÜSTLÜK KAPISI — plan adımları "bitmiş" görünebilir ama gün gerçekten
       dolu mu? Adımlar sayfa ziyaretiyle işaretlenebildiği için tek ölçü olamaz.
       Gerçek efor = cümle + tekrar. Hafifse önce kısa bir kapanış turu öneririz. */
    var req0=await dhDayRequirements();
    if(!force && !req0.ok){
      var rows=req0.items.map(function(it){
        return '<div style="display:flex;align-items:center;gap:9px;padding:9px 11px;margin-top:7px;border-radius:10px;'
          +'background:'+(it.ok?"#0a2818":"#2a0f14")+';border:1px solid '+(it.ok?"#14532d":"#7f1d1d")+'">'
          +'<span style="font-size:16px">'+(it.ok?"✅":"❌")+'</span>'
          +'<span style="flex:1;font-weight:700">'+it.label+'</span>'
          +'<b style="color:'+(it.ok?"#4ade80":"#f87171")+'">'+it.got+' / '+it.need+'</b></div>';
      }).join("");
      var firstFail=req0.items.filter(function(it){return !it.ok;})[0];
      body.innerHTML='<div style="font-weight:800;color:#facc15">Günü kapatmak için karneyi tamamla:</div>'+rows
        +(req0.due>0?'<div style="font-size:12px;color:#9fb3d9;margin-top:7px">Toplam bekleyen tekrar: '+req0.due+' — hepsini değil, sadece günlük payını istiyorum.</div>':'')
        +'<a id="dhDcTour" href="'+firstFail.href+'" style="display:block;text-align:center;margin-top:12px;background:linear-gradient(135deg,#059669,#0d9488);color:#fff;text-decoration:none;font-weight:900;padding:13px;border-radius:12px">'+firstFail.cta+' ('+(firstFail.need-firstFail.got)+' kaldı)</a>'
        +'<button id="dhDcAnyway" style="display:block;width:100%;margin-top:8px;background:#334155;border:0;color:#cbd5e1;border-radius:11px;padding:11px;font-weight:700;cursor:pointer">Yine de günü kapat (karne eksik kalır)</button>';
      document.getElementById("dhDcAnyway").onclick=function(){ ov.remove(); window.dhCoachDayClose(true); };
      var __tour=document.getElementById("dhDcTour");
      if(__tour) __tour.addEventListener("click",function(){
        try{ localStorage.setItem("dh-close-tour", JSON.stringify({t:Date.now()})); }catch(e){}
      });
      return;
    }
    try{ localStorage.setItem("dh-day-closed-"+dhToday(), JSON.stringify({t:Date.now(),effort:dhEffortNow()})); }catch(e){}
    try{ localStorage.removeItem("dh-close-tour"); }catch(e){}

    /* 1) Bugünün hataları — bugün YOKSA interaktif kapanış defter birikiminden
       kurulur (öncelik puanı en yüksek eski hatalar). Kapanış asla pasif geçmez. */
    var errs=[], backlog=[];
    try{
      if(window.LearningErrorDB && LearningErrorDB.all){
        var all=await LearningErrorDB.all();
        var t0=new Date(); t0.setHours(0,0,0,0);
        errs=all.filter(function(r){ return new Date(r.createdAt||0)>=t0; }).slice(0,8);
        if(!errs.length){
          backlog=all.filter(function(r){ return r && r.target; })
            .sort(function(a,b){ return (b.reviewPriority||0)-(a.reviewPriority||0); })
            .slice(0,6);
        }
      }
    }catch(e){}

    var lessonHtml="";
    if(!errs.length){
      var __prod=dhRecToday().sentences||0;
      lessonHtml = __prod>=5
        ? '<div style="background:#0a2818;border:1px solid #14532d;border-radius:12px;padding:12px">'+__prod+' cümle çalıştın ve hiç hata kaydı yok — gerçekten temiz bir gün 👏'+(backlog.length?'<div style="margin-top:6px;font-size:13px;color:#9fb3d9">Ama defterinde çözülmeyi bekleyen eski hataların var — kapanış antrenmanını onlardan kurdum 👇</div>':'')+'</div>'
        : '<div style="background:#2a1f0a;border:1px solid #92610a;border-radius:12px;padding:12px">Bugün hata kaydı yok ama üretim de azdı ('+__prod+' cümle). Hata çıkmıyorsa yeterince konuşup yazmıyorsun demektir 😉 Yarın konuşma/yazma ekleyelim.</div>';
    } else {
      /* kural tabanlı taban: tür bazlı gruplar + öğrencinin kendi cümleleri */
      var groups={};
      errs.forEach(function(r){ var t=r.primaryType||"general"; (groups[t]=groups[t]||[]).push(r); });
      var TL=window.DH_COACH_TYPE_LABEL||{}, TT=window.DH_COACH_TYPE_TIP||{};
      lessonHtml=Object.keys(groups).map(function(t){
        var g=groups[t];
        return '<div style="background:#13294d;border:1px solid #1e3a5f;border-radius:12px;padding:12px;margin-bottom:10px">'
          +'<b style="color:#facc15">'+dcEsc(TL[t]||t)+'</b> ('+g.length+' kez)'
          +'<div style="margin:6px 0;font-size:13px;color:#9fb3d9">'+dcEsc(TT[t]||"Bu kalıba dikkat.")+'</div>'
          +g.slice(0,2).map(function(r){
            return '<div style="margin-top:6px;font-size:13.5px">✗ <s style="color:#f87171">'+dcEsc(r.answer||"")+'</s><br>✓ <span style="color:#4ade80">'+dcEsc(r.target||"")+'</span></div>';
          }).join("")
          +'</div>';
      }).join("");
      /* AI varsa kök neden dersiyle zenginleştir */
      if(window.DHProviders && DHProviders.hasAnyKey && DHProviders.hasAnyKey()){
        try{
          var sys="Türkçe konuşan sıcak bir İngilizce öğretmenisin. Öğrencinin BUGÜN yaptığı hatalar verilecek. Görevin: (1) hataları KÖK NEDENE göre en fazla 3 grupta topla, (2) her grup için 2-3 cümlelik Türkçe mini ders yaz ve öğrencinin KENDİ yanlış cümlesini yanlış→doğru olarak örnek göster, (3) her gruba tek satırlık küçük bir alıştırma sorusu ekle. Kısa ve samimi tut; başlıklara emoji koy.";
          var usr=errs.map(function(r){ return "Yanlış: "+(r.answer||"")+" | Doğru: "+(r.target||"")+" | Tür: "+(r.primaryType||""); }).join("\n");
          var ai=await DHProviders.chat([{role:"system",content:sys},{role:"user",content:usr}],{temperature:0.4,max_tokens:900});
          if(ai && ai.trim()){
            lessonHtml='<div style="white-space:pre-wrap;background:#13294d;border:1px solid #1e3a5f;border-radius:12px;padding:12px">'+dcEsc(ai.trim())+'</div>';
          }
        }catch(e){ /* AI yoksa kural tabanlı ders zaten hazır */ }
      }
    }

    /* 2) Rakamlı takdir */
    var rec=dhRecToday();
    var reqP=await dhDayRequirements();
    var praise='📊 Bugün: <b>'+(rec.lessons||0)+'</b> ders · <b>'+(rec.sentences||0)+'</b> cümle · <b>'+(rec.reviews||0)+'</b> tekrar'
      +(errs.length?' · <b>'+errs.length+'</b> hatadan ders çıkarıldı':'')
      +(reqP.ok
        ? '. Karne tam — dolu dolu bir gün, planı hakkıyla bitirdin 👏'
        : '. Karne eksik kapandı — yarın önce tekrarlardan başlayalım 💪');

    /* 3) Mini test: bugünkü bir hatanın doğru cümlesi, TR ipucuyla */
    var quiz="";
    var q=(errs.length?errs:backlog).filter(function(r){ return r.sentenceTR && r.target; })[0];
    if(q){
      quiz='<div style="background:#1a1033;border:1px solid #4c1d95;border-radius:12px;padding:12px;margin-top:12px">'
        +'<b style="color:#c4b5fd">🌙 Uyku öncesi mini test</b>'
        +'<div style="margin-top:6px">"'+dcEsc(q.sentenceTR)+'" — İngilizcesi neydi?</div>'
        +'<button id="dhDcReveal" style="margin-top:8px;background:#4c1d95;border:0;color:#fff;border-radius:9px;padding:8px 13px;font-weight:800;cursor:pointer">Cevabı göster</button>'
        +'<div id="dhDcAnswer" style="display:none;margin-top:8px;color:#4ade80;font-weight:800">'+dcEsc(q.target)+'</div>'
        +'</div>';
    }

    /* 4) Yarının tohumu */
    var due=0; try{ var pl=JSON.parse(localStorage.getItem("dh-koc-plan-"+dhToday())||"null"); due=(pl&&pl.dueCount)||0; }catch(e){}
    var tomorrow='<div style="margin-top:12px;font-size:13px;color:#9fb3d9">🌅 Yarın: '+(due?('tekrarlarından 15\'i'):'yeni planın')+' ve taze bir modül seni bekliyor — 10 dakikan yeter. Şimdi dinlenmeyi hak ettin, iyi geceler! 🌙</div>';

    var drillSet = errs.length ? errs : backlog;
    var drillBtn = drillSet.length
      ? '<button id="dhDcDrill" style="display:block;width:100%;margin-top:12px;background:linear-gradient(135deg,#059669,#0d9488);border:0;color:#fff;border-radius:12px;padding:13px;font-weight:900;font-size:15px;cursor:pointer">🏋️ '
        +(errs.length?('Şimdi interaktif çalış ('+errs.length+' hata)'):('Kapanış antrenmanı: defterden '+backlog.length+' hata'))+'</button>'
      : "";
    body.innerHTML=lessonHtml + drillBtn
      +'<div style="margin-top:12px;background:#0a2818;border:1px solid #14532d;border-radius:12px;padding:12px">'+praise+'</div>'
      +quiz+tomorrow;
    var db=document.getElementById("dhDcDrill");
    if(db) db.onclick=function(){ dhLoadDrill(function(){ window.dhErrorDrill&&window.dhErrorDrill.open(drillSet); }); };
    var rv=document.getElementById("dhDcReveal");
    if(rv) rv.onclick=function(){ rv.style.display="none"; document.getElementById("dhDcAnswer").style.display="block"; };
  };

  function reopenBtnHtml(on){
    if(!on) return "";
    return '<button style="background:#334155;border:0;color:#fff;font-weight:800;font-size:12px;'
      +'padding:7px 12px;border-radius:999px;cursor:pointer;margin-left:6px;flex-shrink:0" '
      +'onclick="event.stopPropagation();window.dhCoachReopenDay&&window.dhCoachReopenDay()">🔓 Günü yeniden aç</button>';
  }
  function dayCloseBtnHtml(on){
    if(!on) return "";
    return '<button class="dh-coach-teach" style="margin-left:6px;flex:none;align-self:center;border:0;cursor:pointer;'
      +'background:#0e7490;color:#fff;font-weight:800;font-size:11.5px;padding:6px 10px;border-radius:999px;white-space:nowrap" '
      +'onclick="event.stopPropagation();window.dhCoachDayClose&&window.dhCoachDayClose()">🌙 Günü kapat</button>';
  }

  try{
    var tfCss=document.createElement("style");
    tfCss.textContent=".dh-coach .face .dh-tface{flex:none}";
    document.head.appendChild(tfCss);
  }catch(e){}

  var avatar=document.createElement("div"); avatar.className="dh-avatar"; avatar.title="Koçun — tıkla, son yorumunu tekrar göster";
  avatar.innerHTML='<div class="ring"></div>'+coachFace("tip", true);
  function mount(){ document.body.appendChild(box); document.body.appendChild(avatar); }
  if(document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  var avatarResetT=null;
  function clearFace(){
    try{
      avatar.querySelectorAll("svg,.dh-tface,.dh-svg-fb").forEach(function(n){ n.remove(); });
    }catch(e){}
  }
  function setAvatarFace(kind){
    try{
      clearFace();
      avatar.insertAdjacentHTML("beforeend", coachFace(kind||"tip", true));
      avatar.classList.remove("reacting"); void avatar.offsetWidth; avatar.classList.add("reacting");
      clearTimeout(avatarResetT);
      avatarResetT=setTimeout(function(){
        clearFace();
        avatar.insertAdjacentHTML("beforeend", coachFace("tip", true));   // nötr yüze dön
      }, 8000);
    }catch(e){}
  }

  var hideT=null, lastMsg="", lastAt=0, lastKind="tip", lastFocus="", lastAction=null, lastDayClose=false, lastReopen=false;
  window.dhCoachSay=function(msg, kind, faceOverride, opts){
    if(!msg || !document.body) return;
    if(msg===lastMsg && Date.now()-lastAt<4000) return;
    lastMsg=msg; lastAt=Date.now(); lastKind=kind||"tip";
    lastFocus=(opts && opts.focusType) || "";
    lastAction=(opts && opts.actionHref) ? opts : null;
    lastDayClose=!!(opts && opts.dayClose);
    lastReopen=!!(opts && opts.reopen);
    setAvatarFace(kind);
    box.classList.remove("show");
    void box.offsetWidth;
    box.className="dh-coach "+(kind||"tip");
    box.innerHTML='<span class="face">'+(faceOverride||coachFace(kind))+'</span><span style="flex:1">'+String(msg).replace(/[<>&]/g,function(c){return{"<":"&lt;",">":"&gt;","&":"&amp;"}[c];})+'</span>'+focusBtnHtml(lastFocus)+actionBtnHtml(lastAction)+dayCloseBtnHtml(lastDayClose)+reopenBtnHtml(lastReopen)+'<span class="x" onclick="event.stopPropagation();this.parentElement.classList.remove(\'show\')">✕</span>';
    requestAnimationFrame(function(){ box.classList.add("show"); });
    clearTimeout(hideT);
    // otomatik kapanma KALDIRILDI — kullanıcı isteği: balon yalnız ✕ ile veya elle kapatılır
  };
  box.onclick=function(){ box.classList.remove("show"); };
  avatar.onclick=function(){
    if(lastMsg && Date.now()-lastAt<600000){ box.className="dh-coach "+lastKind; box.innerHTML='<span class="face">'+coachFace(lastKind)+'</span><span style="flex:1">'+lastMsg.replace(/[<>&]/g,function(c){return{"<":"&lt;",">":"&gt;","&":"&amp;"}[c];})+'</span>'+focusBtnHtml(lastFocus)+actionBtnHtml(lastAction)+dayCloseBtnHtml(lastDayClose)+reopenBtnHtml(lastReopen)+'<span class="x" onclick="event.stopPropagation();this.parentElement.classList.remove(\'show\')">✕</span>'; box.classList.add("show"); clearTimeout(hideT); hideT=setTimeout(function(){ box.classList.remove("show"); },7500); }
    else { try{ window.__dhCoachManualStatus && window.__dhCoachManualStatus(); }catch(e){} }
  };

  /* ---------- ORTAK TÜR ETİKETİ + SOMUT TAVSİYE ---------- */
  var TYPE_LABEL={
    "missing-word":"kelime atlama","extra-word":"fazladan kelime","auxiliary-missing":"yardımcı fiil eksikliği (am/is/are/do/did...)",
    "auxiliary-extra":"gereksiz yardımcı fiil","article":"a/an/the kullanımı","pronoun":"zamir kullanımı",
    "past-simple":"geçmiş zaman (past simple)","present-continuous":"şimdiki zaman (present continuous)",
    "question-order":"soru cümlesi sıralaması","pronunciation":"telaffuz","sentence-accuracy":"cümle doğruluğu"
  };
  var TYPE_TIP={
    "missing-word":"Cümleyi yazmadan önce zihninde İngilizce olarak yüksek sesle tekrar et.",
    "extra-word":"Yazdıktan sonra cümleyi kelime kelime referansla karşılaştır, fazlalık varsa sil.",
    "auxiliary-missing":"Her cümlede önce 'yardımcı fiil var mı?' diye kontrol et: am/is/are/was/were/do/does/did.",
    "auxiliary-extra":"Basit cümlelerde gereksiz yere 'do/does' ekleme — sadece soru ve olumsuzda gerekir.",
    "article":"'a' ünsüzle, 'an' ünlüyle başlar; belirli nesnede 'the' kullan.",
    "pronoun":"Özneyi (I/you/he/she...) cümlenin başında MUTLAKA belirt.",
    "past-simple":"Fiilin -ed halini ya da düzensiz geçmiş formunu (was/were/went/did) kullanmayı unutma.",
    "present-continuous":"'am/is/are' + fiil-ing kalıbını birlikte kullan.",
    "question-order":"Soruda yardımcı fiil ÖZNEDEN ÖNCE gelir: Do you...? / Are you...?",
    "sentence-accuracy":"Kalıbı bütün olarak hatırla, kelime kelime çevirme."
  };
  window.DH_COACH_TYPE_LABEL=TYPE_LABEL; window.DH_COACH_TYPE_TIP=TYPE_TIP;

  var state={ evalCount:0, correctStreak:0, errCache:null, errCacheAt:0, seenTypesToday:{} };
  async function errHistory(){
    var now=Date.now();
    if(state.errCache && now-state.errCacheAt<15000) return state.errCache;
    try{ state.errCache=(window.LearningErrorDB && await LearningErrorDB.all())||[]; }catch(e){ state.errCache=[]; }
    state.errCacheAt=now;
    return state.errCache;
  }

  /* ---------- CEVAP DEĞERLENDİRME (practice/tekrar ORTAK karar mantığı) ---------- */
  /* ---------- 🔥 GÜNLÜK TAKİP (streak/meşale) — KANITLANDI: dh-study-tracker-v1'i
     sistemde hiçbir dosya yazmıyordu, bu yüzden meşale hep "0 gün" kalıyordu.
     Artık her gerçek cevap değerlendirmesinde bugünün kaydı burada oluşturulur/güncellenir. */
  function bumpDailyTracker(kind){
    try{
      var K="dh-study-tracker-v1";
      var tr=JSON.parse(localStorage.getItem(K)||"{}")||{};
      if(!tr.days) tr.days={};
      var today=new Date().toISOString().slice(0,10);
      if(!tr.days[today]) tr.days[today]={date:today,lessons:0,minutes:0,sentences:0,videos:0,reviews:0,errors:0};
      var d=tr.days[today];
      if(kind==="sentence") d.sentences=(d.sentences||0)+1;
      else if(kind==="review") d.reviews=(d.reviews||0)+1;
      else if(kind==="video") d.videos=(d.videos||0)+1;
      else if(kind==="lesson") d.lessons=(d.lessons||0)+1;
      localStorage.setItem(K, JSON.stringify(tr));
    }catch(e){}
  }
  window.dhBumpDailyTracker=bumpDailyTracker;

  var __dhSession={correct:0, wrong:0};
  function logSessionRate(force){
    var total=__dhSession.correct+__dhSession.wrong;
    if(!total) return;
    if(!force && total%10!==0) return;   // her 10 cevapta bir, ya da sayfadan ayrılırken (force)
    var pct=Math.round(100*__dhSession.correct/total);
    try{ window.dhLogActivity("📊 Oturum doğruluğu: %"+pct+" ("+__dhSession.correct+"/"+total+")", "rate"); }catch(e){}
    /* 🔬 %85 KURALI (optimal öğrenme zorluğu): bilimsel bulgu, öğrenmenin
       ~%80-85 başarı oranında en hızlı olduğunu gösteriyor. Koç sapmalarda
       yön verir — oturumda her uyarı türü 1 kez. */
    if(!force && total>=10){
      try{
        if(pct>=95 && !sessionStorage.getItem("dh-85-easy")){
          sessionStorage.setItem("dh-85-easy","1");
          window.dhCoachSay("Doğruluğun %"+pct+" — bu içerik sana KOLAY geliyor 🎯 Öğrenme bilimi en hızlı ilerlemenin %80-85 zorlukta olduğunu söylüyor: üretim moduna geç (yazarak/söyleyerek) ya da bir sonraki modüle atla.","tip");
        } else if(pct<=60 && !sessionStorage.getItem("dh-85-hard")){
          sessionStorage.setItem("dh-85-hard","1");
          window.dhCoachSay("Doğruluk %"+pct+" — şu an fazla zorlanıyorsun, bu normal 💪 Tempoyu düşür: cümleyi önce 1-2 kez dinle, gerekirse yavaş oynat, sonra dene. %80'lere çıkınca hız kendiliğinden gelir.","warn");
        }
      }catch(e){}
    }
  }
  window.addEventListener("pagehide", function(){ logSessionRate(true); });
  document.addEventListener("visibilitychange", function(){ if(document.visibilityState==="hidden") logSessionRate(true); });

  window.dhCoachEvaluate=async function(opts){
    try{
      opts=opts||{};
      bumpDailyTracker(opts.trackKind||"sentence");
      window.dhCoachMarkStepDone && window.dhCoachMarkStepDone(__dhPage);
      try{ window.dhCoachChainBump && window.dhCoachChainBump(); }catch(e){}
      if(opts.ok) __dhSession.correct++; else __dhSession.wrong++;
      try{ window.dhLogActivity((opts.ok?"✅ Doğru: ":"❌ Yanlış: ")+(opts.en||opts.sentenceId||""), opts.ok?"correct":"wrong"); }catch(e){}
      logSessionRate(false);
      var hist=await errHistory();
      var curTypes = (window.LearningErrorDB && LearningErrorDB.detectTypes)
        ? LearningErrorDB.detectTypes({target:opts.en, answer:opts.answer, grammar:opts.grammar||"", module:opts.module||"", topic:opts.topic||""})
        : [];
      var sameSentencePast = hist.filter(function(r){ return r.sentenceId===opts.sentenceId && r.grade==="hard"; });

      /* TAM DOĞRU mu, YALNIZCA YAKIN mı?
         opts.ok tek başına yetmiyordu: practice.html "good" (Neredeyse) notunu da ok=true
         gönderiyor. Koç bu ikisini ayırmayınca yarım doğruya "tam doğru yaptın" diyordu
         ve seriyi de şişiriyordu. Artık:
           perfect (easy / skor ~100) -> tam övgü, seri sayılır
           partial (good / Neredeyse) -> "yaklaştın" tonu, TAM DOĞRU DENMEZ, seri SAYILMAZ */
      var _sc = (opts.score!=null) ? (opts.score<=1 ? opts.score*100 : opts.score) : null;
      var perfect = opts.grade ? (opts.grade==="easy")
                  : (opts.ok && (_sc==null || _sc>=99.9));
      var partial = opts.ok && !perfect;

      if(perfect) state.correctStreak++; else state.correctStreak=0;

      if(perfect && state.correctStreak>=3 && state.correctStreak%3===0){
        dhCoachSay("HARİKASIN! Art arda "+state.correctStreak+" cümleyi TAM doğru yaptın, bu ritmi koru!","praise");
        return;
      }
      if(perfect && sameSentencePast.length){
        dhCoachSay("MÜKEMMEL! Daha önce bu cümlede zorlanmıştın, şimdi tam doğru yaptın. Aynı dikkatle devam et!","praise");
        return;
      }
      if(partial && sameSentencePast.length){
        dhCoachSay("İLERLEME VAR: Bu cümlede daha önce zorlanmıştın, bu sefer çok yaklaştın — ama henüz tam değil. Farkı yukarıdan karşılaştır.","tip");
        return;
      }
      if(partial){
        dhCoachSay("YAKLAŞTIN, ama tam değil. Kırmızı işaretli yerlere bak — küçük bir düzeltmeyle tam doğru olacak.","tip");
        return;
      }
      if(!opts.ok && sameSentencePast.length){
        /* commonMistake ÖRNEK CÜMLE içerir ve o cümlede cevabın kelimeleri geçer
           ("He has twenty years" → "twenty" sızar). Hata defterinde cümleyi YENİDEN
           çözerken bu mesaj çıkarsa cevabı söylemiş oluruz. Bu yüzden stripAnswer ile
           yalnız güvenli açıklama kısmı gösterilir; güvenli değilse genel uyarı verilir. */
        var _safe = stripAnswer(opts.commonMistake, opts.en);
        dhCoachSay("DİKKAT: Bu cümlede daha önce de hata yapmıştın. "
          + (_safe ? (_safe+".") : "Kelime sırasına ve yardımcı fiile dikkat et.")
          + " Devam etmeden önce bir kez daha oku.","warn");
        return;
      }
      if(!opts.ok){
        var overlap = hist.filter(function(r){ return r.grade==="hard" && Array.isArray(r.types) && r.types.some(function(t){return curTypes.indexOf(t)>=0;}); });
        if(overlap.length>=2 && curTypes.length){
          var tp=curTypes[0];
          dhCoachSay("TEKRARLANAN HATA: "+(TYPE_LABEL[tp]||tp)+". Yapman gereken: "+(TYPE_TIP[tp]||"Cümle kurarken buna özellikle dikkat et.")+" Bir sonraki cümlede bilerek uygula!","warn",null,{focusType:tp});
          return;
        }
      }
      state.evalCount++;
      if(state.evalCount%5===0){
        var tally={};
        hist.forEach(function(r){ if(r.grade==="hard" && Array.isArray(r.types)) r.types.forEach(function(t){ tally[t]=(tally[t]||0)+1; }); });
        var top=Object.keys(tally).sort(function(a,b){return tally[b]-tally[a];})[0];
        if(top && tally[top]>=3){
          dhCoachSay("GENEL DEĞERLENDİRME: En çok "+(TYPE_LABEL[top]||top)+" konusunda hata yapıyorsun ("+tally[top]+" kez). Tavsiyem: "+(TYPE_TIP[top]||"buna özellikle dikkat et")+".","stat",null,{focusType:top});
          return;
        }
      }
      // HİÇBİR ÖZEL KOŞUL TUTMADI: "her aktivitede yorum" ilkesi gereği yine de kısa bir tepki ver.
      // NOT: partial (Neredeyse) durumu YUKARIDA yakalanıp döndü — buraya yalnız
      // TAM DOĞRU ya da YANLIŞ düşer. Bu yüzden "tam isabet" demek artık güvenli.
      var DEF_OK=["Doğru! Böyle devam et.","Aferin, tam isabet.","Güzel, ilerliyorsun.","Doğru cevap — bir sonrakine geç."];
      var DEF_NO=["Olmadı, doğrusuna bak ve devam et.","Bu sefer olmadı — açıklamayı oku, unutma.","Yanlış, ama önemli değil — öğrenmenin parçası."];
      var pick = perfect ? DEF_OK[state.evalCount%DEF_OK.length] : DEF_NO[state.evalCount%DEF_NO.length];
      dhCoachSay(pick, perfect?"praise":"warn");
    }catch(e){}
  };
  /* CEVAP SIZDIRMA KORUMASI:
     "YENİ KONU" mesajı SORU EKRANDAYKEN gösteriliyor (cevaptan ÖNCE). commonMistake
     alanı ise çoğu zaman TAM bir örnek cümle içeriyor ("Everyone is here but John
     isn't coming ✕ (farklı yapı)") — bu cümle, boşluğa girecek kelimeyi de barındırdığı
     için testi bozuyordu: koç cevabı öğrenciye söylemiş oluyordu.
     Artık örnek cümle ATILIR, yalnız parantez içindeki KISA AÇIKLAMA gösterilir
     ("farklı yapı" gibi). Açıklama yoksa ya da açıklama bile hedef cümleden kelime
     sızdırıyorsa mesaj HİÇ gösterilmez — ipucu vermektense susmak yeğdir. */
  function stripAnswer(commonMistake, target){
    var cm=String(commonMistake||"").trim();
    if(!cm) return "";

    // 1) Parantez içindeki kısa açıklamayı çıkar: "... ✕ (özne farklı)" -> "özne farklı"
    var note="";
    var mp=/\(([^()]{3,60})\)\s*$/.exec(cm);
    if(mp) note=mp[1].trim();

    // 2) Açıklama yoksa: metin bir ÖRNEK CÜMLE mi, yoksa zaten açıklama mı?
    //    Örnek cümle işareti: arka arkaya 3+ İNGİLİZCE kelime (Türkçe'ye özgü harf yok).
    //    "Zaman uyumu hatası" gibi Türkçe açıklamalar boşa atılmasın diye tr harf denetimi şart.
    if(!note){
      var hasTr=/[çğıöşüÇĞİÖŞÜ]/.test(cm);
      var looksLikeSentence = !hasTr && /\b[A-Za-z']+\s+[A-Za-z']+\s+[A-Za-z']+\b/.test(cm);
      if(looksLikeSentence) return "";   // örnek cümle var, açıklama yok -> güvenli değil, sus
      note=cm;
    }

    // 3) SON KONTROL: açıklama, hedef cümlenin kelimelerini içeriyor mu?
    //    Kısa kelimeler DE sızıntıdır ("due", "for", "up" gibi cevaplar 3 harflik olabilir),
    //    o yüzden uzunluk filtresi YOK. Yalnız gerçekten anlamsız/dolgu kelimeler muaf.
    //    Kelime SINIRIYLA eşleşme aranır ki "is" -> "his/this" gibi yanlış eşleşme olmasın.
    if(target){
      var STOP={the:1,a:1,an:1,and:1,or:1,of:1,to:1,in:1,on:1,at:1,i:1,you:1,he:1,she:1,it:1,we:1,they:1};
      var tw=String(target).toLowerCase().replace(/[^a-z' ]/g," ").split(/\s+/)
              .filter(function(w){ return w && !STOP[w]; });
      var nl=" "+note.toLowerCase().replace(/[^a-zçğıöşü' ]/g," ")+" ";
      for(var i=0;i<tw.length;i++){
        if(nl.indexOf(" "+tw[i]+" ")>=0) return "";   // hedeften kelime sızıyor -> sus
      }
    }
    return note;
  }

  window.dhCoachModuleIntro=function(mod, commonMistake, target){
    try{
      if(!mod || state.seenTypesToday[mod]) return;
      state.seenTypesToday[mod]=1;
      var note=stripAnswer(commonMistake, target);
      if(note) dhCoachSay("YENİ KONU: Bu yapıyı ilk kez çalışıyorsun. Dikkat etmen gereken nokta: "+note+".","tip");
      else     dhCoachSay("YENİ KONU: Bu yapıyı ilk kez çalışıyorsun. Acele etme, cümleyi kurmadan önce yapıyı bir düşün.","tip");
    }catch(e){}
  };

  /* ---------- PASİF SAYFALAR İÇİN GENEL YÖNLENDİRME + GENEL DURUM YORUMU ---------- */
  async function buildStatusMessage(manual){
    /* 🌙 Öncelik sırası: gün kapandıysa veda; plan bittiyse Günü Kapat TEKLİFİ.
       (Eskiden bu iki durumda bile "bugünü kaçırma!" nag'ı dönüyordu — avatar
       tıklamasındaki manuel yol korumasızdı, teklifi de ezebiliyordu.) */
    try{
      if(dhDayClosed())
        return {msg:"Bugünü kapattın 🌙 Dinlenmek de antrenmanın parçası. Devam etmek istersen günü yeniden açabilirsin.", kind:"praise", reopen:true};
      if(allPlanStepsDone()){
        var rq=await dhDayRequirements();
        var tv=dhTourState(rq);
        if(tv===2) return {msg:"Kapanış turunu tamamladın 💪 Şimdi günü gönül rahatlığıyla kapatabiliriz.", kind:"praise", dayClose:true};
        if(tv===1){
          if(!manual) return {msg:"", kind:"tip"};   /* tur sürerken otomatik teklif YOK */
          /* avatara tıklayana bağlam ver: hangi şart, ne kadar kaldı + tura dönüş düğmesi */
          var ff=rq.items.filter(function(i){return !i.ok;})[0];
          var kal=ff?(ff.need-ff.got):0;
          return {msg:"Kapanış turundasın — "+(ff?(ff.label+" için "+kal+" kaldı ("+ff.got+"/"+ff.need+")"):"az kaldı")+". Bitir, günü birlikte kapatalım 💪",
                  kind:"tip", actionHref:(ff&&ff.href)||"./tekrar.html?plan=1", actionLabel:"⚡ Tura dön"};
        }
        if(!rq.ok){
          var miss=rq.items.filter(function(i){return !i.ok;}).map(function(i){return (i.need-i.got)+" "+i.label.toLowerCase();}).join(" + ");
          return {msg:"Plan adımları tamam ama karnede eksik var: "+miss+". Kapanış turuna çıkalım mı? 🌙", kind:"tip", dayClose:true};
        }
        return {msg:"Bugünün planı tamam 🎉 Karne de tam — günü kapatalım mı? Hataların dersini çıkarıp interaktif çalışabilirsin.", kind:"praise", dayClose:true};
      }
    }catch(e){}
    var tr={}; try{ tr=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}; }catch(e){}
    var d=new Date(), streak=0;
    if(!(tr.days||{})[d.toISOString().slice(0,10)]) d.setDate(d.getDate()-1);
    for(;;){ if((tr.days||{})[d.toISOString().slice(0,10)]){streak++; d.setDate(d.getDate()-1);} else break; }
    var due=0, learned=0;
    try{
      var r=await new Promise(function(res){ var rq=indexedDB.open("sentence-mode",1); rq.onsuccess=function(){res(rq.result);}; rq.onerror=function(){res(null);}; });
      if(r){ await new Promise(function(res){ var now=Date.now(), q=r.transaction("kv","readonly").objectStore("kv").openCursor();
        q.onsuccess=function(e){ var c=e.target.result; if(c){ var k=String(c.key); if(k.indexOf("srs:")===0 && c.value && (c.value.due||0)<=now) due++; c.continue(); } else { r.close(); res(); } };
        q.onerror=function(){ res(); }; }); }
    }catch(e){}
    try{ var m=JSON.parse(localStorage.getItem("dh-progress-mirror-v1")||"{}")||{}; for(var k in m){ if(m[k]&&m[k][0]===2) learned++; } }catch(e){}
    var msg=null, kind="tip";
    if(streak===0 && due>10){ msg="Bugün henüz çalışmadın ama "+due+" tekrar bekliyor — hemen 10 dakikanı ayır, seriye başla!"; kind="warn"; }
    else if(streak>=7){ msg="🔥 "+streak+" günlük serin devam ediyor, harikasın! Bugünü de kaçırma, meşale sönmesin."; kind="praise"; }
    else if(streak>=3){ msg=streak+" günlük serin devam ediyor, iyi gidiyorsun — bugünü de kaçırma!"; kind="praise"; }
    else if(due>30){ msg="Tekrar bekleyen "+due+" öğe birikmiş — bugün önce tekrarları bitir, sonra yeni cümlelere geç."; kind="warn"; }
    else { msg="Genel durumun: "+learned+" öğrenilmiş kayıt, "+due+" tekrar bekliyor. İstersen 'Tekrar' ya da 'Yeni Cümleler'den devam et."; kind="tip"; }
    return {msg:msg, kind:kind};
  }
  window.__dhCoachManualStatus=async function(){
    try{ var s=await buildStatusMessage(true); if(s.msg) dhCoachSay(s.msg, s.kind, null, {dayClose:!!s.dayClose, reopen:!!s.reopen, actionHref:s.actionHref, actionLabel:s.actionLabel}); }catch(e){}
  };
  function allPlanStepsDone(){
    /* koç kartındaki (koc.js) "tamamlandı" kurallarının BİREBİR kopyası —
       fark yüzünden kart ✓ gösterirken burası "bitmemiş" sanıyordu:
       1) bugün gerçek aktivite yoksa hiçbir adım tamam sayılmaz,
       2) chat.html adımı HERHANGİ bir sohbet sayfası ziyaretiyle tamamlanır. */
    try{
      var steps=dhPlanSteps(); if(!steps.length) return false;
      var done=dhStepsDone();
      var tr={}; try{ tr=JSON.parse(localStorage.getItem("dh-study-tracker-v1")||"{}")||{}; }catch(e){}
      var td=(tr.days||{})[dhToday()];
      if(!(td && ((td.sentences||0)+(td.reviews||0)+(td.lessons||0)+(td.videos||0)>0))) return false;
      var anyChat=Object.keys(done).some(function(k){ return /^chat[a-z0-9]*\.html$/.test(k); });
      return steps.every(function(st){
        var page=String(st.href||"").split("?")[0];
        return !!done[page] || (page==="chat.html" && anyChat);
      });
    }catch(e){ return false; }
  }
  /* 🌙 Plan bitmiş ama gün kapatılmamışsa: sayfa açılışında teklif et.
     (Eski tetikleyici yalnız son adım biterken çalışıyordu — plan zaten
     bitmişse teklif hiç doğmuyordu. Artık kalıcı bir kapı var.) */
  setTimeout(async function(){
    try{
      if(dhDayClosed()) return;
      if(!allPlanStepsDone()) return;
      var rq2=await dhDayRequirements();
      var tv=dhTourState(rq2);
      if(tv===1) return;   /* kapanış turu sürüyor: öğrencinin üstüne balon açma */
      if(tv===2){ window.dhCoachSay("Kapanış turunu tamamladın 💪 Şimdi günü gönül rahatlığıyla kapatabiliriz.","praise",null,{dayClose:true}); return; }
      window.dhCoachSay(rq2.ok
        ? "Bugünün planı tamam 🎉 Karne de tam — günü kapatalım mı? Hataların dersini çıkarıp interaktif çalışabilirsin."
        : "Plan adımları tamam ama karnede eksik var: "+rq2.items.filter(function(i){return !i.ok;}).map(function(i){return (i.need-i.got)+" "+i.label.toLowerCase();}).join(" + ")+". Kapanış turuna çıkalım mı? 🌙",
        rq2.ok?"praise":"tip",null,{dayClose:true});
    }catch(e){}
  }, 2800);

  (async function genericTip(){
    try{
      /* 🌙 gün kapatıldıysa: periyodik mesaj tamamen susar
         (plan bittiyse buildStatusMessage zaten nag yerine Günü Kapat teklifi döndürür) */
      try{ if(dhDayClosed()) return; }catch(e){}
      var lastT=+localStorage.getItem("dh-coach-last-generic-tip")||0;
      if(Date.now()-lastT<20*60000) return;   // 20 dakikada bir en fazla — "koç her yerde olmalı" isteği gereği sıklaştırıldı
      var s=await buildStatusMessage();
      if(s.msg){ dhCoachSay(s.msg, s.kind, null, {dayClose:!!s.dayClose, reopen:!!s.reopen, actionHref:s.actionHref, actionLabel:s.actionLabel}); localStorage.setItem("dh-coach-last-generic-tip", String(Date.now())); }
    }catch(e){}
  })();
})();
