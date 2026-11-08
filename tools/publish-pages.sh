#!/bin/zsh
# 公開用: 各機構の live ページとハブをビルドし、GitHub Pages が配る docs/ にそろえる。
#   tools/publish-pages.sh            # ビルドしてコピー
#   tools/publish-pages.sh --no-build # dist にあるものをコピーするだけ
set -e
cd "$(dirname "$0")/.."
NAMES=(switch nvl72 qx800 cdu hgx trn2 tpu)
if [[ "$1" != "--no-build" ]]; then
  for n in $NAMES; do
    if [[ -d "$n-live" ]]; then tools/td.sh build "./$n-live"; fi
  done
fi
mkdir -p docs
touch docs/.nojekyll
for n in $NAMES; do
  f="teardown-out/dist/$n-live.html"
  if [[ -f "$f" ]]; then cp "$f" "docs/$n-live.html"; fi
done
# 入口はハブの代わりに site/index.html（機器が増えたらここに足す）
cp site/index.html docs/index.html
# 部屋ツアーと読み物ページは複数ファイルの一式。素材は Blender（room-blender/）で作り、
# room-web/build-site.sh と room-read/build.sh が teardown-out/room/ に組み立てる
if [[ -f teardown-out/room/site/index.html && -f teardown-out/room/read-site/index.html ]]; then
  rm -rf docs/room docs/room-read
  cp -RL teardown-out/room/site docs/room
  cp -RL teardown-out/room/read-site docs/room-read
else
  echo "部屋の一式が無いので docs/room と docs/room-read はそのまま（room-web/build-site.sh と room-read/build.sh を先に）"
fi
# ビルドは著作権コメントを落とす（esbuild の legalComments: 'none'）ので、各ページの先頭に表示を差し込む
for f in docs/*.html(N); do
  python3 - "$f" tools/license-header.html <<'PY'
import sys
page, head = open(sys.argv[1]).read(), open(sys.argv[2]).read()
if "Full license texts: THIRD_PARTY_NOTICES.md" not in page:
    i = page.lower().find("<head>")
    page = page[: i + 6] + "\n" + head + page[i + 6 :] if i >= 0 else head + page
    open(sys.argv[1], "w").write(page)
PY
done
# 隣に置く外部ファイル（build.json の external）があれば一緒に運ぶ
for g in teardown-out/dist/*.glb(N); do cp "$g" docs/; done
ls -l docs
# 1 MB を超えるページがあれば止める（リンクのプレビューが出なくなる）
big=$(find docs -name '*.html' -size +1000k)
[[ -z "$big" ]] || { echo "1 MB を超えるページ: $big"; exit 1; }
