/* dh-pdf.js — ZENGİN PDF ÇIKTISI (index-app-layout.js'in üzerine yazar)
   ====================================================================
   İSTEK: "Bu PDF dosyada o cümle için görsel olmalı; o cümleye ait
           sistemde ne kadar bilgi varsa yer almalı."

   ── ÖNCEKİ ÇIKTI ──
   exportModuleToPDF() cümle başına yalnızca üç şey yazıyordu:
   İngilizcesi, Türkçesi ve varsa AI açıklaması. Oysa sistemde cümle
   başına çok daha fazlası duruyor ve hiçbiri kâğıda geçmiyordu.

   ── ARTIK NELER GİRİYOR ──
   data/sentences.json (23 alan):
     seviye · modül · bölüm · aşama · konu · senaryo · zaman
     gramer · kalıp · gramer etiketleri · vurgu
     IPA · Türkçe okunuş
     kolokasyonlar · eş anlamlılar · zıt anlamlılar
     sık yapılan hata · sözlük açıklaması (aiExplain)
   IndexedDB:
     img:<cümle>            → GÖRSEL (image-addon.js'in önbelleklediği URL)
     srs:<id>               → tekrar sayısı, kolaylık, aralık, sonraki tarih
     prog:sentence:<id>     → öğrenme durumu ve seri
     DilHaritaAI_DB         → senin aldığın AI açıklaması (markdown)
     sentence-learning-system → BU cümlede yaptığın hatalar

   ── ÖNCEKİ SÜRÜMÜN DÜZELTİLEN KUSURLARI ──
   1) Modül kimliği .study-title METNİNDEN okunuyordu; URL'deki
      ?mod=... kesin kimliği yok sayılıyordu. Tekrar/inceleme ekranında
      başlık modül adı olmadığı için çıktı boş kalıyordu.
   2) window._sentencesCache yedeği ÖLÜ KOD'du: o değişken
      index-app-ogretmen-analiz-buttons.js içinde bir IIFE'de tanımlı,
      window'a hiç yazılmıyor. fetch düşerse kullanıcı yalnızca
      "cümle bulunamadı" görüyordu.
   3) window.open() null denetimi yoktu; pop-up engellenince
      win.document.write hata fırlatıp sessizce ölüyordu (mobilde sık).
   4) ${s.en} şablona kaçışsız giriyordu; içinde < geçen cümle düzeni
      bozuyordu.
   5) OCR cümleleri (dh-ocr-sentences-v1) hiç dahil edilmiyordu.
   ==================================================================== */
(function (global) {
  "use strict";

  var KV_DB = "sentence-mode", KV_STORE = "kv";
  var AI_DB = "DilHaritaAI_DB", AI_STORE = "ai_explanations";
  var TOPLU_UYARI = 400;      /* bu sayının üstünde önce onay sorulur */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function normEn(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, " ")
      .replace(/[^a-z0-9' ]/g, "").trim();
  }
  function tarih(ts) {
    if (!ts) return "";
    try { return new Date(ts).toLocaleDateString("tr-TR"); } catch (e) { return ""; }
  }

  /* ---------- IndexedDB ---------- */
  function ac(ad, ver) {
    return new Promise(function (res) {
      try {
        var r = ver ? global.indexedDB.open(ad, ver) : global.indexedDB.open(ad);
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
        r.onupgradeneeded = function () { try { r.result.__yeni = true; } catch (e) {} };
      } catch (e) { res(null); }
    });
  }

  /* sentence-mode/kv TEK gecisde: img:, srs:, prog:sentence: */
  function kvTopla() {
    return ac(KV_DB, 1).then(function (db) {
      var out = { img: {}, srs: {}, prog: {} };
      if (!db) return out;
      return new Promise(function (res) {
        try {
          if (!db.objectStoreNames.contains(KV_STORE)) { db.close(); return res(out); }
          var q = db.transaction(KV_STORE, "readonly").objectStore(KV_STORE).openCursor();
          q.onsuccess = function (e) {
            var c = e.target.result;
            if (!c) { try { db.close(); } catch (e2) {} return res(out); }
            var k = String(c.key);
            if (k.indexOf("img:") === 0) out.img[k.slice(4)] = c.value;
            else if (k.indexOf("prog:sentence:") === 0) out.prog[k.slice(14)] = c.value;
            else if (k.indexOf("srs:") === 0) out.srs[k.slice(4)] = c.value;
            c.continue();
          };
          q.onerror = function () { try { db.close(); } catch (e3) {} res(out); };
        } catch (e) { res(out); }
      });
    });
  }

  function aiTopla() {
    return ac(AI_DB, 1).then(function (db) {
      var map = {};
      if (!db) return map;
      return new Promise(function (res) {
        try {
          if (!db.objectStoreNames.contains(AI_STORE)) { db.close(); return res(map); }
          var q = db.transaction(AI_STORE, "readonly").objectStore(AI_STORE).openCursor();
          q.onsuccess = function (e) {
            var c = e.target.result;
            if (!c) { try { db.close(); } catch (e2) {} return res(map); }
            /* Anahtar cümle METNİ; sentences.json ile birebir tutmayabilir,
               o yüzden normalize edilmiş biçimle de indekslenir. */
            map[normEn(c.key)] = c.value && c.value.explanation;
            c.continue();
          };
          q.onerror = function () { try { db.close(); } catch (e3) {} res(map); };
        } catch (e) { res(map); }
      });
    });
  }

  function hataTopla() {
    if (!(global.LearningErrorDB && global.LearningErrorDB.all)) return Promise.resolve({});
    return Promise.resolve(global.LearningErrorDB.all()).then(function (arr) {
      var map = {};
      (arr || []).forEach(function (r) {
        if (!r || !r.target) return;
        var k = normEn(r.target);
        (map[k] = map[k] || []).push(r);
      });
      return map;
    }).catch(function () { return {}; });
  }

  /* ---------- cümleler ---------- */
  function modulKimligi() {
    /* ÖNCE URL — kesin kimlik. Başlık metni yalnızca yedek. */
    try {
      var m = new URLSearchParams(location.search).get("mod");
      if (m) return m.trim();
    } catch (e) {}
    var el = document.querySelector(".study-title");
    return el ? String(el.textContent || "").trim() : "";
  }
  function esitMi(a, b) {
    a = String(a || "").toLowerCase().replace(/\s+/g, " ").trim();
    b = String(b || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!a || !b) return false;
    return a === b || a.indexOf(b) === 0 || b.indexOf(a) === 0;
  }
  function cumleleriYukle(tumu, mod) {
    /* fetch, dh-modul-enjekte.js tarafından sarmalandığı için kullanıcı
       modülleri de gelir. OCR cümleleri ayrıca eklenir (eski sürümde
       hiç dahil edilmiyordu). */
    return fetch("./data/sentences.json").then(function (r) {
      return r.ok ? r.json() : [];
    }).catch(function () { return []; }).then(function (arr) {
      var liste = Array.isArray(arr) ? arr.slice() : [];
      try {
        var ocr = JSON.parse(localStorage.getItem("dh-ocr-sentences-v1") || "[]") || [];
        ocr.forEach(function (s) {
          if (s && s.en) liste.push({ en: s.en, tr: s.tr || "", module: "📷 OCR Cümlelerim", order: s.order || 0 });
        });
      } catch (e) {}
      if (tumu) return liste;
      return liste.filter(function (s) { return esitMi(s.module, mod); });
    });
  }

  /* ---------- çizim ---------- */
  function satir(etiket, deger) {
    if (!deger) return "";
    return '<div class="sat"><span class="et">' + esc(etiket) + '</span>'
         + '<span class="de">' + esc(deger) + '</span></div>';
  }
  function durumMetni(prog, srs) {
    var p = [];
    if (prog && prog.status) {
      var ad = prog.status === 2 ? "Öğrenildi" : prog.status === 1 ? "Öğreniliyor" : "Yeni";
      p.push(ad);
    }
    if (srs) {
      if (srs.rep) p.push(srs.rep + " tekrar");
      if (srs.ef) p.push("kolaylık " + Number(srs.ef).toFixed(2));
      if (srs.interval) p.push(srs.interval + " gün aralık");
      if (srs.due) p.push("sıradaki: " + tarih(srs.due));
      if (srs.last) p.push("son: " + tarih(srs.last));
    }
    return p.join(" · ");
  }

  function kart(s, i, ek) {
    var n = normEn(s.en);
    var gorsel = ek.img[n];
    var ai = ek.ai[n];
    var hatalar = ek.hata[n] || [];
    var srs = s.id ? ek.srs[s.id] : null;
    var prog = s.id ? ek.prog[s.id] : null;

    var h = '<div class="item">';
    h += '<div class="ust">';
    if (gorsel) {
      h += '<img class="gor" src="' + esc(gorsel) + '" alt="" loading="eager">';
    }
    h += '<div class="metin">'
       + '<div class="en">' + (i + 1) + '. ' + esc(s.en) + '</div>'
       + (s.tr ? '<div class="tr">' + esc(s.tr) + '</div>' : '')
       + (s.ipa ? '<div class="ipa">' + esc(s.ipa) + (s.trPron ? '  ·  ' + esc(s.trPron) : '') + '</div>'
                : (s.trPron ? '<div class="ipa">' + esc(s.trPron) + '</div>' : ''))
       + '</div></div>';

    /* künye */
    var kunye = [s.level, s.module, s.part, s.topic, s.scenario, s.tense]
      .filter(Boolean).map(function (x) { return '<span class="rz">' + esc(x) + '</span>'; }).join("");
    if (kunye) h += '<div class="rzs">' + kunye + '</div>';

    h += satir("Gramer", s.grammar);
    h += satir("Kalıp", s.pattern);
    h += satir("Etiketler", s.grammarTags);
    h += satir("Vurgu", s.highlights);
    h += satir("Kolokasyon", s.collocations);
    h += satir("Eş anlamlı", s.synonyms);
    h += satir("Zıt anlamlı", s.antonyms);
    if (s.commonMistake) h += '<div class="hata-kural">⚠ Sık yapılan hata: ' + esc(s.commonMistake) + '</div>';
    if (s.aiExplain) h += '<div class="aciklama">' + esc(s.aiExplain) + '</div>';

    var d = durumMetni(prog, srs);
    if (d) h += '<div class="durum">📈 ' + esc(d) + '</div>';

    if (hatalar.length) {
      h += '<div class="hatalarim"><b>✏️ Bu cümlede yaptığın hatalar (' + hatalar.length + ')</b>';
      hatalar.slice(0, 4).forEach(function (r) {
        h += '<div class="hsat"><span class="yanlis">' + esc(r.answer || "(boş bırakıldı)") + '</span>'
           + (r.createdAt ? ' <span class="ht">' + esc(tarih(r.createdAt)) + '</span>' : '') + '</div>';
      });
      h += '</div>';
    }

    if (ai) {
      var govde = "";
      try { govde = global.parseMarkdownToHTML ? global.parseMarkdownToHTML(ai) : esc(ai); }
      catch (e) { govde = esc(ai); }
      h += '<div class="ai"><div class="ai-tag">🤖 AI Açıklaman</div>' + govde + '</div>';
    }
    h += '</div>';
    return h;
  }

  var STIL = ''
    + 'body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:22px;color:#0f172a;line-height:1.55}'
    + 'h1{color:#4338ca;border-bottom:2px solid #e2e8f0;padding-bottom:10px;font-size:21px;margin:0 0 6px}'
    + '.ozet{color:#64748b;font-size:12px;margin-bottom:20px}'
    + 'h2.mod{color:#1e1b4b;background:#e0e7ff;padding:8px 13px;border-radius:6px;font-size:15px;margin:26px 0 13px;page-break-after:avoid}'
    + '.item{margin-bottom:14px;padding:12px 13px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;page-break-inside:avoid}'
    + '.ust{display:flex;gap:12px;align-items:flex-start}'
    + '.gor{width:150px;height:110px;object-fit:cover;border-radius:7px;border:1px solid #cbd5e1;flex:0 0 auto;background:#f1f5f9}'
    + '.metin{flex:1;min-width:0}'
    + '.en{font-size:15px;font-weight:700;color:#1e293b}'
    + '.tr{font-size:13.5px;color:#475569;margin-top:3px}'
    + '.ipa{font-size:12px;color:#7c3aed;margin-top:3px;font-family:ui-monospace,monospace}'
    + '.rzs{margin:9px 0 6px}'
    + '.rz{display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;'
    + 'border-radius:999px;padding:2px 8px;font-size:10.5px;margin:0 4px 4px 0}'
    + '.sat{display:flex;gap:8px;font-size:12px;margin-top:3px}'
    + '.sat .et{color:#64748b;flex:0 0 92px;font-weight:700}'
    + '.sat .de{color:#334155;flex:1}'
    + '.hata-kural{margin-top:7px;padding:6px 9px;background:#fef2f2;border-left:3px solid #ef4444;'
    + 'border-radius:0 5px 5px 0;font-size:12px;color:#7f1d1d}'
    + '.aciklama{margin-top:7px;padding:7px 9px;background:#f0fdf4;border-left:3px solid #22c55e;'
    + 'border-radius:0 5px 5px 0;font-size:12px;color:#14532d}'
    + '.durum{margin-top:7px;font-size:11.5px;color:#0369a1;background:#f0f9ff;'
    + 'border:1px solid #bae6fd;border-radius:5px;padding:5px 8px;display:inline-block}'
    + '.hatalarim{margin-top:7px;padding:7px 9px;background:#fff7ed;border:1px solid #fed7aa;'
    + 'border-radius:6px;font-size:11.5px;color:#7c2d12}'
    + '.hsat{margin-top:3px}.hsat .yanlis{text-decoration:line-through;color:#b91c1c}'
    + '.hsat .ht{color:#9a3412;font-size:10.5px}'
    + '.ai{margin-top:9px;padding:9px 11px;background:#f8fafc;border-left:4px solid #8b5cf6;'
    + 'font-size:12px;color:#334155;border-radius:0 6px 6px 0}'
    + '.ai-tag{font-weight:800;color:#6d28d9;margin-bottom:4px;font-size:10.5px;text-transform:uppercase}'
    + '.ai h3,.ai h4{font-size:13px;margin:7px 0 3px;color:#1e293b}'
    + '.ai code{background:#e2e8f0;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:11px}'
    + '.ai ul{margin:3px 0 6px 18px;padding:0}'
    + '@media print{.item{border-color:#94a3b8}.gor{max-height:110px}}';

  /* ---------- ana akış ---------- */
  function disaAktar(tumu) {
    var mod = modulKimligi();
    var baslik = tumu ? "Tüm Modüller" : (mod || "Modül Cümleleri");

    var durumEl = null;
    try {
      durumEl = document.createElement("div");
      durumEl.style.cssText = "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);"
        + "z-index:2147483300;background:#0f1f3a;color:#e8eef7;border:1px solid #38bdf8;"
        + "padding:11px 16px;border-radius:12px;font:700 13px system-ui";
      durumEl.textContent = "PDF hazırlanıyor…";
      document.body.appendChild(durumEl);
    } catch (e) {}
    function bitir(msg) {
      if (!durumEl) return;
      if (msg) { durumEl.textContent = msg; setTimeout(function () { durumEl.remove(); }, 4000); }
      else durumEl.remove();
    }

    return Promise.all([cumleleriYukle(tumu, mod), kvTopla(), aiTopla(), hataTopla()])
      .then(function (a) {
        var cumleler = a[0];
        var ek = { img: a[1].img, srs: a[1].srs, prog: a[1].prog, ai: a[2], hata: a[3] };

        if (!cumleler.length) {
          bitir("Dışa aktarılacak cümle bulunamadı" + (mod ? (" (" + mod + ")") : "") + ".");
          return;
        }
        if (cumleler.length > TOPLU_UYARI) {
          var ok = confirm(cumleler.length + " cümle dışa aktarılacak. Bu kadar kayıt "
            + "yazdırma önizlemesini çok yavaşlatabilir ve düşük bellekli cihazlarda "
            + "sekmeyi çökertebilir.\n\nDevam edilsin mi?");
          if (!ok) { bitir(); return; }
        }

        /* pop-up ENGELİ: eski sürüm burada sessizce ölüyordu */
        var win = null;
        try { win = window.open("", "_blank"); } catch (e) {}
        if (!win || !win.document) {
          bitir("Yazdırma sekmesi açılamadı — tarayıcın pop-up'ı engelledi. "
              + "Adres çubuğundaki engel simgesinden bu siteye izin ver.");
          return;
        }

        var grup = {};
        cumleler.forEach(function (s) {
          var m = s.module || "Genel";
          (grup[m] = grup[m] || []).push(s);
        });

        var gorselSay = 0;
        cumleler.forEach(function (s) { if (ek.img[normEn(s.en)]) gorselSay++; });

        var govde = Object.keys(grup).map(function (m) {
          return '<h2 class="mod">📌 ' + esc(m) + ' (' + grup[m].length + ' cümle)</h2>'
               + grup[m].map(function (s, i) { return kart(s, i, ek); }).join("");
        }).join("");

        var html = '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">'
          + '<title>' + esc(baslik) + ' — Çalışma Notları</title>'
          + '<style>' + STIL + '</style></head><body>'
          + '<h1>' + esc(baslik) + ' — Ders ve Çalışma Notları</h1>'
          + '<div class="ozet">' + cumleler.length + ' cümle · ' + gorselSay + ' görsel · '
          + Object.keys(grup).length + ' modül · ' + new Date().toLocaleDateString("tr-TR") + '</div>'
          + govde
          + '<scr' + 'ipt>' + PRINT_JS + '</scr' + 'ipt>'
          + '</body></html>';

        win.document.open();
        win.document.write(html);
        win.document.close();
        bitir("✓ Yazdırma sekmesi açıldı — hedef olarak “PDF olarak kaydet” seç.");
      })
      .catch(function (e) {
        bitir("PDF hazırlanamadı: " + ((e && e.message) || "bilinmeyen hata"));
      });
  }

  /* Görseller dış kaynaktan geliyor; onload hepsini bekler ama biri
     takılırsa yazdırma hiç açılmaz. En fazla 8 sn bekle, sonra yazdır.
     Yüklenemeyen görsel kutusu boş kalmasın diye gizlenir. */
  var PRINT_JS = [
    "(function(){var y=false;function p(){if(y)return;y=true;setTimeout(function(){window.print();},250);}",
    "var im=document.images,k=im.length;if(!k)return p();",
    "for(var i=0;i<k;i++){(function(g){",
    "if(g.complete){if(!g.naturalWidth)g.style.display='none';if(--k<=0)p();return;}",
    "g.onload=function(){if(--k<=0)p();};",
    "g.onerror=function(){g.style.display='none';if(--k<=0)p();};",
    "})(im[i]);}",
    "setTimeout(p,8000);})();"
  ].join("");

  /* index-app-layout.js'teki düğmeler global exportModuleToPDF'i çağırıyor;
     üzerine yazmak yeterli — o dosyaya dokunulmuyor. */
  global.exportModuleToPDF = disaAktar;
  global.DHPdf = { disaAktar: disaAktar, _kart: kart, _normEn: normEn, _modul: modulKimligi };
})(window);
