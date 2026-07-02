// ============================================
// notification-helper.js - Bildirim Yöneticisi
// ============================================

class NotificationManager {
  constructor() {
    this.isSupported = 'Notification' in window;
    this.isServiceWorkerReady = false;
    this.reminderTime = localStorage.getItem('dilharita_reminder_time') || '20:00';
    this.reminderEnabled = localStorage.getItem('dilharita_reminder_enabled') === 'true';
    
    // Service Worker'ı kontrol et
    this.checkServiceWorker();
    
    // Bildirim iznini kontrol et
    this.checkPermission();
  }

  // Service Worker'ı kontrol et
  async checkServiceWorker() {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          this.isServiceWorkerReady = true;
          console.log('✅ Service Worker hazır');
        } else {
          console.warn('⚠️ Service Worker kayıtlı değil');
        }
      }
    } catch (e) {
      console.warn('Service Worker kontrol hatası:', e);
    }
  }

  // Bildirim iznini kontrol et
  async checkPermission() {
    if (!this.isSupported) {
      console.warn('⚠️ Bildirimler desteklenmiyor');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('⚠️ Bildirim izni reddedildi');
      return false;
    }

    // İzin iste
    return this.requestPermission();
  }

  // İzin iste
  async requestPermission() {
    if (!this.isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ Bildirim izni verildi');
        return true;
      } else {
        console.warn('⚠️ Bildirim izni reddedildi');
        return false;
      }
    } catch (e) {
      console.error('Bildirim izni hatası:', e);
      return false;
    }
  }

  // Bildirim gönder
  async send(title, body, options = {}) {
    if (!this.isSupported) {
      console.warn('⚠️ Bildirimler desteklenmiyor');
      return false;
    }

    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      console.warn('⚠️ Bildirim izni yok');
      return false;
    }

    try {
      // Service Worker üzerinden bildirim gönder
      if (this.isServiceWorkerReady) {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification(title, {
          body: body,
          icon: options.icon || '/icon-512.png',
          badge: options.badge || '/favicon.svg',
          vibrate: [200, 100, 200],
          data: options.data || {},
          ...options
        });
        console.log('✅ Bildirim gönderildi (SW)');
        return true;
      }

      // Normal bildirim
      const notification = new Notification(title, {
        body: body,
        icon: options.icon || '/icon-512.png',
        ...options
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.onClick) options.onClick();
      };
      
      console.log('✅ Bildirim gönderildi');
      return true;
      
    } catch (e) {
      console.error('❌ Bildirim hatası:', e);
      return false;
    }
  }

  // Günlük hatırlatma ayarla
  setReminder(time) {
    this.reminderTime = time;
    localStorage.setItem('dilharita_reminder_time', time);
    this.reminderEnabled = true;
    localStorage.setItem('dilharita_reminder_enabled', 'true');
    
    // Alarmı ayarla
    this.scheduleReminder(time);
    console.log('⏰ Hatırlatma ayarlandı:', time);
  }

  // Hatırlatmayı planla
  scheduleReminder(time) {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    
    // Eğer saat geçtiyse yarını hedefle
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    
    const delay = target.getTime() - now.getTime();
    
    // Önceki alarmı temizle
    if (window._reminderTimeout) {
      clearTimeout(window._reminderTimeout);
    }
    
    // Alarmı ayarla
    window._reminderTimeout = setTimeout(() => {
      this.sendReminder();
      // Ertesi gün için tekrar planla
      this.scheduleReminder(this.reminderTime);
    }, delay);
    
    console.log(`⏰ Hatırlatma ${target.toLocaleString()} için planlandı (${Math.round(delay/60000)} dakika)`);
  }

  // Hatırlatma gönder
  async sendReminder() {
    const stats = this.getStudyStats();
    const message = stats.due > 0 
      ? `Bugün ${stats.due} cümle tekrar bekliyor! 📚` 
      : 'Bugün henüz çalışma yapmadın. Hemen başla! 💪';
    
    await this.send('📚 Dil Harita - Çalışma Vakti!', message, {
      tag: 'daily-reminder',
      requireInteraction: true,
      data: { type: 'reminder' },
      onClick: () => {
        window.focus();
        // Ana sayfaya yönlendir
        window.location.href = '/';
      }
    });
  }

  // Çalışma istatistiklerini al
  getStudyStats() {
    let due = 0;
    try {
      // SRS verilerini kontrol et
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('srs:')) {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.due && data.due <= Date.now()) {
            due++;
          }
        }
      }
    } catch (e) {
      console.warn('İstatistik hesaplama hatası:', e);
    }
    
    return { due };
  }

  // Hatırlatmayı kapat
  disableReminder() {
    this.reminderEnabled = false;
    localStorage.setItem('dilharita_reminder_enabled', 'false');
    if (window._reminderTimeout) {
      clearTimeout(window._reminderTimeout);
      window._reminderTimeout = null;
    }
    console.log('⏰ Hatırlatma kapatıldı');
  }

  // Test bildirimi gönder
  async testNotification() {
    return await this.send('🔔 Dil Harita Test', 'Bildirimler çalışıyor! ✅', {
      tag: 'test-notification',
      data: { type: 'test' }
    });
  }
}

// Global instance
window.notificationManager = new NotificationManager();

console.log('🔔 NotificationManager yüklendi');