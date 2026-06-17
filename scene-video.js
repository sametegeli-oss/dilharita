/* scene-video.js
   Practice ekranı için sahne videosu modülü.
   Mantık:
   - Practice kodundan gelen doğru İngilizce cevap cümlesini alır.
   - Aramayı her zaman "speaking video : <doğru İngilizce cümle>" şeklinde yapar.
   - Pexels'te ilk bulunan videoyu otomatik sahneye yerleştirir.
   - Pexels videosu sessiz/alakasız olabileceği için cümle sesi Web Speech TTS ile ayrıca okunur.
*/
(function () {
  "use strict";

  const PREFIX = "speaking video : ";
  const DB_NAME = "dilharita_scene_video_db_v1";
  const STORE = "kv";
  const API_KEY = "pexels_api_key";
  const VIDEO_PREFIX = "selected_video_";

  const Current = {
    id: "",
    en: "",
    tr: "",
    meta: null
  };

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

    clearOldSceneVideoDom();
    injectStyle();
    createPanel();
    bindEvents();

    // Practice sayfası bu fonksiyonu çağıracak.
    window.setPracticeAnswerForSceneVideo = setPracticeAnswerForSceneVideo;

    // Practice kodu event gönderirse yakala.
    window.addEventListener("practice-answer-ready", function (ev) {
      const d = ev.detail || {};
      setPracticeAnswerForSceneVideo(d.en || "", d);
    });

    // Eğer scene-video.js geç yüklendiyse, önceden yazılmış global cevabı al.
    if (window.__SCENE_VIDEO_ANSWER_EN) {
      setPracticeAnswerForSceneVideo(window.__SCENE_VIDEO_ANSWER_EN, {
        id: window.__SCENE_VIDEO_ANSWER_ID || "",
        en: window.__SCENE_VIDEO_ANSWER_EN || "",
        tr: window.__SCENE_VIDEO_ANSWER_TR || ""
      });
    } else if (document.documentElement.dataset.sceneVideoAnswerEn) {
      setPracticeAnswerForSceneVideo(document.documentElement.dataset.sceneVideoAnswerEn, {
        id: document.documentElement.dataset.sceneVideoAnswerId || "",
        en: document.documentElement.dataset.sceneVideoAnswerEn || "",
        tr: document.documentElement.dataset.sceneVideoAnswerTr || ""
      });
    }

    dbGet(API_KEY).then(function (key) {
      const input = document.getElementById("svApiKey");
      if (input && key) input.value = key;
    });

    // Render değişimlerinden sonra sahne alanı kaybolursa geri getir.
    const root = document.getElementById("root");
    if (root && window.MutationObserver) {
      const mo = new MutationObserver(function () {
        if (Current.en) {
          ensureStage();
          updateSentenceUI();
        }
      });
      mo.observe(root, { childList: true, subtree: false });
    }

    setInterval(function () {
      if (Current.en) {
        ensureStage();
        updateSentenceUI();
      }
    }, 1200);

    window.SceneVideo = {
      open: openPanel,
      close: closePanel,
      getSentence: function () { return Current.en; },
      buildQuery,
      searchAndUseFirst,
      speak: speakCurrentSentence,
      setAnswer: setPracticeAnswerForSceneVideo
    };
  }

  function clearOldSceneVideoDom() {
    [
      "#sceneVideoStage",
      "#sceneVideoPanel",
      "#sceneVideoFab",
      "#sceneVideoStyle",
      "#scenePracticeStage",
      "#sceneVideoUseFixStage",
      "#autoSpeakingVideoStage",
      "#sceneVoiceBar",
      "#sceneSentenceVoiceStyle",
      "#autoSceneVideoWrap"
    ].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { el.remove(); });
    });
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
    if (t.length < 2 || t.length > 260) return false;
    if (!/[a-zA-Z]/.test(t)) return false;
    if (/[çğıöşüÇĞİÖŞÜ]/.test(t)) return false;
    return !/Pexels|Video|API|Kaynağı|Kapat|Temizle|Kontrol|Cümleyi|Sahne|Aktif|Türkçesi|TÜRKÇESİ|Kelime|Yavaş|Seslendir|Sıradaki/i.test(t);
  }

  function setPracticeAnswerForSceneVideo(answerEn, meta) {
    const en = cleanText(answerEn);

    if (!looksEnglish(en)) {
      console.warn("SceneVideo: İngilizce cevap alınamadı:", answerEn);
      return;
    }

    Current.en = en;
    Current.tr = cleanText((meta && meta.tr) || window.__SCENE_VIDEO_ANSWER_TR || "");
    Current.id = String((meta && meta.id) || window.__SCENE_VIDEO_ANSWER_ID || hash(en));
    Current.meta = meta || null;

    window.__SCENE_VIDEO_ANSWER_EN = Current.en;
    window.__SCENE_VIDEO_ANSWER_TR = Current.tr;
    window.__SCENE_VIDEO_ANSWER_ID = Current.id;

    try {
      document.documentElement.dataset.sceneVideoAnswerEn = Current.en;
      document.documentElement.dataset.sceneVideoAnswerTr = Current.tr;
      document.documentElement.dataset.sceneVideoAnswerId = Current.id;
    } catch {}

    ensureStage();
    updateSentenceUI();
    fillQuery();
    loadSelectedVideo();
  }

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB desteklenmiyor."));
        return;
      }

      const req = indexedDB.open(DB_NAME, 1);

      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };

      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("IndexedDB açılamadı.")); };
    });
  }

  async function dbSet(key, value) {
    try {
      const db = await openDB();

      await new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(String(value || ""), key);
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error || new Error("IndexedDB yazma hatası.")); };
      });

      db.close();
      return true;
    } catch (e) {
      console.warn("SceneVideo IndexedDB kayıt hatası:", e);
      return false;
    }
  }

  async function dbGet(key) {
    try {
      const db = await openDB();

      const result = await new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = function () { resolve(req.result || ""); };
        req.onerror = function () { reject(req.error || new Error("IndexedDB okuma hatası.")); };
      });

      db.close();
      return result || "";
    } catch (e) {
      console.warn("SceneVideo IndexedDB okuma hatası:", e);
      return "";
    }
  }

  async function dbDelete(key) {
    try {
      const db = await openDB();

      await new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error || new Error("IndexedDB silme hatası.")); };
      });

      db.close();
    } catch (e) {
      console.warn("SceneVideo IndexedDB silme hatası:", e);
    }
  }

  function injectStyle() {
    if (document.getElementById("sceneVideoStyle")) return;

    const style = document.createElement("style");
    style.id = "sceneVideoStyle";
    style.textContent = `
      #sceneVideoStage {
        width: 100%;
        margin: 0 0 18px;
        border-radius: 22px;
        overflow: hidden;
        background: #020617;
        border: 1px solid rgba(148,163,184,.28);
        box-shadow: 0 18px 44px rgba(0,0,0,.24);
        color: #fff;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .sv-stage-video-wrap {
        position: relative;
        min-height: 260px;
        background:
          radial-gradient(circle at 30% 20%, rgba(59,130,246,.25), transparent 28%),
          linear-gradient(135deg, #020617, #111827);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #sceneVideoMain {
        width: 100%;
        height: 340px;
        max-height: 48vh;
        object-fit: cover;
        display: none;
        background: #020617;
      }

      #sceneVideoEmpty {
        padding: 40px 22px;
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
        max-width: 90%;
        background: rgba(15,23,42,.84);
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

      .sv-stage-btn.dark { background: #334155; }
      .sv-stage-btn.green { background: #16a34a; }

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

      #sceneVideoPanel.open { display: block; }

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

      .sv-title { font-size: 18px; font-weight: 950; }

      .sv-close {
        border: none;
        border-radius: 12px;
        background: #f3f4f6;
        padding: 9px 13px;
        font-weight: 900;
        cursor: pointer;
      }

      .sv-body { padding: 16px 18px 18px; }

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

      .sv-field { margin-bottom: 12px; }

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

      .sv-btn.secondary { background: #eef2ff; color: #1e3a8a; }
      .sv-btn.danger { background: #fee2e2; color: #991b1b; }

      #svStatus {
        min-height: 20px;
        margin: 13px 0;
        color: #4b5563;
        font-size: 13px;
        line-height: 1.45;
        font-weight: 650;
      }

      @media(max-width: 640px) {
        #sceneVideoStage { border-radius: 18px; }
        #sceneVideoMain { height: 250px; max-height: 42vh; }
        .sv-stage-toolbar { flex-direction: column; }
        .sv-stage-btn { width: 100%; }

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

        .sv-row { flex-direction: column; }
        .sv-btn { width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureStage() {
    if (!Current.en) return;

    let stage = document.getElementById("sceneVideoStage");
    if (stage) return;

    stage = document.createElement("div");
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

    const stageHost = document.querySelector("#root .stage");
    const card = document.querySelector("#root .stage .card");

    if (stageHost && card) {
      stageHost.insertBefore(stage, card);
    } else {
      const root = document.getElementById("root") || document.body;
      root.insertBefore(stage, root.firstElementChild);
    }

    const speakBtn = document.getElementById("sceneVideoSpeak");
    const slowBtn = document.getElementById("sceneVideoSlow");
    const openBtn = document.getElementById("sceneVideoOpenPanel");

    if (speakBtn) speakBtn.onclick = function () { speakCurrentSentence(1); };
    if (slowBtn) slowBtn.onclick = function () { speakCurrentSentence(0.72); };
    if (openBtn) openBtn.onclick = openPanel;
  }

  function createPanel() {
    if (document.getElementById("sceneVideoPanel")) return;

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
          <label class="sv-label" for="svApiKey">Pexels API Key</label>
          <input id="svApiKey" class="sv-input" type="password" placeholder="Pexels API anahtarını yaz">
        </div>

        <div class="sv-row">
          <button id="svSaveKey" class="sv-btn secondary" type="button">API Key Kaydet</button>
          <button id="svDeleteKey" class="sv-btn danger" type="button">API Key Sil</button>
        </div>

        <div class="sv-field" style="margin-top:14px;">
          <label class="sv-label" for="svQuery">Arama cümlesi</label>
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
  }

  function bindEvents() {
    const fab = document.getElementById("sceneVideoFab");
    const close = document.getElementById("sceneVideoClose");
    const save = document.getElementById("svSaveKey");
    const del = document.getElementById("svDeleteKey");
    const auto = document.getElementById("svAutoQuery");
    const search = document.getElementById("svSearch");

    if (fab) fab.onclick = openPanel;
    if (close) close.onclick = closePanel;

    if (save) {
      save.onclick = async function () {
        const key = (document.getElementById("svApiKey") || {}).value || "";
        if (!key.trim()) return setStatus("API key boş.");
        await dbSet(API_KEY, key.trim());
        setStatus("API key kaydedildi.");
      };
    }

    if (del) {
      del.onclick = async function () {
        await dbDelete(API_KEY);
        const input = document.getElementById("svApiKey");
        if (input) input.value = "";
        setStatus("API key silindi.");
      };
    }

    if (auto) {
      auto.onclick = function () {
        fillQuery();
        setStatus(Current.en ? "Arama cümlesi doğru İngilizce cevaptan üretildi." : "Doğru İngilizce cümle henüz gelmedi.");
      };
    }

    if (search) search.onclick = searchAndUseFirst;
  }

  function openPanel() {
    ensureStage();

    const panel = document.getElementById("sceneVideoPanel");
    if (panel) panel.classList.add("open");

    fillQuery();
    updateSentenceUI();

    dbGet(API_KEY).then(function (key) {
      const input = document.getElementById("svApiKey");
      if (input && key && !input.value.trim()) input.value = key;
    });
  }

  function closePanel() {
    const panel = document.getElementById("sceneVideoPanel");
    if (panel) panel.classList.remove("open");
  }

  function setStatus(msg) {
    const el = document.getElementById("svStatus");
    if (el) el.textContent = msg || "";
  }

  function buildQuery() {
    return Current.en ? PREFIX + Current.en : PREFIX.trim();
  }

  function fillQuery() {
    const input = document.getElementById("svQuery");
    if (input) input.value = buildQuery();
  }

  function updateSentenceUI() {
    const current = document.getElementById("sceneVideoCurrent");
    const sub = document.getElementById("sceneVideoSubtitle");
    const panel = document.getElementById("sceneVideoPanel");

    if (current) {
      current.textContent = Current.en || "Aktif İngilizce cümle bulunamadı.";
    }

    if (sub) {
      sub.textContent = Current.en || "";
      sub.style.display = Current.en ? "block" : "none";
    }

    if (panel && panel.classList.contains("open")) fillQuery();
  }

  async function searchAndUseFirst() {
    const apiInput = document.getElementById("svApiKey");
    const apiKey = apiInput ? apiInput.value.trim() : "";
    const sentence = Current.en;
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
        sentenceId: Current.id || hash(sentence),
        savedAt: new Date().toISOString()
      };

      applyVideo(payload);
      await saveSelectedVideo(payload);
      closePanel();

      setStatus("İlk video otomatik sahneye verildi.");
      setTimeout(function () { speakSentence(sentence, 1); }, 350);
    } catch (e) {
      console.error(e);
      setStatus("Video arama hatası: " + e.message);
    }
  }

  function pickVideoFile(video) {
    const files = Array.isArray(video.video_files) ? video.video_files : [];

    const mp4s = files
      .filter(function (f) { return f.file_type === "video/mp4" && f.link; })
      .sort(function (a, b) {
        return Math.abs(1280 - (a.width || 0)) - Math.abs(1280 - (b.width || 0));
      });

    return mp4s[0] || files.find(function (f) { return f.link; }) || null;
  }

  function applyVideo(payload) {
    ensureStage();

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

    // Stok video sesi çoğunlukla yok/alakasız; cümle sesi TTS ile veriliyor.
    video.muted = true;
    video.volume = 0;
    video.style.display = "block";

    if (empty) empty.style.display = "none";

    video.load();
    video.play().catch(function () {});

    updateSentenceUI();
  }

  async function saveSelectedVideo(payload) {
    const key = VIDEO_PREFIX + (payload.sentenceId || hash(payload.sentence));
    await dbSet(key, JSON.stringify(payload));

    // Practice ana verisine de iliştir; varsa mevcut kayıt fonksiyonlarını çağır.
    const row = window.__SCENE_VIDEO_ANSWER_OBJ || null;

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
    if (!Current.en) return;

    const key = VIDEO_PREFIX + (Current.id || hash(Current.en));
    const raw = await dbGet(key);
    if (!raw) return;

    try {
      const payload = JSON.parse(raw);
      if (payload && payload.videoUrl) applyVideo(payload);
    } catch (e) {}
  }

  function pickEnglishVoice() {
    const voices = window.speechSynthesis.getVoices() || [];

    return (
      voices.find(function (v) { return /^en-US/i.test(v.lang) && /Google|Samantha|Jenny|Aria|Zira|Natural/i.test(v.name); }) ||
      voices.find(function (v) { return /^en-GB/i.test(v.lang); }) ||
      voices.find(function (v) { return /^en/i.test(v.lang); }) ||
      null
    );
  }

  function speakCurrentSentence(rate) {
    speakSentence(Current.en, rate || 1);
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
        video.play().catch(function () {});
      } catch (e) {}
    }

    window.speechSynthesis.speak(u);
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () {};
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
