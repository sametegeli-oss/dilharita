/* viseme-lang.js — DİLE DUYARLI AĞIZ HAREKETLERİ
   ==================================================================
   SORUN: uygulamada dört ayrı ağız eşlemesi vardı (chat-core.js, avatar.js,
   videopractice_ui_patch.js, teacher_inline.js) ve hepsi TEK bir karma harita
   kullanıyordu. Türkçe'ye özgü c, ç, ş, ğ, j harfleri hiçbirinde yoktu —
   varsayılan şekle düşüyorlardı. İngilizce tarafında da "th" dışında hiçbir
   ses ayrımı yoktu. Koç ana ekranında ise eşleme hiç yoktu: metinden bağımsız
   dört karelik sabit bir döngü oynuyordu.

   BU MODÜL: metni dile göre parçalara ayırır, her parçaya kendi haritasını
   uygular. İki dilin ağzı gerçekten farklı çalışıyor:

     TÜRKÇE   sesçil bir dil — her harf tek ses. ö/ü öne yuvarlak ünlüler,
              ş/ç/c/j dudak ileri, ğ ünlüyü uzatır (ağız değişmez), r nötr.
     İNGİLİZCE harf≠ses. th ayrı bir şekil, r ve w DUDAK YUVARLAK (Türkçe r
              nötrken), sondaki sessiz e ağzı açmamalı, oo/ee/sh/ch ikilileri
              tek sese karşılık gelir.

   API:
     DHViseme.langOf(kelime, def)        "tr" | "en"
     DHViseme.shapes(metin, def)         [{shape,lang}, ...]  shape: a e i o u mbp fv l th idle
     DHViseme.sequence(metin, map, def)  kare listesi (map: {a:"...",e:"...",...})

   def = bağlam dili ("tr" varsayılan). Güçlü bir işaret yoksa bu kullanılır.

   [[ ]] içindeki bölümler İngilizce sayılır — uygulamanın seslendirmesi de
   aynı işareti kullanıyor (tts-avatar-long-sync-fix.js).
*/
(function () {
  "use strict";
  if (window.DHViseme) return;

  var TR_CHARS = /[ğüşöçıİĞÜŞÖÇ]/;
  /* İngilizce'ye güçlü işaret eden desenler (Türkçe'de bulunmaz veya çok nadir) */
  var EN_HINT = /(^|[^a-z])(the|a|an|is|are|was|were|and|or|but|to|of|in|on|at|it|he|she|they|you|we|i|my|your|this|that|with|for|have|has|had|do|does|did|not|can|will|would|there|what|when|where|which|who|how)([^a-z]|$)/i;
  var EN_LETTERS = /[qwx]/i;
  var EN_DIGRAPH = /(th|sh|ch|ph|wh|gh|ck|ng|oo|ee|ea|ou|ow|ai|ay)/i;

  /* Kelime bazlı dil tahmini kısa kelimelerde güvenilmez: "red", "like", "kalem"
     hepsi sade ASCII. Bu yüzden tahmin yalnızca GÜÇLÜ işaretlerde konuşur;
     işaret yoksa çağıranın verdiği bağlam dili (def) kullanılır.
       - koç ana ekranı / öğretmen anlatımı  → def "tr", İngilizce [[ ]] ile gelir
       - doktor/otel/havaalanı sohbetleri    → def "en", cevabın tamamı İngilizce  */
  function langOf(word, def) {
    var w = String(word || "");
    var d = (def === "en" || def === "tr") ? def : "tr";
    if (!w.trim()) return d;
    if (TR_CHARS.test(w)) return "tr";
    if (EN_LETTERS.test(w)) return "en";
    if (EN_HINT.test(" " + w + " ")) return "en";
    if (EN_DIGRAPH.test(w)) return "en";
    return d;
  }

  /* ---------- TÜRKÇE: harf = ses ---------- */
  function trShape(ch, next) {
    if (/[aâ]/.test(ch)) return "a";
    if (ch === "e") return "e";
    if (/[ıi]/.test(ch)) return "i";
    if (/[oö]/.test(ch)) return "o";
    if (/[uü]/.test(ch)) return "u";
    if (/[mbp]/.test(ch)) return "mbp";
    if (/[fv]/.test(ch)) return "fv";
    if (ch === "l") return "l";
    /* ş ç c j — dudaklar ileri ve yuvarlak; en yakın kare "u" */
    if (/[şçcj]/.test(ch)) return "u";
    /* ğ sesi yoktur, önceki ünlüyü uzatır → ağız değişmesin */
    if (ch === "ğ") return null;
    if (/[.,!?;:…\s]/.test(ch)) return "idle";
    /* t d n r k g h s z y — küçük açıklık */
    return "i";
  }

  /* ---------- İNGİLİZCE: ikili harfler ve sessiz e ---------- */
  function enShape(ch, next, prev, isLast) {
    var two = ch + next;
    if (two === "th") return { shape: "th", skip: 1 };
    if (two === "sh" || two === "ch") return { shape: "u", skip: 1 };
    if (two === "ph") return { shape: "fv", skip: 1 };
    if (two === "wh") return { shape: "u", skip: 1 };
    if (two === "qu") return { shape: "u", skip: 1 };
    if (two === "oo" || two === "ou" || two === "ow") return { shape: "u", skip: 1 };
    if (two === "ee" || two === "ea") return { shape: "i", skip: 1 };
    if (two === "oa") return { shape: "o", skip: 1 };
    /* sessiz sonek e: "have", "like", "time" → ağzı açma */
    if (ch === "e" && isLast) return { shape: null, skip: 0 };
    if (ch === "a") return { shape: "a", skip: 0 };
    if (ch === "e") return { shape: "e", skip: 0 };
    if (/[iy]/.test(ch)) return { shape: "i", skip: 0 };
    if (ch === "o") return { shape: "o", skip: 0 };
    if (ch === "u") return { shape: "u", skip: 0 };
    /* İngilizce r ve w dudak yuvarlar — Türkçe'den ayrıldığı yer */
    if (ch === "r" || ch === "w") return { shape: "o", skip: 0 };
    if (/[mbp]/.test(ch)) return { shape: "mbp", skip: 0 };
    if (/[fv]/.test(ch)) return { shape: "fv", skip: 0 };
    if (ch === "l") return { shape: "l", skip: 0 };
    if (/[.,!?;:…\s]/.test(ch)) return { shape: "idle", skip: 0 };
    return { shape: "i", skip: 0 };
  }

  /* ---------- metni dile göre parçala ----------
     [[ ]] blokları İngilizce; dışarısı kelime kelime tespit edilir. */
  function segment(text, def) {
    var s = String(text == null ? "" : text);
    var out = [], re = /\[\[([\s\S]*?)\]\]/g, i = 0, m;
    function plain(chunk) {
      if (!chunk) return;
      /* kelime sınırlarında böl, ardışık aynı dildekileri birleştir */
      var parts = chunk.split(/(\s+)/), buf = "", cur = null;
      for (var k = 0; k < parts.length; k++) {
        var p = parts[k];
        if (!p) continue;
        if (/^\s+$/.test(p)) { buf += p; continue; }
        var lg = langOf(p, def);
        if (cur === null) { cur = lg; buf += p; }
        else if (lg === cur) { buf += p; }
        else { out.push({ text: buf, lang: cur }); buf = p; cur = lg; }
      }
      if (buf) out.push({ text: buf, lang: cur || (def === "en" ? "en" : "tr") });
    }
    while ((m = re.exec(s))) {
      if (m.index > i) plain(s.slice(i, m.index));
      out.push({ text: m[1], lang: "en" });
      i = re.lastIndex;
    }
    if (i < s.length) plain(s.slice(i));
    return out;
  }

  /* ---------- şekil listesi ---------- */
  function shapes(text, def) {
    var segs = segment(text, def), out = [];
    for (var s = 0; s < segs.length; s++) {
      var t = segs[s].text.toLowerCase(), lang = segs[s].lang;
      for (var idx = 0; idx < t.length; idx++) {
        var ch = t[idx], next = t[idx + 1] || "";
        var wordEnd = !next || /[\s.,!?;:…]/.test(next);
        if (lang === "tr") {
          var sh = trShape(ch, next);
          if (sh) out.push({ shape: sh, lang: "tr" });
        } else {
          var r = enShape(ch, next, t[idx - 1] || "", wordEnd);
          if (r.shape) out.push({ shape: r.shape, lang: "en" });
          idx += r.skip;
        }
      }
    }
    return out;
  }

  /* ---------- kare listesi ----------
     map: {a,e,i,o,u,mbp,fv,l,th,idle} — eksik anahtar varsa en yakınına düşer */
  function sequence(text, map, def) {
    var m = map || {}, out = [];
    var fb = { th: ["th", "i"], fv: ["fv", "mbp"], l: ["l", "e"], u: ["u", "o"],
               o: ["o", "u"], mbp: ["mbp", "idle"], a: ["a", "e"], e: ["e", "a"],
               i: ["i", "e"], idle: ["idle"] };
    var list = shapes(text, def);
    for (var k = 0; k < list.length; k++) {
      var chain = fb[list[k].shape] || [list[k].shape];
      for (var c = 0; c < chain.length; c++) {
        if (m[chain[c]]) { out.push(m[chain[c]]); break; }
      }
    }
    return out;
  }

  window.DHViseme = { langOf: langOf, segment: segment, shapes: shapes, sequence: sequence };
})();
