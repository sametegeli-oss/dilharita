/* chat-gemini-continue.js
   chat.html'deki senaryo kartlarına (Otel/Restoran/Doktor/Havaalanı) "Gemini'de devam et"
   düğmesi ekler. Tıklanınca o senaryonun başlangıç promptunu (rol + kurallar + açılış
   cümlesi) panoya kopyalar ve Gemini'yi yeni sekmede açar. Gemini URL ile otomatik
   prompt doldurmayı desteklemediği için kullanıcı orada Ctrl/Cmd+V ile yapıştırıp
   Enter'a basar.
*/
(function(){
"use strict";

// Bu sayfadan link verilen, gerçek CHAT_SCENARIO'su olan senaryo dosyaları.
// (chatteacher.html bir alt-seçim menüsüdür, tekil senaryo değildir — atlanır.)
var SCENARIO_PAGES = ["chathotel.html","chatrestaurant.html","chatdoctor.html","chatairport.html"];

var _cache = {}; // href -> scenario objesi (tekrar fetch etmemek için)

function extractScenario(html){
  var m = html.match(/window\.CHAT_SCENARIO\s*=\s*(\{[\s\S]*?\});/);
  if(!m) return null;
  try{ return JSON.parse(m[1]); }catch(e){ return null; }
}

function levelGuideTR(level){
  var lv = String(level||"").toUpperCase();
  if(lv==="A1"||lv==="A2") return "Basit kelimeler ve kısa cümleler kullan (A1-A2 seviyesi).";
  if(lv==="B1"||lv==="B2") return "Orta seviye kelime ve cümle yapıları kullanabilirsin (B1-B2 seviyesi).";
  return "Öğrencinin seviyesine uygun doğal İngilizce kullan.";
}

function buildPrompt(s){
  var rolePart = s.systemExtra || ("You are role-playing as " + s.role + ".");
  return [
    "İngilizce pratik yapmak istiyorum. Sen bir rol yapma senaryosunda karakter oynayacaksın.",
    "",
    "Senaryo: " + (s.title||"") + " (seviye: " + (s.level||"") + ")",
    "Rolün: " + rolePart,
    "",
    "Kurallar:",
    "- Her zaman İngilizce cevap ver, ben açıkça Türkçe istemedikçe.",
    "- Cevapların kısa olsun: 1-3 cümle.",
    "- Konuşmayı sürdürmek için bana bir takip sorusu sor.",
    "- Açık bir hata yaparsam, ders vermeden nazikçe doğrusunu örnek cümleyle göster.",
    "- Emoji kullanma.",
    "- " + levelGuideTR(s.level),
    "",
    'Şimdi bu açılış cümleyle role başla: "' + (s.opener||"Hello!") + '"'
  ].join("\n");
}

function toast(msg, color){
  var n=document.createElement("div");
  n.textContent=msg;
  n.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#0f1f3a;color:#fff;border:1px solid "+(color||"#7c3aed")+";padding:11px 16px;border-radius:12px;font:700 13px system-ui;max-width:90vw;text-align:center";
  document.body.appendChild(n);
  setTimeout(function(){ n.remove(); },3600);
}

function copyText(t){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(t); return; }
  }catch(e){}
  try{
    var ta=document.createElement("textarea");
    ta.value=t; ta.style.cssText="position:fixed;opacity:0";
    document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }catch(e){}
}

function goGemini(prompt){
  copyText(prompt);
  toast("📋 Prompt kopyalandı — Gemini'de yapıştır (Ctrl/Cmd+V) ve Enter'a bas");
  window.open("https://gemini.google.com/app","_blank");
}

function addButton(card, href){
  if(card.querySelector(".dh-gemini-continue-btn")) return;
  var btn=document.createElement("button");
  btn.type="button";
  btn.className="dh-gemini-continue-btn";
  btn.textContent="✨ Gemini'de devam et";
  btn.disabled=true; // scenario yüklenene kadar pasif
  btn.onclick=function(e){
    e.preventDefault(); e.stopPropagation();
    var s=_cache[href];
    if(!s) return;
    goGemini(buildPrompt(s));
  };
  card.appendChild(btn);

  if(_cache[href]){ btn.disabled=false; return; }
  fetch(href).then(function(r){ return r.ok?r.text():""; }).then(function(html){
    var s=extractScenario(html);
    if(s){ _cache[href]=s; btn.disabled=false; }
    else{ btn.remove(); } // scenario bulunamadıysa düğmeyi hiç gösterme
  }).catch(function(){ btn.remove(); });
}

function addStyle(){
  if(document.getElementById("dh-gemini-continue-css")) return;
  var s=document.createElement("style");
  s.id="dh-gemini-continue-css";
  s.textContent =
    ".dh-gemini-continue-btn{display:block;width:calc(100% - 28px);margin:0 14px 14px;padding:10px 12px;border:1px solid #8b5cf6;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#4338ca);color:#fff;font:800 13px system-ui,sans-serif;cursor:pointer}" +
    ".dh-gemini-continue-btn:hover{background:linear-gradient(135deg,#8b4cf7,#4f46e0)}" +
    ".dh-gemini-continue-btn:disabled{opacity:.5;cursor:default}";
  document.head.appendChild(s);
}

function enhance(){
  addStyle();
  var cards = document.querySelectorAll(".menu .grid > a.card");
  cards.forEach(function(a){
    var href = (a.getAttribute("href")||"").split("?")[0].split("#")[0];
    if(SCENARIO_PAGES.indexOf(href) === -1) return; // AI Öğretmen (alt menü) atlanır
    addButton(a, href);
  });
}

if(document.readyState!=="loading") enhance();
else document.addEventListener("DOMContentLoaded", enhance);
})();
