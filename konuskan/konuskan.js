/* konuskan.js — Konuşkan: Dil Harita içinde Talkpal benzeri konuşma bölümü
   ====================================================================
   - Yapay zekâ: Dil Harita'nın kendi anahtarları (ai-providers.js → DHProviders.chat).
     "Hızlı" ayarı Groq/Cerebras'ı öne alır (opts.fast), "Kaliteli" Gemini'yi.
     Fotoğraf modu kayıtlı Gemini anahtarıyla doğrudan Gemini'ye gider.
   - Ses: tarayıcının konuşma tanıması (mikrofon) ve speechSynthesis
     (Dil Harita'nın genel ses ayarı "dh-voice:__global__").
   - Kayıt: localStorage "dh-konuskan-v1"; cloud-sync.js bu anahtarı
     cihazlar arasında birleştirir (mergeKonuskan).
   - İçerik: konuskan/data.json — Dil Harita'nın sentences.json ve
     dictionary.json dosyalarından seçilmiş üniteler, cümleler ve kelimeler.
   ==================================================================== */
"use strict";
/* ================= Veri & sabitler ================= */
let DATA = {course:{A1:[],A2:[],B1:[],B2:[],C1:[]}, words:{A1:[],A2:[],B1:[],B2:[],C1:[]}};
const STORE_KEY = 'dh-konuskan-v1';
const LEVELS = ['A1','A2','B1','B2','C1'];
const LEVEL_NAMES = {A1:'Başlangıç',A2:'Temel',B1:'Orta',B2:'Orta üstü',C1:'İleri'};
const $ = (s,el=document)=>el.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayKey = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const today = () => dayKey(new Date());
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
function seeded(seed){ let h=0; for(const c of seed) h=(h*31+c.charCodeAt(0))|0; return ()=>{ h=(h*1103515245+12345)|0; return ((h>>>0)%10000)/10000; }; }
function pickDaily(arr,n,salt){ const r=seeded(today()+salt); return arr.map(x=>[r(),x]).sort((a,b)=>a[0]-b[0]).slice(0,n).map(x=>x[1]); }

const I = { /* ikonlar */
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  learn:'<path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/>',
  courses:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  explore:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  progress:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  account:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>', back:'<path d="M15 5l-7 7 7 7"/>',
  speaker:'<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  translate:'<path d="M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c0 3-3 7-7 8"/><path d="M13 21l4-9 4 9M14.5 18h5"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  send:'<path d="M4 12l16-8-6 16-2-6z"/>', check:'<path d="M5 12l5 5 9-10"/>', alert:'<path d="M12 7v6M12 17h.01"/>',
  chat:'<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4z"/>',
  word:'<rect x="3" y="5" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',
  sentence:'<path d="M4 7h16M4 12h10M4 17h13"/>',
  dialogue:'<path d="M3 5h11v8H7l-4 3zM10 16h7l4 3v-8h-4"/>',
  flash:'<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 3h8"/>',
  pod:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  role:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c.5-4 3-6 6-6s5.5 2 6 6M14 15c1-.8 2-1 3-1 2.5 0 4.5 1.8 5 5"/>',
  mask:'<path d="M4 6c3 1 13 1 16 0v6a8 8 0 0 1-16 0z"/><path d="M8 11h2M14 11h2M9 15c2 1.3 4 1.3 6 0"/>',
  debate:'<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  photo:'<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M9 6l1.5-2h3L15 6"/>',
  book:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  flame:'<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 3s1-4 1-7z"/>',
  play:'<path d="M7 4l13 8-13 8z"/>', stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', note:'<path d="M5 3h10l4 4v14H5z"/><path d="M9 11h6M9 15h6"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  dh:'<path d="M3 12h18M3 12l6-6M3 12l6 6"/>'
};
const ic = (n,extra='') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${I[n]}</svg>`;

const MODES = [
  {id:'chat', t:'Sohbet', d:'Yapay zekâ öğretmenle serbest konuş, her mesajın düzeltilsin.', icon:'chat', c:'#f2c14e', tag:'Tüm seviyeler'},
  {id:'sentence', t:'Cümle modu', d:'Kurs cümlelerini parçalardan kur, sesli söyle.', icon:'sentence', c:'#9fb4f2', tag:'Başlangıç'},
  {id:'word', t:'Kelime modu', d:'Kelime destelerini öğren ve test et.', icon:'word', c:'#8fd6a0', tag:'Başlangıç'},
  {id:'dialogue', t:'Diyalog modu', d:'Hazır diyaloglarda B rolünü sen oyna.', icon:'dialogue', c:'#ef8f7f', tag:'Başlangıç'},
  {id:'flash', t:'Kartlar', d:'Aralıklı tekrar ile kelimeleri kalıcı hale getir.', icon:'flash', c:'#f2c14e'},
  {id:'podcast', t:'Hikâyeler', d:'Seviyene göre yazılmış hikâyeleri dinle ve oku.', icon:'pod', c:'#9fb4f2'},
  {id:'call', t:'Arama modu', d:'Sadece sesle konuş, ekrana bakmadan pratik yap.', icon:'phone', c:'#8fd6a0'},
  {id:'roleplay', t:'Rol yapma', d:'Gerçek hayattan senaryolarda görevleri tamamla.', icon:'role', c:'#ef8f7f'},
  {id:'characters', t:'Karakterler', d:'Klasik romanların kahramanlarıyla sohbet et.', icon:'mask', c:'#f2c14e'},
  {id:'debate', t:'Münazara', d:'Bir konunun lehinde ya da aleyhinde tartış.', icon:'debate', c:'#9fb4f2'},
  {id:'photo', t:'Fotoğraf modu', d:'Bir fotoğrafı anlat, anında geri bildirim al.', icon:'photo', c:'#8fd6a0', tag:'Yeni'},
  {id:'errors', t:'Hata defteri', d:'Konuşkan\'da yaptığın hataları gör ve üzerine çalış.', icon:'note', c:'#ef8f7f'}
];

const ROLEPLAYS = [
  {id:'cafe',t:'Kafede sipariş',r:'a friendly barista at a busy coffee shop',tasks:['Order a drink and a snack','Ask about the price','Ask for the Wi-Fi password']},
  {id:'hotel',t:'Otele giriş',r:'a hotel receptionist',tasks:['Say you have a reservation','Ask what time breakfast is','Request a quiet room']},
  {id:'doctor',t:'Doktor muayenesi',r:'a calm family doctor',tasks:['Describe your symptoms','Say how long you have felt this way','Ask how often to take the medicine']},
  {id:'airport',t:'Havalimanında check-in',r:'an airline check-in agent',tasks:['Give your destination','Ask for a window seat','Ask about the baggage limit']},
  {id:'interview',t:'İş görüşmesi',r:'a hiring manager interviewing a candidate for an office job',tasks:['Introduce yourself','Talk about a past achievement','Ask a question about the job']},
  {id:'shop',t:'Ürün iadesi',r:'a store assistant at a clothing shop',tasks:['Say what the problem is','Ask for a refund or exchange','Ask about the receipt']},
  {id:'cake',t:'Pasta siparişi',r:'a baker who takes custom cake orders',tasks:['Say what the cake is for','Choose a flavour and size','Agree on a pickup day']},
  {id:'compare',t:'Ürün karşılaştırma',r:'an electronics shop assistant',tasks:['Ask the difference between two phones','Ask about the battery','Ask for a discount']},
  {id:'taxi',t:'Taksi yolculuğu',r:'a taxi driver',tasks:['Give the address','Ask how long it will take','Ask to pay by card']},
  {id:'neighbor',t:'Yeni komşu',r:'a friendly new neighbour',tasks:['Introduce yourself','Ask about the neighbourhood','Invite them for tea']},
  {id:'meeting',t:'Toplantı açılışı',r:'a colleague in a team meeting',tasks:['Open the meeting','Give a short update','Agree on the next step']},
  {id:'rent',t:'Ev kiralama',r:'a landlord showing a flat',tasks:['Ask about the rent','Ask what is included','Ask when you can move in']}
];
const CHARACTERS = [
  {id:'holmes',t:'Sherlock Holmes',r:'Sherlock Holmes, the brilliant London detective from Arthur Conan Doyle\'s stories. You observe tiny details and make clever deductions about the learner, politely.',c:'#4a6fa5',sub:'Dedektif, Londra'},
  {id:'alice',t:'Alice',r:'Alice from Lewis Carroll\'s Alice\'s Adventures in Wonderland. You are curious, polite and describe the strange things you saw in Wonderland.',c:'#d07a9b',sub:'Harikalar Diyarı'},
  {id:'fogg',t:'Phileas Fogg',r:'Phileas Fogg from Jules Verne\'s Around the World in Eighty Days. You are precise, calm and talk about travelling and timetables.',c:'#2f8f80',sub:'80 günde devrialem'},
  {id:'crusoe',t:'Robinson Crusoe',r:'Robinson Crusoe from Daniel Defoe\'s novel. You lived alone on an island for years and talk about survival and daily routines.',c:'#a5793a',sub:'Issız ada'},
  {id:'nemo',t:'Kaptan Nemo',r:'Captain Nemo from Jules Verne\'s Twenty Thousand Leagues Under the Sea. You are mysterious and talk about the sea and your submarine.',c:'#3b5b88',sub:'Nautilus denizaltısı'},
  {id:'watson',t:'Dr. Watson',r:'Dr. John Watson, Sherlock Holmes\'s friend and a doctor. You are warm and tell stories about cases.',c:'#6b7f3a',sub:'Doktor ve yazar'},
  {id:'bennet',t:'Elizabeth Bennet',r:'Elizabeth Bennet from Jane Austen\'s Pride and Prejudice. You are witty, opinionated and talk about family, society and books.',c:'#9a5b8a',sub:'Gurur ve Önyargı'},
  {id:'sawyer',t:'Tom Sawyer',r:'Tom Sawyer from Mark Twain\'s novel. You are a playful boy on the Mississippi River who loves adventures and clever tricks.',c:'#c4733a',sub:'Mississippi kıyısı'}
];
const DEBATES = ['Social media does more harm than good','Working from home is better than working in an office','Homework should be banned in primary schools','Cities should ban cars from the centre','Tourism helps local communities more than it hurts them','Everyone should learn to cook at school','Prisons should focus on rehabilitation, not punishment','Older generations had an easier life','Artificial intelligence will create more jobs than it destroys','Money can buy happiness','Fast food should be taxed more','Children should have smartphones before age 12'];
const STORY_TOPICS = ['A lost key on a rainy morning','Why we procrastinate','A day at a fish market in Istanbul','The first day at a new job','How sleep helps memory','A surprise visitor','Learning to ride a bike at forty','A train that never arrived','The secret life of bees','A small café that changed a street','Why your brain overthinks at night','A friendship that started with a mistake'];
const DIALOGUE_TOPICS = ['Meal planning for the week','Discussing a weekend trip','Asking for directions','Booking a table at a restaurant','Talking about a new hobby','Complaining about noisy neighbours','Planning a birthday party','Discussing relationships and friendship','Buying a train ticket','Calling in sick to work','Choosing a gift','Talking about the weather'];

const TOPIC_COURSES = [
  {g:'life',id:'travel',t:'Seyahat',en:'Travel',u:['Planning a trip','At the airport','Checking in at a hotel','Asking for directions','Using public transport','Eating out abroad','Sightseeing and tours','Solving travel problems']},
  {g:'life',id:'social',t:'Sosyal hayat',en:'Social life',u:['Meeting new people','Making plans with friends','Talking about hobbies','Giving compliments','Invitations and excuses','Talking about films and music','Keeping in touch','Celebrations']},
  {g:'life',id:'abroad',t:'Yurt dışına taşınma',en:'Moving abroad',u:['Finding a flat','Opening a bank account','Registering with a doctor','Talking to neighbours','At the post office','Understanding bills','Making local friends','Dealing with homesickness']},
  {g:'life',id:'food',t:'Yemek ve restoran',en:'Food and dining',u:['Ordering at a restaurant','Talking about tastes','Cooking at home','Food shopping','Diets and allergies','Recipes and instructions','Complaining about food','Food traditions']},
  {g:'life',id:'small',t:'Günlük sohbet',en:'Small talk',u:['The weather','Weekend plans','Work and studies','Sports','Family news','Holidays','Current events (neutral)','Ending a conversation politely']},
  {g:'life',id:'health',t:'Sağlık ve spor',en:'Health and fitness',u:['At the gym','Describing pain','At the pharmacy','Healthy habits','Sleep and stress','Booking an appointment','Talking about exercise','Mental wellbeing']},
  {g:'pro',id:'business',t:'İş İngilizcesi',en:'Business',u:['Types of organisations','Company structure','Roles and leadership','The modern workplace','Recruitment','Meetings','Presentations','Negotiations','Emails','Sales and costs']},
  {g:'pro',id:'medicine',t:'Tıp',en:'Medicine',u:['Taking a patient history','Symptoms and signs','Physical examination','Explaining a diagnosis','Medication and dosage','Talking to colleagues','Emergency situations','Breaking bad news gently']},
  {g:'pro',id:'tech',t:'Teknoloji',en:'Tech',u:['Describing software','Stand-up meetings','Code reviews','Reporting bugs','Explaining architecture','Working with clients','Security basics','Product launches']},
  {g:'pro',id:'hospitality',t:'Turizm ve otelcilik',en:'Hospitality',u:['Greeting guests','Reservations','Room service','Handling complaints','Recommending places','Checking out','Restaurant service','Events and conferences']},
  {g:'pro',id:'sales',t:'Satış',en:'Sales',u:['Cold calling','Understanding needs','Presenting a product','Handling objections','Talking about price','Closing a deal','Following up','After-sales service']},
  {g:'pro',id:'support',t:'Müşteri hizmetleri',en:'Customer support',u:['Answering the phone','Identifying the problem','Calming an angry customer','Giving instructions','Escalating an issue','Refunds and returns','Writing support emails','Closing the call']},
  {g:'pro',id:'logistics',t:'Lojistik',en:'Logistics',u:['Warehouse vocabulary','Shipping and delivery','Tracking orders','Customs and documents','Delays and problems','Talking to drivers','Inventory','Suppliers']},
  {g:'pro',id:'law',t:'Hukuk',en:'Law',u:['Legal professions','Contracts','Meeting a client','Court vocabulary','Rights and obligations','Disputes','Legal letters','Negotiating terms']}
];

const RANKS = [[1,'Çaylak'],[5,'Kaşif'],[10,'Konuşmacı'],[15,'Usta adayı'],[20,'Usta'],[25,'Büyük usta'],[30,'Efsane']];
const ACH = [
  {id:'first',t:'İlk adım',d:'İlk mesajını gönder',f:s=>s.stats.msgs>=1},
  {id:'words50',t:'Kelime ustası',d:'50 kelime öğren',f:s=>Object.keys(s.srs).length>=50},
  {id:'sent50',t:'Cümle kurucu',d:'50 cümleyi doğru kur',f:s=>s.stats.sentOk>=50},
  {id:'role5',t:'Rol oyuncusu',d:'5 rol yapma tamamla',f:s=>(s.stats.done.roleplay||0)>=5},
  {id:'debate3',t:'Hatip',d:'3 münazara bitir',f:s=>(s.stats.done.debate||0)>=3},
  {id:'story3',t:'Hikâye dinleyicisi',d:'3 hikâye bitir',f:s=>(s.stats.done.podcast||0)>=3},
  {id:'photo3',t:'Gözlemci',d:'3 fotoğraf anlat',f:s=>(s.stats.done.photo||0)>=3},
  {id:'perfect10',t:'Kusursuz on',d:'Üst üste 10 hatasız mesaj',f:s=>s.stats.bestRun>=10},
  {id:'streak3',t:'Üç gün',d:'3 günlük seri yap',f:s=>longestStreak()>=3},
  {id:'streak7',t:'Bir hafta',d:'7 günlük seri yap',f:s=>longestStreak()>=7},
  {id:'hour1',t:'Bir saat',d:'Toplam 1 saat çalış',f:s=>totalSecs()>=3600},
  {id:'hour10',t:'On saat',d:'Toplam 10 saat çalış',f:s=>totalSecs()>=36000},
  {id:'cert1',t:'İlk sertifika',d:'Bir seviye sınavını geç',f:s=>Object.keys(s.certs||{}).length>=1},
  {id:'certAll',t:'Yolun sonu',d:'Beş seviyenin sertifikasını al',f:s=>LEVELS.every(L=>(s.certs||{})[L])}
];
/* Model tercihi: Dil Harita'nın sağlayıcı sırasını belirler. */
const TIERS=[['fast','Hızlı','Groq/Cerebras önce · en hızlı cevap'],['quality','Kaliteli','Gemini önce · daha dikkatli düzeltme']];

/* ================= Durum (kalıcı, cloud-sync ile birleşir) ================= */
const DEFAULT = () => ({v:1, level:'', rate:0.9, voiceName:'', showTr:true, theme:'system', course:'', goal:'',
  tierChat:'fast', tierDeep:'quality', setAt:0, resetAt:0,
  xp:0, days:{}, done:{}, srs:{}, errors:[], delErr:{}, fb:{}, certs:{}, exams:{}, certName:'', custom:{}, customDel:{}, stats:{msgs:0,ok:0,run:0,bestRun:0,sentOk:0,sentAll:0,pron:[],done:{}}, ach:{}});
let S = DEFAULT();
let dict=null;
function normalizeState(){
  S=Object.assign(DEFAULT(),S); S.stats=Object.assign(DEFAULT().stats,S.stats||{});
  if(!TIERS.some(t=>t[0]===S.tierChat)) S.tierChat='fast';
  if(!TIERS.some(t=>t[0]===S.tierDeep)) S.tierDeep='quality';
  if(!S.level) S.level=dhLevel();
  if(!S.course) S.course='L:'+S.level;
  S.certs=S.certs||{}; S.exams=S.exams||{}; S.custom=S.custom||{}; S.customDel=S.customDel||{};
  if(String(S.course).startsWith('C:')&&!S.custom[S.course.slice(2)]) S.course='L:'+S.level;
}
/* Dil Harita profilindeki seviye ilk açılışta varsayılan olur. */
function dhLevel(){
  try{ const p=JSON.parse(localStorage.getItem('dh-profile-v1')||'{}')||{}; const lv=String(p.seviye||p.level||p.cefr||'').toUpperCase().match(/[ABC][12]/); if(lv&&LEVELS.includes(lv[0])) return lv[0]; if(lv&&lv[0]==='C2') return 'C1'; }catch(e){}
  return 'A2';
}
function load(){ try{ const raw=localStorage.getItem(STORE_KEY); if(raw) S=JSON.parse(raw); }catch(e){} normalizeState(); }
let saveTimer=null;
function save(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveNow,600); }
function saveNow(){
  clearTimeout(saveTimer);
  if(S.errors.length>150) S.errors=S.errors.slice(-150);
  if(S.stats.pron.length>200) S.stats.pron=S.stats.pron.slice(-200);
  S.updatedAt=Date.now();
  try{ localStorage.setItem(STORE_KEY,JSON.stringify(S)); }catch(e){}
}
function touchSettings(){ S.setAt=Date.now(); save(); }
window.addEventListener('pagehide',saveNow);
document.addEventListener('visibilitychange',()=>{ if(document.hidden) saveNow(); });
/* Başka bir sekmede ya da bulut senkronunda değişirse yeniden oku. */
window.addEventListener('storage',e=>{ if(e.key===STORE_KEY&&e.newValue&&$('#panel').hidden){ try{ S=JSON.parse(e.newValue); normalizeState(); applyTheme(); render(); }catch(x){} } });
load();
applyTheme();
function applyTheme(){ if(S.theme==='system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme',S.theme); }

/* ================= Zaman, seri, XP ================= */
let lastAct=0;
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>{lastAct=Date.now();},{passive:true}));
setInterval(()=>{
  if(document.hidden||$('#panel').hidden||Date.now()-lastAct>90000) return;
  const k=today(); S.days[k]=(S.days[k]||0)+5; if(S.days[k]%60===0) save();
},5000);
function totalSecs(){ return Object.values(S.days).reduce((a,b)=>a+b,0); }
function dayOk(k){ return (S.days[k]||0)>=180; }
function curStreak(){ let n=0; const d=new Date(); if(!dayOk(dayKey(d))) d.setDate(d.getDate()-1); while(dayOk(dayKey(d))){ n++; d.setDate(d.getDate()-1);} return n; }
function longestStreak(){ const ks=Object.keys(S.days).filter(dayOk).sort(); let best=0,run=0,prev=null; for(const k of ks){ const d=new Date(k+'T12:00:00'); if(prev&&Math.round((d-prev)/864e5)===1) run++; else run=1; best=Math.max(best,run); prev=d;} return best; }
function levelInfo(){ const xp=S.xp; let lv=Math.floor(Math.sqrt(xp/40))+1; const base=40*(lv-1)**2, next=40*lv**2; const pct=Math.round((xp-base)/(next-base)*100); let rank=RANKS[0][1], nextRank=null; for(const [l,n] of RANKS){ if(lv>=l) rank=n; else { nextRank=[l,n]; break; } } return {lv,pct,rank,nextRank,xp}; }
function addXP(n){ S.xp+=n; checkAch(); save(); }
function checkAch(){ for(const a of ACH){ if(!S.ach[a.id]&&a.f(S)){ S.ach[a.id]=today(); toast('Rozet kazandın: '+a.t); } } }
function markDone(kind){ S.stats.done[kind]=(S.stats.done[kind]||0)+1; checkAch(); save(); }
function errId(e){ return (e.d||'')+'|'+(e.wrong||'')+'|'+(e.right||''); }
function addError(e){ S.errors.push(e); save(); return e; }
function removeError(e){ if(!e) return; const k=S.errors.indexOf(e); if(k>=0) S.errors.splice(k,1); S.delErr[errId(e)]=Date.now(); save(); }

/* ================= Ses: konuşma (speechSynthesis) ve mikrofon ================= */
let micTarget=null, micLive=false;
function enVoices(){ try{ return (speechSynthesis.getVoices()||[]).filter(v=>/^en[-_]/i.test(v.lang)||/english/i.test(v.name)); }catch(e){ return []; } }
try{ speechSynthesis.onvoiceschanged=()=>{ if(route()==='account'&&$('#panel').hidden) render(); }; }catch(e){}
function pickVoice(){
  const vs=enVoices(); if(!vs.length) return null;
  let want=S.voiceName;
  if(!want){ try{ const g=JSON.parse(localStorage.getItem('dh-voice:__global__')||'null'); if(g&&g.name) want=g.name; }catch(e){} }
  return (want&&vs.find(v=>v.name===want)) || vs.find(v=>/en-US/i.test(v.lang)) || vs[0];
}
function speak(text){
  if(!text) return Promise.resolve();
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text); const v=pickVoice(); if(v){ u.voice=v; u.lang=v.lang; } else u.lang='en-US';
    u.rate=S.rate;
    return new Promise(r=>{ u.onend=r; u.onerror=r; speechSynthesis.speak(u); setTimeout(r,Math.max(4000,text.length*140)); });
  }catch(e){ return Promise.resolve(); }
}
function stopSpeak(){ try{ speechSynthesis.cancel(); }catch(e){} }
/* Tarayıcının konuşma tanımasını, sayfanın beklediği basit arayüze sarar:
   start()/stop(), onPartial (canlı tahmin), onFinal (kesinleşen parça), onState. */
function makeDictation(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR) return null;
  let rec=null, stopping=null; const h={p:[],f:[],s:[]};
  return {
    onPartial(fn){h.p.push(fn);}, onFinal(fn){h.f.push(fn);}, onState(fn){h.s.push(fn);},
    start(){ return new Promise((res,rej)=>{
      try{
        rec=new SR(); rec.lang='en-US'; rec.interimResults=true; rec.continuous=true; rec.maxAlternatives=1;
        rec.onstart=()=>{ h.s.forEach(f=>f({state:'listening'})); res(); };
        rec.onresult=e=>{ let interim=''; for(let i=e.resultIndex;i<e.results.length;i++){ const r=e.results[i]; if(r.isFinal){ const t=r[0].transcript.trim(); if(t) h.f.forEach(f=>f({text:t})); } else interim+=r[0].transcript; } h.p.forEach(f=>f({text:interim})); };
        rec.onerror=e=>{ if(e.error==='not-allowed'||e.error==='service-not-allowed') rej({code:'not_granted'}); };
        rec.onend=()=>{ rec=null; h.s.forEach(f=>f({state:'idle',reason:'stopped'})); if(stopping){ stopping(); stopping=null; } };
        rec.start();
      }catch(err){ rej({code:'error',message:String(err)}); }
    }); },
    stop(){ return new Promise(r=>{ if(!rec) return r(); stopping=r; try{ rec.stop(); }catch(e){ r(); } }); }
  };
}
dict=makeDictation();
if(dict){
  dict.onPartial(({text})=>{ if(micTarget&&micTarget.partial) micTarget.partial(text); });
  dict.onFinal(({text})=>{ if(micTarget&&micTarget.final) micTarget.final(text); });
  dict.onState(({state})=>{ micLive = state==='listening'; document.querySelectorAll('.mic').forEach(b=>b.classList.toggle('live',micLive)); if(!micLive&&micTarget&&micTarget.idle) micTarget.idle(); });
}
function micButton(target){
  const b=document.createElement('button'); b.className='mic'; b.type='button'; b.innerHTML=ic('mic'); b.setAttribute('aria-label','Sesle yaz');
  if(!dict){ b.title='Bu tarayıcıda ses tanıma yok (Chrome veya Edge kullan). Yazarak devam edebilirsin.'; b.disabled=true; b.style.opacity=.35; return b; }
  b.onclick=()=>{
    if(micLive){ dict.stop().catch(()=>{}); return; }
    micTarget=target; stopSpeak();
    dict.start().catch(e=>{ if(e&&e.code==='not_granted'){ toast('Mikrofon izni verilmedi. Yazarak devam edebilirsin.'); } });
  };
  return b;
}
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.remove('hide'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.add('hide'),3200); }

/* ================= Yapay zekâ (Dil Harita anahtarları) ================= */
const LEVEL_GUIDE = {
  A1:'Use only very common words and very short present-tense sentences (5-8 words).',
  A2:'Use simple everyday words, short sentences, mostly present and past simple.',
  B1:'Use clear everyday English with some phrasal verbs; sentences up to about 15 words.',
  B2:'Use natural English with a range of tenses, idioms occasionally.',
  C1:'Use rich, natural, idiomatic English.'
};
function aiOff(){ return !(window.DHProviders&&DHProviders.chat); }
function hasKeys(){ try{ return !!(window.DHProviders&&DHProviders.realHasAnyKey&&DHProviders.realHasAnyKey()); }catch(e){ return false; } }
function geminiKeys(){ try{ return (JSON.parse(localStorage.getItem('geminiApiKeys')||'[]')||[]).filter(Boolean); }catch(e){ return []; } }
function parseJSON(t){
  t=String(t||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
  try{ return JSON.parse(t); }catch(e){}
  const a=t.indexOf('{'), b=t.lastIndexOf('}');
  if(a>=0&&b>a){ try{ return JSON.parse(t.slice(a,b+1)); }catch(e){} }
  throw {code:'bad_json',message:'Yapay zekâ cevabı okunamadı'};
}
async function ai(input,{json=true,deep=false,images=null}={}){
  if(aiOff()) throw {code:'no_ai'};
  if(images&&images.length) return geminiVision(input,images[0],json);
  const tier=(deep?S.tierDeep:S.tierChat)||'fast';
  const sys='You help a Turkish learner practise English inside the Konuşkan app.'+(json?' Reply with valid JSON only, no markdown fences.':' Reply in plain text, no markdown headings.');
  const txt=await DHProviders.chat([{role:'system',content:sys},{role:'user',content:input}],{json,fast:tier==='fast',max_tokens:json?900:700,temperature:0.4,title:'Konuşkan'});
  return json?parseJSON(txt):String(txt||'').trim();
}
function blobToB64(blob){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result).split(',')[1]); r.onerror=rej; r.readAsDataURL(blob); }); }
async function geminiVision(prompt,blob,json){
  const keys=geminiKeys(); if(!keys.length) throw {code:'no_gemini'};
  const b64=await blobToB64(blob); const model=(DHProviders.getModel&&DHProviders.getModel('gemini'))||'gemini-3.6-flash';
  let last=null;
  for(const key of keys){
    try{
      const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{role:'user',parts:[{inline_data:{mime_type:blob.type||'image/jpeg',data:b64}},{text:prompt}]}],generationConfig:Object.assign({temperature:0.4,maxOutputTokens:4000},json?{responseMimeType:'application/json'}:{})})});
      if(res.status===429){ last={code:'rate'}; continue; }
      if(!res.ok){ last={code:'http',message:'Gemini '+res.status}; continue; }
      const d=await res.json(); const parts=(d.candidates&&d.candidates[0]&&d.candidates[0].content&&d.candidates[0].content.parts)||[];
      const txt=parts.filter(p=>typeof p.text==='string'&&!p.thought).map(p=>p.text).join('');
      if(!txt){ last={code:'empty'}; continue; }
      return json?parseJSON(txt):txt.trim();
    }catch(e){ last=e&&e.code?e:{code:'network'}; }
  }
  throw last||{code:'all-failed'};
}
function aiErr(e){
  const c=e&&e.code;
  if(c==='rate'||c==='rate_limited') return 'Yapay zekâ limiti doldu. Biraz bekleyip tekrar dene ya da Dil Harita\'ya başka bir anahtar ekle.';
  if(c==='no_ai') return 'Yapay zekâ katmanı yüklenemedi. Sayfayı yenile.';
  if(c==='no-key'||c==='all-failed') return 'Yapay zekâ cevap vermedi. Dil Harita\'daki API anahtarlarını kontrol et (Kitaplık menüsü).';
  if(c==='no_gemini') return 'Fotoğraf modu için Dil Harita\'da bir Gemini anahtarı kayıtlı olmalı.';
  if(c==='bad_json') return 'Yapay zekâ cevabı okunamadı. Tekrar dene ya da modeli "Kaliteli" yap.';
  if(c==='abort') return 'İstek iptal edildi.';
  return 'Yanıt alınamadı: '+((e&&e.message)||c||'bilinmeyen hata');
}
function learnerContext(){ const errs=S.errors.slice(-12).map(e=>`"${e.wrong}" -> "${e.right}"`).join('; '); return errs?`\nThe learner's recent mistakes (use them to personalise gently, never list them): ${errs}`:''; }

/* ================= Seviye seçimi ================= */
function setLevel(L){
  if(!LEVELS.includes(L)||L===S.level&&S.course==='L:'+L) { if(L===S.level) location.hash=location.hash||'#home'; return; }
  S.level=L; if(String(S.course).startsWith('L:')) S.course='L:'+L; touchSettings();
  toast('Seviye '+L+' · '+LEVEL_NAMES[L]+' seçildi'); render();
}
function levelProgress(L){ return courseProgress(courseById('L:'+L)); }
function levelChips(compact){
  return `<div class="lvls ${compact?'lvls--side':''}" role="group" aria-label="Seviye seç">${LEVELS.map(L=>{ const c=S.certs[L], p=levelProgress(L);
    return `<button type="button" class="lvl ${S.level===L?'on':''}" data-lv="${L}" aria-pressed="${S.level===L}" title="${L} · ${LEVEL_NAMES[L]}${c?' · sertifika alındı':''}"><b>${L}</b><small>${LEVEL_NAMES[L]}</small>${c?`<span class="lvl-cert" aria-label="Sertifika">${ic('star','width="12" height="12"')}</span>`:''}<i style="width:${p}%"></i></button>`; }).join('')}</div>`;
}
function bindLevels(el){ el.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>setLevel(b.dataset.lv)); }

/* ================= Yönlendirme ================= */
const PAGES = [['home','Ana sayfa','home'],['learn','Öğren','learn'],['courses','Kurslar','courses'],['explore','Keşfet','explore'],['progress','İlerleme','progress'],['account','Ayarlar','account']];
function route(){ const h=(location.hash||'#home').slice(1); return PAGES.some(p=>p[0]===h)?h:'home'; }
window.addEventListener('hashchange',render);
function render(){
  const r=route();
  $('#nav').innerHTML=PAGES.map(([id,t,icn],i)=>(i===5?'<span class="sp"></span>':'')+`<a href="#${id}" class="${r===id?'on':''}">${ic(icn,'width="20" height="20"')}<span>${t}</span></a>`).join('')
    +`<a href="./index.html" title="Dil Harita ana sayfası">${ic('dh','width="20" height="20"')}<span>Dil Harita</span></a>`;
  let sl=$('#sideLv'); if(!sl){ sl=document.createElement('div'); sl.id='sideLv'; $('.brand').after(sl); }
  sl.innerHTML='<div class="eyebrow" style="padding:0 10px 6px">Seviye</div>'+levelChips(true); bindLevels(sl);
  const m=$('#main'); m.innerHTML=''; m.scrollTop=0;
  ({home:pHome,learn:pLearn,courses:pCourses,explore:pExplore,progress:pProgress,account:pAccount})[r](m);
}

/* ================= Sayfalar ================= */
function capNotice(){
  if(aiOff()) return `<div class="notice small">${aiErr({code:'no_ai'})}</div>`;
  if(hasKeys()) return '';
  return `<div class="notice small">Bu cihazda Dil Harita yapay zekâ anahtarı yok. Sohbet ve düzeltmeler Gemini kopyala-yapıştır yöntemiyle çalışır. Anahtar eklemek için Dil Harita'nın Kitaplık menüsündeki yapay zekâ ayarlarını kullan. Kelime, cümle ve kart modları anahtarsız çalışır.</div>`;
}
function modeCard(m){
  return `<button class="mode" data-mode="${m.id}"><div class="art" style="background:${m.c}">${m.tag?`<span class="tag">${m.tag}</span>`:''}<span style="color:#1d2621">${ic(m.icon)}</span></div><div class="body"><h3>${m.t}</h3><span class="muted small">${m.d}</span></div></button>`;
}
function bindModes(el){ el.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>openMode(b.dataset.mode)); }
function sideSummary(){
  const L=levelInfo(), c=courseById(S.course), p=courseProgress(c);
  return `<div class="stack">
    <button class="card item" id="goCourse" style="background:var(--accent);color:var(--accent-ink);border-color:var(--accent)"><div class="grow"><div class="small" style="opacity:.85">Seçili kurs</div><h3>${esc(c.t)}</h3><div class="bar" style="margin-top:8px;background:rgba(255,255,255,.3)"><i style="width:${p}%;background:var(--accent-ink)"></i></div><div class="small" style="margin-top:4px">%${p} tamamlandı</div></div>${ic('arrow','width="20" height="20"')}</button>
    <div class="card stack"><div class="row"><span class="pill acc">${ic('star','width="14" height="14"')} Seviye ${L.lv}</span><b>${L.rank}</b></div><div class="bar"><i style="width:${L.pct}%"></i></div><div class="small muted">${L.xp} XP · sonraki seviyeye %${100-L.pct} kaldı</div></div>
    <div class="card row between"><div class="stat"><span class="muted small">Süren seri</span><b>${curStreak()} gün</b></div><div class="stat"><span class="muted small">En uzun</span><b>${longestStreak()} gün</b></div></div>
    <div class="card stack"><h3>Günlük geri bildirim</h3><p class="small muted" style="margin:0">Bugünkü pratiğinden kişisel değerlendirme al.</p><button class="btn sm" id="goFb">Geri bildirimi gör</button></div>
  </div>`;
}
function bindSide(el){ const g=$('#goCourse',el); if(g) g.onclick=()=>location.hash='#learn'; const f=$('#goFb',el); if(f) f.onclick=()=>openMode('feedback'); }
function pHome(m){
  const hi = new Date().getHours()<12?'Günaydın':'Merhaba';
  m.innerHTML=`<div class="wrap"><div class="stack" style="gap:10px"><h1>${hi}, bugün ne çalışalım?</h1><div class="row between"><span class="small muted">Seviyeni seç: yapay zekâ, kelimeler ve kurs bu seviyeye göre ayarlanır.</span><button class="btn sm ghost" id="goExam">${S.certs[S.level]?ic('star','width="15" height="15"')+' '+S.level+' sertifikan var':S.level+' seviye sınavı'}</button></div>${levelChips(false)}</div>${capNotice()}
  <div class="cols"><div class="stack"><h2>Öğrenme modları</h2><div class="grid">${MODES.map(modeCard).join('')}</div></div>${sideSummary()}</div></div>`;
  bindModes(m); bindSide(m); bindLevels(m);
  $('#goExam',m).onclick=()=>S.certs[S.level]?openCert(S.level):examIntro(S.level);
}
function courseById(id){
  const [k,v]=String(id||'L:A2').split(':');
  if(k==='L'){ const lv=LEVELS.includes(v)?v:'A2'; const units=DATA.course[lv]||[]; return {id:'L:'+lv, t:`${lv} · ${LEVEL_NAMES[lv]}`, level:lv, units:units.map((u,i)=>({t:u.t, i, ex:['word','sentence','roleplay']}))}; }
  if(k==='C'&&S.custom[v]){ const cc=S.custom[v]; return {id:'C:'+v, t:cc.t, en:cc.en, custom:cc, clevel:cc.level, topic:{t:cc.t,en:cc.en}, units:(cc.units||[]).map((u,i)=>({t:u.tr?`${u.tr} · ${u.t}`:u.t, en:u.t, focus:u.focus||'', i, ex:['word','sentence','roleplay']}))}; }
  if(k==='C') return courseById('L:'+S.level);
  if(k==='M'){ const s=MOD_SERIES.find(x=>x.key===v); if(!s) return courseById('L:'+S.level); return {id:'M:'+v, t:s.t, en:s.t, mod:s, clevel:s.level, topic:{t:s.t,en:s.t}, units:s.parts.map((p,i)=>({t:p.part?`Parça ${p.part}`:String(p.ad||'').slice(0,60), en:s.t+(p.part?` (part ${p.part})`:''), modId:p.id, n:p.n, i, ex:['sentence','word','roleplay']}))}; }
  const tc=TOPIC_COURSES.find(c=>c.id===v)||TOPIC_COURSES[0];
  return {id:'T:'+tc.id, t:tc.t, en:tc.en, topic:tc, units:tc.u.map((t,i)=>({t, en:t, i, ex:['word','dialogue','roleplay']}))};
}
function exKey(cid,ui,ex){ return cid+'|'+ui+'|'+ex; }
function courseProgress(c){ const tot=c.units.length*3; let n=0; c.units.forEach(u=>u.ex.forEach(ex=>{ if(S.done[exKey(c.id,u.i,ex)]) n++; })); return tot?Math.round(n/tot*100):0; }
const EX_NAMES={word:'Kelime modu',sentence:'Cümle modu',roleplay:'Rol yapma',dialogue:'Diyalog modu'};
const EX_ICON={word:'word',sentence:'sentence',roleplay:'role',dialogue:'dialogue'};
function pLearn(m){
  const c=courseById(S.course), p=courseProgress(c);
  m.innerHTML=`<div class="wrap"><div class="row between"><div><span class="eyebrow">Öğrenme yolu</span><h1>${esc(c.t)}</h1><p class="muted" style="margin:4px 0 0">${c.custom?`Kendi kursun · ${c.clevel} seviyesi · `:c.mod?`Dil Harita modülü · ${c.clevel} · `:''}${c.units.length} ünite · her ünitede 3 alıştırma</p></div><div style="min-width:200px"><div class="bar"><i style="width:${p}%"></i></div><div class="small muted" style="margin-top:4px">%${p} tamamlandı</div></div></div>
  <div style="max-width:720px;width:100%" id="path"></div></div>`;
  const path=$('#path',m);
  let firstOpen=c.units.findIndex(u=>u.ex.some(ex=>!S.done[exKey(c.id,u.i,ex)])); if(firstOpen<0) firstOpen=0;
  c.units.forEach(u=>{
    const h=document.createElement('div'); h.className='unit-h'; h.id='u'+u.i;
    h.innerHTML=`<div><span class="eyebrow">Ünite ${u.i+1}</span><h3>${esc(u.t)}</h3></div>`;
    path.appendChild(h);
    const l=document.createElement('div'); l.className='list';
    u.ex.forEach((ex,j)=>{
      const done=S.done[exKey(c.id,u.i,ex)];
      const b=document.createElement('button'); b.className='item';
      b.innerHTML=`<span class="dot ${done?'done':''}">${ic(done?'check':EX_ICON[ex])}</span><div class="grow"><b>Alıştırma ${j+1}</b><div class="small muted">${EX_NAMES[ex]}</div></div>${ic('arrow','width="18" height="18" style="color:var(--muted)"')}`;
      b.onclick=()=>openExercise(c,u,ex);
      l.appendChild(b);
    });
    path.appendChild(l);
  });
  if(c.level){
    const L=c.level, cert=S.certs[L], ex=S.exams[L];
    const h=document.createElement('div'); h.className='unit-h'; h.innerHTML=`<div><span class="eyebrow">Seviye sonu</span><h3>${L} seviye sınavı ve sertifika</h3></div>`; path.appendChild(h);
    const card=document.createElement('div'); card.className='card stack exam-card'; card.style.gap='10px';
    card.innerHTML=`<div class="row"><span class="dot item" style="all:unset;width:44px;height:44px;border-radius:99px;display:flex;align-items:center;justify-content:center;background:${cert?'var(--sun)':'var(--accent-soft)'};color:${cert?'#2a1a00':'var(--accent)'}">${ic(cert?'star':'courses','width="22" height="22"')}</span><div style="flex:1;min-width:0"><b>${cert?`Sertifika alındı · %${cert.score}`:'Seviye sonu sınavı'}</b><div class="small muted">${cert?`${esc(cert.date)} · No: ${esc(cert.id)}`:'Kelime, dilbilgisi, çeviri, dinleme, konuşma ve yazma. Geçme notu %70.'}${ex&&!cert?` · son deneme %${ex.last}`:''}</div></div></div>
      ${!cert&&p<80?`<div class="small muted">Önerilen: önce yolun en az %80'ini bitir (şu an %${p}). Seviyeyi biliyorsan doğrudan sınava girebilirsin.</div>`:''}
      <div class="row">${cert?`<button class="btn primary sm" data-x="cert">Sertifikayı gör</button><button class="btn sm" data-x="exam">Sınavı yeniden yap</button>${L!=='C1'?`<button class="btn sm" data-x="next">${LEVELS[LEVELS.indexOf(L)+1]} seviyesine geç</button>`:''}`:`<button class="btn primary sm" data-x="exam">Sınava başla</button>`}</div>`;
    card.querySelectorAll('[data-x]').forEach(x=>x.onclick=()=>{ const a=x.dataset.x; if(a==='cert') openCert(L); else if(a==='exam') examIntro(L); else setLevel(LEVELS[LEVELS.indexOf(L)+1]); });
    path.appendChild(card);
  }
  setTimeout(()=>{ const el=$('#u'+firstOpen,m); if(el&&firstOpen>1) el.scrollIntoView({block:'start'}); },30);
}
function pCourses(m){
  const lvl=LEVELS.map(L=>({id:'L:'+L,t:`${L} · ${LEVEL_NAMES[L]}`,d:`${(DATA.course[L]||[]).length} ünite · Dil Harita müfredatının tamamı`}));
  const card=(c)=>{ const cc=courseById(c.id), p=courseProgress(cc), on=S.course===c.id; return `<button class="item" data-c="${c.id}" style="${on?'border-color:var(--accent);background:var(--accent-soft)':''}"><span class="dot">${ic(c.id.startsWith('L')?'courses':c.id.startsWith('M')?'note':'book')}</span><div class="grow"><b>${esc(c.t)}</b><div class="small muted">${esc(c.d)}</div></div>${c.id.startsWith('L:')&&S.certs[c.id.slice(2)]?`<span class="pill warn">${ic('star','width="12" height="12"')} Sertifika</span>`:''}${p?`<span class="pill ${p===100?'ok':'acc'}">%${p}</span>`:''}${on?'<span class="pill acc">Seçili</span>':''}</button>`; };
  const life=TOPIC_COURSES.filter(c=>c.g==='life').map(c=>({id:'T:'+c.id,t:c.t,d:c.u.length+' ünite · '+c.en}));
  const pro=TOPIC_COURSES.filter(c=>c.g==='pro').map(c=>({id:'T:'+c.id,t:c.t,d:c.u.length+' ünite · '+c.en}));
  const mine=Object.values(S.custom).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).map(c=>({id:'C:'+c.id,t:c.t,d:`${c.level} · ${(c.units||[]).length} ünite · ${c.topic}`}));
  m.innerHTML=`<div class="wrap"><div><h1>Kurslar</h1><p class="muted" style="margin:4px 0 0">Bir kurs seç; Öğren sayfası o kursun yolunu gösterir. Seviye kursları Dil Harita müfredatından gelir.</p></div>
  <div class="stack"><div class="row between"><h2>Kendi kurslarım</h2><button class="btn primary sm" id="newCourse">+ Yeni kurs oluştur</button></div>
    ${mine.length?`<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${mine.map(c=>`<div class="stack" style="gap:4px">${card(c)}<button class="btn sm ghost" data-del="${c.id.slice(2)}" style="align-self:flex-end;color:var(--muted)">Sil</button></div>`).join('')}</div>`
      :`<div class="empty">İstediğin konuda ve seviyede kendi kursunu oluştur: yapay zekâ üniteleri planlar, her ünitede kelime, cümle ve rol yapma alıştırması olur.</div>`}</div>
  ${MOD_SERIES.length?`<div class="stack"><div><h2>Dil Harita modüllerim</h2><p class="small muted" style="margin:2px 0 0">Modüllerim'deki modüllerin seriye göre gruplandı: her parça bir ünite. Yeni oluşturduğun modüller burada kendiliğinden görünür.${MOD_SERIES.some(s=>s.eksik)?' Cümleleri bu cihaza henüz gelmemiş parçalar gösterilmiyor.':''}</p></div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${MOD_SERIES.map(s=>card({id:'M:'+s.key,t:s.t,d:`${s.level} · ${s.parts.length} parça · ${s.parts.reduce((a,p)=>a+p.n,0)} cümle${s.alan?' · '+s.alan:''}${s.eksik?` · ${s.eksik} parça bu cihazda yok`:''}`})).join('')}</div></div>`:''}
  <div class="stack"><h2>Seviye kursları</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${lvl.map(card).join('')}</div></div>
  <div class="stack"><h2>Günlük hayat</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${life.map(card).join('')}</div></div>
  <div class="stack"><h2>Meslek kursları</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${pro.map(card).join('')}</div></div></div>`;
  m.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{ S.course=b.dataset.c; if(S.course.startsWith('L:')) S.level=S.course.slice(2); touchSettings(); location.hash='#learn'; });
  $('#newCourse',m).onclick=()=>startCourseBuilder();
  m.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ const id=b.dataset.del, c=S.custom[id]; if(!c) return;
    if(b.dataset.sure!=='1'){ b.dataset.sure='1'; b.textContent='Emin misin? "'+c.t+'" silinecek'; b.style.color='var(--bad)'; setTimeout(()=>{ if(b.isConnected){ b.dataset.sure=''; b.textContent='Sil'; b.style.color='var(--muted)'; } },4000); return; }
    delete S.custom[id]; S.customDel[id]=Date.now(); if(S.course==='C:'+id) S.course='L:'+S.level; touchSettings(); saveNow(); render(); toast('Kurs silindi'); });
}
function pExplore(m){
  const rp=pickDaily(ROLEPLAYS,2,'r'), ch=pickDaily(CHARACTERS,4,'c'), db1=pickDaily(DEBATES,2,'d'), st=pickDaily(STORY_TOPICS,2,'s'), dl=pickDaily(DIALOGUE_TOPICS,2,'g');
  const due=dueCards().length;
  const sec=(title,desc,items)=>`<div class="card stack"><div><h2>${title}</h2><p class="muted small" style="margin:2px 0 0">${desc}</p></div><div class="list">${items}</div></div>`;
  const it=(attr,title,sub,icn)=>`<button class="item" ${attr}><span class="dot">${ic(icn)}</span><div class="grow"><b>${esc(title)}</b>${sub?`<div class="small muted">${esc(sub)}</div>`:''}</div>${ic('arrow','width="18" height="18" style="color:var(--muted)"')}</button>`;
  const pick=ch[0];
  m.innerHTML=`<div class="wrap"><div><h1>Keşfet</h1><p class="muted" style="margin:4px 0 0">Her gün yenilenen seçimler. Bugün: ${new Date().toLocaleDateString('tr-TR',{day:'numeric',month:'long',weekday:'long'})}</p></div>
  <div class="card row" style="background:${pick.c};color:#fff;border:none"><div class="ava" style="width:64px;height:64px;font-size:1.6rem;background:rgba(0,0,0,.2)">${pick.t[0]}</div><div class="grow"><span class="small" style="opacity:.85">Günün seçimi · Karakterler</span><h2>${esc(pick.t)}</h2><span class="small">${esc(pick.sub)}</span></div><button class="btn sun" data-char="${pick.id}">Sohbete başla</button></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">
  ${sec('Hikâyeler','Seviyene göre yazılmış hikâyeler.',st.map(s=>it(`data-story="${esc(s)}"`,s,'~4 dk','pod')).join(''))}
  ${sec('Karakterler','Klasik romanların kahramanlarıyla konuş.',ch.slice(1).map(c=>it(`data-char="${c.id}"`,c.t,c.sub,'mask')).join(''))}
  ${sec('Diyaloglar','Hazır diyaloglarda rol al.',dl.map(s=>it(`data-dlg="${esc(s)}"`,s,'','dialogue')).join(''))}
  ${sec('Rol yapma','Bugünün senaryoları.',rp.map(r=>it(`data-rp="${r.id}"`,r.t,r.tasks.length+' görev','role')).join(''))}
  ${sec('Münazara','Bugünün konuları.',db1.map(s=>it(`data-deb="${esc(s)}"`,s,'','debate')).join(''))}
  ${sec('Kartlar',due?`Tekrar zamanı gelen ${due} kart var.`:'Bugün tekrar edilecek kart yok.',it('data-mode="flash"','Kartları tekrar et',due+' kart','flash')+it('data-mode="word"','Yeni kelime destesi',S.level+' seviyesi','word'))}
  </div></div>`;
  bindModes(m);
  m.querySelectorAll('[data-char]').forEach(b=>b.onclick=()=>startCharacter(CHARACTERS.find(c=>c.id===b.dataset.char)));
  m.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>startStory(b.dataset.story));
  m.querySelectorAll('[data-dlg]').forEach(b=>b.onclick=()=>startDialogue(b.dataset.dlg));
  m.querySelectorAll('[data-rp]').forEach(b=>b.onclick=()=>startRoleplay(ROLEPLAYS.find(r=>r.id===b.dataset.rp)));
  m.querySelectorAll('[data-deb]').forEach(b=>b.onclick=()=>startDebatePick(b.dataset.deb));
}
function fmtDur(s){ const h=Math.floor(s/3600), mi=Math.floor(s%3600/60); return h?`${h} sa ${mi} dk`:`${mi} dk`; }
function pProgress(m){
  const tot=totalSecs(), daysN=Object.keys(S.days).filter(dayOk).length, sessDays=Object.keys(S.days).filter(k=>S.days[k]>0).length;
  const avg=sessDays?Math.round(tot/sessDays):0; const pr=S.stats.pron; const pAvg=pr.length?Math.round(pr.reduce((a,b)=>a+b,0)/pr.length):null;
  const acc=S.stats.msgs?Math.round(S.stats.ok/S.stats.msgs*100):null;
  const L=levelInfo();
  const now=new Date(); const dow=(now.getDay()+6)%7; const start=new Date(now); start.setDate(now.getDate()-dow-28);
  let cal=['Pt','Sa','Ça','Pe','Cu','Ct','Pz'].map(d=>`<span class="muted">${d}</span>`).join('');
  for(let i=0;i<35;i++){ const d=new Date(start); d.setDate(start.getDate()+i); const k=dayKey(d); const s=S.days[k]||0; cal+=`<span class="d ${s>=180?'on':s>0?'part':''} ${k===today()?'today':''}" title="${k}: ${fmtDur(s)}">${d.getDate()}</span>`; }
  const bars=[]; for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); bars.push([d,S.days[dayKey(d)]||0]); }
  const mx=Math.max(600,...bars.map(b=>b[1]));
  const errsToday=S.errors.filter(e=>e.d===today()).length;
  m.innerHTML=`<div class="wrap"><div><h1>İlerleme</h1><p class="muted" style="margin:4px 0 0">Konuşkan'daki çalışma verilerin. Dil Harita hesabınla cihazlar arasında birleşir.</p></div>
  <div class="tiles">
    <div class="card stat"><span class="muted small">Toplam çalışma</span><b>${fmtDur(tot)}</b></div>
    <div class="card stat"><span class="muted small">Ortalama günlük</span><b>${fmtDur(avg)}</b></div>
    <div class="card stat"><span class="muted small">Seri sayılan gün</span><b>${daysN}</b></div>
    <div class="card stat"><span class="muted small">Mesaj doğruluğu</span><b>${acc==null?'—':'%'+acc}</b><span class="small muted">${S.stats.msgs} mesaj</span></div>
    <div class="card stat"><span class="muted small">Söyleyiş eşleşmesi</span><b>${pAvg==null?'—':pAvg+'/100'}</b><span class="small muted">sesli cümlelerde</span></div>
    <div class="card stat"><span class="muted small">Öğrenilen kelime</span><b>${Object.keys(S.srs).length}</b></div>
  </div>
  <div class="cols"><div class="stack">
    <div class="card stack"><div class="row between"><h2>Çalışma süresi</h2><span class="small muted">Son 7 gün</span></div>
      <div class="bars">${bars.map(([d,s])=>`<div title="${fmtDur(s)}"><span>${s>=60?Math.round(s/60):''}</span><i style="height:${Math.round(s/mx*100)}%;${s>=180?'':'opacity:.45'}"></i></div>`).join('')}</div>
      <div class="bars" style="height:auto;border:none;padding:0">${bars.map(([d])=>`<div><span>${d.toLocaleDateString('tr-TR',{weekday:'short'})}</span></div>`).join('')}</div>
      <p class="small muted" style="margin:0">Dakika cinsinden. Günü seriye saymak için en az 3 dakika pratik gerekir.</p></div>
    <div class="card stack"><div class="row between"><h2>Seri takvimi</h2><span class="pill warn">${ic('flame','width="14" height="14"')} ${curStreak()} gün</span></div><div class="cal">${cal}</div></div>
    <div class="card stack"><h2>Rozetler</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">${ACH.map(a=>`<div class="badge ${S.ach[a.id]?'got':''}"><span class="b">${ic(S.ach[a.id]?'star':'lock')}</span><b class="small">${a.t}</b><span class="small muted">${a.d}</span></div>`).join('')}</div></div>
  </div><div class="stack">
    <div class="card stack"><span class="pill acc" style="align-self:flex-start">Seviye ${L.lv}</span><h2>${L.rank}</h2><div class="bar"><i style="width:${L.pct}%"></i></div><div class="small muted">${L.xp} XP${L.nextRank?` · ${L.nextRank[1]} rütbesi seviye ${L.nextRank[0]}'de açılır`:''}</div>
      <div class="small">${RANKS.map(([l,n])=>`<div class="row between"><span>${n}</span><span class="muted">Seviye ${l}</span></div>`).join('')}</div></div>
    <div class="card stack"><h2>Sertifikalar</h2><div class="list">${LEVELS.map(Lv=>{ const c=S.certs[Lv], e=S.exams[Lv]; return `<div class="row between"><span class="row" style="gap:8px"><span class="pill ${c?'warn':''}">${c?ic('star','width="12" height="12"'):''} ${Lv}</span><span class="small">${c?`%${c.score} · ${esc(c.date)}`:e?`Son deneme %${e.last}`:'Henüz yok'}</span></span><button class="btn sm" data-cert="${Lv}" data-has="${c?1:0}">${c?'Gör':'Sınava gir'}</button></div>`; }).join('')}</div></div>
    <div class="card stack"><h2>Günlük geri bildirim</h2><p class="small muted" style="margin:0">Bugün ${errsToday} hata kaydedildi.</p><button class="btn primary sm" data-mode="feedback">Bugünün değerlendirmesi</button></div>
    <div class="card stack"><h2>Hata defteri</h2><p class="small muted" style="margin:0">${S.errors.length} kayıtlı hata. Dil Harita'nın genel hata defteri için <a href="./hata-defteri.html">buraya</a>.</p><button class="btn sm" data-mode="errors">Konuşkan hata defteri</button></div>
  </div></div></div>`;
  bindModes(m);
  m.querySelectorAll('[data-cert]').forEach(b=>b.onclick=()=>b.dataset.has==='1'?openCert(b.dataset.cert):examIntro(b.dataset.cert));
}
function pAccount(m){
  const vs=enVoices();
  let gName=''; try{ const g=JSON.parse(localStorage.getItem('dh-voice:__global__')||'null'); gName=g&&g.name||''; }catch(e){}
  const tierSel=(id,key)=>`<select id="${id}">${TIERS.map(([v,t,d])=>`<option value="${v}" ${S[key]===v?'selected':''}>${t} · ${d}</option>`).join('')}</select>`;
  const prov=(()=>{ try{ return (DHProviders.activeProviders()||[]).join(', '); }catch(e){ return ''; } })();
  m.innerHTML=`<div class="wrap" style="max-width:680px"><div><h1>Ayarlar</h1><p class="muted" style="margin:4px 0 0">Hedef dil: İngilizce · Çeviri dili: Türkçe</p></div>
  <div class="card stack">
    <div class="field"><label>Seviyem</label>${levelChips(false)}<span class="small muted">Yapay zekâ cevaplarını, kelime destelerini ve seçili seviye kursunu bu seviyeye göre ayarlar.</span></div>
    <div class="field"><label for="sName">Sertifikada yazacak ad</label><input id="sName" value="${esc(certName())}" maxlength="60" autocomplete="name"></div>
    <div class="field"><label for="sGoal">Öğrenme amacım</label><select id="sGoal">${['','İş ve kariyer','Seyahat','Sınav','Günlük konuşma','Yurt dışına taşınma'].map(g=>`<option ${S.goal===g?'selected':''} value="${g}">${g||'Seçilmedi'}</option>`).join('')}</select></div>
    <h2>Yapay zekâ</h2><p class="small muted" style="margin:-6px 0 0">Dil Harita'nın API anahtarları kullanılır${prov?` (bu cihazda: ${esc(prov)})`:''}. Seçim, sağlayıcıların hangi sırayla deneneceğini belirler.</p>
    <div class="field"><label for="sTierChat">Sohbet ve alıştırmalar</label>${tierSel('sTierChat','tierChat')}<span class="small muted">Sohbet, rol yapma, karakter, münazara, arama, diyalog, hikâye ve kelime destesi üretimi.</span></div>
    <div class="field"><label for="sTierDeep">Açıklama ve değerlendirmeler</label>${tierSel('sTierDeep','tierDeep')}<span class="small muted">Detaylı açıklama, puan açıklaması, münazara puanı ve günlük geri bildirim. Fotoğraf modu her zaman Gemini kullanır.</span></div>
    <h2>Ses</h2>
    <div class="field"><label for="sRate">Konuşma hızı: <span id="rateV">${S.rate}x</span></label><input type="range" id="sRate" min="0.6" max="1.3" step="0.05" value="${S.rate}"></div>
    <div class="field"><label for="sVoice">Ses</label><select id="sVoice"><option value="">Dil Harita ses ayarı${gName?` (${esc(gName)})`:''}</option>${vs.map(v=>`<option value="${esc(v.name)}" ${S.voiceName===v.name?'selected':''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}</select><button class="btn sm" id="tryVoice" style="align-self:flex-start">${ic('speaker','width="16" height="16"')} Dene</button></div>
    <div class="field"><label for="sTheme">Tema</label><select id="sTheme">${[['system','Sistem'],['light','Açık'],['dark','Koyu']].map(([v,t])=>`<option value="${v}" ${S.theme===v?'selected':''}>${t}</option>`).join('')}</select></div>
    <label class="row"><input type="checkbox" id="sTr" ${S.showTr?'checked':''}> Yapay zekâ mesajlarının Türkçesini otomatik göster</label>
  </div>
  <div class="card stack"><h2>Verilerim</h2><p class="small muted" style="margin:0">İlerlemen Dil Harita hesabınla buluta kaydedilir ve cihazlar arasında birleştirilir.</p>
    <div class="row"><button class="btn sm" id="resetData" style="color:var(--bad)">Konuşkan ilerlemesini sil</button></div><div id="resetBox"></div></div>
  </div>`;
  bindLevels(m);
  $('#sName',m).onchange=e=>{ S.certName=e.target.value.trim(); touchSettings(); };
  $('#sGoal',m).onchange=e=>{ S.goal=e.target.value; touchSettings(); };
  $('#sTierChat',m).onchange=e=>{ S.tierChat=e.target.value; touchSettings(); toast('Sohbet modeli: '+TIERS.find(t=>t[0]===S.tierChat)[1]); };
  $('#sTierDeep',m).onchange=e=>{ S.tierDeep=e.target.value; touchSettings(); toast('Açıklama modeli: '+TIERS.find(t=>t[0]===S.tierDeep)[1]); };
  $('#sRate',m).oninput=e=>{ S.rate=+e.target.value; $('#rateV',m).textContent=S.rate+'x'; touchSettings(); };
  $('#sVoice',m).onchange=e=>{ S.voiceName=e.target.value; touchSettings(); };
  $('#tryVoice',m).onclick=()=>speak('Hello! This is how I sound when we practise together.');
  $('#sTheme',m).onchange=e=>{ S.theme=e.target.value; applyTheme(); touchSettings(); };
  $('#sTr',m).onchange=e=>{ S.showTr=e.target.checked; touchSettings(); };
  $('#resetData',m).onclick=()=>{ $('#resetBox',m).innerHTML=`<div class="notice row between"><span>Konuşkan'daki tüm ilerleme bütün cihazlarda silinecek. Dil Harita'nın diğer verileri etkilenmez. Emin misin?</span><span class="row"><button class="btn sm" id="rNo">Vazgeç</button><button class="btn sm" id="rYes" style="background:var(--bad);color:#fff;border-color:var(--bad)">Evet, sil</button></span></div>`;
    $('#rNo',m).onclick=()=>$('#resetBox',m).innerHTML=''; $('#rYes',m).onclick=()=>{ const keep={level:S.level,theme:S.theme}; S=DEFAULT(); Object.assign(S,keep); S.resetAt=Date.now(); normalizeState(); saveNow(); render(); toast('Konuşkan ilerlemesi sıfırlandı'); }; };
}

/* ================= Panel ================= */
let panelCleanup=null;
function openPanel(title,extraHTML=''){
  closePanel(true);
  const p=$('#panel'); p.hidden=false; $('#pTitle').textContent=title; $('#pExtra').innerHTML=extraHTML; $('#pClose').innerHTML=ic('close');
  const b=$('#pBody'); b.innerHTML=''; b.style.padding=''; b.scrollTop=0; lastAct=Date.now(); return b;
}
function closePanel(silent){ if(panelCleanup){ try{panelCleanup();}catch(e){} panelCleanup=null; } stopSpeak(); if(micLive&&dict) dict.stop().catch(()=>{}); micTarget=null; $('#panel').hidden=true; saveNow(); if(!silent) render(); }
$('#pClose').onclick=()=>closePanel();
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('#panel').hidden) closePanel(); });

function openMode(id){
  switch(id){
    case 'chat': return startChat({kind:'chat',title:'Sohbet',name:'Deniz',color:'#0f7b6c',persona:'Deniz, a warm and encouraging English teacher who chats about the learner\'s daily life'+(S.goal?` and their goal (${S.goal})`:'')});
    case 'roleplay': return pickList('Rol yapma','Bir senaryo seç. Her senaryoda tamamlanacak görevler var.',ROLEPLAYS.map(r=>({t:r.t,s:r.tasks.join(' · '),icon:'role',go:()=>startRoleplay(r)})));
    case 'characters': return pickList('Karakterler','Klasik romanların kahramanlarından biriyle konuş.',CHARACTERS.map(c=>({t:c.t,s:c.sub,icon:'mask',go:()=>startCharacter(c)})));
    case 'debate': return pickList('Münazara','Bir konu seç, sonra tarafını belirle. Yapay zekâ karşı tarafı savunur.',DEBATES.map(d=>({t:d,s:'',icon:'debate',go:()=>startDebatePick(d)})),startDebatePick);
    case 'call': return startCall();
    case 'word': return startWordPicker();
    case 'sentence': return startSentencePicker();
    case 'dialogue': return pickList('Diyalog modu','Bir konu seç. Yapay zekâ seviyene göre bir diyalog yazar, B rolünü sen oynarsın.',DIALOGUE_TOPICS.map(d=>({t:d,s:'',icon:'dialogue',go:()=>startDialogue(d)})),startDialogue);
    case 'flash': return startFlash();
    case 'podcast': return pickList('Hikâyeler','Bir konu seç ya da kendin yaz. Hikâye seviyene göre yazılır.',STORY_TOPICS.map(d=>({t:d,s:'',icon:'pod',go:()=>startStory(d)})),startStory);
    case 'photo': return startPhoto();
    case 'errors': return startErrors();
    case 'feedback': return startFeedback();
  }
}
function pickList(title,desc,items,customGo){
  const b=openPanel(title);
  b.innerHTML=`<div class="inner"><p class="muted" style="margin:0">${desc}</p>${customGo?`<form class="row" id="cf"><input id="cfi" style="flex:1;border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:10px 14px" placeholder="Kendi konunu yaz (İngilizce)" aria-label="Kendi konun"><button class="btn primary">Başla</button></form>`:''}<div class="list" id="pl"></div></div>`;
  const pl=$('#pl',b);
  items.forEach(it=>{ const x=document.createElement('button'); x.className='item'; x.innerHTML=`<span class="dot">${ic(it.icon)}</span><div class="grow"><b>${esc(it.t)}</b>${it.s?`<div class="small muted">${esc(it.s)}</div>`:''}</div>${ic('arrow','width="18" height="18" style="color:var(--muted)"')}`; x.onclick=it.go; pl.appendChild(x); });
  if(customGo){ $('#cf',b).onsubmit=e=>{ e.preventDefault(); const v=$('#cfi',b).value.trim(); if(v) customGo(v); }; }
}

/* ================= Düzeltme yardımcıları ================= */
function tokens(s){ return s.split(/\s+/).filter(Boolean); }
function norm(s){ return String(s).toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ').trim(); }
function destutter(ws){ return ws.filter((w,k)=>!(w.length<=2&&w!=='a'&&w!=='i'&&ws[k+1]&&ws[k+1]!==w&&ws[k+1].startsWith(w))); }
function similarity(a,b){ const A=destutter(norm(a).split(' ').filter(Boolean)), B=norm(b).split(' ').filter(Boolean); if(!A.length||!B.length) return 0; const dp=Array(B.length+1).fill(0).map((_,j)=>j); for(let i=1;i<=A.length;i++){ let prev=dp[0]; dp[0]=i; for(let j=1;j<=B.length;j++){ const t=dp[j]; dp[j]=Math.min(dp[j]+1,dp[j-1]+1,prev+(A[i-1]===B[j-1]?0:1)); prev=t; } } return Math.max(0,Math.round((1-dp[B.length]/Math.max(A.length,B.length))*100)); }
function wordDiff(user,target){
  const A=destutter(norm(user).split(' ').filter(Boolean)), B=norm(target).split(' ').filter(Boolean);
  const L=Array(A.length+1).fill(0).map(()=>Array(B.length+1).fill(0));
  for(let i=A.length-1;i>=0;i--) for(let j=B.length-1;j>=0;j--) L[i][j]=A[i]===B[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
  const out=[]; let i=0,j=0;
  while(i<A.length&&j<B.length){ if(A[i]===B[j]){ out.push(['=',A[i]]); i++; j++; } else if(L[i+1][j]>=L[i][j+1]){ out.push(['+',A[i]]); i++; } else { out.push(['-',B[j]]); j++; } }
  while(i<A.length) out.push(['+',A[i++]]); while(j<B.length) out.push(['-',B[j++]]);
  return out;
}
/* Yalnızca noktalama, büyük harf ya da özel isim farkı varsa düzeltme sayılmaz. */
function rawToks(s){ return String(s).replace(/[^\p{L}\p{N}'’ -]/gu,' ').replace(/[’]/g,"'").split(/\s+/).map(w=>w.replace(/^-+|-+$/g,'')).filter(Boolean); }
function trivialDiff(a,b){
  const A=destutter(rawToks(a)), B=rawToks(b); const al=A.map(w=>w.toLowerCase()), bl=B.map(w=>w.toLowerCase());
  if(al.join(' ')===bl.join(' ')) return true;
  const L=Array(al.length+1).fill(0).map(()=>Array(bl.length+1).fill(0));
  for(let i=al.length-1;i>=0;i--) for(let j=bl.length-1;j>=0;j--) L[i][j]=al[i]===bl[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
  const ca=[],cb=[]; let i=0,j=0;
  while(i<al.length&&j<bl.length){ if(al[i]===bl[j]){i++;j++;} else if(L[i+1][j]>=L[i][j+1]) ca.push(A[i++]); else cb.push(B[j++]); }
  while(i<al.length) ca.push(A[i++]); while(j<bl.length) cb.push(B[j++]);
  const proper=w=>/^\p{Lu}/u.test(w)&&w!=='I';
  return ca.length===cb.length&&ca.length<=2&&ca.every(proper)&&cb.every(proper);
}
function diffHTML(user,fixed){
  return wordDiff(user,fixed).map(([t,w])=>t==='='?`<span>${esc(w)}</span>`:t==='-'?`<span title="Eklenmeli" style="background:var(--ok-soft);color:var(--ok);padding:1px 5px;border-radius:5px;font-weight:700">+${esc(w)}</span>`:`<span title="Çıkarılmalı ya da değişmeli" style="background:var(--bad-soft);color:var(--bad);padding:1px 5px;border-radius:5px;text-decoration:line-through">${esc(w)}</span>`).join(' ');
}
/* Puan açıklaması: kelime kelime fark + yapay zekâ yorumu */
function scoreButton(user,target,score,extra){
  const wrap=document.createElement('div'); wrap.className='stack'; wrap.style.gap='8px';
  const btn=document.createElement('button'); btn.type='button'; btn.className='pill '+(score>=80?'ok':'warn'); btn.style.border='none'; btn.style.cursor='pointer'; btn.style.alignSelf='inherit';
  btn.innerHTML=`${score}/100 · Neden?`; btn.setAttribute('aria-expanded','false');
  const box=document.createElement('div'); box.className='card stack small hide'; box.style.gap='8px'; box.style.textAlign='left';
  let loaded=false;
  btn.onclick=async()=>{
    const open=box.classList.toggle('hide')===false; btn.setAttribute('aria-expanded',String(open));
    if(!open||loaded) return; loaded=true;
    const d=wordDiff(user,target); const miss=d.filter(x=>x[0]==='-').map(x=>x[1]), add=d.filter(x=>x[0]==='+').map(x=>x[1]);
    box.innerHTML=`<div><b>Puan nasıl hesaplandı?</b> Cevabın metindeki cümleyle kelime kelime karşılaştırıldı. 100 = metindekiyle birebir aynı. Puan doğruluğu değil, metne ne kadar yakın olduğunu ölçer.</div>
      <div style="line-height:2">${diffHTML(user,target)}</div>
      <div class="muted">${miss.length?`Eksik kelimeler (yeşil): <b>${miss.map(esc).join(', ')}</b>. `:''}${add.length?`Metinde olmayan kelimeler (kırmızı): <b>${add.map(esc).join(', ')}</b>.`:''}${!miss.length&&!add.length?'Kelimeler metindekiyle aynı.':''}</div>
      <div class="aiw"></div>`;
    const aiw=$('.aiw',box);
    if(aiOff()) return;
    aiw.innerHTML='<span class="typing"><i></i><i></i><i></i></span>';
    try{ const r=await ai(`A Turkish learner of English (CEFR ${S.level}) had to say this line${extra?' ('+extra+')':''}: "${target}". They said: "${user}" (it may come from speech recognition, so ignore punctuation, capitalisation and stutters like "s-"). Their closeness score was ${score}/100. Explain in informal Turkish (sen), in max 4 short sentences: is their sentence still correct and natural English even if it differs from the script; what exactly is wrong or missing (grammar, missing words like prepositions); and give the best correct version of THEIR sentence. Return ONLY JSON: {"acceptable":true,"explain_tr":"...","better":"..."}`,{deep:true});
      aiw.innerHTML=`<div class="answer ${r.acceptable?'ok':'bad'} stack" style="gap:6px"><b>${r.acceptable?'Cümlen yine de doğru ve anlaşılır.':'Cümlende düzeltilmesi gereken bir şey var.'}</b><span>${esc(r.explain_tr)}</span>${r.better?`<span>Daha iyi hali: <b>${esc(r.better)}</b> <button class="icon-btn" style="width:26px;height:26px;vertical-align:middle" aria-label="Dinle">${ic('speaker')}</button></span>`:''}</div>`;
      const sp=$('.icon-btn',aiw); if(sp) sp.onclick=()=>speak(r.better);
      if(!r.acceptable&&r.better&&!trivialDiff(user,r.better)) addError({wrong:user,right:r.better,why:r.explain_tr,tag:'speaking',mode:'dialogue',d:today()});
    }catch(e){ aiw.textContent=aiErr(e); loaded=false; }
  };
  wrap.append(btn,box); return wrap;
}

/* ================= Sohbet motoru ================= */
function startRoleplay(r,extra){ startChat({kind:'roleplay',title:'Rol yapma · '+r.t,name:r.t,color:'#c4733a',persona:r.r,tasks:r.tasks,scene:r.t,...(extra||{})}); }
function startCharacter(c){ startChat({kind:'characters',title:'Karakter · '+c.t,name:c.t,color:c.c,persona:c.r+' Stay in character, but keep your English at the learner\'s level.'}); }
function startDebatePick(topic){
  const b=openPanel('Münazara');
  b.innerHTML=`<div class="inner"><span class="eyebrow">Konu</span><h2>${esc(topic)}</h2><p class="muted">Hangi tarafı savunacaksın? Yapay zekâ karşı tarafı savunur. 6 tur sonra puanını alırsın.</p><div class="row"><button class="btn primary" id="dFor">Lehinde (for)</button><button class="btn" id="dAg">Aleyhinde (against)</button></div></div>`;
  const go=side=>startChat({kind:'debate',title:'Münazara',name:'Rakip',color:'#3b5b88',topic,side,maxTurns:6,
    persona:`a skilled but friendly debate opponent. The motion is: "${topic}". The learner argues ${side.toUpperCase()} the motion; you argue ${side==='for'?'AGAINST':'FOR'} it. Give one clear counter-argument per turn and challenge the learner's last point with a question`});
  $('#dFor',b).onclick=()=>go('for'); $('#dAg',b).onclick=()=>go('against');
}

function startChat(cfg){
  const st={cfg,hist:[],done:new Set(),turns:0,busy:false,sel:null,run:0,sessionXP:0,errs:[]};
  const b=openPanel(cfg.title,`<button class="btn sm" id="endBtn">Bitir</button>`);
  b.style.padding='12px';
  b.innerHTML=`<div class="chat" style="height:100%">
    <div class="chat-main">
      <div class="chat-top"><div class="ava" style="background:${cfg.color}">${esc(cfg.name[0])}</div><div class="grow" style="flex:1;min-width:140px"><b>${esc(cfg.name)}</b><div class="small muted">${cfg.kind==='debate'?`Sen: ${cfg.side==='for'?'lehinde':'aleyhinde'} · ${esc(cfg.topic)}`:(cfg.level||S.level)+' seviyesine göre konuşuyor'}</div></div>
        <select id="tierQ" class="small" aria-label="Model" title="Yapay zekâ modeli" style="border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:4px 8px">${TIERS.map(([v,t])=>`<option value="${v}" ${S.tierChat===v?'selected':''}>${t}</option>`).join('')}</select>
        <label class="small row" style="gap:6px"><input type="checkbox" id="autoSpeak" ${cfg.voiceFirst?'checked':''}> Sesli oku</label></div>
      <div class="msgs" id="msgs" aria-live="polite"></div>
      <div class="chips"><button class="btn sm" id="anotherQ">Başka soru</button><button class="btn sm" id="suggest">Cevap öner</button><span id="sugg" class="small muted"></span></div>
      <form class="compose" id="cmp"><textarea id="inp" rows="1" placeholder="İngilizce yaz ya da mikrofona bas…" aria-label="Mesaj"></textarea><span id="micSlot"></span><button class="mic" style="background:var(--accent);color:var(--accent-ink)" aria-label="Gönder">${ic('send')}</button></form>
    </div>
    <aside class="side-fb" id="fb"></aside>
  </div>`;
  const msgs=$('#msgs',b), inp=$('#inp',b), fb=$('#fb',b);
  if(aiOff()){ msgs.innerHTML=`<div class="notice">${aiErr({code:'no_ai'})}</div>`; }
  const mic=micButton({partial:t=>{ inp.value=(inp._base||'')+t; }, final:t=>{ inp._spoken=true; inp._base=((inp._base||'')+t+' ').replace(/\s+/g,' '); inp.value=inp._base; }, idle:()=>{ if(inp.value.trim()&&cfg.voiceFirst) send(); }});
  $('#micSlot',b).replaceWith(mic);
  renderFbIntro();
  function renderFbIntro(){
    fb.innerHTML=`<h3>Mesaj geri bildirimi</h3><div class="small muted stack" style="gap:6px">
      <div class="row"><span class="chk ok">${ic('check')}</span> Mesajında hata yok</div>
      <div class="row"><span class="chk bad">${ic('alert')}</span> Mesajında hata var, tıkla</div>
      <div class="row"><span class="icon-btn" style="width:24px;height:24px">${ic('translate')}</span> Türkçesini göster</div>
      <div class="row"><span class="icon-btn" style="width:24px;height:24px">${ic('speaker')}</span> Sesli dinle</div></div>
      ${cfg.tasks?`<h3>Görevler</h3><div class="tasks" id="tasks"></div>`:''}
      ${cfg.kind==='debate'?`<h3>Tur</h3><div class="bar"><i id="turnBar" style="width:0"></i></div><span class="small muted" id="turnTxt">0 / ${cfg.maxTurns}</span>`:''}
      <div class="small muted" id="sessInfo"></div>`;
    drawTasks();
  }
  function drawTasks(){ const t=$('#tasks',fb); if(t) t.innerHTML=cfg.tasks.map((x,i)=>`<div class="task ${st.done.has(i+1)?'done':''}"><i></i><span>${esc(x)}</span></div>`).join(''); const tb=$('#turnBar',fb); if(tb){ tb.style.width=Math.min(100,st.turns/cfg.maxTurns*100)+'%'; $('#turnTxt',fb).textContent=st.turns+' / '+cfg.maxTurns; } const si=$('#sessInfo',fb); if(si) si.textContent=st.sessionXP?`Bu oturumda ${st.sessionXP} XP kazandın.`:''; }
  function bubble(m){
    const row=document.createElement('div'); row.className='msg '+(m.role==='user'?'me':'ai');
    if(m.role==='user'){
      const chk=document.createElement('button'); chk.type='button'; chk.className='chk wait'; chk.innerHTML='<span class="typing" style="transform:scale(.6)"><i></i><i></i><i></i></span>'; chk.setAttribute('aria-label','Geri bildirimi göster');
      row.innerHTML=`<div class="bub">${esc(m.text)}</div>`; row.prepend(chk); m._chk=chk;
      chk.onclick=()=>showFb(m);
    } else {
      row.innerHTML=`<div class="bub">${esc(m.text)}${m.tr?`<span class="tr ${S.showTr?'':'hide'}">${esc(m.tr)}</span>`:''}</div><div class="tools"><button class="icon-btn" data-a="sp" aria-label="Dinle">${ic('speaker')}</button>${m.tr?`<button class="icon-btn" data-a="tr" aria-label="Çeviri">${ic('translate')}</button>`:''}</div>`;
      $('[data-a=sp]',row).onclick=()=>speak(m.text);
      const tb=$('[data-a=tr]',row); if(tb) tb.onclick=()=>$('.tr',row).classList.toggle('hide');
    }
    msgs.appendChild(row); msgs.scrollTop=msgs.scrollHeight; return row;
  }
  function setChk(m){ const c=m._chk; if(!c) return; if(!m.check){ c.className='chk wait'; c.innerHTML='?'; return; } c.className='chk '+(m.check.ok?'ok':'bad'); c.innerHTML=ic(m.check.ok?'check':'alert'); }
  function showFb(m){
    if(!m.check) return;
    st.sel=m; fb.classList.add('show');
    fb.innerHTML=`<div class="row between"><h3>Geri bildirim</h3><button class="icon-btn" id="fbX" aria-label="Kapat">${ic('close')}</button></div>
      ${m.check.ok?`<div class="fb-fix">${esc(m.text)}</div><p class="small" style="margin:0">Harika, bu mesajda hata yok.</p>`:
      `<div class="small muted">Değişen kelimeler</div><div style="line-height:2">${diffHTML(m.text,m.check.corrected)}</div><div class="fb-fix">${esc(m.check.corrected)}</div><p style="margin:0">${esc(m.check.why_tr)}</p>${m.check.tag?`<span class="pill warn" style="align-self:flex-start">${esc(m.check.tag)}</span>`:''}`}
      <div class="row"><button class="btn sm" id="fbSay">${ic('speaker','width="15" height="15"')} Doğrusunu dinle</button>${m.check.ok?'':`<button class="btn sm" id="fbAdv">Detaylı açıklama</button><button class="btn sm ghost" id="fbNo">Bu düzeltme yanlış</button>`}</div><div id="fbAdvOut" class="small"></div>`;
    $('#fbX',fb).onclick=()=>{ fb.classList.remove('show'); renderFbIntro(); };
    const no=$('#fbNo',fb); if(no) no.onclick=()=>{ removeError(m._err); const k2=st.errs.indexOf(m._err); if(k2>=0) st.errs.splice(k2,1); m.check={ok:true}; m._err=null; S.stats.ok++; addXP(5); setChk(m); toast('Düzeltme kaldırıldı, hata defterinden de silindi'); showFb(m); };
    $('#fbSay',fb).onclick=()=>speak(m.check.ok?m.text:m.check.corrected);
    const adv=$('#fbAdv',fb); if(adv) adv.onclick=async()=>{ adv.disabled=true; $('#fbAdvOut',fb).innerHTML='<span class="typing"><i></i><i></i><i></i></span>';
      try{ const out=await ai(`A Turkish learner of English (level ${S.level}) wrote: "${m.text}". Correct version: "${m.check.corrected}". Explain in informal Turkish (sen), clearly and briefly (max 6 short sentences): what the rule is, why their version is wrong, and give 2 new English example sentences with Turkish translations. Ignore punctuation and capitalisation. Plain text, no markdown headings.`,{json:false,deep:true});
        $('#fbAdvOut',fb).innerHTML=`<div class="card" style="white-space:pre-wrap">${esc(out)}</div>`; }catch(e){ $('#fbAdvOut',fb).textContent=aiErr(e); adv.disabled=false; } };
  }
  function transcript(n=14){ return st.hist.slice(-n).map(h=>(h.role==='user'?'Learner: ':'You: ')+h.text).join('\n'); }
  function sysPrompt(){
    const LV=cfg.level||S.level;
    let s=`You are ${cfg.persona}. You are talking with a Turkish native speaker who is learning English at CEFR level ${LV}. ${LEVEL_GUIDE[LV]}
Rules: answer in English only, 1-3 short sentences, natural and friendly, end with one follow-up question that keeps the conversation going. No emojis. Never break role. Do not correct the learner inside your reply (corrections are shown separately).`;
    if(cfg.tasks) s+=`\nScene: ${cfg.scene}. Over the whole conversation the learner should complete these tasks: ${cfg.tasks.map((t,i)=>(i+1)+') '+t).join(' ')}. Create natural chances for them; never list them.`;
    if(cfg.material) s+=`\nToday's material (make the learner PRODUCE these patterns in a natural situation, never ask them to repeat):\n${cfg.material}`;
    if(cfg.focus) s+=`\nFocus drill: build the session around these real mistakes of the learner, one by one; make them produce the correct form: ${cfg.focus}`;
    return s+learnerContext();
  }
  async function opener(){
    if(aiOff()) return;
    const typing=bubbleTyping();
    try{
      const r=await ai(sysPrompt()+`\n\nStart the conversation now with a short greeting and an opening question${cfg.kind==='debate'?' that states your side in one sentence':''}. Return ONLY JSON: {"reply":"...","reply_tr":"Turkish translation"}`);
      typing.remove(); addAI(r.reply,r.reply_tr);
    }catch(e){ typing.remove(); msgs.insertAdjacentHTML('beforeend',`<div class="notice small">${esc(aiErr(e))}</div>`); }
  }
  function bubbleTyping(){ const r=document.createElement('div'); r.className='msg ai'; r.innerHTML='<div class="bub"><span class="typing"><i></i><i></i><i></i></span></div>'; msgs.appendChild(r); msgs.scrollTop=msgs.scrollHeight; return r; }
  function addAI(text,tr){ if(!text) return; const m={role:'assistant',text,tr}; st.hist.push(m); bubble(m); if($('#autoSpeak',b).checked) speak(text); }
  async function send(extraInstr){
    const text=inp.value.trim(); if((!text&&!extraInstr)||st.busy) return;
    if(aiOff()){ toast(aiErr({code:'no_ai'})); return; }
    const spoken=!!inp._spoken; st.busy=true; inp.value=''; inp._base=''; inp._spoken=false; $('#sugg',b).textContent='';
    let um=null;
    if(text){ um={role:'user',text,spoken}; st.hist.push(um); bubble(um); st.turns++; drawTasks(); }
    const typing=bubbleTyping();
    try{
      const q=sysPrompt()+`\n\nConversation so far:\n${transcript()}\n\n`+
        (text?`Do two things.\n1) Check the learner's LAST message. Flag ONLY real English language errors: wrong grammar (tense, articles, prepositions, word order, agreement), wrong word choice, or clearly unnatural phrasing. NEVER flag any of these, and never mention them: punctuation of any kind (extra, missing or misplaced periods and commas), capitalisation, the spelling of names or proper nouns (including your own name), contractions, British vs American spelling, filler words.${spoken?' This message was dictated with speech recognition, so also ignore stray periods, stutters, repeated words and misheard names.':''} If the only differences would be of those kinds, ok=true and corrected must be empty. Keep the learner's wording in "corrected"; change only what is wrong. Write why_tr in informal Turkish (sen), naming the exact rule.\n2) Write your next reply.${extraInstr?' '+extraInstr:''}${cfg.tasks?' Also list the numbers of tasks the learner has GENUINELY completed so far in "tasks_done".':''}\nReturn ONLY JSON: {"check":{"ok":true,"corrected":"full corrected version of the learner's message, empty if ok","why_tr":"1-2 short Turkish sentences explaining the main mistake, empty if ok","tag":"short English error category, empty if ok"},"reply":"...","reply_tr":"Turkish translation of reply","tasks_done":[]}`
        :`${extraInstr} Return ONLY JSON: {"reply":"...","reply_tr":"Turkish translation"}`);
      const r=await ai(q);
      typing.remove();
      if(um){ um.check=r.check||{ok:true}; if(!um.check.ok&&(!um.check.corrected||trivialDiff(um.text,um.check.corrected))) um.check={ok:true}; setChk(um); recordCheck(um); }
      (r.tasks_done||[]).forEach(n=>st.done.add(+n));
      drawTasks();
      addAI(r.reply,r.reply_tr);
      if(cfg.tasks&&st.done.size>=cfg.tasks.length&&!st.tasksMsg){ st.tasksMsg=true; toast('Tüm görevleri tamamladın!'); }
      if(cfg.kind==='debate'&&st.turns>=cfg.maxTurns){ finish(); }
    }catch(e){ typing.remove(); if(um){ um.check=null; setChk(um);} msgs.insertAdjacentHTML('beforeend',`<div class="notice small">${esc(aiErr(e))}</div>`); }
    st.busy=false;
  }
  function recordCheck(m){
    S.stats.msgs++;
    if(m.check.ok){ S.stats.ok++; st.run++; S.stats.run=st.run; S.stats.bestRun=Math.max(S.stats.bestRun,st.run); st.sessionXP+=10; addXP(10); }
    else { st.run=0; st.sessionXP+=5; addXP(5); const e=addError({wrong:m.text,right:m.check.corrected,why:m.check.why_tr,tag:m.check.tag||'',mode:cfg.kind,d:today()}); m._err=e; st.errs.push(e); }
  }
  async function finish(){
    if(st.finished) return; st.finished=true;
    const userMsgs=st.hist.filter(h=>h.role==='user');
    if(!userMsgs.length){ closePanel(); return; }
    markDone(cfg.kind); if(cfg.onDone) cfg.onDone();
    fb.classList.add('show');
    const okN=userMsgs.filter(m=>m.check&&m.check.ok).length;
    fb.innerHTML=`<h3>Oturum özeti</h3><div class="tiles" style="grid-template-columns:1fr 1fr"><div class="stat"><span class="small muted">Mesaj</span><b>${userMsgs.length}</b></div><div class="stat"><span class="small muted">Hatasız</span><b>${okN}</b></div></div>
      ${cfg.tasks?`<p class="small" style="margin:0">Görevler: ${st.done.size} / ${cfg.tasks.length}</p>`:''}
      <div id="verdict"></div>
      ${st.errs.length?`<h3>Düzeltmeler</h3>${st.errs.map(e=>`<div class="small"><div style="line-height:2">${diffHTML(e.wrong,e.right)}</div><div class="fb-fix" style="margin-top:4px">${esc(e.right)}</div></div>`).join('')}`:'<p class="small">Bu oturumda hata yapmadın.</p>'}
      <p class="small muted">+${st.sessionXP} XP</p><button class="btn primary" id="closeS">Kapat</button>`;
    $('#closeS',fb).onclick=()=>closePanel();
    if(cfg.kind==='debate'&&!aiOff()){
      $('#verdict',fb).innerHTML='<span class="typing"><i></i><i></i><i></i></span>';
      try{ const v=await ai(`You judged a short English debate practice. Motion: "${cfg.topic}". Learner argued ${cfg.side}. Learner level ${S.level}.\nTranscript:\n${transcript(30)}\nScore the learner from 1 to 10 for argument quality and English. Return ONLY JSON: {"score":7,"strengths_tr":"1-2 Turkish sentences","improve_tr":"1-2 Turkish sentences","useful_phrases":["3 English debate phrases they could use next time"]}`,{deep:true});
        $('#verdict',fb).innerHTML=`<div class="card stack"><div class="row between"><b>Münazara puanı</b><span class="big" style="font-size:1.6rem">${esc(v.score)}/10</span></div><p class="small" style="margin:0"><b>Güçlü yanın:</b> ${esc(v.strengths_tr)}</p><p class="small" style="margin:0"><b>Geliştir:</b> ${esc(v.improve_tr)}</p><div class="small">${(v.useful_phrases||[]).map(p=>`<div>• ${esc(p)}</div>`).join('')}</div></div>`;
      }catch(e){ $('#verdict',fb).textContent=aiErr(e); }
    }
  }
  $('#tierQ',b).onchange=e=>{ S.tierChat=e.target.value; touchSettings(); toast('Model: '+TIERS.find(t=>t[0]===S.tierChat)[1]); };
  $('#cmp',b).onsubmit=e=>{ e.preventDefault(); send(); };
  inp.onkeydown=e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } };
  inp.oninput=()=>{ inp._base=inp.value; inp.style.height='auto'; inp.style.height=Math.min(140,inp.scrollHeight)+'px'; };
  $('#anotherQ',b).onclick=()=>{ if(!st.busy) send('The learner wants a different question: ask a new, different question on a related topic.'); };
  $('#suggest',b).onclick=async()=>{
    if(aiOff()||st.busy) return; const s=$('#sugg',b); s.innerHTML='<span class="typing"><i></i><i></i><i></i></span>';
    try{ const r=await ai(sysPrompt()+`\n\nConversation so far:\n${transcript()}\n\nSuggest ONE natural answer the learner could give next, at level ${S.level}, max 18 words. Return ONLY JSON: {"suggestion":"...","tr":"Turkish"}`);
      s.innerHTML=''; const btn=document.createElement('button'); btn.className='btn sm'; btn.style.textAlign='left'; btn.innerHTML=`${esc(r.suggestion)} <span class="muted">· ${esc(r.tr)}</span>`; btn.onclick=()=>{ inp.value=r.suggestion; inp._base=r.suggestion; inp.focus(); s.innerHTML=''; }; s.appendChild(btn);
    }catch(e){ s.textContent=aiErr(e); }
  };
  $('#endBtn').onclick=()=>finish();
  panelCleanup=()=>{ if(!st.finished&&st.hist.some(h=>h.role==='user')){ markDone(cfg.kind); if(cfg.onDone) cfg.onDone(); } };
  opener();
  return st;
}

/* ================= Arama modu ================= */
function startCall(){
  const c={persona:'Deniz, a friendly English tutor on a phone call. Keep every reply to 1-2 short spoken sentences and end with a question.'};
  const st={hist:[],busy:false,errs:[],heard:''};
  const b=openPanel('Arama modu');
  b.innerHTML=`<div class="inner call"><div class="ring" id="ring">D</div><div><h2>Deniz</h2><p class="muted" id="cst" style="margin:4px 0 0">Aramayı başlatmak için düğmeye bas.</p></div>
    <div class="row" id="ctl"></div><p class="small muted" id="heard" style="min-height:1.5em"></p>
    <details style="width:100%;text-align:left"><summary class="small muted">Metni göster</summary><div class="list small" id="tx" style="margin-top:10px"></div></details>
    <div id="cerrs" style="width:100%;text-align:left"></div></div>`;
  const ring=$('#ring',b), cst=$('#cst',b), heard=$('#heard',b), ctl=$('#ctl',b);
  if(aiOff()){ cst.textContent=aiErr({code:'no_ai'}); return; }
  if(!dict){ cst.textContent='Arama modu mikrofon ister. Bu tarayıcıda ses tanıma yok; Chrome ya da Edge ile dene.'; }
  const startBtn=document.createElement('button'); startBtn.className='btn primary'; startBtn.innerHTML=ic('phone','width="18" height="18"')+' Aramayı başlat';
  ctl.appendChild(startBtn);
  const mic=micButton({partial:t=>{ heard.textContent=st.heard+t; }, final:t=>{ st.heard+=t+' '; heard.textContent=st.heard; }, idle:()=>{ const t=st.heard.trim(); st.heard=''; if(t) turn(t); }});
  mic.style.width='72px'; mic.style.height='72px';
  startBtn.onclick=async()=>{ startBtn.remove(); ctl.appendChild(mic); const hang=document.createElement('button'); hang.className='btn'; hang.textContent='Aramayı bitir'; hang.onclick=()=>endCall(); ctl.appendChild(hang); await turn(null); };
  function log(who,t){ $('#tx',b).insertAdjacentHTML('beforeend',`<div><b>${who}:</b> ${esc(t)}</div>`); }
  async function turn(text){
    if(st.busy) return; st.busy=true; cst.textContent='Deniz düşünüyor…';
    if(text){ st.hist.push({role:'user',text}); log('Sen',text); }
    try{
      const tr=st.hist.slice(-12).map(h=>(h.role==='user'?'Learner: ':'You: ')+h.text).join('\n');
      const r=await ai(`You are ${c.persona} The learner is a Turkish speaker at CEFR ${S.level}. ${LEVEL_GUIDE[S.level]} No emojis.${learnerContext()}\n\n${tr?'Call so far:\n'+tr+'\n\n':''}${text?'Check the learner\'s last line (it came from speech recognition: flag ONLY real grammar or word-choice errors; never flag punctuation, capitalisation, stutters, repeated words or misheard names). Then reply.':'Greet the learner and ask how their day is going.'} Return ONLY JSON: {"check":{"ok":true,"corrected":"","why_tr":"Turkish, informal"},"reply":"..."}`);
      if(text&&r.check){ S.stats.msgs++; if(r.check.ok||!r.check.corrected||trivialDiff(text,r.check.corrected)){ S.stats.ok++; addXP(10);} else { addXP(5); st.errs.push(addError({wrong:text,right:r.check.corrected,why:r.check.why_tr,tag:'',mode:'call',d:today()})); } }
      st.hist.push({role:'assistant',text:r.reply}); log('Deniz',r.reply);
      cst.textContent='Deniz konuşuyor…'; ring.classList.add('speaking');
      await speak(r.reply);
      ring.classList.remove('speaking'); cst.textContent=dict?'Senin sıran: mikrofona bas, konuş, bitince tekrar bas.':'Mikrofon yok.';
    }catch(e){ cst.textContent=aiErr(e); ring.classList.remove('speaking'); }
    st.busy=false;
  }
  function endCall(){ stopSpeak(); if(micLive&&dict) dict.stop().catch(()=>{}); ctl.innerHTML=''; cst.textContent='Arama bitti.'; markDone('call');
    $('#cerrs',b).innerHTML=st.errs.length?`<h3>Aramadaki düzeltmeler</h3>${st.errs.map(e=>`<div class="small" style="margin-top:8px"><div style="line-height:2">${diffHTML(e.wrong,e.right)}</div><div class="fb-fix" style="margin-top:4px">${esc(e.right)}</div><div class="muted">${esc(e.why)}</div></div>`).join('')}`:(st.hist.length>2?'<p>Bu aramada düzeltilecek bir şey çıkmadı.</p>':''); }
}

/* ================= Kelime modu ================= */
function levelDecks(L){ const w=DATA.words[L]||[]; const out=[]; for(let i=0;i<w.length;i+=12) out.push(w.slice(i,i+12)); return out; }
function startWordPicker(){
  const b=openPanel('Kelime modu');
  const draw=L=>{
    const decks=levelDecks(L);
    b.innerHTML=`<div class="inner"><p class="muted" style="margin:0">Her destede 12 kelime var: önce öğren, sonra anlamını seç, en son yaz. Kelimeler Dil Harita sözlüğünden.</p><div class="tabs" id="lt">${LEVELS.map(x=>`<button class="${x===L?'on':''}" data-l="${x}">${x}</button>`).join('')}</div><div class="grid" id="dk"></div></div>`;
    $('#lt',b).querySelectorAll('button').forEach(x=>x.onclick=()=>draw(x.dataset.l));
    const dk=$('#dk',b);
    decks.forEach((d,i)=>{ const learned=d.filter(w=>S.srs[w[0]]).length; const x=document.createElement('button'); x.className='item'; x.style.flexDirection='column'; x.style.alignItems='flex-start';
      x.innerHTML=`<div class="row between" style="width:100%"><b>Deste ${i+1}</b>${learned===d.length?'<span class="pill ok">Tamam</span>':learned?`<span class="pill acc">${learned}/${d.length}</span>`:''}</div><span class="small muted">${d.slice(0,4).map(w=>esc(w[0])).join(', ')}…</span>`;
      x.onclick=()=>runWords(d.map(w=>({w:w[0],o:w[1],tr:w[2]})),`${L} · Deste ${i+1}`,L); dk.appendChild(x); });
  };
  draw(S.level);
}
function runWords(words,title,L,onDone){
  const b=openPanel('Kelime modu · '+title);
  const pool=(DATA.words[L]||DATA.words[S.level]||[]).map(w=>w[2]).concat(words.map(w=>w.tr));
  let phase='learn', i=0, score=0; const quiz=shuffle(words), write=shuffle(words);
  const draw=()=>{
    if(phase==='learn'){
      const w=words[i];
      b.innerHTML=`<div class="inner"><div class="row between"><span class="eyebrow">Öğren · ${i+1}/${words.length}</span><div class="bar" style="width:160px"><i style="width:${(i)/words.length*100}%"></i></div></div>
        <div class="card flash"><span class="big">${esc(w.w)}</span>${w.o?`<span class="muted">Okunuşu: ${esc(w.o)}</span>`:''}<b style="font-size:1.2rem">${esc(w.tr)}</b>${w.ex?`<span class="small muted">${esc(w.ex)}</span>`:''}<button class="btn sm" id="sp">${ic('speaker','width="16" height="16"')} Dinle</button></div>
        <div class="row" style="justify-content:flex-end"><button class="btn primary" id="nx">${i<words.length-1?'Sonraki':'Teste geç'}</button></div></div>`;
      speak(w.w); $('#sp',b).onclick=()=>speak(w.w+'. '+(w.ex||''));
      $('#nx',b).onclick=()=>{ i++; if(i>=words.length){ phase='quiz'; i=0; } draw(); };
    } else if(phase==='quiz'){
      const w=quiz[i]; const wrong=shuffle([...new Set(pool.filter(x=>x!==w.tr))]).slice(0,3); const opts=shuffle([w.tr,...wrong]);
      b.innerHTML=`<div class="inner"><span class="eyebrow">Anlamını seç · ${i+1}/${quiz.length}</span><div class="card flash" style="min-height:140px"><span class="big">${esc(w.w)}</span></div><div class="opts">${opts.map(o=>`<button class="opt">${esc(o)}</button>`).join('')}</div></div>`;
      speak(w.w);
      b.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{ const ok=o.textContent===w.tr; if(ok) score++; b.querySelectorAll('.opt').forEach(x=>{ x.disabled=true; if(x.textContent===w.tr) x.classList.add('ok'); }); if(!ok) o.classList.add('bad'); setTimeout(()=>{ i++; if(i>=quiz.length){ phase='write'; i=0; } draw(); },ok?600:1400); });
    } else if(phase==='write'){
      const w=write[i];
      b.innerHTML=`<div class="inner"><span class="eyebrow">İngilizcesini yaz · ${i+1}/${write.length}</span><div class="card flash" style="min-height:140px"><b style="font-size:1.4rem">${esc(w.tr)}</b><span class="small muted">${w.w.length} harf · ${esc(w.w[0])}…</span></div><form class="row" id="wf"><input id="wi" autocomplete="off" autocapitalize="off" spellcheck="false" style="flex:1;border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:12px 16px;font-size:1.1rem" aria-label="Kelime"><button class="btn primary">Kontrol et</button></form><div id="wr"></div></div>`;
      const wi=$('#wi',b); wi.focus();
      $('#wf',b).onsubmit=e=>{ e.preventDefault(); if(wi.disabled) return; const ok=wi.value.trim().toLowerCase()===w.w.toLowerCase(); if(ok) score++;
        $('#wr',b).innerHTML=`<div class="answer ${ok?'ok':'bad'} row between"><span>${ok?'Doğru!':'Doğrusu:'} <b>${esc(w.w)}</b></span><button class="btn sm" id="wn" type="button">Devam</button></div>`; speak(w.w);
        const nx=()=>{ i++; if(i>=write.length) phase='end'; draw(); }; $('#wn',b).onclick=nx; $('#wn',b).focus(); wi.disabled=true; };
    } else {
      const total=words.length*2; words.forEach(w=>{ const k=w.w.toLowerCase(); if(!S.srs[k]) S.srs[k]={tr:w.tr,o:w.o||'',box:1,due:today()}; });
      addXP(words.length*3); markDone('word'); if(onDone) onDone();
      b.innerHTML=`<div class="inner" style="text-align:center;align-items:center"><span class="eyebrow">Deste bitti</span><h2>${score} / ${total} doğru</h2><p class="muted">${words.length} kelime kartlarına eklendi; tekrar zamanı gelince Kartlar modunda karşına çıkacak.</p><div class="row"><button class="btn" id="again">Tekrar çalış</button><button class="btn primary" id="cl">Kapat</button></div></div>`;
      $('#again',b).onclick=()=>runWords(words,title,L,onDone); $('#cl',b).onclick=()=>closePanel();
    }
  };
  draw();
}

/* ================= Cümle modu ================= */
function startSentencePicker(){
  const b=openPanel('Cümle modu');
  const draw=L=>{
    b.innerHTML=`<div class="inner"><p class="muted" style="margin:0">Türkçesi verilen cümleyi kelime parçalarından kur ya da sesli söyle. Cümleler Dil Harita müfredatından.</p><div class="tabs" id="lt">${LEVELS.map(x=>`<button class="${x===L?'on':''}" data-l="${x}">${x}</button>`).join('')}</div><div class="list" id="ul"></div></div>`;
    $('#lt',b).querySelectorAll('button').forEach(x=>x.onclick=()=>draw(x.dataset.l));
    (DATA.course[L]||[]).forEach((u,i)=>{ const x=document.createElement('button'); x.className='item'; x.innerHTML=`<span class="dot">${ic('sentence')}</span><div class="grow"><b>${esc(u.t)}</b><div class="small muted">${u.s.length} cümle</div></div>${ic('arrow','width="18" height="18" style="color:var(--muted)"')}`; x.onclick=()=>runSentences(u.s,u.t); $('#ul',b).appendChild(x); });
  };
  draw(S.level);
}
function runSentences(list,title,onDone){
  const b=openPanel('Cümle modu · '+title);
  let i=0, okN=0;
  const draw=()=>{
    if(i>=list.length){ addXP(okN*8); markDone('sentence'); if(onDone) onDone();
      b.innerHTML=`<div class="inner" style="text-align:center;align-items:center"><span class="eyebrow">Ünite bitti</span><h2>${okN} / ${list.length} cümle doğru</h2><div class="row"><button class="btn" id="ag">Tekrar</button><button class="btn primary" id="cl">Kapat</button></div></div>`;
      $('#ag',b).onclick=()=>runSentences(list,title,onDone); $('#cl',b).onclick=()=>closePanel(); return; }
    const s=list[i]; const toks=tokens(s.en); let chosen=[]; let bank=shuffle(toks.map((t,k)=>({t,k}))); let answered=false;
    b.innerHTML=`<div class="inner"><div class="row between"><span class="eyebrow">Cümle ${i+1}/${list.length}</span><div class="bar" style="width:160px"><i style="width:${i/list.length*100}%"></i></div></div>
      <div class="card stack"><span class="small muted">${esc(s.g)}</span><b style="font-size:1.3rem">${esc(s.tr)}</b></div>
      <div class="tile-row" id="ans" aria-label="Cevabın"></div><div class="tile-row" id="bank" style="border-style:solid;background:var(--surface-2)"></div>
      <div class="row between"><div class="row" id="vs"></div><div class="row"><button class="btn ghost" id="skip">Bilmiyorum</button><button class="btn primary" id="ck">Kontrol et</button></div></div><div id="res"></div></div>`;
    const ans=$('#ans',b), bk=$('#bank',b);
    const drawT=()=>{ ans.innerHTML=''; bk.innerHTML=''; chosen.forEach((o,k)=>{ const t=document.createElement('button'); t.className='tile'; t.textContent=o.t; t.onclick=()=>{ if(answered) return; chosen.splice(k,1); bank.push(o); drawT(); }; ans.appendChild(t); }); bank.forEach((o,k)=>{ const t=document.createElement('button'); t.className='tile'; t.textContent=o.t; t.onclick=()=>{ if(answered) return; bank.splice(k,1); chosen.push(o); drawT(); }; bk.appendChild(t); }); };
    drawT();
    const reveal=(ok,heardTxt,score)=>{
      answered=true; S.stats.sentAll++; if(ok){ okN++; S.stats.sentOk++; } else addError({wrong:heardTxt||chosen.map(o=>o.t).join(' ')||'—',right:s.en,why:s.x||'',tag:s.g||'',mode:'sentence',d:today()});
      save();
      $('#res',b).innerHTML=`<div class="answer ${ok?'ok':'bad'} stack" style="gap:6px"><div class="row between"><b>${ok?'Doğru!':'Doğru cevap:'}</b><span id="scSlot"></span></div><div style="font-size:1.1rem">${esc(s.en)} <span class="muted small">${esc(s.ipa)}</span></div>${s.m?`<div class="small"><b>Sık yapılan hata:</b> ${esc(s.m)}</div>`:''}${s.x?`<div class="small">${esc(s.x)}</div>`:''}<div class="row"><button class="btn sm" id="sp2">${ic('speaker','width="15" height="15"')} Dinle</button><button class="btn primary sm" id="nx">Sonraki</button></div></div>`;
      if(score!=null){ const sb=scoreButton(heardTxt,s.en,score,'Turkish: '+s.tr); sb.style.alignItems='flex-end'; $('#scSlot',b).replaceWith(sb); }
      speak(s.en); $('#sp2',b).onclick=()=>speak(s.en); $('#nx',b).onclick=()=>{ i++; draw(); }; $('#ck',b).disabled=true;
    };
    $('#ck',b).onclick=()=>{ if(answered||!chosen.length) return; reveal(norm(chosen.map(o=>o.t).join(' '))===norm(s.en)); };
    $('#skip',b).onclick=()=>{ if(!answered) reveal(false); };
    let heard='';
    const mic=micButton({partial:t=>{ $('#res',b).innerHTML=`<p class="muted">${esc(heard+t)}</p>`; }, final:t=>{ heard+=t+' '; }, idle:()=>{ if(answered||!heard.trim()) return; const sc=similarity(heard,s.en); S.stats.pron.push(sc); reveal(sc>=85,heard.trim(),sc); }});
    mic.style.width='42px'; mic.style.height='42px';
    $('#vs',b).append(mic); $('#vs',b).insertAdjacentHTML('beforeend','<span class="small muted">ya da sesli söyle</span>');
  };
  draw();
}

/* ================= Diyalog modu ================= */
async function startDialogue(topic,onDone){
  const b=openPanel('Diyalog · '+topic);
  if(aiOff()){ b.innerHTML=`<div class="inner"><div class="notice">${aiErr({code:'no_ai'})}</div></div>`; return; }
  b.innerHTML=`<div class="inner"><p class="muted">Diyalog hazırlanıyor…</p><span class="typing"><i></i><i></i><i></i></span></div>`;
  let d;
  try{ d=await ai(`Write a short, natural everyday English dialogue between A and B about: "${topic}". CEFR level ${S.level}. ${LEVEL_GUIDE[S.level]} 8 lines total, alternating A then B, starting with A. Return ONLY JSON: {"title":"...","lines":[{"who":"A","en":"...","tr":"Turkish translation"}]}`); }
  catch(e){ b.innerHTML=`<div class="inner"><div class="notice">${esc(aiErr(e))}</div></div>`; return; }
  const lines=(d.lines||[]).filter(l=>l&&l.en); let i=0; const scores=[];
  const box=document.createElement('div'); box.className='inner';
  b.innerHTML=''; b.appendChild(box);
  box.innerHTML=`<div><span class="eyebrow">Sen B rolündesin</span><h2>${esc(d.title||topic)}</h2></div><div class="list" id="dl"></div><div id="turn"></div>`;
  const dl=$('#dl',box), turnEl=$('#turn',box);
  const step=async()=>{
    if(i>=lines.length){ const avg=scores.length?Math.round(scores.reduce((a,c)=>a+c,0)/scores.length):0; addXP(20); markDone('dialogue'); if(onDone) onDone();
      turnEl.innerHTML=`<div class="card stack" style="text-align:center;align-items:center"><span class="eyebrow">Diyalog bitti</span><h2>Ortalama eşleşme: ${avg}/100</h2><button class="btn primary" id="cl">Kapat</button></div>`; $('#cl',turnEl).onclick=()=>closePanel(); return; }
    const l=lines[i];
    if(String(l.who).toUpperCase()==='A'){ dl.insertAdjacentHTML('beforeend',`<div class="msg ai"><div class="bub">${esc(l.en)}<span class="tr ${S.showTr?'':'hide'}">${esc(l.tr)}</span></div></div>`); turnEl.innerHTML=''; await speak(l.en); i++; step(); return; }
    let heard='';
    turnEl.innerHTML=`<div class="card stack"><span class="small muted">Senin sıran. Türkçesi:</span><b>${esc(l.tr)}</b><details><summary class="small muted">İngilizcesini göster</summary><p style="margin:6px 0 0">${esc(l.en)}</p></details><form class="row" id="df"><input id="di" placeholder="İngilizce yaz ya da söyle" style="flex:1;border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:10px 14px" aria-label="Cevabın"><span id="dm"></span><button class="btn primary">Gönder</button></form></div>`;
    const di=$('#di',turnEl);
    const mic=micButton({partial:t=>{ di.value=heard+t; }, final:t=>{ heard+=t+' '; di.value=heard; }, idle:()=>{}});
    $('#dm',turnEl).replaceWith(mic);
    $('#df',turnEl).onsubmit=e=>{ e.preventDefault(); const v=di.value.trim(); if(!v) return; const sc=similarity(v,l.en); scores.push(sc); S.stats.pron.push(sc); save();
      dl.insertAdjacentHTML('beforeend',`<div class="msg me"><div class="bub">${esc(v)}</div></div>`);
      const meta=document.createElement('div'); meta.className='small'; meta.style.cssText='align-self:flex-end;max-width:80%;display:flex;flex-direction:column;align-items:flex-end;gap:6px';
      if(sc<100) meta.innerHTML=`<div><span class="muted">Metindeki:</span> ${esc(l.en)}</div>`;
      const sb=scoreButton(v,l.en,sc,'Turkish meaning: '+l.tr); sb.style.alignItems='flex-end'; meta.prepend(sb); dl.appendChild(meta);
      i++; step(); };
  };
  step();
}

/* ================= Kartlar (aralıklı tekrar) ================= */
const BOX_DAYS=[0,1,3,7,16,35];
function dueCards(){ const t=today(); return Object.entries(S.srs).filter(([w,c])=>c.due<=t); }
function startFlash(){
  const b=openPanel('Kartlar');
  const due=shuffle(dueCards()).slice(0,30); let i=0, flipped=false;
  if(!due.length){ b.innerHTML=`<div class="inner"><div class="empty"><h3>Bugün tekrar edilecek kart yok</h3><p>Kelime modunda yeni bir deste öğren; kelimeler buraya otomatik eklenir. Şu an ${Object.keys(S.srs).length} kartın var.</p><button class="btn primary" id="gw">Kelime modunu aç</button></div></div>`; $('#gw',b).onclick=()=>startWordPicker(); return; }
  const draw=()=>{
    if(i>=due.length){ addXP(due.length*2); markDone('flash'); b.innerHTML=`<div class="inner" style="text-align:center;align-items:center"><h2>${due.length} kart tekrar edildi</h2><button class="btn primary" id="cl">Kapat</button></div>`; $('#cl',b).onclick=()=>closePanel(); return; }
    const [w,c]=due[i]; flipped=false;
    b.innerHTML=`<div class="inner"><div class="row between"><span class="eyebrow">Kart ${i+1}/${due.length}</span><span class="pill">Kutu ${c.box}</span></div><button class="card flash" id="fc" aria-label="Kartı çevir"><span class="big">${esc(w)}</span><span class="muted small" id="hint">Anlamını hatırla, sonra kartı çevir</span><div id="back" class="hide stack" style="align-items:center;gap:4px"><b style="font-size:1.3rem">${esc(c.tr)}</b>${c.o?`<span class="muted">Okunuşu: ${esc(c.o)}</span>`:''}</div></button>
      <div class="row hide" id="grade" style="justify-content:center"><button class="btn" data-g="0" style="color:var(--bad)">Bilemedim</button><button class="btn" data-g="1">Zorlandım</button><button class="btn primary" data-g="2">Kolaydı</button></div></div>`;
    speak(w);
    $('#fc',b).onclick=()=>{ if(flipped) return; flipped=true; $('#back',b).classList.remove('hide'); $('#hint',b).classList.add('hide'); $('#grade',b).classList.remove('hide'); };
    b.querySelectorAll('[data-g]').forEach(x=>x.onclick=()=>{ const g=+x.dataset.g; c.box=g===0?1:g===1?Math.max(1,c.box):Math.min(5,c.box+1); const d=new Date(); d.setDate(d.getDate()+(g===0?0:BOX_DAYS[c.box])); c.due=g===0?today():dayKey(d); c.at=Date.now(); if(g===0) due.push([w,c]); save(); i++; draw(); });
  };
  draw();
}

/* ================= Hikâyeler ================= */
async function startStory(topic){
  const b=openPanel('Hikâye');
  if(aiOff()){ b.innerHTML=`<div class="inner"><div class="notice">${aiErr({code:'no_ai'})}</div></div>`; return; }
  b.innerHTML=`<div class="inner"><p class="muted">"${esc(topic)}" hikâyesi ${S.level} seviyesine göre yazılıyor…</p><span class="typing"><i></i><i></i><i></i></span></div>`;
  let s;
  try{ s=await ai(`Write an original short story or explainer in English about: "${topic}" for a learner at CEFR ${S.level}. ${LEVEL_GUIDE[S.level]} 4 or 5 short paragraphs, 180-260 words total. Then 3 multiple-choice comprehension questions. Also pick 5 useful words from the text with Turkish meanings. Return ONLY JSON: {"title":"...","paragraphs":[{"en":"...","tr":"Turkish translation"}],"words":[{"w":"...","tr":"..."}],"questions":[{"q":"...","options":["a","b","c"],"answer":0}]}`); }
  catch(e){ b.innerHTML=`<div class="inner"><div class="notice">${esc(aiErr(e))}</div></div>`; return; }
  const ps=(s.paragraphs||[]).filter(p=>p&&p.en);
  b.innerHTML=`<div class="inner"><div class="row between"><div><span class="eyebrow">${S.level} · ~${Math.max(1,Math.round(ps.reduce((a,p)=>a+p.en.split(' ').length,0)/110))} dk</span><h2>${esc(s.title)}</h2></div><div class="row"><button class="btn primary" id="play">${ic('play','width="16" height="16"')} Dinle</button><button class="btn" id="stopb" aria-label="Durdur">${ic('stop','width="16" height="16"')}</button></div></div>
    <label class="small row"><input type="checkbox" id="trT"> Türkçesini göster</label>
    <div class="story card" id="story">${ps.map((p,k)=>`<p data-k="${k}">${esc(p.en)}<span class="tr hide" style="display:block;color:var(--muted);font-size:.92rem;margin-top:4px">${esc(p.tr)}</span></p>`).join('')}</div>
    <div class="card stack"><h3>Yeni kelimeler</h3><div class="row">${(s.words||[]).map(w=>`<button class="btn sm" data-w="${esc(w.w)}" data-t="${esc(w.tr)}">${esc(w.w)} <span class="muted">· ${esc(w.tr)}</span></button>`).join('')}</div><span class="small muted">Bir kelimeye tıklarsan kartlarına eklenir.</span></div>
    <div class="card stack" id="qs"><h3>Anladın mı?</h3></div></div>`;
  const story=$('#story',b);
  $('#trT',b).onchange=e=>story.querySelectorAll('.tr').forEach(t=>t.classList.toggle('hide',!e.target.checked));
  const hl=k=>story.querySelectorAll('p').forEach(p=>p.classList.toggle('cur',+p.dataset.k===k));
  let stopFlag=false;
  $('#play',b).onclick=async()=>{ stopFlag=false; for(let k=0;k<ps.length&&!stopFlag;k++){ hl(k); await speak(ps[k].en); } hl(-1); };
  $('#stopb',b).onclick=()=>{ stopFlag=true; stopSpeak(); hl(-1); };
  b.querySelectorAll('[data-w]').forEach(x=>x.onclick=()=>{ const w=x.dataset.w.toLowerCase(); if(!S.srs[w]){ S.srs[w]={tr:x.dataset.t,o:'',box:1,due:today()}; save(); } x.classList.add('primary'); toast(w+' kartlarına eklendi'); speak(w); });
  const qs=$('#qs',b); let answered=0, right=0; const qlist=(s.questions||[]).filter(q=>q&&q.options);
  qlist.forEach((q,qi)=>{ const d=document.createElement('div'); d.className='stack'; d.style.gap='6px'; d.innerHTML=`<b>${qi+1}. ${esc(q.q)}</b><div class="opts">${q.options.map((o,oi)=>`<button class="opt" data-o="${oi}">${esc(o)}</button>`).join('')}</div>`;
    d.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{ if(d._a) return; d._a=true; answered++; const ok=+o.dataset.o===+q.answer; if(ok) right++; o.classList.add(ok?'ok':'bad'); const corr=d.querySelectorAll('.opt')[+q.answer]; if(corr) corr.classList.add('ok');
      if(answered===qlist.length){ addXP(15+right*5); markDone('podcast'); qs.insertAdjacentHTML('beforeend',`<div class="answer ok">${right} / ${qlist.length} doğru · +${15+right*5} XP</div>`); } });
    qs.appendChild(d); });
}

/* ================= Fotoğraf modu (Gemini) ================= */
function startPhoto(){
  const b=openPanel('Fotoğraf modu');
  const hasG=geminiKeys().length>0;
  b.innerHTML=`<div class="inner"><p class="muted" style="margin:0">Bir fotoğraf seç ve İngilizce anlat. Gemini anlatımını puanlar, düzeltir ve fotoğrafta atladığın şeyleri söyler.</p>
    ${hasG?'':`<div class="notice">${aiErr({code:'no_gemini'})}</div>`}
    <label class="btn" style="align-self:flex-start">${ic('photo','width="18" height="18"')} Fotoğraf seç<input type="file" id="pf" accept="image/*" class="hide"></label>
    <img id="pv" class="photo-prev hide" alt="Seçtiğin fotoğraf">
    <form class="stack hide" id="pform"><label for="pt"><b>Fotoğrafta ne görüyorsun?</b></label><div class="row"><textarea id="pt" rows="3" style="flex:1;border:1px solid var(--line);background:var(--surface);border-radius:var(--r-sm);padding:10px 12px" placeholder="In this picture I can see…"></textarea><span id="pm"></span></div><button class="btn primary" style="align-self:flex-start">Geri bildirim al</button></form><div id="pres"></div></div>`;
  let blob=null; const pt=$('#pt',b);
  $('#pf',b).onchange=e=>{ const f=e.target.files[0]; if(!f) return; blob=f; const pv=$('#pv',b); pv.src=URL.createObjectURL(f); pv.classList.remove('hide'); $('#pform',b).classList.remove('hide'); };
  const mic=micButton({partial:t=>{ pt.value=(pt._b||'')+t; }, final:t=>{ pt._b=(pt._b||'')+t+' '; pt.value=pt._b; }, idle:()=>{}}); $('#pm',b).replaceWith(mic);
  pt.oninput=()=>pt._b=pt.value;
  $('#pform',b).onsubmit=async e=>{ e.preventDefault(); const txt=pt.value.trim(); if(!txt||!blob) return; const out=$('#pres',b); out.innerHTML='<span class="typing"><i></i><i></i><i></i></span>';
    try{ const r=await ai(`Look at the attached photo. A Turkish learner of English (CEFR ${S.level}) described it like this: "${txt}". Evaluate the description: accuracy against the photo and English quality. Ignore punctuation and capitalisation. Return ONLY JSON: {"score":7,"corrected":"their description with grammar fixed, keeping their ideas","feedback_tr":"2-3 Turkish sentences, informal (sen)","missed":["up to 4 English words/phrases for visible things they did not mention"],"model":"a model description of the photo at level ${S.level}, 3-4 sentences"}`,{images:[blob],deep:true});
      S.stats.msgs++; if(!r.corrected||trivialDiff(txt,r.corrected)){ S.stats.ok++; } else addError({wrong:txt,right:r.corrected,why:r.feedback_tr,tag:'photo',mode:'photo',d:today()});
      addXP(10+(+r.score||0)); markDone('photo');
      out.innerHTML=`<div class="card stack"><div class="row between"><h3>Puan</h3><span class="big" style="font-size:1.6rem">${esc(r.score)}/10</span></div><p style="margin:0">${esc(r.feedback_tr)}</p>${r.corrected&&!trivialDiff(txt,r.corrected)?`<div style="line-height:2">${diffHTML(txt,r.corrected)}</div>`:''}<div class="fb-fix">${esc(r.corrected||txt)}</div>${(r.missed||[]).length?`<div class="small"><b>Atladıkların:</b> ${r.missed.map(esc).join(', ')}</div>`:''}<details><summary><b>Örnek anlatım</b></summary><p>${esc(r.model)}</p><button class="btn sm" id="pms" type="button">${ic('speaker','width="15" height="15"')} Dinle</button></details></div>`;
      $('#pms',out).onclick=()=>speak(r.model);
    }catch(err){ out.innerHTML=`<div class="notice">${esc(aiErr(err))}</div>`; } };
}

/* ================= Hata defteri & günlük geri bildirim ================= */
function startErrors(){
  const b=openPanel('Konuşkan hata defteri');
  const errs=S.errors.slice().reverse();
  const tags={}; S.errors.forEach(e=>{ if(e.tag) tags[e.tag]=(tags[e.tag]||0)+1; });
  const top=Object.entries(tags).sort((a,b)=>b[1]-a[1]).slice(0,6);
  b.innerHTML=`<div class="inner"><div class="row between"><p class="muted" style="margin:0">${errs.length} kayıtlı hata. Sohbet, arama, cümle, diyalog ve fotoğraf modlarındaki düzeltmeler buraya düşer.</p>${errs.length?'<button class="btn primary" id="drill">Hatalarım üzerine çalış</button>':''}</div>
    ${top.length?`<div class="row">${top.map(([t,n])=>`<span class="pill warn">${esc(t)} · ${n}</span>`).join('')}</div>`:''}
    <div class="list" id="el"></div></div>`;
  const el=$('#el',b);
  if(!errs.length) el.innerHTML='<div class="empty">Henüz hata kaydı yok. Sohbet modunda konuşmaya başla.</div>';
  errs.slice(0,80).forEach(e=>{ const c=document.createElement('div'); c.className='card stack'; c.style.gap='6px'; c.style.padding='12px';
    c.innerHTML=`<div class="row between small muted"><span>${esc(e.d)} · ${esc(e.mode)}</span><span class="row">${e.tag?`<span class="pill">${esc(e.tag)}</span>`:''}<button class="btn sm ghost" data-del>Sil</button></span></div><div style="line-height:2">${diffHTML(e.wrong,e.right)}</div><div class="fb-fix">${esc(e.right)}</div>${e.why?`<div class="small">${esc(e.why)}</div>`:''}`;
    $('[data-del]',c).onclick=()=>{ removeError(e); c.remove(); toast('Hata defterinden silindi'); };
    el.appendChild(c); });
  const d=$('#drill',b); if(d) d.onclick=()=>{ const focus=S.errors.slice(-6).map((e,i)=>`${i+1}) wrong="${e.wrong}" correct="${e.right}"`).join(' '); startChat({kind:'chat',title:'Hatalarım üzerine çalışma',name:'Deniz',color:'#0f7b6c',persona:'Deniz, a patient English teacher running a short focused practice session',focus}); };
}
async function startFeedback(){
  const b=openPanel('Günlük geri bildirim');
  const t=today(); const errs=S.errors.filter(e=>e.d===t); const secs=S.days[t]||0;
  const show=txt=>{ b.innerHTML=`<div class="inner"><span class="eyebrow">${new Date().toLocaleDateString('tr-TR',{day:'numeric',month:'long'})}</span><div class="tiles"><div class="card stat"><span class="small muted">Bugünkü süre</span><b>${fmtDur(secs)}</b></div><div class="card stat"><span class="small muted">Bugünkü hata</span><b>${errs.length}</b></div></div><div class="card" style="white-space:pre-wrap">${esc(txt)}</div><button class="btn sm" id="rf" style="align-self:flex-start">Yeniden oluştur</button></div>`; $('#rf',b).onclick=()=>{ delete S.fb[t]; startFeedback(); }; };
  if(S.fb[t]&&S.fb[t].n===errs.length){ show(S.fb[t].txt); return; }
  if(!errs.length){ b.innerHTML=`<div class="inner"><div class="empty"><h3>Bugün henüz düzeltme yok</h3><p>Sohbet, arama ya da cümle modunda pratik yap; günün sonunda kişisel geri bildirimin burada olur.</p></div></div>`; return; }
  if(aiOff()){ show('Bugünkü hataların: \n'+errs.map(e=>`• ${e.wrong} → ${e.right}`).join('\n')); return; }
  b.innerHTML=`<div class="inner"><p class="muted">Bugünkü pratiğin değerlendiriliyor…</p><span class="typing"><i></i><i></i><i></i></span></div>`;
  try{ const txt=await ai(`You are a kind English coach for a Turkish learner (CEFR ${S.level}). Today they practised ${Math.round(secs/60)} minutes and made these corrections:\n${errs.slice(-25).map(e=>`- "${e.wrong}" -> "${e.right}" (${e.tag||''})`).join('\n')}\nWrite feedback in informal Turkish (sen), plain text, no markdown headings: 1) one encouraging sentence, 2) the 2-3 main error patterns with a short rule each and one correct English example, 3) one concrete task for tomorrow. Max 160 words.`,{json:false,deep:true});
    S.fb={[t]:{n:errs.length,txt}}; save(); show(txt); }
  catch(e){ b.innerHTML=`<div class="inner"><div class="notice">${esc(aiErr(e))}</div></div>`; }
}

/* ================= Dil Harita modülleri (salt okunur köprü) =================
   Kullanıcı modülleri (Modüllerim, DHModul) ve Dil Harita'nın hazır modül
   dosyaları (data/sentences/mod/*.json) aynı 23 alanlı cümle biçimini kullanır;
   Konuşkan onları KOPYALAMADAN okur ve hiçbir şeyi değiştirmez. */
function strHash(s){ let h=5381; for(const c of String(s)) h=((h<<5)+h+c.charCodeAt(0))|0; return (h>>>0).toString(36); }
function toSent(r){ return {en:String(r.en||''),tr:String(r.tr||''),ipa:String(r.ipa||''),g:String(r.grammar||r.pattern||''),m:String(r.commonMistake||''),x:String(r.aiExplain||''),sc:String(r.scenario||r.topic||'')}; }
let MOD_SERIES=[];   /* [{key,t,level,alan,parts:[{id,ad,n,part}]}] */
function seriesName(ad){ return String(ad||'Modül').replace(/\s*·\s*P\d+\s*$/,'').replace(/^【FULL】\|?/,'').replace(/[《》]/g,'').trim()||'Modül'; }
function loadUserModules(){
  try{
    if(!window.DHModul) { MOD_SERIES=[]; return; }
    const g={};
    (DHModul.liste()||[]).forEach(m=>{ const name=seriesName(m.ad); const key=strHash(name);
      const pm=String(m.ad||'').match(/·\s*P(\d+)\s*$/); const part=pm?+pm[1]:0;
      const s=(g[key]=g[key]||{key,t:name,level:String(m.level||'A2').toUpperCase(),alan:m.alan||'',parts:[],eksik:0,tarih:0});
      /* Dizinde olup cümleleri bu cihaza gelmemiş parça ünite yapılmaz. */
      let var_=false; try{ const r=DHModul.getir(m.id); var_=Array.isArray(r)&&r.length>0; }catch(e){}
      if(var_) s.parts.push({id:m.id,ad:m.ad,n:+m.n||0,part,tarih:+m.tarih||0}); else s.eksik++; });
    MOD_SERIES=Object.values(g).filter(s=>s.parts.length).map(s=>{ s.parts.sort((a,b)=>(a.part-b.part)||(a.tarih-b.tarih)); s.tarih=Math.max(...s.parts.map(p=>p.tarih||0)); if(!LEVELS.includes(s.level)) s.level=s.level==='C2'?'C1':'A2'; return s; }).sort((a,b)=>b.tarih-a.tarih);
  }catch(e){ MOD_SERIES=[]; }
}
function moduleSentences(id){ try{ const arr=window.DHModul&&DHModul.getir(id); return Array.isArray(arr)?arr.filter(r=>r&&r.en&&r.tr).map(toSent):[]; }catch(e){ return []; } }
/* Hazır modül dosyaları: seviye kursundaki ünite adı → parça dosyaları */
let MOD_INDEX=null;
function unitNameOf(mod){ let n=String(mod).split(' · ')[0].replace(/^[A-C]\d-M\d+\s*/,'').trim(); if(n.startsWith('-')) n='Real life: '+n.slice(1); return n; }
async function levelUnitParts(L,unitT){
  if(!MOD_INDEX){ const r=await fetch('./data/sentences/index.json?v=1'); if(!r.ok) throw {code:'http',message:'Modül listesi yüklenemedi'}; MOD_INDEX=(await r.json()).modules||[]; }
  return MOD_INDEX.filter(m=>m.lvl===L&&unitNameOf(m.mod)===unitT).map(m=>({f:m.f,n:+m.n||0,label:(String(m.mod).split(' · ')[1]||'Parça').replace(/^P(\d+)$/,'Parça $1')}));
}
async function levelPartSentences(f){ const r=await fetch('./data/sentences/mod/'+f+'.json'); if(!r.ok) throw {code:'http',message:'Modül dosyası yüklenemedi'}; const d=await r.json(); return (Array.isArray(d)?d:(d.rows||d.sentences||[])).filter(x=>x&&x.en&&x.tr).map(toSent); }
/* Sözlük (data/dictionary.json) — modül kelimelerinin anlamı için, yapay zekâsız */
let DICT=null;
async function loadDict(){ if(DICT) return DICT; const r=await fetch('./data/dictionary.json?v=1'); if(!r.ok) throw {code:'http',message:'Sözlük yüklenemedi'}; DICT=await r.json(); return DICT; }
const STOP=new Set('the a an and or but if of to in on at for with from by as is am are was were be been being have has had do does did will would can could should shall may might must i you he she it we they me him her us them my your his its our their this that these those there here what who whom which when where why how not no yes so than then too very just also only about into over after before up down out off again all any some each few more most other such own same both'.split(' '));
const LEVEL_RANK={A1:1,A2:2,B1:3,B2:4,C1:5,C2:6};
function dictLookup(D,w){ const tries=[w]; if(w.endsWith('ies')) tries.push(w.slice(0,-3)+'y'); if(w.endsWith('es')) tries.push(w.slice(0,-2)); if(w.endsWith('s')) tries.push(w.slice(0,-1)); if(w.endsWith('ed')) tries.push(w.slice(0,-2),w.slice(0,-1)); if(w.endsWith('ing')) tries.push(w.slice(0,-3),w.slice(0,-3)+'e'); for(const t of tries){ if(D[t]) return [t,D[t]]; } return null; }
async function wordsFromSentences(sents,L,max=12){
  const D=await loadDict(); const seen=new Set(), out=[]; const lr=LEVEL_RANK[L]||2;
  const cand=[];
  sents.forEach(s=>String(s.en).toLowerCase().replace(/[’']/g,"'").split(/[^a-z']+/).forEach(w=>{ w=w.replace(/^'+|'+$/g,''); if(w.length<3||STOP.has(w)||seen.has(w)) return; seen.add(w); const hit=dictLookup(D,w); if(!hit) return; const [base,e]=hit; if(seen.has('#'+base)) return; seen.add('#'+base);
    const ms=[]; (e.anlamlar||[]).forEach(a=>{ a=String(a).replace(/\s*\[.*?\]/g,'').trim(); if(a&&!ms.includes(a)) ms.push(a); }); if(!ms.length) return;
    const wr=LEVEL_RANK[e.seviye]||0; cand.push({w:base,o:e.oku||'',tr:ms.slice(0,2).join(', '),ex:s.en,score:(wr>=lr?3:wr===lr-1?2:!wr?1:0)}); }));
  cand.sort((a,b)=>(b.score-a.score)||(b.w.length-a.w.length)); return cand.slice(0,max);
}

/* ================= Kendi kursunu oluştur ================= */
const COURSE_IDEAS=['Restoran işletmeciliği','Futbol ve spor yorumculuğu','Yazılım mülakatları','Hemşirelik','Emlak ve kiralama','Online satış ve e-ticaret','Seyahat acenteliği','Yurt dışında üniversite','Fotoğrafçılık','Kişisel finans'];
function startCourseBuilder(prefill){
  const b=openPanel('Yeni kurs oluştur');
  const f=Object.assign({topic:'',level:S.level,units:8,goal:''},prefill||{});
  b.innerHTML=`<div class="inner">
    <p class="muted" style="margin:0">Konunu ve seviyeni seç; yapay zekâ kursu ünite ünite planlar. Kaydetmeden önce üniteleri görüp düzenleyebilirsin.</p>
    <form class="card stack" id="cbF">
      <div class="field"><label for="cbT">Konu</label><input id="cbT" maxlength="80" required value="${esc(f.topic)}" placeholder="Örn: Restoran işletmeciliği, futbol, yazılım mülakatları"><div class="row" style="gap:6px">${COURSE_IDEAS.map(x=>`<button type="button" class="btn sm ghost" data-idea="${esc(x)}" style="border:1px dashed var(--line)">${esc(x)}</button>`).join('')}</div></div>
      <div class="field"><label>Seviye</label><div class="tabs" id="cbL">${LEVELS.map(L=>`<button type="button" class="${L===f.level?'on':''}" data-l="${L}">${L} · ${LEVEL_NAMES[L]}</button>`).join('')}</div></div>
      <div class="field"><label for="cbN">Ünite sayısı</label><select id="cbN">${[6,8,10,12].map(n=>`<option ${n===f.units?'selected':''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label for="cbG">Amacın (isteğe bağlı)</label><input id="cbG" maxlength="140" value="${esc(f.goal)}" placeholder="Örn: Almanya'da garson olarak iş bulmak"></div>
      <div class="row"><button class="btn primary" id="cbGo">Kursu planla</button><span class="small muted">${aiOff()?aiErr({code:'no_ai'}):'Yapay zekâ yaklaşık 10-20 saniyede planlar.'}</span></div>
    </form><div id="cbOut"></div></div>`;
  let level=f.level;
  b.querySelectorAll('[data-idea]').forEach(x=>x.onclick=()=>{ $('#cbT',b).value=x.dataset.idea; $('#cbT',b).focus(); });
  b.querySelectorAll('#cbL [data-l]').forEach(x=>x.onclick=()=>{ level=x.dataset.l; b.querySelectorAll('#cbL [data-l]').forEach(y=>y.classList.toggle('on',y===x)); });
  $('#cbF',b).onsubmit=async e=>{
    e.preventDefault(); if(aiOff()) return;
    const topic=$('#cbT',b).value.trim(), n=+$('#cbN',b).value, goal=$('#cbG',b).value.trim(); if(!topic) return;
    const btn=$('#cbGo',b); btn.disabled=true; const out=$('#cbOut',b); out.innerHTML='<div class="card"><span class="typing"><i></i><i></i><i></i></span> Kurs planlanıyor…</div>';
    try{
      const r=await ai(`Design an English course for a Turkish learner. Topic: "${topic}". CEFR level: ${level} (${LEVEL_GUIDE[level]}).${goal?` Learner's goal: ${goal}.`:''} Plan exactly ${n} units that build on each other, from basic situations to more demanding ones within this topic, all suitable for ${level}. Each unit needs a short English title, its Turkish title, and a focus: the key grammar point or phrase pattern plus the vocabulary area to practise (one short line, English). Return ONLY JSON: {"title_tr":"short Turkish course title","title_en":"short English course title","desc_tr":"one Turkish sentence describing the course","units":[{"t":"English unit title","tr":"Türkçe ünite başlığı","focus":"..."}]}`,{deep:true});
      const units=(r.units||[]).filter(u=>u&&u.t).slice(0,12).map(u=>({t:String(u.t).slice(0,80),tr:String(u.tr||'').slice(0,80),focus:String(u.focus||'').slice(0,160)}));
      if(units.length<3) throw {code:'bad_json'};
      preview({topic,level,goal,t:String(r.title_tr||topic).slice(0,60),en:String(r.title_en||topic).slice(0,60),desc:String(r.desc_tr||''),units});
    }catch(err){ out.innerHTML=`<div class="notice">${esc(aiErr(err))}</div>`; btn.disabled=false; }
  };
  function preview(c){
    const out=$('#cbOut',b);
    const draw=()=>{
      out.innerHTML=`<div class="card stack"><div><span class="eyebrow">${c.level} · ${c.units.length} ünite</span><div class="field" style="margin-top:6px"><label for="cbName">Kurs adı</label><input id="cbName" value="${esc(c.t)}" maxlength="60"></div><p class="small muted" style="margin:6px 0 0">${esc(c.desc)}</p></div>
        <div class="list" id="cbU">${c.units.map((u,i)=>`<div class="item" style="gap:8px"><span class="dot" style="font-weight:700">${i+1}</span><div class="grow stack" style="gap:4px"><input data-ut="${i}" value="${esc(u.tr||u.t)}" maxlength="80" aria-label="Ünite ${i+1} başlığı" style="border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:6px 10px;font-weight:600"><span class="small muted">${esc(u.t)} · ${esc(u.focus)}</span></div><button type="button" class="icon-btn" data-rm="${i}" aria-label="Üniteyi çıkar" ${c.units.length<=3?'disabled':''}>${ic('close')}</button></div>`).join('')}</div>
        <div class="row"><button class="btn primary" id="cbSave">Kursu kaydet ve başla</button><button class="btn" id="cbAgain">Yeniden planla</button></div></div>`;
      out.querySelectorAll('[data-ut]').forEach(x=>x.oninput=()=>{ c.units[+x.dataset.ut].tr=x.value; });
      $('#cbName',out).oninput=e=>{ c.t=e.target.value; };
      out.querySelectorAll('[data-rm]').forEach(x=>x.onclick=()=>{ c.units.splice(+x.dataset.rm,1); draw(); });
      $('#cbAgain',out).onclick=()=>{ $('#cbGo',b).disabled=false; $('#cbF',b).requestSubmit(); };
      $('#cbSave',out).onclick=()=>{
        const id='u'+Date.now().toString(36); const now=Date.now();
        S.custom[id]={id,t:(c.t||c.topic).trim(),en:c.en,topic:c.topic,goal:c.goal,level:c.level,desc:c.desc,units:c.units,createdAt:now,at:now};
        S.course='C:'+id; touchSettings(); saveNow(); closePanel(true); location.hash='#learn'; render(); toast('Kurs oluşturuldu: '+S.custom[id].t);
      };
      out.scrollIntoView({block:'start',behavior:'smooth'});
    };
    draw();
  }
}

/* ================= Seviye sonu sınavı ================= */
const PASS=70;
function certName(){ if(S.certName) return S.certName; try{ const p=JSON.parse(localStorage.getItem('dh-profile-v1')||'{}')||{}; if(p.ad) return String(p.ad).trim(); }catch(e){} return ''; }
function cleanMistake(m){
  let t=String(m||'').split(' / ')[0].replace(/❌/g,'').trim();
  if(!t||t==='-'||/\.\.\.|…/.test(t)||t.split(/\s+/).length<3) return '';
  return t;
}
function examSentences(L){ return (DATA.course[L]||[]).flatMap(u=>u.s.map(s=>Object.assign({unit:u.t},s))).filter(s=>s.en&&s.tr); }
function buildExam(L){
  const sents=shuffle(examSentences(L)), words=shuffle(DATA.words[L]||[]), Q=[];
  const others=(not,n)=>shuffle(sents.filter(x=>x.en!==not)).slice(0,n).map(x=>x.en);
  // 1) Kelime
  const meanings=(DATA.words[L]||[]).map(w=>w[2]);
  words.slice(0,8).forEach(w=>Q.push({sec:'vocab',q:`"${w[0]}" ne demek?`,say:w[0],opts:shuffle([w[2],...shuffle([...new Set(meanings.filter(x=>x!==w[2]))]).slice(0,3)]),a:w[2]}));
  // 2) Dilbilgisi: doğru cümleyi seç (Dil Harita'daki "sık yapılan hata" ile)
  const withM=sents.filter(s=>{ const m=cleanMistake(s.m); return m&&norm(m)!==norm(s.en); });
  withM.slice(0,6).forEach((s,i)=>{ const m=cleanMistake(s.m); const extra=withM[(i+7)%withM.length]; const opts=[s.en,m]; const em=extra&&cleanMistake(extra.m); if(em&&norm(em)!==norm(s.en)&&opts.indexOf(em)<0) opts.push(em);
    Q.push({sec:'grammar',q:'Hangisi doğru?',hint:s.tr,opts:shuffle(opts),a:s.en,why:s.x}); });
  // 3) Çeviri
  sents.slice(6,11).forEach(s=>Q.push({sec:'trans',q:'Bu cümlenin İngilizcesi hangisi?',hint:s.tr,opts:shuffle([s.en,...others(s.en,3)]),a:s.en,why:s.x}));
  // 4) Dinleme
  sents.slice(11,15).forEach(s=>Q.push({sec:'listen',q:'Dinle: hangi cümleyi duydun?',say:s.en,opts:shuffle([s.en,...others(s.en,3)]),a:s.en}));
  // 5) Konuşma (mikrofon varsa)
  if(dict) sents.slice(15,17).forEach(s=>Q.push({sec:'speak',q:'Bu cümleyi sesli oku',target:s.en,hint:s.tr}));
  // 6) Yazma (yapay zekâ varsa)
  if(!aiOff()){ const units=(DATA.course[L]||[]); const u=units[Math.floor(Math.random()*units.length)]||{t:'daily life',sc:[]}; Q.push({sec:'write',q:'Kısa bir metin yaz',topic:(u.sc&&u.sc[0])||u.t,grammar:u.t}); }
  return Q;
}
const SEC_NAMES={vocab:'Kelime',grammar:'Dilbilgisi',trans:'Çeviri',listen:'Dinleme',speak:'Konuşma',write:'Yazma'};
function examIntro(L){
  const b=openPanel(L+' seviye sınavı');
  const ex=S.exams[L], cert=S.certs[L];
  const secs=['Kelime: 8 soru','Dilbilgisi: doğru cümleyi seç','Çeviri: 5 soru','Dinleme: 4 soru',dict?'Konuşma: 2 cümleyi sesli oku':'Konuşma: bu tarayıcıda mikrofon yok, bölüm atlanır',aiOff()?'Yazma: yapay zekâ yok, bölüm atlanır':'Yazma: kısa bir metin, yapay zekâ puanlar'];
  b.innerHTML=`<div class="inner"><div><span class="eyebrow">${L} · ${LEVEL_NAMES[L]}</span><h2>Seviye sonu sınavı</h2></div>
    <div class="card stack"><p style="margin:0">Sınav bu seviyenin kurs cümlelerinden ve kelimelerinden hazırlanır. Her bölüm eşit ağırlıktadır; toplamda <b>%${PASS}</b> alırsan <b>${L} sertifikası</b> kazanırsın.</p>
    <ul style="margin:0;padding-left:20px">${secs.map(s=>`<li>${s}</li>`).join('')}</ul>
    <p class="small muted" style="margin:0">Yaklaşık 10 dakika sürer. Cevaplar sınav sonunda gösterilir.${ex?` Daha önce ${ex.tries} kez girdin, en iyi sonucun %${ex.best}.`:''}${cert?' Bu seviyenin sertifikası zaten var; daha yüksek puan alırsan sertifikadaki puan güncellenir.':''}</p></div>
    <div class="field"><label for="exName">Sertifikada yazacak adın</label><input id="exName" value="${esc(certName())}" maxlength="60" placeholder="Adın ve soyadın" autocomplete="name"></div>
    <div class="row"><button class="btn primary" id="exGo">Sınava başla</button><button class="btn ghost" id="exNo">Vazgeç</button></div></div>`;
  $('#exNo',b).onclick=()=>closePanel();
  $('#exGo',b).onclick=()=>{ const n=$('#exName',b).value.trim(); if(n&&n!==S.certName){ S.certName=n; touchSettings(); } runExam(L); };
}
function runExam(L){
  const Q=buildExam(L); const ans=[]; let i=0;
  const b=openPanel(L+' seviye sınavı');
  panelCleanup=null;
  const draw=()=>{
    if(i>=Q.length) return finishExam(L,Q,ans);
    const q=Q[i];
    const head=`<div class="row between"><span class="eyebrow">${SEC_NAMES[q.sec]} · Soru ${i+1}/${Q.length}</span><div class="bar" style="width:160px"><i style="width:${i/Q.length*100}%"></i></div></div>`;
    if(q.opts){
      b.innerHTML=`<div class="inner">${head}<div class="card stack" style="gap:8px"><b style="font-size:1.15rem">${esc(q.q)}</b>${q.hint?`<span class="muted">${esc(q.hint)}</span>`:''}${q.say&&q.sec==='listen'?`<button class="btn sm" id="play" style="align-self:flex-start">${ic('speaker','width="16" height="16"')} Tekrar dinle</button>`:''}</div>
        <div class="opts">${q.opts.map((o,k)=>`<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div></div>`;
      if(q.sec==='listen'){ speak(q.say); $('#play',b).onclick=()=>speak(q.say); } else if(q.sec==='vocab') speak(q.say);
      b.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{ const v=q.opts[+o.dataset.k]; ans[i]={v,ok:v===q.a,score:v===q.a?100:0}; o.classList.add('on'); o.style.borderColor='var(--accent)'; b.querySelectorAll('.opt').forEach(x=>x.disabled=true); setTimeout(()=>{ i++; draw(); },250); });
    } else if(q.sec==='speak'){
      let heard='';
      b.innerHTML=`<div class="inner">${head}<div class="card stack" style="gap:8px"><b style="font-size:1.15rem">${esc(q.q)}</b><span class="big" style="font-size:1.4rem">${esc(q.target)}</span><span class="muted">${esc(q.hint)}</span></div>
        <div class="row"><span id="mk"></span><span class="small muted">Mikrofona bas, cümleyi oku, bitince tekrar bas.</span></div><p id="hd" class="muted"></p><div class="row"><button class="btn ghost" id="skp">Bu soruyu geç</button></div></div>`;
      const mic=micButton({partial:t=>{ $('#hd',b).textContent=heard+t; }, final:t=>{ heard+=t+' '; $('#hd',b).textContent=heard; }, idle:()=>{ if(!heard.trim()) return; const sc=similarity(heard,q.target); S.stats.pron.push(sc); ans[i]={v:heard.trim(),score:sc,ok:sc>=80}; i++; draw(); }});
      mic.style.width='64px'; mic.style.height='64px'; $('#mk',b).replaceWith(mic);
      $('#skp',b).onclick=()=>{ if(micLive&&dict) dict.stop().catch(()=>{}); micTarget=null; ans[i]={v:'',score:0,ok:false}; i++; draw(); };
    } else if(q.sec==='write'){
      b.innerHTML=`<div class="inner">${head}<div class="card stack" style="gap:8px"><b style="font-size:1.15rem">${esc(q.q)}</b><span>Konu: <b>${esc(q.topic)}</b>. ${L==='A1'||L==='A2'?'3-5 kısa cümle':'5-8 cümle'} yaz. Mümkünse "${esc(q.grammar)}" yapısını kullan.</span></div>
        <textarea id="wt" rows="7" style="border:1px solid var(--line);background:var(--surface);border-radius:var(--r-sm);padding:12px;width:100%" placeholder="İngilizce yaz…" aria-label="Metnin"></textarea>
        <div class="row between"><span class="small muted" id="wc">0 kelime</span><button class="btn primary" id="ws">Gönder ve sınavı bitir</button></div><div id="wr"></div></div>`;
      const wt=$('#wt',b); wt.oninput=()=>$('#wc',b).textContent=wt.value.trim().split(/\s+/).filter(Boolean).length+' kelime'; wt.focus();
      $('#ws',b).onclick=async()=>{ const txt=wt.value.trim(); if(txt.split(/\s+/).length<5){ toast('Biraz daha yaz: en az birkaç cümle.'); return; }
        $('#ws',b).disabled=true; $('#wr',b).innerHTML='<span class="typing"><i></i><i></i><i></i></span> Puanlanıyor…';
        try{ const r=await ai(`Grade this short text written by a Turkish learner in an end-of-level ${L} English exam. Task: write about "${q.topic}". Judge only against CEFR ${L} expectations: task achievement, grammar, vocabulary range, coherence. Ignore punctuation and capitalisation slips. Return ONLY JSON: {"score":0-100,"feedback_tr":"2 short Turkish sentences, informal","corrected":"their text with errors fixed"}\nText: """${txt}"""`,{deep:true});
          ans[i]={v:txt,score:Math.max(0,Math.min(100,Math.round(+r.score||0))),ok:(+r.score||0)>=PASS,fb:r.feedback_tr,fix:r.corrected}; }
        catch(e){ ans[i]={v:txt,score:null,skip:true,err:aiErr(e)}; }
        i++; draw(); };
    }
  };
  draw();
}
function finishExam(L,Q,ans){
  const by={}; Q.forEach((q,k)=>{ const a=ans[k]; if(!a||a.skip) return; (by[q.sec]=by[q.sec]||[]).push(a.score||0); });
  const secs=Object.keys(by).map(s=>[s,Math.round(by[s].reduce((x,y)=>x+y,0)/by[s].length)]);
  const total=secs.length?Math.round(secs.reduce((x,s)=>x+s[1],0)/secs.length):0;
  const pass=total>=PASS;
  const ex=S.exams[L]||{tries:0,best:0}; ex.tries=(ex.tries||0)+1; ex.best=Math.max(ex.best||0,total); ex.last=total; ex.lastDate=today(); ex.at=Date.now(); S.exams[L]=ex;
  Q.forEach((q,k)=>{ const a=ans[k]; if(a&&!a.ok&&(q.sec==='grammar'||q.sec==='trans')&&a.v) addError({wrong:a.v,right:q.a,why:q.why||'',tag:'level exam',mode:'exam',d:today()}); });
  let first=false;
  if(pass){ const old=S.certs[L]; if(!old){ first=true; S.certs[L]={score:total,date:today(),id:'KNK-'+L+'-'+Date.now().toString(36).toUpperCase().slice(-6),name:certName()||'Konuşkan öğrencisi',at:Date.now()}; addXP(150); }
    else if(total>old.score){ old.score=total; old.date=today(); old.name=certName()||old.name; old.at=Date.now(); } }
  checkAch(); saveNow();
  const b=openPanel(L+' sınav sonucu');
  const wrong=Q.map((q,k)=>[q,ans[k]]).filter(([q,a])=>a&&!a.ok&&q.opts);
  const nextL=LEVELS[LEVELS.indexOf(L)+1];
  b.innerHTML=`<div class="inner">
    <div class="card stack" style="align-items:center;text-align:center;gap:8px;${pass?'background:var(--ok-soft);border-color:var(--ok)':''}"><span class="eyebrow">${L} · ${LEVEL_NAMES[L]}</span><span class="big" style="font-size:3rem">%${total}</span><b>${pass?(first?'Tebrikler, sınavı geçtin ve sertifikanı kazandın!':'Tebrikler, sınavı yine geçtin.'):`Geçme notu %${PASS}. Bu sefer olmadı; eksik bölümlere çalışıp tekrar dene.`}</b>
      <div class="row" style="justify-content:center">${pass?`<button class="btn primary" id="seeCert">${ic('star','width="16" height="16"')} Sertifikayı gör</button>${nextL?`<button class="btn" id="goNext">${nextL} seviyesine geç</button>`:''}`:`<button class="btn primary" id="again">Tekrar dene</button><button class="btn" id="toLearn">Öğrenme yoluna dön</button>`}</div></div>
    <div class="card stack"><h3>Bölümler</h3>${secs.map(([s,v])=>`<div class="stack" style="gap:4px"><div class="row between"><span>${SEC_NAMES[s]}</span><b>%${v}</b></div><div class="bar"><i style="width:${v}%;${v<PASS?'background:var(--warn)':''}"></i></div></div>`).join('')}
      ${Q.some((q,k)=>ans[k]&&ans[k].skip)?`<p class="small muted" style="margin:0">Yazma bölümü puanlanamadı ve hesaba katılmadı.</p>`:''}</div>
    ${(()=>{ const w=Q.findIndex(q=>q.sec==='write'); const a=ans[w]; return a&&!a.skip?`<div class="card stack"><h3>Yazma geri bildirimi · %${a.score}</h3><p style="margin:0">${esc(a.fb||'')}</p>${a.fix?`<div class="fb-fix" style="white-space:pre-wrap">${esc(a.fix)}</div>`:''}</div>`:''; })()}
    ${wrong.length?`<div class="card stack"><h3>Yanlış cevaplar</h3>${wrong.map(([q,a])=>`<div class="small stack" style="gap:4px"><b>${esc(q.hint||q.q)}</b><div class="fb-orig">${esc(a.v)}</div><div class="fb-fix">${esc(q.a)}</div>${q.why?`<span class="muted">${esc(q.why)}</span>`:''}</div>`).join('')}</div>`:''}
  </div>`;
  const g=id=>$(id,b);
  if(g('#seeCert')) g('#seeCert').onclick=()=>openCert(L);
  if(g('#goNext')) g('#goNext').onclick=()=>{ closePanel(true); setLevel(nextL); location.hash='#learn'; };
  if(g('#again')) g('#again').onclick=()=>examIntro(L);
  if(g('#toLearn')) g('#toLearn').onclick=()=>{ S.course='L:'+L; save(); closePanel(true); location.hash='#learn'; render(); };
}

/* ================= Sertifika ================= */
async function drawCert(L){
  const c=S.certs[L]; const W=2000,H=1414; const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const x=cv.getContext('2d');
  try{ await document.fonts.ready; }catch(e){}
  const D='"Bricolage Grotesque", "Segoe UI", sans-serif', B='Figtree, "Segoe UI", sans-serif';
  x.fillStyle='#fbfaf5'; x.fillRect(0,0,W,H);
  x.strokeStyle='#0f7b6c'; x.lineWidth=18; x.strokeRect(50,50,W-100,H-100);
  x.strokeStyle='#e8a33d'; x.lineWidth=4; x.strokeRect(92,92,W-184,H-184);
  // köşe süsleri
  x.fillStyle='#0f7b6c'; [[92,92],[W-92,92],[92,H-92],[W-92,H-92]].forEach(([a,bb])=>{ x.beginPath(); x.arc(a,bb,16,0,Math.PI*2); x.fill(); });
  // logo
  x.save(); x.translate(W/2-40,150); x.fillStyle='#0f7b6c'; x.beginPath(); x.roundRect?x.roundRect(0,0,80,80,22):x.rect(0,0,80,80); x.fill();
  x.fillStyle='#fff'; x.beginPath(); x.moveTo(20,29); x.lineTo(60,29); x.quadraticCurveTo(68,29,68,37); x.lineTo(68,48); x.quadraticCurveTo(68,56,60,56); x.lineTo(39,56); x.lineTo(27,66); x.lineTo(27,56); x.quadraticCurveTo(12,55,12,46); x.lineTo(12,37); x.quadraticCurveTo(12,29,20,29); x.fill(); x.restore();
  x.textAlign='center'; x.fillStyle='#16201c';
  x.font=`600 34px ${B}`; x.fillStyle='#5f6b65'; x.fillText('KONUŞKAN · DİL HARİTA',W/2,290);
  x.font=`800 112px ${D}`; x.fillStyle='#16201c'; x.fillText('Başarı Sertifikası',W/2,430);
  x.font=`500 38px ${B}`; x.fillStyle='#5f6b65'; x.fillText('Bu belge',W/2,530);
  const name=(c.name||certName()||'Konuşkan öğrencisi');
  let fs=96; x.font=`800 ${fs}px ${D}`; while(x.measureText(name).width>W-400&&fs>48){ fs-=4; x.font=`800 ${fs}px ${D}`; }
  x.fillStyle='#0f7b6c'; x.fillText(name,W/2,650);
  x.strokeStyle='#e8a33d'; x.lineWidth=3; x.beginPath(); x.moveTo(W/2-420,690); x.lineTo(W/2+420,690); x.stroke();
  x.font=`500 40px ${B}`; x.fillStyle='#16201c';
  x.fillText(`adlı öğrencinin İngilizce ${L} · ${LEVEL_NAMES[L]} seviye sınavını`,W/2,780);
  x.fillText(`%${c.score} başarıyla geçtiğini gösterir.`,W/2,840);
  // seviye mührü
  x.save(); x.translate(W/2,1010); x.fillStyle='#e8a33d'; x.beginPath(); for(let k=0;k<24;k++){ const r=k%2?92:108, t=k/24*Math.PI*2; x.lineTo(Math.cos(t)*r,Math.sin(t)*r); } x.closePath(); x.fill();
  x.fillStyle='#fbfaf5'; x.beginPath(); x.arc(0,0,76,0,Math.PI*2); x.fill(); x.fillStyle='#0f7b6c'; x.font=`800 64px ${D}`; x.textBaseline='middle'; x.fillText(L,0,4); x.restore(); x.textBaseline='alphabetic';
  x.font=`600 30px ${B}`; x.fillStyle='#16201c';
  const dt=new Date(c.date+'T12:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'});
  x.textAlign='left'; x.fillText('Tarih',220,1060); x.font=`500 32px ${B}`; x.fillText(dt,220,1105);
  x.textAlign='right'; x.font=`600 30px ${B}`; x.fillText('Sertifika no',W-220,1060); x.font=`500 32px ${B}`; x.fillText(c.id,W-220,1105);
  x.textAlign='center'; x.font=`400 24px ${B}`; x.fillStyle='#8a948f';
  x.fillText('Bu belge Konuşkan uygulama içi seviye sınavının sonucudur; resmî bir CEFR sertifikası değildir.',W/2,1240);
  return cv;
}
async function openCert(L){
  const c=S.certs[L]; if(!c) return examIntro(L);
  const b=openPanel(L+' sertifikası');
  b.innerHTML=`<div class="inner" style="max-width:980px"><p class="muted" style="margin:0">Hazırlanıyor…</p></div>`;
  const cv=await drawCert(L); const url=cv.toDataURL('image/png');
  b.innerHTML=`<div class="inner" style="max-width:980px"><img src="${url}" alt="${L} sertifikası" style="width:100%;border-radius:var(--r);box-shadow:var(--shadow)">
    <div class="row"><button class="btn primary" id="dl">PNG olarak indir</button><button class="btn" id="pr">Yazdır / PDF kaydet</button></div>
    <div class="field" style="max-width:420px"><label for="cn">Sertifikadaki ad</label><div class="row"><input id="cn" value="${esc(c.name||'')}" maxlength="60" style="flex:1"><button class="btn sm" id="cnS">Güncelle</button></div></div>
    <p class="small muted" style="margin:0">Puan: %${c.score} · ${esc(c.date)} · No: ${esc(c.id)}</p></div>`;
  $('#dl',b).onclick=()=>{ const a=document.createElement('a'); a.href=url; a.download=`Konuskan-${L}-sertifika.png`; document.body.appendChild(a); a.click(); a.remove(); };
  $('#pr',b).onclick=()=>{ let pa=$('#printArea'); if(!pa){ pa=document.createElement('div'); pa.id='printArea'; document.body.appendChild(pa); } pa.innerHTML=`<img src="${url}" alt="">`; window.print(); };
  $('#cnS',b).onclick=()=>{ const n=$('#cn',b).value.trim(); if(!n) return; c.name=n; c.at=Date.now(); S.certName=n; touchSettings(); saveNow(); openCert(L); };
}

/* Seviye kursu cümle alıştırması: ünitenin TÜM cümleleri (hazır modül dosyalarından) */
async function levelSentencePicker(L,unit,done){
  const b=openPanel('Cümle modu · '+unit.t);
  b.innerHTML=`<div class="inner"><p class="muted">Ünitenin cümleleri yükleniyor…</p><span class="typing"><i></i><i></i><i></i></span></div>`;
  let parts=[];
  try{ parts=await levelUnitParts(L,unit.t); }catch(e){}
  if(!parts.length) return runSentences(unit.s,unit.t,done);   /* çevrimdışı ya da eşleşme yok: gömülü 10 cümle */
  const total=parts.reduce((a,p)=>a+p.n,0);
  b.innerHTML=`<div class="inner"><div><span class="eyebrow">${L} · ${esc(unit.t)}</span><h2>Hangi cümlelerle çalışalım?</h2><p class="muted" style="margin:4px 0 0">Bu ünitede Dil Harita müfredatından ${total} cümle var.</p></div>
    <div class="list"><button class="item" data-p="mix"><span class="dot">${ic('sentence')}</span><div class="grow"><b>Karışık 10 cümle</b><div class="small muted">Tüm parçalardan rastgele</div></div>${ic('arrow','width="18" height="18" style="color:var(--muted)"')}</button>
    ${parts.map((p,i)=>`<button class="item" data-p="${i}"><span class="dot">${i+1}</span><div class="grow"><b>${esc(p.label)}</b><div class="small muted">${p.n} cümle</div></div>${ic('arrow','width="18" height="18" style="color:var(--muted)"')}</button>`).join('')}</div></div>`;
  b.querySelectorAll('[data-p]').forEach(x=>x.onclick=async()=>{
    x.disabled=true;
    try{
      if(x.dataset.p==='mix'){ const all=(await Promise.all(parts.map(p=>levelPartSentences(p.f).catch(()=>[])))).flat(); runSentences(shuffle(all).slice(0,10),unit.t+' · karışık',done); }
      else { const p=parts[+x.dataset.p]; runSentences(await levelPartSentences(p.f),unit.t+' · '+p.label,done); }
    }catch(e){ x.disabled=false; toast(aiErr(e)); }
  });
}

/* ================= Kurs alıştırmaları ================= */
async function openExercise(c,u,ex){
  const key=exKey(c.id,u.i,ex); const done=()=>{ if(!S.done[key]) addXP(30); S.done[key]=today(); save(); };
  if(c.level){
    const unit=DATA.course[c.level][u.i];
    if(ex==='sentence') return levelSentencePicker(c.level,unit,done);
    if(ex==='word'){ const all=DATA.words[c.level]; const start=(u.i*12)%all.length; const ws=all.slice(start,start+12).map(w=>({w:w[0],o:w[1],tr:w[2]})); return runWords(ws,`${c.level} · ${unit.t}`,c.level,done); }
    if(ex==='roleplay'){ const sc=unit.sc[0]||unit.t; return startChat({kind:'roleplay',title:'Ünite '+(u.i+1)+' · '+unit.t,name:'Deniz',color:'#c4733a',persona:`Deniz, an English teacher who sets up a short real-life roleplay ("${sc}") and plays the other person in it`,scene:sc,tasks:['Use the grammar of this unit ('+unit.t+') at least twice','Ask a question','Give a longer answer (2+ sentences)'],material:unit.s.slice(0,6).map((s,i)=>`${i+1}) "${s.en}" pattern: ${s.g}`).join('\n'),onDone:done}); }
  } else if(c.mod){
    const sents=moduleSentences(u.modId), L=c.clevel;
    if(!sents.length){ const b=openPanel(c.t); b.innerHTML=`<div class="inner"><div class="notice">Bu modülün cümleleri bu cihazda bulunamadı. Dil Harita'da Modüllerim sayfasını bir kez açıp tekrar dene.</div></div>`; return; }
    if(ex==='sentence') return runSentences(shuffle(sents).slice(0,25),c.t+' · '+u.t,done);
    if(ex==='word'){ const b=openPanel('Kelime modu · '+u.t); b.innerHTML=`<div class="inner"><p class="muted">Modülün kelimeleri Dil Harita sözlüğünden hazırlanıyor…</p><span class="typing"><i></i><i></i><i></i></span></div>`;
      try{ const ws=await wordsFromSentences(sents,L,12); if(ws.length<4){ b.innerHTML=`<div class="inner"><div class="notice">Bu modülde sözlükte bulunan yeterli kelime yok.</div></div>`; return; } return runWords(ws,c.t+' · '+u.t,L,done); }
      catch(e){ b.innerHTML=`<div class="inner"><div class="notice">${esc(aiErr(e))}</div></div>`; return; } }
    if(ex==='roleplay'){ const pick=shuffle(sents).slice(0,6); const sc=(pick.find(s=>s.sc)||{}).sc||c.t;
      return startChat({kind:'roleplay',title:c.t+' · '+u.t,name:'Deniz',color:'#c4733a',level:L,persona:`Deniz, an English teacher who sets up a short real-life roleplay based on the story/topic "${c.t}" ("${sc}") and plays the other person in it`,scene:sc,tasks:['Use two of today\'s sentence patterns','Ask a question about the situation','Give a longer answer (2+ sentences)'],material:pick.map((s,i)=>`${i+1}) "${s.en}"${s.g?' pattern: '+s.g:''}`).join('\n'),onDone:done}); }
  } else {
    const tc=c.topic, unitT=u.en||u.t, L=c.clevel||S.level, focus=u.focus?` Focus of this unit: ${u.focus}.`:'', goal=c.custom&&c.custom.goal?` The learner's goal: ${c.custom.goal}.`:'';
    if(ex==='dialogue') return startDialogue(`${tc.en}: ${unitT}`,done);
    if(ex==='roleplay') return startChat({kind:'roleplay',title:tc.t+' · '+unitT,name:'Deniz',color:'#c4733a',level:L,persona:`the other person in a realistic "${tc.en}" situation about "${unitT}". Choose a fitting role (colleague, customer, client, receptionist…) and say who you are in your first line.${focus}${goal}`,scene:`${tc.en}: ${unitT}`,tasks:u.focus?['Use the focus of this unit ('+u.focus+') naturally','Ask for clarification once','Summarise the outcome at the end']:['Use 3 topic words naturally','Ask for clarification once','Summarise the outcome at the end'],onDone:done});
    if(ex==='sentence'){
      const gk='konuskan-gen-s-'+c.id+'-'+u.i+'-'+L; let ss=null; try{ ss=JSON.parse(localStorage.getItem(gk)); }catch(e){}
      if(!ss){ const b=openPanel('Cümle modu · '+u.t); if(aiOff()){ b.innerHTML=`<div class="inner"><div class="notice">${aiErr({code:'no_ai'})}</div></div>`; return; }
        b.innerHTML=`<div class="inner"><p class="muted">"${esc(u.t)}" için cümleler hazırlanıyor…</p><span class="typing"><i></i><i></i><i></i></span></div>`;
        try{ const r=await ai(`Create 8 useful English sentences for the course "${tc.en}", unit "${unitT}", for a Turkish learner at CEFR ${L}. ${LEVEL_GUIDE[L]}${focus}${goal} Sentences must be natural, 5-14 words, realistic for this topic. For each give: the Turkish translation, a short grammar/pattern label in Turkish, a typical mistake a Turkish learner makes with it (an incorrect English version), and a 1-2 sentence explanation in informal Turkish (sen). Return ONLY JSON: {"sentences":[{"en":"...","tr":"...","g":"...","m":"incorrect version","x":"..."}]}`);
          ss=(r.sentences||[]).filter(s=>s&&s.en&&s.tr).slice(0,10).map(s=>({en:String(s.en),tr:String(s.tr),g:String(s.g||''),m:s.m?String(s.m)+' ❌':'',x:String(s.x||''),ipa:''})); if(!ss.length) throw {code:'bad_json'}; try{ localStorage.setItem(gk,JSON.stringify(ss)); }catch(e){} }
        catch(e){ b.innerHTML=`<div class="inner"><div class="notice">${esc(aiErr(e))}</div></div>`; return; } }
      return runSentences(ss,u.t,done);
    }
    if(ex==='word'){
      const gk='konuskan-gen-'+c.id+'-'+u.i+'-'+L; let ws=null; try{ ws=JSON.parse(localStorage.getItem(gk)); }catch(e){}
      if(!ws){ const b=openPanel('Kelime modu · '+unitT); if(aiOff()){ b.innerHTML=`<div class="inner"><div class="notice">${aiErr({code:'no_ai'})}</div></div>`; return; }
        b.innerHTML=`<div class="inner"><p class="muted">"${esc(unitT)}" için kelime destesi hazırlanıyor…</p><span class="typing"><i></i><i></i><i></i></span></div>`;
        try{ const r=await ai(`Create a vocabulary deck of 10 useful English words or short phrases for the topic "${tc.en}: ${unitT}" for a Turkish learner at CEFR ${L}.${focus}${goal} For each give the Turkish meaning, a simple Turkish-letter pronunciation guide (e.g. "kontrakt" for contract), and a short English example sentence. Return ONLY JSON: {"words":[{"w":"...","tr":"...","o":"...","ex":"..."}]}`);
          ws=(r.words||[]).filter(w=>w&&w.w&&w.tr).slice(0,10); try{ localStorage.setItem(gk,JSON.stringify(ws)); }catch(e){} }
        catch(e){ b.innerHTML=`<div class="inner"><div class="notice">${esc(aiErr(e))}</div></div>`; return; } }
      return runWords(ws,u.t,L,done);
    }
  }
}

/* ================= Başlat ================= */
const modHazir=(window.DHModul&&DHModul.hazir?Promise.race([Promise.resolve(DHModul.hazir()).catch(()=>{}),new Promise(r=>setTimeout(r,4000))]):Promise.resolve()).then(loadUserModules);
Promise.all([fetch('./konuskan/data.json?v=1').then(r=>{ if(!r.ok) throw 0; return r.json(); }).then(d=>{ DATA=d; }).catch(()=>{ toast('Kurs verisi yüklenemedi; internet bağlantını kontrol et.'); }), modHazir])
  .then(()=>{ if(String(S.course).startsWith('M:')&&!MOD_SERIES.some(s=>'M:'+s.key===S.course)) S.course='L:'+S.level; render(); });
