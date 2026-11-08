# Catalyst 9300-48P を模した 1U スイッチの仕様と出典

Cisco Catalyst 9300-48P（48 ポート 1G PoE+、UADP 2.0 ASIC 1個）を想定した教材用の簡略モデル。
形は寸法だけを合わせた簡略形状で、Cisco のロゴ・写真・白書の図は使わない。
出典のある値を土台にし、出典の無いところは **仮定** と書く。
**数値はすべて `switch-shared/kin.js` の `SPEC` に1か所だけ書き、画面と動きの両方がそこを読む。**

## 出典
1. Cisco, *Catalyst 9300 Series Switches Architecture White Paper*（2023-03 版）。https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-architecture-cte-en.html — 「UADP ASIC」「x86 CPU complex」「Chassis cooling / power」「Packet walks」の節
2. Cisco, *Catalyst 9300 Series Switches Data Sheet*。https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html — Table 4（PoE 予算）、Table 8（DRAM・MAC 表）、Table 9（交換容量・転送レート）、Table 18（寸法・重さ）
3. Cisco TAC, *Troubleshoot Control Plane Operations on Catalyst 9000*（文書 221841）。https://www.cisco.com/c/en/us/support/docs/switches/catalyst-9300-switch/221841-troubleshoot-control-plane-operations-on.html — CPU キュー名と番号、CoPP の既定レートの出力例、CPU 全体の上限
4. Cisco, *Catalyst 9000 Switching Platforms: QoS and Queuing White Paper*。https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9000/white-paper-c11-742388.html — 既定の2キュー、WTD のしきい値、Table 3（ポート速度ごとのバッファ単位）、softmax 倍率

## 筐体（出典2 Table 18、出典1）
| 項目 | 値 | 根拠 |
|---|---|---|
| 寸法（筐体のみ） | 高さ 44 mm × 幅 445 mm × 奥行 409 mm（1.73 × 17.5 × 16.1 in） | 出典2 Table 18 |
| 重さ（既定の電源つき） | 7.59 kg | 出典2 Table 18 |
| 前面 | 1G RJ-45 × 48（上下2段 × 24）、右端にネットワークモジュール NM-8X（10G SFP+ × 8）、左に USB-A と USB シリアルコンソール | ポート数は出典2。NM-8X を挿した構成は仮定（下の検算で交換容量 256 Gbps と合う） |
| 背面 | 電源ベイ × 2（1台目 715 W、2台目は空き）、ファン × 3、スタックポート × 2、StackPower × 2、RJ-45 コンソール、管理ポート、SSD スロット | 出典1「Chassis design」。並び順は簡略（仮定） |
| 風の向き | 前面と側面から吸って背面へ | 出典1「Chassis airflow」 |
| ファン | 3基、可変速・ホットスワップ、1基が止まっても残りが回転を上げて冷やす（N+1） | 出典1「Chassis cooling」、出典2 |
| 電源 | PWR-C1-715WAC-P（715 W AC）。80 PLUS Platinum、全負荷で効率 90% 超 | 出典2 Table 4、出典1 |
| PoE 予算 | 715 W 電源1台で 437 W | 出典2 Table 4 |

## 基板の上（出典1、配置は仮定）
| 部品 | 値 | 根拠 |
|---|---|---|
| UADP 2.0 ASIC | 1個、28 nm、ヒートシンク付き、基板の中央 | 出典1「UADP ASIC」。48P が ASIC 1個なのは出典1のモデル一覧 |
| ASIC の能力 | 160 Gbps、238 Mpps、パケットバッファ 16 MB | 出典1。48P のバッファが 16 MB か 32 MB かは出典2で読み切れず → **16 MB は仮定** |
| ASIC の表 | MAC 表 32,000、IPv4 直結 32,000／LPM 8,000、IPv6 直結 16,000／LPM 4,000、セキュリティ ACL 5,000 | 出典2 Table 8（MAC）、出典1（FIB・ACL） |
| PHY | 8ポート用の PHY チップ × 6、前面ポートのすぐ後ろに1列 | **仮定**（チップ数と配置は非公表） |
| CPU | x86 4コア 1.8 GHz（2.4 GHz の版もある） | 出典1「x86 CPU complex」。48P の周波数は非公表 → 1.8 GHz は仮定 |
| メモリ | DDR4 8 GB × 1枚 | 出典2 Table 8、出典1 |
| フラッシュ | eUSB 16 GB | 出典1、出典2 Table 8 |
| ASIC と CPU のつなぎ | 基板上の配線1本で描く。方式（PCIe など）は出典に無い | **仮定**（画面には「方式は非公表」と書く） |

## ASIC の中のパケットの通り道（出典1「Packet walks」、同じ ASIC 内のユニキャスト）
並びはこの順。段の名前は白書の略称を使い、画面には日本語の一言を添える。

| # | 段 | 何をするか |
|---|---|---|
| 1 | 入口ポート → PHY | 電気信号をフレームに戻して NIF へ |
| 2 | NIF（ネットワークインターフェース） | フレームを **256 バイトの切れ端**に分ける。時刻印（1588）と省電力（EEE）も扱う |
| 3 | 入口 MACsec | 暗号を解く（使うときだけ）。固定遅延のカットスルー |
| 4 | 入口 FIFO | 切れ端を集めて PBC へ流す |
| 5 | IFC（入口転送制御） | FIFO→PBC の流れを**横から覗いて**検索する（MAC 表・FIB・ACL・QoS）。結果を **64 バイトの札（ディスクリプタ）** にして PBC に返す |
| 6 | PBC（パケットバッファ） | 本体を置いておく場所。札を見て出口ポートと QoS を決める。出口が同じ ASIC なら EQS に直接並べる |
| 7 | EQS（出口キューとスケジューラ） | 出口キューに並べる・複製（フラッディング、マルチキャスト）・送り出す順を決める |
| 8 | PBC → RWE | 順番が来た本体を書き換え部へ渡す |
| 9–10 | EFC（出口転送制御） | PBC→RWE の流れを覗き、出口側の検索（SPAN、再循環）をして書き換えの札を作る |
| 11 | RWE（書き換え） | L3 なら宛先・送信元 MAC の付け替えと TTL−1。必要なら分割。出口 FIFO へ |
| 12 | 出口 MACsec → NIF → PHY → 出口ポート | 暗号をかけ（使うときだけ）、線に送り出す |

- ASIC を2個持つ型番やスタックでは、6 の後に **IQS（入口キューとスケジューラ）** を通ってスタック側へ出る（出典1 の2つ目の Packet walk）。48P は ASIC 1個なので、画面では注記にとどめる。
- 各段の所要時間は出典に無い。**画面の動きは説明のために引き伸ばした時間**で、実時間として出すのは線に乗る時間（直列化時間）だけにする。

## CPU に上がるパケット（パント）（出典3）
| 種類 | CPU キュー | 既定の上限 |
|---|---|---|
| ARP（自分宛て・アドレス解決） | WK_CPU_Q_FORUS_ADDR_RESOLUTION（5） | 4,000 pps |
| ルーティングプロトコル（OSPF・BGP・HSRP など） | WK_CPU_Q_ROUTING_CONTROL（4） | 5,500 pps |
| ICMP の生成（TTL 切れ・宛先不達） | WK_CPU_Q_ICMP_GEN（3） | 750 pps |
| L2 制御（STP・CDP・LLDP・LACP） | WK_CPU_Q_L2_CONTROL（1） | 2,000 pps |
| 自分宛ての通信（SSH・ping・SNMP） | WK_CPU_Q_FORUS_TRAFFIC（2） | 4,000 pps |

- 既定の上限は出典3にある Catalyst 9500 の `show platform hardware fed active qos queue stats internal cpu policer` の出力例。**9300 の版ごとの値は違うことがある（仮定として同じ値を使う）**。
- CPU 全体で受けられるのは約 **19,000 pps**（出典3）。上限は ASIC の中（CPU に渡す手前）の CoPP ポリサーで効く。
- ソフトウェアの層: ASIC → CPU →（Linux カーネル）→ **FED**（転送エンジンのドライバ）→ **PDS**（パケット受け渡し）→ **IOSd**（IOS の本体）。返事（ARP 応答など）は逆向きに「インジェクト」される。カーネル部分の詳細は出典に無い。

## 混雑（出典4、48P の 1G ポート）
| 項目 | 値 | 根拠 |
|---|---|---|
| 既定のキュー | 2本。Q0＝優先・制御用（厳密優先ではない）、Q1＝その他 | 出典4 |
| 1G ポートのバッファ | Q0: HardMax 100 / SoftMax 400 単位、Q1: SoftMin 150 / SoftMax 600 単位 | 出典4 Table 3（100 Mbps〜5 Gbps の行） |
| 1単位の大きさ | **256 バイト（仮定）**。出典4は単位をバイトで書いていない。NIF の切れ端の大きさに合わせた | 仮定 |
| softmax 倍率 | `qos queue-softmax-multiplier` 100〜1200。1200 で吸収できる量が 12 倍 | 出典4 |
| 捨て方 | WTD。しきい値 80% / 90% / 100%、既定は全トラフィックが 100%（＝末尾で捨てる） | 出典4 |

## 検算（`switch/kin.test.mjs` で機械的に確かめる値）
- **交換容量**: (48 × 1 + 8 × 10) Gbps = 128 Gbps（片方向）× 2（全二重）= **256 Gbps**（出典2 Table 9 と一致）
- **転送レート**: 最小フレーム 64 B に前置き＋フレーム間隔 20 B を足して 84 B = 672 bit。128 × 10⁹ / 672 = **190.48 Mpps**（出典2 は 190.47 Mpps。小数第3位の切り捨て差）
- **直列化時間**（線に乗る時間、前置き＋間隔 20 B を含む）:
  - 1518 B を 1 Gbps: (1518 + 20) × 8 / 10⁹ = **12.304 µs**
  - 64 B を 1 Gbps: **0.672 µs**
  - 1518 B を 10 Gbps: **1.2304 µs**
- **NIF の切れ端**: 1518 B → ⌈1518 / 256⌉ = **6 個**（最後は 238 B）。64 B → **1 個**
- **札と本体**: 1518 B の本体に対して札は 64 B。本体の **約 1/24**（1518 / 64 = 23.7）しか動かない
- **ハードと CPU の速さの差**: 190.48 Mpps / 19,000 pps ≈ **10,025 倍**
- **ARP の嵐**: 10,000 pps の ARP が来ると、キュー5 の上限 4,000 pps を超えた **6,000 pps** が CPU の手前で捨てられる（CPU は守られる）
- **混雑で溢れるまでの時間**（Gi1/0/1 と Gi1/0/2 から各 1 Gbps で Gi1/0/3 の 1 Gbps へ。差し引き 1 Gbps ずつ溜まる）:
  - Q1 の上限 600 単位 × 256 B = **153,600 B**。1 Gbps = 125,000,000 B/s で溜まるので **1.2288 ms** で満杯、以後は末尾で捨てる
  - 1518 B のフレームで **101 個**（153,600 / 1518 = 101.2）
  - 倍率 1200 にすると 153,600 × 12 = **1,843,200 B**、満杯まで **14.7456 ms**
- **PoE**: 715 W 電源1台の予算 437 W で 30 W（PoE+ の上限）の機器は **14 台**まで（437 / 30 = 14.57）。48 ポート全部に 30 W なら 1,440 W 要る（出典2 Table 10 は 1100 W 電源 × 2 などを求める）

## 各章で打つコマンド（ラボ用。IOL＝Containerlab の Cisco IOL で出るか）
| 章 | コマンド | IOL |
|---|---|---|
| 1 外観 | `show inventory` / `show version` / `show environment all` | 前2つは出る。環境は実機のみ |
| 2 分解 | `show platform` / `show platform software status control-processor brief` | 実機のみ |
| 3 役割分担 | `show platform software fed switch active ifm mappings`（ポートと ASIC の対応） | 実機のみ |
| 4 パケットの一生 | `show mac address-table` / `show ip cef <宛先> detail` / `show platform software fed switch active matm macTable vlan <n>` | 前2つは出る。matm は実機のみ（ハードに書かれた MAC 表） |
| 5 パント | `show platform software fed switch active punt cpuq 5` / `show platform hardware fed switch active qos queue stats internal cpu policer` / `show policy-map control-plane` | 実機のみ。IOL では `show ip traffic` と `show arp` で代わりに見る |
| 6 混雑 | `show platform hardware fed switch active qos queue stats interface Gi1/0/3` / `show policy-map interface Gi1/0/3` | 実機のみ。IOL では `show interfaces Gi0/3` の output drops |
| 7 冷却と電力 | `show environment all` / `show power inline` | 実機のみ |
