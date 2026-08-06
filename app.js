import {jsx as _jsx, jsxs as _jsxs} from"react/jsx-runtime";
import*as l from"react";

// ==========================================
// DILHARITA - APP.JS (IndexedDB + AI Entegrasyonlu Tam Kod)
// ==========================================

let db;

// 1. IndexedDB Kurulumu (Cevapları ve Cümleleri Çevrimdışı Saklamak İçin)
function initDB() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("DilHaritaAI_DB", 1);
        
        request.onerror = (event) => {
            console.error("IndexedDB bağlantı hatası:", event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains("ai_explanations")) {
                dbInstance.createObjectStore("ai_explanations", { keyPath: "sentence" });
            }
        };
    });
}

// IndexedDB'den Veri Okuma
async function getAIExplanationFromDB(sentence) {
    try {
        const database = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(["ai_explanations"], "readonly");
            const store = transaction.objectStore("ai_explanations");
            const request = store.get(sentence);
            
            request.onsuccess = (event) => {
                const result = event.target.result;
                resolve(result ? result.explanation : null);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    } catch (e) {
        console.error("DB okuma hatası:", e);
        return null;
    }
}

// IndexedDB'ye Veri Yazma
async function saveAIExplanationToDB(sentence, explanation) {
    try {
        const database = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(["ai_explanations"], "readwrite");
            const store = transaction.objectStore("ai_explanations");
            const request = store.put({ 
                sentence: sentence, 
                explanation: explanation, 
                timestamp: new Date().toISOString() 
            });
            
            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    } catch (e) {
        console.error("DB yazma hatası:", e);
    }
}

// 2. Veri Yükleme ve Sözlük Altyapısı
var d=null,f=null;
function p(){return d?Promise.resolve(d):f||(f=fetch(`./data/sentences.json`).then(e=>{if(!e.ok)throw Error(`Veri yüklenemedi: `+e.status);return e.json()}).then(e=>(d=e,e)),f)}
function m(){return d||[]}var h=null;
function g(){if(h)return h;let e=new Map;for(let t of m()){let n=t.module||`(modülsüz)`;e.has(n)||e.set(n,{id:n,title:n,level:t.level||``,part:t.part||``,items:[]}),e.get(n).items.push(t)}let t=[...e.values()];for(let e of t)e.items.sort((e,t)=>(e.order||0)-(t.order||0)),e.count=e.items.length;return h=t,t}
function _(){let e={};for(let t of g()){let n=t.level||`?`;(e[n]=e[n]||[]).push(t)}return e}
function v(e,t=7){let n=String(e||``).toLowerCase().replace(/[^a-z]/g,``);if(!n)return[];let r=RegExp(`\\b`+n.replace(/[.*+?^${}()|[\]\\]/g,`\\$&`)+`\\b`,`i`),i=[];for(let e of m())if(e.en&&r.test(e.en)&&(i.push(e),i.length>=t))break;return i}var y=[`A1`,`A2`,`B1`,`B2`,`C1`,`C2`],b=`sentence-mode`,x=1,S=`kv`,C=null,w=!1;function ee(){return C||(C=new Promise((e,t)=>{if(!(`indexedDB`in window))return w=!0,t(`no-idb`);let n=indexedDB.open(b,x);n.onupgradeneeded=()=>{let e=n.result;e.objectStoreNames.contains(S)||e.createObjectStore(S)},n.onsuccess=()=>e(n.result),n.onerror=()=>{w=!0,t(n.error)}}).catch(e=>{throw w=!0,e}),C)}var te=e=>`sm:`+e,ne=e=>{try{let t=localStorage.getItem(te(e));return t==null?void 0:JSON.parse(t)}catch{}},T=(e,t)=>{try{localStorage.setItem(te(e),JSON.stringify(t))}catch{}};function re(e){let t={};try{for(let n=0;n<localStorage.length;n++){let r=localStorage.key(n);r&&r.startsWith(`sm:`+e)&&(t[r.slice(3)]=JSON.parse(localStorage.getItem(r)))}}catch{}return t}async function ie(e){try{if(w)return ne(e);let t=await ee();return await new Promise((n,r)=>{let i=t.transaction(S,`readonly`).objectStore(S).get(e);i.onsuccess=()=>n(i.result),i.onerror=()=>r(i.error)})}catch{return ne(e)}}async function ae(e,t){try{if(w)return T(e,t);let n=await ee();return await new Promise((r,i)=>{let a=n.transaction(S,`readwrite`);a.objectStore(S).put(t,e),a.oncomplete=()=>r(!0),a.onerror=()=>i(a.error)})}catch{T(e,t)}}async function oe(e=``){try{if(w)return re(e);let t=await ee();return await new Promise((n,r)=>{let i={},a=t.transaction(S,`readonly`).objectStore(S).openCursor();a.onsuccess=()=>{let t=a.result;t?(String(t.key).startsWith(e)&&(i[t.key]=t.value),t.continue()):n(i)},a.onerror=()=>r(a.error)})}catch{return re(e)}}var se=1440*60*1e3,ce=`srs:`;function le(){return{rep:0,ef:2.5,interval:0,due:0,last:0}}function E(e,t){let n={...le(),...e||{}},r=Date.now();if(t===`hard`)n.rep=0,n.interval=0,n.ef=Math.max(1.3,n.ef-.2);else{let e=t===`easy`?5:4;n.ef=Math.max(1.3,n.ef+(.1-(5-e)*(.08+(5-e)*.02))),n.rep+=1,n.rep===1?n.interval=t===`easy`?3:1:n.rep===2?n.interval=t===`easy`?7:4:n.interval=Math.round(n.interval*n.ef*(t===`easy`?1.3:1))}return n.last=r,n.due=r+n.interval*se,n}async function D(e,t){let n=ce+e,r=E(await ie(n),t);return await ae(n,r),r}async function ue(){let e=await oe(ce),t={};for(let n in e)t[n.slice(4)]=e[n];return t}async function de(){let e=await ue(),t=Date.now();return Object.keys(e).filter(n=>(e[n].due||0)<=t)}async function fe(){let e=await ue(),t=Date.now(),n=0,r=0,i=Object.keys(e);for(let a of i)(e[a].due||0)<=t&&n++,(e[a].rep||0)>=2&&r++;return{studied:i.length,due:n,learned:r}}var pe=`prog:`;async function O(e){return await ie(pe+e)||{idx:0,seen:{}}}async function k(e,t,n){let r=await O(e);return r.idx=t,n&&(r.seen[n]=!0),await ae(pe+e,r),r}async function me(){let e=await oe(pe),t={};for(let n in e){let r=n.slice(5),i=e[n].seen||{};t[r]={idx:e[n].idx||0,doneCount:Object.keys(i).length}}return t}var he={subject:`#60a5fa`,verb:`#ef4444`,be:`#fb923c`,article:`#facc15`,prep:`#22c55e`,noun:`#38bdf8`,adj:`#a78bfa`,conn:`#f472b6`,adv:`#34d399`,pron:`#93c5fd`},ge={subject:`özne`,verb:`fiil`,be:`be-fiili`,article:`artikel`,prep:`edat`,noun:`isim`,adj:`sıfat`,conn:`bağlaç`,adv:`zarf`,pron:`zamir`},_e=[`i`,`you`,`he`,`she`,`it`,`we`,`they`,`me`,`him`,`her`,`us`,`them`,`my`,`your`,`his`,`our`,`their`],ve=[`am`,`is`,`are`,`was`,`were`,`be`,`been`,`being`],ye=[`a`,`an`,`the`],be=[`in`,`on`,`at`,`to`,`for`,`from`,`with`,`by`,`of`,`about`,`into`,`over`,`under`,`after`,`before`,`between`,`near`,`through`,`during`,`against`,`among`,`around`,`behind`],xe=[`and`,`but`,`or`,`because`,`although`,`however`,`therefore`,`so`,`while`,`when`,`if`,`though`,`unless`,`since`,`whereas`];function Se(e){return String(e??``).toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g,``)}function Ce(e,t){let n=String(e||``).toLowerCase();if(!n)return``;let r=n.split(/\s*\+\s*|\s*>\s*|\s*,\s*/).map(e=>e.trim()).filter(Boolean)[t]||``;return/subject|pronoun/.test(r)?`subject`:/be ?verb|\bbe\b|am\/is\/are/.test(r)?`be`:/article|a\/an|determiner/.test(r)?`article`:/preposition|prep/.test(r)?`prep`:/connector|conjunction|because|although/.test(r)?`conn`:/adjective|adj/.test(r)?`adj`:/adverb|adv/.test(r)?`adv`:/noun|object|complement/.test(r)?`noun`:/verb|modal|auxiliary/.test(r)?`verb`:``}function we(e){let t=Se(e);return t?_e.includes(t)?`subject`:ve.includes(t)?`be`:ye.includes(t)?`article`:be.includes(t)?`prep`:xe.includes(t)?`conn`:/ly$/.test(t)&&t.length>3?`adv`:``:``}function Te(e,t,n){return Ce(t,n)||we(e)}function Ee(e){return String(e||``).match(/[A-Za-z][A-Za-z'’-]*|[^A-Za-z]+/g)||[]}function De(e,t){let n=0;return Ee(e).map(e=>{if(!/^[A-Za-z]/.test(e))return{text:e,role:``,color:``,isWord:!1};let r=Te(e,t,n++);return{text:e,role:r,color:r?he[r]:``,isWord:!0}})}

function ke({sentence:e,grammar:t,onWordClick:n,className:r=``}){
    return _jsx(`span`,{className:r,children:De(e,t).map((e,t)=>{if(!e.isWord)return _jsx(`span`,{children:e.text},t);let r=e.text.replace(/[^A-Za-z'’-]/g,``);return _jsx(`span`,{className:`tok`,title:e.role?ge[e.role]:void 0,style:{color:e.color||`inherit`,fontWeight:e.color?800:600,cursor:n?`pointer`:`inherit`},onClick:n?()=>n(r):void 0,children:e.text},t)})})
}

var Ae=[];function je(){Ae=window.speechSynthesis?window.speechSynthesis.getVoices():[]}typeof window<`u`&&window.speechSynthesis&&(je(),window.speechSynthesis.onvoiceschanged=je);
function Me(){return Ae.length||je(),Ae.find(e=>/en[-_]US/i.test(e.lang))||Ae.find(e=>/en[-_]GB/i.test(e.lang))||Ae.find(e=>/^en/i.test(e.lang))||null}
function Ne(e,{rate:t=.95}={}){if(!window.speechSynthesis||!e)return;window.speechSynthesis.cancel();let n=new SpeechSynthesisUtterance(String(e)),r=Me();r&&(n.voice=r),n.lang=r?r.lang:`en-US`,n.rate=t,window.speechSynthesis.speak(n)}
function Pe(e){Ne(e,{rate:.6})}

// 3. Kart Bileşeni (AI'ye Sor ve IndexedDB Önbellek Entegrasyonlu)
function Fe({item:e,onWordClick:t,onGrade:n,graded:r}){
    let[i,a]=l.useState(!1);
    
    // AI Cevap ve IndexedDB Durum Yönetimi
    const [aiLoading, setAiLoading] = l.useState(!1);
    const [aiExplanation, setAiExplanation] = l.useState(``);
    const [aiSourceTag, setAiSourceTag] = l.useState(``); // "IndexedDB" veya "Gemini" etiketi

    l.useEffect(() => {
        setAiExplanation(``);
        setAiSourceTag(``);
    }, [e?.id]);

    // AI'ye Sor Butonu Basıldığında Çalışacak Akış
    async function handleAISor() {
        if (!e || !e.en) return;
        const currentSentence = e.en;
        
        setAiLoading(!0);
        setAiSourceTag(``);

        try {
            // Önce IndexedDB'den kontrol et (İnternetsiz otomatik çekme)
            const cached = await getAIExplanationFromDB(currentSentence);
            if (cached) {
                setAiExplanation(cached);
                setAiSourceTag(`🤖 AI Açıklaması (IndexedDB'den yüklendi)[cite: 1]`);
                setAiLoading(!1);
                return;
            }
        } catch (err) {
            console.error("DB okuma hatası:", err);
        }

        // IndexedDB'de yoksa Gemini'ye yönlendir ve kullanıcıyı bilgilendir
        setAiSourceTag(`🤖 Gemini'den yanıt bekleniyor ve kaydediliyor...`);
        const prompt = `Lütfen şu İngilizce cümleyi detaylıca açıkla ve Türkçeye çevir: "${currentSentence}"`;
        window.open(`https://gemini.google.com/app?q=${encodeURIComponent(prompt)}`, "_blank");

        // Panodan (Clipboard) otomatik yakalama simülasyonu / kontrolü
        setTimeout(async () => {
            try {
                const clipboardText = await navigator.clipboard.readText();
                if (clipboardText && clipboardText.length > 10) {
                    await saveAIExplanationToDB(currentSentence, clipboardText);
                    setAiExplanation(clipboardText);
                    setAiSourceTag(`🤖 AI Açıklaması (IndexedDB'ye kaydedildi)[cite: 1]`);
                } else {
                    setAiExplanation("Gemini'den kopyaladığınız yanıtı buraya yapıştırabilir veya panoya kopyalayabilirsiniz.");
                }
            } catch (err) {
                setAiExplanation("Lütfen Gemini yanıtını kopyalayın.");
            }
            setAiLoading(!1);
        }, 3500);
    }

    return e ? _jsxs(`div`,{className:`card`,children:[
        _jsxs(`div`,{className:`card-meta`,children:[_jsx(`span`,{className:`chip chip-level`,children:e.level}),e.topic&&_jsx(`span`,{className:`chip`,children:e.topic}),e.tense&&_jsx(`span`,{className:`chip chip-muted`,children:e.tense})]}),
        _jsx(`div`,{className:`card-en`,children:_jsx(ke,{sentence:e.en,grammar:e.grammar,onWordClick:t})}),
        e.tr&&_jsx(`div`,{className:`card-tr`,children:e.tr}),
        e.trPron&&_jsxs(`div`,{className:`card-pron`,children:[`🗣️ `,e.trPron]}),
        e.ipa&&_jsx(`div`,{className:`card-ipa`,children:e.ipa}),
        
        // --- AI'ye Sor ve Dinle Butonları ---
        _jsxs(`div`,{className:`card-actions`,children:[
            _jsx(`button`,{className:`btn btn-primary`,onClick:()=>Ne(e.en),children:`▶ Dinle`}),
            _jsx(`button`,{className:`btn`,onClick:()=>Pe(e.en),children:`🐢 Yavaş`}),
            _jsx(`button`,{className:`btn dh-aiask-btn`,style:{background:`linear-gradient(135deg,#7c3aed,#4338ca)`,color:`#fff`,fontWeight:800},onClick:handleAISor,disabled:aiLoading,children:aiLoading?`🤖 Sorgulanıyor...`:`🤖 AI'ye Sor`}),
            _jsx(`button`,{className:`btn btn-ghost`,onClick:()=>a(e=>!e),children:i?`Detayı gizle`:`Detay`})
        ]}),

        // --- AI Açıklama ve Etiket Alanı ---
        (aiExplanation || aiSourceTag) && _jsxs(`div`,{className:`ai-result-box`,style:{marginTop:`12px`,padding:`12px`,background:`rgba(15,23,42,0.6)`,borderRadius:`10px`,border:`1px solid rgba(255,255,255,0.1)`},children:[
            aiSourceTag && _jsx(`div`,{style:{marginBottom:`6px`,children:_jsx(`span`,{style:{background:`#4f46e5`,color:`#fff`,padding:`3px 8px`,borderRadius:`4px`,fontSize:`11px`,fontWeight:700},children:aiSourceTag})}}),
            aiExplanation && _jsx(`div`,{style:{fontSize:`13px`,color:`#e2e8f0`,whiteSpace:`pre-wrap`,lineHeight:`1.4`},children:aiExplanation})
        ]}),

        i&&_jsxs(`div`,{className:`card-details`,children:[e.grammar&&_jsx(Le,{label:`Gramer yapısı`,value:e.grammar}),e.pattern&&_jsx(Le,{label:`Kalıp`,value:e.pattern}),e.collocations&&_jsx(Le,{label:`Eş dizimler`,value:e.collocations}),e.synonyms&&_jsx(Le,{label:`Eş anlamlılar`,value:e.synonyms}),e.antonyms&&_jsx(Le,{label:`Zıt anlamlılar`,value:e.antonyms}),e.commonMistake&&_jsx(Le,{label:`Sık yapılan hata`,value:e.commonMistake,warn:!0}),e.aiExplain&&_jsx(`div`,{className:`detail-explain`,children:e.aiExplain})]}),
        
        n&&_jsxs(`div`,{className:`grade-bar`,children:[_jsx(`div`,{className:`grade-label`,children:`Bu cümleyi ne kadar biliyorsun?`}),_jsxs(`div`,{className:`grade-buttons`,children:[_jsx(`button`,{className:`grade-btn grade-hard`,onClick:()=>n(`hard`),children:`Zor`}),_jsx(`button`,{className:`grade-btn grade-good`,onClick:()=>n(`good`),children:`Normal`}),_jsx(`button`,{className:`grade-btn grade-easy`,onClick:()=>n(`easy`),children:`Kolay`})]}),r&&_jsxs(`div`,{className:`grade-done`,children:[`✓ `,Ie(r),` olarak kaydedildi`]})]})
    ]}):null;
}

function Ie(e){return e===`hard`?`Zor`:e===`easy`?`Kolay`:`Normal`}
function Le({label:e,value:t,warn:n}){return _jsxs(`div`,{className:`detail-row`+(n?` detail-warn`:``),children:[_jsx(`span`,{className:`detail-label`,children:e}),_jsx(`span`,{className:`detail-value`,children:t})]})}

var Re=null,ze=null;function Be(){return Re?Promise.resolve(Re):ze||(ze=fetch(`./data/dictionary.json`).then(e=>{if(!e.ok)throw Error(`Sözlük yüklenemedi`);return e.json()}).then(e=>(Re=e,e)).catch(()=>(Re={},Re)),ze)}
function Ve(e){if(!Re)return null;let t=String(e||``).toLowerCase().replace(/[^a-z'’-]/g,``);return t&&(Re[t]||Re[t.replace(/s$/,``)]||Re[t.replace(/ed$/,``)]||Re[t.replace(/ing$/,``)]||Re[t.replace(/ies$/,`y`)])||null}
function He(e){let t=String(e||``).toLowerCase().replace(/[^a-z]/g,``);if(t.length<=3)return[e];let n=t.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/gi);return n&&n.length?n:[e]}

// Sözlük ve Telaffuz Modülleri (Aynı Bırakıldı)
var Ue=`https://api.groq.com/openai/v1/chat/completions`,We=`llama-3.3-70b-versatile`,Ge=12e4,Ke=`groqApiKeys`,qe=Xe(),Je=0,Ye={};function Xe(){try{return JSON.parse(localStorage.getItem(Ke)||`[]`).filter(Boolean)}catch{return[]}}function Ze(e){qe=(e||[]).map(e=>String(e||``).trim()).filter(Boolean),localStorage.setItem(Ke,JSON.stringify(qe)),Je=0;for(let e in Ye)delete Ye[e];return qe}function Qe(){return qe.slice()}function $e(){return qe.length>0}function et(){if(!qe.length)return null;let e=Date.now();for(let t of Object.keys(Ye))Ye[t]<e&&delete Ye[t];for(let e=0;e<qe.length;e++){let t=(Je+e)%qe.length;if(!Ye[t])return Je=t,qe[t]}return null}function tt(e){Ye[e]=Date.now()+Ge,Je=(Je+1)%qe.length}function nt(){let e=Object.values(Ye);return e.length?Math.ceil((Math.min(...e)-Date.now())/1e3):0}async function rt(e,t,{maxTokens:n=800,temperature:r=.4}={}){if(!qe.length){let e=Error(`Groq anahtarı girilmemiş. Ayarlardan ekleyin.`);throw e.code=`NO_KEY`,e}let i=qe.length,a=null;for(let o=0;o<i;o++){let i=et();if(!i){let e=nt(),t=Error(`Tüm anahtarlar limitte. ${e} sn sonra tekrar dene.`);throw t.code=`ALL_LIMITED`,t}let o=Je;try{let s=await fetch(Ue,{method:`POST`,headers:{Authorization:`Bearer `+i,"Content-Type":`application/json`},body:JSON.stringify({model:We,messages:[{role:`system`,content:e},{role:`user`,content:t}],max_tokens:n,temperature:r})});if(s.status===429){tt(o),a=Error(`rate limit`);continue}if(!s.ok){let e=await s.text().catch(()=>``);if(s.status===401||s.status===403){tt(o),a=Error(`geçersiz anahtar`);continue}throw Error(`Groq hatası `+s.status+(e?`: `+e.slice(0,120):``))}return{content:(await s.json())?.choices?.[0]?.message?.content||``,keyIndex:o}}catch(e){a=e}}throw a||Error(`Groq çağrısı başarısız`)}async function it(e,t){let{content:n}=await rt(`Sen İngilizce öğreten, Türkçe konuşan bir dil koçusun. Verilen İngilizce kelimeyi Türk öğrenciye açıkla. Kısa ve net ol. Şu başlıkları kullan: 1) Anlamı (Türkçe), 2) Nasıl kullanılır, 3) Örnek cümle (İngilizce + Türkçe çeviri), 4) Varsa sık yapılan hata. Markdown başlık (#) kullanma, sade metin yaz.`,t?`Kelime: "${e}". Bu cümlede geçiyor: "${t}". Bu bağlamda açıkla.`:`Kelime: "${e}". Açıkla.`,{maxTokens:700});return n}function at(){return!!(window.SpeechRecognition||window.webkitSpeechRecognition)}var ot=[`ms-MY`,`id-ID`,`sw-KE`,`fil-PH`];function st(e){return new Promise((t,n)=>{let r=window.SpeechRecognition||window.webkitSpeechRecognition;if(!r)return n(Error(`Tarayıcı ses tanımayı desteklemiyor. Chrome veya Edge kullanın.`));let i=new r;i.lang=e,i.maxAlternatives=1,i.interimResults=!1,i.continuous=!1;let a=``;i.onresult=e=>{a=(e.results[0][0].transcript||``).toLowerCase().trim()},i.onerror=e=>{let r={"no-speech":`Ses algılanamadı. Tekrar dene.`,"not-allowed":`Mikrofon izni gerekli.`,"audio-capture":`Mikrofona ulaşılamadı.`,"language-not-supported":`__SKIP__`,aborted:null}[e.error];r===`__SKIP__`?t(`__UNSUPPORTED__`):r!==null&&n(Error(r||`Hata: `+e.error))},i.onend=()=>t(a);try{i.start()}catch(e){n(e)}st._active=i})}var ct=null;async function lt(){let e=ct?[ct,...ot,`en-US`]:[...ot,`en-US`];for(let t of e)try{let e=await st(t);if(e===`__UNSUPPORTED__`)continue;return ct=t,{text:e,lang:t}}catch(e){throw e}return{text:``,lang:`en-US`}}function ut(){try{st._active&&st._active.stop()}catch{}}function dt(e){let t=String(e||``).toLowerCase().replace(/[^a-zçğıöşü\s]/g,``).replace(/\s+/g,``),n={ı:`i`,ç:`c`,ş:`s`,ğ:``,ö:`o`,ü:`u`,c:`c`,j:`j`,q:`k`,x:`ks`,w:`v`,y:`i`},r=``;for(let e of t)r+=n[e]??e;return r=r.replace(/[ae]/g,`a`).replace(/[ou]/g,`o`),r}function ft(e){let t=String(e||``).replace(/[\/\[\]ˈˌ.ˑ ]/g,``).replace(/ː/g,``).toLowerCase(),n={ɑ:`a`,æ:`a`,ʌ:`a`,ɒ:`o`,ɔ:`o`,o:`o`,ə:`e`,ɛ:`e`,e:`e`,ɪ:`i`,i:`i`,iː:`i`,ʊ:`u`,u:`u`,θ:`t`,ð:`d`,ʃ:`s`,ʒ:`j`,tʃ:`c`,dʒ:`j`,ŋ:`n`,ɹ:`r`,r:`r`,ɡ:`g`},r=``;for(let e of t)r+=n[e]||e;return r}function pt(e){let t=String(e||``).toLocaleLowerCase(`tr`).replace(/[^a-zçğıöşü\s]/g,``).replace(/\s+/g,``),n={â:`a`,î:`i`,û:`u`,ı:`i`,ç:`c`,ş:`s`,ğ:``,ö:`o`,ü:`u`,q:`k`,x:`ks`,w:`v`,y:`i`},r=``;for(let e of t)r+=n[e]??e;return r=r.replace(/[ae]/g,`a`).replace(/[ou]/g,`o`),r}function mt(e,t){let n=e.length,r=t.length,i=Array.from({length:n+1},(e,t)=>Array.from({length:r+1},(e,n)=>t===0?-n:n===0?-t:0));for(let a=1;a<=n;a++)for(let n=1;n<=r;n++)i[a][n]=Math.max(i[a-1][n-1]+(e[a-1]===t[n-1]?2:-1),i[a-1][n]-1,i[a][n-1]-1);let a=``,o=``,s=n,c=r;for(;s>0||c>0;)s>0&&c>0&&i[s][c]===i[s-1][c-1]+(e[s-1]===t[c-1]?2:-1)?(a=e[s-1]+a,o=t[c-1]+o,s--,c--):s>0&&i[s][c]===i[s-1][c]-1?(a=e[s-1]+a,o=`-`+o,s--):(a=`-`+a,o=t[c-1]+o,c--);return{a1:a,a2:o}}function ht(e,t){let n=String(e||``),r=String(t||``);if(!n)return{letters:[],score:0,correct:0,wrong:0,missing:0};if(!r)return{letters:n.split(``).map(e=>({char:e,status:`missing`})),score:0,correct:0,wrong:0,missing:n.length};let{a1:i,a2:a}=mt(n,r),o=[],s=0,c=0,l=0;for(let e=0;e<i.length;e++){let t=i[e],n=a[e];t!==`-`&&(t===n?(o.push({char:t,status:`ok`}),s++):n===`-`?(o.push({char:t,status:`missing`}),l++):(o.push({char:t,status:`wrong`,said:n}),c++))}let u=s+c+l;return{letters:o,score:u?Math.round(s/u*100):0,correct:s,wrong:c,missing:l}}

function gt({word:e,ipa:t,trPron:n}){let[r,i]=l.useState(`idle`),[a,o]=l.useState(null),[s,c]=l.useState(``),u=at(),d=t?ft(t):pt(n||``),f=!!d;async function p(){c(``),o(null),i(`listening`);try{let{text:e,lang:t}=await lt();o({...ht(d,dt(e)),heard:e||`(ses algılanmadı)`,lang:t}),i(`done`)}catch(e){c(e.message||`Hata`),i(`error`)}}function m(){ut()}if(!u)return _jsxs(`div`,{className:`pt-box`,children:[_jsx(`div`,{className:`pt-title`,children:`🎤 Telaffuzunu dene`}),_jsx(`div`,{className:`pt-unsupported`,children:`Bu tarayıcı mikrofon tanımayı desteklemiyor. Chrome veya Edge öneririz.`})]});if(!f)return _jsxs(`div`,{className:`pt-box`,children:[_jsx(`div`,{className:`pt-title`,children:`🎤 Telaffuzunu dene`}),_jsx(`div`,{className:`pt-unsupported`,children:`Bu kelime için telaffuz verisi yok.`})]});let h=a?a.score:0,g=h>=90?`#4ade80`:h>=70?`#3b82f6`:h>=50?`#f59e0b`:`#ef4444`;return _jsxs(`div`,{className:`pt-box`,children:[_jsx(`div`,{className:`pt-title`,children:`🎤 Telaffuzunu dene`}),t&&_jsxs(`div`,{className:`pt-target`,children:[`Hedef: `,(_jsx(`b`,{children:t}))]}),r===`listening`?_jsxs(`button`,{className:`pt-btn pt-listening`,onClick:m,children:[_jsx(`span`,{className:`pt-pulse`}),` Dinliyorum… kelimeyi söyle (bitince dur)`]}):_jsxs(`button`,{className:`pt-btn`,onClick:p,children:[`🎙️ `,r===`idle`?`Kaydı başlat`:`Tekrar dene`]}),s&&_jsx(`div`,{className:`pt-error`,children:s}),r===`done`&&a&&_jsxs(`div`,{className:`pt-result`,children:[_jsxs(`div`,{className:`pt-hero`,children:[_jsx(`div`,{className:`pt-hero-emoji`,children:h>=90?`🌟`:h>=70?`👍`:h>=50?`💪`:`🔁`}),_jsx(`div`,{className:`pt-hero-label`,style:{color:g},children:h>=90?`Mükemmel`:h>=70?`İyi`:h>=50?`Orta`:`Geliştir`}),_jsxs(`div`,{className:`pt-hero-pct`,style:{color:g},children:[h,`%`]})]}),_jsxs(`div`,{className:`pt-analysis`,children:[_jsxs(`div`,{className:`pt-analysis-head`,children:[`Duyulan ham ses: `,(_jsx(`b`,{style:{color:g},children:a.heard}))]}),_jsx(`div`,{className:`pt-map`,children:a.letters.map((e,t)=>_jsx(`span`,{className:`pt-char pt-`+e.status,title:e.status===`wrong`?`'${e.char}' yerine '${e.said}'`:e.status===`missing`?`eksik`:``,children:e.char},t))}),_jsx(`div`,{className:`pt-note`,children:`Fonem karşılaştırması (kaba) — yeşil doğru, kırmızı farklı, soluk eksik`})]}),_jsxs(`div`,{className:`pt-counts`,children:[_jsxs(`div`,{className:`pt-count`,style:{borderColor:`#4ade80`},children:[_jsx(`div`,{className:`pt-count-n`,style:{color:`#4ade80`},children:a.correct}),_jsx(`div`,{className:`pt-count-l`,children:`Doğru`})]}),_jsxs(`div`,{className:`pt-count`,style:{borderColor:`#f87171`},children:[_jsx(`div`,{className:`pt-count-n`,style:{color:`#f87171`},children:a.wrong}),_jsx(`div`,{className:`pt-count-l`,children:`Farklı`})]}),_jsxs(`div`,{className:`pt-count`,style:{borderColor:`rgba(248,113,113,.5)`},children:[_jsx(`div`,{className:`pt-count-n`,style:{color:`#f87171`},children:a.missing}),_jsx(`div`,{className:`pt-count-l`,children:`Eksik`})]})]})]})]}

function _t({word:e,sentence:t,onClose:n,onWordClick:r,onNeedSettings:i}){let[a,o]=l.useState(!1),[s,c]=l.useState(``),[u,d]=l.useState(!1),[f,p]=l.useState(``),m=l.useMemo(()=>e?v(e,8):[],[e]);l.useEffect(()=>{Be().then(()=>o(!0))},[]),l.useEffect(()=>{c(``),p(``),d(!1)},[e]);let h=l.useMemo(()=>a&&e?Ve(e):null,[a,e]),g=l.useMemo(()=>e?He(e):[],[e]);if(!e)return null;function _(){Ne(e,{rate:1.25})}function y(){let t=`https://youglish.com/pronounce/`+encodeURIComponent(e)+`/english`;window.open(t,`_blank`,`noopener`)}async function b(){if(!$e()){i&&i();return}d(!0),p(``),c(``);try{c(await it(e,t))}catch(e){p(e.message||`AI hatası`)}finally{d(!1)}}return _jsx(`div`,{className:`wp-overlay`,onClick:n,children:_jsxs(`div`,{className:`wp-box`,onClick:e=>e.stopPropagation(),children:[_jsxs(`div`,{className:`wp-head`,children:[_jsx(`h3`,{className:`wp-word`,children:e}),_jsx(`button`,{className:`wp-close`,onClick:n,"aria-label":`Kapat`,children:`✕`})]}),h?.oku&&_jsx(`div`,{className:`wp-oku`,children:h.oku}),h?.anlamlar?.length>0&&_jsxs(`div`,{className:`wp-card`,children:[_jsxs(`div`,{className:`wp-card-head`,children:[_jsx(`span`,{className:`wp-card-title`,children:`📖 ANLAMLAR`}),_jsxs(`span`,{className:`wp-badges`,children:[h.frekans>0&&_jsxs(`span`,{className:`wp-badge wp-badge-freq`,children:[`frekans `,h.frekans]}),h.seviye&&_jsx(`span`,{className:`wp-badge wp-badge-level`,children:h.seviye})]})]}),_jsx(`ol`,{className:`wp-meanings`,children:h.anlamlar.map((e,t)=>_jsx(`li`,{children:e},t))})]}),g.length>1&&_jsxs(`div`,{className:`wp-syll`,children:[_jsx(`span`,{className:`wp-syll-label`,children:`🔤 Heceler`}),_jsx(`span`,{className:`wp-syll-parts`,children:g.join(` · `)})]}),_jsxs(`div`,{className:`wp-actions`,children:[_jsx(`button`,{className:`btn btn-primary`,onClick:()=>Ne(e),children:`🔊 Dinle`}),_jsx(`button`,{className:`btn`,onClick:()=>Pe(e),children:`🐢 Yavaş`}),_jsx(`button`,{className:`btn`,onClick:_,children:`⚡ Hızlı`})]}),_jsx(`button`,{className:`btn btn-yg wp-yg-full`,onClick:y,children:`🎬 Gerçek videolarda dinle`}),_jsxs(`div`,{className:`wp-ai`,children:[_jsx(`button`,{className:`btn wp-ai-btn`,onClick:b,disabled:u,children:u?`🤖 Açıklama hazırlanıyor…`:`🤖 Kelime Açıklama (AI)`}),f&&_jsxs(`div`,{className:`wp-ai-err`,children:[f,!$e()&&i&&_jsx(`button`,{className:`wp-ai-settings`,onClick:i,children:`Ayarlardan anahtar ekle →`})]}),s&&_jsx(`div`,{className:`wp-ai-text`,children:s})]}),_jsx(gt,{word:e,trPron:h?.oku||``}),_jsxs(`div`,{className:`wp-section-title`,children:[`Bu kelimenin geçtiği cümleler`,m.length>0&&_jsxs(`span`,{className:`wp-count`,children:[` (`,m.length,`)`]})]}),m.length===0?_jsx(`div`,{className:`wp-empty`,children:`Örnek cümle bulunamadı.`}):_jsx(`div`,{className:`wp-examples`,children:m.map(e=_jsxs(`div`,{className:`wp-ex`,children:[_jsx(`div`,{className:`wp-ex-en`,children:_jsx(ke,{sentence:e.en,grammar:e.grammar,onWordClick:r})}),e.tr&&_jsx(`div`,{className:`wp-ex-tr`,children:e.tr}),_jsx(`button`,{className:`wp-ex-play`,onClick:()=>Ne(e.en),"aria-label":`Dinle`,children:`▶`})]},e.id))}),_jsxs(`div`,{className:`wp-foot`,children:[`Powered by `,(_jsx(`a`,{href:`https://youglish.com`,target:`_blank`,rel:`noopener`,children:`YouGlish.com`}))]})]})})}

var vt=[`subject`,`be`,`verb`,`noun`,`adj`,`adv`,`prep`,`article`,`conn`];function yt(){return _jsx(`div`,{className:`legend`,children:vt.map(e=>_jsxs(`span`,{className:`legend-item`,children:[_jsx(`span`,{className:`legend-dot`,style:{background:he[e]}}),ge[e]]},e))})}

function bt({onClose:e}){let t=Qe(),[n,r]=l.useState(t[0]||``),[i,a]=l.useState(t[1]||``),[o,s]=l.useState(t[2]||``),[c,u]=l.useState(!1);function d(){Ze([n,i,o]),u(!0),setTimeout(()=>u(!1),1500)}let f=[n,i,o].filter(e=>e.trim()).length;return _jsx(`div`,{className:`wp-overlay`,onClick:e,children:_jsxs(`div`,{className:`wp-box`,onClick:e=>e.stopPropagation(),children:[_jsxs(`div`,{className:`wp-head`,children:[_jsx(`h3`,{className:`set-title`,children:`⚙️ Ayarlar — Groq AI Anahtarları`}),_jsx(`button`,{className:`wp-close`,onClick:e,"aria-label":`Kapat`,children:`✕`})]}),_jsx(`p`,{className:`set-desc`,children:`3 farklı Groq anahtarı girebilirsin. Biri günlük limite takılınca otomatik diğerine geçer, böylece gün boyu kesintisiz çalışır. Anahtarlar yalnızca bu cihazda saklanır, kimseyle paylaşılmaz.`}),_jsx(`a`,{className:`set-link`,href:`https://console.groq.com/keys`,target:`_blank`,rel:`noopener`,children:`→ Ücretsiz Groq anahtarı al (console.groq.com/keys)`}),_jsxs(`div`,{className:`set-fields`,children:[_jsxs(`label`,{className:`set-field`,children:[_jsx(`span`,{children:`Anahtar 1`}),_jsx(`input`,{type:`password`,value:n,onChange:e=>r(e.target.value),placeholder:`gsk_...`})]}),_jsxs(`label`,{className:`set-field`,children:[_jsx(`span`,{children:`Anahtar 2`}),_jsx(`input`,{type:`password`,value:i,onChange:e=>a(e.target.value),placeholder:`gsk_... (opsiyonel)`})]}),_jsxs(`label`,{className:`set-field`,children:[_jsx(`span`,{children:`Anahtar 3`}),_jsx(`input`,{type:`password`,value:o,onChange:e=>s(e.target.value),placeholder:`gsk_... (opsiyonel)`})]})]}),_jsx(`button`,{className:`btn btn-primary set-save`,onClick:d,children:c?`✓ Kaydedildi`:`Kaydet (${f} anahtar)`})]})})}

function xt(){let[e,t]=l.useState(!1),[n,r]=l.useState(null),[i,a]=l.useState({}),[o,s]=l.useState({}),[c,u]=l.useState({studied:0,due:0,learned:0}),[d,f]=l.useState(null),[h,g]=l.useState(0),[v,b]=l.useState(null),[x,S]=l.useState(null),[C,w]=l.useState(``),[ee,te]=l.useState(!1);l.useEffect(()=>{p().then(async()=>{a(_()),s(await me()),u(await fe()),t(!0)}).catch(e=>r(e.message))},[]);let ne=l.useCallback(async()=>{s(await me()),u(await fe())},[]);async function T(e){let t=await O(e.id);f(e),g(Math.min(t.idx||0,e.items.length-1)),b(null)}async function re(){let e=await de();if(!e.length)return;let t=m(),n=new Map(t.map(e=>[e.id,e])),r=e.map(e=>n.get(e)).filter(Boolean);r.length&&(f({id:`__review__`,title:`Bugün tekrar`,items:r,review:!0}),g(0),b(null))}async function ie(){f(null),await ne()}async function ae(e){let t=d.items[h];await D(t.id,e),d.review||await k(d.id,h,t.id),b(e)}async function oe(){let e=d.items.length,t=Math.min(e-1,h+1);g(t),b(null),d.review||await k(d.id,t)}function se(){g(e=>Math.max(0,e-1)),b(null)}if(n)return _jsx(`div`,{className:`app`,children:_jsxs(`div`,{className:`state-msg`,children:[`⚠️ `,n]})});if(!e)return _jsx(`div`,{className:`app`,children:_jsxs(`div`,{className:`state-msg`,children:[_jsx(`div`,{className:`spinner`}),`Veriler yükleniyor…`]})});if(d){let e=d.items[h],t=d.items.length;return _jsxs(`div`,{className:`app`,children:[_jsxs(`header`,{className:`study-header`,children:[_jsxs(`button`,{className:`btn btn-ghost`,onClick:ie,children:[`← `,d.review?`Ana ekran`:`Modüller`]}),_jsx(`div`,{className:`study-title`,children:d.title}),_jsxs(`div`,{className:`study-progress`,children:[h+1,` / `,t]})]}),_jsx(`div`,{className:`progress-bar`,children:_jsx(`div`,{className:`progress-fill`,style:{width:`${(h+1)/t*100}%`}})}),_jsx(`main`,{className:`study-main`,children:_jsx(Fe,{item:e,onWordClick:t=>{S(t),w(e.en||``)},onGrade:ae,graded:v})}),_jsxs(`footer`,{className:`study-nav`,children:[_jsx(`button`,{className:`btn`,disabled:h===0,onClick:se,children:`← Önceki`}),_jsx(yt,{}),_jsx(`button`,{className:`btn btn-primary`,disabled:h>=t-1,onClick:oe,children:`Sonraki →`})]}),x&&_jsx(_t,{word:x,sentence:C,onClose:()=>S(null),onWordClick:e=>S(e),onNeedSettings:()=>{S(null),te(!0)}})]})}return _jsxs(`div`,{className:`app`,children:[_jsxs(`header`,{className:`home-header`,children:[_jsx(`button`,{className:`settings-btn`,onClick:()=>te(!0),"aria-label":`Ayarlar`,children:`⚙️`}),_jsx(`h1`,{className:`brand`,children:`Sentence Mode`}),_jsx(`p`,{className:`tagline`,children:`Cümle tabanlı İngilizce — gramer renkleriyle`})]}),_jsxs(`div`,{className:`stats-row`,children:[_jsx(St,{n:c.studied,label:`çalışılan`}),_jsx(St,{n:c.learned,label:`öğrenilen`}),_jsx(St,{n:c.due,label:`tekrar bekliyor`,highlight:c.due>0})]}),c.due>0&&_jsxs(`button`,{className:`review-cta`,onClick:re,children:[`🔁 Bugün `,c.due,` cümleyi tekrar et`]}),_jsx(`main`,{className:`home-main`,children:y.filter(e=>i[e]).map(e=>_jsxs(`section`,{className:`level-section`,children:[_jsxs(`h2`,{className:`level-title`,children:[_jsx(`span`,{className:`level-badge`,children:e}),_jsxs(`span`,{className:`level-count`,children:[i[e].length,` modül`]})]}),_jsx(`div`,{className:`module-grid`,children:i[e].map(e=>{let t=o[e.id],n=t?t.doneCount:0,r=Math.round(n/e.count*100);return _jsxs(`button`,{className:`module-tile`,onClick:()=>T(e),children:[_jsx(`span`,{className:`module-name`,children:e.title}),_jsxs(`span`,{className:`module-count`,children:[e.count,` cümle`]}),n>0&&_jsxs(`span`,{className:`module-prog`,children:[_jsx(`span`,{className:`module-prog-bar`,children:_jsx(`span`,{style:{width:r+`%`}})}),_jsxs(`span`,{className:`module-prog-txt`,children:[n,`/`,e.count]})]})]},e.id)})})]},e))}),ee&&_jsx(bt,{onClose:()=>te(!1)})]})}

function St({n:e,label:t,highlight:n}){return _jsxs(`div`,{className:`stat`+(n?` stat-hl`:``),children:[_jsx(`span`,{className:`stat-n`,children:e}),_jsx(`span`,{className:`stat-label`,children:t})]})}

l.StrictMode ? document.getElementById(`root`)?.replaceChildren() : null;
document.getElementById(`root`)?._reactRootContainer || window.__root || (window.__root = document.getElementById(`root`));

import{createRoot as cr}from"react/dom/client";
cr(document.getElementById(`root`)).render(_jsx(l.StrictMode,{children:_jsx(xt,{})}));