# NVIDIA Quantum-X800 Q3400-RA（XDR InfiniBand スイッチ）の仕様と出典

NVIDIA Quantum-X800 Q3400-RA（4U・空冷・800 Gb/s × 144 ポート）を想定した教材用の簡略モデル。3本目として、1本目の Catalyst 9300（`switch/refs.md`）と比べながら読む。
形は寸法と部品の数を合わせた簡略形状で、NVIDIA のロゴ・写真・図は使わない。
出典のある値を土台にし、出典の無いところは **仮定**、出典の値から割り算・掛け算したものは **計算**、出典どうしが合わないところは **食い違い** と書く。
区分は「一次」（NVIDIA・IBTA・IEEE の公式文書）、「一次(旧 Mellanox)」（NVIDIA に合併する前の Mellanox の技術者が標準化の場で出した資料）、「推測」（一次資料から計算・解釈したもの）。今回、報道だけに頼った値は無い。
**数値はすべて `qx800-shared/kin.js` の `SPEC` に1か所だけ書き、画面と動きの両方がそこを読む。**
調査日: 2026-11-08。PDF は WebFetch で閲覧したときにツールが自動で取っておいた分だけを読んだ。こちらからダウンロードしたファイルは無い。

## 出典
1. NVIDIA, *NVIDIA Quantum-X800 InfiniBand Switches Datasheet*（Dell 配布版。著作権表記は NVIDIA、2025年8月）。https://www.delltechnologies.com/asset/en-my/products/networking/technical-support/nvidia-quantum-x800-q3200-ra-and-q3400-ra-datasheet.pdf — 一次。p.2 の本文、p.3「System Specifications」
2. NVIDIA, *Q32xx and Q34xx XDR 800Gb/s InfiniBand Switch Systems User Manual*。一次
   - 2a「Introduction」https://networking-docs.nvidia.com/xdrswitcheshw/introduction — 型番の一覧、表「Management Interfaces, PSUs and Fans」、表「Speed and Switching Capabilities」
   - 2b「Specifications」https://networking-docs.nvidia.com/xdrswitcheshw/specifications — 寸法・重さ・消費電力・温度・騒音
   - 2c「Installation」https://networking-docs.nvidia.com/xdrswitcheshw/installation — 風の向き
   - 2d「Interfaces」https://networking-docs.nvidia.com/xdrswitcheshw/interfaces — 管理ポート
3. NVIDIA Newsroom, *NVIDIA Announces New Switches Optimized for Trillion-Parameter GPU Computing and AI Infrastructure*（2024-03-18）。https://nvidianews.nvidia.com/news/networking-switches-gpu-computing-ai — 一次。SHARPv4 の 14.4 TFLOPS、前の世代との比較
4. NVIDIA, *Quantum-X800* 製品ページ。https://www.nvidia.com/en-us/networking/products/infiniband/quantum-x800/ — 一次
5. NVIDIA Technical Blog, *How Industry Collaboration Fosters NVIDIA Co-Packaged Optics*。https://developer.nvidia.com/blog/how-industry-collaboration-fosters-nvidia-co-packaged-optics — 一次。液冷版 Q3450-LD の中のチップの数と 1 チップの帯域
6. NVIDIA, *DGX SuperPOD Reference Architecture (DGX GB300)*。https://docs.nvidia.com/pdf/dgx-spod-gb300-ra.pdf — 一次。表1「Components」、「Compute Fabric」、表3「Larger SuperPOD component counts」
7. NVIDIA, *Quantum-X800 (XDR) Clusters*。https://networking-docs.nvidia.com/nvidia-quantum-x800-xdr-clusters — 一次。ケーブル・光モジュールの品目、UFM、OpenSM
8. NVIDIA, *NVOS User Manual for InfiniBand Switches*「Appendix — Design Consideration Using Q3200」。https://networking-docs.nvidia.com/nvosinfinibandum/25.03.1010/appendixdesign-consideration-using-q3200 — 一次。1 ケージ 2 ポート、400G への分割
9. NVIDIA, *NVOS User Manual for InfiniBand Switches*「Environment Commands」。https://docs.nvidia.com/networking/display/NVIDIANVOSUserManualforInfiniBandSwitchesv25027002/Environment+Commands — 一次。ファン・電源のコマンド
10. IBTA, *What's new – Volume 1 Release 1.7*（2023-07-11）。https://www.infinibandta.org/wp-content/uploads/2023/07/IBTA-Overview-of-IBTA-Volume-1-Release-1.7-2023-07-11.pdf — 一次（規格本体は会員限定で未読。この概要だけ）
11. D. Crupnicoff（Mellanox）, *InfiniBand Credit-Based Link-Layer Flow-Control*, IEEE 802.1 DCB TG（2014年3月）。https://grouper.ieee.org/groups/802/1/files/public/docs2014/new-dcb-crupnicoff-ibcreditstutorial-0314.pdf — 一次(旧 Mellanox)。IB 規格 Vol.1 7.9 節の解説。**2014年の資料で、XDR の値ではない**
12. IEEE 802.1, *802.1Qbb – Priority-based Flow Control*。https://1.ieee802.org/dcb/802-1qbb/ — 一次
13. `opensm(8)` の man ページ https://www.mankier.com/8/opensm と、OpenSM 付属の *current-routing.txt* https://raw.githubusercontent.com/linux-rdma/opensm/master/doc/current-routing.txt — 一次（実装の文書）
14. NVIDIA, *UFM Enterprise User Manual*「Adaptive Routing」。https://networking-docs.nvidia.com/ufmenterpriseum/6242/adaptive-routing — 一次
15. NVIDIA, *SHARP User Manual*「Introduction」。https://networking-docs.nvidia.com/sharpum/3130/introduction — 一次
16. NVIDIA, *MLNX_OFED Documentation v5.8 LTS*「IP over InfiniBand (IPoIB)」。https://networking-docs.nvidia.com/mlnxofedswum/586042lts/ip+over+infiniband+(ipoib) — 一次。ポートの MTU
- このリポジトリの中: `switch/refs.md`（Catalyst 9300 の値。比べる相手）、`room/refs.md`・`room/research-hall.md`（部屋の中の置き場所と網の分け方）、`nvl72/refs.md`（計算トレイの NIC）

## 型番（出典1 p.2–3、出典2a、2b、出典5）
| 型番 | 高さ | ポート | 冷やし方 | 電源 | 根拠 |
|---|---|---|---|---|---|
| **Q3400-RA**（この教材の主役） | 4U | 800G × 144（OSFP ケージ 72） | 空冷 | 交流 200–240 V、電源 8 台（交換できる） | 出典1、2a、2b |
| Q3401-RD | 4U | 800G × 144（OSFP 72） | 空冷 | 直流 48–54 V。MGX ラック用で、電源はバスバーから（交換できる電源なし） | 出典1、2a、2b |
| Q3450-LD | 4U | 800G × 144（MPO 144。光をチップの横に載せた CPO） | **液冷**（液の継手 UDQ4 × 4） | バスバー 40–60 V | 出典2a、2b、出典5 |
| Q3200-RA | 2U | 独立した 2 台のスイッチ（各 800G × 36、OSFP 18） | 空冷 | 交流、電源 4 台 | 出典1、2a |

- 空冷版と液冷版: 差し込み式の光モジュール（OSFP）を使うのが空冷の Q3400-RA・Q3401-RD。光をスイッチの中に作り込んだのが液冷の Q3450-LD（出典5「switch core と光部品の両方を液で冷やす」）。
- **食い違い**: 出典6（GB300 RA）は「Q3400-RD」と書くが、出典1・2 の型番表にこの名前は無い（あるのは Q3400-RA と Q3401-RD）。画面には Q3400-RA だけを出す。

## 筐体（出典2b、2a、2c、2d、出典1）
| 項目 | Q3400-RA の値 | 根拠 |
|---|---|---|
| 寸法 | 高さ 177.8 mm × 幅 438 mm × 奥行 850 mm（7 × 17.24 × 33.5 in） | 出典2b |
| 重さ | 60 kg（電源 8 台つき） | 出典2b |
| 取り付け | 19 インチラック、4U | 出典2b、出典1 |
| 前面 | OSFP ケージ 72（1 ケージに 800G のポート 2 つ）、UFM 専用の帯域内管理ポート（OSFP・400G。データ用のポートとは別に置く）、RJ-45 の管理 Ethernet（10/100/1000）、RJ-45 のコンソール（RS232）、USB 2.0、リセットボタン、状態 LED | ケージとポートの数は出典1、2a。1 ケージ 2 ポートは出典8（Q3200 の記述。Q3400 も 72 ケージで 144 ポートなので同じと読む＝**計算**）。管理ポートは出典1、2d |
| ケージの並び | 3 つの区画 × 4 段 × 6 列 ＝ 72（出典1 p.2 の写真で区画が3つに見える） | **仮定**（区画の中の段と列は写真から読み切れない） |
| 背面 | 電源 8 台、ファン 10 台（どちらも交換できる） | 台数は出典2a。並び方は **仮定** |
| 風の向き | 前（ポートの側）から吸って、後ろ（電源の側）へ出す | 出典2c |
| 動作温度 | 0〜35 ℃ | 出典2b |
| 騒音 | 78.4 dBA（室温） | 出典2b |
| CPU（管理用） | Intel i3-8100H、4 コア 3 GHz。OS は NVOS | 出典1、2b |
| スイッチのチップ | Quantum-3 | 出典2b |
- **食い違い**: 出典2b の温度の行は「Reverse air flow」と書くが、出典2c は「XDR の機種は今は1種類の風向きだけで、前（コネクタ側）から吸って電源側へ出す」と書く。画面は出典2c の向きにする（Catalyst 9300 と同じ向き）。

## チップと帯域（出典1、2a、出典5）
| 項目 | 値 | 根拠 |
|---|---|---|
| 1 レーンの速さ | 約 200 Gb/s（XDR） | 出典10「~200Gb/s per lane」、出典1「200Gb/s-per-lane SerDes」 |
| 1 ポート | 800 Gb/s ＝ 200G × 4 レーン | 出典10（4 レーンのコネクタで 800G）、出典1。400G に落として使うこともできる（出典2b） |
| 1 ケージ | 1.6 Tb/s ＝ 8 レーン ＝ 800G × 2 ポート | 出典10（OSFP は 1600 Gb/s）、出典8 |
| 交換容量 | 115.2 Tb/s | 出典1、2a。出典5 はこれを「全二重の帯域」と呼ぶ。144 × 800G と一致するので **片方向の合計** と読む（計算） |
| ノンブロッキング | 144 ポートすべて | 出典1「144 800Gb/s non-blocking ports」 |
| Quantum-3 チップの数 | **4 個（計算・推測）** | Q3400-RA の数は NVIDIA の文書に無い。同じ 115.2 Tb/s・144 ポートの Q3450-LD は「Quantum-X チップ 4 個、1 個 28.8 Tb/s」（出典5）。Q3200-RA は 28.8 Tb/s のスイッチ 2 台（出典1）。115.2 ÷ 28.8 = 4 |
| チップどうしのつなぎ方 | **未確認** | 4 個で 144 ポートを詰まらせずに結ぶ方法（例えば各ポートの 4 レーンを 4 個のチップに 1 本ずつ分ける）は、どの文書にも無い。画面には「つなぎ方は非公表」と書く |
| 遅延 | **未確認** | 出典1・4・6 とも「ultra-low latency」「extremely low」と書くだけで数値が無い |
| MTU | 4,096 B（IB のポートの既定値＝上限） | 出典16「physical port MTU … default value is 4k」 |

## 消費電力（出典2b）
| 項目 | 値 | 根拠 |
|---|---|---|
| 典型（受動の銅ケーブル） | 2,900 W | 出典2b |
| 最大（光モジュール） | 7,000 W | 出典2b |
| 電源 | 8 台、交流 200–240 V・10 A・50/60 Hz（1 台あたり） | 出典2b。冗長の方式（N+N など）は **未確認**。NVOS には「電源の冗長の方針によっては全部が要らない」とある（出典9） |
| 典型と最大の差 | 4,100 W の大半は光モジュールの電力と読める | **推測**（出典2b の条件の書き方から） |

## InfiniBand の仕組み（Catalyst 9300 との違い）
### 経路は SM が配る（出典13、14、7、出典1）
| 項目 | 値・中身 | 根拠 |
|---|---|---|
| Subnet Manager（SM） | 網の中に1つ動いていて、網を調べ、初期化し、変化がないかを定期的に見回る（sweep） | 出典13 opensm(8) |
| 見回りの間隔 | 既定 10 秒 | 出典13 |
| アドレス | 各ポートに LID（16 ビットの番号）を SM が割り当てる。1 ポートの LID の数は 2^LMC。既定の LMC は 0（2 点のあいだの経路は 1 本） | 出典13（LMC）。LID が 16 ビットなのは IB 規格（未読）による一般的な説明 → **未確認** |
| 転送表 | SM が各スイッチの LFT（宛先 LID → 出口ポートの表）を計算して書き込む。経路の計算は「各ポートから各 LID までの段数を数える → 各スイッチで宛先ごとに出口を選ぶ（同じ段数なら担当の少ないポート）」の2段 | 出典13 current-routing.txt |
| 経路の計算方式 | minhop、updn、ftree など。ftree と updn はクレジットの輪による止まり（デッドロック）を起こさない。**XDR の網で使える方式は `ar_updn` だけ** | 出典13、出典14 |
| 適応ルーティング（AR） | 同じ距離の出口が複数あるとき、スイッチがその場で空いている方を選べる。UFM 6.4 から SM の本体に入った | 出典1・4（機能の名前）、出典14（SM に組み込み）。選び方の細部は出典14 に無い → **未確認** |
| 自己修復 | 「self-healing」を機能に挙げる | 出典1。仕組みと回復時間は **未確認** |
| SM を動かす場所 | UFM（専用機、1U）か OpenSM。Q3400-RA は UFM 専用のポートを前面に持つ | 出典7、出典1 |
| Catalyst との違い | Catalyst は届いたフレームの送信元 MAC を覚え、知らない宛先は全ポートに流す（MAC 表 32,000） | `switch/refs.md`。IB スイッチは自分では覚えず、SM が書いた表だけを引く |
| 複数の SM | 優先度（0〜15）と GUID で主を決める | 出典13 |

### 捨てずに待つ — クレジットによるフロー制御（出典11、12、`switch/refs.md`）
| 項目 | 値・中身 | 根拠 |
|---|---|---|
| クレジット | 受け手が「あと何ブロック受け取れるか」を送り手に知らせ、送り手はその範囲でしか送らない | 出典11（IB 規格 Vol.1 7.9 節の解説） |
| 1 ブロック | 64 B。パケットは整数個のブロックを使う | 出典11 |
| 数え方 | 受け手は「上限 FCCL ＝ 受け取った総ブロック数 ＋ 空いている受け口」を送る。送り手は「送った総ブロック数 ＋ パケットの大きさ ≦ FCCL」のときだけ送る。クレジットの知らせが1つ消えても次ので取り戻せる | 出典11 |
| 上限 | 12 ビットの数で最大 2,048 クレジット ＝ 128 KB（2014 年の値） | 出典11。**XDR の値は未確認** |
| 単位 | VL（仮想レーン）ごとに別の受け口と別のクレジット。だから1つの VL が詰まっても他は止まらない | 出典11 |
| Ethernet の PFC | 優先度ごとに「止まれ」（PAUSE）を送る。目的は「混雑で捨てることを無くす」 | 出典12。止まれが届くまでに線の上にいる分を受け止める余裕（ヘッドルーム）が要る → 一般的な説明（**Cisco の白書は取得に失敗、未読**） |
| Catalyst 9300 | 既定では列が満杯になったら末尾で捨てる（WTD）。1 Gbps ずつ溜まると 1.2288 ms で満杯 | `switch/refs.md` |
| 輻輳制御 | 「テレメトリに基づく輻輳制御」（クレジットとは別の、端から端の仕組み）。規格 1.7 は遅延を測るための「Network Probe」を足した | 出典1、出典10 |

### スイッチの中で集計する — SHARP（出典1、3、15）
| 項目 | 値 | 根拠 |
|---|---|---|
| 世代 | SHARPv4（第4世代） | 出典1、3、4 |
| 増えたこと | FP8、ReduceScatter・ScatterGather | 出典1 |
| 能力 | 14.4 TFLOPS（前の世代の 9 倍） | 出典3 |
| 効果（NVIDIA の主張） | 性能が最大 9 倍 | 出典1 |
| 仕組み | 集団通信を GPU・CPU から網へ移す。集計点（aggregation node）を通るたびに網を流れる量が減る。第3世代から、同じ網の上に複数の集計の木を作れる | 出典15 |
- **食い違い**: 出典6（GB300 RA）の「Compute Fabric」の箇条書きは「SHARPv3」「Managed NDR switches」と書く。前の世代の文の残りと読める（推測）。画面は出典1・3 の v4 にする。

## 網の組み方 — ファットツリー（出典6 表3、`room/research-hall.md` 1-2）
| 項目 | 値 | 根拠 |
|---|---|---|
| 1 SU | DGX GB300 NVL72 8 本 ＝ GPU 576 個 | 出典6 |
| GPU 1 個の口 | ConnectX-8 1 枚・800G。計算トレイ 1 台に 4 枚 | 出典6「four ConnectX-8 NICs」、出典7（C8180 は 800G XDR の 1 ポート） |
| レール | 計算トレイの中の GPU の番号（1〜4）ごとに別のリーフへ。1 SU は 4 レール × リーフ 2 台 ＝ リーフ 8 台 | 出典6 |
| 2 層で何 SU まで | 16 SU（約 9k GPU） | 出典6 |
| 表3 | 2 SU: リーフ 16・スパイン 8 ／ 4 SU: 32・18 ／ 8 SU: 64・36 ／ 16 SU: 128・72 | 出典6 表3。`room/research-hall.md` 1-2 の表と一致 |
| 1 SU だけのスパイン | 表3 に行が無い | **未確認**（下の検算では 4 台と計算） |
| どのラックがどのリーフへ | 1 レール 144 GPU を 2 台に分ける分け方は図だけ | **仮定**: ラック 1〜4 → リーフ A、5〜8 → リーフ B |
| 2 層の上限 | NIC 10,368 個 | 出典1 |
| 比べる相手 | 同じ RA の Ethernet（ストレージ・管理）は計算リーフの上りを 400G × 24 本にして 1:3 で絞る | 出典6 |
- **食い違い**: 出典6 は「同じ SU の同じレールなら常に 1 ホップ」と書くが、1 レールにリーフが 2 台あるので、リーフ A とリーフ B のあいだはスパインを通る（計算）。画面では「同じリーフの中なら 1 段、それ以外はスパインを通って 3 段」と書く。
- 線: スイッチの側は OSFP 1 個で 2 ポート（1.6T）の光モジュールか銅ケーブル。NIC の側は 800G 1 ポート。光は単一モード 500 m まで、銅は 1.1〜3 m（出典7）。

## 検算（`qx800/kin.test.mjs` で機械的に確かめる値）
- **交換容量**: 144 ポート × 800 Gb/s = **115.2 Tb/s**（出典1 と一致。片方向の合計）。両方向で数えると **230.4 Tb/s**
- **レーンの数**: 72 ケージ × 8 レーン = **576 レーン**、× 200 Gb/s = **115.2 Tb/s**（出典5 の「送信レーン 576」と一致）
- **チップの数**: 115.2 ÷ 28.8 = **4 個**。1 個のレーンは 576 ÷ 4 = **144 本**（× 200G = 28.8 Tb/s で出典5 と一致）
- **Catalyst 9300 との差**: Catalyst の交換容量 256 Gbps は両方向で数えた値（`switch/refs.md`）。同じ数え方で 230.4 Tb/s ÷ 256 Gb/s = **900 倍**
- **リーフ 1 台が収容する GPU**: 下り 72 ＋ 上り 72 = 144。上りと下りが同じ本数なので **1:1（ノンブロッキング）**。1 台で **GPU 72 個**（NVL72 1 本と同じ数だが、4 本のラックの同じレールから来る）
- **1 SU のリーフ**: 576 GPU ÷ 72 = **8 台**（出典6 と一致）。レールで数えても 4 × 2 = 8、1 レールは 8 ラック × 18 トレイ = 144 GPU = 2 × 72
- **スパインの本数が表3と合う**（リーフ × 72 本の上りをスパインで割る。どれも 144 ポート以内）:
  - 2 SU: 16 × 72 = 1,152 本 ÷ 8 台 = スパイン 1 台 **144 本**（リーフ 1 台とスパイン 1 台のあいだ 9 本）
  - 4 SU: 32 × 72 = 2,304 ÷ 18 = **128 本**（1 組 4 本）
  - 8 SU: 64 × 72 = 4,608 ÷ 36 = **128 本**（1 組 2 本）
  - 16 SU: 128 × 72 = 9,216 ÷ 72 = **128 本**（1 組 1 本）
  - 1 SU（表に無い）: 8 × 72 = 576 ÷ 144 = **4 台**（**計算**）
- **2 層の上限**: スパイン 1 台の 144 ポートで結べるリーフは 144 台 → 144 × 72 = **10,368 GPU**（出典1 と一致）＝ 18 SU。RA は 16 SU（9,216 GPU）で止めている
- **線に乗る時間**: 4,096 B を 800 Gb/s で 4,096 × 8 ÷ 800 × 10⁹ = **40.96 ns**（見出しなどの上乗せは入れない＝**仮定**）。Catalyst の 1,518 B を 1 Gbps で 12.304 µs（`switch/refs.md`）の **約 300 分の 1**
- **クレジット**: 4,096 B のパケット 1 個 = 4,096 ÷ 64 = **64 クレジット**。2014 年の上限 2,048 クレジット = **131,072 B（128 KB）**
- **往復のあいだに線の上にいる量**（受け口が最低これだけ要る。光が 1 m を 5 ns で進む＝**仮定**）: 銅 2 m なら往復 20 ns、800 Gb/s × 20 ns = **2,000 B**（約 32 クレジット）。光 100 m なら往復 1 µs で **100,000 B**
- **ポートあたりの電力**: 典型 2,900 ÷ 144 = **20.1 W**、最大 7,000 ÷ 144 = **48.6 W**。差 4,100 W を 72 ケージで割ると **56.9 W**（光モジュールの分と読む＝**推測**）
- **all-reduce（帯域だけの単純計算。遅延と NVLink は入れない＝仮定）**: 1 SU 576 GPU で 1 GB を合計。GPU 1 個の口は片方向 100 GB/s（800 Gb/s）
  - リング方式: 1 個が送る量 = 2 × 575 ÷ 576 × 1 GB = **1.9965 GB**、**19.97 ms**
  - スイッチの中で合計（SHARP）: 1 個が送るのは 1 GB、**10 ms**
- **Catalyst 9300 との大きさ**: 1U・7.59 kg・電源 715 W に対して 4U・60 kg・最大 7,000 W（電力は **9.8 倍**）

## 実機で見るには（各章の下に添える。どれも実機のみ）
| 章 | コマンド | 何が見えるか |
|---|---|---|
| 1 外観 | `nv show platform` / `nv show platform environment fan` / `nv show platform environment psu` | 型番、ファン 10 台の回転、電源 8 台の電力（NVOS。出典9） |
| 2 分解 | `nv show platform` | スイッチのチップと CPU の情報（中身の細部は版で違う） |
| 3 経路を配る | `sminfo` / `ibswitches` / `ibnetdiscover` / `ibroute <スイッチの LID>` | 今の主の SM、スイッチの一覧、網の地図、SM が書いた LFT（宛先 LID → 出口ポート） |
| 4 捨てずに待つ | `perfquery -x <LID> <ポート>`（PortXmitWait）/ `ibqueryerrors` | クレジットが無くて待った時間の数、エラーの数。捨てた数ではなく待った数が増える |
| 5 ファットツリー | `ibnetdiscover` / `ibdiagnet` | リーフとスパインのつながり、経路の点検 |
| 6 SHARP | `all_reduce_perf -b 1G -e 1G`（nccl-tests。SHARP の有無を切り替えて比べる） | busbw の差 |
| 7 電力と風 | `nv show platform environment temperature` / `nv show platform environment psu` | 温度と電力 |
- `sminfo`・`ibroute`・`perfquery` などは infiniband-diags の道具で、NVIDIA の文書の中での綴りは今回確かめていない（**未確認**。一般に広く使われている名前）。

## 次の世代（画面の脚注）
- Q3450-LD: 同じ 144 × 800G を、光をチップの横に載せた CPO と液冷で。差し込み式の光モジュールが無くなる（出典2a、出典5）。最大 4.3 kW（出典2b）。ここだけ見て省電力の倍率は書かない。

## 確かめられなかった値（まとめ）
- Q3400-RA の中のチップの数（4 個は計算）と、チップどうしのつなぎ方
- ポートからポートへの遅延（数値の公表なし）
- 電源の冗長の方式、ファンと電源の背面の並び、前面のケージの並び
- XDR でのクレジットの上限（2014 年の 128 KB は古い世代の値）
- 適応ルーティングの出口の選び方、自己修復の回復時間
- 1 SU だけのときのスパインの台数（表に無い。計算で 4 台）
