/* AI cevap hafızası — girdi aynıysa prompt değişse de eski cevabı korur.
   ------------------------------------------------------------------
   v3 (16 Kasım): Hafıza localStorage yerine IndexedDB'de ("DilHaritaAICache").
   Neden: tek bir localStorage anahtarında ~1,1 MB tutuluyordu ve sitenin
   localStorage kotası (≈5-10 MB) doldu: giriş işareti dahil hiçbir kayıt
   yazılamıyor, giriş ↔ ana sayfa döngüsü oluşuyordu.
   API aynı kaldı (get/put senkron): kayıtlar açılışta belleğe okunur, yazmalar
   arka planda IndexedDB'ye gider. Eski localStorage kaydı bir kez taşınıp silinir.
   DHAIResponseCache.ready → bellek IndexedDB'den yüklendiğinde çözülür. */
(function(global){
"use strict";
if(global.DHAIResponseCache)return;
var OLD_STORE="dh-ai-response-cache-v1",LIMIT=250,DB_NAME="DilHaritaAICache",OS="responses";
var mem={};
function stable(v){if(v===null||typeof v!=="object")return JSON.stringify(v);if(Array.isArray(v))return "["+v.map(stable).join(",")+"]";return "{"+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+":"+stable(v[k]);}).join(",")+"}";}
function hash(s){s=String(s||"");var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36)+"-"+s.length;}
function identity(type,input){return String(type||"general")+":"+hash(stable(input));}
function promptHash(prompt){return hash(String(prompt||""));}

var dbPromise=null;
function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise(function(resolve,reject){
    if(!global.indexedDB){reject(new Error("IndexedDB yok"));return;}
    var r=indexedDB.open(DB_NAME,1);
    r.onupgradeneeded=function(){var db=r.result;if(!db.objectStoreNames.contains(OS)){var st=db.createObjectStore(OS,{keyPath:"id"});st.createIndex("updatedAt","updatedAt");}};
    r.onsuccess=function(){resolve(r.result);};
    r.onerror=function(){reject(r.error||new Error("AI hafızası açılamadı"));};
  });
  dbPromise.catch(function(){dbPromise=null;});
  return dbPromise;
}
function idbPut(rows){return openDb().then(function(db){return new Promise(function(res){var tx=db.transaction(OS,"readwrite"),st=tx.objectStore(OS);rows.forEach(function(r){st.put(r);});tx.oncomplete=function(){res(true);};tx.onerror=tx.onabort=function(){res(false);};});}).catch(function(){return false;});}
function idbDel(ids){return openDb().then(function(db){return new Promise(function(res){var tx=db.transaction(OS,"readwrite"),st=tx.objectStore(OS);ids.forEach(function(id){st.delete(id);});tx.oncomplete=function(){res(true);};tx.onerror=tx.onabort=function(){res(false);};});}).catch(function(){return false;});}
function idbAll(){return openDb().then(function(db){return new Promise(function(res){var q=db.transaction(OS,"readonly").objectStore(OS).getAll();q.onsuccess=function(){res(Array.isArray(q.result)?q.result:[]);};q.onerror=function(){res([]);};});}).catch(function(){return null;});}
function idbClear(){return openDb().then(function(db){return new Promise(function(res){var tx=db.transaction(OS,"readwrite");tx.objectStore(OS).clear();tx.oncomplete=function(){res(true);};tx.onerror=function(){res(false);};});}).catch(function(){return false;});}

/* Kayıt sayısı sınırı: en eski kayıtlar atılır. */
function trim(){var rows=Object.keys(mem).map(function(k){return mem[k];}).sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0);});if(rows.length<=LIMIT)return;var drop=rows.slice(LIMIT).map(function(r){return r.id;});drop.forEach(function(id){delete mem[id];});idbDel(drop);}

var ready=idbAll().then(function(rows){
  var idbVar=rows!==null;
  (rows||[]).forEach(function(r){if(r&&r.id)mem[r.id]=r;});
  /* Eski localStorage hafızasını bir kez taşı, sonra sil (yer açılsın). */
  var old=null;try{old=JSON.parse(localStorage.getItem(OLD_STORE)||"null");}catch(e){}
  if(old&&typeof old==="object"){
    var add=[];Object.keys(old).forEach(function(k){var r=old[k];if(r&&r.id&&r.text&&(!mem[r.id]||(+r.updatedAt||0)>(+mem[r.id].updatedAt||0))){mem[r.id]=r;add.push(r);}});
    if(!idbVar)return true; /* IndexedDB yoksa eski kayıt yerinde kalsın */
    return idbPut(add).then(function(ok){if(ok){try{localStorage.removeItem(OLD_STORE);}catch(e){}}trim();return true;});
  }
  trim();return true;
}).catch(function(){return false;});

function get(type,input,prompt){var id=identity(type,input),r=mem[id];if(!r||!r.text)return null;try{if(global.DHProviders&&DHProviders.showSource)DHProviders.showSource(r.source||{provider:"unknown",label:"AI",model:"Eski kayıtta model bilgisi yok",at:r.updatedAt||r.createdAt},true);}catch(e){}return{record:r,promptChanged:!!(r.promptHash&&r.promptHash!==promptHash(prompt))};}
function put(type,input,prompt,text,label,source){text=String(text||"").trim();if(!text)return null;var id=identity(type,input),now=Date.now();if(!source)try{source=global.DHProviders&&DHProviders.lastResponseInfo;}catch(e){}var row={id:id,type:String(type||"general"),inputHash:id.split(":").slice(1).join(":"),promptHash:promptHash(prompt),text:text,label:String(label||""),source:source||null,createdAt:(mem[id]&&mem[id].createdAt)||now,updatedAt:now};mem[id]=row;idbPut([row]);trim();return row;}
function remove(type,input){var id=identity(type,input);delete mem[id];idbDel([id]);}
function stats(){var bytes=0;Object.keys(mem).forEach(function(k){bytes+=JSON.stringify(mem[k]).length*2;});return{count:Object.keys(mem).length,bytes:bytes};}
function clear(){mem={};idbClear();try{localStorage.removeItem(OLD_STORE);}catch(e){}}
global.DHAIResponseCache={get:get,put:put,remove:remove,clear:clear,stats:stats,identity:identity,stable:stable,ready:ready};
})(window);
