/* ai-teacher-prompt-tts.js
   AI Öğretmen + sohbetler için:
   - Kullanıcı promptu düzenler ve kaydeder.
   - Fetch tabanlı AI çağrılarında sistem promptuna eklenir.
   - Cevaplar Türkçe anlatım + İngilizce örnek formatına zorlanır.
   - Karma Türkçe/İngilizce metinleri ayrı dillerle okur.
*/
(function(){
"use strict";
if(window.__DHAIPromptTTSV1) return;
window.__DHAIPromptTTSV1 = true;

const DEFAULT_TEACHER_PROMPT = `Sen, Türk öğrencilere İngilizce öğreten, cana yakın, tecrübeli ve pedagojik yaklaşımı yüksek profesyonel bir "İngilizce Öğretmeni" yapay zekasısın. Görevin, sana verilen İngilizce cümleyi sadece Türkçe'ye çevirmek değil; öğrencinin o cümleyi, içindeki dil bilgisi kalıplarını ve kelime kullanımlarını derinlemesine anlamasını sağlamaktır.
Sana bir cümle gönderildiğinde, HER ZAMAN aşağıdaki pedagojik adımları izleyerek yapılandırılmış, akıcı ve öğrenciyi geliştiren bir yanıt üret:
1. DOĞRULAMA VE GİRİŞ:
   Cümlenin tam ve en doğal Türkçe karşılığını vurgulayarak ver.
2. KRİTİK YAPI ANALİZİ (Grammar & Nuance):
   Cümledeki en önemli dil bilgisi yapısını (Örn: "be supposed to", "have to", "used to") veya modal yapısını ele al.
   - Bu yapının cümleye kattığı tam anlam ve nüans nedir? (Zorunluluk mu, beklenti mi, toplumsal kural mı?)
   - Bu yapının formülünü kısaca göster (Örn: Subject + am/is/are + not + supposed to + V1).
3. KELİME VE ÖBEK İNCELEMESİ (Vocabulary):
   Cümle içindeki önemli deyimleri, phrasal verb'leri veya bir arada kullanılan (collocation) kelime öbeklerini açıkla (Örn: "tell anyone" kullanımı). bu öbeklerden her biri için ayrı ayrı 3 er farklı , kısa ve günlük hayattan alternatif İngilizce cümle örneği yaz ve parantez içinde Türkçe anlamlarını ekle.
4. ALTERNATİF VE GÜNLÜK KULLANIM ÖRNEKLERİ:
   Öğrencinin yapıyı pekiştirmesi için aynı kalıbı içeren 5 farklı, kısa ve günlük hayattan alternatif İngilizce cümle örneği yaz ve parantez içinde Türkçe anlamlarını ekle.
5. TON VE METRİK KISITLAMALARI:
   - Anlatımın net, sade ve gereksiz akademik terimlerden uzak olsun.
   - Yanıtı bir duvar metni olarak sunma; başlıklar, kalın yazılar (bold) ve satır boşlukları kullanarak okunabilirliği en üst düzeye çıkar.
   - Tüm Türkçe açıklama ve çeviriler %100 Türkçe olmalı; asla başka bir dilden kelime karıştırma.
- ingilizce cümleler mutlaka çift köşeli parantez içinde olmalıdır örn: [[you are late]]

DOĞRULUK KURALLARI (çok önemli — bunlara harfiyen uy):
- Her İngilizce örnek cümleyi yazdıktan sonra zihninde dilbilgisi kontrolü yap; cümle dilbilgisi açısından kusursuz ve doğal olmalı. Şüphedeysen daha basit ama kesin doğru bir cümle kullan.
- Türkçe çevirilerin tamamen ve yalnızca Türkçe olduğundan emin ol. Yanlışlıkla İngilizce dışında (örneğin Vietnamca, İspanyolca) bir kelime yazma. "often" = "genellikle/sık sık", "usually" = "genellikle" gibi karşılıkları doğru Türkçeyle ver.
- Emin olmadığın bir dilbilgisi kuralını, kelime anlamını veya bilgiyi ASLA uydurma; yalnızca doğruluğundan emin olduğun bilgiyi ver.
- Verdiğin çevirinin İngilizce cümleyle anlamca tam örtüştüğünü kontrol et.
- Türk öğrencinin seviyesine uygun, gerçekte kullanılan doğal İngilizce cümleler seç; yapay veya hatalı kalıplardan kaçın.`;

function esc(s){return String(s??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function key(){return "dh_ai_prompt_teacher";}
function getPrompt(){try{return localStorage.getItem(key()) || DEFAULT_TEACHER_PROMPT;}catch(e){return DEFAULT_TEACHER_PROMPT;}}
function savePrompt(v){try{localStorage.setItem(key(),v||"");}catch(e){}}
function mustRules(){
  return `

DEĞİŞMEZ KURAL:
- Kullanıcı promptu geçerlidir ve bundan sonraki sohbet ona göre devam eder.
- Konu anlatımı mutlaka Türkçe yapılır.
- İngilizce cümle/örnekler İngilizce kalır.
- Cevabı mümkünse TÜRKÇE AÇIKLAMA / ENGLISH PRACTICE / TÜRKÇE ÖZET başlıklarıyla ayır.`;
}
function isTurkishChunk(text){
  const s=String(text||"");
  if(/[ğüşöçıİĞÜŞÖÇ]/.test(s)) return true;
  if(/^\s*(TÜRKÇE|AÇIKLAMA|ÖZET|NOT|KURAL|YANLIŞ|DOĞRU)\b/i.test(s)) return true;
  if(/\b(konu|cümle|örnek|anlam|yapı|kural|kullanıcı|cevap|doğru|yanlış|şöyle|çünkü|fiil|özne|yüklem|Türkçe|anlat|açıkla)\b/i.test(s)) return true;
  return false;
}
function splitForSpeech(text){
  const raw=String(text||"").replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g," ");
  const lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const chunks=[];
  lines.forEach(line=>{
    const lang=isTurkishChunk(line)?"tr-TR":"en-US";
    line.split(/(?<=[.!?])\s+/).filter(Boolean).forEach(p=>chunks.push({text:p,lang}));
  });
  return chunks.length?chunks:[{text:raw,lang:isTurkishChunk(raw)?"tr-TR":"en-US"}];
}
function speakMixed(text){
  if(window.DH_LongTTSAvatarSync && window.DH_LongTTSAvatarSync.speak){ return window.DH_LongTTSAvatarSync.speak(text); }
  try{
    speechSynthesis.cancel();
    const chunks=splitForSpeech(text);
    let i=0;
    function next(){
      if(i>=chunks.length)return;
      const c=chunks[i++];
      const u=new SpeechSynthesisUtterance(c.text);
      u.lang=c.lang;
      u.rate=c.lang==="tr-TR"?.96:.88;
      u.__dhMixed=true;
      let done=false;
      function go(){ if(done)return; done=true; clearTimeout(wd); setTimeout(next,60); }
      var wd=setTimeout(go, Math.max(4000, c.text.length*75)+1500);
      u.onend=go;
      u.onerror=go;
      nativeSpeak.call(speechSynthesis,u);
    }
    next();
  }catch(e){}
}
window.DH_speakMixed = speakMixed;

/* Mevcut kod tek utterance ile karma metin okutursa otomatik iki dilli oku */
const nativeSpeak = speechSynthesis.speak.bind(speechSynthesis);
try{
  if(!speechSynthesis.__dhMixedPatched){
    speechSynthesis.__dhMixedPatched = true;
    speechSynthesis.speak = function(u){
      try{
        const text=String(u&&u.text||"");
        if(!u.__dhMixed && text.length>80 && (/[ğüşöçıİĞÜŞÖÇ]/.test(text) || /TÜRKÇE|ENGLISH|AÇIKLAMA|ÖZET/i.test(text))){
          speakMixed(text);
          return;
        }
      }catch(e){}
      return nativeSpeak(u);
    };
  }
}catch(e){}

/* Fetch ile giden AI mesajlarına kullanıcı promptunu ekle */
const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
if(nativeFetch && !window.fetch.__dhPromptPatched){
  const patched = async function(input, init){
    try{
      const url = typeof input==="string" ? input : (input && input.url) || "";
      const body = init && init.body;
      const isAI = /groq|openai|anthropic|gemini|openrouter|chat\/completions|generateContent/i.test(url) || (typeof body==="string" && /"messages"|"contents"/.test(body));
      if(isAI && typeof body==="string"){
        const data=JSON.parse(body);
        const add = getPrompt() + mustRules();
        if(Array.isArray(data.messages)){
          const sys=data.messages.find(m=>m.role==="system");
          if(sys) sys.content = add + "\n\n" + (sys.content||"");
          else data.messages.unshift({role:"system",content:add});
          init = Object.assign({}, init, {body:JSON.stringify(data)});
        } else if(Array.isArray(data.contents)){
          // Gemini tarzı: ilk kullanıcı mesajının başına ekle
          const first=data.contents[0];
          if(first && Array.isArray(first.parts)){
            first.parts.unshift({text:add});
            init = Object.assign({}, init, {body:JSON.stringify(data)});
          }
        }
      }
    }catch(e){}
    return nativeFetch(input, init);
  };
  patched.__dhPromptPatched = true;
  window.fetch = patched;
}

function addStyle(){
  if(document.getElementById("dhAiPromptStyle")) return;
  const st=document.createElement("style");
  st.id="dhAiPromptStyle";
  st.textContent=`
  #dhAiPromptBtn{position:fixed;left:14px;bottom:14px;z-index:999998;border:1px solid rgba(255,255,255,.18);background:#1d4ed8;color:white;border-radius:999px;padding:11px 14px;font:900 13px Nunito,system-ui,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.38)}
  #dhAiPromptPanel{position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.68);display:none;align-items:center;justify-content:center;padding:16px}
  #dhAiPromptPanel.active{display:flex}
  .dhp-box{width:min(760px,100%);max-height:88vh;overflow:auto;background:#0f172a;color:#e5eefb;border:1px solid rgba(255,255,255,.16);border-radius:22px;padding:16px;font-family:Nunito,system-ui,sans-serif}
  .dhp-box h2{margin:0 0 10px;font-size:20px}.dhp-box p{color:#93a4bd;font-size:13px;line-height:1.5}
  #dhAiPromptText{width:100%;min-height:270px;background:#081226;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:12px;font:800 13px Nunito,system-ui,sans-serif;line-height:1.5}
  .dhp-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.dhp-actions button{border:1px solid rgba(255,255,255,.14);border-radius:12px;background:#2563eb;color:#fff;padding:10px 13px;font-weight:900}
  .dhp-actions .gray{background:#334155}.dhp-actions .green{background:#16a34a}
  .dhReadMixedBtn{margin-left:6px;border:1px solid rgba(255,255,255,.14);background:#1d4ed8;color:#fff;border-radius:999px;padding:4px 8px;font:900 11px Nunito,system-ui,sans-serif;cursor:pointer}
  `;
  document.head.appendChild(st);
}
function createUI(){
  addStyle();
  if(!document.getElementById("dhAiPromptBtn")){
    const b=document.createElement("button");
    b.id="dhAiPromptBtn";
    b.textContent="⚙️ AI Prompt";
    b.onclick=()=>openPanel();
    document.body.appendChild(b);
  }
  if(!document.getElementById("dhAiPromptPanel")){
    const p=document.createElement("div");
    p.id="dhAiPromptPanel";
    p.innerHTML=`<div class="dhp-box">
      <h2>⚙️ AI Öğretmen / Sohbet Promptu</h2>
      <p>Bu prompt kaydedilince AI öğretmen ve sohbet cevapları bundan sonraki mesajlarda buna göre devam eder. Öğretmen Türkçe anlatır; İngilizce örnekler İngilizce kalır.</p>
      <textarea id="dhAiPromptText">${esc(getPrompt())}</textarea>
      <div class="dhp-actions">
        <button class="green" id="dhAiPromptSave">💾 Kaydet</button>
        <button class="gray" id="dhAiPromptReset">Varsayılana Dön</button>
        <button class="gray" id="dhAiPromptClose">Kapat</button>
      </div>
    </div>`;
    document.body.appendChild(p);
    p.onclick=e=>{if(e.target===p)p.classList.remove("active");};
    p.querySelector("#dhAiPromptSave").onclick=()=>{savePrompt(p.querySelector("#dhAiPromptText").value); alert("Prompt kaydedildi. Sohbet bundan sonra bu prompta göre devam eder.");};
    p.querySelector("#dhAiPromptReset").onclick=()=>{savePrompt(DEFAULT_TEACHER_PROMPT); p.querySelector("#dhAiPromptText").value=getPrompt();};
    p.querySelector("#dhAiPromptClose").onclick=()=>p.classList.remove("active");
  }
}
function openPanel(){
  createUI();
  const p=document.getElementById("dhAiPromptPanel");
  p.querySelector("#dhAiPromptText").value=getPrompt();
  p.classList.add("active");
}

/* Yeni AI mesajlarına iki dilli oku butonu ekle */
function addReadButtons(){
  // Otomatik "TR/EN Oku" düğmesi artık eklenmiyor.
  // Okuma, sayfanın kendi "🔊 Oku" düğmesiyle (ekrandan dil-ayrımlı) yapılır.
  return;
}
document.addEventListener("DOMContentLoaded",()=>{
  createUI();
  addReadButtons();
  try{new MutationObserver(()=>addReadButtons()).observe(document.body,{childList:true,subtree:true});}catch(e){}
});
window.addEventListener("load",()=>{createUI();addReadButtons();});
})();