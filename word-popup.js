/* word-popup.js — GLOBAL KELİME AÇIKLAMA POPUP
   Dil Harita — Her sayfada İngilizce kelimeye tıkla, Türkçe anlamını gör.

   Sözlük: data/dictionary.json (anahtar=kelime; alanlar: oku, anlamlar[], seviye, frekans)

   Otomatik çalışır: sayfadaki tıklanan İngilizce kelimeyi yakalar, popup açar.
   İstisna: input/textarea/buton içindeki tıklamalar ve .no-wordpop alanları hariç.

   API (opsiyonel):
     DHWordPop.lookup("running")   // elle aç
     DHWordPop.enable() / disable()
*/
(function(global){
  "use strict";
  if(global.DHWordPop) return;

  var DICT_PATHS = ["./data/dictionary.json","data/dictionary.json","./dictionary.json"];
  var dict = null, loading = null, enabled = true;
  var popEl = null;

  // ---- sözlük yükleme ----
  function loadDict(){
    if(dict) return Promise.resolve(dict);
    if(loading) return loading;
    loading = (function tryPath(i){
      if(i>=DICT_PATHS.length) return Promise.resolve({});
      return fetch(DICT_PATHS[i]).then(function(r){ if(!r.ok) throw 0; return r.json(); })
        .then(function(d){ dict = d||{}; return dict; })
        .catch(function(){ return tryPath(i+1); });
    })(0);
    return loading;
  }

  // ---- kelime normalize + arama ----
  function cleanWord(w){
    return String(w||"").toLowerCase().replace(/[^a-z'-]/g,"").replace(/^'+|'+$/g,"");
  }
  // basit kök denemeleri (running→run, studies→study, played→play)
  function variants(w){
    var v=[w];
    if(w.length>4){
      if(/ies$/.test(w)) v.push(w.replace(/ies$/,"y"));
      if(/es$/.test(w)) v.push(w.replace(/es$/,""));
      if(/s$/.test(w)) v.push(w.replace(/s$/,""));
      if(/ing$/.test(w)){ v.push(w.replace(/ing$/,"")); v.push(w.replace(/ing$/,"e")); }
      if(/ed$/.test(w)){ v.push(w.replace(/ed$/,"")); v.push(w.replace(/ed$/,"e")); }
      if(/ied$/.test(w)) v.push(w.replace(/ied$/,"y"));
      if(/er$/.test(w)) v.push(w.replace(/er$/,""));
      if(/est$/.test(w)) v.push(w.replace(/est$/,""));
    }
    return v;
  }
  function findEntry(raw){
    if(!dict) return null;
    var w = cleanWord(raw);
    if(!w) return null;
    var vs = variants(w);
    for(var i=0;i<vs.length;i++){
      if(dict[vs[i]]) return { word:vs[i], data:dict[vs[i]] };
      // başka anahtar biçimi (büyük harfli kayıt?) — küçük harfle ara
    }
    // birebir bulunamazsa, kelime dict'te farklı anahtarla olabilir; küçük harfli tarama (sınırlı)
    return null;
  }

  // ---- popup CSS ----
  function injectCSS(){
    if(document.getElementById("dh-wordpop-css")) return;
    var st=document.createElement("style");
    st.id="dh-wordpop-css";
    st.textContent =
     ".dh-wp-ov{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;animation:dhWpF .15s ease}"
    +"@keyframes dhWpF{from{opacity:0}to{opacity:1}}"
    +".dh-wp{background:#0f1f3a;border:1px solid #1e3a5f;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px 20px max(20px,env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.5);animation:dhWpUp .2s ease}"
    +"@media(min-width:520px){.dh-wp-ov{align-items:center}.dh-wp{border-radius:20px}}"
    +"@keyframes dhWpUp{from{transform:translateY(30px);opacity:.5}to{transform:none;opacity:1}}"
    +".dh-wp-head{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}"
    +".dh-wp-word{font-size:24px;font-weight:900;color:#e8eef7}"
    +".dh-wp-read{font-size:14px;color:#38bdf8;font-weight:700}"
    +".dh-wp-lvl{margin-left:auto;font-size:11px;font-weight:800;color:#9fb3d9;background:#13294d;border:1px solid #1e3a5f;border-radius:99px;padding:3px 9px}"
    +".dh-wp-mean{margin:12px 0 4px;padding:0;list-style:none}"
    +".dh-wp-mean li{color:#e8eef7;font-size:16px;padding:7px 0;border-bottom:1px solid #13294d;line-height:1.4}"
    +".dh-wp-mean li:last-child{border-bottom:0}"
    +".dh-wp-empty{color:#9fb3d9;font-size:15px;padding:10px 0}"
    +".dh-wp-actions{display:flex;gap:10px;margin-top:14px}"
    +".dh-wp-btn{flex:1;border:0;border-radius:12px;padding:13px;font-size:15px;font-weight:800;cursor:pointer}"
    +".dh-wp-speak{background:#2563eb;color:#fff}"
    +".dh-wp-close{background:#13294d;color:#e8eef7;border:1px solid #1e3a5f}";
    document.head.appendChild(st);
  }

  function close(){ if(popEl){ popEl.remove(); popEl=null; } }

  function show(word, entry){
    injectCSS();
    close();
    var ov=document.createElement("div");
    ov.className="dh-wp-ov";
    var inner;
    if(entry){
      var d=entry.data;
      var anlamlar = Array.isArray(d.anlamlar) ? d.anlamlar : (d.anlamlar?[d.anlamlar]:[]);
      var meanHtml = anlamlar.length
        ? '<ul class="dh-wp-mean">'+anlamlar.map(function(m){ return '<li>'+esc(m)+'</li>'; }).join("")+'</ul>'
        : '<div class="dh-wp-empty">Anlam bulunamadı.</div>';
      inner = '<div class="dh-wp-head"><span class="dh-wp-word">'+esc(entry.word)+'</span>'
        +(d.oku?'<span class="dh-wp-read">/'+esc(d.oku)+'/</span>':'')
        +(d.seviye?'<span class="dh-wp-lvl">'+esc(d.seviye)+'</span>':'')+'</div>'
        + meanHtml;
    } else {
      inner = '<div class="dh-wp-head"><span class="dh-wp-word">'+esc(word)+'</span></div>'
        +'<div class="dh-wp-empty">Bu kelime sözlükte bulunamadı.</div>';
    }
    var div=document.createElement("div");
    div.className="dh-wp";
    div.innerHTML = inner
      +'<div class="dh-wp-actions">'
      +'<button class="dh-wp-btn dh-wp-speak" id="dhWpSpeak">🔊 Dinle</button>'
      +'<button class="dh-wp-btn dh-wp-close" id="dhWpClose">Kapat</button>'
      +'</div>';
    ov.appendChild(div);
    document.body.appendChild(ov);
    popEl=ov;
    ov.addEventListener("click", function(e){ if(e.target===ov) close(); });
    document.getElementById("dhWpClose").onclick=close;
    document.getElementById("dhWpSpeak").onclick=function(){
      try{ var u=new SpeechSynthesisUtterance((entry&&entry.word)||word); u.lang="en-US"; u.rate=.85; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){}
    };
  }

  function lookup(raw){
    return loadDict().then(function(){
      var entry=findEntry(raw);
      show(cleanWord(raw), entry);
    });
  }

  // ---- tıklama yakalama ----
  function shouldIgnore(target){
    if(!target) return true;
    // input/editable/buton/link içindeyse karışma
    var t=target;
    while(t && t!==document.body){
      var tag=(t.tagName||"").toLowerCase();
      if(tag==="input"||tag==="textarea"||tag==="select"||tag==="button"||tag==="a") return true;
      if(t.isContentEditable) return true;
      if(t.classList && (t.classList.contains("no-wordpop")||t.classList.contains("opt")||t.classList.contains("chip")||t.classList.contains("chip-picked"))) return true;
      t=t.parentNode;
    }
    return false;
  }

  // tıklanan noktadaki kelimeyi metin düğümünden çıkar
  function wordAtPoint(e){
    var word="";
    try{
      var range;
      if(document.caretRangeFromPoint) range=document.caretRangeFromPoint(e.clientX,e.clientY);
      else if(document.caretPositionFromPoint){ var p=document.caretPositionFromPoint(e.clientX,e.clientY); if(p){ range=document.createRange(); range.setStart(p.offsetNode,p.offset); range.collapse(true); } }
      if(!range) return "";
      var node=range.startContainer;
      if(node.nodeType!==3) return ""; // metin düğümü değil
      var text=node.textContent, off=range.startOffset;
      // İngilizce kelime mi? (sadece harf içeren bloklar)
      var left=off, right=off;
      while(left>0 && /[A-Za-z'-]/.test(text[left-1])) left--;
      while(right<text.length && /[A-Za-z'-]/.test(text[right])) right++;
      word=text.slice(left,right);
    }catch(err){}
    return word;
  }

  function onClick(e){
    if(!enabled) return;
    if(popEl) return; // popup açıkken yeni tıklama kelime açmasın
    if(shouldIgnore(e.target)) return;
    var w=wordAtPoint(e);
    if(!w || w.length<2) return;
    if(!/[A-Za-z]{2,}/.test(w)) return;
    // Türkçe metinlerde de İngilizce kelime olabilir; sözlükte varsa göster
    loadDict().then(function(){
      var entry=findEntry(w);
      if(entry){ show(cleanWord(w), entry); } // sadece sözlükte varsa aç (gürültü olmasın)
    });
  }

  function enable(){ enabled=true; }
  function disable(){ enabled=false; }

  function boot(){
    document.addEventListener("click", onClick, true);
    loadDict(); // önden yükle
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }

  global.DHWordPop = { lookup:lookup, enable:enable, disable:disable, close:close };
})(window);
