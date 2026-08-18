/* cloud-sync.js — v7 (SIFIRDAN TEMİZ TASARIM)
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
    "dh_ai_prompt_teacher", "dh-study-tracker-v1", "dh-ocr-sentences-v1", "dh-profile-v1",
    "dh-teacher-policy-v1", "dh-notif-settings-v1", "dh-progress-mirror-v1",
    "dh-model-groq", "dh-model-cerebras", "dh-model-gemini",
    "selectedTeacherAvatar", "dh-teacher-mem", "dh-activity-log-v1",
    "dh-gemini-report-v1"
  ];
  /* "dh-koc-" → günlük koç planı, tamamlanan adımlar, gün epoch'u ve hedef.
     Bunlar cihaza özeldi; telefonda yapılan çalışma bilgisayarda görünmüyordu.
     Artık senkrona dahil (birleştirme kuralları için mergeKoc'a bak). */
  var LS_PREFIXES = ["sm:", "mas:", "ev:", "modscore:", "gramprof:", "story:", "dh-koc-",
                      "dh-modul-", "dh-gemini-gunluk-", "dh-speaking-complete-"];   /* karne, Gemini ve konuşma tamamlanması cihazlar arasi */
  var MAX_VAL = 200000;      // alan başına üst sınır (Firestore alan limiti 1MB)
  var TRACKER = "dh-study-tracker-v1";
  var MIRROR  = "dh-progress-mirror-v1";
  var ACTLOG  = "dh-activity-log-v1";
  /* API anahtarlari cihaz sirridir. Yerelde kalir; Firestore'a asla
     gonderilmez ve eski surumlerin yukledigi kopyalar ilk senkronda silinir. */
  var SECRET_KEYS = ["groqApiKeys", "cerebrasApiKeys", "geminiApiKeys", "dh-disabled-keys", "apiKeys"];
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
  function mergeModulMezar(localStr, remoteStr){
    var L={},R={},out={},k;
    try{ L=JSON.parse(localStr||"{}")||{}; }catch(e){}
    try{ R=JSON.parse(remoteStr||"{}")||{}; }catch(e){}
    for(k in R){ if(R.hasOwnProperty(k)) out[k]=+R[k]||0; }
    for(k in L){ if(L.hasOwnProperty(k) && (+L[k]||0)>(+out[k]||0)) out[k]=+L[k]||0; }
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
  function mirrorNow(){ try{ if(window.DHProgress&&DHProgress.mirrorNow) return Promise.resolve(DHProgress.mirrorNow()).catch(function(){}); }catch(e){} return Promise.resolve(); }
  function applyMirror(){ try{ if(window.DHProgress&&DHProgress.applyMirror) return Promise.resolve(DHProgress.applyMirror()).catch(function(){return 0;}); }catch(e){} return Promise.resolve(0); }
  function errAll(){ try{ if(window.LearningErrorDB&&LearningErrorDB.all) return LearningErrorDB.all(); }catch(e){} return Promise.resolve([]); }
  function errMerge(list){ try{ if(window.LearningErrorDB&&LearningErrorDB.bulkMerge&&Array.isArray(list)) return LearningErrorDB.bulkMerge(list); }catch(e){} return Promise.resolve(0); }

  function lsCollect(){
    var out={};
    for(var i=0;i<LS_KEYS.length;i++){
      try{ var v=localStorage.getItem(LS_KEYS[i]); if(v!=null&&v.length<=MAX_VAL) out[LS_KEYS[i]]=v; }catch(e){}
    }
    try{
      for(var j=0;j<localStorage.length;j++){
        var key=localStorage.key(j); if(!key) continue;
        for(var p=0;p<LS_PREFIXES.length;p++){
          if(key.indexOf(LS_PREFIXES[p])===0){
            try{ var vv=localStorage.getItem(key); if(vv!=null&&vv.length<=MAX_VAL) out[key]=vv; }catch(e){}
            break;
          }
        }
      }
    }catch(e){}
    return out;
  }

  /* ── 6) TÜM YERELİ TOPLA (push yükü) ─────────────────────── */
  async function collectAll(){
    sanitizeTracker();
    await mirrorNow();                       // kelime ilerlemesi → ayna (localStorage)
    var ls=lsCollect();
    var kv=await kvReadAll();                // modül ilerlemesi (smv:*)
    for(var k in kv){ if(kv.hasOwnProperty(k)) ls[k]=kv[k]; }
    var errors=await errAll().catch(function(){ return []; });
    var ai=await aiReadAll().catch(function(){ return []; });
    return { ls:ls, errors:Array.isArray(errors)?errors.slice(0,3000):[], ai:ai };
  }

  /* ── 7) PUSH: yereli buluta yaz ──────────────────────────── */
  var DOC_LIMIT = 950000;   // Firestore belge limiti ~1MB; güvenli tavan
  function shrinkToLimit(ls){
    var size=0, dropped=0;
    try{ size=JSON.stringify(ls).length; }catch(e){ return {size:0,dropped:0}; }
    if(size<=DOC_LIMIT) return {size:size,dropped:0};
    // sınır aşıldı: en BÜYÜK smv: değerlerinden başlayarak at (küçük not kayıtları kalsın)
    var smv=[];
    for(var k in ls){ if(ls.hasOwnProperty(k)&&k.indexOf("smv:")===0) smv.push([k,(ls[k]||"").length]); }
    smv.sort(function(a,b){ return b[1]-a[1]; });
    for(var i=0;i<smv.length && size>DOC_LIMIT;i++){
      size-=smv[i][1]; delete ls[smv[i][0]]; dropped++;
    }
    try{ size=JSON.stringify(ls).length; }catch(e){}
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
      var data=await collectAll();
      var g=shrinkToLimit(data.ls);

      /* ---- FARK: yalnızca değişen anahtarlar ---- */
      var eski = tam ? {} : sigOku();
      var yeniSig = {}, degisen = {}, degisenSayi = 0;
      for(var k in data.ls){
        if(!data.ls.hasOwnProperty(k)) continue;
        var sg = sigOf(data.ls[k]);
        yeniSig[k] = sg;
        if(eski[k] !== sg){ degisen[k] = data.ls[k]; degisenSayi++; }
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
        errors: errDegisti ? data.errors : null
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
    try{
      var migration=false;
      try{ migration=!!localStorage.getItem("dh-account-migration-pending"); }catch(e){}
      try{ window.dispatchEvent(new CustomEvent("dh-cloud-sync-state",{detail:{state:"syncing",migration:migration}})); }catch(e){}
      var remote=await fb.loadSettings(user.uid);
      var remoteAI=await fb.loadAIExplanations(user.uid).catch(function(){return [];});
      try{ await fb.purgeSecrets(user.uid); }catch(e){}
      var rd=parseRemote(remote);
      // MODÜL ÇAKIŞMA YÖNÜ: bulut, bu cihazın son yazmasından YENİYSE bulut kazanır;
      // değilse (bu cihaz daha taze) yalnız yerelde OLMAYAN modül kayıtları alınır.
      var cloudNewer = ((remote&&remote.updated_at)||0) > (+localStorage.getItem("dh-last-push-ts")||0);
      var pulled=0, kvIncoming={};

      for(var rk in rd.ls){
        if(!rd.ls.hasOwnProperty(rk)) continue;
        var rv=rd.ls[rk];
        if(rv==null||rv==="") continue;
        var ok=(LS_KEYS.indexOf(rk)>=0) || rk.indexOf("smv:")===0;
        if(!ok){ for(var p=0;p<LS_PREFIXES.length;p++){ if(rk.indexOf(LS_PREFIXES[p])===0){ ok=true; break; } } }
        if(!ok || isSecretKey(rk)) continue;
        try{
          if(rk.indexOf("smv:")===0){ kvIncoming[rk]=rv; pulled++; }
          else if(rk==="dh-profile-v1"){ localStorage.setItem(rk,mergeProfile(localStorage.getItem(rk),rv,migration)); pulled++; }
          else if(rk===TRACKER){ localStorage.setItem(rk, mergeTracker(localStorage.getItem(rk), rv)); pulled++; }
          else if(rk==="dh-gemini-report-v1"){ localStorage.setItem(rk, mergeGeminiReport(localStorage.getItem(rk),rv)); pulled++; }
          else if(rk.indexOf("dh-gemini-gunluk-")===0){ localStorage.setItem(rk, mergeGeminiDaily(localStorage.getItem(rk),rv)); pulled++; }
          else if(rk===MIRROR){ localStorage.setItem(rk, mergeMirror(localStorage.getItem(rk), rv)); pulled++; }
          else if(rk===ACTLOG){ localStorage.setItem(rk, mergeActivityLog(localStorage.getItem(rk), rv)); pulled++; }
          else if(rk.indexOf("dh-koc-")===0){ localStorage.setItem(rk, mergeKoc(rk, localStorage.getItem(rk), rv)); pulled++; }
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
      await kvWriteAll(kvIncoming);                 // modül ilerlemesi → IndexedDB (React okur)
      var addedAI=await aiMergeRemote(remoteAI);    // AI açıklaması: en yeni kayıt/silme kazanır
      var addedErr=await errMerge(rd.errors||[]);   // hata defteri birleşir
      var addedProg=await applyMirror();            // kelime aynası → DHProgress IDB
      /* GERİ YAZ: bulut = birleşim. Burada FARK yazma kullanılmaz —
         birleştirme sonrası bulut ile cihazın aynı olduğundan emin olmak
         için tam gönderim yapılır ve imzalar sıfırdan kurulur. */
      var pres=await pushNow(true);

      // teşhis sayacı
      var kvNow=await kvReadAll();
      var mirCount=0; try{ mirCount=Object.keys(JSON.parse(localStorage.getItem(MIRROR)||"{}")).length; }catch(e){}
      var parts=[];
      if(pulled) parts.push(pulled+" kayıt buluttan alındı");
      if(addedErr) parts.push(addedErr+" hata kaydı eklendi");
      if(addedProg) parts.push(addedProg+" ilerleme uygulandı");
      if(addedAI) parts.push(addedAI+" AI açıklaması birleştirildi");
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
      var db=fsMod.getFirestore(app);
      try{
        if(authMod.setPersistence&&authMod.browserLocalPersistence)
          authMod.setPersistence(auth, authMod.browserLocalPersistence);
      }catch(e){}
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
        loadSettings:function(uid){
          // İKİ BELGE: settings (ayarlar) + progress (srs/ayna/günler) — birleşik döndür.
          // Eski tek-belge kurulumları da kapsar (progress boşsa settings'teki her şey okunur).
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
        saveSettings:function(uid,data){
          // BÖL: ilerleme (smv:*, wsrs, ayna, günler) → progress/{uid}; kalan ayarlar → settings/{uid}.
          // İki belge = 2×1MB tavan; ayar değişimi koca ilerlemeyi yeniden yazmaz.
          // nokta/özel karakterli anahtarlar Firestore alan adı olamaz → __bulk
          var doc2={}, bulk={};
          if(data&&data.ls){
            for(var k in data.ls){
              if(!data.ls.hasOwnProperty(k) || isSecretKey(k)) continue;
              if(/[.\/~\[\]*]/.test(k)) bulk[k]=data.ls[k];
              else doc2[k]=data.ls[k];
            }
          }
          var isProg=function(k){ return k.indexOf("smv:")===0 || k==="dh-progress-mirror-v1" || k==="dh-study-tracker-v1"; };
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
          if(!sVar && !pVar) return Promise.resolve([]);

          var now2=Date.now();
          var isler=[];
          if(sVar){ sDoc.updated_at=now2;
            isler.push(fsMod.setDoc(fsMod.doc(db,"settings",uid), sDoc, { merge:true })); }
          if(pVar){ pDoc.updated_at=now2;
            isler.push(fsMod.setDoc(fsMod.doc(db,"progress",uid), pDoc, { merge:true })); }
          return Promise.all(isler);
        }
      };
      ready=true;
      fb.onAuth(function(u){
        user=u?{uid:u.uid}:null;
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
    return { ok:true };
  }
  function hookLocalStorage(){
    try{
      var proto=window.localStorage;
      var origSet=proto.setItem.bind(proto);
      proto.setItem=function(k,v){
        origSet(k,v);
        var key=String(k);
        var match=(LS_KEYS.indexOf(key)>=0);
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
  /* index-app toplu içe aktarmada peş peşe 25 kayıt yazar. Olaylar tek
     debounce içinde birleşir; kullanıcı ekrandan ayrılırsa pagehide'daki
     zorunlu push kalan paketi de gönderir. */
  window.addEventListener("dh-ai-explanation-changed", function(){ aiSyncDirty=true; pushSoon(); });
  window.addEventListener("pagehide", flushOnLeave);
  document.addEventListener("visibilitychange", function(){ if(document.visibilityState==="hidden") flushOnLeave(); });
  initFirebase();
  setTimeout(function(){ takeSnapshot(); }, 4000);
  if(document.readyState!=="loading") updateBadge(); else document.addEventListener("DOMContentLoaded",function(){ updateBadge(); });

  window.DHCloudSync = {
    push: pushNow, sync: initialSync, pull: fullSync, fullSync: fullSync,
    /* Otomatik tetikleyiciler. false yapılırsa yalnızca elle çağrılan
       push/fullSync ve sayfadan ayrılırken yapılan son yazma çalışır. */
    autoPush: true,
    /* Fark yazma imzalarını sıfırla → bir sonraki push tam gönderim olur.
       (Bulutta veri kaybı şüphesi varsa elle çalıştırılır.) */
    resetDiff: sigSifirla,
    signOut: signOutAndPush,
    snapList: snapList, restoreSnap: restoreSnap,
    /* Yedekleme ekranı kendi kopya listesini tutmasın diye TEK KAYNAK burada.
       (Eskiden index sayfası listeyi elle kopyalıyordu ve yeni anahtarlar
        eklendiğinde yedeğe girmiyordu.) */
    keys: function(){ return { list: LS_KEYS.slice(), prefixes: LS_PREFIXES.slice() }; },
    _mergeProfile: mergeProfile,
    get ready(){ return ready; }, get user(){ return user; }
  };
})();
