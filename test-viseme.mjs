/* test-viseme.mjs — dile duyarlı ağız hareketleri */
import fs from "node:fs";
let fail=0; const ok=(c,m)=>{console.log(`  ${c?"✓":"✗ BAŞARISIZ"}  ${m}`); if(!c)fail++;};
global.window={};
eval(fs.readFileSync("viseme-lang.js","utf8"));
const V=global.window.DHViseme;
const sh=(t,d)=>V.shapes(t,d).map(x=>x.shape);
const lg=t=>V.shapes(t).map(x=>x.lang);

console.log("\n--- dil tespiti ---");
ok(V.langOf("gülüyor")==="tr", "Türkçe harf içeren kelime tr");
ok(V.langOf("çalışmak")==="tr", "ç/ş içeren kelime tr");
ok(V.langOf("work")==="en", "w içeren kelime en");
ok(V.langOf("the")==="en", "İngilizce fonksiyon kelimesi en");
ok(V.langOf("finish")==="en", "sh ikilisi en");
ok(V.langOf("kalem")==="tr", "sade Türkçe kelime tr");

console.log("\n--- [[ ]] blokları İngilizce sayılıyor ---");
const karma=V.shapes("Doğru cevap: [[It was late.]] Anladın mı?");
ok(karma.some(x=>x.lang==="en"), "parantez içi en olarak işaretlendi");
ok(karma.some(x=>x.lang==="tr"), "dışarısı tr kaldı");

console.log("\n--- Türkçe'ye özgü harfler (eskiden hepsi varsayılana düşüyordu) ---");
ok(sh("şu")[0]==="u", "ş dudak ileri (u)");
ok(sh("cam")[0]==="u", "c dudak ileri (u)");
ok(sh("çok")[0]==="u", "ç dudak ileri (u)");
ok(sh("öl")[0]==="o", "ö yuvarlak (o)");
ok(sh("ün")[0]==="u", "ü yuvarlak (u)");
ok(sh("ağ").length===1, "ğ ağzı değiştirmiyor (kare üretmiyor)");

console.log("\n--- İngilizce'ye özgü davranış ---");
ok(sh("think")[0]==="th", "th tek şekil");
ok(sh("shop")[0]==="u", "sh tek şekil, yuvarlak");
ok(sh("phone")[0]==="fv", "ph = f sesi");
const like=sh("like","en");
ok(like[like.length-1]!=="e", "sondaki sessiz e ağzı açmıyor");
ok(sh("red","en")[0]==="o", "İngilizce r dudak yuvarlıyor (bağlam dili en)");
ok(sh("rahat")[0]==="i", "Türkçe r nötr — aynı harf, farklı ağız");

console.log("\n--- aynı harf iki dilde farklı ---");
ok(V.shapes("rahat","tr")[0].shape !== V.shapes("red","en")[0].shape,
   "'r' Türkçe ve İngilizce'de farklı kare veriyor");
ok(V.langOf("red")==="tr" && V.langOf("red","en")==="en",
   "işaretsiz kısa kelime bağlam diline uyuyor (tahmine güvenilmiyor)");

console.log("\n--- kare eşleme ---");
const map={a:"A.webp",e:"E.webp",i:"I.webp",o:"O.webp",u:"U.webp",mbp:"M.webp",fv:"F.webp",l:"L.webp",th:"TH.webp",idle:"idle.webp"};
const seq=V.sequence("Merhaba [[think]]", map);
ok(seq.length>0 && seq.every(x=>x.endsWith(".webp")), "sequence() kare listesi döndürüyor");
ok(seq.includes("TH.webp"), "İngilizce th karesi dizide var");
const eksik=V.sequence("think",{i:"I.webp",e:"E.webp"});
ok(eksik.length>0, "eksik kare haritasında en yakınına düşüyor (çökmüyor)");

console.log("\n--- sağlamlık ---");
ok(V.shapes("").length===0, "boş metin");
ok(V.shapes(null).length===0, "null metin");
ok(V.sequence("test",null).length===0, "harita yoksa boş liste");

console.log(fail===0?"\nSONUÇ: tüm testler geçti ✓\n":`\nSONUÇ: ${fail} başarısız ✗\n`);
process.exit(fail?1:0);
