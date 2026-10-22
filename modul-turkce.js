/* modul-turkce.js — modül kartlarının altına konunun Türkçe adı
   ------------------------------------------------------------------
   Modül adları İngilizce dilbilgisi terimi ("A1-M05 Possessives · P1").
   React kartına düğüm eklemek yerine karta data-tr özniteliği yazılır,
   metin CSS ::after ile gösterilir (React'in DOM'u bozulmaz). */
(function () {
  "use strict";
  if (window.__dhModulTurkce) return; window.__dhModulTurkce = true;
  var TR = {
    "Be Verb":"olmak fiili (am / is / are)","Be Verb Negative":"olumsuz: isn't / aren't","Be Verb Questions":"soru: Is it? / Are you?",
    "Have / Has":"sahip olmak (have / has)","Possessives":"iyelik: my, your, 's","Articles":"a / an / the",
    "Demonstratives":"this / that / these / those","There Is / There Are":"var / yok (there is / are)","Family":"aile",
    "Food & Drinks":"yiyecek ve içecek","Shopping":"alışveriş","Weather":"hava durumu","Directions":"yol tarifi",
    "Past Simple":"geçmiş zaman (-di)","Pres. Cont.":"şimdiki zaman (-iyor)","Some / Any":"biraz / hiç (some / any)",
    "Some/Any":"biraz / hiç (some / any)","Much / Many":"çok (much / many)","Much/Many":"çok (much / many)",
    "How Much / How Many":"ne kadar / kaç tane","Present Continuous Future":"-iyor ile gelecek planı",
    "Modal Can":"-ebilmek (can)","Modal Could":"-ebilirdi ve rica (could)","Requests & Offers":"rica ve teklif",
    "Travel":"seyahat","Hotel":"otel","Airport":"havalimanı","Restaurant":"restoran","Doctor":"doktor",
    "Telephone English":"telefonda konuşma","Work Basics":"iş hayatı","Hobbies":"hobiler","Daily Problems":"günlük sorunlar",
    "Common Turkish Learner Errors":"Türklerin sık yaptığı hatalar","Present Perfect":"yakın geçmiş (have done)",
    "Present Perfect vs Past Simple":"have done mı, did mi?","For / Since":"-dir / -den beri (for / since)",
    "Yet / Already / Just":"henüz / çoktan / az önce","First Conditional":"gerçek koşul (if ... will)",
    "Second Conditional":"hayali koşul (if ... would)","Passive Voice Basics":"edilgen yapı (temel)",
    "Relative Clauses":"bağlayan yan cümle (who / which / that)","Passive Voice Advanced":"edilgen yapı (ileri)",
    "Reporting Verbs":"aktarma fiilleri","Quantifiers":"miktar sözcükleri","Modal Verbs":"kip fiilleri (must, should…)",
    "Used to / Would":"eskiden yapardım (used to)","Conditionals":"koşul cümleleri","Meetings":"toplantılar",
    "Reported Speech":"dolaylı anlatım","Deduction":"tahmin etme (must be, can't be)","Modals":"kip fiilleri",
    "Adj vs Adv":"sıfat mı, zarf mı?","Prepositions":"edatlar (in / on / at)","Too/Enough":"çok fazla / yeterince",
    "Past Cont.":"geçmişte süren eylem (-iyordu)","Review":"tekrar","Present Perfect Continuous":"süregelen eylem (have been doing)",
    "Past Perfect":"-mişti (had done)","Future Perfect":"-miş olacak (will have done)","Passive":"edilgen yapı",
    "Future":"gelecek zaman","Comparatives":"karşılaştırma (-den daha)","Superlatives":"en … (en büyük)",
    "Count/Uncount":"sayılabilen / sayılamayan","Passive Advanced":"edilgen yapı (ileri)",
    "Relative Clauses Advanced":"bağlayan yan cümle (ileri)","Conditionals Advanced":"koşul cümleleri (ileri)",
    "Noun Clauses Advanced":"isim cümlecikleri (ileri)","Inversion Advanced":"devrik yapı (ileri)",
    "Advanced Modals":"kip fiilleri (ileri)","Advanced Verbal Structures":"ileri fiil yapıları",
    "-Decision":"karar","-Responsibility":"sorumluluk","-Weather":"hava","-Economy":"ekonomi","-Achievement":"başarı",
    "-Habits":"alışkanlıklar","-Social":"sosyal hayat","-Work":"iş","-Business":"ticaret","-Communication":"iletişim",
    "-Personal":"kişisel konular","-Health":"sağlık","-Travel":"seyahat","-Life":"hayat","-Problem":"sorun",
    "-Attention":"dikkat","-Chance":"şans","-Friendship":"arkadaşlık","-General":"genel","-Tech":"teknoloji",
    "-Nature":"doğa","-Daily":"günlük hayat","-Education":"eğitim","-Academic":"akademik","-Meeting":"toplantı",
    "-Email":"e-posta","-Hotel":"otel","-Airport":"havalimanı","-Restaurant":"restoran","-Doctor":"doktor",
    "-Telephone":"telefon","-Hobbies":"hobiler","-Problems":"sorunlar","-Errors":"sık yapılan hatalar",
    "Advanced Conditionals":"koşul cümleleri (ileri)","Inversion":"devrik yapı","Cleft Sentences":"vurgulu cümle (It was … that)",
    "Advanced Passive":"edilgen yapı (ileri)","Advanced Reporting Verbs":"aktarma fiilleri (ileri)",
    "Hedging Language":"temkinli anlatım","Discourse Markers":"bağlayıcı ifadeler","Nominalisation":"isimleştirme",
    "Advanced Collocations":"birlikte kullanılan sözcükler","Idioms":"deyimler","Advanced Phrasal Verbs":"öbek fiiller (ileri)",
    "Academic Writing":"akademik yazı","Critical Thinking":"eleştirel düşünme","Argumentation":"fikir savunma",
    "Debate Skills":"tartışma becerisi","Leadership":"liderlik","Strategy":"strateji","Innovation":"yenilik",
    "Cohesion":"metin bütünlüğü","Participle":"ortaç yapıları (-ing / -ed)","Cleft":"vurgulu cümle","Ellipsis":"eksiltme"
  };
  function ad(metin) {
    var b = String(metin || "").replace(/^[A-C][12]-M\d+\s*/, "").replace(/\s*·\s*P\d+\s*$/, "").trim();
    return TR[b] || "";
  }
  var st = document.createElement("style");
  st.textContent = ".module-tile[data-tr]::after{content:attr(data-tr);display:block;margin-top:4px;color:#93c5fd;font-weight:700;font-size:.85em;line-height:1.3}";
  (document.head || document.documentElement).appendChild(st);
  function isle() {
    var l = document.querySelectorAll(".module-tile");
    for (var i = 0; i < l.length; i++) {
      var n = l[i].querySelector(".module-name");
      if (!n) continue;
      var t = ad(n.textContent);
      if (t && l[i].getAttribute("data-tr") !== t) l[i].setAttribute("data-tr", t);
    }
  }
  var bekle = null;
  new MutationObserver(function () { if (bekle) return; bekle = setTimeout(function () { bekle = null; isle(); }, 120); })
    .observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", isle); else isle();
})();
