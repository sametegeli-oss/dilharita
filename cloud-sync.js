// cloud-sync.js - Düzeltilmiş versiyon

class CloudSync {
  constructor() {
    this.syncInterval = null;
    this.isSyncing = false;
    this.pendingChanges = [];
    this.lastSyncTime = 0;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.syncDelay = 5000; // 5 saniye
    this.isOnline = navigator.onLine;
    
    // Network durumunu izle
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.retryCount = 0;
      this.triggerSync();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // Başlangıç
  start() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Her 30 saniyede bir senkronizasyon dene
    this.syncInterval = setInterval(() => {
      this.triggerSync();
    }, 30000);
    
    // İlk senkronizasyonu hemen yap
    setTimeout(() => this.triggerSync(), 1000);
    
    console.log('☁️ CloudSync başlatıldı');
  }

  // Senkronizasyonu tetikle
  async triggerSync(force = false) {
    if (this.isSyncing) {
      console.log('⏳ Zaten senkronizasyon devam ediyor...');
      return;
    }
    
    if (!this.isOnline) {
      console.log('📡 İnternet bağlantısı yok, senkronizasyon bekletiliyor...');
      return;
    }
    
    if (!force && this.pendingChanges.length === 0) {
      // Bekleyen değişiklik yoksa kontrol et
      await this.checkForRemoteChanges();
      return;
    }
    
    try {
      this.isSyncing = true;
      console.log('🔄 Senkronizasyon başlıyor...');
      
      // Önce yerel değişiklikleri gönder
      if (this.pendingChanges.length > 0) {
        await this.pushChanges();
      }
      
      // Sonra uzak değişiklikleri çek
      await this.pullChanges();
      
      this.lastSyncTime = Date.now();
      this.retryCount = 0;
      console.log('✅ Senkronizasyon tamamlandı');
      
    } catch (error) {
      console.error('❌ Senkronizasyon hatası:', error);
      this.handleSyncError(error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Değişiklikleri gönder
  async pushChanges() {
    if (this.pendingChanges.length === 0) return;
    
    const changes = [...this.pendingChanges];
    this.pendingChanges = [];
    
    try {
      const userId = await this.getUserId();
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          changes: changes,
          timestamp: Date.now()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Push başarısız: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`📤 ${changes.length} değişiklik gönderildi`);
      
    } catch (error) {
      // Hata durumunda değişiklikleri tekrar queue'ya ekle
      this.pendingChanges = [...changes, ...this.pendingChanges];
      throw error;
    }
  }

  // Uzaktan değişiklikleri çek
  async pullChanges() {
    try {
      const userId = await this.getUserId();
      const response = await fetch(`/api/sync/pull?userId=${userId}&since=${this.lastSyncTime}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Pull başarısız: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.changes && data.changes.length > 0) {
        console.log(`📥 ${data.changes.length} değişiklik alındı`);
        await this.applyRemoteChanges(data.changes);
      }
      
    } catch (error) {
      console.error('Pull hatası:', error);
      throw error;
    }
  }

  // Uzaktaki değişiklikleri uygula
  async applyRemoteChanges(changes) {
    for (const change of changes) {
      try {
        switch (change.type) {
          case 'study':
            await this.applyStudyChange(change.data);
            break;
          case 'progress':
            await this.applyProgressChange(change.data);
            break;
          case 'settings':
            await this.applySettingsChange(change.data);
            break;
          default:
            console.warn('Bilinmeyen değişiklik tipi:', change.type);
        }
      } catch (error) {
        console.error('Değişiklik uygulama hatası:', change, error);
        throw error;
      }
    }
  }

  // Yeni bir değişiklik ekle
  addChange(type, data) {
    this.pendingChanges.push({
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      type: type,
      data: data,
      timestamp: Date.now()
    });
    
    // Hemen senkronize etmeyi dene
    if (this.isOnline && !this.isSyncing) {
      setTimeout(() => this.triggerSync(), 100);
    }
  }

  // Hata yönetimi
  handleSyncError(error) {
    this.retryCount++;
    
    if (this.retryCount < this.maxRetries) {
      const delay = this.syncDelay * Math.pow(2, this.retryCount - 1);
      console.log(`🔄 ${delay}ms sonra tekrar deneniyor... (${this.retryCount}/${this.maxRetries})`);
      
      setTimeout(() => {
        if (this.isOnline) {
          this.triggerSync(true);
        }
      }, delay);
    } else {
      console.error('⚠️ Maksimum yeniden deneme sayısına ulaşıldı. Senkronizasyon durduruldu.');
      this.retryCount = 0;
    }
  }

  // Kullanıcı ID'sini al
  async getUserId() {
    // LocalStorage veya IndexedDB'den kullanıcı ID'sini al
    let userId = localStorage.getItem('dilharita_userId');
    
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('dilharita_userId', userId);
    }
    
    return userId;
  }

  // Uzaktaki değişiklikleri kontrol et (periyodik kontrol için)
  async checkForRemoteChanges() {
    try {
      const userId = await this.getUserId();
      const response = await fetch(`/api/sync/check?userId=${userId}&since=${this.lastSyncTime}`, {
        method: 'HEAD'
      });
      
      const hasChanges = response.headers.get('X-Has-Changes') === 'true';
      
      if (hasChanges) {
        await this.pullChanges();
      }
      
    } catch (error) {
      // Sessizce başarısız ol - periyodik kontrol için
      console.debug('Uzaktan değişiklik kontrolü başarısız:', error);
    }
  }

  // Senkronizasyonu durdur
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.isSyncing = false;
    console.log('⏹️ CloudSync durduruldu');
  }
}

// Global instance
window.cloudSync = new CloudSync();
