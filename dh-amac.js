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
     DHAmac.tumu()          hazır amaçlar + kullanıcının yazdığı konular
     DHAmac.ozelEkle(metin) kullanıcının yazdığı konuyu ekler -> "ozel:<metin>"
     DHAmac.ozelSil(id)
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
  /* KULLANICININ YAZDIĞI KONULAR: profilde ozelKonular ["bahçecilik", ...]
     Kimlikleri "ozel:<metin>". Hazır amaçlarla aynı şekilde seçilir,
     sırayla kullanılır ve arka planda hazırlanır. */
  var OZEL_ON = "ozel:";
  function temizKonu(t) {
    return String(t || "").replace(/[<>{}\[\]`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  }
  function ozeller() {
    var p = profil();
    return (Array.isArray(p.ozelKonular) ? p.ozelKonular : []).map(temizKonu).filter(Boolean);
  }
  function ozelNesne(metin) {
    return { id: OZEL_ON + metin, ikon: "✏️", ad: metin, alt: "Kendi yazdığınız konu",
             alan: metin, konu: metin, ozel: true };
  }
  function bul(id) {
    for (var i = 0; i < LISTE.length; i++) if (LISTE[i].id === id) return LISTE[i];
    if (String(id || "").indexOf(OZEL_ON) === 0) {
      var m = temizKonu(String(id).slice(OZEL_ON.length));
      if (m && ozeller().some(function (x) { return x.toLocaleLowerCase("tr") === m.toLocaleLowerCase("tr"); })) return ozelNesne(m);
    }
    return null;
  }
  function tumu() { return LISTE.concat(ozeller().map(ozelNesne)); }
  /* Yeni konu ekler (en çok 12; en eskisi düşer). Kimliğini döndürür. */
  function ozelEkle(metin) {
    var m = temizKonu(metin);
    if (!m || !/[\p{L}]{2,}/u.test(m)) return null;
    var p = profil(), l = ozeller();
    var var_ = l.filter(function (x) { return x.toLocaleLowerCase("tr") === m.toLocaleLowerCase("tr"); })[0];
    if (var_) return OZEL_ON + var_;
    l.push(m);
    p.ozelKonular = l.slice(-12);
    try { localStorage.setItem(K, JSON.stringify(p)); } catch (e) { return null; }
    return OZEL_ON + m;
  }
  function ozelSil(id) {
    var m = String(id || "").slice(OZEL_ON.length).toLocaleLowerCase("tr");
    var p = profil();
    p.ozelKonular = ozeller().filter(function (x) { return x.toLocaleLowerCase("tr") !== m; });
    if (Array.isArray(p.amaclar)) p.amaclar = p.amaclar.filter(function (x) { return x !== id; });
    if (p.amac === id) p.amac = (p.amaclar && p.amaclar[0]) || "";
    try { localStorage.setItem(K, JSON.stringify(p)); } catch (e) {}
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

  global.DHAmac = { LISTE: LISTE, bul: bul, secili: secili, kaydet: kaydet,
                    tumu: tumu, ozelEkle: ozelEkle, ozelSil: ozelSil };
})(window);
