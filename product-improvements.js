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
    if (/^chatteacher[12]?\.html$/.test(route)) document.body.classList.add("dh-teacher-focus");
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

    /* Mobilde bütün gezinmeyi tek, kaybolmayan düğmede topla. Panel DOM'un
       sonunda ve fixed olduğu için ekran başlıklarının flex/overflow kuralları
       tarafından daraltılamaz veya kesilemez. */
    const mobileTools = [
      ["🧭","Tüm araçlar","menu.html"],
      ["🗂️","Modüllerim","modullerim.html"],
      ["📚","Kitaplık","library.html"],
      ["🎯","Hata Defteri","hata-defteri.html"],
      ["🧑‍🏫","AI Öğretmen","teacher.html"],
      ["⚙️","Profil ve ayarlar","basla.html?edit=1"]
    ];
    const mobileMenuButton=document.createElement("button");
    mobileMenuButton.type="button";mobileMenuButton.className="dh-mobile-menu-button";
    mobileMenuButton.setAttribute("aria-label","Bütün menüleri aç");mobileMenuButton.setAttribute("aria-expanded","false");
    mobileMenuButton.innerHTML='<span aria-hidden="true">☰</span><b>Menü</b>';
    const mobileMenu=document.createElement("div");mobileMenu.className="dh-mobile-menu";mobileMenu.hidden=true;
    mobileMenu.innerHTML='<div class="dh-mobile-menu__backdrop" data-dh-close></div><aside class="dh-mobile-menu__panel" role="dialog" aria-modal="true" aria-label="Uygulama menüsü"><header><div><strong>Dil Harita</strong><small>Bütün bölümler</small></div><button type="button" data-dh-close aria-label="Menüyü kapat">×</button></header><div class="dh-mobile-menu__scroll"><h2>Ana bölümler</h2><nav class="dh-mobile-menu__grid">'+items.map(([ic,tx,href,routes])=>`<a href="${href}"${routes.includes(route)?' aria-current="page"':""}><span aria-hidden="true">${ic}</span><b>${tx}</b></a>`).join("")+'</nav><h2>Diğer araçlar</h2><nav class="dh-mobile-menu__tools">'+mobileTools.map(([ic,tx,href])=>`<a href="${href}"><span aria-hidden="true">${ic}</span>${tx}<i aria-hidden="true">›</i></a>`).join("")+'</nav></div></aside>';
    let menuReturnFocus=null;
    const closeMobileMenu=()=>{if(mobileMenu.hidden)return;mobileMenu.classList.remove("is-open");document.body.classList.remove("dh-mobile-menu-open");mobileMenuButton.setAttribute("aria-expanded","false");setTimeout(()=>{mobileMenu.hidden=true;if(menuReturnFocus)menuReturnFocus.focus();},180);};
    const openMobileMenu=()=>{menuReturnFocus=document.activeElement;mobileMenu.hidden=false;requestAnimationFrame(()=>mobileMenu.classList.add("is-open"));document.body.classList.add("dh-mobile-menu-open");mobileMenuButton.setAttribute("aria-expanded","true");setTimeout(()=>mobileMenu.querySelector(".dh-mobile-menu__panel button[data-dh-close]").focus(),40);};
    /* Bazı çalışma ekranları React yeniden çiziminde düğmeleri klonlayabiliyor.
       Belge düzeyindeki temsilci, düğmenin dinleyicisini kaybetmesini önler. */
    document.addEventListener("click",e=>{
      const opener=e.target.closest&&e.target.closest(".dh-mobile-menu-button");
      const closer=e.target.closest&&e.target.closest("[data-dh-close]");
      if(opener){e.preventDefault();if(mobileMenu.hidden)openMobileMenu();return;}
      else if(closer&&!mobileMenu.hidden){e.preventDefault();closeMobileMenu();}
    },true);
    window.addEventListener("pointerdown",e=>{if(e.target.closest&&e.target.closest(".dh-mobile-menu-button")){e.preventDefault();e.stopPropagation();if(mobileMenu.hidden)openMobileMenu();}},true);
    mobileMenuButton.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&mobileMenu.hidden){e.preventDefault();openMobileMenu();}});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!mobileMenu.hidden)closeMobileMenu();});
    document.body.append(mobileMenu,mobileMenuButton);

    /* Bağlantı rozeti artık salt yazı değil: hesap/senkron erişim düğmesi.
       Uzun "Çevrimiçi" etiketi sayfa kontrollerini kapatıyordu; ekranda yalnız
       kompakt durum noktası kalır, açıklama title/aria-label içindedir. */
    const net = document.createElement("button"); net.type="button"; net.className = "dh-net-status"; net.setAttribute("aria-live","polite");
    const updateNet = () => {
      const on = navigator.onLine;
      const signed = !!(window.DHCloudSync && DHCloudSync.user);
      net.textContent = on ? "●" : "●";
      net.classList.toggle("offline", !on);
      net.setAttribute("aria-label",on?(signed?"Çevrimiçi. Şimdi senkronla":"Çevrimiçi. Hesap aç veya giriş yap"):"Çevrimdışı. Yerel özellikler açık");
      net.title=net.getAttribute("aria-label");
    };
    net.addEventListener("click",()=>{
      if(navigator.onLine===false) return;
      if(window.DHCloudSync&&DHCloudSync.user&&DHCloudSync.fullSync){
        net.classList.add("syncing"); Promise.resolve(DHCloudSync.fullSync()).finally(()=>{net.classList.remove("syncing");updateNet();});
      }else{
        location.href="./login.html?next="+encodeURIComponent(location.pathname.split("/").pop()||"index.html");
      }
    });
    addEventListener("dh-cloud-sync-state",updateNet);
    addEventListener("online", updateNet); addEventListener("offline", updateNet); updateNet(); document.body.append(net);
  });
})();
