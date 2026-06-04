/* ============================================================
   WORD MODE / SENTENCE MODE FIXES — TEK TEMİZ SÜRÜM
   2026-06-02
   ============================================================ */

(function () {
  'use strict';

  // Legacy'nin zararsız "Cannot set properties of null (setting 'onclick')" hatasını sustur.
  // Bu hata bir aksiyonu engellemiyor; yalnızca konsol gürültüsü yaratıyor.
  window.addEventListener('error', function(ev){
    var msg = ev && ev.message ? String(ev.message) : '';
    if (/setting 'onclick'/.test(msg) && /null/.test(msg)) {
      ev.preventDefault();
      ev.stopImmediatePropagation && ev.stopImmediatePropagation();
      return true;
    }
  }, true);

  // ─── KÖK ÇÖZÜM: Konuşma ekranı binding zinciri kesilmesi ───
  // legacy d() render'ında binding zinciri tek ifadede:
  //   t.querySelector("[data-scenario-select]").onchange=...,
  //   ...,t.querySelector("[data-global-suggest]").onclick=...,
  //   t.querySelector("[data-start-roleplay]").onclick=...
  // [data-global-suggest] template HTML'inde HİÇ render edilmiyor → querySelector null
  // → ".onclick=" TypeError → zincir kopuyor → "Bu Ayarlarla Başlat" (data-start-roleplay)
  // ve sonrası BAĞLANMIYOR (ekran çalışmıyor).
  // Çözüm: panel (.wm-phase-panel) DOM'a binding'den ÖNCE (insertBefore ile) eklendiği için,
  // ekleme anında panel içine gizli bir [data-global-suggest] düğümü enjekte ediyoruz.
  // Böylece bir sonraki satırdaki querySelector null dönmez, legacy'nin KENDİ orijinal
  // handler zinciri (data-start-roleplay dahil) eksiksiz kurulur.
  (function(){
    try{
      function ensureGlobalSuggest(panel){
        try{
          if(!panel || panel.nodeType!==1) return;
          if(!panel.classList || !panel.classList.contains('wm-phase-panel')) return;
          if(panel.querySelector('[data-global-suggest]')) return;
          var ph=document.createElement('span');
          ph.setAttribute('data-global-suggest','');
          ph.setAttribute('aria-hidden','true');
          ph.style.display='none';
          panel.appendChild(ph);
        }catch(e){}
      }
      var proto=Node.prototype;
      if(proto.__wmGlobalSuggestPatched) return;
      proto.__wmGlobalSuggestPatched=true;
      var _insertBefore=proto.insertBefore;
      proto.insertBefore=function(newNode, refNode){
        // önce düğümü yakala (binding henüz çalışmadı), sonra normal ekle
        ensureGlobalSuggest(newNode);
        return _insertBefore.call(this, newNode, refNode);
      };
      var _appendChild=proto.appendChild;
      proto.appendChild=function(newNode){
        ensureGlobalSuggest(newNode);
        return _appendChild.call(this, newNode);
      };
    }catch(e){}
  })();

  // ─── KÖK ÇÖZÜM: Gerçek Hayat Koçu paneli (.wm-phase-panel) yanlış ekran sızıntısı ───
  // legacy d() render'ı paneli, innerText'inde "senaryo"/"scenario"/"gerçek hayat" GEÇEN
  // her .screen/.card/section/div'e basıyor. "senaryo" kelimesi Kelimeler/Cümleler ekranı
  // ve alt menüde de geçtiği için panel YANLIŞ ekranlara sızıyor; ayrıca aynı ekrana
  // birden çok kez basılıp üst üste biniyor (dizayn bozuluyor).
  // Panelin meşru evi yalnızca şu ekranlar: sc-realnew, sc-conversation, sc-partner.
  // Bu guard: yanlış ekrandaki panelleri kaldırır, doğru ekranda fazlalık (>1) panelleri temizler.
  (function(){
    var ALLOWED = { 'sc-realnew':1, 'sc-conversation':1, 'sc-partner':1 };
    function cleanup(){
      try{
        var panels = document.querySelectorAll('.wm-phase-panel');
        if(!panels.length) return;
        var seenScreens = {};
        for(var i=0;i<panels.length;i++){
          var p = panels[i];
          var screen = p.closest ? p.closest('.screen') : null;
          var sid = screen ? screen.id : '';
          if(!sid || !ALLOWED[sid]){
            // yanlış ekrana (ya da ekransız body'ye) sızmış panel → kaldır
            if(p.parentNode) p.parentNode.removeChild(p);
            continue;
          }
          // doğru ekran: ilk panel kalsın, sonrakiler (çift basım) silinsin
          if(seenScreens[sid]){
            if(p.parentNode) p.parentNode.removeChild(p);
          } else {
            seenScreens[sid] = 1;
          }
        }
      }catch(e){}
    }
    function schedule(){ clearTimeout(window.__wmPanelTimer); window.__wmPanelTimer=setTimeout(cleanup, 80); }
    if(document.readyState!=='loading'){ schedule(); }
    document.addEventListener('DOMContentLoaded', schedule);
    try{
      new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
    }catch(e){}
  })();

  // ─── PERFORMANS: legacy body-subtree observer'larını debounce'la ───
  // 14 kadar observer her DOM değişiminde birden tetikleniyordu; kullanım takılıyordu.
  // body/documentElement'i geniş (subtree) gözleyenlerin callback'ini 60ms grupla.
  (function(){
    try{
      var Native = window.MutationObserver || window.WebKitMutationObserver;
      if(!Native || Native.__wmWrapped) return;
      function Wrapped(cb){
        var timer=null, pending=[], broad=false, self;
        function run(obs){ var b=pending; pending=[]; try{ cb(b, obs); }catch(e){} }
        self=new Native(function(records, obs){
          if(!broad){ try{ cb(records, obs); }catch(e){} return; }
          pending=pending.concat(records);
          if(timer) return;
          timer=setTimeout(function(){ timer=null; run(obs); }, 60);
        });
        var origObserve=self.observe.bind(self);
        self.observe=function(target, opts){
          if(opts && opts.subtree && (target===document.body || target===document.documentElement || target===document)) broad=true;
          return origObserve(target, opts);
        };
        return self;
      }
      Wrapped.__wmWrapped=true;
      Wrapped.prototype=Native.prototype;
      window.MutationObserver=Wrapped;
    }catch(e){}
  })();

  function $(id) { return document.getElementById(id); }
  function low(v) { return String(v == null ? '' : v).toLowerCase(); }

  /* GENİŞ ARAMA */
  window.WM_matchesQuery = function (item, q) {
    if (!q) return true;
    if (!item) return false;

    var fields = [
      item.word, item.Kelime, item.targetWord, item.highlight,
      item.sentence, item.Sentence, item.en, item.english,
      item.sentenceTr, item.SentenceTr, item.sentence_tr,
      item.tr, item.translation, item.meaning, item.anlam
    ];

    if (Array.isArray(item.meanings)) fields = fields.concat(item.meanings);

    return fields.some(v => v && low(v).includes(q));
  };

  if (typeof window.renderWordList === 'function' && !window.renderWordList.__wmFixed) {
    const oldRender = window.renderWordList;
    window.renderWordList = function () {
      const r = oldRender.apply(this, arguments);
      try {
        const q = low(window.currentSearchQuery).trim();
        if (q && window.virtualScrollData) {
          const base = typeof window.getFilteredWords === 'function'
            ? window.getFilteredWords()
            : (window.allWords || []);
          window.virtualScrollData.filteredWords = base.filter(x => window.WM_matchesQuery(x, q));
          if (typeof window.updateVisibleItems === 'function') window.updateVisibleItems();
        }
      } catch (e) {}
      return r;
    };
    window.renderWordList.__wmFixed = true;
  }

  window.filterWordsBySentence = function (val) {
    window.currentSearchQuery = low(val).trim();
    try { if (typeof window.renderWordList === 'function') window.renderWordList(); } catch (e) {}
  };

  /* SÖZLÜK POPUP FIX */
  function cleanWord(v) {
    return String(v == null ? '' : v)
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/^[^a-z]+|[^a-z]+$/g, '')
      .trim();
  }

  function candidates(word) {
    const w = cleanWord(word);
    const a = [w];
    if (w.endsWith('ies')) a.push(w.slice(0, -3) + 'y');
    if (w.endsWith('es')) a.push(w.slice(0, -2));
    if (w.endsWith('s')) a.push(w.slice(0, -1));
    if (w.endsWith('ing')) {
      a.push(w.slice(0, -3));
      a.push(w.slice(0, -3) + 'e');
    }
    if (w.endsWith('ed')) {
      a.push(w.slice(0, -2));
      a.push(w.slice(0, -1));
    }
    return [...new Set(a.filter(Boolean))];
  }

  function normalizeRow(row, fallback) {
    if (!row || typeof row !== 'object') return null;

    const word = cleanWord(
      row.Kelime || row.kelime || row.word || row.Word || row.en || row.english || fallback
    );
    if (!word) return null;

    const meanings = [];
    ['tr', 'translation', 'meaning', 'anlam', 'anlam1', 'anlam2', 'anlam3', 'turkish'].forEach(k => {
      if (row[k]) meanings.push(String(row[k]).trim());
    });

    const pron =
      row.tr_pron || row.pron || row.türkçe_okunuş ||
      row.turkce_okunus || row.turkishPronunciation || row.phonetic || '';

    const level = row.cefr || row.CEFR || row.seviye || row.level || '';

    return Object.assign({}, row, {
      word,
      Kelime: row.Kelime || word,
      meanings: [...new Set(meanings.filter(Boolean))],
      tr_pron: pron,
      pron,
      cefr: String(level || '').toUpperCase(),
      level: String(level || '').toUpperCase()
    });
  }

  function buildMap(data) {
    const map = {};
    if (Array.isArray(data)) {
      data.forEach(row => {
        const n = normalizeRow(row);
        if (n) map[n.word] = n;
      });
    } else if (data && typeof data === 'object') {
      Object.keys(data).forEach(k => {
        const n = normalizeRow(data[k], k);
        if (n) map[n.word] = n;
      });
    }
    return map;
  }

  function installDictionary(data, source) {
    const map = buildMap(data);
    if (!Object.keys(map).length) return false;
    window.WM_Dictionary = map;
    window.WM_SOZLUK_MEANING_MAP = Object.assign({}, window.WM_SOZLUK_MEANING_MAP || {}, map);
    console.log('✅ Sözlük map hazır:', Object.keys(map).length, source || '');
    return true;
  }

  var _lookupCache = {};
  // Kullanıcı sözlüğünü (localStorage["wm_user_dictionary"]) okuyup map'e katar.
  // Açılışta ve "Sözlüğe Ekle" sonrası çağrılır; lookup cache temizlenir.
  function mergeUserDict(){
    try{
      var raw = localStorage.getItem('wm_user_dictionary');
      if(!raw) return 0;
      var obj = JSON.parse(raw);
      if(!obj || typeof obj !== 'object' || Array.isArray(obj)) return 0;
      var umap = buildMap(obj);
      var n = Object.keys(umap).length;
      if(!n) return 0;
      // Kullanıcı kayıtları ÖNCELİKLİ olsun (sozluk.json'u ezsin)
      window.WM_Dictionary = Object.assign({}, window.WM_Dictionary || {}, umap);
      window.WM_SOZLUK_MEANING_MAP = Object.assign({}, window.WM_SOZLUK_MEANING_MAP || {}, umap);
      _lookupCache = {}; // eski "bulunamadı" sonuçlarını temizle
      return n;
    }catch(e){ return 0; }
  }
  window.WM_mergeUserDict = mergeUserDict;
  window.WM_clearLookupCache = function(){ _lookupCache = {}; };
  function wmLookupImpl(word){
    var ck = String(word||'').toLowerCase();
    if (_lookupCache[ck] !== undefined) return _lookupCache[ck];
    var result = null;
    var maps = [window.WM_SOZLUK_MEANING_MAP, window.WM_Dictionary];
    for (var i=0;i<maps.length && !result;i++){
      var m = maps[i];
      if (!m || Array.isArray(m)) continue;
      var cs = candidates(word);
      for (var j=0;j<cs.length;j++){
        var hit = m[cs[j]];
        if (!hit) continue;
        var norm = normalizeRow(hit, cs[j]) || hit;
        if (!norm.meanings || !norm.meanings.length){
          var other = (window.WM_SOZLUK_MEANING_MAP||{})[cs[j]] || (window.WM_Dictionary||{})[cs[j]];
          if (other){
            var n2 = normalizeRow(other, cs[j]);
            if (n2 && n2.meanings && n2.meanings.length) norm.meanings = n2.meanings;
            else if (other.meanings && other.meanings.length) norm.meanings = other.meanings;
          }
        }
        if (norm.meanings && norm.meanings.length){ result = norm; break; }
      }
    }
    // sözlük henüz yüklenmediyse cache'leme (sonra dolacak)
    if (result || (window.WM_Dictionary && Object.keys(window.WM_Dictionary).length>500)) _lookupCache[ck] = result;
    return result;
  }
  try {
    Object.defineProperty(window, 'WM_lookupDict', {
      configurable: false, enumerable: true,
      get: function(){ return wmLookupImpl; },
      set: function(){ /* legacy ezmesini yok say */ }
    });
  } catch(e){ window.WM_lookupDict = wmLookupImpl; }

  async function loadDict() {
    // sozluk.json'u her açılışta yükle; hem WM_Dictionary hem WM_SOZLUK_MEANING_MAP'i doldur.
    for (const path of ['data/sozluk.json', 'sozluk.json']) {
      try {
        const r = await fetch(path, { cache: 'force-cache' });
        if (!r.ok) continue;
        const j = await r.json();
        const map = buildMap(j);
        if (!Object.keys(map).length) continue;
        // WM_Dictionary array olarak gelmişse (legacy ham liste atıyor) onu YOK SAY;
        // lookup string anahtar ister. Var olan map'i koru, eksikleri map ile tamamla.
        var prev = window.WM_Dictionary;
        var prevMap = (prev && !Array.isArray(prev) && typeof prev === 'object') ? prev : {};
        window.WM_Dictionary = Object.assign({}, map, prevMap);
        window.WM_SOZLUK_MEANING_MAP = Object.assign({}, map, window.WM_SOZLUK_MEANING_MAP || {});
        var uadd = mergeUserDict(); // kullanıcı eklediği kelimeleri de kat
        console.log('✅ Sözlük map hazır:', Object.keys(map).length, path, '| took:', !!window.WM_Dictionary['took'], uadd?('| kullanıcı:'+uadd):'');
        return;
      } catch (e) {}
    }
  }

  function bootDict(){ loadDict(); setTimeout(loadDict, 1500); setTimeout(loadDict, 4000); }

  /* ════════ GÖRSEL ARAMA v2: hedef kelime + cümledeki isim, 3 kaynak, IndexedDB cache ════════ */
  (function(){
    var STOP = new Set('the a an is are was were be been being have has had do does did will would shall should can could may might must to of in on at by for with and or but not it this that these those they we he she i you your my our their as so very from into about after before all lot much many one two there here'.split(' '));

    // sözlük etiketinden isim mi? ("[i.]" = isim)
    function isNoun(w){
      try{
        var rec = window.WM_lookupDict ? window.WM_lookupDict(w) : null;
        if(rec && rec.meanings) return rec.meanings.some(function(m){ return /\[i\.\]/.test(m); });
      }catch(e){}
      return false;
    }
    // cümleden en iyi ismi seç: sözlükte [i.] etiketli ilk uzun kelime; yoksa en uzun içerik kelimesi
    function pickNoun(sentence, target){
      var words = String(sentence||'').replace(/[^a-zA-Z ]/g,' ').split(/\s+/)
        .map(function(x){ return x.toLowerCase(); })
        .filter(function(x){ return x.length>2 && !STOP.has(x) && x!==String(target||'').toLowerCase(); });
      for(var i=0;i<words.length;i++){ if(isNoun(words[i])) return words[i]; }
      // yedek: en uzun içerik kelimesi
      words.sort(function(a,b){ return b.length-a.length; });
      return words[0] || '';
    }

    function buildTerms(sentence, target){
      var t = cleanWord(target);
      var noun = pickNoun(sentence, t);
      var terms = [];
      if(t && noun && noun!==t) terms.push(t+' '+noun); // hedef + isim
      if(noun) terms.push(noun);                         // sadece isim
      if(t) terms.push(t);                               // hedef kelime
      return terms.filter(Boolean).filter(function(v,i,a){ return a.indexOf(v)===i; });
    }

    // ---- kaynaklar ----
    async function wikiSearch(q){
      try{
        var s=await fetch('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch='+encodeURIComponent(q)+'&srlimit=3');
        var sj=await s.json(); var hits=(sj.query&&sj.query.search)||[];
        for(var k=0;k<hits.length;k++){
          var r=await fetch('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=400&pilimit=1&pageids='+hits[k].pageid);
          var rj=await r.json(); var pages=(rj.query&&rj.query.pages)||{};
          for(var p in pages){ if(pages[p].thumbnail) return pages[p].thumbnail.source; }
        }
      }catch(e){} return null;
    }
    async function openverse(q){
      try{
        var r=await fetch('https://api.openverse.org/v1/images/?q='+encodeURIComponent(q)+'&page_size=3',{headers:{'Accept':'application/json'}});
        if(!r.ok) return null; var j=await r.json(); var f=j.results&&j.results[0];
        return f ? (f.thumbnail||f.url) : null;
      }catch(e){} return null;
    }
    async function commons(q){
      try{
        var r=await fetch('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch='+encodeURIComponent('filetype:bitmap '+q)+'&gsrlimit=3&prop=imageinfo&iiprop=url&iiurlwidth=400');
        var j=await r.json(); var pages=(j.query&&j.query.pages)||{};
        for(var p in pages){ var ii=pages[p].imageinfo&&pages[p].imageinfo[0]; if(ii&&ii.thumburl) return ii.thumburl; }
      }catch(e){} return null;
    }
    var SOURCES=[openverse, commons, wikiSearch];

    // ---- ÇOK ADAY döndüren kaynak varyantları (alternatif seçici için) ----
    async function wikiSearchMany(q){
      var out=[];
      try{
        var s=await fetch('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch='+encodeURIComponent(q)+'&srlimit=5');
        var sj=await s.json(); var hits=(sj.query&&sj.query.search)||[];
        for(var k=0;k<hits.length;k++){
          var r=await fetch('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=400&pilimit=1&pageids='+hits[k].pageid);
          var rj=await r.json(); var pages=(rj.query&&rj.query.pages)||{};
          for(var p in pages){ if(pages[p].thumbnail) out.push(pages[p].thumbnail.source); }
        }
      }catch(e){} return out;
    }
    async function openverseMany(q){
      var out=[];
      try{
        var r=await fetch('https://api.openverse.org/v1/images/?q='+encodeURIComponent(q)+'&page_size=6',{headers:{'Accept':'application/json'}});
        if(r.ok){ var j=await r.json(); (j.results||[]).forEach(function(f){ var u=f.thumbnail||f.url; if(u) out.push(u); }); }
      }catch(e){} return out;
    }
    async function commonsMany(q){
      var out=[];
      try{
        var r=await fetch('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch='+encodeURIComponent('filetype:bitmap '+q)+'&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=400');
        var j=await r.json(); var pages=(j.query&&j.query.pages)||{};
        for(var p in pages){ var ii=pages[p].imageinfo&&pages[p].imageinfo[0]; if(ii&&ii.thumburl) out.push(ii.thumburl); }
      }catch(e){} return out;
    }
    var SOURCES_MANY=[openverseMany, commonsMany, wikiSearchMany];

    // Birden çok aday topla (dedupe, en fazla limit). terms: arama terimleri dizisi.
    async function searchImageMulti(terms, limit){
      limit = limit || 12;
      var seen={}, out=[];
      for(var i=0;i<terms.length && out.length<limit;i++){
        for(var s=0;s<SOURCES_MANY.length && out.length<limit;s++){
          var arr=[]; try{ arr=await SOURCES_MANY[s](terms[i]); }catch(e){}
          for(var k=0;k<arr.length;k++){
            var u=arr[k];
            if(u && !seen[u]){ seen[u]=1; out.push(u); if(out.length>=limit) break; }
          }
        }
      }
      return out;
    }

    async function searchImage(terms){
      for(var i=0;i<terms.length;i++){
        for(var s=0;s<SOURCES.length;s++){
          var url=await SOURCES[s](terms[i]);
          if(url) return url;
        }
      }
      return null;
    }

    // IndexedDB cache (WMStore) + bellek cache
    var mem={};
    function ckey(word, sentence){ return 'wm_img:'+String(word||'')+'|'+String(sentence||'').slice(0,80); }
    async function cacheGet(key){
      if(mem[key]!==undefined) return mem[key];
      try{ if(window.WMStore && WMStore.get){ var v=await WMStore.get(key); if(v!=null){ mem[key]=v; return v; } } }catch(e){}
      return undefined;
    }
    function cacheSet(key, val){
      mem[key]=val;
      try{ if(window.WMStore && WMStore.set) WMStore.set(key, val); }catch(e){}
    }

    function showImg(img, wrap, credit, url, label){
      function reveal(){ wrap.style.display='block'; wrap.setAttribute('data-loaded','1'); if(credit) credit.innerHTML=label; }
      img.onload=reveal;
      img.onerror=function(){ wrap.style.display='none'; wrap.removeAttribute('data-loaded'); };
      // Aynı URL ise src ataması onload tetiklemez; ayrıca tarayıcı cache'inden
      // gelen görselde complete=true olabilir → elle göster.
      if(img.getAttribute('src')===url){
        if(img.complete && img.naturalWidth>0) reveal();
        else wrap.style.display='block';
        return;
      }
      img.src=url;
      if(img.complete && img.naturalWidth>0) reveal(); // senkron cache hit
    }

    // ═══════════ ALTERNATİF GÖRSEL SEÇİCİ + AI KEYWORD ═══════════
    // Resmin altına bir kez "Alternatif Seç" butonu kurar.
    function ensureAltUI(wrap){
      if(!wrap || document.getElementById('wmAltBar')) return;
      var bar=document.createElement('div');
      bar.id='wmAltBar';
      bar.innerHTML=''
        + '<button type="button" id="wmAltBtn" class="wm-alt-btn">🔄 Alternatif Seç</button>';
      wrap.appendChild(bar);
      var panel=document.createElement('div');
      panel.id='wmAltPanel'; panel.style.display='none';
      panel.innerHTML=''
        + '<div id="wmAltStatus" class="wm-alt-status"></div>'
        + '<div id="wmAltGrid" class="wm-alt-grid"></div>'
        + '<button type="button" id="wmAltAiBtn" class="wm-alt-ai">🤖 AI ile mantıklı resim üret</button>';
      wrap.appendChild(panel);

      document.getElementById('wmAltBtn').onclick=function(){
        var p=document.getElementById('wmAltPanel');
        if(p.style.display==='none'){ p.style.display='block'; loadAlternatives(); }
        else{ p.style.display='none'; }
      };
      document.getElementById('wmAltAiBtn').onclick=function(){ aiAltSearch(); };
    }

    function altStatus(msg){ var s=document.getElementById('wmAltStatus'); if(s) s.textContent=msg||''; }

    // Grid'e aday thumbnail'ları bas. Tıklayınca o resmi seçer + kalıcı kaydeder.
    function renderAltGrid(urls){
      var grid=document.getElementById('wmAltGrid'); if(!grid) return;
      grid.innerHTML='';
      if(!urls || !urls.length){ altStatus('Aday bulunamadı. AI ile deneyebilirsin.'); return; }
      altStatus(urls.length+' aday — birine dokun, kaydedilir.');
      urls.forEach(function(u){
        var t=document.createElement('img');
        t.className='wm-alt-thumb'; t.src=u; t.loading='lazy'; t.alt='';
        t.onerror=function(){ t.remove(); };
        t.onclick=function(){ pickAlternative(u); };
        grid.appendChild(t);
      });
    }

    // Kullanıcının seçtiği resmi ana görsele uygula + cache'e yaz (kalıcı).
    function pickAlternative(url){
      var wrap=document.getElementById('sentImgWrap');
      var img=document.getElementById('sentImg');
      var credit=document.getElementById('imgCredit');
      if(!wrap || !img) return;
      showImg(img, wrap, credit, url, '📷 Seçtiğin resim');
      img.style.display='';
      if(_wmCurKey) cacheSet(_wmCurKey, url); // kalıcı: ileri/geri + sonraki açılış
      var p=document.getElementById('wmAltPanel'); if(p) p.style.display='none';
    }

    async function loadAlternatives(){
      altStatus('Alternatifler aranıyor…');
      renderAltGrid([]);
      var terms=buildTerms(_wmCurSent, _wmCurWord);
      var urls=await searchImageMulti(terms, 12);
      renderAltGrid(urls);
    }

    // Cümleyi AI'ya verip arama kriteri (kısa İngilizce) al, onunla yeniden ara.
    async function aiAltSearch(){
      if(typeof window.callAI!=='function'){ altStatus('AI bağlı değil. Ayarlardan API anahtarını gir.'); return; }
      altStatus('🤖 AI arama kriteri üretiyor…');
      var sys='You generate concise English image-search keywords. Output ONLY 2-4 search queries, comma-separated, no explanation. Each query should describe a concrete, depictable scene matching the sentence meaning.';
      var usr='Sentence: "'+(_wmCurSent||'')+'"\nTarget word: "'+(_wmCurWord||'')+'"\nGive image-search keywords.';
      var raw='';
      try{
        var res=await window.callAI({systemPrompt:sys, userPrompt:usr, aiType:'chat'});
        raw = (typeof res==='string') ? res : (res && (res.text||res.content||res.message||res.output)) || '';
      }catch(e){ altStatus('AI çağrısı başarısız: '+(e&&e.message||e)); return; }
      var kw=String(raw).replace(/["\n]/g,' ').split(/[,;]+/).map(function(s){return s.trim();}).filter(Boolean).slice(0,4);
      if(!kw.length){ altStatus('AI kriter üretemedi.'); return; }
      altStatus('🤖 Kriter: '+kw.join(' · ')+' — aranıyor…');
      var urls=await searchImageMulti(kw, 12);
      renderAltGrid(urls);
    }

    // Aktif kelime/cümle (alternatif seçici bunları kullanır)
    var _wmCurWord='', _wmCurSent='', _wmCurKey='';

    var _wmLSI = async function(sentence, word){
      var wrap=document.getElementById('sentImgWrap');
      var img=document.getElementById('sentImg');
      var credit=document.getElementById('imgCredit');
      if(!wrap || !img) return;

      _wmCurWord=word||''; _wmCurSent=sentence||'';
      var key=ckey(word, sentence); _wmCurKey=key;
      ensureAltUI(wrap); // resmin altına "Alternatif Seç" butonunu garanti et

      // 1) satır verisinde gömülü görsel
      try{
        var row=(Array.isArray(window.words)&&window.words[window.idx])||(Array.isArray(words)&&words[idx])||{};
        var embed=row.imageUrl||row.image||row.imgUrl||row.photo||row.picture||row.visual;
        if(embed && /^https?:\/\//i.test(String(embed))){
          showImg(img, wrap, credit, embed, '📷 Kaynak dosya'); return;
        }
      }catch(e){}

      if(credit) credit.innerHTML='';

      // 2) cache (kullanıcının seçtiği resim de burada saklanır)
      var cached=await cacheGet(key);
      if(_wmCurKey!==key) return;                  // await sırasında kelime değişti → bu sonucu atla
      img=document.getElementById('sentImg'); wrap=document.getElementById('sentImgWrap'); credit=document.getElementById('imgCredit');
      if(!wrap||!img) return;                       // kart yeniden çizildi, eleman yok
      if(cached!==undefined){
        if(cached==='__NONE__'){ wrap.style.display='block'; img.removeAttribute('src'); img.style.display='none'; return; }
        showImg(img, wrap, credit, cached, '📷 Önbellek'); return;
      }

      // 3) ara
      var terms=buildTerms(sentence, word);
      var url=await searchImage(terms);
      if(_wmCurKey!==key) return;                  // await sırasında kelime değişti → eski sonucu BASMA
      img=document.getElementById('sentImg'); wrap=document.getElementById('sentImgWrap'); credit=document.getElementById('imgCredit');
      if(!wrap||!img) return;
      if(url){
        showImg(img, wrap, credit, url, '📷 Openverse / Commons / Wikipedia');
        cacheSet(key, url);
      }else{
        // sonuç yok: sarmalayıcı görünür kalsın ki kullanıcı Alternatif/AI deneyebilsin
        wrap.style.display='block'; img.removeAttribute('src'); img.style.display='none';
        cacheSet(key, '__NONE__');
      }
    };
    try{
      Object.defineProperty(window, 'loadSentenceImage', {
        configurable:false, enumerable:true,
        get:function(){ return _wmLSI; },
        set:function(){ /* legacy ezmesini yok say */ }
      });
    }catch(e){ window.loadSentenceImage=_wmLSI; }

    // Arka planda görsel ön-yükleme: cache'te yoksa arayıp kaydeder (DOM'a basmaz)
    window.WM_prefetchImage = async function(sentence, word){
      try{
        var key=ckey(word, sentence);
        var c=await cacheGet(key);
        if(c!==undefined) return;            // zaten biliniyor
        var url=await searchImage(buildTerms(sentence, word));
        cacheSet(key, url || '__NONE__');
      }catch(e){}
    };

    // URL DÖNDÜREN getter (DOM'a yazmaz) — sade ekran kendi <img>'ine basar.
    // Aynı cache/arama zincirini paylaşır; gömülü görsel > cache > arama.
    window.WM_getImageFor = async function(sentence, word){
      try{
        var row=(Array.isArray(window.words)&&window.words[window.idx])||{};
        var embed=row.imageUrl||row.image||row.imgUrl||row.photo||row.picture||row.visual;
        if(embed && /^https?:\/\//i.test(String(embed))) return embed;
        var key=ckey(word, sentence);
        var cached=await cacheGet(key);
        if(cached!==undefined) return cached==='__NONE__' ? '' : cached;
        var url=await searchImage(buildTerms(sentence, word));
        cacheSet(key, url || '__NONE__');
        return url || '';
      }catch(e){ return ''; }
    };

    // ===== Sade ekran için bağımsız alternatif/AI seçici (verilen img/wrap'e yazar) =====
    // sc-word'ün sentImg'ine DOKUNMAZ; kendi overlay grid'ini kurar.
    function wmAltOverlay(){
      var ov=document.getElementById('wmAltOverlay');
      if(ov) return ov;
      if(!document.getElementById('wmAltOverlayCss')){
        var st=document.createElement('style'); st.id='wmAltOverlayCss';
        st.textContent=
          '#wmAltOverlay{position:fixed;inset:0;z-index:1000050;background:rgba(0,0,0,.6);display:none;align-items:flex-end}'
          +'#wmAltOverlay.open{display:flex}'
          +'#wmAltSheet{background:var(--bg2,#0f1623);border-top:1px solid var(--border,#1e293b);border-radius:18px 18px 0 0;width:100%;max-height:80vh;overflow-y:auto;padding:12px 14px calc(16px + env(safe-area-inset-bottom)) 14px}'
          +'#wmAltSheet .h{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}'
          +'#wmAltSheet .h b{font-size:15px;color:var(--text,#e2e8f0)}'
          +'#wmAltClose{background:none;border:none;color:var(--muted,#94a3b8);font-size:24px;cursor:pointer}'
          +'#wmAltMsg{font-size:12px;color:var(--muted,#94a3b8);margin:4px 0 10px;text-align:center}'
          +'#wmAltGrid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}'
          +'#wmAltGrid2 img{width:100%;height:96px;object-fit:cover;border-radius:10px;border:1.5px solid var(--border,#334155);cursor:pointer}'
          +'#wmAltGrid2 img:active{transform:scale(.97)}'
          +'#wmAltAi2{width:100%;height:46px;border-radius:12px;background:var(--accent,#2563eb);border:none;color:#fff;font-weight:800;font-size:13px;cursor:pointer}';
        document.head.appendChild(st);
      }
      ov=document.createElement('div'); ov.id='wmAltOverlay';
      ov.innerHTML='<div id="wmAltSheet"><div class="h"><b>🖼️ Görsel seç</b><button id="wmAltClose" aria-label="Kapat">×</button></div>'
        +'<div id="wmAltMsg"></div><div id="wmAltGrid2"></div>'
        +'<button type="button" id="wmAltAi2">🤖 AI ile mantıklı resim üret</button></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function(e){ if(e.target===ov) ov.classList.remove('open'); });
      ov.querySelector('#wmAltClose').onclick=function(){ ov.classList.remove('open'); };
      return ov;
    }
    function wmAltMsg(m){ var e=document.getElementById('wmAltMsg'); if(e) e.textContent=m||''; }
    function wmAltGrid(urls, sentence, word, imgId){
      var g=document.getElementById('wmAltGrid2'); if(!g) return;
      g.innerHTML='';
      if(!urls||!urls.length){ wmAltMsg('Aday bulunamadı. AI ile dene.'); return; }
      wmAltMsg(urls.length+' aday — birine dokun, kaydedilir.');
      urls.forEach(function(u){
        var t=document.createElement('img'); t.src=u; t.loading='lazy'; t.alt='';
        t.onerror=function(){ t.remove(); };
        t.onclick=function(){
          var img=document.getElementById(imgId);
          if(img){ img.src=u; img.style.display=''; var ph=document.getElementById('wm-s-imgph'); if(ph) ph.style.display='none'; }
          try{ cacheSet(ckey(word, sentence), u); }catch(e){}   // kalıcı: ileri/geri + sc-word ile ortak
          var ov=document.getElementById('wmAltOverlay'); if(ov) ov.classList.remove('open');
        };
        g.appendChild(t);
      });
    }
    // Alternatif seçici aç (sade ekran)
    window.WM_openAltSelector = async function(sentence, word, imgId){
      var ov=wmAltOverlay(); ov.classList.add('open');
      wmAltMsg('Alternatifler aranıyor…');
      var g=document.getElementById('wmAltGrid2'); if(g) g.innerHTML='';
      document.getElementById('wmAltAi2').onclick=function(){ window.WM_aiImageFor(sentence, word, imgId); };
      try{
        var urls=await searchImageMulti(buildTerms(sentence, word), 12);
        wmAltGrid(urls, sentence, word, imgId);
      }catch(e){ wmAltMsg('Arama başarısız.'); }
    };
    // AI kriter üret + ara (sade ekran)
    window.WM_aiImageFor = async function(sentence, word, imgId){
      var ov=wmAltOverlay(); ov.classList.add('open');
      if(typeof window.callAI!=='function'){ wmAltMsg('AI bağlı değil. Ayarlardan API anahtarını gir.'); return; }
      wmAltMsg('🤖 AI arama kriteri üretiyor…');
      var sys='You generate concise English image-search keywords. Output ONLY 2-4 search queries, comma-separated, no explanation. Each query should describe a concrete, depictable scene matching the sentence meaning.';
      var usr='Sentence: "'+(sentence||'')+'"\nTarget word: "'+(word||'')+'"\nGive image-search keywords.';
      var raw='';
      try{
        var res=await window.callAI({systemPrompt:sys, userPrompt:usr, aiType:'chat'});
        raw=(typeof res==='string')?res:(res&&(res.text||res.content||res.message||res.output))||'';
      }catch(e){ wmAltMsg('AI çağrısı başarısız.'); return; }
      var kw=String(raw).replace(/["\n]/g,' ').split(/[,;]+/).map(function(s){return s.trim();}).filter(Boolean).slice(0,4);
      if(!kw.length){ wmAltMsg('AI kriter üretemedi.'); return; }
      wmAltMsg('🤖 Kriter: '+kw.join(' · ')+' — aranıyor…');
      try{ var urls=await searchImageMulti(kw, 12); wmAltGrid(urls, sentence, word, imgId); }
      catch(e){ wmAltMsg('Arama başarısız.'); }
    };
  })();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDict);
  } else {
    setTimeout(bootDict, 0);
  }

  // Legacy WM_Dictionary'yi ham array ile ezerse (lookup string anahtar ister) tekrar map'e çevir
  setInterval(function(){
    var d = window.WM_Dictionary;
    if (Array.isArray(d)) loadDict();
  }, 5000);

  /* NAV / LİSTE TIKLAMA FIX */
  function getData() {
    if (Array.isArray(window.words) && window.words.length) return window.words;
    if (Array.isArray(window.allWords) && window.allWords.length) return window.allWords;
    return [];
  }

  function getIndex() {
    try { if (typeof idx === 'number') return idx; } catch (e) {}
    return Number(window.idx || window.currentIndex || window.wordIndex || 0) || 0;
  }

  function setIndex(n) {
    const data = getData();
    const i = Math.max(0, Math.min(data.length - 1, Number(n) || 0));
    try { idx = i; } catch (e) {}
    window.idx = i;
    window.currentIndex = i;
    window.wordIndex = i;
    return i;
  }
  // Sade ekran da legacy iç 'idx'i güncelleyebilsin (seslendirme words[idx] okur)
  window.WM_syncIdx = setIndex;

  function refreshWordScreen() {
    var card = document.getElementById('wordCard');
    // Kart hazırlanırken GİZLE → parça parça (metin→görsel→renk) toplanma görünmez.
    // Tüm DOM mutasyonları bitince tek requestAnimationFrame'de görünür yapılır.
    if (card) { card.style.opacity = '0'; card.style.animation = 'none'; }

    try { phase = 'learn'; } catch (e) {}
    try { if (typeof showScreen === 'function') showScreen('sc-word'); } catch (e) {}
    try { if (typeof renderLearn === 'function') renderLearn(); } catch (e) {}
    try { if (typeof updateWordCounter === 'function') updateWordCounter(); } catch (e) {}

    // Görseli SENKRON başlat (setTimeout YOK) — kart gösterilmeden src set edilsin,
    // sabit yükseklik rezervi sayesinde inince layout zıplamaz.
    try {
      var row = getData()[getIndex()] || {};
      var sent = row.sentence || row.cumle || row.example || row.Sentence || '';
      var w = row.word || row.Kelime || row.english || '';
      if (window.loadSentenceImage && (sent || w)) {
        try { window.loadSentenceImage(sent, w); } catch (e) {}
      }
      // NOT: POS renklendirme burada ÇAĞRILMAZ. Normal ekranın kendi MutationObserver'ı
      // (watch) .wc-sent değişince zaten tetikliyor. Buradan erken çağırmak mobilde
      // _busy kilidini eski/gizli cümleyle takıp renklendirmeyi bozuyordu (regresyon).

      // Sıradaki 2 cümlenin görselini arka planda ön-yükle (anında geçiş için)
      if (window.WM_prefetchImage) {
        var data = getData(), cur = getIndex();
        var doPrefetch = function(){
          for (var k=1; k<=2; k++){
            var nx = data[cur+k];
            if (nx) { try{ window.WM_prefetchImage(nx.sentence||nx.cumle||'', nx.word||nx.Kelime||''); }catch(e){} }
          }
        };
        if (window.requestIdleCallback) requestIdleCallback(doPrefetch, {timeout:1500});
        else setTimeout(doPrefetch, 500);
      }
    } catch (e) {}

    // Her şey DOM'a yazıldı → tek frame'de fade ile göster (parça parça yerine bütün)
    if (card) {
      requestAnimationFrame(function(){
        card.style.animation = 'wmFade .28s ease both';
        card.style.opacity = '';
      });
    }
  }

  window.WM_forceNextWord = function () {
    setIndex(getIndex() + 1);
    refreshWordScreen();
    return false;
  };

  window.WM_forcePrevWord = function () {
    setIndex(getIndex() - 1);
    refreshWordScreen();
    return false;
  };

  window.nextWord = window.navNextWord = window.WM_forceNextWord;
  window.prevWord = window.navPrevWord = window.WM_forcePrevWord;

  window.goToWord = function (pos, source) {
    const data = getData();
    const src = Array.isArray(source)
      ? source
      : (window.virtualScrollData && window.virtualScrollData.filteredWords) || data;

    const item = src[Number(pos) || 0];
    let real = Number(pos) || 0;

    if (item) {
      real = data.findIndex(x =>
        (x.id && item.id && x.id === item.id) ||
        (x.rowNum && item.rowNum && x.rowNum === item.rowNum) ||
        (x.sentence && item.sentence && x.sentence === item.sentence)
      );
      if (real < 0) real = Number(pos) || 0;
    }

    setIndex(real);
    refreshWordScreen();
    return false;
  };

  document.addEventListener('click', function (ev) {
    const t = ev.target;
    if (!t || !t.closest) return;

    const listItem = t.closest('#wordListEl .wi, #wordListEl [onclick*="goToWord"]');
    if (listItem) {
      const on = listItem.getAttribute('onclick') || '';
      const m = on.match(/goToWord\s*\(\s*(\d+)/);
      if (m) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        window.goToWord(Number(m[1]));
      }
    }
  }, true);

  /* PDF MINING - CÜMLELERİ ÇIKAR */
  function extractSentences(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s+(?=[A-Z"“‘])/g, '$1|')
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 8 && /[a-zA-Z]/.test(s));
  }

  window.ffExtractSentences = function () {
    const text = $('ffText') ? $('ffText').value : '';
    const out = $('ffMineOut');
    const stats = $('ffMineStats');
    const sentences = extractSentences(text);
    window.FF_LAST_SENTENCES = sentences;

    if (stats) {
      stats.style.display = 'grid';
      stats.innerHTML = `
        <div class="ff-stat"><b>${sentences.length}</b><span>CÜMLE</span></div>
        <div class="ff-stat"><b>${text.length}</b><span>KARAKTER</span></div>
      `;
    }

    if (out) {
      out.innerHTML = sentences.length
        ? `<div class="ff-list">${sentences.map((s,i)=>`
            <div class="ff-item">
              <div class="ff-w">${i+1}</div>
              <div class="ff-body"><div class="ff-m">${s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}</div></div>
            </div>`).join('')}</div>
            <button class="ff-btn ff-blue" onclick="ffCopySentences()">Cümleleri Kopyala</button>`
        : '<div class="ff-sub">Çıkarılacak cümle bulunamadı.</div>';
    }
  };

  window.ffCopySentences = function () {
    const arr = window.FF_LAST_SENTENCES || [];
    if (!arr.length) return alert('Önce cümleleri çıkar.');
    navigator.clipboard.writeText(arr.join('\n')).then(() => alert(arr.length + ' cümle kopyalandı.'));
  };

  function addSentenceButton() {
    document.querySelectorAll('button').forEach(btn => {
      if ((btn.textContent || '').trim() === 'Kelimeleri Çıkar' && !btn.parentElement.querySelector('.ff-sentence-extract-btn')) {
        const b = document.createElement('button');
        b.className = 'ff-btn ff-orange ff-sentence-extract-btn';
        b.textContent = 'Cümleleri Çıkar';
        b.onclick = window.ffExtractSentences;
        btn.insertAdjacentElement('afterend', b);
      }
    });
  }

  // addSentenceButton: her saniye yerine DOM değişince debounce'lu çalış
  addSentenceButton();
  (function(){
    var t=null;
    try{
      new MutationObserver(function(){
        if(t) return;
        t=setTimeout(function(){ t=null; addSentenceButton(); },300);
      }).observe(document.body,{childList:true,subtree:true});
    }catch(e){ setInterval(addSentenceButton,1000); }
    setInterval(addSentenceButton,5000);
  })();

/* ════════════════════════════════════════════════════════════════
   SEKMELİ ARAÇLAR PANELİ — Araçlar + Özellikler (kategoriler)
   "🎯 Özellikler" bölümü kelime ekranından kaldırılır, tüm
   butonları bu yan panelde "Özellikler" sekmesine taşınır.
   ════════════════════════════════════════════════════════════════ */
(function(){
  if (window.__WM_CLEAN_TOOLS_PANEL_V3__) return;
  window.__WM_CLEAN_TOOLS_PANEL_V3__ = true;

  // — güvenli çağırıcı: fonksiyon varsa çalıştır —
  function run(fn){ return function(){ try{ fn(); }catch(e){ console.warn('Araç hatası:', e); } }; }
  function scr(id){ return run(function(){ if(window.showScreen) showScreen(id); }); }
  // switchTab, alt menü sekmelerini doğru başlatır (ekran + init birlikte)
  function tab(name){ return run(function(){ if(window.switchTab) switchTab(name); else if(window.showScreen) showScreen('sc-'+name); }); }
  // ffOpen çağrısı + overlay'in gerçekten açıldığını garanti et
  function ff(w){
    return run(function(){
      if(!window.ffOpen){ console.warn('ffOpen tanımlı değil (free_features.js yüklendi mi?)'); return; }
      ffOpen(w);
      // overlay açılmadıysa zorla aç (z-index/active güvencesi)
      var id={dash:'ffDash',mine:'ffMine',rev:'ffRev',shad:'ffShad'}[w];
      var el=document.getElementById(id);
      if(el){ el.classList.add('active'); el.style.display='block'; el.style.zIndex='1000001'; el.scrollTop=0; }
      else { console.warn('Overlay bulunamadı:', id); }
    });
  }

  // "Araçlar" sekmesi (önceki sabit liste)
  const TOOL_ITEMS = [
    ['📘 Kelime Ekranı', scr('sc-word')],
    ['📖 Sade Kelime', run(function(){
      if(window.WM_openSimpleScreen){ window.WM_openSimpleScreen(); return; }
      // modül henüz yüklenmediyse kısa bekle
      var n=0, iv=setInterval(function(){ n++; if(window.WM_openSimpleScreen){ clearInterval(iv); window.WM_openSimpleScreen(); } else if(n>20) clearInterval(iv); }, 100);
    })],
    ['📋 Liste',         scr('sc-list')],
    ['📊 Panel',         ff('dash')],
    ['⛏️ PDF / Transcript Mining', ff('mine')],
    ['🧠 Akıllı Tekrar', ff('rev')],
    ['🎧 Shadow',        ff('shad')],
    ['🗺️ Dil Haritası',  run(function(){ window.open('dil_haritasi_v1.html','_blank'); })],
    ['📊 İstatistik',    tab('stats')],
    ['📷 Kamera',        tab('cameraCoach')],
    ['⚙️ Ayarlar',       tab('settings')],
    ['⚡ Canlı Skor Koçu', run(function(){
      if(window.openLiveCoachFromSettings) openLiveCoachFromSettings();
      else if(window.showScreen) showScreen('sc-live-coach');
    })]
  ];

  // "Özellikler" sekmesi — kelime ekranındaki tüm kategoriler ve butonları
  const FEATURE_GROUPS = [
    ['🔊 Ses & Telaffuz', [
      ['🔊 Kelime',   run(function(){ if(window.speakWord) speakWord(); })],
      ['🔊 Cümle',    run(function(){ if(window.speakSentence) speakSentence(); })],
      ['🔊 Türkçe',   run(function(){ if(window.speakTR) speakTR(); })],
      ['🎤 Koç',      run(function(){ if(window.openPronCoach) openPronCoach(); })],
      ['🎤 Telaffuz', run(function(){ var p=document.getElementById('pronunPanel'); if(p) p.style.display=''; })],
      ['🗣️ Aksan',    scr('sc-accent')]
    ]],
    ['💬 Konuşma & Yazma', [
      ['🗣️ Konuşma',   run(function(){ if(window.openConversationSim) openConversationSim(); })],
      ['✍️ Cümle Yaz', run(function(){ if(window.openSentenceCorrector) openSentenceCorrector(); })],
      ['🗨️ Partner',   run(function(){ if(window.openPartnerChat) openPartnerChat(); })]
    ]],
    ['📝 Alıştırmalar', [
      ['🎴 Flashcard',  run(function(){ if(window.openFlashcardMode) openFlashcardMode(); })],
      ['🔤 Cümle Modu', scr('sc-sent')],
      ['👥 Shadow',     run(function(){ if(window.openShadowMode) openShadowMode(); })],
      ['📝 AI Test',    scr('sc-quiz')],
      ['📚 Gramer',     scr('sc-grammar')]
    ]],
    ['🤖 AI İçerik', [
      ['📖 Hikaye',  run(function(){ if(window.openStoryScreen) openStoryScreen(); })],
      ['🎧 Podcast', run(function(){ if(window.openPodcastScreen) openPodcastScreen(); })],
      ['🖼️ Görsel',  run(function(){ if(window.openWordVisual) openWordVisual(); })]
    ]],
    ['🛠️ Araçlar', [
      ['📋 Kopyala',      run(function(){ if(window.copyToClipboard) copyToClipboard(); })],
      ['🌐 Çeviri',       run(function(){ if(window.openGT) openGT(); })],
      ['🧠 Bağlam',       run(function(){ if(window.openContextAnalysis) openContextAnalysis(); })],
      ['📺 Video',        scr('sc-videos')],
      ['🎵 Şarkı',        scr('sc-song')],
      ['📚 Kütüphane',    scr('sc-library')],
      ['❓ AI Sor',       run(function(){ if(window.openAskAIScreen) openAskAIScreen(); })],
      ['📘 Sözlük',       run(function(){ if(window.openDictBuilder) openDictBuilder(); })],
      ['📚 Sözlüğüm',     run(function(){ if(window.openMyDictionary) openMyDictionary(); })],
      ['🌍 Geniş Sözlük', run(function(){ if(window.openBroadDictionary) openBroadDictionary(); })],
      ['🧠 Context',      run(function(){ if(window.openContextTeacher) openContextTeacher(); })],
      ['🌳 Kelime Ağacı', run(function(){ if(window.openWordFamilyTree) openWordFamilyTree(); })]
    ]]
  ];

  function hideOnlyFloatingButtons(){
    document.querySelectorAll('#ffFabs,.ff-fabs,.ff-fab').forEach(function(e){ e.style.display='none'; });
  }

  // Kelime ekranındaki "🎯 Özellikler" bölümünü ve butonunu gizle
  function hideFeatureSection(){
    var sec=document.getElementById('actRow');        if(sec) sec.style.display='none';
    var btn=document.getElementById('featuresToggleBtn'); if(btn) btn.style.display='none';
    // Kart altındaki buton bloğu (📋 Kelime Listesi / 📌 Ezberlenecekler / 🎯 Özellikler)
    // featuresToggleBtn'in sarmalayan grid'ini gizle — tüm blok yan panele taşındı.
    if(btn && btn.parentElement && btn.parentElement.dataset.wmHidden!=='1'){
      btn.parentElement.style.display='none';
      btn.parentElement.dataset.wmHidden='1';
    }
    // Kart içindeki ekstra: telaffuz sıfırla butonunu gizle — sadece ◀ 🔊 🔊 ▶ kalsın
    var wc=document.getElementById('wordCard');
    if(wc){
      wc.querySelectorAll('button[onclick*="resetPronun"]').forEach(function(b){ b.style.display='none'; });
    }
    // Flashcard / Akıllı Tekrar / Yapay Zekaya Sor → panele taşındı, kelime ekranında gizle
    var wordScreen=document.getElementById('sc-word');
    if(wordScreen){
      var sels=['button[onclick*="openFlashcardMode"]','button[onclick*="openAskAIScreen"]'];
      // startReviewMode birden çok yerde; sadece kart altındaki görünür olanı + grid'i gizle
      wordScreen.querySelectorAll('button[onclick*="openFlashcardMode"],button[onclick*="startReviewMode"],button[onclick*="openAskAIScreen"]').forEach(function(b){
        if(b.id==='btnReview') return; // tekrar sayacı butonu kalsın
        b.style.display='none';
        // Flashcard/Akıllı Tekrar aynı grid'de — sarmalayıcıyı da gizle
        var p=b.parentElement;
        if(p && p.style && p.style.display!=='none' && p.querySelectorAll('button').length<=2 && p.id!=='sc-word'){
          p.style.display='none';
        }
      });
    }
  }

  function styleBtn(b){
    b.style.cssText='display:block;width:100%;margin:8px 0;padding:14px;border-radius:16px;background:#1f2937;color:#fff;border:1px solid #334155;text-align:left;font-weight:900;cursor:pointer';
  }

  function rebuildTools(){
    document.querySelectorAll('#wmToolsBtn,#wmToolsDrawer').forEach(function(e){ e.remove(); });

    const btn=document.createElement('button');
    btn.id='wmToolsBtn';
    btn.textContent='🧰 Araçlar';
    btn.style.cssText='position:fixed;right:14px;top:130px;z-index:999999;background:#2563eb;color:#fff;border:0;border-radius:999px;padding:12px 16px;font-weight:900;cursor:pointer';

    const drawer=document.createElement('div');
    drawer.id='wmToolsDrawer';
    drawer.style.cssText='position:fixed;top:0;right:-360px;width:340px;max-width:90vw;height:100vh;background:#111827;z-index:1000000;padding:18px;transition:right .25s;overflow-y:auto;border-left:1px solid #334155;box-sizing:border-box';

    drawer.innerHTML=
      '<button id="wmToolsClose" style="float:right;background:transparent;color:#fff;border:0;font-size:28px;cursor:pointer">×</button>'+
      '<h3 style="margin:0 0 14px;font-size:22px;color:#fff">🧰 Araçlar</h3>'+
      '<div id="wmTabBar" style="display:flex;gap:8px;margin-bottom:14px"></div>'+
      '<div id="wmTabFeatures"></div>'+
      '<div id="wmTabTools" style="display:none"></div>';

    document.body.appendChild(btn);
    document.body.appendChild(drawer);

    // — sekme barı —
    const tabBar=drawer.querySelector('#wmTabBar');
    const paneFeatures=drawer.querySelector('#wmTabFeatures');
    const paneTools=drawer.querySelector('#wmTabTools');

    function makeTab(label,target){
      const t=document.createElement('button');
      t.textContent=label;
      t.style.cssText='flex:1;padding:10px;border-radius:12px;border:1px solid #334155;background:#1f2937;color:#fff;font-weight:900;cursor:pointer';
      t.onclick=function(){
        paneFeatures.style.display = (target==='features') ? 'block':'none';
        paneTools.style.display    = (target==='tools')    ? 'block':'none';
        tabBar.querySelectorAll('button').forEach(function(x){ x.style.background='#1f2937'; });
        t.style.background='#2563eb';
      };
      return t;
    }
    const tabF=makeTab('🎯 Özellikler','features');
    const tabT=makeTab('🧰 Araçlar','tools');
    tabF.style.background='#2563eb'; // varsayılan aktif
    tabBar.appendChild(tabF);
    tabBar.appendChild(tabT);

    // — Özellikler sekmesi: kategori başlıkları + butonlar —
    FEATURE_GROUPS.forEach(function(grp){
      const head=document.createElement('div');
      head.textContent=grp[0];
      head.style.cssText='margin:14px 0 6px;font-size:14px;font-weight:900;color:#93c5fd';
      paneFeatures.appendChild(head);
      grp[1].forEach(function(item){
        const b=document.createElement('button');
        b.textContent=item[0]; styleBtn(b);
        b.onclick=function(){ drawer.style.right='-360px'; item[1](); };
        paneFeatures.appendChild(b);
      });
    });

    // — Araçlar sekmesi: düz liste —
    TOOL_ITEMS.forEach(function(item){
      const b=document.createElement('button');
      b.textContent=item[0]; styleBtn(b);
      b.onclick=function(){ drawer.style.right='-360px'; item[1](); };
      paneTools.appendChild(b);
    });

    btn.onclick=function(){ drawer.style.right='0'; };
    drawer.querySelector('#wmToolsClose').onclick=function(){ drawer.style.right='-360px'; };

    hideOnlyFloatingButtons();
    hideFeatureSection();
  }

  window.WM_REBUILD_TOOLS=rebuildTools;

  // ── YERLEŞİM GÜVENCESİ ─────────────────────────────────────────
  // Konuşma Partneri, Persona ve Canlı Skor Koçu kartları bazı
  // durumlarda alt alta diziliyordu; grid'i garantiye alıyoruz.
  function injectLayoutGuard(){
    if(document.getElementById('wm-layout-guard')) return;
    var css = ''
      + '#partnerSelector,.partner-selector{display:grid !important;grid-template-columns:1fr 1fr !important;gap:8px !important;}'
      + '#personaGrid,.persona-grid{display:grid !important;grid-template-columns:1fr 1fr !important;gap:10px !important;}'
      + '.partner-card,.persona-card{text-align:center !important;}'
      // Konuşma Simülasyonu kişilik kartları (Emma/Mike/Sophia/Jack) — 2 sütun
      + '.wm-character-grid{display:grid !important;grid-template-columns:1fr 1fr !important;gap:8px !important;}'
      + '.wm-character{text-align:center !important;padding:10px 8px !important;border:1px solid #334155 !important;border-radius:12px !important;cursor:pointer !important;}'
      + '.wm-char-emoji{font-size:24px !important;line-height:1 !important;}'
      + '.wm-char-name{font-weight:900 !important;margin-top:4px !important;}'
      + '.wm-char-meta{font-size:12px !important;color:var(--muted,#7c85b0) !important;}'
      // Kelime Ağacı — kelimeler yeşil+bold, anlam soluk; aynı formatta görünme sorunu
      + '.tree-word-item{padding:6px 0 !important;border-bottom:1px solid rgba(255,255,255,.06) !important;}'
      + '.tree-word-main{font-size:15px !important;font-weight:900 !important;color:var(--green,#22c55e) !important;}'
      + '.tree-word-meaning{font-size:12px !important;font-weight:400 !important;color:var(--muted,#7c85b0) !important;line-height:1.45 !important;margin-top:2px !important;}'
      + '#scenarioGrid{display:flex !important;flex-wrap:wrap !important;gap:7px !important;}'
      + '.pfc-sound-grid{display:grid !important;grid-template-columns:1fr 1fr !important;gap:8px !important;}'
      + '.pfc-sound-card{font-size:12px !important;padding:8px !important;}'
      + '.pfc-card-actions{display:grid !important;grid-template-columns:1fr 1fr 1fr !important;gap:6px !important;margin-top:6px !important;}'
      + '.pfc-card-actions .pfc-mini-action{min-width:0 !important;font-size:11px !important;padding:7px 4px !important;}'
      + '.pfc-face-wrap{display:grid !important;grid-template-columns:128px 1fr !important;gap:12px !important;align-items:center !important;}'
      + '@media(max-width:430px){.pfc-sound-grid{grid-template-columns:1fr !important;}.pfc-face-wrap{grid-template-columns:1fr !important;}}'
      // ─── GÖRSELLİK İYİLEŞTİRMELERİ ───
      // Kelime kartı yumuşak giriş
      + '#wordCard{animation:wmFade .28s ease both;}'
      + '@keyframes wmFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'
      // Cümle görseli: yumuşak fade + yüklenirken iskelet
      // Görsel alanı yüklenmeden ÖNCE de yer kaplasın → görsel inince layout zıplamaz
      + '#sentImgWrap{transition:opacity .3s ease;min-height:200px;display:flex;flex-direction:column;justify-content:center;}'
      + '#sentImg{transition:opacity .35s ease;border-radius:12px;width:100%;height:188px;object-fit:cover;background:var(--bg3,#1b2230);}'
      + '#sentImg:not([src]),#sentImg[src=""]{visibility:hidden;}'
      + '#sentImgWrap:not([data-loaded]) #sentImg{opacity:0;}'
      + '#sentImgWrap[data-loaded] #sentImg{opacity:1;}'
      + '.wm-img-skeleton{background:linear-gradient(100deg,#1b2230 30%,#243049 50%,#1b2230 70%);background-size:200% 100%;animation:wmShimmer 1.2s infinite;border-radius:12px;min-height:120px;}'
      + '@keyframes wmShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}'
      // Buton dokunma geri bildirimi (genel)
      + '.btn,.act-btn,#wmToolsDrawer button,.wm-character{transition:transform .12s ease,box-shadow .15s ease,filter .15s ease;}'
      + '.btn:active,.act-btn:active,#wmToolsDrawer button:active{transform:scale(.96);}'
      + '#wmToolsDrawer button:hover{filter:brightness(1.12);}'
      // Araçlar paneli: daha yumuşak gölge + kaydırma
      + '#wmToolsDrawer{box-shadow:-12px 0 40px rgba(0,0,0,.5) !important;scroll-behavior:smooth;}'
      + '#wmToolsBtn{box-shadow:0 6px 20px rgba(37,99,235,.45) !important;transition:transform .12s ease;}'
      + '#wmToolsBtn:active{transform:scale(.94);}'
      // Kelime Ağacı satır vurgusu
      + '.tree-word-item{transition:background .15s ease;border-radius:8px;}'
      + '.tree-word-item:hover{background:rgba(34,197,94,.08) !important;}'
      // Tipografi: anlam hiyerarşisi
      + '.wc-word{letter-spacing:.2px;}'
      + '.meanings-section ol li{margin:2px 0;}'
      // ═══════════ KAPSAMLI GÖRSEL REVİZYON ═══════════
      // — Canlı Skor Koçu: fonem kartları —
      + '.pfc-sound-card{background:linear-gradient(160deg,#161d2e,#10151f) !important;border:1px solid #283349 !important;border-radius:16px !important;padding:14px !important;margin-bottom:12px !important;box-shadow:0 4px 18px rgba(0,0,0,.28) !important;transition:transform .15s ease,border-color .2s ease !important;}'
      + '.pfc-sound-card:hover{transform:translateY(-2px) !important;border-color:#3b82f6 !important;}'
      + '.pfc-sound-card.same-tr{border-left:4px solid #22c55e !important;}'
      + '.pfc-sound-card.diff-tr{border-left:4px solid #ef4444 !important;}'
      + '.pfc-card-head{display:flex !important;align-items:flex-start !important;justify-content:space-between !important;gap:10px !important;margin-bottom:10px !important;}'
      + '.pfc-card-num{font-size:20px !important;font-weight:900 !important;color:#e8eaf6 !important;letter-spacing:.3px !important;}'
      + '.pfc-card-name{font-size:12px !important;color:#94a3b8 !important;margin-top:2px !important;}'
      + '.pfc-mini-tag{font-size:10px !important;font-weight:800 !important;padding:4px 9px !important;border-radius:999px !important;white-space:nowrap !important;}'
      + '.pfc-mini-tag.same{background:rgba(34,197,94,.15) !important;color:#4ade80 !important;}'
      + '.pfc-mini-tag.diff{background:rgba(239,68,68,.15) !important;color:#f87171 !important;}'
      + '#lcPfcProblemCards,#lcPfcProblemCards.pfc-sound-grid{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr)) !important;flex-direction:row !important;gap:12px !important;margin-top:10px !important;width:100% !important;}'
      + '#lcPfcProblemCards>.pfc-sound-card{min-width:0 !important;}'
      + '@media(max-width:560px){#lcPfcProblemCards,#lcPfcProblemCards.pfc-sound-grid{grid-template-columns:1fr !important;}}'
      + '.pfc-art-row,#lcPfcProblemCards .pfc-art-row{display:grid !important;grid-template-columns:1fr 1fr !important;gap:8px !important;align-items:stretch !important;margin:10px 0 !important;}'
      + '.pfc-art{height:74px !important;background:#0c1019 !important;border:1px solid #283349 !important;border-radius:12px !important;padding:6px !important;display:flex !important;align-items:center !important;justify-content:center !important;overflow:hidden !important;}'
      + '.pfc-art svg{width:100% !important;height:100% !important;display:block !important;object-fit:contain !important;}'
      + '.pfc-card-text{font-size:13px !important;line-height:1.55 !important;color:#cbd5e1 !important;background:rgba(255,255,255,.02) !important;border-radius:10px !important;padding:10px 12px !important;margin-bottom:10px !important;}'
      + '.pfc-card-text b{color:#e8eaf6 !important;}'
      + '.pfc-card-actions{display:grid !important;grid-template-columns:1fr 1fr 1fr !important;gap:8px !important;}'
      + '.pfc-card-actions .pfc-mini-action{font-size:12px !important;font-weight:800 !important;padding:9px 6px !important;border-radius:11px !important;border:1px solid #2f3b54 !important;background:#1a2233 !important;color:#dbe3f4 !important;cursor:pointer !important;transition:all .14s ease !important;display:flex !important;align-items:center !important;justify-content:center !important;gap:4px !important;}'
      + '.pfc-card-actions .pfc-mini-action:hover{background:#22304a !important;border-color:#3b82f6 !important;}'
      + '.pfc-card-actions .pfc-mini-action:active{transform:scale(.95) !important;}'
      // mod/etiket bulutu (Sesleri Sırala, Seçili Sesi Çalış...)
      + '.pfc-mode-row{gap:7px !important;}'
      + '.pfc-mode,.pfc-mode-row>*{font-size:12px !important;font-weight:800 !important;padding:7px 12px !important;border-radius:999px !important;border:1px solid #2f3b54 !important;background:#161d2e !important;color:#cbd5e1 !important;cursor:pointer !important;transition:all .14s ease !important;}'
      + '.pfc-mode:hover,.pfc-mode-row>*:hover{border-color:#3b82f6 !important;background:#1c2740 !important;}'
      + '.pfc-mode.active{background:linear-gradient(135deg,#3b82f6,#2563eb) !important;color:#fff !important;border-color:transparent !important;}'
      + '.pfc-tip{background:rgba(59,130,246,.07) !important;border:1px solid rgba(59,130,246,.2) !important;border-radius:12px !important;padding:11px 13px !important;font-size:12px !important;line-height:1.6 !important;color:#cbd5e1 !important;margin-top:10px !important;}'
      + '.pfc-panel,.pfc-stats{border-radius:16px !important;}'
      // — Konuşma Koçu / Partner / Simülasyon kartları —
      + '.wm-character{background:linear-gradient(160deg,#161d2e,#10151f) !important;border:1px solid #283349 !important;border-radius:14px !important;padding:12px 8px !important;transition:transform .15s ease,border-color .2s ease,box-shadow .2s ease !important;box-shadow:0 3px 14px rgba(0,0,0,.25) !important;}'
      + '.wm-character:hover{transform:translateY(-2px) !important;border-color:#3b82f6 !important;}'
      + '.wm-character.active{border-color:#22c55e !important;background:linear-gradient(160deg,#16241c,#101a14) !important;box-shadow:0 0 0 1px #22c55e,0 6px 18px rgba(34,197,94,.18) !important;}'
      + '.wm-char-emoji{font-size:30px !important;line-height:1 !important;margin-bottom:4px !important;}'
      + '.wm-char-name{font-weight:900 !important;font-size:14px !important;color:#e8eaf6 !important;}'
      + '.wm-char-meta{font-size:11px !important;color:#94a3b8 !important;margin-top:2px !important;}'
      // partner/persona kartları (eski sınıflar)
      + '.partner-card,.persona-card{background:linear-gradient(160deg,#161d2e,#10151f) !important;border:1px solid #283349 !important;border-radius:14px !important;padding:12px !important;transition:transform .15s ease,border-color .2s ease !important;}'
      + '.partner-card:hover,.persona-card:hover{transform:translateY(-2px) !important;border-color:#3b82f6 !important;}'
      // senaryo/aksan dropdownları (Konuşma Simülasyonu)
      + '#sc-conversation select,#sc-partner select{background:#161d2e !important;border:1px solid #2f3b54 !important;border-radius:12px !important;color:#e8eaf6 !important;padding:11px 12px !important;font-weight:700 !important;}'
      // — Konuşma Simülasyonu / Gerçek Hayat Koçu: eksik (yüklenmeyen style.css) sınıfları —
      + '.wm-pro-title{font-size:20px !important;font-weight:900 !important;margin-bottom:6px !important;color:#e8eaf6 !important;}'
      + '.wm-pro-sub{font-size:13px !important;color:#94a3b8 !important;line-height:1.55 !important;margin-bottom:14px !important;}'
      + '.wm-hero{border-radius:18px !important;overflow:hidden !important;min-height:150px !important;background:#1c2130 !important;position:relative !important;margin-bottom:12px !important;border:1px solid #252d42 !important;}'
      + '.wm-hero svg{width:100% !important;height:170px !important;display:block !important;}'
      + '.wm-hero-caption{position:absolute !important;bottom:0 !important;left:0 !important;right:0 !important;padding:12px !important;background:linear-gradient(transparent,rgba(0,0,0,.75)) !important;color:#fff !important;}'
      + '.wm-hero-caption b{font-size:16px !important;}'
      + '.wm-hero-caption span{font-size:12px !important;opacity:.85 !important;display:block !important;margin-top:2px !important;}'
      + '.wm-character-grid{display:grid !important;grid-template-columns:repeat(2,1fr) !important;gap:8px !important;margin-top:8px !important;}'
      + '.wm-btn-row{display:flex !important;gap:8px !important;flex-wrap:wrap !important;margin-top:10px !important;}'
      + '.wm-btn{flex:1 1 130px !important;border:none !important;border-radius:12px !important;padding:10px 12px !important;font-weight:900 !important;cursor:pointer !important;font-family:inherit !important;font-size:13px !important;}'
      + '.wm-btn-blue{background:linear-gradient(135deg,#3b82f6,#2563eb) !important;color:#fff !important;}'
      + '.wm-btn-green{background:linear-gradient(135deg,#22c55e,#16a34a) !important;color:#052e16 !important;}'
      + '.wm-btn-purple{background:linear-gradient(135deg,#7c3aed,#6d28d9) !important;color:#fff !important;}'
      + '.wm-btn-ghost{background:#1c2130 !important;color:#a0a8c8 !important;border:1px solid #252d42 !important;}'
      + '.wm-suggestion-box{margin-top:10px !important;background:#131720 !important;border:1px solid #252d42 !important;border-radius:14px !important;padding:10px !important;}'
      + '.wm-suggestion-title{font-size:12px !important;font-weight:900 !important;color:#a78bfa !important;margin-bottom:8px !important;}'
      + '.wm-suggestion-card{background:#1c2130 !important;border:1px solid #252d42 !important;border-radius:12px !important;padding:10px !important;margin-bottom:8px !important;}'
      + '.wm-suggestion-label{font-size:10px !important;font-weight:900 !important;color:#7c85b0 !important;text-transform:uppercase !important;letter-spacing:.8px !important;}'
      + '.wm-suggestion-text{font-size:14px !important;color:#e8eaf6 !important;font-weight:800 !important;line-height:1.45 !important;margin:4px 0 8px !important;}'
      + '.wm-suggestion-actions{display:flex !important;gap:6px !important;}'
      + '.wm-mini-btn{flex:1 !important;border:none !important;border-radius:9px !important;padding:7px 6px !important;font-weight:800 !important;font-size:11px !important;cursor:pointer !important;}'
      + '.wm-stat-grid{display:grid !important;grid-template-columns:repeat(2,1fr) !important;gap:8px !important;margin-top:8px !important;}'
      + '.wm-score-line{display:grid !important;grid-template-columns:90px 1fr 36px !important;gap:8px !important;align-items:center !important;font-size:12px !important;font-weight:800 !important;color:#a0a8c8 !important;}'
      + '.wm-score-track{height:8px !important;background:#1c2130 !important;border-radius:8px !important;overflow:hidden !important;}'
      + '.wm-score-fill{height:100% !important;background:linear-gradient(90deg,#3b82f6,#22c55e) !important;border-radius:8px !important;}'
      // — Gerçek Hayat Koçu paneli: kök style.css'ten (yüklenmiyor) birebir eksik kurallar —
      + '.wm-pro-panel{background:linear-gradient(145deg,#161b28,#131720) !important;border:1px solid var(--border,#252d42) !important;border-radius:18px !important;padding:14px !important;margin:12px 0 !important;box-shadow:0 8px 32px rgba(0,0,0,.4) !important;}'
      + '.wm-pro-title{font-size:16px !important;font-weight:900 !important;color:var(--text,#e8eaf6) !important;display:flex !important;gap:8px !important;align-items:center !important;margin-bottom:8px !important;}'
      + '.wm-pro-sub{color:var(--muted,#7c85b0) !important;font-size:12px !important;line-height:1.5 !important;margin-bottom:10px !important;}'
      + '.wm-chip-row{display:flex !important;gap:7px !important;flex-wrap:wrap !important;margin:8px 0 !important;}'
      + '.wm-chip{border:1.5px solid var(--border,#252d42) !important;background:var(--bg2,#131720) !important;color:var(--sub,#a0a8c8) !important;border-radius:999px !important;padding:7px 10px !important;font-size:12px !important;font-weight:800 !important;cursor:pointer !important;user-select:none !important;transition:.15s !important;}'
      + '.wm-chip.active{background:var(--blue,#3b82f6) !important;border-color:var(--blue,#3b82f6) !important;color:#fff !important;}'
      + '.wm-grid-2{display:grid !important;grid-template-columns:1fr 1fr !important;gap:8px !important;}'
      + '.wm-select,.wm-input,.wm-textarea{width:100% !important;background:var(--bg2,#131720) !important;color:var(--text,#e8eaf6) !important;border:1.5px solid var(--border,#252d42) !important;border-radius:12px !important;padding:10px 12px !important;font-family:inherit !important;font-size:14px !important;outline:none !important;}'
      + '.wm-textarea{min-height:78px !important;resize:vertical !important;}'
      + '.wm-select:focus,.wm-input:focus,.wm-textarea:focus{border-color:var(--blue,#3b82f6) !important;}'
      + '.wm-hero{border-radius:18px !important;overflow:hidden !important;min-height:150px !important;background:var(--bg3,#1c2130) !important;position:relative !important;margin-bottom:12px !important;border:1px solid var(--border,#252d42) !important;}'
      + '.wm-hero svg{width:100% !important;height:170px !important;display:block !important;}'
      + '.wm-hero-caption{position:absolute !important;bottom:0 !important;left:0 !important;right:0 !important;padding:12px !important;background:linear-gradient(transparent,rgba(0,0,0,.75)) !important;color:#fff !important;}'
      + '.wm-hero-caption b{font-size:16px !important;}'
      + '.wm-hero-caption span{font-size:12px !important;opacity:.85 !important;display:block !important;margin-top:2px !important;}'
      + '.wm-character{background:var(--bg2,#131720) !important;border:1.5px solid var(--border,#252d42) !important;border-radius:14px !important;padding:10px !important;cursor:pointer !important;transition:.15s !important;}'
      + '.wm-character.active{border-color:var(--green,#22c55e) !important;background:rgba(34,197,94,.08) !important;}'
      + '.wm-char-emoji{font-size:26px !important;}'
      + '.wm-char-name{font-weight:900 !important;font-size:13px !important;color:var(--text,#e8eaf6) !important;}'
      + '.wm-char-meta{font-size:11px !important;color:var(--muted,#7c85b0) !important;line-height:1.35 !important;margin-top:2px !important;}'
      + '.wm-stat{background:var(--bg2,#131720) !important;border:1px solid var(--border,#252d42) !important;border-radius:12px !important;padding:10px !important;}'
      + '.wm-stat-val{font-size:22px !important;font-weight:900 !important;color:var(--green,#22c55e) !important;}'
      + '.wm-stat-lbl{font-size:11px !important;color:var(--muted,#7c85b0) !important;font-weight:800 !important;}'
      + '.wm-score-bars{display:flex !important;flex-direction:column !important;gap:8px !important;margin-top:8px !important;}'
      + '.ai-extra-btn,.ai-suggest-btn,.ai-translate-btn{display:none !important;}'
      + 'body > #wmPronForcePanel{display:none !important;}'
      // Gerçek Hayat Koçu paneli: varsayılan gizli; yalnız aktif + meşru ekranda görünür.
      // Legacy d() paneli "senaryo" metni geçen yanlış ekranlara (sc-word vb.) bassa bile
      // CSS ile gizli kalır (DOM guard'ın temizleme yarışından bağımsız anlık garanti).
      + '.wm-phase-panel{display:none !important;}'
      + '#sc-realnew.active .wm-phase-panel,#sc-conversation.active .wm-phase-panel,#sc-partner.active .wm-phase-panel{display:block !important;}'
      + '.conv-messages,.partner-chat,.chat-messages{display:flex !important;flex-direction:column !important;gap:14px !important;margin-bottom:12px !important;max-height:380px !important;overflow-y:auto !important;min-height:120px !important;padding:8px !important;}'
      + '.wm-mobile-word{cursor:pointer !important;-webkit-tap-highlight-color:rgba(34,197,94,.25) !important;}'
      + '.wm-mobile-word:active{background:rgba(34,197,94,.14) !important;border-radius:4px !important;}'
      // — Genel tasarım dili: kartlar, butonlar, başlıklar —
      + '.card{border-radius:16px !important;}'
      + '.top-bar h2{letter-spacing:.2px !important;}'
      // seçili/aktif çipler genel yumuşatma
      + '.chip,.pill,.tag{transition:all .14s ease !important;}'
      // — Alternatif görsel seçici —
      + '#wmAltBar{margin-top:8px !important;text-align:center !important;}'
      + '.wm-alt-btn{font-size:12px !important;font-weight:800 !important;padding:8px 14px !important;border-radius:999px !important;border:1px solid #2f3b54 !important;background:#161d2e !important;color:#cbd5e1 !important;cursor:pointer !important;transition:all .14s ease !important;}'
      + '.wm-alt-btn:hover{border-color:#3b82f6 !important;background:#1c2740 !important;}'
      + '#wmAltPanel{margin-top:10px !important;background:#0f1420 !important;border:1px solid #283349 !important;border-radius:14px !important;padding:10px !important;}'
      + '.wm-alt-status{font-size:12px !important;color:#94a3b8 !important;margin-bottom:8px !important;text-align:center !important;}'
      + '.wm-alt-grid{display:grid !important;grid-template-columns:repeat(3,1fr) !important;gap:8px !important;}'
      + '.wm-alt-thumb{width:100% !important;height:80px !important;object-fit:cover !important;border-radius:10px !important;border:2px solid #283349 !important;cursor:pointer !important;transition:all .12s ease !important;background:#0c1019 !important;}'
      + '.wm-alt-thumb:hover{border-color:#22c55e !important;transform:scale(1.04) !important;}'
      + '.wm-alt-ai{display:block !important;width:100% !important;margin-top:10px !important;font-size:12px !important;font-weight:800 !important;padding:10px !important;border-radius:11px !important;border:none !important;background:linear-gradient(135deg,#7c3aed,#6d28d9) !important;color:#fff !important;cursor:pointer !important;}'
      + '.wm-alt-ai:hover{filter:brightness(1.08) !important;}'
      // ─── AÇIK TEMA: body.light-mode tüm CSS değişkenlerini açık paletle ezer ───
      // Mevcut toggleDarkMode() body'ye .light-mode ekliyor ama eski CSS yalnız 4 selektörü
      // override ediyordu; :root değişkenleri koyu kalıp metin/kart okunmaz oluyordu.
      // Tüm ekranlar ve inline stiller var(--..) kullandığından, değişkenleri burada açık
      // değerlerle ezince 47 ekranın tamamı tek seferde tutarlı açık temaya geçer.
      + 'body.light-mode{'
      +   '--bg:#f5f7fb !important;--bg2:#ffffff !important;--bg3:#eef2f7 !important;'
      +   '--card:#ffffff !important;--card2:#f3f5f9 !important;'
      +   '--text:#0f172a !important;--sub:#334155 !important;--muted:#64748b !important;'
      +   '--border:#d8dee9 !important;'
      +   '--blue:#2563eb !important;--green:#16a34a !important;--red:#dc2626 !important;'
      +   '--orange:#ea580c !important;--purple:#7c3aed !important;--pink:#db2777 !important;'
      +   '--shadow:0 8px 28px rgba(15,23,42,.12) !important;'
      +   'background:#f5f7fb !important;color:#0f172a !important;'
      + '}'
      // Açık temada koyu-sabit (var kullanmayan) yüzeyleri de düzelt
      + 'body.light-mode #app{background:#f5f7fb !important;color:#0f172a !important;}'
      + 'body.light-mode .card,body.light-mode .wm-pro-panel,body.light-mode .stats-card{background:#ffffff !important;border-color:#d8dee9 !important;}'
      + 'body.light-mode .wm-chip,body.light-mode .wm-select,body.light-mode .wm-input,body.light-mode .wm-textarea,body.light-mode .wm-character,body.light-mode .wm-stat{background:#ffffff !important;color:#0f172a !important;border-color:#d8dee9 !important;}'
      + 'body.light-mode .wm-hero{background:#eef2f7 !important;}'
      + 'body.light-mode .wm-score-track{background:#e2e8f0 !important;}';
    var s = document.createElement('style');
    s.id = 'wm-layout-guard';
    s.textContent = css;
    document.head.appendChild(s);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){ rebuildTools(); injectLayoutGuard(); });
  }else{
    rebuildTools();
    injectLayoutGuard();
  }

  // Kelime ekranı yeniden çizilince temizliği uygula.
  // Her saniye yoklama yerine: DOM değişince debounce'lu çalış (kullanım daha akıcı),
  // ek olarak seyrek bir güvenlik fallback'i bırak.
  function wmCleanupTick(){ hideOnlyFloatingButtons(); hideFeatureSection(); }
  wmCleanupTick();
  var _wmCleanT=null;
  try{
    new MutationObserver(function(){
      if(_wmCleanT) return;
      _wmCleanT=setTimeout(function(){ _wmCleanT=null; wmCleanupTick(); },250);
    }).observe(document.body,{childList:true,subtree:true});
  }catch(e){
    setInterval(wmCleanupTick,1000); // observer yoksa eski yönteme dön
  }
  setInterval(wmCleanupTick,5000); // seyrek güvenlik ağı
})();

  console.log('✅ FIXES TEK TEMİZ SÜRÜM AKTİF (v3 sekmeli panel)');

  /* ════════ AÇILIŞ KAPISI: sözlük + yedekleme klasörü hazır olmadan kullanılamaz ════════ */
  (function(){
    function folderReady(){ try{ return localStorage.getItem('backupFolderSelected')==='true'; }catch(e){ return false; } }
    function dictReady(){
      var d=window.WM_Dictionary;
      return d && Object.keys(d).length>500;
    }

    var gate=document.createElement('div');
    gate.id='wmStartupGate';
    gate.style.cssText='position:fixed;inset:0;z-index:999999;background:#0a0d14;color:#e8eaf6;display:flex;align-items:center;justify-content:center;font-family:Nunito,system-ui,sans-serif;padding:24px';
    gate.innerHTML=''
      +'<div style="max-width:420px;width:100%;text-align:center">'
      +'<div style="font-size:42px;margin-bottom:8px">📘</div>'
      +'<div style="font-size:20px;font-weight:900;margin-bottom:18px">WordMode hazırlanıyor</div>'
      +'<div id="wmGateFolder" style="background:#161b28;border:1px solid #252d42;border-radius:14px;padding:14px;margin-bottom:10px;text-align:left">⏳ Yedekleme klasörü kontrol ediliyor…</div>'
      +'<button id="wmGateFolderBtn" style="display:none;width:100%;margin:0 0 10px;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-weight:900;font-size:15px;cursor:pointer">📁 Yedekleme Klasörü Seç</button>'
      +'<div id="wmGateDict" style="background:#161b28;border:1px solid #252d42;border-radius:14px;padding:14px;text-align:left">⏳ Sözlük yükleniyor…</div>'
      +'</div>';

    function showGate(){ if(!document.getElementById('wmStartupGate')) document.body.appendChild(gate); }
    function hideGate(){ var g=document.getElementById('wmStartupGate'); if(g) g.remove(); }

    // Sözlüğü yedekleme klasörü üzerinden (yoksa GitHub'dan kopyalayarak) hazırla
    async function ensureDict(){
      try{
        if(typeof window.ensureSozlukJsonInBackupFolder==='function'){
          await window.ensureSozlukJsonInBackupFolder({force:false, showStatus:false});
        }
      }catch(e){}
      if(!dictReady()){ try{ await loadDict(); }catch(e){} } // fixes.js fallback (GitHub raw)
    }

    var tries=0;
    function tick(){
      var fEl=document.getElementById('wmGateFolder');
      var dEl=document.getElementById('wmGateDict');
      var fBtn=document.getElementById('wmGateFolderBtn');

      var fReady=folderReady();
      var dReadyNow=dictReady();

      if(fEl) fEl.innerHTML = fReady ? '✅ Yedekleme klasörü aktif' : '⚠️ Yedekleme klasörü seçilmedi';
      if(fBtn) fBtn.style.display = fReady ? 'none' : 'block';
      if(dEl) dEl.innerHTML = dReadyNow ? ('✅ Sözlük hazır ('+Object.keys(window.WM_Dictionary).length+' kelime)') : '⏳ Sözlük yükleniyor…';

      if(fReady && dReadyNow){ hideGate(); return; }

      // klasör hazırsa ve sözlük değilse, hazırlamayı tetikle (en fazla birkaç kez)
      if(fReady && !dReadyNow && tries<6){ tries++; ensureDict(); }

      setTimeout(tick, 700);
    }

    function start(){
      showGate();
      var btn=document.getElementById('wmGateFolderBtn');
      if(btn) btn.onclick=function(){
        try{
          if(typeof window.selectBackupFolder==='function'){
            Promise.resolve(window.selectBackupFolder()).then(function(){ tries=0; ensureDict(); });
          }
        }catch(e){}
      };
      tick();
    }

    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded', function(){ setTimeout(start, 300); });
    }else{
      setTimeout(start, 300);
    }
  })();
})();

/* ═══════════════════════════════════════════════════════════════
   GRAMATİK RENKLENDİRME (POS Coloring) — sc-word kelime kartı cümlesi
   - Groq AI ile her kelimenin gramatik görevini bulur, renklendirir.
   - Sonuç IndexedDB'de (WMStore, wm_pos_ prefix) cache'lenir; aynı
     cümle için bir daha AI'ya sorulmaz.
   - Mevcut span'lerin metni/onclick'i KORUNUR; sadece color güncellenir.
   ═══════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  // Gramatik görev → renk (CSS değişkeniyle uyumlu, açık/koyu temada okunur)
  var POS_COLORS = {
    noun:        '#60a5fa', // mavi — isim
    pronoun:     '#38bdf8', // açık mavi — zamir
    verb:        '#f87171', // kırmızı — fiil
    auxiliary:   '#fb923c', // turuncu — yardımcı fiil
    adjective:   '#4ade80', // yeşil — sıfat
    adverb:      '#a78bfa', // mor — zarf
    preposition: '#fbbf24', // sarı — edat
    conjunction: '#f472b6', // pembe — bağlaç
    article:     '#94a3b8', // gri — artikel (a/an/the)
    determiner:  '#94a3b8', // gri — belirteç
    numeral:     '#22d3ee', // camgöbeği — sayı
    interjection:'#e879f9', // ünlem
    other:       'inherit'
  };
  // Türkçe etiket (lejant + tooltip için)
  var POS_TR = {
    noun:'isim', pronoun:'zamir', verb:'fiil', auxiliary:'yardımcı fiil',
    adjective:'sıfat', adverb:'zarf', preposition:'edat', conjunction:'bağlaç',
    article:'artikel', determiner:'belirteç', numeral:'sayı',
    interjection:'ünlem', other:'diğer'
  };

  function normKey(s){
    return 'wm_pos_' + String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
  }
  function cleanWord(w){
    return String(w||'').replace(/[^a-zA-Z']/g,'').toLowerCase();
  }

  // IndexedDB cache (WMStore.get/set) — yoksa sessizce atla
  function cacheGet(sentence){
    try{
      if(typeof WMStore!=='undefined' && WMStore.get){
        return Promise.resolve(WMStore.get(normKey(sentence))).then(function(v){
          if(!v) return null;
          try{ return typeof v==='string'? JSON.parse(v): v; }catch(e){ return null; }
        }).catch(function(){ return null; });
      }
    }catch(e){}
    return Promise.resolve(null);
  }
  function cacheSet(sentence, map){
    try{
      if(typeof WMStore!=='undefined' && WMStore.set){
        WMStore.set(normKey(sentence), JSON.stringify(map)).catch(function(){});
      }
    }catch(e){}
  }

  // Cümledeki span'lere POS renk haritasını uygula (metin/onclick'e dokunma)
  function applyColors(container, posMap){
    if(!container || !posMap) return;
    var spans = container.querySelectorAll('span');
    spans.forEach(function(sp){
      // İç içe span varsa en küçük (yaprak) olanı boya
      if(sp.querySelector('span')) return;
      var w = cleanWord(sp.textContent);
      if(!w) return;
      var pos = posMap[w];
      if(!pos) return;
      var color = POS_COLORS[pos] || POS_COLORS.other;
      if(color && color!=='inherit'){
        sp.style.color = color;
        sp.style.fontWeight = '700';
        sp.setAttribute('data-pos', pos);
        sp.title = (sp.title? sp.title+' · ':'') + (POS_TR[pos]||pos);
      }
    });
  }

  // AI'dan POS analizi al → {kelime: pos} haritası
  function fetchPOS(sentence){
    if(typeof window.callAI!=='function') return Promise.resolve(null);
    var sys = 'You are a precise English grammar parser. For each word in the sentence, '
      + 'return its part of speech. Respond ONLY with valid JSON, no markdown, no extra text. '
      + 'Format: {"word":"pos", ...} where pos is one of: '
      + 'noun, pronoun, verb, auxiliary, adjective, adverb, preposition, conjunction, '
      + 'article, determiner, numeral, interjection, other. '
      + 'Use lowercase word keys (strip punctuation). Keep it minimal.';
    var usr = 'Sentence: ' + sentence;
    return Promise.resolve(window.callAI(sys, usr, 'explain')).then(function(res){
      var raw = (res && (res.content||res.text)) || res || '';
      raw = String(raw).replace(/```json|```/g,'').trim();
      var s = raw.indexOf('{'), e = raw.lastIndexOf('}');
      if(s<0||e<0) return null;
      try{
        var obj = JSON.parse(raw.substring(s, e+1));
        var clean = {};
        Object.keys(obj).forEach(function(k){
          var ck = cleanWord(k);
          var pv = String(obj[k]||'').toLowerCase().trim();
          if(ck && POS_COLORS.hasOwnProperty(pv)) clean[ck] = pv;
        });
        return Object.keys(clean).length? clean : null;
      }catch(err){ return null; }
    }).catch(function(){ return null; });
  }

  var _busy = false;          // aynı anda tek istek
  var _lastSentence = '';     // tekrar render'da gereksiz iş yapma

  function colorizeCurrentSentence(force){
    var screen = document.getElementById('sc-word');
    if(!screen || !screen.classList.contains('active')) return;
    var card = document.getElementById('wordCard');
    if(!card) return;
    var sentEl = card.querySelector('.wc-sent');
    if(!sentEl) return;

    var sentence = sentEl.textContent.replace(/\s+/g,' ').trim();
    if(!sentence || sentence.length<3) return;
    if(!force && sentence===_lastSentence && sentEl.getAttribute('data-pos-done')==='1') return;
    _lastSentence = sentence;

    // 1) Cache (IndexedDB) — varsa AI'ya sorma
    cacheGet(sentence).then(function(cached){
      if(cached){
        applyColors(sentEl, cached);
        sentEl.setAttribute('data-pos-done','1');
        return;
      }
      // 2) Cache yok → AI'ya sor (sessiz; cümle zaten görünür durumda)
      if(_busy) return;
      _busy = true;
      // güvenlik: AI takılırsa kilit sonsuza kalmasın (mobil ağ)
      var _guard = setTimeout(function(){ _busy = false; }, 15000);
      fetchPOS(sentence).then(function(map){
        clearTimeout(_guard); _busy = false;
        if(!map) return;
        // Render değişmiş olabilir; hâlâ aynı cümle mi kontrol et
        var nowEl = document.getElementById('wordCard') &&
                    document.getElementById('wordCard').querySelector('.wc-sent');
        if(nowEl && nowEl.textContent.replace(/\s+/g,' ').trim()===sentence){
          applyColors(nowEl, map);
          nowEl.setAttribute('data-pos-done','1');
        }
        cacheSet(sentence, map); // kalıcı sakla
      }).catch(function(){ clearTimeout(_guard); _busy = false; });
    });
  }

  // renderLearn sonrası .wc-sent değişince tetikle (otomatik)
  function watch(){
    var card = document.getElementById('wordCard');
    if(!card) return;
    try{
      var mo = new MutationObserver(function(){
        clearTimeout(window.__wmPosTimer);
        window.__wmPosTimer = setTimeout(function(){ colorizeCurrentSentence(false); }, 250);
      });
      mo.observe(card, {childList:true, subtree:true, characterData:true});
    }catch(e){}
    // İlk yükleme
    setTimeout(function(){ colorizeCurrentSentence(false); }, 600);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(watch, 800); });
  }else{
    setTimeout(watch, 800);
  }

  // Dışarıdan erişim (manuel tetikleme/debug)
  window.WM_colorizePOS = function(){ colorizeCurrentSentence(true); };
  // Sessiz tetik (cache kullanır, AI'ya yalnız cache yoksa sorar) — refreshWordScreen kullanır
  window.WM_colorizePOSSilent = function(){ try{ colorizeCurrentSentence(false); }catch(e){} };

  // GENEL: herhangi bir cümle elemanını aynı cache+AI zinciriyle boya (yeni sade ekran kullanır)
  window.WM_colorizeEl = function(el, force){
    try{
      if(!el) return;
      var sentence = el.textContent.replace(/\s+/g,' ').trim();
      if(!sentence || sentence.length<3) return;
      if(!force && el.getAttribute('data-pos-done')==='1') return;
      cacheGet(sentence).then(function(cached){
        if(cached){ applyColors(el, cached); el.setAttribute('data-pos-done','1'); return; }
        if(window.__wmPosElBusy) return; window.__wmPosElBusy = true;   // AYRI kilit (normal ekranı engellemez)
        fetchPOS(sentence).then(function(map){
          window.__wmPosElBusy = false;
          if(!map) return;
          if(el.isConnected && el.textContent.replace(/\s+/g,' ').trim()===sentence){
            applyColors(el, map); el.setAttribute('data-pos-done','1');
          }
          cacheSet(sentence, map);
        }).catch(function(){ window.__wmPosElBusy = false; });
      });
    }catch(e){}
  };
})();

/* ════════════════════════════════════════════════════════════════════
   SADE KELİME EKRANI  —  ayrı bağımsız ekran (sc-simple) + yan menü düğmesi
   - Mevcut sc-word AYNEN durur. Bu YENİ bir ekran.
   - Yan menüye "📖 Sade Kelime" düğmesi eklenir → showScreen('sc-simple').
   - Aynı veriyi (window.words / window.idx) ve aynı ileri/geri fonksiyonlarını
     (WM_forceNextWord/PrevWord) kullanır; mevcut idx ile senkron.
   - İçerik: görsel + CEFR seviye + RENKLİ cümle (WM_colorizeEl) + Türkçe
     + küçük 🔊/◀▶ düğmeleri + ⋯ (alttan açılır boş panel iskeleti).
   - Seslendirme: mevcut global speakSentence() / speakTR().
   ════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  function data(){
    if(Array.isArray(window.words) && window.words.length) return window.words;
    if(Array.isArray(window.allWords) && window.allWords.length) return window.allWords;
    return [];
  }
  function curIdx(){ return Number(window.idx || window.currentIndex || window.wordIndex || 0) || 0; }

  // idx'i değiştir + (legacy iç idx dahil) tüm idx'leri senkronla + SADECE sade ekranı çiz
  // (sc-word'e DOKUNMAZ — refreshWordScreen/showScreen çağırmaz)
  function step(delta){
    var arr=data(), n=arr.length;
    if(!n) return;
    var i = curIdx() + delta;
    if(i<0) i=0; if(i>n-1) i=n-1;
    // WM_syncIdx (=nav setIndex) legacy iç 'idx' + window.idx/currentIndex/wordIndex hepsini set eder
    if(window.WM_syncIdx){ window.WM_syncIdx(i); }
    else { try{ window.idx=i; window.currentIndex=i; window.wordIndex=i; }catch(e){} }
    // sıradaki görselleri arka planda ön-yükle (anında geçiş)
    try{
      if(window.WM_prefetchImage){
        for(var k=1;k<=2;k++){ var nx=arr[i+k]; if(nx) window.WM_prefetchImage(nx.sentence||nx.cumle||'', nx.word||nx.Kelime||''); }
      }
    }catch(e){}
    render();
  }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function lvl(r){ return String(r&&(r.sentenceLevel||r.level||r.cefr||r.CEFR)||'').trim(); }

  /* ---- ekran DOM'unu bir kez oluştur ---- */
  function ensureScreen(){
    if(document.getElementById('sc-simple')) return;
    var scr = document.createElement('div');
    scr.className = 'screen';
    scr.id = 'sc-simple';
    scr.style.display = 'none';
    scr.innerHTML =
      '<div class="top-bar" style="display:flex;align-items:center;gap:8px;padding:10px 12px">'
      + '  <button class="back-btn" type="button" id="wm-simple-back" style="background:none;border:none;color:var(--accent,#60a5fa);font-size:22px;cursor:pointer">←</button>'
      + '  <div style="flex:1;height:5px;background:var(--bg3,#1e293b);border-radius:99px;overflow:hidden">'
      + '    <div id="wm-simple-prog" style="height:100%;width:0;background:var(--accent,#2563eb);transition:width .3s"></div>'
      + '  </div>'
      + '</div>'
      + '<div id="wm-simple-card" style="max-width:480px;margin:0 auto;padding:8px 16px 24px">'
      + '  <div class="wm-s-imgwrap" id="wm-s-imgwrap" style="width:100%;min-height:200px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:var(--bg3,#1b2230);overflow:hidden;margin-bottom:14px">'
      + '    <img id="wm-s-img" alt="" style="width:100%;height:188px;object-fit:cover;border-radius:14px;display:none">'
      + '    <span id="wm-s-imgph" style="color:var(--muted,#475569);font-size:13px">görsel yükleniyor…</span>'
      + '  </div>'
      + '  <div id="wm-s-level" style="display:flex;justify-content:center;margin-bottom:10px"></div>'
      + '  <div class="wc-sent" id="wm-s-sent" style="font-size:21px;line-height:1.45;font-weight:700;text-align:center;margin:2px 0 8px"></div>'
      + '  <div id="wm-s-tr" style="text-align:center;color:var(--muted,#94a3b8);font-size:14px;margin:0 0 18px"></div>'
      + '  <div style="display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;align-items:center;padding:10px;background:var(--bg3,#1b2230);border:1.5px solid var(--border,#334155);border-radius:14px">'
      + '    <button type="button" id="wm-s-prev" aria-label="Önceki" style="width:42px;height:42px;border-radius:10px;background:var(--bg2,#0f1623);border:1.5px solid var(--border,#334155);color:var(--text,#cbd5e1);font-size:15px;cursor:pointer">◀</button>'
      + '    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'
      + '      <button type="button" id="wm-s-spk" style="height:42px;border-radius:10px;background:var(--bg2,#0f1623);border:1.5px solid var(--border,#334155);color:var(--text,#cbd5e1);font-size:12px;font-weight:700;cursor:pointer">🔊 Cümle</button>'
      + '      <button type="button" id="wm-s-spktr" style="height:42px;border-radius:10px;background:var(--bg2,#0f1623);border:1.5px solid var(--border,#334155);color:var(--text,#cbd5e1);font-size:12px;font-weight:700;cursor:pointer">🔊 Çeviri</button>'
      + '    </div>'
      + '    <button type="button" id="wm-s-more" aria-label="Daha fazla" style="width:42px;height:42px;border-radius:10px;background:var(--bg2,#0f1623);border:1.5px solid var(--border,#475569);color:var(--accent,#93c5fd);font-size:18px;font-weight:800;cursor:pointer;line-height:1">⋯</button>'
      + '    <button type="button" id="wm-s-next" aria-label="Sonraki" style="width:42px;height:42px;border-radius:10px;background:var(--accent,#2563eb);border:none;color:#fff;font-size:15px;cursor:pointer">▶</button>'
      + '  </div>'
      + '</div>';

    // ekranlar konteynerine ekle (sc-word'ün yanına)
    var host = document.getElementById('sc-word');
    if(host && host.parentNode) host.parentNode.appendChild(scr);
    else document.body.appendChild(scr);

    // olay bağla — mevcut global fonksiyonları çağırır (handler taklidi değil)
    document.getElementById('wm-simple-back').addEventListener('click', function(){ try{ if(window.goHome) goHome(); else if(window.showScreen) showScreen('sc-word'); }catch(e){} });
    document.getElementById('wm-s-prev').addEventListener('click', function(){ step(-1); });
    document.getElementById('wm-s-next').addEventListener('click', function(){ step(+1); });
    document.getElementById('wm-s-spk').addEventListener('click', function(){ try{ window.speakSentence && window.speakSentence(); }catch(e){} });
    document.getElementById('wm-s-spktr').addEventListener('click', function(){ try{ window.speakTR && window.speakTR(); }catch(e){} });
    document.getElementById('wm-s-more').addEventListener('click', openSheet);
  }

  /* ---- bottom sheet iskeleti ---- */
  function ensureSheet(){
    if(document.getElementById('wm-s-sheet')) return;
    if(!document.getElementById('wm-s-sheet-css')){
      var st=document.createElement('style'); st.id='wm-s-sheet-css';
      st.textContent =
        '.wm-s-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9998;opacity:0;pointer-events:none;transition:opacity .25s}'
        +'.wm-s-backdrop.open{opacity:1;pointer-events:auto}'
        +'.wm-s-sheet{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:var(--bg2,#0f1623);border-top:1px solid var(--border,#1e293b);border-radius:18px 18px 0 0;padding:10px 16px calc(18px + env(safe-area-inset-bottom)) 16px;transform:translateY(105%);transition:transform .28s cubic-bezier(.22,1,.36,1);max-height:70vh;overflow-y:auto}'
        +'.wm-s-sheet.open{transform:translateY(0)}'
        +'.wm-s-grip{width:36px;height:4px;border-radius:99px;background:var(--border,#334155);margin:4px auto 14px}'
        +'.wm-s-ttl{font-size:13px;font-weight:800;color:var(--muted,#94a3b8);margin:0 0 12px;text-align:center}'
        +'.wm-s-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
        +'.wm-s-sec{font-size:11px;font-weight:800;color:var(--muted,#64748b);margin:14px 2px 8px;letter-spacing:.3px}'
        +'.wm-s-sec:first-of-type{margin-top:2px}'
        +'.wm-s-emp{grid-column:1/-1;text-align:center;color:var(--muted,#64748b);font-size:13px;padding:18px 0}'
        +'.wm-s-b{height:46px;border-radius:12px;background:var(--bg3,#1b2230);border:1.5px solid var(--border,#334155);color:var(--text,#e2e8f0);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}'
        +'.wm-s-b:active{transform:scale(.97)}'
        +'body.light-mode .wm-s-backdrop{background:rgba(0,0,0,.35)}';
      document.head.appendChild(st);
    }
    var bd=document.createElement('div'); bd.className='wm-s-backdrop'; bd.id='wm-s-backdrop'; bd.addEventListener('click',closeSheet);
    var sh=document.createElement('div'); sh.className='wm-s-sheet'; sh.id='wm-s-sheet';
    sh.innerHTML=
      '<div class="wm-s-grip"></div>'
      + '<div class="wm-s-sec">GÖRSEL</div>'
      + '<div class="wm-s-grid">'
      + '  <button type="button" class="wm-s-b" id="wm-s-alt">🔄 Alternatif seç</button>'
      + '  <button type="button" class="wm-s-b" id="wm-s-aiimg">🤖 AI resim üret</button>'
      + '</div>'
      + '<div class="wm-s-sec">ÖZELLİKLER</div>'
      + '<div class="wm-s-grid">'
      + '  <button type="button" class="wm-s-b" id="wm-s-shadow">🎧 Shadow</button>'
      + '  <button type="button" class="wm-s-b" id="wm-s-studio">🎚️ Shadowing Studio v2</button>'
      + '  <button type="button" class="wm-s-b" id="wm-s-context">🧩 Context</button>'
      + '  <button type="button" class="wm-s-b" id="wm-s-tree">🌳 Kelime Ağacı</button>'
      + '</div>';
    document.body.appendChild(bd); document.body.appendChild(sh);

    // — eylemleri bağla (gerçek fonksiyonlar; bu cümle/idx ile) —
    var on=function(id, fn){ var b=document.getElementById(id); if(b) b.addEventListener('click', function(){ try{ fn(); }catch(e){ console.warn('Sade panel eylemi:', e); } closeSheet(); }); };
    on('wm-s-alt',    actAltSelect);
    on('wm-s-aiimg',  actAiImage);
    on('wm-s-shadow', actShadow);
    on('wm-s-studio', actStudio);
    on('wm-s-context',actContext);
    on('wm-s-tree',   actTree);
  }
  function openSheet(){ ensureSheet(); var b=document.getElementById('wm-s-backdrop'),s=document.getElementById('wm-s-sheet'); if(b)b.classList.add('open'); if(s)s.classList.add('open'); }
  function closeSheet(){ var b=document.getElementById('wm-s-backdrop'),s=document.getElementById('wm-s-sheet'); if(b)b.classList.remove('open'); if(s)s.classList.remove('open'); }

  /* ===== ⋯ panel eylemleri — hepsi mevcut idx/cümleyi kullanır ===== */
  function curRow(){ return data()[curIdx()] || {}; }
  function curSent(){ var r=curRow(); return r.sentence||r.cumle||r.example||r.Sentence||''; }
  function curWord(){ var r=curRow(); return r.word||r.Kelime||r.english||''; }

  // GÖRSEL: alternatif seç — sade ekranın kendi görseline alternatif paneli aç
  function actAltSelect(){
    if(window.WM_openAltSelector){ window.WM_openAltSelector(curSent(), curWord(), 'wm-s-img'); }
    else { alert('Alternatif seçici hazır değil.'); }
  }
  // GÖRSEL: AI ile resim/kriter üret — aynı zincirin AI aramasını sade ekrana uygula
  function actAiImage(){
    if(window.WM_aiImageFor){ window.WM_aiImageFor(curSent(), curWord(), 'wm-s-img'); }
    else { alert('AI görsel üretimi hazır değil.'); }
  }

  // Shadow: kendi ekranını aç, listeyi SADECE aktif cümleye indir (tek cümle)
  function actShadow(){
    var r=curRow();
    var sent=curSent();
    if(!sent){ alert('Bu kelimenin cümlesi yok.'); return; }
    try{ if(window.showScreen) showScreen('sc-shadow'); }catch(e){}
    // shadowPhrases'i tek elemana indir → liste yalnız aktif cümleyi gösterir
    var doSet=function(){
      try{
        window.shadowPhrases = [{ en: sent, tr: r.sentenceTr||r.cumleTr||r.tr||'', word: curWord(), done:false, score:null }];
        try{ window.shadowIdx = 0; }catch(e){}
        if(window.renderShadowList) window.renderShadowList();
        if(window.selectShadowPhrase) window.selectShadowPhrase(0);
      }catch(e){}
    };
    // ekran/DOM hazır olsun diye kısa bekle, sonra set et (loadShadowPhrases'i EZERİZ)
    setTimeout(doSet, 60);
    // openShadowMode otomatik loadShadowPhrases çağırırsa onu da geçersiz kılmak için bir kez daha
    setTimeout(doSet, 250);
  }

  // Shadowing Studio v2: overlay aç, input'a bu cümleyi yaz
  function actStudio(){
    var sent=curSent();
    try{ if(window.ffOpen) ffOpen('shad'); }catch(e){}
    var tries=0, iv=setInterval(function(){
      tries++;
      var inp=document.getElementById('ffST');
      if(inp){ inp.value=sent||inp.value; clearInterval(iv); try{ if(window.shStop) shStop(); }catch(e){} return; }
      if(tries>20) clearInterval(iv);
    }, 120);
  }

  // Context: kendi ekranını aç — words[idx].word'ü otomatik alır (idx senkron)
  function actContext(){
    try{ if(window.openContextAnalysis) openContextAnalysis(); }catch(e){}
  }

  // Kelime Ağacı: ekranını aç + kur (allWords üzerinden)
  function actTree(){
    try{
      if(window.showScreen) showScreen('sc-wordgraph');     // varsa graf ekranı
    }catch(e){}
    try{ if(window.buildWordGraph) buildWordGraph(); }catch(e){}
  }
  window.WM_openWordSheet = openSheet;

  /* ---- ekranı mevcut idx verisiyle doldur ---- */
  function render(){
    ensureScreen();
    var arr=data(), i=curIdx(), row=arr[i]||{};
    var sent = row.sentence || row.cumle || row.example || row.Sentence || '';
    var tr   = row.sentenceTr || row.cumleTr || row.tr || row.Turkce || '';
    var word = row.word || row.Kelime || row.english || '';
    var L = lvl(row);

    var prog=document.getElementById('wm-simple-prog');
    if(prog) prog.style.width = (arr.length? (i/arr.length*100):0)+'%';

    var lvlEl=document.getElementById('wm-s-level');
    if(lvlEl) lvlEl.innerHTML = L ? '<span style="background:#173a6b;color:#93c5fd;font-size:11px;font-weight:800;padding:3px 11px;border-radius:99px">'+esc(L)+'</span>' : '';

    var sentEl=document.getElementById('wm-s-sent');
    if(sentEl){
      // mevcut renkli cümle üreticisi varsa onu kullan (highlight/span yapısı korunur), yoksa düz metin
      if(window.mkSentColored && sent){
        try{ sentEl.innerHTML = window.mkSentColored(sent, row.highlights, row.colors); }
        catch(e){ sentEl.textContent = sent; }
      } else { sentEl.textContent = sent || word; }
      sentEl.removeAttribute('data-pos-done');
      // POS renklendir (aynı cache+AI zinciri, ortak)
      if(window.WM_colorizeEl) setTimeout(function(){ window.WM_colorizeEl(sentEl, false); }, 80);
    }

    var trEl=document.getElementById('wm-s-tr');
    if(trEl) trEl.textContent = tr || '';

    // görsel — WM_getImageFor URL döndürür (aynı cache+arama zinciri), cache'te anında
    var img=document.getElementById('wm-s-img'), ph=document.getElementById('wm-s-imgph');
    if(img){
      img.removeAttribute('src'); img.style.display='none'; if(ph){ ph.style.display=''; ph.textContent='görsel yükleniyor…'; }
      var done=function(url){
        if(url){ img.src=url; img.style.display=''; if(ph) ph.style.display='none'; }
        else { if(ph){ ph.style.display=''; ph.textContent='görsel yok'; } }
      };
      try{
        if(window.WM_getImageFor){ Promise.resolve(window.WM_getImageFor(sent,word)).then(done).catch(function(){ done(''); }); }
        else if(window.loadSentenceImage){ window.loadSentenceImage(sent, word); setTimeout(function(){ var le=document.getElementById('sentImg'); done(le&&le.src?le.src:''); }, 500); }
      }catch(e){ done(''); }
    }
  }
  window.WM_renderSimpleScreen = render;

  // Yan menüden çağrılır: ekranı kur, göster, doldur
  window.WM_openSimpleScreen = function(){
    ensureScreen();
    try{ if(window.showScreen) showScreen('sc-simple'); }catch(e){}
    render();
  };

  /* ---- başlat ---- */
  function init(){
    ensureScreen();
    // sade ekran aktifken ileri/geri başka yollarla değişirse yeniden çiz
    try{
      new MutationObserver(function(){
        var s=document.getElementById('sc-simple');
        if(s && s.classList.contains('active')) render();
      }).observe(document.getElementById('wordCard')||document.body, {childList:true, subtree:false});
    }catch(e){}
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 500); });
  }else{
    setTimeout(init, 500);
  }
})();

/* ════════════════════════════════════════════════════════════════════
   META TEKRARINI KALDIR  —  kelime kartında v13/v14/v15 meta blokları aynı
   bilgiyi (kelime · seviye · gramer) 3 kez basıyordu. v14'ü (etiketli:
   "📊 Seviye: A2 · 🏗️ Gramer: ...") TUT, v13 (.wm-v13-meta) ve v15
   (.wm-v15-meta) bloklarını DOM'dan KALDIR. legacy-app.js üretir; biz
   üretildikten sonra sileriz (salt-okunur dosyaya dokunmadan).
   ════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  function stripDup(root){
    try{
      var scope = root || document;
      // 1) v13/v15 meta tekrarları kaldır (v14 KALIR). v14'te SADECE ilk kelime
      //    chip'ini (🎯 wm-v14-target) kaldır — Seviye/Gramer kalsın.
      var dups = scope.querySelectorAll('.wm-v13-meta, .wm-v15-meta');
      for(var i=0;i<dups.length;i++){ dups[i].remove(); }
      var tgt = scope.querySelectorAll('.wm-v14-target');
      for(var ti=0;ti<tgt.length;ti++){ tgt[ti].remove(); }

      // 2) Kelime başlığı bloğu: kelime + fonetik + Türkçe anlam (cümle odaklı görünüm)
      var wt = scope.querySelectorAll('.wc-word, .wc-phonetic, .wc-tr');
      for(var j=0;j<wt.length;j++){ wt[j].remove(); }

      // 3) "Benzer Cümleler" panelinde SADECE başlık + açıklama yazısını kaldır
      //    (butonlar kalır). wm-v21-title/sub başka panellerde de var → metinle hedefle.
      var titles = scope.querySelectorAll('.wm-v21-title');
      for(var k=0;k<titles.length;k++){
        var tEl = titles[k];
        if((tEl.textContent||'').indexOf('Benzer Cümleler') >= 0){
          // hemen sonraki kardeş wm-v21-sub ise onu da kaldır
          var nx = tEl.nextElementSibling;
          if(nx && nx.classList && nx.classList.contains('wm-v21-sub')) nx.remove();
          tEl.remove();
        }
      }

      // 4) "🧭 Cümle Koçu" mini paneli — benzersiz id ile güvenli kaldırma
      var coach = scope.querySelector ? scope.querySelector('#wmV21SentenceMini') : null;
      if(coach) coach.remove();
      // (scope querySelector id'yi bulamazsa document'tan da dene)
      var coach2 = document.getElementById('wmV21SentenceMini');
      if(coach2) coach2.remove();

      // 5) Skor paneli: 100 + bar + "Mükemmel" kaldır AMA "Öğrendim" (#btnLearned) KALSIN
      //    score-bar içinde score-num / score-track / score-lbl + btnLearned bir arada.
      var sNum  = scope.querySelectorAll('.score-num');   for(var a=0;a<sNum.length;a++) sNum[a].remove();
      var sTrk  = scope.querySelectorAll('.score-track');  for(var b=0;b<sTrk.length;b++) sTrk[b].remove();
      var sLbl  = scope.querySelectorAll('.score-lbl');    for(var c=0;c<sLbl.length;c++) sLbl[c].remove();

      // 6) KIRMIZI alt panel (#sentenceModeMeta — sentence-mode-core üretir): tamamen kaldır
      var smm = document.getElementById('sentenceModeMeta');
      if(smm) smm.remove();

      // 6b) Üstteki tek yeşil "🚀 Çalışmaya Alındı / Öğrenmeye Başladım" (#btnLearned) → kaldır
      //     (aynı işlev aksiyon satırındaki #wmFixedLearnedBtn'de var)
      var bl = document.getElementById('btnLearned');
      if(bl) bl.remove();

      // 6c) SARI bar açıklama yazısını kaldır (#wmFixedLearnedBar .wm-fixed-status)
      var fixedStatus = document.querySelectorAll('#wmFixedLearnedBar .wm-fixed-status');
      for(var f=0;f<fixedStatus.length;f++){ fixedStatus[f].remove(); }

      // 6d) Turuncu "🏆 Bu cümleyi gerçek hayatta kullandım" barı (.wm-sent-real-btn) → kaldır
      //     (aynı işlev paneldeki #wmSentenceRealUseBtn'de var)
      var orange = scope.querySelectorAll('.wm-sent-real-btn');
      for(var orn=0;orn<orange.length;orn++){ orange[orn].remove(); }

      // 7) "cumleler" liste adını (.wc-label) en alttaki "6 / 14176 kelime" (#wordCounter) yanına taşı
      moveListNameToCounter();

      // 8) ⋯ butonu (ileri/geri bar'ına) + alttan açılan panel; TÜM ekstralar panele taşınır:
      //    Öğrenmeye Başladım, Gerçek Hayatta, Durum (SR kutusu), Cümle Ailesi
      ensureMoreButton();
      buildWordSheet();
    }catch(e){}
  }

  /* "cumleler" liste adını #wordCounter'ın yanına al ("6 / 14176 kelime · cumleler") */
  function moveListNameToCounter(){
    try{
      var counter = document.getElementById('wordCounter');
      var label = document.querySelector('#wordCard .wc-label');
      // liste adını label'dan al; label yoksa daha önce sakladığımızı kullan
      var name = label ? (label.textContent||'').trim() : (window.__wmListName||'');
      if(label && name){ window.__wmListName = name; label.remove(); } // karttaki kopyayı kaldır, adı sakla
      if(!counter || !name) return;
      // counter metni updateWordCounter ile her render sıfırlanır → adı yoksa ekle
      if(counter.textContent.indexOf(name) === -1){
        var base = (counter.textContent||'').trim();
        counter.textContent = base ? (base + ' · ' + name) : name;
      }
    }catch(e){}
  }

  /* ⋯ butonunu normal ekranın ileri/geri bar'ına, ▶ (navNextWord) soluna ekle */
  function ensureMoreButton(){
    try{
      var card = document.getElementById('wordCard');
      if(!card) return;
      var nextBtn = card.querySelector('button[onclick*="navNextWord"]');
      if(!nextBtn) return;                               // bar henüz yok
      var bar = nextBtn.parentNode;
      // Bar 'auto 1fr auto' (3 sütun) → ⋯ eklenince ▶ alta düşüyordu.
      // Tek satır için 4 sütuna çıkar: ◀ | [Kelime/Cümle] | ⋯ | ▶
      if(bar && bar.style){
        bar.style.setProperty('grid-template-columns','auto 1fr auto auto','important');
      }
      if(card.querySelector('#wmWordMoreBtn')) return;   // ⋯ zaten var
      var more = document.createElement('button');
      more.id = 'wmWordMoreBtn';
      more.type = 'button';
      more.setAttribute('aria-label','Daha fazla');
      more.textContent = '⋯';
      more.style.cssText = 'padding:10px 12px;background:var(--bg2,#0f1623);border:1.5px solid var(--border,#475569);border-radius:10px;color:var(--accent,#93c5fd);font-size:16px;font-weight:800;cursor:pointer;line-height:1;min-width:44px;';
      more.addEventListener('click', function(e){ e.preventDefault(); openWordSheet(); });
      // ▶ butonun hemen SOLUNA
      nextBtn.parentNode.insertBefore(more, nextBtn);
    }catch(e){}
  }

  /* Alttan açılan panel iskeleti (normal ekran) */
  function ensureWordSheet(){
    if(document.getElementById('wmWordSheet')) return;
    if(!document.getElementById('wmWordSheetCss')){
      var st=document.createElement('style'); st.id='wmWordSheetCss';
      st.textContent=
        '.wmws-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100040;opacity:0;pointer-events:none;transition:opacity .25s}'
        +'.wmws-backdrop.open{opacity:1;pointer-events:auto}'
        +'.wmws-sheet{position:fixed;left:0;right:0;bottom:0;z-index:100041;background:var(--bg2,#0f1623);border-top:1px solid var(--border,#1e293b);border-radius:18px 18px 0 0;padding:10px 16px calc(18px + env(safe-area-inset-bottom)) 16px;transform:translateY(105%);transition:transform .28s cubic-bezier(.22,1,.36,1);max-height:78vh;overflow-y:auto}'
        +'.wmws-sheet.open{transform:translateY(0)}'
        +'.wmws-grip{width:36px;height:4px;border-radius:99px;background:var(--border,#334155);margin:4px auto 12px}'
        +'.wmws-sec{font-size:11px;font-weight:800;color:var(--muted,#64748b);margin:12px 2px 8px}'
        +'.wmws-sec:first-of-type{margin-top:0}'
        +'#wmWordSheetBody>*{margin:0 0 8px}'
        +'body.light-mode .wmws-backdrop{background:rgba(0,0,0,.35)}';
      document.head.appendChild(st);
    }
    var bd=document.createElement('div'); bd.className='wmws-backdrop'; bd.id='wmWordSheetBackdrop'; bd.addEventListener('click', closeWordSheet);
    var sh=document.createElement('div'); sh.className='wmws-sheet'; sh.id='wmWordSheet';
    sh.innerHTML='<div class="wmws-grip"></div><div id="wmWordSheetBody"></div>';
    document.body.appendChild(bd); document.body.appendChild(sh);
  }
  function openWordSheet(){ ensureWordSheet(); var b=document.getElementById('wmWordSheetBackdrop'),s=document.getElementById('wmWordSheet'); if(b)b.classList.add('open'); if(s)s.classList.add('open'); }
  function closeWordSheet(){ var b=document.getElementById('wmWordSheetBackdrop'),s=document.getElementById('wmWordSheet'); if(b)b.classList.remove('open'); if(s)s.classList.remove('open'); }

  /* Gerçek elemanları panele TAŞI (kopya değil — işlevleri korunur) */
  function buildWordSheet(){
    try{
      ensureWordSheet();
      var body = document.getElementById('wmWordSheetBody');
      if(!body) return;

      // renderLearn karttaki elemanları yeniden ÜRETMİŞ olabilir → panelde aynı id'li
      // ESKİ (kopuk) kopyalar varsa temizle ki birikme/çift olmasın.
      ['wmFixedLearnedBtn','wmSentenceRealUseBtn','wmV21FamilyCard'].forEach(function(id){
        var inBody = body.querySelector('#'+id);
        var newest = document.getElementById(id);            // getElementById ilk bulduğu
        // kartta taze bir kopya var ve panelde de varsa, panelden eskiyi at
        if(inBody && newest && newest!==inBody && !body.contains(newest)){
          inBody.remove();
        }
      });
      // panelde öksüz kalan SR durum kutusu (kartta yenisi belirdiyse) temizle
      var bodyStatus = body.querySelector('.wm-sentence-status');
      var cardStatus = document.querySelector('#wordCard .wm-sentence-status');
      if(bodyStatus && cardStatus && cardStatus!==bodyStatus){ bodyStatus.remove(); }

      var startBtn = document.getElementById('wmFixedLearnedBtn');
      var realBtn  = document.getElementById('wmSentenceRealUseBtn');
      var statusBox= document.querySelector('#wordCard .wm-sentence-status');
      var family   = document.getElementById('wmV21FamilyCard');

      function sec(txt, key){
        if(body.querySelector('[data-sec="'+key+'"]')) return;
        var d=document.createElement('div'); d.className='wmws-sec'; d.textContent=txt; d.setAttribute('data-sec',key); body.appendChild(d);
      }
      function move(el){
        if(!el || el.parentElement === body) return false;
        el.style.setProperty('width','100%','important');
        el.style.setProperty('margin','0','important');
        el.style.setProperty('display','block','important');
        body.appendChild(el);
        return true;
      }

      if((startBtn && startBtn.parentElement!==body) || (realBtn && realBtn.parentElement!==body)) sec('DURUM','durum');
      if(startBtn){
        move(startBtn);
        var bar=document.getElementById('wmFixedLearnedBar');
        if(bar && !bar.querySelector('#wmFixedLearnedBtn')) bar.remove();
      }
      if(realBtn) move(realBtn);

      if(statusBox && statusBox.parentElement!==body){
        sec('İLERLEME','sr');
        statusBox.style.setProperty('margin','0','important');
        body.appendChild(statusBox);
      }
      if(family && family.parentElement!==body){
        sec('CÜMLE AİLESİ','fam');
        family.style.setProperty('margin','0','important');
        body.appendChild(family);
      }

      // panel boşsa bölüm başlıklarını da gizle (hepsi öksüz kaldıysa)
      if(!body.querySelector('button, .wm-sentence-status, #wmV21FamilyCard')){
        body.querySelectorAll('.wmws-sec').forEach(function(s){ s.remove(); });
      }
    }catch(e){}
  }

  function watchCard(){
    var screen = document.getElementById('sc-word');
    var card = document.getElementById('wordCard');
    if(!screen && !card){ setTimeout(watchCard, 500); return; }
    var target = screen || card;          // tüm ekranı izle (Benzer Cümleler wordCard DIŞINDA)
    stripDup(target);                     // ilk geçiş
    try{
      var t=null;
      new MutationObserver(function(){
        clearTimeout(t);
        t = setTimeout(function(){ stripDup(target); }, 40);
      }).observe(target, {childList:true, subtree:true});
    }catch(e){
      setInterval(function(){ stripDup(target); }, 1000);
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(watchCard, 300); });
  }else{
    setTimeout(watchCard, 300);
  }
})();

/* ════════════════════════════════════════════════════════════════════
   callAI UYUMLULUK SARMALAYICISI
   Sorun: legacy callAI() düz STRING döndürüyor; ama bazı çağıranlar
   (özellikle "Kelime İlişkileri" popup'ı) sonucu r.content olarak okuyor
   → undefined → "İlişkiler yükleniyor / undefined" takılması.
   Çözüm: callAI'ı sarmala; dönen string'i hem string gibi davranan hem de
   .content / .text alanlarından okunabilen bir String nesnesine çevir.
   Mevcut çalışan yerler (r.content||r, String(r)) etkilenmez.
   ════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  function wrapResult(res){
    try{
      // zaten obje ve .content varsa dokunma
      if(res && typeof res === 'object' && ('content' in res)) return res;
      var str = (res==null) ? '' : String(res);
      var o = new String(str);     // string gibi davranır: +, String(), .replace, .trim, template
      o.content = str;
      o.text = str;
      return o;
    }catch(e){ return res; }
  }
  function install(){
    if(typeof window.callAI !== 'function') return false;
    if(window.callAI.__wmWrapped) return true;
    var orig = window.callAI;
    var wrapped = function(){
      var r = orig.apply(this, arguments);
      // callAI async → Promise döner
      if(r && typeof r.then === 'function'){
        return r.then(wrapResult);
      }
      return wrapResult(r);
    };
    wrapped.__wmWrapped = true;
    try{ window.callAI = wrapped; }catch(e){ return false; }
    return true;
  }
  // callAI gecikmeli tanımlanabilir → birkaç kez dene
  if(!install()){
    var n=0, iv=setInterval(function(){ n++; if(install()||n>40) clearInterval(iv); }, 250);
  }
})();

/* ============================================================
   KİTAP YEDEKLEME IDEMPOTENT GUARD (açılış hızlandırma)
   Sorun: her açılışta autoRestoreFromBackupFolder, JSON yedekteki
   libraryBooks'u WMStore.setBook ile IDB'ye yeniden yazıyor; v34
   kancası da aynı kitabı TXT olarak diske geri yazıyor. Büyük
   kitaplarda (100-165KB) bu, açılışın ana darboğazı.
   Çözüm: setBook'u EN DIŞTAN sar; kitap metni daha önce yazılanla
   AYNIYSA (uzunluk + hızlı hash imzası) alttaki gerçek setBook'u
   hiç çağırma → hem IDB hem TXT yazımı atlanır. Metin değişirse
   normal akış çalışır ve imza güncellenir.
   İmzalar localStorage'da tutulur (küçük, anında okunur).
   ============================================================ */
(function(){
  'use strict';
  var SIGKEY = 'wm_bookSig_v1';
  function loadSigs(){
    try{ return JSON.parse(localStorage.getItem(SIGKEY) || '{}') || {}; }
    catch(e){ return {}; }
  }
  function saveSigs(m){
    try{ localStorage.setItem(SIGKEY, JSON.stringify(m)); }catch(e){}
  }
  // Hızlı, çakışmaya dayanıklı imza: uzunluk + iki yönlü 32-bit hash
  function sig(text){
    var s = String(text||'');
    var n = s.length;
    if(!n) return 'len0';
    var h1 = 5381, h2 = 52711, i = n;
    while(i--){
      var c = s.charCodeAt(i);
      h1 = (h1 * 33 ^ c) >>> 0;
      h2 = (h2 * 33 ^ c) >>> 0;
    }
    return n + ':' + h1.toString(36) + h2.toString(36);
  }
  function wrap(store){
    if(!store || typeof store.setBook !== 'function') return false;
    if(store.__wmIdemBook) return true;
    var orig = store.setBook.bind(store);
    store.setBook = async function(id, title, text){
      try{
        if(text && String(text).trim()){
          var sigs = loadSigs();
          var key = String(id);
          var cur = sig(text);
          if(sigs[key] === cur){
            // İçerik değişmemiş → IDB ve TXT yazımını atla
            console.log('[BookGuard] ⏭️ Değişmemiş kitap atlandı:', key, '('+String(text).length+' karakter)');
            return true;
          }
          var res = await orig(id, title, text);
          // Yazma başarılıysa imzayı güncelle
          sigs[key] = cur;
          saveSigs(sigs);
          return res;
        }
      }catch(e){
        console.warn('[BookGuard] guard hatası, normal akışa düşülüyor:', e);
      }
      return orig(id, title, text);
    };
    store.__wmIdemBook = true;
    console.log('✅ Kitap yedekleme idempotent guard aktif');
    return true;
  }
  function tryInstall(){
    var store = window.WMStore || (typeof WMStore !== 'undefined' ? WMStore : null);
    return wrap(store);
  }
  // WMStore + v34 kancası gecikmeli kurulur; en dışta sarmak için bekle.
  // v34 "WM v34 kitap TXT yedekleme bağlantısı aktif" logundan SONRA
  // sarmak istiyoruz ki bizim guard en dışta kalsın. Bu yüzden
  // ilk denemeyi geciktirip tekrar deniyoruz (idempotent).
  setTimeout(function(){
    if(tryInstall()) return;
    var n=0, iv=setInterval(function(){ n++; if(tryInstall()||n>60) clearInterval(iv); }, 250);
  }, 800);
})();

/* ============================================================
   SERVICE WORKER KAYDI (gerçek ./sw.js — network-first)
   Sorun: legacy-app.js, SW'yi bir Blob URL'den register etmeye
   çalışıyor → "blob: protocol not supported" hatası → hiç SW yok.
   Ayrıca legacy açılışta tüm SW'leri unregister ediyor.
   Çözüm: legacy'nin başarısız denemesinden SONRA, gerçek ./sw.js
   dosyasını register et. sw.js network-first olduğu için kod
   güncellemeleri yine anında gelir; offline yedek de kazanılır.
   NOT: Bu çalışması için repoda kök dizinde ./sw.js bulunmalı.
   ============================================================ */
(function(){
  'use strict';
  if(!('serviceWorker' in navigator)) return;
  function register(){
    try{
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(function(reg){
          console.log('✅ Service Worker kaydedildi (sw.js network-first):', reg.scope);
        })
        .catch(function(err){
          console.warn('[SW] sw.js kaydı başarısız:', err && err.message);
        });
    }catch(e){
      console.warn('[SW] register çağrısı hatası:', e);
    }
  }
  // legacy önce eski SW'leri unregister ediyor + blob register deniyor.
  // Onlardan SONRA çalışmak için 'load' + gecikme kullan (idempotent:
  // register zaten kayıtlıysa tarayıcı no-op yapar).
  function go(){ setTimeout(register, 1500); }
  if(document.readyState === 'complete') go();
  else window.addEventListener('load', go);
})();

/* ============================================================
   KULLANICI SÖZLÜĞÜ KALICILIK DÜZELTMESİ
   Sorun: "Sözlüğe Ekle (AI ile)" kelimeyi localStorage'a yazıyor
   ama loadDict her açılışta sadece sozluk.json'u map'e koyuyordu;
   kullanıcı kelimeleri lookup map'ine hiç girmiyordu → bir sonraki
   açılışta (ve hatta popup tekrar açılınca, lookup cache "null"
   tuttuğu için) kelime yine "yerel sözlükte yok" görünüyordu.
   Çözüm:
   1) Açılışta wm_user_dictionary'yi map'e kat (WM_mergeUserDict).
   2) addWordToUserDictionary'yi sar: ekleme sonrası map'i güncelle
      + lookup cache'ini temizle ki aynı kelime anında tanınsın.
   ============================================================ */
(function(){
  'use strict';
  // 1) Açılışta hemen dene (loadDict zaten merge ediyor ama erken
  //    popup açılışlarına karşı garanti olsun); birkaç kez tekrarla.
  function tryMerge(){
    try{ if(typeof window.WM_mergeUserDict === 'function') window.WM_mergeUserDict(); }catch(e){}
  }
  tryMerge();
  setTimeout(tryMerge, 1200);
  setTimeout(tryMerge, 4200);

  // 2) addWordToUserDictionary sarmalayıcısı (ekleme sonrası senkron)
  function wrapAdd(){
    var fn = window.addWordToUserDictionary;
    if(typeof fn !== 'function' || fn.__wmDictWrapped) return (typeof fn === 'function');
    var orig = fn;
    window.addWordToUserDictionary = function(){
      var r = orig.apply(this, arguments);
      // orig async (await callAI) → Promise. İki durumu da ele al.
      function after(){
        try{
          if(typeof window.WM_mergeUserDict === 'function') window.WM_mergeUserDict();
          else if(typeof window.WM_clearLookupCache === 'function') window.WM_clearLookupCache();
        }catch(e){}
      }
      if(r && typeof r.then === 'function'){ r.then(after, after); }
      else { setTimeout(after, 50); }
      return r;
    };
    window.addWordToUserDictionary.__wmDictWrapped = true;
    console.log('✅ Kullanıcı sözlüğü kalıcılık düzeltmesi aktif');
    return true;
  }
  if(!wrapAdd()){
    var n=0, iv=setInterval(function(){ n++; if(wrapAdd()||n>60) clearInterval(iv); }, 250);
  }
})();

/* ============================================================
   MEVCUT PROJE STABILIZER v4 — 2026-06-04
   Bu bölüm mevcut dosya yapısını bozmadan son kullanıcıda görülen
   ekran çakışması, aktif liste adı, öğrenme durumu ve cache sorunlarını
   kökten azaltmak için eklendi.
   ============================================================ */
(function(){
  'use strict';
  if (window.__WM_EXISTING_PROJECT_STABILIZER_V4__) return;
  window.__WM_EXISTING_PROJECT_STABILIZER_V4__ = true;

  var LS_ACTIVE_LIST = 'wm_active_list_name_v4';
  var LS_STARTED = 'wm_sentence_started_v4';

  function q(s, root){ return (root || document).querySelector(s); }
  function qa(s, root){ return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function text(el){ return String(el && (el.textContent || el.innerText) || '').trim(); }
  function cleanName(v){
    v = String(v || '').replace(/\s+/g,' ').trim();
    if (!v) return '';
    // Liste adı yerine yanlışlıkla cümle basılmasını engelle.
    if (/[.!?]$/.test(v) && v.split(/\s+/).length > 3) return '';
    if (v.length > 42) return '';
    return v;
  }
  function toast(a,b){
    try { if (typeof window.showToast === 'function') return window.showToast(a,b||''); } catch(e){}
    console.log('[WM]', a, b||'');
  }
  function currentSentence(){
    var candidates = [
      '[data-sentence]', '.sentence-text', '#sentenceText', '#currentSentence', '.wm-sentence', '.sentence-card h2', '.word-main h2'
    ];
    for (var i=0;i<candidates.length;i++){
      var el = q(candidates[i]);
      var v = el ? (el.getAttribute('data-sentence') || text(el)) : '';
      if (v && v.length > 5 && /[a-zA-Z]/.test(v)) return v.replace(/\s+/g,' ').trim();
    }
    // görünür karttan İngilizce cümle yakala
    var visible = qa('.screen.active h1,.screen.active h2,.screen.active .card,.screen.active .wm-card').map(text).join('\n');
    var m = visible.match(/([A-Z][^\n]{10,180}[.!?])/);
    return m ? m[1].replace(/\s+/g,' ').trim() : '';
  }
  function getStartedMap(){ try { return JSON.parse(localStorage.getItem(LS_STARTED)||'{}') || {}; } catch(e){ return {}; } }
  function setStarted(sentence){
    if (!sentence) return;
    var m = getStartedMap();
    m[sentence] = m[sentence] || { startedAt: new Date().toISOString(), status: 'started' };
    try { localStorage.setItem(LS_STARTED, JSON.stringify(m)); } catch(e){}
  }
  function protectActiveListName(){
    var el = q('#currentListName');
    if (!el) return;
    var raw = text(el);
    var saved = cleanName(localStorage.getItem(LS_ACTIVE_LIST));
    var good = cleanName(raw);
    if (good && !/^ana liste$/i.test(good)) {
      try { localStorage.setItem(LS_ACTIVE_LIST, good); } catch(e){}
    } else if (saved && raw !== saved) {
      el.textContent = saved;
    }
  }
  function patchListButtons(){
    // Liste seçimi yapılan butonlarda aktif liste adını kalıcı tut.
    document.addEventListener('click', function(ev){
      var btn = ev.target && ev.target.closest ? ev.target.closest('button,[data-list-name],[data-list]') : null;
      if (!btn) return;
      var nm = btn.getAttribute('data-list-name') || btn.getAttribute('data-list') || '';
      nm = cleanName(nm || text(btn));
      if (nm && !/öğren|oku|geri|ileri|kapat|sil|ara|kaydet/i.test(nm)) {
        try { localStorage.setItem(LS_ACTIVE_LIST, nm); } catch(e){}
        setTimeout(protectActiveListName, 0);
        setTimeout(protectActiveListName, 150);
      }
    }, true);
  }
  function patchLearnButton(){
    document.addEventListener('click', function(ev){
      var btn = ev.target && ev.target.closest ? ev.target.closest('button') : null;
      if (!btn) return;
      var t = text(btn);
      if (!/Öğrenmeye\s*Başladım|Öğrendim|Henüz\s*çalışılmadı/i.test(t)) return;
      var s = currentSentence();
      if (!s) return;
      setStarted(s);
      btn.classList.add('wm-started-done');
      if (/Öğrenmeye\s*Başladım|Henüz\s*çalışılmadı/i.test(t)) btn.textContent = '✅ Başlandı';
      toast('✅ Kaydedildi','Bu cümle öğrenmeye başlandı olarak işaretlendi.');
      setTimeout(protectActiveListName, 0);
      setTimeout(markStartedOnScreen, 60);
    }, true);
  }
  function markStartedOnScreen(){
    var s = currentSentence();
    if (!s) return;
    var m = getStartedMap();
    if (!m[s]) return;
    qa('button').forEach(function(b){
      if (/Öğrenmeye\s*Başladım|Henüz\s*çalışılmadı/i.test(text(b))) {
        b.classList.add('wm-started-done');
        b.textContent = '✅ Başlandı';
      }
    });
  }
  function screenExclusivity(){
    var active = qa('.screen.active');
    if (active.length <= 1) return;
    var keep = active[active.length-1];
    active.forEach(function(s){ if (s !== keep) s.classList.remove('active'); });
  }
  function stopLeakedRecordings(){
    document.addEventListener('visibilitychange', function(){
      if (!document.hidden) return;
      try { if (typeof window.spStopRecording === 'function') window.spStopRecording(true); } catch(e){}
      try { if (window.SP_recState && window.SP_recState.stream) window.SP_recState.stream.getTracks().forEach(function(t){t.stop();}); } catch(e){}
    });
  }
  function installObserver(){
    var obs = new MutationObserver(function(){
      protectActiveListName();
      screenExclusivity();
      markStartedOnScreen();
    });
    obs.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});
  }
  function hardenMissingGlobals(){
    if (typeof window.loadTTSRateSettings !== 'function') window.loadTTSRateSettings = function(){ return {}; };
    if (typeof window.saveTimingData !== 'function') window.saveTimingData = function(){ return true; };
    if (typeof window.safeJSONParse !== 'function') window.safeJSONParse = function(v, fb){ try { return JSON.parse(v); } catch(e){ return fb; } };
  }
  function nukeOldCachesOnce(){
    // GitHub Pages'te eski JS/CSS cache karışmasını önler.
    if (!('caches' in window)) return;
    if (sessionStorage.getItem('wm_cache_checked_v4')) return;
    sessionStorage.setItem('wm_cache_checked_v4','1');
    caches.keys().then(function(keys){
      keys.filter(function(k){ return /^wordmode-free-v[123]$/.test(k); })
          .forEach(function(k){ caches.delete(k); });
    }).catch(function(){});
  }
  function start(){
    hardenMissingGlobals();
    patchListButtons();
    patchLearnButton();
    stopLeakedRecordings();
    installObserver();
    nukeOldCachesOnce();
    protectActiveListName();
    screenExclusivity();
    markStartedOnScreen();
    console.log('✅ Mevcut proje stabilizer v4 aktif');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* ============================================================
   MOBIL İLERİ/GERİ HIZLANDIRMA VE EKRAN FLICKER FIX — V5
   Sorun: İleri düğmesinde legacy onclick + global listener + MutationObserver
   aynı anda çalışıp mobilde birden fazla ekranı açıp kapatıyordu.
   Çözüm: nav tıklamasını capture aşamasında tek merkezden yakala,
   varsayılan/inline handler'ları durdur, sadece sc-word render et.
   ============================================================ */
(function(){
  'use strict';
  if (window.__WM_MOBILE_NAV_FAST_V5__) return;
  window.__WM_MOBILE_NAV_FAST_V5__ = true;

  var NAV_LOCK = false;
  var lastNavAt = 0;

  function qa(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function getData(){
    if (Array.isArray(window.words) && window.words.length) return window.words;
    if (Array.isArray(window.allWords) && window.allWords.length) return window.allWords;
    return [];
  }
  function getIndex(){
    try { if (typeof idx === 'number') return idx; } catch(e){}
    return Number(window.idx || window.currentIndex || window.wordIndex || 0) || 0;
  }
  function setIndexSafe(n){
    var arr = getData();
    var max = Math.max(0, arr.length - 1);
    var i = Math.max(0, Math.min(max, Number(n) || 0));
    try { idx = i; } catch(e){}
    try { window.idx = i; window.currentIndex = i; window.wordIndex = i; } catch(e){}
    try { if (typeof window.WM_syncIdx === 'function') window.WM_syncIdx(i); } catch(e){}
    return i;
  }
  function ensureCSS(){
    if (document.getElementById('wm-mobile-nav-fast-v5-css')) return;
    var st = document.createElement('style');
    st.id = 'wm-mobile-nav-fast-v5-css';
    st.textContent = [
      'body.wm-nav-fast *{scroll-behavior:auto!important}',
      'body.wm-nav-fast .screen,body.wm-nav-fast .card,body.wm-nav-fast .wm-card,body.wm-nav-fast #wordCard{transition:none!important;animation:none!important}',
      'body.wm-nav-fast .screen:not(#sc-word){display:none!important}',
      'body.wm-nav-fast #sc-word{display:block!important}',
      '#wordCard.wm-nav-rendering{visibility:hidden!important}',
      '#wordCard.wm-nav-ready{visibility:visible!important;opacity:1!important}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function keepOnlyWordScreen(){
    var sc = document.getElementById('sc-word');
    if (!sc) return;
    qa('.screen.active').forEach(function(s){ if (s !== sc) s.classList.remove('active'); });
    sc.classList.add('active');
    sc.style.display = '';
  }
  function prefetchNext(i){
    try{
      var arr = getData();
      if (!window.WM_prefetchImage) return;
      for (var k=1; k<=2; k++){
        var nx = arr[i+k];
        if (nx) window.WM_prefetchImage(nx.sentence || nx.cumle || '', nx.word || nx.Kelime || '');
      }
    }catch(e){}
  }
  function renderFast(){
    ensureCSS();
    document.body.classList.add('wm-nav-fast');
    keepOnlyWordScreen();
    var card = document.getElementById('wordCard');
    if (card) { card.classList.add('wm-nav-rendering'); card.classList.remove('wm-nav-ready'); }

    try { phase = 'learn'; } catch(e){}
    // showScreen sadece sc-word aktif değilse çağrılır. Her ileri basışta tekrar çağırmak mobilde ekran zincirini tetikliyordu.
    try {
      var sc = document.getElementById('sc-word');
      if (typeof showScreen === 'function' && (!sc || !sc.classList.contains('active'))) showScreen('sc-word');
    } catch(e){}
    keepOnlyWordScreen();

    try { if (typeof renderLearn === 'function') renderLearn(); } catch(e){ console.warn('[WM nav v5] renderLearn hata:', e); }
    try { if (typeof updateWordCounter === 'function') updateWordCounter(); } catch(e){}
    try { if (typeof window.WM_colorizePOSSilent === 'function') setTimeout(window.WM_colorizePOSSilent, 80); } catch(e){}

    requestAnimationFrame(function(){
      keepOnlyWordScreen();
      requestAnimationFrame(function(){
        keepOnlyWordScreen();
        var c = document.getElementById('wordCard');
        if (c) { c.classList.remove('wm-nav-rendering'); c.classList.add('wm-nav-ready'); }
        document.body.classList.remove('wm-nav-fast');
        NAV_LOCK = false;
      });
    });
  }
  function go(delta){
    var now = Date.now();
    if (NAV_LOCK && now - lastNavAt < 180) return false;
    NAV_LOCK = true;
    lastNavAt = now;
    var i = setIndexSafe(getIndex() + delta);
    prefetchNext(i);
    renderFast();
    return false;
  }

  window.WM_fastNextWordV5 = function(){ return go(+1); };
  window.WM_fastPrevWordV5 = function(){ return go(-1); };

  // Global nav fonksiyonlarını tek merkezli hızlı sürüme bağla.
  window.nextWord = window.navNextWord = window.WM_forceNextWord = window.WM_fastNextWordV5;
  window.prevWord = window.navPrevWord = window.WM_forcePrevWord = window.WM_fastPrevWordV5;

  function isWordNavButton(btn){
    if (!btn) return 0;
    var oc = String(btn.getAttribute('onclick') || '');
    var id = btn.id || '';
    var label = (btn.textContent || '').trim();
    if (/navNextWord|nextWord|WM_forceNextWord|WM_fastNextWordV5/.test(oc) || /next/i.test(id) || label === '▶' || label === '➡') return +1;
    if (/navPrevWord|prevWord|WM_forcePrevWord|WM_fastPrevWordV5/.test(oc) || /prev/i.test(id) || label === '◀' || label === '⬅') return -1;
    return 0;
  }

  // Capture aşamasında yakala: inline onclick ve eski listener'lar çalışmadan kesilir.
  document.addEventListener('click', function(ev){
    var btn = ev.target && ev.target.closest ? ev.target.closest('button') : null;
    if (!btn) return;
    var d = isWordNavButton(btn);
    if (!d) return;
    // Sadece ana öğrenme ekranındaki ileri/geri için uygula; diğer overlay/sade ekran butonlarına karışma.
    if (!btn.closest('#sc-word') && !btn.closest('#wordCard')) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    go(d);
  }, true);

  // Klavye yön tuşlarında da aynı hızlı yolu kullan.
  document.addEventListener('keydown', function(ev){
    var sc = document.getElementById('sc-word');
    if (!sc || !sc.classList.contains('active')) return;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); go(+1); }
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(-1); }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureCSS);
  else ensureCSS();
  console.log('✅ Mobil ileri/geri hızlandırma v5 aktif');
})();
