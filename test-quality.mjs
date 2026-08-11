import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const html=fs.readdirSync(root).filter(f=>f.endsWith(".html"));
const failures=[];
function check(ok,message){
  if(ok) console.log("  ✓ "+message);
  else {console.error("  ✗ "+message);failures.push(message);}
}

console.log("\n--- ortak deneyim ve erişilebilirlik ---");
const priority=["index.html","chat.html","chatteacher.html","aktivite.html","ilerleme.html","rapor.html","library.html","practice.html","tekrar.html"];
for(const file of priority){
  const src=fs.readFileSync(path.join(root,file),"utf8");
  check(/ux-boost\.js|dh-app-shell\.js|auth-guard\.js/.test(src),file+" ortak çalışma katmanına bağlı");
}
const shell=fs.readFileSync(path.join(root,"dh-app-shell.js"),"utf8");
check(/dhSkipLink/.test(shell),"klavye için ana içeriğe atlama bağlantısı var");
check(/e\.key!=="Escape"/.test(shell),"açık pencere Escape ile kapatılabiliyor");
const report=fs.readFileSync(path.join(root,"rapor.html"),"utf8");
check(/DHInsights\.render/.test(report),"ilerleme raporu kişisel çalışma önerisi üretiyor");
const home=fs.readFileSync(path.join(root,"index.html"),"utf8");
check(/DHLearningCoach\.render/.test(home),"ana ekran hedef, tekrar ve zayıf konu önerisini birleştiriyor");

console.log("\n--- yerel dosya bağlantıları ---");
const missing=[];
for(const file of html){
  const src=fs.readFileSync(path.join(root,file),"utf8");
  for(const match of src.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)){
    let ref=match[1].split(/[?#]/)[0];
    if(!ref || /^(?:https?:|data:|blob:|mailto:|tel:|javascript:|#|\/\/)/i.test(ref) || /[{}$]/.test(ref)) continue;
    try{ref=decodeURIComponent(ref);}catch{}
    const target=path.resolve(path.dirname(path.join(root,file)),ref);
    if(!target.startsWith(root) || !fs.existsSync(target)) missing.push(file+" → "+ref);
  }
}
check(missing.length===0,"HTML içindeki tüm yerel src/href hedefleri mevcut"+(missing.length?" ("+missing.slice(0,5).join(", ")+")":""));

if(failures.length){console.error("\nSONUÇ: "+failures.length+" kalite kontrolü başarısız");process.exit(1);}
console.log("\nSONUÇ: tüm kalite kontrolleri geçti ✓\n");
