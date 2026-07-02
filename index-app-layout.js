// index-app-layout.js - DÜZELTİLMİŞ VERSİYON

// React hook'larını al
const React = window.React || (typeof require !== 'undefined' ? require('react') : null);
const { useState, useEffect, useCallback, useMemo, useRef } = React || {};

// Eğer React yoksa hata ver
if (!React || !useState) {
  console.error('React yüklenemedi! window.React:', window.React);
  throw new Error('React required for index-app-layout.js');
}

// index-app-layout.js - Ekleme

// Uygulama başlatıldığında
useEffect(() => {
  // Veri yükleme
  loadData();
  
  // StorageBridge'i başlat
  if (window.storageBridge) {
    window.storageBridge.init();
  }
  
  // CloudSync'i başlat
  if (window.cloudSync) {
    window.cloudSync.start();
  }
  
  // StudyTracker'i başlat
  if (window.studyTracker) {
    window.studyTracker.init();
  }
  
  // Periyodik senkronizasyon
  const syncInterval = setInterval(() => {
    if (window.cloudSync && navigator.onLine) {
      window.cloudSync.triggerSync();
    }
  }, 60000); // Her dakika
  
  return () => {
    clearInterval(syncInterval);
    if (window.cloudSync) {
      window.cloudSync.stop();
    }
    if (window.studyTracker) {
      window.studyTracker.stopAutoSave();
    }
  };
}, []);
