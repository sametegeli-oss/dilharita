/* worker-ozel-ders.js — "Bana özel ders" aracı (Cloudflare Worker)
   ====================================================================
   Kullanıcının kendi yapay zekâ anahtarı yoksa, uygulama ders üretimini
   bu araca gönderir. Araç, SAHİBİN Gemini anahtarıyla Gemini'ye sorar.
   Anahtar yalnızca Cloudflare'de gizli değişken (GEMINI_API_KEY) olarak
   durur; kullanıcının cihazına hiç inmez.

   UÇLAR
     POST /uret     {istem}  -> {metin}   ders üretimi (uzun cevap)
     POST /denetle  {istem}  -> {metin}   ikinci denetim (kısa cevap)
     GET  /saglik            -> {ok:true}

   KORUMA
     - Yalnız izinli sitelerden gelen istek kabul edilir (IZINLI).
     - Cihaz başına günlük sınır: GUNLUK_URET üretim, GUNLUK_DENETLE denetim.
       KV bağlaması "SINIR" varsa kalıcı sayılır; yoksa yalnız bellekte
       (Worker yeniden başlayınca sıfırlanır — yine de kaba bir fren).
     - Aynı IP'den günlük en fazla IP_GUNLUK istek.
     - İstem en fazla 30.000 karakter.

   KURULUM: OZEL-DERS-ARACI.md
*/
const IZINLI = new Set([
  "https://sametegeli-oss.github.io",
  "http://127.0.0.1:8767",
  "http://localhost:8767"
]);
const GUNLUK_URET = 6;      // uygulama günde 3 ders ister; yeniden denemeler için pay
const GUNLUK_DENETLE = 6;
const IP_GUNLUK = 40;
const VARSAYILAN_MODEL = "gemini-3.6-flash";

const bellek = new Map();

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": IZINLI.has(origin) ? origin : "https://sametegeli-oss.github.io",
    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-DH-Cihaz",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  };
}
function cevap(veri, durum, origin) {
  return new Response(JSON.stringify(veri), {
    status: durum,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" }
  });
}
function gun() { return new Date().toISOString().slice(0, 10); }

async function say(env, anahtar, sinir) {
  const k = gun() + ":" + anahtar;
  let n = 0;
  if (env.SINIR) n = parseInt((await env.SINIR.get(k)) || "0", 10);
  else n = bellek.get(k) || 0;
  if (n >= sinir) return false;
  n++;
  if (env.SINIR) await env.SINIR.put(k, String(n), { expirationTtl: 60 * 60 * 36 });
  else bellek.set(k, n);
  return true;
}

async function gemini(env, istem, uzun) {
  const model = env.GEMINI_MODEL || VARSAYILAN_MODEL;
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(env.GEMINI_API_KEY);
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "Sen deneyimli bir İngilizce öğretmenisin. Yalnız istenen JSON'u döndür." }] },
      contents: [{ role: "user", parts: [{ text: istem }] }],
      generationConfig: { temperature: uzun ? 0.5 : 0, maxOutputTokens: uzun ? 12000 : 2000 }
    })
  });
  if (r.status === 429) throw { durum: 503, mesaj: "Yapay zekânın ortak kotası şu an dolu. Biraz sonra tekrar deneyin." };
  if (!r.ok) throw { durum: 502, mesaj: "Yapay zekâ cevap vermedi (" + r.status + ")." };
  const j = await r.json();
  const parcalar = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts || [];
  const metin = parcalar.filter(p => !p.thought).map(p => p.text || "").join("");
  if (!metin) throw { durum: 502, mesaj: "Yapay zekâ boş cevap verdi." };
  return metin;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const yol = new URL(request.url).pathname.replace(/\/+$/, "");
    if (yol === "/saglik") return cevap({ ok: true, anahtar: !!env.GEMINI_API_KEY }, 200, origin);
    if (request.method !== "POST" || (yol !== "/uret" && yol !== "/denetle")) return cevap({ mesaj: "Bulunamadı." }, 404, origin);
    if (!IZINLI.has(origin)) return cevap({ mesaj: "Bu siteden istek kabul edilmiyor." }, 403, origin);
    if (!env.GEMINI_API_KEY) return cevap({ mesaj: "Araçta anahtar kurulu değil." }, 500, origin);

    let govde;
    try { govde = await request.json(); } catch (e) { return cevap({ mesaj: "İstek okunamadı." }, 400, origin); }
    const istem = String((govde && govde.istem) || "");
    if (!istem || istem.length > 30000) return cevap({ mesaj: "İstem boş ya da çok uzun." }, 400, origin);

    const uzun = yol === "/uret";
    const cihaz = String(request.headers.get("X-DH-Cihaz") || "bilinmiyor").slice(0, 64);
    const ip = request.headers.get("CF-Connecting-IP") || "ip-yok";
    if (!(await say(env, "ip:" + ip, IP_GUNLUK)))
      return cevap({ mesaj: "Bugünkü istek sınırı doldu. Yarın tekrar deneyin." }, 429, origin);
    if (!(await say(env, (uzun ? "u:" : "d:") + cihaz, uzun ? GUNLUK_URET : GUNLUK_DENETLE)))
      return cevap({ mesaj: "Bugünkü ders hakkınız doldu. Yarın yenileri hazırlanır." }, 429, origin);

    try {
      const metin = await gemini(env, istem, uzun);
      return cevap({ metin }, 200, origin);
    } catch (e) {
      return cevap({ mesaj: e.mesaj || "Bir sorun çıktı." }, e.durum || 500, origin);
    }
  }
};
