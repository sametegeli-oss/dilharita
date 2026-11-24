/* dh-deniz-telegram.js — Deniz'i Telegram'a bağlar (worker-deniz.js ile konuşur)
   - Bağlı değilse hiçbir şey göndermez (yalnız panel bağlantı düğmesi için arayüz verir).
   - Bağlıysa saatte en çok bir kez kısa durum özeti gönderir: bugünkü dakika, plan, koç bağlamı.
     Worker bu özetle "Deniz arar" hatırlatmasını ve Telegram sohbetini yapar.
   - Telegram'daki yazışmalar dönüşte alınır, "dh-deniz-tg-gecmis-v1"e eklenir (panelde görünür).
   Anahtar: hesaba özel rastgele metin; buluta (koc/telegram) yazılır ki diğer cihazlar da kullansın. */
(function (global) {
  "use strict";
  var K = { anahtar: "dh-deniz-tg-anahtar", worker: "dh-deniz-worker", son: "dh-deniz-tg-son", ayar: "dh-deniz-tg-ayar-v1", gecmis: "dh-deniz-tg-gecmis-v1", bagli: "dh-deniz-tg-bagli" };
  var VARSAYILAN_WORKER = "https://dilharita-deniz.sametegeli.workers.dev";   /* Cloudflare Worker (24 Kasım kuruldu) */
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function js(k, d) { try { var v = JSON.parse(ls(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function gunAnahtari(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function worker() { return String(ls(K.worker) || VARSAYILAN_WORKER || "").replace(/\/+$/, ""); }
  function rastgele(n, harf) {
    var a = harf || "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", o = "", b = new Uint8Array(n);
    (global.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach(function (_, i) { b[i] = Math.random() * 256; });
    for (var i = 0; i < n; i++) o += a[b[i] % a.length];
    return o;
  }
  function bulut() { var c = global.DHCloudSync; return c && c.koc && c.koc.hazir() ? c.koc : null; }
  async function anahtar(olustur) {
    var a = ls(K.anahtar);
    if (!a && bulut()) { try { var d = await bulut().oku("koc", "telegram"); if (d && d.anahtar) { a = d.anahtar; ls(K.anahtar, a); } } catch (e) {} }
    if (!a && olustur) {
      a = rastgele(32); ls(K.anahtar, a);
      try { if (bulut()) await bulut().yaz("koc", "telegram", { anahtar: a, t: Date.now() }, false); } catch (e) {}
    }
    return a;
  }
  async function istek(yol, govde) {
    var w = worker(); if (!w) throw new Error("Worker adresi yok");
    var r = await fetch(w + yol, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) });
    if (!r.ok && r.status !== 200) throw new Error("Worker " + r.status);
    return r.json();
  }
  function ayar() { return Object.assign({ saat: 20, acik: true, ozet: true }, js(K.ayar, {}) || {}); }

  /* bugün çalışılan dakika (dh-olay etkin süre) */
  function bugunDk() {
    try { var g = global.DHOlay && DHOlay.gunler(1)[0]; if (!g) return 0; var s = 0; for (var b in g.s) s += +g.s[b] || 0; return Math.round(s / 60); } catch (e) { return 0; }
  }
  function durumTopla() {
    var EK = (global.DHKocDeniz && DHKocDeniz.EKRANLAR) || { tekrar: { ad: "Cümle tekrarı" }, kelime: { ad: "Kelime" }, konusma: { ad: "Deniz'le konuşma" }, dinleme: { ad: "Video ile dinleme" }, ders: { ad: "Dilbilgisi dersi" }, okuma: { ad: "Okuma" }, hata: { ad: "Hata defteri" } };
    var g = js("dh-koc-gun-" + gunAnahtari(), null);
    var plan = g && g.plan ? g.plan.map(function (a) { return { ekran: a.ekran, ad: (EK[a.ekran] || {}).ad || a.ekran, dk: a.dk, neden: a.neden }; }) : [];
    var baglam = ""; try { if (global.DHKocBeyin && DHKocBeyin.kisaBaglam) baglam = DHKocBeyin.kisaBaglam(); } catch (e) {}
    return { gun: gunAnahtari(), dk: bugunDk(), plan: plan, ozet: g && g.ozet || "", baglam: baglam };
  }
  /* Telegram'dan gelen bugünkü istekler ("yorgunum, kısa tut", "bugün in/of çalışalım") → koçun "bugün" ayarı.
     Koç beyni bu sayfada yoksa bekletilir, yüklü bir sayfada uygulanır. */
  function istekCikar(metin) {
    var m = String(metin || "").toLocaleLowerCase("tr"), o = {};
    if (/(yorgun|kısa tut|kısa olsun|az vakt|vaktim az|zamanım az|15 ?d)/.test(m)) o.dk = 15;
    else if (/(uzun tut|bol vakt|vaktim çok|zamanım çok|45 ?d|bir saat)/.test(m)) o.dk = 45;
    var k = m.match(/bugün\s+(.{2,60}?)\s+(çalışalım|çalışmak istiyorum|üzerinde dur|pekiştir)/);
    if (k) o.metin = k[1];
    return (o.dk || o.metin) ? o : null;
  }
  var K_ISTEK = "dh-deniz-tg-istek";
  async function istekUygula() {
    var i = js(K_ISTEK, null); if (!i || i.gun !== gunAnahtari()) { if (i) ls(K_ISTEK, null); return; }
    var B = global.DHKocBeyin; if (!B || !B.bugunYaz) return;
    try {
      await B.bugunYaz(i.o); ls(K_ISTEK, null);
      ls("dh-koc-gun-" + gunAnahtari(), null);   /* bugünkü plan yeni isteğe göre yeniden hazırlansın */
      try { global.dispatchEvent(new CustomEvent("dh-koc-istek", { detail: i.o })); } catch (x) {}
    } catch (e) {}
  }
  function gecmisEkle(l) {
    if (!l || !l.length) return;
    var bugun = gunAnahtari(), birlesik = null;
    l.forEach(function (x) { if (x && x.t && gunAnahtari(new Date(x.t)) === bugun) { var o = istekCikar(x.sen); if (o) birlesik = Object.assign(birlesik || {}, o); } });
    if (birlesik) { var eski = js(K_ISTEK, null); ls(K_ISTEK, JSON.stringify({ gun: bugun, o: Object.assign(eski && eski.gun === bugun ? eski.o : {}, birlesik) })); istekUygula(); }
    var e = js(K.gecmis, []) || []; e = e.concat(l).slice(-60); ls(K.gecmis, JSON.stringify(e));
    try { global.dispatchEvent(new CustomEvent("dh-deniz-telegram", { detail: { yeni: l.length } })); } catch (x) {}
  }

  /* bağlıysa durum gönder (saatte bir; zorla=true ile hemen) */
  async function durumGonder(zorla) {
    if (!worker()) return null;
    var a = ls(K.anahtar); if (!a) a = await anahtar(false); if (!a) return null;
    var son = +ls(K.son) || 0;
    if (!zorla && Date.now() - son < 3600e3) return null;
    ls(K.son, String(Date.now()));
    try {
      var r = await istek("/durum", { anahtar: a, durum: durumTopla(), ayar: js(K.ayar, null) ? ayar() : undefined });
      ls(K.bagli, r && r.bagli ? "1" : "0");
      if (r && r.ayar && !js(K.ayar, null)) ls(K.ayar, JSON.stringify(r.ayar));
      gecmisEkle(r && r.gelen);
      return r;
    } catch (e) { return null; }
  }

  /* panelden: bağlantı linki üret */
  async function baglantiLinki() {
    var a = await anahtar(true), kod = rastgele(8, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
    var r = await istek("/baglan", { anahtar: a, kod: kod });
    if (r && r.hata === "bot_anahtari_yok") throw new Error("Deniz'in sunucusuna Telegram bot anahtarı henüz girilmedi (Cloudflare → dilharita-deniz → Ayarlar → TELEGRAM_TOKEN)");
    if (!r || !r.ok || !r.bot) throw new Error("Bot bulunamadı");
    return { url: "https://t.me/" + r.bot + "?start=" + kod, bot: r.bot, kod: kod };
  }
  async function ayarYaz(o) { ls(K.ayar, JSON.stringify(Object.assign(ayar(), o || {}))); return durumGonder(true); }
  async function ayril() {
    var a = ls(K.anahtar); if (!a) return;
    try { await istek("/ayril", { anahtar: a }); } catch (e) {}
    ls(K.bagli, "0"); ls(K.ayar, null);
  }
  async function gonder(metin, tur, dugme) {
    if (!worker() || ls(K.bagli) !== "1") return false;
    var a = ls(K.anahtar); if (!a) return false;
    try { var r = await istek("/mesaj", { anahtar: a, metin: String(metin).slice(0, 3000), tur: tur || "bilgi", dugme: dugme }); return !!(r && r.ok); } catch (e) { return false; }
  }
  /* Konuşma bittikten sonra: "bu konuşmadan 3 not" */
  function oturumOzeti(hatalar, mod) {
    if (ls(K.bagli) !== "1" || ayar().ozet === false) return;
    var l = (hatalar || []).filter(function (e) { return e && e.wrong && e.right; }).slice(0, 3);
    if (!l.length) return;
    var m = (mod || "Konuşma") + " bitti. Bu konuşmadan " + l.length + " not:\n" + l.map(function (e, i) {
      return (i + 1) + ". \"" + String(e.wrong).slice(0, 80) + "\" yerine \"" + String(e.right).slice(0, 80) + "\"" + (e.why || e.exp ? " — " + String(e.why || e.exp).slice(0, 120) : "");
    }).join("\n") + "\nYarın bunlarla başlayalım.";
    gonder(m, "ozet");
  }

  global.DHDenizTelegram = {
    durumGonder: durumGonder, baglantiLinki: baglantiLinki, ayarYaz: ayarYaz, ayar: ayar, ayril: ayril, gonder: gonder, oturumOzeti: oturumOzeti,
    bagli: function () { return ls(K.bagli) === "1"; }, kurulu: function () { return !!worker(); },
    worker: function (u) { if (u !== undefined) ls(K.worker, u ? String(u).trim() : null); return worker(); },
    gecmis: function () { return js(K.gecmis, []) || []; }, _istekCikar: istekCikar
  };

  /* açılışta ve sayfa görünür olunca (saatte en çok bir kez) */
  setTimeout(function () { istekUygula(); durumGonder(false); }, 8000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") durumGonder(false); });
})(window);
