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
  /* ================================================================
     2) KONTRAST — yazı ile zemini arasındaki farkı ölç; yetersizse düzelt.
        Hedef: normal yazıda en az 4.5:1, gri ikincil yazıda 7:1, iri
        yazıda 3:1. Renkli düğmede (ör. mor "Başla") yazı beyaz kalır,
        düğmenin zemini koyulaştırılır; böylece renk anlamı korunur.
     ================================================================ */
  function rgb(t){
    var m = /rgba?\(([^)]+)\)/.exec(t || ""); if (!m) return null;
    var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function parlak(c){ return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255; }
  function lum(c){
    function f(v){ v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function oran(a, b){ var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function karis(a, b, t){ return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 }; }
  function css(c){ return "rgb(" + Math.round(c.r) + "," + Math.round(c.g) + "," + Math.round(c.b) + ")"; }
  var BEYAZ = { r: 255, g: 255, b: 255, a: 1 }, SIYAH = { r: 10, g: 14, b: 26, a: 1 };
  var GOVDE = { r: 12, g: 18, b: 34, a: 1 };

  /* Etkin zemin rengi ve o zemini veren öğe (sahip) */
  function zemin(el){
    var katman = [], sahip = null;
    for (var n = el; n && n.nodeType === 1; n = n.parentElement){
      var cs = getComputedStyle(n);
      /* Degrade yazıda öğenin kendi zemini yazının içidir, arkası değil */
      if (n === el && /text/.test(cs.backgroundClip + " " + cs.webkitBackgroundClip)) continue;
      if (n !== doc.body && n !== root && cs.backgroundImage !== "none"){
        if (/url\(/.test(cs.backgroundImage)) return null;          /* resim zemin: ölçülemez */
        var renkler = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(rgb).filter(Boolean);
        if (renkler.length){
          var o = { r: 0, g: 0, b: 0, a: 0 };
          renkler.forEach(function(c){ o.r += c.r; o.g += c.g; o.b += c.b; o.a += c.a; });
          o.r /= renkler.length; o.g /= renkler.length; o.b /= renkler.length; o.a = Math.min(1, o.a / renkler.length);
          katman.push(o); if (!sahip) sahip = n; if (o.a > 0.9) break;
        }
      }
      var c = rgb(cs.backgroundColor);
      if (c && c.a > 0.04){ katman.push(c); if (!sahip) sahip = n; if (c.a > 0.95) break; }
    }
    var z = GOVDE;
    for (var i = katman.length - 1; i >= 0; i--) z = karis(z, katman[i], katman[i].a);
    return { renk: z, sahip: sahip };
  }

  function kontrastKarar(el, cs, boy){
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.tagName === "OPTION") return null;
    var fg = rgb(cs.color); if (!fg) return null;
    var dolgu = rgb(cs.webkitTextFillColor);
    var z = zemin(el); if (!z) return null;
    var bg = z.renk;
    /* Degrade yazı (background-clip:text): yazıyı düz ve okunur yap */
    if (dolgu && dolgu.a === 0){
      return { dolgu: css(oran(BEYAZ, bg) >= oran(SIYAH, bg) ? BEYAZ : SIYAH) };
    }
    var on = karis(bg, fg, fg.a);
    var doy = Math.max(fg.r, fg.g, fg.b) - Math.min(fg.r, fg.g, fg.b);
    var bold = +cs.fontWeight >= 700;
    var gerek = (boy >= 24 || (boy >= 19 && bold)) ? 3.1 : 4.6;   /* küçük pay: yuvarlama sınırında kalmasın */
    if (doy < 50 && lum(bg) < 0.06) gerek = Math.max(gerek, 7);   /* gri ikincil yazı */
    if (oran(on, bg) >= gerek) return null;

    var acikYazi = lum(on) >= lum(bg);
    var hedefRenk = acikYazi ? BEYAZ : SIYAH;
    /* Açık zemin (beyaz kart) üzerinde açık yazı: yazıyı koyu yap */
    if (acikYazi && lum(bg) > 0.4) return { renk: css(SIYAH) };
    /* 1) Yazıyı aynı yönde (açığa / koyuya) kaydırarak çöz */
    if (oran(hedefRenk, bg) >= gerek){
      for (var t = 0.15; t <= 1.001; t += 0.15){
        var aday2 = karis(on, hedefRenk, Math.min(t, 1));
        if (oran(aday2, bg) >= gerek) return { renk: css(aday2) };
      }
      return { renk: css(hedefRenk) };
    }
    /* 2) Açık yazı + orta tonlu küçük zemin (renkli düğme): zemini koyulaştır */
    var s = z.sahip;
    if (acikYazi && s && s !== doc.body && s !== root){
      var r = s.getBoundingClientRect();
      var kontrol = s.matches("button,a,[role=button],[role=tab],summary,label,.btn,[class*='btn'],[class*='badge'],[class*='chip'],[class*='pill'],[class*='tag']");
      if ((kontrol || r.width * r.height < innerWidth * innerHeight * 0.06) && r.width * r.height < innerWidth * innerHeight * 0.3){
        var yazi = lum(on) > 0.8 ? on : BEYAZ;
        for (var k = 0.12; k <= 0.9; k += 0.08){
          var koyu = karis(bg, SIYAH, k);
          if (oran(yazi, koyu) >= gerek) return { renk: yazi === on ? null : css(yazi), sahip: s, zemin: css(koyu) };
        }
      }
    }
    /* 3) Son çare: zıt uç renk */
    return { renk: css(oran(BEYAZ, bg) >= oran(SIYAH, bg) ? BEYAZ : SIYAH) };
  }
  function kontrastUygula(el, k){
    if (!k) return;
    if (k.dolgu){ el.style.setProperty("-webkit-text-fill-color", k.dolgu, "important"); el.setAttribute("data-kk-kd", k.dolgu); }
    if (k.renk){ el.style.setProperty("color", k.renk, "important"); el.setAttribute("data-kk-kc", k.renk); }
    if (k.sahip && !k.sahip.hasAttribute("data-kk-kz")){
      k.sahip.style.setProperty("background-color", k.zemin, "important");
      k.sahip.style.setProperty("background-image", "none", "important");
      k.sahip.setAttribute("data-kk-kz", k.zemin);
    }
  }
  function kontrastKaldir(el){
    if (el.hasAttribute("data-kk-kc")){ el.style.removeProperty("color"); el.removeAttribute("data-kk-kc"); }
    if (el.hasAttribute("data-kk-kd")){ el.style.removeProperty("-webkit-text-fill-color"); el.removeAttribute("data-kk-kd"); }
    if (el.hasAttribute("data-kk-kz")){
      el.style.removeProperty("background-color"); el.style.removeProperty("background-image"); el.removeAttribute("data-kk-kz");
    }
  }

  /* ================================================================
     3) DOKUNMA ALANI — 48 pikselden küçük düğme/bağlantıları büyüt
     ================================================================ */
  var ETKILESIM = "a[href],button,[role=button],[role=tab],summary,input[type=file],input[type=button],input[type=submit],[onclick]";
  function hedefleriBuyut(liste){
    var karar = [];
    for (var i = 0; i < liste.length; i++){
      var el = liste[i];
      if (el.hasAttribute("data-kk-h") || el.closest(".kk-ui,svg")) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.height >= 48 && r.width >= 48) continue;
      var cs = getComputedStyle(el);
      if (cs.position === "absolute" && r.width < 4) continue;
      var satirIci = cs.display === "inline" && el.parentElement && yaziTasir(el.parentElement) && el.tagName === "A";
      if (satirIci) continue;   /* paragraf içindeki bağlantı */
      karar.push([el, cs.display === "inline" || cs.display === "inline-block"]);
    }
    for (var j = 0; j < karar.length; j++){
      var e = karar[j][0];
      e.setAttribute("data-kk-h", "");
      e.style.setProperty("min-height", "48px", "important");
      e.style.setProperty("min-width", "48px", "important");
      if (karar[j][1]){
        e.style.setProperty("display", "inline-flex", "important");
        e.style.setProperty("align-items", "center", "important");
        e.style.setProperty("justify-content", "center", "important");
      }
    }
  }
  function hedefKaldir(el){
    if (!el.hasAttribute("data-kk-h")) return;
    ["min-height", "min-width", "display", "align-items", "justify-content"].forEach(function(p){ el.style.removeProperty(p); });
    el.removeAttribute("data-kk-h");
  }
  function etkilesimler(kok){
    var l = [];
    if (kok.matches && kok.matches(ETKILESIM)) l.push(kok);
    var a = kok.querySelectorAll ? kok.querySelectorAll(ETKILESIM) : [];
    for (var i = 0; i < a.length; i++) l.push(a[i]);
    return l;
  }

  function hedef(base){
    var b = BOYUTLAR[ayar.boyut];
    if (base >= 30) return Math.round(base * Math.min(b.f, 1.08));
    return Math.round(Math.max(base * b.f, b.min) * 10) / 10;
  }
  function uygula(el, base){
    var t = hedef(base);
    el.style.setProperty("font-size", t + "px", "important");
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
      if (el.hasAttribute("data-kk-b")) { okunan.push([el, +el.getAttribute("data-kk-b"), null]); continue; }
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
      okunan.push([el, c, kontrastKarar(el, cs, hedef(c))]);
    }
    for (var j = 0; j < okunan.length; j++){
      okunan[j][0].setAttribute("data-kk-b", okunan[j][1]);
      uygula(okunan[j][0], okunan[j][1]);
      kontrastUygula(okunan[j][0], okunan[j][2]);
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
    hedefleriBuyut(etkilesimler(doc.body));
  }
  /* CSS'in de kullanabilmesi için seçili yazı boyutu: --kk-fs */
  function fsDegiskeni(){ root.style.setProperty("--kk-fs", BOYUTLAR[ayar.boyut].min + "px"); }
  fsDegiskeni();
  function olcegiYenile(){
    fsDegiskeni();
    var l = doc.querySelectorAll("[data-kk-b]");
    for (var i = 0; i < l.length; i++) uygula(l[i], +l[i].getAttribute("data-kk-b"));
  }
  function olcegiKaldir(){
    var k = doc.querySelectorAll("[data-kk-kc],[data-kk-kd],[data-kk-kz]");
    for (var x = 0; x < k.length; x++) kontrastKaldir(k[x]);
    var h = doc.querySelectorAll("[data-kk-h]");
    for (var y = 0; y < h.length; y++) hedefKaldir(h[y]);
    var l = doc.querySelectorAll("[data-kk-b]");
    for (var i = 0; i < l.length; i++){
      l[i].style.removeProperty("font-size");
      l[i].style.removeProperty("line-height");
      l[i].classList.remove("kk-yazili");
      l[i].removeAttribute("data-kk-b");
      l[i].removeAttribute("data-kk-lh");
    }
  }

  /* Sınıfı değişen öğe (ör. seçili sekme, açılan düğme): bizim eklediğimiz
     boyut/renk/zemin ayarlarını kaldır ve yeni hâline göre yeniden hesapla. */
  function yenidenDegerlendir(el){
    var l = [el], a = el.getElementsByTagName("*");
    for (var i = 0; i < a.length; i++) l.push(a[i]);
    for (var j = 0; j < l.length; j++){
      var e = l[j];
      if (e.hasAttribute("data-kk-b")){
        e.style.removeProperty("font-size"); e.style.removeProperty("line-height");
        e.removeAttribute("data-kk-b"); e.removeAttribute("data-kk-lh");
      }
      kontrastKaldir(e); hedefKaldir(e);
    }
    kuyruk(el);
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
    var hedefler = [];
    bekleyen.forEach(function(n){
      if (!n.isConnected) return;
      hedefler = hedefler.concat(etkilesimler(n));
      simgeEtiketleri(n.closest("button,a,[role=button]") ? n.closest("button,a,[role=button]").parentElement || n : n);
    });
    bekleyen = [];
    if (set.length) olcekle(set);
    if (hedefler.length) hedefleriBuyut(hedefler);
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
  /* Yalnız simgeden oluşan her düğmeye altına kısa yazı (CSS ::after ile;
     sayfa düğmenin içeriğini değiştirse de yazı kaybolmaz). */
  var SIMGE = {
    "💡": "Öneri", "📝": "Hatalarım", "🔁": "Tekrar", "✓": "Özetle", "✔": "Tamam", "✔️": "Tamam",
    "💎": "Gemini", "🎙": "Konuş", "🎙️": "Konuş", "🎤": "Konuş", "➤": "Gönder", "🏁": "Bitir",
    "📊": "Puan", "⚙️": "Ayarlar", "⚙": "Ayarlar", "🔑": "Anahtar", "🔊": "Dinle", "🔈": "Dinle",
    "🔇": "Sessiz", "←": "Geri", "⬅": "Geri", "⬅️": "Geri", "◀": "Geri", "→": "İleri", "➡": "İleri",
    "➡️": "İleri", "▶": "Oynat", "▶️": "Oynat", "⏸": "Durdur", "⏸️": "Durdur", "⏹": "Durdur",
    "⏹️": "Durdur", "✕": "Kapat", "×": "Kapat", "✖": "Kapat", "❌": "Kapat", "☰": "Menü",
    "🗑": "Sil", "🗑️": "Sil", "🎓": "Öğretmen", "📋": "Liste", "🔍": "Ara", "🔎": "Ara",
    "+": "Ekle", "＋": "Ekle", "↻": "Yenile", "🔄": "Yenile", "?": "Yardım", "❓": "Yardım",
    "📷": "Fotoğraf", "🖼️": "Resim", "🎬": "Video", "📚": "Kitaplık", "🏠": "Ana Sayfa", "✏️": "Düzelt"
  };
  /* "Puan" ile "Puanla" yan yana neyin ne olduğu anlaşılmıyordu. */
  var KIMLIK = { errSaveBtn: "Hatalarım", autoBtn: "Eller serbest", finishBtn: "Özetle", gemBtn: "Gemini'de sürdür",
                 suggestBtn: "Öneri", micBtn: "Konuş", sendBtn: "Gönder", levelBtn: "Seviye",
                 dhPuanBtn: "Değerlendir", dhGemRaporBtn: "Gemini raporu", dhDahaBtn: "Daha fazla", finishBtn2: "Bitir",
                 playToggle: "Oynat", fullscreenToggle: "Tam ekran", fsActionExit: "Küçült", practiceActionsToggle: "Cümle düğmeleri",
                 controlMoreToggle: "Diğer", soundToggle: "Ses" };
  var SADECE_SIMGE = /^[^\p{L}\p{N}]{1,4}$/u;
  function simgeEtiketleri(kok){
    if (!ayar.acik) return;
    var l = (kok || doc).querySelectorAll("button,a[href],[role=button]");
    for (var i = 0; i < l.length; i++){
      var b = l[i];
      if (b.closest(".kk-ui,.dh-ikon-btn,svg,.dh-net-status,.dh-mobile-menu-button,.atlas-controls,#dhSyncBadge,.dh-primary-nav,.dh-app-nav")) continue;
      var t = (b.textContent || "").replace(/\s+/g, "");
      if (!t || !SADECE_SIMGE.test(t)) { if (b.hasAttribute("data-kk-etiket") && t && !SADECE_SIMGE.test(t)) b.removeAttribute("data-kk-etiket"); continue; }
      /* Sayfanın kendi CSS'iyle GİZLENMİŞ düğmeyi görünür yapma (etiket kuralı display'i
         zorluyordu; ör. YouTube'da tam ekran dışında "Tam ekrandan çık" düğmesi çıkıp taşıyordu) */
      if (b.hasAttribute("data-kk-etiket")) { var eskiE = b.getAttribute("data-kk-etiket"); b.removeAttribute("data-kk-etiket"); if (getComputedStyle(b).display === "none") continue; b.setAttribute("data-kk-etiket", eskiE); }
      else if (getComputedStyle(b).display === "none") continue;
      var ad = KIMLIK[b.id] || SIMGE[t] || SIMGE[t.replace(/\uFE0F/g, "")];
      if (!ad){
        var uzun = b.getAttribute("aria-label") || b.title || "";
        if (!uzun) continue;
        ad = uzun.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).slice(0, 2).join(" ");
        if (!ad) continue;
      }
      if (b.getAttribute("data-kk-etiket") !== ad) b.setAttribute("data-kk-etiket", ad);
    }
  }

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
    /* Çubuk gizliyken (perde açık) r.top=0 olur ve bütün ekran yüksekliği kadar
       kaydırıyordu: Öğretmen paneli ekranın dışına (yukarı) kaçıyordu. */
    if (r.height < 4 || r.top <= 0 || r.top > innerHeight) return 0;
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
  /* Tam ekran sayfalarda sağ üstteki Menü düğmesi sayfanın kendi
     düğmesini örtüyorsa, o düğmenin başlığına sağdan boşluk aç. */
  function yerAc(){
    var m = doc.querySelector(".kk-ust-menu");
    if (!m || !ayar.acik) return;
    var mr = m.getBoundingClientRect();
    var l = doc.querySelectorAll(ETKILESIM);
    for (var i = 0; i < l.length; i++){
      var e = l[i];
      if (e.closest(".kk-ui")) continue;
      var r = e.getBoundingClientRect();
      if (r.width < 1 || r.right < mr.left - 6 || r.left > mr.right + 6 || r.bottom < mr.top - 6 || r.top > mr.bottom + 6) continue;
      var kap = e.closest("header,nav,[class*='head'],[class*='top'],[class*='bar']") || e.parentElement;
      if (!kap || kap === doc.body || kap.hasAttribute("data-kk-yer")) continue;
      var pr = parseFloat(getComputedStyle(kap).paddingRight) || 0;
      kap.style.setProperty("padding-right", (pr + 80) + "px", "important");
      kap.setAttribute("data-kk-yer", "");
    }
  }
  /* Alt boşluk, sayfa içeriğinin gerçek bitişine konur (bazı sayfalarda
     içerik sabit yükseklikli kutudan taşar; o yüzden ölçerek yerleştirilir). */
  function boslukAyarla(){
    var bos = doc.querySelector(".kk-bosluk");
    if (!bos || !ayar.acik) return;
    bos.style.display = "none";
    var H = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
    bos.style.display = "";
    var govdeUst = doc.body.getBoundingClientRect().top + scrollY;
    if (getComputedStyle(doc.body).position === "static") govdeUst = 0;
    bos.style.top = (H - govdeUst) + "px";
  }
  /* Sayfanın kendi büyük açılır penceresi (ayarlar, puan, öğretmen paneli)
     ekranı kaplıyorsa alt çubuğu gizle; kapanınca geri getir. */
  function perdeKontrol(tam){
    if (!doc.body || TAM_EKRAN || NAVSIZ) return;
    var var_ = false, W = innerWidth, H = innerHeight;
    var l = tam ? doc.body.getElementsByTagName("*") : doc.body.children;
    for (var i = 0; i < l.length && !var_; i++){
      var e = l[i];
      if (e.classList.contains("kk-ui") || e.id === "atlas-aurora" || /^(CANVAS|SCRIPT|STYLE|LINK)$/.test(e.tagName)) continue;
      var cs = getComputedStyle(e);
      if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.2 || cs.pointerEvents === "none") continue;
      var r = e.getBoundingClientRect();
      if (r.width * r.height > W * H * 0.45 && r.bottom > H - 120) var_ = true;
    }
    doc.body.classList.toggle("kk-perde-acik", var_);
  }
  doc.addEventListener("click", function(){
    setTimeout(function(){ perdeKontrol(true); }, 80);
    setTimeout(function(){ perdeKontrol(true); }, 450);
  }, true);
  var tamTarama = 0;
  function kaydir(tam){
    yerAc();
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
      ["📘", "Bugünkü Dersim", "Öğretmeninin hazırladığı ders", "ders.html"],
      ["🔁", "Tekrar Et", "Öğrendiklerini pekiştir", "tekrar.html"],
      ["🃏", "Kelime Öğren", "En sık kullanılan kelimeler", "kelime-ogren.html"],
      ["✍️", "Cümle Yazma", "Türkçesini gör, İngilizcesini yaz", "practice.html"],
      ["🎙️", "Konuşma Pratiği", "Sesli sohbet et", "chat.html"],
      ["🧑‍🏫", "Öğretmene Sor", "Türkçe anlatımlı öğretmen", "teacher.html"]
    ]],
    ["Takip", [
      ["📈", "İlerlemem", "Ne kadar çalıştığını gör", "rapor.html"],
      ["📕", "Hata Defterim", "Yanlış yaptığın cümleler", "hata-defteri.html"]
    ]],
    ["Diğer", [
      ["🧭", "Tüm Bölümler", "Uygulamadaki bütün araçlar", "menu.html"],
      ["👤", "Profil ve Ayarlar", "Bilgilerin ve tercihlerin", "profil.html"],
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
      + '<span><b>Yazı Boyutu</b><small>Yazıları büyüt veya küçült</small></span>'
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
      + '<p class="kk-aciklama">Sana en rahat gelen yazı boyutunu seç. Seçimin hemen uygulanır ve bu cihazda hatırlanır.</p>'
      + '<div class="kk-boyutlar" role="radiogroup" aria-label="Yazı boyutu">';
    Object.keys(BOYUTLAR).forEach(function(k){
      var b = BOYUTLAR[k];
      html += '<button type="button" class="kk-boyut" role="radio" data-kk-boyut="' + k + '" aria-checked="false">'
        + '<span class="kk-ornek" style="font-size:' + b.ornek + 'px">' + b.ad + ' yazı</span>'
        + '<span class="kk-isaret" aria-hidden="true">✓</span></button>';
    });
    html += '</div>'
      + '<button type="button" class="kk-anahtar" role="switch" data-kk-mod aria-checked="true">'
      + '<span><b>Kolay görünüm</b><small>Büyük düğmeler, net renkler, alt menü çubuğu. Kapatırsan uygulamanın eski görünümüne dönülür.</small></span>'
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
      doc.body.classList.add("kk-tam");
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
    /* Sayfanın en sonuna, alt çubuk kadar boşluk: son düğme çubuğun altında
       kalmasın. (Gövdesi sabit yükseklikli sayfalarda iç boşluk işe yaramıyor.) */
    var bosluk = el("div", "kk-ui kk-bosluk");
    bosluk.setAttribute("aria-hidden", "true");
    doc.body.appendChild(bosluk);
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
    if (acik){ tumunuOlcekle(); ikonYazilari(); simgeEtiketleri(); kaydir(true); }
    else {
      olcegiKaldir();
      var y = doc.querySelectorAll(".kk-ikon-yazi"); for (var i = 0; i < y.length; i++) y[i].remove();
      var et = doc.querySelectorAll("[data-kk-etiket]"); for (var q = 0; q < et.length; q++) et[q].removeAttribute("data-kk-etiket");
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

  /* Gözlemci, gövde (body) oluşur oluşmaz kurulur: sayfa yavaş internette
     parça parça yüklenirken de her parça ekrana çıkmadan büyütülür. */
  var gozlemciVar = false;
  function gozlemciKur(){
    if (gozlemciVar || !doc.body) return;
    gozlemciVar = true;
    if (ayar.acik) tumunuOlcekle();
    function kkSiz(t){ return String(t || "").split(/\s+/).filter(function(c){ return c && c.indexOf("kk-") !== 0; }).sort().join(" "); }
    new MutationObserver(function(ms){
      for (var i = 0; i < ms.length; i++){
        var m = ms[i];
        if (m.type === "attributes"){
          var t = m.target;
          if (!ayar.acik || t === doc.body || t === root || !t.isConnected || t.closest(".kk-ui")) continue;
          if (kkSiz(m.oldValue) === kkSiz(t.getAttribute("class"))) continue;
          yenidenDegerlendir(t);
          continue;
        }
        var a = m.addedNodes;
        for (var j = 0; j < a.length; j++) kuyruk(a[j]);
      }
      /* Gözlemci, tarayıcı ekranı boyamadan önce çalışır: yeni içerik
         küçük yazıyla bir an bile görünmesin diye hemen işle. */
      if (bekleyen.length) isle();
      if (!ayar.acik) klasikMenuyeEkle();
    }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  }

  /* Bazı sayfalar stil dosyalarını sonradan yükler (ör. ux-boost.js).
     Yeni stil gelince ölçümler eskir: hepsini sıfırlayıp yeniden hesapla. */
  var yenileZaman = 0;
  function tamYenile(){
    clearTimeout(yenileZaman);
    yenileZaman = setTimeout(function(){
      if (!ayar.acik || !doc.body) return;
      olcegiKaldir(); tumunuOlcekle(); kaydir(true);
    }, 30);
  }
  doc.addEventListener("load", function(e){
    var t = e.target;
    if (t && t.tagName === "LINK" && /stylesheet/i.test(t.rel) && doc.body) tamYenile();
  }, true);
  addEventListener("load", function(){ tamYenile(); });

  function basla(){
    if (!doc.body || doc.querySelector(".kk-alt,.kk-ust-menu")) return;
    gozlemciKur();
    cubukKur(); menuKur(); yaziKur(); olaylar();
    if (ayar.acik){ tumunuOlcekle(); ikonYazilari(); simgeEtiketleri(); }
    klasikMenuyeEkle();

    /* Geç yüklenen düğmeler (öğretmen balonu, senkron rozeti) için tarama */
    kaydir(true);
    boslukAyarla();
    [300, 900, 1800, 4000].forEach(function(ms){ setTimeout(function(){
      kaydir(true); boslukAyarla();
      if (ayar.acik) hedefleriBuyut(doc.querySelectorAll(ETKILESIM));
    }, ms); });
    setInterval(function(){
      kaydir(++tamTarama % 5 === 0);
      boslukAyarla();
      perdeKontrol(tamTarama % 2 === 0);
      /* Sonradan görünür olan (başta gizli) düğmeleri de büyüt */
      if (ayar.acik){ hedefleriBuyut(doc.querySelectorAll(ETKILESIM)); simgeEtiketleri(); }
    }, 1500);
    addEventListener("resize", function(){ kaydir(true); boslukAyarla(); }, { passive: true });
    addEventListener("scroll", function(){
      /* Sayfa sonuna yaklaşınca boşluğu tazele (sonsuz liste vb.) */
      if (innerHeight + scrollY > doc.documentElement.scrollHeight - 300) boslukAyarla();
    }, { passive: true });
  }

  g.DHKolay = {
    ayar: function(){ return { acik: ayar.acik, boyut: ayar.boyut }; },
    boyut: function(k){ if (BOYUTLAR[k]){ ayar.boyut = k; yaz(ayar); olcegiYenile(); yaziBoya(); } },
    ac: function(){ modDegistir(true); },
    kapat: function(){ modDegistir(false); },
    menu: function(){ pencereAc(menuPerde); },
    yazi: function(){ pencereAc(yaziPerde); },
    /* Tanılama: bir öğe için kontrast kararını ve zemini döndürür */
    _tani: function(e){ var z = zemin(e); return { zemin: z && z.renk, sahip: z && z.sahip && z.sahip.tagName, karar: kontrastKarar(e, getComputedStyle(e), 18) }; }
  };

  if (doc.readyState === "loading"){
    if (doc.body) gozlemciKur();
    else {
      var govdeBekle = new MutationObserver(function(){
        if (doc.body){ govdeBekle.disconnect(); gozlemciKur(); }
      });
      govdeBekle.observe(root, { childList: true });
    }
    doc.addEventListener("DOMContentLoaded", basla, { once: true });
  }
  else basla();
})(window);
