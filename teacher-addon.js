/* ============================================================
   teacher-addon.js — Çalışma kartına "🎓 Öğretmen" düğmesi ekler.
   app.js'e DOKUNMAZ. card-actions içine düğme koyar; tıklayınca
   o cümleyi teacher.html'e (tam ekran panel) taşır.
   ============================================================ */
(function(){
"use strict";

function injectButton(card){
  const actions = card.querySelector(".card-actions");
  if (!actions) return;
  if (actions.querySelector(".sm-teacher-btn")) return;   // zaten var
  const enEl = card.querySelector(".card-en");
  const trEl = card.querySelector(".card-tr");
  if (!enEl) return;

  const btn = document.createElement("button");
  btn.className = "btn sm-teacher-btn";
  btn.textContent = "🎓 Öğretmen";
  btn.style.cssText = "background:linear-gradient(135deg,#34d399,#16a34a);color:#fff;border-color:transparent";
  btn.onclick = () => {
    const en = (card.querySelector(".card-en")?.textContent || "").trim();
    const tr = (card.querySelector(".card-tr")?.textContent || "").trim();
    if (!en) return;
    const url = "./teacher-chat.html?s=" + encodeURIComponent(en) + (tr ? "&t=" + encodeURIComponent(tr) : "");
    location.href = url;
  };
  actions.appendChild(btn);
}

function scan(){
  const card = document.querySelector(".card");
  if (card) injectButton(card);
}
function start(){
  const mo = new MutationObserver(() => scan());
  mo.observe(document.body, { childList:true, subtree:true });
  scan();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();

})();
