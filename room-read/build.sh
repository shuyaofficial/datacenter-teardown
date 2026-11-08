#!/bin/bash
# 読み物ページ（room-read/index.html）の公開用一式を teardown-out/room/read-site/ にまとめる。
#   bash room-read/build.sh
# 1) 歩く映像の連番（render_walk.py の PNG）を WebP にする: v2/walk/f###.webp（720x1280、q70）と v2/walk/lo/f###.webp（240 幅、q50）
#    PNG より新しい WebP があれば作り直さない。
# 2) read-site/ に index.html・walk/・img/（使う静止画 1600 幅と 800 幅）を置く。
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=room-read
V=teardown-out/room/v2
PNG=teardown-out/room/work-v2/walk-png
OUT=teardown-out/room/read-site
STILLS="overview nvl72-front network ceiling hot-aisle window"
N=$(grep -o 'data-frames="[0-9]*"' "$SRC/index.html" | grep -o '[0-9][0-9]*')

mkdir -p "$V/walk/lo"
for p in "$PNG"/f*.png; do
  b=$(basename "$p" .png)
  [[ "$V/walk/$b.webp" -nt "$p" ]] || cwebp -quiet -q 70 -m 6 "$p" -o "$V/walk/$b.webp"
  [[ "$V/walk/lo/$b.webp" -nt "$p" ]] || cwebp -quiet -q 50 -m 6 -resize 240 0 "$p" -o "$V/walk/lo/$b.webp"
done
have=$(ls "$V/walk"/f*.webp | wc -l | tr -d ' ')
if [[ "$have" != "$N" ]]; then echo "連番の数が合わない: WebP $have 枚、index.html は $N 枚" >&2; exit 1; fi

rm -rf "$OUT"
mkdir -p "$OUT/walk/lo" "$OUT/img"
cp "$SRC/index.html" "$OUT/"
cp "$V/walk"/f*.webp "$OUT/walk/"
cp "$V/walk/lo"/f*.webp "$OUT/walk/lo/"
for s in $STILLS; do
  cp "$V/stills/$s.webp" "$OUT/img/$s.webp"
  dwebp -quiet "$V/stills/$s.webp" -o "$OUT/img/_tmp.png"
  cwebp -quiet -q 80 -resize 800 0 "$OUT/img/_tmp.png" -o "$OUT/img/$s-800.webp"
  rm "$OUT/img/_tmp.png"
done
echo "walk 高: $(du -ch "$OUT/walk"/f*.webp | tail -1 | cut -f1)  walk 低: $(du -sh "$OUT/walk/lo" | cut -f1)  img: $(du -sh "$OUT/img" | cut -f1)  合計: $(du -sh "$OUT" | cut -f1)"
