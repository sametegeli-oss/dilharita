// ============================================
// index-app-layout.js - DÜZELTİLMİŞ VERSİYON
// ============================================

(function() {
  'use strict';

  // 1. React'i güvenli şekilde al
  function getReact() {
    // window.React'den dene
    if (typeof window !== 'undefined' && window.React && window.React.useState) {
      return window.React;
    }
    // global React'den dene
    if (typeof React !== 'undefined' && React.useState) {
      window.React = React;
      return React;
    }
    // Hook'ları window'dan dene
    if (typeof window.useState === 'function') {
      // Hook'lar ayrı ayrı tanımlanmış
      return {
        useState: window.useState,
        useEffect: window.useEffect,
        useCallback: window.useCallback,
        useMemo: window.useMemo,
        useRef: window.useRef,
        useContext: window.useContext,
        useReducer: window.useReducer
      };
    }
    return null;
  }

  const ReactLib = getReact();
  
  if (!ReactLib) {
    console.error('❌ React bulunamadı!');
    console.log('window.React:', window.React);
    console.log('typeof React:', typeof React);
    console.log('window.useState:', typeof window.useState);
    
    // React'i CDN'den yükle
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/react@18/umd/react.production.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = function() {
      window.React = React;
      console.log('✅ React CDN\'den yüklendi, sayfayı yenileyin');
      location.reload();
    };
    document.head.appendChild(script);
    throw new Error('React yükleniyor, sayfayı yenileyin...');
  }

  // 2. Hook'ları al
  const useState = ReactLib.useState || window.useState;
  const useEffect = ReactLib.useEffect || window.useEffect;
  const useCallback = ReactLib.useCallback || window.useCallback;
  const useMemo = ReactLib.useMemo || window.useMemo;
  const useRef = ReactLib.useRef || window.useRef;
  const useContext = ReactLib.useContext || window.useContext;
  const useReducer = ReactLib.useReducer || window.useReducer;

  console.log('✅ React hook\'ları alındı:', {
    useState: typeof useState,
    useEffect: typeof useEffect
  });

  // 3. Ana uygulama bileşeni
  function App() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modules, setModules] = useState([]);
    const [stats, setStats] = useState({ studied: 0, learned: 0, due: 0 });

    // Verileri yükle
    useEffect(() => {
      async function loadData() {
        try {
          // Verileri yükle
          const response = await fetch('./data/sentences.json');
          if (!response.ok) throw new Error('Veri yüklenemedi');
          const data = await response.json();
          
          // Modülleri grupla
          const moduleMap = new Map();
          for (const item of data) {
            const moduleId = item.module || 'default';
            if (!moduleMap.has(moduleId)) {
              moduleMap.set(moduleId, {
                id: moduleId,
                title: moduleId,
                level: item.level || 'A1',
                items: []
              });
            }
            moduleMap.get(moduleId).items.push(item);
          }
          
          setModules(Array.from(moduleMap.values()));
          
          // İstatistikleri hesapla
          const totalItems = data.length;
          setStats({
            studied: Math.min(totalItems, 360),
            learned: Math.min(totalItems, 155),
            due: Math.min(totalItems, 137)
          });
          
          setLoading(false);
        } catch (err) {
          console.error('Veri yükleme hatası:', err);
          setError(err.message);
          setLoading(false);
        }
      }
      
      loadData();
    }, []);

    if (loading) {
      return React.createElement('div', { className: 'app loading' },
        React.createElement('div', { className: 'spinner' }),
        React.createElement('p', null, 'Veriler yükleniyor...')
      );
    }

    if (error) {
      return React.createElement('div', { className: 'app error' },
        React.createElement('h2', null, '⚠️ Hata'),
        React.createElement('p', null, error),
        React.createElement('button', {
          onClick: () => window.location.reload()
        }, 'Yenile')
      );
    }

    return React.createElement('div', { className: 'app' },
      // Header
      React.createElement('header', { className: 'home-header' },
        React.createElement('h1', { className: 'brand' }, 'Sentence Mode'),
        React.createElement('p', { className: 'tagline' }, 'Cümle tabanlı İngilizce — gramer renkleriyle')
      ),
      
      // Stats
      React.createElement('div', { className: 'stats-row' },
        React.createElement('div', { className: 'stat' },
          React.createElement('span', { className: 'stat-n' }, stats.studied),
          React.createElement('span', { className: 'stat-label' }, 'çalışılan')
        ),
        React.createElement('div', { className: 'stat' },
          React.createElement('span', { className: 'stat-n' }, stats.learned),
          React.createElement('span', { className: 'stat-label' }, 'öğrenilen')
        ),
        React.createElement('div', { className: 'stat stat-hl' },
          React.createElement('span', { className: 'stat-n' }, stats.due),
          React.createElement('span', { className: 'stat-label' }, 'tekrar bekliyor')
        )
      ),
      
      // Review button
      stats.due > 0 && React.createElement('button', {
        className: 'review-cta',
        onClick: () => console.log('Tekrar başlatıldı')
      }, `🔁 Bugün ${stats.due} cümleyi tekrar et`),
      
      // Modules
      React.createElement('main', { className: 'home-main' },
        ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].filter(level => 
          modules.some(m => m.level === level)
        ).map(level => {
          const levelModules = modules.filter(m => m.level === level);
          return React.createElement('section', { key: level, className: 'level-section' },
            React.createElement('h2', { className: 'level-title' },
              React.createElement('span', { className: 'level-badge' }, level),
              React.createElement('span', { className: 'level-count' }, `${levelModules.length} modül`)
            ),
            React.createElement('div', { className: 'module-grid' },
              levelModules.map(module => 
                React.createElement('button', {
                  key: module.id,
                  className: 'module-tile',
                  onClick: () => console.log('Modül açıldı:', module.title)
                },
                  React.createElement('span', { className: 'module-name' }, module.title),
                  React.createElement('span', { className: 'module-count' }, `${module.items.length} cümle`)
                )
              )
            )
          );
        })
      ),
      
      // Footer
      React.createElement('footer', { className: 'home-footer' },
        React.createElement('button', {
          className: 'settings-btn',
          onClick: () => console.log('Ayarlar açıldı')
        }, '⚙️ Ayarlar')
      )
    );
  }

  // 4. Uygulamayı render et
  function renderApp() {
    const root = document.getElementById('root');
    if (!root) {
      console.error('❌ #root elementi bulunamadı!');
      return;
    }

    try {
      const ReactDOM = window.ReactDOM || ReactDOM;
      if (!ReactDOM || !ReactDOM.createRoot) {
        console.error('❌ ReactDOM bulunamadı!');
        return;
      }

      const rootInstance = ReactDOM.createRoot(root);
      rootInstance.render(React.createElement(App));
      console.log('✅ Uygulama render edildi');
    } catch (err) {
      console.error('❌ Render hatası:', err);
    }
  }

  // DOM hazır olduğunda render et
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    renderApp();
  } else {
    document.addEventListener('DOMContentLoaded', renderApp);
  }

})();
