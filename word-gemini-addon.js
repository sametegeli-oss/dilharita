/* word-gemini-addon.js — 💎 GEMİNİ KELİME ANALİZİ (index-app.html)
   ====================================================================
   NEDEN AYRI DOSYA
   index-app.html DERLENMİŞ bir React uygulaması (assets/app.js) ve kendi
   kelime popup'ını kendisi çiziyor (.wp-box). word-popup.js o sayfada
   YÜKLÜ DEĞİL — bu yüzden 💎 düğmesi diğer 16 sayfada görünürken burada
   görünmüyordu.

   İki seçenek vardı: (a) word-popup.js'i bu sayfada da yüklemek — o zaman
   aynı tıklamada iki popup birden açılırdı; (b) React popup'ına düğmeyi
   enjekte etmek. (b) seçildi; word-wave-addon.js'in "Ses Dalgası"
   bölümünü aynı popup'a eklerken kullandığı desenin aynısı.

   TEK KAYNAK
   Prompt, JSON ayrıştırma, IndexedDB kaydı ve gruplu çizim word-popup.js
   içinde durur ve DHWordPop.analiz üzerinden paylaşılır. Burada yalnızca
   "React popup'ını bul, düğmeyi koy, sonucu çiz" işi yapılır. Böylece iki
   ekran hep aynı davranır ve analizler ORTAK depoda birikir: bir kelimeyi
   burada analiz edersen ders.html'de de gruplu liste hazır gelir.

   KURULUM (index-app.html):
     <script src="./word-popup.js?v=11"></script>
     <script>window.DHWordPop && DHWordPop.disable();</script>   ← tıklama
                       dinleyicisini kapat, yalnız kütüphane olarak kullan
     <script src="./word-gemini-addon.js?v=1"></script>
   ==================================================================== */
(function (global) {
  "use strict";
  if (global.__dhWordGem) return;
  global.__dhWordGem = true;

  var BTN_ID = "dhWgBtn", SEC_ID = "dhWgSec";

  function api(){
    return (global.DHWordPop && global.DHWordPop.analiz) || null;
  }

  function stil() {
    if (document.getElementById("dhwg-css")) return;
    var st = document.createElement("style"); st.id = "dhwg-css";
    st.textContent =
      "#" + BTN_ID + "{width:100%;border:0;border-radius:12px;padding:13px;font-size:14px;"
      + "font-weight:800;cursor:pointer;margin:8px 0;display:flex;align-items:center;"
      + "justify-content:center;gap:7px;background:linear-gradient(180deg,#8b5cf6,#6d28d9);color:#fff}"
      + "#" + SEC_ID + "{background:#0b1830;border:1px solid #1e3a5f;border-radius:14px;"
      + "padding:12px 14px;margin:10px 0}"
      + "#" + SEC_ID + " .dhwg-head{display:flex;align-items:center;gap:8px;font-size:12px;"
      + "font-weight:800;color:#9fb3d9;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px}"
      + "#" + SEC_ID + " .dhwg-kaynak{margin-left:auto;background:#1e3a8a;color:#93c5fd;"
      + "border-radius:99px;padding:3px 8px;font-size:10px;font-weight:800;text-transform:none;letter-spacing:0}"
      + "#" + SEC_ID + " .dhwg-not{font-size:11px;color:#64748b;line-height:1.45;margin-top:6px}";
    document.head.appendChild(st);
  }

  /* React popup'ından kelimeyi ve Türkçe anlamları oku.
     Anlamlar prompt için şart: Gemini'yi sözlüğün anlamlarına sabitliyoruz,
     yoksa "book" için "kitap" anlamının eş anlamlılarını verip ekranda
     yazan "ayırtmak" ile çelişiyor. */
  function popupVerisi(box) {
    var wEl = box.querySelector(".wp-word");
    var kelime = wEl ? String(wEl.textContent || "").trim().toLowerCase() : "";
    if (!/^[a-z][a-z'-]*$/.test(kelime)) return null;
    var anlamlar = [];
    box.querySelectorAll("ol.wp-meanings > li").forEach(function (li) {
      var t = String(li.textContent || "").trim();
      if (t) anlamlar.push(t);
    });
    return { kelime: kelime, anlamlar: anlamlar };
  }

  function bolum(box) {
    var sec = box.querySelector("#" + SEC_ID);
    if (sec) return sec;
    sec = document.createElement("div");
    sec.id = SEC_ID;
    sec.className = "no-wordpop";
    sec.innerHTML = '<div class="dhwg-head">🔁 Aynı anlama gelen kelimeler'
      + '<span class="dhwg-kaynak">💎 Gemini</span></div>'
      + '<div class="dhwg-liste"></div><div class="dhwg-not"></div>';
    var btn = box.querySelector("#" + BTN_ID);
    if (btn && btn.parentNode) btn.parentNode.insertBefore(sec, btn.nextSibling);
    else box.appendChild(sec);
    return sec;
  }

  function ciz(box, kelime, rec) {
    var A = api(); if (!A) return;
    A.stil();                                   // dh-wp-* sınıfları gerekli
    var sec = bolum(box);
    A.ciz(sec.querySelector(".dhwg-liste"), kelime, rec, sec.querySelector(".dhwg-not"));
  }

  /* Popup açıldığında düğmeyi kur; kayıt varsa listeyi hemen çiz. */
  function ensure() {
    var box = document.querySelector(".wp-box");
    if (!box) return;
    var A = api(); if (!A) return;

    var v = popupVerisi(box);
    if (!v) return;

    var mevcut = box.querySelector("#" + BTN_ID);
    /* Popup başka bir kelimeye geçmiş olabilir: React aynı .wp-box'ı
       yeniden kullanıyor, o yüzden düğmenin üstündeki kelimeyi kontrol et. */
    if (mevcut && mevcut.getAttribute("data-w") === v.kelime) return;

    stil();
    if (mevcut) { mevcut.remove(); }
    var eskiSec = box.querySelector("#" + SEC_ID);
    if (eskiSec) eskiSec.remove();

    var btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.className = "no-wordpop";
    btn.setAttribute("data-w", v.kelime);
    btn.textContent = "💎 Gemini Kelime Analizi";
    btn.onclick = function () {
      A.iste(v.kelime, v.anlamlar, function (rec) { ciz(box, v.kelime, rec); });
    };

    /* "Kelime Açıklama (AI)" bloğunun hemen altına — word-popup.js'teki
       yerleşimin aynısı olsun ki iki ekran birbirine benzesin. */
    var ai = box.querySelector(".wp-ai");
    if (ai && ai.parentNode) ai.parentNode.insertBefore(btn, ai.nextSibling);
    else box.appendChild(btn);

    /* daha önce analiz edilmişse anında göster */
    A.oku(v.kelime).then(function (rec) {
      if (rec && rec.anlamlar && rec.anlamlar.length) {
        var hala = box.querySelector("#" + BTN_ID);
        if (hala && hala.getAttribute("data-w") === v.kelime) ciz(box, v.kelime, rec);
      }
    });
  }

  function baslat() {
    ensure();
    var mo = new MutationObserver(function () { ensure(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", baslat);
  else baslat();
})(window);
