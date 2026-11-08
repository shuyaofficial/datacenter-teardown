# NVIDIA GB200 NVL72 ラックの仕様と出典

NVIDIA GB200 NVL72（GPU 72個を1つの NVLink の領域で結んだラック）を想定した教材用の簡略モデル。
形は寸法と部品の数を合わせた簡略形状で、NVIDIA のロゴ・写真・図は使わない。
出典のある値を土台にし、出典の無いところは **仮定**、出典の値から割り算・掛け算したものは **計算** と書く。
**数値はすべて `nvl72-shared/kin.js` の `SPEC` に1か所だけ書き、画面と動きの両方がそこを読む。**

## 出典
1. NVIDIA, *DGX GB Rack Scale Systems User Guide*「Hardware」。https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html — 1.1 Rack Configuration、1.2 Compute Trays、1.3 NVLink Switch Trays、1.4 Power Shelves
2. NVIDIA, *DGX SuperPOD Reference Architecture (GB200)*「Key Components」。https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-gb200/latest/dgx-superpod-components.html
3. NVIDIA, *Multi-Node NVLink Tuning Guide*「Understanding Your Grace-Blackwell Systems」。https://docs.nvidia.com/multi-node-nvlink-systems/multi-node-tuning-guide/system.html
4. NVIDIA, *GB200 NVL72* 製品ページ「Specifications」。https://www.nvidia.com/en-us/data-center/gb200-nvl72/
5. NVIDIA Technical Blog, *NVIDIA GB200 NVL72 Delivers Trillion-Parameter LLM Training and Real-Time Inference*。https://developer.nvidia.com/blog/nvidia-gb200-nvl72-delivers-trillion-parameter-llm-training-and-real-time-inference/
6. NVIDIA Technical Blog, *NVIDIA Contributes NVIDIA GB200 NVL72 Designs to Open Compute Project*。https://developer.nvidia.com/blog/nvidia-contributes-nvidia-gb200-nvl72-designs-to-open-compute-project
7. Supermicro, *SuperCluster GB200 NVL72 Datasheet*。https://www.supermicro.com/datasheet/datasheet_SuperCluster_GB200_NVL72.pdf — NVIDIA が書いていない外形寸法とトレイの並びだけに使う
8. NVIDIA, *GB300 NVL72* 製品ページ https://www.nvidia.com/en-us/data-center/gb300-nvl72/ と *Vera Rubin NVL72* 製品ページ https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/ — 次の世代の注記だけに使う

## ラック（出典1、6、7）
| 項目 | 値 | 根拠 |
|---|---|---|
| 構成 | 1U の計算トレイ × 18、1U の NVLink スイッチトレイ × 9、管理用の TOR スイッチ × 2、電源棚、母線（バスバー）、液冷のマニホールド | 出典1 1.1 |
| 並び | 上から 計算トレイ 10 → スイッチトレイ 9 → 計算トレイ 8。電源棚は上下に4台ずつ | トレイの並びは出典7。**電源棚の位置は仮定** |
| 外形 | 高さ 2,236 mm × 幅 600 mm × 奥行 1,068 mm | 出典7（NVIDIA は書いていない） |
| 背面 | NVLink のケーブルカートリッジ（縦に4本、銅線 5,000 本超）、液冷のマニホールド、母線。どれも差し込むだけでつながる（ブラインドメイト） | 出典6、出典1 |
| 前面 | 計算トレイの NIC・DPU のポート、管理ポート | 出典1、2 |
| 重さ | 描かない（NVIDIA の値が無い） | — |

## 計算トレイ（出典1 1.2、出典4、出典5）
| 項目 | 値 | 根拠 |
|---|---|---|
| 中身 | GB200 スーパーチップ × 2 ＝ Grace CPU × 2 ＋ B200 GPU × 4 | 出典1 |
| Grace CPU | Arm Neoverse V2 72 コア、LPDDR5X 最大 480 GB | 出典4 |
| B200 GPU | HBM3e 186 GB、8 TB/s | 計算（出典4 のスーパーチップあたり 372 GB・16 TB/s を GPU 2個で割った） |
| CPU と GPU のつなぎ | NVLink-C2C 900 GB/s（双方向） | 出典5、出典2 |
| ラックの外への NIC | ConnectX-7 × 4（1ポート 400G OSFP。GPU 1個に1枚） | 出典1 1.2 |
| DPU | BlueField-3 × 2（2ポート 400G。ストレージと管理） | 出典1 1.2 |
| 記憶装置 | E1.S NVMe 3.84 TB × 4（RAID 0 のキャッシュ）＋ M.2 1.92 TB（起動用） | 出典1 1.2 |
| 冷やし方 | 液冷のコールドプレート: Grace・B200・ConnectX-7。空冷（ファン）: それ以外（NIC の周り、記憶装置など） | 出典3 |

## NVLink スイッチトレイと NVLink（出典1 1.3、出典5）
| 項目 | 値 | 根拠 |
|---|---|---|
| 世代 | NVLink 5 | 出典1 |
| GPU 1個のリンク | 18 本、合計 1.8 TB/s（双方向） | 出典1、出典5 |
| 1本のリンク | 100 GB/s（双方向。片方向 50 GB/s） | 計算（1.8 TB/s ÷ 18） |
| スイッチトレイ | 1U、NVSwitch チップ × 2、各 72 ポート → 1トレイ 144 ポート | 出典1 1.3 |
| スイッチチップの数 | 9 トレイ × 2 ＝ 18 個 | 計算 |
| つなぎ方 | GPU の 18 本のリンクは 18 個のスイッチチップに1本ずつ行く。どのチップも 72 個の GPU に1本ずつつながる → どの GPU からどの GPU へも、スイッチ1段で届く | 出典5「9 つのスイッチトレイが 72 個の GPU の 18 ポートすべてを結ぶ」から計算（ポート数がちょうど合う）。1本ずつの割り当ては **計算による解釈** |
| ラック全体 | 130 TB/s | 出典4、出典5 |
| スイッチの中の計算 | NVSwitch は集団通信の計算をスイッチの中でできる（SHARP） | 出典1「NVSwitch incorporates in-network computing (SHARP)」 |
| 銅線を使う理由（画面の説明） | ラックの中は光に変換せず銅線で直結する | 出典6（銅のケーブルカートリッジ）。省電力の数値は NVIDIA の文書に無いので出さない |

## ラックの外へ（出典1、出典2）
| 項目 | 値 | 根拠 |
|---|---|---|
| 計算用のネットワーク | GPU 1個に ConnectX-7 1枚、400 Gb/s の InfiniBand。レールに沿った fat tree | 出典2 |
| ストレージ用 | BlueField-3 から Ethernet（RoCE） | 出典2 |

## 性能と記憶容量（出典4「Specifications」）
| 項目 | 値 |
|---|---|
| FP4 | 1,440 PFLOPS（疎）／720 PFLOPS（密） |
| FP8 | 720 PFLOPS（疎） |
| HBM3e | 13.4 TB、576 TB/s |
| LPDDR5X | 17 TB |
| CPU コア | 2,592 |
- 出典4は LPDDR5X の帯域をラックで 14 TB/s と書くが、Grace 1個 512 GB/s × 36 = 18.4 TB/s と合わない。**画面に帯域は出さない**。

## 電源（出典1 1.4）
| 項目 | 値 | 根拠 |
|---|---|---|
| ラックの消費電力 | 約 120 kW | 出典1 1.4、出典6 |
| 電源棚 | 8 台。1台に空冷の 5.5 kW 電源 × 6、入力 33 kW。N+N の冗長 | 出典1 1.4 |
| 出力 | 直流 50〜51 V を母線へ | 出典1 1.4 |

## 液冷（出典1、出典3、出典6）
| 項目 | 値 | 根拠 |
|---|---|---|
| 方式 | チップに直接当てるコールドプレート、単相（液体のまま） | 出典1、出典6 |
| 冷やす部品 | Grace・B200・ConnectX-7・NVSwitch | 出典3 |
| 冷却液の温度・流量 | NVIDIA の GB200 の文書に無い | — |
| 流量の計算例 | 120 kW を水（比熱 4.18 kJ/kg·K）で、入口と出口の温度差 10 K で運ぶとき | **仮定**（全部の熱が液に行き、温度差 10 K とする） |

## 検算（`nvl72/kin.test.mjs` で機械的に確かめる値）
- **ポートの数が合う**: GPU 72 × 18 本 = **1,296**、スイッチ 9 トレイ × 2 チップ × 72 ポート = **1,296**
- **ラックの帯域**: 72 × 1.8 TB/s = **129.6 TB/s**（出典の 130 TB/s と合う）
- **スイッチトレイの帯域**: 144 ポート × 50 GB/s × 8 bit = **57.6 Tb/s**（出典1 の値と合う。片方向の合計）
- **1段で届く**: どの GPU の組でも、通るスイッチチップは1個（経路の長さを全 72 × 71 組で確かめる）
- **ラックの中と外の差**: NVLink 1.8 TB/s（双方向）÷ ConnectX-7 の 400 Gb/s を双方向にした 100 GB/s = **18 倍**
- **all-reduce（帯域だけの単純計算。遅延は入れない）**: 1 GB の勾配を 72 個の GPU で合計する
  - リング方式: GPU 1個が送る量 = 2 × (72 − 1) / 72 × 1 GB = **1.972 GB**、片方向 900 GB/s で **2.191 ms**
  - スイッチの中で合計（SHARP）: 1個が送るのは 1 GB だけ、**1.111 ms**
- **電源**: 8 × 6 × 5.5 kW = **264 kW** を積み、N+N なので使えるのは半分の **132 kW**。消費 120 kW は収まる
- **母線の電流**: 120 kW ÷ 50 V = **2,400 A**（太い銅の板で運ぶ理由。母線を何本に分けるかは書かない）
- **液冷の流量の計算例**: 120 kW ÷ (4.18 × 10 K) = **2.871 kg/s**、約 **172 L/分**（温度差 5 K なら倍の 344 L/分）
- **記憶容量**: HBM 72 × 186 GB = **13,392 GB**（出典の 13.4 TB と合う）、帯域 72 × 8 TB/s = **576 TB/s**、LPDDR5X 36 × 480 GB = **17,280 GB**（出典の 17 TB と合う）、コア 36 × 72 = **2,592**

## 実機で見るには（各章の下に添える。どれも実機のみ）
| 章 | コマンド | 何が見えるか |
|---|---|---|
| 2 計算トレイ | `nvidia-smi -q` / `nvidia-smi topo -m` | GPU と CPU・NIC のつながり |
| 3 72個が1つに | `nvidia-smi nvlink -s` / `nvidia-smi -q \| grep -i fabric` | リンクごとの速さ、NVLink の領域（クリーク）への参加 |
| 4 all-reduce | `all_reduce_perf -b 1G -e 1G -g 1`（nccl-tests を MPI で 72 プロセス） | 実測の帯域（algbw・busbw） |
| 5 ラックの外へ | `ibstat` / `ibv_devinfo` | ConnectX-7 の速さ（400 Gb/s）とポートの状態 |
| 6 電源・7 液冷 | `ipmitool sensor` / `nvidia-smi -q -d POWER,TEMPERATURE` | 消費電力と温度 |

## 次の世代（画面の脚注）
- GB300 NVL72: GPU が Blackwell Ultra、HBM3e はラックで 20 TB、NIC は ConnectX-8（GPU 1個に 800 Gb/s）。NVLink は同じ 130 TB/s（出典8）。
- Vera Rubin NVL72: HBM4、NVLink 6 でラック 216 TB/s（GPU 1個 3 TB/s）、CPU は Vera（出典8）。
