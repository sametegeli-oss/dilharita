/* ═══════════════════════════════════════════════════════════════
   ATLAS · USTALIK MOTORU  (mastery)
   SRS "ne zaman tekrar" sorusunu cevaplar. Bu motor farklı bir soru
   sorar: "bu cümleyi HANGİ BECERİYLE biliyor?"

   Beş beceri, artan zorlukta:
     tanima     gördü, seçebiliyor mu?
     dinleme    duyunca anlıyor mu?
     hatirlama  Türkçesi verilince üretebiliyor mu?
     uretim     kendi yazıyor mu?
     akicilik   konuşurken çıkarabiliyor mu?

   Mimari: her aktivite önce KANIT olarak kaydedilir (ham olay),
   skor kanıtlardan türetilir. Böylece puanlama kuralı değişirse
   geçmiş veriden yeniden hesaplanabilir.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var BECERILER = ['tanima', 'dinleme', 'hatirlama', 'uretim', 'akicilik'];
  var AGIRLIK = { tanima: 1, dinleme: 1.1, hatirlama: 1.3, uretim: 1.6, akicilik: 1.8 };
  var KANIT_SINIRI = 40;      /* öğe başına saklanan kanıt */
  var OGE_SINIRI = 4000;      /* toplam öğe — depo taşmasın */

  /* çalışma kipi → hangi beceriyi ölçer */
  var KIP_BECERI = {
    tanima: 'tanima',
    dinleme: 'dinleme',
    bosluk: 'hatirlama',
    uretim: 'uretim',
    telaffuz: 'akicilik',
    sohbet: 'akicilik',
    quiz: 'tanima',
    kart: 'hatirlama',
    drill: 'uretim',
    sinav: 'hatirlama'
  };

  function depo() { return Atlas.oku('mastery', {}); }
  function kaydet(d) { Atlas.yaz('mastery', d); }

  /* son kanıtlar daha ağırlıklı; az kanıt varsa skora tam güvenilmez */
  function skorTuret(kanitlar, beceri) {
    var ilgili = kanitlar.filter(function (k) { return k.b === beceri; });
    if (!ilgili.length) return 0;
    var son = ilgili.slice(-8);
    var toplam = 0, agirlik = 0;
    son.forEach(function (k, i) {
      var w = 1 + i * 0.3;
      toplam += (k.d ? 100 : 0) * w;
      agirlik += w;
    });
    var taban = agirlik ? toplam / agirlik : 0;
    var guven = Math.min(1, ilgili.length / 3);
    return Math.round(taban * guven);
  }

  function genelSkor(s) {
    var t = 0, w = 0;
    BECERILER.forEach(function (b) {
      var a = AGIRLIK[b] || 1;
      t += (s[b] || 0) * a; w += a;
    });
    return w ? Math.round(t / w) : 0;
  }

  var Mastery = {
    BECERILER: BECERILER,
    KIP_BECERI: KIP_BECERI,

    beceriAdi: function (b) {
      return ({
        tanima: 'Tanıma', dinleme: 'Dinleme', hatirlama: 'Hatırlama',
        uretim: 'Üretim', akicilik: 'Akıcılık'
      })[b] || b;
    },
    beceriAciklama: function (b) {
      return ({
        tanima: 'Görünce tanıyorsun',
        dinleme: 'Duyunca anlıyorsun',
        hatirlama: 'Türkçesinden çıkarabiliyorsun',
        uretim: 'Kendin yazabiliyorsun',
        akicilik: 'Konuşurken çıkarabiliyorsun'
      })[b] || '';
    },
    etiket: function (skor) {
      if (skor >= 85) return { ad: 'Usta', renk: 'var(--ok)', ikon: '◆' };
      if (skor >= 65) return { ad: 'Sağlam', renk: 'var(--brand-2)', ikon: '◈' };
      if (skor >= 40) return { ad: 'Gelişiyor', renk: 'var(--warn)', ikon: '◇' };
      if (skor > 0) return { ad: 'Zayıf', renk: 'var(--bad)', ikon: '○' };
      return { ad: 'Yeni', renk: 'var(--ink-3)', ikon: '·' };
    },

    /* kanıt ekle */
    kaydet: function (oge, beceri, dogruMu, ek) {
      if (!oge) return null;
      if (BECERILER.indexOf(beceri) < 0) beceri = 'tanima';
      var d = depo();
      var kayit = d[oge] || { k: [], s: {}, g: 0, t: 0 };
      kayit.k.push({ b: beceri, d: dogruMu ? 1 : 0, z: Date.now() });
      if (kayit.k.length > KANIT_SINIRI) kayit.k = kayit.k.slice(-KANIT_SINIRI);
      BECERILER.forEach(function (b) { kayit.s[b] = skorTuret(kayit.k, b); });
      kayit.g = genelSkor(kayit.s);
      kayit.t = Date.now();
      if (ek && ek.kaynak) kayit.kaynak = ek.kaynak;
      d[oge] = kayit;

      /* depo taşmasın: en eski dokunulanları at */
      var anahtarlar = Object.keys(d);
      if (anahtarlar.length > OGE_SINIRI) {
        anahtarlar.sort(function (a, b) { return (d[a].t || 0) - (d[b].t || 0); });
        anahtarlar.slice(0, anahtarlar.length - OGE_SINIRI).forEach(function (a) { delete d[a]; });
      }
      kaydet(d);
      Atlas.olay('mastery', { oge: oge, beceri: beceri, kayit: kayit });
      return kayit;
    },

    /* kip adından beceriyi bul ve kaydet — ekranların kullandığı kısayol */
    kipten: function (oge, kip, dogruMu, ek) {
      return Mastery.kaydet(oge, KIP_BECERI[kip] || 'tanima', dogruMu, ek);
    },

    al: function (oge) {
      var k = depo()[oge];
      if (!k) {
        var bos = { genel: 0 };
        BECERILER.forEach(function (b) { bos[b] = 0; });
        return bos;
      }
      var out = { genel: k.g || 0, guncel: k.t };
      BECERILER.forEach(function (b) { out[b] = (k.s || {})[b] || 0; });
      return out;
    },

    /* en zayıf beceri — bir sonraki alıştırmayı bu belirler */
    zayifBeceri: function (oge) {
      var s = Mastery.al(oge);
      var enDusuk = null, min = 101;
      BECERILER.forEach(function (b) {
        if (s[b] < min) { min = s[b]; enDusuk = b; }
      });
      return enDusuk;
    },

    /* zayıf becerinin ölçüldüğü çalışma kipini öner */
    onerilenKip: function (oge) {
      var b = Mastery.zayifBeceri(oge);
      for (var kip in KIP_BECERI) {
        if (KIP_BECERI[kip] === b && ['tanima', 'dinleme', 'bosluk', 'uretim', 'telaffuz'].indexOf(kip) > -1) return kip;
      }
      return 'uretim';
    },

    /* tüm öğelerin beceri ortalaması — profil radarı */
    ozet: function () {
      var d = depo();
      var toplam = {}, sayi = {};
      BECERILER.forEach(function (b) { toplam[b] = 0; sayi[b] = 0; });
      var n = 0, genelToplam = 0;
      for (var oge in d) {
        var k = d[oge];
        n++; genelToplam += k.g || 0;
        BECERILER.forEach(function (b) {
          var v = (k.s || {})[b] || 0;
          if (v > 0) { toplam[b] += v; sayi[b]++; }
        });
      }
      var out = { oge: n, genel: n ? Math.round(genelToplam / n) : 0, beceri: {} };
      BECERILER.forEach(function (b) {
        out.beceri[b] = sayi[b] ? Math.round(toplam[b] / sayi[b]) : 0;
        out.beceri[b + '_n'] = sayi[b];
      });
      return out;
    },

    /* profil düzeyinde en zayıf beceri — koç bunu kullanır */
    profilZayifi: function () {
      var o = Mastery.ozet();
      if (!o.oge) return null;
      var enDusuk = null, min = 101;
      BECERILER.forEach(function (b) {
        if (o.beceri[b + '_n'] < 3) return;      /* kanıt yetersizse yorum yapma */
        if (o.beceri[b] < min) { min = o.beceri[b]; enDusuk = b; }
      });
      return enDusuk;
    },

    /* belli bir beceride zayıf öğeler — hedefli alıştırma listesi */
    zayifOgeler: function (beceri, adet) {
      adet = adet || 20;
      var d = depo(), out = [];
      for (var oge in d) {
        var s = (d[oge].s || {})[beceri];
        if (s !== undefined && s < 60) out.push({ oge: oge, skor: s, genel: d[oge].g });
      }
      out.sort(function (a, b) { return a.skor - b.skor; });
      return out.slice(0, adet);
    },

    sil: function (oge) {
      var d = depo(); delete d[oge]; kaydet(d);
    }
  };

  global.Mastery = Mastery;

  /* Atlas.cevapla'ya bağlan — her cevap otomatik kanıt olur.
     Tek giriş noktası olduğu için hiçbir ekran unutamaz. */
  if (global.Atlas) {
    Atlas.on('cevap', function (o) {
      if (!o || !o.id) return;
      var kip = o.kip || Atlas.oku('son-kip', 'uretim');
      Mastery.kipten((o.tip || 'c') + ':' + o.id, kip, o.dogruMu, { kaynak: o.mod });
    });
  }
})(window);
