/* koc.js — STRATEJİK AI MENTOR & EĞİTİM DİREKTÖRÜ (V6.11 - SYNTAX ERROR FIX)
   Özellikler: Temiz Tarih Matematik Blokları (Unexpected token ) Düzeltildi) · Real-Time İlerleme Takibi · DOM-Driven Profilleme · 
               Brace + Array Balancing Parser · Karar Kartı · Çift Enjeksiyon Koruması */
(function(){
  "use strict";

  const DAY = new Date().toISOString().slice(0,10);
  const ALLOWED = ["tekrar.html?plan=1", "index-app.html", "chat.html", "practice.html", "kelime-ogren.html", "hata-defteri.html", "akilli-tekrar.html"];
  
  // ----- 1. INDEXEDDB STORAGE MIMARISI -----
  const M_DB_NAME = "dh-mentor-db";
  const M_DB_VERSION = 3;
  let cachedDbInstance = null;

  function initMentorDB() {
    if (cachedDbInstance) return Promise.resolve(cachedDbInstance);
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(M_DB_NAME, M_DB_VERSION);
        req.onupgradeneeded = function(e) {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("plans")) db.createObjectStore("plans", { keyPath: "date" });
          if (!db.objectStoreNames.contains("history")) db.createObjectStore("history", { keyPath: "date" });
          if (!db.objectStoreNames.contains("step_status")) db.createObjectStore("step_status", { keyPath: "id" });
        };
        req.onsuccess = function(e) { cachedDbInstance = e.target.result; resolve(cachedDbInstance); };
        req.onerror = function() { resolve(null); };
      } catch(_) { resolve(null); }
    });
  }

  async function dbGet(storeName, key) {
    const db = await initMentorDB(); if(!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { resolve(null); };
      } catch(_) { resolve(null); }
    });
  }

  async function dbPut(storeName, obj) {
    const db = await initMentorDB(); if(!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(obj);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function() { resolve(false); };
      } catch(_) { resolve(false); }
    });
  }

  async function dbGetAll(storeName) {
    const db = await initMentorDB(); if(!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror = function() { resolve([]); };
      } catch(_) { resolve([]); }
    });
  }

  // ----- 2. ÇİFT ENJEKSİYON KORUMALI CSS YÜKLEYİCİ -----
  if (!document.getElementById("dh-koc-style-v6")) {
    const style = document.createElement('style');
    style.id = "dh-koc-style-v6";
    style.textContent = `
      .dh-mentor-grid-container { display: grid; grid-template-columns: 1.25fr 0.75fr; gap: 20px; width: 100%; align-items: start; margin-top: 15px; }
      .dh-mentor-left-column { width: 100%; }
      .dh-mentor-right-column { display: flex; flex-direction: column; gap: 15px; width: 100%; }
      .dh-koc-card { border: 1px solid rgba(255,255,255,0.12); padding: 20px; border-radius: 14px; background: #1a1a22; color: #fff; font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.4); margin-bottom: 20px; }
      .dh-koc-card.evening-all-done { background: #0f2b18; border-color: rgba(40,167,69,0.35); }
      .dh-koc-card.evening-pending { background: #261717; border-color: rgba(220,53,69,0.35); }
      .dh-koc-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; margin-bottom: 16px; }
      .dh-koc-focus { font-size: 15.5px; font-weight: 700; color: #f4f4f6; }
      .dh-koc-badge { font-size: 11px; background: #23a142; padding: 4px 10px; border-radius: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
      .dh-koc-step { margin: 8px 0; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.02); border-radius: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; transition: all 0.25s ease; }
      .dh-koc-step.done { background: rgba(40,167,69,0.06); border-color: rgba(40,167,69,0.15); }
      .dh-koc-step-label { display: flex; align-items: center; gap: 10px; }
      .dh-koc-step-label.strike { text-decoration: line-through; opacity: 0.6; }
      .dh-koc-btn { background: #007bff; color: #fff; padding: 6px 12px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: bold; transition: background 0.2s; }
      .dh-koc-btn.pending { background: #d97706; color: #fff; }
      .dh-koc-btn.re-enter { background: #374151; color: #d1d5db; border: 1px solid rgba(255,255,255,0.05); }
      .dh-koc-mentor-box { background: rgba(234,67,53,0.03); padding: 14px; border-radius: 10px; border-left: 4px solid #ea4335; margin-bottom: 16px; border: 1px solid rgba(234,67,53,0.08); border-left-width: 4px; }
      .dh-koc-mentor-title { color: #ea4335; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 13.5px; font-weight: 700; text-transform: uppercase; }
      .dh-koc-mentor-text { font-size: 13.5px; line-height: 1.5; color: #e2e2e9; }
      .dh-koc-dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
      .dh-koc-dash-sect { background: rgba(0,0,0,0.15); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); }
      .dh-koc-dash-title { font-size: 11px; color: #9aa0a6; margin-bottom: 8px; display: flex; justify-content: space-between; font-weight: 600; }
      .dh-koc-footer-stats { margin-top: 12px; font-size: 12px; color: #bdc1c6; display: flex; justify-content: space-between; opacity: 0.85; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; }
      @media (max-width: 992px) { .dh-mentor-grid-container { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  // ----- 3. BALANCING PARSER -----
  function extractFirstJSONObject(str) {
    if (!str) return null;
    let cleanStr = str.replace(/```json|