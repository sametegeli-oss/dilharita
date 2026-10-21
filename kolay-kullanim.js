/* kolay-kullanim.js — 50-80 yaş için "Kolay Kullanım" katmanı
   ------------------------------------------------------------------
   Her sayfanın <head> bölümüne tek satırla eklenir:
     <link rel="stylesheet" href="./kolay-kullanim.css?v=1">
     <script src="./kolay-kullanim.js?v=1"></script>

   Yaptıkları:
   1) YAZI BOYUTU — Sayfalar piksel (px) kullandığı için yazılar tek tek
      ölçülüp büyütülür. Üç seçenek: Normal · Büyük (varsayılan) · Çok büyük.
      Sonradan eklenen içerik (sohbet mesajları, kartlar) de büyütülür.
   2) ALT GEZİNME ÇUBUĞU — Her sayfada aynı yerde, yazılı dört büyük düğme:
      ◀ Geri · 🏠 Ana Sayfa · ☰ Menü · Aa Yazı.
      Tam ekran sayfalarda (sohbet, video) sağ üstte tek büyük "Menü" düğmesi.
   3) SADE MENÜ — Kısa, açıklamalı, büyük satırlardan oluşan tek liste.
   4) ÇAKIŞMA ÖNLEME — Ekranın altına yapışık küçük düğmeler (öğretmen
      balonu, senkron rozeti vb.) alt çubuğun üstüne kaydırılır.
   5) SİMGE DÜĞMELERİNE YAZI — Yalnız simgeden oluşan düğmelerin altına
      ne işe yaradığı yazılır.

   Ayarlar yalnız bu cihazda tutulur (localStorage "dh-kolay-v1").
   Hiçbir mevcut motoru değiştirmez; window.DHKolay dışında global ad yok. */
(function(g){
  "use strict";
  if (g.DHKolay) return;

  var doc = document, root = doc.documentElement;
  var KEY = "dh-kolay-v1";
  var BOYUTLAR = {
    normal:   { f: 1.00, min: 16, ad: "Normal",    ornek: 18 },
    buyuk:    { f: 1.15, min: 18, ad: "Büyük",     ornek: 22 },
    cokbuyuk: { f: 1.32, min: 20, ad: "Çok büyük", ornek: 26 }
  };

  function oku(){
    try{
      var v = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
      return { acik: v.acik !== false, boyut: BOYUTLAR[v.boyut] ? v.boyut : "buyuk" };
    }catch(e){ return { acik: true, boyut: "buyuk" }; }
  }
  function yaz(a){ try{ localStorage.setItem(KEY, JSON.stringify(a)); }catch(e){} }
  var ayar = oku();

  /* Sınıfı hemen koy: sayfa ilk boyandığında sade görünüm hazır olsun. */
  if (ayar.acik) root.classList.add("kk-acik");

  var sayfa = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  var EV = /^(index\.html)?$/.test(sayfa);
  /* Alt kenarı kendi mikrofon/gönder çubuğuyla kullanan tam ekran sayfalar */
  var TAM_EKRAN = /^(chatteacher1|chatteacher2|chatdoctor|chathotel|chatairport|chatrestaurant|teacher-chat|teacher|teacher1|teacher3|ogren|videopractice|sesdalga|immersive|youtube-egitim|youtube-pratik)\.html?$/.test(sayfa);

  /* Giriş, ilk kurulum ve bakım ekranları: gezinme düğmesi gösterilmez
     (kullanıcı adımları bitirmeden yolunu kaybetmesin). Yazı yine büyür. */
  var NAVSIZ = /^(login|basla|pwa-reset|pwa-hard-reset)\.html?$/.test(sayfa);

  /* ================================================================
     1) YAZI BOYUTU
     ================================================================ */
  var ATLA = { SCRIPT:1, STYLE:1, NOSCRIPT:1, TEMPLATE:1, CANVAS:1, VIDEO:1, AUDIO:1,
               IFRAME:1, IMG:1, BR:1, HR:1, svg:1, SVG:1, PICTURE:1, SOURCE:1, LINK:1, META:1 };
  var FORM = { INPUT:1, TEXTAREA:1, SELECT:1, BUTTON:1, OPTION:1 };

  function yaziTasir(el){
    if (FORM[el.tagName]) return true;
    for (var n = el.firstChild; n; n = n.nextSibling){
      if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true;
    }
    return false;
  }
  function aday(el){
    if (!el || el.nodeType !== 1 || ATLA[el.tagName]) return false;
    if (el.closest && el.closest("svg,.kk-ui,[data-kk-atla],.dh-ikon-btn")) return false;
    return el === doc.body || yaziTasir(el);
  }
  /* Koyu zemin üzerindeki soluk/gri yazıyı tespit et (kontrast düzeltmesi).
     Yalnız renksiz (gri) tonlara dokunulur; renkli vurgular korunur. */
  function rgb(t){
    var m = /rgba?\(([^)]+)\)/.exec(t || ""); if (!m) return null;
    var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function parlak(c){ return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255; }
  function zeminKoyuMu(el){
    for (var n = el, i = 0; n && n.nodeType === 1 && i < 12; n = n.parentElement, i++){
      var z = rgb(getComputedStyle(n).backgroundColor);
      if (z && z.a > 0.5) return parlak(z) < 0.35;
      /* Degrade/görsel zeminler bu uygulamada koyu tonlu */
      if (getComputedStyle(n).backgroundImage !== "none" && n !== doc.body) return true;
    }
    return true; /* gövde zemini Kolay görünümde koyu */
  }
  function soluk(el, cs){
    if (FORM[el.tagName] && el.tagName !== "BUTTON") return false;
    var c = rgb(cs.color); if (!c) return false;
    var doy = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
    var gri = doy < 60;
    var dusuk = parlak(c) < 0.72 || c.a < 0.8;
    if (!gri || !dusuk) return false;
    if (parlak(c) < 0.12 && c.a >= 0.8) return false;   /* koyu yazı: açık zemindedir */
    return zeminKoyuMu(el);
  }

  function hedef(base){
    var b = BOYUTLAR[ayar.boyut];
    if (base >= 30) return Math.round(base * Math.min(b.f, 1.08));
    return Math.round(Math.max(base * b.f, b.min) * 10) / 10;
  }
  function uygula(el, base){
    var t = hedef(base);
    el.style.setProperty("font-size", t + "px", "important");
    if (el.hasAttribute("data-kk-renk")) el.style.setProperty("color", "#e3e8f6", "important");
    var lh = el.getAttribute("data-kk-lh");
    if (lh) el.style.setProperty("line-height", lh, "important");
    /* Yazılı düğme: yüksekliği sabitse metin taşmasın */
    if ((el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute("role") === "button") &&
        (el.textContent || "").trim().length > 3){
      el.classList.add("kk-yazili");
    }
  }

  /* İki aşamalı: önce TÜM özgün boyutlar okunur, sonra yazılır. Böylece
     üst öğenin büyümesi alt öğenin "özgün" boyutunu bozmaz. */
  function olcekle(liste){
    var okunan = [];
    for (var i = 0; i < liste.length; i++){
      var el = liste[i];
      if (el.hasAttribute("data-kk-b")) { okunan.push([el, +el.getAttribute("data-kk-b")]); continue; }
      var cs = getComputedStyle(el);
      var c = parseFloat(cs.fontSize);
      if (!c) continue;
      /* Sonradan eklenen öğe: büyütülmüş atadan miras aldıysa özgün değeri atadan al */
      var ata = el.parentElement && el.parentElement.closest("[data-kk-b]");
      if (ata && !el.hasAttribute("data-kk-yeni-degil")){
        var ataSon = parseFloat(ata.style.fontSize);
        if (ataSon && Math.abs(c - ataSon) < 0.3) c = +ata.getAttribute("data-kk-b");
      }
      var lhPx = parseFloat(cs.lineHeight);
      if (lhPx && /px$/.test(cs.lineHeight)){
        el.setAttribute("data-kk-lh", String(Math.max(1.25, Math.round(lhPx / c * 100) / 100)));
      }
      okunan.push([el, c, soluk(el, cs)]);
    }
    for (var j = 0; j < okunan.length; j++){
      okunan[j][0].setAttribute("data-kk-b", okunan[j][1]);
      if (okunan[j][2]) okunan[j][0].setAttribute("data-kk-renk", "");
      uygula(okunan[j][0], okunan[j][1]);
    }
  }
  function tumunuOlcekle(){
    if (!ayar.acik || !doc.body) return;
    var hepsi = doc.body.getElementsByTagName("*"), liste = [doc.body];
    for (var i = 0; i < hepsi.length; i++) if (aday(hepsi[i])) liste.push(hepsi[i]);
    /* İlk turda sayfa kendi px değerleriyle duruyor: miras kontrolüne gerek yok */
    for (var k = 0; k < liste.length; k++) liste[k].setAttribute("data-kk-yeni-degil", "");
    olcekle(liste);
    for (var m = 0; m < liste.length; m++) liste[m].removeAttribute("data-kk-yeni-degil");
  }
  function olcegiYenile(){
    var l = doc.querySelectorAll("[data-kk-b]");
    for (var i = 0; i < l.length; i++) uygula(l[i], +l[i].getAttribute("data-kk-b"));
  }
  function olcegiKaldir(){
    var l = doc.querySelectorAll("[data-kk-b]");
    for (var i = 0; i < l.length; i++){
      l[i].style.removeProperty("font-size");
      l[i].style.removeProperty("line-height");
      if (l[i].hasAttribute("data-kk-renk")){ l[i].style.removeProperty("color"); l[i].removeAttribute("data-kk-renk"); }
      l[i].classList.remove("kk-yazili");
      l[i].removeAttribute("data-kk-b");
      l[i].removeAttribute("data-kk-lh");
    }
  }

  /* Yeni eklenen içerik — kare başına bir kez topla */
  var bekleyen = [], kareVar = false;
  function kuyruk(n){
    if (n.nodeType === 3) n = n.parentElement;
    if (!n || n.nodeType !== 1) return;
    bekleyen.push(n);
    if (!kareVar){ kareVar = true; requestAnimationFrame(isle); }
  }
  function isle(){
    kareVar = false;
    if (!ayar.acik){ bekleyen = []; return; }
    var set = [], gorulen = new Set();
    bekleyen.forEach(function(n){
      if (!n.isConnected) return;
      if (aday(n) && !gorulen.has(n)){ gorulen.add(n); set.push(n); }
      var alt = n.getElementsByTagName ? n.getElementsByTagName("*") : [];
      for (var i = 0; i < alt.length; i++){
        if (!gorulen.has(alt[i]) && aday(alt[i])){ gorulen.add(alt[i]); set.push(alt[i]); }
      }
    });
    bekleyen = [];
    if (set.length) olcekle(set);
    ikonYazilari();
    kaydir();
  }

  /* ================================================================
     5) SİMGE DÜĞMELERİNE YAZI
     ================================================================ */
  var KISA = [
    [/ses/i, "🔊", "Ses"], [/rapor/i, "📊", "Rapor"], [/kitapl|menü|menu/i, "🧭", "Bölümler"],
    [/ayar/i, "⚙️", "Ayarlar"], [/profil/i, "👤", "Profil"], [/geri|dön/i, "◀", "Geri"],
    [/kapat/i, "✕", "Kapat"], [/yardım|yardim/i, "❓", "Yardım"]
  ];
  function ikonYazilari(){
    if (!ayar.acik) return;
    var l = doc.querySelectorAll(".dh-ikon-btn");
    for (var i = 0; i < l.length; i++){
      var b = l[i];
      if (b.querySelector(".kk-ikon-yazi")) continue;
      var kendiYazi = (b.textContent || "").trim();
      if (kendiYazi.length > 2) { b.classList.add("kk-ikon-yazili"); continue; }
      var ad = b.getAttribute("aria-label") || b.title || "";
      if (!ad) continue;
      var sec = null;
      for (var k = 0; k < KISA.length; k++) if (KISA[k][0].test(ad)) { sec = KISA[k]; break; }
      var s = doc.createElement("span");
      s.className = "kk-ikon-yazi"; s.setAttribute("data-kk-atla", ""); s.setAttribute("aria-hidden", "true");
      s.innerHTML = '<i>' + (sec ? sec[1] : (kendiYazi || "•")) + '</i>' + (sec ? sec[2] : ad.split(/\s+/).slice(0, 2).join(" "));
      b.appendChild(s);
    }
  }

  /* ================================================================
     4) ALT KENARA YAPIŞIK ÖĞELERİ ÇUBUĞUN ÜSTÜNE KAYDIR
     ================================================================ */
  function cubukYuksekligi(){
    var c = doc.querySelector(".kk-alt");
    if (!c || !ayar.acik || TAM_EKRAN || NAVSIZ) return 0;
    var r = c.getBoundingClientRect();
    return Math.ceil(innerHeight - r.top) + 8;
  }
  function kaydirTek(el, h){
    if (!el || el.closest(".kk-ui")) return;
    var cs = getComputedStyle(el);
    if (cs.position !== "fixed") return;
    var alt = parseFloat(cs.bottom), ust = parseFloat(cs.top);
    if (isNaN(alt) || alt >= h - 8) return;
    var r = el.getBoundingClientRect();
    if (r.height > innerHeight * 0.6) return;        /* tam ekran perde */
    if (ust === 0 && alt === 0) return;              /* gizli tam ekran perde */
    if (r.width > innerWidth * 0.95 && r.height > 120) return;
    el.style.setProperty("bottom", (alt + h) + "px", "important");
    el.setAttribute("data-kk-kaydi", "");
  }
  var tamTarama = 0;
  function kaydir(tam){
    var h = cubukYuksekligi();
    if (!h) return;
    var l = tam ? doc.body.getElementsByTagName("*") : doc.body.children;
    for (var i = 0; i < l.length; i++) kaydirTek(l[i], h);
    var ozel = doc.querySelectorAll(".dh-avatar,.dh-tb-fab,.dh-tb-panel,[data-kk-kaydi],[style*='position:fixed'],[style*='position: fixed']");
    for (var j = 0; j < ozel.length; j++) kaydirTek(ozel[j], h);
  }

  /* ================================================================
     2) ALT ÇUBUK ve 3) SADE MENÜ
     ================================================================ */
  var MENU = [
    ["Günlük çalışma", [
      ["📘", "Bugünkü Dersim", "Öğretmeninizin hazırladığı ders", "ders.html"],
      ["🔁", "Tekrar Et", "Öğrendiklerinizi pekiştirin", "tekrar.html"],
      ["🃏", "Kelime Öğren", "En sık kullanılan kelimeler", "kelime-ogren.html"],
      ["✍️", "Cümle Çalış", "Cümle kurma alıştırmaları", "practice.html"],
      ["🎙️", "Konuşma Pratiği", "Sesli sohbetle konuşun", "chat.html"],
      ["🧑‍🏫", "Öğretmene Sor", "Türkçe anlatımlı öğretmen", "teacher.html"]
    ]],
    ["Takip", [
      ["📈", "İlerlemem", "Ne kadar çalıştığınızı görün", "rapor.html"],
      ["📕", "Hata Defterim", "Yanlış yaptığınız cümleler", "hata-defteri.html"]
    ]],
    ["Diğer", [
      ["🧭", "Tüm Bölümler", "Uygulamadaki bütün araçlar", "menu.html"],
      ["👤", "Profil ve Ayarlar", "Bilgileriniz ve tercihleriniz", "profil.html"],
      ["❓", "Nasıl Kullanılır?", "Adım adım kullanım kılavuzu", "kilavuz.html"]
    ]]
  ];

  function el(tag, cls, html){
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  var menuPerde, yaziPerde, sonOdak = null;

  function pencereAc(p, tetik){
    sonOdak = tetik || doc.activeElement;
    p.hidden = false;
    doc.body.style.overflow = "hidden";
    if (tetik) tetik.setAttribute("aria-expanded", "true");
    setTimeout(function(){ var k = p.querySelector(".kk-kapat"); if (k) k.focus(); }, 30);
  }
  function pencereKapat(p){
    if (!p || p.hidden) return;
    p.hidden = true;
    doc.body.style.overflow = "";
    var t = doc.querySelectorAll(".kk-ui [aria-expanded]");
    for (var i = 0; i < t.length; i++) t[i].setAttribute("aria-expanded", "false");
    if (sonOdak && sonOdak.focus) try{ sonOdak.focus(); }catch(e){}
  }

  function menuKur(){
    var html = '<div class="kk-pencere" role="dialog" aria-modal="true" aria-labelledby="kkMenuBaslik">'
      + '<header><h2 id="kkMenuBaslik">Menü</h2><button type="button" class="kk-kapat" data-kk-kapat>✕ Kapat</button></header>'
      + '<div class="kk-kaydir">';
    MENU.forEach(function(g){
      html += '<h3 class="kk-grup">' + g[0] + '</h3><ul class="kk-liste">';
      g[1].forEach(function(x){
        var aktif = x[3] === sayfa ? ' aria-current="page"' : "";
        html += '<li><a class="kk-oge" href="./' + x[3] + '"' + aktif + '>'
          + '<span class="kk-i" aria-hidden="true">' + x[0] + '</span>'
          + '<span><b>' + x[1] + '</b><small>' + x[2] + '</small></span>'
          + '<span class="kk-ok" aria-hidden="true">›</span></a></li>';
      });
      html += '</ul>';
    });
    html += '<h3 class="kk-grup">Görünüm</h3><ul class="kk-liste">'
      + '<li><button type="button" class="kk-oge kk-oge-btn" data-kk-yazi-ac>'
      + '<span class="kk-i" aria-hidden="true">🔠</span>'
      + '<span><b>Yazı Boyutu</b><small>Yazıları büyütün veya küçültün</small></span>'
      + '<span class="kk-ok" aria-hidden="true">›</span></button></li></ul>';
    html += '</div></div>';
    menuPerde = el("div", "kk-ui kk-perde", html);
    menuPerde.hidden = true;
    doc.body.appendChild(menuPerde);
  }

  function yaziKur(){
    var html = '<div class="kk-pencere" role="dialog" aria-modal="true" aria-labelledby="kkYaziBaslik">'
      + '<header><h2 id="kkYaziBaslik">Yazı ve Görünüm</h2><button type="button" class="kk-kapat" data-kk-kapat>✕ Kapat</button></header>'
      + '<div class="kk-kaydir">'
      + '<p class="kk-aciklama">Size en rahat gelen yazı boyutunu seçin. Seçiminiz hemen uygulanır ve bu cihazda hatırlanır.</p>'
      + '<div class="kk-boyutlar" role="radiogroup" aria-label="Yazı boyutu">';
    Object.keys(BOYUTLAR).forEach(function(k){
      var b = BOYUTLAR[k];
      html += '<button type="button" class="kk-boyut" role="radio" data-kk-boyut="' + k + '" aria-checked="false">'
        + '<span class="kk-ornek" style="font-size:' + b.ornek + 'px">' + b.ad + ' yazı</span>'
        + '<span class="kk-isaret" aria-hidden="true">✓</span></button>';
    });
    html += '</div>'
      + '<button type="button" class="kk-anahtar" role="switch" data-kk-mod aria-checked="true">'
      + '<span><b>Kolay görünüm</b><small>Büyük düğmeler, net renkler, alt menü çubuğu. Kapatırsanız uygulamanın eski görünümüne dönülür.</small></span>'
      + '<span class="kk-durum"></span></button>'
      + '</div></div>';
    yaziPerde = el("div", "kk-ui kk-perde", html);
    yaziPerde.hidden = true;
    doc.body.appendChild(yaziPerde);
    yaziBoya();
  }
  function yaziBoya(){
    if (!yaziPerde) return;
    var l = yaziPerde.querySelectorAll("[data-kk-boyut]");
    for (var i = 0; i < l.length; i++){
      l[i].setAttribute("aria-checked", String(l[i].getAttribute("data-kk-boyut") === ayar.boyut && ayar.acik));
    }
    var m = yaziPerde.querySelector("[data-kk-mod]");
    m.setAttribute("aria-checked", String(ayar.acik));
    m.querySelector(".kk-durum").textContent = ayar.acik ? "Açık" : "Kapalı";
  }

  function geri(){
    var ayniSite = false;
    try{ ayniSite = !!doc.referrer && new URL(doc.referrer).origin === location.origin; }catch(e){}
    if (ayniSite && history.length > 1) history.back();
    else location.href = "./index.html";
  }

  function cubukKur(){
    if (NAVSIZ) return;
    if (TAM_EKRAN){
      var b = el("button", "kk-ui kk-ust-menu", '<span class="kk-i" aria-hidden="true">☰</span><span>Menü</span>');
      b.type = "button"; b.setAttribute("data-kk-menu", ""); b.setAttribute("aria-expanded", "false");
      b.setAttribute("aria-haspopup", "dialog");
      doc.body.appendChild(b);
      return;
    }
    var nav = el("nav", "kk-ui kk-alt" + (EV ? " kk-ev" : ""));
    nav.setAttribute("aria-label", "Ana gezinme");
    nav.innerHTML =
        (EV ? "" : '<button type="button" data-kk-geri><span class="kk-i" aria-hidden="true">◀</span>Geri</button>')
      + '<button type="button" class="kk-ana-btn" data-kk-ev' + (EV ? ' aria-current="page"' : "") + '><span class="kk-i" aria-hidden="true">🏠</span>Ana Sayfa</button>'
      + '<button type="button" data-kk-menu aria-haspopup="dialog" aria-expanded="false"><span class="kk-i" aria-hidden="true">☰</span>Menü</button>'
      + '<button type="button" data-kk-yazi-ac aria-haspopup="dialog" aria-expanded="false"><span class="kk-i" aria-hidden="true">Aa</span>Yazı</button>';
    doc.body.appendChild(nav);
    doc.body.classList.add("kk-alt-var");
  }

  /* Klasik görünümdeyken eski menüye "Kolay görünümü aç" satırı ekle */
  function klasikMenuyeEkle(){
    if (ayar.acik) return;
    var l = doc.querySelector(".dh-mobile-menu__tools");
    if (!l || l.querySelector("[data-kk-geri-ac]")) return;
    var a = el("a", "", '<span aria-hidden="true">🔠</span>Kolay görünümü aç<i aria-hidden="true">›</i>');
    a.href = "#"; a.setAttribute("data-kk-geri-ac", "");
    l.insertBefore(a, l.firstChild);
  }

  function modDegistir(acik){
    ayar.acik = acik; yaz(ayar);
    root.classList.toggle("kk-acik", acik);
    if (acik){ tumunuOlcekle(); ikonYazilari(); kaydir(true); }
    else {
      olcegiKaldir();
      var y = doc.querySelectorAll(".kk-ikon-yazi"); for (var i = 0; i < y.length; i++) y[i].remove();
      var s = doc.querySelectorAll("[data-kk-kaydi]");
      for (var j = 0; j < s.length; j++){ s[j].style.removeProperty("bottom"); s[j].removeAttribute("data-kk-kaydi"); }
      pencereKapat(yaziPerde);
      klasikMenuyeEkle();
    }
    yaziBoya();
  }

  function olaylar(){
    doc.addEventListener("click", function(e){
      var t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      var x;
      if ((x = t.closest("[data-kk-menu]"))){ e.preventDefault(); pencereKapat(yaziPerde); pencereAc(menuPerde, x); return; }
      if ((x = t.closest("[data-kk-yazi-ac]"))){
        e.preventDefault(); pencereKapat(menuPerde);
        pencereAc(yaziPerde, doc.querySelector(".kk-alt [data-kk-yazi-ac]") || x); return;
      }
      if (t.closest("[data-kk-geri]")){ e.preventDefault(); geri(); return; }
      if (t.closest("[data-kk-ev]")){ e.preventDefault(); if (!EV) location.href = "./index.html"; return; }
      if (t.closest("[data-kk-kapat]")){ e.preventDefault(); pencereKapat(menuPerde); pencereKapat(yaziPerde); return; }
      if ((x = t.closest("[data-kk-boyut]"))){
        e.preventDefault();
        ayar.boyut = x.getAttribute("data-kk-boyut");
        if (!ayar.acik) modDegistir(true); else { yaz(ayar); olcegiYenile(); yaziBoya(); }
        return;
      }
      if (t.closest("[data-kk-mod]")){ e.preventDefault(); modDegistir(!ayar.acik); return; }
      if (t.closest("[data-kk-geri-ac]")){ e.preventDefault(); ayar.acik = true; yaz(ayar); location.reload(); return; }
      /* Perdenin boş yerine dokununca kapat */
      if (t.classList && t.classList.contains("kk-perde")){ pencereKapat(t); }
    }, true);
    doc.addEventListener("keydown", function(e){
      if (e.key !== "Escape") return;
      if (menuPerde && !menuPerde.hidden) pencereKapat(menuPerde);
      if (yaziPerde && !yaziPerde.hidden) pencereKapat(yaziPerde);
    });
  }

  function basla(){
    if (!doc.body || doc.querySelector(".kk-alt,.kk-ust-menu")) return;
    cubukKur(); menuKur(); yaziKur(); olaylar();
    if (ayar.acik){ tumunuOlcekle(); ikonYazilari(); }
    klasikMenuyeEkle();

    new MutationObserver(function(ms){
      for (var i = 0; i < ms.length; i++){
        var a = ms[i].addedNodes;
        for (var j = 0; j < a.length; j++) kuyruk(a[j]);
      }
      if (!ayar.acik) klasikMenuyeEkle();
    }).observe(doc.body, { childList: true, subtree: true });

    /* Geç yüklenen düğmeler (öğretmen balonu, senkron rozeti) için tarama */
    kaydir(true);
    [600, 1800, 4000].forEach(function(ms){ setTimeout(function(){ kaydir(true); }, ms); });
    setInterval(function(){ kaydir(++tamTarama % 5 === 0); }, 2500);
    addEventListener("resize", function(){ kaydir(true); }, { passive: true });
  }

  g.DHKolay = {
    ayar: function(){ return { acik: ayar.acik, boyut: ayar.boyut }; },
    boyut: function(k){ if (BOYUTLAR[k]){ ayar.boyut = k; yaz(ayar); olcegiYenile(); yaziBoya(); } },
    ac: function(){ modDegistir(true); },
    kapat: function(){ modDegistir(false); },
    menu: function(){ pencereAc(menuPerde); },
    yazi: function(){ pencereAc(yaziPerde); }
  };

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", basla, { once: true });
  else basla();
})(window);
