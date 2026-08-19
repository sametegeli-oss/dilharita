/* word-learning-list.js — word-popup çalışma listesi + bağlamlı hatırlama */
(function(global){
  "use strict";
  if(global.__dhWordLearningList)return;global.__dhWordLearningList=true;
  var KEY="dh-word-study-list-v1",scheduled=false;
  function read(){try{var x=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(x)?x:[];}catch(e){return [];}}
  function write(list){try{localStorage.setItem(KEY,JSON.stringify(list));global.dispatchEvent(new CustomEvent("dh-word-study-list-changed",{detail:{count:list.length}}));return true;}catch(e){return false;}}
  function clean(s){return String(s||"").trim();}
  function escapeHtml(s){return clean(s).replace(/[&<>\"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  function mode(){try{return (JSON.parse(localStorage.getItem("dh-profile-v1")||"{}")||{}).aiYontemi||"";}catch(e){return "";}}
  function hasApiKey(){try{return["groqApiKeys","cerebrasApiKeys","geminiApiKeys"].some(function(k){return(JSON.parse(localStorage.getItem(k)||"[]")||[]).filter(Boolean).length;});}catch(e){return false;}}
  function provider(){
    if(global.DHProviders)return Promise.resolve(global.DHProviders);
    return new Promise(function(resolve,reject){var old=document.querySelector('script[data-dh-word-ai-provider]');if(old){old.addEventListener("load",function(){resolve(global.DHProviders);},{once:true});old.addEventListener("error",reject,{once:true});return;}var s=document.createElement("script");s.src="./ai-providers.js?v=3";s.dataset.dhWordAiProvider="1";s.onload=function(){resolve(global.DHProviders);};s.onerror=reject;document.head.appendChild(s);});
  }
  function popupInfo(box){
    var react=box.classList.contains("wp-box"),w=box.querySelector(react?".wp-word":".dh-wp-word");
    var word=clean(w&&w.textContent).toLowerCase();if(!/^[a-z][a-z'-]*$/.test(word))return null;
    var means=[].slice.call(box.querySelectorAll(react?".wp-meanings li":".dh-wp-mean")).map(function(x){return clean(x.textContent).replace(/^\d+\.\s*/,"");}).filter(Boolean);
    var sentence="";
    var active=document.querySelector(".card-en");if(active)sentence=clean(active.textContent);
    if(!sentence){var ex=box.querySelector(react?".wp-ex-en":"#dhWpSents .dh-wp-sent-en");if(ex)sentence=clean(ex.textContent);}
    return{word:word,meaning:means[0]||"",sentence:sentence,react:react};
  }
  function cloze(sentence,word){if(!sentence)return word+" kelimesini kendi cümlende kullan.";var re=new RegExp("\\b"+word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","ig");return sentence.replace(re,"_____");}
  function add(info){var list=read(),now=Date.now(),old=list.find(function(x){return x.word===info.word;});if(old){old.meaning=old.meaning||info.meaning;old.sentence=old.sentence||info.sentence;old.updatedAt=now;}else list.push({word:info.word,meaning:info.meaning,sentence:info.sentence,cloze:cloze(info.sentence,info.word),stage:0,nextReview:now,addedAt:now,updatedAt:now});write(list);return list;}
  function dueSort(list){var now=Date.now();return list.slice().sort(function(a,b){var ad=(a.nextReview||0)<=now?0:1,bd=(b.nextReview||0)<=now?0:1;return ad-bd||(a.nextReview||0)-(b.nextReview||0);});}
  function listPanel(box){
    var old=box.querySelector(".dh-wsl-panel");if(old){old.remove();return;}
    var list=dueSort(read()),panel=document.createElement("section");panel.className="dh-wsl-panel no-wordpop";
    panel.innerHTML='<div class="dh-wsl-head"><b>📚 Çalışılacak kelimeler</b><button type="button" data-close aria-label="Listeyi kapat">×</button></div><p class="dh-wsl-help">Kelimeyi bağlamından hatırla, boşluğu zihninde tamamla ve aralıklı tekrar düğmesini kullan.</p><div class="dh-wsl-items"></div>';
    var host=panel.querySelector(".dh-wsl-items");
    if(!list.length)host.innerHTML='<p class="dh-wsl-empty">Liste boş. Aktif kelimeyi ekleyerek başla.</p>';
    list.forEach(function(item){var row=document.createElement("article");row.className="dh-wsl-item";row.innerHTML='<div class="dh-wsl-word">'+escapeHtml(item.word)+(item.meaning?' <small>— '+escapeHtml(item.meaning)+'</small>':'')+'</div><div class="dh-wsl-cloze">'+escapeHtml(item.cloze||cloze(item.sentence,item.word))+'</div><details><summary>Cevabı ve bağlamı göster</summary><div><b>'+escapeHtml(item.word)+'</b>'+(item.sentence?' · '+escapeHtml(item.sentence):'')+'</div></details><div class="dh-wsl-actions"><button type="button" data-again>↻ Tekrar et</button><button type="button" data-remember>✓ Hatırladım</button><button type="button" data-remove>Sil</button></div>';
      row.querySelector("[data-again]").onclick=function(){var all=read(),x=all.find(function(v){return v.word===item.word;});if(x){x.stage=0;x.nextReview=Date.now();x.updatedAt=Date.now();write(all);}listPanel(box);listPanel(box);};
      row.querySelector("[data-remember]").onclick=function(){var days=[1,3,7,14,30],all=read(),x=all.find(function(v){return v.word===item.word;});if(x){x.stage=Math.min(days.length,(x.stage||0)+1);x.nextReview=Date.now()+days[Math.max(0,x.stage-1)]*86400000;x.updatedAt=Date.now();write(all);}listPanel(box);listPanel(box);};
      row.querySelector("[data-remove]").onclick=function(){write(read().filter(function(v){return v.word!==item.word;}));listPanel(box);listPanel(box);};host.appendChild(row);
    });
    panel.querySelector("[data-close]").onclick=function(){panel.remove();};box.appendChild(panel);
  }
  function ensureBox(box){
    var info=popupInfo(box);if(!info)return;var old=box.querySelector(".dh-wsl-controls");if(old&&old.dataset.word===info.word){var lc=old.querySelector("[data-list]"),tx="📚 Listeyi aç ("+read().length+")";if(lc&&lc.textContent!==tx)lc.textContent=tx;return;}if(old)old.remove();
    var controls=document.createElement("div");controls.className="dh-wsl-controls no-wordpop";controls.dataset.word=info.word;controls.innerHTML='<button type="button" data-add>⭐ Çalışılacak kelimelere ekle</button><button type="button" data-list>📚 Listeyi aç ('+read().length+')</button><span role="status"></span>';
    controls.querySelector("[data-add]").onclick=function(){var list=add(info),status=controls.querySelector("span");status.textContent="✓ "+info.word+" listeye eklendi";controls.querySelector("[data-list]").textContent="📚 Listeyi aç ("+list.length+")";};
    controls.querySelector("[data-list]").onclick=function(){listPanel(box);};
    var anchor=box.querySelector(info.react?".wp-ai":"#dhWpAIOut");if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(controls,anchor);else box.appendChild(controls);
  }
  function interceptReactAI(e){
    var btn=e.target.closest&&e.target.closest(".wp-ai-btn"),selected=mode();if(!btn||selected==="api"||(selected!=="gemini"&&hasApiKey()))return;var box=btn.closest(".wp-box"),info=box&&popupInfo(box);if(!info)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    var host=box.querySelector(".dh-word-ai-bridge-result");if(!host){host=document.createElement("div");host.className="wp-ai-text dh-word-ai-bridge-result";box.querySelector(".wp-ai").appendChild(host);}host.textContent="Gemini yanıtı bekleniyor…";btn.disabled=true;
    var sys='Türk öğrenci için İngilizce kelimeyi açıkla. Yalnız geçerli JSON döndür: {"tanim":"kısa Türkçe tanım","kullanim":"kullanım nüansı","ornek":"kısa İngilizce örnek","ornekTr":"Türkçesi","ipucu":"akılda tutma ipucu"}.';
    provider().then(function(p){return p.chat([{role:"system",content:sys},{role:"user",content:"Kelime: "+info.word+(info.sentence?"\nBağlam: "+info.sentence:"")}],{json:true,title:"💎 "+info.word+" kelimesini açıkla",cacheType:"word-simple-explanation-v1",cacheInput:{word:info.word,sentence:info.sentence}});}).then(function(raw){var text=String(raw||"").replace(/```json|```/gi,"").trim(),m=text.match(/\{[\s\S]*\}/),x=m?JSON.parse(m[0]):{};host.innerHTML='<b>📖 '+escapeHtml(x.tanim||info.meaning||info.word)+'</b>'+(x.kullanim?'<p>'+escapeHtml(x.kullanim)+'</p>':'')+(x.ornek?'<p>• '+escapeHtml(x.ornek)+(x.ornekTr?' — '+escapeHtml(x.ornekTr):'')+'</p>':'')+(x.ipucu?'<p>💡 '+escapeHtml(x.ipucu)+'</p>':'');}).catch(function(err){host.textContent=err&&err.code==="abort"?"İşlem kapatıldı.":"Açıklama alınamadı. AI tercihini veya bağlantını kontrol et.";}).then(function(){btn.disabled=false;});
  }
  function ensure(){document.querySelectorAll(".dh-wp,.wp-box").forEach(ensureBox);}
  function style(){var s=document.createElement("style");s.textContent='.dh-wsl-controls{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:9px 0}.dh-wsl-controls button,.dh-wsl-actions button{border:1px solid #3b557c;border-radius:10px;background:#132744;color:#eef6ff;padding:9px;font-weight:850}.dh-wsl-controls span{grid-column:1/-1;color:#34d399;font-size:12px}.dh-wsl-panel{margin:10px 0;padding:12px;border:1px solid #49658e;border-radius:14px;background:#09162a;color:#eaf2ff}.dh-wsl-head{display:flex;justify-content:space-between;align-items:center}.dh-wsl-head>button{border:0;background:#334155;color:#fff;border-radius:8px;padding:5px 9px}.dh-wsl-help,.dh-wsl-empty{color:#9fb0c9;font-size:12px;line-height:1.45}.dh-wsl-item{padding:10px 0;border-top:1px solid #ffffff18}.dh-wsl-word{font-weight:900;color:#c4b5fd}.dh-wsl-word small{color:#dbeafe}.dh-wsl-cloze{margin:6px 0;padding:8px;border-radius:8px;background:#0f213d}.dh-wsl-item details{font-size:12px;color:#b8c7dc}.dh-wsl-actions{display:flex;gap:6px;margin-top:8px}.dh-wsl-actions button{flex:1;padding:7px;font-size:11px}@media(max-width:420px){.dh-wsl-controls{grid-template-columns:1fr}.dh-wsl-controls span{grid-column:1}}';document.head.appendChild(s);}
  document.addEventListener("click",interceptReactAI,true);
  global.addEventListener("dh-word-study-list-changed",function(){schedule();});
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(function(){scheduled=false;ensure();},60);}
  function boot(){style();ensure();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
  global.DHWordStudyList={all:read,add:add};
})(window);
