// practice-design5-v2.js — app.js sonradan ekranı çizse bile bekler ve uygular.
(function(){
"use strict";

let appliedTo = null;
let applying = false;

function norm(s){
  return String(s||"")
    .replace(/[🎙️🎤🔊✅🎯✍️📚💬🎬🏠←→]/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function text(el){ return norm(el?.innerText || el?.textContent || el?.getAttribute?.("aria-label") || el?.title || ""); }
function vis(el){ if(!el || !el.getBoundingClientRect) return false; const r=el.getBoundingClientRect(); return r.width>0 && r.height>0; }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function button(re){ return qsa("button,[role='button'],a").find(b => vis(b) && re.test(text(b))); }
function exactButton(re){ return qsa("button,[role='button'],a").find(b => vis(b) && re.test(text(b))); }

function hideMeta(root){
  qsa("*", root).forEach(el=>{
    const t = text(el);
    const r = el.getBoundingClientRect();
    if(
      /^türkçesi$/i.test(t) ||
      /^(A1|A2|B1|B2|C1|C2)$/i.test(t) ||
      /^kelimeleri sırala$/i.test(t) ||
      /^(present|past|future).*(simple|continuous|perfect)$/i.test(t)
    ){
      el.classList.add("pd5-hide");
    }

    // Aynı satırda A2 + Kelimeleri sırala + Present Continuous varsa komple gizle
    if(r.height < 70 && /kelimeleri sırala/i.test(t) && /(A1|A2|B1|B2|C1|C2)/i.test(t)){
      el.classList.add("pd5-hide");
    }
  });
}

function findMainCard(){
  const teacher = button(/öğretmene sor/i);
  const read = button(/cümleyi oku|oku/i);
  const clear = button(/temizle/i);
  const check = button(/kontrol et|kontrol/i);
  if(!teacher || !read || !clear || !check) return null;

  let n = teacher;
  while(n && n !== document.body){
    const t = text(n).toLowerCase();
    const r = n.getBoundingClientRect();
    if(r.width > 280 && r.height > 250 && t.includes("öğretmene sor") && t.includes("temizle") && t.includes("kontrol")){
      return n;
    }
    n = n.parentElement;
  }
  return teacher.closest(".card,section,main,.wrap") || null;
}

function findQuestion(card){
  const candidates = qsa("h1,h2,h3,.subject-en,.sentence,.sentence-tr,.title,div,p", card)
    .filter(el=>{
      if(!vis(el) || el.classList.contains("pd5-hide")) return false;
      const t=text(el);
      if(t.length < 5 || t.length > 120) return false;
      if(/öğretmene sor|kelimeleri|türkçesi|present|kontrol|temizle|cümleyi oku/i.test(t)) return false;
      if(/^[A-Za-z.' -]+$/.test(t) && t.split(/\s+/).length<=5) return false;
      return /[çğıöşüÇĞİÖŞÜ]|\b(misiniz|mısınız|musunuz|müsünüz|değil|şu|siz|ben|sen)\b/i.test(t);
    });
  return candidates[0] || null;
}

function createArea(cls){
  const d=document.createElement("div");
  d.className=cls;
  return d;
}

function ensureLayout(card){
  if(!card || card === appliedTo || applying) return;
  applying = true;

  hideMeta(card);
  card.classList.add("pd5-card");

  const teacher = button(/öğretmene sor/i);
  const read = button(/cümleyi oku|oku/i);
  const clear = button(/temizle/i);
  const check = button(/kontrol et|kontrol/i);
  const hard = exactButton(/^zor$/i);
  const normal = exactButton(/^normal$/i);
  const easy = exactButton(/^kolay$/i);
  const next = button(/sıradaki|sonraki|ileri/i);
  const question = findQuestion(card);

  const qBox=createArea("pd5-question");
  const words=createArea("pd5-words");
  const result=createArea("pd5-result");
  const actions=createArea("pd5-actions");
  const levels=createArea("pd5-levels");

  // question
  if(question){
    question.classList.add("pd5-qtext");
    qBox.appendChild(question);
  }
  if(teacher){
    teacher.classList.add("pd5-teacher");
    qBox.appendChild(teacher);
  }

  // word area: empty answer box + word buttons stay in existing order.
  const excluded = new Set([teacher, read, clear, check, hard, normal, easy, next].filter(Boolean));
  qsa("button,[role='button'],span,div", card).forEach(el=>{
    if(excluded.has(el)) return;
    if(el===question || question?.contains(el)) return;
    if(el.classList.contains("pd5-hide")) return;
    const t=text(el);
    const r=el.getBoundingClientRect();
    const isWord = /^[A-Za-z.'-]{1,16}$/.test(t) && r.width < 170 && r.height < 70;
    const isAnswerBox = r.height > 35 && r.height < 90 && r.width > 240 && !t && getComputedStyle(el).borderStyle.includes("dashed");
    const isInstruction = /kelimeleri doğru sıraya diz/i.test(t);
    if(isWord || isAnswerBox || isInstruction){
      words.appendChild(el);
    }
  });

  [read,clear,check].filter(Boolean).forEach(b=>{
    if(/cümleyi oku/i.test(text(b))) b.textContent = "🎙 Oku";
    actions.appendChild(b);
  });

  [[hard,"pd5-hard"],[normal,"pd5-normal"],[easy,"pd5-easy"],[next,"pd5-next"]].forEach(([b,c])=>{
    if(!b) return;
    b.classList.add(c);
    if(/sıradaki|sonraki/i.test(text(b))) b.textContent="İleri ›";
    levels.appendChild(b);
  });

  // result: remaining success/result block
  const resEl = qsa("*", card).find(el=>{
    if(!vis(el) || [qBox,words,actions,levels].some(x=>x.contains(el))) return false;
    return /tam isabet|doğrusu|doğru telaffuzu|yanlış/i.test(text(el));
  });
  if(resEl) result.appendChild(resEl);

  card.appendChild(qBox);
  card.appendChild(words);
  card.appendChild(result);
  card.appendChild(actions);
  card.appendChild(levels);

  appliedTo = card;
  applying = false;
}

function apply(){
  if(applying) return;
  const card = findMainCard();
  if(!card) return;
  ensureLayout(card);
}

function boot(){
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    apply();
    if(appliedTo || tries>40) clearInterval(timer);
  },250);

  new MutationObserver(()=>{
    if(appliedTo && document.body.contains(appliedTo)) return;
    appliedTo=null;
    setTimeout(apply,80);
  }).observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
})();