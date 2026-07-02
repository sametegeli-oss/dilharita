// ============================================
// cloud-sync.js - Bulut Senkronizasyon Motoru
// ============================================

class CloudSync {
  constructor() {
    this.isConnected = false;
    this.isSyncing = false;
    this.pendingChanges = [];
    this.lastSyncTime = 0;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.syncInterval = null;
    this.userId = null;
    this.apiUrl = 'https://api.dilharita.com/sync'; // Veya kendi API URL'n
    
    // Bağlantıyı kontrol et
    this.checkConnection();
    
    // Network değişikliklerini izle
    window.addEventListener('online', () => {
      this.checkConnection();
      this.sync();
    });
    
    window.addEventListener('offline', () => {
      this.isConnected = false;
    });
  }

  // Bağlantıyı kontrol et
  async checkConnection() {
    try {
      // Basit bir ping testi
      const response = await fetch(this.apiUrl + '/ping', {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });
      this.isConnected = response.ok;
      console.log('☁️ Bulut bağlantısı:', this.isConnected ? '✅ Bağlı' : '❌ Bağlı değil');
      return this.isConnected;
    } catch (e) {
      this.isConnected = false;
      console.warn('⚠️ Bulut bağlantısı kontrol edilemedi:', e.message);
      return false;
    }
  }

  // Kullanıcı ID'sini al
  getUserId() {
    if (this.userId) return this.userId;
    
    this.userId = localStorage.getItem('dilharita_userId');
    if (!this.userId) {
      this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      localStorage.setItem('dilharita_userId', this.userId);
    }
    return this.userId;
  }

  // Senkronizasyon başlat
  async sync(force = false) {
    if (this.isSyncing) {
      console.log('⏳ Senkronizasyon devam ediyor...');
      return;
    }
    
    if (!this.isConnected) {
      const connected = await this.checkConnection();
      if (!connected) {
        console.warn('⚠️ Bulut bağlantısı yok, senkronizasyon ertelendi');
        return;
      }
    }

    this.isSyncing = true;
    console.log('🔄 Senkronizasyon başlıyor...');

    try {
      // 1. Yerel değişiklikleri gönder
      await this.pushChanges();
      
      // 2. Uzaktan değişiklikleri al
      await this.pullChanges();
      
      this.lastSyncTime = Date.now();
      this.retryCount = 0;
      console.log('✅ Senkronizasyon tamamlandı');
      
      // UI'ı güncelle
      this.updateUIStatus('success');
      
    } catch (error) {
      console.error('❌ Senkronizasyon hatası:', error);
      this.retryCount++;
      
      if (this.retryCount < this.maxRetries) {
        const delay = 5000 * this.retryCount;
        console.log(`🔄 ${delay}ms sonra tekrar deneniyor... (${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => this.sync(true), delay);
      } else {
        this.updateUIStatus('error', error.message);
      }
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
      const response = await fetch(this.apiUrl + '/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.getUserId(),
          changes: changes,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Push hatası: ${response.status}`);
      }

      console.log(`📤 ${changes.length} değişiklik gönderildi`);
      
    } catch (error) {
      // Hata durumunda değişiklikleri geri ekle
      this.pendingChanges = [...changes, ...this.pendingChanges];
      throw error;
    }
  }

  // Uzaktan değişiklikleri al
  async pullChanges() {
    try {
      const response = await fetch(this.apiUrl + '/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.getUserId(),
          since: this.lastSyncTime
        })
      });

      if (!response.ok) {
        throw new Error(`Pull hatası: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.changes && data.changes.length > 0) {
        console.log(`📥 ${data.changes.length} değişiklik alındı`);
        this.applyChanges(data.changes);
      }
      
    } catch (error) {
      console.warn('Pull hatası:', error.message);
      // Sessizce devam et
    }
  }

  // Değişiklikleri uygula
  applyChanges(changes) {
    for (const change of changes) {
      try {
        switch (change.type) {
          case 'study':
            this.applyStudyData(change.data);
            break;
          case 'progress':
            this.applyProgressData(change.data);
            break;
          case 'settings':
            this.applySettings(change.data);
            break;
          default:
            console.warn('Bilinmeyen değişiklik tipi:', change.type);
        }
      } catch (error) {
        console.error('Değişiklik uygulama hatası:', error);
      }
    }
  }

  // Çalışma verilerini uygula
  applyStudyData(data) {
    // SRS verilerini güncelle
    if (data.srs) {
      for (const [key, value] of Object.entries(data.srs)) {
        localStorage.setItem('srs:' + key, JSON.stringify(value));
      }
    }
  }

  // İlerleme verilerini uygula
  applyProgressData(data) {
    if (data.progress) {
      for (const [key, value] of Object.entries(data.progress)) {
        localStorage.setItem('prog:' + key, JSON.stringify(value));
      }
    }
  }

  // Ayarları uygula
  applySettings(data) {
    if (data.settings) {
      for (const [key, value] of Object.entries(data.settings)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    }
  }

  // Yeni değişiklik ekle
  addChange(type, data) {
    this.pendingChanges.push({
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      type: type,
      data: data,
      timestamp: Date.now()
    });
    
    // Otomatik senkronizasyon
    if (this.isConnected) {
      setTimeout(() => this.sync(), 1000);
    }
  }

  // Yedek indir
  async downloadBackup() {
    try {
      const allData = {};
      
      // Tüm localStorage verilerini al
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.startsWith('_')) {
          try {
            allData[key] = JSON.parse(localStorage.getItem(key));
          } catch {
            allData[key] = localStorage.getItem(key);
          }
        }
      }
      
      // JSON olarak indir
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dilharita_yedek_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log('✅ Yedek indirildi');
      return true;
      
    } catch (error) {
      console.error('❌ Yedek indirme hatası:', error);
      alert('Yedek indirilemedi: ' + error.message);
      return false;
    }
  }

  // Yedekten geri yükle
  async restoreBackup(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      let count = 0;
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('srs:') || key.startsWith('prog:') || key === 'dilharita_userId') {
          localStorage.setItem(key, JSON.stringify(value));
          count++;
        }
      }
      
      console.log(`✅ ${count} veri geri yüklendi`);
      alert(`${count} veri başarıyla geri yüklendi. Sayfa yenilenecek.`);
      location.reload();
      return true;
      
    } catch (error) {
      console.error('❌ Geri yükleme hatası:', error);
      alert('Geri yükleme başarısız: ' + error.message);
      return false;
    }
  }

  // UI durumunu güncelle
  updateUIStatus(status, message = '') {
    const statusEl = document.getElementById('sync-status');
    if (!statusEl) return;
    
    if (status === 'success') {
      statusEl.textContent = '✅ Son senkronizasyon: ' + new Date().toLocaleTimeString();
      statusEl.style.color = '#4ade80';
    } else if (status === 'error') {
      statusEl.textContent = '❌ Hata: ' + message;
      statusEl.style.color = '#ef4444';
    } else {
      statusEl.textContent = '⏳ Senkronizasyon bekleniyor...';
      statusEl.style.color = '#fbbf24';
    }
  }
}

// Global instance
window.cloudSync = new CloudSync();

// Her 5 dakikada bir senkronizasyon dene
setInterval(() => {
  window.cloudSync.sync();
}, 300000);

console.log('☁️ CloudSync yüklendi');
