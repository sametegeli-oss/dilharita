/* dh-koc-modu.js — KOÇ MODU / "otomatik pilot" (koç planı, 3. aşama · 24 Kasım 2026)
   ====================================================================
   Deniz bugünün planını adım adım yürütür: her adımın ekranını kendisi açar,
   adım bitince 5 sn geri sayımlı bir geçiş gösterir, sıradakine geçer.
   auth-guard.js bu dosyayı her korumalı sayfaya ekler; koç modu kapalıyken hiçbir şey çizmez.

   DURUM (localStorage "dh-koc-modu-v1", yalnız bu cihaz)
     { gun, plan:[{ekran,dk,neden,ara?}], i, aktif, bekliyor, biten:[i…], atlanan:[i…],
       basSnap:{d,y,k}, araEklendi:{ekran:1}, bitti }

   ADIM BİTTİ SAYILIR
     - o ekranda bugün çalışılan süre, adımın dakikasının %80'ine ulaşınca (dh-olay.js etkin süre), ya da
     - şeritteki "Adımı bitirdim" düğmesiyle.
   ARA TEKRAR (kılavuz sınırları; kodda uygulanır)
     Adım bittiğinde o adımdaki cevaplar: en az 5 cevapta başarı < %70 ya da aynı konuda 3+ yanlış
     → sıradaki adımdan SONRA "Ara tekrar · 5 dk" (hata defteri: yalnız yanlışlar) eklenir;
     aynı ekran için günde en çok 1 kez.
   KUMANDA KULLANICIDA
     - "Koçtan çık" her zaman şeritte. Plan dışındaki bir sayfaya gidilirse koç BEKLER, sayfayı değiştirmez.
     - Geçişte "Bekle" geri sayımı durdurur, "Atla" sıradaki adımı atlar.

   API (window.DHKocModu): baslat(), cik(), durum(), devam()
   ==================================================================== */
(function (global) {
  "use strict";
  if (global.DHKocModu) return;

  var K = "dh-koc-modu-v1";
  var RENK = "#1E2F6B", RENK2 = "#3B5BDB";   /* koç modu: lacivert (marka yeşilinden ayrılsın) */
  function gunAnahtari() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function oku() { try { var x = JSON.parse(localStorage.getItem(K) || "null"); return x && typeof x === "object" ? x : null; } catch (e) { return null; } }
  function yaz(d) { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {} }
  function sayfa() { var p = location.pathname.split("/").pop() || "index.html"; try { p = decodeURIComponent(p); } catch (e) {} return p.toLowerCase(); }
  function D() { return global.DHKocDeniz; }

  var EKRAN = {
    tekrar:  { ad: "Cümle tekrarı",     url: "tekrar.html?plan=1",  beceri: "yazma" },
    kelime:  { ad: "Kelime",            url: "kelime-ogren.html",   beceri: "kelime" },
    konusma: { ad: "Deniz'le konuşma",  url: "konuskan.html",       beceri: "konusma" },
    dinleme: { ad: "Video ile dinleme", url: "youtube-egitim.html", beceri: "dinleme" },
    ders:    { ad: "Dilbilgisi dersi",  url: "ders.html",           beceri: "dilbilgisi" },
    okuma:   { ad: "Okuma",             url: "library.html",        beceri: "okuma" },
    hata:    { ad: "Hata defteri",      url: "hata-defteri.html",   beceri: "yazma" }
  };
  function ekran(a) { return EKRAN[a && a.ekran] || null; }
  function ekranSayfa(a) { var e = ekran(a); return e ? e.url.split("?")[0] : ""; }

  function bugunOzet() { try { return global.DHOlay ? DHOlay.gunler(1)[0] : null; } catch (e) { return null; } }
  function snap() { var g = bugunOzet() || {}; return { d: g.d || {}, y: g.y || {}, k: g.k || {}, e: g.e || {} }; }
  function sureSn(a) { var g = bugunOzet(); return g && g.e ? (g.e[ekranSayfa(a)] || 0) : 0; }

  /* ---------- başlat / çık ---------- */
  function planOku() {
    try { var x = JSON.parse(localStorage.getItem("dh-koc-gun-" + gunAnahtari()) || "null"); return x && Array.isArray(x.plan) && x.plan.length ? x.plan : null; } catch (e) { return null; }
  }
  async function baslat() {
    var plan = planOku();
    if (!plan && D()) { try { var g = await D().gunluk(false); plan = g && g.plan; } catch (e) {} }
    if (!plan || !plan.length) return false;
    var d = { gun: gunAnahtari(), plan: plan.map(function (a) { return { ekran: a.ekran, dk: a.dk, neden: a.neden }; }), i: 0, aktif: true, bekliyor: false, biten: [], atlanan: [], araEklendi: {}, bitti: false };
    /* zaten bitmiş adımları atla (o ekranda bugün yeterince çalışıldıysa) */
    while (d.i < d.plan.length && sureSn(d.plan[d.i]) >= d.plan[d.i].dk * 48) { d.biten.push(d.i); d.i++; }
    d.basSn = d.i < d.plan.length ? sureSn(d.plan[d.i]) : 0; d.basSnap = snap();
    yaz(d);
    if (d.i >= d.plan.length) { d.bitti = true; yaz(d); return true; }
    location.href = "./" + ekran(d.plan[d.i]).url;
    return true;
  }
  function cik() { var d = oku(); if (d) { d.aktif = false; yaz(d); } kaldir(); htmlSinif(false); }
  function durum() { return oku(); }
  function devam() { var d = oku(); if (!d || d.gun !== gunAnahtari() || d.bitti) return false; d.aktif = true; yaz(d); var a = d.plan[d.i]; if (a) location.href = "./" + ekran(a).url; return true; }

  /* ---------- ara tekrar kararı ---------- */
  function araTekrarGerekli(d, a) {
    var S = (global.DHKocKilavuz && DHKocKilavuz.SINIR) || { araTekrarBasari: 0.7, araTekrarAyniHata: 3, araTekrarGunlukAdim: 1 };
    if (a.ara || (d.araEklendi && d.araEklendi[a.ekran])) return null;
    var simdi = snap(), b = ekran(a) && ekran(a).beceri, o = d.basSnap || { d: {}, y: {}, k: {} };
    var dg = (simdi.d[b] || 0) - (o.d[b] || 0), yn = (simdi.y[b] || 0) - (o.y[b] || 0);
    var konuYanlis = null;
    for (var k in simdi.k) { var fark = ((simdi.k[k] || [0, 0])[1] || 0) - (((o.k || {})[k] || [0, 0])[1] || 0); if (fark >= S.araTekrarAyniHata) { konuYanlis = k; break; } }
    var basari = (dg + yn) >= 5 ? dg / (dg + yn) : null;
    if ((basari != null && basari < S.araTekrarBasari) || konuYanlis) return { basari: basari, konu: konuYanlis, yanlis: yn };
    return null;
  }

  /* ---------- adım ilerletme ---------- */
  function adimBitti(d, elle) {
    var a = d.plan[d.i]; if (!a) return;
    d.biten.push(d.i);
    var ara = araTekrarGerekli(d, a);
    if (ara) {
      d.araEklendi[a.ekran] = 1;
      var neden = ara.konu ? ("Bu adımda " + konuAdi(ara.konu) + " konusunda üst üste hata oldu; yalnız yanlışlara bakalım.")
                           : ("Bu adımda başarı %" + Math.round(ara.basari * 100) + " kaldı; yalnız " + ara.yanlis + " yanlışa kısaca dönelim.");
      var yer = Math.min(d.plan.length, d.i + 2);   /* hemen değil: araya bir adım girsin */
      d.plan.splice(yer, 0, { ekran: "hata", dk: 5, neden: neden, ara: true });
    }
    d.i++;
    d.bekliyor = false;
    d.basSnap = snap();
    if (d.i >= d.plan.length) { d.bitti = true; d.aktif = false; }
    else d.basSn = sureSn(d.plan[d.i]);
    yaz(d);
    gecisGoster(d, a, ara, elle);
  }
  function konuAdi(k) { try { if (global.DHInsights) return DHInsights.label(k); } catch (e) {} return String(k).replace(/_/g, " "); }

  /* ---------- görünüm ---------- */
  function htmlSinif(acik) { try { document.documentElement.classList.toggle("dh-koc-aktif", !!acik); } catch (e) {} }
  var serit = null, gecis = null, sayac = null;
  function stilEkle() {
    if (document.getElementById("dh-koc-modu-stil")) return;
    var s = document.createElement("style"); s.id = "dh-koc-modu-stil";
    s.textContent =
      ".dhk-serit{position:fixed;left:0;right:0;top:0;z-index:2147483000;background:" + RENK + ";color:#fff;font:600 14px/1.35 system-ui,sans-serif;padding:8px 10px 6px;box-shadow:0 2px 10px rgba(0,0,0,.35)}" +
      ".dhk-serit .r{display:flex;align-items:center;gap:8px;max-width:760px;margin:0 auto}" +
      ".dhk-serit .e{font-size:11px;letter-spacing:.06em;text-transform:uppercase;background:" + RENK2 + ";border-radius:99px;padding:2px 8px;white-space:nowrap}" +
      ".dhk-serit .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".dhk-serit .r{flex-wrap:wrap}" +
      "@media (max-width:560px){.dhk-serit .t{order:3;flex-basis:100%;white-space:normal;font-size:14px}.dhk-serit .e{margin-right:auto}}" +
      ".dhk-serit button,.dhk-serit a.b{min-height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;font:600 13px system-ui;padding:4px 10px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;white-space:nowrap}" +
      ".dhk-cub{display:flex;gap:6px;max-width:760px;margin:6px auto 0}" +
      ".dhk-cub i{flex:1;height:5px;border-radius:99px;background:rgba(255,255,255,.22);overflow:hidden;display:block}" +
      ".dhk-cub i b{display:block;height:100%;background:#8CE99A}" +
      ".dhk-cub i.ara b{background:#FFD43B}" +
      "html.dh-koc-aktif body{padding-top:var(--dhk-ust,62px)!important}" +
      "html.dh-koc-aktif .dh-primary-nav,html.dh-koc-aktif .dh-app-nav{background:" + RENK + "!important;border-color:" + RENK2 + "!important}" +
      "html.dh-koc-aktif .dh-primary-nav a,html.dh-koc-aktif .dh-app-nav a{color:#E7ECFF!important}" +
      ".dhk-gecis{position:fixed;inset:0;z-index:2147483001;background:rgba(10,16,40,.72);display:grid;place-items:center;padding:16px}" +
      ".dhk-gecis .k{max-width:420px;width:100%;background:" + RENK + ";color:#fff;border-radius:18px;padding:18px;font:16px/1.5 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.4)}" +
      ".dhk-gecis .av{width:48px;height:48px;border-radius:50%;background:#E7ECFF;color:" + RENK + ";display:grid;place-items:center;font-weight:800;font-size:20px}" +
      ".dhk-gecis .bt{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}" +
      ".dhk-gecis button{flex:1;min-height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.55);background:transparent;color:#fff;font:700 15px system-ui;cursor:pointer}" +
      ".dhk-gecis button.ana{background:#fff;color:" + RENK + ";border-color:#fff}" +
      "@media (prefers-reduced-motion:no-preference){.dhk-gecis .k{animation:dhkGel .32s cubic-bezier(.2,0,0,1)}@keyframes dhkGel{from{transform:translateY(16px) scale(.97);opacity:0}to{transform:none;opacity:1}}}";
    document.head.appendChild(s);
  }
  function kaldir() { if (serit) { serit.remove(); serit = null; } }
  function seritCiz(d) {
    stilEkle();
    if (!serit) { serit = document.createElement("div"); serit.className = "dhk-serit"; serit.setAttribute("role", "region"); serit.setAttribute("aria-label", "Koç modu"); document.body.appendChild(serit); }
    var a = d.plan[d.i], burada = a && ekranSayfa(a) === sayfa();
    var cub = d.plan.map(function (x, j) {
      var oran = d.biten.indexOf(j) >= 0 ? 100 : j === d.i ? Math.min(100, Math.round(sureSn(x) / (x.dk * 48) * 100)) : 0;
      return '<i class="' + (x.ara ? "ara" : "") + '" title="' + (ekran(x) || {}).ad + '"><b style="width:' + oran + '%"></b></i>';
    }).join("");
    var metin, dugmeler;
    if (d.bitti) { metin = "Bugünün planı tamam!"; dugmeler = '<a class="b" href="./koc-paneli.html">Panel</a><button type="button" data-k="cik">Kapat</button>'; }
    else if (burada) {
      var dk = Math.floor(sureSn(a) / 60);
      metin = "Adım " + (d.i + 1) + "/" + d.plan.length + " · " + ekran(a).ad + " · " + dk + "/" + a.dk + " dk" + (a.ara ? " · ara tekrar" : "");
      dugmeler = (global.DHProviders && DHProviders.chat && !a.ara ? '<button type="button" data-k="biliyorum">Bunu biliyorum</button>' : '') + '<button type="button" data-k="bitti">Adımı bitirdim</button><button type="button" data-k="cik">Koçtan çık</button>';
    } else {
      metin = "Koç beklemede · sıradaki: " + (a ? ekran(a).ad : "-");
      dugmeler = '<button type="button" data-k="devam">Devam et</button><button type="button" data-k="cik">Koçtan çık</button>';
    }
    serit.innerHTML = '<div class="r"><span class="e">Koç modu</span><span class="t">' + metin + '</span>' + dugmeler + '</div><div class="dhk-cub" aria-hidden="true">' + cub + '</div>';
    serit.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () {
      var k = b.getAttribute("data-k"), dd = oku(); if (!dd) return;
      if (k === "cik") cik();
      else if (k === "devam") devam();
      else if (k === "bitti") adimBitti(dd, true);
      else if (k === "biliyorum") yoklama(dd);
    }; });
    htmlSinif(true);
    try { document.documentElement.style.setProperty("--dhk-ust", (serit.offsetHeight + 4) + "px"); } catch (e) {}
  }

  function seslendir(metin) {
    try {
      if (!global.speechSynthesis) return;
      var u = new SpeechSynthesisUtterance(metin); u.lang = "tr-TR"; u.rate = 1; u.pitch = 1;   /* Android: perde/hız 1 (gecikme olmasın) */
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }
  function gecisGoster(d, onceki, ara, elle) {
    stilEkle(); if (gecis) gecis.remove(); clearInterval(sayac);
    var sonraki = d.plan[d.i];
    gecis = document.createElement("div"); gecis.className = "dhk-gecis"; gecis.setAttribute("role", "dialog"); gecis.setAttribute("aria-label", "Deniz: sıradaki adım");
    var baslik = ((ekran(onceki) || {}).ad || "Adım") + " bitti";
    var govde;
    if (!sonraki) govde = "Bugünün planı tamam. Harika iş çıkardın! İstersen panelde haftana bakalım.";
    else govde = (ara ? "Bir ara tekrar ekledim. " : "") + "Şimdi " + sonraki.dk + " dakika " + (ekran(sonraki) || {}).ad.toLowerCase().replace("deniz'le", "Deniz'le") + ". " + (sonraki.neden || "");
    gecis.innerHTML = '<div class="k"><div style="display:flex;gap:12px;align-items:center"><div class="av" aria-hidden="true">D</div><div><strong>' + baslik + '</strong><br><span style="opacity:.85;font-size:14px">Deniz</span></div></div>' +
      '<p style="margin:12px 0 0">' + govde + '</p>' +
      (sonraki ? '<p style="margin:8px 0 0;font-size:14px;opacity:.85" aria-live="polite"><span data-s>5</span> sn sonra açıyorum…</p>' : "") +
      '<div class="bt">' + (sonraki ? '<button type="button" data-k="bekle">Bekle</button><button type="button" data-k="atla">Atla</button><button type="button" class="ana" data-k="git">Şimdi aç</button>'
                                    : '<button type="button" data-k="kapat">Kapat</button><button type="button" class="ana" data-k="panel">Panel</button>') + '</div></div>';
    document.body.appendChild(gecis);
    seslendir(govde);
    function git() { clearInterval(sayac); var dd = oku(); var a = dd && dd.plan[dd.i]; if (a) location.href = "./" + ekran(a).url; }
    gecis.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () {
      var k = b.getAttribute("data-k");
      if (k === "bekle") { clearInterval(sayac); var s = gecis.querySelector("[data-s]"); if (s) s.parentNode.textContent = "Hazır olunca \"Şimdi aç\"a dokun."; }
      else if (k === "git") git();
      else if (k === "atla") { clearInterval(sayac); var dd = oku(); if (dd && dd.plan[dd.i]) { dd.atlanan.push(dd.i); dd.i++; if (dd.i >= dd.plan.length) { dd.bitti = true; dd.aktif = false; } dd.basSnap = snap(); if (!dd.bitti) dd.basSn = sureSn(dd.plan[dd.i]); yaz(dd); gecis.remove(); gecis = null; if (dd.bitti) { seritCiz(dd); gecisGoster(dd, onceki, null, true); } else gecisGoster(dd, dd.plan[dd.i - 1], null, true); } }
      else if (k === "kapat") { gecis.remove(); gecis = null; cik(); }
      else if (k === "panel") location.href = "./koc-paneli.html";
    }; });
    if (sonraki) { var n = 5; sayac = setInterval(function () { n--; var s = gecis && gecis.querySelector("[data-s]"); if (s) s.textContent = String(n); if (n <= 0) git(); }, 1000); }
    seritCiz(d);
  }

  /* ---------- "Bunu biliyorum": 3 soruluk hızlı yoklama ----------
     Sorular adımın konusundan (beceri + varsa kişisel hedef/zayıf konu) yapay zekâyla üretilir; KOD denetler:
     tam 3 soru, her birinde 3-4 seçenek, doğru cevap geçerli bir seçenek, seçenekler birbirinden farklı.
     3/3 doğruysa adım "yoklamayı geçti" diye atlanır; değilse adıma devam edilir (kısa not düşülür). */
  var KONU_ACIKLAMA = { tekrar: "cümle çevirisi ve cümle kurma", kelime: "kelime anlamı", konusma: "günlük konuşma kalıpları",
    dinleme: "dinlediğini anlama (kısa yazılı diyalog)", ders: "dilbilgisi", okuma: "kısa paragraf anlama", hata: "sık yapılan hatalar" };
  function soruDenetle(c) {
    if (!c || !Array.isArray(c.sorular) || c.sorular.length !== 3) return false;
    return c.sorular.every(function (q) {
      if (!q || typeof q.soru !== "string" || q.soru.length < 5 || !Array.isArray(q.secenekler)) return false;
      var sec = q.secenekler.map(function (x) { return String(x).trim(); });
      if (sec.length < 3 || sec.length > 4 || sec.some(function (x) { return !x; })) return false;
      if (new Set(sec.map(function (x) { return x.toLowerCase(); })).size !== sec.length) return false;
      var d = +q.dogru; return d >= 0 && d < sec.length && d === Math.floor(d);
    });
  }
  async function yoklama(d) {
    var a = d.plan[d.i]; if (!a) return;
    stilEkle(); if (gecis) gecis.remove();
    gecis = document.createElement("div"); gecis.className = "dhk-gecis"; gecis.setAttribute("role", "dialog"); gecis.setAttribute("aria-label", "Hızlı yoklama");
    gecis.innerHTML = '<div class="k"><strong>Hızlı yoklama</strong><p style="margin:8px 0 0">3 soru hazırlıyorum; üçünü de bilirsen bu adımı atlarız.</p></div>';
    document.body.appendChild(gecis);
    var seviye = null, konu = KONU_ACIKLAMA[a.ekran] || "genel İngilizce";
    try { var h = JSON.parse(localStorage.getItem("dh-koc-hesap-v1") || "null"); seviye = h && h.profil && h.profil.seviye; var hk = h && (h.kisisel || [])[0]; var zk = h && (h.hataKonulari || [])[0];
      if (a.ekran === "ders" || a.ekran === "hata") konu += (hk ? " — özellikle " + hk.konu : zk ? " — özellikle " + zk.konu : ""); } catch (e) {}
    var c = null;
    for (var t = 0; t < 2 && !c; t++) {
      try {
        var cevap = await Promise.race([DHProviders.chat([{ role: "user", content:
          "İngilizce öğrenen Türk bir öğrenci için " + (seviye || "B1") + " seviyesinde, konu: " + konu + ". Tam 3 çoktan seçmeli soru yaz. " +
          "Soru metni Türkçe olabilir, seçenekler İngilizce. Her soruda 4 seçenek, tek doğru. Yalnız JSON: {\"sorular\":[{\"soru\":\"...\",\"secenekler\":[\"...\",\"...\",\"...\",\"...\"],\"dogru\":0,\"aciklama\":\"kısa Türkçe\"}]}" }],
          { json: true, prefer: ["groq", "gemini"], slowMs: 12000, title: "Koç yoklama" }), new Promise(function (_, r) { setTimeout(function () { r("slow"); }, 14000); })]);
        var j = typeof cevap === "string" ? JSON.parse(cevap.slice(cevap.indexOf("{"), cevap.lastIndexOf("}") + 1)) : cevap;
        if (soruDenetle(j)) c = j;
      } catch (e) {}
    }
    if (!gecis) return;
    if (!c) { gecis.querySelector(".k").innerHTML = '<strong>Yoklama hazırlanamadı</strong><p>Yapay zekâya şu an ulaşılamadı. Adıma devam edebilir ya da "Adımı bitirdim" diyebilirsin.</p><div class="bt"><button type="button" class="ana" data-k="tamam">Tamam</button></div>'; gecis.querySelector("[data-k=tamam]").onclick = function () { gecis.remove(); gecis = null; }; return; }
    var i = 0, dogru = 0, k = gecis.querySelector(".k");
    function goster() {
      var q = c.sorular[i];
      k.innerHTML = '<strong>Soru ' + (i + 1) + '/3</strong><p style="margin:8px 0">' + esc(q.soru) + '</p><div style="display:flex;flex-direction:column;gap:8px">' +
        q.secenekler.map(function (x, n) { return '<button type="button" data-n="' + n + '" style="min-height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.55);background:transparent;color:#fff;font:600 15px system-ui;text-align:left;padding:8px 12px;cursor:pointer">' + esc(x) + '</button>'; }).join("") + '</div>';
      k.querySelectorAll("[data-n]").forEach(function (b) { b.onclick = function () {
        var n = +b.getAttribute("data-n"), ok = n === +q.dogru; if (ok) dogru++;
        k.querySelectorAll("[data-n]").forEach(function (x) { x.disabled = true; if (+x.getAttribute("data-n") === +q.dogru) x.style.background = "#2E9E77"; });
        if (!ok) b.style.background = "#B3392E";
        var ac = document.createElement("p"); ac.style.cssText = "margin:10px 0 0;font-size:14px;opacity:.9"; ac.textContent = (ok ? "Doğru. " : "Doğrusu işaretli. ") + (q.aciklama || ""); k.appendChild(ac);
        var bt = document.createElement("div"); bt.className = "bt"; bt.innerHTML = '<button type="button" class="ana">' + (i < 2 ? "Sonraki" : "Sonucu gör") + '</button>'; k.appendChild(bt);
        bt.querySelector("button").onclick = function () { i++; if (i < 3) goster(); else sonuc(); };
      }; });
    }
    function sonuc() {
      try { global.DHOlay && DHOlay.kaydet("yoklama", { ekran: a.ekran, dogru: dogru }); } catch (e) {}
      if (dogru === 3) {
        k.innerHTML = '<strong>3/3, harika!</strong><p>Bu adımı atlıyoruz.</p>';
        try { global.DHKocBeyin && DHKocBeyin.notEkle({ metin: (EKRAN[a.ekran] || {}).ad + " adımında hızlı yoklamayı 3/3 geçti, adım atlandı.", kaynak: "veri" }); } catch (e) {}
        setTimeout(function () { var dd = oku(); if (!dd) return; dd.atlanan.push(dd.i); dd.i++; if (dd.i >= dd.plan.length) { dd.bitti = true; dd.aktif = false; } dd.basSnap = snap(); if (!dd.bitti) dd.basSn = sureSn(dd.plan[dd.i]); yaz(dd); gecis.remove(); gecis = null; gecisGoster(dd, a, null, true); }, 1200);
      } else {
        k.innerHTML = '<strong>' + dogru + '/3</strong><p>Bu konuyu biraz daha çalışalım; adıma devam ediyoruz.</p><div class="bt"><button type="button" class="ana">Devam</button></div>';
        k.querySelector("button").onclick = function () { gecis.remove(); gecis = null; };
      }
    }
    goster();
  }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- döngü ---------- */
  function tik() {
    var d = oku();
    if (!d || !d.aktif) { if (d && d.bitti && d.gun === gunAnahtari() && serit) seritCiz(d); else { kaldir(); htmlSinif(false); } return; }
    if (d.gun !== gunAnahtari()) { d.aktif = false; yaz(d); kaldir(); htmlSinif(false); return; }   /* yeni gün: dünkü mod kapanır */
    if (gecis) return;
    var a = d.plan[d.i];
    if (a && ekranSayfa(a) === sayfa() && sureSn(a) >= a.dk * 48) { adimBitti(d, false); return; }
    seritCiz(d);
  }
  function kur() {
    if (!document.body) { document.addEventListener("DOMContentLoaded", kur); return; }
    setTimeout(tik, 600);
    setInterval(tik, 5000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") tik(); });
    /* Ekranların kendi "bitti" sinyali (tekrar bitti, ders tamam, konuşma bitti...).
       bos: ekranda yapılacak bir şey kalmadı → adım hemen biter; değilse adım süresinin en az %30'u gerekir. */
    global.addEventListener("dh-ekran-bitti", function (e) {
      var d = oku(); if (!d || !d.aktif || gecis || d.gun !== gunAnahtari()) return;
      var a = d.plan[d.i]; if (!a || ekranSayfa(a) !== sayfa()) return;
      var bos = !!(e && e.detail && e.detail.bos);
      if (bos || sureSn(a) >= a.dk * 18) setTimeout(function () { var dd = oku(); if (dd && dd.aktif && dd.i === d.i && !gecis) adimBitti(dd, false); }, 1500);
    });
  }
  kur();

  global.DHKocModu = { baslat: baslat, cik: cik, durum: durum, devam: devam, _adimBitti: function () { var d = oku(); if (d) adimBitti(d, true); }, _tik: tik };
})(window);
