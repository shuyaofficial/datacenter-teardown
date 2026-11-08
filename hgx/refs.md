# NVIDIA HGX B200（DGX B200）の仕様と出典

NVIDIA HGX B200（GPU 8 個を基板の上の NVSwitch で結んだサーバー用の板）を、それを載せた完成品 **DGX B200**（10U の空冷サーバー）を例に見せる教材用の簡略モデル。
GB200 NVL72（`nvl72/refs.md`）の1つ前の形で、**NVLink の領域が 8 個で止まり、その外はネットワーク**という違いを見せるために作る。
形は寸法と部品の数を合わせた簡略形状で、NVIDIA のロゴ・写真・図は使わない。
出典のある値を土台にし、出典の無いところは **仮定**、出典の値から割り算・掛け算したものは **計算**、調べたが見つからなかったものは **未確認** と書く。
**数値はすべて `hgx-shared/kin.js` の `SPEC` に1か所だけ書き、画面と動きの両方がそこを読む。**
NVL72 と共通の値（NVLink 5 のリンクの数、NVSwitch チップのポート数、ConnectX-7 の速さ）は `nvl72/refs.md` と同じ値を使う。食い違ったら報告する。

調べた日: 2026-11-08（ページの閲覧のみ。ファイルは取り込んでいない）

## 出典
1. NVIDIA, *DGX B200 User Guide*「Introduction to NVIDIA DGX B200 Systems」（Hardware Overview、Mechanical / Power / Environmental Specifications、Network Ports、Network Modules、System Topology）。https://docs.nvidia.com/dgx/dgxb200-user-guide/introduction-to-dgxb200.html
2. NVIDIA, *DGX B200* 製品ページ「Specifications」。https://www.nvidia.com/en-us/data-center/dgx-b200/
3. NVIDIA, *HGX Platform* 製品ページ「Specifications」（HGX B200 / HGX B300 / HGX Rubin NVL8 の比較表）。https://www.nvidia.com/en-us/data-center/hgx/
4. NVIDIA, *DGX B200 Service Manual*。
   - 4a「Front Fan Module Replacement」https://docs.nvidia.com/dgx/dgxb200-service-manual/front-fan-replacement.html
   - 4b「Power Supply Replacement」https://docs.nvidia.com/dgx/dgxb200-service-manual/psu-replacement.html
   - 4c「Motherboard Tray – Removal and Installation」https://docs.nvidia.com/dgx/dgxb200-service-manual/motherboard-tray-removal-install.html
   - 4d「U.2 NVMe Cache Replacement」https://docs.nvidia.com/dgx/dgxb200-service-manual/u2-nvme-cache-replacement.html
5. NVIDIA, *DGX SuperPOD Reference Architecture (DGX B200)*。
   - 5a「Key Components」https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-b200/latest/dgx-superpod-components.html
   - 5b「DGX SuperPOD Architecture」https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-b200/latest/dgx-superpod-architecture.html
   - 5c「Network Fabrics」https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-b200/latest/network-fabrics.html
6. `nvl72/refs.md`（このリポジトリ。NVLink 5 の GPU 1個 18 本・1本 100 GB/s、NVSwitch チップ 72 ポート、NVL72 の all-reduce の値。元は NVIDIA の DGX GB200 User Guide と技術ブログ）
7. Supermicro, *SYS-A22GA-NBRT*（10U 空冷の HGX B200 サーバー）製品ページ。https://www.supermicro.com/en/products/system/gpu/10u/sys-a22ga-nbrt — **DGX B200 ではない**。NVIDIA がファンの数を文字で書いていないので、空冷 10U の HGX B200 でファンがどのくらい要るかの参考だけに使う
8. Supermicro, *SYS-422GS-NBRT-LCC*（4U 液冷の HGX B200 サーバー）製品ページ。https://www.supermicro.com/en/products/system/gpu/4u/sys-422gs-nbrt-lcc — 「液冷版はあるか」の答えだけに使う

## 筐体（出典1、2、4）
| 項目 | 値 | 根拠 |
|---|---|---|
| 形 | 10U のラックマウント | 出典1、2 |
| 外形 | 高さ 444 mm（17.5 in）× 幅 482.3 mm（19 in、最大）× 奥行 897.1 mm（35.3 in、最大） | 出典1（出典2 は幅を 482.2 mm と書く。画面は出典1 の 482.3 mm） |
| 重さ | 最大 142.4 kg（313.9 lb） | 出典1（出典2 には書いていない） |
| 中の分け方 | GPU トレイ（HGX B200 の基板）とマザーボードトレイ（CPU・メモリ・NIC）の2段。マザーボードトレイは後ろへ引き抜き、奥のミッドプレーンのコネクタで GPU 側とつながる | 出典1（部品の名前）、出典4c（引き抜き方・ミッドプレーン） |
| 2段の上下 | **GPU トレイが上、マザーボードトレイが下**として描く | **仮定**（NVIDIA は図だけで文字に書いていない） |
| 前面 | ベゼル、その奥にファンモジュールの列と U.2 の差し込み口、電源・ID ボタンと故障 LED | 出典1、出典4a、4d |
| 背面 | 電源 6 台（PSU0〜PSU5）、OSFP の差し口 4 個、BlueField-3 のポート、管理ポート | 出典1、出典4b（電源の位置は「背面で LED を見る」という手順から） |

## GPU と NVLink（出典1、2、3、6）
| 項目 | 値 | 根拠 |
|---|---|---|
| GPU | B200（Blackwell、SXM）× 8 | 出典1、3 |
| HBM3e | 合計 1,440 GB、64 TB/s | 出典1、2 |
| GPU 1個の HBM | 180 GB、8 TB/s | 計算（1,440 ÷ 8、64 ÷ 8）。NVL72 の B200 は 186 GB（`nvl72/refs.md`）。**同じ B200 でも載っている容量の表記が違う**ので、画面では製品ごとの値を出し、混ぜない |
| GPU 1個の最大電力 | 1,000 W（電源 5 台以上が動いているとき）、800 W（3〜4 台のとき） | 出典1 の電源の冗長の表 |
| NVLink の世代 | 第5世代 | 出典1、3 |
| GPU 1個の NVLink | 1.8 TB/s（双方向）、18 本、1本 100 GB/s（片方向 50 GB/s） | 1.8 TB/s は出典3。本数と1本の速さは出典6（同じ B200 の NVLink 5） |
| 基板の上の NVSwitch | 2 個 | 出典1「2x 5th generation NVLink switches」、出典2。出典5a は同じ部品を「第4世代 NVSwitch」と書く（**呼び方が文書で違う**。画面は「NVSwitch チップ」とだけ書く） |
| NVSwitch チップ1個のポート | 72 | 出典6（NVL72 のスイッチトレイと同じ NVLink 5 のスイッチチップとみなす。**HGX B200 のチップのポート数を NVIDIA が直接書いたものは未確認**） |
| つなぎ方 | GPU 1個の 18 本を 9 本ずつ 2 個の NVSwitch に分ける。どの GPU からどの GPU へもスイッチ1段 | **計算による解釈**（8 × 18 = 144 = 2 × 72 でポートがちょうど合う）。出典は「NVSwitch で全部の GPU がつながる」までしか書かない |
| 8 個の NVLink の合計 | 14.4 TB/s | 出典1、2、3 |
| NVLink の領域 | 8 GPU。**その外の GPU へは NVLink では届かず、ConnectX-7 のネットワークを通る** | 出典3（HGX は「8x SXM」）、出典5（ノードの外は InfiniBand のファブリック） |

## CPU とメモリ（出典1、2）
| 項目 | 値 | 根拠 |
|---|---|---|
| CPU | Intel Xeon Platinum 8570 × 2、56 コアずつ（合計 112）、2.1 GHz（最大 4 GHz）、PCIe Gen5 | 出典1、2 |
| メモリ | 2 TB（DIMM 32 枚）、4 TB まで増やせる | 出典1 |
| DIMM 1枚 | 64 GB | 計算（2,048 GB ÷ 32） |
| CPU と GPU のつなぎ | PCIe Gen5（NVL72 の NVLink-C2C ではない） | 出典1（CPU が PCIe Gen5）。GPU 側が PCIe 5.0 x16 なのは出典7（DGX ではない） |

## ネットワーク（出典1、2、3、5）
| 項目 | 値 | 根拠 |
|---|---|---|
| 計算用の NIC | ConnectX-7 × 8（1ポートずつ）。既定は InfiniBand 400 Gb/s（Ethernet 400/200/100/50/40/25/10 GbE にもできる） | 出典1、2 |
| 差し口 | OSFP × 4。1つの OSFP に2ポート（P1・P2）があり、それぞれ別の ConnectX-7 につながる（中は DensiLink のケーブル） | 出典1 |
| GPU と NIC | GPU 1個に ConnectX-7 1枚 | 出典1 の Network Modules の表（8 ポートがそれぞれ GPU 0〜7 の1個に対応） |
| ポートと GPU の対応 | OSFP1P1→GPU7、OSFP1P2→GPU4、OSFP2P1→GPU6、OSFP2P2→GPU5、OSFP3P1→GPU2、OSFP3P2→GPU1、OSFP4P1→GPU3、OSFP4P2→GPU0 | 出典1 の Network Modules の表 |
| ネットワークの帯域（製品の表記） | 0.8 TB/s | 出典3（HGX B200）。8 × 400 Gb/s を双方向で数えた値と一致する（検算） |
| DPU | BlueField-3 × 2（2ポート、QSFP112、最大 400 Gb/s。1ポートは Ethernet、1ポートは InfiniBand）。ストレージと管理用 | 出典1、2 |
| 管理 | BMC 1 GbE（RJ45）、10 GbE（RJ45）、100 GbE 2ポート（スロット3、任意） | 出典1、2 |
| 計算用のファブリック | レールに沿った、ブロッキングの無い fat tree。1台から NDR 400 Gb/s × 8 本 | 出典5a |
| レールの数 | 8（GPU の番号ごとに別のリーフスイッチ） | **計算による解釈**（出典5c の 1 SU = 32 台・リーフ 8 台から。出典5c はレールの数を文字で書いていない） |
| スイッチ | Quantum QM9700（NDR 400 Gb/s InfiniBand） | 出典5a |
| 規模の例 | 1 SU = DGX B200 32 台。4 SU = 128 台（GPU 1,024 個）でリーフ 32・スパイン 16 | 出典5b |

## 記憶装置（出典1、2、4d）
| 項目 | 値 | 根拠 |
|---|---|---|
| OS | M.2 NVMe 1.92 TB × 2（RAID 1） | 出典1 |
| データのキャッシュ | U.2 NVMe 3.84 TB × 8（RAID 0、自己暗号化） | 出典1 |
| 位置 | U.2 は前面（ベゼルを外して差し替える） | 出典4d |

## 電源（出典1、2、4b）
| 項目 | 値 | 根拠 |
|---|---|---|
| 消費電力 | 最大 約 14.3 kW | 出典2、出典1 の電源の表 |
| 発熱 | 48,794 BTU/h | 出典1 |
| 電源 | 3.3 kW × 6 台（PSU0〜PSU5）、200〜240 V AC、16 A、50/60 Hz | 出典1、出典4b |
| 冗長 | 5+1。5 台で全力で動く | 出典1、出典4b |
| 減ったとき | 4 台以下で GPU 1個 800 W に絞る。3 台未満では起動せず BMC だけ動く | 出典1 |
| ラックの電源の上限 | 決まった値は無い（設置先しだい）。DGX SuperPOD の例では「1 ラック 25 kW を超える」 | 出典5b。1 ラックに何台置くかは出典に無い |

## 冷やし方（出典1、2、4a、7、8）
| 項目 | 値 | 根拠 |
|---|---|---|
| 方式 | 空冷（DGX B200 に液冷の版は無い） | 出典1・2 に液冷の記述が無く、風量だけが書いてある。「液冷の DGX B200 は無い」と NVIDIA が書いたものは **未確認** |
| 風量 | 1,550 CFM | 出典1 |
| 使える温度 | 10〜35 °C、湿度 20〜80 %（結露なし） | 出典1（出典2 は華氏を 50〜90 °F と書くが 35 °C は 95 °F。出典1 の 95 °F が正しい） |
| ファン | 前面のファンモジュール。1 個に 2 つのファン（`SPD_FAN_SYSn_F` と `_R`）、どちらかが壊れたらモジュールごと替える。替えるのは 30 秒以内 | 出典4a |
| ファンの数 | **未確認**（NVIDIA は図だけで数を書いていない） | 参考: 別の会社の 10U 空冷 HGX B200（出典7）は 80 mm × 最大 15 個 ＋ 60 mm × 最大 4 個、どれも二重反転 |
| 描くファンの数 | 前面のファンモジュール **12 個（2段 × 6）** | **仮定**（形のためだけ。画面に数は出さない） |
| 液冷の HGX B200 | ある。ただし NVIDIA の DGX ではなく他社のサーバー（例: 4U、コールドプレートで熱の最大 87 % を液へ、ファン 4 個） | 出典8 |

## 検算（`hgx/kin.test.mjs` で機械的に確かめる値）
- **HBM の合計**: 8 × 180 GB = **1,440 GB**、8 × 8 TB/s = **64 TB/s**（出典1・2 と合う）
- **ポートの数が合う**: GPU 8 × 18 本 = **144**、NVSwitch 2 × 72 ポート = **144**。GPU 1個から各チップへ **9 本**
- **NVLink の合計**: 8 × 1.8 TB/s = **14.4 TB/s**（出典と合う）
- **1段で届く**: 8 × 7 = 56 組すべてで、通る NVSwitch は1個
- **箱の中と外の差**: NVLink 1.8 TB/s（双方向）÷ ConnectX-7 400 Gb/s を双方向にした 100 GB/s = **18 倍**（NVL72 と同じ比。違うのは「箱の中」が 8 個か 72 個か）
- **ネットワークの帯域**: 8 × 400 Gb/s = 3.2 Tb/s = 片方向 **400 GB/s**、双方向 **800 GB/s = 0.8 TB/s**（出典3 と合う）
- **72 個で学習するとき、相手が箱の中にいる割合**: 1個の GPU から見て、ほかの 71 個のうち NVLink で届くのは **7 個 = 9.9 %**（NVL72 は 71 個 = 100 %）
- **all-reduce（帯域だけの単純計算。遅延は入れない。2段の方式は仮定）**: 1 GB の勾配を GPU 72 個（DGX B200 9 台）で合計する
  - 段1 箱の中で分けて集める（reduce-scatter）＋ 段3 箱の中で配る（all-gather）: GPU 1個が送る量 = 2 × 7/8 × 1 GB = **1.75 GB**、片方向 900 GB/s で **1.944 ms**
  - 段2 箱の外（同じ番号の GPU どうし 9 個でリング）: GPU 1個が送る量 = 2 × (9 − 1)/9 × (1 GB ÷ 8) = **0.2222 GB**、片方向 50 GB/s で **4.444 ms**
  - 1台から外へ出る量 = 8 × 0.2222 = **1.778 GB**（NVL72 では 72 個が全部ラックの中なので **0 GB**）
  - 合計 **6.389 ms**（段を重ねない場合）。NVL72 のリングは **2.191 ms**（`nvl72/refs.md`）→ 約 **2.9 倍**
- **電源**: 5 × 3.3 kW = **16.5 kW** で 14.3 kW をまかない、6 台目は予備（積んだのは 6 × 3.3 = **19.8 kW**）
- **電源 1 台の電流**: 14.3 kW ÷ 5 台 = 2.86 kW、200 V で **14.3 A**（定格 16 A に収まる）
- **発熱の単位換算**: 48,794 BTU/h ÷ 3.412 = **14,300 W**（14.3 kW と合う）
- **空冷の風量**: 熱量 = 空気の密度 × 比熱 × 風量 × 温度差（空気の密度 1.2 kg/m³、比熱 1.005 kJ/kg·K は 20 °C の値で **仮定**）
  - 出典の 1,550 CFM = **0.7315 m³/s** なら、14.3 kW を運ぶと空気は **16.2 K** 温まる（入口 35 °C なら出口は約 51 °C。**全部の熱が空気に行くと仮定**）
  - 温度差 10 K なら 1.186 m³/s = **2,512 CFM**、15 K なら **1,675 CFM**、20 K なら **1,256 CFM**
- **水と比べる**: 同じ 14.3 kW を水（4.18 kJ/kg·K）で温度差 10 K なら 0.342 kg/s = **20.5 L/分**。空気 0.7315 m³/s は水 0.342 L/s の約 **2,140 倍の体積**（NVL72 が液冷になった理由の数字。NVL72 は 120 kW で 172 L/分）
- **高さ**: 10U × 44.45 mm = **444.5 mm**（出典の 444 mm と合う）
- **ラックに何台入るか（電力で決まる）**: 42U に場所としては 10U × **4 台**入るが、電力の上限で決まる。**上限は仮定**: 30 kW → **2 台**（28.6 kW）、40 kW → **2 台**、60 kW → **4 台**（57.2 kW）
- **72 個そろえると**: 9 台 = **128.7 kW**、**90U**（場所だけなら 42U ラック **3 本**＝1本に 4 台。30 kW のラックなら 1本 2 台で **5 本**）。NVL72 は 1 ラック 120 kW
- **GPU 1個あたりの電力**: DGX B200 14.3 ÷ 8 = **1.79 kW**、NVL72 120 ÷ 72 = **1.67 kW**
- **ほかの合計**: CPU コア 2 × 56 = **112**、キャッシュ 8 × 3.84 = **30.72 TB**

## 実機で見るには（各章の下に添える。どれも実機のみ）
| 章 | コマンド | 何が見えるか |
|---|---|---|
| 1 外観・6 電源 | `sudo ipmitool sdr type "Power Supply"` / `nvidia-smi -q -d POWER` | 電源 6 台の状態、GPU ごとの電力（上限 1,000 W） |
| 2 中の2段 | `nvidia-smi -q` / `lscpu` / `sudo dmidecode -t memory` | GPU 8 個、Xeon 2 個 112 コア、DIMM 32 枚 |
| 3 8 個が1つに | `nvidia-smi topo -m` / `nvidia-smi nvlink -s` | GPU どうしのつながり（NVLink の本数の表示）とリンクごとの速さ。B200 での表示は **未確認**（H100 では `NV18` と出る） |
| 3 8 個が1つに | `systemctl status nvidia-fabricmanager` | NVSwitch を管理するサービス。B200 での名前と構成は **未確認** |
| 4 8 で止まる | `ibstat` / `ibdev2netdev` | ConnectX-7 8 枚が 400 Gb/s、`mlx5_4`〜`mlx5_15` と `ibp…` の対応（出典1 の表と同じ） |
| 5 72 個を集計 | `all_reduce_perf -b 1G -e 1G -g 8`（nccl-tests、1台）→ MPI で 9 台 72 プロセス | 1台の中だけの帯域と、9 台にしたときの帯域の落ち方 |
| 7 風で冷やす | `sudo nvsm show fans` / `nvidia-smi -q -d TEMPERATURE` | ファンの状態（出典4a）、GPU の温度 |

## 次の世代（画面の脚注。出典3）
- HGX B300: GPU が Blackwell Ultra、メモリ 2.1 TB、ネットワーク 1.6 TB/s（GPU 1個 800 Gb/s を双方向で数えた値と合う）。NVLink は同じ 1.8 TB/s、8 個。
- HGX Rubin NVL8: GPU 8 個、HBM4 2 TB。**NVLink の値は出典3 の中で GPU 1個 3.6 TB/s と「NVLink Switch 24 TB/s」が掛け算で合わず、`nvl72/refs.md` の Vera Rubin（GPU 1個 3 TB/s）とも違うので、画面に出さない**。

## 書かないこと
- 値段、出荷台数、どこに何台あるか（出典に無い）。
- ファンの数（未確認。形は仮定の 12 個で描くが数は出さない）。
- GPU トレイとマザーボードトレイの上下（仮定で描くが、画面で「上が GPU」と言い切らない）。
