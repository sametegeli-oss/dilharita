/* ═══════════════════════════════════════════════════════════════
   ATLAS · ÇEKİRDEK
   Tek gerçeklik kaynağı. Her ekran buradan okur, buraya yazar.
   Eski uygulamada ilerleme 11 ayrı anahtara dağılmıştı; burada
   tek depo + tek olay yayını var.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var GUN = 86400000;
  var AD = 'atlas:';

  /* ───── depo ───────────────────────────────────────────────── */
  function oku(k, v) {
    try { var s = localStorage.getItem(AD + k); return s ? JSON.parse(s) : v; }
    catch (e) { return v; }
  }
  function yaz(k, v) {
    try { localStorage.setItem(AD + k, JSON.stringify(v)); }
    catch (e) { if (e && /quota/i.test(e.name || '')) Atlas.olay('depo-doldu'); }
    return v;
  }
  function sil(k) { try { localStorage.removeItem(AD + k); } catch (e) {} }

  /* ───── olay yayını ────────────────────────────────────────── */
  var dinleyiciler = {};
  function on(ad, fn) { (dinleyiciler[ad] = dinleyiciler[ad] || []).push(fn); return fn; }
  function off(ad, fn) {
    var l = dinleyiciler[ad]; if (!l) return;
    var i = l.indexOf(fn); if (i > -1) l.splice(i, 1);
  }
  function olay(ad, veri) {
    (dinleyiciler[ad] || []).forEach(function (f) { try { f(veri); } catch (e) { console.warn(e); } });
    (dinleyiciler['*'] || []).forEach(function (f) { try { f(ad, veri); } catch (e) {} });
  }

  /* ───── tarih yardımcıları ─────────────────────────────────── */
  function bugun(d) {
    d = d ? new Date(d) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function gunFarki(a, b) {
    return Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / GUN);
  }
  function gunEkle(gun, n) {
    var d = new Date(gun + 'T00:00'); d.setDate(d.getDate() + n); return bugun(d);
  }

  /* ═══════════════════════════════════════════════════════════
     PROFİL
     ═══════════════════════════════════════════════════════════ */
  var VARSAYILAN_PROFIL = {
    ad: '', seviye: '', amac: '', hedef: 20, kurulum: false, baslangic: bugun()
  };
  var Profil = {
    al: function () { return Object.assign({}, VARSAYILAN_PROFIL, oku('profil', {})); },
    kur: function (yeni) {
      var p = Object.assign(Profil.al(), yeni || {});
      yaz('profil', p);
      /* eski uygulamayla uyum: seviye üç yere birden yazılır */
      try {
        if (p.seviye) {
          localStorage.setItem('dh-level', p.seviye);
          var pr = JSON.parse(localStorage.getItem('dh-profile-v1') || '{}');
          pr.seviye = p.seviye; pr.hedef = p.hedef;
          localStorage.setItem('dh-profile-v1', JSON.stringify(pr));
        }
      } catch (e) {}
      olay('profil', p);
      return p;
    },
    seviyeIndeksi: function () {
      var s = Profil.al().seviye;
      var i = Atlas.SEVIYELER.indexOf(s);
      return i < 0 ? 0 : i;
    }
  };

  /* ═══════════════════════════════════════════════════════════
     AYARLAR
     ═══════════════════════════════════════════════════════════ */
  var VARSAYILAN_AYAR = {
    tema: 'gece', okuma: false, hareket: true,
    sesHiz: 0.9, sesEn: '', sesTr: '', otoSes: true,
    aiSaglayici: 'groq', aiAnahtar: '', aiModel: 'llama-3.3-70b-versatile',
    gunlukHatirlatma: '', klavye: true, hedefUyari: true,
    gorsel: true, gorselAnahtar: '', otoSenkron: true
  };
  var Ayar = {
    al: function () { return Object.assign({}, VARSAYILAN_AYAR, oku('ayar', {})); },
    kur: function (y) {
      var a = Object.assign(Ayar.al(), y || {});
      yaz('ayar', a); Ayar.uygula(a); olay('ayar', a); return a;
    },
    uygula: function (a) {
      a = a || Ayar.al();
      document.documentElement.dataset.tema = a.tema === 'isik' ? 'isik' : 'gece';
      document.documentElement.dataset.okuma = a.okuma ? '1' : '0';
      var m = document.querySelector('meta[name=theme-color]');
      if (m) m.content = a.tema === 'isik' ? '#f4f5fb' : '#05060d';
    }
  };

  /* ═══════════════════════════════════════════════════════════
     SRS · SM-2 (düzeltilmiş)
     Eski kodda q sabit 4 idi ve SM-2'de q=4 düzeltme terimini tam
     olarak 0 yapar → ef hiç artmaz, sadece düşer. Burada q gerçek
     sinyalden (benzerlik yüzdesi / kendini değerlendirme) türetilir.
     ═══════════════════════════════════════════════════════════ */
  /* SRS haritası sık okunuyor (506 modülün ilerlemesi bir ekranda
     hesaplanıyor). Her okumada JSON.parse etmemek için bellekte
     tutuluyor; her yazmada geçersiz kılınıyor. */
  var srsBellek = null;

  var SRS = {
    ARALIKLAR: [1, 4],
    anahtar: function (tip, id) { return tip + ':' + id; },
    tumu: function () {
      if (!srsBellek) srsBellek = oku('srs', {});
      return srsBellek;
    },
    bellegiBosalt: function () { srsBellek = null; },
    getir: function (tip, id) { return SRS.tumu()[SRS.anahtar(tip, id)] || null; },

    kalite: function (skor, anlamOk) {
      if (typeof skor !== 'number' || skor < 0) return 4;
      if (skor >= 90 || (anlamOk && skor >= 80)) return 5;
      if (skor >= 70) return 4;
      if (skor >= 45) return 3;
      return 2;
    },

    adim: function (n, zor, q) {
      n = (n && typeof n === 'object') ? n : { rep: 0, ef: 2.5, aralik: 0, vade: 0, son: 0, tekrar: 0, hata: 0 };
      var t = Date.now();
      if (zor) {
        n.rep = 0; n.aralik = 0;
        n.ef = Math.max(1.3, (n.ef || 2.5) - 0.2);
        n.hata = (n.hata || 0) + 1;
      } else {
        n.rep = (n.rep || 0) + 1;
        if (typeof q !== 'number') q = 4;
        n.ef = Math.max(1.3, Math.min(3.0, (n.ef || 2.5) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));
        if (n.rep === 1) n.aralik = 1;
        else if (n.rep === 2) n.aralik = 4;
        else n.aralik = Math.round((n.aralik || 4) * n.ef);
      }
      n.tekrar = (n.tekrar || 0) + 1;
      n.son = t; n.vade = t + n.aralik * GUN;
      return n;
    },

    kaydet: function (tip, id, zor, skor, ek) {
      var hepsi = SRS.tumu();
      var k = SRS.anahtar(tip, id);
      var q = SRS.kalite(skor, ek && ek.anlamOk);
      var n = SRS.adim(hepsi[k], zor, q);
      if (ek) { if (ek.mod) n.mod = ek.mod; if (ek.lvl) n.lvl = ek.lvl; }
      n.tip = tip;
      hepsi[k] = n; yaz('srs', hepsi); srsBellek = hepsi;
      olay('srs', { tip: tip, id: id, kayit: n });
      return n;
    },

    unut: function (tip, id) {
      var h = SRS.tumu(); delete h[SRS.anahtar(tip, id)]; yaz('srs', h); srsBellek = h;
      olay('srs', { tip: tip, id: id, kayit: null });
    },

    /* vadesi gelenler — sadece SRS kaydı olanlar taranır */
    vadesiGelen: function (tip) {
      var h = SRS.tumu(), t = Date.now(), out = [];
      for (var k in h) {
        var p = k.indexOf(':'); var tp = k.slice(0, p), id = k.slice(p + 1);
        if (tip && tp !== tip) continue;
        if ((h[k].vade || 0) <= t) out.push({ tip: tp, id: id, kayit: h[k] });
      }
      out.sort(function (a, b) { return (a.kayit.vade || 0) - (b.kayit.vade || 0); });
      return out;
    },

    sayim: function () {
      var h = SRS.tumu(), t = Date.now();
      var s = { toplam: 0, vade: 0, ogrenildi: 0, ogreniliyor: 0, yeni: 0, cumle: 0, kelime: 0, pv: 0 };
      for (var k in h) {
        var n = h[k]; s.toplam++;
        if ((n.vade || 0) <= t) s.vade++;
        if ((n.aralik || 0) >= 21) s.ogrenildi++; else s.ogreniliyor++;
        var tp = k.slice(0, k.indexOf(':'));
        if (tp === 'c') s.cumle++; else if (tp === 'k') s.kelime++; else if (tp === 'p') s.pv++;
      }
      return s;
    },

    /* unutma eğrisi tahmini: bugünden itibaren 30 gün vade dağılımı */
    vadeDagilimi: function (gun) {
      gun = gun || 30;
      var h = SRS.tumu(), t = Date.now(), out = new Array(gun).fill(0);
      for (var k in h) {
        var d = Math.floor(((h[k].vade || 0) - t) / GUN);
        if (d < 0) d = 0;
        if (d < gun) out[d]++;
      }
      return out;
    }
  };

  /* ═══════════════════════════════════════════════════════════
     GÜNLÜK · seri · aktivite
     ═══════════════════════════════════════════════════════════ */
  var Gunluk = {
    hepsi: function () { return oku('gunluk', {}); },
    gun: function (g) {
      g = g || bugun();
      var h = Gunluk.hepsi();
      return h[g] || { sayac: 0, dogru: 0, yanlis: 0, saniye: 0, saat: {}, tur: {} };
    },
    ekle: function (alan, n, tur) {
      n = n == null ? 1 : n;
      var h = Gunluk.hepsi(), g = bugun();
      var d = h[g] || { sayac: 0, dogru: 0, yanlis: 0, saniye: 0, saat: {}, tur: {} };
      d[alan] = (d[alan] || 0) + n;
      if (alan === 'sayac') {
        var s = new Date().getHours();
        d.saat[s] = (d.saat[s] || 0) + n;
        if (tur) d.tur[tur] = (d.tur[tur] || 0) + n;
      }
      h[g] = d; yaz('gunluk', h);
      Seri.dokun();
      olay('gunluk', d);
      return d;
    },
    son: function (n) {
      n = n || 30; var out = [], g = bugun();
      for (var i = n - 1; i >= 0; i--) {
        var t = gunEkle(g, -i);
        out.push({ gun: t, veri: Gunluk.gun(t) });
      }
      return out;
    },
    temizle: function (koruGun) {
      koruGun = koruGun || 400;
      var h = Gunluk.hepsi(), g = bugun(), n = 0;
      for (var k in h) { if (gunFarki(k, g) > koruGun) { delete h[k]; n++; } }
      if (n) yaz('gunluk', h);
      return n;
    }
  };

  var Seri = {
    al: function () { return oku('seri', { gun: 0, son: '', enIyi: 0, dondurma: 2 }); },
    dokun: function () {
      var s = Seri.al(), g = bugun();
      if (s.son === g) return s;
      var fark = s.son ? gunFarki(s.son, g) : 999;
      if (fark === 1) s.gun = (s.gun || 0) + 1;
      else if (fark > 1) {
        /* seri koruma: 1 gün kaçırma affediliyor, hakkı varsa */
        if (fark === 2 && (s.dondurma || 0) > 0) { s.dondurma--; s.gun = (s.gun || 0) + 1; }
        else s.gun = 1;
      } else s.gun = Math.max(1, s.gun || 1);
      s.son = g;
      s.enIyi = Math.max(s.enIyi || 0, s.gun);
      yaz('seri', s); olay('seri', s);
      return s;
    },
    canli: function () {
      var s = Seri.al(); if (!s.son) return 0;
      var f = gunFarki(s.son, bugun());
      return f <= 1 ? (s.gun || 0) : (f === 2 && (s.dondurma || 0) > 0 ? s.gun : 0);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     HATA DEFTERİ
     ═══════════════════════════════════════════════════════════ */
  var Hata = {
    hepsi: function () { return oku('hata', []); },
    ekle: function (kayit) {
      var h = Hata.hepsi();
      kayit.ts = Date.now();
      kayit.gun = bugun();
      /* aynı kalem tekrar yanlışsa sayacı artır, kopyalama yapma */
      var v = h.find(function (x) { return x.tip === kayit.tip && x.id === kayit.id; });
      if (v) { v.kez = (v.kez || 1) + 1; v.ts = kayit.ts; v.cevap = kayit.cevap; v.skor = kayit.skor; }
      else { kayit.kez = 1; h.unshift(kayit); }
      if (h.length > 600) h.length = 600;
      yaz('hata', h); olay('hata', h);
      return h;
    },
    coz: function (tip, id) {
      var h = Hata.hepsi().filter(function (x) { return !(x.tip === tip && x.id === id); });
      yaz('hata', h); olay('hata', h); return h;
    },
    /* hangi dilbilgisi etiketinde ne kadar hata var */
    egilim: function () {
      var m = {};
      Hata.hepsi().forEach(function (x) {
        (String(x.etiket || x.grammar || 'diğer').split(/[,·]/)).forEach(function (t) {
          t = t.trim(); if (!t) return;
          m[t] = (m[t] || 0) + (x.kez || 1);
        });
      });
      return Object.keys(m).map(function (k) { return { ad: k, n: m[k] }; })
        .sort(function (a, b) { return b.n - a.n; });
    }
  };

  /* ═══════════════════════════════════════════════════════════
     ROZETLER
     ═══════════════════════════════════════════════════════════ */
  var ROZET_TANIM = [
    { id: 'ilk-adim', ad: 'İlk Adım', ikon: '🌱', kosul: function (d) { return d.toplamCalisma >= 1; }, aciklama: 'İlk cümleni çalıştın' },
    { id: 'yuz', ad: 'Yüzbaşı', ikon: '💯', kosul: function (d) { return d.toplamCalisma >= 100; }, aciklama: '100 tekrar' },
    { id: 'bin', ad: 'Binbaşı', ikon: '🏅', kosul: function (d) { return d.toplamCalisma >= 1000; }, aciklama: '1000 tekrar' },
    { id: 'seri-7', ad: 'Bir Hafta', ikon: '🔥', kosul: function (d) { return d.seri >= 7; }, aciklama: '7 gün üst üste' },
    { id: 'seri-30', ad: 'Bir Ay', ikon: '☄️', kosul: function (d) { return d.seri >= 30; }, aciklama: '30 gün üst üste' },
    { id: 'seri-100', ad: 'Yüz Gün', ikon: '👑', kosul: function (d) { return d.seri >= 100; }, aciklama: '100 gün üst üste' },
    { id: 'modul-1', ad: 'İlk Modül', ikon: '📗', kosul: function (d) { return d.bitenModul >= 1; }, aciklama: 'Bir modülü bitirdin' },
    { id: 'modul-10', ad: 'Onluk', ikon: '📚', kosul: function (d) { return d.bitenModul >= 10; }, aciklama: '10 modül bitti' },
    { id: 'modul-50', ad: 'Kütüphaneci', ikon: '🏛️', kosul: function (d) { return d.bitenModul >= 50; }, aciklama: '50 modül bitti' },
    { id: 'kelime-100', ad: 'Kelime Avcısı', ikon: '🎯', kosul: function (d) { return d.kelime >= 100; }, aciklama: '100 kelime öğrenildi' },
    { id: 'kelime-500', ad: 'Sözlük', ikon: '📖', kosul: function (d) { return d.kelime >= 500; }, aciklama: '500 kelime' },
    { id: 'usta', ad: 'Usta', ikon: '⚡', kosul: function (d) { return d.ogrenildi >= 300; }, aciklama: '300 kalem kalıcı hafızada' },
    { id: 'gece-kusu', ad: 'Gece Kuşu', ikon: '🦉', kosul: function (d) { return d.geceCalisma; }, aciklama: 'Gece 00–05 arası çalıştın' },
    { id: 'erkenci', ad: 'Erkenci', ikon: '🐓', kosul: function (d) { return d.sabahCalisma; }, aciklama: 'Sabah 05–08 arası çalıştın' },
    { id: 'kusursuz', ad: 'Kusursuz Tur', ikon: '💎', kosul: function (d) { return d.kusursuzTur; }, aciklama: 'Bir oturumu hatasız bitirdin' }
  ];
  var Rozet = {
    TANIM: ROZET_TANIM,
    kazanilan: function () { return oku('rozet', {}); },
    denetle: function (ekstra) {
      var s = SRS.sayim();
      var gunler = Gunluk.hepsi();
      var toplam = 0, gece = false, sabah = false;
      for (var g in gunler) {
        toplam += gunler[g].sayac || 0;
        for (var h in (gunler[g].saat || {})) {
          var hh = +h;
          if (hh >= 0 && hh < 5) gece = true;
          if (hh >= 5 && hh < 8) sabah = true;
        }
      }
      var d = {
        toplamCalisma: toplam, seri: Seri.canli(), ogrenildi: s.ogrenildi,
        kelime: s.kelime, bitenModul: Ilerleme.bitenModulSayisi(),
        geceCalisma: gece, sabahCalisma: sabah,
        kusursuzTur: (ekstra && ekstra.kusursuzTur) || oku('kusursuz', false)
      };
      if (ekstra && ekstra.kusursuzTur) yaz('kusursuz', true);
      var kz = Rozet.kazanilan(), yeni = [];
      ROZET_TANIM.forEach(function (r) {
        if (!kz[r.id] && r.kosul(d)) { kz[r.id] = Date.now(); yeni.push(r); }
      });
      if (yeni.length) { yaz('rozet', kz); olay('rozet', yeni); }
      return yeni;
    }
  };

  /* ═══════════════════════════════════════════════════════════
     İLERLEME · modül seviyesinde
     ═══════════════════════════════════════════════════════════ */
  var Ilerleme = {
    /* bir modülün ilerlemesi: SRS kaydı olan id oranı — cümle indirmeden */
    modul: function (idler, harita) {
      if (!idler || !idler.length) return { n: 0, toplam: 0, oran: 0, ogrenildi: 0 };
      var h = harita || SRS.tumu(), n = 0, ogr = 0;
      for (var i = 0; i < idler.length; i++) {
        var k = h['c:' + idler[i]];
        if (k) { n++; if ((k.aralik || 0) >= 21) ogr++; }
      }
      return { n: n, toplam: idler.length, oran: Math.round(n / idler.length * 100), ogrenildi: ogr };
    },
    bitenModulSayisi: function () {
      var im = global.Veri && global.Veri.indexBellek;
      if (!im) return oku('biten-modul-say', 0);
      var h = SRS.tumu(), n = 0;
      im.modules.forEach(function (m) {
        if (Ilerleme.modul(m.ids, h).oran >= 100) n++;
      });
      yaz('biten-modul-say', n);
      return n;
    },
    sonModul: function (f) {
      if (f === undefined) return oku('son-modul', '');
      yaz('son-modul', f); return f;
    },
    /* seviye başına özet */
    seviyeOzeti: function () {
      var im = global.Veri && global.Veri.indexBellek;
      var out = {};
      Atlas.SEVIYELER.forEach(function (s) { out[s] = { modul: 0, biten: 0, cumle: 0, calisilan: 0 }; });
      if (!im) return out;
      var h = SRS.tumu();
      im.modules.forEach(function (m) {
        var o = out[m.lvl]; if (!o) return;
        var p = Ilerleme.modul(m.ids, h);
        o.modul++; o.cumle += m.n; o.calisilan += p.n;
        if (p.oran >= 100) o.biten++;
      });
      return out;
    }
  };

  /* ═══════════════════════════════════════════════════════════
     KARŞILAŞTIRMA
     Karşılaştırma karakter değil KELİME düzeyinde yapılır, çünkü
     iki dilbilgisel gerçeği hesaba katmak gerekiyor:

     1) Kısaltmalar. "wasn't" ile "was not" aynı cümledir; öğrenci
        hangisini yazarsa yazsın hata görmemeli. Bu yüzden her
        belirteç açılmış biçimine indirgeniyor.

     2) Cinsiyetsiz 3. tekil şahıs. Türkçe "O" cinsiyet belirtmez,
        İngilizce hedef cümle ise birini seçmek zorunda kalır.
        "O bir doktor." için hem [[He is a doctor.]] hem
        [[She is a doctor.]] doğrudur. Aynı gruptaki zamirler
        eşit sayılıyor — ama gruplar arası geçiş serbest DEĞİL:
        "he" ile "him" farklı gruplarda, o yüzden hâlâ hata.

     Yazım hataları için kısmi puan korunuyor: eşleşmeyen iki
     kelimenin bedeli, aralarındaki karakter benzerliğine göre
     0 ile 1 arasında bir kesir.
     ═══════════════════════════════════════════════════════════ */

  /* "I'm" = "I am". Karşılaştırmada açılmış biçim kullanılır. */
  var KISALTMA = {
    "i'm": ['i', 'am'], "you're": ['you', 'are'], "we're": ['we', 'are'], "they're": ['they', 'are'],
    "he's": ['he', 'is'], "she's": ['she', 'is'], "it's": ['it', 'is'], "that's": ['that', 'is'],
    "there's": ['there', 'is'], "here's": ['here', 'is'], "what's": ['what', 'is'],
    "who's": ['who', 'is'], "where's": ['where', 'is'], "how's": ['how', 'is'],
    "let's": ['let', 'us'],
    "i've": ['i', 'have'], "you've": ['you', 'have'], "we've": ['we', 'have'], "they've": ['they', 'have'],
    "i'll": ['i', 'will'], "you'll": ['you', 'will'], "we'll": ['we', 'will'], "they'll": ['they', 'will'],
    "he'll": ['he', 'will'], "she'll": ['she', 'will'], "it'll": ['it', 'will'],
    "i'd": ['i', 'would'], "you'd": ['you', 'would'], "we'd": ['we', 'would'],
    "they'd": ['they', 'would'], "he'd": ['he', 'would'], "she'd": ['she', 'would'],
    "isn't": ['is', 'not'], "aren't": ['are', 'not'], "wasn't": ['was', 'not'], "weren't": ['were', 'not'],
    "don't": ['do', 'not'], "doesn't": ['does', 'not'], "didn't": ['did', 'not'],
    "haven't": ['have', 'not'], "hasn't": ['has', 'not'], "hadn't": ['had', 'not'],
    "won't": ['will', 'not'], "wouldn't": ['would', 'not'],
    "can't": ['can', 'not'], "cannot": ['can', 'not'], "couldn't": ['could', 'not'],
    "shouldn't": ['should', 'not'], "mustn't": ['must', 'not'], "needn't": ['need', 'not'],
    "shan't": ['shall', 'not'], "ain't": ['is', 'not']
  };

  /* Cinsiyetsiz "O" karşılığı gruplar. Grup İÇİ serbest, grup ARASI değil. */
  var ZAMIR_GRUPLARI = [
    ['he', 'she', 'it'],
    ['him', 'her', 'it'],
    ['his', 'her', 'its'],
    ['himself', 'herself', 'itself']
  ];
  function zamirEsi(a, b) {
    for (var i = 0; i < ZAMIR_GRUPLARI.length; i++) {
      var g = ZAMIR_GRUPLARI[i];
      if (g.indexOf(a) > -1 && g.indexOf(b) > -1) return true;
    }
    return false;
  }

  function sadelestir(s) {
    return String(s || '').toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[^\p{L}\p{N}\s']/gu, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  /* metin → [{n: karşılaştırma biçimi, ham: ekranda gösterilecek}] */
  function belirtecler(metin) {
    var ham = String(metin || '').replace(/[’‘]/g, "'").match(/[\p{L}\p{N}']+(?:-[\p{L}\p{N}']+)*/gu) || [];
    var out = [];
    ham.forEach(function (h) {
      var n = h.toLowerCase().replace(/^'+|'+$/g, '');
      if (!n) return;
      if (KISALTMA[n]) KISALTMA[n].forEach(function (p, i) { out.push({ n: p, ham: i === 0 ? h : null }); });
      else out.push({ n: n, ham: h });
    });
    return out;
  }

  /* iki belirteç eşit mi: aynı kelime ya da aynı zamir grubunda */
  function esitMi(a, b) {
    if (a.n === b.n) return true;
    return zamirEsi(a.n, b.n);
  }

  /* karakter düzeyinde benzerlik — yazım hatasına kısmi puan için */
  function karakterBenzerligi(a, b) {
    if (a === b) return 1;
    var m = a.length, n = b.length;
    if (!m || !n) return 0;
    var onceki = new Array(n + 1), simdi = new Array(n + 1), i, j;
    for (j = 0; j <= n; j++) onceki[j] = j;
    for (i = 1; i <= m; i++) {
      simdi[0] = i;
      for (j = 1; j <= n; j++) {
        simdi[j] = Math.min(onceki[j] + 1, simdi[j - 1] + 1,
          onceki[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      var t = onceki; onceki = simdi; simdi = t;
    }
    return Math.max(0, (Math.max(m, n) - onceki[n]) / Math.max(m, n));
  }

  /* kelime düzeyinde hizalama matrisi (değiştirme bedeli kesirli) */
  function hizala(A, B) {
    var n = A.length, m = B.length, i, j;
    var d = [];
    for (i = 0; i <= n; i++) { d[i] = new Array(m + 1); d[i][0] = i; }
    for (j = 0; j <= m; j++) d[0][j] = j;
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        var bedel = esitMi(A[i - 1], B[j - 1]) ? 0 : 1 - karakterBenzerligi(A[i - 1].n, B[j - 1].n) * 0.75;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + bedel);
      }
    }
    return d;
  }

  function benzerlik(dogru, cevap) {
    var A = belirtecler(dogru), B = belirtecler(cevap);
    if (!A.length) return B.length ? 0 : 100;
    if (!B.length) return 0;
    var d = hizala(A, B);
    var mx = Math.max(A.length, B.length);
    return Math.max(0, Math.round((mx - d[A.length][B.length]) / mx * 100));
  }

  /* kelime kelime fark.
     t: '='  aynı
        '≈'  kabul edilen karşılık (kısaltma ya da cinsiyetsiz zamir)
        '-'  cevapta eksik
        '+'  cevapta fazla */
  function fark(dogru, cevap) {
    var A = belirtecler(dogru), B = belirtecler(cevap);
    var d = hizala(A, B);
    var out = [], i = A.length, j = B.length;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && esitMi(A[i - 1], B[j - 1])) {
        var ayni = A[i - 1].n === B[j - 1].n;
        /* ham === null → bu belirteç bir kısaltmanın ikinci yarısı
           ("wasn't" → was + not). Ekranda zaten birinci yarıyla
           birlikte görünüyor; tekrar yazarsak "wasn't not" çıkar. */
        if (B[j - 1].ham !== null) {
          out.unshift({
            t: ayni ? '=' : '≈',
            s: B[j - 1].ham,
            beklenen: ayni ? null : (A[i - 1].ham || A[i - 1].n)
          });
        }
        i--; j--;
      } else if (j > 0 && (i === 0 || d[i][j - 1] <= d[i - 1][j])) {
        /* fazlalık: kısaltmanın yarısı bile olsa göstermek gerekir */
        out.unshift({ t: '+', s: (B[j - 1].ham || B[j - 1].n) }); j--;
      } else {
        out.unshift({ t: '-', s: (A[i - 1].ham || A[i - 1].n) }); i--;
      }
    }
    return out;
  }

  /* cevap farklı yazılmış ama tamamen geçerli mi? (ekranda not göstermek için) */
  function esdegerNedeni(dogru, cevap) {
    var a = sadelestir(dogru), b = sadelestir(cevap);
    if (a === b) return null;
    var p = fark(dogru, cevap);
    if (p.some(function (o) { return o.t === '+' || o.t === '-'; })) return null;
    var zamir = p.some(function (o) { return o.t === '≈'; });
    var kisaltma = /'/.test(b) !== /'/.test(a) || belirtecler(dogru).length !== (String(cevap).match(/\S+/g) || []).length;
    if (zamir && kisaltma) return 'Kısaltma ve zamir seçimi serbest — cevabın doğru.';
    if (zamir) return 'Türkçe “O” cinsiyet belirtmez; he / she / it burada eşit derecede doğru.';
    if (kisaltma) return 'Kısaltmalı ve açık yazım aynı sayılır.';
    return 'Cevabın kabul edildi.';
  }

  /* ═══════════════════════════════════════════════════════════
     KENDİ CÜMLELERİM (fotoğraf/OCR/elle ekleme)
     ═══════════════════════════════════════════════════════════ */
  var Ozel = {
    hepsi: function () { return oku('ozel-cumle', []); },
    ekle: function (c) {
      var h = Ozel.hepsi();
      c.id = 'OZ-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      c.level = c.level || Profil.al().seviye || 'A2';
      c.module = c.module || 'Kendi Modülüm';
      h.unshift(c); yaz('ozel-cumle', h); olay('ozel', h);
      return c;
    },
    coklaEkle: function (liste) {
      var h = Ozel.hepsi();
      liste.forEach(function (c) {
        c.id = 'OZ-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        c.level = c.level || Profil.al().seviye || 'A2';
        c.module = c.module || 'Kendi Modülüm';
        h.unshift(c);
      });
      yaz('ozel-cumle', h); olay('ozel', h); return h;
    },
    sil: function (id) {
      var h = Ozel.hepsi().filter(function (x) { return x.id !== id; });
      yaz('ozel-cumle', h); olay('ozel', h); SRS.unut('c', id); return h;
    }
  };

  /* ═══════════════════════════════════════════════════════════
     NOTLAR (kullanıcının kendi açıklamaları)
     ═══════════════════════════════════════════════════════════ */
  var Not = {
    hepsi: function () { return oku('not', {}); },
    al: function (id) { return Not.hepsi()[id] || ''; },
    kur: function (id, m) {
      var h = Not.hepsi();
      if (m) h[id] = m; else delete h[id];
      yaz('not', h); olay('not', h);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     YEDEK / GERİ YÜKLE / GÖÇ
     ═══════════════════════════════════════════════════════════ */
  var ANAHTARLAR = ['profil', 'ayar', 'srs', 'gunluk', 'seri', 'hata', 'rozet',
    'ozel-cumle', 'not', 'son-modul', 'kelime-liste', 'sohbet-gecmis', 'kusursuz',
    'mastery', 'kitap-son', 'video-son'];

  var Yedek = {
    uret: function () {
      var o = { surum: 1, tarih: new Date().toISOString(), uygulama: 'atlas' };
      ANAHTARLAR.forEach(function (k) { var v = oku(k, null); if (v !== null) o[k] = v; });
      return o;
    },
    indir: function () {
      var veri = JSON.stringify(Yedek.uret(), null, 1);
      var b = new Blob([veri], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'atlas-yedek-' + bugun() + '.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    },
    yukle: function (obj, birlestir) {
      if (!obj || obj.uygulama !== 'atlas') throw new Error('Bu dosya bir Atlas yedeği değil.');
      ANAHTARLAR.forEach(function (k) {
        if (obj[k] === undefined) return;
        if (birlestir && k === 'srs') {
          var mevcut = oku('srs', {}), gelen = obj[k];
          for (var a in gelen) {
            if (!mevcut[a] || (gelen[a].son || 0) > (mevcut[a].son || 0)) mevcut[a] = gelen[a];
          }
          yaz('srs', mevcut);
        } else if (birlestir && k === 'gunluk') {
          var m2 = oku('gunluk', {}), g2 = obj[k];
          for (var d in g2) {
            if (!m2[d]) m2[d] = g2[d];
            else { m2[d].sayac = Math.max(m2[d].sayac || 0, g2[d].sayac || 0); }
          }
          yaz('gunluk', m2);
        } else yaz(k, obj[k]);
      });
      SRS.bellegiBosalt();
      Ayar.uygula(); olay('geri-yukleme');
      return true;
    },
    /* eski dilharita verisini içeri al */
    eskidenAl: function () {
      var sonuc = { srs: 0, seviye: '', gunluk: 0, hata: 0 };
      try {
        var srs = SRS.tumu(), bulundu = 0;
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (!k) continue;
          if (k.indexOf('srs:') === 0) {
            var id = k.slice(4);
            try {
              var n = JSON.parse(localStorage.getItem(k));
              if (n && typeof n === 'object') {
                var tip = /^[A-C][12]-M\d/.test(id) ? 'c' : 'k';
                srs[tip + ':' + id] = {
                  rep: n.rep || 0, ef: n.ef || 2.5, aralik: n.interval || 0,
                  vade: n.due || 0, son: n.last || 0, tekrar: n.rep || 0, hata: n.lapses || 0, tip: tip
                };
                bulundu++;
              }
            } catch (e) {}
          }
        }
        if (bulundu) { yaz('srs', srs); sonuc.srs = bulundu; }

        var p = JSON.parse(localStorage.getItem('dh-profile-v1') || '{}');
        var lvl = p.seviye || localStorage.getItem('dh-level') || '';
        if (lvl) { Profil.kur({ seviye: lvl, hedef: p.hedef || 20 }); sonuc.seviye = lvl; }

        var tr = JSON.parse(localStorage.getItem('dh-study-tracker-v1') || '{}');
        var gh = Gunluk.hepsi(), gn = 0;
        for (var g in tr) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(g)) continue;
          var v = tr[g];
          var say = typeof v === 'number' ? v : (v.count || v.sayac || 0);
          if (!gh[g]) { gh[g] = { sayac: say, dogru: 0, yanlis: 0, saniye: 0, saat: {}, tur: {} }; gn++; }
        }
        if (gn) { yaz('gunluk', gh); sonuc.gunluk = gn; }
      } catch (e) { console.warn('göç', e); }
      SRS.bellegiBosalt();
      olay('geri-yukleme');
      return sonuc;
    },
    hepsiniSil: function () {
      ANAHTARLAR.forEach(sil);
      SRS.bellegiBosalt();
      olay('geri-yukleme');
    }
  };

  /* ═══════════════════════════════════════════════════════════
     KOÇ · bugünün planı
     ═══════════════════════════════════════════════════════════ */
  var Koc = {
    plan: function () {
      var pr = Profil.al();
      var s = SRS.sayim();
      var g = Gunluk.gun();
      var kalan = Math.max(0, (pr.hedef || 20) - (g.sayac || 0));
      var adimlar = [];

      if (s.vade > 0) adimlar.push({
        ikon: '🔁', ad: 'Vadesi gelen tekrar', alt: s.vade + ' kalem seni bekliyor',
        yol: '#/tekrar', oncelik: 1, n: s.vade
      });
      if (Hata.hepsi().length >= 3) adimlar.push({
        ikon: '🧯', ad: 'Hata defterini kapat', alt: Hata.hepsi().length + ' kayıtlı hata',
        yol: '#/hatalar', oncelik: 3
      });
      if (kalan > 0) adimlar.push({
        ikon: '📘', ad: 'Yeni cümle çalış', alt: kalan + ' kalem hedefi tamamlar',
        yol: '#/ogren', oncelik: 2, n: kalan
      });
      adimlar.push({ ikon: '🗣️', ad: 'Konuşma pratiği', alt: 'Bir senaryo seç, İngilizce konuş', yol: '#/sohbet', oncelik: 4 });
      adimlar.push({ ikon: '🔤', ad: 'Kelime turu', alt: 'Sık kullanılan kelimelerden 10 kart', yol: '#/kelime', oncelik: 5 });

      adimlar.sort(function (a, b) { return a.oncelik - b.oncelik; });
      return { hedef: pr.hedef || 20, yapilan: g.sayac || 0, kalan: kalan, adimlar: adimlar, sayim: s };
    },
    /* kişisel tavsiye — hata eğilimine bakar */
    tavsiye: function () {
      var e = Hata.egilim();
      var s = SRS.sayim();
      var seri = Seri.canli();
      var zayif = global.Mastery && Mastery.profilZayifi();
      if (s.vade > 40) return 'Tekrar yığılmış. Bugün yeni cümle yerine önce vadesi gelenleri eritelim — yığın büyüdükçe unutma hızlanır.';
      if (zayif) {
        var o = Mastery.ozet();
        return 'Beş becerin içinde en zayıfı ' + Mastery.beceriAdi(zayif).toLowerCase() +
          ' (%' + o.beceri[zayif] + '). Akıllı tekrar bu beceriyi hedefleyen bir oturum kurar.';
      }
      if (e.length && e[0].n >= 4) return '"' + e[0].ad + '" konusunda ' + e[0].n + ' kez takıldın. Hata defterinden bu konuyu seçip üst üste çalışmak en hızlı yol.';
      if (seri >= 7) return seri + ' gündür aralıksız çalışıyorsun. Aralıklı tekrarın işe yaraması için asıl önemli olan tam da bu süreklilik.';
      if (s.toplam < 20) return 'Henüz başlangıçtasın. İlk hafta günde 15–20 cümle, sonrasında tekrarların kendiliğinden gelmesi için yeterli.';
      return 'Bugün için önerim: önce vadesi gelenler, sonra yeni modül. Yeniyi eskinin üstüne koymak, eskiyi tazelerken öğrenmeyi hızlandırır.';
    }
  };

  /* ═══════════════════════════════════════════════════════════
     DIŞA AÇILAN
     ═══════════════════════════════════════════════════════════ */
  var Atlas = {
    SEVIYELER: ['A1', 'A2', 'B1', 'B2', 'C1'],
    GUN: GUN,
    oku: oku, yaz: yaz, sil: sil,
    on: on, off: off, olay: olay,
    bugun: bugun, gunFarki: gunFarki, gunEkle: gunEkle,
    Profil: Profil, Ayar: Ayar, SRS: SRS, Gunluk: Gunluk, Seri: Seri,
    Hata: Hata, Rozet: Rozet, Ilerleme: Ilerleme, Ozel: Ozel, Not: Not,
    Yedek: Yedek, Koc: Koc,
    benzerlik: benzerlik, fark: fark, sadelestir: sadelestir,
    belirtecler: belirtecler, esdegerNedeni: esdegerNedeni,
    KISALTMA: KISALTMA, ZAMIR_GRUPLARI: ZAMIR_GRUPLARI,

    /* bir cevabı işleyen tek giriş noktası — her ekran bunu çağırır */
    cevapla: function (o) {
      /* o: {tip,id,dogruMu,skor,en,tr,mod,lvl,etiket,cevap,anlamOk} */
      var zor = !o.dogruMu;
      SRS.kaydet(o.tip || 'c', o.id, zor, o.skor, { mod: o.mod, lvl: o.lvl, anlamOk: o.anlamOk });
      Gunluk.ekle('sayac', 1, o.tip || 'c');
      Gunluk.ekle(o.dogruMu ? 'dogru' : 'yanlis', 1);
      if (!o.dogruMu) {
        Hata.ekle({
          tip: o.tip || 'c', id: o.id, en: o.en, tr: o.tr, cevap: o.cevap,
          skor: o.skor, modul: o.mod, etiket: o.etiket, seviye: o.lvl
        });
      } else if (o.skor >= 90) {
        Hata.coz(o.tip || 'c', o.id);
      }
      var yeniRozet = Rozet.denetle();
      olay('cevap', o);
      return yeniRozet;
    }
  };

  global.Atlas = Atlas;
})(window);
