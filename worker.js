/* Dil Harita - NVIDIA Visual NIM CORS bridge
   Kullanici anahtari Worker'da saklanmaz; Authorization basligi yalnizca
   bu istek icin NVIDIA'ya aktarilir. */
const ALLOWED_ORIGINS = new Set([
  "https://sametegeli-oss.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://sametegeli-oss.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" }
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, service: "dilharita-nvidia-image" }, 200, origin);
    if (url.pathname !== "/generate" || request.method !== "POST") return json({ error: "not_found" }, 404, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "origin_not_allowed" }, 403, origin);

    const authorization = request.headers.get("Authorization") || "";
    if (!/^Bearer\s+nvapi-/i.test(authorization)) return json({ error: "invalid_nvidia_key" }, 401, origin);

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400, origin); }
    const prompt = String(body.prompt || "").trim();
    if (!prompt || prompt.length > 4000) return json({ error: "invalid_prompt" }, 400, origin);
    const seed = Math.max(1, Math.min(2147483646, Number(body.seed) || Math.floor(Math.random() * 2147483646) + 1));

    const upstream = await fetch("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell", {
      method: "POST",
      headers: {
        "Authorization": authorization,
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        // Kelime kartinda 512 px yeterlidir. NVIDIA deneme servisinde
        // 1024 px / 4 adim yogun kuyrukta 524 zaman asimina dusuyordu.
        height: 512,
        width: 512,
        cfg_scale: 0,
        mode: "base",
        samples: 1,
        seed,
        steps: 1
      })
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors(origin), "Content-Type": upstream.headers.get("Content-Type") || "application/json" }
    });
  }
};
