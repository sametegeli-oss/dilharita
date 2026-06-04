
(function(){
'use strict';
function $(id){return document.getElementById(id)}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function read(k){try{let v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
function write(k,a){try{localStorage.setItem(k,JSON.stringify(a));return true}catch(e){return false}}
function norm(w){return String(w||'').toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g,'').replace(/[’']/g,'')}
function lemmas(w){w=norm(w);let a=[w];if(w.endsWith('ies'))a.push(w.slice(0,-3)+'y');if(w.endsWith('ing')){a.push(w.slice(0,-3));a.push(w.slice(0,-3)+'e')}if(w.endsWith('ed')){a.push(w.slice(0,-2));a.push(w.slice(0,-1))}if(w.endsWith('s')&&w.length>3)a.push(w.slice(0,-1));return [...new Set(a)]}
function map(){return window.WM_SOZLUK_MEANING_MAP||{}}
function find(word){for(const c of lemmas(word)){if(map()[c])return{key:c,e:map()[c]}}return null}
const STOP=new Set('a an the and or but if then because as at by for from in into on onto of off over under with without to too very is are was were be been being am do does did done have has had having i you he she it we they me him her us them my your his its our their this that these those there here not no yes can could should would will shall may might must just so than also more most some any each every all both either neither about after before during through across again against ago up down out now new old get got make made go went gone come came see saw seen know knew known think thought say said tell told take took taken'.split(' '));
function ensureUI(){if($('ffFabs'))return;document.body.insertAdjacentHTML('beforeend',`
<div id="ffFabs" class="ff-fabs"><button class="ff-fab" onclick="ffOpen('dash')">📊 Panel</button><button class="ff-fab" onclick="ffOpen('mine')">⛏️ Mining</button><button class="ff-fab" onclick="ffOpen('rev')">🧠 Tekrar</button><button class="ff-fab" onclick="ffOpen('shad')">🎧 Shadow</button></div>
<div id="ffDash" class="ff-ov"><div class="ff-wrap"><div class="ff-top"><button class="ff-close" onclick="ffClose('dash')">← Kapat</button><h2>📊 Full Dashboard</h2></div><div id="ffDashC"></div></div></div>
<div id="ffMine" class="ff-ov"><div class="ff-wrap"><div class="ff-top"><button class="ff-close" onclick="ffClose('mine')">← Kapat</button><h2>⛏️ PDF / Transcript Mining v2</h2></div>${mineHTML()}</div></div>
<div id="ffRev" class="ff-ov"><div class="ff-wrap"><div class="ff-top"><button class="ff-close" onclick="ffClose('rev')">← Kapat</button><h2>🧠 Smart Review v2</h2></div><div id="ffRevC"></div></div></div>
<div id="ffShad" class="ff-ov"><div class="ff-wrap"><div class="ff-top"><button class="ff-close" onclick="ffClose('shad')">← Kapat</button><h2>🎧 Shadowing Studio v2</h2></div>${shadowHTML()}</div></div>`)}
window.ffOpen=function(w){
ensureUI();

/* TÜM overlayleri kapat */
['ffDash','ffMine','ffRev','ffShad','voiceCompareOverlay'].forEach(id=>{
  const el=$(id);
  if(el) el.classList.remove('active');
});

/* eski ekranları gizle */
document.querySelectorAll('.screen,.panel,.page,.tab-content').forEach(el=>{
  if(el && !el.classList.contains('active')){
    el.style.zIndex='';
  }
});

const target={dash:'ffDash',mine:'ffMine',rev:'ffRev',shad:'ffShad'}[w];

if(target && $(target)){
  $(target).classList.add('active');
  $(target).scrollTop=0;
}

/* body scroll kilit */
document.body.style.overflow='hidden';

if(w==='dash')dash();
if(w==='rev')review();
if(w==='shad')drawWave('ffSW',[],'Hazır');
}
window.ffClose=function(w){
let id={dash:'ffDash',mine:'ffMine',rev:'ffRev',shad:'ffShad'}[w];

if($(id)) $(id).classList.remove('active');

/* body scroll geri aç */
document.body.style.overflow='';

}

function study(){return read('studyWords')} function learned(){return read('learnedWords').concat(read('knownWords'))} function hist(){return read('pronunciationHistory').concat(read('voiceCompareHistory'))}
function weak(){let s={};hist().forEach(x=>{(x.weakSounds||x.phonemes||[]).forEach?.(p=>s[p]=(s[p]||0)+1);if(x.overall&&x.overall<70)s['ritim/enerji']=(s['ritim/enerji']||0)+1});return Object.entries(s).sort((a,b)=>b[1]-a[1]).slice(0,6)}
function today(){return new Date().toISOString().slice(0,10)}
function seed(w,e={}){if(!w)return;let a=read('smartReviewV2');if(!a.some(x=>x.word.toLowerCase()===w.toLowerCase())){a.push({word:w,meaning:(e.meanings||[])[0]||'',ease:2.5,interval:1,due:today(),correct:0,wrong:0});write('smartReviewV2',a)}}
function due(){study().forEach(x=>seed(String(x.word||x.Kelime||x),x));let t=today();return read('smartReviewV2').filter(x=>(x.due||t)<=t)}
function dash(){let h=hist(),avg=h.length?Math.round(h.reduce((a,x)=>a+(+x.overall||+x.score||0),0)/h.length):0,w=weak(),d=due();$('ffDashC').innerHTML=`<div class="ff-grid"><div class="ff-stat"><b>${learned().length}</b><span>ÖĞRENİLEN</span></div><div class="ff-stat"><b>${study().length}</b><span>ÇALIŞILACAK</span></div><div class="ff-stat"><b>${d.length}</b><span>BUGÜN</span></div><div class="ff-stat"><b>${avg||'-'}%</b><span>SPEAKING</span></div></div><div class="ff-card"><div class="ff-title">🤖 Daily AI Coach</div><div class="ff-list">${plan().map((p,i)=>`<div class="ff-item"><div class="ff-w">${i+1}</div><div class="ff-body"><div class="ff-m">${p}</div></div></div>`).join('')}</div></div><div class="ff-card"><div class="ff-title">🎯 Zayıf Sesler</div>${w.length?`<div class="ff-chips">${w.map(x=>`<span class="ff-chip">${esc(x[0])}: ${x[1]}</span>`).join('')}</div>`:'<div class="ff-sub">Henüz veri yok.</div>'}</div>`}
function plan(){let w=weak()[0]?.[0]||'TH / R';return[`Bugün ${w} sesini 5 dakika çalış.`,`${Math.min(12,Math.max(3,due().length))} kelime tekrar et.`,'2 cümle shadowing yap.',study()[0]?`"${esc(study()[0].word||study()[0].Kelime||study()[0])}" kelimesiyle cümle kur.`:'Mining ile 5 yeni kelime ekle.']}

function mineHTML(){return `<div class="ff-card"><div class="ff-title">📄 PDF Mining</div><div class="ff-sub">PDF seç; metin çıkarılır ve mining yapılır.</div><input id="ffPdf" class="ff-input" type="file" accept="application/pdf"><div class="ff-row"><button class="ff-btn ff-blue" onclick="ffPdf()">PDF Oku</button></div><div id="ffPdfS" class="ff-sub"></div></div><div class="ff-card"><div class="ff-title">▶️ Transcript / Metin</div><textarea id="ffText" class="ff-text" placeholder="YouTube transcripti veya İngilizce metin..."></textarea><div class="ff-row"><button class="ff-btn ff-green" onclick="ffMine()">Kelimeleri Çıkar</button><button class="ff-btn ff-purple" onclick="ffSample()">Örnek</button><button class="ff-btn ff-ghost" onclick="ffClear()">Temizle</button></div></div><div id="ffMineStats" class="ff-grid" style="display:none"></div><div class="ff-card"><div class="ff-title">Bulunan Kelimeler</div><div id="ffMineOut" class="ff-sub">Henüz analiz yapılmadı.</div></div>`}
window.ffPdf=async function(){let f=$('ffPdf')?.files?.[0];if(!f){alert('PDF seç.');return}$('ffPdfS').textContent='PDF okunuyor...';try{if(!window.pdfjsLib){await new Promise((res,rej)=>{let s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)});pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'}let pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise,text='';for(let p=1;p<=pdf.numPages;p++){let page=await pdf.getPage(p),c=await page.getTextContent();text+=c.items.map(i=>i.str).join(' ')+'\\n'}$('ffText').value=text;$('ffPdfS').textContent=pdf.numPages+' sayfa okundu.';ffMine()}catch(e){$('ffPdfS').textContent='PDF okunamadı: '+(e.message||e)}}
window.ffMine=function(){let text=$('ffText')?.value||'',out=$('ffMineOut'),stats=$('ffMineStats');if(!text.trim()){out.textContent='Önce metin gir.';return}let words=text.match(/[A-Za-z][A-Za-z'’-]*/g)||[],freq={};words.map(norm).filter(w=>w.length>1&&!STOP.has(w)).forEach(w=>freq[w]=(freq[w]||0)+1);let results=Object.entries(freq).map(([word,count])=>{let f=find(word);return{word,count,key:f?.key||word,found:!!f,e:f?.e||{}}}).sort((a,b)=>(b.found-a.found)||b.count-a.count).slice(0,300);window.FF_MINE=results;stats.style.display='grid';stats.innerHTML=`<div class="ff-stat"><b>${words.length}</b><span>TOPLAM</span></div><div class="ff-stat"><b>${Object.keys(freq).length}</b><span>FARKLI</span></div><div class="ff-stat"><b>${results.length}</b><span>ADAY</span></div><div class="ff-stat"><b>${results.filter(x=>x.found).length}</b><span>SÖZLÜKTE</span></div>`;out.innerHTML=`<div class="ff-list">${results.map((r,i)=>{let m=(r.e.meanings||[]).slice(0,3).join(' • ')||'Sözlükte bulunamadı';return`<div class="ff-item"><div class="ff-body"><div class="ff-w">${i+1}. ${esc(r.key)}</div><div class="ff-m">${esc(m)}</div><div class="ff-chips"><span class="ff-chip">${r.count} kez</span>${r.e.pron?`<span class="ff-chip">Okunuş: ${esc(r.e.pron)}</span>`:''}${r.e.level?`<span class="ff-chip">CEFR: ${esc(r.e.level)}</span>`:''}</div></div><button class="ff-mini ff-green" onclick="ffAdd('${encodeURIComponent(r.key)}')">Ekle</button></div>`}).join('')}</div>`}
window.ffAdd=function(enc){let w=decodeURIComponent(enc),f=find(w),e=f?.e||{};let a=study();if(!a.some(x=>String(x.word||x.Kelime||x).toLowerCase()===w.toLowerCase())){a.push({word:w,Kelime:w,meanings:e.meanings||[],turkishPronunciation:e.pron||'',source:'free-mining',addedAt:new Date().toISOString()});write('studyWords',a)}seed(w,e);alert(w+' eklendi.')}
window.ffSample=function(){$('ffText').value='Language learners improve faster when they collect useful sentences from real conversations. This method is called sentence mining.';ffMine()}
window.ffClear=function(){$('ffText').value='';$('ffMineOut').textContent='Henüz analiz yapılmadı.';$('ffMineStats').style.display='none'}

function review(){let d=due(),all=read('smartReviewV2');$('ffRevC').innerHTML=`<div class="ff-grid"><div class="ff-stat"><b>${all.length}</b><span>TOPLAM</span></div><div class="ff-stat"><b>${d.length}</b><span>BUGÜN</span></div><div class="ff-stat"><b>${weak().length}</b><span>ZAYIF</span></div><div class="ff-stat"><b>${study().length}</b><span>ÇALIŞILACAK</span></div></div><div class="ff-card"><div class="ff-title">Bugünün Tekrarları</div>${d.length?`<div class="ff-list">${d.slice(0,30).map(x=>`<div class="ff-item"><div class="ff-body"><div class="ff-w">${esc(x.word)}</div><div class="ff-m">${esc(x.meaning||'')}</div></div><button class="ff-mini ff-green" onclick="updRev('${esc(x.word)}','easy')">Biliyorum</button><button class="ff-mini ff-orange" onclick="updRev('${esc(x.word)}','hard')">Zor</button><button class="ff-mini ff-ghost" onclick="updRev('${esc(x.word)}','again')">Tekrar</button></div>`).join('')}</div>`:'<div class="ff-sub">Bugün tekrar yok.</div>'}</div>`}
window.updRev=function(word,g){let a=read('smartReviewV2'),x=a.find(i=>i.word===word);if(!x)return;if(g==='easy'){x.correct=(x.correct||0)+1;x.ease=Math.min(3.2,(x.ease||2.5)+.15);x.interval=Math.max(2,Math.round((x.interval||1)*(x.ease||2.5)))}else{x.wrong=(x.wrong||0)+1;x.ease=Math.max(1.3,(x.ease||2.5)-.2);x.interval=g==='again'?0:1}let d=new Date();d.setDate(d.getDate()+Number(x.interval||0));x.due=d.toISOString().slice(0,10);write('smartReviewV2',a);review()}

function shadowHTML(){return`<div class="ff-card"><div class="ff-title">Shadowing cümlesi</div><input id="ffST" class="ff-input" value="Can I get some water?"><div class="ff-row"><button class="ff-btn ff-blue" onclick="shSpeak()">🔊 Dinle</button><button class="ff-btn ff-purple" onclick="shLoop()">🔁 Loop</button><button class="ff-btn ff-green" onclick="shRec()">🎤 Tekrar Et</button><button class="ff-btn ff-ghost" onclick="shStop()">Durdur</button></div><div class="ff-row"><button class="ff-pill active" onclick="shRate(.7,this)">Yavaş</button><button class="ff-pill" onclick="shRate(.9,this)">Normal</button><button class="ff-pill" onclick="shRate(1.1,this)">Hızlı</button></div></div><div class="ff-card"><div class="ff-title">Ritim</div><canvas id="ffSW" class="ff-canvas" width="720" height="100"></canvas><div id="ffSR" class="ff-sub">Dinle ve tekrar et.</div></div>`}
let rate=.7,loop=null;window.shRate=function(r,b){rate=r;document.querySelectorAll('#ffShad .ff-pill').forEach(x=>x.classList.remove('active'));b.classList.add('active')}
window.shSpeak=function(){let t=$('ffST').value;try{speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(t);u.lang='en-US';u.rate=rate;speechSynthesis.speak(u)}catch(e){}drawWave('ffSW',wave(t),'Hedef');$('ffSR').textContent='Hedef okundu. Aynı ritimle tekrar et.'}
window.shLoop=function(){shStop();shSpeak();loop=setInterval(shSpeak,4500)};window.shStop=function(){try{speechSynthesis.cancel()}catch(e){};if(loop)clearInterval(loop)}
window.shRec=async function(){let start=performance.now(),t=$('ffST').value;try{let stream=await navigator.mediaDevices.getUserMedia({audio:true});let rec=new MediaRecorder(stream);rec.start();$('ffSR').textContent='3 saniye kayıt alınıyor...';setTimeout(()=>{rec.stop();stream.getTracks().forEach(x=>x.stop());let dur=(performance.now()-start)/1000,target=Math.max(.8,t.length*.055/rate),score=Math.max(0,Math.round(100-Math.abs(target-dur)/Math.max(target,dur)*120));drawWave('ffSW',wave(t+dur),'Sen');$('ffSR').innerHTML=`Ritim skoru: <b style="color:#86efac">${score}%</b><br>${score<70?'Hedef süreye daha yakın söyle.':'Güzel ritim!'}`},3000)}catch(e){alert('Mikrofon izni alınamadı.')}}
function wave(t){let seed=0;for(let i=0;i<t.length;i++)seed+=t.charCodeAt(i);return Array.from({length:360},(_,i)=>Math.sin(i/(8+seed%7))*Math.sin(Math.PI*i/360)*(0.4+((i+seed)%17)/50))}
function drawWave(id,w,label){let c=$(id);if(!c)return;let ctx=c.getContext('2d'),W=c.width,H=c.height;ctx.fillStyle='#070b16';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#334155';ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();if(!w.length){ctx.fillStyle='#64748b';ctx.textAlign='center';ctx.fillText(label||'wave',W/2,H/2);return}ctx.strokeStyle='#22c55e';ctx.lineWidth=2;ctx.beginPath();w.forEach((v,i)=>{let x=i*W/w.length,y=H/2-v*H*.42;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke()}

document.addEventListener('DOMContentLoaded',()=>ensureUI());setTimeout(ensureUI,1000);
})();



/* AI buttons safety for free feature panels */
(function(){
  document.addEventListener('click', async function(e){
    const btn = e.target.closest('[data-ai-prompt]');
    if(!btn) return;
    e.preventDefault();
    const prompt = btn.getAttribute('data-ai-prompt') || '';
    const targetId = btn.getAttribute('data-ai-target') || '';
    const target = document.getElementById(targetId);
    if(target) target.innerHTML = '🤖 AI açıklaması hazırlanıyor...';
    try{
      const txt = await window.WM_safeAI(prompt);
      if(target) window.WM_renderAIText(target, txt);
    }catch(err){
      if(target) target.innerHTML = '❌ AI hatası: ' + (err.message || err);
    }
  });
})();

/* WORD MODE FREE FEATURES — CÜMLE TABANLI PANEL OVERRIDE v5 */
(function(){
  if(window.__WM_FF_SENTENCE_ONLY_V5__) return; window.__WM_FF_SENTENCE_ONLY_V5__=true;
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function core(){return window.WMSentenceCore}
  function ensure(){
    if($('ffFabs')) return;
    document.body.insertAdjacentHTML('beforeend',`<div id="ffFabs" class="ff-fabs"><button class="ff-fab" onclick="ffOpen('dash')">📊 Panel</button><button class="ff-fab" onclick="ffOpen('rev')">🧠 Cümle Tekrar</button><button class="ff-fab" onclick="ffOpen('shad')">🎧 Shadow</button></div><div id="ffDash" class="ff-ov"><div class="ff-wrap"><div class="ff-top"><button class="ff-close" onclick="ffClose('dash')">← Kapat</button><h2>📊 Cümle Dashboard</h2></div><div id="ffDashC"></div></div></div><div id="ffRev" class="ff-ov"><div class="ff-wrap"><div class="ff-top"><button class="ff-close" onclick="ffClose('rev')">← Kapat</button><h2>🧠 Cümle Smart Review</h2></div><div id="ffRevC"></div></div></div><div id="ffShad" class="ff-ov"><div class="ff-wrap"><div class="ff-top"><button class="ff-close" onclick="ffClose('shad')">← Kapat</button><h2>🎧 Shadowing Studio</h2></div><div class="ff-card"><input id="ffST" class="ff-input" value="Can I get some water?"><div class="ff-row"><button class="ff-btn ff-blue" onclick="shSpeak&&shSpeak()">🔊 Dinle</button><button class="ff-btn ff-ghost" onclick="shStop&&shStop()">Durdur</button></div></div></div></div>`);
  }
  window.ffOpen=function(w){ensure();['ffDash','ffRev','ffShad'].forEach(id=>$(id)?.classList.remove('active')); const id={dash:'ffDash',rev:'ffRev',shad:'ffShad'}[w]; if($(id)){$(id).classList.add('active');document.body.style.overflow='hidden';} if(w==='dash')dash(); if(w==='rev')rev();}
  window.ffClose=function(w){const id={dash:'ffDash',rev:'ffRev',shad:'ffShad'}[w]; if($(id))$(id).classList.remove('active'); document.body.style.overflow='';}
  function dash(){const c=core(); const arr=Array.isArray(window.allWords)?window.allWords:[]; const s=c?c.sentenceStats():{total:arr.length,learned:0,due:0,unseen:arr.length}; const due=arr.filter(x=>c&&c.isDueSentence(x)).slice(0,10); $('ffDashC').innerHTML=`<div class="ff-grid"><div class="ff-stat"><b>${s.total}</b><span>CÜMLE</span></div><div class="ff-stat"><b>${s.learned}</b><span>ÖĞRENİLDİ</span></div><div class="ff-stat"><b>${s.due}</b><span>TEKRAR</span></div><div class="ff-stat"><b>${s.unseen}</b><span>YENİ</span></div></div><div class="ff-card"><div class="ff-title">⚠️ Bugün unutma riski yüksek cümleler</div>${due.length?due.map((x,i)=>`<div class="ff-item"><div class="ff-body"><div class="ff-w">${i+1}. ${esc(x.word||'')}</div><div class="ff-m">${esc(x.sentence||'')}</div></div></div>`).join(''):'<div class="ff-sub">Bugün acil tekrar yok.</div>'}</div>`;}
  function rev(){const c=core(); const arr=Array.isArray(window.allWords)?window.allWords:[]; const due=arr.filter(x=>c&&c.isDueSentence(x)); $('ffRevC').innerHTML=`<div class="ff-card"><div class="ff-title">Bugünün cümle tekrarları</div>${due.length?due.map((x,i)=>`<div class="ff-item"><div class="ff-body"><div class="ff-w">${esc(x.word||'')}</div><div class="ff-m">${esc(x.sentence||'')}</div></div><button class="ff-mini ff-green" onclick="goToWord(${arr.indexOf(x)}, allWords);ffClose('rev');showScreen('sc-word')">Aç</button></div>`).join(''):'<div class="ff-sub">Bugün tekrar yok.</div>'}</div>`;}
})();
