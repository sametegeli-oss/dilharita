/* renderBubbleText() — [[ ]] ekrandan kalkıyor mu, metin korunuyor mu? */
import fs from "node:fs";
let fail=0; const ok=(c,m)=>{console.log(`  ${c?"✓":"✗ BAŞARISIZ"}  ${m}`); if(!c)fail++;};
const src=fs.readFileSync("chat-core.js","utf8");
/* renderBubbleText kalın yazı ayrıştırıcısını kullanır; gerçek tarayıcıdaki
   fonksiyon grubunu birlikte yükle. Tek fonksiyonu koparmak sahte hata üretiyordu. */
const i=src.indexOf("function dhKalinParcala");
const end=src.indexOf("function addBubble", i);
const fn=src.slice(i, end);

/* minik DOM taklidi */
class N{constructor(t=""){this.nodeText=t;this.children=[];this.className="";}
  appendChild(c){this.children.push(c);return c;}
  set textContent(v){this.nodeText=v;this.children=[];}
  get textContent(){return this.children.length?this.children.map(c=>c.textContent).join(""):this.nodeText;}}
global.document={createTextNode:t=>new N(t),createElement:()=>new N("")};
eval(fn + "\nglobalThis.renderBubbleText = renderBubbleText;");

const ham='Yakındın, ama küçük bir hata var. Doğru cevap: [[It was such a lot of work that I couldn\'t finish.]] "It was" ile başlaman gerekli.';
const n=new N(); renderBubbleText(n, ham);
ok(!n.textContent.includes("[["), "ekranda [[ kalmıyor");
ok(!n.textContent.includes("]]"), "ekranda ]] kalmıyor");
ok(n.textContent.includes("It was such a lot of work"), "İngilizce cümle korunuyor");
ok(n.textContent.includes("Yakındın, ama küçük bir hata var"), "Türkçe metin korunuyor");
const enler=n.children.filter(c=>c.className==="en-chunk");
ok(enler.length===1, `İngilizce bölüm ayrı işaretlendi (${enler.length} adet)`);
ok(enler[0] && enler[0].textContent==="It was such a lot of work that I couldn't finish.", "işaretlenen metin doğru");

const cok=new N(); renderBubbleText(cok,"Şöyle de olur: [[I was late.]] veya [[He was tired.]] Deneyelim.");
ok(cok.children.filter(c=>c.className==="en-chunk").length===2, "birden fazla İngilizce blok işleniyor");
const bos=new N(); renderBubbleText(bos,"Hiç parantez yok.");
ok(bos.textContent==="Hiç parantez yok.", "parantezsiz metin bozulmuyor");

console.log(fail===0?"\nSONUÇ: tüm testler geçti ✓\n":`\nSONUÇ: ${fail} başarısız ✗\n`);
process.exit(fail?1:0);
