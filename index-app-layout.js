// ============================================
// index-app-layout.js - DÜZELTİLMİŞ VERSİYON
// ============================================

// 1. React'i global'den al veya CDN'den yükle
(function loadReact() {
  // React zaten window'da mı?
  if (typeof window.React !== 'undefined' && window.React.useState) {
    console.log('✅ React window\'da zaten var');
    return;
  }
  
  // React module olarak yüklendiyse (app.js içinde)
  if (typeof React !== 'undefined' && React.useState) {
    window.React = React;
    console.log('✅ React module olarak bulundu');
    return;
  }
  
  // React'i CDN'den yükle (senkron)
  console.warn('⚠️ React yükleniyor (CDN)...');
  try {
    // Script'leri senkron yükle (document.write ile)
    document.write('<script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>');
    document.write('<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>');
    
    // React window'a atanmış mı kontrol et
    if (typeof window.React === 'undefined') {
      // React'i window'a ata
      window.React = React;
      window.ReactDOM = ReactDOM;
    }
    console.log('✅ React CDN\'den yüklendi');
  } catch(e) {
    console.error('❌ React yüklenemedi:', e);
  }
})();

// 2. Hook'ları güvenli şekilde al
function getReactHooks() {
  // Önce window.React'i dene
  if (typeof window.React !== 'undefined' && window.React.useState) {
    return window.React;
  }
  
  // Sonra global React'i dene
  if (typeof React !== 'undefined' && React.useState) {
    window.React = React;
    return React;
  }
  
  // Hiçbiri yoksa hata ver
  console.error('❌ React bulunamadı!');
  console.log('window.React:', window.React);
  console.log('typeof React:', typeof React);
  throw new Error('React required for index-app-layout.js');
}

// React hook'larını al
const ReactInstance = getReactHooks();
const { useState, useEffect, useCallback, useMemo, useRef } = ReactInstance;

console.log('✅ React hook\'ları yüklendi:', {
  useState: typeof useState,
  useEffect: typeof useEffect,
  useCallback: typeof useCallback
});

// 3. Ana uygulama bileşeni (devamı...)
// ... diğer kodlar ...
