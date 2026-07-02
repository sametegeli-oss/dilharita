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
