/* ---- VİDEO -> FOTO TAM SENKRONİZASYON (React DOM Otomasyonu) ---- */
  var syncAttempts = 0;
  function trySyncReactState() {
    var raw;
    try { raw = localStorage.getItem("dh-bridge-return"); } catch(e) { return; }
    if (!raw) return;
    
    var info;
    try { info = JSON.parse(raw); } catch(e) { return; }
    if (!info || !info.en) return;
    
    // 5 dakikadan eskiyse senkronize etme
    if (Date.now() - (info.at||0) > 5*60*1000) {
      try { localStorage.removeItem("dh-bridge-return"); } catch(e){}
      return;
    }

    // Kullanıcıya yükleniyor ekranı göster (Arka plandaki zıplamaları ve modül geçişlerini görmesin)
    var overlay = document.getElementById("nbSyncOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "nbSyncOverlay";
      overlay.className = "nb-sync-overlay";
      overlay.innerHTML = '<div class="nb-spinner"></div><div>Çalıştığınız modül ve cümle senkronize ediliyor...</div>';
      document.body.appendChild(overlay);
    }

    // ADIM 1: Önce doğru modülün içine girilmiş mi kontrol et.
    // Eğer ana modül listesi ekranındaysak (.card-en henüz yoksa) ilgili modül butonunu arayalım.
    var cardEnEl = document.querySelector(".card-en");
    if (!cardEnEl) {
      if (info.module) {
        // Genel listedeki butonlar arasında başlığı veya veri niteliği bizim modülümüze benzeyeni buluyoruz
        var targetModBtn = Array.from(document.querySelectorAll("button, .mod-tile, [data-mod]")).find(function(el) {
          var text = (el.textContent || "").toLowerCase().trim();
          var modName = info.module.toLowerCase().trim();
          // Modül adının temiz halini (örn: "basit cümleler") veya tam kodunu içeriyor mu kontrol et
          return text.includes(modName) || modName.includes(text) || (el.dataset && el.dataset.mod === info.module);
        });

        if (targetModBtn) {
          targetModBtn.click(); // Modüle giriş yapması için tıkla
          setTimeout(trySyncReactState, 200); // React'in modülü yüklemesi için biraz zaman ver ve tekrar dene
          return;
        }
      }

      // Eğer ne kart bulundu ne de tıklanacak modül butonu (React henüz ilk açılışta veya yükleniyor durumunda olabilir)
      syncAttempts++;
      if (syncAttempts > 40) { // 4 saniye zaman aşımı koruması
        if (overlay) overlay.remove();
        return;
      }
      setTimeout(trySyncReactState, 150);
      return;
    }

    // ADIM 2: Modülün içerisindeyiz, şimdi doğru cümleyi bulana kadar ileri saralım.
    var currentEn = cardEnEl.textContent.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    var targetEn = info.en.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

    if (currentEn === targetEn) {
      // Tam cümle eşleşmesi sağlandı! Senkronizasyon başarılı.
      if (overlay) overlay.remove();
      try { localStorage.removeItem("dh-bridge-return"); } catch(e){}
    } else {
      // Cümle eşleşmediyse React uygulamasının "Sıradaki / İleri" butonunu bulup simüle tıkla
      var nextBtn = Array.from(document.querySelectorAll("button")).find(function(btn) {
        var text = (btn.textContent || "").toLowerCase();
        return text.includes("sonraki") || text.includes("ileri") || text.includes("→") || btn.id === "nextBtn";
      });

      if (nextBtn) {
        nextBtn.click();
        setTimeout(trySyncReactState, 80); // Bir sonraki karta geçiş hızı
      } else {
        // İleri butonu bulunamadıysa işlemi durdur, overlay'i kaldır
        if (overlay) overlay.remove();
      }
    }
  }
