/* Dil Harita — Deniz Telegram köprüsü (Cloudflare Worker, ücretsiz plan)
   ----------------------------------------------------------------------
   Ne yapar:
     1) "Deniz arar": her saat çalışan zamanlayıcı, kullanıcının seçtiği saatte
        o gün çalışılmamışsa Telegram'dan yazar (bugünkü planın ilk adımıyla).
     2) Sohbet: kullanıcı bota yazınca Deniz cevap verir (Groq, kullanıcının anahtarı).
     3) Uygulama → Telegram: konuşma sonrası kısa özet ("bu konuşmadan 3 not").
   Firebase'e erişmez: uygulama kısa bir durum özetini kendisi gönderir (POST /durum).

   Gizli değerler (Cloudflare panelinden ya da `wrangler secret put` ile; depoya YAZILMAZ):
     TELEGRAM_TOKEN   @BotFather'ın verdiği bot anahtarı
     (TG_SECRET       isteğe bağlı; yoksa webhook sırrı bot anahtarından türetilir)
     GROQ_KEY         (isteğe bağlı) Deniz'in sohbet cevapları için Groq anahtarı
   KV bağlantısı: DENIZ  (wrangler-deniz.toml'da)

   KV anahtarları:
     bekle:<kod>     → uygulama anahtarı (1 saat geçerli eşleştirme kodu)
     kul:<anahtar>   → { chat, saat, acik, ozet, sonArama, ad }
     chat:<chatId>   → anahtar
     durum:<anahtar> → uygulamanın son gönderdiği özet { gun, dk, plan, ozet, baglam, t }
     soh:<anahtar>   → son 12 mesaj (sohbet hafızası)
     gelen:<anahtar> → uygulamanın henüz almadığı Telegram yazışmaları (en çok 40)
*/
const IZINLI = new Set(["https://sametegeli-oss.github.io", "http://localhost:8768", "http://127.0.0.1:8768"]);
const SITE = "https://sametegeli-oss.github.io/dilharita/";
const TZ = "Europe/Istanbul";
const GROQ_MODEL = "openai/gpt-oss-120b";

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": IZINLI.has(origin) ? origin : "https://sametegeli-oss.github.io",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  };
}
/* Webhook sırrı: TG_SECRET verilmediyse bot anahtarının SHA-256 özetinden türetilir
   (kullanıcı yalnız bot anahtarını girer; özet anahtarı açığa çıkarmaz). */
async function webhookSirri(env) {
  if (env.TG_SECRET) return env.TG_SECRET;
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("dh-deniz-tg:" + env.TELEGRAM_TOKEN));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("").slice(0, 48);
}
/* Telegram'a webhook adresini bildirir; yalnız bu Worker'ın kendi /tg adresine kurar (başkası çağırsa da zararsız). */
async function webhookKur(env, origin) {
  const sir = await webhookSirri(env);
  const r = await tg(env, "setWebhook", { url: origin + "/tg", secret_token: sir, allowed_updates: ["message", "edited_message"], drop_pending_updates: false });
  await tg(env, "setMyCommands", { commands: [
    { command: "plan", description: "Bugünkü plan" }, { command: "durum", description: "Bugün ne yaptım" },
    { command: "saat", description: "Hatırlatma saati (ör. /saat 21)" }, { command: "sessiz", description: "Hatırlatmayı aç/kapat" } ] });
  if (r && r.ok) await env.DENIZ.put("ayar:webhook", origin);
  return r;
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" } });
}
function yerelSaat(d) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(d || new Date());
  const g = {}; p.forEach(x => g[x.type] = x.value);
  return { gun: g.year + "-" + g.month + "-" + g.day, saat: +g.hour };
}
const anahtarGecerli = a => typeof a === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(a);
const kisalt = (s, n) => String(s == null ? "" : s).slice(0, n);
async function kvJson(env, k) { try { const v = await env.DENIZ.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
async function kvYaz(env, k, v, ttl) { await env.DENIZ.put(k, JSON.stringify(v), ttl ? { expirationTtl: ttl } : undefined); }

async function tg(env, metod, govde) {
  const r = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_TOKEN + "/" + metod, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde)
  });
  return r.json().catch(() => ({ ok: false }));
}
function yaz(env, chat, metin, dugme) {
  const g = { chat_id: chat, text: kisalt(metin, 3800), disable_web_page_preview: true };
  if (dugme) g.reply_markup = { inline_keyboard: [[{ text: dugme.metin, url: dugme.url }]] };
  return tg(env, "sendMessage", g);
}
async function gelenEkle(env, anahtar, kayit) {
  const k = "gelen:" + anahtar, l = (await kvJson(env, k)) || [];
  l.push(kayit); await kvYaz(env, k, l.slice(-40));
}

/* ---------- Deniz'in sözleri ---------- */
function planMetni(durum) {
  const p = (durum && durum.plan) || [];
  if (!p.length) return "Bugün için planımız henüz hazır değil; programı açınca hazırlarım.";
  return p.map((a, i) => (i + 1) + ". " + kisalt(a.ad || a.ekran, 40) + " · " + (a.dk | 0) + " dk" + (a.neden ? " — " + kisalt(a.neden, 140) : "")).join("\n");
}
function aramaMetni(durum, ad) {
  const p = (durum && durum.plan) || [], ilk = p[0];
  let m = "Selam" + (ad ? " " + kisalt(ad, 30) : "") + ", ben Deniz. Bugün henüz birlikte çalışmadık.";
  if (ilk) m += "\nKüçük bir başlangıç: " + kisalt(ilk.ad || ilk.ekran, 40) + ", " + (ilk.dk | 0) + " dakika." + (ilk.neden ? "\nNeden: " + kisalt(ilk.neden, 160) : "");
  else m += "\n10 dakika ayırabilir misin? Planı ben hazırlarım.";
  return m;
}
async function denizCevap(env, anahtar, metin, durum) {
  if (!env.GROQ_KEY) return "Şu an yalnız kısa komutlarla cevap verebiliyorum: /plan, /durum, /saat 20, /sessiz. Sohbet için Worker'a Groq anahtarı eklenmeli.";
  const gecmis = (await kvJson(env, "soh:" + anahtar)) || [];
  const sistem = [
    "Sen Deniz'sin: Dil Harita'daki Türkçe konuşan İngilizce koçu. Kullanıcıya 'sen' diye hitap et, sıcak ve kısa yaz (en çok 5 cümle).",
    "Yalnız aşağıdaki bağlamdaki sayıları kullan; sayı uydurma. Bilmediğini söyle. Telegram'dasın: biçimlendirme kullanma.",
    "Kullanıcı İngilizce yazarsa önce cevap ver, sonra varsa tek bir hatasını nazikçe düzelt.",
    "Kullanıcı bugünle ilgili istek söylerse (ör. 'yorgunum, kısa tut', 'bugün in/of çalışalım') kabul et ve programı açınca planın buna göre ayarlanacağını söyle.",
    "Bağlam (programın hesapladığı): " + kisalt(durum && durum.baglam, 1500),
    "Bugünkü plan:\n" + planMetni(durum)
  ].join("\n");
  const mesajlar = [{ role: "system", content: sistem }].concat(gecmis.slice(-10), [{ role: "user", content: kisalt(metin, 1500) }]);
  let cevap = "";
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { "Authorization": "Bearer " + env.GROQ_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: GROQ_MODEL, messages: mesajlar, temperature: 0.5, max_tokens: 700, reasoning_effort: "low" })
    });
    const j = await r.json(); cevap = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "").trim();
  } catch (e) {}
  if (!cevap) cevap = "Şu an cevap üretemedim; birazdan tekrar yazar mısın?";
  await kvYaz(env, "soh:" + anahtar, gecmis.concat([{ role: "user", content: kisalt(metin, 1500) }, { role: "assistant", content: kisalt(cevap, 1500) }]).slice(-12));
  return cevap;
}

/* ---------- Telegram webhook ---------- */
async function telegramGuncelleme(env, u) {
  const m = u && (u.message || u.edited_message); if (!m || !m.chat) return;
  const chat = m.chat.id, metin = String(m.text || "").trim();
  if (!metin) { await yaz(env, chat, "Şimdilik yalnız yazılı mesajları okuyabiliyorum."); return; }
  const bas = metin.match(/^\/start(?:\s+([A-Za-z0-9]{6,12}))?$/);
  if (bas) {
    const kod = bas[1];
    if (!kod) { await yaz(env, chat, "Merhaba! Beni programa bağlamak için Dil Harita → Koçluk Paneli → \"Telegram'a bağla\" düğmesini kullan."); return; }
    const anahtar = await env.DENIZ.get("bekle:" + kod);
    if (!anahtar) { await yaz(env, chat, "Bu bağlantı kodunun süresi dolmuş. Koçluk Paneli'nden yeni bir bağlantı al."); return; }
    const eski = (await kvJson(env, "kul:" + anahtar)) || {};
    if (eski.chat && eski.chat !== chat) await env.DENIZ.delete("chat:" + eski.chat);
    await kvYaz(env, "kul:" + anahtar, Object.assign({ saat: 20, acik: true, ozet: true }, eski, { chat: chat, ad: kisalt(m.from && m.from.first_name, 30) }));
    await env.DENIZ.put("chat:" + chat, anahtar);
    await env.DENIZ.delete("bekle:" + kod);
    await yaz(env, chat, "Bağlandık! Ben Deniz. Her gün seçtiğin saatte o gün çalışmadıysan sana yazacağım (şimdilik 20:00).\nKomutlar: /plan bugünkü plan · /durum bugün ne yaptın · /saat 21 hatırlatma saati · /sessiz hatırlatmayı aç/kapat.\nBana İngilizce ya da Türkçe yazabilirsin.");
    return;
  }
  const anahtar = await env.DENIZ.get("chat:" + chat);
  if (!anahtar) { await yaz(env, chat, "Seni henüz tanımıyorum. Dil Harita → Koçluk Paneli → \"Telegram'a bağla\" ile bağlanalım."); return; }
  const kul = (await kvJson(env, "kul:" + anahtar)) || {};
  const durum = (await kvJson(env, "durum:" + anahtar)) || {};
  const bugun = yerelSaat().gun;
  if (/^\/plan\b/.test(metin)) { await yaz(env, chat, "Bugünkü plan:\n" + planMetni(durum.gun === bugun ? durum : null), { metin: "Koç moduyla başla", url: SITE + "koc-paneli.html?kocmodu=1" }); return; }
  if (/^\/durum\b/.test(metin)) {
    const dk = durum.gun === bugun ? (durum.dk | 0) : 0;
    await yaz(env, chat, dk ? "Bugün " + dk + " dakika çalıştın." + (durum.ozet ? "\n" + kisalt(durum.ozet, 400) : "") : "Bugün için henüz çalışma kaydı gelmedi (program açılınca güncellenir).");
    return;
  }
  const saatK = metin.match(/^\/saat(?:\s+(\d{1,2}))?/);
  if (saatK) {
    const s = saatK[1] != null ? +saatK[1] : null;
    if (s == null || s < 6 || s > 23) { await yaz(env, chat, "Hatırlatma saati 6 ile 23 arasında olmalı. Örnek: /saat 21"); return; }
    kul.saat = s; await kvYaz(env, "kul:" + anahtar, kul);
    await yaz(env, chat, "Tamam, her gün " + s + ":00'te bakacağım."); return;
  }
  if (/^\/sessiz\b/.test(metin)) {
    kul.acik = !kul.acik; await kvYaz(env, "kul:" + anahtar, kul);
    await yaz(env, chat, kul.acik ? "Hatırlatmalar açık." : "Hatırlatmaları kapattım. Açmak için yine /sessiz yaz."); return;
  }
  if (/^\/ayril\b/.test(metin)) {
    await env.DENIZ.delete("chat:" + chat); kul.chat = null; await kvYaz(env, "kul:" + anahtar, kul);
    await yaz(env, chat, "Bağlantıyı kaldırdım. İstersen panelden yeniden bağlanabilirsin."); return;
  }
  await tg(env, "sendChatAction", { chat_id: chat, action: "typing" });
  const cevap = await denizCevap(env, anahtar, metin, durum.gun === bugun ? durum : Object.assign({}, durum, { plan: [] }));
  await yaz(env, chat, cevap);
  await gelenEkle(env, anahtar, { t: Date.now(), sen: kisalt(metin, 1000), deniz: kisalt(cevap, 1500) });
}

/* ---------- uygulamadan gelen istekler ---------- */
async function uygulama(request, env, yol, origin) {
  if (!IZINLI.has(origin)) return json({ hata: "izin_yok" }, 403, origin);
  let g = {}; try { g = await request.json(); } catch (e) {}
  const anahtar = g.anahtar;
  if (!anahtarGecerli(anahtar)) return json({ hata: "anahtar" }, 400, origin);
  if (yol === "/baglan") {
    const kod = String(g.kod || "");
    if (!/^[A-Za-z0-9]{6,12}$/.test(kod)) return json({ hata: "kod" }, 400, origin);
    if (!env.TELEGRAM_TOKEN) return json({ hata: "bot_anahtari_yok" }, 200, origin);
    await env.DENIZ.put("bekle:" + kod, anahtar, { expirationTtl: 3600 });
    const self = new URL(request.url).origin;
    if ((await env.DENIZ.get("ayar:webhook")) !== self) await webhookKur(env, self);
    const ben = await tg(env, "getMe", {});
    return json({ ok: true, bot: ben && ben.result && ben.result.username }, 200, origin);
  }
  const kul = await kvJson(env, "kul:" + anahtar);
  if (yol === "/durum") {
    const d = g.durum || {};
    const temiz = {
      gun: kisalt(d.gun, 10), dk: Math.max(0, Math.min(1440, d.dk | 0)), ozet: kisalt(d.ozet, 600), baglam: kisalt(d.baglam, 1600),
      plan: (Array.isArray(d.plan) ? d.plan : []).slice(0, 8).map(a => ({ ekran: kisalt(a.ekran, 20), ad: kisalt(a.ad, 40), dk: a.dk | 0, neden: kisalt(a.neden, 200) })),
      t: Date.now()
    };
    await kvYaz(env, "durum:" + anahtar, temiz);
    let gelen = [];
    if (kul && kul.chat) {
      if (g.ayar && typeof g.ayar === "object") {
        let degisti = false;
        if (g.ayar.saat >= 6 && g.ayar.saat <= 23 && g.ayar.saat !== kul.saat) { kul.saat = g.ayar.saat | 0; degisti = true; }
        if (typeof g.ayar.acik === "boolean" && g.ayar.acik !== kul.acik) { kul.acik = g.ayar.acik; degisti = true; }
        if (typeof g.ayar.ozet === "boolean" && g.ayar.ozet !== kul.ozet) { kul.ozet = g.ayar.ozet; degisti = true; }
        if (degisti) await kvYaz(env, "kul:" + anahtar, kul);
      }
      gelen = (await kvJson(env, "gelen:" + anahtar)) || [];
      if (gelen.length) await env.DENIZ.delete("gelen:" + anahtar);
    }
    return json({ ok: true, bagli: !!(kul && kul.chat), ayar: kul ? { saat: kul.saat, acik: kul.acik, ozet: kul.ozet } : null, gelen: gelen }, 200, origin);
  }
  if (yol === "/mesaj") {
    if (!kul || !kul.chat) return json({ ok: false, bagli: false }, 200, origin);
    if (kul.ozet === false && g.tur === "ozet") return json({ ok: false, kapali: true }, 200, origin);
    const r = await yaz(env, kul.chat, kisalt(g.metin, 3000), g.dugme && g.dugme.url && String(g.dugme.url).indexOf(SITE) === 0 ? { metin: kisalt(g.dugme.metin, 40), url: g.dugme.url } : null);
    return json({ ok: !!(r && r.ok) }, 200, origin);
  }
  if (yol === "/ayril") {
    if (kul && kul.chat) await env.DENIZ.delete("chat:" + kul.chat);
    await Promise.all(["kul:", "durum:", "soh:", "gelen:"].map(p => env.DENIZ.delete(p + anahtar)));
    return json({ ok: true }, 200, origin);
  }
  return json({ hata: "yok" }, 404, origin);
}

/* ---------- saatlik "Deniz arar" ---------- */
async function zamanli(env) {
  const { gun, saat } = yerelSaat();
  let imlec, sayi = 0;
  do {
    const l = await env.DENIZ.list({ prefix: "kul:", cursor: imlec });
    for (const k of l.keys) {
      const kul = await kvJson(env, k.name); if (!kul || !kul.chat || kul.acik === false) continue;
      if ((kul.saat == null ? 20 : kul.saat) !== saat || kul.sonArama === gun) continue;
      const anahtar = k.name.slice(4), durum = (await kvJson(env, "durum:" + anahtar)) || {};
      if (durum.gun === gun && (durum.dk | 0) >= 5) continue;          /* bugün çalışmış: rahatsız etme */
      await yaz(env, kul.chat, aramaMetni(durum.gun === gun ? durum : null, kul.ad), { metin: "Hadi başlayalım", url: SITE + "koc-paneli.html?kocmodu=1" });
      kul.sonArama = gun; await kvYaz(env, k.name, kul); sayi++;
    }
    imlec = l.list_complete ? null : l.cursor;
  } while (imlec);
  return sayi;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const url = new URL(request.url);
    if (url.pathname === "/saglik") return json({ ok: true, hizmet: "dilharita-deniz", tg: !!env.TELEGRAM_TOKEN, groq: !!env.GROQ_KEY, kv: !!env.DENIZ, webhook: env.DENIZ ? !!(await env.DENIZ.get("ayar:webhook")) : false }, 200, origin);
    /* Telegram'a webhook adresini bildirir (ilk bağlanmada kendiliğinden de çalışır). */
    if (url.pathname === "/kur") {
      if (!env.TELEGRAM_TOKEN) return new Response("Önce TELEGRAM_TOKEN gizli değerini gir.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      const r = await webhookKur(env, url.origin);
      return new Response(r && r.ok ? "Tamam: Telegram bu sunucuya bağlandı. Bu sayfayı kapatabilirsin." : "Olmadı: " + JSON.stringify(r), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (url.pathname === "/tg" && request.method === "POST") {
      if (!env.TELEGRAM_TOKEN || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== await webhookSirri(env)) return new Response("yetkisiz", { status: 401 });
      let u = null; try { u = await request.json(); } catch (e) {}
      try { await telegramGuncelleme(env, u); } catch (e) {}
      return new Response("ok");
    }
    if (request.method === "POST" && ["/baglan", "/durum", "/mesaj", "/ayril"].includes(url.pathname)) return uygulama(request, env, url.pathname, origin);
    return json({ hata: "yok" }, 404, origin);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(zamanli(env)); }
};
