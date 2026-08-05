/* dh-sohbet-puan.js — SOHBET SONU ANALIZ ve PUANLAMA
   ================================================================
   ISTEK
   "sohbet sonunda sohbeti analiz edip puanlama yapmalı."

   ── UC BILESEN (kullanicinin sectigi) ──
     1) GUNUN CUMLELERI (50 puan)  malzemedeki kaliplardan kacini GERCEKTEN
                                   urettin. Bu ozelligin amaci buydu, agirligi
                                   de en yuksek olan bu.
     2) DILBILGISI      (30 puan)  cevaplarindaki hata yogunlugu (AI analizi)
     3) GOREVLER        (20 puan)  senaryonun 3 gorevi (#taskBar'daki ✅/⬜)

   ── NEDEN AYRI DOSYA ──
   chat-core.js'in TAMAMI bir IIFE; State/history disari sizmiyor (iyi
   tasarim). Konusma DOM'dan okunur: #chatHistory > .bubble.user /
   .bubble.assistant. Repodaki yerlesik desen de bu (index-app'e eklenti
   betikleriyle dokunuluyor).

   ── AI CAGRISI ──
   chat-core ile AYNI kaynak: localStorage "groqApiKeys". Ayrica bir anahtar
   istenmez. Anahtar yoksa DILBILGISI bileseni ATLANIR ve puan kalan iki
   bilesen uzerinden orantilanir — kart yine cikar.

   ── NE ZAMAN ──
     a) "Bitir ve degerlendir" butonu (her zaman)
     b) 3 gorev de tamamlaninca otomatik (gun icinde bir kez, senaryo basina)

   ── DEPO ──
   dh-sohbet-puan-v1: son 50 degerlendirme [{gun, senaryo, toplam, ...}]
*/
(function (global) {
  "use strict";
  if (global.__dhSohbetPuan) return;
  global.__dhSohbetPuan = true;

  var GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  var GROQ_MODEL = "llama-3.3-70b-versatile";
  var KEYS_LS = "groqApiKeys";
  var DEPO = "dh-sohbet-puan-v1";
  var AGIRLIK = { cumle: 50, dilbilgisi: 30, gorev: 20 };
  var ENAZ_TUR = 2;                  /* bu kadar cevap vermeden puan verilmez */

  function gunISO() { return new Date().toISOString().slice(0, 10); }
  function sayfa() { return (location.pathname.split("/").pop() || "chat.html"); }

  /* ───────────────────── konusmayi oku (DOM) ───────────────────── */
  function balonlar() {
    var out = { kullanici: [], ogretmen: [] };
    var kap = document.getElementById("chatHistory");
    if (!kap) return out;
    var bs = kap.querySelectorAll(".bubble");
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (b.classList.contains("typing")) continue;
      var t = String(b.textContent || "").trim();
      if (!t) continue;
      if (b.classList.contains("user")) out.kullanici.push(t);
      else out.ogretmen.push(t);
    }
    return out;
  }

  /* ─────────────────── 1) gunun cumleleri ──────────────────────── */
  /* DERS MODU MU?
     ────────────────────────────────────────────────────────────────
     COZULEN HATA: Doktor/otel/restoran/havaalani sohbetlerinde ekranin
     altinda "🎯 Bugünün cümleleri" seridi cikiyor ve puanin 50'si oradan
     hesaplaniyordu. Oysa chat-core.js gunun malzemesini rol
     senaryolarindan BILEREK cikariyor (satir 115):

       if(!__dhDersModu){ __dhMalzeme=null; __dhTeach=null; __dhFocus=""; }

     gerekcesi de orada yazili: "otel resepsiyonisti ogrencinin calisma
     planini bilirse rol bozulur". Yani AI'in promptunda o cumleler HIC
     YOK; doktor ogrenciye "There is a book on the table" dedirtmeye
     calismiyor, calisamaz da. Ama bu dosya malzemeyi localStorage'dan
     dogrudan okuyup her sohbet sayfasinda serit ciziyor ve puanliyordu.
     Sonuc: ulasilmasi imkansiz bir hedef ve haksiz dusuk puan.

     Cozum: malzeme YALNIZCA ders modunda (ogretmen senaryosu) kullanilir.
     Puanlama zaten eksik bileseni orantiliyor (bkz. degerlendir), yani
     100'luk olcek dilbilgisi + gorevler uzerinden korunur.

     Tespit: chat-core.js bayragi disari aciyor; acamadiysa sayfa adindan
     anlasilir (ogretmen senaryolari chatteacher*.html). */
  function dersModuMu() {
    try {
      if (typeof global.__dhDersModuAktif === "boolean") return global.__dhDersModuAktif;
    } catch (e) {}
    /* yedek: senaryo basligi/rolu ya da sayfa adi */
    try {
      var sc = global.CHAT_SCENARIO || {};
      if (/teacher|öğretmen|ogretmen/i.test((sc.title || "") + " " + (sc.role || ""))) return true;
    } catch (e) {}
    return /chatteacher/i.test(sayfa());
  }

  function malzeme() {
    if (!dersModuMu()) return null;
    try {
      var ham = localStorage.getItem("dh-konusma-gun-" + gunISO());
      if (!ham) return null;
      var m = JSON.parse(ham);
      /* Kayit bicimi dh-konusma.js tarafindan {s:<surum>, v:<malzeme>}
         olarak sarmalandi. Sarmali ac; eski duz kayitlar da calissin. */
      if (m && typeof m === "object" && m.s && m.v !== undefined) m = m.v;
      return (m && m.cumleler && m.cumleler.length) ? m : null;
    } catch (e) { return null; }
  }
  /* Kalibin "govdesi": "Do you have + a/an + noun? (availability)" ->
     ["do","you","have"]. Yer tutucular ([place], + noun) ve parantezli
     aciklama atilir; kalan sabit kelimeler aranir. */
  function kalipCekirdegi(kalip) {
    var s = String(kalip || "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\bnoun\b|\bverb\b|\badj\w*\b|\bplace\b|\bname\b/gi, " ")
      .replace(/[+/]/g, " ")
      .toLowerCase().replace(/[^a-z' ]/g, " ").replace(/\s+/g, " ").trim();
    return s ? s.split(" ").filter(function (w) { return w.length > 1; }) : [];
  }
  function norm(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
  }
  /* Bir kalip kullanildi mi: cekirdek kelimelerin en az %60'i AYNI cevapta
     geciyorsa sayilir. Tam cumle esitligi aranmaz — amac ezber degil uretim. */
  function kalipKullanildi(cekirdek, cevaplar) {
    if (!cekirdek.length) return false;
    var gerek = Math.max(1, Math.ceil(cekirdek.length * 0.6));
    for (var i = 0; i < cevaplar.length; i++) {
      var c = " " + norm(cevaplar[i]) + " ", n = 0;
      for (var j = 0; j < cekirdek.length; j++) {
        if (c.indexOf(" " + cekirdek[j] + " ") >= 0) n++;
      }
      if (n >= gerek) return true;
    }
    return false;
  }
  function cumlePuani(m, cevaplar) {
    if (!m) return null;
    var kullanilan = [], kacirilan = [];
    m.cumleler.forEach(function (c) {
      var cek = kalipCekirdegi(c.kalip);
      if (!cek.length) cek = kalipCekirdegi(c.en);
      (kalipKullanildi(cek, cevaplar) ? kullanilan : kacirilan).push(c);
    });
    var oran = m.cumleler.length ? kullanilan.length / m.cumleler.length : 0;
    return {
      puan: Math.round(oran * AGIRLIK.cumle),
      tam: AGIRLIK.cumle,
      kullanilan: kullanilan.length,
      toplam: m.cumleler.length,
      kacirilan: kacirilan.slice(0, 3)
    };
  }

  /* ────────────────────── 3) gorevler ─────────────────────────── */
  function gorevPuani() {
    var el = document.getElementById("taskBar");
    if (!el) return null;
    var metin = String(el.textContent || "");
    var yapilan = (metin.match(/✅/g) || []).length;
    var kalan = (metin.match(/⬜/g) || []).length;
    var toplam = yapilan + kalan;
    if (!toplam) return null;
    return {
      puan: Math.round((yapilan / toplam) * AGIRLIK.gorev),
      tam: AGIRLIK.gorev, yapilan: yapilan, toplam: toplam
    };
  }

  /* ───────────────────── 2) dilbilgisi (AI) ───────────────────── */
  function anahtarlar() {
    try { return (JSON.parse(localStorage.getItem(KEYS_LS) || "[]") || []).filter(Boolean); }
    catch (e) { return []; }
  }
  function groq(mesajlar) {
    var keys = anahtarlar();
    if (!keys.length) return Promise.reject(new Error("anahtar yok"));
    var i = 0;
    function dene() {
      if (i >= keys.length) return Promise.reject(new Error("tum anahtarlar basarisiz"));
      var key = keys[i++];
      return fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({ model: GROQ_MODEL, messages: mesajlar, temperature: 0.2, max_tokens: 400 })
      }).then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      }).then(function (d) {
        return (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
      }).catch(dene);
    }
    return dene();
  }
  function dilbilgisiPuani(cevaplar, seviye) {
    if (!anahtarlar().length) return Promise.resolve(null);   /* anahtar yok: bilesen atlanir */
    var sys = "You are an English teacher grading a Turkish learner's chat replies at level "
      + (seviye || "A2") + ". Judge ONLY grammar, word choice and word order of THEIR sentences. "
      + "Be fair for their level; ignore punctuation, capitalisation and typos. "
      + "Return ONLY JSON, no prose: "
      + '{"skor":0-100,"hatalar":[{"yanlis":"...","dogru":"...","kural":"kısa Türkçe kural"}],"yorum":"tek cümle Türkçe geri bildirim"}'
      + " Put at most 3 items in hatalar.";
    return groq([
      { role: "system", content: sys },
      { role: "user", content: cevaplar.join("\n") }
    ]).then(function (out) {
      var j = null;
      try { j = JSON.parse(String(out).replace(/```json|```/g, "").trim()); } catch (e) {}
      if (!j || typeof j.skor !== "number") return null;
      var s = Math.max(0, Math.min(100, j.skor));
      return {
        puan: Math.round((s / 100) * AGIRLIK.dilbilgisi),
        tam: AGIRLIK.dilbilgisi,
        skor: s,
        hatalar: Array.isArray(j.hatalar) ? j.hatalar.slice(0, 3) : [],
        yorum: String(j.yorum || "")
      };
    }).catch(function () { return null; });
  }

  /* ───────────────────────── toplam ──────────────────────────── */
  function degerlendir() {
    var b = balonlar();
    if (b.kullanici.length < ENAZ_TUR) {
      return Promise.resolve({ yetersiz: true, tur: b.kullanici.length, gerek: ENAZ_TUR });
    }
    var m = malzeme();
    var c = cumlePuani(m, b.kullanici);
    var g = gorevPuani();
    return dilbilgisiPuani(b.kullanici, (m && m.seviye) || "A2").then(function (d) {
      var parcalar = [c, d, g].filter(Boolean);
      var alinan = 0, mumkun = 0;
      parcalar.forEach(function (p) { alinan += p.puan; mumkun += p.tam; });
      /* Eksik bilesen varsa (or. anahtar yok) puan KALANLAR uzerinden
         orantilanir — 100'luk olcek korunur, haksiz dusuk puan cikmaz. */
      var toplam = mumkun ? Math.round((alinan / mumkun) * 100) : 0;
      return {
        gun: gunISO(), senaryo: sayfa(), tur: b.kullanici.length,
        cumle: c, dilbilgisi: d, gorev: g,
        alinan: alinan, mumkun: mumkun, toplam: toplam
      };
    });
  }

  function kaydet(s) {
    try {
      var l = JSON.parse(localStorage.getItem(DEPO) || "[]") || [];
      l.push({
        gun: s.gun, senaryo: s.senaryo, toplam: s.toplam, tur: s.tur,
        cumle: s.cumle ? (s.cumle.kullanilan + "/" + s.cumle.toplam) : null,
        gorev: s.gorev ? (s.gorev.yapilan + "/" + s.gorev.toplam) : null,
        dilbilgisi: s.dilbilgisi ? s.dilbilgisi.skor : null,
        ts: Date.now()
      });
      if (l.length > 50) l = l.slice(l.length - 50);
      localStorage.setItem(DEPO, JSON.stringify(l));
    } catch (e) {}
  }

  /* ───────────────────────── arayuz ──────────────────────────── */
  function stil() {
    if (document.getElementById("dh-puan-css")) return;
    var s = document.createElement("style"); s.id = "dh-puan-css";
    s.textContent =
      "#dhPuanBtn{background:#0e7490}"
      + ".dh-puan-ort{position:fixed;inset:0;z-index:2147483000;background:rgba(3,8,18,.78);"
      + "display:flex;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(4px)}"
      + ".dh-puan{width:min(460px,96vw);max-height:92vh;overflow:auto;background:#0b1a33;"
      + "border:1px solid #2563eb;border-radius:18px;padding:18px;color:#e8eef7;"
      + "font:600 13.5px Nunito,system-ui,sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.6)}"
      + ".dh-puan h3{margin:0 0 2px;font:900 18px Nunito,system-ui}"
      + ".dh-puan__buyuk{font:900 44px Nunito,system-ui;line-height:1.1;margin:6px 0 2px}"
      + ".dh-puan__alt{color:#9fb3d9;font-size:12.5px;margin-bottom:12px}"
      + ".dh-puan__satir{display:flex;align-items:center;gap:10px;margin:8px 0}"
      + ".dh-puan__ad{width:120px;flex:0 0 auto;font-size:12.5px;color:#cfe0ff}"
      + ".dh-puan__cub{flex:1;height:9px;border-radius:6px;background:#0a1628;overflow:hidden}"
      + ".dh-puan__dol{height:100%;border-radius:6px}"
      + ".dh-puan__sy{width:52px;text-align:right;flex:0 0 auto;font-size:12px}"
      + ".dh-puan__not{margin-top:10px;padding:10px 12px;background:#101f38;border:1px solid #23395b;"
      + "border-radius:11px;font-size:12.5px;color:#cfe0ff;line-height:1.5}"
      + ".dh-puan__hata{margin-top:6px;font-size:12px;color:#fde68a}"
      + ".dh-puan__btn{display:block;width:100%;margin-top:14px;background:#2563eb;color:#fff;border:0;"
      + "border-radius:11px;padding:11px;font:800 14px Nunito,system-ui;cursor:pointer}";
    document.head.appendChild(s);
  }
  function esc(x) {
    return String(x == null ? "" : x).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function renk(o) { return o >= .8 ? "#4ade80" : o >= .5 ? "#38bdf8" : "#f59e0b"; }
  function cubuk(ad, p) {
    if (!p) return '<div class="dh-puan__satir"><span class="dh-puan__ad">' + esc(ad)
      + '</span><span class="dh-puan__sy" style="width:auto;color:#64748b">—</span></div>';
    var o = p.tam ? p.puan / p.tam : 0;
    return '<div class="dh-puan__satir"><span class="dh-puan__ad">' + esc(ad) + '</span>'
      + '<span class="dh-puan__cub"><span class="dh-puan__dol" style="width:' + Math.round(o * 100)
      + '%;background:' + renk(o) + '"></span></span>'
      + '<span class="dh-puan__sy">' + p.puan + '/' + p.tam + '</span></div>';
  }

  function kartiGoster(s) {
    stil();
    var eski = document.getElementById("dhPuanOrt");
    if (eski) eski.remove();
    var ort = document.createElement("div");
    ort.className = "dh-puan-ort"; ort.id = "dhPuanOrt";

    var ic;
    if (s.yetersiz) {
      ic = '<h3>Henüz değerlendirilemez</h3>'
        + '<div class="dh-puan__alt">En az ' + s.gerek + ' cevap gerekiyor; şu an ' + s.tur + '.</div>'
        + '<div class="dh-puan__not">Biraz daha konuş, sonra tekrar dene.</div>';
    } else {
      var o = s.toplam / 100;
      ic = '<h3>Sohbet değerlendirmesi</h3>'
        + '<div class="dh-puan__buyuk" style="color:' + renk(o) + '">' + s.toplam + '<span style="font-size:18px;opacity:.6">/100</span></div>'
        + '<div class="dh-puan__alt">' + s.tur + ' cevap verdin</div>'
        + cubuk("Günün cümleleri", s.cumle)
        + cubuk("Dilbilgisi", s.dilbilgisi)
        + cubuk("Görevler", s.gorev);
      if (s.cumle) {
        ic += '<div class="dh-puan__not">Günün ' + s.cumle.toplam + ' kalıbından <b>'
          + s.cumle.kullanilan + '</b> tanesini kullandın.';
        if (s.cumle.kacirilan.length) {
          ic += '<br><span style="color:#9fb3d9">Kullanmadıkların:</span> '
            + s.cumle.kacirilan.map(function (c) { return esc(c.en); }).join(" · ");
        }
        ic += '</div>';
      }
      if (s.dilbilgisi && s.dilbilgisi.yorum) {
        ic += '<div class="dh-puan__not">' + esc(s.dilbilgisi.yorum) + '</div>';
      }
      if (s.dilbilgisi && s.dilbilgisi.hatalar.length) {
        ic += '<div class="dh-puan__hata">' + s.dilbilgisi.hatalar.map(function (h) {
          return "✗ " + esc(h.yanlis) + " → ✓ " + esc(h.dogru) + (h.kural ? (" <span style='opacity:.75'>(" + esc(h.kural) + ")</span>") : "");
        }).join("<br>") + '</div>';
      }
      if (!s.dilbilgisi) {
        ic += '<div class="dh-puan__alt" style="margin:8px 0 0">Dilbilgisi analizi için API anahtarı gerekiyor; '
          + 'puan diğer bileşenler üzerinden hesaplandı.</div>';
      }
    }
    var kart = document.createElement("div");
    kart.className = "dh-puan"; kart.id = "dhPuanKart";
    kart.innerHTML = ic + '<button class="dh-puan__btn" id="dhPuanKapat" type="button">Kapat</button>';
    ort.appendChild(kart);
    document.body.appendChild(ort);
    document.getElementById("dhPuanKapat").onclick = function () { ort.remove(); };
    ort.addEventListener("click", function (e) { if (e.target === ort) ort.remove(); });
    return kart;
  }

  /* ══════════════ CANLI ŞERİT ══════════════════════════════════════
     "O gün öğrendiğim cümleleri burada nasıl kullanacağım?" sorusunun
     gorunur cevabi. Gunun kaliplarini sohbet ekraninda listeler ve sen
     o kalibi URETTIKCE isaretler. Eslestirme, puanlamanin AYNI mantigi
     (kalipKullanildi) — ayri bir kural yok, sonda cikan puanla birebir
     tutarli. Boylece "model konuyu dagitti mi" gozle gorulur; prompt'a
     guvenmek yerine OLCULEN bir sey olur. */
  function seritStil() {
    if (document.getElementById("dh-serit-css")) return;
    var st = document.createElement("style"); st.id = "dh-serit-css";
    st.textContent =
      "#dhSerit{display:flex;gap:6px;flex-wrap:wrap;align-items:center;"
      + "padding:6px 10px;border-top:1px dashed #ffffff18;font:700 11.5px Nunito,system-ui}"
      + "#dhSerit .dh-serit__bas{color:#7cc4ff;flex:0 0 auto}"
      + "#dhSerit .dh-serit__oge{display:inline-flex;align-items:center;gap:4px;"
      + "padding:3px 8px;border-radius:999px;background:#101f38;border:1px solid #23395b;"
      + "color:#9fb3d9;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
      + "transition:background .3s,color .3s,border-color .3s;cursor:default}"
      + "#dhSerit .dh-serit__oge--ok{background:#052e16;border-color:#22c55e88;color:#86efac}"
      + "#dhSerit .dh-serit__sayi{margin-left:auto;color:#cfe0ff;flex:0 0 auto}";
    document.head.appendChild(st);
  }
  var _seritDurum = "";
  function seritCiz() {
    var m = malzeme();
    if (!m) {
      /* Rol senaryosuna gecildiyse (ya da malzeme bittiyse) eskiden
         cizilmis serit ekranda kalmasin. */
      var eski = document.getElementById("dhSerit");
      if (eski) { eski.remove(); _seritDurum = null; }
      return;
    }
    var kap = document.getElementById("taskBar");
    if (!kap || !kap.parentNode) return;
    seritStil();
    var el = document.getElementById("dhSerit");
    if (!el) {
      el = document.createElement("div");
      el.id = "dhSerit";
      kap.parentNode.insertBefore(el, kap);      /* gorev cubugunun hemen ustune */
    }
    var cevaplar = balonlar().kullanici;
    var yapilan = 0;
    var parcalar = m.cumleler.map(function (c) {
      var cek = kalipCekirdegi(c.kalip);
      if (!cek.length) cek = kalipCekirdegi(c.en);
      var ok = kalipKullanildi(cek, cevaplar);
      if (ok) yapilan++;
      return { en: c.en, ok: ok };
    });
    /* degismediyse DOM'a dokunma (her 4 sn'de bir yeniden cizim yapilmasin) */
    var imza = yapilan + "/" + parcalar.length + ":" + parcalar.map(function (p) { return p.ok ? 1 : 0; }).join("");
    if (imza === _seritDurum) return;
    _seritDurum = imza;
    el.innerHTML = '<span class="dh-serit__bas">🎯 Bugünün cümleleri</span>'
      + parcalar.map(function (p) {
          return '<span class="dh-serit__oge' + (p.ok ? " dh-serit__oge--ok" : "") + '" title="'
            + esc(p.en) + '">' + (p.ok ? "✅" : "○") + " " + esc(p.en) + '</span>';
        }).join("")
      + '<span class="dh-serit__sayi">' + yapilan + "/" + parcalar.length + '</span>';
  }

  var mesgul = false;
  function calistir() {
    if (mesgul) return Promise.resolve(null);
    mesgul = true;
    var btn = document.getElementById("dhPuanBtn");
    if (btn) { btn.disabled = true; btn.textContent = "⏳"; }
    return degerlendir().then(function (s) {
      if (!s.yetersiz) kaydet(s);
      kartiGoster(s);
      return s;
    }).catch(function () { return null; }).then(function (s) {
      mesgul = false;
      if (btn) { btn.disabled = false; btn.textContent = "🏁"; }
      return s;
    });
  }

  /* ── (a) buton ── */
  function butonEkle() {
    if (document.getElementById("dhPuanBtn")) return;
    var sira = document.querySelector(".input-row");
    var gonder = document.getElementById("sendBtn");
    if (!sira || !gonder) return;
    stil();
    var b = document.createElement("button");
    b.id = "dhPuanBtn"; b.type = "button";
    b.className = gonder.className.replace("send-btn", "suggest-btn");
    b.title = "Bitir ve değerlendir";
    b.textContent = "🏁";
    b.onclick = function () { calistir(); };
    sira.insertBefore(b, gonder);
  }

  /* ── (b) gorevler bitince otomatik (gun + senaryo basina bir kez) ── */
  function otoAnahtar() { return "dh-puan-oto-" + gunISO() + "-" + sayfa(); }
  function gorevlerBittiMi() {
    var el = document.getElementById("taskBar");
    if (!el) return false;
    var t = String(el.textContent || "");
    return (t.match(/✅/g) || []).length > 0 && (t.match(/⬜/g) || []).length === 0;
  }
  function otoDenetle() {
    try {
      if (localStorage.getItem(otoAnahtar())) return;
      if (!gorevlerBittiMi()) return;
      if (balonlar().kullanici.length < ENAZ_TUR) return;
      localStorage.setItem(otoAnahtar(), "1");
      setTimeout(calistir, 1200);          /* son cevabın okunmasını bekle */
    } catch (e) {}
  }

  function baslat() {
    butonEkle();
    seritCiz();
    /* Acilista da bir kez bak: kullanici gorevleri bitirmis bir sohbete geri
       donduyse MutationObserver hic tetiklenmiyor ve 4 sn'lik tarama
       beklenmesi gerekiyordu (testte yakalandi). */
    otoDenetle();
    try {
      new MutationObserver(function () {
        butonEkle();
        seritCiz();
        otoDenetle();
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    setInterval(function () { butonEkle(); seritCiz(); otoDenetle(); }, 4000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", baslat, { once: true });
  } else { baslat(); }

  global.DHSohbetPuan = {
    calistir: calistir, degerlendir: degerlendir, kartiGoster: kartiGoster,
    seritCiz: seritCiz,
    _balonlar: balonlar, _cumlePuani: cumlePuani, _gorevPuani: gorevPuani,
    _kalipCekirdegi: kalipCekirdegi, _kalipKullanildi: kalipKullanildi
  };
})(typeof window !== "undefined" ? window : globalThis);
