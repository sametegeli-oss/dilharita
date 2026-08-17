/* AI cevap hafızası — girdi aynıysa prompt değişse de eski cevabı korur. */
(function(global){
"use strict";
if(global.DHAIResponseCache)return;
var STORE="dh-ai-response-cache-v1",LIMIT=80;
function stable(v){if(v===null||typeof v!=="object")return JSON.stringify(v);if(Array.isArray(v))return "["+v.map(stable).join(",")+"]";return "{"+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+":"+stable(v[k]);}).join(",")+"}";}
function hash(s){s=String(s||"");var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36)+"-"+s.length;}
function all(){try{return JSON.parse(localStorage.getItem(STORE)||"{}")||{};}catch(e){return{};}}
function save(db){try{var rows=Object.keys(db).map(function(k){return db[k];}).sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0);});if(rows.length>LIMIT)rows.slice(LIMIT).forEach(function(r){delete db[r.id];});localStorage.setItem(STORE,JSON.stringify(db));return true;}catch(e){return false;}}
function identity(type,input){return String(type||"general")+":"+hash(stable(input));}
function promptHash(prompt){return hash(String(prompt||""));}
function get(type,input,prompt){var id=identity(type,input),r=all()[id];if(!r||!r.text)return null;return{record:r,promptChanged:!!(r.promptHash&&r.promptHash!==promptHash(prompt))};}
function put(type,input,prompt,text,label){text=String(text||"").trim();if(!text)return null;var db=all(),id=identity(type,input),now=Date.now();db[id]={id:id,type:String(type||"general"),inputHash:id.split(":").slice(1).join(":"),promptHash:promptHash(prompt),text:text,label:String(label||""),createdAt:(db[id]&&db[id].createdAt)||now,updatedAt:now};save(db);return db[id];}
function remove(type,input){var db=all(),id=identity(type,input);delete db[id];save(db);}
function stats(){var db=all(),bytes=0;Object.keys(db).forEach(function(k){bytes+=JSON.stringify(db[k]).length*2;});return{count:Object.keys(db).length,bytes:bytes};}
function clear(){try{localStorage.removeItem(STORE);}catch(e){}}
global.DHAIResponseCache={get:get,put:put,remove:remove,clear:clear,stats:stats,identity:identity,stable:stable};
})(window);
