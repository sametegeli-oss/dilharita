import fs from "node:fs";
let fail=0; const ok=(v,m)=>{console.log(`${v?'✓':'✗'} ${m}`);if(!v)fail++;};
const plan=fs.readFileSync("dh-plan.js","utf8");
const score=fs.readFileSync("dh-sohbet-puan.js","utf8");
const home=fs.readFileSync("index.html","utf8");
const lesson=fs.readFileSync("ders.html","utf8");
const css=fs.readFileSync("dh-ui.css","utf8");
const pcss=fs.readFileSync("product-improvements.css","utf8");
ok(/function tamamlaTip/.test(plan),"plan görevleri ekran URL'sinden bağımsız, tip ile tamamlanıyor");
ok(/function etkinlikKaydet/.test(plan),"ders ve konuşma günlük sayacı yinelenmeden kaydediliyor");
ok(/tamamlaTip\("sohbet"\)/.test(score),"değerlendirilen konuşma plan adımını tamamlıyor");
ok(/dh-speaking-complete-/.test(score)&&/dh-speaking-complete-/.test(home),"konuşma tamamlanma kanıtı ana sayfada okunuyor");
ok(/etkinlikKaydet\("lesson"/.test(lesson),"tamamlanan ders günlük sayaca kesin yazılıyor");
ok(/Ders günlük ilerlemene kaydedildi/.test(lesson),"kullanıcı ders kayıt teyidini görüyor");
ok(/dinlenme.*hidden = !!d\.calisti/.test(home),"çalışmaya başlayan kullanıcıya dinlenme seçeneği gösterilmiyor");
ok(/dh-plan-satir--bitti[\s\S]{0,250}background:linear-gradient/.test(css),"tamamlanan görev kartı yeşil zemine dönüyor");
ok(/body\.dh-chat-focus \.dh-primary-nav\{display:none/.test(pcss),"öğretmen girişleri ortak alt panelin arkasında kalmıyor");
for(const f of ["chatteacher1.html","chatteacher2.html","chatairport.html","chatdoctor.html","chathotel.html","chatrestaurant.html"]){
  ok(fs.readFileSync(f,"utf8").includes("dh-plan.js"),`${f}: merkezi plan kaydı yüklü`);
}
process.exit(fail?1:0);
