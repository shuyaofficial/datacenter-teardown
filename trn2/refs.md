# AWS Trainium2 サーバー（Trn2 インスタンスと Trn2 UltraServer）の仕様と出典

AWS Trainium2（AWS が自社で設計した学習用チップ）を 16 個積んだ Trn2 インスタンスと、それを 4 台つないだ Trn2 UltraServer（64 チップ）を想定した教材用の簡略モデル。
比べる相手は `nvl72/refs.md`（GB200 NVL72）。AWS のロゴ・写真・図は使わない。
出典のある値を土台にし、出典の無いところは **仮定**、出典の値から割り算・掛け算したものは **計算**、出典どうしが食い違うところは **食い違い** と書く。
区分は「一次」（AWS・Anthropic の公式の文書・発表）、「報道」（第三者の記事）、「推測」（記事の筆者の推定）の3つ。
**数値はすべて `trn2-shared/kin.js` の `SPEC` に1か所だけ書き、画面と動きの両方がそこを読む。**
**物理的な形（寸法・スレッドの並び・ラックの数）は AWS が公表していない。形は全部「仮定」で、画面にもそう出す。**

## 出典
| # | 区分 | 出典 | 使うところ |
|---|---|---|---|
| 1 | 一次 | AWS Neuron 文書「AWS Trainium2 Architecture」。https://awsdocs-neuron.readthedocs-hosted.com/en/latest/about-neuron/arch/neuron-hardware/trainium2.html | チップの値 |
| 2 | 一次 | AWS Neuron 文書「Amazon EC2 Trn2 Architecture」。https://awsdocs-neuron.readthedocs-hosted.com/en/latest/about-neuron/arch/neuron-hardware/trn2-arch.html | インスタンスと UltraServer の表、トーラスとリング |
| 3 | 一次 | AWS Neuron 文書「NeuronCore-v3 Architecture」。https://awsdocs-neuron.readthedocs-hosted.com/en/latest/about-neuron/arch/neuron-hardware/neuron-core-v3.html | NeuronCore の中身 |
| 4 | 一次 | AWS Neuron 文書「Neuron Collectives」。https://awsdocs-neuron.readthedocs-hosted.com/en/latest/neuron-runtime/about/collectives.html | 隣が4つ、Z 方向に2つで 3D トーラス、階層型の集計、LNC |
| 5 | 一次 | AWS Neuron 文書のツール: neuron-ls https://awsdocs-neuron.readthedocs-hosted.com/en/latest/tools/neuron-sys-tools/neuron-ls.html ／ neuron-top https://awsdocs-neuron.readthedocs-hosted.com/en/latest/tools/neuron-sys-tools/neuron-top-user-guide.html ／ neuron-monitor https://awsdocs-neuron.readthedocs-hosted.com/en/latest/tools/neuron-sys-tools/neuron-monitor-user-guide.html ／ nccom-test https://awsdocs-neuron.readthedocs-hosted.com/en/latest/tools/neuron-sys-tools/nccom-test.html | 「実機で見るには」、neuron-ls の出力例（デバイス 0 の隣 = 12, 3, 4, 1） |
| 6 | 一次 | AWS「Amazon EC2 Trn2 instances and UltraServers」製品ページ。https://aws.amazon.com/ec2/instance-types/trn2/ | インスタンス・UltraServer の値、Anthropic の寄稿文、Rainier の初出 |
| 7 | 一次 | AWS 文書「Specifications for Amazon EC2 accelerated computing instances」。https://docs.aws.amazon.com/ec2/latest/instancetypes/ac.html | CPU の型（Sapphire Rapids）、コア数、ネットワークカード 16 枚 × 200 Gb/s、NVMe、EBS |
| 8 | 一次 | AWS News Blog「Amazon EC2 Trn2 Instances and Trn2 UltraServers for AI/ML training and inference are now available」（2024-12-03）。https://aws.amazon.com/blogs/aws/amazon-ec2-trn2-instances-and-trn2-ultraservers-for-aiml-training-and-inference-is-now-available/ | 2D トーラス、NeuronLink 1 TB/s（記事内に「1 TB/s に訂正」の注記あり） |
| 9 | 一次 | Amazon プレスリリース「AWS Trainium2 Instances Now Generally Available」（2024-12-03）。https://press.aboutamazon.com/2024/12/aws-trainium2-instances-now-generally-available | 一般提供、Rainier の予告、Trainium3 の予告 |
| 10 | 一次 | Amazon プレスリリース「AWS Announces New Data Center Components…」（2024-12-02）。https://press.aboutamazon.com/2024/12/aws-announces-new-data-center-components-to-support-ai-innovation-and-further-improve-energy-efficiency | 冷やし方（空冷と液冷を組み合わせる設備。Trainium2 自体の方式は書いていない） |
| 11 | 一次 | Amazon「AWS activates Project Rainier」。https://www.aboutamazon.com/news/aws/aws-project-rainier-ai-trainium-chips-compute-cluster （ページに日付なし。報道では 2025-10-29 公開） | Rainier の規模、青いケーブル = NeuronLink、黄色いケーブル = EFA |
| 12 | 一次 | Anthropic「Powering the next generation of AI development with AWS」（2024-11-22）。https://www.anthropic.com/news/anthropic-amazon-trainium | AWS が主な学習の相手、Trainium の共同開発 |
| 13 | 一次 | Anthropic「Expanding our use of Google Cloud TPUs and Services」（2025-10-23）。https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services | Trainium・TPU・NVIDIA の3本立て、Rainier を続ける |
| 14 | 一次 | AWS What's New「Announcing Amazon EC2 Trn3 UltraServers…」（2025-12-02）。https://aws.amazon.com/about-aws/whats-new/2025/12/amazon-ec2-trn3-ultraservers/ | 次の世代の脚注だけ |
| 15 | 一次 | AWS Neuron 文書「AWS Trainium3 Architecture」。https://awsdocs-neuron.readthedocs-hosted.com/en/latest/about-neuron/arch/neuron-hardware/trainium3.html | 次の世代の脚注だけ |
| 16 | 一次 | AWS 文書「Launching a AWS Deep Learning AMIs Instance With EFA」。https://docs.aws.amazon.com/dlami/latest/devguide/tutorial-efa-launching.html | `fi_info -p efa` |
| 17 | 報道 | The Register「Amazon built a massive AI supercluster for Anthropic called Project Rainier」（2025-07-04）。https://www.theregister.com/2025/07/04/project_rainier_deep_dive/ | 空冷・ラック 2 本（筆者の分析）。形の仮定の手がかりだけ |
| 18 | 報道 | The Next Platform「AWS Reaps The Benefits Of The Custom Silicon It Has Sown」（2024-12-03）。https://www.nextplatform.com/2024/12/03/aws-reaps-the-benefits-of-the-custom-silicon-it-has-sown/ | re:Invent 基調講演で見せた筐体の説明（スレッドの数）。形の仮定の手がかりだけ |

## チップ: Trainium2 1個（出典1、3）
| 項目 | 値 | 区分・根拠 |
|---|---|---|
| NeuronCore | NeuronCore-v3 × 8 | 一次 出典1 |
| NeuronCore の中 | Tensor・Vector・Scalar・GPSIMD の4種のエンジン。SRAM 28 MB／コア（ソフトで管理） | 一次 出典3 |
| チップの SRAM（SBUF） | 224 MiB | 一次 出典1。8 × 28 = 224 で出典3と合う（計算） |
| HBM | 96 GiB、2.9 TB/s | 一次 出典1、出典8 |
| FP8（密） | 1,299 TFLOPS | 一次 出典1 |
| BF16／FP16／TF32（密） | 667 TFLOPS | 一次 出典1 |
| FP32 | 181 TFLOPS | 一次 出典1 |
| NeuronLink-v3 | 1.28 TB/s／チップ | 一次 出典1（向きは書いていない。下の「食い違い」） |
| 集団通信の専用回路 | CC-Core × 16 | 一次 出典1 |
| ダイの数・HBM の積み数・消費電力 | **未確認**（AWS は公表していない。報道に「計算ダイ 2 個、HBM 4 積み」「約 500 W は筆者の仮定」がある＝出典17・18） | 画面に出さない |
- 疎（スパース）の値は出典ごとにばらつく（出典1は 2,563 TFLOPS、出典8は FP8 で 5.2 PFLOPS）。**画面には密の値だけ出す**。

## インスタンス: trn2.48xlarge／trn2u.48xlarge（出典2、6、7、8）
| 項目 | 値 | 区分・根拠 |
|---|---|---|
| チップ | Trainium2 × 16（NeuronCore 128） | 一次 出典2、出典8 |
| つなぎ方 | **4 × 4 の 2D トーラス**。各チップは上下左右の 4 個の隣と NeuronLink で直結。端は反対側の端へ回り込む | 一次 出典2「4x4, 2D Torus」、出典4「each chip is connected to 4 neighbors」 |
| 隣の番号 | デバイス 0 の隣は 12, 3, 4, 1 | 一次 出典5（neuron-ls の出力例）。行優先の 4 × 4 の格子で回り込みを入れると 0 の隣は {1, 3, 4, 12} になり一致（**計算による解釈**） |
| NeuronLink（インスタンスの中） | 1,024 GiB/s／チップ | 一次 出典2 |
| 1本のリンク | 256 GiB/s | **計算**（1,024 ÷ 4 本。リンクの太さが同じという **仮定**） |
| HBM の合計 | 1,536 GiB、46.4 TB/s | 一次 出典2 |
| FP8（密） | 20.8 PFLOPS | 一次 出典2、出典6 |
| BF16（密） | 10.7 PFLOPS | 一次 出典2 |
| EFA（インスタンスの外） | EFAv3 3.2 Tb/s ＝ ネットワークカード 16 枚 × 200 Gb/s（チップ 1 個あたり 200 Gb/s） | 一次 出典6、出典7、出典8。カードとチップの1対1の対応は **計算による解釈**（枚数が同じ） |
| CPU | Intel Xeon Sapphire Rapids、192 vCPU（96 コア × 2 スレッド） | 一次 出典7。報道（出典18）は Graviton4 と推測していたが、出典7が正 |
| ホストのメモリ | 2 TiB（2,048 GiB） | 一次 出典2、出典7 |
| ローカル NVMe | 1,900 GB × 4 | 一次 出典7（出典6 は「4 x 1.92」と「最大 8 TB」を併記） |
| EBS | 80 Gb/s | 一次 出典6、出典7 |
| 筐体の中身 | 計算スレッド 8 枚（Trainium2 を 2 個ずつ）＋ホストのスレッド 1 枚＋スイッチのスレッド 2 枚 | **報道**（出典18。基調講演の説明として。スイッチの役割は書かれていない）。形の **仮定** にだけ使う |

## UltraServer: trn2u.48xlarge × 4（出典2、4、6、11）
| 項目 | 値 | 区分・根拠 |
|---|---|---|
| 構成 | trn2u.48xlarge × 4 を NeuronLink-v3 でつなぐ。チップ 64 個、NeuronCore 512 | 一次 出典2、出典8 |
| つなぎ方 | 4 台で **同じ座標のチップどうしをリングでつなぐ**。Neuron の文書はこれを「**3D トーラス**（Z 方向に隣 2 個を足す）」と書く | 一次 出典2「same coordinates … ring topology」、出典4「extend this to a 3D Torus … Z dimensions to 2 neighbors」 |
| 1チップの隣 | 6 個（XY に 4、Z に 2） | **計算**（出典4の 4 + 2） |
| NeuronLink（インスタンスの間） | 256 GiB/s／チップ。1本あたり 128 GiB/s | 一次 出典2。1本あたりは **計算**（256 ÷ 2 本） |
| HBM の合計 | 6,144 GiB（6 TiB）、185.6 TB/s | 一次 出典2 |
| FP8（密） | 83.2 PFLOPS | 一次 出典2、出典6、出典9 |
| EFA | 12.8 Tb/s（4 台の合計） | 一次 出典6 |
| CPU・メモリ | 768 vCPU、8,192 GiB | 一次 出典2 |
| ケーブルの色 | NeuronLink は青いケーブル、EFA は黄色いケーブル | 一次 出典11 |
| ラックの数 | **未確認**。報道では「2 本のラックにまたがる」（出典17の筆者の分析） | 形の **仮定** にだけ使う |

## ラックの外へ: EFA（出典6、7、11）
| 項目 | 値 | 根拠 |
|---|---|---|
| チップ 1 個の外への帯域 | 200 Gb/s（片方向 25 GB/s、双方向 50 GB/s） | 一次 出典7（16 × 200 Gigabit）。GB/s への換算は **計算** |
| 何をつなぐか | UltraServer どうしを、データセンターの中とデータセンターの間でつなぐ | 一次 出典11 |
| NVL72 との差 | GPU 1個あたり 400 Gb/s（ConnectX-7）に対し、Trainium2 は 200 Gb/s | nvl72/refs.md と出典7 |

## 冷やし方（出典10、11、17）
| 項目 | 値 | 区分 |
|---|---|---|
| Trn2 の冷やし方 | **AWS は公表していない（未確認）**。報道では **空冷**（出典17の筆者の分析: スイッチが無く密度が低いので空冷で済んだ） | 報道 |
| AWS の設備側 | 「空冷と液冷を組み合わせて使える冷却設備」を Trainium2 や GB200 NVL72 向けに用意する、と発表 | 一次 出典10 |
| Rainier のインディアナの拠点 | 10 月〜3 月は冷却に水を使わない、外気を最大限に使う | 一次 出典11 |
| 消費電力 | **未確認**（AWS の値が無い）。画面に出さない | — |
- 画面では「空冷（報道。AWS は公表していない）」と書く。NVL72 の「液冷 120 kW」と並べるときも、この但し書きを外さない。

## Project Rainier と Anthropic（出典6、9、11、12、13。公式の値だけ）
- 2024-12-03 の予告: Trainium2 を「数十万個」、Anthropic がそれまで使っていたクラスタの「5 倍超」（出典9）。
- 稼働の発表（出典11）: Trainium2 が **約 50 万個**、米国の複数のデータセンターにまたがる。インディアナ州セントジョセフ郡が拠点の一つ。Anthropic が前のモデルの学習に使った計算力の 5 倍超。Claude は年末までに **100 万個超** の Trainium2 に載る見込み（見込みであって実績ではない）。
- Anthropic の言葉: AWS は「主な学習の相手」（出典12、出典13）。Anthropic は Trainium・Google TPU・NVIDIA GPU の3本立て（出典13）。
- ここに無いこと（電力・建物の数・金額）は書かない。報道の「インディアナに 30 棟」「2.2 GW」は使わない。

## 食い違い（画面に出す値を決めたもの）
| 何が | 出典ごとの値 | 決め方 |
|---|---|---|
| EFA の単位 | 出典2は「EFAv3 bandwidth (GB/s) 3,200」、出典6・8は「3.2 Tbps」、出典7は「16x 200 Gigabit」 | 出典2の単位の書き誤りとみて **3.2 Tb/s** |
| NeuronLink の値 | 出典1は 1.28 TB/s、出典2は 1,024 GiB/s（中）＋ 256 GiB/s（間）、出典8は 1 TB/s（記事内で訂正済み）、報道（出典18）は 2 TB/s | 1.28 = 1,024 + 256 なので出典1は「中＋間」の合計（**計算による解釈**。単位は TB と GiB が混ざっている）。画面は出典2の値 |
| NeuronLink の向き | どの出典も「片方向か双方向か」を書いていない | **仮定**: NVL72 の 1.8 TB/s と同じく「両方向の合計」として比べる。片方向なら比は倍になる、と脚注に書く |
| アクセラレータのメモリ | 出典7の表は trn2.48xlarge を「8192 GiB (16 x 512 GiB)」と書く | 出典1・2・6・8 の 96 GiB／チップ、1,536 GiB を使う |
| NeuronCore と チップの計算性能 | 出典3は Tensor エンジン 158 TFLOPS（FP8）・79（BF16）／コア、× 8 = 1,264・632。出典1のチップは 1,299・667 | コアの値は画面に出さない（差は他のエンジンの分と思われるが **未確認**） |
| 帯域の丸め | 出典8は 46 TB/s・185 TB/s、出典2は 46.4・185.6 | 出典2 |

## 検算（`trn2/kin.test.mjs` で機械的に確かめる値）
- **インスタンスの HBM**: 16 × 96 GiB = **1,536 GiB**（出典2と合う）、帯域 16 × 2.9 = **46.4 TB/s**
- **UltraServer のチップと HBM**: 4 × 16 = **64 個**、64 × 96 GiB = **6,144 GiB**、帯域 64 × 2.9 = **185.6 TB/s**、NeuronCore 64 × 8 = **512**
- **計算性能**: FP8 16 × 1,299 = **20,784 TFLOPS**（20.8 PF）、64 × 1,299 = **83,136 TFLOPS**（83.2 PF と丸めで合う）。BF16 16 × 667 = **10,672**（10.7 PF）
- **EFA**: 16 × 200 Gb/s = **3.2 Tb/s**、× 4 = **12.8 Tb/s**（出典6と合う）
- **NeuronLink の合計**: 1,024 + 256 = **1,280 GiB/s**（出典1の 1.28 と合う）
- **リンクの数**: インスタンスの中 16 × 4 ÷ 2 = **32 本**。UltraServer は 4 × 32 + Z のリング（16 列 × 4 本）= **192 本** = 64 × 6 ÷ 2（両方の数え方が合う）
- **トーラスの隣**: 行優先 4 × 4 で、デバイス 0 の隣は **{1, 3, 4, 12}**（出典5の neuron-ls の例と合う）。全 16 個で隣がちょうど 4 個、隣の関係が対称
- **何段で届くか（経路の長さ。全組で確かめる）**: インスタンスの中（4 × 4）は最大 **4 段**、平均 **2.133 段**（32/15）。UltraServer（4 × 4 × 4）は最大 **6 段**、平均 **3.048 段**（192/63）。NVL72 はどの組でもスイッチ **1 段**
- **中と外の差**（**仮定**: NeuronLink の値は両方向の合計。EFA は 200 Gb/s を両方向にして 50 GB/s。GiB と GB の差は無視して出典1の 1.28 TB/s を使う）: 1,280 ÷ 50 = **25.6 倍**（インスタンスの中だけなら 1,024 ÷ 50 = **20.5 倍**）。NVL72 の **18 倍** より差が大きい
- **チップ1個の外への帯域**: NVL72 の GPU は 400 Gb/s、Trainium2 は 3.2 Tb/s ÷ 16 = **200 Gb/s**（半分）
- **all-reduce（帯域だけの単純計算。遅延は入れない。仮定が多いので画面では「目安」と書く）**: 1 GB の勾配を 64 チップで合計する
  - 64 個を1本の輪で回す: チップ 1 個が送る量 = 2 × 63 / 64 × 1 GB = **1.969 GB**
  - 階層型（出典4が書く進め方: インスタンスの中で集計 → 4 台の間で集計 → 中で配り直す）: 中で 2 × 15/16 = **1.875 GB**、間で 2 × 3/4 × 1/16 = **0.094 GB**、合計は同じ **1.969 GB**。違いは **95.2 %** が太い「中」のリンクに載ること
  - 所要時間の目安（**仮定**: 送り出しに使えるのは各リンクの片方向、つまり中 512 GiB/s・間 128 GiB/s）: 中 1.875 GB ÷ 549.8 GB/s = **3.411 ms**、間 0.094 GB ÷ 137.4 GB/s = **0.682 ms**、合計 **4.093 ms**（NVL72 はリング 2.191 ms・SHARP 1.111 ms）
- **UltraServer と NVL72 の大きさ**: チップ 64 対 GPU 72。HBM 6,144 GiB（6.60 TB）対 13,392 GB。チップ 1 個の HBM 96 GiB（103.1 GB）対 186 GB

## 実機で見るには（各章の下に添える。どれも Trn2 の実機のみ）
| 章 | コマンド | 何が見えるか | 出典 |
|---|---|---|---|
| 2 サーバーの中 | `neuron-ls` | デバイス（チップ）ごとの NeuronCore の数・メモリ 96 GB・つながっている隣・NUMA | 出典5 |
| 3 4 × 4 のトーラス | `neuron-ls --topology` | 隣どうしのつながりの図（回り込みのリンクを凡例つきで描く） | 出典5 |
| 4 4 台で 64 個 | `neuron-ls --topology`（UltraServer の各インスタンスで） | 同上。インスタンスの間のつながりの見え方は **未確認** | 出典5 |
| 5 集計 | `nccom-test -r 64 allr`（1 台。LNC=2 で 1 チップ 4 ランク × 16 = 64）／ 2 台は文書の例どおり `NEURON_RT_ROOT_COMM_ID=<1台目のIP>:<空きポート> nccom-test -r 64 -N 2 -b 8 -e 1GB -f 2 -n 50 -w 5 -d fp32 allr --hosts <IP> <IP>` | 実測の algbw と busbw。busbw = 2 × (r − 1) / r × algbw | 出典5、出典4。1 台の `-r 64` は文書の 2 ランクの例からの延長 |
| 6 外へ（EFA） | `fi_info -p efa` | EFA の provider が見えるか | 出典16 |
| 7 何を選んだか | `neuron-top` ／ `neuron-monitor` | NeuronCore の使用率、ホストとデバイスのメモリ。**電力・温度は出ない**（neuron-monitor の `neuron_hw_counters` は ECC の数だけ） | 出典5 |

## 次の世代（画面の脚注）
- Trainium3（2025-12-02 発表、3 nm）: チップ 1 個 FP8 2.52 PFLOPS、HBM3e 144 GB、4.9 TB/s。Trn3 UltraServer は最大 **144 チップ**、HBM 20.7 TB。チップどうしは **NeuronSwitch-v1**（全対全のスイッチ）でつなぎ、Trn2 UltraServer の 2 倍の帯域（出典14）。NeuronLink-v4 は 2.56 TB/s／チップ（出典15）。
- つまり次の世代では「スイッチを置かないトーラス」から「スイッチ 1 段」へ移った。第 7 章の比較の締めに使う。ラックの形・冷やし方は書かない（出典に無い）。
