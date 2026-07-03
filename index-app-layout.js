/* index-app-layout.js — DÜZEN TOPARLAYICI (v18 — Manuel Düzen Seçimli Kararlı Sürüm)
   1) Otomatik yatay mod tespiti kaldırıldı; "📱 Düzen" butonu ile manuel geçiş sağlandı.
   2) Seçilen mod hafızaya (localStorage) kaydedilir, kelime geçişlerinde korunur.
   3) Öğretmen ve Zayıf Analiz butonları sonsuz döngü/titreme yaratmadan gizlendi.
   4) Navigasyon barı (Önceki-Araçlar-Sonraki) Zor-Normal-Kolay butonlarının hemen altındadır.
*/
(function(){
  "use strict";
  var STYLE_ID="dh-ia-layout-css";
  var applying=false, scheduled=false;

  // Hafızadaki modu oku (varsayılan: dikey/normal)
  var currentMode = localStorage.getItem("dh-layout-mode") || "normal";

  function addStyle(){
    var existing = document.getElementById(STYLE_ID);
    if(existing) existing.remove(); // Dinamik mod değişimi için eski stili temizle
    
    var s=document.createElement("style"); s.id=STYLE_ID;
    
    // Her iki modda da geçerli olan ortak temizlik kuralları
    var css = ".legend,.legend-item,.legend-dot{display:none !important}"
    +" .study-nav .legend,.study-nav .legend-item{display:none !important}"
    +" .card-actions .teacher-btn, .card-actions .extra-weak, button.teacher-btn, button.extra-weak, "
    +"[class*='teacher'], [class*='weak'], :has(> button:contains('Öğretmen')), :has(> button:contains('Zayıf')) {"
    +"  display:none !important; width:0 !important; height:0 !important; margin:0 !important; padding:0 !important; "
    +"  overflow:hidden !important; position:absolute !important; pointer-events:none !important; visibility:hidden !important; opacity:0 !important;"
    +"}";

    if (currentMode === "yatay") {
      /* ---- KULLANICI YATAY MODU SEÇTİĞİNDE DEVREYE GİRECEK 0-SCROLL TAM EKRAN CSS ---- */
      css += ".study-header, .study-progress, .study-header *, [class*='header'], :has(> .btn:contains('Liste')){display:none !important}"
      +"body, html {overflow:hidden !important; height:100vh !important; max-height:100vh !important; padding:0 !important; margin:0 !important; background:#040a18 !important;}"
      +".study-main{padding:4px !important; margin:0 !important; height:100vh !important; display:flex !important; align-items:center !important; justify-content:center !important; box-sizing:border-box !important;}"
      
      /* Ana Kartı İki Sütun Yap ve Sığdır */
      +".card.dh-split{display:grid !important; width:100vw !important; height:98vh !important; max-height:98vh !important; padding:6px !important; gap:6px 10px !important; margin:0 !important; box-sizing:border-box !important; overflow:hidden !important; grid-template-columns:1.3fr 1fr !important; align-items:stretch !important;}"
      
      /* SOL SÜTUN: Resim kutusu ve metin bindirmeleri */
      +".card.dh-split .sm-img-wrap{grid-row:1/3 !important; grid-column:1 !important; margin:0 !important; height:100% !important; position:relative !important; display:flex !important; flex-direction:column !important; overflow:hidden !important; border-radius:10px !important;}"
      +".card.dh-split .sm-img-wrap img, .card.dh-split .sm-img{height:100% !important; max-height:100% !important; width:100% !important; object-fit:cover !important; display:block !important; border-radius:10px !important;}"
      
      /* İngilizce Cümle */
      +".card.dh-split .card-en{position:absolute !important; bottom:40px !important; left:0 !important; right:0 !important; z-index:10 !important; margin:0 !important; padding:6px 10px !important; background:rgba(4,10,24,.85) !important; backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); font-size:15px !important; line-height:1.2 !important; text-align:center !important; width:100% !important; box-sizing:border-box !important;}"
      
      /* Okunuş / IPA */
      +".card.dh-split .card-pron{position:absolute !important; bottom:22px !important; left:0 !important; right:0 !important; z-index:9 !important; margin:0 !important; padding:2px 10px !important; background:rgba(4,10,24,.70) !important; font-size:11px !important; text-align:center !important; color:#ecc94b !important; width:100% !important; box-sizing:border-box !important; display:block !important;}"
      
      /* Türkçe Anlam */
      +".card.dh-split .card-tr{position:absolute !important; bottom:0 !important; left:0 !important; right:0 !important; z-index:10 !important; margin:0 !important; padding:4px 10px !important; background:rgba(12,24,48,.95) !important; color:#cfe0ff !important; font-size:12px !important; line-height:1.2 !important; text-align:center !important; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100% !important; box-sizing:border-box !important; grid-row:auto !important; grid-column:auto !important;}"
      
      +".card.dh-split .dh-gtr-btn{display:none !important;}"
      
      /* SAĞ SÜTUN: Buton Düzeni */
      +".card.dh-split .dh-col-right{grid-column:2 !important; grid-row:1/3 !important; display:flex !important; flex-direction:column !important; justify-content:flex-start !important; height:100% !important; gap:6px !important; margin:0 !important; overflow:hidden !important;}"
      
      /* 1. Sıra: Dereceler */
      +".card.dh-split .dh-grade-under{margin:0 !important; gap:4px !important; display:flex !important; order:1 !important; width:100% !important; flex-direction:row !important;}"
      +".card.dh-split .dh-grade-under button{flex:1 !important; min-height:34px !important; max-height:36px !important; padding:2px !important; font-size:12px !important; border-radius:6px !important; font-weight:800 !important; white-space:nowrap; overflow:hidden;}"
      
      /* 2. Sıra: Navigasyon Alt Barı (Hemen Derecelerin Altında) */
      +".study-nav.dh-card-nav{margin:2px 0 !important; padding:0 !important; gap:4px !important; order:2 !important; width:100% !important; display:flex !important; position:relative !important; background:transparent !important; border-top:none !important; box-shadow:none !important;}"
      +".study-nav.dh-card-nav .btn{min-height:36px !important; max-height:38px !important; font-size:12px !important; border-radius:8px !important; flex:1 !important; font-weight:800 !important;}"
      +".dh-tools-toggle, .dh-layout-toggle{min-height:36px !important; max-height:38px !important; padding:0 8px !important; border-radius:8px !important;}"
      
      /* 3. Sıra: Dinle, Yavaş, Detay */
      +".card.dh-split .card-actions{display:grid !important; grid-template-columns:1fr 1fr !important; gap:4px !important; margin:2px 0 0 0 !important; padding:0 !important; order:3 !important; width:100% !important;}"
      +".card.dh-split .card-actions button, .card.dh-split .card-actions .btn{min-height:32px !important; max-height:36px !important; padding:2px 4px !important; font-size:11px !important; border-radius:6px !important; margin:0 !important; display:flex !important; align-items:center !important; justify-content:center !important;}"
      
      +".card.dh-split > div:has(.chip-level), .card.dh-split div[class*='chip']{display:none !important}";
    } else {
      /* ---- NORMAL MOD VARSAYILAN SİTE CSS AYARLARI ---- */
      css += ".dh-col-left,.dh-col-right{display:block; width:100%;}"
      +".study-nav.dh-card-nav{position:relative !important;display:flex !important;gap:6px;align-items:center;justify-content:space-between;margin:10px 0 0 !important;padding:0 !important;background:transparent !important;border-top:none !important;box-shadow:none !important;width:100%}"
      +".study-nav.dh-card-nav .btn{flex:1;min-height:40px;font-size:13px !important;font-weight:800 !important;border-radius:10px !important;padding:4px 8px !important}"
      +".study-nav.dh-card-nav > *:not(.btn):not(.dh-tools-toggle):not(.dh-layout-toggle){flex:0 0 auto}"
      +".dh-grade-under{display:flex !important;flex-direction:row !important;gap:4px;margin:10px 0 4px;width:100%}"
      +".dh-grade-under button{flex:1;min-height:38px;border-radius:10px;font-weight:800;font-size:13px;border:1px solid rgba(255,255,255,.14);cursor:pointer;padding:4px}";
    }

    /* Mod Değiştirme Butonu Ortak Tasarımı */
    css += ".dh-layout-toggle{flex:0 0 auto !important; min-height:40px; padding:0 10px; border:1px solid rgba(255,255,255,.14); border-radius:10px; background:#1e293b; color:#38bdf8; font:800 12px system-ui; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:2px; white-space:nowrap;}"
    +".dh-layout-toggle:hover{background:#334155}"
    +".dh-tools-toggle{flex:0 0 auto !important;min-height:40px;padding:0 12px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:#17233a;color:#eaf2ff;font:900 13px Nunito,system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap}"
    +".dh-tools-toggle:hover{background:#22304f}"
    +".dh-tools-box{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:8999;width:90%;max-width:400px;margin:0;padding:14px;max-height:50vh;overflow-y:auto;border-radius:16px;background:#0d1a30;border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 40px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:10px;}"
    +".dh-hidden{display:none !important}"
    +".dh-tools-box .dh-custom-btn{width:100%;min-height:42px;border-radius:10px;display:flex !important;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.15);font-weight:800;font-size:13px;cursor:pointer;background:#1e293b;color:#f8fafc;}"
    +".dh-tools-title{font:900 13px Nunito,system-ui,sans-serif;color:#9fb3d9;text-align:center;}";

    s.textContent = css;
    document.head.appendChild(s);
  }

  function currentCard(){
    var cards=[].slice.call(document.querySelectorAll(".card"));
    return cards.find(function(c){ return c.querySelector(".card-en") || c.querySelector("[class*='card-en']"); });
  }

  function btnByText(root, txt){
    var t=txt.toLocaleLowerCase("tr");
    return [].slice.call(root.querySelectorAll("button,a")).find(function(b){
      return (b.textContent||"").toLocaleLowerCase("tr").indexOf(t)>=0;
    })||null;
  }

  function softHideButtons(root){
    if(!root) return;
    var targets = [].slice.call(root.querySelectorAll("button, a"));
    targets.forEach(function(b){
      var text = (b.textContent || "").toLocaleLowerCase("tr");
      if(text.indexOf("öğretmen") >= 0 || text.indexOf("zayıf") >= 0 || b.classList.contains("teacher-btn") || b.classList.contains("extra-weak")){
        b.style.cssText = "display:none !important; width:0 !important; height:0 !important; visibility:hidden !important; opacity:0 !important; position:absolute !important; pointer-events:none !important;";
      }
    });
  }

  function fixNav(rightCol){
    var nav=document.querySelector(".study-nav") || document.querySelector("[class*='study-nav']");
    if(!nav) return null;
    if(!nav.classList.contains("dh-card-nav")) nav.classList.add("dh-card-nav");
    
    // Yatay modda sağ sütuna bağla, Normal modda kartın altına bırak
    if(currentMode === "yatay" && rightCol && nav.parentElement !== rightCol){
      rightCol.appendChild(nav);
    } else if(currentMode === "normal" && rightCol && nav.parentElement === rightCol) {
      var card = currentCard();
      if(card) card.appendChild(nav);
    }
    return nav;
  }

  function moveGrade(card){
    if(card.dataset.dhGradeDone==currentMode) return; // Mod değiştiyse yeniden düzenle
    var tr=card.querySelector(".card-tr") || card.querySelector("[class*='card-tr']"); 
    if(!tr) return;

    var zor=card.querySelector(".grade-hard")||btnByText(card,"zor");
    var nor=card.querySelector(".grade-normal")||btnByText(card,"normal");
    var kol=card.querySelector(".grade-easy")||btnByText(card,"kolay");
    if(!(zor&&nor&&kol)) return;
    
    var grp=card.querySelector(".dh-grade-under");
    if(!grp){ grp=document.createElement("div"); grp.className="dh-grade-under"; }
    grp.appendChild(zor); grp.appendChild(nor); grp.appendChild(kol);
    
    var anchor=card.querySelector(".card-pron") || card.querySelector("[class*='card-pron']") || tr;
    anchor.insertAdjacentElement("afterend", grp);
    card.dataset.dhGradeDone = currentMode;
  }

  function splitCard(card){
    softHideButtons(card);
    
    if(currentMode === "normal") {
      card.classList.remove("dh-split");
      card.dataset.dhSplitDone = "0";
      return null;
    }
    
    if(card.dataset.dhSplitDone==="1") return card.querySelector(".dh-col-right");
    
    var enEl=card.querySelector(".card-en") || card.querySelector("[class*='card-en']"); 
    if(!enEl){ return null; }
    
    var grade=card.querySelector(".dh-grade-under");
    var actions=card.querySelector(".card-actions") || card.querySelector("[class*='card-actions']");
    if(!grade || !actions){ return null; }

    var right=card.querySelector(".dh-col-right");
    if(!right) {
      right = document.createElement("div");
      right.className="dh-col-right";
    }
    
    var q=[].slice.call(card.querySelectorAll("*")).find(function(e){
      return e.children.length===0 && /ne kadar biliyorsun/i.test(e.textContent||"");
    });
    if(q) { q.remove(); }
    
    right.appendChild(grade);
    right.appendChild(actions);
    
    card.appendChild(right);
    card.classList.add("dh-split");
    card.dataset.dhSplitDone="1";
    return right;
  }

  /* MANUEL GEÇİŞ BUTONUNU OLUŞTURMA VE ENJEKTE ETME METODU */
  function ensureToggleButtons(nav){
    if(!nav) return;
    var btnToggle = document.getElementById("dhLayoutToggle");
    if(!btnToggle){
      btnToggle = document.createElement("button");
      btnToggle.id = "dhLayoutToggle";
      btnToggle.type = "button";
      btnToggle.className = "dh-layout-toggle";
      btnToggle.onclick = function(){
        currentMode = (currentMode === "yatay") ? "normal" : "yatay";
        localStorage.setItem("dh-layout-mode", currentMode);
        
        // Kart durum etiketlerini sıfırla ki yeniden renderlansın
        var card = currentCard();
        if(card){
          delete card.dataset.dhSplitDone;
          delete card.dataset.dhGradeDone;
        }
        apply();
      };
    }
    
    // Mod metnini güncelle
    btnToggle.innerHTML = currentMode === "yatay" ? "📱 Yatay" : "📱 Normal";

    if(btnToggle.parentElement !== nav){
      var btns = [].slice.call(nav.querySelectorAll(".btn"));
      if(btns.length >= 2){ nav.insertBefore(btnToggle, btns[btns.length-1]); }
      else nav.appendChild(btnToggle);
    }
  }

  function ensureTools(card, nav){
    var box=document.getElementById("dhToolsBox");
    var toggle=document.getElementById("dhToolsToggle");
    
    if(!box){
      box=document.createElement("div");
      box.id="dhToolsBox"; box.className="dh-tools-box dh-hidden";
      box.innerHTML='<div class="dh-tools-title">🛠 Araçlar</div>';
      
      var btnDetay = document.createElement("button");
      btnDetay.className = "dh-custom-btn"; btnDetay.innerHTML = "🔍 Detay";
      btnDetay.onclick = function(){
        var target = btnByText(document.querySelector(".card"), "detay");
        if(target) target.click();
      };
      box.appendChild(btnDetay);
      document.body.appendChild(box);
    }

    if(!toggle){
      toggle=document.createElement("button");
      toggle.id="dhToolsToggle"; toggle.type="button"; toggle.className="dh-tools-toggle";
      toggle.innerHTML='🛠 <span class="chev">▾</span>';
      toggle.onclick=function(){
        var hid=box.classList.toggle("dh-hidden");
        toggle.classList.toggle("open", !hid);
      };
    }
    
    if(nav && toggle.parentElement!==nav){
      var btns=[].slice.call(nav.querySelectorAll(".btn"));
      if(btns.length>=2){ nav.insertBefore(toggle, btns[btns.length-1]); }
      else nav.appendChild(toggle);
    }
  }

  function apply(){
    if(applying) return;
    applying=true;
    try{
      addStyle();
      var card=currentCard();
      if(card) { softHideButtons(card); }
      var rightCol=null;
      if(card){ 
        moveGrade(card); 
        rightCol = splitCard(card);
      }
      var nav=fixNav(rightCol);
      ensureToggleButtons(nav);
      ensureTools(card, nav);
    }catch(e){}
    applying=false;
  }

  function schedule(){
    if(scheduled) return;
    scheduled=true;
    setTimeout(function(){ scheduled=false; apply(); }, 150);
  }

  function boot(){
    apply();
    try{
      new MutationObserver(function(){ if(applying) return; schedule(); })
        .observe(document.body,{childList:true,subtree:true});
    }catch(e){}
    var n=0, t=setInterval(function brush(){ apply(); if(++n>12) clearInterval(t); }, 400);
  }
  if(document.readyState!=="loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();