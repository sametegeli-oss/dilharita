/* test-profil.mjs — profile.js doğrulaması
   Tarayıcı depolarını taklit ederek seviye/profil/sıradaki modül mantığını sınar.
   Kullanım: node test-profil.mjs
*/
import fs from "node:fs";

let fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "✓" : "✗ BAŞARISIZ"}  ${m}`); if (!c) fail++; };

/* ---- sahte tarayıcı ---- */
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

/* sahte IndexedDB: verilen anahtar/değerleri imleçle döndürür */
let IDB = {};
function fakeIDB(data) {
  IDB = data;
  global.window.indexedDB = global.indexedDB = {
    open() {
      const req = {};
      setTimeout(() => {
        const keys = Object.keys(IDB);
        req.result = {
          objectStoreNames: { contains: () => true },
          close() {},
          transaction: () => ({
            objectStore: () => ({
              openCursor() {
                const cur = {};
                let i = 0;
                setTimeout(function step() {
                  if (i >= keys.length) { cur.onsuccess({ target: { result: null } }); return; }
                  const key = keys[i++];
                  cur.onsuccess({ target: { result: { key, value: IDB[key], continue: () => setTimeout(step, 0) } } });
                }, 0);
                return cur;
              }
            })
          })
        };
        req.onsuccess && req.onsuccess();
      }, 0);
      return req;
    }
  };
}

global.window = {};
fakeIDB({});

/* sahte cümle index'i (5 modül, iki seviye) */
global.window.DHSent = {
  index: async () => ({
    v: 1, total: 6, levels: ["A1", "B1"],
    modules: [
      { lvl: "A1", mod: "A1-M01", f: "a1-m01", n: 2, ids: ["A1-1", "A1-2"] },
      { lvl: "A1", mod: "A1-M02", f: "a1-m02", n: 2, ids: ["A1-3", "A1-4"] },
      { lvl: "B1", mod: "B1-M01", f: "b1-m01", n: 2, ids: ["B1-1", "B1-2"] }
    ]
  })
};

/* öğretmen anayasası taklidi */
const policyWrites = {};
global.window.DHTeacherPolicy = { set: (k, v) => { policyWrites[k] = v; } };

eval(fs.readFileSync("profile.js", "utf8"));
const P = global.window.DHProfile;

console.log("\n--- seviye ---");
ok(P.level() === null, "başlangıçta seviye yok");
ok(P.setLevel("B1") === true, "setLevel('B1') kabul edildi");
ok(P.level() === "B1", "level() 'B1' döndürüyor");
ok(localStorage.getItem("dh-level") === "B1",
   "dh-level yazıldı (gemini-lesson.js'in okuduğu anahtar — eskiden hiç yazılmıyordu)");
ok(policyWrites.seviye === "B1", "öğretmen anayasasına da yazıldı");
ok(JSON.parse(localStorage.getItem("dh-profile-v1")).seviye === "B1", "profile'a yazıldı");
ok(P.setLevel("Z9") === false, "geçersiz seviye reddediliyor");
ok(P.level() === "B1", "geçersiz denemeden sonra seviye bozulmadı");

console.log("\n--- eski kullanıcı: seviye yalnız anayasada ---");
delete store["dh-profile-v1"]; delete store["dh-level"];
localStorage.setItem("dh-teacher-policy-v1", JSON.stringify({ seviye: "A2" }));
ok(P.level() === "A2", "anayasadaki eski seviye okunuyor (veri kaybı yok)");

console.log("\n--- günlük hedef ---");
ok(P.hedef() === 5, "varsayılan hedef 5");
P.set({ gunlukHedef: 20 });
ok(P.hedef() === 20, "kurulumda seçilen hedef okunuyor");
P.set({ gunlukHedef: 99999 });
ok(P.hedef() === 5, "saçma değer varsayılana düşüyor");
P.set({ gunlukHedef: 10 });

console.log("\n--- profil birleştirme ---");
P.set({ amac: "seyahat" });
ok(P.get().amac === "seyahat" && P.get().gunlukHedef === 10,
   "set() üzerine yazmıyor, birleştiriyor");

console.log("\n--- sıradaki modül ---");
localStorage.setItem("dh-profile-v1", JSON.stringify({ seviye: "B1" }));
P.invalidate();
let mod = await P.nextModule();
ok(mod === "B1-M01",
   `seviyesi B1 olan kullanıcı A1'den değil B1'den başlıyor (${mod})`);

/* B1 tamamen öğrenilmiş olsun → alt seviyeye düşmeli (tekrar için) */
fakeIDB({ "prog:sentence:B1-1": { status: 2 }, "prog:sentence:B1-2": { status: 2 } });
P.invalidate();
mod = await P.nextModule();
ok(mod === "A1-M01", `B1 bitince alt seviye tekrar için erişilebilir (${mod})`);

/* üç ayrı deponun da sayıldığı doğrulansın */
fakeIDB({
  "prog:sentence:A1-1": { status: 2 },   // progress-engine deposu
  "sentence:A1-2": [2, 0],               // React deposu
  "srs:A1-3": { rep: 3 },                // pratik sayfaları deposu
  "prog:sentence:B1-1": { status: 2 }, "prog:sentence:B1-2": { status: 2 }
});
P.invalidate();
const st1 = await P.moduleStat("A1-M01");
ok(st1.ogrenilen === 2 && st1.yuzde === 100,
   "prog: ve sentence: depoları birlikte sayılıyor (A1-M01 %100)");
const st2 = await P.moduleStat("A1-M02");
ok(st2.ogrenilen === 1 && st2.yuzde === 50,
   "srs: deposu da sayılıyor (A1-M02 %50)");

console.log("\n--- çakışma kontrolü ---");
ok(typeof global.window.DHProgress === "undefined",
   "profile.js window.DHProgress'e DOKUNMUYOR (progress-engine.js'i ezmiyor)");

console.log(fail === 0 ? "\nSONUÇ: tüm testler geçti ✓\n" : `\nSONUÇ: ${fail} test başarısız ✗\n`);
process.exit(fail === 0 ? 0 : 1);
