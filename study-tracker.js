// study-tracker.js - Düzeltilmiş versiyon

class StudyTracker {
  constructor() {
    this.currentSession = null;
    this.dailyStats = {};
    this.streakData = {};
    this.sessionHistory = [];
    this.isTracking = false;
    this.lastUpdate = Date.now();
    
    // Otomatik kaydetme aralığı
    this.autoSaveInterval = null;
  }

  // Başlangıç
  async init() {
    try {
      // Kayıtlı verileri yükle
      await this.loadData();
      
      // Otomatik kaydetmeyi başlat
      this.startAutoSave();
      
      // Günlük verileri sıfırla (eğer yeni günse)
      this.checkDailyReset();
      
      console.log('📊 StudyTracker başlatıldı');
      
    } catch (error) {
      console.error('StudyTracker başlatma hatası:', error);
    }
  }

  // Çalışma oturumunu başlat
  startSession(moduleId, title) {
    if (this.isTracking) {
      this.endSession();
    }
    
    this.currentSession = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      moduleId: moduleId,
      title: title,
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      items: [],
      correctCount: 0,
      wrongCount: 0,
      totalCount: 0,
      completed: false
    };
    
    this.isTracking = true;
    this.updateDailyStats('session_start');
    
    return this.currentSession;
  }

  // Öğeyi kaydet
  logItem(itemId, result, timeSpent = 0) {
    if (!this.isTracking || !this.currentSession) return;
    
    const item = {
      id: itemId,
      result: result, // 'correct', 'wrong', 'hard', 'easy'
      timeSpent: timeSpent || 0,
      timestamp: Date.now()
    };
    
    this.currentSession.items.push(item);
    this.currentSession.totalCount++;
    
    if (result === 'correct' || result === 'easy') {
      this.currentSession.correctCount++;
      this.updateDailyStats('correct');
    } else if (result === 'wrong' || result === 'hard') {
      this.currentSession.wrongCount++;
      this.updateDailyStats('wrong');
    }
    
    // Değişiklikleri kaydet
    this.saveData();
  }

  // Oturumu sonlandır
  endSession() {
    if (!this.isTracking || !this.currentSession) return;
    
    this.currentSession.endTime = Date.now();
    this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
    this.currentSession.completed = true;
    
    this.sessionHistory.push(this.currentSession);
    
    // Seriyi güncelle
    this.updateStreak();
    
    this.isTracking = false;
    this.saveData();
    
    const session = this.currentSession;
    this.currentSession = null;
    
    return session;
  }

  // Günlük istatistikleri güncelle
  updateDailyStats(type, data = {}) {
    const today = new Date().toDateString();
    
    if (!this.dailyStats[today]) {
      this.dailyStats[today] = {
        date: today,
        totalCorrect: 0,
        totalWrong: 0,
        totalItems: 0,
        sessions: 0,
        timeSpent: 0,
        streak: this.streakData.current || 0,
        modules: new Set()
      };
    }
    
    const stats = this.dailyStats[today];
    
    switch (type) {
      case 'session_start':
        stats.sessions++;
        break;
      case 'correct':
        stats.totalCorrect++;
        stats.totalItems++;
        break;
      case 'wrong':
        stats.totalWrong++;
        stats.totalItems++;
        break;
      case 'module':
        stats.modules.add(data.moduleId);
        break;
      case 'time':
        stats.timeSpent += data.duration || 0;
        break;
    }
    
    // 30 günden eski verileri temizle
    this.cleanOldStats();
  }

  // Seriyi güncelle
  updateStreak() {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (!this.streakData.lastDate || this.streakData.lastDate !== today) {
      // Yeni gün
      if (this.streakData.lastDate === yesterday) {
        // Dün de çalışmış, seri devam ediyor
        this.streakData.current = (this.streakData.current || 0) + 1;
      } else if (this.streakData.lastDate !== today) {
        // Seri kırıldı veya ilk kez çalışıyor
        this.streakData.current = 1;
      }
      
      this.streakData.lastDate = today;
      this.streakData.lastUpdate = Date.now();
    }
    
    // En yüksek seriyi güncelle
    if (this.streakData.current > (this.streakData.best || 0)) {
      this.streakData.best = this.streakData.current;
    }
    
    this.saveData();
  }

  // Bugünkü istatistikleri al
  getTodayStats() {
    const today = new Date().toDateString();
    const stats = this.dailyStats[today] || {
      totalCorrect: 0,
      totalWrong: 0,
      totalItems: 0,
      sessions: 0,
      timeSpent: 0,
      modules: new Set()
    };
    
    return {
      ...stats,
      streak: this.streakData.current || 0,
      bestStreak: this.streakData.best || 0,
      accuracy: stats.totalItems > 0 ? Math.round((stats.totalCorrect / stats.totalItems) * 100) : 0
    };
  }

  // Haftalık istatistikleri al
  getWeeklyStats() {
    const weekStats = {
      totalItems: 0,
      correctItems: 0,
      wrongItems: 0,
      accuracy: 0,
      sessions: 0,
      timeSpent: 0
    };
    
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    
    for (const [date, stats] of Object.entries(this.dailyStats)) {
      if (new Date(date).getTime() >= weekAgo) {
        weekStats.totalItems += stats.totalItems || 0;
        weekStats.correctItems += stats.totalCorrect || 0;
        weekStats.wrongItems += stats.totalWrong || 0;
        weekStats.sessions += stats.sessions || 0;
        weekStats.timeSpent += stats.timeSpent || 0;
      }
    }
    
    weekStats.accuracy = weekStats.totalItems > 0 ? 
      Math.round((weekStats.correctItems / weekStats.totalItems) * 100) : 0;
    
    return weekStats;
  }

  // Modül ilerlemesini al
  getModuleProgress(moduleId) {
    const sessions = this.sessionHistory.filter(s => s.moduleId === moduleId);
    
    if (sessions.length === 0) return null;
    
    const totalItems = sessions.reduce((sum, s) => sum + s.totalCount, 0);
    const correctItems = sessions.reduce((sum, s) => sum + s.correctCount, 0);
    const totalTime = sessions.reduce((sum, s) => sum + s.duration, 0);
    
    return {
      sessions: sessions.length,
      totalItems: totalItems,
      correctItems: correctItems,
      accuracy: totalItems > 0 ? Math.round((correctItems / totalItems) * 100) : 0,
      totalTime: totalTime,
      lastSession: sessions[sessions.length - 1]?.startTime || 0,
      completed: sessions.some(s => s.completed)
    };
  }

  // Verileri kaydet
  async saveData() {
    try {
      const data = {
        dailyStats: this.dailyStats,
        streakData: this.streakData,
        sessionHistory: this.sessionHistory.slice(-1000) // Son 1000 oturum
      };
      
      if (window.storageBridge) {
        await window.storageBridge.set('study_tracker_data', data);
      } else {
        localStorage.setItem('study_tracker_data', JSON.stringify(data));
      }
      
      // Bulut senkronizasyonu
      if (window.cloudSync) {
        window.cloudSync.addChange('study_data', data);
      }
      
    } catch (error) {
      console.error('Veri kaydetme hatası:', error);
    }
  }

  // Verileri yükle
  async loadData() {
    try {
      let data = null;
      
      if (window.storageBridge) {
        data = await window.storageBridge.get('study_tracker_data');
      } else {
        const stored = localStorage.getItem('study_tracker_data');
        if (stored) {
          data = JSON.parse(stored);
        }
      }
      
      if (data) {
        this.dailyStats = data.dailyStats || {};
        this.streakData = data.streakData || {};
        this.sessionHistory = data.sessionHistory || [];
      }
      
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      this.dailyStats = {};
      this.streakData = {};
      this.sessionHistory = [];
    }
  }

  // Eski istatistikleri temizle
  cleanOldStats() {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;
    
    for (const [date, stats] of Object.entries(this.dailyStats)) {
      if (new Date(date).getTime() < thirtyDaysAgo) {
        delete this.dailyStats[date];
      }
    }
  }

  // Günlük sıfırlama kontrolü
  checkDailyReset() {
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem('study_tracker_last_reset');
    
    if (lastReset !== today) {
      // Yeni gün, sıfırlamaları yap
      localStorage.setItem('study_tracker_last_reset', today);
      
      // Günlük oturum sayacını sıfırla
      const todayStats = this.dailyStats[today];
      if (todayStats) {
        todayStats.sessions = 0;
      }
      
      this.saveData();
    }
  }

  // Otomatik kaydetmeyi başlat
  startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    this.autoSaveInterval = setInterval(() => {
      if (this.isTracking) {
        this.saveData();
      }
    }, 60000); // Her dakika kaydet
  }

  // Otomatik kaydetmeyi durdur
  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  // Tüm verileri dışa aktar
  exportData() {
    return {
      dailyStats: this.dailyStats,
      streakData: this.streakData,
      sessionHistory: this.sessionHistory,
      exportDate: Date.now()
    };
  }

  // Verileri içe aktar
  async importData(data) {
    if (!data || typeof data !== 'object') return false;
    
    try {
      this.dailyStats = data.dailyStats || {};
      this.streakData = data.streakData || {};
      this.sessionHistory = data.sessionHistory || [];
      
      await this.saveData();
      return true;
      
    } catch (error) {
      console.error('Veri içe aktarma hatası:', error);
      return false;
    }
  }
}

// Global instance
window.studyTracker = new StudyTracker();
