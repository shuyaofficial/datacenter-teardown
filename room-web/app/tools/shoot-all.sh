#!/usr/bin/env bash
# 受け入れ基準の撮影一式。teardown-out/room/app-*.png に書き、各コマのコンソールのエラー数を出す。
#   bash room-web/app/tools/shoot-all.sh [stub|v2] [地点 id（既定 cold-mid）]
set -euo pipefail
here="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$here/.."
set_name="${1:-stub}"
st="${2:-cold-mid}"
out="teardown-out/room"
q="app/index.html?data=${set_name}&tour=0"
shoot() { node room-web/shoot.mjs "$1" "$out/$2" "$3"; }

shoot "${q}&mode=3d&view=3d"                                        app-pc.png            1440x900
shoot "${q}&mode=photo&station=${st}&yaw=10"                        app-phone.png         390x844
first="$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["stations"][0]["id"])' "$out/$set_name/stations.json")"
shoot "${q}&mode=3d&station=${first}&walkto=${st}"                  app-pc-arrived.png    1440x900
shoot "${q}&mode=3d&station=${st}&view=photo&yaw=-70&pitch=32&flows=heat" app-pc-flows.png 1440x900
shoot "${q}&mode=3d&station=${st}&view=3d&yaw=-70&pitch=32&flows=heat"    app-pc-flows-3d.png 1440x900
shoot "${q}&mode=photo&station=${st}&yaw=-70&pitch=30&flows=heat"   app-phone-flows.png   390x844
shoot "${q}&mode=3d&station=${st}&view=photo&yaw=20&card=nvl72"     app-pc-card.png       1440x900
shoot "${q}&mode=photo&station=${st}&yaw=10&card=nvl72"             app-phone-card.png    390x844
