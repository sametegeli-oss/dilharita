/* ═══════════════════════════════════════════════════════════════
   ATLAS · HATIRLATMA ve BULUT
   İki bağımsız katman:
     1) Hatırlatma — sunucu yok. Uygulama açıldığında ve açıkken
        seçilen saat geldiyse yerel bildirim gösterir. Hedef
        tamamlandıysa rahatsız etmez.
     2) Bulut senkron — isteğe bağlı. Kullanıcı kendi Firebase
        projesinin ayarlarını girer; anonim ya da e-posta ile
        oturum açar. Yapılandırılmamışsa uygulama tam çalışır.
   Birleştirme kuralı: her kayıt için daha YENİ olan kazanır.
   Bu, iki cihazda çalışan birinin ilerlemesini kaybetmemesi için
   "son yazan kazanır"dan daha güvenli.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     HATIRLATMA
     ═══════════════════════════════════════════════════════════ */
  var Hatirlatma = {
    destek: function () { return 'Notification' in global; },
    durum: function () { return Hatirlatma.destek() ? Notification.permission : 'yok'; },

    izinIste: function () {
      if (!Hatirlatma.destek()) return Promise.resolve('yok');
      return Notification.requestPermission();
    },

    kur: function (saat) {
      Atlas.Ayar.kur({ gunlukHatirlatma: saat || '' });
      Hatirlatma.zamanlayiciKur();
    },

    /* bugün bu saatte zaten bildirdik mi */
    bildirildiMi: function () {
      return Atlas.oku('hatirlatma-son', '') === Atlas.bugun();
    },

    /* koşullar uygunsa göster */
    denetle: function () {
      var a = Atlas.Ayar.al();
      if (!a.gunlukHatirlatma || Hatirlatma.durum() !== 'granted') return false;
      if (Hatirlatma.bildirildiMi()) return false;

      var parca = a.gunlukHatirlatma.split(':');
      var hedefDk = (+parca[0]) * 60 + (+parca[1] || 0);
      var simdi = new Date();
      var simdiDk = simdi.getHours() * 60 + simdi.getMinutes();
      if (simdiDk < hedefDk) return false;

      var g = Atlas.Gunluk.gun();
      var pr = Atlas.Profil.al();
      if ((g.sayac || 0) >= (pr.hedef || 20)) return false;   /* hedef bitti, rahatsız etme */

      var seri = Atlas.Seri.canli();
      var vade = Atlas.SRS.sayim().vade;
      var baslik, govde;
      if ((g.sayac || 0) === 0 && seri > 1) {
        baslik = seri + ' günlük serini kaybetme';
        govde = 'Bugün henüz çalışmadın. ' + (vade ? vade + ' tekrar seni bekliyor.' : 'Kısa bir tur yeter.');
      } else if ((g.sayac || 0) === 0) {
        baslik = 'Bugün henüz çalışmadın';
        govde = vade ? vade + ' kalem vadesi geldi.' : 'Yeni bir modüle başlamak için iyi bir zaman.';
      } else {
        baslik = 'Hedefe az kaldı';
        govde = (g.sayac || 0) + '/' + (pr.hedef || 20) + ' tamamlandı.';
      }

      try {
        var n = new Notification('Dil Harita · ' + baslik, {
          body: govde,
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          tag: 'atlas-gunluk'
        });
        n.onclick = function () { global.focus(); location.hash = '#/'; n.close(); };
        Atlas.yaz('hatirlatma-son', Atlas.bugun());
        return true;
      } catch (e) { return false; }
    },

    zamanlayici: null,
    zamanlayiciKur: function () {
      if (Hatirlatma.zamanlayici) clearInterval(Hatirlatma.zamanlayici);
      var a = Atlas.Ayar.al();
      if (!a.gunlukHatirlatma) return;
      Hatirlatma.denetle();
      /* uygulama açıkken dakikada bir bak */
      Hatirlatma.zamanlayici = setInterval(Hatirlatma.denetle, 60000);
    },

    dene: function () {
      if (Hatirlatma.durum() !== 'granted') return false;
      try {
        new Notification('Dil Harita · deneme', {
          body: 'Bildirimler çalışıyor. Gerçek hatırlatma yalnız o gün çalışmadıysan gelir.',
          icon: './icons/icon-192.png'
        });
        return true;
      } catch (e) { return false; }
    }
  };

  /* ═══════════════════════════════════════════════════════════
     BULUT SENKRON (Firebase, isteğe bağlı)
     ═══════════════════════════════════════════════════════════ */
  var Bulut = {
    hazir: false,
    kullanici: null,
    _fb: null,

    yapilandirma: function () { return Atlas.oku('firebase', null); },
    yapilandirildiMi: function () {
      var y = Bulut.yapilandirma();
      return !!(y && y.apiKey && y.projectId);
    },

    /* SDK'yı yalnız gerekince, modül olarak indir */
    yukle: function () {
      if (Bulut._fb) return Promise.resolve(Bulut._fb);
      var y = Bulut.yapilandirma();
      if (!y) return Promise.reject({ kod: 'yapilandirma-yok' });
      var TABAN = 'https://www.gstatic.com/firebasejs/10.12.2/';
      return Promise.all([
        import(TABAN + 'firebase-app.js'),
        import(TABAN + 'firebase-auth.js'),
        import(TABAN + 'firebase-firestore.js')
      ]).then(function (m) {
        var app = m[0].initializeApp(y);
        Bulut._fb = {
          app: app,
          auth: m[1], authNesnesi: m[1].getAuth(app),
          fs: m[2], db: m[2].getFirestore(app)
        };
        Bulut.hazir = true;
        Bulut._fb.auth.onAuthStateChanged(Bulut._fb.authNesnesi, function (u) {
          Bulut.kullanici = u;
          Atlas.olay('bulut-kullanici', u);
        });
        return Bulut._fb;
      }).catch(function (e) {
        return Promise.reject({ kod: 'sdk-yuklenemedi', mesaj: String(e && e.message || e) });
      });
    },

    girisAnonim: function () {
      return Bulut.yukle().then(function (f) {
        return f.auth.signInAnonymously(f.authNesnesi);
      }).then(function (r) { Bulut.kullanici = r.user; return r.user; });
    },
    girisEposta: function (eposta, sifre, yeni) {
      return Bulut.yukle().then(function (f) {
        return yeni
          ? f.auth.createUserWithEmailAndPassword(f.authNesnesi, eposta, sifre)
          : f.auth.signInWithEmailAndPassword(f.authNesnesi, eposta, sifre);
      }).then(function (r) { Bulut.kullanici = r.user; return r.user; });
    },
    cikis: function () {
      if (!Bulut._fb) return Promise.resolve();
      return Bulut._fb.auth.signOut(Bulut._fb.authNesnesi).then(function () { Bulut.kullanici = null; });
    },

    belge: function () {
      var f = Bulut._fb;
      if (!f || !Bulut.kullanici) throw { kod: 'giris-yok' };
      return f.fs.doc(f.db, 'atlas', Bulut.kullanici.uid);
    },

    /* buluttan çek → birleştir → cihaza uygula → buluta geri yaz */
    tamSenkron: function () {
      return Bulut.yukle().then(function (f) {
        if (!Bulut.kullanici) throw { kod: 'giris-yok' };
        return f.fs.getDoc(Bulut.belge());
      }).then(function (anlik) {
        var uzak = anlik.exists() ? anlik.data() : null;
        var yerel = Atlas.Yedek.uret();
        var birlesik = Bulut.birlestir(yerel, uzak);
        Atlas.Yedek.yukle(birlesik, false);
        var f = Bulut._fb;
        birlesik.guncelleme = Date.now();
        return f.fs.setDoc(Bulut.belge(), birlesik).then(function () {
          Atlas.yaz('bulut-son', Date.now());
          return birlesik;
        });
      });
    },

    /* birleştirme: kayıt bazında daha yeni olan kazanır */
    birlestir: function (yerel, uzak) {
      if (!uzak) return yerel;
      var out = JSON.parse(JSON.stringify(yerel));

      /* SRS — her anahtar için son çalışma zamanı daha yeni olan */
      out.srs = out.srs || {};
      var us = uzak.srs || {};
      for (var k in us) {
        var y = out.srs[k];
        if (!y || (us[k].son || 0) > (y.son || 0)) out.srs[k] = us[k];
      }

      /* günlük — gün bazında en yüksek sayaç (aynı gün iki cihazda çalışılmış olabilir) */
      out.gunluk = out.gunluk || {};
      var ug = uzak.gunluk || {};
      for (var g in ug) {
        var yg = out.gunluk[g];
        if (!yg) out.gunluk[g] = ug[g];
        else {
          out.gunluk[g] = {
            sayac: Math.max(yg.sayac || 0, ug[g].sayac || 0),
            dogru: Math.max(yg.dogru || 0, ug[g].dogru || 0),
            yanlis: Math.max(yg.yanlis || 0, ug[g].yanlis || 0),
            saniye: Math.max(yg.saniye || 0, ug[g].saniye || 0),
            saat: Object.assign({}, ug[g].saat, yg.saat),
            tur: Object.assign({}, ug[g].tur, yg.tur)
          };
        }
      }

      /* mastery — öğe bazında son dokunulan */
      out.mastery = out.mastery || {};
      var um = uzak.mastery || {};
      for (var o in um) {
        var ym = out.mastery[o];
        if (!ym || (um[o].t || 0) > (ym.t || 0)) out.mastery[o] = um[o];
      }

      /* seri — en yüksek */
      if (uzak.seri) {
        out.seri = out.seri || {};
        out.seri.enIyi = Math.max(out.seri.enIyi || 0, uzak.seri.enIyi || 0);
        if ((uzak.seri.son || '') > (out.seri.son || '')) {
          out.seri.gun = uzak.seri.gun; out.seri.son = uzak.seri.son;
        }
      }

      /* listeler — birleşim, id/kelime tekilleştirilir */
      out['ozel-cumle'] = tekille((out['ozel-cumle'] || []).concat(uzak['ozel-cumle'] || []), 'id');
      out.hata = tekille((out.hata || []).concat(uzak.hata || []), function (x) { return x.tip + ':' + x.id; });
      var kl = (out['kelime-liste'] || []).concat(uzak['kelime-liste'] || []);
      out['kelime-liste'] = kl.filter(function (x, i) { return kl.indexOf(x) === i; });

      /* rozet ve not — birleşim */
      out.rozet = Object.assign({}, uzak.rozet, out.rozet);
      out.not = Object.assign({}, uzak.not, out.not);

      /* profil — yerel kazanır (kullanıcı burada oturuyor) */
      out.profil = out.profil || uzak.profil;
      return out;
    },

    /* değişiklik olunca gecikmeli otomatik gönder */
    _bekleyen: null,
    otoGonder: function () {
      if (!Bulut.kullanici || !Atlas.Ayar.al().otoSenkron) return;
      if (Bulut._bekleyen) clearTimeout(Bulut._bekleyen);
      Bulut._bekleyen = setTimeout(function () {
        var f = Bulut._fb; if (!f) return;
        var veri = Atlas.Yedek.uret();
        veri.guncelleme = Date.now();
        f.fs.setDoc(Bulut.belge(), veri).then(function () {
          Atlas.yaz('bulut-son', Date.now());
        }).catch(function () {});
      }, 2500);
    },

    hataMesaji: function (h) {
      var k = (h && h.kod) || (h && h.code) || '';
      if (k === 'yapilandirma-yok') return 'Firebase ayarların girilmemiş. Aşağıdaki alana proje yapılandırmanı yapıştır.';
      if (k === 'sdk-yuklenemedi') return 'Firebase kitaplığı indirilemedi. İnternet bağlantını kontrol et.';
      if (k === 'giris-yok') return 'Önce oturum aç.';
      if (/auth\/invalid-email/.test(k)) return 'E-posta adresi geçersiz.';
      if (/auth\/weak-password/.test(k)) return 'Şifre en az 6 karakter olmalı.';
      if (/auth\/email-already-in-use/.test(k)) return 'Bu e-posta zaten kayıtlı. “Giriş yap” ile dene.';
      if (/auth\/invalid-credential|auth\/wrong-password|auth\/user-not-found/.test(k)) return 'E-posta veya şifre hatalı.';
      if (/auth\/operation-not-allowed/.test(k)) return 'Bu giriş yöntemi Firebase konsolunda açık değil.';
      if (/permission-denied/.test(k)) return 'Firestore kuralların yazmaya izin vermiyor.';
      return 'Bulut işlemi başarısız: ' + (h && (h.mesaj || h.message) || 'bilinmeyen hata');
    }
  };

  function tekille(dizi, anahtar) {
    var f = typeof anahtar === 'function' ? anahtar : function (x) { return x[anahtar]; };
    var gorulen = {}, out = [];
    dizi.forEach(function (x) {
      var k = f(x);
      if (k === undefined || gorulen[k]) return;
      gorulen[k] = 1; out.push(x);
    });
    return out;
  }

  global.Hatirlatma = Hatirlatma;
  global.Bulut = Bulut;

  /* veri değişince otomatik gönder */
  if (global.Atlas) {
    Atlas.on('srs', function () { Bulut.otoGonder(); });
    Atlas.on('gunluk', function () { Bulut.otoGonder(); });
  }
})(window);
