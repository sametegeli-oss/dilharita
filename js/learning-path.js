console.log('🗺️ learning-path.js YÜKLENDİ — sürüm v15');

/* ═══════════════════════════════════════════════════════════════════
   IndexedDB DEPOLAMA — büyük veri için (localStorage 5MB'ı aşıyor, 11.6MB veri).
   wmPathData artık IDB'ye yazılır; localStorage sadece küçük veriye fallback.
   window.WMStore.set/get/has ile erişilir (Promise döndürür).
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  var DB='wmStore', STORE='kv', VER=1, _db=null;
  function open(){
    return new Promise(function(res,rej){
      if(_db) return res(_db);
      try{
        var rq=indexedDB.open(DB,VER);
        rq.onupgradeneeded=function(){ var d=rq.result; if(!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE); };
        rq.onsuccess=function(){ _db=rq.result; res(_db); };
        rq.onerror=function(){ rej(rq.error); };
      }catch(e){ rej(e); }
    });
  }
  function set(key,val){
    return open().then(function(d){ return new Promise(function(res,rej){
      var tx=d.transaction(STORE,'readwrite'); tx.objectStore(STORE).put(val,key);
      tx.oncomplete=function(){ res(true); }; tx.onerror=function(){ rej(tx.error); };
    });});
  }
  function get(key){
    return open().then(function(d){ return new Promise(function(res,rej){
      var tx=d.transaction(STORE,'readonly'); var rq=tx.objectStore(STORE).get(key);
      rq.onsuccess=function(){ res(rq.result); }; rq.onerror=function(){ rej(rq.error); };
    });});
  }
  window.WMStore = { set:set, get:get };
})();
/* EKRANDA GÖRÜNÜR YÜKLEME BİLDİRİMİ — Console'a gerek yok.
   Dosya çalışıyorsa açılışta yeşil bir banner 4 sn görünür. */
(function(){
  function showLoadBanner(){
    try{
      if(document.getElementById('wmLoadBanner')) return;
      var b=document.createElement('div');
      b.id='wmLoadBanner';
      b.textContent='🗺️ Modül Yolu güncel sürüm yüklendi ✓ (v13)';
      b.style.cssText='position:fixed;left:50%;bottom:90px;transform:translateX(-50%);'
        +'background:linear-gradient(135deg,#22c55e,#16a34a);color:#052e16;font-weight:800;'
        +'font-family:sans-serif;font-size:13px;padding:12px 18px;border-radius:14px;z-index:999999;'
        +'box-shadow:0 10px 30px rgba(0,0,0,.5);max-width:90%;text-align:center;';
      document.body.appendChild(b);
      setTimeout(function(){ b.style.transition='opacity .5s'; b.style.opacity='0';
        setTimeout(function(){ if(b.parentNode)b.parentNode.removeChild(b); },600); }, 4000);
    }catch(e){}
  }
  if(document.body) showLoadBanner();
  else document.addEventListener('DOMContentLoaded', showLoadBanner);
})();
/* ════════════════════════════════════════════════════════════════════════
   WordMode — MODÜL ÖĞRENME YOLU (Learning Path)
   Mevcut uygulamanın İÇİNE entegre. Ayrı HTML yok. Legacy'ye dokunulmaz.
   Excel verisinden Modül → Part → Cümle ağacı kurar; kilit YOK.
   Mevcut motorları çağırır: speak, WM_getImageFor, callAI, updateSRS, addXP.
   ──────────────────────────────────────────────────────────────────────── */
(function WMLearningPath(){
  'use strict';
  if (window.__WM_PATH__) return; window.__WM_PATH__ = true;

  /* ---------- durum ---------- */
  var PATH = { tree: [], byModule: {}, lessonsFlat: [] };
  var PROG = loadProg();
  var view = { level: 'modules', moduleId: null, lessonId: null, stepIdx: 0 };

  function loadProg(){
    try { return JSON.parse(localStorage.getItem('wmPathProgress')) ||
      { known:{}, lessonDone:{}, lastLesson:null, xp:0 }; }
    catch(e){ return { known:{}, lessonDone:{}, lastLesson:null, xp:0 }; }
  }
  function saveProg(){
    try { localStorage.setItem('wmPathProgress', JSON.stringify(PROG)); } catch(e){}
  }

  /* ---------- yardımcılar ---------- */
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function partNo(p){ var m=String(p||'').match(/P\s*(\d+)/i); return m?+m[1]:999; }
  function natural(a,b){ return String(a).localeCompare(String(b),'tr',{numeric:true,sensitivity:'base'}); }
  function rowId(r,i){ return r.id || r.ID || r.rowId || ('S'+i); }
  function rowEN(r){ return r.sentence || r.SentenceEN || r.en || ''; }
  function rowTR(r){ return r.sentenceTr || r.SentenceTR || r.tr || ''; }
  function rowModule(r){ return r.module || r.Module || r.topic || 'Genel Modül'; }
  function rowPart(r){ return r.part || r.Part || 'P1'; }
  function rowStage(r){ return r.stage || r.LearningStage || r.grammarStructure || ''; }
  function rowLevel(r){ return r.level || r.Level || r.sentenceLevel || r.SentenceLevel || 'A1'; }
  function rowGrammar(r){ return r.grammarStructure || r.GrammarStructure || r.grammar || ''; }
  function rowOrder(r,i){ var o=+(r.order||r.OrderIndex); return isNaN(o)?i:o; }

  /* ---------- veri kaynağını bul (WordMode'a yüklü kelimeler) ---------- */
  function sourceRows(){
    // 0) öğrenme yoluna ÖZEL yüklenen Excel (Module/Part içeren) — öncelikli
    try { if (Array.isArray(window.__WM_PATH_DATA__) && window.__WM_PATH_DATA__.length) return window.__WM_PATH_DATA__; } catch(e){}
    try {
      var pr = localStorage.getItem('wmPathData');
      if (pr){ var pa=JSON.parse(pr); if(Array.isArray(pa)&&pa.length){ window.__WM_PATH_DATA__=pa; return pa; } }
    } catch(e){}
    // 1) aktif allWords  2) son yüklenen liste
    try { if (Array.isArray(window.allWords) && window.allWords.length) return window.allWords; } catch(e){}
    try {
      var raw = localStorage.getItem('lastFileData');
      if (raw){ var a=JSON.parse(raw); if(Array.isArray(a)&&a.length) return a; }
    } catch(e){}
    return [];
  }

  /* ---------- Excel → ders ağacı ---------- */
  function buildTree(force){
    var rows = sourceRows();
    // ÖNBELLEK: aynı veri için tekrar kurma (3800 satır + 3.6MB parse pahalı).
    // rows referansı + uzunluk aynıysa mevcut ağacı döndür.
    if(!force && PATH.tree && PATH._srcRef===rows && PATH._srcLen===rows.length){
      return PATH.tree;
    }
    var map = {};                 // moduleId -> {name, lessons:{}}
    rows.forEach(function(r,i){
      var mod = rowModule(r), part = rowPart(r), stage = rowStage(r);
      var en = rowEN(r); if (!en) return;
      var mId = mod;
      var lId = mod + ' || ' + part;
      if (!map[mId]) map[mId] = { id:mId, name:mod, level:rowLevel(r), lessons:{} };
      if (!map[mId].lessons[lId]) map[mId].lessons[lId] =
        { id:lId, module:mod, part:part, stage:stage, order:partNo(part), grammar:rowGrammar(r), items:[] };
      map[mId].lessons[lId].items.push({
        id: rowId(r,i), en:en, tr:rowTR(r), word:(r.word||r.en||''),
        img:(r.imagePrompt||''), grammar:rowGrammar(r), order:rowOrder(r,i), raw:r
      });
    });
    var tree = Object.keys(map).map(function(k){
      var m = map[k];
      var lessons = Object.keys(m.lessons).map(function(lk){
        var l = m.lessons[lk];
        l.items.sort(function(a,b){ return a.order-b.order; });
        return l;
      }).sort(function(a,b){ return a.order-b.order || natural(a.part,b.part); });
      m.lessonsArr = lessons;
      m.total = lessons.reduce(function(s,l){ return s+l.items.length; },0);
      return m;
    }).sort(function(a,b){ return natural(a.name,b.name); });

    PATH.tree = tree;
    PATH._srcRef = rows; PATH._srcLen = rows.length;   // önbellek imzası
    PATH.byModule = {}; tree.forEach(function(m){ PATH.byModule[m.id]=m; });
    PATH.lessonsFlat = [];
    tree.forEach(function(m){ m.lessonsArr.forEach(function(l){ PATH.lessonsFlat.push(l); }); });
    return tree;
  }

  /* ---------- ilerleme hesapları ---------- */
  function lessonKnown(l){ return l.items.filter(function(it){ return PROG.known[it.id]; }).length; }
  function lessonDone(l){ return PROG.lessonDone[l.id] || (l.items.length>0 && lessonKnown(l)>=l.items.length); }
  function moduleKnown(m){ return m.lessonsArr.reduce(function(s,l){ return s+lessonKnown(l); },0); }
  function modulePct(m){ return m.total>0 ? Math.round(moduleKnown(m)/m.total*100) : 0; }
  function findLesson(id){ for(var i=0;i<PATH.lessonsFlat.length;i++) if(PATH.lessonsFlat[i].id===id) return PATH.lessonsFlat[i]; return null; }

  /* expose minimal API for later steps / debugging */
  window.WMPath = { build:buildTree, data:PATH, prog:PROG, _save:saveProg,
    _view:view, go:function(v){ Object.assign(view,v); render(); } };

  /* render & CSS & screen wiring -> defined in part 2 (same file below) */
  window.__WM_PATH_RENDER_HOOK__ = function(fn){ render = fn; };
  var render = function(){ /* replaced in part2 */ };

  /* part2 attaches: injectCSS, ensureScreen, wireNav, render */
  window.__WM_PATH_INTERNAL__ = {
    PATH:PATH, PROG:PROG, view:view, esc:esc, saveProg:saveProg,
    buildTree:buildTree, lessonKnown:lessonKnown, lessonDone:lessonDone,
    moduleKnown:moduleKnown, modulePct:modulePct, findLesson:findLesson,
    setRender:function(fn){ render=fn; }
  };
})();

/* ════════════════════════════════════════════════════════════════════════
   PART 2 — Görsellik (CSS), Ekran kurulumu, Navigasyon, Render
   ──────────────────────────────────────────────────────────────────────── */
(function WMLearningPathUI(){
  'use strict';
  var I = window.__WM_PATH_INTERNAL__; if (!I) return;
  var PATH=I.PATH, PROG=I.PROG, view=I.view, esc=I.esc;

  /* ---------- 1) CSS (tek seferlik enjekte) ---------- */
  function injectCSS(){
    if (document.getElementById('wm-path-css')) return;
    var st=document.createElement('style'); st.id='wm-path-css';
    st.textContent = `
    #sc-path{ --p-glow:rgba(139,92,246,.55); --p-glow2:rgba(59,130,246,.45);
      padding:0 0 90px; }
    #sc-path .wp-hero{ position:relative; overflow:hidden;
      padding:26px 18px 30px; border-radius:0 0 28px 28px;
      background:
        radial-gradient(120% 90% at 12% -10%, rgba(139,92,246,.35), transparent 55%),
        radial-gradient(120% 90% at 95% 0%, rgba(59,130,246,.32), transparent 55%),
        linear-gradient(180deg,#141b2e 0%, #0b0f18 100%);
      border-bottom:1px solid rgba(139,92,246,.18); }
    #sc-path .wp-hero::after{ content:""; position:absolute; inset:0;
      background-image:radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px);
      background-size:14px 14px; opacity:.5; pointer-events:none;
      -webkit-mask-image:linear-gradient(180deg,#000,transparent); mask-image:linear-gradient(180deg,#000,transparent); }
    #sc-path .wp-eyebrow{ font-size:11px; letter-spacing:3px; text-transform:uppercase;
      color:#a5b4fc; font-weight:800; opacity:.9; }
    #sc-path .wp-title{ font-size:27px; font-weight:900; color:#f8fafc; margin:4px 0 2px;
      letter-spacing:-.5px; }
    #sc-path .wp-sub{ font-size:13px; color:#94a3b8; }
    #sc-path .wp-stat-row{ display:flex; gap:10px; margin-top:16px; position:relative; z-index:2; }
    #sc-path .wp-stat{ flex:1; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);
      backdrop-filter:blur(8px); border-radius:16px; padding:11px 12px; text-align:center; }
    #sc-path .wp-stat b{ display:block; font-size:20px; font-weight:900; color:#f8fafc; line-height:1.1; }
    #sc-path .wp-stat span{ font-size:10px; color:#94a3b8; font-weight:700; }

    /* yol / patika */
    #sc-path .wp-path{ position:relative; padding:26px 18px 10px; }
    #sc-path .wp-path::before{ content:""; position:absolute; left:42px; top:10px; bottom:10px; width:3px;
      background:linear-gradient(180deg,var(--p-glow),var(--p-glow2),transparent);
      border-radius:3px; opacity:.5; }
    #sc-path .wp-node{ position:relative; display:flex; gap:16px; align-items:stretch; margin-bottom:16px;
      opacity:0; transform:translateY(14px) scale(.98); animation:wpIn .5s cubic-bezier(.2,.8,.25,1) forwards; }
    #sc-path .wp-orb{ flex:0 0 50px; width:50px; height:50px; border-radius:16px; display:flex;
      align-items:center; justify-content:center; font-size:22px; position:relative; z-index:2;
      background:linear-gradient(145deg,#1e2742,#151b2c); border:1px solid rgba(255,255,255,.1);
      box-shadow:0 8px 22px rgba(0,0,0,.45); }
    #sc-path .wp-node.done .wp-orb{ background:linear-gradient(145deg,#16a34a,#22c55e);
      box-shadow:0 8px 26px rgba(34,197,94,.5); }
    #sc-path .wp-card{ flex:1; background:linear-gradient(150deg,rgba(30,39,66,.9),rgba(17,24,39,.92));
      border:1px solid rgba(255,255,255,.09); border-radius:18px; padding:14px 16px; cursor:pointer;
      transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
    #sc-path .wp-card:hover{ transform:translateY(-2px); border-color:rgba(139,92,246,.5);
      box-shadow:0 14px 34px rgba(99,102,241,.22); }
    #sc-path .wp-card:active{ transform:translateY(0) scale(.99); }
    #sc-path .wp-card .wp-cn{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
    #sc-path .wp-card .wp-name{ font-size:15px; font-weight:800; color:#f1f5f9; line-height:1.25; }
    #sc-path .wp-card .wp-meta{ font-size:11px; color:#94a3b8; margin-top:3px; font-weight:600; }
    #sc-path .wp-badge{ font-size:10px; font-weight:800; padding:3px 9px; border-radius:999px;
      background:rgba(99,102,241,.18); color:#c4b5fd; border:1px solid rgba(139,92,246,.3); white-space:nowrap; }
    #sc-path .wp-badge.lv{ background:rgba(34,197,94,.15); color:#86efac; border-color:rgba(34,197,94,.3); }
    /* ilerleme halkası */
    #sc-path .wp-ring{ flex:0 0 44px; width:44px; height:44px; position:relative; }
    #sc-path .wp-ring svg{ transform:rotate(-90deg); }
    #sc-path .wp-ring .wp-pct{ position:absolute; inset:0; display:flex; align-items:center;
      justify-content:center; font-size:11px; font-weight:900; color:#e2e8f0; }
    #sc-path .wp-pbar{ height:6px; border-radius:6px; background:rgba(255,255,255,.07); margin-top:10px; overflow:hidden; }
    #sc-path .wp-pbar i{ display:block; height:100%; border-radius:6px;
      background:linear-gradient(90deg,#6366f1,#22c55e); transition:width .5s ease; }

    /* part chip satırı */
    #sc-path .wp-parts{ display:flex; gap:7px; margin-top:12px; flex-wrap:wrap; }
    #sc-path .wp-chip{ font-size:11px; font-weight:800; padding:6px 12px; border-radius:999px;
      background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#cbd5e1; }
    #sc-path .wp-chip.done{ background:rgba(34,197,94,.18); border-color:rgba(34,197,94,.35); color:#86efac; }

    /* üst bar */
    #sc-path .wp-top{ display:flex; align-items:center; gap:12px; padding:14px 16px 0; }
    #sc-path .wp-back{ width:40px; height:40px; border-radius:13px; border:1px solid rgba(255,255,255,.1);
      background:rgba(255,255,255,.05); color:#e2e8f0; font-size:18px; cursor:pointer; flex:0 0 40px; }
    #sc-path .wp-back:active{ transform:scale(.95); }

    /* ders akışı kartı */
    #sc-path .wp-lesson{ padding:14px 18px 18px; }
    /* RESİM BÜYÜTÜLDÜ — kullanıcı resme/yazıya odaklansın */
    #sc-path .wp-scene{ position:relative; border-radius:18px; overflow:hidden; min-height:400px;
      background:linear-gradient(150deg,#1e2742,#0f1626); border:1px solid rgba(255,255,255,.08);
      display:flex; align-items:flex-end; box-shadow:0 14px 34px rgba(0,0,0,.45); }
    #sc-path .wp-scene .wp-scene-grad{ position:absolute; inset:0;
      background:linear-gradient(180deg,rgba(8,11,18,.15) 0%,rgba(8,11,18,.55) 50%,rgba(8,11,18,.96) 100%); }
    #sc-path .wp-scene .wp-scene-body{ position:relative; z-index:2; padding:18px 18px 20px; width:100%;
      background:linear-gradient(180deg,transparent,rgba(8,11,18,.82) 55%,rgba(8,11,18,.95)); }
    /* CÜMLE BÜYÜTÜLDÜ */
    #sc-path .wp-scene .wp-en{ font-size:26px; font-weight:800; color:#fff; line-height:1.35; letter-spacing:-.3px;
      text-shadow:0 2px 10px rgba(0,0,0,1), 0 1px 3px rgba(0,0,0,1); }
    #sc-path .wp-scene .wp-en .wp-w{ text-shadow:0 2px 10px rgba(0,0,0,1), 0 1px 4px rgba(0,0,0,1); }
    #sc-path .wp-scene .wp-tr{ font-size:16px; color:#e2e8f0; margin-top:9px; font-weight:600;
      text-shadow:0 1px 6px rgba(0,0,0,1); }
    #sc-path .wp-scene .wp-tag{ display:inline-block; font-size:10px; font-weight:800; letter-spacing:1px;
      text-transform:uppercase; color:#c7d2fe; background:rgba(30,27,75,.75); padding:3px 9px;
      border-radius:999px; margin-bottom:10px; }
    /* BUTONLAR — TEK SATIRDA 6 BUTON yan yana, dikey (ikon üstte) + kompakt */
    #sc-path .wp-actions{ display:grid; grid-template-columns:repeat(6,1fr); gap:5px; margin-top:14px; }
    /* Yüzen Mining/Ses/Panel/Tekrar/Shadow butonlarını TÜM uygulamada gizle.
       (Araçlar = #wmToolsBtn fixes.js'in paneli — ONA DOKUNMA, görünür kalsın!) */
    #ffFabs, .ff-fabs,
    [id*="ffMine"], [id*="ffSes"], [class*="ff-fab"] { display:none !important; visibility:hidden !important; }
    /* MODERN MİNİMAL ders butonları — !important: legacy .btn-blue/gradient'i EZ */
    #sc-path .wp-act{ padding:9px 2px !important; border-radius:12px !important; border:1px solid rgba(255,255,255,.09) !important;
      background:rgba(255,255,255,.035) !important; background-image:none !important; font-family:'Nunito',sans-serif !important;
      font-size:11px !important; font-weight:700 !important; cursor:pointer !important; color:#e2e8f0 !important;
      box-shadow:none !important; text-shadow:none !important;
      transition:background .18s, border-color .18s, transform .12s !important;
      display:flex !important; flex-direction:column !important; align-items:center !important; justify-content:center !important; gap:3px !important;
      line-height:1.15 !important; min-height:52px !important; }
    #sc-path .wp-act:hover{ background:rgba(255,255,255,.07) !important; background-image:none !important; border-color:rgba(255,255,255,.18) !important; }
    #sc-path .wp-act:active{ transform:scale(.95) !important; }
    #sc-path .wp-act.listen:hover{ border-color:rgba(59,130,246,.5) !important; }
    #sc-path .wp-act.speak:hover{ border-color:rgba(139,92,246,.5) !important; }
    #sc-path .wp-act.ai:hover{ border-color:rgba(245,158,11,.5) !important; }
    #sc-path .wp-act.know{ background:rgba(34,197,94,.1) !important; background-image:none !important; border-color:rgba(34,197,94,.3) !important; color:#86efac !important; }
    #sc-path .wp-act.know:hover{ background:rgba(34,197,94,.18) !important; border-color:rgba(34,197,94,.5) !important; }
    #sc-path .wp-act.full{ grid-column:1 / -1 !important; }
    #sc-path .wp-act.wp-half{ grid-column:auto !important; }
    #sc-path .wp-act.ghost{ background:rgba(255,255,255,.02) !important; background-image:none !important; color:#94a3b8 !important; }
    #sc-path .wp-act .wp-ico{ font-size:16px; line-height:1; }
    #sc-path .wp-act .wp-lbl{ font-size:11px; font-weight:700; }
    @media (max-width:420px){
      #sc-path .wp-actions{ gap:4px; }
      #sc-path .wp-act{ padding:8px 1px !important; font-size:10px !important; min-height:48px !important; }
      #sc-path .wp-mini-row{ gap:4px; }
      #sc-path .wp-mini{ padding:8px 1px !important; min-height:48px !important; }
      #sc-path .wp-mini .wp-lbl, #sc-path .wp-act .wp-lbl{ font-size:10px; }
      #sc-path .wp-scene{ min-height:320px; }
      #sc-path .wp-scene .wp-en{ font-size:22px; }
    }
    /* bölümle birlikte açılan mini pekiştirme */
    #sc-path .wp-mini-acts{ margin-top:14px; padding:14px; border-radius:16px;
      background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.06); }
    #sc-path .wp-mini-title{ font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase;
      letter-spacing:1.5px; margin-bottom:10px; }
    #sc-path .wp-mini-row{ display:grid; grid-template-columns:repeat(6,1fr); gap:5px; }
    #sc-path .wp-mini{ padding:9px 2px !important; border-radius:12px !important; border:1px solid rgba(255,255,255,.08) !important;
      background:rgba(255,255,255,.03) !important; background-image:none !important; color:#cbd5e1 !important; font-family:'Nunito',sans-serif !important; font-size:11px !important;
      font-weight:700 !important; cursor:pointer !important; box-shadow:none !important; text-shadow:none !important; transition:background .18s, border-color .18s, transform .12s !important;
      display:flex !important; flex-direction:column !important; align-items:center !important; justify-content:center !important; gap:3px !important;
      line-height:1.15 !important; min-height:52px !important; }
    #sc-path .wp-mini:hover{ background:rgba(139,92,246,.15) !important; background-image:none !important; border-color:rgba(255,255,255,.16) !important; }
    #sc-path .wp-mini:active{ transform:scale(.95) !important; }
    #sc-path .wp-mini .wp-ico{ font-size:16px; line-height:1; }
    #sc-path .wp-mini .wp-lbl{ font-size:11px; font-weight:700; }
    #sc-path .wp-mini.blue{ background:rgba(59,130,246,.1) !important; background-image:none !important; color:#93c5fd !important; border:1px solid rgba(59,130,246,.25) !important; }
    #sc-path .wp-mini.blue:hover{ background:rgba(59,130,246,.18) !important; border-color:rgba(59,130,246,.45) !important; }
    #sc-path .wp-mini.test{ background:rgba(245,158,11,.1) !important; background-image:none !important; color:#fcd34d !important; border-color:rgba(245,158,11,.25) !important; }
    #sc-path .wp-mini.test:hover{ background:rgba(245,158,11,.18) !important; border-color:rgba(245,158,11,.45) !important; }
    #sc-path .wp-mini-wide{ grid-column:auto !important; }
    /* gramer renkli kelimeler */
    #sc-path .wp-en .wp-w{ transition:color .25s; }
    #sc-path .wp-progress-mini{ display:flex; align-items:center; gap:10px; margin:14px 0 4px; }
    #sc-path .wp-progress-mini .bar{ flex:1; height:7px; border-radius:7px; background:rgba(255,255,255,.07); overflow:hidden; }
    #sc-path .wp-progress-mini .bar i{ display:block; height:100%; background:linear-gradient(90deg,#6366f1,#22c55e); transition:width .4s; }
    #sc-path .wp-progress-mini .lbl{ font-size:12px; font-weight:800; color:#94a3b8; white-space:nowrap; }
    #sc-path .wp-ai-box{ margin-top:14px; border-radius:16px; padding:14px;
      background:linear-gradient(150deg,rgba(245,158,11,.1),rgba(217,119,6,.05));
      border:1px solid rgba(245,158,11,.25); color:#fde68a; font-size:13px; line-height:1.6; white-space:pre-wrap; }
    #sc-path .wp-empty{ text-align:center; padding:60px 24px; color:#94a3b8; }
    #sc-path .wp-empty .em{ font-size:54px; margin-bottom:14px; }
    @keyframes wpIn{ to{ opacity:1; transform:translateY(0) scale(1);} }
    @keyframes wpShimmer{ 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    #sc-path .wp-shimmer{ background:linear-gradient(100deg,#1b2230 30%,#243049 50%,#1b2230 70%);
      background-size:200% 100%; animation:wpShimmer 1.2s infinite; }

    /* ════ ANA MENÜ (sc-menu) — PROFESYONEL KOMPAKT KART DÜZENİ ════
       Legacy .btn-blue/.btn-* gradient'lerini ez. Kartlar %50 küçültüldü, hizalı. */
    #sc-menu > div[style*="grid"]{ gap:8px !important; padding:0 16px 16px !important;
      max-width:640px !important; margin:0 auto !important;
      grid-template-columns:repeat(2,1fr) !important; }
    /* TÜM menü kartları ikili düzende — hiçbiri tam genişlik kaplamasın */
    #sc-menu > div[style*="grid"] > button{ grid-column:auto !important; width:auto !important; }
    #sc-menu button{
      background:rgba(255,255,255,.04) !important;
      background-image:none !important;
      color:#e2e8f0 !important;
      border:1px solid rgba(255,255,255,.08) !important;
      border-radius:14px !important;
      box-shadow:none !important;
      text-shadow:none !important;
      padding:12px 14px !important;
      min-height:0 !important;
      display:flex !important;
      flex-direction:row !important;
      align-items:center !important;
      justify-content:flex-start !important;
      gap:11px !important;
      text-align:left !important;
      font-family:'Nunito',sans-serif !important;
      transition:background .18s, border-color .18s, transform .12s !important;
    }
    #sc-menu button:hover{
      background:rgba(255,255,255,.07) !important;
      border-color:rgba(255,255,255,.16) !important;
      transform:translateY(-1px) !important;
    }
    #sc-menu button:active{ transform:scale(.98) !important; }
    #sc-menu button > div:first-child{
      font-size:22px !important;
      margin:0 !important;
      width:34px !important; height:34px !important;
      display:flex !important; align-items:center !important; justify-content:center !important;
      background:rgba(255,255,255,.05) !important; border-radius:10px !important; flex-shrink:0 !important;
    }
    #sc-menu button > div:not(:first-child){
      color:#e2e8f0 !important; font-size:14px !important; font-weight:700 !important;
      text-align:left !important; line-height:1.25 !important;
    }
    #sc-menu h1{ color:#f1f5f9 !important; -webkit-text-fill-color:#f1f5f9 !important; font-weight:900 !important; font-size:20px !important; }
    #sc-menu p{ color:#94a3b8 !important; font-size:13px !important; }
    #sc-menu > div[style*="text-align:center"]{ padding:20px 20px 14px !important; }

    /* ════ TÜM EKRANLARDA BUTONLARI %50 KÜÇÜLT ════ */
    .btn, .btn-blue, .btn-green, .btn-ghost, .btn-red, .act-btn, .nav-btn,
    .reader-btn, .streak-badge, .pill, .chip{
      padding:7px 12px !important;
      font-size:13px !important;
      border-radius:10px !important;
      min-height:0 !important;
      line-height:1.2 !important;
    }
    .btn-sm, .act-btn.sm{ padding:5px 9px !important; font-size:12px !important; }
    /* top-bar / başlık butonları (geri, ay, dropdown) küçült */
    .top-bar .back-btn, .top-bar button, .back-btn{
      padding:6px 10px !important; font-size:14px !important; min-height:0 !important;
      width:auto !important; height:auto !important; border-radius:10px !important;
    }
    /* büyük yuvarlak ikon butonları (ses/ok) küçült */
    button[onclick*="speak"], button[onclick*="prev"], button[onclick*="next"],
    button[onclick*="Audio"]{ padding:7px 11px !important; font-size:14px !important; min-height:0 !important; }
    /* dropdown (liste seçici) küçült */
    select, .list-select, #listDropdown{ padding:6px 10px !important; font-size:13px !important; min-height:0 !important; }
    `;
    document.head.appendChild(st);
  }

  /* ---------- 2) Ekranı garanti et ---------- */
  function ensureScreen(){
    var app = document.getElementById('app') || document.body;
    var sc = document.getElementById('sc-path');
    if (!sc){
      sc = document.createElement('div');
      sc.className = 'screen'; sc.id = 'sc-path';
      app.appendChild(sc);
    }
    return sc;
  }

  /* ---------- 3) Nav düğmesi (mevcut bn-languageMap'i içeri al / yeni ekle) ---------- */
  function wireNav(){
    var nav = document.getElementById('bottomNav'); if (!nav) return;
    if (document.getElementById('bn-path')) return;   // zaten bağlı
    var existing = document.getElementById('bn-languageMap');
    if (existing){
      // Ayrı dosya açan eski düğmeyi UYGULAMA İÇİ yola çevir
      existing.setAttribute('onclick', "WMPath.open()");
      existing.onclick = function(e){ if(e&&e.preventDefault)e.preventDefault(); openPath(); };
      existing.innerHTML = '<span class="bico">🗺️</span>Modüller';
      existing.id = 'bn-path';
      return;
    }
    if (document.getElementById('bn-path')) return;
    var btn = document.createElement('button');
    btn.className='bnav-btn'; btn.id='bn-path';
    btn.innerHTML='<span class="bico">🗺️</span>Modüller';
    btn.onclick = openPath;
    nav.insertBefore(btn, nav.firstChild);
  }

  function openPath(){
    injectCSS(); ensureScreen();
    try { I.buildTree(); } catch(e){ console.warn('path build hata', e); }
    // alt navı işaretle
    try { document.querySelectorAll('.bnav-btn').forEach(function(b){ b.classList.remove('active'); }); } catch(e){}
    var b=document.getElementById('bn-path'); if(b) b.classList.add('active');
    // diğer ekranları kapat
    try { document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); s.style.display='none'; }); } catch(e){}
    var sc=document.getElementById('sc-path'); sc.classList.add('active'); sc.style.display='block';
    try { document.body.classList.add('wm-path-active'); } catch(e){}
    try { var nav=document.getElementById('bottomNav'); if(nav) nav.style.display='flex'; } catch(e){}
    view.level='modules'; render();
  }
  window.WMPath.open = openPath;
  /* Öğrenme yolundan ANA MENÜYE dön */
  window.WMPath.toMenu = function(){
    try { document.body.classList.remove('wm-path-active'); } catch(e){}
    window.__WM_USER_NAV__ = true;
    if(typeof window.showScreen==='function'){ try{ window.showScreen('sc-menu'); return; }catch(e){} }
    try {
      document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); s.style.display='none'; });
      var m=document.getElementById('sc-menu'); if(m){ m.classList.add('active'); m.style.display='block'; }
    } catch(e){}
  };

  /* ───────── İLERLEME YEDEKLE / GERİ YÜKLE ─────────
     Öğrenme yolu ilerlemesini (wmPathProgress) dosyaya indir / dosyadan geri yükle.
     Cihaz/tarayıcı değiştirirken veya yanlışlıkla silinmeye karşı güvence. */
  window.WMPath.backupProgress = function(){
    try{
      var prog = I.PROG || {};
      var payload = {
        type: 'wordmode-learning-path-progress',
        version: 1,
        savedAt: new Date().toISOString(),
        progress: prog,
        stats: {
          known: Object.keys(prog.known||{}).length,
          lessonsDone: Object.keys(prog.lessonDone||{}).length,
          xp: prog.xp||0
        }
      };
      var blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var d = new Date();
      var stamp = d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2)
        +'-'+('0'+d.getHours()).slice(-2)+('0'+d.getMinutes()).slice(-2);
      a.href = url; a.download = 'wordmode-ilerleme-'+stamp+'.json';
      document.body.appendChild(a); a.click();
      setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
      if(window.showToast) window.showToast('💾 İlerleme yedeklendi',
        payload.stats.known+' kelime · '+payload.stats.lessonsDone+' ders · '+payload.stats.xp+' XP');
    }catch(e){
      if(window.showToast) window.showToast('⚠️ Yedekleme hatası', String(e&&e.message||e));
    }
  };

  window.WMPath.restoreProgress = function(){
    var inp = document.getElementById('wpRestoreInput');
    if(!inp){
      inp = document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
      inp.id='wpRestoreInput'; inp.style.display='none'; document.body.appendChild(inp);
    }
    inp.value='';
    inp.onchange = function(){
      var f = inp.files && inp.files[0]; if(!f) return;
      var reader = new FileReader();
      reader.onload = function(){
        try{
          var data = JSON.parse(reader.result);
          var incoming = (data && data.progress) ? data.progress : data;  // ham PROG de kabul
          if(!incoming || typeof incoming!=='object' || (!incoming.known && !incoming.lessonDone)){
            if(window.showToast) window.showToast('⚠️ Geçersiz dosya','Bu bir ilerleme yedeği değil');
            return;
          }
          var cur = I.PROG || {known:{},lessonDone:{},xp:0};
          var curCount = Object.keys(cur.known||{}).length;
          var newCount = Object.keys(incoming.known||{}).length;
          var msg = 'Yedek: '+newCount+' kelime. Mevcut: '+curCount+' kelime.\n\n'
            +'BİRLEŞTİR = ikisini de tut (önerilen)\nİPTAL = hiçbir şey yapma\n\n'
            +'Üzerine yazmak (yedekle değiştir) için önce İptal edip tekrar onayla.';
          if(!window.confirm('İlerlemeyi geri yükle?\n\n'+msg)) return;
          // BİRLEŞTİR: mevcut + yedek (yedekteki known/lessonDone eklenir, XP en büyüğü)
          var merged = {
            known: Object.assign({}, cur.known||{}, incoming.known||{}),
            lessonDone: Object.assign({}, cur.lessonDone||{}, incoming.lessonDone||{}),
            lastLesson: incoming.lastLesson || cur.lastLesson || null,
            xp: Math.max(cur.xp||0, incoming.xp||0)
          };
          // PROG'u güncelle + kaydet
          try{ Object.keys(I.PROG).forEach(function(k){ delete I.PROG[k]; }); }catch(_){}
          Object.assign(I.PROG, merged);
          I.saveProg();
          if(window.showToast) window.showToast('📥 İlerleme geri yüklendi',
            Object.keys(merged.known).length+' kelime birleştirildi');
          // ekranı tazele
          try{ if(typeof render==='function') render(); }catch(_){}
        }catch(e){
          if(window.showToast) window.showToast('⚠️ Geri yükleme hatası', String(e&&e.message||e));
        }
      };
      reader.readAsText(f);
    };
    inp.click();
  };

  /* ---------- 4) RENDER ---------- */
  function ringSVG(pct){
    var r=18, c=2*Math.PI*r, off=c*(1-pct/100);
    return '<svg width="44" height="44" viewBox="0 0 44 44">'
      +'<circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="4"/>'
      +'<circle cx="22" cy="22" r="18" fill="none" stroke="url(#wpg)" stroke-width="4" stroke-linecap="round"'
      +' stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"/>'
      +'<defs><linearGradient id="wpg" x1="0" y1="0" x2="1" y2="1">'
      +'<stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#22c55e"/></linearGradient></defs></svg>';
  }

  function render(){
    var sc=document.getElementById('sc-path'); if(!sc) return;
    if (view.level==='modules') return renderModules(sc);
    if (view.level==='parts')   return renderParts(sc);
    if (view.level==='lesson')  return renderLesson(sc);
  }
  I.setRender(render);

  function renderModules(sc){
    var tree=PATH.tree;
    var doneCount=0, totalKnown=0, totalAll=0;
    tree.forEach(function(m){ totalKnown+=I.moduleKnown(m); totalAll+=m.total;
      if (I.modulePct(m)>=100) doneCount++; });
    if (!tree.length){
      if (!window.__WM_PATH_AUTOTRIED__){
        window.__WM_PATH_AUTOTRIED__ = true;
        sc.innerHTML = '<div class="wp-hero"><div class="wp-eyebrow">WordMode</div>'
          +'<div class="wp-title">Öğrenme Yolu</div>'
          +'<div class="wp-sub">Veri yükleniyor…</div></div>'
          +'<div class="wp-empty"><div class="em">⏳</div>Modül verisi GitHub\'dan yükleniyor…</div>';
        P.autoLoadGitHub(function(ok){
          if(ok && I.PATH.tree.length){ P.go({level:'modules'}); }
          else { render(); }
        });
        return;
      }
      sc.innerHTML = '<div class="wp-hero"><div class="wp-eyebrow">WordMode</div>'
        +'<div class="wp-title">Öğrenme Yolu</div>'
        +'<div class="wp-sub">Modül modül ilerle</div></div>'
        +'<div class="wp-empty"><div class="em">📭</div>'
        +'Henüz modül verisi yok.<br>9 modüllük Excel dosyanı buradan yükle.'
        +'<div style="margin-top:20px"><button class="wp-act ai" style="display:inline-flex;padding:14px 26px" onclick="WMPath.pickExcel()">📄 Excel Yükle</button></div>'
        +'<input type="file" id="wpExcelInput" accept=".xlsx,.xls,.xlsm" style="display:none">'
        +'</div>';
      return;
    }
    var hero = '<div class="wp-hero">'
      +'<button class="wp-menu-btn" onclick="WMPath.toMenu()">← Ana Menü</button>'
      +'<div class="wp-eyebrow">İngilizce · Modül Yolu</div>'
      +'<div class="wp-title">Öğrenme Yolu 🗺️</div>'
      +'<div class="wp-sub">İstediğin modülü seç, kilit yok.</div>'
      +'<div class="wp-stat-row">'
        +'<div class="wp-stat"><b>'+tree.length+'</b><span>MODÜL</span></div>'
        +'<div class="wp-stat"><b>'+totalKnown+'</b><span>ÖĞRENİLEN</span></div>'
        +'<div class="wp-stat"><b>'+doneCount+'</b><span>BİTEN</span></div>'
      +'</div>'
      +'<button class="wp-hero-excel" onclick="WMPath.pickExcel()" title="Excel değiştir">📄</button>'
      +'<button class="wp-hero-excel wp-hero-backup" onclick="WMPath.backupProgress()" title="İlerlemeyi yedekle (indir)">💾</button>'
      +'<button class="wp-hero-excel wp-hero-restore" onclick="WMPath.restoreProgress()" title="Yedekten geri yükle">📥</button>'
      +'<input type="file" id="wpExcelInput" accept=".xlsx,.xls,.xlsm" style="display:none">'
      +'<input type="file" id="wpRestoreInput" accept=".json,application/json" style="display:none">'
      +'</div>';

    var nodes = tree.map(function(m,i){
      var pct=I.modulePct(m), done=pct>=100;
      var icon = done ? '✓' : (['🅰️','📘','📗','📙','⭐','🌟','🏆','🧩','🔤'][i%9]);
      return '<div class="wp-node '+(done?'done':'')+'" style="animation-delay:'+(i*60)+'ms">'
        +'<div class="wp-orb">'+icon+'</div>'
        +'<div class="wp-card" onclick="WMPath.go({level:\'parts\',moduleId:'+JSON.stringify(m.id).replace(/"/g,'&quot;')+'})">'
          +'<div class="wp-cn"><div>'
            +'<div class="wp-name">'+esc(m.name)+'</div>'
            +'<div class="wp-meta">'+m.lessonsArr.length+' bölüm · '+m.total+' cümle</div>'
          +'</div>'
          +'<div class="wp-ring">'+ringSVG(pct)+'<div class="wp-pct">%'+pct+'</div></div>'
          +'</div>'
          +'<div class="wp-pbar"><i style="width:'+pct+'%"></i></div>'
        +'</div></div>';
    }).join('');

    sc.innerHTML = hero + '<div class="wp-path">'+nodes+'</div>';
  }

  function renderParts(sc){
    var m=PATH.byModule[view.moduleId]; if(!m){ view.level='modules'; return render(); }
    var top='<div class="wp-top"><button class="wp-back" onclick="WMPath.go({level:\'modules\'})">←</button>'
      +'<div><div class="wp-eyebrow" style="color:#a5b4fc">'+esc(m.level||'A1')+'</div>'
      +'<div style="font-size:19px;font-weight:900;color:#f8fafc">'+esc(m.name)+'</div></div></div>';
    var nodes = m.lessonsArr.map(function(l,i){
      var k=I.lessonKnown(l), tot=l.items.length, pct=tot?Math.round(k/tot*100):0;
      var done=I.lessonDone(l);
      return '<div class="wp-node '+(done?'done':'')+'" style="animation-delay:'+(i*70)+'ms">'
        +'<div class="wp-orb">'+(done?'✓':(i+1))+'</div>'
        +'<div class="wp-card" onclick="WMPath.go({level:\'lesson\',lessonId:'+JSON.stringify(l.id).replace(/"/g,'&quot;')+',stepIdx:0})">'
          +'<div class="wp-cn"><div>'
            +'<div class="wp-name">'+esc(l.part)+(l.stage?' · '+esc(l.stage):'')+'</div>'
            +'<div class="wp-meta">'+tot+' cümle'+(l.grammar?' · '+esc(l.grammar):'')+'</div>'
          +'</div><span class="wp-badge '+(done?'lv':'')+'">'+(done?'Bitti':('%'+pct))+'</span></div>'
          +'<div class="wp-pbar"><i style="width:'+pct+'%"></i></div>'
        +'</div></div>';
    }).join('');
    sc.innerHTML = top + '<div class="wp-path">'+nodes+'</div>';
  }

  function renderLesson(sc){
    var l=I.findLesson(view.lessonId); if(!l){ view.level='modules'; return render(); }
    if (view.stepIdx>=l.items.length) view.stepIdx=l.items.length-1;
    if (view.stepIdx<0) view.stepIdx=0;
    var it=l.items[view.stepIdx];
    var k=I.lessonKnown(l), tot=l.items.length, pct=Math.round((view.stepIdx+1)/tot*100);
    var known=!!PROG.known[it.id];
    PROG.lastLesson=l.id; I.saveProg();

    var top='<div class="wp-top"><button class="wp-back" onclick="WMPath.go({level:\'parts\',moduleId:'+JSON.stringify(l.module).replace(/"/g,'&quot;')+'})">←</button>'
      +'<div style="flex:1"><div class="wp-eyebrow" style="color:#a5b4fc">'+esc(l.part)+'</div>'
      +'<div style="font-size:16px;font-weight:900;color:#f8fafc">'+esc(l.module)+'</div></div></div>';

    var body = '<div class="wp-lesson">'
      +'<div class="wp-progress-mini"><div class="bar"><i style="width:'+pct+'%"></i></div>'
        +'<span class="lbl">'+(view.stepIdx+1)+' / '+tot+'</span></div>'
      +'<div class="wp-scene" id="wpScene">'
        +'<div class="wp-scene-grad"></div>'
        +'<div class="wp-scene-body">'
          +(it.grammar?'<span class="wp-tag">'+esc(it.grammar)+'</span>':'')
          +'<div class="wp-en" id="wpEn">'+wordSpans(it.en)+'</div>'
          +(it.tr?'<div class="wp-tr">'+esc(it.tr)+'</div>':'')
          +(function(){var p=it.raw&&(it.raw.trPron||it.raw.TRPronunciation||it.raw.trPronunciation);return p?'<div class="wp-tr-oku" style="margin-top:6px;font-size:14px;color:#fbbf24;font-style:italic;opacity:.9">🗣️ '+esc(p)+'</div>':'';})()
        +'</div>'
      +'</div>'
      +'<div class="wp-actions">'
        +'<button class="wp-act listen" onclick="WMPath.listen()"><span class="wp-ico">🔊</span><span class="wp-lbl">Dinle</span></button>'
        +'<button class="wp-act ambient" onclick="WMPath.ambient()"><span class="wp-ico">🌧️</span><span class="wp-lbl">Ortam</span></button>'
        +'<button class="wp-act speak" onclick="WMPath.speak()"><span class="wp-ico">🎙️</span><span class="wp-lbl">Konuş</span></button>'
        +'<button class="wp-act ai" onclick="WMPath.explain()"><span class="wp-ico">🧠</span><span class="wp-lbl">Açıkla</span></button>'
        +'<button class="wp-act know" onclick="WMPath.mark()"><span class="wp-ico">'+(known?'✓':'✅')+'</span><span class="wp-lbl">Bildim</span></button>'
        +'<button class="wp-act ghost" onclick="WMPath.prev()"><span class="wp-ico">←</span><span class="wp-lbl">Geri</span></button>'
        +'<button class="wp-act ghost" onclick="WMPath.next()"><span class="wp-ico">→</span><span class="wp-lbl">İleri</span></button>'
      +'</div>'
      +'<div class="wp-mini-acts">'
        +'<div class="wp-mini-row">'
          +'<button class="wp-mini" onclick="WMPath.practiceShadow()"><span class="wp-ico">🎧</span><span class="wp-lbl">Shadow</span></button>'
          +'<button class="wp-mini" onclick="WMPath.practiceStory()"><span class="wp-ico">📖</span><span class="wp-lbl">Hikaye</span></button>'
          +'<button class="wp-mini" onclick="WMPath.practicePodcast()"><span class="wp-ico">🎙️</span><span class="wp-lbl">Podcast</span></button>'
          +'<button class="wp-mini" onclick="WMPath.practiceScenario()"><span class="wp-ico">💬</span><span class="wp-lbl">Konuş</span></button>'
          +'<button class="wp-mini blue" onclick="WMPath.genSimilar()"><span class="wp-ico">✨</span><span class="wp-lbl">Benzer</span></button>'
          +'<button class="wp-mini test" onclick="WMPath.aiTest()"><span class="wp-ico">📝</span><span class="wp-lbl">AI Test</span></button>'
        +'</div>'
        +'<div id="wpSimilarBox"></div>'
      +'</div>'
      +'<div id="wpAiBox"></div>'
    +'</div>';

    sc.innerHTML = top + body;
    // arka plan görseli (mevcut motor)
    loadScene(it);
    // gramer renklendirmesi (POS) — kelime ekranıyla aynı palet
    colorizeEn(it.en);
  }

  /* ---------- gramer renklendirme (kelime ekranıyla aynı POS paleti) ---------- */
  var POS_COLORS = { noun:'#60a5fa', pronoun:'#38bdf8', verb:'#f87171', auxiliary:'#fb923c',
    adjective:'#4ade80', adverb:'#a78bfa', preposition:'#fbbf24', conjunction:'#f472b6',
    article:'#94a3b8', determiner:'#94a3b8', numeral:'#22d3ee', interjection:'#e879f9', other:'inherit' };
  var POS_TR = { noun:'isim', pronoun:'zamir', verb:'fiil', auxiliary:'yardımcı fiil',
    adjective:'sıfat', adverb:'zarf', preposition:'edat', conjunction:'bağlaç',
    article:'artikel', determiner:'belirteç', numeral:'sayı', interjection:'ünlem', other:'diğer' };
  function cleanWord(v){ return String(v==null?'':v).toLowerCase().replace(/[’']/g,'').replace(/^[^a-z]+|[^a-z]+$/g,'').trim(); }
  function wordSpans(sentence){
    // her kelimeyi span'e sar; noktalama korunur
    return String(sentence||'').split(/(\s+)/).map(function(tok){
      if(/^\s+$/.test(tok)) return tok;
      return '<span class="wp-w">'+esc(tok)+'</span>';
    }).join('');
  }
  var _posCache = {};
  function colorizeEn(sentence){
    var el=document.getElementById('wpEn'); if(!el||!sentence) return;
    var key=sentence.trim();
    if(_posCache[key]){ applyPOS(el,_posCache[key]); return; }
    if(typeof window.callAI!=='function') return;  // AI yoksa renksiz kalır (sorun değil)
    var sys='You are a precise English grammar parser. For each word return its part of speech. '
      +'Respond ONLY with valid JSON, no markdown. Format: {"word":"pos",...} where pos is one of: '
      +'noun, pronoun, verb, auxiliary, adjective, adverb, preposition, conjunction, article, determiner, numeral, interjection, other. '
      +'Lowercase word keys, strip punctuation.';
    Promise.resolve(window.callAI(sys,'Sentence: '+sentence,'explain')).then(function(res){
      var raw=(res&&(res.content||res.text))||res||'';
      raw=String(raw).replace(/```json|```/g,'').trim();
      var m=raw.match(/\{[\s\S]*\}/); if(!m) return;
      var pos; try{ pos=JSON.parse(m[0]); }catch(e){ return; }
      _posCache[key]=pos;
      // ekranda hâlâ aynı cümle mi?
      var cur=document.getElementById('wpEn');
      if(cur) applyPOS(cur,pos);
    }).catch(function(){});
  }
  function applyPOS(container,posMap){
    if(!container||!posMap) return;
    container.querySelectorAll('span.wp-w').forEach(function(sp){
      var w=cleanWord(sp.textContent); if(!w) return;
      var pos=posMap[w]; if(!pos) return;
      var color=POS_COLORS[pos]||POS_COLORS.other;
      if(color&&color!=='inherit'){ sp.style.color=color; sp.style.fontWeight='800';
        sp.setAttribute('data-pos',pos); sp.title=POS_TR[pos]||pos; }
    });
  }

  /* ---------- görsel (mevcut WM_getImageFor) ---------- */
  function loadScene(it){
    var scene=document.getElementById('wpScene'); if(!scene) return;
    if (typeof window.WM_getImageFor!=='function') return;
    scene.classList.add('wp-shimmer');
    // Excel'deki görsel betimlemesi varsa onu kullan (cümleden daha isabetli), yoksa cümleye düş
    var prompt = (it.img && it.img.length>2) ? it.img : it.en;
    window.WM_getImageFor(prompt, it.word||'').then(function(url){
      scene.classList.remove('wp-shimmer');
      if (url){ scene.style.backgroundImage='url("'+url+'")';
        scene.style.backgroundSize='cover'; scene.style.backgroundPosition='center'; }
    }).catch(function(){ scene.classList.remove('wp-shimmer'); });
    // Sahneye uygun ortam sesi türünü hazırla (otomatik çalmaz; butonla)
    try{ WMAmb.setScene(detectScene((it.img||'')+' '+(it.en||''))); }catch(e){}
    // ses çalıyorsa yeni kartta buton etiketini senkron tut
    try{ if(WMAmb.isPlaying()){ var b=document.querySelector('.wp-act.ambient .wp-lbl'), ic=document.querySelector('.wp-act.ambient .wp-ico'); if(b)b.textContent='Ortam ✓'; if(ic)ic.textContent='🔉'; } }catch(e){}
  }

  /* ---------- ORTAM SESİ (Web Audio ile sentez, dosyasız) ----------
     Cümlenin konusuna göre ambians: yağmur, deniz, rüzgâr, şehir,
     kafe, orman/kuş, gece, oda tonu. Butonla aç/kapa. Kart değişince
     tür değişir; çalıyorsa yeni türe geçer. */
  function detectScene(text){
    var t=(text||'').toLowerCase();
    if(/\b(rain|storm|thunder|drizzle|wet|umbrella)\b/.test(t)) return 'rain';
    if(/\b(sea|ocean|beach|wave|shore|coast|surf|tide)\b/.test(t)) return 'waves';
    if(/\b(wind|windy|cold|snow|mountain|storm|breeze)\b/.test(t)) return 'wind';
    if(/\b(city|street|car|traffic|road|bus|town|drive|highway)\b/.test(t)) return 'city';
    if(/\b(cafe|coffee|restaurant|bar|kitchen|cook|eat|dinner|lunch)\b/.test(t)) return 'cafe';
    if(/\b(forest|tree|bird|wood|park|garden|jungle|nature|leaf)\b/.test(t)) return 'forest';
    if(/\b(night|sleep|dark|star|moon|evening|quiet)\b/.test(t)) return 'night';
    return 'room';
  }

  var WMAmb = (function(){
    var ctx=null, nodes=[], gain=null, playing=false, scene='room', timer=null;
    function AC(){ return window.AudioContext||window.webkitAudioContext; }
    function ensureCtx(){ if(!ctx){ var C=AC(); if(!C) return null; ctx=new C(); } return ctx; }
    // pembe/kahverengi gürültü tamponu
    function noiseBuffer(kind){
      var len=ctx.sampleRate*4, b=ctx.createBuffer(1,len,ctx.sampleRate), d=b.getChannelData(0);
      var last=0;
      for(var i=0;i<len;i++){
        var w=Math.random()*2-1;
        if(kind==='brown'){ last=(last+0.02*w)/1.02; d[i]=last*3.5; }
        else { d[i]=w; } // white
      }
      return b;
    }
    function srcNoise(kind){ var s=ctx.createBufferSource(); s.buffer=noiseBuffer(kind); s.loop=true; return s; }
    function stopNodes(){ nodes.forEach(function(n){ try{ n.stop&&n.stop(); }catch(e){} try{ n.disconnect&&n.disconnect(); }catch(e){} }); nodes=[]; if(timer){clearInterval(timer);timer=null;} }

    function build(sc){
      stopNodes();
      gain=ctx.createGain(); gain.gain.value=0.0; gain.connect(ctx.destination);
      var target=0.18; // genel kısık seviye
      if(sc==='rain'){
        var n=srcNoise('white'), hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=900;
        var lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=7000;
        n.connect(hp); hp.connect(lp); lp.connect(gain); n.start(); nodes.push(n);
        target=0.16;
      } else if(sc==='waves'){
        var n2=srcNoise('brown'), lp2=ctx.createBiquadFilter(); lp2.type='lowpass'; lp2.frequency.value=600;
        var g2=ctx.createGain(); g2.gain.value=0.2; n2.connect(lp2); lp2.connect(g2); g2.connect(gain); n2.start(); nodes.push(n2);
        // dalga salınımı (LFO ile gain modülasyonu)
        var t0=ctx.currentTime; timer=setInterval(function(){
          var now=ctx.currentTime; g2.gain.cancelScheduledValues(now);
          g2.gain.setValueAtTime(g2.gain.value, now);
          g2.gain.linearRampToValueAtTime(0.05, now+2.2);
          g2.gain.linearRampToValueAtTime(0.30, now+4.5);
        },4500);
        target=0.22;
      } else if(sc==='wind'){
        var n3=srcNoise('brown'), bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=500; bp.Q.value=0.7;
        n3.connect(bp); bp.connect(gain); n3.start(); nodes.push(n3); target=0.2;
      } else if(sc==='city'){
        var n4=srcNoise('brown'), lp4=ctx.createBiquadFilter(); lp4.type='lowpass'; lp4.frequency.value=400;
        n4.connect(lp4); lp4.connect(gain); n4.start(); nodes.push(n4); target=0.17;
      } else if(sc==='cafe'){
        var n5=srcNoise('white'), bp5=ctx.createBiquadFilter(); bp5.type='bandpass'; bp5.frequency.value=1000; bp5.Q.value=0.5;
        var lp5=ctx.createBiquadFilter(); lp5.type='lowpass'; lp5.frequency.value=2500;
        n5.connect(bp5); bp5.connect(lp5); lp5.connect(gain); n5.start(); nodes.push(n5); target=0.14;
      } else if(sc==='forest'){
        var n6=srcNoise('white'), lp6=ctx.createBiquadFilter(); lp6.type='lowpass'; lp6.frequency.value=3000;
        var g6=ctx.createGain(); g6.gain.value=0.05; n6.connect(lp6); lp6.connect(g6); g6.connect(gain); n6.start(); nodes.push(n6);
        // ara ara kuş ötüşü (kısa sinüs cıvıltıları)
        timer=setInterval(function(){
          if(Math.random()<0.5) chirp();
        },1800);
        target=0.16;
      } else if(sc==='night'){
        var n7=srcNoise('white'), bp7=ctx.createBiquadFilter(); bp7.type='bandpass'; bp7.frequency.value=4500; bp7.Q.value=8;
        var g7=ctx.createGain(); g7.gain.value=0.06; n7.connect(bp7); bp7.connect(g7); g7.connect(gain); n7.start(); nodes.push(n7); target=0.18;
      } else { // room
        var n8=srcNoise('brown'), lp8=ctx.createBiquadFilter(); lp8.type='lowpass'; lp8.frequency.value=200;
        n8.connect(lp8); lp8.connect(gain); n8.start(); nodes.push(n8); target=0.10;
      }
      // yumuşak fade-in
      var now=ctx.currentTime; gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(target, now+1.2);
    }
    function chirp(){
      try{
        var o=ctx.createOscillator(), g=ctx.createGain();
        o.type='sine'; var f=1800+Math.random()*1500; o.frequency.setValueAtTime(f, ctx.currentTime);
        o.frequency.linearRampToValueAtTime(f+400, ctx.currentTime+0.08);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.18);
        o.connect(g); g.connect(gain||ctx.destination); o.start(); o.stop(ctx.currentTime+0.2);
      }catch(e){}
    }
    return {
      setScene:function(s){ scene=s||'room'; if(playing){ try{build(scene);}catch(e){} } },
      isPlaying:function(){ return playing; },
      toggle:function(){
        if(!ensureCtx()) return false;
        if(ctx.state==='suspended') ctx.resume();
        if(playing){ stop(); return false; }
        try{ build(scene); playing=true; return true; }catch(e){ return false; }
      },
      stop:stop
    };
    function stop(){ if(gain){ try{ var now=ctx.currentTime; gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(gain.gain.value,now); gain.gain.linearRampToValueAtTime(0.0001, now+0.4);}catch(e){} } setTimeout(stopNodes,450); playing=false; }
  })();
  window.WMAmb = WMAmb;

  // Ortam butonu (aksiyon satırına eklenir; toggle eder)
  window.WMPath = window.WMPath || {};
  window.WMPath.ambient = function(){
    var on=WMAmb.toggle();
    var b=document.querySelector('.wp-act.ambient .wp-lbl');
    var ic=document.querySelector('.wp-act.ambient .wp-ico');
    if(b) b.textContent = on?'Ortam ✓':'Ortam';
    if(ic) ic.textContent = on?'🔉':'🌧️';
  };

  /* ---------- ders aksiyonları (mevcut motorlara bağlı) ---------- */
  function curItem(){ var l=I.findLesson(view.lessonId); return l?l.items[view.stepIdx]:null; }
  var P = window.WMPath;
  P.listen=function(){ var it=curItem(); if(it&&typeof window.speak==='function') window.speak(it.en,'en-US'); };
  P.speak=function(){ var it=curItem(); if(!it) return;
    // mevcut telaffuz koçunu kullan (varsa); yoksa sadece dinlet
    if (typeof window.startPronCoach==='function'){
      try{ window.pronCoachCustomTarget=it.en; }catch(e){}
    }
    if (typeof window.speak==='function') window.speak(it.en,'en-US');
    if (typeof window.showToast==='function') window.showToast('🎙️ Telaffuz','Tekrar et: '+it.en.slice(0,40));
  };
  P.mark=function(){ var it=curItem(); if(!it) return;
    PROG.known[it.id]=true; PROG.xp=(PROG.xp||0)+5; I.saveProg();
    try{ if(typeof window.updateSRS==='function'&&it.word) window.updateSRS(it.word,true); }catch(e){}
    try{ if(typeof window.addXP==='function') window.addXP(5,'Cümle öğrenildi'); }catch(e){}
    P.next();
  };
  P.next=function(){ var l=I.findLesson(view.lessonId); if(!l) return;
    if (view.stepIdx< l.items.length-1){ view.stepIdx++; render(); }
    else { // ders sonu
      PROG.lessonDone[l.id]=true; I.saveProg();
      if (typeof window.showToast==='function') window.showToast('🎉 Bölüm bitti', l.part+' tamamlandı');
      view.level='parts'; view.moduleId=l.module; render();
    }
  };
  P.prev=function(){ if(view.stepIdx>0){ view.stepIdx--; render(); } };

  /* ---------- AI açıklama (mevcut callAI) ---------- */
  P.explain=function(){ var it=curItem(); if(!it) return;
    var box=document.getElementById('wpAiBox'); if(!box) return;
    if (typeof window.callAI!=='function'){ box.innerHTML='<div class="wp-ai-box">AI şu an kullanılamıyor.</div>'; return; }
    box.innerHTML='<div class="wp-ai-box">🧠 Açıklanıyor…</div>';
    var sys='Sen bir İngilizce öğretmenisin. Kısa, net, Türkçe açıkla. HTML/CSS kullanma.';
    var usr='Şu İngilizce cümleyi Türk öğrenciye açıkla: "'+it.en+'"'
      +(it.grammar?(' Gramer yapısı: '+it.grammar+'.'):'')
      +' 1) Anlamı 2) Yapı/gramer mantığı 3) 1 benzer örnek. Kısa tut.';
    Promise.resolve(window.callAI(sys,usr,'context')).then(function(res){
      var txt = (res&&res.content)?res.content:String(res||'');
      box.innerHTML='<div class="wp-ai-box">'+esc(txt)+'</div>';
    }).catch(function(e){ box.innerHTML='<div class="wp-ai-box">Açıklama alınamadı.</div>'; });
  };

  /* ---------- başlat ---------- */
  function boot(){
    injectCSS(); ensureScreen(); wireNav();
    /* AÇILIŞTA OTOMATİK xlsx YÜKLE — ama açılışı BLOKE ETME.
       buildTree (3800 satır) senkron ve yavaş; menü gelsin diye boşta (idle) çalıştır.
       Veri localStorage'da varsa fetch YOK; sadece tree boşsa GitHub'dan çek. */
    if(window.__WM_BOOT_AUTOLOAD__) return;
    window.__WM_BOOT_AUTOLOAD__ = true;
    var runIdle = window.requestIdleCallback || function(fn){ return setTimeout(fn, 1500); };
    runIdle(function(){
      // 1) Önce IndexedDB'den dene (büyük veri orada kalıcı saklanır → tekrar indirme YOK)
      var pre = (window.WMStore && !(Array.isArray(window.__WM_PATH_DATA__)&&window.__WM_PATH_DATA__.length))
        ? window.WMStore.get('wmPathData').then(function(rows){
            if(Array.isArray(rows) && rows.length){ window.__WM_PATH_DATA__=rows; }
          }).catch(function(){})
        : Promise.resolve();
      pre.then(function(){
        try{
          I.buildTree();  // veri (IDB/localStorage/global) varsa fetch'siz tree kurar
          if((!I.PATH.tree || !I.PATH.tree.length)){
            // tree boş → ilk kez; GitHub'dan bir defa çek (sonra IDB'ye yazılır)
            if(typeof P.autoLoadGitHub==='function'){
              P.autoLoadGitHub(function(ok){ if(ok){ try{ I.buildTree(true); }catch(e){} } });
            }
          }
        }catch(e){}
      });
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* AÇILIŞTA MENÜDE KAL: legacy otomatik veri yükleyince kelime ekranına (sc-word) atıyor.
     Kullanıcı henüz bir şey seçmediyse açılışta ana menüye (sc-menu) döndür. */
  /* JS TEMİZLEYİCİ: yüzen Mining/Ses/Panel butonlarını gizle.
     Araçlar (#wmToolsBtn) HARİÇ — o görünür kalmalı. */
  (function hideFloatingFabs(){
    function clean(){
      try {
        ['ffFabs','ffMine','ffDash','ffRev','ffShad'].forEach(function(id){
          var el=document.getElementById(id); if(el) el.style.display='none';
        });
        document.querySelectorAll('.ff-fab, .ff-fabs').forEach(function(el){ el.style.display='none'; });

        /* ARAÇLAR BUTONUNU EN ÜSTE SAĞA ÇEK (fixes.js top:130px veriyor) */
        var tools=document.getElementById('wmToolsBtn');
        if(tools){
          tools.style.setProperty('top','64px','important');
          tools.style.setProperty('right','12px','important');
          tools.style.display='';   // her ihtimale karşı görünür
        }

        /* METİN BAZLI: hangi dosyadan gelirse gelsin, sağ kenardaki yüzen
           "Mining" / "Ses" butonlarını içeriğe göre yakala ve gizle.
           "🧰 Araçlar" butonuna (#wmToolsBtn) ASLA dokunma. */
        function isFloating(el){
          var n=el;
          for(var i=0;i<5 && n;i++){
            var p=window.getComputedStyle(n).position;
            if(p==='fixed' || p==='absolute') return true;
            n=n.parentElement;
          }
          return false;
        }
        document.querySelectorAll('button, a, [onclick]').forEach(function(el){
          if(el.id==='wmToolsBtn') return;                 // Araçlar korunur
          if(el.closest && el.closest('#wmToolsDrawer')) return; // panel içi korunur
          if(el.closest && el.closest('#sc-modgen')) return;     // modül oluşturucu içi korunur
          var raw=(el.textContent||'').replace(/\s+/g,' ').trim();
          if(raw.length>14) return;                        // uzun metin = içerik butonu değil
          // emoji/sembolleri at, sadece harfleri bırak → "mining" / "ses"
          var t=raw.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g,'').toLowerCase();
          if(t!=='mining' && t!=='ses') return;
          if(isFloating(el)){
            el.style.setProperty('display','none','important');
            // yüzen wrapper'ı da gizle (tek çocuksa)
            var par=el.parentElement;
            if(par && par.children.length<=2 && par.id!=='app'){
              var pt=(par.textContent||'').replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g,'').toLowerCase();
              if(pt==='mining' || pt==='ses' || pt==='miningses' || pt==='sesmining'){
                par.style.setProperty('display','none','important');
              }
            }
          }
        });
      } catch(e){}
    }
    if(document.readyState==='complete') clean();
    else window.addEventListener('load', clean);
    setTimeout(clean,1200); setTimeout(clean,3000); setTimeout(clean,6000);
    // sonradan eklenirlerse yakala
    try{ var mo3=new MutationObserver(clean); mo3.observe(document.body,{childList:true,subtree:true}); }catch(e){}
  })();

  /* AÇILIŞTA MENÜDE KAL */
  (function keepOnMenu(){
    var settled=false;
    var bootAt = Date.now();
    // Açılış penceresi: ilk 5 sn boyunca, kullanıcı tıklamadan önce sc-word'e gitme yasak.
    function inBootWindow(){ return !window.__WM_USER_NAV__ && (Date.now()-bootAt) < 5000; }

    // PROAKTİF: legacy showScreen'i sar — açılışta sc-word çağrılırsa sc-menu'ye çevir.
    function wrapShowScreen(){
      var orig = window.showScreen;
      if(typeof orig!=='function' || orig.__wmMenuGuard) return;
      var wrapped = function(id){
        if(inBootWindow() && id==='sc-word'){
          // açılışta kelime ekranını HİÇ açma → menüde kal (render maliyeti de oluşmaz)
          return orig.call(this, 'sc-menu');
        }
        return orig.apply(this, arguments);
      };
      wrapped.__wmMenuGuard = true;
      try{ window.showScreen = wrapped; }catch(e){}
    }
    wrapShowScreen();
    // legacy showScreen'i sonradan tanımlar/yeniden atarsa tekrar sar
    var iv=setInterval(function(){
      if(window.showScreen && !window.showScreen.__wmMenuGuard) wrapShowScreen();
      if(Date.now()-bootAt>6000) clearInterval(iv);
    }, 200);

    // Yine de güvenlik ağı: aktifse menüye çek
    function toMenu(){
      if(settled || window.__WM_USER_NAV__){ settled=true; return; }
      try {
        var menu=document.getElementById('sc-menu');
        var word=document.getElementById('sc-word');
        if(menu && word && word.classList.contains('active')){
          if(typeof window.showScreen==='function'){ try{ window.showScreen('sc-menu'); }catch(e){} }
        }
      } catch(e){}
    }
    [300,700,1200,2000,3000,4500].forEach(function(ms){ setTimeout(toMenu, ms); });
    window.addEventListener('load', function(){ [500,1500,3500].forEach(function(ms){ setTimeout(toMenu, ms); }); });
    // Kullanıcı bir tab/karta tıklarsa serbest bırak
    document.addEventListener('click', function(e){
      var b=e.target && e.target.closest && e.target.closest('button,[onclick]');
      if(b) window.__WM_USER_NAV__=true;
    }, true);
  })();
  // MutationObserver: nav sonradan gelirse bağla
  try{ var mo=new MutationObserver(function(){ if(document.getElementById('bottomNav')) wireNav(); });
    mo.observe(document.getElementById('app')||document.body,{childList:true,subtree:true}); }catch(e){}

  /* ─────────────────────────────────────────────────────────────
     KAYDIRMADA OTOMATİK KELİME AÇIKLAMASINI ENGELLE
     Sorun: legacy `selectionchange` listener'ı (handleWordSelection) kaydırma
     sırasında oluşan istemsiz metin seçimini yakalayıp _explainWordImpl açıyor.
     Çözüm: kullanıcı parmağı/faresi basılıyken (kaydırma) seçim açıklamasını
     bastır. Manuel çift-tık / uzun-bas ile gelen explainWord ÇALIŞMAYA DEVAM eder.
     ───────────────────────────────────────────────────────────── */
  (function blockScrollAutoExplain(){
    var pointerDown=false, lastScrollTs=0;
    // Kaydırma & dokunma takibi
    var touchStartX=0, touchStartY=0, touchMoved=false;
    window.addEventListener('scroll', function(){ lastScrollTs=Date.now(); }, true);
    window.addEventListener('touchmove', function(e){
      lastScrollTs=Date.now();
      try{
        var t=e.touches&&e.touches[0]; if(t){
          if(Math.abs(t.screenX-touchStartX)>18 || Math.abs(t.screenY-touchStartY)>18) touchMoved=true;
        }
      }catch(_){}
    }, {passive:true,capture:true});
    document.addEventListener('pointerdown', function(){ pointerDown=true; }, true);
    document.addEventListener('pointerup',   function(){ setTimeout(function(){ pointerDown=false; },350); }, true);
    document.addEventListener('touchstart',  function(e){
      pointerDown=true; touchMoved=false;
      try{ var t=e.touches&&e.touches[0]; if(t){ touchStartX=t.screenX; touchStartY=t.screenY; } }catch(_){}
    }, true);
    document.addEventListener('touchend',    function(){ setTimeout(function(){ pointerDown=false; },350); }, true);

    function recentlyScrolled(){ return (Date.now()-lastScrollTs) < 250; }
    function inEditable(){
      var a=document.activeElement;
      return a && (a.tagName==='INPUT' || a.tagName==='TEXTAREA' || a.isContentEditable);
    }

    // Açıklamayı yalnızca KAYDIRMA/HAREKET kaynaklıysa engelle (gerçek tap/tık etkilenmez).
    function shouldBlock(){ return touchMoved || recentlyScrolled(); }
    function shouldBlockLoose(){ return touchMoved; } // sadece o anki dokunuş kaydıysa

    function guard(name, loose){
      var orig = window[name];
      if(typeof orig!=='function' || orig.__wmGuarded) return;
      var blockFn = loose ? shouldBlockLoose : shouldBlock;
      var wrapped = function(){
        if(inEditable()) return orig.apply(this, arguments);
        if(blockFn()){
          try{ var s=window.getSelection&&window.getSelection(); if(s&&s.removeAllRanges) s.removeAllRanges(); }catch(e){}
          return;
        }
        return orig.apply(this, arguments);
      };
      wrapped.__wmGuarded = true;
      try{ window[name]=wrapped; }catch(e){}
    }
    function apply(){
      guard('handleWordSelection');          // sıkı: istemsiz seçim/scroll engellensin
      guard('_explainWordImpl', true);        // gevşek: kasıtlı kelime seçimi kaydırma sonrası da açılsın
      // NOT: handleMobileTouchEnd KASITLI bir dokunmanın sonudur; onu
      // recentlyScrolled penceresiyle engellemek mobilde popup'ın hiç
      // açılmamasına yol açıyordu. İstemsiz açılmayı zaten handleWordSelection
      // guard'ı önlüyor. Bu yüzden artık sarmıyoruz.
      guard('handleWordDoubleClick');
    }
    apply();
    // legacy fonksiyonlar sonradan tanımlanırsa yeniden sar
    window.addEventListener('load', function(){ setTimeout(apply, 800); setTimeout(apply, 2500); });
    setTimeout(apply, 1500);
  })();

  /* ─────────────────────────────────────────────────────────────
     ANA MENÜYE yol.html GEÇİŞ BUTONU EKLE
     ───────────────────────────────────────────────────────────── */
  (function addYolButton(){
    function inject(){
      var menu=document.getElementById('sc-menu');
      if(!menu || document.getElementById('wmYolBtn')) return;
      // Menüdeki ilk buton/kart grid'ini bul (Modüller'in kapsayıcısı)
      var anchor = menu.querySelector('.btn, button, [onclick]');
      var btn=document.createElement('button');
      btn.id='wmYolBtn';
      btn.type='button';
      btn.textContent='🗺️ Modül Yolu (yol.html)';
      btn.style.cssText='display:block;width:calc(100% - 24px);max-width:560px;margin:14px auto 4px;padding:15px 18px;'
        +'background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;border-radius:16px;'
        +"font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;cursor:pointer;"
        +'box-shadow:0 6px 20px rgba(124,58,237,.35);transition:transform .12s ease,filter .15s ease;';
      btn.onmouseenter=function(){ btn.style.transform='translateY(-2px)'; btn.style.filter='brightness(1.08)'; };
      btn.onmouseleave=function(){ btn.style.transform='translateY(0)'; btn.style.filter='none'; };
      btn.onclick=function(){ location.href='yol.html'; };
      // Menünün en üstüne ekle (başlığın hemen altına)
      var title = menu.querySelector('h1,h2,.menu-title,p');
      if(title && title.parentElement===menu){ title.insertAdjacentElement('afterend', btn); }
      else { menu.insertBefore(btn, menu.firstChild); }
    }
    inject();
    window.addEventListener('load', function(){ setTimeout(inject, 600); setTimeout(inject, 1800); });
    setTimeout(inject, 1200);
    // Menü sonradan render olursa yakala
    try{ var mo2=new MutationObserver(function(){ if(document.getElementById('sc-menu')) inject(); });
      mo2.observe(document.body,{childList:true,subtree:true}); }catch(e){}
  })();
})();


/* ════════════════════════════════════════════════════════════════════════
   PART 3 — Ders sonu AI gramer özeti · Akıllı tekrar quiz · Konuşma köprüsü
   Mevcut motorlar: callAI, generateQuiz, startCustomScenario, switchTab, speak
   ──────────────────────────────────────────────────────────────────────── */
(function WMLearningPathPlus(){
  'use strict';
  var I = window.__WM_PATH_INTERNAL__; if (!I) return;
  var PATH=I.PATH, PROG=I.PROG, view=I.view, esc=I.esc;
  var P = window.WMPath;

  function curLesson(){ return I.findLesson(view.lessonId); }
  function curModule(){ var l=curLesson(); return l?PATH.byModule[l.module]:null; }

  /* shuffle yardımcı */
  function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i];a[i]=a[j];a[j]=t; } return a; }

  /* ----------------------------------------------------------------
     1) DERS SONU — AI gramer özeti
     P.next() ders bittiğinde parts'a dönüyordu; onun yerine önce özet
     ekranı gösterelim. Mevcut P.next'i sarmalıyoruz (override).
  ---------------------------------------------------------------- */
  var _origNext = P.next;
  P.next = function(){
    var l=curLesson(); if(!l){ return _origNext&&_origNext(); }
    if (view.stepIdx < l.items.length-1){ return _origNext&&_origNext(); }
    // ders sonu: tamamla + özet ekranı
    PROG.lessonDone[l.id]=true; I.saveProg();
    try{ if(typeof window.showToast==='function') window.showToast('🎉 Bölüm bitti', l.part+' tamamlandı'); }catch(e){}
    showLessonComplete(l);
  };

  function showLessonComplete(l){
    var sc=document.getElementById('sc-path'); if(!sc) return;
    view.level='complete';
    var m=PATH.byModule[l.module];
    var modPct = m?I.modulePct(m):0;
    var grammar = l.grammar || (l.items[0]&&l.items[0].grammar) || '';
    var moduleDone = modPct>=100;
    sc.innerHTML =
      '<div class="wp-top"><button class="wp-back" onclick="WMPath.go({level:\'parts\',moduleId:'+JSON.stringify(l.module).replace(/"/g,'&quot;')+'})">←</button>'
      +'<div style="flex:1"><div class="wp-eyebrow" style="color:#86efac">TAMAMLANDI</div>'
      +'<div style="font-size:17px;font-weight:900;color:#f8fafc">'+esc(l.part)+'</div></div></div>'
      +'<div class="wp-lesson">'
        +'<div class="wp-complete-hero">'
          +'<div class="wp-burst">🎉</div>'
          +'<div class="wp-complete-title">Bölüm tamamlandı!</div>'
          +'<div class="wp-complete-sub">'+esc(l.module)+' · Modül ilerlemesi %'+modPct+'</div>'
        +'</div>'
        +'<div class="wp-pbar" style="margin:14px 0 4px"><i style="width:'+modPct+'%"></i></div>'
        + (moduleDone
            ? '<div class="wp-module-banner" onclick="WMPath.reinforce()">🏆 Modülü bitirdin! <b>Pekiştirme aktivitelerini aç →</b></div>'
            : '')
        +'<button class="wp-act ai full" style="margin-top:16px" onclick="WMPath.grammarSummary()">🧠 AI Gramer Özeti</button>'
        +'<div id="wpSummaryBox"></div>'
        +'<button class="wp-act speak full" style="margin-top:10px" onclick="WMPath.practiceScenario()">💬 Bu konuda konuşma pratiği</button>'
        +'<button class="wp-act know full" style="margin-top:10px" onclick="WMPath.reviewQuiz()">🔁 Akıllı tekrar testi</button>'
        +'<button class="wp-act ghost full" style="margin-top:10px" onclick="WMPath.practiceShadow()">🎧 Shadowing ile pekiştir</button>'
        +'<button class="wp-act ghost full" style="margin-top:10px" onclick="WMPath.go({level:\'parts\',moduleId:'+JSON.stringify(l.module).replace(/"/g,'&quot;')+'})">Bölümlere dön</button>'
      +'</div>';
  }

  /* AI gramer özeti */
  P.grammarSummary = function(){
    var l=curLesson(); if(!l) return;
    var box=document.getElementById('wpSummaryBox'); if(!box) return;
    if (typeof window.callAI!=='function'){ box.innerHTML='<div class="wp-ai-box">AI şu an kullanılamıyor.</div>'; return; }
    box.innerHTML='<div class="wp-ai-box">🧠 Gramer özeti hazırlanıyor…</div>';
    var examples = l.items.slice(0,6).map(function(it){ return '- '+it.en+(it.tr?(' ('+it.tr+')'):''); }).join('\n');
    var sys='Sen deneyimli bir İngilizce öğretmenisin. Türkçe, kısa ve net açıkla. Madde madde yaz, HTML kullanma.';
    var usr='Öğrenci şu bölümü bitirdi: "'+l.module+' / '+l.part+'".'
      +(l.grammar?(' Ana gramer yapısı: '+l.grammar+'.'):'')
      +'\nÖrnek cümleler:\n'+examples
      +'\n\nŞunları ver: 1) Bu bölümün gramer kuralını 2-3 cümleyle özetle. '
      +'2) Dikkat edilecek 1 yaygın hata. 3) Aynı kalıpta 2 YENİ örnek cümle (İngilizce + Türkçe). Kısa tut.';
    Promise.resolve(window.callAI(sys,usr,'context')).then(function(res){
      var txt=(res&&res.content)?res.content:String(res||'');
      box.innerHTML='<div class="wp-ai-box">'+esc(txt)+'</div>';
    }).catch(function(){ box.innerHTML='<div class="wp-ai-box">Özet alınamadı (AI hatası).</div>'; });
  };

  /* ----------------------------------------------------------------
     2) AKILLI TEKRAR QUIZ — bu bölümün cümlelerinden 4 şıklı mini test
        (çeldiriciler aynı bölüm/modülün diğer cümlelerinden)
  ---------------------------------------------------------------- */
  var quiz = { items:[], idx:0, correct:0 };
  P.reviewQuiz = function(){
    var l=curLesson(); if(!l) return;
    var pool = l.items.slice();
    if (pool.length < 2){ // çeldirici için modül havuzunu kullan
      var m=PATH.byModule[l.module];
      if (m) pool = m.lessonsArr.reduce(function(s,x){ return s.concat(x.items); },[]);
    }
    startQuizFromPool(pool);
  };
  function startQuizFromPool(pool){
    var qs = shuffle(pool).slice(0, Math.min(8,pool.length)).filter(function(it){return it.tr;});
    if (!qs.length){ if(window.showToast)window.showToast('Tekrar','Çeviri verisi yok'); return; }
    quiz={ items:qs, idx:0, correct:0, pool:pool };
    view.level='quiz'; renderQuiz();
  }
  P._quizFromPool = function(pool){ startQuizFromPool(pool); };


  function renderQuiz(){
    var sc=document.getElementById('sc-path'); if(!sc) return;
    if (quiz.idx>=quiz.items.length) return renderQuizResult();
    var q=quiz.items[quiz.idx];
    // 1 doğru + 3 çeldirici Türkçe çeviri
    var others = shuffle(quiz.pool.filter(function(it){ return it.id!==q.id && it.tr && it.tr!==q.tr; }))
      .slice(0,3).map(function(it){ return it.tr; });
    var opts = shuffle([q.tr].concat(others));
    var l=curLesson();
    sc.innerHTML =
      '<div class="wp-top"><button class="wp-back" onclick="WMPath.go({level:\'complete\'})">←</button>'
      +'<div style="flex:1"><div class="wp-eyebrow" style="color:#a5b4fc">AKILLI TEKRAR</div>'
      +'<div style="font-size:16px;font-weight:900;color:#f8fafc">Soru '+(quiz.idx+1)+' / '+quiz.items.length+'</div></div></div>'
      +'<div class="wp-lesson">'
        +'<div class="wp-progress-mini"><div class="bar"><i style="width:'+Math.round((quiz.idx)/quiz.items.length*100)+'%"></i></div>'
          +'<span class="lbl">'+quiz.correct+' doğru</span></div>'
        +'<div class="wp-quiz-q">'+esc(q.en)+'</div>'
        +'<div class="wp-quiz-hint">Doğru Türkçe karşılığı seç</div>'
        +'<div class="wp-quiz-opts" id="wpQuizOpts">'
          +opts.map(function(o){ return '<button class="wp-quiz-opt" data-tr="'+esc(o)+'" onclick="WMPath.quizAnswer(this)">'+esc(o)+'</button>'; }).join('')
        +'</div>'
      +'</div>';
    // soruyu sesli oku
    try{ if(typeof window.speak==='function') window.speak(q.en,'en-US'); }catch(e){}
  }

  P.quizAnswer = function(btn){
    var q=quiz.items[quiz.idx];
    var chosen=btn.getAttribute('data-tr');
    var correct = (chosen===q.tr);
    var opts=document.getElementById('wpQuizOpts');
    if(opts) opts.querySelectorAll('.wp-quiz-opt').forEach(function(b){
      b.disabled=true;
      if(b.getAttribute('data-tr')===q.tr) b.classList.add('ok');
      else if(b===btn) b.classList.add('no');
    });
    if(correct){ quiz.correct++; try{ if(window.updateSRS&&q.word)window.updateSRS(q.word,true); }catch(e){} }
    else { try{ if(window.updateSRS&&q.word)window.updateSRS(q.word,false); }catch(e){} }
    setTimeout(function(){ quiz.idx++; renderQuiz(); }, 850);
  };

  function renderQuizResult(){
    var sc=document.getElementById('sc-path'); if(!sc) return;
    var pct=Math.round(quiz.correct/quiz.items.length*100);
    var msg = pct>=80?'Harika! 🌟':pct>=50?'İyi gidiyor 👍':'Tekrar çalışmaya değer 💪';
    try{ if(window.addXP) window.addXP(quiz.correct*3,'Tekrar testi'); }catch(e){}
    var l=curLesson();
    sc.innerHTML =
      '<div class="wp-top"><button class="wp-back" onclick="WMPath.go({level:\'complete\'})">←</button>'
      +'<div style="flex:1"><div class="wp-eyebrow" style="color:#86efac">SONUÇ</div>'
      +'<div style="font-size:16px;font-weight:900;color:#f8fafc">Akıllı Tekrar</div></div></div>'
      +'<div class="wp-lesson"><div class="wp-complete-hero">'
        +'<div class="wp-burst">'+(pct>=80?'🏆':pct>=50?'✨':'📚')+'</div>'
        +'<div class="wp-complete-title">'+quiz.correct+' / '+quiz.items.length+' doğru</div>'
        +'<div class="wp-complete-sub">'+msg+' · %'+pct+'</div>'
      +'</div>'
      +'<button class="wp-act know full" style="margin-top:16px" onclick="WMPath.reviewQuiz()">🔁 Tekrar dene</button>'
      +'<button class="wp-act ghost full" style="margin-top:10px" onclick="WMPath.go({level:\'parts\',moduleId:'+JSON.stringify(l?l.module:'').replace(/"/g,'&quot;')+'})">Bölümlere dön</button>'
      +'</div>';
  }

  /* ----------------------------------------------------------------
     3) KONUŞMA KÖPRÜSÜ — modül konusuyla senaryo pratiği
        Mevcut startCustomScenario / switchTab('conversation') kullanır
  ---------------------------------------------------------------- */
  P.practiceScenario = function(){
    var l=curLesson(); if(!l) return;
    // seviyeyi inline hesapla (Part 5'e bağımlı olmadan)
    var lvRaw=(l.items[0]&&l.items[0].level)||l.level||'A1';
    var cefr=(String(lvRaw).toUpperCase().match(/[ABC][12]/)||['A1'])[0];
    var story=(cefr==='A1'||cefr==='A2')?'beginner':(cefr==='B1'||cefr==='B2')?'intermediate':'advanced';
    var topic = l.module.replace(/^A\d-M\d+\s*/,'');
    var sample = l.items.slice(0,4).map(function(it){return it.en;}).join(' ');
    var rolePrompt = 'You are a friendly English tutor. Practice a short, simple conversation '
      +'focused on this grammar topic: "'+topic+'". Use '+cefr+'-level English. '
      +'Example sentences from the lesson: '+sample+' Ask one short question at a time.';
    // konuşma seviyesini modüle göre ayarla
    try { if(typeof window.setConvLevel==='function') window.setConvLevel(story); else window.convLevel=story; } catch(e){}
    var opened=false;
    try {
      try{document.body.classList.remove('wm-path-active');}catch(e){}
      if (typeof window.openConversationSim==='function'){ window.openConversationSim(); opened=true; }
      else if (typeof window.openConversationPartner==='function'){ window.openConversationPartner(); opened=true; }
      if(opened && typeof window.__WM_hookBackToPath==='function'){
        window.__WM_hookBackToPath('sc-conversation', window.__WM_pathReturnView ? window.__WM_pathReturnView() : null);
      }
    } catch(e){}
    setTimeout(function(){
      try {
        try { if(typeof window.setConvLevel==='function') window.setConvLevel(story); else window.convLevel=story; } catch(e){}
        if (typeof window.startCustomScenario==='function'){ window.startCustomScenario(rolePrompt); }
        else if (typeof window.startScenarioWithRole==='function'){ window.startScenarioWithRole('🎭 '+topic, rolePrompt); }
        else if (!opened && window.showToast){ window.showToast('Konuşma','Konuşma modu bulunamadı'); }
        else if (window.showToast){ window.showToast('💬 Konuşma', cefr+' · '+topic); }
      } catch(e){ if(window.showToast) window.showToast('Konuşma','Başlatılamadı'); }
    }, opened?350:0);
  };

  /* ----------------------------------------------------------------
     CSS — yeni parçalar (tamamlanma, quiz)
  ---------------------------------------------------------------- */
  function injectPlusCSS(){
    if (document.getElementById('wm-path-plus-css')) return;
    var st=document.createElement('style'); st.id='wm-path-plus-css';
    st.textContent = `
    #sc-path .wp-complete-hero{ text-align:center; padding:24px 16px 8px; }
    #sc-path .wp-burst{ font-size:64px; line-height:1; animation:wpPop .6s cubic-bezier(.2,1.4,.4,1) both; }
    @keyframes wpPop{ 0%{transform:scale(0) rotate(-20deg);opacity:0} 100%{transform:scale(1) rotate(0);opacity:1} }
    #sc-path .wp-complete-title{ font-size:23px; font-weight:900; color:#f8fafc; margin-top:10px; letter-spacing:-.4px; }
    #sc-path .wp-complete-sub{ font-size:13px; color:#94a3b8; margin-top:5px; font-weight:600; }
    #sc-path .wp-quiz-q{ font-size:24px; font-weight:900; color:#fff; text-align:center; padding:26px 14px;
      background:linear-gradient(150deg,#1e2742,#0f1626); border:1px solid rgba(255,255,255,.1);
      border-radius:20px; margin-top:6px; letter-spacing:-.3px; box-shadow:0 14px 34px rgba(0,0,0,.4); }
    #sc-path .wp-quiz-hint{ text-align:center; font-size:12px; color:#94a3b8; margin:12px 0; font-weight:700; }
    #sc-path .wp-quiz-opts{ display:flex; flex-direction:column; gap:10px; }
    #sc-path .wp-quiz-opt{ padding:12px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.05); color:#e2e8f0; font-family:'Nunito',sans-serif; font-size:15px;
      font-weight:700; cursor:pointer; text-align:left; transition:transform .12s, background .2s, border-color .2s; }
    #sc-path .wp-quiz-opt:hover{ border-color:rgba(139,92,246,.5); background:rgba(139,92,246,.1); }
    #sc-path .wp-quiz-opt:active{ transform:scale(.98); }
    #sc-path .wp-quiz-opt.ok{ background:linear-gradient(135deg,#16a34a,#22c55e); color:#fff; border-color:transparent; }
    #sc-path .wp-quiz-opt.no{ background:linear-gradient(135deg,#dc2626,#ef4444); color:#fff; border-color:transparent; }
    `;
    document.head.appendChild(st);
  }
  injectPlusCSS();
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', injectPlusCSS);
})();

/* ════════════════════════════════════════════════════════════════════════
   PART 4 — Öğrenme yoluna ÖZEL Excel yükleyici (Module/Part farkında)
   WordMode'un mevcut listesinden bağımsız. window.XLSX zaten yüklü.
   ──────────────────────────────────────────────────────────────────────── */
(function WMLearningPathExcel(){
  'use strict';
  var I = window.__WM_PATH_INTERNAL__; if (!I) return;
  var P = window.WMPath;

  // sütun adı eşleme (büyük/küçük/boşluk duyarsız)
  function pick(map, names){
    for (var i=0;i<names.length;i++){
      var k=names[i].toLowerCase().replace(/\s+/g,'');
      if (k in map) return map[k];
    }
    return null;
  }

  /* ---- içerik sınıflandırıcıları (kaymış/encoding-bozuk Excel için sigorta) ---- */
  function isIPA(s){ return /[ɪæʊəɜːɑɔʃʒθðŋ]/.test(s) || /É™|Éª|ÊŠ|Ëˆ|Ã¦|ÉœË|ÊŒ|ÊƒiË/.test(s) || /^\s*\/.+\/\s*$/.test(s); }
  function hasTR(s){ return /[çşğıöüÇŞĞİÖÜ]/.test(s) || /Ã§|ÅŸ|ÄŸ|Ä±|Ã¶|Ã¼|Ã–|Ã‡|Ä°/.test(s); }
  function isFullSentence(s){ s=s.trim(); return /^["'A-ZİĞÜŞÖÇ].*[.?!]["']?$/.test(s) && s.split(/\s+/).length>=2; }
  function isListLike(s){ return /,/.test(s) && !/[.?!]["']?\s*$/.test(s.trim()); }
  function looksPronun(s){ return /\b(veyk|hev|tu|yu|fayn|minit|gat|vi|didÄ±nt|Ä±)\b/.test(s) && !hasTR(s.replace(/Ä±/g,'')); }
  function enScore(s){ if(!s)return -99; s=s.trim(); if(isIPA(s))return -99; if(looksPronun(s))return -50;
    var sc=0; if(isFullSentence(s))sc+=5; else sc-=3; if(isListLike(s))sc-=6;
    sc+=(s.match(/\b(I|you|he|she|it|we|they|am|is|are|was|were|have|has|had|the|to|do|does|did|not|got|will|can|a|an)\b/g)||[]).length;
    if(hasTR(s))sc-=8; return sc; }
  function trScore(s){ if(!s)return -99; s=s.trim(); if(isIPA(s))return -99; if(looksPronun(s))return -50;
    var sc=0; if(isFullSentence(s))sc+=4; else sc-=2; if(isListLike(s))sc-=6; if(hasTR(s))sc+=6;
    sc+=(s.match(/\b(bir|ben|sen|var|mı|mi|mu|değil|için|ile|zorunda|mıydın|musun|yok)\b/gi)||[]).length;
    if((s.match(/\b(have|has|had|did|the|you|got)\b/g)||[]).length>2)sc-=5; return sc; }
  /* görsel sahne betimlemesi skoru ("person waking up early", "woman with blue eyes") */
  function imgScore(s){ if(!s)return -99; s=s.trim();
    if(isIPA(s)||hasTR(s))return -99;
    if(/sound$|noise|\.txt$/i.test(s))return -50;                  // ses/dosya adı
    if(/^(relieved|curious|happy|sad|angry|tired|excited|informal|formal|neutral|declarative|high|low|medium|past simple|present|future)$/i.test(s))return -20;
    var sc=0;
    if(/\b(person|people|man|woman|girl|boy|child|someone|group|family|student|worker|kid|couple|house|room|office|street)\b/i.test(s))sc+=5;
    if(/\b(holding|looking|waking|sitting|standing|walking|running|sneezing|reading|writing|eating|drinking|wearing|talking|showing|tapping|shrugging|leaving|with|at|in|on|near)\b/i.test(s))sc+=2;
    var w=s.split(/\s+/).length; if(w>=2&&w<=10)sc+=2;
    if(/[.?!]$/.test(s))sc-=2;                                      // tam cümle = betimleme değil
    return sc; }

  function parseSheet(wb){
    var XLSX = window.XLSX;
    var sh = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(sh, { defval:'', raw:false });
    if (!rows.length) return [];
    var sample = rows[0];
    var keymap = {};
    Object.keys(sample).forEach(function(k){ keymap[String(k).toLowerCase().replace(/\s+/g,'')]=k; });
    var cMod  = pick(keymap,['Module','Modül','Unit']);
    var cPart = pick(keymap,['Part','Bölüm','Section']);
    var cStage= pick(keymap,['LearningStage','Stage','Aşama']);
    var cOrd  = pick(keymap,['OrderIndex','Order','Sıra','Index']);
    var cEN   = pick(keymap,['SentenceEN','Sentence','EN','İngilizce','English']);
    var cTR   = pick(keymap,['SentenceTR','SentenceTr','TR','Türkçe','Turkish','Translation']);
    var cGr   = pick(keymap,['GrammarStructure','Grammar','Gramer']);
    var cLv   = pick(keymap,['Level','SentenceLevel','CEFR','Seviye']);
    var cTopic= pick(keymap,['Topic','Konu']);
    var cWord = pick(keymap,['Word','Kelime']);
    var cId   = pick(keymap,['ID','Id']);
    var cPron = pick(keymap,['TRPronunciation','TrPronunciation','Pronunciation','Okunus','Okunuş','TROkunus']);
    var allKeys = Object.keys(sample);

    // her satırda: başlıktaki EN/TR doğru mu? değilse içerikten bul (kayma sigortası)
    function resolveENTR(r){
      var hEN = cEN!=null ? String(r[cEN]||'').trim() : '';
      var hTR = cTR!=null ? String(r[cTR]||'').trim() : '';
      // başlık değerleri güvenilir mi?
      var enOK = hEN && enScore(hEN)>=3 && !hasTR(hEN);
      var trOK = hTR && trScore(hTR)>=3;
      if (enOK && trOK) return { en:hEN, tr:hTR };
      // değilse: satırdaki TÜM hücreler içinden içerikle seç
      var cells = allKeys.map(function(k){ return { k:k, v:String(r[k]||'').trim() }; })
                         .filter(function(c){ return c.v.length>2; });
      var en=hEN, tr=hTR, se=enOK?enScore(hEN):-99, st=trOK?trScore(hTR):-99;
      cells.forEach(function(c){ var e=enScore(c.v); if(e>se){ se=e; en=c.v; } });
      cells.forEach(function(c){ if(c.v===en) return; var t=trScore(c.v); if(t>st){ st=t; tr=c.v; } });
      return { en:en, tr:tr };
    }

    // satırdaki hücrelerden en iyi GÖRSEL betimlemesini bul (yoksa '')
    function resolveImage(r){
      var best='', bs=4;  // eşik: 5+ güçlü, 4 kabul
      allKeys.forEach(function(k){
        var v=String(r[k]||'').trim(); if(v.length<3) return;
        var s=imgScore(v); if(s>bs){ bs=s; best=v; }
      });
      return best;
    }

    var out = [];
    rows.forEach(function(r, idx){
      var et = resolveENTR(r);
      var en = et.en;
      if (!en) return;
      out.push({
        id: (cId!=null && r[cId]!=='') ? String(r[cId]) : ('X'+idx),
        module: cMod!=null ? String(r[cMod]||'').trim() : '',
        part:   cPart!=null ? String(r[cPart]||'').trim() : 'P1',
        stage:  cStage!=null ? String(r[cStage]||'').trim() : '',
        order:  cOrd!=null ? (parseFloat(r[cOrd])||idx) : idx,
        sentence: en,
        sentenceTr: et.tr,
        trPron: cPron!=null ? String(r[cPron]||'').trim() : '',
        imagePrompt: resolveImage(r),
        grammarStructure: cGr!=null ? String(r[cGr]||'').trim() : '',
        level:  cLv!=null ? String(r[cLv]||'').trim() : 'A1',
        topic:  cTopic!=null ? String(r[cTopic]||'').trim() : '',
        word:   cWord!=null ? String(r[cWord]||'').trim() : ''
      });
    });
    return out;
  }

  /* GitHub'daki TumData_temiz.xlsx'i OTOMATİK yükle (veri yoksa).
     Kullanıcı sonra kendi Excel'ini "Excel Yükle" ile değiştirebilir. */
  P.autoLoadGitHub = function(cb){
    if (typeof window.XLSX==='undefined'){ if(cb)cb(false); return; }
    var candidates = ['data/TumData_Temiz.xlsx','data/TumData_temiz.xlsx','TumData_Temiz.xlsx','TumData_temiz.xlsx','./TumData_Temiz.xlsx','data/TumData_temiz1.xlsx'];
    var idx=0;
    function tryNext(){
      if(idx>=candidates.length){ if(cb)cb(false); return; }
      var url=candidates[idx++];
      fetch(url).then(function(r){ if(!r.ok) throw new Error('yok'); return r.arrayBuffer(); })
        .then(function(buf){
          var wb=window.XLSX.read(new Uint8Array(buf),{type:'array'});
          var rows=parseSheet(wb);
          if(!rows.length) throw new Error('boş');
          window.__WM_PATH_DATA__=rows;
          // BÜYÜK VERİ → IndexedDB (localStorage 5MB'ı aşar). Küçükse localStorage'a da yaz.
          if(window.WMStore){ window.WMStore.set('wmPathData', rows).catch(function(){}); }
          try{ localStorage.setItem('wmPathData', JSON.stringify(rows)); }catch(e){
            try{ localStorage.removeItem('wmPathData'); }catch(_){}  // bayat küçük kopya kalmasın
          }
          try{ I.buildTree(true); }catch(e){}
          if(window.showToast) window.showToast('✅ Otomatik veri', I.PATH.tree.length+' modül yüklendi');
          if(cb) cb(true);
        })
        .catch(function(){ tryNext(); });
    }
    tryNext();
  };

  P.pickExcel = function(){
    var inp = document.getElementById('wpExcelInput');
    if (!inp){ // ekranda yoksa geçici oluştur
      inp = document.createElement('input'); inp.type='file';
      inp.accept='.xlsx,.xls,.xlsm'; inp.style.display='none';
      document.body.appendChild(inp);
    }
    inp.onchange = function(e){
      var f = e.target.files && e.target.files[0]; if(!f) return;
      if (typeof window.XLSX==='undefined'){
        if(window.showToast) window.showToast('Hata','Excel kütüphanesi yüklenemedi'); return;
      }
      if (window.showToast) window.showToast('📄 Excel', 'Okunuyor: '+f.name);
      var rd = new FileReader();
      rd.onload = function(ev){
        try {
          var data = new Uint8Array(ev.target.result);
          var wb = window.XLSX.read(data, { type:'array' });
          var rows = parseSheet(wb);
          if (!rows.length){ if(window.showToast)window.showToast('Excel','Cümle bulunamadı'); return; }
          window.__WM_PATH_DATA__ = rows;
          if(window.WMStore){ window.WMStore.set('wmPathData', rows).catch(function(){}); }
          try { localStorage.setItem('wmPathData', JSON.stringify(rows)); } catch(err){
            try{ localStorage.removeItem('wmPathData'); }catch(_){}
          }
          // ağacı yeniden kur + modüller ekranını yenile
          I.buildTree(true);
          var mods = I.PATH.tree.length;
          if (window.showToast) window.showToast('✅ Yüklendi', mods+' modül · '+rows.length+' cümle');
          P.go({ level:'modules' });
        } catch(err){
          console.warn('path excel parse', err);
          if (window.showToast) window.showToast('Hata','Excel okunamadı');
        }
      };
      rd.readAsArrayBuffer(f);
    };
    inp.click();
  };

  // CSS: hero köşesindeki excel butonu
  function css(){
    if (document.getElementById('wm-path-excel-css')) return;
    var st=document.createElement('style'); st.id='wm-path-excel-css';
    st.textContent = `
    #sc-path .wp-hero{ }
    #sc-path .wp-hero-excel{ position:absolute; top:16px; right:16px; z-index:3;
      width:38px; height:38px; border-radius:11px; border:1px solid rgba(255,255,255,.15);
      background:rgba(255,255,255,.08); color:#e2e8f0; font-size:16px; cursor:pointer;
      backdrop-filter:blur(8px); transition:transform .15s, background .2s; }
    #sc-path .wp-hero-excel:hover{ background:rgba(255,255,255,.16); }
    #sc-path .wp-hero-excel:active{ transform:scale(.92); }
    /* üç buton yan yana: Excel(en sağ) · Yedekle · Geri yükle */
    #sc-path .wp-hero-backup{ right:60px; }
    #sc-path .wp-hero-restore{ right:104px; }
    #sc-path .wp-hero-backup:hover{ background:rgba(34,197,94,.22); border-color:rgba(34,197,94,.4); }
    #sc-path .wp-hero-restore:hover{ background:rgba(59,130,246,.22); border-color:rgba(59,130,246,.4); }
    #sc-path .wp-menu-btn{ display:inline-flex; align-items:center; gap:6px; margin-bottom:14px;
      padding:9px 16px; border-radius:12px; border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.06); color:#e2e8f0; font-family:'Nunito',sans-serif;
      font-size:13px; font-weight:800; cursor:pointer; backdrop-filter:blur(8px);
      transition:background .18s, transform .12s; }
    #sc-path .wp-menu-btn:hover{ background:rgba(59,130,246,.2); border-color:rgba(59,130,246,.4); }
    #sc-path .wp-menu-btn:active{ transform:scale(.96); }`;
    document.head.appendChild(st);
  }
  css();
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', css);
})();

/* ════════════════════════════════════════════════════════════════════════
   PART 5 — Pekiştirme aktiviteleri (Shadowing · Hikaye · Podcast · Konuşma)
   Modül bitince büyük ekran; bölüm sonunda küçük öneri.
   Mevcut motorlar: openShadowMode, generateStory, generatePodcast, startCustomScenario
   ──────────────────────────────────────────────────────────────────────── */
(function WMLearningPathReinforce(){
  'use strict';
  var I = window.__WM_PATH_INTERNAL__; if (!I) return;
  var PATH=I.PATH, view=I.view, esc=I.esc;
  var P = window.WMPath;

  function curLesson(){ return I.findLesson(view.lessonId); }
  function curModule(){ var l=curLesson(); return l?PATH.byModule[l.module]:null; }
  function moduleTopic(m){ return (m?m.name:'').replace(/^A\d-M\d+\s*/,''); }
  // modül seviyesini (A1/A2/B1...) aktivite ayarlarına çevir
  function moduleLevel(){
    var m=curModule(), l=curLesson();
    var lv = (m&&m.level) || (l&&l.items[0]&&l.items[0].level) || 'A1';
    lv = String(lv).toUpperCase().match(/[ABC][12]/);
    return lv ? lv[0] : 'A1';
  }
  function levelSettings(){
    var lv=moduleLevel();
    // story: beginner/intermediate/advanced · podcast: A1.. · shadow hızı 0.5-1.5
    var map={
      'A1':{ story:'beginner',     podcast:'A1', speed:0.7 },
      'A2':{ story:'beginner',     podcast:'A2', speed:0.8 },
      'B1':{ story:'intermediate', podcast:'B1', speed:1.0 },
      'B2':{ story:'intermediate', podcast:'B2', speed:1.1 },
      'C1':{ story:'advanced',     podcast:'C1', speed:1.2 },
      'C2':{ story:'advanced',     podcast:'C2', speed:1.3 }
    };
    var s=map[lv]||map['A1']; s.cefr=lv; return s;
  }
  function moduleSentences(m, n){
    if(!m) return [];
    var all=m.lessonsArr.reduce(function(s,l){ return s.concat(l.items); },[]);
    return all.slice(0, n||12);
  }

  /* ---- büyük modül pekiştirme ekranı ---- */
  P.reinforce = function(){
    var m=curModule(); if(!m){ if(window.showToast)window.showToast('Pekiştirme','Modül bulunamadı'); return; }
    var sc=document.getElementById('sc-path'); if(!sc) return;
    view.level='reinforce';
    var topic=moduleTopic(m);
    sc.innerHTML =
      '<div class="wp-top"><button class="wp-back" onclick="WMPath.go({level:\'parts\',moduleId:'+JSON.stringify(m.id).replace(/"/g,'&quot;')+'})">←</button>'
      +'<div style="flex:1"><div class="wp-eyebrow" style="color:#fbbf24">PEKİŞTİRME</div>'
      +'<div style="font-size:17px;font-weight:900;color:#f8fafc">'+esc(m.name)+'</div></div></div>'
      +'<div class="wp-lesson">'
        +'<div class="wp-complete-hero" style="padding-top:8px">'
          +'<div class="wp-burst">🏆</div>'
          +'<div class="wp-complete-title">Modülü bitirdin!</div>'
          +'<div class="wp-complete-sub">Şimdi "'+esc(topic)+'" yapılarını farklı yollarla pekiştir</div>'
        +'</div>'
        +'<div class="wp-reinforce-grid">'
          +reinforceCard('🎧','Shadowing','Cümleleri gölgeleyerek tekrarla','WMPath.practiceShadow()')
          +reinforceCard('📖','Hikaye','Bu konuda AI hikaye oku','WMPath.practiceStory()')
          +reinforceCard('🎙️','Podcast','Bu konuda AI podcast dinle','WMPath.practicePodcast()')
          +reinforceCard('💬','Konuşma','Bu konuda sohbet et','WMPath.practiceScenario()')
          +reinforceCard('🧠','AI Mini-ders','Tüm gramer yapılarının özeti','WMPath.moduleSummary()')
          +reinforceCard('🔁','Karışık tekrar','Tüm modülden test','WMPath.reviewQuizModule()')
        +'</div>'
        +'<div id="wpReinforceBox"></div>'
      +'</div>';
  };
  function reinforceCard(icon,title,desc,onclick){
    return '<button class="wp-rcard" onclick="'+onclick+'">'
      +'<div class="wp-rcard-ico">'+icon+'</div>'
      +'<div class="wp-rcard-t">'+title+'</div>'
      +'<div class="wp-rcard-d">'+desc+'</div>'
      +'</button>';
  }

  /* ---- Shadowing köprüsü ---- */
  // bu modülün (yoksa bu dersin) cümlelerini havuz olarak al
  function activitySentences(){
    var m=curModule(); var l=curLesson();
    var pool=[];
    if(m){ pool=m.lessonsArr.reduce(function(s,x){ return s.concat(x.items); },[]); }
    else if(l){ pool=l.items.slice(); }
    // varsa kullanıcının "benzer cümle" üretimleri en başa
    if(Array.isArray(window.__WM_PATH_EXTRA__)&&window.__WM_PATH_EXTRA__.length)
      pool=window.__WM_PATH_EXTRA__.concat(pool);
    return pool.filter(function(it){ return it.en; });
  }

  /* Aktivite ekranının ← geri butonunu, learning path'e dönecek şekilde geçici yönlendir.
     Kullanıcı modül akışından geldiyse, çıkınca kelime ekranı yerine modüle döner. */
  function hookBackToPath(screenId, returnView){
    setTimeout(function(){
      try {
        var screen=document.getElementById(screenId); if(!screen) return;
        var back=screen.querySelector('.back-btn'); if(!back) return;
        if(back.getAttribute('data-wm-hooked')==='1') return;   // çift bağlama önle
        var origOnclick=back.getAttribute('onclick');
        back.setAttribute('data-wm-orig', origOnclick||'');
        back.setAttribute('data-wm-hooked','1');
        back.onclick=function(e){
          if(e&&e.preventDefault)e.preventDefault();
          // hook'u temizle (bir sonraki normal kullanım için)
          back.onclick=null; back.removeAttribute('data-wm-hooked');
          if(origOnclick) back.setAttribute('onclick',origOnclick);
          // learning path'e dön
          if(window.WMPath&&typeof window.WMPath.open==='function'){
            window.WMPath.open();
            if(returnView){ try{ window.WMPath.go(returnView); }catch(e2){} }
          }
        };
      } catch(e){}
    }, 360);
  }
  // çıkışta hangi görünüme dönülecek (bölüm ekranı tercih)
  function pathReturnView(){
    var l=curLesson();
    if(l && view && view.lessonId){
      return { level:'lesson', lessonId:view.lessonId, stepIdx:(view.stepIdx||0) };
    }
    if(l) return { level:'parts', moduleId:l.module };
    var m=curModule();
    if(m) return { level:'parts', moduleId:m.id };
    return { level:'modules' };
  }
  window.__WM_hookBackToPath = hookBackToPath;
  window.__WM_pathReturnView = pathReturnView;

  P.practiceShadow = function(){
    var pool=activitySentences();
    var lvs=levelSettings();
    if(typeof window.openShadowMode!=='function'){ if(window.showToast)window.showToast('Shadowing','Bu sürümde yok'); return; }
    // Garantili yöntem: loadShadowPhrases global `words`'ten okuyor.
    // Bu yüzden words'ü geçici olarak modül cümleleriyle değiştirip ekranı açıyoruz,
    // sonra words'ü geri yüklüyoruz (shadowPhrases zaten dolmuş kalır).
    var moduleWords = pool.map(function(it){
      return { sentence:it.en, sentenceTr:it.tr||'', word:it.word||it.en, en:it.en };
    });
    try {
      var backup = window.words;
      if(moduleWords.length){ window.words = moduleWords; }
      try{document.body.classList.remove('wm-path-active');}catch(e){}
      window.openShadowMode();   // showScreen + loadShadowPhrases(words) → shadowPhrases dolar
      hookBackToPath('sc-shadow', pathReturnView());
      // words'ü hemen geri yükle (loadShadowPhrases senkron çalıştı)
      if(moduleWords.length){ window.words = backup; }

      setTimeout(function(){
        // seviyeye göre konuşma hızı
        try {
          var sl=document.getElementById('shadowSpeedSlider');
          if(sl){ sl.value=lvs.speed; }
          if(typeof window.updateShadowSpeed==='function') window.updateShadowSpeed(lvs.speed);
        } catch(e){}
        // ilk cümleyi seç
        try { if(typeof window.selectShadowPhrase==='function') window.selectShadowPhrase(0); } catch(e){}
        if(window.showToast) window.showToast('🎧 Shadowing', lvs.cefr+' · '+moduleWords.length+' cümle · '+lvs.speed+'x');
      }, 200);
    } catch(e){ if(window.showToast)window.showToast('Shadowing','Açılamadı'); }
  };

  /* ---- Hikaye köprüsü ---- */
  P.practiceStory = function(){
    var topic=moduleTopic(curModule()) || (curLesson()&&curLesson().module) || '';
    var lvs=levelSettings();
    if(typeof window.openStoryScreen!=='function'){ if(window.showToast)window.showToast('Hikaye','Bu sürümde yok'); return; }
    try {
      window.selectedStoryLevel=lvs.story;  // global fallback
      try{document.body.classList.remove('wm-path-active');}catch(e){}
      window.openStoryScreen();
      hookBackToPath('sc-story', pathReturnView());
      setTimeout(function(){
        var t=document.getElementById('storyTopic')||document.getElementById('storyPrompt')||document.getElementById('storyInput');
        if(t){ if('value' in t) t.value=topic; else t.textContent=topic; }
        try {
          window.selectedStoryLevel=lvs.story;
          if(typeof window.setStoryLevel==='function'){
            var btn=document.querySelector('[data-story-level="'+lvs.story+'"]');
            if(btn) window.setStoryLevel(lvs.story);
          }
        } catch(e){}
        // seviye ayarlandıktan sonra hikayeyi OTOMATİK üret
        try {
          if(typeof window.generateStory==='function'){
            if(window.showToast) window.showToast('📖 Hikaye', lvs.cefr+' seviyesinde üretiliyor…');
            window.generateStory();
          } else if(window.showToast){ window.showToast('📖 Hikaye', lvs.cefr+' hazır'); }
        } catch(e){ if(window.showToast) window.showToast('📖 Hikaye','Üretici hata, butona basın'); }
      }, 400);
    } catch(e){ if(window.showToast)window.showToast('Hikaye','Açılamadı'); }
  };

  /* ---- Podcast köprüsü ---- */
  P.practicePodcast = function(){
    var topic=moduleTopic(curModule()) || (curLesson()&&curLesson().module) || '';
    var lvs=levelSettings();
    if(typeof window.openPodcastScreen!=='function'){ if(window.showToast)window.showToast('Podcast','Bu sürümde yok'); return; }
    // legacy showScreen('sc-podcast') initPodcastScreen() çağırıyor ama tanımlı değil → stub'la (çökmeyi önle)
    if(typeof window.initPodcastScreen!=='function'){ window.initPodcastScreen=function(){}; }
    try {
      window.selectedPodcastLevel=lvs.podcast;  // global fallback (açılıştan önce)
      try{document.body.classList.remove('wm-path-active');}catch(e){}
      window.openPodcastScreen();
      hookBackToPath('sc-podcast', pathReturnView());
      setTimeout(function(){
        // podcastTopic bir <select> ve sabit option'ları var → modül konusunu en yakın option'a eşle
        var t=document.getElementById('podcastTopic');
        if(t && t.tagName==='SELECT' && t.options && t.options.length){
          var want=(topic||'').toLowerCase();
          var matched=false;
          for(var i=0;i<t.options.length;i++){
            if(t.options[i].text.toLowerCase().indexOf(want)>=0 && want.length>2){ t.selectedIndex=i; matched=true; break; }
          }
          if(!matched) t.selectedIndex=0; // eşleşmezse ilk option (geçerli kalsın, çökme olmasın)
        } else if(t && 'value' in t){ t.value=topic; }
        try {
          window.selectedPodcastLevel=lvs.podcast;
          if(typeof window.setPodcastLevel==='function'){
            var btn=document.querySelector('[data-podcast-level="'+lvs.podcast+'"]');
            if(btn) window.setPodcastLevel(lvs.podcast);
          }
        } catch(e){}
        // seviye + konu hazır → podcast'i OTOMATİK üret
        try {
          if(typeof window.generatePodcast==='function'){
            if(window.showToast) window.showToast('🎙️ Podcast', lvs.cefr+' seviyesinde üretiliyor…');
            window.generatePodcast();
          } else if(window.showToast){ window.showToast('🎙️ Podcast', lvs.cefr+' hazır'); }
        } catch(e){ if(window.showToast) window.showToast('🎙️ Podcast','Üretici hata, butona basın'); }
      }, 400);
    } catch(e){ if(window.showToast)window.showToast('Podcast','Açılamadı'); }
  };

  /* ---- Benzer cümle üret (AI) → aktivite havuzunu besler ---- */
  P.genSimilar = function(){
    var l=curLesson(); if(!l) return;
    var box=document.getElementById('wpSimilarBox'); if(!box) return;
    var it=l.items[view.stepIdx] || l.items[0];
    if(typeof window.callAI!=='function'){ box.innerHTML='<div class="wp-ai-box">AI kullanılamıyor.</div>'; return; }
    box.innerHTML='<div class="wp-ai-box">✨ Benzer cümleler üretiliyor…</div>';
    var topic=(l.grammar||l.module);
    var lv=moduleLevel();
    var sys='You are an English teacher for Turkish '+lv+' learners. Generate NEW example sentences '
      +'using the SAME grammar pattern as the given sentence. Keep them at '+lv+' level. '
      +'Respond ONLY with valid JSON array, no markdown. '
      +'Format: [{"en":"...","tr":"..."}, ...]  exactly 4 items.';
    var usr='Grammar: '+topic+'\nExample sentence: "'+it.en+'" ('+(it.tr||'')+')\n'
      +'Generate 4 new simple sentences with the same structure, each with Turkish translation.';
    Promise.resolve(window.callAI(sys,usr,'explain')).then(function(res){
      var raw=(res&&(res.content||res.text))||res||'';
      raw=String(raw).replace(/```json|```/g,'').trim();
      var m=raw.match(/\[[\s\S]*\]/); if(!m){ box.innerHTML='<div class="wp-ai-box">Üretilemedi.</div>'; return; }
      var arr; try{ arr=JSON.parse(m[0]); }catch(e){ box.innerHTML='<div class="wp-ai-box">Üretilemedi.</div>'; return; }
      if(!Array.isArray(arr)||!arr.length){ box.innerHTML='<div class="wp-ai-box">Üretilemedi.</div>'; return; }
      window.__WM_PATH_EXTRA__ = (window.__WM_PATH_EXTRA__||[]);
      arr.forEach(function(o,i){
        if(o&&o.en) window.__WM_PATH_EXTRA__.unshift({ id:'gen'+Date.now()+i, en:o.en, tr:o.tr||'', word:'', grammar:topic, img:'' });
      });
      var html='<div class="wp-similar-list"><div class="wp-similar-h">✨ Yeni örnekler (aktivitelere eklendi)</div>';
      arr.forEach(function(o){ if(o&&o.en){
        html+='<div class="wp-similar-item"><div class="se">'+esc(o.en)+'</div>'
          +(o.tr?'<div class="st">'+esc(o.tr)+'</div>':'')
          +'<button class="wp-similar-play" onclick="WMPath._say('+JSON.stringify(o.en).replace(/"/g,'&quot;')+')">🔊</button></div>';
      }});
      html+='</div>';
      box.innerHTML=html;
      if(window.showToast) window.showToast('✨ Üretildi', arr.length+' yeni cümle eklendi');
    }).catch(function(){ box.innerHTML='<div class="wp-ai-box">Üretilemedi (AI hatası).</div>'; });
  };
  P._say = function(t){ if(typeof window.speak==='function') window.speak(t,'en-US'); };

  /* ════════ BÖLÜMLE İLGİLİ AI TEST ════════
     AI o bölümün gramerine göre TAZE sorular üretir (çoktan seçmeli + boşluk doldurma).
     Anında geri bildirim + skor. */
  var aitest = { qs:[], idx:0, correct:0, answered:false };
  P.aiTest = function(){
    var l=curLesson(); if(!l) return;
    var sc=document.getElementById('sc-path'); if(!sc) return;
    if(typeof window.callAI!=='function'){ if(window.showToast)window.showToast('AI Test','AI kullanılamıyor'); return; }
    view.level='aitest';
    sc.innerHTML =
      '<div class="wp-top"><button class="wp-back" onclick="WMPath.go({level:\'lesson\',lessonId:'+JSON.stringify(l.id).replace(/"/g,'&quot;')+',stepIdx:'+view.stepIdx+'})">←</button>'
      +'<div style="flex:1"><div class="wp-eyebrow" style="color:#fbbf24">AI TEST</div>'
      +'<div style="font-size:16px;font-weight:900;color:#f8fafc">'+esc(l.module)+' · '+esc(l.part)+'</div></div></div>'
      +'<div class="wp-lesson"><div class="wp-ai-box">📝 Sorular hazırlanıyor…</div></div>';
    // AI'dan soru üret
    var samples=l.items.slice(0,6).map(function(it){ return it.en+' = '+(it.tr||''); }).join('\n');
    var topic=l.grammar||l.module;
    var lv=moduleLevel();
    var sys='You are an English test generator for Turkish '+lv+' learners. '
      +'Create exactly 5 multiple-choice questions testing this grammar topic at '+lv+' level. '
      +'Mix types: fill-in-the-blank and choose-correct-form. Each has 4 options, one correct. '
      +'Questions in English, but you may use Turkish hints. '
      +'Respond ONLY with valid JSON, no markdown. Format: '
      +'[{"q":"question text","options":["a","b","c","d"],"answer":0,"explain":"kısa Türkçe açıklama"}]';
    var usr='Grammar topic: '+topic+'\nExample sentences from this lesson:\n'+samples
      +'\n\nGenerate 5 questions testing THIS grammar. answer = index (0-3) of correct option.';
    Promise.resolve(window.callAI(sys,usr,'explain')).then(function(res){
      var raw=(res&&(res.content||res.text))||res||'';
      raw=String(raw).replace(/```json|```/g,'').trim();
      var m=raw.match(/\[[\s\S]*\]/);
      var arr=null; if(m){ try{ arr=JSON.parse(m[0]); }catch(e){} }
      if(!arr||!arr.length){ renderAiTestError(l); return; }
      // doğrula/temizle
      aitest={ qs:arr.filter(function(q){ return q&&q.q&&Array.isArray(q.options)&&q.options.length>=2; }),
               idx:0, correct:0, answered:false };
      if(!aitest.qs.length){ renderAiTestError(l); return; }
      renderAiTest();
    }).catch(function(){ renderAiTestError(l); });
  };

  function renderAiTestError(l){
    var sc=document.getElementById('sc-path'); if(!sc) return;
    sc.querySelector('.wp-lesson').innerHTML=
      '<div class="wp-ai-box">Sorular üretilemedi (AI hatası). Tekrar dene.</div>'
      +'<button class="wp-act ai full" style="margin-top:12px" onclick="WMPath.aiTest()">🔄 Tekrar dene</button>'
      +'<button class="wp-act ghost full" style="margin-top:8px" onclick="WMPath.go({level:\'lesson\',lessonId:'+JSON.stringify(l.id).replace(/"/g,'&quot;')+',stepIdx:'+view.stepIdx+'})">Derse dön</button>';
  }

  function renderAiTest(){
    var sc=document.getElementById('sc-path'); if(!sc) return;
    if(aitest.idx>=aitest.qs.length) return renderAiTestResult();
    var q=aitest.qs[aitest.idx];
    aitest.answered=false;
    var body=sc.querySelector('.wp-lesson')||sc;
    var html='<div class="wp-progress-mini"><div class="bar"><i style="width:'+Math.round(aitest.idx/aitest.qs.length*100)+'%"></i></div>'
      +'<span class="lbl">Soru '+(aitest.idx+1)+' / '+aitest.qs.length+' · '+aitest.correct+' doğru</span></div>'
      +'<div class="wp-quiz-q">'+esc(q.q)+'</div>'
      +'<div class="wp-quiz-opts" id="wpAiOpts">'
      + q.options.map(function(o,i){ return '<button class="wp-quiz-opt" data-i="'+i+'" onclick="WMPath._aiAnswer('+i+')">'+esc(o)+'</button>'; }).join('')
      +'</div>'
      +'<div id="wpAiExplain"></div>';
    if(sc.querySelector('.wp-lesson')) sc.querySelector('.wp-lesson').innerHTML=html;
    else { var d=document.createElement('div'); d.className='wp-lesson'; d.innerHTML=html; sc.appendChild(d); }
  }

  P._aiAnswer = function(i){
    if(aitest.answered) return; aitest.answered=true;
    var q=aitest.qs[aitest.idx];
    var correct=(i===q.answer);
    var opts=document.getElementById('wpAiOpts');
    if(opts) opts.querySelectorAll('.wp-quiz-opt').forEach(function(b){
      b.disabled=true;
      var bi=+b.getAttribute('data-i');
      if(bi===q.answer) b.classList.add('ok');
      else if(bi===i) b.classList.add('no');
    });
    if(correct){ aitest.correct++; }
    var ex=document.getElementById('wpAiExplain');
    if(ex){ ex.innerHTML='<div class="wp-ai-box" style="margin-top:12px">'
      +(correct?'✅ Doğru! ':'❌ Yanlış. ')+(q.explain?esc(q.explain):'')
      +'<button class="wp-act ghost full" style="margin-top:10px" onclick="WMPath._aiNext()">'
      +(aitest.idx<aitest.qs.length-1?'Sonraki soru →':'Sonucu gör →')+'</button></div>'; }
  };
  P._aiNext = function(){ aitest.idx++; renderAiTest(); };

  function renderAiTestResult(){
    var sc=document.getElementById('sc-path'); if(!sc) return;
    var l=curLesson();
    var pct=Math.round(aitest.correct/aitest.qs.length*100);
    var msg=pct>=80?'Harika! 🌟':pct>=50?'İyi gidiyor 👍':'Tekrar çalışmaya değer 💪';
    try{ if(window.addXP) window.addXP(aitest.correct*4,'AI Test'); }catch(e){}
    var html='<div class="wp-complete-hero"><div class="wp-burst">'+(pct>=80?'🏆':pct>=50?'✨':'📚')+'</div>'
      +'<div class="wp-complete-title">'+aitest.correct+' / '+aitest.qs.length+' doğru</div>'
      +'<div class="wp-complete-sub">'+msg+' · %'+pct+'</div></div>'
      +'<button class="wp-act ai full" style="margin-top:16px" onclick="WMPath.aiTest()">🔄 Yeni AI Test</button>'
      +'<button class="wp-act ghost full" style="margin-top:8px" onclick="WMPath.go({level:\'lesson\',lessonId:'+JSON.stringify(l.id).replace(/"/g,'&quot;')+',stepIdx:'+view.stepIdx+'})">Derse dön</button>';
    if(sc.querySelector('.wp-lesson')) sc.querySelector('.wp-lesson').innerHTML=html;
  }

  /* ---- AI Mini-ders: tüm modül gramer özeti ---- */
  P.moduleSummary = function(){
    var m=curModule(); if(!m) return;
    var box=document.getElementById('wpReinforceBox'); if(!box) return;
    if(typeof window.callAI!=='function'){ box.innerHTML='<div class="wp-ai-box">AI kullanılamıyor.</div>'; return; }
    box.innerHTML='<div class="wp-ai-box">🧠 Modül özeti hazırlanıyor…</div>';
    var grammars={}; var samples=[];
    m.lessonsArr.forEach(function(l){
      if(l.grammar) grammars[l.grammar]=1;
      l.items.slice(0,2).forEach(function(it){ if(samples.length<8) samples.push('- '+it.en); });
    });
    var sys='Sen bir İngilizce öğretmenisin. Türkçe, kısa, madde madde açıkla. HTML kullanma.';
    var usr='Öğrenci "'+m.name+'" modülünü bitirdi. Bu modüldeki gramer yapıları: '
      +Object.keys(grammars).join(', ')+'.\nÖrnek cümleler:\n'+samples.join('\n')
      +'\n\n1) Bu modülün ana kuralını 3-4 cümleyle topla. 2) En sık yapılan 2 hatayı yaz. '
      +'3) Günlük hayatta nasıl kullanılır, 2 ipucu ver. Kısa ve net.';
    Promise.resolve(window.callAI(sys,usr,'context')).then(function(res){
      var txt=(res&&res.content)?res.content:String(res||'');
      box.innerHTML='<div class="wp-ai-box">'+esc(txt)+'</div>';
    }).catch(function(){ box.innerHTML='<div class="wp-ai-box">Özet alınamadı.</div>'; });
  };

  /* ---- tüm modülden karışık tekrar testi ---- */
  P.reviewQuizModule = function(){
    var m=curModule(); if(!m) return;
    // mevcut reviewQuiz, curLesson havuzunu kullanıyor; modül havuzunu geçici ata
    var all=m.lessonsArr.reduce(function(s,l){ return s.concat(l.items); },[]);
    if(typeof P._quizFromPool==='function'){ P._quizFromPool(all); }
  };

  /* CSS */
  function css(){
    if(document.getElementById('wm-path-reinforce-css')) return;
    var st=document.createElement('style'); st.id='wm-path-reinforce-css';
    st.textContent = `
    #sc-path .wp-module-banner{ margin:14px 0 4px; padding:14px 16px; border-radius:14px; cursor:pointer;
      background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; font-weight:800; font-size:13px;
      text-align:center; box-shadow:0 10px 26px rgba(245,158,11,.4); animation:wpPop .5s both; }
    #sc-path .wp-module-banner b{ text-decoration:underline; }
    #sc-path .wp-reinforce-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:18px; }
    #sc-path .wp-rcard{ background:linear-gradient(150deg,rgba(30,39,66,.9),rgba(17,24,39,.92));
      border:1px solid rgba(255,255,255,.1); border-radius:18px; padding:16px 14px; cursor:pointer;
      text-align:left; font-family:'Nunito',sans-serif; transition:transform .15s, border-color .2s, box-shadow .2s; }
    #sc-path .wp-rcard:hover{ transform:translateY(-2px); border-color:rgba(245,158,11,.5); box-shadow:0 12px 30px rgba(245,158,11,.18); }
    #sc-path .wp-rcard:active{ transform:scale(.98); }
    #sc-path .wp-rcard-ico{ font-size:28px; margin-bottom:8px; }
    #sc-path .wp-rcard-t{ font-size:15px; font-weight:900; color:#f1f5f9; }
    #sc-path .wp-rcard-d{ font-size:11px; color:#94a3b8; margin-top:3px; font-weight:600; line-height:1.3; }
    #sc-path .wp-mini-gen{ width:100%; margin-top:8px; padding:9px; border-radius:10px; border:none;
      background:linear-gradient(135deg,#8b5cf6,#6366f1); color:#fff; font-family:'Nunito',sans-serif;
      font-size:12px; font-weight:800; cursor:pointer; transition:transform .12s; }
    #sc-path .wp-mini-gen:active{ transform:scale(.97); }
    #sc-path .wp-mini-gen.test{ background:linear-gradient(135deg,#f59e0b,#d97706); margin-top:6px; }
    #sc-path .wp-similar-list{ margin-top:10px; }
    #sc-path .wp-similar-h{ font-size:11px; font-weight:800; color:#a5b4fc; margin-bottom:6px; }
    #sc-path .wp-similar-item{ position:relative; padding:10px 44px 10px 12px; margin-bottom:6px;
      border-radius:10px; background:rgba(139,92,246,.08); border:1px solid rgba(139,92,246,.2); }
    #sc-path .wp-similar-item .se{ font-size:14px; font-weight:700; color:#f1f5f9; line-height:1.4; display:block; }
    #sc-path .wp-similar-item .st{ font-size:12px; color:#94a3b8; margin-top:3px; line-height:1.4; display:block; }
    #sc-path .wp-similar-play{ position:absolute; top:10px; right:10px; background:rgba(59,130,246,.85); border:none; border-radius:8px;
      width:30px; height:30px; cursor:pointer; font-size:13px; color:#fff; }`;
    document.head.appendChild(st);
  }
  css();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', css);
})();
console.log('🗺️ learning-path.js TAMAMLANDI — WMPath:', typeof window.WMPath, '| WMPath.open:', typeof (window.WMPath&&window.WMPath.open));

/* ═══════════════════════════════════════════════════════════════════
   OTOMATİK MODÜL OLUŞTURUCU EKRANI (sc-modgen)
   Konu + seviye → callAI cümle üretir → modül olarak öğrenme yoluna ekler.
   ═══════════════════════════════════════════════════════════════════ */
(function moduleGenerator(){
  'use strict';
  var LEVELS = ['A1','A2','B1','B2','C1','C2'];

  function injectGenCSS(){
    if(document.getElementById('wm-modgen-css')) return;
    var st=document.createElement('style'); st.id='wm-modgen-css';
    st.textContent = `
      #sc-modgen{ padding:0 !important; }
      #sc-modgen .mg-wrap{ max-width:620px; margin:0 auto; padding:18px 16px 40px; }
      #sc-modgen .mg-head{ display:flex; align-items:center; gap:11px; margin-bottom:18px; }
      #sc-modgen .mg-back{ width:40px; height:40px; border-radius:12px; border:none; cursor:pointer;
        background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; font-size:18px; flex-shrink:0; }
      #sc-modgen .mg-h1{ font-size:18px; font-weight:900; color:#f1f5f9; line-height:1.2; }
      #sc-modgen .mg-sub{ font-size:12px; color:#94a3b8; margin-top:2px; }
      #sc-modgen .mg-card{ background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08);
        border-radius:16px; padding:16px; margin-bottom:14px; }
      #sc-modgen .mg-label{ font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase;
        letter-spacing:1.2px; margin-bottom:8px; }
      #sc-modgen .mg-input{ width:100%; box-sizing:border-box; padding:12px 14px; border-radius:12px;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#f1f5f9;
        font-family:'Nunito',sans-serif; font-size:15px; outline:none; }
      #sc-modgen .mg-input:focus{ border-color:rgba(59,130,246,.5); }
      #sc-modgen .mg-levels{ display:grid; grid-template-columns:repeat(6,1fr); gap:6px; }
      #sc-modgen .mg-lvl{ padding:10px 4px; border-radius:11px; border:1px solid rgba(255,255,255,.1);
        background:rgba(255,255,255,.03); color:#cbd5e1; font-family:'Nunito',sans-serif; font-size:13px;
        font-weight:800; cursor:pointer; transition:all .15s; }
      #sc-modgen .mg-lvl.on{ background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; border-color:transparent; }
      #sc-modgen .mg-row{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      #sc-modgen .mg-count{ display:flex; align-items:center; gap:8px; }
      #sc-modgen .mg-count button{ width:34px; height:34px; border-radius:9px; border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.05); color:#e2e8f0; font-size:18px; cursor:pointer; }
      #sc-modgen .mg-count span{ font-size:18px; font-weight:800; color:#f1f5f9; min-width:34px; text-align:center; }
      #sc-modgen .mg-gen{ width:100%; padding:15px; border-radius:14px; border:none; cursor:pointer;
        background:linear-gradient(135deg,#7c3aed,#5b21b6); color:#fff; font-family:'Nunito',sans-serif;
        font-size:16px; font-weight:800; box-shadow:0 8px 22px rgba(124,58,237,.35); transition:filter .15s, transform .12s; }
      #sc-modgen .mg-gen:hover{ filter:brightness(1.08); transform:translateY(-1px); }
      #sc-modgen .mg-gen:disabled{ opacity:.6; cursor:wait; }
      #sc-modgen .mg-status{ text-align:center; font-size:13px; color:#a5b4fc; margin-top:12px; min-height:18px; }
      #sc-modgen .mg-preview{ margin-top:6px; }
      #sc-modgen .mg-prev-item{ padding:11px 13px; margin-bottom:7px; border-radius:11px;
        background:rgba(139,92,246,.07); border:1px solid rgba(139,92,246,.18); }
      #sc-modgen .mg-prev-item .e{ font-size:14px; font-weight:700; color:#f1f5f9; display:block; line-height:1.4; }
      #sc-modgen .mg-prev-item .t{ font-size:12px; color:#94a3b8; margin-top:3px; display:block; line-height:1.4; }
      #sc-modgen .mg-prev-item .p{ font-size:10px; color:#a5b4fc; margin-top:4px; display:block; font-weight:700; letter-spacing:.5px; }
      #sc-modgen .mg-add{ width:100%; padding:14px; border-radius:13px; border:none; cursor:pointer; margin-top:8px;
        background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-family:'Nunito',sans-serif;
        font-size:15px; font-weight:800; box-shadow:0 8px 20px rgba(22,163,74,.3); }
      #sc-modgen .mg-add:disabled{ opacity:.5; }
    `;
    document.head.appendChild(st);
  }

  function ensureGenScreen(){
    var app=document.getElementById('app')||document.body;
    var sc=document.getElementById('sc-modgen');
    if(!sc){
      sc=document.createElement('div');
      sc.className='screen'; sc.id='sc-modgen';
      app.appendChild(sc);
    }
    return sc;
  }

  var state = { level:'A1', count:10, topic:'', rows:null };

  function render(){
    var sc=ensureGenScreen();
    var lvlBtns = LEVELS.map(function(L){
      return '<button class="mg-lvl'+(state.level===L?' on':'')+'" onclick="WMModGen.setLevel(\''+L+'\')">'+L+'</button>';
    }).join('');
    var html = '<div class="mg-wrap">'
      +'<div class="mg-head">'
        +'<button class="mg-back" onclick="WMModGen.close()">←</button>'
        +'<div><div class="mg-h1">✨ Otomatik Modül Oluştur</div>'
        +'<div class="mg-sub">Konu + seviye seç, AI cümleleri üretsin, yola eklensin</div></div>'
      +'</div>'
      +'<div class="mg-card">'
        +'<div class="mg-label">Gramer Konusu</div>'
        +'<input id="mgTopic" class="mg-input" autocomplete="off" '
        +'placeholder="örn: Present Perfect, Passive Voice, Conditionals..." '
        +'value="'+(state.topic||'').replace(/"/g,'&quot;')+'" '
        +'oninput="WMModGen.setTopic(this.value)" '
        +'onkeydown="event.stopPropagation()" onkeyup="event.stopPropagation()" onkeypress="event.stopPropagation()">'
      +'</div>'
      +'<div class="mg-card">'
        +'<div class="mg-row">'
          +'<div><div class="mg-label">Seviye</div><div class="mg-levels">'+lvlBtns+'</div></div>'
        +'</div>'
        +'<div style="margin-top:14px"><div class="mg-label">Cümle Sayısı</div>'
          +'<div class="mg-count">'
            +'<button onclick="WMModGen.dec()">−</button>'
            +'<span id="mgCount">'+state.count+'</span>'
            +'<button onclick="WMModGen.inc()">+</button>'
            +'<span style="font-size:12px;color:#64748b;font-weight:600;margin-left:6px">cümle</span>'
          +'</div>'
        +'</div>'
      +'</div>'
      +'<button class="mg-gen" id="mgGenBtn" onclick="WMModGen.generate()">🚀 Cümleleri Üret</button>'
      +'<div class="mg-status" id="mgStatus"></div>'
      +'<div class="mg-preview" id="mgPreview"></div>'
    +'</div>';
    sc.innerHTML = html;
  }

  function open(){
    injectGenCSS(); ensureGenScreen();
    window.__WM_USER_NAV__ = true;
    render();
    if(typeof window.showScreen==='function'){ try{ window.showScreen('sc-modgen'); }catch(e){} }
    else { document.querySelectorAll('.screen').forEach(function(e){ e.classList.remove('active'); e.style.display='none'; });
      var sc=document.getElementById('sc-modgen'); sc.classList.add('active'); sc.style.display='block'; }
  }
  function close(){
    if(typeof window.showScreen==='function'){ try{ window.showScreen('sc-menu'); }catch(e){} }
  }

  function setLevel(L){ state.level=L; render(); }
  function setTopic(v){ state.topic=v; }
  function inc(){ if(state.count<25){ state.count++; var c=document.getElementById('mgCount'); if(c)c.textContent=state.count; } }
  function dec(){ if(state.count>3){ state.count--; var c=document.getElementById('mgCount'); if(c)c.textContent=state.count; } }

  function setStatus(msg){ var s=document.getElementById('mgStatus'); if(s)s.textContent=msg||''; }

  function generate(){
    var topic=(state.topic||'').trim();
    if(!topic){ setStatus('⚠️ Lütfen bir gramer konusu yaz.'); return; }
    if(typeof window.callAI!=='function'){ setStatus('⚠️ AI şu an kullanılamıyor.'); return; }
    var btn=document.getElementById('mgGenBtn'); if(btn){ btn.disabled=true; }
    setStatus('🧠 AI '+state.count+' cümle üretiyor…');
    document.getElementById('mgPreview').innerHTML='';

    var sys='You are an English curriculum generator. Produce example sentences for a given grammar topic and CEFR level. '
      +'Return ONLY valid JSON, no markdown, no preamble. Format: '
      +'{"pattern":"<short grammar pattern label in English>","items":[{"en":"<English sentence>","tr":"<Turkish translation>"}]}. '
      +'Sentences must clearly demonstrate the grammar topic, be natural, and match the CEFR level difficulty.';
    var usr='Grammar topic: "'+topic+'". CEFR level: '+state.level+'. '
      +'Generate exactly '+state.count+' example sentences. Turkish translations required.';

    Promise.resolve(window.callAI(sys, usr, 'explain')).then(function(res){
      var data=parseAI(res);
      if(!data || !data.items || !data.items.length){ setStatus('⚠️ Üretim başarısız, tekrar dene.'); if(btn)btn.disabled=false; return; }
      state.rows = toRows(topic, state.level, data);
      showPreview(data.pattern, state.rows);
      setStatus('✓ '+state.rows.length+' cümle hazır. Önizleyip yola ekle.');
      if(btn)btn.disabled=false;
    }).catch(function(){ setStatus('⚠️ Hata oluştu, tekrar dene.'); if(btn)btn.disabled=false; });
  }

  function parseAI(res){
    var txt = (typeof res==='string') ? res : (res && (res.text||res.content||res.message)) || '';
    if(typeof txt!=='string') return null;
    txt = txt.replace(/```json/gi,'').replace(/```/g,'').trim();
    var s=txt.indexOf('{'), e=txt.lastIndexOf('}');
    if(s>=0 && e>s) txt=txt.slice(s,e+1);
    try{ return JSON.parse(txt); }catch(_){ return null; }
  }

  function toRows(topic, level, data){
    var moduleName = level+' · '+topic;
    var pattern = data.pattern || topic;
    return data.items.filter(function(it){ return it && it.en; }).map(function(it,i){
      return {
        sentence: String(it.en).trim(),
        sentenceTr: String(it.tr||'').trim(),
        module: moduleName,
        part: 'P1',
        pattern: pattern,
        level: level,
        word: '',
        order: i+1,
        __generated: true
      };
    });
  }

  function showPreview(pattern, rows){
    var box=document.getElementById('mgPreview'); if(!box) return;
    var items = rows.map(function(r){
      return '<div class="mg-prev-item"><span class="e">'+esc(r.sentence)+'</span>'
        +'<span class="t">'+esc(r.sentenceTr)+'</span>'
        +'<span class="p">'+esc(r.pattern)+'</span></div>';
    }).join('');
    box.innerHTML = '<div class="mg-label" style="margin-top:6px">Önizleme ('+rows.length+' cümle)</div>'
      + items
      + '<button class="mg-add" id="mgAddBtn" onclick="WMModGen.addToPath()">✅ Bu modülü öğrenme yoluna ekle</button>';
  }

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* Üretilen satırları kalıcı veriye ekle + ağacı yeniden kur */
  function addToPath(){
    if(!state.rows || !state.rows.length){ setStatus('⚠️ Önce cümle üret.'); return; }
    var addBtn=document.getElementById('mgAddBtn'); if(addBtn)addBtn.disabled=true;
    try{
      var existing = [];
      try{ if(Array.isArray(window.__WM_PATH_DATA__)) existing = window.__WM_PATH_DATA__.slice(); }catch(_){}
      if(!existing.length){
        try{ var pr=localStorage.getItem('wmPathData'); if(pr){ var pa=JSON.parse(pr); if(Array.isArray(pa)) existing=pa; } }catch(_){}
      }
      var merged = existing.concat(state.rows);
      window.__WM_PATH_DATA__ = merged;
      if(window.WMStore){ window.WMStore.set('wmPathData', merged).catch(function(){}); }
      try{ localStorage.setItem('wmPathData', JSON.stringify(merged)); }catch(_){
        try{ localStorage.removeItem('wmPathData'); }catch(__){}
      }
      // ağacı yeniden kur
      if(window.WMPath && typeof window.WMPath.build==='function'){ try{ window.WMPath.build(true); }catch(_){} }
      setStatus('🎉 Modül eklendi! Öğrenme yoluna gidiliyor…');
      if(window.showToast) window.showToast('Modül eklendi', state.rows.length+' cümle yola eklendi');
      setTimeout(function(){
        if(window.WMPath && typeof window.WMPath.open==='function'){ window.WMPath.open(); }
        else close();
      }, 900);
    }catch(e){ setStatus('⚠️ Eklenemedi: '+(e&&e.message||'hata')); if(addBtn)addBtn.disabled=false; }
  }

  window.WMModGen = { open:open, close:close, setLevel:setLevel, setTopic:setTopic,
    inc:inc, dec:dec, generate:generate, addToPath:addToPath };

  /* Ana menüye "Otomatik Modül" giriş butonu ekle */
  function addMenuButton(){
    var menu=document.getElementById('sc-menu');
    if(!menu || document.getElementById('wmModGenBtn')) return;
    var btn=document.createElement('button');
    btn.id='wmModGenBtn'; btn.type='button';
    btn.textContent='✨ Otomatik Modül Oluştur (AI)';
    btn.style.cssText='display:block;width:calc(100% - 32px);max-width:608px;margin:8px auto 4px;padding:14px 18px;'
      +'background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;border-radius:14px;'
      +"font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;cursor:pointer;"
      +'box-shadow:0 6px 18px rgba(124,58,237,.33);';
    btn.onclick=open;
    // yol.html butonunun hemen altına koy (varsa), yoksa başlığın altına
    var yol=document.getElementById('wmYolBtn');
    if(yol && yol.parentElement){ yol.insertAdjacentElement('afterend', btn); }
    else {
      var title=menu.querySelector('h1,h2,p');
      if(title && title.parentElement===menu) title.insertAdjacentElement('afterend', btn);
      else menu.insertBefore(btn, menu.firstChild);
    }
  }
  addMenuButton();
  window.addEventListener('load', function(){ setTimeout(addMenuButton,700); setTimeout(addMenuButton,2000); });
  setTimeout(addMenuButton,1300);
  try{ var mo=new MutationObserver(function(){ if(document.getElementById('sc-menu')) addMenuButton(); });
    mo.observe(document.body,{childList:true,subtree:true}); }catch(e){}
})();

/* ═══════════════════════════════════════════════════════════════════
   LEGACY EKRAN DÜZENLEMELERİ
   3) Canlı Skor Koçu: ayarlardan giriş gizle + kapanınca menüye dön
   4) Kelime ekranı: ilgisiz alt butonları gizle
   5) Aktif liste seçildiğinde görsel geri bildirim
   ═══════════════════════════════════════════════════════════════════ */
(function legacyScreenTweaks(){
  'use strict';

  /* ---- 4) Kelime ekranı (sc-word) alt ilgisiz butonları gizle ---- */
  function hideWordExtras(){
    try{
      // ID'li olanlar
      ['btnNext','btnReview'].forEach(function(id){
        var el=document.getElementById(id); if(el) el.style.setProperty('display','none','important');
      });
      // onclick / metin bazlı
      document.querySelectorAll('#sc-word button, #sc-word [onclick]').forEach(function(b){
        var oc=(b.getAttribute&&b.getAttribute('onclick'))||'';
        var t=(b.textContent||'').replace(/\s+/g,' ').trim();
        if(/openAskAIScreen|askAI/i.test(oc) || /Yapay Zekaya Sor/i.test(t)
           || /nextWord/i.test(oc) || /^Sonraki/i.test(t)
           || /startReviewMode/i.test(oc) || /Kelime Tekrar Bekliyor/i.test(t)){
          b.style.setProperty('display','none','important');
        }
      });
    }catch(e){}
  }

  /* ---- 3) Canlı Skor Koçu ---- */
  function tweakLiveCoach(){
    try{
      // a) Ayarlardaki "Canlı Skor Koçu"na giriş butonunu gizle
      document.querySelectorAll('#sc-settings button, #sc-settings [onclick], #sc-settings a').forEach(function(b){
        var oc=(b.getAttribute&&b.getAttribute('onclick'))||'';
        var t=(b.textContent||'').replace(/\s+/g,' ').trim();
        if(/live[-_]?coach/i.test(oc) || /openLiveCoach|startLiveCoach/i.test(oc)
           || /Canlı Skor Koçu/i.test(t)){
          b.style.setProperty('display','none','important');
        }
      });
      // b) Canlı Skor Koçu ekranındaki "geri" → MENÜYE git (ayarlara değil)
      document.querySelectorAll('#sc-live-coach .back-btn, #sc-live-coach [onclick*="backToSettingsFromLiveCoach"]').forEach(function(b){
        if(b.__wmMenuFix) return; b.__wmMenuFix=true;
        b.onclick=function(e){
          if(e&&e.preventDefault)e.preventDefault();
          try{ if(typeof window.stopLiveCoach==='function') window.stopLiveCoach(); }catch(_){}
          window.__WM_USER_NAV__=true;
          if(typeof window.showScreen==='function'){ try{ window.showScreen('sc-menu'); }catch(_){} }
        };
      });
      // c) backToSettingsFromLiveCoach fonksiyonunu da menüye yönlendir (her ihtimale karşı)
      if(typeof window.backToSettingsFromLiveCoach==='function' && !window.backToSettingsFromLiveCoach.__wmMenuFix){
        var orig=window.backToSettingsFromLiveCoach;
        var w=function(){ try{ if(typeof window.stopLiveCoach==='function') window.stopLiveCoach(); }catch(_){}
          window.__WM_USER_NAV__=true;
          if(typeof window.showScreen==='function'){ try{ window.showScreen('sc-menu'); return; }catch(_){} }
          return orig.apply(this,arguments); };
        w.__wmMenuFix=true;
        try{ window.backToSettingsFromLiveCoach=w; }catch(_){}
      }
    }catch(e){}
  }

  /* ---- 5) Aktif liste seçimi görsel geri bildirim ---- */
  function listFeedback(){
    try{
      // legacy switchToList'i sar — seçim sonrası toast + başlıkta liste adı göster
      if(typeof window.switchToList==='function' && !window.switchToList.__wmFb){
        var orig=window.switchToList;
        var w=function(){
          var r=orig.apply(this,arguments);
          try{
            var name='';
            // aktif liste adını bulmaya çalış (global state / dropdown)
            var dd=document.querySelector('#listDropdown, .list-select, select');
            if(dd && dd.selectedOptions && dd.selectedOptions[0]) name=dd.selectedOptions[0].textContent;
            if(!name && window.activeListName) name=window.activeListName;
            if(window.showToast) window.showToast('✅ Liste seçildi', name||'Aktif liste güncellendi');
            markActiveList(name);
          }catch(_){}
          return r;
        };
        w.__wmFb=true;
        try{ window.switchToList=w; }catch(_){}
      }
    }catch(e){}
  }
  function markActiveList(name){
    try{
      // dropdown başlığına ✓ ekle (varsa)
      var btn=document.querySelector('[onclick*="toggleListMenu"], #listDropdownBtn, .list-dropdown-btn');
      if(btn && name){ btn.setAttribute('title','Aktif: '+name); }
      // liste menüsündeki seçili öğeyi vurgula
      document.querySelectorAll('.list-item, [data-list-id]').forEach(function(li){
        var t=(li.textContent||'').trim();
        if(name && t.indexOf(name)>=0){ li.style.background='rgba(34,197,94,.18)'; li.style.borderRadius='8px'; }
      });
    }catch(_){}
  }

  function runAll(){ hideWordExtras(); tweakLiveCoach(); listFeedback(); }
  if(document.readyState==='complete') runAll();
  else window.addEventListener('load', runAll);
  [600,1500,3000].forEach(function(ms){ setTimeout(runAll, ms); });
  // ekran değişimlerinde tekrar uygula
  try{ var mo=new MutationObserver(function(){ runAll(); });
    mo.observe(document.getElementById('app')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']}); }catch(e){}
})();

/* ═══════════════════════════════════════════════════════════════════
   YEDEKLEMEYE MODÜL YOLU VERİSİNİ DAHİL ET
   Legacy buildBackupData() Modül Yolu'nu (wmPathProgress + wmPathData) içermiyor.
   "Hiçbir şey eksik olmasın" için: yedek yazılırken ekle, geri yüklenirken işle.
   Legacy'ye DOKUNMADAN — sadece global fonksiyonları sarıyoruz.
   ═══════════════════════════════════════════════════════════════════ */
(function backupIncludePathData(){
  'use strict';

  function attachWriteWrap(){
    if(typeof window.buildBackupData!=='function' || window.buildBackupData.__wmPathWrap) return;
    var orig = window.buildBackupData;
    var wrapped = async function(){
      var data = await orig.apply(this, arguments);
      try{
        if(data && typeof data==='object'){
          // 1) Modül Yolu ilerlemesi (localStorage)
          try{
            var prog = localStorage.getItem('wmPathProgress');
            if(prog) data.wmPathProgress = JSON.parse(prog);
          }catch(_){}
          // 2) Modül Yolu Excel verisi — IndexedDB'den (büyük, ~9400 satır)
          try{
            if(window.WMStore){
              var rows = await window.WMStore.get('wmPathData');
              if(Array.isArray(rows) && rows.length) data.wmPathData = rows;
            }
          }catch(_){}
          // 3) localStorage'daki küçük kopya da varsa (fallback)
          if(!data.wmPathData){
            try{ var ls=localStorage.getItem('wmPathData'); if(ls){ var a=JSON.parse(ls); if(Array.isArray(a)&&a.length) data.wmPathData=a; } }catch(_){}
          }
          data.__wmPathIncluded = true;
        }
      }catch(e){}
      return data;
    };
    wrapped.__wmPathWrap = true;
    try{ window.buildBackupData = wrapped; }catch(e){}
  }

  /* Geri yükleme: legacy restore JSON'u localStorage'a yazıp reload ediyor.
     Biz de aynı JSON'dan wmPathProgress + wmPathData'yı geri yazalım.
     autoRestoreFromBackupFolder içindeki JSON.parse'a erişemediğimiz için,
     restore edilen objeyi yakalamak adına JSON.parse'ı geçici izleyemeyiz (riskli).
     Bunun yerine: restore TAMAMLANIP reload olduktan sonra, bir sonraki açılışta
     legacy verisi gelmiş olur; Modül Yolu verisi için ise yedek dosyasını
     DOĞRUDAN okuyup geri yazan kendi geri-yükleyicimizi de sağlıyoruz. */
  window.WMPathBackup = {
    // Bir yedek JSON objesinden Modül Yolu verisini geri yaz
    applyFromBackupObject: function(obj){
      try{
        if(!obj || typeof obj!=='object') return false;
        var did=false;
        if(obj.wmPathProgress){
          try{ localStorage.setItem('wmPathProgress', JSON.stringify(obj.wmPathProgress)); did=true; }catch(_){}
        }
        if(Array.isArray(obj.wmPathData) && obj.wmPathData.length){
          window.__WM_PATH_DATA__ = obj.wmPathData;
          if(window.WMStore){ window.WMStore.set('wmPathData', obj.wmPathData).catch(function(){}); }
          try{ localStorage.setItem('wmPathData', JSON.stringify(obj.wmPathData)); }catch(_){
            try{ localStorage.removeItem('wmPathData'); }catch(__){}
          }
          did=true;
        }
        if(did && window.WMPath && typeof window.WMPath.build==='function'){ try{ window.WMPath.build(true); }catch(_){} }
        return did;
      }catch(e){ return false; }
    }
  };

  /* autoRestoreFromBackupFolder'ı sar: legacy kendi işini yapsın, biz de
     aynı en-yeni yedek dosyasını okuyup Modül Yolu verisini geri yazalım.
     Ayrıca BOZUK yedek korumas\u0131: en yeni bozuksa bir öncekini dene. */
  function attachRestoreWrap(){
    if(typeof window.autoRestoreFromBackupFolder!=='function' || window.autoRestoreFromBackupFolder.__wmPathWrap) return;
    var orig = window.autoRestoreFromBackupFolder;
    var wrapped = async function(){
      // KELİME listesini açılışta YÜKLEME (lazy). Legacy orig'i kelime
      // ekranına girilince çalışsın diye sakla. Modül Yolu verisini ise
      // hemen geri yaz (öğrenme yolu için gerekli, ekran açmaz).
      window.__wmDeferredWordRestore = function(){ try{ return orig.apply(window, []); }catch(e){} };
      // Sonra Modül Yolu verisini en-yeni sağlam yedekten geri yaz
      try{
        var h = window.backupFolderHandle;
        if(h && h.values){
          var files=[];
          for await(const e of h.values()){
            if(e.kind==='file' && e.name.indexOf('word-mode-backup-')===0 && e.name.endsWith('.json')) files.push(e);
          }
          files.sort(function(a,b){ return b.name.localeCompare(a.name); }); // en yeni başta
          // en yeni SAĞLAM yedeği bul
          for(var i=0;i<files.length;i++){
            try{
              var fh=await h.getFileHandle(files[i].name);
              var f=await fh.getFile();
              var txt=await f.text();
              if(!txt || !txt.trim()) continue;       // boş → atla (bozuk yedek koruması)
              var obj=JSON.parse(txt);                 // parse hatası → catch → sonraki dosya
              if(obj && (obj.wmPathProgress || obj.wmPathData)){
                window.WMPathBackup.applyFromBackupObject(obj);
              }
              break; // ilk sağlam yedek yeterli
            }catch(_){ /* bozuk → bir önceki yedeğe geç */ }
          }
        }
      }catch(e){}
      return undefined;
    };
    wrapped.__wmPathWrap = true;
    try{ window.autoRestoreFromBackupFolder = wrapped; }catch(e){}
  }

  function attachAll(){ attachWriteWrap(); attachRestoreWrap(); }
  attachAll();
  // legacy fonksiyonlar sonradan tanımlanabilir → birkaç kez dene
  var n=0, iv=setInterval(function(){
    attachAll(); n++;
    if((window.buildBackupData&&window.buildBackupData.__wmPathWrap &&
        window.autoRestoreFromBackupFolder&&window.autoRestoreFromBackupFolder.__wmPathWrap) || n>40) clearInterval(iv);
  }, 250);
  window.addEventListener('load', attachAll);
})();
