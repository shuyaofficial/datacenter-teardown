# HGX B200（DGX B200）の分解シミュレータ — 実装の依頼書（下書き）

数値の正本は `hgx/refs.md`。この依頼書と食い違ったら refs.md が勝つ。食い違いに気づいたら直さずに報告する。
作りは1本目（スイッチ: `switch-shared/` 一式、`switch-live/`、`switch-film/`、`switch/kin.test.mjs`、`brief.md`）と2本目（`nvl72-shared/` 一式、`nvl72/brief.md`）に合わせる。構成・命名・書き方・画面の作法は同じにする。
**位置づけ**: GB200 NVL72 の1つ前の形。並べて見ると「NVLink の領域が 8 → 72 に広がった」「空冷 14.3 kW → 液冷 120 kW になった」ことが分かるようにする。

## 何を見せるか（成功の定義）
読み手は CCNA〜CCNP を学んでいる人（GPU やサーバーの知識は浅い）。
ページを触ったあとに「8 個の GPU が箱の中でどうつながり、9 個目からは何を通るのか、14.3 kW の熱を風でどう運び出すのか、NVL72 は何を変えたのか」を自分の言葉で説明できること。
**教材の芯は3つ**:
1. **NVLink の領域は 8 個で止まる。** GPU 1個の 18 本のリンクは 9 本ずつ 2 個の NVSwitch へ行き（8 × 18 = 144 = 2 × 72）、箱の中ならスイッチ1段・1.8 TB/s。9 個目の GPU へは ConnectX-7 の 400 Gb/s（18 分の 1）を通る。72 個で学習すると、相手が箱の中にいるのは 71 個中 7 個（9.9 %）だけ。
2. **14.3 kW を風で運ぶ。** 1,550 CFM（0.73 m³/s）の風で 14.3 kW を運ぶと空気は約 16 K 温まる。同じ熱を水なら 20.5 L/分。体積で約 2,140 倍の差が、NVL72 が液冷になった理由。
3. **NVL72 との違いは「箱の境目の位置」。** 72 個で 1 GB を集計すると、DGX B200 9 台では 1台あたり 1.778 GB が外のネットワークへ出て約 6.389 ms、NVL72 は外へ 0 GB で 2.191 ms（帯域だけの計算）。GPU 1個の外への速さ（400 Gb/s）はどちらも同じで、変わったのは NVLink で届く範囲。

## フォルダ構成（1本目・2本目と並べる。既存のファイルは変えない）
```
hgx-shared/  kin.js（数式と SPEC。three.js なし）/ flow.js（純関数: 経路・粒の位置）/ chassis.js（10U の筐体・前面・背面）/ trays.js（GPU トレイとマザーボードトレイの中）/ stage.js / console.js / script.js / film.js / live.js
hgx-live/main.js
hgx-film/main.js + timeline.json（静止画の検査用。動画は作らない）
hgx/kin.test.mjs（node:assert。refs.md「検算」の数値をすべて確かめる）
```
- 共通部品は `kit/`（`ui.js`・`cursor.js`・`slice.js`）。足してよいが、足したら1本目（`switch-live`）と2本目（`nvl72-live`）を再ビルドして壊れていないことを確かめる。
- `nvl72-shared/` の関数（経路の純関数、計器、注記の配置）は写して使ってよい。共通化して `kit/` に移すなら、1本目・2本目も同じものを使うように直してテストとビルドを通す。
- 第5章（NVL72 と比べる）で NVL72 の値を出すときは、`nvl72-shared/kin.js` の `SPEC` を import して読む。値を写さない。

## 入力1つ＝時刻。場面ごとに純関数
- `SPEC` に refs.md の値をすべて。`render(t)` は純関数（Math.random・Date・フレーム間の状態なし）。
- 場面:
  | id | 名前 | 中身 |
  |---|---|---|
  | `fan` | 18 本のリンク | GPU 0 から 18 本の線が出て、9 本ずつ 2 個の NVSwitch へ分かれる |
  | `hop` | GPU から GPU へ | GPU 0 → NVSwitch 1個 → GPU 5。通るスイッチは1個。計器「通ったスイッチ 1」 |
  | `wall` | 9 個目の GPU | GPU 0 から「隣の DGX の GPU 0」へ。NVLink では届かず、PCIe → ConnectX-7 → 背面の OSFP4 P2 → 外の InfiniBand のリーフ（レール 0）→ 隣の箱。同じ時間に NVLink 側と外側で運べる量を並べる（18 倍の差） |
  | `rails` | 8 本のレール | 9 台の DGX B200 を横に並べ、同じ番号の GPU どうしが同じリーフにつながる（8 本のレール）。72 個のうち NVLink で届く 7 個だけが明るい |
  | `hier` | 2段で集計 | 段1 箱の中で分けて集める → 段2 同じ番号どうしで外のリング → 段3 箱の中で配る。計器: GPU 1個が送った量（箱の中 1.75 GB、外 0.2222 GB）、1台から外へ出た量（1.778 GB）、合計 6.389 ms |
  | `vs72` | NVL72 と比べる | 同じ 1 GB の集計を、左に DGX B200 9 台（6.389 ms、外へ 1.778 GB/台）、右に NVL72（2.191 ms、外へ 0 GB）の2本の棒で並べる |
  | `power` | 電源 | 背面の電源 6 台 → 箱の中。計器: 消費 14.3 kW、5 台で 16.5 kW、6 台目は予備、1 台 14.3 A（200 V） |
  | `air` | 風で冷やす | 前面から冷たい空気が入り、GPU トレイとマザーボードトレイを抜けて背面へ出る。温度差のスライダー 10〜20 K と風量の計器（出典の 1,550 CFM で 16.2 K）。横に「水なら 20.5 L/分」の小さな計器 |
  | `rack` | ラックに何台 | 42U のラックに入れていく。ラックの電力の上限のスライダー（30 / 40 / 60 kW、どれも仮定）で、場所は 4 台ぶんあるのに電力で 2 台で止まる様子 |
- 動きの時間は説明用（実時間ではない）。画面に1回「動きは説明用に引き伸ばしています」と書く。実時間として出すのは refs.md の計算値（ms・A・CFM・L/分）だけ。

## 形状（コードで作る。生成モデル・外部の画像・ロゴは使わない）
- 筐体: 10U、高さ 444 × 幅 482.3（耳を含む最大）× 奥行 897.1 mm。重さは注記の仕様1行に 142.4 kg。
- 中は2段: **上が GPU トレイ、下がマザーボードトレイ**（上下は refs.md の仮定。画面で上下を言い切らない）。奥にミッドプレーン。マザーボードトレイは後ろへ引き抜く。
- GPU トレイ: HGX B200 の基板1枚に B200 × 8（2 列 × 4、背の高い空冷のヒートシンク付き）と NVSwitch チップ × 2（基板の中ほど）。GPU と NVSwitch の間の配線は基板の中なので、場面 `fan`・`hop` の線だけで見せる。
- マザーボードトレイ: Xeon × 2（ヒートシンク）、DIMM 32 枚（CPU 1個の両側に 8 枚ずつ）、ConnectX-7 × 8 の小さな板、BlueField-3 × 2、M.2 × 2、エアバッフル。
- 前面: ベゼル（外れる）、ファンモジュールの列（2段 × 6 = 12 個は **仮定**。数は画面に出さない）、U.2 × 8 の差し口、電源・ID ボタン。
- 背面: 電源 6 台（PSU0〜5）、OSFP × 4（1個に2ポート）、BlueField-3 のポート、管理ポート。
- 同じ形が多い（GPU 8、DIMM 32、ファン、ヒートシンクのひれ）ので InstancedMesh などで軽くする。HTML は 1 MB 未満。
- 作り物っぽさを避ける: 板ごとに明るさを少しずらす、彩度を下げる、ラベルは数を絞る。
- 比べる場面（`rails`・`vs72`）の DGX B200 9 台・NVL72 は箱だけの簡略形でよい。NVL72 の外形は `nvl72/refs.md`（2,236 × 600 × 1,068 mm）。

## 画面（1600 × 900 固定。1本目・2本目と同じ配置）
- 左: 章ボタン 1〜7 と、その章の場面ボタン。右: 計器。下の帯: 章の説明 2〜3 行 ＋「実機で見るには: `<コマンド>`」（refs.md の表から）。
- 章と見せ方:
  1. **外観**: 前から全景（ベゼル付き）→ ベゼルが外れてファンと U.2 → 後ろへ回って電源 6 台・OSFP 4 個。注記は「番号・名前・仕様1行」。
  2. **2段に分ける**: マザーボードトレイが後ろへ滑り出て、GPU トレイの天板が持ち上がり、部品が上の層から少しずつずれて浮く（1本目の分解の文法）。B200・NVSwitch・Xeon・DIMM・ConnectX-7・BlueField-3 に注記。
  3. **8 個が1つになる**: 場面 `fan` → `hop`。計器: 144 = 144、1.8 TB/s、14.4 TB/s、通ったスイッチの数「1」。
  4. **8 で止まる**: 場面 `wall` → `rails`。計器: NVLink 1.8 TB/s と外 100 GB/s の棒（18 倍）、「箱の中で届く相手 7 / 71 = 9.9 %」。
  5. **72 個で集計する**: 場面 `hier` → `vs72`。計器: 送った量 GB と所要 ms の棒。NVL72 の値は `nvl72-shared/kin.js` から読む。
  6. **14.3 kW を運び込む**: 場面 `power` → `rack`。
  7. **風で冷やす**: 場面 `air`。空気の流れは同じ強調色の濃淡で入口（薄い）→ 出口（濃い）。赤青の2色にはしない。脚注に「液冷の HGX B200 は他社のサーバーにある（refs.md 出典8）」。
- 強調色は `C.accent` の1色だけ。光る演出・常時の点滅はしない。ラベルは部品を隠さない。引き出し線は交差させない。画面端 60 px に重要物を置かない。
- 下端の注記: 「非公式の教材。DGX B200 を模した簡略形状で、NVIDIA・DGX・HGX・NVLink・NVSwitch・Blackwell・ConnectX・BlueField は NVIDIA Corporation の商標、Intel・Xeon は Intel Corporation の商標。数値は refs.md の出典による」。WebGL が無いときの文字版にも同じ注記。
- 脚注（第3章か第5章の計器の下に小さく）: refs.md「次の世代」の HGX B300 の1行だけ（Rubin NVL8 は値が揃わないので出さない）。
- `prefers-reduced-motion` のときは自動ツアーを始めず、粒は段ごとに跳ぶ。

## live ページ
- 放置で自動ツアー（カーソル付き、ループ）。どの入力でも操作を渡し、25 秒放置で戻る。`window.LIVE = {T, tour, s}`。`s` には少なくとも `chapter`, `scene`, `pull`（マザーボードトレイの引き出し 0..1）, `hops`, `inDomain`（7/71）, `outRatio`, `sentGB`, `outGB`（1台から外へ）, `ms`, `amps`, `cfm`, `dT`, `perRack` を入れる。
- ドラッグで回す、ホイールで寄る。1本目と同じ TIERS と `warm.js` を使う。

## 自動ツアー台本（全体 70〜90 秒。拍は timeline.json に）
1. 外観 前 → ベゼルを外す → 後ろ（10 s）
2. マザーボードトレイを引き出して分解（12 s）
3. `fan` → `hop`（12 s）
4. `wall` → `rails`（14 s）
5. `hier` → `vs72`（16 s）
6. `power` → `rack`（10 s）
7. `air`（10 s）→ 全景で締める

## 検証コマンド（すべて通してから報告する）
```
node hgx/kin.test.mjs
node nvl72/kin.test.mjs                                # 2本目を壊していないこと
node switch/kin.test.mjs                               # 1本目を壊していないこと
tools/td.sh build ./hgx-live && tools/td.sh build ./hgx-film && tools/td.sh build ./nvl72-live && tools/td.sh build ./switch-live
ls -l teardown-out/dist/*.html                         # どれも 1 MB 未満
tools/td.sh capture ./hgx-film --stills beats --cols 4 --timeline hgx-film/timeline.json --out teardown-out/hgx-beats.png
tools/td.sh capture ./hgx-film --still <T> --out teardown-out/hgx-<T>.png        # 各章1枚以上
node tools/live-check.mjs teardown-out/dist/hgx-live.html --click "<章2のボタン文字>" --watch pull --within 3
node tools/live-check.mjs teardown-out/dist/hgx-live.html --click "<章5のボタン文字>" --watch sentGB --within 6
node tools/live-check.mjs teardown-out/dist/hgx-live.html --click "<章7のボタン文字>" --watch dT --within 4
```
- `hgx/kin.test.mjs` は少なくとも次を確かめる: 1,440 GB・64 TB/s、144 = 144 と1チップ 9 本、14.4 TB/s、全 56 組で1段、18 倍、0.8 TB/s、7/71、all-reduce の 1.75 GB・1.944 ms・0.2222 GB・4.444 ms・1.778 GB・6.389 ms、NVL72 の 2.191 ms を `nvl72-shared/kin.js` から読んで比べる、16.5 kW・19.8 kW・14.3 A、48,794 BTU/h → 14,300 W、1,550 CFM → 0.7315 m³/s → 16.2 K、20.5 L/分、444.5 mm、ラックの台数（30/40/60 kW → 2/2/4 台）、9 台 128.7 kW・90U。
- 静止画は全部自分で開いて読み、teardown SKILL.md のチェックリスト（めり込み無し・数値と姿勢の一致・文字切れ無し・ラベルが部品を隠さない・引き出し線が交差しない・1コマ1焦点）で通るまで直す。

## 触らない
- `hgx/refs.md`、`hgx/brief.md`、`nvl72/refs.md`、`nvl72/brief.md`、`switch/refs.md`、`brief.md`（読むだけ）。`nvl72-shared/`（import して読むだけ。変えるなら報告してから）。`docs/`、`site/`、`tools/publish-pages.sh`（公開は親がやる）。`$SKILL_DIR` 配下。git の操作はしない。

## 報告（この形で返す。600 語以内）
- 変更・作成したファイルの一覧と行数（`kit/` や1本目・2本目を変えたらそれも）
- 各検証コマンドの結果
- 確認した静止画のパスと、見て直した点
- 直せなかった点・refs.md と食い違った点・判断に迷った点
