#!/usr/bin/env python3
"""DİLHARİTA veri bütünlüğü ve ortak kullanıcı deneyimi iyileştirmeleri."""
from __future__ import annotations
import json, re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def load(rel):
    return json.loads((ROOT / rel).read_text(encoding="utf-8-sig"))

def save(rel, data, pretty=False):
    p = ROOT / rel
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2 if pretty else None), encoding="utf-8")

def repair_sentences():
    rows = load("data/sentences.json")
    counts, seen, migration = Counter(x.get("id", "") for x in rows), Counter(), {}
    translations = {
        "B1-M19-031": "Toplantıya katılmak zorunda değilim.",
        "B1-M19-042": "Bu formu doldurmak zorunda değilsin.",
        "B1-M19-092": "O bugün çalışmak zorunda değil.",
        "B2-M09-088": "Herhangi bir sorunuz var mı?",
    }
    same_language = {
        "Do your best": "Elinden gelenin en iyisini yap.",
        "Make a plan": "Bir plan yap.",
        "Enjoy your meal!": "Afiyet olsun!",
    }
    for row in rows:
        old = str(row.get("id", "")).strip()
        seen[old] += 1
        new = old if seen[old] == 1 else f"{old}-V{seen[old]}"
        if new != old:
            row["id"] = new
            row["sourceId"] = old
            row["variantNo"] = seen[old]
        migration.setdefault(old, []).append(new)
        if not str(row.get("tr", "")).strip() and old in translations:
            row["tr"] = translations[old]
        if row.get("en") in same_language and row.get("tr") == row.get("en"):
            row["tr"] = same_language[row["en"]]
        if row.get("stage") == "Refutation":
            row["stage"] = "Reinforcement"
    save("data/sentences.json", rows)
    save("data/id-migration.json", {
        "version": 1,
        "policy": "İlk kayıt eski kimliği korur; tekrarlar -V2, -V3 biçiminde benzersizleşir.",
        "duplicates": {k:v for k,v in migration.items() if len(v) > 1}
    }, True)
    return len(rows), sum(1 for v in counts.values() if v > 1)

def repair_excel():
    rows = load("data/excelveri.json")
    clean, seen = [], set()
    for row in rows:
        en = str(row.get("ingilizce", "")).strip()
        tr = str(row.get("türkçe", "")).strip()
        if not en and not tr: continue
        key = (en.casefold(), tr.casefold())
        if key in seen: continue
        seen.add(key)
        clean.append({"ingilizce": en, "türkçe": tr})
    save("data/excelveri.json", clean)
    return len(rows), len(clean)

def repair_guide():
    rows = load("translation_guide.json")
    current = "Genel Dilbilgisi & Çeviri"
    for row in rows:
        section = re.sub(r"\s+", " ", str(row.get("section", "")).strip())
        clean = section.replace("_", "").replace("- BÖLÜM", ". BÖLÜM").strip()
        heading = re.fullmatch(r"([1-9]|BİRİNCİ|İKİNCİ|ÜÇÜNCÜ)\s*\.?\s*BÖLÜM", clean, re.I)
        valid = bool(heading) or clean in {"Genel Dilbilgisi & Çeviri", "İÇİNDEKİLER"}
        if heading:
            token = heading.group(1).upper()
            number = {"BİRİNCİ":"1", "İKİNCİ":"2", "ÜÇÜNCÜ":"3"}.get(token, token)
            current = f"{number}. BÖLÜM"
            row["section"] = current
        elif valid:
            current = clean
            row["section"] = current
        else:
            row["sectionOriginal"] = section[:240]
            row["section"] = current
    save("translation_guide.json", rows)
    save("data/translation_guide.json", rows)
    return len(rows)

def improve_html():
    css = '<link rel="stylesheet" href="product-improvements.css">'
    js = '<script src="product-improvements.js" defer></script>'
    changed = 0
    for p in ROOT.glob("*.html"):
        text = p.read_text(encoding="utf-8-sig")
        if "product-improvements.css" not in text:
            text = re.sub(r"</head>", f"  {css}\n</head>", text, count=1, flags=re.I)
        if "product-improvements.js" not in text:
            text = re.sub(r"</body>", f"  {js}\n</body>", text, count=1, flags=re.I)
        # Gerçek tablolar için temel semantik iyileştirmeler.
        if p.name.lower() in ("pv.html", "kıblenamaz.html"):
            caption = "Phrasal verb ve Türkçe anlamları" if p.name.lower() == "pv.html" else "Yıllık namaz ve kıble saatleri"
            text = re.sub(r"<table([^>]*)>", rf'<table\1><caption class="sr-only">{caption}</caption>', text, count=1, flags=re.I)
            text = re.sub(r"<th(?![^>]*scope=)([^>]*)>", r'<th scope="col"\1>', text, flags=re.I)
        # LF korumak kaynak tabanlı testlerin ve farklı işletim sistemlerinin
        # aynı çıktıyı görmesini sağlar.
        with p.open("w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        changed += 1
    return changed

def quality_manifest():
    dictionary = load("data/dictionary.json")
    pv = load("data/phrasal-verbs.json")
    manifest = {
      "generated": "2026-08-12",
      "dictionary": {
        "total": len(dictionary),
        "unknownLevel": sum(not str(v.get("seviye", "")).strip() for v in dictionary.values()),
        "missingMeaning": sum(not v.get("anlamlar") for v in dictionary.values()),
        "missingPronunciation": sum(not str(v.get("oku", "")).strip() for v in dictionary.values())
      },
      "phrasalVerbs": {
        "total": len(pv),
        "unknownFrequency": sum(v.get("freq") in (0, None, "") for v in pv),
        "missingExamples": sum(not v.get("examples") for v in pv),
        "missingForms": sum(not v.get("forms") for v in pv),
        "missingSynonyms": sum(not v.get("synonyms") for v in pv)
      }
    }
    save("data/quality-manifest.json", manifest, True)

if __name__ == "__main__":
    print("cümle:", repair_sentences())
    print("excel:", repair_excel())
    print("rehber:", repair_guide())
    quality_manifest()
    print("html:", improve_html())
