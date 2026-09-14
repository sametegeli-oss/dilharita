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
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, service: "dilharita-nvidia-image" }, 200, origin);
    if (url.pathname === "/channel") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);
      if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "origin_not_allowed" }, 403, origin);
      const key = env && env.YOUTUBE_API_KEY;
      if (!key) return json({ error: "missing_api_key" }, 500, origin);
      const raw = (url.searchParams.get("handle") || "").trim();
      if (!raw || raw.length > 120) return json({ error: "invalid_handle" }, 400, origin);
      let handle = raw
        .replace(/^https?:\/\/(www\.)?youtube\.com\//i, "")
        .split(/[?&#]/)[0]
        .replace(/\/(videos|streams|shorts|about|featured)\/?$/, "");
      const directId = handle.replace(/^channel\//, "");
      let channelRes;
      if (/^UC[a-zA-Z0-9_-]{20,26}$/.test(directId)) {
        channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${directId}&key=${key}`);
      } else {
        if (!handle.startsWith("@")) handle = "@" + handle.replace(/^@/, "");
        if (!/^@[a-zA-Z0-9._-]{1,100}$/.test(handle)) return json({ error: "invalid_handle" }, 400, origin);
        channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(handle)}&key=${key}`);
      }
      const channelData = await channelRes.json();
      if (!channelRes.ok) return json({ error: "youtube_api_error", status: channelRes.status, detail: channelData && channelData.error }, 502, origin);
      const item = channelData.items && channelData.items[0];
      const uploadsId = item && item.contentDetails && item.contentDetails.relatedPlaylists && item.contentDetails.relatedPlaylists.uploads;
      if (!uploadsId) return json({ error: "channel_not_found" }, 404, origin);
      const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=30&playlistId=${uploadsId}&key=${key}`);
      const plData = await plRes.json();
      if (!plRes.ok) return json({ error: "youtube_api_error", status: plRes.status, detail: plData && plData.error }, 502, origin);
      const items = (plData.items || []).map(it => {
        const sn = it.snippet || {};
        const thumbs = sn.thumbnails || {};
        const vid = sn.resourceId && sn.resourceId.videoId;
        return vid ? {
          videoId: vid,
          title: sn.title || "",
          summary: String(sn.description || "").split("\n")[0].slice(0, 180),
          duration: "",
          published: String(sn.publishedAt || "").slice(0, 10),
          thumb: (thumbs.medium && thumbs.medium.url) || (thumbs.default && thumbs.default.url) || `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`
        } : null;
      }).filter(Boolean);
      return json({ channel: uploadsId, videos: items }, 200, origin);
    }
    if (url.pathname === "/transcript") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);
      if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "origin_not_allowed" }, 403, origin);
      const vid = (url.searchParams.get("id") || "").trim();
      if (!/^[a-zA-Z0-9_-]{10,15}$/.test(vid)) return json({ error: "invalid_id" }, 400, origin);
      const wantLang = (url.searchParams.get("lang") || "").trim();
      const playerRes = await fetch(
        "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: vid,
            context: { client: { clientName: "WEB", clientVersion: "2.20240101.00.00" } }
          })
        }
      );
      if (!playerRes.ok) return json({ error: "player_fetch_failed", status: playerRes.status }, 502, origin);
      const playerData = await playerRes.json();
      const tracks = playerData && playerData.captions && playerData.captions.playerCaptionsTracklistRenderer && playerData.captions.playerCaptionsTracklistRenderer.captionTracks;
      if (!tracks || !tracks.length) return json({ error: "no_captions" }, 404, origin);
      const track = tracks.find(t => t.languageCode === wantLang) ||
                    tracks.find(t => t.languageCode === "en") ||
                    tracks.find(t => !t.kind) ||
                    tracks[0];
      const capRes = await fetch(track.baseUrl + "&fmt=json3");
      if (!capRes.ok) return json({ error: "captions_fetch_failed", status: capRes.status }, 502, origin);
      const capData = await capRes.json();
      const events = capData.events || [];
      const clock = (sec) => {
        sec = Math.max(0, Math.floor(sec));
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
      };
      const lines = [];
      for (const ev of events) {
        if (!ev.segs) continue;
        const text = ev.segs.map(s => s.utf8 || "").join("").replace(/\n/g, " ").trim();
        if (!text) continue;
        lines.push(clock((ev.tStartMs || 0) / 1000) + " " + text);
      }
      if (!lines.length) return json({ error: "empty_captions" }, 404, origin);
      return json({ videoId: vid, language: track.languageCode, isAuto: track.kind === "asr", text: lines.join("\n") }, 200, origin);
    }
    if (url.pathname !== "/generate" && url.pathname !== "/pollinations") return json({ error: "not_found" }, 404, origin);
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "origin_not_allowed" }, 403, origin);

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400, origin); }
    const prompt = String(body.prompt || "").trim();
    if (!prompt || prompt.length > 4000) return json({ error: "invalid_prompt" }, 400, origin);
    const seed = Math.max(1, Math.min(2147483646, Number(body.seed) || Math.floor(Math.random() * 2147483646) + 1));

    if (url.pathname === "/pollinations") {
      const imageUrl = "https://gen.pollinations.ai/image/" + encodeURIComponent(prompt)
        + "?model=flux&width=512&height=512&seed=" + seed + "&nologo=true&private=true";
      const generated = await fetch(imageUrl, { headers: { "Accept": "image/*" } });
      if (!generated.ok) return json({ error: "pollinations_upstream", status: generated.status }, generated.status, origin);
      return new Response(generated.body, {
        status: 200,
        headers: { ...cors(origin), "Content-Type": generated.headers.get("Content-Type") || "image/jpeg" }
      });
    }

    const authorization = request.headers.get("Authorization") || "";
    if (!/^Bearer\s+nvapi-/i.test(authorization)) return json({ error: "invalid_nvidia_key" }, 401, origin);

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
