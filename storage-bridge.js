// storage-bridge.js - Düzeltilmiş versiyon

class StorageBridge {
  constructor() {
    this.localCache = new Map();
    this.isInitialized = false;
    this.pendingOperations = [];
    this.useCloud = true; // Varsayılan olarak bulut kullan
  }

  // Başlangıç
  async init() {
    if (this.isInitialized) return;
    
    try {
      // IndexedDB bağlantısını kontrol et
      await this.checkIndexedDB();
      
      // LocalStorage'ı kontrol et
      await this.loadFromLocalStorage();
      
      this.isInitialized = true;
      console.log('💾 StorageBridge başlatıldı');
      
    } catch (error) {
      console.error('StorageBridge başlatma hatası:', error);
      this.useCloud = false;
      this.isInitialized = true;
    }
  }

  // Veri kaydet
  async set(key, value, sync = true) {
    try {
      await this.init();
      
      // Yerel cache'e kaydet
      this.localCache.set(key, value);
      
      // LocalStorage'a kaydet
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.warn('LocalStorage kaydetme hatası:', e);
      }
      
      // IndexedDB'ye kaydet
      try {
        await this.saveToIndexedDB(key, value);
      } catch (e) {
        console.warn('IndexedDB kaydetme hatası:', e);
      }
      
      // Buluta gönder
      if (sync && this.useCloud && window.cloudSync) {
        window.cloudSync.addChange('data', { key, value });
      }
      
      return true;
      
    } catch (error) {
      console.error('Veri kaydetme hatası:', key, error);
      return false;
    }
  }

  // Veri al
  async get(key) {
    try {
      await this.init();
      
      // Önce cache'den dene
      if (this.localCache.has(key)) {
        return this.localCache.get(key);
      }
      
      // LocalStorage'dan dene
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.localCache.set(key, parsed);
          return parsed;
        }
      } catch (e) {
        console.warn('LocalStorage okuma hatası:', e);
      }
      
      // IndexedDB'den dene
      try {
        const value = await this.loadFromIndexedDB(key);
        if (value !== undefined) {
          this.localCache.set(key, value);
          return value;
        }
      } catch (e) {
        console.warn('IndexedDB okuma hatası:', e);
      }
      
      return null;
      
    } catch (error) {
      console.error('Veri okuma hatası:', key, error);
      return null;
    }
  }

  // Tüm verileri al
  async getAll(prefix = '') {
    try {
      await this.init();
      
      const results = {};
      
      // LocalStorage'dan al
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          try {
            results[key] = JSON.parse(localStorage.getItem(key));
          } catch (e) {
            results[key] = localStorage.getItem(key);
          }
        }
      }
      
      // IndexedDB'den al (LocalStorage'da olmayanlar)
      try {
        const dbResults = await this.loadAllFromIndexedDB(prefix);
        for (const [key, value] of Object.entries(dbResults)) {
          if (!(key in results)) {
            results[key] = value;
          }
        }
      } catch (e) {
        console.warn('IndexedDB toplu okuma hatası:', e);
      }
      
      return results;
      
    } catch (error) {
      console.error('Toplu veri okuma hatası:', error);
      return {};
    }
  }

  // Veri sil
  async delete(key, sync = true) {
    try {
      await this.init();
      
      this.localCache.delete(key);
      localStorage.removeItem(key);
      await this.deleteFromIndexedDB(key);
      
      if (sync && this.useCloud && window.cloudSync) {
        window.cloudSync.addChange('delete', { key });
      }
      
      return true;
      
    } catch (error) {
      console.error('Veri silme hatası:', key, error);
      return false;
    }
  }

  // IndexedDB işlemleri
  async checkIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DilharitaDB', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('storage')) {
          db.createObjectStore('storage', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async saveToIndexedDB(key, value) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DilharitaDB', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction('storage', 'readwrite');
        const store = transaction.objectStore('storage');
        const putRequest = store.put({ id: key, value: value });
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
        
        transaction.oncomplete = () => db.close();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async loadFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DilharitaDB', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction('storage', 'readonly');
        const store = transaction.objectStore('storage');
        const getRequest = store.get(key);
        
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          resolve(result ? result.value : undefined);
        };
        
        getRequest.onerror = () => reject(getRequest.error);
        
        transaction.oncomplete = () => db.close();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async loadAllFromIndexedDB(prefix = '') {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DilharitaDB', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction('storage', 'readonly');
        const store = transaction.objectStore('storage');
        const results = {};
        
        const cursorRequest = store.openCursor();
        
        cursorRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const key = cursor.value.id;
            if (key.startsWith(prefix)) {
              results[key] = cursor.value.value;
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        
        cursorRequest.onerror = () => reject(cursorRequest.error);
        
        transaction.oncomplete = () => db.close();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DilharitaDB', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction('storage', 'readwrite');
        const store = transaction.objectStore('storage');
        const deleteRequest = store.delete(key);
        
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
        
        transaction.oncomplete = () => db.close();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // LocalStorage'dan yükle
  async loadFromLocalStorage() {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.startsWith('_')) {
        try {
          const value = JSON.parse(localStorage.getItem(key));
          this.localCache.set(key, value);
        } catch (e) {
          // JSON değilse string olarak sakla
          this.localCache.set(key, localStorage.getItem(key));
        }
      }
    }
  }

  // Senkronizasyon durumunu kontrol et
  async checkSyncStatus() {
    const status = {
      isOnline: navigator.onLine,
      hasPendingChanges: this.pendingOperations.length > 0,
      useCloud: this.useCloud,
      cacheSize: this.localCache.size
    };
    
    if (window.cloudSync) {
      status.syncActive = window.cloudSync.isSyncing;
      status.pendingChanges = window.cloudSync.pendingChanges.length;
    }
    
    return status;
  }

  // Tüm depolamayı temizle
  async clear() {
    this.localCache.clear();
    localStorage.clear();
    
    try {
      const request = indexedDB.open('DilharitaDB', 1);
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction('storage', 'readwrite');
        const store = transaction.objectStore('storage');
        store.clear();
        transaction.oncomplete = () => db.close();
      };
    } catch (e) {
      console.warn('IndexedDB temizleme hatası:', e);
    }
    
    return true;
  }
}

// Global instance
window.storageBridge = new StorageBridge();
