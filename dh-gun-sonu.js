/* dh-gun-sonu.js — KARMA GÜN SONU PRATİĞİ
   ====================================================================
   İSTEK: "O gün çalışılan cümleleri, kalıpları, kelimeleri karma gün sonu
           aktivitesinde pratik yapmalı. Örneğin öğretmenle chat yapmalı."

   ── NEDEN GEREKLİ ──
   Günü kapatma paneli (coach-bubble.js > dhCoachDayClose) yalnızca
   HATALARA bakıyordu. Gün içinde çalışılan cümleler, o cümlelerin
   kalıpları ve öğrenilen kelimeler kapanışta hiç kullanılmıyordu; oysa
   günün sonu bu üçünü ÜRETİM olarak birleştirmek için doğru an.

   ── NE YAPAR ──
   1) Günün malzemesini üç kaynaktan toplar (hepsi tarihli, varsayım yok):
        srs:<cümleId>   .last == bugün  → çalışılan CÜMLELER
        wsrs:<kelime>   .last == bugün  → çalışılan KELİMELER
        cümle kaydının pattern/grammar/tense alanı → KALIPLAR
      (dh-konusma.js ile aynı veri hattı; orada yalnızca cümle vardı.)
   2) Günü kapat paneline "Karma gün sonu pratiği" bölümü ekler.
   3) "Öğretmenle pratik yap" düğmesi: harmanı localStorage'a yazıp
      öğretmen sohbetini ?gunsonu=1 ile açar. chat-core o anahtarı
      günün normal malzemesinden ÖNCE okur ve dersi bunun üzerine kurar.

   Depo: dh-gunsonu-<YYYY-MM-DD> = {cumleler, kelimeler, kaliplar, at}
   ==================================================================== */
(function (global) {
  "use strict";
  if (global.DHGunSonu) return;

  var DB = "sentence-mode", STORE = "kv";
  var ONEK = "dh-gunsonu-";
  var ENFAZLA_CUMLE = 8, ENFAZLA_KELIME = 12;

  function gunISO(d) {
    var t = d || new Date();
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0")
         + "-" + String(t.getDate()).padStart(2, "0");
  }
  function anahtar() { return ONEK + gunISO(); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---------- kv deposu ---------- */
  function kvAc() {
    return new Promise(function (res) {
      try {
        var r = global.indexedDB.open(DB, 1);
        r.onupgradeneeded = function () {
          var db = r.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  /* srs: ve wsrs: kayitlarini TEK gecisde oku */
  function srsOku() {
    return kvAc().then(function (db) {
      if (!db) return { srs: {}, wsrs: {} };
      return new Promise(function (res) {
        var out = { srs: {}, wsrs: {} };
        try {
          var q = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
          q.onsuccess = function (e) {
            var c = e.target.result;
            if (!c) { try { db.close(); } catch (e2) {} return res(out); }
            var k = String(c.key);
            if (k.indexOf("wsrs:") === 0) out.wsrs[k.slice(5)] = c.value;
            else if (k.indexOf("srs:") === 0) out.srs[k.slice(4)] = c.value;
            c.continue();
          };
          q.onerror = function () { try { db.close(); } catch (e3) {} res(out); };
        } catch (e) { res(out); }
      });
    });
  }

  /* Bir kaydin son calisma gunu — srs.last TEK tarihli kaynak
     (dh-konusma.js ile ayni olcut; iki modul ayni gunu farkli saymasin) */
  function gunuOf(kayit) {
    if (!kayit || !kayit.last) return null;
    var d = new Date(kayit.last);
    return isNaN(d.getTime()) ? null : gunISO(d);
  }

  /* Kalip turetme sirasi dh-konusma.js ile AYNI:
     pattern (%45 dolu) -> grammar (%99.9) -> tense (%98.5) */
  function kalipOf(r) {
    if (!r) return "";
    return r.pattern || r.grammar || r.tense || "";
  }

  function topla() {
    var bugun = gunISO();
    return srsOku().then(function (D) {
      var cumleIds = Object.keys(D.srs).filter(function (id) {
        return gunuOf(D.srs[id]) === bugun;
      });
      var kelimeler = Object.keys(D.wsrs).filter(function (w) {
        return gunuOf(D.wsrs[w]) === bugun;
      }).slice(0, ENFAZLA_KELIME);

      if (!cumleIds.length && !kelimeler.length) return null;
      if (!cumleIds.length || !(global.DHSent && global.DHSent.byIds)) {
        return { cumleler: [], kaliplar: [], kelimeler: kelimeler, at: Date.now() };
      }
      return global.DHSent.byIds(cumleIds).then(function (map) {
        var kayitlar = cumleIds.map(function (id) {
          var r = (map || {})[id];
          if (!r || !r.en) return null;
          return { id: id, en: r.en, tr: r.tr || "", kalip: kalipOf(r),
                   konu: r.topic || "", ortam: r.scenario || "" };
        }).filter(Boolean).slice(0, ENFAZLA_CUMLE);

        var kaliplar = [];
        kayitlar.forEach(function (c) {
          if (c.kalip && kaliplar.indexOf(c.kalip) < 0) kaliplar.push(c.kalip);
        });
        return { cumleler: kayitlar, kaliplar: kaliplar, kelimeler: kelimeler, at: Date.now() };
      }).catch(function () {
        return { cumleler: [], kaliplar: [], kelimeler: kelimeler, at: Date.now() };
      });
    });
  }

  /* Öğretmen sohbetine devret */
  function ogretmeneGonder(harman) {
    try { localStorage.setItem(anahtar(), JSON.stringify(harman)); } catch (e) {}
    var sec = "teacher1";
    try { sec = localStorage.getItem("selectedTeacherAvatar") || "teacher1"; } catch (e) {}
    var sayfa = (sec === "teacher2") ? "chatteacher2.html" : "chatteacher1.html";
    try { location.href = "./" + sayfa + "?gunsonu=1"; } catch (e) {}
  }
  function harmanOku() {
    try {
      var o = JSON.parse(localStorage.getItem(anahtar()) || "null");
      return (o && (o.cumleler || o.kelimeler)) ? o : null;
    } catch (e) { return null; }
  }

  /* ---------- Günü Kapat paneline bölüm ekle ---------- */
  function rozet(metin, renk) {
    return '<span style="display:inline-block;padding:3px 9px;margin:3px 4px 0 0;border-radius:999px;'
      + 'background:' + renk + '22;border:1px solid ' + renk + '66;color:' + renk + ';'
      + 'font-size:12px;font-weight:800">' + esc(metin) + '</span>';
  }
  function bolumCiz(body, h) {
    if (document.getElementById("dhGsBolum")) return;
    var kutu = document.createElement("div");
    kutu.id = "dhGsBolum";
    kutu.style.cssText = "margin-top:14px;padding:13px;border-radius:13px;"
      + "background:#0b1830;border:1px solid #1e3a5f";

    var ic = '<div style="font-weight:900;color:#7dd3fc;font-size:14px;margin-bottom:8px">'
           + '🎒 Bugün çalıştıkların — karma pratik</div>';

    if (h.cumleler && h.cumleler.length) {
      ic += '<div style="font-size:12px;color:#9fb3d9;margin-top:6px">Cümleler ('
          + h.cumleler.length + ')</div><div>'
          + h.cumleler.slice(0, 5).map(function (c) { return rozet(c.en, "#38bdf8"); }).join("")
          + (h.cumleler.length > 5 ? rozet("+" + (h.cumleler.length - 5), "#64748b") : "")
          + '</div>';
    }
    if (h.kaliplar && h.kaliplar.length) {
      ic += '<div style="font-size:12px;color:#9fb3d9;margin-top:8px">Kalıplar ('
          + h.kaliplar.length + ')</div><div>'
          + h.kaliplar.slice(0, 4).map(function (p) { return rozet(p, "#a78bfa"); }).join("")
          + '</div>';
    }
    if (h.kelimeler && h.kelimeler.length) {
      ic += '<div style="font-size:12px;color:#9fb3d9;margin-top:8px">Kelimeler ('
          + h.kelimeler.length + ')</div><div>'
          + h.kelimeler.slice(0, 8).map(function (w) { return rozet(w, "#34d399"); }).join("")
          + (h.kelimeler.length > 8 ? rozet("+" + (h.kelimeler.length - 8), "#64748b") : "")
          + '</div>';
    }

    ic += '<button id="dhGsGit" style="display:block;width:100%;margin-top:12px;border:0;'
        + 'background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;font-weight:900;'
        + 'font-size:14px;padding:13px;border-radius:12px;cursor:pointer">'
        + '🎓 Öğretmenle karma pratik yap</button>'
        + '<button id="dhGsGemini" style="display:block;width:100%;margin-top:8px;border:0;background:#8b5cf6;color:#fff;font-weight:900;font-size:14px;padding:13px;border-radius:12px;cursor:pointer">💎 Bugünün tamamını Gemini ile değerlendir</button>'
        + '<div style="font-size:11.5px;color:#64748b;margin-top:7px;line-height:1.5">'
        + 'Öğretmen bu cümleleri, kalıpları ve kelimeleri tek bir konuşmada '
        + 'harmanlayıp sana ÜRETTİRİR — okutmaz.</div>';

    kutu.innerHTML = ic;
    body.appendChild(kutu);
    var b = document.getElementById("dhGsGit");
    if (b) b.onclick = function () { ogretmeneGonder(h); };
    var g = document.getElementById("dhGsGemini");
    if (g) g.onclick = function () { if(global.DHGeminiQuality) DHGeminiQuality.todayReview(); else alert("Gemini değerlendirme aracı bu ekranda yüklenmedi."); };
  }

  /* Panel coach-bubble.js tarafindan aciliyor; DOM'a girmesini bekle. */
  function izle() {
    var mo = new MutationObserver(function () {
      var body = document.getElementById("dhDcBody");
      if (!body || document.getElementById("dhGsBolum")) return;
      /* panel "karne eksik" ekranindaysa bolum eklenmez */
      if (document.getElementById("dhDcTour")) return;
      topla().then(function (h) {
        if (!h) return;
        var body2 = document.getElementById("dhDcBody");
        if (body2 && !document.getElementById("dhGsBolum")) bolumCiz(body2, h);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", izle);
  else izle();

  global.DHGunSonu = {
    topla: topla,
    harman: harmanOku,
    anahtar: anahtar,
    gonder: ogretmeneGonder,
    _bolumCiz: bolumCiz
  };
})(window);
