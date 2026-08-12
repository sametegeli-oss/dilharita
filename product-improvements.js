(() => {
  "use strict";
  const ready = fn => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn();
  ready(() => {
    const main = document.querySelector("main,[role=main],.container,.app") || document.body;
    if (!main.id) main.id = "ana-icerik";
    const skip = document.createElement("a");
    skip.className = "dh-skip"; skip.href = `#${main.id}`; skip.textContent = "Ana içeriğe geç";
    document.body.prepend(skip);

    if (!document.querySelector("h1")) {
      const h = document.createElement("h1"); h.className = "sr-only";
      h.textContent = document.title.replace(/\s*[|–-].*$/, "") || "DİLHARİTA"; main.prepend(h);
    }
    document.querySelectorAll("img:not([alt])").forEach(img => img.alt = "");
    document.querySelectorAll("input,select,textarea").forEach((el, i) => {
      if (el.type === "hidden" || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return;
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return;
      el.setAttribute("aria-label", el.placeholder || el.name || el.title || `Giriş alanı ${i + 1}`);
    });
    document.querySelectorAll("button:not([aria-label])").forEach(b => {
      if (!b.textContent.trim() && b.title) b.setAttribute("aria-label", b.title);
    });

    const route = location.pathname.split("/").pop().toLowerCase();
    if (/^(chatteacher[12]?|chatairport|chatdoctor|chathotel|chatrestaurant)\.html$/.test(route)) document.body.classList.add("dh-chat-focus");
    const items = [
      ["🏠","Bugün","index.html",["index.html","bugun.html"]],
      ["📘","Öğren","ders.html",["ders.html","practice.html","index-app.html","ogren.html","kelime-ogren.html","phrasal-verbs.html"]],
      ["🔁","Tekrar","tekrar.html",["tekrar.html","akilli-tekrar.html","hata-defteri.html"]],
      ["🎙️","Konuş","chat.html",["chat.html","teacher.html","sesdalga.html","chatairport.html","chatdoctor.html","chathotel.html","chatrestaurant.html"]],
      ["📈","İlerleme","rapor.html",["rapor.html","aktivite.html","harita.html","ilerleme.html","gunluk-takip.html","ogrenme-yolu.html"]]
    ];
    const nav = document.createElement("nav"); nav.className = "dh-primary-nav"; nav.setAttribute("aria-label", "Ana bölümler");
    nav.innerHTML = items.map(([ic,tx,href,routes]) => `<a href="${href}"${routes.includes(route) ? ' aria-current="page"' : ""}><span aria-hidden="true">${ic}</span>${tx}</a>`).join("");
    document.body.append(nav);

    const net = document.createElement("div"); net.className = "dh-net-status"; net.setAttribute("role","status"); net.setAttribute("aria-live","polite");
    const updateNet = () => { const on = navigator.onLine; net.textContent = on ? "● Çevrimiçi" : "● Çevrimdışı — yerel özellikler açık"; net.classList.toggle("offline", !on); };
    addEventListener("online", updateNet); addEventListener("offline", updateNet); updateNet(); document.body.append(net);
  });
})();
