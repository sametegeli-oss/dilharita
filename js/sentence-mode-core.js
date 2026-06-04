
/* Sentence Mode Core Bridge v1 — 2026-06-01
   Amaç: Eski Word Mode işlevlerini bozmadan cümle tabanlı yapıyı tek merkezden yönetmek.
   Bu dosya sadece eksik/çakışan global fonksiyonları güvenli hale getirir. */
(function(){
  'use strict';
  if (window.__SENTENCE_MODE_CORE_V1__) return;
  window.__SENTENCE_MODE_CORE_V1__ = true;

  const LOG = (...a) => console.log('[SentenceMode]', ...a);
  const WARN = (...a) => console.warn('[SentenceMode]', ...a);

  function $(id){ return document.getElementById(id); }
  function safeText(v){ return String(v == null ? '' : v); }
  function escapeHTML(s){ return safeText(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  // 1) Toast güvenliği
  if (typeof window.showToast !== 'function') {
    window.showToast = function(title, msg, type){
      try {
        const t = document.createElement('div');
        t.className = 'sm-toast';
        t.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:999999;background:#111827;color:#fff;border:1px solid rgba(255,255,255,.15);box-shadow:0 10px 30px rgba(0,0,0,.35);border-radius:14px;padding:10px 14px;font:700 13px Nunito,Arial;max-width:92vw;line-height:1.35';
        t.innerHTML = '<div>'+escapeHTML(title||'Bilgi')+'</div>' + (msg?'<div style="font-weight:600;opacity:.8;font-size:12px;margin-top:2px">'+escapeHTML(msg)+'</div>':'');
        document.body.appendChild(t);
        setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .25s'; setTimeout(()=>t.remove(),260); }, 2400);
      } catch(e) { console.log('[Toast]', title, msg); }
    };
  }

  // 2) Eksik yardımcı fonksiyonlar
  if (typeof window.loadTTSRateSettings !== 'function') window.loadTTSRateSettings = function(){ return {}; };
  if (typeof window.saveTimingData !== 'function') window.saveTimingData = function(){ return true; };

  // 3) Cümle veri normalizasyonu
  function normalizeHighlights(highlights){
    if (Array.isArray(highlights)) return highlights.map(String).map(x=>x.trim()).filter(Boolean);
    if (!highlights) return [];
    if (typeof highlights === 'string') {
      const raw = highlights.trim();
      if (!raw) return [];
      try { const j = JSON.parse(raw); if (Array.isArray(j)) return normalizeHighlights(j); } catch(e) {}
      return raw.split(/[,;|\n]+/).map(x=>x.trim()).filter(Boolean);
    }
    if (typeof highlights === 'object') return Object.keys(highlights).filter(k => highlights[k]);
    return [];
  }
  window.normalizeHighlights = normalizeHighlights;

  function sentenceOf(item){ return safeText(item?.sentence || item?.Sentence || item?.text || item?.en || item?.english || '').trim(); }
  function sentenceTrOf(item){ return safeText(item?.sentenceTr || item?.SentenceTr || item?.sentence_tr || item?.trSentence || item?.tr || item?.translation || '').trim(); }
  function levelOf(item){ return safeText(item?.sentenceLevel || item?.SentenceLevel || item?.level || item?.cefr || '').trim(); }
  function grammarOf(item){ return safeText(item?.grammarStructure || item?.GrammarStructure || item?.grammar || item?.grammar_structure || item?.structure || '').trim(); }
  function wordOf(item){ return safeText(item?.word || item?.targetWord || item?.highlight || normalizeHighlights(item?.highlights)[0] || '').trim(); }
  function normalizeSentenceItem(item){
    item = item || {};
    return Object.assign({}, item, {
      word: wordOf(item),
      targetWord: wordOf(item),
      sentence: sentenceOf(item),
      sentenceTr: sentenceTrOf(item),
      highlights: normalizeHighlights(item.highlights || item.highlight || item.word),
      sentenceLevel: levelOf(item),
      grammarStructure: grammarOf(item)
    });
  }
  window.SM_normalizeSentenceItem = normalizeSentenceItem;

  function getData(){
    const pools = [window.allWords, window.words, window.learnedWords, window.currentWords, window.filteredWords];
    for (const p of pools) if (Array.isArray(p) && p.length) return p;
    return [];
  }
  window.SM_getSentenceData = getData;

  // 4) Cümle anahtarı ve durum saklama
  function sentenceKey(item){
    const s = sentenceOf(item) || wordOf(item) || JSON.stringify(item || {});
    let h = 2166136261;
    for (let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24); }
    return 'sent_' + (h >>> 0).toString(36) + '_' + encodeURIComponent(s.toLowerCase().slice(0,60)).replace(/%/g,'');
  }
  window.SM_sentenceKey = sentenceKey;

  function readJSON(k, fallback){ try { const v = JSON.parse(localStorage.getItem(k)||''); return v ?? fallback; } catch(e){ return fallback; } }
  function writeJSON(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ WARN('localStorage yazılamadı:', k, e); return false; } }
  function getSentenceStatus(){ return readJSON('sentenceStatus', {}) || {}; }
  function saveSentenceStatus(s){ return writeJSON('sentenceStatus', s || {}); }
  window.SM_getSentenceStatus = getSentenceStatus;
  window.SM_saveSentenceStatus = saveSentenceStatus;

  const SRS_DAYS = [1,3,7,14,30,90];
  function beginSentence(item){
    item = normalizeSentenceItem(item || getData()[window.idx || 0]);
    const key = sentenceKey(item), now = Date.now();
    const st = getSentenceStatus();
    const old = st[key] || {};
    const level = Math.max(1, old.srsLevel || 1);
    st[key] = Object.assign({}, old, {
      key,
      sentence: item.sentence,
      sentenceTr: item.sentenceTr,
      word: item.word,
      sentenceLevel: item.sentenceLevel,
      grammarStructure: item.grammarStructure,
      started: true,
      startedAt: old.startedAt || now,
      lastReview: now,
      srsLevel: level,
      nextReview: now + SRS_DAYS[Math.min(level-1, SRS_DAYS.length-1)]*86400000
    });
    saveSentenceStatus(st);
    refreshCurrentScreen();
    showToast('🚀 Öğrenmeye başladı', item.sentence.slice(0,80));
  }
  window.SM_beginSentence = beginSentence;
  window.startSentenceLearning = beginSentence;

  function markRealUse(item){
    item = normalizeSentenceItem(item || getData()[window.idx || 0]);
    const key = sentenceKey(item), now = Date.now(), today = new Date().toISOString().slice(0,10);
    const st = getSentenceStatus();
    const old = st[key] || {};
    const sameDay = old.lastRealUseDay === today;
    const uses = (old.realUseCount || 0) + (sameDay ? 0 : 1);
    const level = Math.min(6, Math.max(old.srsLevel || 1, 2) + (sameDay ? 0 : 1));
    st[key] = Object.assign({}, old, {
      key,
      sentence: item.sentence,
      sentenceTr: item.sentenceTr,
      word: item.word,
      sentenceLevel: item.sentenceLevel,
      grammarStructure: item.grammarStructure,
      started: true,
      startedAt: old.startedAt || now,
      realUsed: true,
      lastRealUse: now,
      lastRealUseDay: today,
      realUseCount: uses,
      lastReview: now,
      srsLevel: level,
      nextReview: now + SRS_DAYS[Math.min(level-1, SRS_DAYS.length-1)]*86400000
    });
    saveSentenceStatus(st);
    refreshCurrentScreen();
    showToast(sameDay ? '🏆 Bugün zaten sayıldı' : '🏆 Gerçek kullanım kaydedildi', `${uses} kez`);
  }
  window.SM_markRealUse = markRealUse;
  window.markSentenceRealUse = markRealUse;

  // 5) Ekran geçiş / sayaç / ileri geri güvenliği
  function setIndex(i){
    const data = getData();
    if (!data.length) { window.idx = 0; return 0; }
    const n = Math.max(0, Math.min(data.length-1, Number(i)||0));
    window.idx = n; window.currentIndex = n; window.wordIndex = n;
    return n;
  }
  function getIndex(){ return setIndex(window.idx ?? window.currentIndex ?? window.wordIndex ?? 0); }

  function callIfExists(names){
    for (const name of names) {
      const fn = window[name];
      if (typeof fn === 'function' && !fn.__smWrapper) { try { return fn(); } catch(e){ WARN(name, e); } }
    }
  }
  function refreshCurrentScreen(){
    try { callIfExists(['renderLearn','renderWord','renderCurrentWord','renderSentenceCard','updateWordUI']); } catch(e) {}
    try { window.SM_renderSentenceMeta && window.SM_renderSentenceMeta(); } catch(e) {}
    try { window.updateWordCounter && window.updateWordCounter(); } catch(e) {}
    fixActiveListTitle();
  }
  window.SM_refreshCurrentScreen = refreshCurrentScreen;

  if (typeof window.updateWordCounter !== 'function') {
    window.updateWordCounter = function(){
      const data = getData(); const n = getIndex();
      const txt = data.length ? `${n+1} / ${data.length}` : '0 / 0';
      ['wordCounter','counter','progressText','learnCounter','currentWordCounter'].forEach(id=>{ const el=$(id); if(el) el.textContent = txt; });
      return txt;
    };
  }
  window.navNextWord = function(){ const data=getData(); if(!data.length) return; setIndex(getIndex()+1); refreshCurrentScreen(); };
  window.navPrevWord = function(){ const data=getData(); if(!data.length) return; setIndex(getIndex()-1); refreshCurrentScreen(); };
  window.nextWord = window.navNextWord;
  window.prevWord = window.navPrevWord;

  window.goToWord = function(i){
    const data = getData(); if(!data.length) return;
    setIndex(i);
    try { if (typeof window.showScreen === 'function') window.showScreen('sc-word'); } catch(e) { WARN('showScreen', e); }
    refreshCurrentScreen();
  };
  window.goToSentence = window.goToWord;

  // 6) Başlık yanlışlıkla cümleye dönmesin
  function getActiveListName(){
    return safeText(window.currentListName || window.activeListName || localStorage.getItem('activeListName') || localStorage.getItem('currentListName') || 'Cümleler').trim() || 'Cümleler';
  }
  function fixActiveListTitle(){
    const name = getActiveListName();
    ['activeListTitle','currentListTitle','listTitle','wordListTitle','learnListTitle'].forEach(id=>{ const el=$(id); if(el) el.textContent = name; });
    const candidates = Array.from(document.querySelectorAll('.top-bar h2, .screen h2, .screen h3')).slice(0,25);
    candidates.forEach(el=>{
      const t = (el.textContent||'').trim();
      if (t.length > 45 && /[.!?]$/.test(t)) el.textContent = name;
    });
  }
  window.SM_fixActiveListTitle = fixActiveListTitle;

  // 7) Cümle meta bilgisi ve butonları, mevcut karta zarar vermeden ekle
  function statusFor(item){ return getSentenceStatus()[sentenceKey(item)] || {}; }
  function statusLabel(st){
    if (st.realUseCount >= 5) return '💎 Otomatikleşti';
    if (st.realUseCount > 0) return `🏆 Kullanıldı (${st.realUseCount})`;
    if (st.started) return '🚀 Başlandı';
    return '⚪ Yeni';
  }
  function fmtDate(ms){ if(!ms) return '—'; try { return new Date(ms).toLocaleDateString('tr-TR'); } catch(e){ return '—'; } }
  function renderSentenceMeta(){
    const data = getData(); if(!data.length) return;
    const item = normalizeSentenceItem(data[getIndex()]);
    const st = statusFor(item);
    let host = $('sentenceModeMeta');
    const main = $('mainCard') || $('wordCard') || document.querySelector('#sc-word .card') || $('sc-word');
    if (!main) return;
    if (!host) {
      host = document.createElement('div');
      host.id = 'sentenceModeMeta';
      host.style.cssText = 'margin:12px 0;padding:12px;border-radius:16px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.22);font-size:12px;line-height:1.55;color:var(--text,#e5e7eb)';
      main.appendChild(host);
    }
    host.innerHTML = `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <span style="padding:4px 8px;border-radius:999px;background:rgba(16,185,129,.15)">${escapeHTML(statusLabel(st))}</span>
        <span style="padding:4px 8px;border-radius:999px;background:rgba(59,130,246,.15)">📊 ${escapeHTML(item.sentenceLevel || '—')}</span>
        <span style="padding:4px 8px;border-radius:999px;background:rgba(168,85,247,.15)">🏗️ ${escapeHTML(item.grammarStructure || '—')}</span>
        <span style="padding:4px 8px;border-radius:999px;background:rgba(245,158,11,.15)">SRS-${escapeHTML(st.srsLevel || 'Yeni')}</span>
      </div>
      <div style="color:var(--muted,#94a3b8);margin-bottom:8px">📅 Başlama: ${fmtDate(st.startedAt)} · ⏰ Sonraki: ${fmtDate(st.nextReview)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" onclick="SM_beginSentence()" style="border:0;border-radius:12px;padding:9px 12px;font-weight:800;background:#f59e0b;color:white;cursor:pointer">🚀 Öğrenmeye Başladım</button>
        <button type="button" onclick="SM_markRealUse()" style="border:0;border-radius:12px;padding:9px 12px;font-weight:800;background:#16a34a;color:white;cursor:pointer">🏆 Gerçek Hayatta Kullandım</button>
      </div>`;
  }
  window.SM_renderSentenceMeta = renderSentenceMeta;

  // 8) showScreen varsa sarmala; yoksa basit geçiş ver
  const oldShowScreen = window.showScreen;
  function safeShowScreen(id){
    if (typeof oldShowScreen === 'function' && oldShowScreen !== safeShowScreen) {
      try { oldShowScreen(id); } catch(e) { WARN('legacy showScreen hata verdi, güvenli geçiş yapılacak:', e); }
    }
    try {
      // Legacy showScreen ekranlara inline style.display ekliyor. Sadece .active
      // class'ıyla oynamak yetmez; inline display değerini de sıfırlamazsak
      // ekranlar üst üste biner. Bu yüzden class + inline display birlikte yönetilir.
      document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
      });
      const el = $(id);
      if (el) {
        el.classList.add('active');
        el.style.display = 'block';
      }
    } catch(e) {}
    setTimeout(()=>{ fixActiveListTitle(); renderSentenceMeta(); }, 0);
  }
  safeShowScreen.__smWrapper = true;
  window.showScreen = safeShowScreen;

  // 9) Başlat
  function boot(){
    fixActiveListTitle();
    renderSentenceMeta();
    updateWordCounter();
    LOG('Sentence Mode Core v1 aktif — eski işlevler korunarak cümle yapısına geçildi.');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 400);
})();
