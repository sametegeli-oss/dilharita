/* Gemini bazen JSON içindeki açıklamalarda çift tırnakları kaçırmadan
   döndürür: "... geçmiş zaman "was" ile ...". Görünüşte tam olan bu
   yanıt JSON.parse tarafından reddedilir. Önce standart JSON denenir;
   olmazsa yalnız beklenen n/explanation nesneleri güvenli biçimde çıkarılır. */
(function(g){"use strict";
  function decodeText(s){return String(s||"").replace(/\\"/g,'"').replace(/\\n/g,"\n").replace(/\\r/g,"\r").replace(/\\t/g,"\t").replace(/\\\\/g,"\\");}
  function parse(raw){
    var clean=String(raw||"").replace(/```json|```/gi,"").trim();
    var a=clean.indexOf("["),z=clean.lastIndexOf("]");
    if(a<0||z<a)throw new Error("JSON dizi bulunamadı");
    var part=clean.slice(a,z+1);
    try{var normal=JSON.parse(part);if(Array.isArray(normal))return normal;}catch(e){}
    var rows=[],re=/\{\s*"n"\s*:\s*(\d+)\s*,\s*"explanation"\s*:\s*"([\s\S]*?)"\s*\}\s*(?=,|\])/g,m;
    while((m=re.exec(part)))rows.push({n:Number(m[1]),explanation:decodeText(m[2])});
    if(!rows.length)throw new Error("Açıklama nesneleri ayrıştırılamadı");
    return rows;
  }
  g.DHAIBulkJSON={parse:parse};
})(typeof window!=="undefined"?window:globalThis);
