#!/usr/bin/env bash
# kur.sh — Dil Harita optimizasyon paketi kurulumu (tek seferlik çalıştırılır)
#
# KULLANIM:
#   1) Bu dosyayı ve yanındaki güncel dosyaları repo köküne kopyala
#   2) bash kur.sh
#   3) git add -A && git commit -m "Performans + UX optimizasyonu" && git push
#
# Yaptığı işler:
#   A) Ölü / yinelenen dosyaları siler (~4.5 MB)
#   B) ux-boost.js'i tüm sayfalara ekler
#   C) Sonucu özetler
set -u
cd "$(dirname "$0")"

echo "=== A) Ölü ve yinelenen dosyalar siliniyor ==="

# Windows 8.3 kısa ad artığı — koc-modu.html'in eski kopyası, hiçbir yerden çağrılmıyor
# teacher3.html / pv.html — hiçbir sayfadan link yok
# chat-gemini-continue.js — hiçbir dosyadan yüklenmiyor
# data/translation_guide.json — kökteki dosyanın birebir kopyası (teacher.html kökteki kullanıyor)
# practice*.css — hiçbir HTML/JS tarafından referans verilmiyor
DEAD=(
  "KOC-MO~1.HTM"
  "teacher3.html"
  "pv.html"
  "chat-gemini-continue.js"
  "data/translation_guide.json"
  "practice.css"
  "css/practice.css"
  "practice-design5.css"
  "practice-design5-v2.css"
)

TOTAL=0
for f in "${DEAD[@]}"; do
  if [ -f "$f" ]; then
    SZ=$(wc -c < "$f")
    TOTAL=$((TOTAL + SZ))
    git rm -q --cached "$f" 2>/dev/null || true
    rm -f "$f"
    printf "  silindi: %-32s %6.0f KB\n" "$f" "$(echo "$SZ" | awk '{print $1/1024}')"
  else
    printf "  yok (atlandı): %s\n" "$f"
  fi
done
printf "  --> kazanç: %.1f MB\n\n" "$(echo "$TOTAL" | awk '{print $1/1048576}')"

echo "=== B) ux-boost.js sayfalara ekleniyor ==="
ADDED=0
for f in *.html; do
  case "$f" in
    koc-modu.html|pwa-reset.html|pwa-hard-reset.html) continue ;;
  esac
  if grep -q "ux-boost.js" "$f"; then
    continue
  fi
  if grep -q "</body>" "$f"; then
    # son </body> etiketinden hemen önce ekle
    perl -0777 -pi -e 's{</body>(?!.*</body>)}{<script src="./ux-boost.js?v=1"></script>\n</body>}s' "$f"
    ADDED=$((ADDED + 1))
    echo "  eklendi: $f"
  else
    echo "  ATLANDI (</body> yok): $f"
  fi
done
echo "  --> $ADDED sayfaya eklendi"
echo

echo "=== C) Özet ==="
echo "  index.html      : $(wc -c < index.html | awk '{printf "%.0f KB", $1/1024}')  (önce 448 KB)"
echo "  koc-modu.html   : $(wc -c < koc-modu.html | awk '{printf "%.1f KB", $1/1024}')  (önce 447 KB, artık index.html'e yönlendiriyor)"
echo "  repo boyutu     : $(du -sh --exclude=.git . | cut -f1)"
echo
echo "Şimdi: git add -A && git commit -m 'Performans + UX optimizasyonu' && git push"

echo "=== D) Parçalı cümle verisi kontrolü ==="
if [ -f data/sentences/index.json ]; then
  N=$(ls data/sentences/mod 2>/dev/null | wc -l)
  echo "  ✓ data/sentences/ mevcut ($N modül parçası)"
elif command -v node >/dev/null 2>&1; then
  echo "  parçalar yok, üretiliyor..."
  node veri-bol.mjs
else
  echo "  ! UYARI: data/sentences/ yok ve node kurulu değil."
  echo "    Ya zip'teki data/sentences klasörünü kopyala, ya node kurup 'node veri-bol.mjs' çalıştır."
  echo "    (Bu hâlde uygulama çalışmaya devam eder; eski data/sentences.json'a düşer.)"
fi
