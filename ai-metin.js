/* ai-metin.js — Yapay zekâ metinlerini düzgün gösterir ve doğru dilde okutur
   ====================================================================
   İSTEK (50-80 yaş kullanıcı):
     1) Yapay zekâdan gelen hiçbir metinde <b>, <br>, &lt;p&gt;, **kalın**
        gibi "kod" görünmesin.
     2) Bu metinlerdeki İngilizce cümleler MAVİ renkte olsun.
     3) Sesli okunurken İngilizce kısımlar İngilizce sesle, Türkçe kısımlar
        Türkçe sesle okunsun.

   NASIL (sayfaları tek tek değiştirmeden, merkezden):
     • DHProviders.chat sarılır: dönen her cevabın parçaları "iz" olarak
       saklanır. Ekrana bu izi taşıyan bir metin eklendiğinde o kutu
       "yapay zekâ metni" sayılır → biçimlenir, İngilizce kısımlar maviye
       boyanır. İzler localStorage'da da tutulur (sayfa yenilenince de tanınsın).
     • Herhangi bir ekranda düz yazı olarak görünen HTML etiketi (<b> vb.)
       her zaman hatadır: nerede görünürse görünsün güvenli biçimde işlenir.
     • speechSynthesis.speak sarılır: metin Türkçe ve İngilizce parçalara
       ayrılır, her parça kendi dilinin sesiyle sırayla okunur. Sayfanın
       onstart/onend/onboundary olayları korunur (ağız senkronu bozulmaz).
     • React'in yönettiği düğümlere dokunulmaz (React ağacı bozulmasın).
   ==================================================================== */
(function (g) {
  "use strict";
  if (g.DHAiMetin) return;

  /* ---------------- kelime listeleri ---------------- */
  var TEMEL = ("the a an is are was were be been being am i you he she it we they this that these those of to in on at for with " +
    "from by and or but not no yes do does did done have has had will would can could should may might must shall what who whom whose " +
    "where when why how which there here my your his her its our their me him us them mine yours very really so too also just only " +
    "please thank thanks hello hi good morning evening night day today tomorrow yesterday time go goes went gone come came get got " +
    "make made take took see saw seen know knew like want need work works worked live lives lived eat drink buy pay call help tell say " +
    "said ask answer open close stop start finish play read write speak talk listen look watch find give gave put let think thought " +
    "feel felt use used try tried new old big small long short happy sad tired hungry cold hot nice great bad right wrong home school " +
    "office room table book car bus train hotel restaurant airport doctor teacher student friend family mother father water coffee tea " +
    "reservation ticket money name year years old any some much many more most all every each other another than then now still already " +
    "yet ever never always often sometimes usually if because before after about up down out over into again off don't doesn't didn't " +
    "isn't aren't wasn't weren't can't won't i'm you're it's that's there's let's i've i'll i'd").split(" ");
  var EN = new Set(TEMEL), BELIRSIZ = new Set(), listeHazir = false;
  var TR_HARF = /[çğıöşüÇĞİÖŞÜ]/;

  function listeYukle() {
    try {
      var yol = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^\/]*$/, "") : "./";
      fetch(yol + "data/en-kelimeler.json?v=1").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d) return;
        (d.e || []).forEach(function (w) { EN.add(w); });
        (d.a || []).forEach(function (w) { BELIRSIZ.add(w); });
        listeHazir = true;
        try { tumIsaretlileriYenidenBoya(); } catch (e) {}
      }).catch(function () {});
    } catch (e) {}
  }

  var TR_KESIN = new Set(("bu bir ve ile de da ne mi mu ama gibi ki ya ben sen biz siz onlar var yok daha diye ise yani veya hep kim hangi " +
    "evet tamam kadar bile sonra simdi burada orada nasil neden kelime kelimesi kelimeler cumle cumlesi ornek anlam anlami yapi yapisi " +
    "olarak icin olan olur eder edin yap yapar yapin bak bakin dikkat not kural fiil isim zaman soru olumsuz olumlu").split(" "));
  function sinif(w) {
    if (TR_HARF.test(w)) return "T";
    if (TR_KESIN.has(w.toLowerCase())) return "T";
    if (/^\d/.test(w)) return "N";
    var l = w.toLowerCase().replace(/[’]/g, "'");
    if (EN.has(l)) return "E";
    var kok = l.replace(/'(s|re|ve|ll|d|m)$/, "").replace(/n't$/, "");
    if (kok !== l && (EN.has(kok) || kok === "ca" || kok === "wo")) return "E";
    if (BELIRSIZ.has(l)) return "A";
    if (/^[A-Z][a-z]+$/.test(w)) return "U";          /* özel ad olabilir */
    if (w.length === 1 && /[A-Za-z]/.test(w)) return "A";
    return "X";                                          /* bilinmeyen: çoğunlukla şapkasız Türkçe */
  }

  var KELIME = /[A-Za-zÇĞİÖŞÜçğıöşü0-9]+(?:['’][A-Za-z]+)*/g;
  var ARA_IZIN = /^[ \t ,;:\-–—'"“”‘’()\/.?!…]*$/;
  var TIRNAK = /["“”‘’'«»]/;

  /* Metindeki İngilizce bölümlerin [başlangıç, bitiş] aralıkları */
  function ingilizceAraliklar(t) {
    t = String(t || "");
    var toks = [], m;
    KELIME.lastIndex = 0;
    var IPA = /[ːɪəʊˈˌæɛɔʃʒθðŋɑʌɜɒ]/;
    while ((m = KELIME.exec(t))) {
      var c0 = sinif(m[0]);
      /* okunuş (IPA) yazımının parçası olan kelimeler İngilizce cümle değildir */
      if (IPA.test(t.charAt(m.index + m[0].length) || "") || IPA.test(t.charAt(m.index - 1) || "")) c0 = "X";
      toks.push({ s: m.index, e: m.index + m[0].length, w: m[0], c: c0 });
    }
    var out = [], i = 0;
    while (i < toks.length) {
      if (toks[i].c === "T" || toks[i].c === "X") { i++; continue; }
      var j = i, nE = 0, nSay = 0;
      while (j < toks.length) {
        var tk = toks[j];
        if (tk.c === "T" || tk.c === "X") break;
        if (j > i) {
          var ara = t.slice(toks[j - 1].e, tk.s);
          if (!ARA_IZIN.test(ara) || /\n/.test(ara)) break;
          if (ara.indexOf("/") >= 0 && ara !== "/") break;        /* "have/has" evet, " /hiː/" hayır */
          if (/[.?!…()]/.test(ara)) break;   /* her cümle / parantez ayrı değerlendirilir: "class. (Her zaman…" */
          /* cümle sonu + ardından Türkçe başlıyorsa zaten T ile kırılır */
        }
        if (tk.c === "E") nE++;
        if (tk.c !== "N") nSay++;
        j++;
      }
      var run = toks.slice(i, j);
      /* baş/sondaki kanıtsız (A/U/N) kelimeleri at */
      while (run.length && run[0].c !== "E") run.shift();
      while (run.length && run[run.length - 1].c !== "E" && run[run.length - 1].c !== "U") run.pop();
      if (run.length) {
        var e = 0, say = 0;
        run.forEach(function (x) { if (x.c === "E") e++; if (x.c !== "N") say++; });
        var bas = run[0].s, son = run[run.length - 1].e;
        var tekTirnakli = run.length === 1 && e === 1 && run[0].w.length > 1 &&
          TIRNAK.test(t.charAt(bas - 1) || "") && TIRNAK.test(t.charAt(son) || "");
        if ((e >= 2 && e >= say * 0.5) || tekTirnakli) {
          var sonEk = /^[.?!…]+/.exec(t.slice(son));
          if (sonEk) son += sonEk[0].length;
          out.push([bas, son]);
        }
      }
      i = Math.max(j, i + 1);
    }
    return out;
  }

  /* Türkçe parçalar (İngilizce bir cümlenin içindeki açık Türkçe bölümler) */
  function turkceMi(parca) {
    var t = 0, e = 0, m; KELIME.lastIndex = 0;
    while ((m = KELIME.exec(parca))) { var c = sinif(m[0]); if (c === "T") t += 2; else if (c === "X") t++; else if (c === "E") e++; }
    return t >= 2 && t > e;
  }

  /* ---------------- güvenli biçimleme ---------------- */
  var IZINLI = { B: "b", STRONG: "b", I: "i", EM: "i", U: "u", BR: "br", P: "p", UL: "ul", OL: "ol", LI: "li",
    H1: "h", H2: "h", H3: "h", H4: "h", H5: "h", H6: "h", CODE: "code", SMALL: "small", MARK: "mark", DIV: "div", SPAN: "span", BLOCKQUOTE: "div", PRE: "div", TABLE: "div", TR: "div", TD: "span", TH: "b" };
  var ETIKET_RE = /<\/?(b|strong|i|em|u|br|p|ul|ol|li|h[1-6]|code|small|mark|div|span|blockquote|pre|table|tr|td|th)\b[^>]*>/i;
  var KACIK_RE = /&lt;\/?(b|strong|i|em|u|br|p|ul|ol|li|h[1-6]|code|div|span)\b[\s\S]*?&gt;/i;
  var MD_RE = /\*\*[^*\n]+\*\*|__[^_\n]+__|(^|\n)\s{0,3}#{1,6}\s|`[^`\n]+`|(^|\n)\s*[-*•]\s+\S/;

  function kacisCoz(s) {
    var d = document.createElement("textarea"); d.innerHTML = s; return d.value;
  }
  function htmlParcasi(s) {
    var doc = new DOMParser().parseFromString("<body>" + s + "</body>", "text/html");
    var frag = document.createDocumentFragment();
    (function kopyala(kaynak, hedef) {
      kaynak.childNodes.forEach(function (n) {
        if (n.nodeType === 3) { hedef.appendChild(document.createTextNode(n.data)); return; }
        if (n.nodeType !== 1) return;
        var tag = IZINLI[n.tagName];
        if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META)$/.test(n.tagName)) return;
        if (!tag) { kopyala(n, hedef); return; }
        var el;
        if (tag === "h") { el = document.createElement("div"); el.style.fontWeight = "800"; el.style.margin = "8px 0 4px"; }
        else el = document.createElement(tag);
        if (tag === "ul" || tag === "ol") { el.style.margin = "4px 0"; el.style.paddingLeft = "22px"; }
        hedef.appendChild(el);
        kopyala(n, el);
      });
    })(doc.body, frag);
    return frag;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function mdHtml(s) {
    var satirlar = String(s).replace(/\r/g, "").split("\n");
    return satirlar.map(function (l) {
      var h = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(l);
      var x = esc(h ? h[2] : l);
      x = x.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/__([^_]+)__/g, "<b>$1</b>")
        .replace(/`([^`]+)`/g, "<b>$1</b>")
        .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,!?:;]|$)/g, "$1<i>$2</i>");
      x = x.replace(/^\s*[-*•]\s+/, "• ");
      if (h) x = "<b>" + x + "</b>";
      return x;
    }).join("<br>").replace(/\*\*/g, "");
  }
  /* Bir metni güvenli bir DOM parçasına çevirir (HTML ya da markdown olabilir) */
  function parcaYap(s) {
    s = String(s == null ? "" : s);
    if (KACIK_RE.test(s)) s = kacisCoz(s);
    if (ETIKET_RE.test(s)) return htmlParcasi(s.replace(/\*\*([^*<>]+)\*\*/g, "<b>$1</b>"));
    if (MD_RE.test(s)) return htmlParcasi(mdHtml(s));
    return null;
  }

  /* ---------------- İngilizceyi maviye boyama ---------------- */
  var ATLA = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|BUTTON|SVG|NOSCRIPT|IFRAME|CANVAS|VIDEO|AUDIO)$/;
  function stil() {
    if (document.getElementById("dhAiMetinStil")) return;
    var st = document.createElement("style"); st.id = "dhAiMetinStil";
    st.textContent = ".dh-en{color:#60a5fa!important;font-weight:600}" +
      ".dh-en.dh-en-acik-zemin{color:#1d4ed8!important}.dh-en.dh-en-mavi-zemin{color:inherit!important}" +
      "@media (prefers-color-scheme: light){body.dh-acik .dh-en{color:#1d4ed8!important}}" +
      ".dh-ai-metin b .dh-en,.dh-ai-metin strong .dh-en{font-weight:800}";
    (document.head || document.documentElement).appendChild(st);
  }
  function tamamenIngilizceMi(t) {
    var e = 0, m; KELIME.lastIndex = 0;
    while ((m = KELIME.exec(t))) { var c = sinif(m[0]); if (c === "T" || c === "X") return false; if (c === "E") e++; }
    return e >= 1;
  }
  /* Mavi yazı her zeminde okunmaz: koyu zeminde açık mavi, açık zeminde koyu mavi,
     mavi zeminde (ör. kullanıcının kendi mesaj balonu) zeminin yazı rengi kalır */
  function zeminSinifi(el) {
    try {
      for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
        var c = getComputedStyle(n).backgroundColor, m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c);
        if (!m || (m[4] !== undefined && +m[4] < 0.35)) continue;
        var r = +m[1], g2 = +m[2], b = +m[3], lum = (0.2126 * r + 0.7152 * g2 + 0.0722 * b) / 255;
        if (b > 120 && b > r + 50 && b > g2 + 20) return "dh-en-mavi-zemin";
        if (lum > 0.55) return "dh-en-acik-zemin";
        return "";
      }
    } catch (e) {}
    return "";
  }
  function metniBoya(tn) {
    var t = tn.data; if (!t || !/[A-Za-z]{2}/.test(t)) return;
    var ar = tamamenIngilizceMi(t) ? [[t.search(/\S/), t.replace(/\s+$/, "").length]] : ingilizceAraliklar(t);
    if (!ar.length) return;
    var frag = document.createDocumentFragment(), k = 0, zc = zeminSinifi(tn.parentElement);
    ar.forEach(function (r) {
      if (r[0] > k) frag.appendChild(document.createTextNode(t.slice(k, r[0])));
      var sp = document.createElement("span"); sp.className = "dh-en" + (zc ? " " + zc : ""); sp.lang = "en"; sp.textContent = t.slice(r[0], r[1]);
      frag.appendChild(sp); k = r[1];
    });
    if (k < t.length) frag.appendChild(document.createTextNode(t.slice(k)));
    tn.parentNode.replaceChild(frag, tn);
  }
  /* React'in çocuklarını kendisinin yönettiği bir öğe mi? (dokunursak React bozulur)
     - React özelliği yoksa: betikle eklenmiş öğe → güvenli
     - dangerouslySetInnerHTML ile doldurulmuşsa: React çocuklara bakmaz → güvenli */
  function reactMi(el) {
    if (!el || el.nodeType !== 1) return false;
    for (var k in el) {
      if (k.indexOf("__reactProps") === 0) {
        try { var pr = el[k]; if (pr && pr.dangerouslySetInnerHTML) return false; } catch (e) {}
        return true;
      }
    }
    return false;
  }
  function metinDugumleri(kok) {
    var out = [], w = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        for (var p = n.parentNode; p && p !== kok.parentNode; p = p.parentNode) {
          if (p.nodeType === 1 && (ATLA.test(p.tagName) || p.classList.contains("dh-en") || p.isContentEditable)) return NodeFilter.FILTER_REJECT;
        }
        if (reactMi(n.parentNode)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n; while ((n = w.nextNode())) out.push(n);
    return out;
  }
  /* Yapay zekâ kutusunu işle: biçim + mavi İngilizce */
  function aiKutusuIsle(el) {
    if (!el || el.nodeType !== 1 || ATLA.test(el.tagName)) return;
    stil();
    if (!reactMi(el)) el.classList.add("dh-ai-metin");
    metinDugumleri(el).forEach(function (tn) {
      if (!tn.parentNode) return;
      var f = parcaYap(tn.data);
      if (f) {
        var dugumler = metinDugumleri(f);
        dugumler.forEach(metniBoya);
        tn.parentNode.replaceChild(f, tn);
      } else metniBoya(tn);
    });
    reactMetinleriniVurgula(el);
  }
  /* React'in yönettiği metinlerde DOM'a dokunmadan renk: CSS Custom Highlight API */
  var vurgu = null;
  function vurguHazirla() {
    if (vurgu !== null) return vurgu;
    try {
      if (g.CSS && CSS.highlights && g.Highlight) {
        vurgu = new Highlight(); CSS.highlights.set("dh-en", vurgu);
        var st = document.createElement("style"); st.textContent = "::highlight(dh-en){color:#60a5fa}";
        (document.head || document.documentElement).appendChild(st);
      } else vurgu = false;
    } catch (e) { vurgu = false; }
    return vurgu;
  }
  function reactMetinleriniVurgula(kok) {
    var h = vurguHazirla(); if (!h) return;
    try { h.forEach(function (r) { if (!r.startContainer.isConnected) h.delete(r); }); } catch (e) {}
    var w = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      if (!reactMi(n.parentNode) || !n.data || !/[A-Za-z]{2}/.test(n.data)) continue;
      if (n.__dhVurguVeri === n.data) continue; n.__dhVurguVeri = n.data;
      var t = n.data, ar = tamamenIngilizceMi(t) ? [[t.search(/\S/), t.replace(/\s+$/, "").length]] : ingilizceAraliklar(t);
      ar.forEach(function (a) { try { var r = document.createRange(); r.setStart(n, a[0]); r.setEnd(n, a[1]); h.add(r); } catch (e) {} });
    }
  }
  var AI_SECICI = ".detail-explain,.item-detail,.learn-text,.exp,.ai-explain,.dh-ai-kutu,#dhTbBody,.dh-coach > span:not(.face):not(.x)";
  function seciliKutular() {
    try { document.querySelectorAll(AI_SECICI).forEach(function (k) { aiKutusuIsle(k); }); } catch (e) {}
  }
  function tumIsaretlileriYenidenBoya() {
    document.querySelectorAll(".dh-ai-metin").forEach(function (el) {
      metinDugumleri(el).forEach(function (tn) { if (tn.parentNode) metniBoya(tn); });
    });
  }

  /* ---------------- yapay zekâ izleri ---------------- */
  var IZ_KEY = "dh-ai-izler-v1", izler = [];
  try { izler = JSON.parse(localStorage.getItem(IZ_KEY) || "[]") || []; } catch (e) { izler = []; }
  function norm(s) {
    return String(s || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/[*_#`>•\-]+/g, " ")
      .replace(/\s+/g, " ").trim().toLowerCase();
  }
  function izEkle(metin) {
    var parcalar = [];
    try {
      var j = JSON.parse(String(metin).replace(/^```(?:json)?|```$/g, "").trim());
      (function topla(v) {
        if (typeof v === "string") parcalar.push(v);
        else if (v && typeof v === "object") for (var k in v) topla(v[k]);
      })(j);
    } catch (e) { parcalar.push(String(metin)); }
    parcalar.forEach(function (p) {
      String(p).split(/\n+/).forEach(function (satir) {
        var n = norm(satir);
        if (n.length < 14) return;
        var iz = n.length <= 28 ? n : n.slice(0, 28);
        if (izler.indexOf(iz) < 0) izler.push(iz);
        if (n.length > 60) { var o = n.slice(Math.floor(n.length / 2) - 14, Math.floor(n.length / 2) + 14); if (izler.indexOf(o) < 0) izler.push(o); }
      });
    });
    if (izler.length > 600) izler = izler.slice(-600);
    try { localStorage.setItem(IZ_KEY, JSON.stringify(izler)); } catch (e) {}
    zamanla(document.body);
  }
  function izliMi(el) {
    var n = norm(el.textContent);
    if (n.length < 14) return false;
    for (var i = izler.length - 1; i >= 0; i--) if (n.indexOf(izler[i]) >= 0) return true;
    return false;
  }
  /* izi taşıyan EN KÜÇÜK kutuları bul */
  function aiKutulariniBul(kok) {
    if (!kok || kok.nodeType !== 1 || !izler.length) return;
    if (!izliMi(kok)) return;
    var cocukBuldu = false;
    for (var i = 0; i < kok.children.length; i++) {
      var c = kok.children[i];
      if (ATLA.test(c.tagName)) continue;
      if (izliMi(c)) { cocukBuldu = true; aiKutulariniBul(c); }
    }
    if (!cocukBuldu || kok.childElementCount <= 3) aiKutusuIsle(kok);
  }

  /* ---------------- DOM gözlemi ---------------- */
  var bekleyen = new Set(), zamanlayici = null, isleniyor = false;
  function zamanla(n) { if (n) bekleyen.add(n); if (!zamanlayici) zamanlayici = setTimeout(isle, 120); }
  function etiketliMetinDuzelt(kok) {
    /* nerede olursa olsun düz yazı olarak görünen HTML etiketi hatadır */
    var liste = kok.nodeType === 3 ? [kok] : metinDugumleri(kok);
    liste.forEach(function (tn) {
      if (!tn.parentNode || !tn.data || tn.data.indexOf("<") < 0 && tn.data.indexOf("&lt;") < 0) return;
      if (!(ETIKET_RE.test(tn.data) || KACIK_RE.test(tn.data))) return;
      var p = tn.parentElement; if (!p || reactMi(p)) return;
      var f = parcaYap(tn.data); if (!f) return;
      stil(); p.classList.add("dh-ai-metin");
      metinDugumleri(f).forEach(metniBoya);
      tn.parentNode.replaceChild(f, tn);
    });
  }
  function isle() {
    zamanlayici = null; if (isleniyor) return; isleniyor = true;
    try {
      var liste = Array.from(bekleyen); bekleyen.clear();
      liste.forEach(function (n) {
        if (!n || !n.isConnected) return;
        var el = n.nodeType === 3 ? n.parentElement : n;
        if (!el || el.closest && el.closest("textarea,input,script,style,[contenteditable=true]")) return;
        etiketliMetinDuzelt(n.nodeType === 3 ? n : el);
        if (el.closest && el.closest(".dh-ai-metin")) { aiKutusuIsle(el.closest(".dh-ai-metin") === el ? el : el); return; }
        aiKutulariniBul(el);
      });
      /* ikinci tur: bu arada "yapay zekâ kutusu" olarak işaretlenen kutulara düşen
         parçalar (ör. sonradan eklenen <strong>) da boyansın */
      var kutular = new Set();
      liste.forEach(function (n) { try { var e2 = (n.nodeType === 3 ? n.parentElement : n); var k = e2 && e2.isConnected && e2.closest && e2.closest(".dh-ai-metin"); if (k) kutular.add(k); } catch (e) {} });
      kutular.forEach(function (k) { aiKutusuIsle(k); });
      seciliKutular();
    } catch (e) {}
    try { gozcu && gozcu.takeRecords(); } catch (e) {}
    isleniyor = false;
  }
  var gozcu = null;
  function gozle() {
    if (!document.body || gozcu) return;
    gozcu = new MutationObserver(function (kayitlar) {
      if (isleniyor) return;
      kayitlar.forEach(function (k) {
        if (k.type === "characterData") zamanla(k.target);
        else k.addedNodes.forEach(function (n) { if (n.nodeType === 1 || n.nodeType === 3) zamanla(n.nodeType === 3 ? n.parentElement || n : n); });
      });
    });
    gozcu.observe(document.body, { childList: true, subtree: true, characterData: true });
    zamanla(document.body);
  }
  if (document.body) gozle(); else document.addEventListener("DOMContentLoaded", gozle);
  /* güvenlik ağı: yazma efektiyle parça parça eklenen metinler için kutuları
     ara ara yeniden boya (yalnız içeriği değişen kutular) */
  setInterval(function () {
    if (isleniyor || document.hidden) return;
    try {
      isleniyor = true;
      document.querySelectorAll(".dh-ai-metin").forEach(function (k) {
        var imza = k.textContent.length + ":" + k.querySelectorAll(".dh-en").length;
        if (k.__dhImza === imza) return;
        aiKutusuIsle(k);
        k.__dhImza = k.textContent.length + ":" + k.querySelectorAll(".dh-en").length;
      });
    } catch (e) {}
    try { gozcu && gozcu.takeRecords(); } catch (e) {}
    isleniyor = false;
  }, 1500);

  /* ---------------- DHProviders.chat'i sar ---------------- */
  function sar() {
    var P = g.DHProviders;
    if (!P || !P.chat || P.chat.__dhAiSarili) return !!(P && P.chat && P.chat.__dhAiSarili);
    var asil = P.chat;
    var yeni = function () {
      var r = asil.apply(this, arguments);
      try { if (r && r.then) r.then(function (v) { try { if (typeof v === "string") izEkle(v); else if (v && typeof v === "object") izEkle(JSON.stringify(v)); } catch (e) {} return v; }, function () {}); } catch (e) {}
      return r;
    };
    yeni.__dhAiSarili = true;
    P.chat = yeni;
    return true;
  }
  if (!sar()) { var deneme = 0, tm = setInterval(function () { if (sar() || ++deneme > 80) clearInterval(tm); }, 250); }

  /* alert() içinde de etiket/markdown görünmesin */
  try {
    var asilAlert = g.alert;
    g.alert = function (m) {
      var s = String(m == null ? "" : m);
      if (ETIKET_RE.test(s) || KACIK_RE.test(s) || /\*\*[^*]+\*\*/.test(s)) {
        s = kacisCoz(s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|div|h[1-6])>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, "")).replace(/\*\*([^*]+)\*\*/g, "$1");
      }
      return asilAlert.call(g, s);
    };
  } catch (e) {}

  /* ---------------- sesli okuma: her parça kendi dilinde ---------------- */
  function bozukSesler() { try { return JSON.parse(localStorage.getItem("dh-bozuk-sesler-kalici") || "[]") || []; } catch (e) { return []; } }
  function sesBul(dil, tercih) {
    try {
      var vs = speechSynthesis.getVoices() || [], boz = bozukSesler();
      var uy = vs.filter(function (v) { return String(v.lang || "").toLowerCase().indexOf(dil) === 0 && boz.indexOf(v.name) < 0; });
      if (!uy.length) return null;
      if (tercih) { var t = uy.filter(function (v) { return v.name === tercih; })[0]; if (t) return t; }
      try { var gl = localStorage.getItem("dh-voice:__global__"); if (gl) { var t2 = uy.filter(function (v) { return v.name === gl; })[0]; if (t2) return t2; } } catch (e) {}
      var sira = dil === "en" ? [/en-US/i, /en-GB/i, /en/i] : [/tr-TR/i, /tr/i];
      var iyi = function (v) { return /Google|Natural|Online|Neural|Siri|Enhanced|Premium/i.test(v.name); };
      for (var i = 0; i < sira.length; i++) {
        var aday = uy.filter(function (v) { return sira[i].test(v.lang); });
        if (aday.length) return aday.filter(iyi)[0] || aday[0];
      }
      return uy[0];
    } catch (e) { return null; }
  }
  /* Metni [{dil, metin, bas}] parçalarına ayırır. anaDil: "tr" ya da "en" */
  function parcala(metin, anaDil) {
    metin = String(metin || "");
    var out = [];
    if (anaDil === "tr" && tamamenIngilizceMi(metin)) return [{ dil: "en", metin: metin, bas: 0 }];
    if (anaDil === "tr") {
      var ar = ingilizceAraliklar(metin), k = 0;
      ar.forEach(function (r) { if (r[0] > k) out.push({ dil: "tr", metin: metin.slice(k, r[0]), bas: k }); out.push({ dil: "en", metin: metin.slice(r[0], r[1]), bas: r[0] }); k = r[1]; });
      if (k < metin.length) out.push({ dil: "tr", metin: metin.slice(k), bas: k });
    } else {
      /* İngilizce sesle okunan metinde açıkça Türkçe olan cümleleri ayır */
      var re = /[^.!?\n:;()]+[.!?\n:;()]*/g, m;
      while ((m = re.exec(metin))) out.push({ dil: turkceMi(m[0]) ? "tr" : "en", metin: m[0], bas: m.index });
    }
    /* yalnız noktalama olan parçaları komşuya kat, aynı dilleri birleştir */
    var birlesik = [];
    out.forEach(function (p) {
      var bos = !/[A-Za-zÇĞİÖŞÜçğıöşü0-9]/.test(p.metin), son = birlesik[birlesik.length - 1];
      if (son && (bos || son.dil === p.dil)) son.metin += p.metin;
      else if (bos && !son) birlesik.push({ dil: anaDil, metin: p.metin, bas: p.bas });
      else birlesik.push({ dil: p.dil, metin: p.metin, bas: p.bas });
    });
    return birlesik.filter(function (p) { return /\S/.test(p.metin); });
  }

  try {
    var SS = g.SpeechSynthesis && g.SpeechSynthesis.prototype;
    var asilSoyle = SS && SS.speak;
    if (asilSoyle && g.SpeechSynthesisUtterance && !SS.speak.__dhAiSarili) {
      var soyle = function (u) {
        var self = this;
        try {
          if (!u || u.__dhParca || !u.text) return asilSoyle.call(self, u);
          /* okunacak metinde HTML etiketi / markdown işareti kalmasın */
          if (/<[a-z\/][^>]*>|&[a-z#0-9]+;|\*\*|__|`|^#+\s/im.test(u.text)) {
            try {
              u.text = kacisCoz(String(u.text).replace(/<br\s*\/?>/gi, ". ").replace(/<\/(p|li|div|h[1-6])>/gi, ". ").replace(/<[^>]+>/g, " "))
                .replace(/\*\*|__|`/g, "").replace(/^#+\s*/gm, "").replace(/\s*\.\s*\.\s*/g, ". ").replace(/\s+/g, " ").trim();
            } catch (e) {}
          }
          var lang = String(u.lang || (u.voice && u.voice.lang) || "").toLowerCase();
          var ana = lang.indexOf("tr") === 0 ? "tr" : lang.indexOf("en") === 0 ? "en" : "";
          if (!ana) {
            /* dil belirtilmemiş: Türkçe harf varsa tr, yoksa en say */
            ana = TR_HARF.test(u.text) ? "tr" : "en";
          }
          var ps = parcala(u.text, ana);
          if (!ps.length) return asilSoyle.call(self, u);
          if (ps.length === 1) {
            if (ps[0].dil !== ana) {
              var v1 = sesBul(ps[0].dil);
              u.lang = ps[0].dil === "en" ? (v1 && v1.lang) || "en-US" : (v1 && v1.lang) || "tr-TR";
              if (v1) u.voice = v1; else try { u.voice = null; } catch (e) {}
            }
            return asilSoyle.call(self, u);
          }
          /* birden fazla dil: alt cümlelere böl, olayları tek konuşma gibi ilet */
          var anaSes = u.voice || null, i = 0, bitti = false;
          var cagir = function (ad, ev) {
            /* dispatchEvent hem onstart özelliğini hem addEventListener dinleyicilerini tetikler (tek sefer) */
            try { u.dispatchEvent(new Event(ad.slice(2))); return; } catch (e) {}
            try { if (typeof u[ad] === "function") u[ad].call(u, ev); } catch (e) {}
          };
          ps.forEach(function (p, idx) {
            var a = new SpeechSynthesisUtterance(p.metin);
            a.__dhParca = true;
            a.rate = u.rate; a.pitch = u.pitch; a.volume = u.volume;
            if (p.dil === ana && anaSes) { a.voice = anaSes; a.lang = u.lang || anaSes.lang; }
            else { var v = sesBul(p.dil, null); if (v) { a.voice = v; a.lang = v.lang; } else a.lang = p.dil === "en" ? "en-US" : "tr-TR"; }
            a.onstart = function (ev) { if (idx === 0) cagir("onstart", ev); };
            a.onboundary = function (ev) {
              try {
                var e2 = { charIndex: (ev.charIndex || 0) + p.bas, charLength: ev.charLength, name: ev.name, elapsedTime: ev.elapsedTime, utterance: u };
                if (typeof u.onboundary === "function") u.onboundary.call(u, e2);
              } catch (e) {}
            };
            a.onend = function (ev) { if (idx === ps.length - 1 && !bitti) { bitti = true; cagir("onend", ev); } };
            a.onerror = function (ev) { if (!bitti) { bitti = true; try { if (typeof u.onerror === "function") u.onerror.call(u, ev); } catch (e) {} } };
            asilSoyle.call(self, a);
          });
        } catch (e) { return asilSoyle.call(self, u); }
      };
      soyle.__dhAiSarili = true;
      SS.speak = soyle;
      /* bazı sayfalar örnek üzerinde de tutuyor olabilir */
      try { if (g.speechSynthesis && g.speechSynthesis.hasOwnProperty("speak")) { /* örnek düzeyinde tanımlı: dokunma */ } } catch (e) {}
    }
  } catch (e) {}

  listeYukle();

  g.DHAiMetin = {
    parca: parcaYap, isle: aiKutusuIsle, ingilizceAraliklar: ingilizceAraliklar, parcala: parcala,
    izEkle: izEkle, html: function (s) { var d = document.createElement("div"); var f = parcaYap(s); if (f) d.appendChild(f); else d.textContent = String(s || ""); metinDugumleri(d).forEach(metniBoya); return d.innerHTML; },
    hazir: function () { return listeHazir; }
  };
})(typeof window !== "undefined" ? window : this);
