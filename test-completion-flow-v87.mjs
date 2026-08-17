import fs from "node:fs";
function read(f){return fs.readFileSync(new URL(f,import.meta.url),"utf8");}
function ok(v,m){if(!v)throw new Error("FAIL: "+m);console.log("✓ "+m);}
const practice=read("./practice.html");
const report=read("./gemini-report.js");
const teacher=read("./gemini-sohbet-rapor.js");
const core=read("./chat-core.js");
const page=read("./hata-defteri.html");
const sw=read("./sw.js");
ok(practice.includes("Bunu tekrar sorma")&&practice.includes("practiceNeverAsk"),"practice kalıcı tekrar sormama düğmesi sunuyor");
ok(practice.includes('dh-tekrar-yoksay-v1')&&practice.includes('delete(modePrefix()+s.id)'),"practice yoksayılan cümleyi SRS ve kuyruktan çıkarıyor");
ok(/if\(grade==="easy"\) d\.parts=tokenize\(answer\)/.test(practice),"doğru alternatif cevap kırmızı fark olarak gösterilmiyor");
ok(report.includes('"aren\'t":"are not"')&&report.includes("expanded(got)===expanded(want)"),"karne daraltmaları analiz motoru olmasa da eşdeğer görüyor");
ok(report.includes('dh-gemini-daily-complete-')&&report.includes('hata-defteri.html?gemini=gunluk'),"üç doğru karne koç adımını da tamamlıyor");
ok(core.includes("DHChatTasks")&&core.includes("completeAll"),"sohbet görevleri rapor tarafından tamamlanabilir");
ok(teacher.includes("sohbetiTamamla(d)")&&teacher.includes('d.hedefUlasildi !== true'),"yalnız olumlu Gemini raporu sohbeti tamamlıyor");
ok(teacher.includes('DHPlan.tamamlaTip("sohbet")')&&teacher.includes('dh-speaking-complete-'),"olumlu rapor koç ve günlük plan kanıtlarını kapatıyor");
ok(page.includes("gemini-report.js?v=3")&&/dh-sw-v(?:8[7-9]|9\d+)/.test(sw),"mobil önbellek yeni düzeltmelere yükseltildi");
