/* test-senkron.mjs — ağız/ses senkronu */
import fs from "node:fs";
let fail=0; const ok=(c,m)=>{console.log(`  ${c?"✓":"✗ BAŞARISIZ"}  ${m}`); if(!c)fail++;};
const cc=fs.readFileSync("chat-core.js","utf8");
/* Ana ekran ağız oynatıcısı artık index.html içine gömülü değil; ortak ve
   requestAnimationFrame tabanlı dh-avatar.js kullanılıyor. */
const ix=fs.readFileSync("dh-avatar.js","utf8");

console.log("\n--- döngü kaldırıldı (asıl hata) ---");
ok(!/talkSeq\[this\.talkIndex % this\.talkSeq\.length\]/.test(cc),
   "chat-core: '% talkSeq.length' başa dönüşü kaldırıldı");
ok(!/seq\[si%seq\.length\]/.test(ix),
   "index.html: '% seq.length' başa dönüşü kaldırıldı");
ok(/talkIndex >= this\.talkSeq\.length/.test(cc), "chat-core: dizi bitince duruyor");
ok(/if \(oran >= 1\)/.test(ix), "ana ekran avatarı: zaman çizgisi bitince duruyor");

console.log("\n--- kare süresi artık sabit değil ---");
ok(!/\}, 105\);/.test(cc), "chat-core: sabit 105 ms gitti");
const sm=ix.slice(ix.indexOf("function konus("), ix.indexOf("function sustur("));
ok(!/setInterval/.test(sm), "ana ekran avatarı: sürüklenen setInterval yok");
ok(/requestAnimationFrame\(adim\)/.test(sm), "ana ekran avatarı: rAF zaman çizgisi kullanılıyor");
ok(/_total \/ Math\.max\(1, this\.talkSeq\.length\)/.test(cc), "chat-core: süre / kare sayısı");
ok(/gecen \/ toplam/.test(ix), "ana ekran avatarı: gerçek geçen süre/toplam süre oranı");

console.log("\n--- onboundary hizalaması ---");
ok(/u\.onboundary/.test(cc), "chat-core: onboundary bağlandı");
ok(/utter\.onboundary/.test(ix), "ana ekran avatarı: onboundary bağlandı");
ok(/alignToChar\(charIndex\)/.test(cc), "chat-core: alignToChar() var");
ok(/cizgi\[k\]\.ci <= ci/.test(ix), "ana ekran avatarı: harf konumuna göre hizalanıyor");
ok(/Math\.abs\(hedef - this\.talkIndex\) > 2/.test(cc), "küçük sapmalar düzeltilmiyor (titreme olmasın)");

console.log("\n--- adım süresi hesabı makul mü ---");
const step=(total,n)=>Math.max(40,Math.min(170,Math.round(total/Math.max(1,n))));
ok(step(3000,45)===67, `45 karelik 3 sn -> ${step(3000,45)} ms/kare`);
ok(step(1200,60)===40, `60 karelik 1,2 sn tabanda kalıyor -> ${step(1200,60)} ms`);
ok(step(9000,20)===170, `20 karelik 9 sn tavanda kalıyor -> ${step(9000,20)} ms`);
ok(step(1000,0)>=40, "sıfır kare çökertmiyor");

console.log("\n--- emoji ayıklanmış metin ---");
ok(/var sesMetni = String\(metin \|\| ""\)\.replace/.test(ix), "ana ekran avatarı: emoji ayıklanmış ses metni var");
ok(/sesMetni\.length \* 62/.test(ix), "süre ekrandaki metne değil, okunan metne göre");

console.log("\n--- noktalamada ağız duruyor mu ---");
global.window={};
eval(fs.readFileSync("viseme-lang.js","utf8"));
const V=global.window.DHViseme;
const MAP={a:"A",e:"E",i:"I",o:"O",u:"U",mbp:"M",fv:"F",l:"L",th:"T",idle:"-"};
const kuyruk = t => V.timeline(t, MAP, "tr").frames.join("");
const noktasiz=kuyruk("aba aba"), nokta=kuyruk("aba. aba");
ok(nokta.length > noktasiz.length + 4,
   `nokta ~6 dinlenme karesi ekliyor (${noktasiz.length} -> ${nokta.length})`);
const virgul=kuyruk("aba, aba");
ok(virgul.length > noktasiz.length + 1 && virgul.length < nokta.length,
   `virgül noktadan kısa duruyor (${virgul.length} vs ${nokta.length})`);
ok(kuyruk("aba? aba").length === nokta.length, "soru işareti nokta kadar duruyor");
ok(kuyruk("aba! aba").length === nokta.length, "ünlem de nokta kadar");
ok(/-{5,}/.test(nokta), "duraklama gerçekten ARDIŞIK dinlenme karesi (ağız kapalı kalıyor)");

console.log("\n--- kare/harf eşlemesi hizalama için doğru mu ---");
const tl=V.timeline("aba. xyz", MAP, "tr");
ok(tl.frames.length===tl.charAt.length, "her kare bir harf konumu taşıyor");
ok(tl.charAt.every((c,i)=>i===0||c>=tl.charAt[i-1]), "harf konumları azalmıyor");
const iX=V.indexForChar(tl.charAt, tl.charAt[tl.charAt.length-1]);
ok(iX>0, "indexForChar son harfi bulabiliyor");
ok(V.indexForChar([],5)===0, "boş eşleme çökertmiyor");
ok(V.indexForChar(tl.charAt, 99999)===tl.frames.length-1, "metin sonu son kareye düşüyor");

console.log("\n--- oynatıcılar konum tabanlı hizalamaya geçti mi ---");
ok(/alignToChar/.test(cc), "chat-core: alignToChar kullanıyor");
ok(/talkCharAt/.test(cc), "chat-core: kare/harf eşlemesini saklıyor");
ok(/cizgi\[k\]\.ci <= ci/.test(ix), "ana ekran avatarı: kare/harf konumunu kullanıyor");
ok(/gercekToplam/.test(cc), "chat-core: gerçek konuşma hızını ölçüp adımı düzeltiyor");
ok(/ci>=chunks\.length && run===speechRun\) avatar\.stop\(\)/.test(cc),
   "son parça bitince ağız ANINDA duruyor");

console.log(fail===0?"\nSONUÇ: tüm testler geçti ✓\n":`\nSONUÇ: ${fail} başarısız ✗\n`);
process.exit(fail?1:0);
