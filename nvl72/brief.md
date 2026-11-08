# GB200 NVL72 ラックの分解シミュレータ — 実装の依頼書

数値の正本は `nvl72/refs.md`。この依頼書と食い違ったら refs.md が勝つ。食い違いに気づいたら直さずに報告する。
作りはこのリポジトリの1本目（スイッチ: `switch-shared/` 一式、`switch-live/`、`switch-film/`、`switch/kin.test.mjs`、`brief.md`）に合わせる。構成・命名・書き方・画面の作法は同じにする。

## 何を見せるか（成功の定義）
読み手は CCNA〜CCNP を学んでいる人（GPU やサーバーの知識は浅い）。
ページを触ったあとに「GPU 72 個がなぜ1台の大きな GPU のように動けるのか、ラックの中と外で何が違うのか、120 kW をどう運び込んでどう冷やすのか」を自分の言葉で説明できること。
**教材の芯は3つ**:
1. GPU 1個の 18 本のリンクは 18 個のスイッチチップに1本ずつ行き、どのチップも 72 個の GPU に1本ずつつながる。だから**どの GPU からどの GPU へもスイッチ1段**で届き、ポートの数は 1,296 = 1,296 でぴったり合う。
2. ラックの中（NVLink 1.8 TB/s）とラックの外（ConnectX-7 400 Gb/s）は **18 倍**違う。だから一番よく話す GPU どうしをラックの中に置く。
3. 学習の1歩ごとの集計（all-reduce）は、リング方式だと GPU 1個が 1.972 GB 送るが、スイッチの中で合計する（SHARP）と 1 GB で済む（帯域だけの計算で 2.191 ms → 1.111 ms）。

## フォルダ構成（1本目と並べる。1本目のファイルは変えない）
```
nvl72-shared/  kin.js（数式と SPEC。three.js なし）/ flow.js（純関数: 経路・粒の位置）/ rack.js（ラックと各トレイの形状）/ tray.js（計算トレイの中）/ stage.js / console.js / script.js / film.js / live.js
nvl72-live/main.js
nvl72-film/main.js + timeline.json（静止画の検査用。動画は作らない）
nvl72/kin.test.mjs（node:assert。refs.md「検算」の数値をすべて確かめる）
```
- 共通部品は `kit/`（`ui.js`・`cursor.js`・`slice.js`）。足してよいが、足したら1本目（`switch-live`）を再ビルドして壊れていないことを確かめる。
- `switch-shared/` から使える関数（注記の配置で引き出し線を交差させない仕組みなど）は写して使ってよい。共通化して `kit/` に移すなら、1本目も同じものを使うように直してテストとビルドを通す。

## 入力1つ＝時刻。場面ごとに純関数
- `SPEC` に refs.md の値をすべて。`render(t)` は純関数（Math.random・Date・フレーム間の状態なし）。
- 場面:
  | id | 名前 | 中身 |
  |---|---|---|
  | `hop` | GPU から GPU へ | 計算トレイ3の GPU 1 → 計算トレイ15の GPU 3。GPU → 背面のケーブルカートリッジ → スイッチトレイの NVSwitch 1個 → 戻って相手の GPU。通るスイッチチップは1個 |
  | `fan` | 18 本のリンク | GPU 1個から 18 本の線が 18 個のスイッチチップへ扇のように広がる |
  | `ring` | リングで集計 | 72 個の GPU が輪になって順に渡す。GPU 1個が送った量が 1.972 GB に向かって増える計器 |
  | `sharp` | スイッチで集計 | 全 GPU が 1 GB をスイッチへ送り、スイッチの中で足して1回で返す。1 GB で止まる計器 |
  | `out` | ラックの外へ | GPU → ConnectX-7 → 前面の OSFP → ラックの外の InfiniBand。同じ時間に NVLink 側と外側で運べる量を並べる（18 倍の差） |
  | `power` | 電源 | 電源棚 8 台 → 母線 50 V → 各トレイ。計器: 積んだ 264 kW、使える 132 kW、消費 120 kW、母線の電流 2,400 A |
  | `cool` | 液冷 | 冷たい液が背面のマニホールドから各トレイのコールドプレートへ入り、温まって戻る。温度差のスライダー 5〜20 K と流量の計器（10 K で 172 L/分） |
- 動きの時間は説明用（実時間ではない）。画面に1回「動きは説明用に引き伸ばしています」と書く。実時間として出すのは refs.md の計算値（ms・A・L/分）だけ。

## 形状（コードで作る。生成モデル・外部の画像・ロゴは使わない）
- ラック: 高さ 2,236 × 幅 600 × 奥行 1,068 mm。上から 電源棚4 → 計算トレイ10 → スイッチトレイ9 → 計算トレイ8 → 電源棚4（電源棚の位置は仮定。画面には出さなくてよいが refs.md どおり）。TOR スイッチ2台は最上段。
- 計算トレイ（1U）: 前面に OSFP × 4・BlueField-3 のポート・E1.S × 4 の差し込み口。中に GB200 スーパーチップ × 2（1枚の基板に Grace 1・B200 2）、それぞれに液冷のコールドプレートと細い配管、ConnectX-7 × 4、BlueField-3 × 2、小さなファンの列。背面に NVLink のコネクタ・液冷の差し口・母線の受け口。
- スイッチトレイ（1U）: NVSwitch チップ × 2（コールドプレート付き）、背面に NVLink のコネクタ。
- 背面: 縦に4本のケーブルカートリッジ（束ねた銅線の帯）、左右に液冷のマニホールド（行き・帰りの2本）、中央に母線。
- 同じ形が多い（トレイ 27 台）ので InstancedMesh などで軽くする。HTML は 1 MB 未満。
- 作り物っぽさを避ける: 板ごとに明るさを少しずらす、彩度を下げる、ラベルは数を絞る。

## 画面（1600 × 900 固定。1本目と同じ配置）
- 左: 章ボタン 1〜7 と、その章の場面ボタン。右: 計器。下の帯: 章の説明 2〜3 行 ＋「実機で見るには: `<コマンド>`」（refs.md の表から）。
- 章と見せ方:
  1. **外観**: 前から全景 → 後ろへ回って、ケーブルカートリッジ・マニホールド・母線。注記は「番号・名前・仕様1行」。
  2. **計算トレイを引き出す**: 1台が前へ滑り出て、天板が持ち上がり、部品が上の層から少しずつずれて浮く（1本目の分解の文法）。GPU・Grace・ConnectX-7・BlueField-3・E1.S に注記。
  3. **72 個が1つになる**: 場面 `fan` → `hop`。スイッチトレイの束が少し前へ出て NVSwitch が見える。計器: 1,296 = 1,296、1.8 TB/s、130 TB/s、通ったスイッチの数「1」。
  4. **学習1歩の集計**: 場面 `ring` と `sharp` の切り替え。72 個の GPU を簡略な輪（ラックの横に浮かぶ図）で見せてよい。計器: 送った量 GB と所要 ms の2本の棒。
  5. **ラックの外へ**: 場面 `out`。前面の OSFP から外へ伸びる線。計器: NVLink 1.8 TB/s と外 100 GB/s の棒（18 倍）。
  6. **120 kW を運び込む**: 場面 `power`。電源棚と母線を強調。
  7. **液で冷やす**: 場面 `cool`。行きの線と帰りの線は同じ強調色の濃淡で分け、赤青の2色にはしない。空冷の部品（電源棚、NIC の周りなど）は灰色で「空冷」と注記。
- 強調色は `C.accent` の1色だけ。光る演出・常時の点滅はしない。ラベルは部品を隠さない。引き出し線は交差させない。画面端 60 px に重要物を置かない。
- 下端の注記: 「非公式の教材。GB200 NVL72 を模した簡略形状で、NVIDIA・GB200・NVLink・Grace・Blackwell・ConnectX・BlueField は NVIDIA Corporation の商標。数値は refs.md の出典による」。WebGL が無いときの文字版にも同じ注記。
- 脚注（第3章か第7章の計器の下に小さく）: refs.md「次の世代」の2行。
- `prefers-reduced-motion` のときは自動ツアーを始めず、粒は段ごとに跳ぶ。

## live ページ
- 放置で自動ツアー（カーソル付き、ループ）。どの入力でも操作を渡し、25 秒放置で戻る。`window.LIVE = {T, tour, s}`。`s` には少なくとも `chapter`, `scene`, `pull`（トレイの引き出し 0..1）, `hops`, `sentGB`, `outRatio`, `amps`, `flowLpm` を入れる。
- ドラッグで回す、ホイールで寄る。1本目と同じ TIERS と `warm.js` を使う。

## 自動ツアー台本（全体 70〜90 秒。拍は timeline.json に）
1. 外観 前 → 後ろ（10 s）
2. 計算トレイを引き出して分解（12 s）
3. `fan` → `hop`（14 s）
4. `ring` → `sharp`（16 s）
5. `out`（10 s）
6. `power`（8 s）
7. `cool`（10 s）→ 全景で締める

## 検証コマンド（すべて通してから報告する）
```
node nvl72/kin.test.mjs
node switch/kin.test.mjs                               # 1本目を壊していないこと
tools/td.sh build ./nvl72-live && tools/td.sh build ./nvl72-film && tools/td.sh build ./switch-live
ls -l teardown-out/dist/*.html                         # どれも 1 MB 未満
tools/td.sh capture ./nvl72-film --stills beats --cols 4 --timeline nvl72-film/timeline.json --out teardown-out/nvl72-beats.png
tools/td.sh capture ./nvl72-film --still <T> --out teardown-out/nvl72-<T>.png      # 各章1枚以上
node tools/live-check.mjs teardown-out/dist/nvl72-live.html --click "<章2のボタン文字>" --watch pull --within 3
node tools/live-check.mjs teardown-out/dist/nvl72-live.html --click "<章4のボタン文字>" --watch sentGB --within 6
```
- 静止画は全部自分で開いて読み、teardown SKILL.md のチェックリスト（めり込み無し・数値と姿勢の一致・文字切れ無し・ラベルが部品を隠さない・引き出し線が交差しない・1コマ1焦点）で通るまで直す。

## 触らない
- `nvl72/refs.md`、`nvl72/brief.md`、`switch/refs.md`、`brief.md`（読むだけ）。`docs/`、`site/`、`tools/publish-pages.sh`（公開は親がやる）。`$SKILL_DIR` 配下。git の操作はしない。

## 報告（この形で返す。600 語以内）
- 変更・作成したファイルの一覧と行数（`kit/` や1本目を変えたらそれも）
- 各検証コマンドの結果
- 確認した静止画のパスと、見て直した点
- 直せなかった点・refs.md と食い違った点・判断に迷った点
