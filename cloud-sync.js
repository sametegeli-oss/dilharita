/* cloud-sync.js — v24 (YouTube çalışma kitaplığı cihazlar arası senkron)
   ═══════════════════════════════════════════════════════════════
   MİMARİ (tek akış):
     AÇILIŞ  → fullSync: buluttan ÇEK → BİRLEŞTİR → cihaza UYGULA → buluta GERİ YAZ
     ÇALIŞMA → veri değişince 1.5 sn sonra otomatik push (debounce)
     ÇIKIŞ   → ekrandan ayrılırken push (pagehide) · "Çıkış Yap" → push + signOut

   VERİ KAYNAKLARI (bu oturumda kanıtlanmış):
     1) localStorage        : ayarlar, API anahtarları, aktif günler, kelime AYNASI
     2) IndexedDB sentence-mode/kv : React modül ilerlemesi (img:* hariç, HAM anahtarlar)
                              → buluta "smv:"+anahtar olarak gider/gelir
     3) DHProgress (kendi IDB'si)  : kelime/cümle durumu — AYNA üzerinden
                              (mirrorNow: IDB→localStorage, applyMirror: localStorage→IDB)
     4) LearningErrorDB     : hata defteri (all / bulkMerge)
     5) DilHaritaAI_DB      : cümle AI açıklamaları (zaman damgalı, silme mezar taşlı)

   BİRLEŞTİRME KURALLARI:
     dh-study-tracker-v1    → günler birleşir (union), sayaçlarda büyük kazanır,
                              olaylar tekrarsız + gün başına ≤30 (1MB koruması)
     dh-progress-mirror-v1  → kayıt başına "daha yeni / daha ileri" kazanır
     smv:* ve diğerleri     → bulut kazanır; geri-yazma ile bulut = iki cihazın birleşimi
   ═══════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  if (window.__dhCloudSyncInstalled) return;
  window.__dhCloudSyncInstalled = true;

  /* ── 1) SABİTLER ─────────────────────────────────────────── */
  var LS_KEYS = [
    "dh-youtube-explanation-prompt-v1", "dh-youtube-deleted-v1",
    "dh_ai_prompt_teacher", "dh-study-tracker-v1", "dh-ocr-sentences-v1", "dh-profile-v1",
    "dh-teacher-policy-v1", "dh-notif-settings-v1", "dh-progress-mirror-v1",
    "dh-model-nvidia", "dh-model-groq", "dh-model-cerebras", "dh-model-gemini",
    "selectedTeacherAvatar", "dh-teacher-mem", "dh-activity-log-v1", "dh-gun-ozet-v1",
    "dh-gemini-report-v1", "dh-gemini-daily-archive-v1", "dh-word-study-list-v1",
    "dh-error-tombstones-v1", "dh-konuskan-v1"
  ];
  /* "dh-koc-" → günlük koç planı, tamamlanan adımlar, gün epoch'u ve hedef.
     Bunlar cihaza özeldi; telefonda yapılan çalışma bilgisayarda görünmüyordu.
     Artık senkrona dahil (birleştirme kuralları için mergeKoc'a bak). */
  var LS_PREFIXES = ["sm:", "mas:", "ev:", "modscore:", "gramprof:", "story:", "dh-koc-", "dh-day-closed-", "dh-immersive-",
                      "dh-modul-", "dh-gemini-gunluk-", "dh-gemini-day-review-",
                      "dh-speaking-complete-", "dh-gunsonu-pratik-complete-", "dh-gunsonu-gemini-complete-"];   /* karne, Gemini ve konuşma tamamlanması cihazlar arasi */
  var MAX_VAL = 200000;      // alan başına üst sınır (Firestore alan limiti 1MB)
  var TRACKER = "dh-study-tracker-v1";
  var MIRROR  = "dh-progress-mirror-v1";
  var ACTLOG  = "dh-activity-log-v1";
  var GUNOZET = "dh-gun-ozet-v1";   // tek aktivite kaydının günlük özeti (dh-olay.js)
  /* API anahtarlari cihaz sirridir. Yerelde kalir; Firestore'a asla
     gonderilmez ve eski surumlerin yukledigi kopyalar ilk senkronda silinir. */
  var SECRET_KEYS = ["nvidiaApiKeys", "groqApiKeys", "cerebrasApiKeys", "geminiApiKeys", "mistralApiKeys", "openrouterApiKeys", "youtubeApiKeys", "dh-disabled-keys", "apiKeys"];
  function isSecretKey(key){ return SECRET_KEYS.indexOf(key)>=0; }

  var firebaseConfig = {
    apiKey: "AIzaSyBZTHvP8xX94UMtKRt7hIYN7qpbO2gz0Zg",
    authDomain: "sentencemode.firebaseapp.com",
    projectId: "sentencemode",
    storageBucket: "sentencemode.firebasestorage.app",
    messagingSenderId: "1048475533632",
    appId: "1:1048475533632:web:3f719b6da4397ed7c53aa5"
  };

  var fb=null, user=null, ready=false, authResolved=false, saveTimer=null, syncing=false, aiSyncDirty=false;

  /* ── 2) BİRLEŞTİRME (saf fonksiyonlar) ───────────────────── */
  function mergeEvents(a,b){
    var all=(a||[]).concat(b||[]), seen={}, out=[];
    for(var i=0;i<all.length;i++){
      var k; try{ k=JSON.stringify(all[i]); }catch(e){ k=String(all[i]); }
      if(!seen[k]){ seen[k]=1; out.push(all[i]); }
    }
    return out.slice(-30);
  }
  /* ── KOÇ VERİSİ BİRLEŞTİRME ("dh-koc-*") ───────────────────
     Neden özel kural gerekiyor: bu anahtarlarda "son yazan kazanır"
     mantığı iş kaybettirir. Telefonda 2 adım, bilgisayarda 1 adım
     tamamladıysan düz üzerine yazma birini siler.
       • steps-done-<gün> → BİRLEŞİM (iki cihazdaki tüm tamamlamalar)
       • plan-<gün>       → ÖNCE KURULAN kazanır (plan gün içinde sabit kalmalı)
       • epoch-<gün>      → GEÇ olan kazanır ("sonraki günü başlat" en son nerede
                            basıldıysa sıfır noktası odur)
       • goal             → YENİ olan kazanır (setAt)                          */
  /* ── KULLANICI MODULLERI: dizin EZILMEZ, BIRLESTIRILIR ──────
     Neden: "dh-modul-" oneki LS_PREFIXES'te oldugu icin asagidaki
     genel dal `localStorage.setItem(rk, rv)` ile buluttaki dizini
     oldugu gibi yerelin uzerine yaziyordu. Bulut bir onceki
     anlik goruntuyu tasidigi surece YENI olusturulan modul, ilk
     otomatik senkronda dizinden dusuyordu — kayit blogu diskte
     kaliyor ama iki sayfa da dizini okudugu icin modul KAYBOLUYORDU.
     Cozum: dizin kimlik bazinda birlesir, catismada `tarih` yeni
     olan kazanir. Silme icin mezar tasi kullanilir; yoksa birlesim
     silinen modulu geri diriltirdi. */
  /* ── KONUŞKAN ("dh-konuskan-v1") ───────────────────────────
     Tek bir JSON durum; "son yazan kazanır" bir cihazdaki çalışmayı
     silerdi. Kurallar:
       • resetAt büyük olan taraf sıfırlamayı yaptıysa, diğerinin
         sıfırlamadan ÖNCEKİ verisi atılır (o taraf aynen alınır)
       • ayarlar (seviye, ses, model…) → setAt yeni olan kazanır
       • days → gün başına BÜYÜK süre; xp ve sayaçlar → büyük olan
       • done, ach, srs, fb → birleşim (srs'te kutusu/tarihi ileri olan)
       • errors → birleşim; delErr mezar taşındakiler geri gelmez     */
  function mergeKonuskan(localStr, remoteStr){
    var L=null,R=null;
    try{ L=JSON.parse(localStr||"null"); }catch(e){}
    try{ R=JSON.parse(remoteStr||"null"); }catch(e){}
    if(!L||typeof L!=="object") return remoteStr;
    if(!R||typeof R!=="object") return localStr;
    var lr=+L.resetAt||0, rr=+R.resetAt||0;
    if(rr>lr && (+L.updatedAt||0)<rr) return remoteStr;
    if(lr>rr && (+R.updatedAt||0)<lr) return localStr;
    var newer=(+R.setAt||0)>(+L.setAt||0)?R:L, out={}, k;
    for(k in L) if(L.hasOwnProperty(k)) out[k]=L[k];
    ["level","rate","voiceName","showTr","theme","course","goal","tierChat","tierDeep","certName","setAt"].forEach(function(f){ if(newer[f]!==undefined) out[f]=newer[f]; });
    out.resetAt=Math.max(lr,rr);
    out.updatedAt=Math.max(+L.updatedAt||0,+R.updatedAt||0);
    out.xp=Math.max(+L.xp||0,+R.xp||0);
    function maxMap(a,b){ var o={},x; a=a||{}; b=b||{}; for(x in a) if(a.hasOwnProperty(x)) o[x]=a[x]; for(x in b) if(b.hasOwnProperty(x)&&(o[x]==null||+b[x]>+o[x])) o[x]=b[x]; return o; }
    function unionMap2(a,b){ var o={},x; a=a||{}; b=b||{}; for(x in a) if(a.hasOwnProperty(x)) o[x]=a[x]; for(x in b) if(b.hasOwnProperty(x)&&o[x]==null) o[x]=b[x]; return o; }
    out.days=maxMap(L.days,R.days);
    out.done=unionMap2(L.done,R.done);
    out.ach=unionMap2(L.ach,R.ach);
    out.fb=unionMap2(L.fb,R.fb);
    out.delErr=maxMap(L.delErr,R.delErr);
    var srs={}, a=L.srs||{}, b=R.srs||{};
    for(k in a) if(a.hasOwnProperty(k)) srs[k]=a[k];
    for(k in b) if(b.hasOwnProperty(k)){ var x=srs[k], y=b[k]; if(!x || (+y.at||0)>(+x.at||0) || (!(+x.at)&&!(+y.at)&&String(y.due||"")>String(x.due||""))) srs[k]=y; }
    out.srs=srs;
    var seen={}, errs=[];
    (L.errors||[]).concat(R.errors||[]).forEach(function(e){ if(!e) return; var id=(e.d||"")+"|"+(e.wrong||"")+"|"+(e.right||""); if(seen[id]||out.delErr[id]) return; seen[id]=1; errs.push(e); });
    errs.sort(function(p,q){ return String(p.d||"")<String(q.d||"")?-1:String(p.d||"")>String(q.d||"")?1:0; });
    out.errors=errs.slice(-150);
    var ls=L.stats||{}, rs=R.stats||{}, st={};
    ["msgs","ok","run","bestRun","sentOk","sentAll"].forEach(function(f){ st[f]=Math.max(+ls[f]||0,+rs[f]||0); });
    st.pron=((ls.pron||[]).length>=(rs.pron||[]).length?ls.pron:rs.pron)||[];
    st.done=maxMap(ls.done,rs.done);
    out.stats=st;
    /* Sertifikalar kaybolmaz: seviye başına yüksek puanlı kayıt kalır
       (ilk alınan sertifika numarası korunur). Sınav denemeleri: en çok
       deneme ve en iyi puan; son sonuç daha yeni olan cihazdan. */
    var lc=L.certs||{}, rc=R.certs||{}, certs={};
    for(k in lc) if(lc.hasOwnProperty(k)) certs[k]=lc[k];
    for(k in rc) if(rc.hasOwnProperty(k)){ var cl=certs[k], cr=rc[k]; if(!cl) certs[k]=cr; else { var best=(+cr.score||0)>(+cl.score||0)?cr:cl, keepId=String(cl.date||"")<=String(cr.date||"")?cl.id:cr.id; var m={}; for(var q in best) if(best.hasOwnProperty(q)) m[q]=best[q]; m.id=keepId||best.id; if((+cr.at||0)>(+cl.at||0)&&cr.name) m.name=cr.name; else if(cl.name) m.name=cl.name; certs[k]=m; } }
    out.certs=certs;
    var le=L.exams||{}, re=R.exams||{}, exams={};
    for(k in le) if(le.hasOwnProperty(k)) exams[k]=le[k];
    for(k in re) if(re.hasOwnProperty(k)){ var el=exams[k], er=re[k]; if(!el){ exams[k]=er; continue; } var newerE=(+er.at||0)>(+el.at||0)?er:el; exams[k]={tries:Math.max(+el.tries||0,+er.tries||0),best:Math.max(+el.best||0,+er.best||0),last:newerE.last,lastDate:newerE.lastDate,at:Math.max(+el.at||0,+er.at||0)}; }
    out.exams=exams;
    /* Kendi kurslarım: kimlik bazında birleşim, çakışmada yeni (at) olan;
       silinen kurs (customDel mezar taşı) geri gelmez. */
    out.customDel=maxMap(L.customDel,R.customDel);
    var lcu=L.custom||{}, rcu=R.custom||{}, cu={};
    for(k in lcu) if(lcu.hasOwnProperty(k)) cu[k]=lcu[k];
    for(k in rcu) if(rcu.hasOwnProperty(k)&&(!cu[k]||(+rcu[k].at||0)>(+cu[k].at||0))) cu[k]=rcu[k];
    for(k in cu) if(cu.hasOwnProperty(k)&&out.customDel[k]&&(+out.customDel[k]>=(+cu[k].at||0))) delete cu[k];
    out.custom=cu;
    if(String(out.course||"").indexOf("C:")===0&&!cu[String(out.course).slice(2)]) out.course="L:"+(out.level||"A2");
    return JSON.stringify(out);
  }
  function mergeModulMezar(localStr, remoteStr){
    var L={},R={},out={},k;
    try{ L=JSON.parse(localStr||"{}")||{}; }catch(e){}
    try{ R=JSON.parse(remoteStr||"{}")||{}; }catch(e){}
    for(k in R){ if(R.hasOwnProperty(k)) out[k]=+R[k]||0; }
    for(k in L){ if(L.hasOwnProperty(k) && (+L[k]||0)>(+out[k]||0)) out[k]=+L[k]||0; }
    return JSON.stringify(out);
  }
  function mergeErrorTombstones(localStr,remoteStr){
    var L={},R={},out={allBefore:0,ids:{},keys:{}},k;
    try{L=JSON.parse(localStr||"{}")||{};}catch(e){}
    try{R=JSON.parse(remoteStr||"{}")||{};}catch(e){}
    out.allBefore=Math.max(+L.allBefore||0,+R.allBefore||0);
    [R.ids||{},L.ids||{}].forEach(function(src){for(k in src)if(src.hasOwnProperty(k))out.ids[k]=Math.max(+out.ids[k]||0,+src[k]||0);});
    [R.keys||{},L.keys||{}].forEach(function(src){for(k in src)if(src.hasOwnProperty(k))out.keys[k]=Math.max(+out.keys[k]||0,+src[k]||0);});
    return JSON.stringify(out);
  }
  function mergeModulDizin(localStr, remoteStr, mezarStr){
    var L=[],R=[],T={};
    try{ L=JSON.parse(localStr||"[]")||[]; }catch(e){}
    try{ R=JSON.parse(remoteStr||"[]")||[]; }catch(e){}
    try{ T=JSON.parse(mezarStr||"{}")||{}; }catch(e){}
    if(!Array.isArray(L)) L=[];
    if(!Array.isArray(R)) R=[];
    var map={};
    /* esitlik: beraberlikte bu kaynak kazanir. Yerel kopya goc ile
       onarilmis olabilecegi icin (bozuk ad -> duzgun ad) esitlikte
       yereli tercih ediyoruz. */
    function ekle(a, esitlik){
      for(var i=0;i<a.length;i++){
        var e=a[i]; if(!e||!e.id) continue;
        var v=map[e.id];
        var yt=+e.tarih||0, vt=v?(+v.tarih||0):-1;
        if(!v || yt>vt || (esitlik && yt===vt)) map[e.id]=e;
      }
    }
    ekle(R, false); ekle(L, true);
    var out=[];
    for(var k in map){
      if(!map.hasOwnProperty(k)) continue;
      var st=+T[k]||0;
      if(st && st >= (+map[k].tarih||0)) continue;   /* silinmis */
      out.push(map[k]);
    }
    out.sort(function(a,b){ return (+b.tarih||0)-(+a.tarih||0); });
    return JSON.stringify(out);
  }
  function mergeModul(key, localStr, remoteStr, uzakMezar, yerelMezar){
    if(key==="dh-modul-silinen") return mergeModulMezar(localStr, remoteStr);
    if(key==="dh-modul-dizin"){
      var ym=(yerelMezar!==undefined)?yerelMezar:localStorage.getItem("dh-modul-silinen");
      var mezar=mergeModulMezar(ym, uzakMezar);
      return mergeModulDizin(localStr, remoteStr, mezar);
    }
    /* Kayit blogu: yereldeki varsa o kazanir — goc modul adlarini
       duzeltmis olabilir, buluttaki eski ad geri gelmesin. */
    if(localStr!=null && localStr!=="") return localStr;
    return remoteStr;
  }

  function mergeKoc(key, localStr, remoteStr){
    if(localStr==null || localStr==="") return remoteStr;
    if(remoteStr==null || remoteStr==="") return localStr;
    var L=null,R=null;
    try{ L=JSON.parse(localStr); }catch(e){}
    try{ R=JSON.parse(remoteStr); }catch(e){}
    if(!L || typeof L!=="object") return remoteStr;
    if(!R || typeof R!=="object") return localStr;

    if(key.indexOf("dh-koc-steps-done-")===0){
      var out={}, k;
      for(k in R){ if(R.hasOwnProperty(k) && R[k]) out[k]=R[k]; }
      for(k in L){ if(L.hasOwnProperty(k) && L[k]) out[k]=L[k]; }
      return JSON.stringify(out);
    }
    if(key.indexOf("dh-koc-plan-")===0){
      var lt=(L.madeAt&&L.madeAt.ts)||0, rt=(R.madeAt&&R.madeAt.ts)||0;
      if(lt && rt) return (lt<=rt) ? localStr : remoteStr;   /* önce kurulan */
      if(rt && !lt) return remoteStr;
      return localStr;
    }
    if(key.indexOf("dh-koc-epoch-")===0){
      /* epoch'ta zaman damgası yok: daha ileri sayaçlar daha geç basılmıştır */
      var ls=(L.sentences||0)+(L.reviews||0)+(L.lessons||0)+(L.videos||0);
      var rs=(R.sentences||0)+(R.reviews||0)+(R.lessons||0)+(R.videos||0);
      return (rs>ls) ? remoteStr : localStr;
    }
    if(key==="dh-koc-goal"){
      return ((R.setAt||0) > (L.setAt||0)) ? remoteStr : localStr;
    }
    return localStr;
  }

  /* Yaşam sahnesinde iki cihazdan en son güncellenen hikâye devam eder. */
  function mergeImmersive(localStr, remoteStr){
    var L={},R={};
    try{L=JSON.parse(localStr||"{}")||{};}catch(e){}
    try{R=JSON.parse(remoteStr||"{}")||{};}catch(e){}
    return JSON.stringify((+R.updatedAt||0)>(+L.updatedAt||0)?R:L);
  }
  function mergeGeminiArchive(localStr,remoteStr){
    var L=[],R=[],map={},now=Date.now(),cut=now-30*86400000;
    try{L=JSON.parse(localStr||"[]")||[];}catch(e){}
    try{R=JSON.parse(remoteStr||"[]")||[];}catch(e){}
    if(!Array.isArray(L))L=[];if(!Array.isArray(R))R=[];
    R.concat(L).forEach(function(x){if(!x||(+x.at||0)<cut)return;var id=String(x.date||"");var old=map[id];if(!old||(+x.at||0)>(+old.at||0))map[id]=x;});
    var out=Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return (+a.at||0)-(+b.at||0);});
    return JSON.stringify(out.slice(-30));
  }
  function mergeTracker(localStr, remoteStr){
    var L={},R={};
    try{ L=JSON.parse(localStr||"{}")||{}; }catch(e){}
    try{ R=JSON.parse(remoteStr||"{}")||{}; }catch(e){}
    var out={};
    for(var k in R){ if(R.hasOwnProperty(k)&&k!=="days") out[k]=R[k]; }
    for(var k2 in L){ if(L.hasOwnProperty(k2)&&k2!=="days") out[k2]=L[k2]; }
    var ld=L.days||{}, rd=R.days||{}, days={}, all={};
    for(var d in ld){ if(ld.hasOwnProperty(d)) all[d]=1; }
    for(var d2 in rd){ if(rd.hasOwnProperty(d2)) all[d2]=1; }
    for(var day in all){
      var a=ld[day], b=rd[day];
      if(a&&b){
        /* CİHAZ KOVALARI: her cihazın katkısı ayrı tutulur. Aynı cihazın iki
           kopyasında BÜYÜK olan alınır (idempotent), sonra cihazlar TOPLANIR.
           Böylece telefon 6 + bilgisayar 4 = 10 olur; tekrarlanan senkronlarda
           şişmez. Kovasız eski günlerde eski davranış (büyük olan) korunur. */
        var by={}, dev, f, FIELDS=["lessons","minutes","sentences","videos","reviews","errors","speaking"];
        [a.by||{}, b.by||{}].forEach(function(src){
          for(var dv in src){
            if(!src.hasOwnProperty(dv)) continue;
            if(!by[dv]) by[dv]={};
            for(var fl in src[dv]){
              if(!src[dv].hasOwnProperty(fl)) continue;
              by[dv][fl]=Math.max(by[dv][fl]||0, src[dv][fl]||0);
            }
          }
        });
        var sum={};
        for(dev in by){ if(!by.hasOwnProperty(dev)) continue;
          for(f in by[dev]){ if(by[dev].hasOwnProperty(f)) sum[f]=(sum[f]||0)+(by[dev][f]||0); } }
        days[day]={ date:day, events:mergeEvents(a.events,b.events) };
        if(Object.keys(by).length) days[day].by=by;
        FIELDS.forEach(function(fl){
          var legacy=Math.max(a[fl]||0, b[fl]||0);
          var val=Math.max(legacy, sum[fl]||0);
          if(val || a[fl]!=null || b[fl]!=null) days[day][fl]=val;
        });
      } else {
        days[day]=a||b;
        if(days[day]&&days[day].events&&days[day].events.length>30)
          days[day].events=mergeEvents(days[day].events,[]);
      }
    }
    out.days=days;
    return JSON.stringify(out);
  }
  function mergeProfile(localStr, remoteStr, preferLocal){
    var L={},R={};
    try{ L=JSON.parse(localStr||"{}")||{}; }catch(e){}
    try{ R=JSON.parse(remoteStr||"{}")||{}; }catch(e){}
    if(!Object.keys(L).length) return remoteStr;
    if(!Object.keys(R).length) return localStr;
    var lt=+L.guncellendi||+L.seviyeTarih||0;
    var rt=+R.guncellendi||+R.seviyeTarih||0;
    /* Profilin tamamını tek tarihle seçmek seviyeyi geriye götürüyordu:
       örn. mobilde C1 testi yapıldıktan sonra masaüstünde yalnız günlük hedef
       değiştirilince, masaüstünün yeni `guncellendi` değeri eski B2 seviyesini
       C1'in üstüne yazıyordu. Genel alanlar en yeni profil kaydından; seviye
       ailesi ise kendi `seviyeTarih/seviyeTesti.tarih` damgasından seçilir. */
    var winner=(preferLocal&&Object.keys(L).length)?L:(rt>lt?R:L);
    var older=winner===L?R:L, out={},k;
    for(k in older) if(older.hasOwnProperty(k)) out[k]=older[k];
    for(k in winner) if(winner.hasOwnProperty(k)) out[k]=winner[k];
    function levelTs(o){return Math.max(+o.seviyeTarih||0,+(o.seviyeTesti&&o.seviyeTesti.tarih)||0);}
    var levelWinner=levelTs(R)>levelTs(L)?R:L;
    if(levelWinner.seviye) out.seviye=levelWinner.seviye;
    if(levelWinner.seviyeTarih) out.seviyeTarih=levelWinner.seviyeTarih;
    if(levelWinner.seviyeTesti) out.seviyeTesti=levelWinner.seviyeTesti;
    out.guncellendi=Math.max(lt,rt,+out.guncellendi||0);
    return JSON.stringify(out);
  }

  /* Profil, eski `dh-level` aynası ve öğretmen anayasası aynı seviyeyi
     göstermeli. Seviye testinin en yeni tarihli sonucu üçüne de uygulanır. */
  function repairProfileLevelAliases(){
    try{
      var p=JSON.parse(localStorage.getItem("dh-profile-v1")||"{}")||{};
      var pol=JSON.parse(localStorage.getItem("dh-teacher-policy-v1")||"{}")||{};
      var pt=Math.max(+p.seviyeTarih||0,+(p.seviyeTesti&&p.seviyeTesti.tarih)||0);
      var qt=+(pol.seviyeTesti&&pol.seviyeTesti.tarih)||0;
      var usePolicy=qt>pt, level=usePolicy&&pol.seviyeTesti?pol.seviyeTesti.level:p.seviye;
      if(!level && pol.seviye&&pol.seviye!=="auto") level=pol.seviye;
      if(!/^(A1|A2|B1|B2|C1|C2)$/.test(String(level||""))) return;
      var chosenTs=Math.max(pt,qt);
      p.seviye=level; if(chosenTs) p.seviyeTarih=chosenTs;
      if(usePolicy&&pol.seviyeTesti) p.seviyeTesti=pol.seviyeTesti;
      pol.seviye=level;
      if(p.seviyeTesti&&(!pol.seviyeTesti||+(p.seviyeTesti.tarih||0)>=+(pol.seviyeTesti.tarih||0))) pol.seviyeTesti=p.seviyeTesti;
      localStorage.setItem("dh-profile-v1",JSON.stringify(p));
      localStorage.setItem("dh-level",level);
      localStorage.setItem("dh-teacher-policy-v1",JSON.stringify(pol));
    }catch(e){}
  }
  /* Gemini karnesi: iki cihaz farklı tarihte karne aldıysa en yeni karne
     kazanır. Boş/bozuk uzak kayıt geçerli yerel karneyi silemez. */
  function mergeGeminiReport(localStr, remoteStr){
    var L=null,R=null;
    try{ L=JSON.parse(localStr||"null"); }catch(e){}
    try{ R=JSON.parse(remoteStr||"null"); }catch(e){}
    if(!L||!L.data) return remoteStr;
    if(!R||!R.data) return localStr;
    var lt=L.at?new Date(L.at).getTime():0, rt=R.at?new Date(R.at).getTime():0;
    return rt>lt ? remoteStr : localStr;
  }
  /* Aynı gün iki cihazda çözülen karne sorularının doğru cevap kanıtlarını
     birleştir; bir cihazın ilerlemesi diğerini geriye götürmesin. */
  function mergeGeminiDaily(localStr, remoteStr){
    var L={},R={}; try{L=JSON.parse(localStr||"{}")||{};}catch(e){}
    try{R=JSON.parse(remoteStr||"{}")||{};}catch(e){}
    var out={correct:{}};
    var lc=L.correct||{}, rc=R.correct||{}, k;
    for(k in lc) if(lc.hasOwnProperty(k)&&lc[k]) out.correct[k]=1;
    for(k in rc) if(rc.hasOwnProperty(k)&&rc[k]) out.correct[k]=1;
    return JSON.stringify(out);
  }
  function mergeMirror(localStr, remoteStr){
    var L={},R={};
    try{ L=JSON.parse(localStr||"{}")||{}; }catch(e){}
    try{ R=JSON.parse(remoteStr||"{}")||{}; }catch(e){}
    var out={};
    for(var k in L){ if(L.hasOwnProperty(k)) out[k]=L[k]; }
    for(var k2 in R){
      if(!R.hasOwnProperty(k2)) continue;
      var r=R[k2], l=out[k2];
      if(!l){ out[k2]=r; continue; }
      var lU=(l&&l[1])||0, rU=(r&&r[1])||0;
      if(rU>lU || (rU===lU && (r[0]||0)>(l[0]||0))) out[k2]=r;
    }
    return JSON.stringify(out);
  }
  // Aktivite logu: iki cihazın kayıtlarını BİRLEŞTİRİR (basit üzerine yazma değil —
  // aksi halde bir cihazın günü diğerininkini silerdi). Zaman damgasına göre tekilleştirilir,
  // en yeni 600 kayıt / 150KB sınırında tutulur (Firestore güvenliği).
  /* GÜNLÜK ÖZET (dh-olay.js): gün birleşimi; her gün cihaz kovalı.
     Aynı cihazın iki kopyasında alan bazında BÜYÜK olan alınır (idempotent).
     90 günden eski sıkıştırılmış gün tek "_" kovası taşır: bir taraf sıkışmışsa
     iki taraf da toplanıp büyük olan "_" olarak tutulur (çift sayım olmaz). */
  function mergeGunOzet(localStr, remoteStr){
    var L={},R={};
    try{ L=JSON.parse(localStr||"{}")||{}; }catch(e){}
    try{ R=JSON.parse(remoteStr||"{}")||{}; }catch(e){}
    var lg=L.gun||{}, rg=R.gun||{}, out={v:1,gun:{}};
    function maxObj(a,b){ var o={},k; a=a||{}; b=b||{};
      for(k in a) if(a.hasOwnProperty(k)) o[k]=+a[k]||0;
      for(k in b) if(b.hasOwnProperty(k)) o[k]=Math.max(o[k]||0,+b[k]||0); return o; }
    function maxKonu(a,b){ var o={},k; a=a||{}; b=b||{};
      for(k in a) if(a.hasOwnProperty(k)) o[k]=[+a[k][0]||0,+a[k][1]||0];
      for(k in b) if(b.hasOwnProperty(k)){ var x=o[k]||[0,0]; o[k]=[Math.max(x[0],+b[k][0]||0),Math.max(x[1],+b[k][1]||0)]; } return o; }
    function maxKova(a,b){ var o={}; ["s","d","y","e"].forEach(function(f){ var m=maxObj(a&&a[f],b&&b[f]); if(Object.keys(m).length) o[f]=m; });
      var kk=maxKonu(a&&a.k,b&&b.k); if(Object.keys(kk).length) o.k=kk; return o; }
    function topla(g){ var t={s:{},d:{},y:{},k:{}}, by=(g&&g.by)||{};
      for(var dv in by){ if(!by.hasOwnProperty(dv)) continue; var c=by[dv]||{};
        ["s","d","y"].forEach(function(f){ var x=c[f]||{}; for(var n in x) if(x.hasOwnProperty(n)) t[f][n]=(t[f][n]||0)+(+x[n]||0); });
        var k=c.k||{}; for(var q in k) if(k.hasOwnProperty(q)){ var v=t.k[q]||(t.k[q]=[0,0]); v[0]+=+k[q][0]||0; v[1]+=+k[q][1]||0; } }
      return t; }
    function sikismis(g){ var by=(g&&g.by)||{}; return !!by._; }
    var gunler={}, d;
    for(d in lg) if(lg.hasOwnProperty(d)) gunler[d]=1;
    for(d in rg) if(rg.hasOwnProperty(d)) gunler[d]=1;
    for(d in gunler){
      var a=lg[d], b=rg[d];
      if(!a||!b){ out.gun[d]=a||b; continue; }
      if(sikismis(a)||sikismis(b)){ out.gun[d]={by:{_:maxKova(topla(a),topla(b))}}; continue; }
      var by={}, ab=a.by||{}, bb=b.by||{}, dv2;
      for(dv2 in ab) if(ab.hasOwnProperty(dv2)) by[dv2]=maxKova(ab[dv2], bb[dv2]);
      for(dv2 in bb) if(bb.hasOwnProperty(dv2) && !by[dv2]) by[dv2]=maxKova(null, bb[dv2]);
      out.gun[d]={by:by};
    }
    return JSON.stringify(out);
  }
  function mergeActivityLog(localStr, remoteStr){
    var L=[],R=[];
    try{ L=JSON.parse(localStr||"[]")||[]; }catch(e){}
    try{ R=JSON.parse(remoteStr||"[]")||[]; }catch(e){}
    var seen={}, out=[];
    L.concat(R).forEach(function(e){
      var key=(e&&e.ts)+"|"+(e&&e.page)+"|"+(e&&e.kind);
      if(!seen[key]){ seen[key]=1; out.push(e); }
    });
    out.sort(function(a,b){ return (a.ts||0)-(b.ts||0); });
    while(out.length>600 || JSON.stringify(out).length>150000) out.shift();
    return JSON.stringify(out);
  }

  /* ── 3) 1MB KORUMASI: şişmiş tracker onarımı ─────────────── */
  function sanitizeTracker(){
    try{
      var raw=localStorage.getItem(TRACKER);
      if(!raw || raw.length<200000) return;
      var d=JSON.parse(raw)||{}, days=d.days||{};
      for(var day in days){ if(days.hasOwnProperty(day)&&days[day]&&days[day].events)
        days[day].events=mergeEvents(days[day].events,[]); }
      d.days=days;
      var out=JSON.stringify(d);
      if(out.length>180000){
        for(var d2 in days){ if(days.hasOwnProperty(d2)&&days[d2]) days[d2].events=[]; }
        out=JSON.stringify(d);
      }
      if(out.length<raw.length){
        localStorage.setItem(TRACKER,out);
        console.log("[cloud-sync] tracker küçültüldü:",raw.length,"→",out.length);
      }
    }catch(e){}
  }

  /* ── 4) React modül ilerlemesi: IndexedDB sentence-mode/kv ─ */
  function kvOpen(){
    return new Promise(function(res){
      try{
        var r=indexedDB.open("sentence-mode");
        r.onsuccess=function(){ res(r.result); };
        r.onerror=function(){ res(null); };
      }catch(e){ res(null); }
    });
  }
  async function kvReadAll(){
    var db=await kvOpen(); if(!db) return {};
    return new Promise(function(res){
      try{
        var name=db.objectStoreNames.contains("kv")?"kv":db.objectStoreNames[0];
        if(!name){ db.close(); return res({}); }
        var out={}, req=db.transaction(name,"readonly").objectStore(name).openCursor();
        req.onsuccess=function(e){
          var c=e.target.result;
          if(c){
            var k=String(c.key);
            if(k && k.indexOf("img:")!==0){          // resim önbelleği HARİÇ
              var v; try{ v=JSON.stringify(c.value); }catch(_){ v=String(c.value); }
              if(v && v.length<=MAX_VAL) out["smv:"+k]=v;
            }
            c.continue();
          } else { db.close(); res(out); }
        };
        req.onerror=function(){ db.close(); res({}); };
      }catch(e){ try{db.close();}catch(_){ } res({}); }
    });
  }
  async function kvWriteAll(map){
    var keys=Object.keys(map||{}); if(!keys.length) return 0;
    var db=await kvOpen(); if(!db) return 0;
    return new Promise(function(res){
      try{
        var name=db.objectStoreNames.contains("kv")?"kv":db.objectStoreNames[0];
        if(!name){ db.close(); return res(0); }
        var tx=db.transaction(name,"readwrite"), st=tx.objectStore(name), n=0;
        keys.forEach(function(k){
          var v=map[k]; try{ v=JSON.parse(map[k]); }catch(_){}
          var raw=(k.indexOf("smv:")===0)?k.slice(4):k;
          try{ st.put(v,raw); n++; }catch(_){}
        });
        tx.oncomplete=function(){ db.close(); res(n); };
        tx.onerror=function(){ db.close(); res(n); };
      }catch(e){ try{db.close();}catch(_){ } res(0); }
    });
  }

  /* ── 4b) AI açıklamaları: DilHaritaAI_DB/ai_explanations ── */
  function aiOpen(){return new Promise(function(res){try{var r=indexedDB.open("DilHaritaAI_DB",1);r.onupgradeneeded=function(e){var db=e.target.result;if(!db.objectStoreNames.contains("ai_explanations"))db.createObjectStore("ai_explanations",{keyPath:"sentence"});};r.onsuccess=function(){res(r.result);};r.onerror=function(){res(null);};}catch(e){res(null);}});}
  async function aiReadAll(){var db=await aiOpen();if(!db)return [];return new Promise(function(res){try{var out=[],tx=db.transaction("ai_explanations","readonly"),req=tx.objectStore("ai_explanations").openCursor();req.onsuccess=function(e){var c=e.target.result;if(c){var v=c.value||{};if(v.sentence)out.push({sentence:String(v.sentence),explanation:String(v.explanation||""),deleted:!!v.deleted,timestamp:v.timestamp||""});c.continue();}else{db.close();out.sort(function(a,b){return a.sentence.localeCompare(b.sentence);});res(out);}};req.onerror=function(){db.close();res([]);};}catch(e){try{db.close();}catch(_){}res([]);}});}
  function aiTime(v){var n=Date.parse(v&&v.timestamp||"");return isFinite(n)?n:0;}
  async function aiMergeRemote(remote){if(!Array.isArray(remote)||!remote.length)return 0;var local=await aiReadAll(),map={};local.forEach(function(x){map[x.sentence]=x;});var incoming=[];remote.forEach(function(x){if(!x||!x.sentence)return;var old=map[String(x.sentence)];if(!old||aiTime(x)>aiTime(old))incoming.push({sentence:String(x.sentence),explanation:String(x.explanation||""),deleted:!!x.deleted,timestamp:x.timestamp||new Date().toISOString()});});if(!incoming.length)return 0;var db=await aiOpen();if(!db)return 0;return new Promise(function(res){try{var tx=db.transaction("ai_explanations","readwrite"),st=tx.objectStore("ai_explanations");incoming.forEach(function(x){st.put(x);});tx.oncomplete=function(){db.close();res(incoming.length);};tx.onerror=function(){db.close();res(0);};}catch(e){try{db.close();}catch(_){}res(0);}});}

  /* ── 5) Diğer yerel kaynaklar ─────────────────────────────── */
  async function mirrorNow(){
    var jobs=[];
    try{ if(window.DHProgress&&DHProgress.mirrorNow) jobs.push(Promise.resolve(DHProgress.mirrorNow()).catch(function(){})); }catch(e){}
    /* YouTube dersleri IndexedDB'de tutulur. Her bulut yazmasından önce
       güncel kitaplığı localStorage aynasına çıkar; böylece senkron başka
       bir sayfadaki düğmeden başlatılsa bile son transkript kaybolmaz. */
    try{ if(window.DHYouTubeStudy&&DHYouTubeStudy.mirrorNow) jobs.push(Promise.resolve(DHYouTubeStudy.mirrorNow()).catch(function(){})); }catch(e){}
    await Promise.all(jobs);
  }
  async function applyMirror(){
    var added=0;
    try{ if(window.DHProgress&&DHProgress.applyMirror) added+=(+await Promise.resolve(DHProgress.applyMirror()).catch(function(){return 0;})||0); }catch(e){}
    /* Buluttan gelen video belgelerini diğer cihazın IndexedDB kitaplığına
       fullSync tamamlanmadan uygula. */
    try{ if(window.DHYouTubeStudy&&DHYouTubeStudy.applyMirror) added+=(+await Promise.resolve(DHYouTubeStudy.applyMirror()).catch(function(){return 0;})||0); }catch(e){}
    return added;
  }
  function errAll(){ try{ if(window.LearningErrorDB&&LearningErrorDB.allFull) return LearningErrorDB.allFull(); if(window.LearningErrorDB&&LearningErrorDB.all) return LearningErrorDB.all(); }catch(e){} return Promise.resolve([]); }
  function errMerge(list){ try{ if(window.LearningErrorDB&&LearningErrorDB.bulkMerge&&Array.isArray(list)) return LearningErrorDB.bulkMerge(list); }catch(e){} return Promise.resolve(0); }

  /* Koç anahtarlarından buluta GİTMEYENLER: cihaza özel model durumu, her açılışta yeniden
     hesaplanan özet (ayrıca koc/hesap belgesine yazılıyor) ve dünden eski günlük planlar
     (her gün yeni anahtar; ayar belgesi 1 MB sınırına doğru büyümesin). */
  function kocHaric(key){
    if(key.indexOf("dh-koc-")!==0) return false;
    if(key==="dh-koc-model-durum"||key==="dh-koc-hesap-v1") return true;
    var m=/^dh-koc-gun-(\d{4}-\d\d-\d\d)$/.exec(key);
    if(m){ var d=new Date(); d.setDate(d.getDate()-1); var dun=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); return m[1]<dun; }
    return false;
  }
  function lsCollect(){
    var out={};
    for(var i=0;i<LS_KEYS.length;i++){
      try{ var v=localStorage.getItem(LS_KEYS[i]); if(v!=null&&v.length<=MAX_VAL) out[LS_KEYS[i]]=v; }catch(e){}
    }
    try{
      for(var j=0;j<localStorage.length;j++){
        var key=localStorage.key(j); if(!key) continue;
        if(kocHaric(key)) continue;
        for(var p=0;p<LS_PREFIXES.length;p++){
          if(key.indexOf(LS_PREFIXES[p])===0){
              try{ var vv=localStorage.getItem(key),ytFull=key.indexOf("dh-immersive-youtube-study-")===0; if(vv!=null&&vv.length<=(ytFull?900000:MAX_VAL)) out[key]=vv; }catch(e){}
            break;
          }
        }
      }
    }catch(e){}
    return out;
  }

  /* ── 6) TÜM YERELİ TOPLA (push yükü) ─────────────────────── */
  function unionMap(a,b){var out={};a=a||{};b=b||{};for(var k in a)if(a.hasOwnProperty(k)&&a[k])out[k]=a[k];for(var k2 in b)if(b.hasOwnProperty(k2)&&b[k2])out[k2]=b[k2];return out}
  function mergeShadowAttempts(a,b){a=a||{};b=b||{};var out={},keys={};for(var k in a)keys[k]=1;for(var k2 in b)keys[k2]=1;Object.keys(keys).forEach(function(k){var av=a[k],bv=b[k];if(av==null){out[k]=bv;return}if(bv==null){out[k]=av;return}out[k]=(Array.isArray(av)?av.length:0)>=(Array.isArray(bv)?bv.length:0)?av:bv});return out}
  /* Ek açıklamalar: "at" kimliğiyle birleşir; bir cihazda silinen (del)
     kayıt diğer cihazdan geri gelmez. */
  function mergeExplanationNotes(a,b){a=a||{};b=b||{};var out={},keys={};for(var k in a)keys[k]=1;for(var k2 in b)keys[k2]=1;Object.keys(keys).forEach(function(k){var map={};[].concat(Array.isArray(a[k])?a[k]:[],Array.isArray(b[k])?b[k]:[]).forEach(function(n){if(!n||!n.at)return;var id=String(n.at),old=map[id];if(!old){map[id]=n;return}if(n.del||old.del)map[id]={at:n.at,del:true,q:"",a:""}});var list=Object.keys(map).map(function(id){return map[id]}).sort(function(x,y){return(+x.at||0)-(+y.at||0)});if(list.length)out[k]=list});return out}
  function mergeYoutubeUserState(a,b){
    a=a||{};b=b||{};
    return {
      learned:unionMap(a.learned,b.learned),
      hard:unionMap(a.hard,b.hard),
      favorites:unionMap(a.favorites,b.favorites),
      words:unionMap(a.words,b.words),
      grammar:unionMap(a.grammar,b.grammar),
      aiExplanations:Object.assign({},a.aiExplanations||{},b.aiExplanations||{}),
      shadowAttempts:mergeShadowAttempts(a.shadowAttempts,b.shadowAttempts),
      quizWrong:unionMap(a.quizWrong,b.quizWrong),
      explanationNotes:mergeExplanationNotes(a.explanationNotes,b.explanationNotes),
      lastIndex:Math.max(+a.lastIndex||0,+b.lastIndex||0)
    };
  }
  async function youtubeRecords(incoming){
    var db=await new Promise(function(resolve,reject){var r=indexedDB.open("DilHaritaYouTube_DB",2);r.onupgradeneeded=function(){var d=r.result;if(!d.objectStoreNames.contains("studies")){var s=d.createObjectStore("studies",{keyPath:"videoId"});s.createIndex("updatedAt","updatedAt")}if(!d.objectStoreNames.contains("shadowAudio")){var a=d.createObjectStore("shadowAudio",{keyPath:"id"});a.createIndex("videoId","videoId");a.createIndex("updatedAt","updatedAt")}};r.onsuccess=function(){resolve(r.result)};r.onerror=function(){reject(r.error)};r.onblocked=function(){reject(new Error("YouTube kayıtları meşgul. Diğer sekmeleri kapatıp yeniden deneyin."))}});
    try{return await new Promise(function(resolve,reject){var tx=db.transaction("studies",incoming?"readwrite":"readonly"),st=tx.objectStore("studies"),q=st.getAll(),rows=[];q.onsuccess=function(){rows=q.result||[];if(incoming){var map={};rows.forEach(function(r){map[r.videoId]=r});incoming.forEach(function(r){
      var old=map[r.videoId];
      if(!old){st.put(r);map[r.videoId]=r;return}
      /* TOPLA + BİRLEŞTİR: hangisi "yeni" diye tek tarafı seçip diğerini
         atmak yerine, iki cihazın da öğrendim/zor/kelime/quiz gibi
         ilerleme verilerini birleştirir (union); içerik (transkript,
         çeviri, quiz soruları) için en güncel updatedAt'li taraf esas
         alınır, ama ilerleme her durumda birleşir. */
      var newer=(+r.updatedAt||+r.savedAt||0)>=(+old.updatedAt||+old.savedAt||0)?r:old;
      var merged=JSON.parse(JSON.stringify(newer));
      merged.study=merged.study||{};
      merged.study.userState=mergeYoutubeUserState((old.study&&old.study.userState)||{},(r.study&&r.study.userState)||{});
      merged.savedAt=Math.min(+old.savedAt||Date.now(),+r.savedAt||Date.now());
      merged.updatedAt=Math.max(+old.updatedAt||0,+r.updatedAt||0);
      merged.lastOpenedAt=Math.max(+old.lastOpenedAt||0,+r.lastOpenedAt||0);
      st.put(merged);map[r.videoId]=merged;
    });rows=Object.keys(map).map(function(k){return map[k]})}};tx.oncomplete=function(){resolve(rows)};tx.onerror=tx.onabort=function(){reject(tx.error||new Error("YouTube kitaplığı kaydedilemedi."))}})}finally{db.close()}
  }
  async function collectAll(){
    sanitizeTracker();
    await mirrorNow();                       // kelime ilerlemesi → ayna (localStorage)
    var ls=lsCollect();
    var videos=await youtubeRecords();
    videos.forEach(function(r){ls["dh-immersive-youtube-study-"+r.videoId]=JSON.stringify(r)});
    var kv=await kvReadAll();                // modül ilerlemesi (smv:*)
    for(var k in kv){ if(kv.hasOwnProperty(k)) ls[k]=kv[k]; }
    var errors=await errAll().catch(function(){ return []; });
    var ai=await aiReadAll().catch(function(){ return []; });
    return { ls:ls, errors:Array.isArray(errors)?errors.slice(0,3000):[], ai:ai };
  }

  /* ── 7) PUSH: yereli buluta yaz ──────────────────────────── */
  var YT_SIL_KEY = "dh-yt-silinecek-v1";   // silinmesi yarıda kalan eski video parçaları
  var YT_TEMIZ_KEY = "dh-yt-temizlik-v1";  // haftalık öksüz parça temizliğinin son zamanı
  var YT_PULL_KEY = "dh-yt-pull-v1";   // artımlı video okuma işareti (uid, en yeni updated_at, son tam tarama)
  var DOC_LIMIT = 950000;   // Firestore belge limiti ~1MB; güvenli tavan
  function mainCloudPayloadSize(ls){
    /* Her YouTube videosu users/{uid}/youtube_studies altında ayrı belgeye
       yazılır. Bunları ana settings/progress 1MB hesabına katmak, video
       sayısı arttığında ilgisiz ilerleme kayıtlarını gereksiz yere atardı. */
    var main={};
    for(var k in ls){
      if(!ls.hasOwnProperty(k)||k.indexOf("dh-immersive-youtube-study-")===0) continue;
      main[k]=ls[k];
    }
    try{ return JSON.stringify(main).length; }catch(e){ return 0; }
  }
  function shrinkToLimit(ls){
    var size=mainCloudPayloadSize(ls), dropped=0;
    if(size<=DOC_LIMIT) return {size:size,dropped:0};
    // sınır aşıldı: en BÜYÜK smv: değerlerinden başlayarak at (küçük not kayıtları kalsın)
    var smv=[];
    for(var k in ls){ if(ls.hasOwnProperty(k)&&k.indexOf("smv:")===0) smv.push([k,(ls[k]||"").length]); }
    smv.sort(function(a,b){ return b[1]-a[1]; });
    for(var i=0;i<smv.length && size>DOC_LIMIT;i++){
      size-=smv[i][1]; delete ls[smv[i][0]]; dropped++;
    }
    size=mainCloudPayloadSize(ls);
    return {size:size,dropped:dropped};
  }
  /* ══════════════════════════════════════════════════════════════════
     YAZMA DENETİMİ  (v8)
     ------------------------------------------------------------------
     ÇÖZÜLEN HATA
       FirebaseError [resource-exhausted]:
         "Write stream exhausted maximum allowed queued writes"
       + "Using maximum backoff delay to prevent overloading the backend"

     SEBEP (ölçüldü)
       Her push ~787 KB yazıyordu (settings 302 KB + progress 485 KB) ve
       push'lar bu boyuttaki bir yazmanın tamamlanabileceğinden çok daha
       sık tetikleniyordu:
         · hookLocalStorage — beyaz listedeki her setItem push tetikler.
           coach-bubble.js HER sayfa açılışında dh-activity-log-v1'e
           yazdığı için, uygulamada gezinmek tek başına yetiyordu.
         · pagehide VE visibilitychange ikisi birden flushOnLeave çağırıyor
           — tek sayfa geçişinde iki yazma denemesi.
         · practice/tekrar'da her kart tracker'ı güncelliyor.
       Firestore'un bekleyen yazma kuyruğu 500'dür. Kuyruk hiç boşalmadan
       büyüyünce önce backoff tavana çıkıyor, sonra kuyruk taşıyordu.
       Belgeler boyut/alan sınırlarının ALTINDA — sunucu reddetmiyor,
       yalnızca yetişemiyordu.

     ÜÇ KATMANLI ÇÖZÜM
       1) FARK YAZMA  — son push'tan beri değişmeyen anahtar gönderilmez.
          Tipik push 787 KB yerine birkaç KB. Asıl çözüm budur.
       2) TEK UÇUŞ    — bir yazma sürerken ikincisi başlamaz; istek gelirse
          bayrağa yazılır ve bitince BİR KEZ çalışır (coalescing).
       3) ASGARİ ARALIK — otomatik push'lar arasında en az MIN_ARALIK.
          Elle tetiklenen push (çıkış, "şimdi senkronla") bu sınıra takılmaz.
     ══════════════════════════════════════════════════════════════════ */
  var MIN_ARALIK = 20000;          /* otomatik push'lar arası en az süre */
  var SIG_KEY    = "dh-push-sig-v1";   /* beyaz listede DEĞİL — kendini tetiklemesin */

  var __pushBusy=false, __failStreak=0, __cooldownUntil=0;
  var __sonPushTs=0, __bekleyen=false, __sonFlush=0;

  /* Otomatik tetikleyiciler bu bayrakla susturulabilir.
     NOT: tekrar.html satır 248 zaten "DHCloudSync.autoPush = false" yazıyordu
     ama cloud-sync.js bu alanı HİÇ OKUMUYORDU — konsola "susturuldu"
     yazılıyor, hiçbir şey susmuyordu. Artık gerçekten uygulanıyor. */
  function otoAcikMi(){
    try{ return !(global.DHCloudSync && global.DHCloudSync.autoPush === false); }
    catch(e){ return true; }
  }

  /* ---------- anahtar imzası (fark yazma için) ---------- */
  function sigOf(v){
    var s=String(v==null?"":v), h=5381, i=s.length;
    while(i) h=((h*33) ^ s.charCodeAt(--i))>>>0;
    return s.length.toString(36)+":"+h.toString(36);
  }
  function sigOku(){
    try{ return JSON.parse(localStorage.getItem(SIG_KEY)||"{}")||{}; }catch(e){ return {}; }
  }
  function sigYaz(m){
    try{ localStorage.setItem(SIG_KEY, JSON.stringify(m)); }catch(e){}
  }
  function sigSifirla(){ try{ localStorage.removeItem(SIG_KEY); }catch(e){} }

  /* tam=true → imzalara bakma, her şeyi yaz (fullSync geri-yazması gibi) */
  async function pushNow(tam){
    tam = (tam === true);      /* push(event) gibi kazara argümanlar tam gönderim saymasın */
    if(!ready||!user||!fb) return { ok:false, error:"hazır değil" };
    if(Date.now()<__cooldownUntil) return { ok:false, error:"bekleme modunda (art arda hata)" };  // devre kesici
    if(__pushBusy){ __bekleyen=true; return { ok:false, error:"zaten yazılıyor (sıraya alındı)" }; }
    __pushBusy=true;
    try{
      /* Silinmiş videoları bir kez buluttan da kaldır (aksi halde
         diğer cihazlar bir sonraki senkronda videoyu geri diriltir). */
      try{
        var delMap={}; try{ delMap=JSON.parse(localStorage.getItem("dh-youtube-deleted-v1")||"{}")||{}; }catch(_e){}
        var toPurge=[]; for(var dvid in delMap){ if(delMap.hasOwnProperty(dvid) && !delMap[dvid].cloudPurged) toPurge.push(dvid); }
        if(toPurge.length && fb.deleteYoutubeStudy){
          for(var pi=0;pi<toPurge.length;pi++){ await fb.deleteYoutubeStudy(user.uid,toPurge[pi]); delMap[toPurge[pi]].cloudPurged=true; }
          localStorage.setItem("dh-youtube-deleted-v1", JSON.stringify(delMap));
        }
      }catch(_e){}
      try{ await vaultSync(); }catch(e){ console.warn("[cloud-sync] anahtar kasası",e); }
      var data=await collectAll();
      var g=shrinkToLimit(data.ls);

      /* ---- FARK: yalnızca değişen anahtarlar ---- */
      var gercekEski = sigOku(), eski = tam ? {} : gercekEski;
      var yeniSig = {}, degisen = {}, degisenSayi = 0;
      /* VİDEO KAYITLARI (her biri ayrı belge, çoğu yüzlerce KB) tam gönderimde bile
         yalnız DEĞİŞTİYSE yazılır. Eskiden her açılıştaki tam senkron 65 videonun hepsini
         (~150 belge) yeniden yazıyordu; sayfa erken kapanınca eski parçalar silinemeyip
         öksüz kalıyordu (24 Kasım: 15 dakikada 147 öksüz parça). */
      for(var k in data.ls){
        if(!data.ls.hasOwnProperty(k)) continue;
        var sg = sigOf(data.ls[k]);
        yeniSig[k] = sg;
        var ytK = k.indexOf("dh-immersive-youtube-study-")===0;
        if((ytK ? gercekEski[k] : eski[k]) !== sg){ degisen[k] = data.ls[k]; degisenSayi++; }
      }
      var errSig = sigOf(JSON.stringify(data.errors||[]));
      var errDegisti = (eski.__errors !== errSig);
      yeniSig.__errors = errSig;
      var aiChanged=[];
      (data.ai||[]).forEach(function(rec){var ak="__aix:"+sigOf(rec.sentence||""),av=sigOf(JSON.stringify(rec));yeniSig[ak]=av;if(tam||eski[ak]!==av)aiChanged.push(rec);});
      var aiDegisti = aiChanged.length>0;

      if(!degisenSayi && !errDegisti && !aiDegisti){
        __sonPushTs = Date.now();
        return { ok:true, skipped:true, size:0, dropped:g.dropped };
      }

      await fb.saveSettings(user.uid, {
        ls: degisen,
        errors: errDegisti ? data.errors : null,
        /* her video belgesi bitince imzası hemen saklanır: yazma yarıda kesilirse
           bir sonraki açılışta yalnız kalanlar yazılır */
        onYt: function(key){ try{ var m=sigOku(); m[key]=yeniSig[key]; sigYaz(m); }catch(e){} }
      });
      var aiCloudError="";
      if(aiDegisti){
        try{ await fb.saveAIExplanations(user.uid,aiChanged); aiSyncDirty=false; }
        catch(aiErr){
          /* Sunucudaki yeni alt koleksiyon kuralı henüz yayımlanmamışsa
             ana ilerleme eşlemesini başarısız sayma. AI kayıtları cihazda
             kalır ve izin açılınca yeniden gönderilir. */
          aiSyncDirty=true;
          aiCloudError=(aiErr&&aiErr.message?aiErr.message:"AI açıklama izni yok").slice(0,140);
          (data.ai||[]).forEach(function(rec){var ak="__aix:"+sigOf(rec.sentence||"");if(eski[ak]!==undefined)yeniSig[ak]=eski[ak];else delete yeniSig[ak];});
          console.warn("[cloud-sync] AI açıklamaları cihazda korundu:",aiCloudError);
        }
      }

      /* İmzalar YALNIZCA yazma başarılıysa saklanır. Yoksa başarısız bir
         yazmadan sonra o değişiklik bir daha hiç gönderilmezdi. */
      sigYaz(yeniSig);
      __sonPushTs = Date.now();
      try{ localStorage.setItem("dh-last-push-ts", String(__sonPushTs)); }catch(e){}
      __failStreak=0;
      return { ok:true, size:JSON.stringify(degisen).length, alan:degisenSayi, dropped:g.dropped, aiCloudError:aiCloudError };
    }catch(e){
      console.warn("cloud-sync yazma hata:", e);
      __failStreak++;
      if(__failStreak>=2){ __cooldownUntil=Date.now()+90000; console.warn("[cloud-sync] art arda hata — 90sn otomatik yazma durduruldu"); }
      return { ok:false, error:(e&&e.message?e.message:"bilinmeyen").slice(0,120) };
    }finally{
      __pushBusy=false;
      /* uçuş sırasında gelen istekleri TEK seferde topla */
      if(__bekleyen){ __bekleyen=false; pushSoon(); }
    }
  }

  function pushSoon(){
    if(!ready||!user) return;
    if(!otoAcikMi()) return;
    if(__pushBusy){ __bekleyen=true; return; }
    clearTimeout(saveTimer);
    /* asgari aralığı bekle; üstüne rastgele pay (çoklu sekme çakışması) */
    var kalan = Math.max(0, MIN_ARALIK - (Date.now()-__sonPushTs));
    var gecikme = Math.max(1500, kalan) + Math.floor(Math.random()*1200);
    saveTimer=setTimeout(function(){ pushNow(); }, gecikme);
  }

  /* ── 8) FULL SYNC: çek → birleştir → uygula → geri yaz ───── */
  /* Bir promise'i verilen sürede tamamlanmazsa etiketli bir hatayla
     düşürür. Firestore isteği kendi başına sonsuza dek askıda kalabilir
     (özellikle mobil/hücresel ağda); bu, HANGİ adımın takıldığını net
     gösterir ve o adımı tek başına 30 saniyelik genel bekçiye bırakmaz. */
  function withTimeout(promise,ms,label){
    return new Promise(function(resolve,reject){
      var done=false;
      var t=setTimeout(function(){ if(done)return; done=true; reject(new Error(label+" (zaman aşımı, "+Math.round(ms/1000)+"sn)")); },ms);
      promise.then(function(v){ if(done)return; done=true; clearTimeout(t); resolve(v); },function(e){ if(done)return; done=true; clearTimeout(t); reject(e); });
    });
  }
  function waitForAuth(maxMs){
    return new Promise(function(res){
      if(authResolved) return res();
      var w=0, iv=setInterval(function(){
        w+=100;
        if(authResolved||w>=(maxMs||4000)){ clearInterval(iv); res(); }
      },100);
    });
  }

  async function fullSync(){
    if(!ready) return { ok:false, message:"Bulut bağlantısı henüz hazır değil. Birkaç saniye sonra tekrar dene." };
    await waitForAuth(4000);
    if(!user) return { ok:false, message:"Senkron için önce giriş yapmalısın." };
    if(syncing) return { ok:false, message:"Senkron zaten sürüyor…" };
    syncing=true;
    var watchdog=setTimeout(function(){
      if(!syncing) return;
      syncing=false;
      try{ window.dispatchEvent(new CustomEvent("dh-cloud-sync-state",{detail:{state:"error",message:"Senkron 180 saniyede tamamlanamadı (ağ isteği askıda kaldı); tekrar deneyin."}})); }catch(_){}
    },180000);
    try{
      var migration=false;
      try{ migration=!!localStorage.getItem("dh-account-migration-pending"); }catch(e){}
      var __syncTotal=8;
      function tick(step,label){ try{ window.dispatchEvent(new CustomEvent("dh-cloud-sync-state",{detail:{state:"syncing",migration:migration,step:step,total:__syncTotal,label:label}})); }catch(e){} }
      tick(1,"Ayarlar okunuyor…");
      var mainSettings=await withTimeout(fb.loadMainSettings(user.uid),15000,"Ayarlar okunamadı");
      /* Artımlı video okuma: son başarılı senkronda görülen en yeni
         updated_at'ten 24 saat öncesine kadar olanlar okunur (cihaz saatleri
         farklı olabilir; birleştirme tekrar okumaya dayanıklı). İlk senkronda,
         hesap değişince ve haftada bir tam tarama (yalnız ana kayıtlar). */
      var ytIz={}; try{ ytIz=JSON.parse(localStorage.getItem(YT_PULL_KEY)||"{}")||{}; }catch(e){}
      var ytTam = migration || ytIz.uid!==user.uid || !(+ytIz.max>0) || (Date.now()-(+ytIz.fullAt||0)) > 7*864e5;
      var ytSince = ytTam ? 0 : Math.max(1, +ytIz.max - 864e5);
      tick(2,ytTam?"Video kayıtları okunuyor (tam tarama)…":"Değişen video kayıtları okunuyor…");
      var videoRows;
      function kotaNotu(e){ var m=(e&&e.message)||String(e||""); return /zaman aşımı|resource.exhausted|quota/i.test(m) ? new Error(m+" — Firestore'un günlük okuma kotası dolmuş olabilir; kota her gün Türkiye saatiyle 10:00–11:00 arasında yenilenir.") : e; }
      try{
        videoRows=await withTimeout(fb.loadYoutubeStudiesRaw(user.uid,function(n){tick(2,n+" video kaydı okundu…");},ytSince),60000,"Video kayıtları okunamadı");
      }catch(firstErr){
        tick(2,"Video kayıtları tekrar deneniyor…");
        try{
          videoRows=await withTimeout(fb.loadYoutubeStudiesRaw(user.uid,function(n){tick(2,"(2. deneme) "+n+" video kaydı okundu…");},ytSince),60000,"Video kayıtları okunamadı (2. deneme)");
        }catch(secondErr){ throw kotaNotu(secondErr); }
      }
      var remote=Object.assign({},mainSettings);
      videoRows.forEach(function(v){ remote[v.key]=v.payload; });
      var corruptSkipped=videoRows.__skipped||[];
      tick(3,"AI açıklamaları okunuyor…");
      var remoteAI=await withTimeout(fb.loadAIExplanations(user.uid),15000,"AI açıklamaları okunamadı").catch(function(){return [];});
      try{ await fb.purgeSecrets(user.uid); }catch(e){}
      try{ await vaultSync(mainSettings&&mainSettings.__keyVault||null); }catch(e){ console.warn("[cloud-sync] anahtar kasası",e); }
      var rd=parseRemote(remote);
      /* SİLİNEN VİDEOLAR: iki cihazın "silindi" listesini birleştir (union,
         üzerine yazma değil), sonra bu listedeki videoları buluttan gelen
         kayıtlardan çıkar — aksi halde bir cihazda silinen video diğer
         cihazda (veya aynı cihazda yeni senkronda) diriliyordu. */
      var localDeleted={}; try{ localDeleted=JSON.parse(localStorage.getItem("dh-youtube-deleted-v1")||"{}")||{}; }catch(e){}
      var remoteDeleted={}; if(rd.ls["dh-youtube-deleted-v1"]){ try{ remoteDeleted=JSON.parse(rd.ls["dh-youtube-deleted-v1"])||{}; }catch(e){} }
      var mergedDeleted={}, allDelIds={};
      Object.keys(localDeleted).forEach(function(id){allDelIds[id]=1});
      Object.keys(remoteDeleted).forEach(function(id){allDelIds[id]=1});
      Object.keys(allDelIds).forEach(function(id){
        var a=localDeleted[id]||{}, b=remoteDeleted[id]||{};
        mergedDeleted[id]={title:a.title||b.title||"Video",deletedAt:Math.min(a.deletedAt||Date.now(),b.deletedAt||Date.now()),cloudPurged:!!(a.cloudPurged||b.cloudPurged)};
      });
      try{ localStorage.setItem("dh-youtube-deleted-v1", JSON.stringify(mergedDeleted)); }catch(e){}
      delete rd.ls["dh-youtube-deleted-v1"]; // aşağıdaki genel döngü üzerine yazmasın, zaten birleştirildi
      var incomingVideos=[];
      Object.keys(rd.ls).forEach(function(k){if(k.indexOf("dh-immersive-youtube-study-")===0){var vid=k.slice("dh-immersive-youtube-study-".length);if(mergedDeleted[vid]){delete rd.ls[k];return}var r=JSON.parse(rd.ls[k]);if(r&&r.study&&/^[\w-]{11}$/.test(r.videoId))incomingVideos.push(r);delete rd.ls[k]}});
      tick(4,incomingVideos.length?("Video ilerlemesi birleştiriliyor ("+incomingVideos.length+")…"):"Video ilerlemesi kontrol ediliyor…");
      await youtubeRecords(incomingVideos);
      // MODÜL ÇAKIŞMA YÖNÜ: bulut, bu cihazın son yazmasından YENİYSE bulut kazanır;
      // değilse (bu cihaz daha taze) yalnız yerelde OLMAYAN modül kayıtları alınır.
      var cloudNewer = ((remote&&remote.updated_at)||0) > (+localStorage.getItem("dh-last-push-ts")||0);
      var pulled=0, kvIncoming={};

      tick(5,"Yerel veriler uygulanıyor…");
      for(var rk in rd.ls){
        if(!rd.ls.hasOwnProperty(rk)) continue;
        var rv=rd.ls[rk];
        if(rv==null||rv==="") continue;
        var ok=(LS_KEYS.indexOf(rk)>=0) || rk.indexOf("smv:")===0;
        if(!ok){ for(var p=0;p<LS_PREFIXES.length;p++){ if(rk.indexOf(LS_PREFIXES[p])===0){ ok=true; break; } } }
        if(!ok || isSecretKey(rk)) continue;
        try{
          if(rk.indexOf("smv:")===0){ kvIncoming[rk]=rv; pulled++; }
          else if(rk==="dh-youtube-explanation-prompt-v1"){var lp=null,rp=JSON.parse(rv);try{lp=JSON.parse(localStorage.getItem(rk)||"null")}catch(e){}if(rp&&typeof rp.text==="string"&&(!lp||(+rp.updatedAt||0)>(+lp.updatedAt||0)))localStorage.setItem(rk,rv);pulled++;}
          else if(rk==="dh-profile-v1"){ localStorage.setItem(rk,mergeProfile(localStorage.getItem(rk),rv,migration)); pulled++; }
          else if(rk===TRACKER){ localStorage.setItem(rk, mergeTracker(localStorage.getItem(rk), rv)); pulled++; }
          else if(rk==="dh-gemini-report-v1"){ localStorage.setItem(rk, mergeGeminiReport(localStorage.getItem(rk),rv)); pulled++; }
          else if(rk==="dh-gemini-daily-archive-v1"){ localStorage.setItem(rk, mergeGeminiArchive(localStorage.getItem(rk),rv)); pulled++; }
          else if(rk==="dh-konuskan-v1"){ localStorage.setItem(rk, mergeKonuskan(localStorage.getItem(rk), rv)); pulled++; }
          else if(rk==="dh-error-tombstones-v1"){ localStorage.setItem(rk,mergeErrorTombstones(localStorage.getItem(rk),rv)); pulled++; }
          else if(rk.indexOf("dh-gemini-gunluk-")===0){ localStorage.setItem(rk, mergeGeminiDaily(localStorage.getItem(rk),rv)); pulled++; }
          else if(rk===MIRROR){ localStorage.setItem(rk, mergeMirror(localStorage.getItem(rk), rv)); pulled++; }
          else if(rk===ACTLOG){ localStorage.setItem(rk, mergeActivityLog(localStorage.getItem(rk), rv)); pulled++; }
          else if(rk===GUNOZET){ localStorage.setItem(rk, mergeGunOzet(localStorage.getItem(rk), rv)); pulled++; }
          else if(rk.indexOf("dh-koc-")===0){ localStorage.setItem(rk, mergeKoc(rk, localStorage.getItem(rk), rv)); pulled++; }
          else if(rk==="dh-immersive-state-v1"){ localStorage.setItem(rk, mergeImmersive(localStorage.getItem(rk),rv)); pulled++; }
          else if(rk.indexOf("dh-modul-")===0){ localStorage.setItem(rk, mergeModul(rk, localStorage.getItem(rk), rv, rd.ls["dh-modul-silinen"])); pulled++; }
          else {
            /* Misafir → hesap geçişinde bu cihazdaki profil ve tercihler
               korunur. Birleşebilen ilerleme kayıtları üstteki özel
               kurallarla zaten iki taraflı birleştirilir. */
            if(!(migration && localStorage.getItem(rk)!=null)) localStorage.setItem(rk, rv);
            pulled++;
          }
        }catch(e){}
      }
      repairProfileLevelAliases();

      /* KULLANICI MODULLERI — IndexedDB tarafi.
         Moduller artik localStorage'da degil kv deposunda ("dh-modul-..."),
         yani buraya "smv:dh-modul-..." olarak geliyorlar. Asagidaki
         cloudNewer daligi bu anahtarlar icin YANLIS olurdu:
           - bulut tazeyse dizini EZER  -> yeni modul kaybolur
           - yerel tazeyse dizini ATAR  -> obur cihazin modulu gelmez
         Ikisi de veri kaybi. Bu yuzden modul anahtarlari once
         birlestirilir, sonra cloudNewer eleginin DISINDA tutulur. */
      var kvVar=await kvReadAll();
      var modulAnahtar={};
      for(var mk in kvIncoming){
        if(!kvIncoming.hasOwnProperty(mk)) continue;
        if(mk.indexOf("smv:dh-modul-")!==0) continue;
        modulAnahtar[mk]=1;
        try{
          kvIncoming[mk]=mergeModul(
            mk.slice(4),
            (kvVar[mk]!==undefined)?kvVar[mk]:null,
            kvIncoming[mk],
            kvIncoming["smv:dh-modul-silinen"],
            (kvVar["smv:dh-modul-silinen"]!==undefined)?kvVar["smv:dh-modul-silinen"]:null
          );
        }catch(e){}
      }

      if(!cloudNewer){
        // yerel daha taze: mevcut yerel kayıtların üzerine yazma, sadece eksikleri al
        var have=kvVar;
        for(var hk in kvIncoming){
          if(!kvIncoming.hasOwnProperty(hk)) continue;
          if(modulAnahtar[hk]) continue;                 /* moduller birlestirildi */
          if(have[hk]!==undefined) delete kvIncoming[hk];
        }
      }
      tick(6,"Kelime ve ilerleme aynaları uygulanıyor…");
      await kvWriteAll(kvIncoming);                 // modül ilerlemesi → IndexedDB (React okur)
      var addedAI=await aiMergeRemote(remoteAI);    // AI açıklaması: en yeni kayıt/silme kazanır
      var addedErr=await errMerge(rd.errors||[]);   // hata defteri birleşir
      var addedProg=await applyMirror();            // kelime + YouTube aynaları → ilgili IDB'ler
      /* GERİ YAZ: bulut = birleşim. Burada FARK yazma kullanılmaz —
         birleştirme sonrası bulut ile cihazın aynı olduğundan emin olmak
         için tam gönderim yapılır ve imzalar sıfırdan kurulur. */
      tick(7,"Buluta yazılıyor…");
      var pres=await pushNow(true);
      tick(8,"Tamamlanıyor…");

      // teşhis sayacı
      var kvNow=await kvReadAll();
      var mirCount=0; try{ mirCount=Object.keys(JSON.parse(localStorage.getItem(MIRROR)||"{}")).length; }catch(e){}
      var parts=[];
      if(pulled) parts.push(pulled+" kayıt buluttan alındı");
      if(addedErr) parts.push(addedErr+" hata kaydı eklendi");
      if(addedProg) parts.push(addedProg+" yerel kayıt uygulandı");
      if(addedAI) parts.push(addedAI+" AI açıklaması birleştirildi");
      if(corruptSkipped.length) parts.push(corruptSkipped.length+" video atlandı (bozuk kayıt: "+corruptSkipped.join(", ")+")");
      if(!parts.length) parts.push("her şey zaten güncel");
      var pmsg = pres&&pres.ok
        ? ("buluta yazıldı "+Math.round((pres.size||0)/1024)+"KB"+(pres.dropped?(" ("+pres.dropped+" büyük kayıt atlandı)"):""))
        : ("buluta YAZILAMADI: "+(pres&&pres.error||"?"));
      if(pres&&pres.aiCloudError) parts.push("AI açıklamaları cihazda korundu; Firestore izni yayımlanınca yeniden denenecek");
      if(!pres || !pres.ok){
        updateBadge(false);
        try{ window.dispatchEvent(new CustomEvent("dh-cloud-sync-state",{detail:{state:"error",message:pmsg,migration:migration}})); }catch(e){}
        return {ok:false,message:"Cihazdaki verilerin korundu; "+pmsg+". Daha sonra yeniden deneyebilirsin."};
      }
      try{ localStorage.setItem("dh-last-sync-ts", String(Date.now())); }catch(e){}
      /* Haftada bir öksüz video parçası temizliği (~video belge sayısı kadar okuma) */
      try{
        if(Date.now()-(+localStorage.getItem(YT_TEMIZ_KEY)||0) > 7*864e5 && fb.cleanupOrphanedYoutubeStudyParts){
          localStorage.setItem(YT_TEMIZ_KEY, String(Date.now()));
          fb.cleanupOrphanedYoutubeStudyParts(user.uid).then(function(r){ if(r&&r.deleted) console.info("[cloud-sync] öksüz video parçası silindi:", r.deleted); }).catch(function(){});
        }
      }catch(e){}
      try{ localStorage.setItem(YT_PULL_KEY, JSON.stringify({ uid:user.uid, max:Math.max(ytTam?0:(+ytIz.max||0), +videoRows.__maxUpdated||0) || (ytTam?Date.now():(+ytIz.max||Date.now())), fullAt: ytTam?Date.now():(+ytIz.fullAt||Date.now()) })); }catch(e){}
      if(migration && pres && pres.ok){
        try{
          localStorage.removeItem("dh-account-migration-pending");
          localStorage.removeItem("dh_guest_mode");
          localStorage.setItem("dh-account-migrated-at",String(Date.now()));
        }catch(e){}
      }
      /* Ekrandaki kartlar (koç planı, sayaçlar) taze veriyle yeniden çizilsin */
      try{ window.dispatchEvent(new CustomEvent("dh-cloud-synced",{detail:{pulled:pulled}})); }catch(e){}
      updateBadge(true);
      try{ window.dispatchEvent(new CustomEvent("dh-cloud-sync-state",{detail:{state:"success",migration:migration,message:parts.join(", ")}})); }catch(e){}
      return { ok:true, message:"✓ "+parts.join(", ")+" · "+pmsg+". [cihazda modül:"+Object.keys(kvNow).length+" · kelime:"+mirCount+"]" };
    }catch(e){
      try{ window.dispatchEvent(new CustomEvent("dh-cloud-sync-state",{detail:{state:"error",message:(e&&e.message)||"Senkron başarısız"}})); }catch(_){}
      return { ok:false, message:"Senkron başarısız: "+(e&&e.message?e.message:"bilinmeyen") };
    }finally{
      clearTimeout(watchdog);
      syncing=false;
    }
  }

  /* ── 9) Uzak belgeyi normalize et (eski+yeni yapı+__bulk) ── */
  function parseRemote(remote){
    var out={ ls:{}, errors:[] };
    if(!remote) return out;
    var d=remote.data&&typeof remote.data==="object"?remote.data:null;
    if(d&&d.ls){ for(var k in d.ls){ if(d.ls.hasOwnProperty(k)) out.ls[k]=d.ls[k]; } }
    if(d&&Array.isArray(d.errors)) out.errors=out.errors.concat(d.errors);
    for(var rk in remote){
      if(!Object.prototype.hasOwnProperty.call(remote,rk)) continue;
      if(rk==="data"||rk==="__ts"||rk==="__errors"||rk==="__bulk"||rk==="updated_at") continue;
      if(!isSecretKey(rk) && remote[rk]!=null && typeof remote[rk]==="string") out.ls[rk]=remote[rk];
    }
    if(remote.__bulk&&typeof remote.__bulk==="object"){
      for(var bk in remote.__bulk){ if(remote.__bulk.hasOwnProperty(bk)&&!isSecretKey(bk)&&remote.__bulk[bk]!=null) out.ls[bk]=remote.__bulk[bk]; }
    }
    if(Array.isArray(remote.__errors)) out.errors=out.errors.concat(remote.__errors);
    return out;
  }

  /* ── 10) FIREBASE (kanıtlı çalışan başlatma) ─────────────── */
  function initFirebase(){
    return Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js")
    ]).then(function(mods){
      var appMod=mods[0], authMod=mods[1], fsMod=mods[2];
      var app;
      try{
        var existing=appMod.getApps&&appMod.getApps();
        app=(existing&&existing.length)?existing[0]:appMod.initializeApp(firebaseConfig);
      }catch(e){ app=appMod.initializeApp(firebaseConfig); }
      var auth=authMod.getAuth(app);
      /* Bazı mobil operatör/wifi ağları Firestore'un varsayılan akış
         (WebChannel/gRPC) bağlantısını engelliyor veya bozuyor; istekler
         hiç yanıt almadan askıda kalıyor (özellikle mobilde, masaüstünde
         sorun yok). Daha uyumlu "long polling" moduna zorlamak bunu çözer. */
      var db;
      try{
        db=fsMod.initializeFirestore(app,{experimentalAutoDetectLongPolling:true});
      }catch(e){
        db=fsMod.getFirestore(app); // zaten başlatılmışsa (örn. sayfa yeniden çalıştı) düşer
      }
      /* KALICILIĞA DOKUNULMAZ (bkz. auth-guard.js): oturumun saklandığı yeri
         yalnız login.html seçer. Burada setPersistence(localStorage) çağrılması
         IndexedDB'deki oturumu görünmez yapıyor ve senkronu sessizce
         durduruyordu (kullanıcı hep "giriş yapılmamış" görünüyordu). */
      fb={
        auth:auth, db:db,
        onAuth:function(cb){ return authMod.onAuthStateChanged(auth,cb); },
        signOut:function(){ try{ return authMod.signOut(auth); }catch(e){ return Promise.resolve(); } },
        purgeSecrets:function(uid){
          var del=fsMod.deleteField(), patch={};
          for(var i=0;i<SECRET_KEYS.length;i++) patch[SECRET_KEYS[i]]=del;
          /* Yeni belgelerde kok alanlari temizle. Eski `data.ls` bicimi icin
             FieldPath kullan; nokta birlestirme yanlis alani silebilir. */
          var ref=fsMod.doc(db,"settings",uid);
          var jobs=[fsMod.setDoc(ref,patch,{merge:true})];
          var args=[];
          for(var j=0;j<SECRET_KEYS.length;j++){
            args.push(new fsMod.FieldPath("data","ls",SECRET_KEYS[j]),del);
          }
          try{ jobs.push(fsMod.updateDoc.apply(null,[ref].concat(args)).catch(function(){})); }catch(e){}
          return Promise.all(jobs);
        },
        /* Şifreli API anahtar kasası: settings/{uid}.__keyVault
           Yalnız AES-GCM ile şifrelenmiş kutu gider; parola cihazdan çıkmaz. */
        loadKeyVault:function(uid){
          return fsMod.getDoc(fsMod.doc(db,"settings",uid)).then(function(s){ var d=s.exists()?s.data():null; return (d&&d.__keyVault)||null; });
        },
        saveKeyVault:function(uid,v){
          return fsMod.setDoc(fsMod.doc(db,"settings",uid),{__keyVault:v},{merge:true});
        },
        deleteKeyVault:function(uid){
          return fsMod.setDoc(fsMod.doc(db,"settings",uid),{__keyVault:fsMod.deleteField()},{merge:true});
        },
        loadMainSettings:function(uid){
          // Sadece iki küçük belge (ayarlar + ilerleme); video kayıtları AYRI
          // (loadYoutubeStudiesRaw) çünkü kalabalık koleksiyon zayıf bağlantıda
          // her şeyi bloklamasın diye artık birlikte beklenmiyor.
          return Promise.all([
            fsMod.getDoc(fsMod.doc(db,"settings",uid)).then(function(s){return s.exists()?s.data():null;}),
            fsMod.getDoc(fsMod.doc(db,"progress",uid)).then(function(s){return s.exists()?s.data():null;}).catch(function(){return null;})
          ]).then(function(a){
            var st=a[0]||{}, pg=a[1]||{}, out={};
            for(var k in st){ if(st.hasOwnProperty(k)) out[k]=st[k]; }
            for(var k2 in pg){ if(pg.hasOwnProperty(k2)&&k2!=="updated_at") out[k2]=pg[k2]; }  // progress daha taze → üstüne
            if(pg.__bulk){ out.__bulk=Object.assign({},st.__bulk||{},pg.__bulk); }
            out.updated_at=Math.max(st.updated_at||0, pg.updated_at||0);
            return out;
          });
        },
        loadYoutubeStudiesRaw:function(uid,onProgress,since){
          /* OKUMA KOTASI (24 Kasım): eskiden koleksiyonun TAMAMI belge
             kimliği sırasıyla okunuyordu. Bulutta binlerce öksüz parça
             birikince her senkron 3000+ belge okudu, Firestore'un günlük
             50.000 okuma kotası birkaç senkronda bitti ve okumalar askıda
             kalıp "zaman aşımı" verdi. Şimdi:
             - since > 0: yalnız updated_at > since olan belgeler (değişen
               videolar ve onların parçaları) okunur;
             - since = 0 (ilk senkron / haftalık tam tarama): yalnız ANA
               kayıtlar ("key" alanı olanlar; öksüz parçaların key'i yok)
               okunur, parçaları kimlikleriyle tek tek alınır.
             Sayfalar küçük: bir sayfa başarısız olursa yalnız o yeniden denenir. */
          var colRef=fsMod.collection(db,"users",uid,"youtube_studies");
          var PAGE=12, parts={}, fetched=0, maxUpd=0;
          since=+since||0;
          function pageQuery(cursor){
            var base=since>0
              ? [fsMod.where("updated_at",">",since),fsMod.orderBy("updated_at")]
              : [fsMod.orderBy("key")];
            if(cursor) base.push(fsMod.startAfter(cursor));
            base.push(fsMod.limit(PAGE));
            return fsMod.query.apply(null,[colRef].concat(base));
          }
          function retry(fn,attempt){
            return fn().catch(function(err){
              if(attempt>=2) throw err;
              return new Promise(function(res){setTimeout(res,1200);}).then(function(){return retry(fn,attempt+1);});
            });
          }
          function finish(){
            var need=[];
            Object.keys(parts).forEach(function(id){
              var v=parts[id]; if(!v.key) return;
              if(+v.updated_at>maxUpd) maxUpd=+v.updated_at;
              if(Array.isArray(v.parts)) v.parts.forEach(function(p){ if(!parts[p]) need.push(p); });
            });
            /* Eksik parçalar (tam taramada hepsi; artımlıda normalde hiçbiri) kimlikle alınır. */
            var i=0;
            function next(){
              if(i>=need.length) return Promise.resolve();
              var chunk=need.slice(i,i+8); i+=8;
              return Promise.all(chunk.map(function(pid){
                return retry(function(){ return fsMod.getDoc(fsMod.doc(db,"users",uid,"youtube_studies",pid)); },0)
                  .then(function(sn){ if(sn.exists()) parts[pid]=sn.data()||{}; fetched++; });
              })).then(function(){ if(onProgress) try{ onProgress(fetched); }catch(e){} return next(); });
            }
            return next().then(function(){
              var rows=[], skipped=[];
              Object.keys(parts).forEach(function(id){
                var v=parts[id]; if(!v.key) return;
                if(Array.isArray(v.parts)){
                  var ok=true, joined="";
                  for(var j=0;j<v.parts.length;j++){
                    var p=v.parts[j];
                    if(!parts[p]||typeof parts[p].payload!=="string"){ ok=false; break; }
                    joined+=parts[p].payload;
                  }
                  if(!ok){ skipped.push(id); console.warn("[cloud-sync] bozuk YouTube kaydı atlandı (parça eksik): "+id); return; }
                  v.payload=joined;
                }
                if(typeof v.payload==="string") rows.push(v);
              });
              if(skipped.length) rows.__skipped=skipped;
              rows.__maxUpdated=maxUpd;
              rows.__read=fetched;
              return rows;
            });
          }
          function loop(cursor){
            return retry(function(){ return fsMod.getDocs(pageQuery(cursor)); },0).then(function(snap){
              snap.forEach(function(d){ parts[d.id]=d.data()||{}; });
              fetched+=snap.size;
              if(onProgress) try{ onProgress(fetched); }catch(e){}
              if(snap.size<PAGE || snap.empty) return finish();
              return loop(snap.docs[snap.docs.length-1]);
            });
          }
          return loop(null);
        },
        /* Bir kerelik temizlik: birikmiş öksüz parça belgelerini siler
           (eski hatalı davranışın geçmişte biriktirdiği kayıtlar için). */
        cleanupOrphanedYoutubeStudyParts:function(uid,onProgress){
          var colRef=fsMod.collection(db,"users",uid,"youtube_studies");
          var PAGE=50, allDocs={}, scanned=0;
          function fetchPage(cursor){
            var q=cursor
              ? fsMod.query(colRef,fsMod.orderBy(fsMod.documentId()),fsMod.startAfter(cursor),fsMod.limit(PAGE))
              : fsMod.query(colRef,fsMod.orderBy(fsMod.documentId()),fsMod.limit(PAGE));
            return fsMod.getDocs(q);
          }
          function loop(cursor){
            return fetchPage(cursor).then(function(snap){
              snap.forEach(function(d){ allDocs[d.id]=d.data()||{}; });
              scanned+=snap.size;
              if(onProgress) try{ onProgress(scanned,Object.keys(allDocs).length); }catch(e){}
              if(snap.size<PAGE || snap.empty){
                var live={};
                Object.keys(allDocs).forEach(function(id){
                  var v=allDocs[id];
                  if(v.key && Array.isArray(v.parts)) v.parts.forEach(function(p){ live[p]=1; });
                });
                var esik=Date.now()-10*60000;
                var orphans=Object.keys(allDocs).filter(function(id){
                  var v=allDocs[id];
                  /* ana belge değil, hiçbir güncel kayıt referans vermiyor ve 10 dakikadan eski
                     (başka bir cihaz o an yeni parçalarını yazıyor olabilir) */
                  return !v.key && !live[id] && (+v.updated_at||0) < esik;
                });
                var jobs=[];
                for(var i=0;i<orphans.length;i+=400){
                  (function(chunk){
                    jobs.push((async function(){
                      var batch=fsMod.writeBatch(db);
                      chunk.forEach(function(id){ batch.delete(fsMod.doc(db,"users",uid,"youtube_studies",id)); });
                      await batch.commit();
                    })());
                  })(orphans.slice(i,i+400));
                }
                return Promise.all(jobs).then(function(){ return {scanned:scanned,total:Object.keys(allDocs).length,deleted:orphans.length}; });
              }
              return loop(snap.docs[snap.docs.length-1]);
            });
          }
          return loop(null);
        },
        loadSettings:function(uid){
          // Geriye dönük uyumluluk: eski çağıranlar için ikisini birden döndürür.
          return Promise.all([fb.loadMainSettings(uid),fb.loadYoutubeStudiesRaw(uid)]).then(function(a){
            var out=a[0]||{};
            (a[1]||[]).forEach(function(v){out[v.key]=v.payload;});
            return out;
          });
        },
        loadAIExplanations:function(uid){
          return fsMod.getDocs(fsMod.collection(db,"users",uid,"ai_explanations")).then(function(snap){var out=[];snap.forEach(function(d){var v=d.data()||{};if(v.sentence)out.push({sentence:String(v.sentence),explanation:String(v.explanation||""),deleted:!!v.deleted,timestamp:v.timestamp||""});});return out;});
        },
        saveAIExplanations:function(uid,records){
          records=Array.isArray(records)?records:[];if(!records.length)return Promise.resolve([]);
          function docId(sentence){var id=encodeURIComponent(String(sentence||""));if(id.length<=1200)return id;var h=5381,s=String(sentence||""),i=s.length;while(i)h=((h*33)^s.charCodeAt(--i))>>>0;return "long_"+s.length+"_"+h.toString(36);}
          var jobs=[];
          for(var start=0;start<records.length;start+=400){var batch=fsMod.writeBatch(db),part=records.slice(start,start+400);part.forEach(function(x){batch.set(fsMod.doc(db,"users",uid,"ai_explanations",docId(x.sentence)),{sentence:String(x.sentence),explanation:String(x.explanation||""),deleted:!!x.deleted,timestamp:x.timestamp||new Date().toISOString()});});jobs.push(batch.commit());}
          return Promise.all(jobs);
        },
        /* Video silindiğinde buluttaki belgesini (ve varsa bölünmüş
           parçalarını) de kaldırır; aksi halde diğer cihazlar bir
           sonraki senkronda videoyu buluttan geri çeker (diriltir). */
        /* Konuşkan sohbetleri: her sohbet users/{uid}/konuskan_sohbetler altında
           AYRI belge (ana ayar belgesinin ~1MB sınırını doldurmasın). */
        loadKonuskanSohbetler:function(uid){
          return fsMod.getDocs(fsMod.collection(db,"users",uid,"konuskan_sohbetler")).then(function(snap){var out=[];snap.forEach(function(d){var v=d.data()||{};v.id=d.id;out.push(v);});return out;});
        },
        saveKonuskanSohbet:function(uid,id,data){ return fsMod.setDoc(fsMod.doc(db,"users",uid,"konuskan_sohbetler",String(id)),data); },
        deleteKonuskanSohbet:function(uid,id){ return fsMod.deleteDoc(fsMod.doc(db,"users",uid,"konuskan_sohbetler",String(id))); },
        /* Konuşkan not defteri: her not users/{uid}/konuskan_notlar altında ayrı belge */
        loadKoleksiyon:function(uid,ad){ return fsMod.getDocs(fsMod.collection(db,"users",uid,ad)).then(function(snap){var out=[];snap.forEach(function(d){var v=d.data()||{};v.id=d.id;out.push(v);});return out;}); },
        saveKoleksiyon:function(uid,ad,id,data){ return fsMod.setDoc(fsMod.doc(db,"users",uid,ad,String(id)),data); },
        deleteKoleksiyon:function(uid,ad,id){ return fsMod.deleteDoc(fsMod.doc(db,"users",uid,ad,String(id))); },
        /* Koç beyni (dh-koc-beyin.js): users/{uid}/koc/{belge} ve users/{uid}/koc_haftalik/{hafta} */
        loadBelge:function(uid,ad,id){ return fsMod.getDoc(fsMod.doc(db,"users",uid,ad,String(id))).then(function(sn){ return sn.exists()?(sn.data()||{}):null; }); },
        saveBelge:function(uid,ad,id,data,merge){ return fsMod.setDoc(fsMod.doc(db,"users",uid,ad,String(id)),data,merge?{merge:true}:undefined); },
        deleteYoutubeStudy:function(uid,videoId){
          var ref=fsMod.doc(db,"users",uid,"youtube_studies",videoId);
          return fsMod.getDoc(ref).then(function(snap){
            var jobs=[fsMod.deleteDoc(ref).catch(function(){})];
            if(snap.exists()){
              var v=snap.data()||{};
              if(Array.isArray(v.parts)){
                v.parts.forEach(function(pid){ jobs.push(fsMod.deleteDoc(fsMod.doc(db,"users",uid,"youtube_studies",pid)).catch(function(){})); });
              }
            }
            return Promise.all(jobs);
          }).catch(function(){});
        },
        saveSettings:function(uid,data){
          // BÖL: ilerleme (smv:*, wsrs, ayna, günler) → progress/{uid}; kalan ayarlar → settings/{uid}.
          // İki belge = 2×1MB tavan; ayar değişimi koca ilerlemeyi yeniden yazmaz.
          // nokta/özel karakterli anahtarlar Firestore alan adı olamaz → __bulk
          var doc2={}, bulk={}, ytDocs=[];
          if(data&&data.ls){
            for(var k in data.ls){
              if(!data.ls.hasOwnProperty(k) || isSecretKey(k)) continue;
              if(k.indexOf("dh-immersive-youtube-study-")===0){
                var vid=k.slice("dh-immersive-youtube-study-".length);
                if(/^[\w-]{11}$/.test(vid)) ytDocs.push({id:vid,key:k,payload:data.ls[k]});
                continue;
              }
              if(/[.\/~\[\]*]/.test(k)) bulk[k]=data.ls[k];
              else doc2[k]=data.ls[k];
            }
          }
          var isProg=function(k){ return k.indexOf("smv:")===0 || k==="dh-progress-mirror-v1" || k==="dh-study-tracker-v1" || k==="dh-gun-ozet-v1"; };
          var pDoc={}, sDoc={}, pBulk={}, sBulk={};
          for(var dk in doc2){ if(doc2.hasOwnProperty(dk)) (isProg(dk)?pDoc:sDoc)[dk]=doc2[dk]; }
          for(var bk2 in bulk){ if(bulk.hasOwnProperty(bk2)) (isProg(bk2)?pBulk:sBulk)[bk2]=bulk[bk2]; }
          if(Object.keys(sBulk).length) sDoc.__bulk=sBulk;
          if(Object.keys(pBulk).length) pDoc.__bulk=pBulk;
          if(data&&data.errors) sDoc.__errors=data.errors;

          /* BOŞ BELGE YAZMA. Fark yazmayla birlikte çoğu push'ta iki
             belgeden yalnızca biri değişiyor; ötekine sadece updated_at
             yazmak bedava değil — Firestore'da o da bir mutation ve
             kuyruğu doldurur. Alanı olmayan belge hiç gönderilmez. */
          var sVar = Object.keys(sDoc).length > 0;
          var pVar = Object.keys(pDoc).length > 0;
          if(!sVar && !pVar && !ytDocs.length) return Promise.resolve([]);

          var now2=Date.now();
          var isler=[];
          if(sVar){ sDoc.updated_at=now2;
            isler.push(fsMod.setDoc(fsMod.doc(db,"settings",uid), sDoc, { merge:true })); }
          if(pVar){ pDoc.updated_at=now2;
            isler.push(fsMod.setDoc(fsMod.doc(db,"progress",uid), pDoc, { merge:true })); }
          function silinecekEkle(l){ if(!l||!l.length) return; try{ var s=JSON.parse(localStorage.getItem(YT_SIL_KEY)||"[]")||[]; l.forEach(function(x){ if(s.indexOf(x)<0) s.push(x); }); localStorage.setItem(YT_SIL_KEY, JSON.stringify(s.slice(-2000))); }catch(e){} }
          function silindi(id){ try{ var s=JSON.parse(localStorage.getItem(YT_SIL_KEY)||"[]")||[], i=s.indexOf(id); if(i>=0){ s.splice(i,1); localStorage.setItem(YT_SIL_KEY, JSON.stringify(s)); } }catch(e){} }
          function parcaSil(pid){ return fsMod.deleteDoc(fsMod.doc(db,"users",uid,"youtube_studies",pid)).then(function(){ silindi(pid); }).catch(function(){}); }
          /* önceki açılışta yarım kalan silmeler (okuma gerektirmez) */
          try{ var bekleyenSil=JSON.parse(localStorage.getItem(YT_SIL_KEY)||"[]")||[]; if(bekleyenSil.length) isler.push(Promise.all(bekleyenSil.slice(0,200).map(parcaSil))); }catch(e){}
          ytDocs.forEach(function(v){
            isler.push((async function(){
              /* Yeni revizyon yazmadan önce eski belgeyi oku; eğer eski
                 kayıt bölünmüş parçalıysa (parts) ve bu sefer farklı bir
                 revizyon üretilecekse, eski parçaları sil — aksi halde
                 her büyük kayıt her kaydedilişinde öksüz parça biriktirir. */
              var ref=fsMod.doc(db,"users",uid,"youtube_studies",v.id);
              var oldParts=null;
              try{ var oldSnap=await fsMod.getDoc(ref); if(oldSnap.exists()){ var od=oldSnap.data()||{}; if(Array.isArray(od.parts)) oldParts=od.parts; } }catch(e){}
              if(v.payload.length<=150000){
                await fsMod.setDoc(ref,{key:v.key,payload:v.payload,updated_at:now2});
                /* Eski parçaların silinmesi BEKLENİR: eskiden Promise.all başladıktan
                   sonra kuyruğa ekleniyordu; sayfa kapanınca silme gitmiyor, bulutta
                   binlerce öksüz parça birikiyordu. */
                if(oldParts){ silinecekEkle(oldParts); await Promise.all(oldParts.map(parcaSil)); }
                if(data.onYt) data.onYt(v.key);
                return;
              }
              var ids=[],revision=now2.toString(36)+Math.random().toString(36).slice(2,9);
              for(var offset=0;offset<v.payload.length;){var end=Math.min(offset+150000,v.payload.length);if(end<v.payload.length&&/[\uD800-\uDBFF]/.test(v.payload.charAt(end-1)))end--;var partId=v.id+"_"+revision+"_"+ids.length;ids.push(partId);await fsMod.setDoc(fsMod.doc(db,"users",uid,"youtube_studies",partId),{payload:v.payload.slice(offset,end),updated_at:now2});offset=end}
              await fsMod.setDoc(ref,{key:v.key,parts:ids,updated_at:now2});
              if(data.onYt) data.onYt(v.key);
              if(oldParts){ var eskiler=oldParts.filter(function(pid){return ids.indexOf(pid)<0}); silinecekEkle(eskiler); await Promise.all(eskiler.map(parcaSil)); }
            })());
          });
          return Promise.all(isler);
        }
      };
      ready=true;
      fb.onAuth(function(u){
        user=u?{uid:u.uid}:null;
        /* Bu tarayıcıdaki yerel verinin sahibi (hesap-yedek.js). Sahip yoksa giren kişi sahiplenir.
           Sahip başka biriyse HİÇBİR ŞEY eşitlenmez: veri karışmasın diye giriş sayfasına gidilir,
           orada önceki hesabın verisi kenara kaldırılır. */
        if(user){
          var sahip=""; try{ sahip=localStorage.getItem("dh-yerel-sahip")||""; }catch(e){}
          if(!sahip){ try{ localStorage.setItem("dh-yerel-sahip",user.uid); if(u.email) localStorage.setItem("dh-yerel-sahip-eposta",u.email); }catch(e){} }
          else if(sahip!==user.uid){
            user=null; authResolved=true; updateBadge();
            if(!/login\.html$/i.test(location.pathname)){ try{ location.replace("./login.html?next="+encodeURIComponent((location.pathname.split("/").pop()||"index.html")+location.hash)); }catch(e){} }
            return;
          }
        }
        authResolved=true;
        updateBadge();
        if(user){
          initialSync();
          /* Açıklamalar Firebase kimliği çözülmeden önce içe aktarılmışsa
             olay kaybolmaz; oturum hazır olur olmaz yalnız değişen AI
             kayıtları buluta gönderilir. */
          if(aiSyncDirty) setTimeout(function(){ pushNow(); },800);
        }
      });
    }).catch(function(e){ console.warn("cloud-sync: firebase yüklenemedi", e); });
  }

  /* ── 10b) ŞİFRELİ API ANAHTAR KASASI ─────────────────────────
     Anahtarlar düz metin olarak ASLA buluta gitmez. Kullanıcı bir parola
     belirlerse anahtarlar bu parolayla (PBKDF2 → AES-256-GCM) cihazda
     şifrelenir ve yalnız şifreli kutu settings/{uid}.__keyVault alanına
     yazılır. Parolanın kendisi saklanmaz; cihazda yalnız dışarı
     aktarılamayan PBKDF2 anahtarı (menüdeki şifreli yedekle ORTAK) durur. */
  var VAULT_NAMES=["nvidiaApiKeys","groqApiKeys","cerebrasApiKeys","geminiApiKeys","mistralApiKeys","openrouterApiKeys","youtubeApiKeys","apiKeys"];
  var VAULT_SIG="dh-keyvault-sig", VAULT_AT="dh-keyvault-at", VAULT_ON="dh-keyvault-on";
  function vaultOn(){try{return localStorage.getItem(VAULT_ON)==="1";}catch(e){return false;}}
  function vB64(b){var s="";for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s);}
  function vBytes(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
  function vaultDB(){return new Promise(function(res,rej){var r=indexedDB.open("DilHaritaSecureVault",1);r.onupgradeneeded=function(){if(!r.result.objectStoreNames.contains("keys"))r.result.createObjectStore("keys");};r.onsuccess=function(){res(r.result);};r.onerror=function(){rej(r.error);};});}
  async function vaultKeyLoad(){try{var db=await vaultDB();return await new Promise(function(res){var q=db.transaction("keys","readonly").objectStore("keys").get("backup-pbkdf2");q.onsuccess=function(){res(q.result||null);};q.onerror=function(){res(null);};});}catch(e){return null;}}
  async function vaultKeySave(k){var db=await vaultDB();return new Promise(function(res,rej){var tx=db.transaction("keys","readwrite");tx.objectStore("keys").put(k,"backup-pbkdf2");tx.oncomplete=function(){res(true);};tx.onerror=function(){rej(tx.error);};});}
  async function vaultKeyForget(){try{var db=await vaultDB();return await new Promise(function(res){var tx=db.transaction("keys","readwrite");tx.objectStore("keys").delete("backup-pbkdf2");tx.oncomplete=function(){res(true);};tx.onerror=function(){res(false);};});}catch(e){return false;}}
  function vaultBase(pw){return crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveKey"]);}
  function vaultDerive(base,salt,iter){return crypto.subtle.deriveKey({name:"PBKDF2",salt:salt,iterations:iter,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);}
  async function vaultEncrypt(obj,base){
    var salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iter=250000;
    var k=await vaultDerive(base,salt,iter);
    var c=await crypto.subtle.encrypt({name:"AES-GCM",iv:iv},k,new TextEncoder().encode(JSON.stringify(obj)));
    return {version:1,algorithm:"AES-256-GCM",kdf:"PBKDF2-SHA256",iterations:iter,salt:vB64(salt),iv:vB64(iv),data:vB64(new Uint8Array(c))};
  }
  async function vaultDecrypt(box,base){
    var k=await vaultDerive(base,vBytes(box.salt),Number(box.iterations)||250000);
    var p=await crypto.subtle.decrypt({name:"AES-GCM",iv:vBytes(box.iv)},k,vBytes(box.data));
    return JSON.parse(new TextDecoder().decode(p));
  }
  function vaultRead(){var o={};VAULT_NAMES.forEach(function(n){try{var v=localStorage.getItem(n);if(v!=null&&v!==""&&v!=="[]")o[n]=v;}catch(e){}});return o;}
  function vaultSigOf(o){var a=[];VAULT_NAMES.forEach(function(n){a.push(n+"="+(o[n]==null?"":o[n]));});return sigOf(a.join("\n"));}
  function vaultApply(o){VAULT_NAMES.forEach(function(n){try{if(o[n]!=null)localStorage.setItem(n,String(o[n]));else localStorage.removeItem(n);}catch(e){}});
    try{window.dispatchEvent(new CustomEvent("dh-api-keys-changed"));}catch(e){}}
  function vaultMerge(local,remote){
    var out={};
    VAULT_NAMES.forEach(function(n){
      var a=local[n],b=remote[n];
      if(a==null){ if(b!=null) out[n]=b; return; }
      if(b==null||a===b){ out[n]=a; return; }
      try{
        var x=JSON.parse(a),y=JSON.parse(b);
        if(Array.isArray(x)&&Array.isArray(y)){
          var seen={},list=[];
          x.concat(y).forEach(function(it){var id=typeof it==="string"?it:JSON.stringify(it);if(!seen[id]){seen[id]=1;list.push(it);}});
          out[n]=JSON.stringify(list); return;
        }
      }catch(e){}
      out[n]=a;
    });
    return out;
  }
  function vaultCount(o){var n=0;VAULT_NAMES.forEach(function(k){if(o[k]==null)return;try{var v=JSON.parse(o[k]);n+=Array.isArray(v)?v.length:1;}catch(e){n+=1;}});return n;}
  function vaultAiMode(){try{return (JSON.parse(localStorage.getItem("dh-profile-v1")||"{}")||{}).aiYontemi||"";}catch(e){return "";}}
  function vaultUseApi(){try{var p=JSON.parse(localStorage.getItem("dh-profile-v1")||"{}")||{};p.aiYontemi="api";p.aiYontemiTarih=Date.now();localStorage.setItem("dh-profile-v1",JSON.stringify(p));window.dispatchEvent(new CustomEvent("dh-profile-changed",{detail:{aiYontemi:"api"}}));}catch(e){}}
  var vaultState={problem:""};
  function vaultEvent(){try{window.dispatchEvent(new CustomEvent("dh-keyvault-state",{detail:{problem:vaultState.problem}}));}catch(e){}}
  /* remoteVault: fullSync'in zaten okuduğu değer (undefined → gerekirse kendisi okur). */
  async function vaultSync(remoteVault){
    if(!ready||!user||!fb||!(window.crypto&&crypto.subtle)) return;
    var base=vaultOn()?await vaultKeyLoad():null;
    if(!base){
      var lc=vaultCount(vaultRead());
      vaultState.problem=(remoteVault&&!lc)?"parola-gerek":"";
      if(remoteVault!==undefined) vaultEvent();
      return;
    }
    var local=vaultRead(), sig=vaultSigOf(local), lastSig="", lastAt=0;
    try{lastSig=localStorage.getItem(VAULT_SIG)||"";lastAt=+localStorage.getItem(VAULT_AT)||0;}catch(e){}
    var localChanged=(sig!==lastSig);
    if(remoteVault===undefined){
      if(!localChanged) return;
      remoteVault=await fb.loadKeyVault(user.uid);
    }
    if(remoteVault&&remoteVault.box&&(+remoteVault.at||0)>lastAt){
      var rem;
      try{ rem=await vaultDecrypt(remoteVault.box,base); }
      catch(e){ vaultState.problem="parola-farkli"; vaultEvent(); return; }
      var next=localChanged?vaultMerge(local,rem):rem;
      vaultApply(next);
      var nsig=vaultSigOf(next);
      try{localStorage.setItem(VAULT_AT,String(+remoteVault.at||0));}catch(e){}
      if(nsig===vaultSigOf(rem)){
        try{localStorage.setItem(VAULT_SIG,nsig);}catch(e){}
        vaultState.problem=""; vaultEvent(); return;
      }
      local=next; sig=nsig; localChanged=true;
    }
    if(!localChanged&&remoteVault){ vaultState.problem=""; return; }
    var at=Date.now();
    await fb.saveKeyVault(user.uid,{at:at,box:await vaultEncrypt(local,base)});
    try{localStorage.setItem(VAULT_AT,String(at));localStorage.setItem(VAULT_SIG,sig);}catch(e){}
    vaultState.problem=""; vaultEvent();
  }
  var keyVault={
    status:async function(){
      await waitForAuth(4000);
      var base=vaultOn()?await vaultKeyLoad():null, remote=null, err="";
      if(ready&&user&&fb){ try{ remote=await withTimeout(fb.loadKeyVault(user.uid),15000,"okunamadı"); }catch(e){ err=(e&&e.message)||"okunamadı"; } }
      return {signedIn:!!user, enabled:!!base, remote:!!(remote&&remote.box), remoteAt:remote&&remote.at||0,
              localCount:vaultCount(vaultRead()), problem:vaultState.problem, error:err, aiMode:vaultAiMode()};
    },
    enable:async function(password){
      if(!(window.crypto&&crypto.subtle)) return {ok:false,message:"Bu tarayıcı şifrelemeyi desteklemiyor."};
      await waitForAuth(4000);
      if(!ready||!user||!fb) return {ok:false,message:"Önce buluta giriş yapmalısın."};
      password=String(password||"");
      if(password.length<8) return {ok:false,message:"Parola en az 8 karakter olmalı."};
      var base=await vaultBase(password), remote=await withTimeout(fb.loadKeyVault(user.uid),15000,"Bulut okunamadı");
      var local=vaultRead(), rem=null;
      if(remote&&remote.box){
        try{ rem=await vaultDecrypt(remote.box,base); }
        catch(e){ return {ok:false,message:"Parola yanlış. Bulutta bu hesap için başka bir parolayla kaydedilmiş anahtarlar var; o parolayı yaz."}; }
      }else if(!vaultCount(local)){
        return {ok:false,message:"Bu cihazda kayıtlı API anahtarı yok. Önce anahtarlarının olduğu cihazda bu ayarı aç."};
      }
      var merged=rem?vaultMerge(local,rem):local;
      if(rem) vaultApply(merged);
      await vaultKeySave(base);
      try{localStorage.setItem(VAULT_ON,"1");}catch(e){}
      var sig=vaultSigOf(merged);
      if(rem&&sig===vaultSigOf(rem)){
        try{localStorage.setItem(VAULT_AT,String(+remote.at||0));localStorage.setItem(VAULT_SIG,sig);}catch(e){}
      }else{
        var at=Date.now();
        await fb.saveKeyVault(user.uid,{at:at,box:await vaultEncrypt(merged,base)});
        try{localStorage.setItem(VAULT_AT,String(at));localStorage.setItem(VAULT_SIG,sig);}catch(e){}
      }
      /* Anahtarlar buluttan geldiyse yapay zekâ tercihini "anahtarla" yap:
         anahtarsızken seçilen "Gemini sitesi" tercihi yoksa yönlendirmeye devam eder. */
      if(rem&&vaultCount(merged)) vaultUseApi();
      vaultState.problem=""; vaultEvent();
      return {ok:true,count:vaultCount(merged),fromCloud:!!rem};
    },
    useApi:function(){ vaultUseApi(); return {ok:true}; },
    disable:async function(removeFromCloud){
      try{localStorage.removeItem(VAULT_ON);localStorage.removeItem(VAULT_SIG);localStorage.removeItem(VAULT_AT);}catch(e){}
      if(removeFromCloud){
        await waitForAuth(4000);
        if(ready&&user&&fb) await fb.deleteKeyVault(user.uid);
      }
      vaultState.problem=""; vaultEvent();
      return {ok:true};
    }
  };

  /* ── 11) TETİKLEYİCİLER ──────────────────────────────────── */
  function initialSync(){
    waitForAuth(5000).then(function(){
      if(!ready||!user||!fb) return;
      // KISIT: son tam senkron 5 dk içindeyse sayfa gezinmelerinde tekrar etme
      try{
        var gecis=!!localStorage.getItem("dh-account-migration-pending");
        if(!gecis && Date.now()-(+localStorage.getItem("dh-last-sync-ts")||0) < 300000) return;
      }catch(e){}
      fullSync().then(function(res){
        try{ if(window.__dhAutoSyncDone) window.__dhAutoSyncDone(res); }catch(e){}
      }).catch(function(){});
    });
  }
  async function signOutAndPush(){
    await waitForAuth(3000);
    if(ready&&user&&fb){ try{ await pushNow(true); }catch(e){} }
    await new Promise(function(r){ setTimeout(r,400); });
    try{ if(fb&&fb.signOut) await fb.signOut(); }catch(e){}
    try{
      localStorage.removeItem("dh_logged_in");
      localStorage.removeItem("dh_logged_uid");
      localStorage.removeItem("dh_logged_email");
    }catch(e){}
    try{ sessionStorage.removeItem("dh_session_ok"); document.cookie="dh_auth=; path="+location.pathname.replace(/[^/]*$/,"")+"; max-age=0"; }catch(e){}
    return { ok:true };
  }
  function hookLocalStorage(){
    try{
      var proto=window.localStorage;
      var origSet=proto.setItem.bind(proto);
      proto.setItem=function(k,v){
        origSet(k,v);
        var key=String(k);
        var match=(LS_KEYS.indexOf(key)>=0)||(VAULT_NAMES.indexOf(key)>=0);
        if(!match){ for(var p=0;p<LS_PREFIXES.length;p++){ if(key.indexOf(LS_PREFIXES[p])===0){ match=true; break; } } }
        if(match) pushSoon();
      };
    }catch(e){}
  }
  /* Sayfadan ayrılırken son bir yazma.
     pagehide VE visibilitychange'in ikisi de bu fonksiyonu çağırıyor;
     tek bir sayfa geçişinde ikisi birden tetiklenip iki yazma
     başlatıyordu. 3 saniyelik pencerede yalnızca biri geçer.
     autoPush kapalı olsa bile burası çalışır: ayrılırken veri kaybını
     önlemek, gürültüyü azaltmaktan önemlidir. */
  function flushOnLeave(){
    var now=Date.now();
    if(now-__sonFlush < 3000) return;
    __sonFlush=now;
    try{ clearTimeout(saveTimer); }catch(e){}
    pushNow();
  }

  /* ── 11b) DURUM ROZETİ: sağ-alt "☁ HH:MM" — tıkla = senkron ── */
  function updateBadge(ok){
    try{
      var b=document.getElementById("dhSyncBadge");
      if(!b){
        b=document.createElement("button");
        b.id="dhSyncBadge"; b.type="button";
        /* Ana alt menünün altında kalıp tıklanamaz olmasın: menünün üstüne
           ve ondan daha yüksek katmana yerleştir. */
        b.style.cssText="position:fixed;left:10px;bottom:calc(82px + env(safe-area-inset-bottom));z-index:90002;background:rgba(13,26,48,.96);color:#9fb3d9;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 12px;font:800 11px system-ui;cursor:pointer;opacity:.96;box-shadow:0 7px 22px rgba(0,0,0,.35)";
        b.title="Son senkron — tıkla: şimdi senkronla";
        b.onclick=function(){
          b.textContent="☁ …";
          fullSync().then(function(r){ if(!r.ok){ b.textContent="☁ ⚠"; b.style.color="#f87171"; } });
        };
        var mount=function(){ try{ document.body.appendChild(b); }catch(e){} };
        if(document.body) mount(); else document.addEventListener("DOMContentLoaded",mount);
      }
      var ts=+localStorage.getItem("dh-last-sync-ts")||0;
      if(authResolved && !user){
        b.textContent="Bu cihazda";
        b.title="İlerlemen bu cihazda korunuyor · hesapla eşitlemek için dokun";
        b.onclick=function(){ location.href="./login.html?next="+encodeURIComponent(location.pathname.split("/").pop()||"index.html"); };
        b.style.color="#9fb3d9";
        return;
      }
      var hhmm=ts?new Date(ts).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"}):"—";
      b.title="Son senkron · şimdi senkronlamak için dokun";
      b.onclick=function(){
        b.textContent="☁ …";
        fullSync().then(function(r){ if(!r.ok){ b.textContent="☁ ⚠"; b.style.color="#f87171"; } });
      };
      b.textContent="☁ "+hhmm;
      b.style.color=(ok===false)?"#f87171":"#9fb3d9";
    }catch(e){}
  }

  /* ── 11c) GÜNLÜK ANLIK GÖRÜNTÜ: "dünü geri al" güvenlik ağı ──
     ------------------------------------------------------------------
     ÇÖZÜLEN SORUN
       Yedekler localStorage'da tutuluyordu ve her biri aynanın + tracker'ın
       + TÜM kv deposunun kopyasıydı. Ölçüldü: üç günlük yedek 1.391 KB
       (534 + 313 + 544), toplam localStorage 2.473 KB. Tarayıcı tavanı
       ~5 MB ve o tavana çarpıldığında setItem SESSİZCE başarısız olur —
       yani ilerleme kaydedilmez, kullanıcı hiçbir uyarı görmez.
       Güvenlik ağı olarak eklenen şey, korumaya çalıştığı veriyi riske
       atıyordu.

     ÇÖZÜM
       Yedekler IndexedDB'ye taşındı (dh-snap veritabanı). Orada pratikte
       boyut sorunu yok. localStorage'daki eski yedekler açılışta bir kez
       taşınıp siliniyor. Saklama 3 günden 2 güne indirildi; "dünü geri al"
       için iki gün fazlasıyla yeter.                                    */
  var SNAP_DB="dh-snap", SNAP_STORE="gunler", snapDbP=null;

  function snapOpen(){
    if(snapDbP) return snapDbP;
    snapDbP=new Promise(function(res){
      try{
        if(!window.indexedDB) return res(null);
        var r=window.indexedDB.open(SNAP_DB,1);
        r.onupgradeneeded=function(){
          var db=r.result;
          if(!db.objectStoreNames.contains(SNAP_STORE))
            db.createObjectStore(SNAP_STORE,{keyPath:"gun"});
        };
        r.onsuccess=function(){ res(r.result); };
        r.onerror=function(){ res(null); };
      }catch(e){ res(null); }
    });
    return snapDbP;
  }
  function snapPut(gun,str){
    return snapOpen().then(function(db){
      if(!db) return false;
      return new Promise(function(res){
        try{
          var t=db.transaction(SNAP_STORE,"readwrite");
          t.objectStore(SNAP_STORE).put({gun:gun, at:Date.now(), veri:str});
          t.oncomplete=function(){ res(true); };
          t.onerror=function(){ res(false); };
        }catch(e){ res(false); }
      });
    });
  }
  function snapGet(gun){
    return snapOpen().then(function(db){
      if(!db) return null;
      return new Promise(function(res){
        try{
          var q=db.transaction(SNAP_STORE,"readonly").objectStore(SNAP_STORE).get(gun);
          q.onsuccess=function(){ res(q.result?q.result.veri:null); };
          q.onerror=function(){ res(null); };
        }catch(e){ res(null); }
      });
    });
  }
  function snapKeys(){
    return snapOpen().then(function(db){
      if(!db) return [];
      return new Promise(function(res){
        try{
          var q=db.transaction(SNAP_STORE,"readonly").objectStore(SNAP_STORE).getAllKeys();
          q.onsuccess=function(){ res((q.result||[]).map(String).sort()); };
          q.onerror=function(){ res([]); };
        }catch(e){ res([]); }
      });
    });
  }
  function snapDel(gun){
    return snapOpen().then(function(db){
      if(!db) return;
      try{ db.transaction(SNAP_STORE,"readwrite").objectStore(SNAP_STORE).delete(gun); }catch(e){}
    });
  }

  /* localStorage'da kalmış eski yedekleri IndexedDB'ye taşı ve yeri boşalt.
     Bir kez çalışır; taşıma başarısız olsa bile localStorage temizlenir,
     çünkü asıl risk yerin dolu olması. */
  async function snapTasi(){
    var eskiler=[];
    try{
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(k && k.indexOf("dh-snap-")===0) eskiler.push(k);
      }
    }catch(e){ return; }
    if(!eskiler.length) return;
    eskiler.sort();
    /* yalnızca en yeni 2 tanesi taşınır, gerisi doğrudan silinir */
    var tasinacak=eskiler.slice(-2);
    for(var j=0;j<tasinacak.length;j++){
      try{
        var v=localStorage.getItem(tasinacak[j]);
        if(v) await snapPut(tasinacak[j].slice(8), v);
      }catch(e){}
    }
    var kb=0;
    for(var m=0;m<eskiler.length;m++){
      try{ kb+=(localStorage.getItem(eskiler[m])||"").length; localStorage.removeItem(eskiler[m]); }catch(e){}
    }
    if(kb) console.log("[cloud-sync] günlük yedekler IndexedDB'ye taşındı, localStorage'da "
                       + Math.round(kb/1024) + " KB yer açıldı");
  }

  async function takeSnapshot(){
    try{
      await snapTasi();
      var day=new Date().toISOString().slice(0,10);
      var varMi=await snapGet(day);
      if(varMi) return;
      var snap={ m:localStorage.getItem(MIRROR)||"", t:localStorage.getItem(TRACKER)||"", kv:await kvReadAll() };
      var str=JSON.stringify(snap);
      await snapPut(day, str);
      /* en fazla 2 gün tut */
      var hepsi=await snapKeys();
      while(hepsi.length>2){ await snapDel(hepsi.shift()); }
    }catch(e){}
  }
  function snapList(){ return snapKeys(); }
  async function restoreSnap(day){
    try{
      var raw=await snapGet(day);
      if(!raw){ /* eski kurulumlardan kalma localStorage yedeği olabilir */
        try{ raw=localStorage.getItem("dh-snap-"+day); }catch(e){}
      }
      if(!raw) return {ok:false,message:"Anlık görüntü yok"};
      var s2=JSON.parse(raw);
      if(s2.m) localStorage.setItem(MIRROR,s2.m);
      if(s2.t) localStorage.setItem(TRACKER,s2.t);
      if(s2.kv) await kvWriteAll(s2.kv);
      await applyMirror();
      await pushNow(true);
      return {ok:true,message:"✓ "+day+" durumuna dönüldü ve buluta yazıldı."};
    }catch(e){ return {ok:false,message:"Geri dönüş hatası: "+(e&&e.message||"?")}; }
  }

  /* ── 12) BAŞLAT + DIŞ API ────────────────────────────────── */
  hookLocalStorage();
  window.addEventListener("learning-errors-cleared", pushSoon);
  window.addEventListener("learning-errors-deleted", pushSoon);
  /* index-app toplu içe aktarmada peş peşe 25 kayıt yazar. Olaylar tek
     debounce içinde birleşir; kullanıcı ekrandan ayrılırsa pagehide'daki
     zorunlu push kalan paketi de gönderir. */
  window.addEventListener("dh-ai-explanation-changed", function(){ aiSyncDirty=true; pushSoon(); });
  window.addEventListener("pagehide", flushOnLeave);
  document.addEventListener("visibilitychange", function(){ if(document.visibilityState==="hidden") flushOnLeave(); });
  initFirebase();
  setTimeout(function(){ takeSnapshot(); }, 4000);
  if(document.readyState!=="loading") updateBadge(); else document.addEventListener("DOMContentLoaded",function(){ updateBadge(); });

  /* hesap değişiminden sonra bir kez bilgi ver (login.html → hesap-yedek.js) */
  (function(){ try{ var h=JSON.parse(sessionStorage.getItem("dh-hesap-degisti")||"null"); if(!h) return; sessionStorage.removeItem("dh-hesap-degisti");
    var goster=function(){ var d=document.createElement("div"); d.setAttribute("role","status");
      d.style.cssText="position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483000;max-width:min(92vw,520px);padding:12px 16px;border-radius:12px;background:#10233a;color:#e5f3ff;border:1px solid #38bdf8;box-shadow:0 8px 28px #0008;font:600 13px/1.4 system-ui,sans-serif;cursor:pointer";
      d.textContent=h.geriYuklendi?"Hesap değişti: önceki kullanıcının verileri bu cihazda kenara kaldırıldı, senin verilerin geri yüklendi.":"Hesap değişti: önceki kullanıcının verileri bu cihazda kenara kaldırıldı; verilerin buluttan yükleniyor.";
      d.onclick=function(){d.remove();}; document.body.appendChild(d); setTimeout(function(){ try{d.remove();}catch(e){} },9000); };
    if(document.body) goster(); else document.addEventListener("DOMContentLoaded",goster);
  }catch(e){} })();
  window.DHCloudSync = {
    push: pushNow, sync: initialSync, pull: fullSync, fullSync: fullSync,
    /* Otomatik tetikleyiciler. false yapılırsa yalnızca elle çağrılan
       push/fullSync ve sayfadan ayrılırken yapılan son yazma çalışır. */
    autoPush: true,
    /* Fark yazma imzalarını sıfırla → bir sonraki push tam gönderim olur.
       (Bulutta veri kaybı şüphesi varsa elle çalıştırılır.) */
    resetDiff: sigSifirla,
    signOut: signOutAndPush,
    /* Geçmişte biriken öksüz YouTube parça belgelerini bir kez temizler
       (bkz. saveSettings — artık her kayıtta eski parçaları kendisi siler,
       ama bu, o düzeltmeden ÖNCE birikmiş kayıtları temizlemez). */
    cleanupYoutubeOrphans: function(onProgress){
      if(!ready||!user||!fb||!fb.cleanupOrphanedYoutubeStudyParts) return Promise.resolve({ok:false,error:"hazır değil"});
      return fb.cleanupOrphanedYoutubeStudyParts(user.uid,onProgress).then(function(r){return Object.assign({ok:true},r)}).catch(function(e){return {ok:false,error:(e&&e.message)||"bilinmeyen hata"}});
    },
    /* Konuşkan sohbetleri (ayrı belgeler). Oturum yoksa {ok:false} döner; çağıran yerelde tutar. */
    sohbet: {
      hazir: function(){ return !!(ready&&user&&fb&&fb.saveKonuskanSohbet); },
      getir: function(){ if(!(ready&&user&&fb&&fb.loadKonuskanSohbetler)) return Promise.resolve(null); return fb.loadKonuskanSohbetler(user.uid); },
      kaydet: function(id,data){ if(!(ready&&user&&fb&&fb.saveKonuskanSohbet)) return Promise.resolve(false); return fb.saveKonuskanSohbet(user.uid,id,data).then(function(){return true;}); },
      sil: function(id){ if(!(ready&&user&&fb&&fb.deleteKonuskanSohbet)) return Promise.resolve(false); return fb.deleteKonuskanSohbet(user.uid,id).then(function(){return true;}); }
    },
    notlar: {
      hazir: function(){ return !!(ready&&user&&fb&&fb.saveKoleksiyon); },
      getir: function(){ if(!(ready&&user&&fb&&fb.loadKoleksiyon)) return Promise.resolve(null); return fb.loadKoleksiyon(user.uid,"konuskan_notlar"); },
      kaydet: function(id,data){ if(!(ready&&user&&fb&&fb.saveKoleksiyon)) return Promise.resolve(false); return fb.saveKoleksiyon(user.uid,"konuskan_notlar",id,data).then(function(){return true;}); },
      sil: function(id){ if(!(ready&&user&&fb&&fb.deleteKoleksiyon)) return Promise.resolve(false); return fb.deleteKoleksiyon(user.uid,"konuskan_notlar",id).then(function(){return true;}); }
    },
    /* Koç beyni ve cümle bankası belgeleri. Yalnız bu koleksiyonlar (yanlışlıkla başka yere yazılmasın). */
    koc: {
      hazir: function(){ return !!(ready&&user&&fb&&fb.saveBelge); },
      uid: function(){ return user?user.uid:null; },
      oku: function(ad,id){ if(!(ready&&user&&fb&&fb.loadBelge)||["koc","koc_haftalik","cumle_bankasi"].indexOf(ad)<0) return Promise.resolve(undefined); return fb.loadBelge(user.uid,ad,id); },
      yaz: function(ad,id,data,merge){ if(!(ready&&user&&fb&&fb.saveBelge)||["koc","koc_haftalik","cumle_bankasi"].indexOf(ad)<0) return Promise.resolve(false); return fb.saveBelge(user.uid,ad,id,data,merge).then(function(){return true;}); }
    },
    snapList: snapList, restoreSnap: restoreSnap,
    /* Yedekleme ekranı kendi kopya listesini tutmasın diye TEK KAYNAK burada.
       (Eskiden index sayfası listeyi elle kopyalıyordu ve yeni anahtarlar
        eklendiğinde yedeğe girmiyordu.) */
    keys: function(){ return { list: LS_KEYS.slice(), prefixes: LS_PREFIXES.slice() }; },
    keyVault: keyVault,
    _mergeProfile: mergeProfile,
    _mergeKonuskan: mergeKonuskan,
    get ready(){ return ready; }, get user(){ return user; }
  };
})();
