/* dh-dugme.js — Dil Harita ve Konuşkan: bütün düğmeler aynı boyutta, istisnasız.
   Kullanıcı isteği:
     • Bütün düğmeler sohbetteki küçük düğmeler boyutunda (28 px), istisna yok.
     • Düğmelerin üzerinde açıklama/yazı yok; yalnız simge.
     • Tek basış: işlevini yapar. Uzun basış (fare ya da dokunma): açıklama balonu çıkar,
       düğme çalışmaz. Üzerine gelince çıkan açıklamalar kaldırıldı.
   Sınıflar (bkz. dh-dugme.css):
     .dh-simge-dugme → 28 px yuvarlak, yalnız simge (svg/resim, emoji ya da komut sözlüğünden simge;
                       en çok 3 harflik etiketler — "A1", "TR" — olduğu gibi yazılır)
     .dh-kucuk-dugme → yazısı İÇERİĞİN KENDİSİ olan düğmeler (alıştırmadaki kelime parçası, cevap
                       şıkkı, liste kaydı): yazı gizlenirse kullanılamaz; 28 px yükseklikte yazılı kalır.
   Sonradan eklenen ya da yazısı değişen düğmeler anında yeniden değerlendirilir. */
(function (global) {
  "use strict";
  if (global.__dhDugme) return; global.__dhDugme = true;
  var SECICI = "button, .btn, a.dh-btn, a.dh-ikon-btn, a.yt-round, a[role=button], a[class*='-btn'], a[class*='button'], input[type=button], input[type=submit], input[type=reset]";
  /* yazısı içeriğin kendisi olan düğmelerin kapları: alıştırma parçaları, cevap şıkları, listeler */
  var ICERIK_KAP = ".tile-row,.tiles-words,.opts,.word-tiles,.chips-words,.dh-secenek-liste,.nd-ogeler,.quiz,.secenekler,.sentence-builder,.sb-tiles,.parcalar,.cevaplar,.answers,.choices,.options,.word-bank,.bank,.dh-quiz,.mc-options";
  var EN_KELIME = /\b(the|a|an|to|of|is|are|am|was|were|be|been|i|you|he|she|it|we|they|my|your|his|her|our|their|and|or|but|in|on|at|for|with|this|that|these|those|what|how|why|where|when|do|does|did|can|could|will|would|should|have|has|had|not|no|yes)\b/i;
  var CSS_SURUM = "7";
  function stilEkle() {
    if (document.getElementById("dh-dugme-css")) return;
    var l = document.createElement("link"); l.id = "dh-dugme-css"; l.rel = "stylesheet"; l.href = "./dh-dugme.css?v=" + CSS_SURUM;
    (document.head || document.documentElement).appendChild(l);
  }
  /* ---- komut sözlüğü: yazısı olan ama simgesi olmayan bilinen düğmeler ---- */
  var SOZLUK = [
    [/^(bitir|dersi bitir|aramayı bitir|bitti)$/, "⏹️"], [/^(kapat|×|✕)$/, "✖️"], [/^gönder/, "➤"], [/^başka soru/, "🔄"], [/^cevap öner/, "💡"],
    [/^(dinle|seslendir|sesli dinle|sesli oku|oku)$/, "🔊"], [/^(tekrar söyle|tekrar|yeniden dinle)$/, "🔁"], [/^(analiz|deniz'le analiz|incele)/, "🔍"],
    [/^(not|not defteri|not defterine kaydet|nota ekle)/, "📝"], [/^(kaydet|kaydı kaydet)$/, "💾"], [/^(sil|notu sil|sohbeti sil|evet, sil|evet, hepsini sil|bütün sohbetleri sil)/, "🗑️"],
    [/^(devam et|devam|derse devam et|sohbete devam et|aramaya devam et)$/, "▶️"], [/^(başlat|derse başla|dersi başlat|sohbeti başlat|başla|konuşmaya başla)$/, "▶️"],
    [/^aramayı başlat/, "📞"], [/^(yeni not|\+ yeni not|yeni ders|yeni sohbet|yeni|ekle|\+)$/, "➕"], [/^(geri|geri dön|◀)$/, "◀️"], [/^(ileri|sonraki|next)$/, "▶️"],
    [/^(önceki|prev)$/, "⏮️"], [/^(ayarlar|ayar)$/, "⚙️"], [/^(menü|menu)$/, "☰"], [/^(evet|tamam|ok|onayla|kontrol et|kontrol)$/, "✔️"], [/^(hayır|vazgeç|iptal)$/, "✖️"],
    [/^(dene|doğal sesi dene)$/, "🎧"], [/^(yeniden açıkla|↻ yeniden açıkla|yenile)$/, "🔄"], [/^(kopyala)$/, "📋"], [/^(paylaş)$/, "📤"], [/^(indir|yedeği indir)/, "⬇️"],
    [/^(yükle|içe aktar)/, "⬆️"], [/^(giriş yap)$/, "🔑"], [/^(çıkış yap|çıkış)$/, "🚪"], [/^(ara|arama)$/, "🔎"], [/^(temizle)$/, "🧹"], [/^(karıştır)$/, "🔀"],
    [/^(ipucu)$/, "💡"], [/^(çeviri|türkçesi|tr\/en)$/, "🌐"], [/^(\+ kart|kartlara ekle|seçilenleri kartlara ekle)/, "➕"], [/^(listeyi aç|tümünü gör|tümü)/, "📚"],
    [/^(kaydı başlat|kayıt|kaydet ve dinle)$/, "🎙️"], [/^(durdur|dur)$/, "⏹️"], [/^(yaz)$/, "⌨️"], [/^(kamera)$/, "📷"], [/^(atla|geç)$/, "⏭️"],
    [/^(varsayılana döndür|sıfırla)$/, "↩️"], [/^(göster|gizle)$/, "👁️"], [/^(model)$/, "🤖"], [/^(sohbetlerim)$/, "💬"]
  ];
  var EMOJI_BAS = /^\s*((?:[\u{1F1E6}-\u{1F1FF}]{2})|(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)|[←-⇿⬅-⬇➡➔-➿■-◿☀-⛿✀-❵⏩-⏺⭐✓-✖↺↻➕-➗☰])/u;
  function temiz(t) { return String(t || "").replace(/[​-‍]/g, "").replace(/\s+/g, " ").trim(); }
  function kucukHarf(t) { return t.toLocaleLowerCase("tr-TR"); }
  function etiketBul(el) {
    var a = el.getAttribute("data-dh-ipucu") || el.getAttribute("aria-label") || el.getAttribute("data-kk-sade-ipucu") || el.getAttribute("data-tooltip") || el.getAttribute("data-ipucu") || el.getAttribute("title") || "";
    var baslik = el.querySelector && el.querySelector("h1,h2,h3,h4,b,strong");
    var yazi = el.tagName === "INPUT" ? el.value : (el.textContent || "");
    yazi = temiz(yazi);
    if (!a && baslik && yazi.length > 30) { a = temiz(baslik.textContent); var acik = temiz((el.querySelector("p,small,.small,.muted,span.muted") || {}).textContent || ""); if (acik && acik !== a) a += " — " + acik; }
    return temiz(a || yazi);
  }
  /* yazısı içeriğin kendisi mi? (İngilizce kelime/cümle parçası, cevap şıkkı, uzun liste kaydı) */
  function icerikMi(el, yazi) {
    if (!yazi) return false;
    if (el.matches(".tile,.opt,.nd-oge,.choice,.option,.answer") || el.closest(ICERIK_KAP)) return true;   /* alıştırma parçası, şık, liste kaydı */
    var k = kucukHarf(yazi);
    for (var i = 0; i < SOZLUK.length; i++) if (SOZLUK[i][0].test(k)) return false;
    if (/[çğışöüÇĞİŞÖÜâîû]/.test(yazi)) return false;                    /* Türkçe: komut */
    if (EN_KELIME.test(yazi) || /^[A-Za-z][A-Za-z' -]*$/.test(yazi)) return true;   /* İngilizce kelime/cümle: içerik */
    return false;
  }
  /* simgesi olmayan Türkçe komut: baş harfler ("Önbelleği temizle" → "ÖT"); ilk kelime kısaysa o ("A1 Başlangıç" → "A1") */
  /* öğe sınırlarında boşluk bırakarak yazı ("<b>A1</b><small>Başlangıç</small>" → "A1 Başlangıç") */
  function aralikliYazi(el) { var p = []; (function gez(n) { for (var c = n.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3) p.push(c.nodeValue); else if (c.nodeType === 1 && !/^(svg|style|script)$/i.test(c.tagName)) { p.push(" "); gez(c); p.push(" "); } } })(el); return temiz(p.join("")); }
  function basHarf(yazi) {
    var k = yazi.split(" ").filter(Boolean);
    if (k[0] && k[0].length <= 3 && /^[\p{L}\d+\/.-]+$/u.test(k[0])) return k[0];
    return k.slice(0, 2).map(function (w) { return (w.match(/[\p{L}\d]/u) || [""])[0].toLocaleUpperCase("tr-TR"); }).join("");
  }
  function sozlukSimge(yazi) { var k = kucukHarf(yazi); for (var i = 0; i < SOZLUK.length; i++) if (SOZLUK[i][0].test(k)) return SOZLUK[i][1]; return ""; }

  function temizle(el) {
    el.classList.remove("dh-simge-dugme", "dh-kucuk-dugme", "dh-ikon-dugme");
    el.removeAttribute("data-dh-simge"); el.removeAttribute("data-dh-kisa");
    (el.getAttribute("data-dh-stil") || "").split(",").forEach(function (k) { if (k) el.style.removeProperty(k); }); el.removeAttribute("data-dh-stil");
    var y = el.querySelectorAll("[data-dh-gizle],[data-dh-yol],[data-dh-ikon]");
    for (var i = 0; i < y.length; i++) { y[i].removeAttribute("data-dh-gizle"); y[i].removeAttribute("data-dh-yol"); y[i].removeAttribute("data-dh-ikon"); }
    delete el.dataset.dhDugme;
  }
  /* svg/resmi göster, başka her şeyi gizle: simgeye giden yoldaki kapları "display:contents" yap */
  function simgeYolu(el, ikon) {
    ikon.setAttribute("data-dh-ikon", "");
    var n = ikon;
    while (n && n !== el) {
      var p = n.parentElement; if (!p) break;
      for (var c = p.firstElementChild; c; c = c.nextElementSibling) if (c !== n) c.setAttribute("data-dh-gizle", "");
      if (p !== el) p.setAttribute("data-dh-yol", "");
      n = p;
    }
  }
  function sinifla(el) {
    if (!el || el.nodeType !== 1 || el.dataset.dhDugme || !el.matches(SECICI)) return;
    if (el.closest(".dh-ipucu-balon")) return;
    var etiket = etiketBul(el), yazi = el.tagName === "INPUT" ? temiz(el.value) : temiz(el.textContent);
    if (etiket) { el.setAttribute("data-dh-ipucu", etiket); if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", etiket); }
    ["title", "data-tooltip", "data-ipucu"].forEach(function (n) { if (el.hasAttribute(n)) el.removeAttribute(n); });   /* üzerine gelince açıklama çıkmasın; açıklama uzun basınca */
    el.setAttribute("data-dh-son", yazi);
    /* 1) svg / resim simgesi */
    var ikon = el.tagName !== "INPUT" && el.querySelector("svg, img");
    if (ikon) { el.dataset.dhDugme = "simge"; el.classList.add("dh-simge-dugme"); simgeYolu(el, ikon); satirIci(el, true); return; }
    /* 2) yazının başında emoji ("✈️ Seyahat", "🔊 Dinle") ya da Okuma kolaylığı modunun simgesi */
    var emo = el.getAttribute("data-kk-ikon") || ((EMOJI_BAS.exec(yazi) || [])[1] || "");
    /* 3) komut sözlüğü */
    if (!emo) emo = sozlukSimge(yazi);
    /* 4) en çok 3 harflik etiket (A1, TR, OK, 1/5) olduğu gibi */
    if (!emo && yazi && yazi.length <= 3) { el.dataset.dhDugme = "simge"; el.classList.add("dh-simge-dugme"); el.setAttribute("data-dh-kisa", yazi); gizleCocuklar(el); satirIci(el, true); return; }
    if (emo && el.tagName !== "INPUT" && !(icerikMi(el, yazi) && !EMOJI_BAS.test(yazi) && !el.getAttribute("data-kk-ikon"))) {
      el.dataset.dhDugme = "simge"; el.classList.add("dh-simge-dugme"); el.setAttribute("data-dh-simge", emo); gizleCocuklar(el); satirIci(el, true); return;
    }
    if (!yazi) { el.dataset.dhDugme = "simge"; el.classList.add("dh-simge-dugme"); satirIci(el, true); return; }   /* boş düğme (CSS arka plan simgesi) */
    /* 5) yazısı içeriğin kendisi (İngilizce parça, şık, liste kaydı): yazılı kalır, aynı yükseklik */
    if (el.tagName === "INPUT" || icerikMi(el, yazi)) { el.dataset.dhDugme = "kucuk"; el.classList.add("dh-kucuk-dugme"); satirIci(el, false); return; }
    /* 6) simgesi olmayan Türkçe komut: baş harfleri; uzun basınca tam adı */
    var bh = basHarf(aralikliYazi(el) || yazi);
    el.dataset.dhDugme = "simge"; el.classList.add("dh-simge-dugme"); el.setAttribute("data-dh-kisa", bh || "•"); gizleCocuklar(el); satirIci(el, true);
  }
  /* sayfanın satır içi boyut kuralları (style="padding-right:90px !important" gibi) stil dosyasını geçer: onları da ez */
  var SIMGE_STIL = { width: "28px", height: "28px", "min-width": "28px", "min-height": "28px", "max-width": "28px", "max-height": "28px", "padding-top": "0px", "padding-right": "0px", "padding-bottom": "0px", "padding-left": "0px", "font-size": "0px" };
  var KUCUK_STIL = { "min-height": "28px", height: "auto", "padding-top": "3px", "padding-bottom": "3px", "padding-left": "11px", "padding-right": "11px", "font-size": "13px" };
  function satirIci(el, simge) {
    var st = simge ? SIMGE_STIL : KUCUK_STIL;
    for (var k in st) if (el.style.getPropertyValue(k) !== st[k] || el.style.getPropertyPriority(k) !== "important") el.style.setProperty(k, st[k], "important");
    el.setAttribute("data-dh-stil", Object.keys(st).join(","));
  }
  /* sayfa düğmenin satır içi stilini sonradan değiştirirse (ör. padding-right:90px) boyutu geri getir */
  function stilBozulduMu(el) { var st = el.dataset.dhDugme === "simge" ? SIMGE_STIL : KUCUK_STIL; for (var k in st) if (el.style.getPropertyValue(k) !== st[k] || el.style.getPropertyPriority(k) !== "important") return true; return false; }
  function gizleCocuklar(el) { for (var c = el.firstElementChild; c; c = c.nextElementSibling) c.setAttribute("data-dh-gizle", ""); }

  function tara(kok) {
    if (!kok || (kok.nodeType !== 1 && kok.nodeType !== 9)) return;
    if (kok.nodeType === 1 && kok.matches && kok.matches(SECICI)) sinifla(kok);
    var l = kok.querySelectorAll ? kok.querySelectorAll(SECICI) : [];
    for (var i = 0; i < l.length; i++) sinifla(l[i]);
  }
  var bekleyen = new Set(), zaman = null;
  function sirala(n) { bekleyen.add(n); if (!zaman) zaman = (global.requestAnimationFrame || setTimeout)(function () { zaman = null; var b = Array.from(bekleyen); bekleyen.clear(); b.forEach(tara); }); }
  function yenidenDegerlendir(b) { var once = b.getAttribute("data-dh-ipucu"); temizle(b); b.removeAttribute("data-dh-ipucu"); if (b.getAttribute("aria-label") === once) b.removeAttribute("aria-label"); sirala(b); }

  /* ---- uzun basış: açıklama balonu; tek basış: düğme çalışır ---- */
  var balon = null, uzunT = null, uzunOldu = false, basiliDugme = null, baslangic = null;
  function balonGoster(b) {
    var t = b.getAttribute("data-dh-ipucu") || b.getAttribute("aria-label") || ""; if (!t) return;
    if (!balon) { balon = document.createElement("div"); balon.className = "dh-ipucu-balon"; balon.setAttribute("role", "tooltip"); document.body.appendChild(balon); }
    balon.textContent = t; balon.style.display = "block";
    var r = b.getBoundingClientRect(), br = balon.getBoundingClientRect();
    var sol = Math.max(8, Math.min(innerWidth - br.width - 8, r.left + (r.width - br.width) / 2));
    var ust = r.top - br.height - 10; if (ust < 8) ust = Math.min(innerHeight - br.height - 8, r.bottom + 10);
    balon.style.left = Math.round(sol) + "px"; balon.style.top = Math.round(ust) + "px";
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {}
  }
  function balonGizle() { if (balon) balon.style.display = "none"; }
  function dugmeBul(n) { var b = n && n.closest && n.closest(SECICI); return b && b.dataset.dhDugme ? b : null; }
  function uzunBasisKur() {
    document.addEventListener("pointerdown", function (e) {
      balonGizle(); uzunOldu = false; clearTimeout(uzunT);
      if (e.button && e.button !== 0) return;
      var b = dugmeBul(e.target); if (!b) return;
      basiliDugme = b; baslangic = [e.clientX, e.clientY];
      uzunT = setTimeout(function () { uzunOldu = true; balonGoster(b); }, 500);
    }, true);
    document.addEventListener("pointermove", function (e) { if (baslangic && (Math.abs(e.clientX - baslangic[0]) > 12 || Math.abs(e.clientY - baslangic[1]) > 12)) clearTimeout(uzunT); }, true);
    ["pointerup", "pointercancel"].forEach(function (ev) { document.addEventListener(ev, function () { clearTimeout(uzunT); baslangic = null; if (uzunOldu) setTimeout(balonGizle, 1800); }, true); });
    /* uzun basıştan sonraki tıklama düğmeyi çalıştırmasın */
    document.addEventListener("click", function (e) {
      if (uzunOldu && basiliDugme && basiliDugme.contains(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); uzunOldu = false; }
    }, true);
    document.addEventListener("contextmenu", function (e) { if (dugmeBul(e.target)) e.preventDefault(); }, true);
    addEventListener("scroll", balonGizle, true);
  }

  function basla() {
    stilEkle(); tara(document); uzunBasisKur();
    try {
      new MutationObserver(function (ml) {
        for (var i = 0; i < ml.length; i++) {
          var m = ml[i];
          if (m.type === "childList") for (var j = 0; j < m.addedNodes.length; j++) if (m.addedNodes[j].nodeType === 1) sirala(m.addedNodes[j]);
          if (m.type === "attributes" && m.attributeName === "style") { var e = m.target; if (e.dataset && e.dataset.dhDugme && e.hasAttribute("data-dh-stil") && stilBozulduMu(e)) satirIci(e, e.dataset.dhDugme === "simge"); }
          if (m.type === "attributes") continue;
          /* yazısı değişen düğme ("Dinle" → "Durdur"): yeniden değerlendir */
          var t = m.target.nodeType === 1 ? m.target : m.target.parentElement, b = t && t.closest && t.closest(SECICI);
          if (b && b.dataset.dhDugme) {
            var yazi = b.tagName === "INPUT" ? temiz(b.value) : temiz(b.textContent), eski = b.getAttribute("data-dh-son");
            if (eski != null && yazi !== eski) yenidenDegerlendir(b);
          }
        }
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["style"] });
    } catch (e) {}
  }
  global.DHDugme = { yenile: function () { document.querySelectorAll("[data-dh-dugme]").forEach(temizle); tara(document); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", basla, { once: true }); else basla();
})(window);
