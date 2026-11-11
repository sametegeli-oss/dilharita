/* dh-amac.js — kullanıcının "İngilizceyi ne için öğreniyorum?" seçimleri
   ====================================================================
   Tek kaynak: basla.html (ilk açılış), ozel-ders.html (Bana özel ders)
   ve dh-ozel-ders.js (modül üretimi) aynı listeyi buradan okur.

   PROFİL
     dh-profile-v1.amac     ilk seçilen amaç (eski kodlarla uyum: tek değer)
     dh-profile-v1.amaclar  seçilen bütün amaçlar ["seyahat","saglik",...]

   seviye-testi.html eskisi gibi yalnız `amac` yazar; o zaman o değer
   listenin başına alınır, diğer seçimler kaybolmaz.

   API
     DHAmac.LISTE           [{id, ikon, ad, alt, alan, konu}]
     DHAmac.bul(id)         tek amaç | null
     DHAmac.secili()        ["seyahat", ...]  (boşsa [])
     DHAmac.kaydet(ids)     profile yazar
*/
(function (global) {
  "use strict";
  if (global.DHAmac) return;

  var K = "dh-profile-v1";

  /* alan: modül üretiminde yapay zekâya verilen bağlam (Türkçe).
     konu: cümlelerin hangi sahnelerden seçileceği (yapay zekâya örnek). */
  var LISTE = [
    { id: "seyahat",  ikon: "✈️", ad: "Seyahat",            alt: "Havalimanı, otel, restoran, yol sorma",
      alan: "Seyahat", konu: "havalimanı, otel, restoran, yol sorma, alışveriş, müze gezisi, taksi" },
    { id: "aile",     ikon: "👨‍👩‍👧", ad: "Aile ve torunlar",  alt: "Torunla, yurt dışındaki aileyle konuşmak",
      alan: "Aile ve torunlar", konu: "torunla oyun ve sohbet, görüntülü arama, aile ziyareti, doğum günü, yurt dışında yaşayan çocuklar" },
    { id: "saglik",   ikon: "🏥", ad: "Sağlık",              alt: "Doktor, eczane, randevu",
      alan: "Sağlık", konu: "doktor muayenesi, eczane, ilaç, randevu almak, ağrıyı anlatmak, hastane" },
    { id: "gunluk",   ikon: "☕", ad: "Günlük hayat",        alt: "Sohbet, alışveriş, komşular",
      alan: "Günlük hayat", konu: "alışveriş, komşularla sohbet, hava durumu, ev işleri, market, telefonla konuşma" },
    { id: "zihin",    ikon: "🧠", ad: "Zihnimi canlı tutmak", alt: "Hobiler, kitap, bahçe, haberler",
      alan: "Hobiler ve kültür", konu: "kitap okumak, bahçe, yemek yapmak, müzik, yürüyüş, haberler, anılar" },
    { id: "is",       ikon: "💼", ad: "İş",                  alt: "Toplantı, e-posta, iş görüşmesi",
      alan: "İş hayatı", konu: "toplantı, e-posta, iş görüşmesi, telefon görüşmesi" },
    { id: "akademik", ikon: "🎓", ad: "Sınav / akademik",     alt: "IELTS, TOEFL, YDS",
      alan: "Akademik", konu: "okul, sınav, ders, araştırma" }
  ];

  function profil() {
    try { return JSON.parse(localStorage.getItem(K) || "{}") || {}; } catch (e) { return {}; }
  }
  function bul(id) {
    for (var i = 0; i < LISTE.length; i++) if (LISTE[i].id === id) return LISTE[i];
    return null;
  }
  function secili() {
    var p = profil(), out = [];
    var arr = Array.isArray(p.amaclar) ? p.amaclar : [];
    if (p.amac && bul(p.amac)) out.push(p.amac);
    arr.forEach(function (x) { if (bul(x) && out.indexOf(x) < 0) out.push(x); });
    return out;
  }
  function kaydet(ids) {
    ids = (ids || []).filter(function (x, i, a) { return bul(x) && a.indexOf(x) === i; });
    if (!ids.length) return false;
    var p = profil();
    p.amac = ids[0];
    p.amaclar = ids;
    p.amacTarih = Date.now();
    try { localStorage.setItem(K, JSON.stringify(p)); } catch (e) { return false; }
    try { if (global.DHTeacherPolicy) global.DHTeacherPolicy.set("amac", ids[0]); } catch (e) {}
    return true;
  }

  global.DHAmac = { LISTE: LISTE, bul: bul, secili: secili, kaydet: kaydet };
})(window);
