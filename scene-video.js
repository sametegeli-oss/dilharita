/* scene-video.js
   Sahne videosu + Pexels + otomatik ilk video + TTS seslendirme
*/

(function () {
  "use strict";

  const PREFIX = "speaking video : ";
  const DB_NAME = "dilharita_scene_video_db_v1";
  const STORE = "kv";
  const API_KEY = "pexels_api_key";
  const VIDEO_PREFIX = "selected_video_";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(init);

  function init() {
    if (window.__SceneVideoLoaded) return;
    window.__SceneVideoLoaded = true;

    clearOld();
    injectStyle();
    createStage();
    createPanel();
    bindEvents();

    setInterval(updateSentenceUI, 1000);
    setTimeout(updateSentenceUI, 400);
    setTimeout(loadSelectedVideo, 900);

    window.SceneVideo = {
      open: openPanel,
      close: closePanel,
      getSentence: getTargetEnglishSentence,
      buildQuery,
      searchAndUseFirst,
      speak: speakCurrentSentence
    };
  }

  function clearOld() {
    [
      "#sceneVideoStage",
      "#sceneVideoPanel",
      "#sceneVideoFab",
      "#sceneVideoStyle",
      "#scenePracticeStage",
      "#sceneVideoUseFixStage",
      "#autoSpeakingVideoStage"
    ].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    });
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbSet(key, value) {
    try {
      const db = await openDB();

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(String(value || ""), key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      db.close();
      return true;
    } catch (e) {
      console.warn("IndexedDB kayıt hatası:", e);
      return false;
    }
  }

  async function dbGet(key) {
    try {
      const db = await openDB();

      const result = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result || "");
        req.onerror = () => reject(req.error);
      });

      db.close();
      return result || "";
    } catch (e) {
      console.warn("IndexedDB okuma hatası:", e);
      return "";
    }
  }

  async function dbDelete(key) {
    try {
      const db = await openDB();

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      db.close();
    } catch (e) {
      console.warn("IndexedDB silme hatası:", e);
    }
  }

  function injectStyle() {
    const style = document.createElement("style");
    style.id = "sceneVideoStyle";
    style.textContent = `
      #sceneVideoStage {
        width: min(760px, calc(100vw - 32px));
        margin: 18px auto;
        border-radius: 22px;
        overflow: hidden;
        background: #020617;
        border: 1px solid rgba(148,163,184,.28);
        box-shadow: 0 18px 44px rgba(0,0,0,.28);
        color: #fff;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .sv-stage-video-wrap {
        position: relative;
        min-height: 280px;
        background:
          radial-gradient(circle at 30% 20%, rgba(59,130,246,.25), transparent 28%),
          linear-gradient(135deg, #020617, #111827);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #sceneVideoMain {
        width: 100%;
        height: 360px;
        max-height: 52vh;
        object-fit: cover;
        display: none;
        background: #020617;
      }

      #sceneVideoEmpty {
        padding: 42px 22px;
        text-align: center;
        color: #cbd5e1;
      }

      #sceneVideoEmpty strong {
        display: block;
        color: #fff;
        font-size: 22px;
        margin-bottom: 8px;
      }

      #sceneVideoSubtitle {
        position: absolute;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        max-width: 88%;
        background: rgba(15,23,42,.82);
        color: #fff;
        padding: 12px 18px;
        border-radius: 14px;
        font-weight: 950;
        font-size: clamp(19px, 3vw, 32px);
        line-height: 1.18;
        text-align: center;
        text-shadow: 0 2px 10px rgba(0,0,0,.5);
        display: none;
      }

      .sv-stage-toolbar {
        display: flex;
        gap: 10px;
        padding: 12px;
        background: rgba(15,23,42,.98);
        border-top: 1px solid rgba(148,163,184,.2);
        flex-wrap: wrap;
      }

      #sceneVideoCurrent {
        flex: 1;
        min-width: 220px;
        display: flex;
        align-items: center;
        color: #cbd5e1;
        font-weight: 800;
        font-size: 14px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .sv-stage-btn {
        border: none;
        border-radius: 14px;
        padding: 12px 14px;
        font-weight: 950;
        cursor: pointer;
        color: #fff;
        background: #2563eb;
      }

      .sv-stage-btn.dark {
        background: #334155;
      }

      .sv-stage-btn.green {
        background: #16a34a;
      }

      #sceneVideoFab {
        position: fixed;
        right: 22px;
        bottom: 28px;
        z-index: 999999;
        border: none;
        border-radius: 999px;
        padding: 15px 22px;
        font-weight: 900;
        font-size: 15px;
        background: #020617;
        color: white;
        box-shadow: 0 14px 34px rgba(0,0,0,.30);
        cursor: pointer;
      }

      #sceneVideoPanel {
        position: fixed;
        right: 22px;
        bottom: 92px;
        width: min(500px, calc(100vw - 32px));
        max-height: 82vh;
        overflow: auto;
        background: white;
        border-radius: 22px;
        box-shadow: 0 24px 65px rgba(0,0,0,.28);
        z-index: 999999;
        display: none;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #111827;
      }

      #sceneVideoPanel.open {
        display: block;
      }

      .sv-head {
        position: sticky;
        top: 0;
        z-index: 2;
        background: white;
        padding: 16px 18px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .sv-title {
        font-size: 18px;
        font-weight: 950;
      }

      .sv-close {
        border: none;
        border-radius: 12px;
        background: #f3f4f6;
        padding: 9px 13px;
        font-weight: 900;
        cursor: pointer;
      }

      .sv-body {
        padding: 16px 18px 18px;
      }

      .sv-warning {
        background: #fff7ed;
        color: #9a3412;
        border: 1px solid #fed7aa;
        border-radius: 14px;
        padding: 12px;
        font-size: 13px;
        line-height: 1.45;
        margin-bottom: 14px;
      }

      .sv-field {
        margin-bottom: 12px;
      }

      .sv-label {
        display: block;
        font-size: 13px;
        font-weight: 900;
        color: #374151;
        margin-bottom: 6px;
      }

      .sv-input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #d1d5db;
        border-radius: 14px;
        padding: 12px 13px;
        font-size: 15px;
        outline: none;
      }

      .sv-row {
        display: flex;
        gap: 10px;
        margin-top: 10px;
        flex-wrap: wrap;
      }

      .sv-btn {
        border: none;
        border-radius: 14px;
        padding: 12px 14px;
        font-weight: 950;
        font-size: 14px;
        cursor: pointer;
      }

      .sv-btn.primary {
        background: #2563eb;
        color: white;
        flex: 1;
        min-width: 150px;
      }

      .sv-btn.secondary {
        background: #eef2ff;
        color: #1e3a8a;
      }

      .sv-btn.danger {
        background: #fee2e2;
        color: #991b1b;
      }

      #svStatus {
        min-height: 20px;
        margin: 13px 0;
        color: #4b5563;
        font-size: 13px;
        line-height: 1.45;
        font-weight: 650;
      }

      @media(max-width: 640px) {
        #sceneVideoStage {
          width: calc(100vw - 18px);
          margin: 10px auto;
          border-radius: 18px;
        }

        #sceneVideoMain {
          height: 260px;
          max-height: 44vh;
        }

        .sv-stage-toolbar {
          flex-direction: column;
        }

        .sv-stage-btn {
          width: 100%;
        }

        #sceneVideoFab {
          right: 12px;
          bottom: 18px;
          padding: 13px 16px;
          font-size: 13px;
        }

        #sceneVideoPanel {
          left: 10px;
          right: 10px;
          bottom: 78px;
          width: auto;
          max-height: 78vh;
        }

        .sv-row {
          flex-direction: column;
        }

        .sv-btn {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createStage() {
    const stage = document.createElement("div");
    stage.id = "sceneVideoStage";
    stage.innerHTML = `
      <div class="sv-stage-video-wrap">
        <video id="sceneVideoMain" controls playsinline></video>
        <div id="sceneVideoEmpty">
          <strong>🎬 Sahne videosu</strong>
          Henüz video seçilmedi.<br>
          Video Ara dediğinde ilk bulunan video otomatik buraya gelir.
        </div>
        <div id="sceneVideoSubtitle"></div>
      </div>

      <div class="sv-stage-toolbar">
        <div id="sceneVideoCurrent">Aktif İngilizce cümle aranıyor...</div>
        <button id="sceneVideoSpeak" class="sv-stage-btn" type="button">🔊 Cümleyi Seslendir</button>
        <button id="sceneVideoSlow" class="sv-stage-btn dark" type="button">🐢 Yavaş</button>
        <button id="sceneVideoOpenPanel" class="sv-stage-btn green" type="button">🎬 Video Bul</button>
      </div>
    `;

    const practiceCard = findPracticeCard();
    if (practiceCard && practiceCard.parentElement) {
      practiceCard.parentElement.insertBefore(stage, practiceCard);
      return;
    }

    const host =
      document.querySelector("main") ||
      document.querySelector("#app") ||
      document.querySelector("#root") ||
      document.body;

    host.insertBefore(stage, host.firstElementChild);
  }

  function createPanel() {
    const fab = document.createElement("button");
    fab.id = "sceneVideoFab";
    fab.type = "button";
    fab.textContent = "🎬 Sahne Videosu Bul";

    const panel = document.createElement("div");
    panel.id = "sceneVideoPanel";
    panel.innerHTML = `
      <div class="sv-head">
        <div class="sv-title">Sahne Videosu Bul</div>
        <button class="sv-close" id="sceneVideoClose" type="button">Kapat</button>
      </div>

      <div class="sv-body">
        <div class="sv-warning">
          Arama her zaman doğru İngilizce cevapla yapılır:
          <b>speaking video : doğru İngilizce cümle</b>.
          İlk bulunan video otomatik sahneye verilir. Ses ayrıca program tarafından okunur.
        </div>

        <div class="sv-field">
          <label class="sv-label">Pexels API Key</label>
          <input id="svApiKey" class="sv-input" type="password" placeholder="Pexels API anahtarını yaz">
        </div>

        <div class="sv-row">
          <button id="svSaveKey" class="sv-btn secondary" type="button">API Key Kaydet</button>
          <button id="svDeleteKey" class="sv-btn danger" type="button">API Key Sil</button>
        </div>

        <div class="sv-field" style="margin-top:14px;">
          <label class="sv-label">Arama cümlesi</label>
          <input id="svQuery" class="sv-input" type="text" readonly>
        </div>

        <div class="sv-row">
          <button id="svAutoQuery" class="sv-btn secondary" type="button">Cümleden Üret</button>
          <button id="svSearch" class="sv-btn primary" type="button">Video Ara ve İlkini Kullan</button>
        </div>

        <div id="svStatus"></div>
      </div>
    `;

    document.body.appendChild(panel);
    document.body.appendChild(fab);

    dbGet(API_KEY).then(key => {
      const input = document.getElementById("svApiKey");
      if (input && key) input.value = key;
    });
  }

  function bindEvents() {
    document.getElementById("sceneVideoSpeak").onclick = () => speakCurrentSentence(1);
    document.getElementById("sceneVideoSlow").onclick = () => speakCurrentSentence(0.72);
    document.getElementById("sceneVideoOpenPanel").onclick = openPanel;
    document.getElementById("sceneVideoFab").onclick = openPanel;
    document.getElementById("sceneVideoClose").onclick = closePanel;

    document.getElementById("svSaveKey").onclick = async () => {
      const key = document.getElementById("svApiKey").value.trim();
      if (!key) return setStatus("API key boş.");
      await dbSet(API_KEY, key);
      setStatus("API key kaydedildi.");
    };

    document.getElementById("svDeleteKey").onclick = async () => {
      await dbDelete(API_KEY);
      document.getElementById("svApiKey").value = "";
      setStatus("API key silindi.");
    };

    document.getElementById("svAutoQuery").onclick = () => {
      fillQuery();
      setStatus("Arama cümlesi doğru İngilizce cevaptan üretildi.");
    };

    document.getElementById("svSearch").onclick = searchAndUseFirst;
  }

  function openPanel() {
    const panel = document.getElementById("sceneVideoPanel");
    panel.classList.add("open");
    fillQuery();
  }

  function closePanel() {
    const panel = document.getElementById("sceneVideoPanel");
    if (panel) panel.classList.remove("open");
  }

  function setStatus(msg) {
    const el = document.getElementById("svStatus");
    if (el) el.textContent = msg || "";
  }

  function fillQuery() {
    const input = document.getElementById("svQuery");
    if (input) input.value = buildQuery();
  }

  function buildQuery() {
    const en = getTargetEnglishSentence();
    return en ? PREFIX + en : PREFIX.trim();
  }

  function findPracticeCard() {
    const all = Array.from(document.querySelectorAll("section, article, div"));

    return all.find(el => {
      const t = el.innerText || "";
      return t.includes("TÜRKÇESİ") && t.includes("Cümleyi oku") && t.includes("Temizle");
    }) || null;
  }

  function cleanText(t) {
    return String(t || "")
      .replace(/\s+/g, " ")
      .replace(/^Doğrusu:\s*/i, "")
      .replace(/^Correct:\s*/i, "")
      .replace(/^Answer:\s*/i, "")
      .trim();
  }

  function looksEnglish(t) {
    if (!t) return false;
    if (t.length < 4 || t.length > 180) return false;
    if (!/[a-zA-Z]/.test(t)) return false;
    if (/[çğıöşüÇĞİÖŞÜ]/.test(t)) return false;

    return !/Pexels|Video|API|Kaynağı|Kapat|Temizle|Kontrol|Cümleyi|Sahne|Aktif|Türkçesi|TÜRKÇESİ|Kelime|Yavaş|Seslendir|Sıradaki/i.test(t);
  }

  function getCurrentObject() {
    const candidates = [
      window.currentSentence,
      window.activeSentence,
      window.currentRow,
      window.activeRow,
      window.selectedSentence,
      window.currentItem,
      window.activeItem,
      window.currentExercise,
      window.activeExercise,
      window.currentQuestion,
      window.question,
      window.exercise,
      window.activeData,
      window.currentData
    ];

    return candidates.find(x => x && typeof x === "object") || null;
  }

  function getTargetEnglishSentence() {
    return (
      getEnglishFromObject() ||
      getEnglishFromCorrectText() ||
      getEnglishFromSelectors() ||
      getEnglishFromVisibleText() ||
      ""
    );
  }

  function getEnglishFromObject() {
    const row = getCurrentObject();
    if (!row) return "";

    const val =
      row.CorrectSentenceEN ||
      row.correctSentenceEN ||
      row.correct_sentence_en ||
      row.CorrectAnswerEN ||
      row.correctAnswerEN ||
      row.correct_answer_en ||
      row.AnswerEN ||
      row.answerEN ||
      row.answer_en ||
      row.SentenceEN ||
      row.sentence_en ||
      row.EnglishSentence ||
      row.english_sentence ||
      row.English ||
      row.english ||
      row.Sentence ||
      row.sentence ||
      row.correctSentence ||
      row.correct_sentence ||
      row.correctAnswer ||
      row.correct_answer ||
      row.answer ||
      row.Answer ||
      row.en ||
      row.EN ||
      "";

    const out = cleanText(val);
    return looksEnglish(out) ? out : "";
  }

  function getEnglishFromCorrectText() {
    const bodyText = document.body.innerText || "";

    const patterns = [
      /Doğrusu:\s*([A-Z][^\n\r]+)/i,
      /Correct:\s*([A-Z][^\n\r]+)/i,
      /Answer:\s*([A-Z][^\n\r]+)/i
    ];

    for (const p of patterns) {
      const m = bodyText.match(p);
      if (m && m[1]) {
        const found = cleanText(m[1]);
        if (looksEnglish(found)) return found;
      }
    }

    return "";
  }

  function getEnglishFromSelectors() {
    const selectors = [
      "#correctSentence",
      "#sentenceEn",
      "#currentSentenceEn",
      "#englishSentence",
      "#mainSentence",
      "#sentenceText",
      ".correct-sentence",
      ".sentence-en",
      ".english-sentence",
      ".main-sentence",
      ".answer-en",
      "[data-sentence-en]",
      "[data-correct-en]",
      "[data-answer-en]"
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;

      const val = cleanText(
        el.value ||
        el.textContent ||
        el.getAttribute("data-sentence-en") ||
        el.getAttribute("data-correct-en") ||
        el.getAttribute("data-answer-en") ||
        ""
      );

      if (looksEnglish(val)) return val;
    }

    return "";
  }

  function getEnglishFromVisibleText() {
    const candidates = Array.from(document.querySelectorAll("div,p,span,h1,h2,h3,strong"))
      .map(el => cleanText(el.textContent))
      .filter(looksEnglish)
      .filter(t => /^(I|You|We|They|He|She|It|The|A|An|This|That|There|Would|Could|Can|Do|Does|Did|Have|Has|Had|Will|Are|Is|Am|Was|Were|How|What|Where|When|Why|Who)\b/i.test(t));

    return candidates[0] || "";
  }

  function updateSentenceUI() {
    const en = getTargetEnglishSentence();
    const current = document.getElementById("sceneVideoCurrent");
    const sub = document.getElementById("sceneVideoSubtitle");
    const panel = document.getElementById("sceneVideoPanel");

    if (current) {
      current.textContent = en || "Aktif İngilizce cümle bulunamadı. Cevabı kontrol edince yakalanır.";
    }

    if (sub) {
      sub.textContent = en || "";
      sub.style.display = en ? "block" : "none";
    }

    if (panel && panel.classList.contains("open")) {
      fillQuery();
    }
  }

  async function searchAndUseFirst() {
    const apiInput = document.getElementById("svApiKey");
    const apiKey = apiInput ? apiInput.value.trim() : "";
    const sentence = getTargetEnglishSentence();
    const query = buildQuery();

    fillQuery();

    if (!apiKey) {
      setStatus("API key yok. Önce Pexels API key gir.");
      return;
    }

    if (!sentence) {
      setStatus("Doğru İngilizce cevap cümlesi yakalanamadı.");
      return;
    }

    await dbSet(API_KEY, apiKey);

    setStatus("Aranıyor: " + query);

    const url = new URL("https://api.pexels.com/videos/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "8");
    url.searchParams.set("orientation", "landscape");

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: apiKey }
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("API key hatalı.");
        if (res.status === 429) throw new Error("Pexels limit doldu.");
        throw new Error("Pexels API hatası: " + res.status);
      }

      const data = await res.json();
      const videos = Array.isArray(data.videos) ? data.videos : [];

      if (!videos.length) {
        setStatus("Video bulunamadı.");
        return;
      }

      const first = videos[0];
      const file = pickVideoFile(first);

      if (!file || !file.link) {
        setStatus("İlk videoda kullanılabilir mp4 linki yok.");
        return;
      }

      const payload = {
        source: "pexels",
        id: first.id || "",
        pageUrl: first.url || "",
        videoUrl: file.link,
        posterUrl: first.image || "",
        query,
        sentence,
        savedAt: new Date().toISOString()
      };

      applyVideo(payload);
      saveSelectedVideo(payload);
      closePanel();

      setStatus("İlk video otomatik sahneye verildi.");
      setTimeout(() => speakSentence(sentence, 1), 350);
    } catch (e) {
      console.error(e);
      setStatus("Video arama hatası: " + e.message);
    }
  }

  function pickVideoFile(video) {
    const files = Array.isArray(video.video_files) ? video.video_files : [];

    const mp4s = files
      .filter(f => f.file_type === "video/mp4" && f.link)
      .sort((a, b) => Math.abs(1280 - (a.width || 0)) - Math.abs(1280 - (b.width || 0)));

    return mp4s[0] || files.find(f => f.link) || null;
  }

  function applyVideo(payload) {
    const video = document.getElementById("sceneVideoMain");
    const empty = document.getElementById("sceneVideoEmpty");

    if (!video) return;

    video.src = payload.videoUrl;

    if (payload.posterUrl) {
      video.poster = payload.posterUrl;
    }

    video.controls = true;
    video.playsInline = true;
    video.loop = true;
    video.muted = true;
    video.volume = 0;
    video.style.display = "block";

    if (empty) empty.style.display = "none";

    video.load();
    video.play().catch(() => {});

    updateSentenceUI();
  }

  async function saveSelectedVideo(payload) {
    await dbSet(VIDEO_PREFIX + hash(payload.sentence), JSON.stringify(payload));

    const row = getCurrentObject();

    if (row) {
      row.VideoURL = payload.videoUrl;
      row.video_url = payload.videoUrl;
      row.videoUrl = payload.videoUrl;
      row.VideoPoster = payload.posterUrl;
      row.video_poster = payload.posterUrl;
      row.VideoQuery = payload.query;
      row.video_query = payload.query;
    }

    if (typeof window.saveCurrentSentence === "function") {
      try { window.saveCurrentSentence(row); } catch (e) {}
    }

    if (typeof window.persistCurrentData === "function") {
      try { window.persistCurrentData(); } catch (e) {}
    }

    if (typeof window.saveToIndexedDB === "function") {
      try { window.saveToIndexedDB(); } catch (e) {}
    }
  }

  async function loadSelectedVideo() {
    const sentence = getTargetEnglishSentence();
    if (!sentence) return;

    const raw = await dbGet(VIDEO_PREFIX + hash(sentence));
    if (!raw) return;

    try {
      const payload = JSON.parse(raw);
      if (payload && payload.videoUrl) {
        applyVideo(payload);
      }
    } catch (e) {}
  }

  function pickEnglishVoice() {
    const voices = window.speechSynthesis.getVoices() || [];

    return (
      voices.find(v => /^en-US/i.test(v.lang) && /Google|Samantha|Jenny|Aria|Zira|Natural/i.test(v.name)) ||
      voices.find(v => /^en-GB/i.test(v.lang)) ||
      voices.find(v => /^en/i.test(v.lang)) ||
      null
    );
  }

  function speakCurrentSentence(rate) {
    const sentence = getTargetEnglishSentence();
    speakSentence(sentence, rate || 1);
  }

  function speakSentence(sentence, rate) {
    const text = cleanText(sentence);

    if (!text) {
      setStatus("Seslendirilecek İngilizce cümle bulunamadı.");
      return;
    }

    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate || 1;
    u.pitch = 1;
    u.volume = 1;

    const voice = pickEnglishVoice();
    if (voice) u.voice = voice;

    const video = document.getElementById("sceneVideoMain");
    if (video && video.src) {
      try {
        video.currentTime = 0;
        video.muted = true;
        video.play().catch(() => {});
      } catch (e) {}
    }

    window.speechSynthesis.speak(u);
  }

  function hash(str) {
    let h = 0;
    str = String(str || "");

    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }

    return Math.abs(h).toString(36);
  }
})();