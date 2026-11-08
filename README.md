# datacenter-teardown

データセンターの機器を、ブラウザで分解しながら中の仕組みを見る3Dシミュレータです。
ページは1ファイル（1 MB 未満）で、オフラインでも開けます。

**デモ: https://shuyaofficial.github.io/datacenter-teardown/**

| 機器 | 見どころ | ページ |
|---|---|---|
| スイッチ（Catalyst 9300-48P を模した 1U） | フレームは ASIC の中で 256 B の切れ端に分かれ、本体はバッファ（PBC）に置かれたまま 64 B の札だけが検索とキューを回る。CPU に上がるのは自分宛てと制御だけ（ハード 190.48 Mpps に対して CPU は約 19,000 pps）。2本の 1G が1本に集まると出口のキューは 1.2288 ms で満杯になる | [switch-live.html](https://shuyaofficial.github.io/datacenter-teardown/switch-live.html) |
| GPU ラック（GB200 NVL72 を模した 72 GPU） | GPU 1個の 18 本のリンクは 18 個のスイッチチップに1本ずつ行くので、どの GPU の組もスイッチ1段で届く（ポートは 1,296 = 1,296）。ラックの外（ConnectX-7 400 Gb/s）は中（NVLink 1.8 TB/s）の 18 分の1。all-reduce をスイッチの中で足すと、GPU 1個が送る量は 1.972 GB から 1 GB になる | [nvl72-live.html](https://shuyaofficial.github.io/datacenter-teardown/nvl72-live.html) |

何も触らないと自動でツアーが流れます。どこかをクリックすると操作できるようになり、25秒触らないとツアーに戻ります。

## スイッチの章立て
1. 外観（前面・背面）
2. 蓋を開ける（天板・ヒートシンク・ネットワークモジュール・電源の順に外れる）
3. データプレーンとコントロールプレーン
4. パケットの一生（L2 / L3 / 宛先不明）
5. CPU に上がるとき（ARP・ARP の嵐・TTL 切れ）
6. 混んだとき（2本の 1G が1本へ、softmax 倍率 100 / 1200）
7. 冷却と電力（風の通り道と PoE の予算）

各章に、ラボで打つコマンドと、それが Containerlab の Cisco IOL でも出るか実機だけかを書いています。

## GPU ラックの章立て
1. 外観（前と後ろ。ケーブルカートリッジ・マニホールド・母線）
2. 計算トレイを引き出す（GB200 スーパーチップ 2 枚、ConnectX-7、BlueField-3、E1.S）
3. 72 個が1つになる（18 本のリンクとスイッチ1段）
4. 学習1歩の集計（リングとスイッチの中での合計）
5. ラックの外へ（NVLink と ConnectX-7 の 18 倍の差）
6. 120 kW を運び込む（電源棚と母線）
7. 液で冷やす（温度差と流量）

## 数値の出どころ

スイッチは Cisco の白書・データシート・TAC の文書から、GPU ラックは NVIDIA の DGX GB200 の取扱説明書・リファレンスアーキテクチャ・製品ページから取りました。
出典の無いところ（バッファ1単位のバイト数など）は「仮定」と書いています。
画面の計器とパケットの動きは同じ式から出しているので、表示と動きが食い違いません。
出典と手計算の検算は [switch/refs.md](switch/refs.md) と [nvl72/refs.md](nvl72/refs.md) にあり、各フォルダの `kin.test.mjs` がその値を確かめます。

```bash
node switch/kin.test.mjs
node nvl72/kin.test.mjs
```

画面の動きは説明のために引き伸ばしています。実時間として出しているのは出典の値から計算したものだけです（直列化時間、キューが満杯になるまでの時間、all-reduce の帯域だけの所要時間など）。

## 作り方

土台は OSS の [teardown](https://github.com/elvarofficial/teardown)（機械の3Dシミュレータを作る Claude Code のスキル）です。
共通部品（`kit/`）とビルドの手順は [building-teardown](https://github.com/shuyaofficial/building-teardown) と同じものを使っています。
章ごとのカメラと部品の分解は [atlas-of-physics](https://github.com/nathanliow/atlas-of-physics) の見せ方を参考にしました（コードは使っていません）。

```bash
# teardown を ~/.claude/skills/teardown に入れてから
tools/td.sh build ./switch-live          # → teardown-out/dist/switch-live.html
tools/publish-pages.sh                   # ビルドして docs/ にそろえる
```

| フォルダ | 中身 |
|---|---|
| `nvl72-shared/`・`nvl72-live/`・`nvl72-film/`・`nvl72/` | GPU ラックの同じ構成 |
| `switch-shared/` | 数式と仕様（`kin.js`）、ASIC の中の流れ（`flow.js`）、形状（`chassis.js`・`asic.js`）、照明、計器、ツアー台本、操作 |
| `switch-live/` | 操作できるページの入口 |
| `switch-film/` | 静止画の検査用（ツアーを時刻で止めて撮る） |
| `switch/` | 出典と検算（`refs.md`）、テスト |
| `kit/` | 配色・日本語フォント・パネル・ツアーのカーソル |
| `site/` | 公開ページの入口（`docs/index.html` の元） |
| `docs/` | GitHub Pages が配るページ |

## 注意

非公式の教材です。Cisco Systems・NVIDIA とは関係がありません。Cisco・Catalyst は Cisco Systems, Inc. の、NVIDIA・GB200・NVLink・Grace・Blackwell・ConnectX・BlueField は NVIDIA Corporation の商標です。
形は寸法を合わせた簡略形状で、実機の基板配置とは違います。各社のロゴ・写真・資料の図は使っていません。

## ライセンス

MIT（[LICENSE](LICENSE)）。ページに同梱している OSS とフォントのライセンスは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) にあります。
