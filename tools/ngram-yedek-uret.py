# -*- coding: utf-8 -*-
"""data/ngram-yedek.json ureticisi.

Canli Google Books Ngram cagrisi basarisiz olursa (cevrimdisi, proxy kapali,
Google hiz siniri) popup bu dosyadaki degerleri kullanir.

Degerler wordfreq kutuphanesinden gelir ve Ngram ile AYNI BIRIMDEDIR:
kelimenin toplam kelime sayisina orani (yuzde degil, oran).
Ngram degerinin yerine gecmez, yaklasigidir; arayuz bunu "~" ile isaretler.

Kurulum:     pip install wordfreq
Calistirma:  python3 tools/ngram-yedek-uret.py
"""
import json, os
from wordfreq import word_frequency

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GIRDI = os.path.join(KOK, "data", "dictionary.json")
CIKTI = os.path.join(KOK, "data", "ngram-yedek.json")


def main():
    sozluk = json.load(open(GIRDI, encoding="utf-8"))
    out = {}
    for w in sozluk:
        f = word_frequency(w, "en")
        if f > 0:
            # 3 anlamli basamak yeter; dosya kucuk kalsin
            out[w] = float("%.3g" % f)
    with open(CIKTI, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    print("kelime:", len(out), "| boyut:", round(os.path.getsize(CIKTI) / 1024), "KB")


if __name__ == "__main__":
    main()
