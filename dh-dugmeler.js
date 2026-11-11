/* dh-dugmeler.js — "🧰 Düğmeler": ekranın ARAÇ düğmeleri tek pencerede
   ====================================================================
   Kullanıcı kararı (11 Kasım, "A"): Asıl iş düğmeleri (Dinle, Önceki,
   Sonraki, Zor/Normal/Kolay, Kontrol et, mikrofon, Gönder) ekranda kalır.
   Araçlar (Gemini, Resim, Video, Liste, Stüdyo, Çeviri, ayarlar…) ekrandan
   gizlenir ve alt çubuktaki "🧰 Düğmeler" penceresinde büyük, yazılı
   olarak listelenir. Yazı boyutu (eski "Aa") da bu pencerede ve Menü'de.

   NASIL
   - Düğmeler SİLİNMEZ: data-dh-arac özniteliği alır, CSS ile gizlenir
     (yalnız kolay görünüm açıkken). Penceredeki kopyaya basınca asıl
     düğmeye .click() yapılır; sayfanın kendi kodu aynen çalışır.
   - Sayfa yeniden çizince (React vb.) MutationObserver yeniden işaretler.
   - Asıl düğme o an kullanılamıyorsa (sayfa onu gizlemiş/kapatmışsa)
     pencerede de görünmez.

   EKRAN LİSTESİ: EKRANLAR (sayfa adı -> gruplar). Listede olmayan sayfada
   pencere yalnız "Yazı boyutu"nu gösterir.
*/
(function (g) {
  "use strict";
  if (g.DHDugmeler) return;
  var doc = document;

  /* [seçici, görünen ad, açıklama] — ad boşsa düğmenin kendi yazısı */
  var EKRANLAR = {
    "index-app": {
      gizle: [".dh-source-media-row"],          /* Resim/Video/YouTube satırı boş kalmasın */
      /* ÜST ÇUBUK (kullanıcı isteği, 11 Kasım): Önceki · Dinle · Sonraki en üstte,
         Geri'nin yanında; kart içindeki asılları gizlenir. Üst çubuk yapışkan
         olduğu için kaydırınca da elde kalır. */
      ust: { kap: ".index-app-top-actions", sonra: ".home",
             gizle: ["#dhNavTrio", ".dh-card-actions-primary"],
             dugmeler: [
               [".dh-nav-trio .dh-nav-prev", "←|Önceki", ""],
               [".dh-listen-after-sentence", "▶|Dinle", "birincil"],
               [".dh-nav-trio .dh-nav-next", "→|Sonraki", "ileri"]
             ] },
      gruplar: [["Bu cümle", [
        [".dh-gtr-btn", "✦ Gemini ile açıkla", "Cümleyi yapay zekâya açıklatın"],
        [".dh-mode-btn", "", ""],
        [".dh-youtube-source-btn", "▶ YouTube video", "Cümleyi YouTube videosunda dinleyin"],
        ["#dhToolsToggle", "🧰 Araçlar", "Yavaş dinleme, ayrıntı, öğretmen ve diğer araçlar"]
      ]], ["Bu modül", [
        ["#dhModuleListBtn", "📋 Modüldeki cümleler", "Listeden istediğiniz cümleye gidin"],
        ["#dhSesliModulBtn", "🎧 Bu modülü sesli çalış", "Ekrana bakmadan, dinleyip söyleyerek"]
      ]]]
    },
    "tekrar": {
      gizle: [".mode"],
      gruplar: [["Çalışma şekli", [
        ["#mProd", "✍️ Türkçesini gör, İngilizcesini yaz", ""],
        ["#mClas", "👁 İngilizcesini gör, anlamını hatırla", ""],
        ["#mOnlyErrs", "🚨 Sadece hatalarım", "Yalnız hata defterindeki cümleler"],
        ["#mSesli", "🎧 Tam sesli mod", "Ekrana bakmadan, dinleyip söyleyerek"]
      ]], ["Bu cümle", [
        ["#bTrans", "🌐 Çeviri", "Türkçe karşılığını göster"],
        ["#bGemini", "✨ Gemini'ye sor", "Cevabınızı yapay zekâya değerlendirtin"],
        ["#bRetry", "🔄 Bir daha sor", "Bu cümleyi oturumun sonunda yeniden sor"],
        ["#bStudio", "🎙️ Telaffuz stüdyosu", "Bu cümlenin söylenişini çalışın"],
        ["#bNever", "🚫 Bunu tekrar sorma", "Bu cümle tekrarlardan çıkar"],
        ["#toggleAiSettings", "⚙️ Cevap kontrol ayarları", ""]
      ]]]
    },
    "kelime-ogren": {
      gruplar: [["Bu kelime", [
        ["#exBtn", "📝 Örnek cümle", "Kelimenin geçtiği bir cümle"],
        ["#cfgBtn", "⚙️ Ayarlar", "Kelime listesi ve çalışma ayarları"]
      ]]]
    },
    "ogren": {
      gruplar: [["Bu cümle", [
        ["#translateBtn", "🌐 Tercüme et", "Türkçe karşılığını göster"],
        ["#studioBtn", "🎙️ Telaffuz stüdyosu", "Bu cümlenin söylenişini çalışın"],
        ["#modeBtn", "", "Fotoğraf ile video arasında geçiş"]
      ]], ["Bu modül", [
        ["#dhSesliModulBtn", "🎧 Bu modülü sesli çalış", "Ekrana bakmadan, dinleyip söyleyerek"]
      ]]]
    },
    "videopractice": {
      gizle: ["#dhModeToggle"],
      gruplar: [["Bu cümle", [
        ["#translateBtn", "🌐 Tercüme et", "Türkçe karşılığını göster"],
        ["#studioBtn", "🎙️ Telaffuz stüdyosu", "Bu cümlenin söylenişini çalışın"],
        ["#dhModeToggle .dh-mode-btn", "", "Resim ile video arasında geçiş"],
        ["#apiFloat", "⚙️ Video ayarı", "Video kaynağı ayarı"]
      ]], ["Bu modül", [
        ["#dhSesliModulBtn", "🎧 Bu modülü sesli çalış", "Ekrana bakmadan, dinleyip söyleyerek"]
      ]]]
    }
  };

  var sayfa = (location.pathname.split("/").pop() || "index.html").replace(/\.html?$/i, "") || "index";
  var tanim = EKRANLAR[sayfa] || null;

  function kolayAcik() {
    try { return !!(g.DHKolay && g.DHKolay.ayar && g.DHKolay.ayar().acik); } catch (e) { return false; }
  }

  /* ---------- gizleme ---------- */
  function stil() {
    if (doc.getElementById("dhDugmelerCss")) return;
    var s = doc.createElement("style");
    s.id = "dhDugmelerCss";
    s.textContent =
      ".dh-dg-secili{display:inline-block;margin-left:8px;padding:2px 10px;border-radius:999px;background:#14532d;color:#bbf7d0;font-size:14px;font-weight:800}" +
      ".kk-ust-dugme{top:auto}" +
      "#dhUstVekil{display:flex;flex:1 1 0;gap:6px;margin-left:6px;min-width:0}" +
      "#dhUstVekil[hidden]{display:none}" +
      ".index-app-top-actions:has(#dhUstVekil:not([hidden])){flex-wrap:nowrap !important}" +
      ".dh-ust-vekil{flex:1 1 0;min-width:0;min-height:52px;padding:6px 4px;border-radius:14px;border:2px solid #3b5b88;" +
      "background:#13233f;color:#fff;font:800 15px/1.15 system-ui,-apple-system,'Segoe UI',sans-serif;cursor:pointer;white-space:nowrap;overflow:hidden;" +
      "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}" +
      ".dh-uv-i{font-size:20px;line-height:1}.dh-uv-y{line-height:1.1}" +
      ".dh-ust-vekil--birincil{background:#6d28d9;border-color:#c4b5fd}" +
      ".dh-ust-vekil--ileri{background:#2563eb;border-color:#93c5fd}" +
      ".dh-ust-vekil:disabled{opacity:.4;cursor:default}" +
      ".dh-ust-vekil:focus-visible{outline:3px solid #fff;outline-offset:2px}";
    (doc.head || doc.documentElement).appendChild(s);
  }
  function seciciler() {
    var l = [];
    if (!tanim) return l;
    (tanim.gizle || []).forEach(function (x) { l.push(x); });
    if (tanim.ust) (tanim.ust.gizle || []).forEach(function (x) { l.push(x); });
    tanim.gruplar.forEach(function (gr) { gr[1].forEach(function (x) { l.push(x[0]); }); });
    return l;
  }
  /* GİZLEME VE "KULLANILABİLİR Mİ" ÖLÇÜSÜ
     Bazı sayfalar düğmeye satır içi "display:… !important" yazıyor (stil
     sayfası yenemez), bazıları hidden özniteliği + CSS ile gösteriyor. Bu
     yüzden: sayfanın kendi satır içi display değeri saklanır, bir anlığına
     geri konup düğmenin GERÇEKTEN görünüp görünmeyeceği ölçülür
     (e.__dhGorunur), sonra satır içi none!important yazılır. Sayfa sonradan
     style/hidden/class değiştirirse aynı ölçüm tekrarlanır. */
  function gizle(e) {
    if (!kolayAcik() || e.__dhKendim) return;
    e.__dhKendim = true;
    var v = e.style.getPropertyValue("display"), p = e.style.getPropertyPriority("display");
    if (!(e.__dhGizli && v === "none" && p === "important")) e.__dhOnceki = { v: v, p: p };   /* sayfanın değeri */
    var o = e.__dhOnceki || { v: "", p: "" };
    if (o.v) e.style.setProperty("display", o.v, o.p); else e.style.removeProperty("display");
    e.__dhGorunur = getComputedStyle(e).display !== "none";
    e.style.setProperty("display", "none", "important");
    e.__dhGizli = true;
    Promise.resolve().then(function () { e.__dhKendim = false; });
  }
  function isaretle() {
    if (!tanim) return;
    seciciler().forEach(function (sec) {
      var l = doc.querySelectorAll(sec);
      for (var i = 0; i < l.length; i++) {
        var e = l[i];
        if (!e.hasAttribute("data-dh-arac")) {
          e.setAttribute("data-dh-arac", "");
          try { new MutationObserver(function (m) { gizle(m[0].target); }).observe(e, { attributes: true, attributeFilter: ["style", "hidden", "class"] }); } catch (x) {}
          gizle(e);
        }
      }
    });
  }
  /* ---------- üst çubuk vekilleri ---------- */
  var ustKap = null;
  function ustKur() {
    var u = tanim && tanim.ust;
    if (!u || !kolayAcik()) return;
    var kap = doc.querySelector(u.kap);
    if (!kap) return;
    var hazir = doc.getElementById("dhUstVekil");
    if (!hazir || hazir.parentElement !== kap) {
      if (hazir) hazir.remove();
      hazir = doc.createElement("div");
      hazir.id = "dhUstVekil";
      hazir.setAttribute("data-kk-atla", "");
      u.dugmeler.forEach(function (d, i) {
        var b = doc.createElement("button");
        b.type = "button";
        b.className = "dh-ust-vekil" + (d[2] ? " dh-ust-vekil--" + d[2] : "");
        b.setAttribute("data-kk-atla", "");
        b.setAttribute("data-uv", String(i));
        /* simge üstte, yazı altta: dar ekranda Geri'nin yanına sığsın */
        var p = d[1].split("|");
        var si = doc.createElement("span"); si.className = "dh-uv-i"; si.textContent = p[0];
        var ya = doc.createElement("span"); ya.className = "dh-uv-y"; ya.textContent = p[1] || "";
        b.appendChild(si); b.appendChild(ya);
        b.setAttribute("aria-label", p[1] || p[0]);
        /* sayfanın kendi button kuralları yazıyı küçültüyordu */
        b.style.setProperty("font-size", "15px", "important");
        b.style.setProperty("font-weight", "800", "important");
        b.style.setProperty("color", "#fff", "important");
        b.onclick = function () {
          var asil = doc.querySelector(d[0]);
          if (asil && !asil.disabled) asil.click();
        };
        hazir.appendChild(b);
      });
      var once = u.sonra ? kap.querySelector(u.sonra) : null;
      if (once && once.nextSibling) kap.insertBefore(hazir, once.nextSibling); else kap.appendChild(hazir);
    }
    ustKap = hazir;
    ustEsitle();
  }
  /* asılların durumunu yansıt: yoksa gizle, kapalıysa kapalı */
  function ustEsitle() {
    var u = tanim && tanim.ust;
    if (!u || !ustKap) return;
    var varMi = false;
    Array.prototype.forEach.call(ustKap.children, function (b) {
      var d = u.dugmeler[+b.getAttribute("data-uv")];
      var asil = doc.querySelector(d[0]);
      b.hidden = !asil;
      if (asil){ varMi = true; b.disabled = !!asil.disabled; }
    });
    ustKap.hidden = !varMi;
  }
  setInterval(function () { if (!doc.hidden) { try { ustKur(); } catch (e) {} } }, 400);

  var bekliyor = false;
  function planla() { if (!bekliyor) { bekliyor = true; requestAnimationFrame(function () { bekliyor = false; isaretle(); }); } }

  /* Asıl düğme şu an kullanılabilir mi? (sayfa onu gizlemiş/kapatmışsa hayır) */
  function kullanilir(e) {
    if (!e || !e.isConnected || e.disabled) return false;
    if (e.__dhGizli ? !e.__dhGorunur : (e.hidden || e.style.display === "none")) return false;
    if (e.style.visibility === "hidden") return false;
    for (var a = e.parentElement; a && a !== doc.body; a = a.parentElement) {
      if (a.hasAttribute("data-dh-arac")) continue;          /* bizim gizlediğimiz kap */
      if (a.hidden || a.style.display === "none") return false;
      if (getComputedStyle(a).display === "none") return false;
    }
    return true;
  }
  function yazisi(e) {
    var t = (e.textContent || "").replace(/\s+/g, " ").trim();
    return t || e.getAttribute("aria-label") || e.getAttribute("title") || "Düğme";
  }
  function seciliMi(e) {
    return e.classList.contains("on") || e.classList.contains("active") || e.classList.contains("is-active") ||
           e.getAttribute("aria-pressed") === "true" || e.getAttribute("aria-selected") === "true";
  }

  /* ---------- pencere ---------- */
  var perde = null, sonOdak = null;
  function kacir(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function kapat() {
    if (!perde || perde.hidden) return;
    perde.hidden = true;
    doc.body.style.overflow = "";
    if (sonOdak && sonOdak.focus) try { sonOdak.focus(); } catch (e) {}
  }
  function ac(tetik) {
    sonOdak = tetik || doc.activeElement;
    isaretle();
    if (!perde) {
      perde = doc.createElement("div");
      perde.className = "kk-ui kk-perde";
      perde.id = "dhDugmelerPerde";
      /* bazı sayfaların üst çubuğu (Cümle Çalış "Geri") çok üst katmanda: pencere onun da üstünde */
      perde.style.setProperty("z-index", "2147483646", "important");
      perde.addEventListener("click", function (e) { if (e.target === perde) kapat(); });
      doc.body.appendChild(perde);
    }
    var hedefler = [];
    var html = '<div class="kk-pencere" role="dialog" aria-modal="true" aria-labelledby="dhDgBaslik">' +
      '<header><h2 id="dhDgBaslik">🧰 Düğmeler</h2><button type="button" class="kk-kapat" data-dg-kapat>✕ Kapat</button></header>' +
      '<div class="kk-kaydir">';
    var bos = true;
    if (tanim) tanim.gruplar.forEach(function (gr) {
      var satirlar = "";
      gr[1].forEach(function (x) {
        var l = doc.querySelectorAll(x[0]);
        for (var i = 0; i < l.length; i++) {
          var e = l[i];
          if (!kullanilir(e)) continue;
          var ad = (x[1] && l.length === 1) ? x[1] : yazisi(e);
          var n = hedefler.push(e) - 1;
          /* baştaki simge ayrı sütuna (Menü'deki satırlarla aynı düzen) */
          var sm = /^((?:\p{Extended_Pictographic}|[\u2190-\u21FF\u2600-\u27BF\u2B05-\u2B55\u25A0-\u25FF])(?:[\uFE0F\u200D]|\p{Extended_Pictographic})*)\s*/u.exec(ad);
          var simge = sm ? sm[1] : "•", yazi = sm ? ad.slice(sm[0].length) : ad;
          satirlar += '<li><button type="button" class="kk-oge kk-oge-btn" data-dg="' + n + '">' +
            '<span class="kk-i" aria-hidden="true">' + kacir(simge) + '</span>' +
            '<span><b>' + kacir(yazi || ad) + (seciliMi(e) ? '<span class="dh-dg-secili">Seçili</span>' : "") + '</b>' +
            (x[2] ? '<small>' + kacir(x[2]) + '</small>' : "") + '</span>' +
            '<span class="kk-ok" aria-hidden="true">›</span></button></li>';
        }
      });
      if (satirlar) { bos = false; html += '<h3 class="kk-grup">' + kacir(gr[0]) + '</h3><ul class="kk-liste">' + satirlar + '</ul>'; }
    });
    if (bos) html += '<p class="kk-aciklama" style="margin:6px 0 14px">Bu ekranda başka düğme yok. Gereken düğmelerin hepsi ekranda.</p>';
    html += '<h3 class="kk-grup">Görünüm</h3><ul class="kk-liste">' +
      '<li><button type="button" class="kk-oge kk-oge-btn" data-dg-yazi>' +
      '<span class="kk-i" aria-hidden="true">🔠</span><span><b>Yazı boyutu</b><small>Yazıları büyüt veya küçült</small></span>' +
      '<span class="kk-ok" aria-hidden="true">›</span></button></li></ul>';
    html += '</div></div>';
    perde.innerHTML = html;
    perde.querySelector("[data-dg-kapat]").onclick = kapat;
    perde.querySelector("[data-dg-yazi]").onclick = function () {
      kapat();
      setTimeout(function () { try { g.DHKolay && g.DHKolay.yazi && g.DHKolay.yazi(); } catch (e) {} }, 40);
    };
    Array.prototype.forEach.call(perde.querySelectorAll("[data-dg]"), function (b) {
      b.onclick = function () {
        var e = hedefler[+b.getAttribute("data-dg")];
        kapat();
        /* pencere kapandıktan sonra asıl düğmeye bas (bağlantıysa gider) */
        setTimeout(function () { try { e.click(); } catch (err) {} }, 40);
      };
    });
    perde.hidden = false;
    doc.body.style.overflow = "hidden";
    setTimeout(function () { var k = perde.querySelector(".kk-kapat"); if (k) k.focus(); }, 30);
  }
  doc.addEventListener("keydown", function (e) { if (e.key === "Escape") kapat(); });

  function basla() {
    stil();
    if (tanim) {
      isaretle();
      new MutationObserver(planla).observe(doc.body, { childList: true, subtree: true });
    }
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", basla); else basla();

  g.DHDugmeler = { ac: ac, kapat: kapat, EKRANLAR: EKRANLAR, sayfa: sayfa, var: function () { return !!tanim; } };
})(window);
