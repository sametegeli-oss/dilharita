// practice-design5.js
(function(){
"use strict";

function norm(s){return String(s||"").replace(/[🎙️🎤🔊✅🎯✍️📚💬🎬🏠←→]/g," ").replace(/\s+/g," ").trim();}
function txt(el){return norm(el?.innerText || el?.textContent || el?.getAttribute?.("aria-label") || el?.title || "");}
function visible(el){if(!el||!el.getBoundingClientRect)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}
function all(){return [...document.querySelectorAll("body *")];}
function findButton(re){return [...document.querySelectorAll("button,[role='button'],a")].find(e=>visible(e)&&re.test(txt(e)));}
function findText(re){
  return all().find(e=>{
    if(!visible(e))return false;
    const t=txt(e);
    if(!t||e.children.length>3)return false;
    return re.test(t);
  });
}
function ancestors(el){const a=[];let n=el;while(n&&n!==document.body&&n!==document.documentElement){a.push(n);n=n.parentElement;}return a;}
function common(items){if(!items.every(Boolean))return null;const lists=items.map(ancestors);return lists[0].find(x=>lists.every(l=>l.includes(x)))||null;}
function isPractice(){
  const p=location.pathname.toLowerCase();
  const t=norm(document.body.innerText).toLowerCase();
  return p.includes("practice") || t.includes("kelimeleri sırala") || t.includes("cümleyi oku") || t.includes("kontrol et");
}

function hideMeta(){
  all().forEach(e=>{
    const t=txt(e);
    if(/^türkçesi$/i.test(t)||/^(A1|A2|B1|B2|C1|C2)$/i.test(t)||/^kelimeleri sırala$/i.test(t)||/^(present|past|future).*(simple|continuous|perfect)$/i.test(t)){
      e.classList.add("pd5-hidden");
    }
  });
}

function makeShell(){
  if(document.querySelector(".pd5-shell"))return document.querySelector(".pd5-shell");

  const question=findText(/Bay Smith siz misiniz|Are you Mr\.?\s*Smith|siz misiniz|mısınız|misiniz/i);
  const teacher=findButton(/öğretmene sor/i);
  const read=findButton(/cümleyi oku|oku/i);
  const clear=findButton(/temizle/i);
  const check=findButton(/kontrol/i);
  const hard=findButton(/^zor$/i);
  const normal=findButton(/^normal$/i);
  const easy=findButton(/^kolay$/i);
  const next=findButton(/sıradaki|sonraki|ileri/i);
  const result=findText(/tam isabet|doğru|yanlış/i);

  if(!question || !read || !clear || !check) return null;

  const root=common([question,read,clear,check]) || question.closest(".card,section,main,.wrap") || document.getElementById("root") || document.body;
  root.classList.add("pd5-page");
  root.innerHTML = "";

  const shell=document.createElement("div");
  shell.className="pd5-shell";
  shell.innerHTML=`
    <div class="pd5-topbar">
      <a class="pd5-back" href="javascript:history.back()">←</a>
      <div class="pd5-title">Be Verb Questions</div>
      <div class="pd5-progress"><span class="pd5-progress-text">1 / 100</span><span class="pd5-bar"><i></i></span></div>
      <div class="pd5-gear">⚙</div>
    </div>
    <div class="pd5-board">
      <section class="pd5-left">
        <div class="pd5-question-box"><div class="pd5-question-slot"></div></div>
        <div class="pd5-result-box"><div class="pd5-result-title">Tam isabet!</div><div class="pd5-result-slot"></div></div>
        <div class="pd5-action-row"></div>
      </section>
      <section class="pd5-mid">
        <div class="pd5-mid-box">
          <div class="pd5-word-area"><div class="pd5-label">Kelime kutuları</div><div class="pd5-word-slot pd5-chip-row"></div></div>
          <div class="pd5-arrow">↓</div>
          <div class="pd5-answer-area"><div class="pd5-label">Cevabın</div><div class="pd5-answer-slot pd5-chip-row"></div></div>
        </div>
      </section>
      <aside class="pd5-right">
        <div class="pd5-right-box"><div class="pd5-right-title">Seviye Seç</div><div class="pd5-level-row"></div></div>
      </aside>
    </div>`;
  document.body.appendChild(shell);

  // Öğretmen topbar'a alınır
  if(teacher){
    teacher.classList.add("pd5-teacher-top");
    const gear=shell.querySelector(".pd5-gear");
    shell.querySelector(".pd5-topbar").insertBefore(teacher, gear);
  }

  question.classList.add("pd5-question-text");
  shell.querySelector(".pd5-question-slot").appendChild(question);

  // Sonuç alanı
  if(result && result !== question){
    shell.querySelector(".pd5-result-slot").appendChild(result);
  }else{
    const r=document.createElement("div"); r.textContent="Are you Mr Smith";
    shell.querySelector(".pd5-result-slot").appendChild(r);
  }

  // Kelime butonları: read/clear/check ve seviye butonları hariç, kısa İngilizce kelime butonlarını topla
  const excluded=new Set([teacher,read,clear,check,hard,normal,easy,next].filter(Boolean));
  const wordBtns=[...document.querySelectorAll("button,[role='button'],span")]
    .filter(e=>!excluded.has(e)&&visible(e)&&/^[A-Za-z.'-]{1,14}$/.test(txt(e)))
    .slice(0,8);

  wordBtns.slice(0,4).forEach(e=>shell.querySelector(".pd5-word-slot").appendChild(e));
  wordBtns.slice(4,8).forEach(e=>shell.querySelector(".pd5-answer-slot").appendChild(e));

  [read,clear,check].filter(Boolean).forEach(b=>shell.querySelector(".pd5-action-row").appendChild(b));

  [[hard,"pd5-hard"],[normal,"pd5-normal"],[easy,"pd5-easy"],[next,"pd5-next"]].forEach(([b,c])=>{
    if(!b)return;
    b.classList.add(c);
    if(/sıradaki|sonraki/i.test(txt(b))) b.textContent="İleri ›";
    shell.querySelector(".pd5-level-row").appendChild(b);
  });

  return shell;
}

function boot(){
  if(!isPractice()) return;
  hideMeta();
  const shell=makeShell();
  if(shell){
    document.body.classList.add("pd5-ready");
  }
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,450));
else setTimeout(boot,450);
})();