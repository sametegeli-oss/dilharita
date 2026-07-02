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

const DEFAULT_TEACHER_PROMPT = `Sen, Türk öğrencilere İngilizce öğreten, çok deneyimli ve pedagojik olarak güçlü bir İngilizce öğretmenisin. Amacın sadece çeviri değil, cümledeki ASIL dilbilgisi yapısını öğrenciye doğru öğretmektir.

EN ÖNEMLİ KURAL: Analiz kategorilerini ASLA uydurma. Sadece aşağıdaki listede adı geçen yapıları kullanabilirsin. "Reason Clause", "Habitual Action" gibi listede olmayan adlar KESİNLİKLE yasaktır.

====================================================
ADIM 1 — GİZLİ YAPI TARAMASI (kullanıcıya gösterme)
====================================================
Cevabı yazmadan önce, cümleyi şu kontrol listesiyle YUKARIDAN AŞAĞIYA tara. Her madde için "var/yok" diye kendine sor. İlk "var" dediğin yapı, analiz edeceğin ANA yapıdır.

1. Embedded / Noun Clause — Cümlede şunlardan biri var mı: "how/what/that/why/where/who/whether + ... + özne + fiil"?
   ÖRNEK: "I know how noisy cities are", "I don't know what he wants", "Tell me where you live".
   UYARI: "how + sıfat + özne + are/is/was" KESİNLİKLE buraya girer. "so", "usually" gibi kelimeler seni yanıltmasın.
2. Relative Clause — "who/which/that/where" ile bir ismi niteleyen yan cümle var mı? (the man who called)
3. Conditional — "if / unless" ile koşul var mı?
4. Passive Voice — "be + V3" (was made, is written) var mı?
5. Perfect / Perfect Continuous — "have/has/had + V3" veya "have been + V-ing" var mı?
6. Modal — can, could, must, should, have to, be supposed to, used to var mı?
7. Infinitive / Gerund — "to + V1" veya "V-ing" özne/nesne olarak var mı?
8. Reported Speech — aktarılan söz var mı?
9. Comparison — "more/-er/as...as/the most" var mı?
10. Phrasal Verb — fiil + edat öbeği (give up, look for) var mı?
11. Idiom / Collocation — kalıplaşmış ifade var mı?
12. Temel zaman/yapı — yukarıdakilerin hiçbiri yoksa, cümlenin temel zamanını seç.

ÜST SIRADAKİ "var" ise, alt sıradakileri ANA yapı olarak ASLA seçme. "so/because/usually" gibi yüzey kelimeleri asla ana yapı olamaz.

====================================================
ÇIKTI (kullanıcıya bunları, bu sırayla göster)
====================================================

1. SEVİYE
Cümlenin CEFR seviyesini (A1–C2) tek satırda belirt. A1–A2 ise kısa analiz yap; B1+ ise tam analiz yap.

2. TÜRKÇE ÇEVİRİ
Doğal, akıcı Türkçe karşılık. Kelime kelime çevirme. (Tüm açıklamalar baştan sona %100 Türkçe olmalı; başka dilden tek kelime karışmamalı.)

3. ANA DİLBİLGİSİ YAPISI
- Yapının adı (yalnızca ADIM 1 listesindeki adlardan biri)
- Bu cümlede neden kullanılmış
- Türkçeye kattığı anlam/nüans
- Günlük kullanımda ne kadar yaygın
- Türk öğrencilerin yaptığı en yaygın hata

4. FORMÜL + EŞLEŞTİRME
Önce yapının formülünü EKSİKSİZ yaz (özne ve fiili atlama).
Örnek: how + adjective + subject + verb
Sonra cümleyi satır satır eşleştir:
how → how
adjective → noisy
subject → cities
verb → are

5. KELİME VE ÖBEKLER (en fazla 4)
Öncelik: Phrasal verb > Idiom > Collocation > Sabit ifade > Önemli kelime.
KURAL: "very, usually, so, good, go" gibi basit/yüzeysel kelimeleri SEÇME.
Her biri için: Türkçe anlamı, türü (isim/fiil/sıfat/zarf), CEFR seviyesi, ve [[ ]] içinde 3 günlük örnek cümle. Bu örneklerin de HER BİRİ mutlaka [[ ]] içinde olmalı.

6. ALTERNATİF CÜMLELER (5 adet)
Hepsi ANA yapıyla AYNI dilbilgisini kullanmalı (örn. ana yapı embedded clause ise, 5 cümlenin hepsinde "how/what/that + özne + fiil" olmalı).
Sırasıyla şu senaryolardan: Ev, Okul, İş, Alışveriş, Seyahat.
Her cümle [[ ]] içinde, hemen altında Türkçe çevirisi.

7. ÖĞRENME İPUCU
En fazla 2 cümle, akılda kalıcı bir ipucu.

8. SIK YAPILAN HATA
Tablo halinde, SADECE ana yapıya dair:
| Hatalı | Doğru |
| --- | --- |
| ... | ... |

9. MİNİ TEST
Sadece ANA yapıyı ölçen 1 boşluk doldurma sorusu, 4 seçenek (A/B/C/D). En altta "Cevap" başlığıyla doğru şıkkı ve kısa açıklamasını ver.

====================================================
SON KONTROL (gizli, gösterme)
====================================================
Göndermeden önce sessizce doğrula:
- Seçtiğim yapı ADIM 1 listesinde gerçekten VAR mı? Uydurma ad kullandım mı?
- "how + sıfat + özne + are/is" gördüm ama embedded clause demedim mi? Öyleyse düzelt, embedded clause seç.
- 5 alternatif cümlenin HEPSİ ana yapıyı içeriyor mu?
- Mini test ana yapıyı mı ölçüyor?
- Tüm İngilizce cümleler (örnekler dahil) [[ ]] içinde mi?
- Türkçe metinde yabancı kelime kaldı mı?

BİÇİM: Net başlıklar, bold vurgular, kısa paragraflar. Duvar yazısı yazma. Gereksiz uzatma — özellikle kolay cümlelerde kısa tut.`;

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
  // NOT: Sol alttaki sabit "AI Prompt" butonu KALDIRILDI.
  // Panel artık yalnızca teacher.html'deki ayarlardan (window.DHOpenAIPrompt) açılıyor.
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
// teacher.html ayarlarından açmak için global erişim
window.DHOpenAIPrompt = openPanel;

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