import fs from "node:fs";
import vm from "node:vm";

let fail = 0;
const ok = (value, message) => {
  console.log(`${value ? "✓" : "✗"} ${message}`);
  if (!value) fail++;
};

const practice = fs.readFileSync("practice.html", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");

ok(/Number\(r\.last\|\|0\)>=since/.test(practice), "bugün öğrenilen cümleler ortak SRS zamanından bulunuyor");
ok(/done\["today:"\+id\]/.test(practice), "tamamlanan üretim cümleleri devam kuyruğundan çıkarılıyor");
ok(/dh-practice-evidence-"\+day/.test(practice), "devam kanıtı gün bazında okunuyor");
ok(/dh-sw-v(?:8[2-9]|9\d+)/.test(sw), "Service Worker önbellek sürümü v82 veya sonrasına yükseltildi");

const sourceFn = practice.match(/async function sourceItems\(kind\)\{[\s\S]*?\n\}/)?.[0];
const today = new Date();
const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const storage = new Map([["dh-progress-mirror-v1", "{}"]]);
const context = {
  State: { srs: { "A1-M01-P1-001": { last: Date.now(), rep: 1 } } },
  localStorage: { getItem: key => storage.get(key) ?? null },
  isoDay: () => day,
  idsToSentences: async ids => ids.map(id => ({ id, en: "I am ready." })),
  LearningErrorDB: { all: async () => [] },
  asSentence: value => value,
  console,
};
vm.createContext(context);
vm.runInContext(`${sourceFn}; globalThis.runSourceItems=sourceItems`, context);
const firstQueue = await context.runSourceItems("today");
ok(firstQueue.length === 1 && firstQueue[0].id === "A1-M01-P1-001", "boş aynada ortak SRS kanıtı üretim kuyruğunu dolduruyor");
storage.set(`dh-practice-evidence-${day}`, JSON.stringify({ "today:A1-M01-P1-001": Date.now() }));
const resumedQueue = await context.runSourceItems("today");
ok(resumedQueue.length === 0, "cevaplanan cümle devam oturumunda yeniden sorulmuyor");

process.exit(fail ? 1 : 0);
