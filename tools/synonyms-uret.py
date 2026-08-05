# -*- coding: utf-8 -*-
"""data/synonyms.json ureticisi.

Kaynak: data/dictionary.json icindeki Turkce anlamlar.
Ayni Turkce anlami (ve ayni sozcuk turunu) paylasan Ingilizce kelimeler
es anlamli sayilir. Disaridan hicbir veri gerekmez.

Calistirma:  python3 tools/synonyms-uret.py
"""
import json, re, collections, os

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GIRDI = os.path.join(KOK, "data", "dictionary.json")
CIKTI = os.path.join(KOK, "data", "synonyms.json")

# Bir anlam bu kadar cok kelimede geciyorsa ayirt edici degildir ("yapmak" gibi)
ENFAZLA_GRUP = 10
ENFAZLA_ESANLAM = 12

TUR = {"f.": "f", "i.": "i", "s.": "s", "zf.": "zf", "zm.": "zm", "ed.": "ed", "z.": "zf"}


def anlam_ayikla(g):
    """'terk etmek [f.]' -> ('terk etmek', 'f')"""
    tur = ""
    for t in re.findall(r"\[([^\]]*)\]", g):
        t = t.strip()
        if t in TUR:
            tur = TUR[t]
            break
    g = re.sub(r"\[[^\]]*\]", "", g)
    g = g.split("/")[0]
    g = re.sub(r"\s+", " ", g).strip().lower()
    return g, tur


def cekimli_mi(kelime, sozluk):
    """bigger/oldest/responds gibi cekimli bicimleri ele.
    Kok hali sozlukte varsa bu kelime cekimlidir."""
    k = kelime
    if len(k) <= 3:
        return False
    govde = []
    if k.endswith("ies"):
        govde.append(k[:-3] + "y")
    if k.endswith("ier"):
        govde.append(k[:-3] + "y")
    if k.endswith("iest"):
        govde.append(k[:-4] + "y")
    if k.endswith("ied"):
        govde.append(k[:-3] + "y")
    if k.endswith("es"):
        govde.append(k[:-2])
    if k.endswith("s") and not k.endswith("ss"):
        govde.append(k[:-1])
    if k.endswith("ing"):
        govde += [k[:-3], k[:-3] + "e"]
    if k.endswith("ed"):
        govde += [k[:-2], k[:-1]]
    if k.endswith("er"):
        govde += [k[:-2], k[:-1]]
    if k.endswith("est"):
        govde += [k[:-3], k[:-2]]
    # cift unsuz: bigger -> bigg -> big, running -> runn -> run
    for g in list(govde):
        if len(g) > 2 and g[-1] == g[-2] and g[-1] not in "aeiou":
            govde.append(g[:-1])
    for a in govde:
        if a != k and a in sozluk:
            return True
    return False


def main():
    sozluk = json.load(open(GIRDI, encoding="utf-8"))

    # 1) cekimli bicimleri ve kesme isaretli biçimleri ("city's") ele
    temiz = {w: v for w, v in sozluk.items()
             if "'" not in w and not cekimli_mi(w, sozluk)}

    # 2) anlam -> kelimeler dizini
    # NOT: sozlukteki anlamlar SIRALI. 3. ve sonraki siradakiler cogu zaman
    # nadir/argo yan anlam ("happy" -> "cakirkeyif", "ends" -> "para",
    # "ankle" -> "yurumek"). Bunlar uzerinden eslestirince sacma es anlamli
    # cikiyordu. Iki savunma katmani var:
    #   1) yalnizca ilk IKI anlam eslestirmeye girer
    #   2) tek ortak anlam yetmez: ya ikisinde de BIRINCIL anlam olacak,
    #      ya iki ortak anlam bulunacak, ya da anlam kumeleri yeterince
    #      ortusecek (Jaccard >= 0.3)
    ENFAZLA_SIRA = 2
    JACCARD_ESIK = 0.3

    dizin = collections.defaultdict(dict)      # (anlam,tur) -> {kelime: sira}
    kelime_anlam = {}                          # kelime -> {(anlam,tur): sira}
    kelime_kume = {}                           # kelime -> tum anlamlarin kumesi
    for w, v in temiz.items():
        anlamlar = v.get("anlamlar") or []
        harita, kume = {}, set()
        for i, g in enumerate(anlamlar):
            a, t = anlam_ayikla(g)
            if not a or len(a) < 2:
                continue
            kume.add(a)
            if i < ENFAZLA_SIRA and (a, t) not in harita:
                harita[(a, t)] = i
                dizin[(a, t)][w] = i
        kelime_anlam[w] = harita
        kelime_kume[w] = kume

    # Turkce govde yakinligi: "yanitlamak" ~ "yanit vermek" (ilk 4 harf).
    # Amac, 0-1 siralı eslesmelerde iki kelimenin GERCEKTEN ayni alanda
    # olup olmadigini olcmek. "ends" (biter/sonlar) ile "money" (para)
    # arasinda hicbir govde ortak degil -> eslesme reddedilir.
    def govdeler(w, haric=None):
        out = set()
        for g in (temiz[w].get("anlamlar") or []):
            a, _ = anlam_ayikla(g)
            if haric and a == haric:
                continue          # ORTAK anlamin kendisi kanit sayilmaz
            for tok in re.split(r"[^0-9a-z\u00e7\u011f\u0131\u00f6\u015f\u00fc]+", a):
                if len(tok) >= 4:
                    out.add(tok[:3])
        return out

    def ilgili(a, b, haric):
        return bool(govdeler(a, haric) & govdeler(b, haric))

    def ortusme(a, b):
        ka, kb = kelime_kume.get(a, set()), kelime_kume.get(b, set())
        if not ka or not kb:
            return 0.0
        return len(ka & kb) / float(len(ka | kb))

    cikti = {}
    for w, harita in kelime_anlam.items():
        ortak = collections.Counter()          # aday -> ortak anlam sayisi
        ikisi_birincil = set()
        for (a, t), sira in harita.items():
            grup = dizin[(a, t)]
            if len(grup) > ENFAZLA_GRUP:
                continue
            if not t and len(grup) > 4:        # tursuz anlamlar gurultulu
                continue
            for o, osira in grup.items():
                if o == w:
                    continue
                if sira == 0 and osira == 0:
                    ortak[o] += 2                 # en guclu kanit
                    ikisi_birincil.add(o)
                elif ilgili(w, o, a):
                    ortak[o] += 1
                # aksi halde: yan anlam uzerinden rastgele eslesme, atlanir

        kabul = {}
        for o, n in ortak.items():
            if n >= 1:
                kabul[o] = n
        if not kabul:
            continue
        sirali = sorted(kabul.items(), key=lambda x: (-x[1], -ortusme(w, x[0]), x[0]))
        cikti[w] = [k for k, _ in sirali][:ENFAZLA_ESANLAM]

    with open(CIKTI, "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)

    print("kelime:", len(cikti), "| dosya:", CIKTI,
          "| boyut:", round(os.path.getsize(CIKTI) / 1024), "KB")


if __name__ == "__main__":
    main()
