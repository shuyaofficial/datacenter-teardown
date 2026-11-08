# datacenter-teardown

データセンターの機器を、ブラウザで分解しながら中の仕組みを見る3Dシミュレータです。
ページは1ファイル（1 MB 未満）で、オフラインでも開けます。

**デモ: https://shuyaofficial.github.io/datacenter-teardown/**

| 機器 | 見どころ | ページ |
|---|---|---|
| スイッチ（Catalyst 9300-48P を模した 1U） | フレームは ASIC の中で 256 B の切れ端に分かれ、本体はバッファ（PBC）に置かれたまま 64 B の札だけが検索とキューを回る。CPU に上がるのは自分宛てと制御だけ（ハード 190.48 Mpps に対して CPU は約 19,000 pps）。2本の 1G が1本に集まると出口のキューは 1.2288 ms で満杯になる | [switch-live.html](https://shuyaofficial.github.io/datacenter-teardown/switch-live.html) |

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

## 数値の出どころ

ASIC の段の並び、表の大きさ、CPU キューの上限、バッファの量は、Cisco の白書・データシート・TAC の文書から取りました。
出典の無いところ（バッファ1単位のバイト数など）は「仮定」と書いています。
画面の計器とパケットの動きは同じ式から出しているので、表示と動きが食い違いません。
出典と手計算の検算は [switch/refs.md](switch/refs.md) にあり、`switch/kin.test.mjs` がその値を確かめます。

```bash
node switch/kin.test.mjs
```

ASIC の中の各段の所要時間は公表されていないので、画面の動きは説明のために引き伸ばしています。実時間として出しているのは、線に乗る時間（直列化時間）とキューが満杯になるまでの時間だけです。

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
| `switch-shared/` | 数式と仕様（`kin.js`）、ASIC の中の流れ（`flow.js`）、形状（`chassis.js`・`asic.js`）、照明、計器、ツアー台本、操作 |
| `switch-live/` | 操作できるページの入口 |
| `switch-film/` | 静止画の検査用（ツアーを時刻で止めて撮る） |
| `switch/` | 出典と検算（`refs.md`）、テスト |
| `kit/` | 配色・日本語フォント・パネル・ツアーのカーソル |
| `site/` | 公開ページの入口（`docs/index.html` の元） |
| `docs/` | GitHub Pages が配るページ |

## 注意

非公式の教材です。Cisco Systems とは関係がありません。Cisco・Catalyst は Cisco Systems, Inc. の商標です。
形は寸法を合わせた簡略形状で、実機の基板配置とは違います。Cisco のロゴ・写真・白書の図は使っていません。

## ライセンス

MIT（[LICENSE](LICENSE)）。ページに同梱している OSS とフォントのライセンスは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) にあります。
