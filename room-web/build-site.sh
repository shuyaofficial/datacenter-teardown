#!/usr/bin/env bash
# 部屋ツアーを静的に配れる一式にそろえる: teardown-out/room/site/
#   bash room-web/build-site.sh            # v2 がそろっていれば v2、無ければ stub
#   bash room-web/build-site.sh stub       # 素材の組を指定
#   LINK_BASE=../ bash room-web/build-site.sh   # 「詳しい分解ページ」の置き場所（既定 ../ = サイトの1つ上）
# 公開（docs/ への配置）はしない。親の作業で行う。
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
proj="$(cd "$here/.." && pwd)"
room="$proj/teardown-out/room"
out="$room/site"
three="$here/vendor/three"
link_base="${LINK_BASE:-../}"

# v2 がそろっているか: stations.json・room.glb・全地点の pano
v2_ready() {
  local d="$room/v2"
  [[ -f "$d/stations.json" && -f "$d/room.glb" ]] || return 1
  python3 -I - "$d" <<'PY' || return 1
import json, os, sys
d = sys.argv[1]
st = json.load(open(os.path.join(d, 'stations.json')))['stations']
missing = [s['pano'] for s in st if not os.path.isfile(os.path.join(d, s['pano']))]
sys.exit(1 if missing else 0)
PY
}

set_name="${1:-}"
if [[ -z "$set_name" ]]; then
  if v2_ready; then set_name=v2; else set_name=stub; fi
fi
src="$room/$set_name"
[[ -f "$src/stations.json" ]] || { echo "素材が見つかりません: $src/stations.json" >&2; exit 1; }
[[ -f "$src/room.glb" ]] || { echo "room.glb がありません: $src" >&2; exit 1; }

rm -rf "$out"
mkdir -p "$out/js" "$out/data/$set_name/pano" \
  "$out/vendor/three/build" "$out/vendor/three/examples/jsm/loaders" \
  "$out/vendor/three/examples/jsm/objects" "$out/vendor/three/examples/jsm/utils" \
  "$out/vendor/three/examples/jsm/libs/draco"

# ページ: 素材の場所・リンクの場所・既定の組・importmap を書き換える
sed -e 's#<meta name="data-root" content="[^"]*">#<meta name="data-root" content="./data/">#' \
    -e "s#<meta name=\"link-base\" content=\"[^\"]*\">#<meta name=\"link-base\" content=\"${link_base}\">#" \
    -e "s#<meta name=\"data-set\" content=\"[^\"]*\">#<meta name=\"data-set\" content=\"${set_name}\">#" \
    -e 's#"\.\./vendor/three/#"./vendor/three/#g' \
    "$here/app/index.html" > "$out/index.html"
cp "$here"/app/js/*.js "$out/js/"

# three.js（MIT）の使う分だけ
cp "$three/build/three.module.js" "$three/build/three.core.js" "$out/vendor/three/build/"
cp "$three/examples/jsm/loaders/GLTFLoader.js" "$three/examples/jsm/loaders/DRACOLoader.js" "$out/vendor/three/examples/jsm/loaders/"
cp "$three/examples/jsm/objects/Reflector.js" "$out/vendor/three/examples/jsm/objects/"
cp "$three/examples/jsm/utils/BufferGeometryUtils.js" "$three/examples/jsm/utils/SkeletonUtils.js" "$out/vendor/three/examples/jsm/utils/"
cp "$three/examples/jsm/libs/draco/draco_decoder.js" "$three/examples/jsm/libs/draco/draco_decoder.wasm" \
   "$three/examples/jsm/libs/draco/draco_wasm_wrapper.js" "$out/vendor/three/examples/jsm/libs/draco/"
cp "$three/LICENSE" "$out/vendor/three/LICENSE"

# 素材（symlink は実体をコピーする）。pano は stations.json が指すものだけ
cp -L "$src/stations.json" "$src/room.glb" "$out/data/$set_name/"
python3 -I - "$src" "$out/data/$set_name" <<'PY'
import json, os, shutil, sys
src, dst = sys.argv[1], sys.argv[2]
for s in json.load(open(os.path.join(src, 'stations.json')))['stations']:
    p = os.path.normpath(s['pano'])
    if p.startswith('..') or os.path.isabs(p):
        sys.exit(f"pano のパスが素材の外を指しています: {s['pano']}")
    os.makedirs(os.path.dirname(os.path.join(dst, p)), exist_ok=True)
    shutil.copyfile(os.path.realpath(os.path.join(src, p)), os.path.join(dst, p))
PY

# 中身の確認: importmap と data-root の書き換え、参照ファイルの実在
grep -q '"three":"./vendor/three/build/three.module.js"' "$out/index.html" || { echo "importmap の書き換えに失敗" >&2; exit 1; }
grep -q 'content="./data/"' "$out/index.html" || { echo "data-root の書き換えに失敗" >&2; exit 1; }
echo "site: ${out}（素材 ${set_name}、リンク先 ${link_base}）"
( cd "$out" && find . -type f | sort | while read -r f; do printf '%8s  %s\n' "$(du -k "$f" | cut -f1)K" "$f"; done )
du -sh "$out" | cut -f1 | sed 's/^/合計 /'
