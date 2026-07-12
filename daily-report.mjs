/* daily-report.mjs — GitHub Actions üzerinden sunucu tarafında çalışır.
   Uygulama açık olmasa bile, her sabah 08:00 (Türkiye saati) tetiklenir.
   Firebase'deki (zaten senkronize olan) verini okuyup EmailJS ile Gmail'ine
   dünün raporunu + davetini, ayın 1'inde de aylık değerlendirmeyi gönderir.
*/
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ---- Ortam değişkenleri (GitHub Secrets üzerinden gelir) ----
const {
  FIREBASE_SERVICE_ACCOUNT_JSON,
  FIREBASE_UID,
  EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY,
  EMAILJS_PRIVATE_KEY,
} = process.env;

function req(name, val) {
  if (!val) { console.error("EKSİK GIZLI BİLGİ (Secret):", name); process.exit(1); }
  return val;
}
req("FIREBASE_SERVICE_ACCOUNT_JSON", FIREBASE_SERVICE_ACCOUNT_JSON);
req("FIREBASE_UID", FIREBASE_UID);
req("EMAILJS_SERVICE_ID", EMAILJS_SERVICE_ID);
req("EMAILJS_TEMPLATE_ID", EMAILJS_TEMPLATE_ID);
req("EMAILJS_PUBLIC_KEY", EMAILJS_PUBLIC_KEY);
req("EMAILJS_PRIVATE_KEY", EMAILJS_PRIVATE_KEY);

// TEŞHİS: anahtarın kendisini asla yazdırmıyoruz, sadece var olup olmadığını ve uzunluğunu
// (GitHub Actions zaten secret değerlerini loglarda otomatik *** ile maskeler, bu ekstra güvenlik).
console.log("Teşhis — Private Key uzunluğu:", EMAILJS_PRIVATE_KEY.length, "karakter");
console.log("Teşhis — Public Key uzunluğu:", EMAILJS_PUBLIC_KEY.length, "karakter");
console.log("Teşhis — ikisi aynı mı (olmamalı):", EMAILJS_PRIVATE_KEY === EMAILJS_PUBLIC_KEY);

// ---- Türkiye saatine göre "bugün/dün" (UTC+3, DST yok) ----
const TR_OFFSET_MS = 3 * 3600000;
function trNow() { return new Date(Date.now() + TR_OFFSET_MS); }
function isoDate(d) { return d.toISOString().slice(0, 10); }
const now = trNow();
const today = isoDate(now);
const yest = new Date(now); yest.setUTCDate(yest.getUTCDate() - 1);
const yesterday = isoDate(yest);
const isFirstOfMonth = now.getUTCDate() === 1;

// ---- Firebase'e bağlan, senin belgelerini oku ----
initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)) });
const db = getFirestore();

async function readDoc(col) {
  try {
    const snap = await db.collection(col).doc(FIREBASE_UID).get();
    return snap.exists ? snap.data() : {};
  } catch (e) { console.error("Firestore okuma hatası (" + col + "):", e.message); return {}; }
}

function safeParse(str, fallback) {
  try { return JSON.parse(str || "null") ?? fallback; } catch { return fallback; }
}

(async () => {
  const settings = await readDoc("settings");
  const progress = await readDoc("progress");
  const merged = { ...settings, ...progress };            // progress alanları öncelikli (daha taze)

  const tracker = safeParse(merged["dh-study-tracker-v1"], { days: {} });
  const activityLog = safeParse(merged["dh-activity-log-v1"], []);
  const errors = Array.isArray(merged.__errors) ? merged.__errors : [];

  const days = tracker.days || {};

  // ---- Seri (streak) — bugün henüz boşsa dünden say ----
  let streak = 0;
  { let d = new Date(now);
    if (!days[isoDate(d)]) d.setUTCDate(d.getUTCDate() - 1);
    for (;;) { const k = isoDate(d); if (days[k]) { streak++; d.setUTCDate(d.getUTCDate() - 1); } else break; }
  }

  // ---- Dünün özeti ----
  const yRec = days[yesterday] || {};
  const yEntries = activityLog.filter((e) => e && e.d === yesterday);
  const yCorrect = yEntries.filter((e) => e.kind === "correct").length;
  const yWrong = yEntries.filter((e) => e.kind === "wrong").length;
  const yChats = yEntries.filter((e) => e.kind === "chat").length;
  const yTotal = yCorrect + yWrong;
  const yAcc = yTotal ? Math.round((100 * yCorrect) / yTotal) : null;
  const studiedYesterday = !!days[yesterday];

  // ---- Günlük e-posta gövdesi ----
  let html = `<div style="font-family:system-ui,sans-serif;color:#1a1a2e;line-height:1.6">`;
  html += `<h2 style="margin:0 0 4px">🔥 ${streak} günlük serin ${streak > 0 ? "devam ediyor" : "bekliyor"}!</h2>`;
  html += `<p style="color:#555;margin:0 0 18px">Dil Harita — günlük rapor (${today})</p>`;

  if (studiedYesterday) {
    html += `<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;border-radius:8px;margin-bottom:16px">`;
    html += `<b>Dün ne yaptın?</b><br>`;
    html += `${yRec.sentences || 0} cümle, ${yRec.reviews || 0} tekrar, ${yRec.lessons || 0} ders`;
    if (yTotal) html += ` · Doğruluk: <b>%${yAcc}</b> (${yCorrect}/${yTotal})`;
    if (yChats) html += ` · ${yChats} sohbet mesajı`;
    html += `</div>`;
  } else {
    html += `<div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:8px;margin-bottom:16px">`;
    html += `Dün çalışma kaydın görünmüyor. Bugün küçük bir adımla seriyi tazele!`;
    html += `</div>`;
  }

  html += `<p style="margin:18px 0"><b>Bugün seni bekliyoruz 👋</b><br>10 dakikanı ayır, tekrarları bitir ya da yeni birkaç cümle öğren.</p>`;
  html += `<a href="https://sametegeli-oss.github.io/dilharita/index.html" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">Dil Harita'yı Aç →</a>`;

  // ---- Ayın 1'i ise: aylık değerlendirme ekle ----
  if (isFirstOfMonth) {
    let active = 0, sentTotal = 0, reviewTotal = 0;
    const cutoff = new Date(now); cutoff.setUTCDate(cutoff.getUTCDate() - 30);
    for (const k in days) {
      if (new Date(k) >= cutoff) {
        active++; sentTotal += days[k].sentences || 0; reviewTotal += days[k].reviews || 0;
      }
    }
    const cut15 = Date.now() - 15 * 86400000, cut30 = Date.now() - 30 * 86400000;
    const older = {}, recent = {};
    errors.forEach((r) => {
      const ts = r.ts || (r.createdAt ? new Date(r.createdAt).getTime() : 0);
      if (!ts || ts < cut30) return;
      const types = Array.isArray(r.types) && r.types.length ? r.types : r.type ? [r.type] : [];
      types.forEach((t) => { if (ts >= cut15) recent[t] = (recent[t] || 0) + 1; else older[t] = (older[t] || 0) + 1; });
    });
    const trendLines = [];
    new Set([...Object.keys(older), ...Object.keys(recent)]).forEach((t) => {
      const o = older[t] || 0, r = recent[t] || 0;
      if (!o && !r) return;
      if (r < o) trendLines.push(`✅ ${t}: iyileşiyor (${o}→${r})`);
      else if (r > o) trendLines.push(`⚠️ ${t}: dikkat, artıyor (${o}→${r})`);
    });

    html += `<hr style="margin:28px 0;border:none;border-top:1px solid #e5e7eb">`;
    html += `<h2 style="margin:0 0 10px">📅 Aylık Değerlendirme</h2>`;
    html += `<p>Son 30 günde <b>${active}/30 gün</b> aktif oldun · toplam ${sentTotal} cümle, ${reviewTotal} tekrar.</p>`;
    if (trendLines.length) html += `<p>${trendLines.slice(0, 6).join("<br>")}</p>`;
    else html += `<p style="color:#777">Bu ay için yeterli hata verisi birikmedi.</p>`;
  }

  html += `</div>`;

  const subject = isFirstOfMonth
    ? `📅 Aylık Değerlendirme + Günlük Rapor — ${today}`
    : (studiedYesterday ? `🔥 ${streak} günlük serin devam ediyor — bugün de gel!` : `👋 Seni özledik — bugün küçük bir adım at`);

  // ---- EmailJS REST API (sunucudan, tarayıcı olmadan) ----
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: { subject, message_html: html },
    }),
  });

  if (!res.ok) {
    console.error("EmailJS hata:", res.status, await res.text());
    process.exit(1);
  }
  console.log("✓ Gönderildi:", subject);
})();
