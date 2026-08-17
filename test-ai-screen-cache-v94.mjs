import fs from "node:fs";
const read=f=>fs.readFileSync(f,"utf8");let fail=0;function ok(v,m){console.log((v?"✓ ":"✗ ")+m);if(!v)fail++;}
const p=read("ai-providers.js"),t=read("teacher.html"),g=read("gemini-bridge.js"),sw=read("sw.js");
ok(p.includes("opts.cacheType")&&p.includes("cache.get(opts.cacheType"),"ortak AI yönlendiricisi girdi temelli kayıtları okuyor");
ok(t.includes('indexedDB.open("DilHaritaAI_DB",1)')&&t.includes('cacheType:"teacher-explanation"'),"öğretmen index-app kaydını ve ortak hafızayı kullanıyor");
ok(t.includes("forceRefresh:!!forceRefresh")&&t.includes("explain(true)"),"yalnız kullanıcı yeniden gönder dediğinde kayıt atlanıyor");
ok(g.includes('replace(/\\[\\[\\s*([\\s\\S]*?)\\s*\\]\\]/g,"`$1`")'),"ham çift köşeli örnekler ortak Markdown biçimleyicide temizleniyor");
for(const [f,k] of [["foto-ekle.html","photo-sentences"],["ocr-sentence.html","ocr-sentence-check"],["hata-defteri.html","error-book-batch"],["modul-testi.html","module-test-evaluation"],["practice.html","practice-answer-evaluation"],["tekrar.html","review-answer-evaluation"],["koc.js","coach-profile-analysis"],["coach-bubble.js","coach-topic-explanation"],["seviye-testi.html","level-test-evaluation"]])ok(read(f).includes('cacheType:"'+k+'"'),f+" sabit AI sonucu ortak hafızada");
ok(/dh-sw-v(?:9[4-9]|[1-9][0-9]{2,})/.test(sw),"mobil önbellek sürümü yükseltildi");process.exit(fail?1:0);
