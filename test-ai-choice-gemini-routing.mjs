import fs from "node:fs";
function read(f){return fs.readFileSync(new URL(f,import.meta.url),"utf8");}
function ok(v,m){if(!v)throw new Error("FAIL: "+m);console.log("✓ "+m);}
const providers=read("./ai-providers.js"), choice=read("./ai-choice.js"), start=read("./basla.html"), home=read("./index.html");
const review=read("./tekrar.html"), practice=read("./practice.html"), photo=read("./foto-ekle.html"), ocr=read("./ocr-sentence.html"), chat=read("./chat-core.js"), score=read("./dh-sohbet-puan.js"), sw=read("./sw.js");
ok(choice.includes("API anahtarım var")&&choice.includes("Anahtar kullanmayacağım"),"profil iki AI yöntemini soruyor");
ok(start.includes("ai-choice.js")&&home.includes("ai-choice.js"),"yeni ve eski kullanıcıya başlangıçta tercih gösteriliyor");
ok(providers.includes('aiYontemi==="api"')&&providers.includes('aiYontemi==="gemini"'),"merkezi yönlendirici profil tercihini okuyor");
ok(providers.includes("chatViaGemini")&&providers.includes("ensureGeminiBridge"),"anahtarsız istek Gemini kopyala-yapıştır köprüsüne gidiyor");
ok(providers.includes("realHasAnyKey")&&providers.includes('return aiMode()==="gemini" || realHasAnyKey()'),"Gemini modu AI işlevleri için kullanılabilir sayılıyor");
ok(review.includes("AI hakem ASLA otomatik calismaz")&&review.includes("💎 Gemini ile kontrol et"),"tekrar cümlesinde AI yalnız kullanıcı düğmesiyle çalışıyor");
ok(practice.includes("DHProviders.mode")&&practice.includes("Gemini ile kontrol et"),"practice cümle denetimi profil tercihini gösteriyor");
ok(photo.includes("DHProviders.chat")&&ocr.includes("DHProviders.chat"),"fotoğraf/OCR metin işlemleri ortak yönlendiriciyi kullanıyor");
ok(chat.includes("DHProviders.hasAnyKey")&&score.includes("DHProviders.chat"),"sohbet ve puanlama Gemini web modunda çalışabiliyor");
ok(/dh-sw-v(?:89|9\d+)/.test(sw)&&sw.includes('"./ai-choice.js"')&&sw.includes('"./gemini-bridge.js"'),"yeni tercih ve Gemini köprüsü mobil önbelleğe alındı");
