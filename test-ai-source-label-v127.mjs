import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const src=fs.readFileSync("ai-providers.js","utf8");
const nodes={};
const body={appendChild(el){nodes[el.id]=el;el.remove=()=>delete nodes[el.id];}};
const store={geminiApiKeys:JSON.stringify(["AIza-test"]),groqApiKeys:"[]",cerebrasApiKeys:"[]",nvidiaApiKeys:"[]","dh-profile-v1":JSON.stringify({aiYontemi:"api"})};
const context={window:null,console,Promise,setTimeout,clearTimeout,CustomEvent:function(n,o){this.type=n;this.detail=o.detail;},
 localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]},
 document:{body,head:{appendChild(){}},querySelector:()=>null,getElementById:id=>nodes[id]||null,createElement:()=>({style:{}})},
 fetch:async()=>({ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:"yanıt"}]}}]})}),dispatchEvent(){}};
context.window=context;vm.runInNewContext(src,context);
assert.equal(await context.DHProviders.chat([{role:"user",content:"x"}],{}),"yanıt");
assert.equal(context.DHProviders.lastResponseInfo.provider,"gemini");
assert.equal(context.DHProviders.lastResponseInfo.model,"gemini-3.6-flash");
assert.match(nodes["dh-ai-source-badge"].textContent,/Gemini · gemini-3\.6-flash/);
console.log("AI source label v127 tests passed");
