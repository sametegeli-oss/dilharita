import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const src=fs.readFileSync("ai-providers.js","utf8");
const store={
  nvidiaApiKeys:JSON.stringify(["nvapi-test"]),
  groqApiKeys:"[]",cerebrasApiKeys:"[]",geminiApiKeys:"[]",
  "dh-profile-v1":JSON.stringify({aiYontemi:"api"})
};
let fetchCount=0, bridgeOptions=null;
const context={
  window:null,console,Promise,setTimeout,clearTimeout,
  localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]},
  fetch:()=>{fetchCount++;return Promise.reject(new Error("NVIDIA API tarayıcıdan çağrılmamalı"));},
  document:{querySelector:()=>null,createElement:()=>({dataset:{},addEventListener(){}}),head:{appendChild(){}}},
  DHGemini:{parsers:{text:x=>x},ask(o){bridgeOptions=o;queueMicrotask(()=>o.onResult("ok"));return {close(){}};}}
};
context.window=context;
vm.runInNewContext(src,context);
const answer=await context.DHProviders.chat([{role:"user",content:"test"}],{});
assert.equal(answer,"ok");
assert.equal(fetchCount,0);
assert.equal(bridgeOptions.providerName,"NVIDIA Build");
assert.match(bridgeOptions.openUrl,/nemotron-3-super-120b-a12b\/playground/);
assert.equal(context.DHProviders.PROVIDERS[0].id,"gemini");
assert.equal(context.DHProviders.PROVIDERS.find(p=>p.id==="groq").model,"openai/gpt-oss-120b");
assert.equal(context.DHProviders.PROVIDERS.find(p=>p.id==="gemini").model,"gemini-3.6-flash");
console.log("AI provider CORS v125 tests passed");
