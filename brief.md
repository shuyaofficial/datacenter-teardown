# Catalyst 9300 風スイッチの分解シミュレータ — 実装の依頼書

数値の正本は `switch/refs.md`。この依頼書と食い違ったら refs.md が勝つ。食い違いに気づいたら直さずに報告する。

## 何を見せるか（成功の定義）
読み手は CCNA〜CCNP を学んでいる人（用語の初歩説明は要らない）。
ページを触ったあとに「ポートに入ったフレームが ASIC の中で何段の処理を通り、どんなときだけ CPU に上がり、混んだら何が起きるか」を自分の言葉で説明できること。
**教材の芯は3つ**:
1. フレームは NIF で 256 B の切れ端に分かれ、本体は PBC に置かれたまま、**64 B の札（ディスクリプタ）だけが検索とキューを回る**。
2. CPU に上がるのは自分宛て・制御・例外だけ。ハード 190.48 Mpps に対し CPU は約 19,000 pps（約 1 万分の1）。だから CoPP がキューごとに上限をかける。
3. 2本の 1G が 1本の 1G に集まると、Q1 の 153,600 B は **1.2288 ms** で満杯になる（倍率 1200 で 14.7456 ms）。

## 前提
- 作業フォルダ: このリポジトリのルート。
- teardown スキル: `~/.claude/skills/teardown`（SKILL_DIR）。最初に `$SKILL_DIR/SKILL.md` を読む。
- **見本**（読むだけ、変えない）: [building-teardown](https://github.com/shuyaofficial/building-teardown) の `autodoor-shared/` 一式・`autodoor-live/main.js`・`autodoor-film/`・`autodoor/kin.test.mjs`・`autodoor/brief.md`。構成・命名・書き方はこれに合わせる。`tools/BRIEF-TEMPLATE.md`（building-teardown 側）の「守ること」も同じく守る。
- 共通部品はこのフォルダの `kit/`（building-teardown の building-kit の写し: `ui.js` 配色・日本語フォント・パネル、`cursor.js` ツアーのカーソル、`slice.js` 箱の部品）。import は `../kit/ui.js` の形。足してよい。
- ビルドと撮影は `tools/td.sh`、操作の検査は `tools/live-check.mjs`（`--click "<ボタン文字>" --watch <window.LIVE.s のキー>` の汎用モードを使う）。

## フォルダ構成
```
switch-shared/  kin.js（数式と SPEC。three.js なし）/ chassis.js（形状）/ asic.js（ASIC の中の図。Phase B）/ stage.js / console.js / script.js / film.js / live.js
switch-live/main.js
switch-film/main.js + timeline.json（静止画の検査用。動画は作らない）
switch/kin.test.mjs（node:assert。refs.md「検算」の数値をすべて確かめる）
```

## 入力1つ＝時刻。場面（シナリオ）ごとに純関数
- `kin.js` に `SPEC`（refs.md の値すべて）と、場面ごとの純関数を置く。Math.random・Date・フレーム間の状態は使わない。
- 段の並び `STAGES`（refs.md「ASIC の中のパケットの通り道」の 12 段。id・略称・日本語の一言・ASIC の中の位置キー）。
- 場面:
  | id | 名前 | 中身 |
  |---|---|---|
  | `l2` | L2 でそのまま | Gi1/0/1 → Gi1/0/2、同じ VLAN、MAC 既知。1518 B |
  | `l3` | L3 で VLAN をまたぐ | VLAN10 → VLAN20（SVI）。RWE で MAC 付け替えと TTL−1 を表示 |
  | `flood` | 宛先不明 | 未知ユニキャスト。EQS で VLAN の全ポートへ複製 |
  | `arp` | ARP が CPU へ | IFC が自分宛て ARP と判定 → CPU キュー5 → CoPP → CPU → FED → PDS → IOSd → 応答をインジェクト |
  | `storm` | ARP の嵐 | 10,000 pps 到着、4,000 pps 通過、6,000 pps を CPU の手前で捨てる（計器はこの3つの数） |
  | `ttl` | TTL 切れ | キュー3（ICMP 生成、750 pps）へ |
  | `congest` | 2本→1本 | Gi1/0/1 と Gi1/0/2 から各 1 Gbps → Gi1/0/3。Q1 の溜まり量（B）と捨てた数。倍率 100 / 1200 を切り替え |
- `packetAt(scene, t)` → `{stage, u（段の中の進み 0..1）, cells（切れ端の数と位置）, desc（札の位置）, real}`。`real` は実時間として出せる値だけ（直列化時間 µs など）。段の所要時間は出典が無いので**演出用の時間**（1段 0.5〜0.8 s 程度）で、画面に「動きは説明用に引き伸ばしています」と1回書く。
- `queueAt(tReal_ms, mult)` → 溜まり量 B・満杯か・捨てたフレーム数。演出時間と実時間（ms）の換算は場面ごとに `SPEC` に1か所。計器のグラフの横軸は実時間 ms。
- live ではボタン操作の時点から同じ関数を読む（live は純関数でなくてよい。film は純関数）。

## 形状（コードで作る。生成モデル・外部の画像は使わない）
- 筐体 445 × 44 × 409 mm（1U）。薄い灰色の金属。天板は分解で持ち上がる。前面の右端にネットワークモジュール（SFP+ × 8）。
- 前面: RJ-45 × 48（上下2段 × 24、12 個ごとに小さな隙間）、USB-A、USB シリアルコンソール、状態 LED（光らせない、色だけ）。ポート名 Gi1/0/1 は上段左端、Gi1/0/2 は下段左端（Catalyst の並び）。
- 背面: 電源ベイ × 2（715 W が1台、もう1つは空きの蓋）、ファン × 3、スタックポート × 2、StackPower × 2、RJ-45 コンソール、管理ポート、SSD スロット。
- 基板: くすんだ緑の PCB。前面の後ろに PHY × 6 の列、中央に UADP ASIC（ヒートシンク付き。ヒートシンクは分解で外れる）、片側に CPU＋DDR4 1枚＋eUSB、後ろ寄りに電源とファン。ポート → PHY → ASIC、ASIC → CPU の配線を細い帯で描く（パケットはこの上を通る）。
- **Cisco のロゴ・型番の刻印・写真は付けない**。画面の隅に「Catalyst 9300-48P を模した簡略形状。寸法と数値は refs.md の出典による」と小さく書く。
- 作り物っぽさを避ける: 板ごとに明るさを少しずらす、彩度を下げる、部品の数は refs.md の分だけ。

## 画面（1600 × 900 固定、teardown の作法）
- 左の列: 章ボタン 1〜7（番号つき）。その下に、いまの章の場面ボタン。
- 右の列: 計器（いまの段の一覧で現在の段に強調色、切れ端の数、札の位置、実時間の直列化時間、場面ごとの数: CPU キューの通過/捨て、Q1 の溜まり量のバーと ms のグラフ）。
- 下の帯: 章の説明 2〜3 行 ＋「ラボで: `<コマンド>`（IOL で出る／実機のみ）」の1行（refs.md の表から）。
- 章と見せ方:
  1. **外観**: 前面 3/4 と背面 3/4。部品名の注記（番号・名前・仕様1行）。
  2. **蓋を開ける**: 天板 → ヒートシンク → NM → 電源 の順に上の層から 0.15〜0.2 s ずつずらして持ち上げる（閉じるときは下から速く）。各部品に注記。
  3. **役割分担**: 「データプレーン」「コントロールプレーン」の切り替えボタン。選んだ側（ASIC＋PHY＋配線／CPU＋メモリ＋フラッシュ）を強調色、他は半透明（isolate）。
  4. **パケットの一生**（Phase B）: ASIC のふたが開き、ASIC の上に **段の図（板の上に 12 段のブロックを並べた拡大図）** が浮かぶ。フレームは 6 個の切れ端に分かれて PBC に入り、札だけが IFC → PBC → EQS を回り、順番が来たら本体が RWE を通って出る。場面 `l2` `l3` `flood`。
  5. **CPU に上がるとき**（Phase B）: ASIC → CPU の配線をたどり、CPU の上に層の板（カーネル → FED → PDS → IOSd）。場面 `arp` `storm` `ttl`。
  6. **混んだとき**（Phase B）: 出口 Gi1/0/3 の Q0・Q1 の棒、溜まり量のグラフ、満杯で末尾から捨てる。倍率ボタン 100 / 1200。
  7. **冷却と電力**（Phase B）: 横から見て前→後ろの風の線（細い破線がゆっくり流れる。reduced-motion なら止める）、PoE 予算 437 W と 30 W 機器 14 台の計器。
- 強調色は `C.accent` の1色だけで「いま働いている部品・段」に使う。光る演出・常時の点滅はしない。ラベルは部品を隠さない。画面端 60 px に重要物を置かない。
- `prefers-reduced-motion` のときは自動ツアーを始めず、パケットは段ごとに跳ぶ。
- WebGL が無いときは、章の説明と段の一覧だけの文字版を出す。

## live ページ
- 放置で自動ツアー（カーソル付き、ループ）。どの入力でも操作を渡し、25 秒放置で戻る。`window.LIVE` に `{T, tour, s}` を出す。`s` には少なくとも `chapter`, `scene`, `stage`, `explode`（0..1）, `queueBytes`, `cpuPass`, `cpuDrop` を入れる。
- ドラッグで回す、ホイールで寄る。TIERS と `kit/warm.js` を使う（見本に合わせる）。
- HTML は 1 MB 未満。

## 自動ツアー台本（全体 60〜90 秒。拍は timeline.json に）
1. 外観 前面 → 背面（8 s）
2. 蓋を開ける（10 s）
3. データプレーン → コントロールプレーン（8 s）
4. `l2` を1往復 → `l3` の書き換えに寄る（20 s）
5. `arp` → `storm` の計器（14 s）
6. `congest` 倍率 100 で満杯 → 1200 に切り替え（14 s）
7. 冷却の風 → 全景で締める（8 s）

## 検証コマンド（すべて通してから報告する）
```
node switch/kin.test.mjs
tools/td.sh build ./switch-live && tools/td.sh build ./switch-film
ls -l teardown-out/dist/switch-*.html                     # 1 MB 未満
tools/td.sh capture ./switch-film --stills beats --cols 4 --timeline switch-film/timeline.json --out teardown-out/switch-beats.png
tools/td.sh capture ./switch-film --still <T> --out teardown-out/switch-<T>.png     # 要所を3枚以上
node tools/live-check.mjs teardown-out/dist/switch-live.html --click "<章2のボタン文字>" --watch explode --within 3
```
- capture と live-check はシステムの Chrome（GPU）を使う。GPU にアクセスできる通常のシェルで実行する（サンドボックスで失敗したら、その旨を報告に書く）。
- 静止画は自分で開いて読み、teardown SKILL.md のチェックリスト（めり込み無し・数値と姿勢の一致・文字切れ無し・ラベルが部品を隠さない・1コマ1焦点）で全拍が通るまで直す。

## 触らない
- `switch/refs.md`、`brief.md`（読むだけ）、building-teardown 側、`$SKILL_DIR` 配下。

## 報告（この形で返す）
- 変更・作成したファイルの一覧と行数
- 各検証コマンドの結果（テストの件数、HTML のバイト数、live-check の出力）
- 確認した静止画のパスと、見て直した点
- 直せなかった点・refs.md と食い違った点・判断に迷った点
