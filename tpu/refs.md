# Google TPU Ironwood（TPU7x）ポッドの仕様と出典

Google の第7世代 TPU「Ironwood」（Cloud での名前は TPU7x）を想定した教材用の簡略モデル。比べる相手は `nvl72/refs.md`（NVIDIA GB200 NVL72）。
形は部品の数とつなぎ方を合わせた簡略形状で、Google のロゴ・写真・図は使わない。
出典のある値を土台にし、出典の無いところは **仮定**、出典の値から割り算・掛け算したものは **計算**、出典どうしの整合から推したものは **推測**、探して見つからなかったものは **未確認** と書く。
**数値はすべて `tpu-shared/kin.js` の `SPEC` に1か所だけ書き、画面と動きの両方がそこを読む。**
調べた日: 2026-11-08。

## 世代の選択（なぜ TPU 8t ではなく Ironwood を主役にするか）
- 発表済みでいちばん新しいのは第8世代の **TPU 8t（学習用）と TPU 8i（推論用）**（2026-04-22 発表。出典12、13）。ただし Google は「年内に一般提供」としか書いておらず、2026-11-08 時点で Cloud TPU のリリースノートと文書に TPU 8t・8i の項目は無い（出典14 に無い。`docs.cloud.google.com/tpu/docs/tpu8t` は 404）。
- TPU 8t は ICI の帯域の絶対値、立方体の大きさ、ラックの中身、液冷の詳細が一次資料に無い（下の「次の世代」）。ラックを分解して見せる教材には足りない。
- Ironwood は 2026-03-31 に一般提供（GA）になり（出典14）、チップ・トレイ・ラック・ポッドのすべてに一次資料がある（出典1〜5）。Anthropic の「最大100万個の TPU」の発表も Ironwood を名指ししている（出典10）。
- → **主役は Ironwood（TPU7x）。TPU 8t・8i は脚注の「次の世代」に置く。** 表の値は、断りが無い限りすべて Ironwood の値。

## 出典
1. Google Cloud, *TPU7x (Ironwood)*（Cloud TPU 文書）。https://docs.cloud.google.com/tpu/docs/tpu7x — チップ・VM・トポロジーの表【一次】
2. N. P. Jouppi, S. Lakshmanamurthy, *Ironwood: Delivering Best in Class perf, perf/TCO and perf/Watt for Reasoning Model Training and Serving*, Hot Chips 2025（2025-08-26）。https://hc2025.hotchips.org/assets/program/conference/day2/61_Google_Ironwood-Final.pdf — 14枚目 Chip、15枚目 Architecture、22枚目 Tray、23枚目 The Rack、5枚目 OCS【一次】
3. P. Makhija (Google), *TPU Rack Overview*, Hot Chips 2025 Tutorial（2025-08-24）。https://www.hc2025.hotchips.org/assets/program/tutorials/HC2025.T1DCRacks.S7.Pankaj.pdf — 「Rack is the Building Block」「Rack Subsystems」「The Suite of Racks in a Superpod」「Ironwood Superpod & Max-scale Cluster」【一次】
4. Google Cloud Blog, *From silicon to softmax: Inside the Ironwood AI stack*（2025-11-07）。https://cloud.google.com/blog/products/compute/inside-the-ironwood-tpu-codesigned-ai-stack 【一次】
5. Google Cloud Blog, *Announcing Ironwood TPUs General Availability and new Axion VMs*（2025-11-07）。https://cloud.google.com/blog/products/compute/ironwood-tpus-and-new-axion-based-vms-for-your-ai-workloads/ 【一次】
6. Google Blog, *Ironwood: The first Google TPU for the age of inference*（2025-04-09）。https://blog.google/products/google-cloud/ironwood-tpu-age-of-inference/ 【一次】
7. N. P. Jouppi ほか, *TPU v4: An Optically Reconfigurable Supercomputer for Machine Learning with Hardware Support for Embeddings*, ISCA 2023。https://arxiv.org/abs/2304.01433 — §2「Reconfigurable Optical Switch」。**TPU v4 の値**。OCS の仕組みの説明だけに使う【一次・前の世代】
8. Google Cloud, *TPU system architecture*。https://docs.cloud.google.com/tpu/docs/system-architecture-tpu-vm — 「cube」「slice」「OCS」の定義【一次】
9. Google Cloud Blog, *Jupiter evolving: Reflecting on Google's data center network transformation*（2022-08-24）。https://cloud.google.com/blog/topics/systems/the-evolution-of-googles-jupiter-data-center-network 【一次・2022年時点】
10. Anthropic, *Expanding our use of Google Cloud TPUs and Services*（2025-10-23）。https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services 【一次】
11. Google Cloud Blog, *Inside the eighth-generation TPU: An architecture deep dive*（2026-04-23）。https://cloud.google.com/blog/products/compute/tpu-8t-and-tpu-8i-technical-deep-dive — **TPU 8t・8i の値**【一次・次の世代】
12. Google Blog, *Our eighth generation TPUs: two chips for the agentic era*（2026-04-22）。https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/eighth-generation-tpu-agentic-era/ — **TPU 8t・8i の値**【一次・次の世代】
13. SiliconANGLE, *Google unveils new TPUs*（2026-04-22）。https://siliconangle.com/2026/04/22/google-unveils-new-tpus-power-next-wave-ai-training-inference/ — 発表日の確認だけ【報道】
14. Google Cloud, *Cloud TPU release notes*。https://docs.cloud.google.com/tpu/docs/release-notes — 「TPU7x is available in Preview」2025-11-24、「TPU7x is generally available (GA)」2026-03-31。TPU 8t・8i の項目は無い（2026-11-08 に確認）【一次】
15. Google Cloud SDK リファレンス, `gcloud compute tpus accelerator-types list` https://docs.cloud.google.com/sdk/gcloud/reference/compute/tpus/accelerator-types/list と `gcloud compute tpus tpu-vm describe` https://docs.cloud.google.com/sdk/gcloud/reference/compute/tpus/tpu-vm/describe 【一次】
16. 比べる相手の値は `nvl72/refs.md` の出典1〜5（NVIDIA の文書）から写す。ここで新しく調べていない

## チップ（出典1、2、6）
| 項目 | 値 | 根拠 |
|---|---|---|
| 作り | 計算のダイ（チップレット）2個を1つのパッケージに。TensorCore はダイに1個ずつで計2個、SparseCore は計4個 | 出典1、出典2 14・15枚目 |
| HBM | HBM3E を8積み、**192 GiB**（ダイ1個に 96 GiB） | 出典1（GiB）、出典2（192 GiB）。出典6 は「192 GB」と書く |
| HBM の帯域 | **7.37 TB/s**（文書の表では 7,380 GB/s） | 出典1。出典2 は 7.3、出典3・4 は 7.4 と丸めている |
| 計算性能 | FP8 **4,614 TFLOPS**、BF16 2,307 TFLOPS（ピーク） | 出典1、出典2 14枚目。**密か疎かは書かれていない**（未確認） |
| ICI（チップどうしの線） | **6 本**、1本 **200 GB/s**（双方向）、合計 **1.2 TB/s**（双方向）、1軸あたり 400 GB/s | 出典1、出典6（1.2 TBps）、出典5（9.6 Tb/s） |
| ICI の物理層 | 112G の SerDes を8本束ねたもの（octal）× 6 | 出典2 15枚目「6×112G SerDes octals」 |
| ホストとのつなぎ | PCIe Gen5 x16（TPU 1個に1本、基板の裏側） | 出典2 14・22枚目 |
| データセンターネットワーク（DCN） | チップあたり **100 Gb/s** | 出典1 |
| 冷やし方 | コールドプレート（液冷） | 出典2 14枚目 |
| JAX で見える数 | チップ1個が **2 デバイス**（ダイごと）。4チップの VM で `jax.devices()` は 8 個 | 出典1 |

## トレイ（基板。出典2 22枚目、出典3）
| 項目 | 値 | 根拠 |
|---|---|---|
| チップの数 | **4 個**／トレイ | 出典2「4 Ironwood TPUs per tray」 |
| トレイの中のつなぎ | 基板の配線で 2×2 の輪（4本） | **推測**: ラック全体の「PCB の配線 64 本」÷ 16 トレイ = 4 本。TPU v4 は「2×2 mesh」と明記（出典7 §2.1）。Ironwood の基板の配線図は無い |
| 外への ICI | 4 × 6 − 4 × 2 = **16 本**（トレイから外へ出る ICI） | 計算（上の推測による） |
| コネクタ | OSFP × **18**（表に 16、裏に 2） | 出典2「18 OSFP connectors」「16 on top side」。残り 2 の用途は**未確認** |
| 液冷 | 4 チップと電圧調整器（VR）に**並列**に水を流す。流量は弁で調節（空冷のファンの回転数に当たる） | 出典2 22枚目 |
| ホスト | ホストトレイが別にある。VM 1台 = チップ 4 個、224 vCPU、メモリ 960 GB、NUMA 2 | 出典1（`tpu7x-standard-4t`）、出典3「Host Tray」。ホストの CPU の型番は**未確認** |
| トレイの寸法 | 公開されていない | **仮定**（簡略形状。下の「形状の仮定」） |

## ラック ＝ 立方体（cube。出典3、出典2 23枚目、出典4）
| 項目 | 値 | 根拠 |
|---|---|---|
| チップの数 | **64 個** ＝ 4×4×4 の立方体1個がちょうどラック1台 | 出典3「4x4x4 building block over ICI that fits in a single Google TPU rack」、出典4 |
| トレイの数 | TPU トレイ **16** 枚（＋ホストトレイ） | 出典3「16x Ironwood PCBA」 |
| ホストの数 | 16 台（64 ÷ 4） | 計算（出典1 の「VM 1台に 4 チップ」から）。写真では TPU トレイとホストトレイが左右2列で上下に並ぶ（出典3「Rack Subsystems」） |
| ICI の線（ラック1台） | 光ファイバ **96** 本、銅ケーブル **80** 本、基板の配線 **64** 本 | 出典3「96 Optical fiber, 80 Copper cables & 64 pcb traces」 |
| 立方体の面 | 6 面、1面に **16** 本 | 出典3、出典2 5枚目 |
| ラックの中と外 | ラックの中は銅（とトレイの配線）、ラックの外は光 | 出典2 23枚目「Copper Intra-rack ICI」「Optical inter-rack ICI」 |
| 上から順に | 水受け（drip pan）、416 V 交流の入力と AC/DC 整流器、ToR スイッチ、ラック監視トレイ、光のパッチパネル、TPU トレイとホストトレイ（2 列）、いちばん下に電池（BBU） | 出典3「Rack Subsystems」の写真の注記。**トレイの段数（左右 8 段ずつ）は写真から数えた推測** |
| 背面・側面 | 液冷のマニホールド、PCIe ケーブル、ICI の光ファイバと銅ケーブル、ケーブルの整理具 | 出典3 |
| 熱の出口 | 空気と液体の両方 | 出典2 23枚目「Heat Out (Air & Liquid)」 |
| 幅 | 「普通のラックより幅が広い」 | 出典3。**寸法は未確認** |
| 電力の上限制御 | ラックの電力の頭打ち（capping）は 15 ms 未満で効く。高い TDP は 100 ms、絞り込みは 120 s 続く | 出典3「Power Management」「Rack Power Capability Boundary」 |
| 消費電力 | 1 ラックの値は無い。ポッド（9,216 チップ）で「10 MW 近く」 | 出典6。ラックあたりは下の検算で**推測** |

## ポッド（superpod。出典1〜5、8）
| 項目 | 値 | 根拠 |
|---|---|---|
| 最大のチップ数 | **9,216** ＝ 立方体 **144** 個 | 出典1（144 cubes）、出典3「144x」、出典4、出典5 |
| 形 | 3D トーラス（どの軸も輪になって端が反対側とつながる）。64 チップ以上のスライスはトーラス | 出典1、出典4「Each chip is connected to 6 other chips in the 3D torus」 |
| 小さい形 | 256 チップ（立方体 4 個）のポッドもある | 出典4、出典6 |
| 選べるスライス | 2x2x1、2x2x2、2x2x4、2x4x4、4x4x4、4x4x8、4x8x8、8x8x8、8x8x16、8x16x16、それ以外は各辺が 4 の倍数の AxBxC。2,048（8x16x16）を超えるときは営業窓口に相談 | 出典1 |
| 9,216 チップ全部を1つのトーラスにしたときの形 | 公開されていない | **未確認**。ホップ数の計算では 16×24×24（= 9,216、各辺が 4 の倍数）を**仮定**する |
| ポッドの HBM | **1.77 PB**（直接読み書きできる共有メモリ） | 出典2、出典4、出典5 |
| ポッドの計算性能 | FP8 **42.5 EFLOPS** | 出典2、出典6 |
| ポッドの ICI 合計 | 88,473.6 Tb/s（11,059.2 TB/s） | 出典4 |
| ポッドの電力 | 10 MW 近く（液冷） | 出典6「nearly 10 MW」 |
| ポッドを作るラック | TPU ラック 144 台 ＋ OCS ラック ＋ CDU（冷却液の分配装置）ラック | 出典3「The Suite of Racks in a Superpod」。**OCS ラックと CDU ラックの台数は未確認** |

## OCS（光の回線スイッチ）でつなぎ替える仕組み
| 項目 | 値 | 根拠 |
|---|---|---|
| 何をするか | 立方体どうしを光でつなぐ。鏡の向きで「どの光ファイバをどの光ファイバへ」を決める回線スイッチ。パケットを読まない | 出典4、出典7 §2.1、出典9 |
| 何が嬉しいか | ①立方体を組み合わせて好きな形のスライスを作る ②壊れた立方体や線を光の道から外し、予備の立方体に差し替える | 出典4「optically bypass the unhealthy unit … swapping in a designated spare」、出典2 3・4枚目 |
| 面と OCS の対応 | 軸（X・Y・Z）と面の位置（16 か所）ごとに別の OCS の段がつなぐ | 出典2 5枚目「Different ranks of OCS connect different dimensions and indices」、図に X・Y・Z の OCS が「×16」 |
| 端と端の輪 | 同じ軸・同じ位置の「＋の面」と「−の面」の線は同じ OCS に入る。だから OCS の中で折り返せば輪（トーラスの端と端）になる | 出典7 図1 の説明（TPU v4）。Ironwood でも同じ図（出典2 5枚目）で、**同じ仕組みと推測** |
| OCS の台数 | **TPU v4**: 6 面 × 16 本 ÷ 2 = 48 台。1台 136×136 ポート（128 ＋ 予備 8）。64 立方体 × 2 = 128 ポート | 出典7 §2.1【前の世代】 |
| Ironwood の OCS の台数・ポート数 | 公開されていない | **未確認**。v4 と同じ並べ方なら 1台に 144 × 2 = 288 ポート要り、v4 の 136 ポートでは足りない（下の検算）。より大きい OCS か並べ方の変更があるはずだが**推測** |
| 鏡 | 3D MEMS（小さな鏡を2軸で傾ける）。切り替えは数ミリ秒 | 出典7 §2.1（Palomar OCS）、出典9（Apollo OCS） |
| 光の往復 | サーキュレータで1本のファイバに行き帰りを通し、ポートとケーブルを半分にする | 出典7 §2.1 |
| 費用 | OCS と光部品はシステムの費用の 5% 未満、電力の 3% 未満 | 出典7【TPU v4 の値】 |
| ねじれトーラス | OCS のつなぎ方を変えるだけで「ねじれた」トーラスにでき、二分割帯域が増える。配線のやり直しは要らない | 出典7 §2.1・図5【TPU v4】、出典8（TPU v4・v5p・TPU7x のスライスは「3D torus or twisted 3D torus」） |

## データセンターネットワーク（Jupiter）との関係（出典1、3、5、9）
| 項目 | 値 | 根拠 |
|---|---|---|
| 役割の分け方 | ポッドの中の計算 = ICI。ポッドどうしの計算と、データ・ストレージの出し入れ = NIC からデータセンターのネットワーク | 出典3「Ironwood Superpod & Max-scale Cluster」の表 |
| チップあたりの DCN | 100 Gb/s | 出典1 |
| ポッドの先 | Jupiter がいくつものポッドを結び、数十万個の TPU のクラスタにする | 出典5（本文と写真の説明） |
| Jupiter の中身（2022年） | OCS の層で背骨（spine）の層を無くし、集約ブロックどうしを直接メッシュでつなぐ。データセンターの帯域 6 Pb/s 超。従来比で電力 40% 減、費用 30% 減 | 出典9【2022年時点の値。Ironwood の世代の値ではない】 |
| ICI の OCS と Jupiter の OCS | どちらも MEMS の鏡の回線スイッチ。名前は ICI 側が Palomar（出典7）、Jupiter 側が Apollo（出典9）。**同じ装置かは未確認** | 出典7、出典9 |

## 比べる相手（NVL72。値は `nvl72/refs.md` から写す）
| 項目 | Ironwood | GB200 NVL72 |
|---|---|---|
| 1 チップの HBM | 192 GiB、7.37 TB/s | 186 GB、8 TB/s |
| 1 チップのスケールアップの線 | 6 本 × 200 GB/s ＝ 1.2 TB/s（双方向） | 18 本 × 100 GB/s ＝ 1.8 TB/s（双方向） |
| 線の先 | 隣のチップ（スイッチなし） | NVSwitch チップ |
| 1 つの高速な領域 | 9,216 チップ | 72 GPU |
| ラックの中 | 銅＋基板 | 銅（ケーブルカートリッジ） |
| ラックの外 | 光（OCS 経由）。ICI のまま続く | NVLink は出ない。InfiniBand（GPU 1個に 400 Gb/s） |
| スケールアウト | チップあたり 100 Gb/s | GPU あたり 400 Gb/s |

## 検算（`tpu/kin.test.mjs` で機械的に確かめる値。すべて python で計算済み）
- **ICI の合計**: 6 本 × 200 GB/s = **1,200 GB/s**（出典1 の 1.2 TB/s と合う）。1軸 = 2 本 × 200 = **400 GB/s**（出典1 と合う）。ポッド全体 9,216 × 9.6 Tb/s = **88,473.6 Tb/s**（出典4 と一致）
- **立方体の線の数が合う**: 4×4×4 の格子の中の線（輪にしない）は 1軸 3 × 16 = 48、3軸で **144** 本。うち基板の配線 **64**（16 トレイ × 4）、銅 **144 − 64 = 80**。面から出る光 6 × 16 = **96**。線の端の数 2 × 144 + 96 = **384** = 64 チップ × 6 本（出典3 の 96・80・64 とぴったり合う。トレイを 2×2 とした推測もこれで裏付く）
- **ホップ数**（トーラスの直径 = 各辺の半分の和。隣は必ず 6 個）:
  - 4×4×4（ラック1台）: 2 + 2 + 2 = **6**、平均 **3.048**（自分を除く 63 個への平均）
  - 8×8×16（1,024）: 4 + 4 + 8 = **16**（出典11 が同じ式で 16 と書いている）
  - 8×16×16（2,048）: **20**
  - 16×24×24（9,216。**形は仮定**）: **32**、平均 **16.0**
  - NVL72: どの組でもスイッチ1段（nvl72/refs.md）
- **ICI と NVLink の比**: 1 チップの合計 1.2 ÷ 1.8 = **0.667 倍**。1 本あたりは 200 ÷ 100 = **2 倍**（線は少ないが1本が太い）
- **規模の比**: 9,216 ÷ 72 = **128 倍**。9,216 ÷ 64 = **144** 立方体
- **ポッドの HBM**: 9,216 × 192 = **1,769,472 GB = 1.77 PB**（出典の 1.77 PB と合う）。ただし 192 を GiB として計算すると 1.90 PB（10^15 バイト）になる。Google は 192「G」× 9,216 を 1.77 PB と書いており、単位の混ざりがある。**画面は出典どおり 1.77 PB と書く**
- **ポッドの計算性能**: 9,216 × 4,614 TFLOPS = **42.52 EFLOPS**（出典の 42.5 と合う）
- **ポッドの HBM 帯域**: 9,216 × 7,380 GB/s = **68.0 PB/s**（計算。出典に値は無い）
- **ラック1台の HBM と計算**: 64 × 192 = **12,288 GB**（NVL72 のラック 13,392 GB に近い）、64 × 4.614 = **295.3 PFLOPS**（FP8）。NVL72 の FP8 720 PFLOPS は「疎」の値なので、**密・疎がそろわないかぎり画面で計算性能を比べない**
- **ICI と DCN の差**: ICI の片方向 600 GB/s = 4,800 Gb/s ÷ DCN 100 Gb/s = **48 倍**（DCN の 100 Gb/s を片方向と**仮定**）。NVL72 のラックの中と外は 18 倍
- **OCS のポート**: TPU v4 は 64 立方体 × 2（＋面と−面）= **128** ≤ 136。Ironwood を同じ並べ方にすると 144 × 2 = **288** で足りない → Ironwood の OCS の構成は**未確認**（推測の根拠として画面の脚注に出してよい）
- **all-reduce（帯域だけの単純計算。仮定）**: 1 GB を 64 チップ（1 立方体）で合計。軸ごとに順に縮める方式でも、1 チップが送る量は 2 × (1/4·3 + 1/16·3 + 1/64·3) = 2 × 63/64 = **1.969 GB**（輪1本の方式と同じ）
  - 1 軸ずつ（片方向 2 本 × 100 GB/s = 200 GB/s）: **9.84 ms**
  - 3 軸を同時に使い切る理想（片方向 600 GB/s）: **3.28 ms**
  - NVL72 の同じ計算は 2.191 ms（72 GPU、片方向 900 GB/s）。**どちらも遅延を入れていない**
- **ラックの電力（推測）**: 10 MW ÷ 144 = **約 69 kW/ラック**、10 MW ÷ 9,216 = **約 1.09 kW/チップ**。「10 MW 近く」が OCS・CDU・ホストを含むかは書かれていないので**推測**。画面に出すなら「推測」と添える
- **TPU 8t（次の世代）の検算**: 9,600 × 12.6 PFLOPS（FP4）= **121 EFLOPS**（出典12 の 121 と合う）、9,600 × 216 GB = **2.07 PB**（出典12「2 PB」と合う）、121 ÷ 42.5 = **2.85 倍**（出典12「3 倍近く」。ただし FP4 と FP8 の比較）

## 形状の仮定（Google は寸法を出していない）
- ラック: 「普通より幅が広い」（出典3）だけが分かる。**高さ 2,300 × 幅 1,200 × 奥行 1,200 mm を仮定**。画面に寸法は出さない。
- 前から見て左右 2 列 × 8 段に「TPU トレイ ＋ ホストトレイ」の組（出典3 の写真から数えた**推測**）。上に整流器・ToR・パッチパネル、下に電池。
- トレイ: 基板にチップ 4 個を横1列（出典2 22枚目の写真は横1列）、前の縁に OSFP × 18、チップごとのコールドプレートと並列の細い配管。
- 立方体の座標とトレイの対応（どのトレイがどの 2×2 か）は**仮定**: トレイ1枚 = z が同じで x・y が 2×2。

## 実機で見るには（各章の下に添える。どれも Cloud の実機のみ。費用がかかるので作成コマンドは載せない）
| 章 | コマンド | 何が見えるか |
|---|---|---|
| 1 外観 | `gcloud compute tpus accelerator-types list --zone=<ZONE>` | そのゾーンで使える TPU の種類（出典15） |
| 2 トレイ | `python3 -c "import jax; print(jax.device_count(), jax.devices()[0].device_kind)"` | 4 チップの VM でデバイスが 8 個（チップ1個がダイ2個）（出典1） |
| 3 隣とだけつなぐ | `python3 -c "import jax; [print(d.id, d.coords, d.core_on_chip) for d in jax.devices()]"` | 各デバイスのトーラス上の座標。**`coords`・`core_on_chip` は JAX の公式 API 文書に載っていない（未確認）** |
| 4 光でつなぎ替える | `gcloud compute tpus tpu-vm describe <NAME> --zone=<ZONE>` | スライスの種類と形、ワーカー（ホスト）の一覧（出典15）。出力の項目名は**未確認** |
| 6 ポッドの外へ | `gcloud compute tpus tpu-vm ssh <NAME> --zone=<ZONE> --worker=all --command="hostname"` | 1 つのスライスが何台のホストにまたがるか |
- OCS・液冷・電源は利用者からは見えない（Google のデータセンターの中）。その章は「実機で見るには: 利用者からは見えない」と書く。

## 次の世代（画面の脚注。出典11、12）
- **TPU 8t**（学習用、2026-04 発表、一般提供は「年内」で 2026-11-08 時点は文書に無い）: HBM 216 GB・6,528 GB/s、FP4 12.6 PFLOPS、オンチップ SRAM 128 MB、ホスト CPU は Arm の Axion。3D トーラスのまま 1 ポッド 9,600 チップ、121 EFLOPS、HBM 2 PB。ICI は Ironwood の **2 倍**（絶対値は 8t については書かれていない。2 × 1.2 TB/s = 2.4 TB/s = 19.2 Tb/s は**計算**）。ポッドの外は新しい Virgo ネットワーク（DCN は 4 倍、134,000 チップ超を 47 Pb/s の二分割帯域で結ぶ）。ラックは Jupiter の南北のネットワークにもつながる。液冷は第4世代。
- **TPU 8i**（推論用）: HBM 288 GB・8,601 GB/s、FP4 10.1 PFLOPS、SRAM 384 MB。**トーラスをやめて Boardfly**（4 チップの基板 → 8 枚で1グループ → 36 グループを OCS で結ぶ。最大 1,152、稼働 1,024）。1,024 チップで最大ホップが 16 → **7**。ICI 19.2 Tb/s は出典12 の 8i の段落にある。
- 9,600 ÷ 64 = 150 なので 8t も 64 チップの立方体なら 150 個になるが、**8t の立方体の大きさは未確認**。

## 実際に使われている所（1 章の計器の下の脚注。出典にあることだけ）
- Anthropic: 2025-10-23 に、Google Cloud の TPU を最大 100 万個まで使い、2026 年に 1 GW を大きく超える計算能力を立ち上げると発表。発表文は Ironwood を名指ししている。Anthropic は TPU・Amazon の Trainium・NVIDIA の GPU の3つを使う（出典10）。
- Google: 液冷を GW 規模で運用、2020 年から全体の稼働率 約 99.999%（出典5）。
- ここに無いこと（台数・場所・契約の額など）は書かない。
