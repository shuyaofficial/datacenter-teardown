#!/bin/bash
# 書き出しの手順をまとめて回す（焼き込みの後に使う）。GPU は1つなので順に走らせる。
#   bash room-blender/make_outputs.sh [stills] [panos] [compare]   （引数なしなら全部）
# 入力: teardown-out/room/work-v2/room.blend（build_room.py の出力）、teardown-out/room/v2/room.glb（bake_room.py の出力）
# 出力: teardown-out/room/v2/{stills,pano,compare}/
set -euo pipefail
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
W=teardown-out/room/work-v2
V=teardown-out/room/v2
STEPS="${*:-stills panos compare}"
STILLS=still_overview,still_nvl72-front,still_network,still_hot-aisle,still_cdu-inside,still_ceiling,still_window,still_row-above
PANOS=cold-in,cold-mid,net,hot,cdu,ceil
IDS="cold-in cold-mid net hot cdu ceil"
mkdir -p "$V/stills" "$V/pano" "$V/compare" "$W/render" "$W/cmp-web"

if [[ " $STEPS " == *" stills "* ]]; then
  "$B" -b "$W/room.blend" -P room-blender/render_views.py -- --outdir "$W/render" --views "$STILLS" --samples 256 --res 1600x900 2>&1 | grep -E "WROTE|Error|Traceback" || true
  for s in ${STILLS//,/ }; do cwebp -quiet -q 86 "$W/render/$s.png" -o "$V/stills/${s#still_}.webp"; done
fi
if [[ " $STEPS " == *" panos "* ]]; then
  "$B" -b "$W/room.blend" -P room-blender/render_views.py -- --outdir "$W/render" --panos "$PANOS" --samples 128 --pano-res 4096x2048 2>&1 | grep -E "WROTE|Error|Traceback" || true
  for p in ${PANOS//,/ }; do cwebp -quiet -q 80 "$W/render/pano_$p.png" -o "$V/pano/$p.webp"; done
fi
if [[ " $STEPS " == *" compare "* ]]; then
  views=$(for i in $IDS; do printf 'cmp_%s,' "$i"; done)
  "$B" -b "$W/room.blend" -P room-blender/render_views.py -- --outdir "$W/render" --views "${views%,}" --samples 128 --res 1280x720 --cams "$W/cams.json" 2>&1 | grep -E "WROTE|Error|Traceback" || true
  for i in $IDS; do
    node room-web/shoot.mjs "viewer.html?dir=../$V&cams=../$W/cams.json&id=cmp_$i" "$W/cmp-web/$i.png" 1280x720
    magick "$W/render/cmp_$i.png" "$W/cmp-web/$i.png" -append -quality 88 "$V/compare/$i.jpg"
  done
fi
ls -la "$V" "$V/stills" "$V/pano" "$V/compare"
