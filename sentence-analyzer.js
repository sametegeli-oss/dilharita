/*!
 * sentence-analyzer.js — Dil Haritası
 * Referans (hedef) cümle ile öğrenci cevabını KELİME HİZALAMASI ile karşılaştırır
 * ve farkları 6 gerçek hata türüne ayırır:
 *   TENSE_ERROR, AUXILIARY_ERROR, WORD_ORDER_ERROR, MISSING_WORD, EXTRA_WORD, WORD_CHOICE_ERROR
 *
 * Tasarım ilkesi: "emin olduğun yerde etiketle, belirsizde AI'ya bırak".
 * Yüzeysel bir POS-parser taklidi yapmaz; yalnızca yüksek güvenli kalıpları etiketler,
 * geri kalanı verdict:"uncertain" ile işaretler → çağıran taraf AI hakeme sorabilir.
 *
 * Bağımlılık yok. window.SentenceAnalyzer olarak açılır.
 *
 * Kullanım:
 *   const r = SentenceAnalyzer.analyze("I went to the store yesterday.", "I go to the shop yesterday");
 *   r.errors   -> [{type:"TENSE_ERROR", ref:"went", user:"go", pos:1}, ...]
 *   r.verdict  -> "correct" | "typo-only" | "labeled" | "uncertain"
 *   r.types    -> ["TENSE_ERROR","WORD_CHOICE_ERROR"]  (learning-error-system uyumlu üst düzey)
 */
(function (global) {
  "use strict";

  // ---- sözlükler ----
  var AUX = new Set(["am","is","are","was","were","be","been","being",
    "do","does","did","have","has","had","will","would","shall","should",
    "can","could","may","might","must"]);
  var ARTICLES = new Set(["a","an","the"]);
  var PRONOUNS = new Set(["i","you","he","she","it","we","they","me","him","her","us","them",
    "my","your","his","its","our","their","mine","yours","hers","ours","theirs"]);
  var PAST_MARKERS = new Set(["yesterday","ago","last","earlier","previously","then","before"]);
  var PRESENT_MARKERS = new Set(["now","today","currently","nowadays","usually","always","often",
    "sometimes","every","daily","generally"]);
  var FUTURE_MARKERS = new Set(["tomorrow","soon","later","next","tonight"]);

  // Yaygın düzensiz fiil: temel biçim <-> geçmiş/participle eşlemesi (fiil kökü aynı mı diye bakmak için)
  var IRREGULAR = {
    "go":["went","gone"], "goes":["went","gone"],
    "eat":["ate","eaten"], "eats":["ate","eaten"],
    "see":["saw","seen"], "sees":["saw","seen"],
    "take":["took","taken"], "takes":["took","taken"],
    "give":["gave","given"], "gives":["gave","given"],
    "come":["came","come"], "comes":["came","come"],
    "make":["made","made"], "makes":["made","made"],
    "buy":["bought","bought"], "buys":["bought","bought"],
    "bring":["brought","brought"], "brings":["brought","brought"],
    "write":["wrote","written"], "writes":["wrote","written"],
    "speak":["spoke","spoken"], "speaks":["spoke","spoken"],
    "break":["broke","broken"], "breaks":["broke","broken"],
    "drive":["drove","driven"], "drives":["drove","driven"],
    "run":["ran","run"], "runs":["ran","run"],
    "get":["got","gotten","got"], "gets":["got","gotten","got"],
    "find":["found","found"], "finds":["found","found"],
    "leave":["left","left"], "leaves":["left","left"],
    "meet":["met","met"], "meets":["met","met"],
    "pay":["paid","paid"], "pays":["paid","paid"],
    "send":["sent","sent"], "sends":["sent","sent"],
    "tell":["told","told"], "tells":["told","told"],
    "think":["thought","thought"], "thinks":["thought","thought"],
    "know":["knew","known"], "knows":["knew","known"],
    "begin":["began","begun"], "begins":["began","begun"],
    "be":["was","were","been"], "is":["was","been"], "are":["were","been"], "am":["was","been"]
  };

  function norm(s){
    return String(s||"").toLowerCase().replace(/[\u2019\u2018]/g,"'")
      .replace(/[^a-z0-9'\s]/g," ").replace(/\s+/g," ").trim();
  }
  function tokenize(s){ return norm(s).split(" ").filter(Boolean); }

  // kısaltma açımı (didn't -> did not) — anlam-eşdeğerliği için
  var CONTRACT = {"don't":"do not","doesn't":"does not","didn't":"did not","isn't":"is not",
    "aren't":"are not","wasn't":"was not","weren't":"were not","can't":"can not","cannot":"can not",
    "couldn't":"could not","won't":"will not","wouldn't":"would not","shouldn't":"should not",
    "mustn't":"must not","haven't":"have not","hasn't":"has not","hadn't":"had not",
    "i'm":"i am","you're":"you are","we're":"we are","they're":"they are","he's":"he is",
    "she's":"she is","it's":"it is","that's":"that is","there's":"there is","let's":"let us","i've":"i have",
    "you've":"you have","we've":"we have","they've":"they have","i'll":"i will","you'll":"you will",
    "he'll":"he will","she'll":"she will","we'll":"we will","they'll":"they will","i'd":"i would"};
  function expand(tokens){
    var out=[];
    tokens.forEach(function(w){ (CONTRACT[w]||w).split(" ").forEach(function(x){ out.push(x); }); });
    return out;
  }

  // tek harf yazım sürçmesi mi? (Damerau-Levenshtein <= 1: ekleme/silme/değiştirme/YER DEĞİŞTİRME)
  function lev1(a,b){
    if(a===b) return false;
    var la=a.length, lb=b.length;
    if(Math.abs(la-lb)>1) return false;
    // klasik edit distance ≤1
    var i=0,j=0,e=0;
    while(i<la && j<lb){
      if(a[i]===b[j]){ i++; j++; continue; }
      if(++e>1) break;
      if(la>lb) i++; else if(lb>la) j++; else { i++; j++; }
    }
    if(e<=1 && (i>=la || j>=lb)){ if(i<la||j<lb) e++; if(e<=1) return true; }
    // bitişik iki harfin yer değiştirmesi (stroe<->store, teh<->the)
    if(la===lb){
      for(var k=0;k<la-1;k++){
        if(a[k]!==b[k] && a[k]===b[k+1] && a[k+1]===b[k]){
          var swapped=a.slice(0,k)+a[k+1]+a[k]+a.slice(k+2);
          if(swapped===b) return true;
        }
      }
    }
    return false;
  }

  // iki kelime aynı fiil kökünden mi geliyor? (go/went, work/working/worked)
  function sameVerbStem(a,b){
    if(a===b) return true;
    // düzenli ekler
    var strip=function(w){ return w.replace(/(ing|ed|es|s)$/,""); };
    if(strip(a)===strip(b) && strip(a).length>=2) return true;
    // düzensiz
    if(IRREGULAR[a] && IRREGULAR[a].indexOf(b)>=0) return true;
    if(IRREGULAR[b] && IRREGULAR[b].indexOf(a)>=0) return true;
    // her ikisi de aynı düzensiz kökün biçimleri mi
    for(var base in IRREGULAR){
      var forms=IRREGULAR[base].concat([base]);
      if(forms.indexOf(a)>=0 && forms.indexOf(b)>=0) return true;
    }
    return false;
  }

  /* Kelime hizalama: LCS tabanlı. İki dizi arasında eşleşen/eklenen/çıkarılan/değişen
     işaretli bir op listesi döndürür: {op:'match'|'sub'|'del'|'ins', r, u, ri, ui} */
  function align(R, U){
    var n=R.length, m=U.length;
    var dp=[]; for(var i=0;i<=n;i++){ dp.push(new Array(m+1).fill(0)); }
    for(i=1;i<=n;i++) for(var j=1;j<=m;j++){
      dp[i][j] = (R[i-1]===U[j-1]) ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
    }
    // geri izleme → eşleşme iskeleti
    var ops=[]; i=n; var jj=m;
    while(i>0 && jj>0){
      if(R[i-1]===U[jj-1]){ ops.unshift({op:"match", r:R[i-1], u:U[jj-1], ri:i-1, ui:jj-1}); i--; jj--; }
      else if(dp[i-1][jj] >= dp[i][jj-1]){ ops.unshift({op:"del", r:R[i-1], ri:i-1}); i--; }
      else { ops.unshift({op:"ins", u:U[jj-1], ui:jj-1}); jj--; }
    }
    while(i>0){ ops.unshift({op:"del", r:R[i-1], ri:i-1}); i--; }
    while(jj>0){ ops.unshift({op:"ins", u:U[jj-1], ui:jj-1}); jj--; }

    // komşu del+ins ikilisini 'sub' (değişim) olarak birleştir
    var merged=[];
    for(var k=0;k<ops.length;k++){
      var cur=ops[k], nxt=ops[k+1];
      if(cur.op==="del" && nxt && nxt.op==="ins"){
        merged.push({op:"sub", r:cur.r, u:nxt.u, ri:cur.ri, ui:nxt.ui}); k++;
      } else if(cur.op==="ins" && nxt && nxt.op==="del"){
        merged.push({op:"sub", r:nxt.r, u:cur.u, ri:nxt.ri, ui:cur.ui}); k++;
      } else merged.push(cur);
    }
    return merged;
  }

  // Bir sub (değişim) hangi hata türü? {type, confident}
  function classifySub(rWord, uWord, refTokens){
    // 1) yardımcı fiil değişimi (is<->are, was<->were, do<->does...) → AUXILIARY
    if(AUX.has(rWord) && AUX.has(uWord)){
      return { type:"AUXILIARY_ERROR", confident:true };
    }
    // 2) aynı fiil kökü, farklı çekim → TENSE (go<->went, works<->work).
    //    Bu, tek harf farkı olsa bile (works/work) typo DEĞİL çekim hatasıdır → önce bak.
    if(sameVerbStem(rWord, uWord)){
      return { type:"TENSE_ERROR", confident:true };
    }
    // 3) yazım sürçmesi (gerçek fiil çekimi değil + tek harf/transpozisyon) → TYPO
    if(lev1(rWord, uWord)){
      return { type:"TYPO", confident:true };
    }
    // 4) tanımlık / zamir değişimi → etiketli, düşük öncelikli
    if((ARTICLES.has(rWord)&&ARTICLES.has(uWord)) || (PRONOUNS.has(rWord)&&PRONOUNS.has(uWord))){
      return { type:"WORD_CHOICE_ERROR", confident:true };
    }
    // 5) tamamen farklı kelime → WORD_CHOICE ama EŞANLAMLI olabilir → EMIN DEĞİL (AI'ya bırak)
    return { type:"WORD_CHOICE_ERROR", confident:false };
  }

  /* Ana analiz. */
  function analyze(refEn, userEn){
    var Rraw=tokenize(refEn), Uraw=tokenize(userEn);
    var R=expand(Rraw), U=expand(Uraw);
    var result = { errors:[], types:[], verdict:"correct", typoCount:0, uncertain:false,
                   refExpanded:R.join(" "), userExpanded:U.join(" ") };

    if(!R.length){ result.verdict="uncertain"; result.uncertain=true; return finalize(result); }

    // tümü eşit (kısaltma/he-she farkı hariç zaten expand'de eşitlenmedi; birebir)
    if(R.join(" ")===U.join(" ")){ result.verdict="correct"; return finalize(result); }

    /* WORD_ORDER: aynı kelime kümesi (aynı çokluk) ama sıra farklı → sıralama hatası.
       Konumsal/LCS ayrıştırmasından ÖNCE bak, yoksa sıra hatası kelime-değişimi sanılır. */
    var rSet0={}, uSet0={};
    R.forEach(function(w){ rSet0[w]=(rSet0[w]||0)+1; });
    U.forEach(function(w){ uSet0[w]=(uSet0[w]||0)+1; });
    var sameMultiset0 = R.length===U.length &&
      Object.keys(rSet0).length===Object.keys(uSet0).length &&
      Object.keys(rSet0).every(function(w){ return uSet0[w]===rSet0[w]; });
    if(sameMultiset0 && R.join(" ")!==U.join(" ")){
      result.errors.push({ type:"WORD_ORDER_ERROR", ref:refEn, user:userEn });
      result.types.push("WORD_ORDER_ERROR");
      result.verdict="labeled";
      return finalize(result);
    }

    /* HIZLI YOL: kelime sayısı aynıysa konum-konum hizala. Bu, ardışık yazım
       sürçmelerinde (tecnical suport) LCS'in kaymasını önler. */
    if(R.length===U.length){
      for(var p=0;p<R.length;p++){
        if(R[p]===U[p]) continue;
        var c=classifySub(R[p],U[p],R);
        if(c.type==="TYPO"){ result.typoCount++; result.errors.push({type:"TYPO",ref:R[p],user:U[p],pos:p,confident:true}); }
        else {
          result.errors.push({type:c.type,ref:R[p],user:U[p],pos:p,confident:c.confident});
          result.types.push(c.type);
          if(!c.confident) result.uncertain=true;
        }
      }
      var realE = result.errors.filter(function(e){return e.type!=="TYPO";});
      if(realE.length===0 && result.typoCount>0) result.verdict="typo-only";
      else if(realE.length===0) result.verdict="correct";
      else if(result.uncertain) result.verdict="uncertain";
      else result.verdict="labeled";
      return finalize(result);
    }

    var ops=align(R,U);

    ops.forEach(function(o){
      if(o.op==="match") return;
      if(o.op==="del"){
        var t = AUX.has(o.r) ? "AUXILIARY_ERROR" : "MISSING_WORD";
        result.errors.push({ type:t, ref:o.r, user:null, pos:o.ri, kind:"missing" });
        result.types.push(t);
      } else if(o.op==="ins"){
        var t2 = AUX.has(o.u) ? "AUXILIARY_ERROR" : "EXTRA_WORD";
        result.errors.push({ type:t2, ref:null, user:o.u, pos:o.ui, kind:"extra" });
        result.types.push(t2);
      } else if(o.op==="sub"){
        var c = classifySub(o.r, o.u, R);
        if(c.type==="TYPO"){ result.typoCount++; result.errors.push({ type:"TYPO", ref:o.r, user:o.u, pos:o.ri, confident:true }); }
        else {
          result.errors.push({ type:c.type, ref:o.r, user:o.u, pos:o.ri, confident:c.confident });
          result.types.push(c.type);
          if(!c.confident) result.uncertain=true;   // eşanlamlı olabilir → AI'ya bırak
        }
      }
    });

    // verdict kararı
    var realErrors = result.errors.filter(function(e){ return e.type!=="TYPO"; });
    if(realErrors.length===0 && result.typoCount>0){ result.verdict="typo-only"; }
    else if(realErrors.length===0){ result.verdict="correct"; }
    else if(result.uncertain){ result.verdict="uncertain"; }   // en az bir belirsiz kelime farkı
    else { result.verdict="labeled"; }                          // hepsi kesin etiketli

    return finalize(result);
  }

  function finalize(r){
    r.types = r.types.filter(function(v,i,a){ return a.indexOf(v)===i; });
    return r;
  }

  var SentenceAnalyzer = {
    analyze: analyze,
    align: align,
    _sameVerbStem: sameVerbStem,
    _classifySub: classifySub
  };

  if (typeof module !== "undefined" && module.exports) module.exports = SentenceAnalyzer;
  if (typeof global !== "undefined") global.SentenceAnalyzer = SentenceAnalyzer;
})(typeof window !== "undefined" ? window : this);
