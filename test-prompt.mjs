/* test-prompt.mjs — Gemini hakem prompt'u hem ayrıştırılabilir hem öğretici mi? */
import fs from "node:fs";
let fail=0; const ok=(c,m)=>{console.log(`  ${c?"✓":"✗ BAŞARISIZ"}  ${m}`); if(!c)fail++;};
const s=fs.readFileSync("tekrar.html","utf8");
const m=/var defaultAiPrompt = "([\s\S]*?)";\n/.exec(s);
const P=m ? JSON.parse('"'+m[1]+'"') : "";

console.log("\n--- çelişki gitti mi ---");
ok(P.length>0, "varsayılan prompt okunabiliyor");
ok(!/Başka hiçbir açıklama yapma/.test(P), "'Başka hiçbir açıklama yapma' kaldırıldı");
ok(!/SADECE tek kelimeyle cevap ver/.test(P), "'sadece tek kelime' dayatması kaldırıldı");

console.log("\n--- hakemlik korunuyor (kod ilk kelimeyi ayrıştırıyor) ---");
ok(/İlk kelime SADECE/.test(P), "ilk kelime kuralı duruyor");
ok(/EVET/.test(P)&&/YAZIM/.test(P)&&/HAYIR/.test(P), "üç karar da tanımlı");
const ek=/Cevabına MUTLAKA tek kelimeyle başla[\s\S]{0,400}?;/.exec(s);
ok(!!ek, "istek anında da ilk-kelime hatırlatması ekleniyor");

console.log("\n--- artık öğretiyor ---");
ok(/NEDEN yanlış|neden böyle/i.test(P), "kuralın NEDENİ isteniyor");
ok(/örnek daha/i.test(P), "aynı kuralla ikinci örnek isteniyor");
ok(/Doğru cümleyi yaz/i.test(P), "doğru cümle isteniyor");
ok(/geçiştirme/i.test(P), "tek satırla geçiştirme yasaklandı");

console.log("\n--- adil değerlendirme kuralları korundu ---");
ok(/roundabot/.test(P), "typo örneği duruyor");
ok(/automobile/.test(P), "eş anlamlı kabul kuralı duruyor");
ok(/tense/i.test(P), "tense uyumsuzluğu ölçütü duruyor");

console.log("\n--- görüntüleme ---");
ok(!/note\.slice\(0,400\)/.test(s), "400 karakter kesme kaldırıldı");
ok((s.match(/note\.slice\(0,2000\)/g)||[]).length===2, "iki dalda da 2000 karaktere çıkarıldı");
ok(/white-space:pre-wrap/.test(s), "madde madde metin için satır sonları korunuyor");

console.log("\n--- eski kayıtlı prompt göçü ---");
ok(/Başka hiçbir açıklama yapma\|SADECE tek kelimeyle cevap ver/.test(s),
   "eski varsayılanı kaydetmiş kullanıcı yenisine geçiriliyor");
ok(/Kullanıcının kendi yazdığı özel prompt'a DOKUNULMUYOR/.test(s),
   "özel yazılmış prompt korunuyor");

console.log(fail===0?"\nSONUÇ: tüm testler geçti ✓\n":`\nSONUÇ: ${fail} başarısız ✗\n`);
process.exit(fail?1:0);
