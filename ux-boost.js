/* ux-boost.js — Dil Harita ortak kullanıcı deneyimi katmanı
   ------------------------------------------------------------------
   Tek satırla her sayfaya eklenir:  <script src="./ux-boost.js?v=1"></script>

   Verdiği 4 şey:
   1) ÜST YÜKLEME ÇUBUĞU — büyük veri dosyaları (data/*.json, 1-8 MB) inerken
      kullanıcı boş ekrana bakmaz; indirilen MB miktarını görür.
   2) ÇEVRİMDIŞI BANDI — bağlantı kesilince uyarır, gelince "bağlantı geri geldi" der.
   3) YENİ SÜRÜM UYARISI — service worker yeni sürüm indirdiğinde
      "Güncelleme hazır · Yenile" şeridi çıkar. Kullanıcı eski sürümde kalmaz.
   4) DOKUNMA GERİ BİLDİRİMİ — buton/link'lere hafif basma efekti (mobil hissi).

   Hiçbir mevcut koda dokunmaz, global isim kirletmez (tek nesne: window.DHUx).
*/
(function(){
  "use strict";
  if (window.DHUx) return;
  var DHUx = window.DHUx = {};

  /* ---------------- stiller ---------------- */
  var css = document.createElement("style");
  css.textContent = [
    '#dhux-bar{position:fixed;top:0;left:0;height:3px;width:0;z-index:99999;',
    '  background:linear-gradient(90deg,#059669,#10b981,#34d399);',
    '  box-shadow:0 0 8px #10b98188;transition:width .25s ease,opacity .3s;opacity:0;pointer-events:none}',
    '#dhux-bar.on{opacity:1}',
    '#dhux-note{position:fixed;left:50%;transform:translateX(-50%) translateY(-140%);top:0;z-index:99999;',
    '  max-width:92vw;display:flex;align-items:center;gap:10px;',
    '  background:#10264a;color:#e8eef7;border:1px solid #1e3a5f;border-top:0;',
    '  border-radius:0 0 14px 14px;padding:9px 14px;font:600 13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;',
    '  box-shadow:0 8px 24px #0008;transition:transform .3s cubic-bezier(.2,.8,.2,1)}',
    '#dhux-note.show{transform:translateX(-50%) translateY(0)}',
    '#dhux-note.warn{background:#3b1d06;border-color:#7c3f0a;color:#fdba74}',
    '#dhux-note.ok{background:#052e22;border-color:#065f46;color:#6ee7b7}',
    '#dhux-note button{appearance:none;border:0;cursor:pointer;border-radius:9px;',
    '  padding:6px 11px;font:800 12px system-ui;background:#10b981;color:#04231a}',
    '@media (prefers-reduced-motion:reduce){#dhux-bar,#dhux-note{transition:none}}',
    '.dhux-press{transform:scale(.97)!important;transition:transform .06s}'
  ].join("");
  document.head.appendChild(css);

  function el(tag, id){ var e=document.createElement(tag); e.id=id; return e; }
  var bar = el("div","dhux-bar");
  var note = el("div","dhux-note");
  function mount(){
    if(!document.body) return;
    if(!bar.parentNode) document.body.appendChild(bar);
    if(!note.parentNode) document.body.appendChild(note);
  }
  if(document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  /* ---------------- 1) yükleme çubuğu ---------------- */
  var active = 0, width = 0, tick = null;

  function start(){
    active++;
    if(active === 1){
      width = 8; bar.style.width = "8%"; bar.classList.add("on");
      clearInterval(tick);
      // gerçek yüzde gzip yüzünden güvenilmez; yumuşak ilerleyiş gösteriyoruz
      tick = setInterval(function(){
        if(width < 90){ width += (90 - width) * 0.08; bar.style.width = width.toFixed(1) + "%"; }
      }, 220);
    }
  }
  function done(){
    active = Math.max(0, active - 1);
    if(active === 0){
      clearInterval(tick); tick = null;
      bar.style.width = "100%";
      setTimeout(function(){ bar.classList.remove("on"); setTimeout(function(){ bar.style.width="0"; }, 320); }, 180);
    }
  }
  DHUx.start = start; DHUx.done = done;

  /* büyük yerel veri dosyaları izlenir; AI/Firebase istekleri izlenmez */
  function isBig(url){
    try{
      var u = new URL(url, location.href);
      if(u.origin !== location.origin) return false;
      return /\/data\/.*\.json$/i.test(u.pathname) ||
             /(sentences|dictionary|translation_guide|phrasal-verbs|azar_uueg|excelveri)[^/]*\.json$/i.test(u.pathname);
    }catch(e){ return false; }
  }

  var origFetch = window.fetch;
  if (typeof origFetch === "function"){
    window.fetch = function(input, init){
      var url = (typeof input === "string") ? input : (input && input.url) || "";
      if(!isBig(url)) return origFetch.apply(this, arguments);

      mount(); start();
      var t0 = Date.now();
      return origFetch.apply(this, arguments).then(function(res){
        // indirilen miktarı say ve büyük dosyada bilgi ver (gövdeyi bozmadan)
        try{
          if(res && res.body && res.ok && typeof ReadableStream !== "undefined"){
            var got = 0, name = url.split("/").pop().split("?")[0];
            var reader = res.body.getReader();
            var stream = new ReadableStream({
              start: function(ctrl){
                (function pump(){
                  reader.read().then(function(r){
                    if(r.done){ ctrl.close(); return; }
                    got += r.value.byteLength;
                    if(got > 400*1024) toast("📚 " + name + " yükleniyor · " + (got/1048576).toFixed(1) + " MB", "", 1400);
                    ctrl.enqueue(r.value); pump();
                  }).catch(function(e){ ctrl.error(e); });
                })();
              }
            });
            var out = new Response(stream, { status:res.status, statusText:res.statusText, headers:res.headers });
            return out;
          }
        }catch(e){}
        return res;
      }).finally(function(){
        done();
        if(Date.now() - t0 > 2500) toast("✅ Veriler hazır", "ok", 1600);
      });
    };
  }

  /* ---------------- 2) bildirim şeridi ---------------- */
  var hideT = null, current = "";
  function toast(msg, kind, ms, actionLabel, onAction){
    mount();
    if(msg === current && !actionLabel) return;
    current = msg;
    note.className = "";
    note.textContent = "";
    var span = document.createElement("span");
    span.textContent = msg;
    note.appendChild(span);
    if(actionLabel){
      var b = document.createElement("button");
      b.textContent = actionLabel;
      b.onclick = onAction;
      note.appendChild(b);
    }
    if(kind) note.classList.add(kind);
    note.classList.add("show");
    clearTimeout(hideT);
    if(ms){ hideT = setTimeout(function(){ note.classList.remove("show"); current=""; }, ms); }
  }
  DHUx.toast = toast;

  /* ---------------- 3) çevrimdışı / çevrimiçi ---------------- */
  window.addEventListener("offline", function(){
    toast("📴 Çevrimdışısın — çalışmaların cihazda saklanıyor", "warn", 0);
  });
  window.addEventListener("online", function(){
    toast("🌐 Bağlantı geri geldi", "ok", 2200);
  });
  if(navigator.onLine === false){
    document.addEventListener("DOMContentLoaded", function(){
      toast("📴 Çevrimdışısın — çalışmaların cihazda saklanıyor", "warn", 0);
    });
  }

  /* ---------------- 4) service worker kaydı + yeni sürüm uyarısı ----------------
     ÖNEMLİ: kayıt eskiden yalnızca menu.html'de vardı. Uygulamanın başlangıç
     sayfası index.html olduğu için doğrudan ana sayfadan girenlerde önbellek ve
     çevrimdışı hiç devreye girmiyordu. Artık her sayfa kaydı garantiliyor. */
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js?v=4", { scope:"./" }).then(function(reg){
      if(!reg) return;
      function watch(sw){
        if(!sw) return;
        sw.addEventListener("statechange", function(){
          if(sw.state === "installed" && navigator.serviceWorker.controller){
            toast("🔄 Güncelleme hazır", "", 0, "Yenile", function(){
              try{ sw.postMessage("skip-waiting"); }catch(e){}
              location.reload();
            });
          }
        });
      }
      if(reg.waiting && navigator.serviceWorker.controller){
        toast("🔄 Güncelleme hazır", "", 0, "Yenile", function(){
          try{ reg.waiting.postMessage("skip-waiting"); }catch(e){}
          location.reload();
        });
      }
      reg.addEventListener("updatefound", function(){ watch(reg.installing); });
      watch(reg.installing);
    }).catch(function(){});
  }

  /* ---------------- 5) dokunma geri bildirimi ---------------- */
  document.addEventListener("pointerdown", function(e){
    var t = e.target && e.target.closest && e.target.closest("button,a,.act,.mitem,[role=button]");
    if(!t) return;
    t.classList.add("dhux-press");
    var off = function(){ t.classList.remove("dhux-press"); };
    setTimeout(off, 160);
    t.addEventListener("pointerup", off, {once:true});
    t.addEventListener("pointercancel", off, {once:true});
  }, {passive:true});
})();
