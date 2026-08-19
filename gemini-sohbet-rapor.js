/* gemini-sohbet-rapor.js — 💎 GEMINI'DE DEVAM EDEN SOHBETİN BAŞARI RAPORU
   ====================================================================
   İSTEK
   "Teacher ile çalışırken konuşmayı Gemini'de devam ettirdiğimizde, o
    sohbetten hedeflenen başarı sağlanmış mı — onun cevabı bir rapor
    olarak istenmeli, o rapor Gemini dönüşü olarak kaydedilmeli, program
    ona göre hareket etmeli."

   ── SORUN ──
   💎 düğmesi (chat-core.js > continueInGemini) tek yönlüydü: konuşmayı
   panoya kopyalayıp Gemini'yi açıyordu, oradan hiçbir şey geri gelmiyordu.
   Gemini'de yapılan çalışma uygulamada hiç iz bırakmıyordu — ne puan, ne
   hata defteri, ne koç planı.

   ── ÇÖZÜM ──
   1) Gemini'ye giden prompta bir SÖZLEŞME eklenir (chat-core.js yapar):
      "Öğrenci 'RAPOR' yazınca SADECE şu JSON'u döndür."
   2) Öğrenci Gemini'de çalışmasını bitirip "RAPOR" yazar, çıkan JSON'u
      kopyalar.
   3) Buradaki "📊 Gemini raporu" düğmesine basıp yapıştırır.
      (gemini-bridge.js'in DHGemini.ask köprüsü — hata-defteri.html'de
      zaten çalışan, kanıtlanmış desen.)
   4) Rapor ayrıştırılır ve UYGULAMA VERİSİNE İŞLENİR:
        · dh-sohbet-puan-v1  → puan, uygulama içi sohbetlerle aynı depo,
                               böylece rapor.html ve koç aynı yerden okur
        · LearningErrorDB    → Gemini'nin bulduğu hatalar hata defterine
        · dh-study-tracker-v1→ konuşma çalışması olarak günlük sayaca
        · dh-gemini-rapor-v1 → raporun tamamı (son 30 kayıt)

   Gerekli: gemini-bridge.js (DHGemini). Yoksa düğme kurulmaz.
   ==================================================================== */
(function (global) {
  "use strict";
  if (global.DHGeminiRapor) return;

  var DEPO_PUAN   = "dh-sohbet-puan-v1";     /* dh-sohbet-puan.js ile ORTAK */
  var DEPO_RAPOR  = "dh-gemini-rapor-v1";
  var ENFAZLA     = 30;

  function gunISO(){ return new Date().toISOString().slice(0, 10); }
  function sayfa(){ return (location.pathname.split("/").pop() || "chat.html"); }
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function sayi(v, enaz, encok){
    var n = Number(v);
    if (!isFinite(n)) return null;
    return Math.max(enaz, Math.min(encok, Math.round(n)));
  }

  /* ═══════════════ GEMINI'YE GİDECEK SÖZLEŞME ═══════════════
     chat-core.js bu metni promptun sonuna ekler. Tek yerde dursun ki
     şema ile ayrıştırıcı birbirinden kopmasın. */
  var SEMA = [
    "{",
    '  "basari": 0-100 arası tam sayı — bu oturumda hedeflenen kazanım ne kadar sağlandı,',
    '  "hedefUlasildi": true veya false,',
    '  "ozet": "2-3 cümle Türkçe genel değerlendirme",',
    '  "guclu": ["öğrencinin iyi yaptığı şeyler, Türkçe, en fazla 3 madde"],',
    '  "zayif": ["geliştirmesi gereken şeyler, Türkçe, en fazla 3 madde"],',
    '  "kullanilanKaliplar": ["öğrencinin gerçekten ürettiği İngilizce kalıplar"],',
    '  "hatalar": [{"yanlis":"öğrencinin yazdığı İngilizce cümle","dogru":"doğrusu","kural":"kısa Türkçe açıklama"}],',
    '  "sonraki": ["bir sonraki çalışmada odaklanılacak somut madde, Türkçe"]',
    "}"
  ].join("\n");

  function sozlesme() {
    return [
      "",
      "──────────────────────────────────────────",
      "RAPOR SÖZLEŞMESİ (çok önemli):",
      "Ben sana tek başına \"RAPOR\" yazdığımda, o ana kadarki çalışmamızı",
      "değerlendir ve SADECE aşağıdaki JSON'u döndür. JSON'dan önce veya",
      "sonra tek bir kelime bile yazma, markdown kod bloğu kullanma.",
      "",
      SEMA,
      "",
      "\"basari\" puanını verirken şuna bak: bu oturumda hedeflenen kalıpları",
      "öğrenci GERÇEKTEN kendi cümlesinde üretebildi mi? Sadece anlaması ya da",
      "tekrar etmesi yetmez. Hata bulmakta cömert, puan vermekte dürüst ol.",
      "──────────────────────────────────────────"
    ].join("\n");
  }

  /* ═══════════════ AYRIŞTIRMA ═══════════════ */
  function ayristir(text) {
    var d = null;
    try {
      d = (global.DHGemini && DHGemini.parsers && DHGemini.parsers.json)
        ? DHGemini.parsers.json(text) : null;
    } catch (e) { d = null; }
    if (!d) {
      /* köprünün ayrıştırıcısı yoksa/başarısızsa ilk { ... } bloğunu dene */
      var m = String(text || "").match(/\{[\s\S]*\}/);
      if (m) { try { d = JSON.parse(m[0]); } catch (e2) { d = null; } }
    }
    if (!d || typeof d !== "object") {
      throw new Error("JSON okunamadı. Gemini'ye tek başına RAPOR yazıp çıkan JSON'un tamamını kopyala.");
    }
    if (d.basari == null && !d.ozet) {
      throw new Error("Cevapta \"basari\" ya da \"ozet\" alanı yok — eksik yapıştırılmış olabilir.");
    }
    /* Gemini bazen JSON içinde boolean yerine "true"/"evet" metni
       döndürüyor. Anlamı aynı olan bu değerleri gerçek boolean'a çevir;
       alan hiç yoksa yüksek başarı puanını tamamlanma kanıtı say. */
    var hu=d.hedefUlasildi;
    if(typeof hu==="string"){
      var hs=hu.toLocaleLowerCase("tr").trim();
      if(/^(true|evet|yes|ok|okey|tamam|tamamlandı)$/.test(hs)) hu=true;
      else if(/^(false|hayır|hayir|no|tamamlanmadı|tamamlanmadi)$/.test(hs)) hu=false;
    }else if(typeof hu==="number") hu=hu>0;
    if(typeof hu!=="boolean") hu=(sayi(d.basari,0,100)||0)>=70;
    d.hedefUlasildi=hu;
    return d;
  }

  /* ═══════════════ KAYIT ═══════════════ */
  function puaniKaydet(d) {
    try {
      var l = JSON.parse(localStorage.getItem(DEPO_PUAN) || "[]") || [];
      var kaliplar = Array.isArray(d.kullanilanKaliplar) ? d.kullanilanKaliplar.length : 0;
      l.push({
        gun: gunISO(),
        senaryo: sayfa(),
        toplam: sayi(d.basari, 0, 100),
        tur: null,
        cumle: kaliplar ? (kaliplar + "/" + kaliplar) : null,
        gorev: null,
        dilbilgisi: Array.isArray(d.hatalar) ? Math.max(0, 100 - d.hatalar.length * 10) : null,
        kaynak: "gemini",                    /* uygulama içi puanla karışmasın */
        ts: Date.now()
      });
      if (l.length > 50) l = l.slice(l.length - 50);
      localStorage.setItem(DEPO_PUAN, JSON.stringify(l));
    } catch (e) {}
  }

  function raporuKaydet(d) {
    try {
      var l = JSON.parse(localStorage.getItem(DEPO_RAPOR) || "[]") || [];
      l.push({ gun: gunISO(), senaryo: sayfa(), ts: Date.now(), rapor: d });
      if (l.length > ENFAZLA) l = l.slice(l.length - ENFAZLA);
      localStorage.setItem(DEPO_RAPOR, JSON.stringify(l));
    } catch (e) {}
  }

  function hatalariIsle(d) {
    var h = Array.isArray(d.hatalar) ? d.hatalar : [];
    if (!h.length || !global.LearningErrorDB || !LearningErrorDB.add) return 0;
    var n = 0;
    h.forEach(function (x) {
      if (!x || !x.dogru) return;
      try {
        LearningErrorDB.add({
          target: String(x.dogru || ""),
          answer: String(x.yanlis || ""),
          sentenceTR: String(x.kural || ""),
          source: "gemini-sohbet",
          grade: "hard"
        });
        n++;
      } catch (e) {}
    });
    return n;
  }

  function sayacaYaz() {
    /* Gemini'de yapılan çalışma da günün emeğidir; koç "bugün hiç
       çalışmadın" demesin. coach-bubble.js'in sayacı kullanılır. */
    try {
      if (global.dhBumpDailyTracker) global.dhBumpDailyTracker("speaking");
      if (global.dhLogActivity) global.dhLogActivity("💎 Gemini sohbet raporu alındı", "correct");
    } catch (e) {}
  }

  function sohbetiTamamla(d) {
    /* "hedefUlasildi" Gemini'nin acik onayidir. Bu durumda rapor yalniz
       puan olmakla kalmaz; ekrandaki tum gorevleri ve koçun sohbet adimini
       uygulama ici Bitir akisi ile ayni kanitlarla kapatir. */
    if (!d || d.hedefUlasildi !== true) return false;
    try { if (global.DHChatTasks && DHChatTasks.completeAll) DHChatTasks.completeAll(); } catch (e) {}
    try {
      var g=new Date(), gun=g.getFullYear()+"-"+String(g.getMonth()+1).padStart(2,"0")+"-"+String(g.getDate()).padStart(2,"0");
      if(global.DHPlan){
        if(DHPlan.tamamlaTip) DHPlan.tamamlaTip("sohbet");
        if(DHPlan.etkinlikKaydet) DHPlan.etkinlikKaydet("speaking","gemini-"+gun+"-"+sayfa());
      }
      var k="dh-koc-steps-done-"+gun, set=JSON.parse(localStorage.getItem(k)||"{}")||{};
      set["chat.html"]=1; set[sayfa()]=1; localStorage.setItem(k,JSON.stringify(set));
      localStorage.setItem("dh-speaking-complete-"+gun,"1");
      try{if(new URLSearchParams(location.search).get("gunsonu")==="1")localStorage.setItem("dh-gunsonu-pratik-complete-"+gun,"1");}catch(e){}
      /* coach-bubble.js chatteacher ekranlarında yüklenmese bile konuşma
         kanıtını doğrudan günlük sayaca yaz. Tekrar aynı rapor yapıştırılırsa
         sayaç şişmesin; konuşma tamamlandıysa en az 1 olması yeterlidir. */
      var tk="dh-study-tracker-v1", tr=JSON.parse(localStorage.getItem(tk)||"{}")||{};
      if(!tr.days) tr.days={};
      if(!tr.days[gun]) tr.days[gun]={date:gun,lessons:0,minutes:0,sentences:0,videos:0,reviews:0,errors:0,speaking:0};
      tr.days[gun].speaking=Math.max(1,parseInt(tr.days[gun].speaking,10)||0);
      localStorage.setItem(tk,JSON.stringify(tr));
      global.dispatchEvent(new CustomEvent("dh:task-complete",{detail:{type:"sohbet",source:"gemini-report"}}));
      global.dispatchEvent(new CustomEvent("dh-gunsonu-tamamlandi",{detail:{type:"pratik",day:gun}}));
    } catch (e) {}
    return true;
  }

  /* Rapor yalnizca ozel Gemini penceresinden degil, kullanici tarafindan
     ana sohbet kutusuna yapistirildiginda da ayni tek akisla islensin. */
  function uygula(text) {
    var d = ayristir(text);
    puaniKaydet(d);
    raporuKaydet(d);
    sayacaYaz();
    var tamam = sohbetiTamamla(d);
    var n = hatalariIsle(d);
    goster(d, n);
    return { rapor: d, tamamlandi: tamam };
  }

  /* ═══════════════ GÖSTERİM ═══════════════ */
  function stil() {
    if (document.getElementById("dhgsr-css")) return;
    var s = document.createElement("style"); s.id = "dhgsr-css";
    s.textContent =
      ".dhgsr-ov{position:fixed;inset:0;z-index:2147483001;background:rgba(2,6,23,.8);display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto}"
    + ".dhgsr{width:100%;max-width:520px;margin:auto;background:#0b1a33;border:1px solid #7c3aed;border-radius:18px;padding:18px;color:#e8eef7;font-family:Nunito,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.55)}"
    + ".dhgsr h3{margin:0 0 2px;font-size:17px;font-weight:900}"
    + ".dhgsr .alt{font-size:12px;color:#9fb3d9;margin:0 0 14px}"
    + ".dhgsr-puan{text-align:center;margin-bottom:14px}"
    + ".dhgsr-puan b{font-size:44px;font-weight:900;line-height:1}"
    + ".dhgsr-puan span{font-size:17px;opacity:.6}"
    + ".dhgsr-rozet{display:inline-block;margin-top:7px;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:900}"
    + ".dhgsr-ok{background:#065f46;color:#6ee7b7}"
    + ".dhgsr-no{background:#7c2d12;color:#fdba74}"
    + ".dhgsr-sec{background:#071120;border:1px solid #1e3a5f;border-radius:12px;padding:12px;margin-bottom:9px}"
    + ".dhgsr-sec h4{margin:0 0 6px;font-size:13px;font-weight:900;color:#a78bfa}"
    + ".dhgsr-sec p{margin:0;font-size:13.5px;line-height:1.55;color:#cbd5e1}"
    + ".dhgsr-sec ul{margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:#cbd5e1}"
    + ".dhgsr-hata{background:#0b1830;border-left:3px solid #f87171;border-radius:8px;padding:8px 10px;margin-top:7px;font-size:12.5px;line-height:1.5}"
    + ".dhgsr-hata .y{color:#fca5a5;text-decoration:line-through}"
    + ".dhgsr-hata .d{color:#6ee7b7;font-weight:800}"
    + ".dhgsr-hata .k{color:#94a3b8;display:block;margin-top:3px}"
    + ".dhgsr-kap{background:#13294d;color:#e8eef7;border:0;border-radius:11px;padding:12px;width:100%;font-size:14px;font-weight:800;cursor:pointer;margin-top:6px}"
    + ".dhgsr-bilgi{font-size:11.5px;color:#64748b;text-align:center;margin-top:9px;line-height:1.5}";
    document.head.appendChild(s);
  }

  function liste(baslik, arr) {
    if (!Array.isArray(arr) || !arr.length) return "";
    return '<div class="dhgsr-sec"><h4>' + baslik + '</h4><ul>'
      + arr.slice(0, 5).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("")
      + '</ul></div>';
  }

  function goster(d, eklenenHata) {
    stil();
    var puan = sayi(d.basari, 0, 100);
    var renk = puan == null ? "#94a3b8" : puan >= 75 ? "#4ade80" : puan >= 50 ? "#fbbf24" : "#f87171";
    var ov = document.createElement("div"); ov.className = "dhgsr-ov";

    var html = '<div class="dhgsr"><h3>💎 Gemini Sohbet Raporu</h3>'
      + '<p class="alt">Gemini\'de yaptığın çalışma değerlendirildi ve uygulamaya işlendi.</p>';

    if (puan != null) {
      html += '<div class="dhgsr-puan"><b style="color:' + renk + '">' + puan + '</b><span>/100</span><br>'
        + '<span class="dhgsr-rozet ' + (d.hedefUlasildi ? "dhgsr-ok" : "dhgsr-no") + '">'
        + (d.hedefUlasildi ? "✓ Hedeflenen kazanım sağlandı" : "○ Hedef henüz tam sağlanmadı")
        + '</span></div>';
    }
    if (d.ozet) html += '<div class="dhgsr-sec"><h4>📋 Değerlendirme</h4><p>' + esc(d.ozet) + '</p></div>';
    html += liste("💪 İyi gidenler", d.guclu);
    html += liste("🎯 Geliştirilecekler", d.zayif);
    html += liste("🗣 Ürettiğin kalıplar", d.kullanilanKaliplar);

    var h = Array.isArray(d.hatalar) ? d.hatalar : [];
    if (h.length) {
      html += '<div class="dhgsr-sec"><h4>✏️ Düzeltmeler</h4>'
        + h.slice(0, 8).map(function (x) {
            return '<div class="dhgsr-hata"><span class="y">' + esc(x.yanlis || "") + '</span> → '
              + '<span class="d">' + esc(x.dogru || "") + '</span>'
              + (x.kural ? '<span class="k">' + esc(x.kural) + '</span>' : '') + '</div>';
          }).join("")
        + '</div>';
    }
    html += liste("➡️ Bir sonraki adım", d.sonraki);

    html += '<div class="dhgsr-bilgi">Puan ilerleme raporuna işlendi'
      + (eklenenHata ? (" · " + eklenenHata + " hata deftere eklendi") : "")
      + ' · günlük çalışma sayacına yazıldı.</div>';
    html += '<button type="button" class="dhgsr-kap">'
      + (d.hedefUlasildi ? "✓ Sohbet tamamlandı — ana sayfaya dön" : "Kapat")
      + '</button></div>';

    ov.innerHTML = html;
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) {
      if (e.target === ov) { ov.remove(); return; }
      if (e.target.classList && e.target.classList.contains("dhgsr-kap")) {
        ov.remove();
        if (d.hedefUlasildi) location.href = "./index.html";
      }
    });
    return ov;
  }

  /* ═══════════════ AKIŞ ═══════════════ */
  function iste() {
    if (!global.DHGemini || !DHGemini.ask) {
      alert("Gemini köprüsü yüklenmedi (gemini-bridge.js).");
      return;
    }
    DHGemini.ask({
      title: "💎 Gemini sohbet raporu",
      hint: "Gemini'de tek başına RAPOR yaz, çıkan JSON'un tamamını buraya yapıştır…",
      prompt: [
        "RAPOR",
        "",
        "(Gemini'deki sohbete yalnızca RAPOR yazman yeterli. Sözleşmeyi",
        "unuttuysa aşağıdaki şemayı ona yapıştır:)",
        "",
        SEMA
      ].join("\n"),
      parse: ayristir,
      onResult: function (d) {
        uygula(JSON.stringify(d));
      }
    });
  }

  function son() {
    try {
      var l = JSON.parse(localStorage.getItem(DEPO_RAPOR) || "[]") || [];
      return l.length ? l[l.length - 1] : null;
    } catch (e) { return null; }
  }

  /* ═══════════════ DÜĞMEYİ KUR ═══════════════
     💎 (gemBtn) chat-core.js tarafından buildUI içinde üretilir; sayfa
     açılırken henüz olmayabilir, o yüzden kısa aralıkla birkaç kez bakılır. */
  function kur() {
    var gem = document.getElementById("gemBtn");
    if (!gem || document.getElementById("dhGemRaporBtn")) return true;
    if (!global.DHGemini) return false;
    var b = document.createElement("button");
    b.id = "dhGemRaporBtn";
    b.type = "button";
    b.className = gem.className;
    b.title = "Gemini'de yaptığın çalışmanın raporunu al";
    b.textContent = "📊";
    b.style.background = "#0e7490";
    b.onclick = iste;
    gem.parentNode.insertBefore(b, gem.nextSibling);
    return true;
  }
  function kurDene() {
    if (kur()) return;
    var n = 0;
    var iv = setInterval(function () {
      if (kur() || ++n > 20) clearInterval(iv);
    }, 400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", kurDene);
  else kurDene();

  global.DHGeminiRapor = {
    iste: iste, son: son, goster: goster, ayristir: ayristir,
    uygula: uygula, sozlesme: sozlesme, SEMA: SEMA,
    sohbetiTamamla: sohbetiTamamla
  };
})(window);
